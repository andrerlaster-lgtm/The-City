import { describe, expect, it } from 'vitest';
import { toIndex } from '../../src/core/grid';
import { TerrainId } from '../../src/data/terrain';
import { accessHints } from '../../src/render/accessHints';
import { createEmptyWorld } from '../../src/sim/world/World';

function grass(size = 8) {
  const world = createEmptyWorld(size, size);
  world.terrain.fill(TerrainId.Grass);
  return world;
}

describe('road-access hints', () => {
  it('lists the 4 edge tiles of a 1x1 footprint in N, E, S, W order, all open with no road', () => {
    const { hints, access } = accessHints(grass(), [{ x: 3, y: 3 }]);
    expect(access).toBe('none');
    expect(hints).toEqual([
      { x: 3, y: 2, side: 'north', kind: 'open' },
      { x: 4, y: 3, side: 'east', kind: 'open' },
      { x: 3, y: 4, side: 'south', kind: 'open' },
      { x: 2, y: 3, side: 'west', kind: 'open' },
    ]);
  });

  it('gives a 2x2 footprint 8 edge tiles and never its diagonal corners', () => {
    const tiles = [{ x: 3, y: 3 }, { x: 4, y: 3 }, { x: 3, y: 4 }, { x: 4, y: 4 }];
    const { hints } = accessHints(grass(), tiles);
    expect(hints).toHaveLength(8);
    for (const corner of [{ x: 2, y: 2 }, { x: 5, y: 2 }, { x: 2, y: 5 }, { x: 5, y: 5 }]) {
      expect(hints.some((hint) => hint.x === corner.x && hint.y === corner.y)).toBe(false);
    }
  });

  it('marks connected and disconnected roads, and prefers connected for the access state', () => {
    const world = grass();
    world.roads[toIndex(3, 2, 8)] = 1;
    expect(accessHints(world, [{ x: 3, y: 3 }]).access).toBe('disconnected');
    expect(accessHints(world, [{ x: 3, y: 3 }]).hints[0]?.kind).toBe('disconnected-road');
    world.roads[toIndex(2, 3, 8)] = 1;
    world.roadConnected[toIndex(2, 3, 8)] = 1;
    const both = accessHints(world, [{ x: 3, y: 3 }]);
    expect(both.access).toBe('connected');
    expect(both.hints.find((hint) => hint.side === 'west')?.kind).toBe('connected-road');
  });

  it('marks water and other buildings as blocked, ignores corner-only roads, and clips at the map edge', () => {
    const world = grass();
    world.terrain[toIndex(4, 3, 8)] = TerrainId.Water;
    world.buildingAt[toIndex(3, 4, 8)] = 9;
    world.roads[toIndex(4, 4, 8)] = world.roadConnected[toIndex(4, 4, 8)] = 1; // diagonal: no access
    const { hints, access } = accessHints(world, [{ x: 3, y: 3 }]);
    expect(access).toBe('none');
    expect(hints.find((hint) => hint.side === 'east')?.kind).toBe('blocked');
    expect(hints.find((hint) => hint.side === 'south')?.kind).toBe('blocked');
    expect(accessHints(world, [{ x: 0, y: 0 }]).hints.map((hint) => hint.side)).toEqual(['east', 'south']);
  });
});
