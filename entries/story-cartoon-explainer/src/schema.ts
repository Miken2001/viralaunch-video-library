import {z} from 'zod';

/** Cartoon props the template can draw and animate (each has its own idle motion). */
export const PROP_KINDS = [
  'sun', 'cloud', 'drop', 'ice', 'flame', 'plant', 'tree', 'atom', 'dna', 'cell', 'heart',
  'magnet', 'bolt', 'bulb', 'battery', 'thermometer', 'flask', 'rocket', 'planet', 'moon', 'earth',
] as const;
export type PropKind = (typeof PROP_KINDS)[number];

/** What the host character does during a step. */
export const ACTIONS = ['point', 'explain', 'think', 'wave', 'cheer', 'shock'] as const;
export type Action = (typeof ACTIONS)[number];

export const HOSTS = ['blob', 'robot', 'professor'] as const;
export type HostKind = (typeof HOSTS)[number];

export const Step = z.object({
  /** Short heading for the step, e.g. "Heat melts the ice". */
  heading: z.string().min(1).max(40).describe('What happens in this step, in at most 6 words, e.g. "Heat melts the ice". Wrap one word in *asterisks* to colour it.'),
  /** What the host says in a speech bubble: a short, kid-friendly line. */
  line: z.string().max(70).default('').describe('Short line the host says in a speech bubble (max 70 characters). Leave empty for no bubble.'),
  prop: z.enum(PROP_KINDS).describe('Cartoon prop acting out the step: sun, cloud, drop, ice, flame, plant, tree, atom, dna, cell, heart, magnet, bolt, bulb, battery, thermometer, flask, rocket, planet, moon, earth.'),
  /** The prop turns into this one halfway through the step (with a cartoon "poof"). */
  becomes: z.enum(['none', ...PROP_KINDS]).default('none').describe('Optional: the prop changes into this prop halfway through the step, e.g. ice becomes drop. "none" keeps it.'),
  action: z.enum(ACTIONS).default('point').describe('What the host does: point (at the prop), explain (open arms), think (hand on chin), wave, cheer (jumps), shock (surprised jump).'),
  /** Comic sound word that pops next to the prop, e.g. "ZAP!". */
  sfx: z.string().max(8).default('').describe('Optional comic sound word next to the prop, e.g. "POP!", "ZAP!", "DRIP!". Max 8 characters.'),
});

export const Props = z.object({
  /** The episode title, e.g. "Where does rain come from?". Shown on the title card (when there is an extra first scene). */
  title: z.string().min(1).max(60).describe('Episode title, e.g. "Where does rain come from?". Shown on the opening title card.'),
  host: z
    .object({
      kind: z.enum(HOSTS).default('blob').describe('The cartoon host: blob (round friendly creature), robot, or professor (lab coat, glasses).'),
      name: z.string().max(24).default('').describe('Optional host name shown on the title card, e.g. "Professor Pip".'),
    })
    .prefault({})
    .describe('The cartoon host who acts out every step.'),
  /** 2–7 steps in order, one per narration scene. One extra first scene becomes the title card. */
  steps: z.array(Step).min(2).max(7).describe('2-7 steps in order, one per narration scene. Add one extra first scene to get a title card.'),
  /** One closing sentence shown over the last step while the host cheers. */
  takeaway: z.string().max(70).default('').describe('Optional closing idea shown at the end of the last step, e.g. "Same water, three *states*!". Leave empty for none.'),
  palette: z.enum(['saturday', 'dusk', 'chalk']).default('saturday').describe('saturday = bright sky and green hills, dusk = purple sunset, chalk = soft paper colours.'),
  showCaptions: z.boolean().default(true).describe('Show the narration as word captions on the ground band.'),
});

export type Props = z.infer<typeof Props>;
