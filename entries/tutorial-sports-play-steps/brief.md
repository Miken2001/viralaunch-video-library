# Sports Play Steps

**Use it for:** teaching a play, drill or tactic step by step: basketball sets (pick and roll,
give-and-go), soccer patterns (overlap, one-two, pressing trigger), football routes, or any
sport on a blank tactics board. Works as a whole short or as the "how it works" beat of a
longer sports video.

**Do not use it for:** match results or player stats (use `match-recap-scoreboard`), or
anything that needs real footage.

## How it looks
A clean studio frame with halftone dot clouds in the corners. Scene 1 shows the title with
floating player tokens. Then a tactics-board card rises in: the court or pitch draws itself,
the markers pop in, and for each step a chapter label ("02 / USE THE SCREEN") and a headline
rise in above the board. Arrows draw first (solid = run, wavy = dribble, dashed = pass), then
the players travel along them, the ball follows the carrier or flies on the pass, and a shot
at `"goal"` ends with a pulse at the target. A cue card under the board gives the coaching tip
and a step progress bar. In landscape the board sits left and the text and step list sit right.

## Filling the props (fill tier)
- `title`: the play's name; wrap 1–2 words in `*asterisks*` for the accent colour.
- `kicker`: a short label like "Basketball playbook" (optional).
- `field`: `basketball` (half court, hoop at the top), `soccer` (attacking half, goal at the
  top), `american-football` (red zone, end zone at the top) or `plain`.
- `players`: 2–10 markers. `id` is 1–3 characters ("1", "PG", "X1"), unique. `side`:
  `attack` (filled) or `defense` (outlined). `x` 0–100 left to right; `y` 0–100 where **0 is
  the goal/hoop end at the top**. Keep markers at least ~8 units apart.
- `ballWith`: id of the player who starts with the ball (or "").
- `steps`: 2–6, in order. Each has `label` (short), `headline` (the instruction), `tip` (one
  plain coaching cue), `icon`, `moves` (who moves where; positions carry over to the next
  step; `kind: "dribble"` for the ball carrier) and `passTo` (a player id, `"goal"` for the
  shot, or "").
- Narration: write one scene for the title, then one scene per step (scene 2 = step 1). With
  exactly one scene per step there is no title card.
- `palette`: `clean` (white, blue), `night` (dark green), `court` (warm hardwood).

Only describe real, standard techniques; do not invent named plays or attribute plays to
real teams or coaches unless you are sure.

## Product placement
`<AdWeave>`: end-card fits best ("get the full playbook"); sponsor-mention also works.

## Forking ideas
Add a second team colour per side, a running shot clock, a "wrong vs right" split board, or
player photos inside the markers from scene images.
