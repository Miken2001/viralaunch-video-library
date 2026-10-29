import {z} from 'zod';
import {ICON_NAMES} from '@viralaunch/kit';

export const Milestone = z.object({
  year: z.string().min(1).max(12).describe('When it happened, as shown on screen: "1969", "1940s", "3000 BC". Plain 3–4 digit years count up from the previous one.'),
  title: z.string().min(1).max(36).describe('What appeared, in a few words: "First web page", "The transistor", "ARPANET".'),
  detail: z.string().max(100).default('').describe('One short plain sentence explaining it. Can be empty.'),
  icon: z.enum(ICON_NAMES).default('spark').describe('Doodle drawn on the milestone: chip, code, phone, globe, mail, rocket, bulb, brain, gear, book, camera, music, chat, lock, chart, atom, spark...'),
});

export const Props = z.object({
  title: z.string().min(1).max(48).describe('Opening title written over the night sky, e.g. "How computers *learned* to talk". Wrap one word in *asterisks* to colour it.'),
  subtitle: z.string().max(60).default('').describe('Small line under the title, e.g. "A short history of the internet". Can be empty.'),
  milestones: z.array(Milestone).min(3).max(9).describe('3–9 milestones in chronological order, oldest first. The traveller walks from one to the next and each one grows out of the hills.'),
  finale: z
    .enum(['hatch', 'glow', 'none'])
    .default('hatch')
    .describe('How the LAST milestone arrives: hatch = an egg wobbles, cracks and hatches its doodle in a burst of light (a new era, a breakthrough); glow = it lights up the whole sky; none = like the others.'),
  palette: z.enum(['night', 'dusk', 'paper']).default('night').describe('night = starry blue storybook night, dusk = violet evening with warm glow, paper = light sketchbook paper with ink lines.'),
  showCaptions: z.boolean().default(true).describe('Show word-synced narration captions.'),
});

export type Props = z.infer<typeof Props>;
export type Milestone = z.infer<typeof Milestone>;
