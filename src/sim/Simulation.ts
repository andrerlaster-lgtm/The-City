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
import { demolishRoads, placeRoads, previewDemolish, previewRoads, type RoadPreview } from './roads';

export type PlayerCommand =
  | { type: 'place-roads'; tiles: TileCoord[] }
  | { type: 'demolish'; tiles: TileCoord[] };

export interface CommandResult {
  ok: boolean;
  reason: string | null;
  cost: number;
  /** Edited tiles plus every road tile whose connected state flipped. */
  changedTiles: TileCoord[];
  treasury: number;
}

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

  /** The sole player entry point for deterministic, validated state changes. */
  applyCommand(command: PlayerCommand): CommandResult {
    const treasury = this.state.treasury;
    if (command.type === 'place-roads') {
      const { preview, placed, connectivityChanged, treasury: next } = placeRoads(this.state.world, command.tiles, treasury);
      if (!preview.valid) return fail('Roads require buildable land.', preview.cost, treasury);
      if (!preview.affordable) return fail('Not enough money.', preview.cost, treasury);
      if (!placed.length) return fail('No new road tiles.', 0, treasury);
      this.state.treasury = next;
      return { ok: true, reason: null, cost: preview.cost, changedTiles: [...placed, ...connectivityChanged], treasury: next };
    }
    const { removed, connectivityChanged } = demolishRoads(this.state.world, command.tiles);
    if (!removed.length) return fail('No roads to remove.', 0, treasury);
    return { ok: true, reason: null, cost: 0, changedTiles: [...removed, ...connectivityChanged], treasury };
  }

  previewRoads(tiles: readonly TileCoord[]): RoadPreview {
    return previewRoads(this.state.world, tiles, this.state.treasury);
  }

  previewDemolish(tiles: readonly TileCoord[]): { removable: number } {
    return previewDemolish(this.state.world, tiles);
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

function fail(reason: string, cost: number, treasury: number): CommandResult {
  return { ok: false, reason, cost, changedTiles: [], treasury };
}
