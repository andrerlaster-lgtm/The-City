/**
 * The world map: fixed-size layers stored as flat typed arrays indexed
 * y * width + x. Systems read layers directly; only world/building/road
 * code writes them.
 */
import { inBounds, toIndex } from '../../core/grid';
import { TERRAIN, TerrainId, TreeKind } from '../../data/terrain';

export interface WorldMap {
  width: number;
  height: number;
  /** TerrainId per tile. */
  terrain: Uint8Array;
  /** TreeKind per tile (0 = none). */
  trees: Uint8Array;
  /** Cosmetic variation seed per tile (0–255), so art never looks tiled. */
  variant: Uint8Array;
  /** Road occupancy; the settlement entrance is present when the world is created. */
  roads: Uint8Array;
  /** Road tiles that can reach the settlement entrance. */
  roadConnected: Uint8Array;
  entranceIndex: number;
}

export function createEmptyWorld(width: number, height: number): WorldMap {
  const size = width * height;
  return {
    width,
    height,
    terrain: new Uint8Array(size),
    trees: new Uint8Array(size),
    variant: new Uint8Array(size),
    roads: new Uint8Array(size),
    roadConnected: new Uint8Array(size),
    entranceIndex: -1,
  };
}

export function terrainAt(world: WorldMap, x: number, y: number): TerrainId | null {
  if (!inBounds(x, y, world.width, world.height)) return null;
  return (world.terrain[toIndex(x, y, world.width)] ?? TerrainId.Water) as TerrainId;
}

export function treeAt(world: WorldMap, x: number, y: number): TreeKind {
  if (!inBounds(x, y, world.width, world.height)) return TreeKind.None;
  return (world.trees[toIndex(x, y, world.width)] ?? TreeKind.None) as TreeKind;
}

/** Terrain allows building (trees are cleared separately when placing). */
export function isBuildableTerrain(world: WorldMap, x: number, y: number): boolean {
  const t = terrainAt(world, x, y);
  return t !== null && TERRAIN[t].buildable;
}
