# S2-M2 — Happiness + Small Park: Implementation Plan

**Status:** planned 2026-10-05. Decisions approved by Andre. Not started.
**Parent plan:** `docs/STAGE-2-PLAN.md` §4 (S2-M2) and §5 (building table).
**Builds on:** S2-M1 (`docs/S2-M1-PLAN.md`): the coverage system, the
overlay framework and the map version.

**Goal:**
- add citizen happiness with readable causes
- add the Small Park as the first `leisure` service
- wire in the approved low-happiness departure rule

**Rules:**
- `src/sim` stays pure and deterministic.
- Buildings stay data-driven, and all weights live in `BALANCE`.
- No new dependencies.
- `production` is never touched.

**Out of scope:** land value, new housing, taxes and policies, traffic,
water utility, health, education, tourism, disasters, production changes.

---

## 1. Approved decisions (Andre, 2026-10-05)

1. **Unhappy departures:**
   - Implement the counter and the rule now: below 25 for 10 consecutive
     days means the citizen leaves, and 25 or higher resets the counter.
     Thresholds go in `BALANCE`.
   - **Don't add an artificial "no services" penalty** to make the rule
     trigger.
   - It's fine if the rule rarely triggers in S2-M2. Later negative inputs
     (taxes, pollution) will make it matter.
   - Don't distort the model so that every new mechanic fires immediately.
2. **The Small Park needs road access.**
   - It must stay connected to the Entrance.
   - It gives **no** leisure coverage while disconnected.
3. **Top bar:** shows the **city average happiness only.** The full
   breakdown and the departure countdown go in the home's info panel.
4. **Radius ring while placing a Park:**
   - built on the S2-M1 coverage and overlay framework
   - lightweight
   - respects reduced motion

## 2. Happiness model

**Who is scored:**
- Each citizen **in a connected home** gets a score (integer, 0–100) once a
  day.
- Homeless citizens and citizens in disconnected homes aren't scored. The
  existing homeless rule covers them, and their counter resets to 0.

**Formula:** the sum of the parts below, clamped to 0–100.

| Part | Condition | `BALANCE.happiness` | Value |
|---|---|---|---|
| Base | always | `base` | 45 |
| Water | home is covered by an active `water` service (a staffed Well, the existing rule) | `water` | +15 |
| Leisure | home is covered by an active `leisure` service (a connected Park) | `leisure` | +15 |
| Employment | citizen has a job | `employed` | +15 |
| Food | `hungryDays === 0` → fed; otherwise → hungry | `fed` / `hungry` | +10 / −15 |

**Example scores:**
- every part met: 100
- a typical Stage 1 worker (job and food, no Well): 70
- the same worker near a Well: 85
- worst case (no job, hungry, no services): 30

With S2-M2's inputs, the departure rule effectively never triggers. That
was accepted in decision 1.

**Penalties:** the breakdown keeps a `penalties` line (only "Hungry" in
S2-M2). It's ready for pollution (M4), tax (M5) and health (M7).

**Code:**
- `src/sim/citizens/happiness.ts` (pure).
- `happinessParts(citizen, home, coverage, weights = BALANCE.happiness)`
  returns each part and the clamped total.
- The weights are a parameter, so tests can use other values.
- **Home score:** the average of its residents. **City score:** the average
  over scored citizens (0 citizens → no value, shown as "–").
- **Nothing derived is saved.** The score is recalculated from state. The
  UI shows current conditions; the daily step uses the conditions at day
  close.

**Coverage:**
- **Kinds:** `ServiceKind` becomes `'water' | 'leisure'`.
- **Active services:** S2-M1's `activeServices` already treats a service
  with no jobs as active whenever it's connected.
- **Decisions use `isCovered`**, the footprint-centre rule, the same as the
  Well. The per-tile map is used only for overlays and the ring.

## 3. Small Park

- **Values** (`src/data/buildings.ts`, from Stage 2 plan §5):
  - `id: 'park'`, category Service
  - size 1, cost 80, upkeep 1
  - housing 0, jobs 0, `produces: null`
  - `services: [{ kind: 'leisure', radius: 5 }]`
  - `requires: { roadAccess: true, terrain: land }`
- **Art:** a new procedural texture in render: a green patch, a small tree
  and a bench, in the same style as the other buildings.
- **Info panel:**
  - "Leisure coverage: 5 tiles"
  - homes in range
  - a "Not connected — no coverage" note when cut off

## 4. Citizens and the daily step

**New field:** `Citizen.unhappyDays: number`.
- `emptyCitizen` sets it to 0.

**New daily order in `daily.ts`:**
1. production
2. consumption
3. economy
4. jobs
5. **happiness**
6. migration

**The happiness step** (`updateHappiness`):
- For each scored citizen:
  - score below `BALANCE.happiness.leaveBelow` (25): `unhappyDays++`
  - otherwise: reset to 0
- Unscored citizens reset to 0.
- Coverage is calculated once per step for each kind.

**Departures** (`migration.ts`):
- The reasons are checked in this fixed order: hunger, unemployment,
  homeless, **unhappy** (`unhappyDays >= BALANCE.happiness.unhappyDaysBeforeLeaving`,
  10).
- `MigrationSummary.left` gains `unhappy`.

**Arrivals, weighted by happiness:**
- **`leisurePull`:** +1 when any connected home with free space is covered
  by leisure. This mirrors `wellPull`.
- **`happinessPush`:** −1 when the city average is below
  `BALANCE.happiness.lowCityAverage` (40).
- The formula is otherwise unchanged:
  `min(free, maxArrivalsPerDay, max(0, jobsPull + wellPull + leisurePull − foodPenalty − happinessPush))`.

**Which homes newcomers fill** (`assignHomeless`):
- Homes are ranked by served-ness (water + leisure, by weight), then by
  distance from the Entrance, then by id.
- Without parks, this is exactly the Stage 1 order (Well first).

**Stage 1 cities with no parks behave identically:**
- no leisure pull
- an average of 70 or more, so no push
- the same ranking
- the counter never triggers

## 5. BALANCE

```ts
happiness: {
  base: 45,
  water: 15,
  leisure: 15,
  employed: 15,
  fed: 10,
  hungry: -15,
  leaveBelow: 25,
  unhappyDaysBeforeLeaving: 10,
  lowCityAverage: 40,
  /** Toast once when any resident has been unhappy this many days. */
  warnUnhappyDays: 5,
  /** Toast once when food will run out within this many days. */
  warnFoodDays: 3,
},
```

The Park's radius, cost and upkeep live on its definition, the same way as
the Well's.

## 6. UI (React; reads from the simulation only)

- **Top bar:** one new stat, "Happiness", the city average only (decision
  3).
- **Citizens panel:**
  - average happiness
  - the count of unhappy residents (`unhappyDays > 0`)
  - the departure reasons now include "unhappy"
- **Info panel for a home:**
  - its score, for example "72 / 100"
  - **Water:** +15, or "none nearby"
  - **Leisure:** +15, or "no Park nearby"
  - **Employment:** for example "3/4 employed, +11 average"
  - **Food:** "fed +10", or "hungry −15"
  - **Penalties**
  - when anyone there is counting down: "2 residents unhappy — leaving in
    4 days"
- **Toasts** (each shown once per episode; it clears once the condition
  clears):
  - **Low food:** food will run out within `warnFoodDays` at the current
    rate.
  - **Unmet needs:** any resident has been unhappy for `warnUnhappyDays`
    days, for example "Residents are unhappy — check the Happiness
    overlay".
- **Simulation API:**
  - `getHomeHappiness()` returns, per home, the score and its breakdown.
    It's cached on the map version.
  - `snapshot()` gains `happiness` (the city average, or `null`) and
    `unhappy` (a count).

## 7. Overlays and the placement ring

- **Leisure overlay:** the per-tile `leisure` coverage map, drawn the same
  way as Water.
- **Happiness overlay:** home footprints tinted by home score:
  - 60 or more: good
  - 25 to 59: warn
  - below 25: bad
  - it has a legend
- **Order:** None → Water → Leisure → Happiness → Roads. The `O` key cycles
  through it.
- **Radius ring while placing a Park:**
  - A thin ellipse at the Park's leisure radius around the ghost's centre,
    plus a faint tint of the tiles it would cover. The tiles come from the
    coverage rule (`coverageMap` for a single source).
  - It's redrawn only when the ghost moves to another tile, with no
    animation, so reduced motion needs no special case.
  - It's hidden when the Park can't be placed on that tile.
- **Pure helper:** the ring's tiles come from `src/render/overlays.ts`,
  which is unit-tested.

## 8. Save v2 (the first real migration)

- `SAVE_VERSION = 2`
- **`MIGRATIONS[1]`:**
  - every citizen gets `unhappyDays: 0`
  - `economy.today.migration.left.unhappy = 0`
  - `economy.lastDay?.migration.left.unhappy = 0` (when the report exists)
- **`validate.ts`:**
  - `unhappyDays` must be a non-negative integer
  - `left.unhappy` must be present
- **Not stored:** coverage and happiness scores.
- **Committed fixture:** `tests/save/fixtures/stage1-v1.json`, a real v1
  save with citizens and buildings, generated once from the current build
  and tagged with typed arrays. **It must load and play** in v2 and every
  later version.

## 9. Determinism and performance

- **Determinism:**
  - integer weights only
  - no randomness
  - a fixed order (citizens in id order, homes in id order)
- **Expected cost:** small.
  - leisure coverage for about 125 homes × a few dozen parks
  - one pass over 2,000 citizens
  - expected under 0.3 ms per day
- **Benchmark:** the warmed-up benchmark gains a variant with parks.
  - The worst-case day stays at or under 5 ms (currently about 4.5 ms).
  - The steady day stays at about 2 ms.
- **Overlays:**
  - The Happiness overlay redraws only when the map version changes.
  - The ring redraws only when the tile changes.

## 10. Tests

**Unit:**
- each part of the formula
- clamping at 0 and 100
- the weights parameter
- unscored citizens
- the counter:
  - `unhappyDays` stays at 0 at a score of exactly 25
  - it goes up at 24
  - it resets at 25 or higher
  - the citizen leaves on the day it reaches 10, and not on the day it
    reaches 9
- the departure reason order
- a disconnected Park gives no coverage
- the Park data entry and the `leisure` kind
- arrivals:
  - `leisurePull`
  - `happinessPush`
  - the Stage 1 formula is unchanged without parks
- the home ranking is the same as Stage 1 without parks
- the Happiness and Leisure overlay tints, and the ring tiles

**Scenario:**
- A town with a Park grows faster than the same town without one over 60
  days.
- An unhappy town loses people. This test uses test weights (for example
  `base: 0`), because the real weights don't trigger it (decision 1).
- A citizen who recovers gets a reset counter.
- **Every Stage 1 scenario, balance and determinism test passes
  unchanged.**

**Save:**
- the v1 → v2 migration, field by field
- the Stage 1 fixture loads and plays 10 days
- a v2 round trip
- a newer save is still refused

**Determinism:** in a town with parks, the full state is the same at 1×
and 3×, and the same before and after save → load.

**Playwright:**
- **New test:** place a Park next to a home, run a day, and confirm that
  the home's panel shows "Leisure +15" and a higher score. The total
  becomes 13 tests (the limit is 16).
- **Overlay test:** extended to Leisure and Happiness.

**QA agent:** the full suite (unit, typecheck, build, Playwright, diff
check).

**Performance agent:**
- the warmed-up benchmark, including the park variant
- worst-case day at or under 5 ms
- the @perf frame-rate check with 2,000 citizens

## 11. Files likely to change

- **Simulation:**
  - `src/sim/citizens/happiness.ts` (new)
  - `citizens.ts`, `migration.ts`, `housing.ts`
  - `src/sim/daily.ts`
  - `src/sim/Simulation.ts`
  - `src/sim/economy/economy.ts` (the departure-summary shape)
- **Data:** `src/data/buildings.ts` (Park, `leisure`), `src/data/balance.ts`
- **Save:**
  - `src/save/format.ts`
  - `migrations.ts`
  - `validate.ts`
- **Render:**
  - building art
  - `src/render/overlays.ts`
  - `placementGhost.ts` (the ring)
  - `Renderer.ts`
- **UI:**
  - `TopBar.tsx`
  - `InfoPanel.tsx`
  - the Citizens panel
  - `MapControls.tsx` (via `OVERLAY_ORDER`)
- **App:** `Game.ts` (the warning toasts, the ring)
- **Tests:**
  - new: happiness, park, migration, overlay and scenario tests, plus the
    v1 fixture
  - the overlay e2e test is extended, and one e2e test is new

All files stay under 400 lines.

## 12. Manual play-test

1. **Placing a Park:** the radius ring shows, then the Park is placed.
2. **Overlays:** Leisure shows the Park's coverage. Happiness shows covered
   homes rising.
3. **Home info panel:** the breakdown is clear (water, leisure, employment,
   food, penalties).
4. **Top bar:** shows the city average.
5. **Growth:** a park-covered area fills first, and the town grows faster.
6. **Cut-off Park:** cut its road, and its coverage and bonus disappear.
   Reconnect it, and they return.
7. **Low food:** the warning toast appears once.
8. **Old save:** a Stage 1 save loads and plays normally.
9. **Citizens panel:** shows average happiness and the reason list,
   including "unhappy" (expected to stay at 0 in normal play, per decision
   1).

## 13. Acceptance criteria

1. Happiness is calculated daily from `BALANCE` weights, and every home's
   causes are visible.
2. The Small Park:
   - works as specified
   - needs road access and a connection
   - shows a radius ring while placing
   - has a Leisure overlay
   - attracts people
3. The counter and the departure rule match the approved rule exactly, and
   are tested at both boundaries.
4. Save v2 loads Stage 1 saves (the committed fixture), and determinism
   holds through save → load.
5. Every Stage 1 scenario, balance and determinism test passes unchanged.
6. Checks:
   - typecheck, build and unit tests pass
   - Playwright passes, at 16 tests or fewer
   - the protected preview passes Playwright
7. Performance:
   - the worst-case simulation day is at or under 5 ms
   - the @perf check passes
8. Andre's play-test passes.
