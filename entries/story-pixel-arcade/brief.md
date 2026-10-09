# Pixel Arcade Story

**Use it for:** stories told as a retro video game: kids' science ("the water cycle in 4
levels"), history and space missions as stages, a game's or a gamer's story, "level up" life
lessons, any process with 2–8 stages that benefits from a playful, nostalgic frame.

**Do not use it for:** serious or tragic subjects (disasters, war casualties, illness), dense
data, or anything that needs real photos (use a documentary or data-story entry).

## How it looks
A 16-bit side-scroller. A start screen shows the title with "PRESS START". Each level is a
parallax pixel world (space, city, forest, ocean, desert, cave, sky) with a striped track; the
hero runs, auto-jumps hazards and grabs items while a pixel dialog box pops in with the level
name and one line of text. A HUD shows score (counts up as items are collected), level pips and
hearts. Levels change with an arcade block wipe. A level marked `hit` costs a heart (blink,
shake, flash). The last seconds show the `ending` banner with the final score and pixel
confetti. Palettes: `nebula`, `gameboy`, `sunset`, `arcade`. It works in 16:9, 9:16 and 1:1.

## Filling the props
- `title`: the game title, max 40 characters. Wrap one word in `*asterisks*` to colour it.
- `hero`: `runner`, `astronaut`, `robot` or `cat`. Pick the one that fits the story.
- `levels`: 2–8 levels in story order. Write **one narration scene per level**, plus an
  optional first scene for the start screen (then scene 1 = level 1, and so on).
  - `name`: short level title (max 28 characters).
  - `text`: one sentence the viewer reads, max 90 characters. Facts must be true.
  - `world`: `space`, `city`, `forest`, `ocean`, `desert`, `cave` or `sky`.
  - `hazard`: leave `auto`, or choose `meteor`, `block`, `spike`, `bug`, `ghost`.
  - `item`: `coin`, `star`, `gem` or `heart` (only changes the points).
  - `hit`: `true` on the level where something goes wrong in the story (at most one or two).
- `lives`: 1–5 hearts at the start (default 3).
- `ending`: final banner, e.g. `STAGE CLEAR`, `MISSION COMPLETE`, `GAME OVER`.
- `palette`: `nebula` (default), `gameboy`, `sunset`, `arcade`.
- Scenes of 4–7 seconds read best; very short levels (under 2.5 s) get few jumps.

## Product placement
Renders `<AdWeave>`: end card, mid-roll card or sponsor mention; the story stays on topic.

## Forking ideas
Add a boss level with a health bar, a new world (underwater, volcano), a two-player split
screen, or let each level's dialog show a small image from `media.scenes[i].video`.
