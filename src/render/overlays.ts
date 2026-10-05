/**
 * Map overlays as data: which tiles to tint, and how. Pure (no Pixi), so it is unit-tested.
 * Every overlay is derived from simulation state; the simulation never knows about it.
 */
import { buildingDefinition } from '../data/buildings';
import type { BuildingInstance } from '../sim/buildings/buildings';
import type { WorldMap } from '../sim/world/World';

export type OverlayKind = 'none' | 'water' | 'roads';
export const OVERLAY_ORDER: readonly OverlayKind[] = ['none', 'water', 'roads'];

/** Per-tile tint category. 0 = untinted. */
export const Tint = { None: 0, Good: 1, Warn: 2, Bad: 3 } as const;
export type Tint = (typeof Tint)[keyof typeof Tint];

export interface OverlayLegend { label: string; entries: { tint: Tint; text: string }[] }

export const OVERLAY_LEGENDS: Record<Exclude<OverlayKind, 'none'>, OverlayLegend> = {
  water: { label: 'Water coverage', entries: [{ tint: Tint.Good, text: 'Covered by a staffed Well' }] },
  roads: {
    label: 'Road connectivity',
    entries: [
      { tint: Tint.Good, text: 'Road reaches the Entrance' },
      { tint: Tint.Warn, text: 'Disconnected road or building' },
      { tint: Tint.Bad, text: 'Building with no road access' },
    ],
  },
};

/** Tile categories for `kind`. `water` is the simulation's per-tile water coverage map. */
export function overlayTints(kind: OverlayKind, world: Readonly<WorldMap>, buildings: readonly BuildingInstance[], water: Readonly<Uint8Array> | null): Uint8Array {
  const tints = new Uint8Array(world.width * world.height);
  if (kind === 'water' && water) {
    for (let i = 0; i < tints.length; i++) if (water[i] === 1) tints[i] = Tint.Good;
  } else if (kind === 'roads') {
    for (let i = 0; i < tints.length; i++) if (world.roads[i] === 1) tints[i] = world.roadConnected[i] === 1 ? Tint.Good : Tint.Warn;
    for (const building of buildings) {
      if (building.connected) continue;
      const size = buildingDefinition(building.defId)?.size ?? 1;
      const tint = building.roadAccess ? Tint.Warn : Tint.Bad;
      for (let dy = 0; dy < size; dy++) for (let dx = 0; dx < size; dx++) tints[(building.y + dy) * world.width + building.x + dx] = tint;
    }
  }
  return tints;
}
