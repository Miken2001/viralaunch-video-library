import React from 'react';
import {AbsoluteFill, Sequence, spring, useCurrentFrame, useVideoConfig} from 'remotion';
import {AdWeave, NarrationTrack, captionSafeBottom, defineEntry, evenCaptions, mix, useContentFrames, useLook, useSceneTimeline, type ActiveLook, type EntryProps, type Scene} from '@viralaunch/kit';
import {Grain, KineticText, LightLeak, LineIcon, Particles, SceneSeries, StyledCaptions, Vignette, alpha, ease, fonts, progress, rand, tween, type Widen} from '@viralaunch/kit/fx';
import {Props, type Action, type BeatProps, type CharacterProps, type Place} from './schema';

// ---------------------------------------------------------------------------------------------
// Palette
// ---------------------------------------------------------------------------------------------

const PALETTES = {
  sketchbook: {bg: '#f3eee3', bg2: '#e2d9c6', surface: '#fffdf7', text: '#211e1a', muted: '#857c6c', accent: '#ff6a3d', line: '#2b2723', skyTop: '#8f7cc0', skyLow: '#ffb48c', night: '#161b36', dark: false},
  pastel: {bg: '#eaf1f3', bg2: '#d3e1e6', surface: '#ffffff', text: '#1b2430', muted: '#6f8190', accent: '#4f6df5', line: '#22303d', skyTop: '#6f8fe0', skyLow: '#ffc9a8', night: '#121a33', dark: false},
  blueprint: {bg: '#0e1f3d', bg2: '#183463', surface: '#f4f7ff', text: '#eef4ff', muted: '#93a9cf', accent: '#ffcf4a', line: '#cfe0ff', skyTop: '#2c3f86', skyLow: '#e98b6d', night: '#070d1f', dark: true},
} as const;
/** `ink` is the text and outline colour on bubbles (which use `surface`). */
type Pal = Widen<Omit<(typeof PALETTES)['sketchbook'], 'dark'>> & {dark: boolean; ink: string};

/** The sketchbook in a sequence's shared look: same paper, ink and accent. */
const fromLook = (l: ActiveLook): Pal => ({
  bg: l.palette.bg,
  bg2: l.palette.bg2,
  surface: l.palette.surface,
  text: l.palette.text,
  muted: l.palette.muted,
  accent: l.palette.accent,
  line: l.palette.line,
  skyTop: mix(l.palette.bg2, l.palette.accent, 0.25),
  skyLow: mix(l.palette.bg, l.palette.accent, 0.55),
  night: l.tone === 'dark' ? l.palette.bg : mix(l.palette.text, l.palette.bg2, 0.15),
  dark: l.tone === 'dark',
  ink: l.palette.text,
});

const INK = '#1d1b19';
const OUTFIT: Record<CharacterProps['color'], string> = {olive: '#6f7d4b', navy: '#2f3f6e', coral: '#e2694c', teal: '#2a8a8a', plum: '#7b4b7c', charcoal: '#3b3b41', mustard: '#d6a332'};
const SKIN: Record<CharacterProps['skin'], string> = {light: '#f6d7c0', tan: '#e7b48e', brown: '#b9805a', deep: '#7c5039'};
const HAIR: Record<CharacterProps['skin'], string> = {light: '#5a3b24', tan: '#2a211c', brown: '#1e1814', deep: '#141110'};

// ---------------------------------------------------------------------------------------------
// Characters
// ---------------------------------------------------------------------------------------------

type Pose = [number, number, number, number]; // near arm (upper, elbow), far arm (upper, elbow), in degrees from hanging down
const IDLE: Pose = [10, -8, 10, -8];

/** Arm angles for an action at frame `t` (live wobble included). */
function poseFor(action: Action | 'idle', t: number): Pose {
  switch (action) {
    case 'talk': return [38 + 12 * Math.sin(t / 6), -62 + 16 * Math.sin(t / 4.5), 12, -10];
    case 'point': return [86 + 3 * Math.sin(t / 9), 4, 14, -10];
    case 'think': return [-28, -96, 22, -18];
    case 'shrug': return [42 + 3 * Math.sin(t / 7), 108, 42 + 3 * Math.sin(t / 7), 108];
    case 'wave': return [150, 18 + 22 * Math.sin(t / 3), 12, -10];
    case 'cheer': return [158, 12 * Math.sin(t / 4), 158, -12 * Math.sin(t / 4)];
    case 'shock': return [62, -112, 62, -112];
    default: return [IDLE[0] + 2 * Math.sin(t / 20), IDLE[1], IDLE[2] + 2 * Math.cos(t / 22), IDLE[3]];
  }
}
const lerpPose = (a: Pose, b: Pose, k: number): Pose => a.map((v, i) => v + (b[i] - v) * k) as Pose;

const Arm: React.FC<{sx: number; sy: number; side: number; a: number; b: number; sleeve: string; hand: string; robot: boolean}> = ({sx, sy, side, a, b, sleeve, hand, robot}) => {
  const r = Math.PI / 180;
  const ex = sx + side * Math.sin(a * r) * 60;
  const ey = sy + Math.cos(a * r) * 60;
  const hx = ex + side * Math.sin((a + b) * r) * 54;
  const hy = ey + Math.cos((a + b) * r) * 54;
  const d = `M${sx} ${sy} L${ex} ${ey} L${hx} ${hy}`;
  return (
    <g>
      <path d={d} fill="none" stroke={INK} strokeWidth={robot ? 20 : 27} strokeLinecap="round" strokeLinejoin="round" />
      <path d={d} fill="none" stroke={sleeve} strokeWidth={robot ? 12 : 19} strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={hx} cy={hy} r={robot ? 12 : 11} fill={hand} stroke={INK} strokeWidth={4.5} />
    </g>
  );
};

/** One cast member, drawn in a 200×440 box with the feet at the bottom centre. */
const Character: React.FC<{
  c: CharacterProps;
  x: number;
  groundY: number;
  h: number;
  facing: number;
  pose: Pose;
  mouth: number;
  blink: number;
  tilt: number;
  jump: number;
  look: [number, number];
  shock: number;
  enter: number;
  accent: string;
  thinking: number;
}> = ({c, x, groundY, h, facing, pose, mouth, blink, tilt, jump, look, shock, enter, accent, thinking}) => {
  const frame = useCurrentFrame();
  const w = (h * 200) / 440;
  const robot = c.style === 'robot';
  const cloth = OUTFIT[c.color];
  const skin = robot ? '#c9ced8' : SKIN[c.skin];
  const hair = HAIR[c.skin];
  const pants = robot ? '#8f96a3' : c.style === 'blazer' ? mix(cloth, INK, 0.45) : c.style === 'labcoat' ? '#3d4250' : mix(cloth, '#2c2a26', 0.55);
  const coat = c.style === 'labcoat' ? '#f7f7f4' : cloth;
  const breathe = 1 + 0.012 * Math.sin(frame / 14 + x);
  const [lx, ly] = look;
  const near = facing; // +1 → the near arm is the right one
  const armR = near > 0 ? [pose[0], pose[1]] : [pose[2], pose[3]];
  const armL = near > 0 ? [pose[2], pose[3]] : [pose[0], pose[1]];
  const eyeRy = 6.5 * blink * (1 + shock * 0.4);
  return (
    <div style={{position: 'absolute', left: x - w / 2, top: groundY - h, width: w, height: h, transform: `translateY(${-jump * h * 0.12 + (1 - enter) * h * 0.25}px) scale(${0.6 + 0.4 * enter})`, transformOrigin: '50% 100%', opacity: Math.min(1, enter * 2)}}>
      <svg width={w} height={h} viewBox="0 0 200 440" style={{overflow: 'visible'}}>
        {/* legs */}
        {robot ? (
          <>
            <path d="M86 296 L84 414 M114 296 L116 414" stroke={INK} strokeWidth={22} strokeLinecap="round" />
            <path d="M86 296 L84 414 M114 296 L116 414" stroke={pants} strokeWidth={14} strokeLinecap="round" />
          </>
        ) : (
          <>
            <path d="M70 290 L72 416 L98 416 L100 300 L102 416 L128 416 L130 290 Z" fill={pants} stroke={INK} strokeWidth={5} strokeLinejoin="round" />
            {c.style === 'hoodie' ? <path d="M74 352 L94 352 M106 352 L126 352" stroke={INK} strokeWidth={3} opacity={0.5} /> : null}
          </>
        )}
        <ellipse cx={82} cy={424} rx={22} ry={11} fill={robot ? '#6d7480' : '#f2f0ea'} stroke={INK} strokeWidth={4.5} />
        <ellipse cx={118} cy={424} rx={22} ry={11} fill={robot ? '#6d7480' : '#f2f0ea'} stroke={INK} strokeWidth={4.5} />
        {/* torso, breathing from the hips */}
        <g transform={`translate(100 300) scale(1 ${breathe}) translate(-100 -300)`}>
          {robot ? (
            <>
              <rect x={58} y={180} width={84} height={122} rx={22} fill="#dfe3ea" stroke={INK} strokeWidth={5} />
              <rect x={76} y={206} width={48} height={34} rx={8} fill={INK} />
              <circle cx={88} cy={223} r={6} fill={accent} opacity={0.6 + 0.4 * Math.sin(frame / 5)} />
              <circle cx={112} cy={223} r={6} fill={cloth} />
              <path d="M74 264 L126 264 M74 278 L110 278" stroke={INK} strokeWidth={4} strokeLinecap="round" opacity={0.6} />
            </>
          ) : (
            <>
              {c.style === 'hoodie' ? <path d="M70 186 Q100 150 130 186 L122 196 Q100 176 78 196 Z" fill={mix(cloth, INK, 0.25)} stroke={INK} strokeWidth={4.5} strokeLinejoin="round" /> : null}
              <path d={c.style === 'labcoat' ? 'M62 196 Q64 176 100 172 Q136 176 138 196 L146 352 L54 352 Z' : 'M60 300 L62 200 Q64 176 100 172 Q136 176 138 200 L140 300 Z'} fill={coat} stroke={INK} strokeWidth={5} strokeLinejoin="round" />
              {c.style === 'blazer' ? (
                <>
                  <path d="M88 176 L100 236 L112 176 Z" fill="#fbfaf6" stroke={INK} strokeWidth={4} strokeLinejoin="round" />
                  <path d="M84 178 L100 250 L116 178 M100 250 L100 300" fill="none" stroke={INK} strokeWidth={4} strokeLinejoin="round" />
                  <circle cx={106} cy={270} r={4} fill={INK} />
                </>
              ) : null}
              {c.style === 'labcoat' ? (
                <>
                  <path d="M88 176 L100 222 L112 176 Z" fill={cloth} stroke={INK} strokeWidth={4} strokeLinejoin="round" />
                  <path d="M100 222 L100 350 M80 180 L100 240 L120 180" fill="none" stroke={INK} strokeWidth={4} strokeLinejoin="round" />
                  <rect x={112} y={250} width={20} height={22} rx={3} fill="none" stroke={INK} strokeWidth={3.5} />
                  <path d="M118 246 L118 258" stroke={accent} strokeWidth={4} strokeLinecap="round" />
                </>
              ) : null}
              {c.style === 'hoodie' ? (
                <>
                  <path d="M92 192 L90 226 M108 192 L110 226" stroke={INK} strokeWidth={3.5} strokeLinecap="round" />
                  <path d="M76 256 L124 256 L118 290 L82 290 Z" fill="none" stroke={INK} strokeWidth={3.5} strokeLinejoin="round" opacity={0.55} />
                </>
              ) : null}
              {c.style === 'cap' ? <path d="M86 176 Q100 190 114 176" fill="none" stroke={INK} strokeWidth={4} /> : null}
            </>
          )}
          {/* arms */}
          <Arm sx={robot ? 60 : 66} sy={196} side={-1} a={armL[0]} b={armL[1]} sleeve={robot ? '#aab1bd' : coat} hand={skin} robot={robot} />
          <Arm sx={robot ? 140 : 134} sy={196} side={1} a={armR[0]} b={armR[1]} sleeve={robot ? '#aab1bd' : coat} hand={skin} robot={robot} />
          {/* head */}
          <g transform={`rotate(${tilt} 100 168)`}>
            {robot ? (
              <>
                <path d="M100 66 L100 40" stroke={INK} strokeWidth={5} />
                <circle cx={100} cy={36} r={8} fill={accent} stroke={INK} strokeWidth={4} />
                <rect x={92} y={152} width={16} height={26} fill="#aab1bd" stroke={INK} strokeWidth={4} />
                <rect x={50} y={66} width={100} height={92} rx={26} fill="#dfe3ea" stroke={INK} strokeWidth={5} />
                <rect x={62} y={80} width={76} height={62} rx={16} fill={INK} />
                <rect x={78 + lx * 6 - 6} y={100 + ly * 4 - eyeRy} width={12} height={eyeRy * 2 + 2} rx={5} fill={accent} />
                <rect x={110 + lx * 6 - 6} y={100 + ly * 4 - eyeRy} width={12} height={eyeRy * 2 + 2} rx={5} fill={accent} />
                <rect x={92 + lx * 4} y={126} width={16} height={3 + mouth * 9} rx={2} fill={accent} opacity={0.9} />
              </>
            ) : (
              <>
                <rect x={92} y={150} width={16} height={28} fill={skin} stroke={INK} strokeWidth={4} />
                {c.style === 'labcoat' ? <path d="M56 112 Q50 170 70 172 L130 172 Q150 170 144 112 Z" fill={hair} stroke={INK} strokeWidth={4.5} /> : null}
                <circle cx={55} cy={120} r={9} fill={skin} stroke={INK} strokeWidth={4} />
                <circle cx={145} cy={120} r={9} fill={skin} stroke={INK} strokeWidth={4} />
                <ellipse cx={100} cy={116} rx={46} ry={48} fill={skin} stroke={INK} strokeWidth={5} />
                {c.style === 'cap' ? (
                  <>
                    <path d="M56 104 Q56 62 100 62 Q144 62 144 104 Z" fill={cloth} stroke={INK} strokeWidth={5} strokeLinejoin="round" />
                    <path d={facing > 0 ? 'M120 102 L176 104 Q174 114 140 112 Z' : 'M80 102 L24 104 Q26 114 60 112 Z'} fill={mix(cloth, INK, 0.3)} stroke={INK} strokeWidth={4.5} strokeLinejoin="round" />
                  </>
                ) : (
                  <path d="M54 120 Q46 66 100 62 Q154 64 146 120 Q142 96 124 88 Q110 102 86 94 Q70 102 60 98 Q56 106 54 120 Z" fill={hair} stroke={INK} strokeWidth={4.5} strokeLinejoin="round" />
                )}
                {/* brows */}
                <path d={`M${76 + lx * 5} ${100 - shock * 8 - mouth * 2} l14 ${-2}`} stroke={INK} strokeWidth={4} strokeLinecap="round" />
                <path d={`M${110 + lx * 5} ${98 - shock * 8 - mouth * 2} l14 ${2}`} stroke={INK} strokeWidth={4} strokeLinecap="round" />
                <ellipse cx={84 + lx * 6} cy={118 + ly * 4} rx={5} ry={eyeRy} fill={INK} />
                <ellipse cx={116 + lx * 6} cy={118 + ly * 4} rx={5} ry={eyeRy} fill={INK} />
                {c.style === 'hoodie' || c.style === 'labcoat' ? (
                  <g fill="none" stroke={INK} strokeWidth={3.5}>
                    <circle cx={84 + lx * 4} cy={118} r={14} />
                    <circle cx={116 + lx * 4} cy={118} r={14} />
                    <path d={`M${98 + lx * 4} 118 L${102 + lx * 4} 118`} />
                  </g>
                ) : null}
                <ellipse cx={72 + lx * 4} cy={136} rx={8} ry={4} fill={accent} opacity={0.25} />
                <ellipse cx={128 + lx * 4} cy={136} rx={8} ry={4} fill={accent} opacity={0.25} />
                {mouth > 0.06 || shock > 0.3 ? (
                  <ellipse cx={100 + lx * 5} cy={145} rx={7 + shock * 2} ry={2 + Math.max(mouth, shock * 0.9) * 8} fill="#7a2c2c" stroke={INK} strokeWidth={3.5} />
                ) : (
                  <path d={`M${91 + lx * 5} 143 Q${100 + lx * 5} 151 ${109 + lx * 5} 143`} fill="none" stroke={INK} strokeWidth={4} strokeLinecap="round" />
                )}
              </>
            )}
          </g>
        </g>
        {/* thought dots */}
        {thinking > 0
          ? [0, 1, 2].map(i => (
              <circle key={i} cx={100 + facing * (60 + i * 22)} cy={52 - i * 22} r={5 + i * 3} fill="#fffdf7" stroke={INK} strokeWidth={3.5} opacity={progress(thinking * 30, i * 6, 6)} />
            ))
          : null}
      </svg>
    </div>
  );
};

// ---------------------------------------------------------------------------------------------
// Sets the pencil sketches (paths are built from frame size so every aspect stays grounded)
// ---------------------------------------------------------------------------------------------

type Stroke = {d: string; w?: number; accent?: boolean; fill?: string};

function setStrokes(place: Place, W: number, H: number, g: number, u: number, seed: number): Stroke[] {
  const s: Stroke[] = [];
  const jag = (x: number, y: number, i: number) => `${x + rand(`j${seed}${i}x`, -3, 3) * u} ${y + rand(`j${seed}${i}y`, -3, 3) * u}`;
  if (place === 'desk') {
    const cx = W / 2;
    const top = g - 200 * u;
    s.push({d: `M${cx - 260 * u} ${top} L${cx + 260 * u} ${top} M${cx - 230 * u} ${top} L${cx - 230 * u} ${g} M${cx + 230 * u} ${top} L${cx + 230 * u} ${g}`, w: 5});
    s.push({d: `M${cx - 150 * u} ${top - 20 * u} L${cx - 150 * u} ${top - 200 * u} L${cx + 150 * u} ${top - 200 * u} L${cx + 150 * u} ${top - 20 * u} Z M${cx} ${top - 20 * u} L${cx} ${top} M${cx - 40 * u} ${top} L${cx + 40 * u} ${top}`, w: 5});
    for (let i = 0; i < 5; i++) s.push({d: `M${cx - 120 * u + (i % 2) * 30 * u} ${top - 170 * u + i * 30 * u} l${rand(`cl${seed}${i}`, 90, 200) * u} 0`, w: 6, accent: i % 2 === 0});
    s.push({d: `M${cx + 190 * u} ${top} l0 ${-50 * u} l${36 * u} 0 l0 ${50 * u} M${cx + 226 * u} ${top - 38 * u} q${18 * u} ${8 * u} 0 ${22 * u}`, w: 4});
  } else if (place === 'city') {
    let x = -20 * u;
    let i = 0;
    while (x < W + 20 * u) {
      const bw = rand(`bw${seed}${i}`, 90, 170) * u;
      const bh = rand(`bh${seed}${i}`, 0.18, 0.42) * H;
      s.push({d: `M${jag(x, g, i)} L${jag(x, g - bh, i + 1)} L${jag(x + bw, g - bh, i + 2)} L${jag(x + bw, g, i + 3)}`, w: 4});
      for (let r = 0; r < Math.floor(bh / (46 * u)) - 1; r++) {
        s.push({d: `M${x + 22 * u} ${g - bh + 30 * u + r * 46 * u} l${bw - 44 * u} 0`, w: 3, accent: rand(`lit${seed}${i}${r}`) > 0.75});
      }
      x += bw + rand(`gap${seed}${i}`, 10, 40) * u;
      i += 1;
    }
  } else if (place === 'servers') {
    const n = W > H ? 6 : 4;
    const rw = (W * 0.86) / n;
    for (let i = 0; i < n; i++) {
      const x = W * 0.07 + i * rw + 8 * u;
      const rh = H * (W > H ? 0.5 : 0.36);
      s.push({d: `M${x} ${g} L${x} ${g - rh} L${x + rw - 16 * u} ${g - rh} L${x + rw - 16 * u} ${g}`, w: 4});
      for (let k = 1; k < 7; k++) s.push({d: `M${x + 12 * u} ${g - rh + (k * rh) / 7} l${rw - 40 * u} 0`, w: 3});
      for (let k = 1; k < 7; k += 2) s.push({d: `M${x + rw - 44 * u} ${g - rh + (k * rh) / 7 - 12 * u} l${8 * u} 0`, w: 7, accent: true});
    }
  } else if (place === 'sky') {
    const cloud = (cx: number, cy: number, r: number) => `M${cx - r * 2.2} ${cy} q${-r * 0.2} ${-r * 0.9} ${r * 0.8} ${-r * 0.8} q${r * 0.3} ${-r * 1.1} ${r * 1.4} ${-r * 0.7} q${r * 0.9} ${-r * 0.6} ${r * 1.4} ${r * 0.5} q${r * 1} ${r * 0.1} ${r * 0.8} ${r * 1}`;
    s.push({d: cloud(W * 0.12, H * 0.32, 60 * u), w: 4});
    s.push({d: cloud(W * 0.86, H * 0.22, 46 * u), w: 4});
    s.push({d: cloud(W * 0.5, g + 70 * u, 120 * u), w: 4});
    // the paper plane the cast stands on
    s.push({d: `M${W * 0.08} ${g + 10 * u} L${W * 0.92} ${g - 30 * u} L${W * 0.3} ${g + 60 * u} Z M${W * 0.92} ${g - 30 * u} L${W * 0.36} ${g + 22 * u}`, w: 4, fill: '#fbfbf7'});
  } else if (place === 'night') {
    const mx = W * 0.82;
    const my = H * 0.2;
    s.push({d: `M${mx} ${my - 60 * u} A${60 * u} ${60 * u} 0 1 0 ${mx + 50 * u} ${my + 30 * u} A${46 * u} ${46 * u} 0 1 1 ${mx} ${my - 60 * u}`, w: 4, accent: true});
    s.push({d: `M${W * 0.06} ${g} L${W * 0.06} ${g - H * 0.34} L${W * 0.26} ${g - H * 0.34} L${W * 0.26} ${g} M${W * 0.16} ${g - H * 0.34} L${W * 0.16} ${g} M${W * 0.06} ${g - H * 0.17} L${W * 0.26} ${g - H * 0.17}`, w: 4});
  }
  return s;
}

/** Hand-drawn ground line with a little jitter. */
function groundPath(W: number, g: number, u: number, seed: number) {
  const pts = Array.from({length: 13}, (_, i) => `${(W * i) / 12} ${g + rand(`gr${seed}${i}`, -4, 4) * u}`);
  return `M${-10} ${g} L${pts.join(' L')} L${W + 10} ${g}`;
}

/** The glowing loop the pencil draws around the sketch (a wobbly ellipse). */
function loopPoint(cx: number, cy: number, rx: number, ry: number, t: number, seed: number) {
  const a = -Math.PI / 2 + t * Math.PI * 2.08;
  const k = 1 + 0.05 * Math.sin(a * 3 + seed);
  return [cx + Math.cos(a) * rx * k, cy + Math.sin(a) * ry * k] as const;
}

const Pencil: React.FC<{x: number; y: number; size: number; angle: number; accent: string}> = ({x, y, size, angle, accent}) => (
  <svg width={size} height={size} viewBox="0 0 100 100" style={{position: 'absolute', left: x, top: y - size, overflow: 'visible', transform: `rotate(${angle}deg)`, transformOrigin: '0% 100%', filter: 'drop-shadow(0 6px 8px rgba(0,0,0,.25))'}}>
    <path d="M0 100 L10 78 L22 90 Z" fill={INK} />
    <path d="M10 78 L20 68 L32 80 L22 90 Z" fill="#f2cf9e" stroke={INK} strokeWidth={3} strokeLinejoin="round" />
    <path d="M20 68 L80 8 L92 20 L32 80 Z" fill={accent} stroke={INK} strokeWidth={3} strokeLinejoin="round" />
    <path d="M26 74 L86 14" stroke="rgba(255,255,255,.45)" strokeWidth={4} />
    <path d="M80 8 L88 0 L100 12 L92 20 Z" fill="#e88a9a" stroke={INK} strokeWidth={3} strokeLinejoin="round" />
  </svg>
);

/** One beat's set + sketch, drawn by the pencil as the scene opens. */
const SetLayer: React.FC<{
  beat: BeatProps;
  prev: BeatProps | null;
  index: number;
  lead: number;
  pal: Pal;
  W: number;
  H: number;
  g: number;
  u: number;
  sketchAt: {x: number; y: number; size: number};
}> = ({beat, prev, index, lead, pal, W, H, g, u, sketchAt}) => {
  const frame = useCurrentFrame() - lead;
  const samePlace = prev !== null && prev.place === beat.place;
  const draw = samePlace ? 1 : progress(frame, 0, 38, ease.cinematic);
  const strokes = React.useMemo(() => setStrokes(beat.place, W, H, g, u, index), [beat.place, W, H, g, u, index]);
  const fillIn = samePlace ? 1 : progress(frame, -6, 22, ease.cinematic);
  const sky = beat.place === 'sky';
  const night = beat.place === 'night';
  const ink = night || sky ? (pal.dark || night ? '#e9eefc' : INK) : pal.line;
  const hasSketch = beat.sketch !== 'none';
  const loopP = progress(frame, 6, 26, ease.snappy);
  const iconP = progress(frame, 18, 34, ease.cinematic);
  const {x: cx, y: cy, size} = sketchAt;
  const rx = size * 0.72;
  const ry = size * 0.6;
  const loopD = React.useMemo(() => {
    const pts = Array.from({length: 60}, (_, i) => loopPoint(cx, cy, rx, ry, i / 59, index));
    return `M${pts.map(p => `${p[0]} ${p[1]}`).join(' L')}`;
  }, [cx, cy, rx, ry, index]);
  // The pencil traces the loop, scribbles the object, then floats beside it.
  const tip = loopPoint(cx, cy, rx, ry, loopP, index);
  const scribble = [cx + Math.sin(frame / 2.2) * size * 0.25, cy + Math.cos(frame / 3.1) * size * 0.22];
  const rest = [cx + rx * 0.95, cy - ry * 0.9 + Math.sin(frame / 14) * 8 * u];
  const toScribble = progress(frame, 28, 8);
  const toRest = progress(frame, 50, 16, ease.cinematic);
  const px = tip[0] + (scribble[0] - tip[0]) * toScribble + (rest[0] - (tip[0] + (scribble[0] - tip[0]) * toScribble)) * toRest;
  const py = tip[1] + (scribble[1] - tip[1]) * toScribble + (rest[1] - (tip[1] + (scribble[1] - tip[1]) * toScribble)) * toRest;
  const pencilIn = progress(frame, 0, 8);
  const glowPulse = 0.75 + 0.25 * Math.sin(frame / 10);
  return (
    <AbsoluteFill>
      {sky ? <AbsoluteFill style={{opacity: fillIn, background: `linear-gradient(180deg, ${pal.skyTop} 0%, ${mix(pal.skyTop, pal.skyLow, 0.6)} 55%, ${pal.skyLow} 100%)`}} /> : null}
      {night ? <AbsoluteFill style={{opacity: fillIn, background: `radial-gradient(circle at 80% 18%, ${mix(pal.night, '#ffffff', 0.18)} 0%, ${pal.night} 45%)`}} /> : null}
      {sky ? <AbsoluteFill style={{opacity: fillIn * 0.7, background: `radial-gradient(circle at 50% ${(g / H) * 100}%, ${alpha('#fff2c9', 0.8)} 0%, transparent 40%)`}} /> : null}
      {night ? <Particles count={46} color="#ffffff" seed={`st${index}`} size={[1.5, 4]} speed={0.08} opacity={0.8 * fillIn} /> : null}
      {sky ? <Particles count={24} color="#ffffff" seed={`sk${index}`} size={[2, 5]} speed={0.4} blur opacity={0.5 * fillIn} /> : null}
      <svg width={W} height={H} style={{position: 'absolute', inset: 0, overflow: 'visible'}}>
        {beat.place !== 'sky' ? <path d={groundPath(W, g, u, 0)} fill="none" stroke={ink} strokeWidth={4 * u} strokeLinecap="round" /> : null}
        {strokes.map((st, i) => {
          const k = Math.max(0, Math.min(1, draw * (strokes.length * 0.35 + 1) - i * 0.35));
          return (
            <path
              key={i}
              d={st.d}
              pathLength={1}
              strokeDasharray="1 1"
              strokeDashoffset={1 - k}
              fill={st.fill ? alpha(st.fill, k) : 'none'}
              stroke={st.accent ? pal.accent : ink}
              strokeOpacity={st.accent ? 0.95 : sky || night ? 0.9 : 0.55}
              strokeWidth={(st.w ?? 4) * u}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          );
        })}
        {hasSketch ? (
          <path d={loopD} pathLength={1} strokeDasharray="1 1" strokeDashoffset={1 - loopP} fill="none" stroke={pal.accent} strokeWidth={5 * u} strokeLinecap="round" style={{filter: `drop-shadow(0 0 ${10 * u * glowPulse}px ${alpha(pal.accent, 0.9)})`}} />
        ) : null}
      </svg>
      {hasSketch ? (
        <div style={{position: 'absolute', left: cx - size / 2, top: cy - size / 2, transform: `translateY(${Math.sin(frame / 18) * 6 * u}px) rotate(${Math.sin(frame / 25) * 3}deg)`}}>
          <LineIcon name={beat.sketch} progress={iconP} size={size} color={night || (sky && pal.dark) ? '#ffffff' : pal.dark ? pal.line : INK} strokeWidth={4.2} />
        </div>
      ) : null}
      {hasSketch ? <Pencil x={px} y={py} size={110 * u} angle={-8 + Math.sin(frame / 6) * 6 * (1 - toRest)} accent={pal.accent} /> : null}
      {!hasSketch && !samePlace && strokes.length ? (
        <div style={{opacity: pencilIn * (1 - progress(frame, 36, 10))}}>
          <Pencil x={W * (0.1 + 0.8 * draw)} y={g - H * 0.12 - Math.sin(draw * Math.PI * 6) * 40 * u} size={110 * u} angle={-6} accent={pal.accent} />
        </div>
      ) : null}
    </AbsoluteFill>
  );
};

// ---------------------------------------------------------------------------------------------
// Bubbles, narration strip, HUD
// ---------------------------------------------------------------------------------------------

const Bubble: React.FC<{name: string; line: string; cx: number; bottom: number; tipX: number; tipY: number; maxW: number; facing: number; pal: Pal; u: number; inP: number; outP: number; start: number; stagger: number}> = ({name, line, cx, bottom, tipX, tipY, maxW, facing, pal, u, inP, outP, start, stagger}) => {
  const scale = (0.4 + 0.6 * inP) * (1 - 0.15 * outP);
  const baseX = cx - facing * 50 * u;
  const op = Math.min(1, inP * 2) * (1 - outP);
  const b = bottom - 2 * u;
  return (
    <>
      <div style={{position: 'absolute', left: cx, top: 0, width: 0, height: 0}}>
        <div style={{position: 'absolute', left: 0, top: bottom, transform: `translate(-50%, -100%) scale(${scale})`, transformOrigin: `${50 - facing * 20}% 100%`, opacity: op, width: 'max-content', maxWidth: maxW, background: pal.surface, border: `${4 * u}px solid ${pal.ink}`, borderRadius: 38 * u, padding: `${30 * u}px ${38 * u}px ${26 * u}px`, boxShadow: `${8 * u}px ${10 * u}px 0 ${alpha(pal.dark ? '#000000' : INK, 0.18)}`}}>
          <div style={{position: 'absolute', top: -22 * u, left: 30 * u, background: pal.accent, color: '#16130f', fontFamily: fonts.mono, fontWeight: 700, fontSize: 22 * u, letterSpacing: '0.14em', textTransform: 'uppercase', padding: `${5 * u}px ${14 * u}px`, borderRadius: 10 * u, border: `${3 * u}px solid ${INK}`}}>{name}</div>
          <KineticText text={line} start={start} stagger={stagger} duration={12} style="rise" accent={pal.accent} textStyle={{fontFamily: fonts.grotesk, fontWeight: 700, fontSize: 44 * u, lineHeight: 1.18, letterSpacing: '-0.01em', color: pal.ink}} />
        </div>
      </div>
      {/* the tail is drawn over the bubble's border so the two read as one shape */}
      <svg style={{position: 'absolute', inset: 0, overflow: 'visible', opacity: op * Math.min(1, inP * 1.5)}} width="100%" height="100%">
        <path d={`M${baseX - 20 * u} ${b - 8 * u} L${tipX} ${tipY} L${baseX + 20 * u} ${b - 8 * u} Z`} fill={pal.surface} />
        <path d={`M${baseX - 20 * u} ${b} L${tipX} ${tipY} L${baseX + 20 * u} ${b}`} fill="none" stroke={pal.ink} strokeWidth={4 * u} strokeLinejoin="round" strokeLinecap="round" />
      </svg>
    </>
  );
};

const NarratorStrip: React.FC<{line: string; W: number; top: number; pal: Pal; u: number; inP: number; outP: number; start: number; stagger: number; maxW: number}> = ({line, W, top, pal, u, inP, outP, start, stagger, maxW}) => (
  <div style={{position: 'absolute', left: W / 2, top, transform: `translate(-50%, ${(1 - inP) * -30 * u}px) rotate(${-1.2 + outP * 3}deg)`, opacity: Math.min(1, inP * 2) * (1 - outP), width: 'max-content', maxWidth: maxW, background: pal.surface, padding: `${22 * u}px ${36 * u}px`, boxShadow: `0 ${10 * u}px ${30 * u}px ${alpha('#000', 0.18)}`, borderLeft: `${8 * u}px solid ${pal.accent}`}}>
    {[-1, 1].map(s => (
      <div key={s} style={{position: 'absolute', top: -14 * u, [s < 0 ? 'left' : 'right']: 24 * u, width: 70 * u, height: 26 * u, background: alpha(pal.accent, 0.45), transform: `rotate(${s * 6}deg)`}} />
    ))}
    <KineticText text={line} start={start} stagger={stagger} duration={14} style="blur" accent={pal.accent} textStyle={{fontFamily: fonts.serif, fontStyle: 'italic', fontWeight: 600, fontSize: 44 * u, lineHeight: 1.18, color: pal.ink}} />
  </div>
);

const Timer: React.FC<{left: number; total: number; fps: number; color: string; accent: string; u: number; right: number; top: number}> = ({left, total, fps, color, accent, u, right, top}) => {
  const frame = useCurrentFrame();
  const s = Math.max(0, Math.ceil(left / fps));
  const r = 17 * u;
  const p = Math.max(0, Math.min(1, left / Math.max(1, total)));
  const low = s <= 5;
  return (
    <div style={{position: 'absolute', right, top, display: 'flex', alignItems: 'center', gap: 12 * u, fontFamily: fonts.mono, fontWeight: 700, fontSize: 30 * u, color, letterSpacing: '0.06em'}}>
      <svg width={r * 2 + 8 * u} height={r * 2 + 8 * u} style={{overflow: 'visible'}}>
        <circle cx={r + 4 * u} cy={r + 4 * u} r={r} fill="none" stroke={alpha(color, 0.25)} strokeWidth={4 * u} />
        <circle cx={r + 4 * u} cy={r + 4 * u} r={r} fill="none" stroke={low ? '#e5484d' : accent} strokeWidth={4 * u} pathLength={1} strokeDasharray="1 1" strokeDashoffset={1 - p} transform={`rotate(-90 ${r + 4 * u} ${r + 4 * u})`} strokeLinecap="round" />
        <circle cx={r + 4 * u} cy={r + 4 * u} r={5 * u} fill={low && Math.floor(frame / (fps / 2)) % 2 ? '#e5484d' : color} />
      </svg>
      <span>{`${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`}</span>
    </div>
  );
};

// ---------------------------------------------------------------------------------------------
// The film
// ---------------------------------------------------------------------------------------------

/** 0→1 mouth opening while the scene's narration words play. */
function mouthAt(scene: Scene, localFrame: number, fps: number): number {
  const caps = scene.captions.length ? scene.captions : evenCaptions(scene.text, scene.audio.duration * 1000);
  const ms = (localFrame / fps) * 1000;
  const i = caps.findIndex(c => ms >= c.startMs && ms < c.endMs);
  if (i < 0) return 0;
  const c = caps[i];
  const p = (ms - c.startMs) / Math.max(1, c.endMs - c.startMs);
  return Math.abs(Math.sin(p * Math.PI * 2)) * (0.55 + 0.45 * rand(`m${i}`));
}

const Dialogue: React.FC<EntryProps<Props>> = ({media, props}) => {
  const frame = useCurrentFrame();
  const {fps, width: W, height: H} = useVideoConfig();
  const look = useLook();
  const base = PALETTES[props.palette];
  const pal: Pal = look ? fromLook(look) : {...base, accent: media.accent ?? base.accent, ink: INK};
  const u = Math.min(W, H) / 1080;
  const portrait = H > W * 1.1;
  const timeline = useSceneTimeline(media);
  const contentEnd = useContentFrames(media);
  const beats = props.beats;
  const cast = props.cast;
  const offset = timeline.length > beats.length ? 1 : 0;
  const beatOf = (sceneIndex: number) => beats[Math.max(0, Math.min(beats.length - 1, sceneIndex - offset))];
  const sceneIdx = Math.max(0, timeline.findIndex((t, i) => frame >= t.from && (i === timeline.length - 1 || frame < timeline[i + 1].from)));
  const inTitle = offset === 1 && sceneIdx === 0;
  const beatIdx = Math.max(0, Math.min(beats.length - 1, sceneIdx - offset));
  const beat = beats[beatIdx];
  const prevBeat = beatIdx > 0 ? beats[beatIdx - 1] : null;
  const t = timeline[sceneIdx];
  const local = frame - t.from;
  const firstBeatFrom = timeline[offset]?.from ?? 0;

  // Stage geometry: keep the cast above the shared caption band in look mode.
  const safe = look ? captionSafeBottom(look) : props.showCaptions ? (portrait ? 0.2 : 0.15) : portrait ? 0.14 : 0.1;
  const g = H * (1 - safe) - (look ? 10 * u : 0);
  const square = !portrait && H >= W * 0.9;
  const charH = Math.min(H * (portrait ? (look ? 0.3 : 0.34) : square ? 0.4 : look ? 0.36 : 0.47), W * (portrait ? 0.6 : 0.5));
  const xs = cast.length === 2 ? [W * (portrait ? 0.27 : 0.25), W * (portrait ? 0.73 : 0.75)] : [W * (portrait ? 0.5 : 0.3)];
  const facings = cast.length === 2 ? [1, -1] : [1];
  // Tall frames: the sketch floats in the band between the HUD and the speech bubbles.
  // (conservative: the camera zoom pushes everything a little further up from the ground)
  const bubbleTopGuess = g - charH - 290 * u;
  const tallSketch = Math.min(W * 0.28, (bubbleTopGuess - H * 0.09) * 0.62);
  const sketchAt = portrait
    ? {x: W / 2, y: (H * 0.09 + bubbleTopGuess) / 2, size: tallSketch}
    : cast.length === 2
      ? {x: W / 2, y: g - charH * 0.52, size: charH * 0.48}
      : {x: W * 0.68, y: g - charH * 0.55, size: charH * 0.6};

  // Camera: drift toward whoever speaks.
  const focusFor = (b: BeatProps | null) => (b && b.speaker !== 'narrator' && cast.length === 2 ? (b.speaker === 'a' ? -1 : 1) : 0);
  const camK = progress(local, 0, 24, ease.cinematic);
  const focus = inTitle ? 0 : focusFor(prevBeat) + (focusFor(beat) - focusFor(prevBeat)) * camK;
  const zoom = 1.03 + 0.03 * tween(frame, [0, contentEnd], [0, 1], ease.cinematic) + (inTitle ? 0 : 0.02 * Math.abs(focus));
  const camX = -focus * W * 0.03;

  const speakerIndex = (b: BeatProps) => (b.speaker === 'b' && cast.length === 2 ? 1 : b.speaker === 'narrator' ? -1 : 0);
  const end = Math.min(t.from + t.durationInFrames, contentEnd);
  const sceneLen = Math.max(1, end - t.from);

  // Characters.
  const people = cast.map((c, i) => {
    const enter = offset ? spring({frame: frame - 6 - i * 6, fps, config: {damping: 14, stiffness: 120}}) : spring({frame: frame - i * 4, fps, config: {damping: 14, stiffness: 140}});
    const sp = inTitle ? -2 : speakerIndex(beat);
    const acting = !inTitle && (sp === i || sp === -1);
    const action: Action | 'idle' = inTitle ? (local > 10 ? 'wave' : 'idle') : acting ? beat.action : 'idle';
    const prevAction: Action | 'idle' = prevBeat && (speakerIndex(prevBeat) === i || speakerIndex(prevBeat) === -1) ? prevBeat.action : 'idle';
    const blend = progress(local, 0, 10, ease.snappy);
    const pose = lerpPose(poseFor(inTitle ? 'idle' : prevAction, frame), poseFor(action, frame), blend);
    const speaking = !inTitle && sp === i && local < sceneLen;
    const mouth = speaking ? mouthAt(t.scene, local, fps) : 0;
    const blinkCycle = (frame + i * 37) % 100;
    const blink = blinkCycle < 4 ? Math.abs(blinkCycle - 2) / 2 : 1;
    const other = cast.length === 2 ? xs[1 - i] : sketchAt.x;
    const lookAtSketch = !inTitle && beat.sketch !== 'none' && (sp !== i || beat.action === 'point');
    const lookX = lookAtSketch ? Math.sign(sketchAt.x - xs[i]) || facings[i] : Math.sign(other - xs[i]) || facings[i];
    const lookY = lookAtSketch && portrait ? -1 : action === 'think' ? -1 : 0;
    const nod = !speaking && !inTitle ? Math.sin(frame / 9) * 2.5 * progress(local, 12, 10) : 0;
    const tilt = (action === 'think' ? -8 * facings[i] : action === 'shrug' ? 6 * facings[i] : 0) * blend + nod + (speaking ? Math.sin(frame / 8) * 2 : 0);
    const jump = action === 'cheer' ? Math.abs(Math.sin(frame / 7)) * blend : action === 'shock' ? Math.max(0, Math.sin(Math.min(Math.PI, local / 6))) * 0.6 : 0;
    const shock = action === 'shock' ? blend : 0;
    const thinking = action === 'think' ? progress(local, 6, 20) : 0;
    return {c, x: xs[i], facing: facings[i], pose, mouth, blink, tilt, jump, look: [lookX, lookY] as [number, number], shock, enter, thinking};
  });

  // Bubble pacing: words land by ~60% of the scene and stay until it closes.
  const words = beat.line.split(/\s+/).filter(Boolean).length;
  const revealStart = t.from + 6;
  const stagger = Math.max(1.5, Math.min(5, (sceneLen * 0.55) / Math.max(1, words)));
  const bubbleIn = progress(frame, t.from + 2, 12, ease.overshoot);
  const bubbleOut = sceneIdx === timeline.length - 1 ? progress(frame, contentEnd - 8, 8, ease.accelerate) : progress(frame, t.from + t.durationInFrames - 7, 7, ease.accelerate);
  const sp = speakerIndex(beat);
  const speaker = sp >= 0 ? people[sp] : null;
  const headY = g - charH * 0.98 - (speaker ? speaker.jump * charH * 0.12 : 0);
  const bubbleMaxW = portrait ? W * 0.82 : square ? W * 0.62 : cast.length === 2 ? W * 0.4 : W * 0.46;
  const bubbleCx = speaker ? (portrait ? W / 2 + speaker.facing * -W * 0.04 : Math.max(bubbleMaxW / 2 + W * 0.04, Math.min(W - bubbleMaxW / 2 - W * 0.04, speaker.x + speaker.facing * W * 0.14))) : W / 2;
  const bubbleBottom = headY - (portrait ? 70 : 54) * u;
  const topBand = H * (portrait ? 0.07 : 0.05);

  // Title card (extra first scene).
  const titleOut = offset ? progress(frame, firstBeatFrom - 12, 12, ease.accelerate) : 1;
  const titleFont = (portrait ? 104 : 96) * u;

  const corner = Math.round(Math.min(W, H) * 0.045);
  const hudColor = pal.dark || beat.place === 'night' ? '#eef2ff' : pal.text;
  const showHud = !inTitle || local > 20;
  const titleLeaks = timeline.slice(1).map(tl => tl.from);
  const leakOpacity = pal.dark ? 0.55 : 0.3;

  return (
    <AbsoluteFill style={{overflow: 'hidden', background: pal.bg}}>
      {/* static paper */}
      <AbsoluteFill style={{background: `radial-gradient(ellipse at 50% 38%, ${mix(pal.bg, pal.surface, 0.55)} 0%, ${pal.bg} 55%, ${pal.bg2} 100%)`}} />
      {/* stage (camera) */}
      <AbsoluteFill style={{transform: `translateX(${camX}px) scale(${zoom})`, transformOrigin: `50% ${(g / H) * 100}%`}}>
        <SceneSeries
          media={media}
          overlap={16}
          transition={i => (i > 0 && beatOf(i).place !== beatOf(i - 1).place ? 'wipe' : 'blur')}
          renderScene={({index, timed}) => {
            const isTitle = offset === 1 && index === 0;
            const b = isTitle ? {...beats[0], sketch: 'none' as const, place: 'paper' as const} : beatOf(index);
            const pb = index - offset > 0 ? beatOf(index - 1) : null;
            return <SetLayer beat={b} prev={pb} index={index} lead={index === 0 ? 0 : 8} pal={pal} W={W} H={H} g={g} u={u} sketchAt={sketchAt} />;
          }}
        />
        {/* soft contact shadows */}
        {people.map((p, i) => (
          <div key={`sh${i}`} style={{position: 'absolute', left: p.x - charH * 0.24, top: g - charH * 0.03, width: charH * 0.48, height: charH * 0.06, borderRadius: '50%', background: alpha('#000', 0.18 * (1 - p.jump * 0.5) * p.enter)}} />
        ))}
        {people.map((p, i) => (
          <Character key={i} c={p.c} x={p.x} groundY={g} h={charH} facing={p.facing} pose={p.pose} mouth={p.mouth} blink={p.blink} tilt={p.tilt} jump={p.jump} look={p.look} shock={p.shock} enter={p.enter} accent={pal.accent} thinking={p.thinking} />
        ))}
      </AbsoluteFill>

      {/* title card */}
      {offset && frame < firstBeatFrom ? (
        <AbsoluteFill style={{opacity: 1 - titleOut, transform: `translateY(${-titleOut * 40 * u}px)`}}>
          <div style={{position: 'absolute', left: W * 0.08, right: W * 0.08, top: portrait ? H * 0.16 : H * 0.1, textAlign: 'center'}}>
            <div style={{fontFamily: fonts.mono, fontSize: 26 * u, letterSpacing: '0.4em', color: pal.accent, opacity: progress(frame, 2, 12), marginBottom: 18 * u}}>A SHORT STORY</div>
            <KineticText text={props.title} start={6} stagger={4} style="rise" align="center" accent={pal.accent} textStyle={{fontFamily: fonts.serifDisplay, fontSize: titleFont, lineHeight: 1.02, color: pal.dark ? pal.text : INK, letterSpacing: '-0.01em'}} />
            <svg width={W * 0.5} height={30 * u} viewBox="0 0 400 30" style={{marginTop: 14 * u, overflow: 'visible'}} preserveAspectRatio="none">
              <path d="M4 18 C 90 6, 180 26, 260 14 S 380 10, 396 16" pathLength={1} strokeDasharray="1 1" strokeDashoffset={1 - progress(frame, 18, 22, ease.cinematic)} fill="none" stroke={pal.accent} strokeWidth={6} strokeLinecap="round" />
            </svg>
            <div style={{fontFamily: fonts.hand, fontSize: 46 * u, color: pal.muted, marginTop: 12 * u, opacity: progress(frame, 24, 14)}}>
              starring {cast.map(c => c.name).join(' & ')}
            </div>
          </div>
        </AbsoluteFill>
      ) : null}

      {/* dialogue */}
      {!inTitle && frame < contentEnd ? (
        speaker ? (
          <Bubble
            key={`b${sceneIdx}`}
            name={speaker.c.name}
            line={beat.line}
            cx={bubbleCx}
            bottom={bubbleBottom}
            tipX={speaker.x + speaker.facing * charH * 0.1}
            tipY={headY + 8 * u}
            maxW={bubbleMaxW}
            facing={speaker.x < bubbleCx ? 1 : speaker.x > bubbleCx ? -1 : 0}
            pal={pal}
            u={u}
            inP={bubbleIn}
            outP={bubbleOut}
            start={revealStart}
            stagger={stagger}
          />
        ) : (
          <NarratorStrip key={`n${sceneIdx}`} line={beat.line} W={W} top={topBand + 70 * u} pal={pal} u={u} inP={bubbleIn} outP={bubbleOut} start={revealStart} stagger={stagger} maxW={W * (portrait ? 0.84 : 0.62)} />
        )
      ) : null}

      {/* HUD: story label and countdown */}
      {showHud ? (
        <div style={{opacity: progress(inTitle ? local : frame - firstBeatFrom + 20, 20, 12) * (1 - progress(frame, contentEnd - 6, 6))}}>
          <div style={{position: 'absolute', left: corner, top: corner, display: 'flex', alignItems: 'center', gap: 12 * u, fontFamily: fonts.mono, fontSize: 22 * u, letterSpacing: '0.2em', textTransform: 'uppercase', color: hudColor, maxWidth: W * 0.55}}>
            <span style={{width: 12 * u, height: 12 * u, borderRadius: '50%', background: pal.accent, flexShrink: 0}} />
            <span style={{whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', opacity: 0.8}}>{props.title.replace(/\*/g, '')}</span>
          </div>
          {props.timer ? <Timer left={contentEnd - frame} total={contentEnd - firstBeatFrom} fps={fps} color={hudColor} accent={pal.accent} u={u} right={corner} top={corner - 10 * u} /> : null}
        </div>
      ) : null}

      {props.showCaptions
        ? timeline.map(tl => (
            <Sequence key={tl.index} from={tl.from} durationInFrames={Math.max(1, Math.min(tl.durationInFrames, contentEnd - tl.from))}>
              <AbsoluteFill style={{justifyContent: 'flex-end', padding: portrait ? `0 7% ${H * 0.07}px` : `0 18% ${H * 0.035}px`}}>
                <StyledCaptions scene={tl.scene} variant="karaoke" accent={pal.accent} color={pal.dark ? pal.text : INK} font={fonts.sans} size={40 * u} words={portrait ? 5 : 8} weight={800} shadow={pal.dark} />
              </AbsoluteFill>
            </Sequence>
          ))
        : null}

      {titleLeaks.map((f, i) => (
        <LightLeak key={i} from={Math.max(0, f - 10)} durationInFrames={30} seed={i + 3} hueShift={pal.dark ? 180 : 0} opacity={leakOpacity} />
      ))}
      <Vignette strength={pal.dark ? 0.55 : 0.22} />
      <Grain opacity={0.06} />
      <NarrationTrack media={media} />
      <AdWeave media={media} theme={{background: pal.bg, text: pal.dark ? pal.text : INK, font: fonts.sans}} />
    </AbsoluteFill>
  );
};

export default defineEntry({
  id: 'story-character-dialogue',
  schema: Props,
  component: Dialogue,
  captionHold: ({props, media, fps}) => (media.scenes.length > props.beats.length ? Math.round(media.scenes[0].audio.duration * fps) : 0),
});
