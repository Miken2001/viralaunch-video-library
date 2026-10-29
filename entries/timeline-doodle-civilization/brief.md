# Doodle Civilization Timeline

**Use it for:** a history told as a gentle journey, step by step: the history of computing,
the internet, phones, AI, space tech, an invention or a field of science. Works as the whole
video ("how computers shrank into our pockets") or as the context, explanation or payoff beat
of a longer tech, science or history video.

**Do not use it for:** company business history with numbers and deals (use
`timeline-company-history`), deep time or dynasties (use `timeline-deep-time` or
`timeline-eras`), or content without an order in time.

## How it looks
A storybook night drawn in soft paper layers: a starry sky, a moon, rolling hills in three
parallax layers, lollipop trees and grass tufts. The title is written in handwriting in the sky
under a spark that draws itself; then the camera comes down to the ground and a small doodle
traveller with a glowing lantern walks in. For every milestone the traveller walks right (legs
in step with the ground), the dotted trail behind lights up in the accent colour, and the
milestone grows out of the ground: a post rises, a paper medallion pops on top, its line icon
draws itself, a hand-drawn ring circles it and a small year tag swings onto the post. Built
milestones stay behind as the walk goes on, so the past fills up the landscape. Top left, the
year counts up from the previous one in big glowing handwriting with a drawn underline, the
title rises word by word and one detail line fades in. The horizon slowly warms like dawn as
the journey advances. The last milestone can **hatch**: an egg rises, wobbles, cracks and splits
open in a flash of light, rays turn and the final medallion pops out, or **glow** and light up
the sky. Palettes: `night` (blue storybook night), `dusk` (violet evening), `paper` (light
sketchbook with ink lines).

## Filling the props
- `title`: one line, max 48 characters. Wrap one word in `*asterisks*` to colour it
  ("How computers *shrank* into our pockets").
- `subtitle`: optional small line under the title, max 60 characters, or `""`.
- `milestones`: 3–9, oldest first. For each one:
  - `year`: how the date reads on screen, max 12 characters: `"1969"`, `"1940s"`,
    `"3000 BC"`. Plain years count up from the previous plain year.
  - `title`: what appeared, max 36 characters ("World Wide Web", "The transistor").
  - `detail`: one short plain sentence, max 100 characters, or `""`.
  - `icon`: a doodle that matches: `chip`, `code`, `phone`, `globe`, `mail`, `chat`,
    `rocket`, `bulb`, `brain`, `gear`, `book`, `camera`, `music`, `lock`, `chart`, `atom`,
    `spark`, `planet`, `car`, `flask`.
- `finale`: `hatch` (the last milestone is a breakthrough or a new era), `glow`, or `none`.
- `palette`: `night`, `dusk` or `paper`.
- `showCaptions`: `true` unless the video has no narration.
- Only use facts you are sure of: real years, real names.
- Narration: one scene per milestone, plus an optional first scene for the title. Each
  milestone stays on screen for its scene; with fewer scenes than milestones the time is split
  evenly. Give the last scene at least 4 seconds so the hatch can play.

## Product placement
Renders `<AdWeave>`: end card, mid-roll card or sponsor mention for topic videos. For
`native-integrated`, the milestones are the brand's own product history (versions, launches).

## In a sequence
Follows the shared look: sky, hills, paper medallions, glow and fonts come from the look's
palette (on dark looks the medallions stay light paper inked in the look's background colour).
The ground line, the medallions, the traveller and the text all sit above the shared caption
band; the kit's captions wait for the title to leave.

## Forking ideas
Little doodle crowds that gather around each milestone, a day-to-night sky cycle per era, or
an origami fold-in instead of the pop for each medallion.
