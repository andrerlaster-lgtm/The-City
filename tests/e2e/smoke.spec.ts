import { expect, test } from './fixtures';
import { hourText, hoverTile, newGame, openGame, planStarterTown, SEED, setSpeed, topStat, trackErrors, treasury } from './helpers';

test('boots with no console errors and shows the city status', async ({ page }) => {
  const errors = trackErrors(page);
  await openGame(page);
  await expect(page.locator('.treasury-stat .stat__value')).toContainText('5,000');
  await expect(page.locator('.clock__date')).toContainText('Year 1');
  await newGame(page);
  const { entrance } = planStarterTown();
  await hoverTile(page, entrance);
  await expect(page.locator('.tile-info__terrain')).toHaveText('Settlement entrance');
  expect(errors).toEqual([]);
});

test('the clock runs at 1×, stops when paused and runs faster at 3×', async ({ page }) => {
  await openGame(page);
  await newGame(page);
  const start = await hourText(page);
  await expect.poll(() => hourText(page), { timeout: 5_000 }).not.toBe(start);
  await page.locator('body').press('Space');
  await expect(page.locator('.top-bar__speed')).toHaveText('⏸');
  const paused = await hourText(page);
  await page.waitForTimeout(1_500);
  expect(await hourText(page)).toBe(paused);
  await setSpeed(page, '3×');
  await expect(page.locator('.top-bar__speed')).toHaveText('3×');
  await expect.poll(() => hourText(page), { timeout: 3_000 }).not.toBe(paused);
});

test('builds a starter town: roads cost money, citizens arrive and the Farm makes food', async ({ page }) => {
  test.setTimeout(90_000);
  const errors = trackErrors(page);
  await openGame(page);
  await newGame(page);
  await setSpeed(page, '⏸');
  const plan = planStarterTown();
  const before = await treasury(page);

  await page.getByRole('button', { name: 'Road', exact: true }).click();
  const from = await hoverTile(page, plan.road[0]!);
  const to = await hoverTile(page, plan.road.at(-1)!);
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  await page.mouse.move(to.x, to.y, { steps: 12 });
  await page.mouse.up();
  await expect.poll(() => treasury(page)).toBe(before - plan.road.length * 10);

  for (const { defId, at } of plan.buildings) {
    const name = defId[0]!.toUpperCase() + defId.slice(1);
    await page.getByRole('button', { name: new RegExp(`^${name}`) }).click();
    const point = await hoverTile(page, at);
    await page.mouse.click(point.x, point.y);
  }
  await expect.poll(() => treasury(page)).toBe(before - plan.road.length * 10 - 100 - 250 - 300);
  await page.keyboard.press('Escape');

  await setSpeed(page, '3×');
  await expect.poll(() => topStat(page, 'Population'), { timeout: 40_000 }).toBeGreaterThan(0);
  const farm = plan.buildings.find((b) => b.defId === 'farm')!;
  await expect.poll(async () => {
    const point = await hoverTile(page, farm.at);
    await page.mouse.click(point.x, point.y);
    return (await page.locator('.info-panel').textContent()) ?? '';
  }, { timeout: 40_000 }).toMatch(/\+\d+ food \/ day/);
  expect(errors).toEqual([]);
});

test('saves, then continues paused after a reload with the same seed', async ({ page }) => {
  await openGame(page);
  await newGame(page);
  await page.waitForTimeout(1_200);
  await setSpeed(page, '⏸'); // pausing autosaves at once
  const date = await page.locator('.clock__date').textContent();
  const hour = await hourText(page);
  await page.getByRole('button', { name: /Open game menu/ }).click();
  await page.locator('.save-slot', { hasText: 'Slot 1' }).getByRole('button', { name: 'Save' }).click();
  await expect(page.locator('.save-slot', { hasText: 'Slot 1' })).toContainText(`seed ${SEED}`);
  await page.getByRole('button', { name: 'Close menu' }).click();
  await page.waitForTimeout(500); // let the pause autosave finish writing, as any real user would

  await page.reload();
  await expect(page.getByRole('button', { name: /Open game menu/ })).toBeVisible({ timeout: 20_000 });
  await expect(page.locator('.top-bar__speed')).toHaveText('⏸');
  await expect(page.locator('.clock__date')).toHaveText(date ?? '');
  expect(await hourText(page)).toBe(hour);
  await page.waitForTimeout(1_200);
  expect(await hourText(page)).toBe(hour);
  await page.getByRole('button', { name: /Open game menu/ }).click();
  await expect(page.locator('.save-menu__seed')).toHaveText(String(SEED));
});

test('a new game with a typed seed shows that seed and runs at 1×', async ({ page }) => {
  await openGame(page);
  await newGame(page, 4_242_424);
  await expect(page.locator('.top-bar__speed')).toHaveText('1×');
  await page.getByRole('button', { name: /Open game menu/ }).click();
  await expect(page.locator('.save-menu__seed')).toHaveText('4242424');
});

test('at 400 px wide the Food stat stays on one line and nothing overflows sideways', async ({ page }) => {
  await page.setViewportSize({ width: 400, height: 800 });
  await openGame(page);
  const food = page.locator('.top-bar .stat', { hasText: 'Food' }).locator('.stat__value').first();
  const box = await food.boundingBox();
  const lineHeight = await food.evaluate((el) => parseFloat(getComputedStyle(el).lineHeight) || parseFloat(getComputedStyle(el).fontSize) * 1.3);
  expect(box!.height).toBeLessThanOrEqual(lineHeight * 1.5);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});

test('with reduced motion, panels and toasts do not animate', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await openGame(page);
  await page.getByRole('button', { name: 'Open economy breakdown' }).click();
  const reduced = await page.locator('.economy-panel').evaluate((el) => parseFloat(getComputedStyle(el).animationDuration));
  expect(reduced).toBeLessThan(0.001);

  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.getByRole('button', { name: 'Close economy' }).click();
  await page.getByRole('button', { name: 'Open economy breakdown' }).click();
  const normal = await page.locator('.economy-panel').evaluate((el) => parseFloat(getComputedStyle(el).animationDuration));
  expect(normal).toBeGreaterThan(0.1);
});

test('a failed action shows an error toast that closes on its own', async ({ page }) => {
  await openGame(page);
  await newGame(page);
  await setSpeed(page, '⏸');
  const { entrance, road } = planStarterTown();
  const away = { x: entrance.x + (road[1]!.x - entrance.x) * 6 + 4, y: entrance.y + (road[1]!.y - entrance.y) * 6 + 4 };
  await page.getByRole('button', { name: /^Cottage/ }).click();
  const point = await hoverTile(page, away);
  await page.mouse.click(point.x, point.y);
  const toast = page.locator('.toast--error', { hasText: 'Needs road access' });
  await expect(toast).toBeVisible();
  await expect(toast).toBeHidden({ timeout: 9_000 });
});

test('the hover chip drops a demolished building at once, without moving the mouse', async ({ page }) => {
  await openGame(page);
  await newGame(page);
  await setSpeed(page, '⏸');
  const plan = planStarterTown();
  await page.getByRole('button', { name: 'Road', exact: true }).click();
  const from = await hoverTile(page, plan.road[0]!);
  const to = await hoverTile(page, plan.road.at(-1)!);
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  await page.mouse.move(to.x, to.y, { steps: 12 });
  await page.mouse.up();
  const cottage = plan.buildings.find((b) => b.defId === 'cottage')!;
  await page.getByRole('button', { name: /^Cottage/ }).click();
  const point = await hoverTile(page, cottage.at);
  await page.mouse.click(point.x, point.y);
  await expect(page.locator('.tile-info__terrain')).toHaveText('Cottage');

  await page.getByRole('button', { name: 'Demolish', exact: true }).click();
  await page.mouse.move(point.x, point.y);
  await page.mouse.down();
  await page.mouse.up(); // click in place: the pointer never moves after this
  await expect(page.locator('.tile-info__terrain')).not.toHaveText('Cottage');
  await expect(page.locator('.tile-info__terrain')).toHaveText(/^(Grass|Sand)$/);
});
