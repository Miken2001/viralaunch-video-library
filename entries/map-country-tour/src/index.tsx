import React from 'react';
import {AbsoluteFill, Sequence, spring, useCurrentFrame, useVideoConfig} from 'remotion';
import {AdWeave, NarrationTrack, captionSafeBottom, defineEntry, mix, useContentFrames, useLook, useSceneTimeline, type ActiveLook, type EntryProps, type Media} from '@viralaunch/kit';
import {Grain, KineticText, LightLeak, LineIcon, Particles, StyledCaptions, Vignette, alpha, countUp, ease, fonts, progress, rand, tween, type Widen} from '@viralaunch/kit/fx';
import {Props, type Stop} from './schema';
import {Scenery, type SceneryColors} from './scenery';

const PALETTES = {
  sunset: {light: false, sea: '#1d0f0c', sea2: '#3c1b12', land: '#5b2c1d', land2: '#7a3b25', edge: '#f2b48a', grid: '#f7d9c4', text: '#fff1e6', muted: '#d8a68a', accent: '#ffb347', card: '#24120d', sky: ['#ff8f5a', '#ffd79a'], hues: ['#e4572e', '#f3a712', '#29b6a6', '#f06292', '#4c6ef5']},
  atlas: {light: true, sea: '#cfe3e4', sea2: '#b2d0d4', land: '#f5edd6', land2: '#e8d8b0', edge: '#5b4a32', grid: '#3c5a66', text: '#22201c', muted: '#6f6656', accent: '#d64933', card: '#fffaf0', sky: ['#8fcde6', '#e8f6f6'], hues: ['#d64933', '#f2a541', '#3c8d93', '#e07a9a', '#4a6fa5']},
  night: {light: false, sea: '#060b1d', sea2: '#101c40', land: '#16264d', land2: '#1f3466', edge: '#6cf2c2', grid: '#9fb3ff', text: '#eef2ff', muted: '#94a0c8', accent: '#5ff2c0', card: '#0d1530', sky: ['#1b2a5a', '#5a6fb0'], hues: ['#5ff2c0', '#7aa2ff', '#ff7ab6', '#ffd166', '#b48cff']},
  jungle: {light: false, sea: '#061612', sea2: '#0d2c22', land: '#173f2e', land2: '#22553d', edge: '#e8c35a', grid: '#cfe8d0', text: '#f1f7ea', muted: '#9cc3a8', accent: '#f2c14e', card: '#0f241b', sky: ['#2f7a5a', '#b5dea6'], hues: ['#f2c14e', '#e76f51', '#2a9d8f', '#8ac926', '#f4a261']},
} as const;
type Pal = Widen<(typeof PALETTES)[keyof typeof PALETTES]>;

/** The map in a sequence's shared look: sea, land, ink, cards and accent all come from the look. */
const fromLook = (l: ActiveLook): Pal => {
  const p = l.palette;
  const light = l.tone === 'light';
  return {
    light,
    sea: light ? mix(p.bg2, p.muted, 0.22) : p.bg,
    sea2: light ? mix(p.bg2, p.muted, 0.35) : mix(p.bg, p.bg2, 0.8),
    land: light ? p.surface : mix(p.bg2, p.accent, 0.1),
    land2: light ? mix(p.surface, p.accent, 0.16) : mix(p.bg2, p.accent, 0.22),
    edge: p.line,
    grid: p.line,
    text: p.text,
    muted: p.muted,
    accent: p.accent,
    card: p.surface,
    sky: [mix(p.bg2, p.accent, 0.35), mix(p.bg2, p.text, light ? 0.05 : 0.3)],
    hues: [p.accent, mix(p.accent, p.text, 0.45), mix(p.muted, p.bg2, 0.3), mix(p.accent, p.bg2, 0.5), mix(p.text, p.muted, 0.5)],
  };
};

type P = {x: number; y: number};
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const lerpP = (a: P, b: P, t: number): P => ({x: lerp(a.x, b.x, t), y: lerp(a.y, b.y, t)});
const bez = (a: P, c: P, b: P, t: number): P => ({x: (1 - t) ** 2 * a.x + 2 * (1 - t) * t * c.x + t * t * b.x, y: (1 - t) ** 2 * a.y + 2 * (1 - t) * t * c.y + t * t * b.y});
const BEND = {flight: 0.28, road: 0.16, rail: 0.07} as const;
/** Control point of the curved leg a→b (alternating sides so a long route snakes). */
function ctrl(a: P, b: P, bend: number, i: number): P {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const s = i % 2 ? -1 : 1;
  return {x: (a.x + b.x) / 2 - dy * bend * s, y: (a.y + b.y) / 2 + dx * bend * s};
}
function haversineKm(a: Stop, b: Stop) {
  const r = Math.PI / 180;
  const h = Math.sin(((b.lat - a.lat) * r) / 2) ** 2 + Math.cos(a.lat * r) * Math.cos(b.lat * r) * Math.sin(((b.lon - a.lon) * r) / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.min(1, Math.sqrt(h)));
}
/** Smooth closed path through points (quadratic curves via midpoints). */
function smoothClosed(pts: P[]) {
  const m = (i: number) => lerpP(pts[i % pts.length], pts[(i + 1) % pts.length], 0.5);
  let d = `M${m(0).x.toFixed(1)},${m(0).y.toFixed(1)}`;
  for (let i = 1; i <= pts.length; i++) {
    const p = pts[i % pts.length];
    d += ` Q${p.x.toFixed(1)},${p.y.toFixed(1)} ${m(i).x.toFixed(1)},${m(i).y.toFixed(1)}`;
  }
  return d + ' Z';
}

/** Stop windows paced to narration: an intro scene (when there is one), then one scene per stop. */
function useStops(media: Media, n: number) {
  const {fps} = useVideoConfig();
  const timeline = useSceneTimeline(media);
  const contentEnd = useContentFrames(media);
  const offset = timeline.length > n ? 1 : 0;
  const introEnd = Math.min(offset ? timeline[1].from : Math.round(1.8 * fps), Math.round(contentEnd * 0.3));
  let starts = Array.from({length: n}, (_, i) => (offset ? timeline[i + 1].from : timeline.length === n ? (i === 0 ? introEnd : timeline[i].from) : -1));
  const ok = starts.every((s, i) => s >= introEnd && (i === 0 || s - starts[i - 1] >= fps) && s < contentEnd - fps * 1.2);
  if (!ok) starts = Array.from({length: n}, (_, i) => Math.round(introEnd + (i * (contentEnd - introEnd)) / n));
  const ends = starts.map((s, i) => (i < n - 1 ? starts[i + 1] : contentEnd));
  const travel = starts.map((s, i) => Math.round(Math.max(0.45 * fps, Math.min((i === 0 ? 1.1 : 1.6) * fps, 0.42 * (ends[i] - s)))));
  const arrive = starts.map((s, i) => s + travel[i]);
  const outro = ends[n - 1] - arrive[n - 1] > 3.4 * fps ? ends[n - 1] - Math.round(1.1 * fps) : Infinity;
  return {timeline, introEnd, starts, ends, arrive, outro, contentEnd};
}

const MapTour: React.FC<EntryProps<Props>> = ({media, props}) => {
  const frame = useCurrentFrame();
  const {fps, width, height} = useVideoConfig();
  const look = useLook();
  const pal: Pal = look ? fromLook(look) : {...PALETTES[props.palette], accent: media.accent ?? PALETTES[props.palette].accent};
  const u = Math.min(width, height) / 1080;
  const portrait = height >= width;
  const stops = props.stops;
  const n = stops.length;
  const {timeline, introEnd, starts, ends, arrive, outro} = useStops(media, n);

  // ---- layout: where the map is framed and where the card docks (content above the caption band)
  const safe = look ? captionSafeBottom(look) : portrait ? 0.13 : 0.06;
  const bottomY = height * (1 - safe);
  const view = portrait
    ? {x: 0, y: height * 0.08, w: width, h: height * (look ? 0.37 : 0.42)}
    : {x: 0, y: height * 0.1, w: width * 0.6, h: bottomY - height * 0.1 - (look ? 0 : height * 0.1)};
  const card = portrait
    ? {x: width * 0.06, y: height * (look ? 0.47 : 0.52), w: width * 0.88, h: bottomY - height * (look ? 0.47 : 0.52)}
    : {x: width * 0.6, y: height * 0.11, w: width * 0.35, h: bottomY - height * 0.11 - height * 0.03};
  const vc: P = {x: view.x + view.w / 2, y: view.y + view.h / 2};
  // Card type scale: grows to fill a tall portrait card, shrinks when the caption band is tall.
  const k = (portrait ? Math.min(1.4, Math.max(0.85, card.h / (470 * u))) : Math.min(1.15, Math.max(0.85, card.h / (700 * u)))) * u;

  // ---- projection: equirectangular around the tour's mean latitude, fitted to the view
  const proj = React.useMemo(() => {
    const lat0 = stops.reduce((s, p) => s + p.lat, 0) / n;
    const k = Math.cos((lat0 * Math.PI) / 180);
    const raw = stops.map(s => ({x: s.lon * k, y: -s.lat}));
    const xs = raw.map(p => p.x);
    const ys = raw.map(p => p.y);
    let [x0, x1, y0, y1] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)];
    const span = Math.max(x1 - x0, y1 - y0, 0.02);
    const pad = (a: number, b: number) => (b - a < span * 0.45 ? [(a + b) / 2 - span * 0.225, (a + b) / 2 + span * 0.225] : [a, b]);
    [x0, x1] = pad(x0, x1);
    [y0, y1] = pad(y0, y1);
    const s = Math.min((view.w * 0.62) / (x1 - x0), (view.h * 0.62) / (y1 - y0));
    const cx = (x0 + x1) / 2;
    const cy = (y0 + y1) / 2;
    const pts = raw.map(p => ({x: vc.x + (p.x - cx) * s, y: vc.y + (p.y - cy) * s}));
    return {pts, k, s, cx, cy, span};
  }, [stops, n, view.w, view.h, vc.x, vc.y]);
  const pts = proj.pts;

  // ---- the stylised landmass that holds the tour (support-function hull + seeded coastline)
  const land = React.useMemo(() => {
    const c = pts.reduce((a, p) => ({x: a.x + p.x / n, y: a.y + p.y / n}), {x: 0, y: 0});
    const margin = Math.min(view.w, view.h) * 0.2;
    const N = 72;
    const seed = stops.map(s => s.name).join('|');
    const outline = Array.from({length: N}, (_, i) => {
      const a = (i / N) * Math.PI * 2;
      const d = {x: Math.cos(a), y: Math.sin(a)};
      const reach = Math.max(0, ...pts.map(p => (p.x - c.x) * d.x + (p.y - c.y) * d.y));
      const wob = 1 + 0.12 * Math.sin(a * 3 + rand(`${seed}a`, 0, 6)) + 0.07 * Math.sin(a * 7 + rand(`${seed}b`, 0, 6)) + rand(`${seed}n${i}`, -0.04, 0.04);
      const r = Math.max(margin * 1.5, reach + margin) * wob;
      return {x: c.x + d.x * r, y: c.y + d.y * r};
    });
    const islands = [0, 1, 2].map(i => {
      const a = rand(`${seed}ia${i}`, 0, Math.PI * 2);
      const o = outline[Math.floor((a / (Math.PI * 2)) * N) % N];
      const far = 1.12 + rand(`${seed}if${i}`, 0, 0.12);
      const at = {x: c.x + (o.x - c.x) * far, y: c.y + (o.y - c.y) * far};
      const r = margin * rand(`${seed}ir${i}`, 0.12, 0.26);
      return smoothClosed(Array.from({length: 9}, (_, j) => {
        const b = (j / 9) * Math.PI * 2;
        const rr = r * (0.75 + rand(`${seed}i${i}${j}`, 0, 0.45));
        return {x: at.x + Math.cos(b) * rr * 1.4, y: at.y + Math.sin(b) * rr};
      }));
    });
    const borders = [0, 1].map(i => {
      const a = outline[Math.floor(rand(`${seed}ba${i}`, 0, N))];
      const b = outline[Math.floor(rand(`${seed}bb${i}`, 0, N))];
      const m = lerpP(a, b, 0.5);
      return `M${a.x},${a.y} Q${lerp(m.x, c.x, 0.5) + rand(`${seed}bx${i}`, -60, 60)},${lerp(m.y, c.y, 0.5)} ${b.x},${b.y}`;
    });
    return {path: smoothClosed(outline), islands, borders, c};
  }, [pts, n, stops, view.w, view.h]);

  // ---- legs of the route and distances
  const bend = BEND[props.travel];
  const legs = pts.slice(1).map((b, i) => ({a: pts[i], c: ctrl(pts[i], b, bend, i), b}));
  const km = stops.slice(1).map((s, i) => haversineKm(stops[i], s));
  const unit = props.units === 'mi' ? 0.621371 : 1;
  const total = km.reduce((s, d) => s + d, 0) * unit;

  // ---- camera: overview → fly along each leg (following the vehicle) → hold → pull back
  const ZOOM = 1.75;
  const leg = (i: number) => tween(frame, [starts[i], arrive[i]], [0, 1], ease.cinematic);
  let cam = {c: vc, z: 1 + 0.03 * progress(frame, 0, introEnd, ease.cinematic)};
  let current = -1;
  for (let i = 0; i < n; i++) if (frame >= starts[i]) current = i;
  if (current >= 0) {
    const t = leg(current);
    const hold = progress(frame, arrive[current], ends[current] - arrive[current], ease.cinematic);
    if (current === 0) cam = {c: lerpP(vc, pts[0], t), z: lerp(1.03, ZOOM, t) + 0.08 * hold};
    else {
      const L = legs[current - 1];
      const legLen = Math.hypot(L.b.x - L.a.x, L.b.y - L.a.y);
      const dip = Math.min(0.6, legLen / Math.min(view.w, view.h));
      cam = {c: bez(L.a, L.c, L.b, t), z: ZOOM + 0.08 - (0.08 + dip) * Math.sin(Math.PI * t) - 0.08 * (1 - t) + 0.08 * hold * (t >= 1 ? 1 : 0)};
    }
    if (frame >= outro) {
      const o = progress(frame, outro, Math.round(0.9 * fps), ease.cinematic);
      cam = {c: lerpP(cam.c, vc, o), z: lerp(cam.z, 1, o)};
    }
  }
  const toScreen = (p: P): P => ({x: vc.x + (p.x - cam.c.x) * cam.z, y: vc.y + (p.y - cam.c.y) * cam.z});
  const groupT = `translate(${vc.x} ${vc.y}) scale(${cam.z}) translate(${-cam.c.x} ${-cam.c.y})`;

  // graticule every 1/2/5/10 degrees, wide enough for any camera position
  const stepDeg = [0.25, 0.5, 1, 2, 5, 10].find(s => proj.span / s <= 6) ?? 10;
  const deg = (v: number, axis: 'x' | 'y') => (axis === 'x' ? vc.x + (v * proj.k - proj.cx) * proj.s : vc.y + (-v - proj.cy) * proj.s);
  const lat0 = -proj.cy;
  const lon0 = proj.cx / proj.k;
  const grid = Array.from({length: 25}, (_, i) => i - 12);

  const distanceNow = km.reduce((s, d, i) => s + d * (current >= i + 1 ? leg(i + 1) : 0), 0) * unit;
  const dark = !pal.light;
  // Accent used as text colour: darkened on light palettes so pale accents (paper's yellow) stay readable.
  const hot = dark ? pal.accent : mix(pal.accent, pal.text, 0.45);
  const shadow = dark ? 'rgba(0,0,0,.55)' : 'rgba(60,40,10,.22)';
  const introOut = progress(frame, introEnd - 12, 12, ease.accelerate);
  const subtitle = props.subtitle || `${n} STOPS · ${Math.round(total).toLocaleString('en-US')} ${props.units.toUpperCase()}`;
  const sceneryColors: SceneryColors = {sky: pal.sky, hues: pal.hues, ground: mix(pal.card, pal.text, 0.12), ink: dark ? mix(pal.card, '#000000', 0.3) : mix(pal.text, pal.card, 0.25), sun: pal.light ? '#fff4c8' : mix(pal.accent, '#ffffff', 0.45)};
  const travelling = current > 0 && frame < arrive[current];

  return (
    <AbsoluteFill style={{overflow: 'hidden', background: pal.sea}}>
      {/* sea: static gradient (textures stay on static layers) */}
      <AbsoluteFill style={{background: `radial-gradient(ellipse at 45% 40%, ${pal.sea2} 0%, ${pal.sea} 75%)`}} />

      {/* map plane (moved by the camera) */}
      <svg width={width} height={height} style={{position: 'absolute', inset: 0}}>
        <defs>
          <clipPath id="mct-land">
            <path d={land.path} />
          </clipPath>
        </defs>
        <g transform={groupT}>
          {grid.map(i => {
            const lo = Math.round(lon0 / stepDeg) * stepDeg + i * stepDeg;
            const la = Math.round(lat0 / stepDeg) * stepDeg + i * stepDeg;
            return (
              <g key={i} stroke={pal.grid} strokeOpacity={dark ? 0.1 : 0.16} strokeWidth={1} vectorEffect="non-scaling-stroke">
                <line x1={deg(lo, 'x')} x2={deg(lo, 'x')} y1={-height * 4} y2={height * 5} vectorEffect="non-scaling-stroke" />
                <line y1={deg(la, 'y')} y2={deg(la, 'y')} x1={-width * 4} x2={width * 5} vectorEffect="non-scaling-stroke" />
              </g>
            );
          })}
          {/* depth rings around the coast */}
          {[1.1, 1.05].map((s, i) => (
            <path key={s} d={land.path} transform={`translate(${land.c.x} ${land.c.y}) scale(${s}) translate(${-land.c.x} ${-land.c.y})`} fill="none" stroke={pal.edge} strokeOpacity={0.12 + i * 0.1} strokeWidth={1.5} strokeDasharray={i ? undefined : '6 8'} vectorEffect="non-scaling-stroke" />
          ))}
          {land.islands.map((d, i) => <path key={i} d={d} fill={pal.land} stroke={pal.edge} strokeOpacity={0.5} strokeWidth={1.5} vectorEffect="non-scaling-stroke" />)}
          <path d={land.path} fill={pal.land} transform={`translate(0 ${10 / cam.z})`} opacity={0.5} style={{filter: 'brightness(0.6)'}} />
          <path d={land.path} fill={pal.land} stroke={pal.edge} strokeOpacity={0.75} strokeWidth={2} vectorEffect="non-scaling-stroke" />
          <g clipPath="url(#mct-land)">
            <path d={land.path} transform={`translate(${land.c.x} ${land.c.y}) scale(0.55) translate(${-land.c.x} ${-land.c.y})`} fill={pal.land2} opacity={0.55} />
            {land.borders.map((d, i) => <path key={i} d={d} fill="none" stroke={pal.edge} strokeOpacity={0.35} strokeWidth={1.5} strokeDasharray="10 7" vectorEffect="non-scaling-stroke" />)}
          </g>
          {/* route legs, drawn as the vehicle travels */}
          {legs.map((L, i) => {
            const t = current >= i + 1 ? leg(i + 1) : 0;
            if (t <= 0) return null;
            const d = Array.from({length: 41}, (_, k) => bez(L.a, L.c, L.b, (k / 40) * t)).map((p, k) => `${k ? 'L' : 'M'}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');
            return (
              <g key={i} fill="none" strokeLinecap="round" strokeLinejoin="round">
                {props.travel === 'road' ? (
                  <>
                    <path d={d} stroke={mix(pal.land, '#000000', dark ? 0.45 : 0.55)} strokeWidth={14 * u} vectorEffect="non-scaling-stroke" />
                    <path d={d} stroke={pal.accent} strokeWidth={9 * u} vectorEffect="non-scaling-stroke" />
                    <path d={d} stroke={pal.card} strokeWidth={2.2 * u} strokeDasharray={`${12 * u} ${10 * u}`} vectorEffect="non-scaling-stroke" />
                  </>
                ) : props.travel === 'rail' ? (
                  <>
                    <path d={d} stroke={pal.text} strokeOpacity={0.85} strokeWidth={14 * u} strokeDasharray={`${3 * u} ${9 * u}`} strokeLinecap="butt" vectorEffect="non-scaling-stroke" />
                    <path d={d} stroke={pal.accent} strokeWidth={5 * u} vectorEffect="non-scaling-stroke" />
                  </>
                ) : (
                  <>
                    <path d={d} stroke={pal.accent} strokeOpacity={0.25} strokeWidth={12 * u} vectorEffect="non-scaling-stroke" />
                    <path d={d} stroke={pal.accent} strokeWidth={4 * u} strokeDasharray={`${14 * u} ${12 * u}`} vectorEffect="non-scaling-stroke" />
                  </>
                )}
              </g>
            );
          })}
        </g>
      </svg>

      {/* cloud shadows drifting over the map */}
      <Particles count={7} color={dark ? '#ffffff' : pal.text} seed="clouds" size={[120 * u, 260 * u]} speed={0.35} blur opacity={dark ? 0.05 : 0.04} />

      {/* pins and labels, in screen space so they stay crisp at any zoom */}
      <svg width={width} height={height} style={{position: 'absolute', inset: 0, overflow: 'visible'}}>
        {pts.map((p, i) => {
          if (frame < arrive[i] - 2) return null;
          const s = toScreen(p);
          const drop = spring({frame: frame - arrive[i], fps, config: {damping: 11, stiffness: 160, mass: 0.7}});
          const isCur = i === current && !travelling;
          const size = (isCur ? 1 : 0.62) * u;
          const ring = ((frame - arrive[i]) % 45) / 45;
          return (
            <g key={i} transform={`translate(${s.x} ${s.y})`}>
              <ellipse cx={0} cy={0} rx={18 * size} ry={6 * size} fill="#000000" opacity={0.3 * drop} />
              {isCur ? [0, 0.5].map(o => {
                const r = (ring + o) % 1;
                return <circle key={o} r={(14 + 70 * r) * u} fill="none" stroke={pal.accent} strokeWidth={3 * u} opacity={(1 - r) * 0.7} />;
              }) : null}
              <g transform={`translate(0 ${(1 - drop) * -120 * u}) scale(${size * (0.6 + 0.4 * Math.min(1, drop))})`}>
                <path d="M0,0 C-10,-16 -26,-28 -26,-46 A26,26 0 1 1 26,-46 C26,-28 10,-16 0,0 Z" fill={pal.accent} stroke={pal.card} strokeWidth={4} />
                <circle cx={0} cy={-46} r={15} fill={pal.card} />
                <text x={0} y={-40} textAnchor="middle" fontFamily={fonts.mono} fontWeight={700} fontSize={17} fill={pal.text}>{i + 1}</text>
              </g>
            </g>
          );
        })}
      </svg>
      {pts.map((p, i) => {
        if (frame < arrive[i] + 4) return null;
        const s = toScreen(p);
        const isCur = i === current && !travelling;
        const inP = progress(frame, arrive[i] + 4, 14, ease.expo);
        const left = s.x > vc.x + view.w * 0.28 && !portrait;
        return (
          <div key={i} style={{position: 'absolute', left: s.x, top: s.y, transform: `translate(${left ? `calc(-100% - ${44 * u}px)` : `${44 * u}px`}, -50%) translateY(${-(isCur ? 34 : 20) * u}px)`, opacity: inP * (isCur ? 1 : 0.8), whiteSpace: 'nowrap', fontFamily: isCur ? fonts.heavy : fonts.sans, fontWeight: 800, fontSize: (isCur ? 34 : 22) * u, textTransform: 'uppercase', letterSpacing: '0.02em', color: isCur && dark ? pal.card : pal.text, background: isCur ? pal.accent : alpha(pal.card, 0.75), padding: `${(isCur ? 8 : 4) * u}px ${(isCur ? 18 : 10) * u}px`, borderRadius: 8 * u, boxShadow: `0 ${8 * u}px ${24 * u}px ${shadow}`, clipPath: `inset(0 ${(1 - inP) * 100}% 0 0)`}}>
            {stops[i].name}
          </div>
        );
      })}

      {/* the vehicle riding the current leg */}
      {travelling ? (() => {
        const L = legs[current - 1];
        const t = leg(current);
        const p = toScreen(bez(L.a, L.c, L.b, t));
        const q = toScreen(bez(L.a, L.c, L.b, Math.min(1, t + 0.01)));
        const r = toScreen(bez(L.a, L.c, L.b, Math.max(0, t - 0.01)));
        const ang = (Math.atan2(q.y - r.y, q.x - r.x) * 180) / Math.PI;
        const lift = props.travel === 'flight' ? Math.sin(Math.PI * t) * 26 * u : 0;
        const vis = Math.min(progress(frame, starts[current], 6), 1 - progress(frame, arrive[current] - 6, 6));
        return (
          <svg width={width} height={height} style={{position: 'absolute', inset: 0, opacity: vis}}>
            {lift ? <ellipse cx={p.x} cy={p.y + 6 * u} rx={22 * u} ry={7 * u} fill="#000" opacity={0.25} /> : null}
            <g transform={`translate(${p.x} ${p.y - lift}) rotate(${ang}) scale(${u * 1.25})`}>
              {props.travel === 'flight' ? (
                <path d="M26,0 C26,-4 20,-5 14,-5 L4,-5 L-8,-24 L-14,-24 L-6,-5 L-18,-5 L-24,-13 L-28,-13 L-24,0 L-28,13 L-24,13 L-18,5 L-6,5 L-14,24 L-8,24 L4,5 L14,5 C20,5 26,4 26,0 Z" fill={pal.text} stroke={pal.card} strokeWidth={2} />
              ) : props.travel === 'rail' ? (
                <g>
                  <rect x={-34} y={-10} width={50} height={20} rx={4} fill={pal.text} stroke={pal.card} strokeWidth={2} />
                  <path d="M16,-10 L26,-10 Q38,0 26,10 L16,10 Z" fill={pal.accent} stroke={pal.card} strokeWidth={2} />
                  <rect x={-28} y={-5} width={36} height={4} fill={pal.card} />
                </g>
              ) : (
                <g>
                  <rect x={-20} y={-12} width={40} height={24} rx={8} fill={pal.text} stroke={pal.card} strokeWidth={2} />
                  <rect x={0} y={-9} width={10} height={18} rx={3} fill={pal.accent} />
                  <rect x={-14} y={-9} width={8} height={18} rx={3} fill={alpha(pal.card, 0.7)} />
                </g>
              )}
            </g>
          </svg>
        );
      })() : null}

      {/* intro title over the overview */}
      {frame < introEnd + 2 ? (
        <AbsoluteFill style={{opacity: 1 - introOut, transform: `scale(${1 + introOut * 0.12})`, filter: `blur(${introOut * 10}px)`}}>
          <AbsoluteFill style={{background: `radial-gradient(ellipse at 50% ${portrait ? 40 : 50}%, ${alpha(pal.sea, 0.82)} 0%, ${alpha(pal.sea, 0.4)} 60%, transparent 90%)`}} />
          <AbsoluteFill style={{justifyContent: 'center', alignItems: 'center', padding: '0 8%', paddingBottom: portrait ? height * 0.12 : height * safe}}>
            <div style={{fontFamily: fonts.mono, fontSize: 28 * u, letterSpacing: '0.35em', color: hot, marginBottom: 26 * u, opacity: progress(frame, 2, 14), textAlign: 'center'}}>{subtitle.toUpperCase()}</div>
            <KineticText text={props.title} start={6} stagger={4} style="rise" align="center" accent={hot} textStyle={{fontFamily: fonts.heavy, color: pal.text, fontSize: Math.min((portrait ? 118 : 120) * u, (width * 1.5) / Math.max(8, props.title.length)), lineHeight: 1, letterSpacing: '-0.02em', textTransform: 'uppercase', textShadow: `0 ${10 * u}px ${40 * u}px ${shadow}`}} />
            <div style={{width: 220 * u * progress(frame, 14, 24, ease.expo), height: 4 * u, background: pal.accent, marginTop: 34 * u, borderRadius: 4 * u}} />
          </AbsoluteFill>
        </AbsoluteFill>
      ) : null}

      {/* HUD: title chip + stop dots (left), distance counter (right) */}
      {frame >= introEnd - 6 ? (() => {
        const hudIn = progress(frame, introEnd - 6, 16, ease.expo);
        const panel: React.CSSProperties = {position: 'absolute', top: height * (portrait ? 0.035 : 0.04), background: alpha(pal.card, dark ? 0.82 : 0.9), border: `1px solid ${alpha(pal.text, 0.12)}`, borderRadius: 12 * u, padding: `${14 * u}px ${20 * u}px`, boxShadow: `0 ${10 * u}px ${30 * u}px ${shadow}`, opacity: hudIn, transform: `translateY(${(1 - hudIn) * -30 * u}px)`};
        return (
          <>
            <div style={{...panel, left: width * 0.04, maxWidth: portrait ? width * 0.5 : width * 0.32}}>
              <div style={{fontFamily: fonts.mono, fontSize: 16 * u, letterSpacing: '0.25em', color: pal.muted}}>TOUR</div>
              <div style={{fontFamily: fonts.heavy, fontSize: 28 * u, color: pal.text, textTransform: 'uppercase', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis'}}>{props.title.replace(/\*/g, '')}</div>
              <div style={{display: 'flex', gap: 8 * u, marginTop: 10 * u}}>
                {stops.map((_, i) => <div key={i} style={{width: (i === current ? 30 : 12) * u, height: 8 * u, borderRadius: 4 * u, background: i <= current ? pal.accent : alpha(pal.text, 0.2)}} />)}
              </div>
            </div>
            <div style={{...panel, right: width * 0.04, textAlign: 'right'}}>
              <div style={{fontFamily: fonts.mono, fontSize: 16 * u, letterSpacing: '0.25em', color: pal.muted}}>DISTANCE</div>
              <div style={{fontFamily: fonts.mono, fontWeight: 700, fontSize: 40 * u, color: pal.text, lineHeight: 1.1}}>
                {Math.round(distanceNow).toLocaleString('en-US')}
                <span style={{fontSize: 20 * u, color: hot, marginLeft: 8 * u}}>{props.units.toUpperCase()}</span>
              </div>
            </div>
          </>
        );
      })() : null}

      {/* place cards */}
      {stops.map((stop, i) => {
        const enterAt = arrive[i] - 4;
        const exitAt = i < n - 1 ? starts[i + 1] : outro;
        if (frame < enterAt || frame > exitAt + 18) return null;
        // the card lays out in its own type scale
        const u = k;
        const inP = spring({frame: frame - enterAt, fps, config: {damping: 15, stiffness: 120}});
        const outP = frame > exitAt ? progress(frame, exitAt, 16, ease.accelerate) : 0;
        const local = frame - arrive[i];
        const tx = portrait ? 0 : (1 - inP) * card.w * 0.6 + outP * -card.w * 0.25;
        const ty = portrait ? (1 - inP) * card.h * 0.5 + outP * card.h * 0.3 : 0;
        const sceneryH = Math.min(card.h * (portrait ? 0.34 : 0.36), card.w * 0.5);
        const pad = (portrait ? 34 : 30) * u;
        return (
          <div key={i} style={{position: 'absolute', left: card.x, top: card.y, width: card.w, height: card.h, perspective: 1600 * u}}>
            <div style={{width: '100%', height: '100%', background: pal.card, borderRadius: 26 * u, overflow: 'hidden', boxShadow: `0 ${30 * u}px ${80 * u}px ${shadow}, inset 0 0 0 1px ${alpha(pal.text, 0.1)}`, transform: `translate(${tx}px, ${ty}px) rotateY(${(1 - inP) * -24}deg) rotateZ(${outP * -4}deg)`, opacity: Math.min(1, inP * 2) * (1 - outP), display: 'flex', flexDirection: 'column'}}>
              <div style={{height: sceneryH, position: 'relative', flexShrink: 0, clipPath: `inset(${(1 - progress(local, 0, 22, ease.expo)) * 100}% 0 0 0)`}}>
                <Scenery kind={stop.scenery} c={sceneryColors} seed={`${i}${stop.name}`} frame={local} />
                <div style={{position: 'absolute', left: pad, top: 16 * u, fontFamily: fonts.mono, fontSize: 18 * u, letterSpacing: '0.2em', color: '#ffffff', background: alpha('#000000', 0.35), padding: `${4 * u}px ${10 * u}px`, borderRadius: 6 * u}}>
                  STOP {String(i + 1).padStart(2, '0')}/{String(n).padStart(2, '0')}
                </div>
              </div>
              <div style={{padding: `${pad * 0.8}px ${pad}px ${pad}px`, display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0, color: pal.text}}>
                {stop.region ? <div style={{fontFamily: fonts.mono, fontSize: 20 * u, letterSpacing: '0.24em', color: hot, textTransform: 'uppercase', opacity: progress(local, 4, 12)}}>{stop.region}</div> : null}
                <KineticText text={stop.name} start={arrive[i] + 2} stagger={3} style="rise" textStyle={{fontFamily: fonts.heavy, fontSize: Math.min((portrait ? 64 : 58) * u, (card.w * 1.5) / Math.max(6, stop.name.length)), lineHeight: 1.02, textTransform: 'uppercase', letterSpacing: '-0.01em', marginTop: 4 * u}} />
                <div style={{display: 'flex', alignItems: 'center', gap: 18 * u, marginTop: (portrait ? 12 : 18) * u}}>
                  <div style={{flexShrink: 0, width: 64 * u, height: 64 * u, borderRadius: 16 * u, background: alpha(pal.accent, 0.14), display: 'flex', alignItems: 'center', justifyContent: 'center'}}>
                    <LineIcon name={stop.icon} progress={progress(local, 6, 26, ease.cinematic)} size={42 * u} color={pal.accent} strokeWidth={3.2} />
                  </div>
                  {stop.stat ? (
                    <div style={{fontFamily: fonts.heavy, fontSize: 50 * u, lineHeight: 1, color: hot, whiteSpace: 'nowrap'}}>
                      {countUp(local, stop.stat.value, 8, 36, stop.stat.decimals)}
                      <span style={{fontFamily: fonts.sans, fontWeight: 800, fontSize: 22 * u, color: pal.muted, marginLeft: 10 * u}}>{stop.stat.unit}</span>
                    </div>
                  ) : (
                    <div style={{height: 3 * u, flex: 1, background: alpha(pal.accent, 0.4), transformOrigin: 'left', transform: `scaleX(${progress(local, 8, 24, ease.expo)})`}} />
                  )}
                </div>
                <div style={{fontFamily: fonts.sans, fontWeight: 500, fontSize: (portrait ? 34 : 30) * u, lineHeight: 1.3, color: alpha(pal.text, 0.88), marginTop: (portrait ? 12 : 20) * u, opacity: progress(local, 14, 16), transform: `translateY(${(1 - progress(local, 14, 16)) * 16 * u}px)`}}>{stop.fact}</div>
              </div>
            </div>
          </div>
        );
      })}

      {/* compass */}
      <div style={{position: 'absolute', left: width * 0.045, top: portrait ? view.y + view.h - 110 * u : bottomY - (look ? 130 : 230) * u, width: 90 * u, height: 90 * u, opacity: 0.75 * progress(frame, 4, 20)}}>
        <svg viewBox="-50 -50 100 100" width="100%" height="100%">
          <circle r={40} fill="none" stroke={pal.text} strokeOpacity={0.4} strokeWidth={1.5} />
          <g transform={`rotate(${(1 - progress(frame, 4, 40, ease.overshoot)) * -120})`}>
            <path d="M0,-38 L8,0 L0,6 L-8,0 Z" fill={pal.accent} />
            <path d="M0,38 L8,0 L0,-6 L-8,0 Z" fill={pal.text} opacity={0.5} />
          </g>
        </svg>
        <div style={{position: 'absolute', top: -26 * u, width: '100%', textAlign: 'center', fontFamily: fonts.mono, fontWeight: 700, fontSize: 18 * u, color: pal.text}}>N</div>
      </div>

      {arrive.map((a, i) => <LightLeak key={i} from={a - 4} durationInFrames={Math.round(0.9 * fps)} seed={i * 5 + 2} opacity={pal.light ? 0.12 : 0.22} />)}

      {props.showCaptions
        ? timeline.map(t => (
            <Sequence key={t.index} from={t.from} durationInFrames={t.durationInFrames}>
              <AbsoluteFill style={{justifyContent: 'flex-end', padding: portrait ? '0 6% 4%' : `0 ${width * 0.42}px ${height * 0.045}px ${width * 0.05}px`}}>
                <StyledCaptions scene={t.scene} variant="box" accent={pal.accent} color={pal.text} font={fonts.sans} size={(portrait ? 46 : 40) * u} words={portrait ? 5 : 6} shadow={dark} />
              </AbsoluteFill>
            </Sequence>
          ))
        : null}

      <Vignette strength={dark ? 0.55 : 0.2} />
      <Grain opacity={0.05} />
      <NarrationTrack media={media} />
      <AdWeave media={media} theme={{background: pal.sea, text: pal.text, font: fonts.sans}} />
    </AbsoluteFill>
  );
};

export default defineEntry({id: 'map-country-tour', schema: Props, component: MapTour});
