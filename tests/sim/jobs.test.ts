import { describe, expect, it } from 'vitest';
import { toIndex } from '../../src/core/grid';
import { assignJobs } from '../../src/sim/citizens/jobs';
import type { Citizen } from '../../src/sim/citizens/citizens';
import type { BuildingInstance } from '../../src/sim/buildings/buildings';
import { createEmptyWorld } from '../../src/sim/world/World';

const b = (id: number, defId: BuildingInstance['defId'], x: number, y: number, connected = true): BuildingInstance => ({ id, defId, x, y, roadAccess: true, connected });
function roadWorld(): ReturnType<typeof createEmptyWorld> {
  const world = createEmptyWorld(12, 12);
  world.entranceIndex = toIndex(1, 1, world.width);
  for (const [x, y] of [[1, 1], [1, 0], [2, 0], [3, 0], [4, 0], [5, 0], [6, 0], [7, 0], [8, 0]] as const) {
    const i = toIndex(x, y, world.width); world.roads[i] = 1; world.roadConnected[i] = 1;
  }
  return world;
}
const citizen = (id: number, home = 1, job = 0): Citizen => ({ id, home, job, hungryDays: 0, unemployedDays: 0, homelessDays: 0 });

describe('road-distance job matching', () => {
  it('fills the nearest workplace first and falls back when it is full', () => {
    const world = roadWorld();
    const buildings = [b(1, 'cottage', 1, 2), b(2, 'workshop', 7, 1), b(3, 'well', 3, 1)];
    const citizens = [citizen(1), citizen(2)];
    assignJobs(citizens, buildings, world);
    expect(citizens.map((entry) => entry.job)).toEqual([3, 2]);
  });

  it('uses road distance rather than straight-line distance', () => {
    const world = createEmptyWorld(12, 12);
    world.entranceIndex = toIndex(1, 1, world.width);
    const path: [number, number][] = [[1, 1], [1, 0]];
    for (let x = 2; x <= 10; x++) path.push([x, 0]);
    for (let y = 1; y <= 3; y++) path.push([10, y]);
    for (let x = 9; x >= 2; x--) path.push([x, 3]);
    for (const [x, y] of path) { const i = toIndex(x, y, world.width); world.roads[i] = 1; world.roadConnected[i] = 1; }
    const buildings = [b(1, 'cottage', 1, 2), b(2, 'workshop', 10, 1), b(3, 'well', 1, 3)];
    const citizens = [citizen(1)];
    assignJobs(citizens, buildings, world);
    expect(citizens[0]?.job).toBe(2);
  });

  it('keeps a valid assigned job stable and gives equal-distance ties to the lowest id', () => {
    const world = roadWorld();
    const buildings = [b(1, 'cottage', 1, 2), b(4, 'workshop', 3, 1), b(2, 'workshop', 3, 1)];
    const citizens = [citizen(1, 1, 4)];
    assignJobs(citizens, buildings, world);
    expect(citizens[0]?.job).toBe(4);
    const newCitizen = citizen(2);
    assignJobs([newCitizen], buildings, world);
    expect(newCitizen.job).toBe(2);
  });

  it('does not offer jobs at disconnected workplaces', () => {
    const citizens = [citizen(1)];
    assignJobs(citizens, [b(1, 'cottage', 1, 2), b(2, 'workshop', 7, 1, false)], roadWorld());
    expect(citizens[0]).toMatchObject({ job: 0, unemployedDays: 1 });
  });
});
