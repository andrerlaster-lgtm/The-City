import { BALANCE } from '../../data/balance';
import type { BuildingInstance } from '../buildings/buildings';
import type { WorldMap } from '../world/World';
import type { Citizen } from './citizens';
import { emptyCitizen, ensureCitizenOrder } from './citizens';
import { connectedHomes, connectedHousingCapacity, assignHomeless } from './housing';
import { anyFreeHousingInWellCoverage } from '../services/coverage';

export interface MigrationSummary { arrived: number; left: { hunger: number; unemployment: number; homeless: number } }

export function migrate(
  citizens: Citizen[], buildings: readonly BuildingInstance[], world: Readonly<WorldMap>, wells: readonly BuildingInstance[], distances: Int32Array,
  treasury: number, openJobs: number, food: number, nextCitizenId: number,
): { nextCitizenId: number; summary: MigrationSummary } {
  ensureCitizenOrder(citizens);
  const left: MigrationSummary['left'] = { hunger: 0, unemployment: 0, homeless: 0 };
  const byId = new Map(buildings.map((building) => [building.id, building]));
  const survivors: Citizen[] = [];
  for (const citizen of citizens) {
    const home = byId.get(citizen.home);
    if (home?.connected) citizen.homelessDays = 0;
    else citizen.homelessDays++;
    let reason: keyof typeof left | null = null;
    if (citizen.hungryDays >= BALANCE.citizens.hungryDaysBeforeLeaving) reason = 'hunger';
    else if (citizen.unemployedDays >= BALANCE.citizens.unemployedDaysBeforeLeaving) reason = 'unemployment';
    else if (citizen.homelessDays >= BALANCE.citizens.homelessDaysBeforeLeaving) reason = 'homeless';
    if (reason) left[reason]++;
    else survivors.push(citizen);
  }
  citizens.length = 0;
  for (const survivor of survivors) citizens.push(survivor);

  assignHomeless(citizens, buildings, world, wells, distances);
  const capacity = connectedHousingCapacity(buildings, citizens);
  const housedFree = capacity.free;
  const hasUnemployed = citizens.some((citizen) => citizen.job === 0);
  const jobsPull = openJobs > 0 ? Math.min(openJobs, 3) : hasUnemployed ? 0 : 1;
  const wellPull = anyFreeHousingInWellCoverage(connectedHomes(buildings), wells, capacity.occupancy, capacity.capacities) ? 1 : 0;
  const foodPenalty = food === 0 && citizens.length > 0 ? 1 : 0;
  const arrivals = treasury <= 0 || housedFree <= 0
    ? 0
    : Math.min(housedFree, BALANCE.citizens.maxArrivalsPerDay, Math.max(0, jobsPull + wellPull - foodPenalty));
  for (let i = 0; i < arrivals; i++) citizens.push(emptyCitizen(nextCitizenId++));
  assignHomeless(citizens, buildings, world, wells, distances);
  return { nextCitizenId, summary: { arrived: arrivals, left } };
}
