import React from 'react';
import {AbsoluteFill, Sequence, useCurrentFrame, useVideoConfig} from 'remotion';
import {AdWeave, NarrationTrack, captionSafeBottom, defineEntry, mix, useContentFrames, useLook, useSceneTimeline, type ActiveLook, type EntryProps} from '@viralaunch/kit';
import {Grain, GridLines, KineticText, LightLeak, LineIcon, Particles, StyledCaptions, Vignette, alpha, countUp, ease, fonts, glow, progress, rand} from '@viralaunch/kit/fx';
import {Props, type Stage, type Step} from './schema';

type Pal = {bg: string; bg2: string; surface: string; text: string; muted: string; accent: string; line: string; packet: string; dark: boolean};

const PALETTES: Record<Props['palette'], Pal> = {
  midnight: {bg: '#080d1c', bg2: '#16203d', surface: '#101830', text: '#eef2ff', muted: '#8890b0', accent: '#5b8cff', line: '#c9d4ff', packet: '#8fd8ff', dark: true},
  graphite: {bg: '#0c0c0e', bg2: '#1f1f25', surface: '#17171b', text: '#f5f5f7', muted: '#9a9aa3', accent: '#ff7a3d', line: '#e6e6ea', packet: '#ffc08f', dark: true},
  studio: {bg: '#eef0f5', bg2: '#dce1ec', surface: '#ffffff', text: '#141a2b', muted: '#687089', accent: '#2f5bff', line: '#141a2b', packet: '#2f5bff', dark: false},
};

/** The schematic in a sequence's shared look: backgrounds, panels, strokes and accent from the look. */
const fromLook = (l: ActiveLook): Pal => ({
  bg: l.palette.bg,
  bg2: l.palette.bg2,
  surface: l.palette.surface,
  text: l.palette.text,
  muted: l.palette.muted,
  // light looks (paper's yellow) need a deeper accent for thin strokes and small labels
  accent: l.tone === 'light' ? mix(l.palette.accent, l.palette.text, 0.3) : l.palette.accent,
  line: l.palette.line,
  packet: l.tone === 'light' ? mix(l.palette.accent, l.palette.text, 0.3) : mix(l.palette.accent, '#ffffff', 0.35),
  dark: l.tone === 'dark',
});

const pad2 = (n: number) => String(n).padStart(2, '0');

// ---------------------------------------------------------------------------------------------
// Diagram: the whole process as a pipeline of modules on a rail, panned to the active stage
// ---------------------------------------------------------------------------------------------

type DiagramCtx = {f: number; pal: Pal; u: number; stages: Stage[]; pos: number; active: number; drawFrom: number; flowLabel: string; fps: number};

const Pipeline: React.FC<{c: DiagramCtx; w: number; h: number}> = ({c, w, h}) => {
  const {f, pal, u, stages, pos, active, drawFrom, flowLabel, fps} = c;
  const n = stages.length;
  const spacing = Math.max(w * 0.34, Math.min(w * 0.46, h * 0.95));
  const m = Math.min(h * 0.4, spacing * 0.56);
  const railY = h * 0.47;
  const x0 = w / 2 - pos * spacing;
  const xs = stages.map((_, i) => i * spacing);
  const railFrom = -spacing * 0.9;
  const railTo = xs[n - 1] + spacing * 0.9;
  const activeX = xs[active];
  const nameSize = Math.max(18, m * 0.2);
  // packets stream from the left edge into the active module, then get absorbed
  const packets = Array.from({length: 7}, (_, i) => {
    const run = activeX - m * 0.5 - railFrom;
    const t = ((f * 2.4 * u + rand(`pk${i}`, 0, 1) * run + (i * run) / 7) % run + run) % run;
    const x = railFrom + t;
    const fade = Math.min(1, t / (spacing * 0.3), (run - t) / (m * 0.4));
    return {x, fade: Math.max(0, fade), i};
  });
  const lead = packets.reduce((a, b) => (b.x > a.x && b.x < activeX - m * 0.9 ? b : a), packets[0]);
  return (
    <div style={{position: 'absolute', left: 0, top: 0, width: w, height: h, transform: `translateX(${x0}px)`}}>
      <svg width={railTo - railFrom} height={h} style={{position: 'absolute', left: railFrom, top: 0, overflow: 'visible'}}>
        {/* rail: the done part glows in accent, the rest is a faint double line */}
        <line x1={0} x2={railTo - railFrom} y1={railY} y2={railY} stroke={alpha(pal.line, 0.18)} strokeWidth={10 * u} strokeLinecap="round" />
        <line x1={0} x2={railTo - railFrom} y1={railY} y2={railY} stroke={alpha(pal.line, 0.35)} strokeWidth={2 * u} strokeDasharray={`${6 * u} ${10 * u}`} strokeDashoffset={-f * 1.5 * u} />
        <line x1={0} x2={activeX - railFrom} y1={railY} y2={railY} stroke={pal.accent} strokeWidth={4 * u} strokeLinecap="round" style={{filter: `drop-shadow(0 0 ${8 * u}px ${alpha(pal.accent, 0.9)})`}} />
        {/* support struts under every module */}
        {xs.map((x, i) => (
          <g key={i} opacity={i <= active ? 0.7 : 0.3}>
            <line x1={x - railFrom - m * 0.3} x2={x - railFrom - m * 0.3} y1={railY + m * 0.5} y2={railY + m * 0.5 + h * 0.08} stroke={pal.line} strokeWidth={1.5 * u} />
            <line x1={x - railFrom + m * 0.3} x2={x - railFrom + m * 0.3} y1={railY + m * 0.5} y2={railY + m * 0.5 + h * 0.08} stroke={pal.line} strokeWidth={1.5 * u} />
          </g>
        ))}
      </svg>
      {packets.map(p => (
        <div key={p.i} style={{position: 'absolute', left: p.x - 14 * u, top: railY - 7 * u, width: 28 * u, height: 14 * u, borderRadius: 4 * u, background: pal.packet, opacity: p.fade, boxShadow: pal.dark ? glow(pal.packet, 0.6 * u) : `0 ${2 * u}px ${6 * u}px ${alpha(pal.text, 0.25)}`, transform: `skewX(-18deg)`}} />
      ))}
      {flowLabel ? (
        <div style={{position: 'absolute', left: lead.x, top: railY - 50 * u, transform: 'translateX(-50%)', opacity: lead.fade, fontFamily: fonts.mono, fontSize: 18 * u, letterSpacing: '0.16em', textTransform: 'uppercase', color: pal.packet, whiteSpace: 'nowrap'}}>
          {flowLabel}
        </div>
      ) : null}
      {stages.map((s, i) => {
        const isActive = i === active;
        const done = i < active;
        const lit = isActive ? progress(f, drawFrom, 14, ease.overshoot) : 0;
        const pulse = isActive ? 0.5 + 0.5 * Math.sin(f / 9) : 0;
        const draw = isActive ? progress(f, drawFrom + 4, Math.round(fps * 1.1), ease.cinematic) : 1;
        const ring = isActive ? ((f - drawFrom) % 45) / 45 : 0;
        const border = isActive ? pal.accent : done ? alpha(pal.accent, 0.55) : alpha(pal.line, 0.25);
        return (
          <div key={i} style={{position: 'absolute', left: xs[i] - m / 2, top: railY - m / 2, width: m, height: m}}>
            {isActive && f >= drawFrom ? (
              <div style={{position: 'absolute', inset: -m * 0.12 - ring * m * 0.35, borderRadius: 26 * u + ring * 20 * u, border: `${2 * u}px solid ${alpha(pal.accent, (1 - ring) * 0.6)}`}} />
            ) : null}
            <div
              style={{
                position: 'absolute',
                inset: 0,
                borderRadius: 22 * u,
                background: `linear-gradient(160deg, ${mix(pal.surface, pal.line, pal.dark ? 0.08 : 0.02)} 0%, ${pal.surface} 70%)`,
                border: `${2 * u}px solid ${border}`,
                boxShadow: isActive ? `0 0 ${(30 + 20 * pulse) * u}px ${alpha(pal.accent, pal.dark ? 0.45 : 0.25)}, 0 ${20 * u}px ${50 * u}px ${alpha('#000000', pal.dark ? 0.5 : 0.12)}` : `0 ${14 * u}px ${36 * u}px ${alpha('#000000', pal.dark ? 0.45 : 0.1)}`,
                transform: `scale(${1 + 0.08 * lit})`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                opacity: isActive || done ? 1 : 0.55,
              }}
            >
              <LineIcon name={s.icon} progress={draw} size={m * 0.52} color={isActive ? pal.accent : done ? pal.line : alpha(pal.line, 0.6)} strokeWidth={3.4} />
              <div style={{position: 'absolute', left: 12 * u, top: 10 * u, fontFamily: fonts.mono, fontSize: 15 * u, color: isActive ? pal.accent : pal.muted}}>{pad2(i + 1)}</div>
              {done ? (
                <div style={{position: 'absolute', right: 10 * u, top: 10 * u, width: 18 * u, height: 18 * u, borderRadius: '50%', background: pal.accent, opacity: 0.85}} />
              ) : null}
            </div>
            <div style={{position: 'absolute', top: m + 18 * u + lit * m * 0.04, left: -spacing * 0.2, right: -spacing * 0.2, textAlign: 'center'}}>
              <div style={{fontFamily: fonts.sans, fontWeight: 700, fontSize: nameSize, color: isActive ? pal.text : pal.muted, lineHeight: 1.1}}>{s.name}</div>
              {s.tag ? <div style={{fontFamily: fonts.mono, fontSize: nameSize * 0.62, letterSpacing: '0.12em', textTransform: 'uppercase', color: isActive ? pal.accent : alpha(pal.muted, 0.8), marginTop: 6 * u}}>{s.tag}</div> : null}
            </div>
          </div>
        );
      })}
    </div>
  );
};

/** Rounded schematic panel with a static dot grid; only the pipeline inside it moves. */
const DiagramPanel: React.FC<{c: DiagramCtx; x: number; y: number; w: number; h: number; opacity: number}> = ({c, x, y, w, h, opacity}) => {
  const {pal, u, stages, active, f, drawFrom} = c;
  return (
    <div style={{position: 'absolute', left: x, top: y, width: w, height: h, opacity, borderRadius: 26 * u, overflow: 'hidden', background: `linear-gradient(180deg, ${alpha(pal.surface, pal.dark ? 0.55 : 0.75)} 0%, ${alpha(pal.bg2, pal.dark ? 0.35 : 0.5)} 100%)`, border: `${1.5 * u}px solid ${alpha(pal.line, 0.14)}`}}>
      <GridLines color={pal.line} step={Math.round(34 * u)} opacity={pal.dark ? 0.12 : 0.18} dots drift={0} />
      <Pipeline c={c} w={w} h={h} />
      {/* edge fades so modules slide in and out of the panel */}
      <div style={{position: 'absolute', inset: 0, background: `linear-gradient(90deg, ${alpha(pal.bg, 0.9)} 0%, transparent 14%, transparent 86%, ${alpha(pal.bg, 0.9)} 100%)`}} />
      <div style={{position: 'absolute', left: 22 * u, top: 18 * u, fontFamily: fonts.mono, fontSize: 16 * u, letterSpacing: '0.2em', textTransform: 'uppercase', color: pal.muted}}>
        Fig. {pad2(active + 1)} <span style={{color: pal.accent, opacity: progress(f, drawFrom, 12)}}>— {stages[active].name}</span>
      </div>
      <div style={{position: 'absolute', right: 22 * u, top: 18 * u, fontFamily: fonts.mono, fontSize: 16 * u, letterSpacing: '0.2em', color: pal.muted}}>
        {pad2(active + 1)}/{pad2(stages.length)}
      </div>
    </div>
  );
};

/** Bottom stepper: every stage on one line, filled up to the current position. */
const Stepper: React.FC<{c: DiagramCtx; x: number; y: number; w: number; size: number; opacity: number}> = ({c, x, y, w, size, opacity}) => {
  const {pal, u, stages, pos, active} = c;
  const n = stages.length;
  const cell = w / n;
  return (
    <div style={{position: 'absolute', left: x, top: y, width: w, opacity}}>
      <div style={{position: 'absolute', left: cell / 2, right: cell / 2, top: 7 * u, height: 2 * u, background: alpha(pal.line, 0.16)}} />
      <div style={{position: 'absolute', left: cell / 2, top: 7 * u, height: 2 * u, width: pos * cell, background: pal.accent, boxShadow: pal.dark ? glow(pal.accent, 0.4 * u) : 'none'}} />
      {stages.map((s, i) => {
        const on = i === active;
        const done = i < active;
        return (
          <div key={i} style={{position: 'absolute', left: i * cell, width: cell, top: 0, display: 'flex', flexDirection: 'column', alignItems: 'center'}}>
            <div style={{width: (on ? 16 : 12) * u, height: (on ? 16 : 12) * u, marginTop: (on ? 0 : 2) * u, borderRadius: '50%', background: on || done ? pal.accent : pal.bg, border: `${2 * u}px solid ${on || done ? pal.accent : alpha(pal.line, 0.35)}`, boxShadow: on && pal.dark ? glow(pal.accent, 0.5 * u) : 'none'}} />
            <div style={{marginTop: (on ? 12 : 14) * u, padding: `0 ${6 * u}px`, fontFamily: fonts.sans, fontWeight: on ? 700 : 500, fontSize: size, lineHeight: 1.15, textAlign: 'center', color: on ? pal.text : alpha(pal.muted, done ? 1 : 0.75)}}>{s.name}</div>
          </div>
        );
      })}
    </div>
  );
};

// ---------------------------------------------------------------------------------------------
// Text column: eyebrow, heading, bullets, stat card
// ---------------------------------------------------------------------------------------------

const Chevron: React.FC<{color: string; size: number}> = ({color, size}) => (
  <svg width={size} height={size} viewBox="0 0 20 20" style={{flex: 'none', marginTop: size * 0.22}}>
    <path d="M6 3 L14 10 L6 17" fill="none" stroke={color} strokeWidth={2.8} strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const Points: React.FC<{step: Step; pal: Pal; u: number; k: number; pointAt: number[]; statAt: number; f: number}> = ({step, pal, u, k, pointAt, statAt, f}) => {
  const size = 36 * u * k;
  const newest = pointAt.reduce((acc, t, j) => (f >= t ? j : acc), -1);
  return (
    <div style={{display: 'flex', flexDirection: 'column', gap: 22 * u * k}}>
      {step.points.map((pt, j) => {
        const p = progress(f, pointAt[j], 16, ease.expo);
        return (
          <div key={j} style={{display: 'flex', gap: 14 * u * k, alignItems: 'flex-start', opacity: p, transform: `translateX(${(1 - p) * -30 * u}px)`}}>
            <Chevron color={j === newest ? pal.accent : alpha(pal.accent, 0.6)} size={size * 0.8} />
            <div style={{fontFamily: fonts.sans, fontWeight: 500, fontSize: size, lineHeight: 1.3, color: j === newest ? pal.text : mix(pal.text, pal.muted, 0.35)}}>{pt}</div>
          </div>
        );
      })}
      {step.stat ? (
        <div style={{marginTop: 10 * u * k, paddingLeft: 22 * u * k, borderLeft: `${4 * u}px solid ${pal.accent}`, opacity: progress(f, statAt, 12), transform: `translateY(${(1 - progress(f, statAt, 18, ease.expo)) * 24 * u}px)`}}>
          <div style={{fontFamily: fonts.heavy, fontSize: 92 * u * k, lineHeight: 1, letterSpacing: '-0.02em', color: pal.accent}}>
            {countUp(f, step.stat.value, statAt, 36, step.stat.decimals)}
            {step.stat.unit ? <span style={{fontFamily: fonts.sans, fontWeight: 800, fontSize: 38 * u * k, marginLeft: 12 * u, color: pal.text}}>{step.stat.unit}</span> : null}
          </div>
          <div style={{fontFamily: fonts.sans, fontSize: 26 * u * k, lineHeight: 1.3, color: pal.muted, marginTop: 8 * u}}>{step.stat.label}</div>
        </div>
      ) : null}
    </div>
  );
};

// ---------------------------------------------------------------------------------------------
// Title card: kicker, title and an overview of the whole pipeline lighting up
// ---------------------------------------------------------------------------------------------

const TitleCard: React.FC<{props: Props; pal: Pal; u: number; portrait: boolean; end: number; bottom: number}> = ({props, pal, u, portrait, end, bottom}) => {
  const f = useCurrentFrame();
  const {width, height} = useVideoConfig();
  const out = progress(f, end - 10, 14, ease.accelerate);
  const n = props.stages.length;
  const padX = width * (portrait ? 0.07 : 0.07);
  const rowW = width - padX * 2;
  const cell = rowW / n;
  const icon = Math.min(cell * 0.5, 120 * u);
  const rowY = portrait ? height * 0.62 - bottom * 0.4 : height * 0.7 - bottom * 0.45;
  const rail = progress(f, 16, 40, ease.cinematic);
  return (
    <AbsoluteFill style={{opacity: 1 - out, transform: `scale(${1 + out * 0.06})`}}>
      <div style={{position: 'absolute', left: padX, right: padX, top: portrait ? height * 0.16 : height * 0.16}}>
        {props.kicker ? (
          <div style={{display: 'flex', alignItems: 'center', gap: 16 * u, marginBottom: 26 * u, opacity: progress(f, 2, 14)}}>
            <div style={{width: 46 * u * progress(f, 2, 18, ease.expo), height: 2 * u, background: pal.accent}} />
            <div style={{fontFamily: fonts.mono, fontSize: 24 * u, letterSpacing: '0.24em', textTransform: 'uppercase', color: pal.accent}}>{props.kicker}</div>
          </div>
        ) : null}
        <KineticText text={props.title} start={6} stagger={3} style="rise" accent={pal.accent} textStyle={{fontFamily: fonts.sans, fontWeight: 800, fontSize: (portrait ? 96 : 92) * u, lineHeight: 1.04, letterSpacing: '-0.025em', color: pal.text, maxWidth: portrait ? rowW : rowW * 0.8}} />
        {props.subtitle ? <KineticText text={props.subtitle} start={22} stagger={2} style="blur" textStyle={{fontFamily: fonts.sans, fontWeight: 400, fontSize: 38 * u, lineHeight: 1.3, color: pal.muted, marginTop: 24 * u, maxWidth: rowW * 0.8}} /> : null}
      </div>
      <svg width={rowW} height={20 * u} style={{position: 'absolute', left: padX, top: rowY - 10 * u, overflow: 'visible'}}>
        <line x1={cell / 2} x2={cell / 2 + (rowW - cell) * rail} y1={10 * u} y2={10 * u} stroke={pal.accent} strokeWidth={3 * u} strokeLinecap="round" style={{filter: pal.dark ? `drop-shadow(0 0 ${6 * u}px ${alpha(pal.accent, 0.8)})` : undefined}} />
      </svg>
      {props.stages.map((s, i) => {
        const at = 16 + (i / Math.max(1, n - 1)) * 40;
        const p = progress(f, at - 4, 16, ease.overshoot);
        return (
          <div key={i} style={{position: 'absolute', left: padX + i * cell, width: cell, top: rowY - icon * 0.7, display: 'flex', flexDirection: 'column', alignItems: 'center', opacity: Math.min(1, p * 2), transform: `translateY(${(1 - p) * 20 * u}px)`}}>
            <div style={{width: icon * 1.4, height: icon * 1.4, borderRadius: 22 * u, background: pal.surface, border: `${2 * u}px solid ${alpha(pal.accent, 0.7)}`, display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: pal.dark ? `0 0 ${24 * u}px ${alpha(pal.accent, 0.3)}` : `0 ${10 * u}px ${24 * u}px ${alpha(pal.text, 0.12)}`}}>
              <LineIcon name={s.icon} progress={progress(f, at, 26, ease.cinematic)} size={icon * 0.8} color={pal.accent} strokeWidth={3.4} />
            </div>
            <div style={{marginTop: 14 * u, fontFamily: fonts.sans, fontWeight: 600, fontSize: Math.min(28 * u, cell * 0.14), color: pal.text, textAlign: 'center', padding: `0 ${6 * u}px`}}>{s.name}</div>
          </div>
        );
      })}
    </AbsoluteFill>
  );
};

// ---------------------------------------------------------------------------------------------
// The explainer
// ---------------------------------------------------------------------------------------------

const PhysicsDiagram: React.FC<EntryProps<Props>> = ({media, props}) => {
  const f = useCurrentFrame();
  const {fps, width, height, durationInFrames} = useVideoConfig();
  const look = useLook();
  const base = PALETTES[props.palette];
  const pal: Pal = look ? fromLook(look) : {...base, accent: media.accent ?? base.accent, packet: media.accent ? mix(media.accent, base.dark ? '#ffffff' : '#000000', 0.3) : base.packet};
  const u = Math.min(width, height) / 1080;
  const portrait = height >= width;
  const timeline = useSceneTimeline(media);
  const content = useContentFrames(media);
  const steps = props.steps;
  const stages = props.stages;
  const stageOf = (i: number) => Math.min(stages.length, Math.max(1, steps[i].stage ?? Math.min(i + 1, stages.length))) - 1;

  // Timing: an extra first narration line is the title card, then one line per step. With fewer
  // lines than steps, steps share the remaining time evenly. Everything ends before the end card.
  const intro = timeline.length > steps.length ? 1 : 0;
  const introEnd = intro ? Math.min(timeline[1].from, content - steps.length * 12) : 0;
  const aligned = timeline.length >= steps.length + intro;
  const starts = steps.map((_, i) => (aligned ? Math.min(timeline[i + intro].from, content - (steps.length - i) * 12) : Math.round(introEnd + ((content - introEnd) * i) / steps.length)));
  const ends = steps.map((_, i) => (i === steps.length - 1 ? content : starts[i + 1]));
  const current = starts.reduce((acc, s, i) => (f >= s ? i : acc), 0);
  const overlap = Math.round(0.45 * fps);

  // Diagram camera: glide from the previous step's stage to this one.
  const active = stageOf(current);
  const prev = current > 0 ? stageOf(current - 1) : active;
  const pos = prev + (active - prev) * progress(f, starts[current], Math.round(0.9 * fps), ease.cinematic);
  let first = current;
  while (first > 0 && stageOf(first - 1) === active) first--;
  const drawFrom = starts[first] + (first === 0 && !intro ? 6 : Math.round(0.35 * fps));
  const ctx: DiagramCtx = {f, pal, u, stages, pos, active, drawFrom, flowLabel: props.flowLabel, fps};

  // Layout: header band, body (text column + schematic panel), stepper, then caption room.
  const padX = width * (portrait ? 0.07 : 0.06);
  const top = height * (portrait ? 0.06 : 0.075);
  const bottom = look ? captionSafeBottom(look) * height : props.showCaptions ? height * (portrait ? 0.13 : 0.13) : height * 0.05;
  const stepperH = (portrait ? 96 : 84) * u;
  const stepperY = height - bottom - stepperH;
  const headerH = (portrait ? 250 : 180) * u;
  const bodyY = top + headerH;
  const bodyH = stepperY - bodyY - 30 * u;
  const innerW = width - padX * 2;
  const colW = portrait ? innerW : innerW * 0.4;
  const panel = portrait
    ? {x: padX, y: bodyY, w: innerW, h: Math.min(bodyH * 0.52, innerW * 0.78)}
    : {x: padX + colW + innerW * 0.04, y: bodyY, w: innerW * 0.56, h: bodyH};
  const textY = portrait ? panel.y + panel.h + 40 * u : bodyY + 10 * u;
  const textH = portrait ? stepperY - textY - 30 * u : bodyH - 10 * u;
  const k = Math.max(0.6, Math.min(portrait ? 1.22 : 1, textH / ((portrait ? 520 : 470) * u)));

  const layoutIn = intro ? progress(f, introEnd - 6, 20, ease.expo) : progress(f, 0, 16, ease.expo);
  return (
    <AbsoluteFill style={{background: pal.bg, overflow: 'hidden'}}>
      {/* static backdrop: soft second tone glow behind the diagram */}
      <AbsoluteFill style={{background: `radial-gradient(ellipse 70% 60% at ${portrait ? '50% 40%' : '70% 50%'}, ${alpha(pal.bg2, 0.95)} 0%, ${pal.bg} 75%)`}} />
      <Particles count={26} color={pal.line} opacity={pal.dark ? 0.18 : 0.12} seed="schematic" speed={0.18} size={[1.2, 3]} />

      {/* schematic panel and stepper persist across steps */}
      <div style={{position: 'absolute', inset: 0, opacity: layoutIn, transform: `translateY(${(1 - layoutIn) * 30 * u}px)`}}>
        <DiagramPanel c={ctx} {...panel} opacity={1} />
        <Stepper c={ctx} x={padX} y={stepperY + 10 * u} w={innerW} size={(portrait ? 22 : 22) * u} opacity={1} />
      </div>

      {steps.map((step, i) => {
        const s = starts[i];
        const e = ends[i];
        const from = i === 0 ? s : s - overlap / 2;
        const to = i === steps.length - 1 ? durationInFrames : e + overlap / 2;
        if (f < from || f >= to) return null;
        const enter = i === 0 ? (intro ? progress(f, introEnd - 6, overlap, ease.cinematic) : 1) : progress(f, from, overlap, ease.cinematic);
        const exit = i === steps.length - 1 ? 0 : progress(f, to - overlap, overlap, ease.cinematic);
        const D = Math.max(1, e - s);
        const skel = Math.round(Math.min(0.7 * fps, D * 0.2));
        const n = step.points.length + (step.stat ? 1 : 0);
        const slot = Math.max(4, (D * 0.62 - skel) / Math.max(1, n));
        const pointAt = step.points.map((_, j) => s + skel + j * slot);
        const statAt = Math.min(s + D * 0.72, s + skel + step.points.length * slot);
        const st = stages[stageOf(i)];
        return (
          <AbsoluteFill key={i} style={{opacity: Math.min(enter, 1 - exit), transform: `translateY(${(1 - enter) * 26 * u - exit * 20 * u}px)`, filter: `blur(${(1 - enter + exit) * 8}px)`}}>
            <div style={{position: 'absolute', left: padX, right: padX, top}}>
              <div style={{display: 'flex', alignItems: 'center', gap: 14 * u, marginBottom: 16 * u}}>
                <div style={{width: 40 * u * progress(f, s, 18, ease.expo), height: 2 * u, background: pal.accent}} />
                <div style={{fontFamily: fonts.mono, fontSize: 22 * u, letterSpacing: '0.22em', textTransform: 'uppercase', color: pal.accent, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis'}}>
                  Stage {stageOf(i) + 1} · {st.name}
                </div>
              </div>
              <KineticText text={step.heading} start={s - 2} stagger={3} style="rise" accent={pal.accent} textStyle={{fontFamily: fonts.sans, fontWeight: 800, fontSize: (portrait ? 64 : 62) * u, lineHeight: 1.08, letterSpacing: '-0.02em', color: pal.text}} />
            </div>
            <div style={{position: 'absolute', left: padX, top: textY, width: colW, height: textH, overflow: 'hidden'}}>
              <Points step={step} pal={pal} u={u} k={k} pointAt={pointAt} statAt={statAt} f={f} />
            </div>
          </AbsoluteFill>
        );
      })}

      {intro ? (
        <Sequence durationInFrames={introEnd + 14}>
          <TitleCard props={props} pal={pal} u={u} portrait={portrait} end={introEnd} bottom={bottom} />
        </Sequence>
      ) : null}
      <LightLeak from={0} durationInFrames={Math.round(2.2 * fps)} seed={11} hueShift={200} opacity={pal.dark ? 0.35 : 0.12} />
      {starts.slice(1).map((s, i) => (stageOf(i + 1) !== stageOf(i) ? <LightLeak key={i} from={s - 8} durationInFrames={Math.round(0.9 * fps)} seed={i * 5 + 3} hueShift={200} opacity={pal.dark ? 0.18 : 0.06} /> : null))}

      {props.showCaptions && !look
        ? timeline.map(t => (
            <Sequence key={t.index} from={t.from} durationInFrames={t.durationInFrames}>
              <AbsoluteFill style={{justifyContent: 'flex-end', alignItems: 'center', paddingBottom: height * (portrait ? 0.04 : 0.035), paddingLeft: '8%', paddingRight: '8%'}}>
                <StyledCaptions scene={t.scene} variant="minimal" color={pal.text} accent={pal.accent} font={fonts.sans} size={(portrait ? 44 : 38) * u} words={portrait ? 6 : 10} weight={600} shadow={pal.dark} />
              </AbsoluteFill>
            </Sequence>
          ))
        : null}

      <Vignette strength={pal.dark ? 0.55 : 0.15} />
      <Grain opacity={pal.dark ? 0.06 : 0.04} />
      <NarrationTrack media={media} />
      <AdWeave media={media} theme={{background: pal.bg, text: pal.text, font: fonts.sans}} />
    </AbsoluteFill>
  );
};

export default defineEntry({
  id: 'explainer-physics-diagram',
  schema: Props,
  component: PhysicsDiagram,
  // Shared captions wait for the title card (only present with one extra narration line).
  captionHold: ({props, media, fps}) => (media.scenes.length > props.steps.length ? Math.round((media.scenes[0]?.audio.duration ?? 0) * fps) : 0),
});
