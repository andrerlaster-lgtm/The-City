/**
 * Owns the Pixi application. Reads simulation snapshots and tick results;
 * never mutates simulation state.
 */
import { Application } from 'pixi.js';
import { PALETTE } from './palette';

export class Renderer {
  readonly app = new Application();

  async init(host: HTMLElement): Promise<void> {
    await this.app.init({
      resizeTo: host,
      background: PALETTE.void,
      antialias: true,
      autoDensity: true,
      resolution: Math.min(window.devicePixelRatio || 1, 2),
    });
    host.appendChild(this.app.canvas);
  }

  destroy(): void {
    this.app.destroy(true, { children: true });
  }
}
