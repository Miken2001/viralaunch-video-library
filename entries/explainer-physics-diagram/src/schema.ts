import {z} from 'zod';
import {ICON_NAMES} from '@viralaunch/kit';

const Stage = z.object({
  name: z.string().min(1).max(18).describe('Short stage name shown on the diagram module and the bottom stepper, e.g. "Storyboard", "Recording", "Mixing".'),
  icon: z.enum(ICON_NAMES).default('spark').describe('Line icon drawn inside the module (camera, music, book, chat, people, star, trophy, chip, gear, bulb, calendar, ...).'),
  tag: z.string().max(24).default('').describe('Optional small mono line under the stage name, e.g. "months 1-6" or "story team".'),
});

const Stat = z.object({
  value: z.number().describe('The number that counts up, e.g. 24. Real and checkable only.'),
  decimals: z.number().int().min(0).max(2).default(0).describe('Decimal places shown for the value.'),
  unit: z.string().max(10).default('').describe('Short unit after the number, e.g. "fps", "%", "min".'),
  label: z.string().min(1).max(48).describe('What the number means, e.g. "frames in every second of film".'),
});

const Step = z.object({
  stage: z.number().int().min(1).max(6).optional().describe('Which stage (1-based, in `stages` order) this step is about. Leave out to use the step order.'),
  heading: z.string().min(1).max(56).describe('Headline of this step, e.g. "Every shot starts as a *sketch*". *Asterisks* colour a word.'),
  points: z.array(z.string().min(1).max(72)).min(1).max(3).describe('1-3 short bullet lines, in the order the narration says them.'),
  stat: Stat.optional().describe('Optional key number for this step, shown as a counter card under the bullets.'),
});

export const Props = z.object({
  kicker: z.string().max(40).default('').describe('Small series label above the title, e.g. "How it\'s made · Animation".'),
  title: z.string().min(1).max(60).describe('Title of the explainer, e.g. "How an *animated film* is made".'),
  subtitle: z.string().max(80).default('').describe('Optional one line under the title.'),
  stages: z.array(Stage).min(2).max(6).describe('2-6 stages of the process, left to right. They form the diagram pipeline and the bottom stepper.'),
  steps: z.array(Step).min(1).max(8).describe('1-8 steps, one per narration line (an extra first narration line becomes the title card).'),
  flowLabel: z.string().max(18).default('').describe('Optional name of what flows through the pipeline, shown on the moving packets, e.g. "Shots", "Tracks", "Scenes".'),
  palette: z.enum(['midnight', 'graphite', 'studio']).default('midnight').describe('midnight = deep navy with electric blue (the classic schematic look), graphite = near-black with orange, studio = light grey with blue.'),
  showCaptions: z.boolean().default(true).describe('Word-synced subtitles at the bottom.'),
});

export type Props = z.infer<typeof Props>;
export type Stage = z.infer<typeof Stage>;
export type Step = z.infer<typeof Step>;
