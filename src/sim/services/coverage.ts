import { buildingDefinition } from '../../data/buildings';
import type { BuildingInstance } from '../buildings/buildings';
import type { Citizen } from '../citizens/citizens';

/**
 * Service buildings (any definition with a serviceRadius — the Well today) that are
 * connected and staffed. A service with jobs needs at least one worker living in a
 * connected home; one with no jobs needs none.
 */
export function staffedWells(buildings: readonly BuildingInstance[], citizens: readonly Citizen[]): BuildingInstance[] {
  const workers = new Map<number, number>();
  const byId = new Map(buildings.map((building) => [building.id, building]));
  for (const citizen of citizens) if (citizen.job > 0 && byId.get(citizen.home)?.connected) workers.set(citizen.job, (workers.get(citizen.job) ?? 0) + 1);
  return buildings.filter((building) => {
    const definition = buildingDefinition(building.defId);
    if (!definition || definition.serviceRadius <= 0 || !building.connected) return false;
    return definition.jobs === 0 || (workers.get(building.id) ?? 0) > 0;
  });
}

/** Covered when the home's footprint centre is within the service's radius of its footprint centre. */
export function wellCovers(home: BuildingInstance, wells: readonly BuildingInstance[]): boolean {
  const homeCentre = centreOf(home);
  for (const well of wells) {
    const radius = buildingDefinition(well.defId)?.serviceRadius ?? 0;
    const wellCentre = centreOf(well);
    const dx = homeCentre.x - wellCentre.x;
    const dy = homeCentre.y - wellCentre.y;
    if (dx * dx + dy * dy <= radius * radius) return true;
  }
  return false;
}

export function anyFreeHousingInWellCoverage(homes: readonly BuildingInstance[], wells: readonly BuildingInstance[], occupancy: ReadonlyMap<number, number>, capacities: ReadonlyMap<number, number>): boolean {
  if (wells.length === 0) return false;
  return homes.some((home) => home.connected && (occupancy.get(home.id) ?? 0) < (capacities.get(home.id) ?? 0) && wellCovers(home, wells));
}

function centreOf(building: BuildingInstance): { x: number; y: number } {
  const half = ((buildingDefinition(building.defId)?.size ?? 1) - 1) / 2;
  return { x: building.x + half, y: building.y + half };
}
