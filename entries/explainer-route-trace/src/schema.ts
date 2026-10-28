import {z} from 'zod';
import {ICON_NAMES} from '@viralaunch/kit';

const Checkpoint = z.object({
  at: z.number().min(0).describe('Distance from the start where this checkpoint sits, in `unit` (e.g. 21 for mile 21). Must be ≤ total.'),
  label: z.string().min(1).max(28).describe('Short place or moment name, e.g. "Heartbreak Hill", "Turn 1", "Summit".'),
  note: z.string().max(70).default('').describe('One factual line about this stretch, e.g. "Last of four climbs through Newton".'),
  icon: z.enum(ICON_NAMES).default('pin').describe('Line icon on the checkpoint card (flag, mountain, trophy, clock, fire, wave, building, star, target...).'),
  elevation: z.number().optional().describe('Height above sea level at this point (metres for km, feet for mi). Leave out when unknown; the profile only draws with 2+ values.'),
});

export const Props = z.object({
  title: z.string().min(1).max(48).describe('Name of the route or course, e.g. "The Boston Marathon course".'),
  kicker: z.string().max(40).default('').describe('Small label above the title, e.g. "MARATHON · POINT TO POINT".'),
  unit: z.enum(['km', 'mi']).default('km').describe('Distance unit for `total` and every checkpoint `at`.'),
  total: z.number().positive().describe('Full route length in `unit`, e.g. 42.2 or 26.2.'),
  route: z
    .object({
      shape: z.enum(['loop', 'point-to-point', 'out-and-back', 'figure-eight', 'circuit']).default('loop').describe('Overall form of the drawn route: loop (back to start), point-to-point (A to B), out-and-back, figure-eight, or circuit (race track).'),
      points: z.array(z.object({x: z.number().min(0).max(100), y: z.number().min(0).max(100)})).max(24).default([]).describe('Optional rough trace of the real route as 3–24 points on a 0–100 grid (y grows downward). Leave empty to use `shape`.'),
    })
    .prefault({})
    .describe('How the route line is drawn. It is a stylised trace, not a survey map.'),
  checkpoints: z.array(Checkpoint).min(2).max(8).describe('2–8 points along the route in order of distance, one per narration line. Usually starts at 0 and ends at the finish.'),
  palette: z.enum(['night', 'track', 'glacier']).default('night').describe('night = navy with orange route, track = black with lime route, glacier = light with red route.'),
  showCaptions: z.boolean().default(true).describe('Word-synced captions under the panel.'),
});

export type Props = z.infer<typeof Props>;
