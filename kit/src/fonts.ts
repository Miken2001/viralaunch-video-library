/**
 * Bundled, OFL-licensed fonts (via @fontsource). Importing this module registers the
 * @font-face rules; `registerEntry` waits for every family before the first frame renders,
 * so no frame ever shows a fallback font. Entries use the `fonts` names, never raw strings.
 */
import '@fontsource/inter/latin-400.css';
import '@fontsource/inter/latin-500.css';
import '@fontsource/inter/latin-700.css';
import '@fontsource/inter/latin-900.css';
import '@fontsource/space-grotesk/latin-400.css';
import '@fontsource/space-grotesk/latin-700.css';
import '@fontsource/playfair-display/latin-400.css';
import '@fontsource/playfair-display/latin-400-italic.css';
import '@fontsource/playfair-display/latin-700.css';
import '@fontsource/playfair-display/latin-900.css';
import '@fontsource/dm-serif-display/latin-400.css';
import '@fontsource/dm-serif-display/latin-400-italic.css';
import '@fontsource/barlow-condensed/latin-500.css';
import '@fontsource/barlow-condensed/latin-700.css';
import '@fontsource/barlow-condensed/latin-900.css';
import '@fontsource/bebas-neue/latin-400.css';
import '@fontsource/archivo-black/latin-400.css';
import '@fontsource/jetbrains-mono/latin-400.css';
import '@fontsource/jetbrains-mono/latin-700.css';
import '@fontsource/caveat/latin-700.css';

const stack = (family: string, fallback: string) => `"${family}", ${fallback}`;

export const fonts = {
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

/** Families + weights to await before rendering (see root.tsx). */
export const fontFaces = [
  '400 40px "Inter"', '700 40px "Inter"', '900 40px "Inter"', '500 40px "Inter"',
  '400 40px "Space Grotesk"', '700 40px "Space Grotesk"',
  '400 40px "Playfair Display"', 'italic 400 40px "Playfair Display"', '700 40px "Playfair Display"', '900 40px "Playfair Display"',
  '400 40px "DM Serif Display"', 'italic 400 40px "DM Serif Display"',
  '500 40px "Barlow Condensed"', '700 40px "Barlow Condensed"', '900 40px "Barlow Condensed"',
  '400 40px "Bebas Neue"', '400 40px "Archivo Black"',
  '400 40px "JetBrains Mono"', '700 40px "JetBrains Mono"', '700 40px "Caveat"',
];
