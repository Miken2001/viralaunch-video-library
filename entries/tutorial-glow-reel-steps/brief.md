# Glow Reel Steps

**Use it for:** fast, high-energy step-by-step tutorials about music, film, games, streaming,
fandoms and pop culture: building a playlist, starting a film club, setting up a stream,
getting into a new game, planning a watch party, making fan edits. Also fits light tech and
creator how-tos where each step is a short command plus a few checks. Works as a whole short
or as the "here is how" beat of a longer video.

**Do not use it for:** rankings (use `listicle-countdown`), calm or warm how-tos (use
`tutorial-creator-howto`), money maths (use `tutorial-finance-money-steps`), sports plays
(use `tutorial-sports-play-steps`), or medical and legal advice.

## How it looks
A saturated motion-reel frame: a bright glowing core in the middle of a deep colour field,
drifting bloom, dust particles and a HUD frame (corner brackets, topic label, step count,
timecode). The opening flies through warp-speed streaks into the core; the kicker settles,
the title smears in word by word with a glow, and the steps print as numbered HUD rows. Each
step lands with a camera hit (punch-in plus a short shake) and light leaks on the cut: a step
counter, the headline smearing in, a glowing emblem whose icon draws itself inside a spinning
orbit of sparkles, and a navy terminal card that types the step name and prints each checklist
line with a tick. An optional finale bursts warp streaks again, shows a sparkle emblem, the
closing line and one tick per step. If a scene has an image it sits behind the step as a
faint tinted plate. In landscape the emblem sits left and the text and terminal sit right.

## Filling the props
- `title`: what the viewer will learn, max 44 characters, e.g. `Build a *party* playlist`.
  Wrap 1–2 words in `*asterisks*` to light them in the accent colour.
- `kicker`: a 1–3 word topic label, e.g. "Music basics", "Film club", "Game night".
- `steps`: 2–6 steps, in order. Each has:
  - `label`: short step name (max 30), typed into the terminal and listed in the intro.
  - `headline`: a punchy instruction (max 36) with 1–2 `*accent*` words.
  - `items`: 0–3 short lines (max 32 each) that print with a tick.
  - `icon`: one of the kit line icons, e.g. music, camera, book, star, heart, people,
    calendar, clock, chat, trophy, target, spark, check, chart.
- `finale`: closing line (max 40) for a last scene after the steps, e.g. "Now press
  *play*." Use "" for none.
- `palette`: `electric` (cobalt blue, ice-cyan accent), `violet` (ultraviolet, pink accent)
  or `night` (deep teal-black, mint accent).
- Narration: scene 1 is the title, then one scene per step, then (optional) one finale scene of
  at least 4.5 seconds (with an end card, the last 2.5 seconds belong to the brand card). With exactly one scene per step there is no title scene. Give each step scene at
  least 4 seconds so the typing and ticks read.

Keep the advice real and widely accepted; do not invent statistics or quote people.

## Product placement
`<AdWeave>`: end-card fits best ("get the full guide"); sponsor-mention and mid-roll-card
also work.

## Forking ideas
Add a node graph that wires "input" to "output" between steps, a timer chip for steps that
take time, a kinetic one-word interstitial between steps, or a logo reveal for the finale.
