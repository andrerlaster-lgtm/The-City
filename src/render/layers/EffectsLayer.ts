/**
 * Short-lived visual effects: buildings popping in when placed, a ring and floating text
 * saying what a change did, and a dust puff when something is demolished. Purely
 * cosmetic. Under reduced motion only the text shows, fading in place without moving.
 */
import { Container, Graphics, Text, type Sprite } from 'pixi.js';
import { TILE_HEIGHT, tileToScreen } from '../../core/grid';
import type { TileCoord } from '../../core/types';
import { easeOutBack, easeOutCubic, Tweens } from '../anim';
import { PALETTE } from '../palette';
import type { FeedbackTone } from '../feedback';

const POP_MS = 280;
const DUST_MS = 450;
const DUST_COLORS = [PALETTE.soilLight, PALETTE.sandDark, PALETTE.soilDark];
const TEXT_MS = 1300;
const RING_MS = 650;
const TONE_COLORS: Record<FeedbackTone, number> = { good: PALETTE.accessGood, info: PALETTE.overlayGood, warn: PALETTE.accessWarn };

export class EffectsLayer {
  readonly container = new Container({ label: 'effects' });
  private readonly tweens = new Tweens();
  private readonly pool: Graphics[] = [];
  reduceMotion = false;

  update(deltaMS: number): void { this.tweens.tick(deltaMS); }

  /**
   * Grows a freshly placed building out of the ground (scale 0.6 → 1, fade in). Its
   * `followers` (window light, signs) stay hidden until it has landed.
   */
  popIn(sprite: Sprite, followers: readonly Sprite[] = []): void {
    if (this.reduceMotion) return;
    for (const follower of followers) follower.renderable = false;
    this.tweens.add(POP_MS, (t) => {
      if (sprite.destroyed) return false;
      const s = 0.6 + 0.4 * easeOutBack(t);
      sprite.scale.set(s);
      sprite.alpha = Math.min(1, t * 2);
    }, () => {
      if (!sprite.destroyed) { sprite.scale.set(1); sprite.alpha = 1; }
      for (const follower of followers) if (!follower.destroyed) follower.renderable = true;
    });
  }

  /** Text that rises and fades above a point (in place, without rising, under reduced motion). */
  floatText(x: number, y: number, text: string, tone: FeedbackTone, delay = 0): void {
    const label = new Text({
      text,
      style: { fontFamily: 'system-ui, sans-serif', fontSize: 13, fontWeight: '800', fill: TONE_COLORS[tone], stroke: { color: PALETTE.shadow, width: 3.5 } },
      resolution: 2,
    });
    label.anchor.set(0.5, 1);
    label.position.set(x, y);
    label.alpha = 0;
    this.container.addChild(label);
    const rise = this.reduceMotion ? 0 : 22;
    let waited = 0;
    this.tweens.add(TEXT_MS + delay, (t) => {
      waited = t * (TEXT_MS + delay);
      if (waited < delay) return;
      const p = (waited - delay) / TEXT_MS;
      label.position.set(x, y - rise * easeOutCubic(p));
      label.alpha = p < 0.15 ? p / 0.15 : p > 0.7 ? 1 - (p - 0.7) / 0.3 : 1;
    }, () => label.destroy());
  }

  /** A ring that spreads across the ground from a building's footprint. */
  ring(x: number, y: number, size: number, tone: FeedbackTone): void {
    if (this.reduceMotion) return;
    const g = this.take();
    const color = TONE_COLORS[tone];
    this.tweens.add(RING_MS, (t) => {
      const e = easeOutCubic(t);
      const rx = (0.45 + 0.5 * e) * size * TILE_HEIGHT * 1.6;
      g.clear().ellipse(0, 0, rx, rx / 2).stroke({ color, width: 3 * (1 - t) + 1, alpha: 0.9 * (1 - t) });
      g.position.set(x, y);
    }, () => this.release(g));
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
