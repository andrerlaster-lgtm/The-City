/**
 * S2-M1: the optimised job matcher must give exactly the same assignments as the Stage 1
 * per-home BFS matcher (kept verbatim in tests/sim/reference/jobsStage1.ts).
 */
import { describe, expect, it } from 'vitest';
import { Rng } from '../../src/core/rng';
import { toIndex } from '../../src/core/grid';
import type { BuildingId } from '../../src/data/buildings';
import { TerrainId } from '../../src/data/terrain';
import type { BuildingInstance } from '../../src/sim/buildings/buildings';
import type { Citizen } from '../../src/sim/citizens/citizens';
import { assignJobs } from '../../src/sim/citizens/jobs';
import { Simulation } from '../../src/sim/Simulation';
import type { WorldMap } from '../../src/sim/world/World';
import { createEmptyWorld } from '../../src/sim/world/World';
import { placeSettlementEntrance } from '../../src/sim/roads';
import { assignJobs as assignJobsStage1 } from './reference/jobsStage1';
import { createConnectedTown, runDays } from '../helpers/scene';

interface Case { world: Readonly<WorldMap>; buildings: BuildingInstance[]; citizens: Citizen[] }

function compare({ world, buildings, citizens }: Case): void {
  const a = citizens.map((c) => ({ ...c }));
  const b = citizens.map((c) => ({ ...c }));
  assignJobsStage1(a, buildings, world);
  assignJobs(b, buildings, world);
  expect(b).toEqual(a);
}

/** A random but valid city: road grid with gaps (so some parts disconnect), random buildings, mixed citizens. */
function randomCity(seed: number): Case {
  const rng = new Rng(seed);
  const size = 48;
  const world = createEmptyWorld(size, size);
  world.terrain.fill(TerrainId.Grass);
  placeSettlementEntrance(world);
  const sim = new Simulation(seed, world, 10_000_000);
  const step = 4 + rng.int(0, 2);
  for (let y = 1; y < size; y += step) sim.applyCommand({ type: 'place-roads', tiles: Array.from({ length: size }, (_, x) => ({ x, y })) });
  for (let x = rng.int(2, 8); x < size; x += 6 + rng.int(0, 6)) sim.applyCommand({ type: 'place-roads', tiles: Array.from({ length: size - 1 }, (_, i) => ({ x, y: i + 1 })) });
  sim.applyCommand({ type: 'place-roads', tiles: Array.from({ length: size - 1 }, (_, i) => ({ x: Math.floor(size / 2), y: i + 1 })) });
  const kinds: BuildingId[] = ['cottage', 'rowhouse', 'workshop', 'farm', 'well', 'cottage', 'workshop'];
  for (let i = 0; i < 260; i++) {
    sim.applyCommand({ type: 'place-building', defId: kinds[rng.int(0, kinds.length - 1)]!, x: rng.int(0, size - 1), y: rng.int(0, size - 1) });
  }
  // Cut a few roads so some homes and workplaces become disconnected.
  for (let i = 0; i < 6; i++) sim.applyCommand({ type: 'demolish', tiles: [{ x: rng.int(0, size - 1), y: 1 + step * rng.int(0, 5) }] });
  const state = sim.exportState();
  const homes = state.buildings.filter((b) => b.defId === 'cottage' || b.defId === 'rowhouse');
  const workplaces = state.buildings.filter((b) => b.defId === 'workshop' || b.defId === 'farm' || b.defId === 'well');
  const citizens: Citizen[] = [];
  let id = 1;
  for (const home of homes) {
    const cap = home.defId === 'rowhouse' ? 16 : 4;
    for (let k = rng.int(0, cap); k > 0; k--) {
      const employed = workplaces.length > 0 && rng.next() < 0.4;
      citizens.push({ id: id++, home: home.id, job: employed ? workplaces[rng.int(0, workplaces.length - 1)]!.id : 0, hungryDays: 0, unemployedDays: rng.int(0, 3), homelessDays: 0 });
    }
  }
  // A few homeless citizens too.
  for (let k = 0; k < 5; k++) citizens.push({ id: id++, home: 0, job: 0, hungryDays: 0, unemployedDays: 0, homelessDays: 1 });
  return { world: state.world, buildings: state.buildings, citizens };
}

describe('optimised job matching is identical to the Stage 1 matcher', () => {
  for (let seed = 1; seed <= 40; seed++) {
    it(`random city, seed ${seed}`, () => compare(randomCity(seed)));
  }

  it('a played-out Stage 1 starter town, with everyone made unemployed', () => {
    const sim = createConnectedTown();
    runDays(sim, 15);
    const state = sim.exportState();
    compare({ world: state.world, buildings: state.buildings, citizens: state.citizens.map((c) => ({ ...c, job: 0 })) });
  });

  it('the far-jobs worst case (2,000 unemployed, workplaces at the far edge)', () => {
    const world = createEmptyWorld(128, 128);
    world.entranceIndex = toIndex(0, 0, 128);
    const road = (x: number, y: number) => { const i = toIndex(x, y, 128); world.roads[i] = world.roadConnected[i] = 1; };
    for (let y = 0; y < 128; y++) road(0, y);
    for (const y of [...Array.from({ length: 16 }, (_, r) => r * 7 + 1), 113, 120]) for (let x = 0; x < 128; x++) road(x, y);
    const homes: BuildingInstance[] = Array.from({ length: 125 }, (_, i) => ({ id: i + 1, defId: 'rowhouse', x: 5 + (i % 8) * 15, y: 2 + Math.floor(i / 8) * 7, roadAccess: true, connected: true }));
    const bands = [111, 114, 118, 121];
    const workplaces: BuildingInstance[] = Array.from({ length: 250 }, (_, i) => ({ id: i + 126, defId: 'workshop', x: 1 + 2 * (i % 63), y: bands[Math.floor(i / 63)]!, roadAccess: true, connected: true }));
    const citizens: Citizen[] = Array.from({ length: 2000 }, (_, i) => ({ id: i + 1, home: Math.floor(i / 16) + 1, job: 0, hungryDays: 0, unemployedDays: 0, homelessDays: 0 }));
    compare({ world, buildings: [...homes, ...workplaces], citizens });
  });
});
