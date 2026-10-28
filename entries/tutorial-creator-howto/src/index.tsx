import React from 'react';
import {AbsoluteFill, Sequence, spring, useCurrentFrame, useVideoConfig} from 'remotion';
import {AdWeave, NarrationTrack, captionSafeBottom, defineEntry, mix, useContentFrames, useLook, useSceneTimeline, type ActiveLook, type EntryProps, type Scene} from '@viralaunch/kit';
import {CameraImage, Grain, KineticText, LightLeak, LineIcon, MeshGradient, Particles, SceneSeries, StyledCaptions, Vignette, alpha, ease, fonts, progress, rand, tween, type Widen} from '@viralaunch/kit/fx';
import {Props} from './schema';

const PALETTES = {
  cream: {tone: 'light', bg: '#fbf6ee', bg2: '#f4d6b8', bg3: '#e4e1f2', surface: '#ffffff', text: '#1f1a16', muted: '#867b70', accent: '#c8661b', line: '#1f1a16'},
  blush: {tone: 'light', bg: '#fcf2f3', bg2: '#f6c8d3', bg3: '#d3e9f4', surface: '#ffffff', text: '#24141c', muted: '#8c7480', accent: '#c2366b', line: '#24141c'},
  studio: {tone: 'dark', bg: '#110e0d', bg2: '#3b2416', bg3: '#1b1f38', surface: '#1e1a18', text: '#f8f1e8', muted: '#a89c90', accent: '#ff9d4d', line: '#f8f1e8'},
} as const;
type Pal = Widen<(typeof PALETTES)[keyof typeof PALETTES]>;
type Step = Props['steps'][number];

/** The studio frame in a sequence's shared look: background blobs, cards, ink and accent from the look. */
const fromLook = (l: ActiveLook): Pal => ({tone: l.tone, ...l.palette, bg3: mix(l.palette.bg2, l.palette.accent, 0.25)});

/** Hand-drawn swash under an accent word: one loose stroke that draws itself in. */
const Swash: React.FC<{p: number; color: string; seed: number}> = ({p, color, seed}) => {
  const lift = rand(`sw${seed}`, -3, 3);
  return (
    // Sits inside the word mask's bottom padding; the non-uniform stretch gives a brush-like stroke.
    <svg viewBox="0 0 100 20" preserveAspectRatio="none" style={{position: 'absolute', left: '2%', width: '96%', bottom: '0.02em', height: '0.26em', overflow: 'visible'}}>
      <path d={`M3,${13 + lift} C24,${5 - lift} 58,${17 + lift} 97,${6 - lift}`} pathLength={1} fill="none" stroke={color} strokeWidth={3.2} strokeLinecap="round" strokeDasharray={1} strokeDashoffset={1 - p} />
    </svg>
  );
};

/**
 * Serif headline with a masked rise per word. *Accent* words turn italic in the accent colour
 * and get a swash that draws once the line has landed.
 */
const Headline: React.FC<{text: string; start: number; stagger: number; size: number; pal: Pal; align?: 'left' | 'center'}> = ({text, start, stagger, size, pal, align = 'center'}) => {
  const frame = useCurrentFrame();
  const words = text.split(/\s+/).filter(Boolean).map(raw => ({w: raw.replace(/\*/g, ''), hot: /\*/.test(raw)}));
  const landed = start + words.length * stagger + 10;
  return (
    <div style={{display: 'flex', flexWrap: 'wrap', justifyContent: align === 'center' ? 'center' : 'flex-start', columnGap: '0.24em', fontFamily: fonts.serifDisplay, fontSize: size, lineHeight: 1.08, letterSpacing: '-0.015em', color: pal.text, textAlign: align}}>
      {words.map(({w, hot}, i) => {
        const p = progress(frame, start + i * stagger, 20, ease.expo);
        return (
          <span key={i} style={{display: 'inline-block', position: 'relative', overflow: 'hidden', padding: '0.04em 0.06em 0.2em', margin: '0 -0.06em -0.16em'}}>
            <span style={{display: 'inline-block', transform: `translateY(${(1 - p) * 115}%)`, color: hot ? pal.accent : undefined, fontStyle: hot ? 'italic' : undefined}}>{w}</span>
            {hot ? <Swash p={progress(frame, landed + i, 18, ease.cinematic)} color={alpha(pal.accent, 0.75)} seed={i} /> : null}
          </span>
        );
      })}
    </div>
  );
};

const shadow = (pal: Pal, t: number, k = 1) => (pal.tone === 'dark' ? `0 ${30 * t * k}px ${80 * t * k}px rgba(0,0,0,.55), inset 0 0 0 ${1.5 * t}px ${alpha(pal.text, 0.08)}` : `0 ${28 * t * k}px ${70 * t * k}px ${alpha(pal.text, 0.13)}, 0 ${4 * t}px ${12 * t}px ${alpha(pal.text, 0.06)}`);

/** Pointer cursor that glides in, presses and releases. */
const Cursor: React.FC<{size: number; pal: Pal; press: number}> = ({size, pal, press}) => (
  <svg width={size} height={size} viewBox="0 0 24 24" style={{overflow: 'visible', transform: `scale(${1 - 0.14 * press})`, transformOrigin: '20% 15%', filter: `drop-shadow(0 ${size * 0.1}px ${size * 0.16}px rgba(0,0,0,.35))`}}>
    <path d="M4 2 L4 19 L8.6 14.8 L11.6 21.4 L14.4 20.2 L11.4 13.7 L17.6 13.4 Z" fill={pal.tone === 'dark' ? '#ffffff' : '#111111'} stroke={pal.tone === 'dark' ? '#111111' : '#ffffff'} strokeWidth={1.4} strokeLinejoin="round" />
  </svg>
);

/** One checklist row: box fills and ticks, the line strikes through and fades. */
const Item: React.FC<{text: string; p: number; enter: number; pal: Pal; t: number}> = ({text, p, enter, pal, t}) => {
  const box = 46 * t;
  return (
    <div style={{display: 'flex', alignItems: 'center', gap: 22 * t, height: 76 * t, opacity: enter, transform: `translateX(${(1 - enter) * -24 * t}px)`}}>
      <div style={{width: box, height: box, flexShrink: 0, borderRadius: 12 * t, border: `${2.5 * t}px solid ${p > 0 ? pal.accent : alpha(pal.text, 0.25)}`, background: alpha(pal.accent, p), display: 'flex', alignItems: 'center', justifyContent: 'center', transform: `scale(${1 + 0.18 * Math.sin(Math.PI * p)})`}}>
        <svg width={box * 0.62} height={box * 0.62} viewBox="0 0 24 24">
          <path d="M4 12.5 L9.5 18 L20 6.5" pathLength={1} fill="none" stroke={pal.tone === 'dark' ? pal.bg : '#ffffff'} strokeWidth={3.4} strokeLinecap="round" strokeLinejoin="round" strokeDasharray={1} strokeDashoffset={1 - p} />
        </svg>
      </div>
      <span style={{position: 'relative', fontFamily: fonts.sans, fontWeight: 500, fontSize: 38 * t, color: mix(pal.text, pal.muted, p), whiteSpace: 'nowrap', overflow: 'visible'}}>
        {text}
        <span style={{position: 'absolute', left: -4 * t, top: '54%', height: 3 * t, width: `calc(${p * 100}% + ${8 * t * p}px)`, background: alpha(pal.muted, 0.9), borderRadius: 2 * t}} />
      </span>
    </div>
  );
};

/** One step: serif headline, tip bubble and the floating task card with its checklist and button. */
const StepScene: React.FC<{step: Step; index: number; total: number; scene: Scene; pal: Pal; t: number; lead: number; span: number; portrait: boolean; top: number; bottom: number}> = ({step, index, total, scene, pal, t, lead, span, portrait, top, bottom}) => {
  const frame = useCurrentFrame();
  const {fps, width} = useVideoConfig();
  const dark = pal.tone === 'dark';
  const at = (f: number) => lead + f;
  const n = step.items.length;
  const hasButton = step.action.length > 0;
  // Reveals paced inside the narration: card, then ticks, then the cursor taps the button.
  const cardIn = spring({frame: frame - at(10), fps, config: {damping: 17, stiffness: 110}});
  const tipIn = spring({frame: frame - at(18), fps, config: {damping: 15, stiffness: 130}});
  const tickA = at(Math.max(26, Math.round(span * 0.3)));
  const tickB = at(Math.max(34, Math.round(span * (hasButton ? 0.64 : 0.8))));
  const tickAt = (i: number) => tickA + (n > 1 ? ((tickB - tickA) * i) / (n - 1) : 0);
  const ticks = step.items.map((_, i) => progress(frame, tickAt(i), 10, ease.snappy));
  const done = ticks.filter(x => x >= 0.5).length;
  const bar = n ? tween(frame, [tickA, tickB + 10], [0, 1], ease.cinematic) : progress(frame, at(20), Math.round(span * 0.5), ease.cinematic);
  const tap = at(Math.max(44, Math.round(span * 0.82)));
  const glide = progress(frame, tap - 22, 22, ease.cinematic);
  const press = Math.max(0, 1 - Math.abs(frame - tap - 2) / 4);
  const pressed = frame >= tap;
  const ripple = progress(frame, tap, 18, ease.expo);
  const float = Math.sin((frame + index * 40) / 34);
  const hasPhoto = Boolean(scene.video);

  const headline = (
    <Headline text={step.headline} start={at(0)} stagger={3} size={(portrait ? 96 : 84) * t} pal={pal} align={portrait ? 'center' : 'left'} />
  );
  const tip = step.tip ? (
    <div style={{display: 'flex', alignItems: 'flex-start', gap: 20 * t, alignSelf: portrait ? 'flex-end' : 'flex-start', maxWidth: portrait ? '88%' : '100%', padding: `${26 * t}px ${32 * t}px`, borderRadius: 32 * t, borderBottomRightRadius: portrait ? 8 * t : 32 * t, borderBottomLeftRadius: portrait ? 32 * t : 8 * t, background: dark ? mix(pal.surface, pal.accent, 0.12) : mix(pal.surface, pal.bg3, 0.55), boxShadow: shadow(pal, t, 0.5), transform: `translateX(${(1 - tipIn) * (portrait ? 80 : -80) * t}px) scale(${0.9 + 0.1 * tipIn})`, opacity: Math.min(1, tipIn * 2)}}>
      <div style={{width: 58 * t, height: 58 * t, flexShrink: 0, borderRadius: '50%', background: pal.surface, display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: `inset 0 0 0 ${2 * t}px ${alpha(pal.accent, 0.4)}`}}>
        <LineIcon name="bulb" size={34 * t} color={pal.accent} strokeWidth={6} progress={progress(frame, at(22), 18)} />
      </div>
      <KineticText text={step.tip} start={at(20)} stagger={1} duration={14} style="blur" textStyle={{fontFamily: fonts.sans, fontSize: 34 * t, lineHeight: 1.36, color: pal.text, flex: 1, minWidth: 0}} />
    </div>
  ) : null;

  const card = (
    <div style={{perspective: 1600 * t, width: '100%'}}>
      <div style={{position: 'relative', background: pal.surface, borderRadius: 40 * t, padding: `${38 * t}px ${42 * t}px ${42 * t}px`, boxShadow: shadow(pal, t), transform: `translateY(${(1 - cardIn) * 160 * t + float * 6 * t}px) rotateX(${(1 - cardIn) * 28}deg) rotateZ(${(1 - cardIn) * -3 + float * 0.35}deg)`, opacity: Math.min(1, cardIn * 2.5), transformOrigin: '50% 100%'}}>
        {/* header */}
        <div style={{display: 'flex', alignItems: 'center', gap: 22 * t}}>
          <div style={{width: 76 * t, height: 76 * t, flexShrink: 0, borderRadius: 22 * t, background: alpha(pal.accent, dark ? 0.18 : 0.12), display: 'flex', alignItems: 'center', justifyContent: 'center'}}>
            <LineIcon name={step.icon} size={46 * t} color={pal.accent} strokeWidth={6} progress={progress(frame, at(14), 22, ease.cinematic)} />
          </div>
          <div style={{flex: 1, minWidth: 0}}>
            <div style={{fontFamily: fonts.sans, fontWeight: 700, fontSize: 40 * t, color: pal.text, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis'}}>{step.label}</div>
            <div style={{fontFamily: fonts.sans, fontSize: 28 * t, color: pal.muted, marginTop: 2 * t}}>{n ? `${done} of ${n} done` : `Step ${index + 1}`}</div>
          </div>
          <div style={{fontFamily: fonts.mono, fontSize: 28 * t, letterSpacing: '0.08em', color: pal.muted}}>
            <span style={{color: pal.text}}>{String(index + 1).padStart(2, '0')}</span>/{String(total).padStart(2, '0')}
          </div>
        </div>
        <div style={{marginTop: 26 * t, height: 9 * t, borderRadius: 9 * t, background: alpha(pal.text, 0.08), overflow: 'hidden'}}>
          <div style={{width: `${bar * 100}%`, height: '100%', borderRadius: 9 * t, background: pal.accent}} />
        </div>
        {hasPhoto ? (
          <div style={{marginTop: 30 * t, height: 300 * t, borderRadius: 26 * t, overflow: 'hidden', position: 'relative'}}>
            <CameraImage src={scene.video} isStatic={scene.isStaticImage} move={index % 2 ? 'pan-left' : 'push'} />
          </div>
        ) : null}
        {n ? (
          <div style={{marginTop: 22 * t}}>
            {step.items.map((it, i) => (
              <Item key={i} text={it} p={ticks[i]} enter={progress(frame, at(16 + i * 4), 14)} pal={pal} t={t} />
            ))}
          </div>
        ) : null}
        {hasButton ? (
          <div style={{position: 'relative', marginTop: 30 * t}}>
            <div style={{position: 'relative', overflow: 'hidden', height: 100 * t, borderRadius: 999, background: pressed ? pal.accent : dark ? alpha(pal.text, 0.1) : pal.text, color: pressed ? (dark ? pal.bg : '#ffffff') : dark ? pal.text : pal.surface, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 14 * t, fontFamily: fonts.sans, fontWeight: 700, fontSize: 38 * t, transform: `scale(${1 - 0.04 * press})`, opacity: progress(frame, at(24), 14)}}>
              {pressed ? <div style={{position: 'absolute', left: '50%', top: '50%', width: 900 * t, height: 900 * t, marginLeft: -450 * t, marginTop: -450 * t, borderRadius: '50%', background: alpha('#ffffff', 0.35 * (1 - ripple)), transform: `scale(${ripple})`}} /> : null}
              {pressed ? <LineIcon name="check" size={40 * t} color={dark ? pal.bg : '#ffffff'} strokeWidth={9} progress={progress(frame, tap, 12)} /> : null}
              <span>{step.action}</span>
            </div>
            {glide > 0 ? (
              <div style={{position: 'absolute', left: '58%', top: '58%', transform: `translate(${(1 - glide) * width * 0.34}px, ${(1 - glide) * 90 * t}px)`, opacity: Math.min(1, glide * 3) * (1 - progress(frame, tap + 18, 12))}}>
                <Cursor size={64 * t} pal={pal} press={press} />
              </div>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  );

  return portrait ? (
    <AbsoluteFill style={{top, bottom: 'auto', height: bottom - top, flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 40 * t, padding: '0 7%'}}>
      {headline}
      {tip}
      {card}
    </AbsoluteFill>
  ) : (
    <AbsoluteFill style={{top, bottom: 'auto', height: bottom - top, flexDirection: 'row', alignItems: 'center', gap: '5%', padding: '0 7%'}}>
      <div style={{flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 40 * t}}>
        {headline}
        {tip}
      </div>
      <div style={{flex: 1.15, minWidth: 0}}>{card}</div>
    </AbsoluteFill>
  );
};

/** Opening: kicker, serif title with swash, then the steps fan in as floating pills. */
const Intro: React.FC<{title: string; kicker: string; steps: Step[]; pal: Pal; t: number; portrait: boolean; top: number; bottom: number}> = ({title, kicker, steps, pal, t, portrait, top, bottom}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const dark = pal.tone === 'dark';
  const words = title.split(/\s+/).filter(Boolean).length;
  const pillsAt = 10 + words * 4;
  return (
    <AbsoluteFill style={{top, bottom: 'auto', height: bottom - top, justifyContent: 'center', alignItems: 'center', padding: '0 8%'}}>
      {kicker ? (
        <div style={{fontFamily: fonts.mono, fontSize: 26 * t, letterSpacing: `${0.42 - 0.16 * progress(frame, 0, 26, ease.expo)}em`, textTransform: 'uppercase', color: pal.accent, marginBottom: 34 * t, opacity: progress(frame, 0, 14)}}>{kicker}</div>
      ) : null}
      <Headline text={title} start={4} stagger={4} size={(portrait ? 132 : 112) * t} pal={pal} />
      <div style={{marginTop: 70 * t, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 18 * t, width: '100%'}}>
        {steps.map((s, i) => {
          const p = spring({frame: frame - pillsAt - i * 5, fps, config: {damping: 15, stiffness: 120}});
          const side = i % 2 ? 1 : -1;
          const drift = Math.sin((frame + i * 23) / 30) * 5 * t;
          return (
            <div key={i} style={{display: 'flex', alignItems: 'center', gap: 18 * t, padding: `${16 * t}px ${30 * t}px ${16 * t}px ${18 * t}px`, borderRadius: 999, background: dark ? mix(pal.surface, pal.accent, 0.06 + 0.04 * (i % 3)) : mix(pal.surface, i % 2 ? pal.bg3 : pal.bg2, 0.32), boxShadow: shadow(pal, t, 0.35), transform: `translate(${(1 - p) * side * 260 * t + side * (i % 3) * 22 * t}px, ${drift}px) rotate(${rand(`pill${i}`, -2.2, 2.2) * p}deg)`, opacity: Math.min(1, p * 2)}}>
              <div style={{width: 52 * t, height: 52 * t, borderRadius: '50%', background: pal.surface, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: fonts.mono, fontWeight: 700, fontSize: 22 * t, color: pal.accent, boxShadow: `inset 0 0 0 ${2 * t}px ${alpha(pal.accent, 0.35)}`}}>{String(i + 1).padStart(2, '0')}</div>
              <div style={{fontFamily: fonts.sans, fontWeight: 500, fontSize: 34 * t, color: pal.text, whiteSpace: 'nowrap'}}>{s.label}</div>
            </div>
          );
        })}
      </div>
    </AbsoluteFill>
  );
};

const CreatorHowTo: React.FC<EntryProps<Props>> = ({media, props}) => {
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
  const overlap = Math.round(0.55 * fps);
  const half = Math.floor(overlap / 2);

  // Vertical band for content: below the top bar, above the caption zone.
  const safe = look ? captionSafeBottom(look) : props.showCaptions ? (portrait ? 0.17 : 0.18) : 0.06;
  const top = height * (portrait ? 0.075 : 0.1);
  const bottom = height * (1 - safe);
  const avail = bottom - top;
  // Design height of the tallest step at t = u (headline, tip, card with photo and items).
  const hasPhotos = media.scenes.some(s => s.video);
  const maxItems = Math.max(0, ...steps.map(s => s.items.length));
  const cardH = 76 + 38 + 42 + 35 + (hasPhotos ? 330 : 0) + (maxItems ? 22 + maxItems * 76 : 0) + 130;
  const need = portrait ? 220 + 40 + 150 + 40 + cardH : cardH + 40;
  const t = u * Math.min(portrait ? 1.2 : 1, avail / (need * u));

  const sceneNow = timeline.findIndex(s => frame >= s.from && frame < s.from + s.durationInFrames);
  const firstStep = timeline[offset]?.from ?? 0;
  const currentStep = frame < firstStep ? -1 : stepOf(sceneNow === -1 ? timeline.length - 1 : sceneNow);
  const barIn = progress(frame, 0, 18);

  return (
    <AbsoluteFill style={{background: pal.bg, overflow: 'hidden'}}>
      {/* static atmosphere: soft drifting colour blobs, dust */}
      <MeshGradient base={pal.bg} colors={[alpha(pal.bg2, dark ? 0.55 : 0.75), alpha(pal.bg3, dark ? 0.5 : 0.7), alpha(pal.bg, 0.9)]} speed={0.5} />
      <Particles count={26} color={dark ? pal.accent : pal.text} opacity={dark ? 0.22 : 0.08} seed="howto" speed={0.3} size={[2, 5]} blur />

      <SceneSeries
        media={media}
        overlap={overlap}
        transition={i => (i === offset ? 'slide-up' : 'whip')}
        renderScene={({index, timed}) => {
          const lead = index === 0 ? 0 : half;
          const span = Math.max(fps, Math.min(timed.durationInFrames, contentEnd - timed.from));
          if (offset && index === 0) return <Intro title={props.title} kicker={props.kicker} steps={steps} pal={pal} t={u * Math.min(1.15, avail / ((portrait ? 300 + steps.length * 106 + 200 : 260 + steps.length * 96) * u))} portrait={portrait} top={top} bottom={bottom} />;
          const i = stepOf(index);
          return <StepScene step={steps[i]} index={i} total={steps.length} scene={timed.scene} pal={pal} t={t} lead={lead} span={span} portrait={portrait} top={top} bottom={bottom} />;
        }}
      />

      {/* top bar: kicker and step dots */}
      <div style={{position: 'absolute', left: '6%', right: '6%', top: height * 0.03, display: 'flex', justifyContent: 'space-between', alignItems: 'center', opacity: barIn, fontFamily: fonts.mono, fontSize: 24 * u, letterSpacing: '0.18em', textTransform: 'uppercase', color: pal.muted}}>
        <span style={{display: 'flex', alignItems: 'center', gap: 12 * u}}>
          <span style={{width: 10 * u, height: 10 * u, borderRadius: '50%', background: pal.accent}} />
          {props.kicker || 'How to'}
        </span>
        <span style={{display: 'flex', gap: 8 * u}}>
          {steps.map((_, i) => (
            <span key={i} style={{width: (i === currentStep ? 34 : 12) * u, height: 12 * u, borderRadius: 6 * u, background: i <= currentStep ? pal.accent : alpha(pal.text, 0.18)}} />
          ))}
        </span>
      </div>

      {timeline.slice(1).map(tl => <LightLeak key={tl.index} from={tl.from - half} durationInFrames={overlap * 2} seed={tl.index * 5 + 3} hueShift={dark ? 0 : 10} opacity={dark ? 0.3 : 0.4} />)}

      {props.showCaptions
        ? timeline.map(tl => (
            <Sequence key={tl.index} from={tl.from} durationInFrames={tl.durationInFrames}>
              <AbsoluteFill style={{justifyContent: 'flex-end', padding: portrait ? '0 7% 6%' : '0 18% 4%'}}>
                <StyledCaptions scene={tl.scene} variant="pop" accent={pal.accent} color={pal.text} font={fonts.sans} size={(portrait ? 54 : 46) * u} words={portrait ? 4 : 6} weight={800} shadow={dark} />
              </AbsoluteFill>
            </Sequence>
          ))
        : null}
      <Vignette strength={dark ? 0.55 : 0.12} />
      <Grain opacity={dark ? 0.06 : 0.035} />
      <NarrationTrack media={media} />
      <AdWeave media={media} theme={{background: pal.bg, text: pal.text, font: fonts.serifDisplay}} />
    </AbsoluteFill>
  );
};

export default defineEntry({id: 'tutorial-creator-howto', schema: Props, component: CreatorHowTo});
