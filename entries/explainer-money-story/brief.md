# Money Story: Value Line Explainer

**Use it for:** explaining a money idea as a short story over time — what a price did after an
event, how inflation eats a dollar, a stock or index through its big moments, a savings balance
growing, a currency's rise and fall, the cost of something across decades.

**Do not use it for:** numbers you cannot check. Every `value` must be real (or the example must
say plainly it is illustrative). Not for comparing many items at one moment (use
`data-story-bars`), and not for advice ("buy now") or price predictions.

## How it looks
Warm black and gold by default. A typed dateline and the story title open the segment. Then a
chart builds on one side, with a short time chip for each beat on its axis. For every beat, a
line icon draws itself, the time marker and headline slide in, and the value line travels to
the new point. It wanders a little on the way, like a real price. Going up uses the accent
colour, going down turns red. A glowing head dot pulses when it lands, a tag pins the beat's
note to the point, and a big counter ticks from the old value to the new one, with a +% / x-times
badge. The camera drifts after the line and bumps a little at each landing. An optional
takeaway replaces the last headline. Wide frames put the story on the left and the chart on
the right. Tall and square frames stack the story above the chart.
Palettes: `amber`, `ledger` (light), `mint`, `midnight`.

## Filling the props (fill tier)
- Write one narration scene per beat. Add one extra first scene to get a title card
  (e.g. 6 scenes for 5 beats).
- `title`: the story in a few words ("Gold after the dollar left it").
- `metric.label`: what the numbers are, with the unit ("Gold, US$ per troy ounce").
  `prefix`/`suffix` wrap every number ("$", "%", " bn"). `decimals` 0-2.
- `beats` (2-7, oldest first). `label` is a short time marker (≤ 10 chars, e.g. "1971",
  "Q3 2022", "Day 3"). `headline` says what happened in ≤ 9 words; put *asterisks* around one
  key word. `value` is the number at that moment (same unit for all beats). `note` (≤ 28 chars)
  is a tag on the point ("Record high"). `icon` comes from the kit list (money, chart, building,
  fire, globe, lock, shield, clock, house, cart...).
- `takeaway`: one closing sentence (≤ 70 chars). Leave it empty to end on the last beat.
- `source`: where the numbers come from ("LBMA gold price", "US BLS CPI").

## Product placement
`<AdWeave>` handles end-card, mid-roll, and sponsor-mention, and the content finishes before
the end card. For native-integrated, a finance app can chart the user's own approved, real
numbers (e.g. "Your savings, month by month").

## Forking ideas
Add a second line (e.g. price vs. inflation-adjusted price). Switch the y-axis to log scale
for very long histories. Add a ring gauge for supply-capped assets. Let beats carry images
from `media.scenes[i].video` behind the chart.
