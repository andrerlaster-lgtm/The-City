/**
 * The versioned save format. A save is plain, structured-cloneable data: typed
 * arrays for map layers, id-sorted arrays for buildings and citizens. Derived data
 * (road connectivity, building occupancy, access flags) is never stored.
 */
import type { BuildingId } from '../data/buildings';
import type { Citizen } from '../sim/citizens/citizens';
import type { DailyReport, Ledger } from '../sim/economy/economy';

export const SAVE_FORMAT = 'the-city-life';
export const SAVE_VERSION = 1;

export type SlotId = 'autosave' | 'slot1' | 'slot2' | 'slot3';
export const MANUAL_SLOTS: readonly SlotId[] = ['slot1', 'slot2', 'slot3'];
export const ALL_SLOTS: readonly SlotId[] = ['autosave', ...MANUAL_SLOTS];

/** Shown in the menu only; never read back into the simulation. */
export interface SaveMeta {
  name: string;
  /** Real-world ISO time, added by the app. */
  savedAt: string;
  seed: number;
  /** 1-based game day. */
  day: number;
  population: number;
  treasury: number;
}

export interface SavedBuilding { id: number; defId: BuildingId; x: number; y: number }

export interface SerializedState {
  width: number;
  height: number;
  entranceIndex: number;
  terrain: Uint8Array;
  variant: Uint8Array;
  trees: Uint8Array;
  roads: Uint8Array;
  seed: number;
  rngState: number;
  tick: number;
  treasury: number;
  food: number;
  speed: 0 | 1 | 2 | 3;
  economy: { today: Ledger; lastDay: DailyReport | null };
  nextEntityId: number;
  nextCitizenId: number;
  buildings: SavedBuilding[];
  citizens: Citizen[];
}

export interface SaveFile {
  format: typeof SAVE_FORMAT;
  version: number;
  meta: SaveMeta;
  state: SerializedState;
}
