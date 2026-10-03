import {z} from 'zod';

export const Milestone = z.object({
  /** Display label for the date: "1969", "3000 BC", "Q4 2024". */
  when: z.string().min(1).max(16),
  /** Sortable number used for the year counter (negative for BC). */
  year: z.number(),
  title: z.string().min(1).max(48),
  fact: z.string().max(110).default(''),
  /** Optional era band this milestone belongs to (consecutive equal values form one band). */
  era: z.string().max(28).default(''),
});

export const Props = z.object({
  title: z.string().min(1).max(60),
  /** 3–14 milestones in chronological order. */
  milestones: z.array(Milestone).min(3).max(14),
  palette: z.enum(['ink', 'chalk', 'neon', 'parchment']).default('ink'),
  showCaptions: z.boolean().default(true),
});

export type Props = z.infer<typeof Props>;
