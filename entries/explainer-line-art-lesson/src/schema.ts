import {z} from 'zod';
import {ICON_NAMES} from '@viralaunch/kit';

const Mark = z.object({
  label: z.string().min(1).max(28).describe('Short name drawn on the diagram, e.g. "Equatorial low", "Trade winds", "Mantle", "Windward side".'),
  detail: z.string().max(60).default('').describe('Optional small second line under the label, e.g. "rising air, heavy rain" or "about 2,900 km thick".'),
  at: z
    .number()
    .min(-90)
    .max(100)
    .default(0)
    .describe('Where the mark sits. globe: latitude in degrees (-90 south pole … 0 equator … 90 north pole). section: position across the drawing, 0 (left) to 100 (right). layers: relative thickness of the layer (e.g. 1, 2, 5). panels: ignored.'),
  tone: z.enum(['warm', 'cool', 'green', 'ink']).default('ink').describe('Line colour: warm (red/orange: heat, low pressure, rising air), cool (blue: cold, high pressure, sinking air, water), green (land, plants, winds), ink (neutral).'),
  arrow: z
    .enum(['none', 'up', 'down', 'east', 'west'])
    .default('none')
    .describe('Movement drawn with the mark. globe: east/west = a row of wind or current arrows at that latitude, up/down = toward the north/south pole, none = a latitude line (belt, zone or boundary). section: up/down = rising/sinking arrow, east/west = sideways flow. panels: a small arrow beside the label.'),
  icon: z.enum(ICON_NAMES).default('pin').describe('Line icon, only used by the panels diagram (sun, cloud, rain, drop, leaf, mountain, wave, globe, map, pin, fire, house, building, people...).'),
});

const Step = z.object({
  heading: z.string().min(1).max(40).describe('Chapter heading for this step, e.g. "The three-cell model". *Asterisks* colour a word.'),
  diagram: z
    .enum(['globe', 'section', 'layers', 'panels'])
    .describe('globe = sketched Earth with latitude belts and wind rows; section = side-view cross-section of land and sky with arrows; layers = stacked strata (Earth interior, atmosphere, soil); panels = 2–4 side-by-side sketch cards comparing places or types.'),
  marks: z.array(Mark).min(1).max(6).describe('1–6 labelled parts of the diagram, in the order the narration mentions them (panels use the first 4).'),
  note: z.string().max(80).default('').describe('Optional one-line handwritten takeaway under the diagram, e.g. "Rising air cools, so clouds form here".'),
});

export const Props = z.object({
  chapter: z.string().max(36).default('').describe('Small course label shown above the title and beside each heading, e.g. "Geography · Unit 4".'),
  title: z.string().min(1).max(52).describe('Lesson title, e.g. "How the atmosphere moves heat".'),
  subtitle: z.string().max(70).default('').describe('Optional line under the title, e.g. a second-language title or a one-line question.'),
  steps: z.array(Step).min(1).max(8).describe('1–8 lesson steps in order, one per narration line (an extra first narration line becomes the title card).'),
  palette: z.enum(['paper', 'blueprint', 'chalk']).default('paper').describe('paper = cream page with ink lines (the classic lesson look), blueprint = navy with white lines, chalk = green chalkboard.'),
  showCaptions: z.boolean().default(true).describe('Word-synced subtitles in a plate at the bottom.'),
});

export type Props = z.infer<typeof Props>;
export type Mark = z.infer<typeof Mark>;
export type Step = z.infer<typeof Step>;
