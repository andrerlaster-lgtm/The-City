import type { EntityId, TileCoord } from '../core/types';
import type { BuildingId } from '../data/buildings';

export type PlayerCommand =
  | { type: 'place-roads'; tiles: TileCoord[] }
  | { type: 'place-building'; defId: BuildingId; x: number; y: number }
  | { type: 'demolish'; tiles: TileCoord[] }
  | { type: 'set-speed'; speed: 0 | 1 | 2 | 3 };

export interface CommandResult {
  ok: boolean;
  reason: string | null;
  cost: number;
  changedTiles: TileCoord[];
  changedBuildings: EntityId[];
  treasury: number;
}
