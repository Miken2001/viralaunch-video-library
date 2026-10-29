import React from 'react';
import {AbsoluteFill, Sequence, useCurrentFrame, useVideoConfig} from 'remotion';
import {AdWeave, NarrationTrack, captionSafeBottom, defineEntry, mix, useContentFrames, useLook, useSceneTimeline, type ActiveLook, type EntryProps, type Scene} from '@viralaunch/kit';
import {CameraImage, Grain, KineticText, LightLeak, LineIcon, Particles, StyledCaptions, Vignette, alpha, ease, fonts, progress, rand, tween} from '@viralaunch/kit/fx';
import {Props, type Chapter} from './schema';

type Plate = {bg: string; bg2: string; main: string; hi: string; text: string; muted: string};
type Pal = {gold: Plate; ink: Plate; seal: string; sealText: string};
type Kind = 'gold' | 'ink';

const SEALS = {vermilion: '#b3261c', jade: '#2c7a5e', indigo: '#2a3c78'} as const;
const OWN = {
  gold: {bg: '#0b0907', bg2: '#1f170c', main: '#d6af60', hi: '#f8e4a8', text: '#efe4cc', muted: '#9a8b70'},
  ink: {bg: '#efe7d5', bg2: '#ddd0b5', main: '#1d1a16', hi: '#b3261c', text: '#1d1a16', muted: '#6d6457'},
};

/** The two plates in a sequence's shared look: the "gold" plate on the look's background, the "ink" plate on its surface. */
const fromLook = (l: ActiveLook): Pal => {
  const p = l.palette;
  const dark = l.tone === 'dark';
  return {
    gold: {bg: p.bg, bg2: p.bg2, main: dark ? p.accent : mix(p.accent, p.text, 0.5), hi: dark ? mix(p.accent, '#ffffff', 0.45) : mix(p.accent, p.text, 0.25), text: p.text, muted: p.muted},
    ink: {bg: dark ? mix(p.surface, p.bg2, 0.5) : p.surface, bg2: p.bg2, main: p.line, hi: dark ? p.accent : mix(p.accent, p.text, 0.35), text: p.text, muted: p.muted},
    seal: p.accent,
    sealText: dark ? p.bg : p.text,
  };
};

const clean = (s: string) => s.replace(/\*/g, '');

/** Jagged brush-edge reveal that sweeps left to right as `p` goes 0 → 1. */
function brushClip(p: number, seed: number) {
  const base = -0.25 + p * 1.5;
  const pts = ['0% 0%'];
  for (let i = 0; i <= 18; i++) {
    const y = i / 18;
    const x = base + (y - 0.5) * 0.18 + (rand(`bw${seed}${i}`) - 0.5) * 0.05 + Math.sin(y * 9 + seed) * 0.015;
    pts.push(`${(x * 100).toFixed(2)}% ${(y * 100).toFixed(2)}%`);
  }
  pts.push('0% 100%');
  return `polygon(${pts.join(',')})`;
}

/** Seeded soft ridge for the ink mountains. */
function ridge(seed: string, w: number, h: number, base: number, amp: number, steps = 10) {
  const ys = Array.from({length: steps + 1}, (_, i) => base - amp * (0.3 + 0.7 * rand(`${seed}${i}`)) * (0.6 + 0.4 * Math.sin((i / steps) * Math.PI)));
  let d = `M0,${h} L0,${ys[0]}`;
  for (let i = 1; i <= steps; i++) {
    const x0 = ((i - 1) / steps) * w;
    const x1 = (i / steps) * w;
    d += ` Q${x0 + (x1 - x0) * 0.5},${ys[i - 1] - amp * 0.25} ${x1},${ys[i]}`;
  }
  return `${d} L${w},${h} Z`;
}

/** Stamped seal block; vertical seals stack their letters like a hanging scroll. */
const Seal: React.FC<{text: string; w: number; h: number; pal: Pal; at: number; seed: number; vertical?: boolean}> = ({text, w, h, pal, at, seed, vertical = true}) => {
  const frame = useCurrentFrame();
  const p = progress(frame, at, 12, ease.overshoot);
  const len = Math.max(2, text.length);
  const size = vertical ? Math.min(w * 0.46, ((h - w * 0.5) / len) * 0.8) : Math.min(h * 0.42, ((w - h * 0.3) / len) * 1.5);
  const jag = Array.from({length: 16}, (_, i) => {
    const a = i / 16;
    const edge = (n: number) => (rand(`sj${seed}${i}${n}`) * 2.2).toFixed(2);
    return a < 0.25 ? `${a * 400}% ${edge(0)}%` : a < 0.5 ? `${100 - Number(edge(1))}% ${(a - 0.25) * 400}%` : a < 0.75 ? `${100 - (a - 0.5) * 400}% ${100 - Number(edge(2))}%` : `${edge(3)}% ${100 - (a - 0.75) * 400}%`;
  });
  return (
    <div style={{width: w, height: h, flexShrink: 0, position: 'relative', opacity: Math.min(1, p * 2), transform: `scale(${1.6 - 0.6 * p}) rotate(${-9 + 6 * p}deg)`, filter: `drop-shadow(0 ${h * 0.04}px ${h * 0.08}px rgba(0,0,0,.35))`}}>
      <div style={{position: 'absolute', inset: 0, background: `radial-gradient(circle at 30% 25%, ${mix(pal.seal, '#ffffff', 0.12)} 0%, ${pal.seal} 55%, ${mix(pal.seal, '#000000', 0.18)} 100%)`, clipPath: `polygon(${jag.join(',')})`}} />
      <div style={{position: 'absolute', inset: Math.min(w, h) * 0.07, border: `${Math.max(2, Math.min(w, h) * 0.022)}px solid ${alpha(pal.sealText, 0.7)}`}} />
      <div style={{position: 'absolute', inset: 0, display: 'flex', justifyContent: 'center', alignItems: 'center', color: pal.sealText, fontFamily: fonts.serif, fontWeight: 700, fontSize: size, lineHeight: 1, letterSpacing: vertical ? '0.04em' : '0.02em', writingMode: vertical ? 'vertical-rl' : undefined, textOrientation: vertical ? 'upright' : undefined, textTransform: 'uppercase'}}>
        {text}
      </div>
    </div>
  );
};

/** Brush ensō ring that draws itself and turns slowly. */
const Enso: React.FC<{r: number; color: string; at: number; seed: number}> = ({r, color, at, seed}) => {
  const frame = useCurrentFrame();
  const p = progress(frame, at, 40, ease.cinematic);
  const turn = rand(`en${seed}`, 0, 360) + frame * 0.12;
  return (
    <svg width={r * 2.4} height={r * 2.4} viewBox={`${-r * 1.2} ${-r * 1.2} ${r * 2.4} ${r * 2.4}`} style={{position: 'absolute', left: '50%', top: '50%', marginLeft: -r * 1.2, marginTop: -r * 1.2, transform: `rotate(${turn}deg)`, overflow: 'visible'}}>
      <circle r={r} fill="none" stroke={alpha(color, 0.32)} strokeWidth={r * 0.07} strokeLinecap="round" pathLength={1} strokeDasharray={`${p * 0.92} 1`} />
      <circle r={r * 0.97} fill="none" stroke={alpha(color, 0.18)} strokeWidth={r * 0.025} strokeLinecap="round" pathLength={1} strokeDasharray={`${p * 0.86} 1`} transform="rotate(14)" />
    </svg>
  );
};

/** Background of each plate: black with gold dust and ring, or paper with ink-wash mountains. */
const Backdrop: React.FC<{kind: Kind; pal: Pal; seed: number; scene?: Scene}> = ({kind, pal, seed, scene}) => {
  const frame = useCurrentFrame();
  const {width, height} = useVideoConfig();
  const c = pal[kind];
  if (kind === 'gold') {
    return (
      <AbsoluteFill style={{background: `radial-gradient(ellipse at 50% 45%, ${c.bg2} 0%, ${c.bg} 70%)`}}>
        {scene?.video ? (
          <AbsoluteFill style={{opacity: 0.26, filter: 'grayscale(1) sepia(.55) brightness(.7) contrast(1.1)'}}>
            <CameraImage src={scene.video} isStatic={scene.isStaticImage} move={seed % 2 ? 'pan-left' : 'push'} />
          </AbsoluteFill>
        ) : null}
        <svg width={width} height={height} style={{position: 'absolute', inset: 0}}>
          {[0.2, 0.8].map((y, i) => (
            <line key={i} x1={width * 0.04} x2={width * 0.04 + width * 0.92 * progress(frame, 6 + i * 6, 40, ease.cinematic)} y1={height * y} y2={height * y} stroke={alpha(c.main, 0.22)} strokeWidth={1.5} />
          ))}
        </svg>
        <Particles count={40} color={c.hi} opacity={0.45} seed={`gd${seed}`} speed={0.35} size={[1.5, 4]} />
      </AbsoluteFill>
    );
  }
  const drift = frame * 0.25;
  return (
    <AbsoluteFill style={{background: `radial-gradient(ellipse at 40% 35%, ${c.bg} 0%, ${mix(c.bg, c.bg2, 0.6)} 100%)`}}>
      <AbsoluteFill style={{background: `radial-gradient(circle at ${20 + rand(`pb${seed}`, 0, 60)}% ${30 + rand(`pc${seed}`, 0, 40)}%, ${alpha(c.bg2, 0.7)} 0%, transparent 35%)`}} />
      <svg width={width} height={height} style={{position: 'absolute', inset: 0}}>
        {[0, 1].map(l => (
          <g key={l} transform={`translate(${-(drift * (0.5 + l * 0.6)) % (width * 0.3)}, 0)`} opacity={progress(frame, 4 + l * 8, 30, ease.cinematic)}>
            <path d={ridge(`m${seed}${l}`, width * 1.4, height, height * (0.5 + l * 0.08), height * (0.22 - l * 0.06))} fill={alpha(c.main, 0.07 + l * 0.06)} />
          </g>
        ))}
      </svg>
      <AbsoluteFill style={{background: `linear-gradient(180deg, transparent 45%, ${alpha(c.bg, 0.75)} 75%, ${alpha(c.bg, 0.4)} 100%)`}} />
    </AbsoluteFill>
  );
};

/** Hand-brushed stroke under a title: drawn left to right, thick then thin. */
const BrushRule: React.FC<{w: number; color: string; at: number}> = ({w, color, at}) => {
  const frame = useCurrentFrame();
  const p = progress(frame, at, 22, ease.cinematic);
  const h = w * 0.08;
  return (
    <svg width={w} height={h} style={{display: 'block', overflow: 'visible'}}>
      <path d={`M2,${h * 0.55} C${w * 0.3},${h * 0.2} ${w * 0.6},${h * 0.8} ${w - 2},${h * 0.4}`} fill="none" stroke={color} strokeWidth={h * 0.42} strokeLinecap="round" pathLength={1} strokeDasharray={`${p} 1`} />
      <path d={`M${w * 0.05},${h * 0.85} C${w * 0.4},${h * 0.6} ${w * 0.7},${h} ${w * 0.9},${h * 0.75}`} fill="none" stroke={alpha(color, 0.5)} strokeWidth={h * 0.12} strokeLinecap="round" pathLength={1} strokeDasharray={`${Math.max(0, p * 1.2 - 0.2)} 1`} />
    </svg>
  );
};

type PlateProps = {ch: Chapter; index: number; pal: Pal; s: number; portrait: boolean; at: number; scene?: Scene};

const GoldChapter: React.FC<PlateProps> = ({ch, index, pal, s, portrait, at}) => {
  const frame = useCurrentFrame();
  const c = pal.gold;
  const f = frame - at;
  const sweep = tween(f, [8, 70], [-30, 130], ease.cinematic);
  const num = String(index + 1).padStart(2, '0');
  const numeral = (
    <div style={{display: 'flex', flexDirection: portrait ? 'row' : 'column', alignItems: 'center', gap: 14 * s, opacity: progress(f, 2, 20)}}>
      <div style={{fontFamily: fonts.serif, fontWeight: 700, fontSize: (portrait ? 130 : 190) * s, lineHeight: 0.9, backgroundImage: `linear-gradient(105deg, ${c.main} 0%, ${c.main} ${sweep - 18}%, ${c.hi} ${sweep}%, ${c.main} ${sweep + 18}%, ${c.main} 100%)`, WebkitBackgroundClip: 'text', backgroundClip: 'text', color: 'transparent', filter: `blur(${(1 - progress(f, 2, 22, ease.expo)) * 10}px)`}}>
        {num}
      </div>
      <div style={{fontFamily: fonts.mono, fontSize: 18 * s, letterSpacing: '0.5em', color: c.muted}}>CHAPTER</div>
    </div>
  );
  const text = (
    <div style={{display: 'flex', flexDirection: 'column', alignItems: portrait ? 'center' : 'flex-start', maxWidth: (portrait ? 900 : 760) * s, textAlign: portrait ? 'center' : 'left'}}>
      <div style={{fontFamily: fonts.mono, fontSize: 26 * s, letterSpacing: `${0.5 - 0.2 * progress(f, 6, 26)}em`, color: c.main, opacity: progress(f, 6, 16)}}>{ch.when}</div>
      <div style={{marginTop: 14 * s}}>
        <KineticText text={ch.title} start={at + 10} stagger={4} duration={22} style="blur" accent={c.hi} align={portrait ? 'center' : 'left'} textStyle={{fontFamily: fonts.serif, fontWeight: 700, fontSize: (ch.title.length > 20 ? 78 : 96) * s, lineHeight: 1.05, color: c.main, textShadow: `0 0 ${30 * s}px ${alpha(c.main, 0.35)}`}} />
      </div>
      <div style={{marginTop: 18 * s}}>
        <BrushRule w={280 * s} color={c.main} at={at + 20} />
      </div>
      {ch.detail ? <div style={{marginTop: 22 * s, fontFamily: fonts.serif, fontStyle: 'italic', fontSize: 34 * s, lineHeight: 1.35, color: c.text, opacity: 0.85 * progress(f, 30, 20), transform: `translateY(${(1 - progress(f, 30, 24)) * 16 * s}px)`}}>{ch.detail}</div> : null}
    </div>
  );
  const seal = <Seal text={ch.seal || num} w={(portrait ? 120 : 150) * s} h={(portrait ? 240 : 300) * s} pal={pal} at={at + 14} seed={index} />;
  return (
    <AbsoluteFill style={{justifyContent: 'center', alignItems: 'center'}}>
      <Enso r={(portrait ? 190 : 290) * s} color={c.main} at={at} seed={index} />
      <div style={{display: 'flex', flexDirection: portrait ? 'column' : 'row', alignItems: 'center', gap: (portrait ? 40 : 64) * s, transform: `scale(${1.04 - 0.04 * progress(f, 0, 60, ease.cinematic)})`}}>
        {numeral}
        {seal}
        {text}
      </div>
    </AbsoluteFill>
  );
};

const InkChapter: React.FC<PlateProps> = ({ch, index, pal, s, portrait, at, scene}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const c = pal.ink;
  const f = frame - at;
  const box = (portrait ? 480 : 520) * s;
  const draw = progress(f, 6, Math.round(1.6 * fps), ease.cinematic);
  const float = Math.sin(frame / 30) * 6 * s;
  const wash = progress(f, 0, 30, ease.expo);
  const waves = (
    <svg width={box} height={box * 0.22} style={{display: 'block', overflow: 'visible', marginTop: -box * 0.06}}>
      {[0, 1, 2].map(i => {
        const y = box * (0.05 + i * 0.07);
        const ph = frame * 0.06 + i;
        const d = Array.from({length: 9}, (_, k) => `${k === 0 ? 'M' : 'L'}${(k / 8) * box * (1 - i * 0.15) + i * box * 0.075},${y + Math.sin(k * 1.4 + ph) * box * 0.012}`).join(' ');
        return <path key={i} d={d} fill="none" stroke={alpha(c.main, 0.7 - i * 0.18)} strokeWidth={3 * s} strokeLinecap="round" pathLength={1} strokeDasharray={`${progress(f, 14 + i * 6, 30, ease.cinematic)} 1`} />;
      })}
    </svg>
  );
  const art = (
    <div style={{display: 'flex', flexDirection: 'column', alignItems: 'center'}}>
      <div style={{width: box, height: box, position: 'relative', display: 'flex', justifyContent: 'center', alignItems: 'center', transform: `translateY(${float}px)`}}>
        <div style={{position: 'absolute', inset: box * 0.08, borderRadius: '50%', background: `radial-gradient(circle at 45% 40%, ${alpha(c.main, 0.16)} 0%, ${alpha(c.main, 0.07)} 55%, transparent 72%)`, transform: `scale(${0.5 + 0.5 * wash})`, opacity: wash}} />
        {scene?.video ? (
          <div style={{width: box * 0.78, height: box * 0.78, borderRadius: '50%', overflow: 'hidden', border: `${4 * s}px solid ${c.main}`, opacity: progress(f, 4, 24), clipPath: `circle(${draw * 75}% at 50% 50%)`}}>
            <AbsoluteFill style={{filter: 'grayscale(1) contrast(1.25) sepia(.2)'}}>
              <CameraImage src={scene.video} isStatic={scene.isStaticImage} move="push" />
            </AbsoluteFill>
          </div>
        ) : (
          <LineIcon name={ch.icon} progress={draw} size={box * 0.66} color={c.main} strokeWidth={3} />
        )}
      </div>
      {waves}
    </div>
  );
  const text = (
    <div style={{display: 'flex', flexDirection: 'column', alignItems: portrait ? 'center' : 'flex-start', maxWidth: (portrait ? 900 : 780) * s, textAlign: portrait ? 'center' : 'left'}}>
      <div style={{display: 'flex', alignItems: 'center', gap: 22 * s}}>
        <Seal text={ch.seal || String(index + 1).padStart(2, '0')} w={(ch.seal.length > 4 ? 150 : 96) * s} h={84 * s} pal={pal} at={at + 22} seed={index + 40} vertical={false} />
        <div style={{fontFamily: fonts.mono, fontSize: 26 * s, letterSpacing: '0.3em', color: c.hi, opacity: progress(f, 8, 16), transform: `translateX(${(1 - progress(f, 8, 20)) * -20 * s}px)`}}>{ch.when}</div>
      </div>
      <div style={{marginTop: 20 * s}}>
        <KineticText text={ch.title} start={at + 8} stagger={4} duration={20} style="rise" accent={c.hi} align={portrait ? 'center' : 'left'} textStyle={{fontFamily: fonts.serifDisplay, fontSize: (ch.title.length > 20 ? 84 : 104) * s, lineHeight: 1.02, color: c.main}} />
      </div>
      <div style={{marginTop: 12 * s}}>
        <BrushRule w={300 * s} color={c.main} at={at + 18} />
      </div>
      {ch.detail ? <div style={{marginTop: 22 * s, fontFamily: fonts.serif, fontStyle: 'italic', fontSize: 34 * s, lineHeight: 1.35, color: c.muted, opacity: progress(f, 28, 20)}}>{ch.detail}</div> : null}
    </div>
  );
  return (
    <AbsoluteFill style={{justifyContent: 'center', alignItems: 'center'}}>
      <div style={{display: 'flex', flexDirection: portrait ? 'column' : 'row', alignItems: 'center', gap: (portrait ? 30 : 80) * s}}>
        {art}
        {text}
      </div>
    </AbsoluteFill>
  );
};

const Intro: React.FC<{props: Props; kind: Kind; pal: Pal; s: number; portrait: boolean}> = ({props, kind, pal, s, portrait}) => {
  const frame = useCurrentFrame();
  const c = pal[kind];
  const first = props.chapters[0].when;
  const last = props.chapters[props.chapters.length - 1].when;
  return (
    <AbsoluteFill style={{justifyContent: 'center', alignItems: 'center'}}>
      {kind === 'gold' ? <Enso r={(portrait ? 320 : 300) * s} color={c.main} at={0} seed={99} /> : null}
      <div style={{display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '0 8%', textAlign: 'center'}}>
        <Seal text={clean(props.title).trim().charAt(0)} w={86 * s} h={86 * s} pal={pal} at={4} seed={77} vertical={false} />
        <div style={{marginTop: 34 * s, fontFamily: fonts.mono, fontSize: 22 * s, letterSpacing: '0.45em', color: c.muted, opacity: progress(frame, 8, 16)}}>
          {props.chapters.length} CHAPTERS
        </div>
        <div style={{marginTop: 18 * s}}>
          <KineticText text={props.title} start={10} stagger={5} duration={26} style="blur" align="center" accent={c.hi} textStyle={{fontFamily: kind === 'gold' ? fonts.serif : fonts.serifDisplay, fontWeight: kind === 'gold' ? 700 : 400, fontSize: (portrait ? 104 : 116) * s, lineHeight: 1.04, color: c.main, textShadow: kind === 'gold' ? `0 0 ${36 * s}px ${alpha(c.main, 0.35)}` : 'none'}} />
        </div>
        {props.subtitle ? <KineticText text={props.subtitle} start={26} stagger={3} style="blur" align="center" textStyle={{fontFamily: fonts.serif, fontStyle: 'italic', fontSize: 38 * s, color: alpha(c.text, 0.82), marginTop: 26 * s}} /> : null}
        <div style={{marginTop: 30 * s, display: 'flex', alignItems: 'center', gap: 20 * s, fontFamily: fonts.mono, fontSize: 24 * s, letterSpacing: '0.2em', color: c.main, opacity: progress(frame, 34, 18)}}>
          <span>{first}</span>
          <span style={{width: 120 * s * progress(frame, 36, 26, ease.cinematic), height: 2, background: c.main, display: 'inline-block'}} />
          <span>{last}</span>
        </div>
      </div>
    </AbsoluteFill>
  );
};

const InkGoldTimeline: React.FC<EntryProps<Props>> = ({media, props}) => {
  const frame = useCurrentFrame();
  const {fps, width, height} = useVideoConfig();
  const look = useLook();
  const pal: Pal = look ? fromLook(look) : {gold: OWN.gold, ink: {...OWN.ink, hi: media.accent ?? SEALS[props.sealColor]}, seal: media.accent ?? SEALS[props.sealColor], sealText: '#f6ead2'};
  const u = Math.min(width, height) / 1080;
  const portrait = height >= width;
  const timeline = useSceneTimeline(media);
  const contentEnd = useContentFrames(media);
  const chapters = props.chapters;
  const n = chapters.length;

  // Chapter windows: one narration scene per chapter, after an optional title scene.
  const hasIntroScene = timeline.length > n;
  const introEnd = hasIntroScene ? timeline[1].from : Math.min(Math.round(2.2 * fps), Math.floor(contentEnd * 0.15));
  const starts = chapters.map((_, i) => {
    if (hasIntroScene) return timeline[i + 1].from;
    if (timeline.length === n) return i === 0 ? introEnd : Math.max(introEnd + i, timeline[i].from);
    return introEnd + Math.round(((contentEnd - introEnd) * i) / n);
  }).map(v => Math.min(v, contentEnd - 1));
  const sceneFor = (i: number): Scene | undefined => (hasIntroScene ? media.scenes[i + 1] : timeline.length === n ? media.scenes[i] : undefined);
  const T = Math.round(0.7 * fps);
  const half = Math.floor(T / 2);
  const kindOf = (i: number): Kind => (props.styleMode === 'gold' ? 'gold' : props.styleMode === 'ink' ? 'ink' : i % 2 === 0 ? 'ink' : 'gold');
  const introKind: Kind = props.styleMode === 'ink' ? 'ink' : 'gold';
  const reveal = (i: number) => progress(frame, starts[i] - half, T, ease.cinematic);

  // How "ink" the frame is right now (0 = gold plate, 1 = ink plate): drives chrome colours.
  let w = introKind === 'ink' ? 1 : 0;
  chapters.forEach((_, i) => {
    const p = reveal(i);
    w = w * (1 - p) + (kindOf(i) === 'ink' ? 1 : 0) * p;
  });
  const chrome = (k: keyof Plate) => mix(pal.gold[k], pal.ink[k], w);

  // Layout bands: header on top, ruler (and captions) at the bottom, content in between.
  const safe = captionSafeBottom(look);
  const rulerBottom = look ? safe + 0.015 : 0.06;
  const floor = look ? rulerBottom + 0.1 : props.showCaptions ? 0.29 : 0.17;
  const top = portrait ? 0.1 : 0.12;
  const fit = Math.max(0.6, Math.min(1, (1 - top - floor) / (portrait ? 0.66 : 0.62)));
  const s = u * fit;

  const pos = chapters.reduce((acc, _, i) => acc + (i === 0 ? 0 : reveal(i)), 0);
  const current = Math.min(n - 1, Math.round(pos));
  const started = reveal(0);
  const left = width * (portrait ? 0.08 : 0.06);
  const span = width - left * 2;
  const tickX = (i: number) => left + (n === 1 ? 0 : (span * i) / (n - 1));
  const playX = left + (n === 1 ? 0 : (span * pos) / (n - 1));
  const rulerY = height * (1 - rulerBottom);
  const rulerIn = progress(frame, 6, 40, ease.cinematic);
  const labelU = Math.max(14, 17 * u);
  const showTickLabel = (i: number) => !portrait || i === 0 || i === n - 1;
  const swap = 1 - Math.min(1, Math.abs(pos - current) * 2.2);

  const layers = [{kind: introKind, from: 0, end: starts[0] + half, chapter: -1}, ...chapters.map((_, i) => ({kind: kindOf(i), from: starts[i] - half, end: i === n - 1 ? contentEnd + fps * 4 : starts[i + 1] + half, chapter: i}))];

  return (
    <AbsoluteFill style={{background: pal[introKind].bg, overflow: 'hidden'}}>
      {layers.map((l, k) => {
        const from = Math.max(0, l.from);
        const dur = Math.max(1, l.end - from);
        const clip = l.chapter >= 0 && frame < starts[l.chapter] + half ? brushClip(reveal(l.chapter), l.chapter) : undefined;
        const scene = l.chapter >= 0 ? sceneFor(l.chapter) : hasIntroScene ? media.scenes[0] : undefined;
        return (
          <Sequence key={k} from={from} durationInFrames={dur}>
            <AbsoluteFill style={{clipPath: clip}}>
              <Backdrop kind={l.kind} pal={pal} seed={k} scene={l.kind === 'gold' ? scene : undefined} />
              <div style={{position: 'absolute', left: 0, right: 0, top: height * top, height: height * (1 - top - floor)}}>
                {l.chapter < 0 ? (
                  <Intro props={props} kind={l.kind} pal={pal} s={s} portrait={portrait} />
                ) : l.kind === 'gold' ? (
                  <GoldChapter ch={chapters[l.chapter]} index={l.chapter} pal={pal} s={s} portrait={portrait} at={starts[l.chapter] - from} scene={scene} />
                ) : (
                  <InkChapter ch={chapters[l.chapter]} index={l.chapter} pal={pal} s={s} portrait={portrait} at={starts[l.chapter] - from} scene={scene} />
                )}
              </div>
            </AbsoluteFill>
          </Sequence>
        );
      })}
      {chapters.map((_, i) => (kindOf(i) === 'gold' ? <LightLeak key={i} from={Math.max(0, starts[i] - half)} durationInFrames={Math.round(1.2 * fps)} seed={i * 7 + 2} opacity={0.22} /> : null))}

      {/* Header: small seal, title and the running chapter name */}
      <div style={{position: 'absolute', left, top: height * 0.045, display: 'flex', alignItems: 'center', gap: 18 * u, opacity: progress(frame, 10, 20)}}>
        <div style={{width: 44 * u, height: 44 * u, background: pal.seal, color: pal.sealText, display: 'flex', justifyContent: 'center', alignItems: 'center', fontFamily: fonts.serif, fontWeight: 700, fontSize: 20 * u}}>
          {started > 0.5 ? String(current + 1).padStart(2, '0') : '00'}
        </div>
        <div>
          <div style={{fontFamily: fonts.serif, fontWeight: 700, fontSize: 26 * u, color: chrome('main'), lineHeight: 1.1, maxWidth: width * 0.6, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis'}}>{clean(props.title)}</div>
          <div style={{fontFamily: fonts.mono, fontSize: labelU, letterSpacing: '0.18em', color: chrome('muted'), marginTop: 4 * u, opacity: started * swap, textTransform: 'uppercase'}}>
            Ch. {String(current + 1).padStart(2, '0')} · {chapters[current].title}
          </div>
        </div>
      </div>
      {/* Vertical date tag, top right */}
      <div style={{position: 'absolute', right: left, top: height * 0.045, display: 'flex', alignItems: 'flex-start', gap: 12 * u, opacity: started * swap}}>
        <div style={{writingMode: 'vertical-rl', fontFamily: fonts.serif, fontWeight: 700, fontSize: 30 * u, letterSpacing: '0.12em', color: chrome('main'), maxHeight: height * (portrait ? 0.2 : 0.3)}}>{chapters[current].when}</div>
        <div style={{width: 2, height: 90 * u * swap, background: pal.seal}} />
      </div>

      {/* Timeline ruler with chapter ticks and a seal-coloured playhead */}
      <svg width={width} height={height} style={{position: 'absolute', inset: 0, pointerEvents: 'none', overflow: 'visible'}}>
        <line x1={left} x2={left + span * rulerIn} y1={rulerY} y2={rulerY} stroke={alpha(chrome('main'), 0.45)} strokeWidth={2} />
        {started > 0 ? <line x1={left} x2={playX} y1={rulerY} y2={rulerY} stroke={pal.seal} strokeWidth={5 * u} opacity={started} /> : null}
        {chapters.map((_, i) => (
          <g key={i} opacity={progress(frame, 10 + i * 3, 12)}>
            <line x1={tickX(i)} x2={tickX(i)} y1={rulerY - 12 * u} y2={rulerY + 12 * u} stroke={i <= pos + 0.01 && started > 0.5 ? pal.seal : chrome('main')} strokeWidth={2} />
            {Array.from({length: i < n - 1 ? 4 : 0}, (_, k) => {
              const x = tickX(i) + ((tickX(i + 1) - tickX(i)) * (k + 1)) / 5;
              return <line key={k} x1={x} x2={x} y1={rulerY - 5 * u} y2={rulerY + 5 * u} stroke={alpha(chrome('main'), 0.35)} strokeWidth={1} />;
            })}
          </g>
        ))}
        {started > 0 ? (
          <g transform={`translate(${playX}, ${rulerY})`} opacity={started}>
            <path d={`M0,${-16 * u} L${10 * u},0 L0,${16 * u} L${-10 * u},0 Z`} fill={pal.seal} />
          </g>
        ) : null}
      </svg>
      {chapters.map((ch, i) =>
        showTickLabel(i) ? (
          <div key={i} style={{position: 'absolute', top: rulerY + 18 * u, left: tickX(i), transform: `translateX(${i === 0 ? 0 : i === n - 1 ? -100 : -50}%)`, fontFamily: fonts.mono, fontSize: labelU, letterSpacing: '0.08em', whiteSpace: 'nowrap', color: chrome('muted'), opacity: progress(frame, 12 + i * 3, 12) * (Math.abs(i - pos) < 0.5 && started > 0.5 ? 0.25 : 1)}}>
            {ch.when}
          </div>
        ) : null,
      )}
      {started > 0 ? (
        <div style={{position: 'absolute', top: rulerY - 64 * u, left: Math.min(Math.max(playX, left + 60 * u), left + span - 60 * u), transform: 'translateX(-50%)', fontFamily: fonts.serif, fontWeight: 700, fontSize: 32 * u, whiteSpace: 'nowrap', color: chrome('main'), opacity: started * swap}}>
          {chapters[current].when}
        </div>
      ) : null}

      {props.showCaptions
        ? timeline.map(t => (
            <Sequence key={t.index} from={t.from} durationInFrames={t.durationInFrames}>
              <AbsoluteFill style={{justifyContent: 'flex-end', padding: portrait ? `0 8% ${height * 0.13}px` : `0 16% ${height * 0.175}px`}}>
                {w > 0.5 ? (
                  <StyledCaptions scene={t.scene} variant="minimal" color={pal.ink.text} font={fonts.serif} size={(portrait ? 50 : 44) * u} words={portrait ? 5 : 8} weight={700} shadow={false} />
                ) : (
                  <StyledCaptions scene={t.scene} variant="karaoke" accent={pal.gold.hi} color={alpha(pal.gold.text, 0.55)} font={fonts.serif} size={(portrait ? 50 : 44) * u} words={portrait ? 5 : 8} weight={700} />
                )}
              </AbsoluteFill>
            </Sequence>
          ))
        : null}

      <Vignette strength={0.55 - 0.35 * w} />
      <Grain opacity={0.08} />
      <NarrationTrack media={media} />
      <AdWeave media={media} theme={{background: pal.gold.bg, text: pal.gold.text, font: fonts.serif}} />
    </AbsoluteFill>
  );
};

export default defineEntry({id: 'timeline-ink-gold-dynasties', schema: Props, component: InkGoldTimeline});
