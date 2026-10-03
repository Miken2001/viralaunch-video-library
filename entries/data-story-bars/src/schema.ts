import {z} from 'zod';

export const Props = z.object({
  title: z.string().min(1).max(70),
  /** The hero number that counts up first, e.g. 8.1 with unit "billion people". */
  headline: z.object({value: z.number(), unit: z.string().max(30).default(''), label: z.string().max(70).default('')}),
  /** 3–8 bars. Values share one unit. Order does not matter: bars sort by value. */
  bars: z.array(z.object({label: z.string().min(1).max(24), value: z.number().nonnegative(), highlight: z.boolean().default(false)})).min(3).max(8),
  valueSuffix: z.string().max(12).default(''),
  /** Decimal places shown on bar values and the headline. */
  decimals: z.number().int().min(0).max(2).default(0),
  takeaway: z.string().max(90).default(''),
  /** Small source line, e.g. "Source: World Bank 2024". Always include one for real data. */
  source: z.string().max(80).default(''),
  palette: z.enum(['graphite', 'paper', 'midnight']).default('graphite'),
  showCaptions: z.boolean().default(true),
});

export type Props = z.infer<typeof Props>;
