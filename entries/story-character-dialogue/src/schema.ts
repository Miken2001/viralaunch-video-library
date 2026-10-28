import {z} from 'zod';
import {ICON_NAMES} from '@viralaunch/kit';

/** Outfits the template can draw. Each has its own silhouette and details. */
export const STYLES = ['hoodie', 'blazer', 'labcoat', 'cap', 'robot'] as const;
export const COLORS = ['olive', 'navy', 'coral', 'teal', 'plum', 'charcoal', 'mustard'] as const;
export const SKINS = ['light', 'tan', 'brown', 'deep'] as const;
/** Sets the magic pencil sketches behind the cast. */
export const PLACES = ['paper', 'desk', 'city', 'servers', 'sky', 'night'] as const;
export const ACTIONS = ['talk', 'point', 'think', 'shrug', 'wave', 'cheer', 'shock'] as const;
export type Place = (typeof PLACES)[number];
export type Action = (typeof ACTIONS)[number];

export const Character = z.object({
  name: z.string().min(1).max(16).describe('Short character name shown on their speech bubbles, e.g. "Maya" or "Bit".'),
  style: z.enum(STYLES).default('hoodie').describe('Outfit: hoodie (developer, glasses), blazer (founder or manager), labcoat (scientist or engineer), cap (student or maker, t-shirt and cap), robot (an AI or machine).'),
  color: z.enum(COLORS).default('olive').describe('Main outfit colour: olive, navy, coral, teal, plum, charcoal or mustard.'),
  skin: z.enum(SKINS).default('tan').describe('Skin tone: light, tan, brown or deep. Ignored for the robot.'),
});

export const Beat = z.object({
  speaker: z.enum(['a', 'b', 'narrator']).default('a').describe('Who says this line: "a" (first cast member, left), "b" (second, right) or "narrator" (a caption strip at the top, no bubble).'),
  line: z.string().min(1).max(90).describe('The spoken line shown in the speech bubble, at most 90 characters. Usually the same words as this scene\'s narration, or a short version of it.'),
  place: z.enum(PLACES).default('paper').describe('Set sketched behind the cast: paper (blank page), desk (desk and monitor), city (skyline), servers (server racks), sky (sunset clouds on a paper plane), night (dark room under the stars).'),
  sketch: z.enum(['none', ...ICON_NAMES]).default('none').describe('Optional object the pencil draws in a glowing loop between the characters, e.g. code, chip, lock, cloud, rocket, brain, bulb, phone, globe. "none" for no object.'),
  action: z.enum(ACTIONS).default('talk').describe('What the speaker does: talk, point (at the sketch), think, shrug, wave, cheer (jump with arms up) or shock. For narrator beats, both characters do it.'),
});

export const Props = z.object({
  title: z.string().min(1).max(60).describe('Story title, e.g. "The bug that only happened on Fridays". Shown on the opening title card and in the corner label.'),
  cast: z.array(Character).min(1).max(2).describe('One or two characters. The first stands on the left (speaker "a"), the second on the right (speaker "b").'),
  beats: z.array(Beat).min(2).max(8).describe('2-8 story beats in order, one per narration scene. Add one extra first narration scene to get a title card.'),
  timer: z.boolean().default(true).describe('Show a small countdown clock in the top corner (time left in the story).'),
  palette: z.enum(['sketchbook', 'pastel', 'blueprint']).default('sketchbook').describe('sketchbook = warm paper and orange, pastel = cool paper and blue, blueprint = dark navy with light lines.'),
  showCaptions: z.boolean().default(false).describe('Also show the narration as word captions under the stage. Leave off when the bubbles already show the same words.'),
});

export type Props = z.infer<typeof Props>;
export type CharacterProps = z.infer<typeof Character>;
export type BeatProps = z.infer<typeof Beat>;
