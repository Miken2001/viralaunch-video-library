import {z} from 'zod';
import {ICON_NAMES} from '@viralaunch/kit';

export const Chapter = z.object({
  when: z.string().min(1).max(16).describe('When this era or moment happened, as shown on screen: "1977", "1950s", "1890–1920".'),
  title: z.string().min(1).max(32).describe('Name of the era or moment in a few words: "Rock and roll", "The silent era", "Star Wars".'),
  detail: z.string().max(110).default('').describe('One short plain sentence about it. Can be empty.'),
  seal: z.string().max(10).default('').describe('One or two short words stamped on the red seal: "BIRTH", "BOOM", "SOUND". Empty = the chapter number.'),
  icon: z.enum(ICON_NAMES).default('star').describe('Line drawing for the ink chapters: music, camera, book, star, trophy, heart, people, chat, building, globe, spark, fire, wave, mountain...'),
});

export const Props = z.object({
  title: z.string().min(1).max(44).describe('Opening title in gold, e.g. "A century of *cinema*". Wrap one word in *asterisks* to colour it.'),
  subtitle: z.string().max(60).default('').describe('Small line under the title, e.g. "From silent film to streaming". Can be empty.'),
  chapters: z.array(Chapter).min(3).max(8).describe('3–8 eras or moments in chronological order, oldest first. Each gets its own chapter scene and a tick on the timeline ruler.'),
  styleMode: z
    .enum(['alternate', 'gold', 'ink'])
    .default('alternate')
    .describe('alternate = chapters switch between gold-on-black title plates and ink drawings on paper; gold = every chapter gold-on-black; ink = every chapter ink on paper.'),
  sealColor: z.enum(['vermilion', 'jade', 'indigo']).default('vermilion').describe('Colour of the stamped seal and the timeline playhead.'),
  showCaptions: z.boolean().default(true).describe('Show word-synced narration captions.'),
});

export type Props = z.infer<typeof Props>;
export type Chapter = z.infer<typeof Chapter>;
