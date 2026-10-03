import React from 'react';
import {AbsoluteFill, Easing, Sequence, interpolate, spring, useCurrentFrame, useVideoConfig} from 'remotion';
import {AdWeave, Captions, NarrationTrack, defineEntry, fadeIn, useSceneTimeline, type EntryProps, useLook, mix, type ActiveLook} from '@viralaunch/kit';
import {Props} from './schema';

/** The timeline in a sequence's shared look. */
const fromLook = (l: ActiveLook) => ({bg: l.palette.bg, line: mix(l.palette.bg2, l.palette.text, 0.2), text: l.palette.text, muted: l.palette.muted, accent: l.palette.accent, band: `${l.palette.accent}14`});

const PALETTES = {
  ink: {bg: '#0e1116', line: '#2b3340', text: '#f1f4f8', muted: '#8b96a8', accent: '#ff9f1c', band: 'rgba(255,159,28,.08)'},
  chalk: {bg: '#1f2a24', line: '#4b5d52', text: '#f3f1e7', muted: '#b3b9a9', accent: '#ffe08a', band: 'rgba(255,224,138,.07)'},
  neon: {bg: '#07051a', line: '#2a2160', text: '#ffffff', muted: '#9a90d6', accent: '#00f0ff', band: 'rgba(0,240,255,.07)'},
  parchment: {bg: '#efe4cc', line: '#c8b48a', text: '#2d2214', muted: '#7a6648', accent: '#a23b22', band: 'rgba(162,59,34,.07)'},
} as const;

const formatYear = (y: number) => (y < 0 ? `${Math.abs(Math.round(y))} BC` : `${Math.round(y)}`);

const TimelineEras: React.FC<EntryProps<Props>> = ({media, props}) => {
  const frame = useCurrentFrame();
  const {fps, width, height, durationInFrames} = useVideoConfig();
  const look = useLook();
  const p = look ? fromLook(look) : {...PALETTES[props.palette], accent: media.accent ?? PALETTES[props.palette].accent};
  const timeline = useSceneTimeline(media);
  const items = props.milestones;
  const portrait = height >= width;
  const gap = portrait ? height * 0.34 : height * 0.42;
  const intro = Math.round(1.2 * fps);
  const outro = Math.round(1.0 * fps);
  const per = Math.max(1, (durationInFrames - intro - outro) / items.length);

  // Which milestone is "now": the camera eases onto each one in turn.
  const progress = Math.max(0, Math.min(items.length - 1, (frame - intro) / per));
  const index = Math.floor(progress);
  const local = progress - index;
  const eased = index + Easing.inOut(Easing.cubic)(Math.min(1, local * 2.2));
  const cameraY = eased * gap;
  const lineX = portrait ? width * 0.18 : width * 0.3;
  const counter = interpolate(eased, items.map((_, i) => i), items.map(m => m.year), {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});

  // Era bands: consecutive milestones that share a non-empty era.
  const bands: Array<{era: string; from: number; to: number}> = [];
  items.forEach((m, i) => {
    const last = bands[bands.length - 1];
    if (m.era && last && last.era === m.era && last.to === i - 1) last.to = i;
    else if (m.era) bands.push({era: m.era, from: i, to: i});
  });

  return (
    <AbsoluteFill style={{background: p.bg, fontFamily: look?.font.body ?? 'Inter, system-ui, sans-serif', overflow: 'hidden'}}>
      <AbsoluteFill style={{transform: `translateY(${height * 0.5 - cameraY}px)`}}>
        {bands.map(b => (
          <div key={b.era + b.from} style={{position: 'absolute', left: 0, right: 0, top: b.from * gap - gap * 0.42, height: (b.to - b.from) * gap + gap * 0.84, background: p.band, borderTop: `1px solid ${p.line}`}}>
            <div style={{position: 'absolute', right: width * 0.05, top: 18, color: p.accent, fontSize: 26, fontWeight: 800, letterSpacing: '0.25em', textTransform: 'uppercase', opacity: 0.8}}>{b.era}</div>
          </div>
        ))}
        <div style={{position: 'absolute', left: lineX - 2, top: -gap, width: 4, height: (items.length + 1) * gap, background: p.line}} />
        <div style={{position: 'absolute', left: lineX - 2, top: -gap, width: 4, height: cameraY + gap, background: p.accent}} />
        {items.map((m, i) => {
          const appear = spring({frame: frame - (intro + Math.max(0, i - 0.6) * per), fps, config: {damping: 16, stiffness: 140}});
          const active = Math.abs(eased - i) < 0.5;
          return (
            <div key={i} style={{position: 'absolute', top: i * gap, left: 0, right: 0}}>
              <div style={{position: 'absolute', left: lineX - 16, top: -16, width: 32, height: 32, borderRadius: 16, background: active ? p.accent : p.bg, border: `4px solid ${active ? p.accent : p.line}`, transform: `scale(${active ? 1.25 : 1})`}} />
              <div style={{position: 'absolute', left: lineX + 48, top: -56, right: width * 0.06, opacity: Math.max(0.25, appear), transform: `translateX(${(1 - appear) * 60}px)`}}>
                <div style={{color: p.accent, fontSize: 40, fontWeight: 900, letterSpacing: '0.02em'}}>{m.when}</div>
                <div style={{color: p.text, fontSize: portrait ? 58 : 52, fontWeight: 800, lineHeight: 1.1, marginTop: 6}}>{m.title}</div>
                {m.fact ? <div style={{color: p.muted, fontSize: 34, lineHeight: 1.3, marginTop: 12}}>{m.fact}</div> : null}
              </div>
            </div>
          );
        })}
      </AbsoluteFill>
      <AbsoluteFill style={{pointerEvents: 'none', background: `linear-gradient(${p.bg} 0%, ${p.bg} 21%, transparent 33%, transparent 72%, ${p.bg} 100%)`}} />
      <div style={{position: 'absolute', top: height * 0.05, left: 0, right: 0, textAlign: 'center', opacity: fadeIn(frame, 0, fps * 0.6)}}>
        <div style={{color: p.text, fontSize: 56, fontWeight: 900, padding: '0 6%'}}>{props.title}</div>
        <div style={{color: p.accent, fontSize: 88, fontWeight: 900, fontVariantNumeric: 'tabular-nums', marginTop: 6}}>{formatYear(counter)}</div>
      </div>
      {props.showCaptions
        ? timeline.map(t => (
            <Sequence key={t.index} from={t.from} durationInFrames={t.durationInFrames}>
              <AbsoluteFill style={{justifyContent: 'flex-end', padding: '0 7% 7%'}}>
                <Captions scene={t.scene} color={p.text} highlight={p.accent} style={{fontSize: 50}} />
              </AbsoluteFill>
            </Sequence>
          ))
        : null}
      <NarrationTrack media={media} />
      <AdWeave media={media} theme={{background: p.bg, text: p.text}} />
    </AbsoluteFill>
  );
};

export default defineEntry({id: 'timeline-eras', schema: Props, component: TimelineEras});
