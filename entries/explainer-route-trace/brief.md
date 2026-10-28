# Route Trace Explainer

**Use it for:** explaining a sports course or route stretch by stretch: a marathon or ultra
course, a Tour de France stage, an F1 or MotoGP circuit lap, a triathlon leg, a trail race, a
famous climb, a training-run loop. Works as a standalone short or as the "how the course
works" segment of a longer sports video.

**Do not use it for:** turn-by-turn navigation or anything that needs an accurate map. The
line is a stylised trace of the route's form, not a survey map. Every distance, place and
elevation must be real and checkable; leave `elevation` out when you do not know it.

## How it looks
Dark topographic terrain (contour rings, a lake, faint roads). The whole course draws first
as a dotted ghost line over the title. Then the camera zooms in and follows a glowing runner
dot; the travelled part of the route lights up in the accent colour. Each narration line
gets one checkpoint: a card wipes in (icon draws, distance marker, label, note), the dot
travels there, the numbered marker pops and a label pill appears on the map. Live tiles
count distance, elevation (or % progress) and checkpoints; a profile strip fills behind a
cursor. After the last checkpoint the camera pulls back to show the whole course.

## Timing
- With one more narration line than checkpoints, the first line is the title intro.
- Otherwise each line maps to one checkpoint; with fewer lines than checkpoints they are
  spread evenly. Content finishes before the end card.

## Filling the props
- `title`: the route or course name ("The Boston Marathon Course", "Stage 21: Champs-Élysées").
- `kicker`: short label, e.g. "Marathon · Point to point", "Circuit · 5.4 km".
- `unit`: `km` or `mi`. `total`: full length in that unit.
- `route.shape`: `loop`, `point-to-point`, `out-and-back`, `figure-eight` or `circuit`.
  Optionally `route.points`: 3–24 `{x, y}` points on a 0–100 grid (y down) roughly tracing
  the real route; leave empty if unsure.
- `checkpoints`: 2–8 items in distance order, one per narration line. `at` = distance from
  the start in `unit` (≤ `total`), `label` ≤ 28 chars, `note` one factual line ≤ 70 chars,
  `icon` from the kit list (flag, mountain, fire, trophy, clock, wave, building, star,
  people, pin...). `elevation` (metres for km, feet for mi) only when known; the profile
  draws when 2+ checkpoints have it, otherwise a progress rail is shown.
- `palette`: `night` (navy/orange), `track` (black/lime), `glacier` (light/red).
- Narration: one line per checkpoint describing that stretch ("At mile 16 the Newton hills
  begin").

## Product placement
`<AdWeave>`: end-card or sponsor-mention suit running apps, gear and race organisers;
mid-roll-card also works.

## Forking ideas
Add pace/split bars per segment, a second runner dot for a head-to-head, real lat/lon
projection, or photo stills per checkpoint inside the card.
