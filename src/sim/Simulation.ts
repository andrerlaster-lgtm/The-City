/**
 * Owns the game state and advances it in fixed steps.
 * PURE: must never import rendering, UI or browser APIs (enforced by tests).
 */
import { Rng } from '../core/rng';
import type { TileCoord, EntityId } from '../core/types';
import { BALANCE } from '../data/balance';
import type { GameState } from './state';
import { tickToDate, type GameDate } from './time/calendar';
import { dayIndex, isDayStart } from './time/clock';
import { generateWorld } from './world/generate';
import type { WorldMap } from './world/World';
import { demolishRoads, placeRoads, previewDemolish, previewRoads, type RoadPreview } from './roads';
import type { PlayerCommand, CommandResult } from './commands';
import { addBuilding, buildingAtTile, buildingIdsAt, refreshBuildingAccess, removeBuildingsAt, type BuildingInstance } from './buildings/buildings';
import { previewBuilding, type BuildingPreview } from './buildings/placement';
import { cityCapacity, emptyLedger, projectedDaily, type DailyReport, type Ledger } from './economy/economy';
import { runDaily } from './daily';
import { citizenCounts, clearDemolishedAssignments, occupancyFor, type BuildingOccupancy, type Citizen } from './citizens/citizens';
import { foodChangePerDay } from './resources/food';
import { activeServices, coverageMap } from './services/coverage';
import type { ServiceKind } from '../data/buildings';
import { productionOf, type BuildingProduction } from './resources/production';

export type { PlayerCommand, CommandResult } from './commands';

/** What changed during a tick, so the renderer can redraw only that. */
export interface TickResult {
  tick: number;
  changedTiles: TileCoord[];
  changedBuildings: EntityId[];
}

/** Read-only view handed to the renderer and UI. */
export interface SimSnapshot {
  /** The world seed this game was created with (chosen by the app, never by the sim). */
  seed: number;
  tick: number;
  date: GameDate;
  treasury: number;
  population: number;
  freeHousing: number;
  freeJobs: number;
  employed: number;
  unemployed: number;
  hungry: number;
  homeless: number;
  food: number;
  foodChange: number;
  speed: 0 | 1 | 2 | 3;
  economy: { today: Ledger; lastDay: DailyReport | null; projected: ReturnType<typeof projectedDaily>; immigrationPaused: boolean };
}

export class Simulation {
  private state: GameState;
  private readonly rng: Rng;
  /** Bumped whenever map-level data can change (a daily step, or a successful build/demolish). */
  private mapVersion = 0;
  private coverageCache = new Map<ServiceKind, { version: number; map: Uint8Array }>();

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
      speed: BALANCE.time.startSpeed,
      economy: { today: emptyLedger(), lastDay: null },
      citizens: [],
      nextCitizenId: 1,
      food: BALANCE.citizens.startingFood,
    };
  }

  /**
   * Resumes a game from a complete, already-validated state (see src/save). The
   * seeded Rng continues from `rngState`. Derived data must already be rebuilt.
   */
  static fromState(state: GameState): Simulation {
    const sim = new Simulation(state.seed, state.world, state.treasury);
    sim.state = state;
    sim.rng.setState(state.rngState);
    return sim;
  }

  /** A deep copy of the full state, safe to serialize while the game keeps running. */
  exportState(): GameState {
    const { world, economy } = this.state;
    return {
      ...this.state,
      world: {
        ...world,
        terrain: world.terrain.slice(), trees: world.trees.slice(), variant: world.variant.slice(),
        roads: world.roads.slice(), roadConnected: world.roadConnected.slice(), buildingAt: world.buildingAt.slice(),
      },
      buildings: this.state.buildings.map((building) => ({ ...building })),
      citizens: this.state.citizens.map((citizen) => ({ ...citizen })),
      // Plain numbers only, so a JSON round trip is an exact deep copy (no host APIs in the sim).
      economy: JSON.parse(JSON.stringify(economy)) as GameState['economy'],
    };
  }

  getTick(): number { return this.state.tick; }

  tick(): TickResult {
    this.state.tick += 1;
    this.state.rngState = this.rng.getState();
    if (isDayStart(this.state.tick)) {
      runDaily(this.state, dayIndex(this.state.tick));
      this.mapVersion++;
    }
    return { tick: this.state.tick, changedTiles: [], changedBuildings: [] };
  }

  /** The sole player entry point for deterministic, validated state changes. */
  applyCommand(command: PlayerCommand): CommandResult {
    const treasury = this.state.treasury;
    if (command.type === 'set-speed') {
      if (![0, 1, 2, 3].includes(command.speed)) return fail('Invalid speed.', 0, treasury);
      this.state.speed = command.speed;
      return { ok: true, reason: null, cost: 0, changedTiles: [], changedBuildings: [], treasury };
    }
    if (command.type === 'place-roads') {
      const { preview, placed, connectivityChanged, treasury: next } = placeRoads(this.state.world, command.tiles, treasury);
      // previewRoads already marks these tiles invalid; this only picks the clearer reason.
      if (buildingIdsAt(this.state.world, command.tiles).size) return fail('Roads cannot overlap buildings.', preview.cost, treasury);
      if (!preview.valid) return fail('Roads require buildable land.', preview.cost, treasury);
      if (!preview.affordable) return fail('Not enough money.', preview.cost, treasury);
      if (!placed.length) return fail('No new road tiles.', 0, treasury);
      this.state.treasury = next;
      this.state.economy.today.construction += preview.cost;
      const changedBuildings = refreshBuildingAccess(this.state.world, this.state.buildings);
      this.mapVersion++;
      return { ok: true, reason: null, cost: preview.cost, changedTiles: [...placed, ...connectivityChanged], changedBuildings, treasury: next };
    }
    if (command.type === 'place-building') {
      const result = addBuilding(this.state.world, this.state.buildings, this.state.nextEntityId, command.defId, { x: command.x, y: command.y }, treasury);
      if (!result.building) return fail(result.reason ?? 'Cannot place building.', result.cost, treasury);
      this.state.nextEntityId++;
      this.state.treasury = result.treasury;
      this.state.economy.today.construction += result.cost;
      this.mapVersion++;
      return { ok: true, reason: null, cost: result.cost, changedTiles: result.tiles, changedBuildings: [result.building.id], treasury: result.treasury };
    }
    const removedBuildings = removeBuildingsAt(this.state.world, this.state.buildings, command.tiles);
    clearDemolishedAssignments(this.state.citizens, new Set(removedBuildings.removed));
    const { removed, connectivityChanged } = demolishRoads(this.state.world, command.tiles);
    if (!removed.length && !removedBuildings.removed.length) return fail('Nothing to remove.', 0, treasury);
    const changedBuildings = refreshBuildingAccess(this.state.world, this.state.buildings);
    this.mapVersion++;
    return {
      ok: true, reason: null, cost: 0,
      changedTiles: [...removed, ...removedBuildings.changedTiles, ...connectivityChanged],
      changedBuildings: [...removedBuildings.removed, ...changedBuildings], treasury,
    };
  }

  /** Changes whenever coverage, roads or buildings may have changed; lets readers skip redraws. */
  getMapVersion(): number { return this.mapVersion; }

  /** Per-tile coverage of `kind` from active service buildings. Read-only; cached per map version. */
  getCoverage(kind: ServiceKind): Readonly<Uint8Array> {
    const cached = this.coverageCache.get(kind);
    if (cached && cached.version === this.mapVersion) return cached.map;
    const map = coverageMap(kind, activeServices(this.state.buildings, this.state.citizens, kind), this.state.world);
    this.coverageCache.set(kind, { version: this.mapVersion, map });
    return map;
  }

  /** Cheap per-frame read for the app loop (snapshot() also computes projections). */
  getSpeed(): 0 | 1 | 2 | 3 { return this.state.speed; }

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
  getOccupancy(id: number): BuildingOccupancy { return occupancyFor(id, this.state.citizens); }
  /** Daily food or revenue from one building, by the same rules as the daily step. */
  getProduction(id: number): BuildingProduction { return productionOf(id, this.state.buildings, this.state.citizens); }
  getCitizens(): readonly Citizen[] { return this.state.citizens.map((citizen) => ({ ...citizen })); }

  /** Read-only access for the renderer. Callers must not write to the layers. */
  getWorld(): Readonly<WorldMap> {
    return this.state.world;
  }

  snapshot(): SimSnapshot {
    const counts = citizenCounts(this.state.citizens, this.state.buildings);
    const capacity = cityCapacity(this.state.buildings, this.state.citizens);
    return {
      seed: this.state.seed,
      tick: this.state.tick,
      date: tickToDate(this.state.tick),
      treasury: this.state.treasury,
      population: counts.population,
      freeHousing: capacity.freeHousing,
      freeJobs: capacity.freeJobs,
      employed: counts.employed,
      unemployed: counts.unemployed,
      hungry: counts.hungry,
      homeless: counts.homeless,
      food: this.state.food,
      foodChange: foodChangePerDay(this.state.buildings, this.state.citizens),
      speed: this.state.speed,
      economy: {
        today: { ...this.state.economy.today },
        lastDay: this.state.economy.lastDay ? { ...this.state.economy.lastDay } : null,
        projected: projectedDaily(this.state.buildings, this.state.world, this.state.citizens),
        immigrationPaused: this.state.treasury <= 0,
      },
    };
  }
}

function fail(reason: string, cost: number, treasury: number): CommandResult {
  return { ok: false, reason, cost, changedTiles: [], changedBuildings: [], treasury };
}
