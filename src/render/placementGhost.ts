import { Container, Graphics, Sprite } from 'pixi.js';
import type { TileCoord } from '../core/types';
import type { BuildingDefinition } from '../data/buildings';
import type { BuildingPreview } from '../sim/buildings/placement';
import type { BuildingTexture } from './art/buildingArt';
import { TILE_HEIGHT, TILE_WIDTH, tileToScreen } from '../core/grid';
import { footprintBottom } from './cameraMath';

export class PlacementGhost {
  readonly container = new Container({ label: 'placement-ghost' });
  private sprite: Sprite | null = null;
  private footprint = new Graphics();

  constructor() { this.container.addChild(this.footprint); }

  /** Draws exactly the footprint the simulation checked (`preview.tiles`). */
  update(definition: BuildingDefinition | null, texture: BuildingTexture | undefined, cursor: TileCoord | null, preview: BuildingPreview | null): void {
    this.footprint.clear();
    if (this.sprite) { this.container.removeChild(this.sprite); this.sprite.destroy(); this.sprite = null; }
    const origin = preview?.tiles[0];
    if (!definition || !cursor || !preview || !origin) { this.container.visible = false; return; }
    this.container.visible = true;
    const halfW = TILE_WIDTH / 2; const halfH = TILE_HEIGHT / 2;
    for (const tile of preview.tiles) {
      const top = tileToScreen(tile.x, tile.y);
      this.footprint.poly([top.x, top.y, top.x + halfW, top.y + halfH, top.x, top.y + TILE_HEIGHT, top.x - halfW, top.y + halfH]);
      this.footprint.fill({ color: preview.ok ? 0x55dd88 : 0xff4d4d, alpha: 0.24 });
      this.footprint.stroke({ color: preview.ok ? 0x72ef9b : 0xff6666, width: 2, alpha: 0.9 });
    }
    if (texture) {
      this.sprite = new Sprite(texture.texture);
      this.sprite.anchor.set(0.5, texture.anchorY);
      const bottom = footprintBottom(origin.x, origin.y, definition.size);
      this.sprite.position.set(bottom.x, bottom.y);
      this.sprite.alpha = 0.72;
      this.sprite.tint = preview.ok ? 0x9dffad : 0xffaaaa;
      this.container.addChild(this.sprite);
    }
  }
}
