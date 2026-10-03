import React from 'react';
import {AbsoluteFill, Easing, Sequence, interpolate, random, useCurrentFrame, useVideoConfig} from 'remotion';
import {AdWeave, Captions, NarrationTrack, defineEntry, fadeIn, useSceneTimeline, type EntryProps, useLook} from '@viralaunch/kit';
import {Props} from './schema';

const STARS = Array.from({length: 220}, (_, i) => ({x: random(`sx${i}`), y: random(`sy${i}`), r: 0.6 + random(`sr${i}`) * 1.8, tw: random(`st${i}`) * Math.PI * 2}));

const Starfield: React.FC<{zoom: number}> = ({zoom}) => {
  const frame = useCurrentFrame();
  const {width, height} = useVideoConfig();
  const look = useLook();
  return (
    <AbsoluteFill style={{background: look ? `radial-gradient(ellipse at 50% 40%, ${look.palette.bg2} 0%, ${look.palette.bg} 70%)` : 'radial-gradient(ellipse at 50% 40%, #0d1433 0%, #03040c 70%)'}}>
      <svg width={width} height={height}>
        {STARS.map((s, i) => {
          const parallax = 1 + (zoom - 1) * 0.03 * s.r;
          const x = width / 2 + (s.x - 0.5) * width * parallax;
          const y = height / 2 + (s.y - 0.5) * height * parallax;
          return <circle key={i} cx={x} cy={y} r={s.r} fill="#fff" opacity={0.35 + 0.35 * Math.sin(frame / 12 + s.tw)} />;
        })}
      </svg>
    </AbsoluteFill>
  );
};

const ScaleLadder: React.FC<EntryProps<Props>> = ({media, props}) => {
  const frame = useCurrentFrame();
  const {fps, width, height, durationInFrames} = useVideoConfig();
  const timeline = useSceneTimeline(media);
  const look = useLook();
  const objs = props.objects;
  const intro = Math.round(1.0 * fps);
  const per = (durationInFrames - intro - fps * 0.8) / objs.length;
  const stepFloat = Math.max(0, Math.min(objs.length - 1, (frame - intro) / per));
  const step = Math.floor(stepFloat);
  // Ease from the previous body's framing to this one in log space, early in each step.
  const t = Easing.inOut(Easing.cubic)(Math.min(1, (stepFloat - step) * 2.5));

  // Lay bodies left-to-right, touching edges, in world units (= size).
  const xs: number[] = [];
  let cursor = 0;
  objs.forEach((o, i) => {
    xs.push(cursor + o.size / 2);
    cursor += o.size + (objs[i + 1]?.size ?? 0) * 0.15;
  });
  // The camera frames the current body so it fills ~45% of the shorter screen side.
  const frameSize = (i: number) => objs[i].size / (Math.min(width, height) * 0.45);
  const prev = Math.max(0, step - 1);
  const unitsPerPx = step === 0 ? frameSize(0) : Math.exp(Math.log(frameSize(prev)) + (Math.log(frameSize(step)) - Math.log(frameSize(prev))) * t);
  const camX = step === 0 ? xs[0] : xs[prev] + (xs[step] - xs[prev]) * t;
  const scale = 1 / unitsPerPx;
  const zoomOut = Math.log10(unitsPerPx / frameSize(0) + 1) + 1;

  const current = objs[step];
  return (
    <AbsoluteFill style={{fontFamily: look?.font.body ?? '"Inter", "Helvetica Neue", Arial, sans-serif', color: look?.palette.text ?? '#fff'}}>
      <Starfield zoom={zoomOut} />
      <AbsoluteFill>
        {objs.map((o, i) => {
          const px = width / 2 + (xs[i] - camX) * scale;
          const r = (o.size / 2) * scale;
          if (r < 0.5 || px + r < -width || px - r > width * 2) return null;
          const visible = i <= step;
          const appear = interpolate(frame, [intro + i * per - 6, intro + i * per + 10], [0, 1], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});
          return (
            <div key={i} style={{position: 'absolute', left: px - r, top: height * 0.47 - r, width: r * 2, height: r * 2, opacity: visible ? appear : 0}}>
              <div style={{width: '100%', height: '100%', borderRadius: '50%', background: `radial-gradient(circle at 35% 30%, ${o.color}, ${o.color}cc 45%, #000 100%)`, boxShadow: `0 0 ${Math.min(120, r * 0.4)}px ${o.color}55`}} />
              {o.rings ? <div style={{position: 'absolute', left: '-35%', top: '38%', width: '170%', height: '24%', borderRadius: '50%', border: `${Math.max(1, r * 0.05)}px solid ${o.color}aa`, transform: 'rotate(-12deg)'}} /> : null}
            </div>
          );
        })}
      </AbsoluteFill>
      <div style={{position: 'absolute', top: height * 0.06, left: 0, right: 0, textAlign: 'center', opacity: fadeIn(frame, 0, 10)}}>
        <div style={{fontSize: 48, fontWeight: 800, opacity: 0.85}}>{props.title}</div>
      </div>
      {frame >= intro ? (
        <div key={step} style={{position: 'absolute', top: height * 0.72, left: 0, right: 0, textAlign: 'center', opacity: fadeIn(frame, intro + step * per, 8)}}>
          <div style={{fontSize: 84, fontWeight: 900}}>{current.name}</div>
          <div style={{fontSize: 48, fontWeight: 700, color: current.color, marginTop: 6}}>{current.sizeLabel}</div>
          {step > 0 ? <div style={{fontSize: 32, opacity: 0.75, marginTop: 10}}>{`${(current.size / objs[step - 1].size).toLocaleString('en-US', {maximumFractionDigits: 1})}× ${objs[step - 1].name}`}</div> : null}
        </div>
      ) : null}
      {props.showCaptions
        ? timeline.map(tl => (
            <Sequence key={tl.index} from={tl.from} durationInFrames={tl.durationInFrames}>
              <AbsoluteFill style={{justifyContent: 'flex-end', padding: '0 7% 6%'}}>
                <Captions scene={tl.scene} style={{fontSize: 44}} highlight={media.accent ?? '#7dd3fc'} />
              </AbsoluteFill>
            </Sequence>
          ))
        : null}
      <NarrationTrack media={media} />
      <AdWeave media={media} theme={{background: '#03040c'}} />
    </AbsoluteFill>
  );
};

export default defineEntry({id: 'space-scale-ladder', schema: Props, component: ScaleLadder});
