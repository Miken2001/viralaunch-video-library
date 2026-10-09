import React from 'react';
import {AbsoluteFill, Sequence, useCurrentFrame, useVideoConfig} from 'remotion';
import {AdWeave, NarrationTrack, captionSafeBottom, defineEntry, mix, useContentFrames, useLook, useSceneTimeline, type ActiveLook, type EntryProps, type TimedScene} from '@viralaunch/kit';
import {Grain, KineticText, LightLeak, LineIcon, Particles, StyledCaptions, Vignette, alpha, countUp, ease, fonts, progress, rand, tween} from '@viralaunch/kit/fx';
import {Props, type Era} from './schema';

type Pal = {tone: 'dark' | 'light'; bg: string; bg2: string; surface: string; text: string; muted: string; accent: string; line: string; land: string; water: string; eras: string[]};

const PALETTES: Record<Props['palette'], Pal> = {
  earth: {tone: 'dark', bg: '#15100b', bg2: '#2c2117', surface: '#211911', text: '#f4ead8', muted: '#b3a189', accent: '#e8b04a', line: '#f4ead8', land: '#c39c62', water: '#1d4657', eras: ['#7b5ea7', '#4f7cc2', '#3fa38a', '#8fb84c', '#e0a43a', '#d9663e']},
  abyss: {tone: 'dark', bg: '#05131a', bg2: '#0e2b35', surface: '#0b1f27', text: '#e6f4f2', muted: '#8fb3b0', accent: '#5fe0c4', line: '#d7efe9', land: '#b5a57c', water: '#145064', eras: ['#5a5fd6', '#3d8fd1', '#33b6b0', '#7fcf7a', '#e6c25a', '#e07a5a']},
  parchment: {tone: 'light', bg: '#f3ead8', bg2: '#e2d3b5', surface: '#fbf6ea', text: '#2a2219', muted: '#7d6e58', accent: '#b5542e', line: '#2a2219', land: '#c99f63', water: '#7fb0c0', eras: ['#6d5a9c', '#4a78a8', '#4e9a7e', '#93a548', '#d19a32', '#b5542e']},
};

/** The ruler in a sequence's shared look: era bands step from the muted tone to the accent. */
const fromLook = (l: ActiveLook, n: number): Pal => {
  const p = l.palette;
  const base = mix(p.muted, p.bg2, 0.25);
  return {
    tone: l.tone, bg: p.bg, bg2: p.bg2, surface: p.surface, text: p.text, muted: p.muted, accent: p.accent, line: p.line,
    land: mix(p.surface, p.accent, l.tone === 'light' ? 0.45 : 0.4),
    water: mix(p.bg2, p.line, l.tone === 'light' ? 0.32 : 0.14),
    eras: Array.from({length: n}, (_, i) => mix(base, p.accent, n > 1 ? 0.2 + (0.8 * i) / (n - 1) : 1)),
  };
};

/** Accent for small text: darkened on light backgrounds so it stays readable. */
const ink = (pal: Pal) => (pal.tone === 'light' ? mix(pal.accent, pal.text, 0.45) : pal.accent);

// ---------------------------------------------------------------------------------------------
// Time axis: logarithmic for deep time, linear for calendar history
// ---------------------------------------------------------------------------------------------

type Axis = {pos: (v: number) => number; older: (e: Era) => number; newer: (e: Era) => number; long: (v: number) => string; short: (v: number) => string; ticks: {v: number; label: string}[]; total: string};

const clamp01 = (x: number) => Math.min(1, Math.max(0, x));
const dec = (x: number) => (x < 10 ? x.toFixed(1).replace(/\.0$/, '') : String(Math.round(x)));
const longAgo = (y: number) => (y >= 1e9 ? `${dec(y / 1e9)} billion` : y >= 1e6 ? `${dec(y / 1e6)} million` : Math.round(y).toLocaleString('en-US'));
const shortAgo = (y: number) => (y <= 0 ? 'now' : y >= 1e9 ? `${dec(y / 1e9)}bn` : y >= 1e6 ? `${dec(y / 1e6)}M` : y >= 1e4 ? `${dec(y / 1e3)}k` : Math.round(y).toLocaleString('en-US'));

function niceStep(x: number) {
  if (!(x > 0)) return 1;
  const p = Math.pow(10, Math.floor(Math.log10(x)));
  return ([1, 2, 2.5, 5, 10].find(m => m * p >= x) ?? 10) * p;
}

function linearTicks(lo: number, hi: number, count: number, label: (v: number) => string) {
  const step = niceStep((hi - lo) / count);
  const out: {v: number; label: string}[] = [];
  for (let v = Math.ceil(lo / step) * step; v <= hi + step * 1e-6 && out.length < 12; v += step) out.push({v, label: label(v)});
  return out;
}

function makeAxis(eras: Era[], kind: Props['axis']): Axis {
  const all = eras.flatMap(e => [e.from, e.to]);
  if (kind === 'calendar') {
    const lo = Math.min(...all);
    const hi = Math.max(...all);
    const pad = (hi - lo) * 0.04 || 1;
    const bc = lo < 0;
    const year = (v: number) => (v < 0 ? `${Math.round(-v)} BC` : bc ? `AD ${Math.round(v)}` : String(Math.round(v)));
    return {
      pos: v => clamp01((v - lo + pad) / (hi - lo + 2 * pad)),
      older: e => Math.min(e.from, e.to),
      newer: e => Math.max(e.from, e.to),
      long: year,
      short: year,
      ticks: linearTicks(lo, hi, 6, year),
      total: `${year(lo)} – ${year(hi)}`,
    };
  }
  const vals = all.map(v => Math.max(0, v));
  const maxV = Math.max(1, ...vals);
  const positive = vals.filter(v => v > 0);
  const minPos = positive.length ? Math.min(...positive) : 1;
  const hasNow = vals.some(v => v === 0);
  const hiL = Math.log10(maxV * 1.12);
  const loL = Math.min(hiL - 0.3, Math.log10(minPos) - (hasNow ? 0.7 : 0.08));
  const pos = (v: number) => (v <= 0 ? 1 : clamp01((hiL - Math.log10(v)) / (hiL - loL)));
  let ticks: {v: number; label: string}[] = [];
  for (let p = Math.max(0, Math.ceil(loL)); p <= Math.floor(hiL); p++) {
    const x = pos(Math.pow(10, p));
    if (x > 0.04 && x < (hasNow ? 0.93 : 0.97)) ticks.push({v: Math.pow(10, p), label: shortAgo(Math.pow(10, p))});
  }
  if (ticks.length > 8) ticks = ticks.filter((_, i) => i % 2 === 0);
  if (hasNow) ticks.push({v: 0, label: 'now'});
  return {
    pos,
    older: e => Math.max(e.from, e.to),
    newer: e => Math.min(e.from, e.to),
    long: v => (v < 0.5 ? 'today' : `${longAgo(v)} years ago`),
    short: shortAgo,
    ticks,
    total: `${longAgo(maxV)} years`,
  };
}

/** When each era owns the screen: one narration scene per era (plus an optional title scene). */
function schedule(timeline: TimedScene[], n: number, fps: number, contentEnd: number) {
  let introEnd: number;
  let starts: number[];
  if (timeline.length >= n + 1) {
    starts = Array.from({length: n}, (_, i) => timeline[i + 1].from);
    introEnd = starts[0];
  } else if (timeline.length === n) {
    introEnd = Math.min(Math.round(1.8 * fps), Math.round(timeline[0].durationInFrames * 0.45));
    starts = Array.from({length: n}, (_, i) => (i === 0 ? introEnd : timeline[i].from));
  } else {
    introEnd = Math.min(Math.round(1.8 * fps), Math.round(contentEnd * 0.12));
    const each = (contentEnd - introEnd) / n;
    starts = Array.from({length: n}, (_, i) => Math.round(introEnd + i * each));
  }
  const last = contentEnd - Math.round(0.8 * fps);
  starts = starts.map((s, i) => Math.min(s, last - (n - 1 - i) * 6));
  introEnd = Math.min(introEnd, starts[0]);
  const ends = starts.map((s, i) => (i < n - 1 ? starts[i + 1] : contentEnd));
  return {introEnd, starts, ends};
}

// ---------------------------------------------------------------------------------------------
// Illustrations
// ---------------------------------------------------------------------------------------------

type VisualProps = {w: number; h: number; pal: Pal; index: number; local: number; eraPos: number; color: string; era: Era; u: number};

function smoothClosed(pts: [number, number][]) {
  const n = pts.length;
  const mid = (a: [number, number], b: [number, number]) => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
  const start = mid(pts[n - 1], pts[0]);
  let d = `M${start[0]},${start[1]}`;
  for (let i = 0; i < n; i++) {
    const q = mid(pts[i], pts[(i + 1) % n]);
    d += ` Q${pts[i][0]},${pts[i][1]} ${q[0]},${q[1]}`;
  }
  return d + 'Z';
}

/** Orthographic planet: continents drift apart the later the era sits on the ruler. */
const Globe: React.FC<VisualProps> = ({w, h, pal, index, local, eraPos}) => {
  const R = (Math.min(w, h) / 2) * 0.84;
  const cx = w / 2;
  const cy = h / 2;
  const rot = -0.35 + local * 0.0035;
  const spread = 0.18 + 0.82 * clamp01(eraPos * 1.8 + local * 0.0015);
  const id = `dtg${index}`;
  const proj = (lon: number, lat: number): [number, number, number] => {
    const l = lon + rot;
    let x = R * Math.cos(lat) * Math.sin(l);
    let y = -R * Math.sin(lat);
    const z = Math.cos(lat) * Math.cos(l);
    if (z < 0) {
      const len = Math.hypot(x, y) || 1;
      x = (x / len) * R;
      y = (y / len) * R;
    }
    return [cx + x, cy + y, z];
  };
  const blobs = [0, 1, 2, 3, 4].map(k => {
    const lonC = (rand(`gl${k}`) - 0.5) * 3 * spread + (k - 2) * 0.22 * spread;
    const latC = (rand(`gt${k}`) - 0.5) * 1.3 * spread + (rand(`gu${k}`) - 0.5) * 0.35;
    const r = rand(`gr${k}`, 0.3, 0.52);
    const z = Math.cos(latC) * Math.cos(lonC + rot);
    const pts = Array.from({length: 26}, (_, j) => {
      const a = (j / 26) * Math.PI * 2;
      const rr = r * (0.72 + 0.4 * (rand(`gb${k}${j}`) * 0.6 + rand(`gb${k}${Math.floor(j / 3)}`) * 0.4));
      const p = proj(lonC + (rr * Math.cos(a)) / Math.max(0.3, Math.cos(latC)), latC + rr * Math.sin(a));
      return [p[0], p[1]] as [number, number];
    });
    return {d: smoothClosed(pts), opacity: clamp01((z + 0.2) / 0.45)};
  });
  const enter = progress(local, 0, 30, ease.expo);
  const meridians = Array.from({length: 6}, (_, m) => (((m * Math.PI) / 6 + rot) % Math.PI + Math.PI) % Math.PI);
  return (
    <svg width={w} height={h} style={{overflow: 'visible', transform: `scale(${0.86 + 0.14 * enter})`, opacity: enter}}>
      <defs>
        <radialGradient id={`${id}o`} cx="38%" cy="32%" r="75%">
          <stop offset="0%" stopColor={mix(pal.water, '#ffffff', 0.18)} />
          <stop offset="60%" stopColor={pal.water} />
          <stop offset="100%" stopColor={mix(pal.water, '#000000', 0.45)} />
        </radialGradient>
        <radialGradient id={`${id}s`} cx="32%" cy="28%" r="85%">
          <stop offset="55%" stopColor="#000" stopOpacity={0} />
          <stop offset="100%" stopColor="#000" stopOpacity={0.5} />
        </radialGradient>
        <clipPath id={`${id}c`}>
          <circle cx={cx} cy={cy} r={R} />
        </clipPath>
      </defs>
      <circle cx={cx} cy={cy} r={R * 1.04} fill="none" stroke={alpha(pal.accent, 0.35)} strokeWidth={R * 0.05} style={{filter: `blur(${R * 0.04}px)`}} />
      <circle cx={cx} cy={cy} r={R} fill={`url(#${id}o)`} />
      <g clipPath={`url(#${id}c)`}>
        {meridians.map((l, m) => <ellipse key={m} cx={cx} cy={cy} rx={R * Math.abs(Math.sin(l))} ry={R} fill="none" stroke={alpha(pal.line, 0.1)} strokeWidth={1.5} />)}
        {[-60, -30, 0, 30, 60].map(d => {
          const la = (d * Math.PI) / 180;
          return <line key={d} x1={cx - R * Math.cos(la)} x2={cx + R * Math.cos(la)} y1={cy - R * Math.sin(la)} y2={cy - R * Math.sin(la)} stroke={alpha(pal.line, 0.1)} strokeWidth={1.5} />;
        })}
        {blobs.map((b, k) => <path key={k} d={b.d} fill={pal.land} opacity={b.opacity} stroke={pal.tone === 'light' ? mix(pal.land, pal.text, 0.45) : mix(pal.land, '#ffffff', 0.25)} strokeWidth={2.5} />)}
        <circle cx={cx} cy={cy} r={R} fill={`url(#${id}s)`} />
      </g>
    </svg>
  );
};

/** Rock column: the era's layer glows, older eras sit deeper; a drill core descends to it. */
const Strata: React.FC<VisualProps> = ({w, h, pal, index, local, eraPos, era, u}) => {
  const N = 7;
  const dw = Math.min(w * 0.94, h * 1.3);
  const dh = Math.min(h * 0.82, dw * 0.78);
  const x0 = (w - dw) / 2;
  const y0 = (h - dh) / 2;
  const hi = Math.round((1 - clamp01(eraPos)) * (N - 2)) + 1;
  const boundary = (j: number) =>
    Array.from({length: 13}, (_, k) => {
      const x = x0 + (k / 12) * dw;
      const y = j === N ? y0 + dh : y0 + (dh * j) / N + (j === 0 ? 0 : Math.sin((k / 12) * Math.PI * 1.3 + j * 0.9 + index) * dh * 0.02 + (rand(`sb${index}${j}${k}`) - 0.5) * dh * 0.012);
      return [x, y] as [number, number];
    });
  const bounds = Array.from({length: N + 1}, (_, j) => boundary(j));
  const drillX = x0 + dw * 0.66;
  const hiMid = (bounds[hi][8][1] + bounds[hi + 1][8][1]) / 2;
  const drill = progress(local, 24, 34, ease.cinematic);
  const label = progress(local, 54, 16, ease.overshoot);
  const fs = 24 * u * Math.min(1.2, dw / (700 * u));
  const pillW = era.name.length * fs * 0.62 + 32 * u;
  const pulse = 0.85 + 0.15 * Math.sin(local / 7);
  return (
    <svg width={w} height={h} style={{overflow: 'visible'}}>
      <defs>
        {bounds.slice(0, N).map((_, j) => (
          <clipPath key={j} id={`dts${index}-${j}`}>
            <rect x={x0} y={0} width={dw * progress(local, 2 + j * 3, 24, ease.expo)} height={h} />
          </clipPath>
        ))}
      </defs>
      {bounds.slice(0, N).map((top, j) => {
        const bottom = [...bounds[j + 1]].reverse();
        const d = `M${[...top, ...bottom].map(p => `${p[0]},${p[1]}`).join(' L')} Z`;
        const fill = j === hi ? pal.accent : mix(mix(pal.land, pal.eras[(j * 2) % pal.eras.length], 0.22), pal.tone === 'light' ? pal.text : pal.bg, 0.08 + (0.45 * j) / N + (j % 2 ? 0.16 : 0));
        return (
          <g key={j} clipPath={`url(#dts${index}-${j})`}>
            <path d={d} fill={fill} opacity={j === hi ? pulse : 1} stroke={alpha(pal.bg, 0.5)} strokeWidth={2} />
            {j !== hi
              ? [0, 1, 2].map(f => {
                  const fx = x0 + dw * rand(`sfx${index}${j}${f}`, 0.06, 0.94);
                  const fy = (top[6][1] + bounds[j + 1][6][1]) / 2 + (rand(`sfy${index}${j}${f}`) - 0.5) * (dh / N) * 0.4;
                  const r = (dh / N) * rand(`sfr${index}${j}${f}`, 0.1, 0.18);
                  return <path key={f} d={`M${fx + r},${fy} A${r},${r} 0 1 1 ${fx - r},${fy} A${r * 0.6},${r * 0.6} 0 1 1 ${fx + r * 0.2},${fy}`} fill="none" stroke={alpha(pal.tone === 'light' ? pal.text : pal.line, 0.22)} strokeWidth={2} />;
                })
              : null}
          </g>
        );
      })}
      <path d={`M${bounds[hi].map(p => `${p[0]},${p[1]}`).join(' L')}`} fill="none" stroke={pal.text} strokeWidth={3 * u} opacity={progress(local, 20, 14)} />
      <line x1={drillX} x2={drillX} y1={y0 - 40 * u} y2={y0 - 40 * u + (hiMid - y0 + 40 * u) * drill} stroke={pal.text} strokeWidth={4 * u} strokeDasharray={`${12 * u} ${8 * u}`} />
      <circle cx={drillX} cy={y0 - 40 * u + (hiMid - y0 + 40 * u) * drill} r={9 * u} fill={pal.text} stroke={pal.bg} strokeWidth={3 * u} />
      <g opacity={label} transform={`translate(${drillX + 22 * u}, ${hiMid}) scale(${0.6 + 0.4 * label})`}>
        <rect x={0} y={-fs * 0.95} width={pillW} height={fs * 1.9} rx={fs * 0.4} fill={pal.bg} opacity={0.92} stroke={pal.text} strokeWidth={1.5} />
        <text x={16 * u} y={fs * 0.35} fill={pal.text} style={{fontFamily: fonts.mono, fontSize: fs, letterSpacing: '0.06em'}}>{era.name}</text>
      </g>
    </svg>
  );
};

/** Landscape cross-section with a rising water level and snow on the high ground. */
const Terrain: React.FC<VisualProps> = ({w, h, pal, index, local, u}) => {
  const dw = w * 0.96;
  const dh = Math.min(h * 0.8, dw * 0.72);
  const x0 = (w - dw) / 2;
  const y0 = (h - dh) / 2;
  const c = 0.5 + (rand(`tc${index}`) - 0.5) * 0.2;
  const prof = Array.from({length: 49}, (_, k) => {
    const x = k / 48;
    const v = Math.exp(-Math.pow((x - c) / 0.17, 2));
    return [x0 + x * dw, y0 + dh * (0.2 + 0.46 * v + 0.07 * Math.sin(x * 11 + index * 2) + 0.035 * Math.sin(x * 27 + index))] as [number, number];
  });
  const line = `M${prof.map(p => `${p[0]},${p[1]}`).join(' L')}`;
  const land = `${line} L${x0 + dw},${y0 + dh} L${x0},${y0 + dh} Z`;
  const draw = progress(local, 4, 40, ease.cinematic);
  const level = y0 + dh * (rand(`tw${index}`, 0.5, 0.62) + 0.1 * (1 - progress(local, 16, 90, ease.cinematic)));
  const id = `dtt${index}`;
  const snow = pal.tone === 'light' ? '#ffffff' : mix(pal.text, '#ffffff', 0.4);
  return (
    <svg width={w} height={h} style={{overflow: 'visible'}}>
      <defs>
        <linearGradient id={`${id}w`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={mix(pal.water, '#ffffff', 0.15)} />
          <stop offset="100%" stopColor={mix(pal.water, '#000000', 0.35)} />
        </linearGradient>
        <clipPath id={`${id}c`}>
          <path d={land} />
        </clipPath>
      </defs>
      <circle cx={x0 + dw * 0.82} cy={y0 + dh * 0.12 - progress(local, 0, 120, ease.cinematic) * dh * 0.04} r={dh * 0.06} fill={alpha(pal.accent, 0.8)} style={{filter: `blur(${2 * u}px)`}} />
      <g opacity={progress(local, 10, 20)}>
        <rect x={x0} y={level} width={dw} height={y0 + dh - level} fill={`url(#${id}w)`} />
        {[0, 1, 2, 3].map(k => {
          const wx = x0 + ((k * 0.27 + local * 0.004) % 1) * dw;
          return <line key={k} x1={wx} x2={wx + dw * 0.06} y1={level + (8 + k * 10) * u} y2={level + (8 + k * 10) * u} stroke={alpha('#ffffff', 0.35)} strokeWidth={2 * u} />;
        })}
        <line x1={x0} x2={x0 + dw} y1={level} y2={level} stroke={alpha('#ffffff', 0.55)} strokeWidth={2 * u} />
      </g>
      <path d={land} fill={pal.land} opacity={draw} />
      <g clipPath={`url(#${id}c)`} opacity={progress(local, 30, 24)}>
        <rect x={x0} y={y0} width={dw} height={dh * 0.27} fill={snow} opacity={0.85} />
        {[0.45, 0.65, 0.85].map((f, k) => <path key={k} d={line} transform={`translate(0, ${dh * f * 0.35})`} fill="none" stroke={alpha(pal.bg, 0.18)} strokeWidth={2 * u} />)}
      </g>
      <path d={line} fill="none" stroke={mix(pal.land, pal.text, 0.5)} strokeWidth={4 * u} pathLength={1} strokeDasharray={1} strokeDashoffset={1 - draw} />
      <line x1={x0} x2={x0 + dw} y1={y0 + dh * 0.5} y2={y0 + dh * 0.5} stroke={alpha(pal.text, 0.4)} strokeWidth={2 * u} strokeDasharray={`${10 * u} ${8 * u}`} opacity={progress(local, 40, 16)} />
    </svg>
  );
};

/** Medallion: rotating tick ring, pulse rings and a self-drawing line icon. */
const IconMedal: React.FC<VisualProps> = ({w, h, pal, local, era, color, u}) => {
  const r = Math.min(w, h) * 0.38;
  const cx = w / 2;
  const cy = h / 2;
  const enter = progress(local, 0, 26, ease.overshoot);
  return (
    <div style={{position: 'absolute', inset: 0, opacity: Math.min(1, enter * 1.5)}}>
      <svg width={w} height={h} style={{position: 'absolute', inset: 0, overflow: 'visible'}}>
        {[0, 1].map(k => {
          const q = ((local + k * 36) % 72) / 72;
          return <circle key={k} cx={cx} cy={cy} r={r * (0.86 + 0.45 * q)} fill="none" stroke={color} strokeWidth={3 * u} opacity={(1 - q) * 0.45} />;
        })}
        <g transform={`rotate(${local * 0.25} ${cx} ${cy})`}>
          {Array.from({length: 72}, (_, k) => {
            const a = (k / 72) * Math.PI * 2;
            const len = k % 6 ? 10 * u : 24 * u;
            return <line key={k} x1={cx + Math.cos(a) * r} y1={cy + Math.sin(a) * r} x2={cx + Math.cos(a) * (r + len)} y2={cy + Math.sin(a) * (r + len)} stroke={alpha(pal.text, k % 6 ? 0.3 : 0.7)} strokeWidth={2 * u} />;
          })}
        </g>
        <circle cx={cx} cy={cy} r={r * 0.86 * (0.7 + 0.3 * enter)} fill={pal.surface} stroke={alpha(color, 0.8)} strokeWidth={3 * u} />
      </svg>
      <div style={{position: 'absolute', left: cx - r * 0.55, top: cy - r * 0.55}}>
        <LineIcon name={era.icon} progress={progress(local, 8, 44, ease.cinematic)} size={r * 1.1} color={pal.accent} strokeWidth={3.6} />
      </div>
    </div>
  );
};

const VISUALS: Record<Era['visual'], React.FC<VisualProps>> = {globe: Globe, strata: Strata, terrain: Terrain, icon: IconMedal};

// ---------------------------------------------------------------------------------------------
// Era text panel
// ---------------------------------------------------------------------------------------------

const EraText: React.FC<{era: Era; pal: Pal; s: number; boxW: number; start: number; end: number; color: string}> = ({era, pal, s, boxW, start, end, color}) => {
  const frame = useCurrentFrame();
  const local = frame - start;
  const kick = progress(local, 0, 16);
  const spanIn = progress(local, 12, 20, ease.expo);
  const nameSize = Math.min(104 * s, (boxW * 1.75) / Math.max(6, era.name.length));
  const avail = Math.max(30, (end - start) * 0.55);
  return (
    <div style={{display: 'flex', flexDirection: 'column', color: pal.text}}>
      {era.kicker ? (
        <div style={{display: 'flex', alignItems: 'center', gap: 14 * s, fontFamily: fonts.mono, fontSize: 24 * s, letterSpacing: '0.22em', textTransform: 'uppercase', color: pal.muted, opacity: kick, transform: `translateX(${(1 - kick) * -24 * s}px)`}}>
          <div style={{width: 14 * s, height: 14 * s, borderRadius: 3 * s, background: color}} />
          {era.kicker}
        </div>
      ) : null}
      <KineticText text={era.name} start={start + 4} stagger={4} style="rise" textStyle={{fontFamily: fonts.serifDisplay, fontSize: nameSize, lineHeight: 1.05, letterSpacing: '-0.01em', marginTop: 10 * s}} />
      <div style={{fontFamily: fonts.sans, fontWeight: 700, fontSize: 32 * s, color: ink(pal), marginTop: 10 * s, opacity: spanIn, transform: `translateY(${(1 - spanIn) * 14 * s}px)`}}>{era.span}</div>
      <div style={{width: 120 * s * spanIn, height: 3 * s, background: pal.accent, marginTop: 18 * s}} />
      <div style={{marginTop: 30 * s, display: 'flex', flexDirection: 'column', gap: 22 * s}}>
        {era.points.map((pt, k) => {
          const p = progress(local, 22 + (k * avail) / era.points.length, 18, ease.expo);
          return (
            <div key={k} style={{display: 'flex', gap: 18 * s, alignItems: 'baseline', opacity: p, transform: `translateY(${(1 - p) * 22 * s}px)`}}>
              <div style={{flex: 'none', width: 26 * s * p, height: 3 * s, background: color, transform: `translateY(${-9 * s}px)`}} />
              <div style={{fontFamily: fonts.sans, fontSize: 34 * s, lineHeight: 1.32, fontWeight: 500, color: alpha(pal.text, 0.92)}}>{pt}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

// ---------------------------------------------------------------------------------------------
// The era ruler: full-range bar, zoom bracket, detail bar with a travelling date pin
// ---------------------------------------------------------------------------------------------

const Ruler: React.FC<{
  axis: Axis; eras: Era[]; pal: Pal; u: number; padX: number; W: number; y0: number; introY: number; detailY: number;
  introEnd: number; starts: number[]; ends: number[]; cur: number;
}> = ({axis, eras, pal, u, padX, W, y0, introY, detailY, introEnd, starts, ends, cur}) => {
  const frame = useCurrentFrame();
  const {width, height} = useVideoConfig();
  const move = progress(frame, introEnd - 14, 24, ease.cinematic);
  const y = introY + (y0 - introY) * move;
  const barH = 12 * u;
  const X = (p: number) => padX + p * W;
  const minW = 6 * u;
  const seg = (i: number): [number, number] => {
    const a = X(axis.pos(axis.older(eras[i])));
    const b = Math.max(a + minW, X(axis.pos(axis.newer(eras[i]))));
    return b > padX + W ? [padX + W - minW, padX + W] : [a, b];
  };
  const drawIn = (i: number) => progress(frame, 10 + i * 5, 18, ease.expo);
  const ticksIn = progress(frame, 16, 20);
  const live = cur >= 0;
  const zoom = live ? progress(frame, starts[cur], 26, ease.cinematic) : 0;
  const [a0, a1] = !live || cur === 0 ? [padX, padX + W] : seg(cur - 1);
  const [b0, b1] = live ? seg(cur) : [padX, padX + W];
  const s0 = a0 + (b0 - a0) * zoom;
  const s1 = a1 + (b1 - a1) * zoom;
  const detailIn = live ? progress(frame, introEnd, 18) : 0;
  const era = live ? eras[cur] : eras[0];
  const older = axis.older(era);
  const newer = axis.newer(era);
  const t = live ? tween(frame, [starts[cur] + 10, ends[cur] - 4], [0, 1], ease.cinematic) : 0;
  const value = older + (newer - older) * t;
  const mainX = live ? X(axis.pos(older) + (axis.pos(newer) - axis.pos(older)) * t) : padX;
  const detailX = padX + W * t;
  const lo = Math.min(older, newer);
  const hi = Math.max(older, newer);
  const dTicks = hi > lo ? linearTicks(lo, hi, 5, axis.short) : [];
  const dpos = (v: number) => (hi > lo ? (v - older) / (newer - older) : 0);
  const colors = pal.eras;
  const label = axis.long(value);
  const fs = 19 * u;
  const pillW = label.length * fs * 0.62 + 30 * u;
  const pillX = Math.min(padX + W - pillW / 2, Math.max(padX + pillW / 2, detailX));
  const anchor = (x: number) => (x < padX + 30 * u ? 'start' : x > padX + W - 30 * u ? 'end' : 'middle');
  return (
    <svg width={width} height={height} style={{position: 'absolute', inset: 0, overflow: 'visible', pointerEvents: 'none'}}>
      {/* zoom bracket from the era's slice of the full ruler up to the detail ruler */}
      <g opacity={detailIn}>
        <polygon points={`${s0},${y} ${s1},${y} ${padX + W},${detailY + 6 * u} ${padX},${detailY + 6 * u}`} fill={alpha(pal.accent, 0.07)} />
        <line x1={s0} y1={y} x2={padX} y2={detailY + 6 * u} stroke={alpha(pal.accent, 0.5)} strokeWidth={1.5 * u} />
        <line x1={s1} y1={y} x2={padX + W} y2={detailY + 6 * u} stroke={alpha(pal.accent, 0.5)} strokeWidth={1.5 * u} />
        <rect x={padX} y={detailY} width={W} height={6 * u} rx={3 * u} fill={alpha(colors[cur < 0 ? 0 : cur % colors.length], 0.35)} />
        <rect x={padX} y={detailY} width={Math.max(0, detailX - padX)} height={6 * u} rx={3 * u} fill={pal.accent} />
        {dTicks.map((tk, k) => {
          const x = padX + W * dpos(tk.v);
          return (
            <g key={`${cur}-${k}`} opacity={zoom}>
              <line x1={x} x2={x} y1={detailY - 8 * u} y2={detailY} stroke={alpha(pal.text, 0.5)} strokeWidth={1.5 * u} />
              <text x={x} y={detailY + 30 * u} textAnchor={anchor(x)} fill={pal.muted} style={{fontFamily: fonts.mono, fontSize: 16 * u}}>{tk.label}</text>
            </g>
          );
        })}
        <line x1={detailX} x2={detailX} y1={detailY - 18 * u} y2={detailY + 8 * u} stroke={pal.accent} strokeWidth={3 * u} />
        <circle cx={detailX} cy={detailY + 3 * u} r={7 * u} fill={pal.accent} stroke={pal.bg} strokeWidth={2.5 * u} />
        <rect x={pillX - pillW / 2} y={detailY - 58 * u} width={pillW} height={36 * u} rx={18 * u} fill={alpha(pal.surface, 0.94)} stroke={pal.accent} strokeWidth={1.5 * u} />
        <text x={pillX} y={detailY - 34 * u} textAnchor="middle" fill={pal.text} style={{fontFamily: fonts.mono, fontSize: fs}}>{label}</text>
      </g>
      {/* full ruler */}
      <rect x={padX} y={y} width={W} height={barH} rx={barH / 2} fill={alpha(pal.line, 0.13)} opacity={ticksIn} />
      {eras.map((_, i) => {
        const [x0, x1] = seg(i);
        const on = i === cur;
        return <rect key={i} x={x0} y={y + (on ? -3 * u : 0)} width={(x1 - x0) * drawIn(i)} height={barH + (on ? 6 * u : 0)} rx={2 * u} fill={colors[i % colors.length]} opacity={!live ? 1 : on ? 1 : 0.5} style={on ? {filter: `drop-shadow(0 0 ${8 * u}px ${alpha(colors[i % colors.length], 0.9)})`} : undefined} />;
      })}
      {axis.ticks.map((tk, k) => {
        const x = X(axis.pos(tk.v));
        return (
          <g key={k} opacity={ticksIn}>
            <line x1={x} x2={x} y1={y + barH + 4 * u} y2={y + barH + 11 * u} stroke={alpha(pal.text, 0.45)} strokeWidth={1.5 * u} />
            <text x={x} y={y + barH + 32 * u} textAnchor={anchor(x)} fill={pal.muted} style={{fontFamily: fonts.mono, fontSize: 17 * u}}>{tk.label}</text>
          </g>
        );
      })}
      {live ? (
        <g opacity={detailIn}>
          <line x1={mainX} x2={mainX} y1={y - 12 * u} y2={y + barH + 4 * u} stroke={pal.text} strokeWidth={2.5 * u} />
          <circle cx={mainX} cy={y - 14 * u} r={5 * u} fill={pal.text} />
        </g>
      ) : null}
    </svg>
  );
};

// ---------------------------------------------------------------------------------------------
// Entry
// ---------------------------------------------------------------------------------------------

const DeepTime: React.FC<EntryProps<Props>> = ({media, props}) => {
  const frame = useCurrentFrame();
  const {fps, width: w, height: h} = useVideoConfig();
  const look = useLook();
  const eras = props.eras;
  const n = eras.length;
  const own = PALETTES[props.palette];
  const pal: Pal = look ? fromLook(look, n) : {...own, accent: media.accent ?? own.accent};
  const u = Math.min(w, h) / 1080;
  const wide = w >= h;
  const timeline = useSceneTimeline(media);
  const contentEnd = useContentFrames(media);
  const axis = React.useMemo(() => makeAxis(eras, props.axis), [eras, props.axis]);
  const {introEnd, starts, ends} = schedule(timeline, n, fps, contentEnd);
  let cur = -1;
  starts.forEach((s, i) => {
    if (frame >= s) cur = i;
  });

  // Layout: header, content (text + illustration), then the ruler above the caption band.
  const padX = w * 0.07;
  const W = w - 2 * padX;
  const y0 = look ? h * (1 - captionSafeBottom(look)) - 68 * u : h * (1 - (wide ? 0.19 : 0.17));
  const detailY = y0 - 98 * u;
  const introY = Math.min(y0, h * (wide ? 0.66 : 0.6));
  const top = h * 0.05 + 64 * u;
  const bottom = detailY - 76 * u;
  const contentH = bottom - top;
  const textBox = wide ? {x: padX, y: top, w: W * 0.46, h: contentH} : {x: padX, y: top, w: W, h: contentH * 0.5};
  const visBox = wide ? {x: padX + W * 0.52, y: top, w: W * 0.48, h: contentH} : {x: padX, y: top + contentH * 0.53, w: W, h: contentH * 0.47};
  const s = Math.min(u, textBox.h / 560, textBox.w / 680);
  // Rank in the sequence (0 = oldest era): drives continent drift and strata depth.
  const eraPos = (i: number) => (n > 1 ? i / (n - 1) : 1);
  const colorOf = (i: number) => pal.eras[i % pal.eras.length];

  const titleOut = progress(frame, introEnd - 14, 14, ease.accelerate);
  const headerIn = progress(frame, introEnd, 18);
  const plainTitle = props.title.replace(/\*/g, '');
  const magOf = (i: number) => {
    const a = axis.pos(axis.older(eras[i]));
    const b = axis.pos(axis.newer(eras[i]));
    return 1 / Math.max(Math.abs(b - a), (6 * u) / W);
  };
  const mag = cur >= 0 ? magOf(cur) : 1;
  const prevMag = cur > 0 ? magOf(cur - 1) : 1;
  const tint = cur >= 0 ? colorOf(cur) : pal.accent;

  return (
    <AbsoluteFill style={{background: pal.bg, overflow: 'hidden'}}>
      <AbsoluteFill style={{background: `radial-gradient(ellipse 80% 70% at 78% 30%, ${alpha(pal.bg2, 0.95)} 0%, transparent 70%)`}} />
      <AbsoluteFill style={{background: `radial-gradient(circle at ${((visBox.x + visBox.w / 2) / w) * 100}% ${((visBox.y + visBox.h / 2) / h) * 100}%, ${alpha(tint, pal.tone === 'light' ? 0.12 : 0.16)} 0%, transparent 45%)`}} />
      <Particles count={40} color={pal.text} opacity={pal.tone === 'light' ? 0.12 : 0.2} seed="deeptime" speed={0.3} size={[1.5, 4]} />

      {/* Opening title over the full ruler */}
      {frame < introEnd + 2 ? (
        <AbsoluteFill style={{alignItems: 'center', paddingTop: h * (wide ? 0.2 : 0.28), opacity: 1 - titleOut, transform: `translateY(${-titleOut * 40 * u}px)`}}>
          <div style={{fontFamily: fonts.mono, fontSize: 24 * u, letterSpacing: '0.32em', textTransform: 'uppercase', color: ink(pal), opacity: progress(frame, 0, 14), marginBottom: 28 * u}}>
            {n} eras · {axis.total}
          </div>
          <KineticText text={props.title} start={4} stagger={4} style="rise" align="center" accent={pal.accent} textStyle={{fontFamily: fonts.serifDisplay, color: pal.text, fontSize: (wide ? 96 : 104) * u, lineHeight: 1.08, maxWidth: w * 0.84}} />
        </AbsoluteFill>
      ) : null}

      {/* Header chrome */}
      <div style={{position: 'absolute', left: padX, right: padX, top: h * 0.05, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', opacity: headerIn, fontFamily: fonts.mono, color: pal.muted, fontSize: 19 * u, letterSpacing: '0.2em', textTransform: 'uppercase'}}>
        <div style={{maxWidth: W * 0.6, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis'}}>{plainTitle}</div>
        <div style={{textAlign: 'right'}}>
          <div style={{color: pal.text}}>era {String(Math.max(1, cur + 1)).padStart(2, '0')} / {String(n).padStart(2, '0')}</div>
          <div style={{marginTop: 8 * u, color: ink(pal)}}>zoom ×{countUp(frame, mag, cur >= 0 ? starts[cur] : 0, 26, mag < 10 ? 1 : 0, prevMag)}</div>
        </div>
      </div>

      {/* Eras */}
      {eras.map((era, i) => {
        const start = starts[i];
        const end = ends[i];
        if (frame < start - 10 || frame > end + 18) return null;
        // Enter while the previous era exits, so the hand-off is a cross-fade with no empty beat.
        const enter = progress(frame, start - 10, 16, ease.cinematic);
        const exit = i < n - 1 ? progress(frame, end - 10, 12, ease.accelerate) : 0;
        const Visual = VISUALS[era.visual];
        const local = frame - start;
        return (
          <React.Fragment key={i}>
            <div style={{position: 'absolute', left: textBox.x, top: textBox.y, width: textBox.w, height: textBox.h, display: 'flex', flexDirection: 'column', justifyContent: wide ? 'center' : 'flex-start', opacity: enter * (1 - exit), transform: `translateY(${exit * -30 * u}px)`}}>
              <EraText era={era} pal={pal} s={s} boxW={textBox.w} start={start} end={end} color={colorOf(i)} />
            </div>
            <div style={{position: 'absolute', left: visBox.x, top: visBox.y, width: visBox.w, height: visBox.h, opacity: Math.min(enter, 1 - exit), transform: `scale(${0.92 + 0.08 * enter + exit * 0.08})`, filter: `blur(${(1 - enter) * 10 + exit * 12}px)`}}>
              <Visual w={visBox.w} h={visBox.h} pal={pal} index={i} local={local} eraPos={eraPos(i)} color={colorOf(i)} era={era} u={u} />
            </div>
          </React.Fragment>
        );
      })}

      <Ruler axis={axis} eras={eras} pal={pal} u={u} padX={padX} W={W} y0={y0} introY={introY} detailY={detailY} introEnd={introEnd} starts={starts} ends={ends} cur={cur} />

      {pal.tone === 'dark' ? starts.map((st, i) => <LightLeak key={i} from={Math.max(0, st - 10)} durationInFrames={Math.round(1.1 * fps)} seed={i * 7 + 2} opacity={0.28} />) : null}

      {props.showCaptions
        ? timeline.map(t => (
            <Sequence key={t.index} from={t.from} durationInFrames={t.durationInFrames}>
              <AbsoluteFill style={{justifyContent: 'flex-end', padding: wide ? '0 12% 3.6%' : '0 7% 5%'}}>
                <StyledCaptions scene={t.scene} variant="karaoke" accent={pal.accent} color={alpha(pal.text, 0.6)} font={fonts.sans} size={(wide ? 40 : 48) * u} words={wide ? 8 : 5} weight={700} shadow={pal.tone === 'dark'} />
              </AbsoluteFill>
            </Sequence>
          ))
        : null}
      <Vignette strength={pal.tone === 'light' ? 0.2 : 0.55} />
      <Grain opacity={0.06} />
      <NarrationTrack media={media} />
      <AdWeave media={media} theme={{background: pal.bg, text: pal.text, font: fonts.serifDisplay}} />
    </AbsoluteFill>
  );
};

export default defineEntry({id: 'timeline-deep-time', schema: Props, component: DeepTime});
