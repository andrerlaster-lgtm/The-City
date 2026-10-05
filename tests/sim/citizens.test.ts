import { describe, expect, it } from 'vitest';
import { occupancyFor } from '../../src/sim/citizens/citizens';
import { assignHomeless, connectedHousingCapacity, roadDistancesFromEntrance } from '../../src/sim/citizens/housing';
import { staffedWells } from '../../src/sim/services/coverage';
import { createEmptyWorld } from '../../src/sim/world/World';
import type { BuildingInstance } from '../../src/sim/buildings/buildings';
import type { Citizen } from '../../src/sim/citizens/citizens';
import { toIndex } from '../../src/core/grid';
import { createConnectedTown, runDays } from '../helpers/scene';

const building = (id: number, defId: BuildingInstance['defId'], x: number, y: number): BuildingInstance => ({ id, defId, x, y, roadAccess: true, connected: true });

describe('citizen assignments and housing', () => {
  it('starts with no citizens and the approved food stock', () => {
    const sim = createConnectedTown();
    expect(sim.snapshot()).toMatchObject({ population: 0, food: 30, employed: 0, unemployed: 0, homeless: 0 });
  });

  it('derives building occupancy from citizen assignments', () => {
    const citizens: Citizen[] = [
      { id: 1, home: 7, job: 9, hungryDays: 0, unemployedDays: 0, homelessDays: 0 },
      { id: 2, home: 7, job: 0, hungryDays: 1, unemployedDays: 1, homelessDays: 0 },
    ];
    expect(occupancyFor(7, citizens)).toEqual({ residents: 2, workers: 0 });
    expect(occupancyFor(9, citizens)).toEqual({ residents: 0, workers: 1 });
  });

  it('assigns homeless residents to staffed-Well homes before nearer homes', () => {
    const world = createEmptyWorld(12, 12);
    world.entranceIndex = toIndex(0, 0, world.width);
    for (let x = 0; x <= 8; x++) world.roads[toIndex(x, 0, world.width)] = world.roadConnected[toIndex(x, 0, world.width)] = 1;
    for (let y = 1; y <= 7; y++) world.roads[toIndex(8, y, world.width)] = world.roadConnected[toIndex(8, y, world.width)] = 1;
    const homes = [building(1, 'cottage', 1, 1), building(2, 'cottage', 8, 8)];
    const well = building(3, 'well', 8, 7);
    const buildings = [...homes, well];
    const citizens: Citizen[] = [
      { id: 1, home: 1, job: 3, hungryDays: 0, unemployedDays: 0, homelessDays: 0 },
      { id: 2, home: 0, job: 0, hungryDays: 0, unemployedDays: 0, homelessDays: 0 },
    ];
    const wells = staffedWells(buildings, citizens);
    assignHomeless(citizens, buildings, world, wells, roadDistancesFromEntrance(world));
    expect(wells.map((entry) => entry.id)).toEqual([3]);
    expect(staffedWells(buildings, citizens.map((entry) => ({ ...entry, job: 0 })))).toEqual([]);
    expect(citizens[1]?.home).toBe(2);
  });

  it('uses entrance road distance and then building id to order homes', () => {
    const world = createEmptyWorld(12, 12);
    world.entranceIndex = toIndex(5, 0, world.width);
    for (const [x, y] of [[5, 0], [4, 0], [6, 0]] as const) {
      const i = toIndex(x, y, world.width); world.roads[i] = world.roadConnected[i] = 1;
    }
    const homes = [building(7, 'cottage', 4, 1), building(2, 'cottage', 6, 1)];
    const citizens: Citizen[] = [{ id: 1, home: 0, job: 0, hungryDays: 0, unemployedDays: 0, homelessDays: 0 }];
    assignHomeless(citizens, homes, world, [], roadDistancesFromEntrance(world));
    expect(citizens[0]?.home).toBe(2);
  });

  it('counts only connected homes as housing and keeps residents in a disconnected home', () => {
    const buildings = [building(1, 'cottage', 1, 1), { ...building(2, 'rowhouse', 4, 4), connected: false }];
    const citizens: Citizen[] = [
      { id: 1, home: 1, job: 0, hungryDays: 0, unemployedDays: 0, homelessDays: 0 },
      { id: 2, home: 2, job: 0, hungryDays: 0, unemployedDays: 0, homelessDays: 1 },
    ];
    expect(connectedHousingCapacity(buildings, citizens).free).toBe(3);
    expect(citizens[1]?.home).toBe(2);
  });

  it('clears citizen assignments immediately when their building is demolished', () => {
    const sim = createConnectedTown();
    runDays(sim, 2);
    const resident = sim.getCitizens().find((citizen) => citizen.home === 1);
    expect(resident).toBeDefined();
    sim.applyCommand({ type: 'demolish', tiles: [{ x: sim.getBuilding(1)!.x, y: sim.getBuilding(1)!.y }] });
    expect(sim.getCitizens().find((citizen) => citizen.id === resident!.id)).toMatchObject({ home: 0, job: 0 });
  });
});
