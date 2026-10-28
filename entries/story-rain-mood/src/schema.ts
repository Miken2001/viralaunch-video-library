import {z} from 'zod';

export const Shot = z.object({
  /** The illustrated place for this narration scene. */
  setting: z
    .enum(['forest', 'mountains', 'lake', 'coast', 'city', 'station', 'field'])
    .default('forest')
    .describe('Drawn place: forest, mountains, lake, coast (sea + lighthouse), city (rainy streets), station (train platform) or field.'),
  /** Weather particles over the scene. */
  weather: z.enum(['rain', 'storm', 'snow', 'fog', 'clear']).default('rain').describe('rain, storm (heavy rain + lightning), snow, fog or clear (fireflies/dust).'),
  /** Time of day sets the sky and the light. */
  time: z.enum(['dawn', 'day', 'dusk', 'night']).default('night').describe('dawn, day, dusk or night.'),
  /** Silhouette in the foreground. */
  figure: z.enum(['none', 'umbrella', 'walker', 'deer', 'birds']).default('none').describe('none, umbrella (person under an umbrella), walker, deer or birds (a flock crossing the sky).'),
  /** Small location tag shown at the top of the scene, e.g. "Mawsynram, India". */
  label: z.string().max(40).default('').describe('Short place or moment tag, max 40 characters. Empty shows nothing.'),
});
export type Shot = z.infer<typeof Shot>;

export const Props = z.object({
  title: z.string().min(1).max(60).describe('Opening title, max ~6 words. Wrap one word in *asterisks* to tint it.'),
  subtitle: z.string().max(80).default('').describe('Small line under the title: a place, season or mood.'),
  shots: z.array(Shot).min(1).max(16).describe('One shot per narration scene, in order. Extra scenes reuse the shots from the start.'),
  closing: z.string().max(70).default('').describe('Quiet closing line shown over the last scene, e.g. "Listen to it fall." Empty shows nothing.'),
  mood: z.enum(['blue-hour', 'ember', 'moss', 'mono']).default('blue-hour').describe('Colour mood: blue-hour (cool blues, warm lamps), ember (warm), moss (green, earthy), mono (near black and white).'),
  showCaptions: z.boolean().default(true).describe('Show the narration as calm word captions.'),
  letterbox: z.boolean().default(true).describe('Cinema bars on landscape (16:9) output.'),
});

export type Props = z.infer<typeof Props>;
