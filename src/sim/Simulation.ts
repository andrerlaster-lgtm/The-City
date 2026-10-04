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
import type { PlayerCommand, CommandResult } from './commands';
import { addBuilding, buildingAtTile, buildingIdsAt, refreshBuildingAccess, removeBuildingsAt, type BuildingInstance } from './buildings/buildings';
import { previewBuilding, type BuildingPreview } from './buildings/placement';

export type { PlayerCommand, CommandResult } from './commands';

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

  constructor(seed: number, world: WorldMap = generateWorld(seed, BALANCE.map.width, BALANCE.map.height), startingTreasury: number = BALANCE.economy.startingTreasury) {
    this.rng = new Rng(seed);
    this.state = {
      seed,
      rngState: this.rng.getState(),
      tick: 0,
      treasury: startingTreasury,
      world,
      buildings: [],
      nextEntityId: 1,
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
      // previewRoads already marks these tiles invalid; this only picks the clearer reason.
      if (buildingIdsAt(this.state.world, command.tiles).size) return fail('Roads cannot overlap buildings.', preview.cost, treasury);
      if (!preview.valid) return fail('Roads require buildable land.', preview.cost, treasury);
      if (!preview.affordable) return fail('Not enough money.', preview.cost, treasury);
      if (!placed.length) return fail('No new road tiles.', 0, treasury);
      this.state.treasury = next;
      const changedBuildings = refreshBuildingAccess(this.state.world, this.state.buildings);
      return { ok: true, reason: null, cost: preview.cost, changedTiles: [...placed, ...connectivityChanged], changedBuildings, treasury: next };
    }
    if (command.type === 'place-building') {
      const result = addBuilding(this.state.world, this.state.buildings, this.state.nextEntityId, command.defId, { x: command.x, y: command.y }, treasury);
      if (!result.building) return fail(result.reason ?? 'Cannot place building.', result.cost, treasury);
      this.state.nextEntityId++;
      this.state.treasury = result.treasury;
      return { ok: true, reason: null, cost: result.cost, changedTiles: result.tiles, changedBuildings: [result.building.id], treasury: result.treasury };
    }
    const removedBuildings = removeBuildingsAt(this.state.world, this.state.buildings, command.tiles);
    const { removed, connectivityChanged } = demolishRoads(this.state.world, command.tiles);
    if (!removed.length && !removedBuildings.removed.length) return fail('Nothing to remove.', 0, treasury);
    const changedBuildings = refreshBuildingAccess(this.state.world, this.state.buildings);
    return {
      ok: true, reason: null, cost: 0,
      changedTiles: [...removed, ...removedBuildings.changedTiles, ...connectivityChanged],
      changedBuildings: [...removedBuildings.removed, ...changedBuildings], treasury,
    };
  }

  previewRoads(tiles: readonly TileCoord[]): RoadPreview {
    return previewRoads(this.state.world, tiles, this.state.treasury);
  }

  previewDemolish(tiles: readonly TileCoord[]): { removable: number } {
    return { removable: previewDemolish(this.state.world, tiles).removable + buildingIdsAt(this.state.world, tiles).size };
  }

  previewBuilding(defId: string, cursor: TileCoord): BuildingPreview { return previewBuilding(this.state.world, defId, cursor, this.state.treasury); }
  getBuildings(): readonly BuildingInstance[] { return this.state.buildings.map((building) => ({ ...building })); }
  getBuilding(id: number): BuildingInstance | undefined { const building = this.state.buildings.find((item) => item.id === id); return building ? { ...building } : undefined; }
  getBuildingAt(x: number, y: number): BuildingInstance | undefined { return buildingAtTile(this.state.world, this.state.buildings, x, y); }

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
  return { ok: false, reason, cost, changedTiles: [], changedBuildings: [], treasury };
}
