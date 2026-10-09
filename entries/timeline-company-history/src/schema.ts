import {z} from 'zod';
import {ICON_NAMES} from '@viralaunch/kit';

export const Stat = z.object({
  value: z.number().describe('The number that counts up, e.g. 118.69 or 1000000.'),
  decimals: z.number().int().min(0).max(2).default(0).describe('Decimals shown while counting (0–2).'),
  prefix: z.string().max(3).default('').describe('Text before the number, e.g. "$". Usually empty.'),
  unit: z.string().max(14).default('').describe('Text after the number, e.g. "M", "bn", "%", "stores".'),
  label: z.string().max(60).default('').describe('What the number measures, e.g. "units sold worldwide".'),
});

export const Milestone = z.object({
  year: z.number().int().describe('Year of the milestone, e.g. 1998. The year badge rolls to it and the rail travels to it.'),
  date: z.string().max(24).default('').describe('Exact date shown on the date chip, e.g. "September 4, 1998". Leave empty to show just the year.'),
  tag: z.string().min(1).max(18).describe('One or two words saying what happened: "Founded", "Launched", "Acquired", "IPO", "Renamed", "Record".'),
  headline: z.string().min(1).max(40).describe('Short title of the milestone, usually a name: "Google Inc.", "The iPhone", "Alphabet".'),
  detail: z.string().max(110).default('').describe('One plain sentence explaining the milestone.'),
  card: z
    .enum(['document', 'product', 'stat', 'branch'])
    .default('document')
    .describe('How the milestone is shown: document = founding certificate / press-release paper; product = spotlit product shot or logo (uses the image of the narration scene playing at that moment, else the icon); stat = big growth number from `stat`; branch = parent box splitting into `branches` (mergers, spin-offs, new parent company).'),
  stat: Stat.optional().describe('Required when card is "stat". Ignored otherwise.'),
  branches: z.array(z.string().min(1).max(22)).max(3).default([]).describe('2–3 names under the headline when card is "branch", e.g. ["Google", "Other Bets"].'),
  stamp: z.string().max(14).default('').describe('Optional rubber stamp slammed on the card, e.g. "PUBLIC", "SOLD OUT", "ANTITRUST". Usually empty.'),
  icon: z.enum(ICON_NAMES).default('building').describe('Line icon used on document seals and for product cards with no image (e.g. building, rocket, phone, chip, cart, money).'),
});

export const Props = z.object({
  company: z.string().min(1).max(24).describe('Company or product name shown in the year badge, e.g. "Nintendo".'),
  title: z.string().min(1).max(60).describe('Opening title, e.g. "From playing cards to *Switch*". Wrap one word in *asterisks* to colour it.'),
  milestones: z.array(Milestone).min(3).max(10).describe('3–10 milestones in chronological order, oldest first.'),
  palette: z.enum(['studio', 'boardroom', 'heritage']).default('studio').describe('studio = clean light grey with soft colour, boardroom = deep navy night, heritage = warm paper and ink.'),
  showCaptions: z.boolean().default(true).describe('Show word-synced narration captions.'),
});

export type Props = z.infer<typeof Props>;
export type Milestone = z.infer<typeof Milestone>;
