# Project State

## Project
The-City (package name: `the-city-life`, in-game title: "The City Life")

## Goal
A browser city-building simulation. The player builds the settlement (roads,
buildings); citizens decide for themselves where to live and work. Stage 1 is
the **Settlement Prototype**: build → people move in → they work → money comes
in → expand → population grows. Full plan and acceptance criteria:
`docs/STAGE-1-PLAN.md`.

## Current Stage
Stage 1, milestones M0–M3 done, verified and committed. **M4 (Time and economy) is next** (not started).

| # | Milestone | Status |
|---|---|---|
| M0 | Scaffold (Vite, TS, PixiJS, React, tests) | Done |
| M1 | World and camera | Done |
| M2 | Roads | Done |
| M3 | Buildings | Done |
| M4 | Time and economy | Not started |
| M5 | Citizens (first full gameplay loop) | Not started |
| M6 | Save and load | Not started |
| M7 | Polish and deploy (private Vercel preview) | Not started |

## Last Completed Step
2026-10-04: M3 — Buildings implemented by Codex from `docs/M3-PLAN.md`, then
two Claude reviews. Claude's fix pass corrected where buildings, the
placement ghost and roads are drawn (they were offset from their tiles) and
cleaned up the simulation code. Andre's browser play-test passed, and M3 is
committed and pushed.

## Current Task
None in progress. M4 planning is next.

## Important Decisions
- VS Code is the main development command center.
- Claude and Codex can both work on this project.
- Project state is tracked in this file.
- Stage 1 plan approved 2026-10-04 (stack, isometric 2.5D view, art generated
  in code, building names Cottage / Rowhouse / Farm / Workshop / Well).
- No new dependencies without Andre's approval.
- M3 (approved 2026-10-04): a building needs edge-to-edge road access to be
  placed. Being connected to the entrance is a separate status/warning shown
  in the info panel. Demolishing roads or buildings gives no refund.

## Current Architecture
Core rule: **the simulation never knows the screen exists.**

- `src/sim/` — pure TypeScript simulation. No Pixi, React, DOM, storage or
  `Math.random` (seeded `core/rng.ts` instead). Enforced by
  `tests/architecture/boundaries.test.ts`.
  - `Simulation.ts` owns `GameState` (seed, rng state, tick, treasury, world).
    `tick()` currently only advances the hour; returns changed tiles/buildings
    (empty until later simulation systems land).
  - `world/` — `WorldMap` as flat typed arrays (`y * width + x`): terrain,
    trees, variant. Own ~40-line value noise in `noise.ts`, generation in
    `generate.ts`.
  - `time/calendar.ts` — tick (1 game hour) → date.
  - `roads.ts` — road placement and demolition (all-or-nothing), previews,
    the 4-bit N/E/S/W neighbour mask, the BFS from the entrance (returns
    which tiles' connected state flipped), and edge-entrance placement.
    `WorldMap` gains `roads`, `roadConnected` and `entranceIndex`.
  - `buildings/` — square footprint previews and ordered validation, building
    instances/occupancy, edge road access and entrance-connected flags.
  - `Simulation.applyCommand(PlayerCommand)` is the single entry point for
    player changes (`place-roads`, `place-building`, `demolish`). Commands live
    in `sim/commands.ts`; results include changed tiles/buildings and treasury.
- `src/core/` — rng, typed event bus, grid/iso math (including `tileLine`,
  a 4-connected tile path used by drag input), shared types.
- `src/data/` — data tables: `terrain.ts`, `buildings.ts`, `balance.ts`
  (128×128 map, starting treasury, etc.).
- `src/render/` — PixiJS only: `Renderer.ts`, `camera.ts` (pixi-viewport),
  `cameraMath.ts` (pure, tested), `layers/` (Terrain, Object, Hover),
  `art/` (procedurally drawn terrain, trees and five buildings), `palette.ts`,
  placement ghost.
  `RoadLayer` draws disconnected roads in `roadDisconnected`.
  `Renderer.refreshTiles` redraws roads and trees for changed tiles.
  `setToolDrag` in `camera.ts` hands left-drag to the active tool.
- `src/input/` — pointer → tile hover, tile drag strokes, keyboard pan.
- `src/ui/` — React HUD overlay: `App`, `TopBar`, `ToolBar`, `BuildMenu`,
  `InfoPanel`, `TileInfo`, CSS tokens.
  Reads state via a small `Store` (useSyncExternalStore-shaped).
- `src/app/` — `Game.ts` composition root wiring sim + renderer + input + UI;
  `store.ts`.
- Planned flow: input → **commands** → sim → **snapshots/events** → renderer/UI.
  The command entry point exists (`applyCommand`); the save system and game
  loop are not built yet.
- Guard rails: no source file over 400 lines (tested).

## Main Technologies
TypeScript 7 · Vite 8 · PixiJS 8 · pixi-viewport 6 · React 19 · idb-keyval
(saves, not used yet) · Vitest 5. Target: static site on Vercel (private
previews only).

Scripts: `npm run dev`, `npm test`, `npm run typecheck`, `npm run build`.

## Important Existing Features
- Seeded, deterministic 128×128 terrain (grass, water, sand, trees); map size
  is a setting.
- Chunked isometric rendering with code-generated art.
- Camera: drag pan, wheel/pinch zoom, keyboard pan, zoom limits.
- Tile hover highlight + tile info panel (terrain, wooded).
- Top bar: treasury, population, free housing, open jobs, date/hour
  (population/housing/jobs are placeholder zeros).
- Roads: Road and Demolish tools; drag-to-draw that is always 4-connected;
  cost and demolish previews in the toolbar; auto-connecting road pieces;
  disconnected roads tinted; a pre-placed entrance on a map edge; trees
  cleared under roads.
- Buildings: Cottage, Rowhouse, Farm, Workshop and Well; grouped build menu,
  cost dimming, placement preview/reasons, edge-to-edge road access, connected
  status, selection/info panel, whole-building and mixed road/building
  demolition with no refund. Trees clear under buildings.
- Tests: 122 passing across data, footprint/placement/access/demolition,
  determinism, roads, world generation, camera math, sim-purity and file-size
  guards.

## Known Issues (verified 2026-10-04)

- M3 validation: 125 tests passed; typecheck, production build and
  `git diff --check` passed.
- M3 browser play-test passed (Andre, 2026-10-04, after the rendering fix):
  road/ghost/building alignment, placement reasons, all five buildings, depth,
  info panel connected/disconnected, and demolish with no refund.
- The Vite build warns that the main JS chunk is over 500 kB. This doesn't
  block anything and can be optimized later.
- M2 browser play-test passed (Andre, 2026-10-04): drag, disconnected tint,
  tree removal, tool vs. camera drag and previews all work in the live preview.
- On touch screens, one-finger drag with a drag tool may still pan the camera;
  pixi-viewport's `mouseButtons` setting only filters mouse input. Revisit in
  M7 polish.
- If no edge tile is buildable, no entrance is placed (`entranceIndex = -1`)
  and every road shows as disconnected. This didn't happen for any tested seed.
- The toolbar repeats the treasury that the top bar already shows. This is
  cosmetic.
- The game clock doesn't run yet: the app never calls `Simulation.tick()`.
  This is expected until M4.
- Top-bar population, free housing and open jobs are placeholders until M5.
- `docs/STAGE-1-PLAN.md` still uses the old folder name `the-city-life/`.

## GitHub

Repository: https://github.com/andrerlaster-lgtm/The-City

Branch: `main`

Working tree: clean after the M3 commit, which is pushed to `origin/main`.

## Vercel

Project: Not created yet.

Deployment URL: None yet.

## M2 Completion (2026-10-04)

Codex built the road tools, previews, masks, entrance, BFS and `applyCommand`.

Claude's review fixes:
1. Drag paths are now 4-connected (`core/grid.ts` `tileLine`). Before this
   fix, screen-horizontal or vertical drags left roads touching only at
   corners.
2. Disconnected roads are tinted. The BFS reports every tile whose connected
   state flipped, and those tiles are redrawn.
3. Left-drag no longer pans the camera while a tool is active. Middle and
   right drag still pan.
4. Placing a road removes the tree sprite on that tile.
5. Demolish shows its own preview ("Remove N road tiles").
6. The entrance is deterministic and sits on a map edge, on buildable land,
   with no water fallback. It prefers an edge midpoint with buildable land
   inland.
7. Placement is still all-or-nothing. Out-of-bounds tiles now invalidate the
   stroke.
8. `applyCommand` validates once. Demolish (and placement that adds nothing
   new) returns `ok: false` with a reason. Previews have explicit types.

Validation: `npm test` (95 passed), `npm run typecheck`, `npm run build`, all
passed.

## M3 Completion (2026-10-04)

Codex built the approved `docs/M3-PLAN.md` scope:
- five data-driven buildings
- centred square footprints
- placement that is checked in a fixed order and is all-or-nothing
- edge-to-edge road access, kept separate from entrance connection
- deterministic ids and occupancy
- place-road, place-building and mixed-demolish commands
- no refunds
- procedural art, placement ghost, build menu, info panel, Escape to cancel

Codex's follow-up added the entrance-tile rejection and a stronger
determinism test.

Claude's fix pass:
- **Footprint position helper.** `render/cameraMath.ts` `footprintBottom`
  now returns the footprint's bottom corner. Before, it returned the east
  corner, and its tests locked in the wrong values.
- **Building sprites.** They anchor on that corner using the texture's
  `anchorY`. The selection outline follows the sprite.
- **Placement ghost.** It now draws exactly the tiles the simulation checked
  (`preview.tiles`), with diamonds positioned from each tile's top corner.
- **Roads.** `RoadLayer` was drawn half a tile right (a bug since M2).
  Road connectors now point to the edge each road tile shares with its
  neighbour.
- **Simulation cleanup:**
  - The terrain reason comes from data ("Needs grass").
  - The duplicate building check in `previewRoads` is gone.
  - A shared `buildingIdsAt` helper replaces the hand-written index math
    in `Simulation`.
  - Dead code is removed (`occupancyTiles`, `asBuildingId`, the `'generic'`
    texture lookups).

Validation: 125 tests passed. `npm run typecheck`, `npm run build` and
`git diff --check` all passed.

## Next Step

Plan **M4 — Time and economy**:
- a fixed-step loop with pause, 1×, 2× and 3×
- a running date
- daily upkeep and taxes
- an income breakdown in the top bar
- the approved rule: an empty treasury pauses immigration and never demolishes
  anything

## Last Updated

Date: 2026-10-04
AI used: Codex (M3 implementation), Claude (M3 reviews and fix pass)
