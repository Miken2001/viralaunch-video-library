import {z} from 'zod';
import {ICON_NAMES} from '@viralaunch/kit';

export const Row = z.object({
  label: z.string().min(1).max(32).describe('Main text of the row. scores: "Team A vs Team B"; stats/vote: a player or team name; feed: the user name; highlight: what the number counts ("Fans at the final").'),
  sub: z.string().max(60).default('').describe('Second line. scores: stage or status ("Final", "78\'"); vote: team or award; feed: the message itself; highlight: where/when.'),
  value: z.string().max(14).default('').describe('Short value shown on the right or as the big number: "3–3", "8", "88,966", "now". Plain numbers count up.'),
  bar: z.number().min(0).max(100).optional().describe('Optional 0–100 bar length (share, progress, rating). Leave out when there is nothing to compare.'),
});

export const Shot = z.object({
  headline: z.string().min(2).max(48).describe('Kinetic headline above the phone, ≤ 7 words. Wrap 1–2 words in *asterisks* to colour them.'),
  screen: z.enum(['scores', 'stats', 'vote', 'feed', 'highlight']).default('scores').describe('App screen shown in the phone: scores = live/result list, stats = ranked bars, vote = pick tiles + button, feed = fan comments, highlight = one big number over a pitch or the scene image.'),
  heading: z.string().max(22).default('').describe('Title of the app screen, e.g. "Results", "Golden Boot", "Your pick".'),
  rows: z.array(Row).min(1).max(5).describe('1–5 rows of the screen, most important first (the first row is the one the finger taps).'),
  button: z.string().max(18).default('').describe('Optional button at the bottom of the screen ("Vote", "Follow team"); best on vote screens.'),
});

export const Props = z.object({
  appName: z.string().min(1).max(18).describe('Product or app name shown in the app header and on the launch splash.'),
  icon: z.enum(ICON_NAMES).default('ball').describe('App icon glyph (ball, trophy, flag, target, chart...).'),
  title: z.string().min(2).max(48).describe('Opening hook while the app launches, ≤ 7 words. *asterisks* colour a word.'),
  tagline: z.string().max(40).default('').describe('Optional product line that slides in under the phone on the last shot.'),
  shots: z.array(Shot).min(2).max(8).describe('One shot per narration scene. With one more scene than shots, scene 0 is the launch intro.'),
  palette: z.enum(['volt', 'court', 'ice', 'turf']).default('volt').describe('volt = lime on black, court = orange, ice = cyan, turf = green.'),
  showCaptions: z.boolean().default(true).describe('Word-synced captions under the phone.'),
});

export type Props = z.infer<typeof Props>;
export type Shot = z.infer<typeof Shot>;
export type Row = z.infer<typeof Row>;
