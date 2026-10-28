import React from 'react';
import {AbsoluteFill, Sequence, useCurrentFrame, useVideoConfig} from 'remotion';
import {AdWeave, NarrationTrack, captionSafeBottom, defineEntry, mix, sceneTimeline, useContentFrames, useLook, useSceneTimeline, type ActiveLook, type EntryProps, type TimedScene} from '@viralaunch/kit';
import {Grain, KineticText, LightLeak, Particles, StyledCaptions, Vignette, alpha, ease, fonts, progress, rand, tween} from '@viralaunch/kit/fx';
import {Props, type Level} from './schema';

type Pal = {tone: 'dark' | 'light'; bg: string; bg2: string; text: string; muted: string; accent: string; line: string; sea: string; land: string; star: string; leakHue: number; leak: number};

const PALETTES: Record<Props['palette'], Pal> = {
  deep: {tone: 'dark', bg: '#02040b', bg2: '#0c1733', text: '#eef2ff', muted: '#8d97b8', accent: '#7cc7ff', line: '#c9d6ff', sea: '#123d70', land: '#3c6448', star: '#fff3dd', leakHue: 190, leak: 0.35},
  aurora: {tone: 'dark', bg: '#010908', bg2: '#0a2a29', text: '#eafff8', muted: '#86b3a8', accent: '#5dffc0', line: '#c3f5e6', sea: '#0e4552', land: '#4a6a38', star: '#f1fff6', leakHue: 120, leak: 0.3},
  ember: {tone: 'dark', bg: '#0a0605', bg2: '#2a150c', text: '#fff1e4', muted: '#c19e86', accent: '#ffb35c', line: '#f6dcc2', sea: '#1c3650', land: '#7a5a34', star: '#ffe9c9', leakHue: 0, leak: 0.4},
  mono: {tone: 'dark', bg: '#050505', bg2: '#1b1b1b', text: '#f5f5f5', muted: '#9a9a9a', accent: '#ffffff', line: '#dddddd', sea: '#2b2f33', land: '#55524c', star: '#ffffff', leakHue: 20, leak: 0.18},
};

/** The film in a sequence's shared look: space, ink and accent come from the look. */
const fromLook = (l: ActiveLook): Pal => {
  const p = l.palette;
  const light = l.tone === 'light';
  return {
    tone: l.tone, bg: p.bg, bg2: p.bg2, text: p.text, muted: p.muted, accent: p.accent, line: p.line,
    sea: light ? mix(p.bg2, p.accent, 0.35) : mix(p.bg2, p.accent, 0.3),
    land: light ? mix(p.bg2, p.muted, 0.55) : mix(p.surface, p.muted, 0.45),
    star: light ? p.line : mix(p.text, p.accent, 0.15),
    leakHue: 0,
    leak: light ? 0.12 : 0.3,
  };
};

/** Accent for small text: darkened on light backgrounds so it stays readable. */
const ink = (pal: Pal) => (pal.tone === 'light' ? mix(pal.accent, pal.text, 0.5) : pal.accent);

// ---------------------------------------------------------------------------------------------
// Zoom geometry. Each level is drawn in its own unit frame (1 unit = R px at rest). Level j sits
// F times larger than level j-1, and HOME[view] is where the previous level lies inside it, so
// the whole film is one continuous pull-back that always keeps the starting place in view.
// ---------------------------------------------------------------------------------------------

const F = 9;
type V2 = [number, number];
type View = Level['view'];
const GAL_TILT = 0.55;
const armXY = (arm: number, r: number, jitter = 0): V2 => {
  const th = arm * (Math.PI / 2) + Math.log(r / 0.06) / 0.3 + jitter;
  return [r * Math.cos(th), r * Math.sin(th) * GAL_TILT];
};
const SYS_ORBITS = [0.2, 0.33, 0.5, 0.75, 1.2, 1.75, 2.4];
const SYS_TILT = 0.42;
const SYS_HOME: V2 = [0.5 * Math.cos(0.6), 0.5 * SYS_TILT * Math.sin(0.6)];

const HOME: Record<View, V2> = {
  surface: [0, 0],
  planet: [0.14, -0.17],
  orbit: [0, 0],
  system: SYS_HOME,
  stars: [0, 0],
  galaxy: armXY(0, 0.6),
  group: [-0.28, 0.12],
  web: [0, 0],
};
/** Views that are solid fills: they hand over to the next level sooner. */
const SOLID: Partial<Record<View, boolean>> = {surface: true, planet: true};

const smooth = (t: number) => t * t * (3 - 2 * t);

// Deterministic star data, built once.
const BG_STARS = Array.from({length: 170}, (_, i) => ({x: rand(`bgx${i}`), y: rand(`bgy${i}`), r: 0.6 + 2.2 * rand(`bgr${i}`) ** 4, tw: rand(`bgt${i}`, 0, 6.28)}));
const GALAXY = Array.from({length: 820}, (_, i) => {
  const arm = i % 4;
  const t = rand(`ga${i}`);
  const r = (0.06 + 1.0 * t ** 0.85) * (1 + (rand(`gj${i}`) - 0.5) * 0.14);
  const spread = arm % 2 ? 0.75 : 0.42;
  const [x, y] = armXY(arm, r, (rand(`gs${i}`) - 0.5) * spread);
  return {x, y, r, size: 0.7 + 2.4 * rand(`gz${i}`) ** 3, o: 0.3 + 0.6 * rand(`go${i}`), tw: rand(`gt${i}`, 0, 6.28)};
});
const FIELD = Array.from({length: 190}, (_, i) => ({x: rand(`fx${i}`, -2.7, 2.7), y: rand(`fy${i}`, -2.7, 2.7), b: rand(`fb${i}`) ** 4, hue: rand(`fh${i}`), tw: rand(`ft${i}`, 0, 6.28)}));
const WEB_NODES: V2[] = [[0, 0], ...Array.from({length: 64}, (_, i): V2 => {
  const r = 1.12 * Math.sqrt(rand(`wr${i}`, 0.02, 1));
  const a = rand(`wa${i}`, 0, Math.PI * 2);
  return [r * Math.cos(a), r * Math.sin(a)];
})];
const WEB_EDGES: Array<[number, number]> = (() => {
  const seen = new Set<string>();
  const out: Array<[number, number]> = [];
  WEB_NODES.forEach((a, i) => {
    const near = WEB_NODES.map((b, k) => ({k, d: Math.hypot(a[0] - b[0], a[1] - b[1])})).filter(n => n.k !== i).sort((p, q) => p.d - q.d).slice(0, 3);
    near.forEach(({k}) => {
      const key = i < k ? `${i}-${k}` : `${k}-${i}`;
      if (!seen.has(key)) {
        seen.add(key);
        out.push([i, k]);
      }
    });
  });
  return out;
})();
const nearestNode = (p: V2) => WEB_NODES.slice(1).reduce((best, n) => (Math.hypot(n[0] - p[0], n[1] - p[1]) < Math.hypot(best[0] - p[0], best[1] - p[1]) ? n : best));
const WEB_ANCHORS: V2[] = [[0.62, -0.5], [-0.72, 0.3], [0.3, 0.82], [-0.42, -0.8]].map(p => nearestNode(p as V2));

type Ctx = {P: (x: number, y: number) => V2; s: number; frame: number; pal: Pal; j: number; u: number; R: number; w: number; h: number; z: number; labels: string[]};
type Drawn = {el: React.ReactNode; anchors: V2[]};

const path = (pts: V2[], close = false) => 'M' + pts.map(p => `${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(' L') + (close ? ' Z' : '');
/** Point size that grows gently (not linearly) with zoom, so dots never become discs. */
const dot = (c: Ctx, base: number) => c.u * base * Math.min(2.2, Math.max(0.35, (c.s / c.R) ** 0.3));
const onScreen = (c: Ctx, p: V2, pad = 60) => p[0] > -pad && p[0] < c.w + pad && p[1] > -pad && p[1] < c.h + pad;

/** Smooth closed blob around a centre (continents, clouds of stars). */
function blob(c: Ctx, seed: string, cx: number, cy: number, r: number, n = 11) {
  const pts: V2[] = Array.from({length: n}, (_, i) => {
    const a = (i / n) * Math.PI * 2;
    const rr = r * rand(`${seed}${i}`, 0.65, 1.2);
    return c.P(cx + rr * Math.cos(a), cy + rr * Math.sin(a) * 0.85);
  });
  const mid = (i: number): V2 => {
    const p = pts[i % n];
    const q = pts[(i + 1) % n];
    return [(p[0] + q[0]) / 2, (p[1] + q[1]) / 2];
  };
  const f = (v: number) => v.toFixed(1);
  const m0 = mid(n - 1);
  return `M${f(m0[0])},${f(m0[1])} ` + pts.map((p, i) => `Q${f(p[0])},${f(p[1])} ${f(mid(i)[0])},${f(mid(i)[1])}`).join(' ') + ' Z';
}

/** Land and sea from above: coastline, contour lines, surf, sun glitter and a little town. */
function surface(c: Ctx): Drawn {
  const {P, s, frame, pal, j, u} = c;
  const id = `cz${j}`;
  const ph = rand(`sf${j}`, 0, 6);
  const off = 0.16 * Math.sin(ph) + 0.06 * Math.sin(ph * 2);
  const coastX = (y: number) => 0.16 * Math.sin(y * 2.2 + ph) + 0.06 * Math.sin(y * 5.1 + ph * 2) - off;
  const ys = Array.from({length: 71}, (_, i) => -2.8 + i * 0.08);
  const coast = ys.map(y => P(coastX(y), y));
  const [cx, cy] = P(0, 0);
  // The feathered edge tightens as the camera pulls back, so the land shrinks into a patch.
  const edge = tween(c.z, [j - 0.2, j + 0.9], [2.6, 1.0], ease.cinematic) * s;
  const sand = mix(pal.land, pal.text, 0.35);
  return {
    anchors: [[-0.9, -0.6], [0.7, 0.5], [0.45, -0.9], [-0.6, 1.0]],
    el: (
      <g mask={`url(#${id}m)`}>
        <defs>
          <radialGradient id={`${id}mg`} gradientUnits="userSpaceOnUse" cx={cx} cy={cy} r={Math.max(1, edge)}>
            <stop offset="0.55" stopColor="#fff" />
            <stop offset="1" stopColor="#000" />
          </radialGradient>
          <mask id={`${id}m`} maskUnits="userSpaceOnUse" x={0} y={0} width={c.w} height={c.h}>
            <rect width={c.w} height={c.h} fill={`url(#${id}mg)`} />
          </mask>
          <linearGradient id={`${id}sea`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor={mix(pal.sea, pal.star, 0.18)} />
            <stop offset="1" stopColor={mix(pal.sea, pal.bg, 0.45)} />
          </linearGradient>
          <linearGradient id={`${id}land`} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor={mix(pal.land, pal.text, 0.12)} />
            <stop offset="1" stopColor={mix(pal.land, pal.bg, 0.4)} />
          </linearGradient>
          <radialGradient id={`${id}sun`}>
            <stop offset="0" stopColor={alpha(pal.star, 0.28)} />
            <stop offset="1" stopColor={alpha(pal.star, 0)} />
          </radialGradient>
        </defs>
        <path d={path([P(-3, -2.8), ...coast, P(-3, 2.8)], true)} fill={`url(#${id}sea)`} />
        <ellipse cx={P(-0.9, -0.7)[0]} cy={P(-0.9, -0.7)[1]} rx={s * 0.35} ry={s * 0.9} fill={`url(#${id}sun)`} />
        <path d={path([P(3, -2.8), ...coast, P(3, 2.8)], true)} fill={`url(#${id}land)`} />
        {/* contour lines inland */}
        {[0.22, 0.46, 0.76, 1.1, 1.5, 1.95].map((d, k) => (
          <path key={k} d={path(ys.map(y => P(coastX(y) * (1 + d * 0.3) + d + 0.05 * Math.sin(y * 3 + d * 7), y)))} fill="none" stroke={alpha(pal.text, 0.13)} strokeWidth={1.4 * u} />
        ))}
        {/* fields */}
        {Array.from({length: 16}, (_, k) => {
          const y = rand(`fdy${j}${k}`, -2.2, 2.2);
          const x = coastX(y) + rand(`fdx${j}${k}`, 0.35, 2.2);
          const [px, py] = P(x, y);
          const fw = s * rand(`fdw${j}${k}`, 0.08, 0.2);
          return <rect key={k} x={px - fw / 2} y={py - fw / 3} width={fw} height={fw * 0.66} rx={fw * 0.08} fill={alpha(k % 3 ? pal.text : pal.accent, 0.07)} transform={`rotate(${rand(`fdr${j}${k}`, -25, 25)} ${px} ${py})`} />;
        })}
        {/* road */}
        <path d={path(ys.map(y => P(0.55 + 0.25 * Math.sin(y * 1.3 + ph), y)))} fill="none" stroke={alpha(sand, 0.45)} strokeWidth={2.4 * u} />
        {/* beach + surf */}
        <path d={path(coast)} fill="none" stroke={alpha(sand, 0.85)} strokeWidth={Math.max(3, 0.03 * s)} />
        {[-0.05, -0.12, -0.21].map((d, k) => (
          <path key={k} d={path(ys.map(y => P(coastX(y) + d, y)))} fill="none" stroke={alpha(pal.star, 0.45 - k * 0.12)} strokeWidth={1.6 * u} strokeDasharray={`${26 * u} ${18 * u}`} strokeDashoffset={-frame * (1.2 + k * 0.5) * u} />
        ))}
        {/* sun glitter on the water */}
        {Array.from({length: 70}, (_, k) => {
          const y = rand(`gly${j}${k}`, -2.4, 2.4);
          const x = coastX(y) - rand(`glx${j}${k}`, 0.12, 2.4);
          const [px, py] = P(x, y);
          const len = Math.min(40 * u, Math.max(6 * u, s * 0.05));
          const tw = 0.5 + 0.5 * Math.sin(frame / 6 + k * 1.7);
          const near = Math.max(0, 1 - Math.hypot(x + 0.9, (y + 0.7) * 0.5) / 1.4);
          return <line key={k} x1={px - len / 2} x2={px + len / 2} y1={py} y2={py} stroke={pal.star} strokeWidth={1.6 * u} strokeLinecap="round" opacity={(0.12 + 0.75 * near) * tw} />;
        })}
        {/* the town at home */}
        {Array.from({length: 14}, (_, k) => {
          const [px, py] = P(rand(`tx${j}${k}`, 0.04, 0.32), rand(`ty${j}${k}`, -0.22, 0.22));
          return <circle key={k} cx={px} cy={py} r={dot(c, 2.4)} fill={pal.star} opacity={0.5 + 0.4 * Math.sin(frame / 9 + k)} />;
        })}
      </g>
    ),
  };
}

/** A globe: ocean, continents, graticule, clouds, night side and atmosphere. */
function planet(c: Ctx): Drawn {
  const {P, s, frame, pal, j, u} = c;
  const id = `cz${j}`;
  const [cx, cy] = P(0, 0);
  const r = 0.5 * s;
  const [hx, hy] = HOME.planet;
  const continents: Array<[number, number, number]> = [[hx + 0.1, hy + 0.01, 0.13], [-0.24, 0.12, 0.15], [0.06, 0.3, 0.1], [-0.12, -0.33, 0.09], [0.36, 0.17, 0.08], [-0.4, -0.12, 0.06]];
  const night = pal.tone === 'light' ? pal.text : '#000000';
  return {
    anchors: [[0.62, -0.42], [-0.66, 0.4], [0.5, 0.56], [-0.55, -0.5]],
    el: (
      <g>
        <defs>
          <radialGradient id={`${id}atm`} gradientUnits="userSpaceOnUse" cx={cx} cy={cy} r={r * 1.25}>
            <stop offset="0.72" stopColor={alpha(pal.accent, 0)} />
            <stop offset="0.8" stopColor={alpha(pal.accent, 0.42)} />
            <stop offset="1" stopColor={alpha(pal.accent, 0)} />
          </radialGradient>
          <radialGradient id={`${id}oc`} gradientUnits="userSpaceOnUse" cx={cx - r * 0.35} cy={cy - r * 0.35} r={r * 1.5}>
            <stop offset="0" stopColor={mix(pal.sea, pal.star, 0.3)} />
            <stop offset="0.6" stopColor={pal.sea} />
            <stop offset="1" stopColor={mix(pal.sea, pal.bg, 0.6)} />
          </radialGradient>
          <linearGradient id={`${id}nt`} gradientUnits="userSpaceOnUse" x1={cx - r * 0.2} y1={cy - r * 0.5} x2={cx + r} y2={cy + r * 0.3}>
            <stop offset="0" stopColor={alpha(night, 0)} />
            <stop offset="0.55" stopColor={alpha(night, 0.15)} />
            <stop offset="1" stopColor={alpha(night, 0.7)} />
          </linearGradient>
          <clipPath id={`${id}clip`}>
            <circle cx={cx} cy={cy} r={r} />
          </clipPath>
        </defs>
        <circle cx={cx} cy={cy} r={r * 1.25} fill={`url(#${id}atm)`} />
        <circle cx={cx} cy={cy} r={r} fill={`url(#${id}oc)`} />
        <g clipPath={`url(#${id}clip)`}>
          {continents.map(([x, y, cr], k) => <path key={k} d={blob(c, `ct${j}${k}`, x, y, cr)} fill={mix(pal.land, pal.text, 0.08)} opacity={0.92} />)}
          {[-60, -30, 0, 30, 60].map(lat => {
            const a = (lat * Math.PI) / 180;
            return <ellipse key={lat} cx={cx} cy={cy + r * Math.sin(a)} rx={r * Math.cos(a)} ry={r * Math.cos(a) * 0.1} fill="none" stroke={alpha(pal.line, 0.14)} strokeWidth={1.2 * u} />;
          })}
          {Array.from({length: 6}, (_, k) => {
            const a = ((k * 30 + frame * 0.35) % 180) * (Math.PI / 180);
            return <ellipse key={k} cx={cx} cy={cy} rx={Math.abs(r * Math.cos(a))} ry={r} fill="none" stroke={alpha(pal.line, 0.12)} strokeWidth={1.2 * u} />;
          })}
          {Array.from({length: 7}, (_, k) => {
            const [px, py] = P(((rand(`cl${j}${k}`, -0.6, 0.6) + frame * 0.0009 + 0.6) % 1.2) - 0.6, rand(`cy${j}${k}`, -0.4, 0.4));
            return <ellipse key={k} cx={px} cy={py} rx={r * rand(`cw${j}${k}`, 0.18, 0.34)} ry={r * 0.035} fill={alpha(pal.tone === 'light' ? pal.bg : '#ffffff', 0.32)} transform={`rotate(${rand(`cr${j}${k}`, -14, 8)} ${px} ${py})`} />;
          })}
          <circle cx={cx} cy={cy} r={r} fill={`url(#${id}nt)`} />
        </g>
        <circle cx={cx} cy={cy} r={r} fill="none" stroke={alpha(pal.accent, 0.55)} strokeWidth={2 * u} />
      </g>
    ),
  };
}

/** A small globe glyph, the size the previous level shrinks to (radius 0.5 / F). */
function homeGlobe(c: Ctx, x: number, y: number) {
  const [px, py] = c.P(x, y);
  const r = Math.max(2.5 * c.u, (0.5 / F) * c.s);
  return (
    <g>
      <circle cx={px} cy={py} r={r * 1.5} fill={alpha(c.pal.accent, 0.18)} />
      <circle cx={px} cy={py} r={r} fill={c.pal.sea} stroke={alpha(c.pal.accent, 0.7)} strokeWidth={1.4 * c.u} />
      <circle cx={px + r * 0.15} cy={py - r * 0.2} r={r * 0.35} fill={c.pal.land} />
    </g>
  );
}

/** A body at the centre with a companion on a tilted orbit and the distance between them. */
function orbit(c: Ctx): Drawn {
  const {P, s, frame, pal, u} = c;
  const a = 0.5 + frame * 0.006;
  const moon: V2 = [0.78 * Math.cos(a), 0.78 * 0.5 * Math.sin(a)];
  const [cx, cy] = P(0, 0);
  const [mx, my] = P(...moon);
  const mr = Math.max(3 * u, 0.028 * s);
  const far: V2[] = [[-1.2, -0.95], [1.3, 0.8], [-0.9, 1.3]];
  return {
    anchors: [moon, ...far],
    el: (
      <g>
        <ellipse cx={cx} cy={cy} rx={1.65 * s} ry={1.65 * 0.5 * s} fill="none" stroke={alpha(pal.line, 0.1)} strokeWidth={1.2 * u} />
        <ellipse cx={cx} cy={cy} rx={0.78 * s} ry={0.39 * s} fill="none" stroke={alpha(pal.line, 0.38)} strokeWidth={1.5 * u} strokeDasharray={`${3 * u} ${8 * u}`} />
        <line x1={cx} y1={cy} x2={mx} y2={my} stroke={alpha(pal.accent, 0.6)} strokeWidth={1.4 * u} strokeDasharray={`${10 * u} ${7 * u}`} strokeDashoffset={-frame * 0.8 * u} />
        {homeGlobe(c, 0, 0)}
        <circle cx={mx} cy={my} r={mr * 2.2} fill={alpha(pal.star, 0.08)} />
        <circle cx={mx} cy={my} r={mr} fill={mix(pal.text, pal.bg, 0.3)} />
        <circle cx={mx + mr * 0.35} cy={my} r={mr * 0.92} fill={alpha(pal.bg, 0.55)} />
        {c.labels.slice(1).map((_, k) => {
          const [px, py] = P(...far[k]);
          return <circle key={k} cx={px} cy={py} r={dot(c, 4)} fill={pal.star} />;
        })}
      </g>
    ),
  };
}

/** A star with tilted planet orbits; home sits on the third orbit. */
function system(c: Ctx): Drawn {
  const {P, s, frame, pal, j, u} = c;
  const id = `cz${j}`;
  const [cx, cy] = P(0, 0);
  const planets: V2[] = SYS_ORBITS.map((r, k) => {
    if (k === 2) return SYS_HOME;
    const a = rand(`pa${j}${k}`, 0, 6.28) + (frame * 0.012) / r ** 1.5;
    return [r * Math.cos(a), r * SYS_TILT * Math.sin(a)];
  });
  const sizes = [2.4, 3.2, 3.4, 2.8, 6.5, 5.6, 4.6];
  return {
    anchors: [[0, 0], planets[0], planets[1], planets[3]],
    el: (
      <g>
        <defs>
          <radialGradient id={`${id}sun`}>
            <stop offset="0" stopColor={alpha(pal.star, 0.95)} />
            <stop offset="0.25" stopColor={alpha(mix(pal.star, pal.accent, 0.4), 0.45)} />
            <stop offset="1" stopColor={alpha(pal.accent, 0)} />
          </radialGradient>
        </defs>
        {SYS_ORBITS.map((r, k) => (
          <ellipse key={k} cx={cx} cy={cy} rx={r * s} ry={r * SYS_TILT * s} fill="none" stroke={k === 2 ? alpha(pal.accent, 0.6) : alpha(pal.line, 0.24)} strokeWidth={(k === 2 ? 1.8 : 1.2) * u} />
        ))}
        <circle cx={cx} cy={cy} r={Math.max(30 * u, 0.2 * s)} fill={`url(#${id}sun)`} />
        <circle cx={cx} cy={cy} r={Math.max(5 * u, 0.025 * s)} fill={pal.star} />
        {planets.map((p, k) => {
          const [px, py] = P(...p);
          if (k === 2) return <g key={k}>{homeGlobe(c, p[0], p[1])}</g>;
          return <circle key={k} cx={px} cy={py} r={dot(c, sizes[k])} fill={k > 3 ? mix(pal.star, pal.accent, 0.35) : mix(pal.text, pal.bg, 0.15)} />;
        })}
      </g>
    ),
  };
}

/** A star chart of the neighbourhood: range rings, a scatter of stars and named neighbours. */
function stars(c: Ctx): Drawn {
  const {P, s, frame, pal, u} = c;
  const [cx, cy] = P(0, 0);
  const named: V2[] = [[0.62, -0.42], [-0.6, 0.52], [0.36, 0.9], [-0.86, -0.66]];
  return {
    anchors: named,
    el: (
      <g>
        {[0.6, 1.2, 1.8].map(r => <circle key={r} cx={cx} cy={cy} r={r * s} fill="none" stroke={alpha(pal.line, 0.16)} strokeWidth={1.2 * u} strokeDasharray={`${2 * u} ${9 * u}`} />)}
        {FIELD.map((st, k) => {
          const p = P(st.x, st.y);
          if (!onScreen(c, p) || Math.hypot(st.x, st.y) < 0.08) return null;
          const col = st.hue < 0.6 ? pal.star : st.hue < 0.85 ? mix(pal.star, pal.accent, 0.6) : mix(pal.star, '#ff9a5c', pal.tone === 'light' ? 0 : 0.45);
          return <circle key={k} cx={p[0]} cy={p[1]} r={dot(c, 1 + 3.2 * st.b)} fill={col} opacity={(0.35 + 0.6 * st.b) * (0.75 + 0.25 * Math.sin(frame / 8 + st.tw))} />;
        })}
        {c.labels.map((_, k) => {
          const [px, py] = P(...named[k]);
          return (
            <g key={k}>
              <line x1={cx} y1={cy} x2={px} y2={py} stroke={alpha(pal.accent, 0.35)} strokeWidth={1.2 * u} strokeDasharray={`${2 * u} ${7 * u}`} />
              <circle cx={px} cy={py} r={dot(c, 14)} fill={alpha(pal.star, 0.12)} />
              <circle cx={px} cy={py} r={dot(c, 4.5)} fill={pal.star} />
            </g>
          );
        })}
        <circle cx={cx} cy={cy} r={dot(c, 16)} fill={alpha(pal.star, 0.18)} />
        <circle cx={cx} cy={cy} r={dot(c, 4)} fill={pal.star} />
      </g>
    ),
  };
}

/** A small galaxy glyph (fuzzy tilted ellipse with a bright core). */
function galaxyGlyph(c: Ctx, key: string, x: number, y: number, r: number, angle: number, arms = false) {
  const [px, py] = c.P(x, y);
  const rr = Math.max(4 * c.u, r * c.s);
  return (
    <g key={key} transform={`rotate(${angle} ${px} ${py})`}>
      <ellipse cx={px} cy={py} rx={rr} ry={rr * GAL_TILT} fill={`url(#cz${c.j}gal)`} />
      {arms ? [0, 1].map(k => <path key={k} d={`M${px},${py} Q${px + (k ? -1 : 1) * rr * 0.7},${py - (k ? -1 : 1) * rr * 0.45} ${px + (k ? 1 : -1) * rr * 0.55},${py - (k ? -1 : 1) * rr * GAL_TILT * 0.8}`} fill="none" stroke={alpha(c.pal.star, 0.5)} strokeWidth={1.2 * c.u} />) : null}
      <circle cx={px} cy={py} r={Math.max(1.5 * c.u, rr * 0.12)} fill={c.pal.star} />
    </g>
  );
}

const galDefs = (c: Ctx) => (
  <radialGradient id={`cz${c.j}gal`}>
    <stop offset="0" stopColor={alpha(c.pal.star, 0.9)} />
    <stop offset="0.3" stopColor={alpha(mix(c.pal.star, c.pal.accent, 0.5), 0.45)} />
    <stop offset="1" stopColor={alpha(c.pal.accent, 0)} />
  </radialGradient>
);

/** A spiral galaxy of ~800 stars in four arms, with a glowing bulge. */
function galaxy(c: Ctx): Drawn {
  const {P, s, frame, pal, j} = c;
  const id = `cz${j}`;
  const [cx, cy] = P(0, 0);
  const sats: Array<[number, number, number]> = [[1.05, -0.4, 0.07], [0.92, 0.66, 0.05], [-1.1, -0.55, 0.05], [-0.72, 0.85, 0.04]];
  const warm = mix(pal.star, '#ffc98a', pal.tone === 'light' ? 0 : 0.35);
  const cool = mix(pal.star, pal.accent, 0.55);
  return {
    anchors: sats.map(([x, y]) => [x, y] as V2),
    el: (
      <g>
        <defs>
          {galDefs(c)}
          <radialGradient id={`${id}disc`}>
            <stop offset="0" stopColor={alpha(mix(pal.bg2, pal.accent, 0.35), 0.5)} />
            <stop offset="1" stopColor={alpha(pal.bg2, 0)} />
          </radialGradient>
          <radialGradient id={`${id}bulge`}>
            <stop offset="0" stopColor={alpha(warm, 0.95)} />
            <stop offset="0.4" stopColor={alpha(warm, 0.35)} />
            <stop offset="1" stopColor={alpha(warm, 0)} />
          </radialGradient>
        </defs>
        <ellipse cx={cx} cy={cy} rx={1.15 * s} ry={1.15 * GAL_TILT * s} fill={`url(#${id}disc)`} />
        {GALAXY.map((g, k) => {
          const p = P(g.x, g.y);
          if (!onScreen(c, p, 10)) return null;
          return <circle key={k} cx={p[0]} cy={p[1]} r={dot(c, g.size)} fill={g.r < 0.3 ? warm : cool} opacity={g.o * (0.8 + 0.2 * Math.sin(frame / 7 + g.tw))} />;
        })}
        <ellipse cx={cx} cy={cy} rx={0.26 * s} ry={0.26 * GAL_TILT * 1.2 * s} fill={`url(#${id}bulge)`} />
        {c.labels.map((_, k) => galaxyGlyph(c, `s${k}`, sats[k][0], sats[k][1], sats[k][2], rand(`sa${j}${k}`, -30, 30)))}
      </g>
    ),
  };
}

/** A group of galaxies inside a dashed boundary; home is one of its members. */
function group(c: Ctx): Drawn {
  const {P, s, frame, pal, j, u} = c;
  const [cx, cy] = P(0, 0);
  const members: Array<[number, number, number, number]> = [[0.46, -0.3, 0.16, 32], [0.14, -0.68, 0.06, -20], [-0.8, -0.46, 0.05, 60], [0.72, 0.58, 0.055, 10]];
  return {
    anchors: members.map(([x, y]) => [x, y] as V2),
    el: (
      <g>
        <defs>{galDefs(c)}</defs>
        <circle cx={cx} cy={cy} r={1.08 * s} fill="none" stroke={alpha(pal.line, 0.2)} strokeWidth={1.3 * u} strokeDasharray={`${4 * u} ${10 * u}`} strokeDashoffset={frame * 0.4 * u} />
        {Array.from({length: 18}, (_, k) => {
          const r = 1.0 * Math.sqrt(rand(`dw${j}${k}`));
          const a = rand(`dwa${j}${k}`, 0, 6.28);
          const [px, py] = P(r * Math.cos(a), r * Math.sin(a));
          return <circle key={k} cx={px} cy={py} r={dot(c, 2.4)} fill={pal.star} opacity={0.35 + 0.3 * Math.sin(frame / 10 + k)} />;
        })}
        {members.map(([x, y, r, ang], k) => galaxyGlyph(c, `m${k}`, x, y, r, ang, k === 0))}
        {galaxyGlyph(c, 'home', HOME.group[0], HOME.group[1], 1 / F, -15, true)}
      </g>
    ),
  };
}

/** Filaments of galaxies out to a glowing boundary: the observable universe. */
function web(c: Ctx): Drawn {
  const {P, s, frame, pal, j, u} = c;
  const id = `cz${j}`;
  const [cx, cy] = P(0, 0);
  const edge = mix(pal.accent, pal.star, 0.4);
  return {
    anchors: WEB_ANCHORS,
    el: (
      <g>
        <defs>
          <radialGradient id={`${id}node`}>
            <stop offset="0" stopColor={alpha(pal.star, 0.9)} />
            <stop offset="0.35" stopColor={alpha(mix(pal.star, pal.accent, 0.5), 0.35)} />
            <stop offset="1" stopColor={alpha(pal.accent, 0)} />
          </radialGradient>
          <radialGradient id={`${id}fill`} gradientUnits="userSpaceOnUse" cx={cx} cy={cy} r={1.3 * s}>
            <stop offset="0" stopColor={alpha(pal.bg2, 0.5)} />
            <stop offset="0.85" stopColor={alpha(mix(pal.bg2, pal.accent, 0.25), 0.35)} />
            <stop offset="1" stopColor={alpha(pal.bg, 0)} />
          </radialGradient>
        </defs>
        <circle cx={cx} cy={cy} r={1.3 * s} fill={`url(#${id}fill)`} />
        {/* mottled glow of the boundary */}
        {Array.from({length: 72}, (_, k) => {
          const a0 = (k / 72) * Math.PI * 2;
          const a1 = a0 + (Math.PI * 2) / 72 + 0.01;
          const r = (1.2 + rand(`wb${j}${k}`, 0, 0.08)) * s;
          return <path key={k} d={`M${cx + r * Math.cos(a0)},${cy + r * Math.sin(a0)} A${r},${r} 0 0 1 ${cx + r * Math.cos(a1)},${cy + r * Math.sin(a1)}`} fill="none" stroke={rand(`wc${j}${k}`) > 0.5 ? edge : mix(pal.accent, pal.bg2, 0.3)} strokeWidth={0.09 * s} opacity={(0.15 + 0.35 * rand(`wo${j}${k}`)) * (0.8 + 0.2 * Math.sin(frame / 12 + k))} />;
        })}
        <circle cx={cx} cy={cy} r={1.15 * s} fill="none" stroke={alpha(pal.text, 0.3)} strokeWidth={1.2 * u} />
        {WEB_EDGES.map(([a, b], k) => {
          const pa = P(...WEB_NODES[a]);
          const pb = P(...WEB_NODES[b]);
          return <line key={k} x1={pa[0]} y1={pa[1]} x2={pb[0]} y2={pb[1]} stroke={mix(pal.accent, pal.line, 0.3)} strokeWidth={dot(c, 1.6)} opacity={0.22 + 0.12 * Math.sin(frame / 15 + k)} />;
        })}
        {WEB_NODES.map((n, k) => {
          const [px, py] = P(...n);
          return <circle key={k} cx={px} cy={py} r={Math.max(4 * u, rand(`wn${k}`, 0.02, 0.05) * s)} fill={`url(#${id}node)`} />;
        })}
      </g>
    ),
  };
}

const DRAW: Record<View, (c: Ctx) => Drawn> = {surface, planet, orbit, system, stars, galaxy, group, web};

// ---------------------------------------------------------------------------------------------
// Overlays
// ---------------------------------------------------------------------------------------------

/** Top-left readout for one level: counter, name, size and a note. */
const LevelCard: React.FC<{level: Level; index: number; total: number; start: number; end: number; pal: Pal; u: number; landscape: boolean}> = ({level, index, total, start, end, pal, u, landscape}) => {
  const frame = useCurrentFrame();
  const {width, height} = useVideoConfig();
  if (frame < start - 2 || frame > end + 2) return null;
  const local = frame - start;
  const out = 1 - progress(frame, end - 10, 10, ease.accelerate);
  const nameSize = Math.min((landscape ? 64 : 76) * u, ((landscape ? width * 0.45 : width * 0.86) * 1.7) / Math.max(8, level.name.length));
  return (
    <div style={{position: 'absolute', left: landscape ? '5%' : '7%', top: height * (landscape ? 0.08 : 0.065), width: landscape ? '48%' : '86%', opacity: out, fontFamily: fonts.sans, color: pal.text}}>
      <div style={{display: 'flex', alignItems: 'center', gap: 16 * u, fontFamily: fonts.mono, fontSize: 22 * u, letterSpacing: '0.3em', color: pal.muted, opacity: progress(local, 0, 12)}}>
        <div style={{width: 54 * u * progress(local, 2, 18, ease.expo), height: 2 * u, background: pal.accent}} />
        {String(index + 1).padStart(2, '0')} / {String(total).padStart(2, '0')}
      </div>
      <div style={{marginTop: 14 * u}}>
        <KineticText text={level.name} start={start + 3} stagger={3} style="rise" textStyle={{fontFamily: fonts.grotesk, fontWeight: 700, fontSize: nameSize, lineHeight: 1.05, letterSpacing: '-0.01em', textShadow: `0 2px 24px ${alpha(pal.bg, 0.8)}`}} />
      </div>
      {level.span ? <div style={{marginTop: 12 * u, fontSize: 34 * u, fontWeight: 700, color: ink(pal), opacity: progress(local, 12, 14), transform: `translateY(${(1 - progress(local, 12, 18, ease.expo)) * 14 * u}px)`, textShadow: `0 2px 18px ${alpha(pal.bg, 0.8)}`}}>{level.span}</div> : null}
      {level.note ? <div style={{marginTop: 10 * u, fontSize: 28 * u, lineHeight: 1.3, color: pal.muted, maxWidth: landscape ? '100%' : '92%', opacity: progress(local, 22, 16), textShadow: `0 2px 18px ${alpha(pal.bg, 0.9)}`}}>{level.note}</div> : null}
    </div>
  );
};

/** Log-scale ruler: a tick per level, a filled track and a glowing marker riding the zoom. */
const Ruler: React.FC<{z: number; total: number; pal: Pal; u: number; bottom: number; landscape: boolean; appear: number}> = ({z, total, pal, u, bottom, landscape, appear}) => {
  const {width} = useVideoConfig();
  const left = width * (landscape ? 0.2 : 0.08);
  const span = width - left * 2;
  const x = left + (Math.min(total - 1, Math.max(0, z)) / Math.max(1, total - 1)) * span;
  return (
    <div style={{position: 'absolute', left: 0, right: 0, bottom, height: 50 * u, opacity: appear}}>
      <div style={{position: 'absolute', left, width: span, top: 14 * u, height: 2 * u, background: alpha(pal.text, 0.22)}} />
      <div style={{position: 'absolute', left, width: x - left, top: 14 * u, height: 2 * u, background: pal.accent}} />
      {Array.from({length: total}, (_, i) => {
        const tx = left + (i / Math.max(1, total - 1)) * span;
        const passed = z >= i - 0.02;
        return (
          <React.Fragment key={i}>
            <div style={{position: 'absolute', left: tx - u, top: 6 * u, width: 2 * u, height: 18 * u, background: passed ? pal.accent : alpha(pal.text, 0.4)}} />
            <div style={{position: 'absolute', left: tx - 30 * u, width: 60 * u, top: 28 * u, textAlign: 'center', fontFamily: fonts.mono, fontSize: 16 * u, letterSpacing: '0.1em', color: passed ? pal.text : pal.muted}}>{String(i + 1).padStart(2, '0')}</div>
          </React.Fragment>
        );
      })}
      <div style={{position: 'absolute', left: x - 8 * u, top: 7 * u, width: 16 * u, height: 16 * u, borderRadius: '50%', background: pal.accent, boxShadow: `0 0 ${18 * u}px ${alpha(pal.accent, 0.9)}`}} />
    </div>
  );
};

// ---------------------------------------------------------------------------------------------
// Composition
// ---------------------------------------------------------------------------------------------

/** Where each level starts: one narration scene per level (an extra first scene is an intro). */
function levelStarts(timeline: TimedScene[], n: number, content: number, fps: number) {
  const offset = timeline.length > n ? 1 : 0;
  const latest = Math.max(fps, content - Math.round(1.6 * fps));
  if (timeline.length >= n) return {offset, starts: Array.from({length: n}, (_, i) => (i === 0 ? 0 : Math.min(latest, timeline[i + offset].from)))};
  return {offset: 0, starts: Array.from({length: n}, (_, i) => Math.round((i * content) / n))};
}

const titleFrames = (scenes: TimedScene[], n: number, fps: number) => {
  const first = scenes[0]?.durationInFrames ?? 2 * fps;
  return scenes.length > n && scenes[1] ? scenes[1].from : Math.min(Math.round(2.6 * fps), Math.round(first * 0.55));
};

const CosmicZoomOut: React.FC<EntryProps<Props>> = ({media, props}) => {
  const frame = useCurrentFrame();
  const {fps, width, height} = useVideoConfig();
  const look = useLook();
  const own = PALETTES[props.palette];
  const pal: Pal = look ? fromLook(look) : {...own, accent: media.accent ?? own.accent};
  const u = Math.min(width, height) / 1080;
  const landscape = width > height;
  const timeline = useSceneTimeline(media);
  const content = useContentFrames(media);
  const levels = props.levels;
  const n = levels.length;
  const {starts} = levelStarts(timeline, n, content, fps);
  const ends = starts.map((s, i) => (i === n - 1 ? content : starts[i + 1]));
  const titleEnd = Math.min(titleFrames(timeline, n, fps), ends[0] - 4);
  const safe = captionSafeBottom(look);

  // --- the zoom: z = level index (fractional while travelling) ---
  const D = 0.14;
  const moves = starts.map((s, i) => {
    if (i === 0) return {from: 0, len: 1};
    const len = Math.max(10, Math.min(Math.round(1.7 * fps), Math.round(0.8 * (s - starts[i - 1]))));
    return {from: s - Math.round(len * 0.35), len};
  });
  let z = -0.4 * (1 - progress(frame, 0, Math.round(1.8 * fps), ease.cinematic));
  for (let i = 1; i < n; i++) z += (1 - D) * progress(frame, moves[i].from, moves[i].len, ease.cinematic);
  for (let i = 0; i < n; i++) z += D * tween(frame, [starts[i], ends[i]], [0, 1], t => t);

  const R = Math.min(width, height) * (landscape ? 0.36 : 0.42);
  const C: V2 = [width / 2, height * (look ? 0.5 - safe * 0.22 : landscape ? 0.52 : 0.54)];
  const views = levels.map(l => l.view);
  const b: V2[] = [[0, 0]];
  for (let j = 1; j < n; j++) {
    const h = HOME[views[j]];
    b.push([b[j - 1][0] - F ** j * h[0], b[j - 1][1] - F ** j * h[1]]);
  }
  let cam: V2 = [0, 0];
  if (z > 0) {
    const k = Math.min(n - 1, Math.ceil(z));
    const t = Math.min(1, z - (k - 1));
    const h = HOME[views[k]];
    const e = 1 - smooth(Math.max(0, t));
    cam = [F ** k * h[0] * e + b[k][0], F ** k * h[1] * e + b[k][1]];
  }
  const scaleAt = F ** -z;
  const homeScreen: V2 = [C[0] - cam[0] * R * scaleAt, C[1] - cam[1] * R * scaleAt];

  const layers = levels.map((level, j) => {
    const fadeIn = j === 0 ? 1 : tween(z, [j - 0.8, j - 0.2], [0, 1], t => t);
    const fadeOut = SOLID[level.view] ? 1 - tween(z, [j + 0.45, j + 0.95], [0, 1], t => t) : 1 - tween(z, [j + 0.8, j + 1.45], [0, 1], t => t);
    const o = Math.min(fadeIn, fadeOut);
    if (o <= 0.01) return null;
    const s = R * F ** (j - z);
    const ox = C[0] + (b[j][0] - cam[0]) * R * scaleAt;
    const oy = C[1] + (b[j][1] - cam[1]) * R * scaleAt;
    const ctx: Ctx = {P: (x, y) => [ox + x * s, oy + y * s], s, frame, pal, j, u, R, w: width, h: height, z, labels: level.labels};
    return {j, o, ctx, drawn: DRAW[level.view](ctx)};
  });

  const titleIn = progress(frame, 4, 26, ease.expo);
  const titleOut = 1 - progress(frame, titleEnd - 12, 12, ease.accelerate);
  const afterTitle = progress(frame, titleEnd - 4, 14);
  const rulerBottom = look ? height * safe + 10 * u : height * (landscape ? 0.05 : 0.045);
  const bgRot = frame * 0.03;

  return (
    <AbsoluteFill style={{background: `radial-gradient(ellipse at 50% 45%, ${pal.bg2} 0%, ${pal.bg} 70%)`, overflow: 'hidden'}}>
      {/* distant stars, slowly wheeling */}
      <svg width={width} height={height} style={{position: 'absolute', inset: 0}}>
        <g transform={`rotate(${bgRot} ${C[0]} ${C[1]})`}>
          {BG_STARS.map((st, i) => {
            const d = Math.hypot(width, height);
            return <circle key={i} cx={C[0] + (st.x - 0.5) * d} cy={C[1] + (st.y - 0.5) * d} r={st.r * u} fill={pal.star} opacity={(0.25 + 0.45 * st.r / 2.8) * (0.7 + 0.3 * Math.sin(frame / 10 + st.tw))} />;
          })}
        </g>
      </svg>
      {/* the zoom: outer levels behind, inner levels on top */}
      <svg width={width} height={height} style={{position: 'absolute', inset: 0}}>
        {[...layers].reverse().map(l => (l ? <g key={l.j} opacity={l.o}>{l.drawn.el}</g> : null))}
      </svg>
      {/* names pinned on the drawings */}
      {layers.map(l => {
        if (!l || !l.ctx.labels.length) return null;
        const start = starts[l.j];
        return l.ctx.labels.map((name, k) => {
          const a = l.drawn.anchors[k];
          if (!a) return null;
          const [px, py] = l.ctx.P(a[0], a[1]);
          const show = l.o * progress(frame, start + 14 + k * 7, 14) * (1 - progress(frame, ends[l.j] - 8, 8));
          if (show <= 0.01 || px < 0 || px > width || py < 0 || py > height) return null;
          // Labels point away from the level's centre so neighbours never stack on each other.
          const flip = (a[0] < -0.02 && px > width * 0.32) || px > width * 0.68;
          const above = a[1] <= 0;
          return (
            <div key={`${l.j}-${k}`} style={{position: 'absolute', left: flip ? undefined : px + 14 * u, right: flip ? width - px + 14 * u : undefined, top: above ? py - 34 * u : py + 6 * u, opacity: show, display: 'flex', alignItems: 'center', flexDirection: flip ? 'row-reverse' : 'row', gap: 8 * u, fontFamily: fonts.mono, fontSize: 21 * u, letterSpacing: '0.06em', color: pal.text, whiteSpace: 'nowrap', textShadow: `0 1px 12px ${alpha(pal.bg, 0.95)}`}}>
              <div style={{width: 22 * u, height: 1.5 * u, background: alpha(pal.text, 0.6)}} />
              {name}
            </div>
          );
        });
      })}
      {/* "you are here" marker */}
      <div style={{position: 'absolute', left: homeScreen[0], top: homeScreen[1], opacity: afterTitle}}>
        <div style={{position: 'absolute', left: -13 * u, top: -13 * u, width: 26 * u, height: 26 * u, borderRadius: '50%', border: `${2 * u}px solid ${pal.accent}`, transform: `scale(${1 + 0.18 * Math.sin(frame / 7)})`, boxShadow: `0 0 ${16 * u}px ${alpha(pal.accent, 0.7)}`}} />
        <div style={{position: 'absolute', left: -3 * u, top: -3 * u, width: 6 * u, height: 6 * u, borderRadius: '50%', background: pal.accent}} />
        {props.homeLabel ? (
          <div style={{position: 'absolute', left: 24 * u, top: 18 * u, fontFamily: fonts.mono, fontSize: 20 * u, letterSpacing: '0.22em', textTransform: 'uppercase', color: ink(pal), whiteSpace: 'nowrap', textShadow: `0 1px 12px ${alpha(pal.bg, 0.95)}`}}>{props.homeLabel}</div>
        ) : null}
      </div>
      <Particles count={28} color={pal.star} opacity={0.2} seed="cz-dust" speed={0.3} size={[1, 3]} />
      {/* readouts */}
      {levels.map((level, i) => (
        <LevelCard key={i} level={level} index={i} total={n} start={i === 0 ? titleEnd : starts[i]} end={ends[i]} pal={pal} u={u} landscape={landscape} />
      ))}
      {props.showRuler ? <Ruler z={z} total={n} pal={pal} u={u} bottom={rulerBottom} landscape={landscape} appear={afterTitle * (1 - progress(frame, content - 8, 8))} /> : null}
      {/* opening line */}
      {frame < titleEnd ? (
        <AbsoluteFill style={{opacity: titleOut, justifyContent: 'center', alignItems: 'center', padding: landscape ? '0 16%' : '0 8%'}}>
          <AbsoluteFill style={{background: `radial-gradient(ellipse at 50% 50%, ${alpha(pal.bg, 0.6)} 0%, transparent 65%)`}} />
          <div style={{fontFamily: fonts.mono, fontSize: 22 * u, letterSpacing: '0.42em', color: ink(pal), marginBottom: 26 * u, opacity: titleIn, position: 'relative'}}>{String(n).padStart(2, '0')} SCALES</div>
          <div style={{position: 'relative', transform: `scale(${1 + 0.04 * progress(frame, 0, titleEnd, ease.cinematic)})`}}>
            <KineticText text={props.title} start={6} stagger={4} style="blur" align="center" accent={pal.accent} textStyle={{fontFamily: fonts.grotesk, fontWeight: 700, fontSize: Math.min((landscape ? 84 : 96) * u, (width * (landscape ? 1.9 : 2.2)) / Math.max(12, props.title.length)), lineHeight: 1.06, letterSpacing: '-0.02em', color: pal.text, textShadow: `0 4px 40px ${alpha(pal.bg, 0.9)}`}} />
          </div>
        </AbsoluteFill>
      ) : null}
      {moves.slice(1).map((m, i) => <LightLeak key={i} from={Math.max(0, m.from)} durationInFrames={Math.max(8, m.len)} seed={i * 5 + 2} hueShift={pal.leakHue} opacity={pal.leak} />)}
      {props.showCaptions
        ? timeline.map(t => (
            <Sequence key={t.index} from={t.from} durationInFrames={t.durationInFrames}>
              <AbsoluteFill style={{justifyContent: 'flex-end', padding: landscape ? `0 18% ${height * 0.15}px` : `0 7% ${height * 0.1}px`, opacity: frame >= titleEnd ? 1 : 0}}>
                <StyledCaptions scene={t.scene} variant="minimal" accent={pal.accent} color={pal.text} font={fonts.grotesk} size={(landscape ? 46 : 52) * u} words={landscape ? 8 : 5} weight={700} />
              </AbsoluteFill>
            </Sequence>
          ))
        : null}
      <Vignette strength={0.55} />
      <Grain opacity={0.05} />
      <NarrationTrack media={media} />
      <AdWeave media={media} theme={{background: pal.bg, text: pal.text, font: fonts.grotesk}} />
    </AbsoluteFill>
  );
};

export default defineEntry({
  id: 'story-cosmic-zoom-out',
  schema: Props,
  component: CosmicZoomOut,
  // Shared captions wait for the opening line, like the template's own captions.
  captionHold: ({props, media, fps}) => titleFrames(sceneTimeline(media.scenes, fps), props.levels.length, fps),
});
