# Countdown Listicle

**Use it for:** rankings, "N things you didn't know", tips, records, top-N of anything —
any subject. Fast, loud, scroll-stopping.

**Do not use it for:** nuanced stories or anything that needs a map or timeline.

## How it looks
Intro card with the count and title, then one full-screen item per rank counting down to
#1: the rank number crashes in (with a short shake), the title and one-line "why" slide up.
When a scene has an image (one scene per item, plus an optional intro scene) it fills the
background under a color gradient; otherwise a bold color field. Palettes: `heat`,
`ocean`, `forest`, `mono`.

## Filling the props (fill tier)
- `items`: 3–10, written in **countdown order** — first item is #N, last is #1.
- Titles ≤ 4 words; `why` is one concrete, verifiable line.
- Narration: an optional intro scene, then one scene per item.

## Product placement
`<AdWeave>`: `mid-roll-card` fits naturally between ranks; end-card and sponsor-mention work
too. Never make the product one of the ranked items unless the item is native-integrated.

## Forking ideas
Add a progress bar of ranks, swap the crash for a whip transition, or show a small map pin
per item for geography rankings.
