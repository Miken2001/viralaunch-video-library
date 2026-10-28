import React from 'react';
import {AbsoluteFill, Sequence, useCurrentFrame, useVideoConfig} from 'remotion';
import {AdWeave, NarrationTrack, captionSafeBottom, defineEntry, mix, useContentFrames, useLook, useSceneTimeline, type ActiveLook, type EntryProps, type TimedScene} from '@viralaunch/kit';
import {CameraImage, Grain, KineticText, LightLeak, Particles, SceneSeries, StyledCaptions, Vignette, alpha, countUp, ease, fonts, progress, rand, tween} from '@viralaunch/kit/fx';
import {Props, type Chapter} from './schema';

type Pal = {paper: string; paper2: string; ink: string; mist: string; moon: string; glow: string; text: string; muted: string; accent: string; light: boolean};

const PALETTES: Record<Props['palette'], Pal> = {
  'rice-paper': {paper: '#efe7d5', paper2: '#e0d5bd', ink: '#1d1a16', mist: '#fbf7ee', moon: '#fbf5e6', glow: '#efcf96', text: '#1d1a16', muted: '#6f6658', accent: '#b3322a', light: true},
  'indigo-night': {paper: '#0a1121', paper2: '#26375a', ink: '#03060d', mist: '#8195b9', moon: '#f2ead4', glow: '#e8c47a', text: '#ece6d6', muted: '#9aa4ba', accent: '#d9a441', light: false},
  'ember-dusk': {paper: '#170c14', paper2: '#5c2b2b', ink: '#0a0508', mist: '#c98a6c', moon: '#ffe9c8', glow: '#ffb46b', text: '#fff0e0', muted: '#cfa594', accent: '#e5603d', light: false},
};

/** The ink painting in a sequence's shared look: paper, ink, mist and seal colour come from the look. */
const fromLook = (l: ActiveLook): Pal => {
  const light = l.tone === 'light';
  return {
    paper: l.palette.bg,
    paper2: l.palette.bg2,
    ink: light ? l.palette.line : mix(l.palette.bg, '#000000', 0.6),
    mist: light ? l.palette.surface : mix(l.palette.bg2, l.palette.text, 0.35),
    moon: light ? mix(l.palette.surface, '#ffffff', 0.4) : mix(l.palette.text, '#ffffff', 0.25),
    glow: l.palette.accent,
    text: l.palette.text,
    muted: l.palette.muted,
    accent: l.palette.accent,
    light,
  };
};

/** Position in the lunar cycle (0 = new, 0.5 = full); eclipse is a full moon turned red. */
const PHASE_T: Record<Chapter['phase'], number> = {new: 0, 'waxing-crescent': 0.125, 'first-quarter': 0.25, 'waxing-gibbous': 0.375, full: 0.5, 'waning-gibbous': 0.625, 'last-quarter': 0.75, 'waning-crescent': 0.875, eclipse: 0.5};
const PAN = [0, -1, 0.7, -0.45, 1, -0.8, 0.35];

/** Lit part of a disc at cycle position t (waxing = lit on the right). */
function litPath(cx: number, cy: number, r: number, t: number) {
  const tt = ((t % 1) + 1) % 1;
  const k = (1 - Math.cos(2 * Math.PI * tt)) / 2;
  const rx = r * Math.abs(1 - 2 * k);
  const gib = k > 0.5;
  return tt < 0.5
    ? `M${cx},${cy - r} A${r},${r} 0 0 1 ${cx},${cy + r} A${rx},${r} 0 0 ${gib ? 1 : 0} ${cx},${cy - r} Z`
    : `M${cx},${cy - r} A${r},${r} 0 0 0 ${cx},${cy + r} A${rx},${r} 0 0 ${gib ? 0 : 1} ${cx},${cy - r} Z`;
}

/** Ink-wash peaks: one path per layer (subpaths union, so overlaps never double the ink). */
function peaks(seed: string, w: number, base: number, count: number, hMin: number, hMax: number, wMin: number, wMax: number) {
  const parts: string[] = [];
  for (let i = 0; i < count; i++) {
    const cx = -w * 0.2 + ((i + rand(`${seed}x${i}`, 0.1, 0.9)) / count) * w * 1.4;
    const h = rand(`${seed}h${i}`, hMin, hMax);
    const pw = rand(`${seed}w${i}`, wMin, wMax);
    const lean = rand(`${seed}l${i}`, -0.18, 0.18);
    const top = cx + pw * lean;
    parts.push(`M${cx - pw},${base} C${cx - pw * 0.45},${base - h * 0.12} ${top - pw * 0.28},${base - h * 0.92} ${top},${base - h} C${top + pw * 0.22},${base - h * 0.9} ${cx + pw * 0.5},${base - h * 0.18} ${cx + pw},${base} Z`);
  }
  return parts.join(' ');
}

type Layout = {tall: boolean; u: number; moon: {x: number; y: number; r: number}; horizon: number; lens: {x: number; y: number; r: number}; heading: {right: number; top: number; room: number}; title: number};

function useLayout(look: ActiveLook | null): Layout {
  const {width, height} = useVideoConfig();
  const u = Math.min(width, height) / 1080;
  const tall = height / width > 1.3;
  const safe = captionSafeBottom(look);
  if (tall) {
    return {tall, u, moon: {x: width * 0.64, y: height * 0.19, r: 140 * u}, horizon: height * 0.63, lens: {x: width * 0.37, y: height * 0.465, r: width * 0.21}, heading: {right: width * 0.055, top: height * 0.3, room: height * (0.42 - safe * 0.25)}, title: height * 0.4};
  }
  const m = Math.min(width, height);
  return {tall, u, moon: {x: width * 0.68, y: height * 0.21, r: m * 0.1}, horizon: height * 0.63, lens: {x: width * 0.29, y: height * (look ? 0.42 : 0.47), r: m * (look ? 0.2 : 0.23)}, heading: {right: width * 0.05, top: height * 0.13, room: height * (0.62 - safe * 0.6)}, title: height * 0.48};
}

/** The painted world: sky, the orb, ink mountains, mist, water and its reflection, a little boat. */
const Painting: React.FC<{pal: Pal; props: Props; lay: Layout; pan: number; phase: number; eclipse: number; rise: number}> = ({pal, props, lay, pan, phase, eclipse, rise}) => {
  const frame = useCurrentFrame();
  const {width, height} = useVideoConfig();
  const {u, horizon} = lay;
  const skyLow = mix(pal.paper, pal.mist, pal.light ? 0.55 : 0.5);
  const m = {...lay.moon, x: lay.moon.x + pan * 0.15, y: lay.moon.y + rise};
  const sea = props.scenery === 'sea';
  const hills = props.scenery === 'hills';
  const layers = sea
    ? [{seed: 'is0', base: horizon, n: 4, h: [0.02, 0.05], w: [0.06, 0.14], k: 0.25, fade: 0.55}, {seed: 'is1', base: horizon + height * 0.02, n: 2, h: [0.06, 0.1], w: [0.08, 0.13], k: 0.6, fade: 0.1}]
    : hills
      ? [{seed: 'hl0', base: horizon - height * 0.01, n: 6, h: [0.05, 0.08], w: [0.18, 0.28], k: 0.25, fade: 0.6}, {seed: 'hl1', base: horizon + height * 0.005, n: 5, h: [0.04, 0.07], w: [0.16, 0.26], k: 0.55, fade: 0.32}, {seed: 'hl2', base: horizon + height * 0.025, n: 4, h: [0.03, 0.06], w: [0.14, 0.22], k: 1, fade: 0}]
      : [{seed: 'mt0', base: horizon - height * 0.015, n: 8, h: [0.11, 0.2], w: [0.07, 0.12], k: 0.25, fade: 0.6}, {seed: 'mt1', base: horizon, n: 7, h: [0.08, 0.15], w: [0.06, 0.1], k: 0.55, fade: 0.32}, {seed: 'mt2', base: horizon + height * 0.025, n: 5, h: [0.07, 0.14], w: [0.05, 0.09], k: 1, fade: 0}];
  const waterTop = horizon + height * (sea ? 0.0 : 0.02);
  const shadow = pal.light ? mix(skyLow, pal.ink, 0.16) : mix(pal.paper, pal.moon, 0.1);
  const disc = props.orb === 'sun' ? mix(pal.moon, pal.glow, 0.55) : props.orb === 'ringed-planet' ? mix(pal.moon, pal.glow, 0.35) : mix(pal.moon, '#b4432e', eclipse * 0.75);
  const glowC = mix(pal.glow, '#c0472f', props.orb === 'moon' ? eclipse * 0.6 : 0);
  const sunEclipse = props.orb === 'sun' ? eclipse : 0;
  return (
    <AbsoluteFill>
      {/* sky */}
      <AbsoluteFill style={{background: `linear-gradient(180deg, ${pal.light ? pal.paper2 : pal.paper} 0%, ${pal.paper} ${pal.light ? 30 : 45}%, ${skyLow} ${(horizon / height) * 100}%, ${pal.paper2} 100%)`}} />
      {!pal.light
        ? Array.from({length: 80}, (_, i) => {
            const tw = 0.45 + 0.55 * Math.abs(Math.sin(frame / rand(`tw${i}`, 14, 40) + i));
            const s = rand(`ss${i}`, 1.5, 4) * u;
            return <div key={i} style={{position: 'absolute', left: rand(`sx${i}`) * width + pan * 0.08, top: rand(`sy${i}`) * horizon * 0.8, width: s, height: s, borderRadius: '50%', background: pal.moon, opacity: tw * rand(`so${i}`, 0.3, 0.9)}} />;
          })
        : null}
      <svg width={width} height={height} style={{position: 'absolute', inset: 0}}>
        <defs>
          <radialGradient id="dfm-glow">
            <stop offset="0%" stopColor={glowC} stopOpacity={pal.light ? 0.55 : 0.5} />
            <stop offset="35%" stopColor={glowC} stopOpacity={pal.light ? 0.22 : 0.18} />
            <stop offset="100%" stopColor={glowC} stopOpacity={0} />
          </radialGradient>
          <radialGradient id="dfm-disc" cx="40%" cy="38%">
            <stop offset="0%" stopColor={mix(disc, '#ffffff', 0.5)} />
            <stop offset="70%" stopColor={disc} />
            <stop offset="100%" stopColor={mix(disc, pal.ink, pal.light ? 0.12 : 0.25)} />
          </radialGradient>
          <clipPath id="dfm-clip">
            <circle cx={m.x} cy={m.y} r={m.r} />
          </clipPath>
          <filter id="dfm-rough" x="-5%" y="-20%" width="110%" height="140%">
            <feTurbulence type="fractalNoise" baseFrequency="0.035 0.09" numOctaves={2} seed={7} />
            <feDisplacementMap in="SourceGraphic" scale={9 * u} />
          </filter>
          {layers.map((l, i) => (
            <linearGradient key={i} id={`dfm-wash${i}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={mix(pal.ink, skyLow, l.fade)} stopOpacity={0.96} />
              <stop offset="55%" stopColor={mix(pal.ink, skyLow, Math.min(1, l.fade + 0.15))} stopOpacity={0.82} />
              <stop offset="100%" stopColor={skyLow} stopOpacity={0} />
            </linearGradient>
          ))}
        </defs>
        {/* the orb */}
        <circle cx={m.x} cy={m.y} r={m.r * (props.orb === 'sun' ? 4 : 3.2)} fill="url(#dfm-glow)" opacity={props.orb === 'sun' ? 1 - sunEclipse * 0.55 : 1} />
        {props.orb === 'sun'
          ? Array.from({length: 24}, (_, i) => {
              const a = (i / 24) * Math.PI * 2 + frame * 0.003;
              const len = m.r * rand(`ray${i}`, 0.35, 0.8) * (1 + sunEclipse * 0.8);
              return <line key={i} x1={m.x + Math.cos(a) * m.r * 1.12} y1={m.y + Math.sin(a) * m.r * 1.12} x2={m.x + Math.cos(a) * (m.r * 1.12 + len)} y2={m.y + Math.sin(a) * (m.r * 1.12 + len)} stroke={sunEclipse > 0.5 ? mix(pal.moon, '#ffffff', 0.5) : glowC} strokeWidth={3 * u} strokeLinecap="round" opacity={0.55} />;
            })
          : null}
        {props.orb === 'ringed-planet' ? <ellipse cx={m.x} cy={m.y} rx={m.r * 2.05} ry={m.r * 0.5} fill="none" stroke={mix(disc, pal.ink, 0.25)} strokeWidth={m.r * 0.16} opacity={0.75} transform={`rotate(-16 ${m.x} ${m.y})`} /> : null}
        <circle cx={m.x} cy={m.y} r={m.r} fill="url(#dfm-disc)" />
        <g clipPath="url(#dfm-clip)">
          {props.orb === 'moon'
            ? [0, 1, 2, 3, 4].map(i => <ellipse key={i} cx={m.x + m.r * rand(`mx${i}`, -0.55, 0.45)} cy={m.y + m.r * rand(`my${i}`, -0.5, 0.45)} rx={m.r * rand(`mr${i}`, 0.14, 0.32)} ry={m.r * rand(`mq${i}`, 0.12, 0.26)} fill={pal.ink} opacity={pal.light ? 0.07 : 0.1} />)
            : props.orb === 'ringed-planet'
              ? [-0.55, -0.2, 0.15, 0.45].map((b, i) => <rect key={i} x={m.x - m.r} y={m.y + m.r * b} width={m.r * 2} height={m.r * (0.12 + 0.04 * i)} fill={pal.ink} opacity={0.1} transform={`rotate(-16 ${m.x} ${m.y})`} />)
              : null}
          {props.orb !== 'sun' ? <path d={litPath(m.x, m.y, m.r * 1.01, phase + 0.5)} fill={shadow} opacity={0.94} /> : null}
          {sunEclipse > 0 ? <circle cx={m.x + (1 - sunEclipse) * m.r * 2.2} cy={m.y} r={m.r * 1.01} fill={pal.light ? pal.ink : '#050505'} /> : null}
        </g>
        {props.orb === 'ringed-planet' ? <path d={`M${m.x - m.r * 2.05},${m.y} A${m.r * 2.05},${m.r * 0.5} 0 0 0 ${m.x + m.r * 2.05},${m.y}`} fill="none" stroke={mix(disc, pal.ink, 0.15)} strokeWidth={m.r * 0.16} opacity={0.85} transform={`rotate(-16 ${m.x} ${m.y})`} /> : null}
        {!pal.light ? null : <circle cx={m.x} cy={m.y} r={m.r} fill="none" stroke={pal.ink} strokeOpacity={0.22} strokeWidth={2.5 * u} />}
        {/* birds */}
        {[0, 1, 2, 3].map(i => {
          const bx = ((rand(`bx${i}`) * width + frame * (0.9 + i * 0.25)) % (width + 120)) - 60;
          const by = height * rand(`by${i}`, 0.08, 0.3) + Math.sin(frame / 9 + i) * 5 * u;
          const flap = Math.sin(frame / 3.2 + i * 1.7) * 7 * u;
          const s = 12 * u;
          return <path key={i} d={`M${bx - s},${by + flap} Q${bx - s * 0.4},${by - s * 0.45} ${bx},${by} Q${bx + s * 0.4},${by - s * 0.45} ${bx + s},${by + flap}`} fill="none" stroke={pal.light ? pal.ink : mix(pal.ink, pal.mist, 0.25)} strokeWidth={2.4 * u} strokeLinecap="round" opacity={0.8} />;
        })}
        {/* water */}
        <rect x={0} y={waterTop} width={width} height={height - waterTop} fill={pal.light ? mix(pal.paper, pal.paper2, 0.5) : mix(pal.paper, pal.paper2, 0.35)} opacity={0.95} />
        {Array.from({length: 18}, (_, i) => {
          const y = waterTop + (height - waterTop) * rand(`wy${i}`, 0.04, 0.95);
          const len = width * rand(`wl${i}`, 0.05, 0.16);
          const x = ((rand(`wx${i}`) * width + frame * rand(`wv${i}`, 0.2, 0.6) + pan) % (width + len)) - len;
          return <line key={i} x1={x} x2={x + len} y1={y} y2={y} stroke={pal.light ? pal.ink : pal.mist} strokeWidth={2 * u} strokeLinecap="round" opacity={pal.light ? 0.12 : 0.18} />;
        })}
        {Array.from({length: 12}, (_, i) => {
          const y = waterTop + 14 * u + i * 22 * u;
          const half = m.r * (0.9 - i * 0.055) * (0.75 + 0.25 * Math.sin(frame / 7 + i * 1.3));
          const dx = Math.sin(frame / 11 + i) * 8 * u;
          return <line key={i} x1={m.x - half + dx} x2={m.x + half + dx} y1={y} y2={y} stroke={pal.light ? mix(pal.ink, pal.paper, 0.6) : mix(pal.moon, glowC, 0.3)} strokeWidth={5 * u} strokeLinecap="round" opacity={(1 - i / 12) * (pal.light ? 0.4 : 0.55) * (props.orb === 'sun' ? 1 - sunEclipse * 0.7 : 0.4 + 0.6 * Math.min(1, phase === 0 ? 0 : Math.sin(Math.PI * (((phase % 1) + 1) % 1))))} />;
        })}
        {/* ink layers, far to near, with parallax */}
        {layers.map((l, i) => (
          <g key={l.seed} transform={`translate(${pan * l.k} 0)`} filter="url(#dfm-rough)">
            <path d={peaks(l.seed, width, l.base, l.n, height * l.h[0], height * l.h[1], width * l.w[0], width * l.w[1])} fill={`url(#dfm-wash${i})`} />
          </g>
        ))}
        {/* a watcher in a small boat */}
        {(() => {
          const bx = width * (lay.tall ? 0.2 : 0.16) + pan * 1.1 + Math.sin(frame / 50) * 10 * u;
          const by = waterTop + (height - waterTop) * (lay.tall ? 0.16 : 0.32) + Math.sin(frame / 14) * 3 * u;
          const s = (lay.tall ? 1.2 : 1) * u;
          return (
            <g transform={`translate(${bx} ${by}) scale(${s}) rotate(${Math.sin(frame / 16) * 2})`} fill={pal.light ? pal.ink : mix(pal.mist, pal.paper, 0.2)}>
              <path d="M-70,0 Q-40,16 0,16 Q40,16 72,-4 Q36,6 0,6 Q-38,6 -70,0 Z" />
              <path d="M-20,2 L-20,-22 Q-10,-38 4,-22 L4,2 Z" />
              <circle cx={-8} cy={-36} r={8} />
              <line x1={20} y1={2} x2={58} y2={-46} stroke={pal.light ? pal.ink : mix(pal.mist, pal.paper, 0.2)} strokeWidth={3} />
              <ellipse cx={0} cy={22} rx={70} ry={4} opacity={0.18} />
            </g>
          );
        })()}
      </svg>
      {/* drifting mist bands */}
      {[0, 1, 2, 3].map(i => (
        <AbsoluteFill key={i} style={{pointerEvents: 'none', opacity: pal.light ? 0.5 : 0.32, background: `radial-gradient(ellipse 55% 4.5% at ${((frame * (0.12 + i * 0.05) + i * 41) % 170) - 35}% ${((horizon - height * (0.07 - i * 0.03)) / height) * 100}%, ${alpha(pal.mist, 0.9)} 0%, transparent 100%)`}} />
      ))}
    </AbsoluteFill>
  );
};

/** Plum branch growing in from the top-left corner, swaying, with seal-coloured blossoms. */
const Branch: React.FC<{pal: Pal; u: number; tall: boolean}> = ({pal, u, tall}) => {
  const frame = useCurrentFrame();
  const draw = progress(frame, 4, 50, ease.cinematic);
  const s = (tall ? 1.15 : 0.95) * u;
  const twigs = ['M0,90 C110,70 220,40 340,58 C420,70 470,60 540,40', 'M200,60 C230,20 260,6 300,-4', 'M340,58 C360,90 400,110 430,118', 'M450,64 C480,30 510,18 560,12'];
  const blossoms = [[300, -4], [430, 118], [540, 40], [560, 12], [250, 48], [395, 98], [480, 54]];
  return (
    <svg width={620 * s} height={200 * s} viewBox="-10 -40 620 200" style={{position: 'absolute', left: 0, top: tall ? 24 * u : 12 * u, transformOrigin: '0 40%', transform: `rotate(${Math.sin(frame / 38) * 1.4}deg)`}}>
      {twigs.map((d, i) => <path key={i} d={d} fill="none" stroke={pal.light ? pal.ink : mix(pal.mist, pal.text, 0.15)} strokeWidth={i ? 4 : 9} strokeLinecap="round" pathLength={1} strokeDasharray={1} strokeDashoffset={1 - progress(draw, i * 0.18, 0.6, ease.cinematic)} />)}
      {blossoms.map(([x, y], i) => {
        const p = progress(frame, 34 + i * 4, 14, ease.overshoot);
        return (
          <g key={i} transform={`translate(${x} ${y}) scale(${p}) rotate(${frame * 0.2 + i * 40})`}>
            {[0, 1, 2, 3, 4].map(k => <circle key={k} cx={Math.cos((k / 5) * Math.PI * 2) * 7} cy={Math.sin((k / 5) * Math.PI * 2) * 7} r={6.5} fill={pal.accent} opacity={0.85} />)}
            <circle r={3} fill={pal.light ? pal.ink : pal.moon} />
          </g>
        );
      })}
    </svg>
  );
};

/** Red seal stamp with the chapter number. */
const Seal: React.FC<{pal: Pal; size: number; label: string; start: number}> = ({pal, size, label, start}) => {
  const frame = useCurrentFrame();
  const p = progress(frame, start, 12, ease.overshoot);
  return (
    <div style={{width: size, height: size, borderRadius: size * 0.12, background: pal.accent, color: pal.light ? '#fbf3e4' : pal.paper, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: fonts.serif, fontWeight: 700, fontSize: size * 0.42, transform: `rotate(${-6 + (1 - p) * 20}deg) scale(${1.8 - 0.8 * p})`, opacity: Math.min(1, p * 1.5), boxShadow: `inset 0 0 0 ${size * 0.06}px ${alpha(pal.light ? '#fbf3e4' : pal.paper, 0.7)}`}}>
      {label}
    </div>
  );
};

/** One chapter's overlay: vertical inscription with seal, and the ensō lens with an image or figure. */
const ChapterLayer: React.FC<{pal: Pal; lay: Layout; chapter: Chapter; timed: TimedScene; index: number; delay: number; endAt: number}> = ({pal, lay, chapter, timed, index, delay, endAt}) => {
  const frame = useCurrentFrame();
  const {width, height} = useVideoConfig();
  const {u} = lay;
  // frames are local to the SceneSeries layer; `delay` is where this chapter's narration starts
  const start = delay;
  const room = Math.max(24, endAt - start);
  const revealLen = Math.min(48, Math.max(14, room * 0.45));
  const chars = Array.from(chapter.heading);
  const hSize = Math.min(88 * u, lay.heading.room / Math.max(4, chars.length * 0.62));
  const sealSize = 64 * u;
  const image = timed.scene.video;
  const stat = chapter.stat;
  const hasLens = Boolean(image || stat);
  const ringDraw = progress(frame, start + 4, revealLen, ease.cinematic);
  const {x: lx, y: ly, r} = lay.lens;
  // fit the final formatted figure (plus its smaller unit) into the space it has
  const statChars = stat ? countUp(1, stat.value, 0, 1, stat.decimals).length + stat.unit.length * 0.45 + (stat.unit ? 0.4 : 0) : 4;
  const statRoom = image ? (lay.tall ? width * 0.64 : width * 0.3) : r * 1.5;
  const statSize = Math.min((image ? 88 : 108) * u, statRoom / (Math.max(3, statChars) * 0.58));
  const statBox: React.CSSProperties = image
    ? lay.tall
      ? {position: 'absolute', left: lx - width * 0.32, width: width * 0.64, top: ly + r + 34 * u, textAlign: 'center'}
      : {position: 'absolute', left: lx + r + 50 * u, width: width * 0.3, top: ly - 70 * u, textAlign: 'left'}
    : {position: 'absolute', left: lx - r * 0.85, width: r * 1.7, top: ly - statSize * 0.75, textAlign: 'center'};
  const statIn = progress(frame, start + revealLen * 0.5, 16);
  return (
    <AbsoluteFill>
      {/* vertical inscription */}
      <div style={{position: 'absolute', right: lay.heading.right, top: lay.heading.top, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 22 * u}}>
        <Seal pal={pal} size={sealSize} label={String(index + 1).padStart(2, '0')} start={start + 2} />
        <div style={{writingMode: 'vertical-rl', fontFamily: fonts.serifDisplay, fontSize: hSize, color: pal.text, letterSpacing: '0.1em', lineHeight: 1, whiteSpace: 'nowrap', textShadow: pal.light ? 'none' : `0 0 ${24 * u}px ${alpha(pal.paper, 0.8)}`}}>
          {chars.map((c, i) => {
            const p = progress(frame, start + 6 + i * Math.min(3, revealLen / Math.max(1, chars.length)), 16, ease.expo);
            return <span key={i} style={{display: 'inline-block', opacity: p, filter: `blur(${(1 - p) * 10}px)`, transform: `translateY(${(1 - p) * -14 * u}px)`}}>{c === ' ' ? ' ' : c}</span>;
          })}
        </div>
        <div style={{width: 2 * u, height: 90 * u * progress(frame, start + 14, revealLen, ease.cinematic), background: alpha(pal.text, 0.5)}} />
      </div>
      {hasLens ? (
        <>
          {image ? (
            <div style={{position: 'absolute', left: lx - r * 0.88, top: ly - r * 0.88, width: r * 1.76, height: r * 1.76, borderRadius: '50%', overflow: 'hidden', opacity: progress(frame, start + revealLen * 0.4, 18), transform: `scale(${0.92 + 0.08 * progress(frame, start + revealLen * 0.4, 30, ease.expo)})`}}>
              <AbsoluteFill style={{filter: pal.light ? 'grayscale(1) sepia(.35) contrast(1.1) brightness(1.05)' : 'saturate(.55) contrast(1.08) brightness(.9)'}}>
                <CameraImage src={image} isStatic={timed.scene.isStaticImage} move={(['push', 'pan-right', 'pull', 'pan-left'] as const)[index % 4]} />
              </AbsoluteFill>
              <AbsoluteFill style={{background: `radial-gradient(circle, transparent 55%, ${alpha(pal.paper, 0.55)} 100%)`}} />
            </div>
          ) : (
            <div style={{position: 'absolute', left: lx - r * 0.9, top: ly - r * 0.9, width: r * 1.8, height: r * 1.8, borderRadius: '50%', background: `radial-gradient(circle, ${alpha(pal.light ? pal.mist : pal.paper, 0.92)} 0%, ${alpha(pal.light ? pal.mist : pal.paper, 0.75)} 70%, transparent 100%)`, opacity: progress(frame, start + 4, revealLen * 0.6)}} />
          )}
          <svg width={width} height={height} style={{position: 'absolute', inset: 0, overflow: 'visible'}}>
            <defs>
              <filter id={`dfm-brush${index}`} x="-20%" y="-20%" width="140%" height="140%">
                <feTurbulence type="fractalNoise" baseFrequency="0.06" numOctaves={3} seed={index + 3} />
                <feDisplacementMap in="SourceGraphic" scale={14 * u} />
              </filter>
            </defs>
            <g filter={`url(#dfm-brush${index})`} transform={`rotate(${-118 + index * 37} ${lx} ${ly})`}>
              <circle cx={lx} cy={ly} r={r} fill="none" stroke={pal.light ? pal.ink : pal.text} strokeWidth={20 * u} strokeLinecap="round" pathLength={1} strokeDasharray={`${ringDraw * 0.94} 1`} opacity={pal.light ? 0.88 : 0.82} />
              <circle cx={lx + 4 * u} cy={ly - 3 * u} r={r * 0.985} fill="none" stroke={pal.light ? pal.ink : pal.text} strokeWidth={6 * u} strokeLinecap="round" pathLength={1} strokeDasharray={`${ringDraw * 0.86} 1`} opacity={0.5} />
            </g>
          </svg>
          {stat ? (
            <div style={{...statBox, opacity: statIn, transform: `translateY(${(1 - statIn) * 20 * u}px)`}}>
              <div style={{fontFamily: fonts.serifDisplay, fontSize: statSize, lineHeight: 1, color: image ? pal.text : pal.light ? pal.ink : pal.text, whiteSpace: 'nowrap', textShadow: pal.light ? 'none' : `0 0 ${30 * u}px ${alpha(pal.paper, 0.9)}`}}>
                {countUp(frame, stat.value, start + revealLen * 0.5, Math.max(12, revealLen * 1.1), stat.decimals)}
                {stat.unit ? <span style={{fontFamily: fonts.serif, fontStyle: 'italic', fontSize: statSize * 0.42, marginLeft: 10 * u, color: pal.accent}}>{stat.unit}</span> : null}
              </div>
              {stat.label ? <div style={{marginTop: 12 * u, fontFamily: fonts.serif, fontStyle: 'italic', fontSize: 34 * u, lineHeight: 1.2, color: pal.muted}}>{stat.label}</div> : null}
            </div>
          ) : null}
        </>
      ) : null}
    </AbsoluteFill>
  );
};

const FestivalMoon: React.FC<EntryProps<Props>> = ({media, props}) => {
  const frame = useCurrentFrame();
  const {fps, width, height} = useVideoConfig();
  const look = useLook();
  const base = look ? fromLook(look) : PALETTES[props.palette];
  const pal: Pal = look ? base : {...base, accent: media.accent ?? base.accent};
  const lay = useLayout(look);
  const {u} = lay;
  const timeline = useSceneTimeline(media);
  const contentEnd = useContentFrames(media);
  const overlap = Math.round(0.8 * fps);
  const titleLen = Math.min(Math.round(3.4 * fps), timeline[0]?.durationInFrames ?? 2 * fps);
  const chapterAt = (i: number): Chapter | null => props.chapters[i] ?? null;
  const phaseOf = (i: number) => PHASE_T[(chapterAt(i) ?? props.chapters[props.chapters.length - 1]).phase];
  const eclOf = (i: number) => ((chapterAt(i) ?? props.chapters[props.chapters.length - 1]).phase === 'eclipse' ? 1 : 0);
  // camera pan, orb phase and eclipse glide between chapters, timed to each narration cut
  let pan = PAN[0] * width * 0.05;
  let phase = phaseOf(0);
  let eclipse = eclOf(0);
  for (let i = 1; i < timeline.length; i++) {
    const p = progress(frame, timeline[i].from - overlap / 2, overlap * 1.8, ease.cinematic);
    pan += (PAN[i % PAN.length] - PAN[(i - 1) % PAN.length]) * width * 0.05 * p;
    phase += ((((phaseOf(i) - phaseOf(i - 1) + 1.5) % 1) + 1) % 1 - 0.5) * p;
    eclipse += (eclOf(i) - eclOf(i - 1)) * p;
  }
  const rise = tween(frame, [0, titleLen * 0.95], [height * 0.16, 0], ease.cinematic);
  const push = tween(frame, [0, Math.max(1, contentEnd)], [1, 1.06], ease.cinematic);
  const titleOut = 1 - progress(frame, titleLen - 14, 14, ease.cinematic);
  const titleSize = Math.min((lay.tall ? 118 : 104) * u, (width * 1.5) / Math.max(8, props.title.length));
  return (
    <AbsoluteFill style={{background: pal.paper, overflow: 'hidden'}}>
      <AbsoluteFill style={{transform: `scale(${push})`, transformOrigin: '50% 40%'}}>
        <Painting pal={pal} props={props} lay={lay} pan={pan} phase={phase} eclipse={eclipse} rise={rise} />
      </AbsoluteFill>
      <Branch pal={pal} u={u} tall={lay.tall} />
      <Particles count={30} color={pal.light ? pal.ink : pal.glow} opacity={pal.light ? 0.12 : 0.35} seed="fm" speed={0.25} size={[1.5, 4]} />
      <SceneSeries
        media={media}
        overlap={overlap}
        transition="blur"
        renderScene={({index, timed}) => {
          const chapter = chapterAt(index);
          if (!chapter) return null;
          const layerStart = index === 0 ? 0 : timed.from - Math.floor(overlap / 2);
          const delay = index === 0 ? titleLen - 4 : timed.from - layerStart;
          const endAt = Math.min(timed.from + timed.durationInFrames, contentEnd) - layerStart;
          return <ChapterLayer pal={pal} lay={lay} chapter={chapter} timed={timed} index={index} delay={delay} endAt={endAt} />;
        }}
      />
      {/* title card over the moonrise */}
      <Sequence durationInFrames={titleLen}>
        <AbsoluteFill style={{opacity: titleOut}}>
          <div style={{position: 'absolute', left: '8%', right: '8%', top: lay.title - titleSize, textAlign: 'center'}}>
            <div style={{fontFamily: fonts.mono, fontSize: 22 * u, letterSpacing: '0.42em', color: pal.muted, opacity: progress(frame, 2, 20), marginBottom: 26 * u}}>{props.chapters.length} CHAPTERS</div>
            <div style={{fontFamily: fonts.serifDisplay, color: pal.text, fontSize: titleSize, lineHeight: 1.08, letterSpacing: `${tween(frame, [0, titleLen], [0.14, 0.04], ease.cinematic)}em`, opacity: progress(frame, 4, 28, ease.cinematic), filter: `blur(${(1 - progress(frame, 4, 30, ease.expo)) * 14}px)`, textShadow: pal.light ? 'none' : `0 6px 40px ${alpha(pal.paper, 0.8)}`}}>{props.title}</div>
            <div style={{margin: `${26 * u}px auto 0`, width: 160 * u * progress(frame, 16, 24, ease.cinematic), height: 3 * u, background: pal.accent}} />
            {props.subtitle ? <KineticText text={props.subtitle} start={26} stagger={3} style="blur" align="center" textStyle={{fontFamily: fonts.serif, fontStyle: 'italic', color: pal.muted, fontSize: 40 * u, marginTop: 26 * u}} /> : null}
          </div>
        </AbsoluteFill>
      </Sequence>
      <LightLeak from={0} durationInFrames={Math.round(2.6 * fps)} seed={11} opacity={pal.light ? 0.25 : 0.45} hueShift={10} />
      {timeline.slice(1).map(t => <LightLeak key={t.index} from={t.from - Math.round(overlap * 0.6)} durationInFrames={Math.round(overlap * 1.6)} seed={t.index * 5 + 2} opacity={pal.light ? 0.18 : 0.3} />)}
      {props.showCaptions
        ? timeline.map(t => (
            <Sequence key={t.index} from={t.from} durationInFrames={t.durationInFrames}>
              <AbsoluteFill style={{justifyContent: 'flex-end', padding: lay.tall ? '0 8% 9%' : '0 16% 5%', opacity: frame >= titleLen ? 1 : 0}}>
                <StyledCaptions scene={t.scene} variant={pal.light ? 'minimal' : 'karaoke'} accent={pal.light ? pal.accent : pal.glow} color={pal.light ? pal.ink : alpha(pal.text, 0.6)} font={fonts.serif} size={(lay.tall ? 54 : 46) * u} words={lay.tall ? 6 : 8} weight={700} shadow={!pal.light} />
              </AbsoluteFill>
            </Sequence>
          ))
        : null}
      <Vignette strength={pal.light ? 0.3 : 0.6} color={pal.light ? '#3a2e1c' : '#000'} />
      <Grain opacity={pal.light ? 0.09 : 0.07} />
      <NarrationTrack media={media} />
      <AdWeave media={media} theme={{background: pal.paper, text: pal.text, font: fonts.serif}} />
    </AbsoluteFill>
  );
};

export default defineEntry({
  id: 'documentary-festival-moon',
  schema: Props,
  component: FestivalMoon,
  // Shared captions wait for the title card, like the template's own captions.
  captionHold: ({media, fps}) => Math.min(Math.round(3.4 * fps), Math.round((media.scenes[0]?.audio.duration ?? 2) * fps)),
});
