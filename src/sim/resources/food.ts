import { BALANCE } from '../../data/balance';
import { buildingDefinition } from '../../data/buildings';
import type { BuildingInstance } from '../buildings/buildings';
import type { Citizen } from '../citizens/citizens';
import { ensureCitizenOrder } from '../citizens/citizens';

export function produceFood(buildings: readonly BuildingInstance[], citizens: readonly Citizen[]): number {
  const byId = new Map(buildings.map((building) => [building.id, building]));
  const workers = new Map<number, number>();
  for (const citizen of citizens) if (citizen.job > 0 && byId.get(citizen.home)?.connected && byId.get(citizen.job)?.connected) workers.set(citizen.job, (workers.get(citizen.job) ?? 0) + 1);
  let produced = 0;
  for (const building of buildings) {
    if (!building.connected || buildingDefinition(building.defId)?.produces !== 'food') continue;
    produced += (workers.get(building.id) ?? 0) * BALANCE.citizens.foodPerFarmWorker;
  }
  return produced;
}

/** Feeds in citizen-id order; each unfed citizen gains one hungry day. */
export function consumeFood(food: number, citizens: Citizen[]): { food: number; eaten: number } {
  ensureCitizenOrder(citizens);
  let remaining = food;
  let eaten = 0;
  for (const citizen of citizens) {
    if (remaining >= BALANCE.citizens.foodPerCitizen) {
      remaining -= BALANCE.citizens.foodPerCitizen;
      eaten += BALANCE.citizens.foodPerCitizen;
      citizen.hungryDays = 0;
    } else citizen.hungryDays++;
  }
  return { food: remaining, eaten };
}

/** Workers at connected buildings whose definition produces food (Farm today). */
export function farmWorkers(buildings: readonly BuildingInstance[], citizens: readonly Citizen[]): number {
  return countConnectedWorkers('food', buildings, citizens);
}

export function foodChangePerDay(buildings: readonly BuildingInstance[], citizens: readonly Citizen[]): number {
  return farmWorkers(buildings, citizens) * BALANCE.citizens.foodPerFarmWorker - citizens.length * BALANCE.citizens.foodPerCitizen;
}

function countConnectedWorkers(produces: 'food', buildings: readonly BuildingInstance[], citizens: readonly Citizen[]): number {
  const connected = new Set(buildings.filter((building) => building.connected && buildingDefinition(building.defId)?.produces === produces).map((building) => building.id));
  let count = 0;
  const byId = new Map(buildings.map((building) => [building.id, building]));
  for (const citizen of citizens) if (connected.has(citizen.job) && byId.get(citizen.home)?.connected) count++;
  return count;
}
