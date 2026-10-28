import React from 'react';
import {AbsoluteFill, Sequence, useCurrentFrame, useVideoConfig} from 'remotion';
import {AdWeave, NarrationTrack, captionSafeBottom, defineEntry, mix, useContentFrames, useLook, useSceneTimeline, type ActiveLook, type EntryProps} from '@viralaunch/kit';
import {Grain, KineticText, LightLeak, LineIcon, StyledCaptions, Vignette, alpha, ease, fonts, progress, rand, tween, type Widen} from '@viralaunch/kit/fx';
import {Props} from './schema';

const PALETTES = {
  night: {bg: '#070b12', bg2: '#132033', surface: '#0e1520', text: '#f4f7fb', muted: '#8b98ab', accent: '#ff6a2b', line: '#dbe4ef', contour: '#24364f', water: '#0b1f33', light: false},
  track: {bg: '#090c09', bg2: '#172219', surface: '#101710', text: '#f1f7ee', muted: '#93a592', accent: '#c6ff3d', line: '#e4eee0', contour: '#1f2e21', water: '#0c2424', light: false},
  glacier: {bg: '#eef3f6', bg2: '#dae5ec', surface: '#ffffff', text: '#16202b', muted: '#66737f', accent: '#e8432b', line: '#16202b', contour: '#c6d4de', water: '#cde2ee', light: true},
} as const;
type Pal = Widen<(typeof PALETTES)[keyof typeof PALETTES]>;

/** The map in a sequence's shared look: terrain, water and route all tinted from the look. */
const fromLook = (l: ActiveLook): Pal => ({
  bg: l.palette.bg,
  bg2: l.palette.bg2,
  surface: l.palette.surface,
  text: l.palette.text,
  muted: l.palette.muted,
  accent: l.palette.accent,
  line: l.palette.line,
  contour: mix(l.palette.bg, l.palette.line, l.tone === 'light' ? 0.16 : 0.12),
  water: mix(l.palette.bg2, l.palette.line, 0.05),
  light: l.tone === 'light',
});

type Pt = {x: number; y: number};
const SAMPLES = 240;

/** Raw route outline for a shape (any scale; normalised later). Seeded so each title gets its own wiggle. */
function rawRoute(shape: Props['route']['shape'], seed: string): Pt[] {
  const a = rand(`${seed}a`, 0, 6.28);
  const b = rand(`${seed}b`, 0, 6.28);
  const c = rand(`${seed}c`, 0, 6.28);
  const p2p = (s: number): Pt => {
    const x = s;
    const y = 0.2 * Math.sin(Math.PI * s * 1.3 + a) + 0.05 * Math.sin(7 * s + b) + 0.025 * Math.sin(17 * s + c);
    const r = -0.35;
    return {x: x * Math.cos(r) - y * Math.sin(r), y: x * Math.sin(r) + y * Math.cos(r)};
  };
  return Array.from({length: SAMPLES + 1}, (_, i) => {
    const t = i / SAMPLES;
    const th = 2 * Math.PI * t;
    if (shape === 'point-to-point') return p2p(t);
    if (shape === 'out-and-back') {
      const s = t < 0.5 ? 2 * t : 2 - 2 * t;
      const p = p2p(s);
      const q = p2p(Math.min(1, s + 0.01));
      const len = Math.hypot(q.x - p.x, q.y - p.y) || 1;
      const off = 0.03 * (t < 0.5 ? 1 : -1) * Math.min(1, (1 - s) / 0.06);
      return {x: p.x - ((q.y - p.y) / len) * off, y: p.y + ((q.x - p.x) / len) * off};
    }
    if (shape === 'figure-eight') return {x: 1.25 * Math.sin(th), y: Math.sin(th) * Math.cos(th) + 0.05 * Math.sin(5 * th + a)};
    if (shape === 'circuit') {
      const sg = (v: number) => Math.sign(v) * Math.pow(Math.abs(v), 0.45);
      return {x: 1.45 * sg(Math.cos(th)) + 0.06 * Math.sin(4 * th + a), y: 0.75 * sg(Math.sin(th)) + 0.09 * Math.sin(3 * th + b)};
    }
    const q = th - Math.PI / 2;
    const r = 1 + 0.16 * Math.sin(2 * q + a) + 0.09 * Math.sin(3 * q + b) + 0.04 * Math.sin(6 * q + c);
    return {x: 1.15 * r * Math.cos(q), y: r * Math.sin(q)};
  });
}

/** Catmull-Rom through the user's rough trace, resampled densely. */
function traceRoute(points: Pt[]): Pt[] {
  const out: Pt[] = [];
  const n = points.length;
  const per = Math.ceil(SAMPLES / (n - 1));
  for (let i = 0; i < n - 1; i++) {
    const p0 = points[Math.max(0, i - 1)];
    const p1 = points[i];
    const p2 = points[i + 1];
    const p3 = points[Math.min(n - 1, i + 2)];
    for (let j = 0; j < per; j++) {
      const t = j / per;
      const t2 = t * t;
      const t3 = t2 * t;
      const f = (a: number, b: number, c: number, d: number) => 0.5 * (2 * b + (-a + c) * t + (2 * a - 5 * b + 4 * c - d) * t2 + (-a + 3 * b - 3 * c + d) * t3);
      out.push({x: f(p0.x, p1.x, p2.x, p3.x), y: f(p0.y, p1.y, p2.y, p3.y)});
    }
  }
  out.push(points[n - 1]);
  return out;
}

/** Fit a route into a box (world px) and precompute arc length for distance lookups. */
function fitRoute(raw: Pt[], box: {x: number; y: number; w: number; h: number}) {
  const xs = raw.map(p => p.x);
  const ys = raw.map(p => p.y);
  const [x0, x1, y0, y1] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)];
  const s = Math.min((box.w * 0.84) / Math.max(1e-6, x1 - x0), (box.h * 0.8) / Math.max(1e-6, y1 - y0));
  const cx = box.x + box.w / 2;
  const cy = box.y + box.h / 2;
  const pts = raw.map(p => ({x: cx + (p.x - (x0 + x1) / 2) * s, y: cy + (p.y - (y0 + y1) / 2) * s}));
  const cum = [0];
  for (let i = 1; i < pts.length; i++) cum.push(cum[i - 1] + Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y));
  const L = cum[cum.length - 1] || 1;
  const locate = (f: number) => {
    const target = Math.min(1, Math.max(0, f)) * L;
    let lo = 0;
    let hi = cum.length - 1;
    while (hi - lo > 1) {
      const mid = (lo + hi) >> 1;
      if (cum[mid] < target) lo = mid;
      else hi = mid;
    }
    const seg = cum[hi] - cum[lo] || 1;
    const k = (target - cum[lo]) / seg;
    return {i: lo, p: {x: pts[lo].x + (pts[hi].x - pts[lo].x) * k, y: pts[lo].y + (pts[hi].y - pts[lo].y) * k}};
  };
  return {
    pts,
    at: (f: number) => locate(f).p,
    upTo: (f: number) => {
      const {i, p} = locate(f);
      return [...pts.slice(0, i + 1), p];
    },
  };
}

/** Topographic contour rings and a lake, generated once per title (static data, no patterns). */
function terrain(seed: string, W: number, H: number) {
  const m = Math.min(W, H);
  const rings: string[] = [];
  for (let h = 0; h < 5; h++) {
    const cx = rand(`${seed}hx${h}`, -0.2, 1.2) * W;
    const cy = rand(`${seed}hy${h}`, -0.1, 1.1) * H;
    const R = rand(`${seed}hr${h}`, 0.3, 0.6) * m;
    const ph = [0, 1, 2].map(k => rand(`${seed}hp${h}${k}`, 0, 6.28));
    for (let j = 1; j <= 7; j++) {
      const r0 = (R * j) / 7;
      const d = Array.from({length: 73}, (_, i) => {
        const th = (i / 72) * Math.PI * 2;
        const r = r0 * (1 + 0.2 * Math.sin(2 * th + ph[0] + j * 0.2) + 0.1 * Math.sin(3 * th + ph[1]) + 0.05 * Math.sin(5 * th + ph[2] - j * 0.3));
        return `${i ? 'L' : 'M'}${(cx + r * Math.cos(th)).toFixed(1)},${(cy + r * Math.sin(th)).toFixed(1)}`;
      }).join(' ');
      rings.push(d + ' Z');
    }
  }
  const lx = rand(`${seed}lx`, 0.1, 0.9) * W;
  const ly = rand(`${seed}ly`, 0.05, 0.25) * H;
  const lake = Array.from({length: 49}, (_, i) => {
    const th = (i / 48) * Math.PI * 2;
    const r = m * 0.16 * (1 + 0.25 * Math.sin(3 * th + 1) + 0.12 * Math.sin(5 * th));
    return `${i ? 'L' : 'M'}${(lx + r * 1.4 * Math.cos(th)).toFixed(1)},${(ly + r * Math.sin(th)).toFixed(1)}`;
  }).join(' ') + ' Z';
  const roads = [0, 1, 2, 3].map(k => {
    const y0 = rand(`${seed}ry${k}`, -0.1, 1.1) * H;
    const y1 = rand(`${seed}rz${k}`, -0.1, 1.1) * H;
    return `M${-0.3 * W},${y0} Q${0.5 * W},${rand(`${seed}rc${k}`, 0, 1) * H} ${1.3 * W},${y1}`;
  });
  return {rings, lake, roads};
}

const pts2d = (pts: Pt[]) => pts.map((p, i) => `${i ? 'L' : 'M'}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');

const RouteTrace: React.FC<EntryProps<Props>> = ({media, props}) => {
  const frame = useCurrentFrame();
  const {fps, width: W, height: H} = useVideoConfig();
  const look = useLook();
  const own = PALETTES[props.palette];
  const pal: Pal = look ? fromLook(look) : {...own, accent: media.accent ?? own.accent};
  // Accent-coloured text needs more contrast on light grounds than accent strokes do.
  const ink = pal.light ? mix(pal.accent, pal.text, 0.55) : pal.accent;
  const u = Math.min(W, H) / 1080;
  const wide = W > H * 1.2;
  const timeline = useSceneTimeline(media);
  const contentEnd = useContentFrames(media);
  const seed = props.title;

  // ---- layout -------------------------------------------------------------------------------
  const compact = wide ? 1 : Math.min(1, Math.max(0.62, (H / W - 1) / (16 / 9 - 1)));
  const k = u * (wide ? 1 : 0.72 + 0.28 * compact);
  const safeBottom = look ? H * (1 - captionSafeBottom(look)) : props.showCaptions ? H * (wide ? 0.82 : 0.8) : H * 0.93;
  const top = H * (wide ? 0.07 : 0.05);
  const headerH = 150 * k;
  const gap = 22 * k;
  const cardH = 196 * k;
  const statsH = 116 * k;
  const stripH = (wide ? 120 : 112) * k;
  const col = wide ? {x: W * 0.6, w: W * 0.35} : {x: W * 0.06, w: W * 0.88};
  const panelH = cardH + statsH + stripH + gap * 2;
  const panelTop = wide ? Math.max(top + headerH + gap, safeBottom - panelH) : safeBottom - panelH;
  const region = wide ? {x: W * 0.03, y: top, w: W * 0.55, h: safeBottom - top} : {x: W * 0.04, y: top + headerH + gap * 0.5, w: W * 0.92, h: panelTop - gap - (top + headerH + gap * 0.5)};
  const rc = {x: region.x + region.w / 2, y: region.y + region.h / 2};

  const route = React.useMemo(() => {
    const pts = props.route.points;
    const raw = pts.length >= 3 ? traceRoute(pts) : rawRoute(props.route.shape, seed);
    return fitRoute(raw, region);
  }, [props.route.points, props.route.shape, seed, region.x, region.y, region.w, region.h]);
  const land = React.useMemo(() => terrain(seed, W, H), [seed, W, H]);

  // ---- timing: one checkpoint per narration line --------------------------------------------
  const cps = [...props.checkpoints].sort((a, b) => a.at - b.at);
  const N = cps.length;
  const total = Math.max(props.total, cps[N - 1].at);
  const fracs = cps.map(c => Math.min(1, Math.max(0, c.at / total)));
  const offset = timeline.length > N ? 1 : 0;
  const introEnd = offset ? timeline[1].from : 0;
  const lastSafe = Math.max(introEnd + N * 8, contentEnd - Math.round(0.5 * fps));
  const even = timeline.length < N + offset;
  const slotStart = (i: number) => Math.min(lastSafe - 6, even ? Math.round(introEnd + (i * (contentEnd - introEnd)) / N) : timeline[i + offset].from);
  const starts = cps.map((_, i) => slotStart(i));
  const ends = cps.map((_, i) => (i < N - 1 ? starts[i + 1] : contentEnd));
  const arrivals = cps.map((_, i) => {
    const len = ends[i] - starts[i];
    const travel = Math.max(10, Math.min(Math.round(0.68 * len), Math.round(4 * fps)));
    const prev = i ? fracs[i - 1] : 0;
    return fracs[i] - prev < 1e-4 ? starts[i] + 6 : Math.min(lastSafe, starts[i] + travel);
  });
  let dot = 0;
  for (let i = 0; i < N; i++) {
    if (frame >= starts[i]) dot = tween(frame, [starts[i], arrivals[i]], [i ? fracs[i - 1] : 0, fracs[i]], ease.cinematic);
  }
  const current = Math.max(0, starts.reduce((acc, s, i) => (frame >= s ? i : acc), -1));
  const finished = frame >= arrivals[N - 1] + 8;

  // ---- camera: follow the runner while tracing, overview for the intro and the finish ------
  const zMax = wide ? 1.45 : 1.6;
  const zoomIn = progress(frame, introEnd, Math.round(1.1 * fps), ease.cinematic);
  const zoomOut = progress(frame, arrivals[N - 1] + Math.round(0.3 * fps), Math.round(1.2 * fps), ease.cinematic);
  const z = 1 + (zMax - 1) * zoomIn * (1 - zoomOut) + 0.04 * progress(frame, 0, Math.max(1, introEnd), ease.cinematic) * (1 - zoomIn);
  const follow = (z - 1) / (zMax - 1);
  const head = route.at(dot);
  const focus = {x: rc.x + (head.x - rc.x) * Math.min(1, Math.max(0, follow)), y: rc.y + (head.y - rc.y) * Math.min(1, Math.max(0, follow))};
  const S = (p: Pt): Pt => ({x: (p.x - focus.x) * z + rc.x, y: (p.y - focus.y) * z + rc.y});

  // ---- elevation ----------------------------------------------------------------------------
  const known = cps.filter(c => typeof c.elevation === 'number') as Array<(typeof cps)[number] & {elevation: number}>;
  const elev = known.length >= 2 ? (f: number) => {
    const d = f * total;
    if (d <= known[0].at) return known[0].elevation;
    for (let i = 1; i < known.length; i++) {
      if (d <= known[i].at) {
        const t = (d - known[i - 1].at) / Math.max(1e-6, known[i].at - known[i - 1].at);
        return known[i - 1].elevation + (known[i].elevation - known[i - 1].elevation) * (0.5 - 0.5 * Math.cos(Math.PI * t));
      }
    }
    return known[known.length - 1].elevation;
  } : null;
  const unitLabel = props.unit === 'km' ? 'KM' : 'MI';
  const elevUnit = props.unit === 'km' ? 'M' : 'FT';
  const dec = total >= 100 ? 0 : 1;

  // ---- drawing ------------------------------------------------------------------------------
  const ghostDraw = progress(frame, 4, Math.max(24, Math.min(introEnd - 8, Math.round(1.8 * fps))), ease.cinematic);
  const ghost = route.upTo(ghostDraw).map(S);
  const done = route.upTo(dot).map(S);
  const headS = S(head);
  const pulse = (frame % 36) / 36;
  const headerIn = offset ? progress(frame, introEnd - 6, 18, ease.expo) : progress(frame, 0, 18, ease.expo);
  const panelIn = progress(frame, introEnd - 2, 20, ease.expo);
  const introOut = offset ? progress(frame, introEnd - 12, 12, ease.accelerate) : 1;
  const shadow = pal.light ? 'none' : '0 4px 24px rgba(0,0,0,.5)';
  const card = alpha(pal.surface, pal.light ? 0.92 : 0.86);

  return (
    <AbsoluteFill style={{background: pal.bg, overflow: 'hidden'}}>
      {/* map */}
      <AbsoluteFill style={{background: `radial-gradient(ellipse at ${(rc.x / W) * 100}% ${(rc.y / H) * 100}%, ${pal.bg2} 0%, ${pal.bg} 75%)`}} />
      <svg width={W} height={H} style={{position: 'absolute', inset: 0}}>
        <g transform={`translate(${rc.x} ${rc.y}) scale(${z}) translate(${-focus.x} ${-focus.y})`}>
          <path d={land.lake} fill={pal.water} stroke={alpha(pal.line, 0.12)} strokeWidth={2} vectorEffect="non-scaling-stroke" />
          {land.rings.map((d, i) => <path key={i} d={d} fill="none" stroke={pal.contour} strokeWidth={i % 7 === 6 ? 2.6 : 1.4} vectorEffect="non-scaling-stroke" />)}
          {land.roads.map((d, i) => <path key={i} d={d} fill="none" stroke={alpha(pal.line, pal.light ? 0.14 : 0.07)} strokeWidth={5 * u} strokeLinecap="round" vectorEffect="non-scaling-stroke" />)}
        </g>
        {/* the full course, drawn first as a dotted ghost */}
        <path d={pts2d(ghost)} fill="none" stroke={alpha(pal.line, pal.light ? 0.45 : 0.38)} strokeWidth={5 * u} strokeDasharray={`${2 * u} ${12 * u}`} strokeLinecap="round" strokeLinejoin="round" />
        {/* the travelled part: glow, body, highlight */}
        {done.length > 1 ? (
          <>
            <path d={pts2d(done)} fill="none" stroke={alpha(pal.accent, 0.22)} strokeWidth={26 * u} strokeLinecap="round" strokeLinejoin="round" />
            <path d={pts2d(done)} fill="none" stroke={pal.accent} strokeWidth={10 * u} strokeLinecap="round" strokeLinejoin="round" />
            <path d={pts2d(done)} fill="none" stroke={alpha('#ffffff', pal.light ? 0.45 : 0.35)} strokeWidth={2.5 * u} strokeLinecap="round" strokeLinejoin="round" />
          </>
        ) : null}
        {cps.map((c, i) => {
          const p = S(route.at(fracs[i]));
          const seen = progress(frame, Math.min(arrivals[i] - 4, 6 + Math.round((fracs[i] * Math.max(24, introEnd)) / 1.2)), 10, ease.overshoot);
          const hit = progress(frame, arrivals[i] - 2, 10, ease.overshoot);
          const r = 18 * u * (0.6 + 0.4 * seen) * (1 + 0.25 * hit * (1 - progress(frame, arrivals[i] + 8, 12)));
          return (
            <g key={i} opacity={Math.min(1, seen * 1.5)}>
              <circle cx={p.x} cy={p.y} r={r} fill={hit > 0.5 ? pal.accent : pal.bg} stroke={hit > 0.5 ? pal.bg : alpha(pal.line, 0.8)} strokeWidth={3 * u} />
              <text x={p.x} y={p.y + 7 * u} textAnchor="middle" fontFamily={fonts.condensed} fontWeight={800} fontSize={20 * u} fill={hit > 0.5 ? pal.bg : pal.text}>{i + 1}</text>
            </g>
          );
        })}
        {/* runner */}
        {frame >= starts[0] ? (
          <g>
            <circle cx={headS.x} cy={headS.y} r={16 * u + 34 * u * pulse} fill="none" stroke={pal.accent} strokeWidth={3 * u} opacity={1 - pulse} />
            <circle cx={headS.x} cy={headS.y} r={15 * u} fill={pal.light ? pal.text : '#ffffff'} stroke={pal.accent} strokeWidth={6 * u} />
          </g>
        ) : null}
      </svg>
      {/* map label for the checkpoint just reached */}
      {cps.map((c, i) => {
        if (frame < arrivals[i] - 2 || frame >= ends[i] + 6 || i !== current) return null;
        const p = S(route.at(fracs[i]));
        const pop = progress(frame, arrivals[i] - 2, 12, ease.overshoot);
        const out = i < N - 1 ? progress(frame, ends[i] - 6, 10) : 0;
        const below = p.y - 90 * u < region.y;
        return (
          <div key={i} style={{position: 'absolute', left: Math.min(region.x + region.w - 40 * u, Math.max(region.x + 40 * u, p.x)), top: p.y + (below ? 40 : -40) * u, transform: `translate(-50%, ${below ? 0 : -100}%) scale(${pop * (1 - out)})`, transformOrigin: below ? '50% 0%' : '50% 100%', background: pal.accent, color: pal.light ? '#ffffff' : '#0b0b0b', fontFamily: fonts.condensed, fontWeight: 800, fontSize: 30 * u, letterSpacing: '0.04em', textTransform: 'uppercase', padding: `${6 * u}px ${16 * u}px`, borderRadius: 8 * u, whiteSpace: 'nowrap', boxShadow: pal.light ? 'none' : '0 10px 30px rgba(0,0,0,.4)'}}>
            {c.label}
          </div>
        );
      })}
      <Vignette strength={0.55} />
      {/* panel scrim keeps the cards readable over terrain */}
      {!wide ? <AbsoluteFill style={{background: `linear-gradient(0deg, ${alpha(pal.bg, 0.95)} 0%, ${alpha(pal.bg, 0.85)} ${((H - panelTop + gap * 2) / H) * 100}%, transparent ${((H - panelTop + gap * 6) / H) * 100}%)`}} /> : (
        <AbsoluteFill style={{background: `linear-gradient(270deg, ${alpha(pal.bg, 0.94)} 0%, ${alpha(pal.bg, 0.8)} 40%, transparent 48%)`}} />
      )}

      {/* intro title over the overview */}
      {offset ? (
        <Sequence durationInFrames={introEnd}>
          <AbsoluteFill style={{justifyContent: 'center', alignItems: wide ? 'flex-start' : 'center', padding: wide ? `0 0 0 ${W * 0.6}px` : `0 8%`, opacity: 1 - introOut, transform: `translateY(${-introOut * 40 * u}px)`}}>
            <div style={{width: wide ? W * 0.35 : '100%', textAlign: wide ? 'left' : 'center', background: wide ? 'transparent' : alpha(pal.bg, 0.55), padding: wide ? 0 : `${30 * k}px ${24 * k}px`, borderRadius: 24 * k}}>
              {props.kicker ? <div style={{fontFamily: fonts.mono, color: ink, fontSize: 26 * k, letterSpacing: '0.3em', marginBottom: 18 * k, opacity: progress(frame, 2, 14), textTransform: 'uppercase'}}>{props.kicker}</div> : null}
              <KineticText text={props.title} start={6} stagger={4} style="rise" align={wide ? 'left' : 'center'} textStyle={{fontFamily: fonts.condensed, fontWeight: 800, color: pal.text, fontSize: (wide ? 96 : 118) * k, lineHeight: 0.98, textTransform: 'uppercase', letterSpacing: '-0.01em', textShadow: shadow}} />
              <div style={{marginTop: 22 * k, fontFamily: fonts.mono, color: pal.muted, fontSize: 28 * k, letterSpacing: '0.2em', opacity: progress(frame, 18, 16)}}>
                {total.toFixed(dec)} {unitLabel} · {N} CHECKPOINTS
              </div>
            </div>
          </AbsoluteFill>
        </Sequence>
      ) : null}

      {/* header */}
      <div style={{position: 'absolute', left: col.x, width: col.w, top, opacity: headerIn, transform: `translateY(${(1 - headerIn) * -24 * k}px)`}}>
        <div style={{display: 'flex', justifyContent: 'space-between', fontFamily: fonts.mono, fontSize: 22 * k, letterSpacing: '0.24em', color: pal.muted, textTransform: 'uppercase'}}>
          <span style={{color: ink}}>{props.kicker || 'ROUTE'}</span>
          <span>{total.toFixed(dec)} {unitLabel}</span>
        </div>
        <div style={{marginTop: 10 * k, fontFamily: fonts.condensed, fontWeight: 800, fontSize: (props.title.length > 26 ? 54 : 68) * k, lineHeight: 1, color: pal.text, textTransform: 'uppercase', textShadow: shadow}}>{props.title}</div>
        <div style={{marginTop: 14 * k, height: 3 * k, width: `${headerIn * 100}%`, background: `linear-gradient(90deg, ${pal.accent}, ${alpha(pal.accent, 0)})`}} />
      </div>

      {/* checkpoint cards */}
      <div style={{position: 'absolute', left: col.x, width: col.w, top: panelTop, height: cardH, opacity: panelIn}}>
        {cps.map((c, i) => {
          if (frame < starts[i] - 1 || frame >= ends[i] + 8) return null;
          const enter = progress(frame, starts[i], 18, ease.expo);
          const exit = i < N - 1 ? progress(frame, ends[i] - 2, 8, ease.accelerate) : 0;
          const hit = progress(frame, arrivals[i] - 2, 10, ease.overshoot);
          const draw = progress(frame, starts[i] + 4, 26, ease.cinematic);
          return (
            <div key={i} style={{position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', gap: 26 * k, background: card, borderRadius: 22 * k, borderLeft: `${7 * k}px solid ${pal.accent}`, padding: `0 ${28 * k}px`, clipPath: `inset(0 ${(1 - enter) * 100}% 0 0 round ${22 * k}px)`, transform: `translateY(${-exit * 40 * k}px)`, opacity: 1 - exit, boxShadow: pal.light ? `0 12px 40px ${alpha(pal.text, 0.12)}` : '0 20px 60px rgba(0,0,0,.45)'}}>
              <div style={{position: 'relative', width: 128 * k, height: 128 * k, flexShrink: 0, borderRadius: '50%', background: alpha(pal.accent, 0.12 + 0.1 * hit), display: 'flex', alignItems: 'center', justifyContent: 'center'}}>
                <LineIcon name={c.icon} progress={draw} size={84 * k} color={pal.accent} strokeWidth={4} />
                <div style={{position: 'absolute', right: -6 * k, top: -6 * k, width: 44 * k, height: 44 * k, borderRadius: '50%', background: hit > 0.5 ? pal.accent : pal.surface, border: `${3 * k}px solid ${pal.accent}`, color: hit > 0.5 ? (pal.light ? '#fff' : '#0b0b0b') : pal.text, fontFamily: fonts.condensed, fontWeight: 800, fontSize: 24 * k, display: 'flex', alignItems: 'center', justifyContent: 'center', transform: `scale(${1 + 0.3 * hit * (1 - progress(frame, arrivals[i] + 8, 10))})`}}>{i + 1}</div>
              </div>
              <div style={{flex: 1, minWidth: 0}}>
                <div style={{fontFamily: fonts.mono, fontSize: 22 * k, letterSpacing: '0.22em', color: ink, opacity: progress(frame, starts[i] + 4, 12)}}>
                  {unitLabel} {c.at.toFixed(dec)}{i === N - 1 && c.at >= total - 1e-6 ? ' · FINISH' : i === 0 && c.at === 0 ? ' · START' : ''}
                </div>
                <KineticText text={c.label} start={starts[i] + 6} stagger={3} style="rise" textStyle={{fontFamily: fonts.condensed, fontWeight: 800, fontSize: (c.label.length > 18 ? 48 : 58) * k, lineHeight: 1.02, color: pal.text, textTransform: 'uppercase', marginTop: 4 * k}} />
                {c.note ? <div style={{marginTop: 6 * k, fontFamily: fonts.sans, fontSize: 26 * k, lineHeight: 1.3, color: pal.muted, opacity: progress(frame, starts[i] + 16, 16), transform: `translateY(${(1 - progress(frame, starts[i] + 16, 16)) * 10 * k}px)`}}>{c.note}</div> : null}
              </div>
            </div>
          );
        })}
      </div>

      {/* live stats */}
      <div style={{position: 'absolute', left: col.x, width: col.w, top: panelTop + cardH + gap, height: statsH, display: 'flex', gap: 16 * k, opacity: panelIn, transform: `translateY(${(1 - panelIn) * 30 * k}px)`}}>
        {[
          {label: 'DISTANCE', value: (dot * total).toFixed(dec), unit: unitLabel, hot: finished},
          elev ? {label: 'ELEVATION', value: Math.round(elev(dot)).toLocaleString('en-US'), unit: elevUnit, hot: false} : {label: 'PROGRESS', value: String(Math.round(dot * 100)), unit: '%', hot: false},
          {label: 'CHECKPOINT', value: `${frame >= arrivals[current] - 2 ? current + 1 : current}`, unit: `/${N}`, hot: false},
        ].map(t => (
          <div key={t.label} style={{flex: 1, background: card, borderRadius: 18 * k, padding: `${14 * k}px ${20 * k}px`, display: 'flex', flexDirection: 'column', justifyContent: 'center', border: `1px solid ${alpha(pal.line, 0.1)}`}}>
            <div style={{fontFamily: fonts.mono, fontSize: 18 * k, letterSpacing: '0.22em', color: pal.muted}}>{t.label}</div>
            <div style={{fontFamily: fonts.condensed, fontWeight: 800, fontSize: (wide ? 54 : 62) * k, lineHeight: 1.05, color: t.hot ? pal.accent : pal.text, fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap'}}>
              {t.value}
              <span style={{fontSize: 26 * k, color: pal.muted, marginLeft: 6 * k}}>{t.unit}</span>
            </div>
          </div>
        ))}
      </div>

      {/* elevation / progress strip */}
      <ProfileStrip x={col.x} y={panelTop + cardH + statsH + gap * 2} w={col.w} h={stripH} k={k} pal={pal} fracs={fracs} dot={dot} elev={elev} reveal={panelIn} frame={frame} arrivals={arrivals} />

      <LightLeak from={0} durationInFrames={Math.round(2.2 * fps)} seed={7} opacity={pal.light ? 0.25 : 0.45} />
      <LightLeak from={arrivals[N - 1] - 4} durationInFrames={Math.round(1.6 * fps)} seed={11} hueShift={pal.light ? 0 : 340} opacity={pal.light ? 0.2 : 0.4} />

      {props.showCaptions
        ? timeline.map(t => (
            <Sequence key={t.index} from={t.from} durationInFrames={t.durationInFrames}>
              <AbsoluteFill style={{justifyContent: 'flex-end', padding: wide ? '0 14% 4.5%' : '0 7% 6%'}}>
                <StyledCaptions scene={t.scene} variant="box" accent={pal.accent} color={pal.text} font={fonts.condensed} size={(wide ? 50 : 58) * u} words={wide ? 6 : 4} uppercase shadow={!pal.light} />
              </AbsoluteFill>
            </Sequence>
          ))
        : null}
      <Grain opacity={pal.light ? 0.04 : 0.07} />
      <NarrationTrack media={media} />
      <AdWeave media={media} theme={{background: pal.bg, text: pal.text, font: fonts.condensed}} />
    </AbsoluteFill>
  );
};

/** Elevation area (when data exists) or a plain progress rail, with checkpoint ticks and a live cursor. */
const ProfileStrip: React.FC<{x: number; y: number; w: number; h: number; k: number; pal: Pal; fracs: number[]; dot: number; elev: ((f: number) => number) | null; reveal: number; frame: number; arrivals: number[]}> = ({x, y, w, h, k, pal, fracs, dot, elev, reveal, frame, arrivals}) => {
  const padT = 26 * k;
  const base = h - 22 * k;
  const samples = 90;
  let ys: number[] = [];
  if (elev) {
    const vals = Array.from({length: samples + 1}, (_, i) => elev(i / samples));
    const lo = Math.min(...vals);
    const hi = Math.max(...vals);
    ys = vals.map(v => base - ((v - lo) / Math.max(1e-6, hi - lo)) * (base - padT) * 0.9 - (base - padT) * 0.05);
  }
  const line = elev ? ys.map((yy, i) => `${i ? 'L' : 'M'}${((i / samples) * w).toFixed(1)},${yy.toFixed(1)}`).join(' ') : `M0,${base - 14 * k} L${w},${base - 14 * k}`;
  const area = `${line} L${w},${base} L0,${base} Z`;
  const cx = dot * w;
  const cy = elev ? ys[Math.round(dot * samples)] : base - 14 * k;
  const id = 'route-trace-clip';
  return (
    <svg width={w} height={h} style={{position: 'absolute', left: x, top: y, overflow: 'visible', opacity: reveal}}>
      <defs>
        <clipPath id={id}>
          <rect x={0} y={0} width={Math.max(0, cx)} height={h} />
        </clipPath>
        <linearGradient id={`${id}-g`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={pal.accent} stopOpacity={0.55} />
          <stop offset="100%" stopColor={pal.accent} stopOpacity={0.05} />
        </linearGradient>
      </defs>
      <text x={0} y={14 * k} fontFamily={fonts.mono} fontSize={17 * k} letterSpacing="0.22em" fill={pal.muted}>{elev ? 'ELEVATION PROFILE' : 'COURSE PROGRESS'}</text>
      <path d={area} fill={alpha(pal.line, 0.07)} />
      <path d={line} fill="none" stroke={alpha(pal.line, 0.35)} strokeWidth={3 * k} strokeLinejoin="round" />
      <g clipPath={`url(#${id})`}>
        <path d={area} fill={`url(#${id}-g)`} />
        <path d={line} fill="none" stroke={pal.accent} strokeWidth={5 * k} strokeLinejoin="round" strokeLinecap="round" />
      </g>
      {fracs.map((f, i) => {
        const hit = frame >= arrivals[i] - 2;
        return (
          <g key={i}>
            <line x1={f * w} x2={f * w} y1={base + 4 * k} y2={base + 14 * k} stroke={hit ? pal.accent : alpha(pal.line, 0.4)} strokeWidth={3 * k} />
            {/* a label too close to the next one would collide; the next one carries it */}
            {i < fracs.length - 1 && fracs[i + 1] - f < 0.05 ? null : <text x={Math.min(w - 8 * k, Math.max(8 * k, f * w))} y={h + 10 * k} textAnchor="middle" fontFamily={fonts.condensed} fontWeight={800} fontSize={18 * k} fill={hit ? (pal.light ? mix(pal.accent, pal.text, 0.55) : pal.accent) : pal.muted}>{i + 1}</text>}
          </g>
        );
      })}
      <line x1={cx} x2={cx} y1={padT} y2={base} stroke={alpha(pal.text, 0.5)} strokeWidth={1.5 * k} strokeDasharray={`${4 * k} ${5 * k}`} />
      <circle cx={cx} cy={cy} r={9 * k} fill={pal.light ? pal.text : '#ffffff'} stroke={pal.accent} strokeWidth={4 * k} />
    </svg>
  );
};

export default defineEntry({id: 'explainer-route-trace', schema: Props, component: RouteTrace});
