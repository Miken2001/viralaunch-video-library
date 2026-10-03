/**
 * Multi-template sequences, node side (no browser code). A sequence renders each segment as its
 * own composition (silent), cross-fades the clips with ffmpeg and lays ONE continuous narration
 * + music track underneath, so the voice never stutters at a cut.
 *
 * Shared by viralaunch-local's renderer worker and this repo's `pnpm sequence-preview`.
 */

/** The parts of kit `Media` this module needs (kept structural to avoid a browser import). */
export type SequenceMedia = {
  scenes: Array<{text: string; video: string; isStaticImage: boolean; audio: {url: string; duration: number}; captions: Array<{text: string; startMs: number; endMs: number}>}>;
  durationMs: number;
  fps: number;
  width: number;
  height: number;
  adWeave: 'native-integrated' | 'end-card' | 'mid-roll-card' | 'sponsor-mention' | 'none-pure-brand';
  disclosure: string;
  accent?: string;
  /** Cross-fade tail added to this segment (set by segmentMedia). */
  tailMs?: number;
  /** Shared look (kit look.tsx): preset + overrides. Every segment gets the same one. */
  look?: SequenceLook;
  music?: unknown;
  [key: string]: unknown;
};
export type SegmentSpec = {templateId: string; props: Record<string, unknown>; fromScene: number; toScene: number; role: string; anchor?: boolean};
export type SequenceLook = {preset?: string; [token: string]: unknown};

/**
 * The one look a sequence uses everywhere: explicit overrides win, then the anchor segment's
 * preset (the segment marked `anchor`, else the first one — normally the hook). `presetOf`
 * returns a template's meta.json `lookPreset`.
 */
export function sequenceLook(segments: SegmentSpec[], presetOf: (templateId: string) => string | undefined, overrides?: SequenceLook): SequenceLook {
  const anchor = segments.find(s => s.anchor) ?? segments[0];
  return {...overrides, preset: overrides?.preset ?? presetOf(anchor.templateId) ?? 'cinematic'};
}
export type Transition = 'light-leak-dissolve' | 'whip' | 'zoom' | 'cut';

/** Seconds of overlap between two segments. */
export const TRANSITION_SECONDS: Record<Transition, number> = {'light-leak-dissolve': 0.6, whip: 0.35, zoom: 0.45, cut: 0};
const XFADE: Record<Transition, string> = {'light-leak-dissolve': 'fade', whip: 'smoothleft', zoom: 'zoomin', cut: 'fade'};

/** Which segment carries a placement: end card last, sponsor mention first, mid-roll in the middle. */
export function placementFor(adWeave: SequenceMedia['adWeave'], index: number, count: number): SequenceMedia['adWeave'] {
  if (adWeave === 'end-card') return index === count - 1 ? 'end-card' : 'none-pure-brand';
  if (adWeave === 'sponsor-mention') return index === 0 ? 'sponsor-mention' : 'none-pure-brand';
  if (adWeave === 'mid-roll-card') return index === Math.floor((count - 1) / 2) ? 'mid-roll-card' : 'none-pure-brand';
  return adWeave;
}

/**
 * Media for one segment: only its scenes, narration muted (the stitched track carries it), the
 * placement routed to the right segment, and — for every segment but the last — the final scene
 * padded by the transition length so the cross-fade has frames to blend.
 */
export function segmentMedia(media: SequenceMedia, segment: SegmentSpec, index: number, count: number, transition: Transition): SequenceMedia {
  const pad = index < count - 1 ? TRANSITION_SECONDS[transition] : 0;
  const scenes = media.scenes.slice(segment.fromScene, segment.toScene + 1).map((s, i, all) => ({
    ...s,
    audio: {url: '', duration: s.audio.duration + (i === all.length - 1 ? pad : 0)},
  }));
  const seconds = scenes.reduce((n, s) => n + s.audio.duration, 0);
  return {...media, scenes, durationMs: Math.round(seconds * 1000), tailMs: Math.round(pad * 1000), adWeave: placementFor(media.adWeave, index, count), music: undefined};
}

/** Unpadded length of each segment in seconds. */
export function segmentSeconds(media: SequenceMedia, segments: SegmentSpec[]) {
  return segments.map(s => media.scenes.slice(s.fromScene, s.toScene + 1).reduce((n, sc) => n + sc.audio.duration, 0));
}

/**
 * ffmpeg args that cross-fade the rendered clips (each non-last clip already padded by T) into
 * `out`. With clips of length L0+T, L1+T, …, Ln the result is exactly ΣL long.
 */
export function stitchArgs(clips: string[], lengths: number[], transition: Transition, out: string): string[] {
  if (clips.length === 1 || transition === 'cut') {
    const inputs = clips.flatMap(c => ['-i', c]);
    const filter = clips.map((_, i) => `[${i}:v]`).join('') + `concat=n=${clips.length}:v=1:a=0[v]`;
    return ['-y', ...inputs, '-filter_complex', filter, '-map', '[v]', '-an', '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-preset', 'medium', '-crf', '18', out];
  }
  const t = TRANSITION_SECONDS[transition];
  const parts: string[] = [];
  let label = '[0:v]';
  let offset = 0;
  for (let i = 1; i < clips.length; i++) {
    offset += lengths[i - 1];
    const next = `[x${i}]`;
    parts.push(`${label}[${i}:v]xfade=transition=${XFADE[transition]}:duration=${t}:offset=${(offset - 0).toFixed(3)}${next}`);
    label = next;
  }
  // A warm bloom on light-leak dissolves: brighten + warm the frames around each cut.
  let final = label;
  if (transition === 'light-leak-dissolve') {
    let at = 0;
    const windows = lengths.slice(0, -1).map(l => {
      at += l;
      return `between(t,${(at - 0.05).toFixed(3)},${(at + t + 0.05).toFixed(3)})`;
    });
    parts.push(`${label}eq=brightness=0.06:saturation=1.12:enable='${windows.join('+')}',colorbalance=rs=0.08:gs=0.03:bs=-0.06:enable='${windows.join('+')}'[v]`);
    final = '[v]';
  }
  return ['-y', ...clips.flatMap(c => ['-i', c]), '-filter_complex', parts.join(';'), '-map', final, '-an', '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-preset', 'medium', '-crf', '18', out];
}

/**
 * ffmpeg args for the final mux: concatenated narration WAVs (+ optional music bed at `volume`),
 * trimmed to the video's length, muxed with the stitched video.
 */
export function muxArgs(video: string, narration: string[], music: string | undefined, volume: number, seconds: number, out: string): string[] {
  if (!narration.length && !music) {
    // Silent preview: a silent AAC track keeps players and platforms happy.
    return ['-y', '-i', video, '-f', 'lavfi', '-i', 'anullsrc=r=48000:cl=stereo', '-map', '0:v', '-map', '1:a', '-c:v', 'copy', '-c:a', 'aac', '-t', seconds.toFixed(3), out];
  }
  const inputs = ['-i', video, ...narration.flatMap(f => ['-i', f]), ...(music ? ['-i', music] : [])];
  const n = narration.length;
  if (!n) return ['-y', ...inputs, '-filter_complex', `[1:a]volume=${volume},atrim=0:${seconds.toFixed(3)}[a]`, '-map', '0:v', '-map', '[a]', '-c:v', 'copy', '-c:a', 'aac', '-t', seconds.toFixed(3), out];
  const voice = narration.map((_, i) => `[${i + 1}:a]`).join('') + `concat=n=${n}:v=0:a=1[voice]`;
  const mix = music ? `;[${n + 1}:a]volume=${volume},atrim=0:${seconds.toFixed(3)}[bed];[voice][bed]amix=inputs=2:duration=first:dropout_transition=0[a]` : ';[voice]anull[a]';
  return ['-y', ...inputs, '-filter_complex', voice + mix, '-map', '0:v', '-map', '[a]', '-c:v', 'copy', '-c:a', 'aac', '-b:a', '192k', '-t', seconds.toFixed(3), out];
}
