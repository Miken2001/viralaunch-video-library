import {z} from 'zod';

export const WORLDS = ['space', 'city', 'forest', 'ocean', 'desert', 'cave', 'sky'] as const;
export const HAZARDS = ['auto', 'meteor', 'block', 'spike', 'bug', 'ghost'] as const;
export const ITEMS = ['coin', 'star', 'gem', 'heart'] as const;

export const Level = z.object({
  name: z.string().min(1).max(28).describe('Level title shown in the dialog box, e.g. "Evaporation" or "The Moon Landing".'),
  text: z.string().max(90).default('').describe('One short line the level teaches or tells (a fact or a story beat). Shown in the dialog box.'),
  world: z.enum(WORLDS).default('space').describe('Background world the character runs through.'),
  hazard: z.enum(HAZARDS).default('auto').describe('What the character jumps over. "auto" picks one that suits the world.'),
  item: z.enum(ITEMS).default('coin').describe('What the character collects (coin 100, star 250, gem 500, heart 50 points).'),
  hit: z.boolean().default(false).describe('true = the character gets hit once in this level and loses a life (a setback in the story).'),
});

export const Props = z.object({
  title: z.string().min(1).max(40).describe('Game title on the start screen, e.g. "The Water Cycle". Wrap one word in *asterisks* to highlight it.'),
  hero: z.enum(['runner', 'astronaut', 'robot', 'cat']).default('runner').describe('Pixel character: runner (orange critter), astronaut, robot or cat.'),
  levels: z.array(Level).min(2).max(8).describe('2–8 levels in story order; each one usually matches one narration scene.'),
  lives: z.number().int().min(1).max(5).default(3).describe('Hearts the character starts with.'),
  ending: z.string().min(1).max(24).default('STAGE CLEAR').describe('Banner on the final screen, e.g. "STAGE CLEAR", "MISSION COMPLETE", "GAME OVER".'),
  palette: z.enum(['nebula', 'gameboy', 'sunset', 'arcade']).default('nebula').describe('nebula = purple space night, gameboy = 4-shade green handheld, sunset = warm pink dusk, arcade = black with neon.'),
  showCaptions: z.boolean().default(true).describe('Word-synced captions under the floor.'),
});

export type Props = z.infer<typeof Props>;
export type Level = z.infer<typeof Level>;
