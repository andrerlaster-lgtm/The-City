/**
 * Smoke-test helpers. Tests drive the real UI only (no hooks in the shipped game):
 * the mouse is steered onto tiles by reading the TileInfo chip, and expectations
 * read the DOM. Placements are planned with the pure simulation, which is
 * deterministic for a given seed, so the browser and the plan agree.
 */
import { expect, type Page } from '@playwright/test';
import type { TileCoord } from '../../src/core/types';
import { Simulation } from '../../src/sim/Simulation';

export const SEED = 12345;

/** Collects console errors and page exceptions; assert it's empty at the end of a test. */
export function trackErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on('console', (message) => { if (message.type() === 'error') errors.push(message.text()); });
  page.on('pageerror', (error) => errors.push(error.message));
  return errors;
}

/** Loads the game and waits until the HUD is up. */
export async function openGame(page: Page): Promise<void> {
  await page.goto('/');
  await expect(page.getByRole('button', { name: /Open game menu/ })).toBeVisible({ timeout: 20_000 });
}

/** Starts a new game with a fixed seed through the Menu, then closes it. */
export async function newGame(page: Page, seed = SEED): Promise<void> {
  await page.getByRole('button', { name: /Open game menu/ }).click();
  await page.getByLabel('Seed for the new game (optional)').fill(String(seed));
  await page.locator('.save-menu__new').getByRole('button', { name: 'New game', exact: true }).click();
  await page.getByRole('button', { name: 'Confirm' }).click();
  await expect(page.locator('.save-menu__seed')).toHaveText(String(seed));
  await page.getByRole('button', { name: 'Close menu' }).click();
}

export async function setSpeed(page: Page, speed: '⏸' | '1×' | '2×' | '3×'): Promise<void> {
  await page.getByRole('navigation', { name: 'Game speed' }).getByRole('button', { name: speed }).click();
}

export async function hourText(page: Page): Promise<string> {
  return (await page.locator('.clock__hour').textContent()) ?? '';
}

/** Treasury as a number (the first token of the stat value). */
export async function treasury(page: Page): Promise<number> {
  const text = (await page.locator('.treasury-stat .stat__value').textContent()) ?? '';
  const first = text.trim().split(/\s+/)[0] ?? '';
  const value = Number(first.replace(/[^\d]/g, ''));
  return /^[−-]/.test(first) ? -value : value;
}

export async function topStat(page: Page, label: string): Promise<number> {
  const text = await page.locator('.top-bar .stat', { hasText: label }).locator('.stat__value').first().textContent();
  return Number((text ?? '').split(/\s/)[0]!.replace(/[^\d]/g, ''));
}

/** Moves the mouse until the TileInfo chip reports the target tile; returns the screen point. */
export async function hoverTile(page: Page, target: TileCoord): Promise<{ x: number; y: number }> {
  const viewport = page.viewportSize()!;
  let point = { x: viewport.width / 2, y: viewport.height / 2 + 60 };
  for (let attempt = 0; attempt < 14; attempt++) {
    await page.mouse.move(point.x, point.y);
    const coord = await page.locator('.tile-info__coord').textContent({ timeout: 2_000 }).catch(() => null);
    const match = coord?.match(/(-?\d+),\s*(-?\d+)/);
    if (match) {
      const dx = target.x - Number(match[1]); const dy = target.y - Number(match[2]);
      if (dx === 0 && dy === 0) return point;
      // Isometric projection at zoom 1: one tile in x is (+32, +16) px, in y (−32, +16).
      point = { x: point.x + (dx - dy) * 32, y: point.y + (dx + dy) * 16 };
    } else {
      point = { x: point.x + 20, y: point.y + 20 };
    }
  }
  throw new Error(`Could not reach tile ${target.x},${target.y}`);
}

/** A starter town for the seed: a road inward from the Entrance plus a Cottage, Farm and Workshop beside it. */
export function planStarterTown(seed = SEED) {
  const sim = new Simulation(seed);
  const world = sim.getWorld();
  const entrance = { x: world.entranceIndex % world.width, y: Math.floor(world.entranceIndex / world.width) };
  const inward = entrance.y === 0 ? { x: 0, y: 1 } : entrance.x === world.width - 1 ? { x: -1, y: 0 }
    : entrance.y === world.height - 1 ? { x: 0, y: -1 } : { x: 1, y: 0 };
  const road: TileCoord[] = Array.from({ length: 9 }, (_, i) => ({ x: entrance.x + inward.x * (i + 1), y: entrance.y + inward.y * (i + 1) }));
  const placed = sim.applyCommand({ type: 'place-roads', tiles: road });
  if (!placed.ok) throw new Error(`Seed ${seed}: starter road blocked (${placed.reason})`);
  const buildings: { defId: 'cottage' | 'farm' | 'workshop'; at: TileCoord }[] = [];
  for (const defId of ['cottage', 'farm', 'workshop'] as const) {
    const at = findSpot(sim, defId, road);
    sim.applyCommand({ type: 'place-building', defId, x: at.x, y: at.y });
    buildings.push({ defId, at });
  }
  return { entrance, road, buildings };
}

function findSpot(sim: Simulation, defId: 'cottage' | 'farm' | 'workshop', road: readonly TileCoord[]): TileCoord {
  for (const tile of road) {
    for (let d = 1; d <= 3; d++) {
      for (const [ox, oy] of [[d, 0], [-d, 0], [0, d], [0, -d]] as const) {
        const cursor = { x: tile.x + ox, y: tile.y + oy };
        if (sim.previewBuilding(defId, cursor).ok) return cursor;
      }
    }
  }
  throw new Error(`No spot for ${defId}`);
}
