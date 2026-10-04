/**
 * Composition root: wires the simulation, renderer and UI together.
 * The UI subscribes to snapshots through subscribe/getSnapshot
 * (shaped for React's useSyncExternalStore).
 */
import { Renderer } from '../render/Renderer';
import { Simulation, type SimSnapshot } from '../sim/Simulation';

export class Game {
  readonly sim: Simulation;
  readonly renderer = new Renderer();
  private snapshot: SimSnapshot;
  private listeners = new Set<() => void>();

  constructor(seed: number) {
    this.sim = new Simulation(seed);
    this.snapshot = this.sim.snapshot();
  }

  async start(canvasHost: HTMLElement): Promise<void> {
    await this.renderer.init(canvasHost);
  }

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  getSnapshot = (): SimSnapshot => this.snapshot;

  /** Call after the simulation changes so the UI re-reads it. */
  protected publish(): void {
    this.snapshot = this.sim.snapshot();
    for (const listener of this.listeners) listener();
  }
}
