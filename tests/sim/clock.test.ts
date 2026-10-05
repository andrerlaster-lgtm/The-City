import { describe, expect, it } from 'vitest';
import { isDayStart, dayIndex } from '../../src/sim/time/clock';
import { runTicks, createScene } from '../helpers/scene';

describe('daily clock cadence', () => {
  it('runs only at full-day boundaries, not at tick zero', () => {
    expect(isDayStart(0)).toBe(false);
    expect(isDayStart(23)).toBe(false);
    expect(isDayStart(24)).toBe(true);
    expect(isDayStart(48)).toBe(true);
    expect(dayIndex(24)).toBe(1);
  });

  it('continues calendar and economy cadence across 400 days', () => {
    const sim = createScene();
    runTicks(sim, 24 * 400);
    expect(sim.snapshot().tick).toBe(24 * 400);
    expect(sim.snapshot().date).toEqual({ year: 2, month: 2, day: 11, hour: 0 });
    expect(sim.snapshot().economy.lastDay?.day).toBe(400);
  });
});
