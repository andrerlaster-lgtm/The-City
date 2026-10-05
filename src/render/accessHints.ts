/**
 * Road-access hints for the placement ghost. Pure (no Pixi), so it can be unit-tested.
 * Reads the world the same way the simulation's placement rule does: a building has
 * road access when a road shares an edge with its footprint.
 */
import { inBounds, toIndex } from '../core/grid';
import type { TileCoord } from '../core/types';
import { isBuildableTerrain, type WorldMap } from '../sim/world/World';

/** Which footprint side the edge tile touches. North is y − 1, east x + 1, south y + 1, west x − 1. */
export type Side = 'north' | 'east' | 'south' | 'west';

/**
 * - `connected-road`: a road here gives access and reaches the entrance.
 * - `disconnected-road`: a road here gives access, but it doesn't reach the entrance.
 * - `open`: empty buildable land where a road could go.
 * - `blocked`: water, another building, or off the map.
 */
export type EdgeKind = 'connected-road' | 'disconnected-road' | 'open' | 'blocked';

export interface EdgeHint extends TileCoord { side: Side; kind: EdgeKind }

/**
 * - `connected`: a touching road reaches the entrance.
 * - `disconnected`: roads touch, but none reaches the entrance.
 * - `none`: no road touches the footprint.
 */
export type AccessState = 'connected' | 'disconnected' | 'none';

const SIDES: readonly [Side, number, number][] = [['north', 0, -1], ['east', 1, 0], ['south', 0, 1], ['west', -1, 0]];

/** Every in-bounds tile sharing an edge with the footprint, in footprint order then N, E, S, W. */
export function accessHints(world: Readonly<WorldMap>, footprint: readonly TileCoord[]): { hints: EdgeHint[]; access: AccessState } {
  const inside = new Set(footprint.map(({ x, y }) => toIndex(x, y, world.width)));
  const seen = new Set<number>();
  const hints: EdgeHint[] = [];
  let access: AccessState = 'none';
  for (const tile of footprint) {
    for (const [side, dx, dy] of SIDES) {
      const x = tile.x + dx; const y = tile.y + dy;
      if (!inBounds(x, y, world.width, world.height)) continue;
      const index = toIndex(x, y, world.width);
      if (inside.has(index) || seen.has(index)) continue;
      seen.add(index);
      const kind = kindAt(world, x, y, index);
      if (kind === 'connected-road') access = 'connected';
      else if (kind === 'disconnected-road' && access === 'none') access = 'disconnected';
      hints.push({ x, y, side, kind });
    }
  }
  return { hints, access };
}

function kindAt(world: Readonly<WorldMap>, x: number, y: number, index: number): EdgeKind {
  if (world.roads[index] === 1) return world.roadConnected[index] === 1 ? 'connected-road' : 'disconnected-road';
  if ((world.buildingAt[index] ?? 0) !== 0 || !isBuildableTerrain(world, x, y)) return 'blocked';
  return 'open';
}
