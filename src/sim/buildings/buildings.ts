import { inBounds, toIndex } from '../../core/grid';
import type { EntityId, TileCoord } from '../../core/types';
import { buildingDefinition, type BuildingId } from '../../data/buildings';
import type { WorldMap } from '../world/World';
import { hasEdgeRoad, previewBuilding } from './placement';

export interface BuildingInstance {
  id: EntityId;
  defId: BuildingId;
  x: number;
  y: number;
  roadAccess: boolean;
  connected: boolean;
}

export interface PlaceBuildingResult {
  building: BuildingInstance | null;
  tiles: TileCoord[];
  treasury: number;
  reason: string | null;
  cost: number;
}

export function addBuilding(world: WorldMap, buildings: BuildingInstance[], nextId: number, defId: BuildingId, cursor: TileCoord, treasury: number): PlaceBuildingResult {
  const checked = previewBuilding(world, defId, cursor, treasury);
  if (!checked.ok) return { building: null, tiles: [], treasury, reason: checked.reason, cost: checked.cost };
  const definition = buildingDefinition(defId);
  if (!definition) return { building: null, tiles: [], treasury, reason: 'Unknown building.', cost: 0 };
  const originX = checked.tiles[0]?.x ?? cursor.x;
  const originY = checked.tiles[0]?.y ?? cursor.y;
  const adjacent = adjacentRoads(world, checked.tiles);
  const building: BuildingInstance = {
    id: nextId, defId, x: originX, y: originY, roadAccess: true,
    connected: adjacent.some((index) => world.roadConnected[index] === 1),
  };
  buildings.push(building);
  buildings.sort((a, b) => a.id - b.id);
  for (const { x, y } of checked.tiles) {
    const index = toIndex(x, y, world.width);
    world.buildingAt[index] = nextId;
    world.trees[index] = 0;
  }
  return { building, tiles: checked.tiles, treasury: treasury - definition.cost, reason: null, cost: definition.cost };
}

export function refreshBuildingAccess(world: Readonly<WorldMap>, buildings: BuildingInstance[]): EntityId[] {
  const changed: EntityId[] = [];
  for (const building of buildings) {
    const definition = buildingDefinition(building.defId);
    if (!definition) continue;
    const tiles = footprintCoords(building, definition.size);
    const adjacent = adjacentRoads(world, tiles);
    const access = hasEdgeRoad(world, tiles);
    const connected = adjacent.some((index) => world.roadConnected[index] === 1);
    if (building.roadAccess !== access || building.connected !== connected) changed.push(building.id);
    building.roadAccess = access;
    building.connected = connected;
  }
  return changed;
}

/** Ids of the buildings occupying any of the given tiles (off-map tiles are ignored). */
export function buildingIdsAt(world: Readonly<WorldMap>, tiles: readonly TileCoord[]): Set<EntityId> {
  const ids = new Set<EntityId>();
  for (const tile of tiles) {
    if (!inBounds(tile.x, tile.y, world.width, world.height)) continue;
    const id = world.buildingAt[toIndex(tile.x, tile.y, world.width)] ?? 0;
    if (id > 0) ids.add(id);
  }
  return ids;
}

export function removeBuildingsAt(world: WorldMap, buildings: BuildingInstance[], tiles: readonly TileCoord[]): { removed: EntityId[]; changedTiles: TileCoord[] } {
  const ids = buildingIdsAt(world, tiles);
  const removed = buildings.filter((building) => ids.has(building.id));
  const changedTiles: TileCoord[] = [];
  for (const building of removed) {
    const definition = buildingDefinition(building.defId);
    if (!definition) continue;
    for (const tile of footprintCoords(building, definition.size)) {
      const index = toIndex(tile.x, tile.y, world.width);
      world.buildingAt[index] = 0;
      changedTiles.push(tile);
    }
  }
  const removedIds = new Set(removed.map((building) => building.id));
  for (let i = buildings.length - 1; i >= 0; i--) if (removedIds.has(buildings[i]?.id ?? -1)) buildings.splice(i, 1);
  return { removed: removed.map((building) => building.id), changedTiles };
}

function adjacentRoads(world: Readonly<WorldMap>, tiles: readonly TileCoord[]): number[] {
  const footprint = new Set(tiles.map(({ x, y }) => toIndex(x, y, world.width)));
  const roads = new Set<number>();
  for (const { x, y } of tiles) for (const [nx, ny] of [[x, y - 1], [x + 1, y], [x, y + 1], [x - 1, y]] as const) {
    if (inBounds(nx, ny, world.width, world.height)) {
      const index = toIndex(nx, ny, world.width);
      if (!footprint.has(index) && world.roads[index] === 1) roads.add(index);
    }
  }
  return [...roads];
}

function footprintCoords(building: BuildingInstance, size: number): TileCoord[] {
  const tiles: TileCoord[] = [];
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) tiles.push({ x: building.x + x, y: building.y + y });
  return tiles;
}

export function buildingAtTile(world: Readonly<WorldMap>, buildings: readonly BuildingInstance[], x: number, y: number): BuildingInstance | undefined {
  if (!inBounds(x, y, world.width, world.height)) return undefined;
  const id = world.buildingAt[toIndex(x, y, world.width)] ?? 0;
  const building = buildings.find((item) => item.id === id);
  return building ? { ...building } : undefined;
}
