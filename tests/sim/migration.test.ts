import { describe, expect, it } from 'vitest';
import { createEmptyWorld } from '../../src/sim/world/World';
import { migrate } from '../../src/sim/citizens/migration';
import type { Citizen } from '../../src/sim/citizens/citizens';
import type { BuildingInstance } from '../../src/sim/buildings/buildings';
import { toIndex } from '../../src/core/grid';

const home: BuildingInstance = { id: 1, defId: 'cottage', x: 2, y: 2, roadAccess: true, connected: true };
const secondHome: BuildingInstance = { id: 2, defId: 'cottage', x: 3, y: 2, roadAccess: true, connected: true };
const well: BuildingInstance = { id: 3, defId: 'well', x: 2, y: 3, roadAccess: true, connected: true };
const c = (id: number, homeId = 0, job = 0, values: Partial<Citizen> = {}): Citizen => ({ id, home: homeId, job, hungryDays: 0, unemployedDays: 0, homelessDays: 0, ...values });
function world() {
  const map = createEmptyWorld(8, 8);
  map.entranceIndex = toIndex(1, 1, map.width);
  map.roads[map.entranceIndex] = map.roadConnected[map.entranceIndex] = 1;
  return map;
}

describe('deterministic migration', () => {
  it('applies the 4-citizen cap, Well pull and treasury pause', () => {
    const buildings = [home, secondHome, well];
    const residents = [c(1, 1, 3)];
    const result = migrate(residents, buildings, world(), [well], new Int32Array(64), 1, 20, 30, 2);
    expect(result.summary.arrived).toBe(4);
    expect(residents).toHaveLength(5);
    const paused = migrate([], buildings, world(), [well], new Int32Array(64), 0, 20, 30, 1);
    expect(paused.summary.arrived).toBe(0);
  });

  it('applies the empty-food penalty and stops when connected housing is full', () => {
    const residents = [c(1, 1)];
    const result = migrate(residents, [home], world(), [], new Int32Array(64), 10, 1, 0, 2);
    expect(result.summary.arrived).toBe(0);
    const full = Array.from({ length: 4 }, (_, i) => c(i + 1, 1));
    expect(migrate(full, [home], world(), [], new Int32Array(64), 10, 20, 30, 5).summary.arrived).toBe(0);
  });

  it('does not use new arrivals as evidence of existing unemployment', () => {
    const buildings = [home, secondHome];
    const first = migrate([], buildings, world(), [], new Int32Array(64), 10, 0, 30, 1);
    expect(first.summary.arrived).toBe(1);
    const second = migrate([], buildings, world(), [], new Int32Array(64), 10, 0, 30, first.nextCitizenId);
    expect(second.summary.arrived).toBe(1);
  });

  it('counts hunger, unemployment and homeless departures by their reason', () => {
    const disconnected = { ...home, connected: false };
    const citizens = [c(1, 1, 0, { hungryDays: 5 }), c(2, 1, 0, { unemployedDays: 7 }), c(3, 1, 0, { homelessDays: 2 })];
    const result = migrate(citizens, [disconnected], world(), [], new Int32Array(64), 0, 0, 0, 4);
    expect(result.summary.left).toEqual({ hunger: 1, unemployment: 1, homeless: 1 });
    expect(citizens).toEqual([]);
  });

  it('resets the disconnected counter when a resident is reconnected before leaving', () => {
    const citizens = [c(1, 1, 0, { homelessDays: 2 })];
    migrate(citizens, [home], world(), [], new Int32Array(64), 0, 0, 30, 2);
    expect(citizens[0]).toMatchObject({ home: 1, homelessDays: 0 });
  });
});
