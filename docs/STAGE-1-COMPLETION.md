# Stage 1 — Completion Audit

**Date:** 2026-10-04. Audited by Claude.

**Scope:** every acceptance criterion in `docs/STAGE-1-PLAN.md` §6, plus the
milestone plans:
- M0–M2: their scope is in `STAGE-1-PLAN.md` §5. They have no separate plan
  files.
- M3–M7: `docs/M3-PLAN.md` … `docs/M7-PLAN.md`.

**Codebase at audit time:** `main` = `origin/main` = `10f753a`. The working
tree was clean before this document.

**Verdict:** **Stage 1 is complete.**

| Result | Count |
|---|---|
| PASS | 25 |
| PARTIAL | 3 |
| FAIL | 0 |

Nothing blocks Stage 2. The partials and the carried-forward items are below.

Legend:
- **PASS**: verified by automated tests and/or a recorded play-test or
  measurement.
- **PARTIAL**: mostly met, with a named gap.
- **NOT VERIFIED**: no evidence either way.
- **FAIL**: not met.

---

## 1. Acceptance criteria

### World
| # | Criterion | Result | Evidence |
|---|---|---|---|
| 1 | A 128×128 map is generated from a seed, and the same seed always gives the same map | **PASS** | `tests/sim/world.test.ts` ("identical for the same seed", 5 seeds); `BALANCE.map` 128×128 |
| 2 | Camera pans (drag/keys) and zooms (wheel/pinch) smoothly, within limits | **PARTIAL** | Drag, keys and wheel were play-tested (M1, M2) and the zoom and pan limits are tested (`cameraMath.test.ts`). **Pinch was never verified on a touch device**, and on touch a one-finger drag with a drag tool still pans (carried forward). |
| 3 | Changing the map size setting needs no code changes | **PARTIAL** | Generation and the simulation work at other sizes (`world.test.ts` 64×200), and the renderer and camera maths take size as input. **It was never run in a browser at a size other than 128×128.** A save made at a different size is refused on load, with a reason (`Game.replaceSimulation`). |

### Roads
| # | Criterion | Result | Evidence |
|---|---|---|---|
| 4 | Drawn by dragging, cost per tile, connect visually | **PASS** | `roads.test.ts` and `tileLine` tests (4-connected); Playwright "builds a starter town" checks the treasury drops by 10 per tile; M2/M3 play-tests (alignment, connectors) |
| 5 | Roads not linked to the entrance are shown as disconnected | **PASS** | `RoadLayer` disconnected tint, plus "!" badges on buildings (M5); connectivity tests; M2/M5/M6 play-tests |
| 6 | Roads and buildings can be demolished | **PASS** | `buildings.test.ts` (whole-building, mixed strokes, entrance protected, no refund); Playwright hover-chip test demolishes a Cottage |

### Buildings
| # | Criterion | Result | Evidence |
|---|---|---|---|
| 7 | Five buildings come from data; a sixth needs one data entry plus art | **PASS** | `src/data/buildings.ts`. `tests/sim/citizenEdgeCases.test.ts` adds sixth buildings of each kind (food, revenue, housing, service) purely as data. There's a generic art fallback. (The `BuildingId` union in the same file also gets the new id.) |
| 8 | Ghost shows valid/invalid with a reason; invalid placement does nothing and charges nothing | **PASS** | Placement tests (each rule in order, state unchanged); road-access arrows and glow (M5); Playwright toast test ("Needs road access"); M3 play-test |
| 9 | Clicking a building shows name, description, cost, capacity or jobs, and occupants or workers | **PASS** | `InfoPanel` with live occupancy, plus Farm food and Workshop revenue; M5/M6 play-tests |

### Citizens
| # | Criterion | Result | Evidence |
|---|---|---|---|
| 10 | Housing only: a few arrive, can't find work, and leave | **PASS** | `scenarios.test.ts` ("housing without jobs …") |
| 11 | With housing, farms and workshops, the population fills housing and jobs, then levels off | **PASS** | `scenarios.test.ts`; `balance.test.ts` (starter town flat at 12 for the last 20 days) |
| 12 | Removing all farms causes hunger, then departures | **PASS** | `scenarios.test.ts` (food → 0, hunger departures > 0) |
| 13 | Citizens are never directly controlled | **PASS** | `PlayerCommand` has no citizen commands (`src/sim/commands.ts`) |

### Economy and time
| # | Criterion | Result | Evidence |
|---|---|---|---|
| 14 | The treasury drops on construction and upkeep and rises with taxes; the top bar shows income vs. expenses | **PASS** | `economy.test.ts` (ledger, net, projection = actual); per-day figure and Economy panel; M4/M5 play-tests |
| 15 | Pause/1×/2×/3× work; the same commands from the same save give the same result at any speed | **PASS** | `loop.test.ts`; economy and citizen determinism tests at 1× and 3×; `serialize.test.ts` "save → load → 30 days equals 30 days without saving, at 1× and 3×"; Playwright clock test |
| 16 | The top bar shows treasury, population, free housing, free jobs and the date | **PASS** | `TopBar.tsx` (plus food); Playwright boot and 400 px tests |

### Save
| # | Criterion | Result | Evidence |
|---|---|---|---|
| 17 | Save and load restore roads, buildings, citizens, treasury, food and date exactly | **PASS** | `serialize.test.ts` (deep-equal state, derived data rebuilt); Playwright "saves, then continues paused after a reload with the same seed" (local and preview); M6 play-test |
| 18 | Saves carry a format version, and a migration step exists | **PASS** | `SAVE_VERSION = 1`; `migrations.test.ts` (v1 passes through, newer refused, steps chain) |

### Quality
| # | Criterion | Result | Evidence |
|---|---|---|---|
| 19 | `src/sim/` imports no rendering or UI code (test) | **PASS** | `tests/architecture/boundaries.test.ts`: no Pixi, React, DOM, timers, `performance`, `crypto` or `Math.random`. It also guards `src/save/` and keeps Playwright out of `src/`. |
| 20 | Sim tests for placement, connectivity, migration, economy and save round-trip | **PASS** | 378 unit tests (`buildings`, `roads`, `migration`, `economy`, `save/*`, `scenarios`, `balance`) |
| 21 | A test validates every building definition | **PASS** | `tests/data/buildings.test.ts` |
| 22 | Tests can set up a city scene without a browser | **PASS** | `tests/helpers/scene.ts` (`createFlatScene`, `createConnectedTown`, `runDays`) |
| 23 | Job matching uses road distance and is the same every run | **PASS** | `jobs.test.ts` (road vs. straight-line distance, ties, stable jobs); determinism tests |
| 24 | A backgrounded tab doesn't burst on return; resuming from pause doesn't either | **PASS** | `FixedStepper` caps at 8 ticks per frame and throws away the rest, and pausing clears the accumulator (`loop.test.ts`). Pixi also caps frame time at 100 ms. |
| 25 | Stays at 60 fps on a MacBook with a full 128×128 map and 2,000 citizens | **PASS** | **Measured 2026-10-04** (§2): 59.3 fps average at 3× (p95 frame 17.6 ms), 60.3 fps paused. 8 of 712 frames went over 20 ms (worst 49 ms), around day boundaries. |
| 25b | …a sim day takes under 5 ms | **PARTIAL** | A normal day is about 1.9 ms (p95 3–4 ms). The rare worst case, with all 2,000 unemployed and the jobs at the far edge (for example, reconnecting a cut district), takes about 6.4 ms median / 8 ms p95. It was 41.6 ms before the M5 fix. |
| 26 | No file over ~400 lines | **PASS** | Enforced by `boundaries.test.ts`. The largest file is `hud.css` (305 lines), and the largest TypeScript file is `Game.ts` (260 lines). |
| 27 | Deployed as a private Vercel preview; the first deploy's production aliases are removed and it's redeployed as a preview | **PASS** | §3. The first deploy went to production, its public alias was removed, the real preview was deployed, and later the production deployment was deleted. |

## 2. Performance

- **Frame rate** was measured 2026-10-04 with a temporary Playwright spec
  (not kept), in **headed** Chrome on the Mac's GPU.
  - **City:** 128×128 map, 21 road rows plus a spine road, 125 Rowhouses,
    250 Workshops, 2,000 employed citizens. It was loaded through the real
    save path (written to the autosave slot, then continued on reload).
  - **Paused:** 60.3 fps, p95 frame 17.6 ms, 0 frames over 20 ms.
  - **3× for 12 s (3 game days):** 59.3 fps, p95 17.6 ms, 8 of 712 frames
    over 20 ms, worst 49 ms. The long frames line up with the daily step plus
    the UI refresh after it.
  - The Mac was heavily loaded at the time by other apps (load average about
    20), so these are conservative numbers.
- **Simulation day:** warmed-up benchmark in `tests/sim/scenarios.test.ts`
  (logged each run). Normal is about 1.9 ms. Worst case, everyone
  unemployed with the jobs far away, is about 6.4 ms.
- **Bundle:**

  | Chunk | Before | After |
  |---|---|---|
  | Main | 627 kB (187 kB gzipped) | 413 kB (120 kB gzipped) |
  | React vendor chunk | inside the main chunk | 219 kB (68 kB gzipped) |

  Pixi's lazily loaded chunks are kept separate, and there's no size warning.

## 3. Deployment, protection and branch safety

- **Git integration:** the Vercel project `the-city`
  (`prj_P7mAPw72IJWhOsuGMwC2Ry2h3sjx`) is linked to
  **`andrerlaster-lgtm/The-City`**.
  - The stray `sim-game` repo is disconnected. Andre will archive it rather
    than delete it.
- **Branches:**
  - `main` → automatic **Preview** deployments.
  - Production branch = **`production`**, which exists at `e1fc012`. It's
    never pushed without Andre's explicit request.
- **Deployments:**
  - two Previews, both Ready: CLI `p3dj2g5ib`, and Git `2kvfavadj` with
    alias `the-city-git-main-…`
  - **0 production deployments**
- **Protection:**
  - Vercel Authentication (`all_except_custom_domains`).
  - Every preview URL redirects to the Vercel login when logged out.
  - No environment variables exist.
- **Playwright:**
  - 10 tests, all passing against the local production build **and** against
    the Git-built protected preview.
  - Access uses the short-lived OIDC token (`vercel env run`), attached only
    to the preview's origin (`tests/e2e/fixtures.ts`). Traces are off for
    remote runs.
  - The automation-bypass secret is unused, and Andre considers it safe to
    revoke.
- **Branch safety caveat:** with the current protection mode, a production
  `*.vercel.app` address is **public**. A push to `production` is therefore a
  public release.
  - *Recommendation:* add a GitHub branch-protection rule on `production`
    (for example, require a pull request) so it can't be pushed by accident.

### Pre-Stage-2 safety checks (verified 2026-10-04, after the audit)

| Check | Status |
|---|---|
| `production` protected against direct pushes | **Blocked.** Approved and attempted (pull request required, enforced for admins). GitHub returned HTTP 403, "Upgrade to GitHub Pro or make this repository public", for both branch protection and rulesets on this private personal repo. **Andre chose to keep the `production` → public release model, with no Vercel guard.** |
| `sim-game` archived | **Done.** Archived on 2026-10-04 (read-only, still public, unused by Vercel). |
| Automation-bypass secret revoked | **Done.** Revoked on 2026-10-04 through Vercel's API (`regenerate: false`), leaving 0 entries. Playwright still reaches the preview with OIDC. |
| No production deployment | **Holds.** 0 production deployments, and `production` hasn't been pushed since it was created at `e1fc012`. |

**Options for guarding `production` without GitHub Pro:**
1. **Vercel side (recommended).** Add `"git": { "deploymentEnabled": { "production": false } }`
   to `vercel.json`. Then even an accidental push to `production` deploys
   nothing. A real release would be a deliberate `vercel promote` or a
   reviewed change to this setting.
2. A local `pre-push` git hook that refuses pushes to `production`. This
   only protects this machine.
3. Upgrade to GitHub Pro, or make the repo public, and add a
   branch-protection rule.

## 4. Playwright coverage (10 tests)

**Covered:**
1. The environment works (WebGL, IndexedDB, timers).
2. Boot with no console errors.
3. Clock and pause.
4. A starter town built through the real UI: road cost, building costs,
   citizens arriving, Farm food per day.
5. Save, reload, and continue paused with the same seed.
6. A new game with a typed seed.
7. A 400 px layout with no wrapping or overflow.
8. Reduced motion.
9. An error toast closes on its own.
10. The hover chip clears after a demolish.

**Not covered by Playwright** (covered by unit tests or play-tests instead):
- Economy and Citizens panel contents
- Well coverage preference
- disconnected-road visuals
- pop-in and dust visuals
- pinch and touch input
- 2,000-citizen frame rate (measured once, §2, not part of the suite)

## 5. Carried forward (none block Stage 2)

1. **Worst-case simulation day:** about 6.4–8 ms when everyone is unemployed
   with the jobs far away. A per-day job-matching limit is the fix, if the
   hitch is noticeable.
2. **Day-boundary frames at 3×:** occasional long frames (worst 49 ms) with
   2,000 citizens. Options: spread the daily step's UI refresh across
   frames, or measure first on a less loaded machine.
3. **Touch:** a one-finger drag with a drag tool can pan the camera, and
   pinch zoom hasn't been verified on a device.
4. **Map size:** only same-size saves can be loaded. A non-128 map hasn't
   been run in a browser.
5. **Two tabs:** two tabs autosaving at once means the last write wins.
6. **M5 hints:** the road-connection hints haven't been play-tested on their
   own. (They were used throughout later play-tests, and the
   `accessHints` logic is unit-tested.)
7. **Flaky timing tests under heavy machine load:** the M5 performance test,
   the Playwright environment probe and the real-time clock and town tests.
   They pass on a rerun.
8. **Production branch:** pushing `production` creates a public production
   deployment. GitHub branch protection isn't available on the current plan
   (§3, safety checks). Use the Vercel-side guard instead.
9. **Housekeeping:**
   - archive `sim-game` (Andre)
   - optionally revoke the unused automation-bypass secret
   - `docs/STAGE-1-PLAN.md` still uses the old folder name `the-city-life/`
   - M0–M2 have no separate plan files

## 6. Stage 2 readiness

**Ready: YES.**
- All Stage 1 milestones (M0–M7) are done and play-tested.
- 25 criteria pass, 3 are partial with named gaps, and none fail.
- The simulation is pure and deterministic, and saves are versioned.
- Browser tests run locally and against a protected preview.
- Before Stage 2 begins, agree which carried-forward items (§5) to fold into
  Stage 2 planning.
