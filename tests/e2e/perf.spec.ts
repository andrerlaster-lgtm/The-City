/**
 * @perf (opt-in): frame times with a full 128×128 city and 2,000 citizens.
 * Run with `npm run test:e2e:perf` (headed, local GPU, one worker). Excluded from the
 * default run. It logs the numbers and asserts only loose limits, because machine load varies.
 *
 * The city is built with the pure simulation, saved through the real save format, written
 * to the autosave slot, and continued on reload, so it goes through the normal load path.
 */
import { expect, test } from './fixtures';
import { setSpeed } from './helpers';
import { createSaveFile } from '../../src/save/serialize';
import { placeSettlementEntrance } from '../../src/sim/roads';
import { Simulation } from '../../src/sim/Simulation';
import { createEmptyWorld } from '../../src/sim/world/World';
import { TerrainId } from '../../src/data/terrain';
import type { Citizen } from '../../src/sim/citizens/citizens';

const SIZE = 128;
const ROAD_EVERY = 5;

/** 125 Rowhouses and 250 Workshops on a road grid; 2,000 citizens, all housed and employed. */
function perfCity() {
  const world = createEmptyWorld(SIZE, SIZE);
  world.terrain.fill(TerrainId.Grass);
  placeSettlementEntrance(world);
  const sim = new Simulation(2026, world, 100_000_000);
  const spine = world.entranceIndex % SIZE;
  sim.applyCommand({ type: 'place-roads', tiles: Array.from({ length: SIZE - 1 }, (_, i) => ({ x: spine, y: i + 1 })) });
  for (let y = 1; y < SIZE; y += ROAD_EVERY) sim.applyCommand({ type: 'place-roads', tiles: Array.from({ length: SIZE }, (_, x) => ({ x, y })) });
  const homes: number[] = [];
  const workplaces: number[] = [];
  for (let y = 2; y < SIZE - 1 && workplaces.length < 250; y += 2) {
    for (let x = 0; x < SIZE - 1 && workplaces.length < 250; x += 2) {
      const defId = homes.length < 125 ? 'rowhouse' : 'workshop';
      const result = sim.applyCommand({ type: 'place-building', defId, x, y });
      if (result.ok) (defId === 'rowhouse' ? homes : workplaces).push(sim.exportState().nextEntityId - 1);
    }
  }
  expect([homes.length, workplaces.length]).toEqual([125, 250]);
  const state = sim.exportState();
  state.citizens = Array.from({ length: 2000 }, (_, i): Citizen => ({ id: i + 1, home: homes[Math.floor(i / 16)]!, job: workplaces[Math.floor(i / 8)]!, hungryDays: 0, unemployedDays: 0, homelessDays: 0 }));
  state.nextCitizenId = 2001;
  state.treasury = 50_000;
  state.food = 100_000;
  return createSaveFile(state, 'Perf city', '2026-10-05T12:00:00.000Z');
}

/** Typed arrays don't survive page.evaluate, so they travel tagged and are rebuilt in the page. */
function pack(value: unknown): unknown {
  if (ArrayBuffer.isView(value)) return { __typed: value.constructor.name, data: Array.from(value as unknown as ArrayLike<number>) };
  if (Array.isArray(value)) return value.map(pack);
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, pack(v)]));
  return value;
}

async function frameStats(page: import('@playwright/test').Page, ms: number) {
  return page.evaluate((duration) => new Promise<{ fps: number; p95: number; over20: number; over33: number; worst: number; frames: number }>((resolve) => {
    const deltas: number[] = [];
    let last = performance.now();
    const start = last;
    const frame = (now: number) => {
      deltas.push(now - last); last = now;
      if (now - start < duration) { requestAnimationFrame(frame); return; }
      const sorted = [...deltas].sort((a, b) => a - b);
      resolve({
        fps: deltas.length / ((now - start) / 1000), p95: sorted[Math.floor(sorted.length * 0.95)]!,
        over20: deltas.filter((d) => d > 20).length, over33: deltas.filter((d) => d > 33).length,
        worst: sorted.at(-1)!, frames: deltas.length,
      });
    };
    requestAnimationFrame(frame);
  }), ms);
}

test('@perf 2,000 citizens on 128×128 hold the frame rate', async ({ page }) => {
  test.setTimeout(120_000);
  const save = pack(perfCity());
  await page.goto('/');
  await page.evaluate((packed) => new Promise<void>((resolve, reject) => {
    const unpack = (value: unknown): unknown => {
      if (Array.isArray(value)) return value.map(unpack);
      if (value && typeof value === 'object') {
        const tagged = value as { __typed?: string; data?: number[] };
        if (tagged.__typed) return new (globalThis as unknown as Record<string, new (data: number[]) => unknown>)[tagged.__typed]!(tagged.data!);
        return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, unpack(v)]));
      }
      return value;
    };
    const open = indexedDB.open('the-city-life');
    open.onupgradeneeded = () => open.result.createObjectStore('saves');
    open.onerror = () => reject(open.error);
    open.onsuccess = () => {
      const tx = open.result.transaction('saves', 'readwrite');
      tx.objectStore('saves').put(unpack(packed), 'autosave');
      tx.oncomplete = () => { open.result.close(); resolve(); };
      tx.onerror = () => reject(tx.error);
    };
  }), save);
  await page.reload();
  await expect(page.getByText(/Continued from autosave/)).toBeVisible({ timeout: 20_000 });
  await expect(page.locator('.stat', { hasText: 'Population' })).toContainText('2,000');

  await page.waitForTimeout(1_000);
  const paused = await frameStats(page, 5_000);
  await setSpeed(page, '3×');
  const running = await frameStats(page, 12_000); // 3 game days at 3×
  await setSpeed(page, '⏸');
  const line = (label: string, s: typeof paused) => `${label}: ${s.fps.toFixed(1)} fps, p95 ${s.p95.toFixed(1)} ms, ${s.over20}/${s.frames} frames > 20 ms, ${s.over33} > 33 ms, worst ${s.worst.toFixed(0)} ms`;
  console.info(`[S2 perf] ${line('paused', paused)} | ${line('3×', running)}`);
  expect(paused.fps).toBeGreaterThanOrEqual(50);
  expect(running.fps).toBeGreaterThanOrEqual(50);
});
