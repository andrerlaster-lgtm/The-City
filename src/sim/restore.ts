/**
 * Rebuilds the state that is derived from saved data — road connectivity, the
 * building occupancy layer and each building's access flags — so a loaded game
 * can never carry these out of sync. Pure and deterministic.
 */
import { toIndex } from '../core/grid';
import { buildingDefinition } from '../data/buildings';
import { refreshBuildingAccess, type BuildingInstance } from './buildings/buildings';
import { refreshRoadConnectivity } from './roads';
import type { WorldMap } from './world/World';

export function restoreDerived(world: WorldMap, buildings: BuildingInstance[]): void {
  world.buildingAt.fill(0);
  for (const building of buildings) {
    const size = buildingDefinition(building.defId)?.size ?? 1;
    for (let dy = 0; dy < size; dy++) for (let dx = 0; dx < size; dx++) {
      world.buildingAt[toIndex(building.x + dx, building.y + dy, world.width)] = building.id;
    }
  }
  refreshRoadConnectivity(world);
  refreshBuildingAccess(world, buildings);
}
