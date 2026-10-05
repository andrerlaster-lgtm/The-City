import { describe, expect, it } from 'vitest';
import { toIndex } from '../../src/core/grid';
import { OVERLAY_LEGENDS, OVERLAY_ORDER, overlayTints, Tint } from '../../src/render/overlays';
import type { BuildingInstance } from '../../src/sim/buildings/buildings';
import { createEmptyWorld } from '../../src/sim/world/World';

const at = (id: number, defId: BuildingInstance['defId'], x: number, y: number, connected: boolean, roadAccess: boolean): BuildingInstance => ({ id, defId, x, y, connected, roadAccess });

describe('overlay tints', () => {
  it('cycles none → water → roads, with a legend for each overlay', () => {
    expect(OVERLAY_ORDER).toEqual(['none', 'water', 'roads']);
    expect(OVERLAY_LEGENDS.water.entries.length).toBeGreaterThan(0);
    expect(OVERLAY_LEGENDS.roads.entries.map((e) => e.tint)).toEqual([Tint.Good, Tint.Warn, Tint.Bad]);
  });

  it('water tints exactly the covered tiles', () => {
    const world = createEmptyWorld(8, 8);
    const water = new Uint8Array(64); water[3] = 1; water[40] = 1;
    const tints = overlayTints('water', world, [], water);
    expect([...tints].filter((t) => t !== Tint.None).length).toBe(2);
    expect(tints[3]).toBe(Tint.Good);
    expect(tints[40]).toBe(Tint.Good);
  });

  it('roads: connected roads good, disconnected roads and buildings warn, no-access buildings bad', () => {
    const world = createEmptyWorld(8, 8);
    world.roads[toIndex(0, 0, 8)] = 1; world.roadConnected[toIndex(0, 0, 8)] = 1;
    world.roads[toIndex(5, 5, 8)] = 1;
    const buildings = [
      at(1, 'cottage', 1, 1, true, true),
      at(2, 'rowhouse', 2, 3, false, true),
      at(3, 'cottage', 6, 0, false, false),
    ];
    const tints = overlayTints('roads', world, buildings, null);
    expect(tints[toIndex(0, 0, 8)]).toBe(Tint.Good);
    expect(tints[toIndex(5, 5, 8)]).toBe(Tint.Warn);
    expect(tints[toIndex(1, 1, 8)]).toBe(Tint.None); // connected building: no tint
    for (const [x, y] of [[2, 3], [3, 3], [2, 4], [3, 4]] as const) expect(tints[toIndex(x, y, 8)]).toBe(Tint.Warn);
    expect(tints[toIndex(6, 0, 8)]).toBe(Tint.Bad);
  });

  it('none tints nothing', () => {
    expect(overlayTints('none', createEmptyWorld(4, 4), [], null).every((t) => t === Tint.None)).toBe(true);
  });
});
