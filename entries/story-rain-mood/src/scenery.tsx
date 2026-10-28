/**
 * The drawn world of the rain-mood short: layered 2D landscapes that slide past each other at
 * different speeds (2.5D parallax), silhouette figures, and screen-space weather.
 * Everything is plain SVG/CSS, seeded and deterministic.
 */
import React from 'react';
import {AbsoluteFill} from 'remotion';
import {mix} from '@viralaunch/kit';
import {alpha, rand} from '@viralaunch/kit/fx';
import type {Shot} from './schema';

export type Pal = {
  skyTop: string;
  horizon: string;
  glow: string;
  ink: string;
  accent: string;
  text: string;
  muted: string;
  fog: string;
  precip: string;
  light: boolean;
};

/** Geometry shared by every layer of one shot. */
export type Stage = {W: number; H: number; u: number; horizon: number; ground: number; portrait: boolean};

/** Atmospheric perspective: far layers melt into the horizon, near ones turn to ink. */
const layer = (p: Pal, depth: number) => mix(p.horizon, p.ink, depth);

// ---------------------------------------------------------------------------------------------
// Path builders
// ---------------------------------------------------------------------------------------------

function ridge(seed: string, x0: number, w: number, bottom: number, base: number, amp: number, steps: number, jagged = false) {
  const ys = Array.from({length: steps + 1}, (_, i) => base - amp * (0.6 * rand(`${seed}a${i}`) + 0.4 * rand(`${seed}b${Math.floor(i / 3)}`)));
  const d = [`M${x0},${bottom}`, `L${x0},${ys[0]}`];
  for (let i = 1; i <= steps; i++) {
    const xa = x0 + ((i - 1) / steps) * w;
    const xb = x0 + (i / steps) * w;
    d.push(jagged ? `L${xb},${ys[i]}` : `Q${xa},${ys[i - 1]} ${(xa + xb) / 2},${(ys[i - 1] + ys[i]) / 2}`);
  }
  d.push(`L${x0 + w},${ys[steps]}`, `L${x0 + w},${bottom}`, 'Z');
  return d.join(' ');
}

/** A row of conifers standing on `base`. */
function conifers(seed: string, x0: number, w: number, base: number, hMin: number, hMax: number, count: number) {
  const d: string[] = [];
  for (let i = 0; i < count; i++) {
    const x = x0 + ((i + rand(`${seed}x${i}`, 0.1, 0.9)) / count) * w;
    const h = rand(`${seed}h${i}`, hMin, hMax);
    const hw = h * 0.21;
    const b = base + rand(`${seed}b${i}`, 0, h * 0.06);
    d.push(`M${x - hw},${b} L${x - hw * 0.45},${b - h * 0.33} L${x - hw * 0.72},${b - h * 0.33} L${x - hw * 0.3},${b - h * 0.64} L${x - hw * 0.5},${b - h * 0.64} L${x},${b - h} L${x + hw * 0.5},${b - h * 0.64} L${x + hw * 0.3},${b - h * 0.64} L${x + hw * 0.72},${b - h * 0.33} L${x + hw * 0.45},${b - h * 0.33} L${x + hw},${b} Z`);
  }
  return d.join(' ');
}

type Block = {x: number; w: number; top: number};
function blocks(seed: string, x0: number, w: number, base: number, amp: number, u: number): Block[] {
  const out: Block[] = [];
  let x = x0;
  let i = 0;
  while (x < x0 + w) {
    const bw = rand(`${seed}w${i}`, 60, 150) * u;
    out.push({x, w: bw, top: base - rand(`${seed}h${i}`, amp * 0.35, amp)});
    x += bw + rand(`${seed}g${i}`, 0, 10) * u;
    i++;
  }
  return out;
}
const blockPath = (bs: Block[], bottom: number) => bs.map(b => `M${b.x},${bottom} L${b.x},${b.top} L${b.x + b.w},${b.top} L${b.x + b.w},${bottom} Z`).join(' ');

/** Lit windows of a block row; a few of them breathe. */
const Windows: React.FC<{bs: Block[]; base: number; color: string; u: number; frame: number; seed: string; density: number}> = ({bs, base, color, u, frame, seed, density}) => {
  const cells: React.ReactNode[] = [];
  const step = 26 * u;
  bs.forEach((b, bi) => {
    const cols = Math.max(1, Math.floor((b.w - 16 * u) / step));
    const rows = Math.max(1, Math.floor((base - b.top - 20 * u) / (step * 1.2)));
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const k = `${seed}${bi}-${r}-${c}`;
        if (rand(k) > density) continue;
        const breathe = rand(`${k}f`) > 0.9 ? 0.55 + 0.45 * Math.sin(frame / 14 + bi) : 1;
        cells.push(<rect key={k} x={b.x + 10 * u + c * step} y={b.top + 14 * u + r * step * 1.2} width={9 * u} height={13 * u} fill={color} opacity={rand(`${k}o`, 0.35, 0.95) * breathe} />);
      }
    }
  });
  return <>{cells}</>;
};

// ---------------------------------------------------------------------------------------------
// Settings
// ---------------------------------------------------------------------------------------------

type SetProps = {shot: Shot; p: Pal; s: Stage; frame: number; pan: (depth: number) => number; id: string};

/** Parallax group: shifts with the camera in proportion to its depth. */
const Layer: React.FC<{pan: (d: number) => number; depth: number; children: React.ReactNode}> = ({pan, depth, children}) => <g transform={`translate(${pan(depth)},0)`}>{children}</g>;

const Water: React.FC<SetProps & {reflect?: string}> = ({p, s, frame, id, reflect}) => {
  const {W, H, u, horizon, ground} = s;
  const rows = 9;
  return (
    <>
      <defs>
        <linearGradient id={`${id}-water`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={layer(p, 0.2)} />
          <stop offset="1" stopColor={layer(p, 0.7)} />
        </linearGradient>
      </defs>
      <rect x={-W * 0.2} y={horizon} width={W * 1.4} height={H - horizon} fill={`url(#${id}-water)`} />
      {reflect ? <path d={reflect} transform={`translate(0 ${2 * horizon}) scale(1 -1)`} fill={layer(p, 0.45)} opacity={0.35} /> : null}
      {Array.from({length: rows}, (_, r) => {
        const k = r / rows;
        const y = horizon + (ground - horizon) * (k * k * 0.9 + 0.04);
        return Array.from({length: 5}, (_, i) => {
          const len = (30 + 90 * k) * u * rand(`${id}sl${r}${i}`, 0.6, 1.4);
          const x = ((rand(`${id}sx${r}${i}`) * W * 1.3 + frame * (0.3 + k * 1.2)) % (W * 1.3)) - W * 0.15;
          return <line key={`${r}-${i}`} x1={x} x2={x + len} y1={y} y2={y} stroke={p.glow} strokeWidth={(1 + 1.5 * k) * u} opacity={0.12 + 0.12 * k} strokeLinecap="round" />;
        });
      })}
    </>
  );
};

const Mountains: React.FC<SetProps> = ({p, s, pan, id}) => {
  const {W, H, horizon} = s;
  return (
    <>
      <Layer pan={pan} depth={0.15}><path d={ridge(`${id}m0`, -W * 0.2, W * 1.4, H, horizon - H * 0.02, H * 0.3, 11, true)} fill={layer(p, 0.22)} /></Layer>
      <Layer pan={pan} depth={0.4}><path d={ridge(`${id}m1`, -W * 0.2, W * 1.4, H, horizon + H * 0.04, H * 0.2, 9, true)} fill={layer(p, 0.45)} /></Layer>
      <Layer pan={pan} depth={0.7}><path d={ridge(`${id}m2`, -W * 0.2, W * 1.4, H, horizon + H * 0.12, H * 0.09, 12)} fill={layer(p, 0.7)} /></Layer>
    </>
  );
};

const Forest: React.FC<SetProps> = ({p, s, pan, id}) => {
  const {W, H, horizon} = s;
  return (
    <>
      <Layer pan={pan} depth={0.15}><path d={ridge(`${id}f0`, -W * 0.2, W * 1.4, H, horizon - H * 0.04, H * 0.16, 12)} fill={layer(p, 0.22)} /></Layer>
      <Layer pan={pan} depth={0.4}>
        <path d={conifers(`${id}t1`, -W * 0.2, W * 1.4, horizon + H * 0.04, H * 0.08, H * 0.15, 46)} fill={layer(p, 0.45)} />
        <rect x={-W * 0.2} y={horizon + H * 0.04} width={W * 1.4} height={H} fill={layer(p, 0.45)} />
      </Layer>
      <Layer pan={pan} depth={0.7}>
        <path d={conifers(`${id}t2`, -W * 0.2, W * 1.4, horizon + H * 0.13, H * 0.14, H * 0.28, 22)} fill={layer(p, 0.7)} />
        <rect x={-W * 0.2} y={horizon + H * 0.13} width={W * 1.4} height={H} fill={layer(p, 0.7)} />
      </Layer>
    </>
  );
};

const Lake: React.FC<SetProps> = props => {
  const {p, s, pan, id} = props;
  const {W, H, horizon} = s;
  const far = ridge(`${id}l0`, -W * 0.2, W * 1.4, horizon, horizon, H * 0.2, 10, true);
  return (
    <>
      <Layer pan={pan} depth={0.15}><path d={far} fill={layer(p, 0.3)} /></Layer>
      <Layer pan={pan} depth={0.3}>
        <path d={conifers(`${id}lt`, -W * 0.2, W * 1.4, horizon, H * 0.025, H * 0.05, 70)} fill={layer(p, 0.5)} />
      </Layer>
      <Layer pan={pan} depth={0.15}><Water {...props} reflect={far} /></Layer>
    </>
  );
};

const Coast: React.FC<SetProps> = props => {
  const {p, s, frame, pan, id} = props;
  const {W, H, u, horizon, ground} = s;
  const left = rand(`${id}side`) > 0.5;
  const cx = left ? W * 0.12 : W * 0.88;
  const top = horizon - H * 0.1;
  const lamp = {x: cx, y: top - H * 0.13};
  const sweep = Math.cos(frame / 34);
  const reach = W * 0.9;
  return (
    <>
      <Layer pan={pan} depth={0.15}><path d={ridge(`${id}c0`, -W * 0.2, W * 1.4, horizon, horizon + 1, H * 0.035, 8)} fill={layer(p, 0.3)} /></Layer>
      <Water {...props} />
      <Layer pan={pan} depth={0.55}>
        <defs>
          <linearGradient id={`${id}-beam`} x1={sweep > 0 ? '0' : '1'} y1="0" x2={sweep > 0 ? '1' : '0'} y2="0">
            <stop offset="0" stopColor={p.glow} stopOpacity={0.45} />
            <stop offset="1" stopColor={p.glow} stopOpacity={0} />
          </linearGradient>
        </defs>
        <path d={`M${lamp.x},${lamp.y} L${lamp.x + reach * sweep},${lamp.y - H * 0.05 * Math.abs(sweep)} L${lamp.x + reach * sweep},${lamp.y + H * 0.05 * Math.abs(sweep)} Z`} fill={`url(#${id}-beam)`} />
        <path d={`M${cx - W * 0.2},${H} L${cx - W * 0.16},${top + H * 0.02} Q${cx},${top - H * 0.02} ${cx + W * 0.16},${top + H * 0.02} L${cx + W * 0.2},${H} Z`} fill={layer(p, 0.62)} />
        <path d={`M${cx - 16 * u},${top} L${cx - 11 * u},${lamp.y + 12 * u} L${cx + 11 * u},${lamp.y + 12 * u} L${cx + 16 * u},${top} Z`} fill={layer(p, 0.75)} />
        <circle cx={lamp.x} cy={lamp.y} r={9 * u} fill={p.glow} />
        <circle cx={lamp.x} cy={lamp.y} r={40 * u} fill={p.glow} opacity={0.18 + 0.12 * Math.abs(sweep)} />
      </Layer>
      <Layer pan={pan} depth={0.9}><path d={ridge(`${id}c2`, -W * 0.2, W * 1.4, H, ground + H * 0.02, H * 0.04, 16, true)} fill={layer(p, 0.92)} /></Layer>
    </>
  );
};

const City: React.FC<SetProps> = ({p, s, frame, pan, id}) => {
  const {W, H, u, horizon, ground} = s;
  const far = blocks(`${id}b0`, -W * 0.2, W * 1.4, horizon + H * 0.02, H * 0.2, u * 0.8);
  const near = blocks(`${id}b1`, -W * 0.2, W * 1.4, ground - H * 0.02, H * 0.36, u * 1.4);
  return (
    <>
      <Layer pan={pan} depth={0.2}>
        <path d={blockPath(far, H)} fill={layer(p, 0.35)} />
        <Windows bs={far} base={horizon} color={p.accent} u={u * 0.7} frame={frame} seed={`${id}w0`} density={0.18} />
      </Layer>
      <Layer pan={pan} depth={0.4}>
        {Array.from({length: 26}, (_, i) => {
          const x = rand(`${id}bk${i}`, -0.1, 1.1) * W;
          const y = horizon + rand(`${id}by${i}`, -0.12, 0.08) * H;
          const r = rand(`${id}br${i}`, 14, 42) * u;
          const c = rand(`${id}bc${i}`) > 0.6 ? p.glow : p.accent;
          return <circle key={i} cx={x} cy={y + Math.sin(frame / 50 + i) * 4 * u} r={r} fill={c} opacity={0.1 + 0.12 * rand(`${id}bo${i}`)} />;
        })}
      </Layer>
      <Layer pan={pan} depth={0.65}>
        <path d={blockPath(near, H)} fill={layer(p, 0.72)} />
        <Windows bs={near} base={ground - H * 0.03} color={p.accent} u={u * 1.1} frame={frame} seed={`${id}w1`} density={0.3} />
      </Layer>
      <WetGround {...{p, s, pan, id}} lights={near.filter((_, i) => rand(`${id}rl${i}`) > 0.45).map(b => b.x + b.w / 2)} />
    </>
  );
};

/** Wet ground plane with long reflections under the lights. */
const WetGround: React.FC<{p: Pal; s: Stage; pan: (d: number) => number; id: string; lights: number[]}> = ({p, s, pan, id, lights}) => {
  const {W, H, u, ground} = s;
  return (
    <Layer pan={pan} depth={0.9}>
      <defs>
        <linearGradient id={`${id}-refl`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={p.accent} stopOpacity={0.4} />
          <stop offset="1" stopColor={p.accent} stopOpacity={0} />
        </linearGradient>
      </defs>
      <rect x={-W * 0.2} y={ground} width={W * 1.4} height={H - ground} fill={layer(p, 0.88)} />
      <rect x={-W * 0.2} y={ground} width={W * 1.4} height={3 * u} fill={p.accent} opacity={0.35} />
      {lights.map((x, i) => <rect key={i} x={x - 7 * u} y={ground + 4 * u} width={14 * u} height={(H - ground) * 0.85} fill={`url(#${id}-refl)`} />)}
    </Layer>
  );
};

const Station: React.FC<SetProps> = ({p, s, frame, pan, id}) => {
  const {W, H, u, horizon, ground, portrait} = s;
  const far = blocks(`${id}sb`, -W * 0.2, W * 1.4, horizon, H * 0.12, u * 0.7);
  const railA = horizon + (ground - horizon) * 0.42;
  const railB = horizon + (ground - horizon) * 0.62;
  const pillars = Array.from({length: portrait ? 3 : 4}, (_, i) => -W * 0.06 + ((i + 0.5) / (portrait ? 3 : 4)) * W * 1.12);
  const roof = H * (portrait ? 0.1 : 0.17);
  // A train of lit windows glides through the middle distance on some shots.
  const train = rand(`${id}train`) > 0.4;
  const tx = W * 1.2 - ((frame * 9 * u) % (W * 3.4));
  return (
    <>
      <Layer pan={pan} depth={0.15}>
        <path d={blockPath(far, H)} fill={layer(p, 0.32)} />
        <Windows bs={far} base={horizon} color={p.accent} u={u * 0.6} frame={frame} seed={`${id}sw`} density={0.15} />
      </Layer>
      <Layer pan={pan} depth={0.45}>
        <rect x={-W * 0.2} y={horizon} width={W * 1.4} height={H - horizon} fill={layer(p, 0.55)} />
        {[railA, railB].map((y, i) => <rect key={i} x={-W * 0.2} y={y} width={W * 1.4} height={3 * u} fill={p.glow} opacity={0.4} />)}
        {train ? (
          <g transform={`translate(${tx},0)`}>
            <rect x={0} y={railA - H * 0.13} width={W * 1.6} height={H * 0.12} rx={14 * u} fill={layer(p, 0.78)} />
            {Array.from({length: 18}, (_, i) => <rect key={i} x={30 * u + i * W * 0.088} y={railA - H * 0.11} width={W * 0.06} height={H * 0.045} rx={4 * u} fill={p.accent} opacity={0.75} />)}
          </g>
        ) : null}
      </Layer>
      <Layer pan={pan} depth={0.85}>
        <defs>
          <linearGradient id={`${id}-cone`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor={p.accent} stopOpacity={0.32} />
            <stop offset="1" stopColor={p.accent} stopOpacity={0} />
          </linearGradient>
        </defs>
        <rect x={-W * 0.2} y={ground} width={W * 1.4} height={H - ground} fill={layer(p, 0.9)} />
        <rect x={-W * 0.2} y={ground} width={W * 1.4} height={6 * u} fill={p.accent} opacity={0.7} />
        <path d={`M${-W * 0.2},0 L${W * 1.2},0 L${W * 1.2},${roof} L${-W * 0.2},${roof} Z`} fill={layer(p, 0.92)} />
        <rect x={-W * 0.2} y={roof} width={W * 1.4} height={4 * u} fill={p.glow} opacity={0.25} />
        {pillars.map((x, i) => {
          const lampX = x + W * 0.13;
          const flicker = rand(`${id}fl${i}`) > 0.75 && Math.floor(frame / 3) % 23 === 0 ? 0.4 : 1;
          return (
            <g key={i}>
              <rect x={x - 9 * u} y={roof} width={18 * u} height={ground - roof} fill={layer(p, 0.95)} />
              <line x1={lampX} x2={lampX} y1={roof} y2={roof + H * 0.06} stroke={layer(p, 0.95)} strokeWidth={3 * u} />
              <path d={`M${lampX - 14 * u},${roof + H * 0.06} L${lampX - W * 0.09},${ground} L${lampX + W * 0.09},${ground} L${lampX + 14 * u},${roof + H * 0.06} Z`} fill={`url(#${id}-cone)`} opacity={flicker} />
              <rect x={lampX - 16 * u} y={roof + H * 0.06} width={32 * u} height={7 * u} rx={3 * u} fill={p.accent} opacity={flicker} />
              <rect x={lampX - 6 * u} y={ground + 8 * u} width={12 * u} height={(H - ground) * 0.8} fill={p.accent} opacity={0.18 * flicker} />
            </g>
          );
        })}
      </Layer>
    </>
  );
};

const Field: React.FC<SetProps> = ({p, s, frame, pan, id}) => {
  const {W, H, u, horizon, ground} = s;
  const treeX = W * (rand(`${id}tx`) > 0.5 ? 0.24 : 0.74);
  const treeY = horizon + H * 0.03;
  const th = H * 0.14;
  return (
    <>
      <Layer pan={pan} depth={0.15}><path d={ridge(`${id}d0`, -W * 0.2, W * 1.4, H, horizon - H * 0.01, H * 0.06, 8)} fill={layer(p, 0.25)} /></Layer>
      <Layer pan={pan} depth={0.4}>
        <path d={ridge(`${id}d1`, -W * 0.2, W * 1.4, H, horizon + H * 0.05, H * 0.05, 7)} fill={layer(p, 0.48)} />
        <rect x={treeX - 5 * u} y={treeY - th * 0.5} width={10 * u} height={th * 0.55} fill={layer(p, 0.6)} />
        {[[-0.18, -0.55, 0.2], [0.16, -0.6, 0.22], [0, -0.78, 0.26], [-0.05, -0.5, 0.2]].map(([dx, dy, r], i) => (
          <circle key={i} cx={treeX + dx * th + Math.sin(frame / 40 + i) * 2 * u} cy={treeY + dy * th} r={r * th} fill={layer(p, 0.6)} />
        ))}
      </Layer>
      <Layer pan={pan} depth={0.85}>
        <path d={ridge(`${id}d2`, -W * 0.2, W * 1.4, H, ground + H * 0.01, H * 0.03, 10)} fill={layer(p, 0.88)} />
        {Array.from({length: 9}, (_, i) => {
          const x = -W * 0.1 + i * W * 0.15;
          return <rect key={i} x={x} y={ground - H * 0.06} width={7 * u} height={H * 0.08} fill={layer(p, 0.9)} />;
        })}
        <line x1={-W * 0.2} x2={W * 1.2} y1={ground - H * 0.045} y2={ground - H * 0.04} stroke={layer(p, 0.9)} strokeWidth={3 * u} />
      </Layer>
      <Layer pan={pan} depth={1}>
        {Array.from({length: 60}, (_, i) => {
          const x = -W * 0.15 + (i / 60) * W * 1.3 + rand(`${id}gx${i}`, 0, 20) * u;
          const h = rand(`${id}gh${i}`, 24, 70) * u;
          const sway = Math.sin(frame / 22 + i * 0.7) * 8 * u;
          const y = ground + H * 0.03 + rand(`${id}gy${i}`, 0, 1) * (H - ground) * 0.5;
          return <path key={i} d={`M${x},${y} Q${x + sway * 0.4},${y - h * 0.5} ${x + sway},${y - h}`} stroke={layer(p, 0.95)} strokeWidth={3 * u} fill="none" strokeLinecap="round" />;
        })}
      </Layer>
    </>
  );
};

const SETTINGS: Record<Shot['setting'], React.FC<SetProps>> = {mountains: Mountains, forest: Forest, lake: Lake, coast: Coast, city: City, station: Station, field: Field};

/** Near ground every setting shares, so figures always have somewhere to stand. */
const NearGround: React.FC<SetProps> = ({shot, p, s, frame, pan, id}) => {
  const {W, H, u, ground} = s;
  if (shot.setting === 'city' || shot.setting === 'station' || shot.setting === 'field' || shot.setting === 'coast') return null;
  const reeds = shot.setting === 'lake';
  return (
    <Layer pan={pan} depth={0.9}>
      <path d={ridge(`${id}ng`, -W * 0.2, W * 1.4, H, ground + H * 0.015, H * 0.025, 14)} fill={layer(p, 0.92)} />
      {reeds
        ? Array.from({length: 34}, (_, i) => {
            const x = -W * 0.15 + rand(`${id}rx${i}`) * W * 1.3;
            const h = rand(`${id}rh${i}`, 50, 120) * u;
            const sway = Math.sin(frame / 26 + i) * 7 * u;
            return <path key={i} d={`M${x},${ground + H * 0.02} Q${x + sway * 0.3},${ground - h * 0.5} ${x + sway},${ground - h}`} stroke={layer(p, 0.92)} strokeWidth={3.5 * u} fill="none" strokeLinecap="round" />;
          })
        : null}
    </Layer>
  );
};

// ---------------------------------------------------------------------------------------------
// Figures
// ---------------------------------------------------------------------------------------------

const Figure: React.FC<{shot: Shot; p: Pal; s: Stage; frame: number; t: number; index: number; pan: (d: number) => number}> = ({shot, p, s, frame, t, index, pan}) => {
  const {W, H, u, horizon, ground, portrait} = s;
  const fill = layer(p, 0.97);
  const rim = alpha(p.glow, 0.28);
  const size = Math.min(W, H) * (portrait ? 0.34 : 0.27);
  const side = index % 2 ? 0.34 : 0.66;
  if (shot.figure === 'birds') {
    return (
      <Layer pan={pan} depth={0.5}>
        {Array.from({length: 8}, (_, i) => {
          const x = ((rand(`bird${index}${i}`) * W * 0.5 + frame * (2.2 + rand(`bv${i}`, 0, 0.8)) * u) % (W * 1.3)) - W * 0.15;
          const y = horizon - H * rand(`bh${index}${i}`, 0.14, 0.34) + Math.sin(frame / 18 + i) * 6 * u;
          const span = rand(`bs${i}`, 14, 24) * u;
          const flap = Math.sin(frame / 4 + i * 1.7) * span * 0.55;
          return <path key={i} d={`M${x - span},${y - flap} Q${x - span * 0.4},${y - span * 0.15} ${x},${y} Q${x + span * 0.4},${y - span * 0.15} ${x + span},${y - flap}`} fill="none" stroke={fill} strokeWidth={3 * u} strokeLinecap="round" />;
        })}
      </Layer>
    );
  }
  if (shot.figure === 'none') return null;
  const k = size / 100;
  let x = W * side;
  let body: React.ReactNode = null;
  if (shot.figure === 'umbrella') {
    const sway = Math.sin(frame / 38 + index) * 2.5;
    const drip = (o: number) => ((frame * 1.6 + o) % 36) / 36;
    body = (
      <>
        <path d="M-8,-28 L-8.5,-1 L-1.5,-1 L-1,-28 Z M1,-28 L1.5,-1 L8.5,-1 L8,-28 Z" />
        <path d="M-6,-75 Q0,-78 6,-75 C11,-73 13,-66 13,-58 L17,-24 Q0,-19 -17,-24 L-13,-58 C-13,-66 -11,-73 -6,-75 Z" />
        <path d="M-7,-76 Q0,-70 7,-76 L6,-79 Q0,-75 -6,-79 Z" />
        <circle cx={0} cy={-85} r={7.5} />
        <g transform={`rotate(${sway} 6 -58)`}>
          <path d="M5,-60 L9,-56 L3,-114 L1,-114 Z" />
          <path d="M-36,-95 Q-30,-122 2,-124 Q34,-122 40,-95 Q31,-100 22,-95 Q12,-100 2,-95 Q-8,-100 -18,-95 Q-27,-100 -36,-95 Z" />
          {[-36, 40, 2].map((dx, i) => <circle key={i} cx={dx} cy={-93 + drip(i * 12) * 40} r={1.3} fill={alpha(p.glow, 0.7 * (1 - drip(i * 12)))} stroke="none" />)}
        </g>
      </>
    );
  } else if (shot.figure === 'walker') {
    x = W * (side - 0.07 * (index % 2 ? -1 : 1)) + (index % 2 ? -1 : 1) * W * 0.14 * t;
    const step = Math.sin(frame * 0.16) * 20;
    const bob = Math.abs(Math.sin(frame * 0.16)) * 1.2;
    const dir = index % 2 ? -1 : 1;
    body = (
      <g transform={`scale(${dir} 1) translate(0 ${-bob})`}>
        <path transform={`rotate(${step} 0 -32)`} d="M-4,-34 L-4,-1 L5,-1 L3,-34 Z" />
        <path transform={`rotate(${-step} 0 -32)`} d="M-4,-34 L-4,-1 L5,-1 L3,-34 Z" />
        <path d="M-6,-74 Q2,-78 8,-73 C12,-68 13,-60 13,-52 L15,-27 Q0,-23 -14,-27 L-12,-54 C-12,-64 -10,-71 -6,-74 Z" />
        <path transform={`rotate(${step * 0.6} 0 -70)`} d="M-2,-70 L-5,-44 L0,-44 L3,-70 Z" />
        <path d="M-8,-78 Q-9,-94 1,-94 Q11,-94 10,-82 Q10,-74 2,-75 Q-5,-74 -8,-78 Z" />
      </g>
    );
  } else if (shot.figure === 'deer') {
    const graze = Math.max(0, Math.sin(frame / 50 + index)) * 46;
    const dir = index % 2 ? 1 : -1;
    body = (
      <g transform={`scale(${dir * 0.85} 0.85)`}>
        <path d="M-22,-48 L-24,0 L-20,0 L-17,-46 Z M-12,-46 L-13,0 L-9,0 L-8,-46 Z M14,-46 L15,0 L19,0 L19,-46 Z M22,-48 L25,0 L29,0 L27,-48 Z" />
        <ellipse cx={2} cy={-54} rx={28} ry={13} />
        <path d="M29,-58 Q36,-60 34,-52 Z" />
        <g transform={`rotate(${-graze} -18 -58)`}>
          <path d="M-14,-62 L-27,-86 L-20,-89 L-6,-60 Z" />
          <ellipse cx={-30} cy={-88} rx={9} ry={5} transform="rotate(-20 -30 -88)" />
          <path d="M-22,-93 L-16,-99 L-19,-91 Z" />
          <path d="M-25,-93 L-23,-110 M-24,-102 L-17,-108 M-23,-110 L-27,-117 M-23,-110 L-18,-116" fill="none" strokeWidth={1.8} stroke={fill} strokeLinecap="round" />
        </g>
      </g>
    );
  }
  return (
    <Layer pan={pan} depth={0.95}>
      <g transform={`translate(${x} ${ground + 4 * u}) scale(${k})`} fill={fill} stroke={rim} strokeWidth={0.5}>
        {body}
      </g>
    </Layer>
  );
};

// ---------------------------------------------------------------------------------------------
// Weather (screen space, does not pan)
// ---------------------------------------------------------------------------------------------

export const Weather: React.FC<{shot: Shot; p: Pal; s: Stage; frame: number; fps: number; seed: number; water: boolean}> = ({shot, p, s, frame, fps, seed, water}) => {
  const {W, H, u, horizon, ground} = s;
  const area = Math.sqrt((W * H) / (1920 * 1080));
  const items: React.ReactNode[] = [];
  const wet = shot.weather === 'rain' || shot.weather === 'storm';
  if (wet) {
    const storm = shot.weather === 'storm';
    const wind = storm ? 0.5 : 0.16;
    const n = Math.round((storm ? 230 : 140) * area);
    for (let i = 0; i < n; i++) {
      const depth = rand(`rd${seed}${i}`);
      const speed = H * (0.026 + 0.03 * depth) * (storm ? 1.3 : 1);
      const len = speed * (1.6 + depth);
      const cycle = H + len * 2;
      const y = ((rand(`ry${seed}${i}`) * cycle + frame * speed) % cycle) - len;
      const span = W * 1.4;
      const x = ((((rand(`rx${seed}${i}`) * span + frame * speed * wind * 0.25) % span) + span) % span) - W * 0.2;
      items.push(<line key={`r${i}`} x1={x} y1={y} x2={x + wind * len * 0.25} y2={y + len} stroke={p.precip} strokeWidth={(0.8 + 1.8 * depth) * u} opacity={0.14 + 0.42 * depth} strokeLinecap="round" />);
    }
    const splashes = Math.round((storm ? 46 : 30) * area);
    for (let i = 0; i < splashes; i++) {
      const period = Math.round(rand(`sp${seed}${i}`, 14, 26));
      const phase = Math.floor(rand(`sf${seed}${i}`) * period);
      const c = Math.floor((frame + phase) / period);
      const q = ((frame + phase) % period) / period;
      const onWater = water && rand(`sw${seed}${i}${c}`) > 0.35;
      const y = onWater ? horizon + (ground - horizon) * rand(`sy${seed}${i}${c}`, 0.15, 1) : ground + (H - ground) * rand(`sy${seed}${i}${c}`, 0.05, 0.9);
      const persp = onWater ? 0.35 + 0.65 * ((y - horizon) / Math.max(1, ground - horizon)) : 1.1;
      const x = rand(`sx${seed}${i}${c}`) * W;
      const r = (5 + 18 * q) * u * persp;
      items.push(<ellipse key={`s${i}`} cx={x} cy={y} rx={r} ry={r * 0.28} fill="none" stroke={p.precip} strokeWidth={1.6 * u} opacity={(1 - q) * 0.55} />);
    }
  }
  if (shot.weather === 'snow') {
    const n = Math.round(120 * area);
    for (let i = 0; i < n; i++) {
      const depth = rand(`nd${seed}${i}`);
      const r = (1.5 + 4.5 * depth) * u;
      const speed = H * (0.0012 + 0.0032 * depth);
      const cycle = H + 20 * u;
      const y = ((rand(`ny${seed}${i}`) * cycle + frame * speed) % cycle) - 10 * u;
      const x = rand(`nx${seed}${i}`) * W + Math.sin(frame / (34 + 30 * rand(`ns${i}`)) + i) * 24 * u * (0.4 + depth);
      items.push(<circle key={`n${i}`} cx={x} cy={y} r={r} fill={p.precip} opacity={0.35 + 0.55 * depth} />);
    }
  }
  if (shot.weather === 'clear') {
    const dark = shot.time === 'night' || shot.time === 'dusk';
    for (let i = 0; i < 26; i++) {
      const x = rand(`ff${seed}${i}`) * W + Math.sin(frame / 37 + i * 2) * 30 * u;
      const y = (dark ? horizon + (H - horizon) * rand(`fy${seed}${i}`, 0, 0.7) : H * rand(`fy${seed}${i}`, 0.2, 0.85)) + Math.cos(frame / 29 + i) * 18 * u;
      const pulse = dark ? 0.35 + 0.65 * Math.max(0, Math.sin(frame / 11 + i * 1.3)) : 0.5;
      items.push(<circle key={`f${i}`} cx={x} cy={y} r={(dark ? 5 : 3) * u} fill={dark ? p.accent : p.precip} opacity={pulse * 0.85} />);
      if (dark) items.push(<circle key={`fg${i}`} cx={x} cy={y} r={16 * u} fill={p.accent} opacity={pulse * 0.16} />);
    }
  }
  // Lightning: a seeded strike every few seconds, with a double flash.
  let flash = 0;
  let bolt: React.ReactNode = null;
  if (shot.weather === 'storm') {
    const period = Math.round(3.4 * fps);
    const local = (frame + Math.floor(rand(`lt${seed}`) * period)) % period;
    flash = local < 2 ? 1 : local < 4 ? 0.25 : local < 6 ? 0.75 : local < 12 ? 0.75 * (1 - (local - 6) / 6) : 0;
    if (local < 8) {
      const c = Math.floor((frame + Math.floor(rand(`lt${seed}`) * period)) / period);
      let bx = W * rand(`bx${seed}${c}`, 0.15, 0.85);
      let by = 0;
      const d = [`M${bx},${by}`];
      while (by < horizon - H * 0.02) {
        by += H * rand(`bs${seed}${c}${by}`, 0.04, 0.09);
        bx += W * rand(`bd${seed}${c}${by}`, -0.04, 0.04);
        d.push(`L${bx},${Math.min(by, horizon)}`);
      }
      bolt = <path d={d.join(' ')} fill="none" stroke="#ffffff" strokeWidth={3.5 * u} opacity={flash} strokeLinejoin="round" />;
    }
  }
  return (
    <AbsoluteFill style={{pointerEvents: 'none'}}>
      {flash > 0 ? <AbsoluteFill style={{background: p.light ? alpha(p.ink, 0.2 * flash) : alpha('#dfe9ff', 0.32 * flash)}} /> : null}
      <svg width={W} height={H} style={{position: 'absolute', inset: 0}}>
        {bolt}
        {items}
      </svg>
    </AbsoluteFill>
  );
};

/** Slow horizontal mist bands hugging the horizon. */
export const Mist: React.FC<{color: string; strength: number; s: Stage; frame: number; seed: number}> = ({color, strength, s, frame, seed}) => (
  <AbsoluteFill style={{pointerEvents: 'none'}}>
    {[0, 1, 2, 3].map(i => {
      const x = ((frame * (0.12 + i * 0.05) + rand(`mx${seed}${i}`) * 140) % 180) - 40;
      const y = ((s.horizon + (i - 1) * s.H * 0.07) / s.H) * 100;
      return <AbsoluteFill key={i} style={{opacity: strength * (0.55 + 0.15 * i), background: `radial-gradient(ellipse 75% 14% at ${x}% ${y}%, ${alpha(color, 0.6)} 0%, transparent 72%)`}} />;
    })}
  </AbsoluteFill>
);

/** Sky, glow, the setting's parallax layers and the figure. */
export const Scenery: React.FC<{shot: Shot; p: Pal; s: Stage; frame: number; t: number; index: number}> = ({shot, p, s, frame, t, index}) => {
  const {W, H, horizon} = s;
  const dir = index % 2 ? -1 : 1;
  const pan = (depth: number) => (t - 0.5) * W * 0.08 * depth * dir;
  const id = `srm${index}`;
  const Setting = SETTINGS[shot.setting];
  const veiled = shot.weather !== 'clear';
  const gx = W * rand(`gx${index}`, 0.25, 0.75) + pan(0.05);
  const gy = horizon - H * (shot.time === 'night' ? 0.3 : shot.time === 'day' ? 0.34 : 0.12);
  const gr = Math.min(W, H) * (veiled ? 0.55 : 0.4);
  const sp = {shot, p, s, frame, pan, id};
  return (
    <AbsoluteFill style={{background: `linear-gradient(180deg, ${p.skyTop} 0%, ${mix(p.skyTop, p.horizon, 0.55)} ${(horizon / H) * 60}%, ${p.horizon} ${(horizon / H) * 100}%, ${p.horizon} 100%)`}}>
      <AbsoluteFill style={{background: `radial-gradient(circle at ${gx}px ${gy}px, ${alpha(p.glow, veiled ? 0.32 : 0.5)} 0%, ${alpha(p.glow, 0.1)} ${gr * 0.45}px, transparent ${gr}px)`}} />
      {!veiled ? <div style={{position: 'absolute', left: gx - 34 * s.u, top: gy - 34 * s.u, width: 68 * s.u, height: 68 * s.u, borderRadius: '50%', background: p.glow, boxShadow: `0 0 ${60 * s.u}px ${alpha(p.glow, 0.7)}`}} /> : null}
      <svg width={W} height={H} style={{position: 'absolute', inset: 0}}>
        <Setting {...sp} />
        <NearGround {...sp} />
        <Figure shot={shot} p={p} s={s} frame={frame} t={t} index={index} pan={pan} />
      </svg>
    </AbsoluteFill>
  );
};
