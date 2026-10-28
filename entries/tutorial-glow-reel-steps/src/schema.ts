import {z} from 'zod';
import {ICON_NAMES} from '@viralaunch/kit';

export const Props = z.object({
  title: z.string().min(1).max(44).describe('What the viewer will learn, e.g. "How to build a *perfect* playlist". Wrap 1–2 words in *asterisks* to light them in the accent colour.'),
  kicker: z.string().max(28).default('').describe('Short topic label in the HUD corner and above the title, e.g. "Music basics" or "Film club".'),
  steps: z
    .array(
      z.object({
        label: z.string().min(1).max(30).describe('Short step name, typed into the terminal card and listed in the intro, e.g. "Pick an opening track".'),
        headline: z.string().min(1).max(36).describe('The instruction as a punchy headline, e.g. "Open with *energy*." *Asterisks* light 1–2 words.'),
        items: z.array(z.string().min(1).max(32)).max(3).default([]).describe('0–3 short lines that print one by one under the command, e.g. ["Mid-tempo, not a ballad", "Instantly recognisable"].'),
        icon: z.enum(ICON_NAMES).default('spark').describe('Line icon drawn inside the glowing emblem, e.g. music, camera, book, star, heart, people, calendar, clock, chat, trophy, spark.'),
      }),
    )
    .min(1)
    .max(6)
    .describe('The how-to in order, 2–6 steps. Narration: scene 1 is the title, then one scene per step, then an optional finale scene.'),
  finale: z.string().max(40).default('').describe('Closing line shown in a last narration scene after the steps, e.g. "Now press *play*." "" = no finale card.'),
  palette: z.enum(['electric', 'violet', 'night']).default('electric').describe('electric = vivid cobalt blue with ice-cyan accent; violet = ultraviolet purple with pink accent; night = deep teal-black with mint accent.'),
  showCaptions: z.boolean().default(true).describe('Word-synced captions at the bottom.'),
});

export type Props = z.infer<typeof Props>;
