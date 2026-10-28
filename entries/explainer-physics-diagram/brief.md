# Pipeline Schematic Explainer

**Use it for:** explaining how something in film, music, games or TV gets made, stage by
stage: how an animated film is produced, how a song goes from demo to release, how a video
game is built, how a TV series is written and shot, how award votes are counted, how a
concert tour is staged. Works as a whole short explainer or as the "how it works" segment of
a longer culture or entertainment video. Any other process with 2–6 ordered stages (a tech
or business pipeline) fits too.

**Do not use it for:** stories with characters, timelines of dates (use a timeline entry) or
chart-heavy data. Everything named must be real and checkable; when unsure, use general
wording ("many months", "thousands of frames").

## How it looks
A deep-navy technical schematic, like a lab explainer. Top left: a small accent eyebrow
("— STAGE 2 · LAYOUT") over a bold headline. Left column: up to three bullet lines with
accent chevrons that slide in one by one, and an optional counter card (big number counting
up, unit and label). Right (or middle in portrait): a rounded schematic panel with a dot grid,
where every stage is a module on a glowing rail. Packets stream along the rail into the
active module; the camera glides from module to module as the steps change; the active module
lights up, draws its line icon and sends out pulse rings; finished modules keep a dot. A
bottom stepper lists every stage and fills up to the current one.

With one extra first narration line, a title card opens: kicker, title, subtitle and an
overview row of every stage icon, joined by a rail that draws across.

## Timing
- One narration line per step. One more line than steps → the first line is the title card.
- With fewer lines than steps, the steps share the time evenly.
- Bullets and the counter appear evenly through each step; the panel glides to the new stage
  in under a second. Content ends before the end card.

## Filling the props
- `kicker`: small series label, e.g. "How it's made · Music" (optional).
- `title`: ≤ 60 chars, e.g. "How a *hit song* is made". Wrap one word in `*asterisks*` to
  colour it. `subtitle`: optional one-liner.
- `stages`: 2–6 items, left to right, each with:
  - `name` ≤ 18 chars ("Demo", "Recording", "Mixing", "Mastering", "Release").
  - `icon`: one of the kit icons, e.g. music, camera, book, chat, people, person, bulb,
    star, trophy, chip, gear, calendar, money, globe, phone, spark.
  - `tag`: optional ≤ 24-char mono line, e.g. "in the studio".
- `steps`: 1–8 items, one per narration line, each with:
  - `stage`: stage number (1 = first stage). Leave out to use the step order. Two steps may
    point at the same stage.
  - `heading`: ≤ 56 chars, one `*word*` coloured.
  - `points`: 1–3 bullet lines, ≤ 72 chars each, in the order the narration says them.
  - `stat` (optional): `value` (a real number), `decimals`, `unit` (≤ 10 chars) and `label`
    (≤ 48 chars, what the number means).
- `flowLabel`: optional ≤ 18-char name of what flows down the rail ("Shots", "Tracks").
- `palette`: `midnight` (default, navy and electric blue), `graphite` (black and orange) or
  `studio` (light grey and blue).
- `showCaptions`: subtitles at the bottom on or off.

## Product placement
`<AdWeave>`: end-card or sponsor-mention fit streaming services, creative software, music
and film schools, and gear brands; mid-roll-card also works.

## Forking ideas
Branch the rail (parallel departments that merge), add a zoom-in "inside the module" view per
stage, or show real stills on the modules with `media` scene images.
