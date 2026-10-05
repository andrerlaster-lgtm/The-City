import { describe, expect, it, vi } from 'vitest';
import { IndexedDbSaveProvider, STORAGE_TIMEOUT_MS } from '../../src/save/providers/indexedDb';
import { AUTOSAVE_AFTER_CHANGE_MS, AUTOSAVE_EVERY_DAYS, isAutosaveTick, SaveService, startupSimulation } from '../../src/app/saveService';
import { MemorySaveProvider } from '../../src/save/providers/memory';
import { SaveSlots } from '../../src/save/slots';
import { Simulation } from '../../src/sim/Simulation';
import { runDays } from '../helpers/scene';
import { FakeHost, flush, populatedTown } from './helpers';

const NOW = '2026-10-04T12:00:00.000Z';
function setup(sim = populatedTown(), provider = new MemorySaveProvider()) {
  const host = new FakeHost(sim);
  const service = new SaveService(host, new SaveSlots(provider), () => NOW, () => 777);
  return { host, service, provider };
}

describe('save slots and service', () => {
  it('lists, saves, loads and deletes manual slots', async () => {
    const { host, service } = setup();
    await service.refresh();
    expect(service.slots.get().map((s) => s.status)).toEqual(['empty', 'empty', 'empty', 'empty']);
    expect(await service.saveTo('slot2')).toBe(true);
    const saved = host.sim.exportState();
    expect(service.slots.get().find((s) => s.slot === 'slot2')).toMatchObject({ status: 'ok', meta: { name: 'Slot 2', savedAt: NOW, seed: saved.seed, population: saved.citizens.length } });
    runDays(host.sim, 3);
    expect(await service.loadFrom('slot2')).toBe(true);
    expect(host.sim.getTick()).toBe(saved.tick);
    await service.remove('slot2');
    expect(service.slots.get().find((s) => s.slot === 'slot2')?.status).toBe('empty');
  });

  it('loads paused, and no time passes until the player resumes', async () => {
    const { host, service } = setup();
    host.sim.applyCommand({ type: 'set-speed', speed: 3 });
    await service.saveTo('slot1');
    await service.loadFrom('slot1');
    expect(host.replaced.at(-1)?.paused).toBe(true);
    expect(host.sim.getSpeed()).toBe(0);
    expect(host.sim.snapshot().economy).toBeDefined();
  });

  it('continues from the autosave on startup, paused; otherwise starts a new game with an app-made seed', async () => {
    const provider = new MemorySaveProvider();
    const empty = await startupSimulation(new SaveSlots(provider), () => 4242);
    expect(empty).toMatchObject({ paused: false, note: null });
    expect(empty.sim.snapshot().seed).toBe(4242);
    expect(empty.sim.getSpeed()).toBe(1);

    const { service } = setup(populatedTown(), provider);
    await service.autosave();
    const resumed = await startupSimulation(new SaveSlots(provider), () => 1);
    expect(resumed.paused).toBe(true);
    expect(resumed.sim.getTick()).toBeGreaterThan(0);
    expect(resumed.note?.kind).toBe('info');

    provider.data.set('autosave', { format: 'the-city-life', version: 99 });
    const broken = await startupSimulation(new SaveSlots(provider), () => 5);
    expect(broken).toMatchObject({ paused: false, note: { kind: 'error' } });
    expect(broken.sim.snapshot().seed).toBe(5);
  });

  it(`autosaves every ${AUTOSAVE_EVERY_DAYS} game days at 00:00, never at tick 0`, async () => {
    expect([0, 24, 96, 119].map(isAutosaveTick)).toEqual([false, false, false, false]);
    expect([120, 240].map(isAutosaveTick)).toEqual([true, true]);
    const { service, provider } = setup();
    service.onTick(96);
    await flush();
    expect(provider.data.has('autosave')).toBe(false);
    service.onTick(120);
    await flush();
    expect(provider.data.has('autosave')).toBe(true);
  });

  it('autosaves the current city before loading a manual slot, but not before loading the autosave itself', async () => {
    const { host, service, provider } = setup();
    await service.saveTo('slot1');
    runDays(host.sim, 2);
    const progressed = host.sim.getTick();
    await service.loadFrom('slot1');
    expect((provider.data.get('autosave') as { state: { tick: number } }).state.tick).toBe(progressed);

    runDays(host.sim, 1);
    await service.loadFrom('autosave');
    expect(host.sim.getTick()).toBe(progressed);
  });

  it('starts new games at 1× with a given or app-generated seed, autosaving first', async () => {
    const { host, service, provider } = setup();
    expect(await service.newGame()).toBe(777);
    expect(host.replaced.at(-1)?.paused).toBe(false);
    expect(host.sim.getSpeed()).toBe(1);
    expect(host.sim.snapshot().seed).toBe(777);
    expect(provider.data.has('autosave')).toBe(true);
    await service.newGame(12345);
    expect(host.sim.snapshot().seed).toBe(12345);
  });

  it('never touches the running game when a save is rejected', async () => {
    const { host, service, provider } = setup();
    provider.data.set('slot3', { format: 'the-city-life', version: 1, meta: { name: 'x', savedAt: NOW }, state: { width: -1 } });
    const before = host.sim.exportState();
    expect(await service.loadFrom('slot3')).toBe(false);
    expect(host.replaced).toHaveLength(0);
    expect(host.sim.exportState()).toEqual(before);
    expect(service.status.get()?.kind).toBe('error');
    expect(service.slots.get().find((s) => s.slot === 'slot3')?.status).toBe('error');
  });

  it('reports storage errors and unavailable storage without stopping the game', async () => {
    const failing = new MemorySaveProvider();
    failing.failWrites = 'QuotaExceededError';
    const { service } = setup(populatedTown(), failing);
    expect(await service.saveTo('slot1')).toBe(false);
    expect(service.status.get()).toEqual({ kind: 'error', text: 'Save failed: QuotaExceededError' });

    const { service: offline, host } = setup(new Simulation(9), new MemorySaveProvider(false));
    await offline.refresh();
    expect(offline.available.get()).toBe(false);
    expect(await offline.saveTo('slot1')).toBe(false);
    expect(offline.status.get()?.text).toBe("Saving isn't available in this browser.");
    expect(await offline.autosave()).toBe(false);
    runDays(host.sim, 1);
    expect(host.sim.getTick()).toBe(24);
  });

  it('starts a new game (and keeps saving off) when storage is unavailable or never answers', async () => {
    const offline = await startupSimulation(new SaveSlots(new MemorySaveProvider(false)), () => 31);
    expect(offline).toMatchObject({ paused: false, note: { kind: 'error' } });
    expect(offline.sim.snapshot().seed).toBe(31);

    vi.useFakeTimers();
    try {
      const hanging = new IndexedDbSaveProvider();
      // Simulate IndexedDB that never answers: the probe must give up after STORAGE_TIMEOUT_MS.
      vi.stubGlobal('indexedDB', { open: () => ({}) });
      const pending = hanging.available();
      await vi.advanceTimersByTimeAsync(STORAGE_TIMEOUT_MS);
      expect(await pending).toBe(false);
      await expect(hanging.write('autosave', {} as never)).rejects.toThrow("Saving isn't available");
    } finally {
      vi.unstubAllGlobals();
      vi.useRealTimers();
    }
  });

  it('autosaves shortly after player changes (debounced), so the autosave tracks the city being played', async () => {
    vi.useFakeTimers();
    try {
      const { host, service, provider } = setup();
      service.requestAutosave();
      runDays(host.sim, 1);
      service.requestAutosave();
      await vi.advanceTimersByTimeAsync(AUTOSAVE_AFTER_CHANGE_MS - 1);
      expect(provider.data.has('autosave')).toBe(false);
      await vi.advanceTimersByTimeAsync(1);
      expect((provider.data.get('autosave') as { state: { tick: number } }).state.tick).toBe(host.sim.getTick());
      runDays(host.sim, 1);
      service.requestAutosave(0);
      await vi.advanceTimersByTimeAsync(0);
      expect((provider.data.get('autosave') as { state: { tick: number } }).state.tick).toBe(host.sim.getTick());
    } finally {
      vi.useRealTimers();
    }
  });
});
