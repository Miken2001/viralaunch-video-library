import {z} from 'zod';

/** How a level is drawn. Pick the view that matches the scale of that level. */
export const VIEWS = ['surface', 'planet', 'orbit', 'system', 'stars', 'galaxy', 'group', 'web'] as const;

export const Level = z.object({
  /** Short name of this scale, e.g. "The inner Solar System". */
  name: z.string().min(1).max(32).describe('Short name of this scale level, e.g. "The Milky Way".'),
  /** The size readout, e.g. "about 100,000 light-years across". */
  span: z.string().max(40).default('').describe('Size or distance readout, e.g. "about 100,000 light-years across".'),
  /** One extra line, e.g. "Sunlight takes 8 minutes to reach us". */
  note: z.string().max(70).default('').describe('One extra fact line shown under the readout. May be empty.'),
  /**
   * The drawing for this level: surface (land and sea seen from above), planet (a globe),
   * orbit (a body with a moon on its orbit), system (a star with planet orbits), stars (a star
   * chart of the neighbourhood), galaxy (a spiral galaxy), group (a cluster of galaxies),
   * web (the cosmic web up to the edge of the observable universe).
   */
  view: z.enum(VIEWS).describe('Drawing for this level: surface, planet, orbit, system, stars, galaxy, group or web.'),
  /** Up to 4 names to pin on the drawing (moons, planets, nearby stars, neighbour galaxies). */
  labels: z.array(z.string().min(1).max(22)).max(4).default([]).describe('Up to 4 names pinned on the drawing, e.g. ["Andromeda", "Triangulum"].'),
});
export type Level = z.infer<typeof Level>;

export const Props = z.object({
  /** Opening line shown over the first level, e.g. "From one beach to the edge of *everything*". */
  title: z.string().min(1).max(70).describe('Opening line over the first level. Wrap one word in *asterisks* to highlight it.'),
  /** Label of the marker that always points at the starting place. */
  homeLabel: z.string().max(24).default('You are here').describe('Label of the marker that keeps pointing at the starting place.'),
  /** 3–8 levels from the smallest scale to the largest; the camera pulls back through them in order. */
  levels: z.array(Level).min(3).max(8).describe('3 to 8 scale levels, smallest first. One narration scene per level.'),
  /** Colour scheme of the film. */
  palette: z.enum(['deep', 'aurora', 'ember', 'mono']).default('deep').describe('deep (blue), aurora (green), ember (warm) or mono (black and white).'),
  /** Log-scale ruler along the bottom that tracks the zoom. */
  showRuler: z.boolean().default(true).describe('Show the scale ruler along the bottom.'),
  /** Word captions of the narration. */
  showCaptions: z.boolean().default(true).describe('Show narration as word captions.'),
});

export type Props = z.infer<typeof Props>;
