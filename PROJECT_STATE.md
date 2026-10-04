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
Stage 1, milestones M0, M1 and M2 done and committed. **M3 (Buildings) is next.**

| # | Milestone | Status |
|---|---|---|
| M0 | Scaffold (Vite, TS, PixiJS, React, tests) | Done |
| M1 | World and camera | Done |
| M2 | Roads | Done |
| M3 | Buildings | Next |
| M4 | Time and economy | Not started |
| M5 | Citizens (first full gameplay loop) | Not started |
| M6 | Save and load | Not started |
| M7 | Polish and deploy (private Vercel preview) | Not started |

## Last Completed Step
2026-10-04: M2 review fixes (Claude). Codex built M2. Claude's review found
seven issues, and Claude then fixed them (see "M2 Completion" below).
M2 committed 2026-10-04 ("M2: roads ...").

## Current Task
None in progress. M2 committed without a recorded browser play-test.

## Important Decisions
- VS Code is the main development command center.
- Claude and Codex can both work on this project.
- Project state is tracked in this file.
- Stage 1 plan approved 2026-10-04 (stack, isometric 2.5D view, art generated
  in code, building names Cottage / Rowhouse / Farm / Workshop / Well).
- No new dependencies without Andre's approval.

## Current Architecture
Core rule: **the simulation never knows the screen exists.**

- `src/sim/` — pure TypeScript simulation. No Pixi, React, DOM, storage or
  `Math.random` (seeded `core/rng.ts` instead). Enforced by
  `tests/architecture/boundaries.test.ts`.
  - `Simulation.ts` owns `GameState` (seed, rng state, tick, treasury, world).
    `tick()` currently only advances the hour; returns changed tiles/buildings
    (empty for now).
  - `world/` — `WorldMap` as flat typed arrays (`y * width + x`): terrain,
    trees, variant. Own ~40-line value noise in `noise.ts`, generation in
    `generate.ts`.
  - `time/calendar.ts` — tick (1 game hour) → date.
  - `roads.ts` — road placement and demolition (all-or-nothing), previews,
    the 4-bit N/E/S/W neighbour mask, the BFS from the entrance (returns
    which tiles' connected state flipped), and edge-entrance placement.
    `WorldMap` gains `roads`, `roadConnected` and `entranceIndex`.
  - `Simulation.applyCommand(PlayerCommand)` is the single entry point for
    player changes (`place-roads`, `demolish`). It returns `ok` / `reason` /
    `cost` / `changedTiles` / `treasury`. The command types live in
    `Simulation.ts` for now.
- `src/core/` — rng, typed event bus, grid/iso math (including `tileLine`,
  a 4-connected tile path used by drag input), shared types.
- `src/data/` — data tables: `terrain.ts`, `balance.ts` (128×128 map, starting
  treasury, etc.).
- `src/render/` — PixiJS only: `Renderer.ts`, `camera.ts` (pixi-viewport),
  `cameraMath.ts` (pure, tested), `layers/` (Terrain, Object, Hover),
  `art/` (procedurally drawn terrain and trees), `palette.ts`.
  `RoadLayer` draws disconnected roads in `roadDisconnected`.
  `Renderer.refreshTiles` redraws roads and trees for changed tiles.
  `setToolDrag` in `camera.ts` hands left-drag to the active tool.
- `src/input/` — pointer → tile hover, tile drag strokes, keyboard pan.
- `src/ui/` — React HUD overlay: `App`, `TopBar`, `ToolBar`, `TileInfo`, CSS tokens.
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
- Tests: rng, grid (including `tileLine`), event bus, calendar, simulation
  basics, world generation, roads/commands/entrance, camera math, sim-purity
  and file-size guards.

## Known Issues (verified 2026-10-04)

- Tests: 95 passed / 95. Typecheck passed. Build passed.
- The Vite build warns that the main JS chunk is over 500 kB. This doesn't
  block anything and can be optimized later.
- **M2 was committed without a browser play-test of the fixes.** The camera
  vs. tool drag, the disconnected-road colour and tree removal are verified
  only by typecheck and build.
- On touch screens, a one-finger drag with a tool active still pans the
  camera. pixi-viewport's `mouseButtons` setting only filters mouse input.
  Address this with M3 tools or in M7 polish.
- If no edge tile is buildable, no entrance is placed (`entranceIndex = -1`)
  and every road shows as disconnected. This didn't happen for any tested seed.
- The toolbar repeats the treasury that the top bar already shows. This is
  cosmetic.
- `PlayerCommand` lives in `Simulation.ts`. The plan puts it in
  `sim/commands.ts`. Move it when M3 adds `PlaceBuilding`.
- The game clock doesn't run yet: the app never calls `Simulation.tick()`.
  This is expected until M4.
- Top-bar population, free housing and open jobs are placeholders until M5.
- `docs/STAGE-1-PLAN.md` still uses the old folder name `the-city-life/`.

## GitHub

Repository: https://github.com/andrerlaster-lgtm/The-City

Branch: `main`

Working tree: clean except `AGENTS.MD` and `CLAUDE.MD`, which are untracked
on purpose (not part of the M2 commit).

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

## Next Step

1. Play-test M2 in the browser (`npm run dev`).
2. Begin **M3 — Buildings**: data definitions for the five buildings, a
   build menu by category, a placement ghost with valid/invalid reasons,
   costs charged through `applyCommand`, and an info panel on click. Move the
   command types into `sim/commands.ts` as part of M3.

## Last Updated

Date: 2026-10-04
AI used: Claude (review and M2 fixes)
