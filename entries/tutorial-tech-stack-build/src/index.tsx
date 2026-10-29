import React from 'react';
import {AbsoluteFill, Sequence, useCurrentFrame, useVideoConfig} from 'remotion';
import {AdWeave, NarrationTrack, captionSafeBottom, defineEntry, mix, useContentFrames, useLook, useSceneTimeline, type ActiveLook, type EntryProps} from '@viralaunch/kit';
import {Grain, KineticText, LightLeak, LineIcon, Particles, SceneSeries, StyledCaptions, Vignette, alpha, ease, fonts, progress, rand, tween, type Widen} from '@viralaunch/kit/fx';
import {Props} from './schema';

const PALETTES = {
  slate: {bg: '#1c1f23', bg2: '#30353c', surface: '#454b53', text: '#f2f3f5', muted: '#9ba1a9', accent: '#ff6a1a', line: '#d3d8de', light: false},
  midnight: {bg: '#060918', bg2: '#18204a', surface: '#283166', text: '#eef1ff', muted: '#8f98c4', accent: '#5ff0ff', line: '#c9d2ff', light: false},
  paper: {bg: '#eee8dc', bg2: '#f8f4ec', surface: '#fbf9f4', text: '#1f1d1a', muted: '#7b7468', accent: '#e2531b', line: '#3a3631', light: true},
} as const;
type Pal = Widen<(typeof PALETTES)[keyof typeof PALETTES]>;

/** The studio in a sequence's shared look: same background family, surfaces, ink and accent. */
const fromLook = (l: ActiveLook): Pal => ({
  bg: l.palette.bg,
  bg2: l.palette.bg2,
  surface: l.tone === 'light' ? l.palette.surface : mix(l.palette.surface, l.palette.text, 0.18),
  text: l.palette.text,
  muted: l.palette.muted,
  accent: l.palette.accent,
  line: l.palette.line,
  light: l.tone === 'light',
});

/** Accent for small text: deepened toward the ink on light backgrounds so it stays readable. */
const ink = (p: Pal) => (p.light ? mix(p.accent, p.text, 0.45) : p.accent);

// World units of one stack layer (a square slab) and the camera pitch.
const W = 10;
const T = 1.5;
const GAP = 1.0;
const PITCH = 0.56;
const HD = (W * Math.SQRT2) / 2;
const CELLS = 4;

type V3 = [number, number, number];
type Proj = (p: V3) => [number, number, number];

const makeProj = (cx: number, by: number, s: number, yaw: number): Proj => {
  const c = Math.cos(yaw);
  const sn = Math.sin(yaw);
  return ([x, y, z]) => {
    const rx = x * c - z * sn;
    const rz = x * sn + z * c;
    return [cx + rx * s, by - y * Math.cos(PITCH) * s + rz * Math.sin(PITCH) * s, rz * Math.cos(PITCH) + y * Math.sin(PITCH)];
  };
};
const path = (pts: Array<[number, number, number]>) => `M${pts.map(p => `${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(' L')} Z`;
const shade = (hex: string, k: number) => (k >= 1 ? mix(hex, '#ffffff', Math.min(0.5, k - 1)) : mix(hex, '#000000', 1 - k));

/** An axis-aligned box as SVG faces: the two side faces turned toward camera, then the top. */
const Box: React.FC<{proj: Proj; yaw: number; c: V3; size: V3; color: string; edge: string; edgeWidth?: number; opacity?: number; light: boolean}> = ({proj, yaw, c, size, color, edge, edgeWidth = 1.2, opacity = 1, light}) => {
  const [x, y, z] = c;
  const [sx, sy, sz] = size.map(v => v / 2) as V3;
  const P = (dx: number, dy: number, dz: number) => proj([x + dx * sx, y + dy * sy, z + dz * sz]);
  const sides: Array<{n: [number, number]; pts: V3[]}> = [
    {n: [1, 0], pts: [[1, -1, -1], [1, -1, 1], [1, 1, 1], [1, 1, -1]]},
    {n: [-1, 0], pts: [[-1, -1, -1], [-1, -1, 1], [-1, 1, 1], [-1, 1, -1]]},
    {n: [0, 1], pts: [[-1, -1, 1], [1, -1, 1], [1, 1, 1], [-1, 1, 1]]},
    {n: [0, -1], pts: [[-1, -1, -1], [1, -1, -1], [1, 1, -1], [-1, 1, -1]]},
  ];
  const c0 = Math.cos(yaw);
  const s0 = Math.sin(yaw);
  return (
    <g opacity={opacity}>
      {sides.map((f, i) => {
        const facing = f.n[0] * s0 + f.n[1] * c0;
        if (facing <= 0.001) return null;
        const side = f.n[0] * c0 - f.n[1] * s0;
        const k = (light ? 0.8 : 0.62) + side * (light ? 0.1 : 0.14);
        return <path key={i} d={path(f.pts.map(p => P(...p)))} fill={shade(color, k)} stroke={edge} strokeWidth={edgeWidth} strokeLinejoin="round" />;
      })}
      <path d={path([P(-1, 1, -1), P(1, 1, -1), P(1, 1, 1), P(-1, 1, 1)])} fill={shade(color, light ? 1.02 : 1.08)} stroke={edge} strokeWidth={edgeWidth} strokeLinejoin="round" />
    </g>
  );
};

type Build = {start: number; end: number; fly: number; land: number};

const stackHeight = (n: number) => n * (T + GAP) + 0.4;

/** The persistent 3D stack: one slab per step, assembled from flying voxels as each step begins. */
const Stack: React.FC<{steps: Props['steps']; builds: Build[]; pal: Pal; proj: Proj; yaw: number; tagX: number; u: number; current: number; appear: number}> = ({steps, builds, pal, proj, yaw, tagX, u, current, appear}) => {
  const frame = useCurrentFrame();
  const {width, height} = useVideoConfig();
  const edge = alpha(pal.line, pal.light ? 0.32 : 0.16);
  const layerY = (i: number) => 0.4 + i * (T + GAP) + T / 2;
  const base = (i: number) => mix(pal.surface, pal.bg2, (i % 2) * (pal.light ? 0.5 : 0.3));
  const tags: React.ReactNode[] = [];
  const svg: React.ReactNode[] = [];
  // Base plate.
  svg.push(<Box key="plate" proj={proj} yaw={yaw} c={[0, 0.15, 0]} size={[W + 1.6, 0.3, W + 1.6]} color={mix(pal.bg2, pal.bg, 0.3)} edge={alpha(pal.line, pal.light ? 0.35 : 0.2)} light={pal.light} />);
  steps.forEach((step, i) => {
    const b = builds[i];
    if (frame < b.start - 2) return;
    const y = layerY(i);
    const solid = progress(frame, b.land - 3, 8);
    const isActive = i === current;
    const color = isActive ? mix(base(i), pal.accent, pal.light ? 0.12 : 0.16) : base(i);
    // Dashed blueprint of the slot being built.
    if (frame < b.land + 6) {
      const ghost = progress(frame, b.start, 10) * (1 - solid);
      const corners = ([[-1, -1], [1, -1], [1, 1], [-1, 1]] as const).map(([dx, dz]) => proj([(dx * W) / 2, y + T / 2, (dz * W) / 2]));
      svg.push(<path key={`g${i}`} d={path(corners)} fill={alpha(pal.accent, 0.06)} stroke={pal.accent} strokeWidth={2.2 * u} strokeDasharray={`${12 * u} ${9 * u}`} strokeDashoffset={-frame * 1.5} opacity={ghost} />);
    }
    if (solid > 0) {
      svg.push(<Box key={`s${i}`} proj={proj} yaw={yaw} c={[0, y, 0]} size={[W, T, W]} color={color} edge={isActive ? alpha(pal.accent, 0.9) : edge} edgeWidth={isActive ? 2.2 * u : 1.2 * u} opacity={solid} light={pal.light} />);
      // Circuit traces on the top face.
      const traces = [-2.6, 0, 2.6].map(tx => {
        const a = proj([tx, y + T / 2, -W / 2 + 1]);
        const z1 = -W / 2 + 1 + (W - 2) * progress(frame, b.land, 18, ease.expo);
        const bb = proj([tx, y + T / 2, z1]);
        return <line key={tx} x1={a[0]} y1={a[1]} x2={bb[0]} y2={bb[1]} stroke={isActive ? pal.accent : pal.line} strokeOpacity={isActive ? 0.7 : 0.18} strokeWidth={2 * u} strokeLinecap="round" />;
      });
      svg.push(<g key={`t${i}`} opacity={solid}>{traces}</g>);
    }
    // Voxels fly in from the cloud above and snap into the grid.
    if (frame >= b.fly - 1 && frame < b.land + 8) {
      const cell = W / CELLS;
      const dur = Math.max(6, b.land - b.fly);
      const voxels = Array.from({length: CELLS * CELLS}, (_, v) => {
        const gx = v % CELLS;
        const gz = Math.floor(v / CELLS);
        const tx = -W / 2 + cell * (gx + 0.5);
        const tz = -W / 2 + cell * (gz + 0.5);
        const delay = rand(`d${i}${v}`) * dur * 0.5;
        const p = progress(frame, b.fly + delay, dur - delay, ease.expo);
        const sx = tx * 0.6 + rand(`x${i}${v}`, -3, 7) + 3;
        const sy = y + rand(`y${i}${v}`, 9, 18);
        const sz = tz + rand(`z${i}${v}`, -10, 4) - 3;
        const pos: V3 = [sx + (tx - sx) * p, sy + (y - sy) * p, sz + (tz - sz) * p];
        const k = 0.45 + 0.53 * p;
        const hot = rand(`h${i}${v}`) < 0.32;
        return {v, pos, k, hot, p, depth: proj(pos)[2]};
      }).sort((a, b2) => a.depth - b2.depth);
      svg.push(
        <g key={`v${i}`} opacity={1 - solid}>
          {voxels.map(vx => (
            <Box key={vx.v} proj={proj} yaw={yaw} c={vx.pos} size={[cell * vx.k, T * vx.k, cell * vx.k]} color={vx.hot ? mix(pal.accent, base(i), vx.p * 0.6) : mix(base(i), pal.text, (1 - vx.p) * 0.25)} edge={alpha(pal.line, 0.25)} edgeWidth={u} opacity={Math.min(1, vx.p * 6 + 0.25)} light={pal.light} />
          ))}
        </g>,
      );
    }
    // Landing pulse.
    const pulse = progress(frame, b.land, 22, ease.expo);
    if (frame >= b.land && pulse < 1) {
      const r = 1 + pulse * 0.35;
      const corners = ([[-1, -1], [1, -1], [1, 1], [-1, 1]] as const).map(([dx, dz]) => proj([(dx * W * r) / 2, y + T / 2, (dz * W * r) / 2]));
      svg.push(<path key={`p${i}`} d={path(corners)} fill="none" stroke={pal.accent} strokeWidth={3 * u} opacity={1 - pulse} />);
    }
    // Leader line + tag.
    const tagIn = progress(frame, b.land, 14);
    if (tagIn > 0) {
      const anchor = ([[-1, -1], [1, -1], [1, 1], [-1, 1]] as const).map(([dx, dz]) => proj([(dx * W) / 2, y, (dz * W) / 2])).reduce((m, p) => (p[0] > m[0] ? p : m));
      const x1 = anchor[0] + 8 * u;
      svg.push(<line key={`l${i}`} x1={x1} y1={anchor[1]} x2={x1 + (tagX - x1) * tagIn} y2={anchor[1]} stroke={isActive ? pal.accent : alpha(pal.line, 0.45)} strokeWidth={2 * u} />);
      svg.push(<circle key={`c${i}`} cx={x1} cy={anchor[1]} r={5 * u} fill={isActive ? pal.accent : pal.line} opacity={tagIn} />);
      const h = 46 * u;
      tags.push(
        <div key={i} style={{position: 'absolute', left: tagX, top: anchor[1] - h / 2, height: h, display: 'flex', alignItems: 'center', gap: 10 * u, padding: `0 ${16 * u}px 0 ${10 * u}px`, borderRadius: 8 * u, border: `${2 * u}px solid ${isActive ? pal.accent : alpha(pal.line, 0.3)}`, background: isActive ? alpha(pal.accent, pal.light ? 0.12 : 0.16) : alpha(pal.bg, 0.55), opacity: tagIn, transform: `translateX(${(1 - tagIn) * -20 * u}px)`, fontFamily: fonts.mono, fontSize: 23 * u, letterSpacing: '0.06em', textTransform: 'uppercase', color: isActive ? pal.text : pal.muted, whiteSpace: 'nowrap'}}>
          <LineIcon name={step.icon} size={28 * u} color={isActive ? pal.accent : pal.muted} strokeWidth={6} progress={progress(frame, b.land + 4, 16)} />
          <span style={{color: isActive ? ink(pal) : alpha(pal.muted, 0.8)}}>{String(i + 1).padStart(2, '0')}</span>
          <span style={{fontWeight: 700}}>{step.label}</span>
        </div>,
      );
    }
  });
  return (
    <AbsoluteFill style={{opacity: appear}}>
      <svg width={width} height={height} style={{position: 'absolute', inset: 0, overflow: 'visible'}}>
        <g style={{filter: `drop-shadow(0 ${30 * u}px ${40 * u}px ${alpha('#000000', pal.light ? 0.18 : 0.45)})`}}>{svg}</g>
      </svg>
      {tags}
    </AbsoluteFill>
  );
};

/** Floor grid drawn in the stack's own projection, fading out radially (plain lines, no pattern). */
const Floor: React.FC<{proj: Proj; cx: number; by: number; pal: Pal; u: number}> = ({proj, cx, by, pal, u}) => {
  const {width, height} = useVideoConfig();
  const R = 30;
  const step = 2.5;
  const lines: React.ReactNode[] = [];
  for (let k = -R; k <= R + 0.01; k += step) {
    const a = proj([k, 0, -R]);
    const b = proj([k, 0, R]);
    const c = proj([-R, 0, k]);
    const d = proj([R, 0, k]);
    lines.push(<line key={`a${k}`} x1={a[0]} y1={a[1]} x2={b[0]} y2={b[1]} />, <line key={`b${k}`} x1={c[0]} y1={c[1]} x2={d[0]} y2={d[1]} />);
  }
  const mask = `radial-gradient(ellipse ${width * 0.55}px ${height * 0.22}px at ${cx}px ${by}px, black 0%, transparent 100%)`;
  return (
    <svg width={width} height={height} style={{position: 'absolute', inset: 0, maskImage: mask, WebkitMaskImage: mask}}>
      <g stroke={pal.line} strokeOpacity={pal.light ? 0.3 : 0.2} strokeWidth={1.4 * u}>{lines}</g>
    </svg>
  );
};

/** Bottom progress rail: one stop per step, filling as each layer lands. */
const Rail: React.FC<{steps: Props['steps']; builds: Build[]; pal: Pal; y: number; u: number; current: number}> = ({steps, builds, pal, y, u, current}) => {
  const frame = useCurrentFrame();
  const {width} = useVideoConfig();
  const x0 = width * 0.1;
  const x1 = width * 0.9;
  const n = steps.length;
  const xs = steps.map((_, i) => x0 + ((x1 - x0) * i) / Math.max(1, n - 1));
  const lands = builds.map(b => b.land);
  let fill = 0;
  for (let i = 1; i < n; i++) fill += progress(frame, lands[i - 1], Math.max(1, lands[i] - lands[i - 1]), ease.cinematic);
  const appear = progress(frame, 0, 20);
  return (
    <div style={{position: 'absolute', left: 0, top: y, width, opacity: appear}}>
      <div style={{position: 'absolute', left: x0, width: x1 - x0, top: -1 * u, height: 2 * u, background: alpha(pal.muted, 0.35)}} />
      <div style={{position: 'absolute', left: x0, width: ((x1 - x0) * fill) / Math.max(1, n - 1), top: -1.5 * u, height: 3 * u, background: pal.accent}} />
      {steps.map((st, i) => {
        const done = frame >= lands[i];
        const active = i === current;
        const r = (active ? 11 : 7) * u;
        return (
          <React.Fragment key={i}>
            <div style={{position: 'absolute', left: xs[i] - r, top: -r, width: r * 2, height: r * 2, borderRadius: '50%', background: done ? pal.accent : pal.bg, border: `${2 * u}px solid ${done || active ? pal.accent : alpha(pal.muted, 0.6)}`, boxShadow: active ? `0 0 0 ${(6 + 4 * Math.sin(frame / 6)) * u}px ${alpha(pal.accent, 0.18)}` : 'none', boxSizing: 'border-box'}} />
            <div style={{position: 'absolute', left: xs[i] - 120 * u, width: 240 * u, top: 22 * u, textAlign: 'center', fontFamily: fonts.mono, fontSize: 20 * u, letterSpacing: '0.08em', textTransform: 'uppercase', color: active ? ink(pal) : done ? pal.text : pal.muted, fontWeight: active ? 700 : 400}}>{st.label}</div>
          </React.Fragment>
        );
      })}
    </div>
  );
};

/** Terminal chip that types a command character by character. */
const Terminal: React.FC<{text: string; start: number; pal: Pal; u: number; size: number; prompt: string; style?: React.CSSProperties}> = ({text, start, pal, u, size, prompt, style}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const shown = Math.max(0, Math.min(text.length, Math.floor((frame - start) / 1.6)));
  const blink = Math.floor(frame / (fps / 2.5)) % 2 === 0 || shown < text.length;
  const bg = pal.light ? pal.text : mix(pal.bg, '#000000', 0.35);
  const fg = pal.light ? pal.bg : pal.text;
  return (
    <div style={{display: 'inline-flex', alignItems: 'center', gap: size * 0.55, padding: `${size * 0.55}px ${size * 0.8}px`, borderRadius: 14 * u, background: bg, border: `${2 * u}px solid ${alpha(pal.light ? pal.text : pal.line, 0.2)}`, boxShadow: `0 ${20 * u}px ${50 * u}px ${alpha('#000000', pal.light ? 0.15 : 0.4)}`, fontFamily: fonts.mono, fontSize: size, color: fg, maxWidth: '100%', boxSizing: 'border-box', ...style}}>
      <span style={{color: pal.accent, fontWeight: 700}}>{prompt}</span>
      <span style={{whiteSpace: 'pre', overflow: 'hidden', textOverflow: 'clip'}}>{text.slice(0, shown)}</span>
      <span style={{display: 'inline-block', width: size * 0.55, height: size * 1.1, background: pal.accent, opacity: blink ? 1 : 0, marginLeft: -size * 0.4}} />
    </div>
  );
};

type Ui = {pal: Pal; u: number; portrait: boolean; titleFont: string; panel: React.CSSProperties; titleSize: number; lift: number};

/** Mono accent kicker with a drawn rule. */
const Kicker: React.FC<{ui: Ui; start: number; children: React.ReactNode}> = ({ui: {pal, u}, start, children}) => {
  const f = useCurrentFrame();
  return (
    <div style={{fontFamily: fonts.mono, fontSize: 24 * u, letterSpacing: '0.24em', textTransform: 'uppercase', color: ink(pal), display: 'flex', alignItems: 'center', gap: 16 * u, opacity: progress(f, start, 12)}}>
      <div style={{width: 36 * u * progress(f, start, 16), height: 2 * u, background: pal.accent}} />
      {children}
    </div>
  );
};

/** Intro scene: title over a terminal that types the starting command. */
const IntroPanel: React.FC<{ui: Ui; title: string; command: string; n: number}> = ({ui, title, command, n}) => {
  const f = useCurrentFrame();
  const {width} = useVideoConfig();
  const {pal, u, portrait} = ui;
  return (
    <AbsoluteFill style={{justifyContent: 'center', alignItems: 'center', padding: `0 ${width * 0.08}px`, paddingBottom: ui.lift}}>
      <div style={{marginBottom: 30 * u}}>
        <Kicker ui={ui} start={0}>Tutorial · {n} steps</Kicker>
      </div>
      <KineticText text={title} start={4} stagger={3} style="rise" align="center" accent={pal.accent} textStyle={{fontFamily: ui.titleFont, fontWeight: 700, fontSize: (portrait ? 96 : 92) * u, lineHeight: 1.04, letterSpacing: '-0.02em', color: pal.text, maxWidth: portrait ? width * 0.86 : width * 0.7}} />
      {command ? (
        <div style={{marginTop: 60 * u, width: portrait ? '92%' : '56%', opacity: progress(f, 14, 12), transform: `translateY(${(1 - progress(f, 14, 18)) * 30 * u}px)`}}>
          <Terminal text={command} start={20} pal={pal} u={u} size={Math.min((portrait ? 40 : 36) * u, (width * (portrait ? 0.66 : 0.44)) / ((command.length + 3) * 0.62))} prompt="›" style={{width: '100%', padding: `${34 * u}px ${36 * u}px`}} />
        </div>
      ) : null}
    </AbsoluteFill>
  );
};

/** Step scene: kicker, instruction, why-sentence and an optional typed command. */
const StepPanel: React.FC<{ui: Ui; step: Props['steps'][number]; i: number; n: number}> = ({ui, step, i, n}) => {
  const f = useCurrentFrame();
  const {width} = useVideoConfig();
  const {pal, u, portrait} = ui;
  return (
    <div style={{position: 'absolute', ...ui.panel, color: pal.text}}>
      <Kicker ui={ui} start={2}>
        Step {String(i + 1).padStart(2, '0')}
        <span style={{color: pal.muted, letterSpacing: '0.12em'}}>/ {String(n).padStart(2, '0')}</span>
      </Kicker>
      <div style={{marginTop: 18 * u}}>
        <KineticText text={step.title} start={6} stagger={3} style="rise" accent={pal.accent} textStyle={{fontFamily: ui.titleFont, fontWeight: 700, fontSize: ui.titleSize, lineHeight: 1.05, letterSpacing: '-0.02em'}} />
      </div>
      {step.detail ? <div style={{marginTop: 20 * u, fontFamily: fonts.sans, fontSize: (portrait ? 34 : 32) * u, lineHeight: 1.38, color: pal.muted, opacity: progress(f, 14, 16), transform: `translateY(${(1 - progress(f, 14, 20)) * 14 * u}px)`, maxWidth: portrait ? '100%' : width * 0.36}}>{step.detail}</div> : null}
      {step.code ? (
        <div style={{marginTop: 26 * u, opacity: progress(f, 20, 10), transform: `translateY(${(1 - progress(f, 20, 16)) * 16 * u}px)`}}>
          <Terminal text={step.code} start={26} pal={pal} u={u} size={28 * u} prompt="$" />
        </div>
      ) : null}
    </div>
  );
};

/** Recap scene: closing line while the camera orbits the finished stack. */
const RecapPanel: React.FC<{ui: Ui; text: string; n: number}> = ({ui, text, n}) => {
  const f = useCurrentFrame();
  const {pal, u} = ui;
  return (
    <div style={{position: 'absolute', ...ui.panel, color: pal.text}}>
      <Kicker ui={ui} start={2}>Recap</Kicker>
      <div style={{marginTop: 18 * u}}>
        <KineticText text={text} start={6} stagger={4} style="rise" accent={pal.accent} textStyle={{fontFamily: ui.titleFont, fontWeight: 700, fontSize: ui.titleSize * 1.08, lineHeight: 1.04, letterSpacing: '-0.02em'}} />
      </div>
      <div style={{marginTop: 26 * u, display: 'flex', alignItems: 'center', gap: 12 * u, fontFamily: fonts.mono, fontSize: 24 * u, letterSpacing: '0.14em', textTransform: 'uppercase', color: pal.muted, opacity: progress(f, 18, 14)}}>
        <LineIcon name="check" size={30 * u} color={pal.accent} strokeWidth={7} progress={progress(f, 18, 18)} />
        {n} layers · built
      </div>
    </div>
  );
};

const TechStackBuild: React.FC<EntryProps<Props>> = ({media, props}) => {
  const frame = useCurrentFrame();
  const {fps, width, height} = useVideoConfig();
  const look = useLook();
  const own = PALETTES[props.palette];
  const pal: Pal = look ? fromLook(look) : {...own, accent: media.accent ?? own.accent};
  const u = Math.min(width, height) / 1080;
  const portrait = height >= width;
  const timeline = useSceneTimeline(media);
  const contentEnd = useContentFrames(media);
  const steps = props.steps;
  const n = steps.length;
  const hasIntro = timeline.length > n;
  const off = hasIntro ? 1 : 0;
  const hasRecap = timeline.length > n + 1;
  const recapStart = hasRecap ? timeline[n + 1].from : Infinity;
  const introEnd = hasIntro ? timeline[1].from : 0;
  const mapped = timeline.length >= n + off;
  const stepStart = (i: number) => (mapped ? timeline[i + off].from : Math.round(introEnd + (i * (contentEnd - introEnd)) / n));
  const builds: Build[] = steps.map((_, i) => {
    const start = stepStart(i);
    const end = i < n - 1 ? stepStart(i + 1) : Math.min(contentEnd, recapStart);
    const fly = start + Math.round(0.15 * fps);
    const dur = Math.max(0.9 * fps, Math.min(2.0 * fps, (end - start) * 0.42));
    const land = Math.max(fly + 6, Math.min(Math.round(fly + dur), contentEnd - Math.round(0.4 * fps)));
    return {start, end, fly, land};
  });
  const current = frame >= recapStart ? -1 : builds.reduce((c, b, i) => (frame >= b.start - 2 ? i : c), -1);

  // Layout zones.
  const safe = captionSafeBottom(look);
  const railY = look ? height * (1 - safe) - 46 * u : height * (portrait ? 0.935 : 0.9);
  const tagW = 300 * u;
  const zoneTop = portrait ? height * 0.34 : height * 0.12;
  const zoneBot = look ? railY - 90 * u : portrait ? height * 0.79 : height * 0.72;
  const zoneLeft = portrait ? width * 0.05 : width * 0.46;
  const zoneRight = width - tagW - 70 * u;
  const H = stackHeight(n);
  const S = Math.min((zoneRight - zoneLeft) / (2 * HD), (zoneBot - zoneTop) / (H * Math.cos(PITCH) + 2 * HD * Math.sin(PITCH)));
  const total = S * (H * Math.cos(PITCH) + 2 * HD * Math.sin(PITCH));
  const by = zoneBot - (zoneBot - zoneTop - total) / 2 - HD * Math.sin(PITCH) * S;
  const cx = (zoneLeft + zoneRight) / 2;
  const tagX = cx + HD * S + 34 * u;

  // Camera: a slow sway, a settle bump when each layer lands, and an orbit on the recap.
  const t = frame / fps;
  const orbit = hasRecap ? tween(frame, [recapStart, recapStart + 3.5 * fps], [0, 0.85], ease.cinematic) : 0;
  const yaw = 0.62 + 0.12 * Math.sin(t * 0.42) + orbit;
  const bump = builds.reduce((acc, b) => {
    const p = progress(frame, b.land, 14, ease.expo);
    return acc + (frame >= b.land ? Math.sin(p * Math.PI) * 7 * u : 0);
  }, 0);
  const proj = makeProj(cx, by + bump, S, yaw);
  const floorProj = makeProj(cx, by, S, yaw);
  const stackIn = hasIntro ? progress(frame, introEnd - 10, 18, ease.cinematic) : progress(frame, 0, 12);

  const ui: Ui = {
    pal,
    u,
    portrait,
    titleFont: look?.font.display ?? fonts.grotesk,
    panel: portrait ? {left: width * 0.07, right: width * 0.07, top: height * 0.065} : {left: width * 0.06, width: width * 0.36, top: height * 0.13},
    titleSize: (portrait ? 78 : 70) * u,
    lift: look ? height * safe * 0.6 : 0,
  };

  return (
    <AbsoluteFill style={{overflow: 'hidden', background: pal.bg}}>
      <AbsoluteFill style={{background: `radial-gradient(ellipse 80% 60% at 50% ${portrait ? 52 : 50}%, ${pal.bg2} 0%, ${pal.bg} 75%)`}} />
      <Floor proj={floorProj} cx={cx} by={by} pal={pal} u={u} />
      <Particles count={34} color={pal.accent} opacity={pal.light ? 0.35 : 0.45} seed="stack" speed={0.35} size={[2, 5]} />
      <Stack steps={steps} builds={builds} pal={pal} proj={proj} yaw={yaw} tagX={tagX} u={u} current={current} appear={stackIn} />
      <SceneSeries
        media={media}
        overlap={Math.round(0.45 * fps)}
        transition={i => (i === 0 && hasIntro ? 'zoom' : 'slide-up')}
        renderScene={({index}) => {
          if (index < off) return <IntroPanel ui={ui} title={props.title} command={props.command} n={n} />;
          const i = index - off;
          if (i < n) return <StepPanel ui={ui} step={steps[i]} i={i} n={n} />;
          return <RecapPanel ui={ui} text={props.outro || props.title} n={n} />;
        }}
      />
      <Rail steps={steps} builds={builds} pal={pal} y={railY} u={u} current={current} />
      {builds.map((b, i) => <LightLeak key={i} from={Math.max(0, b.land - 6)} durationInFrames={Math.round(0.9 * fps)} seed={i * 5 + 2} opacity={pal.light ? 0.12 : 0.28} />)}
      {props.showCaptions
        ? timeline.map(tl => (
            <Sequence key={tl.index} from={tl.from} durationInFrames={tl.durationInFrames}>
              <AbsoluteFill style={{justifyContent: 'flex-end', padding: portrait ? `0 7% ${height - railY + 70 * u}px` : `0 18% ${height - railY + 60 * u}px`}}>
                <StyledCaptions scene={tl.scene} variant="box" accent={pal.accent} color={pal.text} font={fonts.sans} size={(portrait ? 46 : 42) * u} words={5} shadow={!pal.light} />
              </AbsoluteFill>
            </Sequence>
          ))
        : null}
      <Vignette strength={pal.light ? 0.2 : 0.55} />
      <Grain opacity={0.05} />
      <NarrationTrack media={media} />
      <AdWeave media={media} theme={{background: pal.bg, text: pal.text, font: fonts.sans}} />
    </AbsoluteFill>
  );
};

export default defineEntry({id: 'tutorial-tech-stack-build', schema: Props, component: TechStackBuild});
