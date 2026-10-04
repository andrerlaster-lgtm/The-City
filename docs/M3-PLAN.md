# M3 — Buildings: Implementation Plan

Status: **approved 2026-10-04**, ready for implementation.
Parent plan: `docs/STAGE-1-PLAN.md` (section 5, M3).

Core rule still holds: **the simulation never knows the screen exists.**

---

## 1. Approved decisions

- **(a) Road access is required to place a building.** At least one road
  tile must share an edge (N/E/S/W) with the footprint. Touching only at a
  corner doesn't count.
- **Road access and settlement connectivity are separate.**
  - `roadAccess` is required for placement.
  - `connected` (an adjacent road can reach the settlement entrance) is a
    status and warning only. The building info panel shows it. From M5,
    only connected buildings count.
- **(b) No refund** when demolishing roads or buildings.

## 2. Scope

### Building types (data, `src/data/buildings.ts`)

| Building | Category | Size | Cost | Upkeep / day | Residents | Jobs | Terrain |
|---|---|---|---|---|---|---|---|
| Cottage | Residential | 1×1 | 100 | 1 | 4 | – | Grass or sand |
| Rowhouse | Residential | 2×2 | 350 | 3 | 16 | – | Grass or sand |
| Farm | Employment | 3×3 | 250 | 2 | – | 6 | Grass only |
| Workshop | Employment | 2×2 | 300 | 3 | – | 8 | Grass or sand |
| Well | Service | 1×1 | 150 | 2 | – | 1 | Grass or sand (radius 6) |

Each definition has these fields: `id`, `name`, `category`, `description`,
`size`, `cost`, `upkeep`, `housing`, `jobs`, `produces`, `serviceRadius`,
`requires` (`roadAccess`, `terrain`), `art`.

The definitions store upkeep now, but it isn't charged until M4. They store
residents and jobs now, but these aren't filled until M5.

### Placement rules

Rules are checked in order. The first failure becomes the reason the player
sees.

1. **"Out of bounds"**: every footprint tile must be on the map.
2. **"Blocked"**: every tile must be buildable land with no road and no
   building.
3. **"Needs grass"**: the terrain requirement must be met (Farm).
4. **"Needs road access"**: an edge-adjacent road is required.
5. **"Not enough money"**

More rules:
- Placement is all-or-nothing. A failure changes nothing and charges nothing.
- Trees under the footprint are cleared for free.
- The cursor tile is the centre of the footprint. Even sizes round toward
  the top-left: `origin = cursor - floor((size - 1) / 2)` on both axes.
- There's no rotation in Stage 1, since all footprints are square.

### Costs

- Placing a building charges its cost exactly once.
- Demolishing charges nothing and refunds nothing.

### Demolish

- One demolish stroke removes the roads and buildings it touches.
- Touching any footprint tile removes the whole building.
- The entrance stays protected.
- If the stroke removes nothing, the result is `ok: false` with
  `"Nothing to remove."`

### Roads vs. buildings

- Placing a road on a building tile is invalid, which rejects the whole stroke.
- Any change to roads or buildings recalculates `roadAccess` and `connected`
  for affected buildings. A connectivity change can reach buildings far from
  the edit, so recompute every building whose adjacent road tiles changed
  connectivity. A full recompute is also fine, because the map is
  128×128 and building counts are small.

### UI and tools

- **Build menu**: grouped by category. Each item shows its name and cost,
  and is dimmed when unaffordable.
- **Placement ghost**: follows the cursor and tints green or red. The
  reason text shows in the toolbar.
- **Info panel**: opens when a building is clicked with no tool active.
  It shows:
  - name, description, cost and upkeep
  - residents or jobs as "0 / N" (placeholder until M5)
  - road access
  - **connected to entrance**, with a warning when it isn't
- **Escape** cancels the active tool. The selection clears when a tool is
  chosen.
- **Placing a building is a click.** A click is a pointerup within about
  6 px of its pointerdown. Taps work on touch.

### Not in M3

- Construction state, pop-in and dust animations (M7).
- Charging upkeep (M4).
- Citizens, occupancy counts and live stats (M5).
- Saving (M6).

## 3. Architecture

### Simulation data

- `WorldMap.buildingAt: Int32Array`: 0 means empty; otherwise it holds the
  building's `EntityId`.
- `GameState.buildings: BuildingInstance[]`, sorted by id. Each entry is
  `{ id, defId, x, y, roadAccess, connected }`. `x` and `y` are the
  footprint origin (its top-left tile).
- `GameState.nextEntityId`: deterministic ids that are never reused.
- Everything is plain data, so M6 can serialize it as-is.

### Commands (move into `src/sim/commands.ts`)

```ts
type PlayerCommand =
  | { type: 'place-roads'; tiles: TileCoord[] }
  | { type: 'place-building'; defId: BuildingId; x: number; y: number } // x, y = cursor tile
  | { type: 'demolish'; tiles: TileCoord[] };            // roads and buildings
```

- `CommandResult` gains `changedBuildings: EntityId[]`.
- An unknown `defId` returns `ok: false`.

### Simulation API

`Simulation.ts` stays a thin dispatcher. Rules live in `src/sim/buildings/`.

Read-only queries:
- `previewBuilding(defId, cursor)` returns `{ ok, reason, cost, tiles }`.
- `getBuildings()` returns the building list for the renderer.
- `getBuilding(id)` returns one building for the info panel.

### Rendering (reads only)

- Five procedural sprites in `render/art/buildingArt.ts`. Each has height,
  a lit side and a shade side, drawn from the shared palette.
- Buildings live in the `ObjectLayer` container, so trees and buildings
  sort in depth together. A multi-tile building sorts by its front-most
  tile (the largest `x + y`).
- The placement ghost uses the building's sprite, tinted. The selected
  building gets an outline.
- If an `art` key is unknown, draw a generic box sprite.

### Input

- The tool state is `null` (select), `'road'`, `'demolish'` or
  `{ build: defId }`.
- Left-drag stays off the camera while a tool is active, as in M2.
- The M2 known issue (one-finger touch drag pans the camera) still applies
  to the drag tools only.

### Adding a sixth building

Add one data entry plus one art function. No other code changes.

## 4. Files

**New**
- `src/data/buildings.ts`
- `src/sim/commands.ts`
- `src/sim/buildings/placement.ts`: footprint, rule checks, preview
- `src/sim/buildings/buildings.ts`: add, remove, access and connected flags
- `src/render/art/buildingArt.ts`
- `src/render/placementGhost.ts`
- `src/ui/BuildMenu.tsx`
- `src/ui/InfoPanel.tsx`
- `tests/data/buildings.test.ts`
- `tests/sim/buildings.test.ts`
- `tests/helpers/scene.ts`: a flat grass world with an entrance, for tests

**Changed**
- `src/sim/Simulation.ts`: dispatch, queries, `nextEntityId`
- `src/sim/state.ts`: `buildings`, `nextEntityId`
- `src/sim/world/World.ts`: `buildingAt`
- `src/sim/roads.ts`: block building tiles; demolish delegates; trigger the
  flag update
- `src/render/layers/ObjectLayer.ts`: building sprites
- `src/render/Renderer.ts`: ghost, selection, building refresh
- `src/render/palette.ts`: building colours
- `src/input/pointer.ts`: click detection
- `src/app/Game.ts`: tool union, selection store, ghost wiring, Escape key
- `src/ui/App.tsx`, `ToolBar.tsx`, `TileInfo.tsx` (show the building on
  hover), `styles/hud.css`
- `tests/sim/roads.test.ts`: roads can't be built on buildings

Keep every source file under 400 lines. Don't add dependencies.

## 5. Test plan

### Data
- Exactly five definitions, with unique ids.
- Every field is present and in range.
- The Farm requires grass.
- Categories are valid.

### Footprint
- The cursor tile centres 1×1, 2×2 and 3×3 footprints correctly.

### Placement success
- Occupancy is filled.
- The cost is charged once.
- Trees are cleared.
- Ids run 1, 2, 3, and so on.

### Placement failures
Each case must return its reason in priority order, with no state change
and the treasury unchanged.
- Partly off the map
- Water
- Farm on sand
- Overlapping a building
- Overlapping a road
- No road
- A road that touches only at a corner
- Not enough money
- Unknown `defId`

### Access flags
- Placing a building sets `roadAccess` and `connected`.
- Demolishing a middle road tile flips `connected` on a distant building,
  and rebuilding the tile restores it.
- Removing the only adjacent road clears `roadAccess`.

### Demolish
- Touching any footprint tile removes the whole building and clears its
  occupancy.
- A mixed stroke removes both roads and buildings.
- The entrance stays protected.
- If nothing is removed, the result is `ok: false`.

### Roads
- A road can't be placed on a building tile, and the whole stroke is
  rejected.

### Determinism
- Two simulations with the same seed and the same commands end with
  deep-equal state.

### Guards
- The sim-purity and 400-line tests keep passing.

### Validation
- `npm test`, `npm run typecheck` and `npm run build` pass.
- A browser play-test passes.

## 6. Acceptance criteria

1. All five buildings can be placed from the build menu, with a green or red
   ghost and a clear reason.
2. An invalid placement does nothing and charges nothing. A valid placement
   deducts the cost exactly once.
3. Placement requires edge-to-edge road access. A building that isn't
   connected to the entrance shows a warning in the info panel.
4. Clicking a building shows its name, description, cost, upkeep, residents
   or jobs, occupants (0 until M5), road access and connected status.
5. Demolish removes buildings and roads, with no refund. Occupancy clears and
   the access flags update.
6. Roads can't overlap buildings. Buildings can't overlap roads, water or
   other buildings.
7. A sixth building needs only one data entry plus one art function.
8. The same seed plus the same commands always gives the same state.
   `src/sim/` stays pure.
9. Tests, typecheck and build pass. No source file is over 400 lines.
