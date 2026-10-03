import {z} from 'zod';

export const Props = z.object({
  /** Masthead text, e.g. "THE DAILY LEDGER". Use a generic name — never imitate a real outlet. */
  masthead: z.string().min(1).max(30),
  dateline: z.string().max(40).default(''),
  headline: z.string().min(5).max(110),
  /** Exact substrings of the headline or body to highlight, in order. */
  highlights: z.array(z.string().min(2).max(60)).max(4).default([]),
  body: z.string().max(360).default(''),
  /** The closing card: one sentence on why it matters. */
  whyItMatters: z.string().max(120).default(''),
  /** Source attribution for real news, e.g. "Source: NASA, Sept 2026". */
  source: z.string().max(80).default(''),
  marker: z.string().regex(/^#[0-9a-fA-F]{6}$/).default('#ffe066'),
});

export type Props = z.infer<typeof Props>;
