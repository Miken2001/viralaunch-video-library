import React from 'react';
import {AbsoluteFill, Sequence, spring, useCurrentFrame, useVideoConfig} from 'remotion';
import {AdWeave, Captions, NarrationTrack, SceneAsset, defineEntry, fadeIn, useContentFrames, useSceneTimeline, type EntryProps, useLook} from '@viralaunch/kit';
import {Props} from './schema';

const FONT = '"Inter", "Helvetica Neue", Arial, sans-serif';

const ComparisonSplit: React.FC<EntryProps<Props>> = ({media, props}) => {
  const frame = useCurrentFrame();
  const {fps, width, height} = useVideoConfig();
  const content = useContentFrames(media);
  const timeline = useSceneTimeline(media);
  const split = spring({frame, fps, config: {damping: 18, stiffness: 120}});
  const statsStart = Math.round(1.6 * fps);
  const verdictAt = Math.min(content - fps * 1.5, Math.max(statsStart + props.stats.length * 0.7 * fps + fps, content * 0.65));
  const vs = spring({frame: frame - 10, fps, config: {damping: 8, stiffness: 200}});
  const half = width / 2;
  const look = useLook();
  const imageFor = (i: number) => media.scenes[i]?.video ? media.scenes[i] : undefined;
  return (
    <AbsoluteFill style={{background: look?.palette.bg ?? '#0b0b0f', fontFamily: look?.font.body ?? FONT, color: '#fff'}}>
      {[props.left, props.right].map((side, i) => {
        const scene = imageFor(i);
        return (
          <div key={i} style={{position: 'absolute', top: 0, bottom: 0, width: half, left: i === 0 ? -half * (1 - split) : half + half * (1 - split), background: side.color, overflow: 'hidden'}}>
            {scene ? (
              <AbsoluteFill style={{opacity: 0.35}}>
                <SceneAsset scene={scene} />
              </AbsoluteFill>
            ) : null}
            <div style={{position: 'absolute', top: height * 0.14, left: 0, right: 0, textAlign: 'center', padding: '0 6%'}}>
              <div style={{fontSize: Math.min(76, half / Math.max(5, side.name.length) * 1.7), fontWeight: 900, lineHeight: 1, textTransform: 'uppercase'}}>{side.name}</div>
              {side.subtitle ? <div style={{fontSize: 28, opacity: 0.85, marginTop: 10}}>{side.subtitle}</div> : null}
            </div>
          </div>
        );
      })}
      <div style={{position: 'absolute', left: half - 70, top: height * 0.13, width: 140, height: 140, borderRadius: 70, background: look?.palette.bg ?? '#0b0b0f', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 60, fontWeight: 900, transform: `scale(${vs})`, boxShadow: '0 0 0 8px rgba(255,255,255,.15)'}}>VS</div>
      {props.title ? <div style={{position: 'absolute', top: height * 0.04, left: 0, right: 0, textAlign: 'center', fontSize: 40, fontWeight: 800, opacity: fadeIn(frame, 0, 10), textShadow: '0 2px 12px rgba(0,0,0,.5)'}}>{props.title}</div> : null}
      <div style={{position: 'absolute', top: height * 0.32, left: '5%', right: '5%'}}>
        {props.stats.map((st, i) => {
          const at = statsStart + i * 0.7 * fps;
          const t = spring({frame: frame - at, fps, config: {damping: 18, stiffness: 120}});
          const leftWins = st.lowerIsBetter ? st.left < st.right : st.left > st.right;
          const tie = st.left === st.right;
          const max = Math.max(Math.abs(st.left), Math.abs(st.right)) || 1;
          // Animate the number but keep the target's precision (23 stays an integer, 4.5 keeps one decimal).
          const decimals = (target: number) => (Number.isInteger(target) ? 0 : 1);
          const fmt = (v: number, target: number) => `${v.toLocaleString('en-US', {minimumFractionDigits: decimals(target), maximumFractionDigits: decimals(target)})}${st.suffix}`;
          return (
            <div key={i} style={{marginBottom: height * 0.035, opacity: t}}>
              <div style={{textAlign: 'center', fontSize: 34, fontWeight: 800, letterSpacing: '0.12em', textTransform: 'uppercase', opacity: 0.95, marginBottom: 12}}>{st.label}</div>
              <div style={{display: 'flex', alignItems: 'center', gap: 12}}>
                <div style={{flex: 1, display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 12}}>
                  <span style={{fontSize: 60, fontWeight: 900, fontVariantNumeric: 'tabular-nums'}}>{fmt(st.left * t, st.left)}{!tie && leftWins ? ' ●' : ''}</span>
                  <div style={{height: 30, width: `${(Math.abs(st.left) / max) * 45 * t}%`, background: '#fff', opacity: !tie && leftWins ? 1 : 0.45, borderRadius: 15}} />
                </div>
                <div style={{flex: 1, display: 'flex', alignItems: 'center', gap: 12}}>
                  <div style={{height: 30, width: `${(Math.abs(st.right) / max) * 45 * t}%`, background: '#fff', opacity: !tie && !leftWins ? 1 : 0.45, borderRadius: 15}} />
                  <span style={{fontSize: 60, fontWeight: 900, fontVariantNumeric: 'tabular-nums'}}>{!tie && !leftWins ? '● ' : ''}{fmt(st.right * t, st.right)}</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
      {props.verdict ? (
        <div style={{position: 'absolute', left: '7%', right: '7%', bottom: height * 0.2, textAlign: 'center', fontSize: 52, fontWeight: 900, lineHeight: 1.15, opacity: fadeIn(frame, verdictAt, 10), textShadow: '0 4px 20px rgba(0,0,0,.5)'}}>{props.verdict}</div>
      ) : null}
      {props.showCaptions
        ? timeline.map(t => (
            <Sequence key={t.index} from={t.from} durationInFrames={t.durationInFrames}>
              <AbsoluteFill style={{justifyContent: 'flex-end', padding: '0 7% 6%'}}>
                <Captions scene={t.scene} style={{fontSize: 46}} highlight={media.accent ?? '#FFD60A'} />
              </AbsoluteFill>
            </Sequence>
          ))
        : null}
      <NarrationTrack media={media} />
      <AdWeave media={media} />
    </AbsoluteFill>
  );
};

export default defineEntry({id: 'comparison-split', schema: Props, component: ComparisonSplit});
