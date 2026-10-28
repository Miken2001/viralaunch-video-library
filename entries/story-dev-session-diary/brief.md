# Dev Session Diary

**Use it for:** tech stories told as one working session: a bug hunt, a build that keeps
failing, shipping a feature, launch night, a hackathon, "a day with an AI coding agent", or a
famous moment in computing history retold from its logbook (the first "bug", a first message
sent, a first launch).

**Do not use it for:** stories with no time order, lists of facts (use a facts or listicle
template), or invented quotes presented as real logs of real people.

## How it looks
A flat cartoon office with ink outlines. The camera opens tight on the monitor while the
`title` types out, then pulls back to reveal the room: a box-shaped character at a desk, a
window, a cork board, a framed growth curve, a wall clock, a shelf, a lamp and a steaming mug.
Each beat drops a chat bubble above the scene with the speaker, a time chip and the message
typing out; the bubble tail points at the character (human) or the monitor (machine). The
character's face and arms react (typing, scratching its head, cheering, dozing), the monitor
switches state (terminal, idea bulb, progress bar, red error with shake, green check with
confetti, chart, rocket), the wall clock swings to the beat's time, a note is pinned to the
cork board, and optional ribbons slap onto the character like badges. The window light runs
through the day across the video. Box captions at the bottom.

## Filling the props
- `beats`: one per narration scene, in time order (2–12). Add one extra scene at the start
  if you want the narration to cover the opening zoom; then scene 0 is the intro.
- `time`: "HH:MM" 24h. Use real times for real stories; "" if unknown.
- `message`: ≤ 90 characters, written like a chat message or log line. Short is better.
- `who`: "human" for the person at the desk, "machine" for computer replies, build output or
  an AI agent.
- `mood` + `screen` tell the beat's emotion: problem → `confused`/`frustrated` + `error`;
  progress → `focused` + `progress`/`typing`; win → `happy`/`proud` + `success`/`launch`;
  idea → `thinking`; late → `sleepy`.
- `sticker`: ≤ 16 characters, only on 1–3 key beats ("BUG FOUND", "SHIPPED").
- `sky`: `day-to-night` for a long session, `night-to-dawn` for an all-nighter, `daylight`
  for a working day.
- `cast`: the names on the bubbles, e.g. human "Dev", machine "Claude" or "CI".

## Product placement
`<AdWeave>`: end-card or mid-roll-card. For `native-integrated`, the product can be the
machine in the conversation (an assistant or a tool that answers), kept believable.

## Forking ideas
Two characters at two desks for pair programming, a calendar instead of the clock for
multi-day projects, or real screenshots on the monitor from scene images.
