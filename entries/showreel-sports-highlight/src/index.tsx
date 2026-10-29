import React from 'react';
import {AbsoluteFill, Sequence, spring, useCurrentFrame, useVideoConfig} from 'remotion';
import {AdWeave, NarrationTrack, captionSafeBottom, defineEntry, mix, useContentFrames, useLook, useSceneTimeline, type ActiveLook, type EntryProps} from '@viralaunch/kit';
import {CameraImage, Grain, KineticText, LightLeak, LineIcon, Particles, SceneSeries, StyledCaptions, Vignette, alpha, countUp, ease, fonts, progress, rand, tween, type Widen} from '@viralaunch/kit/fx';
import {Props, type Shot} from './schema';

const PALETTES = {
  volt: {bg: '#07080a', bg2: '#1b2109', screen: '#0c0d10', card: '#17191d', text: '#f4f6ef', muted: '#878c95', accent: '#d4ff3a', line: '#2a2d33', bezel: '#1f2125', hue: 40},
  court: {bg: '#0b0706', bg2: '#2c1406', screen: '#100c0a', card: '#1e1814', text: '#fff4ec', muted: '#a8968a', accent: '#ff7a1a', line: '#33281f', bezel: '#241d18', hue: 0},
  ice: {bg: '#050911', bg2: '#0b2236', screen: '#090e16', card: '#141c28', text: '#eef6ff', muted: '#8597ad', accent: '#46e0ff', line: '#223044', bezel: '#1a2230', hue: 170},
  turf: {bg: '#040e09', bg2: '#0b2d18', screen: '#07120c', card: '#11231a', text: '#effff5', muted: '#86a894', accent: '#3dff8c', line: '#1d3a2a', bezel: '#16261d', hue: 90},
} as const;
type Pal = Omit<Widen<(typeof PALETTES)[keyof typeof PALETTES]>, 'hue'> & {hue: number; onAccent: string; light: boolean};

/** Readable text colour on top of the accent. */
const onAccent = (hex: string) => {
  const n = parseInt(hex.slice(1), 16);
  const lum = 0.299 * ((n >> 16) & 255) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255);
  return lum > 150 ? '#0b0b0b' : '#ffffff';
};

/** The app in a sequence's shared look: backdrop, phone UI and accent follow the look (light looks get a light-mode app). */
const fromLook = (l: ActiveLook): Pal => {
  const light = l.tone === 'light';
  const p = l.palette;
  return {
    bg: p.bg,
    bg2: p.bg2,
    screen: light ? p.surface : mix(p.bg, '#000000', 0.3),
    card: light ? mix(p.bg, p.surface, 0.45) : mix(p.surface, p.bg2, 0.5),
    text: p.text,
    muted: p.muted,
    accent: p.accent,
    line: mix(light ? p.surface : p.surface, p.line, 0.14),
    bezel: light ? mix(p.line, p.bg, 0.12) : mix(p.bg2, '#ffffff', 0.08),
    hue: 30,
    onAccent: onAccent(p.accent),
    light,
  };
};

const SCREEN_W = 390;
const SCREEN_H = 844;
const CONTENT_TOP = 104;
const CONTENT_BOTTOM = 96;
const TABS: {screen: Shot['screen']; icon: string}[] = [
  {screen: 'scores', icon: 'ball'},
  {screen: 'stats', icon: 'chart'},
  {screen: 'vote', icon: 'star'},
  {screen: 'feed', icon: 'chat'},
  {screen: 'highlight', icon: 'trophy'},
];

/** Phone poses the camera moves between, one per shot (degrees, scale, px offsets in 1080 units). */
const POSES = [
  {rx: 6, ry: -14, rz: -2, s: 1, x: 0, y: 0},
  {rx: 4, ry: 12, rz: 1.5, s: 1.04, x: 10, y: -6},
  {rx: 10, ry: -6, rz: 0.5, s: 1.08, x: -8, y: -10},
  {rx: 3, ry: 16, rz: 2, s: 1, x: 6, y: 4},
];
const INTRO_POSE = {rx: 14, ry: -18, rz: -4, s: 0.94, x: 0, y: 20};
type Pose = typeof INTRO_POSE;
const lerpPose = (a: Pose, b: Pose, t: number): Pose => ({rx: a.rx + (b.rx - a.rx) * t, ry: a.ry + (b.ry - a.ry) * t, rz: a.rz + (b.rz - a.rz) * t, s: a.s + (b.s - a.s) * t, x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t});

const initials = (s: string) => s.split(/\s+/).filter(Boolean).slice(0, 2).map(w => w[0]).join('').toUpperCase();
const teams = (label: string) => label.split(/\s+(?:vs\.?|v)\s+|\s+[-–—]\s+/i).filter(Boolean);
const pad2 = (n: number) => String(n).padStart(2, '0');

/** Counts a plain number up ("88,966" → 0…88,966); scores and words are shown as written. */
function countValue(value: string, frame: number, start: number, duration = 34) {
  const m = value.match(/^([^\d]*)(\d[\d,]*(?:\.\d+)?)([^\d]*)$/);
  if (!m) return value;
  const n = Number(m[2].replace(/,/g, ''));
  const decimals = m[2].includes('.') ? m[2].split('.')[1].length : 0;
  const shown = countUp(frame, n, start, duration, decimals);
  return m[1] + (m[2].includes(',') || n >= 10000 ? shown : shown.replace(/,/g, '')) + m[3];
}

type ScreenArgs = {shot: Shot; pal: Pal; t0: number; len: number; image: string; isStatic: boolean; seed: number};

/** Shared reveal timing: rows land in the first ~45% of the shot, then the finger taps the first row. */
function useReveal(t0: number, len: number, n: number) {
  const span = Math.max(8, Math.min(len * 0.45, n * 9 + 10));
  const at = (i: number) => t0 + 6 + (i * span) / Math.max(1, n);
  const tap = t0 + Math.min(len * 0.6, span + 16);
  return {at, tap};
}

const rowIn = (frame: number, at: number): React.CSSProperties => {
  const p = progress(frame, at, 16, ease.snappy);
  return {opacity: Math.min(1, p * 1.6), transform: `translateY(${(1 - p) * 34}px) scale(${0.96 + 0.04 * p})`};
};

/** Touch ripple: a finger tap on the focused row. */
const Tap: React.FC<{at: number; pal: Pal; style?: React.CSSProperties}> = ({at, pal, style}) => {
  const frame = useCurrentFrame();
  const p = progress(frame, at, 18, ease.expo);
  const press = progress(frame, at - 6, 6) * (1 - progress(frame, at + 4, 10));
  if (frame < at - 6 || p >= 1) return null;
  const c = pal.light ? pal.text : '#ffffff';
  return (
    <div style={{position: 'absolute', width: 48, height: 48, marginLeft: -24, marginTop: -24, pointerEvents: 'none', ...style}}>
      <div style={{position: 'absolute', inset: 0, borderRadius: '50%', background: alpha(c, 0.35 * press), transform: `scale(${0.7 + 0.3 * press})`}} />
      <div style={{position: 'absolute', inset: 0, borderRadius: '50%', border: `2px solid ${alpha(c, 0.7 * (1 - p))}`, transform: `scale(${0.6 + p * 1.6})`}} />
    </div>
  );
};

const Avatar: React.FC<{text: string; pal: Pal; size: number; seed: string; hot?: boolean}> = ({text, pal, size, seed, hot}) => (
  <div style={{width: size, height: size, borderRadius: '50%', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: fonts.condensed, fontWeight: 800, fontSize: size * 0.42, letterSpacing: '0.02em', color: hot ? pal.onAccent : pal.text, background: hot ? pal.accent : mix(pal.card, rand(seed) > 0.5 ? pal.accent : pal.muted, 0.28 + rand(seed + 'b') * 0.15), boxShadow: `inset 0 0 0 2px ${alpha(pal.text, 0.08)}`}}>
    {initials(text)}
  </div>
);

const Heading: React.FC<{text: string; pal: Pal; t0: number; live?: boolean}> = ({text, pal, t0, live}) => {
  const frame = useCurrentFrame();
  if (!text) return <div style={{height: 14}} />;
  const pulse = 0.5 + 0.5 * Math.sin(frame / 5);
  return (
    <div style={{display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: 62, padding: '0 4px'}}>
      <KineticText text={text} start={t0} stagger={3} style="rise" textStyle={{fontFamily: fonts.sans, fontWeight: 800, fontSize: 30, color: pal.text, letterSpacing: '-0.02em'}} />
      {live ? (
        <div style={{display: 'flex', alignItems: 'center', gap: 7, opacity: progress(frame, t0 + 6, 10)}}>
          <div style={{width: 9, height: 9, borderRadius: '50%', background: pal.accent, boxShadow: `0 0 ${6 + pulse * 10}px ${pal.accent}`}} />
          <div style={{width: 34, height: 4, borderRadius: 2, background: alpha(pal.accent, 0.35)}} />
        </div>
      ) : null}
    </div>
  );
};

const card = (pal: Pal, hot: number): React.CSSProperties => ({
  position: 'relative',
  background: hot ? mix(pal.card, pal.accent, 0.1 * hot) : pal.card,
  borderRadius: 20,
  boxShadow: `inset 0 0 0 ${1 + hot * 1.5}px ${hot ? alpha(pal.accent, 0.35 + 0.55 * hot) : alpha(pal.text, 0.06)}`,
});

const ScoresScreen: React.FC<ScreenArgs> = ({shot, pal, t0, len}) => {
  const frame = useCurrentFrame();
  const {at, tap} = useReveal(t0, len, shot.rows.length);
  const hot = progress(frame, tap, 10);
  return (
    <div style={{padding: '0 18px'}}>
      <Heading text={shot.heading} pal={pal} t0={t0} live />
      <div style={{display: 'flex', flexDirection: 'column', gap: 12}}>
        {shot.rows.map((r, i) => {
          const sides = teams(r.label);
          const h = i === 0 ? hot : 0;
          return (
            <div key={i} style={{...card(pal, h), ...rowIn(frame, at(i)), height: 96, padding: '0 16px', display: 'flex', alignItems: 'center', gap: 12}}>
              <div style={{position: 'relative', width: 50, height: 58}}>
                <div style={{position: 'absolute', left: 0, top: 0}}><Avatar text={sides[0] ?? r.label} pal={pal} size={36} seed={`a${i}`} /></div>
                {sides[1] ? <div style={{position: 'absolute', left: 14, top: 22}}><Avatar text={sides[1]} pal={pal} size={36} seed={`b${i}`} /></div> : null}
              </div>
              <div style={{flex: 1, minWidth: 0, fontFamily: fonts.sans, color: pal.text}}>
                {sides.length > 1 ? (
                  sides.slice(0, 2).map((s, k) => <div key={k} style={{fontSize: 16, fontWeight: 700, lineHeight: 1.3, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis'}}>{s}</div>)
                ) : (
                  <div style={{fontSize: 16, fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis'}}>{r.label}</div>
                )}
                {r.sub ? <div style={{fontSize: 12, fontWeight: 600, color: h ? pal.accent : pal.muted, marginTop: 3, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis'}}>{r.sub}</div> : null}
                {r.bar !== undefined ? (
                  <div style={{marginTop: 6, height: 4, borderRadius: 2, background: alpha(pal.text, 0.08), width: '90%'}}>
                    <div style={{width: `${r.bar * progress(frame, at(i) + 8, 30, ease.cinematic)}%`, height: '100%', borderRadius: 2, background: pal.accent}} />
                  </div>
                ) : null}
              </div>
              <div style={{fontFamily: fonts.condensed, fontWeight: 800, fontSize: 36, color: h ? pal.accent : pal.text, letterSpacing: '0.01em', whiteSpace: 'nowrap'}}>{r.value}</div>
              {i === 0 ? <Tap at={tap} pal={pal} style={{left: '62%', top: '50%'}} /> : null}
            </div>
          );
        })}
      </div>
    </div>
  );
};

const StatsScreen: React.FC<ScreenArgs> = ({shot, pal, t0, len}) => {
  const frame = useCurrentFrame();
  const {at, tap} = useReveal(t0, len, shot.rows.length);
  const hot = progress(frame, tap, 10);
  return (
    <div style={{padding: '0 18px'}}>
      <Heading text={shot.heading} pal={pal} t0={t0} />
      <div style={{display: 'flex', flexDirection: 'column', gap: 10}}>
        {shot.rows.map((r, i) => {
          const h = i === 0 ? hot : 0;
          const fill = progress(frame, at(i) + 6, 34, ease.expo);
          return (
            <div key={i} style={{...card(pal, h), ...rowIn(frame, at(i)), padding: '14px 16px 16px', fontFamily: fonts.sans}}>
              <div style={{display: 'flex', alignItems: 'center', gap: 12}}>
                <div style={{fontFamily: fonts.mono, fontSize: 12, color: pal.muted, width: 20}}>{pad2(i + 1)}</div>
                <Avatar text={r.label} pal={pal} size={38} seed={`s${i}${r.label}`} hot={h > 0.5} />
                <div style={{flex: 1, minWidth: 0}}>
                  <div style={{fontSize: 16, fontWeight: 700, color: pal.text, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis'}}>{r.label}</div>
                  {r.sub ? <div style={{fontSize: 12, fontWeight: 600, color: pal.muted, marginTop: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis'}}>{r.sub}</div> : null}
                </div>
                <div style={{fontFamily: fonts.condensed, fontWeight: 800, fontSize: 34, color: i === 0 ? pal.accent : pal.text}}>{countValue(r.value, frame, at(i) + 6)}</div>
              </div>
              {r.bar !== undefined ? (
                <div style={{marginTop: 10, height: 6, borderRadius: 3, background: alpha(pal.text, 0.08)}}>
                  <div style={{width: `${r.bar * fill}%`, height: '100%', borderRadius: 3, background: i === 0 ? pal.accent : alpha(pal.accent, 0.45), boxShadow: i === 0 ? `0 0 12px ${alpha(pal.accent, 0.6)}` : undefined}} />
                </div>
              ) : null}
              {i === 0 ? <Tap at={tap} pal={pal} style={{left: '45%', top: '45%'}} /> : null}
            </div>
          );
        })}
      </div>
    </div>
  );
};

const VoteScreen: React.FC<ScreenArgs> = ({shot, pal, t0, len}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const n = shot.rows.length;
  const {at, tap} = useReveal(t0, len, n);
  const pick = spring({frame: frame - tap, fps, config: {damping: 11, stiffness: 180}});
  const cols = n <= 2 ? 1 : 2;
  const tileH = n <= 2 ? 150 : n <= 4 ? 178 : 132;
  const btnIn = progress(frame, tap + 8, 14, ease.overshoot);
  return (
    <div style={{padding: '0 18px', height: '100%', position: 'relative'}}>
      <Heading text={shot.heading} pal={pal} t0={t0} />
      <div style={{display: 'grid', gridTemplateColumns: `repeat(${cols}, 1fr)`, gap: 12}}>
        {shot.rows.map((r, i) => {
          const h = i === 0 ? Math.min(1, pick) : 0;
          return (
            <div key={i} style={{...card(pal, h), ...rowIn(frame, at(i)), height: tileH, display: 'flex', flexDirection: cols === 1 ? 'row' : 'column', alignItems: 'center', justifyContent: 'center', gap: cols === 1 ? 16 : 6, padding: 12, fontFamily: fonts.sans, scale: String(1 + 0.04 * Math.sin(Math.PI * Math.min(1, Math.max(0, pick))))}}>
              <Avatar text={r.label} pal={pal} size={n > 4 ? 44 : 56} seed={`v${i}${r.label}`} hot={h > 0.5} />
              <div style={{textAlign: cols === 1 ? 'left' : 'center', minWidth: 0, flex: cols === 1 ? 1 : undefined, width: cols === 1 ? undefined : '100%'}}>
                <div style={{fontSize: 15, fontWeight: 800, color: h > 0.5 ? pal.accent : pal.text, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis'}}>{r.label}</div>
                {r.sub ? <div style={{fontSize: 12, fontWeight: 600, color: pal.muted, marginTop: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis'}}>{r.sub}</div> : null}
                {r.value ? <div style={{fontFamily: fonts.condensed, fontSize: 22, fontWeight: 800, color: h > 0.5 ? pal.accent : pal.text, marginTop: 4}}>{countValue(r.value, frame, at(i) + 6)}</div> : null}
                {r.bar !== undefined ? (
                  <div style={{marginTop: 6, height: 4, borderRadius: 2, background: alpha(pal.text, 0.1), width: cols === 1 ? '100%' : '80%', marginLeft: cols === 1 ? 0 : 'auto', marginRight: cols === 1 ? 0 : 'auto'}}>
                    <div style={{width: `${r.bar * progress(frame, at(i) + 6, 30, ease.expo)}%`, height: '100%', borderRadius: 2, background: pal.accent}} />
                  </div>
                ) : null}
              </div>
              {i === 0 ? <Tap at={tap} pal={pal} style={{left: '50%', top: '42%'}} /> : null}
              {i === 0 ? (
                <div style={{position: 'absolute', top: 10, right: 10, width: 26, height: 26, borderRadius: '50%', background: pal.accent, display: 'flex', alignItems: 'center', justifyContent: 'center', transform: `scale(${Math.max(0, pick)})`}}>
                  <LineIcon name="check" size={16} color={pal.onAccent} strokeWidth={12} progress={progress(frame, tap + 4, 12)} />
                </div>
              ) : null}
            </div>
          );
        })}
      </div>
      {shot.button ? (
        <div style={{position: 'absolute', left: 18, right: 18, bottom: 6, height: 58, borderRadius: 29, background: pal.accent, color: pal.onAccent, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: fonts.sans, fontWeight: 800, fontSize: 19, transform: `translateY(${(1 - btnIn) * 90}px) scale(${1 + 0.03 * Math.sin(Math.max(0, frame - tap) / 5) * (btnIn >= 1 ? 1 : 0)})`, opacity: Math.min(1, btnIn * 2), boxShadow: `0 10px 30px ${alpha(pal.accent, 0.35)}`}}>
          {shot.button}
        </div>
      ) : null}
    </div>
  );
};

const FeedScreen: React.FC<ScreenArgs> = ({shot, pal, t0, len}) => {
  const frame = useCurrentFrame();
  const n = shot.rows.length;
  const {at, tap} = useReveal(t0, len + n * 8, n);
  // Each message is preceded by a short "typing" bubble.
  return (
    <div style={{padding: '0 18px'}}>
      <Heading text={shot.heading} pal={pal} t0={t0} live />
      {shot.button ? (
        <div style={{...card(pal, 0), height: 50, borderRadius: 25, display: 'flex', alignItems: 'center', padding: '0 6px 0 18px', marginBottom: 12, opacity: progress(frame, t0 + 2, 10)}}>
          <div style={{flex: 1, display: 'flex', gap: 6}}>
            {[0, 1, 2].map(k => <div key={k} style={{width: 36 + k * 18, height: 6, borderRadius: 3, background: alpha(pal.text, 0.1)}} />)}
          </div>
          <div style={{height: 38, padding: '0 18px', borderRadius: 19, background: pal.accent, color: pal.onAccent, display: 'flex', alignItems: 'center', fontFamily: fonts.sans, fontWeight: 800, fontSize: 14}}>{shot.button}</div>
        </div>
      ) : null}
      <div style={{display: 'flex', flexDirection: 'column', gap: 10}}>
        {shot.rows.map((r, i) => {
          const show = at(i) + 8;
          const typing = frame >= at(i) - 2 && frame < show;
          if (frame < at(i) - 2) return null;
          if (typing) {
            return (
              <div key={i} style={{...card(pal, 0), alignSelf: 'flex-start', padding: '12px 16px', display: 'flex', gap: 6, borderRadius: 18}}>
                {[0, 1, 2].map(k => <div key={k} style={{width: 8, height: 8, borderRadius: '50%', background: pal.muted, transform: `translateY(${Math.sin(frame / 2.5 + k) * 3}px)`}} />)}
              </div>
            );
          }
          const p = progress(frame, show, 14, ease.overshoot);
          const liked = i === 0 ? progress(frame, tap, 10, ease.overshoot) : 0;
          return (
            <div key={i} style={{...card(pal, 0), padding: '12px 14px', display: 'flex', gap: 12, fontFamily: fonts.sans, transform: `translateY(${(1 - p) * 26}px) scale(${0.94 + 0.06 * p})`, transformOrigin: 'left bottom', opacity: Math.min(1, p * 2)}}>
              <Avatar text={r.label} pal={pal} size={36} seed={`f${i}${r.label}`} />
              <div style={{flex: 1, minWidth: 0}}>
                <div style={{display: 'flex', alignItems: 'baseline', gap: 8}}>
                  <div style={{fontSize: 14, fontWeight: 800, color: pal.text}}>{r.label}</div>
                  {r.value ? <div style={{fontSize: 11, color: pal.muted}}>{r.value}</div> : null}
                </div>
                {r.sub ? <div style={{fontSize: 17, lineHeight: 1.35, color: pal.text, marginTop: 3}}>{r.sub}</div> : null}
                {r.bar !== undefined || i === 0 ? (
                  <div style={{display: 'flex', alignItems: 'center', gap: 6, marginTop: 8, color: liked > 0.5 ? pal.accent : pal.muted, fontSize: 12, fontWeight: 700}}>
                    <div style={{transform: `scale(${1 + 0.4 * Math.sin(Math.PI * Math.min(1, liked))})`}}>
                      <LineIcon name="heart" size={16} color={liked > 0.5 ? pal.accent : pal.muted} strokeWidth={9} fill={liked > 0.5 ? pal.accent : 'none'} />
                    </div>
                    {r.bar !== undefined ? <span>{Math.round(r.bar + (liked > 0.5 ? 1 : 0))}</span> : null}
                  </div>
                ) : null}
              </div>
              {i === 0 ? <Tap at={tap} pal={pal} style={{left: 22, bottom: 4}} /> : null}
            </div>
          );
        })}
      </div>
    </div>
  );
};

/** Drawn pitch for highlight shots without an image: lines draw in, a ball arcs to goal. */
const Pitch: React.FC<{pal: Pal; t0: number}> = ({pal, t0}) => {
  const frame = useCurrentFrame();
  const draw = progress(frame, t0, 40, ease.cinematic);
  const W = 354;
  const H = 250;
  const stroke = alpha('#ffffff', 0.55);
  const dash = (len: number) => ({strokeDasharray: len, strokeDashoffset: len * (1 - draw)});
  const ball = progress(frame, t0 + 18, 40, ease.cinematic);
  const bx = 70 + ball * 250;
  const by = 170 - Math.sin(Math.PI * ball) * 110 - ball * 45;
  return (
    <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} style={{position: 'absolute', inset: 0}}>
      <defs>
        <linearGradient id="turf" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor={mix(pal.accent, '#0a3a1c', 0.75)} />
          <stop offset="1" stopColor={mix(pal.accent, '#04140a', 0.85)} />
        </linearGradient>
      </defs>
      <rect width={W} height={H} fill="url(#turf)" />
      {[0, 1, 2, 3, 4, 5].map(k => <rect key={k} x={k * (W / 6)} width={W / 12} height={H} fill={alpha('#ffffff', 0.04)} />)}
      <rect x={14} y={14} width={W - 28} height={H - 28} rx={4} fill="none" stroke={stroke} strokeWidth={2} style={dash(1200)} />
      <line x1={W / 2} y1={14} x2={W / 2} y2={H - 14} stroke={stroke} strokeWidth={2} style={dash(230)} />
      <circle cx={W / 2} cy={H / 2} r={34} fill="none" stroke={stroke} strokeWidth={2} style={dash(214)} />
      <rect x={W - 72} y={H / 2 - 52} width={58} height={104} fill="none" stroke={stroke} strokeWidth={2} style={dash(330)} />
      <rect x={14} y={H / 2 - 52} width={58} height={104} fill="none" stroke={stroke} strokeWidth={2} style={dash(330)} />
      <path d={`M70,170 Q195,30 ${W - 34},${H / 2 - 10}`} fill="none" stroke={alpha(pal.accent, 0.7)} strokeWidth={2.5} strokeDasharray="6 8" opacity={ball > 0 ? 1 : 0} style={{clipPath: `inset(0 ${(1 - ball) * 100}% 0 0)`}} />
      <circle cx={bx} cy={by} r={8} fill="#ffffff" opacity={ball > 0 && ball < 1 ? 1 : ball >= 1 ? 0.9 : 0} />
      <circle cx={W - 40} cy={H / 2 - 10} r={10 + 30 * progress(frame, t0 + 58, 16)} fill="none" stroke={pal.accent} strokeWidth={3} opacity={ball >= 1 ? 1 - progress(frame, t0 + 58, 16) : 0} />
    </svg>
  );
};

const HighlightScreen: React.FC<ScreenArgs> = ({shot, pal, t0, len, image, isStatic}) => {
  const frame = useCurrentFrame();
  const [hero, ...rest] = shot.rows;
  const numAt = t0 + Math.min(len * 0.25, 26);
  const chipsAt = t0 + Math.min(len * 0.45, 44);
  const cardIn = progress(frame, t0, 18, ease.snappy);
  return (
    <div style={{padding: '0 18px'}}>
      <Heading text={shot.heading} pal={pal} t0={t0} />
      <div style={{position: 'relative', height: 250, borderRadius: 22, overflow: 'hidden', background: pal.card, transform: `scale(${0.92 + 0.08 * cardIn})`, opacity: cardIn, boxShadow: `0 20px 40px rgba(0,0,0,.35)`}}>
        {image ? <CameraImage src={image} isStatic={isStatic} move="push" strength={0.8} /> : <Pitch pal={pal} t0={t0 + 4} />}
        <div style={{position: 'absolute', left: 14, right: 14, bottom: 14, height: 4, borderRadius: 2, background: alpha('#ffffff', 0.25)}}>
          <div style={{width: `${tween(frame, [t0, t0 + Math.max(30, len)], [0, 100], ease.cinematic)}%`, height: '100%', borderRadius: 2, background: pal.accent}} />
        </div>
      </div>
      <div style={{marginTop: 22, fontFamily: fonts.sans, ...rowIn(frame, numAt - 4)}}>
        <div style={{fontFamily: fonts.condensed, fontWeight: 800, fontSize: 84, lineHeight: 0.95, color: pal.accent, letterSpacing: '-0.01em', textShadow: `0 0 30px ${alpha(pal.accent, 0.35)}`}}>{countValue(hero.value, frame, numAt, 40)}</div>
        <div style={{fontSize: 20, fontWeight: 800, color: pal.text, marginTop: 6}}>{hero.label}</div>
        {hero.sub ? <div style={{fontSize: 13, fontWeight: 600, color: pal.muted, marginTop: 4}}>{hero.sub}</div> : null}
      </div>
      <div style={{display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 16}}>
        {rest.map((r, i) => {
          const p = progress(frame, chipsAt + i * 5, 14, ease.overshoot);
          return (
            <div key={i} style={{...card(pal, 0), borderRadius: 16, padding: '9px 14px', display: 'flex', gap: 8, alignItems: 'baseline', fontFamily: fonts.sans, transform: `scale(${p})`, opacity: Math.min(1, p * 2)}}>
              <span style={{fontSize: 12, fontWeight: 700, color: pal.muted, textTransform: 'uppercase', letterSpacing: '0.06em'}}>{r.label}</span>
              <span style={{fontFamily: fonts.condensed, fontSize: 22, fontWeight: 800, color: pal.text}}>{r.value}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
};

const SCREENS: Record<Shot['screen'], React.FC<ScreenArgs>> = {scores: ScoresScreen, stats: StatsScreen, vote: VoteScreen, feed: FeedScreen, highlight: HighlightScreen};

const StatusBar: React.FC<{pal: Pal}> = ({pal}) => (
  <>
    <div style={{position: 'absolute', top: 12, left: SCREEN_W / 2 - 62, width: 124, height: 36, borderRadius: 18, background: '#000'}} />
    <div style={{position: 'absolute', top: 20, left: 34, fontFamily: fonts.sans, fontWeight: 700, fontSize: 16, color: pal.text}}>9:41</div>
    <div style={{position: 'absolute', top: 22, right: 30, display: 'flex', alignItems: 'flex-end', gap: 6}}>
      <div style={{display: 'flex', alignItems: 'flex-end', gap: 2}}>
        {[5, 7, 9, 11].map(h => <div key={h} style={{width: 3, height: h, borderRadius: 1, background: pal.text}} />)}
      </div>
      <div style={{width: 24, height: 11, borderRadius: 3, border: `1.5px solid ${alpha(pal.text, 0.6)}`, padding: 1.5}}>
        <div style={{width: '78%', height: '100%', borderRadius: 1.5, background: pal.text}} />
      </div>
    </div>
  </>
);

const AppHeader: React.FC<{pal: Pal; name: string; icon: string}> = ({pal, name, icon}) => (
  <div style={{position: 'absolute', top: 56, left: 18, right: 18, height: 40, display: 'flex', alignItems: 'center', gap: 10}}>
    <div style={{width: 36, height: 36, borderRadius: 11, background: pal.accent, display: 'flex', alignItems: 'center', justifyContent: 'center'}}>
      <LineIcon name={icon} size={22} color={pal.onAccent} strokeWidth={9} />
    </div>
    <div style={{flex: 1, fontFamily: fonts.sans, fontWeight: 800, fontSize: 20, color: pal.text, letterSpacing: '-0.01em', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis'}}>{name}</div>
    {['search', 'calendar'].map(n => (
      <div key={n} style={{width: 36, height: 36, borderRadius: '50%', background: pal.card, display: 'flex', alignItems: 'center', justifyContent: 'center'}}>
        <LineIcon name={n} size={18} color={pal.muted} strokeWidth={8} />
      </div>
    ))}
  </div>
);

const TabBar: React.FC<{pal: Pal; active: number}> = ({pal, active}) => {
  const slot = (SCREEN_W - 36) / TABS.length;
  return (
    <div style={{position: 'absolute', left: 18, right: 18, bottom: 26, height: 62, borderRadius: 31, background: pal.card, boxShadow: `inset 0 0 0 1px ${alpha(pal.text, 0.06)}`}}>
      <div style={{position: 'absolute', top: 7, left: 6 + active * slot, width: slot - 12, height: 48, borderRadius: 24, background: alpha(pal.accent, pal.light ? 0.25 : 0.16)}} />
      {TABS.map((t, i) => {
        const on = Math.max(0, 1 - Math.abs(active - i));
        return (
          <div key={t.icon} style={{position: 'absolute', top: 0, left: i * slot, width: slot, height: 62, display: 'flex', alignItems: 'center', justifyContent: 'center'}}>
            <LineIcon name={t.icon} size={24} color={on > 0.5 ? pal.accent : pal.muted} strokeWidth={8} />
          </div>
        );
      })}
    </div>
  );
};

/** App launch splash: icon draws in, then zooms past the camera as the app opens. */
const Splash: React.FC<{pal: Pal; name: string; icon: string; end: number}> = ({pal, name, icon, end}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const pop = spring({frame: frame - 4, fps, config: {damping: 13, stiffness: 140}});
  const out = progress(frame, end - 12, 14, ease.accelerate);
  if (out >= 1) return null;
  return (
    <AbsoluteFill style={{background: pal.screen, opacity: 1 - out, alignItems: 'center', justifyContent: 'center', zIndex: 5}}>
      <AbsoluteFill style={{background: `radial-gradient(circle at 50% 46%, ${alpha(pal.accent, 0.22)} 0%, transparent 55%)`}} />
      <div style={{transform: `scale(${pop * (1 + out * 2.5)})`, width: 128, height: 128, borderRadius: 36, background: pal.accent, display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: `0 20px 60px ${alpha(pal.accent, 0.45)}`}}>
        <LineIcon name={icon} size={78} color={pal.onAccent} strokeWidth={6} progress={progress(frame, 8, 26, ease.cinematic)} />
      </div>
      <div style={{marginTop: 28, fontFamily: fonts.sans, fontWeight: 800, fontSize: 32, color: pal.text, letterSpacing: '-0.02em', opacity: progress(frame, 14, 12) * (1 - out), transform: `translateY(${(1 - progress(frame, 14, 16)) * 16}px)`}}>{name}</div>
    </AbsoluteFill>
  );
};

const SportsAppShowreel: React.FC<EntryProps<Props>> = ({media, props}) => {
  const frame = useCurrentFrame();
  const {fps, width, height} = useVideoConfig();
  const look = useLook();
  const base = PALETTES[props.palette];
  const pal: Pal = look ? fromLook(look) : {...base, accent: media.accent ?? base.accent, onAccent: onAccent(media.accent ?? base.accent), light: false};
  const u = Math.min(width, height) / 1080;
  const wide = width >= height;
  const timeline = useSceneTimeline(media);
  const contentEnd = useContentFrames(media);
  const shots = props.shots;
  const offset = timeline.length > shots.length ? 1 : 0;
  const introEnd = offset ? timeline[1].from : Math.min(Math.round(1.5 * fps), Math.round(timeline[0].durationInFrames * 0.4));
  const shotOf = (k: number) => (k < offset ? -1 : (k - offset) % shots.length);
  const startOf = (k: number) => (k === 0 && !offset ? introEnd : timeline[k].from);
  const endOf = (k: number) => Math.min(contentEnd, k === timeline.length - 1 ? Infinity : timeline[k + 1].from);
  const found = timeline.findIndex(t => frame >= t.from && frame < t.from + t.durationInFrames);
  const current = frame < introEnd ? -1 : shotOf(found === -1 ? timeline.length - 1 : found);

  // ---- Layout: headline on top (portrait) or in a left column (square / landscape); phone kept above the caption zone.
  const safe = captionSafeBottom(look);
  const ownCaptions = !look && props.showCaptions;
  const bottom = height * (1 - Math.max(safe, wide ? 0.05 : ownCaptions ? 0.13 : 0.05));
  const phoneTop = wide ? height * 0.07 : height * 0.235;
  const phoneH = Math.min(wide ? height * 0.86 : height * 0.62, bottom - phoneTop);
  const bezel = phoneH * 0.016;
  const innerH = phoneH - bezel * 2;
  const innerW = (innerH * SCREEN_W) / SCREEN_H;
  const phoneW = innerW + bezel * 2;
  const cx = wide ? width * (width > height * 1.3 ? 0.7 : 0.71) : width / 2;
  const colLeft = width * 0.06;
  const colRight = wide ? cx - phoneW / 2 - width * 0.05 : width * 0.94;
  const k = innerW / SCREEN_W;

  // ---- Camera: the phone flies in, then eases into a new pose on every shot, with a small punch on the cut.
  const enter = spring({frame, fps, config: {damping: 16, stiffness: 70, mass: 1.1}});
  let pose = INTRO_POSE;
  timeline.forEach((_, s) => {
    if (shotOf(s) < 0) return;
    pose = lerpPose(pose, POSES[(s - offset) % POSES.length], progress(frame, startOf(s) - 6, 26, ease.cinematic));
  });
  const kick = timeline.reduce((m, _, s) => (shotOf(s) < 0 ? m : Math.max(m, Math.sin(Math.PI * progress(frame, startOf(s) - 4, 14, ease.cinematic)))), 0);
  const floatY = Math.sin(frame / 28) * 8 * u;
  const phoneTransform = `translate(${pose.x * u}px, ${(1 - enter) * height * 0.7 + pose.y * u + floatY}px) rotateX(${pose.rx + (1 - enter) * 40}deg) rotateY(${pose.ry + (1 - enter) * -24}deg) rotateZ(${pose.rz + Math.sin(frame / 45) * 0.6}deg) scale(${pose.s * (1 + 0.035 * kick)})`;
  const tabActive = current < 0 ? 0 : (() => {
    let a = TABS.findIndex(t => t.screen === shots[shotOf(0) < 0 ? 0 : shotOf(0)].screen);
    timeline.forEach((_, s) => {
      if (shotOf(s) < 0) return;
      const target = TABS.findIndex(t => t.screen === shots[shotOf(s)].screen);
      a = a + (target - a) * progress(frame, startOf(s), 14, ease.snappy);
    });
    return a;
  })();

  // ---- Headline slots: the hook during the launch, then one headline per shot.
  const slots = [{from: 0, to: introEnd, text: props.title, kicker: props.appName}, ...timeline.flatMap((_, s) => (shotOf(s) < 0 || startOf(s) >= contentEnd ? [] : [{from: startOf(s), to: endOf(s), text: shots[shotOf(s)].headline, kicker: `${pad2(shotOf(s) + 1)} / ${pad2(shots.length)}${shots[shotOf(s)].heading ? '  ' + shots[shotOf(s)].heading : ''}`}]))];
  const headSize = (t: string) => {
    const n = t.replace(/\*/g, '').length;
    return (wide ? (n <= 16 ? 92 : n <= 28 ? 76 : 62) : n <= 16 ? 108 : n <= 28 ? 90 : 74) * u;
  };
  const lastScene = timeline.length - 1;
  const lockAt = startOf(lastScene) + Math.min((endOf(lastScene) - startOf(lastScene)) * 0.5, 2 * fps);
  const lock = props.tagline && shotOf(lastScene) >= 0 ? spring({frame: frame - lockAt, fps, config: {damping: 14, stiffness: 160}}) : 0;
  const lockOut = progress(frame, contentEnd - 8, 8);
  const marquee = `${props.appName}  •  `.repeat(6);

  return (
    <AbsoluteFill style={{background: pal.bg, overflow: 'hidden'}}>
      {/* backdrop: accent glow from above, scene imagery blurred behind the phone */}
      <AbsoluteFill style={{background: `radial-gradient(ellipse 85% 42% at 50% -4%, ${alpha(mix(pal.bg2, pal.accent, 0.3), pal.light ? 0.5 : 0.95)} 0%, transparent 72%), radial-gradient(ellipse 70% 40% at 50% 108%, ${alpha(pal.bg2, 0.9)} 0%, transparent 70%)`}} />
      <SceneSeries
        media={media}
        transition="blur"
        overlap={16}
        renderScene={({timed}) => (timed.scene.video ? (
          <AbsoluteFill style={{filter: 'blur(22px) saturate(1.15)', opacity: pal.light ? 0.3 : 0.5, transform: 'scale(1.1)'}}>
            <CameraImage src={timed.scene.video} isStatic={timed.scene.isStaticImage} move="push" />
          </AbsoluteFill>
        ) : null)}
      />
      <div style={{position: 'absolute', left: 0, top: phoneTop + phoneH * 0.42, whiteSpace: 'nowrap', fontFamily: fonts.heavy, fontSize: 300 * u, lineHeight: 1, color: 'transparent', WebkitTextStroke: `${3 * u}px ${alpha(pal.text, pal.light ? 0.16 : 0.15)}`, textTransform: 'uppercase', transform: `rotate(-7deg) translateX(${-frame * 3 * u - width * 0.2}px)`}}>{marquee}</div>
      <Particles count={36} color={pal.accent} opacity={pal.light ? 0.25 : 0.35} seed="court" speed={0.7} size={[2, 5]} />

      {/* headline column */}
      {slots.map((s, i) => {
        const len = Math.max(1, s.to - s.from);
        return (
          <Sequence key={i} from={s.from} durationInFrames={len} layout="none">
            <SlotHeadline text={s.text} kicker={s.kicker} len={len} pal={pal} size={headSize(s.text)} u={u} style={wide ? {left: colLeft, width: colRight - colLeft, top: height * 0.16} : {left: colLeft, width: colRight - colLeft, top: height * 0.05}} />
          </Sequence>
        );
      })}

      {/* the phone */}
      <AbsoluteFill style={{perspective: 2600 * u}}>
        <div style={{position: 'absolute', left: cx - phoneW / 2, top: phoneTop, width: phoneW, height: phoneH, transform: phoneTransform, transformStyle: 'preserve-3d'}}>
          <div style={{position: 'absolute', inset: 0, borderRadius: phoneW * 0.15, background: pal.bezel, boxShadow: `0 ${60 * u}px ${130 * u}px rgba(0,0,0,${pal.light ? 0.28 : 0.6}), 0 0 ${90 * u}px ${alpha(pal.accent, 0.16)}, inset 0 0 0 ${2 * u}px ${alpha('#ffffff', 0.12)}`}} />
          <div style={{position: 'absolute', left: bezel, top: bezel, width: innerW, height: innerH, borderRadius: phoneW * 0.13, overflow: 'hidden', background: pal.screen}}>
            <div style={{position: 'absolute', left: 0, top: 0, width: SCREEN_W, height: SCREEN_H, transform: `scale(${k})`, transformOrigin: '0 0'}}>
              <StatusBar pal={pal} />
              <AppHeader pal={pal} name={props.appName} icon={props.icon} />
              <div style={{position: 'absolute', top: CONTENT_TOP, left: 0, right: 0, bottom: CONTENT_BOTTOM, overflow: 'hidden'}}>
                <SceneSeries
                  media={media}
                  transition="whip"
                  overlap={14}
                  renderScene={({index, timed}) => {
                    const s = shotOf(index);
                    if (s < 0) return null;
                    const lead = index === 0 ? 0 : 7;
                    const t0 = lead + (index === 0 && !offset ? introEnd : 0);
                    const len = Math.max(12, endOf(index) - startOf(index));
                    const Screen = SCREENS[shots[s].screen];
                    return (
                      <AbsoluteFill style={{background: pal.screen}}>
                        <Screen shot={shots[s]} pal={pal} t0={t0} len={len} image={timed.scene.video} isStatic={timed.scene.isStaticImage} seed={index} />
                      </AbsoluteFill>
                    );
                  }}
                />
              </div>
              <TabBar pal={pal} active={tabActive} />
              <div style={{position: 'absolute', bottom: 9, left: SCREEN_W / 2 - 60, width: 120, height: 5, borderRadius: 3, background: alpha(pal.text, 0.5)}} />
              <Splash pal={pal} name={props.appName} icon={props.icon} end={introEnd} />
            </div>
            {/* glass sheen that slides with the phone's turn */}
            <AbsoluteFill style={{pointerEvents: 'none', background: `linear-gradient(115deg, transparent ${30 + pose.ry * 1.5}%, ${alpha('#ffffff', 0.07)} ${40 + pose.ry * 1.5}%, transparent ${52 + pose.ry * 1.5}%)`}} />
          </div>
        </div>
        {lock > 0 ? (
          <div style={{position: 'absolute', left: cx, top: phoneTop + phoneH * 0.8, transform: `translate(-50%, 0) scale(${lock * (1 - lockOut)})`, display: 'flex', alignItems: 'center', gap: 18 * u, padding: `${18 * u}px ${30 * u}px ${18 * u}px ${18 * u}px`, borderRadius: 30 * u, background: alpha(pal.light ? pal.screen : pal.bg, 0.92), boxShadow: `0 ${30 * u}px ${70 * u}px rgba(0,0,0,.45), inset 0 0 0 ${2 * u}px ${alpha(pal.accent, 0.5)}`, whiteSpace: 'nowrap', maxWidth: wide ? width * 0.5 : width * 0.86}}>
            <div style={{width: 72 * u, height: 72 * u, borderRadius: 20 * u, background: pal.accent, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0}}>
              <LineIcon name={props.icon} size={46 * u} color={pal.onAccent} strokeWidth={8} />
            </div>
            <div style={{fontFamily: fonts.sans, color: pal.text, minWidth: 0}}>
              <div style={{fontWeight: 800, fontSize: 38 * u, letterSpacing: '-0.01em'}}>{props.appName}</div>
              <div style={{fontSize: 26 * u, color: pal.muted, marginTop: 2 * u, overflow: 'hidden', textOverflow: 'ellipsis'}}>{props.tagline}</div>
            </div>
          </div>
        ) : null}
      </AbsoluteFill>

      {timeline.map((t, i) => (i === 0 ? null : <LightLeak key={t.index} from={t.from - 8} durationInFrames={22} seed={i * 7 + 2} hueShift={pal.hue} opacity={pal.light ? 0.25 : 0.45} />))}
      <LightLeak from={introEnd - 10} durationInFrames={26} seed={3} hueShift={pal.hue} opacity={pal.light ? 0.3 : 0.55} />

      {ownCaptions
        ? timeline.map(t => (
            <Sequence key={t.index} from={t.from} durationInFrames={t.durationInFrames}>
              <AbsoluteFill style={wide ? {justifyContent: 'flex-end', alignItems: 'flex-start', padding: `0 0 ${height * 0.1}px ${colLeft}px`} : {justifyContent: 'flex-end', padding: `0 7% ${height * 0.04}px`}}>
                <div style={{width: wide ? colRight - colLeft : '100%'}}>
                  <StyledCaptions scene={t.scene} variant="box" accent={pal.accent} color={pal.text} font={fonts.condensed} size={(wide ? 50 : 58) * u} words={4} uppercase align={wide ? 'left' : 'center'} />
                </div>
              </AbsoluteFill>
            </Sequence>
          ))
        : null}
      <Vignette strength={0.55} />
      <Grain opacity={0.06} />
      <NarrationTrack media={media} />
      <AdWeave media={media} theme={{background: pal.bg, text: pal.text, font: fonts.sans}} />
    </AbsoluteFill>
  );
};

/** One headline: kicker line, then the words rise in; slides up and out at the end of its slot. */
const SlotHeadline: React.FC<{text: string; kicker: string; len: number; pal: Pal; size: number; u: number; style: React.CSSProperties}> = ({text, kicker, len, pal, size, u, style}) => {
  const frame = useCurrentFrame();
  const out = progress(frame, len - 9, 9, ease.accelerate);
  const line = progress(frame, 0, 16, ease.expo);
  return (
    <div style={{position: 'absolute', ...style, opacity: 1 - out, transform: `translateY(${-out * 40 * u}px)`, filter: out > 0 ? `blur(${out * 8}px)` : undefined}}>
      <div style={{display: 'flex', alignItems: 'center', gap: 14 * u, fontFamily: fonts.mono, fontSize: 24 * u, letterSpacing: '0.24em', textTransform: 'uppercase', color: pal.accent, marginBottom: 18 * u, opacity: line}}>
        <div style={{width: 56 * u * line, height: 3 * u, background: pal.accent}} />
        <span style={{whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis'}}>{kicker}</span>
      </div>
      <KineticText text={text} start={3} stagger={3} duration={16} style="rise" accent={pal.accent} textStyle={{fontFamily: fonts.heavy, fontSize: size, lineHeight: 1.02, letterSpacing: '-0.02em', color: pal.text, textTransform: 'uppercase'}} />
    </div>
  );
};

export default defineEntry({id: 'showreel-sports-highlight', schema: Props, component: SportsAppShowreel});
