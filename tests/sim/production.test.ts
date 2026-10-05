import { describe, expect, it } from 'vitest';
import { workshopRevenue } from '../../src/sim/economy/economy';
import { produceFood } from '../../src/sim/resources/food';
import { productionOf } from '../../src/sim/resources/production';
import { createConnectedTown, runDays } from '../helpers/scene';

describe('per-building production', () => {
  it('matches the daily step: farm food and workshop revenue add up to the city totals', () => {
    const sim = createConnectedTown();
    runDays(sim, 12);
    const buildings = sim.getBuildings(); const citizens = sim.getCitizens();
    const all = buildings.map((building) => productionOf(building.id, buildings, citizens));
    expect(all.reduce((sum, p) => sum + p.food, 0)).toBe(produceFood(buildings, citizens));
    expect(all.reduce((sum, p) => sum + p.revenue, 0)).toBe(workshopRevenue(buildings, citizens));
    const farm = buildings.find((building) => building.defId === 'farm')!;
    const output = sim.getProduction(farm.id);
    expect(output.food).toBe(output.workers * 2);
    expect(output.revenue).toBe(0);
  });

  it('is zero for disconnected buildings and for buildings that produce nothing', () => {
    const sim = createConnectedTown();
    runDays(sim, 12);
    const cottage = sim.getBuildings().find((building) => building.defId === 'cottage')!;
    expect(sim.getProduction(cottage.id)).toEqual({ workers: 0, food: 0, revenue: 0 });
    const entranceX = sim.getWorld().entranceIndex % sim.getWorld().width;
    sim.applyCommand({ type: 'demolish', tiles: [{ x: entranceX + 1, y: 1 }] });
    const farm = sim.getBuildings().find((building) => building.defId === 'farm')!;
    expect(farm.connected).toBe(false);
    expect(sim.getProduction(farm.id).food).toBe(0);
  });
});
