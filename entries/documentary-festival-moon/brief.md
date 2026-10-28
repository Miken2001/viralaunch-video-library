# Ink-Wash Moon Documentary

**Use it for:** calm, story-led space documentaries told as a painted scroll — the Moon and its
phases, eclipses, lunar missions, moon myths and calendars, the Sun, Saturn and other ringed
planets. It also works as a reflective opener or closer inside a longer space video.

**Do not use it for:** fast data comparisons (use data-story-bars or space-scale-ladder), maps of
places on Earth (use map-orbit-night-earth) or anything that needs many on-screen words per scene.

## How it looks
An ink-wash painting: layered misty peaks (or islands, or hills) over still water, a plum branch
growing in from the corner, birds crossing, a small boat with a watcher. The orb rises behind the
peaks under the title, then each chapter changes its phase (the shadow glides to the new phase on
the narration cut) while the camera pans with parallax. Each chapter writes its heading vertically
down the right side under a red seal with the chapter number. A brush-drawn ensō circle frames the
scene's image (when there is one) or a figure that counts up.

## Filling the props (fill tier)
- `title`: 1–5 words, e.g. "Our Moon". `subtitle`: one short italic line, or "".
- `chapters`: exactly one per narration scene, in order. The first chapter shows after the title.
  - `heading`: 1–3 words (≤ 26 characters), e.g. "The Distance", "Apollo 11".
  - `phase`: how the orb looks in that chapter. Use real phases when you talk about them; use
    `eclipse` for a lunar eclipse (red moon) or, with `orb: "sun"`, a total solar eclipse.
  - `stat`: a real number with `unit` and `label`, or `null`. Years go in the heading, not here.
- `orb`: `moon` (default), `sun` or `ringed-planet`. `scenery`: `mountains`, `sea` or `hills`.
- `palette`: `rice-paper` (light paper), `indigo-night` or `ember-dusk` (dark, with stars).
- Narration: one calm sentence or two per scene, 4–7 seconds each. Scene images are optional;
  when present they appear inside the ensō circle.

## Product placement
`<AdWeave>`: end card, mid-roll card or a sponsor lower third. Keep the story itself on-topic.

## Forking ideas
Add a lantern festival (rising lanterns as particles), a calendar wheel of the year's full moons,
or swap the orb for Earth seen from the Moon.
