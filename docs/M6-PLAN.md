# M6 — Save and Load: Implementation Plan

Status: **approved 2026-10-04**, ready for implementation.
Parent plan: `docs/STAGE-1-PLAN.md` (section 2 Save system, section 5 M6,
section 6 Save acceptance criteria). It builds on M1–M5.

The core rule still holds: **the simulation never knows the screen exists.**
`src/sim/` stays pure and deterministic. It never generates seeds, never reads
the clock, and never touches storage. The save code lives in `src/save/` and
`src/app/`.

There are **no new dependencies**. `idb-keyval` is already installed and
approved.

M6 goal: **"Close the tab, come back, the city is still there."**

---

## 1. Approved decisions

1. **Store the base map layers and rebuild derived data on load.**
   - Stored layers: `terrain`, `variant`, `trees`, `roads`.
   - Rebuilt on load: road connectivity, `buildingAt`, and each building's
     `roadAccess` and `connected`.
   - Old saves still work if world generation changes later, and loading can
     repair inconsistent derived data.
2. **Slots:** 3 manual slots plus 1 autosave slot.
3. **Autosave runs:**
   - every 5 game days
   - when the tab is hidden (`visibilitychange`)
   - right before loading another save or starting a new game
   - Autosave is driven by the app layer.
4. **Loaded games start paused.**
   - Loading must not advance simulation time.
   - The player resumes with 1×, 2× or 3×.
   - On startup, the game continues automatically from a valid autosave
     (also paused). Without one, it starts a new game.
   - New games still start at 1×, as decided in M4.
5. **New games get a random seed generated outside the simulation.**
   - The app generates it with `crypto.getRandomValues`. `src/sim/` never
     generates seeds.
   - The exact seed is saved with the game.
   - The seed is shown in the new-game and save UI, so it can be referenced or
     copied later.

## 2. Scope

M6 includes:
1. A versioned save format, with validation and a migration hook (v1 has
   nothing to migrate).
2. A `SaveProvider` interface, with an IndexedDB provider and an in-memory
   provider for tests.
3. 3 manual save slots plus an autosave slot.
4. Autosave.
5. Continuing from the autosave on startup.
6. A Save / Load / New game menu.

### Waits for later

- **M7 or later:** exporting and importing save files, and save thumbnails.
- **Stage 2 or later:** cloud saves, compression (`CompressionStream`), and
  saving in a Web Worker.

## 3. Save format

### Envelope

```ts
{
  format: 'the-city-life',
  version: 1,                      // SAVE_VERSION
  meta: { name, savedAt, seed, day, population, treasury }, // shown in the menu only
  state: SerializedState,
}
```

- `savedAt` is the real date and time, added in the app layer. It's never part
  of the simulation.
- `meta.seed` repeats `state.seed`, so the menu can show it without reading
  the whole state.

### `state` (stored)

- **Map layers:** `width`, `height`, `entranceIndex`, plus the `terrain`,
  `variant`, `trees` and `roads` typed arrays.
- **Core values:** `seed`, `rngState`, `tick`, `treasury`, `food`, `speed`.
- **Ledger:** `economy.today` and `economy.lastDay`.
- **Id counters:** `nextEntityId` and `nextCitizenId`.
- **Buildings:** `{ id, defId, x, y }`, sorted by id.
- **Citizens:** `{ id, home, job, hungryDays, unemployedDays, homelessDays }`,
  sorted by id.

### Derived (never stored, rebuilt on load)

- `roadConnected`
- `buildingAt`
- each building's `roadAccess` and `connected`

### Size and determinism

- IndexedDB stores typed arrays directly, so there's no base64 or JSON step.
- A 128×128 map is roughly 80 KB of layers, plus about 100 KB for 2,000
  citizens.
- **Deterministic:** arrays are sorted by id, so
  `serialize(load(serialize(s)))` is identical to `serialize(s)`.

## 4. Loading

```
validate → migrate → Simulation.fromState → rebuild derived data → pause
```

### Simulation API

`Simulation` gains:
- `fromState(state)`, which resumes the seeded `Rng` from `rngState`
- `exportState()`

### Validation

Validation rejects a save and gives a reason, without touching the running
game, when:
- the format is wrong, or the version is newer than this build supports
- a layer's length isn't `width × height`
- a building has an unknown `defId`
- ids are duplicated or out of order
- buildings overlap, or sit on water or a road
- a citizen points to a building that doesn't exist
- an id counter is at or below an existing id
- `entranceIndex` or `speed` is out of range

### Migrations

- A version-to-function table.
- v1 passes through unchanged, and the pipeline is tested.
- A save from a newer version is refused.

### After loading

- The renderer rebuilds its world layers (the new `Renderer.rebuildWorld`).
- Tools and selection are cleared.
- Speed is set to **0 (paused)**.
- No tick runs until the player resumes.

## 5. Slots, autosave and new games

- **Slots:**
  - 3 manual slots: save, load, delete.
  - 1 autosave slot: load only.
- **Autosave** follows decision 3. It's driven by `src/app/saveService.ts`,
  never by the simulation.
- **Startup:**
  1. If the autosave is valid, continue from it, paused.
  2. Otherwise, start a new game.
- **New game:**
  - The app generates a random seed, starts the simulation with
    `new Simulation(seed)` at 1×, and shows the seed in the menu.
  - Optionally, a typed seed replays a known map. This uses the same seed
    path and needs nothing new in the simulation.
- **Failures:**
  - **IndexedDB unavailable** (some private windows): the menu shows "Saving
    isn't available in this browser", and the game keeps running.
  - **Storage quota errors:** an inline error, and the game keeps running.
  - **Corrupted slot:** the slot shows "Can't load: \<reason\>".

## 6. UI

- **Menu:** a Menu button in the top bar opens the `SaveMenu` panel.
- **Panel header:** the current game's **seed**, as selectable text with a
  Copy button.
  - The Copy button uses `navigator.clipboard.writeText` when it's available.
  - The seed text can always be selected by hand.
- **Each slot shows:**
  - its name
  - the game date
  - population
  - treasury
  - the seed
  - when it was saved
  - Save, Load and Delete buttons
- **Confirmations happen inside the panel** (no browser dialogs):
  - "Overwrite slot 2?"
  - "Load? Unsaved progress since the last autosave will be lost."
  - "Start a new game?"
- **Status messages** ("Saved", "Loaded", or an error) appear inline. Toasts
  come in M7.
- **Styles** go in a new file, `styles/save.css`.

## 7. Files

### New

| File | Purpose |
|---|---|
| `src/save/format.ts` | types, `SAVE_VERSION` |
| `src/save/serialize.ts` | |
| `src/save/validate.ts` | |
| `src/save/migrations.ts` | |
| `src/save/providers/SaveProvider.ts` | |
| `src/save/providers/indexedDb.ts` | uses `idb-keyval` |
| `src/save/providers/memory.ts` | |
| `src/app/saveService.ts` | slots, autosave, continue on startup, new-game seed |
| `src/ui/SaveMenu.tsx` | |
| `src/ui/styles/save.css` | |
| `tests/save/serialize.test.ts`, `validate.test.ts`, `migrations.test.ts`, `service.test.ts` | |

### Changed

| File | Change |
|---|---|
| `src/sim/Simulation.ts` | `fromState`, `exportState` |
| `src/render/Renderer.ts` | `rebuildWorld` |
| `src/app/Game.ts` | swap in a loaded simulation; new game |
| `src/main.tsx` | continue on startup |
| `src/ui/TopBar.tsx`, `src/ui/App.tsx` | |
| `tests/architecture/boundaries.test.ts` | `src/save/` may not import Pixi, React or the DOM. Only the IndexedDB provider may use `idb-keyval`. |
| `PROJECT_STATE.md` | |

Every file stays under 400 lines.

## 8. Test plan

- **Round trip (the key test):** save, load, then run 30 days. The result is
  identical to running the same 30 days without saving, at 1× and at 3×.
- **Paused on load:** a loaded simulation reports speed 0, and its tick
  doesn't change until it's resumed.
- **Seed:**
  - The seed survives save and load exactly.
  - Two new games with different app-generated seeds get different maps.
  - Nothing in `src/sim/` generates a seed (guarded by the boundaries test).
- **Serialization:**
  - The same city always serializes identically.
  - Derived data is rebuilt correctly.
  - Every stored field is restored.
- **Validation:** each rejection reason is tested, and a rejected save never
  changes the running game.
- **Migrations:** v1 passes through, and a newer version is refused.
- **Save service** (in-memory provider):
  - list, save, load and delete
  - autosave every 5 days
  - continue on startup, falling back to a new game when the autosave is
    missing or broken
  - storage errors are handled gracefully
- **Performance:** serializing and deserializing a 2,000-citizen city stays
  under a generous limit, and the time is logged.
- **Validation suite:** `npm test`, `npm run typecheck`, `npm run build` and
  `git diff --check` all pass.

## 9. Manual play-test

1. Build a town and save it to slot 1. Note the seed shown in the menu.
2. Close the tab and reopen it.
   - The same town loads, **paused**.
   - The clock doesn't move until you press 1×, 2× or 3×.
3. Make changes, then load slot 1. The town goes back to the saved version,
   paused.
4. Delete a slot.
5. Start a new game. You get a different map and a new seed, and the game is
   running at 1×.
6. In a private window, the menu shows the "Saving isn't available" warning,
   and the game still runs.

## 10. Acceptance criteria

1. Save and load restore roads, buildings, citizens, treasury, food and the
   date exactly.
2. Saves carry a format version, and a migration step exists.
3. The same commands from the same save give the same result at any speed.
4. Closing and reopening the tab continues the city from the autosave.
5. Loaded games start paused, and no simulation time passes until the player
   resumes.
6. New games get a random seed generated outside `src/sim/`. The seed is saved
   with the game and shown in the UI.
7. Bad or unknown saves are rejected with a reason, and the current game is
   unaffected.
8. There are 3 manual slots plus autosave, with save, load, delete and new
   game, and the confirmations happen inside the panel.
9. `src/sim/` stays pure. Tests, typecheck and build pass, and no file is over
   400 lines.

## 11. Edge cases

- Loading during a drag, or while a tool is active. Tools and the drag are
  cleared first.
- Two tabs autosaving. The last write wins. This is noted, not solved, in
  Stage 1.
- Saving at exactly 00:00. Saves only happen between ticks.
- A future version removes a building type. A migration handles it.
- Loading a slot written by a newer build. It's refused, and the reason is
  shown.
- The clipboard isn't available. The seed text can still be selected and
  copied by hand.
