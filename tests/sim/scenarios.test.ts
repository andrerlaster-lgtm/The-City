import { describe, expect, it } from 'vitest';
import { createEmptyWorld } from '../../src/sim/world/World';
import type { GameState } from '../../src/sim/state';
import { emptyLedger } from '../../src/sim/economy/economy';
import { runDaily } from '../../src/sim/daily';
import type { Citizen } from '../../src/sim/citizens/citizens';
import type { BuildingInstance } from '../../src/sim/buildings/buildings';
import { toIndex } from '../../src/core/grid';
import { createConnectedTown, createFlatScene, runDays } from '../helpers/scene';

describe('Stage 1 citizen scenarios', () => {
  it('housing without jobs brings one unemployed citizen, then records their departure', () => {
    const sim = createFlatScene();
    const entranceX = sim.getWorld().entranceIndex % sim.getWorld().width;
    sim.applyCommand({ type: 'place-roads', tiles: [{ x: entranceX, y: 1 }] });
    sim.applyCommand({ type: 'place-building', defId: 'cottage', x: entranceX, y: 2 });
    runDays(sim, 1);
    expect(sim.snapshot().population).toBe(1);
    runDays(sim, 7);
    expect(sim.snapshot().economy.lastDay?.migration.left.unemployment).toBe(1);
    expect(sim.snapshot().population).toBe(1);
    expect(sim.getCitizens()[0]?.id).toBeGreaterThan(1);
  });

  it('connected homes and workplaces grow the population, and farms sustain food', () => {
    const sim = createConnectedTown();
    runDays(sim, 10);
    expect(sim.snapshot().population).toBeGreaterThan(10);
    expect(sim.snapshot().employed).toBeGreaterThan(0);
    expect(sim.getBuildings().some((building) => building.defId === 'farm')).toBe(true);
    expect(sim.snapshot().economy.lastDay?.foodProduced).toBeGreaterThan(0);
    expect(sim.snapshot().freeHousing).toBeLessThan(32);
    const farms = sim.getBuildings().filter((building) => building.defId === 'farm');
    sim.applyCommand({ type: 'demolish', tiles: farms.map(({ x, y }) => ({ x, y })) });
    const previousFood = sim.snapshot().food;
    runDays(sim, 20);
    expect(sim.snapshot().food).toBeLessThan(previousFood);
    expect(sim.snapshot().economy.lastDay?.foodProduced).toBe(0);
    expect(sim.snapshot().economy.lastDay?.migration.left.hunger).toBeGreaterThan(0);
  });

  it('residents keep a disconnected home, lose their jobs and recover if reconnected promptly', () => {
    const sim = createConnectedTown();
    runDays(sim, 8);
    const entranceX = sim.getWorld().entranceIndex % sim.getWorld().width;
    const cutoffX = entranceX + 5;
    const disconnectedHome = sim.getBuildings().find((building) => building.defId === 'cottage' && building.x > cutoffX)!;
    const resident = sim.getCitizens().find((citizen) => citizen.home === disconnectedHome.id);
    expect(resident).toBeDefined();
    sim.applyCommand({ type: 'demolish', tiles: [{ x: cutoffX, y: 1 }] });
    expect(sim.getBuilding(disconnectedHome.id)?.connected).toBe(false);
    runDays(sim, 1);
    expect(sim.getCitizens().find((citizen) => citizen.id === resident!.id)).toMatchObject({ home: disconnectedHome.id, job: 0, homelessDays: 1 });
    sim.applyCommand({ type: 'place-roads', tiles: [{ x: cutoffX, y: 1 }] });
    runDays(sim, 1);
    expect(sim.getCitizens().find((citizen) => citizen.id === resident!.id)?.homelessDays).toBe(0);
  });

  it('a profitable occupied town clears a small debt, then resumes migration', () => {
    const sim = createConnectedTown();
    runDays(sim, 12);
    const residents = sim.getCitizens();
    expect(residents.length).toBeGreaterThan(0);
    const state = (sim as unknown as { state: GameState }).state;
    state.treasury = -1;
    expect(sim.snapshot().economy.immigrationPaused).toBe(true);
    runDays(sim, 1);
    expect(sim.snapshot().treasury).toBeGreaterThan(0);
    expect(sim.snapshot().economy.immigrationPaused).toBe(false);
  });

  // Warmed-up timing: JIT warm-up and GC make a cold 3-sample run swing between ~4 and ~11 ms.
  // CI asserts a generous p95 bound; the logged median/p95 are what to compare with the 5 ms target.
  it('keeps 2,000-citizen daily steps fast, including mass unemployment with jobs far away', () => {
    const steady = townState(false);
    const farJobs = townState(true);
    const steadyMs = timeDaily(steady);
    const farMs = timeDaily(farJobs);
    console.info(`[M5 performance] 2,000 citizens, 128×128: steady median ${steadyMs.median.toFixed(2)} ms (p95 ${steadyMs.p95.toFixed(2)}); `
      + `all unemployed, jobs at far edge: median ${farMs.median.toFixed(2)} ms (p95 ${farMs.p95.toFixed(2)})`);
    expect(steadyMs.p95).toBeLessThan(50);
    expect(farMs.p95).toBeLessThan(50);
    const farDay = fresh(farJobs);
    runDaily(farDay, 1);
    expect(farDay.citizens.every((citizen) => citizen.job > 0)).toBe(true);
  });
});

/**
 * 125 Rowhouses (2,000 citizens) along 16 road rows. `farJobs`: everyone unemployed and all
 * 250 Workshops on two extra road rows at the far edge, so every home's BFS crosses the map.
 */
function townState(farJobs: boolean): GameState {
  const world = createEmptyWorld(128, 128);
  world.entranceIndex = toIndex(0, 0, 128);
  for (let y = 0; y < 128; y++) world.roads[toIndex(0, y, 128)] = world.roadConnected[toIndex(0, y, 128)] = 1;
  for (let row = 0; row < 16; row++) for (let x = 0; x < 128; x++) {
    const index = toIndex(x, row * 7 + 1, 128); world.roads[index] = world.roadConnected[index] = 1;
  }
  if (farJobs) for (const y of [113, 120]) for (let x = 0; x < 128; x++) {
    const index = toIndex(x, y, 128); world.roads[index] = world.roadConnected[index] = 1;
  }
  const homeAt = (index: number) => ({ x: 5 + (index % 8) * 15, y: 2 + Math.floor(index / 8) * 7 });
  const homes: BuildingInstance[] = Array.from({ length: 125 }, (_, index) => ({
    id: index + 1, defId: 'rowhouse', ...homeAt(index), roadAccess: true, connected: true,
  }));
  // Bands touching road row 113 (from y 111 and 114) and row 120 (from y 118 and 121), 63 Workshops each.
  const farBands = [111, 114, 118, 121];
  const workplaces: BuildingInstance[] = Array.from({ length: 250 }, (_, index) => {
    if (farJobs) return { id: index + 126, defId: 'workshop', x: 1 + 2 * (index % 63), y: farBands[Math.floor(index / 63)]!, roadAccess: true, connected: true };
    const home = homeAt(Math.floor(index / 2));
    return { id: index + 126, defId: 'workshop', x: home.x + 4 + (index % 2) * 4, y: home.y, roadAccess: true, connected: true };
  });
  const citizens: Citizen[] = Array.from({ length: 2000 }, (_, index) => ({
    id: index + 1, home: Math.floor(index / 16) + 1,
    job: farJobs || index < 10 ? 0 : 126 + Math.floor((index - 10) / 8), hungryDays: 0, unemployedDays: 0, homelessDays: 0,
  }));
  return {
    seed: 1, rngState: 1, tick: 24, treasury: 5000, world, buildings: [...homes, ...workplaces], nextEntityId: 1,
    speed: 1, economy: { today: emptyLedger(), lastDay: null }, citizens, nextCitizenId: 2001, food: 3000,
  };
}

function fresh(state: GameState): GameState {
  return { ...state, buildings: state.buildings.map((building) => ({ ...building })), citizens: state.citizens.map((citizen) => ({ ...citizen })), economy: { today: emptyLedger(), lastDay: null } };
}

function timeDaily(state: GameState): { median: number; p95: number } {
  for (let i = 0; i < 15; i++) runDaily(fresh(state), 1);
  const samples: number[] = [];
  for (let i = 0; i < 30; i++) {
    const day = fresh(state);
    const started = performance.now();
    runDaily(day, 1);
    samples.push(performance.now() - started);
  }
  samples.sort((a, b) => a - b);
  return { median: samples[15]!, p95: samples[28]! };
}
