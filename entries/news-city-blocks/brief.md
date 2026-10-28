# News City Blocks

**Use it for:** geography news recaps where every story happens somewhere: renamed cities and
countries, new capitals, border and map changes, city records, infrastructure openings, a
"world desk" roundup of the week. Also a place-based "context" or "evidence" beat inside a
longer video ("here is where it happened").

**Do not use it for:** a single deep story (use `news-headline-highlight`), routes between
places (use `explainer-route-trace`), rankings, or made-up news. Every story must be real and
checkable.

## How it looks
A miniature isometric city floats on a plate: blocks with lit windows, parks, a river with
boats, two bridges and couriers running along the main roads. On the opening the blocks grow
out of the plate in a wave, numbered pins drop onto the story towers and the title pops in
over the overview. Then, for each story, the camera flies to its tower, which rises with a
beacon beam and pulse rings; the pin opens to show the place name and icon, and a news card
shows the region chip, the headline, one line of context, an optional counting figure and a
progress bar. A live ticker scrolls every headline across the top. Lighting: `night` (navy,
lit windows), `dusk` (violet and orange) or `day` (light).

## Filling the props
- `title`: ≤ 6 words, e.g. "The map got new names".
- `edition`: the desk and period, e.g. "World desk · 2022". Empty to hide.
- `stories`: 2–6, in narration order. For each one:
  - `place`: where it happened, ≤ 28 characters, e.g. "Astana, Kazakhstan".
  - `region`: 1–2 words, e.g. "Central Asia", "Europe", "Borders".
  - `headline`: ≤ 8 words, what happened.
  - `detail`: one short sentence of context (≤ 18 words), or empty.
  - `icon`: from the kit icon list: `pin`, `flag`, `building`, `map`, `globe`, `mountain`,
    `wave`, `car`, `house`, `leaf`...
  - `figure`: optional real number, e.g. `{"value": 55, "unit": "years", "label": "after
    independence"}`. Leave it out rather than guess.
- `timeOfDay`: `night`, `dusk` or `day`.
- `showCaptions`: word-synced captions at the bottom (the shared look draws its own).
- Narration: one optional intro scene, then exactly one scene per story. 4–7 s per story
  gives the camera time to fly and the card time to read.
- Scene images, when present, show as a strip at the top of that story's card.

## Product placement
`<AdWeave>`: `end-card`, `mid-roll-card` and `sponsor-mention` suit a news desk. With
`native-integrated`, the user's own opening or location can be one of the stories, written as
news.

## Forking ideas
Add a day-to-night cycle across the video, label the river and districts, swap the plate for
a coastline, or end on a pull-back overview that lists every place.
