# Tech Stack Build

**Use it for:** step-by-step tech tutorials where each step adds a piece on top of the last:
setting up a web app or API, a dev environment, a data pipeline, a home server, a CI/CD
setup, a machine-learning workflow (data, model, training, serving), a static site with a
custom domain, or "how a request travels through the layers". Works as a whole short or as
the "here is how you build it" beat of a longer video.

**Do not use it for:** steps inside one app screen (use `tutorial-app-walkthrough`), non-tech
how-tos (use `tutorial-creator-howto` or `explainer-steps-diagram`), rankings (use
`listicle-countdown`), or history of a technology (use a timeline entry).

## How it looks
A graphite studio (or deep navy, or light cream) with a receding floor grid and drifting
sparks. The intro shows a mono kicker ("Tutorial · 5 steps"), the title rising word by word,
and a terminal card that types the starting command with a block cursor. Then a 3D stack
appears on a base plate and slowly sways. Each step: a dashed blueprint of the next layer
appears, a cloud of voxel cubes flies in and snaps into place, the layer turns solid with
circuit traces drawing across its top, a pulse ring flashes and the stack settles. A leader
line runs out to a tag with an icon, number and the layer name. The text panel above (left in
landscape) shows "STEP 02 / 05", the instruction with accent words, one muted sentence and an
optional terminal chip that types a command. A progress rail at the bottom names every step
and fills as layers land. The recap orbits the camera around the finished stack.

## Filling the props
- `title`: what the viewer builds, max 48 characters, with ONE `*accent*` word, e.g.
  `Build your first *Node.js* API`.
- `command`: the command typed in the intro terminal, max 44, e.g. `mkdir hello-api`.
  "" shows only the title.
- `steps`: 2–6 steps in order; each adds one layer, bottom to top. Each has:
  - `label`: layer name, 1–2 words, max 12, e.g. "Database", "Runtime", "Deploy".
  - `title`: the instruction, max 40, with 1–2 `*accent*` words, e.g. "Add a *database*".
  - `detail`: one plain sentence, max 110, on what the step does or why. "" for none.
  - `code`: optional command or one short line of code, max 40, e.g. `npm install express`.
    Only real, correct commands. "" for none.
  - `icon`: one of code, chip, gear, lock, shield, globe, rocket, cloud, chart, search, bars,
    check, book, bulb, spark.
- `outro`: closing line on the recap, max 40, with one `*accent*` word. "" reuses the title.
- `palette`: `slate` (graphite, orange accent), `midnight` (navy, cyan) or `paper` (cream,
  red-orange).
- `showCaptions`: word-synced captions above the progress rail (default true).
- Narration: scene 1 is the intro (title + terminal), then one scene per step, then an
  optional recap scene of at least 4.5 seconds (with an end card the last 2.5 seconds belong
  to the brand card). With exactly one scene per step there is no intro. Give each step scene
  at least 4 seconds so the layer lands and the command types; say the layer name out loud.

Keep commands and facts correct for the tool you name; when unsure, use a generic tool name
and leave `code` empty. Do not invent version numbers or benchmarks.

## Product placement
`<AdWeave>`: end-card fits best ("get the starter repo"); sponsor-mention and mid-roll-card
also work. A dev tool can appear as one honest layer in `steps` when it really does that job.

## Forking ideas
Let a layer split into two side-by-side blocks (frontend / backend), draw data packets
travelling up through the stack on the recap, explode the stack apart for a "what each layer
does" beat, or add a stat readout (build time, bundle size) that counts up when a layer lands.
