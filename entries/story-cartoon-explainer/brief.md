# Cartoon Explainer: Host and Props

**Use it for:** science and how-it-works explainers for kids and families, such as states of
matter, the water cycle, how plants grow, how a battery or a magnet works, what DNA or a cell
is, why the Moon has phases, how rockets fly. It also fits simple nature, space and health facts
told in steps.

**Do not use it for:** serious news, data-heavy stories (use `data-story-bars`), real people or
real places. The host is a made-up cartoon character.

## How it looks
A Saturday-morning cartoon. Everything has thick ink outlines, the sky is flat and bright, and
rolling hills scroll past in parallax. The host (a round blob, a robot or a professor) stands on
the left. It blinks, its mouth moves with the narration, and it acts out each step: it points,
explains, thinks, waves, cheers or jumps in shock. Each step's prop sits on the right (on top in
tall frames) and moves on its own: the sun's rays turn, the plant grows and blooms, electrons
orbit the atom, the battery charges, the thermometer rises, the heart beats, the flask bubbles.
Between steps the camera pans one screen while the host walks, so the next prop slides in and
springs up. A prop can turn into another one with a cartoon "poof", e.g. ice into a drop.
Comic sound words like "ZAP!" burst next to the prop. Each step shows a "STEP n / N" badge
and an outlined heading, and the host can say a short line in a speech bubble.

An extra first scene adds a title card: a turning sunburst, the title and the host waving. An
iris then opens onto the stage. The optional takeaway takes the last heading's place while the
host cheers and confetti falls.

Palettes: `saturday` (bright), `dusk` (purple sunset), `chalk` (soft paper).

## Filling the props
- Write **one narration scene per step**. Add **one extra first scene** for the title card
  (e.g. 6 scenes for 5 steps).
- `title`: the question or topic, e.g. "Where does rain come from?". Put *asterisks* around one word.
- `host.kind`: `blob`, `robot` or `professor`. `host.name` is optional ("Pip").
- `steps` (2-7, in order):
  - `heading`: at most 6 words, with one *key* word in asterisks.
  - `line`: what the host says (at most 70 characters), short and kid-friendly. Do not repeat
    the narration word for word.
  - `prop`: the cartoon object that shows the step. Choose from sun, cloud, drop, ice, flame,
    plant, tree, atom, dna, cell, heart, magnet, bolt, bulb, battery, thermometer, flask,
    rocket, planet, moon, earth.
  - `becomes`: optional. The prop changes into this one partway through the step (ice → drop,
    cloud → drop). Use it only when the change is real science.
  - `action`: point, explain, think, wave, cheer or shock. Use `cheer` for a happy result and
    `shock` for a surprising fact.
  - `sfx`: optional comic word (at most 8 characters): "POP!", "ZAP!", "DRIP!".
- `takeaway`: optional closing line (at most 70 characters).
- Accuracy matters. Every fact must be true and checkable, explained simply. Pick props that
  do not suggest something false (for example, water vapour is invisible, so do not show it as
  a cloud).

## Product placement
`<AdWeave>` handles end-card, mid-roll and sponsor-mention, and the steps finish before the end
card. An educational brand fits best ("Lumen Tutor, science that clicks").

## Forking ideas
Add new props to `CartoonProp` (a fish, a volcano, a tooth). Give the host a second costume. Let
two props interact, such as the sun shining on a plant. Swap the hills for an underwater or
outer-space set.
