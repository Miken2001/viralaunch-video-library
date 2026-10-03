/**
 * Looks: the shared visual language of a multi-template video.
 *
 * A template owns its layout, motion, camera and illustration style. When several templates are
 * stitched into one video (a "sequence"), they must still read as ONE film, so the sequence
 * passes a `media.look`. The look covers captions, fonts, the background family, surfaces, text
 * colours, texture and chrome (labels, trackers, icons). Every template reads it via `useLook()`.
 *
 * - No `media.look` (single renders): `useLook()` returns null and templates keep their own design.
 * - With `media.look`: the kit draws the captions itself (identical font, size, colours and
 *   position in every segment), template caption components render nothing, and templates take
 *   colours and fonts from the look.
 *
 * A look is a named preset (`LOOKS`) plus optional overrides; the preset normally comes from the
 * sequence's anchor template (its meta.json `lookPreset`).
 */
import React from 'react';
import {z} from 'zod';
import {baseFonts as fonts, setFontRoles, type FontName} from './font-names';

export type FontKey = FontName;
const FONT_KEYS = Object.keys(fonts) as [FontKey, ...FontKey[]];
const hex = z.string().regex(/^#[0-9a-fA-F]{6}$/);

const CaptionLookSchema = z.object({
  variant: z.enum(['pop', 'box', 'karaoke', 'minimal']),
  font: z.enum(FONT_KEYS),
  /** Font size as a fraction of min(width, height). */
  size: z.number().min(0.02).max(0.12),
  weight: z.number().int().min(300).max(900),
  color: hex,
  highlight: hex,
  /** Distance of the caption block's bottom from the frame bottom, as a fraction of height. */
  bottom: z.number().min(0.02).max(0.6),
  words: z.number().int().min(1).max(10),
  uppercase: z.boolean(),
  shadow: z.boolean(),
});
const FontsLookSchema = z.object({display: z.enum(FONT_KEYS), body: z.enum(FONT_KEYS), label: z.enum(FONT_KEYS), serif: z.enum(FONT_KEYS), hand: z.enum(FONT_KEYS)});
const PaletteLookSchema = z.object({
  /** Main background and a second background tone (gradients, blobs, far planes). */
  bg: hex,
  bg2: hex,
  /** Cards, panels, plates. */
  surface: hex,
  text: hex,
  muted: hex,
  accent: hex,
  /** Strokes: diagram lines, icons, rules. */
  line: hex,
});
const TextureLookSchema = z.object({grain: z.number().min(0).max(0.3), vignette: z.number().min(0).max(1)});
const ChromeLookSchema = z.object({labelTracking: z.number().min(0).max(0.6), labelUppercase: z.boolean(), iconStroke: z.number().min(1).max(8), radius: z.number().min(0).max(0.08)});

export const FullLookSchema = z.object({
  name: z.string(),
  tone: z.enum(['dark', 'light']),
  captions: CaptionLookSchema,
  fonts: FontsLookSchema,
  palette: PaletteLookSchema,
  texture: TextureLookSchema,
  chrome: ChromeLookSchema,
});
export type FullLook = z.infer<typeof FullLookSchema>;

/** What a render carries: a preset name plus any overrides (e.g. brand accent/fonts). */
export const LookSchema = z.object({
  preset: z.string().regex(/^[a-z0-9-]+$/).optional(),
  captions: CaptionLookSchema.partial().optional(),
  fonts: FontsLookSchema.partial().optional(),
  palette: PaletteLookSchema.partial().optional(),
  texture: TextureLookSchema.partial().optional(),
  chrome: ChromeLookSchema.partial().optional(),
});
export type Look = z.infer<typeof LookSchema>;

const base = {
  fonts: {display: 'heavy', body: 'sans', label: 'mono', serif: 'serif', hand: 'hand'},
  texture: {grain: 0.07, vignette: 0.5},
  chrome: {labelTracking: 0.28, labelUppercase: true, iconStroke: 4, radius: 0.03},
} as const;

/**
 * Presets. Each template's meta.json names the one closest to its own design (`lookPreset`), so
 * a sequence anchored on that template looks like it from start to finish.
 */
export const LOOKS: Record<string, FullLook> = {
  /** Warm-black film look with heavy white type: cinematic b-roll, glitch, launch films. */
  cinematic: {
    name: 'cinematic', tone: 'dark', ...base,
    captions: {variant: 'pop', font: 'heavy', size: 0.066, weight: 900, color: '#ffffff', highlight: '#FFB703', bottom: 0.15, words: 3, uppercase: true, shadow: true},
    palette: {bg: '#0c0a08', bg2: '#1d1710', surface: '#16120d', text: '#ffffff', muted: '#b8ad9c', accent: '#FFB703', line: '#f3ece0'},
  },
  /** Editorial serif on deep ink: documentaries, history, quotes. */
  documentary: {
    name: 'documentary', tone: 'dark', ...base,
    fonts: {...base.fonts, display: 'serif', body: 'serif'},
    captions: {variant: 'karaoke', font: 'serif', size: 0.05, weight: 700, color: '#f3e6cf', highlight: '#d9a45b', bottom: 0.13, words: 5, uppercase: false, shadow: true},
    palette: {bg: '#17120d', bg2: '#2a2118', surface: '#221a12', text: '#f3e6cf', muted: '#b8a585', accent: '#d9a45b', line: '#f3e6cf'},
    texture: {grain: 0.09, vignette: 0.6},
  },
  /** Neon-on-midnight tech/data look: fact cards, SaaS, data stories. */
  midnight: {
    name: 'midnight', tone: 'dark', ...base,
    fonts: {...base.fonts, display: 'heavy', body: 'sans'},
    captions: {variant: 'box', font: 'sans', size: 0.045, weight: 900, color: '#f2f4ff', highlight: '#6cf2ff', bottom: 0.12, words: 5, uppercase: false, shadow: true},
    palette: {bg: '#070a1a', bg2: '#1c2350', surface: '#121733', text: '#f2f4ff', muted: '#9aa3c7', accent: '#6cf2ff', line: '#dfe5ff'},
    texture: {grain: 0.05, vignette: 0.4},
  },
  /** Warm paper with ink line-art: explainers, tutorials, light editorial. */
  paper: {
    name: 'paper', tone: 'light', ...base,
    fonts: {...base.fonts, display: 'serifDisplay', body: 'sans'},
    captions: {variant: 'minimal', font: 'sans', size: 0.04, weight: 700, color: '#24221f', highlight: '#f2b705', bottom: 0.1, words: 7, uppercase: false, shadow: false},
    palette: {bg: '#f6f0e3', bg2: '#ebe2cf', surface: '#fffdf8', text: '#24221f', muted: '#8a8274', accent: '#f2b705', line: '#24221f'},
    texture: {grain: 0.05, vignette: 0.15},
  },
  /** Broadcast / sports: condensed type, high contrast. */
  broadcast: {
    name: 'broadcast', tone: 'dark', ...base,
    fonts: {...base.fonts, display: 'condensed', body: 'condensed'},
    captions: {variant: 'box', font: 'condensed', size: 0.06, weight: 900, color: '#ffffff', highlight: '#ffd60a', bottom: 0.13, words: 4, uppercase: true, shadow: true},
    palette: {bg: '#06080d', bg2: '#141a26', surface: '#0f141e', text: '#ffffff', muted: '#9ba6b8', accent: '#ffd60a', line: '#ffffff'},
  },
};

/** Merge a preset with overrides; `accent` (e.g. the sequence/brand accent) also drives the highlight. */
export function resolveLook(look: Look | undefined, accent?: string): FullLook | null {
  if (!look) return null;
  const preset = LOOKS[look.preset ?? 'cinematic'] ?? LOOKS.cinematic;
  const palette = {...preset.palette, ...look.palette};
  if (accent && !look.palette?.accent) palette.accent = accent;
  const captions = {...preset.captions, ...look.captions};
  if (accent && !look.captions?.highlight) captions.highlight = palette.accent;
  return {
    ...preset,
    captions,
    palette,
    fonts: {...preset.fonts, ...look.fonts},
    texture: {...preset.texture, ...look.texture},
    chrome: {...preset.chrome, ...look.chrome},
  };
}

/** A look with font keys turned into CSS font stacks, as templates use them. */
export type ActiveLook = FullLook & {font: Record<keyof FullLook['fonts'], string>; captionFont: string};
function activate(look: FullLook): ActiveLook {
  const font = Object.fromEntries(Object.entries(look.fonts).map(([k, v]) => [k, fonts[v]])) as ActiveLook['font'];
  return {...look, font, captionFont: fonts[look.captions.font]};
}

/** Which look role each named font plays (see fonts.ts `setFontRoles`). */
const ROLE: Record<FontName, keyof FullLook['fonts']> = {
  sans: 'body', grotesk: 'body', serif: 'display', serifDisplay: 'display', condensed: 'display', poster: 'display', heavy: 'display', mono: 'label', hand: 'hand',
};
/** Route every named font to the look's faces for this render (null restores the originals). */
export function applyFontRoles(look: FullLook | null) {
  setFontRoles(look ? (Object.fromEntries(Object.entries(ROLE).map(([name, role]) => [name, fonts[look.fonts[role]]])) as Record<FontName, string>) : null);
}

const LookContext = React.createContext<ActiveLook | null>(null);
export const LookProvider: React.FC<{look: FullLook | null; children: React.ReactNode}> = ({look, children}) => {
  const value = React.useMemo(() => (look ? activate(look) : null), [look]);
  return <LookContext.Provider value={value}>{children}</LookContext.Provider>;
};

/**
 * The shared look, or null for a single-template render. Pattern in an entry:
 *
 *   const look = useLook();
 *   const pal = look ? {bg: look.palette.bg, text: look.palette.text, ...} : PALETTES[props.palette];
 *   const titleFont = look?.font.display ?? fonts.heavy;
 *
 * Keep your layout, motion and illustration; take colours, fonts and texture from the look.
 */
export function useLook(): ActiveLook | null {
  return React.useContext(LookContext);
}

/** Mix two hex colours (t = 0 → a, 1 → b). Handy to tint a template texture toward the look. */
export function mix(a: string, b: string, t: number): string {
  const p = (h: string) => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16));
  const [x, y] = [p(a), p(b)];
  return '#' + x.map((v, i) => Math.round(v + (y[i] - v) * t).toString(16).padStart(2, '0')).join('');
}
