import React from 'react';
import {AbsoluteFill, Sequence, spring, useCurrentFrame, useVideoConfig} from 'remotion';
import {AdWeave, NarrationTrack, captionSafeBottom, defineEntry, mix, useContentFrames, useLook, useSceneTimeline, type ActiveLook, type EntryProps} from '@viralaunch/kit';
import {Grain, LightLeak, LineIcon, Particles, SceneSeries, StyledCaptions, Vignette, alpha, countUp, ease, fonts, progress, rand, tween, type Widen} from '@viralaunch/kit/fx';
import {Props, type Beat} from './schema';

const PALETTES = {
  cozy: {wall: '#f3e6c4', wall2: '#8fcfc0', floor: '#a8735c', ink: '#2b211c', desk: '#c98a52', deskDark: '#b47641', body: '#e8774f', face: '#2b211c', cork: '#c99560', card: '#fffaf0', cardText: '#2b211c', muted: '#7a6a5c', accent: '#ff6b3d', ribbon: '#f6a6bf', screen: '#1f2a38', screenText: '#a8f0c0', monitor: '#3a4150'},
  pastel: {wall: '#ebe5f7', wall2: '#b9c8f2', floor: '#7d72a8', ink: '#2a2540', desk: '#e2b58b', deskDark: '#cc9e74', body: '#ff9ec4', face: '#2a2540', cork: '#d9a679', card: '#ffffff', cardText: '#2a2540', muted: '#7c7699', accent: '#7a5cff', ribbon: '#ffe08a', screen: '#232845', screenText: '#c8d4ff', monitor: '#45406a'},
  midnight: {wall: '#1d2346', wall2: '#283265', floor: '#11152e', ink: '#0a0c1c', desk: '#454a80', deskDark: '#383c6a', body: '#ff8a5c', face: '#14162b', cork: '#5d4d72', card: '#151a3a', cardText: '#eef1ff', muted: '#9aa3c7', accent: '#6cf2ff', ribbon: '#ffd36e', screen: '#0b1022', screenText: '#7cf7c8', monitor: '#2a2f55'},
} as const;
type Pal = Widen<(typeof PALETTES)[keyof typeof PALETTES]>;

/** The room in a sequence's shared look: walls, desk, character and bubbles take the look's colours. */
const fromLook = (l: ActiveLook): Pal => {
  const light = l.tone === 'light';
  const ink = light ? l.palette.line : mix(l.palette.bg, '#000000', 0.5);
  const desk = mix(l.palette.surface, l.palette.accent, light ? 0.28 : 0.22);
  return {
    wall: light ? l.palette.bg : mix(l.palette.bg, l.palette.bg2, 0.55),
    wall2: mix(l.palette.bg2, l.palette.accent, 0.16),
    floor: light ? mix(l.palette.bg2, l.palette.text, 0.35) : l.palette.bg,
    ink,
    desk,
    deskDark: mix(desk, '#000000', 0.12),
    body: l.palette.accent,
    face: light ? l.palette.text : mix(l.palette.bg, '#000000', 0.3),
    cork: mix(l.palette.bg2, '#c99560', 0.5),
    card: l.palette.surface,
    cardText: l.palette.text,
    muted: l.palette.muted,
    accent: l.palette.accent,
    ribbon: light ? mix(l.palette.surface, l.palette.accent, 0.45) : mix(l.palette.text, l.palette.accent, 0.35),
    screen: light ? '#22262e' : mix(l.palette.bg, '#000000', 0.35),
    screenText: light ? mix(l.palette.accent, '#ffffff', 0.35) : mix(l.palette.text, l.palette.accent, 0.5),
    monitor: light ? mix(l.palette.text, l.palette.bg, 0.25) : mix(l.palette.surface, l.palette.line, 0.18),
  };
};

const SKIES = {
  'day-to-night': {stops: ['#a9dcf5', '#7fc3ec', '#f4b07a', '#6a5aa0', '#1a2150'], dark: [0, 0, 0.2, 0.6, 1]},
  'night-to-dawn': {stops: ['#141a40', '#1e2458', '#5b4b8e', '#f2a37c', '#a9dcf5'], dark: [1, 0.9, 0.6, 0.2, 0]},
  daylight: {stops: ['#bfe6f7', '#8fd0f2', '#86c9ee', '#cfe6e4', '#f8d9a6'], dark: [0, 0, 0, 0, 0.1]},
} as const;
const NOTE_COLORS = ['#ffe27a', '#a6e3d0', '#f7b2c4', '#bcd0ff', '#ffc89a', '#d6f29a'];

function sample(stops: readonly string[], t: number) {
  const p = Math.min(0.9999, Math.max(0, t)) * (stops.length - 1);
  const i = Math.floor(p);
  return mix(stops[i], stops[i + 1], p - i);
}
function sampleN(stops: readonly number[], t: number) {
  const p = Math.min(0.9999, Math.max(0, t)) * (stops.length - 1);
  const i = Math.floor(p);
  return stops[i] + (stops[i + 1] - stops[i]) * (p - i);
}
/** "15:45" → minutes after midnight, or null. */
function parseTime(s: string): number | null {
  const m = /^(\d{1,2})[:.h]?(\d{2})/.exec(s.trim());
  return m ? (Number(m[1]) % 24) * 60 + Number(m[2]) : null;
}

type Pt = [number, number];
const POSES: Record<'type' | 'cheer' | 'scratch' | 'rest' | 'think', [Pt, Pt]> = {
  type: [[392, 668], [500, 668]],
  cheer: [[238, 438], [622, 438]],
  scratch: [[392, 668], [512, 450]],
  rest: [[350, 686], [515, 686]],
  think: [[392, 626], [515, 686]],
};
function poseOf(b: Beat | undefined): keyof typeof POSES {
  if (!b) return 'type';
  if ((b.screen === 'success' || b.screen === 'launch' || b.screen === 'chart') && (b.mood === 'happy' || b.mood === 'proud')) return 'cheer';
  if (b.mood === 'confused' || b.mood === 'frustrated' || b.screen === 'error') return 'scratch';
  if (b.mood === 'sleepy') return 'rest';
  if (b.screen === 'thinking') return 'think';
  return 'type';
}

const sparkle = (x: number, y: number, r: number) => `M${x} ${y - r} Q${x} ${y} ${x + r} ${y} Q${x} ${y} ${x} ${y + r} Q${x} ${y} ${x - r} ${y} Q${x} ${y} ${x} ${y - r} Z`;

/** Face drawn in stage units, centred on the character's head. */
const Face: React.FC<{mood: Beat['mood']; blink: number; pal: Pal}> = ({mood, blink, pal}) => {
  const st = {stroke: pal.face, strokeWidth: 7, strokeLinecap: 'round' as const, fill: 'none'};
  const blush = <><ellipse cx={360} cy={584} rx={18} ry={10} fill={alpha('#ff6f91', 0.45)} /><ellipse cx={500} cy={584} rx={18} ry={10} fill={alpha('#ff6f91', 0.45)} /></>;
  const dots = <><ellipse cx={385} cy={550} rx={9} ry={12 * blink} fill={pal.face} /><ellipse cx={475} cy={550} rx={9} ry={12 * blink} fill={pal.face} /></>;
  switch (mood) {
    case 'happy':
      return <g>{blush}<path d="M368 556 Q385 534 402 556" {...st} /><path d="M458 556 Q475 534 492 556" {...st} /><path d="M404 594 Q430 622 456 594" {...st} /></g>;
    case 'proud':
      return (
        <g>
          {blush}
          {[385, 475].map(x => <g key={x}><ellipse cx={x} cy={550} rx={17} ry={19 * blink} fill={pal.face} />{blink > 0.5 ? <circle cx={x - 6} cy={543} r={6} fill="#ffffff" /> : null}</g>)}
          <path d="M410 598 Q420 610 430 600 Q440 610 450 598" {...st} />
        </g>
      );
    case 'confused':
      return <g>{dots}<path d="M366 522 L402 522" {...st} /><path d="M456 518 Q476 502 496 514" {...st} /><path d="M412 606 Q421 598 430 606 Q439 614 448 606" {...st} /></g>;
    case 'frustrated':
      return <g>{dots}<path d="M364 514 L404 530" {...st} /><path d="M456 530 L496 514" {...st} /><ellipse cx={430} cy={606} rx={16} ry={12} fill={pal.face} /></g>;
    case 'sleepy':
      return <g><path d="M368 548 Q385 560 402 548" {...st} /><path d="M458 548 Q475 560 492 548" {...st} /><circle cx={430} cy={604} r={7} {...st} strokeWidth={5} /></g>;
    default:
      return <g>{dots}<path d="M366 520 L402 527" {...st} /><path d="M458 527 L494 520" {...st} /><path d="M414 604 L446 604" {...st} /></g>;
  }
};

/** Monitor content, laid over the screen rect. `k` = px per stage unit. */
const Screen: React.FC<{beat: Beat | undefined; local: number; dur: number; history: Beat[]; typed: string; intro: string | null; pal: Pal; k: number}> = ({beat, local, dur, history, typed, intro, pal, k}) => {
  const frame = useCurrentFrame();
  const caret = Math.floor(frame / 15) % 2 ? 0 : 1;
  const mono: React.CSSProperties = {fontFamily: fonts.mono, color: pal.screenText};
  const center: React.CSSProperties = {position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8 * k};
  const state = intro !== null ? 'intro' : beat?.screen ?? 'typing';
  const bg = state === 'error' ? '#5b1d24' : state === 'success' ? '#1d4a33' : pal.screen;
  const draw = progress(local, 6, 24, ease.cinematic);
  let body: React.ReactNode = null;
  if (state === 'intro') {
    body = <div style={{...center, ...mono, fontSize: 21 * k, padding: 14 * k, textAlign: 'left', alignItems: 'flex-start'}}><div>{intro}<span style={{opacity: caret}}>▍</span></div></div>;
  } else if (state === 'typing') {
    body = (
      <div style={{position: 'absolute', inset: 0, padding: 12 * k, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', gap: 6 * k, ...mono, fontSize: 13 * k, lineHeight: 1.3}}>
        {history.slice(-3).map((h, i) => <div key={i} style={{opacity: 0.35, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis'}}>{h.who === 'machine' ? '' : '> '}{h.message}</div>)}
        <div>{beat?.who === 'machine' ? '' : '> '}{typed}<span style={{opacity: caret}}>▍</span></div>
      </div>
    );
  } else if (state === 'thinking') {
    const pulse = 0.75 + 0.25 * Math.sin(local / 5);
    body = <div style={center}><LineIcon name="bulb" progress={draw} size={84 * k} color="#ffe27a" strokeWidth={5} style={{filter: `drop-shadow(0 0 ${14 * k * pulse}px #ffe27a)`}} /><div style={{...mono, fontSize: 18 * k, letterSpacing: '0.3em'}}>{'...'.slice(0, 1 + (Math.floor(local / 8) % 3))}</div></div>;
  } else if (state === 'progress') {
    const p = progress(local, 6, Math.max(20, dur * 0.7), ease.cinematic);
    body = (
      <div style={{...center, padding: `0 ${22 * k}px`, alignItems: 'stretch'}}>
        <div style={{...mono, fontSize: 14 * k, letterSpacing: '0.2em', display: 'flex', justifyContent: 'space-between'}}><span>RUNNING</span><span>{countUp(local, 100, 6, Math.max(20, dur * 0.7))}%</span></div>
        <div style={{height: 18 * k, borderRadius: 9 * k, background: alpha(pal.screenText, 0.18), overflow: 'hidden'}}><div style={{width: `${p * 100}%`, height: '100%', background: pal.screenText}} /></div>
      </div>
    );
  } else if (state === 'error') {
    const shake = Math.sin(local * 1.9) * 7 * k * (1 - progress(local, 0, 22));
    body = <div style={{...center, transform: `translateX(${shake}px)`}}><LineIcon name="cross" progress={draw} size={80 * k} color="#ff9a9a" strokeWidth={7} /><div style={{fontFamily: fonts.mono, color: '#ffb3b3', fontSize: 16 * k, letterSpacing: '0.3em', fontWeight: 700}}>ERROR</div></div>;
  } else if (state === 'success') {
    body = <div style={center}><LineIcon name="check" progress={draw} size={96 * k} color="#a8f0c0" strokeWidth={8} /></div>;
  } else if (state === 'chart') {
    body = <div style={center}><LineIcon name="chart" progress={progress(local, 4, 36, ease.cinematic)} size={110 * k} color={pal.screenText} strokeWidth={5} /></div>;
  } else if (state === 'launch') {
    const y = tween(local, [6, 6 + Math.max(30, dur * 0.6)], [70, -30], ease.cinematic);
    body = (
      <div style={center}>
        {Array.from({length: 7}, (_, i) => <div key={i} style={{position: 'absolute', left: `${rand(`ls${i}`, 5, 95)}%`, top: `${((rand(`lt${i}`, 0, 100) + local * 3) % 110) - 5}%`, width: 2 * k, height: 14 * k, background: alpha(pal.screenText, 0.5)}} />)}
        <div style={{transform: `translateY(${y * k}px)`}}><LineIcon name="rocket" size={84 * k} color={pal.screenText} strokeWidth={5} /></div>
      </div>
    );
  }
  return <div style={{position: 'absolute', inset: 0, background: bg}}>{body}</div>;
};

type Rect = {x: number; y: number; s: number};

const SessionDiary: React.FC<EntryProps<Props>> = ({media, props}) => {
  const frame = useCurrentFrame();
  const {fps, width, height} = useVideoConfig();
  const look = useLook();
  const base = PALETTES[props.palette];
  const pal: Pal = look ? fromLook(look) : {...base, accent: media.accent ?? base.accent};
  const u = Math.min(width, height) / 1080;
  const timeline = useSceneTimeline(media);
  const contentFrames = useContentFrames(media);
  const beats = props.beats;
  const offset = timeline.length > beats.length ? 1 : 0;

  // --- timing -------------------------------------------------------------------------------
  const introEnd = offset ? timeline[1].from : Math.min(Math.round(1.6 * fps), Math.round((timeline[0]?.durationInFrames ?? fps * 3) * 0.45));
  const zoomStart = offset ? Math.max(0, introEnd - Math.round(1.3 * fps)) : Math.round(introEnd * 0.35);
  const beatStart = (i: number) => (i === 0 && !offset ? introEnd - 4 : timeline[i + offset]?.from ?? contentFrames);
  const beatEnd = (i: number) => (i === beats.length - 1 ? contentFrames : beatStart(i + 1));
  let cur = -1;
  beats.forEach((_, i) => { if (frame >= beatStart(i)) cur = i; });
  const beat = cur >= 0 ? beats[cur] : undefined;
  const start = cur >= 0 ? beatStart(cur) : 0;
  const local = frame - start;
  const dur = cur >= 0 ? Math.max(1, beatEnd(cur) - start) : introEnd;
  const t = Math.min(1, frame / Math.max(1, contentFrames));
  const typeLen = (b: Beat, d: number) => Math.min(Math.max(14, b.message.length * 1.3), Math.max(14, d * 0.45));
  const typedOf = (i: number) => {
    const b = beats[i];
    const n = Math.floor(progress(frame, beatStart(i) + 8, typeLen(b, beatEnd(i) - beatStart(i)), (x: number) => x) * b.message.length);
    return b.message.slice(0, n);
  };

  // --- layout -------------------------------------------------------------------------------
  const side = width / height > 1.2;
  const squareish = !side && width / height > 0.8;
  const reserve = look ? captionSafeBottom(look) + 0.015 : props.showCaptions ? (side ? 0.15 : 0.16) : 0.04;
  const bottom = height * (1 - reserve);
  let stage: Rect;
  if (side) {
    const s = Math.min(width * 0.5, bottom - height * 0.05);
    stage = {x: width - s - width * 0.04, y: bottom - s, s};
  } else {
    const s = Math.min(width, bottom - height * (squareish ? 0.36 : 0.3));
    stage = {x: (width - s) / 2, y: bottom - s, s};
  }
  const k = stage.s / 1000;
  const at = (x: number, y: number): Pt => [stage.x + x * k, stage.y + y * k];

  // --- sky + light --------------------------------------------------------------------------
  const sky = SKIES[props.sky];
  const skyTop = look ? mix(sample(sky.stops, t), look.palette.bg2, 0.2) : sample(sky.stops, t);
  const skyBottom = mix(skyTop, '#ffffff', 0.25);
  const dark = sampleN(sky.dark, t);

  // --- camera -------------------------------------------------------------------------------
  const zoom = tween(frame, [zoomStart, introEnd], [2.7, 1], ease.cinematic);
  const zk = (zoom - 1) / 1.7;
  const [mx, my] = at(750, 510);
  const push = cur >= 0 ? (cur % 2 ? 1.035 - 0.035 * progress(frame, start, dur, ease.cinematic) : 1 + 0.035 * progress(frame, start, dur, ease.cinematic)) : 1;
  const [cx, cy] = at(450, 560);
  const shake = beat && beat.screen === 'error' ? Math.sin(local * 2.3) * 9 * u * (1 - progress(local, 0, 18)) : 0;

  // --- character ----------------------------------------------------------------------------
  const pop = cur >= 0 ? spring({frame: local, fps, config: {damping: 9, stiffness: 170}}) : 1;
  const sy = (1 - (1 - pop) * 0.14) * (1 + 0.012 * Math.sin(frame / 14));
  const sx = 1 / Math.sqrt(sy);
  const prevPose = POSES[poseOf(cur > 0 ? beats[cur - 1] : undefined)];
  const nextPose = POSES[poseOf(beat)];
  const pk = cur >= 0 ? progress(local, 0, 10, ease.snappy) : 1;
  const pose = poseOf(beat);
  const hands = [0, 1].map(i => {
    let x = prevPose[i][0] + (nextPose[i][0] - prevPose[i][0]) * pk;
    let y = prevPose[i][1] + (nextPose[i][1] - prevPose[i][1]) * pk;
    if (pose === 'type' && pk >= 1) y -= 9 * Math.max(0, Math.sin(frame * 0.85 + i * Math.PI));
    if (pose === 'cheer') { x += Math.sin(frame * 0.3 + i * 2) * 9; y += Math.cos(frame * 0.3 + i) * 7; }
    if (pose === 'scratch' && i === 1) x += Math.sin(frame * 0.6) * 7;
    return [x, y] as Pt;
  });
  const shoulders: Pt[] = [[300, 700 - 120 * sy], [560, 700 - 120 * sy]];
  const blinkPhase = frame % 97;
  const blink = blinkPhase < 4 ? 0.15 : 1;
  const mood = beat?.mood ?? 'focused';
  const markIn = cur >= 0 ? progress(local, 6, 12, ease.overshoot) : 0;

  // Clock hands sweep from the previous beat's time to this one.
  const minsOf = (i: number): number => {
    const p = parseTime(beats[Math.max(0, i)]?.time ?? '');
    if (i < 0) return (p ?? 540) - 30;
    return p ?? minsOf(i - 1) + 60;
  };
  const a0 = minsOf(cur - 1);
  const a1raw = minsOf(cur);
  const a1 = a1raw < a0 ? a1raw + 1440 : a1raw;
  const mins = cur >= 0 ? a0 + (a1 - a0) * progress(local, 0, 26, ease.cinematic) : minsOf(-1);

  // Stickers earned so far (last three stay on).
  const earned = beats.map((b, i) => ({b, i})).filter(e => e.b.sticker && e.i <= cur);
  const SLOTS = [{x: 430, y: 612, r: -22}, {x: 430, y: 500, r: 13}, {x: 430, y: 652, r: 7}];

  const history = cur > 0 ? beats.slice(0, cur) : [];
  const typed = cur >= 0 ? typedOf(cur) : '';
  const introChars = Math.floor(progress(frame, 6, Math.min(props.title.length * 2, Math.max(10, zoomStart - 4)), (x: number) => x) * props.title.length);
  const introText = cur < 0 ? props.title.slice(0, introChars) : null;
  const confetti = beat && (beat.screen === 'success' || beat.screen === 'launch') && (beat.mood === 'happy' || beat.mood === 'proud');

  const ink = pal.ink;
  const sw = 6;
  const room = (
    <svg width={stage.s} height={stage.s} viewBox="0 0 1000 1000" style={{position: 'absolute', left: stage.x, top: stage.y, overflow: 'visible'}}>
      <defs>
        <linearGradient id="sdd-sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor={skyTop} /><stop offset="1" stopColor={skyBottom} /></linearGradient>
        <clipPath id="sdd-win"><rect x={46} y={116} width={248} height={308} /></clipPath>
      </defs>
      {/* window with the day passing */}
      <rect x={40} y={110} width={260} height={320} fill="url(#sdd-sky)" stroke={ink} strokeWidth={sw} />
      <g clipPath="url(#sdd-win)">
        {Array.from({length: 12}, (_, i) => <circle key={i} cx={rand(`sx${i}`, 55, 285)} cy={rand(`sy${i}`, 125, 300)} r={rand(`sr${i}`, 1.5, 3.5)} fill="#ffffff" opacity={Math.max(0, dark - 0.4) * 1.6 * (0.6 + 0.4 * Math.sin(frame / 9 + i))} />)}
        <circle cx={80 + 190 * t} cy={175 + 220 * Math.pow(Math.abs(t - 0.5) * 2, 2)} r={30} fill="#fff1b8" opacity={1 - dark} />
        <g opacity={dark}><circle cx={110 + 120 * t} cy={190} r={26} fill="#f4f1e4" /><circle cx={122 + 120 * t} cy={182} r={22} fill={skyTop} /></g>
        <path d="M30 430 Q110 330 200 395 Q250 350 320 380 L320 440 L30 440 Z" fill={mix('#7cc47f', '#1d2b3a', dark * 0.8)} />
        <path d="M30 440 Q150 370 320 420 L320 440 Z" fill={mix('#5aa860', '#162330', dark * 0.8)} />
      </g>
      <path d="M170 110 L170 430 M40 270 L300 270" stroke={ink} strokeWidth={sw} />
      <rect x={24} y={428} width={292} height={22} rx={4} fill={pal.desk} stroke={ink} strokeWidth={sw} />
      {/* vase on the sill */}
      <path d="M248 428 L242 392 L272 392 L266 428 Z" fill={pal.wall2} stroke={ink} strokeWidth={4} />
      {[[-12, 330], [2, 318], [16, 334]].map(([dx, y], i) => (
        <g key={i} transform={`rotate(${Math.sin(frame / 20 + i) * 3} 257 392)`}><path d={`M257 392 L${257 + dx} ${y}`} stroke={mix('#4f9a5a', ink, 0.2)} strokeWidth={4} /><circle cx={257 + dx} cy={y} r={11} fill={i === 1 ? '#ff7a8a' : '#ff5a6e'} stroke={ink} strokeWidth={3} /></g>
      ))}
      {/* cork board: one note per beat so far */}
      <rect x={360} y={90} width={210} height={160} rx={6} fill={pal.cork} stroke={ink} strokeWidth={sw} />
      {beats.map((_, i) => {
        if (i > cur || i < cur - 5) return null;
        const slot = i % 6;
        const p = progress(frame, beatStart(i) + 4, 10, ease.overshoot);
        const x = 378 + (slot % 3) * 62;
        const y = 104 + Math.floor(slot / 3) * 70;
        const col = look ? mix(NOTE_COLORS[i % NOTE_COLORS.length], pal.card, 0.3) : NOTE_COLORS[i % NOTE_COLORS.length];
        return (
          <g key={i} transform={`translate(${x + 24} ${y + 24}) rotate(${rand(`nr${i}`, -8, 8)}) scale(${p}) translate(${-24} ${-24})`}>
            <rect width={48} height={50} fill={col} stroke={ink} strokeWidth={3} />
            <path d="M9 22 L39 22 M9 33 L32 33" stroke={alpha(ink, 0.5)} strokeWidth={3} />
            <circle cx={24} cy={6} r={5} fill="#e5484d" stroke={ink} strokeWidth={2} />
          </g>
        );
      })}
      {/* framed growth curve, drawn across the session */}
      <rect x={622} y={86} width={168} height={146} rx={4} fill={mix(pal.card, pal.wall, 0.2)} stroke={ink} strokeWidth={sw} />
      <path d="M646 210 L646 108 M646 210 L770 210" stroke={alpha(ink, 0.6)} strokeWidth={3} />
      <path d="M650 202 C700 202 700 116 766 114" fill="none" stroke={pal.accent} strokeWidth={7} strokeLinecap="round" pathLength={1} strokeDasharray={1} strokeDashoffset={1 - Math.max(0.04, t)} />
      {/* wall clock showing the beat's time */}
      <circle cx={890} cy={150} r={56} fill={mix(pal.card, '#ffffff', 0.4)} stroke={ink} strokeWidth={sw} />
      {Array.from({length: 12}, (_, i) => <line key={i} x1={890 + Math.sin((i * Math.PI) / 6) * 44} y1={150 - Math.cos((i * Math.PI) / 6) * 44} x2={890 + Math.sin((i * Math.PI) / 6) * 50} y2={150 - Math.cos((i * Math.PI) / 6) * 50} stroke={ink} strokeWidth={3} />)}
      <line x1={890} y1={150} x2={890} y2={122} stroke={ink} strokeWidth={7} strokeLinecap="round" transform={`rotate(${((mins / 60) % 12) * 30} 890 150)`} />
      <line x1={890} y1={150} x2={890} y2={108} stroke={pal.accent} strokeWidth={4} strokeLinecap="round" transform={`rotate(${(mins % 60) * 6} 890 150)`} />
      <circle cx={890} cy={150} r={5} fill={ink} />
      {/* shelf */}
      <path d="M820 300 L995 300" stroke={ink} strokeWidth={10} strokeLinecap="round" />
      {[[832, 52, '#e56b6f'], [856, 64, '#6c9bd2'], [880, 46, '#f2c14e'], [902, 58, '#8fcfc0']].map(([x, h, c], i) => <rect key={i} x={x as number} y={295 - (h as number)} width={20} height={h as number} fill={look ? mix(c as string, pal.wall, 0.35) : (c as string)} stroke={ink} strokeWidth={3} />)}
      <path d="M940 295 L946 268 L976 268 L982 295 Z" fill={pal.cork} stroke={ink} strokeWidth={3} />
      <path d="M961 268 Q950 240 938 236 M961 268 Q966 238 982 232" stroke={mix('#4f9a5a', ink, 0.2)} strokeWidth={5} fill="none" strokeLinecap="round" />
      {/* desk lamp */}
      <ellipse cx={165} cy={686} rx={42} ry={10} fill={pal.monitor} stroke={ink} strokeWidth={4} />
      <path d="M165 684 L192 566 L248 526" fill="none" stroke={ink} strokeWidth={13} strokeLinecap="round" strokeLinejoin="round" />
      <path d="M165 684 L192 566 L248 526" fill="none" stroke={pal.monitor} strokeWidth={6} strokeLinecap="round" strokeLinejoin="round" />
      <path d="M232 504 L294 530 L276 568 L216 540 Z" fill={pal.wall2} stroke={ink} strokeWidth={5} strokeLinejoin="round" />
      {/* mug with steam */}
      {[0, 1, 2].map(i => {
        const c = ((frame + i * 20) % 60) / 60;
        return <path key={i} d={`M${244 + i * 10} ${636 - c * 50} q6 -10 0 -20 q-6 -10 0 -20`} fill="none" stroke={alpha(ink, 0.35)} strokeWidth={3} strokeLinecap="round" opacity={Math.sin(c * Math.PI)} />;
      })}
      <path d="M268 650 q20 0 20 16 q0 16 -20 16" fill="none" stroke={ink} strokeWidth={5} />
      <rect x={230} y={642} width={40} height={42} rx={5} fill="#e56b9b" stroke={ink} strokeWidth={4} />
      {/* character */}
      <g transform={`translate(430 700) scale(${sx} ${sy}) translate(-430 -700)`}>
        <rect x={298} y={440} width={264} height={262} rx={20} fill={pal.body} stroke={ink} strokeWidth={sw + 1} />
        <rect x={312} y={452} width={236} height={22} rx={10} fill={alpha('#ffffff', 0.16)} />
        <Face mood={mood} blink={blink} pal={pal} />
        {earned.slice(-3).map(({b, i}) => {
          const slot = SLOTS[earned.findIndex(e => e.i === i) % 3];
          const p = progress(frame, beatStart(i) + 8, 12, ease.overshoot);
          return (
            <g key={i} transform={`translate(${slot.x} ${slot.y}) rotate(${slot.r + (1 - p) * 22}) scale(${1.8 - 0.8 * p})`} opacity={Math.min(1, p * 3)}>
              <path d="M-158 -22 L158 -22 L146 0 L158 22 L-158 22 L-146 0 Z" fill={pal.ribbon} stroke={ink} strokeWidth={4} strokeLinejoin="round" />
              <text x={0} y={9} textAnchor="middle" fontFamily={fonts.heavy} fontSize={24} letterSpacing="0.08em" fill={pal.face}>{b.sticker.toUpperCase()}</text>
            </g>
          );
        })}
      </g>
      {/* mood marks */}
      {mood === 'confused' || mood === 'frustrated' ? (
        <text x={318} y={432 + Math.sin(frame / 6) * 4} fontFamily={fonts.heavy} fontSize={84} fill={pal.accent} stroke={ink} strokeWidth={4} paintOrder="stroke" transform={`translate(340 400) rotate(-12) scale(${markIn}) translate(-340 -400)`}>{mood === 'confused' ? '?' : '!'}</text>
      ) : null}
      {mood === 'sleepy' ? [0, 1, 2].map(i => {
        const c = ((frame + i * 22) % 66) / 66;
        return <text key={i} x={340 - c * 40 - i * 6} y={436 - c * 90} fontFamily={fonts.heavy} fontSize={30 + i * 10} fill={pal.accent} stroke={ink} strokeWidth={3} paintOrder="stroke" opacity={Math.sin(c * Math.PI) * markIn}>z</text>;
      }) : null}
      {mood === 'proud' ? [[300, 430, 22], [580, 410, 28], [600, 500, 16]].map(([x, y, r], i) => <path key={i} d={sparkle(x, y, r * markIn * (0.75 + 0.25 * Math.sin(frame / 5 + i * 2)))} fill="#ffe27a" stroke={ink} strokeWidth={3} />) : null}
      {/* arms */}
      {hands.map(([hx, hy], i) => {
        const [sx0, sy0] = shoulders[i];
        const dir = i === 0 ? -1 : 1;
        const d = `M${sx0} ${sy0} Q${(sx0 + hx) / 2 + dir * 46} ${(sy0 + hy) / 2 + 26} ${hx} ${hy}`;
        return (
          <g key={i}>
            <path d={d} fill="none" stroke={ink} strokeWidth={24} strokeLinecap="round" />
            <path d={d} fill="none" stroke={pal.body} strokeWidth={12} strokeLinecap="round" />
            <circle cx={hx} cy={hy} r={15} fill={pal.body} stroke={ink} strokeWidth={5} />
          </g>
        );
      })}
      {/* monitor */}
      <rect x={735} y={620} width={30} height={52} fill={pal.monitor} stroke={ink} strokeWidth={5} />
      <rect x={690} y={668} width={120} height={16} rx={6} fill={pal.monitor} stroke={ink} strokeWidth={5} />
      <rect x={600} y={400} width={300} height={224} rx={12} fill={pal.monitor} stroke={ink} strokeWidth={sw} />
      {/* desk */}
      <rect x={358} y={662} width={204} height={22} rx={5} fill={mix(pal.card, '#cfd3da', 0.5)} stroke={ink} strokeWidth={4} />
      <path d={Array.from({length: 9}, (_, i) => `M${376 + i * 21} 673 L${386 + i * 21} 673`).join(' ')} stroke={alpha(ink, 0.45)} strokeWidth={4} strokeLinecap="round" />
      <rect x={80} y={708} width={840} height={228} fill={pal.deskDark} stroke={ink} strokeWidth={sw} />
      <rect x={48} y={682} width={904} height={32} rx={8} fill={pal.desk} stroke={ink} strokeWidth={sw} />
      {[110, 700].map(x => <g key={x}><rect x={x} y={742} width={190} height={80} rx={6} fill={pal.desk} stroke={ink} strokeWidth={4} /><rect x={x + 75} y={776} width={40} height={10} rx={5} fill={ink} /></g>)}
      <rect x={330} y={770} width={340} height={74} rx={8} fill="#e9c768" stroke={ink} strokeWidth={5} />
      <rect x={342} y={780} width={316} height={54} rx={4} fill="none" stroke={alpha(ink, 0.45)} strokeWidth={2} />
      {props.nameplate ? <text x={500} y={818} textAnchor="middle" fontFamily={fonts.serif} fontStyle="italic" fontWeight={700} fontSize={Math.min(32, 620 / Math.max(8, props.nameplate.length))} fill="#3a2a10">{props.nameplate}</text> : null}
      {/* confetti from the monitor on wins */}
      {confetti
        ? Array.from({length: 28}, (_, i) => {
            const c = local - 6 - rand(`cd${cur}${i}`, 0, 6);
            if (c < 0 || c > 60) return null;
            const vx = rand(`cx${cur}${i}`, -9, 9);
            const vy = rand(`cy${cur}${i}`, -19, -8);
            const x = 750 + vx * c;
            const y = 420 + vy * c + 0.5 * 0.7 * c * c;
            return <rect key={i} x={x} y={y} width={12} height={7} fill={[pal.accent, '#ffe27a', '#f7b2c4', '#a6e3d0'][i % 4]} transform={`rotate(${c * rand(`cr${i}`, -14, 14)} ${x + 6} ${y + 3})`} opacity={1 - progress(c, 40, 20)} />;
          })
        : null}
    </svg>
  );

  const [lx, ly] = at(272, 575);
  const nightTint = look ? 0.18 : 0.3;

  return (
    <AbsoluteFill style={{background: pal.wall, overflow: 'hidden'}}>
      {/* room + camera */}
      <AbsoluteFill style={{transformOrigin: `${mx}px ${my}px`, transform: `translate(${(width / 2 - mx) * zk + shake}px, ${(height * 0.45 - my) * zk}px) scale(${zoom})`}}>
        <AbsoluteFill style={{transformOrigin: `${cx}px ${cy}px`, transform: `scale(${push})`}}>
          <div style={{position: 'absolute', left: -width, right: -width, top: stage.y + 0.6 * stage.s, height: 0.335 * stage.s, background: pal.wall2, borderTop: `${6 * k}px solid ${pal.ink}`}} />
          <div style={{position: 'absolute', left: -width, right: -width, top: stage.y + 0.935 * stage.s, height: height * 2, background: pal.floor, borderTop: `${6 * k}px solid ${pal.ink}`}} />
          <div style={{position: 'absolute', left: stage.x + 0.06 * stage.s, width: 0.88 * stage.s, top: stage.y + 0.93 * stage.s, height: 0.05 * stage.s, borderRadius: '50%', background: alpha('#000000', 0.18)}} />
          {room}
          {/* screen overlay */}
          <div style={{position: 'absolute', left: stage.x + 614 * k, top: stage.y + 414 * k, width: 272 * k, height: 196 * k, borderRadius: 6 * k, overflow: 'hidden'}}>
            <Screen beat={beat} local={local} dur={dur} history={history} typed={typed} intro={introText} pal={pal} k={k} />
          </div>
          {/* night falls: the room dims, lamp and screen glow */}
          <AbsoluteFill style={{background: '#1a1f4a', opacity: dark * nightTint, mixBlendMode: 'multiply', pointerEvents: 'none'}} />
          <AbsoluteFill style={{mixBlendMode: 'screen', opacity: Math.max(0, dark - 0.25) * 0.9, background: `radial-gradient(circle at ${lx}px ${ly}px, ${alpha('#ffd98a', 0.55)} 0%, transparent ${stage.s * 0.32}px), radial-gradient(circle at ${mx}px ${my}px, ${alpha(pal.screenText, 0.25)} 0%, transparent ${stage.s * 0.3}px)`}} />
        </AbsoluteFill>
      </AbsoluteFill>
      <Particles count={22} color={look ? pal.cardText : '#fff6dc'} opacity={0.22} seed="sdd" speed={0.35} size={[2, 5]} />
      {/* session header */}
      <SessionHeader beats={beats} pal={pal} u={u} side={side} appear={progress(frame, introEnd - 6, 14)} width={width} height={height} />
      {/* the message of each beat */}
      <SceneSeries
        media={media}
        overlap={12}
        transition="blur"
        renderScene={({index}) => {
          const b = index - offset;
          if (b < 0 || b >= beats.length) return null;
          return <MessageCard beat={beats[b]} index={b} total={beats.length} typed={typedOf(b)} done={typedOf(b).length >= beats[b].message.length} appear={spring({frame: frame - beatStart(b), fps, config: {damping: 14, stiffness: 160}})} pal={pal} u={u} side={side} squareish={squareish} stage={stage} cast={props.cast} width={width} height={height} />;
        }}
      />
      <LightLeak from={Math.max(0, introEnd - 18)} durationInFrames={Math.round(1.3 * fps)} seed={3} opacity={0.35} />
      {props.showCaptions
        ? timeline.map(tl => (
            <Sequence key={tl.index} from={tl.from} durationInFrames={tl.durationInFrames}>
              <AbsoluteFill style={{justifyContent: 'flex-end', padding: side ? '0 18% 3%' : '0 7% 5%'}}>
                <StyledCaptions scene={tl.scene} variant="box" accent={pal.accent} color="#ffffff" font={fonts.sans} size={(side ? 50 : 54) * u} words={side ? 6 : 4} />
              </AbsoluteFill>
            </Sequence>
          ))
        : null}
      <Vignette strength={0.35} />
      <Grain opacity={0.06} />
      <NarrationTrack media={media} />
      <AdWeave media={media} theme={{background: pal.wall, text: pal.cardText, font: fonts.sans}} />
    </AbsoluteFill>
  );
};

/** "● SESSION LOG   08:00 → 17:00" strip at the top. */
const SessionHeader: React.FC<{beats: Beat[]; pal: Pal; u: number; side: boolean; appear: number; width: number; height: number}> = ({beats, pal, u, side, appear, width, height}) => {
  const frame = useCurrentFrame();
  const first = beats.find(b => b.time)?.time ?? '';
  const last = [...beats].reverse().find(b => b.time)?.time ?? '';
  const textCol = pal.cardText === pal.card ? pal.ink : mix(pal.cardText, pal.wall, 0.15);
  const label: React.CSSProperties = {fontFamily: fonts.mono, fontSize: 24 * u, letterSpacing: '0.24em', color: textCol, display: 'flex', alignItems: 'center', gap: 12 * u};
  return (
    <div style={{position: 'absolute', left: width * (side ? 0.05 : 0.06), right: width * (side ? 0.05 : 0.06), top: height * (side ? 0.05 : 0.035), display: 'flex', justifyContent: 'space-between', opacity: appear, transform: `translateY(${(1 - appear) * -20 * u}px)`}}>
      <div style={label}><span style={{width: 16 * u, height: 16 * u, borderRadius: '50%', background: '#e5484d', opacity: Math.floor(frame / 18) % 2 ? 0.35 : 1}} />SESSION LOG</div>
      {first && last && first !== last ? <div style={label}>{first} → {last}</div> : null}
    </div>
  );
};

const MessageCard: React.FC<{
  beat: Beat; index: number; total: number; typed: string; done: boolean; appear: number; pal: Pal; u: number; side: boolean; squareish: boolean; stage: Rect;
  cast: Props['cast']; width: number; height: number;
}> = ({beat, index, total, typed, done, appear, pal, u, side, squareish, stage, cast, width, height}) => {
  const frame = useCurrentFrame();
  const machine = beat.who === 'machine';
  const bg = machine ? pal.screen : pal.card;
  const fg = machine ? pal.screenText : pal.cardText;
  const len = beat.message.length;
  const fit = squareish ? 0.8 : 1;
  const tall = !side && !squareish;
  const size = (len <= 36 ? (tall ? 78 : 66) : len <= 64 ? (tall ? 62 : 54) : tall ? 52 : 46) * u * fit * (machine ? 0.88 : 1);
  const caret = !done || Math.floor(frame / 15) % 2 === 0;
  const tail = 30 * u;
  const cardX = side ? width * 0.05 : width * 0.06;
  const cardW = side ? Math.min(stage.x - cardX - 50 * u, width * 0.42) : width * 0.88;
  const targetX = stage.x + (machine ? 750 : 430) * (stage.s / 1000);
  const tailX = Math.min(cardW - 60 * u, Math.max(60 * u, targetX - cardX));
  const pos: React.CSSProperties = side
    ? {left: cardX, width: cardW, top: stage.y + stage.s * 0.42, transform: `translateY(-50%) translateY(${(1 - appear) * 40 * u}px) scale(${0.92 + 0.08 * appear})`}
    : {left: cardX, width: cardW, bottom: height - (stage.y + stage.s * 0.075) + tail, transform: `translateY(${(1 - appear) * 40 * u}px) scale(${0.92 + 0.08 * appear})`, transformOrigin: `${tailX}px 100%`};
  const border = `${4 * u}px solid ${pal.ink}`;
  return (
    <AbsoluteFill style={{pointerEvents: 'none'}}>
      <div style={{position: 'absolute', ...pos, opacity: Math.min(1, appear * 2)}}>
        <div style={{position: 'relative', background: bg, color: fg, border, borderRadius: 30 * u, padding: `${26 * u}px ${34 * u}px ${30 * u}px`, boxShadow: `${10 * u}px ${12 * u}px 0 ${alpha(pal.ink, 0.85)}, 0 ${30 * u}px ${70 * u}px rgba(0,0,0,.25)`}}>
          <div style={{display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 * u}}>
            <div style={{display: 'flex', alignItems: 'center', gap: 14 * u, fontFamily: fonts.mono, fontWeight: 700, fontSize: 24 * u * fit, letterSpacing: '0.18em', textTransform: 'uppercase', color: alpha(fg, 0.75)}}>
              {machine ? (
                <div style={{width: 44 * u, height: 34 * u, borderRadius: 6 * u, background: pal.monitor, border: `${3 * u}px solid ${pal.ink}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 15 * u, color: pal.screenText, letterSpacing: 0}}>{'>_'}</div>
              ) : (
                <div style={{width: 40 * u, height: 40 * u, borderRadius: 9 * u, background: pal.body, border: `${3 * u}px solid ${pal.ink}`, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 * u}}>
                  <div style={{width: 6 * u, height: 8 * u, borderRadius: 3 * u, background: pal.face}} />
                  <div style={{width: 6 * u, height: 8 * u, borderRadius: 3 * u, background: pal.face}} />
                </div>
              )}
              {machine ? cast.machine : cast.human}
            </div>
            {beat.time ? <div style={{fontFamily: fonts.mono, fontWeight: 700, fontSize: 24 * u * fit, padding: `${6 * u}px ${14 * u}px`, borderRadius: 999, background: pal.accent, color: '#111111', border: `${3 * u}px solid ${pal.ink}`}}>{beat.time}</div> : null}
          </div>
          <div style={{fontFamily: machine ? fonts.mono : fonts.sans, fontWeight: machine ? 700 : 800, fontSize: size, lineHeight: 1.16, letterSpacing: machine ? '-0.01em' : '-0.015em'}}>
            {machine ? <span style={{color: pal.accent}}>{'$ '}</span> : null}
            {typed}
            <span style={{display: 'inline-block', width: 0, overflow: 'visible'}}><span style={{opacity: caret ? 1 : 0, color: pal.accent, marginLeft: 2 * u}}>▍</span></span>
            <span style={{color: 'transparent'}}>{beat.message.slice(typed.length)}</span>
          </div>
          <div style={{display: 'flex', gap: 8 * u, marginTop: 20 * u}}>
            {Array.from({length: total}, (_, i) => (
              <div key={i} style={{height: 8 * u, flex: i === index ? 3 : 1, borderRadius: 4 * u, background: i <= index ? pal.accent : alpha(fg, 0.15)}} />
            ))}
          </div>
          {/* bubble tail toward the speaker */}
          <div style={side
            ? {position: 'absolute', right: -tail / 2 - 2 * u, top: '50%', width: tail, height: tail, marginTop: -tail / 2, background: bg, borderTop: border, borderRight: border, transform: 'rotate(45deg)'}
            : {position: 'absolute', bottom: -tail / 2 - 2 * u, left: tailX - tail / 2, width: tail, height: tail, background: bg, borderBottom: border, borderRight: border, transform: 'rotate(45deg)'}} />
        </div>
      </div>
    </AbsoluteFill>
  );
};

export default defineEntry({id: 'story-dev-session-diary', schema: Props, component: SessionDiary});
