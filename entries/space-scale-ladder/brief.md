# Cosmic Scale Ladder

**Use it for:** "how big is X" — planets and stars, but also cells → organisms, people →
buildings → mountains, cities → countries. Anything where sizes jump by orders of magnitude.

**Do not use it for:** comparisons of non-physical quantities (use data-story-bars).

## How it looks
A twinkling parallax starfield; bodies are laid side by side at true relative size; the
camera re-frames on each new body so it fills the screen, which makes the previous ones
shrink to dots; a readout shows name, size and "N× previous". Optional rings per body.

## Filling the props (fill tier)
- `objects`: 3–8 in the order to reveal (usually small → large), each with a real
  `size` in one consistent unit, a display `sizeLabel`, a hex `color`.
- Narration: one scene per object, stating the comparison.

## Product placement
`<AdWeave>`: end-card / mid-roll / sponsor-mention. Keep the science on-topic.

## Forking ideas
Ease the camera continuously between bodies (log-scale zoom), add textured planet SVGs,
or reverse it into a zoom-in (galaxy → star → planet → city).
