/**
 * Composition root: wires the simulation, renderer, input and UI together.
 * The UI reads state through Stores (useSyncExternalStore-shaped).
 */
import { attachKeyboardPan } from '../input/keyboardPan';
import { attachHover } from '../input/pointer';
import { Renderer } from '../render/Renderer';
import { Simulation, type SimSnapshot } from '../sim/Simulation';
import type { TileCoord } from '../core/types';
import { TERRAIN, TerrainId, TreeKind } from '../data/terrain';
import { terrainAt, treeAt } from '../sim/world/World';
import { Store } from './store';

/** What the UI shows about the tile under the cursor. */
export interface HoverInfo {
  tile: TileCoord;
  terrain: string;
  wooded: boolean;
}

export class Game {
  readonly sim: Simulation;
  readonly renderer = new Renderer();
  readonly snapshot: Store<SimSnapshot>;
  readonly hover = new Store<HoverInfo | null>(null);

  constructor(seed: number) {
    this.sim = new Simulation(seed);
    this.snapshot = new Store(this.sim.snapshot());
  }

  async start(canvasHost: HTMLElement): Promise<void> {
    await this.renderer.init(canvasHost);
    const world = this.sim.getWorld();
    const camera = this.renderer.showWorld(world);
    attachKeyboardPan(camera, this.renderer.app.ticker);
    attachHover(camera, this.renderer.app.canvas, this.renderer.screenToMap, world.width, world.height, (tile) => this.onHover(tile));
  }

  private onHover(tile: TileCoord | null): void {
    this.renderer.setHoveredTile(tile);
    if (!tile) {
      this.hover.set(null);
      return;
    }
    const world = this.sim.getWorld();
    const terrain = terrainAt(world, tile.x, tile.y) ?? TerrainId.Grass;
    this.hover.set({
      tile,
      terrain: TERRAIN[terrain].name,
      wooded: treeAt(world, tile.x, tile.y) !== TreeKind.None,
    });
  }

  /** Call after the simulation changes so the UI re-reads it. */
  publish(): void {
    this.snapshot.set(this.sim.snapshot());
  }
}
