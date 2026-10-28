import {z} from 'zod';

export const Phase = z.enum(['new', 'waxing-crescent', 'first-quarter', 'waxing-gibbous', 'full', 'waning-gibbous', 'last-quarter', 'waning-crescent', 'eclipse']);

export const Chapter = z.object({
  heading: z.string().min(1).max(26).describe('Short chapter heading, set vertically beside the sky like a scroll inscription, e.g. "The Giant Impact", "Apollo 11", "Tidal Lock".'),
  phase: Phase.default('full').describe('How the sky body looks in this chapter. For the moon: new, waxing-crescent, first-quarter, waxing-gibbous, full, waning-gibbous, last-quarter, waning-crescent, or eclipse (a red, eclipsed full moon). For the sun only "eclipse" changes it (a total solar eclipse).'),
  stat: z
    .object({
      value: z.number().describe('The number that counts up, e.g. 384400. Put years in the label or heading, not here.'),
      unit: z.string().max(14).default('').describe('Short unit after the number, e.g. "km", "days", "%".'),
      label: z.string().max(32).default('').describe('Small line under the number, e.g. "average distance from Earth".'),
      decimals: z.number().int().min(0).max(2).default(0),
    })
    .nullable()
    .default(null)
    .describe('Optional figure shown inside a brush-drawn ink circle. null for none. When the scene has an image, the image fills the circle instead and the figure sits under it.'),
});

export const Props = z.object({
  title: z.string().min(1).max(40).describe('Opening title written over the moonrise, e.g. "Our Moon", "Why the Moon Has Phases".'),
  subtitle: z.string().max(60).default('').describe('Small italic line under the title, e.g. "4.5 billion years beside the Earth". Can be empty.'),
  chapters: z.array(Chapter).min(1).max(12).describe('One chapter per narration scene, in order. The first chapter shows after the title card.'),
  orb: z.enum(['moon', 'sun', 'ringed-planet']).default('moon').describe('The body hanging in the painted sky: moon (phases work), sun (glowing disc; "eclipse" = total eclipse), ringed-planet (a banded planet with rings, like Saturn; phases shade it).'),
  scenery: z.enum(['mountains', 'sea', 'hills']).default('mountains').describe('The ink landscape under the sky: mountains = layered peaks over a still lake; sea = far islands over open water; hills = low rolling hills and a lake.'),
  palette: z.enum(['rice-paper', 'indigo-night', 'ember-dusk']).default('rice-paper').describe('rice-paper = warm paper with black ink and a red seal (light); indigo-night = blue-black night with stars and gold; ember-dusk = dark plum dusk with amber light.'),
  showCaptions: z.boolean().default(true).describe('Show word-synced narration captions.'),
});

export type Props = z.infer<typeof Props>;
export type Chapter = z.infer<typeof Chapter>;
