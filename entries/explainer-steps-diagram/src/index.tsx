import React from 'react';
import {AbsoluteFill, Sequence, interpolate, spring, useCurrentFrame, useVideoConfig} from 'remotion';
import {evolvePath} from '@remotion/paths';
import {AdWeave, Captions, NarrationTrack, defineEntry, fadeIn, useSceneTimeline, type EntryProps} from '@viralaunch/kit';
import {Props} from './schema';

const PALETTES = {
  blueprint: {bg: '#0b2a4a', grid: 'rgba(255,255,255,.07)', node: '#123b66', line: '#9cc9ff', text: '#ffffff', muted: '#a9c6e8', active: '#ffd166'},
  chalkboard: {bg: '#24312b', grid: 'rgba(255,255,255,.04)', node: '#2f3f37', line: '#e8e4d8', text: '#f4f1e8', muted: '#b9b4a6', active: '#ff8fab'},
  clean: {bg: '#f8fafc', grid: 'rgba(15,23,42,.05)', node: '#ffffff', line: '#334155', text: '#0f172a', muted: '#64748b', active: '#2563eb'},
} as const;

const StepsDiagram: React.FC<EntryProps<Props>> = ({media, props}) => {
  const frame = useCurrentFrame();
  const {fps, width, height, durationInFrames} = useVideoConfig();
  const p = {...PALETTES[props.palette], active: media.accent ?? PALETTES[props.palette].active}; /* shared sequence accent */
  const timeline = useSceneTimeline(media);
  const n = props.steps.length;
  const portrait = height >= width;
  // Node positions: a vertical zig-zag on portrait, a horizontal row on landscape.
  const nodes = props.steps.map((_, i) => portrait
    ? {x: width * (i % 2 === 0 ? 0.3 : 0.7), y: height * (0.24 + (0.56 * i) / Math.max(1, n - 1))}
    : {x: width * (0.12 + (0.76 * i) / Math.max(1, n - 1)), y: height * (i % 2 === 0 ? 0.42 : 0.62)});
  const r = Math.min(width, height) * (portrait ? 0.085 : 0.07);
  // Active step follows the narration scenes when counts match, else equal slices.
  const sceneIndex = timeline.findIndex(t => frame >= t.from && frame < t.from + t.durationInFrames);
  const active = timeline.length === n ? Math.max(0, sceneIndex) : Math.min(n - 1, Math.floor((frame / durationInFrames) * n));
  const stepStart = (i: number) => (timeline.length === n ? timeline[i].from : (i * durationInFrames) / n);
  const edges = props.steps.slice(1).map((_, i) => [i, i + 1]);
  if (props.cycle && n > 2) edges.push([n - 1, 0]);
  const pathFor = (a: number, b: number) => {
    const A = nodes[a], B = nodes[b];
    const dx = B.x - A.x, dy = B.y - A.y, len = Math.hypot(dx, dy) || 1;
    const sx = A.x + (dx / len) * (r + 12), sy = A.y + (dy / len) * (r + 12), ex = B.x - (dx / len) * (r + 22), ey = B.y - (dy / len) * (r + 22);
    const bend = b === 0 ? (portrait ? width * 0.36 : -height * 0.3) : 0;
    const cx = (sx + ex) / 2 + (portrait ? bend : 0), cy = (sy + ey) / 2 + (portrait ? 0 : bend);
    return {d: `M${sx},${sy} Q${cx},${cy} ${ex},${ey}`, angle: Math.atan2(ey - cy, ex - cx), ex, ey};
  };
  return (
    <AbsoluteFill style={{background: p.bg, fontFamily: '"Inter", "Helvetica Neue", Arial, sans-serif', color: p.text}}>
      <svg width={width} height={height} style={{position: 'absolute'}}>
        {Array.from({length: Math.ceil(width / 60)}, (_, i) => <line key={'v' + i} x1={i * 60} x2={i * 60} y1={0} y2={height} stroke={p.grid} />)}
        {Array.from({length: Math.ceil(height / 60)}, (_, i) => <line key={'h' + i} y1={i * 60} y2={i * 60} x1={0} x2={width} stroke={p.grid} />)}
        {edges.map(([a, b]) => {
          const start = stepStart(b === 0 ? n - 1 : b) - 12;
          const t = interpolate(frame, [start, start + 14], [0, 1], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});
          if (t <= 0) return null;
          const {d, angle, ex, ey} = pathFor(a, b);
          const e = evolvePath(t, d);
          return (
            <g key={`${a}-${b}`}>
              <path d={d} fill="none" stroke={p.line} strokeWidth={5} strokeLinecap="round" strokeDasharray={e.strokeDasharray} strokeDashoffset={e.strokeDashoffset} />
              {t > 0.95 ? <polygon points="0,-12 22,0 0,12" fill={p.line} transform={`translate(${ex},${ey}) rotate(${(angle * 180) / Math.PI})`} /> : null}
            </g>
          );
        })}
      </svg>
      {props.steps.map((s, i) => {
        const pop = spring({frame: frame - stepStart(i), fps, config: {damping: 13, stiffness: 170}});
        const isActive = i === active;
        const {x, y} = nodes[i];
        const labelLeft = portrait ? (i % 2 === 0 ? x + r + 26 : undefined) : undefined;
        const labelRight = portrait ? (i % 2 === 1 ? width - x + r + 26 : undefined) : undefined;
        return (
          <React.Fragment key={i}>
            <div style={{position: 'absolute', left: x - r, top: y - r, width: r * 2, height: r * 2, borderRadius: '50%', background: p.node, border: `6px solid ${isActive ? p.active : p.line}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: r * 0.55, fontWeight: 900, color: isActive ? p.active : p.text, transform: `scale(${pop * (isActive ? 1.12 : 1)})`, boxShadow: isActive ? `0 0 50px ${p.active}66` : 'none'}}>
              {s.symbol || i + 1}
            </div>
            <div style={{position: 'absolute', top: portrait ? y - r * 0.75 : y + r + 18, left: portrait ? labelLeft : x - 170, right: labelRight, width: portrait ? width * 0.4 : 340, textAlign: portrait ? (i % 2 === 0 ? 'left' : 'right') : 'center', opacity: pop * (isActive ? 1 : 0.6)}}>
              <div style={{fontSize: 44, fontWeight: 800, lineHeight: 1.1, color: isActive ? p.active : p.text}}>{s.label}</div>
              {s.detail ? <div style={{fontSize: 28, color: p.muted, marginTop: 8, lineHeight: 1.3}}>{s.detail}</div> : null}
            </div>
          </React.Fragment>
        );
      })}
      <div style={{position: 'absolute', top: height * 0.05, left: 0, right: 0, textAlign: 'center', fontSize: 58, fontWeight: 900, padding: '0 6%', opacity: fadeIn(frame, 0, 10)}}>{props.title}</div>
      {props.showCaptions
        ? timeline.map(t => (
            <Sequence key={t.index} from={t.from} durationInFrames={t.durationInFrames}>
              <AbsoluteFill style={{justifyContent: 'flex-end', padding: '0 7% 5%'}}>
                <Captions scene={t.scene} color={p.text} highlight={p.active} style={{fontSize: 44}} />
              </AbsoluteFill>
            </Sequence>
          ))
        : null}
      <NarrationTrack media={media} />
      <AdWeave media={media} theme={{background: p.bg, text: p.text}} />
    </AbsoluteFill>
  );
};

export default defineEntry({id: 'explainer-steps-diagram', schema: Props, component: StepsDiagram});
