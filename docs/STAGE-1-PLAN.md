# The City Life — Stage 1 Plan (Settlement Prototype)

Status: **approved 2026-10-04** (all section 7 defaults and the 8 changes from section 8). M0 in progress.
Date: 2026-10-04

---

## 0. What exists today

| Question | Answer |
|---|---|
| Existing repo / code | None. The project folder (now `The-City/`) was created empty today. This plan is its first file. |
| Current stack | None yet, so there's nothing to replace. |
| Machine | Node 24.15.0, npm 11.12.1, Vercel CLI 53.4.0 (all from the vault's Tool & Skill Registry, versions checked on the machine). |
| Target | Browser game, deployed to Vercel as a static site (private preview deploys only, per the registry's Vercel rules). |

---

## 1. Recommended stack

| Layer | Choice | Why |
|---|---|---|
| Language | **TypeScript** | The game will grow large. Types catch mistakes between systems (buildings ↔ citizens ↔ economy) and make data definitions checkable. |
| Build / dev server | **Vite** | Fast dev server with hot reload. Builds a plain static site that Vercel hosts with no server code. |
| Map rendering | **PixiJS v8** (WebGL, WebGPU when available) | A fast 2D renderer: draws thousands of sprites smoothly and has filters for shadows and tinting. It renders only. It doesn't impose a game structure, so the simulation stays our own code. |
| Camera | **pixi-viewport** | Drag to pan, wheel or pinch to zoom, inertia, smooth zoom-to-point and edge clamping. Writing this by hand is fiddly, and it's most of what makes a camera feel polished. |
| UI panels | **React** (HTML/CSS overlay on top of the canvas) | City builders are UI-heavy: top bar, build menu, info panels, later budgets and charts. HTML gives crisp text, easy layout and CSS transitions. React keeps those panels organised as the game grows. |
| Saves | **idb-keyval** (IndexedDB) | localStorage stops at about 5 MB and blocks the page while it writes. IndexedDB holds much larger cities and doesn't block. This package is a ~600-byte wrapper. |
| Terrain generation | **Our own value noise** (~40 lines, in `sim/world/`) | Natural-looking water, sand and meadows from a seed. Decided after the reference review (section 8): no dependency needed. |
| Tests | **Vitest** | Runs simulation tests without a browser. Because the simulation is pure logic, it can be tested heavily ("10 houses + 2 farms → population settles at N"). |

### Considered and not chosen (for Stage 1)

- **Phaser.** Strong for action and platform games (scenes, physics, sprites), but a city builder needs our own simulation, isometric depth sorting and a large DOM UI. Phaser would add a scene/physics framework we wouldn't use, plus its own UI approach running next to React. PixiJS is the renderer Phaser-style engines build on, without the extra layers.
- **Three.js / full 3D.** Better long-term visuals, but much more work per asset and per feature. Isometric 2.5D gets most of the "real city builder" look for far less effort. If we go 3D later, the renderer is isolated so the simulation won't change.
- **An ECS library (bitecs etc.).** Useful at very high entity counts. Stage 1 doesn't need one. Citizens are stored in a layout (flat arrays keyed by id) that could switch to an ECS or a Web Worker later without rewriting the rules.
- **GSAP.** Already in the registry (The Exchange Game). Stage 1 UI transitions are simple enough for CSS. Revisit if animations get richer.
- **Zustand / Redux.** React's built-in `useSyncExternalStore` is enough to read simulation snapshots into the UI.
- **Game Studio / Level Design skills.** Saved in the registry as ideas, not installed. Game Studio's useful parts are Phaser-focused, so they're not needed for this stack. I won't install anything without your go-ahead.

### Dependency list (needs your yes before `npm install`)

Runtime: `pixi.js`, `pixi-viewport`, `react`, `react-dom`, `idb-keyval`
Dev only: `vite`, `typescript`, `@vitejs/plugin-react`, `vitest`, `@types/react`, `@types/react-dom`

Approved 2026-10-04. Licenses checked at install: all MIT except `idb-keyval` and `typescript` (Apache-2.0, also permissive). pixi-viewport 6 declares `pixi.js >= 8` as its peer, so it matches.

---

## 2. Architecture

The core rule is that **the simulation never knows the screen exists.**

```
            ┌────────────── Browser ──────────────┐
  player →  │  Input / Tools  ──commands──►  SIM  │
            │       ▲                         │   │
            │       │                    snapshot │
            │  Renderer (Pixi) ◄──────────────┤   │
            │  UI (React)      ◄──────────────┘   │
            │  Save system ◄──── serialize ── SIM │
            └─────────────────────────────────────┘
```

1. **Simulation (`src/sim/`) is pure TypeScript.** No PixiJS, React or DOM imports. It holds the whole game state and advances it in fixed steps. This lets it be:
   - unit-tested without a browser,
   - moved into a Web Worker later for thousands of citizens,
   - saved and loaded as plain data.
2. **Commands in.** The player never edits state directly. Input produces commands: `PlaceBuilding`, `PlaceRoad`, `Demolish` and `SetSpeed`. The sim validates and applies them. This gives one place for rules ("can I afford it? is the spot valid?") and makes undo, replays or multiplayer possible later.
3. **Events and snapshots out.** The sim emits events (`BuildingPlaced`, `CitizenArrived`, `CitizenLeft`, `TreasuryChanged`) and exposes a read-only snapshot. The renderer and UI only react to these.
4. **Data-driven definitions (`src/data/`).** Buildings, terrain types and balance numbers are data tables, not code branches. A new building type is a new entry, not a new class.
5. **Fixed-step time, separate from frame rate.** The sim runs in fixed ticks (1 tick = 1 game hour). The render loop runs at the screen's frame rate and interpolates. Speed changes the number of ticks per real second, never the rules. A slow frame won't change the outcome.
   - A **maximum catch-up per frame** stops a backgrounded tab from running hundreds of ticks when it comes back.
   - **Pausing discards elapsed time**, so resuming never bursts.
   - The clock exposes **hour, day and month hooks** that systems subscribe to.
   - Every tick returns the **tiles and buildings that changed**, so the renderer redraws only those.
6. **Seeded randomness.** One seeded random generator in the sim, so the same seed and the same commands give the same city. This makes bugs reproducible and save files exact.

### Systems and who owns what

| System | Owns | Talks to |
|---|---|---|
| **World** | Map size, plus layers stored as **flat typed arrays** indexed `y * width + x`: terrain type, buildability, occupancy (which building or road is on each tile) | Everything reads it. Only Buildings and Roads write occupancy. |
| **Buildings** | Placed building instances: definition id, position, rotation, construction state, residents and workers lists | World (footprint), Roads (access check), Economy (cost) |
| **Roads** | Road tiles, connections, the "connected to the settlement entrance" flag per road tile (a flood fill whenever roads change) | World, Buildings (road access) |
| **Citizens** | Lightweight citizen records: home, job, food status, unhappy-day counter | Buildings (housing and jobs), Economy (taxes), Resources (food) |
| **Resources** | City-wide stockpiles. Stage 1 has only **food**: farms produce it and citizens eat it. No delivery logistics yet. | Citizens, Buildings |
| **Economy** | Treasury, daily income and expense breakdown, tax rate. An empty treasury **pauses immigration**. Nothing is ever demolished automatically. | Buildings (maintenance), Citizens (taxes) |
| **Time** | Tick counter, date, speed (paused, 1×, 2×, 3×), the fixed-step accumulator | Drives the sim loop |
| **Services** | Coverage areas (Stage 1: one building, the **Well**, with a radius) | Citizens (happiness) |
| **Save** | Serialize to a compact, **id-based** snapshot (sorted by id, so the same city always saves identically). Version it, validate it on load, migrate it, and store it through a `SaveProvider` interface (IndexedDB first). | Reads and writes the whole sim state |
| **Renderer** | Pixi scene: terrain chunks, roads, buildings, placement ghost, overlays | Reads snapshot and events only |
| **UI** | React panels | Reads snapshot and sends commands |
| **Input / Tools** | Current tool (select, road, build X, demolish), mouse to tile, drag handling | Sends commands |

### Stage 1 simulation rules (first numbers, tuned during play)

Each game day (24 ticks), in this order:

1. **Production.** Each worker at a farm adds food. Other workplaces add revenue.
2. **Consumption.** Each citizen eats 1 food. A shortage marks citizens hungry.
3. **Economy.** Taxes are paid per employed citizen plus a small amount per resident. Each building costs its maintenance.
4. **Jobs.** Matched per home, not per citizen. A BFS over road cells starts from the home's road access, and the home's workers fill the **nearest job by road distance**, spilling over to the next nearest. Homes are processed in a fixed order (by id), so results are repeatable.
5. **Migration.**
   - Arrivals: if there is empty housing with road access **and the treasury is above 0**, newcomers arrive. More come when jobs and food are available, and Well coverage helps.
   - Departures: a citizen who has been hungry, unemployed or without a home for N days leaves.
6. **Stats.** Population, free housing and free jobs are recomputed for the top bar.

A building only counts (housing, jobs, production) when it's **connected to a road that reaches the settlement entrance**. This is the first link between roads and buildings, and later pathfinding and traffic build on it.

Map: **128 × 128 tiles, isometric** (2:1 diamond tiles). The size is a setting, so bigger maps need no code changes. A pre-placed road at one map edge is the **settlement entrance**, where newcomers arrive.

### Initial buildings (data, not code)

| Building | Category | Size | Cost | Upkeep / day | Capacity | Jobs | Notes |
|---|---|---|---|---|---|---|---|
| Cottage | Residential | 1×1 | 100 | 1 | 4 residents | – | |
| Rowhouse | Residential | 2×2 | 350 | 3 | 16 residents | – | |
| Farm | Employment | 3×3 | 250 | 2 | – | 6 | Produces food per worker. Grass only. |
| Workshop | Employment | 2×2 | 300 | 3 | – | 8 | Produces revenue per worker. |
| Well | Service | 1×1 | 150 | 2 | – | 1 | Happiness bonus to homes within radius 6. |
| Road | Road | 1 tile | 10 / tile | 0.1 | – | – | Drag to place. |

Each definition carries: `id`, `name`, `category`, `description`, `size`, `cost`, `upkeep`, `housing`, `jobs`, `produces`, `serviceRadius`, `requires` (e.g. `roadAccess`, `terrain: ["grass"]`) and `art` (which generated sprite to use). The names are placeholders, so rename anything you like. The future fields `era` and `unlockedBy` are left out until needed, but the format has room for them.

---

## 3. Directory structure

```
The-City/
├── docs/
│   └── STAGE-1-PLAN.md          ← this file
├── public/                      ← static files (favicon, later real sprites/audio)
├── src/
│   ├── main.tsx                 ← boots the app
│   ├── app/
│   │   ├── Game.ts              ← wires sim + renderer + UI + loop together
│   │   └── loop.ts              ← fixed-step sim / variable-rate render loop
│   ├── core/                    ← tiny shared pieces, no game rules
│   │   ├── rng.ts               ← seeded random
│   │   ├── events.ts            ← typed event bus
│   │   ├── grid.ts              ← tile coords, iso ↔ screen math
│   │   └── types.ts
│   ├── data/                    ← data-driven definitions
│   │   ├── buildings.ts
│   │   ├── terrain.ts
│   │   └── balance.ts           ← all tunable numbers in one place
│   ├── sim/                     ← PURE: no Pixi, no React, no DOM
│   │   ├── Simulation.ts        ← owns state, runs a tick, applies commands
│   │   ├── state.ts             ← the full serializable game state type
│   │   ├── commands.ts
│   │   ├── world/               ← map generation, tiles, occupancy
│   │   ├── buildings/           ← placement rules, instances
│   │   ├── roads/               ← road graph, connectivity flood fill
│   │   ├── citizens/            ← migration, housing, jobs
│   │   ├── resources/           ← food stockpile
│   │   ├── economy/             ← treasury, taxes, upkeep
│   │   ├── services/            ← coverage
│   │   └── time/                ← date, speed
│   ├── render/                  ← Pixi only
│   │   ├── Renderer.ts
│   │   ├── camera.ts            ← pixi-viewport setup
│   │   ├── art/                 ← procedurally generated sprites (see Visual direction)
│   │   ├── layers/              ← terrain (chunked), roads, buildings, overlays
│   │   └── placementGhost.ts
│   ├── input/
│   │   ├── tools.ts             ← select / road / build / demolish tool states
│   │   └── pointer.ts           ← mouse/touch → tile
│   ├── save/
│   │   ├── serialize.ts
│   │   ├── validate.ts          ← reject malformed / unknown-version saves
│   │   ├── migrations.ts        ← v1 → v2 → … as the format evolves
│   │   └── providers/           ← SaveProvider interface + IndexedDB provider
│   └── ui/                      ← React only
│       ├── App.tsx
│       ├── TopBar.tsx
│       ├── BuildMenu.tsx
│       ├── InfoPanel.tsx
│       ├── SpeedControls.tsx
│       ├── SaveMenu.tsx
│       ├── Toasts.tsx
│       ├── useSimSnapshot.ts
│       └── styles/              ← CSS variables (design tokens) + per-component CSS
├── tests/
│   ├── helpers/scene.ts         ← headless "seed a scene" helper for sim tests
│   ├── data/                    ← building-definition validation
│   └── sim/                     ← Vitest tests for the pure simulation
├── index.html
├── package.json
├── tsconfig.json
├── vite.config.ts
└── README.md
```

To keep `sim/` pure, a small test fails if any file in `src/sim/` imports `pixi.js`, `react` or touches `window`/`document`.

---

## 4. Visual direction

The aim is an original look, cohesive from day one, without copying any commercial game.

- **View:** isometric 2.5D with a 2:1 tile ratio. Buildings have height, so the city reads as a place rather than a spreadsheet.
- **Style:** soft, warm and "toy-like diorama". Flat-shaded shapes with a clear light side and shade side (light from the upper left), soft contact shadows under every building, and rounded rooflines. Grass, water and sand each get a small set of tile variations so the ground doesn't look tiled.
- **Art source for Stage 1:** generated in code at start-up. Building and terrain sprites are drawn with Pixi graphics into textures from a shared palette and one lighting rule. Everything matches, nothing is borrowed, and any sprite can be swapped for a hand-made one later without touching game code (each definition only names its `art` key).
  - Alternative, needs your yes: Kenney's free CC0 isometric city packs. Not downloaded unless you approve.
- **Palette and tokens:** one palette file shared by the renderer and the UI's CSS variables, so the map and panels feel like one product.
- **Feel:**
  - Smooth camera with inertia, zoom toward the cursor, and zoom limits.
  - The placement ghost follows the cursor, snaps to tiles and tints green or red. A short reason appears when a spot is invalid ("Needs road access", "Not enough money", "Blocked").
  - New buildings start as a construction state and pop up with a small ease. Demolishing leaves a brief dust puff.
  - Panels slide and fade in. Numbers in the top bar count up or down instead of jumping.
  - Respects the "reduce motion" setting.
- **Map clarity:** overlays for road access (connected roads highlight) and Well coverage (a radius ring when placing or selecting a Well).

---

## 5. Implementation order and milestones

Each milestone ends with something you can open in the browser and try.

| # | Milestone | What you'll see |
|---|---|---|
| **M0** | **Scaffold.** Vite, TypeScript, PixiJS, React. Folder structure, test setup, the sim-purity test, own local git repo, README. | A blank canvas with a placeholder top bar. `npm run dev` and `npm test` work. |
| **M1** | **World and camera.** Seeded terrain (grass, water, sand, trees), chunked iso rendering, pan and zoom, tile hover highlight. | A pleasant generated landscape you can glide around. |
| **M2** | **Roads.** Road tool with drag-to-draw, cost preview, auto-connecting road pieces, the settlement entrance, connectivity flood fill, demolish. | Roads that link up neatly. Disconnected roads show as such. |
| **M3** | **Buildings.** Definitions, build menu by category, placement ghost with valid/invalid reasons, costs charged, info panel on click. | All five buildings placeable, with clear feedback. |
| **M4** | **Time and economy.** Fixed-step loop, pause/1×/2×/3×, date, treasury, daily upkeep and taxes, income breakdown. | The clock runs, money changes, speeds work. |
| **M5** | **Citizens.** Arrival, housing, jobs, food, Well happiness, departures. Live top-bar stats. Building panels show occupants and workers. | **The full Stage 1 loop:** build → people move in → they work → money comes in → expand → population grows. |
| **M6** | **Save and load.** Versioned save format, IndexedDB storage, save slots, autosave, load menu. | Close the tab, come back, the city is still there. |
| **M7** | **Polish and deploy.** Shadows and pop-in animations, UI transitions, number tweening, a balance pass, a first private Vercel preview. | A shareable private preview link. |

I'll stop after each milestone so you can play it before I move on.

---

## 6. Stage 1 acceptance criteria

Stage 1 is done when all of these are true:

**World**
- [ ] A 128 × 128 map is generated from a seed. The same seed always gives the same map.
- [ ] The camera pans (drag or keys) and zooms (wheel, pinch) smoothly, within limits.
- [ ] Changing the map size setting needs no code changes.

**Roads**
- [ ] Roads can be drawn by dragging, cost money per tile, and connect visually.
- [ ] Roads not linked to the settlement entrance are shown as disconnected.
- [ ] Roads and buildings can be demolished.

**Buildings**
- [ ] The five buildings come from data definitions. Adding a sixth means adding one data entry plus its art.
- [ ] The placement ghost shows valid/invalid status with a reason. Invalid placement does nothing and charges nothing.
- [ ] Clicking a building shows its name, description, cost, capacity or jobs, and current occupants or workers.

**Citizens**
- [ ] With connected housing and no other buildings, a few citizens arrive, can't find work, and eventually leave.
- [ ] With connected housing, farms and workshops, the population grows to fill housing and jobs, then levels off.
- [ ] Removing all farms causes hunger, then departures.
- [ ] Citizens are never directly controlled by the player.

**Economy and time**
- [ ] The treasury goes down on construction and upkeep, and up with taxes. The top bar shows income vs. expenses.
- [ ] Pause, 1×, 2× and 3× work. The same commands from the same save give the same result at any speed.
- [ ] The top bar shows treasury, population, free housing, free jobs and the date.

**Save**
- [ ] Save and load restore roads, buildings, citizens, treasury, food and date exactly.
- [ ] Saves carry a format version, and a migration step exists (even if v1 has nothing to migrate).

**Quality**
- [ ] `src/sim/` imports no rendering or UI code (enforced by a test).
- [ ] Simulation tests pass for placement rules, connectivity, migration, economy and save round-trip.
- [ ] A test validates every building definition.
- [ ] Tests can set up a city scene without a browser.
- [ ] Job matching uses road distance and gives the same result every run.
- [ ] A backgrounded tab doesn't run a burst of ticks on return, and resuming from pause doesn't either.
- [ ] Stays at 60 fps on a MacBook with a full 128 × 128 map and 2,000 citizens. A sim day takes under 5 ms.
- [ ] No file over ~400 lines.
- [ ] Deployed as a private Vercel preview. A new Vercel project's first deploy goes to production, so that deploy's aliases get removed and it's redeployed as a preview.

---

## 7. Decisions (resolved 2026-10-04: Andre approved the recommended defaults)

1. **Dependencies:** approved as listed in section 1 (`simplex-noise` dropped).
2. **View:** isometric 2.5D.
3. **Art:** generated in code. No Kenney download.
4. **Git:** private GitHub repo [andrerlaster-lgtm/The-City](https://github.com/andrerlaster-lgtm/The-City) (Andre created it public on 2026-10-04 and asked for it to be made private before the first push).
5. **Building names:** Cottage / Rowhouse / Farm / Workshop / Well.

---

## 8. Reference repository review (2026-10-04)

Andre asked for five repositories to be reviewed **as architectural references only**: is there anything that would materially cut development time for Stage 1?

**How they were reviewed:** read through the GitHub API (README, package.json, file tree and key source files). Nothing was cloned, installed or run, and no code was copied into this project. Any small helper we later write from one of these ideas will be our own code. Where it closely follows an MIT-licensed original, the file will carry an attribution comment.

### Summary

| Repository | What it is | Verdict |
|---|---|---|
| [zeikar/cimulity](https://github.com/zeikar/cimulity) | SimCity-style browser builder: TypeScript, **PixiJS 8**, React, Vitest. Isometric, roads, labor market, fixed-step loop. MIT. | **REFERENCE ONLY. Highest value. Adopt several patterns now (below).** |
| [Maudfer/townBox](https://github.com/Maudfer/townBox) | Top-down city builder in Phaser 4 + React. Really a deep "individual lives" simulation (genealogy, households, life events). MIT. | **REFERENCE ONLY** for the clock, event bus and save design. **POSSIBLY LATER** for households and population depth. |
| [uxcaleb/isometric-city](https://github.com/uxcaleb/isometric-city) | Copy of [amilich/isometric-city](https://github.com/amilich/isometric-city) (IsoCity, ~2.3k stars, MIT): a Next.js + raw Canvas isometric city with lots of vehicles. The uxcaleb copy has 0 stars and isn't a GitHub fork, so the original is the one to cite. | **REFERENCE ONLY** for visuals (drawn isometric buildings, depth sorting, lighting). It's also an example of what to avoid architecturally. |
| [prettymuchbryce/easystarjs](https://github.com/prettymuchbryce/easystarjs) | Small (~7 KB) asynchronous A* pathfinding on a 2D grid. MIT. Last change Jan 2024. | **POSSIBLY LATER** (visible walkers or vehicles). Not needed in Stage 1. |
| [NateTheGreatt/bitECS](https://github.com/NateTheGreatt/bitECS) | Minimal data-oriented ECS (~5 KB), with serialization and multithreading support. **MPL-2.0**. | **POSSIBLY LATER** (thousands of citizens with per-tick work, or a Web Worker sim). Not needed in Stage 1. |

None is **USE NOW** as a dependency. None is **NOT APPROPRIATE** to learn from. The closest to "not appropriate" is IsoCity's *architecture*, explained below. **No new dependencies are proposed.**

### zeikar/cimulity: REFERENCE ONLY (adopt patterns now)

This is the closest match to our plan. It independently arrived at almost the same design (PixiJS 8, React shell, a pure simulation core, Vitest, fixed-step loop, isometric 64×32 tiles), which is good confirmation. Patterns worth adopting, by Stage 1 area:

| Area | Pattern | Effect on our plan |
|---|---|---|
| Map/grid | World layers as **flat typed arrays** (`Uint8Array` etc.) indexed `y * width + x`, not arrays of tile objects. | Faster, smaller saves, ready for a Web Worker. **Refines** `sim/world/`. |
| Map/grid | Pure iso math module: `tileToScreen`, a fractional inverse for picking, and **zoom-aware camera bounds** recomputed on every zoom or resize. Tested without Pixi. | Fits `core/grid.ts` and `render/camera.ts`. Write our own, with tests. |
| Camera | It wrote its own camera (wheel zoom around the cursor, edge pan) and didn't use pixi-viewport. | **No change.** We keep pixi-viewport for drag-pan, inertia and pinch. If it turns out not to support the installed PixiJS version, fall back to a small custom camera like this one. |
| Roads | **4-bit neighbour mask** (N=1, E=2, S=4, W=8) to pick a road piece: end, straight, corner, tee or cross. A pure render-only function, unit-tested. | Adopt in `render/layers/roads`. |
| Roads | Road connectivity as a **BFS over road cells**, then "a lot is served if it touches a reachable road cell". | Same as our plan. Adopt their Uint8Array BFS shape, seeded from the **settlement entrance**. |
| Building placement | **Commands are the only way to change state.** Tools only *build* commands, and one dispatcher applies them. Clicks and drags share the same path. | Same as our plan. Confirms adding a single `applyCommand` entry point in `Simulation.ts`. |
| Economy | Upkeep is charged even when unpaid, and a shortfall **freezes growth** instead of instantly destroying things. Building and demolishing always work. | Worth copying as a rule. **Proposed** Stage 1 rule: if the treasury hits 0, immigration pauses. Nothing is demolished automatically. |
| Population | **Labor market matched per building, not per citizen:** each home's workers fill the **nearest job by road distance** (BFS from the home's road access), spilling over to the next nearest, in a fixed order so results are repeatable. | **Proposed change:** our plan said "nearest by straight-line distance". Road distance costs little at 128×128, is more believable, and is the base for traffic later. |
| Clock | Fixed-step loop: speed multiplies elapsed time, **max catch-up ticks per frame** (so a hidden tab can't run 1,000 ticks when it comes back), and pausing throws away elapsed time (no burst on resume). | **Adopt** into `app/loop.ts`. |
| Render updates | Each tick returns a **list of changed tiles and buildings**, so the renderer redraws only those. | **Adopt.** Important for keeping 60 fps as cities grow. |
| Save/load | Versioned save. The format is compact (short keys, arrays sorted by id so the same city always saves identically) and validated on load. Old versions are *rejected* rather than migrated. | Adopt the compact, deterministic, validated format. **Keep** our migration hook (Andre will keep saves across updates), but Stage 1 can also refuse unknown versions safely. |
| Testing | High test coverage on pure logic only. Pixi drawing and DOM glue are checked by playing. A headless "seed a scene" helper for tests. | Matches our plan. Adopt the headless scene helper. |

Not adopted: Next.js (we don't need a server, so Vite is simpler for a static Vercel site); terrain elevation and slopes (later); zoning (our player places specific buildings instead).

### Maudfer/townBox: REFERENCE ONLY now, POSSIBLY LATER for population depth

- **Different engine (Phaser 4, top-down)** and a much deeper people simulation than Stage 1 wants. We don't borrow code.
- **Useful now, as ideas:**
  - **Clock cadences:** one hourly tick, plus "new day" and "new month" hooks that systems subscribe to. **Adopt** in `sim/time/`. Our daily rules run on the day hook, and monthly reports can come later.
  - **Typed event bus declared in one file**, with the simulation core never importing UI. Already in our plan (`core/events.ts`), so this confirms it.
  - **Save:** an **id-based snapshot** (buildings, citizens and homes refer to each other by id, never by object), behind a **pluggable save provider** interface. **Adopt.** Our `save/storage.ts` becomes a `SaveProvider` interface, with IndexedDB as the first provider.
  - Data files checked by validators at load time. **Adopt lightly:** a test that checks every building definition (positive sizes, known categories, valid `art` key).
- **Possibly later:** households (families moving in together), needs and mood, skill-matched hiring, businesses with profit and loss, eviction and homelessness cascades. All good for later stages. Its money model, which conserves money against an outside economy, is worth rereading before Stage 2's economy.
- **Compression:** it uses `pako`. If saves get big later, browsers' built-in `CompressionStream` does the same job with **no dependency**.

### amilich/isometric-city (via uxcaleb copy): REFERENCE ONLY (visuals)

- **Useful as visual reference:** buildings drawn in code rather than from image files (the same approach as our generated art), isometric depth sorting, a lighting overlay and a mini-map. Also, it runs save compression in a Web Worker so saving never stutters, which is worth remembering for big cities.
- **Architecture to avoid:**
  - Single files of 140–160 KB (`CanvasIsometricGrid.tsx`, `simulation.ts`).
  - Game state living in a React context (`GameContext.tsx`, 56 KB).
  - No test framework.
  
  This is exactly the "giant files, tightly coupled" problem our plan is designed to prevent.
- **Not adopted:** Next.js, Supabase multiplayer, Radix/shadcn UI kit, lz-string.

### easystarjs: POSSIBLY LATER

- A* over a 2D grid, spread across frames.
- **Stage 1 doesn't need point-to-point paths.** Road reachability and job distance are both covered by a BFS over road cells, which is simpler and faster for "everyone from one source" questions.
- Consider it when **visible citizens or carts walk specific routes** (Stage 2+). Even then, a small A* over our own road graph may beat a general grid library, because roads are a graph rather than an open grid. Decide then. It hasn't changed since 2024, which is fine for a small finished library but worth noting.

### bitECS: POSSIBLY LATER

- Fast data-oriented storage for many entities, with serialization and Web Worker support.
- **Stage 1 doesn't need it:**
  - Citizens are light records, updated once a day in a single pass.
  - Our plan already keeps citizens in flat id-indexed storage, so moving to bitECS later is contained to `sim/citizens/`.
- Reconsider when there are **thousands of citizens with per-hour behaviour**, or when the sim moves to a Web Worker.
- License note: **MPL-2.0** is fine to use as an unmodified npm dependency. Only changes to bitECS's own files would have to be shared.

### Plan changes (approved 2026-10-04 and folded into sections 1–6)

1. **World data** stored as flat typed arrays (`y * width + x`).
2. **Job matching** by **road distance** (BFS from each home's road access, nearest with overflow, fixed order) instead of straight-line distance.
3. **Game loop** gets a max catch-up per frame, and pause throws away elapsed time.
4. **Ticks report changed tiles and buildings**, so the renderer only redraws those.
5. **Clock** exposes hour, day and month hooks.
6. **Saves** are id-based and compact, sorted for deterministic output, validated on load, and behind a `SaveProvider` interface (IndexedDB first). Versioning and a migration hook stay.
7. **Economy rule:** an empty treasury pauses immigration rather than demolishing anything.
8. **Data validation test** for building definitions, and a **headless test-scene helper**.
9. **Dependencies:** unchanged. No new packages from this review. `simplex-noise` stays optional. cimulity shows a ~40-line value-noise function is enough, so we can write our own and drop it.

