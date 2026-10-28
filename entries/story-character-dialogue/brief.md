# Sketchbook Dialogue: Two-Character Tech Story

**Use it for:** tech stories told as a short conversation between one or two drawn characters:
origin stories of inventions and companies (the first computer bug, the first website, how a
startup began), "what is X?" chats between a curious person and an AI or engineer, a developer's
day, a bug hunt, a product idea taking shape. It also works for business and school stories
that read well as dialogue.

**Do not use it for:** data-heavy stories (use `data-story-bars`), news, or anything that must
show real photos or real people's faces. The characters are made-up cartoon people (or a robot).

## How it looks
A 2D animated short on a sketchbook page. One or two characters with thick ink outlines stand on
a hand-drawn ground line. They blink, breathe, look at each other and at what is being drawn,
and the speaker's mouth moves with the narration. Each beat opens with a magic pencil sketching
the set behind them: a desk with a monitor of code lines, a city skyline, a row of server racks,
a dark room under the stars, or a sunset sky where the cast rides a giant paper plane. The pencil
can also draw a glowing loop and an object inside it (a chip, a lock, a bulb, code...). The
speaker acts out the line (talk, point, think, shrug, wave, cheer, shock) and their words pop
into a comic speech bubble with a name tag. Narrator beats appear as a taped paper strip at the
top. The camera drifts toward whoever is speaking. A countdown clock in the corner ticks down
the story's time, and a light leak blooms at every cut.

An extra first scene adds a title card: "A SHORT STORY", the title rising in, a pencil underline,
"starring Maya & Bit", while the cast pops in and waves.

Palettes: `sketchbook` (warm paper, orange pencil), `pastel` (cool paper, blue), `blueprint`
(dark navy, yellow).

## Filling the props
- Write **one narration scene per beat**. Add **one extra first scene** for the title card
  (e.g. 8 scenes for 7 beats).
- `title`: the story's name, at most 60 characters, e.g. "The *moth* in the machine". Put
  *asterisks* around one word to colour it.
- `cast` (1 or 2 characters): the first stands left and is speaker `"a"`, the second stands
  right and is speaker `"b"`.
  - `name`: short, e.g. "Maya", "Bit", "Dr. Lee" (at most 16 characters).
  - `style`: `hoodie` (developer, glasses), `blazer` (founder, manager), `labcoat` (scientist,
    engineer), `cap` (student, maker), `robot` (an AI or a machine).
  - `color`: olive, navy, coral, teal, plum, charcoal or mustard. Give the two characters
    different colours.
  - `skin`: light, tan, brown or deep (ignored for the robot).
- `beats` (2-8, in order):
  - `speaker`: `"a"`, `"b"` or `"narrator"`. Start with a narrator beat to set the scene, then
    alternate a and b.
  - `line`: what they say, at most 90 characters. Use the same words as that scene's narration
    or a shorter version. One *word* in asterisks gets the accent colour.
  - `place`: paper, desk, city, servers, sky or night. Keep the same place for a few beats; the
    pencil redraws only when the place changes. `sky` makes a nice happy ending.
  - `sketch`: optional object drawn between the characters: code, chip, lock, cloud, rocket,
    brain, bulb, phone, globe, search, book, gear, shield, chat, mail, chart, money, clock,
    star, trophy, target, spark (and the other kit icons). `none` for nothing.
  - `action`: talk, point (at the sketch), think, shrug, wave, cheer or shock. For narrator
    beats both characters do it.
- `timer`: `true` shows the countdown clock.
- `palette`: sketchbook, pastel or blueprint.
- `showCaptions`: leave `false` when the bubbles already show the narration.
- Facts in a true story must be real and checkable (dates, names, numbers). The characters can
  be invented narrators of a real story.

## Product placement
`<AdWeave>` handles end-card, mid-roll and sponsor-mention. The dialogue and the clock finish
before the end card. A learning app, a developer tool or a newsletter fits best.

## Forking ideas
Add more outfits (a chef, an astronaut). Add more sets (a garage, a classroom, a rocket pad).
Let the robot's face screen show the sketch icon. Add a third character, or a phone-call split
screen for characters in different places.
