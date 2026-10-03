/**
 * Line icons that draw themselves. Every icon is a set of stroke paths in a 100×100 box, so
 * `progress` (0→1) animates the pen. Use names from `iconNames` in props schemas so a model
 * can only pick icons that exist.
 */
import React from 'react';
import {evolvePath} from '@remotion/paths';

const I: Record<string, string[]> = {
  sun: ['M50 32 A18 18 0 1 1 49.9 32', 'M50 6 L50 18', 'M50 82 L50 94', 'M6 50 L18 50', 'M82 50 L94 50', 'M19 19 L27 27', 'M73 73 L81 81', 'M19 81 L27 73', 'M73 27 L81 19'],
  cloud: ['M28 70 C14 70 12 52 26 50 C26 34 46 30 52 42 C58 30 80 34 78 52 C92 54 90 70 76 70 Z'],
  rain: ['M28 56 C14 56 12 38 26 36 C26 20 46 16 52 28 C58 16 80 20 78 38 C92 40 90 56 76 56 Z', 'M34 66 L30 80', 'M52 66 L48 80', 'M70 66 L66 80'],
  globe: ['M50 10 A40 40 0 1 1 49.9 10', 'M10 50 L90 50', 'M50 10 C30 30 30 70 50 90', 'M50 10 C70 30 70 70 50 90', 'M16 30 L84 30', 'M16 70 L84 70'],
  gear: ['M50 34 A16 16 0 1 1 49.9 34', 'M46 8 L54 8 L56 20 L66 24 L76 16 L84 24 L76 34 L80 44 L92 46 L92 54 L80 56 L76 66 L84 76 L76 84 L66 76 L56 80 L54 92 L46 92 L44 80 L34 76 L24 84 L16 76 L24 66 L20 56 L8 54 L8 46 L20 44 L24 34 L16 24 L24 16 L34 24 L44 20 Z'],
  person: ['M50 14 A12 12 0 1 1 49.9 14', 'M50 38 L50 66', 'M50 46 L32 58', 'M50 46 L68 58', 'M50 66 L36 90', 'M50 66 L64 90'],
  people: ['M34 22 A10 10 0 1 1 33.9 22', 'M66 22 A10 10 0 1 1 65.9 22', 'M16 84 C16 60 52 60 52 84', 'M48 84 C48 60 84 60 84 84'],
  bulb: ['M50 10 C28 10 20 34 32 50 C38 58 38 64 38 70 L62 70 C62 64 62 58 68 50 C80 34 72 10 50 10', 'M40 80 L60 80', 'M43 90 L57 90'],
  chart: ['M12 88 L88 88', 'M12 88 L12 12', 'M24 70 L40 52 L56 62 L84 26', 'M72 26 L84 26 L84 38'],
  bars: ['M12 88 L88 88', 'M22 88 L22 60', 'M40 88 L40 40', 'M58 88 L58 52', 'M76 88 L76 22'],
  book: ['M50 22 C40 14 22 14 12 18 L12 84 C22 80 40 80 50 88 C60 80 78 80 88 84 L88 18 C78 14 60 14 50 22 Z', 'M50 22 L50 88'],
  rocket: ['M50 8 C66 20 70 44 64 66 L36 66 C30 44 34 20 50 8 Z', 'M50 30 A6 6 0 1 1 49.9 30', 'M36 56 L22 72 L36 70', 'M64 56 L78 72 L64 70', 'M42 74 L50 92 L58 74'],
  heart: ['M50 84 C20 62 10 44 18 30 C26 16 44 18 50 32 C56 18 74 16 82 30 C90 44 80 62 50 84 Z'],
  lock: ['M24 44 L76 44 L76 88 L24 88 Z', 'M34 44 L34 30 C34 10 66 10 66 30 L66 44', 'M50 60 L50 72'],
  search: ['M42 12 A28 28 0 1 1 41.9 12', 'M62 62 L88 88'],
  phone: ['M30 8 L70 8 C74 8 76 10 76 14 L76 86 C76 90 74 92 70 92 L30 92 C26 92 24 90 24 86 L24 14 C24 10 26 8 30 8 Z', 'M44 16 L56 16', 'M46 82 L54 82'],
  money: ['M8 28 L92 28 L92 72 L8 72 Z', 'M50 38 A12 12 0 1 1 49.9 38', 'M20 40 L20 60', 'M80 40 L80 60'],
  clock: ['M50 10 A40 40 0 1 1 49.9 10', 'M50 24 L50 50 L68 62'],
  leaf: ['M18 82 C18 40 46 16 86 14 C84 54 60 82 18 82 Z', 'M18 82 L62 38'],
  drop: ['M50 8 C50 8 20 46 20 64 C20 82 34 92 50 92 C66 92 80 82 80 64 C80 46 50 8 50 8 Z', 'M34 66 C34 74 40 80 48 80'],
  flask: ['M38 8 L62 8', 'M42 8 L42 38 L16 86 L84 86 L58 38 L58 8', 'M26 66 L74 66'],
  atom: ['M50 44 A6 6 0 1 1 49.9 44', 'M50 14 C80 14 80 86 50 86 C20 86 20 14 50 14', 'M14 32 C30 6 86 54 86 68 C70 94 14 46 14 32', 'M86 32 C70 6 14 54 14 68 C30 94 86 46 86 32'],
  building: ['M18 92 L18 20 L58 10 L58 92', 'M58 40 L84 48 L84 92', 'M10 92 L92 92', 'M28 32 L36 32', 'M42 32 L48 32', 'M28 48 L36 48', 'M42 48 L48 48', 'M28 64 L36 64', 'M42 64 L48 64', 'M66 60 L76 62', 'M66 76 L76 78'],
  house: ['M12 48 L50 14 L88 48', 'M22 40 L22 88 L78 88 L78 40', 'M42 88 L42 62 L58 62 L58 88'],
  car: ['M10 64 L16 44 C18 38 22 36 28 36 L72 36 C78 36 82 38 84 44 L90 64 L90 76 L10 76 Z', 'M28 76 A8 8 0 1 1 27.9 76', 'M72 76 A8 8 0 1 1 71.9 76', 'M22 52 L78 52'],
  check: ['M50 8 A42 42 0 1 1 49.9 8', 'M30 52 L44 66 L72 36'],
  cross: ['M50 8 A42 42 0 1 1 49.9 8', 'M34 34 L66 66', 'M66 34 L34 66'],
  arrow: ['M10 50 L86 50', 'M66 30 L88 50 L66 70'],
  cycle: ['M78 34 A32 32 0 1 0 82 56', 'M68 20 L80 34 L64 42'],
  star: ['M50 8 L61 38 L92 38 L67 57 L76 88 L50 70 L24 88 L33 57 L8 38 L39 38 Z'],
  flag: ['M20 92 L20 10', 'M20 12 C40 4 56 22 82 12 L82 52 C56 62 40 44 20 52'],
  mountain: ['M6 86 L36 34 L52 58 L66 40 L94 86 Z', 'M28 48 L36 34 L44 48'],
  wave: ['M6 40 C20 28 32 52 48 40 C62 28 76 52 94 40', 'M6 60 C20 48 32 72 48 60 C62 48 76 72 94 60'],
  fire: ['M50 92 C26 92 16 72 24 54 C30 40 40 36 40 18 C54 28 58 40 56 52 C62 48 64 40 64 34 C78 48 82 62 78 72 C74 84 64 92 50 92 Z'],
  brain: ['M50 18 C40 8 22 14 22 28 C10 32 10 50 20 56 C14 70 28 84 42 78 C46 86 54 86 58 78 C72 84 86 70 80 56 C90 50 90 32 78 28 C78 14 60 8 50 18 Z', 'M50 18 L50 80'],
  chip: ['M28 28 L72 28 L72 72 L28 72 Z', 'M40 40 L60 40 L60 60 L40 60 Z', 'M36 28 L36 14', 'M50 28 L50 14', 'M64 28 L64 14', 'M36 72 L36 86', 'M50 72 L50 86', 'M64 72 L64 86', 'M28 36 L14 36', 'M28 64 L14 64', 'M72 36 L86 36', 'M72 64 L86 64'],
  shield: ['M50 8 L84 20 L84 46 C84 68 68 84 50 92 C32 84 16 68 16 46 L16 20 Z', 'M34 50 L46 62 L68 38'],
  chat: ['M12 18 L88 18 L88 66 L40 66 L22 84 L24 66 L12 66 Z', 'M26 36 L74 36', 'M26 50 L60 50'],
  mail: ['M10 24 L90 24 L90 78 L10 78 Z', 'M10 26 L50 56 L90 26'],
  camera: ['M10 30 L32 30 L38 20 L62 20 L68 30 L90 30 L90 82 L10 82 Z', 'M50 40 A16 16 0 1 1 49.9 40'],
  music: ['M36 72 A10 10 0 1 1 35.9 72', 'M76 62 A10 10 0 1 1 75.9 62', 'M44 74 L44 18 L84 10 L84 64'],
  trophy: ['M30 10 L70 10 L70 36 C70 52 60 60 50 60 C40 60 30 52 30 36 Z', 'M30 18 L14 18 C14 34 22 40 30 40', 'M70 18 L86 18 C86 34 78 40 70 40', 'M50 60 L50 76', 'M32 90 L68 90 L64 76 L36 76 Z'],
  ball: ['M50 8 A42 42 0 1 1 49.9 8', 'M50 30 L68 42 L62 64 L38 64 L32 42 Z', 'M50 8 L50 30', 'M68 42 L90 38', 'M62 64 L74 86', 'M38 64 L26 86', 'M32 42 L10 38'],
  planet: ['M50 26 A24 24 0 1 1 49.9 26', 'M10 66 C20 80 84 52 90 36 C94 26 76 26 62 30', 'M38 72 C24 76 12 74 10 66'],
  map: ['M10 20 L36 10 L64 20 L90 10 L90 80 L64 90 L36 80 L10 90 Z', 'M36 10 L36 80', 'M64 20 L64 90'],
  pin: ['M50 92 C50 92 20 58 20 38 C20 20 34 8 50 8 C66 8 80 20 80 38 C80 58 50 92 50 92 Z', 'M50 28 A10 10 0 1 1 49.9 28'],
  target: ['M50 8 A42 42 0 1 1 49.9 8', 'M50 24 A26 26 0 1 1 49.9 24', 'M50 40 A10 10 0 1 1 49.9 40'],
  spark: ['M50 6 L56 44 L94 50 L56 56 L50 94 L44 56 L6 50 L44 44 Z'],
  code: ['M34 26 L10 50 L34 74', 'M66 26 L90 50 L66 74', 'M58 16 L42 84'],
  cart: ['M6 14 L20 14 L32 66 L80 66 L90 28 L24 28', 'M38 80 A6 6 0 1 1 37.9 80', 'M74 80 A6 6 0 1 1 73.9 80'],
  calendar: ['M12 20 L88 20 L88 88 L12 88 Z', 'M12 38 L88 38', 'M30 10 L30 28', 'M70 10 L70 28', 'M28 54 L36 54', 'M46 54 L54 54', 'M64 54 L72 54', 'M28 70 L36 70', 'M46 70 L54 70'],
};

export {ICON_NAMES as iconNames, type IconName} from './icon-names';

/**
 * A stroked icon. `progress` 0→1 draws it; strokes start one after another (overlapping)
 * so complex icons feel hand-drawn.
 */
export const LineIcon: React.FC<{name: string; progress?: number; size?: number; color?: string; strokeWidth?: number; fill?: string; style?: React.CSSProperties}> = ({name, progress = 1, size = 120, color = '#111', strokeWidth = 4, fill = 'none', style}) => {
  const paths = I[name] ?? I.spark;
  const n = paths.length;
  return (
    <svg width={size} height={size} viewBox="-4 -4 108 108" style={{overflow: 'visible', ...style}}>
      {paths.map((d, i) => {
        // Each stroke occupies an overlapping window of the overall progress.
        const local = Math.max(0, Math.min(1, (progress * (n + 1) - i) / 2));
        if (local <= 0) return null;
        const e = evolvePath(local, d);
        return <path key={i} d={d} fill={i === 0 && local >= 1 ? fill : 'none'} stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" strokeDasharray={e.strokeDasharray} strokeDashoffset={e.strokeDashoffset} />;
      })}
    </svg>
  );
};
