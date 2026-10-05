import { buildingDefinition } from '../../data/buildings';
import { BALANCE } from '../../data/balance';
import type { BuildingInstance } from '../buildings/buildings';
import type { WorldMap } from '../world/World';

export interface Ledger {
  construction: number;
  upkeepBuildings: number;
  upkeepRoads: number;
  taxes: number;
}

export interface DailyReport extends Ledger {
  day: number;
  /** Whole-day treasury change: taxes − upkeep − construction. */
  net: number;
  treasuryAfter: number;
}

export interface DailyProjection { income: number; expenses: number; net: number }

export function emptyLedger(): Ledger {
  return { construction: 0, upkeepBuildings: 0, upkeepRoads: 0, taxes: 0 };
}

/** Tax rates are defined now for M5; M4 has no residents or employed citizens. */
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

export function projectedDaily(buildings: readonly BuildingInstance[], world: Readonly<WorldMap>, residents = 0, employed = 0): DailyProjection {
  const income = taxesFor(residents, employed);
  const expenses = buildingUpkeep(buildings) + roadUpkeep(world);
  return { income, expenses, net: income - expenses };
}

export function closeDay(today: Ledger, day: number, treasury: number, buildings: readonly BuildingInstance[], world: Readonly<WorldMap>): { report: DailyReport; treasury: number } {
  const upkeepBuildings = buildingUpkeep(buildings);
  const upkeepRoads = roadUpkeep(world);
  const taxes = taxesFor(0, 0);
  // Construction was already charged when it happened; only taxes and upkeep move the treasury now.
  const nextTreasury = treasury + taxes - upkeepBuildings - upkeepRoads;
  const net = taxes - upkeepBuildings - upkeepRoads - today.construction;
  const report: DailyReport = { day, ...today, taxes, upkeepBuildings, upkeepRoads, net, treasuryAfter: nextTreasury };
  return { report, treasury: nextTreasury };
}
