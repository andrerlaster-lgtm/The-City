import { describe, expect, it } from 'vitest';
import { toIndex } from '../../src/core/grid';
import { TerrainId } from '../../src/data/terrain';
import { SAVE_VERSION, type SaveFile } from '../../src/save/format';
import { createSaveFile } from '../../src/save/serialize';
import { readSave } from '../../src/save/validate';
import { populatedTown } from './helpers';

const base = createSaveFile(populatedTown().exportState(), 'Slot 1', '2026-10-04T12:00:00.000Z');
const copy = (): SaveFile => structuredClone(base);
const reason = (data: unknown) => { const r = readSave(data); return r.ok ? null : r.reason; };

describe('save validation', () => {
  it('accepts a valid save', () => {
    expect(readSave(copy()).ok).toBe(true);
  });

  it('rejects the wrong format, a newer version and missing details', () => {
    expect(reason(null)).toBe('Not a The City Life save.');
    expect(reason({ ...copy(), format: 'other-game' })).toBe('Not a The City Life save.');
    expect(reason({ ...copy(), version: SAVE_VERSION + 1 })).toContain('newer version');
    expect(reason({ ...copy(), meta: null })).toBe('Save details are missing.');
  });

  const cases: [string, (save: SaveFile) => void, string][] = [
    ['a short map layer', (s) => { s.state.roads = s.state.roads.slice(1); }, 'Map layer "roads"'],
    ['a missing map layer', (s) => { (s.state as unknown as Record<string, unknown>).trees = [1, 2]; }, 'Map layer "trees" is missing.'],
    ['an unknown building type', (s) => { (s.state.buildings[0] as { defId: string }).defId = 'castle'; }, 'Unknown building type "castle".'],
    ['duplicate building ids', (s) => { s.state.buildings[1]!.id = s.state.buildings[0]!.id; }, 'duplicated or out of order'],
    ['overlapping buildings', (s) => { s.state.buildings[1]!.x = s.state.buildings[0]!.x; s.state.buildings[1]!.y = s.state.buildings[0]!.y; }, 'overlap'],
    ['a building on water', (s) => { const b = s.state.buildings[0]!; s.state.terrain[toIndex(b.x, b.y, s.state.width)] = TerrainId.Water; }, 'unbuildable land'],
    ['a building on a road', (s) => { const b = s.state.buildings[0]!; s.state.roads[toIndex(b.x, b.y, s.state.width)] = 1; }, 'sits on a road'],
    ['a building off the map', (s) => { s.state.buildings[0]!.x = s.state.width; }, 'off the map'],
    ['a citizen pointing to a missing building', (s) => { s.state.citizens[0]!.home = 9999; }, 'missing building 9999'],
    ['a building id counter that is behind', (s) => { s.state.nextEntityId = 1; }, 'Building id counter'],
    ['a citizen id counter that is behind', (s) => { s.state.nextCitizenId = 1; }, 'Citizen id counter'],
    ['an entrance off the map', (s) => { s.state.entranceIndex = s.state.width * s.state.height; }, 'Entrance is off the map.'],
    ['an entrance without a road', (s) => { s.state.roads[s.state.entranceIndex] = 0; }, 'Entrance has no road.'],
    ['an out-of-range speed', (s) => { (s.state as { speed: number }).speed = 7; }, 'Speed is out of range.'],
    ['a malformed ledger', (s) => { (s.state.economy.today as unknown as Record<string, unknown>).revenue = 'lots'; }, 'Economy ledger is malformed.'],
    ['a non-integer tick', (s) => { s.state.tick = 1.5; }, '"tick" is not a valid whole number.'],
    ['an unknown terrain type', (s) => { s.state.terrain[0] = 99; }, 'unknown terrain type'],
  ];
  for (const [label, corrupt, expected] of cases) {
    it(`rejects ${label}`, () => {
      const save = copy();
      corrupt(save);
      expect(reason(save)).toContain(expected);
    });
  }
});
