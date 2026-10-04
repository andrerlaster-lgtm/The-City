# M4 — Time and Economy: Implementation Plan

Status: **approved 2026-10-04**, ready for implementation.
Parent plan: `docs/STAGE-1-PLAN.md` (section 5, M4).

The core rule still holds: **the simulation never knows the screen exists.**
`src/sim/` stays pure TypeScript. It uses no timers and no browser APIs,
and never calls `Math.random()`.

**M4 has no citizens, so tax income is always 0.** In M4 the treasury only
goes down, from construction and upkeep. Taxes start in M5.

---

## 1. Approved decisions

1. **Debt is allowed.**
   - Upkeep is always charged, so the treasury may go below 0.
   - Building is blocked while in debt, by the existing cost check.
   - Nothing is ever demolished automatically.
2. **Taxes stay at 0 until M5 adds citizens.** Don't add any placeholder
   income.
3. **Road upkeep is `round(road tiles × 0.1)` per day.** The settlement
   entrance is free.
4. **Every building pays upkeep**, including buildings that aren't connected
   to the entrance.
5. **A new game starts running at 1×.**

## 2. Scope

1. A fixed-step clock with pause, 1×, 2× and 3×. One tick is one game hour,
   and ticks are deterministic.
2. A running date and hour in the top bar.
3. A daily economy. Building and road upkeep are charged once per game day.
   Taxes are built and tested now, but stay at 0 until M5.
4. An income breakdown. The treasury shows a projected net per day, and a
   popover lists taxes, upkeep, construction and the net result.
5. The treasury rule. An empty treasury never demolishes anything, and it sets
   "immigration paused", which M5 will read. Everything else keeps running.

### Waits until M5

- citizens, and the actual tax amounts
- farm food
- workshop revenue
- how immigration actually works (M4 only sets the flag)
- population, free housing and jobs
- Well coverage
- job matching
- only counting buildings that are connected to the entrance

## 3. Time design

### The simulation only knows ticks

- `Simulation.tick()` advances 1 hour.
- When the tick count crosses a multiple of 24 (00:00 of a new day),
  `tick()` runs the **daily step** for the day that just ended. The first
  charge happens at tick 24, which is Day 2, 00:00.
- The daily step keeps the Stage 1 order: production, consumption, economy,
  jobs, migration, stats. Only economy exists in M4.
- Cadence helpers live in `sim/time/clock.ts`: `isDayStart(tick)` and
  `dayIndex(tick)`. Month boundaries are left for later.

### Speed is stored in simulation state but never changes the rules

- A `set-speed` command sets speed to 0, 1, 2 or 3. This is the plan's
  `SetSpeed`, and storing it lets M6 save it.
- The simulation never uses speed for anything. Only the app loop reads it.
- Commands, including building, still work while paused.
- `BALANCE.time.startSpeed = 1`.

### The real-time loop is app-side and pure

`src/app/loop.ts` holds `FixedStepper`, which is testable in Node.

- `advance(elapsedMs, speed)` returns the number of ticks to run.
- Milliseconds per tick are `BALANCE.time.msPerTickAt1x / speed`, so 500 ms
  at 1×. That gives:

  | Speed | Ticks per second | One game day lasts |
  |---|---|---|
  | 1× | 2 | 12 s |
  | 2× | 4 | 6 s |
  | 3× | 6 | 4 s |

- The loop runs at most `BALANCE.time.maxCatchUpTicks` (8) ticks per frame,
  and **throws away** any elapsed time beyond that. A backgrounded tab won't
  run a burst of ticks when it comes back.
- Pausing clears the accumulator, so resuming doesn't burst. Changing speed
  keeps any partial tick.
- The loop is driven by Pixi's frame ticker (`app.ticker.deltaMS`) in
  `Game.ts`. There's no `setInterval` or `setTimeout` anywhere.
- After a frame that ran ticks, `Game` publishes the snapshot once and
  redraws any tiles and buildings the ticks reported as changed (none in M4).

### Determinism

- Simulation state depends only on the tick count and on the commands applied
  between ticks. Speed and frame timing never affect it.
- M4 uses no randomness. `rngState` is still passed through.

## 4. Economy design

### Data

`BALANCE.economy` gains:
- `roadUpkeepPerTile: 0.1`
- `taxPerEmployed` and `taxPerResident`, which are defined now and used in M5

Building upkeep comes from each building's definition.

### State

`GameState.economy` holds:
- `today: Ledger`, the running total for the current day:
  `{ construction, upkeepBuildings, upkeepRoads, taxes }`
- `lastDay: DailyReport | null`:
  `{ day, construction, upkeepBuildings, upkeepRoads, taxes, net, treasuryAfter }`

All money is whole coins.

### Daily step (`sim/economy/economy.ts`, pure functions)

These steps run in a fixed order:
1. **Taxes.** `taxesFor(state)` is 0 in M4. The formula is tested with test
   counts passed in directly.
2. **Building upkeep.** The sum of every building's `upkeep`, including
   buildings not connected to the entrance.
3. **Road upkeep.** `Math.round(roadTiles × roadUpkeepPerTile)`. The
   entrance tile isn't counted.
4. **Close the day.** Apply the result to the treasury, fill in `lastDay`
   (including `net` and `treasuryAfter`), and reset `today`.

### Construction and projections

- **Construction.** `applyCommand` adds the cost of roads and buildings to
  `today.construction`. The charge still happens immediately, as it did in M3.
- **Projection.** `projectedDaily(state)` gives
  `{ income, expenses, net }` per day for the current city. The "/day"
  figure in the UI uses it.

### Snapshot

`SimSnapshot` gains:
- `speed`
- `economy: { today, lastDay, projected, immigrationPaused }`

The snapshot carries plain numbers only. All formatting happens in the UI.

## 5. Treasury rules

- Upkeep is always charged, even when it takes the treasury below 0.
- Nothing is ever demolished or disabled automatically.
- Building is still blocked when `treasury < cost`, so while in debt nothing
  that costs money can be built. Demolishing still works.
- `immigrationPaused = treasury <= 0`. It's derived from the treasury and
  never stored separately, and it's exposed in the snapshot. In M4 it only
  drives a UI warning. M5's migration step will read it.
- The clock, upkeep, roads, connectivity and commands all keep running
  normally while in debt.

## 6. UI

### Speed controls (`SpeedControls.tsx`)

- Buttons for ⏸, 1×, 2× and 3×. The active button is highlighted, and each
  button sends `set-speed`.
- Keys:
  - **Space** toggles pause. Resuming returns to the last speed.
  - **1**, **2** and **3** set the speed.
  - Keys are ignored while focus is in a text input.

### Top bar

- The treasury shows the projected net per day, for example
  "4,620 ◈ −14/day". It's green when positive and amber when negative.
- The date and hour update live.

### Economy breakdown popover (`EconomyPanel.tsx`)

Clicking the treasury opens it. It shows:
- **Income:** taxes. This shows 0, with the note "citizens arrive in M5".
- **Expenses:** building upkeep, road upkeep, and construction today.
- **Net:** yesterday's net and the projected net per day.

### Debt warning

When `treasury <= 0`, an amber banner reads "Funds empty — immigration
paused".

### Formatting

Signed money and "/day" helpers go in `ui/format.ts`. The simulation only
supplies numbers.

## 7. Commands and events

```ts
type PlayerCommand =
  | { type: 'place-roads'; tiles: TileCoord[] }
  | { type: 'place-building'; defId: BuildingId; x: number; y: number }
  | { type: 'demolish'; tiles: TileCoord[] }
  | { type: 'set-speed'; speed: 0 | 1 | 2 | 3 };
```

There are no new events in M4. The UI reads the snapshot, which is enough.
A `TreasuryChanged` event can be added later if it's needed.

## 8. Files

**New**
- `src/sim/economy/economy.ts`: ledger, daily step, projection, taxes
- `src/sim/time/clock.ts`: day cadence helpers
- `src/app/loop.ts`: `FixedStepper`, plus attaching it to the frame ticker
- `src/ui/SpeedControls.tsx`
- `src/ui/EconomyPanel.tsx`
- `tests/sim/economy.test.ts`
- `tests/sim/clock.test.ts`
- `tests/app/loop.test.ts`

**Changed**
- `src/sim/state.ts`: `speed`, `economy`
- `src/sim/Simulation.ts`: the daily step inside `tick()`, `set-speed`, the
  construction ledger, the snapshot
- `src/sim/commands.ts`: `set-speed`
- `src/data/balance.ts`: economy constants, `startSpeed`
- `src/app/Game.ts`: loop wiring, speed keys
- `src/ui/TopBar.tsx`, `src/ui/App.tsx`, `src/ui/format.ts`,
  `src/ui/styles/hud.css`
- `tests/helpers/scene.ts`: `runDays`
- `tests/architecture/boundaries.test.ts`: also forbid `setInterval`,
  `setTimeout`, `requestAnimationFrame` and `performance` in `src/sim/`
- `PROJECT_STATE.md`

Every file stays under 400 lines. Don't add any dependencies.

## 9. Test plan

### Clock
- The daily step runs exactly at ticks 24, 48, and so on. It never runs at
  tick 0 or partway through a day.
- The date rolls over correctly across months and years, including over a
  400-day run.

### `FixedStepper`
- 1000 ms gives 2, 4 and 6 ticks at 1×, 2× and 3×.
- A partial tick carries over to the next frame.
- When paused, it returns 0 ticks and clears the accumulator, so resuming
  doesn't burst.
- A 60-second gap gives at most 8 ticks, and the rest is thrown away.
- Changing speed keeps the partial tick.

### Upkeep
- Building upkeep equals the sum from the definitions.
- Road upkeep is rounded, and the entrance isn't counted.
- Buildings not connected to the entrance still pay.
- A demolished building stops paying from the next day.

### Ledger
- Construction adds to `today`.
- At the day boundary, `today` moves into `lastDay` and then resets.
- `net` and `treasuryAfter` are correct.

### Taxes
- The tax formula gives 0 with no citizens.
- It gives the right amount for test counts passed in directly.

### Treasury and debt
- Upkeep can push the treasury below 0.
- Nothing is removed while in debt.
- `immigrationPaused` is true at 0 or below, and false above 0.
- While in debt, building fails with "Not enough money", and demolishing
  still works.

### Determinism
- The same seed with the same commands at the same ticks gives deep-equal
  state.
- 240 ticks run one at a time give the same state as 240 ticks run in
  batches.
- Changing speed doesn't change state, apart from the stored `speed` field.

### Guards
- The sim-purity test passes, including the new timer and `performance` check.
- The 400-line file-size test passes.

### Validation
- `npm test`, `npm run typecheck`, `npm run build` and `git diff --check`
  all pass.

## 10. Manual play-test

1. A new game runs at 1×, and the clock advances about 2 hours per second.
   2× and 3× are visibly faster.
2. Pause freezes the clock, and resuming doesn't jump.
3. Space and the 1, 2 and 3 keys work.
4. Place some buildings and roads.
   - The "/day" figure updates right away.
   - At 00:00, the treasury drops by the projected amount.
   - The popover's numbers match what happened.
5. Switch to another tab for about 30 seconds, then come back. The clock
   advances by at most a few hours, not days.
6. Spend down to about 0 and let upkeep push the treasury below 0.
   - The banner appears.
   - Nothing is demolished.
   - Building is blocked.
   - Demolishing still works.

## 11. Acceptance criteria

1. Pause, 1×, 2× and 3× work. The date and hour advance in the top bar.
   Pausing freezes time, and resuming doesn't jump. A new game starts at 1×.
2. Upkeep is charged exactly once per game day, at 00:00. It covers every
   building, including disconnected ones, plus `round(road tiles × 0.1)`.
   The entrance is free.
3. The treasury goes down on construction and upkeep. The top bar shows the
   projected net per day, and a breakdown of income and expenses for today
   and yesterday.
4. Taxes are calculated and shown, and they are 0 until M5's citizens exist.
   There is no placeholder income.
5. An empty treasury, or a treasury in debt, pauses immigration (the flag and
   the banner). It never demolishes or disables anything, and the game keeps
   running.
6. The same commands at the same ticks give the same state at any speed, and
   whether ticks run one at a time or in batches.
7. A backgrounded tab runs at most 8 ticks when it comes back.
8. `src/sim/` stays pure: no timers, no browser APIs, no `Math.random`.
   Tests, typecheck and build pass, and no file is over 400 lines.

## 12. Edge cases

- **Exactly 0 coins.** `immigrationPaused` is true. A building that costs
  0 coins would still be allowed, but none exist.
- **Placing a building at 23:00.** Its cost goes into that day's ledger, and
  its upkeep is charged at the 00:00 boundary that follows.
- **Demolishing before 00:00.** The building pays no upkeep for that day,
  because upkeep is computed at the boundary from the buildings that exist
  then.
- **A very long frame (tab return).** It's capped at 8 ticks, and the
  remainder is thrown away. It's never carried over to later frames.
- **Changing speed partway through a frame.** The new speed applies to the
  next frame's elapsed time.
- **Speed 0 with commands.** Commands are still applied, and no ticks run.
- **0 road tiles, or only the entrance.** Road upkeep is 0. For example,
  1 to 4 road tiles round to 0, and 5 tiles round to 1.
- **Month and year rollover.** Only the date changes, and the economy is
  unaffected.
