/**
 * App-side save orchestration: startup continue, autosave, slot actions and
 * new-game seeds. Seeds come from the browser's crypto RNG here, never from the
 * simulation, which only ever receives a finished seed.
 */
import { BALANCE } from '../data/balance';
import type { SlotId } from '../save/format';
import { SLOT_LABELS, type SaveSlots, type SlotSummary } from '../save/slots';
import { Simulation } from '../sim/Simulation';
import { Store } from './store';

export const AUTOSAVE_EVERY_DAYS = 5;
/** Quiet time after a player change (build, demolish) before the autosave is written. */
export const AUTOSAVE_AFTER_CHANGE_MS = 1000;

/** What the save service needs from the running game. */
export interface GameHost {
  readonly sim: Simulation;
  /** Swaps in another simulation; `paused` forces speed 0 so no time passes until the player resumes. */
  replaceSimulation(sim: Simulation, options: { paused: boolean }): void;
}

export interface SaveStatus { kind: 'info' | 'error'; text: string }

/** A uint32 seed from the browser's cryptographic RNG. */
export function randomSeed(): number {
  return crypto.getRandomValues(new Uint32Array(1))[0]!;
}

/** True at 00:00 of every AUTOSAVE_EVERY_DAYS-th day (never at tick 0). */
export function isAutosaveTick(tick: number): boolean {
  const period = BALANCE.time.ticksPerDay * AUTOSAVE_EVERY_DAYS;
  return tick > 0 && tick % period === 0;
}

/**
 * The simulation to start with: the autosave (paused) when it loads cleanly,
 * otherwise a new game at 1× with a fresh seed, plus a note when the autosave was unusable.
 */
export async function startupSimulation(slots: SaveSlots, makeSeed: () => number = randomSeed): Promise<{ sim: Simulation; paused: boolean; note: SaveStatus | null }> {
  if (!(await slots.available())) {
    return { sim: new Simulation(makeSeed()), paused: false, note: { kind: 'error', text: "Saved games can't be reached in this browser, so a new game started and saving is off." } };
  }
  const loaded = await slots.load('autosave');
  if (loaded.ok) return { sim: Simulation.fromState(loaded.state), paused: true, note: { kind: 'info', text: `Continued from autosave (day ${loaded.meta.day}). Paused — press 1×, 2× or 3× to resume.` } };
  if (!loaded.reason.endsWith('is empty.')) {
    return { sim: new Simulation(makeSeed()), paused: false, note: { kind: 'error', text: `Autosave couldn't be loaded (${loaded.reason}) Started a new game.` } };
  }
  return { sim: new Simulation(makeSeed()), paused: false, note: null };
}

export class SaveService {
  readonly slots = new Store<SlotSummary[]>([]);
  readonly status = new Store<SaveStatus | null>(null);
  readonly available = new Store<boolean | null>(null);
  private lastAutosaveTick = -1;
  private pendingAutosave: ReturnType<typeof setTimeout> | null = null;

  constructor(
    private readonly host: GameHost,
    private readonly saves: SaveSlots,
    private readonly now: () => string = () => new Date().toISOString(),
    private readonly makeSeed: () => number = randomSeed,
  ) {}

  async refresh(): Promise<void> {
    const available = await this.saves.available();
    this.available.set(available);
    this.slots.set(available ? await this.saves.list() : []);
  }

  async saveTo(slot: SlotId): Promise<boolean> {
    if (!(await this.ensureAvailable())) return false;
    const result = await this.saves.save(slot, this.host.sim.exportState(), this.now());
    this.report(result.ok ? { kind: 'info', text: `Saved to ${SLOT_LABELS[slot]}.` } : { kind: 'error', text: `Save failed: ${result.reason}` });
    await this.refresh();
    return result.ok;
  }

  /** Loads a slot, paused. The current city is autosaved first, unless the autosave itself is being loaded. */
  async loadFrom(slot: SlotId): Promise<boolean> {
    if (!(await this.ensureAvailable())) return false;
    if (slot !== 'autosave') await this.autosave();
    const loaded = await this.saves.load(slot);
    if (!loaded.ok) { this.report({ kind: 'error', text: `Can't load ${SLOT_LABELS[slot]}: ${loaded.reason}` }); await this.refresh(); return false; }
    try {
      this.host.replaceSimulation(Simulation.fromState(loaded.state), { paused: true });
    } catch (error) {
      this.report({ kind: 'error', text: `Can't load ${SLOT_LABELS[slot]}: ${error instanceof Error ? error.message : 'unknown error'}` });
      return false;
    }
    this.lastAutosaveTick = loaded.state.tick;
    this.report({ kind: 'info', text: `Loaded ${SLOT_LABELS[slot]} (day ${loaded.meta.day}). Paused — press 1×, 2× or 3× to resume.` });
    await this.refresh();
    return true;
  }

  /** Starts a new game at 1× with the given seed or a fresh random one. The current city is autosaved first. */
  async newGame(seed?: number): Promise<number> {
    await this.autosave();
    const chosen = seed ?? this.makeSeed();
    this.host.replaceSimulation(new Simulation(chosen), { paused: false });
    this.lastAutosaveTick = 0;
    this.report({ kind: 'info', text: `New game started with seed ${chosen}.` });
    await this.refresh();
    return chosen;
  }

  async remove(slot: SlotId): Promise<void> {
    const result = await this.saves.remove(slot);
    this.report(result.ok ? { kind: 'info', text: `Deleted ${SLOT_LABELS[slot]}.` } : { kind: 'error', text: `Delete failed: ${'reason' in result ? result.reason : ''}` });
    await this.refresh();
  }

  /** Writes the autosave slot. Quietly does nothing when saving isn't available. */
  async autosave(): Promise<boolean> {
    if (!(await this.saves.available())) return false;
    const result = await this.saves.save('autosave', this.host.sim.exportState(), this.now());
    if (!result.ok) this.report({ kind: 'error', text: `Autosave failed: ${result.reason}` });
    return result.ok;
  }

  /**
   * Autosaves soon after the player changes the city, so the autosave tracks the city
   * being played. The tab-hidden autosave alone isn't enough: a write started while
   * the page unloads is often lost (found by the M7 Playwright reload test).
   * `delayMs` 0 writes at once (used when pausing); otherwise changes are debounced.
   */
  requestAutosave(delayMs = AUTOSAVE_AFTER_CHANGE_MS): void {
    if (this.pendingAutosave !== null) clearTimeout(this.pendingAutosave);
    this.pendingAutosave = setTimeout(() => {
      this.pendingAutosave = null;
      void this.autosave();
    }, delayMs);
  }

  /** Call after every simulation tick; autosaves every AUTOSAVE_EVERY_DAYS game days. */
  onTick(tick: number): void {
    if (!isAutosaveTick(tick) || tick === this.lastAutosaveTick) return;
    this.lastAutosaveTick = tick;
    void this.autosave().then(async (ok) => { if (ok) await this.refresh(); });
  }

  /** Autosaves whenever the tab is hidden (switching tabs, minimising, closing). */
  attachVisibility(doc: Document): () => void {
    const listener = () => { if (doc.visibilityState === 'hidden') void this.autosave(); };
    doc.addEventListener('visibilitychange', listener);
    return () => doc.removeEventListener('visibilitychange', listener);
  }

  private async ensureAvailable(): Promise<boolean> {
    if (await this.saves.available()) return true;
    this.report({ kind: 'error', text: "Saving isn't available in this browser." });
    return false;
  }

  private report(status: SaveStatus): void { this.status.set(status); }
}
