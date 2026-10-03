import {z} from 'zod';

const Team = z.object({name: z.string().min(1).max(24), short: z.string().min(2).max(4), color: z.string().regex(/^#[0-9a-fA-F]{6}$/)});

export const Props = z.object({
  competition: z.string().max(40).default(''),
  /** e.g. "Final", "Matchday 12", "Game 7". */
  stage: z.string().max(30).default(''),
  home: Team,
  away: Team,
  /** Chronological events. Only 'score' events change the scoreboard. Facts must be verified. */
  events: z.array(z.object({
    minute: z.string().max(8),
    side: z.enum(['home', 'away']),
    kind: z.enum(['score', 'card', 'sub', 'chance', 'note']),
    text: z.string().min(1).max(50),
    /** Points added for 'score' events (1 for football, 2/3 for basketball). */
    points: z.number().int().min(1).max(7).default(1),
  })).min(1).max(12),
  stats: z.array(z.object({label: z.string().max(22), home: z.number(), away: z.number(), suffix: z.string().max(4).default('')})).max(5).default([]),
  showCaptions: z.boolean().default(true),
});

export type Props = z.infer<typeof Props>;
