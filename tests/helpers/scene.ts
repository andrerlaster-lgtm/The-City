/**
 * Headless scene helper: builds a simulation for tests without a browser.
 * Grows with the sim (roads, buildings, citizens) as milestones land.
 */
import { Simulation } from '../../src/sim/Simulation';

export const TEST_SEED = 12345;

export function createScene(seed: number = TEST_SEED): Simulation {
  return new Simulation(seed);
}

export function runTicks(sim: Simulation, ticks: number): void {
  for (let i = 0; i < ticks; i++) sim.tick();
}
