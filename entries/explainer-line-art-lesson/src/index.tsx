import React from 'react';
import {AbsoluteFill, Sequence, useCurrentFrame, useVideoConfig} from 'remotion';
import {AdWeave, NarrationTrack, captionSafeBottom, defineEntry, mix, useContentFrames, useLook, useSceneTimeline, type ActiveLook, type EntryProps, type Scene} from '@viralaunch/kit';
import {Grain, KineticText, LightLeak, LineIcon, Particles, StyledCaptions, Vignette, alpha, ease, fonts, progress, rand, tween} from '@viralaunch/kit/fx';
import {Props, type Mark, type Step} from './schema';

type Pal = {bg: string; bg2: string; surface: string; ink: string; text: string; muted: string; accent: string; warm: string; cool: string; green: string; dark: boolean};

const PALETTES: Record<Props['palette'], Pal> = {
  paper: {bg: '#f6f0e3', bg2: '#e9e0cc', surface: '#fffdf7', ink: '#2a2722', text: '#24221f', muted: '#867e70', accent: '#d8452e', warm: '#d8452e', cool: '#2f6fc9', green: '#2e8a55', dark: false},
  blueprint: {bg: '#0f2a4a', bg2: '#08182c', surface: '#12345c', ink: '#e8f1ff', text: '#f4f8ff', muted: '#8fb0d6', accent: '#ffd166', warm: '#ffb35c', cool: '#7fd3ff', green: '#8ff0b0', dark: true},
  chalk: {bg: '#22402f', bg2: '#132619', surface: '#2b4c39', ink: '#f1efe6', text: '#f7f5ee', muted: '#a9bfae', accent: '#ffe27a', warm: '#ff9f80', cool: '#9fd3ff', green: '#c8f59a', dark: true},
};

/** The lesson page in a sequence's shared look: paper, ink and accent from the look; blue/green tints mixed toward its line colour. */
const fromLook = (l: ActiveLook): Pal => ({
  bg: l.palette.bg,
  bg2: l.palette.bg2,
  surface: l.palette.surface,
  ink: l.palette.line,
  text: l.palette.text,
  muted: l.palette.muted,
  accent: l.palette.accent,
  // light accents (paper's yellow) are too faint for thin ink labels on cream: deepen them
  warm: l.tone === 'light' ? mix(l.palette.accent, l.palette.text, 0.35) : l.palette.accent,
  cool: mix(l.palette.line, '#3b82d6', 0.62),
  green: mix(l.palette.line, '#3fa268', 0.62),
  dark: l.tone === 'dark',
});

const toneColor = (pal: Pal, tone: Mark['tone']) => (tone === 'warm' ? pal.warm : tone === 'cool' ? pal.cool : tone === 'green' ? pal.green : pal.ink);

// ---------------------------------------------------------------------------------------------
// Pen-stroke geometry (seeded, so every render draws the same "hand")
// ---------------------------------------------------------------------------------------------

/** A wobbly loop that overshoots its start a little, like a circle drawn with a pen. */
function sketchCircle(cx: number, cy: number, r: number, seed: string) {
  const p1 = rand(`${seed}p1`, 0, 6.28);
  const p2 = rand(`${seed}p2`, 0, 6.28);
  const a0 = rand(`${seed}a0`, -2.2, -1.2);
  const pts: string[] = [];
  const n = 84;
  for (let i = 0; i <= n; i++) {
    const a = a0 + (i / n) * (Math.PI * 2 + 0.14);
    const rr = r * (1 + 0.009 * Math.sin(2 * a + p1) + 0.005 * Math.sin(3 * a + p2) + 0.006 * (i / n));
    pts.push(`${i ? 'L' : 'M'}${(cx + rr * Math.cos(a)).toFixed(1)},${(cy + rr * Math.sin(a)).toFixed(1)}`);
  }
  return pts.join(' ');
}

/** A straight-ish line with a slight seeded bow. */
function sketchLine(x1: number, y1: number, x2: number, y2: number, seed: string, bow = 0.012) {
  const len = Math.hypot(x2 - x1, y2 - y1) || 1;
  const k = rand(seed, -bow, bow) * len;
  const mx = (x1 + x2) / 2 - ((y2 - y1) / len) * k;
  const my = (y1 + y2) / 2 + ((x2 - x1) / len) * k;
  return `M${x1.toFixed(1)},${y1.toFixed(1)} Q${mx.toFixed(1)},${my.toFixed(1)} ${x2.toFixed(1)},${y2.toFixed(1)}`;
}

function arrowHead(x: number, y: number, angle: number, size: number) {
  const a1 = angle + Math.PI * 0.82;
  const a2 = angle - Math.PI * 0.82;
  return `M${x + size * Math.cos(a1)},${y + size * Math.sin(a1)} L${x},${y} L${x + size * Math.cos(a2)},${y + size * Math.sin(a2)}`;
}

/** A stroke that draws itself on as `p` goes 0 → 1. */
const Ink: React.FC<{d: string; p: number; color: string; w: number; opacity?: number; fill?: string}> = ({d, p, color, w, opacity = 1, fill = 'none'}) =>
  p <= 0 ? null : <path d={d} pathLength={1} fill={fill} stroke={color} strokeWidth={w} strokeLinecap="round" strokeLinejoin="round" strokeDasharray="1 1" strokeDashoffset={1 - Math.min(1, p)} opacity={opacity} />;

/** Pushes label centres apart so no two are closer than `gap`, staying inside [min, max]. */
function spread(ys: number[], gap: number, min: number, max: number): number[] {
  const order = ys.map((y, i) => ({y, i})).sort((a, b) => a.y - b.y);
  for (let k = 0; k < order.length; k++) order[k].y = Math.max(order[k].y, k ? order[k - 1].y + gap : min);
  const over = order.length ? order[order.length - 1].y - max : 0;
  if (over > 0) for (let k = order.length - 1; k >= 0; k--) order[k].y = Math.max(min, Math.min(order[k].y - over, k < order.length - 1 ? order[k + 1].y - gap : max));
  const out = new Array<number>(ys.length);
  for (const o of order) out[o.i] = o.y;
  return out;
}

/** Frame (inside the scene) where the narration first says a word of `label`, or null. */
function cueFrame(scene: Scene | undefined, label: string, fps: number): number | null {
  if (!scene || !scene.captions.length) return null;
  const norm = (s: string) => s.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, '');
  const words = label.split(/\s+/).map(norm).filter(w => w.length >= 4);
  if (!words.length) return null;
  const hit = scene.captions.find(c => words.includes(norm(c.text)));
  return hit ? Math.round((hit.startMs / 1000) * fps) : null;
}

// ---------------------------------------------------------------------------------------------
// Shared pieces
// ---------------------------------------------------------------------------------------------

type Box = {x: number; y: number; w: number; h: number};
type Ctx = {f: number; pal: Pal; u: number; portrait: boolean; box: Box; start: number; skel: number; markAt: number[]};

/** A sketched Earth seen from the equator: rotating meridians, dashed equator, pole marks. */
const GlobeSketch: React.FC<{cx: number; cy: number; r: number; p: number; f: number; pal: Pal; u: number; seed: string}> = ({cx, cy, r, p, f, pal, u, seed}) => {
  const spin = f * 0.55;
  const meridians = Array.from({length: 6}, (_, k) => {
    const lam = ((k * 30 + spin) % 180) * (Math.PI / 180);
    const rx = Math.max(0.5, Math.abs(r * Math.cos(lam)));
    // front-facing half only; the far side would cross the near side
    const sweep = Math.cos(lam) >= 0 ? 1 : 0;
    return <path key={k} d={`M${cx},${cy - r} A${rx},${r} 0 0 ${sweep} ${cx},${cy + r}`} fill="none" stroke={pal.ink} strokeWidth={1.4 * u} opacity={0.32 * p} />;
  });
  const dashes = 26;
  return (
    <g>
      <circle cx={cx} cy={cy} r={r} fill={alpha(pal.surface, pal.dark ? 0.25 : 0.65)} opacity={p} />
      {meridians}
      {Array.from({length: dashes}, (_, i) => {
        if (i / dashes > p || i % 2) return null;
        const x1 = cx - r + (i / dashes) * 2 * r;
        return <line key={i} x1={x1} x2={x1 + (2 * r) / dashes} y1={cy} y2={cy} stroke={pal.ink} strokeWidth={1.8 * u} opacity={0.55} />;
      })}
      <Ink d={sketchCircle(cx, cy, r, seed)} p={p} color={pal.ink} w={3.2 * u} />
      <Ink d={sketchCircle(cx, cy, r * 1.004, seed + 'b')} p={p * 0.9} color={pal.ink} w={1.2 * u} opacity={0.45} />
    </g>
  );
};

/** Label block placed in HTML (so it wraps), sliding in from its side. */
const Label: React.FC<{mark: Mark; x: number; y: number; width: number; side: 'left' | 'right' | 'center'; p: number; pal: Pal; size: number}> = ({mark, x, y, width, side, p, pal, size}) => (
  <div
    style={{
      position: 'absolute',
      left: side === 'left' ? x - width : side === 'center' ? x - width / 2 : x,
      top: y - size * 0.68,
      width,
      textAlign: side === 'left' ? 'right' : side === 'center' ? 'center' : 'left',
      opacity: p,
      transform: `translateX(${(1 - p) * (side === 'left' ? 24 : side === 'right' ? -24 : 0)}px) translateY(${side === 'center' ? (1 - p) * 14 : 0}px)`,
    }}
  >
    <div style={{fontFamily: fonts.sans, fontWeight: 800, fontSize: size, lineHeight: 1.12, color: toneColor(pal, mark.tone)}}>{mark.label}</div>
    {mark.detail ? <div style={{fontFamily: fonts.hand, fontSize: size * 0.92, lineHeight: 1.05, color: pal.muted, marginTop: size * 0.08}}>{mark.detail}</div> : null}
  </div>
);

const Badge: React.FC<{x: number; y: number; n: number; color: string; p: number; pal: Pal; u: number}> = ({x, y, n, color, p, pal, u}) => {
  const s = tween(p, [0, 1], [0, 1], ease.overshoot);
  if (p <= 0) return null;
  return (
    <g transform={`translate(${x},${y}) scale(${s})`}>
      <circle r={15 * u} fill={pal.surface} stroke={color} strokeWidth={2.4 * u} />
      <text y={6 * u} textAnchor="middle" fontFamily={fonts.sans} fontWeight={800} fontSize={17 * u} fill={color}>{n}</text>
    </g>
  );
};

/** A drawn arrow; once complete, little ink beads run along it to show the flow. */
const FlowArrow: React.FC<{x1: number; y1: number; x2: number; y2: number; p: number; f: number; color: string; u: number; seed: string; w?: number}> = ({x1, y1, x2, y2, p, f, color, u, seed, w = 3.4}) => {
  const angle = Math.atan2(y2 - y1, x2 - x1);
  const head = Math.min(18 * u, Math.hypot(x2 - x1, y2 - y1) * 0.35);
  return (
    <g>
      <Ink d={sketchLine(x1, y1, x2, y2, seed, 0.03)} p={p} color={color} w={w * u} />
      <Ink d={arrowHead(x2, y2, angle, head)} p={tween(p, [0.8, 1], [0, 1])} color={color} w={w * u} />
      {p >= 1
        ? [0, 1].map(k => {
            const t = ((f / 36 + k / 2 + rand(seed, 0, 1)) % 1) * 0.85;
            return <circle key={k} cx={x1 + (x2 - x1) * t} cy={y1 + (y2 - y1) * t} r={3.4 * u} fill={color} opacity={Math.sin(Math.PI * (t / 0.85)) * 0.8} />;
          })
        : null}
    </g>
  );
};

// ---------------------------------------------------------------------------------------------
// Diagrams
// ---------------------------------------------------------------------------------------------

const GlobeDiagram: React.FC<{step: Step; c: Ctx}> = ({step, c}) => {
  const {f, pal, u, portrait, box} = c;
  const p0 = progress(f, c.start, c.skel, ease.cinematic);
  const size = (portrait ? 30 : 29) * u;
  const marks = step.marks.map((m, j) => ({m, j, lat: (Math.max(-90, Math.min(90, m.at)) * Math.PI) / 180, p: progress(f, c.markAt[j], 22, ease.cinematic)}));
  const belts = marks.filter(x => x.m.arrow === 'none');
  const flows = marks.filter(x => x.m.arrow !== 'none');
  // Labels on one side only: a bigger globe pushed toward the other side frees a wide column.
  const oneSide = !belts.length || !flows.length;
  const r = Math.min(box.h * 0.46, box.w * (portrait ? (oneSide ? 0.32 : 0.25) : 0.2));
  const shift = portrait && oneSide ? (box.w / 2 - r - 10 * u) * (belts.length ? -1 : 1) : 0;
  const cx = box.x + box.w / 2 + shift;
  const cy = box.y + box.h / 2;
  const yOf = (lat: number) => cy - r * Math.sin(lat);
  const gap = size * (step.marks.some(m => m.detail) ? 2.3 : 1.5);
  const rightY = spread(belts.map(b => yOf(b.lat)), gap, box.y + size, box.y + box.h - size);
  const leftY = spread(flows.map(b => yOf(b.lat)), gap, box.y + size, box.y + box.h - size);
  const colGap = 34 * u;
  const rightX = cx + r + colGap + 14 * u;
  const leftX = cx - r - colGap;
  const cap = portrait ? Infinity : box.w * 0.3;
  const rightW = Math.min(cap, box.x + box.w - rightX) - 4;
  const leftW = Math.min(cap, leftX - box.x) - 4;
  return (
    <AbsoluteFill>
      <svg width="100%" height="100%" style={{position: 'absolute', inset: 0, overflow: 'visible'}}>
        <GlobeSketch cx={cx} cy={cy} r={r} p={p0} f={f} pal={pal} u={u} seed={`g${c.start}`} />
        {['N', 'S'].map((t, k) => (
          <text key={t} x={cx} y={k ? cy + r + 30 * u : cy - r - 14 * u} textAnchor="middle" fontFamily={fonts.mono} fontSize={18 * u} letterSpacing="0.2em" fill={pal.muted} opacity={p0}>{t}</text>
        ))}
        {belts.map(({m, j, lat, p}, k) => {
          const y = yOf(lat);
          const half = r * Math.cos(lat);
          const col = toneColor(pal, m.tone);
          return (
            <g key={j}>
              <Ink d={sketchLine(cx - half, y, cx + half, y, `b${c.start}${j}`)} p={p} color={col} w={4 * u} />
              <Ink d={sketchLine(cx + half + 4 * u, y, rightX - 10 * u, rightY[k], `bl${j}`, 0.004)} p={tween(p, [0.4, 1], [0, 1])} color={col} w={1.4 * u} opacity={0.7} />
              <Badge x={cx} y={y} n={j + 1} color={col} p={tween(p, [0.3, 0.8], [0, 1])} pal={pal} u={u} />
            </g>
          );
        })}
        {flows.map(({m, j, lat, p}, k) => {
          const y = yOf(lat);
          const half = Math.max(r * 0.3, r * Math.cos(lat)) * 0.7;
          const col = toneColor(pal, m.tone);
          // shorter arrows near the poles, where the globe narrows
          const len = Math.min(r * 0.22, half * 0.5);
          const sway = Math.sin(f / 14 + j) * 3 * u;
          return (
            <g key={j}>
              {[-0.6, 0, 0.6].map((t, q) => {
                const x = cx + t * half;
                const pq = tween(p, [q * 0.15, 0.7 + q * 0.15], [0, 1]);
                const [x1, y1, x2, y2] =
                  m.arrow === 'east' ? [x - len / 2, y + 6 * u, x + len / 2, y - 6 * u] :
                  m.arrow === 'west' ? [x + len / 2, y + 6 * u, x - len / 2, y - 6 * u] :
                  m.arrow === 'up' ? [x, y + len / 2, x, y - len / 2] :
                  [x, y - len / 2, x, y + len / 2];
                return <FlowArrow key={q} x1={x1 + sway} y1={y1} x2={x2 + sway} y2={y2} p={pq} f={f} color={col} u={u} seed={`fa${j}${q}`} />;
              })}
              <Ink d={sketchLine(leftX + 10 * u, leftY[k], cx - half - len * 0.7, y, `fl${j}`, 0.004)} p={tween(p, [0.5, 1], [0, 1])} color={col} w={1.4 * u} opacity={0.6} />
            </g>
          );
        })}
      </svg>
      {belts.map(({m, j, p}, k) => <Label key={j} mark={m} x={rightX} y={rightY[k]} width={rightW} side="right" p={tween(p, [0.45, 1], [0, 1])} pal={pal} size={size} />)}
      {flows.map(({m, j, p}, k) => <Label key={j} mark={m} x={leftX} y={leftY[k]} width={leftW} side="left" p={tween(p, [0.45, 1], [0, 1])} pal={pal} size={size} />)}
    </AbsoluteFill>
  );
};

const SectionDiagram: React.FC<{step: Step; c: Ctx}> = ({step, c}) => {
  const {f, pal, u, portrait, box} = c;
  const p0 = progress(f, c.start, c.skel, ease.cinematic);
  const ground = box.y + box.h * 0.84;
  const sea = 0.28;
  const ty = (xn: number) => (xn < sea ? ground : ground - box.h * (0.025 + 0.36 * Math.exp(-(((xn - 0.64) / 0.1) ** 2)) + 0.02 * Math.sin(xn * 19)));
  const n = 64;
  const land = Array.from({length: n + 1}, (_, i) => {
    const xn = sea + ((1 - sea) * i) / n;
    return `${i ? 'L' : 'M'}${(box.x + xn * box.w).toFixed(1)},${ty(xn).toFixed(1)}`;
  }).join(' ');
  const shore = `M${box.x + sea * box.w},${ground} ` + land.slice(1);
  const wave = Array.from({length: 40}, (_, i) => {
    const x = box.x + (i / 39) * sea * box.w;
    return `${i ? 'L' : 'M'}${x.toFixed(1)},${(ground + Math.sin(i * 0.9 + f / 9) * 4 * u).toFixed(1)}`;
  }).join(' ');
  const size = (portrait ? 26 : 29) * u;
  const marks = step.marks.map((m, j) => ({m, j, xn: Math.max(0.04, Math.min(0.96, m.at / 100)), p: progress(f, c.markAt[j], 24, ease.cinematic)}));
  const colW = Math.min(box.w * (portrait ? 0.3 : 0.22), box.w / Math.max(1, marks.length) + 40 * u);
  const xs = spread(marks.map(x => box.x + x.xn * box.w), colW, box.x + colW / 2, box.x + box.w - colW / 2);
  const labelY = box.y + size * 0.7;
  const top = box.y + box.h * (portrait ? 0.24 : 0.3);
  return (
    <AbsoluteFill>
      <svg width="100%" height="100%" style={{position: 'absolute', inset: 0, overflow: 'visible'}}>
        <path d={`${shore} L${box.x + box.w},${box.y + box.h} L${box.x + sea * box.w},${box.y + box.h} Z`} fill={alpha(pal.green, pal.dark ? 0.12 : 0.1)} opacity={p0} />
        <rect x={box.x} y={ground} width={sea * box.w} height={box.y + box.h - ground} fill={alpha(pal.cool, 0.14)} opacity={p0} />
        <Ink d={land} p={p0} color={pal.ink} w={3.2 * u} />
        <Ink d={wave} p={p0} color={pal.cool} w={2.6 * u} />
        <Ink d={sketchLine(box.x, box.y + box.h, box.x + box.w, box.y + box.h, 'base')} p={p0} color={pal.ink} w={1.6 * u} opacity={0.5} />
        {/* ground hatching, drawn stroke by stroke */}
        {Array.from({length: 22}, (_, i) => {
          const xn = sea + 0.02 + (i / 22) * (1 - sea - 0.04);
          const x = box.x + xn * box.w;
          const y = ty(xn) + 16 * u;
          if (y + 20 * u > box.y + box.h) return null;
          return <Ink key={i} d={`M${x},${y + 18 * u} L${x + 14 * u},${y}`} p={tween(p0, [i / 30, i / 30 + 0.3], [0, 1])} color={pal.ink} w={1.3 * u} opacity={0.35} />;
        })}
        {marks.map(({m, j, xn, p}, k) => {
          const x = box.x + xn * box.w;
          const col = toneColor(pal, m.tone);
          const low = ty(xn) - box.h * 0.06;
          const mid = (top + low) / 2;
          const span = box.w * 0.08;
          const [x1, y1, x2, y2] =
            m.arrow === 'up' ? [x, low, x, top] :
            m.arrow === 'down' ? [x, top, x, low] :
            m.arrow === 'east' ? [x - span, mid, x + span, mid] :
            m.arrow === 'west' ? [x + span, mid, x - span, mid] :
            [x, low + box.h * 0.06, x, low + box.h * 0.06];
          const anchorY = m.arrow === 'east' || m.arrow === 'west' ? mid - 10 * u : m.arrow === 'none' ? low + box.h * 0.04 : top - 10 * u;
          return (
            <g key={j}>
              {m.arrow === 'none' ? <Badge x={x} y={low + box.h * 0.06} n={j + 1} color={col} p={p} pal={pal} u={u} /> : <FlowArrow x1={x1} y1={y1} x2={x2} y2={y2} p={p} f={f} color={col} u={u} seed={`sa${j}`} w={4.4} />}
              <Ink d={sketchLine(xs[k], labelY + size * (m.detail ? 1.9 : 0.9), x, anchorY, `sl${j}`, 0.004)} p={tween(p, [0.3, 1], [0, 1])} color={col} w={1.3 * u} opacity={0.55} />
            </g>
          );
        })}
      </svg>
      {marks.map(({m, j, p}, k) => <Label key={j} mark={m} x={xs[k]} y={labelY} width={colW - 16 * u} side="center" p={tween(p, [0.35, 1], [0, 1])} pal={pal} size={size} />)}
    </AbsoluteFill>
  );
};

const LayersDiagram: React.FC<{step: Step; c: Ctx}> = ({step, c}) => {
  const {f, pal, u, portrait, box} = c;
  const p0 = progress(f, c.start, c.skel, ease.cinematic);
  const left = box.x + box.w * (portrait ? 0.02 : 0.1);
  const right = box.x + box.w * (portrait ? 0.52 : 0.54);
  const weights = step.marks.map(m => (m.at > 0 ? m.at : 1));
  const total = weights.reduce((a, b) => a + b, 0);
  const minH = box.h * 0.07;
  const raw = weights.map(w => (w / total) * box.h);
  const lifted = raw.map(h => Math.max(minH, h));
  const scale = box.h / lifted.reduce((a, b) => a + b, 0);
  const hs = lifted.map(h => h * scale);
  const tops = hs.map((_, i) => box.y + hs.slice(0, i).reduce((a, b) => a + b, 0));
  const bow = box.h * 0.035;
  const size = (portrait ? 27 : 29) * u;
  const labelX = right + 56 * u;
  const colW = box.x + box.w - labelX;
  const ys = spread(tops.map((t, i) => t + hs[i] / 2), size * (step.marks.some(m => m.detail) ? 2.3 : 1.5), box.y + size, box.y + box.h - size);
  const arc = (y: number, seed: string) => `M${left},${y} Q${(left + right) / 2},${y - bow + rand(seed, -3, 3) * u} ${right},${y}`;
  return (
    <AbsoluteFill>
      <svg width="100%" height="100%" style={{position: 'absolute', inset: 0, overflow: 'visible'}}>
        {step.marks.map((m, j) => {
          const p = progress(f, c.markAt[j], 24, ease.cinematic);
          const col = toneColor(pal, m.tone);
          const y0 = tops[j];
          const y1 = tops[j] + hs[j];
          const fill = `M${left},${y0} Q${(left + right) / 2},${y0 - bow} ${right},${y0} L${right},${y1} Q${(left + right) / 2},${y1 - bow} ${left},${y1} Z`;
          return (
            <g key={j}>
              <path d={fill} fill={alpha(col === pal.ink ? pal.muted : col, pal.dark ? 0.2 : 0.14)} style={{clipPath: `inset(0 ${(1 - p) * 100}% 0 0)`}} />
              {/* dots that hint at material, only in thicker layers */}
              {hs[j] > box.h * 0.12
                ? Array.from({length: 7}, (_, q) => (
                    <circle key={q} cx={left + rand(`ld${j}${q}`, 0.08, 0.92) * (right - left)} cy={y0 + rand(`le${j}${q}`, 0.35, 0.85) * hs[j] + Math.sin(f / 20 + q) * 2 * u} r={rand(`lr${j}${q}`, 2, 4.5) * u} fill={col} opacity={0.35 * p} />
                  ))
                : null}
              <Ink d={arc(y1, `la${j}`)} p={p} color={col} w={3 * u} />
              <Ink d={sketchLine((left + right) / 2 + (right - left) * 0.18, y0 + hs[j] / 2 - bow * 0.6, labelX - 12 * u, ys[j], `ll${j}`, 0.004)} p={tween(p, [0.4, 1], [0, 1])} color={col} w={1.4 * u} opacity={0.6} />
              <circle cx={(left + right) / 2 + (right - left) * 0.18} cy={y0 + hs[j] / 2 - bow * 0.6} r={4.5 * u} fill={col} opacity={tween(p, [0.4, 0.6], [0, 1])} />
            </g>
          );
        })}
        <Ink d={arc(box.y, 'top')} p={p0} color={pal.ink} w={3.4 * u} />
        <Ink d={sketchLine(left, box.y, left, box.y + box.h, 'lft')} p={p0} color={pal.ink} w={3 * u} />
        <Ink d={sketchLine(right, box.y, right, box.y + box.h, 'rgt')} p={p0} color={pal.ink} w={3 * u} />
      </svg>
      {step.marks.map((m, j) => <Label key={j} mark={m} x={labelX} y={ys[j]} width={colW} side="right" p={tween(progress(f, c.markAt[j], 24, ease.cinematic), [0.45, 1], [0, 1])} pal={pal} size={size} />)}
    </AbsoluteFill>
  );
};

const PanelsDiagram: React.FC<{step: Step; c: Ctx}> = ({step, c}) => {
  const {f, pal, u, portrait, box} = c;
  const marks = step.marks.slice(0, 4);
  const n = marks.length;
  const gap = 34 * u;
  const pw = portrait ? box.w : Math.min(box.w * 0.34, (box.w - gap * (n - 1)) / n);
  const ph = portrait ? Math.min(box.h * 0.3, (box.h - gap * (n - 1)) / n) : box.h;
  const x0 = portrait ? box.x : box.x + (box.w - (pw * n + gap * (n - 1))) / 2;
  const y0 = portrait ? box.y + (box.h - (ph * n + gap * (n - 1))) / 2 : box.y;
  const size = 34 * u;
  return (
    <AbsoluteFill>
      {marks.map((m, j) => {
        const p = progress(f, c.markAt[j], 26, ease.cinematic);
        const x = portrait ? x0 : x0 + j * (pw + gap);
        const y = portrait ? y0 + j * (ph + gap) : y0;
        const col = toneColor(pal, m.tone);
        const icon = Math.min(portrait ? ph * 0.62 : pw * 0.5, (portrait ? ph : ph * 0.45) * 0.9);
        const frameD = [sketchLine(4, 4, pw - 4, 6, `pt${j}`), sketchLine(pw - 4, 6, pw - 6, ph - 4, `pr${j}`), sketchLine(pw - 6, ph - 4, 6, ph - 6, `pb${j}`), sketchLine(6, ph - 6, 4, 4, `pl${j}`)].join(' ');
        const arrowP = tween(p, [0.6, 1], [0, 1]);
        const arrow = m.arrow === 'none' ? null : (
          <svg width={40 * u} height={40 * u} style={{overflow: 'visible', flex: 'none'}}>
            <FlowArrow
              x1={m.arrow === 'east' ? 4 * u : m.arrow === 'west' ? 36 * u : 20 * u}
              y1={m.arrow === 'up' ? 36 * u : m.arrow === 'down' ? 4 * u : 20 * u}
              x2={m.arrow === 'east' ? 36 * u : m.arrow === 'west' ? 4 * u : 20 * u}
              y2={m.arrow === 'up' ? 4 * u : m.arrow === 'down' ? 36 * u : 20 * u}
              p={arrowP}
              f={f}
              color={col}
              u={u}
              seed={`pa${j}`}
            />
          </svg>
        );
        return (
          <div key={j} style={{position: 'absolute', left: x, top: y, width: pw, height: ph, opacity: Math.min(1, p * 3), transform: `translateY(${(1 - p) * 30 * u}px) rotate(${rand(`rot${j}`, -0.8, 0.8)}deg)`}}>
            <svg width={pw} height={ph} style={{position: 'absolute', inset: 0, overflow: 'visible'}}>
              <path d={frameD} fill={alpha(pal.surface, pal.dark ? 0.35 : 0.7)} stroke="none" opacity={p} />
              <Ink d={frameD} p={p} color={pal.ink} w={2.6 * u} />
            </svg>
            <div style={{position: 'absolute', inset: 0, display: 'flex', flexDirection: portrait ? 'row' : 'column', alignItems: 'center', justifyContent: portrait ? 'flex-start' : 'center', padding: portrait ? `0 ${36 * u}px` : `${30 * u}px ${24 * u}px`, gap: portrait ? 34 * u : 18 * u}}>
              <div style={{flex: 'none', transform: `translateY(${Math.sin(f / 18 + j * 1.7) * 4 * u}px)`}}>
                <LineIcon name={m.icon} progress={tween(p, [0.15, 1], [0, 1])} size={icon} color={col} strokeWidth={3.4} />
              </div>
              <div style={{textAlign: portrait ? 'left' : 'center', opacity: tween(p, [0.5, 1], [0, 1])}}>
                <div style={{display: 'flex', alignItems: 'center', justifyContent: portrait ? 'flex-start' : 'center', gap: 10 * u, fontFamily: fonts.sans, fontWeight: 800, fontSize: size, lineHeight: 1.1, color: col}}>
                  {m.label}
                  {arrow}
                </div>
                {m.detail ? <div style={{fontFamily: fonts.hand, fontSize: size * 0.95, lineHeight: 1.1, color: pal.muted, marginTop: 8 * u}}>{m.detail}</div> : null}
              </div>
            </div>
            <div style={{position: 'absolute', left: 14 * u, top: 10 * u, fontFamily: fonts.mono, fontSize: 18 * u, color: pal.muted, opacity: p}}>{String.fromCharCode(65 + j)}</div>
          </div>
        );
      })}
    </AbsoluteFill>
  );
};

const DIAGRAMS: Record<Step['diagram'], React.FC<{step: Step; c: Ctx}>> = {globe: GlobeDiagram, section: SectionDiagram, layers: LayersDiagram, panels: PanelsDiagram};

// ---------------------------------------------------------------------------------------------
// The lesson
// ---------------------------------------------------------------------------------------------

const LineArtLesson: React.FC<EntryProps<Props>> = ({media, props}) => {
  const f = useCurrentFrame();
  const {fps, width, height, durationInFrames} = useVideoConfig();
  const look = useLook();
  const base = PALETTES[props.palette];
  const pal: Pal = look ? fromLook(look) : {...base, accent: media.accent ?? base.accent};
  const u = Math.min(width, height) / 1080;
  const portrait = height >= width;
  const timeline = useSceneTimeline(media);
  const content = useContentFrames(media);
  const steps = props.steps;

  // Timing: an extra first narration line is the title card; then one line per step. With fewer
  // lines than steps, steps share the remaining time evenly. Everything ends before the end card.
  const intro = timeline.length > steps.length ? 1 : 0;
  const introEnd = intro ? Math.min(timeline[1].from, content - steps.length * 12) : 0;
  const aligned = timeline.length >= steps.length + intro;
  const starts = steps.map((_, i) => (aligned ? Math.min(timeline[i + intro].from, content - (steps.length - i) * 12) : Math.round(introEnd + ((content - introEnd) * i) / steps.length)));
  const ends = steps.map((_, i) => (i === steps.length - 1 ? content : starts[i + 1]));
  const current = Math.max(0, starts.reduce((acc, s, i) => (f >= s ? i : acc), 0));
  const overlap = Math.round(0.4 * fps);

  // Layout: header band on top, diagram box in the middle, note row, then caption room.
  const padX = width * (portrait ? 0.06 : 0.06);
  const headerH = height * (portrait ? 0.13 : 0.15);
  const bottom = look ? captionSafeBottom(look) * height : props.showCaptions ? height * (portrait ? 0.16 : 0.15) : height * 0.06;
  const noteH = height * (portrait ? 0.07 : 0.085);
  const boxFor = (step: Step): Box => {
    const y = headerH + height * 0.02;
    const h = height - bottom - y - (step.note ? noteH : height * 0.02);
    return {x: padX, y, w: width - padX * 2, h};
  };

  const headerIn = intro ? progress(f, introEnd - 6, 18) : 1;
  return (
    <AbsoluteFill style={{background: pal.bg, overflow: 'hidden'}}>
      {/* static paper: soft falloff to the second tone at the edges */}
      <AbsoluteFill style={{background: `radial-gradient(ellipse 85% 75% at 50% 45%, ${pal.bg} 0%, ${pal.bg} 50%, ${pal.bg2} 100%)`}} />
      <Particles count={18} color={pal.muted} opacity={pal.dark ? 0.22 : 0.14} seed="lesson" speed={0.15} size={[1.5, 3.2]} />

      {steps.map((step, i) => {
        const s = starts[i];
        const e = ends[i];
        const from = i === 0 ? s : s - overlap / 2;
        const to = i === steps.length - 1 ? durationInFrames : e + overlap / 2;
        if (f < from || f >= to) return null;
        const enter = i === 0 && !intro ? 1 : progress(f, from, overlap, ease.cinematic);
        const exit = i === steps.length - 1 ? 0 : progress(f, to - overlap, overlap, ease.cinematic);
        const D = Math.max(1, e - s);
        const skel = Math.round(Math.min(0.9 * fps, D * 0.25));
        const n = step.diagram === 'panels' ? Math.min(4, step.marks.length) : step.marks.length;
        const slot = Math.max(4, (D * 0.62 - skel) / Math.max(1, n));
        const scene = aligned ? timeline[i + intro]?.scene : undefined;
        // Sync each mark to the word that names it, but only when the narration names them in
        // list order; otherwise space them evenly so the drawing never stalls.
        const fallback = step.marks.map((_, j) => s + skel + j * slot);
        const cues = step.marks.map(m => cueFrame(scene, m.label, fps));
        const synced = cues.map((cue, j) => (cue === null ? fallback[j] : Math.max(s + skel * 0.6, Math.min(s + D * 0.78, s + cue - 4))));
        const ordered = synced.every((t, j) => !j || t >= synced[j - 1]);
        const markAt = ordered ? synced : fallback;
        const noteAt = Math.min(s + D * 0.8, Math.max(s + D * 0.5, Math.max(...markAt) + 16));
        const box = boxFor(step);
        const Diagram = DIAGRAMS[step.diagram];
        const push = 1 + 0.025 * tween(f, [s, e], [0, 1], ease.cinematic);
        return (
          <AbsoluteFill key={i} style={{clipPath: `inset(0 0 0 ${(1 - enter) * 100}%)`, transform: `translateX(${(1 - enter) * 4 - exit * 6}%)`, opacity: 1 - exit}}>
            <AbsoluteFill style={{transform: `scale(${push})`, transformOrigin: `50% ${((box.y + box.h / 2) / height) * 100}%`}}>
              <Diagram step={step} c={{f, pal, u, portrait, box, start: s, skel, markAt}} />
            </AbsoluteFill>
            {step.note ? (
              <div style={{position: 'absolute', left: padX, right: padX, top: box.y + box.h + noteH * 0.12, height: noteH * 0.8, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 18 * u}}>
                <svg width={70 * u} height={40 * u} style={{flex: 'none', overflow: 'visible'}}>
                  <Ink d={`M${4 * u},${30 * u} Q${30 * u},${2 * u} ${62 * u},${18 * u}`} p={progress(f, noteAt, 14)} color={pal.accent} w={3 * u} />
                  <Ink d={arrowHead(62 * u, 18 * u, 0.45, 12 * u)} p={progress(f, noteAt + 10, 6)} color={pal.accent} w={3 * u} />
                </svg>
                <KineticText text={step.note} start={noteAt + 4} stagger={2} style="blur" accent={pal.accent} textStyle={{fontFamily: fonts.hand, fontSize: (portrait ? 44 : 48) * u, lineHeight: 1.05, color: pal.text}} />
              </div>
            ) : null}
          </AbsoluteFill>
        );
      })}

      {/* chapter header: number, heading, course label, ruled line, step dots */}
      <div style={{position: 'absolute', left: padX, right: padX, top: headerH * 0.34, opacity: headerIn}}>
        <div style={{display: 'flex', alignItems: 'baseline', gap: 20 * u, flexWrap: portrait ? 'wrap' : 'nowrap'}}>
          <span style={{fontFamily: fonts.mono, fontWeight: 700, fontSize: 34 * u, color: pal.accent}}>{String(current + 1).padStart(2, '0')}</span>
          <KineticText key={current} text={steps[current].heading} start={starts[current] - (current === 0 && !intro ? 0 : 4)} stagger={3} style="rise" accent={pal.accent} textStyle={{fontFamily: fonts.sans, fontWeight: 800, fontSize: (portrait ? 46 : 44) * u, lineHeight: 1.1, color: pal.text}} />
          {props.chapter && !portrait ? <span style={{fontFamily: fonts.hand, fontSize: 34 * u, color: pal.muted, whiteSpace: 'nowrap'}}>{props.chapter}</span> : null}
        </div>
        <svg width={width - padX * 2} height={14 * u} style={{display: 'block', marginTop: 12 * u, overflow: 'visible'}}>
          <Ink d={sketchLine(0, 6 * u, width - padX * 2, 6 * u, 'rule', 0.002)} p={progress(f, intro ? introEnd : 0, 30, ease.cinematic)} color={pal.ink} w={1.6 * u} opacity={0.5} />
          {steps.map((_, i) => {
            const cx = width - padX * 2 - (steps.length - 1 - i) * 26 * u - 8 * u;
            const done = i < current ? 1 : i === current ? progress(f, starts[i], 12, ease.overshoot) : 0;
            return <circle key={i} cx={cx} cy={-30 * u} r={7 * u * (0.7 + 0.3 * done)} fill={done ? pal.accent : 'none'} stroke={done ? pal.accent : pal.muted} strokeWidth={2 * u} opacity={portrait ? 0 : 1} />;
          })}
        </svg>
      </div>

      {/* title card (only when narration has its own opening line) */}
      {intro ? (
        <Sequence durationInFrames={introEnd + 12}>
          <TitleCard props={props} pal={pal} u={u} portrait={portrait} end={introEnd} bottom={bottom} />
          <LightLeak from={0} durationInFrames={Math.round(2.2 * fps)} seed={7} opacity={pal.dark ? 0.45 : 0.18} />
        </Sequence>
      ) : null}

      {props.showCaptions && !look
        ? timeline.map(t => (
            <Sequence key={t.index} from={t.from} durationInFrames={t.durationInFrames}>
              <AbsoluteFill style={{justifyContent: 'flex-end', alignItems: 'center', paddingBottom: height * (portrait ? 0.045 : 0.035)}}>
                <div style={{background: alpha(pal.surface, 0.94), border: `${2 * u}px solid ${alpha(pal.ink, 0.75)}`, borderRadius: 14 * u, padding: `${12 * u}px ${30 * u}px`, maxWidth: portrait ? '88%' : '72%', boxShadow: `0 ${8 * u}px 0 ${alpha(pal.ink, 0.12)}`}}>
                  <StyledCaptions scene={t.scene} variant="minimal" color={pal.text} accent={pal.accent} font={fonts.sans} size={(portrait ? 42 : 38) * u} words={portrait ? 6 : 9} weight={700} shadow={false} />
                </div>
              </AbsoluteFill>
            </Sequence>
          ))
        : null}

      <Vignette strength={pal.dark ? 0.5 : 0.18} color={pal.dark ? '#000000' : pal.ink} />
      <Grain opacity={pal.dark ? 0.07 : 0.05} />
      <NarrationTrack media={media} />
      <AdWeave media={media} theme={{background: pal.bg, text: pal.text, font: fonts.sans}} />
    </AbsoluteFill>
  );
};

const TitleCard: React.FC<{props: Props; pal: Pal; u: number; portrait: boolean; end: number; bottom: number}> = ({props, pal, u, portrait, end, bottom}) => {
  const f = useCurrentFrame();
  const {width, height} = useVideoConfig();
  const out = progress(f, end - 8, 14, ease.accelerate);
  const draw = progress(f, 4, 40, ease.cinematic);
  const r = portrait ? width * 0.25 : height * 0.24;
  const gx = portrait ? width / 2 : width * 0.74;
  const gy = portrait ? height * 0.62 - bottom * 0.3 : height * 0.46;
  const titleSize = (portrait ? 92 : 84) * u;
  return (
    <AbsoluteFill style={{background: `radial-gradient(ellipse 85% 75% at 50% 45%, ${pal.bg} 0%, ${pal.bg} 55%, ${pal.bg2} 100%)`, opacity: 1 - out, transform: `translateY(${-out * 40}px)`}}>
      <svg width={width} height={height} style={{position: 'absolute', inset: 0}}>
        <GlobeSketch cx={gx} cy={gy} r={r} p={draw} f={f} pal={pal} u={u} seed="title" />
        <Ink d={sketchLine(gx - r * 0.97, gy - r * 0.26, gx + r * 0.97, gy - r * 0.26, 't1')} p={progress(f, 30, 20)} color={pal.warm} w={3 * u} />
        <Ink d={sketchLine(gx - r * 0.97, gy + r * 0.26, gx + r * 0.97, gy + r * 0.26, 't2')} p={progress(f, 38, 20)} color={pal.cool} w={3 * u} />
        <Ink d={`M${gx - r * 0.5},${gy - r * 1.18} Q${gx},${gy - r * 1.32} ${gx + r * 0.5},${gy - r * 1.18}`} p={progress(f, 44, 18)} color={pal.accent} w={3 * u} />
        <Ink d={arrowHead(gx + r * 0.5, gy - r * 1.18, 0.35, 14 * u)} p={progress(f, 58, 8)} color={pal.accent} w={3 * u} />
      </svg>
      <div style={{position: 'absolute', left: width * 0.07, width: portrait ? width * 0.86 : width * 0.5, top: portrait ? height * 0.14 : height * 0.26, textAlign: 'left'}}>
        {props.chapter ? (
          <div style={{fontFamily: fonts.mono, fontSize: 24 * u, letterSpacing: '0.24em', textTransform: 'uppercase', color: pal.accent, opacity: progress(f, 2, 14), marginBottom: 22 * u}}>{props.chapter}</div>
        ) : null}
        <KineticText text={props.title} start={6} stagger={4} style="rise" accent={pal.accent} textStyle={{fontFamily: fonts.serifDisplay, fontSize: titleSize, lineHeight: 1.04, color: pal.text}} />
        <svg width={width * 0.36} height={24 * u} style={{display: 'block', overflow: 'visible', marginTop: 10 * u}}>
          <Ink d={`M0,${12 * u} C${width * 0.08},${2 * u} ${width * 0.2},${22 * u} ${width * 0.34},${8 * u}`} p={progress(f, 22, 22, ease.cinematic)} color={pal.accent} w={5 * u} />
        </svg>
        {props.subtitle ? <KineticText text={props.subtitle} start={26} stagger={2} style="blur" textStyle={{fontFamily: fonts.hand, fontSize: 50 * u, lineHeight: 1.1, color: pal.muted, marginTop: 18 * u}} /> : null}
      </div>
    </AbsoluteFill>
  );
};

export default defineEntry({id: 'explainer-line-art-lesson', schema: Props, component: LineArtLesson});
