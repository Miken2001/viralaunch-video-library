import React from 'react';
import {AbsoluteFill, Easing, Sequence, interpolate, spring, useCurrentFrame, useVideoConfig} from 'remotion';
import {AdWeave, Captions, NarrationTrack, defineEntry, fadeIn, useSceneTimeline, type EntryProps} from '@viralaunch/kit';
import {Props} from './schema';

const PALETTES = {
  graphite: {bg: '#121316', panel: '#1c1e23', text: '#f3f4f6', muted: '#8f96a3', bar: '#3b82f6', hi: '#f59e0b'},
  paper: {bg: '#f7f3ea', panel: '#ece5d6', text: '#1f1b16', muted: '#6f675c', bar: '#2f5d8a', hi: '#d1495b'},
  midnight: {bg: '#060b1d', panel: '#0e1733', text: '#eef2ff', muted: '#8c9ad0', bar: '#6366f1', hi: '#22d3ee'},
} as const;

const fmt = (v: number, d: number) => v.toLocaleString('en-US', {minimumFractionDigits: d, maximumFractionDigits: d});

const DataStoryBars: React.FC<EntryProps<Props>> = ({media, props}) => {
  const frame = useCurrentFrame();
  const {fps, width, height, durationInFrames} = useVideoConfig();
  const p = {...PALETTES[props.palette], hi: media.accent ?? PALETTES[props.palette].hi}; /* shared sequence accent */
  const timeline = useSceneTimeline(media);
  const portrait = height >= width;

  const heroEnd = Math.min(Math.round(3 * fps), Math.floor(durationInFrames * 0.3));
  const count = interpolate(frame, [6, Math.max(7, heroEnd - 10)], [0, props.headline.value], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: Easing.out(Easing.cubic)});
  const heroOut = interpolate(frame, [Math.max(0, heroEnd - 8), Math.max(1, heroEnd)], [1, 0], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});

  const sorted = [...props.bars].sort((a, b) => b.value - a.value);
  const max = sorted[0].value || 1;
  const chartStart = heroEnd;
  const rowH = (portrait ? height * 0.5 : height * 0.56) / sorted.length;
  const takeawayAt = chartStart + Math.round(sorted.length * 0.35 * fps) + fps;

  return (
    <AbsoluteFill style={{background: p.bg, fontFamily: '"Inter", "Helvetica Neue", Arial, sans-serif', color: p.text}}>
      <AbsoluteFill style={{justifyContent: 'center', alignItems: 'center', opacity: heroOut, padding: '0 8%', textAlign: 'center'}}>
        <div style={{fontSize: 40, color: p.muted, fontWeight: 600, marginBottom: 20}}>{props.title}</div>
        <div style={{fontSize: portrait ? 230 : 200, fontWeight: 900, letterSpacing: '-0.04em', fontVariantNumeric: 'tabular-nums', color: p.hi, lineHeight: 1}}>{fmt(count, props.decimals)}</div>
        <div style={{fontSize: 56, fontWeight: 800, marginTop: 10}}>{props.headline.unit}</div>
        {props.headline.label ? <div style={{fontSize: 36, color: p.muted, marginTop: 24}}>{props.headline.label}</div> : null}
      </AbsoluteFill>
      <Sequence from={chartStart}>
        <AbsoluteFill style={{padding: portrait ? '16% 7% 0' : '7% 8% 0', opacity: fadeIn(frame, chartStart, 8)}}>
          <div style={{fontSize: portrait ? 60 : 54, fontWeight: 900, lineHeight: 1.1, marginBottom: 40}}>{props.title}</div>
          {sorted.map((bar, i) => {
            const grow = spring({frame: frame - chartStart - i * 0.35 * fps, fps, config: {damping: 20, stiffness: 90}});
            const w = (bar.value / max) * grow;
            const color = bar.highlight ? p.hi : p.bar;
            return (
              <div key={bar.label} style={{height: rowH, display: 'flex', flexDirection: 'column', justifyContent: 'center'}}>
                <div style={{display: 'flex', justifyContent: 'space-between', fontSize: 34, fontWeight: 700, marginBottom: 10}}>
                  <span style={{color: bar.highlight ? p.hi : p.text}}>{bar.label}</span>
                  <span style={{fontVariantNumeric: 'tabular-nums', color: p.muted}}>{fmt(bar.value * grow, props.decimals)}{props.valueSuffix}</span>
                </div>
                <div style={{height: rowH * 0.34, background: p.panel, borderRadius: 10, overflow: 'hidden'}}>
                  <div style={{width: `${w * 100}%`, height: '100%', background: color, borderRadius: 10}} />
                </div>
              </div>
            );
          })}
          {props.takeaway ? (
            <div style={{marginTop: 40, fontSize: 46, fontWeight: 800, lineHeight: 1.2, opacity: fadeIn(frame, takeawayAt, 10), transform: `translateY(${interpolate(frame, [takeawayAt, takeawayAt + 10], [20, 0], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'})}px)`}}>
              {props.takeaway}
            </div>
          ) : null}
        </AbsoluteFill>
      </Sequence>
      {props.source ? <div style={{position: 'absolute', left: '7%', bottom: '3%', fontSize: 24, color: p.muted}}>{props.source}</div> : null}
      {props.showCaptions
        ? timeline.map(t => (
            <Sequence key={t.index} from={t.from} durationInFrames={t.durationInFrames}>
              <AbsoluteFill style={{justifyContent: 'flex-end', padding: '0 7% 8%'}}>
                <Captions scene={t.scene} color={p.text} highlight={p.hi} style={{fontSize: 48}} />
              </AbsoluteFill>
            </Sequence>
          ))
        : null}
      <NarrationTrack media={media} />
      <AdWeave media={media} theme={{background: p.bg, text: p.text}} />
    </AbsoluteFill>
  );
};

export default defineEntry({id: 'data-story-bars', schema: Props, component: DataStoryBars});
