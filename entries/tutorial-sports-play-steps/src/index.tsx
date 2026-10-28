import React from 'react';
import {AbsoluteFill, Sequence, useCurrentFrame, useVideoConfig} from 'remotion';
import {AdWeave, NarrationTrack, captionSafeBottom, defineEntry, mix, useContentFrames, useLook, useSceneTimeline, type ActiveLook, type EntryProps} from '@viralaunch/kit';
import {GridLines, Grain, KineticText, LightLeak, LineIcon, Particles, StyledCaptions, Vignette, alpha, ease, fonts, progress, rand, type Widen} from '@viralaunch/kit/fx';
import {Props} from './schema';

const PALETTES = {
  clean: {tone: 'light', bg: '#f7f8f5', bg2: '#e3eee0', surface: '#ffffff', text: '#111513', muted: '#6b736e', accent: '#1f63ff', line: '#111513', pitch: '#eef4ec', pitchLine: '#a9bfae', dots: '#8fc79c'},
  night: {tone: 'dark', bg: '#08140e', bg2: '#123222', surface: '#0e2018', text: '#eef7f1', muted: '#93ab9d', accent: '#7cd8ff', line: '#eef7f1', pitch: '#11301f', pitchLine: '#4f7a62', dots: '#3c8a5d'},
  court: {tone: 'light', bg: '#f6efe4', bg2: '#ecdcc2', surface: '#fffaf2', text: '#2a1d12', muted: '#8a7560', accent: '#e8590c', line: '#2a1d12', pitch: '#e7c697', pitchLine: '#b07f45', dots: '#d9a86a'},
} as const;
type Pal = Widen<(typeof PALETTES)[keyof typeof PALETTES]>;

/** The board in a sequence's shared look: background, surfaces, lines and accent from the look. */
const fromLook = (l: ActiveLook): Pal => ({
  tone: l.tone,
  bg: l.palette.bg,
  bg2: l.palette.bg2,
  surface: l.palette.surface,
  text: l.palette.text,
  muted: l.palette.muted,
  accent: l.palette.accent,
  line: l.palette.line,
  pitch: mix(l.palette.surface, l.palette.bg2, 0.55),
  pitchLine: mix(l.palette.line, l.palette.surface, 0.55),
  dots: mix(l.palette.bg, l.palette.accent, 0.35),
});

/** Dark or light ink that reads on a filled colour. */
const inkOn = (hex: string) => {
  const n = parseInt(hex.slice(1, 7), 16);
  return (0.299 * ((n >> 16) & 255) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255)) / 255 > 0.6 ? '#0d0f12' : '#ffffff';
};

const GOAL: Record<Props['field'], Pt> = {basketball: {x: 50, y: 11}, soccer: {x: 50, y: 2.5}, 'american-football': {x: 50, y: 7}, plain: {x: 50, y: 4}};
const FIELD_NAME: Record<Props['field'], string> = {basketball: 'Half court', soccer: 'Attacking half', 'american-football': 'Red zone', plain: 'Tactics board'};

// ---------------------------------------------------------------------------------------------
// Geometry: every movement is a gentle curve (runs) or a wave along that curve (dribbles).
// ---------------------------------------------------------------------------------------------

type Pt = {x: number; y: number};
type PathFn = (t: number) => Pt;

function curve(a: Pt, b: Pt, bend: number, wavy: boolean): PathFn {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len = Math.max(0.001, Math.hypot(dx, dy));
  const nx = -dy / len;
  const ny = dx / len;
  const c = {x: (a.x + b.x) / 2 + nx * len * 0.16 * bend, y: (a.y + b.y) / 2 + ny * len * 0.16 * bend};
  const waves = Math.max(2, Math.round(len / 7));
  return t => {
    const m = 1 - t;
    const x = m * m * a.x + 2 * m * t * c.x + t * t * b.x;
    const y = m * m * a.y + 2 * m * t * c.y + t * t * b.y;
    if (!wavy) return {x, y};
    const w = Math.sin(t * Math.PI * 2 * waves) * Math.sin(t * Math.PI) * 1.3;
    return {x: x + nx * w, y: y + ny * w};
  };
}

function partial(fn: PathFn, p: number) {
  const n = Math.max(2, Math.ceil(48 * p));
  return Array.from({length: n + 1}, (_, i) => {
    const q = fn((i / n) * p);
    return `${i ? 'L' : 'M'}${q.x.toFixed(2)},${q.y.toFixed(2)}`;
  }).join(' ');
}

const Arrow: React.FC<{fn: PathFn; p: number; color: string; dashed?: boolean; opacity?: number; width?: number}> = ({fn, p, color, dashed, opacity = 1, width = 0.7}) => {
  if (p <= 0.01) return null;
  const tip = fn(p);
  const back = fn(Math.max(0, p - 0.04));
  const ang = Math.atan2(tip.y - back.y, tip.x - back.x);
  const s = 2.2;
  const head = [0, 2.5, -2.5].map((o, i) => {
    const r = i === 0 ? 0 : s;
    const a = ang + Math.PI + (i === 0 ? 0 : o * 0.22);
    return i === 0 ? `${tip.x + Math.cos(ang) * 0.6},${tip.y + Math.sin(ang) * 0.6}` : `${tip.x + Math.cos(a) * r},${tip.y + Math.sin(a) * r}`;
  });
  return (
    <g opacity={opacity}>
      <path d={partial(fn, p)} fill="none" stroke={color} strokeWidth={width} strokeLinecap="round" strokeLinejoin="round" strokeDasharray={dashed ? '1.6 1.4' : undefined} />
      <polygon points={head.join(' ')} fill={color} />
    </g>
  );
};

// ---------------------------------------------------------------------------------------------
// Playing surfaces (drawn in a 100×100 board; lines draw in when the board arrives)
// ---------------------------------------------------------------------------------------------

const Surface: React.FC<{field: Props['field']; pal: Pal; draw: number}> = ({field, pal, draw}) => {
  const L = {fill: 'none', stroke: pal.pitchLine, strokeWidth: 0.45, pathLength: 1, strokeDasharray: 1, strokeDashoffset: 1 - draw} as const;
  const bands = field === 'soccer' ? Array.from({length: 8}, (_, i) => <rect key={i} x={0} y={i * 12.5} width={100} height={12.5} fill={i % 2 ? alpha(pal.pitchLine, 0.08) : 'transparent'} />) : null;
  return (
    <g>
      <rect x={0} y={0} width={100} height={100} fill={pal.pitch} />
      {bands}
      {field === 'basketball' ? (
        <>
          <rect x={34} y={3} width={32} height={39} fill={alpha(pal.accent, 0.07 * draw)} stroke="none" />
          <rect x={3} y={3} width={94} height={94} {...L} />
          <rect x={34} y={3} width={32} height={39} {...L} />
          <circle cx={50} cy={42} r={12} {...L} />
          <path d="M8,3 L8,22 A43.4,43.4 0 0 0 92,22 L92,3" {...L} />
          <path d="M44,17 A8,8 0 0 0 56,17" {...L} />
          <line x1={44} y1={7} x2={56} y2={7} {...L} strokeWidth={0.9} />
          <circle cx={50} cy={11} r={2.2} {...L} stroke={pal.accent} strokeWidth={0.7} />
          <path d="M38,97 A12,12 0 0 1 62,97" {...L} />
        </>
      ) : field === 'soccer' ? (
        <>
          <rect x={3} y={3} width={94} height={94} {...L} />
          <rect x={20} y={3} width={60} height={30} {...L} />
          <rect x={36} y={3} width={28} height={10} {...L} />
          <path d="M40.5,33 A12,12 0 0 0 59.5,33" {...L} />
          <path d="M44,3 L44,0.6 L56,0.6 L56,3" {...L} stroke={pal.accent} strokeWidth={0.8} />
          <circle cx={50} cy={24} r={0.6} fill={pal.pitchLine} opacity={draw} />
          <path d="M37,97 A13,13 0 0 1 63,97" {...L} />
        </>
      ) : field === 'american-football' ? (
        <>
          <rect x={3} y={3} width={94} height={12} fill={alpha(pal.accent, 0.12 * draw)} stroke="none" />
          <rect x={3} y={3} width={94} height={94} {...L} />
          {Array.from({length: 9}, (_, i) => <line key={i} x1={3} x2={97} y1={15 + i * 10} y2={15 + i * 10} {...L} strokeWidth={i === 0 ? 0.8 : 0.4} />)}
          {Array.from({length: 40}, (_, i) => <line key={`h${i}`} x1={i % 2 ? 61 : 38} x2={i % 2 ? 62 : 39} y1={15 + Math.floor(i / 2) * 4.1} y2={15 + Math.floor(i / 2) * 4.1} stroke={pal.pitchLine} strokeWidth={0.35} opacity={draw} />)}
          {[10, 20, 30, 40].map((n, i) => (
            <text key={n} x={9} y={26.5 + i * 20} fontSize={3.4} fontFamily={fonts.condensed} fontWeight={700} fill={pal.pitchLine} opacity={draw}>{n}</text>
          ))}
          <path d="M45,3 L45,0.8 M55,3 L55,0.8 M45,3 L55,3" {...L} stroke={pal.accent} strokeWidth={0.8} />
        </>
      ) : (
        <>
          <rect x={3} y={3} width={94} height={94} rx={2} {...L} />
          <line x1={3} x2={97} y1={50} y2={50} {...L} strokeDasharray="1.2 1.2" strokeDashoffset={0} opacity={draw} />
          <path d="M42,3 L42,8 L58,8 L58,3" {...L} stroke={pal.accent} strokeWidth={0.8} />
        </>
      )}
    </g>
  );
};

// ---------------------------------------------------------------------------------------------
// Step state: positions and ball holder before / after every step
// ---------------------------------------------------------------------------------------------

type State = {pos: Record<string, Pt>; holder: string};

function buildStates(props: Props): State[] {
  const ids = new Set(props.players.map(p => p.id));
  const first: State = {pos: Object.fromEntries(props.players.map(p => [p.id, {x: p.x, y: p.y}])), holder: ids.has(props.ballWith) ? props.ballWith : ''};
  const out = [first];
  for (const step of props.steps) {
    const prev = out[out.length - 1];
    const pos = {...prev.pos};
    for (const m of step.moves) if (ids.has(m.player)) pos[m.player] = {x: m.x, y: m.y};
    const target = step.passTo === 'goal' || ids.has(step.passTo) ? step.passTo : '';
    out.push({pos, holder: prev.holder && prev.holder !== 'goal' && target ? target : prev.holder});
  }
  return out;
}

type Window = {start: number; end: number; draw: number; drawLen: number; run: number; runLen: number; pass: number; passLen: number};
const windowOf = (start: number, end: number): Window => {
  const d = Math.max(8, end - start);
  const runLen = Math.max(8, Math.min(54, d * 0.38));
  return {start, end, draw: start + Math.min(8, d * 0.1), drawLen: Math.max(6, Math.min(18, d * 0.18)), run: start + d * 0.24, runLen, pass: start + d * 0.24 + runLen, passLen: Math.max(6, Math.min(22, d * 0.16))};
};

// ---------------------------------------------------------------------------------------------
// The board: surface, arrows, players, ball, camera
// ---------------------------------------------------------------------------------------------

const Board: React.FC<{props: Props; pal: Pal; states: State[]; wins: Window[]; enter: number; boardIn: number; size: number}> = ({props, pal, states, wins, enter, boardIn, size}) => {
  const frame = useCurrentFrame();
  const goal = GOAL[props.field];
  let k = -1;
  wins.forEach((w, i) => {
    if (frame >= w.start) k = i;
  });
  const draw = enter;
  const before = states[Math.max(0, k)];
  const after = k >= 0 ? states[k + 1] : states[0];
  const step = k >= 0 ? props.steps[k] : null;
  const w = k >= 0 ? wins[k] : null;
  const ids = props.players.map(p => p.id);
  const movesById = new Map((step?.moves ?? []).filter(m => ids.includes(m.player)).map((m, i) => [m.player, {m, i}]));
  const runP = w ? progress(frame, w.run, w.runLen, ease.cinematic) : 0;
  const drawP = w ? progress(frame, w.draw, w.drawLen, ease.snappy) : 0;
  const passFrom = before.holder && before.holder !== 'goal' ? before.holder : '';
  const passTarget = step && passFrom && after.holder !== before.holder ? after.holder : '';
  const passP = w && passTarget ? progress(frame, w.pass, w.passLen, ease.snappy) : 0;
  const fnFor = (id: string): PathFn | null => {
    const hit = movesById.get(id);
    if (!hit) return null;
    return curve(before.pos[id], after.pos[id], hit.i % 2 ? -1 : 1, hit.m.kind === 'dribble');
  };
  const posOf = (id: string): Pt => {
    const fn = k >= 0 ? fnFor(id) : null;
    return fn ? fn(runP) : (k >= 0 ? before : states[0]).pos[id];
  };
  const passA = passFrom ? after.pos[passFrom] : goal;
  const passB = passTarget === 'goal' ? goal : passTarget ? after.pos[passTarget] : goal;
  const passFn = curve(passA, passB, 0.35, false);

  // ball
  let ball: Pt | null = null;
  let lift = 0;
  if (passTarget && passP > 0) {
    ball = passFn(passP);
    lift = Math.sin(Math.PI * passP);
  } else if (before.holder === 'goal') ball = goal;
  else if (before.holder) {
    const p = posOf(before.holder);
    ball = {x: p.x + 3.2, y: p.y - 3.2};
  }
  if (passTarget && passP >= 1) {
    if (passTarget === 'goal') ball = goal;
    else {
      const p = after.pos[passTarget];
      ball = {x: p.x + 3.2, y: p.y - 3.2};
    }
  }

  // previous step's arrows fade out as the new step starts
  const prevK = k - 1;
  const prevFade = w ? 1 - progress(frame, w.start, 12) : 0;
  const prevArrows =
    prevK >= 0 && prevFade > 0
      ? props.steps[prevK].moves
          .filter(m => ids.includes(m.player))
          .map((m, i) => <Arrow key={`p${i}`} fn={curve(states[prevK].pos[m.player], states[prevK + 1].pos[m.player], i % 2 ? -1 : 1, m.kind === 'dribble')} p={1} color={pal.muted} opacity={0.45 * prevFade} dashed={false} width={0.5} />)
      : null;

  // camera: a gentle push toward the action of the current step
  const focus = step && step.moves.length ? step.moves.reduce((a, m) => ({x: a.x + m.x / step.moves.length, y: a.y + m.y / step.moves.length}), {x: 0, y: 0}) : {x: 50, y: 50};
  const zoom = w ? 1 + 0.05 * Math.sin(Math.PI * progress(frame, w.start, Math.max(10, w.end - w.start), ease.cinematic)) : 1;
  const scoreP = passTarget === 'goal' && w ? progress(frame, w.pass + w.passLen, 22, ease.expo) : 0;
  const attackInk = inkOn(pal.accent);

  return (
    <svg width={size} height={size} viewBox="0 0 100 100" style={{display: 'block', borderRadius: 18, overflow: 'hidden'}}>
      <g transform={`translate(${focus.x} ${focus.y}) scale(${zoom}) translate(${-focus.x} ${-focus.y})`}>
        <Surface field={props.field} pal={pal} draw={draw} />
        {prevArrows}
        {step
          ? step.moves.filter(m => ids.includes(m.player)).map((m, i) => (
              <Arrow key={`a${k}${i}`} fn={curve(before.pos[m.player], after.pos[m.player], i % 2 ? -1 : 1, m.kind === 'dribble')} p={drawP} color={m.kind === 'dribble' ? pal.accent : pal.text} opacity={0.85 - 0.35 * runP} />
            ))
          : null}
        {passTarget ? <Arrow fn={passFn} p={w ? progress(frame, w.draw + w.drawLen * 0.7, w.drawLen, ease.snappy) : 0} color={pal.accent} dashed opacity={0.9 - 0.4 * passP} /> : null}
        {scoreP > 0 && scoreP < 1 ? <circle cx={goal.x} cy={goal.y} r={2 + 14 * scoreP} fill="none" stroke={pal.accent} strokeWidth={0.9 * (1 - scoreP)} /> : null}
        {scoreP > 0 ? <circle cx={goal.x} cy={goal.y} r={4} fill={alpha(pal.accent, 0.35 * Math.sin(Math.PI * Math.min(1, scoreP * 1.4)))} /> : null}
        {props.players.map((pl, i) => {
          const p = posOf(pl.id);
          const appear = progress(frame, boardIn + 10 + i * 2, 14, ease.overshoot);
          const active = movesById.has(pl.id) || pl.id === passTarget;
          const halo = active && w ? Math.sin(Math.PI * progress(frame, w.draw, Math.max(10, w.run + w.runLen - w.draw))) : 0;
          const moving = movesById.has(pl.id) ? Math.sin(Math.PI * runP) : 0;
          const r = 3.9 * (1 + 0.1 * moving) * Math.max(0, appear);
          const attack = pl.side === 'attack';
          return (
            <g key={pl.id} transform={`translate(${p.x} ${p.y})`}>
              {halo > 0 ? <circle r={r + 1.4 + 2.2 * halo} fill={alpha(pal.accent, 0.18 * halo)} stroke={alpha(pal.accent, 0.6 * halo)} strokeWidth={0.3} /> : null}
              <circle r={r} cy={0.7} fill={alpha('#000000', 0.18)} />
              <circle r={r} fill={attack ? pal.accent : pal.surface} stroke={attack ? 'none' : pal.text} strokeWidth={0.7} />
              <text y={1.25} textAnchor="middle" fontSize={pl.id.length > 2 ? 2.7 : 3.5} fontWeight={800} fontFamily={fonts.sans} fill={attack ? attackInk : pal.text} opacity={appear}>{pl.id}</text>
            </g>
          );
        })}
        {ball ? (
          <g transform={`translate(${ball.x} ${ball.y - lift * 2.5}) scale(${(1 + lift * 0.35) * Math.min(1, enter * 1.4)})`}>
            <circle r={1.8} cy={lift * 2.5 + 0.5} fill={alpha('#000000', 0.2 * (1 - lift * 0.5))} />
            <circle r={1.6} fill="#ffffff" stroke={pal.text} strokeWidth={0.45} />
            <path d="M-1.6,0 L1.6,0 M0,-1.6 L0,1.6" stroke={pal.text} strokeWidth={0.25} />
          </g>
        ) : null}
      </g>
    </svg>
  );
};

// ---------------------------------------------------------------------------------------------
// Composition
// ---------------------------------------------------------------------------------------------

const TutorialSportsPlaySteps: React.FC<EntryProps<Props>> = ({media, props}) => {
  const frame = useCurrentFrame();
  const {fps, width, height} = useVideoConfig();
  const look = useLook();
  const base = PALETTES[props.palette];
  const pal: Pal = look ? fromLook(look) : {...base, accent: media.accent ?? base.accent};
  const dark = pal.tone === 'dark';
  // Accent for small text: pale accents (e.g. a yellow look accent) get darkened on light grounds.
  const accentInk = !dark && inkOn(pal.accent) !== '#ffffff' ? mix(pal.accent, pal.text, 0.45) : pal.accent;
  const headAccent = accentInk === pal.accent ? pal.accent : mix(pal.accent, pal.text, 0.22);
  const u = Math.min(width, height) / 1080;
  const stacked = height / width > 1.3;
  const timeline = useSceneTimeline(media);
  const contentEnd = useContentFrames(media);
  const steps = props.steps;
  const n = steps.length;

  // Scene 0 is the title when there is one more scene than steps; otherwise step i follows scene i.
  let introEnd = 0;
  let starts: number[];
  if (timeline.length > n) {
    introEnd = timeline[1].from;
    starts = steps.map((_, i) => timeline[i + 1].from);
  } else if (timeline.length === n) {
    starts = timeline.map(t => t.from);
  } else {
    introEnd = timeline.length > 1 ? timeline[1].from : Math.min(Math.round(1.6 * fps), Math.floor(contentEnd * 0.2));
    starts = steps.map((_, i) => introEnd + Math.round(((contentEnd - introEnd) * i) / n));
  }
  starts = starts.map(s => Math.min(s, contentEnd - 1));
  const wins = starts.map((s, i) => windowOf(s, i < n - 1 ? starts[i + 1] : contentEnd));
  const states = React.useMemo(() => buildStates(props), [props]);
  let k = -1;
  wins.forEach((w, i) => {
    if (frame >= w.start) k = i;
  });

  // Layout: content stays above the caption zone (own captions or the look's).
  const safe = look ? captionSafeBottom(look) : props.showCaptions ? 0.13 : 0.05;
  const topBarY = height * 0.035;
  const topY = height * 0.08;
  const bottomY = height * (1 - safe);
  const pad = 18 * u;
  const bar = 56 * u;
  const headerH = (stacked ? 290 : 260) * u;
  const tipH = 150 * u;
  const gap = 34 * u;
  let side: number;
  let cardX: number;
  let cardY: number;
  let colX: number;
  let colW: number;
  let headerY: number;
  let tipY: number;
  if (stacked) {
    colW = width * 0.86;
    colX = (width - colW) / 2;
    side = Math.max(200 * u, Math.min(colW - 2 * pad, bottomY - topY - headerH - tipH - 2 * gap - 2 * pad - bar));
    const used = headerH + tipH + 2 * gap + 2 * pad + bar + side;
    headerY = topY + Math.max(0, (bottomY - topY - used) / 2);
    cardY = headerY + headerH + gap;
    cardX = (width - (side + 2 * pad)) / 2;
    tipY = cardY + side + 2 * pad + bar + gap;
  } else {
    side = Math.max(200 * u, Math.min(width * 0.46, bottomY - topY - 2 * pad - bar));
    cardX = width * 0.06;
    cardY = topY + Math.max(0, (bottomY - topY - (side + 2 * pad + bar)) / 2);
    colX = cardX + side + 2 * pad + width * 0.05;
    colW = width * 0.94 - colX;
    headerY = cardY + 10 * u;
    tipY = headerY + headerH + gap;
  }
  const headSize = Math.min(stacked ? 74 * u : 70 * u, colW / 8.5);
  const boardIn = Math.max(0, (wins[0]?.start ?? 0) - 14);
  const enter = progress(frame, boardIn, 26, ease.expo);
  const cardW = side + 2 * pad;
  const titlePlain = props.title.replace(/\*/g, '');
  const field = FIELD_NAME[props.field];
  const sweep = k >= 0 ? progress(frame, wins[k].start, 26, ease.cinematic) : 0;
  const introOut = progress(frame, introEnd - 12, 12, ease.accelerate);
  const label: React.CSSProperties = {fontFamily: fonts.mono, fontSize: 24 * u, letterSpacing: '0.22em', textTransform: 'uppercase'};

  return (
    <AbsoluteFill style={{background: pal.bg, overflow: 'hidden'}}>
      {/* static texture layers: soft glows + halftone dot clouds in the corners */}
      <AbsoluteFill style={{background: `radial-gradient(circle at ${20 + Math.sin(frame / 90) * 6}% 18%, ${alpha(pal.bg2, 0.95)} 0%, transparent 45%), radial-gradient(circle at ${82 - Math.sin(frame / 110) * 6}% 84%, ${alpha(pal.bg2, 0.9)} 0%, transparent 50%), radial-gradient(circle at 50% 50%, ${alpha(pal.accent, dark ? 0.08 : 0.05)} 0%, transparent 60%)`}} />
      <AbsoluteFill style={{maskImage: 'radial-gradient(ellipse 45% 35% at 8% 14%, #000 0%, transparent 100%), radial-gradient(ellipse 50% 40% at 96% 90%, #000 0%, transparent 100%)', WebkitMaskImage: 'radial-gradient(ellipse 45% 35% at 8% 14%, #000 0%, transparent 100%), radial-gradient(ellipse 50% 40% at 96% 90%, #000 0%, transparent 100%)'}}>
        <GridLines dots step={Math.round(20 * u)} color={pal.dots} opacity={dark ? 0.55 : 0.7} drift={0} />
      </AbsoluteFill>
      <Particles count={24} color={pal.accent} opacity={dark ? 0.35 : 0.22} seed="play" speed={0.35} size={[2, 5]} />

      {/* top bar */}
      <div style={{position: 'absolute', left: width * 0.06, right: width * 0.06, top: topBarY, display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: pal.text, opacity: progress(frame, 0, 16)}}>
        <div style={{display: 'flex', alignItems: 'center', gap: 14 * u}}>
          <LineIcon name="ball" size={34 * u} color={pal.accent} strokeWidth={6} progress={progress(frame, 2, 24)} />
          <span style={{...label, fontSize: 22 * u, color: pal.text}}>{props.kicker || field}</span>
        </div>
        <span style={{...label, fontSize: 22 * u, color: pal.muted}}>{k >= 0 ? `Step ${String(k + 1).padStart(2, '0')} / ${String(n).padStart(2, '0')}` : `${n} steps`}</span>
      </div>

      {/* intro title */}
      {introEnd > 0 && frame < introEnd ? (
        <AbsoluteFill style={{opacity: 1 - introOut, transform: `scale(${1 + introOut * 0.18})`}}>
          <div style={{position: 'absolute', left: width * 0.08, right: width * 0.08, top: topY, height: bottomY - topY, display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', textAlign: 'center'}}>
            <div style={{width: 130 * u, height: 130 * u, borderRadius: 34 * u, background: pal.surface, boxShadow: `0 ${24 * u}px ${60 * u}px ${alpha('#000', dark ? 0.45 : 0.12)}`, display: 'flex', alignItems: 'center', justifyContent: 'center', transform: `scale(${progress(frame, 0, 18, ease.overshoot)}) rotate(${(1 - progress(frame, 0, 24)) * -14}deg)`, marginBottom: 46 * u}}>
              <LineIcon name={props.field === 'plain' ? 'target' : 'ball'} size={84 * u} color={pal.accent} strokeWidth={5} progress={progress(frame, 6, 30)} />
            </div>
            <div style={{...label, color: pal.muted, marginBottom: 24 * u, opacity: progress(frame, 6, 14)}}>• {props.kicker || field}</div>
            <KineticText text={props.title} start={8} stagger={4} style="blur" align="center" accent={headAccent} textStyle={{fontFamily: fonts.sans, fontWeight: 800, color: pal.text, fontSize: Math.min((stacked ? 118 : 104) * u, (width * 1.5) / Math.max(8, titlePlain.length)), lineHeight: 1.02, letterSpacing: '-0.035em'}} />
            <div style={{...label, color: pal.muted, marginTop: 34 * u, opacity: progress(frame, 24, 16)}}>{`${n} steps · ${field}`}</div>
          </div>
          {/* floating player tokens */}
          {props.players.slice(0, 6).map((pl, i) => {
            const a = (i / Math.min(6, props.players.length)) * Math.PI * 2 + 0.6;
            const pop = progress(frame, 10 + i * 4, 16, ease.overshoot);
            const fx = width / 2 + Math.cos(a) * width * (stacked ? 0.36 : 0.34) + Math.sin(frame / 30 + i) * 10 * u;
            const fy = (topY + bottomY) / 2 + Math.sin(a) * (bottomY - topY) * (stacked ? 0.33 : 0.36) + Math.cos(frame / 26 + i * 2) * 12 * u;
            const d = 86 * u * rand(`tk${i}`, 0.8, 1.1);
            const attack = pl.side === 'attack';
            return (
              <div key={pl.id} style={{position: 'absolute', left: fx - d / 2, top: fy - d / 2, width: d, height: d, borderRadius: '50%', background: attack ? pal.accent : pal.surface, border: attack ? 'none' : `${3 * u}px solid ${pal.text}`, boxSizing: 'border-box', color: attack ? inkOn(pal.accent) : pal.text, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: fonts.sans, fontWeight: 800, fontSize: d * 0.36, transform: `scale(${pop}) rotate(${rand(`tr${i}`, -10, 10)}deg)`, boxShadow: `0 ${14 * u}px ${34 * u}px ${alpha('#000', dark ? 0.4 : 0.14)}`}}>{pl.id}</div>
            );
          })}
        </AbsoluteFill>
      ) : null}

      {/* step headers */}
      {steps.map((s, i) => {
        const w = wins[i];
        if (frame < w.start - 2 || frame >= w.end + 1) return null;
        const out = i < n - 1 ? progress(frame, w.end - 9, 9, ease.accelerate) : 0;
        return (
          <div key={i} style={{position: 'absolute', left: colX, width: colW, top: headerY, height: headerH, display: 'flex', flexDirection: 'column', justifyContent: stacked ? 'flex-end' : 'flex-start', alignItems: stacked ? 'center' : 'flex-start', textAlign: stacked ? 'center' : 'left', opacity: 1 - out, transform: `translateY(${-out * 40 * u}px)`, filter: `blur(${out * 8}px)`}}>
            <div style={{...label, color: accentInk, marginBottom: 18 * u, display: 'flex', alignItems: 'center', gap: 12 * u, transform: `translateX(${(1 - progress(frame, w.start, 16)) * -30 * u}px)`, opacity: progress(frame, w.start, 12)}}>
              <span style={{width: 10 * u, height: 10 * u, borderRadius: '50%', background: pal.accent}} />
              {String(i + 1).padStart(2, '0')} / {s.label}
            </div>
            <KineticText text={s.headline} start={w.start + 3} stagger={3} style="blur" align={stacked ? 'center' : 'left'} accent={headAccent} textStyle={{fontFamily: fonts.sans, fontWeight: 800, color: pal.text, fontSize: headSize, lineHeight: 1.04, letterSpacing: '-0.03em'}} />
          </div>
        );
      })}

      {/* board card */}
      {k >= 0 || frame >= boardIn ? (
        <div style={{position: 'absolute', left: cardX, top: cardY, width: cardW, perspective: 2400 * u}}>
          <div style={{background: pal.surface, borderRadius: 32 * u, padding: pad, boxShadow: `0 ${40 * u}px ${110 * u}px ${alpha('#000', dark ? 0.5 : 0.14)}, inset 0 0 0 ${2 * u}px ${alpha(pal.text, 0.06)}`, transform: `translateY(${(1 - enter) * 160 * u + Math.sin(frame / 45) * 4 * u}px) rotateX(${(1 - enter) * 24 + Math.sin(frame / 70) * 1.2}deg) scale(${0.9 + 0.1 * enter})`, opacity: Math.min(1, enter * 1.6), position: 'relative', overflow: 'hidden'}}>
            <div style={{height: bar, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: `0 ${8 * u}px ${pad * 0.6}px`}}>
              <div style={{display: 'flex', alignItems: 'center', gap: 12 * u, fontFamily: fonts.sans, fontWeight: 700, fontSize: 26 * u, color: pal.text, whiteSpace: 'nowrap', overflow: 'hidden'}}>
                <span style={{width: 14 * u, height: 14 * u, borderRadius: 4 * u, background: pal.accent, flexShrink: 0}} />
                {titlePlain}
              </div>
              <div style={{fontFamily: fonts.mono, fontSize: 20 * u, letterSpacing: '0.12em', padding: `${8 * u}px ${16 * u}px`, borderRadius: 999, background: alpha(pal.accent, 0.12), color: accentInk, whiteSpace: 'nowrap'}}>{k >= 0 ? `STEP ${k + 1}/${n}` : 'READY'}</div>
            </div>
            <Board props={props} pal={pal} states={states} wins={wins} enter={enter} boardIn={boardIn} size={side} />
            {sweep > 0 && sweep < 1 ? <div style={{position: 'absolute', top: 0, bottom: 0, width: '40%', left: `${-40 + sweep * 140}%`, background: `linear-gradient(100deg, transparent 0%, ${alpha('#ffffff', dark ? 0.08 : 0.35)} 50%, transparent 100%)`, pointerEvents: 'none'}} /> : null}
          </div>
        </div>
      ) : null}

      {/* coaching cue card */}
      {steps.map((s, i) => {
        const w = wins[i];
        if (frame < w.start || frame >= w.end + 1) return null;
        const inP = progress(frame, w.start + 6, 16, ease.expo);
        const out = i < n - 1 ? progress(frame, w.end - 8, 8, ease.accelerate) : 0;
        return (
          <div key={i} style={{position: 'absolute', left: colX, width: colW, top: tipY, minHeight: tipH, boxSizing: 'border-box', background: pal.surface, borderRadius: 28 * u, padding: `${24 * u}px ${28 * u}px`, boxShadow: `0 ${24 * u}px ${60 * u}px ${alpha('#000', dark ? 0.4 : 0.1)}`, display: 'flex', flexDirection: 'column', gap: 18 * u, opacity: inP * (1 - out), transform: `translateY(${(1 - inP) * 50 * u}px) scale(${1 - out * 0.04})`}}>
            <div style={{display: 'flex', alignItems: 'center', gap: 24 * u}}>
              <div style={{width: 76 * u, height: 76 * u, flexShrink: 0, borderRadius: 22 * u, background: alpha(pal.accent, 0.12), display: 'flex', alignItems: 'center', justifyContent: 'center'}}>
                <LineIcon name={s.icon} size={46 * u} color={pal.accent} strokeWidth={6} progress={progress(frame, w.start + 10, 24)} />
              </div>
              <div style={{fontFamily: fonts.sans, fontWeight: 600, fontSize: Math.min(34 * u, colW / 17), lineHeight: 1.25, color: pal.text, opacity: progress(frame, w.start + 12, 14), filter: `blur(${(1 - progress(frame, w.start + 12, 14)) * 6}px)`}}>{s.tip || s.label}</div>
            </div>
            <div style={{display: 'flex', gap: 10 * u}}>
              {steps.map((_, j) => (
                <div key={j} style={{flex: 1, height: 7 * u, borderRadius: 4 * u, background: j < i ? pal.accent : alpha(pal.text, 0.1), overflow: 'hidden'}}>
                  {j === i ? <div style={{width: `${progress(frame, w.start, Math.max(10, w.end - w.start), ease.cinematic) * 100}%`, height: '100%', background: pal.accent}} /> : null}
                </div>
              ))}
            </div>
          </div>
        );
      })}

      {/* side layout: the play's step list under the cue card */}
      {!stacked && k >= 0 && bottomY - (tipY + tipH + gap) > 60 * u * n ? (
        <div style={{position: 'absolute', left: colX, width: colW, top: tipY + tipH + gap, display: 'flex', flexDirection: 'column', gap: 10 * u}}>
          {steps.map((s, j) => {
            const done = j < k;
            const on = j === k;
            return (
              <div key={j} style={{display: 'flex', alignItems: 'center', gap: 16 * u, fontFamily: fonts.sans, fontSize: 24 * u, fontWeight: on ? 800 : 600, color: on ? pal.text : pal.muted, opacity: progress(frame, wins[0].start + 10 + j * 4, 12), transform: `translateX(${on ? 10 * u : 0}px)`}}>
                <span style={{width: 34 * u, height: 34 * u, borderRadius: '50%', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: done || on ? pal.accent : 'transparent', border: done || on ? 'none' : `${2 * u}px solid ${alpha(pal.muted, 0.6)}`, color: inkOn(pal.accent), fontSize: 18 * u}}>
                  {done ? <LineIcon name="check" size={20 * u} color={inkOn(pal.accent)} strokeWidth={10} /> : on ? String(j + 1) : null}
                </span>
                {s.label}
              </div>
            );
          })}
        </div>
      ) : null}

      {dark ? wins.map((w, i) => <LightLeak key={i} from={Math.max(0, w.start - 8)} durationInFrames={Math.round(0.9 * fps)} seed={i * 5 + 2} hueShift={170} opacity={0.3} />) : null}

      {props.showCaptions
        ? timeline.map(t => (
            <Sequence key={t.index} from={t.from} durationInFrames={t.durationInFrames}>
              <AbsoluteFill style={{justifyContent: 'flex-end', padding: stacked ? `0 7% ${height * 0.035}px` : `0 18% ${height * 0.03}px`}}>
                <StyledCaptions scene={t.scene} variant="pop" accent={pal.accent} color={pal.text} font={fonts.sans} size={(stacked ? 50 : 44) * u} words={stacked ? 5 : 7} weight={800} shadow={dark} />
              </AbsoluteFill>
            </Sequence>
          ))
        : null}
      <Vignette strength={dark ? 0.5 : 0.12} />
      <Grain opacity={dark ? 0.06 : 0.035} />
      <NarrationTrack media={media} />
      <AdWeave media={media} theme={{background: pal.bg, text: pal.text, font: fonts.sans}} />
    </AbsoluteFill>
  );
};

export default defineEntry({id: 'tutorial-sports-play-steps', schema: Props, component: TutorialSportsPlaySteps});
