import { describe, expect, it } from 'vitest';
import { occupancyRatios, windowGlowFor } from '../../src/render/occupancy';
import type { BuildingInstance } from '../../src/sim/buildings/buildings';
import type { Citizen } from '../../src/sim/citizens/citizens';

const at = (id: number, defId: BuildingInstance['defId']): BuildingInstance => ({ id, defId, x: id * 4, y: 0, connected: true, roadAccess: true });
const person = (id: number, home: number, job = 0): Citizen => ({ id, home, job, hungryDays: 0, unemployedDays: 0, homelessDays: 0 });

describe('how full buildings look', () => {
  it('counts residents for homes and workers for workplaces', () => {
    const buildings = [at(1, 'cottage'), at(2, 'rowhouse'), at(3, 'workshop'), at(4, 'well')];
    const citizens = [person(1, 1, 3), person(2, 1, 3), person(3, 2), person(4, 0, 3)];
    const fill = occupancyRatios(buildings, citizens);
    expect(fill.get(1)).toBe(2 / 4); // cottage: 4 homes
    expect(fill.get(2)).toBe(1 / 16); // rowhouse: 16 homes
    expect(fill.get(3)).toBe(3 / 8); // workshop: 8 jobs
    expect(fill.get(4)).toBe(0); // well: 1 job, nobody working
  });

  it('shows empty buildings as 0 and leaves out buildings with no homes or jobs', () => {
    const fill = occupancyRatios([at(1, 'cottage')], []);
    expect(fill.get(1)).toBe(0);
    expect(fill.has(99)).toBe(false);
  });

  it('keeps windows dark when empty and brighter as a building fills', () => {
    expect(windowGlowFor(1, 0)).toBe(0);
    expect(windowGlowFor(1, 0.25)).toBeLessThan(windowGlowFor(1, 1));
    expect(windowGlowFor(1, 1)).toBe(1);
    expect(windowGlowFor(0.6, undefined)).toBe(0.6);
  });
});
