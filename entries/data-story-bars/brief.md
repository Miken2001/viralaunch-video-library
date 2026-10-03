# Data Story: Animated Bars

**Use it for:** any story where numbers carry the point — country/city comparisons, prices,
records, survey results, market share, sports stats.

**Do not use it for:** numbers you cannot source. Never invent data; put the real source in
`source`.

## How it looks
A hero number counts up (with unit and label), then the title moves up and 3–8 labelled
bars grow one after another, sorted largest first, with values ticking up; highlighted bars
use the accent color; a takeaway line lands last; a small source line stays at the bottom.
Palettes: `graphite`, `paper`, `midnight`.

## Filling the props (fill tier)
- `headline.value` is usually the top bar or a total. `decimals` controls formatting.
- `bars`: same unit for all; mark 1–2 with `highlight` to direct the eye.
- `takeaway`: the one sentence the viewer should remember.

## Product placement
`<AdWeave>` handles end-card / mid-roll / sponsor-mention. For a finance product, a
`native-integrated` item can chart the user's own (approved, real) numbers.

## Forking ideas
Animate a bar-chart race across years (props.frames), add a line overlay, or replace bars
with a map choropleth using the map-journey-route data.
