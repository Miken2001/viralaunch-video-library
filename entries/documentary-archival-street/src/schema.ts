import {z} from 'zod';

export const Plate = z.object({
  /** Date stamp typed onto the archive slip, e.g. "1 September 1897", "c. 1890" or "Spring 1906". */
  date: z.string().min(1).max(32).describe('Date stamp for this scene: a day, a year or an era ("c. 1890").'),
  /** One short line under the date: what or where, e.g. "Tremont Street, looking north". */
  label: z.string().max(70).default('').describe('Short line under the date: the place or what the viewer sees.'),
});

export const Props = z.object({
  /** Opening title card, e.g. "America's First Subway". */
  title: z.string().min(1).max(60).describe('Opening title card, a few words.'),
  /** City or place, shown on the title card and on every slip, e.g. "Boston". */
  place: z.string().max(40).default('').describe('City or place name, shown small in capitals.'),
  /** One archive slip per narration scene (date + label). Missing entries show no slip. */
  plates: z.array(Plate).max(60).default([]).describe('One {date, label} per narration scene, in order.'),
  /** Period film grade of the whole film. */
  grade: z.enum(['silver', 'sepia', 'cyanotype', 'amber']).default('silver').describe('Period grade: silver (black and white), sepia, cyanotype (blue) or amber (tinted film).'),
  /** Scenes without an image become an illustrated street the camera travels up. */
  street: z.enum(['tramway', 'boulevard', 'lane']).default('tramway').describe('Drawn street for scenes with no image: tramway (rails, wires, clock tower), boulevard (wide, trees, dome) or lane (narrow, lanterns, arch).'),
  /** Border around the picture: film strip with sprocket holes, a mounted print, or none. */
  frame: z.enum(['film', 'print', 'none']).default('film').describe('Picture border: film (sprocket strip), print (mounted photo) or none.'),
  /** Show narration as word captions at the bottom. */
  showCaptions: z.boolean().default(true).describe('Show word captions of the narration.'),
});

export type Props = z.infer<typeof Props>;
