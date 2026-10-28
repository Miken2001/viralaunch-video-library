# Map Country Tour

**Use it for:** a tour of a country, region or city told stop by stop: "Japan in five
stops", a road trip through a national park, the landmarks of one city, where a sport's
host cities are, a food or wine route, places along a historic journey.

**Do not use it for:** routes that cross oceans or continents (the map is one stylised
landmass; use a globe template), or content with no real places.

## How it looks
A stylised map (one landmass with a seeded coastline, depth rings, faint graticule and
region borders) fills the frame. The title opens over the whole route. Then the camera
flies from stop to stop, following a car (`road`), train (`rail`) or plane (`flight`) as the
route draws itself. At each stop a numbered pin drops with ripples and a place card docks
beside the map (right side in 16:9, below in 9:16): a flat illustration of the kind of place,
region label, place name, a line icon with a counted-up number, and one fact. A HUD shows the
tour's progress and a distance counter. The last stop pulls back to the full route.
Palettes: `sunset`, `atlas` (light paper), `night`, `jungle`. In a sequence it takes the
shared look's colours and fonts.

## Filling the props (fill tier)
- `title`: short, e.g. "Japan in *five* stops"; asterisks colour one word.
- `subtitle`: leave "" to show "5 STOPS · 1,234 KM" automatically.
- `stops`: 2–8, in travel order, all in one country, region or city.
  - `lat` / `lon`: real decimal coordinates (north and east positive). They place the pins.
  - `fact`: one short, checkable fact (≤ 110 characters).
  - `stat`: a real number with a short unit ("634", "m Skytree"), or `null`.
  - `scenery`: city, mountains, coast, forest, desert, countryside or oldtown.
  - `icon`: one of the kit icon names (building, mountain, wave, leaf, house, star…).
- `travel`: road, rail or flight. `units`: km or mi (straight-line distance between stops).
- Narration: write one opening scene for the title, then one scene per stop, in order. Each
  stop's camera move, pin and card start with its scene. With fewer scenes, stops share the
  time evenly.

## Product placement
Renders `<AdWeave>`: end card, mid-roll card or sponsor mention. For native integration,
make the tour itself the product's (a travel app's route, a brand's shop locations).

## Forking ideas
Put `media.scenes[i].video` photos into the card instead of the illustration, add a second
route colour for a return trip, or swap the landmass for a traced country outline.
