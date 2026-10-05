/**
 * Short-lived visual effects: buildings popping in when placed and a dust puff when
 * something is demolished. Purely cosmetic; skipped entirely under reduced motion.
 */
import { Container, Graphics, type Sprite } from 'pixi.js';
import { TILE_HEIGHT, tileToScreen } from '../../core/grid';
import type { TileCoord } from '../../core/types';
import { easeOutBack, easeOutCubic, Tweens } from '../anim';
import { PALETTE } from '../palette';

const POP_MS = 280;
const DUST_MS = 450;
const DUST_COLORS = [PALETTE.soilLight, PALETTE.sandDark, PALETTE.soilDark];

export class EffectsLayer {
  readonly container = new Container({ label: 'effects' });
  private readonly tweens = new Tweens();
  private readonly pool: Graphics[] = [];
  reduceMotion = false;

  update(deltaMS: number): void { this.tweens.tick(deltaMS); }

  /** Grows a freshly placed building out of the ground (scale 0.6 → 1, fade in). */
  popIn(sprite: Sprite): void {
    if (this.reduceMotion) return;
    this.tweens.add(POP_MS, (t) => {
      if (sprite.destroyed) return false;
      const s = 0.6 + 0.4 * easeOutBack(t);
      sprite.scale.set(s);
      sprite.alpha = Math.min(1, t * 2);
    }, () => { if (!sprite.destroyed) { sprite.scale.set(1); sprite.alpha = 1; } });
  }

  /** A puff of soil-coloured dust over each tile; `size` scales it for bigger buildings. */
  dust(tiles: readonly TileCoord[], size = 1): void {
    if (this.reduceMotion) return;
    for (const tile of tiles) {
      const top = tileToScreen(tile.x, tile.y);
      const count = 5 + Math.round(size * 2);
      for (let i = 0; i < count; i++) {
        const angle = (i / count) * Math.PI * 2 + Math.random() * 0.6;
        const spread = (10 + Math.random() * 12) * size;
        const radius = (3 + Math.random() * 3) * Math.sqrt(size);
        const g = this.take();
        g.clear().circle(0, 0, radius).fill({ color: DUST_COLORS[i % DUST_COLORS.length]!, alpha: 0.85 });
        const startX = top.x; const startY = top.y + TILE_HEIGHT / 2;
        g.position.set(startX, startY);
        this.tweens.add(DUST_MS, (t) => {
          const e = easeOutCubic(t);
          g.position.set(startX + Math.cos(angle) * spread * e, startY + Math.sin(angle) * spread * 0.5 * e - 14 * e * size);
          g.alpha = 1 - t;
          g.scale.set(1 + t * 0.6);
        }, () => this.release(g));
      }
    }
  }

  private take(): Graphics {
    const g = this.pool.pop() ?? new Graphics();
    g.visible = true;
    this.container.addChild(g);
    return g;
  }

  private release(g: Graphics): void {
    g.visible = false;
    this.container.removeChild(g);
    this.pool.push(g);
  }
}
