import React from 'react';
import {AbsoluteFill, Sequence, useCurrentFrame, useVideoConfig} from 'remotion';
import {AdWeave, NarrationTrack, captionSafeBottom, defineEntry, mix, useContentFrames, useLook, useSceneTimeline, type ActiveLook, type EntryProps, type Media, type TimedScene} from '@viralaunch/kit';
import {Grain, KineticText, LightLeak, Particles, SceneSeries, StyledCaptions, Vignette, alpha, countUp, ease, fonts, progress, rand} from '@viralaunch/kit/fx';
import {Props, type Level} from './schema';
import {HAZARD_COLORS, HAZARD_SPRITES, HERO_COLORS, HERO_FRAMES, ITEM_COLORS, ITEM_SPRITES, ITEM_VALUE, WORLD_HAZARD, type Grid, type HazardName} from './sprites';

// ---------------------------------------------------------------------------------------------
// Palettes
// ---------------------------------------------------------------------------------------------

type Pal = {skyTop: string; skyBot: string; panel: string; text: string; muted: string; accent: string; line: string; outline: string; dirt: string; worldMix: number; light: boolean; scan: number; tone: (c: string) => string};

const lum = (c: string) => {
  const n = parseInt(c.slice(1, 7), 16);
  return (0.299 * ((n >> 16) & 255) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255)) / 255;
};
/** Map any colour onto a short ramp by brightness: the 4-shade handheld look. */
const quantize = (ramp: string[]) => (c: string) => ramp[Math.min(ramp.length - 1, Math.floor(lum(c) * ramp.length))];
const same = (c: string) => c;
const GB = ['#0f380f', '#306230', '#8bac0f', '#9bbc0f'];

const PALETTES: Record<Props['palette'], Pal> = {
  nebula: {skyTop: '#0b0820', skyBot: '#3a1d6e', panel: '#140f2e', text: '#f4f0ff', muted: '#a99cd6', accent: '#ffd23f', line: '#f4f0ff', outline: '#120a24', dirt: '#1a1035', worldMix: 0.35, light: false, scan: 0.1, tone: same},
  gameboy: {skyTop: '#0f380f', skyBot: '#306230', panel: '#0f380f', text: '#9bbc0f', muted: '#8bac0f', accent: '#9bbc0f', line: '#8bac0f', outline: '#0f380f', dirt: '#0f380f', worldMix: 0.2, light: false, scan: 0.08, tone: quantize(GB)},
  sunset: {skyTop: '#2b0f3a', skyBot: '#ff6f61', panel: '#2a1230', text: '#fff1e6', muted: '#ffb8a0', accent: '#ffd166', line: '#fff1e6', outline: '#1d0a24', dirt: '#2a0f2c', worldMix: 0.25, light: false, scan: 0.08, tone: same},
  arcade: {skyTop: '#000000', skyBot: '#0a0a2a', panel: '#05051a', text: '#ffffff', muted: '#8a8ab0', accent: '#00f0ff', line: '#ff2bd6', outline: '#000000', dirt: '#08081a', worldMix: 0.3, light: false, scan: 0.12, tone: same},
};

/** The arcade in a sequence's shared look: sky, panels, ink and accent come from the look. */
const fromLook = (l: ActiveLook): Pal => {
  const light = l.tone === 'light';
  return {
    skyTop: l.palette.bg,
    skyBot: l.palette.bg2,
    panel: l.palette.surface,
    text: l.palette.text,
    muted: l.palette.muted,
    accent: l.palette.accent,
    line: l.palette.line,
    outline: light ? mix(l.palette.text, l.palette.bg, 0.1) : mix(l.palette.bg, '#000000', 0.6),
    dirt: light ? mix(l.palette.bg2, l.palette.text, 0.16) : mix(l.palette.bg, '#000000', 0.3),
    worldMix: 0.15,
    light,
    scan: light ? 0 : 0.06,
    tone: c => mix(c, l.palette.bg2, light ? 0.35 : 0.25),
  };
};

const WORLD: Record<Level['world'], {label: string; sky: string; ground: string[]; wave?: boolean}> = {
  space: {label: 'SPACE ZONE', sky: '#2a1458', ground: ['#ff3b5c', '#ff9f1c', '#ffe14d', '#3ddc84', '#3ec7ff', '#7b5cff'], wave: true},
  city: {label: 'CITY ZONE', sky: '#ff7a59', ground: ['#b4b8c4', '#8a8f9c', '#5d616d']},
  forest: {label: 'FOREST ZONE', sky: '#3fb59a', ground: ['#5bd16b', '#2f9e4f', '#7a4a2a']},
  ocean: {label: 'OCEAN ZONE', sky: '#2e8bff', ground: ['#d29a5e', '#c48a52', '#8f5a2e']},
  desert: {label: 'DESERT ZONE', sky: '#ffb347', ground: ['#f2c879', '#e3b25f', '#c99545']},
  cave: {label: 'CAVE ZONE', sky: '#05040a', ground: ['#8a8fa8', '#6a6f88', '#4d5068']},
  sky: {label: 'SKY ZONE', sky: '#7fc8ff', ground: ['#ffffff', '#eef3ff', '#c9d6f2']},
};

// ---------------------------------------------------------------------------------------------
// Timing: levels follow the narration; events (jumps, pickups, hits) are deterministic
// ---------------------------------------------------------------------------------------------

type Plan = {introEnd: number; act: number[]; end: number[]; finaleAt: number; contentEnd: number; D: number};

function makePlan(timeline: TimedScene[], levels: number, fps: number, contentEnd: number): Plan {
  const T = timeline.length;
  let introEnd: number;
  let act: number[];
  if (T >= levels + 1) {
    // Scene 0 is the start screen, then one scene per level.
    introEnd = timeline[1].from;
    act = Array.from({length: levels}, (_, i) => timeline[i + 1].from);
  } else if (T === levels) {
    introEnd = Math.min(Math.round(1.8 * fps), Math.round(timeline[0].durationInFrames * 0.4));
    act = timeline.map(t => t.from);
    act[0] = introEnd;
  } else {
    introEnd = Math.min(Math.round(1.8 * fps), Math.round(contentEnd * 0.15));
    act = Array.from({length: levels}, (_, i) => Math.round(introEnd + (i * (contentEnd - introEnd)) / levels));
  }
  introEnd = Math.max(1, Math.min(introEnd, contentEnd - levels * 2));
  act[0] = introEnd;
  for (let i = 1; i < levels; i++) act[i] = Math.max(act[i], act[i - 1] + 2);
  const end = act.map((_, i) => (i < levels - 1 ? act[i + 1] : Math.max(act[i] + 1, contentEnd)));
  const lastLen = end[levels - 1] - act[levels - 1];
  const finaleAt = end[levels - 1] - Math.min(Math.round(2 * fps), Math.round(lastLen * 0.45));
  const minLen = Math.min(introEnd, ...end.map((e, i) => e - act[i]));
  return {introEnd, act, end, finaleAt, contentEnd, D: Math.max(2, Math.min(9, Math.floor(minLen / 4)))};
}

type Events = {hazards: {t: number; hit: boolean}[]; pickups: {t: number; high: boolean}[]};

function levelEvents(level: Level, i: number, plan: Plan, fps: number, count: number): Events {
  const gap = Math.round(1.45 * fps);
  const lead = Math.round(1.1 * fps);
  const stop = (i === count - 1 ? plan.finaleAt : plan.end[i]) - Math.round(0.45 * fps);
  const ts: number[] = [];
  for (let t = plan.act[i] + lead; t <= stop; t += gap) ts.push(t);
  const hitAt = level.hit && ts.length ? Math.min(1, ts.length - 1) : -1;
  const hazards = ts.map((t, k) => ({t, hit: k === hitAt}));
  const pickups: Events['pickups'] = [];
  const first = plan.act[i] + lead - Math.round(gap / 2);
  if (first <= stop) pickups.push({t: first, high: false});
  hazards.forEach(h => {
    if (!h.hit) pickups.push({t: h.t, high: true});
    const mid = h.t + Math.round(gap / 2);
    if (mid <= stop) pickups.push({t: mid, high: false});
  });
  return {hazards, pickups};
}

// ---------------------------------------------------------------------------------------------
// Geometry
// ---------------------------------------------------------------------------------------------

type Geo = {W: number; H: number; P: number; u: number; portrait: boolean; gt: number; heroX: number; hero: number; haz: number; jumpH: number; J: number; v: number; dialogTop: number; dialogBottom: number; dialogW: number};

function useGeo(look: ActiveLook | null): Geo {
  const {width: W, height: H, fps} = useVideoConfig();
  const portrait = H >= W;
  const P = Math.max(3, Math.round(Math.min(W, H) / 108));
  const snap = (n: number) => Math.round(n / P) * P;
  const reserve = look ? Math.max(captionSafeBottom(look), 0.24) : portrait ? 0.28 : 0.25;
  const gt = snap(H * (1 - reserve));
  const hero = 12 * P;
  const jumpH = Math.round(hero * 1.15);
  const dialogTop = H * (portrait ? 0.1 : 0.125);
  return {W, H, P, u: Math.min(W, H) / 1080, portrait, gt, heroX: snap(W * (portrait ? 0.16 : 0.2)), hero, haz: 8 * P, jumpH, J: Math.round(0.8 * fps), v: 1.5 * P, dialogTop, dialogBottom: gt - hero - jumpH - 3 * P, dialogW: portrait ? W * 0.88 : Math.min(W * 0.62, 1180 * (Math.min(W, H) / 1080))};
}

// ---------------------------------------------------------------------------------------------
// Pixel drawing
// ---------------------------------------------------------------------------------------------

/** Draws a character grid as merged horizontal runs of crisp rectangles. */
const Sprite: React.FC<{grid: Grid; colors: Record<string, string>; x: number; y: number; p: number; flip?: boolean; opacity?: number}> = ({grid, colors, x, y, p, flip, opacity = 1}) => {
  const rects: React.ReactNode[] = [];
  const w = grid[0].length;
  grid.forEach((row, r) => {
    let c = 0;
    while (c < w) {
      const ch = row[c];
      let e = c + 1;
      while (e < w && row[e] === ch) e++;
      if (ch !== '.' && colors[ch]) {
        const cx = flip ? w - e : c;
        rects.push(<rect key={`${r}-${c}`} x={x + cx * p} y={y + r * p} width={(e - c) * p} height={p} fill={colors[ch]} />);
      }
      c = e;
    }
  });
  return <g opacity={opacity}>{rects}</g>;
};

/** A stepped pixel disc with a highlight on the left and shade on the right. */
function disc(key: string, cx: number, cy: number, r: number, P: number, base: string, hi?: string, shade?: string): React.ReactNode[] {
  const out: React.ReactNode[] = [];
  for (let y = -r; y < r; y += P) {
    const yc = y + P / 2;
    const half = Math.floor(Math.sqrt(Math.max(0, r * r - yc * yc)) / P) * P;
    if (half <= 0) continue;
    const w = half * 2;
    out.push(<rect key={`${key}m${y}`} x={cx - half} y={cy + y} width={w} height={P} fill={base} />);
    if (shade) out.push(<rect key={`${key}s${y}`} x={cx + half - Math.max(P, Math.round((w * 0.28) / P) * P)} y={cy + y} width={Math.max(P, Math.round((w * 0.28) / P) * P)} height={P} fill={shade} />);
    if (hi && y < r * 0.2) out.push(<rect key={`${key}h${y}`} x={cx - half + P} y={cy + y} width={Math.max(P, Math.round((w * 0.2) / P) * P)} height={P} fill={hi} />);
  }
  return out;
}

const wrap = (x: number, span: number) => ((x % span) + span) % span;

type Ctx = {W: number; H: number; P: number; gt: number; s: number; f: number; pal: Pal; seed: number; snap: (n: number) => number; sky: string};

/** The far and middle parallax layers of each world, drawn as pixel shapes. */
function worldLayers(world: Level['world'], c: Ctx): React.ReactNode[] {
  const {W, H, P, gt, s, f, pal, seed, snap} = c;
  const t = pal.tone;
  const m = Math.min(W, H);
  const els: React.ReactNode[] = [];
  const starColor = pal.light ? pal.muted : t('#ffffff');
  if (world === 'space' || world === 'cave' || world === 'city') {
    const n = world === 'space' ? 70 : 30;
    for (let k = 0; k < n; k++) {
      const sp = world === 'space' ? rand(`sp${seed}${k}`, 0.04, 0.6) : 0.05;
      const x = wrap(rand(`sx${seed}${k}`) * (W + 200) - s * sp, W + 200) - 100;
      const y = snap(rand(`sy${seed}${k}`) * gt * (world === 'city' ? 0.5 : 0.92));
      const streak = sp > 0.45;
      const big = rand(`sb${seed}${k}`) > 0.82;
      const tw = streak ? 0.85 : 0.35 + 0.65 * Math.abs(Math.sin(f / 9 + k));
      els.push(<rect key={`st${k}`} x={snap(x)} y={y} width={streak ? snap(P * (2 + sp * 9)) : big ? P : Math.ceil(P * 0.6)} height={streak ? Math.max(2, Math.round(P / 2)) : big ? P : Math.ceil(P * 0.6)} fill={streak && world === 'space' ? t('#bfe9ff') : starColor} opacity={tw} />);
    }
  }
  if (world === 'space') {
    const R = snap(m * 0.13);
    // Off to the side so the dialog box never hides it.
    const cx = snap(W * (W > H ? 0.86 : 0.78) - s * 0.02);
    const cy = snap(gt * (W > H ? 0.48 : 0.56));
    const ring = t('#ffd23f');
    const pts = new Map<string, [number, number, boolean]>();
    for (let a = 0; a < 120; a++) {
      const th = (a / 120) * Math.PI * 2;
      const x = snap(cx + Math.cos(th) * R * 1.75);
      const y = snap(cy + Math.sin(th) * R * 0.3 - Math.cos(th) * R * 0.14);
      pts.set(`${x},${y}`, [x, y, Math.sin(th) > 0]);
    }
    const ringRects = (front: boolean) => [...pts.values()].filter(p => p[2] === front).map(([x, y]) => <rect key={`r${front ? 'f' : 'b'}${x},${y}`} x={x - P} y={y} width={P * 2} height={P} fill={ring} />);
    els.push(...disc('pk', snap(W * 0.16 - s * 0.07), snap(gt * 0.62), snap(m * 0.045), P, t('#d63aa8'), t('#ff8ad8'), t('#8e1f75')));
    els.push(...ringRects(false));
    els.push(...disc('pl', cx, cy, R, P, t('#3e7bd6'), t('#7fb2ff'), t('#244a8f')));
    els.push(...ringRects(true));
    // A meteor streaking across the far sky every few seconds.
    for (let k = 0; k < 2; k++) {
      const cyc = 110 + k * 37;
      const q = ((f + k * 53 + seed * 17) % cyc) / 70;
      if (q > 1) continue;
      const mx = snap(W * (1.05 - q * 0.9) - k * W * 0.2);
      const my = snap(gt * (0.04 + q * 0.4 + k * 0.1));
      for (let tr = 4; tr >= 1; tr--) els.push(<rect key={`bm${k}${tr}`} x={mx + tr * P * 1.5} y={my - tr * P * 0.75} width={P} height={P} fill={t(tr > 2 ? '#ff9f1c' : '#ffe14d')} opacity={1 - tr * 0.2} />);
      els.push(<rect key={`bm${k}`} x={mx} y={my} width={P * 1.5} height={P * 1.5} fill={t('#ffb070')} />);
    }
  }
  if (world === 'city') {
    els.push(...disc('moon', snap(W * 0.8), snap(gt * 0.22), snap(m * 0.06), P, t('#fff4d6'), undefined, t('#e8d8b0')));
    const layer = (key: string, speed: number, span: number, color: string, hmin: number, hmax: number, windows: boolean) => {
      let x0 = 0;
      let k = 0;
      while (x0 < span) {
        const bw = snap(rand(`${key}w${seed}${k}`, 6, 14) * P);
        const bh = snap(rand(`${key}h${seed}${k}`, hmin, hmax) * H);
        const x = wrap(x0 - s * speed, span) - bw;
        els.push(<rect key={`${key}${k}`} x={x} y={gt - bh} width={bw - P} height={bh} fill={color} />);
        if (windows) {
          for (let wy = gt - bh + 2 * P; wy < gt - 2 * P; wy += 3 * P) {
            for (let wx = P; wx < bw - 2 * P; wx += 2 * P) {
              if (rand(`${key}l${seed}${k}${wx}${wy}`) > 0.62) els.push(<rect key={`${key}${k}w${wx}-${wy}`} x={x + wx} y={wy} width={P} height={P} fill={t('#ffd88a')} opacity={0.85} />);
            }
          }
        }
        x0 += bw;
        k++;
      }
    };
    layer('fb', 0.15, W * 1.6, mix(c.sky, pal.outline, 0.35), 0.12, 0.3, false);
    layer('mb', 0.45, W * 1.7, mix(c.sky, pal.outline, 0.7), 0.06, 0.2, true);
  }
  if (world === 'forest') {
    for (let k = 0; k < 6; k++) {
      const span = W * 1.8;
      const r = snap(rand(`hr${seed}${k}`, 0.16, 0.28) * H);
      els.push(...disc(`hill${k}`, snap(wrap(k * span / 6 - s * 0.12, span) - r), gt + snap(r * 0.35), r, P, mix(c.sky, t('#0b3d2e'), 0.55)));
    }
    for (let k = 0; k < 12; k++) {
      const span = W * 1.6;
      const th = snap(rand(`th${seed}${k}`, 0.14, 0.28) * H);
      const tw = th * 0.42;
      const cx = snap(wrap(rand(`tx${seed}${k}`) * span - s * 0.5, span) - W * 0.15);
      const green = mix(t('#1d5e3a'), pal.outline, 0.35);
      els.push(<rect key={`trunk${k}`} x={cx - P} y={gt - 3 * P} width={2 * P} height={3 * P} fill={t('#4a2d1a')} />);
      for (let y = 0; y < th - 3 * P; y += 2 * P) {
        const tier = (y % (th / 3)) / (th / 3);
        const w = Math.max(2 * P, snap(tw * (0.35 + 0.65 * tier) * (0.5 + 0.5 * (y / th))));
        els.push(<rect key={`tr${k}-${y}`} x={cx - w / 2} y={gt - th + y} width={w} height={2 * P} fill={green} />);
      }
    }
  }
  if (world === 'ocean') {
    const hy = snap(gt - H * 0.16);
    els.push(...disc('sun', snap(W * 0.62), hy, snap(m * 0.1), P, t('#ffcf6b'), t('#fff1b8')));
    els.push(<rect key="sea" x={0} y={hy} width={W} height={gt - hy} fill={mix(t('#1f5fbf'), c.sky, 0.25)} />);
    for (let k = 0; k < 6; k++) {
      const w = snap(m * 0.16 * (1 - k * 0.14) * (0.8 + 0.2 * Math.sin(f / 5 + k)));
      els.push(<rect key={`rf${k}`} x={snap(W * 0.62) - w / 2} y={hy + P + k * 2 * P} width={w} height={P} fill={t('#ffe08a')} opacity={0.8 - k * 0.1} />);
    }
    for (let k = 0; k < 26; k++) {
      const span = W + 300;
      const y = snap(hy + P * 2 + rand(`wy${seed}${k}`) * (gt - hy - 4 * P));
      const sp = 0.2 + 0.4 * ((y - hy) / (gt - hy));
      els.push(<rect key={`wv${k}`} x={snap(wrap(rand(`wx${seed}${k}`) * span - s * sp, span) - 150)} y={y} width={snap(P * rand(`ww${seed}${k}`, 3, 7))} height={P} fill={t('#8fd3ff')} opacity={0.55} />);
    }
  }
  if (world === 'desert') {
    els.push(...disc('sun', snap(W * 0.74), snap(gt * 0.3), snap(m * 0.11), P, t('#fff1b8'), undefined, t('#ffd88a')));
    const dunes = (key: string, speed: number, base: number, amp: number, color: string, len: number) => {
      const step = 2 * P;
      const off = s * speed;
      for (let cx = -step; cx < W + step; cx += step) {
        const h = snap(base + amp * (0.5 + 0.5 * Math.sin(((cx + off - (off % step)) / len) * Math.PI * 2)));
        els.push(<rect key={`${key}${cx}`} x={cx - (off % step)} y={gt - h} width={step} height={h} fill={color} />);
      }
    };
    dunes('fd', 0.12, H * 0.08, H * 0.07, mix(t('#d89b55'), c.sky, 0.35), W * 0.7);
    dunes('nd', 0.3, H * 0.03, H * 0.05, t('#c9853f'), W * 0.45);
    for (let k = 0; k < 6; k++) {
      const span = W * 1.6;
      const cx = snap(wrap(rand(`cx${seed}${k}`) * span - s * 0.55, span) - W * 0.1);
      const ch = snap(rand(`ch${seed}${k}`, 6, 11) * P);
      const g = t('#2f8f4e');
      els.push(<rect key={`ct${k}`} x={cx} y={gt - ch} width={2 * P} height={ch} fill={g} />);
      els.push(<rect key={`ca${k}`} x={cx - 2 * P} y={gt - ch * 0.7} width={2 * P} height={P} fill={g} />);
      els.push(<rect key={`cb${k}`} x={cx - 2 * P} y={gt - ch * 0.7 - 3 * P} width={P} height={3 * P} fill={g} />);
      els.push(<rect key={`cc${k}`} x={cx + 2 * P} y={gt - ch * 0.5} width={2 * P} height={P} fill={g} />);
      els.push(<rect key={`cd${k}`} x={cx + 3 * P} y={gt - ch * 0.5 - 2 * P} width={P} height={2 * P} fill={g} />);
    }
  }
  if (world === 'cave') {
    const rock = mix(c.sky, t('#3b3550'), 0.6);
    for (let k = 0; k < 10; k++) {
      const span = W * 1.5;
      const x = snap(wrap(rand(`px${seed}${k}`) * span - s * 0.2, span) - 100);
      const w = snap(rand(`pw${seed}${k}`, 4, 9) * P);
      els.push(<rect key={`pil${k}`} x={x} y={0} width={w} height={snap(rand(`ph${seed}${k}`, 0.08, 0.25) * H)} fill={rock} />);
      els.push(<rect key={`pib${k}`} x={x + P} y={gt - snap(rand(`pb${seed}${k}`, 0.04, 0.14) * H)} width={w - 2 * P} height={H} fill={rock} />);
    }
    for (let k = 0; k < 9; k++) {
      const span = W * 1.4;
      const x = snap(wrap(rand(`cr${seed}${k}`) * span - s * 0.45, span) - 60);
      const y = snap(gt - P * rand(`cy${seed}${k}`, 3, 14));
      const col = t(k % 2 ? '#7b5cff' : '#3ee6ff');
      const glowA = 0.5 + 0.5 * Math.sin(f / 7 + k);
      els.push(<rect key={`cg${k}`} x={x - 2 * P} y={y - 2 * P} width={5 * P} height={5 * P} fill={col} opacity={0.15 * glowA} />);
      els.push(<rect key={`ca${k}`} x={x} y={y - P} width={P} height={3 * P} fill={col} />);
      els.push(<rect key={`cb${k}`} x={x - P} y={y} width={3 * P} height={P} fill={col} />);
    }
    for (let k = 0; k < 16; k++) {
      const span = W * 1.3;
      const x = snap(wrap(rand(`kx${seed}${k}`) * span - s * 0.6, span) - 60);
      const len = snap(rand(`kl${seed}${k}`, 4, 12) * P);
      const col = mix(rock, pal.outline, 0.4);
      els.push(<rect key={`ka${k}`} x={x} y={0} width={4 * P} height={len} fill={col} />);
      els.push(<rect key={`kb${k}`} x={x + P} y={len} width={2 * P} height={snap(len * 0.4)} fill={col} />);
      els.push(<rect key={`kc${k}`} x={x + P} y={len + snap(len * 0.4)} width={P} height={P * 2} fill={col} />);
    }
  }
  if (world === 'sky') {
    els.push(...disc('sun', snap(W * 0.8), snap(gt * 0.2), snap(m * 0.08), P, t('#fff1b8'), undefined, t('#ffd88a')));
    const clouds = (key: string, n: number, speed: number, scale: number, op: number) => {
      for (let k = 0; k < n; k++) {
        const span = W * 1.5;
        const w = snap(rand(`${key}w${seed}${k}`, 10, 22) * P * scale);
        const x = snap(wrap(rand(`${key}x${seed}${k}`) * span - s * speed, span) - w);
        const y = snap(rand(`${key}y${seed}${k}`, 0.08, 0.75) * gt);
        const col = t('#ffffff');
        els.push(<rect key={`${key}a${k}`} x={x} y={y} width={w} height={snap(3 * P * scale)} fill={col} opacity={op} />);
        els.push(<rect key={`${key}b${k}`} x={x + snap(w * 0.2)} y={y - snap(2 * P * scale)} width={snap(w * 0.45)} height={snap(2 * P * scale)} fill={col} opacity={op} />);
        els.push(<rect key={`${key}c${k}`} x={x + snap(w * 0.5)} y={y - snap(P * scale)} width={snap(w * 0.3)} height={snap(P * scale)} fill={col} opacity={op} />);
        els.push(<rect key={`${key}d${k}`} x={x + P} y={y + snap(3 * P * scale)} width={w - 2 * P} height={P} fill={t('#c9d6f2')} opacity={op} />);
      }
    };
    clouds('fc', 7, 0.15, 0.7, 0.55);
    clouds('nc', 5, 0.55, 1.1, 0.95);
  }
  return els;
}

// ---------------------------------------------------------------------------------------------
// One level: parallax world, ground, hazards, pickups, the hero and the dialog box
// ---------------------------------------------------------------------------------------------

const LevelLayer: React.FC<{level: Level; index: number; count: number; ev: Events; plan: Plan; geo: Geo; pal: Pal; seqStart: number; hero: Props['hero']}> = ({level, index, count, ev, plan, geo, pal, seqStart, hero}) => {
  const g = useCurrentFrame() + seqStart;
  const {fps} = useVideoConfig();
  const {W, H, P, gt, v, heroX, J, jumpH, u} = geo;
  const snap = (n: number) => Math.round(n / P) * P;
  const t = pal.tone;
  const w = WORLD[level.world];
  const act = plan.act[index];
  const local = g - act;
  const s = Math.max(0, g - (index === 0 ? 0 : act - plan.D)) * v;
  const sky = mix(pal.skyBot, w.sky, pal.worldMix);
  const skyTop = mix(pal.skyTop, w.sky, pal.worldMix * 0.4);
  const ctx: Ctx = {W, H, P, gt, s, f: g, pal, seed: index, snap, sky};
  const stripes = w.ground.map(c => t(c));
  const stripeH = w.ground.length >= 6 ? P : 2 * P;
  const band = stripeH * stripes.length;
  const groundY = (x: number) => (w.wave ? gt + snap(Math.sin(((x + s) / (W * 0.22)) * Math.PI * 2) * P * 0.9) : gt);

  // Hit: blink, knockback and a short screen shake.
  const hit = ev.hazards.find(h => h.hit && g >= h.t && g < h.t + 26);
  const hk = hit ? g - hit.t : -1;
  const shake = hit && hk < 10 ? (hk % 2 ? 1 : -1) * snap(P * (1 - hk / 10) * 1.5) : 0;

  // Hero motion.
  let jy = 0;
  for (const h of ev.hazards) {
    if (h.hit) continue;
    const q = (g - (h.t - J / 2)) / J;
    if (q > 0 && q < 1) jy = -4 * q * (1 - q) * jumpH;
  }
  if (index === count - 1 && g >= plan.finaleAt) {
    const q = ((g - plan.finaleAt) % 20) / 20;
    jy = -4 * q * (1 - q) * jumpH * 0.45;
  }
  const runIn = index === 0 ? (1 - progress(g, 6, Math.round(1.1 * fps), ease.snappy)) * -(heroX + geo.hero * 1.5) : 0;
  const drop = index > 0 ? -(1 - progress(local, 0, 12, ease.overshoot)) * H * 0.45 : 0;
  const knock = hit ? -Math.sin((hk / 26) * Math.PI) * 3 * P : 0;
  const hx = snap(heroX + runIn + knock);
  const hy = snap(groundY(heroX + geo.hero / 2) - geo.hero + jy + drop);
  const airborne = jy < -P || drop < -P;
  const frames = HERO_FRAMES(hero);
  const heroColors = Object.fromEntries(Object.entries({...HERO_COLORS[hero], o: pal.outline}).map(([k, c]) => [k, k === 'o' ? c : t(c)]));
  const blink = hit && Math.floor(hk / 3) % 2 === 0 ? 0.25 : 1;

  const hazardKind: HazardName = level.hazard === 'auto' ? WORLD_HAZARD[level.world] : level.hazard;
  const hzColors = Object.fromEntries(Object.entries({...HAZARD_COLORS[hazardKind], o: pal.outline}).map(([k, c]) => [k, k === 'o' ? c : t(c)]));
  const itemColors = Object.fromEntries(Object.entries({...ITEM_COLORS, o: pal.outline}).map(([k, c]) => [k, k === 'o' ? c : t(c)]));
  const itemValue = ITEM_VALUE[level.item];
  const centerX = (tt: number) => heroX + geo.hero / 2 + (tt - g) * v;

  // Dialog box timing (frames relative to this layer's Sequence for KineticText).
  const levelLen = plan.end[index] - act;
  const words = level.text.split(/\s+/).filter(Boolean).length;
  const stagger = Math.max(1.2, Math.min(5, (levelLen * 0.45 - 16) / Math.max(1, words)));
  const textDone = 16 + words * stagger + 14;
  const boxIn = Math.round(Math.min(1, progress(local, 2, 9, ease.overshoot)) * 6) / 6;
  const fs = geo.portrait ? 1.15 : 1;

  return (
    <AbsoluteFill style={{overflow: 'hidden', background: pal.skyTop}}>
      <AbsoluteFill style={{transform: `translateX(${shake}px)`}}>
        <svg width={W} height={H} style={{position: 'absolute', inset: 0}} shapeRendering="crispEdges">
          {Array.from({length: 12}, (_, k) => (
            <rect key={k} x={0} y={snap((k * gt) / 12)} width={W} height={snap(gt / 12) + P} fill={t(mix(skyTop, sky, k / 11))} />
          ))}
        </svg>
        {level.world === 'space' ? (
          <>
            <div style={{position: 'absolute', left: W * 0.08 - s * 0.02, top: gt * 0.12, width: W * 0.38, height: gt * 0.36, background: `radial-gradient(ellipse at center, ${alpha(t('#c2185b'), 0.45)} 0%, transparent 70%)`}} />
            <div style={{position: 'absolute', left: W * 0.45 - s * 0.015, top: gt * 0.55, width: W * 0.4, height: gt * 0.4, background: `radial-gradient(ellipse at center, ${alpha(t('#5e35b1'), 0.5)} 0%, transparent 70%)`}} />
          </>
        ) : null}
        <svg width={W} height={H} style={{position: 'absolute', inset: 0}} shapeRendering="crispEdges">
          {worldLayers(level.world, ctx)}
          {/* ground: striped track over dark soil */}
          <rect x={0} y={gt + band - P} width={W} height={H} fill={pal.dirt} />
          {w.wave
            ? Array.from({length: Math.ceil(W / (2 * P)) + 1}, (_, k) => {
                const x = k * 2 * P;
                const y0 = groundY(x + P);
                return stripes.map((c, si) => <rect key={`g${k}-${si}`} x={x} y={y0 + si * stripeH} width={2 * P} height={stripeH} fill={c} />);
              })
            : stripes.map((c, si) => <rect key={`g${si}`} x={0} y={gt + si * stripeH} width={W} height={stripeH} fill={c} />)}
          {Array.from({length: Math.ceil(W / (8 * P)) + 2}, (_, k) => {
            const x = snap(k * 8 * P - (s % (8 * P)));
            return <rect key={`seam${k}`} x={x} y={groundY(x) + (w.wave ? 0 : stripeH)} width={P} height={band - (w.wave ? 0 : stripeH)} fill={pal.outline} opacity={0.3} />;
          })}
          <rect x={0} y={gt + band + (w.wave ? P : 0)} width={W} height={P} fill={pal.outline} opacity={0.45} />
          {Array.from({length: 26}, (_, k) => {
            const span = W + 100;
            const x = snap(wrap(rand(`pb${index}${k}`) * span - s, span) - 50);
            const y = snap(gt + band + 2 * P + rand(`py${index}${k}`) * (H - gt - band - 3 * P));
            return <rect key={`pe${k}`} x={x} y={y} width={rand(`pw${index}${k}`) > 0.6 ? 2 * P : P} height={P} fill={pal.light ? alpha(pal.text, 0.18) : alpha('#ffffff', 0.08)} />;
          })}
          {/* pickups */}
          {ev.pickups.map((pk, k) => {
            const sp = ITEM_SPRITES[level.item];
            const size = sp[0].length * P;
            if (g < pk.t) {
              const cx = centerX(pk.t);
              if (cx < -size || cx > W + size) return null;
              const cy = pk.high ? gt - geo.hero / 2 - jumpH : gt - geo.hero / 2 - P;
              const spin = level.item === 'coin' ? Math.max(0.2, Math.round(Math.abs(Math.cos(g / 6 + k)) * 4) / 4) : 1;
              const bob = level.item === 'coin' ? 0 : snap(Math.sin(g / 6 + k) * P);
              return (
                <g key={`pk${k}`} transform={`translate(${snap(cx)} 0) scale(${spin} 1) translate(${-snap(cx)} 0)`}>
                  <Sprite grid={sp} colors={itemColors} x={snap(cx - size / 2)} y={snap(cy - size / 2) + bob} p={P} />
                </g>
              );
            }
            const k2 = g - pk.t;
            if (k2 > 22) return null;
            return (
              <text key={`pp${k}`} x={heroX + geo.hero / 2} y={hy - P * 2 - snap(k2 * P * 0.4)} textAnchor="middle" fontFamily={fonts.mono} fontWeight={800} fontSize={P * 3.4} fill={pal.accent} stroke={pal.outline} strokeWidth={P * 0.5} paintOrder="stroke" opacity={k2 > 14 ? 0.5 : 1}>
                +{itemValue}
              </text>
            );
          })}
          {/* hazards */}
          {ev.hazards.map((h, k) => {
            const size = geo.haz;
            const p = size / 8;
            const cx = centerX(h.t);
            if (cx < -size * 2 || cx > W + size * 3) return null;
            const lift = hazardKind === 'meteor' ? 2 * P : hazardKind === 'ghost' ? P + snap(Math.sin(g / 6 + k) * P) : 0;
            const y = groundY(cx) - size - lift;
            if (h.hit && g >= h.t) {
              const d = g - h.t;
              if (d > 20) return null;
              return Array.from({length: 10}, (_, q) => {
                const vx = rand(`dx${index}${k}${q}`, -1, 1) * P * 1.6;
                const vy = rand(`dy${index}${k}${q}`, -2.2, -0.6) * P;
                return <rect key={`db${k}${q}`} x={snap(cx + vx * d)} y={snap(y + size / 2 + vy * d + 0.18 * P * d * d)} width={P} height={P} fill={q % 2 ? hzColors.o : Object.values(hzColors)[0]} />;
              });
            }
            return (
              <g key={`hz${k}`}>
                {hazardKind === 'meteor'
                  ? [1, 2, 3, 4].map(tr => <rect key={tr} x={snap(cx + size / 2 + (tr - 1) * P * 1.6)} y={snap(y + size / 2 - P + Math.sin(g / 2 + tr) * P * 0.5)} width={snap(P * (2.2 - tr * 0.35))} height={P * 2} fill={t(tr < 3 ? '#ffe14d' : '#ff9f1c')} opacity={1 - tr * 0.18} />)
                  : null}
                <Sprite grid={HAZARD_SPRITES[hazardKind]} colors={hzColors} x={snap(cx - size / 2)} y={snap(y)} p={p} />
              </g>
            );
          })}
          {/* hero: ground shadow, dust puffs, sprite */}
          <rect x={hx + snap(geo.hero * 0.15 + (-jy / jumpH) * geo.hero * 0.1)} y={groundY(heroX) - P / 2} width={snap(geo.hero * (0.7 - (-jy / jumpH) * 0.3))} height={P} fill="#000000" opacity={0.25} />
          {!airborne
            ? [0, 1, 2].map(q => {
                const a = (g + q * 4) % 12;
                return <rect key={`du${q}`} x={snap(hx - a * P * 0.6)} y={snap(groundY(heroX) - P * 1.5 - a * P * 0.15)} width={P} height={P} fill={pal.light ? pal.muted : t('#ffffff')} opacity={(1 - a / 12) * 0.5} />;
              })
            : null}
          <Sprite grid={airborne ? frames[0] : frames[Math.floor(g / 4) % 2]} colors={heroColors} x={hx} y={hy} p={P} opacity={blink} />
        </svg>
        {level.world === 'forest' || level.world === 'cave' ? <Particles count={18} color={t(level.world === 'cave' ? '#3ee6ff' : '#ffe86b')} seed={`ff${index}`} size={[P * 0.4, P * 0.8]} speed={0.4} opacity={0.6} /> : null}
      </AbsoluteFill>
      {hit && hk < 6 ? <AbsoluteFill style={{background: t('#ff3b5c'), opacity: 0.22 * (1 - hk / 6)}} /> : null}
      {/* dialog box */}
      {local >= 2 ? (
        <div style={{position: 'absolute', left: (W - geo.dialogW) / 2, top: geo.dialogTop, width: geo.dialogW, maxHeight: Math.max(geo.dialogBottom - geo.dialogTop, 120 * u), overflow: 'hidden', transform: `scale(${boxIn})`, transformOrigin: '50% 0%'}}>
          <div style={{background: alpha(pal.panel, pal.light ? 0.94 : 0.9), border: `${Math.round(P * 0.6)}px solid ${pal.line}`, boxShadow: `0 0 0 ${Math.round(P * 0.6)}px ${pal.outline}, inset 0 0 0 ${Math.round(P * 0.6)}px ${alpha(pal.accent, 0.25)}, ${P}px ${P}px 0 ${Math.round(P * 0.6)}px ${alpha('#000000', 0.35)}`, padding: `${P * 2.2}px ${P * 3}px ${P * 2.4}px`, color: pal.text, position: 'relative'}}>
            <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontFamily: fonts.mono, fontWeight: 800, fontSize: 26 * u * fs, letterSpacing: '0.16em'}}>
              <span style={{background: pal.accent, color: pal.outline, padding: `${P * 0.3}px ${P * 1}px`}}>LEVEL {String(index + 1).padStart(2, '0')}</span>
              <span style={{color: pal.muted}}>{w.label}</span>
            </div>
            <div style={{marginTop: P * 1.6}}>
              <KineticText text={level.name.toUpperCase()} start={act - seqStart + 6} stagger={3} style="pop" align="left" textStyle={{fontFamily: fonts.heavy, fontSize: 58 * u * fs, lineHeight: 1.02, color: pal.text, textShadow: `${Math.round(P * 0.5)}px ${Math.round(P * 0.5)}px 0 ${pal.outline}`}} />
            </div>
            {level.text ? (
              <div style={{marginTop: P * 1.2}}>
                <KineticText text={level.text} start={act - seqStart + 16} stagger={stagger} duration={12} style="rise" textStyle={{fontFamily: fonts.sans, fontWeight: 600, fontSize: 36 * u * fs, lineHeight: 1.25, color: pal.text}} />
              </div>
            ) : null}
            {local > textDone && Math.floor(g / 12) % 2 === 0 ? (
              <div style={{position: 'absolute', right: P * 2, bottom: P * 1.2, width: 0, height: 0, borderLeft: `${P}px solid transparent`, borderRight: `${P}px solid transparent`, borderTop: `${P * 1.2}px solid ${pal.accent}`}} />
            ) : null}
          </div>
        </div>
      ) : null}
    </AbsoluteFill>
  );
};

// ---------------------------------------------------------------------------------------------
// Overlays: start screen, HUD, block wipe, finale
// ---------------------------------------------------------------------------------------------

const StartScreen: React.FC<{title: string; pal: Pal; geo: Geo; end: number}> = ({title, pal, geo, end}) => {
  const frame = useCurrentFrame();
  const {W, H, P, u, portrait} = geo;
  const words = title.replace(/\*/g, '').split(/\s+/);
  const longest = Math.max(...words.map(x => x.length));
  let size = (portrait ? 132 : 140) * u;
  const lines = (sz: number) => Math.ceil((title.length * 0.78 * sz) / (W * 0.84));
  while (size > 48 * u && (lines(size) * size * 1.08 > H * 0.36 || longest * 0.8 * size > W * 0.86)) size *= 0.93;
  const sh = Math.round(P * 0.6);
  return (
    <AbsoluteFill style={{background: alpha(pal.skyTop, 0.55)}}>
      <AbsoluteFill style={{justifyContent: 'center', alignItems: 'center', paddingBottom: H * (portrait ? 0.22 : 0.2)}}>
        <div style={{fontFamily: fonts.mono, fontWeight: 800, color: pal.muted, fontSize: 28 * u, letterSpacing: '0.4em', marginBottom: P * 2.5, opacity: progress(frame, 0, 8) > 0.5 ? 1 : 0}}>1 PLAYER</div>
        <KineticText text={title.toUpperCase()} start={5} stagger={4} style="pop" align="center" accent={pal.accent} textStyle={{fontFamily: fonts.heavy, color: pal.text, fontSize: size, lineHeight: 1.04, maxWidth: W * 0.86, textShadow: `${sh}px ${sh}px 0 ${pal.accent}, ${sh * 2}px ${sh * 2}px 0 ${pal.outline}`}} />
        <div style={{marginTop: P * 4, fontFamily: fonts.mono, fontWeight: 800, color: pal.accent, fontSize: 34 * u, letterSpacing: '0.3em', opacity: frame > 14 && Math.floor(frame / 10) % 2 === 0 && frame < end ? 1 : 0, textShadow: `${sh}px ${sh}px 0 ${pal.outline}`}}>PRESS START</div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

const Hud: React.FC<{pal: Pal; geo: Geo; score: number; lives: number; maxLives: number; lostAt: number; level: number; count: number; appear: number}> = ({pal, geo, score, lives, maxLives, lostAt, level, count, appear}) => {
  const frame = useCurrentFrame();
  const {W, H, P, u, portrait} = geo;
  const fsz = (portrait ? 32 : 30) * u;
  const sh = Math.round(P * 0.4);
  const label: React.CSSProperties = {fontFamily: fonts.mono, fontWeight: 800, fontSize: fsz, letterSpacing: '0.12em', color: pal.text, textShadow: `${sh}px ${sh}px 0 ${pal.outline}`};
  const hp = Math.max(2, Math.round(P * 0.7));
  const heartColors = {o: pal.outline, r: pal.tone('#ff3b5c'), h: pal.tone('#ffb3c1')};
  const emptyColors = {o: pal.outline, r: alpha(pal.text, 0.18), h: alpha(pal.text, 0.18)};
  return (
    <div style={{position: 'absolute', left: W * 0.04, right: W * 0.04, top: H * (portrait ? 0.035 : 0.04), display: 'flex', justifyContent: 'space-between', alignItems: 'center', transform: `translateY(${(1 - appear) * -H * 0.08}px)`}}>
      <div style={label}>
        <span style={{color: pal.muted}}>SCORE </span>
        {String(score).padStart(6, '0')}
      </div>
      <div style={{...label, display: 'flex', alignItems: 'center', gap: P}}>
        {portrait ? null : <span style={{color: pal.muted}}>LEVEL</span>}
        {Array.from({length: count}, (_, i) => (
          <div key={i} style={{width: P * 1.4, height: P * 1.4, background: i < level ? pal.accent : i === level ? (Math.floor(frame / 8) % 2 ? pal.accent : pal.text) : alpha(pal.text, 0.2), boxShadow: `${sh}px ${sh}px 0 ${pal.outline}`}} />
        ))}
      </div>
      <svg width={maxLives * 8 * hp} height={7 * hp} shapeRendering="crispEdges" style={{overflow: 'visible'}}>
        {Array.from({length: maxLives}, (_, i) => {
          const full = i < lives;
          const justLost = i === lives && lostAt >= 0 && frame - lostAt < 14;
          const k = frame - lostAt;
          if (justLost) {
            const sc = 1 + Math.round((k / 14) * 4) / 4;
            return (
              <g key={i} opacity={1 - k / 14} transform={`translate(${i * 8 * hp + 3.5 * hp} ${3.5 * hp - k * hp * 0.3}) scale(${sc}) translate(${-3.5 * hp} ${-3.5 * hp})`}>
                <Sprite grid={ITEM_SPRITES.heart} colors={heartColors} x={0} y={0} p={hp} />
              </g>
            );
          }
          return <Sprite key={i} grid={ITEM_SPRITES.heart} colors={full ? heartColors : emptyColors} x={i * 8 * hp} y={0} p={hp} />;
        })}
      </svg>
    </div>
  );
};

/** Arcade block wipe: squares grow in a diagonal sweep, cover the cut, then shrink away. */
const BlockWipe: React.FC<{boundaries: number[]; D: number; color: string; geo: Geo}> = ({boundaries, D, color, geo}) => {
  const frame = useCurrentFrame();
  const b = boundaries.find(x => Math.abs(frame - x) <= D);
  if (b === undefined) return null;
  const {W, H, portrait} = geo;
  const cols = portrait ? 9 : 16;
  const cell = W / cols;
  const rows = Math.ceil(H / cell);
  const p = (frame - b + D) / (2 * D);
  const rects: React.ReactNode[] = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const diag = (c / cols + r / rows) / 2;
      const q = p * 1.6 - diag * 0.6;
      const sz = Math.ceil(Math.max(0, Math.min(1, q / 0.2, (1 - q) / 0.2)) * 4) / 4;
      if (sz <= 0) continue;
      const d = cell * sz + 1;
      rects.push(<rect key={`${r}-${c}`} x={c * cell + (cell - d) / 2} y={r * cell + (cell - d) / 2} width={d} height={d} fill={color} />);
    }
  }
  return (
    <svg width={W} height={H} style={{position: 'absolute', inset: 0}} shapeRendering="crispEdges">
      {rects}
    </svg>
  );
};

const Finale: React.FC<{text: string; score: number; pal: Pal; geo: Geo}> = ({text, score, pal, geo}) => {
  const frame = useCurrentFrame();
  const {W, H, P, u, portrait} = geo;
  const sh = Math.round(P * 0.6);
  const size = Math.min((portrait ? 112 : 120) * u, (W * 0.86) / Math.max(6, text.length * 0.78));
  return (
    <AbsoluteFill>
      <AbsoluteFill style={{background: alpha(pal.skyTop, 0.45 * progress(frame, 0, 8))}} />
      <svg width={W} height={H} style={{position: 'absolute', inset: 0}} shapeRendering="crispEdges">
        {Array.from({length: 46}, (_, i) => {
          const a = rand(`cf${i}`, 0, Math.PI * 2);
          const sp = rand(`cs${i}`, 0.6, 1.6) * P * 1.4;
          const k = Math.max(0, frame - 4);
          const x = W / 2 + Math.cos(a) * sp * k;
          const y = H * 0.34 + Math.sin(a) * sp * k + 0.08 * P * k * k;
          const cols = [pal.accent, pal.text, pal.tone('#ff3b5c'), pal.tone('#3ec7ff'), pal.tone('#3ddc84')];
          if (k === 0 || y > H) return null;
          return <rect key={i} x={Math.round(x / P) * P} y={Math.round(y / P) * P} width={P} height={P} fill={cols[i % cols.length]} />;
        })}
      </svg>
      <AbsoluteFill style={{justifyContent: 'center', alignItems: 'center', paddingBottom: H * (portrait ? 0.3 : 0.32)}}>
        <KineticText text={text.toUpperCase()} start={2} stagger={4} style="pop" align="center" textStyle={{fontFamily: fonts.heavy, color: pal.text, fontSize: size, lineHeight: 1.05, maxWidth: W * 0.9, textShadow: `${sh}px ${sh}px 0 ${pal.accent}, ${sh * 2}px ${sh * 2}px 0 ${pal.outline}`}} />
        <div style={{marginTop: P * 3, fontFamily: fonts.mono, fontWeight: 800, fontSize: 40 * u, letterSpacing: '0.2em', color: pal.accent, opacity: frame > 10 ? 1 : 0, textShadow: `${sh}px ${sh}px 0 ${pal.outline}`}}>
          SCORE {countUp(frame, score, 10, 28)}
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

// ---------------------------------------------------------------------------------------------
// Entry
// ---------------------------------------------------------------------------------------------

const PixelArcade: React.FC<EntryProps<Props>> = ({media, props}) => {
  const frame = useCurrentFrame();
  const {fps, durationInFrames} = useVideoConfig();
  const look = useLook();
  const own = PALETTES[props.palette];
  const pal: Pal = look ? fromLook(look) : {...own, accent: media.accent ? own.tone(media.accent) : own.accent};
  const geo = useGeo(look);
  const timeline = useSceneTimeline(media);
  const contentEnd = Math.min(useContentFrames(media), durationInFrames - Math.round((media.tailMs / 1000) * fps));
  const levels = props.levels;
  const L = levels.length;
  const plan = React.useMemo(() => makePlan(timeline, L, fps, contentEnd), [timeline, L, fps, contentEnd]);
  const events = React.useMemo(() => levels.map((lv, i) => levelEvents(lv, i, plan, fps, L)), [levels, plan, fps, L]);

  // One pseudo-scene per level so SceneSeries cuts exactly at each level boundary.
  const starts = plan.act.map((a, i) => (i === 0 ? 0 : a));
  const levelMedia: Media = {
    ...media,
    scenes: levels.map((_, i) => ({...media.scenes[0], audio: {url: '', duration: Math.max(1, (i < L - 1 ? starts[i + 1] : contentEnd) - starts[i]) / fps}})),
  };

  // Score and lives are pure functions of the frame.
  let score = 0;
  let finalScore = 0;
  let hits = 0;
  let lostAt = -1;
  events.forEach((ev, i) => {
    const value = ITEM_VALUE[levels[i].item];
    for (const pk of ev.pickups) {
      finalScore += value;
      score += value * progress(frame, pk.t, 8, ease.expo);
    }
    for (const h of ev.hazards) if (h.hit && frame >= h.t) {
      hits++;
      lostAt = h.t;
    }
  });
  const lives = Math.max(0, props.lives - hits);
  const current = Math.max(0, plan.act.findIndex((a, i) => frame >= a && (i === L - 1 || frame < plan.act[i + 1])));
  const finaleLen = contentEnd - plan.finaleAt;
  const scanColor = pal.light ? pal.text : '#000000';

  return (
    <AbsoluteFill style={{background: pal.skyTop, overflow: 'hidden'}}>
      <SceneSeries
        media={levelMedia}
        overlap={plan.D * 2}
        transition="cut"
        renderScene={({index, timed}) => (
          <LevelLayer level={levels[index]} index={index} count={L} ev={events[index]} plan={plan} geo={geo} pal={pal} seqStart={index === 0 ? 0 : timed.from - plan.D} hero={props.hero} />
        )}
      />
      <Sequence durationInFrames={plan.introEnd}>
        <StartScreen title={props.title} pal={pal} geo={geo} end={plan.introEnd} />
      </Sequence>
      {frame >= plan.introEnd && frame < contentEnd ? (
        <Hud pal={pal} geo={geo} score={Math.round(score)} lives={lives} maxLives={props.lives} lostAt={lostAt} level={current} count={L} appear={Math.round(progress(frame, plan.introEnd, 10, ease.overshoot) * 5) / 5} />
      ) : null}
      {finaleLen > 4 ? (
        <Sequence from={plan.finaleAt} durationInFrames={Math.max(1, durationInFrames - plan.finaleAt)}>
          <Finale text={props.ending} score={finalScore} pal={pal} geo={geo} />
        </Sequence>
      ) : null}
      {finaleLen > 4 ? <LightLeak from={plan.finaleAt} durationInFrames={Math.round(1.6 * fps)} seed={7} hueShift={200} opacity={pal.light ? 0.2 : 0.35} /> : null}
      <BlockWipe boundaries={[plan.introEnd, ...plan.act.slice(1)]} D={plan.D} color={pal.outline} geo={geo} />
      {props.showCaptions && !look
        ? timeline.map(t => (
            <Sequence key={t.index} from={t.from} durationInFrames={Math.max(1, Math.min(t.durationInFrames, contentEnd - t.from))}>
              <AbsoluteFill style={{top: geo.gt + geo.P * 7, height: geo.H - geo.gt - geo.P * 7, justifyContent: 'center', alignItems: 'center', padding: geo.portrait ? '0 6%' : '0 12%'}}>
                <StyledCaptions scene={t.scene} variant="box" accent={pal.accent} color={pal.text} font={fonts.heavy} size={(geo.portrait ? 50 : 44) * geo.u} words={geo.portrait ? 4 : 6} uppercase />
              </AbsoluteFill>
            </Sequence>
          ))
        : null}
      {/* CRT scanlines: a static top-level texture */}
      {pal.scan > 0 ? <AbsoluteFill style={{pointerEvents: 'none', opacity: pal.scan, backgroundImage: `repeating-linear-gradient(0deg, ${scanColor} 0px, ${scanColor} ${Math.max(1, Math.round(geo.P * 0.25))}px, transparent ${Math.max(1, Math.round(geo.P * 0.25))}px, transparent ${Math.max(2, Math.round(geo.P * 0.5))}px)`}} /> : null}
      <Vignette strength={0.4} />
      <Grain opacity={0.035} />
      <NarrationTrack media={media} />
      <AdWeave media={media} theme={{background: pal.skyTop, text: pal.text, font: fonts.heavy}} />
    </AbsoluteFill>
  );
};

export default defineEntry({id: 'story-pixel-arcade', schema: Props, component: PixelArcade});
