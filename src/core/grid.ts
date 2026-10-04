/**
 * Grid indexing and isometric (2:1 diamond) projection math.
 * Pure functions: shared by the simulation (indexing) and the renderer (projection).
 */
import type { ScreenCoord, TileCoord } from './types';

export const TILE_WIDTH = 64;
export const TILE_HEIGHT = 32;

/** Flat index for typed-array layers: y * width + x. */
export function toIndex(x: number, y: number, width: number): number {
  return y * width + x;
}

export function fromIndex(index: number, width: number): TileCoord {
  const x = index % width;
  return { x, y: (index - x) / width };
}

export function inBounds(x: number, y: number, width: number, height: number): boolean {
  return x >= 0 && y >= 0 && x < width && y < height;
}

/** Top corner of a tile's diamond in world (pre-camera) pixels. */
export function tileToScreen(x: number, y: number): ScreenCoord {
  return {
    x: (x - y) * (TILE_WIDTH / 2),
    y: (x + y) * (TILE_HEIGHT / 2),
  };
}

/** Inverse projection; floored to the tile containing the point. */
export function screenToTile(sx: number, sy: number): TileCoord {
  const halfW = TILE_WIDTH / 2;
  const halfH = TILE_HEIGHT / 2;
  return {
    x: Math.floor((sx / halfW + sy / halfH) / 2),
    y: Math.floor((sy / halfH - sx / halfW) / 2),
  };
}

/**
 * Tiles from `from` to `to` inclusive, stepping one axis at a time so every
 * consecutive pair shares an edge (4-connected). Ties step y first.
 */
export function tileLine(from: TileCoord, to: TileCoord): TileCoord[] {
  const nx = Math.abs(to.x - from.x);
  const ny = Math.abs(to.y - from.y);
  const sx = to.x > from.x ? 1 : -1;
  const sy = to.y > from.y ? 1 : -1;
  let x = from.x;
  let y = from.y;
  const out: TileCoord[] = [{ x, y }];
  for (let ix = 0, iy = 0; ix < nx || iy < ny; ) {
    // Compare (ix + 0.5) / nx with (iy + 0.5) / ny in integers.
    if ((1 + 2 * ix) * ny < (1 + 2 * iy) * nx) { x += sx; ix++; } else { y += sy; iy++; }
    out.push({ x, y });
  }
  return out;
}
