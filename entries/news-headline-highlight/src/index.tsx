import React from 'react';
import {AbsoluteFill, Easing, interpolate, spring, useCurrentFrame, useVideoConfig} from 'remotion';
import {AdWeave, NarrationTrack, defineEntry, type EntryProps, useLook} from '@viralaunch/kit';
import {Props} from './schema';

const SERIF = '"Times New Roman", "Iowan Old Style", Georgia, serif';
const SANS = '"Inter", "Helvetica Neue", Arial, sans-serif';

/** Splits text into plain and highlighted runs; `progress[i]` (0..1) sweeps highlight i. */
const Marked: React.FC<{text: string; highlights: string[]; progress: number[]; color: string}> = ({text, highlights, progress, color}) => {
  const runs: Array<{t: string; h: number}> = [];
  let rest = text;
  while (rest.length) {
    let best = -1, at = rest.length;
    highlights.forEach((h, i) => {
      const k = rest.indexOf(h);
      if (k >= 0 && k < at) {
        at = k;
        best = i;
      }
    });
    if (best < 0) {
      runs.push({t: rest, h: -1});
      break;
    }
    if (at > 0) runs.push({t: rest.slice(0, at), h: -1});
    runs.push({t: highlights[best], h: best});
    rest = rest.slice(at + highlights[best].length);
  }
  return (
    <>
      {runs.map((r, i) =>
        r.h < 0 ? <span key={i}>{r.t}</span> : (
          <span key={i} style={{backgroundImage: `linear-gradient(${color}, ${color})`, backgroundRepeat: 'no-repeat', backgroundSize: `${progress[r.h] * 100}% 0.62em`, backgroundPosition: '0 88%', padding: '0 2px'}}>{r.t}</span>
        ),
      )}
    </>
  );
};

const NewsHighlight: React.FC<EntryProps<Props>> = ({media, props}) => {
  const frame = useCurrentFrame();
  const {fps, width, height, durationInFrames} = useVideoConfig();
  const look = useLook();
  const marker = look?.palette.accent ?? media.accent ?? props.marker;
  const enter = spring({frame, fps, config: {damping: 18, stiffness: 100}});
  const whyAt = props.whyItMatters ? Math.round(durationInFrames * 0.72) : durationInFrames;
  const hlStart = Math.round(1.2 * fps);
  const hlSpan = Math.max(fps, whyAt - hlStart - fps * 0.4);
  const progress = props.highlights.map((_, i) => interpolate(frame, [hlStart + (i * hlSpan) / Math.max(1, props.highlights.length), hlStart + (i * hlSpan) / Math.max(1, props.highlights.length) + 14], [0, 1], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: Easing.out(Easing.quad)}));
  const push = interpolate(frame, [0, whyAt], [1, 1.12], {extrapolateRight: 'clamp'});
  const whyT = spring({frame: frame - whyAt, fps, config: {damping: 16, stiffness: 140}});
  const cardW = Math.min(width * 0.9, 1500);
  return (
    <AbsoluteFill style={{background: look ? `radial-gradient(ellipse at 50% 40%, ${look.palette.bg2} 0%, ${look.palette.bg} 80%)` : '#d8d2c4', justifyContent: 'center', alignItems: 'center'}}>
      <div style={{width: cardW, background: '#fbf8f1', boxShadow: '0 40px 120px rgba(0,0,0,.35)', padding: '56px 52px', transform: `translateY(${(1 - enter) * height * 0.6}px) rotate(${(1 - enter) * -4 - 0.6}deg) scale(${push})`, filter: whyT > 0 ? `blur(${whyT * 3}px)` : 'none', opacity: 1 - whyT * 0.5}}>
        <div style={{fontFamily: SERIF, fontSize: 64, fontWeight: 700, textAlign: 'center', letterSpacing: '0.04em', borderBottom: '3px double #222', paddingBottom: 14}}>{props.masthead}</div>
        {props.dateline ? <div style={{fontFamily: SANS, fontSize: 22, letterSpacing: '0.2em', textTransform: 'uppercase', textAlign: 'center', color: '#555', padding: '12px 0', borderBottom: '1px solid #222'}}>{props.dateline}</div> : null}
        <div style={{fontFamily: SERIF, fontSize: height > width ? 76 : 70, fontWeight: 800, lineHeight: 1.08, marginTop: 36, color: '#111'}}>
          <Marked text={props.headline} highlights={props.highlights} progress={progress} color={marker} />
        </div>
        {props.body ? (
          <div style={{fontFamily: SERIF, fontSize: 34, lineHeight: 1.45, color: '#2b2b2b', marginTop: 30, columnCount: height > width ? 1 : 2, columnGap: 40}}>
            <Marked text={props.body} highlights={props.highlights} progress={progress} color={marker} />
          </div>
        ) : null}
        {props.source ? <div style={{fontFamily: SANS, fontSize: 22, color: '#777', marginTop: 26}}>{props.source}</div> : null}
      </div>
      {props.whyItMatters ? (
        <div style={{position: 'absolute', left: '8%', right: '8%', bottom: height * 0.18, background: look?.palette.surface ?? '#111', color: look?.palette.text ?? '#fff', borderRadius: 18, padding: '34px 40px', fontFamily: SANS, opacity: whyT, transform: `translateY(${(1 - whyT) * 80}px)`}}>
          <div style={{fontSize: 24, fontWeight: 800, letterSpacing: '0.2em', color: marker, marginBottom: 12}}>WHY IT MATTERS</div>
          <div style={{fontSize: 46, fontWeight: 800, lineHeight: 1.2}}>{props.whyItMatters}</div>
        </div>
      ) : null}
      <NarrationTrack media={media} />
      <AdWeave media={media} theme={{background: '#111', font: SANS}} />
    </AbsoluteFill>
  );
};

export default defineEntry({id: 'news-headline-highlight', schema: Props, component: NewsHighlight});
