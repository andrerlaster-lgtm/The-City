/**
 * Composition root: wires the simulation, renderer, input and UI together.
 * The UI reads state through Stores (useSyncExternalStore-shaped).
 */
import { attachKeyboardPan } from '../input/keyboardPan';
import { attachHover, attachTileDrag } from '../input/pointer';
import { Renderer } from '../render/Renderer';
import { Simulation, type SimSnapshot } from '../sim/Simulation';
import type { RoadPreview } from '../sim/roads';
import type { TileCoord } from '../core/types';
import { TERRAIN, TerrainId, TreeKind } from '../data/terrain';
import { terrainAt, treeAt } from '../sim/world/World';
import { inBounds, screenToTile } from '../core/grid';
import { Store } from './store';

/** What the UI shows about the tile under the cursor. */
export interface HoverInfo {
  tile: TileCoord;
  terrain: string;
  wooded: boolean;
}

export type Tool = 'road' | 'demolish';

/** What the toolbar shows while a stroke is being dragged. */
export type ToolPreview = ({ kind: 'road' } & RoadPreview) | { kind: 'demolish'; removable: number };

export class Game {
  readonly sim: Simulation;
  readonly renderer = new Renderer();
  readonly snapshot: Store<SimSnapshot>;
  readonly hover = new Store<HoverInfo | null>(null);
  readonly tool = new Store<Tool | null>(null);
  readonly toolPreview = new Store<ToolPreview | null>(null);
  private detachTools: (() => void) | null = null;

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
    this.detachTools = attachTileDrag(camera, (x, y) => {
      const p = this.renderer.screenToMap(x, y); const tile = screenToTile(p.x, p.y);
      return inBounds(tile.x, tile.y, world.width, world.height) ? tile : null;
    }, world.width, world.height, (tiles) => this.preview(tiles), (tiles) => this.commit(tiles));
  }

  setTool(tool: Tool | null): void {
    this.tool.set(tool);
    this.toolPreview.set(null);
    this.renderer.setToolActive(tool !== null);
  }

  private preview(tiles: TileCoord[] | null): void {
    const tool = this.tool.get();
    if (!tool || !tiles) { this.toolPreview.set(null); return; }
    this.toolPreview.set(tool === 'road'
      ? { kind: 'road', ...this.sim.previewRoads(tiles) }
      : { kind: 'demolish', ...this.sim.previewDemolish(tiles) });
  }

  private commit(tiles: TileCoord[]): void {
    const tool = this.tool.get();
    if (!tool) return;
    const result = this.sim.applyCommand({ type: tool === 'road' ? 'place-roads' : 'demolish', tiles });
    this.renderer.refreshTiles(this.sim.getWorld(), result.changedTiles);
    this.publish();
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

  destroy(): void { this.detachTools?.(); this.renderer.destroy(); }
}
