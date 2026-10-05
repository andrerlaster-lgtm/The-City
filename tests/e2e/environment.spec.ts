import { expect, test } from './fixtures';

/** Step 1 of the M7 plan: prove this machine's browser can run the game (WebGL, IndexedDB, timers). */
test('the browser supports WebGL, IndexedDB and timers', async ({ page }) => {
  await page.goto('/');
  const result = await page.evaluate(async () => {
    const canvas = document.createElement('canvas');
    const webgl = Boolean(canvas.getContext('webgl2') ?? canvas.getContext('webgl'));
    const timer = await new Promise<boolean>((resolve) => setTimeout(() => resolve(true), 50));
    const idb = await new Promise<boolean>((resolve) => {
      const request = indexedDB.open('e2e-probe');
      request.onupgradeneeded = () => request.result.createObjectStore('s');
      request.onsuccess = () => { request.result.close(); resolve(true); };
      request.onerror = () => resolve(false);
      setTimeout(() => resolve(false), 10_000); // a busy machine can be slow to open IndexedDB
    });
    return { webgl, timer, idb };
  });
  expect(result).toEqual({ webgl: true, timer: true, idb: true });
});
