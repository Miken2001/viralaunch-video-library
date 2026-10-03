# Match Recap Scoreboard

**Use it for:** recaps of a real match/game — football, basketball, hockey, rugby, esports.
Broadcast feel: score bug, event ticker, stat bars.

**Do not use it for:** anything you haven't verified. Every score, minute and scorer must
come from a reliable source; never invent sports facts.

## How it looks
A two-team score bug slams in from the top; events appear one by one on their team's side
(minute pill + icon + text); `score` events update the scoreboard with a yellow flash; if
`stats` are given, the ticker fades into mirrored possession-style bars for the last third.

## Filling the props (fill tier)
- Teams: real names, 2–4 letter `short` codes, contrasting hex colors.
- `events`: chronological, ≤ 12. Use `points` for multi-point scores. `note` for things like
  "Argentina win 4–2 on penalties" (does not change the score).
- `stats` (optional): ≤ 5 comparable numbers (possession %, shots, rebounds).

## Product placement
`<AdWeave>`: sponsor-mention reads naturally ("brought to you by"); end-card also fits.

## Forking ideas
Add a pitch/court diagram with shot locations, player headshots from scene images, or a
running game clock.
