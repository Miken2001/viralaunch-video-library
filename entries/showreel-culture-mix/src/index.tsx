import React from 'react';
import {AbsoluteFill, Sequence, spring, useCurrentFrame, useVideoConfig} from 'remotion';
import {AdWeave, NarrationTrack, captionSafeBottom, defineEntry, mix, useContentFrames, useLook, useSceneTimeline, type ActiveLook, type EntryProps, type TimedScene} from '@viralaunch/kit';
import {CameraImage, Grain, KineticText, LightLeak, LineIcon, Particles, SceneSeries, StyledCaptions, Vignette, alpha, ease, fonts, progress, rand, tween, type RevealStyle, type Widen} from '@viralaunch/kit/fx';
import {Props, type Item, type Kind} from './schema';

const PALETTES = {
  lagoon: {bg: '#04202a', bg2: '#0c5767', surface: '#0a1d24', text: '#effcff', muted: '#8fb8c2', accent: '#3ee6f0', orbs: ['#d2fcff', '#2fcde4', '#0a3f86'], hue: 160},
  noir: {bg: '#04060a', bg2: '#0c1a27', surface: '#0f141b', text: '#f2f7fb', muted: '#8a97a6', accent: '#35d6f5', orbs: ['#d6fbff', '#38c6ec', '#0b3a74'], hue: 170},
  coral: {bg: '#1c0807', bg2: '#5a1d17', surface: '#210f0d', text: '#fff3ee', muted: '#d0a49a', accent: '#ff7a59', orbs: ['#ffe2d2', '#ff875a', '#8f1b2b'], hue: 0},
  violet: {bg: '#0c071e', bg2: '#33206b', surface: '#160f2e', text: '#f5f1ff', muted: '#a99cd0', accent: '#b388ff', orbs: ['#f1e8ff', '#9d78ff', '#341a86'], hue: 230},
} as const;
type Pal = Widen<Omit<(typeof PALETTES)[keyof typeof PALETTES], 'hue'>> & {hue: number; onAccent: string; light: boolean; ink: string};

const onAccent = (hex: string) => {
  const n = parseInt(hex.slice(1), 16);
  return 0.299 * ((n >> 16) & 255) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255) > 150 ? '#0b0b0b' : '#ffffff';
};

/** The reel in a sequence's shared look: backdrop, orbs, card panels and accent follow the look. */
const fromLook = (l: ActiveLook): Pal => {
  const p = l.palette;
  const light = l.tone === 'light';
  return {
    bg: p.bg,
    bg2: p.bg2,
    surface: p.surface,
    text: p.text,
    muted: p.muted,
    accent: p.accent,
    orbs: light ? [mix('#ffffff', p.accent, 0.25), mix(p.accent, p.bg2, 0.15), mix(p.accent, p.line, 0.45)] : [mix('#ffffff', p.accent, 0.3), p.accent, mix(p.accent, p.bg, 0.6)],
    hue: 20,
    onAccent: onAccent(p.accent),
    light,
    ink: light ? p.line : p.bg,
  };
};

/** Per-kind art colour, icon, word face and reveal. */
const KIND: Record<Kind, {color: string; icon: string; font: keyof typeof fonts; italic?: boolean; reveal: RevealStyle; label: string}> = {
  film: {color: '#3a6df0', icon: 'camera', font: 'serif', reveal: 'blur', label: 'Film'},
  series: {color: '#8b5cf6', icon: 'star', font: 'serifDisplay', reveal: 'rise', label: 'Series'},
  music: {color: '#ec4899', icon: 'music', font: 'poster', reveal: 'pop', label: 'Music'},
  game: {color: '#22b866', icon: 'target', font: 'heavy', reveal: 'pop', label: 'Game'},
  book: {color: '#e0901a', icon: 'book', font: 'serif', italic: true, reveal: 'blur', label: 'Book'},
  art: {color: '#e04848', icon: 'spark', font: 'hand', reveal: 'rise', label: 'Art'},
  podcast: {color: '#0fb5cc', icon: 'chat', font: 'grotesk', reveal: 'rise', label: 'Podcast'},
  event: {color: '#d9a50b', icon: 'flag', font: 'condensed', reveal: 'pop', label: 'Event'},
};

/** Card design size; every card is drawn at this size and scaled into place. */
const CW = 600;
const CH = 1067;
const ART_H = 850;
const pad2 = (n: number) => String(n).padStart(2, '0');

/** Kind-specific drawn motif for cards without an image (explicit shapes, no tiled patterns). */
const Motif: React.FC<{kind: Kind; f: number; color: string; seed: number}> = ({kind, f, color, seed}) => {
  const c = alpha(color, 0.5);
  if (kind === 'film') {
    const o = (f * 2.4) % 64;
    return (
      <>
        {Array.from({length: 15}, (_, i) => [16, CW - 40].map(x => <rect key={`${i}${x}`} x={x} y={i * 64 - o} width={24} height={36} rx={6} fill={c} />))}
        <circle cx={CW / 2} cy={330} r={170 + Math.sin(f / 14) * 6} fill="none" stroke={c} strokeWidth={3} />
      </>
    );
  }
  if (kind === 'series') {
    return (
      <>
        {[0, 1, 2].map(i => (
          <rect key={i} x={110 + i * 34 + Math.sin(f / 20 + i) * 8} y={150 + i * 40} width={300} height={200} rx={22} fill={alpha('#ffffff', 0.05 + i * 0.03)} stroke={c} strokeWidth={3} />
        ))}
      </>
    );
  }
  if (kind === 'music') {
    return (
      <>
        {Array.from({length: 14}, (_, i) => {
          const h = 60 + 200 * Math.abs(Math.sin(f / (6 + (i % 4)) + i * 1.7)) * (0.5 + 0.5 * rand(`m${seed}${i}`));
          return <rect key={i} x={40 + i * 38} y={ART_H - 90 - h} width={24} height={h} rx={12} fill={c} />;
        })}
      </>
    );
  }
  if (kind === 'game') {
    return (
      <>
        {Array.from({length: 16}, (_, i) => {
          const x = rand(`gx${seed}${i}`, 30, CW - 70);
          const y = ((rand(`gy${seed}${i}`, 0, ART_H) - f * rand(`gv${seed}${i}`, 0.6, 1.6)) % ART_H + ART_H) % ART_H;
          const s = rand(`gs${seed}${i}`, 18, 46);
          return <rect key={i} x={x} y={y} width={s} height={s} rx={4} fill={i % 3 ? c : alpha('#ffffff', 0.35)} transform={`rotate(${f * 1.5 + i * 20} ${x + s / 2} ${y + s / 2})`} />;
        })}
      </>
    );
  }
  if (kind === 'book') {
    return (
      <>
        {Array.from({length: 11}, (_, i) => {
          const w = tween(f, [i * 3, i * 3 + 24], [0, rand(`bw${seed}${i}`, 260, 460)], ease.snappy);
          return <rect key={i} x={70} y={120 + i * 46} width={w} height={10} rx={5} fill={c} />;
        })}
      </>
    );
  }
  if (kind === 'art') {
    return (
      <>
        {Array.from({length: 5}, (_, i) => (
          <circle key={i} cx={rand(`ax${seed}${i}`, 80, CW - 80) + Math.sin(f / 30 + i) * 20} cy={rand(`ay${seed}${i}`, 120, ART_H - 160) + Math.cos(f / 26 + i) * 16} r={rand(`ar${seed}${i}`, 60, 140)} fill={alpha(i % 2 ? '#ffffff' : color, 0.22)} />
        ))}
        <rect x={60} y={80} width={CW - 120} height={ART_H - 220} rx={8} fill="none" stroke={c} strokeWidth={6} />
      </>
    );
  }
  if (kind === 'podcast') {
    return (
      <>
        {Array.from({length: 6}, (_, i) => {
          const r = ((f * 2.2 + i * 70) % 420) + 20;
          return <circle key={i} cx={CW / 2} cy={330} r={r} fill="none" stroke={color} strokeWidth={4} opacity={0.6 * (1 - r / 440)} />;
        })}
      </>
    );
  }
  return (
    <>
      {Array.from({length: 34}, (_, i) => {
        const x = rand(`ex${seed}${i}`, 0, CW) + Math.sin(f / 12 + i) * 14;
        const y = ((rand(`ey${seed}${i}`, -ART_H, ART_H) + f * rand(`ev${seed}${i}`, 1.5, 3.5)) % ART_H + ART_H) % ART_H;
        return <rect key={i} x={x} y={y} width={14} height={26} rx={3} fill={i % 3 === 0 ? '#ffffff' : i % 3 === 1 ? color : alpha('#ffffff', 0.4)} transform={`rotate(${f * 4 + i * 37} ${x + 7} ${y + 13})`} />;
      })}
    </>
  );
};

type CardState = {wordStart: number; drawStart: number; showWord: boolean; shine: number};

/** One culture card: art (scene image or drawn motif), counter, brand mark, big word, info panel. */
const Card: React.FC<{item: Item; index: number; total: number; pal: Pal; brand: string; image: string; isStatic: boolean; state: CardState}> = ({item, index, total, pal, brand, image, isStatic, state}) => {
  const frame = useCurrentFrame();
  const k = KIND[item.kind];
  const art = mix(mix(k.color, pal.bg2, 0.35), pal.light ? pal.ink : '#000000', pal.light ? 0.12 : 0.25);
  const draw = progress(frame, state.drawStart, 34, ease.cinematic);
  const wordSize = Math.min(150, 880 / Math.max(4, item.word.length));
  const pulse = 0.55 + 0.45 * Math.abs(Math.sin(frame / 9));
  return (
    <div style={{width: CW, height: CH, borderRadius: 40, overflow: 'hidden', background: pal.surface, boxShadow: `0 50px 120px ${alpha('#000000', pal.light ? 0.28 : 0.55)}, inset 0 0 0 2px ${alpha(pal.text, 0.12)}`, position: 'relative'}}>
      <div style={{position: 'absolute', left: 0, top: 0, width: CW, height: ART_H, overflow: 'hidden', background: `linear-gradient(165deg, ${mix(art, '#ffffff', 0.12)} 0%, ${art} 55%, ${mix(art, '#000000', 0.35)} 100%)`}}>
        {image ? (
          <CameraImage src={image} isStatic={isStatic} move="push" />
        ) : (
          <>
            <svg width={CW} height={ART_H} style={{position: 'absolute', inset: 0}}>
              <Motif kind={item.kind} f={frame} color={mix(k.color, '#ffffff', 0.35)} seed={index} />
            </svg>
            <div style={{position: 'absolute', left: CW / 2 - 150, top: 180, opacity: 0.85}}>
              <LineIcon name={k.icon} progress={draw} size={300} color={alpha('#ffffff', 0.55)} strokeWidth={2.6} />
            </div>
          </>
        )}
        <div style={{position: 'absolute', inset: 0, background: 'linear-gradient(180deg, rgba(0,0,0,.35) 0%, transparent 22%, transparent 50%, rgba(0,0,0,.5) 100%)'}} />
        <div style={{position: 'absolute', left: 30, top: 28, fontFamily: fonts.mono, fontSize: 22, letterSpacing: '0.16em', color: '#ffffff', opacity: 0.85}}>
          {pad2(index + 1)}/{pad2(total)}
        </div>
        <div style={{position: 'absolute', right: 30, top: 22, fontFamily: fonts.heavy, fontStyle: 'italic', fontSize: 26, color: '#ffffff', textTransform: 'uppercase', letterSpacing: '0.02em', textShadow: '0 2px 10px rgba(0,0,0,.5)'}}>{brand}</div>
        {state.showWord ? (
          <div style={{position: 'absolute', left: 30, right: 30, top: ART_H * 0.62 - wordSize / 2}}>
            <KineticText text={item.word} start={state.wordStart} stagger={4} duration={20} style={k.reveal} align="center" textStyle={{fontFamily: fonts[k.font], fontStyle: k.italic ? 'italic' : undefined, fontSize: wordSize, lineHeight: 1.05, color: '#ffffff', textShadow: '0 6px 30px rgba(0,0,0,.6), 0 2px 6px rgba(0,0,0,.5)', whiteSpace: 'nowrap'}} />
          </div>
        ) : null}
        {/* light sweep when the card takes the stage */}
        <div style={{position: 'absolute', inset: 0, background: 'linear-gradient(105deg, transparent 35%, rgba(255,255,255,.28) 50%, transparent 65%)', transform: `translateX(${(state.shine * 2 - 1) * 110}%)`, opacity: state.shine > 0 && state.shine < 1 ? 1 : 0}} />
      </div>
      <div style={{position: 'absolute', left: 0, right: 0, top: ART_H, bottom: 0, padding: '26px 32px', fontFamily: fonts.sans, color: pal.text}}>
        <div style={{fontSize: 36, fontWeight: 800, lineHeight: 1.1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis'}}>{item.title}</div>
        <div style={{display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 20, gap: 16}}>
          <div style={{display: 'flex', alignItems: 'center', gap: 12, fontSize: 24, fontWeight: 700, color: pal.accent, whiteSpace: 'nowrap'}}>
            <div style={{width: 14, height: 14, borderRadius: 7, background: pal.accent, opacity: pulse, boxShadow: `0 0 12px ${alpha(pal.accent, 0.8)}`}} />
            {item.status || k.label}
          </div>
          <div style={{fontFamily: fonts.mono, fontSize: 21, color: pal.muted, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis'}}>{item.meta}</div>
        </div>
      </div>
    </div>
  );
};

/** Glossy floating spheres with parallax (the backdrop of the reel). */
const Orbs: React.FC<{pal: Pal; shift: number}> = ({pal, shift}) => {
  const frame = useCurrentFrame();
  const {width, height} = useVideoConfig();
  const m = Math.min(width, height);
  const spots = [
    {x: 0.06, y: 0.06, s: 0.3, d: 0.6},
    {x: 0.95, y: 0.24, s: 0.22, d: 0.9},
    {x: 0.0, y: 0.62, s: 0.38, d: 1.3},
    {x: 0.97, y: 0.74, s: 0.18, d: 0.7},
    {x: 0.06, y: 0.98, s: 0.13, d: 0.4},
    {x: 0.93, y: 0.99, s: 0.1, d: 0.3},
    {x: 0.97, y: 0.47, s: 0.06, d: 1.6},
  ];
  const [hi, mid, lo] = pal.orbs;
  return (
    <AbsoluteFill style={{pointerEvents: 'none'}}>
      {spots.map((o, i) => {
        const size = o.s * m * (width > height ? 1.15 : 1);
        const x = o.x * width - size / 2 + Math.sin(frame / 50 + i * 2) * 14 - shift * width * 0.05 * o.d;
        const y = o.y * height - size / 2 + Math.cos(frame / 60 + i) * 18;
        return (
          <div key={i} style={{position: 'absolute', left: x, top: y, width: size, height: size, borderRadius: '50%', background: `radial-gradient(circle at 32% 28%, ${hi} 0%, ${mid} 36%, ${lo} 82%)`, boxShadow: `0 ${size * 0.12}px ${size * 0.3}px ${alpha(lo, 0.45)}`, filter: o.d < 0.5 ? 'blur(3px)' : o.d > 1.2 ? 'blur(2px)' : undefined, opacity: pal.light ? 0.85 : 1}} />
        );
      })}
    </AbsoluteFill>
  );
};

type Plan = {hasIntro: boolean; hasWall: boolean; introEnd: number; starts: number[]; wallStart: number; images: {src: string; isStatic: boolean}[]};

/** Maps items onto narration scenes (one per scene, optional intro and wall scenes) or spreads them evenly inside fewer scenes. */
function plan(timeline: TimedScene[], n: number, contentEnd: number, fps: number): Plan {
  const S = timeline.length;
  if (S >= n) {
    const hasIntro = S > n;
    const hasWall = S > n + 1;
    const off = hasIntro ? 1 : 0;
    return {
      hasIntro,
      hasWall,
      introEnd: hasIntro ? timeline[1].from : 0,
      starts: Array.from({length: n}, (_, i) => timeline[i + off].from),
      wallStart: hasWall ? Math.min(timeline[n + off].from, contentEnd - Math.round(1.2 * fps)) : Infinity,
      images: Array.from({length: n}, (_, i) => ({src: timeline[i + off].scene.video, isStatic: timeline[i + off].scene.isStaticImage})),
    };
  }
  const introEnd = Math.round(Math.min(1.6 * fps, contentEnd * 0.15));
  const wallStart = Math.round(contentEnd - Math.min(2.6 * fps, contentEnd * 0.22));
  const per = (wallStart - introEnd) / n;
  return {hasIntro: true, hasWall: true, introEnd, starts: Array.from({length: n}, (_, i) => Math.round(introEnd + i * per)), wallStart, images: Array.from({length: n}, () => ({src: '', isStatic: true}))};
}

const CultureMix: React.FC<EntryProps<Props>> = ({media, props}) => {
  const frame = useCurrentFrame();
  const {fps, width, height} = useVideoConfig();
  const look = useLook();
  const own = PALETTES[props.palette];
  const pal: Pal = look ? fromLook(look) : {...own, accent: media.accent ?? own.accent, onAccent: onAccent(media.accent ?? own.accent), light: false, ink: own.bg};
  const u = Math.min(width, height) / 1080;
  const portrait = height >= width;
  const landscape = width > height * 1.2;
  const timeline = useSceneTimeline(media);
  const contentEnd = useContentFrames(media);
  const items = props.items;
  const n = items.length;
  const p = plan(timeline, n, contentEnd, fps);
  const T = Math.round(0.55 * fps);

  // Layout: card column between the top chips and the caption zone.
  const bottomFrac = look ? captionSafeBottom(look) : props.showCaptions ? (portrait ? 0.17 : 0.2) : 0.06;
  const top = height * (portrait ? 0.13 : 0.15);
  const bottom = height * (1 - bottomFrac);
  const cardH = Math.min(bottom - top - height * 0.03, (portrait ? width * 0.66 : width * 0.3) * (16 / 9));
  const cardW = cardH * (9 / 16);
  const cy = (top + bottom) / 2 + height * 0.01;
  const base = cardW / CW;

  // Choreography: intro fan → carousel → closing wall.
  const toCarousel = p.hasIntro ? progress(frame, p.introEnd - T / 2, T, ease.cinematic) : 1;
  const toWall = p.hasWall ? progress(frame, p.wallStart - T / 2, T, ease.cinematic) : 0;
  const cur = p.starts.slice(1).reduce((acc, s) => acc + progress(frame, s - T / 2, T, ease.cinematic), 0);
  const active = Math.max(0, Math.min(n - 1, Math.round(cur)));

  // Wall grid.
  const rows = n <= (landscape ? 5 : 3) ? 1 : 2;
  const cols = Math.ceil(n / rows);
  const wallTop = height * (portrait ? 0.26 : 0.3);
  const wallBottom = bottom - height * (portrait ? 0.09 : 0.13);
  const wallScale = Math.min((width * 0.9) / (cols * CW * 1.08), (wallBottom - wallTop) / (rows * CH * 1.08));
  const wallPan = Math.sin(frame / 45) * 10 * u;

  // Intro fan.
  const fanScale = base * (portrait ? 0.42 : 0.55);
  const fanY = Math.min(height * (portrait ? 0.6 : 0.64), bottom - (CH * fanScale) / 2 - 20 * u);

  const kinds = items.map(i => i.kind).filter((k, i, a) => a.indexOf(k) === i);
  const chipsIn = toCarousel * (1 - toWall);
  const titleFont = look ? look.font.display : fonts.heavy;

  const cards = items.map((item, i) => {
    // carousel pose
    const rel = i - cur;
    const ar = Math.abs(rel);
    const spacing = cardW * 0.5 + cardW * 0.7 * 0.5 + 34 * u + (landscape ? cardW * 0.12 : 0);
    const cS = base * (1 - Math.min(1, ar) * 0.3 - Math.max(0, ar - 1) * 0.12);
    const c = {x: width / 2 + rel * spacing, y: cy + Math.min(1.5, ar) * 24 * u + Math.sin(frame / 22) * 6 * u * Math.max(0, 1 - ar), s: cS, ry: -Math.max(-1.5, Math.min(1.5, rel)) * 26, rz: 0, o: Math.max(0, 1 - Math.max(0, ar - 1.2) * 0.8)};
    // fan pose
    const mid = (n - 1) / 2;
    const pop = spring({frame: frame - 6 - i * 4, fps, config: {damping: 14, stiffness: 140}});
    const fanStep = n > 1 ? Math.min(CW * fanScale * 0.62, (width * 0.84 - CW * fanScale) / (n - 1)) : 0;
    const fan = {x: width / 2 + (i - mid) * fanStep, y: fanY + Math.pow(i - mid, 2) * 14 * u + (1 - pop) * height * 0.4, s: fanScale, ry: 0, rz: (i - mid) * 8, o: Math.min(1, pop * 2)};
    // wall pose
    const r = Math.floor(i / cols);
    const inRow = r === rows - 1 ? n - cols * (rows - 1) : cols;
    const col = i - r * cols;
    const wallIn = p.hasWall ? progress(frame, p.wallStart - T / 2 + i * 2, T, ease.cinematic) : 0;
    const w = {x: width / 2 + (col - (inRow - 1) / 2) * CW * wallScale * 1.08 + wallPan, y: wallTop + (r + 0.5) * CH * wallScale * 1.08, s: wallScale, ry: 0, rz: 0, o: 1};
    const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
    const ab = (key: keyof typeof c) => lerp(lerp(fan[key], c[key], toCarousel), w[key], wallIn);
    const pose = {x: ab('x'), y: ab('y'), s: ab('s'), ry: ab('ry'), rz: ab('rz'), o: ab('o')};
    const start = p.starts[i];
    const shown = frame >= start - T / 2 || toWall > 0;
    const state: CardState = {wordStart: start + Math.round(T * 0.4), drawStart: p.hasIntro ? 6 + i * 4 : start - T, showWord: shown, shine: progress(frame, start - 2, Math.round(0.8 * fps), ease.cinematic)};
    const dim = toWall > 0 ? 0 : Math.min(1, ar) * 0.45 * toCarousel;
    return {i, z: toWall > 0.5 ? i : -Math.round(ar * 10), pose, state, dim, item};
  });

  return (
    <AbsoluteFill style={{background: `linear-gradient(160deg, ${pal.bg2} 0%, ${pal.bg} 70%)`, overflow: 'hidden'}}>
      <AbsoluteFill style={{background: `radial-gradient(circle at 50% ${(cy / height) * 100}%, ${alpha(pal.accent, pal.light ? 0.2 : 0.16)} 0%, transparent 55%)`}} />
      {/* per-scene aura: the scene image (blurred) or the item colour bleeds into the backdrop */}
      <SceneSeries
        media={media}
        transition="blur"
        overlap={T}
        renderScene={({timed}) => {
          const item = items[Math.max(0, Math.min(n - 1, timed.index - (p.hasIntro && timeline.length >= n ? 1 : 0)))];
          const tint = KIND[item.kind].color;
          return (
            <AbsoluteFill>
              {timed.scene.video ? (
                <AbsoluteFill style={{filter: 'blur(50px) saturate(1.2)', opacity: pal.light ? 0.25 : 0.35}}>
                  <CameraImage src={timed.scene.video} isStatic={timed.scene.isStaticImage} move="still" />
                </AbsoluteFill>
              ) : null}
              <AbsoluteFill style={{background: `radial-gradient(ellipse 60% 45% at 50% ${(cy / height) * 100}%, ${alpha(tint, pal.light ? 0.16 : 0.22)} 0%, transparent 70%)`}} />
            </AbsoluteFill>
          );
        }}
      />
      <Orbs pal={pal} shift={((cur + toWall) / n) * 2} />
      {/* orbit ring around the stage */}
      <AbsoluteFill style={{pointerEvents: 'none', opacity: chipsIn}}>
        {(() => {
          const R = cardH * 0.62;
          const a = frame / 40;
          return (
            <>
              <div style={{position: 'absolute', left: width / 2 - R, top: cy - R, width: R * 2, height: R * 2, borderRadius: '50%', border: `2px solid ${alpha(pal.text, 0.12)}`}} />
              <div style={{position: 'absolute', left: width / 2 + Math.cos(a) * R - 18 * u, top: cy + Math.sin(a) * R - 18 * u, width: 36 * u, height: 36 * u, borderRadius: '50%', background: `radial-gradient(circle at 32% 28%, ${pal.orbs[0]}, ${pal.orbs[1]} 45%, ${pal.orbs[2]})`}} />
            </>
          );
        })()}
      </AbsoluteFill>
      <Particles count={36} color={pal.light ? pal.accent : pal.text} opacity={0.3} seed="mix" speed={0.4} size={[1.5, 4]} />

      {/* intro title */}
      {p.hasIntro ? (
        <AbsoluteFill style={{opacity: 1 - toCarousel, transform: `translateY(${-toCarousel * 60 * u}px)`, alignItems: 'center', paddingTop: height * (portrait ? 0.16 : 0.1)}}>
          <div style={{fontFamily: fonts.mono, color: pal.light ? pal.muted : pal.accent, fontSize: 28 * u, letterSpacing: '0.35em', textTransform: 'uppercase', opacity: progress(frame, 0, 14), marginBottom: 22 * u}}>
            {props.brandName} · {n} picks
          </div>
          <KineticText text={props.title} start={4} stagger={4} style="pop" align="center" accent={pal.accent} textStyle={{fontFamily: titleFont, color: pal.text, fontSize: (portrait ? 104 : 86) * u, lineHeight: 1.0, letterSpacing: '-0.02em', padding: '0 8%', maxWidth: width}} />
        </AbsoluteFill>
      ) : null}

      {/* kind chips (or the title when there is no intro scene) */}
      <AbsoluteFill style={{alignItems: 'center', paddingTop: height * (portrait ? 0.055 : 0.04), opacity: chipsIn}}>
        {!p.hasIntro && frame < (p.starts[1] ?? Infinity) - T ? (
          <KineticText text={props.title} start={2} stagger={3} style="rise" align="center" accent={pal.accent} textStyle={{fontFamily: titleFont, color: pal.text, fontSize: (portrait ? 64 : 54) * u, lineHeight: 1.05, padding: '0 8%', maxWidth: width}} />
        ) : (
          <div style={{display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: 14 * u, padding: '0 6%'}}>
            {kinds.map((kd, j) => {
              const on = items[active].kind === kd;
              const inP = progress(frame, (p.hasIntro ? p.introEnd - T / 2 : 0) + j * 3, 14, ease.overshoot);
              return (
                <div key={kd} style={{display: 'flex', alignItems: 'center', gap: 10 * u, padding: `${12 * u}px ${24 * u}px`, borderRadius: 999, fontFamily: fonts.sans, fontWeight: 700, fontSize: 26 * u, color: on ? pal.onAccent : pal.text, background: on ? pal.accent : alpha(pal.text, pal.light ? 0.08 : 0.1), border: `1.5px solid ${on ? pal.accent : alpha(pal.text, 0.2)}`, transform: `scale(${inP * (on ? 1.06 : 1)})`, boxShadow: on ? `0 0 30px ${alpha(pal.accent, 0.45)}` : 'none'}}>
                  <LineIcon name={KIND[kd].icon} size={26 * u} color={on ? pal.onAccent : pal.text} strokeWidth={7} />
                  {KIND[kd].label}
                </div>
              );
            })}
          </div>
        )}
      </AbsoluteFill>

      {/* the cards */}
      <AbsoluteFill style={{perspective: 2400 * u}}>
        {[...cards].sort((a, b) => a.z - b.z).map(({i, pose, state, dim, item}) => (
          <div key={i} style={{position: 'absolute', left: pose.x - CW / 2, top: pose.y - CH / 2, width: CW, height: CH, opacity: pose.o, transform: `rotateY(${pose.ry}deg) rotateZ(${pose.rz}deg) scale(${pose.s})`}}>
            <Card item={item} index={i} total={n} pal={pal} brand={props.brandName} image={p.images[i].src} isStatic={p.images[i].isStatic} state={state} />
            {dim > 0.01 ? <div style={{position: 'absolute', inset: 0, borderRadius: 40, background: pal.light ? alpha(pal.bg, dim * 1.2) : alpha('#000000', dim)}} /> : null}
          </div>
        ))}
      </AbsoluteFill>

      {/* closing wall: headline and the pill */}
      {p.hasWall && toWall > 0 ? (
        <AbsoluteFill style={{pointerEvents: 'none'}}>
          <div style={{position: 'absolute', left: 0, right: 0, top: height * (portrait ? 0.1 : 0.08)}}>
            <KineticText text={props.closer || props.title} start={p.wallStart} stagger={4} style="rise" align="center" accent={pal.accent} textStyle={{fontFamily: titleFont, color: pal.text, fontSize: (portrait ? 84 : 70) * u, lineHeight: 1.04, letterSpacing: '-0.01em', padding: '0 8%'}} />
          </div>
          {(() => {
            const pop = spring({frame: frame - p.wallStart - Math.round(0.5 * fps), fps, config: {damping: 12, stiffness: 160}});
            return (
              <div style={{position: 'absolute', left: 0, right: 0, top: wallBottom + height * 0.025, display: 'flex', justifyContent: 'center'}}>
                <div style={{display: 'flex', alignItems: 'center', gap: 16 * u, padding: `${20 * u}px ${42 * u}px`, borderRadius: 999, background: pal.accent, color: pal.onAccent, fontFamily: fonts.sans, fontWeight: 800, fontSize: 40 * u, transform: `scale(${pop})`, boxShadow: `0 0 60px ${alpha(pal.accent, 0.5)}`}}>
                  <LineIcon name="check" progress={progress(frame, p.wallStart + Math.round(0.7 * fps), 14)} size={38 * u} color={pal.onAccent} strokeWidth={10} />
                  {props.tagline || props.brandName}
                </div>
              </div>
            );
          })()}
        </AbsoluteFill>
      ) : null}

      {p.starts.slice(1).map((s, i) => (
        <LightLeak key={i} from={Math.max(0, s - T)} durationInFrames={T * 2} seed={i + 3} hueShift={pal.hue} opacity={pal.light ? 0.35 : 0.6} />
      ))}
      {p.hasWall ? <LightLeak from={Math.max(0, p.wallStart - T)} durationInFrames={T * 2} seed={11} hueShift={pal.hue} opacity={pal.light ? 0.35 : 0.6} /> : null}

      {props.showCaptions
        ? timeline.map(t => (
            <Sequence key={t.index} from={t.from} durationInFrames={t.durationInFrames}>
              <AbsoluteFill style={{justifyContent: 'flex-end', padding: portrait ? `0 7% ${height * 0.055}px` : `0 18% ${height * 0.05}px`}}>
                <StyledCaptions scene={t.scene} variant="pop" accent={pal.accent} color={pal.text} font={fonts.sans} size={(portrait ? 54 : 46) * u} words={4} />
              </AbsoluteFill>
            </Sequence>
          ))
        : null}
      <Vignette strength={0.45} />
      <Grain opacity={0.05} />
      <NarrationTrack media={media} />
      <AdWeave media={media} theme={{background: pal.bg, text: pal.text, font: fonts.sans}} />
    </AbsoluteFill>
  );
};

export default defineEntry({id: 'showreel-culture-mix', schema: Props, component: CultureMix});
