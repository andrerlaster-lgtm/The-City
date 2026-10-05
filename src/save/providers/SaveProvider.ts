import type { SaveFile, SlotId } from '../format';

/** Where saves live. Values are returned as unknown: callers must validate them. */
export interface SaveProvider {
  /** False when the browser can't store saves (for example some private windows). */
  available(): Promise<boolean>;
  read(slot: SlotId): Promise<unknown>;
  write(slot: SlotId, save: SaveFile): Promise<void>;
  remove(slot: SlotId): Promise<void>;
}
