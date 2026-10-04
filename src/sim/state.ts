/**
 * The complete, serializable simulation state. Everything the save system
 * needs lives here; nothing here references Pixi, React or the DOM.
 * Systems add their own slices as they land (world, roads, buildings, …).
 */
import type { WorldMap } from './world/World';
import type { BuildingInstance } from './buildings/buildings';

export interface GameState {
  seed: number;
  rngState: number;
  /** Hours elapsed since the settlement was founded. */
  tick: number;
  treasury: number;
  world: WorldMap;
  buildings: BuildingInstance[];
  nextEntityId: number;
}
