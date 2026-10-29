import React from 'react';
import {AbsoluteFill, Sequence, useCurrentFrame, useVideoConfig} from 'remotion';
import {AdWeave, NarrationTrack, captionSafeBottom, defineEntry, mix, useContentFrames, useLook, useSceneTimeline, type ActiveLook, type EntryProps} from '@viralaunch/kit';
import {Grain, KineticText, LightLeak, LineIcon, Particles, StyledCaptions, Vignette, alpha, ease, fonts, glow, progress, rand, tween} from '@viralaunch/kit/fx';
import {Props, type Milestone} from './schema';

type Pal = {
  light: boolean;
  /** Sky top and horizon. */
  sky: [string, string];
  far: string;
  mid: string;
  ground: string;
  near: string;
  /** Paper of the medallions, tags and the traveller's cloak. */
  surface: string;
  /** Ink drawn on paper. */
  ink: string;
  text: string;
  muted: string;
  accent: string;
  line: string;
  dawn: string;
};

const PALETTES: Record<Props['palette'], Pal> = {
  night: {light: false, sky: ['#090e2a', '#22305e'], far: '#253461', mid: '#2b4562', ground: '#33555a', near: '#223f44', surface: '#efe6d0', ink: '#1a2147', text: '#fbf3e2', muted: '#aab4cc', accent: '#ffc65c', line: '#f6ecd6', dawn: '#ff9a5c'},
  dusk: {light: false, sky: ['#1a0e2c', '#5d3163'], far: '#4b2d5f', mid: '#5c3a60', ground: '#6a4a5c', near: '#463044', surface: '#f6e1cd', ink: '#2e1838', text: '#fff1e6', muted: '#d6b8c8', accent: '#ffb35c', line: '#fde9d6', dawn: '#ff7a59'},
  paper: {light: true, sky: ['#f6eedd', '#eadcc0'], far: '#ddd6bf', mid: '#cdd0b3', ground: '#b9c5a2', near: '#a5b48f', surface: '#fffaf0', ink: '#2a2520', text: '#26221d', muted: '#7a7163', accent: '#e4683a', line: '#2a2520', dawn: '#f2b05e'},
};

/** The storybook world in a sequence's shared look: sky, hills, paper and glow from the look. */
const fromLook = (l: ActiveLook): Pal => {
  const p = l.palette;
  const light = l.tone === 'light';
  const hill = (t: number) => mix(mix(p.bg2, p.line, t), p.accent, 0.06);
  return {
    light,
    sky: [p.bg, p.bg2],
    far: hill(0.1),
    mid: hill(0.17),
    ground: hill(0.25),
    near: mix(hill(0.25), p.bg, 0.35),
    surface: light ? p.surface : mix(p.surface, p.line, 0.88),
    ink: light ? p.text : p.bg,
    text: p.text,
    muted: p.muted,
    accent: p.accent,
    line: p.line,
    dawn: mix(p.accent, p.bg2, 0.25),
  };
};

/** Seeded soft ridge across [0, w], closed down to `bottom`. */
function ridge(seed: string, w: number, base: number, amp: number, step: number, bottom: number) {
  const steps = Math.max(2, Math.ceil(w / step));
  const ys = Array.from({length: steps + 1}, (_, i) => base - amp * (0.6 * rand(`${seed}${i}`) + 0.4 * rand(`${seed}o${Math.floor(i / 3)}`)));
  let d = `M0,${bottom} L0,${ys[0]}`;
  for (let i = 1; i <= steps; i++) {
    const x0 = ((i - 1) / steps) * w;
    const x1 = (i / steps) * w;
    d += ` Q${x0},${ys[i - 1]} ${(x0 + x1) / 2},${(ys[i - 1] + ys[i]) / 2}`;
  }
  return `${d} L${w},${ys[steps]} L${w},${bottom} Z`;
}

/** A hand-drawn, slightly uneven circle (for the doodle ring around each milestone). */
function wobblyCircle(seed: string, cx: number, cy: number, r: number) {
  const pts = Array.from({length: 13}, (_, k) => {
    const a = (k / 12) * Math.PI * 2 + 0.3;
    const rr = r * (1 + rand(`${seed}${k % 12}`, -0.05, 0.05));
    return [cx + Math.cos(a) * rr, cy + Math.sin(a) * rr];
  });
  let d = `M${(pts[0][0] + pts[1][0]) / 2},${(pts[0][1] + pts[1][1]) / 2}`;
  for (let k = 1; k <= 12; k++) {
    const [x, y] = pts[k];
    const [nx, ny] = pts[k === 12 ? 1 : k + 1];
    d += ` Q${x},${y} ${(x + nx) / 2},${(y + ny) / 2}`;
  }
  return d;
}

/** Lollipop tree doodle that sways a little. */
const Tree: React.FC<{x: number; base: number; h: number; color: string; trunk: string; seed: string}> = ({x, base, h, color, trunk, seed}) => {
  const frame = useCurrentFrame();
  const sway = Math.sin(frame / 28 + rand(seed, 0, 6)) * h * 0.02;
  const r = h * 0.3;
  return (
    <g>
      <path d={`M${x},${base} Q${x + sway * 0.5},${base - h * 0.5} ${x + sway},${base - h + r}`} stroke={trunk} strokeWidth={Math.max(2, h * 0.035)} strokeLinecap="round" fill="none" />
      <ellipse cx={x + sway} cy={base - h + r * 0.85} rx={r * 0.92} ry={r} fill={color} />
    </g>
  );
};

/** The doodle traveller carrying a lantern. `walk` 0..1 drives the stride, `phase` the step cycle. */
const Traveller: React.FC<{x: number; feet: number; h: number; walk: number; phase: number; pal: Pal}> = ({x, feet, h, walk, phase, pal}) => {
  const frame = useCurrentFrame();
  const s = h / 160;
  const leg = Math.sin(phase) * 12 * walk;
  const bob = -Math.abs(Math.sin(phase)) * 5 * walk + Math.sin(frame / 14) * 1.2 * (1 - walk);
  const swing = Math.sin(frame / 11) * 6 + Math.sin(phase) * 10 * walk;
  const flicker = 0.85 + 0.15 * Math.sin(frame / 3.3) * Math.sin(frame / 7.1);
  const outline = pal.light ? pal.line : 'none';
  const lx = 78;
  const ly = 96;
  return (
    <div style={{position: 'absolute', left: x - 50 * s, top: feet - 160 * s, width: 100 * s, height: 160 * s}}>
      <div style={{position: 'absolute', left: (lx - 120) * s, top: (ly - 120) * s, width: 240 * s, height: 240 * s, borderRadius: '50%', background: `radial-gradient(circle, ${alpha(pal.accent, (pal.light ? 0.3 : 0.5) * flicker)} 0%, ${alpha(pal.accent, 0.12 * flicker)} 35%, transparent 70%)`}} />
      <svg width={100 * s} height={160 * s} viewBox="0 0 100 160" style={{overflow: 'visible'}}>
        <g transform={`translate(0 ${bob})`}>
          <path d={`M43 104 L${43 + leg} 152`} stroke={pal.line} strokeWidth={4.5} strokeLinecap="round" />
          <path d={`M57 104 L${57 - leg} 152`} stroke={pal.line} strokeWidth={4.5} strokeLinecap="round" />
          <path d="M40 42 Q50 36 60 42 L70 106 Q50 112 30 106 Z" fill={pal.surface} stroke={outline} strokeWidth={3} strokeLinejoin="round" />
          <path d="M42 52 Q32 70 30 84" stroke={pal.line} strokeWidth={4} strokeLinecap="round" fill="none" />
          <path d="M58 52 L74 76" stroke={pal.line} strokeWidth={4} strokeLinecap="round" />
          <circle cx={50} cy={24} r={15} fill={pal.surface} stroke={outline} strokeWidth={3} />
          <circle cx={55} cy={22} r={1.8} fill={pal.ink} />
          <circle cx={45} cy={22} r={1.8} fill={pal.ink} />
          <g transform={`rotate(${swing} 74 76)`}>
            <path d="M74 76 L76 86" stroke={pal.line} strokeWidth={2.5} />
            <rect x={lx - 7} y={ly - 10} width={14} height={18} rx={4} fill={pal.accent} opacity={flicker} stroke={outline} strokeWidth={2} />
          </g>
        </g>
      </svg>
    </div>
  );
};

/** Light rays turning behind a milestone (finale). */
const Rays: React.FC<{cy: number; size: number; amount: number; color: string; u: number}> = ({cy, size, amount, color, u}) => {
  const frame = useCurrentFrame();
  if (amount <= 0) return null;
  const box = size * 3.4;
  const c = box / 2;
  return (
    <svg width={box} height={box} style={{position: 'absolute', left: -c, top: cy - c, overflow: 'visible', opacity: amount * 0.85}}>
      {Array.from({length: 16}, (_, k) => {
        const a = ((k / 16) * 360 + frame * 0.35) * (Math.PI / 180);
        const r0 = size * 0.66;
        const r1 = size * (0.95 + 0.45 * (k % 2)) * amount;
        return <line key={k} x1={c + Math.cos(a) * r0} y1={c + Math.sin(a) * r0} x2={c + Math.cos(a) * Math.max(r0, r1)} y2={c + Math.sin(a) * Math.max(r0, r1)} stroke={color} strokeWidth={6 * u} strokeLinecap="round" />;
      })}
    </svg>
  );
};

const EGG = 'M100 10 C150 10 186 112 186 166 C186 222 146 252 100 252 C54 252 14 222 14 166 C14 112 50 10 100 10 Z';
const ZIG = '14,142 40,126 62,152 82,128 102,154 122,126 142,150 162,128 186,142';

/** One milestone on the ground: a doodle medallion on a post, a year tag, a glow. */
const Station: React.FC<{m: Milestone; i: number; x: number; horizon: number; size: number; u: number; pal: Pal; grownAt: number; active: boolean; finale: Props['finale'] | null; k: number; ghost: number}> = ({m, i, x, horizon, size, u, pal, grownAt, active, finale, k, ghost}) => {
  const frame = useCurrentFrame();
  const L = frame - grownAt;
  const postH = size * 0.32;
  const cy = horizon - postH - size / 2;
  const T = (t: number) => t * k;
  const rise = progress(L, 0, 18, ease.snappy);
  const hatch = finale === 'hatch';
  const pop = hatch ? progress(L, T(48), 20, ease.overshoot) : progress(L, 0, 22, ease.overshoot);
  const draw = hatch ? tween(L, [T(54), T(86)], [0, 1], ease.cinematic) : tween(L, [8, 44], [0, 1], ease.cinematic);
  const ring = hatch ? tween(L, [T(50), T(74)], [0, 1], ease.cinematic) : tween(L, [4, 30], [0, 1], ease.cinematic);
  const tilt = rand(`tilt${i}`, -5, 5) + Math.sin(frame / 34 + i) * 1.4;
  const rays = finale === 'hatch' ? progress(L, T(46), 26, ease.expo) : finale === 'glow' ? progress(L, 10, 30, ease.expo) : 0;
  const glowSize = finale ? size * (2 + 1.4 * rays) : size * 2;
  const glowA = (active ? 0.5 : 0.2) * Math.min(1, Math.max(0, pop)) * (pal.light ? 0.7 : 1) + rays * 0.25;
  const ringBox = size * 1.26;
  return (
    <div style={{position: 'absolute', left: x, top: 0, width: 0, height: 0}}>
      {L < 0 ? (
        <svg width={size} height={size} style={{position: 'absolute', left: -size / 2, top: cy - size / 2, overflow: 'visible', opacity: 0.55 * ghost}}>
          <circle cx={size / 2} cy={size / 2} r={size * 0.36} fill="none" stroke={alpha(pal.line, 0.5)} strokeWidth={3 * u} strokeDasharray={`${6 * u} ${12 * u}`} strokeLinecap="round" />
        </svg>
      ) : null}
      <div style={{position: 'absolute', left: -glowSize / 2, top: cy - glowSize / 2, width: glowSize, height: glowSize, borderRadius: '50%', background: `radial-gradient(circle, ${alpha(pal.accent, Math.min(0.85, glowA))} 0%, ${alpha(pal.accent, glowA * 0.3)} 35%, transparent 68%)`}} />
      <Rays cy={cy} size={size} amount={rays} color={alpha(pal.accent, pal.light ? 0.75 : 0.55)} u={u} />
      <svg width={size} height={size * 0.3} style={{position: 'absolute', left: -size / 2, top: horizon - size * 0.08, overflow: 'visible'}}>
        <ellipse cx={size / 2} cy={size * 0.08} rx={size * 0.42 * Math.max(0.3, rise)} ry={size * 0.07} fill={alpha(pal.near, 0.9)} />
      </svg>
      <div style={{position: 'absolute', left: -2.5 * u, top: horizon - postH * rise, width: 5 * u, height: postH * rise, borderRadius: 3 * u, background: pal.line, opacity: 0.85}} />
      {m.year ? (
        <div style={{position: 'absolute', left: 8 * u, top: horizon - postH * 0.62, transform: `rotate(-6deg) scale(${progress(L, hatch ? T(60) : 14, 12, ease.overshoot)})`, transformOrigin: 'left center', background: pal.surface, color: pal.ink, fontFamily: fonts.hand, fontWeight: 700, fontSize: size * 0.12, lineHeight: 1, padding: `${size * 0.012}px ${size * 0.04}px`, borderRadius: size * 0.02, whiteSpace: 'nowrap', boxShadow: `0 ${4 * u}px ${10 * u}px ${alpha('#000', pal.light ? 0.12 : 0.3)}`}}>
          {m.year}
        </div>
      ) : null}
      {L >= 0 ? (
        <div style={{position: 'absolute', left: -size / 2, top: cy - size / 2, width: size, height: size, transform: `translateY(${(1 - rise) * size * 0.4}px) scale(${Math.max(0, pop)}) rotate(${tilt}deg)`}}>
          <div style={{position: 'absolute', inset: 0, borderRadius: '50%', background: pal.surface, boxShadow: `0 ${16 * u}px ${36 * u}px ${alpha('#000', pal.light ? 0.16 : 0.42)}, inset 0 ${-8 * u}px 0 ${alpha(pal.ink, 0.06)}`}} />
          <div style={{position: 'absolute', inset: 0, display: 'flex', justifyContent: 'center', alignItems: 'center'}}>
            <LineIcon name={m.icon} progress={draw} size={size * 0.56} color={pal.ink} strokeWidth={4.6} />
          </div>
          <svg width={ringBox} height={ringBox} style={{position: 'absolute', left: (size - ringBox) / 2, top: (size - ringBox) / 2, overflow: 'visible'}}>
            <path d={wobblyCircle(`ring${i}`, ringBox / 2, ringBox / 2, size * 0.58)} fill="none" stroke={pal.accent} strokeWidth={4.5 * u} strokeLinecap="round" pathLength={1} strokeDasharray={1} strokeDashoffset={1 - ring} />
          </svg>
        </div>
      ) : null}
      {hatch && L >= 0 ? <Egg L={L} T={T} cy={cy} size={size} u={u} pal={pal} /> : null}
    </div>
  );
};

/** Finale: the egg rises, wobbles, cracks and splits open over the milestone. */
const Egg: React.FC<{L: number; T: (t: number) => number; cy: number; size: number; u: number; pal: Pal}> = ({L, T, cy, size, u, pal}) => {
  const rise = progress(L, 0, 18, ease.overshoot);
  const shake = Math.min(1, Math.max(0, (L - T(14)) / Math.max(1, T(26)))) * (L < T(46) ? 1 : 0);
  const wobble = Math.sin(L * 0.95) * 8 * shake;
  const crack = tween(L, [T(28), T(46)], [0, 1], ease.snappy);
  const open = progress(L, T(46), 22, ease.expo);
  const topOut = 1 - progress(L, T(58), 14);
  const bottomOut = 1 - progress(L, T(54), 16);
  const flash = tween(L, [T(44), T(52)], [0, 1]) * (1 - tween(L, [T(52), T(84)], [0, 1], ease.cinematic));
  const w = size * 0.82;
  const h = w * 1.3;
  const id = `egg-${Math.round(size)}`;
  const egg = (clip: string) => (
    <g clipPath={`url(#${clip})`}>
      <path d={EGG} fill={pal.surface} stroke={pal.line} strokeWidth={pal.light ? 5 : 0} />
      <path d="M60 70 C66 52 78 40 90 36" stroke={alpha(pal.ink, 0.18)} strokeWidth={6} strokeLinecap="round" fill="none" />
      {[0, 1, 2, 3, 4].map(s => <circle key={s} cx={50 + s * 26} cy={200 - (s % 2) * 26} r={6} fill={alpha(pal.accent, 0.55)} />)}
    </g>
  );
  return (
    <>
      <div style={{position: 'absolute', left: -size * 1.6, top: cy - size * 1.6, width: size * 3.2, height: size * 3.2, borderRadius: '50%', background: `radial-gradient(circle, ${alpha('#ffffff', 0.95 * flash)} 0%, ${alpha(pal.accent, 0.7 * flash)} 25%, transparent 65%)`, pointerEvents: 'none'}} />
      <svg width={w} height={h} viewBox="0 0 200 260" style={{position: 'absolute', left: -w / 2, top: cy - h * 0.55, overflow: 'visible', transform: `translateY(${(1 - rise) * size * 0.6}px) rotate(${wobble}deg)`, transformOrigin: '50% 95%', opacity: Math.min(1, rise * 2)}}>
        <defs>
          <clipPath id={`${id}-t`}>
            <polygon points={`0,-60 200,-60 200,142 ${ZIG.split(' ').reverse().join(' ')} 0,142`} />
          </clipPath>
          <clipPath id={`${id}-b`}>
            <polygon points={`0,142 ${ZIG} 200,142 200,300 0,300`} />
          </clipPath>
        </defs>
        <g opacity={bottomOut} transform={`translate(${-open * 10} ${open * 24})`}>{egg(`${id}-b`)}</g>
        <g opacity={topOut} transform={`translate(${open * 70} ${-open * 170}) rotate(${open * 38} 100 120)`}>{egg(`${id}-t`)}</g>
        {open < 0.05 ? <polyline points={ZIG} fill="none" stroke={pal.ink} strokeWidth={5 / Math.max(0.5, u)} strokeLinejoin="round" strokeLinecap="round" pathLength={1} strokeDasharray={1} strokeDashoffset={1 - crack} /> : null}
      </svg>
    </>
  );
};

/** Year (counting from the previous one when both are plain years), title and detail of a milestone. */
const Panel: React.FC<{m: Milestone; prev: Milestone | null; i: number; n: number; start: number; end: number; pal: Pal; u: number; wide: boolean; scale: number}> = ({m, prev, i, n, start, end, pal, u, wide, scale}) => {
  const frame = useCurrentFrame();
  if (frame < start || frame >= end) return null;
  const inP = progress(frame, start, 16);
  const out = progress(frame, end - 9, 9, ease.accelerate);
  const plain = (y: string) => /^\d{3,4}$/.test(y.trim());
  const year = prev && plain(m.year) && plain(prev.year) ? String(Math.round(tween(frame, [start, start + 28], [Number(prev.year), Number(m.year)], ease.expo))) : m.year;
  const k = scale * u;
  const underline = tween(frame, [start + 6, start + 26], [0, 1], ease.cinematic);
  return (
    <div style={{position: 'absolute', left: '7%', top: wide ? '8%' : '6.5%', width: wide ? '41%' : '86%', opacity: 1 - out, transform: `translateY(${-out * 30 * u}px)`}}>
      <div style={{fontFamily: fonts.mono, fontSize: 24 * k, letterSpacing: '0.3em', color: pal.muted, opacity: inP}}>
        {String(i + 1).padStart(2, '0')} / {String(n).padStart(2, '0')}
      </div>
      <div style={{position: 'relative', display: 'inline-block', fontFamily: fonts.hand, fontWeight: 700, fontSize: 138 * k, lineHeight: 1, color: pal.accent, textShadow: pal.light ? 'none' : glow(pal.accent, 0.5), transform: `translateY(${(1 - inP) * 24 * u}px)`, opacity: inP, marginTop: 4 * k}}>
        {year}
        <svg width="100%" height={22 * k} viewBox="0 0 200 22" preserveAspectRatio="none" style={{position: 'absolute', left: 0, bottom: -10 * k, overflow: 'visible'}}>
          <path d="M4 14 C50 4 120 20 196 8" fill="none" stroke={pal.accent} strokeWidth={4} strokeLinecap="round" vectorEffect="non-scaling-stroke" pathLength={1} strokeDasharray={1} strokeDashoffset={1 - underline} />
        </svg>
      </div>
      <div style={{marginTop: 22 * k}}>
        <KineticText text={m.title} start={start + 5} stagger={3} style="rise" textStyle={{fontFamily: fonts.grotesk, fontWeight: 700, fontSize: 62 * k, lineHeight: 1.06, letterSpacing: '-0.015em', color: pal.text, textShadow: pal.light ? 'none' : `0 ${3 * u}px ${18 * u}px ${alpha(pal.sky[0], 0.8)}`}} />
      </div>
      {m.detail ? (
        <div style={{marginTop: 16 * k, fontFamily: fonts.sans, fontSize: 33 * k, lineHeight: 1.36, color: pal.muted, opacity: progress(frame, start + 14, 16), transform: `translateY(${(1 - progress(frame, start + 14, 16)) * 14 * u}px)`, maxWidth: wide ? undefined : '92%'}}>
          {m.detail}
        </div>
      ) : null}
    </div>
  );
};

/** Intro length: the first narration scene when it is a separate title scene, else a short beat. */
const introFrames = (scenes: number, milestones: number, firstScene: number, content: number, fps: number) =>
  scenes > milestones ? firstScene : Math.min(Math.round(1.8 * fps), Math.round(content * 0.15));

const DoodleCivilization: React.FC<EntryProps<Props>> = ({media, props}) => {
  const frame = useCurrentFrame();
  const {fps, width, height} = useVideoConfig();
  const look = useLook();
  const pal: Pal = look ? fromLook(look) : {...PALETTES[props.palette], accent: media.accent ?? PALETTES[props.palette].accent};
  const u = Math.min(width, height) / 1080;
  const wide = width >= height * 0.95;
  const textScale = wide && width / height < 1.3 ? 0.74 : 1;
  const timeline = useSceneTimeline(media);
  const content = useContentFrames(media);
  const ms = props.milestones;
  const n = ms.length;

  // --- timing: one milestone per narration scene (after an optional title scene) ---
  const offset = timeline.length > n ? 1 : 0;
  const introEnd = introFrames(timeline.length, n, timeline[1]?.from ?? 0, content, fps);
  const sceneCount = timeline.length - offset;
  const starts = ms.map((_, i) => {
    if (i === 0) return introEnd;
    const at = sceneCount >= n ? timeline[i + offset].from : Math.round(introEnd + (i * (content - introEnd)) / n);
    return Math.min(at, content - Math.round(fps));
  });
  const ends = starts.map((_, i) => (i < n - 1 ? starts[i + 1] : content));
  const minGap = Math.min(...starts.map((s, i) => ends[i] - s));
  const move = Math.max(8, Math.min(Math.round(1.2 * fps), Math.round(minGap * 0.45)));
  const lead = Math.round(move * 0.4);
  const grownAt = starts.map((s, i) => (i === 0 ? s + 4 : s - lead + Math.round(move * 0.8)));
  const finaleK = Math.min(1, Math.max(0.45, (content - grownAt[n - 1]) / 95));
  const current = Math.max(0, starts.findIndex((s, i) => frame >= s && frame < ends[i]));

  // --- layout ---
  const safe = captionSafeBottom(look);
  const horizon = height * Math.min(wide ? 0.7 : 0.64, look ? 1 - safe - 0.02 : 1);
  const anchorX = width * (wide ? 0.66 : 0.6);
  // Wide enough that the previous milestone leaves the frame before the text column covers it.
  const spacing = width * (wide ? 0.74 : 0.85);
  const size = wide ? height * 0.27 : Math.min(width * 0.36, height * 0.2);
  const travel = (n - 1) * spacing;
  const travellerX = anchorX - (wide ? width * 0.14 : width * 0.36);
  const travellerH = wide ? height * 0.17 : height * 0.12;

  // --- camera: walks from station to station, descends from the sky after the title ---
  const legs = starts.map((s, i) => (i === 0 ? 0 : progress(frame, s - lead, move, ease.cinematic)));
  const camX = legs.reduce((a, p) => a + p * spacing, 0);
  const walking = Math.min(1, legs.reduce((a, p) => a + Math.sin(Math.PI * p), 0));
  const descend = tween(frame, [Math.max(0, introEnd - Math.round(1.3 * fps)), introEnd + 6], [0, 1], ease.cinematic);
  const worldY = (1 - descend) * height * 0.55;
  const enter = progress(frame, introEnd - Math.round(0.5 * fps), Math.round(1 * fps), ease.snappy);
  const enterDist = (1 - enter) * width * 0.45;
  const enterWalk = enter > 0 && enter < 1 ? 1 : 0;
  const phase = (camX - enterDist) / (38 * u);
  const journey = travel > 0 ? camX / travel : 1;
  const push = 1 + 0.035 * progress(frame, grownAt[n - 1], Math.max(1, content - grownAt[n - 1]), ease.cinematic);

  const titleOut = progress(frame, introEnd - 12, 12, ease.accelerate);
  const layerW = (par: number) => travel * par + width * 2.2;

  return (
    <AbsoluteFill style={{overflow: 'hidden', background: pal.sky[0]}}>
      {/* sky, dawn glow growing with the journey, stars, moon (static top-level layers) */}
      <AbsoluteFill style={{background: `linear-gradient(180deg, ${pal.sky[0]} 0%, ${pal.sky[1]} ${(horizon / height) * 100}%, ${pal.sky[1]} 100%)`}} />
      <AbsoluteFill style={{background: `radial-gradient(ellipse 80% 45% at 60% ${(horizon / height) * 100 + 4}%, ${alpha(pal.dawn, 0.12 + 0.38 * journey)} 0%, transparent 70%)`}} />
      {!pal.light ? (
        <AbsoluteFill style={{pointerEvents: 'none'}}>
          {Array.from({length: 90}, (_, s) => {
            const r = rand(`sr${s}`, 1.2, 3.6) * u;
            const tw = 0.35 + 0.65 * (0.5 + 0.5 * Math.sin(frame / rand(`st${s}`, 9, 26) + rand(`sp${s}`, 0, 6)));
            return <div key={s} style={{position: 'absolute', left: rand(`sx${s}`) * width, top: rand(`sy${s}`) * height * 0.62, width: r, height: r, borderRadius: '50%', background: pal.line, opacity: tw * 0.8}} />;
          })}
        </AbsoluteFill>
      ) : null}
      {(() => {
        const mx = width * (wide ? 0.86 : 0.88);
        const my = height * (wide ? 0.15 : 0.045) + Math.sin(frame / 60) * 4 * u;
        const mr = (wide ? 48 : 32) * u;
        return pal.light ? (
          <div style={{position: 'absolute', left: mx - mr * 1.2, top: my - mr * 1.2, opacity: 0.7, transform: `rotate(${frame * 0.2}deg)`}}>
            <LineIcon name="sun" size={mr * 2.4} color={pal.accent} strokeWidth={4} />
          </div>
        ) : (
          <>
            <div style={{position: 'absolute', left: mx - mr * 4, top: my - mr * 4, width: mr * 8, height: mr * 8, borderRadius: '50%', background: `radial-gradient(circle, ${alpha(pal.line, 0.18)} 0%, transparent 60%)`}} />
            <div style={{position: 'absolute', left: mx - mr, top: my - mr, width: mr * 2, height: mr * 2, borderRadius: '50%', background: mix(pal.line, pal.accent, 0.12), boxShadow: `inset ${-10 * u}px ${-6 * u}px 0 ${alpha(pal.sky[1], 0.35)}`}} />
          </>
        );
      })()}

      {/* the world: parallax hills, trees, path and milestones */}
      <AbsoluteFill style={{transform: `translateY(${worldY}px) scale(${push})`, transformOrigin: `${anchorX}px ${horizon}px`}}>
        {[
          {par: 0.25, base: horizon - height * 0.13, amp: height * 0.09, color: pal.far, step: width * 0.22, trees: 0},
          {par: 0.5, base: horizon - height * 0.045, amp: height * 0.06, color: pal.mid, step: width * 0.16, trees: 0.55},
        ].map((l, li) => (
          <div key={li} style={{position: 'absolute', left: -width * 0.6, top: 0, transform: `translateX(${-camX * l.par}px)`}}>
            <svg width={layerW(l.par)} height={height * 1.7} style={{overflow: 'visible'}}>
              <path d={ridge(`h${li}`, layerW(l.par), l.base, l.amp, l.step, height * 1.7)} fill={l.color} />
              {l.trees
                ? Array.from({length: Math.ceil(layerW(l.par) / (width * 0.12))}, (_, t) => (rand(`mt${t}`) < l.trees ? <Tree key={t} x={t * width * 0.12 + rand(`mx${t}`, 0, width * 0.08)} base={l.base - l.amp * 0.25} h={height * rand(`mh${t}`, 0.05, 0.08)} color={mix(l.color, pal.line, 0.08)} trunk={mix(l.color, pal.line, 0.15)} seed={`m${t}`} /> : null))
                : null}
            </svg>
          </div>
        ))}
        <div style={{position: 'absolute', left: 0, top: 0, transform: `translateX(${-camX}px)`}}>
          <svg width={layerW(1)} height={height * 1.7} style={{position: 'absolute', left: -width * 0.6, top: 0, overflow: 'visible'}}>
            <path d={ridge('g', layerW(1), horizon + height * 0.012, height * 0.025, width * 0.2, height * 1.7)} fill={pal.ground} />
            {Array.from({length: n + 2}, (_, k) =>
              [0, 1].map(j => {
                const tx = width * 0.6 + anchorX + (k - 1) * spacing + spacing * (j ? rand(`tb${k}`, 0.58, 0.72) : rand(`ta${k}`, 0.28, 0.42));
                return <Tree key={`${k}-${j}`} x={tx} base={horizon + height * 0.01} h={size * rand(`th${k}${j}`, 0.42, 0.6)} color={mix(pal.ground, pal.line, 0.1)} trunk={mix(pal.ground, pal.line, 0.3)} seed={`t${k}${j}`} />;
              }),
            )}
          </svg>
          {/* path of progress: dotted trail, walked part in the accent colour */}
          <svg width={travel + 10} height={20 * u} style={{position: 'absolute', left: anchorX, top: horizon + size * 0.16, overflow: 'visible'}}>
            <line x1={0} y1={0} x2={travel} y2={0} stroke={alpha(pal.line, 0.35)} strokeWidth={6 * u} strokeLinecap="round" strokeDasharray={`0.1 ${22 * u}`} />
            <line x1={0} y1={0} x2={Math.max(0, Math.min(travel, camX))} y2={0} stroke={pal.accent} strokeWidth={7 * u} strokeLinecap="round" strokeDasharray={`0.1 ${22 * u}`} />
          </svg>
          {ms.map((m, i) => (
            <Station key={i} m={m} i={i} x={anchorX + i * spacing} horizon={horizon} size={size} u={u} pal={pal} grownAt={grownAt[i]} active={i === current} finale={i === n - 1 && props.finale !== 'none' ? props.finale : null} k={finaleK} ghost={progress(frame, introEnd, 12)} />
          ))}
        </div>
        <Traveller x={travellerX - enterDist} feet={horizon + size * 0.1} h={travellerH} walk={Math.max(walking, enterWalk)} phase={phase} pal={pal} />
        {/* foreground ridge with grass tufts */}
        <div style={{position: 'absolute', left: -width * 0.6, top: 0, transform: `translateX(${-camX * 1.3}px)`}}>
          <svg width={layerW(1.3)} height={height * 1.7} style={{overflow: 'visible'}}>
            <path d={ridge('n', layerW(1.3), horizon + height * 0.2, height * 0.05, width * 0.18, height * 1.7)} fill={pal.near} />
            {Array.from({length: Math.ceil(layerW(1.3) / (width * 0.05))}, (_, t) => {
              const gx = t * width * 0.05 + rand(`gx${t}`, 0, width * 0.03);
              const gy = horizon + height * rand(`gy${t}`, 0.17, 0.22);
              const gh = height * rand(`gh${t}`, 0.015, 0.03);
              const sw = Math.sin(frame / 20 + t) * gh * 0.15;
              return <path key={t} d={`M${gx - gh * 0.4},${gy - gh * 0.6 + sw} L${gx},${gy} L${gx + sw * 0.5},${gy - gh} M${gx},${gy} L${gx + gh * 0.45 + sw},${gy - gh * 0.7}`} stroke={mix(pal.near, pal.line, 0.25)} strokeWidth={Math.max(1.5, 2.5 * u)} strokeLinecap="round" fill="none" />;
            })}
          </svg>
        </div>
      </AbsoluteFill>

      <Particles count={24} color={pal.accent} seed="fireflies" size={[2 * u, 5 * u]} speed={0.35} blur opacity={pal.light ? 0.3 : 0.6} />

      {/* milestone text */}
      {ms.map((m, i) => (
        <Panel key={i} m={m} prev={i ? ms[i - 1] : null} i={i} n={n} start={starts[i]} end={ends[i]} pal={pal} u={u} wide={wide} scale={textScale} />
      ))}

      {/* title in the night sky before the camera comes down */}
      {titleOut < 1 ? (
        <AbsoluteFill style={{justifyContent: 'center', alignItems: 'center', padding: '0 9%', opacity: 1 - titleOut, transform: `translateY(${-titleOut * 80 * u}px)`, paddingBottom: height * 0.12}}>
          <LineIcon name="spark" progress={tween(frame, [2, 30], [0, 1], ease.cinematic)} size={96 * u} color={pal.accent} strokeWidth={4} />
          <div style={{marginTop: 18 * u}}>
            <KineticText text={props.title} start={6} stagger={4} style="blur" align="center" accent={pal.accent} textStyle={{fontFamily: fonts.hand, fontWeight: 700, color: pal.text, fontSize: (wide ? 128 : 116) * u * textScale, lineHeight: 1.02, textShadow: pal.light ? 'none' : `0 0 ${30 * u}px ${alpha(pal.accent, 0.35)}`}} />
          </div>
          {props.subtitle ? <KineticText text={props.subtitle} start={22} stagger={2} style="rise" align="center" textStyle={{fontFamily: fonts.sans, fontWeight: 500, color: pal.muted, fontSize: 38 * u * textScale, marginTop: 22 * u, letterSpacing: '0.02em'}} /> : null}
        </AbsoluteFill>
      ) : null}

      {props.finale === 'glow' ? <LightLeak from={grownAt[n - 1] + 6} durationInFrames={Math.round(2.2 * fps)} seed={11} opacity={pal.light ? 0.35 : 0.6} /> : null}
      {props.finale === 'hatch' ? <LightLeak from={grownAt[n - 1] + Math.round(40 * finaleK)} durationInFrames={Math.round(1.8 * fps)} seed={7} opacity={pal.light ? 0.3 : 0.55} /> : null}

      {props.showCaptions
        ? timeline.map(t => (
            <Sequence key={t.index} from={t.from} durationInFrames={t.durationInFrames}>
              <AbsoluteFill style={{justifyContent: 'flex-end', padding: wide ? '0 16% 3.2%' : '0 7% 7%', opacity: frame >= introEnd ? 1 : 0}}>
                <StyledCaptions scene={t.scene} variant="karaoke" accent={pal.accent} color={pal.text} font={fonts.sans} size={(wide ? 46 : 50) * u} words={wide && textScale === 1 ? 7 : 5} weight={800} />
              </AbsoluteFill>
            </Sequence>
          ))
        : null}

      <Vignette strength={pal.light ? 0.25 : 0.55} />
      <Grain opacity={pal.light ? 0.05 : 0.07} />
      <NarrationTrack media={media} />
      <AdWeave media={media} theme={{background: pal.sky[0], text: pal.text, font: fonts.sans}} />
    </AbsoluteFill>
  );
};

export default defineEntry({
  id: 'timeline-doodle-civilization',
  schema: Props,
  component: DoodleCivilization,
  // Shared captions wait for the title in the sky, like the template's own captions.
  captionHold: ({props, media, fps}) => {
    const total = Math.round((media.durationMs / 1000) * fps);
    return introFrames(media.scenes.length, props.milestones.length, Math.round((media.scenes[0]?.audio.duration ?? 2) * fps), total, fps);
  },
});
