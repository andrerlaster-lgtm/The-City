import type { SaveFile, SlotId } from '../format';
import type { SaveProvider } from './SaveProvider';

/**
 * In-memory provider for tests. Stores structured clones, like IndexedDB, so a
 * stored save never aliases the live game.
 */
export class MemorySaveProvider implements SaveProvider {
  readonly data = new Map<SlotId, unknown>();
  /** Set to make every write fail, to test storage errors. */
  failWrites: string | null = null;

  constructor(private readonly isAvailable = true) {}

  async available(): Promise<boolean> { return this.isAvailable; }
  async read(slot: SlotId): Promise<unknown> { return this.data.has(slot) ? structuredClone(this.data.get(slot)) : undefined; }
  async write(slot: SlotId, save: SaveFile): Promise<void> {
    if (this.failWrites) throw new Error(this.failWrites);
    this.data.set(slot, structuredClone(save));
  }
  async remove(slot: SlotId): Promise<void> { this.data.delete(slot); }
}
