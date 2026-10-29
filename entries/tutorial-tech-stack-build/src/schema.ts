import {z} from 'zod';
import {ICON_NAMES} from '@viralaunch/kit';

export const Step = z.object({
  label: z.string().min(1).max(12).describe('Layer name, 1-2 words, max 12 characters, e.g. "Database". Shown on the stack tag and the progress rail.'),
  title: z.string().min(3).max(40).describe('The instruction, max 40 characters. Wrap 1-2 words in *asterisks* for the accent colour, e.g. "Add a *database*".'),
  detail: z.string().max(110).default('').describe('One plain sentence on what this step does or why, max 110 characters. "" for none.'),
  code: z.string().max(40).default('').describe('Optional command or one line of code typed into a terminal chip, max 40 characters, e.g. "npm install express". "" for none.'),
  icon: z.enum(ICON_NAMES).default('code').describe('Line icon on the layer tag: code, chip, gear, lock, shield, globe, rocket, cloud, chart, search, bars, check.'),
});

export const Props = z.object({
  title: z.string().min(1).max(48).describe('What the viewer builds, max 48 characters. Wrap ONE word in *asterisks* for the accent, e.g. "Build your first *Node.js* API".'),
  command: z.string().max(44).default('').describe('Command typed in the intro terminal, max 44 characters, e.g. "mkdir hello-api". "" shows the title only.'),
  steps: z.array(Step).min(2).max(6).describe('2-6 steps in order. Each step adds one layer to the 3D stack.'),
  outro: z.string().max(40).default('').describe('Closing line on the recap scene, max 40 characters, with one *accent* word. "" reuses the title.'),
  palette: z.enum(['slate', 'midnight', 'paper']).default('slate').describe('slate = graphite studio with orange accent, midnight = deep navy with cyan, paper = light cream with red-orange.'),
  showCaptions: z.boolean().default(true).describe('Word-synced captions near the bottom.'),
});

export type Props = z.infer<typeof Props>;
