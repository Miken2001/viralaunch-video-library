import React from 'react';
import {AbsoluteFill, Sequence, spring, useCurrentFrame, useVideoConfig} from 'remotion';
import {AdWeave, NarrationTrack, captionSafeBottom, defineEntry, mix, useContentFrames, useLook, useSceneTimeline, type ActiveLook, type EntryProps} from '@viralaunch/kit';
import {GridLines, Grain, KineticText, LightLeak, LineIcon, Particles, SceneSeries, StyledCaptions, Vignette, alpha, countUp, ease, fonts, progress, tween, type Widen} from '@viralaunch/kit/fx';
import {Props} from './schema';

const PALETTES = {
  neon: {tone: 'dark', bg: '#050605', bg2: '#15240a', surface: '#0e120b', text: '#f4f7ef', muted: '#8f9a86', accent: '#c6ff3d', line: '#e8f5d0', leak: 50},
  gold: {tone: 'dark', bg: '#08070a', bg2: '#22190a', surface: '#151209', text: '#fbf6ea', muted: '#a89f8a', accent: '#ffc94a', line: '#f5ead0', leak: 10},
  ocean: {tone: 'dark', bg: '#040a14', bg2: '#0b2140', surface: '#0c1626', text: '#eef6ff', muted: '#8aa0bd', accent: '#4fd8ff', line: '#dbeeff', leak: 170},
  ledger: {tone: 'light', bg: '#f4f1e8', bg2: '#e1ebd6', surface: '#fffdf8', text: '#16201a', muted: '#6c766d', accent: '#0f9d58', line: '#16201a', leak: 0},
} as const;
type Pal = Widen<(typeof PALETTES)[keyof typeof PALETTES]>;

/** The money path in a sequence's shared look: background, surfaces, ink and accent from the look. */
const fromLook = (l: ActiveLook): Pal => ({tone: l.tone, ...l.palette, leak: 0});

type Pt = {x: number; y: number};
type Step = Props['steps'][number];

/** Node positions of the path: evenly spaced, alternating above and below the centre line. */
function pathNodes(n: number, w: number, h: number): Pt[] {
  return Array.from({length: n}, (_, i) => ({x: w * (0.1 + 0.8 * (n > 1 ? i / (n - 1) : 0.5)), y: h * 0.5 + (i % 2 ? 1 : -1) * h * 0.2}));
}

/** Point on the S-curve between two nodes (horizontal tangents at both ends). */
function curve(a: Pt, b: Pt, t: number): Pt {
  const dx = (b.x - a.x) * 0.5;
  const c1 = {x: a.x + dx, y: a.y};
  const c2 = {x: b.x - dx, y: b.y};
  const m = 1 - t;
  return {
    x: m * m * m * a.x + 3 * m * m * t * c1.x + 3 * m * t * t * c2.x + t * t * t * b.x,
    y: m * m * m * a.y + 3 * m * m * t * c1.y + 3 * m * t * t * c2.y + t * t * t * b.y,
  };
}

/** Position along the whole path, p in [0, nodes-1]. */
function pointAt(nodes: Pt[], p: number): Pt {
  if (nodes.length < 2 || p <= 0) return nodes[0];
  const k = Math.min(Math.floor(p), nodes.length - 2);
  return curve(nodes[k], nodes[k + 1], Math.min(1, p - k));
}

/** SVG path of the travelled part of the curve, from node 0 to p. */
function trail(nodes: Pt[], p: number): string {
  const pts: Pt[] = [nodes[0]];
  const steps = Math.ceil(Math.max(0, p) * 28);
  for (let s = 1; s <= steps; s++) pts.push(pointAt(nodes, Math.min(p, s / 28)));
  return pts.map((q, i) => `${i ? 'L' : 'M'}${q.x.toFixed(1)},${q.y.toFixed(1)}`).join(' ');
}

function fullPath(nodes: Pt[], w: number, h: number): string {
  const lead = {x: -w * 0.02, y: nodes[0].y + h * 0.3};
  const tail = {x: w * 1.02, y: nodes[nodes.length - 1].y + (nodes.length % 2 ? 0.3 : -0.3) * h};
  const all = [lead, ...nodes, tail];
  return all
    .map((q, i) => {
      if (!i) return `M${q.x},${q.y}`;
      const a = all[i - 1];
      const dx = (q.x - a.x) * 0.5;
      return `C${a.x + dx},${a.y} ${q.x - dx},${q.y} ${q.x},${q.y}`;
    })
    .join(' ');
}

/** The neon "money path": one node per step, a glowing trail and an orb that travels to the current step. */
const MoneyPath: React.FC<{steps: Step[]; pal: Pal; p: number; orbIn: number; drawIn: number; top: number; h: number; t: number}> = ({steps, pal, p, orbIn, drawIn, top, h, t}) => {
  const frame = useCurrentFrame();
  const {width} = useVideoConfig();
  const dark = pal.tone === 'dark';
  const nodes = pathNodes(steps.length, width, h);
  const orb = pointAt(nodes, p);
  const r = 42 * t;
  const current = Math.round(p);
  return (
    <div style={{position: 'absolute', left: 0, top, width, height: h}}>
      <svg width={width} height={h} style={{position: 'absolute', inset: 0, overflow: 'visible', clipPath: `inset(-50% ${(1 - drawIn) * 100}% -50% -5%)`}}>
        <defs>
          <filter id="mstep-blur" x="-20%" y="-200%" width="140%" height="500%">
            <feGaussianBlur stdDeviation={9 * t} />
          </filter>
          <radialGradient id="mstep-orb">
            <stop offset="0%" stopColor={pal.accent} stopOpacity={dark ? 0.9 : 0.5} />
            <stop offset="35%" stopColor={pal.accent} stopOpacity={dark ? 0.35 : 0.18} />
            <stop offset="100%" stopColor={pal.accent} stopOpacity={0} />
          </radialGradient>
        </defs>
        <path d={fullPath(nodes, width, h)} fill="none" stroke={alpha(pal.line, dark ? 0.16 : 0.22)} strokeWidth={3 * t} strokeDasharray={`${2 * t} ${12 * t}`} strokeLinecap="round" />
        {orbIn > 0 ? (
          <g opacity={orbIn}>
            {dark ? <path d={trail(nodes, p)} fill="none" stroke={pal.accent} strokeWidth={16 * t} strokeLinecap="round" opacity={0.45} filter="url(#mstep-blur)" /> : null}
            <path d={trail(nodes, p)} fill="none" stroke={pal.accent} strokeWidth={5 * t} strokeLinecap="round" />
            <circle cx={orb.x} cy={orb.y} r={(90 + Math.sin(frame / 7) * 8) * t} fill="url(#mstep-orb)" />
            <circle cx={orb.x} cy={orb.y} r={11 * t} fill={dark ? '#ffffff' : pal.accent} />
          </g>
        ) : null}
      </svg>
      {nodes.map((n, i) => {
        const lit = orbIn > 0 ? tween(p, [i - 0.12, i], [0, 1], ease.snappy) : 0;
        const appear = tween(drawIn, [n.x / width - 0.08, n.x / width], [0, 1], ease.overshoot);
        const active = orbIn > 0 && i === current;
        const ring = (frame % 36) / 36;
        return (
          <div key={i} style={{position: 'absolute', left: n.x - r, top: n.y - r, width: r * 2, height: r * 2, transform: `scale(${appear * (1 + 0.14 * lit * (active ? 1 : 0.4))})`}}>
            {active ? <div style={{position: 'absolute', inset: 0, borderRadius: '50%', border: `${2 * t}px solid ${pal.accent}`, transform: `scale(${1 + ring * 0.9})`, opacity: (1 - ring) * 0.7}} /> : null}
            <div style={{position: 'absolute', inset: 0, borderRadius: '50%', background: lit > 0.5 ? mix(pal.surface, pal.accent, dark ? 0.16 : 0.1) : pal.surface, border: `${2 * t}px solid ${lit > 0.5 ? pal.accent : alpha(pal.line, 0.3)}`, boxShadow: lit > 0.5 && dark ? `0 0 ${28 * t}px ${alpha(pal.accent, 0.5)}` : `0 ${6 * t}px ${18 * t}px rgba(0,0,0,${dark ? 0.5 : 0.12})`, display: 'flex', alignItems: 'center', justifyContent: 'center'}}>
              <LineIcon name={steps[i].icon} size={r * 1.05} color={lit > 0.5 ? pal.accent : pal.muted} strokeWidth={5} progress={0.25 + 0.75 * Math.max(lit, i === 0 ? 0 : 0.3)} />
            </div>
            <div style={{position: 'absolute', left: -r, right: -r, top: n.y < h * 0.5 ? -r * 0.95 : r * 2.25, textAlign: 'center', fontFamily: fonts.mono, fontSize: 24 * t, letterSpacing: '0.18em', color: lit > 0.5 ? pal.accent : pal.muted}}>{String(i + 1).padStart(2, '0')}</div>
          </div>
        );
      })}
    </div>
  );
};

/** Glass chip with a figure, a label and a glowing status dot. */
const Chip: React.FC<{chip: Step['chips'][number]; pal: Pal; t: number; enter: number}> = ({chip, pal, t, enter}) => {
  const dark = pal.tone === 'dark';
  return (
    <div style={{flex: 1, minWidth: 0, position: 'relative', padding: `${22 * t}px ${26 * t}px`, borderRadius: 26 * t, background: dark ? `linear-gradient(160deg, ${alpha(pal.text, 0.11)}, ${alpha(pal.text, 0.03)})` : pal.surface, border: `${1.5 * t}px solid ${alpha(pal.text, dark ? 0.18 : 0.1)}`, boxShadow: dark ? `inset 0 ${1.5 * t}px 0 ${alpha(pal.text, 0.22)}, 0 ${24 * t}px ${50 * t}px rgba(0,0,0,.5)` : `0 ${16 * t}px ${36 * t}px ${alpha(pal.text, 0.12)}`, transform: `translateY(${(1 - enter) * 60 * t}px) rotateX(${(1 - enter) * 50}deg)`, opacity: Math.min(1, enter * 1.6)}}>
      <div style={{position: 'absolute', right: 18 * t, top: 18 * t, width: 12 * t, height: 12 * t, borderRadius: '50%', background: pal.accent, boxShadow: dark ? `0 0 ${14 * t}px ${pal.accent}` : 'none'}} />
      <div style={{fontFamily: fonts.grotesk, fontWeight: 700, fontSize: 58 * t, lineHeight: 1.05, color: pal.text, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'clip'}}>{chip.value}</div>
      {chip.label ? <div style={{fontFamily: fonts.sans, fontSize: 28 * t, marginTop: 6 * t, color: pal.muted}}>{chip.label}</div> : null}
    </div>
  );
};

/** One step: chapter label, kinetic headline, detail, glowing hero number and glass chips. */
const StepScene: React.FC<{step: Step; index: number; pal: Pal; t: number; lead: number; pace: number; colW: number; portrait: boolean}> = ({step, index, pal, t, lead, pace, colW, portrait}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const dark = pal.tone === 'dark';
  const at = (f: number) => lead + Math.round(f * pace);
  const labelIn = progress(frame, at(0), 16, ease.expo);
  const statIn = progress(frame, at(14), 18, ease.expo);
  const bar = progress(frame, at(18), Math.round(36 * pace), ease.cinematic);
  const stat = step.stat;
  const number = stat ? `${countUp(frame, stat.value, at(14), Math.round(40 * pace), stat.decimals)}` : '';
  const finalLen = stat ? (stat.prefix + stat.value.toLocaleString('en-US', {minimumFractionDigits: stat.decimals, maximumFractionDigits: stat.decimals}) + stat.suffix).length : 1;
  const statSize = Math.min((portrait ? 200 : 136) * t, (colW * 1.55) / Math.max(4, finalLen));
  const headline = (
    <>
      <div style={{display: 'flex', alignItems: 'center', gap: 16 * t, fontFamily: fonts.mono, fontSize: 28 * t, letterSpacing: '0.2em', textTransform: 'uppercase', opacity: labelIn, transform: `translateX(${(1 - labelIn) * -30 * t}px)`}}>
        <span style={{color: pal.accent}}>STEP {String(index + 1).padStart(2, '0')}</span>
        <span style={{width: 40 * t * labelIn, height: 2 * t, background: alpha(pal.accent, 0.7)}} />
        <span style={{color: pal.muted, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis'}}>{step.label}</span>
      </div>
      <div style={{marginTop: 22 * t}}>
        <KineticText text={step.headline} start={at(4)} stagger={Math.max(2, Math.round(3 * pace))} style="rise" accent={pal.accent} textStyle={{fontFamily: fonts.grotesk, fontWeight: 700, fontSize: (portrait ? 98 : 74) * t, lineHeight: 1.04, letterSpacing: '-0.025em', color: pal.text}} />
      </div>
      {step.detail ? <div style={{marginTop: 20 * t, fontFamily: fonts.sans, fontSize: (portrait ? 40 : 32) * t, lineHeight: 1.35, color: pal.muted, opacity: progress(frame, at(16), 16), transform: `translateY(${(1 - progress(frame, at(16), 16)) * 14 * t}px)`}}>{step.detail}</div> : null}
    </>
  );
  const figures = (
    <>
      {stat ? (
        <div style={{opacity: statIn, transform: `scale(${0.92 + 0.08 * statIn})`, transformOrigin: 'left center'}}>
          {stat.label ? <div style={{fontFamily: fonts.sans, fontSize: 34 * t, color: pal.muted, marginBottom: 4 * t}}>{stat.label}</div> : null}
          <div style={{fontFamily: fonts.grotesk, fontWeight: 700, fontSize: statSize, lineHeight: 1, letterSpacing: '-0.04em', color: pal.text, whiteSpace: 'nowrap', textShadow: dark ? `0 0 ${24 * t}px ${alpha(pal.text, 0.35)}, 0 0 ${80 * t}px ${alpha(pal.accent, 0.35)}` : 'none'}}>
            <span style={{color: pal.accent}}>{stat.prefix}</span>
            {number}
            <span style={{fontSize: statSize * 0.5, letterSpacing: '-0.01em', color: pal.accent}}>{stat.suffix}</span>
          </div>
          <div style={{marginTop: 12 * t, height: 4 * t, width: `${bar * 62}%`, borderRadius: 2 * t, background: `linear-gradient(90deg, ${pal.accent}, ${alpha(pal.accent, 0)})`, boxShadow: dark ? `0 0 ${16 * t}px ${alpha(pal.accent, 0.6)}` : 'none'}} />
        </div>
      ) : null}
      {step.chips.length ? (
        <div style={{display: 'flex', gap: 18 * t, marginTop: (stat ? 40 : 10) * t, perspective: 900 * t}}>
          {step.chips.map((c, i) => (
            <Chip key={i} chip={c} pal={pal} t={t} enter={spring({frame: frame - at(26 + i * 6), fps, config: {damping: 15, stiffness: 140}})} />
          ))}
        </div>
      ) : null}
    </>
  );
  return portrait ? (
    <AbsoluteFill style={{justifyContent: 'center', padding: '0 8%'}}>
      {headline}
      {stat || step.chips.length ? <div style={{marginTop: 70 * t}}>{figures}</div> : null}
    </AbsoluteFill>
  ) : (
    <AbsoluteFill style={{flexDirection: 'row', alignItems: 'center', padding: '0 7%', gap: '6%'}}>
      <div style={{flex: 1.1, minWidth: 0}}>{headline}</div>
      {stat || step.chips.length ? <div style={{flex: 1, minWidth: 0}}>{figures}</div> : null}
    </AbsoluteFill>
  );
};

/** Opening title: kicker, kinetic title and a "N steps" pill. */
const Intro: React.FC<{title: string; kicker: string; count: number; pal: Pal; t: number; portrait: boolean}> = ({title, kicker, count, pal, t, portrait}) => {
  const frame = useCurrentFrame();
  const pill = progress(frame, 24, 14, ease.overshoot);
  return (
    <AbsoluteFill style={{justifyContent: 'center', alignItems: 'center', padding: '0 8%'}}>
      {kicker ? <div style={{fontFamily: fonts.mono, fontSize: 26 * t, letterSpacing: `${0.5 - 0.2 * progress(frame, 0, 24, ease.expo)}em`, textTransform: 'uppercase', color: pal.accent, marginBottom: 30 * t, opacity: progress(frame, 0, 14)}}>{kicker}</div> : null}
      <KineticText text={title} start={4} stagger={4} duration={22} style="blur" align="center" accent={pal.accent} textStyle={{fontFamily: fonts.heavy, fontSize: (portrait ? 124 : 112) * t, lineHeight: 1.02, letterSpacing: '-0.03em', color: pal.text}} />
      <div style={{marginTop: 44 * t, display: 'flex', alignItems: 'center', gap: 14 * t, padding: `${14 * t}px ${30 * t}px`, borderRadius: 999, border: `${1.5 * t}px solid ${alpha(pal.accent, 0.6)}`, background: alpha(pal.accent, 0.08), fontFamily: fonts.mono, fontSize: 24 * t, letterSpacing: '0.2em', color: pal.text, transform: `scale(${pill})`, opacity: Math.min(1, pill * 2)}}>
        <div style={{width: 10 * t, height: 10 * t, borderRadius: '50%', background: pal.accent, boxShadow: pal.tone === 'dark' ? `0 0 ${12 * t}px ${pal.accent}` : 'none'}} />
        {count} STEPS
      </div>
    </AbsoluteFill>
  );
};

const MoneySteps: React.FC<EntryProps<Props>> = ({media, props}) => {
  const frame = useCurrentFrame();
  const {fps, width, height} = useVideoConfig();
  const look = useLook();
  const base = PALETTES[props.palette];
  const pal: Pal = look ? fromLook(look) : {...base, accent: media.accent ?? base.accent};
  const dark = pal.tone === 'dark';
  const u = Math.min(width, height) / 1080;
  const portrait = height >= width;
  const timeline = useSceneTimeline(media);
  const contentEnd = useContentFrames(media);
  const steps = props.steps;
  const offset = timeline.length > steps.length ? 1 : 0;
  const stepOf = (scene: number) => Math.min(steps.length - 1, Math.max(0, scene - offset));
  const overlap = Math.round(0.5 * fps);
  const half = Math.floor(overlap / 2);

  // Layout: top bar, the money path, then the step content above the caption zone.
  const safe = look ? captionSafeBottom(look) : props.showCaptions ? (portrait ? 0.17 : 0.19) : 0.07;
  const pathTop = height * (portrait ? 0.1 : 0.13);
  const pathH = height * (portrait ? 0.15 : 0.17);
  const mainTop = pathTop + pathH + 30 * u;
  const mainH = height * (1 - safe) - mainTop;
  const t = u * Math.min(1, mainH / ((portrait ? 900 : 480) * u));
  const colW = portrait ? width * 0.84 : width * 0.38;

  // The orb travels to step i's node as its narration starts.
  const moveLen = Math.round(0.9 * fps);
  const p = steps.reduce((sum, _, i) => {
    const s = timeline[i + offset];
    return i === 0 || !s ? sum : sum + progress(frame, s.from + 3, moveLen, ease.cinematic);
  }, 0);
  const firstStep = timeline[offset]?.from ?? 0;
  const orbIn = progress(frame, Math.max(0, firstStep - 6), 12);
  const drawIn = progress(frame, 2, offset ? Math.min(Math.round(timeline[0].durationInFrames * 0.7), 2 * fps) : fps, ease.cinematic);
  const sceneNow = timeline.findIndex(s => frame >= s.from && frame < s.from + s.durationInFrames);
  const currentStep = frame < firstStep ? -1 : stepOf(sceneNow === -1 ? timeline.length - 1 : sceneNow);
  const orbPos = pointAt(pathNodes(steps.length, width, pathH), p);
  const barIn = progress(frame, 0, 18);

  return (
    <AbsoluteFill style={{background: pal.bg, overflow: 'hidden'}}>
      {/* static textures and glows */}
      <AbsoluteFill style={{background: `radial-gradient(ellipse 85% 55% at 50% 60%, ${pal.bg2} 0%, transparent 72%)`}} />
      <AbsoluteFill style={{background: `radial-gradient(circle at ${orbPos.x}px ${pathTop + orbPos.y}px, ${alpha(pal.accent, dark ? 0.16 : 0.1)} 0%, transparent ${Math.round(420 * u)}px)`, opacity: orbIn}} />
      <GridLines color={pal.line} step={Math.round(54 * u)} opacity={dark ? 0.07 : 0.09} drift={0.15} dots />
      <Particles count={30} color={pal.accent} opacity={dark ? 0.3 : 0.18} seed="money" speed={0.35} size={[1.5, 4]} />

      <MoneyPath steps={steps} pal={pal} p={p} orbIn={orbIn} drawIn={drawIn} top={pathTop} h={pathH} t={u * Math.min(1, 6 / Math.max(6, steps.length) + 0.15)} />

      <AbsoluteFill style={{top: mainTop, height: mainH, bottom: 'auto'}}>
        <SceneSeries
          media={media}
          overlap={overlap}
          transition={i => (i === offset ? 'zoom' : 'whip')}
          renderScene={({index, timed}) => {
            const span = Math.max(1, Math.min(timed.durationInFrames, contentEnd - timed.from));
            const pace = Math.max(0.45, Math.min(1, span / (3.2 * fps)));
            if (offset && index === 0) return <Intro title={props.title} kicker={props.kicker} count={steps.length} pal={pal} t={t} portrait={portrait} />;
            const i = stepOf(index);
            return <StepScene step={steps[i]} index={i} pal={pal} t={t} lead={index === 0 ? 0 : half} pace={pace} colW={colW} portrait={portrait} />;
          }}
        />
      </AbsoluteFill>

      {/* top bar */}
      <div style={{position: 'absolute', left: '6%', right: '6%', top: height * 0.035, opacity: barIn, fontFamily: fonts.mono, letterSpacing: '0.18em', textTransform: 'uppercase'}}>
        <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 26 * u, color: pal.muted}}>
          <span style={{display: 'flex', alignItems: 'center', gap: 12 * u}}>
            <span style={{width: 10 * u, height: 10 * u, borderRadius: '50%', background: pal.accent, boxShadow: dark ? `0 0 ${10 * u}px ${pal.accent}` : 'none'}} />
            {props.kicker || 'Step by step'}
          </span>
          <span style={{color: currentStep >= 0 ? pal.text : pal.muted}}>
            {currentStep >= 0 ? String(currentStep + 1).padStart(2, '0') : '--'} / {String(steps.length).padStart(2, '0')}
          </span>
        </div>
        {props.disclaimer ? <div style={{marginTop: 10 * u, fontSize: 20 * u, letterSpacing: '0.12em', color: alpha(pal.muted, 0.8)}}>{props.disclaimer}</div> : null}
      </div>

      {dark ? timeline.slice(1).map(tl => <LightLeak key={tl.index} from={tl.from - half} durationInFrames={overlap * 2} seed={tl.index * 7 + 2} hueShift={pal.leak} opacity={0.22} />) : null}

      {props.showCaptions
        ? timeline.map(tl => (
            <Sequence key={tl.index} from={tl.from} durationInFrames={tl.durationInFrames}>
              <AbsoluteFill style={{justifyContent: 'flex-end', padding: portrait ? '0 7% 6%' : '0 18% 4%'}}>
                <StyledCaptions scene={tl.scene} variant="pop" accent={pal.accent} color={pal.text} font={fonts.sans} size={(portrait ? 54 : 48) * u} words={portrait ? 4 : 6} weight={800} shadow={dark} />
              </AbsoluteFill>
            </Sequence>
          ))
        : null}
      <Vignette strength={dark ? 0.6 : 0.2} />
      <Grain opacity={dark ? 0.06 : 0.04} />
      <NarrationTrack media={media} />
      <AdWeave media={media} theme={{background: pal.bg, text: pal.text, font: fonts.grotesk}} />
    </AbsoluteFill>
  );
};

export default defineEntry({id: 'tutorial-finance-money-steps', schema: Props, component: MoneySteps});
