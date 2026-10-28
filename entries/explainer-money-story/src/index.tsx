import React from 'react';
import {AbsoluteFill, Sequence, useCurrentFrame, useVideoConfig} from 'remotion';
import {AdWeave, NarrationTrack, captionSafeBottom, defineEntry, mix, useContentFrames, useLook, useSceneTimeline, type ActiveLook, type EntryProps} from '@viralaunch/kit';
import {Grain, GridLines, KineticText, LightLeak, LineIcon, Particles, StyledCaptions, Vignette, alpha, countUp, ease, fonts, progress, rand, tween, type Widen} from '@viralaunch/kit/fx';
import {Props} from './schema';

const PALETTES = {
  amber: {bg: '#0d0a06', bg2: '#22180b', surface: '#17110a', text: '#f6ead6', muted: '#a8977c', accent: '#f7a531', down: '#e2553d', line: '#f6ead6', light: false},
  ledger: {bg: '#f4efe4', bg2: '#e4d9c3', surface: '#fffaf0', text: '#1f1b16', muted: '#7d7363', accent: '#1f7a4d', down: '#c2412d', line: '#1f1b16', light: true},
  mint: {bg: '#04130e', bg2: '#0b2a20', surface: '#0a1f18', text: '#e8fff5', muted: '#86b8a5', accent: '#3ee08f', down: '#ff6b6b', line: '#e8fff5', light: false},
  midnight: {bg: '#070a1a', bg2: '#1c2350', surface: '#121733', text: '#f2f4ff', muted: '#9aa3c7', accent: '#6cf2ff', down: '#ff5d8f', line: '#dfe5ff', light: false},
} as const;
type Pal = Widen<(typeof PALETTES)[keyof typeof PALETTES]>;

/** The story in a sequence's shared look: background, surfaces, ink and accent from the look. */
const fromLook = (l: ActiveLook): Pal => ({
  bg: l.palette.bg,
  bg2: l.palette.bg2,
  surface: l.palette.surface,
  text: l.palette.text,
  muted: l.palette.muted,
  accent: l.palette.accent,
  down: mix(l.palette.accent, l.tone === 'light' ? '#b8321f' : '#ef5a43', 0.8),
  line: l.palette.line,
  light: l.tone === 'light',
});

/** Sub-points per segment between two beats: the line wanders like a real price, landing exactly on each beat. */
const STEPS = 18;

type Pt = {x: number; y: number};

/** Relative brightness 0..1 of a #rrggbb colour. */
const luma = (hex: string) => {
  const n = parseInt(hex.slice(1, 7), 16);
  return (0.299 * ((n >> 16) & 255) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255)) / 255;
};
/** Readable text colour on a solid fill. */
const onFill = (hex: string) => (luma(hex) > 0.55 ? '#16130f' : '#ffffff');

const MoneyStory: React.FC<EntryProps<Props>> = ({media, props}) => {
  const frame = useCurrentFrame();
  const {fps, width, height} = useVideoConfig();
  const look = useLook();
  const pal: Pal = look ? fromLook(look) : {...PALETTES[props.palette], accent: media.accent ?? PALETTES[props.palette].accent};
  // Accent for text: darkened on light grounds so pale accents (gold, yellow) stay readable.
  const ink = pal.light && luma(pal.accent) > 0.45 ? mix(pal.accent, pal.text, 0.45) : pal.accent;
  const u = Math.min(width, height) / 1080;
  const side = width / height >= 1.2;
  const timeline = useSceneTimeline(media);
  const contentEnd = useContentFrames(media);
  const {beats, metric} = props;
  const n = beats.length;

  // --- Timing: beats follow the narration scenes (scene 0 is the title when there is one extra).
  const offset = timeline.length > n ? 1 : 0;
  const introEnd = offset ? timeline[1].from : Math.min(Math.round(1.5 * fps), Math.floor(contentEnd * 0.15));
  const matched = timeline.length - offset >= n;
  const evenStart = (i: number) => introEnd + Math.round((i * (contentEnd - introEnd)) / n);
  const beatStart = (i: number) => Math.min(contentEnd - fps, i === 0 ? introEnd : matched ? timeline[i + offset].from : evenStart(i));
  const beatEnd = (i: number) => (i === n - 1 ? contentEnd : beatStart(i + 1));
  const travel = (i: number) => Math.max(8, Math.min(Math.round(1.1 * fps), Math.round((beatEnd(i) - beatStart(i)) * 0.55)));
  let cur = -1;
  for (let i = 0; i < n; i++) if (frame >= beatStart(i)) cur = i;
  const lastStart = beatStart(n - 1);
  const takeStart = props.takeaway ? Math.min(contentEnd - Math.round(1.6 * fps), lastStart + Math.max(Math.round(1.4 * fps), Math.round((contentEnd - lastStart) * 0.45))) : Infinity;
  const showTake = props.takeaway && takeStart > lastStart + travel(n - 1);

  // --- Layout: side-by-side on wide frames, stacked on tall/square ones; key content stays above the caption zone.
  const bottomLimit = height * (look ? 1 - captionSafeBottom(look) : props.showCaptions ? (side ? 0.85 : 0.84) : 0.94);
  const top = height * (side ? 0.15 : 0.085);
  const colX = width * (side ? 0.06 : 0.07);
  const colW = side ? width * 0.33 : width * 0.86;
  const chipRow = 64 * u;
  const sourceRow = props.source ? 34 * u : 0;
  const chart = side
    ? {x: width * 0.44, y: top + 30 * u, w: width * 0.5 - 100 * u, h: 0}
    : {x: width * 0.07, y: top + (look ? 600 : 640) * u, w: width * 0.86 - 100 * u, h: 0};
  chart.h = Math.max(160 * u, bottomLimit - chipRow - sourceRow - chart.y);
  const numberTop = side ? Math.max(top + 360 * u, chart.y + chart.h - 170 * u) : top + 440 * u;

  // --- Chart geometry.
  const values = beats.map(b => b.value);
  const lo = Math.min(...values);
  const hi = Math.max(...values);
  const range = hi - lo || Math.abs(hi) || 1;
  const yMin = lo - range * 0.12;
  const yMax = hi + range * 0.18;
  const inset = chart.w * 0.06;
  const bx = (i: number) => chart.x + inset + (n === 1 ? 0 : (i * (chart.w - inset * 2)) / (n - 1));
  const by = (v: number) => chart.y + chart.h - ((v - yMin) / (yMax - yMin)) * chart.h;
  const segments: Pt[][] = beats.slice(1).map((b, k) => {
    const a = values[k];
    const amp = range * 0.07;
    return Array.from({length: STEPS + 1}, (_, j) => {
      const t = j / STEPS;
      const s = t * t * (3 - 2 * t);
      const wander = Math.sin(Math.PI * t) * amp * (rand(`ms${k}-${j}`) - 0.5) * 2;
      return {x: bx(k) + (bx(k + 1) - bx(k)) * t, y: by(a + (b.value - a) * s + wander)};
    });
  });
  // How far along each segment the line has been drawn (0..1).
  const segDone = (k: number) => progress(frame, beatStart(k + 1), travel(k + 1), ease.cinematic);
  const head: Pt = (() => {
    if (cur <= 0) return {x: bx(0), y: by(values[0])};
    const seg = segments[cur - 1];
    const f = segDone(cur - 1) * STEPS;
    const j = Math.min(STEPS - 1, Math.floor(f));
    const r = f - j;
    return {x: seg[j].x + (seg[j + 1].x - seg[j].x) * r, y: seg[j].y + (seg[j + 1].y - seg[j].y) * r};
  })();
  const partial = (k: number) => {
    const f = segDone(k) * STEPS;
    if (f <= 0) return [] as Pt[];
    const seg = segments[k];
    const j = Math.min(STEPS - 1, Math.floor(f));
    const pts = seg.slice(0, j + 1);
    const r = f - j;
    pts.push({x: seg[j].x + (seg[j + 1].x - seg[j].x) * r, y: seg[j].y + (seg[j + 1].y - seg[j].y) * r});
    return pts;
  };
  const drawn = segments.map((_, k) => partial(k));
  const flat = [{x: bx(0), y: by(values[0])}, ...drawn.flatMap(p => p.slice(1))];
  const toD = (pts: Pt[]) => pts.map((p, i) => `${i ? 'L' : 'M'}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');
  const base = chart.y + chart.h;
  const areaD = flat.length > 1 ? `${toD(flat)} L${flat[flat.length - 1].x.toFixed(1)},${base} L${flat[0].x.toFixed(1)},${base} Z` : '';
  const goingDown = cur > 0 && values[cur] < values[cur - 1];
  const headColor = goingDown ? pal.down : pal.accent;
  const landed = cur >= 0 ? progress(frame, beatStart(cur) + travel(cur), 12, ease.expo) : 0;
  const chartIn = progress(frame, introEnd - 10, 22, ease.cinematic);
  const introOut = progress(frame, introEnd - 12, 14, ease.accelerate);
  const fmt = (v: string) => `${metric.prefix}${v}${metric.suffix}`;
  const fmtNum = (v: number) => fmt(v.toLocaleString('en-US', {minimumFractionDigits: metric.decimals, maximumFractionDigits: metric.decimals}));

  // Camera: the chart drifts toward the line's head and gives a small bump as each beat lands.
  const bump = cur > 0 ? Math.sin(Math.PI * Math.min(1, landed)) * 0.012 : 0;
  const camX = -(head.x - (chart.x + chart.w / 2)) * 0.035;
  const camScale = tween(frame, [introEnd, contentEnd], [1, 1.035], ease.cinematic) + bump;

  // Delta vs the previous beat, shown once the line lands.
  const delta = cur > 0 ? (() => {
    const a = values[cur - 1];
    const b = values[cur];
    if (a === 0) return '';
    const ratio = b / a;
    if (ratio >= 10) return `x${ratio.toFixed(ratio >= 100 ? 0 : 1)}`;
    const pct = ((b - a) / Math.abs(a)) * 100;
    return `${pct >= 0 ? '+' : ''}${pct.toLocaleString('en-US', {maximumFractionDigits: Math.abs(pct) < 10 ? 1 : 0})}%`;
  })() : '';

  // Round axis ticks (1/2/2.5/5 × 10^k) inside the visible range.
  const rawStep = (yMax - yMin) / 4;
  const mag = Math.pow(10, Math.floor(Math.log10(rawStep)));
  const step = ([1, 2, 2.5, 5, 10].find(m => m * mag >= rawStep) ?? 10) * mag;
  const gridVals = Array.from({length: 6}, (_, i) => (Math.ceil(yMin / step) + i) * step).filter(v => v > yMin + step * 0.2 && v < yMax);
  const lineGlow = pal.light ? 'none' : `drop-shadow(0 0 ${6 * u}px ${alpha(pal.accent, 0.8)}) drop-shadow(0 0 ${20 * u}px ${alpha(pal.accent, 0.35)})`;
  const headSize = 30 * u;
  const titleSize = Math.min((side ? 92 : 104) * u, (width * 1.5) / Math.max(12, props.title.length));
  const headlineSize = (len: number) => (side ? 70 : 76) * u * (len > 46 ? 0.8 : len > 30 ? 0.9 : 1);

  return (
    <AbsoluteFill style={{background: `radial-gradient(ellipse 90% 70% at 70% 40%, ${pal.bg2} 0%, ${pal.bg} 70%)`, overflow: 'hidden', color: pal.text}}>
      <GridLines color={pal.line} step={Math.round(54 * u)} opacity={pal.light ? 0.08 : 0.05} drift={0.15} dots />
      <Particles count={36} color={pal.accent} opacity={pal.light ? 0.18 : 0.35} seed="coins" speed={0.35} size={[1.5, 4.5]} />

      {/* Header: title + what the line measures */}
      <div style={{position: 'absolute', left: colX, right: width * (side ? 0.06 : 0.07), top: height * (side ? 0.06 : 0.04), display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 30 * u, fontFamily: fonts.mono, fontSize: 22 * u, letterSpacing: '0.22em', textTransform: 'uppercase', opacity: chartIn}}>
        <span style={{color: pal.text, opacity: 0.85, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis'}}>{props.title}</span>
        {metric.label && side ? <span style={{color: ink, whiteSpace: 'nowrap'}}>{metric.label}</span> : null}
      </div>
      <div style={{position: 'absolute', left: colX, top: height * (side ? 0.06 : 0.04) + 40 * u, height: 2, width: (width - colX * 2) * chartIn, background: alpha(pal.text, 0.15)}} />

      {/* The value line */}
      <AbsoluteFill style={{opacity: chartIn, transform: `translateX(${camX}px) scale(${camScale})`, transformOrigin: `${chart.x + chart.w / 2}px ${chart.y + chart.h / 2}px`}}>
        <svg width={width} height={height} style={{position: 'absolute', inset: 0, overflow: 'visible'}}>
          <defs>
            <linearGradient id="ms-area" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={headColor} stopOpacity={pal.light ? 0.22 : 0.3} />
              <stop offset="100%" stopColor={headColor} stopOpacity={0} />
            </linearGradient>
          </defs>
          {gridVals.map((v, i) => (
            <g key={i} opacity={progress(frame, introEnd - 6 + i * 4, 16)}>
              <line x1={chart.x} x2={chart.x + chart.w} y1={by(v)} y2={by(v)} stroke={pal.line} strokeOpacity={0.1} strokeDasharray={`${4 * u} ${8 * u}`} />
              <text x={chart.x + chart.w + 14 * u} y={by(v) + 6 * u} textAnchor="start" fill={pal.muted} fontFamily={fonts.mono} fontSize={18 * u}>{fmtNum(v)}</text>
            </g>
          ))}
          <line x1={chart.x} x2={chart.x + chart.w * chartIn} y1={base} y2={base} stroke={pal.line} strokeOpacity={0.35} strokeWidth={2} />
          {areaD ? <path d={areaD} fill="url(#ms-area)" /> : null}
          {drawn.map((pts, k) =>
            pts.length > 1 ? <path key={k} d={toD(pts)} fill="none" stroke={values[k + 1] < values[k] ? pal.down : pal.accent} strokeWidth={4.5 * u} strokeLinejoin="round" strokeLinecap="round" style={{filter: lineGlow}} /> : null,
          )}
          {/* Past beat markers */}
          {beats.map((b, i) => {
            if (i >= cur || cur < 0) return null;
            return <circle key={i} cx={bx(i)} cy={by(b.value)} r={7 * u} fill={pal.bg} stroke={pal.text} strokeOpacity={0.7} strokeWidth={2.5 * u} />;
          })}
          {/* Vertical drop line from the head to the axis */}
          {cur >= 0 ? <line x1={head.x} x2={head.x} y1={head.y + headSize * 0.6} y2={base} stroke={headColor} strokeOpacity={0.35} strokeWidth={2} strokeDasharray={`${3 * u} ${6 * u}`} /> : null}
        </svg>
        {cur >= 0 ? (
          <>
            {/* Landing pulse */}
            <div style={{position: 'absolute', left: head.x - headSize * 2.5, top: head.y - headSize * 2.5, width: headSize * 5, height: headSize * 5, borderRadius: '50%', border: `${2 * u}px solid ${headColor}`, transform: `scale(${0.2 + 0.8 * landed})`, opacity: (1 - landed) * 0.9}} />
            <div style={{position: 'absolute', left: head.x - headSize / 2, top: head.y - headSize / 2, width: headSize, height: headSize, borderRadius: '50%', background: headColor, boxShadow: pal.light ? `0 0 0 ${6 * u}px ${alpha(headColor, 0.18)}` : `0 0 ${18 * u}px ${headColor}, 0 0 ${50 * u}px ${alpha(headColor, 0.6)}`, transform: `scale(${0.85 + 0.15 * Math.sin(frame / 5)})`}} />
            {/* Tag pinned to the current point */}
            {(() => {
              const b = beats[cur];
              const text = b.note || fmtNum(b.value);
              const above = head.y > chart.y + chart.h * 0.35;
              const tagW = Math.min(chart.w * 0.6, (text.length * 15 + 44) * u);
              const left = Math.max(chart.x - 20 * u, Math.min(chart.x + chart.w - tagW + 20 * u, head.x - tagW / 2));
              const pop = progress(frame, beatStart(cur) + travel(cur) - 2, 14, ease.overshoot);
              return (
                <div style={{position: 'absolute', left, top: above ? head.y - 96 * u : head.y + 46 * u, width: tagW, textAlign: 'center', fontFamily: fonts.mono, fontSize: 24 * u, fontWeight: 700, letterSpacing: '0.04em', color: onFill(headColor), background: headColor, borderRadius: 10 * u, padding: `${10 * u}px 0`, transform: `translateY(${(1 - pop) * (above ? 16 : -16) * u}px) scale(${0.7 + 0.3 * pop})`, opacity: Math.min(1, pop * 1.5), whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', boxShadow: `0 ${10 * u}px ${30 * u}px ${alpha('#000000', pal.light ? 0.12 : 0.4)}`}}>
                  {text}
                </div>
              );
            })()}
          </>
        ) : null}
        {/* Axis chips: one per beat, the current one lit */}
        {beats.map((b, i) => {
          const appear = progress(frame, introEnd + i * 3, 14, ease.snappy);
          const on = i === cur;
          const past = i < cur;
          const lit = on ? progress(frame, beatStart(i), 10) : 0;
          return (
            <div key={i} style={{position: 'absolute', left: bx(i) - 90 * u, width: 180 * u, top: base + 16 * u, display: 'flex', justifyContent: 'center', opacity: appear * (on || past ? 1 : 0.45), transform: `translateY(${(1 - appear) * 20 * u}px)`}}>
              <div style={{fontFamily: fonts.mono, fontSize: 21 * u, fontWeight: 700, letterSpacing: '0.06em', padding: `${6 * u}px ${12 * u}px`, borderRadius: 8 * u, border: `${1.5 * u}px solid ${on ? pal.accent : alpha(pal.text, 0.25)}`, background: on ? alpha(pal.accent, lit) : 'transparent', color: on && lit > 0.5 ? onFill(pal.accent) : pal.text, whiteSpace: 'nowrap', boxShadow: on && !pal.light ? `0 0 ${24 * u * lit}px ${alpha(pal.accent, 0.55)}` : 'none'}}>
                {b.label}
              </div>
            </div>
          );
        })}
      </AbsoluteFill>
      {props.source ? <div style={{position: 'absolute', right: width - chart.x - chart.w, top: base + chipRow + 6 * u, fontFamily: fonts.mono, fontSize: 17 * u, letterSpacing: '0.12em', textTransform: 'uppercase', color: pal.muted, opacity: chartIn}}>Source: {props.source}</div> : null}

      {/* Story column: icon + marker, headline per beat */}
      {beats.map((b, i) => {
        const s = beatStart(i);
        const e = i === n - 1 ? (showTake ? takeStart : Infinity) : beatEnd(i);
        if (frame < s - 2 || frame > e + 14) return null;
        const local = frame - s;
        const out = frame > e - 6 ? progress(frame, e - 6, 14, ease.accelerate) : 0;
        const enter = progress(frame, s, 16, ease.expo);
        const draw = tween(local, [2, 34], [0, 1], ease.cinematic);
        return (
          <div key={i} style={{position: 'absolute', left: colX, top, width: colW, opacity: 1 - out, transform: `translateY(${-out * 40 * u}px)`}}>
            <div style={{display: 'flex', alignItems: 'center', gap: 26 * u, height: 130 * u}}>
              <div style={{position: 'relative', width: 120 * u, height: 120 * u, borderRadius: 26 * u, background: pal.surface, border: `${1.5 * u}px solid ${alpha(pal.accent, 0.45)}`, display: 'flex', alignItems: 'center', justifyContent: 'center', transform: `scale(${0.6 + 0.4 * enter}) rotate(${(1 - enter) * -12}deg)`, opacity: enter, boxShadow: pal.light ? `0 ${12 * u}px ${30 * u}px rgba(0,0,0,.08)` : `0 0 ${40 * u}px ${alpha(pal.accent, 0.18)}`}}>
                <LineIcon name={b.icon} progress={draw} size={78 * u} color={ink} strokeWidth={4} />
              </div>
              <div style={{fontFamily: fonts.mono, color: ink, opacity: enter}}>
                <div style={{fontSize: 46 * u, fontWeight: 700, letterSpacing: `${0.02 + (1 - enter) * 0.3}em`, lineHeight: 1}}>{b.label}</div>
                <div style={{fontSize: 18 * u, letterSpacing: '0.24em', color: pal.muted, marginTop: 10 * u}}>
                  {String(i + 1).padStart(2, '0')} / {String(n).padStart(2, '0')}
                </div>
              </div>
            </div>
            <div style={{marginTop: 34 * u}}>
              <KineticText text={b.headline} start={s + 6} stagger={3} duration={20} style="rise" accent={ink} textStyle={{fontFamily: fonts.serifDisplay, fontSize: headlineSize(b.headline.length), lineHeight: 1.08, letterSpacing: '-0.01em', color: pal.text}} />
            </div>
          </div>
        );
      })}

      {/* Closing takeaway replaces the last headline */}
      {showTake ? (
        <div style={{position: 'absolute', left: colX, top: top + 20 * u, width: colW}}>
          <div style={{fontFamily: fonts.mono, fontSize: 22 * u, letterSpacing: '0.3em', color: ink, opacity: progress(frame, takeStart, 12), marginBottom: 24 * u}}>THE TAKEAWAY</div>
          <div style={{width: 140 * u * progress(frame, takeStart + 4, 20, ease.expo), height: 3 * u, background: pal.accent, marginBottom: 30 * u}} />
          <KineticText text={props.takeaway} start={takeStart + 6} stagger={3} duration={22} style="blur" accent={ink} textStyle={{fontFamily: fonts.serifDisplay, fontSize: headlineSize(props.takeaway.length) * 1.05, lineHeight: 1.08, color: pal.text}} />
        </div>
      ) : null}

      {/* The tracked number, counting between beats */}
      {cur >= 0 ? (
        <div style={{position: 'absolute', left: colX, top: numberTop, width: colW, opacity: progress(frame, beatStart(0), 14)}}>
          <div style={{fontFamily: fonts.mono, fontSize: 19 * u, letterSpacing: '0.22em', textTransform: 'uppercase', color: pal.muted, marginBottom: 10 * u, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis'}}>{metric.label || 'Value'}</div>
          <div style={{display: 'flex', alignItems: 'center', gap: 24 * u}}>
            <div style={{fontFamily: fonts.mono, fontWeight: 700, fontSize: (side ? 96 : 104) * u, lineHeight: 1, letterSpacing: '-0.03em', color: pal.text, textShadow: pal.light ? 'none' : `0 0 ${30 * u}px ${alpha(headColor, 0.35)}`}}>
              {fmt(countUp(frame, values[cur], beatStart(cur), travel(cur), metric.decimals, cur > 0 ? values[cur - 1] : 0))}
            </div>
            {delta ? (
              <div style={{display: 'flex', alignItems: 'center', gap: 8 * u, fontFamily: fonts.mono, fontWeight: 700, fontSize: 28 * u, color: goingDown ? pal.down : ink, padding: `${8 * u}px ${14 * u}px`, borderRadius: 10 * u, background: alpha(headColor, 0.14), opacity: landed, transform: `translateX(${(1 - landed) * -20 * u}px)`}}>
                <svg width={18 * u} height={18 * u} viewBox="0 0 10 10" style={{transform: goingDown ? 'rotate(180deg)' : undefined}}>
                  <path d="M5 1 L9.5 9 L0.5 9 Z" fill={headColor} />
                </svg>
                {delta}
              </div>
            ) : null}
          </div>
        </div>
      ) : null}

      {/* Opening title: a typed dateline over the story title */}
      {frame < introEnd + 4 ? (
        <AbsoluteFill style={{justifyContent: 'center', alignItems: 'center', padding: '0 9%', opacity: 1 - introOut, transform: `scale(${1 + introOut * 0.12})`, filter: `blur(${introOut * 8}px)`}}>
          {metric.label ? (
            <KineticText text={metric.label} start={4} stagger={3} style="type" align="center" textStyle={{fontFamily: fonts.mono, fontSize: 30 * u, letterSpacing: '0.08em', color: ink, marginBottom: 34 * u}} />
          ) : null}
          <KineticText text={props.title} start={10} stagger={4} duration={24} style="blur" align="center" accent={ink} textStyle={{fontFamily: fonts.serifDisplay, fontSize: titleSize, lineHeight: 1.05, color: pal.text, maxWidth: width * 0.82}} />
          <div style={{width: 220 * u * progress(frame, 18, 30, ease.expo), height: 2 * u, background: pal.accent, marginTop: 40 * u, boxShadow: pal.light ? 'none' : `0 0 ${16 * u}px ${pal.accent}`}} />
        </AbsoluteFill>
      ) : null}

      {/* Light leaks on each beat (softer on light palettes) */}
      {beats.map((_, i) => (
        <LightLeak key={i} from={Math.max(0, beatStart(i) - 6)} durationInFrames={Math.round(1.2 * fps)} seed={i * 7 + 3} opacity={pal.light ? 0.12 : 0.3} />
      ))}

      {props.showCaptions
        ? timeline.map(t => (
            <Sequence key={t.index} from={t.from} durationInFrames={t.durationInFrames}>
              <AbsoluteFill style={{justifyContent: 'flex-end', padding: side ? '0 16% 4%' : '0 7% 6%'}}>
                <StyledCaptions scene={t.scene} variant="pop" accent={ink} color={pal.text} font={fonts.sans} size={(side ? 46 : 54) * u} words={side ? 6 : 4} weight={800} shadow={!pal.light} />
              </AbsoluteFill>
            </Sequence>
          ))
        : null}
      <Vignette strength={pal.light ? 0.18 : 0.6} />
      <Grain opacity={pal.light ? 0.04 : 0.07} />
      <NarrationTrack media={media} />
      <AdWeave media={media} theme={{background: pal.bg, text: pal.text, font: fonts.sans}} />
    </AbsoluteFill>
  );
};

export default defineEntry({id: 'explainer-money-story', schema: Props, component: MoneyStory});
