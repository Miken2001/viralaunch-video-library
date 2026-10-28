# Cosmic Zoom-Out

**Use it for:** "where are we in the universe" stories — a pull-back from one place on Earth
through planet, Moon, Solar System, nearby stars and galaxies to the observable universe. Also
any space story that widens step by step: from a launch site to orbit, from a planet to its
star system, from the Sun to the Milky Way. Works as a hook ("zoom out with me"), as context
inside a longer space video, or as the payoff that puts everything in perspective.

**Do not use it for:** side-by-side size comparisons of objects (use `space-scale-ladder`),
timelines, or anything that is not about nested scales.

## How it looks
- One unbroken camera move. Each level is drawn on its own (land and sea from above, a globe,
  an orbit, a star with planets, a star chart, a spiral galaxy, a galaxy group, the cosmic web
  with its glowing boundary). The previous level shrinks into the next one, so the starting
  place is never lost, and a pulsing "you are here" marker keeps pointing at it.
- The opening line resolves from blur over the first level, then a minimal readout (top left)
  writes in for each level: counter, name, size, one note.
- A scale ruler along the bottom fills as the camera pulls back; soft light leaks bloom on
  every jump; slowly wheeling background stars, dust, vignette and grain.
- Pinned names (moons, planets, neighbour stars, galaxies) fade in on the drawing.
- Palettes: `deep` (blue), `aurora` (green), `ember` (warm), `mono`. Inside a multi-template
  video it takes colours and fonts from the shared look (light looks become an ink star chart).

## Filling the props
- `title`: the opening line, max ~8 words. Wrap one word in `*asterisks*` to highlight it.
- `homeLabel`: the marker text, usually "You are here" (or the place: "Cape Canaveral").
- `levels`: 3–8 levels, **smallest first**. For each level:
  - `name`: short name of the scale ("The Milky Way").
  - `span`: the size or distance readout ("about 100,000 light-years across").
  - `note`: one extra fact line, or "".
  - `view`: pick the drawing that matches the scale, normally in this order:
    `surface` (a place on the ground) → `planet` → `orbit` (planet and moon) →
    `system` (star and planets) → `stars` (nearby stars) → `galaxy` → `group`
    (galaxy group/cluster) → `web` (observable universe). You may skip views.
  - `labels`: up to 4 names to pin on the drawing. `orbit`: the moon first. `system`: the
    star first, then three inner planets. `stars`: neighbour stars. `galaxy`: satellite
    galaxies. `group`: member galaxies, biggest first. Leave `[]` when unsure.
- Narration: one scene per level, in the same order (an optional extra first scene becomes an
  intro over the first level). One short sentence each, stating the level's fact.
- The zoom between levels is a depiction, not to scale; the true numbers go in `span`/`note`.
  Every number must be real and checkable.
- `palette`: `deep` by default; `mono` for a sober documentary feel; `ember` for warm stories.

## Product placement
Honours `media.adWeave` with the kit's `<AdWeave>`: `end-card`, `sponsor-mention`,
`mid-roll-card` or none. Keep the narration on the science; never name the product inside the
levels unless the item is native-integrated.

## Forking ideas
Reverse it into a zoom-in (universe → galaxy → star → planet → city), add a light-travel
timer that counts the light-time of each level, or add a `ship` view for spaceflight stories.
