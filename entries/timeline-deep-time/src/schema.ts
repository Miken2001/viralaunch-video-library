import {z} from 'zod';
import {ICON_NAMES} from '@viralaunch/kit';

export const Era = z.object({
  kicker: z.string().max(32).default('').describe('Small label above the name: the larger period or group, e.g. "Mesozoic Era", "Imperial China". Can be empty.'),
  name: z.string().min(1).max(28).describe('Name of the era, epoch, period or dynasty, e.g. "Jurassic", "Tang dynasty".'),
  from: z.number().describe('When the era starts. In "years-ago" axis: years before present (201000000). In "calendar" axis: calendar year, negative for BC (618).'),
  to: z.number().describe('When the era ends, same unit as `from` (0 = today in "years-ago" axis).'),
  span: z.string().min(1).max(40).describe('Readable date range shown under the name, e.g. "201–145 million years ago", "618–907 AD".'),
  points: z.array(z.string().min(1).max(80)).min(1).max(3).describe('1–3 short facts about the era, revealed one by one as the narration goes.'),
  visual: z.enum(['globe', 'strata', 'terrain', 'icon']).default('icon').describe('Illustration: globe = planet with drifting continents, strata = rock layers with this era highlighted, terrain = landscape cross-section with a water level, icon = a large drawn line icon.'),
  icon: z.enum(ICON_NAMES).default('star').describe('Line icon used when visual is "icon" (e.g. building, flag, book, fire, leaf, mountain).'),
});

export const Props = z.object({
  title: z.string().min(1).max(60).describe('Opening title, e.g. "From the dinosaurs to the first farmers". Wrap one word in *asterisks* to colour it.'),
  axis: z.enum(['years-ago', 'calendar']).default('years-ago').describe('years-ago = deep time (geology, prehistory) on a logarithmic ruler; calendar = dated history (dynasties, empires) on a linear ruler.'),
  eras: z.array(Era).min(2).max(10).describe('2–10 eras in chronological order, oldest first.'),
  palette: z.enum(['earth', 'abyss', 'parchment']).default('earth').describe('earth = warm dark brown, abyss = deep teal night, parchment = light paper.'),
  showCaptions: z.boolean().default(true).describe('Show word-synced narration captions.'),
});

export type Props = z.infer<typeof Props>;
export type Era = z.infer<typeof Era>;
