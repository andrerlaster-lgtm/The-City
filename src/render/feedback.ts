/**
 * What a placement or road change says over the map (LF-4, see docs/LOOK-AND-FEEL-IDEAS.md).
 * Pure, no Pixi: the text and its tone come from data the sim already exposes, so the
 * feedback always matches the rules the game actually uses.
 */
import { buildingDefinition } from '../data/buildings';
import type { BuildingInstance } from '../sim/buildings/buildings';
import { isCovered } from '../sim/services/coverage';

export type FeedbackTone = 'good' | 'info' | 'warn';
export interface Feedback { text: string; tone: FeedbackTone }

/** A freshly placed building: what it adds to the city. */
export function placementFeedback(placed: BuildingInstance, buildings: readonly BuildingInstance[]): Feedback | null {
  const definition = buildingDefinition(placed.defId);
  if (!definition) return null;
  const water = definition.services.find((service) => service.kind === 'water');
  if (water) {
    const homes = buildings.filter((b) => b.id !== placed.id && b.connected && (buildingDefinition(b.defId)?.housing ?? 0) > 0 && isCovered('water', b, [placed])).length;
    return homes > 0 ? { text: `Water for ${homes} ${homes === 1 ? 'home' : 'homes'}`, tone: 'info' } : { text: 'No homes nearby', tone: 'warn' };
  }
  if (definition.housing > 0) return { text: `+${definition.housing} homes`, tone: 'good' };
  if (definition.jobs > 0) return { text: `+${definition.jobs} jobs`, tone: 'good' };
  return null;
}

/**
 * Buildings whose road connection flipped after a road change. `before` holds who was
 * connected beforehand; newly placed buildings are left out (their own feedback covers them).
 */
export function connectionFeedback(changedIds: readonly number[], before: ReadonlyMap<number, boolean>, buildings: readonly BuildingInstance[]): { id: number; feedback: Feedback }[] {
  const byId = new Map(buildings.map((b) => [b.id, b]));
  const result: { id: number; feedback: Feedback }[] = [];
  for (const id of new Set(changedIds)) {
    const now = byId.get(id);
    const was = before.get(id);
    if (!now || was === undefined || was === now.connected) continue;
    result.push({ id, feedback: now.connected ? { text: 'Connected', tone: 'good' } : { text: 'Cut off', tone: 'warn' } });
  }
  return result;
}
