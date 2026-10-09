# Mosaic Reveal Documentary

**Use it for:** myths, gods and sacred symbols, religious art, the story behind a mosaic, icon,
stained-glass window or fresco, and art history in general: "symbols in early Christian art",
"the Egyptian sun god Ra", "Norse creation myth", "how Byzantine gold mosaics were made".
Works with scene images (paintings, photos of mosaics or windows) or with no images at all.

**Do not use it for:** modern product stories, data and statistics (use data-story-bars), or long
chains of dates (use timeline-eras).

## How it looks
A mosaic hangs on a dark gallery wall under a soft spotlight. A tiled border lays itself
clockwise, then glass and gold tesserae fly in (spiralling, streaming from a corner, rising
from below or settling from everywhere) and click into their cells, each landing with a gold
flash. With a scene image, the tiles take the image's colours, so the picture appears as a
true mosaic. Without one, the tiles draw a motif (sun, moon, star, tree, bird, fish, waves,
haloed figure, eye, lotus or rosette) on a gold or coloured ground. When the narration moves
on, the old tiles lift away like a flock as the next picture's tiles arrive. Light ripples
across the glass, gold glints twinkle, and a gold sheen sweeps over each finished panel. Under
the panel (beside it in landscape) a cream museum label shows "PANEL 02 / 05", the label title
rising word by word, a note in italics and the narration as quiet serif captions.

## Filling the props
- `title`: the gallery title shown small at the top for the whole film, 2–6 words
  ("Symbols in Early Christian Art"). Use "" to hide it.
- `panels`: one `{label, note, motif}` per narration scene, in the same order.
  - `label`: 1–6 words, like a museum label title ("The Dove", "Ra's Solar Barque").
  - `note`: one short line: place and date, or the meaning ("Ravenna, 5th century").
  - `motif`: only used when the scene has no image. Pick the closest: `sun`, `moon`
    (crescent and stars), `star`, `tree` (tree of life), `bird` (dove, crane, phoenix),
    `fish`, `waves` (sea, flood, creation), `halo` (saint, god or king), `eye` (all-seeing
    eye, Horus), `lotus`, `rosette` (pattern, wheel, flower).
- `palette`: `byzantine` (gold ground, lapis and red), `lapis` (night blue with gold),
  `roman` (white marble, terracotta, black), `cathedral` (stained-glass jewel tones).
- `tiles`: `fine`, `medium` or `bold`. `bold` reads best on small screens and simple motifs.
- `assembly`: `mixed` changes the arrival every scene; or fix one of `swirl`, `sweep`,
  `rise`, `scatter`.
- `showCaptions`: word captions on the label.
- Give each scene 4–8 seconds of narration so the tiles finish landing. Use facts you can
  check; say "tradition holds" or "according to the myth" for legend.

## Product placement
Renders `<AdWeave>`: end-card, mid-roll-card or sponsor-mention suit museums, books, courses
and history channels. No native placement.

## In a sequence
Themeable: with a shared look the wall, bed, label card, text and gold follow the look and the
tile colours lean toward it, while scene images keep their own colours. Panel and label stay
above the shared caption band. Good as the hook (first panel assembling) or as the context and
explanation beats of a myth or art-history video.

## Forking ideas
Add more motifs (serpent, mountain, ship), a curved andamento ground that follows the figure,
or a stained-glass mode with backlight bloom and lead lines.
