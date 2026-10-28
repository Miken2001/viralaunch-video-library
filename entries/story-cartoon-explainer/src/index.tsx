import React from 'react';
import {AbsoluteFill, Sequence, spring, useCurrentFrame, useVideoConfig} from 'remotion';
import {AdWeave, NarrationTrack, activeWord, captionSafeBottom, defineEntry, evenCaptions, mix, useContentFrames, useLook, useSceneTimeline, type ActiveLook, type EntryProps} from '@viralaunch/kit';
import {Grain, KineticText, LightLeak, Particles, StyledCaptions, Vignette, alpha, ease, fonts, progress, rand, tween} from '@viralaunch/kit/fx';
import {Props, type Action, type HostKind, type PropKind} from './schema';

type Pal = {
  sky: string; sky2: string; sun: string; hillFar: string; hillNear: string; ground: string; ground2: string;
  ink: string; title: string; bubble: string; bubbleText: string; edge: string;
  accent: string; accent2: string; host: string; host2: string; caption: string; flat: boolean;
};

const PALETTES: Record<Props['palette'], Pal> = {
  saturday: {sky: '#4dbdf0', sky2: '#c9f1ff', sun: '#fff1a8', hillFar: '#8fdc9a', hillNear: '#5cc272', ground: '#46a85c', ground2: '#2f8a48', ink: '#1d1830', title: '#fffaf0', bubble: '#ffffff', bubbleText: '#1d1830', edge: '#1d1830', accent: '#ff4f9a', accent2: '#ffd23f', host: '#ff8a3d', host2: '#7c5cff', caption: '#ffffff', flat: false},
  dusk: {sky: '#2a1d5c', sky2: '#ff9466', sun: '#ffd27a', hillFar: '#6b3f8f', hillNear: '#4a2c70', ground: '#33204f', ground2: '#241639', ink: '#120b22', title: '#fff4e2', bubble: '#fff4e2', bubbleText: '#1a1230', edge: '#120b22', accent: '#ffcc33', accent2: '#ff6fa8', host: '#3fd4c4', host2: '#ff6fa8', caption: '#fff4e2', flat: false},
  chalk: {sky: '#f3e9d2', sky2: '#fbf6ea', sun: '#ffd58a', hillFar: '#e6d7b3', hillNear: '#d6c193', ground: '#c9b07a', ground2: '#b39761', ink: '#2b2520', title: '#fffaf0', bubble: '#fffdf7', bubbleText: '#2b2520', edge: '#2b2520', accent: '#e8553d', accent2: '#ffc83d', host: '#4fb6e8', host2: '#e8553d', caption: '#2b2520', flat: true},
};

/** The cartoon set in a sequence's shared look: sky, hills and ground from the look's background family. */
const fromLook = (l: ActiveLook): Pal => {
  const light = l.tone === 'light';
  const p = l.palette;
  return {
    sky: p.bg,
    sky2: mix(p.bg2, p.accent, 0.12),
    sun: mix(p.accent, p.bg, 0.25),
    hillFar: mix(p.bg2, p.accent, light ? 0.16 : 0.22),
    hillNear: mix(p.bg2, p.text, light ? 0.12 : 0.1),
    ground: mix(p.bg, p.text, light ? 0.18 : 0.08),
    ground2: mix(p.bg, p.text, light ? 0.26 : 0.04),
    ink: light ? p.text : '#09080b',
    title: light ? p.surface : p.text,
    bubble: light ? p.surface : mix(p.surface, p.text, 0.08),
    bubbleText: p.text,
    edge: light ? p.text : mix(p.line, p.bg, 0.45),
    accent: p.accent,
    accent2: mix(p.accent, '#ffffff', 0.35),
    host: p.accent,
    host2: mix(p.accent, p.bg2, 0.5),
    caption: p.text,
    flat: light,
  };
};

const luma = (hex: string) => {
  const n = parseInt(hex.slice(1, 7), 16);
  return (0.299 * ((n >> 16) & 255) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255)) / 255;
};
const onFill = (hex: string) => (luma(hex) > 0.55 ? '#1a1620' : '#ffffff');
/** Cartoon outline for HTML text: eight hard offsets plus a drop shadow. */
const outline = (color: string, w: number, drop: number) =>
  [...Array.from({length: 8}, (_, i) => `${(Math.cos((i * Math.PI) / 4) * w).toFixed(1)}px ${(Math.sin((i * Math.PI) / 4) * w).toFixed(1)}px 0 ${color}`), `0 ${drop}px 0 ${color}`].join(', ');

// ---------------------------------------------------------------------------------------------
// Host character (rig drawn in a 200 × 260 box, feet at the bottom)
// ---------------------------------------------------------------------------------------------

type Pt = [number, number];
type Mood = 'calm' | 'shock' | 'happy' | 'think';
type Rig = {eyes: [Pt, Pt]; eyeR: Pt; mouth: Pt; shoulders: [Pt, Pt]; hips: [Pt, Pt]};

const RIGS: Record<HostKind, Rig> = {
  blob: {eyes: [[80, 100], [122, 100]], eyeR: [15, 19], mouth: [101, 138], shoulders: [[44, 152], [156, 152]], hips: [[78, 234], [122, 234]]},
  robot: {eyes: [[80, 78], [120, 78]], eyeR: [13, 15], mouth: [100, 106], shoulders: [[54, 152], [146, 152]], hips: [[78, 230], [122, 230]]},
  professor: {eyes: [[82, 86], [118, 86]], eyeR: [10, 12], mouth: [100, 114], shoulders: [[66, 150], [134, 150]], hips: [[82, 238], [118, 238]]},
};

/** Hand targets [back hand, front hand] per action. The host faces right, toward the prop. */
const POSES: Record<Action | 'idle', [Pt, Pt]> = {
  idle: [[34, 206], [168, 206]],
  point: [[38, 206], [236, 112]],
  explain: [[0, 158], [204, 150]],
  think: [[40, 206], [112, 134]],
  wave: [[36, 206], [186, 58]],
  cheer: [[14, 54], [188, 54]],
  shock: [[6, 104], [194, 104]],
};
const MOODS: Record<Action | 'idle', Mood> = {idle: 'calm', point: 'calm', explain: 'calm', think: 'think', wave: 'calm', cheer: 'happy', shock: 'shock'};

const Arm: React.FC<{from: Pt; to: Pt; bend: number; ink: string; color: string; hand: string}> = ({from, to, bend, ink, color, hand}) => {
  const [sx, sy] = from;
  const [hx, hy] = to;
  const len = Math.hypot(hx - sx, hy - sy) || 1;
  const cx = (sx + hx) / 2 + (-(hy - sy) / len) * bend;
  const cy = (sy + hy) / 2 + ((hx - sx) / len) * bend;
  const d = `M${sx},${sy} Q${cx.toFixed(1)},${cy.toFixed(1)} ${hx.toFixed(1)},${hy.toFixed(1)}`;
  return (
    <g>
      <path d={d} fill="none" stroke={ink} strokeWidth={17} strokeLinecap="round" />
      <path d={d} fill="none" stroke={color} strokeWidth={9} strokeLinecap="round" />
      <circle cx={hx} cy={hy} r={12} fill={hand} stroke={ink} strokeWidth={4.5} />
    </g>
  );
};

const HostBody: React.FC<{kind: HostKind; pal: Pal; frame: number}> = ({kind, pal, frame}) => {
  const ink = pal.ink;
  if (kind === 'robot') {
    const blink = Math.floor(frame / 12) % 3 === 0;
    return (
      <g stroke={ink} strokeWidth={6} strokeLinejoin="round">
        <line x1={100} y1={40} x2={100} y2={18} strokeWidth={5} />
        <circle cx={100} cy={14} r={10} fill={blink ? pal.accent2 : pal.accent} />
        <rect x={86} y={122} width={28} height={16} fill="#9aa7b8" />
        <rect x={50} y={134} width={100} height={98} rx={18} fill={pal.host} />
        <rect x={70} y={152} width={60} height={40} rx={10} fill={mix(pal.host, '#ffffff', 0.55)} strokeWidth={4} />
        {[0, 1, 2].map(i => (
          <circle key={i} cx={82 + i * 18} cy={172} r={5} fill={i === Math.floor(frame / 8) % 3 ? pal.accent2 : mix(pal.host, '#000000', 0.25)} strokeWidth={3} />
        ))}
        <rect x={44} y={40} width={112} height={86} rx={22} fill="#d6dee8" />
        <rect x={56} y={52} width={88} height={64} rx={14} fill="#26324a" strokeWidth={4} />
        <circle cx={44} cy={84} r={9} fill="#9aa7b8" />
        <circle cx={156} cy={84} r={9} fill="#9aa7b8" />
      </g>
    );
  }
  if (kind === 'professor') {
    return (
      <g stroke={ink} strokeWidth={6} strokeLinejoin="round">
        <path d="M66 140 L134 140 L150 242 L50 242 Z" fill="#ffffff" />
        <path d="M84 140 L100 176 L116 140 Z" fill={pal.host} strokeWidth={4} />
        <path d="M100 176 L100 238" strokeWidth={3.5} />
        <rect x={112} y={190} width={22} height={18} rx={4} fill={mix('#ffffff', pal.host, 0.25)} strokeWidth={3.5} />
        <rect x={90} y={122} width={20} height={20} fill="#f6c8a0" strokeWidth={4} />
        {[[48, 74, 18], [56, 46, 20], [80, 28, 20], [118, 28, 20], [144, 46, 20], [152, 74, 18]].map(([x, y, r], i) => (
          <circle key={i} cx={x} cy={y} r={r} fill="#f1f1f4" />
        ))}
        <circle cx={100} cy={86} r={48} fill="#f6c8a0" />
        <path d="M58 60 Q100 30 142 60 Q120 46 100 50 Q80 46 58 60 Z" fill="#f1f1f4" strokeWidth={4} />
        <circle cx={70} cy={104} r={7} fill={alpha('#ff7a8a', 0.5)} stroke="none" />
        <circle cx={130} cy={104} r={7} fill={alpha('#ff7a8a', 0.5)} stroke="none" />
      </g>
    );
  }
  return (
    <g stroke={ink} strokeWidth={6} strokeLinejoin="round">
      <path d="M101 42 C104 26 112 18 118 12" fill="none" strokeWidth={5} />
      <path d="M118 12 C132 2 146 8 148 14 C138 22 126 22 118 12 Z" fill="#6bd16f" strokeWidth={4} />
      <path d="M100 40 C152 40 172 102 170 160 C168 222 140 242 100 242 C60 242 32 222 30 160 C28 102 48 40 100 40 Z" fill={pal.host} />
      <ellipse cx={100} cy={190} rx={44} ry={38} fill={mix(pal.host, '#ffffff', 0.45)} stroke="none" />
      <circle cx={62} cy={126} r={9} fill={alpha('#ff5d8f', 0.45)} stroke="none" />
      <circle cx={140} cy={126} r={9} fill={alpha('#ff5d8f', 0.45)} stroke="none" />
    </g>
  );
};

const Host: React.FC<{kind: HostKind; pal: Pal; pose: [Pt, Pt]; mood: Mood; talk: number; walk: number; frame: number}> = ({kind, pal, pose, mood, talk, walk, frame}) => {
  const rig = RIGS[kind];
  const ink = pal.ink;
  const armColor = kind === 'robot' ? '#c9d3df' : kind === 'professor' ? '#ffffff' : pal.host;
  const handColor = kind === 'robot' ? '#9aa7b8' : kind === 'professor' ? '#f6c8a0' : mix(pal.host, '#ffffff', 0.3);
  const blink = frame % 97 < 4 || (frame + 41) % 151 < 3;
  const look: Pt = mood === 'think' ? [3, -5] : mood === 'shock' ? [0, 0] : [4, 1];
  const eyeScale = mood === 'shock' ? 1.25 : 1;
  const [mx, my] = rig.mouth;
  const swing = (i: number) => Math.sin(frame * 0.55 + i * Math.PI) * 12 * walk;
  return (
    <svg viewBox="0 0 200 260" width="100%" height="100%" style={{overflow: 'visible'}}>
      {/* legs */}
      {rig.hips.map(([hx, hy], i) => {
        const fx = hx + swing(i);
        const lift = Math.max(0, -Math.sin(frame * 0.55 + i * Math.PI)) * 8 * walk;
        return (
          <g key={i}>
            <path d={`M${hx},${hy - 6} L${fx.toFixed(1)},${(254 - lift).toFixed(1)}`} stroke={ink} strokeWidth={12} strokeLinecap="round" />
            <ellipse cx={fx + 7} cy={256 - lift} rx={16} ry={8} fill={ink} />
          </g>
        );
      })}
      <Arm from={rig.shoulders[0]} to={pose[0]} bend={-16} ink={ink} color={armColor} hand={handColor} />
      <HostBody kind={kind} pal={pal} frame={frame} />
      {/* eyes */}
      {rig.eyes.map(([x, y], i) =>
        mood === 'happy' ? (
          <path key={i} d={`M${x - 11},${y + 4} Q${x},${y - 10} ${x + 11},${y + 4}`} fill="none" stroke={ink} strokeWidth={5.5} strokeLinecap="round" />
        ) : (
          <g key={i} transform={`translate(${x} ${y}) scale(${eyeScale} ${blink ? 0.12 : eyeScale})`}>
            <ellipse rx={rig.eyeR[0]} ry={rig.eyeR[1]} fill="#ffffff" stroke={ink} strokeWidth={4} />
            <circle cx={look[0]} cy={look[1]} r={mood === 'shock' ? 3.5 : rig.eyeR[0] * 0.48} fill={ink} />
            <circle cx={look[0] + 2.5} cy={look[1] - 3} r={2.2} fill="#ffffff" />
          </g>
        ),
      )}
      {kind === 'professor'
        ? rig.eyes.map(([x, y], i) => <circle key={`g${i}`} cx={x} cy={y} r={17} fill="none" stroke={ink} strokeWidth={4} />)
        : null}
      {kind === 'professor' ? <path d={`M${rig.eyes[0][0] + 17},${rig.eyes[0][1]} L${rig.eyes[1][0] - 17},${rig.eyes[1][1]}`} stroke={ink} strokeWidth={4} /> : null}
      {/* mouth */}
      {mood === 'happy' ? (
        <path d={`M${mx - 17},${my - 4} Q${mx},${my + 22} ${mx + 17},${my - 4} Z`} fill="#5a1f2b" stroke={ink} strokeWidth={4} strokeLinejoin="round" />
      ) : mood === 'shock' ? (
        <ellipse cx={mx} cy={my + 2} rx={9} ry={12} fill="#5a1f2b" stroke={ink} strokeWidth={4} />
      ) : talk > 0.12 ? (
        <g>
          <ellipse cx={mx} cy={my + 2} rx={12} ry={3 + 10 * talk} fill="#5a1f2b" stroke={ink} strokeWidth={4} />
          <ellipse cx={mx} cy={my + 2 + 6 * talk} rx={6} ry={2 + 2.5 * talk} fill="#ff7a8a" />
        </g>
      ) : (
        <path d={`M${mx - 13},${my - 2} Q${mx},${my + 9} ${mx + 13},${my - 2}`} fill="none" stroke={ink} strokeWidth={5} strokeLinecap="round" />
      )}
      <Arm from={rig.shoulders[1]} to={pose[1]} bend={16} ink={ink} color={armColor} hand={handColor} />
      {mood === 'think'
        ? [[152, 40, 6], [168, 18, 9], [190, -10, 13]].map(([x, y, r], i) => (
            <circle key={i} cx={x} cy={y + Math.sin(frame / 9 + i) * 2} r={r} fill={pal.bubble} stroke={ink} strokeWidth={4} opacity={Math.min(1, Math.max(0, (frame % 60) / 6 - i))} />
          ))
        : null}
      {mood === 'shock' ? <path d="M166 58 C172 70 176 76 176 82 C176 90 160 90 160 82 C160 76 162 70 166 58 Z" fill="#8fd8ff" stroke={ink} strokeWidth={3.5} /> : null}
    </svg>
  );
};

// ---------------------------------------------------------------------------------------------
// Cartoon props (drawn in a -100..100 box, with their own idle motion)
// ---------------------------------------------------------------------------------------------

const Face: React.FC<{x: number; y: number; s?: number; ink: string; t: number; seed: number}> = ({x, y, s = 1, ink, t, seed}) => {
  const blink = (t + seed * 37) % 110 < 4;
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`}>
      <ellipse cx={-14} cy={-4} rx={5} ry={blink ? 1 : 7} fill={ink} />
      <ellipse cx={14} cy={-4} rx={5} ry={blink ? 1 : 7} fill={ink} />
      <path d="M-10 9 Q0 18 10 9" fill="none" stroke={ink} strokeWidth={4.5} strokeLinecap="round" />
      <circle cx={-24} cy={8} r={5} fill={alpha('#ff5d8f', 0.45)} />
      <circle cx={24} cy={8} r={5} fill={alpha('#ff5d8f', 0.45)} />
    </g>
  );
};

/** Puffy outline-then-fill circles (cloud, tree canopy): one clean silhouette with a thick rim. */
const Puff: React.FC<{circles: number[][]; fill: string; ink: string; rim?: number}> = ({circles, fill, ink, rim = 6}) => (
  <g>
    {circles.map(([x, y, r], i) => <circle key={`o${i}`} cx={x} cy={y} r={r + rim / 2} fill={ink} />)}
    {circles.map(([x, y, r], i) => <circle key={`f${i}`} cx={x} cy={y} r={r - rim / 2} fill={fill} />)}
  </g>
);

const FLOATING: PropKind[] = ['sun', 'cloud', 'drop', 'atom', 'dna', 'cell', 'heart', 'bolt', 'planet', 'moon', 'earth'];

const CartoonProp: React.FC<{kind: PropKind; t: number; fps: number; ink: string; accent: string}> = ({kind, t, fps, ink, accent}) => {
  const sw = 6;
  const st = {stroke: ink, strokeWidth: sw, strokeLinejoin: 'round' as const, strokeLinecap: 'round' as const};
  switch (kind) {
    case 'sun':
      return (
        <g>
          <g transform={`rotate(${t * 0.9})`}>
            {Array.from({length: 12}, (_, i) => (
              <path key={i} transform={`rotate(${i * 30})`} d="M-12 -60 L0 -94 L12 -60 Z" fill="#ffb32c" {...st} strokeWidth={5} />
            ))}
          </g>
          <circle r={56} fill="#ffd93b" {...st} />
          <Face x={0} y={4} s={1.2} ink={ink} t={t} seed={1} />
        </g>
      );
    case 'cloud':
      return (
        <g transform={`translate(0 ${Math.sin(t / 12) * 4})`}>
          <Puff circles={[[-50, 14, 30], [-14, -14, 42], [32, -2, 38], [4, 22, 34], [-30, 28, 26], [56, 26, 26]]} fill="#ffffff" ink={ink} rim={10} />
          <Face x={2} y={10} ink={ink} t={t} seed={2} />
        </g>
      );
    case 'drop': {
      const sq = Math.sin(t / 7) * 0.04;
      return (
        <g transform={`scale(${1 + sq} ${1 - sq})`}>
          <path d="M0 -84 C20 -50 58 -14 58 24 C58 58 32 82 0 82 C-32 82 -58 58 -58 24 C-58 -14 -20 -50 0 -84 Z" fill="#4fb8ff" {...st} />
          <ellipse cx={-28} cy={6} rx={8} ry={18} fill="#ffffff" opacity={0.7} transform="rotate(20 -28 6)" />
          <Face x={4} y={36} ink={ink} t={t} seed={3} />
        </g>
      );
    }
    case 'ice': {
      const drip = (t % 40) / 40;
      return (
        <g>
          <path d="M-40 66 L40 66" stroke={ink} strokeWidth={3} opacity={0.3} />
          <path d="M-58 -26 L-30 -54 L58 -54 L30 -26 Z" fill="#e6fbff" {...st} />
          <path d="M30 -26 L58 -54 L58 38 L30 66 Z" fill="#8fd8f2" {...st} />
          <rect x={-58} y={-26} width={88} height={92} rx={6} fill="#bfefff" {...st} />
          <path d="M-46 -12 L-46 14" stroke="#ffffff" strokeWidth={6} strokeLinecap="round" />
          <Face x={-14} y={24} ink={ink} t={t} seed={4} />
          <path d={`M44 ${46 + drip * 40} C48 ${54 + drip * 40} 50 ${58 + drip * 40} 44 ${62 + drip * 40} C38 ${58 + drip * 40} 40 ${54 + drip * 40} 44 ${46 + drip * 40} Z`} fill="#4fb8ff" stroke={ink} strokeWidth={3} opacity={1 - drip} />
        </g>
      );
    }
    case 'flame': {
      const sx = 1 + Math.sin(t * 0.9) * 0.05;
      const sy = 1 + Math.sin(t * 0.7 + 1) * 0.08;
      const flame = 'M0 -88 C22 -56 62 -28 56 22 C52 60 26 82 0 82 C-26 82 -54 60 -56 22 C-58 -12 -32 -26 -22 -58 C-8 -34 -4 -40 0 -88 Z';
      return (
        <g transform={`translate(0 82) scale(${sx} ${sy}) translate(0 -82)`}>
          <path d={flame} fill="#ff6a2b" {...st} />
          <path d={flame} fill="#ffc83d" transform={`translate(0 34) scale(0.55) skewX(${Math.sin(t * 0.6) * 6})`} />
        </g>
      );
    }
    case 'plant': {
      const g = tween(t, [6, 6 + fps * 1.6], [0, 1], ease.cinematic);
      const top = 20 - 120 * g;
      const leaf = (at: number) => progress(t, 6 + fps * 1.6 * at, 14, ease.overshoot);
      const bloom = progress(t, 8 + fps * 1.6, 16, ease.overshoot);
      return (
        <g>
          <g transform={`rotate(${Math.sin(t / 15) * 3} 0 20)`}>
            <path d={`M0 22 Q-8 ${(22 + top) / 2} 0 ${top}`} fill="none" stroke={ink} strokeWidth={12} strokeLinecap="round" />
            <path d={`M0 22 Q-8 ${(22 + top) / 2} 0 ${top}`} fill="none" stroke="#4cc26b" strokeWidth={5} strokeLinecap="round" />
            <ellipse cx={-22} cy={-10} rx={24} ry={11} fill="#6bd16f" {...st} strokeWidth={4.5} transform={`rotate(-30 -2 -4) scale(${leaf(0.35)})`} style={{transformOrigin: '0px -4px'}} />
            <ellipse cx={22} cy={-44} rx={24} ry={11} fill="#6bd16f" {...st} strokeWidth={4.5} transform={`rotate(30 2 -40) scale(${leaf(0.6)})`} style={{transformOrigin: '0px -40px'}} />
            <g transform={`translate(0 ${top}) scale(${bloom})`}>
              {Array.from({length: 6}, (_, i) => <circle key={i} cx={Math.cos((i * Math.PI) / 3) * 16} cy={Math.sin((i * Math.PI) / 3) * 16} r={12} fill="#ff7eb6" stroke={ink} strokeWidth={4} />)}
              <circle r={10} fill="#ffd93b" stroke={ink} strokeWidth={4} />
            </g>
          </g>
          <rect x={-48} y={16} width={96} height={18} rx={4} fill="#e2834a" {...st} />
          <path d="M-40 34 L40 34 L30 86 L-30 86 Z" fill="#d9733f" {...st} />
        </g>
      );
    }
    case 'tree':
      return (
        <g transform={`rotate(${Math.sin(t / 18) * 2.5} 0 86)`}>
          <path d="M-14 86 L-10 10 L10 10 L14 86 Z" fill="#9a6a3f" {...st} />
          <Puff circles={[[0, -38, 46], [-38, -6, 34], [38, -6, 34], [0, 6, 30]]} fill="#4cc26b" ink={ink} rim={10} />
          {[[-30, -20], [20, -46], [34, 4]].map(([x, y], i) => <circle key={i} cx={x} cy={y} r={7} fill="#ff4f4f" stroke={ink} strokeWidth={3} />)}
        </g>
      );
    case 'atom':
      return (
        <g>
          {[0, 60, 120].map(r => <ellipse key={r} rx={88} ry={30} fill="none" stroke={ink} strokeWidth={4.5} transform={`rotate(${r})`} />)}
          {[[-9, -6, '#ff5d5d'], [9, -6, '#4f8bff'], [0, 8, '#ff5d5d'], [-10, 10, '#4f8bff'], [10, 10, '#ff5d5d']].map(([x, y, c], i) => (
            <circle key={i} cx={x as number} cy={y as number} r={11} fill={c as string} stroke={ink} strokeWidth={4} />
          ))}
          {[0, 1, 2].map(i => {
            const a = t * 0.13 + i * 2.1;
            const r = (i * 60 * Math.PI) / 180;
            const ex = 88 * Math.cos(a);
            const ey = 30 * Math.sin(a);
            return <circle key={i} cx={ex * Math.cos(r) - ey * Math.sin(r)} cy={ex * Math.sin(r) + ey * Math.cos(r)} r={9} fill="#ffd93b" stroke={ink} strokeWidth={3.5} />;
          })}
        </g>
      );
    case 'dna': {
      const ys = Array.from({length: 18}, (_, i) => -88 + i * (176 / 17));
      const x = (y: number) => 42 * Math.sin(y / 24 + t * 0.09);
      const strand = (s: number) => ys.map((y, i) => `${i ? 'L' : 'M'}${(s * x(y)).toFixed(1)},${y.toFixed(1)}`).join(' ');
      return (
        <g>
          {ys.filter((_, i) => i % 2 === 0).map((y, i) => (
            <line key={i} x1={x(y)} x2={-x(y)} y1={y} y2={y} stroke={i % 2 ? '#7be08a' : '#ffd93b'} strokeWidth={7} opacity={0.95} />
          ))}
          {[1, -1].map(s => (
            <g key={s}>
              <path d={strand(s)} fill="none" stroke={ink} strokeWidth={13} strokeLinecap="round" strokeLinejoin="round" />
              <path d={strand(s)} fill="none" stroke={s > 0 ? '#ff5d8f' : '#4f8bff'} strokeWidth={6} strokeLinecap="round" strokeLinejoin="round" />
            </g>
          ))}
        </g>
      );
    }
    case 'cell': {
      const pts = Array.from({length: 28}, (_, i) => {
        const a = (i / 28) * Math.PI * 2;
        const r = 74 + 5 * Math.sin(a * 3 + t * 0.15) + 3 * Math.sin(a * 5 - t * 0.1);
        return [Math.cos(a) * r, Math.sin(a) * r * 0.86];
      });
      const d = pts.map((p, i) => {
        const n = pts[(i + 1) % pts.length];
        return `${i ? '' : `M${((p[0] + pts[pts.length - 1][0]) / 2).toFixed(1)},${((p[1] + pts[pts.length - 1][1]) / 2).toFixed(1)} `}Q${p[0].toFixed(1)},${p[1].toFixed(1)} ${((p[0] + n[0]) / 2).toFixed(1)},${((p[1] + n[1]) / 2).toFixed(1)}`;
      }).join(' ') + ' Z';
      return (
        <g>
          <path d={d} fill="#a6e88a" {...st} />
          <circle cx={14} cy={-8} r={25} fill="#7c5cff" stroke={ink} strokeWidth={4.5} />
          <circle cx={20} cy={-14} r={7} fill="#b9a6ff" />
          {[[-38, 18, 20], [-26, -32, -30], [36, 36, 10]].map(([x, y, r], i) => (
            <ellipse key={i} cx={x} cy={y} rx={14} ry={7} fill="#ff9a4d" stroke={ink} strokeWidth={3.5} transform={`rotate(${r + Math.sin(t / 10 + i) * 8} ${x} ${y})`} />
          ))}
        </g>
      );
    }
    case 'heart': {
      const ph = (t % Math.round(fps * 0.9)) / Math.round(fps * 0.9);
      const bump = (a: number, b: number) => (ph >= a && ph < b ? Math.sin(((ph - a) / (b - a)) * Math.PI) : 0);
      const s = 1 + 0.1 * bump(0, 0.14) + 0.06 * bump(0.2, 0.32);
      return (
        <g transform={`scale(${s})`}>
          <path d="M0 76 C-40 46 -86 16 -86 -24 C-86 -56 -60 -76 -36 -76 C-16 -76 -5 -62 0 -50 C5 -62 16 -76 36 -76 C60 -76 86 -56 86 -24 C86 16 40 46 0 76 Z" fill="#ff4f6d" {...st} />
          <ellipse cx={-46} cy={-38} rx={10} ry={16} fill="#ffffff" opacity={0.6} transform="rotate(35 -46 -38)" />
          <Face x={0} y={-6} ink={ink} t={t} seed={5} />
        </g>
      );
    }
    case 'magnet':
      return (
        <g>
          {[0, 1, 2].map(j => {
            const ph = ((t * 0.025 + j / 3) % 1 + 1) % 1;
            return <path key={j} d={`M-50 78 Q0 ${78 + 30 + 90 * ph} 50 78`} fill="none" stroke={accent} strokeWidth={5} strokeDasharray="10 10" opacity={(1 - ph) * 0.9} />;
          })}
          <path d="M-50 60 L-50 -10 A50 50 0 0 1 50 -10 L50 60" fill="none" stroke={ink} strokeWidth={50} />
          <path d="M-50 60 L-50 -10 A50 50 0 0 1 50 -10 L50 60" fill="none" stroke="#ff4f4f" strokeWidth={36} />
          <rect x={-70} y={44} width={40} height={30} fill="#d8dde6" {...st} strokeWidth={5} />
          <rect x={30} y={44} width={40} height={30} fill="#d8dde6" {...st} strokeWidth={5} />
          <path d="M-40 -42 Q-20 -64 6 -66" fill="none" stroke="#ffffff" strokeWidth={6} strokeLinecap="round" opacity={0.6} />
        </g>
      );
    case 'bolt': {
      const flash = 0.5 + 0.5 * Math.sin(t * 0.8);
      return (
        <g>
          <circle r={86} fill="#ffd93b" opacity={0.18 + 0.2 * flash} />
          <path d="M16 -92 L-46 12 L-6 12 L-22 92 L52 -22 L10 -22 L32 -92 Z" fill="#ffd93b" {...st} />
          {[0, 1, 2, 3].map(i => {
            const a = (i * Math.PI) / 2 + 0.6;
            return <path key={i} d={`M${Math.cos(a) * 70} ${Math.sin(a) * 70} L${Math.cos(a) * (84 + flash * 8)} ${Math.sin(a) * (84 + flash * 8)}`} stroke={ink} strokeWidth={5} strokeLinecap="round" />;
          })}
        </g>
      );
    }
    case 'bulb': {
      const on = t > 12 && !(t >= 17 && t < 20);
      const pulse = 0.85 + 0.15 * Math.sin(t / 6);
      return (
        <g>
          {on ? <circle cy={-22} r={92 * pulse} fill="#fff3a6" opacity={0.45} /> : null}
          {on ? Array.from({length: 8}, (_, i) => {
            const a = (i * Math.PI) / 4 - Math.PI / 2;
            return <path key={i} d={`M${Math.cos(a) * 70} ${-22 + Math.sin(a) * 70} L${Math.cos(a) * 88} ${-22 + Math.sin(a) * 88}`} stroke={ink} strokeWidth={5} strokeLinecap="round" />;
          }) : null}
          <circle cy={-22} r={56} fill={on ? '#fff176' : '#eef3f7'} {...st} />
          <path d="M-16 0 L-10 -24 L-4 -8 L4 -24 L10 -8 L16 -24" fill="none" stroke={on ? '#ff8a00' : '#9aa7b8'} strokeWidth={4.5} strokeLinejoin="round" />
          <rect x={-26} y={32} width={52} height={16} rx={4} fill="#b8c2cf" {...st} strokeWidth={5} />
          <rect x={-22} y={48} width={44} height={14} rx={4} fill="#9aa7b8" {...st} strokeWidth={5} />
          <rect x={-12} y={62} width={24} height={10} rx={4} fill={ink} />
        </g>
      );
    }
    case 'battery': {
      const charge = tween(t, [8, 8 + fps * 2], [0, 4], ease.cinematic);
      return (
        <g>
          <rect x={-16} y={-88} width={32} height={16} rx={4} fill="#b8c2cf" {...st} strokeWidth={5} />
          <rect x={-44} y={-74} width={88} height={156} rx={14} fill="#ffffff" {...st} />
          {[0, 1, 2, 3].map(i => {
            const f = Math.max(0, Math.min(1, charge - i));
            return <rect key={i} x={-32} y={56 - i * 34} width={64} height={26} rx={5} fill={i === 3 ? '#4fdc7a' : i === 0 ? '#ffb02c' : '#8be04e'} opacity={f} transform={`scale(${0.6 + 0.4 * f})`} style={{transformOrigin: `0px ${69 - i * 34}px`}} />;
          })}
          <path d="M6 -56 L-12 -20 L2 -20 L-6 6 L14 -30 L0 -30 Z" fill="#ffd93b" stroke={ink} strokeWidth={4} strokeLinejoin="round" opacity={charge >= 3.9 ? 1 : 0.25} />
        </g>
      );
    }
    case 'thermometer': {
      const level = tween(t, [8, 8 + fps * 1.8], [0.15, 0.9], ease.cinematic);
      const topY = 50 - level * 130;
      return (
        <g>
          <rect x={-18} y={-92} width={36} height={150} rx={18} fill="#ffffff" {...st} />
          <rect x={-7} y={topY} width={14} height={60 - topY} rx={7} fill="#ff4f4f" />
          <circle cy={64} r={30} fill="#ff4f4f" {...st} />
          <circle cx={-9} cy={56} r={7} fill="#ffffff" opacity={0.6} />
          {Array.from({length: 6}, (_, i) => <path key={i} d={`M18 ${-70 + i * 22} L${i % 2 ? 30 : 38} ${-70 + i * 22}`} stroke={ink} strokeWidth={4} strokeLinecap="round" />)}
        </g>
      );
    }
    case 'flask': {
      const body = 'M-16 -86 L16 -86 L16 -28 L62 66 Q64 80 50 80 L-50 80 Q-64 80 -62 66 L-16 -28 Z';
      return (
        <g>
          <path d={body} fill="#eef9ff" />
          <path d={`M-48 ${18 + Math.sin(t / 6) * 3} Q-20 ${10 - Math.sin(t / 6) * 3} 0 ${18} T48 ${18 + Math.sin(t / 6) * 3} L62 66 Q64 80 50 80 L-50 80 Q-64 80 -62 66 Z`} fill="#7ae582" />
          {Array.from({length: 5}, (_, i) => {
            const ph = ((t * 0.02 + i / 5) % 1 + 1) % 1;
            return <circle key={i} cx={Math.sin(i * 2.3 + ph * 6) * (ph < 0.55 ? 26 : 8)} cy={70 - ph * 190} r={5 + i % 3 * 2} fill="#ffffff" stroke={ink} strokeWidth={3} opacity={ph < 0.9 ? 1 : (1 - ph) * 10} />;
          })}
          <path d={body} fill="none" {...st} />
          <rect x={-22} y={-96} width={44} height={12} rx={5} fill="#d8dde6" {...st} strokeWidth={5} />
        </g>
      );
    }
    case 'rocket': {
      const flick = Math.sin(t * 1.3) * 8;
      return (
        <g transform={`translate(${Math.sin(t * 1.7) * 1.5} 0)`}>
          <path d={`M-18 46 L18 46 L0 ${96 + flick} Z`} fill="#ff6a2b" stroke={ink} strokeWidth={5} strokeLinejoin="round" />
          <path d={`M-9 46 L9 46 L0 ${74 + flick / 2} Z`} fill="#ffd93b" />
          <path d="M-30 6 L-60 56 L-30 46 Z" fill="#ff4f4f" {...st} />
          <path d="M30 6 L60 56 L30 46 Z" fill="#ff4f4f" {...st} />
          <path d="M0 -96 C32 -66 36 -20 30 48 L-30 48 C-36 -20 -32 -66 0 -96 Z" fill="#ffffff" {...st} />
          <path d="M0 -96 C17 -80 25 -62 28 -48 L-28 -48 C-25 -62 -17 -80 0 -96 Z" fill="#ff4f4f" {...st} />
          <circle cy={-10} r={16} fill="#4fb8ff" {...st} strokeWidth={5} />
        </g>
      );
    }
    case 'planet':
      return (
        <g transform={`rotate(${-16 + Math.sin(t / 30) * 5})`}>
          <ellipse rx={92} ry={22} fill="none" stroke={ink} strokeWidth={15} />
          <ellipse rx={92} ry={22} fill="none" stroke="#ffd93b" strokeWidth={7} />
          <circle r={54} fill="#ffa95e" {...st} />
          <path d="M-50 -14 Q0 -6 50 -14 M-48 18 Q0 26 48 18" fill="none" stroke="#e5803a" strokeWidth={9} />
          <Face x={0} y={-2} ink={ink} t={t} seed={6} />
          <path d="M-92 0 A92 22 0 0 0 92 0" fill="none" stroke={ink} strokeWidth={15} />
          <path d="M-92 0 A92 22 0 0 0 92 0" fill="none" stroke="#ffd93b" strokeWidth={7} />
        </g>
      );
    case 'moon':
      return (
        <g transform={`rotate(${Math.sin(t / 25) * 6})`}>
          <circle r={64} fill="#f1ecd2" {...st} />
          {[[-30, -30, 12], [28, -36, 8], [36, 26, 13], [-36, 30, 7]].map(([x, y, r], i) => <circle key={i} cx={x} cy={y} r={r} fill="#d9d1b0" stroke={ink} strokeWidth={3} />)}
          <Face x={0} y={6} ink={ink} t={t} seed={7} />
        </g>
      );
    case 'earth': {
      const off = ((t * 0.7) % 160) - 80;
      return (
        <g>
          <defs>
            <clipPath id="sce-earth">
              <circle r={64} />
            </clipPath>
          </defs>
          <circle r={64} fill="#4fa8ff" />
          <g clipPath="url(#sce-earth)">
            {[off - 160, off, off + 160].map((x, i) => (
              <g key={i} transform={`translate(${x} 0)`} fill="#5ccf6a" stroke={ink} strokeWidth={3.5}>
                <path d="M-40 -46 Q-10 -60 6 -40 Q20 -20 -6 -12 Q-26 -4 -34 -22 Q-50 -30 -40 -46 Z" />
                <path d="M20 10 Q46 0 52 24 Q48 50 26 44 Q12 30 20 10 Z" />
                <path d="M-60 20 Q-40 14 -34 34 Q-46 52 -62 40 Z" />
              </g>
            ))}
          </g>
          <circle r={64} fill="none" {...st} />
          <Face x={0} y={4} ink={ink} t={t} seed={8} />
        </g>
      );
    }
  }
  return null;
};

/** Cartoon "poof" cloud for a prop changing into another. */
const Poof: React.FC<{t: number; ink: string; color: string}> = ({t, ink, color}) => {
  const p = progress(t, 0, 18, ease.expo);
  if (t < 0 || t > 22) return null;
  return (
    <g opacity={1 - progress(t, 10, 12)}>
      {Array.from({length: 8}, (_, i) => {
        const a = (i / 8) * Math.PI * 2 + 0.3;
        const d = 30 + 80 * p;
        const r = 30 - 16 * p + (i % 2) * 6;
        return <circle key={i} cx={Math.cos(a) * d} cy={Math.sin(a) * d} r={r} fill={color} stroke={ink} strokeWidth={5} />;
      })}
    </g>
  );
};

/** Comic sound-effect burst. */
const Burst: React.FC<{text: string; t: number; size: number; pal: Pal}> = ({text, t, size, pal}) => {
  const pop = progress(t, 0, 12, ease.overshoot);
  const out = progress(t, 30, 10, ease.accelerate);
  if (t < 0 || out >= 1) return null;
  const star = Array.from({length: 24}, (_, i) => {
    const r = i % 2 ? 0.72 : 1;
    const a = (i / 24) * Math.PI * 2;
    return `${(Math.cos(a) * r * 50).toFixed(1)},${(Math.sin(a) * r * 34).toFixed(1)}`;
  }).join(' ');
  return (
    <div style={{position: 'absolute', width: size, height: size * 0.7, transform: `scale(${pop * (1 - out)}) rotate(${-10 + Math.sin(t / 3) * 3}deg)`}}>
      <svg viewBox="-56 -40 112 80" width="100%" height="100%" style={{position: 'absolute', inset: 0, overflow: 'visible'}}>
        <polygon points={star} fill={pal.accent2} stroke={pal.ink} strokeWidth={3.5} strokeLinejoin="round" />
      </svg>
      <div style={{position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: fonts.heavy, fontSize: size * (text.length > 5 ? 0.17 : 0.22), color: onFill(pal.accent2), letterSpacing: '0.02em'}}>{text}</div>
    </div>
  );
};

// ---------------------------------------------------------------------------------------------
// The entry
// ---------------------------------------------------------------------------------------------

const CartoonExplainer: React.FC<EntryProps<Props>> = ({media, props}) => {
  const frame = useCurrentFrame();
  const {fps, width, height} = useVideoConfig();
  const look = useLook();
  const pal: Pal = look ? fromLook(look) : {...PALETTES[props.palette], accent: media.accent ?? PALETTES[props.palette].accent};
  const u = Math.min(width, height) / 1080;
  const side = width / height >= 1.2;
  const timeline = useSceneTimeline(media);
  const contentEnd = useContentFrames(media);
  const steps = props.steps;
  const n = steps.length;

  // --- Timing: one narration scene per step; one extra first scene becomes the title card.
  const offset = timeline.length > n ? 1 : 0;
  const introEnd = offset ? timeline[1].from : 0;
  const matched = timeline.length - offset >= n;
  const stepStart = (i: number) => Math.min(contentEnd - fps, i === 0 ? introEnd : matched ? timeline[i + offset].from : introEnd + Math.round((i * (contentEnd - introEnd)) / n));
  const stepEnd = (i: number) => (i === n - 1 ? contentEnd : stepStart(i + 1));
  const P = Math.round(0.8 * fps);
  const panStart = (i: number) => stepStart(i) - Math.round(P * 0.5);
  const posAt = (f: number) => steps.reduce((acc, _, i) => (i === 0 ? acc : acc + progress(f, panStart(i), P, ease.cinematic)), 0);
  const pos = posAt(frame);
  const walk = Math.min(1, Math.abs(posAt(frame + 1) - pos) * 18);
  let cur = -1;
  for (let i = 0; i < n; i++) if (frame >= stepStart(i)) cur = i;
  const lastStart = stepStart(n - 1);
  const takeStart = props.takeaway ? Math.min(contentEnd - Math.round(1.8 * fps), lastStart + Math.max(Math.round(1.6 * fps), Math.round((contentEnd - lastStart) * 0.5))) : Infinity;
  const showTake = Boolean(props.takeaway) && takeStart > lastStart + fps;
  const inTake = showTake && frame >= takeStart;

  // --- Layout: host on the left, prop on the right (wide) or above (tall/square); ground band holds the captions.
  const safe = look ? captionSafeBottom(look) : props.showCaptions ? (side ? 0.2 : 0.18) : 0.1;
  const groundY = height * (1 - safe);
  const charH = side ? Math.min(height * 0.42, groundY - height * 0.3) : Math.min(height * 0.24, width * 0.42, groundY - height * 0.38);
  const charW = (charH * 200) / 260;
  const charCX = side ? width * 0.2 : width * 0.25;
  const charTop = groundY - charH;
  const headTop = height * (side ? 0.065 : 0.045);
  const headH = (side ? 190 : 220) * u;
  const propSize = side ? Math.min(height * 0.46, width * 0.3, groundY - headTop - headH) : Math.min(width * 0.5, (charTop - headTop - headH) * 0.86);
  const propX = side ? width * 0.72 : width * 0.5;
  const propCY = side ? groundY - propSize * 0.56 : headTop + headH + (charTop - headTop - headH) / 2 - 10 * u;
  const rigScale = charH / 260;

  // --- Host pose, mood and mouth.
  const actionOf = (i: number): Action | 'idle' => (i < 0 ? 'wave' : inTake && i === n - 1 ? 'cheer' : steps[i].action);
  const act = frame < introEnd ? 'wave' : actionOf(cur);
  const prevAct = cur <= 0 ? 'idle' : actionOf(cur - 1);
  const poseK = cur < 0 ? 1 : progress(frame, inTake ? takeStart : stepStart(cur), 10, ease.overshoot);
  const from = POSES[inTake ? (cur >= 0 ? steps[cur].action : 'idle') : prevAct];
  const to = POSES[act];
  const lerp = (a: Pt, b: Pt): Pt => [a[0] + (b[0] - a[0]) * poseK, a[1] + (b[1] - a[1]) * poseK];
  let pose: [Pt, Pt] = [lerp(from[0], to[0]), lerp(from[1], to[1])];
  if (act === 'wave') pose = [pose[0], [pose[1][0] + Math.sin(frame * 0.45) * 14, pose[1][1]]];
  if (act === 'explain') pose = [[pose[0][0] + Math.sin(frame / 7) * 6, pose[0][1]], [pose[1][0] - Math.sin(frame / 7) * 6, pose[1][1] + Math.cos(frame / 7) * 4]];
  const mood = MOODS[act];
  const sceneNow = timeline.find(t => frame >= t.from && frame < t.from + t.durationInFrames);
  let talk = 0;
  if (sceneNow && sceneNow.scene.text && frame < contentEnd) {
    const caps = sceneNow.scene.captions.length ? sceneNow.scene.captions : evenCaptions(sceneNow.scene.text, sceneNow.scene.audio.duration * 1000);
    const ms = ((frame - sceneNow.from) / fps) * 1000;
    const w = activeWord(caps, ms);
    if (w >= 0) talk = Math.sin(Math.PI * Math.min(1, (ms - caps[w].startMs) / Math.max(1, caps[w].endMs - caps[w].startMs)));
  }
  const actStart = inTake ? takeStart : cur >= 0 ? stepStart(cur) : 0;
  const jump = act === 'cheer' ? Math.abs(Math.sin((frame - actStart) * (Math.PI / 15))) * 26 : act === 'shock' ? Math.sin(Math.PI * progress(frame, actStart + 3, 12, (x: number) => x)) * 34 : walk * Math.abs(Math.sin(frame * 0.55)) * 6;
  const tremble = act === 'shock' && frame - actStart < fps * 1.2 ? Math.sin(frame * 2.2) * 2 : 0;
  const breathe = Math.sin(frame / 9) * 0.02;
  const hostIn = offset ? 1 : spring({frame: frame - 2, fps, config: {damping: 11, stiffness: 120}});

  // --- Iris opening from the title card onto the stage.
  const iris = offset ? progress(frame, introEnd - 8, 20, ease.cinematic) : 1;
  const irisR = iris * Math.hypot(width, height);
  const irisAt = `${charCX}px ${charTop + charH * 0.35}px`;

  // --- Background world (parallax layers pan one screen per step).
  const worldW = width * (n + 1.5);
  const hillPath = (base: number, amp: number, freq: number, seed: string, factor: number) => {
    const span = worldW * factor + width * 2;
    const step = 30 * u;
    const ph = rand(seed, 0, 6.28);
    let d = `M${-width} ${height}`;
    for (let x = -width; x <= span; x += step) {
      const y = base + Math.sin(x / (freq * u) + ph) * amp * u + Math.sin(x / (freq * 0.37 * u) + ph * 2) * amp * 0.3 * u;
      d += ` L${x.toFixed(0)} ${y.toFixed(1)}`;
    }
    return `${d} L${span.toFixed(0)} ${height} Z`;
  };
  const farD = React.useMemo(() => hillPath(groundY - height * (side ? 0.2 : 0.13), 34, 320, 'far', 0.4), [width, height, n, groundY]);
  const nearD = React.useMemo(() => hillPath(groundY - height * (side ? 0.07 : 0.045), 20, 230, 'near', 0.7), [width, height, n, groundY]);
  const groundD = React.useMemo(() => hillPath(groundY, 5, 160, 'ground', 1), [width, height, n, groundY]);
  const decor = React.useMemo(
    () =>
      Array.from({length: Math.ceil((worldW + width) / (150 * u))}, (_, i) => ({
        x: -width * 0.3 + i * 150 * u + rand(`dx${i}`, -40, 40) * u,
        kind: Math.floor(rand(`dk${i}`, 0, 3)),
        s: rand(`ds${i}`, 0.7, 1.2),
      })),
    [width, height, n],
  );
  const clouds = Array.from({length: 7}, (_, i) => ({
    x: rand(`cx${i}`, 0, width * 1.6) - pos * width * 0.15 + frame * 0.25 * u,
    y: rand(`cy${i}`, height * 0.05, groundY - height * (side ? 0.45 : 0.5)),
    s: rand(`cs${i}`, 0.6, 1.2),
  }));

  // --- Speech bubble and heading geometry.
  const bubbleLeft = side ? charCX + charW * 0.32 : charCX + charW * 0.42;
  const bubbleW = side ? Math.min(width * 0.3, propX - propSize * 0.5 - bubbleLeft - 20 * u) : width * 0.95 - bubbleLeft;
  const bubbleBottom = side ? height - (charTop + charH * 0.22) : height - (groundY - 30 * u);
  const bubbleTailUp = !side;
  const headingSize = (len: number) => (side ? 66 : 72) * u * (len > 28 ? 0.8 : len > 18 ? 0.9 : 1);

  const stage = (
    <AbsoluteFill style={{clipPath: iris < 1 ? `circle(${irisR.toFixed(1)}px at ${irisAt})` : undefined, overflow: 'hidden'}}>
      {/* sky */}
      <AbsoluteFill style={{background: `linear-gradient(180deg, ${pal.sky} 0%, ${pal.sky2} ${(1 - safe) * 100}%)`}} />
      <div style={{position: 'absolute', left: width * (side ? 0.47 : 0.78) - 110 * u - pos * 12 * u, top: height * 0.1, width: 220 * u, height: 220 * u, borderRadius: '50%', background: pal.sun, boxShadow: `0 0 ${120 * u}px ${alpha(pal.sun, 0.7)}`, opacity: 0.85}} />
      <Particles count={22} color={pal.flat ? pal.accent : '#ffffff'} opacity={pal.flat ? 0.25 : 0.4} seed="sce-twinkle" speed={0.2} size={[2, 5]} />
      {clouds.map((c, i) => (
        <svg key={i} viewBox="-100 -60 200 120" width={260 * u * c.s} height={156 * u * c.s} style={{position: 'absolute', left: ((c.x % (width * 1.6)) + width * 1.6) % (width * 1.6) - width * 0.3, top: c.y, opacity: 0.9}}>
          <Puff circles={[[-50, 14, 30], [-12, -10, 40], [32, 6, 34], [64, 22, 22], [-80, 26, 18]]} fill={pal.flat ? '#ffffff' : mix(pal.sky2, '#ffffff', 0.7)} ink={alpha(pal.ink, pal.flat ? 0.35 : 0.0001)} rim={6} />
        </svg>
      ))}
      {/* hills and ground */}
      <svg width={width} height={height} style={{position: 'absolute', inset: 0, overflow: 'visible'}}>
        <g transform={`translate(${(-pos * width * 0.4).toFixed(1)} 0)`}>
          <path d={farD} fill={pal.hillFar} stroke={alpha(pal.ink, 0.5)} strokeWidth={4 * u} />
        </g>
        <g transform={`translate(${(-pos * width * 0.7).toFixed(1)} 0)`}>
          <path d={nearD} fill={pal.hillNear} stroke={alpha(pal.ink, 0.7)} strokeWidth={5 * u} />
        </g>
        <g transform={`translate(${(-pos * width).toFixed(1)} 0)`}>
          <path d={groundD} fill={pal.ground} stroke={pal.ink} strokeWidth={6 * u} />
          <rect x={-width} y={groundY + (height - groundY) * 0.55} width={worldW + width * 3} height={height} fill={pal.ground2} opacity={0.5} />
          {decor.map((d, i) => {
            const y = groundY + 4 * u;
            if (d.kind === 0) return <path key={i} d={`M${d.x - 14 * u * d.s} ${y} L${d.x - 6 * u * d.s} ${y - 22 * u * d.s} L${d.x} ${y - 6 * u} L${d.x + 8 * u * d.s} ${y - 26 * u * d.s} L${d.x + 14 * u * d.s} ${y}`} fill="none" stroke={pal.ink} strokeWidth={4 * u} strokeLinejoin="round" strokeLinecap="round" opacity={0.7} />;
            if (d.kind === 1)
              return (
                <g key={i} transform={`translate(${d.x} ${y - 30 * u * d.s}) scale(${u * d.s})`}>
                  <path d="M0 30 L0 6" stroke={pal.ink} strokeWidth={4} />
                  {[0, 1, 2, 3, 4].map(k => <circle key={k} cx={Math.cos((k * 2 * Math.PI) / 5) * 9} cy={Math.sin((k * 2 * Math.PI) / 5) * 9} r={7} fill={k % 2 ? pal.accent2 : pal.accent} stroke={pal.ink} strokeWidth={3} />)}
                  <circle r={5} fill="#ffffff" stroke={pal.ink} strokeWidth={3} />
                </g>
              );
            return <ellipse key={i} cx={d.x} cy={y - 6 * u} rx={22 * u * d.s} ry={12 * u * d.s} fill={mix(pal.ground, '#ffffff', 0.25)} stroke={pal.ink} strokeWidth={4 * u} />;
          })}
        </g>
      </svg>

      {/* props: one per step, placed one screen apart in the world */}
      {steps.map((s, i) => {
        const x = propX + (i - pos) * width;
        if (x < -propSize || x > width + propSize) return null;
        const st = stepStart(i);
        const en = stepEnd(i);
        const landAt = i === 0 ? st + 4 : panStart(i) + Math.round(P * 0.25);
        const land = spring({frame: frame - landAt, fps, config: {damping: 9, stiffness: 140}});
        const drop = i === 0 && !offset ? (1 - Math.min(1, land)) * -height * 0.7 : 0;
        const sy = i === 0 && !offset ? 2 - Math.max(0.6, land) : land;
        const sx = i === 0 && !offset ? Math.max(0.6, land) : 2 - Math.max(0.4, Math.min(1.6, land));
        const morphAt = s.becomes !== 'none' ? st + Math.max(Math.round(1.2 * fps), Math.round((en - st) * 0.42)) : Infinity;
        const morphs = morphAt < en - fps * 0.6;
        const kind: PropKind = morphs && frame >= morphAt ? (s.becomes as PropKind) : s.prop;
        const morphOut = morphs && frame < morphAt ? 1 - progress(frame, morphAt - 6, 6, ease.accelerate) : 1;
        const morphIn = morphs && frame >= morphAt ? spring({frame: frame - morphAt, fps, config: {damping: 9, stiffness: 150}}) : 1;
        const bob = FLOATING.includes(kind) ? Math.sin(frame / 14 + i) * 7 * u : 0;
        const sfxAt = morphs ? morphAt : landAt + 8;
        const shadowW = propSize * 0.62 * (FLOATING.includes(kind) ? 0.8 - bob / (60 * u) : 1);
        return (
          <React.Fragment key={i}>
            {side ? (
              <div style={{position: 'absolute', left: x - shadowW / 2, top: groundY - 14 * u, width: shadowW, height: 26 * u, borderRadius: '50%', background: alpha(pal.ink, 0.22), opacity: Math.min(1, Math.max(0, land))}} />
            ) : (
              <svg width={propSize} height={propSize * 0.3} viewBox="-100 -30 200 60" style={{position: 'absolute', left: x - propSize / 2, top: propCY + propSize * 0.42, overflow: 'visible', transform: `scaleX(${Math.min(1, Math.max(0, land))})`}}>
                <ellipse cy={6} rx={80} ry={18} fill={mix(pal.ground, pal.ink, 0.25)} stroke={pal.ink} strokeWidth={5} />
                <ellipse cy={-2} rx={80} ry={18} fill={mix(pal.ground, '#ffffff', 0.25)} stroke={pal.ink} strokeWidth={5} />
              </svg>
            )}
            <div style={{position: 'absolute', left: x - propSize / 2, top: propCY - propSize / 2 + drop + bob, width: propSize, height: propSize, transform: `scale(${sx * morphOut * morphIn}, ${sy * morphOut * morphIn})`, transformOrigin: '50% 92%'}}>
              <svg viewBox="-110 -110 220 220" width="100%" height="100%" style={{overflow: 'visible'}}>
                <CartoonProp kind={kind} t={frame - st} fps={fps} ink={pal.ink} accent={pal.accent} />
              </svg>
            </div>
            {morphs ? (
              <svg viewBox="-110 -110 220 220" width={propSize} height={propSize} style={{position: 'absolute', left: x - propSize / 2, top: propCY - propSize / 2, overflow: 'visible'}}>
                <Poof t={frame - morphAt + 4} ink={pal.ink} color={pal.flat ? '#ffffff' : mix(pal.sky2, '#ffffff', 0.8)} />
              </svg>
            ) : null}
            {s.sfx ? (
              <div style={{position: 'absolute', left: x + propSize * (side ? 0.22 : 0.18), top: propCY - propSize * 0.62}}>
                <Burst text={s.sfx} t={frame - sfxAt} size={(side ? 210 : 230) * u} pal={pal} />
              </div>
            ) : null}
          </React.Fragment>
        );
      })}

      {/* host */}
      <div style={{position: 'absolute', left: charCX - charW * 0.42, top: groundY - 12 * u, width: charW * 0.84, height: 24 * u, borderRadius: '50%', background: alpha(pal.ink, 0.25), transform: `scale(${1 - jump / 120})`}} />
      <div style={{position: 'absolute', left: charCX - charW / 2 + tremble * rigScale, top: charTop - jump * rigScale + (1 - hostIn) * charH * 1.2, width: charW, height: charH, transform: `scale(${1 - breathe}, ${1 + breathe})`, transformOrigin: '50% 100%'}}>
        <Host kind={props.host.kind} pal={pal} pose={pose} mood={mood} talk={talk} walk={walk} frame={frame} />
      </div>

      {/* speech bubble per step */}
      {steps.map((s, i) => {
        if (!s.line) return null;
        const st = stepStart(i) + Math.round(0.35 * fps);
        const en = i === n - 1 ? (showTake ? takeStart : contentEnd) : stepEnd(i) - Math.round(P * 0.4);
        if (frame < st || frame > en + 10) return null;
        const pop = progress(frame, st, 12, ease.overshoot);
        const out = progress(frame, en - 2, 10, ease.accelerate);
        const tail = bubbleTailUp
          ? `M${34 * u} ${-2 * u} L${-6 * u} ${-48 * u} L${80 * u} ${-2 * u}`
          : `M${30 * u} ${-2 * u} L${-16 * u} ${46 * u} L${84 * u} ${-2 * u}`;
        return (
          <div key={i} style={{position: 'absolute', left: bubbleLeft, bottom: bubbleBottom, width: bubbleW, transform: `scale(${pop * (1 - out)})`, transformOrigin: bubbleTailUp ? '0% 0%' : '0% 100%'}}>
            <div style={{position: 'relative', background: pal.bubble, border: `${5 * u}px solid ${pal.edge}`, borderRadius: 36 * u, padding: `${22 * u}px ${30 * u}px`, boxShadow: `${8 * u}px ${10 * u}px 0 ${alpha(pal.ink, 0.25)}`}}>
              <svg width={1} height={1} style={{position: 'absolute', left: 0, ...(bubbleTailUp ? {top: 0} : {bottom: 0}), overflow: 'visible'}}>
                <g transform={bubbleTailUp ? `translate(0 ${-5 * u})` : `translate(0 ${5 * u})`}>
                  <path d={tail} fill={pal.bubble} stroke={pal.edge} strokeWidth={5 * u} strokeLinejoin="round" />
                  <path d={bubbleTailUp ? `M${36 * u} ${2 * u} L${78 * u} ${2 * u}` : `M${32 * u} ${-2 * u} L${82 * u} ${-2 * u}`} stroke={pal.bubble} strokeWidth={9 * u} />
                </g>
              </svg>
              <KineticText text={s.line} start={st + 4} stagger={2} duration={14} style="pop" accent={pal.accent} textStyle={{fontFamily: fonts.sans, fontWeight: 800, fontSize: (side ? 40 : 44) * u, lineHeight: 1.18, color: pal.bubbleText}} />
            </div>
          </div>
        );
      })}

      {/* step heading: badge + outlined cartoon title */}
      {steps.map((s, i) => {
        const st = stepStart(i);
        const en = i === n - 1 ? (showTake ? takeStart : Infinity) : stepEnd(i) - Math.round(P * 0.45);
        if (frame < st - 2 || frame > en + 12) return null;
        const enter = progress(frame, st, 14, ease.overshoot);
        const out = progress(frame, en, 10, ease.accelerate);
        return (
          <div key={i} style={{position: 'absolute', left: width * (side ? 0.05 : 0.06), right: width * (side ? 0.4 : 0.06), top: headTop, opacity: 1 - out, transform: `translateY(${-out * 60 * u}px)`}}>
            <div style={{display: 'inline-block', fontFamily: fonts.heavy, fontSize: 28 * u, letterSpacing: '0.08em', padding: `${8 * u}px ${20 * u}px`, borderRadius: 999, background: pal.accent, color: onFill(pal.accent), border: `${4 * u}px solid ${pal.ink}`, transform: `rotate(${-4 + (1 - enter) * -20}deg) scale(${enter})`, transformOrigin: '0% 50%', boxShadow: `${4 * u}px ${5 * u}px 0 ${pal.ink}`}}>
              STEP {i + 1}
              <span style={{opacity: 0.6}}> / {n}</span>
            </div>
            <div style={{marginTop: 16 * u}}>
              <KineticText text={s.heading} start={st + 3} stagger={3} duration={16} style="pop" accent={pal.accent2} textStyle={{fontFamily: fonts.heavy, fontSize: headingSize(s.heading.length), lineHeight: 1.08, color: pal.title, textShadow: outline(pal.ink, 4.5 * u, 7 * u), letterSpacing: '0.01em'}} />
            </div>
          </div>
        );
      })}

      {/* the takeaway replaces the last heading while the host cheers */}
      {showTake && frame >= takeStart - 2 ? (
        <div style={{position: 'absolute', left: width * (side ? 0.05 : 0.06), right: width * (side ? 0.36 : 0.06), top: headTop}}>
          <div style={{display: 'inline-block', fontFamily: fonts.heavy, fontSize: 28 * u, letterSpacing: '0.08em', padding: `${8 * u}px ${20 * u}px`, borderRadius: 999, background: pal.accent2, color: onFill(pal.accent2), border: `${4 * u}px solid ${pal.ink}`, transform: `rotate(-4deg) scale(${progress(frame, takeStart, 14, ease.overshoot)})`, transformOrigin: '0% 50%', boxShadow: `${4 * u}px ${5 * u}px 0 ${pal.ink}`}}>
            THE BIG IDEA
          </div>
          <div style={{marginTop: 16 * u}}>
            <KineticText text={props.takeaway} start={takeStart + 4} stagger={3} duration={16} style="pop" accent={pal.accent2} textStyle={{fontFamily: fonts.heavy, fontSize: headingSize(props.takeaway.length) * 0.92, lineHeight: 1.1, color: pal.title, textShadow: outline(pal.ink, 4.5 * u, 7 * u)}} />
          </div>
        </div>
      ) : null}

      {/* confetti while the host cheers at the end */}
      {showTake && frame >= takeStart
        ? Array.from({length: 46}, (_, i) => {
            const t = frame - takeStart - rand(`cd${i}`, 0, 20);
            if (t < 0) return null;
            const x = rand(`cfx${i}`, 0, width) + Math.sin(t / 8 + i) * 20 * u;
            const y = -40 * u + t * rand(`cfv${i}`, 6, 11) * u;
            if (y > groundY) return null;
            return <div key={i} style={{position: 'absolute', left: x, top: y, width: 16 * u, height: 26 * u, borderRadius: 4 * u, background: [pal.accent, pal.accent2, pal.host, '#4fb8ff'][i % 4], border: `${2.5 * u}px solid ${pal.ink}`, transform: `rotate(${t * rand(`cfr${i}`, -12, 12)}deg) scaleX(${Math.cos(t / 5 + i)})`}} />;
          })
        : null}

      {/* episode tag on wide frames */}
      {side ? (
        <div style={{position: 'absolute', right: width * 0.04, top: headTop + 6 * u, maxWidth: width * 0.3, fontFamily: fonts.heavy, fontSize: 22 * u, letterSpacing: '0.1em', textTransform: 'uppercase', color: pal.title, background: alpha(pal.ink, 0.75), padding: `${8 * u}px ${16 * u}px`, borderRadius: 10 * u, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', opacity: progress(frame, introEnd + 10, 14)}}>
          {props.title.replace(/\*/g, '')}
        </div>
      ) : null}
    </AbsoluteFill>
  );

  // --- Title card: rotating sunburst, outlined title, the host waving hello.
  const titleCard = offset && frame < introEnd + 14 ? (
    <AbsoluteFill style={{background: pal.sky, overflow: 'hidden'}}>
      <svg width={width} height={height} style={{position: 'absolute', inset: 0}}>
        <g transform={`translate(${width / 2} ${height * 0.42}) rotate(${frame * 0.4})`}>
          {Array.from({length: 18}, (_, i) => {
            const a0 = (i / 18) * Math.PI * 2;
            const a1 = a0 + Math.PI / 18;
            const R = Math.hypot(width, height);
            return <path key={i} d={`M0 0 L${Math.cos(a0) * R} ${Math.sin(a0) * R} L${Math.cos(a1) * R} ${Math.sin(a1) * R} Z`} fill={pal.sky2} opacity={pal.flat ? 0.7 : 0.45} />;
          })}
        </g>
        <circle cx={width / 2} cy={height * 0.42} r={Math.min(width, height) * 0.36} fill={alpha(pal.sun, 0.5)} />
      </svg>
      <AbsoluteFill style={{justifyContent: 'center', alignItems: 'center', paddingBottom: height * (side ? 0.16 : 0.2), paddingLeft: side ? width * 0.24 : 0, paddingRight: side ? width * 0.04 : 0}}>
        {props.host.name ? (
          <div style={{fontFamily: fonts.heavy, fontSize: 30 * u, letterSpacing: '0.1em', textTransform: 'uppercase', padding: `${10 * u}px ${26 * u}px`, borderRadius: 999, background: pal.accent, color: onFill(pal.accent), border: `${4 * u}px solid ${pal.ink}`, boxShadow: `${4 * u}px ${5 * u}px 0 ${pal.ink}`, marginBottom: 34 * u, transform: `rotate(-3deg) scale(${progress(frame, 4, 14, ease.overshoot)})`}}>
            with {props.host.name}
          </div>
        ) : null}
        <KineticText text={props.title} start={8} stagger={4} duration={18} style="pop" align="center" accent={pal.accent2} textStyle={{fontFamily: fonts.heavy, fontSize: Math.min((side ? 108 : 104) * u, (width * (side ? 1.25 : 1.7)) / Math.max(10, props.title.length)), lineHeight: 1.06, color: pal.title, textShadow: outline(pal.ink, 6 * u, 10 * u), maxWidth: width * (side ? 0.68 : 0.84), letterSpacing: '0.01em'}} />
      </AbsoluteFill>
      <svg width={width} height={height} style={{position: 'absolute', inset: 0}}>
        <path d={groundD} fill={pal.ground} stroke={pal.ink} strokeWidth={6 * u} />
      </svg>
      <div style={{position: 'absolute', left: (side ? width * 0.13 : charCX) - charW / 2, top: charTop + (1 - spring({frame: frame - 6, fps, config: {damping: 11, stiffness: 110}})) * charH * 1.2, width: charW, height: charH}}>
        <Host kind={props.host.kind} pal={pal} pose={[POSES.wave[0], [POSES.wave[1][0] + Math.sin(frame * 0.45) * 14, POSES.wave[1][1]]]} mood="happy" talk={0} walk={0} frame={frame} />
      </div>
    </AbsoluteFill>
  ) : null;

  return (
    <AbsoluteFill style={{background: pal.sky, overflow: 'hidden'}}>
      {titleCard}
      {stage}
      {offset ? <LightLeak from={Math.max(0, introEnd - 10)} durationInFrames={Math.round(1.1 * fps)} seed={4} opacity={pal.flat ? 0.15 : 0.35} /> : null}
      {showTake ? <LightLeak from={takeStart} durationInFrames={Math.round(1.2 * fps)} seed={9} hueShift={300} opacity={pal.flat ? 0.12 : 0.3} /> : null}
      {props.showCaptions
        ? timeline.map(t => (
            <Sequence key={t.index} from={t.from} durationInFrames={t.durationInFrames}>
              <AbsoluteFill style={{justifyContent: 'flex-end', padding: side ? `0 14% ${height * 0.035}px` : `0 7% ${height * 0.04}px`}}>
                <StyledCaptions scene={t.scene} variant="box" accent={pal.accent2} color={pal.caption} font={fonts.heavy} size={(side ? 48 : 56) * u} words={side ? 6 : 4} weight={400} shadow={!pal.flat} />
              </AbsoluteFill>
            </Sequence>
          ))
        : null}
      <Vignette strength={pal.flat ? 0.12 : 0.35} />
      <Grain opacity={0.04} />
      <NarrationTrack media={media} />
      <AdWeave media={media} theme={{background: pal.flat ? pal.sky : pal.ink, text: pal.flat ? pal.ink : pal.title, font: fonts.heavy}} />
    </AbsoluteFill>
  );
};

export default defineEntry({id: 'story-cartoon-explainer', schema: Props, component: CartoonExplainer});
