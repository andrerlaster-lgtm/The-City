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
import { inBounds, screenToTile, toIndex } from '../core/grid';
import { Store } from './store';
import { buildingDefinition, type BuildingId } from '../data/buildings';
import type { BuildingInstance } from '../sim/buildings/buildings';
import type { BuildingPreview } from '../sim/buildings/placement';
import { accessHints, type AccessState } from '../render/accessHints';
import { FixedStepper } from './loop';

/** What the UI shows about the tile under the cursor. */
export interface HoverInfo {
  tile: TileCoord;
  terrain: string;
  wooded: boolean;
  building: string | null;
}

export type Tool = 'road' | 'demolish' | { build: BuildingId };

/** What the toolbar shows while a stroke is being dragged. */
export type ToolPreview = ({ kind: 'road' } & RoadPreview) | ({ kind: 'build'; access: AccessState } & BuildingPreview) | { kind: 'demolish'; removable: number };

export class Game {
  private current: Simulation;
  readonly renderer = new Renderer();
  readonly snapshot: Store<SimSnapshot>;
  readonly hover = new Store<HoverInfo | null>(null);
  readonly tool = new Store<Tool | null>(null);
  readonly toolPreview = new Store<ToolPreview | null>(null);
  readonly selectedBuilding = new Store<BuildingInstance | null>(null);
  private detachTools: (() => void) | null = null;
  private hoveredTile: TileCoord | null = null;
  private readonly stepper = new FixedStepper();
  private lastSpeed: 1 | 2 | 3 = 1;
  private started = false;
  /** Called after every simulation tick (the save service autosaves from here). */
  onTick: ((tick: number) => void) | null = null;

  /** `paused` (used for loaded games) forces speed 0: no time passes until the player resumes. */
  constructor(sim: Simulation, options: { paused?: boolean } = {}) {
    this.current = sim;
    if (options.paused) this.pauseForLoad();
    this.snapshot = new Store(this.sim.snapshot());
  }

  get sim(): Simulation { return this.current; }

  /**
   * Swaps in another simulation (a loaded save or a new game). Tools, selection and
   * hover are cleared first, so an in-progress drag can't apply to the new city.
   * Only same-size maps can be swapped: input bounds are set up once at start.
   */
  replaceSimulation(sim: Simulation, options: { paused: boolean }): void {
    const next = sim.getWorld(); const now = this.current.getWorld();
    if (next.width !== now.width || next.height !== now.height) throw new Error(`Map size ${next.width}×${next.height} differs from this build (${now.width}×${now.height}).`);
    this.setTool(null);
    this.hover.set(null);
    this.hoveredTile = null;
    this.stepper.advance(0, 0);
    this.current = sim;
    if (options.paused) this.pauseForLoad();
    else this.lastSpeed = sim.getSpeed() === 0 ? this.lastSpeed : sim.getSpeed() as 1 | 2 | 3;
    if (this.started) this.renderer.rebuildWorld(sim.getWorld(), sim.getBuildings());
    this.publish();
  }

  async start(canvasHost: HTMLElement): Promise<void> {
    await this.renderer.init(canvasHost);
    this.started = true;
    const world = this.sim.getWorld();
    const camera = this.renderer.showWorld(world);
    this.renderer.app.ticker.add((ticker) => {
      const speed = this.sim.getSpeed();
      if (speed !== 0) this.lastSpeed = speed;
      const count = this.stepper.advance(ticker.deltaMS, speed);
      if (count === 0) return;
      for (let i = 0; i < count; i++) this.onTick?.(this.sim.tick().tick);
      this.publish();
    });
    attachKeyboardPan(camera, this.renderer.app.ticker);
    attachHover(camera, this.renderer.app.canvas, this.renderer.screenToMap, world.width, world.height, (tile) => this.onHover(tile));
    this.detachTools = attachTileDrag(camera, (x, y) => {
      const p = this.renderer.screenToMap(x, y); const tile = screenToTile(p.x, p.y);
      return inBounds(tile.x, tile.y, world.width, world.height) ? tile : null;
    }, world.width, world.height, (tiles) => this.preview(tiles), (tiles, click) => this.commit(tiles, click), (tile) => this.click(tile));
    const keydown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && this.tool.get() !== null) { this.setTool(null); return; }
      const target = event.target;
      if (target instanceof HTMLElement && (target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName))) return;
      if (event.ctrlKey || event.metaKey || event.altKey) return;
      if (event.code === 'Space') {
        event.preventDefault();
        if (!event.repeat) this.setSpeed(this.sim.getSpeed() === 0 ? this.lastSpeed : 0);
      } else if (event.key === '1' || event.key === '2' || event.key === '3') this.setSpeed(Number(event.key) as 1 | 2 | 3);
    };
    window.addEventListener('keydown', keydown);
    const detachTools = this.detachTools;
    this.detachTools = () => { detachTools?.(); window.removeEventListener('keydown', keydown); };
  }

  setSpeed(speed: 0 | 1 | 2 | 3): void {
    if (speed !== 0) this.lastSpeed = speed;
    else this.stepper.advance(0, 0);
    this.sim.applyCommand({ type: 'set-speed', speed });
    this.publish();
  }

  setTool(tool: Tool | null): void {
    this.tool.set(tool);
    this.toolPreview.set(null);
    this.selectedBuilding.set(null);
    this.renderer.setSelectedBuilding(null);
    this.renderer.setToolActive(tool !== null);
    this.updateGhost();
  }

  private preview(tiles: TileCoord[] | null): void {
    const tool = this.tool.get();
    if (!tool || !tiles) { this.toolPreview.set(null); return; }
    if (tool === 'road') this.toolPreview.set({ kind: 'road', ...this.sim.previewRoads(tiles) });
    else if (tool === 'demolish') this.toolPreview.set({ kind: 'demolish', ...this.sim.previewDemolish(tiles) });
    else {
      const preview = this.sim.previewBuilding(tool.build, tiles[tiles.length - 1] ?? { x: 0, y: 0 });
      this.toolPreview.set({ kind: 'build', ...preview, access: accessHints(this.sim.getWorld(), preview.tiles).access });
    }
  }

  private commit(tiles: TileCoord[], click: boolean): void {
    const tool = this.tool.get();
    if (!tool) return;
    const last = tiles[tiles.length - 1];
    if (typeof tool === 'object' && (!click || tiles.length !== 1)) { this.updateGhost(); return; }
    const command = tool === 'road' ? { type: 'place-roads' as const, tiles }
      : tool === 'demolish' ? { type: 'demolish' as const, tiles }
        : { type: 'place-building' as const, defId: tool.build, x: last?.x ?? 0, y: last?.y ?? 0 };
    const result = this.sim.applyCommand(command);
    if (result.ok) {
      this.renderer.refreshTiles(this.sim.getWorld(), result.changedTiles);
      this.renderer.refreshBuildings(this.sim.getWorld(), this.sim.getBuildings(), result.changedTiles);
      if (this.selectedBuilding.get() && result.changedBuildings.includes(this.selectedBuilding.get()?.id ?? -1)) {
        this.selectedBuilding.set(this.sim.getBuilding(this.selectedBuilding.get()?.id ?? -1) ?? null);
      }
    }
    this.publish();
    this.updateGhost();
  }

  private click(tile: TileCoord): void {
    if (this.tool.get()) return;
    const building = this.sim.getBuildingAt(tile.x, tile.y) ?? null;
    this.selectedBuilding.set(building);
    this.renderer.setSelectedBuilding(building?.id ?? null);
  }

  private onHover(tile: TileCoord | null): void {
    this.renderer.setHoveredTile(tile);
    this.hoveredTile = tile;
    this.updateGhost();
    if (!tile) {
      this.hover.set(null);
      return;
    }
    const world = this.sim.getWorld();
    const terrain = terrainAt(world, tile.x, tile.y) ?? TerrainId.Grass;
    this.hover.set({
      tile,
      terrain: toIndex(tile.x, tile.y, world.width) === world.entranceIndex ? 'Settlement entrance' : TERRAIN[terrain].name,
      wooded: treeAt(world, tile.x, tile.y) !== TreeKind.None,
      building: this.sim.getBuildingAt(tile.x, tile.y)?.defId ?? null,
    });
  }

  private updateGhost(): void {
    const tool = this.tool.get();
    const definition = tool && typeof tool === 'object' ? buildingDefinition(tool.build) ?? null : null;
    const preview = definition && this.hoveredTile ? this.sim.previewBuilding(definition.id, this.hoveredTile) : null;
    const access = preview ? accessHints(this.sim.getWorld(), preview.tiles) : null;
    if (definition && preview && access) this.toolPreview.set({ kind: 'build', ...preview, access: access.access });
    else if (this.tool.get() && typeof this.tool.get() === 'object') this.toolPreview.set(null);
    this.renderer.updatePlacement(definition, this.hoveredTile, preview, access?.hints);
  }

  /** Remembers the saved speed for Space-to-resume, then pauses. */
  private pauseForLoad(): void {
    const saved = this.current.getSpeed();
    if (saved !== 0) this.lastSpeed = saved;
    this.current.applyCommand({ type: 'set-speed', speed: 0 });
  }

  /** Call after the simulation changes so the UI re-reads it. */
  publish(): void {
    this.snapshot.set(this.sim.snapshot());
  }

  destroy(): void { this.detachTools?.(); this.renderer.destroy(); }
}
