# Deep-Time Era Ruler

**Use it for:** journeys through long spans of time told era by era: geological periods
(Triassic → Holocene), the history of life, ice ages, prehistory (Stone Age → Bronze Age),
ancient civilizations, dynasties and empires, the eras of a country.

**Do not use it for:** a few dated events inside one era (use `timeline-eras`), or content
without dates.

## How it looks
Each era gets a card: small kicker, a large serif name, the date span in the accent colour and
1–3 facts that appear one by one as the narration goes. Beside it (below it in 9:16) a drawn
illustration: a planet whose continents drift apart, a rock column with the era's layer
glowing, a landscape cross-section with a water level, or a large self-drawing line icon.
Along the bottom runs the era ruler: colour bands for every era across the whole span. On each
era the camera "zooms": a bracket opens from the era's slice of the full ruler to a detail
ruler with its own ticks, a date pin travels from the era's start to its end and counts the
date, and the header shows the zoom factor. In `years-ago` mode the full ruler is logarithmic,
so 250 million years and the last 10,000 years fit on one bar. Opens with a title over the
ruler drawing itself.

## Filling the props
- `title`: one line, max 60 characters. Wrap one word in `*asterisks*` to colour it.
- `axis`: `years-ago` for geology and prehistory (numbers are years before present, `0` = today);
  `calendar` for dated history (calendar years, negative for BC, e.g. `-221` for 221 BC).
- `eras`: 2–10, in chronological order, oldest first. For each era:
  - `kicker`: the larger period or group ("Mesozoic Era", "Imperial China"), or `""`.
  - `name`: the era, max 28 characters ("Jurassic", "Tang dynasty").
  - `from` / `to`: numbers in the axis unit. Years-ago: `from` is the bigger number
    (`201400000` → `145000000`). Calendar: `from` is the earlier year (`618` → `907`).
  - `span`: how the date reads on screen ("201–145 million years ago", "618–907 AD").
  - `points`: 1–3 short facts (max 80 characters each). Only facts you are sure of.
  - `visual`: `globe` (continents, plate tectonics), `strata` (rock record, extinctions,
    fossils), `terrain` (ice ages, sea level, landscapes), `icon` (anything else).
  - `icon`: used with `visual: "icon"`; e.g. `building`, `flag`, `book`, `fire`, `leaf`,
    `mountain`, `globe`, `star`, `trophy`, `people`.
- `palette`: `earth` (warm dark), `abyss` (deep teal), `parchment` (light paper).
- Narration: write one scene per era, plus an optional first scene for the title. Each era
  stays on screen for its scene; with fewer scenes than eras the time is split evenly.

## Product placement
Renders `<AdWeave>`: end card, mid-roll card or sponsor mention. The eras stay on topic.

## In a sequence
Follows the shared look (colours, fonts, texture); era bands step from the look's muted tone
to its accent, and the ruler sits above the shared captions. Good as the context or
explanation beat of a history or science video.

## Forking ideas
Add an image per era from `media.scenes[i].video` inside the illustration box, a fifth
illustration (a skyline for empires, a map outline), or era group labels under the ruler.
