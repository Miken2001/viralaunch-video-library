import {z} from 'zod';

export const KINDS = ['film', 'series', 'music', 'game', 'book', 'art', 'podcast', 'event'] as const;

export const Item = z.object({
  title: z.string().min(1).max(40).describe('Name of the work or event, e.g. "The Great Wave off Kanagawa", "Tetris".'),
  kind: z.enum(KINDS).default('film').describe('What it is. Sets the card art, the icon and the type face of the big word: film, series, music, game, book, art, podcast, event.'),
  word: z.string().min(1).max(14).describe('One big word stamped across the card art, e.g. "Wave", "Ode", "Drop". One word, ≤ 12 letters.'),
  meta: z.string().max(28).default('').describe('Short fact line under the title: year and maker, or date and venue, e.g. "1984 · Alexey Pajitnov".'),
  status: z.string().max(16).default('').describe('Optional status chip on the card ("Now showing", "New season"). Empty = the kind name.'),
});

export const Props = z.object({
  brandName: z.string().min(1).max(20).describe('The channel, platform, festival or show presenting the mix. Printed on every card and on the closing pill.'),
  title: z.string().min(2).max(48).describe('Opening hook over the fan of cards, ≤ 7 words. Wrap one word in *asterisks* to colour it.'),
  items: z.array(Item).min(2).max(8).describe('The works in the reel, one per narration scene, in the order they are shown. Mix the kinds.'),
  closer: z.string().max(48).default('').describe('Headline over the closing wall of all cards, ≤ 7 words, one *accent* word. Empty = the title.'),
  tagline: z.string().max(36).default('').describe('Text inside the closing pill, e.g. "New picks every Friday". Empty = the brand name.'),
  palette: z.enum(['lagoon', 'noir', 'coral', 'violet']).default('lagoon').describe('lagoon = teal glass, noir = black with cyan orbs, coral = warm red-orange, violet = purple night.'),
  showCaptions: z.boolean().default(true).describe('Word-synced captions under the cards.'),
});

export type Props = z.infer<typeof Props>;
export type Item = z.infer<typeof Item>;
export type Kind = (typeof KINDS)[number];
