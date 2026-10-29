# Ink and Gold Chapter Timeline

**Use it for:** culture and entertainment history told in chapters: the eras of cinema, how a
music genre grew, the history of video games, animation, fashion, theatre, comics or an art
movement. Works as the whole video ("six turns in cinema") or as the context, explanation or
payoff beat of a longer culture or history video.

**Do not use it for:** company business history with numbers (use `timeline-company-history`),
battles and maps (use `timeline-battle-map`), deep geological time (use `timeline-deep-time`),
or content with no order in time.

## How it looks
A chaptered chronicle that alternates two styles. **Gold plates**: deep black with drifting gold
dust, a brush ring (ensō) drawing itself and turning, a big chapter numeral with a light sweep
across the gold, a red seal block that stamps in with the seal word stacked vertically, and the
chapter title blurring into focus in gold serif, with a brushed underline and a detail line.
**Ink plates**: warm paper with ink-wash mountains drifting slowly, an ink wash blooming behind a
line drawing that draws itself over drawn water ripples, a small seal stamping beside the date
and the title rising word by word in a display serif. Each chapter arrives with a jagged
brush-edge wipe (and a warm light leak on gold plates). Throughout, a header shows the title and
the current chapter, a vertical date tag hangs top right, and a ruler at the bottom ticks off
every chapter while a seal-coloured playhead walks from era to era. The opening title card says
how many chapters follow and the span from the first to the last date.

## Filling the props
- `title`: one line, max 44 characters. Wrap one word in `*asterisks*` to colour it
  ("Six turns in *cinema*").
- `subtitle`: optional small line under the title, max 60 characters, or `""`.
- `chapters`: 3–8, oldest first. For each one:
  - `when`: the date as it reads on screen, max 16 characters: `"1977"`, `"1950s"`,
    `"1890–1920"`.
  - `title`: the era or moment, max 32 characters ("The talkies", "Rock and roll").
  - `detail`: one short plain sentence, max 110 characters, or `""`.
  - `seal`: one short uppercase word (max 10 characters, 4–6 reads best) for the red stamp:
    `"BIRTH"`, `"SOUND"`, `"BOOM"`. `""` shows the chapter number.
  - `icon`: line drawing on ink chapters: `music`, `camera`, `book`, `star`, `trophy`,
    `heart`, `people`, `chat`, `building`, `globe`, `spark`, `fire`, `sun`, `chip`, `house`,
    `phone`, `ball`, `mountain`, `wave`.
- `styleMode`: `alternate` (default, ink and gold take turns), `gold` (all gold-on-black) or
  `ink` (all ink on paper).
- `sealColor`: `vermilion` (default), `jade` or `indigo`.
- `showCaptions`: `true` unless the video has no narration.
- Only use facts you are sure of: real dates, real names.
- Narration: one scene for the title, then one scene per chapter. With exactly one scene per
  chapter, a short title card plays over the first scene; with fewer scenes the time is split
  evenly. A scene image, when present, shows as a sepia backdrop on gold chapters and inside an
  ink circle on ink chapters (in place of the icon).

## Product placement
Renders `<AdWeave>`: end card, mid-roll card or sponsor mention for topic videos. For
`native-integrated`, the chapters are the brand's own story (first release, big hits, today).

## In a sequence
Follows the shared look: the gold plate uses the look's background and accent, the ink plate its
surface and line colour, and the seal uses the accent. The ruler moves up above the shared
caption band and all chapter content sits above it; the template draws no captions of its own.

## Forking ideas
A score-driven version where each chapter's motion speeds up with the era, scroll-unrolling
chapters instead of brush wipes, or a split-screen "then and now" plate.
