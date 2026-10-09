import {z} from 'zod';
import {ICON_NAMES} from '@viralaunch/kit';

export const Stop = z.object({
  name: z.string().min(1).max(28).describe('Place name shown on the card and the pin, e.g. "Kyoto", "Mount Fuji", "Old Town".'),
  region: z.string().max(32).default('').describe('Small label above the name: province, state or district, e.g. "Kansai", "Hokkaido". Can be empty.'),
  lat: z.number().min(-85).max(85).describe('Latitude in decimal degrees (north positive), e.g. 35.01. Places the pin on the stylised map.'),
  lon: z.number().min(-180).max(180).describe('Longitude in decimal degrees (east positive), e.g. 135.77.'),
  fact: z.string().min(1).max(110).describe('One short, verifiable fact about the place, shown on its card.'),
  stat: z
    .object({
      value: z.number().describe('The number, e.g. 3776.'),
      unit: z.string().max(24).default('').describe('Short unit or label after the number, e.g. "m high", "years as capital".'),
      decimals: z.number().int().min(0).max(2).default(0),
    })
    .nullable()
    .default(null)
    .describe('Optional headline number for the card (counts up). null when there is no good number.'),
  scenery: z
    .enum(['city', 'mountains', 'coast', 'forest', 'desert', 'countryside', 'oldtown'])
    .default('city')
    .describe('Flat illustration at the top of the card: city skyline, mountains, coast, forest, desert dunes, countryside fields, or oldtown (colourful historic houses).'),
  icon: z.enum(ICON_NAMES).default('pin').describe('Line icon next to the stat or fact (e.g. building, mountain, wave, leaf, star, flag).'),
});

export const Props = z.object({
  title: z.string().min(1).max(48).describe('Opening title, e.g. "Japan in five stops". Wrap one word in *asterisks* to colour it.'),
  subtitle: z.string().max(48).default('').describe('Small line above the title, e.g. "5 stops · 1 journey". Leave empty to show the number of stops and the total distance.'),
  stops: z.array(Stop).min(2).max(8).describe('2–8 stops in travel order. All in one country, region or city, so the map stays readable.'),
  travel: z.enum(['flight', 'road', 'rail']).default('road').describe('How the route is drawn: flight = dashed arcs with a plane, road = curving road with a car, rail = rail line with a train.'),
  units: z.enum(['km', 'mi']).default('km').describe('Units of the distance counter (straight-line distance between stops).'),
  palette: z.enum(['sunset', 'atlas', 'night', 'jungle']).default('sunset').describe('sunset = warm dark terracotta, atlas = light paper atlas, night = deep navy with mint, jungle = deep green with gold.'),
  showCaptions: z.boolean().default(true).describe('Show word-synced narration captions.'),
});

export type Props = z.infer<typeof Props>;
export type Stop = z.infer<typeof Stop>;
