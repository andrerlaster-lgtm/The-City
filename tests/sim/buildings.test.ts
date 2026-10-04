import { describe, expect, it } from 'vitest';
import { toIndex } from '../../src/core/grid';
import { TerrainId } from '../../src/data/terrain';
import { Simulation } from '../../src/sim/Simulation';
import { createFlatScene } from '../helpers/scene';

function placeRoadTo(sim: Simulation, x: number, y: number) {
  const world = sim.getWorld();
  const entranceX = world.entranceIndex % world.width;
  const entranceY = Math.floor(world.entranceIndex / world.width);
  const tiles = [];
  let cx = entranceX; let cy = entranceY;
  while (cx !== x) { cx += cx < x ? 1 : -1; tiles.push({ x: cx, y: cy }); }
  while (cy !== y) { cy += cy < y ? 1 : -1; tiles.push({ x: cx, y: cy }); }
  if (tiles.length) sim.applyCommand({ type: 'place-roads', tiles });
}

describe('building footprints and placement', () => {
  it('centres 1x1, 2x2 and 3x3 footprints using top-left rounding', () => {
    const sim = createFlatScene();
    for (const [id, cursor, first, last] of [
      ['cottage', { x: 5, y: 5 }, { x: 5, y: 5 }, { x: 5, y: 5 }],
      ['rowhouse', { x: 5, y: 5 }, { x: 5, y: 5 }, { x: 6, y: 6 }],
      ['farm', { x: 5, y: 5 }, { x: 4, y: 4 }, { x: 6, y: 6 }],
    ] as const) {
      const preview = sim.previewBuilding(id, cursor);
      expect(preview.tiles[0]).toEqual(first);
      expect(preview.tiles.at(-1)).toEqual(last);
    }
  });

  it('places a building, fills occupancy, clears trees, charges once and assigns increasing ids', () => {
    const sim = createFlatScene();
    placeRoadTo(sim, 5, 2);
    const world = sim.getWorld();
    world.trees[toIndex(5, 3, world.width)] = 1;
    const first = sim.applyCommand({ type: 'place-building', defId: 'cottage', x: 5, y: 3 });
    expect(first).toMatchObject({ ok: true, cost: 100, treasury: 4870, changedBuildings: [1] });
    expect(world.buildingAt[toIndex(5, 3, world.width)]).toBe(1);
    expect(world.trees[toIndex(5, 3, world.width)]).toBe(0);
    expect(sim.getBuildings()).toEqual([{ id: 1, defId: 'cottage', x: 5, y: 3, roadAccess: true, connected: true }]);
    sim.applyCommand({ type: 'place-roads', tiles: [{ x: 6, y: 2 }] });
    const second = sim.applyCommand({ type: 'place-building', defId: 'well', x: 6, y: 3 });
    expect(second.changedBuildings).toEqual([2]);
  });

  it('requires an edge-adjacent road, rejects corner-only contact, and reports entrance connection separately', () => {
    const sim = createFlatScene();
    const world = sim.getWorld();
    const entranceX = world.entranceIndex % world.width;
    expect(sim.previewBuilding('cottage', { x: entranceX + 1, y: 1 }).reason).toBe('Needs road access');
    expect(sim.applyCommand({ type: 'place-building', defId: 'cottage', x: entranceX + 1, y: 1 }).ok).toBe(false);
    sim.applyCommand({ type: 'place-roads', tiles: [{ x: 5, y: 5 }] });
    const result = sim.applyCommand({ type: 'place-building', defId: 'cottage', x: 5, y: 6 });
    expect(result.ok).toBe(true);
    expect(sim.getBuilding(1)).toMatchObject({ roadAccess: true, connected: false });
  });

  it('does not allow a building on the settlement entrance tile', () => {
    const sim = createFlatScene();
    const world = sim.getWorld();
    const entrance = { x: world.entranceIndex % world.width, y: Math.floor(world.entranceIndex / world.width) };
    const balance = sim.snapshot().treasury;

    expect(sim.previewBuilding('cottage', entrance)).toMatchObject({ ok: false, reason: 'Blocked' });
    expect(sim.applyCommand({ type: 'place-building', defId: 'cottage', ...entrance })).toMatchObject({
      ok: false,
      reason: 'Blocked',
      treasury: balance,
    });
    expect(sim.getBuildings()).toEqual([]);
    expect(world.buildingAt[world.entranceIndex]).toBe(0);
  });

  it('checks failures in plan order and leaves state unchanged', () => {
    const sim = createFlatScene(8, 8, 8);
    const world = sim.getWorld();
    world.terrain[toIndex(2, 2, world.width)] = TerrainId.Water;
    placeRoadTo(sim, 4, 2);
    world.terrain[toIndex(4, 3, world.width)] = TerrainId.Sand;
    world.roads[toIndex(4, 2, world.width)] = 0;
    sim.applyCommand({ type: 'place-roads', tiles: [{ x: 6, y: 3 }] });
    const balance = sim.snapshot().treasury;
    expect(sim.previewBuilding('cottage', { x: 2, y: 2 }).reason).toBe('Blocked');
    expect(sim.previewBuilding('farm', { x: 4, y: 3 }).reason).toBe('Needs grass');
    expect(sim.previewBuilding('cottage', { x: 7, y: 7 }).reason).toBe('Needs road access');
    expect(sim.previewBuilding('farm', { x: 0, y: 2 }).reason).toBe('Out of bounds');
    const before = world.buildingAt.slice();
    const result = sim.applyCommand({ type: 'place-building', defId: 'unknown' as never, x: 3, y: 3 });
    expect(result).toMatchObject({ ok: false, reason: 'Unknown building.', treasury: balance });
    expect(world.buildingAt).toEqual(before);
  });

  it('validates overlap, road access and affordability without partial placement', () => {
    const sim = createFlatScene();
    placeRoadTo(sim, 5, 2);
    expect(sim.applyCommand({ type: 'place-building', defId: 'rowhouse', x: 5, y: 3 }).ok).toBe(true);
    expect(sim.previewBuilding('cottage', { x: 5, y: 3 }).reason).toBe('Blocked');
    expect(sim.previewBuilding('farm', { x: 4, y: 2 }).reason).toBe('Blocked');
    const poor = createFlatScene(9, 12, 12, 100);
    placeRoadTo(poor, 5, 1);
    const state = poor.getWorld().buildingAt.slice();
    const original = poor.snapshot().treasury;
    const preview = poor.previewBuilding('farm', { x: 5, y: 3 });
    expect(preview.ok).toBe(false);
    expect(preview.reason).toBe('Not enough money');
    const failed = poor.applyCommand({ type: 'place-building', defId: 'farm', x: 5, y: 3 });
    expect(failed).toMatchObject({ ok: false, reason: 'Not enough money', treasury: original });
    expect(poor.getWorld().buildingAt).toEqual(state);
    expect(poor.snapshot().treasury).toBe(original);
  });
});

describe('building access and demolition', () => {
  it('updates distant connected status after a road is cut and rebuilt', () => {
    const sim = createFlatScene();
    placeRoadTo(sim, 5, 8);
    sim.applyCommand({ type: 'place-building', defId: 'cottage', x: 5, y: 9 });
    expect(sim.getBuilding(1)?.connected).toBe(true);
    const cut = sim.applyCommand({ type: 'demolish', tiles: [{ x: 5, y: 4 }] });
    expect(cut.ok).toBe(true);
    expect(sim.getBuilding(1)).toMatchObject({ roadAccess: true, connected: false });
    const repaired = sim.applyCommand({ type: 'place-roads', tiles: [{ x: 5, y: 4 }] });
    expect(repaired.ok).toBe(true);
    expect(sim.getBuilding(1)?.connected).toBe(true);
  });

  it('clears roadAccess when the only adjacent road is removed', () => {
    const sim = createFlatScene();
    const entranceX = sim.getWorld().entranceIndex % sim.getWorld().width;
    placeRoadTo(sim, entranceX, 1);
    sim.applyCommand({ type: 'place-building', defId: 'cottage', x: entranceX, y: 2 });
    expect(sim.getBuilding(1)?.roadAccess).toBe(true);
    sim.applyCommand({ type: 'demolish', tiles: [{ x: entranceX, y: 1 }] });
    expect(sim.getBuilding(1)).toMatchObject({ roadAccess: false, connected: false });
  });

  it('removes a whole building from one tile, handles mixed strokes, preserves entrance, and gives no refund', () => {
    const sim = createFlatScene();
    placeRoadTo(sim, 5, 2);
    const treasuryBeforeBuild = sim.snapshot().treasury;
    sim.applyCommand({ type: 'place-building', defId: 'rowhouse', x: 5, y: 3 });
    const afterBuild = sim.snapshot().treasury;
    expect(afterBuild).toBe(treasuryBeforeBuild - 350);
    const result = sim.applyCommand({ type: 'demolish', tiles: [{ x: 5, y: 4 }, { x: 5, y: 2 }] });
    expect(result.ok).toBe(true);
    expect(result.changedBuildings).toContain(1);
    expect(sim.getBuildings()).toHaveLength(0);
    expect(sim.getWorld().buildingAt[toIndex(6, 4, sim.getWorld().width)]).toBe(0);
    expect(sim.snapshot().treasury).toBe(afterBuild);
    expect(sim.getWorld().roads[sim.getWorld().entranceIndex]).toBe(1);
    expect(sim.applyCommand({ type: 'demolish', tiles: [{ x: 5, y: 4 }] })).toMatchObject({ ok: false, reason: 'Nothing to remove.' });
  });

  it('rejects a road stroke over any building tile atomically', () => {
    const sim = createFlatScene();
    placeRoadTo(sim, 5, 2);
    sim.applyCommand({ type: 'place-building', defId: 'rowhouse', x: 5, y: 3 });
    const roadsBefore = sim.getWorld().roads.slice();
    const result = sim.applyCommand({ type: 'place-roads', tiles: [{ x: 4, y: 2 }, { x: 5, y: 3 }] });
    expect(result).toMatchObject({ ok: false, reason: 'Roads cannot overlap buildings.' });
    expect(sim.getWorld().roads).toEqual(roadsBefore);
  });

  it('is deterministic for the same seed and command sequence', () => {
    const a = createFlatScene(42); const b = createFlatScene(42);
    for (const sim of [a, b]) {
      placeRoadTo(sim, 5, 2);
      sim.applyCommand({ type: 'place-building', defId: 'cottage', x: 5, y: 3 });
      sim.applyCommand({ type: 'place-roads', tiles: [{ x: 8, y: 8 }] });
      sim.applyCommand({ type: 'place-building', defId: 'cottage', x: 8, y: 9 });
    }
    expect(a.getBuildings()).toEqual(b.getBuildings());
    for (const key of ['terrain', 'trees', 'variant', 'roads', 'roadConnected', 'buildingAt'] as const) {
      expect(a.getWorld()[key]).toEqual(b.getWorld()[key]);
    }
    expect(a.snapshot()).toEqual(b.snapshot());
  });
});
