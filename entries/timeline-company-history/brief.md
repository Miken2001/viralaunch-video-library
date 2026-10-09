# Company History Timeline

**Use it for:** the history of a company, brand or product line over years or decades:
founding, first products, launches, acquisitions, restructures, IPOs, records and growth
numbers. Works as the whole video ("the history of X in 60 seconds") or as the context or
evidence beat of a longer business, tech or finance video.

**Do not use it for:** content without dates, or deep time / dynasties (use
`timeline-deep-time` or `timeline-eras`).

## How it looks
Opens with the company name, a year span that counts from the first to the last milestone and
the title. Then each milestone takes the stage: a pill-shaped year badge (company name + YEAR)
rolls its digits like an odometer to the new year, a date chip ("• JULY 15, 1983 • LAUNCHED")
drops in, and the milestone card swings in from the right while the previous one swings out
to the left. Below the card, a one-line explanation resolves from blur. Along the bottom a
year rail with a tick ruler marks every milestone; an accent line and a pointer travel to the
current year. Four card designs:
- `document`: a founding certificate / press release on paper, serif name, date and a seal
  that draws itself around a line icon.
- `product`: a spotlit floating plate with the image of the narration scene playing at that
  moment (product shot, logo, store photo), shown whole; with no image, a drawn icon medallion.
- `stat`: a growth number that counts up, with its unit and what it measures.
- `branch`: the headline in a parent box with connectors drawing down into 2–3 boxes
  (new parent company, subsidiaries, a merger's partners, a spin-off).
Any card can get a rubber `stamp` that slams on ("PUBLIC", "SOLD OUT"). The scene images also
glow, heavily blurred, in the background. Palettes: `studio` (light), `boardroom` (dark navy),
`heritage` (warm paper).

## Filling the props
- `company`: the name for the year badge, max 24 characters ("Nintendo").
- `title`: one line, max 60 characters. Wrap one word in `*asterisks*` to colour it.
- `milestones`: 3–10, oldest first. For each one:
  - `year`: whole number (1998). `date`: exact date if known ("September 4, 1998"), else `""`.
  - `tag`: one or two words for what happened: Founded, Launched, Acquired, IPO, Renamed, Record.
  - `headline`: max 40 characters, usually a name ("Google Inc.", "iPhone", "Alphabet").
  - `detail`: one plain sentence, max 110 characters.
  - `card`: `document` for foundings, incorporations, renamings, deals; `product` for launches
    (give the matching narration scene an image); `stat` for growth numbers; `branch` for a
    new parent company, subsidiaries or a merger.
  - `stat` (only with `card: "stat"`): `value` (118.69), `decimals` (0–2), `prefix` ("$" or
    ""), `unit` ("M", "bn", "%", "stores"), `label` ("units sold worldwide").
  - `branches` (only with `card: "branch"`): 2–3 short names, e.g. `["Google", "Other Bets"]`.
  - `stamp`: optional, max 14 characters. Usually `""`.
  - `icon`: e.g. `building`, `rocket`, `phone`, `chip`, `cart`, `money`, `chart`, `globe`,
    `people`, `trophy`, `code`, `car`.
- `palette`: `studio`, `boardroom` or `heritage`.
- Only use facts you are sure of: real dates, real numbers.
- Narration: one scene per milestone, plus an optional first scene for the title. Each
  milestone stays on screen for its scene; with fewer scenes than milestones the time is split
  evenly. A milestone's image is the image of the scene playing when it appears.

## Product placement
Renders `<AdWeave>`: end card, mid-roll card or sponsor mention for topic videos. For
`native-integrated`, the milestones are the brand's own history and its product shots.

## In a sequence
Follows the shared look (background, surfaces, accent, fonts, texture). On dark looks the
document card stays a light paper inked in the look's background colour. The year rail and
all cards sit above the shared caption band.

## Forking ideas
A per-milestone logo in the year badge, a revenue line chart that grows along the rail, or a
"then vs now" split card.
