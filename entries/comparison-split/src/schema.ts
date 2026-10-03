import {z} from 'zod';

const Side = z.object({name: z.string().min(1).max(24), subtitle: z.string().max(40).default(''), color: z.string().regex(/^#[0-9a-fA-F]{6}$/)});

export const Props = z.object({
  title: z.string().max(60).default(''),
  left: Side,
  right: Side,
  /** 2–6 stat rows. Higher number wins unless lowerIsBetter. */
  stats: z.array(z.object({label: z.string().min(1).max(28), left: z.number(), right: z.number(), suffix: z.string().max(8).default(''), lowerIsBetter: z.boolean().default(false)})).min(2).max(6),
  /** Final line, e.g. "Different eras, same greatness." */
  verdict: z.string().max(80).default(''),
  showCaptions: z.boolean().default(true),
});

export type Props = z.infer<typeof Props>;
