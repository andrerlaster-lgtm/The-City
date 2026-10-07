/**
 * How full each building looks (LF-3, see docs/LOOK-AND-FEEL-IDEAS.md). Pure, no Pixi:
 * residents over capacity for homes, workers over jobs for workplaces. Read from the
 * sim's public copies once per day, so the renderer never touches citizens per frame.
 */
import { buildingDefinition } from '../data/buildings';
import type { BuildingInstance } from '../sim/buildings/buildings';
import type { Citizen } from '../sim/citizens/citizens';

/** Building id → 0 (empty) … 1 (full). Buildings without homes or jobs are left out. */
export function occupancyRatios(buildings: readonly BuildingInstance[], citizens: readonly Citizen[]): Map<number, number> {
  const residents = new Map<number, number>();
  const workers = new Map<number, number>();
  for (const citizen of citizens) {
    if (citizen.home > 0) residents.set(citizen.home, (residents.get(citizen.home) ?? 0) + 1);
    if (citizen.job > 0) workers.set(citizen.job, (workers.get(citizen.job) ?? 0) + 1);
  }
  const result = new Map<number, number>();
  for (const building of buildings) {
    const definition = buildingDefinition(building.defId);
    if (!definition) continue;
    const capacity = definition.housing > 0 ? definition.housing : definition.jobs;
    if (capacity <= 0) continue;
    const people = definition.housing > 0 ? residents.get(building.id) ?? 0 : workers.get(building.id) ?? 0;
    result.set(building.id, Math.min(1, people / capacity));
  }
  return result;
}

/** Evening window brightness for a building: dark when empty, brighter as it fills. */
export function windowGlowFor(glow: number, ratio: number | undefined): number {
  if (ratio === undefined) return glow;
  return ratio <= 0 ? 0 : glow * (0.45 + 0.55 * ratio);
}
