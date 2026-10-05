import type { EntityId } from '../../core/types';
import { buildingDefinition } from '../../data/buildings';
import type { BuildingInstance } from '../buildings/buildings';

export interface Citizen {
  id: EntityId;
  /** Zero means no assigned home. Disconnected homes remain assigned. */
  home: EntityId;
  job: EntityId;
  hungryDays: number;
  unemployedDays: number;
  homelessDays: number;
}

export interface BuildingOccupancy { residents: number; workers: number }
export interface CitizenCounts {
  population: number;
  residents: number;
  employed: number;
  unemployed: number;
  hungry: number;
  homeless: number;
}

export function emptyCitizen(id: EntityId): Citizen {
  return { id, home: 0, job: 0, hungryDays: 0, unemployedDays: 0, homelessDays: 0 };
}

/** State keeps citizens sorted; only sort helper inputs that break that invariant. */
export function ensureCitizenOrder(citizens: Citizen[]): void {
  for (let i = 1; i < citizens.length; i++) {
    if (citizens[i - 1]!.id > citizens[i]!.id) {
      citizens.sort((a, b) => a.id - b.id);
      return;
    }
  }
}

/** Clear assignments to buildings removed by a player command immediately. */
export function clearDemolishedAssignments(citizens: Citizen[], removed: ReadonlySet<EntityId>): void {
  for (const citizen of citizens) {
    if (removed.has(citizen.home)) {
      citizen.home = 0;
      citizen.job = 0;
    } else if (removed.has(citizen.job)) citizen.job = 0;
  }
}

export function occupancyFor(buildingId: EntityId, citizens: readonly Citizen[]): BuildingOccupancy {
  let residents = 0;
  let workers = 0;
  for (const citizen of citizens) {
    if (citizen.home === buildingId) residents++;
    if (citizen.job === buildingId) workers++;
  }
  return { residents, workers };
}

export function citizenCounts(citizens: readonly Citizen[], buildings: readonly BuildingInstance[]): CitizenCounts {
  const byId = new Map(buildings.map((building) => [building.id, building]));
  let residents = 0;
  let employed = 0;
  let unemployed = 0;
  let hungry = 0;
  let homeless = 0;
  for (const citizen of citizens) {
    const home = byId.get(citizen.home);
    const job = byId.get(citizen.job);
    if (!home?.connected) homeless++;
    else residents++;
    if (home?.connected && job?.connected) employed++;
    else unemployed++;
    if (citizen.hungryDays > 0) hungry++;
  }
  return { population: citizens.length, residents, employed, unemployed, hungry, homeless };
}

export function capacityOf(building: BuildingInstance): { housing: number; jobs: number } {
  const definition = buildingDefinition(building.defId);
  return { housing: definition?.housing ?? 0, jobs: definition?.jobs ?? 0 };
}
