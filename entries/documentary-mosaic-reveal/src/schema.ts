import {z} from 'zod';

export const MOTIFS = ['sun', 'moon', 'star', 'tree', 'bird', 'fish', 'waves', 'halo', 'eye', 'lotus', 'rosette'] as const;

export const Panel = z.object({
  /** Title of the artwork-like panel, as on a museum label, e.g. "The Dove". */
  label: z.string().min(1).max(48).describe('Museum-label title of this scene, 1-6 words.'),
  /** Small line under the label: origin, date, place or meaning, e.g. "Ravenna, 5th century". */
  note: z.string().max(60).default('').describe('One short line under the label: place, date or meaning.'),
  /** What the tiles draw when the scene has no image. */
  motif: z.enum(MOTIFS).default('star').describe('Drawn mosaic for scenes without an image: sun, moon, star, tree, bird, fish, waves, halo (figure with a halo), eye, lotus or rosette.'),
});

export const Props = z.object({
  /** Gallery title shown small at the top for the whole film, e.g. "Symbols of the Sea". */
  title: z.string().max(60).default('').describe('Gallery title shown at the top, a few words. Empty to hide.'),
  /** One museum label per narration scene, in order. */
  panels: z.array(Panel).min(1).max(60).describe('One {label, note, motif} per narration scene, in order.'),
  /** Colour family of the tiles, wall and frame. */
  palette: z.enum(['byzantine', 'lapis', 'roman', 'cathedral']).default('byzantine').describe('byzantine (gold ground, lapis, red), lapis (night blue with gold stars), roman (marble, terracotta, black) or cathedral (stained glass jewel tones).'),
  /** Size of the tesserae: more tiles look finer, fewer look bolder. */
  tiles: z.enum(['fine', 'medium', 'bold']).default('medium').describe('Tile size: fine (detailed), medium or bold (big chunky tiles).'),
  /** How the tiles fly in to build each scene. */
  assembly: z.enum(['mixed', 'swirl', 'sweep', 'rise', 'scatter']).default('mixed').describe('How tiles arrive: swirl (spiral in), sweep (stream from a corner), rise (from below), scatter (settle from everywhere) or mixed (changes every scene).'),
  /** Show narration as word captions on the museum label. */
  showCaptions: z.boolean().default(true).describe('Show word captions of the narration.'),
});

export type Props = z.infer<typeof Props>;
export type Motif = (typeof MOTIFS)[number];
