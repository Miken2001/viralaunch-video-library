import React from 'react';
import {AbsoluteFill, Sequence, useCurrentFrame, useVideoConfig} from 'remotion';
import {AdWeave, NarrationTrack, captionSafeBottom, defineEntry, mix, useContentFrames, useLook, useSceneTimeline, type ActiveLook, type EntryProps, type Media} from '@viralaunch/kit';
import {Grain, KineticText, LightLeak, LineIcon, SceneSeries, StyledCaptions, Vignette, alpha, ease, fonts, progress, tween} from '@viralaunch/kit/fx';
import {Props, type Shot} from './schema';
import {Mist, Scenery, Weather, type Pal, type Stage} from './scenery';

const TIMES = {
  dawn: {skyTop: '#27324f', horizon: '#d99a7c', glow: '#ffd9b0', ink: '#121722'},
  day: {skyTop: '#5f7688', horizon: '#b9c3c8', glow: '#f4f6f2', ink: '#1b252c'},
  dusk: {skyTop: '#1b1a36', horizon: '#b5606a', glow: '#ffb27a', ink: '#100d1a'},
  night: {skyTop: '#050a14', horizon: '#1e3550', glow: '#a9c8ff', ink: '#03060b'},
} as const;

const MOODS = {
  'blue-hour': {tint: '#2f5d8a', amount: 0.22, accent: '#ffc777'},
  ember: {tint: '#c0563a', amount: 0.25, accent: '#ffb35a'},
  moss: {tint: '#4c6b45', amount: 0.3, accent: '#e9d58c'},
  mono: {tint: '#7a7a7a', amount: 0.4, accent: '#e8e8e8'},
} as const;

const ownPal = (mood: Props['mood'], time: Shot['time'], accent?: string): Pal => {
  const T = TIMES[time];
  const M = MOODS[mood];
  return {
    skyTop: mix(T.skyTop, M.tint, M.amount * 0.8),
    horizon: mix(T.horizon, M.tint, M.amount),
    glow: T.glow,
    ink: mix(T.ink, M.tint, M.amount * 0.3),
    accent: accent ?? M.accent,
    text: '#f3efe7',
    muted: '#c3beb3',
    fog: mix(T.horizon, '#ffffff', 0.35),
    precip: mix('#dfe8f5', M.tint, 0.15),
    light: false,
  };
};

/** The scene in a sequence's shared look: sky, ink and lights come from the look; time of day still shifts the horizon. */
const LIFT: Record<Shot['time'], number> = {dawn: 0.3, day: 0.14, dusk: 0.38, night: 0};
const fromLook = (l: ActiveLook, time: Shot['time']): Pal => {
  const light = l.tone === 'light';
  const c = l.palette;
  const horizon = mix(c.bg2, c.accent, LIFT[time] * (light ? 0.5 : 1));
  return {
    skyTop: !light && time === 'night' ? mix(c.bg, '#000000', 0.25) : c.bg,
    horizon,
    glow: light ? c.accent : mix(c.accent, '#ffffff', 0.35),
    ink: light ? mix(c.text, c.bg, 0.3) : mix(c.bg, '#000000', 0.5),
    accent: c.accent,
    text: c.text,
    muted: c.muted,
    fog: light ? c.surface : mix(c.text, horizon, 0.55),
    precip: light ? mix(c.text, c.bg, 0.4) : mix(c.line, horizon, 0.25),
    light,
  };
};

const icon = (shot: Shot) => (shot.weather === 'clear' ? (shot.time === 'night' ? 'star' : 'sun') : shot.weather === 'rain' || shot.weather === 'storm' ? 'rain' : 'cloud');
const MIST: Record<Shot['weather'], number> = {rain: 0.35, storm: 0.3, snow: 0.45, fog: 1, clear: 0.15};

const DEFAULT_SHOT: Shot = {setting: 'forest', weather: 'rain', time: 'night', figure: 'none', label: ''};
const titleFrames = (media: Media, fps: number) => Math.min(Math.round(3.4 * fps), Math.round((media.scenes[0]?.audio.duration ?? 3) * fps * 0.85));

/** Small location tag: a weather icon that draws itself, the place, then time · weather. */
const Tag: React.FC<{shot: Shot; p: Pal; u: number; top: number; start: number; end: number}> = ({shot, p, u, top, start, end}) => {
  const frame = useCurrentFrame();
  const inP = progress(frame, start, 22, ease.expo);
  const out = 1 - progress(frame, end - 14, 14, ease.cinematic);
  if (!shot.label || frame < start) return null;
  return (
    <div style={{position: 'absolute', left: '6%', top, display: 'flex', alignItems: 'center', gap: 18 * u, padding: `${12 * u}px ${22 * u}px ${12 * u}px ${14 * u}px`, borderRadius: 999, background: p.light ? alpha(p.fog, 0.8) : alpha(mix(p.skyTop, p.ink, 0.6), 0.62), boxShadow: `inset 0 0 0 1px ${alpha(p.text, 0.14)}`, opacity: inP * out, transform: `translateY(${(1 - inP) * -16 * u}px)`}}>
      <LineIcon name={icon(shot)} progress={progress(frame, start + 4, 30, ease.cinematic)} size={44 * u} color={p.accent} strokeWidth={5} />
      <div>
        <div style={{fontFamily: fonts.serif, fontSize: 32 * u, color: p.text, lineHeight: 1.1, clipPath: `inset(0 ${(1 - inP) * 100}% 0 0)`}}>{shot.label}</div>
        <div style={{fontFamily: fonts.mono, fontSize: 17 * u, letterSpacing: '0.24em', color: p.muted, textTransform: 'uppercase', marginTop: 4 * u, opacity: progress(frame, start + 10, 16)}}>
          {shot.time} · {shot.weather}
        </div>
      </div>
    </div>
  );
};

const RainMood: React.FC<EntryProps<Props>> = ({media, props}) => {
  const frame = useCurrentFrame();
  const {fps, width: W, height: H} = useVideoConfig();
  const look = useLook();
  const u = Math.min(W, H) / 1080;
  const portrait = H >= W;
  const timeline = useSceneTimeline(media);
  const contentEnd = useContentFrames(media);
  const shotAt = (i: number): Shot => props.shots[i % Math.max(1, props.shots.length)] ?? DEFAULT_SHOT;
  const palFor = (shot: Shot) => (look ? fromLook(look, shot.time) : ownPal(props.mood, shot.time, media.accent));
  const p0 = palFor(shotAt(0));
  const bars = !portrait && props.letterbox ? H * 0.09 : 0;
  const safe = look ? captionSafeBottom(look) : 0;
  const horizon = H * (portrait ? 0.56 : 0.6);
  const ground = Math.max(horizon + H * 0.08, Math.min(H * (portrait ? 0.79 : 0.82), look ? H * (1 - safe) + H * 0.04 : H));
  const stage: Stage = {W, H, u, horizon, ground, portrait};
  const titleLen = titleFrames(media, fps);
  const titleOut = progress(frame, titleLen - 16, 16, ease.cinematic);
  const overlap = Math.round(0.9 * fps);
  const half = Math.floor(overlap / 2);
  const last = timeline[timeline.length - 1];
  const closeStart = Math.max(last.from + Math.round(0.4 * fps), contentEnd - Math.round(3.6 * fps), titleLen);
  const closeOut = 1 - progress(frame, contentEnd - 12, 12, ease.cinematic);
  const tagTop = bars + H * (portrait ? 0.06 : 0.05);
  const filter = !look && props.mood === 'mono' ? 'grayscale(.85) contrast(1.06)' : undefined;
  return (
    <AbsoluteFill style={{background: p0.skyTop, overflow: 'hidden'}}>
      <AbsoluteFill style={{filter}}>
        <SceneSeries
          media={media}
          overlap={overlap}
          transition="blur"
          renderScene={({index, timed}) => (
            <ShotLayer shot={shotAt(index)} p={palFor(shotAt(index))} stage={stage} index={index} fps={fps} tagTop={tagTop} tagStart={index === 0 ? titleLen + 8 : half + 8} tagEnd={timed.durationInFrames + (index === 0 ? 0 : half)} />
          )}
        />
      </AbsoluteFill>
      {/* Opening title over the first shot */}
      <Sequence durationInFrames={titleLen}>
        <AbsoluteFill style={{opacity: 1 - titleOut, filter: `blur(${titleOut * 8}px)`, transform: `translateY(${-titleOut * 30 * u}px)`}}>
          <AbsoluteFill style={{background: `linear-gradient(180deg, ${alpha(p0.skyTop, 0.65)} 0%, ${alpha(p0.skyTop, 0.25)} 60%, transparent 100%)`}} />
          <AbsoluteFill style={{justifyContent: 'center', alignItems: 'center', padding: '0 9%', paddingBottom: H * (portrait ? 0.22 : 0.16)}}>
            <div style={{fontFamily: fonts.mono, fontSize: 20 * u, letterSpacing: '0.42em', color: p0.muted, textTransform: 'uppercase', opacity: progress(frame, 2, 18), marginBottom: 26 * u}}>
              {shotAt(0).time} · {shotAt(0).weather}
            </div>
            <KineticText
              text={props.title}
              start={6}
              stagger={5}
              duration={26}
              style="rise"
              align="center"
              accent={p0.accent}
              textStyle={{fontFamily: fonts.serifDisplay, color: p0.text, fontSize: Math.min((portrait ? 112 : 104) * u, (W * 1.5) / Math.max(8, props.title.length)), lineHeight: 1.08, letterSpacing: `${tween(frame, [0, titleLen], [0.06, 0.01], ease.cinematic)}em`, textShadow: `0 6px 40px ${alpha('#000000', p0.light ? 0.1 : 0.5)}`}}
            />
            <div style={{width: 220 * u * progress(frame, 18, 30, ease.cinematic), height: 2 * u, background: p0.accent, margin: `${30 * u}px 0 ${24 * u}px`}} />
            {props.subtitle ? <KineticText text={props.subtitle} start={24} stagger={3} style="blur" align="center" textStyle={{fontFamily: fonts.serif, fontStyle: 'italic', color: alpha(p0.text, 0.85), fontSize: 38 * u}} /> : null}
          </AbsoluteFill>
        </AbsoluteFill>
      </Sequence>
      {/* Quiet closing line, finished before any end card */}
      {props.closing && closeStart < contentEnd - fps ? (
        <Sequence from={closeStart} durationInFrames={contentEnd - closeStart}>
          <AbsoluteFill style={{justifyContent: 'center', alignItems: 'center', padding: '0 10%', paddingBottom: H * (portrait ? 0.3 : 0.24), opacity: closeOut}}>
            <KineticText text={props.closing} start={0} stagger={5} duration={30} style="blur" align="center" accent={palFor(shotAt(last.index)).accent} textStyle={{fontFamily: fonts.serif, fontStyle: 'italic', color: palFor(shotAt(last.index)).text, fontSize: (portrait ? 64 : 58) * u, lineHeight: 1.2, textShadow: `0 4px 30px ${alpha('#000000', look?.tone === 'light' ? 0.1 : 0.55)}`}} />
          </AbsoluteFill>
        </Sequence>
      ) : null}
      <LightLeak from={0} durationInFrames={Math.round(2.6 * fps)} seed={7} hueShift={190} opacity={0.3} />
      {timeline.slice(1).map(t => <LightLeak key={t.index} from={t.from - half} durationInFrames={overlap * 2} seed={t.index * 5 + 2} hueShift={180 + t.index * 20} opacity={0.22} />)}
      {props.showCaptions && !look ? <AbsoluteFill style={{pointerEvents: 'none', background: `linear-gradient(0deg, ${alpha(p0.ink, 0.6)} 0%, ${alpha(p0.ink, 0.3)} ${portrait ? 18 : 20}%, transparent ${portrait ? 30 : 34}%)`}} /> : null}
      {props.showCaptions
        ? timeline.map(t => (
            <Sequence key={t.index} from={t.from} durationInFrames={t.durationInFrames}>
              <AbsoluteFill style={{justifyContent: 'flex-end', padding: portrait ? '0 8% 12%' : `0 14% ${bars + H * 0.045}px`, opacity: frame >= titleLen ? 1 : 0}}>
                <StyledCaptions scene={t.scene} variant="minimal" color={p0.text} font={fonts.serif} size={(portrait ? 54 : 44) * u} words={portrait ? 5 : 8} weight={600} />
              </AbsoluteFill>
            </Sequence>
          ))
        : null}
      <Vignette strength={0.6} />
      <Grain opacity={0.09} />
      {bars ? (
        <>
          <div style={{position: 'absolute', top: 0, left: 0, right: 0, height: bars, background: '#000'}} />
          <div style={{position: 'absolute', bottom: 0, left: 0, right: 0, height: bars, background: '#000'}} />
        </>
      ) : null}
      <NarrationTrack media={media} />
      <AdWeave media={media} theme={{background: p0.skyTop, text: p0.text, font: fonts.serif}} />
    </AbsoluteFill>
  );
};

/** One narration scene: the drawn world with a slow camera push, its weather and its tag. */
const ShotLayer: React.FC<{shot: Shot; p: Pal; stage: Stage; index: number; fps: number; tagTop: number; tagStart: number; tagEnd: number}> = ({shot, p, stage, index, fps, tagTop, tagStart, tagEnd}) => {
  const frame = useCurrentFrame();
  const {durationInFrames} = useVideoConfig();
  const t = tween(frame, [0, durationInFrames], [0, 1], ease.cinematic);
  const push = 1.02 + 0.06 * t;
  const water = shot.setting === 'lake' || shot.setting === 'coast';
  return (
    <AbsoluteFill>
      <AbsoluteFill style={{transform: `scale(${push})`, transformOrigin: `50% ${(stage.ground / stage.H) * 100}%`}}>
        <Scenery shot={shot} p={p} s={stage} frame={frame} t={t} index={index} />
      </AbsoluteFill>
      <Mist color={p.fog} strength={MIST[shot.weather]} s={stage} frame={frame} seed={index} />
      <Weather shot={shot} p={p} s={stage} frame={frame} fps={fps} seed={index} water={water} />
      <Tag shot={shot} p={p} u={stage.u} top={tagTop} start={tagStart} end={tagEnd} />
    </AbsoluteFill>
  );
};

export default defineEntry({
  id: 'story-rain-mood',
  schema: Props,
  component: RainMood,
  // Shared captions wait for the opening title, like the template's own captions.
  captionHold: ({media, fps}) => titleFrames(media, fps),
});
