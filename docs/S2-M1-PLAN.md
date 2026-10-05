# S2-M1 — Foundations: Implementation Plan

**Status:** planned 2026-10-04. Not started.
**Parent plan:** `docs/STAGE-2-PLAN.md` §4.
**Builds on:** Stage 1 (`docs/STAGE-1-COMPLETION.md`).

**Goal:** give Stage 2 performance headroom and shared infrastructure, with
**no gameplay change.**
- Every Stage 1 scenario, balance, save and determinism test must pass
  **unchanged**.
- Rules: `src/sim` stays pure and deterministic, buildings stay
  data-driven, there are no new dependencies, and `production` is never
  touched.

---

## 1. Scope

1. **Generic coverage system.** The Well becomes the first `water` service,
   with identical behaviour.
2. **Overlay framework,** with two overlays: Water coverage and Road
   connectivity.
3. **Zoom-to-Entrance** button.
4. **Job-matching performance:** optimise and cache first. Add a per-day
   cap only if the benchmark still misses 5 ms (decision 6).
5. **Day-boundary frames:** spread the end-of-day UI refresh across frames.
6. **Test hardening:** the opt-in `@perf` Playwright fps check, and safer
   timing-sensitive tests.
7. **Docs fix:** the old folder name in `docs/STAGE-1-PLAN.md`.

**Not in M1:** happiness, new buildings, save format changes, touch work,
new dependencies.

## 2. Coverage system

**Data.** `serviceRadius: number` becomes:

```ts
services: readonly { kind: ServiceKind; radius: number }[]
// ServiceKind = 'water' (M1). M2 adds 'leisure', M3 'goods', M7 'health'.
```

The Well becomes `services: [{ kind: 'water', radius: 6 }]`, and other
buildings get `[]`.

**Simulation (`src/sim/services/coverage.ts`, pure):**
- `activeServices(state)`: connected service buildings that are staffed
  where they have jobs. This is the current `staffedWells` rule, generalised
  to any service kind.
- `isCovered(kind, home, sources)`: **the exact current rule** (the
  distance from the home's footprint centre to the source's footprint centre
  is ≤ the radius). Every gameplay decision uses this, so housing order and
  the arrival pull stay identical.
- `coverageMap(kind, sources, world)`: a per-tile `Uint8Array` (0/1, room for
  strength later), built **once per day** from tile centres. It's used for
  **overlays and later systems** (land value, happiness lookups), never for
  the Stage 1 decisions above.
- The existing `staffedWells`, `wellCovers` and `anyFreeHousingInWellCoverage`
  become thin wrappers or are replaced with no change in behaviour.
  Migration and housing call sites are updated.

**UI:** `InfoPanel` lists each service, for example "Water coverage: 6
tiles", instead of "Service radius".

**Tests:**
- `isCovered` gives the same results as the current `wellCovers` (the radius
  edge, a 2×2 home's centre, several sources).
- The coverage map matches tile-centre distances.
- A made-up sixth service building works from data alone (as in the Stage 1
  test).
- **All Stage 1 tests pass unchanged.**

## 3. Overlay framework (render and UI only)

- **`src/render/layers/OverlayLayer.ts`:** chunked tile tinting (16×16-tile
  chunks, one `Graphics` per chunk) above the terrain, below the roads and
  objects. It redraws only while visible and only for changed chunks.
- **Inputs are derived data only:**
  - **Water:** the simulation's daily water coverage map. A new read-only
    `Simulation.getCoverage(kind)` returns a copy or a read-only view.
  - **Road connectivity:** `roadConnected` and `roads`. It tints connected
    roads, disconnected roads, and building footprints that lack road
    access.
- **Overlay picker** (`ui/OverlayPicker.tsx`): None / Water / Road
  connectivity.
  - It includes a legend and an `O` keyboard shortcut to cycle overlays.
  - The keyboard shortcut is ignored while typing.
- **Reduced motion:** no transition animation.
- **The simulation never knows about overlays.** The renderer reads the data
  when the snapshot updates.

## 4. Zoom-to-Entrance

- A top-bar or toolbar button, plus the `Home` key: the camera returns to
  the Entrance (`Renderer.centreOnEntrance` already exists). With reduced
  motion it jumps there instead of animating.

## 5. Job matching performance (decision 6)

- **Baseline:** the far-jobs worst case is about 6.4 ms median and 8 ms p95.
- **Step 1, cache:**
  - Keep the road-to-workplace map and an index of workplaces sorted by id
    between days.
  - Rebuild them only when buildings or roads change: a "dirty" flag set by
    commands.
  - Reuse BFS buffers across homes.
  - Skip homes whose nearest reachable open job hasn't changed (memoise per
    home, invalidated when roads or workplaces change).
- **Step 2, measure** with the existing warmed-up benchmark (`scenarios.test.ts`)
  plus a new far-jobs case in a separate benchmark file.
- **Step 3, only if the median is still above 5 ms:** add a per-day cap on
  homes matched, at `BALANCE.citizens.maxHomesMatchedPerDay`.
  - Homes are processed in id order, and the rest continue the next day,
    which stays deterministic.
  - Document the decision and its effect on the scenario tests.
- **No change in results:** for the same state, matching must produce exactly
  the same assignments as today. A comparison test runs old vs new on the
  scenario towns. If a cap is ever added, results change by design, and
  that's documented.

## 6. Day-boundary frames

- **Measure first:** use the `@perf` spec (§7) to find whether the 49 ms frames
  come from the daily simulation step, `snapshot()`, or React re-rendering.
- **Likely fixes**, in render, UI and app only:
  - Build the snapshot once per frame, not per tick.
  - Update the top bar and panels in `requestAnimationFrame` instead of
    synchronously.
  - Reuse `snapshot()` results within a frame.
  - Leave anything heavier as a measured note.
- **Target:** at 3× with 2,000 citizens, ≤ 1% of frames over 20 ms and no
  frame over 33 ms. Report honestly if it isn't met.

## 7. Test hardening

- **`tests/e2e/perf.spec.ts` (tagged `@perf`), excluded from the default
  run:**
  - Turn the throwaway Stage 1 measurement into a kept spec: build a valid
    128×128 save with 2,000 citizens, write it to the autosave slot, reload,
    and measure fps paused and at 3×.
  - Run it with `npm run test:e2e:perf`, headed, using the local GPU.
  - It logs fps and p95. It **asserts only very loose limits** (average
    fps ≥ 50), because machine load varies.
- **Playwright environment probe:** raise the IndexedDB timeout from 3 s to
  10 s.
- **Real-time e2e tests** (clock, starter town): give their polls more
  headroom.
- **No changes** to how the default suite asserts gameplay.

## 8. Files likely to change

- **`src/data/buildings.ts`:** add `services`, remove `serviceRadius`.
- **`src/sim/services/coverage.ts`:** generic coverage.
- **Call sites:** `src/sim/daily.ts`, `src/sim/citizens/{housing,migration}.ts`.
- **`src/sim/citizens/jobs.ts`:** caching.
- **`src/sim/Simulation.ts`:** `getCoverage`, the dirty flags.
- **New in render:** `src/render/layers/OverlayLayer.ts`.
- **`src/render/Renderer.ts`:** overlay layer, `centreOnEntrance` made
  public.
- **`src/app/Game.ts`:** overlay state, the Home key, the per-frame
  snapshot.
- **UI:** new `src/ui/OverlayPicker.tsx`; `TopBar` or `ToolBar` for the
  Entrance button; `InfoPanel` for the service lines; a CSS file.
- **Tests:**
  - `tests/sim/coverage.test.ts`
  - a job-matching equivalence and benchmark test
  - `tests/e2e/perf.spec.ts`
  - one or two smoke tests (overlay picker and legend; the Entrance button)
- **Config:** `playwright.config.ts` (exclude `@perf` by default), and a
  `package.json` script.
- **Docs:** `docs/STAGE-1-PLAN.md` (folder name fix) and `PROJECT_STATE.md`.

Every file stays under 400 lines.

## 9. Playwright

- **Default suite:** 10 → 12 tests.
  - New: the overlay picker switches to Water and shows its legend; the
    Entrance button recentres the camera, verified by hovering the Entrance
    tile.
- **`@perf`:** opt-in, headed, run at the end of the milestone and recorded
  in `PROJECT_STATE.md`.
- The default suite runs locally **and** against the milestone's protected
  preview (`main` push → preview, accessed with OIDC).

## 10. Manual play-test

1. Gameplay feels identical to Stage 1: the same arrivals, jobs, food and
   money.
2. The Water overlay matches the Well circles. The Road connectivity overlay
   highlights disconnected roads and buildings.
3. The `O` key cycles overlays, and the Entrance button and `Home` key
   recentre the camera.
4. **The M5 road-connection hints, checked on their own (carried forward):**
   arrows, green and amber road glows, and "!" badges.
5. At 3× with a large city there's no noticeable hitch at midnight.

## 11. Acceptance criteria

1. No gameplay change: all Stage 1 scenario, balance, save, determinism and
   building tests pass **unchanged**, and the job-matching results match the
   old ones exactly.
2. The Well runs on the generic coverage system, and a sixth service building
   needs only data.
3. Water and Road connectivity overlays, with a legend and keyboard cycling,
   built from derived data only.
4. Zoom-to-Entrance works by button and key.
5. The worst-case simulation day is ≤ 5 ms median in the benchmark, using
   caching alone or, if needed, the documented cap.
6. Day-boundary frames are measured and improved. The target is met, or the
   gap is documented.
7. The `@perf` fps check is kept and documented. The timing-sensitive tests
   are hardened.
8. Tests, typecheck, build and `git diff --check` pass. Playwright passes
   locally and against the protected preview. `src/sim` stays pure. No file
   is over 400 lines. `production` is untouched.
