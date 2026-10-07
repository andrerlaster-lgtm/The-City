# Look and feel: ideas from Pocket Metropolis

**Status:** approved by Andre (2026-10-06) to start before S2-M2 continues.
**Source:** [30lilmickey-prog/pocket-metropolis](https://github.com/30lilmickey-prog/pocket-metropolis),
Andre's own game. We borrow ideas, colours and design, not its game rules.

**Goal:** make The City Life feel softer, warmer and more alive **without
changing how it plays.**

**Rules:**
- **Render and UI only.** `src/sim` doesn't change.
- **No gameplay change.** Every simulation, balance, save and determinism test
  passes unchanged.
- **No new dependencies.** New font files need Andre's approval first.
- Files stay under 400 lines, and reduced motion is respected.

**Code doesn't port directly.** Pocket Metropolis draws everything by hand on a
2D canvas. The City uses PixiJS with prebuilt textures, so colours and design
carry over but the drawing code is rewritten.

## The two styles

| | The City now | Pocket Metropolis |
|---|---|---|
| Mood | Earthy and serious | Soft, pastel, "a diorama" |
| Panels | Dark forest-green glass, gold accent | Light frosted glass, purple-grey ink |
| Buildings | Same cream walls and red roof everywhere | Four pastel schemes (peach, blush, mint, lavender) |
| Light | Fixed | Day/night sky, lit windows, street lamps |
| Fonts | System rounded | Fredoka (titles) and Nunito (text) |

## Build order

### LF-1 Pastel building colours (start here)
- Four wall/roof/trim schemes, adapted from Pocket Metropolis:
  - peach: wall `#ffb5a7`, roof `#e9968c`, trim `#fff1ec`
  - blush: wall `#fcd5ce`, roof `#e6a79e`, trim `#fff7f4`
  - mint: wall `#b8e0d2`, roof `#8ec3af`, trim `#f2fbf7`
  - lavender: wall `#cdb4db`, roof `#a991c4`, trim `#f8f2fb`
- Homes and workshops get one scheme each, picked from the building's id. The
  id never changes, so a building keeps its colour across saves and reloads.
- Farms and the Well keep their own look (fields, stone), with softened colours.
- **Files:** `render/palette.ts`, `render/art/buildingArt.ts`,
  `render/layers/ObjectLayer.ts`. Textures are prebuilt once per scheme.

### LF-2 Day and night
- The renderer reads the hour from the snapshot date. The sim already has 24
  ticks per day.
- A sky gradient behind the map replaces the flat dark background. The whole
  map gets a gentle warm or cool tint: golden hour, then blue night.
- Windows light up in the evening, and later street lamps appear on roads.
- Reduced motion keeps the tint changes slow and smooth, with no flicker.

### LF-3 Buildings show they're filling up
- Homes look more lived-in as residents move in (lit windows, small details).
  Workplaces look busier as workers arrive. This reads existing occupancy.

### LF-4 Placement feedback
- Floating "+N" text, a small bounce and a ring when something is placed.
  S2-M2 can reuse this to show "+happiness" on homes around a new park.

### LF-5 A lighter interface (optional theme)
- Frosted light panels, rounder corners, purple-grey ink, as a light theme
  next to today's dark one.
- Fredoka and Nunito would be new font files, so this needs Andre's approval.
  Without them, the system rounded font stays.

## Folded into the Stage 2 milestones

| Idea | Milestone |
|---|---|
| Resident thought bubbles (red, yellow, green) with **Show me** | S2-M2 warnings |
| Playground (small leisure building) | S2-M2, next to the Small Park |
| Placeable trees and ponds (decoration, raise land value) | S2-M4 |
| Tower that adds floors as it fills | S2-M5, as the Apartment Block's look |
| Town titles: Hamlet, Village, Town, City, Metropolis, with confetti | S2-M5 civic status |
| Moving water, swaying trees, seasonal colours | S2-M8, already planned |
| Shop (small workplace) | Feature bank candidate |
| School | Backlog (pulls Education forward, a bigger decision) |

## Not taken

Life Story, the touch-first layout, sandbox mode, and Pocket Metropolis's game
rules (how residents choose homes, its traffic model). Those would change what
The City is, not how it looks.
