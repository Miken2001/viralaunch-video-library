/**
 * @viralaunch/kit/fx — the shared "premium" layer: easing, film texture, light leaks, editorial
 * HUD framing, kinetic typography, caption styles, narration-synced scene transitions,
 * floating image cards, particles and counters. Every effect is deterministic and offline.
 *
 * Everything here is plain DOM/CSS/SVG: no WebGL, so it renders fast in software Chrome
 * (`gl: "swiftshader"`), which matters on users' laptops.
 */
import React from 'react';
import {AbsoluteFill, Easing, Img, OffthreadVideo, Sequence, interpolate, random, spring, useCurrentFrame, useVideoConfig} from 'remotion';
import {activeWord, evenCaptions, sceneTimeline, type Media, type Scene, type TimedScene} from './index';
import {fonts} from './fonts';

export {fonts};

// ---------------------------------------------------------------------------------------------
// Timing
// ---------------------------------------------------------------------------------------------

/** Easing presets that read as "designed" rather than default. */
export const ease = {
  /** Fast out, soft landing — UI and kinetic type. */
  snappy: Easing.bezier(0.16, 1, 0.3, 1),
  /** Slow-in slow-out — camera moves, cinematic pushes. */
  cinematic: Easing.bezier(0.65, 0, 0.35, 1),
  /** Expo out — reveals, counters. */
  expo: Easing.bezier(0.19, 1, 0.22, 1),
  /** Small overshoot — pops and badges. */
  overshoot: Easing.bezier(0.34, 1.56, 0.64, 1),
  /** Hard acceleration — exits and whips. */
  accelerate: Easing.bezier(0.7, 0, 0.84, 0),
};

/**
 * interpolate() with clamping on both ends (the case you want 95% of the time). Tolerates
 * collapsed or inverted windows (very short scenes), which interpolate() would throw on.
 */
export function tween(frame: number, input: [number, number], output: [number, number], easing: (t: number) => number = ease.snappy) {
  const end = input[1] > input[0] ? input[1] : input[0] + 1;
  return interpolate(frame, [input[0], end], output, {extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing});
}

/** 0→1 progress of `frame` through [start, start+length] with an easing. */
export const progress = (frame: number, start: number, length: number, easing: (t: number) => number = ease.snappy) => tween(frame, [start, start + Math.max(1, length)], [0, 1], easing);

/** Deterministic pseudo-random in [min, max) for a seed. */
export const rand = (seed: string | number, min = 0, max = 1) => min + random(String(seed)) * (max - min);

// ---------------------------------------------------------------------------------------------
// Colour
// ---------------------------------------------------------------------------------------------

export type Palette = {bg: string; surface: string; text: string; muted: string; accent: string; accent2: string};

/** Hex → rgba() with alpha. */
export function alpha(hex: string, a: number) {
  const h = hex.replace('#', '');
  const n = parseInt(h.length === 3 ? h.split('').map(c => c + c).join('') : h.slice(0, 6), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
}

/** Use the brand accent when the entry asks for it (props.useBrandColor) and one is set. */
export function withBrand(palette: Palette, media: Media, use: boolean): Palette {
  return use && media.brand.accent ? {...palette, accent: media.brand.accent} : palette;
}

/** Soft multi-layer glow for text or shapes. */
export const glow = (color: string, strength = 1) => `0 0 ${8 * strength}px ${alpha(color, 0.9)}, 0 0 ${28 * strength}px ${alpha(color, 0.55)}, 0 0 ${70 * strength}px ${alpha(color, 0.3)}`;

// ---------------------------------------------------------------------------------------------
// Film texture
// ---------------------------------------------------------------------------------------------

// A 256px fractal-noise tile, rasterised once by the browser; each frame shifts it to a new
// deterministic offset so the grain "boils" like film at almost no render cost.
const NOISE_TILE = `url("data:image/svg+xml;utf8,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256"><filter id="n"><feTurbulence type="fractalNoise" baseFrequency=".85" numOctaves="3" stitchTiles="stitch"/><feColorMatrix type="saturate" values="0"/></filter><rect width="100%" height="100%" filter="url(#n)"/></svg>')}")`;

/** Animated film grain blended over everything below it. */
export const Grain: React.FC<{opacity?: number; blend?: React.CSSProperties['mixBlendMode']}> = ({opacity = 0.08, blend = 'overlay'}) => {
  const frame = useCurrentFrame();
  const x = Math.floor(rand(`gx${frame % 48}`, 0, 256));
  const y = Math.floor(rand(`gy${frame % 48}`, 0, 256));
  return <AbsoluteFill style={{pointerEvents: 'none', mixBlendMode: blend, opacity: opacity * 2.2, backgroundImage: NOISE_TILE, backgroundSize: '256px 256px', backgroundPosition: `${x}px ${y}px`}} />;
};

/** Radial vignette. */
export const Vignette: React.FC<{strength?: number; color?: string}> = ({strength = 0.6, color = '#000'}) => (
  <AbsoluteFill style={{pointerEvents: 'none', background: `radial-gradient(ellipse at center, transparent 40%, ${alpha(color, strength)} 100%)`}} />
);

/**
 * Organic light leak that blooms and retracts over `durationInFrames`, screen-blended: three
 * warm radial blooms drift across the frame with a bell-shaped intensity. Seeded, so each
 * cut gets a different leak. `hueShift` rotates the palette (0 = amber/orange).
 */
export const LightLeak: React.FC<{from: number; durationInFrames: number; seed?: number; hueShift?: number; opacity?: number}> = ({from, durationInFrames, seed = 0, hueShift = 0, opacity = 0.85}) => (
  <Sequence from={from} durationInFrames={durationInFrames} layout="none">
    <LeakLayer seed={seed} hueShift={hueShift} opacity={opacity} />
  </Sequence>
);
const LeakLayer: React.FC<{seed: number; hueShift: number; opacity: number}> = ({seed, hueShift, opacity}) => {
  const frame = useCurrentFrame();
  const {durationInFrames} = useVideoConfig();
  const t = frame / Math.max(1, durationInFrames - 1);
  const bell = Math.sin(Math.PI * Math.min(1, Math.max(0, t)));
  const blooms = [0, 1, 2].map(i => {
    const sx = rand(`lx${seed}${i}`, -20, 60);
    const sy = rand(`ly${seed}${i}`, -10, 90);
    const dx = rand(`ld${seed}${i}`, 30, 70);
    const r = rand(`lr${seed}${i}`, 35, 65);
    const hue = (rand(`lh${seed}${i}`, 15, 45) + hueShift) % 360;
    return `radial-gradient(circle at ${sx + dx * t}% ${sy + 10 * t}%, hsla(${hue}, 100%, ${55 + i * 8}%, ${0.9 - i * 0.2}) 0%, hsla(${hue + 10}, 100%, 50%, 0.35) ${r * 0.45}%, transparent ${r}%)`;
  });
  return <AbsoluteFill style={{mixBlendMode: 'screen', opacity: opacity * bell, pointerEvents: 'none', background: blooms.join(', ')}} />;
};

/** A soft spotlight that sweeps across the frame (product reveals, title cards). */
export const Spotlight: React.FC<{color?: string; from?: number; length?: number; size?: number}> = ({color = '#ffffff', from = 0, length = 60, size = 0.6}) => {
  const frame = useCurrentFrame();
  const x = tween(frame, [from, from + length], [-20, 120], ease.cinematic);
  return <AbsoluteFill style={{pointerEvents: 'none', mixBlendMode: 'screen', background: `radial-gradient(circle at ${x}% 40%, ${alpha(color, 0.35)} 0%, transparent ${size * 60}%)`}} />;
};

// ---------------------------------------------------------------------------------------------
// Editorial HUD framing
// ---------------------------------------------------------------------------------------------

/**
 * Corner brackets + micro-typography (labels, timecode, progress bar) — the "designed by a
 * studio" frame seen in high-end motion work. Labels are short uppercase strings.
 */
export const HudFrame: React.FC<{
  color?: string;
  topLeft?: string;
  topRight?: string;
  bottomLeft?: string;
  bottomRight?: string;
  timecode?: boolean;
  progressBar?: boolean;
  inset?: number;
}> = ({color = '#ffffff', topLeft = '', topRight = '', bottomLeft = '', bottomRight = '', timecode = true, progressBar = true, inset = 0.035}) => {
  const frame = useCurrentFrame();
  const {fps, width, height, durationInFrames} = useVideoConfig();
  const pad = Math.round(Math.min(width, height) * inset);
  const arm = Math.round(Math.min(width, height) * 0.04);
  const appear = progress(frame, 0, 18);
  const label: React.CSSProperties = {position: 'absolute', fontFamily: fonts.mono, fontSize: Math.max(14, Math.round(Math.min(width, height) * 0.016)), letterSpacing: '0.18em', textTransform: 'uppercase', color, opacity: 0.75 * appear};
  const s = Math.floor(frame / fps);
  const tc = `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}:${String(frame % fps).padStart(2, '0')}`;
  const corner = (x: 'left' | 'right', y: 'top' | 'bottom') => (
    <div key={x + y} style={{position: 'absolute', [x]: pad, [y]: pad, width: arm * appear, height: arm * appear, borderColor: color, borderStyle: 'solid', borderWidth: 0, [`border${y === 'top' ? 'Top' : 'Bottom'}Width`]: 2, [`border${x === 'left' ? 'Left' : 'Right'}Width`]: 2, opacity: 0.8} as React.CSSProperties} />
  );
  return (
    <AbsoluteFill style={{pointerEvents: 'none'}}>
      {corner('left', 'top')}
      {corner('right', 'top')}
      {corner('left', 'bottom')}
      {corner('right', 'bottom')}
      {topLeft ? <div style={{...label, left: pad + arm * 0.6, top: pad + arm * 0.35}}>{topLeft}</div> : null}
      {topRight ? <div style={{...label, right: pad + arm * 0.6, top: pad + arm * 0.35}}>{topRight}</div> : null}
      <div style={{...label, left: pad + arm * 0.6, bottom: pad + arm * 0.35}}>{bottomLeft || (timecode ? tc : '')}</div>
      {bottomRight ? <div style={{...label, right: pad + arm * 0.6, bottom: pad + arm * 0.35}}>{bottomRight}</div> : null}
      {progressBar ? (
        <div style={{position: 'absolute', left: pad + arm * 3.5, right: pad + arm * 3.5, bottom: pad + arm * 0.55, height: 2, background: alpha(color, 0.2), opacity: appear}}>
          <div style={{width: `${(frame / Math.max(1, durationInFrames - 1)) * 100}%`, height: '100%', background: color}} />
        </div>
      ) : null}
    </AbsoluteFill>
  );
};

// ---------------------------------------------------------------------------------------------
// Kinetic typography
// ---------------------------------------------------------------------------------------------

export type RevealStyle = 'rise' | 'blur' | 'pop' | 'type' | 'slide';

/**
 * Reveals text word by word (or char by char for `type`). `rise` = masked slide-up (the
 * classic premium title reveal), `blur` = blur-to-sharp, `pop` = spring scale, `slide` = from left.
 * Words wrapped in *asterisks* render in `accent`.
 */
export const KineticText: React.FC<{
  text: string;
  start?: number;
  stagger?: number;
  duration?: number;
  style?: RevealStyle;
  accent?: string;
  textStyle?: React.CSSProperties;
  align?: 'left' | 'center' | 'right';
}> = ({text, start = 0, stagger = 3, duration = 18, style = 'rise', accent, textStyle, align = 'left'}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const words = text.split(/\s+/).filter(Boolean).map(raw => ({w: raw.replace(/\*/g, ''), hot: /\*/.test(raw)}));
  if (style === 'type') {
    const plain = words.map(w => w.w).join(' ');
    const shown = Math.floor(Math.max(0, frame - start) / Math.max(1, stagger / 2));
    return (
      <div style={{textAlign: align, ...textStyle}}>
        {plain.slice(0, shown)}
        <span style={{opacity: Math.floor(frame / (fps / 2)) % 2 ? 0 : 1}}>▍</span>
      </div>
    );
  }
  return (
    <div style={{display: 'flex', flexWrap: 'wrap', justifyContent: align === 'center' ? 'center' : align === 'right' ? 'flex-end' : 'flex-start', columnGap: '0.28em', ...textStyle}}>
      {words.map(({w, hot}, i) => {
        const t0 = start + i * stagger;
        const p = style === 'pop' ? spring({frame: frame - t0, fps, config: {damping: 12, stiffness: 200, mass: 0.6}}) : progress(frame, t0, duration, ease.expo);
        const color = hot && accent ? accent : undefined;
        const inner: React.CSSProperties =
          style === 'rise' ? {transform: `translateY(${(1 - p) * 110}%)`} :
          style === 'blur' ? {filter: `blur(${(1 - p) * 18}px)`, opacity: p, transform: `scale(${1.15 - p * 0.15})`} :
          style === 'pop' ? {transform: `scale(${p})`, opacity: Math.min(1, p * 2)} :
          {transform: `translateX(${(1 - p) * -40}px)`, opacity: p};
        return (
          <span key={i} style={{display: 'inline-block', overflow: style === 'rise' ? 'hidden' : 'visible', paddingBottom: style === 'rise' ? '0.08em' : 0, verticalAlign: 'top'}}>
            <span style={{display: 'inline-block', color, fontStyle: hot ? 'italic' : undefined, ...inner}}>{w}</span>
          </span>
        );
      })}
    </div>
  );
};

/** Counts from `from` to `to` over [start, start+duration], formatted with fixed decimals. */
export function countUp(frame: number, to: number, start = 0, duration = 40, decimals = 0, from = 0) {
  const v = tween(frame, [start, start + duration], [from, to], ease.expo);
  return v.toLocaleString('en-US', {minimumFractionDigits: decimals, maximumFractionDigits: decimals});
}

// ---------------------------------------------------------------------------------------------
// Captions
// ---------------------------------------------------------------------------------------------

export type CaptionStyle = 'pop' | 'box' | 'karaoke' | 'minimal';

/**
 * Word-synced captions with designed styles. Place inside the scene's <Sequence>.
 * `pop` = active word scales up in accent, `box` = accent box behind the active word,
 * `karaoke` = words fill as they are spoken, `minimal` = clean lower line.
 */
export const StyledCaptions: React.FC<{
  scene: Scene;
  variant?: CaptionStyle;
  accent?: string;
  color?: string;
  font?: string;
  size?: number;
  words?: number;
  uppercase?: boolean;
  weight?: number;
  align?: 'left' | 'center';
  /** Drop shadow for legibility over imagery; turn off on flat light backgrounds. */
  shadow?: boolean;
}> = ({scene, variant = 'pop', accent = '#FFD60A', color = '#ffffff', font = fonts.sans, size = 64, words = 4, uppercase = false, weight = 900, align = 'center', shadow: withShadow = true}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const captions = scene.captions.length ? scene.captions : evenCaptions(scene.text, scene.audio.duration * 1000);
  const ms = (frame / fps) * 1000;
  const current = Math.max(0, activeWord(captions, ms));
  const start = Math.floor(current / words) * words;
  const chunk = captions.slice(start, start + words);
  const chunkIn = progress(frame, ((captions[start]?.startMs ?? 0) / 1000) * fps, 6, ease.overshoot);
  return (
    <div style={{display: 'flex', flexWrap: 'wrap', justifyContent: align === 'left' ? 'flex-start' : 'center', gap: '0.12em 0.45em', fontFamily: font, fontWeight: weight, fontSize: size, lineHeight: 1.12, textTransform: uppercase ? 'uppercase' : 'none', transform: `scale(${0.9 + 0.1 * chunkIn})`, opacity: chunkIn}}>
      {chunk.map((c, i) => {
        const idx = start + i;
        const active = idx === current;
        const spoken = idx < current || (active && ms >= c.startMs);
        const shadow = withShadow ? '0 4px 24px rgba(0,0,0,.55), 0 2px 4px rgba(0,0,0,.6)' : 'none';
        if (variant === 'box') {
          return (
            <span key={idx} style={{position: 'relative', color: active ? '#000' : color, textShadow: active ? 'none' : shadow, padding: '0 0.12em'}}>
              {active ? <span style={{position: 'absolute', inset: '-0.04em -0.06em', background: accent, borderRadius: '0.16em', zIndex: -1, transform: `rotate(${rand(idx, -2.5, 2.5)}deg)`}} /> : null}
              {c.text.trim()}
            </span>
          );
        }
        if (variant === 'karaoke') {
          const fill = active ? Math.min(1, (ms - c.startMs) / Math.max(1, c.endMs - c.startMs)) : spoken ? 1 : 0;
          return (
            <span key={idx} style={{backgroundImage: `linear-gradient(90deg, ${accent} ${fill * 100}%, ${color} ${fill * 100}%)`, WebkitBackgroundClip: 'text', backgroundClip: 'text', color: 'transparent', filter: 'drop-shadow(0 4px 14px rgba(0,0,0,.5))'}}>
              {c.text.trim()}
            </span>
          );
        }
        if (variant === 'minimal') {
          return <span key={idx} style={{color, opacity: spoken ? 1 : 0.45, fontWeight: 600, textShadow: shadow}}>{c.text.trim()}</span>;
        }
        const s = active ? 1 + 0.06 * progress(frame, (c.startMs / 1000) * fps, 5, ease.overshoot) : 1;
        return <span key={idx} style={{display: 'inline-block', color: active ? accent : color, transform: `scale(${s})`, textShadow: shadow}}>{c.text.trim()}</span>;
      })}
    </div>
  );
};

// ---------------------------------------------------------------------------------------------
// Scene transitions synced to narration
// ---------------------------------------------------------------------------------------------

export type TransitionKind = 'whip' | 'zoom' | 'slide-up' | 'wipe' | 'blur' | 'iris' | 'flash' | 'cut';
export type ScenePhase = {enter: number; exit: number; index: number; timed: TimedScene};

/**
 * Renders one layer per narration scene. Each scene starts `overlap/2` frames early and ends
 * `overlap/2` late so consecutive scenes overlap and transition into each other, while every
 * scene's centre stays locked to its narration. `renderScene` gets enter/exit progress.
 */
export const SceneSeries: React.FC<{
  media: Media;
  renderScene: (phase: ScenePhase) => React.ReactNode;
  transition?: TransitionKind | ((index: number) => TransitionKind);
  overlap?: number;
}> = ({media, renderScene, transition = 'zoom', overlap = 14}) => {
  const {fps, durationInFrames} = useVideoConfig();
  const timeline = sceneTimeline(media.scenes, fps);
  const half = Math.floor(overlap / 2);
  return (
    <>
      {timeline.map((t, i) => {
        const from = i === 0 ? 0 : t.from - half;
        const end = i === timeline.length - 1 ? durationInFrames : t.from + t.durationInFrames + half;
        const kind = typeof transition === 'function' ? transition(i) : transition;
        return (
          <Sequence key={i} from={from} durationInFrames={Math.max(1, end - from)}>
            <TransitionLayer kind={kind} enterLen={i === 0 ? 0 : overlap} exitLen={i === timeline.length - 1 ? 0 : overlap} index={i}>
              {(enter, exit) => renderScene({enter, exit, index: i, timed: t})}
            </TransitionLayer>
          </Sequence>
        );
      })}
    </>
  );
};

const TransitionLayer: React.FC<{kind: TransitionKind; enterLen: number; exitLen: number; index: number; children: (enter: number, exit: number) => React.ReactNode}> = ({kind, enterLen, exitLen, index, children}) => {
  const frame = useCurrentFrame();
  const {durationInFrames} = useVideoConfig();
  const enter = enterLen ? progress(frame, 0, enterLen, ease.cinematic) : 1;
  const exit = exitLen ? progress(frame, durationInFrames - exitLen, exitLen, ease.cinematic) : 0;
  const dir = index % 2 ? -1 : 1;
  let style: React.CSSProperties = {};
  switch (kind) {
    case 'whip':
      style = {transform: `translateX(${(1 - enter) * 100 * dir - exit * 100 * dir}%)`, filter: `blur(${(1 - enter + exit) * 24}px)`};
      break;
    case 'zoom':
      style = {transform: `scale(${0.82 + 0.18 * enter + exit * 0.5})`, opacity: Math.min(enter, 1 - exit), filter: `blur(${(1 - enter) * 12 + exit * 16}px)`};
      break;
    case 'slide-up':
      style = {transform: `translateY(${(1 - enter) * 100 - exit * 30}%)`, opacity: 1 - exit * 0.6};
      break;
    case 'wipe':
      style = {clipPath: `inset(0 ${(1 - enter) * 100}% 0 0)`};
      break;
    case 'blur':
      style = {opacity: Math.min(enter, 1 - exit), filter: `blur(${(1 - enter + exit) * 20}px)`};
      break;
    case 'iris':
      style = {clipPath: `circle(${enter * 150}% at 50% 50%)`};
      break;
    case 'flash':
      style = {opacity: enter < 1 ? (enter > 0.5 ? 1 : 0) : 1 - (exit > 0.5 ? 1 : 0)};
      break;
    default:
      style = {opacity: enter >= 1 && exit < 1 ? 1 : enter > 0.5 && exit < 0.5 ? 1 : 0};
  }
  return (
    <AbsoluteFill style={style}>
      {children(enter, exit)}
      {kind === 'flash' && (enter < 1 || exit > 0) ? <AbsoluteFill style={{background: '#fff', opacity: Math.max(1 - Math.abs(enter - 0.5) * 2, 1 - Math.abs(exit - 0.5) * 2) * (enter < 1 ? 1 : 0)}} /> : null}
    </AbsoluteFill>
  );
};

// ---------------------------------------------------------------------------------------------
// Imagery
// ---------------------------------------------------------------------------------------------

export type CameraMove = 'push' | 'pull' | 'pan-left' | 'pan-right' | 'rise' | 'still';

/** Full-bleed image/video with a designed camera move over the layer's duration. */
export const CameraImage: React.FC<{src: string; isStatic?: boolean; move?: CameraMove; style?: React.CSSProperties; strength?: number}> = ({src, isStatic = true, move = 'push', style, strength = 1}) => {
  const frame = useCurrentFrame();
  const {durationInFrames} = useVideoConfig();
  const t = tween(frame, [0, durationInFrames], [0, 1], ease.cinematic);
  const k = 0.12 * strength;
  const transform =
    move === 'push' ? `scale(${1.05 + k * t})` :
    move === 'pull' ? `scale(${1.05 + k - k * t})` :
    move === 'pan-left' ? `scale(${1.08 + k / 2}) translateX(${(0.5 - t) * 6 * strength}%)` :
    move === 'pan-right' ? `scale(${1.08 + k / 2}) translateX(${(t - 0.5) * 6 * strength}%)` :
    move === 'rise' ? `scale(${1.1 + k / 2}) translateY(${(0.5 - t) * 5 * strength}%)` :
    'scale(1.02)';
  const css: React.CSSProperties = {width: '100%', height: '100%', objectFit: 'cover', transform, ...style};
  if (!src) return null;
  return isStatic ? <Img src={src} style={css} /> : <OffthreadVideo src={src} muted style={css} />;
};

/**
 * The "floating card over its own blurred backdrop" look: the image fills the frame blurred
 * and darkened, and a sharp rounded copy floats on top with depth shadow and slow drift.
 * Works for any aspect ratio of source image.
 */
export const FloatingImage: React.FC<{src: string; isStatic?: boolean; radius?: number; cardScale?: number; tilt?: number; backdropDim?: number}> = ({src, isStatic = true, radius = 28, cardScale = 0.78, tilt = 0, backdropDim = 0.45}) => {
  const frame = useCurrentFrame();
  const {durationInFrames, fps} = useVideoConfig();
  const t = tween(frame, [0, durationInFrames], [0, 1], ease.cinematic);
  const lift = spring({frame, fps, config: {damping: 18, stiffness: 90}});
  if (!src) return null;
  return (
    <AbsoluteFill>
      <AbsoluteFill style={{filter: `blur(40px) brightness(${1 - backdropDim})`, transform: 'scale(1.25)'}}>
        <CameraImage src={src} isStatic={isStatic} move="still" />
      </AbsoluteFill>
      <AbsoluteFill style={{justifyContent: 'center', alignItems: 'center', perspective: 1600}}>
        <div style={{width: `${cardScale * 100}%`, height: `${cardScale * 100}%`, borderRadius: radius, overflow: 'hidden', boxShadow: '0 60px 120px rgba(0,0,0,.55), 0 10px 30px rgba(0,0,0,.35)', transform: `translateY(${(1 - lift) * 80}px) rotateX(${tilt * (1 - t)}deg) rotateY(${tilt * (t - 0.5)}deg) scale(${0.96 + 0.06 * t})`}}>
          <CameraImage src={src} isStatic={isStatic} move="push" strength={0.6} />
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

/** Floating dust / bokeh particles drifting upward. */
export const Particles: React.FC<{count?: number; color?: string; seed?: string; size?: [number, number]; speed?: number; blur?: boolean; opacity?: number}> = ({count = 40, color = '#ffffff', seed = 'p', size = [2, 6], speed = 1, blur = false, opacity = 0.6}) => {
  const frame = useCurrentFrame();
  const {width, height} = useVideoConfig();
  return (
    <AbsoluteFill style={{pointerEvents: 'none'}}>
      {Array.from({length: count}, (_, i) => {
        const s = rand(`${seed}s${i}`, size[0], size[1]);
        const x = rand(`${seed}x${i}`) * width + Math.sin(frame / 40 + i) * 12;
        const y = (((rand(`${seed}y${i}`) * height - frame * speed * (0.4 + rand(`${seed}v${i}`))) % height) + height) % height;
        return <div key={i} style={{position: 'absolute', left: x, top: y, width: s, height: s, borderRadius: '50%', background: color, opacity: opacity * (0.3 + 0.7 * rand(`${seed}o${i}`)), filter: blur ? `blur(${s / 2}px)` : undefined}} />;
      })}
    </AbsoluteFill>
  );
};

/** Animated mesh-like gradient background (soft colour blobs drifting slowly). */
export const MeshGradient: React.FC<{colors: string[]; base: string; speed?: number}> = ({colors, base, speed = 1}) => {
  const frame = useCurrentFrame();
  return (
    <AbsoluteFill style={{background: base, overflow: 'hidden'}}>
      {colors.map((c, i) => {
        const x = 50 + Math.sin(frame / (90 / speed) + i * 2.1) * 30;
        const y = 50 + Math.cos(frame / (110 / speed) + i * 1.3) * 30;
        return <AbsoluteFill key={i} style={{background: `radial-gradient(circle at ${x}% ${y}%, ${c} 0%, transparent 55%)`, opacity: 0.85, mixBlendMode: 'normal'}} />;
      })}
    </AbsoluteFill>
  );
};

/**
 * Hairline grid or dot grid. Drawn as an SVG <pattern> rather than a repeating CSS gradient:
 * repeating CSS backgrounds under transformed parents trigger tiling artifacts in Chrome.
 */
export const GridLines: React.FC<{color?: string; step?: number; opacity?: number; drift?: number; dots?: boolean}> = ({color = '#ffffff', step = 80, opacity = 0.06, drift = 0.3, dots = false}) => {
  const frame = useCurrentFrame();
  const {width, height} = useVideoConfig();
  const o = (frame * drift) % step;
  const id = `grid-${step}-${dots ? 'd' : 'l'}`;
  return (
    <svg width={width} height={height} style={{position: 'absolute', inset: 0, opacity, pointerEvents: 'none'}}>
      <defs>
        <pattern id={id} width={step} height={step} patternUnits="userSpaceOnUse" x={o} y={o}>
          {dots ? <circle cx={step / 2} cy={step / 2} r={Math.max(1.5, step / 18)} fill={color} /> : <path d={`M${step} 0 L0 0 0 ${step}`} fill="none" stroke={color} strokeWidth={1} />}
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill={`url(#${id})`} />
    </svg>
  );
};

/** True when the composition is portrait. */
export function usePortrait() {
  const {width, height} = useVideoConfig();
  return height >= width;
}

/** Scale a design value authored for a 1080-wide portrait frame to the current frame. */
export function useUnit() {
  const {width, height} = useVideoConfig();
  return Math.min(width, height) / 1080;
}

export {LineIcon, iconNames, type IconName} from './icons';

/** Widens an `as const` palette to plain strings, so entries can override a colour (e.g. media.accent). */
export type Widen<T> = {[K in keyof T]: T[K] extends string ? string : T[K] extends readonly string[] ? readonly string[] : T[K]};
