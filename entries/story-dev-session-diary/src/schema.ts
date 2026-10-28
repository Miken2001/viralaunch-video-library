import {z} from 'zod';

export const Beat = z.object({
  /** Clock time of this moment, "HH:MM" 24h, e.g. "09:14". The wall clock swings to it. */
  time: z.string().max(8).default('').describe('Clock time of the moment, "HH:MM" (24h), e.g. "09:14". Use "" if unknown.'),
  /** What was said or logged at this moment, written like a chat message. */
  message: z.string().min(2).max(90).describe('The message or log line for this moment, ≤ 90 characters, e.g. "Why does the login page loop forever?"'),
  /** Who says it: the person at the desk, or the machine (shown as a terminal reply from the monitor). */
  who: z.enum(['human', 'machine']).default('human').describe('"human" = the person at the desk says it; "machine" = the computer replies (mono terminal bubble).'),
  /** Face of the character at the desk. */
  mood: z.enum(['focused', 'happy', 'proud', 'confused', 'frustrated', 'sleepy']).default('focused').describe('Character face for this moment.'),
  /** What the monitor shows. */
  screen: z.enum(['typing', 'thinking', 'progress', 'error', 'success', 'chart', 'launch']).default('typing').describe('Monitor state: typing (terminal), thinking (idea bulb), progress (bar fills), error (red cross), success (green check), chart (growth), launch (rocket).'),
  /** Optional ribbon stuck on the character, like a badge earned. ≤ 16 chars. */
  sticker: z.string().max(16).default('').describe('Optional ribbon slapped on the character, e.g. "SO COOL" or "BUG FOUND". Use "" for none.'),
});

export const Props = z.object({
  /** Typed on the monitor in the opening zoom, e.g. "Initiating session...". */
  title: z.string().min(1).max(40).default('Initiating session...').describe('Opening line typed on the monitor while the camera pulls back, ≤ 40 characters.'),
  /** Brass plate on the desk front, e.g. "Night-shift debugger". */
  nameplate: z.string().max(28).default('').describe('Text on the desk nameplate, ≤ 28 characters (a name or a role). "" hides the plate text.'),
  /** Display names on the message bubbles. */
  cast: z
    .object({
      human: z.string().min(1).max(16).default('Dev').describe('Name shown on human bubbles, e.g. "Dev" or "Operator".'),
      machine: z.string().min(1).max(16).default('Terminal').describe('Name shown on machine bubbles, e.g. "Terminal" or "Build bot".'),
    })
    .prefault({})
    .describe('Names on the bubbles.'),
  /** One beat per narration scene, in order. If there is one more scene than beats, scene 0 is the intro. */
  beats: z.array(Beat).min(2).max(12).describe('2–12 moments of the session in time order, one per narration scene.'),
  /** How the light in the window changes over the video. */
  sky: z.enum(['day-to-night', 'night-to-dawn', 'daylight']).default('day-to-night').describe('Window light across the video: day-to-night, night-to-dawn, or daylight only.'),
  palette: z.enum(['cozy', 'pastel', 'midnight']).default('cozy').describe('Room colours: cozy (cream and teal), pastel (lilac), midnight (dark navy).'),
  /** Show narration as word captions at the bottom. */
  showCaptions: z.boolean().default(true).describe('Show word captions at the bottom.'),
});

export type Props = z.infer<typeof Props>;
export type Beat = z.infer<typeof Beat>;
