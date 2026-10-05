/**
 * Owns the Pixi application, the camera and the map layers. Reads the
 * simulation; never mutates it.
 */
import { Application, Container, CullerPlugin, extensions } from 'pixi.js';
import type { Viewport } from 'pixi-viewport';
import type { TileCoord } from '../core/types';
import { TILE_HEIGHT, tileToScreen, toIndex } from '../core/grid';
import type { WorldMap } from '../sim/world/World';
import { buildTerrainTextures } from './art/terrainArt';
import { buildTreeTextures } from './art/treeArt';
import { buildBuildingTextures } from './art/buildingArt';
import { createCamera, mapExtent, setToolDrag, worldOffset } from './camera';
import { HoverLayer } from './layers/HoverLayer';
import { ObjectLayer } from './layers/ObjectLayer';
import { MarkerLayer } from './layers/MarkerLayer';
import { RoadLayer } from './layers/RoadLayer';
import { TerrainLayer } from './layers/TerrainLayer';
import { PALETTE } from './palette';
import { BUILDINGS, type BuildingDefinition } from '../data/buildings';
import type { BuildingInstance } from '../sim/buildings/buildings';
import type { BuildingPreview } from '../sim/buildings/placement';
import { PlacementGhost } from './placementGhost';
import type { EdgeHint } from './accessHints';

extensions.add(CullerPlugin);

export class Renderer {
  readonly app = new Application();
  private camera: Viewport | null = null;
  /** Holds the map layers, in tile-projection coordinates. */
  readonly world = new Container({ label: 'world' });
  private terrain: TerrainLayer | null = null;
  private objects: ObjectLayer | null = null;
  private roads: RoadLayer | null = null;
  private hover: HoverLayer | null = null;
  private buildingTextures = new Map<string, import('./art/buildingArt').BuildingTexture>();
  private ghost: PlacementGhost | null = null;
  private markers: MarkerLayer | null = null;

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

  /** Builds the map layers and camera for a world. */
  showWorld(world: Readonly<WorldMap>): Viewport {
    const renderer = this.app.renderer;
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    const extent = mapExtent(world.width, world.height);
    this.camera = createCamera(this.app, extent);
    const offset = worldOffset(extent);
    this.world.position.set(offset.x, offset.y);
    this.terrain = new TerrainLayer(buildTerrainTextures(renderer));
    this.buildingTextures = buildBuildingTextures(renderer, BUILDINGS);
    this.objects = new ObjectLayer(buildTreeTextures(renderer), this.buildingTextures);
    this.roads = new RoadLayer();
    this.hover = new HoverLayer(reduceMotion);
    this.ghost = new PlacementGhost();
    this.markers = new MarkerLayer(this.buildingTextures);

    this.terrain.build(world);
    this.objects.build(world);
    this.roads.build(world);
    this.markers.setEntrance(world);
    this.world.addChild(this.terrain.container, this.roads.container, this.objects.container, this.hover.container, this.ghost.container, this.markers.container);
    this.camera.addChild(this.world);
    this.app.stage.addChild(this.camera);
    this.centreOnEntrance(world);

    const hover = this.hover;
    this.app.ticker.add((t) => hover.update(t));
    return this.camera;
  }

  /**
   * Redraws every map layer for another world of the same size (a loaded save or a
   * new game), clears transient overlays and looks at the new entrance.
   */
  rebuildWorld(world: Readonly<WorldMap>, buildings: readonly BuildingInstance[]): void {
    this.terrain?.build(world);
    this.roads?.build(world);
    this.objects?.build(world, buildings);
    this.markers?.setEntrance(world);
    this.markers?.setBuildingWarnings(buildings);
    this.hover?.setTile(null);
    this.ghost?.update(null, undefined, null, null);
    this.centreOnEntrance(world);
  }

  /** Start looking at the settlement entrance: every road has to begin there. */
  private centreOnEntrance(world: Readonly<WorldMap>): void {
    if (!this.camera || world.entranceIndex < 0) return;
    const top = tileToScreen(world.entranceIndex % world.width, Math.floor(world.entranceIndex / world.width));
    this.camera.moveCenter(this.world.position.x + top.x, this.world.position.y + top.y + TILE_HEIGHT / 2);
  }

  /** Screen point → map projection coordinates (inverse of tileToScreen space). */
  screenToMap = (x: number, y: number): { x: number; y: number } => this.world.toLocal({ x, y });

  setHoveredTile(tile: TileCoord | null): void {
    this.hover?.setTile(tile);
  }

  /** Redraws roads and trees on tiles the simulation changed. */
  refreshTiles(world: Readonly<WorldMap>, tiles: readonly TileCoord[]): void {
    this.roads?.refresh(world, tiles);
    for (const { x, y } of tiles) this.objects?.applyTree(world, toIndex(x, y, world.width));
  }

  refreshBuildings(world: Readonly<WorldMap>, buildings: readonly BuildingInstance[], tiles: readonly TileCoord[]): void {
    for (const { x, y } of tiles) if (x >= 0 && y >= 0 && x < world.width && y < world.height) this.objects?.applyTree(world, toIndex(x, y, world.width));
    this.objects?.applyBuildings(buildings);
    this.markers?.setBuildingWarnings(buildings);
  }

  setSelectedBuilding(id: number | null): void { this.objects?.setSelected(id); }

  updatePlacement(definition: BuildingDefinition | null, cursor: TileCoord | null, preview: BuildingPreview | null, hints: readonly EdgeHint[] = []): void {
    this.ghost?.update(definition, definition ? this.buildingTextures.get(definition.art) : undefined, cursor, preview, hints);
  }

  setToolActive(active: boolean): void {
    if (this.camera) setToolDrag(this.camera, active);
  }

  destroy(): void {
    this.app.destroy(true, { children: true });
  }
}
