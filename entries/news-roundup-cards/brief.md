# News Roundup Cards

**Use it for:** daily or weekly roundups of any beat: new game, film, album or series
releases, tech launches, match-day results, company news, science headlines. Also a quick
"evidence" beat inside a longer video ("here's what happened this week").

**Do not use it for:** a single deep story (use `news-headline-highlight`), rankings
(use `listicle-countdown`) or made-up news. Every story must be real and checkable.

## How it looks
An intro shows the story count, the period, the roundup title and the categories covered.
Then one card per story, swapped by a two-tone diagonal wipe. Each card has a header bar
with the title and a progress segment per story, filled category and date chips, a big
headline, a "THE TAKEAWAY" line, up to three numbered points revealed one by one and a
source line. A side panel shows the story's scene image or, when there is none, a drawn
emblem with rotating rings around the story's line icon. An optional figure counts up in
the panel. Palettes: `midnight` (navy and cyan), `graphite` (black and orange), `violet`
(purple and lime) and `paper` (light).

## Filling the props
- `title`: ≤ 6 words, e.g. "This week in film". `period`: the dates covered, e.g. "Sep 25-26".
- `stories`: 2–8, in narration order. For each one:
  - `headline`: ≤ 7 words (the title or event name works).
  - `category`: 1–2 words, uppercase-friendly ("PC GAME", "FILM", "STREAMING").
  - `date`: display text such as "Nov 9, 2004".
  - `takeaway`: one sentence, the thing to remember.
  - `points`: 0–3 facts, each under 9 words.
  - `icon`: pick from the kit icon list (`trophy`, `music`, `camera`, `chip`, `globe`...).
  - `figure`: optional real number with `prefix`, `unit` and `label`, e.g.
    `{"value": 125, "prefix": "$", "unit": "M", "label": "first-day sales"}`. Leave it out
    rather than guess.
  - `source`: short attribution, e.g. "Source: Nintendo".
- Narration: one optional intro scene, then exactly one scene per story. Each card stays
  up for its scene. 3–6 s per story works well.
- Scene images, when present, fill the side panel of their story.

## Product placement
`<AdWeave>`: `sponsor-mention` and `mid-roll-card` suit a news show. With
`native-integrated`, the user's own release can be one of the stories, written as news.

## Forking ideas
Add a ticker under the header, a price/score badge row like a store page, or a final
"what to watch" summary card listing every headline.
