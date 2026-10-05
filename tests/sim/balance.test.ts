/**
 * M7 balance pass: scripted towns run for 60 days against the plan's targets. The report
 * is logged so balance changes (BALANCE values only) can be compared run to run.
 */
import { describe, expect, it } from 'vitest';
import type { BuildingId } from '../../src/data/buildings';
import type { Simulation } from '../../src/sim/Simulation';
import { createFlatScene, runDays } from '../helpers/scene';

type Day = { day: number; population: number; treasury: number; food: number; foodChange: number; net: number; left: number };

function town(buildings: [BuildingId, number, number][]): Simulation {
  const sim = createFlatScene(1, 64, 24);
  const e = sim.getWorld().entranceIndex % sim.getWorld().width;
  sim.applyCommand({ type: 'place-roads', tiles: Array.from({ length: 30 }, (_, i) => ({ x: e + i, y: 1 })) });
  for (const [defId, dx, y] of buildings) {
    const result = sim.applyCommand({ type: 'place-building', defId, x: e + dx, y });
    if (!result.ok) throw new Error(`${defId}: ${result.reason}`);
  }
  return sim;
}

function run(label: string, sim: Simulation, days = 60): Day[] {
  const log: Day[] = [];
  for (let day = 1; day <= days; day++) {
    runDays(sim, 1);
    const s = sim.snapshot(); const last = s.economy.lastDay!;
    const left = last.migration.left.hunger + last.migration.left.unemployment + last.migration.left.homeless;
    log.push({ day, population: s.population, treasury: s.treasury, food: s.food, foodChange: s.foodChange, net: last.net + last.construction, left });
  }
  const pick = log.filter((d) => [1, 5, 10, 20, 30, 60].includes(d.day));
  console.info(`[balance] ${label}\n${pick.map((d) => `  day ${d.day}: pop ${d.population}, treasury ${d.treasury}, net ${d.net}/day, food ${d.food} (${d.foodChange}/day)`).join('\n')}`);
  return log;
}

describe('Stage 1 balance targets', () => {
  it('a starter town (3 Cottages, 1 Farm, 1 Workshop) turns profitable within 10 days and never runs dry', () => {
    const log = run('starter', town([['cottage', 2, 2], ['cottage', 4, 2], ['cottage', 6, 2], ['farm', 10, 3], ['workshop', 14, 2]]));
    expect(log.find((d) => d.day === 10)!.net).toBeGreaterThan(0);
    expect(Math.min(...log.map((d) => d.treasury))).toBeGreaterThan(0);
    // Population levels off: no change over the last 20 days.
    expect(new Set(log.slice(-20).map((d) => d.population)).size).toBe(1);
  });

  it('a town of only houses slowly loses money', () => {
    const log = run('houses only', town([['cottage', 2, 2], ['cottage', 4, 2], ['cottage', 6, 2], ['cottage', 8, 2]]));
    expect(log.at(-1)!.net).toBeLessThan(0);
    expect(log.at(-1)!.treasury).toBeLessThan(log[0]!.treasury);
    expect(log.at(-1)!.treasury).toBeGreaterThan(0);
  });

  it('one full Farm feeds about a dozen citizens', () => {
    const log = run('one farm, 12 citizens', town([['cottage', 2, 2], ['cottage', 4, 2], ['cottage', 6, 2], ['farm', 10, 3], ['workshop', 14, 2]]));
    const settled = log.at(-1)!;
    expect(settled.population).toBe(12);
    expect(settled.foodChange).toBeGreaterThanOrEqual(0);
  });

  it('a town that outgrows its farms shows a food deficit and loses some people, without collapsing', () => {
    const log = run('two farms, ~30 citizens', town([
      ['well', 1, 2], ['cottage', 2, 2], ['cottage', 4, 2], ['cottage', 6, 2], ['cottage', 8, 2], ['rowhouse', 9, 2],
      ['farm', 13, 3], ['farm', 17, 3], ['workshop', 21, 2], ['workshop', 24, 2],
    ]));
    const late = log.slice(-20);
    expect(late.some((d) => d.foodChange < 0)).toBe(true);
    expect(Math.min(...late.map((d) => d.population))).toBeGreaterThan(20);
    expect(log.at(-1)!.treasury).toBeGreaterThan(log[0]!.treasury);
  });
});
