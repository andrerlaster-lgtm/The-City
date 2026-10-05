/**
 * Highlights the tile under the cursor. Glides to the new tile instead of
 * jumping, and fades out when the cursor leaves the map.
 */
import { Container, Graphics, type Ticker } from 'pixi.js';
import { TILE_HEIGHT, TILE_WIDTH, tileToScreen } from '../../core/grid';
import type { TileCoord } from '../../core/types';
import { PALETTE } from '../palette';

export class HoverLayer {
  readonly container = new Container({ label: 'hover' });
  private readonly marker = new Graphics();
  private target: { x: number; y: number } | null = null;
  private visible = 0;

  constructor(public reduceMotion: boolean) {
    const w = TILE_WIDTH;
    const h = TILE_HEIGHT;
    this.marker
      .poly([0, 0, w / 2, h / 2, 0, h, -w / 2, h / 2])
      .fill({ color: PALETTE.highlight, alpha: 0.22 })
      .stroke({ width: 1.5, color: PALETTE.highlight, alpha: 0.85, alignment: 0.5 });
    this.marker.alpha = 0;
    this.container.addChild(this.marker);
  }

  setTile(tile: TileCoord | null): void {
    if (!tile) {
      this.target = null;
      return;
    }
    const pos = tileToScreen(tile.x, tile.y);
    if (!this.target && this.visible === 0) this.marker.position.set(pos.x, pos.y);
    this.target = pos;
  }

  update(ticker: Ticker): void {
    const k = this.reduceMotion ? 1 : 1 - Math.pow(0.0001, ticker.deltaMS / 1000);
    if (this.target) {
      this.marker.x += (this.target.x - this.marker.x) * Math.min(1, k * 2.5);
      this.marker.y += (this.target.y - this.marker.y) * Math.min(1, k * 2.5);
    }
    const goal = this.target ? 1 : 0;
    this.visible += (goal - this.visible) * Math.min(1, k * 1.5);
    if (Math.abs(goal - this.visible) < 0.01) this.visible = goal;
    this.marker.alpha = this.visible;
  }
}
