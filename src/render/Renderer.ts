/**
 * Owns the Pixi application, the camera and the map layers. Reads the
 * simulation; never mutates it.
 */
import { Application, Container, CullerPlugin, extensions } from 'pixi.js';
import type { Viewport } from 'pixi-viewport';
import type { TileCoord } from '../core/types';
import type { WorldMap } from '../sim/world/World';
import { buildTerrainTextures } from './art/terrainArt';
import { buildTreeTextures } from './art/treeArt';
import { createCamera, mapExtent, worldOffset } from './camera';
import { HoverLayer } from './layers/HoverLayer';
import { ObjectLayer } from './layers/ObjectLayer';
import { TerrainLayer } from './layers/TerrainLayer';
import { PALETTE } from './palette';

extensions.add(CullerPlugin);

export class Renderer {
  readonly app = new Application();
  private camera: Viewport | null = null;
  /** Holds the map layers, in tile-projection coordinates. */
  readonly world = new Container({ label: 'world' });
  private terrain: TerrainLayer | null = null;
  private objects: ObjectLayer | null = null;
  private hover: HoverLayer | null = null;

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
    this.objects = new ObjectLayer(buildTreeTextures(renderer));
    this.hover = new HoverLayer(reduceMotion);

    this.terrain.build(world);
    this.objects.build(world);
    this.world.addChild(this.terrain.container, this.hover.container, this.objects.container);
    this.camera.addChild(this.world);
    this.app.stage.addChild(this.camera);

    const hover = this.hover;
    this.app.ticker.add((t) => hover.update(t));
    return this.camera;
  }

  /** Screen point → map projection coordinates (inverse of tileToScreen space). */
  screenToMap = (x: number, y: number): { x: number; y: number } => this.world.toLocal({ x, y });

  setHoveredTile(tile: TileCoord | null): void {
    this.hover?.setTile(tile);
  }

  destroy(): void {
    this.app.destroy(true, { children: true });
  }
}
