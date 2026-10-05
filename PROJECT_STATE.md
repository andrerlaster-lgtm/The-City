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
Stage 1, milestones M0–M5 committed and pushed. Andre's M6 play-test covered the core M5 behaviour: production, disconnecting and reconnecting. The M5 road-connection hints haven't been explicitly play-tested. **M6 — Save and load is done, committed and pushed. M7 (Polish and deploy) is planned (`docs/M7-PLAN.md`, tooling approved), and hasn't been started.**

| # | Milestone | Status |
|---|---|---|
| M0 | Scaffold (Vite, TS, PixiJS, React, tests) | Done |
| M1 | World and camera | Done |
| M2 | Roads | Done |
| M3 | Buildings | Done |
| M4 | Time and economy | Done |
| M5 | Citizens (first full gameplay loop) | Done (`e990771`); core behaviour verified in the M6 play-test; hints not explicitly play-tested |
| M6 | Save and load | Done |
| M7 | Polish and deploy (private Vercel preview) | Planned (tooling approved); not started |

## Last Completed Step
2026-10-04: M6 — Save and load implemented by Claude from `docs/M6-PLAN.md`
(see "M6 Implementation"), plus per-building food and revenue output. Andre's
browser play-test passed on 2026-10-04. It covered:
- save and load
- pause on load
- seed persistence and display
- Farm and Workshop output
- disconnected output dropping to 0
- reconnecting
- city totals matching the per-building totals

Claude's final review passed. M6 is committed (`931eb12`) and pushed.

Before that: M5 — Citizens, implemented from the approved plan. It adds the
deterministic citizen lifecycle, daily housing and job assignment, food
production and consumption, the Well housing preference, real taxes and
workshop revenue, migration/departure reporting, live UI counts, and a
2,000-citizen performance test. Claude reviewed it, then made a fix pass
(see "M5 Review Fixes"):
- job-matching performance
- data-driven building types
- road-connection hints
- the camera opens on the Entrance
- extra tests

Committed and pushed as `e990771` at Andre's request. Andre hasn't
confirmed a browser play-test of M5 yet.

## Current Task
M7 is planned in `docs/M7-PLAN.md` (committed and pushed), and its tooling is
approved. Implementation hasn't started.

## Important Decisions
- VS Code is the main development command center.
- Claude and Codex can both work on this project.
- Project state is tracked in this file.
- Stage 1 plan approved 2026-10-04 (stack, isometric 2.5D view, art generated
  in code, building names Cottage / Rowhouse / Farm / Workshop / Well).
- No new dependencies without Andre's approval.
- M7 tooling (approved 2026-10-04):
  - **Install `@playwright/test`** as a dev dependency only. It uses the
    local Chrome channel, never enters the production bundle, and is for
    smoke tests and testing the Vercel preview.
  - **Defer `rollup-plugin-visualizer`.** Use Vite and Rolldown's built-in
    splitting first.
  - **Defer `pixi-filters`.** Use built-in Pixi effects.
  - **Skip AssetPack for Stage 1.**
  - **Vercel:** use the existing CLI (53.4.0). It's not a project
    dependency.
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
- M6 (approved 2026-10-04):
  - Saves store the base map layers. Derived data (road connectivity,
    `buildingAt`, building access flags) is rebuilt on load.
  - 3 manual slots plus 1 autosave slot.
  - Autosave runs every 5 game days, when the tab is hidden, and before
    loading or starting a new game.
  - Loaded games, including the continue-on-startup autosave, start paused.
    No time passes until the player resumes.
  - New games get a random seed from the app layer
    (`crypto.getRandomValues`), never from `src/sim`. The seed is saved with
    the game and shown in the save/new-game UI so it can be copied.

## Current Architecture
Core rule: **the simulation never knows the screen exists.**

- `src/sim/` — pure TypeScript simulation. No Pixi, React, DOM, storage or
  `Math.random` (seeded `core/rng.ts` instead). Enforced by
  `tests/architecture/boundaries.test.ts`.
  - `Simulation.ts` owns `GameState` (seed, rng state, tick, treasury, world,
    speed, economy ledger, citizens and food). `tick()` advances one hour and
    runs ordered daily citizen/economy steps at 00:00; it returns changed
    tiles/buildings.
  - `world/` — `WorldMap` as flat typed arrays (`y * width + x`): terrain,
    trees, variant. Own ~40-line value noise in `noise.ts`, generation in
    `generate.ts`.
  - `time/calendar.ts` — tick (1 game hour) → date; `time/clock.ts` — daily
    cadence helpers.
  - `economy/economy.ts` — deterministic resident/employment taxes, workshop
    revenue, upkeep, daily ledger and projected net.
  - `citizens/` — plain citizen data, connected housing assignment, stable
    road-distance job matching and deterministic migration/departures.
  - `daily.ts`, `resources/food.ts`, `services/coverage.ts` — daily production,
    consumption, economy, jobs, migration and staffed Well coverage.
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
  `InfoPanel`, `TileInfo`, `SpeedControls`, `EconomyPanel`, `CitizensPanel`,
  CSS tokens.
  Reads state via a small `Store` (useSyncExternalStore-shaped).
- `src/app/` — `Game.ts` composition root wiring sim + renderer + input + UI;
  `loop.ts` has the testable fixed-step accumulator; `store.ts` publishes
  snapshots.
- Flow: input → **commands** → sim → **snapshots** → renderer/UI.
- `src/save/` — the versioned save format:
  - `format`, `serialize`, `validate` and `migrations`
  - `slots`, for list, save, load and delete
  - providers: IndexedDB through `idb-keyval`, and an in-memory provider for
    tests
  - Pure, apart from the IndexedDB provider. It never touches the running
    game.
- `sim/restore.ts` rebuilds derived data on load. `Simulation.fromState` and
  `exportState` support saving.
- `app/saveService.ts` handles:
  - continuing from the autosave on startup (paused)
  - autosave
  - slot actions
  - new-game seeds from `crypto.getRandomValues`. The simulation never
    generates seeds, and a test enforces this.
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
- Top bar: treasury, live population, free housing, open jobs, food stock and
  daily food change, date/hour. Population opens the Citizens panel.
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
  ledger; projected net/day; today/yesterday report; debt blocks
  new construction and displays the immigration-paused status without
  demolishing anything.
- M5: deterministic immigration (capped at four daily), stable housing and
  workplace assignments by connected road distance, staffed Well preference,
  farm food production, ordered citizen consumption, hunger/unemployment/
  homelessness departures, immediate occupancy updates on demolition, real
  resident/employment taxes and workshop revenue, food and migration ledger,
  live top-bar and building occupancy data, and a Citizens panel.
- M6: 3 manual save slots plus autosave, a Menu with save, load, delete and
  new game (confirmations inside the panel), the world seed shown with a
  Copy button, and continuing from the autosave on startup. Loaded games
  start paused.
- Tests: 284 passing across data, footprint/placement/access/demolition,
  determinism, roads, world generation, camera math, sim-purity and file-size
  guards.

## Known Issues (verified 2026-10-04)

- M6 validation (with per-building output): 284 tests passed (the full suite passed 6 runs in a row),
  and typecheck, build and `git diff --check` passed.
- M6 browser play-test passed (Andre, 2026-10-04). Headless Chrome on this
  machine can't run the async startup, because IndexedDB and timers never
  answer there. That's an environment limit, so browser checks rely on
  Andre's play-tests.
- If storage never answers, the game now starts a new city after 3 s with
  saving off for that session, and shows a message. This keeps the game from
  getting stuck on a blank screen, and stops a later autosave from
  overwriting a real save it couldn't read.
- Only maps of the same size can be loaded: input bounds are set up once at
  start. All maps are 128×128 today, so this is noted for when map size
  becomes a setting.
- Two tabs autosaving at once: the last write wins. This is noted, not
  solved, in Stage 1.

- M3 validation: 125 tests passed; typecheck, production build and
  `git diff --check` passed.
- M4 validation after the fix pass: 152 tests passed, and typecheck, the
  production build and `git diff --check` passed.
- M4 browser play-test passed (Andre, 2026-10-04).
- M5 validation after the fix pass: 210 tests passed, and typecheck, build
  and `git diff --check` passed.
- **M5 performance**, warmed-up benchmark, 2,000 citizens on 128×128:
  - **Normal days:** about 1.9 ms median, 3–4 ms p95.
  - **Worst case:** all citizens unemployed at once, with every job at the far
    edge of the map (for example, after reconnecting a cut road to a big
    district). This takes about 6.4 ms median and 8 ms p95. It was 41.6 ms
    before the fix pass.
  - Only that rare mass event is over the 5 ms target. Getting it under 5 ms
    would mean limiting how many homes are matched per day, which changes
    gameplay and needs Andre's decision.
  - Codex's earlier 3.28 / 5.79 ms figures came from a cold 3-sample run. The
    same scenario swings between about 3.6 and 11 ms run to run.
- The top-bar Food stat wraps onto two lines ("30 / (+0/day)"). This is
  cosmetic.
- M5 behaviour (production, disconnected output dropping to 0, reconnecting)
  was verified in Andre's M6 play-test. The road-connection hints haven't
  been explicitly play-tested. Any fixes go in a follow-up commit.
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
- The debt banner and the economy panel can overlap on windows narrower than
  about 900 px. This is cosmetic.
- `docs/STAGE-1-PLAN.md` still uses the old folder name `the-city-life/`.

## GitHub

Repository: https://github.com/andrerlaster-lgtm/The-City

Branch: `main`

Working tree: clean. M6 (`931eb12`) and the M7 plan are pushed, and local
`main` matches `origin/main`.

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

## M5 Review Fixes (2026-10-04, Claude)

1. **Job-matching performance.**
   - The road BFS no longer creates any objects per tile.
   - A dense flag array means the BFS only looks up the workplace map on tiles
     that actually border a workplace.
   - Job-slot counts are looked up once per day.
   - The neighbour order (N, E, S, W) and the lowest-id tie-break are
     unchanged.
2. **Data-driven building types.** Code no longer checks hard-coded ids.
   - Food comes from buildings whose definition has `produces === 'food'`.
   - Revenue comes from `produces === 'revenue'`.
   - Homes are buildings with `housing > 0`; the duplicate list in migration
     is gone.
   - Service coverage uses `serviceRadius` and the building's real size.
   - `BALANCE.citizens.wellRadius` was removed. The Well's radius now comes
     only from its definition.
3. **Road-connection hints** (Andre's request; rendering and UI only):
   - **Entrance marker:** an arrow and an "Entrance" label float over the
     entrance tile, and the camera now opens centred on it. It used to start
     off-screen.
   - **Placement ghost:**
     - A touching road that reaches the Entrance glows green.
     - A touching road that doesn't reach it glows amber.
     - With no touching road, arrows mark the open tiles where a road would
       give access.
   - **Toolbar:** explains the situation, for example "build a road on one of
     the arrows" or "road doesn't reach the Entrance, so nobody can live or
     work here yet".
   - **Warning badge:** a "!" badge shows over every disconnected building.
   - **Hover:** the entrance tile reads "Settlement entrance".
   - The classification logic is the pure function
     `src/render/accessHints.ts`.
4. **Tests** (210, up from 197):
   - the access-hint classification
   - food exactly equal to the population
   - no food penalty with 0 citizens
   - the jobs, Well and food arrival terms combined
   - the Well radius boundary, and several Wells covering one home
   - a workplace demolished at 23:00
   - 40-day full-state determinism at 1× and 3×
   - a sixth building of each kind (food, revenue, housing, service) working
     from data alone
   - the 3-sample timing test is replaced by a warmed-up benchmark that
     includes the far-jobs worst case

## M6 Implementation (2026-10-04, Claude)

### Save files and loading
- **Format:** `{ format, version: 1, meta, state }`. The state holds the base
  layers (`terrain`, `variant`, `trees`, `roads`), the core values, the
  ledger, the id counters, buildings (`id`, `defId`, `x`, `y`) and citizens,
  sorted by id.
- **Never stored, rebuilt on load:** road connectivity, `buildingAt` and the
  building access flags (`sim/restore.ts`).
- **Load pipeline:** envelope check → migrate → full validation → rebuild.
  Migrations run before validation, so validation always sees the current
  schema.
- **Validation covers:** format and version, layer lengths, terrain ids,
  building types, building ids, overlaps, buildings on water, roads or off
  the map, citizen references, id counters, the entrance and speed, and the
  ledger shape.

### Pausing and seeds
- **Loads start paused:** `Game.replaceSimulation(sim, { paused: true })`
  and the startup path force speed 0. Space resumes at the saved speed.
- **New games:** an app-made seed at 1×, or a seed the player types. The
  seed is shown in the menu, can be selected, and has a Copy button. Each
  slot also shows its seed.

### Autosave and slots
- **Autosave runs:**
  - every 5 game days at 00:00
  - when the tab is hidden
  - before loading a manual slot or starting a new game
  - It's skipped before loading the autosave itself, so that load can't
    overwrite the save it's about to read.
- **Confirmations happen inside the panel.**
  - Loading a manual slot says "Your current city is autosaved first", which
    is accurate because of the autosave before loading.
  - Loading the autosave warns that progress since it was made will be lost.
- **Status messages** appear in the menu and as a short-lived toast.

### Safeguards and tests
- **Storage timeout:** see Known Issues.
- **Guards:** `src/sim` may not use `crypto`. `src/save` may not import
  rendering, UI or app code, and only the IndexedDB provider may use
  `idb-keyval`.
- **Tests** (69 new across `tests/save/` and the guards):
  - a round trip of save, clone, validate, load and then 30 days, identical
    to playing straight through at 1× and 3×
  - saves are identical for the same city and copy rather than share data
  - every validation rejection
  - migrations
  - the save service:
    - slots
    - autosave
    - startup continue and fallback
    - paused load
    - a rejected save never touches the game
    - storage errors and storage that never answers
  - save-and-load timing for 2,000 citizens
- **M5 performance test:** under the full parallel suite (load average about
  20) it was flaky. It now checks the far-jobs vs steady ratio, which is
  about 1–3 now and was about 27 before the M5 fix, plus a loose absolute
  bound. It still logs the medians and p95s.

## Per-building Output (2026-10-04, Claude, Andre's request)

- Clicking a Farm shows its daily food, for example "+10 food / day (5
  workers × 2)", or "needs workers".
- Clicking a Workshop shows its daily revenue the same way.
- The numbers come from `sim/resources/production.ts`, which uses the same
  rules as the daily step. Tests check that per-building output adds up to
  the city totals.
- Play-tested and committed with M6.

## Next Step

1. Andre confirms the balance targets in `docs/M7-PLAN.md`.
2. Implement M7 in the plan's order:
   1. Install Playwright and prove it can run the game on this Mac.
   2. The smoke suite.
   3. Bundle split.
   4. Reduced-motion support.
   5. Pop-in, dust, transitions, number tweening and the Food stat fix.
   6. Toasts.
   7. Balance pass.
   8. Private Vercel preview, plus Playwright against it.
3. Still open:
   - quick play-test of the M5 road-connection hints
   - the per-day job-matching limit, only if the hitch is noticeable

## Last Updated

Date: 2026-10-04
AI used: Claude (M7 plan; M6 plan and implementation; M5 plan, review and fix pass); Codex (M5 implementation; M4
implementation); Claude (M4 plan, review and fix pass)
