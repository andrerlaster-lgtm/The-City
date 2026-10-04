import { describe, expect, it } from 'vitest';
import { BALANCE } from '../../src/data/balance';
import { tickToDate } from '../../src/sim/time/calendar';
import { createScene, runTicks } from '../helpers/scene';

describe('calendar', () => {
  it('starts at Year 1, month 1, day 1, 00:00', () => {
    expect(tickToDate(0)).toEqual({ year: 1, month: 1, day: 1, hour: 0 });
  });

  it('rolls hours, days, months and years', () => {
    const { ticksPerDay, daysPerMonth, monthsPerYear } = BALANCE.time;
    expect(tickToDate(ticksPerDay - 1).hour).toBe(ticksPerDay - 1);
    expect(tickToDate(ticksPerDay).day).toBe(2);
    expect(tickToDate(ticksPerDay * daysPerMonth).month).toBe(2);
    expect(tickToDate(ticksPerDay * daysPerMonth * monthsPerYear).year).toBe(2);
  });
});

describe('Simulation', () => {
  it('starts with the configured treasury', () => {
    expect(createScene().snapshot().treasury).toBe(BALANCE.economy.startingTreasury);
  });

  it('advances one hour per tick', () => {
    const sim = createScene();
    runTicks(sim, 25);
    expect(sim.snapshot().date).toEqual({ year: 1, month: 1, day: 2, hour: 1 });
  });
});
