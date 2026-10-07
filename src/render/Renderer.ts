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
import { EffectsLayer } from './layers/EffectsLayer';
import { OverlayLayer } from './layers/OverlayLayer';
import type { OverlayKind } from './overlays';
import { MarkerLayer } from './layers/MarkerLayer';
import { RoadLayer } from './layers/RoadLayer';
import { TerrainLayer } from './layers/TerrainLayer';
import { SkyLayer } from './layers/SkyLayer';
import type { DayLight } from './lighting';
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
  private readonly effects = new EffectsLayer();
  private readonly overlay = new OverlayLayer();
  private readonly sky = new SkyLayer();
  /** The last applied day light, rounded, so unchanged frames cost nothing. */
  private dayKey = '';
  private reduceMotion = false;

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
  showWorld(world: Readonly<WorldMap>, buildings: readonly BuildingInstance[] = []): Viewport {
    const renderer = this.app.renderer;

    const extent = mapExtent(world.width, world.height);
    this.camera = createCamera(this.app, extent);
    const offset = worldOffset(extent);
    this.world.position.set(offset.x, offset.y);
    this.terrain = new TerrainLayer(buildTerrainTextures(renderer));
    this.buildingTextures = buildBuildingTextures(renderer, BUILDINGS);
    this.objects = new ObjectLayer(buildTreeTextures(renderer), this.buildingTextures);
    this.roads = new RoadLayer();
    this.hover = new HoverLayer(this.reduceMotion);
    this.ghost = new PlacementGhost();
    this.markers = new MarkerLayer(this.buildingTextures);

    this.terrain.build(world);
    this.objects.build(world, buildings);
    this.roads.build(world);
    this.markers.setEntrance(world);
    this.markers.setBuildingWarnings(buildings);
    this.world.addChild(this.terrain.container, this.roads.container, this.overlay.container, this.objects.container, this.effects.container, this.hover.container, this.ghost.container, this.markers.container);
    this.camera.addChild(this.world);
    this.app.stage.addChild(this.sky.graphics, this.camera);
    this.centreOnEntrance(world);

    const hover = this.hover;
    const effects = this.effects;
    this.app.ticker.add((t) => { hover.update(t); effects.update(t.deltaMS); });
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
    this.overlay.clear();
    this.centreOnEntrance(world);
  }

  /**
   * Day and night: tints the ground, roads, trees and buildings, lights windows and
   * repaints the sky. Overlays, markers, the ghost and effects stay untinted, so they
   * read the same at any hour. Rounded, so most frames change nothing.
   */
  setDayLight(light: DayLight): void {
    const step = (c: number) => c & 0xfcfcfc;
    const tint = step(light.tint);
    const glow = Math.round(light.windowGlow * 40) / 40;
    const top = light.skyTop & 0xf8f8f8; const bottom = light.skyBottom & 0xf8f8f8;
    const { width, height } = this.app.screen;
    const key = `${tint}|${glow}|${top}|${bottom}|${width}|${height}`;
    if (key === this.dayKey) return;
    this.dayKey = key;
    if (this.terrain) this.terrain.container.tint = tint;
    if (this.roads) this.roads.container.tint = tint;
    this.objects?.setDayLight(tint, glow);
    this.sky.update(top, bottom, width, height);
  }

  /** How full each home and workplace is (render/occupancy.ts), for lived-in details. */
  setOccupancy(fill: ReadonlyMap<number, number>): void { this.objects?.setOccupancy(fill); }

  /**
   * Looks at the settlement entrance: every road has to begin there. `animate` glides the
   * camera there (skipped under reduced motion); otherwise it jumps.
   */
  centreOnEntrance(world: Readonly<WorldMap>, animate = false): void {
    if (!this.camera || world.entranceIndex < 0) return;
    const top = tileToScreen(world.entranceIndex % world.width, Math.floor(world.entranceIndex / world.width));
    const target = { x: this.world.position.x + top.x, y: this.world.position.y + top.y + TILE_HEIGHT / 2 };
    if (animate && !this.reduceMotion) this.camera.animate({ position: target, time: 450, ease: 'easeInOutSine', removeOnInterrupt: true });
    else this.camera.moveCenter(target.x, target.y);
  }

  /** Shows (or hides) a map overlay; identical `version`s are skipped by the layer. */
  setOverlay(kind: OverlayKind, tints: Uint8Array | null, width: number, height: number, version: number): void {
    if (kind === 'none' || !tints) { this.overlay.hide(); return; }
    this.overlay.show(kind, tints, width, height, version, kind === 'roads' ? 0.6 : 0.35);
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

  /** Follows the player's reduced-motion preference: no pop-in, no dust, no hover easing. */
  setReducedMotion(reduced: boolean): void {
    this.reduceMotion = reduced;
    this.effects.reduceMotion = reduced;
    if (this.hover) this.hover.reduceMotion = reduced;
  }

  /** Pop-in for a building that was just placed (call after refreshBuildings). */
  animateBuildingIn(id: number): void {
    const sprite = this.objects?.buildingSprite(id);
    if (sprite) this.effects.popIn(sprite);
  }

  /** Dust over demolished tiles; `size` is larger for bigger buildings. */
  dust(tiles: readonly TileCoord[], size = 1): void { this.effects.dust(tiles, size); }

  setToolActive(active: boolean): void {
    if (this.camera) setToolDrag(this.camera, active);
  }

  destroy(): void {
    this.app.destroy(true, { children: true });
  }
}
