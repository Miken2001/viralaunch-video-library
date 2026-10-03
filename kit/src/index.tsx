/**
 * @viralaunch/kit — the small shared runtime every library entry builds on.
 *
 * An entry receives `{media, props}`:
 *   - `media` is prepared by ViraLaunch (narration audio, word captions, per-scene assets,
 *     music, brand, output size). Entries never fetch anything: every URL in `media` is
 *     already a local static file.
 *   - `props` is the entry's own data, validated by the zod schema the entry exports.
 *     This is the ONLY thing a model writes in the "fill" tier.
 *
 * Allowed imports inside an entry: react, remotion, zod, @viralaunch/kit, the
 * @remotion/* packages listed in the entry's meta.json, and the entry's own files.
 */
import React from 'react';
import {
  AbsoluteFill,
  Audio,
  Img,
  OffthreadVideo,
  Sequence,
  interpolate,
  useCurrentFrame,
  useVideoConfig,
} from 'remotion';
import {z} from 'zod';
export {ICON_NAMES, type IconName} from './icon-names';

export const CaptionSchema = z.object({
  text: z.string(),
  startMs: z.number().nonnegative(),
  endMs: z.number().nonnegative(),
});

export const SceneSchema = z.object({
  /** The narration line for this scene (also what the captions spell). */
  text: z.string().default(''),
  /** Resolved local URL of this scene's image or video, or '' when none. */
  video: z.string().default(''),
  isStaticImage: z.boolean().default(true),
  audio: z.object({url: z.string(), duration: z.number().positive()}),
  captions: z.array(CaptionSchema).default([]),
});

export const BrandSchema = z.object({
  name: z.string().default(''),
  tagline: z.string().default(''),
  cta: z.string().default(''),
  /** Bare domain shown on cards, e.g. "atlasnotes.app" (never a full URL). */
  website: z.string().default(''),
  accent: z.string().default('#FF6B00'),
  /** Resolved local URL of the logo, or ''. */
  logo: z.string().default(''),
});

export const MediaSchema = z.object({
  scenes: z.array(SceneSchema).min(1),
  music: z.object({url: z.string(), start: z.number(), end: z.number(), volume: z.number().min(0).max(1)}).optional(),
  durationMs: z.number().positive(),
  fps: z.number().int().positive().default(30),
  width: z.number().int().positive().default(1080),
  height: z.number().int().positive().default(1920),
  narration: z.boolean().default(true),
  captions: z.boolean().default(true),
  brand: BrandSchema.prefault({}),
  /** How the user's product may appear. Entries must honour it (see AdWeave below). */
  adWeave: z.enum(['native-integrated', 'end-card', 'mid-roll-card', 'sponsor-mention', 'none-pure-brand']).default('end-card'),
  /**
   * Shared accent colour (hex). Set by multi-template sequences so every segment uses the same
   * highlight colour; entries use it in place of their palette accent when present.
   */
  accent: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
  /** Mandatory disclosure text for sponsored placements; render it whenever non-empty. */
  disclosure: z.string().default(''),
  /**
   * Renderer-specific shared settings (caption position/colours, music volume...). Only the
   * legacy ViraLaunch styles read it; new entries should ignore it and use their own props.
   */
  extra: z.record(z.string(), z.unknown()).default({}),
});

export type Caption = z.infer<typeof CaptionSchema>;
export type Scene = z.infer<typeof SceneSchema>;
export type Brand = z.infer<typeof BrandSchema>;
export type Media = z.infer<typeof MediaSchema>;
export type EntryProps<P> = {media: Media; props: P};

export type LibraryEntry<S extends z.ZodTypeAny> = {
  id: string;
  schema: S;
  component: React.FC<EntryProps<z.infer<S>>>;
};

/** Every entry's src/index.ts default-exports the result of defineEntry. */
export function defineEntry<S extends z.ZodTypeAny>(entry: LibraryEntry<S>): LibraryEntry<S> {
  return entry;
}

export type TimedScene = {scene: Scene; index: number; from: number; durationInFrames: number};

/** Frame ranges for every scene, back to back, in the order narration plays them. */
export function sceneTimeline(scenes: Scene[], fps: number): TimedScene[] {
  let from = 0;
  return scenes.map((scene, index) => {
    const durationInFrames = Math.max(1, Math.round(scene.audio.duration * fps));
    const timed = {scene, index, from, durationInFrames};
    from += durationInFrames;
    return timed;
  });
}

export function useSceneTimeline(media: Media): TimedScene[] {
  const {fps} = useVideoConfig();
  return React.useMemo(() => sceneTimeline(media.scenes, fps), [media.scenes, fps]);
}

/** Plays every scene's narration (and the music bed) at the right time. Render it once. */
export const NarrationTrack: React.FC<{media: Media}> = ({media}) => {
  const timeline = useSceneTimeline(media);
  const {fps} = useVideoConfig();
  return (
    <>
      {timeline.map(t => (
        <Sequence key={t.index} from={t.from} durationInFrames={t.durationInFrames} layout="none">
          {t.scene.audio.url ? <Audio src={t.scene.audio.url} /> : null}
        </Sequence>
      ))}
      {media.music && media.music.url ? (
        <Audio src={media.music.url} volume={media.music.volume} startFrom={Math.round(media.music.start * fps)} />
      ) : null}
    </>
  );
};

/** Cover-fit image or video for a scene, with an optional slow Ken Burns push. */
export const SceneAsset: React.FC<{scene: Scene; kenBurns?: boolean; style?: React.CSSProperties}> = ({scene, kenBurns = true, style}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  if (!scene.video) return null;
  const scale = kenBurns ? interpolate(frame, [0, scene.audio.duration * fps], [1.04, 1.14], {extrapolateRight: 'clamp'}) : 1;
  const common: React.CSSProperties = {width: '100%', height: '100%', objectFit: 'cover', transform: `scale(${scale})`, ...style};
  return scene.isStaticImage ? <Img src={scene.video} style={common} /> : <OffthreadVideo src={scene.video} muted style={common} />;
};

/** Index of the caption word being spoken at `ms`, or -1. */
export function activeWord(captions: Caption[], ms: number): number {
  return captions.findIndex(c => ms >= c.startMs && ms < c.endMs);
}

/**
 * Word-synced caption line for the scene currently on screen. Place it inside the scene's
 * <Sequence> so frame 0 is the scene start. Shows a sliding window of `words` words.
 */
export const Captions: React.FC<{
  scene: Scene;
  words?: number;
  color?: string;
  highlight?: string;
  style?: React.CSSProperties;
}> = ({scene, words = 6, color = '#FFFFFF', highlight = '#FFD60A', style}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const captions = scene.captions.length ? scene.captions : evenCaptions(scene.text, scene.audio.duration * 1000);
  const ms = (frame / fps) * 1000;
  const current = Math.max(0, activeWord(captions, ms));
  const start = Math.floor(current / words) * words;
  const window = captions.slice(start, start + words);
  return (
    <div style={{display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: '0 0.3em', fontWeight: 800, fontSize: 64, lineHeight: 1.15, textAlign: 'center', ...style}}>
      {window.map((c, i) => (
        <span key={start + i} style={{color: start + i === current ? highlight : color, textShadow: '0 4px 24px rgba(0,0,0,.6)'}}>
          {c.text.trim()}
        </span>
      ))}
    </div>
  );
};

/** Fallback when no word timings exist: spread the words evenly over the scene. */
export function evenCaptions(text: string, durationMs: number): Caption[] {
  const words = text.split(/\s+/).filter(Boolean);
  return words.map((w, i) => ({text: ' ' + w, startMs: (i * durationMs) / words.length, endMs: ((i + 1) * durationMs) / words.length}));
}

/** Frames the closing brand card occupies (0 unless the item uses an end card). */
export function endCardFrames(media: Media, fps: number, durationInFrames: number): number {
  if (media.adWeave !== 'end-card' || !media.brand.name) return 0;
  return Math.min(Math.round(2.5 * fps), Math.floor(durationInFrames / 3));
}

/** Frames available for the entry's own content: time your reveals inside this window. */
export function useContentFrames(media: Media): number {
  const {fps, durationInFrames} = useVideoConfig();
  return durationInFrames - endCardFrames(media, fps, durationInFrames);
}

/**
 * The single, shared implementation of product placement. Entries render
 * <AdWeave media={media} /> once at the top level and get the right behaviour for the
 * campaign item: an end card in the last ~2.5 s, a mid-roll card, a lower-third mention,
 * or nothing. native-integrated renders nothing here because the entry's own props carry
 * the product. The disclosure is always shown when present.
 */
export const AdWeave: React.FC<{media: Media; theme?: {background?: string; text?: string; font?: string}}> = ({media, theme = {}}) => {
  const {fps, durationInFrames} = useVideoConfig();
  const brand = media.brand;
  const text = theme.text ?? '#FFFFFF';
  const font = theme.font ?? 'Inter, system-ui, sans-serif';
  const disclosure = media.disclosure ? <Disclosure text={media.disclosure} color={text} font={font} /> : null;
  if (media.adWeave === 'none-pure-brand' || !brand.name) return disclosure;
  const card = Math.min(Math.round(2.5 * fps), Math.floor(durationInFrames / 3));
  if (media.adWeave === 'end-card') {
    // Same length as endCardFrames(), which entries use to finish their content in time.
    return (
      <>
        {disclosure}
        <Sequence from={durationInFrames - card} durationInFrames={card}>
          <BrandCard brand={brand} background={theme.background ?? '#0B0B14'} color={text} font={font} />
        </Sequence>
      </>
    );
  }
  if (media.adWeave === 'mid-roll-card') {
    const from = Math.floor(durationInFrames / 2 - card / 2);
    return (
      <>
        {disclosure}
        <Sequence from={from} durationInFrames={card}>
          <BrandCard brand={brand} background={theme.background ?? '#0B0B14'} color={text} font={font} compact />
        </Sequence>
      </>
    );
  }
  if (media.adWeave === 'sponsor-mention') {
    return (
      <>
        {disclosure}
        <Sequence from={Math.round(fps)} durationInFrames={Math.round(4 * fps)}>
          <SponsorLowerThird brand={brand} font={font} />
        </Sequence>
      </>
    );
  }
  return disclosure;
};

export const BrandCard: React.FC<{brand: Brand; background: string; color: string; font: string; compact?: boolean}> = ({brand, background, color, font, compact}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const enter = interpolate(frame, [0, 0.4 * fps], [0, 1], {extrapolateRight: 'clamp'});
  return (
    <AbsoluteFill style={{background, opacity: compact ? 0.94 : 1, justifyContent: 'center', alignItems: 'center', fontFamily: font, color}}>
      <div style={{transform: `translateY(${(1 - enter) * 40}px)`, opacity: enter, textAlign: 'center', padding: 80}}>
        {brand.logo ? <Img src={brand.logo} style={{width: 180, height: 180, objectFit: 'contain', marginBottom: 40}} /> : null}
        <div style={{fontSize: 84, fontWeight: 800}}>{brand.name}</div>
        {brand.tagline ? <div style={{fontSize: 40, opacity: 0.8, marginTop: 20}}>{brand.tagline}</div> : null}
        {brand.cta ? (
          <div style={{marginTop: 60, display: 'inline-block', padding: '24px 48px', borderRadius: 999, background: brand.accent, color: '#000', fontSize: 40, fontWeight: 700}}>
            {brand.cta}
          </div>
        ) : null}
        {brand.website ? <div style={{fontSize: 32, opacity: 0.7, marginTop: 28}}>{brand.website}</div> : null}
      </div>
    </AbsoluteFill>
  );
};

export const SponsorLowerThird: React.FC<{brand: Brand; font: string}> = ({brand, font}) => {
  const frame = useCurrentFrame();
  const {fps, durationInFrames} = useVideoConfig();
  const {height} = useVideoConfig();
  const x = interpolate(frame, [0, 0.3 * fps, durationInFrames - 0.3 * fps, durationInFrames], [-700, 0, 0, -700], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});
  // Padding in px of height (CSS % padding would resolve against width).
  return (
    <AbsoluteFill style={{justifyContent: 'flex-end', paddingBottom: height * 0.3, fontFamily: font}}>
      <div style={{transform: `translateX(${x}px)`, alignSelf: 'flex-start', background: 'rgba(0,0,0,.72)', borderLeft: `10px solid ${brand.accent}`, padding: '22px 36px', color: '#fff', fontSize: 34}}>
        Brought to you by <b>{brand.name}</b>
        {brand.tagline ? <span style={{opacity: 0.75}}> — {brand.tagline}</span> : null}
      </div>
    </AbsoluteFill>
  );
};

export const Disclosure: React.FC<{text: string; color?: string; font?: string}> = ({text, color = '#FFFFFF', font = 'Inter, system-ui, sans-serif'}) => (
  <AbsoluteFill style={{justifyContent: 'flex-start', alignItems: 'flex-end', padding: 36, pointerEvents: 'none'}}>
    <div style={{fontFamily: font, fontSize: 24, color, opacity: 0.85, background: 'rgba(0,0,0,.45)', padding: '8px 16px', borderRadius: 8}}>{text}</div>
  </AbsoluteFill>
);

/** Spring-free ease helpers that read well in generated code. */
export const fadeIn = (frame: number, start: number, length: number) => interpolate(frame, [start, start + length], [0, 1], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});
export const fadeOut = (frame: number, end: number, length: number) => interpolate(frame, [end - length, end], [1, 0], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});
