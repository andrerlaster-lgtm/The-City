import { describe, expect, it } from 'vitest';
import { toIndex } from '../../src/core/grid';
import type { TileCoord } from '../../src/core/types';
import { BALANCE } from '../../src/data/balance';
import { TerrainId } from '../../src/data/terrain';
import { Simulation } from '../../src/sim/Simulation';
import {
  ROAD_COST, demolishRoads, placeRoads, placeSettlementEntrance, previewDemolish, previewRoads,
  refreshRoadConnectivity, roadMask,
} from '../../src/sim/roads';
import { createEmptyWorld, isBuildableTerrain } from '../../src/sim/world/World';
import { generateWorld } from '../../src/sim/world/generate';

function roadWorld() {
  const world = createEmptyWorld(8, 8);
  world.terrain.fill(TerrainId.Grass);
  world.entranceIndex = 3 * world.width + 3;
  world.roads[world.entranceIndex] = 1;
  refreshRoadConnectivity(world);
  return world;
}

function entranceOf(sim: Simulation): TileCoord {
  const world = sim.getWorld();
  return { x: world.entranceIndex % world.width, y: Math.floor(world.entranceIndex / world.width) };
}

/** A tile next to the entrance that is buildable and not a road. */
function freeNeighbour(sim: Simulation): TileCoord {
  const world = sim.getWorld();
  const e = entranceOf(sim);
  const options = [{ x: e.x + 1, y: e.y }, { x: e.x - 1, y: e.y }, { x: e.x, y: e.y + 1 }, { x: e.x, y: e.y - 1 }];
  const tile = options.find((t) => isBuildableTerrain(world, t.x, t.y) && world.roads[toIndex(t.x, t.y, world.width)] === 0);
  if (!tile) throw new Error('entrance has no free buildable neighbour');
  return tile;
}

describe('roads', () => {
  it('builds four-bit N/E/S/W masks', () => {
    const world = roadWorld();
    world.roads[2 * 8 + 3] = 1;
    world.roads[3 * 8 + 4] = 1;
    world.roads[4 * 8 + 3] = 1;
    world.roads[3 * 8 + 2] = 1;
    expect(roadMask(world, 3, 3)).toBe(15);
    expect(roadMask(world, 3, 2)).toBe(4);
  });

  it('places roads, clears trees, charges once, and floods only the connected branch', () => {
    const world = roadWorld();
    world.trees[3 * 8 + 4] = 1;
    const result = placeRoads(world, [{ x: 4, y: 3 }, { x: 5, y: 3 }, { x: 5, y: 3 }], 100);
    expect(result.preview.cost).toBe(20);
    expect(result.treasury).toBe(80);
    expect(result.placed).toEqual([{ x: 4, y: 3 }, { x: 5, y: 3 }]);
    expect(world.trees[3 * 8 + 4]).toBe(0);
    expect(world.roadConnected[3 * 8 + 5]).toBe(1);
    world.roads[0] = 1;
    refreshRoadConnectivity(world);
    expect(world.roadConnected[0]).toBe(0);
  });

  it('rejects water and insufficient funds without mutating roads', () => {
    const world = roadWorld();
    world.terrain[0] = TerrainId.Water;
    const water = placeRoads(world, [{ x: 1, y: 0 }, { x: 0, y: 0 }], 100);
    expect(water.placed).toEqual([]);
    expect(water.treasury).toBe(100);
    expect(placeRoads(world, [{ x: 1, y: 0 }], 0).placed).toEqual([]);
    expect(world.roads[0]).toBe(0);
    expect(world.roads[1]).toBe(0);
  });

  it('protects the entrance when demolishing and recomputes reachability', () => {
    const world = roadWorld();
    placeRoads(world, [{ x: 4, y: 3 }], 100);
    const { removed } = demolishRoads(world, [{ x: 3, y: 3 }, { x: 4, y: 3 }]);
    expect(removed).toEqual([{ x: 4, y: 3 }]);
    expect(world.roads[world.entranceIndex]).toBe(1);
    expect(world.roadConnected[world.entranceIndex + 1]).toBe(0);
  });

  it('disconnects the far branch when a middle road tile is demolished, and reports every flipped tile', () => {
    const world = roadWorld();
    placeRoads(world, [{ x: 4, y: 3 }, { x: 5, y: 3 }, { x: 6, y: 3 }, { x: 7, y: 3 }], 1000);
    const { connectivityChanged } = demolishRoads(world, [{ x: 5, y: 3 }]);
    expect(world.roadConnected[toIndex(4, 3, 8)]).toBe(1);
    expect(world.roadConnected[toIndex(6, 3, 8)]).toBe(0);
    expect(world.roadConnected[toIndex(7, 3, 8)]).toBe(0);
    // The demolished tile plus the two cut-off tiles flipped, far beyond the edited tile's neighbours.
    expect(connectivityChanged).toEqual([{ x: 5, y: 3 }, { x: 6, y: 3 }, { x: 7, y: 3 }]);
    expect(placeRoads(world, [{ x: 5, y: 3 }], 100).connectivityChanged).toEqual([{ x: 5, y: 3 }, { x: 6, y: 3 }, { x: 7, y: 3 }]);
  });
});

describe('previewRoads / previewDemolish', () => {
  it('reports cost, invalid tiles and affordability without mutating', () => {
    const world = roadWorld();
    world.terrain[toIndex(1, 1, 8)] = TerrainId.Water;
    const ok = previewRoads(world, [{ x: 4, y: 3 }, { x: 4, y: 3 }, { x: 3, y: 3 }, { x: 5, y: 3 }], 20);
    expect(ok).toEqual({ cost: 2 * ROAD_COST, affordable: true, valid: true, invalid: [] });
    expect(previewRoads(world, [{ x: 4, y: 3 }, { x: 5, y: 3 }], 19).affordable).toBe(false);
    const blocked = previewRoads(world, [{ x: 1, y: 1 }, { x: 9, y: 0 }, { x: 2, y: 1 }], 100);
    expect(blocked.valid).toBe(false);
    expect(blocked.invalid).toEqual([{ x: 1, y: 1 }, { x: 9, y: 0 }]);
    expect(blocked.cost).toBe(ROAD_COST);
    expect(world.roads[toIndex(4, 3, 8)]).toBe(0);
  });

  it('counts removable roads, excluding the entrance and duplicates', () => {
    const world = roadWorld();
    placeRoads(world, [{ x: 4, y: 3 }], 100);
    expect(previewDemolish(world, [{ x: 3, y: 3 }, { x: 4, y: 3 }, { x: 4, y: 3 }, { x: 0, y: 0 }, { x: -1, y: 0 }])).toEqual({ removable: 1 });
  });
});

describe('Simulation.applyCommand', () => {
  it('places roads and charges the treasury', () => {
    const sim = new Simulation(42);
    const result = sim.applyCommand({ type: 'place-roads', tiles: [freeNeighbour(sim)] });
    expect(result.ok).toBe(true);
    expect(result.treasury).toBe(BALANCE.economy.startingTreasury - ROAD_COST);
    expect(sim.snapshot().treasury).toBe(result.treasury);
  });

  it('gives a reason and leaves the treasury alone when placement fails', () => {
    const sim = new Simulation(42);
    const world = sim.getWorld();
    const start = sim.snapshot().treasury;
    const waterIndex = world.terrain.indexOf(TerrainId.Water);
    const water = { x: waterIndex % world.width, y: Math.floor(waterIndex / world.width) };

    expect(sim.applyCommand({ type: 'place-roads', tiles: [water] })).toMatchObject({ ok: false, reason: 'Roads require buildable land.', changedTiles: [] });
    expect(sim.applyCommand({ type: 'place-roads', tiles: [entranceOf(sim)] })).toMatchObject({ ok: false, reason: 'No new road tiles.' });
    const tooMany: TileCoord[] = [];
    for (let i = 0; i < world.terrain.length && tooMany.length * ROAD_COST <= start; i++) {
      if (world.terrain[i] !== TerrainId.Water && world.roads[i] === 0) tooMany.push({ x: i % world.width, y: Math.floor(i / world.width) });
    }
    expect(sim.applyCommand({ type: 'place-roads', tiles: tooMany })).toMatchObject({ ok: false, reason: 'Not enough money.' });
    expect(sim.snapshot().treasury).toBe(start);
    expect(world.roads.reduce((n, r) => n + r, 0)).toBe(1);
  });

  it('rejects out-of-bounds tiles in a placement command and ignores them in demolish', () => {
    const sim = new Simulation(42);
    const start = sim.snapshot().treasury;
    const outside = [{ x: -1, y: 0 }, { x: 0, y: 9999 }];
    const placed = sim.applyCommand({ type: 'place-roads', tiles: [freeNeighbour(sim), ...outside] });
    expect(placed).toMatchObject({ ok: false, reason: 'Roads require buildable land.' });
    expect(sim.snapshot().treasury).toBe(start);
    expect(sim.applyCommand({ type: 'demolish', tiles: outside })).toMatchObject({ ok: false, reason: 'No roads to remove.' });
  });

  it('demolishes roads, reports changed tiles, and fails when nothing was removed', () => {
    const sim = new Simulation(42);
    const tile = freeNeighbour(sim);
    sim.applyCommand({ type: 'place-roads', tiles: [tile] });
    const treasury = sim.snapshot().treasury;
    const result = sim.applyCommand({ type: 'demolish', tiles: [tile, entranceOf(sim)] });
    expect(result).toMatchObject({ ok: true, cost: 0, treasury });
    expect(result.changedTiles).toContainEqual(tile);
    expect(sim.getWorld().roads[sim.getWorld().entranceIndex]).toBe(1);
    expect(sim.applyCommand({ type: 'demolish', tiles: [tile] })).toMatchObject({ ok: false, reason: 'No roads to remove.' });
  });
});

function createEmptyWorldLike(source: ReturnType<typeof createEmptyWorld>) {
  const world = createEmptyWorld(source.width, source.height);
  world.terrain.set(source.terrain);
  return world;
}

describe('settlement entrance', () => {
  const onEdge = (i: number, w: number, h: number) => {
    const x = i % w; const y = Math.floor(i / w);
    return x === 0 || y === 0 || x === w - 1 || y === h - 1;
  };

  for (const seed of [1, 42, 20261004, 987654, 31337]) {
    it(`seed ${seed}: deterministic, on the map edge, buildable, and a connected road`, () => {
      const a = generateWorld(seed, 128, 128);
      expect(generateWorld(seed, 128, 128).entranceIndex).toBe(a.entranceIndex);
      expect(a.entranceIndex).toBeGreaterThanOrEqual(0);
      expect(onEdge(a.entranceIndex, 128, 128)).toBe(true);
      expect(isBuildableTerrain(a, a.entranceIndex % 128, Math.floor(a.entranceIndex / 128))).toBe(true);
      expect(a.roads[a.entranceIndex]).toBe(1);
      expect(a.roadConnected[a.entranceIndex]).toBe(1);
      expect(a.trees[a.entranceIndex]).toBe(0);
      expect(a.roads.reduce((n, r) => n + r, 0)).toBe(1);
    });
  }

  it('prefers an edge midpoint, scanning north first, and skips water', () => {
    const world = createEmptyWorld(9, 9);
    world.terrain.fill(TerrainId.Grass);
    expect(placeSettlementEntrance(createEmptyWorldLike(world))).toBe(toIndex(4, 0, 9));
    world.terrain[toIndex(4, 0, 9)] = TerrainId.Water;
    // North midpoint is water, so the east edge's midpoint wins over (3, 0).
    expect(placeSettlementEntrance(world)).toBe(toIndex(8, 4, 9));
  });

  it('places no entrance rather than falling back to an invalid tile', () => {
    const world = createEmptyWorld(6, 6);
    world.terrain.fill(TerrainId.Water);
    world.terrain[toIndex(2, 2, 6)] = TerrainId.Grass;
    expect(placeSettlementEntrance(world)).toBe(-1);
    expect(world.roads.every((r) => r === 0)).toBe(true);
  });
});
