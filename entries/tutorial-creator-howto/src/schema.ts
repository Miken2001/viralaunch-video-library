import {z} from 'zod';
import {ICON_NAMES} from '@viralaunch/kit';

export const Props = z.object({
  title: z.string().min(1).max(48).describe('What the viewer will learn, e.g. "How to care for your *vinyl*." Wrap 1–2 words in *asterisks*: they turn italic, accent-coloured and get a hand-drawn underline.'),
  kicker: z.string().max(32).default('').describe('Small label in the top bar and above the title, e.g. "Record care" or "Film club basics".'),
  steps: z
    .array(
      z.object({
        label: z.string().min(1).max(28).describe('Short name of the step, shown on the card header and in the intro list, e.g. "Store them upright".'),
        headline: z.string().min(1).max(44).describe('The instruction as a headline, e.g. "Keep them *standing*." *Asterisks* highlight 1–2 words.'),
        items: z.array(z.string().min(1).max(34)).max(4).default([]).describe('0–4 short checklist lines that tick off one by one, e.g. ["Shelf deep enough", "No leaning stacks"].'),
        tip: z.string().max(90).default('').describe('One plain tip shown in a chat-style bubble, e.g. "Records stored flat warp under their own weight."'),
        action: z.string().max(20).default('').describe('Label of the button a cursor taps at the end of the step, e.g. "Shelved", "Done", "Saved". "" = no button.'),
        icon: z.enum(ICON_NAMES).default('check').describe('Line icon for the step, e.g. music, camera, book, star, heart, clock, check, spark, calendar, people.'),
      }),
    )
    .min(1)
    .max(6)
    .describe('The how-to in order, 2–6 steps. Narration: scene 1 is the title, then one scene per step.'),
  palette: z.enum(['cream', 'blush', 'studio']).default('cream').describe('cream = warm paper with burnt-orange accent; blush = pink and sky with raspberry accent; studio = dark warm night with amber accent.'),
  showCaptions: z.boolean().default(true).describe('Word-synced captions at the bottom.'),
});

export type Props = z.infer<typeof Props>;
