import {z} from 'zod';

export const Props = z.object({
  title: z.string().min(1).max(60),
  /** 2–7 steps, in order. Each step is highlighted while its narration scene plays (scene i → step i). */
  steps: z.array(z.object({
    label: z.string().min(1).max(28),
    detail: z.string().max(90).default(''),
    /** One emoji-free symbol drawn in the node: a short word or number, e.g. "H2O", "CO2", "1". */
    symbol: z.string().max(5).default(''),
  })).min(2).max(7),
  /** Draw an arrow from the last step back to the first (cycles like the water cycle). */
  cycle: z.boolean().default(false),
  palette: z.enum(['blueprint', 'chalkboard', 'clean']).default('blueprint'),
  showCaptions: z.boolean().default(true),
});

export type Props = z.infer<typeof Props>;
