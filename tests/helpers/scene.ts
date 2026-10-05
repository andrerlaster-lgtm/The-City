/**
 * Headless scene helper: builds a simulation for tests without a browser.
 * Grows with the sim (roads, buildings, citizens) as milestones land.
 */
import { Simulation } from '../../src/sim/Simulation';
import { TerrainId } from '../../src/data/terrain';
import { createEmptyWorld } from '../../src/sim/world/World';
import { placeSettlementEntrance } from '../../src/sim/roads';

export const TEST_SEED = 12345;

export function createScene(seed: number = TEST_SEED): Simulation {
  return new Simulation(seed);
}

/** Small deterministic flat map for placement and access tests. */
export function createFlatScene(seed: number = TEST_SEED, width = 12, height = 12, treasury = 5000): Simulation {
  const world = createEmptyWorld(width, height);
  world.terrain.fill(TerrainId.Grass);
  placeSettlementEntrance(world);
  return new Simulation(seed, world, treasury);
}

export function runTicks(sim: Simulation, ticks: number): void {
  for (let i = 0; i < ticks; i++) sim.tick();
}

export function runDays(sim: Simulation, days: number): void {
  runTicks(sim, days * 24);
}

/** Repeatable connected starter town for M5 scenarios. */
export function createConnectedTown(seed: number = TEST_SEED): Simulation {
  const sim = createFlatScene(seed, 56, 20);
  const entranceX = sim.getWorld().entranceIndex % sim.getWorld().width;
  const roadTiles = Array.from({ length: 25 }, (_, i) => ({ x: entranceX + i, y: 1 }));
  sim.applyCommand({ type: 'place-roads', tiles: roadTiles });
  for (const x of [entranceX + 2, entranceX + 4, entranceX + 6, entranceX + 8]) {
    sim.applyCommand({ type: 'place-building', defId: 'cottage', x, y: 2 });
  }
  sim.applyCommand({ type: 'place-building', defId: 'rowhouse', x: entranceX + 9, y: 2 });
  sim.applyCommand({ type: 'place-building', defId: 'well', x: entranceX + 1, y: 2 });
  sim.applyCommand({ type: 'place-building', defId: 'farm', x: entranceX + 12, y: 3 });
  sim.applyCommand({ type: 'place-building', defId: 'farm', x: entranceX + 16, y: 3 });
  sim.applyCommand({ type: 'place-building', defId: 'workshop', x: entranceX + 20, y: 2 });
  return sim;
}
