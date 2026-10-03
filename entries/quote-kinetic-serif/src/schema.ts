import {z} from 'zod';

export const Props = z.object({
  /** The quote, max ~40 words. Wrap words to emphasise in *asterisks*. */
  quote: z.string().min(3).max(320),
  /** Who said it. Quotes must be real and correctly attributed. */
  author: z.string().max(60).default(''),
  /** Where/when, e.g. "Meditations, c. 170 AD". */
  context: z.string().max(70).default(''),
  palette: z.enum(['ivory', 'night', 'oxblood', 'sage']).default('ivory'),
});

export type Props = z.infer<typeof Props>;
