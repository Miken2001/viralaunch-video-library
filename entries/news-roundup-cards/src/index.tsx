import React from 'react';
import {AbsoluteFill, Sequence, spring, useCurrentFrame, useVideoConfig} from 'remotion';
import {AdWeave, NarrationTrack, captionSafeBottom, defineEntry, mix, useContentFrames, useLook, useSceneTimeline, type ActiveLook, type EntryProps, type Scene} from '@viralaunch/kit';
import {CameraImage, Grain, GridLines, KineticText, LightLeak, LineIcon, Particles, StyledCaptions, Vignette, alpha, countUp, ease, fonts, progress, tween, type CameraMove} from '@viralaunch/kit/fx';
import {Props, type Story} from './schema';

type Pal = {bg: string; bg2: string; surface: string; text: string; muted: string; accent: string; line: string; light: boolean; leakHue: number};

const PALETTES: Record<Props['palette'], Pal> = {
  midnight: {bg: '#080d1c', bg2: '#15203d', surface: '#0f172d', text: '#eef2ff', muted: '#8b99bd', accent: '#4fd1ff', line: '#2a3759', light: false, leakHue: 180},
  graphite: {bg: '#0d0d0f', bg2: '#1f1f25', surface: '#16161a', text: '#f4f4f5', muted: '#a1a1aa', accent: '#ff5a36', line: '#33333b', light: false, leakHue: 0},
  violet: {bg: '#110a1e', bg2: '#2a1547', surface: '#1b1030', text: '#f6f0ff', muted: '#a896c8', accent: '#c6ff3d', line: '#3b2763', light: false, leakHue: 240},
  paper: {bg: '#f3eee4', bg2: '#e4dbc9', surface: '#fffdf8', text: '#1f1d1a', muted: '#776f62', accent: '#e0452b', line: '#d5cab5', light: true, leakHue: 0},
};

/** The deck in a sequence's shared look: same background family, surfaces, strokes and accent. */
const fromLook = (l: ActiveLook): Pal => ({
  bg: l.palette.bg,
  bg2: l.palette.bg2,
  surface: l.palette.surface,
  text: l.palette.text,
  muted: l.palette.muted,
  accent: l.palette.accent,
  line: mix(l.palette.surface, l.palette.line, 0.22),
  light: l.tone === 'light',
  leakHue: 0,
});

/** The accent as text or line art: deepened toward the text colour on light palettes so it stays legible. */
const deep = (p: Pal) => (p.light ? mix(p.accent, p.text, 0.45) : p.accent);

/** Readable ink on top of a colour (chips and number badges sit on the accent). */
function inkOn(hex: string) {
  const n = parseInt(hex.slice(1), 16);
  const lum = (0.299 * ((n >> 16) & 255) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255)) / 255;
  return lum > 0.6 ? '#0b0b0f' : '#ffffff';
}

const MOVES: CameraMove[] = ['push', 'pan-right', 'pull', 'pan-left'];
const nn = (i: number) => String(i + 1).padStart(2, '0');

/** Frame windows: an intro, then one window per story locked to its narration scene. */
function plan(scenes: {from: number; durationInFrames: number}[], count: number, contentEnd: number, fps: number) {
  let introEnd: number;
  let starts: number[];
  let sceneOf: (i: number) => number;
  if (scenes.length >= count + 1) {
    // Scene 0 is the intro; story i is narrated by scene i + 1 (extra scenes extend the last story).
    introEnd = scenes[1].from;
    starts = Array.from({length: count}, (_, i) => scenes[i + 1].from);
    sceneOf = i => i + 1;
  } else if (scenes.length === count) {
    introEnd = Math.min(Math.round(1.6 * fps), Math.round(scenes[0].durationInFrames * 0.4));
    starts = Array.from({length: count}, (_, i) => (i === 0 ? introEnd : scenes[i].from));
    sceneOf = i => i;
  } else {
    introEnd = Math.min(Math.round(1.6 * fps), Math.floor(contentEnd / (count + 2)));
    const per = (contentEnd - introEnd) / count;
    starts = Array.from({length: count}, (_, i) => Math.round(introEnd + i * per));
    sceneOf = () => -1;
  }
  // Every story keeps at least ~1 s before the end card so its reveals can finish.
  const latest = (i: number) => contentEnd - (count - i) * Math.round(fps);
  starts = starts.map((s, i) => Math.max(1, Math.min(s, latest(i))));
  introEnd = Math.min(introEnd, starts[0]);
  const ends = starts.map((_, i) => (i === count - 1 ? contentEnd : starts[i + 1]));
  return {introEnd, starts, ends, sceneOf};
}

const Chip: React.FC<{label: string; pal: Pal; filled?: boolean; icon?: string; size: number; p: number}> = ({label, pal, filled, icon, size, p}) => (
  <div style={{display: 'inline-flex', alignItems: 'center', gap: size * 0.45, padding: `${size * 0.42}px ${size * 0.8}px`, borderRadius: size * 0.4, background: filled ? pal.accent : 'transparent', border: filled ? 'none' : `2px solid ${alpha(pal.text, 0.28)}`, color: filled ? inkOn(pal.accent) : pal.text, fontFamily: fonts.mono, fontWeight: 700, fontSize: size, letterSpacing: '0.12em', textTransform: 'uppercase', whiteSpace: 'nowrap', opacity: Math.min(1, p * 1.5), transform: `translateY(${(1 - p) * size}px) scale(${0.85 + 0.15 * p})`, transformOrigin: 'left center'}}>
    {icon ? <LineIcon name={icon} size={size * 1.1} color={filled ? inkOn(pal.accent) : deep(pal)} strokeWidth={8} /> : null}
    {label}
  </div>
);

/** Side panel: the story's scene image, or a drawn emblem around its line icon, plus the hero figure. */
const Panel: React.FC<{story: Story; index: number; scene?: Scene; pal: Pal; s: number; local: number; dur: number; w: number; h: number}> = ({story, index, scene, pal, s, local, dur, w, h}) => {
  const frame = useCurrentFrame();
  const reveal = progress(local, 2, 18, ease.expo);
  const draw = progress(local, 8, Math.min(40, dur * 0.4), ease.cinematic);
  const fig = story.figure;
  const figStart = 12;
  const figLen = Math.max(10, Math.min(45, dur * 0.45));
  const hasImage = Boolean(scene?.video);
  // A wide, short panel (square frames) becomes a strip: emblem on the left, figure on the right.
  const strip = w / h > 2.4;
  const emblem = strip ? h * 0.8 : Math.min(w * 0.62, h * (fig ? 0.46 : 0.7));
  const scan = ((frame * 1.4 + index * 97) % (h * 1.4)) - h * 0.2;
  const ring = (r: number, dash: string, rot: number, op: number) => (
    <circle cx={50} cy={50} r={r} fill="none" stroke={deep(pal)} strokeOpacity={op} strokeWidth={0.5} strokeDasharray={dash} transform={`rotate(${rot} 50 50)`} />
  );
  return (
    <div style={{position: 'relative', width: w, height: h, borderRadius: 28 * s, overflow: 'hidden', background: `radial-gradient(circle at 50% ${fig ? 38 : 50}%, ${alpha(pal.accent, pal.light ? 0.16 : 0.22)} 0%, ${mix(pal.surface, pal.bg2, 0.6)} 55%, ${pal.surface} 100%)`, border: `2px solid ${pal.line}`, clipPath: `inset(${(1 - reveal) * 100}% 0 0 0 round ${28 * s}px)`}}>
      {hasImage && scene ? (
        <AbsoluteFill>
          <CameraImage src={scene.video} isStatic={scene.isStaticImage} move={MOVES[index % MOVES.length]} />
          <AbsoluteFill style={{background: `linear-gradient(180deg, ${alpha(pal.bg, 0.15)} 0%, transparent 35%, ${alpha(pal.bg, fig ? 0.88 : 0.35)} 100%)`}} />
        </AbsoluteFill>
      ) : (
        <AbsoluteFill style={strip ? {alignItems: fig ? 'flex-start' : 'center', justifyContent: 'center', paddingLeft: fig ? h * 0.15 : 0} : {alignItems: 'center', justifyContent: fig ? 'flex-start' : 'center', paddingTop: fig ? h * 0.1 : 0}}>
          <div style={{position: 'relative', width: emblem, height: emblem}}>
            <svg viewBox="0 0 100 100" width={emblem} height={emblem} style={{position: 'absolute', inset: 0, overflow: 'visible'}}>
              {ring(48 * draw, '1.2 2.4', frame * 0.4, 0.55)}
              {ring(40 * draw, '18 6', -frame * 0.6 + index * 40, 0.8)}
              {ring(31, '0.01 0', 0, 0.18 * draw)}
              {Array.from({length: 24}, (_, k) => {
                const a = (k / 24) * Math.PI * 2 + frame * 0.004;
                const on = k / 24 < draw;
                return on ? <line key={k} x1={50 + Math.cos(a) * 44} y1={50 + Math.sin(a) * 44} x2={50 + Math.cos(a) * (k % 6 ? 45.5 : 47.5)} y2={50 + Math.sin(a) * (k % 6 ? 45.5 : 47.5)} stroke={pal.text} strokeOpacity={0.45} strokeWidth={0.5} /> : null;
              })}
            </svg>
            <div style={{position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', transform: `scale(${0.9 + 0.1 * draw + Math.sin(frame / 22) * 0.015})`}}>
              <LineIcon name={story.icon} progress={draw} size={emblem * 0.42} color={deep(pal)} strokeWidth={4} />
            </div>
          </div>
        </AbsoluteFill>
      )}
      {/* slow scan line: keeps the panel alive while the narration runs */}
      <div style={{position: 'absolute', left: 0, right: 0, top: scan, height: 90 * s, background: `linear-gradient(180deg, transparent, ${alpha(pal.accent, 0.08)}, transparent)`}} />
      <div style={{display: strip ? 'none' : 'flex', position: 'absolute', top: 22 * s, left: 26 * s, right: 26 * s, justifyContent: 'space-between', fontFamily: fonts.mono, fontSize: 20 * s, letterSpacing: '0.2em', color: hasImage ? '#ffffff' : pal.muted, opacity: progress(local, 10, 12), textShadow: hasImage ? '0 2px 10px rgba(0,0,0,.6)' : 'none'}}>
        <span>STORY {nn(index)}</span>
        <span style={{color: deep(pal)}}>●{story.category.toUpperCase()}</span>
      </div>
      {fig ? (
        <div style={strip ? {position: 'absolute', right: 36 * s, top: '50%', transform: 'translateY(-50%)', textAlign: 'right'} : {position: 'absolute', left: 30 * s, right: 30 * s, bottom: 28 * s, textAlign: hasImage ? 'left' : 'center'}}>
          <div style={{fontFamily: fonts.heavy, fontSize: strip ? h * 0.42 : Math.min(120 * s, w * 0.22), lineHeight: 1, letterSpacing: '-0.02em', color: hasImage ? '#ffffff' : pal.text, opacity: progress(local, figStart - 4, 8)}}>
            <span style={{color: deep(pal)}}>{fig.prefix}</span>
            {countUp(local, fig.value, figStart, figLen, fig.decimals)}
            <span style={{color: deep(pal), fontSize: '0.55em', marginLeft: 6 * s}}>{fig.unit}</span>
          </div>
          {fig.label ? <div style={{marginTop: 12 * s, fontFamily: fonts.mono, fontSize: 22 * s, letterSpacing: '0.14em', textTransform: 'uppercase', color: hasImage ? 'rgba(255,255,255,.8)' : pal.muted, opacity: progress(local, figStart + 8, 14)}}>{fig.label}</div> : null}
          <div style={{margin: strip ? `${12 * s}px 0 0 auto` : `${16 * s}px ${hasImage ? 0 : 'auto'} 0`, width: `${progress(local, figStart, figLen, ease.expo) * 60}%`, height: 4 * s, borderRadius: 2 * s, background: pal.accent}} />
        </div>
      ) : null}
    </div>
  );
};

/** One story card. Reveals are spread across the story's narration window [start, end). */
const Card: React.FC<{story: Story; index: number; total: number; scene?: Scene; pal: Pal; s: number; start: number; end: number; stacked: boolean; w: number; h: number}> = ({story, index, total, scene, pal, s, start, end, stacked, w, h}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const local = frame - start;
  const dur = Math.max(1, end - start);
  const settle = spring({frame: local, fps, config: {damping: 18, stiffness: 140}});
  const pad = 52 * s;
  const takeAt = Math.max(14, Math.round(dur * 0.16));
  const pointAt = (k: number) => Math.min(dur - 14, Math.round(dur * (0.34 + k * 0.17)));
  const panelW = stacked ? w - pad * 2 : w * (w / h < 1.6 ? 0.36 : 0.4);
  // Text column width; the headline's longest word must fit it on one line.
  const colW = stacked ? panelW : w - pad * 2.8 - panelW;
  const longest = Math.max(...story.headline.split(/\s+/).map(x => x.length), 4);
  const hSize = Math.min((stacked ? 80 : 92) * s * Math.min(1, Math.sqrt(22 / Math.max(22, story.headline.length))), colW / (longest * 0.72));
  const panelH = stacked ? (w / h > 1 ? h * 0.22 : Math.min(h * 0.34, panelW * 0.58)) : h - pad * 2;
  return (
    <div style={{position: 'absolute', inset: 0, borderRadius: 36 * s, background: `linear-gradient(160deg, ${mix(pal.surface, pal.bg2, 0.35)} 0%, ${pal.surface} 60%)`, boxShadow: `0 ${40 * s}px ${110 * s}px ${alpha('#000000', pal.light ? 0.16 : 0.5)}, inset 0 0 0 2px ${pal.line}`, padding: pad, display: 'flex', flexDirection: stacked ? 'column' : 'row-reverse', gap: pad * 0.8, overflow: 'hidden', transform: `translateX(${(1 - settle) * 70 * s}px) scale(${0.97 + 0.03 * settle})`, color: pal.text}}>
      <div style={{position: 'absolute', left: 0, top: 0, bottom: 0, width: 8 * s, background: pal.accent, transform: `scaleY(${progress(local, 0, 16, ease.expo)})`, transformOrigin: 'top'}} />
      <div style={{flex: 'none', width: panelW, height: panelH}}>
        <Panel story={story} index={index} scene={scene} pal={pal} s={s} local={local} dur={dur} w={panelW} h={panelH} />
      </div>
      <div style={{flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column'}}>
        <div style={{fontFamily: fonts.mono, fontSize: 22 * s, letterSpacing: '0.22em', color: pal.muted, opacity: progress(local, 2, 10)}}>
          {nn(index)} / {String(total).padStart(2, '0')}
        </div>
        <div style={{display: 'flex', flexWrap: 'wrap', gap: 14 * s, marginTop: 18 * s}}>
          <Chip label={story.category} pal={pal} filled size={24 * s} p={progress(local, 3, 12, ease.overshoot)} />
          {story.date ? <Chip label={story.date} pal={pal} icon="calendar" size={24 * s} p={progress(local, 7, 12, ease.overshoot)} /> : null}
        </div>
        <div style={{marginTop: 22 * s}}>
          <KineticText text={story.headline} start={start + 6} stagger={2} duration={16} style="rise" textStyle={{fontFamily: fonts.heavy, fontSize: hSize, lineHeight: 1.04, letterSpacing: '-0.015em', color: pal.text}} />
        </div>
        <div style={{marginTop: 26 * s, display: 'flex', gap: 20 * s}}>
          <div style={{width: 6 * s, borderRadius: 3 * s, background: pal.accent, transform: `scaleY(${progress(local, takeAt, 14, ease.expo)})`, transformOrigin: 'top'}} />
          <div style={{flex: 1}}>
            <div style={{fontFamily: fonts.mono, fontSize: 19 * s, letterSpacing: '0.24em', color: deep(pal), opacity: progress(local, takeAt, 10)}}>THE TAKEAWAY</div>
            <KineticText text={story.takeaway} start={start + takeAt + 3} stagger={1.5} duration={14} style="blur" textStyle={{fontFamily: fonts.sans, fontWeight: 600, fontSize: 36 * s, lineHeight: 1.3, color: pal.text, marginTop: 8 * s}} />
          </div>
        </div>
        {story.points.length ? (
          <div style={{marginTop: 26 * s, display: 'flex', flexDirection: 'column', gap: 12 * s}}>
            {story.points.map((pt, k) => {
              const p = progress(local, pointAt(k), 14, ease.expo);
              const pop = progress(local, pointAt(k), 10, ease.overshoot);
              return (
                <div key={k} style={{display: 'flex', alignItems: 'center', gap: 16 * s, opacity: p, transform: `translateX(${(1 - p) * -36 * s}px)`}}>
                  <div style={{flex: 'none', width: 40 * s, height: 40 * s, borderRadius: 9 * s, background: pal.accent, color: inkOn(pal.accent), fontFamily: fonts.mono, fontWeight: 700, fontSize: 22 * s, display: 'flex', alignItems: 'center', justifyContent: 'center', transform: `scale(${pop})`}}>{k + 1}</div>
                  <div style={{fontFamily: fonts.sans, fontWeight: 500, fontSize: 30 * s, lineHeight: 1.25, color: pal.text}}>{pt}</div>
                </div>
              );
            })}
          </div>
        ) : null}
        <div style={{flex: 1, minHeight: 12 * s}} />
        {story.source ? <div style={{fontFamily: fonts.mono, fontSize: 19 * s, letterSpacing: '0.08em', color: pal.muted, opacity: progress(local, Math.round(dur * 0.3), 14)}}>{story.source}</div> : null}
      </div>
    </div>
  );
};

/** Two-tone wipe stinger that hides each card swap (fully covering at `at`). */
const Stinger: React.FC<{at: number; pal: Pal; len: number}> = ({at, pal, len}) => {
  const frame = useCurrentFrame();
  if (frame < at - len - 2 || frame > at + len + 2) return null;
  const bar = (color: string, lag: number) => {
    const lead = tween(frame, [at - len + lag, at - 1 + lag], [0, 100], ease.snappy);
    const tail = tween(frame, [at + 1 + lag, at + len + lag], [0, 100], ease.accelerate);
    return <AbsoluteFill style={{background: color, clipPath: `polygon(${tail}% 0, ${lead + 8}% 0, ${lead}% 100%, ${tail - 8}% 100%)`}} />;
  };
  return (
    <AbsoluteFill style={{pointerEvents: 'none'}}>
      {bar(pal.bg2, 0)}
      {bar(pal.accent, 2)}
    </AbsoluteFill>
  );
};

const NewsRoundupCards: React.FC<EntryProps<Props>> = ({media, props}) => {
  const frame = useCurrentFrame();
  const {fps, width, height} = useVideoConfig();
  const look = useLook();
  const pal: Pal = look ? fromLook(look) : {...PALETTES[props.palette], accent: media.accent ?? PALETTES[props.palette].accent};
  const u = Math.min(width, height) / 1080;
  const portrait = height > width;
  const stacked = width / height < 1.25;
  const timeline = useSceneTimeline(media);
  const contentEnd = useContentFrames(media);
  const stories = props.stories;
  const {introEnd, starts, ends, sceneOf} = plan(timeline, stories.length, contentEnd, fps);
  const current = starts.reduce((c, s, i) => (frame >= s ? i : c), -1);
  const stingLen = Math.round(0.3 * fps);

  // Layout: header bar, then the card down to the caption-safe line.
  const reserve = look ? captionSafeBottom(look) : props.showCaptions ? (portrait ? 0.13 : stacked ? 0.15 : 0.17) : 0.06;
  const sideX = width * (stacked ? 0.055 : 0.05);
  const headerTop = height * (portrait ? 0.05 : 0.045);
  const headerH = 64 * u;
  const cardTop = headerTop + headerH + 26 * u;
  const cardH = height * (1 - reserve) - cardTop;
  const cardW = width - sideX * 2;
  // Design heights the card was drawn for; shrink type and spacing when the space is smaller.
  // (tall portrait cards have spare height, so their type may grow a little past the design size.)
  const need = stacked ? (portrait ? 1180 : 940) * u : 760 * u;
  const s = u * Math.max(0.62, Math.min(portrait ? 1.15 : 1, cardH / need));

  const headerIn = progress(frame, introEnd - 4, 16, ease.expo);
  const introOut = progress(frame, introEnd - 6, 10, ease.accelerate);
  // The title wraps by word: size it so the longest word fits and it stays within ~4 lines.
  const longest = Math.max(...props.title.split(/\s+/).map(w => w.length), 4);
  const titleSize = Math.min((portrait ? 128 : 116) * u, (width * 0.82) / (longest * 0.78), (width * 0.82 * 4) / (props.title.length * 0.78));
  const categories = stories.map(st => st.category.toUpperCase()).filter((c, i, all) => all.indexOf(c) === i).slice(0, 5);

  return (
    <AbsoluteFill style={{background: `radial-gradient(ellipse at 70% 20%, ${pal.bg2} 0%, ${pal.bg} 70%)`, overflow: 'hidden', color: pal.text}}>
      <GridLines color={pal.text} step={Math.round(54 * u)} dots opacity={pal.light ? 0.09 : 0.07} drift={0.15} />
      <Particles count={36} color={pal.accent} opacity={pal.light ? 0.18 : 0.3} seed="roundup" speed={0.35} size={[1.5, 4]} />

      {/* Intro: kicker, title, the beats covered */}
      {frame < introEnd + 4 ? (
        <AbsoluteFill style={{justifyContent: 'center', alignItems: 'center', padding: '0 8%', paddingBottom: look ? height * captionSafeBottom(look) * 0.6 : 0, opacity: 1 - introOut, transform: `scale(${1 + introOut * 0.08})`}}>
          <div style={{display: 'flex', alignItems: 'center', gap: 16 * u, fontFamily: fonts.mono, fontSize: 28 * u, letterSpacing: '0.3em', color: deep(pal), opacity: progress(frame, 0, 12), transform: `translateY(${(1 - progress(frame, 0, 16)) * 20 * u}px)`}}>
            <div style={{width: 16 * u, height: 16 * u, borderRadius: '50%', background: pal.accent, opacity: 0.55 + 0.45 * Math.abs(Math.sin(frame / 8))}} />
            {stories.length} STORIES{props.period ? ` · ${props.period.toUpperCase()}` : ''}
          </div>
          <KineticText text={props.title} start={4} stagger={4} style="pop" align="center" textStyle={{fontFamily: fonts.heavy, fontSize: titleSize, lineHeight: 1, letterSpacing: '-0.02em', textTransform: 'uppercase', color: pal.text, marginTop: 26 * u, maxWidth: width * 0.86}} />
          <div style={{width: width * 0.22 * progress(frame, 12, 24, ease.expo), height: 6 * u, background: pal.accent, borderRadius: 3 * u, marginTop: 30 * u}} />
          <div style={{display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: 14 * u, marginTop: 34 * u, maxWidth: width * 0.84}}>
            {categories.map((c, i) => (
              <Chip key={c} label={c} pal={pal} filled={i === 0} size={24 * u} p={progress(frame, 16 + i * 4, 12, ease.overshoot)} />
            ))}
          </div>
        </AbsoluteFill>
      ) : null}

      {/* Header bar: title, period and a progress segment per story */}
      <div style={{position: 'absolute', left: sideX, right: sideX, top: headerTop, height: headerH, display: 'flex', alignItems: 'center', gap: 18 * u, opacity: headerIn, transform: `translateY(${(1 - headerIn) * -30 * u}px)`}}>
        <div style={{flex: 'none', width: headerH * 0.78, height: headerH * 0.78, borderRadius: 12 * u, background: pal.accent, display: 'flex', alignItems: 'center', justifyContent: 'center'}}>
          <LineIcon name="bars" size={headerH * 0.48} color={inkOn(pal.accent)} strokeWidth={8} />
        </div>
        <div style={{minWidth: 0, flex: 'none', maxWidth: '50%'}}>
          <div style={{fontFamily: fonts.sans, fontWeight: 800, fontSize: 28 * u, lineHeight: 1.1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis'}}>{props.title}</div>
          {props.period ? <div style={{fontFamily: fonts.mono, fontSize: 18 * u, letterSpacing: '0.18em', color: pal.muted, marginTop: 4 * u}}>{props.period.toUpperCase()}</div> : null}
        </div>
        <div style={{flex: 1, display: 'flex', gap: 8 * u, alignItems: 'center', marginLeft: 12 * u}}>
          {stories.map((_, i) => (
            <div key={i} style={{flex: 1, height: 6 * u, borderRadius: 3 * u, background: i < current ? pal.accent : alpha(pal.text, 0.14), overflow: 'hidden'}}>
              {i === current ? <div style={{width: `${progress(frame, starts[i], ends[i] - starts[i], ease.cinematic) * 100}%`, height: '100%', background: pal.accent}} /> : null}
            </div>
          ))}
        </div>
        <div style={{flex: 'none', fontFamily: fonts.mono, fontSize: 24 * u, letterSpacing: '0.1em', color: pal.muted}}>
          <span style={{color: pal.text}}>{nn(Math.max(0, current))}</span> / {String(stories.length).padStart(2, '0')}
        </div>
      </div>

      {/* The deck: the current card (swapped under the stinger) */}
      {stories.map((story, i) => {
        if (frame < starts[i] || frame >= ends[i] + (i === stories.length - 1 ? Infinity : 0)) return null;
        const idx = sceneOf(i);
        return (
          <div key={i} style={{position: 'absolute', left: sideX, top: cardTop, width: cardW, height: cardH, transform: `translateY(${Math.sin((frame - starts[i]) / 30) * 3 * u}px)`}}>
            <Card story={story} index={i} total={stories.length} scene={idx >= 0 ? media.scenes[idx] : undefined} pal={pal} s={s} start={starts[i]} end={ends[i]} stacked={stacked} w={cardW} h={cardH} />
          </div>
        );
      })}

      {starts.map((at, i) => (
        <React.Fragment key={i}>
          <Stinger at={at} pal={pal} len={stingLen} />
          <LightLeak from={at - stingLen} durationInFrames={stingLen * 3} seed={i * 7 + 3} hueShift={pal.leakHue} opacity={pal.light ? 0.18 : 0.32} />
        </React.Fragment>
      ))}

      {props.showCaptions
        ? timeline.map(t => (
            <Sequence key={t.index} from={t.from} durationInFrames={t.durationInFrames}>
              <AbsoluteFill style={{justifyContent: 'flex-end', padding: portrait ? '0 7% 4.5%' : '0 16% 3.2%'}}>
                <StyledCaptions scene={t.scene} variant="box" accent={pal.accent} color={pal.text} font={fonts.sans} size={(portrait ? 50 : 44) * u} words={portrait ? 4 : 6} shadow={!pal.light} />
              </AbsoluteFill>
            </Sequence>
          ))
        : null}
      <Vignette strength={pal.light ? 0.18 : 0.5} />
      <Grain opacity={pal.light ? 0.04 : 0.06} />
      <NarrationTrack media={media} />
      <AdWeave media={media} theme={{background: pal.bg, text: pal.text, font: fonts.sans}} />
    </AbsoluteFill>
  );
};

export default defineEntry({id: 'news-roundup-cards', schema: Props, component: NewsRoundupCards});
