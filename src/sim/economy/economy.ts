import { buildingDefinition } from '../../data/buildings';
import { BALANCE } from '../../data/balance';
import type { BuildingInstance } from '../buildings/buildings';
import type { WorldMap } from '../world/World';
import type { Citizen } from '../citizens/citizens';
import { citizenCounts } from '../citizens/citizens';
import type { MigrationSummary } from '../citizens/migration';
import { connectedOpenJobs } from '../citizens/jobs';
import { connectedHousingCapacity } from '../citizens/housing';

export interface Ledger {
  construction: number;
  upkeepBuildings: number;
  upkeepRoads: number;
  taxes: number;
  taxesResidents: number;
  taxesEmployed: number;
  revenue: number;
  foodProduced: number;
  foodEaten: number;
  migration: MigrationSummary;
}

export interface DailyReport extends Ledger {
  day: number;
  /** Whole-day treasury change: taxes − upkeep − construction. */
  net: number;
  treasuryAfter: number;
}

export interface DailyProjection {
  income: number;
  expenses: number;
  net: number;
  taxesResidents: number;
  taxesEmployed: number;
  revenue: number;
  upkeepBuildings: number;
  upkeepRoads: number;
}

export function emptyLedger(): Ledger {
  return { construction: 0, upkeepBuildings: 0, upkeepRoads: 0, taxes: 0, taxesResidents: 0, taxesEmployed: 0, revenue: 0, foodProduced: 0, foodEaten: 0, migration: { arrived: 0, left: { hunger: 0, unemployment: 0, homeless: 0 } } };
}

/** Calculates the approved resident and employment tax amounts. */
export function taxesFor(residents: number, employed: number): number {
  return residents * BALANCE.economy.taxPerResident + employed * BALANCE.economy.taxPerEmployed;
}

export function buildingUpkeep(buildings: readonly BuildingInstance[]): number {
  return buildings.reduce((total, building) => total + (buildingDefinition(building.defId)?.upkeep ?? 0), 0);
}

export function roadUpkeep(world: Readonly<WorldMap>): number {
  let count = 0;
  for (let i = 0; i < world.roads.length; i++) if (world.roads[i] && i !== world.entranceIndex) count++;
  return Math.round(count * BALANCE.economy.roadUpkeepPerTile);
}

export function projectedDaily(buildings: readonly BuildingInstance[], world: Readonly<WorldMap>, citizens: readonly Citizen[] = []): DailyProjection {
  const counts = citizenCounts(citizens, buildings);
  const taxesResidents = counts.residents * BALANCE.economy.taxPerResident;
  const taxesEmployed = counts.employed * BALANCE.economy.taxPerEmployed;
  const revenue = workshopRevenue(buildings, citizens);
  const upkeepBuildings = buildingUpkeep(buildings);
  const upkeepRoads = roadUpkeep(world);
  const income = taxesResidents + taxesEmployed + revenue;
  const expenses = upkeepBuildings + upkeepRoads;
  return { income, expenses, net: income - expenses, taxesResidents, taxesEmployed, revenue, upkeepBuildings, upkeepRoads };
}

/** Revenue from workers at connected buildings whose definition produces revenue (Workshop today). */
export function workshopRevenue(buildings: readonly BuildingInstance[], citizens: readonly Citizen[]): number {
  const byId = new Map(buildings.map((building) => [building.id, building]));
  let workers = 0;
  for (const citizen of citizens) {
    const home = byId.get(citizen.home);
    const workplace = byId.get(citizen.job);
    if (home?.connected && workplace?.connected && buildingDefinition(workplace.defId)?.produces === 'revenue') workers++;
  }
  return workers * BALANCE.economy.workshopRevenuePerWorker;
}

export function closeDay(today: Ledger, day: number, treasury: number, buildings: readonly BuildingInstance[], world: Readonly<WorldMap>, citizens: readonly Citizen[], foodProduced: number, foodEaten: number, migration: MigrationSummary): { report: DailyReport; treasury: number } {
  const upkeepBuildings = buildingUpkeep(buildings);
  const upkeepRoads = roadUpkeep(world);
  const counts = citizenCounts(citizens, buildings);
  const taxesResidents = counts.residents * BALANCE.economy.taxPerResident;
  const taxesEmployed = counts.employed * BALANCE.economy.taxPerEmployed;
  const taxes = taxesResidents + taxesEmployed;
  const revenue = workshopRevenue(buildings, citizens);
  // Construction is charged at command time; only income and upkeep move treasury here.
  const nextTreasury = treasury + taxes + revenue - upkeepBuildings - upkeepRoads;
  const net = taxes + revenue - upkeepBuildings - upkeepRoads - today.construction;
  const report: DailyReport = { day, ...today, taxes, taxesResidents, taxesEmployed, revenue, upkeepBuildings, upkeepRoads, foodProduced, foodEaten, migration, net, treasuryAfter: nextTreasury };
  return { report, treasury: nextTreasury };
}

export function cityCapacity(buildings: readonly BuildingInstance[], citizens: readonly Citizen[]): { freeHousing: number; freeJobs: number } {
  return { freeHousing: connectedHousingCapacity(buildings, citizens).free, freeJobs: connectedOpenJobs(buildings, citizens) };
}
