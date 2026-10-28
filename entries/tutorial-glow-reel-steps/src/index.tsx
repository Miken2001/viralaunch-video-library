import React from 'react';
import {AbsoluteFill, Sequence, spring, useCurrentFrame, useVideoConfig} from 'remotion';
import {AdWeave, NarrationTrack, captionSafeBottom, defineEntry, mix, useContentFrames, useLook, useSceneTimeline, type ActiveLook, type EntryProps, type Scene} from '@viralaunch/kit';
import {CameraImage, Grain, HudFrame, KineticText, LightLeak, LineIcon, Particles, SceneSeries, StyledCaptions, Vignette, alpha, ease, fonts, glow, progress, rand, type Widen} from '@viralaunch/kit/fx';
import {Props} from './schema';

const PALETTES = {
  electric: {tone: 'dark', bg: '#2f33e6', core: '#5a5eff', bg2: '#15178f', surface: '#0a0d38', surfaceText: '#e9ecff', text: '#ffffff', muted: '#c4c8ff', accent: '#8ff3ff', line: '#ffffff', leak: 200},
  violet: {tone: 'dark', bg: '#4a17c4', core: '#7c3dff', bg2: '#1f0763', surface: '#12052b', surfaceText: '#f3e9ff', text: '#ffffff', muted: '#d5c4ff', accent: '#ffb8ef', line: '#ffffff', leak: 250},
  night: {tone: 'dark', bg: '#06262e', core: '#0f5561', bg2: '#020c10', surface: '#03161b', surfaceText: '#dff9f2', text: '#effffb', muted: '#8fbdb4', accent: '#5dffd0', line: '#dff9f2', leak: 140},
} as const;
/** `leak` is the light-leak hue shift (0 = the kit's warm amber). */
type Pal = Omit<Widen<(typeof PALETTES)[keyof typeof PALETTES]>, 'leak'> & {leak: number};
type Step = Props['steps'][number];

/** The glow reel in a sequence's shared look: background glow, terminal plate, type and accent from the look. */
const fromLook = (l: ActiveLook): Pal => ({
  tone: l.tone,
  bg: l.palette.bg,
  core: mix(l.palette.bg, l.palette.accent, l.tone === 'dark' ? 0.24 : 0.14),
  bg2: l.palette.bg2,
  surface: l.palette.surface,
  surfaceText: l.palette.text,
  text: l.palette.text,
  muted: l.palette.muted,
  accent: l.palette.accent,
  line: l.palette.line,
  leak: 0,
});

const dark = (pal: Pal) => pal.tone === 'dark';
/** Accent for small text: deepened toward the ink on light looks so it stays readable. */
const ink = (pal: Pal) => (dark(pal) ? pal.accent : mix(pal.accent, pal.text, 0.45));
/** Neon glow on dark palettes, a soft lift on light ones. */
const shine = (pal: Pal, color: string, k = 1) => (dark(pal) ? glow(color, 0.6 * k) : `0 ${4 * k}px ${18 * k}px ${alpha(pal.text, 0.12)}`);

/** Four-point sparkle. */
const Sparkle: React.FC<{size: number; color: string; style?: React.CSSProperties}> = ({size, color, style}) => (
  <svg width={size} height={size} viewBox="-1 -1 2 2" style={{position: 'absolute', overflow: 'visible', ...style}}>
    <path d="M0,-1 C0.12,-0.12 0.12,-0.12 1,0 C0.12,0.12 0.12,0.12 0,1 C-0.12,0.12 -0.12,0.12 -1,0 C-0.12,-0.12 -0.12,-0.12 0,-1Z" fill={color} />
  </svg>
);

/** Hyperspace streaks flying out of the centre; `power` scales speed and length (0 = gone). */
const Warp: React.FC<{color: string; power: number; seed: string; count?: number}> = ({color, power, seed, count = 90}) => {
  const frame = useCurrentFrame();
  const {width, height} = useVideoConfig();
  const cx = width / 2;
  const cy = height / 2;
  const reach = Math.hypot(width, height) * 0.62;
  if (power <= 0.01) return null;
  return (
    <svg width={width} height={height} style={{position: 'absolute', inset: 0, pointerEvents: 'none'}}>
      {Array.from({length: count}, (_, i) => {
        const a = rand(`${seed}a${i}`, 0, Math.PI * 2);
        const d = (rand(`${seed}d${i}`) + frame * 0.012 * (0.6 + rand(`${seed}v${i}`)) * (0.4 + power)) % 1;
        const r0 = d * d * reach;
        const len = (20 + d * d * 260) * power;
        const w = 1 + d * 3.2 * rand(`${seed}w${i}`, 0.5, 1);
        return <line key={i} x1={cx + Math.cos(a) * r0} y1={cy + Math.sin(a) * r0} x2={cx + Math.cos(a) * (r0 + len)} y2={cy + Math.sin(a) * (r0 + len)} stroke={color} strokeWidth={w} strokeLinecap="round" opacity={Math.min(1, d * 2.2) * power * rand(`${seed}o${i}`, 0.35, 1)} />;
      })}
    </svg>
  );
};

/** Heavy headline: each word slides in with a horizontal motion smear, then settles with a glow. *Hot* words take the accent. */
const SmearText: React.FC<{text: string; start: number; size: number; pal: Pal; align: 'left' | 'center'; stagger?: number}> = ({text, start, size, pal, align, stagger = 3}) => {
  const frame = useCurrentFrame();
  const words = text.split(/\s+/).filter(Boolean).map(raw => ({w: raw.replace(/\*/g, ''), hot: /\*/.test(raw)}));
  return (
    <div style={{display: 'flex', flexWrap: 'wrap', justifyContent: align === 'center' ? 'center' : 'flex-start', columnGap: '0.26em', fontFamily: fonts.heavy, fontSize: size, lineHeight: 1.04, letterSpacing: '-0.01em', textTransform: 'uppercase', textAlign: align}}>
      {words.map(({w, hot}, i) => {
        const p = progress(frame, start + i * stagger, 16, ease.expo);
        const color = hot ? pal.accent : pal.text;
        return (
          <span key={i} style={{display: 'inline-block', color, opacity: Math.min(1, p * 2.5), transform: `translateX(${(1 - p) * 0.9}em) scaleX(${1 + (1 - p) * 0.5})`, transformOrigin: '0% 50%', filter: `blur(${(1 - p) * 14}px)`, textShadow: shine(pal, color, hot ? 1 : 0.55)}}>
            {w}
          </span>
        );
      })}
    </div>
  );
};

/** Glowing emblem: halo, rotating dashed orbit, twinkling sparkles and the step icon drawing itself. */
const Emblem: React.FC<{icon: Step['icon']; size: number; pal: Pal; start: number; seed: number; sparkles?: number}> = ({icon, size, pal, start, seed, sparkles = 10}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const pop = spring({frame: frame - start, fps, config: {damping: 13, stiffness: 140, mass: 0.7}});
  const ring = progress(frame, start + 4, 26, ease.cinematic);
  const spin = (frame - start) * 0.45;
  const disc = size * 0.46;
  return (
    <div style={{position: 'relative', width: size, height: size, flexShrink: 0}}>
      <div style={{position: 'absolute', inset: -size * 0.25, borderRadius: '50%', background: `radial-gradient(circle, ${alpha(dark(pal) ? '#ffffff' : pal.accent, dark(pal) ? 0.28 : 0.22)} 0%, transparent 62%)`, opacity: pop}} />
      <svg width={size} height={size} viewBox="0 0 100 100" style={{position: 'absolute', inset: 0, overflow: 'visible', transform: `rotate(${spin}deg)`}}>
        <circle cx={50} cy={50} r={47} fill="none" stroke={alpha(pal.line, 0.55)} strokeWidth={0.5} strokeDasharray="0.6 2.4" pathLength={100} strokeDashoffset={0} opacity={ring} />
        <circle cx={50} cy={50} r={40} fill="none" stroke={alpha(pal.accent, 0.8)} strokeWidth={0.7} pathLength={1} strokeDasharray={`${ring * 0.72} 1`} strokeLinecap="round" />
      </svg>
      {Array.from({length: sparkles}, (_, i) => {
        const a = (i / sparkles) * Math.PI * 2 + spin * 0.004 * (i % 2 ? 1 : -1) + rand(`sa${seed}${i}`, -0.2, 0.2);
        const r = size * rand(`sr${seed}${i}`, 0.44, 0.56);
        const s = size * rand(`ss${seed}${i}`, 0.025, 0.06);
        const tw = 0.55 + 0.45 * Math.sin(frame / 6 + i * 1.7);
        const inP = progress(frame, start + 8 + i * 2, 12, ease.overshoot);
        return <Sparkle key={i} size={s * inP} color={i % 3 ? pal.line : pal.accent} style={{left: size / 2 + Math.cos(a) * r - (s * inP) / 2, top: size / 2 + Math.sin(a) * r - (s * inP) / 2, opacity: tw * inP, filter: dark(pal) ? `drop-shadow(0 0 ${s * 0.5}px ${alpha('#ffffff', 0.8)})` : undefined}} />;
      })}
      <div style={{position: 'absolute', left: (size - disc) / 2, top: (size - disc) / 2, width: disc, height: disc, borderRadius: '50%', background: dark(pal) ? alpha('#ffffff', 0.1) : pal.surface, boxShadow: dark(pal) ? `0 0 ${size * 0.15}px ${alpha('#ffffff', 0.35)}, inset 0 0 0 ${size * 0.006}px ${alpha('#ffffff', 0.5)}` : `0 ${size * 0.04}px ${size * 0.12}px ${alpha(pal.text, 0.15)}`, display: 'flex', alignItems: 'center', justifyContent: 'center', transform: `scale(${pop})`}}>
        <div style={{filter: dark(pal) ? `drop-shadow(0 0 ${size * 0.03}px ${alpha('#ffffff', 0.9)})` : undefined}}>
          <LineIcon name={icon} size={disc * 0.56} color={dark(pal) ? '#ffffff' : pal.accent} strokeWidth={5} progress={progress(frame, start + 6, 24, ease.cinematic)} />
        </div>
      </div>
    </div>
  );
};

/** Navy terminal plate: types the step command, then prints each line with a check. */
const Terminal: React.FC<{step: Step; index: number; start: number; span: number; t: number; pal: Pal; width: number | string}> = ({step, index, start, span, t, pal, width}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const inP = spring({frame: frame - start, fps, config: {damping: 18, stiffness: 120}});
  const typeAt = start + 10;
  const typed = Math.max(0, Math.floor((frame - typeAt) / 1.1));
  const doneTyping = typeAt + step.label.length * 1.1 + 4;
  const n = step.items.length;
  const firstAt = Math.max(doneTyping + 4, start + span * 0.25);
  const lastAt = Math.max(firstAt, start + span * 0.62);
  const at = (i: number) => firstAt + (n > 1 ? ((lastAt - firstAt) * i) / (n - 1) : 0);
  const cursorOn = Math.floor(frame / (fps / 2.5)) % 2 === 0;
  const title = `step-${String(index + 1).padStart(2, '0')}.run`;
  return (
    <div style={{width, perspective: 1400 * t}}>
      <div style={{background: pal.surface, borderRadius: 22 * t, overflow: 'hidden', boxShadow: dark(pal) ? `0 ${30 * t}px ${90 * t}px ${alpha('#000000', 0.45)}, 0 0 ${60 * t}px ${alpha(pal.core, 0.6)}, inset 0 0 0 ${1.5 * t}px ${alpha('#ffffff', 0.08)}` : `0 ${24 * t}px ${70 * t}px ${alpha(pal.text, 0.16)}`, transform: `translateY(${(1 - inP) * 120 * t}px) rotateX(${(1 - inP) * 24}deg) scale(${0.94 + 0.06 * inP})`, opacity: Math.min(1, inP * 2.5), transformOrigin: '50% 100%'}}>
        <div style={{display: 'flex', alignItems: 'center', gap: 12 * t, height: 58 * t, padding: `0 ${26 * t}px`, borderBottom: `${1.5 * t}px solid ${alpha(pal.surfaceText, 0.08)}`}}>
          {[0, 1, 2].map(i => <div key={i} style={{width: 14 * t, height: 14 * t, borderRadius: '50%', background: i === 0 ? pal.accent : alpha(pal.surfaceText, 0.25)}} />)}
          <div style={{flex: 1, textAlign: 'center', fontFamily: fonts.mono, fontSize: 20 * t, letterSpacing: '0.12em', color: alpha(pal.surfaceText, 0.5)}}>{title}</div>
          <div style={{width: 66 * t}} />
        </div>
        <div style={{padding: `${28 * t}px ${32 * t}px ${30 * t}px`, fontFamily: fonts.mono, color: pal.surfaceText}}>
          <div style={{display: 'flex', fontSize: 34 * t, lineHeight: 1.3, whiteSpace: 'nowrap'}}>
            <span style={{color: ink(pal), marginRight: 18 * t}}>›</span>
            <span>{step.label.slice(0, typed)}</span>
            <span style={{display: 'inline-block', width: 16 * t, height: 36 * t, marginLeft: 4 * t, alignSelf: 'center', background: pal.accent, opacity: frame < doneTyping + 20 || cursorOn ? (cursorOn || frame < doneTyping ? 1 : 0) : 0}} />
          </div>
          {step.items.map((it, i) => {
            const p = progress(frame, at(i), 10, ease.snappy);
            return (
              <div key={i} style={{display: 'flex', alignItems: 'center', gap: 16 * t, marginTop: 16 * t, fontSize: 28 * t, lineHeight: 1.3, whiteSpace: 'nowrap', opacity: p, transform: `translateX(${(1 - p) * -30 * t}px)`}}>
                <div style={{width: 34 * t, height: 34 * t, flexShrink: 0, borderRadius: 8 * t, background: alpha(pal.accent, 0.16), display: 'flex', alignItems: 'center', justifyContent: 'center'}}>
                  <LineIcon name="check" size={24 * t} color={pal.accent} strokeWidth={8} progress={progress(frame, at(i) + 3, 10)} />
                </div>
                <span style={{color: alpha(pal.surfaceText, 0.88)}}>{it}</span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

/** A small "camera hit": punch-in that settles plus a decaying shake, from `at`. */
function hit(frame: number, at: number, k = 1) {
  const p = progress(frame, at, 20, ease.expo);
  const shake = Math.max(0, 1 - (frame - at) / 12) * (frame >= at ? 1 : 0);
  return `translate(${Math.sin(frame * 2.3) * 7 * shake * k}px, ${Math.cos(frame * 1.9) * 5 * shake * k}px) scale(${1 + (1 - p) * 0.07 * k})`;
}

const StepScene: React.FC<{step: Step; index: number; total: number; scene: Scene; pal: Pal; t: number; lead: number; span: number; portrait: boolean; top: number; bottom: number}> = ({step, index, total, scene, pal, t, lead, span, portrait, top, bottom}) => {
  const frame = useCurrentFrame();
  const size = (portrait ? 96 : 84) * t * Math.max(0.72, Math.min(1, 22 / Math.max(1, step.headline.length)));
  const tag = (
    <div style={{display: 'flex', alignItems: 'center', gap: 16 * t, fontFamily: fonts.mono, fontSize: 24 * t, letterSpacing: '0.28em', textTransform: 'uppercase', color: pal.muted, opacity: progress(frame, lead, 12), alignSelf: portrait ? 'center' : 'flex-start'}}>
      <span style={{color: ink(pal), textShadow: shine(pal, pal.accent, 0.5)}}>{String(index + 1).padStart(2, '0')}</span>
      <span style={{width: 60 * t * progress(frame, lead + 2, 18, ease.expo), height: 2 * t, background: pal.accent}} />
      <span>of {String(total).padStart(2, '0')}</span>
    </div>
  );
  const headline = <SmearText text={step.headline} start={lead + 2} size={size} pal={pal} align={portrait ? 'center' : 'left'} />;
  const emblem = <Emblem icon={step.icon} size={(portrait ? 380 : 420) * t} pal={pal} start={lead + 4} seed={index} />;
  const term = <Terminal step={step} index={index} start={lead + 10} span={span - 10} t={t} pal={pal} width={portrait ? '100%' : '100%'} />;
  return (
    <AbsoluteFill>
      {scene.video ? (
        <AbsoluteFill style={{opacity: dark(pal) ? 0.28 : 0.2, mixBlendMode: dark(pal) ? 'luminosity' : 'multiply'}}>
          <CameraImage src={scene.video} isStatic={scene.isStaticImage} move={index % 2 ? 'pan-left' : 'push'} />
        </AbsoluteFill>
      ) : null}
      <AbsoluteFill style={{top, bottom: 'auto', height: bottom - top, transform: hit(frame, lead), padding: portrait ? '0 7%' : '0 7%', flexDirection: portrait ? 'column' : 'row', alignItems: 'center', justifyContent: 'center', gap: portrait ? 44 * t : '5%'}}>
        {portrait ? (
          <>
            {tag}
            {headline}
            {emblem}
            {term}
          </>
        ) : (
          <>
            <div style={{flex: 0.8, display: 'flex', justifyContent: 'center'}}>{emblem}</div>
            <div style={{flex: 1.2, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 36 * t}}>
              {tag}
              {headline}
              {term}
            </div>
          </>
        )}
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

/** Opening: warp streaks into a glowing core, kicker, title, then the step list printed as HUD rows. */
const Intro: React.FC<{title: string; kicker: string; steps: Step[]; pal: Pal; t: number; portrait: boolean; top: number; bottom: number; span: number}> = ({title, kicker, steps, pal, t, portrait, top, bottom, span}) => {
  const frame = useCurrentFrame();
  const words = title.split(/\s+/).filter(Boolean).length;
  const titleAt = 12;
  const listAt = titleAt + words * 3 + 10;
  const warp = 1 - 0.75 * progress(frame, titleAt, 40, ease.cinematic);
  const core = progress(frame, 0, 14, ease.expo) * (1 - progress(frame, titleAt, 20));
  const size = (portrait ? 128 : 112) * t * Math.max(0.62, Math.min(1, 20 / Math.max(1, title.replace(/\*/g, '').length)));
  const rowGap = Math.min(10, Math.max(4, Math.floor((span * 0.5 - listAt) / Math.max(1, steps.length))));
  return (
    <AbsoluteFill>
      <Warp color={pal.line} power={warp} seed="intro" />
      <AbsoluteFill style={{justifyContent: 'center', alignItems: 'center'}}>
        <div style={{width: 40 * t, height: 40 * t, borderRadius: '50%', background: '#ffffff', boxShadow: `0 0 ${80 * t}px ${30 * t}px ${alpha(dark(pal) ? '#ffffff' : pal.accent, 0.6)}`, opacity: core, transform: `scale(${0.4 + core})`}} />
      </AbsoluteFill>
      <AbsoluteFill style={{top, bottom: 'auto', height: bottom - top, justifyContent: 'center', alignItems: 'center', padding: '0 8%', transform: hit(frame, titleAt, 1.4)}}>
        {kicker ? (
          <div style={{fontFamily: fonts.mono, fontSize: 26 * t, letterSpacing: `${0.5 - 0.2 * progress(frame, 4, 24, ease.expo)}em`, textTransform: 'uppercase', color: ink(pal), marginBottom: 30 * t, opacity: progress(frame, 4, 12), textShadow: shine(pal, pal.accent, 0.4)}}>{kicker}</div>
        ) : null}
        <SmearText text={title} start={titleAt} size={size} pal={pal} align="center" />
        <div style={{marginTop: 56 * t, display: 'flex', flexDirection: 'column', gap: 12 * t, alignItems: 'stretch', minWidth: (portrait ? 640 : 720) * t}}>
          {steps.map((s, i) => {
            const p = progress(frame, listAt + i * rowGap, 12, ease.snappy);
            return (
              <div key={i} style={{display: 'flex', alignItems: 'center', gap: 22 * t, fontFamily: fonts.mono, fontSize: 30 * t, color: pal.text, opacity: p, transform: `translateY(${(1 - p) * 18 * t}px)`, paddingBottom: 12 * t, borderBottom: `${1.5 * t}px solid ${alpha(pal.line, 0.18 * p)}`, whiteSpace: 'nowrap'}}>
                <span style={{color: ink(pal), letterSpacing: '0.1em'}}>{String(i + 1).padStart(2, '0')}</span>
                <span style={{flex: 1}}>{s.label}</span>
                <LineIcon name={s.icon} size={34 * t} color={pal.muted} strokeWidth={6} progress={progress(frame, listAt + i * rowGap + 4, 14)} />
              </div>
            );
          })}
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

/** Finale: a warp burst, the big emblem and the closing line, with every step ticked. */
const Finale: React.FC<{text: string; steps: Step[]; pal: Pal; t: number; lead: number; top: number; bottom: number}> = ({text, steps, pal, t, lead, top, bottom}) => {
  const frame = useCurrentFrame();
  const burst = Math.max(0, 1 - progress(frame, lead, 34, ease.cinematic)) * progress(frame, lead - 6, 6);
  const size = 104 * t * Math.max(0.65, Math.min(1, 18 / Math.max(1, text.replace(/\*/g, '').length)));
  return (
    <AbsoluteFill>
      <Warp color={pal.line} power={burst} seed="fin" count={70} />
      <AbsoluteFill style={{top, bottom: 'auto', height: bottom - top, justifyContent: 'center', alignItems: 'center', gap: 40 * t, padding: '0 8%', transform: hit(frame, lead, 1.3)}}>
        <Emblem icon="spark" size={340 * t} pal={pal} start={lead} seed={99} sparkles={14} />
        <KineticText text={text} start={lead + 8} stagger={4} duration={20} style="blur" align="center" accent={pal.accent} textStyle={{fontFamily: fonts.heavy, fontSize: size, lineHeight: 1.04, textTransform: 'uppercase', color: pal.text, textShadow: shine(pal, pal.text, 0.5)}} />
        <div style={{display: 'flex', gap: 18 * t}}>
          {steps.map((_, i) => {
            const p = progress(frame, lead + 20 + i * 4, 10, ease.overshoot);
            return (
              <div key={i} style={{width: 46 * t, height: 46 * t, borderRadius: '50%', border: `${2 * t}px solid ${pal.accent}`, background: alpha(pal.accent, 0.18 * p), display: 'flex', alignItems: 'center', justifyContent: 'center', transform: `scale(${0.6 + 0.4 * p})`, opacity: Math.min(1, p * 2)}}>
                <LineIcon name="check" size={26 * t} color={pal.accent} strokeWidth={8} progress={p} />
              </div>
            );
          })}
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

const GlowReelSteps: React.FC<EntryProps<Props>> = ({media, props}) => {
  const {fps, width, height} = useVideoConfig();
  const look = useLook();
  const base = PALETTES[props.palette];
  const pal: Pal = look ? fromLook(look) : {...base, accent: media.accent ?? base.accent};
  const u = Math.min(width, height) / 1080;
  const portrait = height >= width;
  const timeline = useSceneTimeline(media);
  const contentEnd = useContentFrames(media);
  const steps = props.steps;
  const n = steps.length;
  const offset = timeline.length > n ? 1 : 0;
  const overlap = Math.round(0.45 * fps);
  const half = Math.floor(overlap / 2);

  // Content band: below the HUD labels, above the caption zone.
  const safe = look ? captionSafeBottom(look) : props.showCaptions ? (portrait ? 0.16 : 0.17) : 0.07;
  const top = height * (portrait ? 0.07 : 0.09);
  const bottom = height * (1 - safe);
  const avail = bottom - top;
  const maxItems = Math.max(0, ...steps.map(s => s.items.length));
  const termH = 58 + 58 + 44 + maxItems * 60;
  const need = portrait ? 34 + 44 + 300 + 44 + 380 + 44 + termH : Math.max(420, 34 + 36 + 260 + 36 + termH);
  const t = u * Math.min(portrait ? 1.15 : 1, avail / (need * u));
  const introT = u * Math.min(1.1, avail / ((portrait ? 420 : 330) + n * 58) / u);

  return (
    <AbsoluteFill style={{background: pal.bg, overflow: 'hidden'}}>
      {/* static atmosphere: deep edges, bright core, slow drifting bloom */}
      <AbsoluteFill style={{background: `radial-gradient(ellipse 75% 65% at 50% 46%, ${pal.core} 0%, ${pal.bg} 55%, ${pal.bg2} 100%)`}} />
      <Bloom pal={pal} />
      <Particles count={36} color={dark(pal) ? '#ffffff' : pal.text} opacity={dark(pal) ? 0.35 : 0.1} seed="glow" speed={0.4} size={[1.5, 4]} />

      <SceneSeries
        media={media}
        overlap={overlap}
        transition={i => (i === offset ? 'flash' : 'zoom')}
        renderScene={({index, timed}) => {
          const lead = index === 0 ? 0 : half;
          const span = Math.max(fps, Math.min(timed.durationInFrames, contentEnd - timed.from));
          if (offset && index === 0) return <Intro title={props.title} kicker={props.kicker} steps={steps} pal={pal} t={introT} portrait={portrait} top={top} bottom={bottom} span={span} />;
          const s = index - offset;
          if (s >= n) return <Finale text={props.finale || props.title} steps={steps} pal={pal} t={u * Math.min(1, avail / (640 * u))} lead={lead} top={top} bottom={bottom} />;
          return <StepScene step={steps[s]} index={s} total={n} scene={timed.scene} pal={pal} t={t} lead={lead} span={span} portrait={portrait} top={top} bottom={bottom} />;
        }}
      />

      {timeline.slice(1).map(t => (
        <LightLeak key={t.index} from={t.from - half} durationInFrames={overlap * 2} seed={t.index * 5 + 2} hueShift={pal.leak} opacity={dark(pal) ? 0.45 : 0.25} />
      ))}
      <HudFrame color={pal.text} topLeft={props.kicker || 'How-to'} topRight={`${n} steps`} bottomRight="" timecode progressBar={!props.showCaptions || Boolean(look)} />

      {props.showCaptions
        ? timeline.map(tl => (
            <Sequence key={tl.index} from={tl.from} durationInFrames={tl.durationInFrames}>
              <AbsoluteFill style={{justifyContent: 'flex-end', padding: portrait ? '0 7% 6%' : '0 18% 4.5%'}}>
                <StyledCaptions scene={tl.scene} variant="box" accent={pal.accent} color={pal.text} font={fonts.sans} size={(portrait ? 50 : 44) * u} words={portrait ? 4 : 6} />
              </AbsoluteFill>
            </Sequence>
          ))
        : null}
      <Vignette strength={0.45} color={pal.bg2} />
      <Grain opacity={0.05} />
      <NarrationTrack media={media} />
      <AdWeave media={media} theme={{background: pal.bg2, text: pal.text, font: fonts.sans}} />
    </AbsoluteFill>
  );
};

/** One soft white bloom that drifts behind everything (the reel's "light source"). */
const Bloom: React.FC<{pal: Pal}> = ({pal}) => {
  const frame = useCurrentFrame();
  const x = 50 + Math.sin(frame / 70) * 18;
  const y = 42 + Math.cos(frame / 90) * 12;
  return <AbsoluteFill style={{pointerEvents: 'none', background: `radial-gradient(circle at ${x}% ${y}%, ${alpha(dark(pal) ? '#ffffff' : pal.accent, dark(pal) ? 0.16 : 0.1)} 0%, transparent 38%)`}} />;
};

export default defineEntry({id: 'tutorial-glow-reel-steps', schema: Props, component: GlowReelSteps});
