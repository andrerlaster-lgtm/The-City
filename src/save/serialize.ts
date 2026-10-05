/**
 * GameState ⇄ SaveFile. Serialization copies everything (the live game keeps
 * running), sorts by id, and drops derived data, so the same city always saves
 * identically. Deserialization rebuilds the derived data from the saved layers.
 */
import type { GameState } from '../sim/state';
import { restoreDerived } from '../sim/restore';
import { createEmptyWorld } from '../sim/world/World';
import { SAVE_FORMAT, SAVE_VERSION, type SaveFile, type SaveMeta, type SerializedState } from './format';

export function serializeState(state: GameState): SerializedState {
  const { world } = state;
  return {
    width: world.width,
    height: world.height,
    entranceIndex: world.entranceIndex,
    terrain: world.terrain.slice(),
    variant: world.variant.slice(),
    trees: world.trees.slice(),
    roads: world.roads.slice(),
    seed: state.seed,
    rngState: state.rngState,
    tick: state.tick,
    treasury: state.treasury,
    food: state.food,
    speed: state.speed,
    economy: JSON.parse(JSON.stringify(state.economy)) as SerializedState['economy'],
    nextEntityId: state.nextEntityId,
    nextCitizenId: state.nextCitizenId,
    buildings: state.buildings.map(({ id, defId, x, y }) => ({ id, defId, x, y })).sort((a, b) => a.id - b.id),
    citizens: state.citizens.map((citizen) => ({ ...citizen })).sort((a, b) => a.id - b.id),
  };
}

/** Builds a full GameState from a validated SerializedState. Copies the saved arrays. */
export function deserializeState(saved: SerializedState): GameState {
  const world = createEmptyWorld(saved.width, saved.height);
  world.terrain.set(saved.terrain);
  world.variant.set(saved.variant);
  world.trees.set(saved.trees);
  world.roads.set(saved.roads);
  world.entranceIndex = saved.entranceIndex;
  const buildings = saved.buildings.map(({ id, defId, x, y }) => ({ id, defId, x, y, roadAccess: false, connected: false }));
  restoreDerived(world, buildings);
  return {
    seed: saved.seed,
    rngState: saved.rngState,
    tick: saved.tick,
    treasury: saved.treasury,
    world,
    buildings,
    nextEntityId: saved.nextEntityId,
    speed: saved.speed,
    economy: JSON.parse(JSON.stringify(saved.economy)) as GameState['economy'],
    citizens: saved.citizens.map((citizen) => ({ ...citizen })),
    nextCitizenId: saved.nextCitizenId,
    food: saved.food,
  };
}

export function createSaveFile(state: GameState, name: string, savedAt: string): SaveFile {
  const meta: SaveMeta = {
    name,
    savedAt,
    seed: state.seed,
    day: Math.floor(state.tick / 24) + 1,
    population: state.citizens.length,
    treasury: state.treasury,
  };
  return { format: SAVE_FORMAT, version: SAVE_VERSION, meta, state: serializeState(state) };
}
