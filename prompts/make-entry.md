# Task: create one ViraLaunch video library entry

You are adding ONE new entry to this repository (viralaunch-video-library, MIT): a reusable,
premium Remotion template that coding agents and small models will fill with props.

Inputs (filled in below):
- `ENTRY_ID` — kebab-case id for the new entry
- `INSPIRATION` — a record from inspiration/inspiration.json (title, description, genres,
  domains, link to the creator's post). Frame grabs of the original video may be in
  `.cache/reference/<ENTRY_ID>/`. Look at them for visual direction only.
- `DIRECTION` — what this entry must cover in the library (subject domains, genre, role).
  When the inspiration is a product video but the direction is a non-marketing domain, keep
  the visual idea (motion, layout, energy) and make it a template for that kind of content.

## Read first
1. `kit/src/index.tsx` (entry contract, AdWeave, timeline), `kit/src/fx.tsx` (premium layer),
   `kit/src/look.tsx` (shared looks).
2. The quality bar, two entries made with the premium kit (read both fully):
   `../viralaunch-local/packages/remotion/library/entries/facts-cards-3d/src/index.tsx` and
   `../viralaunch-local/packages/remotion/library/entries/documentary-ken-burns/src/index.tsx`
   (if that path is missing, read `entries/timeline-eras` and `entries/data-story-bars`).

## Rules
1. **Original code only.** Never copy the creator's prompt, code or assets. The inspiration is
   a direction for look and structure.
2. **A template, not a video.** Everything topic-specific comes from zod props in
   `src/schema.ts` (with `.describe()` text and sensible defaults). A 7–14B model must be able
   to fill the props from `brief.md` alone. Keep the props small (≤ 8 top-level fields).
3. **Premium motion.** Use the kit fx (`SceneSeries` transitions, `KineticText`,
   `StyledCaptions`, `CameraImage`, `LightLeak`, `Grain`, `Vignette`, `Particles`, `LineIcon`,
   `countUp`, `ease`/`tween`/`progress`) and the kit `fonts` names. Never use raw font
   strings. Every scene needs designed motion, not static slides. Pace reveals to the narration
   with `useSceneTimeline`, and finish content before the end card (`useContentFrames`).
4. **Shared look (required).** Call `useLook()`:
   - null → your own design (palette props as usual);
   - a look → build your palette from `look.palette` (bg, bg2, surface, text, muted, accent,
     line) with a small `fromLook(look)` adapter, keep your layout and motion, and keep key
     content above `captionSafeBottom(look)` of the height;
   - draw no caption box of your own (captions render nothing in look mode; the kit draws
     them);
   - `mix()` helps tint textures toward the look.
5. **Product placement.** Render `<AdWeave media={media} />` once, unless the entry only
   supports native-integrated.
6. **Contract.**
   - Follow `schema/entry-meta.schema.json` and the validator.
   - Allowed imports only.
   - No network, no `Math.random` / `Date.now`, under 2 MB.
   - Size, fps and duration come from `media`.
   - No prop key may end in "url".
   - No repeating CSS backgrounds or SVG patterns inside transformed layers; put textures on
     static top-level layers.
   - No WebGL.
7. **meta.json:**
   - `status: "approved"`, `location: "remote"`, `source: "recreation"`;
   - `inspiredBy`: the post url, collection and inspirationId;
   - honest `genres` and `domains` (`generic` only if it truly fits any subject);
   - `roles` (which beat of a longer video it can show: hook, context, evidence, explanation,
     payoff, closer);
   - `segmentable` (false only for whole-film formats with their own arc);
   - `look` (dark, light or adaptive);
   - `lookPreset` (the closest of cinematic, documentary, midnight, paper, broadcast);
   - `themeable: true`.
8. **brief.md** must contain "**Use it for:**" and "## Filling the props".
   `props.example.json` must be factual: real, checkable facts only. When unsure, write a
   clearly generic example.

## Loop until clean
1. `pnpm typecheck` and `pnpm validate ENTRY_ID`.
2. `pnpm still-sheet ENTRY_ID`, then look at `out/sheets/ENTRY_ID.jpg`. Fix anything clipped,
   overlapping, unreadable, empty or static.
3. `pnpm still-sheet ENTRY_ID --look cinematic` and `--look paper`, then look at both. The
   template must honour each look, with the captions clear of content.
4. `pnpm preview ENTRY_ID`, then extract 4 frames from `previews/ENTRY_ID.mp4` with ffmpeg and
   check the motion reads well.

Do not modify other entries, the kit, scripts, the index or the manifest. End by printing one
line: `RESULT ENTRY_ID ok` or `RESULT ENTRY_ID failed: <reason>`.
