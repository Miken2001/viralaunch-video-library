/**
 * Pixel sprites as character grids. Each character is a colour slot ('.' = transparent),
 * resolved through a colour map when drawn, so palettes and looks can recolour them.
 */
export type Grid = readonly string[];

const LEGS_A = ['..oo....oo..', '.oo......oo.'];
const LEGS_B = ['...oo..oo...', '...oo..oo...'];

const body = {
  runner: [
    '...oooooo...',
    '..obbbbbbo..',
    '.obhhbbbbbo.',
    '.obhbbbbbbo.',
    'obbbwkbbwkbo',
    'obbbwkbbwkbo',
    'obbbbbbbbbbo',
    'obsbbbbbbsbo',
    '.obssssssbo.',
    '..oooooooo..',
  ],
  astronaut: [
    '...oooooo...',
    '..owwwwwwo..',
    '.owwvvvvwwo.',
    '.owvhhvvvwo.',
    '.owvvvvvvwo.',
    '.owwvvvvwwo.',
    '..owwwwwwo..',
    '.obwwbbwwbo.',
    '.owwwwwwwwo.',
    '..oooooooo..',
  ],
  robot: [
    '.....oo.....',
    '.....vv.....',
    '..oooooooo..',
    '..ohbbbbbo..',
    '..obkbbkbo..',
    '..obbbbbbo..',
    '..oossssoo..',
    '.obbbbbbbbo.',
    '.obhbvvbhbo.',
    '..oooooooo..',
  ],
  cat: [
    '.o........o.',
    '.oo......oo.',
    '.obo....obo.',
    '.obboooobbo.',
    'obbbbbbbbbbo',
    'obbkbbbbkbbo',
    'obbbbvvbbbbo',
    'owbbbbbbbbwo',
    '.obbbbbbbbo.',
    '..oooooooo..',
  ],
} as const;

export type HeroName = keyof typeof body;
export const HERO_FRAMES = (hero: HeroName): [Grid, Grid] => [[...body[hero], ...LEGS_A], [...body[hero], ...LEGS_B]];

/** Per-hero colours (o = outline comes from the palette). */
export const HERO_COLORS: Record<HeroName, Record<string, string>> = {
  runner: {b: '#ff8a1f', h: '#ffc36b', s: '#c95a10', w: '#ffffff', k: '#14101c', v: '#ff8a1f'},
  astronaut: {b: '#ff5d5d', h: '#d9f6ff', s: '#9aa7b8', w: '#f2f4ff', k: '#14101c', v: '#3ec7ff'},
  robot: {b: '#9aa7b8', h: '#e3e9f1', s: '#5f6b7a', w: '#ffffff', k: '#14161c', v: '#ff4d6d'},
  cat: {b: '#f2a65a', h: '#ffd29a', s: '#c47a35', w: '#ffffff', k: '#1b1b1b', v: '#ff7aa8'},
};

export const HAZARD_SPRITES = {
  meteor: ['..oooo..', '.orrrro.', 'orrdrrro', 'orrrrdro', 'ordrrrro', 'orrrdrro', '.orrrro.', '..oooo..'],
  block: ['oooooooo', 'oyyyyyyo', 'oyoyyoyo', 'oyyooyyo', 'oyyooyyo', 'oyoyyoyo', 'oyyyyyyo', 'oooooooo'],
  spike: ['........', '...oo...', '..oggo..', '..oggo..', '.oggggo.', '.oggggo.', 'oggggggo', 'oooooooo'],
  bug: ['..o..o..', '...oo...', '.oggggo.', 'ogwkgwko', 'oggggggo', 'oglgglgo', '.oggggo.', '.o.oo.o.'],
  ghost: ['..oooo..', '.owwwwo.', 'owkwwkwo', 'owwwwwwo', 'owwwwwwo', 'owwwwwwo', 'owowwowo', 'o.o..o.o'],
} as const satisfies Record<string, Grid>;
export type HazardName = keyof typeof HAZARD_SPRITES;
export const HAZARD_COLORS: Record<HazardName, Record<string, string>> = {
  meteor: {r: '#a0663a', d: '#6b3f22'},
  block: {y: '#e0a050'},
  spike: {g: '#c8d0dc'},
  bug: {g: '#7ad04a', l: '#b8f27a', w: '#ffffff', k: '#14101c'},
  ghost: {w: '#f2f0ff', k: '#14101c'},
};

export const ITEM_SPRITES = {
  coin: ['..ooo..', '.oyyyo.', 'oyhyyyo', 'oyhyyyo', 'oyhyyyo', '.oyyyo.', '..ooo..'],
  star: ['...o...', '..oyo..', 'ooyyyoo', 'oyyhyyo', '.oyyyo.', '.oyoyo.', 'oo...oo'],
  gem: ['.ooooo.', 'ohcccco', 'occccco', '.occco.', '..oco..', '...o...', '.......'],
  heart: ['.oo.oo.', 'orrorro', 'orhrrro', 'orrrrro', '.orrro.', '..oro..', '...o...'],
} as const satisfies Record<string, Grid>;
export type ItemName = keyof typeof ITEM_SPRITES;
export const ITEM_COLORS = {y: '#ffd23f', h: '#fff3b0', c: '#3ee6ff', r: '#ff3b5c'};
export const ITEM_VALUE: Record<ItemName, number> = {coin: 100, star: 250, gem: 500, heart: 50};

/** Hazard that suits each world when the level says "auto". */
export const WORLD_HAZARD: Record<string, HazardName> = {space: 'meteor', city: 'block', forest: 'bug', ocean: 'block', desert: 'spike', cave: 'ghost', sky: 'meteor'};
