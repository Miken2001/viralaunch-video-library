import {z} from 'zod';
import {ICON_NAMES} from '@viralaunch/kit';

export const Beat = z.object({
  /** Short marker for this moment on the time axis: a year, a date or a step, e.g. "1971". */
  label: z.string().min(1).max(10).describe('Short time marker shown on the chart axis, e.g. "1971" or "Day 3". Max 10 characters.'),
  /** What happened, in ≤ 9 words. Wrap one word in *asterisks* to colour it. */
  headline: z.string().min(3).max(70).describe('What happened at this moment, in at most 9 words. Wrap one key word in *asterisks* to highlight it.'),
  /** The value of the tracked number at this moment. The line moves here when the beat starts. */
  value: z.number().describe('The tracked number at this moment (a price, a balance, an index). Real data only.'),
  /** Optional short tag pinned to the point on the chart, e.g. "Record high". */
  note: z.string().max(28).default('').describe('Optional tag pinned to this point on the chart, e.g. "Record high". Max 28 characters.'),
  icon: z.enum(ICON_NAMES).default('money').describe('Line icon drawn for this beat, e.g. money, chart, building, fire, globe, clock, lock, shield.'),
});

export const Props = z.object({
  /** The story in a few words, e.g. "Gold after the dollar". Shown as the opening title and header. */
  title: z.string().min(1).max(60).describe('The money story in a few words, e.g. "Gold after the dollar left it". Opening title and header.'),
  /** What the line measures and how its numbers are written. */
  metric: z
    .object({
      label: z.string().max(40).default('').describe('What the line measures, e.g. "Gold, US$ per troy ounce".'),
      prefix: z.string().max(4).default('').describe('Written before every number, e.g. "$".'),
      suffix: z.string().max(6).default('').describe('Written after every number, e.g. "%" or " bn".'),
      decimals: z.number().int().min(0).max(2).default(0).describe('Decimal places for every number.'),
    })
    .prefault({})
    .describe('What the value line measures and how its numbers are formatted.'),
  /**
   * The story beats in time order, one per narration scene. If there is one more scene than
   * beats, scene 0 is the opening title.
   */
  beats: z.array(Beat).min(2).max(7).describe('2-7 story beats in time order, one per narration scene. One extra first scene becomes the title card.'),
  /** One closing sentence that lands on the last beat, e.g. "Same ounce, 59 times the price." */
  takeaway: z.string().max(70).default('').describe('One closing sentence shown over the last beat. Leave empty for none.'),
  /** Where the numbers come from, e.g. "LBMA gold price". */
  source: z.string().max(60).default('').describe('Where the numbers come from, shown small under the chart.'),
  palette: z.enum(['amber', 'ledger', 'mint', 'midnight']).default('amber').describe('amber = warm black and gold, ledger = light paper and green ink, mint = dark green terminal, midnight = deep blue and cyan.'),
  showCaptions: z.boolean().default(true).describe('Show the narration as word captions at the bottom.'),
});

export type Props = z.infer<typeof Props>;
