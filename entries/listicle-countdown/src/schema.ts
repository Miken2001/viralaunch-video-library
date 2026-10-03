import {z} from 'zod';

export const Props = z.object({
  /** e.g. "5 Deadliest Animals" — shown on the intro card. */
  title: z.string().min(1).max(60),
  /** Items in countdown order: the first item shown is the highest rank (#N), the last is #1. */
  items: z.array(z.object({title: z.string().min(1).max(40), why: z.string().max(90).default('')})).min(3).max(10),
  /** Color field behind each item when its scene has no image. */
  palette: z.enum(['heat', 'ocean', 'forest', 'mono']).default('heat'),
  showCaptions: z.boolean().default(true),
});

export type Props = z.infer<typeof Props>;
