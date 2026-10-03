# Task: create one ViraLaunch video library entry

You are adding ONE new entry to this repository (viralaunch-video-library, MIT).

Inputs (filled in below):
- `ENTRY_ID` — kebab-case id for the new entry
- `INSPIRATION` — a record from inspiration/inspiration.json (title, description, genres,
  domains, link to the creator's post). Frame grabs of the original video may be in
  `.cache/reference/<ENTRY_ID>/` for visual direction only.

Rules:
1. Write ORIGINAL code. Do not copy the creator's prompt or assets. The inspiration is a
   direction for the look and structure, not something to reproduce.
2. Read `kit/src/index.tsx` and two existing entries (e.g. `entries/timeline-eras`,
   `entries/data-story-bars`) first; follow the same structure and quality bar.
3. Make it a reusable TEMPLATE: everything topic-specific comes from zod props in
   `src/schema.ts` (with `.describe()`-style comments and sensible defaults). A small local
   model must be able to fill the props from the brief alone.
4. Use `useSceneTimeline`, `<NarrationTrack>`, `<Captions>` where narration fits, and render
   `<AdWeave media={media} />` once unless the entry only supports native-integrated.
5. Obey the entry contract (`schema/entry-meta.schema.json`, validator rules): allowed
   imports only, no network, no Math.random/Date.now, ≤ 2 MB, size/fps/duration from media.
6. Write `meta.json` (status "approved", location "remote", source "recreation",
   inspiredBy with the post url, collection and inspirationId), `brief.md` (with
   "**Use it for:**" and "## Filling the props"), and a factual `props.example.json`.
7. Run until all pass: `pnpm typecheck`, `pnpm validate ENTRY_ID`, `pnpm preview ENTRY_ID`.
   Then extract 4 frames from previews/ENTRY_ID.mp4 with ffmpeg and look at them; fix
   anything clipped, overlapping, unreadable or empty.
8. Do not modify other entries, the kit, or scripts.
