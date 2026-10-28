# Rain Mood Story

**Use it for:** calm, reflective narration about nature, places and travel: the wettest places
on Earth, a season in the mountains, a night train through the snow, migrating birds, a lake
at dawn, quiet personal or fable-like stories. It works as a full short or as the atmospheric
"context" or "closer" beat inside a longer video.

**Do not use it for:** hype, product demos, dense numbers or charts, fast meme edits, or
anything that needs real photos (use a documentary entry).

## How it looks
A 2D illustrated short in layered paper-cut planes. Every narration scene is a drawn place:
far ridges melt into the horizon while nearer layers turn to ink, and each plane slides at its
own speed as the camera pushes in slowly (2.5D parallax). Weather sits over the scene: slanted
rain with splash rings on the ground and ripples on water, storms with lightning flashes,
drifting snow, horizon mist, or fireflies on clear nights. Silhouette figures (a person under
an umbrella with dripping edges, a walker crossing the frame, a grazing deer, a flock of birds)
give it a story. Settings: `forest`, `mountains`, `lake` (with reflections), `coast`
(lighthouse beam sweeping the sea), `city` (lit windows, bokeh, wet street reflections),
`station` (platform lamps, a lit train gliding past), `field` (lone tree, fence, grass).
The opening title rises letter by letter in a display serif; each scene gets a small
location tag with a self-drawing weather icon; scenes dissolve through soft cool light leaks;
calm serif captions; cinema bars on 16:9; an optional closing line fades in at the end.

## Filling the props
- `title`: max ~6 words. Wrap one word in `*asterisks*` to tint it, e.g. `Where the *rain* lives`.
- `subtitle`: a place, season or mood, e.g. `Meghalaya, India` (can be empty).
- `shots`: **one shot per narration scene, in the same order.** Each shot:
  - `setting`: `forest`, `mountains`, `lake`, `coast`, `city`, `station` or `field`.
  - `weather`: `rain`, `storm`, `snow`, `fog` or `clear`.
  - `time`: `dawn`, `day`, `dusk` or `night`.
  - `figure`: `none`, `umbrella`, `walker`, `deer` or `birds`. Vary them across shots.
  - `label`: a short place or moment tag (max 40 characters), or `""`.
- `closing`: a quiet last line (max 70 characters), e.g. `Listen to it fall.`, or `""`.
- `mood`: `blue-hour` (default, cool blue with warm lamps), `ember` (warm), `moss` (green,
  earthy) or `mono` (near black and white).
- `showCaptions`: `true` unless the video has no narration. `letterbox`: cinema bars on 16:9.
- Narration: 3–10 scenes of one or two calm sentences (4–7 seconds each). Facts must be true.

## Product placement
Renders the kit `<AdWeave>`: `end-card` (default), `mid-roll-card` or `sponsor-mention`. Keep
the narration on topic; the closing line finishes before the end card.

## Forking ideas
Add a new setting (desert dunes, rice terraces, harbour), let a scene image from
`media.scenes[i].video` appear as a painted far plane, or add a second figure for a reunion.
