# ViraLaunch Video Library

A free, public **MIT library of Remotion video templates** for coding agents and humans.
Every template ships working code, a preview, an agent brief and a props schema.

It powers [ViraLaunch](https://viralaunch.ai), whose application and orchestration remain
closed source. The CLI's twelve core templates are bundled in its optional renderer pack
for offline use after installation. This public repository supplies additional templates
on demand, verified against catalog hashes. The expansion target is 100+ templates.

Template customization and exact-hash approval remain supported. The shared kit supports
multi-template sequences with continuous narration and a consistent look.

## Templates

| Template | Kind | Good for |
|---|---|---|
| `timeline-eras` | timeline | history of X, milestones, eras |
| `listicle-countdown` | listicle | top-N, rankings, "N things you didn't know" |
| `data-story-bars` | data story | comparisons, prices, records — with a sourced hero number |
| `quote-kinetic-serif` | kinetic quote | famous quotes, scripture, bold statements |
| `comparison-split` | comparison | A vs B: athletes, empires, products |
| `space-scale-ladder` | comparison / explainer | "how big is X" across orders of magnitude |
| `match-recap-scoreboard` | news recap | verified sports match recaps |
| `story-chat-thread` | story | stories told as a phone chat (labelled dramatizations) |
| `explainer-steps-diagram` | explainer | processes and cycles, step by step |
| `news-headline-highlight` | news recap | headlines with marker highlights + "why it matters" |

Previews are generated as one MP4 + poster per template and distributed through GitHub
releases. Release validation checks that referenced assets are available and match hashes. More templates are added in batches;
the goal is 100+.

## Finding the right template fast

Every entry is tagged on independent axes (`taxonomy.json`), so an agent only looks at what
fits:

| axis | examples |
|---|---|
| **genre** (what kind of video) | documentary, map-journey, timeline, explainer, listicle, data-story, comparison, product-launch, news-recap, story-narrative, quote-kinetic… |
| **domain** (what it is about) | history, geography, science, space, sports, finance, tech, religion-myth, culture-entertainment, generic… |
| **adWeave** (how a sponsor may appear) | native-integrated, end-card, mid-roll-card, sponsor-mention, none-pure-brand |
| **roles** (which beat of a longer video it can show) | hook, context, evidence, explanation, payoff, closer — plus `segmentable`, `themeable`, `look` (dark/light/adaptive) and `lookPreset` |
| technique · aspect · tier · minModel · renderCost | kinetic-type, maps, charts… · 9:16 · fill/fork · small/mid/frontier |

- `index/index.json` — every entry's metadata, props JSON Schema, content hash and file list (no code)
- `index/index.by-genre.json`, `index/index.by-domain.json` — precomputed buckets
- `inspiration/inspiration.json` — 359 real videos made with coding agents (from
  [awesome-opus-5.5-video-prompts](https://github.com/Li-Evan/awesome-opus-5.5-video-prompts)
  and [remotion.dev/prompts](https://www.remotion.dev/prompts)) as **links only**, tagged the
  same way: ideas for new templates.

A history video: filter `domain=history`, then `genre=documentary|timeline|map-journey`.
Product-launch templates never show up for that query.

## Combining templates (sequences)

A longer video can switch templates per narrative beat — a cinematic hook, fact cards for the
numbers, a line-art diagram for the mechanism, a documentary close — under one continuous
narration. Each segment renders as its own composition; `kit/node/sequence.ts` cross-fades the
clips with ffmpeg and lays the audio underneath.

**One look, many templates.** Every segment gets the same `media.look` (`kit/src/look.tsx`), so
the result reads as one film:
- the kit draws the captions (same font, size, colours and position everywhere);
- named fonts are remapped by role (display / body / label);
- each template takes its background family, surfaces, text colours, accent and texture from
  the look.

Templates keep their own layout, motion, camera and illustrations. The look defaults to the
first segment's `lookPreset` (cinematic, documentary, midnight, paper, broadcast). Mark another
segment `anchor: true`, or pass `look: {preset, palette, fonts}` to brand it.

```bash
pnpm sequence-preview examples/sequences/malaria.json --cuts   # → out/sequences/malaria.mp4 + -cuts.png (continuity QA)
```

A spec is a normal example (`media`, `scenes`) plus `accent`, `transition`
(`light-leak-dissolve` | `whip` | `zoom` | `cut`) and 2–4 `segments`
(`{templateId, role, fromScene, toScene, props}`) covering every scene in order. Pick templates
whose `roles` include the beat, keep one `look`, and never use a `segmentable: false` entry.
Templates outside `entries/` (e.g. ViraLaunch's bundled ones) are read from `CORE_DIR`.

## Entry layout

```
entries/<id>/
  meta.json            taxonomy, tiers, attribution (schema/entry-meta.schema.json)
  brief.md             when to use it, how to fill it, placement, fork ideas
  props.example.json   example narration scenes + props (used for the preview)
  src/schema.ts        export const Props = z.object(...)
  src/index.tsx        export default defineEntry({id, schema: Props, component})
```

Each entry receives `{media, props}`:
- `media` comes from the `@viralaunch/kit` runtime in `kit/`. It holds narration audio, word
  captions, per-scene images, brand and placement mode, and the output size.
- `props` is the entry's own validated data.

The kit's premium layer (`kit/src/fx.tsx`, `@viralaunch/kit/fx`) provides:
- bundled OFL fonts and easing presets;
- kinetic typography and word-caption styles;
- narration-locked scene transitions and camera moves;
- light leaks, grain, particles and editorial HUD framing;
- self-drawing line icons.

Everything renders offline, deterministically, in software Chrome.

## Commands

```bash
pnpm install
pnpm new-entry my-entry "My Entry"        # scaffold
pnpm validate [id...]                     # the gate every entry passes
pnpm still-sheet <id> [--aspect 16:9]     # fast 6-frame design check → out/sheets/
pnpm preview <id> [--aspect 16:9]         # render previews/<id>.mp4 + .jpg
pnpm index                                # rebuild index/ (pnpm index --check in CI)
pnpm inspiration <awesome-list checkout>  # rebuild inspiration/inspiration.json
pnpm contact-sheet                        # out/contact-sheet.html for batch QA
pnpm sequence-preview <spec.json>         # render a multi-template sequence → out/sequences/
pnpm make-entry <inspiration-id> <new-id> --awesome <checkout>   # headless agent pipeline
pnpm sync-kit ../viralaunch-local         # copy kit + catalog into ViraLaunch
```

`ENTRIES_DIR=<folder>` points the tooling at entries stored elsewhere.

## Using a template in ViraLaunch

```bash
viralaunch library search --domain history
viralaunch library fetch timeline-eras     # verified against index/index.json hashes
viralaunch library fork timeline-eras my-timeline --project <id>
```

## Licensing

Code, briefs and metadata are MIT; preserve existing grants and notices.
`samples/` holds public-domain images used only to render
previews (`samples/SOURCES.md`). `inspiration/inspiration.json` reuses titles and descriptions
from awesome-opus-5.5-video-prompts under CC BY 4.0, with attribution in the file. The
prompts, videos and thumbnails it lists belong to their creators and are **not**
redistributed; each record links to the original post. See `NOTICE.md`. Rendering with
Remotion is subject to the [Remotion license](https://remotion.dev/license).
