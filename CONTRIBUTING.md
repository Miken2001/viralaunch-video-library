# Contributing an entry

1. `pnpm new-entry <id> "<Name>"` and build it from the scaffold, or copy a close entry.
2. Write only original code. If a third-party video inspired you, link it in
   `meta.inspiredBy`. Never paste its prompt, footage or thumbnails.
3. Make the template reusable: put topic-specific content in `src/schema.ts` props with
   defaults and comments, so a small model can fill it from `brief.md` alone.
4. Tag it honestly. A product-launch structure is never `domain: generic`. Use `generic`
   for templates that fit any subject; otherwise list up to 6 specific domains.
   Set `roles` to the beats it can show inside a longer multi-template video, `segmentable:
   false` for whole-film formats (a launch film with its own arc), `look`, and `lookPreset`
   (the kit look closest to your design). Segmentable entries must be `themeable`: call
   `useLook()` and, when it returns a look, take colours from `look.palette` (keep your layout
   and motion), use the kit `fonts` names (never raw font strings), and don't draw your own
   caption box. `pnpm validate` enforces the `useLook()` call.
5. `pnpm typecheck && pnpm validate <id> && pnpm preview <id>`, then look at the frames.
6. `pnpm index`, then open a PR with the preview attached.

The validator rejects network access, nondeterminism, imports outside the allow-list,
entries larger than 2 MB, and briefs missing their required sections.
