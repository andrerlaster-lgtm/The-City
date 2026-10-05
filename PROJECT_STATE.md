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
Stage 1, milestones M0–M4 done, committed and pushed. **M5 planned and ready for implementation** (`docs/M5-PLAN.md`).

| # | Milestone | Status |
|---|---|---|
| M0 | Scaffold (Vite, TS, PixiJS, React, tests) | Done |
| M1 | World and camera | Done |
| M2 | Roads | Done |
| M3 | Buildings | Done |
| M4 | Time and economy | Done |
| M5 | Citizens (first full gameplay loop) | Planned, ready for implementation |
| M6 | Save and load | Not started |
| M7 | Polish and deploy (private Vercel preview) | Not started |

## Last Completed Step
2026-10-04: M4 — Time and economy, implemented by Codex from the approved
plan. It adds:
- the fixed-step loop
- speed controls and keys
- daily upkeep and the ledger
- the per-day treasury projection
- the debt and immigration warning
- the economy breakdown

Andre's browser play-test passed. Claude's final review found two misleading
economy-panel figures and a few smaller issues, and Claude's fix pass resolved
them (see "M4 Review Fixes"). M4 is committed (`ba872ad`) and pushed.

## Current Task
M5 — Citizens: plan approved 2026-10-04 and saved as `docs/M5-PLAN.md`. Nothing has been implemented.

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
- M4 (approved 2026-10-04):
  - Debt is allowed: upkeep is always charged and the treasury can go below
    0. Building is blocked while in debt, and nothing is ever demolished
    automatically.
  - Taxes stay at 0 until M5 adds citizens, with no placeholder income.
  - Road upkeep is `round(road tiles × 0.1)` per day, and the entrance is
    free.
  - Every building pays upkeep, including disconnected ones.
  - New games start at 1×.
- M5 (approved 2026-10-04):
  - No randomness: arrivals and every other choice follow fixed rules.
  - Starting numbers, all in `BALANCE` and tuned in M7:
    - taxes: 1 per resident, 2 per employed citizen
    - workshop revenue: 2 per worker
    - farms: 2 food per worker; each citizen eats 1 food
    - starting food: 30
    - at most 4 arrivals per day
    - leaves after 5 days hungry, 7 days unemployed or 3 days homeless
    - Well radius 6, and the Well needs its 1 worker
  - Disconnection: residents of a disconnected home keep it but count as
    homeless and lose their jobs. They leave after 3 days unless it's
    reconnected.
  - Stable jobs: only unemployed citizens are matched each day.

## Current Architecture
Core rule: **the simulation never knows the screen exists.**

- `src/sim/` — pure TypeScript simulation. No Pixi, React, DOM, storage or
  `Math.random` (seeded `core/rng.ts` instead). Enforced by
  `tests/architecture/boundaries.test.ts`.
  - `Simulation.ts` owns `GameState` (seed, rng state, tick, treasury, world,
    speed and economy ledger). `tick()` advances one hour and closes the
    daily economy at 00:00; it returns changed tiles/buildings.
  - `world/` — `WorldMap` as flat typed arrays (`y * width + x`): terrain,
    trees, variant. Own ~40-line value noise in `noise.ts`, generation in
    `generate.ts`.
  - `time/calendar.ts` — tick (1 game hour) → date; `time/clock.ts` — daily
    cadence helpers.
  - `economy/economy.ts` — deterministic taxes, building and road upkeep,
    daily ledger and projected net. Taxes remain zero until citizens arrive.
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
  `InfoPanel`, `TileInfo`, `SpeedControls`, `EconomyPanel`, CSS tokens.
  Reads state via a small `Store` (useSyncExternalStore-shaped).
- `src/app/` — `Game.ts` composition root wiring sim + renderer + input + UI;
  `loop.ts` has the testable fixed-step accumulator; `store.ts` publishes
  snapshots.
- Flow: input → **commands** → sim → **snapshots** → renderer/UI. The save
  system is not built yet.
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
- M4: deterministic hour ticks; app-side fixed-step loop with pause and 1×,
  2× and 3× speeds; calendar updates; daily building/road upkeep; construction
  ledger; zero taxes; projected net/day; today/yesterday report; debt blocks
  new construction and displays the immigration-paused status without
  demolishing anything.
- Tests: 152 passing across data, footprint/placement/access/demolition,
  determinism, roads, world generation, camera math, sim-purity and file-size
  guards.

## Known Issues (verified 2026-10-04)

- M3 validation: 125 tests passed; typecheck, production build and
  `git diff --check` passed.
- M4 validation after the fix pass: 152 tests passed, and typecheck, the
  production build and `git diff --check` passed.
- M4 browser play-test passed (Andre, 2026-10-04). The economy panel changes
  from the fix pass need a quick look.
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
- `hud.css` is 333 of the 400 allowed lines. Split it (for example,
  `economy.css`) before it grows much more.
- The debt banner and the economy panel can overlap on windows narrower than
  about 900 px. This is cosmetic.
- Top-bar population, free housing and open jobs are placeholders until M5.
- `docs/STAGE-1-PLAN.md` still uses the old folder name `the-city-life/`.

## GitHub

Repository: https://github.com/andrerlaster-lgtm/The-City

Branch: `main`

Working tree: clean. The M4 plan (`8ca9fcc`) and M4 (`ba872ad`) are pushed.
The M5 plan commit is local only, not pushed, so `main` is 1 ahead of
`origin/main`.

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

## M4 Review Fixes (2026-10-04, Claude)

1. **"Today so far" upkeep showed −0.** The panel now shows today's
   construction, plus the taxes and upkeep due at 00:00 (from the projection).
2. **Yesterday's "Net" left out construction.** `DailyReport.net` is now the
   whole day's treasury change (taxes − upkeep − construction).
   `treasuryAfter` is unchanged, and construction is still charged once,
   when it happens.
3. **The frame loop rebuilt the full snapshot every frame.** The loop now
   reads `Simulation.getSpeed()`, which costs almost nothing.
4. **The economy panel covered the speed controls.** It now opens below them.
5. **Ctrl, Cmd or Alt plus a digit or Space changed the speed.** Those
   combinations are now ignored, and a held Space no longer toggles pause
   repeatedly.
6. **`set-speed` accepted any number.** Values outside 0–3 are now rejected.
   `buildingUpkeep` now uses `buildingDefinition()`.
7. **Test gaps filled:**
   - whole-state determinism at speeds 1× and 3×
   - stepper tick counts don't depend on how time is split into frames
   - `immigrationPaused` at exactly 0 and at 1
   - roads are blocked while in debt
   - `lastDay` rolls over and `today` resets, and net matches the treasury
     change
   - 15 road tiles cost 2 coins per day
   - invalid speed is rejected

## Next Step

1. Implement **M5 — Citizens** following `docs/M5-PLAN.md` (Codex or Claude):
   - the citizen model
   - the daily steps: production, consumption, economy, jobs, migration, stats
   - housing and job matching by road distance
   - food and the Well boost
   - departures
   - real taxes and workshop revenue
   - top-bar stats, building occupancy, and the CitizensPanel
2. Claude reviews it (tests, typecheck, build), then Andre play-tests it in
   the browser.

## Last Updated

Date: 2026-10-04
AI used: Claude (M5 plan); Codex (M4 implementation), Claude (M4 plan, review and fix pass)
