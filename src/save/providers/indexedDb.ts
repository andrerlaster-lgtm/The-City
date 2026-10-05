/** IndexedDB provider via idb-keyval (approved dependency). Typed arrays are stored as-is. */
import { createStore, del, get, set, type UseStore } from 'idb-keyval';
import type { SaveFile, SlotId } from '../format';
import type { SaveProvider } from './SaveProvider';

/** How long to wait for IndexedDB before treating saving as unavailable for this session. */
export const STORAGE_TIMEOUT_MS = 3000;

export class IndexedDbSaveProvider implements SaveProvider {
  private store: UseStore | null = null;
  private probe: Promise<boolean> | null = null;

  /**
   * Probes once per session. Storage that errors *or never answers* (it can hang, for
   * example in some headless or locked-down browsers) counts as unavailable, so the
   * game never waits on it and autosave can't later overwrite a save it couldn't read.
   */
  available(): Promise<boolean> {
    this.probe ??= Promise.race([
      (async () => {
        try {
          this.store = createStore('the-city-life', 'saves');
          await set('__probe__', 1, this.store);
          await del('__probe__', this.store);
          return true;
        } catch {
          return false;
        }
      })(),
      new Promise<boolean>((resolve) => setTimeout(() => resolve(false), STORAGE_TIMEOUT_MS)),
    ]).then((ok) => {
      if (!ok) this.store = null;
      return ok;
    });
    return this.probe;
  }

  async read(slot: SlotId): Promise<unknown> { return get(slot, await this.requireStore()); }
  async write(slot: SlotId, save: SaveFile): Promise<void> { await set(slot, save, await this.requireStore()); }
  async remove(slot: SlotId): Promise<void> { await del(slot, await this.requireStore()); }

  private async requireStore(): Promise<UseStore> {
    if (!(await this.available()) || !this.store) throw new Error("Saving isn't available in this browser.");
    return this.store;
  }
}
