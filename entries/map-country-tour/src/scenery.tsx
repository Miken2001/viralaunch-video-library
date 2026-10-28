import React from 'react';
import {rand} from '@viralaunch/kit/fx';
import type {Stop} from './schema';

export type SceneryColors = {sky: readonly string[]; hues: readonly string[]; ground: string; ink: string; sun: string};

const W = 600;
const H = 220;

/** A flat, slowly drifting illustration of the kind of place a stop is. Pure SVG shapes. */
export const Scenery: React.FC<{kind: Stop['scenery']; c: SceneryColors; seed: string; frame: number}> = ({kind, c, seed, frame}) => {
  const f = Math.max(0, frame);
  const id = `sky-${seed.replace(/[^a-zA-Z0-9]/g, '')}`;
  const hue = (i: number) => c.hues[i % c.hues.length];
  const sunY = 70 - Math.min(1, f / 40) * 16;
  let body: React.ReactNode = null;

  if (kind === 'city') {
    const back = Array.from({length: 16}, (_, i) => ({x: i * 52 - 20, w: rand(`${seed}bw${i}`, 40, 56), h: rand(`${seed}bh${i}`, 60, 130)}));
    const front = Array.from({length: 11}, (_, i) => ({x: i * 76 - 10, w: rand(`${seed}fw${i}`, 54, 72), h: rand(`${seed}fh${i}`, 50, 110)}));
    body = (
      <>
        <g transform={`translate(${-f * 0.12},0)`}>
          {back.map((b, i) => <rect key={i} x={b.x} y={190 - b.h} width={b.w} height={b.h} fill={c.ink} opacity={0.28} />)}
        </g>
        <g transform={`translate(${-f * 0.25},0)`}>
          {front.map((b, i) => (
            <g key={i}>
              <rect x={b.x} y={200 - b.h} width={b.w} height={b.h} rx={3} fill={hue(i)} />
              {Array.from({length: Math.floor(b.h / 22)}, (_, r) =>
                [0, 1, 2].map(k => (rand(`${seed}win${i}${r}${k}`) > 0.45 ? <rect key={`${r}${k}`} x={b.x + 8 + k * ((b.w - 16) / 3)} y={208 - b.h + r * 22} width={(b.w - 28) / 3} height={9} fill={c.sun} opacity={0.85} /> : null)),
              )}
            </g>
          ))}
        </g>
      </>
    );
  } else if (kind === 'mountains') {
    const peaks = [
      {x: 120, h: 120, w: 170, o: 0.35},
      {x: 470, h: 130, w: 190, o: 0.35},
      {x: 300, h: 165, w: 230, o: 1},
      {x: 40, h: 90, w: 150, o: 1},
      {x: 560, h: 100, w: 160, o: 1},
    ];
    body = (
      <>
        {peaks.map((p, i) => {
          const dx = -f * (p.o < 1 ? 0.06 : 0.14);
          const top = 200 - p.h;
          const cap = p.h * 0.28;
          return (
            <g key={i} transform={`translate(${dx},0)`}>
              <path d={`M${p.x - p.w / 2},200 L${p.x},${top} L${p.x + p.w / 2},200 Z`} fill={p.o < 1 ? c.ink : hue(i + 1)} opacity={p.o < 1 ? 0.3 : 1} />
              <path d={`M${p.x - (p.w / 2) * (cap / p.h)},${top + cap} L${p.x},${top} L${p.x + (p.w / 2) * (cap / p.h)},${top + cap} L${p.x + 8},${top + cap - 8} L${p.x - 6},${top + cap} Z`} fill="#ffffff" opacity={0.92} />
            </g>
          );
        })}
      </>
    );
  } else if (kind === 'coast') {
    const bob = Math.sin(f / 9) * 3;
    body = (
      <>
        <path d={`M0,120 L70,96 L110,104 L140,150 L0,170 Z`} fill={hue(2)} />
        <rect x={80} y={70} width={16} height={36} fill="#ffffff" />
        <rect x={80} y={80} width={16} height={8} fill={hue(0)} />
        <path d="M76,70 L88,58 L100,70 Z" fill={hue(0)} />
        <rect x={0} y={140} width={W} height={H - 140} fill={hue(4)} />
        {Array.from({length: 6}, (_, i) => {
          const x = ((i * 130 + f * (1 + (i % 3) * 0.4)) % (W + 160)) - 80;
          const y = 156 + (i % 3) * 18;
          return <path key={i} d={`M${x},${y} q15,-8 30,0 t30,0`} fill="none" stroke="#ffffff" strokeWidth={3} strokeLinecap="round" opacity={0.6} />;
        })}
        <g transform={`translate(${380 - f * 0.3},${bob})`}>
          <path d="M0,140 L60,140 L50,152 L10,152 Z" fill={c.ink} />
          <path d="M30,138 L30,92 L58,134 Z" fill="#ffffff" />
          <path d="M27,138 L27,100 L8,134 Z" fill={hue(1)} />
        </g>
      </>
    );
  } else if (kind === 'forest') {
    const rows = [0, 1, 2];
    body = (
      <>
        {rows.map(r => (
          <g key={r} transform={`translate(${-f * (0.05 + r * 0.08)},0)`}>
            {Array.from({length: 14 + r * 2}, (_, i) => {
              const x = i * (48 - r * 6) + rand(`${seed}tx${r}${i}`, -10, 10);
              const h = rand(`${seed}th${r}${i}`, 60, 100) + r * 14;
              const base = 160 + r * 22;
              return <path key={i} d={`M${x - h * 0.28},${base} L${x},${base - h} L${x + h * 0.28},${base} Z`} fill={r === 2 ? hue(3) : c.ink} opacity={r === 2 ? 1 : 0.25 + r * 0.25} />;
            })}
          </g>
        ))}
      </>
    );
  } else if (kind === 'desert') {
    body = (
      <>
        <path d={`M${-f * 0.1},170 Q150,120 300,160 T${640 - f * 0.1},150 L640,220 L0,220 Z`} fill={hue(1)} opacity={0.55} />
        <path d={`M0,190 Q180,140 360,186 T720,176 L720,220 L0,220 Z`} transform={`translate(${-f * 0.2},0)`} fill={hue(1)} />
        <g transform={`translate(${470 - f * 0.2},0)`} fill={hue(3)}>
          <rect x={0} y={130} width={14} height={60} rx={7} />
          <rect x={-18} y={148} width={12} height={26} rx={6} />
          <rect x={-18} y={168} width={22} height={10} rx={5} />
          <rect x={20} y={140} width={12} height={24} rx={6} />
          <rect x={10} y={158} width={22} height={10} rx={5} />
        </g>
      </>
    );
  } else if (kind === 'countryside') {
    body = (
      <>
        <path d="M0,150 Q160,100 320,140 T640,130 L640,220 L0,220 Z" fill={hue(3)} opacity={0.6} transform={`translate(${-f * 0.08},0)`} />
        <g transform={`translate(${-f * 0.18},0)`}>
          <path d="M-20,180 Q200,130 420,170 T860,160 L860,220 L-20,220 Z" fill={hue(3)} />
          {[0, 1, 2, 3].map(i => <path key={i} d={`M-20,${194 + i * 8} Q200,${146 + i * 18} 420,${184 + i * 10} T860,${174 + i * 9}`} fill="none" stroke={c.ink} strokeWidth={2} opacity={0.2} />)}
          <rect x={300} y={128} width={44} height={30} fill={hue(0)} />
          <path d="M294,130 L322,108 L350,130 Z" fill={c.ink} />
          <rect x={316} y={142} width={12} height={16} fill={c.sun} />
          <circle cx={420} cy={136} r={20} fill={c.ink} opacity={0.8} />
          <rect x={417} y={150} width={6} height={18} fill={c.ink} />
        </g>
      </>
    );
  } else {
    // oldtown: a row of colourful historic houses with balconies and swinging bunting
    const houses = Array.from({length: 9}, (_, i) => ({x: i * 82 - 30, w: 80, h: rand(`${seed}oh${i}`, 100, 140)}));
    const swing = Math.sin(f / 12) * 4;
    body = (
      <g transform={`translate(${-f * 0.2},0)`}>
        {houses.map((h, i) => (
          <g key={i}>
            <rect x={h.x} y={210 - h.h} width={h.w} height={h.h} fill={hue(i)} />
            <rect x={h.x - 3} y={210 - h.h - 8} width={h.w + 6} height={10} fill={c.ink} opacity={0.75} />
            {[0, 1].map(k => <path key={k} d={`M${h.x + 14 + k * 32},${232 - h.h + 40} v-16 a9,9 0 0 1 18,0 v16 Z`} fill={c.ink} opacity={0.55} />)}
            <rect x={h.x + 8} y={232 - h.h + 42} width={h.w - 16} height={4} fill="#ffffff" opacity={0.85} />
            <path d={`M${h.x + 28},210 v-30 a12,12 0 0 1 24,0 v30 Z`} fill={c.ink} opacity={0.7} />
          </g>
        ))}
        <path d={`M-30,46 Q${300},${70 + swing} 720,46`} fill="none" stroke={c.ink} strokeWidth={1.5} opacity={0.6} />
        {Array.from({length: 22}, (_, i) => {
          const t = i / 21;
          const x = -30 + t * 750;
          const y = 46 + (1 - (2 * t - 1) ** 2) * (24 + swing);
          return <path key={i} d={`M${x - 8},${y} L${x + 8},${y} L${x},${y + 16} Z`} fill={hue(i + 2)} />;
        })}
      </g>
    );
  }

  return (
    <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMid slice" style={{width: '100%', height: '100%', display: 'block'}}>
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={c.sky[0]} />
          <stop offset="100%" stopColor={c.sky[1]} />
        </linearGradient>
      </defs>
      <rect width={W} height={H} fill={`url(#${id})`} />
      <circle cx={470} cy={sunY} r={30} fill={c.sun} opacity={0.9} />
      <circle cx={470} cy={sunY} r={46} fill={c.sun} opacity={0.18} />
      {body}
      <rect x={0} y={208} width={W} height={12} fill={c.ground} />
    </svg>
  );
};
