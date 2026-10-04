/**
 * Owns the game state and advances it in fixed steps.
 * PURE: must never import rendering, UI or browser APIs (enforced by tests).
 */
import { Rng } from '../core/rng';
import type { TileCoord, EntityId } from '../core/types';
import { BALANCE } from '../data/balance';
import type { GameState } from './state';
import { tickToDate, type GameDate } from './time/calendar';
import { generateWorld } from './world/generate';
import type { WorldMap } from './world/World';

/** What changed during a tick, so the renderer can redraw only that. */
export interface TickResult {
  tick: number;
  changedTiles: TileCoord[];
  changedBuildings: EntityId[];
}

/** Read-only view handed to the renderer and UI. */
export interface SimSnapshot {
  tick: number;
  date: GameDate;
  treasury: number;
  population: number;
  freeHousing: number;
  freeJobs: number;
}

export class Simulation {
  private state: GameState;
  private readonly rng: Rng;

  constructor(seed: number) {
    this.rng = new Rng(seed);
    this.state = {
      seed,
      rngState: this.rng.getState(),
      tick: 0,
      treasury: BALANCE.economy.startingTreasury,
      world: generateWorld(seed, BALANCE.map.width, BALANCE.map.height),
    };
  }

  tick(): TickResult {
    this.state.tick += 1;
    this.state.rngState = this.rng.getState();
    return { tick: this.state.tick, changedTiles: [], changedBuildings: [] };
  }

  /** Read-only access for the renderer. Callers must not write to the layers. */
  getWorld(): Readonly<WorldMap> {
    return this.state.world;
  }

  snapshot(): SimSnapshot {
    return {
      tick: this.state.tick,
      date: tickToDate(this.state.tick),
      treasury: this.state.treasury,
      population: 0,
      freeHousing: 0,
      freeJobs: 0,
    };
  }
}
