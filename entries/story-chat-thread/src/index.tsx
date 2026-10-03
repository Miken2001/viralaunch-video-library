import React from 'react';
import {AbsoluteFill, spring, useCurrentFrame, useVideoConfig} from 'remotion';
import {AdWeave, NarrationTrack, defineEntry, type EntryProps, useLook, mix, type ActiveLook} from '@viralaunch/kit';
import {Props} from './schema';

/** The chat in a sequence's shared look: my bubbles take the accent. */
const fromLook = (l: ActiveLook) => ({bg: l.palette.bg, header: l.palette.surface, me: l.palette.accent, them: mix(l.palette.surface, l.palette.bg2, 0.6), text: l.palette.text, muted: l.palette.muted});

const THEMES = {
  dark: {bg: '#000000', header: '#1c1c1e', me: '#0a84ff', them: '#2c2c2e', text: '#ffffff', muted: '#8e8e93'},
  light: {bg: '#ffffff', header: '#f2f2f7', me: '#007aff', them: '#e9e9eb', text: '#000000', muted: '#8e8e93'},
} as const;
const FONT = '-apple-system, "SF Pro Text", "Inter", "Helvetica Neue", Arial, sans-serif';

const Typing: React.FC<{color: string; dot: string}> = ({color, dot}) => {
  const frame = useCurrentFrame();
  return (
    <div style={{alignSelf: 'flex-start', background: color, borderRadius: 30, padding: '22px 26px', display: 'flex', gap: 10}}>
      {[0, 1, 2].map(i => <div key={i} style={{width: 16, height: 16, borderRadius: 8, background: dot, opacity: 0.4 + 0.6 * Math.max(0, Math.sin(frame / 4 - i))}} />)}
    </div>
  );
};

const ChatThread: React.FC<EntryProps<Props>> = ({media, props}) => {
  const frame = useCurrentFrame();
  const {fps, height, durationInFrames} = useVideoConfig();
  const look = useLook();
  const th = look ? fromLook(look) : {...THEMES[props.theme], me: media.accent ?? THEMES[props.theme].me};
  const start = Math.round(0.6 * fps);
  // Longer messages get more time: allocate the body of the video by text length.
  const weights = props.messages.map(m => 1 + m.text.length / 40);
  const total = weights.reduce((a, b) => a + b, 0);
  const span = durationInFrames - start - fps;
  const at: number[] = [];
  weights.reduce((acc, w) => {
    at.push(start + (acc / total) * span);
    return acc + w;
  }, 0);
  const visible = at.filter(t => frame >= t).length;
  const next = props.messages[visible];
  const typing = next && next.from === 'them' && frame >= (at[visible] ?? 0) - 0.7 * fps;
  // Auto-scroll: keep the newest bubble in view.
  const scroll = Math.max(0, visible - 6) * 150;
  return (
    <AbsoluteFill style={{background: th.bg, fontFamily: look?.font.body ?? FONT, color: th.text}}>
      <div style={{position: 'absolute', top: 0, left: 0, right: 0, height: height * 0.13, background: th.header, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-end', paddingBottom: 22, zIndex: 2}}>
        <div style={{width: 96, height: 96, borderRadius: 48, background: 'linear-gradient(135deg,#8e8e93,#636366)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 44, fontWeight: 700, color: '#fff'}}>{props.contact.slice(0, 1).toUpperCase()}</div>
        <div style={{fontSize: 34, fontWeight: 600, marginTop: 8}}>{props.contact}</div>
        <div style={{fontSize: 24, color: th.muted}}>{props.status}</div>
      </div>
      {props.label ? <div style={{position: 'absolute', top: height * 0.135, left: 0, right: 0, textAlign: 'center', fontSize: 24, color: th.muted, zIndex: 2}}>{props.label}</div> : null}
      <div style={{position: 'absolute', top: height * 0.17, left: 36, right: 36, bottom: height * 0.12, overflow: 'hidden'}}>
        <div style={{display: 'flex', flexDirection: 'column', gap: 18, transform: `translateY(${-scroll}px)`}}>
          {props.messages.slice(0, visible).map((m, i) => {
            const pop = spring({frame: frame - at[i], fps, config: {damping: 13, stiffness: 220, mass: 0.6}});
            const mine = m.from === 'me';
            return (
              <div key={i} style={{alignSelf: mine ? 'flex-end' : 'flex-start', maxWidth: '78%', transform: `scale(${0.6 + 0.4 * pop})`, transformOrigin: mine ? 'bottom right' : 'bottom left', opacity: pop}}>
                <div style={{background: mine ? th.me : th.them, color: mine ? '#fff' : th.text, borderRadius: 34, padding: '20px 28px', fontSize: 40, lineHeight: 1.3}}>{m.text}</div>
                {m.time ? <div style={{fontSize: 22, color: th.muted, textAlign: mine ? 'right' : 'left', marginTop: 6, padding: '0 10px'}}>{m.time}</div> : null}
              </div>
            );
          })}
          {typing ? <Typing color={th.them} dot={th.muted} /> : null}
        </div>
      </div>
      <div style={{position: 'absolute', bottom: 0, left: 0, right: 0, height: height * 0.09, background: th.header, display: 'flex', alignItems: 'center', padding: '0 36px'}}>
        <div style={{flex: 1, height: 70, borderRadius: 35, border: `2px solid ${th.them}`, color: th.muted, fontSize: 30, display: 'flex', alignItems: 'center', padding: '0 26px'}}>iMessage</div>
      </div>
      <NarrationTrack media={media} />
      <AdWeave media={media} theme={{background: th.bg, text: th.text, font: FONT}} />
    </AbsoluteFill>
  );
};

export default defineEntry({id: 'story-chat-thread', schema: Props, component: ChatThread});
