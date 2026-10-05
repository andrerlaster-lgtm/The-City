import { describe, expect, it } from 'vitest';
import { consumeFood, produceFood } from '../../src/sim/resources/food';
import type { BuildingInstance } from '../../src/sim/buildings/buildings';
import type { Citizen } from '../../src/sim/citizens/citizens';

const b = (id: number, defId: BuildingInstance['defId'], connected = true): BuildingInstance => ({ id, defId, x: id, y: 1, roadAccess: true, connected });
const c = (id: number, home: number, job = 0, hungryDays = 0): Citizen => ({ id, home, job, hungryDays, unemployedDays: 0, homelessDays: 0 });

describe('food', () => {
  it('produces two food per worker at connected farms only', () => {
    const buildings = [b(1, 'cottage'), b(2, 'farm'), b(3, 'farm', false)];
    expect(produceFood(buildings, [c(1, 1, 2), c(2, 1, 3), c(3, 1, 2)])).toBe(4);
  });

  it('feeds by citizen id, resets fed hunger and increments unfed hunger', () => {
    const citizens = [c(2, 1, 0, 2), c(1, 1, 0, 4), c(3, 1, 0, 0)];
    expect(consumeFood(1, citizens)).toEqual({ food: 0, eaten: 1 });
    expect(citizens.map(({ id, hungryDays }) => [id, hungryDays])).toEqual([[1, 0], [2, 3], [3, 1]]);
  });
});
