import React from 'react';
import {AbsoluteFill, Sequence, spring, useCurrentFrame, useVideoConfig} from 'remotion';
import {AdWeave, Captions, NarrationTrack, SceneAsset, defineEntry, useSceneTimeline, type EntryProps, type Scene, useLook, mix, type ActiveLook} from '@viralaunch/kit';
import {Props} from './schema';

/** Slide colours in a sequence's shared look: tones of the background family with the accent woven in. */
const fromLook = (l: ActiveLook) => [mix(l.palette.bg2, l.palette.accent, 0.35), l.palette.bg2, mix(l.palette.bg, l.palette.accent, 0.2), mix(l.palette.bg2, l.palette.accent, 0.15), l.palette.surface];

const PALETTES = {
  heat: ['#ff3d2e', '#ff7a00', '#ffb800', '#e0115f', '#8a2be2'],
  ocean: ['#0057ff', '#00a6ff', '#00c2a8', '#3a0ca3', '#0b3d91'],
  forest: ['#1b7f3b', '#4caf50', '#8bc34a', '#00695c', '#33691e'],
  mono: ['#111111', '#2a2a2a', '#3d3d3d', '#1a1a1a', '#262626'],
} as const;

const Intro: React.FC<{title: string; count: number; color: string}> = ({title, count, color}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const s = spring({frame, fps, config: {damping: 12, stiffness: 150}});
  return (
    <AbsoluteFill style={{background: color, justifyContent: 'center', alignItems: 'center', padding: '0 8%'}}>
      <div style={{fontSize: 340, fontWeight: 900, color: '#fff', lineHeight: 0.85, transform: `scale(${s})`}}>{count}</div>
      <div style={{fontSize: 80, fontWeight: 900, color: '#fff', textAlign: 'center', lineHeight: 1.05, marginTop: 30, opacity: s, textTransform: 'uppercase'}}>{title}</div>
    </AbsoluteFill>
  );
};

const Item: React.FC<{rank: number; title: string; why: string; color: string; scene?: Scene}> = ({rank, title, why, color, scene}) => {
  const frame = useCurrentFrame();
  const {fps, width} = useVideoConfig();
  const crash = spring({frame, fps, config: {damping: 9, stiffness: 220, mass: 0.7}});
  const slide = spring({frame: frame - 6, fps, config: {damping: 16, stiffness: 160}});
  const shake = frame < 8 ? Math.sin(frame * 3) * (8 - frame) * 2 : 0;
  const display = useLook()?.font.display;
  return (
    <AbsoluteFill style={{background: color, transform: `translateX(${shake}px)`}}>
      {scene?.video ? (
        <AbsoluteFill>
          <SceneAsset scene={scene} />
          <AbsoluteFill style={{background: `linear-gradient(transparent 30%, ${color}ee 85%)`}} />
        </AbsoluteFill>
      ) : null}
      <div style={{position: 'absolute', top: '8%', left: '7%', fontFamily: display, fontSize: Math.min(420, width * 0.4), fontWeight: 900, color: '#fff', lineHeight: 0.8, transform: `scale(${2.2 - crash * 1.2})`, transformOrigin: 'top left', opacity: crash, textShadow: '0 10px 40px rgba(0,0,0,.35)'}}>
        #{rank}
      </div>
      <div style={{position: 'absolute', left: '7%', right: '7%', bottom: '26%', transform: `translateY(${(1 - slide) * 80}px)`, opacity: slide}}>
        <div style={{fontFamily: display, fontSize: 92, fontWeight: 900, color: '#fff', lineHeight: 1, textTransform: 'uppercase', textShadow: '0 6px 30px rgba(0,0,0,.4)'}}>{title}</div>
        {why ? <div style={{fontSize: 42, fontWeight: 600, color: 'rgba(255,255,255,.88)', marginTop: 18, lineHeight: 1.25}}>{why}</div> : null}
      </div>
    </AbsoluteFill>
  );
};

const ListicleCountdown: React.FC<EntryProps<Props>> = ({media, props}) => {
  const {fps, durationInFrames} = useVideoConfig();
  const timeline = useSceneTimeline(media);
  const look = useLook();
  const colors = look ? fromLook(look) : PALETTES[props.palette];
  const n = props.items.length;
  const intro = Math.min(Math.round(1.8 * fps), Math.floor(durationInFrames / (n + 2)));
  const per = Math.floor((durationInFrames - intro) / n);
  // Use scene images in order when there is one scene per item (+ optional intro scene).
  const sceneFor = (i: number) => (media.scenes.length >= n ? media.scenes[media.scenes.length - n + i] : undefined);
  return (
    <AbsoluteFill style={{fontFamily: look?.font.body ?? '"Inter", "Helvetica Neue", Arial, sans-serif'}}>
      <Sequence durationInFrames={intro}>
        <Intro title={props.title} count={n} color={colors[0]} />
      </Sequence>
      {props.items.map((item, i) => (
        <Sequence key={i} from={intro + i * per} durationInFrames={i === n - 1 ? durationInFrames - intro - i * per : per}>
          <Item rank={n - i} title={item.title} why={item.why} color={colors[(i + 1) % colors.length]} scene={sceneFor(i)} />
        </Sequence>
      ))}
      {props.showCaptions
        ? timeline.map(t => (
            <Sequence key={t.index} from={t.from} durationInFrames={t.durationInFrames}>
              <AbsoluteFill style={{justifyContent: 'flex-end', padding: '0 7% 8%'}}>
                <Captions scene={t.scene} style={{fontSize: 50}} highlight={media.accent ?? '#FFD60A'} />
              </AbsoluteFill>
            </Sequence>
          ))
        : null}
      <NarrationTrack media={media} />
      <AdWeave media={media} />
    </AbsoluteFill>
  );
};

export default defineEntry({id: 'listicle-countdown', schema: Props, component: ListicleCountdown});
