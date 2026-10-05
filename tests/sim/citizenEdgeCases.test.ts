import { afterEach, describe, expect, it } from 'vitest';
import { toIndex } from '../../src/core/grid';
import { BUILDINGS, type BuildingDefinition, type BuildingId } from '../../src/data/buildings';
import { TerrainId } from '../../src/data/terrain';
import type { BuildingInstance } from '../../src/sim/buildings/buildings';
import type { Citizen } from '../../src/sim/citizens/citizens';
import { connectedHomes } from '../../src/sim/citizens/housing';
import { migrate } from '../../src/sim/citizens/migration';
import { workshopRevenue } from '../../src/sim/economy/economy';
import { consumeFood, produceFood } from '../../src/sim/resources/food';
import { staffedWells, wellCovers } from '../../src/sim/services/coverage';
import { createEmptyWorld } from '../../src/sim/world/World';
import { createConnectedTown, runDays, runTicks } from '../helpers/scene';

const at = (id: number, defId: string, x: number, y: number, connected = true): BuildingInstance =>
  ({ id, defId: defId as BuildingId, x, y, roadAccess: true, connected });
const c = (id: number, home = 0, job = 0, values: Partial<Citizen> = {}): Citizen =>
  ({ id, home, job, hungryDays: 0, unemployedDays: 0, homelessDays: 0, ...values });
function smallWorld() {
  const map = createEmptyWorld(8, 8);
  map.terrain.fill(TerrainId.Grass);
  map.entranceIndex = toIndex(1, 1, 8);
  map.roads[map.entranceIndex] = map.roadConnected[map.entranceIndex] = 1;
  return map;
}

describe('M5 edge cases', () => {
  it('feeds everyone when food exactly equals the population', () => {
    const citizens = [c(1, 0, 0, { hungryDays: 2 }), c(2), c(3)];
    expect(consumeFood(3, citizens)).toEqual({ food: 0, eaten: 3 });
    expect(citizens.every((citizen) => citizen.hungryDays === 0)).toBe(true);
  });

  it('applies no food penalty when there are no citizens yet, even with 0 food', () => {
    const result = migrate([], [at(1, 'cottage', 2, 2)], smallWorld(), [], new Int32Array(64), 10, 0, 0, 1);
    expect(result.summary.arrived).toBe(1);
  });

  it('combines the jobs pull (clamped to 3), Well pull and food penalty', () => {
    const buildings = [at(1, 'cottage', 2, 2), at(2, 'cottage', 3, 2), at(3, 'well', 2, 3)];
    const residents = [c(1, 1, 3)];
    // 3 (10 open jobs, clamped) + 1 (staffed Well covers free housing) − 1 (no food) = 3.
    expect(migrate(residents, buildings, smallWorld(), [buildings[2]!], new Int32Array(64), 10, 10, 0, 2).summary.arrived).toBe(3);
  });

  it('covers homes exactly at the Well radius but not one tile beyond, and accepts any of several Wells', () => {
    const near = at(9, 'well', 0, 0);
    const far = at(10, 'well', 40, 0);
    expect(wellCovers(at(1, 'cottage', 6, 0), [near])).toBe(true);
    expect(wellCovers(at(1, 'cottage', 7, 0), [near])).toBe(false);
    expect(wellCovers(at(1, 'cottage', 35, 0), [near, far])).toBe(true);
    // A 2x2 Rowhouse is measured from its centre (5.5, 0.5).
    expect(wellCovers(at(1, 'rowhouse', 5, 0), [near])).toBe(true);
  });

  it('a workplace demolished at 23:00 frees its workers at once; counters move at 00:00', () => {
    const sim = createConnectedTown();
    runDays(sim, 10);
    const workshop = sim.getBuildings().find((building) => building.defId === 'workshop')!;
    const worker = sim.getCitizens().find((citizen) => citizen.job === workshop.id)!;
    expect(worker).toBeDefined();
    runTicks(sim, 23);
    expect(sim.snapshot().date.hour).toBe(23);
    sim.applyCommand({ type: 'demolish', tiles: [{ x: workshop.x, y: workshop.y }] });
    const freed = sim.getCitizens().find((citizen) => citizen.id === worker.id)!;
    expect(freed).toMatchObject({ job: 0, unemployedDays: 0 });
    runTicks(sim, 1);
    const after = sim.getCitizens().find((citizen) => citizen.id === worker.id);
    if (after) expect(after.unemployedDays).toBe(after.job === 0 ? 1 : 0);
  });

  it('produces the same city (citizens, food, ledger, world) at 1x and 3x over 40 days', () => {
    const run = (speed: 1 | 3) => {
      const sim = createConnectedTown(77);
      sim.applyCommand({ type: 'set-speed', speed });
      runDays(sim, 15);
      const entranceX = sim.getWorld().entranceIndex % sim.getWorld().width;
      sim.applyCommand({ type: 'demolish', tiles: [{ x: entranceX + 5, y: 1 }] });
      runDays(sim, 2);
      sim.applyCommand({ type: 'place-roads', tiles: [{ x: entranceX + 5, y: 1 }] });
      runDays(sim, 23);
      return sim;
    };
    const a = run(1); const b = run(3);
    expect(a.getCitizens()).toEqual(b.getCitizens());
    expect(a.getBuildings()).toEqual(b.getBuildings());
    for (const key of ['roads', 'roadConnected', 'buildingAt', 'trees'] as const) expect(a.getWorld()[key]).toEqual(b.getWorld()[key]);
    expect({ ...a.snapshot(), speed: 0 }).toEqual({ ...b.snapshot(), speed: 0 });
    expect(a.snapshot().population).toBeGreaterThan(0);
  });
});

describe('a sixth building needs only data', () => {
  const extras: BuildingDefinition[] = [
    { id: 'orchard' as BuildingId, name: 'Orchard', category: 'Employment', description: 'test', size: 2, cost: 1, upkeep: 0, housing: 0, jobs: 4, produces: 'food', services: [], requires: { roadAccess: true, terrain: [TerrainId.Grass] }, art: 'orchard' },
    { id: 'market' as BuildingId, name: 'Market', category: 'Employment', description: 'test', size: 1, cost: 1, upkeep: 0, housing: 0, jobs: 2, produces: 'revenue', services: [], requires: { roadAccess: true, terrain: [TerrainId.Grass] }, art: 'market' },
    { id: 'lodge' as BuildingId, name: 'Lodge', category: 'Residential', description: 'test', size: 1, cost: 1, upkeep: 0, housing: 6, jobs: 0, produces: null, services: [], requires: { roadAccess: true, terrain: [TerrainId.Grass] }, art: 'lodge' },
    { id: 'fountain' as BuildingId, name: 'Fountain', category: 'Service', description: 'test', size: 1, cost: 1, upkeep: 0, housing: 0, jobs: 0, produces: null, services: [{ kind: 'water', radius: 3 }], requires: { roadAccess: true, terrain: [TerrainId.Grass] }, art: 'fountain' },
  ];
  const all = BUILDINGS as BuildingDefinition[];
  afterEach(() => { for (const extra of extras) { const i = all.indexOf(extra); if (i >= 0) all.splice(i, 1); } });

  it('drives food, revenue, housing and service coverage from definition fields', () => {
    all.push(...extras);
    const lodge = at(1, 'lodge', 0, 0);
    const buildings = [lodge, at(2, 'orchard', 4, 4), at(3, 'market', 8, 8), at(4, 'fountain', 1, 1), at(5, 'farm', 20, 20, false)];
    const citizens = [c(1, 1, 2), c(2, 1, 2), c(3, 1, 3)];
    expect(produceFood(buildings, citizens)).toBe(4);
    expect(workshopRevenue(buildings, citizens)).toBe(2);
    expect(connectedHomes(buildings).map((home) => home.id)).toEqual([1]);
    // No jobs, so no worker needed; radius comes from its definition (3).
    expect(staffedWells(buildings, citizens).map((service) => service.id)).toEqual([4]);
    expect(wellCovers(at(6, 'lodge', 4, 1), [buildings[3]!])).toBe(true);
    expect(wellCovers(at(6, 'lodge', 5, 1), [buildings[3]!])).toBe(false);
  });
});
