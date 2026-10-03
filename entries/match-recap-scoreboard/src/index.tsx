import React from 'react';
import {AbsoluteFill, Sequence, interpolate, spring, useCurrentFrame, useVideoConfig} from 'remotion';
import {AdWeave, Captions, NarrationTrack, defineEntry, useSceneTimeline, type EntryProps} from '@viralaunch/kit';
import {Props} from './schema';

const FONT = '"Barlow Condensed", "Oswald", "Arial Narrow", "Helvetica Neue", sans-serif';
const ICON: Record<string, string> = {score: '●', card: '▮', sub: '⇄', chance: '◎', note: '•'};

const MatchRecap: React.FC<EntryProps<Props>> = ({media, props}) => {
  const frame = useCurrentFrame();
  const {fps, height, durationInFrames} = useVideoConfig();
  const timeline = useSceneTimeline(media);
  const hasStats = props.stats.length > 0;
  const statsAt = hasStats ? Math.round(durationInFrames * 0.68) : durationInFrames;
  const eventsStart = Math.round(1.2 * fps);
  const per = Math.max(6, (statsAt - eventsStart - fps * 0.5) / props.events.length);
  const shown = Math.max(0, Math.min(props.events.length, Math.floor((frame - eventsStart) / per) + 1));
  const score = props.events.slice(0, shown).reduce((s, e) => (e.kind === 'score' ? {...s, [e.side]: s[e.side] + e.points} : s), {home: 0, away: 0});
  const bug = spring({frame, fps, config: {damping: 14, stiffness: 180}});
  const lastScore = [...props.events.slice(0, shown)].reverse().find(e => e.kind === 'score');
  const flashAt = lastScore ? eventsStart + (props.events.indexOf(lastScore)) * per : -100;
  const flash = interpolate(frame, [flashAt, flashAt + 4, flashAt + 18], [0, 1, 0], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});
  const statsT = spring({frame: frame - statsAt, fps, config: {damping: 18, stiffness: 110}});
  const team = (side: 'home' | 'away') => props[side];
  return (
    <AbsoluteFill style={{background: 'radial-gradient(ellipse at 50% 0%, #1b3a24 0%, #08120b 70%)', fontFamily: FONT, color: '#fff'}}>
      <svg width="100%" height="100%" style={{position: 'absolute', opacity: 0.08}}>
        {Array.from({length: 10}, (_, i) => <rect key={i} x="0" y={`${i * 10}%`} width="100%" height="5%" fill="#fff" />)}
      </svg>
      <div style={{position: 'absolute', top: height * 0.06, left: '6%', right: '6%', transform: `translateY(${(1 - bug) * -200}px)`}}>
        <div style={{textAlign: 'center', fontSize: 30, letterSpacing: '0.25em', textTransform: 'uppercase', opacity: 0.8, marginBottom: 14}}>{[props.competition, props.stage].filter(Boolean).join(' · ')}</div>
        <div style={{display: 'flex', alignItems: 'stretch', borderRadius: 16, overflow: 'hidden', boxShadow: '0 20px 60px rgba(0,0,0,.5)'}}>
          {(['home', 'away'] as const).map((side, i) => (
            <React.Fragment key={side}>
              {i === 1 ? (
                <div style={{background: '#0b0b0b', padding: '0 28px', display: 'flex', alignItems: 'center', fontSize: 110, fontWeight: 800, fontVariantNumeric: 'tabular-nums', boxShadow: `inset 0 0 0 ${flash * 8}px #ffd60a`}}>
                  {score.home}<span style={{opacity: 0.4, margin: '0 14px'}}>–</span>{score.away}
                </div>
              ) : null}
              <div style={{flex: 1, background: team(side).color, padding: '22px 20px', textAlign: side === 'home' ? 'right' : 'left'}}>
                <div style={{fontSize: 66, fontWeight: 800, lineHeight: 1}}>{team(side).short}</div>
                <div style={{fontSize: 26, opacity: 0.85}}>{team(side).name}</div>
              </div>
            </React.Fragment>
          ))}
        </div>
      </div>
      <div style={{position: 'absolute', top: height * 0.3, left: '6%', right: '6%', opacity: 1 - statsT}}>
        {props.events.slice(0, shown).map((e, i) => {
          const t = spring({frame: frame - (eventsStart + i * per), fps, config: {damping: 16, stiffness: 160}});
          const isScore = e.kind === 'score';
          return (
            <div key={i} style={{display: 'flex', alignItems: 'center', gap: 18, flexDirection: e.side === 'home' ? 'row' : 'row-reverse', marginBottom: 22, opacity: t, transform: `translateX(${(1 - t) * (e.side === 'home' ? -80 : 80)}px)`}}>
              <div style={{minWidth: 120, textAlign: 'center', fontSize: 46, fontWeight: 700, background: 'rgba(255,255,255,.12)', borderRadius: 10, padding: '6px 10px'}}>{e.minute}</div>
              <div style={{fontSize: 48, color: e.kind === 'card' ? '#ffd60a' : '#fff', opacity: 0.9}}>{ICON[e.kind]}</div>
              <div style={{fontSize: isScore ? 64 : 48, fontWeight: isScore ? 800 : 600, textTransform: isScore ? 'uppercase' : 'none', textAlign: e.side === 'home' ? 'left' : 'right'}}>{e.text}</div>
            </div>
          );
        })}
      </div>
      {hasStats ? (
        <div style={{position: 'absolute', top: height * 0.3, left: '6%', right: '6%', opacity: statsT, transform: `translateY(${(1 - statsT) * 60}px)`}}>
          {props.stats.map((st, i) => {
            const total = Math.abs(st.home) + Math.abs(st.away) || 1;
            return (
              <div key={i} style={{marginBottom: 34}}>
                <div style={{display: 'flex', justifyContent: 'space-between', fontSize: 44, fontWeight: 800}}>
                  <span>{st.home}{st.suffix}</span><span style={{fontSize: 30, letterSpacing: '0.15em', textTransform: 'uppercase', opacity: 0.8, alignSelf: 'center'}}>{st.label}</span><span>{st.away}{st.suffix}</span>
                </div>
                <div style={{display: 'flex', height: 16, borderRadius: 8, overflow: 'hidden', marginTop: 8}}>
                  <div style={{width: `${(Math.abs(st.home) / total) * 100 * statsT}%`, background: props.home.color}} />
                  <div style={{flex: 1, background: 'rgba(255,255,255,.12)'}} />
                  <div style={{width: `${(Math.abs(st.away) / total) * 100 * statsT}%`, background: props.away.color}} />
                </div>
              </div>
            );
          })}
        </div>
      ) : null}
      {props.showCaptions
        ? timeline.map(t => (
            <Sequence key={t.index} from={t.from} durationInFrames={t.durationInFrames}>
              <AbsoluteFill style={{justifyContent: 'flex-end', padding: '0 7% 7%'}}>
                <Captions scene={t.scene} style={{fontFamily: FONT, fontSize: 56}} highlight={media.accent ?? '#ffd60a'} />
              </AbsoluteFill>
            </Sequence>
          ))
        : null}
      <NarrationTrack media={media} />
      <AdWeave media={media} theme={{background: '#08120b', font: FONT}} />
    </AbsoluteFill>
  );
};

export default defineEntry({id: 'match-recap-scoreboard', schema: Props, component: MatchRecap});
