/**
 * Slot operations over any SaveProvider: list, save, load, delete. Pure apart from
 * the provider, so it runs in tests with the memory provider. Never touches a
 * running game: loading returns a fresh GameState for the caller to adopt.
 */
import type { GameState } from '../sim/state';
import { ALL_SLOTS, type SaveMeta, type SlotId } from './format';
import type { SaveProvider } from './providers/SaveProvider';
import { createSaveFile, deserializeState } from './serialize';
import { readSave } from './validate';

export type SlotSummary =
  | { slot: SlotId; status: 'empty' }
  | { slot: SlotId; status: 'ok'; meta: SaveMeta }
  | { slot: SlotId; status: 'error'; reason: string };

export type SlotLoad = { ok: true; state: GameState; meta: SaveMeta } | { ok: false; reason: string };
export type SlotWrite = { ok: true; meta: SaveMeta } | { ok: false; reason: string };

export const SLOT_LABELS: Readonly<Record<SlotId, string>> = { autosave: 'Autosave', slot1: 'Slot 1', slot2: 'Slot 2', slot3: 'Slot 3' };

export class SaveSlots {
  constructor(private readonly provider: SaveProvider) {}

  available(): Promise<boolean> { return this.provider.available(); }

  async list(): Promise<SlotSummary[]> {
    const result: SlotSummary[] = [];
    for (const slot of ALL_SLOTS) {
      try {
        const data = await this.provider.read(slot);
        if (data === undefined) { result.push({ slot, status: 'empty' }); continue; }
        const read = readSave(data);
        result.push(read.ok ? { slot, status: 'ok', meta: read.file.meta } : { slot, status: 'error', reason: read.reason });
      } catch (error) {
        result.push({ slot, status: 'error', reason: messageOf(error) });
      }
    }
    return result;
  }

  async save(slot: SlotId, state: GameState, savedAt: string): Promise<SlotWrite> {
    const file = createSaveFile(state, SLOT_LABELS[slot], savedAt);
    try {
      await this.provider.write(slot, file);
      return { ok: true, meta: file.meta };
    } catch (error) {
      return { ok: false, reason: messageOf(error) };
    }
  }

  async load(slot: SlotId): Promise<SlotLoad> {
    try {
      const data = await this.provider.read(slot);
      if (data === undefined) return { ok: false, reason: `${SLOT_LABELS[slot]} is empty.` };
      const read = readSave(data);
      if (!read.ok) return read;
      return { ok: true, state: deserializeState(read.file.state), meta: read.file.meta };
    } catch (error) {
      return { ok: false, reason: messageOf(error) };
    }
  }

  async remove(slot: SlotId): Promise<SlotWrite | { ok: true }> {
    try {
      await this.provider.remove(slot);
      return { ok: true };
    } catch (error) {
      return { ok: false, reason: messageOf(error) };
    }
  }
}

function messageOf(error: unknown): string {
  return error instanceof Error && error.message ? error.message : 'Storage error.';
}
