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
