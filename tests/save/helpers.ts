import type { GameHost } from '../../src/app/saveService';
import { Simulation } from '../../src/sim/Simulation';
import { createConnectedTown, runDays } from '../helpers/scene';

/** A populated town with roads, all five building types and citizens. */
export function populatedTown(days = 10): Simulation {
  const sim = createConnectedTown();
  runDays(sim, days);
  return sim;
}

/** Stands in for Game: records swaps and applies the same pause rule. */
export class FakeHost implements GameHost {
  replaced: { sim: Simulation; paused: boolean }[] = [];
  constructor(public sim: Simulation) {}
  replaceSimulation(sim: Simulation, options: { paused: boolean }): void {
    if (options.paused) sim.applyCommand({ type: 'set-speed', speed: 0 });
    this.sim = sim;
    this.replaced.push({ sim, paused: options.paused });
  }
}

export const flush = () => new Promise((resolve) => setTimeout(resolve, 0));
