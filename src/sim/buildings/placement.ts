import { inBounds, toIndex } from '../../core/grid';
import type { TileCoord } from '../../core/types';
import { buildingDefinition, type BuildingDefinition } from '../../data/buildings';
import { TERRAIN, TerrainId } from '../../data/terrain';
import { isBuildableTerrain, type WorldMap } from '../world/World';

export interface BuildingPreview {
  ok: boolean;
  reason: string | null;
  cost: number;
  tiles: TileCoord[];
}

export function footprint(definition: BuildingDefinition, cursor: TileCoord): TileCoord[] {
  const originX = cursor.x - Math.floor((definition.size - 1) / 2);
  const originY = cursor.y - Math.floor((definition.size - 1) / 2);
  const tiles: TileCoord[] = [];
  for (let y = 0; y < definition.size; y++) for (let x = 0; x < definition.size; x++) tiles.push({ x: originX + x, y: originY + y });
  return tiles;
}

export function previewBuilding(world: Readonly<WorldMap>, defId: string, cursor: TileCoord, treasury: number): BuildingPreview {
  const definition = buildingDefinition(defId);
  if (!definition) return { ok: false, reason: 'Unknown building.', cost: 0, tiles: [] };
  const tiles = footprint(definition, cursor);
  if (tiles.some(({ x, y }) => !inBounds(x, y, world.width, world.height))) return failed('Out of bounds', definition, tiles);
  if (tiles.some(({ x, y }) => {
    const index = toIndex(x, y, world.width);
    return !isBuildableTerrain(world, x, y) || world.roads[index] === 1 || (world.buildingAt[index] ?? 0) !== 0;
  })) return failed('Blocked', definition, tiles);
  if (tiles.some(({ x, y }) => !definition.requires.terrain.includes(world.terrain[toIndex(x, y, world.width)] as TerrainId))) {
    return failed(terrainReason(definition), definition, tiles);
  }
  if (!hasEdgeRoad(world, tiles)) return failed('Needs road access', definition, tiles);
  if (treasury < definition.cost) return failed('Not enough money', definition, tiles);
  return { ok: true, reason: null, cost: definition.cost, tiles };
}

export function hasEdgeRoad(world: Readonly<WorldMap>, tiles: readonly TileCoord[]): boolean {
  const footprintSet = new Set(tiles.map(({ x, y }) => toIndex(x, y, world.width)));
  for (const { x, y } of tiles) {
    for (const [nx, ny] of [[x, y - 1], [x + 1, y], [x, y + 1], [x - 1, y]] as const) {
      if (!inBounds(nx, ny, world.width, world.height) || footprintSet.has(toIndex(nx, ny, world.width))) continue;
      if (world.roads[toIndex(nx, ny, world.width)] === 1) return true;
    }
  }
  return false;
}

function failed(reason: string, definition: BuildingDefinition, tiles: TileCoord[]): BuildingPreview {
  return { ok: false, reason, cost: definition.cost, tiles };
}

/** "Needs grass", "Needs grass or sand", … from the definition's terrain list. */
function terrainReason(definition: BuildingDefinition): string {
  return `Needs ${definition.requires.terrain.map((id) => TERRAIN[id].name.toLowerCase()).join(' or ')}`;
}
