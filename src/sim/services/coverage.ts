/**
 * Service coverage. A service building (any definition with `services`) is active when it's
 * connected and, if it has jobs, has at least one worker living in a connected home.
 *
 * Gameplay decisions use `isCovered`: a building is covered when its footprint centre is
 * within the service's radius of the service building's footprint centre (the Stage 1
 * Well rule, unchanged). `coverageMap` turns the same rule into a per-tile map, for overlays
 * and later systems — never for the Stage 1 decisions.
 */
import { buildingDefinition, type ServiceKind } from '../../data/buildings';
import type { BuildingInstance } from '../buildings/buildings';
import type { Citizen } from '../citizens/citizens';
import type { WorldMap } from '../world/World';

/** Radius of `kind` this building provides, or 0. */
export function serviceRadius(building: BuildingInstance, kind: ServiceKind): number {
  return buildingDefinition(building.defId)?.services.find((service) => service.kind === kind)?.radius ?? 0;
}

/** Active (connected and staffed) buildings providing `kind`. */
export function activeServices(buildings: readonly BuildingInstance[], citizens: readonly Citizen[], kind: ServiceKind): BuildingInstance[] {
  const workers = new Map<number, number>();
  const byId = new Map(buildings.map((building) => [building.id, building]));
  for (const citizen of citizens) if (citizen.job > 0 && byId.get(citizen.home)?.connected) workers.set(citizen.job, (workers.get(citizen.job) ?? 0) + 1);
  return buildings.filter((building) => {
    const definition = buildingDefinition(building.defId);
    if (!definition || !building.connected || serviceRadius(building, kind) <= 0) return false;
    return definition.jobs === 0 || (workers.get(building.id) ?? 0) > 0;
  });
}

/** True when `building`'s footprint centre is within the `kind` radius of any source's centre. */
export function isCovered(kind: ServiceKind, building: BuildingInstance, sources: readonly BuildingInstance[]): boolean {
  const centre = centreOf(building);
  for (const source of sources) {
    const radius = serviceRadius(source, kind);
    const sourceCentre = centreOf(source);
    const dx = centre.x - sourceCentre.x;
    const dy = centre.y - sourceCentre.y;
    if (dx * dx + dy * dy <= radius * radius) return true;
  }
  return false;
}

/** Per-tile coverage (1 = covered) using the same distance rule, from each tile's centre. */
export function coverageMap(kind: ServiceKind, sources: readonly BuildingInstance[], world: Readonly<WorldMap>): Uint8Array {
  const map = new Uint8Array(world.width * world.height);
  for (const source of sources) {
    const radius = serviceRadius(source, kind);
    const c = centreOf(source);
    const minX = Math.max(0, Math.ceil(c.x - radius)); const maxX = Math.min(world.width - 1, Math.floor(c.x + radius));
    const minY = Math.max(0, Math.ceil(c.y - radius)); const maxY = Math.min(world.height - 1, Math.floor(c.y + radius));
    for (let y = minY; y <= maxY; y++) for (let x = minX; x <= maxX; x++) {
      const dx = x - c.x; const dy = y - c.y;
      if (dx * dx + dy * dy <= radius * radius) map[y * world.width + x] = 1;
    }
  }
  return map;
}

/** Water sources in service today (the Well in Stage 1). */
export function staffedWells(buildings: readonly BuildingInstance[], citizens: readonly Citizen[]): BuildingInstance[] {
  return activeServices(buildings, citizens, 'water');
}

/** Stage 1 name for water coverage of a home. */
export function wellCovers(home: BuildingInstance, wells: readonly BuildingInstance[]): boolean {
  return isCovered('water', home, wells);
}

export function anyFreeHousingInWellCoverage(homes: readonly BuildingInstance[], wells: readonly BuildingInstance[], occupancy: ReadonlyMap<number, number>, capacities: ReadonlyMap<number, number>): boolean {
  if (wells.length === 0) return false;
  return homes.some((home) => home.connected && (occupancy.get(home.id) ?? 0) < (capacities.get(home.id) ?? 0) && wellCovers(home, wells));
}

function centreOf(building: BuildingInstance): { x: number; y: number } {
  const half = ((buildingDefinition(building.defId)?.size ?? 1) - 1) / 2;
  return { x: building.x + half, y: building.y + half };
}
