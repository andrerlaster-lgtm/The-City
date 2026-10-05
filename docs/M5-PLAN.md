# M5 — Citizens: Implementation Plan

Status: **approved 2026-10-04**, ready for implementation.
Parent plan: `docs/STAGE-1-PLAN.md` (section 2, simulation rules; section 5, M5;
section 6, Citizens acceptance criteria). Builds on `docs/M4-PLAN.md`.

The core rule still holds: **the simulation never knows the screen exists.**
`src/sim/` stays pure TypeScript. It uses no `Math.random()`, no timers and no
browser APIs. No new dependencies.

M5 completes the Stage 1 loop:
**build → people move in → they work → money comes in → expand → population grows.**

---

## 1. Approved decisions

1. **No randomness in M5.**
   - Arrivals and every other choice follow fixed, deterministic rules.
   - The seeded `Rng` stays available for later variety, and `rngState` is
     left untouched.
2. **Starting numbers**, approved as a set. They all live in `BALANCE`, and M7
   tunes them:

   | Setting | Value |
   |---|---|
   | Tax per resident | 1 coin per day |
   | Tax per employed citizen | 2 coins per day |
   | Workshop revenue | 2 coins per worker per day |
   | Farm output | 2 food per worker per day |
   | Food eaten | 1 per citizen per day |
   | Starting food | 30 |
   | Max arrivals | 4 per day |
   | Leaves after | 5 days hungry, 7 days unemployed, 3 days homeless |
   | Well radius | 6 tiles; the Well needs its 1 worker |

3. **Disconnection.** When a home loses its road connection to the entrance,
   its residents keep the home but count as homeless and lose their jobs. They
   leave after 3 days unless the road is reconnected first.
4. **Stable jobs.**
   - Citizens keep their job while their home and their workplace both stay
     connected.
   - Each day, only unemployed citizens are matched to jobs.
5. **The Well needs staffing.** A Well gives its boost only while its 1 job is
   filled.

## 2. Scope

M5 adds:
- citizens as plain data
- arrivals at the entrance, paused while the treasury is ≤ 0
- housing assignment
- job matching by road distance
- food (farms produce it, citizens eat it)
- the Well coverage boost
- departures (hunger, unemployment, no home)
- real taxes plus workshop revenue
- live top-bar stats
- residents and workers shown in building panels

### Daily step order

Everything runs inside the daily step at 00:00, in the Stage 1 order:

1. **Production**
2. **Consumption**
3. **Economy**
4. **Jobs**
5. **Migration**
6. **Stats**

### Waits for later

- **M6:** saving and loading.
- **M7:**
  - toasts and notifications
  - the balance pass
  - pop-in animations
- **Stage 2 and later:**
  - visible walking citizens
  - traffic and pathfinding
  - a full happiness or mood system beyond the Well
  - households and families
  - aging, births and deaths
  - skills and education
  - an adjustable tax rate
  - more services
  - food logistics
  - running the simulation in a Web Worker

## 3. Citizen model

### State

| Field | Meaning |
|---|---|
| `GameState.citizens: Citizen[]` | All citizens, sorted by id |
| `GameState.nextCitizenId` | The next citizen id. It's a separate counter, so building ids stay predictable |
| `GameState.food: number` | The city's food stock. It starts at `BALANCE.citizens.startingFood` (30) |

### Citizen fields

```ts
interface Citizen {
  id: number;
  home: EntityId;          // 0 = none
  job: EntityId;           // 0 = none
  hungryDays: number;
  unemployedDays: number;
  homelessDays: number;
}
```

Everything is plain data, so M6 can save it as-is.

### Derived counts and rules

- **Counts per building** (residents and workers) are derived, never stored.
  They come from a count map built when needed and from `getOccupancy(id)`, so
  they can't drift out of sync.
- **Demolition keeps state consistent immediately:**
  - Demolishing a home makes its residents homeless (`home = 0`).
  - Demolishing a workplace makes its workers unemployed (`job = 0`).
  - Their day counters advance at the next 00:00.
- **The player never controls citizens directly.** There are no citizen
  commands.

## 4. Immigration and departures

These happen in the **migration** step: departures run first, then housing for
the homeless, then arrivals.

### No arrivals when

- immigration is paused (`treasury <= 0`, read after the economy step), or
- there's no free housing in connected homes.

### Daily arrivals (deterministic)

```
arrivals = min(freeHousing, maxArrivalsPerDay (4), max(0, jobsPull + wellPull − foodPenalty))
```

- **`jobsPull`**:
  - `min(openJobs, 3)` when there are open jobs.
  - Otherwise 1, but only if nobody is currently unemployed.
  - Otherwise 0.
- **`wellPull`**: +1 if any free housing lies inside a staffed Well's
  coverage.
- **`foodPenalty`**: 1 if `food == 0` and the population is above 0.

### What this produces

- **Housing only:** 1 person arrives, finds no work, and nobody else arrives
  until they leave after 7 days. This matches the plan's "a few arrive, can't
  find work, and eventually leave".
- **Houses plus farms and workshops:** up to 3–4 arrivals per day until jobs
  and housing are full, then it levels off.

### Departures

- A citizen leaves at **5 days hungry**, **7 days unemployed** or **3 days
  homeless**.
- Departures are processed in id order, and the reasons are counted for the
  daily report.

## 5. Housing

- **Who gets housed, in order:**
  1. homeless citizens already in the city, in id order
  2. newcomers
- **Which home they get, in order:**
  1. homes inside a staffed Well's coverage
  2. then the home nearest the entrance by road distance (one BFS from the
     entrance per day)
  3. then the lowest building id
- **Only connected homes count.** A home is connected when an adjacent road
  can reach the entrance.
- **When a home loses its connection** (decision 3):
  - Its residents keep the home but count as homeless (`homelessDays`
    increases) and lose their job.
  - If the road is reconnected within 3 days, they stay.
- **Capacity** comes from the data: Cottage 4, Rowhouse 16.

## 6. Jobs

Jobs are matched **per home**, nearest first by **road distance**.

- **Order:**
  - Homes are processed in id order.
  - Within a home, unemployed residents are processed in id order.
- **Finding the nearest job:**
  - A BFS starts from the home's adjacent road tiles and moves only through
    connected road tiles (N, E, S, W).
  - A workplace is reached when the BFS visits a road tile that touches it.
  - Ties at equal distance go to the lowest building id.
  - The BFS stops once that home's residents are all placed.
- **Speed-ups:**
  - A map from each road tile to its adjacent workplaces is rebuilt once per
    day.
  - BFS runs only for homes that have unemployed residents.
- **Stable jobs** (decision 4): a job is kept while the home and the workplace
  both stay connected. Only unemployed citizens are matched.
- **Workplaces:** Farm 6 jobs, Workshop 8, Well 1.
  - A disconnected workplace offers no jobs.
  - Its workers become unemployed at the next jobs step.
- **Newcomers** are matched the day after they arrive, so 1 unemployed day is
  normal.

## 7. Food, economy and debt

### Food

- **Production:**
  - Each farm worker produces 2 food per day.
  - Only connected farms produce.
- **Consumption:**
  - Each citizen eats 1 food per day.
  - Citizens are fed in id order.
  - Unfed citizens get `hungryDays += 1`, and fed citizens reset it to 0.

### Taxes and revenue

- **Taxes are now real:** `taxesFor(residents, employed)`.
  - 1 per resident housed in a connected home.
  - 2 per employed citizen.
- **Workshop revenue:**
  - 2 coins per worker per day.
  - It has its own ledger line, `revenue`.

### Projection, ledger and debt

- **Projection:** `projectedDaily` now uses the current residents, employed
  citizens and workshop workers.
- **Ledger and report** gain:
  - `revenue`
  - a `migration` summary: `{ arrived, left: { hunger, unemployment, homeless } }`
  - the food produced and eaten
- **Debt:**
  - While immigration is paused (`treasury <= 0`), no one arrives.
  - Departures, jobs, food, taxes and upkeep all keep running. A city can tax
    its way back above 0, and immigration then resumes automatically.
  - Nothing is ever demolished.

### Rough balance check (tuned in M7)

| Building (full) | Income per day | Upkeep per day |
|---|---|---|
| Cottage | about +4 | 1 |
| Farm | about +12 tax, plus 12 food | 2 |
| Workshop | about +32 | 3 |

## 8. Determinism and performance

- **No randomness** (decision 1). Every decision follows a fixed order:
  - citizens and homes in id order
  - BFS neighbours in N, E, S, W order
  - ties go to the lowest building id
- **`sim/daily.ts`** runs the six steps in order, which keeps
  `Simulation.ts` small.
- **Budget:** under **5 ms** per sim day with 2,000 citizens on the 128×128
  map.
  - Per-day caches: the road-to-workplace map and the BFS from the entrance.
  - The jobs BFS stops early.

## 9. UI

- **TopBar:**
  - real population
  - free housing (connected homes only)
  - open jobs (connected workplaces only)
  - a new **food** stat, with its daily change (+/−)
- **InfoPanel:**
  - "Residents 3 / 4" or "Workers 5 / 6" from live counts
  - when disconnected, the warning reads "Residents/jobs don't count until
    connected"
- **EconomyPanel:**
  - taxes split into residents and employed
  - workshop revenue
  - the "citizens arrive in M5" note is removed
- **CitizensPanel** (new), opened by clicking Population:
  - employed, unemployed, hungry and homeless counts
  - yesterday's arrivals and departures, with reasons
  - "Immigration paused" while the treasury is ≤ 0
- **No citizen sprites** in M5.
- **CSS:**
  - new styles go in `styles/citizens.css`
  - the economy styles move out of `hud.css` (at 333 of 400 lines) into
    `styles/economy.css`

## 10. Files

### New
- `src/sim/citizens/citizens.ts`: the model, counts, and cleanup when buildings
  are demolished
- `src/sim/citizens/housing.ts`
- `src/sim/citizens/jobs.ts`: road BFS and the road-to-workplace map
- `src/sim/citizens/migration.ts`: arrivals and departures
- `src/sim/resources/food.ts`
- `src/sim/services/coverage.ts`: Well radius and staffing
- `src/sim/daily.ts`
- `src/ui/CitizensPanel.tsx`
- `src/ui/styles/citizens.css`, `src/ui/styles/economy.css`
- `tests/sim/citizens.test.ts`, `jobs.test.ts`, `migration.test.ts`,
  `food.test.ts`, `scenarios.test.ts`

### Changed
- `src/sim/state.ts`
- `src/sim/Simulation.ts`: calls `daily.ts`, cleans up citizens on demolish,
  adds snapshot stats and `getOccupancy`
- `src/sim/economy/economy.ts`: taxes from counts, revenue, projection
- `src/data/balance.ts`: citizen, food and migration numbers
- `src/ui/TopBar.tsx`, `src/ui/InfoPanel.tsx`, `src/ui/EconomyPanel.tsx`,
  `src/ui/App.tsx`, `src/ui/styles/hud.css`
- `tests/helpers/scene.ts`: `runDays` and a builder for a connected town
- `PROJECT_STATE.md`

Every file stays under 400 lines. No new dependencies.

## 11. Test plan

### Unit tests

- **Housing order:**
  - staffed-Well coverage first
  - then nearest the entrance by road
  - then the lowest id
  - capacity is respected
- **Job matching:**
  - nearest by road distance, not straight-line distance
  - falls back to the next nearest when the nearest is full
  - homes are processed in id order
  - jobs are stable
  - a disconnected workplace offers nothing
- **Food:**
  - production by connected farms only
  - consumption
  - feeding in id order
  - hunger counters
- **Departures:**
  - the 5, 7 and 3 day thresholds
  - departure reasons are counted
- **Arrival formula:**
  - each pull and penalty
  - the cap of 4
  - zero arrivals when immigration is paused or housing is full
- **Well coverage:**
  - the radius
  - the staffing requirement
  - several Wells covering one home
- **Economy:**
  - taxes and revenue match the counts
  - the projection matches the next day's actual result
- **Demolish and disconnect:**
  - Demolishing a home makes its residents homeless. They're rehoused if
    possible, otherwise they leave after 3 days.
  - Demolishing a workplace makes its workers unemployed.
  - Cutting a road makes residents homeless and costs them their jobs.
    Reconnecting within 3 days keeps them.

### Scenarios (the Stage 1 acceptance criteria, using `runDays`)

1. **Housing only:** a few citizens arrive, stay unemployed, and leave.
2. **Houses, farms and workshops:** the population grows, then levels off
   near min(housing, jobs plus a little slack).
3. **Remove all farms:** food reaches 0, citizens go hungry, then they leave.
4. **Debt:** no arrivals. Taxes recover the treasury above 0, and then
   immigration resumes.

### Determinism, performance and guards

- **Determinism:** the same seed with the same commands gives deep-equal
  state (citizens, food, buildings, world arrays, snapshot) at any speed.
- **Performance:**
  - A 2,000-citizen town's daily step must pass a generous CI limit (50 ms),
    and the measured time is logged.
  - The 5 ms target is checked manually.
- **Guards:** the sim-purity and 400-line tests.
- **Validation:** `npm test`, `npm run typecheck`, `npm run build` and
  `git diff --check` all pass.

## 12. Manual play-test

1. Build a house and a road at the entrance. 1 citizen arrives, stays
   unemployed, and leaves after about 7 days.
2. Add a farm and a workshop.
   - Arrivals speed up.
   - The top-bar stats move.
   - "/day" turns positive.
3. Click buildings. The residents and workers counts update.
4. Cut the road.
   - The warning appears.
   - Reconnect within 3 days and nobody leaves.
5. Demolish the farms. Food drops, hunger rises, and people leave.
6. Go into debt.
   - "Immigration paused" shows and no one arrives.
   - Once taxes bring the treasury back above 0, arrivals resume.
7. Place a Well and staff it. The covered houses fill first.

## 13. Acceptance criteria

1. With connected housing and nothing else, a few citizens arrive, can't find
   work, and leave.
2. With connected housing, farms and workshops, the population grows to fill
   housing and jobs, then levels off.
3. Removing all farms causes hunger, then departures.
4. Citizens are never directly controlled by the player.
5. Jobs are matched by road distance and give the same result every run.
6. Only connected buildings count for housing, jobs and production.
7. Taxes and workshop revenue raise the treasury. The top bar shows:
   - income vs. expenses
   - population
   - free housing
   - open jobs
   - food
8. Immigration pauses while the treasury is ≤ 0. Nothing is ever demolished.
9. Building panels show live residents or workers.
10. The same seed with the same commands at the same ticks gives the same city
    at any speed.
11. A sim day takes under 5 ms with 2,000 citizens.
12. Tests, typecheck and build pass. `src/sim/` stays pure, and no file is
    over 400 lines.

## 14. Edge cases

- A home is demolished or disconnected while its residents are employed.
- A workplace is demolished at 23:00.
- Food is exactly equal to the population.
- There are 0 citizens and 0 food. No penalty applies.
- Free housing exists, but no connected path leads to any job.
- The treasury crosses 0 during the day. Migration reads it after the economy
  step.
- A Well has no worker.
- Several Wells cover the same home.
- A very large city. The per-day budget and caches cover it.
