/**
 * What one building produces per day, using the same rules as the daily step:
 * only workers living in a connected home count, and only at a connected building.
 */
import type { EntityId } from '../../core/types';
import { BALANCE } from '../../data/balance';
import { buildingDefinition } from '../../data/buildings';
import type { BuildingInstance } from '../buildings/buildings';
import type { Citizen } from '../citizens/citizens';

export interface BuildingProduction {
  /** Workers who count toward output today. */
  workers: number;
  food: number;
  revenue: number;
}

export function productionOf(id: EntityId, buildings: readonly BuildingInstance[], citizens: readonly Citizen[]): BuildingProduction {
  const building = buildings.find((item) => item.id === id);
  const produces = building ? buildingDefinition(building.defId)?.produces ?? null : null;
  if (!building?.connected || !produces) return { workers: 0, food: 0, revenue: 0 };
  const connectedHomes = new Set(buildings.filter((item) => item.connected).map((item) => item.id));
  let workers = 0;
  for (const citizen of citizens) if (citizen.job === id && connectedHomes.has(citizen.home)) workers++;
  return {
    workers,
    food: produces === 'food' ? workers * BALANCE.citizens.foodPerFarmWorker : 0,
    revenue: produces === 'revenue' ? workers * BALANCE.economy.workshopRevenuePerWorker : 0,
  };
}
