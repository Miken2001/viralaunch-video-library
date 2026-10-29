# Sports App Showreel

**Use it for:** showing off a sports app, fan product or sports media brand (live scores,
fantasy, betting-free stats, club apps, fan communities), or presenting real sports data
"as seen in an app": a tournament's results, a scoring race, an award, fan reactions, one
headline number. Works as a hook or payoff beat inside a longer sports video.

**Do not use it for:** made-up results or statistics. Every score, total and name must be
real and checkable. Not for long stories with no data (use a story template).

## How it looks
A dark stage with an accent glow from above, a huge outlined app name sliding behind, and a
phone in the middle. The phone flies up from below and the app launches (icon draws in, then
zooms open) while the `title` rises above it. Each shot then swings the phone into a new 3D
pose with a light leak on the cut, the app screen whips sideways to the next view, a kinetic
headline with a numbered kicker replaces the last one, the rows land one by one, and a finger
tap highlights the first row. The tab bar follows the screen type. On the last shot an app
lockup (icon, name, `tagline`) pops over the phone. Box captions sit under the phone (in the
left column on square and landscape).

Screens:
- `scores`: result cards, "Team A vs Team B" splits into two crest initials and two lines.
- `stats`: ranked rows with counting values and bars (top scorers, records, ratings).
- `vote`: pick tiles (2 columns from 3 rows) with a check on the first, plus the `button`.
- `feed`: fan comments arriving one by one after a typing bubble; first one gets liked.
- `highlight`: a media card (the scene image, or a drawn pitch with a ball arc), one big
  counting number from row 1, and the other rows as chips.

## Filling the props
- `appName`: the product name (≤ 18 chars). `icon`: one glyph, e.g. `ball`, `trophy`, `flag`.
- `title`: the opening hook, ≤ 7 words; wrap one word in `*asterisks*` for the accent colour.
- `shots`: one per narration scene (2–8). Give the narration one extra first scene if it
  should cover the app launch; then scene 0 is the intro.
  - `headline` ≤ 7 words, one `*accent*` word. `heading` is the in-app screen title.
  - `rows` 1–5, most important first. `value` is short ("3–3", "8", "88,966"); plain numbers
    count up. `bar` 0–100 only when comparing (share of the leader, progress).
  - Mix screen types; do not repeat the same one twice in a row.
- `tagline`: optional product line for the closing lockup ("" for none, e.g. mid-sequence).
- `palette`: `volt` (lime), `court` (orange), `ice` (cyan), `turf` (green).

## Product placement
Built for `native-integrated`: the product IS the app on screen (`appName`, `icon`,
`tagline`). end-card, mid-roll-card and sponsor-mention also work through `<AdWeave>`; then
use a neutral app name for the data (e.g. the competition name).

## Forking ideas
Add a live match-clock screen, real screenshots from scene images inside the phone, or a
second phone for head-to-head comparisons.
