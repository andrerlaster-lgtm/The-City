import { describe, expect, it } from 'vitest';
import { connectionFeedback, placementFeedback } from '../../src/render/feedback';
import type { BuildingInstance } from '../../src/sim/buildings/buildings';

const at = (id: number, defId: BuildingInstance['defId'], x: number, y: number, connected = true): BuildingInstance => ({ id, defId, x, y, connected, roadAccess: true });

describe('placement feedback', () => {
  it('says what homes and workplaces add', () => {
    expect(placementFeedback(at(1, 'cottage', 0, 0), [])).toEqual({ text: '+4 homes', tone: 'good' });
    expect(placementFeedback(at(2, 'rowhouse', 0, 0), [])).toEqual({ text: '+16 homes', tone: 'good' });
    expect(placementFeedback(at(3, 'workshop', 0, 0), [])).toEqual({ text: '+8 jobs', tone: 'good' });
  });

  it('counts the connected homes a new Well reaches, by the game rule', () => {
    const well = at(9, 'well', 10, 10);
    const homes = [at(1, 'cottage', 13, 10), at(2, 'cottage', 16, 10), at(3, 'cottage', 30, 30), at(4, 'cottage', 10, 12, false)];
    expect(placementFeedback(well, [...homes, well])).toEqual({ text: 'Water for 2 homes', tone: 'info' });
    expect(placementFeedback(well, [homes[0]!, well])).toEqual({ text: 'Water for 1 home', tone: 'info' });
    expect(placementFeedback(well, [well])).toEqual({ text: 'No homes nearby', tone: 'warn' });
  });
});

describe('connection feedback', () => {
  it('reports buildings whose road connection flipped, and nothing else', () => {
    const before = new Map([[1, false], [2, true], [3, true]]);
    const now = [at(1, 'cottage', 0, 0, true), at(2, 'cottage', 2, 0, false), at(3, 'cottage', 4, 0, true), at(4, 'cottage', 6, 0, true)];
    expect(connectionFeedback([1, 2, 3, 4, 1], before, now)).toEqual([
      { id: 1, feedback: { text: 'Connected', tone: 'good' } },
      { id: 2, feedback: { text: 'Cut off', tone: 'warn' } },
    ]);
  });
});
