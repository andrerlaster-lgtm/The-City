import { describe, expect, it } from 'vitest';
import { createSaveFile, deserializeState, serializeState } from '../../src/save/serialize';
import { readSave } from '../../src/save/validate';
import { Simulation } from '../../src/sim/Simulation';
import { runDays } from '../helpers/scene';
import { populatedTown } from './helpers';

/** Save → structured clone (as IndexedDB does) → validate → load. */
function roundTrip(sim: Simulation): Simulation {
  const stored = structuredClone(createSaveFile(sim.exportState(), 'Slot 1', '2026-10-04T12:00:00.000Z'));
  const read = readSave(stored);
  if (!read.ok) throw new Error(read.reason);
  return Simulation.fromState(deserializeState(read.file.state));
}

describe('save serialization', () => {
  it('restores every field exactly, including rebuilt derived data', () => {
    const sim = populatedTown();
    const original = sim.exportState();
    const loaded = deserializeState(structuredClone(serializeState(original)));
    expect(loaded).toEqual(original);
    expect(loaded.world.roadConnected).toEqual(original.world.roadConnected);
    expect(loaded.world.buildingAt).toEqual(original.world.buildingAt);
    expect(loaded.buildings.map(({ roadAccess, connected }) => ({ roadAccess, connected })))
      .toEqual(original.buildings.map(({ roadAccess, connected }) => ({ roadAccess, connected })));
    expect(loaded.citizens.length).toBeGreaterThan(0);
  });

  it('always saves the same city identically', () => {
    const state = populatedTown().exportState();
    const once = serializeState(state);
    expect(serializeState(deserializeState(once))).toEqual(once);
    expect(serializeState(state)).toEqual(once);
  });

  it('stores no derived data, sorts by id, and copies instead of aliasing the live game', () => {
    const sim = populatedTown();
    const saved = serializeState(sim.exportState());
    expect(Object.keys(saved)).not.toContain('roadConnected');
    expect(Object.keys(saved)).not.toContain('buildingAt');
    expect(saved.buildings[0]).toEqual({ id: saved.buildings[0]!.id, defId: saved.buildings[0]!.defId, x: saved.buildings[0]!.x, y: saved.buildings[0]!.y });
    expect(saved.citizens.map((c) => c.id)).toEqual([...saved.citizens.map((c) => c.id)].sort((a, b) => a - b));
    const before = saved.roads.slice();
    sim.applyCommand({ type: 'place-roads', tiles: [{ x: 40, y: 10 }] });
    expect(saved.roads).toEqual(before);
  });

  it('saves the exact seed, in the state and in the menu details', () => {
    const sim = new Simulation(3_141_592_653);
    const file = createSaveFile(sim.exportState(), 'Slot 2', '2026-10-04T12:00:00.000Z');
    expect(file.state.seed).toBe(3_141_592_653);
    expect(file.meta.seed).toBe(3_141_592_653);
    expect(roundTrip(sim).snapshot().seed).toBe(3_141_592_653);
  });

  it('save → load → 30 days equals 30 days without saving, at 1× and 3×', () => {
    for (const speed of [1, 3] as const) {
      const straight = populatedTown();
      const saved = populatedTown();
      straight.applyCommand({ type: 'set-speed', speed });
      saved.applyCommand({ type: 'set-speed', speed });
      const loaded = roundTrip(saved);
      runDays(straight, 30);
      runDays(loaded, 30);
      expect(loaded.exportState()).toEqual(straight.exportState());
    }
  });

  it('gives different maps for different seeds', () => {
    expect(new Simulation(1).getWorld().terrain).not.toEqual(new Simulation(2).getWorld().terrain);
  });

  it('serializes and loads a 2,000-citizen city quickly', () => {
    const state = new Simulation(42).exportState();
    state.citizens = Array.from({ length: 2000 }, (_, i) => ({ id: i + 1, home: 0, job: 0, hungryDays: 0, unemployedDays: 0, homelessDays: 0 }));
    state.nextCitizenId = 2001;
    const sim = Simulation.fromState(state);
    roundTrip(sim);
    const started = performance.now();
    for (let i = 0; i < 5; i++) roundTrip(sim);
    const perRound = (performance.now() - started) / 5;
    console.info(`[M6 performance] 128×128 + 2,000 citizens save→clone→validate→load: ${perRound.toFixed(2)} ms`);
    expect(perRound).toBeLessThan(250);
  });
});
