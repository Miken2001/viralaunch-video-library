# Scrolling Timeline of Eras

**Use it for:** "the history of X", milestones of a technology, a civilization's eras, a
sport's record progression, a company's or religion's story told by dates.

**Do not use it for:** content without dates (use an explainer or listicle).

## How it looks
A vertical rail scrolls from milestone to milestone; a big year counter at the top ticks to
each date; milestone cards slide in with title + one-line fact; consecutive milestones that
share an `era` get a labelled background band. Palettes: `ink`, `chalk`, `neon`, `parchment`.

## Filling the props (fill tier)
- `milestones`: 3–14, chronological. `when` is the label you want shown ("3000 BC");
  `year` is the number the counter animates to (negative for BC). Facts must be verifiable.
- Each milestone gets an equal share of the video; write roughly one narration scene per
  1–2 milestones.
- `era` groups milestones into bands; leave '' when eras don't matter.

## Product placement
Renders `<AdWeave>`: end-card / mid-roll / sponsor-mention for topic videos. For a company
timeline (native-integrated), the milestones are the product's own history.

## Forking ideas
Add a thumbnail per milestone from `media.scenes[i].video`, switch to a horizontal rail for
16:9, or zoom the year counter on the final milestone.
