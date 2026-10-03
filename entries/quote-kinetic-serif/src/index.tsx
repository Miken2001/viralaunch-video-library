import React from 'react';
import {AbsoluteFill, interpolate, useCurrentFrame, useVideoConfig} from 'remotion';
import {AdWeave, NarrationTrack, defineEntry, fadeIn, useContentFrames, type EntryProps, useLook, type ActiveLook} from '@viralaunch/kit';
import {Props} from './schema';

/** The quote card in a sequence's shared look. */
const fromLook = (l: ActiveLook) => ({bg: l.palette.bg, text: l.palette.text, accent: l.palette.accent, muted: l.palette.muted});

const PALETTES = {
  ivory: {bg: '#f4efe6', text: '#1d1a16', accent: '#b5462f', muted: '#7d7266'},
  night: {bg: '#0d0d12', text: '#f1ece2', accent: '#e9c46a', muted: '#8d8a83'},
  oxblood: {bg: '#3b0d11', text: '#f8e9e1', accent: '#ffb4a2', muted: '#c9a39a'},
  sage: {bg: '#dfe6da', text: '#22301f', accent: '#5b7f3a', muted: '#6c7a64'},
} as const;
const OWN_SERIF = '"Playfair Display", "Iowan Old Style", Georgia, "Times New Roman", serif';

const QuoteKinetic: React.FC<EntryProps<Props>> = ({media, props}) => {
  const frame = useCurrentFrame();
  const {fps, width, height} = useVideoConfig();
  const content = useContentFrames(media);
  const look = useLook();
  const p = look ? fromLook(look) : {...PALETTES[props.palette], accent: media.accent ?? PALETTES[props.palette].accent};
  const SERIF = look?.font.display ?? OWN_SERIF;
  const words = props.quote.split(/\s+/).filter(Boolean).map(w => ({text: w.replace(/\*/g, ''), key: /^\*.*\*[.,;:!?"]*$/.test(w) || /^\*/.test(w)}));
  // Reveal all words over the first ~65% of the video; then hold for reading + attribution.
  const revealEnd = Math.max(fps, content * 0.65);
  const perWord = (revealEnd - 10) / words.length;
  const size = Math.min(width * 0.11, Math.max(54, (width * 1.9) / Math.sqrt(props.quote.length * 9)));
  const signAt = revealEnd;
  const drift = interpolate(frame, [0, content], [1.02, 1], {extrapolateRight: 'clamp'});
  return (
    <AbsoluteFill style={{background: p.bg, justifyContent: 'center', padding: height > width ? '0 9%' : '0 14%'}}>
      <div style={{position: 'absolute', top: height * 0.12, left: width * 0.07, fontFamily: SERIF, fontSize: width * 0.38, lineHeight: 1, color: p.accent, opacity: 0.18 * fadeIn(frame, 0, 12)}}>“</div>
      <div style={{fontFamily: SERIF, fontSize: size, lineHeight: 1.18, color: p.text, transform: `scale(${drift})`, transformOrigin: 'left center'}}>
        {words.map((w, i) => {
          const t = interpolate(frame, [10 + i * perWord, 10 + i * perWord + 8], [0, 1], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});
          return (
            <span key={i} style={{display: 'inline-block', marginRight: '0.26em', opacity: t, transform: `translateY(${(1 - t) * 0.35}em)`, color: w.key ? p.accent : p.text, fontStyle: w.key ? 'italic' : 'normal'}}>
              {w.text}
            </span>
          );
        })}
      </div>
      {props.author ? (
        <div style={{marginTop: 60, opacity: fadeIn(frame, signAt, 12), transform: `translateX(${interpolate(frame, [signAt, signAt + 12], [-30, 0], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'})}px)`}}>
          <div style={{width: 90, height: 3, background: p.accent, marginBottom: 22}} />
          <div style={{fontFamily: SERIF, fontSize: 48, color: p.text}}>{props.author}</div>
          {props.context ? <div style={{fontFamily: SERIF, fontStyle: 'italic', fontSize: 32, color: p.muted, marginTop: 8}}>{props.context}</div> : null}
        </div>
      ) : null}
      <NarrationTrack media={media} />
      <AdWeave media={media} theme={{background: p.bg, text: p.text, font: SERIF}} />
    </AbsoluteFill>
  );
};

export default defineEntry({id: 'quote-kinetic-serif', schema: Props, component: QuoteKinetic});
