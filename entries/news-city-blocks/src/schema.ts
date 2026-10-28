import {z} from 'zod';
import {ICON_NAMES} from '@viralaunch/kit';

export const Story = z.object({
  /** The place the story happens: shown on the pin above its tower. */
  place: z.string().min(2).max(28).describe('Where it happened, short: a city, country or region, e.g. "Astana, Kazakhstan".'),
  /** Region chip on the card. */
  region: z.string().min(2).max(18).describe('Short region or beat chip, e.g. "CENTRAL ASIA", "EUROPE", "BORDERS".'),
  /** The headline: what happened there. */
  headline: z.string().min(4).max(60).describe('Headline, at most ~8 words, e.g. "Kazakhstan renames its capital back to Astana".'),
  /** One supporting line. */
  detail: z.string().max(110).default('').describe('One short sentence of context (under 18 words). Empty to hide.'),
  /** Line icon drawn in the pin. */
  icon: z.enum(ICON_NAMES).default('pin').describe('Icon in the place pin: pin, flag, building, map, globe, mountain, wave, car...'),
  /** Optional key number that counts up on the card. */
  figure: z
    .object({
      value: z.number().describe('The number, e.g. 55.'),
      unit: z.string().max(10).default('').describe('Shown after the number, e.g. "km", "%", "years".'),
      decimals: z.number().int().min(0).max(2).default(0),
      label: z.string().max(40).default('').describe('What the number measures, e.g. "years after independence".'),
    })
    .optional()
    .describe('Optional real, checkable number for this story. Leave out rather than guess.'),
});

export const Props = z.object({
  /** Title on the opening overview of the city. */
  title: z.string().min(2).max(44).describe('Recap title, at most ~6 words, e.g. "The year the map changed".'),
  /** Edition line in the ticker and on the opening. */
  edition: z.string().max(32).default('').describe('Edition or period, e.g. "World desk · 2022". Empty to hide.'),
  /** One tower per story, in narration order. */
  stories: z.array(Story).min(2).max(6).describe('2-6 stories. Narration: an optional intro scene, then one scene per story.'),
  /** Time of day of the city (colour scheme). */
  timeOfDay: z.enum(['day', 'dusk', 'night']).default('night').describe('City lighting: day (light), dusk (violet/orange) or night (navy, lit windows).'),
  showCaptions: z.boolean().default(true).describe('Word-synced captions at the bottom.'),
});

export type Props = z.infer<typeof Props>;
export type Story = z.infer<typeof Story>;
