import { Container, Graphics, Sprite } from 'pixi.js';
import type { TileCoord } from '../core/types';
import type { BuildingDefinition } from '../data/buildings';
import type { BuildingPreview } from '../sim/buildings/placement';
import type { BuildingTexture } from './art/buildingArt';
import { TILE_HEIGHT, TILE_WIDTH, tileToScreen } from '../core/grid';
import { footprintBottom } from './cameraMath';
import type { EdgeHint, Side } from './accessHints';
import { PALETTE } from './palette';

/** Screen direction of each footprint side (tile y − 1 is up-right on this projection). */
const SIDE_DIRECTION: Record<Side, { x: number; y: number }> = {
  north: unit(TILE_WIDTH / 2, -TILE_HEIGHT / 2),
  east: unit(TILE_WIDTH / 2, TILE_HEIGHT / 2),
  south: unit(-TILE_WIDTH / 2, TILE_HEIGHT / 2),
  west: unit(-TILE_WIDTH / 2, -TILE_HEIGHT / 2),
};

export class PlacementGhost {
  readonly container = new Container({ label: 'placement-ghost' });
  private sprite: Sprite | null = null;
  private footprint = new Graphics();
  private hints = new Graphics();

  constructor() { this.container.addChild(this.hints, this.footprint); }

  /**
   * Draws exactly the footprint the simulation checked (`preview.tiles`), plus road-access
   * hints: touching roads glow green (connected) or amber (not connected to the entrance);
   * with no touching road, arrows mark the open tiles where a road would give access.
   */
  update(definition: BuildingDefinition | null, texture: BuildingTexture | undefined, cursor: TileCoord | null, preview: BuildingPreview | null, hints: readonly EdgeHint[] = []): void {
    this.footprint.clear();
    this.hints.clear();
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
    this.drawHints(hints);
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

  private drawHints(hints: readonly EdgeHint[]): void {
    const anyRoad = hints.some((hint) => hint.kind === 'connected-road' || hint.kind === 'disconnected-road');
    for (const hint of hints) {
      const top = tileToScreen(hint.x, hint.y);
      const centre = { x: top.x, y: top.y + TILE_HEIGHT / 2 };
      if (hint.kind === 'connected-road' || hint.kind === 'disconnected-road') {
        const color = hint.kind === 'connected-road' ? PALETTE.accessGood : PALETTE.accessWarn;
        this.diamond(top, color, 0.22, 3);
      } else if (hint.kind === 'open' && !anyRoad) {
        this.diamond(top, PALETTE.accessHint, 0.08, 1.5);
        const d = SIDE_DIRECTION[hint.side];
        const tip = { x: centre.x + d.x * 11, y: centre.y + d.y * 11 };
        const back = { x: centre.x - d.x * 6, y: centre.y - d.y * 6 };
        this.hints.poly([tip.x, tip.y, back.x - d.y * 8, back.y + d.x * 8, back.x + d.y * 8, back.y - d.x * 8])
          .fill({ color: PALETTE.accessHint, alpha: 0.95 })
          .stroke({ color: PALETTE.shadow, width: 1.5, alpha: 0.6 });
      }
    }
  }

  private diamond(top: { x: number; y: number }, color: number, fillAlpha: number, width: number): void {
    const halfW = TILE_WIDTH / 2; const halfH = TILE_HEIGHT / 2;
    this.hints.poly([top.x, top.y, top.x + halfW, top.y + halfH, top.x, top.y + TILE_HEIGHT, top.x - halfW, top.y + halfH])
      .fill({ color, alpha: fillAlpha })
      .stroke({ color, width, alpha: 0.95 });
  }
}

function unit(x: number, y: number): { x: number; y: number } {
  const length = Math.hypot(x, y);
  return { x: x / length, y: y / length };
}
