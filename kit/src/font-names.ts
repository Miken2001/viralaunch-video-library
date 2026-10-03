/**
 * Bundled font family names (pure data, no CSS), plus the role remapping used by shared looks.
 * fonts.ts registers the @font-face rules and re-exports these.
 */
const stack = (family: string, fallback: string) => `"${family}", ${fallback}`;

export const baseFonts = {
  /** Neutral UI / body. */
  sans: stack('Inter', 'system-ui, sans-serif'),
  /** Geometric grotesk for tech and editorial labels. */
  grotesk: stack('Space Grotesk', '"Inter", sans-serif'),
  /** Editorial serif for documentary, quotes, luxury. */
  serif: stack('Playfair Display', 'Georgia, serif'),
  /** High-contrast display serif for titles. */
  serifDisplay: stack('DM Serif Display', 'Georgia, serif'),
  /** Condensed sports/broadcast. */
  condensed: stack('Barlow Condensed', '"Arial Narrow", sans-serif'),
  /** All-caps poster headlines. */
  poster: stack('Bebas Neue', 'Impact, sans-serif'),
  /** Heavy display for punchy kinetic type. */
  heavy: stack('Archivo Black', 'Impact, sans-serif'),
  /** Monospace for terminals, HUD labels, data. */
  mono: stack('JetBrains Mono', 'ui-monospace, monospace'),
  /** Handwritten annotations. */
  hand: stack('Caveat', 'cursive'),
} as const;

export type FontName = keyof typeof baseFonts;
let roles: Partial<Record<FontName, string>> | null = null;
/**
 * In a multi-template sequence every segment must share typography, so the shared look remaps
 * the named fonts by role (titles → the look's display face, body → its body face, labels →
 * its label face). Each render renders one composition with one look, so this is set once per
 * render by root.tsx before anything draws. Entries keep writing `fonts.heavy`, `fonts.sans`...
 */
export function setFontRoles(map: Partial<Record<FontName, string>> | null) {
  roles = map;
}
export const fonts: Readonly<Record<FontName, string>> = new Proxy(baseFonts, {
  get: (target, key: string) => (roles && key in roles ? roles[key as FontName] : target[key as FontName]),
}) as Readonly<Record<FontName, string>>;

