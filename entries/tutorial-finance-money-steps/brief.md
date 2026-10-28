# Money Steps

**Use it for:** teaching a money method step by step: a budgeting rule (50/30/20, zero-based),
building an emergency fund, a debt payoff method (snowball, avalanche), setting up automatic
saving, reading a payslip, the basics of index investing or compound interest. Works as a
whole short or as the "how to do it" beat of a longer finance video.

**Do not use it for:** market news or live prices, stock picks, or anything that needs real
footage or charts of real data over time (use `data-story-bars` for charts).

## How it looks
A dark studio frame with a faint dot grid. Across the top runs a dotted "money path" with one
glowing node per step. Scene 1 shows the kicker, the title (blur-in kinetic type) and an
"N STEPS" pill while the path draws itself. Then for each step, a glowing orb travels along the
path to that step's node, leaving a neon trail; the node lights up and pulses. Below it the
chapter label ("STEP 02 · COVER YOUR NEEDS") slides in, the headline rises word by word, the
detail fades up, the hero number counts up with a soft glow and an underline, and up to three
glass chips flip up. Steps change with a whip; a top bar shows the step counter and a small
disclaimer. In landscape the headline sits left and the figures right.

## Filling the props (fill tier)
- `title`: what the video teaches; wrap 1–2 words in `*asterisks*` for the accent colour.
- `kicker`: a short label like "Money basics" (optional).
- `steps`: 2–6, in order. Each has:
  - `label`: 1–4 words ("Know your take-home").
  - `headline`: the instruction, ≤ 56 characters; `*asterisks*` highlight words.
  - `detail`: one plain sentence (optional).
  - `icon`: money, chart, bars, calendar, clock, house, cart, shield, lock, target, check...
  - `stat` (optional): `value` (a plain number), `prefix` ("$"), `suffix` ("%", "/mo"),
    `decimals`, `label` (what the number is).
  - `chips`: 0–3 short figures with a one-word `label` ("$2,000" / "needs").
- Narration: one scene for the title, then one scene per step (scene 2 = step 1). With exactly
  one scene per step there is no title card.
- `palette`: `neon` (black, lime glow), `gold`, `ocean` (navy, cyan) or `ledger` (light paper).
- `disclaimer`: keep the default for anything that sounds like advice.

Use well-known, checkable rules and simple arithmetic. When a number is only an illustration
(a sample salary), say so in the `stat.label` ("on a $4,000 example"). Never promise returns.

## Product placement
`<AdWeave>`: end-card fits best ("start your budget"); sponsor-mention also works.

## Forking ideas
Add a running total that carries across steps, a "before vs after" split, a phone mockup that
shows the step inside an app, or a compound-growth curve drawn along the path.
