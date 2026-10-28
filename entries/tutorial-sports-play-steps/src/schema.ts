import {z} from 'zod';
import {ICON_NAMES} from '@viralaunch/kit';

/** Board coordinates: 0–100 on both axes. x: left → right sideline. y: 0 = goal / hoop end (top), 100 = far end. */
const Coord = z.number().min(0).max(100);

export const Props = z.object({
  title: z.string().min(1).max(48).describe('Name of the play or drill, e.g. "The *pick and roll*". Wrap 1–2 words in *asterisks* to highlight them.'),
  kicker: z.string().max(32).default('').describe('Small label shown above the title and in the top bar, e.g. "Basketball playbook".'),
  field: z.enum(['basketball', 'soccer', 'american-football', 'plain']).default('basketball').describe('Which playing surface the board draws (attacking end at the top). "plain" = a blank tactics board for any sport.'),
  players: z
    .array(
      z.object({
        id: z.string().min(1).max(3).describe('Short marker label, unique, e.g. "1", "PG", "C", "X1".'),
        side: z.enum(['attack', 'defense']).default('attack').describe('attack = filled accent marker; defense = outlined marker.'),
        x: Coord.describe('Start position: 0 = left sideline, 50 = centre, 100 = right sideline.'),
        y: Coord.describe('Start position: 0 = the goal / hoop end at the top, 100 = the far end at the bottom.'),
      }),
    )
    .min(1)
    .max(12)
    .describe('Everyone on the board at the start. Keep it readable: 2–10 markers.'),
  ballWith: z.string().max(3).default('').describe('id of the player holding the ball at the start, or "" for no ball.'),
  steps: z
    .array(
      z.object({
        label: z.string().min(1).max(26).describe('Short step name shown as "01 / LABEL", e.g. "Set the screen".'),
        headline: z.string().min(1).max(48).describe('The instruction for this step, e.g. "Plant a *solid screen*". *Asterisks* highlight words.'),
        tip: z.string().max(90).default('').describe('One coaching cue in plain words, e.g. "Feet wide, arms in, stay still."'),
        icon: z.enum(ICON_NAMES).default('target').describe('Line icon on the cue card, e.g. target, arrow, person, people, ball, check, clock, star, trophy.'),
        moves: z
          .array(
            z.object({
              player: z.string().min(1).max(3).describe('id of the player who moves.'),
              x: Coord.describe('Where they end up (0–100).'),
              y: Coord.describe('Where they end up (0–100).'),
              kind: z.enum(['run', 'dribble']).default('run').describe('run = curved solid arrow; dribble = wavy arrow (use for the ball carrier).'),
            }),
          )
          .max(6)
          .default([])
          .describe('Movements in this step. Positions carry over to the next step.'),
        passTo: z.string().max(4).default('').describe('After the moves, the ball carrier passes to this player id. "goal" = shot / score. "" = no pass.'),
      }),
    )
    .min(1)
    .max(6)
    .describe('The play in order, 2–6 steps. Narration scene i+1 explains step i (scene 1 is the title).'),
  palette: z.enum(['clean', 'night', 'court']).default('clean').describe('clean = white studio with blue accent; night = dark green floodlight; court = warm hardwood.'),
  showCaptions: z.boolean().default(true).describe('Word-synced captions at the bottom.'),
});

export type Props = z.infer<typeof Props>;
