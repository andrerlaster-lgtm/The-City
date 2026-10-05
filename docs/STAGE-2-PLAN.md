# Stage 2 Plan: "A town you shape"

**Status:** approved direction (2026-10-04). Milestone S2-M1 is detailed in
`docs/S2-M1-PLAN.md`. Later milestones each get their own plan before they
start.

**Inputs:**
- `docs/STAGE-2-FEATURE-BANK.md` (source of truth for ideas)
- `docs/STAGE-1-COMPLETION.md`
- `PROJECT_STATE.md`

**Rules (from `CLAUDE.md` and `AGENTS.md`, and Andre's decisions):**
- `src/sim` stays pure and deterministic.
- Buildings stay data-driven.
- No new dependency without approval.
- No individual traffic simulation.
- Utilities arrive one at a time.
- No disasters, crime, trains or airports.
- **`production` is never touched** without an explicit release request
  (a PR from `main` → `production`).

---

## 1. Vision

Stage 1 built one loop: build → people arrive → work → money → expand.
Stage 2 **deepens that loop before adding big new simulations**:
- **Happiness** decides who stays and who leaves.
- Parks, markets, clinics and water make neighbourhoods better.
- Industry makes nearby areas worse, through **pollution**.
- **Land value** shows the player where to build, and unlocks dense housing.
- Roads get **upgrades, bridges and aggregate traffic counts**.
- **One utility (water)** arrives through a limited coverage model.
- Every system is readable through an **overlay**.

## 2. Andre's decisions (2026-10-04)

1. **Source of truth:** the feature bank. The roadmap is reconciled against
   it in §3.
2. **Milestone order:** M1 → M8 as proposed. Land value comes before dense
   housing.
3. **Unhappiness departures:**
   - A citizen in a home with happiness below **25** for **10 consecutive
     days** may leave.
   - The counter resets once happiness is back at 25 or higher.
   - Both numbers live in `BALANCE`.
4. **Town Hall tax rate:**
   - Only **Low, Normal and High**, each with a clear revenue vs. happiness
     trade-off.
   - The values live in `BALANCE`.
   - No wider policy system.
5. **Building numbers:** the table in §5 is the starting point, tuned each
   milestone with scenario tests and play-tests.
6. **Job matching:** optimise and cache first. Add a per-day matching cap
   **only** if the benchmark still misses 5 ms. Never add it in advance.
7. **Traffic:** aggregate counts plus a small land-value penalty. No
   congestion slowdowns, no individual vehicles, no road-speed mechanics.
8. **Mobile:** not a Stage 2 target, since the game is desktop/laptop first.
   Touch improvements stay in the backlog. Isolated touch bugs get fixed
   only if they interfere with normal browser use.
9. **`fast-check`:** skipped. Revisit only if property-based testing would
   catch gaps the current tests miss.

## 3. Feature bank reconciliation

| Feature bank item | Bank tag | Stage 2 placement |
|---|---|---|
| Townhouse | S2 / LOW | **S2-M5.** Ungated: a simple step between Cottage and Rowhouse. |
| Apartment block | S2 / MED | **S2-M5** (gated by Town Hall and land value). It also requires water from **S2-M7**. |
| Market hall | S2 / LOW | **S2-M3** |
| Civic / trade center | LATER | Backlog |
| Orchard | S2 / LOW | **S2-M3.** Larger footprint, slower and steadier output than a Farm, as the bank describes. |
| Fishery | S2 / MED | **S2-M3.** Uses a new data-driven "next to water" placement rule. |
| Water tower | S2 / MED | **S2-M7.** The bank's "limited water-coverage model". |
| Power station / power network | LATER | Backlog. Utilities one at a time. |
| Clinic | S2 / MED | **S2-M7**, with simple city-level health |
| Fire station | LATER | Backlog (no hazards exist) |
| Small park | S2 / LOW | **S2-M2** |
| Sports field | S2 / MED | **S2-M4.** "More useful once happiness matters", so it comes after M2. |
| Town hall | S2 / MED | **S2-M5:** goals, civic status, and a services and finances summary, as the bank describes. It also holds the **approved three-level tax setting** (decision 4). |
| Council office (policies) | LATER | Backlog. The tax setting is the only policy in Stage 2. |
| Bus depot, bus stops and routes | S2 / HIGH | **Backlog (Stage 3 candidate).** The bank itself says "after simple traffic and route rules are defined", which S2-M6 does first. |
| Train station, rail, rail bridge | LATER | Backlog |
| Visitor center and tourism | S2 / MED | **Backlog (Stage 3 candidate).** Needs outside connections and landmarks, and adds a new income and population source. Better once happiness and land value are balanced. |
| Monument | LATER | Backlog |
| Road upgrades | S2 / MED | **S2-M6.** Reconciled with decision 7: upgrades raise land value and reduce the traffic penalty. They don't add speed or capacity mechanics. |
| Pedestrian paths | S2 / MED | Backlog. There are no pedestrians, and paths need new access rules. |
| Road bridge | S2 / MED | **S2-M6.** About 16% of each map is water, so bridges are useful. |
| Water network (pipes) | S2 / HIGH | Backlog. Stage 2 uses the coverage model (the bank's "best Stage 2" wording). |
| Road exits (outside connections) | S2 / MED | **Backlog (Stage 3, with tourism and trade).** One Entrance is enough for immigration in Stage 2. |
| Harbor / airport | LATER | Backlog |
| Happiness | S2 / MED | **S2-M2.** It includes the tax factor from S2-M5 and health from S2-M7. |
| Health | S2 / MED | **S2-M7.** A simple city-level and per-home factor from clinics, food and pollution. No individual medical histories. |
| Education | S2 / MED | **Backlog (Stage 3 candidate).** A workforce progression layer is best added after the economy and happiness are stable. |
| Crime | LATER | Backlog |
| Pollution | S2 / MED | **S2-M4.** Local, radius-based pollution from Workshops and Farms, then traffic (M6). Feeds land value, then health (M7). |
| Traffic | S2 / MED | **S2-M6** (aggregate counts) |
| Land value | S2 / MED | **S2-M4** |
| Seasons | S1 cosmetic / S2 gameplay | **S2-M8: a cosmetic palette pass only.** Gameplay effects go to the backlog. |
| Disasters | LATER | Backlog |
| Resources (building materials) | S2 / MED | Backlog. Food stays the only stock. The Market's "goods" is coverage, not a resource. |
| Arrival animations | S1 | Done in M7 (pop-in). A "first residents" highlight is optional in S2-M8. |
| Action feedback | S1 | Partly done (toasts). Daily arrivals and departures feedback in **S2-M2**. |
| Map overlays | S1 / S2 | Overlay framework, Well coverage and road connectivity in **S2-M1**. A new overlay arrives with each system. |
| Warnings | S1 | Disconnected-building and debt warnings done. Low food and unmet needs in **S2-M2**, and a warnings summary in **S2-M8**. |
| Richer info panels | S1 | Ongoing: each milestone adds its system's lines. |
| Map tools | S1 / S2 | A **zoom-to-Entrance** button in **S2-M1**. District labels in the backlog. |
| Ambient animation | S1 | **S2-M8** (cosmetic, respecting reduced motion) |
| Mobile-friendly controls | S1 | Backlog (decision 8). Isolated touch bugs get fixed if they interfere with normal browser use. |

**The feature bank's "Features to avoid for now"** are all followed:
- no disasters, crime or advanced health
- no individual traffic or pedestrians
- utilities one at a time
- every new building supports an existing loop
- no copied art or code

## 4. Milestone roadmap

Every milestone ends with:
- unit, scenario and balance tests
- 1–2 new Playwright smoke tests
- the opt-in `@perf` check (from M1)
- a protected preview with Playwright run against it
- Andre's play-test, then a commit

`production` is never touched.

### S2-M1 Foundations
Details in `docs/S2-M1-PLAN.md`.
- **Goal:** headroom plus shared infrastructure. No gameplay change.
- **Systems:**
  - generic **coverage maps**: the Well becomes the first `water` service,
    with identical behaviour
  - the **overlay framework**
  - job matching optimised by caching (no cap unless the benchmark needs it)
  - the end-of-day UI refresh spread across frames
- **UI:** an overlay picker with **Water coverage** and **Road connectivity**,
  a legend, and a **zoom-to-Entrance** button.
- **Data:** `serviceRadius` becomes `services: [{ kind, radius }]`. Saves are
  unaffected, because coverage is rebuilt rather than stored.
- **Tests:**
  - coverage stamping
  - all Stage 1 scenario and balance tests unchanged
  - worst-case simulation day ≤ 5 ms
  - the opt-in `@perf` Playwright fps check with 2,000 citizens
  - test hardening
- **Acceptance:** identical gameplay, the overlays work, and the performance
  targets are met.

### S2-M2 Happiness + Small Park
- **Systems:**
  - **Happiness per home (0–100)**, recalculated daily. It's built from:
    - base
    - water coverage
    - leisure coverage
    - fed or hungry
    - employment
    - (tax from M5, health from M7, pollution from M4)
    - all weights in `BALANCE`
  - Arrivals are weighted by happiness.
  - **Unhappiness departures** follow decision 3.
  - Low-food and unmet-need warnings, plus daily arrivals and departures
    feedback.
- **Building:** **Small Park.**
- **Data:**
  - `leisure` service kind
  - `unhappyDays` per citizen
  - **save v2**: the first real migration (`unhappyDays` = 0)
- **UI:**
  - happiness overlay
  - happiness breakdown in the info panel
  - average happiness and the "left: unhappy" reason in the Citizens panel
- **Performance:** low.
- **Tests:**
  - the formula and its limits
  - a park attracts people
  - an unhappy town loses people
  - the counter resets on recovery
  - v1 → v2 migration
  - determinism, including save → load
- **Playwright:** place a park and the home's happiness rises.
- **Play-test:** parks visibly draw people, and an unhappy area empties
  slowly.
- **Acceptance:** happiness drives migration and is readable, and Stage 1
  saves load.

### S2-M3 Orchard + Fishery + Market Hall
- **Systems:**
  - **Orchard maturity:** it produces nothing for `BALANCE` days after it's
    built, then steady food.
  - **Fishery:** must touch water edge to edge (the new data rule
    `requires.adjacentTerrain`).
  - **Market Hall:** jobs, plus revenue per worker and per covered resident,
    plus a `goods` coverage that feeds happiness.
- **Data:**
  - `builtTick` on each building (needed for maturity)
  - `requires.adjacentTerrain`
  - `goods` service kind
  - **save v3**
- **UI:**
  - goods overlay
  - "Matures in N days" in the info panel
  - the Fishery ghost shows "Needs water nearby"
- **Tests:**
  - maturity timing
  - the water-adjacency placement rule
  - market revenue maths
  - per-building output adds up to the city totals
  - balance
- **Playwright:** a Market Hall shows revenue, and a Fishery placed away from
  water shows the reason.
- **Acceptance:** two new food paths and commerce, each readable and
  balanced.

### S2-M4 Land value + pollution + Sports Field
- **Systems:**
  - **Land value per tile (0–100)**, recalculated daily from:
    - access and distance to the Entrance
    - water, leisure and goods coverage
    - **local pollution** (Workshops and Farms; traffic is added in M6)
  - Resident tax scales with the home's land value.
  - Pollution also lowers happiness.
- **Building:** **Sports Field**, a larger leisure service.
- **Data:** `pollution: { radius, amount }` on definitions. Land value and
  pollution are rebuilt, not stored.
- **UI:**
  - land value and pollution overlays
  - land value on the hover chip and in the info panel
- **Performance:** medium. Mitigate with recalculation only when inputs
  change, plus the benchmark.
- **Tests:**
  - the land value gradient
  - the pollution penalty
  - tax scaling
  - determinism
  - a performance budget
- **Playwright:** the land-value overlay shows its legend.
- **Acceptance:** the player can see good and bad places to build, and taxes
  respond.

### S2-M5 Town Hall + Townhouse + Apartment Block
- **Systems:**
  - **Town Hall** (unique):
    - a city goals and status panel: services, finances, happiness
    - the **Low / Normal / High tax setting** (decision 4)
    - unlocks the Apartment Block
  - Townhouse is available without any unlock.
- **Buildings:** Town Hall, Townhouse, Apartment Block (needs the Town Hall
  and land value ≥ 60).
- **Data:**
  - `requires.unlock`, `requires.minLandValue`, `unique`
  - the tax rate in game state
  - the tax trade-off values in `BALANCE`
  - **save v4**
- **UI:**
  - locked buildings show what they need
  - Town Hall panel
  - tax setting
- **Tests:**
  - gating and the new placement reasons
  - only one Town Hall
  - the tax trade-off
  - dense-housing balance
  - v3 → v4 migration
- **Playwright:** the Apartment Block is locked until the Town Hall is built.
- **Acceptance:** a clear village-to-town progression, and a tax choice with
  visible effects.

### S2-M6 Road upgrades + road bridges + traffic counts
- **Systems:**
  - **Paved roads:** cost more and have higher upkeep. They give a land-value
    bonus and reduce the traffic penalty. No speed or capacity effects.
  - **Road bridges** over water: higher cost, a maximum length in `BALANCE`.
  - **Traffic counts:**
    - each commuter's route (from job matching) adds to every road tile it
      uses
    - routes are cached and recalculated only when roads or jobs change
    - busy tiles add a little pollution and a land-value penalty
- **Data:** a `roadLevel` layer (dirt, paved or bridge). **Save v5.**
- **UI:**
  - an upgrade tool
  - the bridge preview with its cost
  - traffic overlay
  - traffic count on the hover chip
- **Performance:** **highest risk in Stage 2.** Budget ≤ 2 ms extra at 2,000
  citizens. Fallback: recalculate every few days.
- **Tests:**
  - route counting and cache invalidation
  - bridge placement and connectivity
  - upgrade costs
  - v4 → v5 migration
  - performance benchmark
- **Playwright:** upgrading a road charges coins; the traffic overlay shows
  counts.
- **Acceptance:** busy roads are visible, upgrades are worthwhile, bridges
  connect land across water, and the budget holds.

### S2-M7 Water Tower + Clinic and health
- **Systems:**
  - **Water as the first utility**, using the coverage model (no pipes):
    - the Water Tower is a radius-14 `water` service that needs a worker
    - the Well stays as the small early-game option
    - **the Apartment Block requires water coverage**
  - **Clinic:** a `health` service.
  - **Simple health per home**, from clinic coverage, food and pollution. It
    feeds happiness.
- **Buildings:** Water Tower, Clinic.
- **Data:** the `health` service kind. Health is rebuilt, not stored.
- **UI:**
  - water overlay with both sources
  - health overlay
  - warning badges on dense homes without water
- **Tests:**
  - coverage from several sources
  - Apartments empty without water
  - clinic health effect
  - an unstaffed tower
- **Playwright:** the water overlay updates after placing a Water Tower.
- **Acceptance:** water is a real constraint on density, and health connects
  services, food and pollution.

### S2-M8 Polish, balance, audit
- **Polish:**
  - cosmetic seasonal palette
  - ambient water and tree animation (off under reduced motion)
  - a warnings summary
  - optional first-residents highlight
- **Balance:** a pass across all Stage 2 buildings.
- **Audit:** the Stage 2 completion audit.
- **Deploy:** a protected preview plus Playwright against it.
- **Public release:** a separate, explicit request only (a PR from `main` →
  `production`).

## 5. Buildings (starting values, all data, tuned per milestone)

| Building | Size | Cost | Upkeep | Housing | Jobs | Effect | Milestone |
|---|---|---|---|---|---|---|---|
| Small Park | 1×1 | 80 | 1 | – | – | leisure, radius 5 | M2 |
| Orchard | 4×4 | 300 | 2 | – | 4 | food 3/worker after maturing (`BALANCE` days), grass | M3 |
| Fishery | 2×2 | 250 | 2 | – | 4 | food 2/worker, must touch water | M3 |
| Market Hall | 2×2 | 400 | 4 | – | 6 | goods, radius 8; revenue | M3 |
| Sports Field | 3×3 | 350 | 4 | – | 2 | leisure, radius 9 (stronger) | M4 |
| Town Hall | 3×3 | 800 | 6 | – | 4 | unique; goals panel; tax setting; unlocks Apartment Block | M5 |
| Townhouse | 1×1 | 220 | 2 | 8 | – | – | M5 |
| Apartment Block | 2×2 | 900 | 6 | 40 | – | needs Town Hall, land value ≥ 60, water | M5/M7 |
| Water Tower | 2×2 | 600 | 5 | – | 2 | water, radius 14 | M7 |
| Clinic | 2×2 | 500 | 4 | – | 3 | health, radius 10 | M7 |
| Paved road / bridge | road level | 25 / 60 per tile | 0.3 / 0.5 per tile | – | – | land value + / crosses water | M6 |

Footprints stay square. Pollution sources (M4): Workshop and Farm, small
radius, with values in data.

## 6. New systems (each a pure daily step in a fixed, documented order in `daily.ts`)

| System | Milestone | Notes |
|---|---|---|
| Coverage maps | M1 | Per service kind. Rebuilt daily. |
| Happiness | M2 | Per home. Weights in `BALANCE`. |
| Building maturity | M3 | Uses `builtTick`. |
| Land value | M4 | Per tile. Uses pollution. |
| Pollution | M4 | Local radius. Traffic is added in M6. |
| Unlocks and tax setting | M5 | Low / Normal / High only. |
| Road levels, bridges, traffic counts | M6 | Cached routes, aggregate counts only. |
| Water utility and health | M7 | Coverage model, no pipes. |

## 7. UI and overlays

- **One overlay picker:**
  - Water
  - Road connectivity
  - Happiness
  - Leisure
  - Goods
  - Land value
  - Pollution
  - Traffic
  - Health

  Each overlay has a legend and is added in its milestone. Overlays use
  built-in Pixi chunked tinting, with no `pixi-filters`.
- **The placement ghost** shows coverage rings for service buildings, plus
  the new reasons:
  - Locked
  - Needs land value ≥ N
  - Needs water nearby
  - Needs water coverage
- **Panels:**
  - info panel: happiness breakdown, land value, maturity, output
  - Citizens panel: average happiness and the "unhappy" departure reason
  - Economy panel: market revenue and the tax setting
  - new Town Hall panel
- **Tools:** a road upgrade tool and the bridge preview (M6).

## 8. Performance

- **Budget:**
  - a typical simulation day ≤ 5 ms with 2,000 citizens
  - the worst case also ≤ 5 ms after M1
  - 60 fps maintained, measured by the opt-in `@perf` Playwright check at the
    end of each milestone
- **Riskiest parts:**
  - traffic route counting (M6)
  - land value (M4)
  - overlays

  Mitigations: caching, recalculating only when inputs change, and chunked
  overlay redraws.
- Memory is trivial: a few 16k-cell maps.

## 9. References (ideas only; no copied code or art)

| Repo | License / health | Use |
|---|---|---|
| amilich/isometric-city (bank source [2]) | MIT, ★2.3k, active, TypeScript | Feature ideas: parks, utilities, traffic, overlays |
| Tom-Draper/City-Builder (bank source [3]) | no license (all rights reserved) | Ideas only |
| GodotGarden/city-builder-games (bank source [1]) | CC0 catalog, inactive | Breadth of ideas |
| graememcc/micropolisJS | GPL-family | **Concepts only:** classic land-value, pollution and traffic density maps. No code. |
| lincity-ng/lincity-ng | GPL-2.0, active | Concepts: service coverage and utilities |
| OpenTTD/OpenTTD | GPL-2.0, active | Road-upgrade and bridge UX |
| zeikar/cimulity | MIT, same stack | Overlay and labour-market patterns |

No new runtime or dev dependencies are planned. `fast-check` is skipped
(decision 9).

## 10. Test strategy

- **Unit tests** for every system.
- **Scenarios:**
  - a park attracts people
  - unhappiness causes departures, and the counter resets
  - an orchard matures
  - a fishery needs water
  - a market raises happiness and revenue
  - the land value gradient
  - apartments are gated
  - water loss empties apartments
  - traffic counts update when roads change
- **Balance:** the 60-day scripted towns, extended with each milestone's
  buildings.
- **Save:** v2 (M2), v3 (M3), v4 (M5), v5 (M6). Each has a tested migration,
  and **a Stage 1 save must load in every version.**
- **Determinism:** full-state comparison at 1× and 3×, and after
  save → load, every milestone.
- **Performance:** the warmed-up simulation benchmark per system, plus the
  opt-in `@perf` Playwright fps check.
- **Playwright:** the default suite stays ≤ 16 tests and about a minute.
  Every test runs locally and against each milestone's protected preview.

## 11. Backlog (carried forward or deferred)

| Item | Placement |
|---|---|
| Touch: one-finger tool drag pans; pinch unverified | Backlog (decision 8). Fix isolated bugs only. |
| Two tabs autosaving (last write wins) | Backlog |
| Map sizes other than 128 / loading other-size saves | Backlog |
| Bus routes, tourism and visitor center, road exits, education | Stage 3 candidates |
| Power, pipes, fire, crime, disasters, rail, harbor, airport, monuments, civic center, council policies, building materials, seasonal gameplay | Later, per the feature bank |
| M0–M2 separate plan files | Won't fix (scope is in `STAGE-1-PLAN.md`) |
