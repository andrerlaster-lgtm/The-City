import { describe, expect, it } from 'vitest';
import { taxesFor, buildingUpkeep, roadUpkeep } from '../../src/sim/economy/economy';
import { createConnectedTown, createFlatScene, runDays, runTicks } from '../helpers/scene';
import { toIndex } from '../../src/core/grid';

describe('city economy', () => {
  it('calculates approved tax rates and starts a new city with zero citizen income', () => {
    expect(taxesFor(4, 2)).toBe(8);
    expect(taxesFor(0, 0)).toBe(0);
    expect(createFlatScene().snapshot().economy.projected.income).toBe(0);
  });

  it('projects taxes and workshop revenue accurately for the next daily settlement', () => {
    const sim = createConnectedTown();
    runDays(sim, 5);
    const projected = sim.snapshot().economy.projected;
    expect(projected.taxesResidents).toBeGreaterThan(0);
    expect(projected.revenue).toBeGreaterThan(0);
    runDays(sim, 1);
    expect(sim.snapshot().economy.lastDay).toMatchObject({
      taxesResidents: projected.taxesResidents,
      taxesEmployed: projected.taxesEmployed,
      revenue: projected.revenue,
      net: projected.net,
    });
  });

  it('charges all building upkeep, including disconnected buildings', () => {
    const sim = createFlatScene();
    sim.applyCommand({ type: 'place-roads', tiles: [{ x: 5, y: 5 }] });
    const result = sim.applyCommand({ type: 'place-building', defId: 'cottage', x: 5, y: 6 });
    expect(result.ok).toBe(true);
    expect(sim.getBuilding(1)?.connected).toBe(false);
    expect(buildingUpkeep(sim.getBuildings())).toBe(1);
    runTicks(sim, 24);
    expect(sim.snapshot().treasury).toBe(4889);
    expect(sim.snapshot().economy.lastDay).toMatchObject({ upkeepBuildings: 1, upkeepRoads: 0, taxes: 0, construction: 110, net: -111 });
  });

  it('rounds road upkeep and excludes the settlement entrance', () => {
    const sim = createFlatScene();
    const world = sim.getWorld();
    for (const [x, y] of [[1, 1], [2, 1], [3, 1], [4, 1], [5, 1]] as const) world.roads[toIndex(x, y, world.width)] = 1;
    expect(roadUpkeep(world)).toBe(1);
    for (let x = 1; x <= 10; x++) world.roads[toIndex(x, 2, world.width)] = 1;
    expect(roadUpkeep(world)).toBe(2); // 15 tiles × 0.1 = 1.5 rounds to 2
    world.roads.fill(0);
    world.roads[world.entranceIndex] = 1;
    expect(roadUpkeep(world)).toBe(0);
  });

  it('records construction, charges upkeep into debt, blocks building and preserves demolition', () => {
    const sim = createFlatScene(5, 12, 12, 120);
    const entranceX = sim.getWorld().entranceIndex % sim.getWorld().width;
    sim.applyCommand({ type: 'place-roads', tiles: [{ x: entranceX, y: 1 }, { x: entranceX + 1, y: 1 }] });
    const placed = sim.applyCommand({ type: 'place-building', defId: 'cottage', x: entranceX, y: 2 });
    expect(placed.ok).toBe(true);
    expect(sim.snapshot().economy.today.construction).toBe(120);
    runTicks(sim, 24);
    expect(sim.snapshot().treasury).toBe(-1);
    expect(sim.snapshot().economy.immigrationPaused).toBe(true);
    expect(sim.snapshot().economy.lastDay).toMatchObject({ construction: 120, treasuryAfter: -1 });
    expect(sim.applyCommand({ type: 'place-building', defId: 'well', x: entranceX + 1, y: 2 })).toMatchObject({ ok: false, reason: 'Not enough money' });
    expect(sim.getBuildings()).toHaveLength(1);
    expect(sim.applyCommand({ type: 'demolish', tiles: [{ x: entranceX, y: 2 }] }).ok).toBe(true);
    expect(sim.getBuildings()).toHaveLength(0);
  });

  it('stores speed without changing tick-driven simulation rules', () => {
    const sim = createFlatScene();
    expect(sim.snapshot().speed).toBe(1);
    sim.applyCommand({ type: 'set-speed', speed: 0 });
    expect(sim.snapshot().speed).toBe(0);
    expect(sim.snapshot().tick).toBe(0);
  });

  it('does not charge a demolished building at the next day boundary', () => {
    const sim = createFlatScene();
    const entranceX = sim.getWorld().entranceIndex % sim.getWorld().width;
    sim.applyCommand({ type: 'place-roads', tiles: [{ x: entranceX, y: 1 }] });
    sim.applyCommand({ type: 'place-building', defId: 'cottage', x: entranceX, y: 2 });
    runTicks(sim, 23);
    sim.applyCommand({ type: 'demolish', tiles: [{ x: entranceX, y: 2 }] });
    runTicks(sim, 1);
    expect(sim.snapshot().economy.lastDay?.upkeepBuildings).toBe(0);
  });

  it('produces the same economy state for equal ticks regardless of speed setting', () => {
    const normal = createFlatScene(22);
    const fast = createFlatScene(22);
    normal.applyCommand({ type: 'place-roads', tiles: [{ x: 6, y: 1 }] });
    fast.applyCommand({ type: 'place-roads', tiles: [{ x: 6, y: 1 }] });
    normal.applyCommand({ type: 'set-speed', speed: 1 });
    fast.applyCommand({ type: 'set-speed', speed: 3 });
    runTicks(normal, 240);
    runTicks(fast, 240);
    expect(normal.snapshot()).toMatchObject({ tick: fast.snapshot().tick, date: fast.snapshot().date, treasury: fast.snapshot().treasury, economy: fast.snapshot().economy });
  });

  it('rejects an invalid speed without changing state', () => {
    const sim = createFlatScene();
    expect(sim.applyCommand({ type: 'set-speed', speed: 5 as never })).toMatchObject({ ok: false, reason: 'Invalid speed.' });
    expect(sim.getSpeed()).toBe(1);
  });

  it('pauses immigration at exactly 0 coins but not at 1', () => {
    expect(createFlatScene(1, 12, 12, 0).snapshot().economy.immigrationPaused).toBe(true);
    expect(createFlatScene(1, 12, 12, 1).snapshot().economy.immigrationPaused).toBe(false);
  });

  it('blocks road building while in debt', () => {
    const sim = createFlatScene(1, 12, 12, -5);
    const entranceX = sim.getWorld().entranceIndex % sim.getWorld().width;
    expect(sim.applyCommand({ type: 'place-roads', tiles: [{ x: entranceX, y: 1 }] })).toMatchObject({ ok: false, reason: 'Not enough money.' });
    expect(sim.snapshot().treasury).toBe(-5);
  });

  it('keeps only the latest day, resets today, and makes net match the whole-day treasury change', () => {
    const sim = createFlatScene();
    const entranceX = sim.getWorld().entranceIndex % sim.getWorld().width;
    const start = sim.snapshot().treasury;
    sim.applyCommand({ type: 'place-roads', tiles: [{ x: entranceX, y: 1 }] });
    sim.applyCommand({ type: 'place-building', defId: 'cottage', x: entranceX, y: 2 });
    runTicks(sim, 24);
    const day1 = sim.snapshot().economy.lastDay;
    expect(day1).toMatchObject({ day: 1, construction: 110, upkeepBuildings: 1, net: -111, treasuryAfter: start - 111 });
    expect(sim.snapshot().economy.today).toMatchObject({ construction: 0, upkeepBuildings: 0, upkeepRoads: 0, taxes: 0, revenue: 0, foodProduced: 0, foodEaten: 0 });
    runTicks(sim, 24);
    expect(sim.snapshot().economy.lastDay).toMatchObject({ day: 2, construction: 0, net: 0, treasuryAfter: start - 111 });
    expect(sim.snapshot().treasury).toBe(start - 111);
  });

  it('produces deep-equal state for the same commands at the same ticks, whatever the speed', () => {
    const run = (speed: 0 | 1 | 2 | 3) => {
      const sim = createFlatScene(7);
      const entranceX = sim.getWorld().entranceIndex % sim.getWorld().width;
      sim.applyCommand({ type: 'set-speed', speed });
      sim.applyCommand({ type: 'place-roads', tiles: [{ x: entranceX, y: 1 }, { x: entranceX, y: 2 }] });
      runTicks(sim, 30);
      sim.applyCommand({ type: 'place-building', defId: 'rowhouse', x: entranceX + 1, y: 2 });
      runTicks(sim, 50);
      sim.applyCommand({ type: 'demolish', tiles: [{ x: entranceX, y: 2 }] });
      runTicks(sim, 20);
      return sim;
    };
    const a = run(1); const b = run(3);
    expect(a.getBuildings()).toEqual(b.getBuildings());
    for (const key of ['terrain', 'trees', 'variant', 'roads', 'roadConnected', 'buildingAt'] as const) {
      expect(a.getWorld()[key]).toEqual(b.getWorld()[key]);
    }
    expect({ ...a.snapshot(), speed: 0 }).toEqual({ ...b.snapshot(), speed: 0 });
  });
});
