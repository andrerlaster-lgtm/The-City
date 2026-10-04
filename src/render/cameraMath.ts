/**
 * Pure camera geometry (no Pixi), so it can be unit-tested.
 */
import { TILE_HEIGHT, TILE_WIDTH, tileToScreen } from '../core/grid';

/** Depth of the earth "skirt" drawn below the map's front edges. */
export const SKIRT_DEPTH = 28;

export const MAX_ZOOM = 2.5;
export const EDGE_PADDING = 160;

export interface MapExtent {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
}

/** Bounding box of the whole map diamond (plus its skirt) in world pixels. */
export function mapExtent(width: number, height: number): MapExtent {
  return {
    minX: tileToScreen(0, height - 1).x - TILE_WIDTH / 2,
    maxX: tileToScreen(width - 1, 0).x + TILE_WIDTH / 2,
    minY: 0,
    maxY: tileToScreen(width - 1, height - 1).y + TILE_HEIGHT + SKIRT_DEPTH,
  };
}

/** Most zoomed-out level: the whole map fits on screen (never above 1×). */
export function minZoomFor(extent: MapExtent, screenW: number, screenH: number): number {
  const fit = Math.min(screenW / (extent.maxX - extent.minX), screenH / (extent.maxY - extent.minY));
  return Math.max(0.06, Math.min(1, fit * 0.95));
}

/**
 * pixi-viewport assumes its world starts at (0, 0), but the iso map spans
 * negative x. Map layers go in a container shifted by this offset so the
 * world box runs from (0, 0) to (worldWidth, worldHeight).
 */
export function worldOffset(extent: MapExtent): { x: number; y: number } {
  return { x: EDGE_PADDING - extent.minX, y: EDGE_PADDING - extent.minY };
}
