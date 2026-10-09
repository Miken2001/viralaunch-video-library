import React from 'react';
import {AbsoluteFill, Sequence, spring, useCurrentFrame, useVideoConfig} from 'remotion';
import {AdWeave, NarrationTrack, captionSafeBottom, defineEntry, mix, useContentFrames, useLook, useSceneTimeline, type ActiveLook, type EntryProps, type TimedScene} from '@viralaunch/kit';
import {CameraImage, Grain, KineticText, LightLeak, LineIcon, MeshGradient, Particles, SceneSeries, Spotlight, StyledCaptions, Vignette, alpha, ease, fonts, progress, rand, tween, type CameraMove} from '@viralaunch/kit/fx';
import {Props, type Milestone} from './schema';

type Pal = {tone: 'dark' | 'light'; bg: string; bg2: string; surface: string; text: string; muted: string; accent: string; line: string; paper: string; ink: string; blobs: string[]};

const PALETTES: Record<Props['palette'], Pal> = {
  studio: {tone: 'light', bg: '#f2f3f7', bg2: '#e4e8f1', surface: '#ffffff', text: '#14161c', muted: '#6a7080', accent: '#2f63f0', line: '#14161c', paper: '#fffdf6', ink: '#1a1a1a', blobs: ['#ffd8c4', '#cfe1ff', '#d4f3e2']},
  boardroom: {tone: 'dark', bg: '#060a15', bg2: '#15203c', surface: '#0f172e', text: '#eef2ff', muted: '#8e99ba', accent: '#ffb547', line: '#dfe5ff', paper: '#f5f0e4', ink: '#12141a', blobs: ['#22357f', '#4f2563', '#0f4a48']},
  heritage: {tone: 'light', bg: '#eee5d1', bg2: '#ddcfaf', surface: '#faf5e9', text: '#2a2016', muted: '#7d6d55', accent: '#a8402c', line: '#2a2016', paper: '#fbf7ec', ink: '#2a2016', blobs: ['#e6c493', '#d4c09c', '#cdd4bb']},
};

/**
 * The timeline in a sequence's shared look: background, surfaces and accent come from the look.
 * Dark looks keep a light "paper" document card (inked with the background colour), light looks
 * use their own surface.
 */
const fromLook = (l: ActiveLook): Pal => {
  const p = l.palette;
  const dark = l.tone === 'dark';
  return {
    tone: l.tone, bg: p.bg, bg2: p.bg2, surface: p.surface, text: p.text, muted: p.muted, accent: p.accent, line: p.line,
    paper: dark ? mix(p.text, p.bg, 0.05) : p.surface,
    ink: dark ? p.bg : p.text,
    blobs: [mix(p.bg2, p.accent, 0.35), p.bg2, mix(p.bg, p.line, dark ? 0.08 : 0.12)],
  };
};

const MOVES: CameraMove[] = ['push', 'pan-right', 'pull', 'pan-left', 'rise'];

/** When each milestone owns the stage: one narration scene per milestone (plus an optional title scene). */
function schedule(timeline: TimedScene[], n: number, fps: number, contentEnd: number) {
  let introEnd: number;
  let starts: number[];
  if (timeline.length >= n + 1) {
    starts = Array.from({length: n}, (_, i) => timeline[i + 1].from);
    introEnd = starts[0];
  } else if (timeline.length === n) {
    introEnd = Math.min(Math.round(1.8 * fps), Math.round(timeline[0].durationInFrames * 0.45));
    starts = Array.from({length: n}, (_, i) => (i === 0 ? introEnd : timeline[i].from));
  } else {
    introEnd = Math.min(Math.round(1.8 * fps), Math.round(contentEnd * 0.12));
    const each = (contentEnd - introEnd) / n;
    starts = Array.from({length: n}, (_, i) => Math.round(introEnd + i * each));
  }
  // Every milestone gets on screen before the end card, at least ~1s apart at the tail.
  const last = contentEnd - Math.round(1 * fps);
  starts = starts.map((s, i) => Math.min(s, last - (n - 1 - i) * 8));
  introEnd = Math.min(introEnd, starts[0]);
  const ends = starts.map((s, i) => (i < n - 1 ? starts[i + 1] : contentEnd));
  return {introEnd, starts, ends};
}

// ---------------------------------------------------------------------------------------------
// Year badge with a rolling odometer
// ---------------------------------------------------------------------------------------------

const Odometer: React.FC<{from: number; to: number; start: number; size: number; color: string}> = ({from, to, start, size, color}) => {
  const frame = useCurrentFrame();
  const a = String(Math.abs(from));
  const b = String(Math.abs(to));
  const len = Math.max(a.length, b.length);
  const da = a.padStart(len, '0');
  const db = b.padStart(len, '0');
  const lineH = size * 1.05;
  return (
    <div style={{display: 'flex', height: lineH, overflow: 'hidden', fontFamily: fonts.grotesk, fontWeight: 700, fontSize: size, lineHeight: `${lineH}px`, color, fontVariantNumeric: 'tabular-nums'}}>
      {to < 0 ? <span>-</span> : null}
      {Array.from({length: len}, (_, k) => {
        const d0 = Number(da[k]);
        const d1 = Number(db[k]);
        const target = d1 >= d0 ? d1 : d1 + 10;
        // Right-hand digits roll last and longest, like a mechanical counter settling.
        const t = progress(frame, start + k * 3, 18 + k * 4, ease.expo);
        const off = d0 + (target - d0) * t;
        const blur = Math.abs(target - d0) * (t > 0 && t < 1 ? (1 - t) * 0.6 : 0);
        return (
          <div key={k} style={{width: '0.62em', textAlign: 'center'}}>
            <div style={{transform: `translateY(${-off * lineH}px)`, filter: blur ? `blur(${Math.min(4, blur)}px)` : undefined}}>
              {Array.from({length: 20}, (_, j) => (
                <div key={j} style={{height: lineH}}>{j % 10}</div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
};

// ---------------------------------------------------------------------------------------------
// Milestone cards
// ---------------------------------------------------------------------------------------------

type CardProps = {m: Milestone; pal: Pal; k: number; cardW: number; cardH: number; start: number; dur: number; company: string; image: TimedScene | null; index: number};

const fit = (text: string, max: number, room: number, ratio = 0.56) => Math.min(max, room / Math.max(4, text.length * ratio));

/** Founding certificate / press release: double-ruled paper, serif name, drawn seal. */
const DocumentCard: React.FC<CardProps> = ({m, pal, k, cardW, start, company}) => {
  const frame = useCurrentFrame();
  const local = frame - start;
  const seal = progress(local, 16, 36, ease.cinematic);
  const r = 46 * k;
  const label: React.CSSProperties = {fontFamily: fonts.mono, fontSize: 17 * k, letterSpacing: '0.26em', textTransform: 'uppercase', color: alpha(pal.ink, 0.62)};
  return (
    <div style={{width: '100%', height: '100%', background: pal.paper, borderRadius: 10 * k, padding: 16 * k, boxShadow: `0 ${40 * k}px ${90 * k}px rgba(0,0,0,${pal.tone === 'dark' ? 0.55 : 0.18}), 0 ${6 * k}px ${18 * k}px rgba(0,0,0,.12)`}}>
      <div style={{width: '100%', height: '100%', border: `${2 * k}px solid ${alpha(pal.ink, 0.22)}`, outline: `${1 * k}px solid ${alpha(pal.ink, 0.12)}`, outlineOffset: -8 * k, borderRadius: 6 * k, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', padding: `${24 * k}px ${36 * k}px`, color: pal.ink}}>
        <div style={{...label, opacity: progress(local, 4, 14)}}>{m.tag}</div>
        <div style={{width: 80 * k * progress(local, 8, 20, ease.expo), height: 2 * k, background: alpha(pal.ink, 0.3), margin: `${16 * k}px 0`}} />
        <KineticText text={m.headline} start={start + 6} stagger={3} style="rise" align="center" textStyle={{fontFamily: fonts.serif, fontWeight: 700, fontSize: fit(m.headline, 66 * k, cardW * 1.05), lineHeight: 1.08, color: pal.ink}} />
        {company && company !== m.headline ? <div style={{fontFamily: fonts.sans, fontSize: 22 * k, color: alpha(pal.ink, 0.6), marginTop: 12 * k, opacity: progress(local, 14, 14)}}>{company}</div> : null}
        <div style={{fontFamily: fonts.serif, fontWeight: 700, fontSize: 30 * k, marginTop: 22 * k, opacity: progress(local, 18, 14), transform: `translateY(${(1 - progress(local, 18, 18, ease.expo)) * 12 * k}px)`}}>{m.date || String(m.year)}</div>
        <div style={{position: 'relative', width: r * 2, height: r * 2, marginTop: 22 * k}}>
          <svg width={r * 2} height={r * 2} style={{position: 'absolute', inset: 0, overflow: 'visible'}}>
            <circle cx={r} cy={r} r={r - 3 * k} fill="none" stroke={pal.accent} strokeWidth={5 * k} pathLength={1} strokeDasharray={1} strokeDashoffset={1 - seal} transform={`rotate(-90 ${r} ${r})`} />
            <circle cx={r} cy={r} r={r - 12 * k} fill="none" stroke={alpha(pal.accent, 0.4)} strokeWidth={1.5 * k} strokeDasharray={`${3 * k} ${4 * k}`} opacity={seal} />
          </svg>
          <div style={{position: 'absolute', left: r * 0.45, top: r * 0.45}}>
            <LineIcon name={m.icon} progress={progress(local, 26, 30, ease.cinematic)} size={r * 1.1} color={pal.accent} strokeWidth={3.2} />
          </div>
        </div>
      </div>
    </div>
  );
};

/** Spotlit product plate: the scene's image (contained, over its own blurred copy), else a drawn icon medallion. */
const ProductCard: React.FC<CardProps> = ({m, pal, k, cardW, cardH, start, dur, image, index}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const local = frame - start;
  const lift = spring({frame: local, fps, config: {damping: 16, stiffness: 110}});
  const plateH = cardH * 0.76;
  const float = Math.sin(local / 22) * 5 * k;
  const titleSize = fit(m.headline, 52 * k, cardW * 1.3);
  const med = plateH * 0.88;
  return (
    <div style={{width: '100%', height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center'}}>
      <div style={{position: 'relative', width: '100%', height: plateH, borderRadius: 26 * k, overflow: 'hidden', background: `radial-gradient(ellipse 90% 80% at 50% 30%, ${mix(pal.surface, pal.tone === 'dark' ? pal.line : '#ffffff', pal.tone === 'dark' ? 0.08 : 0.6)} 0%, ${mix(pal.surface, pal.bg2, 0.55)} 100%)`, boxShadow: `0 ${50 * k}px ${110 * k}px rgba(0,0,0,${pal.tone === 'dark' ? 0.6 : 0.2}), inset 0 0 0 ${1.5 * k}px ${alpha(pal.text, 0.1)}`, transform: `translateY(${(1 - lift) * 60 * k + float}px)`}}>
        {image && image.scene.video ? (
          <>
            <AbsoluteFill style={{filter: 'blur(26px) saturate(1.1)', opacity: 0.7, transform: 'scale(1.2)'}}>
              <CameraImage src={image.scene.video} isStatic={image.scene.isStaticImage} move="still" />
            </AbsoluteFill>
            <AbsoluteFill style={{padding: 22 * k}}>
              <CameraImage src={image.scene.video} isStatic={image.scene.isStaticImage} move={MOVES[index % MOVES.length]} strength={0.5} style={{objectFit: 'contain', filter: 'drop-shadow(0 20px 30px rgba(0,0,0,.35))'}} />
            </AbsoluteFill>
          </>
        ) : (
          <AbsoluteFill style={{justifyContent: 'center', alignItems: 'center'}}>
            <div style={{position: 'relative', width: med, height: med, transform: `scale(${0.85 + 0.15 * lift})`}}>
              <svg width={med} height={med} style={{position: 'absolute', inset: 0, overflow: 'visible'}}>
                <defs>
                  <radialGradient id={`tch-med${index}`} cx="35%" cy="30%" r="80%">
                    <stop offset="0%" stopColor={mix(pal.surface, '#ffffff', pal.tone === 'dark' ? 0.08 : 0.5)} />
                    <stop offset="100%" stopColor={mix(pal.surface, pal.bg2, 0.6)} />
                  </radialGradient>
                </defs>
                {[0, 1].map(q => {
                  const t = ((local + q * 40) % 80) / 80;
                  return <circle key={q} cx={med / 2} cy={med / 2} r={med * (0.4 + 0.08 * t)} fill="none" stroke={pal.accent} strokeWidth={2 * k} opacity={(1 - t) * 0.5} />;
                })}
                <g transform={`rotate(${local * 0.4} ${med / 2} ${med / 2})`}>
                  <circle cx={med / 2} cy={med / 2} r={med * 0.46} fill="none" stroke={alpha(pal.text, 0.35)} strokeWidth={2 * k} strokeDasharray={`${2 * k} ${12 * k}`} />
                </g>
                <circle cx={med / 2} cy={med / 2} r={med * 0.38} fill={`url(#tch-med${index})`} stroke={alpha(pal.accent, 0.7)} strokeWidth={3 * k} style={{filter: `drop-shadow(0 ${20 * k}px ${40 * k}px rgba(0,0,0,${pal.tone === 'dark' ? 0.5 : 0.18}))`}} />
              </svg>
              <div style={{position: 'absolute', left: med * 0.29, top: med * 0.29}}>
                <LineIcon name={m.icon} progress={progress(local, 8, 40, ease.cinematic)} size={med * 0.42} color={pal.accent} strokeWidth={3.4} />
              </div>
            </div>
          </AbsoluteFill>
        )}
        <Spotlight color="#ffffff" from={start + 6} length={Math.max(40, dur * 0.7)} size={0.5} />
        <div style={{position: 'absolute', left: 24 * k, top: 20 * k, fontFamily: fonts.mono, fontSize: 16 * k, letterSpacing: '0.24em', textTransform: 'uppercase', color: pal.muted, opacity: progress(local, 6, 14)}}>
          {m.tag} · {m.year}
        </div>
      </div>
      <div style={{flex: 1}} />
      <KineticText text={m.headline} start={start + 10} stagger={3} style="rise" align="center" accent={pal.accent} textStyle={{fontFamily: fonts.grotesk, fontWeight: 700, fontSize: titleSize, lineHeight: 1.05, color: pal.text, letterSpacing: '-0.01em'}} />
    </div>
  );
};

/** Growth number: counts up on a surface card, with a self-drawing icon and an accent rule. */
const StatCard: React.FC<CardProps> = ({m, pal, k, cardW, start, dur}) => {
  const frame = useCurrentFrame();
  const local = frame - start;
  const stat = m.stat ?? {value: m.year, decimals: 0, prefix: '', unit: '', label: ''};
  const count = tween(local, [10, 10 + Math.min(54, dur * 0.5)], [0, stat.value], ease.expo);
  const shown = `${stat.prefix}${count.toLocaleString('en-US', {minimumFractionDigits: stat.decimals, maximumFractionDigits: stat.decimals})}`;
  const finalLen = `${stat.prefix}${stat.value.toLocaleString('en-US', {minimumFractionDigits: stat.decimals, maximumFractionDigits: stat.decimals})}${stat.unit}`.length;
  const numSize = Math.min(150 * k, (cardW - 90 * k) / Math.max(3, finalLen * 0.66));
  const rule = progress(local, 14, 40, ease.expo);
  return (
    <div style={{width: '100%', height: '100%', background: pal.surface, borderRadius: 28 * k, padding: `${40 * k}px ${46 * k}px`, display: 'flex', flexDirection: 'column', position: 'relative', overflow: 'hidden', color: pal.text, boxShadow: `0 ${40 * k}px ${100 * k}px rgba(0,0,0,${pal.tone === 'dark' ? 0.5 : 0.16}), inset 0 0 0 ${1.5 * k}px ${alpha(pal.text, 0.08)}`}}>
      <AbsoluteFill style={{background: `radial-gradient(circle at 90% 0%, ${alpha(pal.accent, 0.2)}, transparent 55%)`}} />
      <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start'}}>
        <div style={{fontFamily: fonts.mono, fontSize: 18 * k, letterSpacing: '0.24em', textTransform: 'uppercase', color: pal.muted, opacity: progress(local, 2, 14)}}>{m.tag}</div>
        <LineIcon name={m.icon} progress={progress(local, 6, 34, ease.cinematic)} size={74 * k} color={pal.accent} strokeWidth={3.4} />
      </div>
      <div style={{flex: 1}} />
      <div style={{fontFamily: fonts.heavy, fontSize: numSize, lineHeight: 1, letterSpacing: '-0.02em', color: pal.accent, fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap'}}>
        {shown}
        <span style={{fontFamily: fonts.grotesk, fontWeight: 700, fontSize: numSize * 0.42, marginLeft: 10 * k, color: pal.text}}>{stat.unit}</span>
      </div>
      <div style={{width: `${rule * 100}%`, height: 4 * k, background: `linear-gradient(90deg, ${pal.accent}, ${alpha(pal.accent, 0)})`, margin: `${22 * k}px 0 ${18 * k}px`}} />
      <KineticText text={m.headline} start={start + 8} stagger={3} style="rise" textStyle={{fontFamily: fonts.grotesk, fontWeight: 700, fontSize: fit(m.headline, 44 * k, cardW * 1.4), lineHeight: 1.1, color: pal.text}} />
      {stat.label ? <div style={{fontFamily: fonts.sans, fontSize: 24 * k, color: pal.muted, marginTop: 8 * k, opacity: progress(local, 22, 16)}}>{stat.label}</div> : null}
    </div>
  );
};

/** Restructure / merger / spin-off: a parent box whose connectors draw down into 2–3 children. */
const BranchCard: React.FC<CardProps> = ({m, pal, k, cardW, cardH, start}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const local = frame - start;
  const kids = m.branches.slice(0, 3);
  const n = kids.length;
  const boxH = 92 * k;
  const parentW = Math.min(cardW * 0.62, Math.max(260 * k, m.headline.length * 30 * k + 80 * k));
  const parentY = cardH * 0.12;
  const busY = cardH * 0.5;
  const kidY = cardH * 0.62;
  const gap = 26 * k;
  const kidW = (cardW - gap * (n - 1)) / n;
  const kidX = (i: number) => i * (kidW + gap) + kidW / 2;
  const draw = progress(local, 18, 26, ease.cinematic);
  const parentIn = spring({frame: local, fps, config: {damping: 14, stiffness: 140}});
  const shadow = `0 ${24 * k}px ${60 * k}px rgba(0,0,0,${pal.tone === 'dark' ? 0.5 : 0.14})`;
  return (
    <div style={{position: 'relative', width: cardW, height: cardH}}>
      <svg width={cardW} height={cardH} style={{position: 'absolute', inset: 0, overflow: 'visible'}}>
        <path d={`M${cardW / 2},${parentY + boxH} L${cardW / 2},${busY}`} stroke={alpha(pal.text, 0.45)} strokeWidth={2.5 * k} fill="none" pathLength={1} strokeDasharray={1} strokeDashoffset={1 - Math.min(1, draw * 3)} />
        {kids.map((_, i) => (
          <path key={i} d={`M${cardW / 2},${busY} L${kidX(i)},${busY} L${kidX(i)},${kidY}`} stroke={alpha(pal.text, 0.45)} strokeWidth={2.5 * k} fill="none" pathLength={1} strokeDasharray={1} strokeDashoffset={1 - Math.max(0, Math.min(1, draw * 1.5 - 0.5))} />
        ))}
        <circle cx={cardW / 2} cy={busY} r={6 * k * Math.min(1, draw * 3)} fill={pal.accent} />
      </svg>
      <div style={{position: 'absolute', left: (cardW - parentW) / 2, top: parentY, width: parentW, height: boxH, borderRadius: 18 * k, background: pal.tone === 'dark' ? pal.paper : pal.text, color: pal.tone === 'dark' ? pal.ink : pal.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: shadow, transform: `scale(${0.6 + 0.4 * parentIn})`, opacity: Math.min(1, parentIn * 2)}}>
        <div style={{fontFamily: fonts.grotesk, fontWeight: 700, fontSize: fit(m.headline, 44 * k, parentW * 1.3)}}>{m.headline}</div>
      </div>
      {kids.map((name, i) => {
        const p = spring({frame: local - 36 - i * 6, fps, config: {damping: 14, stiffness: 150}});
        return (
          <div key={i} style={{position: 'absolute', left: kidX(i) - kidW / 2, top: kidY, width: kidW, height: boxH * 1.25, borderRadius: 18 * k, background: pal.surface, color: pal.text, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', boxShadow: `${shadow}, inset 0 0 0 ${1.5 * k}px ${alpha(pal.text, 0.08)}`, borderTop: `${4 * k}px solid ${i === 0 ? pal.accent : alpha(pal.accent, 0.4)}`, transform: `translateY(${(1 - p) * 30 * k}px) scale(${0.8 + 0.2 * p})`, opacity: Math.min(1, p * 2)}}>
            <div style={{fontFamily: fonts.grotesk, fontWeight: 700, fontSize: fit(name, 34 * k, kidW * 1.2), padding: `0 ${10 * k}px`, textAlign: 'center'}}>{name}</div>
          </div>
        );
      })}
    </div>
  );
};

const CARDS: Record<Milestone['card'], React.FC<CardProps>> = {document: DocumentCard, product: ProductCard, stat: StatCard, branch: BranchCard};

// ---------------------------------------------------------------------------------------------
// Year rail
// ---------------------------------------------------------------------------------------------

const Rail: React.FC<{ms: Milestone[]; pal: Pal; u: number; padX: number; W: number; y: number; starts: number[]; cur: number}> = ({ms, pal, u, padX, W, y, starts, cur}) => {
  const frame = useCurrentFrame();
  const {width, height} = useVideoConfig();
  const n = ms.length;
  const y0 = ms[0].year;
  const y1 = ms[n - 1].year;
  // Half calendar-true, half evenly spaced: keeps order and rough gaps without clumping dots.
  const pos = (i: number) => {
    const rank = n > 1 ? i / (n - 1) : 0.5;
    const lin = y1 > y0 ? (ms[i].year - y0) / (y1 - y0) : rank;
    return padX + W * (0.4 * lin + 0.6 * rank);
  };
  const lineIn = progress(frame, 4, 34, ease.cinematic);
  const prev = Math.max(0, cur - 1);
  const mx = cur < 0 ? pos(0) : tween(frame, [starts[cur], starts[cur] + 30], [pos(prev), pos(cur)], ease.cinematic);
  const fs = 20 * u;
  return (
    <svg width={width} height={height} style={{position: 'absolute', inset: 0, overflow: 'visible', pointerEvents: 'none'}}>
      {/* minor ticks */}
      {Array.from({length: 61}, (_, t) => {
        const x = padX + (W * t) / 60;
        return <line key={t} x1={x} x2={x} y1={y - (t % 5 ? 5 : 10) * u} y2={y} stroke={alpha(pal.text, t % 5 ? 0.14 : 0.28)} strokeWidth={1.2 * u} opacity={progress(frame, 6 + t * 0.4, 10)} />;
      })}
      <line x1={padX} x2={padX + W * lineIn} y1={y} y2={y} stroke={alpha(pal.text, 0.25)} strokeWidth={2 * u} />
      <line x1={padX} x2={mx} y1={y} y2={y} stroke={pal.accent} strokeWidth={4 * u} opacity={cur >= 0 ? 1 : 0} />
      {ms.map((m, i) => {
        const x = pos(i);
        const pop = progress(frame, 10 + i * 4, 14, ease.overshoot);
        const past = cur >= i;
        const on = cur === i;
        const reach = on ? progress(frame, starts[i] + 18, 12, ease.overshoot) : past ? 1 : 0;
        return (
          <g key={i} opacity={pop}>
            {on ? <circle cx={x} cy={y} r={(14 + 10 * ((frame % 40) / 40)) * u} fill="none" stroke={pal.accent} strokeWidth={2 * u} opacity={(1 - (frame % 40) / 40) * 0.7 * reach} /> : null}
            <circle cx={x} cy={y} r={(past ? 8 : 6) * u * (0.4 + 0.6 * pop)} fill={past && reach > 0.5 ? pal.accent : pal.bg} stroke={past ? pal.accent : alpha(pal.text, 0.5)} strokeWidth={2.5 * u} />
            <text x={x} y={y + 38 * u} textAnchor="middle" fill={on ? pal.text : pal.muted} style={{fontFamily: fonts.mono, fontSize: fs * (on ? 1 + 0.2 * reach : 1), fontWeight: on ? 700 : 400}}>{m.year}</text>
          </g>
        );
      })}
      {cur >= 0 ? (
        <g>
          <line x1={mx} x2={mx} y1={y - 34 * u} y2={y} stroke={pal.accent} strokeWidth={2 * u} />
          <path d={`M${mx - 9 * u},${y - 46 * u} L${mx + 9 * u},${y - 46 * u} L${mx},${y - 32 * u} Z`} fill={pal.accent} />
        </g>
      ) : null}
    </svg>
  );
};

// ---------------------------------------------------------------------------------------------
// Entry
// ---------------------------------------------------------------------------------------------

const CompanyHistory: React.FC<EntryProps<Props>> = ({media, props}) => {
  const frame = useCurrentFrame();
  const {fps, width: w, height: h} = useVideoConfig();
  const look = useLook();
  const own = PALETTES[props.palette];
  const pal: Pal = look ? fromLook(look) : {...own, accent: media.accent ?? own.accent};
  const u = Math.min(w, h) / 1080;
  const wide = w >= h;
  const square = Math.abs(w - h) < 8;
  const ms = props.milestones;
  const n = ms.length;
  const timeline = useSceneTimeline(media);
  const contentEnd = useContentFrames(media);
  const {introEnd, starts, ends} = schedule(timeline, n, fps, contentEnd);
  let cur = -1;
  starts.forEach((s, i) => {
    if (frame >= s) cur = i;
  });
  const sceneAt = (f: number) => timeline.find(t => f >= t.from && f < t.from + t.durationInFrames) ?? timeline[timeline.length - 1] ?? null;
  const displayFont = look ? look.font.display : props.palette === 'heritage' ? fonts.serifDisplay : fonts.grotesk;

  // Layout: badge row, stage (date chip, card, detail), year rail above the caption band.
  const padX = w * 0.06;
  const W = w - 2 * padX;
  const railY = look ? h * (1 - captionSafeBottom(look)) - 44 * u : h * (1 - (wide ? 0.2 : 0.17));
  const headerY = h * 0.05;
  const stageTop = headerY + 124 * u;
  const stageBottom = railY - 66 * u;
  const chipH = 44 * u;
  const detailH = (wide ? 72 : 104) * u;
  const cardMaxH = stageBottom - stageTop - chipH - detailH - 44 * u;
  const cardW = wide ? Math.min(w * (square ? 0.8 : 0.48), cardMaxH * 1.6) : w * 0.86;
  const cardH = wide ? cardMaxH : Math.min(cardMaxH, cardW * 0.95);
  const k = Math.min(cardW / 760, cardH / 520);

  const headerIn = progress(frame, introEnd - 6, 18);
  const titleOut = progress(frame, introEnd - 14, 14, ease.accelerate);
  const lastYear = ms[n - 1].year;
  const firstYear = ms[0].year;
  const tagCur = cur >= 0 ? ms[cur] : ms[0];

  return (
    <AbsoluteFill style={{background: pal.bg, overflow: 'hidden'}}>
      <MeshGradient base={pal.bg} colors={pal.blobs.map(c => alpha(c, pal.tone === 'dark' ? 0.55 : 0.7))} speed={0.6} />
      {/* Ambient: each narration scene's image, heavily blurred behind the stage */}
      <SceneSeries
        media={media}
        transition="blur"
        overlap={Math.round(0.6 * fps)}
        renderScene={({index, timed}) =>
          timed.scene.video ? (
            <AbsoluteFill style={{opacity: pal.tone === 'dark' ? 0.28 : 0.2, filter: 'blur(34px) saturate(1.2)'}}>
              <CameraImage src={timed.scene.video} isStatic={timed.scene.isStaticImage} move={MOVES[index % MOVES.length]} />
            </AbsoluteFill>
          ) : null
        }
      />
      <Particles count={36} color={pal.tone === 'dark' ? pal.text : pal.accent} opacity={pal.tone === 'dark' ? 0.25 : 0.14} seed="corp" speed={0.3} size={[1.5, 4]} />

      {/* Opening title */}
      {frame < introEnd + 2 ? (
        <AbsoluteFill style={{justifyContent: 'center', alignItems: 'center', paddingBottom: h - railY + 40 * u, opacity: 1 - titleOut, transform: `scale(${1 - titleOut * 0.06}) translateY(${-titleOut * 30 * u}px)`}}>
          <div style={{fontFamily: fonts.mono, fontSize: 24 * u, letterSpacing: '0.3em', textTransform: 'uppercase', color: pal.accent, opacity: progress(frame, 0, 14), marginBottom: 26 * u}}>
            {props.company} · {firstYear} – {Math.round(tween(frame, [6, Math.max(20, introEnd - 10)], [firstYear, lastYear], ease.expo))}
          </div>
          <KineticText text={props.title} start={4} stagger={4} style="rise" align="center" accent={pal.accent} textStyle={{fontFamily: displayFont, fontWeight: 700, color: pal.text, fontSize: fit(props.title, (wide ? 96 : 104) * u, w * 1.5, 0.5), lineHeight: 1.06, letterSpacing: '-0.015em', maxWidth: w * 0.84}} />
          <div style={{width: 140 * u * progress(frame, 14, 30, ease.expo), height: 3 * u, background: pal.accent, marginTop: 34 * u}} />
        </AbsoluteFill>
      ) : null}

      {/* Year badge + milestone counter */}
      <div style={{position: 'absolute', left: padX, right: padX, top: headerY, display: 'flex', justifyContent: 'space-between', alignItems: 'center', opacity: headerIn, transform: `translateY(${(1 - headerIn) * -20 * u}px)`}}>
        <div style={{display: 'flex', alignItems: 'center', gap: 22 * u, padding: `${12 * u}px ${26 * u}px`, borderRadius: 999, background: alpha(pal.surface, pal.tone === 'dark' ? 0.85 : 0.92), boxShadow: `0 ${12 * u}px ${36 * u}px rgba(0,0,0,${pal.tone === 'dark' ? 0.4 : 0.1}), inset 0 0 0 ${1.5 * u}px ${alpha(pal.text, 0.08)}`}}>
          <div style={{fontFamily: displayFont, fontWeight: 700, fontSize: 30 * u, color: pal.text, maxWidth: w * 0.3, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis'}}>{props.company}</div>
          <div style={{width: 1.5 * u, height: 46 * u, background: alpha(pal.text, 0.18)}} />
          <div>
            <div style={{fontFamily: fonts.mono, fontSize: 13 * u, letterSpacing: '0.3em', color: pal.muted}}>YEAR</div>
            <Odometer from={cur > 0 ? ms[cur - 1].year : firstYear} to={tagCur.year} start={cur >= 0 ? starts[cur] : 0} size={34 * u} color={pal.text} />
          </div>
        </div>
        <div style={{fontFamily: fonts.mono, fontSize: 19 * u, letterSpacing: '0.22em', color: pal.muted, textAlign: 'right'}}>
          <span style={{color: pal.text}}>{String(Math.max(1, cur + 1)).padStart(2, '0')}</span> / {String(n).padStart(2, '0')}
        </div>
      </div>

      {/* Milestones */}
      {ms.map((m, i) => {
        const start = starts[i];
        const end = ends[i];
        if (frame < start - 10 || frame > end + 20) return null;
        const local = frame - start;
        const enter = progress(frame, start - 4, 22, ease.snappy);
        const exit = i < n - 1 ? progress(frame, end - 10, 16, ease.accelerate) : 0;
        const Card = CARDS[m.card === 'stat' && !m.stat ? 'document' : m.card === 'branch' && m.branches.length < 2 ? 'document' : m.card];
        const image = sceneAt(start + 1);
        const chipIn = progress(local, 0, 16, ease.expo);
        const dateText = (m.date || String(m.year)).toUpperCase();
        return (
          <div key={i} style={{position: 'absolute', left: 0, right: 0, top: stageTop, height: stageBottom - stageTop, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', perspective: 1800 * u}}>
            {/* date chip */}
            <div style={{height: chipH, display: 'flex', alignItems: 'center', gap: 14 * u, padding: `0 ${22 * u}px`, borderRadius: 999, background: alpha(pal.surface, 0.9), boxShadow: `inset 0 0 0 ${1.5 * u}px ${alpha(pal.text, 0.1)}`, fontFamily: fonts.mono, fontSize: 17 * u, letterSpacing: '0.18em', color: pal.text, opacity: chipIn * (1 - exit), transform: `translateY(${(1 - chipIn) * 16 * u}px)`}}>
              <div style={{width: 9 * u, height: 9 * u, borderRadius: '50%', background: pal.accent}} />
              {dateText}
              <div style={{width: 5 * u, height: 5 * u, borderRadius: '50%', background: pal.muted}} />
              <span style={{color: pal.muted}}>{m.tag.toUpperCase()}</span>
            </div>
            {/* card */}
            <div style={{width: cardW, height: cardH, marginTop: 22 * u, position: 'relative', transformStyle: 'preserve-3d', transform: `translateX(${(1 - enter) * w * 0.22 - exit * w * 0.2}px) rotateY(${(1 - enter) * -32 + exit * 26}deg) scale(${0.92 + 0.08 * enter - exit * 0.06})`, opacity: Math.min(enter * 1.6, 1 - exit), filter: enter < 1 || exit > 0 ? `blur(${(1 - enter) * 8 + exit * 10}px)` : undefined}}>
              <Card m={m} pal={pal} k={k} cardW={cardW} cardH={cardH} start={start} dur={end - start} company={props.company} image={image} index={i} />
              {m.stamp ? <Stamp text={m.stamp} pal={pal} k={k} top={m.card === 'product'} local={local - Math.min(50, Math.round((end - start) * 0.4))} /> : null}
            </div>
            {/* detail */}
            <div style={{height: detailH, marginTop: 22 * u, width: wide ? Math.min(w * 0.7, Math.max(cardW * 1.3, w * 0.5)) : w * 0.86, opacity: 1 - exit}}>
              {m.detail ? <KineticText text={m.detail} start={start + 16} stagger={1.5} duration={16} style="blur" align="center" textStyle={{fontFamily: fonts.sans, fontWeight: 500, fontSize: (wide ? 30 : 36) * u, lineHeight: 1.3, color: alpha(pal.text, 0.78)}} /> : null}
            </div>
          </div>
        );
      })}

      <Rail ms={ms} pal={pal} u={u} padX={padX} W={W} y={railY} starts={starts} cur={cur} />

      {pal.tone === 'dark' ? starts.map((s, i) => <LightLeak key={i} from={Math.max(0, s - 8)} durationInFrames={Math.round(1.1 * fps)} seed={i * 5 + 3} opacity={0.3} />) : null}

      {props.showCaptions
        ? timeline.map(t => (
            <Sequence key={t.index} from={t.from} durationInFrames={t.durationInFrames}>
              <AbsoluteFill style={{justifyContent: 'flex-end', padding: wide ? '0 14% 3.4%' : '0 7% 5%'}}>
                <StyledCaptions scene={t.scene} variant="box" accent={pal.accent} color={pal.text} font={fonts.sans} size={(wide ? 40 : 48) * u} words={wide ? 7 : 4} weight={800} shadow={pal.tone === 'dark'} />
              </AbsoluteFill>
            </Sequence>
          ))
        : null}
      <Vignette strength={pal.tone === 'light' ? 0.18 : 0.5} />
      <Grain opacity={pal.tone === 'light' ? 0.04 : 0.06} />
      <NarrationTrack media={media} />
      <AdWeave media={media} theme={{background: pal.bg, text: pal.text, font: displayFont}} />
    </AbsoluteFill>
  );
};

/** Rubber stamp slammed onto the card's lower right corner. */
const Stamp: React.FC<{text: string; pal: Pal; k: number; local: number; top?: boolean}> = ({text, pal, k, local, top}) => {
  const p = progress(local, 0, 10, ease.overshoot);
  if (local < 0) return null;
  const tilt = -12 + rand(`stamp${text}`, -3, 3);
  return (
    <div style={{position: 'absolute', right: -18 * k, ...(top ? {top: 26 * k} : {bottom: 26 * k}), transform: `rotate(${tilt + (1 - p) * 24}deg) scale(${2.1 - 1.1 * p})`, opacity: Math.min(1, p * 1.5), border: `${5 * k}px solid ${pal.accent}`, borderRadius: 10 * k, padding: `${8 * k}px ${18 * k}px`, background: alpha(pal.paper, 0.9), color: pal.accent, fontFamily: fonts.heavy, fontSize: 34 * k, letterSpacing: '0.06em', textTransform: 'uppercase', boxShadow: `0 ${10 * k}px ${24 * k}px rgba(0,0,0,.2)`}}>
      {text}
    </div>
  );
};

export default defineEntry({id: 'timeline-company-history', schema: Props, component: CompanyHistory});
