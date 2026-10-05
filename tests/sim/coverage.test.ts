import { describe, expect, it } from 'vitest';
import { Rng } from '../../src/core/rng';
import { BUILDINGS } from '../../src/data/buildings';
import type { BuildingId } from '../../src/data/buildings';
import type { BuildingInstance } from '../../src/sim/buildings/buildings';
import { activeServices, coverageMap, isCovered, serviceRadius, wellCovers } from '../../src/sim/services/coverage';
import { createEmptyWorld } from '../../src/sim/world/World';
import { createConnectedTown, runDays } from '../helpers/scene';

const at = (id: number, defId: BuildingId, x: number, y: number): BuildingInstance => ({ id, defId, x, y, roadAccess: true, connected: true });

/** The Stage 1 Well rule, written out independently (footprint centres, Euclidean, radius 6). */
function stage1WellCovers(home: BuildingInstance, wells: readonly BuildingInstance[]): boolean {
  const half = home.defId === 'rowhouse' ? 0.5 : 0;
  return wells.some((well) => (home.x + half - well.x) ** 2 + (home.y + half - well.y) ** 2 <= 36);
}

describe('generic service coverage', () => {
  it('the Well is a water service of radius 6 defined purely in data', () => {
    expect(BUILDINGS.find((b) => b.id === 'well')!.services).toEqual([{ kind: 'water', radius: 6 }]);
    expect(BUILDINGS.filter((b) => b.id !== 'well').every((b) => b.services.length === 0)).toBe(true);
    expect(serviceRadius(at(1, 'well', 0, 0), 'water')).toBe(6);
    expect(serviceRadius(at(1, 'cottage', 0, 0), 'water')).toBe(0);
  });

  it('isCovered matches the Stage 1 Well rule for cottages and rowhouses, edges included', () => {
    const rng = new Rng(7);
    for (let i = 0; i < 2000; i++) {
      const wells = Array.from({ length: rng.int(1, 3) }, (_, k) => at(100 + k, 'well', rng.int(0, 30), rng.int(0, 30)));
      const home = at(1, rng.next() < 0.5 ? 'cottage' : 'rowhouse', rng.int(0, 30), rng.int(0, 30));
      expect(isCovered('water', home, wells)).toBe(stage1WellCovers(home, wells));
      expect(wellCovers(home, wells)).toBe(stage1WellCovers(home, wells));
    }
  });

  it('the per-tile map uses the same rule: a tile is covered exactly when a 1×1 building there would be', () => {
    const world = createEmptyWorld(40, 40);
    const wells = [at(100, 'well', 10, 10), at(101, 'well', 0, 39), at(102, 'well', 30, 18)];
    const map = coverageMap('water', wells, world);
    for (let y = 0; y < 40; y++) for (let x = 0; x < 40; x++) {
      expect(map[y * 40 + x] === 1).toBe(isCovered('water', at(1, 'cottage', x, y), wells));
    }
    expect(map.reduce((n, v) => n + v, 0)).toBeGreaterThan(100);
  });

  it('only connected, staffed services count, and the simulation caches coverage per map version', () => {
    const sim = createConnectedTown();
    const before = sim.getCoverage('water');
    expect(before.every((v) => v === 0)).toBe(true); // the Well has no worker yet
    const version = sim.getMapVersion();
    runDays(sim, 8);
    expect(sim.getMapVersion()).toBeGreaterThan(version);
    const after = sim.getCoverage('water');
    const state = sim.exportState();
    const staffed = activeServices(state.buildings, state.citizens, 'water');
    expect(staffed.length).toBe(1);
    expect(after.some((v) => v === 1)).toBe(true);
    expect(sim.getCoverage('water')).toBe(after); // cached until the map version changes
    sim.applyCommand({ type: 'set-speed', speed: 2 });
    expect(sim.getCoverage('water')).toBe(after); // speed changes don't touch the map
  });
});
