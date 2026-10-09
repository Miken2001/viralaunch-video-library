import {z} from 'zod';
import {ICON_NAMES} from '@viralaunch/kit';

export const Story = z.object({
  /** The story's name or headline, short: "Halo 2 launches on Xbox". */
  headline: z.string().min(2).max(48).describe('Headline of this story, at most ~7 words (a title, product or event name works).'),
  /** Category chip: the beat this story belongs to. */
  category: z.string().min(2).max(18).describe('Short category chip, e.g. "FILM", "PC GAME", "STREAMING", "HARDWARE".'),
  /** Date chip, written as it should appear. */
  date: z.string().max(20).default('').describe('Release or event date as display text, e.g. "Nov 9, 2004". Empty to hide.'),
  /** The one-line takeaway: why this story matters. */
  takeaway: z.string().min(5).max(100).describe('One sentence: the single thing to remember about this story.'),
  /** Up to three short supporting points, revealed one by one. */
  points: z.array(z.string().min(2).max(56)).max(3).default([]).describe('0-3 short supporting facts, each under 9 words.'),
  /** Line icon drawn in the side panel when the story's scene has no image. */
  icon: z.enum(ICON_NAMES).default('spark').describe('Icon for the side panel (used when the scene has no image).'),
  /** Optional hero number that counts up in the side panel. */
  figure: z
    .object({
      value: z.number().describe('The number, e.g. 125.'),
      prefix: z.string().max(3).default('').describe('Shown before the number, e.g. "$".'),
      unit: z.string().max(8).default('').describe('Shown after the number, e.g. "M" or "%".'),
      decimals: z.number().int().min(0).max(2).default(0),
      label: z.string().max(40).default('').describe('What the number measures, e.g. "first-day sales".'),
    })
    .optional()
    .describe('Optional key number for the story. Only real, checkable numbers.'),
  /** Attribution line at the foot of the card. */
  source: z.string().max(60).default('').describe('Where the facts come from, e.g. "Source: Nintendo". Empty to hide.'),
});

export const Props = z.object({
  /** Roundup title on the intro and in the header bar. */
  title: z.string().min(2).max(40).describe('Roundup title, e.g. "This week in film" (at most ~6 words).'),
  /** The period the roundup covers. */
  period: z.string().max(28).default('').describe('Period covered, e.g. "Sep 25-26" or "November 2004". Empty to hide.'),
  /** One card per story, in the order the narration covers them. */
  stories: z.array(Story).min(2).max(8).describe('2-8 stories. Narration: an optional intro scene, then one scene per story.'),
  palette: z.enum(['midnight', 'graphite', 'violet', 'paper']).default('midnight').describe('Colour scheme: midnight (navy/cyan), graphite (black/orange), violet (purple/lime) or paper (light).'),
  showCaptions: z.boolean().default(true).describe('Word-synced captions under the cards.'),
});

export type Props = z.infer<typeof Props>;
export type Story = z.infer<typeof Story>;
