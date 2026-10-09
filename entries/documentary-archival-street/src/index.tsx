import React from 'react';
import {AbsoluteFill, Sequence, spring, useCurrentFrame, useVideoConfig} from 'remotion';
import {AdWeave, NarrationTrack, defineEntry, mix, useContentFrames, useLook, useSceneTimeline, type ActiveLook, type EntryProps, type Scene} from '@viralaunch/kit';
import {CameraImage, Grain, KineticText, LightLeak, Particles, SceneSeries, StyledCaptions, Vignette, alpha, ease, fonts, progress, rand, tween, type CameraMove} from '@viralaunch/kit/fx';
import {Props} from './schema';

/** Every colour the film uses. `filter` grades scene photos; the rest paints the drawn street and chrome. */
type Tone = {
  filter: string;
  skyTop: string;
  fog: string;
  facade: string;
  shade: string;
  window: string;
  road: string;
  walk: string;
  ink: string;
  rail: string;
  accent: string;
  paper: string;
  text: string;
  slip: string;
  slipInk: string;
  stamp: string;
  strip: string;
  hole: string;
};

const GRADES: Record<Props['grade'], Tone> = {
  silver: {filter: 'grayscale(1) contrast(1.18) brightness(.95)', skyTop: '#b4b3ad', fog: '#e6e4dd', facade: '#3d3c39', shade: '#242321', window: '#6f6d68', road: '#56544f', walk: '#7e7b74', ink: '#1a1918', rail: '#c9c7c0', accent: '#d8cfb8', paper: '#0f0f0e', text: '#f1efe8', slip: '#ece7da', slipInk: '#1c1a17', stamp: '#9b2a1e', strip: '#0b0b0a', hole: '#33322f'},
  sepia: {filter: 'sepia(.75) contrast(1.1) brightness(.92) saturate(1.05)', skyTop: '#c3a277', fog: '#eedbb8', facade: '#4a3725', shade: '#2f2217', window: '#806549', road: '#6a5239', walk: '#8f7454', ink: '#24180e', rail: '#e3cba3', accent: '#d9a45b', paper: '#17110b', text: '#f3e6cf', slip: '#efe3c8', slipInk: '#2a1d10', stamp: '#9b2a1e', strip: '#100b06', hole: '#3a2c1d'},
  cyanotype: {filter: 'grayscale(1) sepia(1) hue-rotate(175deg) saturate(2.2) brightness(.9) contrast(1.1)', skyTop: '#7d9dbd', fog: '#cddeed', facade: '#173251', shade: '#0d2039', window: '#41668c', road: '#2b4a6c', walk: '#46678b', ink: '#0a1a30', rail: '#b9d0e6', accent: '#cfe3f5', paper: '#081426', text: '#e8f1fa', slip: '#eef3f6', slipInk: '#10233d', stamp: '#14376b', strip: '#050c17', hole: '#1d3554'},
  amber: {filter: 'grayscale(1) sepia(1) saturate(2.4) hue-rotate(-8deg) brightness(.92) contrast(1.12)', skyTop: '#c48536', fog: '#f3c57f', facade: '#4a2a0e', shade: '#301a07', window: '#8c5822', road: '#6b4214', walk: '#8c5a22', ink: '#241304', rail: '#f6d49b', accent: '#ffd08a', paper: '#160c03', text: '#fff0d6', slip: '#f3e4c4', slipInk: '#2b1906', stamp: '#8f2414', strip: '#0e0702', hole: '#3d2408'},
};

/**
 * The film in a sequence's shared look: photos keep the period grade (the archival texture),
 * while the drawn street, slips, film strip and title take the look's palette. Light looks get
 * ink-drawn streets on paper; dark looks get silhouettes against a pale haze.
 */
const fromLook = (l: ActiveLook, own: Tone): Tone => {
  const p = l.palette;
  const light = l.tone === 'light';
  const facade = light ? mix(p.text, p.bg, 0.3) : mix(p.bg, p.bg2, 0.6);
  const fog = light ? p.bg : mix(p.bg2, p.text, 0.62);
  return {
    filter: own.filter,
    skyTop: light ? mix(p.bg2, p.text, 0.12) : mix(p.bg2, p.text, 0.32),
    fog,
    facade,
    shade: light ? p.text : p.bg,
    window: mix(facade, fog, 0.38),
    road: light ? mix(p.text, p.bg, 0.55) : mix(p.bg2, p.text, 0.2),
    walk: light ? mix(p.text, p.bg, 0.7) : mix(p.bg2, p.text, 0.34),
    ink: light ? p.text : p.bg,
    rail: light ? p.bg2 : mix(p.text, p.bg2, 0.25),
    // Bright accents (paper's yellow) need more weight as ink on a light slip.
    accent: light ? mix(p.accent, p.text, 0.35) : p.accent,
    paper: p.bg,
    text: p.text,
    slip: p.surface,
    slipInk: p.text,
    stamp: light ? mix(p.accent, p.text, 0.35) : p.accent,
    strip: light ? p.text : mix(p.bg, '#000000', 0.5),
    hole: light ? p.bg2 : p.bg2,
  };
};

const MOVES: CameraMove[] = ['push', 'pan-right', 'push', 'pan-left', 'rise'];

// ---------------------------------------------------------------------------------------------
// The drawn street: a one-point-perspective dolly up a period street, projected per frame.
// World units are metres: X across (0 = street centre), Y up, Z away from the camera.
// ---------------------------------------------------------------------------------------------

const STREETS = {
  tramway: {road: 6.5, walk: 3, h: [9, 22], spacing: 18, awnings: true},
  boulevard: {road: 11, walk: 5.5, h: [13, 21], spacing: 12, awnings: false},
  lane: {road: 3.2, walk: 1.3, h: [11, 19], spacing: 14, awnings: true},
} as const;
type StreetKind = keyof typeof STREETS;

type Building = {side: -1 | 1; z0: number; z1: number; h: number; tone: number; cols: number; rows: number; awning: boolean; sign: boolean};
type Figure = {side: -1 | 1; x: number; z: number; h: number; walk: number; coat: number};

function layoutStreet(kind: StreetKind, seed: string) {
  const s = STREETS[kind];
  const buildings: Building[] = [];
  for (const side of [-1, 1] as const) {
    let z = -6;
    for (let i = 0; z < 330; i++) {
      const k = `${seed}${side}${i}`;
      const w = rand(`w${k}`, 6, 13);
      const h = rand(`h${k}`, s.h[0], s.h[1]);
      buildings.push({side, z0: z, z1: z + w, h, tone: rand(`t${k}`, -0.35, 0.3), cols: Math.max(2, Math.round(w / 3.2)), rows: Math.max(2, Math.floor((h - 4.5) / 3.4)), awning: s.awnings && rand(`a${k}`) > 0.45, sign: kind === 'lane' && rand(`s${k}`) > 0.55});
      z += w;
    }
  }
  buildings.sort((a, b) => b.z0 - a.z0);
  const figures: Figure[] = Array.from({length: 34}, (_, i) => {
    const side = rand(`fs${seed}${i}`) > 0.5 ? 1 : -1;
    return {side, x: side * (s.road + rand(`fx${seed}${i}`, 0.5, s.walk - 0.3)), z: rand(`fz${seed}${i}`, 5, 300), h: rand(`fh${seed}${i}`, 1.55, 1.85), walk: rand(`fw${seed}${i}`, -0.03, 0.04), coat: rand(`fc${seed}${i}`, 0.22, 0.34)};
  });
  return {buildings, figures};
}

const Street: React.FC<{kind: StreetKind; g: Tone; index: number}> = ({kind, g, index}) => {
  const frame = useCurrentFrame();
  const {width: W, height: H, fps} = useVideoConfig();
  const S = STREETS[kind];
  const portrait = H >= W;
  const u = Math.min(W, H) / 1080;
  const F = Math.min(W, H) * (portrait ? 0.95 : 0.8);
  const vx = W / 2;
  const hy = H * (portrait ? 0.47 : 0.5);
  // The dolly eases in from a standstill, then glides at a walking pace with a faint step bob.
  const cam = (4 / fps) * Math.max(0, frame - 12 * (1 - Math.exp(-frame / 12)));
  const eye = 1.7 + Math.sin(frame / 6) * 0.03;
  const NEAR = 0.6;
  const FAR = 175;
  const {buildings, figures} = React.useMemo(() => layoutStreet(kind, `st${index}`), [kind, index]);

  const P = (X: number, Y: number, Z: number) => {
    const s = F / Math.max(NEAR, Z - cam);
    return [vx + X * s, hy - (Y - eye) * s] as const;
  };
  const poly = (...p: Array<readonly [number, number]>) => p.map(q => `${q[0].toFixed(1)},${q[1].toFixed(1)}`).join(' ');
  const fogAt = (c: string, zr: number) => mix(c, g.fog, Math.min(0.94, Math.pow(Math.max(0, zr - 5) / (FAR - 5), 0.62)));
  const sc = (Z: number) => F / Math.max(NEAR, Z - cam);
  const edge = S.road + S.walk;
  const id = `as${index}`;

  // Far landmark at the end of the street — it grows slowly as the camera travels.
  const ZL = 215;
  const ls = sc(ZL);
  const lc = fogAt(g.facade, (ZL - cam) * 0.55);
  const L = (X: number, Y: number) => [vx + X * ls, hy - (Y - eye) * ls] as const;
  const rect = (x0: number, y0: number, x1: number, y1: number) => poly(L(x0, y0), L(x1, y0), L(x1, y1), L(x0, y1));
  const landmark =
    kind === 'tramway' ? (
      <g fill={lc}>
        <polygon points={rect(-9, 0, 9, 9)} />
        <polygon points={rect(-2.4, 0, 2.4, 34)} />
        <polygon points={rect(-1.8, 34, 1.8, 41)} />
        <polygon points={poly(L(-1.8, 41), L(0, 52), L(1.8, 41))} />
        <circle cx={L(0, 29.5)[0]} cy={L(0, 29.5)[1]} r={1.4 * ls} fill={mix(g.fog, '#ffffff', 0.3)} />
      </g>
    ) : kind === 'boulevard' ? (
      <g fill={lc}>
        <polygon points={rect(-20, 0, 20, 12)} />
        <polygon points={rect(-7, 12, 7, 19)} />
        <path d={`M${L(-7, 19)[0]},${L(-7, 19)[1]} A${7 * ls},${7.5 * ls} 0 0 1 ${L(7, 19)[0]},${L(7, 19)[1]} Z`} />
        <polygon points={rect(-0.9, 26, 0.9, 30)} />
        {[-5, -2, 1, 4].map(x => <polygon key={x} points={rect(x, 13.5, x + 1, 17.5)} fill={mix(lc, g.fog, 0.35)} />)}
      </g>
    ) : (
      <g fill={lc}>
        <polygon points={rect(-6.5, 0, 6.5, 20)} />
        <path d={`M${L(-3, 0)[0]},${L(-3, 0)[1]} L${L(-3, 10)[0]},${L(-3, 10)[1]} A${3 * ls},${3 * ls} 0 0 1 ${L(3, 10)[0]},${L(3, 10)[1]} L${L(3, 0)[0]},${L(3, 0)[1]} Z`} fill={mix(g.fog, '#ffffff', 0.25)} />
      </g>
    );

  // Paving joints / sleepers that stream toward the camera — the main cue of forward motion.
  const step = kind === 'lane' ? 1.6 : 3;
  const joints: React.ReactNode[] = [];
  for (let z = Math.ceil((cam + 1.2) / step) * step; z < cam + 70; z += step) {
    const a = P(-S.road, 0, z);
    const b = P(S.road, 0, z);
    joints.push(<line key={z} x1={a[0]} y1={a[1]} x2={b[0]} y2={b[1]} stroke={fogAt(g.ink, z - cam)} strokeOpacity={0.45} strokeWidth={Math.max(0.6, 0.05 * sc(z))} />);
  }
  const along = (X: number, Y: number, color: string, w: number, key: string) => {
    const a = P(X, Y, cam + NEAR);
    const b = P(X, Y, cam + FAR);
    return <line key={key} x1={a[0]} y1={a[1]} x2={b[0]} y2={b[1]} stroke={color} strokeWidth={w} />;
  };

  const shaded = (b: Building) => (b.tone >= 0 ? mix(g.facade, g.fog, b.tone * 0.5) : mix(g.facade, g.shade, -b.tone));
  const visible = buildings.filter(b => b.z1 - cam > NEAR && b.z0 - cam < FAR);

  // Street furniture and people, drawn far to near after the facades.
  type Item = {z: number; node: React.ReactNode};
  const items: Item[] = [];
  for (let z = Math.ceil((cam + 2.5) / S.spacing) * S.spacing; z < cam + 150; z += S.spacing) {
    const zr = z - cam;
    const s = sc(z);
    for (const side of [-1, 1] as const) {
      const X = side * (S.road + 0.5);
      const base = P(X, 0, z);
      const c = fogAt(g.ink, zr);
      if (kind === 'boulevard') {
        const top = P(X, 3.4, z);
        const crown = P(X, 5.6, z);
        items.push({z, node: <g key={`t${z}${side}`}><line x1={base[0]} y1={base[1]} x2={top[0]} y2={top[1]} stroke={c} strokeWidth={Math.max(1, 0.32 * s)} /><ellipse cx={crown[0]} cy={crown[1]} rx={2.5 * s} ry={2.2 * s} fill={fogAt(mix(g.shade, g.facade, 0.4), zr)} /></g>});
      } else {
        const top = P(X, kind === 'lane' ? 4.2 : 7.2, z);
        items.push({z, node: <g key={`p${z}${side}`}><line x1={base[0]} y1={base[1]} x2={top[0]} y2={top[1]} stroke={c} strokeWidth={Math.max(1, 0.16 * s)} />{kind === 'lane' ? <circle cx={top[0]} cy={top[1]} r={0.28 * s} fill={mix(g.fog, '#ffffff', 0.4)} stroke={c} strokeWidth={Math.max(0.5, 0.05 * s)} /> : null}</g>});
      }
    }
    if (kind === 'tramway') {
      const a = P(-(S.road + 0.5), 6.9, z);
      const b = P(S.road + 0.5, 6.9, z);
      items.push({z: z - 0.01, node: <line key={`span${z}`} x1={a[0]} y1={a[1]} x2={b[0]} y2={b[1]} stroke={fogAt(g.ink, zr)} strokeWidth={Math.max(0.6, 0.04 * s)} />});
    }
  }
  for (const [i, f] of figures.entries()) {
    const z = f.z + frame * f.walk;
    const zr = z - cam;
    if (zr < 1.4 || zr > 130) continue;
    const s = sc(z);
    const [fx, fy] = P(f.x, 0, z);
    const bob = Math.abs(Math.sin(frame / 5 + i)) * 0.03 * s * (f.walk ? 1 : 0);
    const c = fogAt(g.ink, zr);
    const hw = f.coat * s;
    items.push({z, node: <g key={`f${i}`} fill={c}><polygon points={poly([fx - hw * 0.55, fy - (f.h - 0.25) * s - bob], [fx + hw * 0.55, fy - (f.h - 0.25) * s - bob], [fx + hw, fy], [fx - hw, fy])} /><circle cx={fx} cy={fy - (f.h - 0.12) * s - bob} r={0.13 * s} /></g>});
  }
  if (kind === 'tramway') {
    // A streetcar slowly pulling away up the right-hand track.
    const z = cam + 24 + frame * 0.02;
    const zr = z - cam;
    const c = fogAt(g.shade, zr);
    const s = sc(z);
    const pole0 = P(2.6, 3.5, z);
    const pole1 = P(1.6, 5.9, z + 3);
    items.push({z, node: (
      <g key="tram">
        <line x1={pole0[0]} y1={pole0[1]} x2={pole1[0]} y2={pole1[1]} stroke={c} strokeWidth={Math.max(1, 0.06 * s)} />
        <polygon points={poly(P(0.1, 0.3, z), P(0.1, 3.3, z), P(3.1, 3.3, z), P(3.1, 0.3, z))} fill={c} />
        <polygon points={poly(P(-0.1, 3.3, z), P(3.3, 3.3, z), P(3.0, 3.7, z), P(0.2, 3.7, z))} fill={fogAt(g.facade, zr)} />
        {[0.4, 1.35, 2.3].map(x => <polygon key={x} points={poly(P(x, 1.9, z), P(x, 2.9, z), P(x + 0.5, 2.9, z), P(x + 0.5, 1.9, z))} fill={fogAt(g.window, zr)} />)}
      </g>
    )});
  }
  items.sort((a, b) => b.z - a.z);

  return (
    <AbsoluteFill style={{background: g.fog}}>
      <svg width={W} height={H} style={{position: 'absolute', inset: 0}}>
        <defs>
          <linearGradient id={`${id}sky`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor={g.skyTop} />
            <stop offset="1" stopColor={g.fog} />
          </linearGradient>
          <linearGradient id={`${id}gnd`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor={g.fog} />
            <stop offset="0.25" stopColor={mix(g.road, g.fog, 0.4)} />
            <stop offset="1" stopColor={g.road} />
          </linearGradient>
          <radialGradient id={`${id}sun`} cx="0.5" cy="0.5" r="0.5">
            <stop offset="0" stopColor={mix(g.fog, '#ffffff', 0.55)} stopOpacity={0.9} />
            <stop offset="1" stopColor={g.fog} stopOpacity={0} />
          </radialGradient>
          <linearGradient id={`${id}haze`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor={g.fog} stopOpacity={0.9} />
            <stop offset="1" stopColor={g.fog} stopOpacity={0} />
          </linearGradient>
        </defs>
        <rect x={0} y={0} width={W} height={hy + 2} fill={`url(#${id}sky)`} />
        <ellipse cx={vx} cy={hy - H * 0.04} rx={H * 0.45} ry={H * 0.3} fill={`url(#${id}sun)`} />
        {landmark}
        <rect x={0} y={hy} width={W} height={H - hy} fill={`url(#${id}gnd)`} />
        {[-1, 1].map(side => (
          <polygon key={side} points={poly(P(side * S.road, 0, cam + NEAR), P(side * edge, 0, cam + NEAR), P(side * edge, 0, cam + FAR), P(side * S.road, 0, cam + FAR))} fill={g.walk} />
        ))}
        {joints}
        {along(-S.road, 0, g.ink, 2.5 * u, 'curbL')}
        {along(S.road, 0, g.ink, 2.5 * u, 'curbR')}
        {kind === 'tramway' ? [-2.32, -0.88, 0.88, 2.32].map(x => along(x, 0, g.rail, 3 * u, `r${x}`)) : null}
        {kind === 'tramway' ? [-1.6, 1.6].map(x => along(x, 0, g.ink, 2 * u, `slot${x}`)) : null}
        {kind === 'boulevard' ? along(0, 0, g.rail, 2.5 * u, 'mid') : null}
        <rect x={0} y={hy - 1} width={W} height={H * 0.1} fill={`url(#${id}haze)`} />
        {visible.map((b, bi) => {
          const X = b.side * edge;
          const zr0 = Math.max(NEAR, b.z0 - cam);
          const face = fogAt(shaded(b), zr0);
          const w = b.z1 - b.z0;
          const parts: React.ReactNode[] = [];
          if (b.z0 - cam > NEAR) parts.push(<polygon key="front" points={poly(P(X, 0, b.z0), P(X, b.h, b.z0), P(X + b.side * 12, b.h, b.z0), P(X + b.side * 12, 0, b.z0))} fill={fogAt(g.shade, zr0)} />);
          parts.push(<polygon key="face" points={poly(P(X, 0, b.z0), P(X, b.h, b.z0), P(X, b.h, b.z1), P(X, 0, b.z1))} fill={face} />);
          parts.push(<polygon key="cornice" points={poly(P(X, b.h - 0.8, b.z0), P(X, b.h, b.z0), P(X, b.h, b.z1), P(X, b.h - 0.8, b.z1))} fill={fogAt(g.shade, zr0)} />);
          parts.push(<polygon key="shop" points={poly(P(X, 0, b.z0), P(X, 3.6, b.z0), P(X, 3.6, b.z1), P(X, 0, b.z1))} fill={fogAt(mix(g.shade, g.facade, 0.35), zr0)} />);
          if (zr0 < 120) {
            for (let r = 0; r < b.rows; r++) {
              const y0 = 5 + r * 3.4;
              if (y0 + 2 > b.h - 1.2) break;
              for (let c = 0; c < b.cols; c++) {
                const za = b.z0 + ((c + 0.28) * w) / b.cols;
                const zb = za + (0.44 * w) / b.cols;
                if (zb - cam < NEAR) continue;
                parts.push(<polygon key={`w${r}-${c}`} points={poly(P(X, y0, za), P(X, y0 + 2.1, za), P(X, y0 + 2.1, zb), P(X, y0, zb))} fill={fogAt(g.window, Math.max(NEAR, za - cam))} />);
              }
            }
          }
          if (b.awning) {
            const za = b.z0 + w * 0.12;
            const zb = b.z1 - w * 0.12;
            if (zb - cam > NEAR) parts.push(<polygon key="awn" points={poly(P(X, 3.7, za), P(X, 3.7, zb), P(X - b.side * 1.8, 2.8, zb), P(X - b.side * 1.8, 2.8, za))} fill={fogAt(mix(g.facade, g.fog, 0.55), zr0)} />);
          }
          if (b.sign) {
            const zs = b.z0 + w * 0.5;
            if (zs - cam > NEAR + 0.5) parts.push(<polygon key="sign" points={poly(P(X, 5.2, zs), P(X - b.side * 1.3, 5.2, zs), P(X - b.side * 1.3, 4.2, zs), P(X, 4.2, zs))} fill={fogAt(g.shade, zs - cam)} />);
          }
          return <g key={bi}>{parts}</g>;
        })}
        {kind === 'tramway' ? [-1.6, 1.6].map(x => along(x, 5.9, alpha(g.ink, 0.75), 1.4 * u, `wire${x}`)) : null}
        {items.map(it => it.node)}
      </svg>
    </AbsoluteFill>
  );
};

/** Scene photo with the period grade, a projector "pull focus" and a designed camera move. */
const Photo: React.FC<{scene: Scene; g: Tone; index: number}> = ({scene, g, index}) => {
  const frame = useCurrentFrame();
  const focus = 1 - progress(frame, 0, 22, ease.cinematic);
  return (
    <AbsoluteFill style={{filter: `${g.filter} blur(${(focus * 6).toFixed(2)}px)`, overflow: 'hidden'}}>
      <CameraImage src={scene.video} isStatic={scene.isStaticImage} move={MOVES[index % MOVES.length]} strength={1.3} />
    </AbsoluteFill>
  );
};

/** Low haze bands drifting across at two speeds — atmosphere in front of the picture. */
const Haze: React.FC<{color: string; strength: number}> = ({color, strength}) => {
  const frame = useCurrentFrame();
  return (
    <AbsoluteFill style={{pointerEvents: 'none'}}>
      {[0, 1].map(i => (
        <AbsoluteFill key={i} style={{opacity: strength * (0.7 + 0.3 * i), background: `radial-gradient(ellipse 65% 14% at ${((frame * (0.12 + i * 0.1) + i * 55) % 170) - 35}% ${50 + i * 14}%, ${alpha(color, 0.5)} 0%, transparent 70%)`}} />
      ))}
    </AbsoluteFill>
  );
};

/** Archive slip: a paper label that drops in with the plate number, a typed date and a postmark. */
const Slip: React.FC<{plate: Props['plates'][number]; number: number; place: string; g: Tone; u: number; start: number; end: number; left: number; top: number; width: number}> = ({plate, number, place, g, u, start, end, left, top, width}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const inP = spring({frame: frame - start, fps, config: {damping: 15, stiffness: 110}});
  const outP = progress(frame, end - 16, 14, ease.accelerate);
  const tilt = rand(`tilt${number}`, -2.6, 1.4);
  const chars = plate.date.split('');
  const typeAt = start + 10;
  const dateSize = Math.min(66 * u, (width * 1.55) / Math.max(6, plate.date.length));
  const stampIn = progress(frame, typeAt + chars.length * 1.6 + 4, 10, ease.overshoot);
  const ruleIn = progress(frame, typeAt + 4, chars.length * 1.6 + 10, ease.cinematic);
  return (
    <div style={{position: 'absolute', left, top, width, opacity: Math.min(1, inP * 2) * (1 - outP), transform: `translateY(${(1 - inP) * -60 * u - outP * 40 * u}px) rotate(${tilt + (1 - inP) * -6}deg)`, transformOrigin: '10% 0%'}}>
      <div style={{position: 'relative', background: `linear-gradient(170deg, ${g.slip} 0%, ${mix(g.slip, g.slipInk, 0.06)} 100%)`, color: g.slipInk, padding: `${22 * u}px ${30 * u}px ${26 * u}px`, boxShadow: `0 ${18 * u}px ${48 * u}px rgba(0,0,0,.45), 0 ${2 * u}px ${6 * u}px rgba(0,0,0,.3)`}}>
        <div style={{display: 'flex', justifyContent: 'space-between', gap: 16 * u, fontFamily: fonts.mono, fontSize: 21 * u, letterSpacing: '0.24em', textTransform: 'uppercase', color: alpha(g.slipInk, 0.62)}}>
          <span>Plate {String(number).padStart(2, '0')}</span>
          {place ? <span style={{overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis'}}>{place}</span> : null}
        </div>
        <div style={{height: 1.5 * u, background: alpha(g.slipInk, 0.25), margin: `${12 * u}px 0 ${14 * u}px`}} />
        <div style={{fontFamily: fonts.serifDisplay, fontSize: dateSize, lineHeight: 1.05, whiteSpace: 'nowrap'}}>
          {chars.map((ch, i) => {
            const p = progress(frame, typeAt + i * 1.6, 4, ease.snappy);
            return <span key={i} style={{opacity: p, filter: `blur(${(1 - p) * 4}px)`}}>{ch}</span>;
          })}
        </div>
        <div style={{width: `${ruleIn * 42}%`, height: 3 * u, background: g.stamp, marginTop: 12 * u}} />
        {plate.label ? (
          <div style={{marginTop: 14 * u}}>
            <KineticText text={plate.label} start={typeAt + 8} stagger={2} duration={16} style="blur" textStyle={{fontFamily: fonts.serif, fontStyle: 'italic', fontSize: 28 * u, lineHeight: 1.3, color: alpha(g.slipInk, 0.82)}} />
          </div>
        ) : null}
        <div style={{position: 'absolute', right: -22 * u, bottom: -26 * u, width: 92 * u, height: 92 * u, borderRadius: '50%', border: `${3 * u}px solid ${g.stamp}`, color: g.stamp, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: fonts.mono, fontSize: 20 * u, letterSpacing: '0.08em', opacity: stampIn * 0.85, transform: `rotate(${-18 + (1 - stampIn) * 25}deg) scale(${1.8 - 0.8 * stampIn})`}}>
          <div style={{position: 'absolute', inset: 7 * u, borderRadius: '50%', border: `${1.5 * u}px dashed ${alpha(g.stamp, 0.7)}`}} />
          Nº{number}
        </div>
      </div>
    </div>
  );
};

/** Projector wear: exposure flicker, a few vertical scratches and dust specks, reseeded every few frames. */
const FilmWear: React.FC<{dark: string; light: string; u: number}> = ({dark, light, u}) => {
  const frame = useCurrentFrame();
  const {width, height} = useVideoConfig();
  const f2 = Math.floor(frame / 2);
  const f3 = Math.floor(frame / 3);
  return (
    <AbsoluteFill style={{pointerEvents: 'none'}}>
      <AbsoluteFill style={{background: dark, opacity: rand(`fl${f2}`, 0, 0.08)}} />
      {[0, 1, 2].map(i =>
        rand(`sc${f3}${i}`) > 0.55 ? <div key={`s${i}`} style={{position: 'absolute', left: rand(`sx${f3}${i}`, 0.06, 0.94) * width, top: rand(`st${f3}${i}`, -0.2, 0.3) * height, height: rand(`sh${f3}${i}`, 0.5, 1.2) * height, width: Math.max(1, 1.6 * u), background: alpha(light, rand(`so${f3}${i}`, 0.12, 0.32))}} /> : null,
      )}
      {[0, 1, 2, 3].map(i =>
        rand(`d${frame}${i}`) > 0.62 ? <div key={`d${i}`} style={{position: 'absolute', left: rand(`dx${frame}${i}`) * width, top: rand(`dy${frame}${i}`) * height, width: rand(`ds${frame}${i}`, 3, 9) * u, height: rand(`dz${frame}${i}`, 2, 7) * u, borderRadius: '45% 55% 40% 60%', background: alpha(dark, 0.55)}} /> : null,
      )}
    </AbsoluteFill>
  );
};

/** 35mm edge: perforations and edge numbers on both sides of the picture. */
const FilmStrip: React.FC<{size: number; g: Tone}> = ({size, g}) => {
  const {height} = useVideoConfig();
  const pitch = size * 1.15;
  const n = Math.ceil(height / pitch) + 1;
  return (
    <>
      {[0, 1].map(side => (
        <div key={side} style={{position: 'absolute', top: 0, bottom: 0, [side ? 'right' : 'left']: 0, width: size, background: g.strip, overflow: 'hidden'} as React.CSSProperties}>
          {Array.from({length: n}, (_, i) => (
            <div key={i} style={{position: 'absolute', top: i * pitch + pitch * 0.25, [side ? 'right' : 'left']: size * 0.16, width: size * 0.42, height: pitch * 0.42, borderRadius: size * 0.08, background: g.hole} as React.CSSProperties} />
          ))}
          {Array.from({length: Math.ceil(n / 6)}, (_, i) => (
            <div key={`e${i}`} style={{position: 'absolute', top: i * pitch * 6 + pitch * 2.2, [side ? 'left' : 'right']: size * 0.06, fontFamily: fonts.mono, fontSize: size * 0.2, color: alpha(g.accent, 0.55), writingMode: 'vertical-rl', letterSpacing: '0.12em'} as React.CSSProperties}>
              {`▸${String(12 + i * 6 + side).padStart(3, '0')}`}
            </div>
          ))}
        </div>
      ))}
    </>
  );
};

/** Mounted print: paper border with photo corners. */
const PrintMount: React.FC<{size: number; g: Tone}> = ({size, g}) => {
  const corner = size * 2.2;
  const tri = (pos: React.CSSProperties, rot: number) => <div style={{position: 'absolute', ...pos, width: corner, height: corner, background: g.strip, clipPath: 'polygon(0 0, 100% 0, 0 100%)', transform: `rotate(${rot}deg)`, opacity: 0.92}} />;
  return (
    <AbsoluteFill style={{pointerEvents: 'none'}}>
      <AbsoluteFill style={{border: `${size}px solid ${g.slip}`, boxShadow: `inset 0 0 0 ${Math.max(1, size * 0.08)}px ${alpha(g.slipInk, 0.25)}, inset 0 0 ${size * 1.4}px rgba(0,0,0,.45)`}} />
      {tri({left: size * 0.5, top: size * 0.5}, 0)}
      {tri({right: size * 0.5, top: size * 0.5}, 90)}
      {tri({right: size * 0.5, bottom: size * 0.5}, 180)}
      {tri({left: size * 0.5, bottom: size * 0.5}, 270)}
    </AbsoluteFill>
  );
};

const titleFrames = (media: EntryProps<Props>['media'], fps: number) => Math.min(Math.round(3.4 * fps), Math.round((media.scenes[0]?.audio.duration ?? 2) * fps));

const ArchivalStreet: React.FC<EntryProps<Props>> = ({media, props}) => {
  const frame = useCurrentFrame();
  const {fps, width, height} = useVideoConfig();
  const look = useLook();
  const own = GRADES[props.grade];
  const g: Tone = look ? fromLook(look, own) : {...own, accent: media.accent ?? own.accent};
  const u = Math.min(width, height) / 1080;
  const landscape = width > height;
  const timeline = useSceneTimeline(media);
  const contentFrames = useContentFrames(media);
  const titleLen = titleFrames(media, fps);
  const overlap = Math.round(0.6 * fps);
  const half = Math.floor(overlap / 2);
  // Narrower in look mode so the kit's shared captions (7% side margins) stay clear of it.
  const strip = props.frame === 'film' ? Math.round((landscape ? 0.042 : look ? 0.045 : 0.058) * width) : 0;
  const mount = props.frame === 'print' ? Math.round(0.03 * Math.min(width, height)) : 0;
  const inset = strip + mount;
  const slipLeft = inset + width * (landscape ? 0.05 : 0.06);
  const slipTop = mount + height * (landscape ? 0.08 : 0.065);
  const slipWidth = landscape ? width * 0.3 : width * 0.64;
  const wx = rand(`wx${Math.floor(frame / 2)}`, -1.6, 1.6) * u;
  const wy = rand(`wy${Math.floor(frame / 2)}`, -2.2, 2.2) * u;
  const titleOut = 1 - progress(frame, titleLen - 14, 14, ease.cinematic);
  const longest = Math.max(6, ...props.title.split(/\s+/).map(w => w.length));
  const titleSize = Math.min((landscape ? 112 : 124) * u, ((width - 2 * inset) * 0.8) / (longest * 0.56));
  const wearDark = look && look.tone === 'light' ? look.palette.text : '#000000';
  const wearLight = look && look.tone === 'light' ? look.palette.bg : '#ffffff';
  return (
    <AbsoluteFill style={{background: g.paper, overflow: 'hidden'}}>
      {/* gate weave: the whole picture jitters a pixel or two, like film in a projector gate */}
      <AbsoluteFill style={{transform: `translate(${wx}px, ${wy}px) scale(1.01)`}}>
        <SceneSeries
          media={media}
          overlap={overlap}
          transition={i => (i % 2 ? 'iris' : 'blur')}
          renderScene={({index, timed}) => {
            const start = index === 0 ? 0 : half;
            const plate = props.plates[index];
            const slipStart = start + (index === 0 ? titleLen : 4);
            const slipEnd = Math.min(start + timed.durationInFrames + half, contentFrames - timed.from + start);
            return (
              <AbsoluteFill>
                {timed.scene.video ? <Photo scene={timed.scene} g={g} index={index} /> : <Street kind={props.street} g={g} index={index} />}
                <Haze color={g.fog} strength={timed.scene.video ? 0.25 : 0.4} />
                {plate && slipEnd - slipStart > fps ? <Slip plate={plate} number={index + 1} place={props.place} g={g} u={u} start={slipStart} end={slipEnd} left={slipLeft} top={slipTop} width={slipWidth} /> : null}
              </AbsoluteFill>
            );
          }}
        />
      </AbsoluteFill>
      <Particles count={36} color={g.fog} opacity={0.3} seed="motes" speed={0.2} size={[1.5, 4]} />
      {/* Title card: place, title and the opening date over a soft scrim */}
      <Sequence durationInFrames={titleLen}>
        <AbsoluteFill style={{opacity: titleOut}}>
          <AbsoluteFill style={{background: `radial-gradient(ellipse 75% 55% at 50% 45%, ${alpha(g.paper, 0.82)} 0%, ${alpha(g.paper, 0.55)} 60%, ${alpha(g.paper, 0.3)} 100%)`}} />
          <AbsoluteFill style={{justifyContent: 'center', alignItems: 'center', padding: `0 ${inset + width * 0.08}px`, paddingBottom: height * (look ? 0.12 : 0.04)}}>
            {props.place ? <div style={{fontFamily: fonts.mono, color: g.accent, fontSize: 26 * u, letterSpacing: `${tween(frame, [0, 40], [0.7, 0.42], ease.expo)}em`, textTransform: 'uppercase', opacity: progress(frame, 2, 18), marginBottom: 28 * u}}>{props.place}</div> : null}
            <KineticText text={props.title} start={8} stagger={4} duration={22} style="rise" align="center" textStyle={{fontFamily: fonts.serifDisplay, color: g.text, fontSize: titleSize, lineHeight: 1.04, textShadow: '0 6px 40px rgba(0,0,0,.45)'}} />
            <div style={{width: 220 * u * progress(frame, 22, 26, ease.cinematic), height: 2 * u, background: g.accent, margin: `${30 * u}px 0 ${22 * u}px`}} />
            {props.plates[0]?.date ? <KineticText text={props.plates[0].date} start={30} stagger={3} style="blur" align="center" textStyle={{fontFamily: fonts.serif, fontStyle: 'italic', color: alpha(g.text, 0.85), fontSize: 40 * u}} /> : null}
          </AbsoluteFill>
        </AbsoluteFill>
      </Sequence>
      <LightLeak from={0} durationInFrames={Math.round(2 * fps)} seed={11} opacity={0.45} hueShift={props.grade === 'cyanotype' && !look ? 180 : 0} />
      {timeline.slice(1).map(t => <LightLeak key={t.index} from={t.from - half} durationInFrames={overlap + 6} seed={t.index * 5 + 2} opacity={0.3} hueShift={props.grade === 'cyanotype' && !look ? 180 : 0} />)}
      {!look && props.showCaptions ? <AbsoluteFill style={{background: `linear-gradient(0deg, ${alpha(g.paper, 0.88)} 0%, ${alpha(g.paper, 0.55)} 18%, transparent 34%)`, opacity: progress(frame, titleLen - 10, 10)}} /> : null}
      {props.showCaptions
        ? timeline.map(t => (
            <Sequence key={t.index} from={t.from} durationInFrames={t.durationInFrames}>
              <AbsoluteFill style={{justifyContent: 'flex-end', padding: `0 ${inset + width * (landscape ? 0.12 : 0.06)}px ${height * (landscape ? 0.09 : 0.1) + mount}px`, opacity: frame >= titleLen ? 1 : 0}}>
                <StyledCaptions scene={t.scene} variant="karaoke" accent={g.text} color={alpha(g.text, 0.68)} font={fonts.serif} size={(landscape ? 50 : 56) * u} words={landscape ? 8 : 6} weight={700} />
              </AbsoluteFill>
            </Sequence>
          ))
        : null}
      <FilmWear dark={wearDark} light={wearLight} u={u} />
      <Vignette strength={0.6} />
      <Grain opacity={0.11} />
      {strip ? <FilmStrip size={strip} g={g} /> : null}
      {mount ? <PrintMount size={mount} g={g} /> : null}
      <NarrationTrack media={media} />
      <AdWeave media={media} theme={{background: g.paper, text: g.text, font: fonts.serifDisplay}} />
    </AbsoluteFill>
  );
};

export default defineEntry({
  id: 'documentary-archival-street',
  schema: Props,
  component: ArchivalStreet,
  // Shared captions wait for the title card, like the template's own captions.
  captionHold: ({media, fps}) => titleFrames(media, fps),
});
