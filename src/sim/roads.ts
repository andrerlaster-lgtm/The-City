import { fromIndex, inBounds, toIndex } from '../core/grid';
import type { TileCoord } from '../core/types';
import { TreeKind } from '../data/terrain';
import { isBuildableTerrain } from './world/World';
import type { WorldMap } from './world/World';

export const ROAD_COST = 10;
export const ROAD_NEIGHBORS = { north: 1, east: 2, south: 4, west: 8 } as const;

export interface RoadPreview {
  cost: number;
  affordable: boolean;
  valid: boolean;
  /** Tiles that block the stroke: off the map or not buildable. */
  invalid: TileCoord[];
}

export interface PlaceRoadsResult {
  preview: RoadPreview;
  placed: TileCoord[];
  /** Road tiles anywhere on the map whose connected state flipped. */
  connectivityChanged: TileCoord[];
  treasury: number;
}

export interface DemolishRoadsResult {
  removed: TileCoord[];
  connectivityChanged: TileCoord[];
}

export function roadMask(world: Readonly<WorldMap>, x: number, y: number): number {
  if (!roadAt(world, x, y)) return 0;
  return (roadAt(world, x, y - 1) ? 1 : 0) | (roadAt(world, x + 1, y) ? 2 : 0) |
    (roadAt(world, x, y + 1) ? 4 : 0) | (roadAt(world, x - 1, y) ? 8 : 0);
}

export function roadAt(world: Readonly<WorldMap>, x: number, y: number): boolean {
  return inBounds(x, y, world.width, world.height) && world.roads[toIndex(x, y, world.width)] === 1;
}

/** BFS from the entrance. Returns the tiles whose connected flag changed. */
export function refreshRoadConnectivity(world: WorldMap): TileCoord[] {
  const before = world.roadConnected.slice();
  world.roadConnected.fill(0);
  if (world.entranceIndex >= 0 && world.roads[world.entranceIndex] === 1) {
    const queue = new Int32Array(world.roads.length);
    let head = 0;
    let tail = 0;
    queue[tail++] = world.entranceIndex;
    world.roadConnected[world.entranceIndex] = 1;
    while (head < tail) {
      const i = queue[head++] ?? 0;
      const x = i % world.width;
      const y = Math.floor(i / world.width);
      const neighbors: readonly [number, number][] = [[x, y - 1], [x + 1, y], [x, y + 1], [x - 1, y]];
      for (const [nx, ny] of neighbors) {
        if (!inBounds(nx, ny, world.width, world.height)) continue;
        const next = toIndex(nx, ny, world.width);
        if (world.roads[next] === 1 && world.roadConnected[next] === 0) {
          world.roadConnected[next] = 1;
          queue[tail++] = next;
        }
      }
    }
  }
  const changed: TileCoord[] = [];
  for (let i = 0; i < before.length; i++) if (before[i] !== world.roadConnected[i]) changed.push(fromIndex(i, world.width));
  return changed;
}

export function previewRoads(world: Readonly<WorldMap>, tiles: readonly TileCoord[], treasury: number): RoadPreview {
  const unique = new Set<number>();
  const invalid: TileCoord[] = [];
  let cost = 0;
  for (const tile of tiles) {
    if (!inBounds(tile.x, tile.y, world.width, world.height)) { invalid.push(tile); continue; }
    const index = toIndex(tile.x, tile.y, world.width);
    if ((world.buildingAt[index] ?? 0) !== 0) { invalid.push(tile); continue; }
    if (unique.has(index) || world.roads[index] === 1) continue;
    unique.add(index);
    if (!isBuildableTerrain(world, tile.x, tile.y)) invalid.push(tile);
    else cost += ROAD_COST;
  }
  return { cost, affordable: cost <= treasury, valid: invalid.length === 0, invalid };
}

/** All-or-nothing: an invalid or unaffordable stroke changes nothing. */
export function placeRoads(world: WorldMap, tiles: readonly TileCoord[], treasury: number): PlaceRoadsResult {
  const preview = previewRoads(world, tiles, treasury);
  if (!preview.valid || !preview.affordable) return { preview, placed: [], connectivityChanged: [], treasury };
  const placed: TileCoord[] = [];
  for (const tile of tiles) {
    const index = toIndex(tile.x, tile.y, world.width);
    if (world.roads[index] === 1) continue;
    world.roads[index] = 1;
    world.trees[index] = TreeKind.None;
    placed.push(tile);
  }
  const connectivityChanged = placed.length ? refreshRoadConnectivity(world) : [];
  return { preview, placed, connectivityChanged, treasury: treasury - preview.cost };
}

/** Road tiles in the stroke that demolish would remove (the entrance is protected). */
export function previewDemolish(world: Readonly<WorldMap>, tiles: readonly TileCoord[]): { removable: number } {
  const unique = new Set<number>();
  for (const tile of tiles) {
    if (!inBounds(tile.x, tile.y, world.width, world.height)) continue;
    const index = toIndex(tile.x, tile.y, world.width);
    if (index !== world.entranceIndex && world.roads[index] === 1) unique.add(index);
  }
  return { removable: unique.size };
}

export function demolishRoads(world: WorldMap, tiles: readonly TileCoord[]): DemolishRoadsResult {
  const removed: TileCoord[] = [];
  for (const tile of tiles) {
    if (!inBounds(tile.x, tile.y, world.width, world.height)) continue;
    const index = toIndex(tile.x, tile.y, world.width);
    if (index === world.entranceIndex || world.roads[index] !== 1) continue;
    world.roads[index] = 0;
    removed.push(tile);
  }
  const connectivityChanged = removed.length ? refreshRoadConnectivity(world) : [];
  return { removed, connectivityChanged };
}

/**
 * Deterministic entrance on a map edge, on buildable land. Edges are scanned
 * north, east, south, west; the tile nearest its edge's midpoint wins, and a
 * tile whose inland neighbour is also buildable is preferred so the player can
 * build away from it. Returns -1 (no entrance) when no edge tile is buildable.
 */
export function placeSettlementEntrance(world: WorldMap): number {
  const { width, height } = world;
  const edges: { length: number; at: (i: number) => [number, number, number, number] }[] = [
    { length: width, at: (i) => [i, 0, i, 1] },
    { length: height, at: (i) => [width - 1, i, width - 2, i] },
    { length: width, at: (i) => [i, height - 1, i, height - 2] },
    { length: height, at: (i) => [0, i, 1, i] },
  ];
  let best = -1;
  let bestScore = Number.POSITIVE_INFINITY;
  for (const edge of edges) {
    const mid = Math.floor(edge.length / 2);
    for (let i = 0; i < edge.length; i++) {
      const [x, y, ix, iy] = edge.at(i);
      if (!isBuildableTerrain(world, x, y)) continue;
      const inlandOk = isBuildableTerrain(world, ix, iy);
      const score = Math.abs(i - mid) + (inlandOk ? 0 : width + height);
      if (score < bestScore) { best = toIndex(x, y, width); bestScore = score; }
    }
  }
  world.entranceIndex = best;
  if (best >= 0) {
    world.roads[best] = 1;
    world.trees[best] = TreeKind.None;
    refreshRoadConnectivity(world);
  }
  return best;
}
