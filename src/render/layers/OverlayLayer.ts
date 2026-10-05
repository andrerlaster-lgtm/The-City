/**
 * Draws an overlay as translucent tile tints, in 16×16-tile chunks. Only chunks whose tints
 * changed are redrawn, and nothing is redrawn while the inputs (kind + map version) are the same.
 */
import { Container, Graphics } from 'pixi.js';
import { TILE_HEIGHT, TILE_WIDTH, tileToScreen } from '../../core/grid';
import { Tint, type OverlayKind } from '../overlays';
import { PALETTE } from '../palette';

const CHUNK = 16;
const COLORS: Record<Exclude<Tint, typeof Tint.None>, number> = {
  [Tint.Good]: PALETTE.overlayGood,
  [Tint.Warn]: PALETTE.overlayWarn,
  [Tint.Bad]: PALETTE.overlayBad,
};

export class OverlayLayer {
  readonly container = new Container({ label: 'overlay' });
  private chunks = new Map<number, Graphics>();
  private tints: Uint8Array | null = null;
  private key = '';

  /** Shows `tints` for `kind`; `version` identifies the inputs so identical updates are free. */
  show(kind: OverlayKind, tints: Uint8Array, width: number, height: number, version: number, alpha: number): void {
    const key = `${kind}:${version}`;
    if (key === this.key) return;
    const previous = this.tints && this.tints.length === tints.length && this.key.startsWith(`${kind}:`) ? this.tints : null;
    this.key = key;
    this.tints = tints;
    this.container.visible = true;
    for (let cy = 0; cy < height; cy += CHUNK) for (let cx = 0; cx < width; cx += CHUNK) {
      if (previous && !chunkChanged(previous, tints, cx, cy, width, height)) continue;
      this.drawChunk(tints, cx, cy, width, height, alpha);
    }
  }

  hide(): void {
    this.container.visible = false;
    this.key = '';
  }

  /** Drops everything (a different world was loaded). */
  clear(): void {
    for (const chunk of this.chunks.values()) chunk.destroy();
    this.chunks.clear();
    this.tints = null;
    this.key = '';
    this.container.visible = false;
  }

  private drawChunk(tints: Uint8Array, cx: number, cy: number, width: number, height: number, alpha: number): void {
    const id = cy * width + cx;
    let g = this.chunks.get(id);
    if (!g) { g = new Graphics(); this.chunks.set(id, g); this.container.addChild(g); }
    g.clear();
    const halfW = TILE_WIDTH / 2; const halfH = TILE_HEIGHT / 2;
    for (let y = cy; y < Math.min(cy + CHUNK, height); y++) for (let x = cx; x < Math.min(cx + CHUNK, width); x++) {
      const tint = tints[y * width + x] as Tint;
      if (tint === Tint.None) continue;
      const top = tileToScreen(x, y);
      g.poly([top.x, top.y, top.x + halfW, top.y + halfH, top.x, top.y + TILE_HEIGHT, top.x - halfW, top.y + halfH]).fill({ color: COLORS[tint], alpha });
    }
  }
}

function chunkChanged(a: Uint8Array, b: Uint8Array, cx: number, cy: number, width: number, height: number): boolean {
  for (let y = cy; y < Math.min(cy + CHUNK, height); y++) for (let x = cx; x < Math.min(cx + CHUNK, width); x++) {
    if (a[y * width + x] !== b[y * width + x]) return true;
  }
  return false;
}
