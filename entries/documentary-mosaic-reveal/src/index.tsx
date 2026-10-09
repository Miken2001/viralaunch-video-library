import React from 'react';
import {AbsoluteFill, Img, Sequence, useCurrentFrame, useVideoConfig} from 'remotion';
import {AdWeave, NarrationTrack, captionSafeBottom, defineEntry, mix, useContentFrames, useLook, useSceneTimeline, type ActiveLook, type EntryProps, type Scene, type TimedScene} from '@viralaunch/kit';
import {Grain, KineticText, LightLeak, Particles, SceneSeries, StyledCaptions, Vignette, alpha, ease, fonts, progress, rand, tween, type Widen} from '@viralaunch/kit/fx';
import {Props, type Motif} from './schema';

const PALETTES = {
  byzantine: {wall: '#120d09', wall2: '#2c1f13', bed: '#3b3026', ground: '#c99a3b', groundAlt: '#e2b85c', c1: '#1f4e9c', c2: '#9b2a22', c3: '#efe6d2', c4: '#2f7a5a', dark: '#1d1611', gold: '#e8bd5c', border: ['#9b2a22', '#1f4e9c'], glass: ['#e8bd5c', '#1f4e9c', '#9b2a22', '#efe6d2', '#2f7a5a'], card: '#efe6d2', cardText: '#1d1610', cardMuted: '#6d5d48', accent: '#e8bd5c', text: '#f3e6cf', muted: '#b8a585', gap: 0.12},
  lapis: {wall: '#05070f', wall2: '#141a33', bed: '#1b1e2b', ground: '#13245a', groundAlt: '#1c3170', c1: '#4a78c9', c2: '#b33a2f', c3: '#ebe5d3', c4: '#2c6b7a', dark: '#070b1c', gold: '#ddb251', border: ['#ddb251', '#ebe5d3'], glass: ['#ddb251', '#ebe5d3', '#4a78c9', '#13245a'], card: '#ebe5d3', cardText: '#111528', cardMuted: '#5c6078', accent: '#ddb251', text: '#ebe5d3', muted: '#9aa0bb', gap: 0.13},
  roman: {wall: '#1b1714', wall2: '#3a2f27', bed: '#8f8574', ground: '#e8dcc4', groundAlt: '#dacbae', c1: '#a4432b', c2: '#26221f', c3: '#c08a3e', c4: '#6b7b4a', dark: '#26221f', gold: '#c99a3b', border: ['#26221f', '#a4432b'], glass: ['#e8dcc4', '#a4432b', '#26221f', '#c08a3e'], card: '#f1e9d8', cardText: '#26221f', cardMuted: '#7a6c5a', accent: '#c08a3e', text: '#f1e9d8', muted: '#b9aa92', gap: 0.1},
  cathedral: {wall: '#050506', wall2: '#1a1530', bed: '#0b0b0e', ground: '#173a7a', groundAlt: '#22489a', c1: '#c0242d', c2: '#e2b63a', c3: '#e9eef5', c4: '#2d8a4e', dark: '#0b0b0e', gold: '#f0c24a', border: ['#c0242d', '#e2b63a'], glass: ['#c0242d', '#e2b63a', '#173a7a', '#2d8a4e', '#7a3a9a'], card: '#e9e4d8', cardText: '#14121a', cardMuted: '#5f5a6e', accent: '#f0c24a', text: '#e9eef5', muted: '#a7a3bd', gap: 0.2},
} as const;
type Pal = Widen<(typeof PALETTES)[keyof typeof PALETTES]>;

/** The mosaic in a sequence's shared look: wall, bed, label card and gold follow the look; tile hues lean toward it. */
const fromLook = (l: ActiveLook, own: Pal): Pal => {
  const p = l.palette;
  const tint = (c: string) => mix(c, p.bg2, 0.2);
  return {
    wall: p.bg, wall2: p.bg2, bed: mix(p.bg, p.line, 0.16),
    ground: mix(own.ground, p.accent, 0.35), groundAlt: mix(own.groundAlt, p.accent, 0.35),
    c1: tint(own.c1), c2: tint(own.c2), c3: mix(own.c3, p.text, 0.3), c4: tint(own.c4), dark: mix(own.dark, p.bg, 0.4),
    gold: mix(own.gold, p.accent, 0.6), border: [mix(own.border[0], p.accent, 0.3), mix(own.border[1], p.bg2, 0.3)],
    glass: own.glass.map(c => mix(c, p.accent, 0.25)),
    card: p.surface, cardText: p.text, cardMuted: p.muted, accent: p.accent, text: p.text, muted: p.muted, gap: own.gap,
  };
};

const TILE_K = {fine: 0.027, medium: 0.037, bold: 0.054} as const;
const MODES = ['swirl', 'sweep', 'rise', 'scatter'] as const;
type Mode = (typeof MODES)[number];

// ---------------------------------------------------------------------------------------------
// Motifs: each maps a cell (square-normalised, y down) to a colour role.
// 0 ground, 1 c1, 2 c2, 3 c3 (light), 4 c4, 5 dark, 6 gold, 7 lone light tile (no outline), 8 night sky
// ---------------------------------------------------------------------------------------------

function inTri(x: number, y: number, a: [number, number], b: [number, number], c: [number, number]) {
  const s = (p: [number, number], q: [number, number]) => (x - q[0]) * (p[1] - q[1]) - (p[0] - q[0]) * (y - q[1]);
  const d1 = s(a, b), d2 = s(b, c), d3 = s(c, a);
  return !((d1 < 0 || d2 < 0 || d3 < 0) && (d1 > 0 || d2 > 0 || d3 > 0));
}
const ell = (x: number, y: number, cx: number, cy: number, rx: number, ry: number) => ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 < 1;

function motifRole(m: Motif, x: number, y: number, seed: string): number {
  const d = Math.hypot(x, y);
  const th = Math.atan2(y, x);
  switch (m) {
    case 'sun': {
      if (d < 0.27) return 6;
      if (d < 0.35) return 2;
      if (d > 0.42 && d < 0.8 && Math.cos(th * 12) > 0.35 + 0.5 * (d - 0.42)) return Math.floor(((th + Math.PI) / (2 * Math.PI)) * 12 + 0.5) % 2 ? 2 : 6;
      return 0;
    }
    case 'moon': {
      if (Math.hypot(x + 0.08, y) < 0.5 && Math.hypot(x - 0.16, y + 0.12) > 0.43) return 6;
      for (const [sx, sy] of [[0.55, -0.6], [-0.62, 0.55], [0.62, 0.48], [-0.5, -0.66]]) if (Math.abs(x - sx) + Math.abs(y - sy) < 0.11) return 6;
      return rand(seed + 'st') > 0.95 ? 7 : 8;
    }
    case 'star': {
      // eight-point star: a square and a diamond laid over each other
      if (d < 0.17) return 2;
      if (Math.max(Math.abs(x), Math.abs(y)) < 0.42 || Math.abs(x) + Math.abs(y) < 0.6) return d < 0.3 ? 6 : 1;
      if (Math.max(Math.abs(x), Math.abs(y)) < 0.5 || Math.abs(x) + Math.abs(y) < 0.7) return 6;
      return rand(seed + 'st') > 0.96 ? 7 : 8;
    }
    case 'tree': {
      const canopy = Math.hypot(x, y + 0.28) < 0.55;
      if (canopy) return rand(seed + 'fr') > 0.86 ? 6 : 4;
      if (y > 0.02 && y < 0.76 && Math.abs(x) < 0.07 + 0.09 * Math.max(0, y - 0.45)) return 5;
      if (y > 0.76) return 1;
      return 0;
    }
    case 'bird': {
      if (Math.hypot(x - 0.48, y + 0.06) < 0.035) return 5;
      if (inTri(x, y, [0.57, -0.1], [0.57, 0.0], [0.7, -0.05])) return 6;
      if (ell(x, y, 0.05, 0.04, 0.42, 0.15) || Math.hypot(x - 0.45, y + 0.05) < 0.13) return 3;
      if (inTri(x, y, [-0.15, 0.02], [0.25, 0.02], [-0.32, -0.66])) return Math.floor((x + y) * 9) % 3 === 0 ? 1 : 3;
      if (inTri(x, y, [-0.36, 0.04], [-0.78, -0.1], [-0.78, 0.24])) return 3;
      if (inTri(x, y, [0.0, 0.08], [0.3, 0.08], [0.12, 0.55])) return 1;
      return 0;
    }
    case 'fish': {
      if (Math.hypot(x + 0.4, y + 0.05) < 0.055) return 5;
      if (ell(x, y, -0.08, 0, 0.55, 0.27)) return y > 0.09 ? 3 : (Math.round(x * 12) + Math.round(y * 12)) % 3 === 0 ? 6 : 1;
      if (inTri(x, y, [0.38, 0], [0.82, -0.34], [0.82, 0.34])) return 2;
      if (inTri(x, y, [-0.1, -0.22], [0.18, -0.24], [0.06, -0.42])) return 2;
      if (y > 0.62 + 0.06 * Math.sin(x * 8)) return 4;
      return 0;
    }
    case 'waves': {
      if (Math.hypot(x - 0.45, y + 0.55) < 0.2) return 6;
      const y0 = -0.08 + 0.1 * Math.sin(x * 5);
      if (y < y0) return 0;
      const band = (y - y0 - 0.06 * Math.sin(x * 9 + 1)) / 0.2;
      const f = band - Math.floor(band);
      if (f < 0.22) return 3;
      return Math.floor(band) % 2 ? 4 : 1;
    }
    case 'halo': {
      if (Math.hypot(x, y + 0.33) < 0.17) return Math.abs(y + 0.36) < 0.025 && Math.abs(Math.abs(x) - 0.06) < 0.03 ? 5 : 3;
      if (Math.hypot(x, y + 0.36) < 0.32) return 6;
      const half = 0.2 + 0.42 * (y + 0.12);
      if (y > -0.14 && Math.abs(x) < half) return Math.abs(x) < 0.05 ? 6 : Math.abs(x) > half - 0.12 ? 2 : 1;
      return 0;
    }
    case 'eye': {
      const lid = 0.36 * (1 - (x / 0.8) ** 2);
      if (Math.abs(x) < 0.8 && Math.abs(y) < lid) return d < 0.1 ? 5 : d < 0.23 ? 1 : 3;
      if (Math.abs(x) < 0.86 && Math.abs(y) < lid + 0.08) return 5;
      if (d < 0.95 && d > 0.5 && Math.cos(th * 16) > 0.72) return 6;
      return 0;
    }
    case 'lotus': {
      if (y > 0.58) return Math.floor((y - 0.58) / 0.12 + Math.sin(x * 6) * 0.3) % 2 ? 3 : 1;
      for (let k = 0; k < 5; k++) {
        const a = -Math.PI / 2 + (k - 2) * 0.5;
        const px = x, py = y - 0.45;
        const along = px * Math.cos(a) + py * Math.sin(a);
        const across = -px * Math.sin(a) + py * Math.cos(a);
        if (((along - 0.42) / 0.42) ** 2 + (across / 0.15) ** 2 < 1) return k === 2 ? 2 : k % 2 ? 3 : 2;
      }
      if (Math.hypot(x, y + 0.42) < 0.09) return 6;
      return 0;
    }
    case 'rosette':
    default: {
      if (d < 0.12) return 6;
      if (d < 0.68 * Math.abs(Math.cos(3 * th)) + 0.04) return d < 0.36 ? 2 : 1;
      if (d > 0.74 && d < 0.8) return 6;
      if (d > 0.8 && d < 0.92 && Math.cos(th * 24) > 0) return 3;
      return 0;
    }
  }
}

// ---------------------------------------------------------------------------------------------
// Geometry and plan
// ---------------------------------------------------------------------------------------------

type Cell = {i: number; c: number; r: number; cx: number; cy: number; rot: number; size: number; nx: number; ny: number; seed: string};
type Layout = {T: number; cols: number; rows: number; px: number; py: number; pw: number; ph: number; card: {x: number; y: number; w: number; h: number}; header: {x: number; y: number}; u: number; side: boolean};

function computeLayout(W: number, H: number, look: ActiveLook | null, caps: boolean, k: number): Layout {
  const u = Math.min(W, H) / 1080;
  const T = Math.max(14, Math.round(Math.min(W, H) * k));
  const safe = look ? captionSafeBottom(look) * H : H * 0.035;
  const side = W > H * 1.2;
  if (side) {
    const top = H * 0.13 + T;
    const bottom = H - Math.max(safe, H * 0.07) - T;
    const left = W * 0.05 + T;
    const right = W * 0.56 - T;
    const cols = Math.floor((right - left) / T), rows = Math.floor((bottom - top) / T);
    const pw = cols * T, ph = rows * T;
    const px = left + (right - left - pw) / 2, py = top + (bottom - top - ph) / 2;
    const cw = W * 0.35;
    const ch = (look ? 300 : caps ? 470 : 300) * u;
    const cy = Math.max(H * 0.13, Math.min(py + ph / 2 - ch / 2, H - safe - ch - 20 * u));
    return {T, cols, rows, px, py, pw, ph, card: {x: W * 0.6, y: cy, w: cw, h: ch}, header: {x: W * 0.05, y: H * 0.045}, u, side};
  }
  const cardH = (look ? 250 : caps ? 420 : 250) * u;
  const top = H * 0.04 + 80 * u + T;
  const bottom = H - safe - cardH - 34 * u - T;
  const areaW = W * 0.88 - 2 * T;
  const cols = Math.floor(areaW / T), rows = Math.max(4, Math.floor((bottom - top) / T));
  const pw = cols * T, ph = rows * T;
  const px = (W - pw) / 2, py = top + Math.max(0, (bottom - top - ph) / 2);
  return {T, cols, rows, px, py, pw, ph, card: {x: px - T, y: py + ph + T + 34 * u, w: pw + 2 * T, h: cardH}, header: {x: px - T, y: H * 0.04}, u, side};
}

function buildCells(L: Layout): Cell[] {
  const out: Cell[] = [];
  const m = Math.min(L.cols, L.rows) / 2;
  for (let r = 0; r < L.rows; r++)
    for (let c = 0; c < L.cols; c++) {
      const seed = `${c}:${r}`;
      out.push({
        i: out.length, c, r, seed,
        cx: (c + 0.5) * L.T + rand(seed + 'ox', -0.03, 0.03) * L.T,
        cy: (r + 0.5) * L.T + rand(seed + 'oy', -0.03, 0.03) * L.T,
        rot: rand(seed + 'rt', -5, 5),
        size: rand(seed + 'sz', 0.95, 1.03),
        nx: (c + 0.5 - L.cols / 2) / m,
        ny: (r + 0.5 - L.rows / 2) / m,
      });
    }
  return out;
}

/** 0..1 arrival order of a cell for an assembly mode. */
function order(mode: Mode, cell: Cell, L: Layout, s: number) {
  const n = rand(`${cell.seed}o${s}`);
  if (mode === 'swirl') return Math.min(1, Math.hypot(cell.nx, cell.ny) / Math.hypot(L.cols, L.rows) * Math.min(L.cols, L.rows)) * 0.85 + n * 0.15;
  if (mode === 'sweep') return ((cell.c / Math.max(1, L.cols - 1) + cell.r / Math.max(1, L.rows - 1)) / 2) * 0.85 + n * 0.15;
  if (mode === 'rise') return (1 - cell.r / Math.max(1, L.rows - 1)) * 0.85 + n * 0.15;
  return n;
}

type Pt = [number, number];
/** Start and control points of a tile's flight (panel coordinates). */
function flightPath(mode: Mode, cell: Cell, L: Layout, s: number, W: number, H: number): [Pt, Pt] {
  const ccx = L.pw / 2, ccy = L.ph / 2;
  const k = `${cell.seed}f${s}`;
  if (mode === 'swirl') {
    const R = 0.8 * Math.max(W, H);
    const phi = Math.atan2(cell.cy - ccy, cell.cx - ccx) + 2.2 + rand(k + 'a', 0, 0.6);
    return [[ccx + R * Math.cos(phi), ccy + R * Math.sin(phi)], [ccx + R * 0.55 * Math.cos(phi - 1.2), ccy + R * 0.55 * Math.sin(phi - 1.2)]];
  }
  if (mode === 'sweep') {
    const S: Pt = [-L.px - rand(k + 'x', 40, 0.4 * W), -L.py - rand(k + 'y', 40, 0.3 * H)];
    return [S, [(S[0] + cell.cx) / 2 + rand(k + 'cx', -0.15, 0.15) * W, (S[1] + cell.cy) / 2 + 0.2 * H]];
  }
  if (mode === 'rise') {
    const S: Pt = [cell.cx + rand(k + 'x', -0.25, 0.25) * W, H - L.py + rand(k + 'y', 40, 0.2 * H)];
    return [S, [cell.cx + rand(k + 'cx', -0.3, 0.3) * W, cell.cy + 0.35 * L.ph]];
  }
  const a = rand(k + 'a', 0, Math.PI * 2);
  const R = rand(k + 'r', 0.25, 0.7) * Math.max(W, H);
  return [[cell.cx + R * Math.cos(a), cell.cy + R * Math.sin(a)], [cell.cx + R * 0.3 * Math.cos(a + 1), cell.cy + R * 0.3 * Math.sin(a + 1)]];
}

const bez = (S: Pt, C: Pt, E: Pt, t: number): Pt => [(1 - t) ** 2 * S[0] + 2 * (1 - t) * t * C[0] + t * t * E[0], (1 - t) ** 2 * S[1] + 2 * (1 - t) * t * C[1] + t * t * E[1]];

type ScenePlan = {start: number; spread: number; mode: Mode; starts: Float32Array};

function buildPlan(timeline: TimedScene[], cells: Cell[], L: Layout, assembly: Props['assembly'], fps: number, contentEnd: number): ScenePlan[] {
  const flight = Math.round(0.55 * fps);
  return timeline.map((t, i) => {
    const mode: Mode = assembly === 'mixed' ? MODES[i % MODES.length] : assembly;
    const spread = Math.round(Math.max(0.7 * fps, Math.min(1.8 * fps, t.durationInFrames * 0.4)));
    const lead = i === 0 ? -Math.round(0.15 * fps) : Math.round(0.3 * fps);
    const start = Math.max(0, Math.min(t.from - lead, contentEnd - spread - flight - Math.round(0.6 * fps)));
    const starts = new Float32Array(cells.length);
    cells.forEach(c => (starts[c.i] = start + order(mode, c, L, i) * spread));
    return {start, spread, mode, starts};
  });
}

// ---------------------------------------------------------------------------------------------
// One scene's mosaic layer
// ---------------------------------------------------------------------------------------------

const PixelateFilter: React.FC<{id: string; L: Layout}> = ({id, L}) => (
  <svg width={0} height={0} style={{position: 'absolute'}}>
    <defs>
      <filter id={id} x={0} y={0} width={L.pw} height={L.ph} filterUnits="userSpaceOnUse" primitiveUnits="userSpaceOnUse" colorInterpolationFilters="sRGB">
        <feFlood x={L.T / 2 - 1} y={L.T / 2 - 1} width={2} height={2} floodColor="#fff" floodOpacity={1} />
        <feComposite x={0} y={0} width={L.T} height={L.T} />
        <feTile result="grid" />
        <feComposite in="SourceGraphic" in2="grid" operator="in" />
        <feMorphology operator="dilate" radius={L.T / 2} />
      </filter>
    </defs>
  </svg>
);

const MosaicLayer: React.FC<{scene: Scene; index: number; motif: Motif; cells: Cell[]; L: Layout; plans: ScenePlan[]; pal: Pal; fps: number}> = ({scene, index, motif, cells, L, plans, pal, fps}) => {
  const frame = useCurrentFrame();
  const {width: W, height: H} = useVideoConfig();
  const plan = plans[index];
  const next = plans[index + 1];
  const flight = Math.round(0.55 * fps);
  const leave = Math.round(0.8 * fps);
  const hasImage = Boolean(scene.video);
  const colors = React.useMemo(() => {
    const roles = cells.map(c => motifRole(motif, c.nx, c.ny, c.seed));
    // figure tiles get an outline; ground, lone sparkles and night sky do not
    const at = (c: number, r: number) => {
      const v = c < 0 || r < 0 || c >= L.cols || r >= L.rows ? 0 : roles[r * L.cols + c];
      return v !== 0 && v < 7;
    };
    const base = [pal.ground, pal.c1, pal.c2, pal.c3, pal.c4, pal.dark, pal.gold, pal.c3, mix(pal.c1, pal.dark, 0.55)];
    return cells.map(c => {
      let role = roles[c.i];
      // A dark outline around every figure keeps the motif readable on any ground.
      if (role === 0 && (at(c.c - 1, c.r) || at(c.c + 1, c.r) || at(c.c, c.r - 1) || at(c.c, c.r + 1))) role = 5;
      const tone = role === 0 && rand(c.seed + 'g') > 0.55 ? pal.groundAlt : base[role];
      const j = rand(c.seed + 'j', -1, 1);
      return {role, fill: j > 0 ? mix(tone, '#ffffff', j * 0.1) : mix(tone, '#000000', -j * 0.16)};
    });
  }, [cells, motif, pal, L.cols, L.rows]);
  const glass = (c: Cell) => (hasImage ? pal.glass[Math.floor(rand(c.seed + 'gl' + index) * pal.glass.length)] : colors[c.i].fill);
  const half = (L.T * (1 - pal.gap) * 0.5);
  const quads: string[] = [];
  const tiles: React.ReactNode[] = [];
  const flyers: React.ReactNode[] = [];
  const gid = `mosaic-gold-${index}`;
  const bid = `mosaic-bevel-${index}`;
  for (const c of cells) {
    const s0 = plan.starts[c.i];
    const land = s0 + flight;
    const dep = next ? next.starts[c.i] : Infinity;
    if (frame < s0 || frame >= dep + leave) continue;
    if (frame < land) {
      // in flight toward its cell
      const t = progress(frame, s0, flight, ease.snappy);
      const [S, C] = flightPath(plan.mode, c, L, index, W, H);
      const [x, y] = bez(S, C, [c.cx, c.cy], t);
      const rot = (1 - t) * rand(c.seed + 'r0' + index, -260, 260) + t * c.rot;
      const fh = half * (0.65 + 0.35 * t);
      flyers.push(<rect key={'f' + c.i} x={x - fh} y={y - fh} width={fh * 2} height={fh * 2} rx={fh * 0.12} fill={glass(c)} opacity={Math.min(1, t * 5)} transform={`rotate(${rot} ${x} ${y})`} />);
      continue;
    }
    if (frame >= dep) {
      // lifting off as the next scene's tile flies in
      const t = progress(frame, dep, leave, ease.accelerate);
      const k = c.seed + 'd' + index;
      const E: Pt = [c.cx + rand(k + 'x', -0.35, 0.35) * L.pw, c.cy - rand(k + 'y', 0.4, 0.9) * L.ph];
      const [x, y] = bez([c.cx, c.cy], [c.cx + rand(k + 'c', -0.1, 0.1) * L.pw, c.cy - 0.12 * L.ph], E, t);
      const rot = c.rot + t * rand(k + 'r', -220, 220);
      flyers.push(<rect key={'d' + c.i} x={x - half} y={y - half} width={half * 2} height={half * 2} rx={half * 0.12} fill={glass(c)} opacity={1 - t} transform={`rotate(${rot} ${x} ${y})`} />);
      continue;
    }
    // set in the bed: a click on landing, then an occasional breath
    const click = 1 - progress(frame, land, 7, ease.snappy);
    const breath = Math.max(0, Math.sin(frame * 0.045 + rand(c.seed + 'b', 0, 40))) ** 40;
    const s = c.size * (1 + 0.22 * click + 0.07 * breath);
    const h = half * s;
    const wave = Math.max(0, Math.sin((c.cx + c.cy * 0.6) / (L.T * 5) - frame * 0.07)) ** 10;
    if (hasImage) {
      const a = (c.rot * Math.PI) / 180, ca = Math.cos(a) * h, sa = Math.sin(a) * h;
      quads.push(`M${c.cx - ca + sa},${c.cy - sa - ca}L${c.cx + ca + sa},${c.cy + sa - ca}L${c.cx + ca - sa},${c.cy + sa + ca}L${c.cx - ca - sa},${c.cy - sa + ca}Z`);
    } else {
      const gold = colors[c.i].role === 6;
      tiles.push(<rect key={'t' + c.i} x={c.cx - h} y={c.cy - h} width={h * 2} height={h * 2} rx={h * 0.1} fill={gold ? `url(#${gid})` : colors[c.i].fill} transform={`rotate(${c.rot} ${c.cx} ${c.cy})`} />);
    }
    tiles.push(<rect key={'b' + c.i} x={c.cx - h} y={c.cy - h} width={h * 2} height={h * 2} rx={h * 0.1} fill={`url(#${bid})`} opacity={0.55 + 0.45 * wave} transform={`rotate(${c.rot} ${c.cx} ${c.cy})`} />);
    if (click > 0) tiles.push(<rect key={'k' + c.i} x={c.cx - h} y={c.cy - h} width={h * 2} height={h * 2} fill={pal.gold} opacity={click * 0.7} transform={`rotate(${c.rot} ${c.cx} ${c.cy})`} style={{mixBlendMode: 'screen'}} />);
  }
  const fid = `mosaic-pix-${index}`;
  return (
    <AbsoluteFill style={{pointerEvents: 'none'}}>
      {hasImage ? (
        <>
          <PixelateFilter id={fid} L={L} />
          <div style={{position: 'absolute', left: L.px, top: L.py, width: L.pw, height: L.ph, clipPath: quads.length ? `path('${quads.join('')}')` : 'inset(50%)', filter: `url(#${fid})`}}>
            <Img src={scene.video} style={{width: '100%', height: '100%', objectFit: 'cover', filter: `blur(${L.T * 0.28}px) saturate(1.2) contrast(1.06)`}} />
          </div>
        </>
      ) : null}
      <svg width={W} height={H} style={{position: 'absolute', inset: 0, overflow: 'visible'}}>
        <defs>
          <linearGradient id={gid} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor={mix(pal.gold, '#ffffff', 0.45)} />
            <stop offset="0.45" stopColor={pal.gold} />
            <stop offset="1" stopColor={mix(pal.gold, '#000000', 0.35)} />
          </linearGradient>
          <linearGradient id={bid} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#ffffff" stopOpacity={0.42} />
            <stop offset="0.35" stopColor="#ffffff" stopOpacity={0} />
            <stop offset="0.7" stopColor="#000000" stopOpacity={0} />
            <stop offset="1" stopColor="#000000" stopOpacity={0.4} />
          </linearGradient>
        </defs>
        <g transform={`translate(${L.px} ${L.py})`}>
          {tiles}
          {flyers}
        </g>
      </svg>
    </AbsoluteFill>
  );
};

// ---------------------------------------------------------------------------------------------
// Frame, wall and label
// ---------------------------------------------------------------------------------------------

/** The tiled border, laid clockwise in the first second, then still. */
const Border: React.FC<{L: Layout; pal: Pal; fps: number}> = ({L, pal, fps}) => {
  const frame = useCurrentFrame();
  const {T, cols, rows} = L;
  const ring: Pt[] = [];
  for (let c = -1; c <= cols; c++) ring.push([c, -1]);
  for (let r = 0; r <= rows; r++) ring.push([cols, r]);
  for (let c = cols - 1; c >= -1; c--) ring.push([c, rows]);
  for (let r = rows - 1; r >= 0; r--) ring.push([-1, r]);
  const len = Math.round(1.1 * fps);
  const h = T * 0.42;
  return (
    <svg width={L.pw + 2 * T} height={L.ph + 2 * T} style={{position: 'absolute', left: L.px - T, top: L.py - T, overflow: 'visible'}}>
      {ring.map(([c, r], i) => {
        const p = progress(frame, (i / ring.length) * len, 8, ease.overshoot);
        if (p <= 0) return null;
        const corner = (c === -1 || c === cols) && (r === -1 || r === rows);
        const x = (c + 1.5) * T, y = (r + 1.5) * T;
        const fill = corner ? pal.gold : i % 3 === 2 ? pal.gold : pal.border[Math.floor(i / 3) % 2];
        return <rect key={i} x={x - h} y={y - h} width={h * 2} height={h * 2} rx={h * 0.15} fill={mix(fill, '#000000', rand(`bd${i}`, 0, 0.15))} transform={`rotate(${rand(`br${i}`, -6, 6)} ${x} ${y}) translate(${x} ${y}) scale(${p}) translate(${-x} ${-y})`} />;
      })}
    </svg>
  );
};

/** A few gold glints twinkling on random tiles. */
const Glints: React.FC<{L: Layout; color: string}> = ({L, color}) => {
  const frame = useCurrentFrame();
  const win = 24;
  return (
    <svg width={L.pw} height={L.ph} style={{position: 'absolute', left: L.px, top: L.py, overflow: 'visible', mixBlendMode: 'screen'}}>
      {Array.from({length: 7}, (_, k) => {
        const slot = Math.floor((frame + k * 7) / win);
        const t = ((frame + k * 7) % win) / win;
        const x = (Math.floor(rand(`gx${k}${slot}`) * L.cols) + 0.5) * L.T;
        const y = (Math.floor(rand(`gy${k}${slot}`) * L.rows) + 0.5) * L.T;
        const a = Math.sin(Math.PI * t);
        const s = L.T * (0.4 + 0.5 * a);
        return <path key={k} d={`M${x},${y - s}Q${x},${y} ${x + s},${y}Q${x},${y} ${x},${y + s}Q${x},${y} ${x - s},${y}Q${x},${y} ${x},${y - s}Z`} fill={color} opacity={a * 0.9} />;
      })}
    </svg>
  );
};

const Placard: React.FC<{panel: Props['panels'][number]; index: number; total: number; pal: Pal; L: Layout; enterAt: number}> = ({panel, index, total, pal, L, enterAt}) => {
  const frame = useCurrentFrame();
  const {u, card} = L;
  const rule = progress(frame, enterAt + 10, 22, ease.expo);
  return (
    <div style={{position: 'absolute', left: card.x + 44 * u, top: card.y + 34 * u, width: card.w - 88 * u, color: pal.cardText}}>
      <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontFamily: fonts.mono, fontSize: 21 * u, letterSpacing: '0.24em', color: pal.cardMuted, opacity: progress(frame, enterAt, 12)}}>
        <span>PANEL {String(index + 1).padStart(2, '0')} / {String(total).padStart(2, '0')}</span>
        <span style={{display: 'flex', gap: 5 * u}}>
          {[pal.gold, pal.c1, pal.c2].map((c, i) => <span key={i} style={{width: 13 * u, height: 13 * u, background: c, transform: `rotate(${(i - 1) * 6}deg) scale(${progress(frame, enterAt + 4 + i * 3, 8, ease.overshoot)})`}} />)}
        </span>
      </div>
      <div style={{marginTop: 14 * u}}>
        <KineticText text={panel.label} start={enterAt + 4} stagger={3} style="rise" textStyle={{fontFamily: fonts.serifDisplay, fontSize: (L.side ? 56 : 54) * u, lineHeight: 1.06, color: pal.cardText}} />
      </div>
      {panel.note ? <div style={{marginTop: 10 * u, fontFamily: fonts.serif, fontStyle: 'italic', fontSize: 29 * u, lineHeight: 1.25, color: pal.cardMuted, opacity: progress(frame, enterAt + 14, 16), transform: `translateY(${(1 - progress(frame, enterAt + 14, 16)) * 10 * u}px)`}}>{panel.note}</div> : null}
      <div style={{marginTop: 18 * u, height: 2 * u, width: `${rule * 38}%`, background: pal.gold}} />
    </div>
  );
};

const MosaicReveal: React.FC<EntryProps<Props>> = ({media, props}) => {
  const frame = useCurrentFrame();
  const {fps, width: W, height: H} = useVideoConfig();
  const look = useLook();
  const own: Pal = PALETTES[props.palette];
  const pal: Pal = look ? fromLook(look, own) : {...own, gold: media.accent ?? own.gold, accent: media.accent ?? own.accent};
  const contentEnd = useContentFrames(media);
  const timeline = useSceneTimeline(media);
  const caps = props.showCaptions && media.captions && !look;
  const L = React.useMemo(() => computeLayout(W, H, look, caps, TILE_K[props.tiles]), [W, H, look, caps, props.tiles]);
  const cells = React.useMemo(() => buildCells(L), [L]);
  const plans = React.useMemo(() => buildPlan(timeline, cells, L, props.assembly, fps, contentEnd), [timeline, cells, L, props.assembly, fps, contentEnd]);
  const flight = Math.round(0.55 * fps);
  const {u, card} = L;
  const cardIn = progress(frame, Math.round(0.5 * fps), 20, ease.expo);
  const panelOf = (i: number) => props.panels[Math.min(i, props.panels.length - 1)];
  const overlap = Math.round(0.45 * fps);
  return (
    <AbsoluteFill style={{background: pal.wall, overflow: 'hidden'}}>
      {/* gallery wall, lit from above */}
      <AbsoluteFill style={{background: `radial-gradient(ellipse 70% 55% at 50% ${L.side ? 30 : 22}%, ${alpha(pal.wall2, 0.95)} 0%, ${alpha(pal.wall2, 0.35)} 45%, transparent 75%)`}} />
      <Particles count={36} color={pal.gold} opacity={0.3} seed="gold-dust" speed={0.2} size={[1.5, 3.5]} />
      {/* panel shadow and bed */}
      <div style={{position: 'absolute', left: L.px - L.T, top: L.py - L.T, width: L.pw + 2 * L.T, height: L.ph + 2 * L.T, boxShadow: `0 ${40 * u}px ${90 * u}px rgba(0,0,0,.5)`, background: pal.bed, opacity: progress(frame, 0, 10)}} />
      <div style={{position: 'absolute', left: L.px, top: L.py, width: L.pw, height: L.ph, background: `radial-gradient(circle at 40% 30%, ${mix(pal.bed, '#ffffff', 0.08)} 0%, ${pal.bed} 60%, ${mix(pal.bed, '#000000', 0.25)} 100%)`}} />
      <Border L={L} pal={pal} fps={fps} />
      {timeline.map((t, i) => {
        const from = plans[i].start;
        const next = plans[i + 1];
        const until = next ? next.start + next.spread + flight + Math.round(0.9 * fps) : Infinity;
        if (frame < from || frame >= until) return null;
        return <MosaicLayer key={i} scene={t.scene} index={i} motif={panelOf(i).motif} cells={cells} L={L} plans={plans} pal={pal} fps={fps} />;
      })}
      {/* gold light sweeping across the finished panel */}
      {plans.map((p, i) => {
        const at = p.start + p.spread + flight;
        const s = tween(frame, [at, at + Math.round(1.3 * fps)], [-30, 130], ease.cinematic);
        if (frame < at || frame > at + 1.3 * fps) return null;
        return <div key={i} style={{position: 'absolute', left: L.px, top: L.py, width: L.pw, height: L.ph, mixBlendMode: 'screen', background: `linear-gradient(110deg, transparent ${s - 18}%, ${alpha(pal.gold, 0.45)} ${s}%, transparent ${s + 18}%)`}} />;
      })}
      <Glints L={L} color={mix(pal.gold, '#ffffff', 0.5)} />
      {/* gallery header */}
      {props.title ? (
        <div style={{position: 'absolute', left: L.header.x, top: L.header.y, right: W * 0.05, display: 'flex', alignItems: 'center', gap: 18 * u}}>
          <div style={{width: 18 * u, height: 18 * u, background: pal.gold, transform: `rotate(45deg) scale(${progress(frame, 2, 12, ease.overshoot)})`, flexShrink: 0}} />
          <KineticText text={props.title} start={6} stagger={3} style="blur" textStyle={{fontFamily: fonts.serif, fontStyle: 'italic', fontSize: 40 * u, color: pal.text, lineHeight: 1.1}} />
        </div>
      ) : null}
      {/* museum label */}
      <div style={{position: 'absolute', left: card.x, top: card.y, width: card.w, height: card.h, background: pal.card, borderRadius: 6 * u, boxShadow: `0 ${18 * u}px ${50 * u}px rgba(0,0,0,.35)`, clipPath: `inset(0 ${(1 - cardIn) * 100}% 0 0)`, transform: `translateY(${(1 - cardIn) * 20 * u}px)`}}>
        <div style={{position: 'absolute', left: 0, top: 0, bottom: 0, width: 6 * u, background: pal.gold}} />
      </div>
      <SceneSeries
        media={media}
        overlap={overlap}
        transition="blur"
        renderScene={({index}) => <Placard panel={panelOf(index)} index={index} total={timeline.length} pal={pal} L={L} enterAt={index === 0 ? Math.round(0.6 * fps) : Math.floor(overlap / 2) + 2} />}
      />
      {caps
        ? timeline.map(t => (
            <Sequence key={t.index} from={t.from} durationInFrames={t.durationInFrames}>
              <div style={{position: 'absolute', left: card.x + 44 * u, width: card.w - 88 * u, top: card.y + card.h - (L.side ? 170 : 150) * u, opacity: cardIn}}>
                <StyledCaptions scene={t.scene} variant="minimal" color={pal.cardText} font={fonts.serif} size={38 * u} words={L.side ? 8 : 7} align="left" shadow={false} />
              </div>
            </Sequence>
          ))
        : null}
      {timeline.slice(1).map(t => <LightLeak key={t.index} from={plans[t.index].start} durationInFrames={Math.round(1.2 * fps)} seed={t.index * 5 + 2} opacity={0.22} />)}
      <Vignette strength={0.55} />
      <Grain opacity={0.06} />
      <NarrationTrack media={media} />
      <AdWeave media={media} theme={{background: pal.wall, text: pal.text, font: fonts.serif}} />
    </AbsoluteFill>
  );
};

export default defineEntry({id: 'documentary-mosaic-reveal', schema: Props, component: MosaicReveal});
