import {z} from 'zod';
import {ICON_NAMES} from '@viralaunch/kit';

export const Stat = z.object({
  value: z.number().describe('The number that counts up, e.g. 800 or 4.5. Plain number, no symbols.'),
  prefix: z.string().max(4).default('').describe('Shown before the number, e.g. "$", "€", "£" or "".'),
  suffix: z.string().max(8).default('').describe('Shown after the number, e.g. "%", "/mo", "k", " yrs" or "".'),
  decimals: z.number().int().min(0).max(2).default(0).describe('Digits after the decimal point (0 for whole amounts).'),
  label: z.string().max(40).default('').describe('Small line above the number saying what it is, e.g. "goes to savings each month".'),
});

export const Chip = z.object({
  value: z.string().min(1).max(10).describe('Short figure on the glass chip, e.g. "$2,000", "50%", "3–6 mo".'),
  label: z.string().max(18).default('').describe('One or two words under the figure, e.g. "needs", "per year".'),
});

export const Step = z.object({
  label: z.string().min(1).max(24).describe('Short step name shown as "STEP 02 · LABEL", e.g. "Cover your needs".'),
  headline: z.string().min(1).max(56).describe('The instruction for this step, e.g. "Put *50%* toward needs". *Asterisks* highlight words.'),
  detail: z.string().max(110).default('').describe('One plain supporting sentence, e.g. "Rent, groceries, insurance and minimum loan payments."'),
  icon: z.enum(ICON_NAMES).default('money').describe('Line icon on this step\'s node, e.g. money, chart, bars, calendar, clock, house, cart, shield, lock, target, check.'),
  stat: Stat.optional().describe('Optional hero number for this step that counts up with a glow.'),
  chips: z.array(Chip).max(3).default([]).describe('0–3 small glass chips with supporting figures.'),
});

export const Props = z.object({
  title: z.string().min(1).max(48).describe('What the tutorial teaches, e.g. "The *50/30/20* budget". Wrap 1–2 words in *asterisks* for the accent colour.'),
  kicker: z.string().max(32).default('').describe('Small label above the title and in the top bar, e.g. "Money basics".'),
  steps: z.array(Step).min(2).max(6).describe('The method in order, 2–6 steps. Narration scene i+1 explains step i (scene 1 is the title).'),
  palette: z.enum(['neon', 'gold', 'ocean', 'ledger']).default('neon').describe('neon = black with lime glow; gold = black with warm gold; ocean = deep navy with cyan; ledger = light paper with green ink.'),
  disclaimer: z.string().max(60).default('Educational only. Not financial advice.').describe('Small line in the top bar. Keep it for anything that sounds like advice; "" hides it.'),
  showCaptions: z.boolean().default(true).describe('Word-synced captions at the bottom.'),
});

export type Props = z.infer<typeof Props>;
