import React from 'react';
import {AbsoluteFill, Sequence, spring, useCurrentFrame, useVideoConfig} from 'remotion';
import {AdWeave, NarrationTrack, captionSafeBottom, defineEntry, mix, useContentFrames, useLook, useSceneTimeline, type ActiveLook, type EntryProps} from '@viralaunch/kit';
import {CameraImage, Grain, KineticText, LightLeak, LineIcon, Particles, StyledCaptions, Vignette, alpha, countUp, ease, fonts, progress, rand, tween} from '@viralaunch/kit/fx';
import {Props, type Story} from './schema';

/** City colours: sky, ground plate, river, three building faces (top/left/right), windows and the news card. */
type Pal = {
  skyTop: string; skyBottom: string; glow: string; road: string; lot: string; plateSide: string; park: string; tree: string;
  water: string; waterHi: string; top: string; left: string; right: string; window: string; lit: boolean; edge: string;
  card: string; text: string; muted: string; accent: string; light: boolean;
};

const PALETTES: Record<Props['timeOfDay'], Pal> = {
  night: {skyTop: '#050a1a', skyBottom: '#172852', glow: '#2c4a8a', road: '#18213d', lot: '#232e52', plateSide: '#0a1022', park: '#1d3a3e', tree: '#2f6052', water: '#113a66', waterHi: '#6cb8ff', top: '#3b4875', left: '#2a355a', right: '#1d2645', window: '#ffd27a', lit: true, edge: 'rgba(0,0,0,.35)', card: '#0e1530', text: '#eef3ff', muted: '#93a0c4', accent: '#4fd1ff', light: false},
  dusk: {skyTop: '#1d1238', skyBottom: '#e27d5d', glow: '#ffb36b', road: '#433552', lot: '#5a476e', plateSide: '#251a33', park: '#4b5a5c', tree: '#5d7c5c', water: '#3a5790', waterHi: '#ffc08a', top: '#a68aa9', left: '#7a6186', right: '#5b486b', window: '#ffcf7a', lit: true, edge: 'rgba(20,0,30,.3)', card: '#1e1430', text: '#fff3ea', muted: '#cbb2c6', accent: '#ff9f45', light: false},
  day: {skyTop: '#94cdfb', skyBottom: '#e9f6ff', glow: '#ffffff', road: '#c2c8cf', lot: '#e3e8db', plateSide: '#87929f', park: '#b6da9f', tree: '#69aa58', water: '#47a6df', waterHi: '#d9f2ff', top: '#ffffff', left: '#dde2ea', right: '#b6c0ce', window: '#6b88ad', lit: false, edge: 'rgba(30,40,60,.28)', card: '#ffffff', text: '#121a26', muted: '#5b6878', accent: '#ff5a2c', light: true},
};

/** The city in a sequence's shared look: sky, ground and buildings tinted from the look's palette. */
const fromLook = (l: ActiveLook): Pal => {
  const p = l.palette;
  const dark = l.tone === 'dark';
  const road = mix(p.bg2, p.text, dark ? 0.06 : 0.12);
  const lot = dark ? mix(p.bg2, p.surface, 0.4) : mix(p.bg, p.surface, 0.5);
  const water = mix(p.bg2, p.accent, dark ? 0.32 : 0.4);
  return {
    skyTop: p.bg, skyBottom: p.bg2, glow: mix(p.bg2, p.accent, 0.35), road, lot, plateSide: mix(road, '#000000', 0.35),
    park: mix(lot, '#3f8f5a', 0.3), tree: mix(lot, '#2f7a48', 0.6), water, waterHi: mix(water, p.text, 0.5),
    top: dark ? mix(p.surface, p.text, 0.3) : p.surface, left: mix(p.surface, p.text, dark ? 0.18 : 0.1), right: mix(p.surface, p.text, dark ? 0.08 : 0.2),
    window: dark ? mix(p.accent, '#ffffff', 0.35) : mix(p.line, p.surface, 0.35), lit: dark, edge: dark ? 'rgba(0,0,0,.35)' : alpha(p.line, 0.35),
    card: p.surface, text: p.text, muted: p.muted, accent: p.accent, light: !dark,
  };
};

/** Accent as text on the card: deepened toward the text colour on light palettes so it reads. */
const deep = (p: Pal) => (p.light ? mix(p.accent, p.text, 0.35) : p.accent);
function inkOn(hex: string) {
  const n = parseInt(hex.slice(1), 16);
  const lum = (0.299 * ((n >> 16) & 255) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255)) / 255;
  return lum > 0.6 ? '#0b0d14' : '#ffffff';
}

// ---------------------------------------------------------------------------------------------
// Isometric city
// ---------------------------------------------------------------------------------------------

const G = 10; // lots per side
const TW = 120; // tile width (world px)
const TH = 60; // tile height
const HU = 62; // one storey block of height
const RIVER = 5; // lot row taken by the river
const BRIDGES = [3, 7]; // road lines that cross the river
/** Story lots, spread over both banks; story i gets LOTS[i]. */
const LOTS: Array<[number, number]> = [[2, 2], [7, 2], [2, 7], [7, 7], [4, 3], [5, 8]];
const STORY_H = 1.9;
const ACTIVE_H = 3.1;

const iso = (gx: number, gy: number, z = 0): [number, number] => [(gx - gy) * (TW / 2), (gx + gy) * (TH / 2) - z * HU];
const pts = (...p: Array<[number, number]>) => p.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(' ');

type Lot = {i: number; j: number; kind: 'building' | 'park' | 'story'; h: number; story: number};

function buildCity(): Lot[] {
  const lots: Lot[] = [];
  for (let i = 0; i < G; i++)
    for (let j = 0; j < G; j++) {
      if (j === RIVER) continue;
      const story = LOTS.findIndex(([a, b]) => a === i && b === j);
      const centre = 1 - Math.min(1, Math.hypot(i - 4.5, j - 4.5) / 6.5);
      const r = rand(`k${i}-${j}`);
      const kind = story >= 0 ? 'story' : r < 0.14 ? 'park' : 'building';
      const h = 0.32 + rand(`h${i}-${j}`) ** 2 * 1.15 + centre * 0.45;
      lots.push({i, j, kind, h, story});
    }
  return lots.sort((a, b) => a.i + a.j - (b.i + b.j) || a.i - b.i);
}

/** One block: left and right faces, roof, rows of windows. */
const Block: React.FC<{i: number; j: number; h: number; m: number; base?: number; top: string; left: string; right: string; pal: Pal; seed: string; frame: number}> = ({i, j, h, m, base = 0, top, left, right, pal, seed, frame}) => {
  if (h <= 0.01) return null;
  const a = (z: number) => iso(i + m, j + m, z + base);
  const b = (z: number) => iso(i + 1 - m, j + m, z + base);
  const c = (z: number) => iso(i + 1 - m, j + 1 - m, z + base);
  const d = (z: number) => iso(i + m, j + 1 - m, z + base);
  const rows: number[] = [];
  for (let z = 0.24; z < h - 0.14; z += 0.27) rows.push(z);
  const win = (p: [number, number], q: [number, number], k: number, side: string) => {
    const on = pal.lit ? 0.35 + 0.65 * (Math.sin(frame / 23 + rand(`${seed}${side}${k}`) * 40) > -0.6 ? rand(`${seed}w${side}${k}`) : 0.1) : 0.55;
    const ix = (q[0] - p[0]) * 0.12;
    const iy = (q[1] - p[1]) * 0.12;
    return <line key={side + k} x1={p[0] + ix} y1={p[1] + iy} x2={q[0] - ix} y2={q[1] - iy} stroke={pal.window} strokeOpacity={on} strokeWidth={7} strokeDasharray="11 8" />;
  };
  return (
    <g>
      <polygon points={pts(d(h), c(h), c(0), d(0))} fill={left} stroke={pal.edge} strokeWidth={1} vectorEffect="non-scaling-stroke" />
      <polygon points={pts(c(h), b(h), b(0), c(0))} fill={right} stroke={pal.edge} strokeWidth={1} vectorEffect="non-scaling-stroke" />
      {rows.map((z, k) => win(d(z), c(z), k, 'l'))}
      {rows.map((z, k) => win(c(z), b(z), k, 'r'))}
      <polygon points={pts(a(h), b(h), c(h), d(h))} fill={top} stroke={pal.edge} strokeWidth={1} vectorEffect="non-scaling-stroke" />
    </g>
  );
};

const Park: React.FC<{i: number; j: number; pal: Pal}> = ({i, j, pal}) => (
  <g>
    <polygon points={pts(iso(i + 0.08, j + 0.08), iso(i + 0.92, j + 0.08), iso(i + 0.92, j + 0.92), iso(i + 0.08, j + 0.92))} fill={pal.park} />
    {[0, 1, 2].map(k => {
      const [x, y] = iso(i + rand(`tx${i}${j}${k}`, 0.25, 0.75), j + rand(`ty${i}${j}${k}`, 0.25, 0.75));
      const r = rand(`tr${i}${j}${k}`, 11, 17);
      return (
        <g key={k}>
          <line x1={x} y1={y} x2={x} y2={y - r} stroke={pal.plateSide} strokeWidth={3} />
          <circle cx={x} cy={y - r * 1.4} r={r} fill={pal.tree} />
        </g>
      );
    })}
  </g>
);

/** Ground plate, river, bridges, couriers and boats. */
const Ground: React.FC<{pal: Pal; frame: number}> = ({pal, frame}) => {
  const slab = 0.55;
  const couriers = [
    ...BRIDGES.flatMap(x => [0, 1].map(k => ({key: `v${x}${k}`, at: (t: number) => iso(x, t * G), speed: 0.0042, off: rand(`cv${x}${k}`)}))),
    ...[2, 8].flatMap(y => [0, 1].map(k => ({key: `h${y}${k}`, at: (t: number) => iso(t * G, y), speed: 0.0036, off: rand(`ch${y}${k}`)}))),
  ];
  return (
    <g>
      <polygon points={pts(iso(0, G), iso(G, G), iso(G, G, -slab), iso(0, G, -slab))} fill={mix(pal.plateSide, '#000000', 0.15)} />
      <polygon points={pts(iso(G, 0), iso(G, G), iso(G, G, -slab), iso(G, 0, -slab))} fill={pal.plateSide} />
      <polygon points={pts(iso(0, 0), iso(G, 0), iso(G, G), iso(0, G))} fill={pal.road} />
      {/* lot tiles (roads are the gaps between them) */}
      {Array.from({length: G * G}, (_, n) => {
        const i = n % G;
        const j = Math.floor(n / G);
        if (j === RIVER) return null;
        return <polygon key={n} points={pts(iso(i + 0.07, j + 0.07), iso(i + 0.93, j + 0.07), iso(i + 0.93, j + 0.93), iso(i + 0.07, j + 0.93))} fill={pal.lot} />;
      })}
      {/* river with drifting shimmer */}
      <polygon points={pts(iso(0, RIVER + 0.05), iso(G, RIVER + 0.05), iso(G, RIVER + 0.95), iso(0, RIVER + 0.95))} fill={pal.water} />
      <polygon points={pts(iso(G, RIVER + 0.05), iso(G, RIVER + 0.95), iso(G, RIVER + 0.95, -slab), iso(G, RIVER + 0.05, -slab))} fill={mix(pal.water, '#000000', 0.3)} />
      {[0.28, 0.5, 0.72].map((r, k) => {
        const [x1, y1] = iso(0, RIVER + r);
        const [x2, y2] = iso(G, RIVER + r);
        return <line key={k} x1={x1} y1={y1} x2={x2} y2={y2} stroke={pal.waterHi} strokeOpacity={0.35} strokeWidth={2.5} strokeDasharray={`${18 + k * 9} ${46 + k * 13}`} strokeDashoffset={-frame * (0.9 + k * 0.35)} />;
      })}
      {[0, 1].map(k => {
        const t = (frame * 0.0022 + rand(`boat${k}`) + k * 0.5) % 1;
        const gx = k ? G - t * G : t * G;
        const y = RIVER + (k ? 0.68 : 0.34);
        return <polygon key={k} points={pts(iso(gx - 0.18, y - 0.06), iso(gx + 0.18, y - 0.06), iso(gx + 0.24, y), iso(gx + 0.18, y + 0.06), iso(gx - 0.18, y + 0.06))} fill={pal.waterHi} opacity={0.9} />;
      })}
      {BRIDGES.map(x => (
        <g key={x}>
          <polygon points={pts(iso(x - 0.13, RIVER - 0.02, 0.06), iso(x + 0.13, RIVER - 0.02, 0.06), iso(x + 0.13, RIVER + 1.02, 0.06), iso(x - 0.13, RIVER + 1.02, 0.06))} fill={pal.road} stroke={pal.edge} strokeWidth={1} vectorEffect="non-scaling-stroke" />
          <line x1={iso(x + 0.13, RIVER, 0.16)[0]} y1={iso(x + 0.13, RIVER, 0.16)[1]} x2={iso(x + 0.13, RIVER + 1, 0.16)[0]} y2={iso(x + 0.13, RIVER + 1, 0.16)[1]} stroke={pal.top} strokeWidth={2} />
        </g>
      ))}
      {/* couriers carrying the day's news along the main roads */}
      {couriers.map(c => {
        const t = (frame * c.speed + c.off) % 1;
        const [x, y] = c.at(t);
        const [tx, ty] = c.at(Math.max(0, t - 0.04));
        return (
          <g key={c.key}>
            <line x1={tx} y1={ty} x2={x} y2={y} stroke={pal.accent} strokeOpacity={0.45} strokeWidth={5} strokeLinecap="round" />
            <circle cx={x} cy={y} r={6.5} fill={pal.accent} />
          </g>
        );
      })}
    </g>
  );
};

// ---------------------------------------------------------------------------------------------
// News card
// ---------------------------------------------------------------------------------------------

const Card: React.FC<{story: Story; index: number; total: number; start: number; pal: Pal; u: number; width: number; image: string; isStatic: boolean; display: string; body: string; label: string}> = ({story, index, total, start, pal, u, width, image, isStatic, display, body, label}) => {
  const frame = useCurrentFrame();
  const local = frame - start;
  const acc = deep(pal);
  return (
    <div style={{width, background: alpha(pal.card, 0.95), borderRadius: 26 * u, padding: `${30 * u}px ${36 * u}px ${28 * u}px`, boxShadow: `0 ${30 * u}px ${90 * u}px rgba(0,0,0,.35), inset 0 0 0 1.5px ${alpha(pal.text, 0.08)}`, color: pal.text, fontFamily: body, position: 'relative', overflow: 'hidden'}}>
      <div style={{position: 'absolute', left: 0, top: 0, bottom: 0, width: 8 * u, background: pal.accent, transform: `scaleY(${progress(local, 0, 16, ease.expo)})`, transformOrigin: 'top'}} />
      {image ? (
        <div style={{height: width * 0.3, borderRadius: 16 * u, overflow: 'hidden', marginBottom: 22 * u, opacity: progress(local, 2, 14)}}>
          <CameraImage src={image} isStatic={isStatic} move="push" strength={0.7} />
        </div>
      ) : null}
      <div style={{display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16 * u}}>
        <div style={{background: pal.accent, color: inkOn(pal.accent), fontFamily: label, fontWeight: 700, fontSize: 22 * u, letterSpacing: '0.16em', textTransform: 'uppercase', padding: `${7 * u}px ${14 * u}px`, borderRadius: 8 * u, transform: `translateX(${(1 - progress(local, 2, 14, ease.expo)) * -30 * u}px)`, opacity: progress(local, 2, 10)}}>{story.region}</div>
        <div style={{fontFamily: label, fontSize: 22 * u, letterSpacing: '0.18em', color: pal.muted}}>
          STORY {String(index + 1).padStart(2, '0')}/{String(total).padStart(2, '0')}
        </div>
      </div>
      <div style={{marginTop: 20 * u}}>
        <KineticText text={story.headline} start={start + 5} stagger={3} style="rise" textStyle={{fontFamily: display, fontWeight: 900, fontSize: (width > 800 * u ? 58 : 50) * u, lineHeight: 1.06, letterSpacing: '-0.015em', color: pal.text}} />
      </div>
      {story.detail ? <div style={{marginTop: 16 * u, fontSize: 30 * u, lineHeight: 1.32, color: pal.muted, opacity: progress(local, 16, 14), transform: `translateY(${(1 - progress(local, 16, 16)) * 14 * u}px)`}}>{story.detail}</div> : null}
      {story.figure ? (
        <div style={{marginTop: 20 * u, display: 'flex', alignItems: 'baseline', gap: 14 * u, opacity: progress(local, 12, 10)}}>
          <span style={{fontFamily: display, fontWeight: 900, fontSize: 64 * u, lineHeight: 1, color: acc, letterSpacing: '-0.02em'}}>
            {countUp(local, story.figure.value, 14, 40, story.figure.decimals)}
            {story.figure.unit ? <span style={{fontSize: 34 * u, marginLeft: 8 * u}}>{story.figure.unit}</span> : null}
          </span>
          {story.figure.label ? <span style={{fontSize: 26 * u, color: pal.muted, lineHeight: 1.2}}>{story.figure.label}</span> : null}
        </div>
      ) : null}
      <div style={{display: 'flex', gap: 8 * u, marginTop: 24 * u}}>
        {Array.from({length: total}, (_, i) => (
          <div key={i} style={{flex: 1, height: 6 * u, borderRadius: 3 * u, background: i < index ? pal.accent : alpha(pal.text, 0.12), overflow: 'hidden'}}>
            {i === index ? <div style={{width: `${progress(local, 0, 50, ease.cinematic) * 100}%`, height: '100%', background: pal.accent}} /> : null}
          </div>
        ))}
      </div>
    </div>
  );
};

/** Live ticker across the top: edition and every headline scrolling by. */
const Ticker: React.FC<{stories: Story[]; edition: string; pal: Pal; u: number; label: string; body: string}> = ({stories, edition, pal, u, label, body}) => {
  const frame = useCurrentFrame();
  const h = 58 * u;
  const line = stories.map(s => `${s.place.toUpperCase()} — ${s.headline}`).join('     •     ');
  const enter = progress(frame, 4, 16, ease.expo);
  return (
    <div style={{position: 'absolute', left: 0, right: 0, top: 0, height: h, transform: `translateY(${(enter - 1) * h}px)`, background: alpha(pal.card, 0.9), borderBottom: `2px solid ${alpha(pal.accent, 0.6)}`, display: 'flex', alignItems: 'center', overflow: 'hidden', fontFamily: body}}>
      <div style={{height: '100%', display: 'flex', alignItems: 'center', gap: 10 * u, padding: `0 ${20 * u}px`, background: pal.accent, color: inkOn(pal.accent), fontFamily: label, fontWeight: 700, fontSize: 22 * u, letterSpacing: '0.2em'}}>
        <span style={{width: 12 * u, height: 12 * u, borderRadius: '50%', background: inkOn(pal.accent), opacity: 0.4 + 0.6 * Math.abs(Math.sin(frame / 9))}} />
        LIVE
      </div>
      {edition ? <div style={{padding: `0 ${18 * u}px`, fontFamily: label, fontSize: 20 * u, letterSpacing: '0.16em', color: pal.muted, textTransform: 'uppercase', whiteSpace: 'nowrap', borderRight: `1px solid ${alpha(pal.text, 0.15)}`}}>{edition}</div> : null}
      <div style={{flex: 1, overflow: 'hidden', whiteSpace: 'nowrap'}}>
        <span style={{display: 'inline-block', paddingLeft: 24 * u, transform: `translateX(${-frame * 2.4 * u}px)`, color: pal.text, fontSize: 25 * u, fontWeight: 600}}>
          {Array.from({length: 6}, () => line).join('     •     ')}
        </span>
      </div>
    </div>
  );
};

// ---------------------------------------------------------------------------------------------
// Composition
// ---------------------------------------------------------------------------------------------

type Cam = {fx: number; fy: number; s: number; ax: number; ay: number};
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const lerpCam = (a: Cam, b: Cam, t: number): Cam => ({fx: lerp(a.fx, b.fx, t), fy: lerp(a.fy, b.fy, t), s: lerp(a.s, b.s, t), ax: lerp(a.ax, b.ax, t), ay: lerp(a.ay, b.ay, t)});

const NewsCityBlocks: React.FC<EntryProps<Props>> = ({media, props}) => {
  const frame = useCurrentFrame();
  const {fps, width: W, height: H} = useVideoConfig();
  const look = useLook();
  const pal: Pal = look ? fromLook(look) : {...PALETTES[props.timeOfDay], accent: media.accent ?? PALETTES[props.timeOfDay].accent};
  const display = look?.font.display ?? fonts.sans;
  const body = look?.font.body ?? fonts.sans;
  const label = look?.font.label ?? fonts.mono;
  const u = Math.min(W, H) / 1080;
  const layout = W / H > 1.2 ? 'wide' : H / W > 1.2 ? 'tall' : 'square';
  const safe = 1 - captionSafeBottom(look);
  const timeline = useSceneTimeline(media);
  const contentEnd = useContentFrames(media);
  const city = React.useMemo(buildCity, []);
  const stories = props.stories.slice(0, LOTS.length);
  const n = stories.length;

  // Story i starts with its narration scene (after an optional intro scene).
  const offset = timeline.length > n ? 1 : 0;
  const introEnd = offset ? timeline[1].from : Math.round(1.6 * fps);
  const starts: number[] = [];
  stories.forEach((_, i) => {
    const fromScene = offset ? timeline[i + 1]?.from : i === 0 ? introEnd : timeline[i]?.from;
    const even = introEnd + (i * (contentEnd - introEnd)) / n;
    starts.push(Math.max(i ? starts[i - 1] + Math.round(0.8 * fps) : 0, fromScene ?? even));
  });
  const endOf = (i: number) => (i + 1 < n ? starts[i + 1] : contentEnd);
  const current = starts.reduce((c, s, i) => (frame >= s ? i : c), -1);

  // Story tower heights: each rises when its story starts and settles back after.
  const towerH = (i: number) => {
    const rise = spring({frame: frame - starts[i] - Math.round(0.35 * fps), fps, config: {damping: 14, stiffness: 90}});
    const fall = progress(frame, endOf(i), Math.round(0.6 * fps), ease.cinematic);
    return STORY_H + (ACTIVE_H - STORY_H) * rise * (i === n - 1 ? 1 : 1 - fall);
  };
  // Intro: blocks grow out of the plate in a diagonal wave.
  const grow = (i: number, j: number) => tween(frame, [(i + j) * 1.3, (i + j) * 1.3 + 20], [0, 1], ease.overshoot);

  // Camera: overview over the intro, then a flight to each story tower.
  const overview = (f: number): Cam => {
    const s0 = Math.min((0.92 * W) / (G * TW + 40), ((layout === 'tall' ? 0.4 : layout === 'wide' ? 0.56 : 0.46) * H) / 720);
    return {fx: 0, fy: 270, s: s0 * (1 + 0.05 * progress(f, 0, introEnd + fps, ease.cinematic)), ax: W / 2, ay: H * (layout === 'tall' ? 0.58 : layout === 'wide' ? 0.64 : 0.69)};
  };
  const anchor = layout === 'tall' ? {ax: W / 2, ay: H * Math.min(0.76, safe - 0.02), topY: H * 0.52} : layout === 'wide' ? {ax: W * 0.7, ay: H * Math.min(0.84, safe + 0.06), topY: H * 0.36} : {ax: W * 0.66, ay: H * Math.min(0.86, safe + 0.08), topY: H * 0.42};
  const zoom = (anchor.ay - anchor.topY) / ((ACTIVE_H + 0.3) * HU);
  const hold = (i: number, f: number): Cam => {
    const [bx, by] = iso(LOTS[i][0] + 0.5, LOTS[i][1] + 0.5);
    const t = f - starts[i];
    return {fx: bx + Math.sin(t / 55 + i) * 10, fy: by, s: zoom * (1 + 0.05 * progress(t, 0, endOf(i) - starts[i], ease.cinematic)), ax: anchor.ax, ay: anchor.ay};
  };
  const flight = (i: number) => Math.max(8, Math.min(Math.round(0.95 * fps), Math.floor((endOf(i) - starts[i]) * 0.45)));
  let cam: Cam = overview(frame);
  if (current >= 0) {
    const from = current === 0 ? overview(starts[0]) : hold(current - 1, starts[current]);
    const p = progress(frame, starts[current], flight(current), ease.cinematic);
    cam = lerpCam(from, hold(current, frame), p);
    cam.s *= 1 - 0.32 * Math.sin(Math.PI * p) * (current === 0 ? 0.3 : 1);
  }
  const toScreen = (wx: number, wy: number): [number, number] => [cam.ax + (wx - cam.fx) * cam.s, cam.ay + (wy - cam.fy) * cam.s];

  const tickerH = 58 * u;
  const introOut = progress(frame, introEnd - 12, 12, ease.accelerate);
  const cardW = layout === 'tall' ? W * 0.88 : layout === 'wide' ? W * 0.4 : W * 0.5;
  const cardLeft = layout === 'tall' ? W * 0.06 : W * 0.045;
  const cardTop = tickerH + H * (layout === 'tall' ? 0.025 : 0.06);
  const darkSky = !pal.light;

  return (
    <AbsoluteFill style={{background: `linear-gradient(180deg, ${pal.skyTop} 0%, ${pal.skyBottom} 100%)`, overflow: 'hidden'}}>
      <AbsoluteFill style={{background: `radial-gradient(ellipse 70% 45% at 50% ${layout === 'tall' ? 60 : 62}%, ${alpha(pal.glow, darkSky ? 0.45 : 0.7)} 0%, transparent 70%)`}} />
      {darkSky ? <Particles count={60} color={pal.window} opacity={0.35} seed="sky" speed={0.15} size={[1.5, 3.5]} /> : null}
      {/* the city */}
      <svg width={W} height={H} style={{position: 'absolute', inset: 0}}>
        <defs>
          <linearGradient id="ncb-beam" x1="0" y1="1" x2="0" y2="0">
            <stop offset="0%" stopColor={pal.accent} stopOpacity={0.55} />
            <stop offset="100%" stopColor={pal.accent} stopOpacity={0} />
          </linearGradient>
        </defs>
        <g transform={`translate(${cam.ax} ${cam.ay}) scale(${cam.s}) translate(${-cam.fx} ${-cam.fy})`}>
          <Ground pal={pal} frame={frame} />
          {/* pulse rings on the ground around the active tower */}
          {current >= 0
            ? [0, 1].map(k => {
                const [x, y] = iso(LOTS[current][0] + 0.5, LOTS[current][1] + 0.5);
                const t = ((frame - starts[current] + k * 24) % 48) / 48;
                return <ellipse key={k} cx={x} cy={y} rx={TW * (0.5 + t * 1.3)} ry={TH * (0.5 + t * 1.3)} fill="none" stroke={pal.accent} strokeWidth={3} strokeOpacity={(1 - t) * 0.8 * progress(frame, starts[current] + 10, 10)} />;
              })
            : null}
          {city.map(lot => {
            const key = `${lot.i}-${lot.j}`;
            if (lot.kind === 'park') return <Park key={key} i={lot.i} j={lot.j} pal={pal} />;
            const g = grow(lot.i, lot.j);
            if (lot.kind === 'story') {
              if (lot.story >= n) return <Block key={key} i={lot.i} j={lot.j} h={1.2 * g} m={0.16} top={pal.top} left={pal.left} right={pal.right} pal={pal} seed={key} frame={frame} />;
              const on = lot.story === current ? 1 : 0;
              const h = towerH(lot.story) * g;
              const k = 0.18 + 0.22 * on;
              return (
                <g key={key}>
                  <Block i={lot.i} j={lot.j} h={h} m={0.12} top={mix(pal.top, pal.accent, k + 0.1)} left={mix(pal.left, pal.accent, k)} right={mix(pal.right, pal.accent, k * 0.8)} pal={pal} seed={key} frame={frame} />
                  <Block i={lot.i} j={lot.j} h={0.24 * g} m={0.3} base={h} top={pal.accent} left={mix(pal.accent, '#000000', 0.15)} right={mix(pal.accent, '#000000', 0.3)} pal={pal} seed={key + 'c'} frame={frame} />
                </g>
              );
            }
            return <Block key={key} i={lot.i} j={lot.j} h={lot.h * g} m={0.16} top={pal.top} left={pal.left} right={pal.right} pal={pal} seed={key} frame={frame} />;
          })}
          {/* the active story's beacon beam */}
          {current >= 0
            ? (() => {
                const [x, y] = iso(LOTS[current][0] + 0.5, LOTS[current][1] + 0.5, towerH(current) + 0.24);
                const p = progress(frame, starts[current] + flight(current) * 0.6, 14);
                return <rect x={x - TW * 0.16} y={y - HU * 7 * p} width={TW * 0.32} height={HU * 7 * p} fill="url(#ncb-beam)" opacity={0.6 + 0.25 * Math.sin(frame / 7)} />;
              })()
            : null}
        </g>
      </svg>
      {/* place pins over the story towers */}
      {stories.map((story, i) => {
        const [wx, wy] = iso(LOTS[i][0] + 0.5, LOTS[i][1] + 0.5, towerH(i) * grow(LOTS[i][0], LOTS[i][1]) + 0.6);
        const [x, y] = toScreen(wx, wy);
        const drop = spring({frame: frame - Math.round(introEnd * 0.45) - i * 4, fps, config: {damping: 12, stiffness: 160}});
        const active = i === current;
        const big = active ? progress(frame, starts[i] + flight(i) * 0.5, 12, ease.overshoot) * (1 - progress(frame, endOf(i) - 6, 8)) : 0;
        const bob = Math.sin(frame / 12 + i) * 6 * u;
        // Portrait centres the pill on its stem; side-by-side layouts open it to the right, away from the card.
        const centred = layout === 'tall';
        const cx = (big > 0 ? 8 : 0) * u + ((38 + 22 * big) * u) / 2;
        return (
          <div key={i} style={{position: 'absolute', left: x, top: y + bob - (1 - drop) * 60 * u, transform: centred ? 'translate(-50%, -100%)' : `translate(${-cx}px, -100%)`, opacity: Math.min(1, drop * 2), display: 'flex', flexDirection: 'column', alignItems: centred ? 'center' : 'flex-start'}}>
            <div style={{display: 'flex', alignItems: 'center', gap: 12 * u * big, background: active ? alpha(pal.card, 0.95) : 'transparent', borderRadius: 999, padding: big > 0 ? `${8 * u}px ${20 * u * big}px ${8 * u}px ${8 * u}px` : 0, boxShadow: big > 0 ? `0 ${12 * u}px ${30 * u}px rgba(0,0,0,.3)` : 'none'}}>
              <div style={{width: (38 + 22 * big) * u, height: (38 + 22 * big) * u, borderRadius: '50%', background: pal.accent, color: inkOn(pal.accent), display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: label, fontWeight: 700, fontSize: 20 * u, boxShadow: `0 0 0 ${4 * u}px ${alpha(pal.accent, 0.3)}`}}>
                {big > 0.3 ? <LineIcon name={story.icon} size={34 * u} color={inkOn(pal.accent)} strokeWidth={7} progress={big} /> : String(i + 1)}
              </div>
              {big > 0 ? <div style={{fontFamily: body, fontWeight: 800, fontSize: 30 * u, color: pal.text, whiteSpace: 'nowrap', maxWidth: W * 0.7 * big, overflow: 'hidden', opacity: big}}>{story.place}</div> : null}
            </div>
            <div style={{width: 3 * u, height: (18 + 14 * big) * u, background: pal.accent, marginLeft: centred ? 0 : cx - 1.5 * u}} />
          </div>
        );
      })}
      {/* intro title over the city overview */}
      {frame < introEnd ? (
        <AbsoluteFill style={{alignItems: 'center', paddingTop: tickerH + H * (layout === 'tall' ? 0.09 : 0.07), paddingLeft: '8%', paddingRight: '8%', opacity: 1 - introOut, transform: `translateY(${-introOut * 40 * u}px)`}}>
          {props.edition ? <div style={{fontFamily: label, color: deep(pal), fontSize: 26 * u, letterSpacing: '0.32em', textTransform: 'uppercase', marginBottom: 20 * u, opacity: progress(frame, 2, 12)}}>{props.edition}</div> : null}
          <KineticText text={props.title} start={6} stagger={4} style="pop" align="center" textStyle={{fontFamily: display, fontWeight: 900, color: pal.text, fontSize: (layout === 'wide' ? 88 : 96) * u, lineHeight: 1.0, letterSpacing: '-0.02em', textShadow: pal.light ? 'none' : '0 6px 30px rgba(0,0,0,.45)'}} />
          <div style={{display: 'flex', alignItems: 'center', gap: 12 * u, marginTop: 24 * u, fontFamily: label, fontSize: 24 * u, letterSpacing: '0.24em', color: pal.muted, opacity: progress(frame, 18, 12)}}>
            <LineIcon name="map" size={34 * u} color={deep(pal)} strokeWidth={6} progress={progress(frame, 16, 24)} />
            {n} STORIES ON THE MAP
          </div>
        </AbsoluteFill>
      ) : null}
      {/* news cards */}
      {stories.map((story, i) => {
        const appear = starts[i] + Math.round(flight(i) * 0.55);
        const end = endOf(i);
        if (frame < appear - 1 || frame > end + 10 || frame >= contentEnd) return null;
        const inP = spring({frame: frame - appear, fps, config: {damping: 16, stiffness: 130}});
        const outP = i === n - 1 ? 0 : progress(frame, end - 8, 12, ease.accelerate);
        const scene = timeline[i + offset]?.scene;
        return (
          <div key={i} style={{position: 'absolute', left: cardLeft, top: cardTop, opacity: Math.min(1, inP * 2) * (1 - outP), transform: `translateY(${(1 - inP) * 50 * u - outP * 30 * u}px) scale(${0.96 + 0.04 * inP})`, transformOrigin: 'top left', filter: outP > 0 ? `blur(${outP * 8}px)` : undefined}}>
            <Card story={story} index={i} total={n} start={appear} pal={pal} u={u} width={cardW} image={scene?.video ?? ''} isStatic={scene?.isStaticImage ?? true} display={display} body={body} label={label} />
          </div>
        );
      })}
      <Ticker stories={stories} edition={props.edition} pal={pal} u={u} label={label} body={body} />
      {starts.map((s, i) => <LightLeak key={i} from={Math.max(0, s - 6)} durationInFrames={Math.round(0.9 * fps)} seed={i * 5 + 2} hueShift={pal.light || look ? 0 : 180} opacity={pal.light ? 0.25 : 0.35} />)}
      {props.showCaptions && !look ? (
        <>
          <AbsoluteFill style={{pointerEvents: 'none', background: `linear-gradient(0deg, ${alpha(pal.card, 0.88)} 0%, ${alpha(pal.card, 0.5)} 12%, transparent 24%)`}} />
          {timeline.map(t => (
            <Sequence key={t.index} from={t.from} durationInFrames={t.durationInFrames}>
              <AbsoluteFill style={{justifyContent: 'flex-end', padding: layout === 'wide' ? '0 18% 3.5%' : '0 7% 6%'}}>
                <StyledCaptions scene={t.scene} variant="box" accent={pal.accent} color={pal.text} font={body} size={(layout === 'wide' ? 46 : 52) * u} words={layout === 'wide' ? 7 : 5} shadow={!pal.light} />
              </AbsoluteFill>
            </Sequence>
          ))}
        </>
      ) : null}
      <Vignette strength={pal.light ? 0.2 : 0.5} />
      <Grain opacity={0.05} />
      <NarrationTrack media={media} />
      <AdWeave media={media} theme={{background: pal.skyTop, text: pal.light ? pal.text : '#ffffff', font: body}} />
    </AbsoluteFill>
  );
};

export default defineEntry({id: 'news-city-blocks', schema: Props, component: NewsCityBlocks});
