/**
 * Turns pointer movement over the map into a hovered tile (or null when the
 * pointer is off the map). Tools (road, build, demolish) will build on this.
 */
import type { FederatedPointerEvent } from 'pixi.js';
import type { Viewport } from 'pixi-viewport';
import { inBounds, screenToTile } from '../core/grid';
import type { TileCoord } from '../core/types';

export function attachHover(
  viewport: Viewport,
  canvas: HTMLCanvasElement,
  screenToMap: (x: number, y: number) => { x: number; y: number },
  mapWidth: number,
  mapHeight: number,
  onHover: (tile: TileCoord | null) => void,
): () => void {
  let last: TileCoord | null = null;
  let lastGlobal: { x: number; y: number } | null = null;

  const update = () => {
    let tile: TileCoord | null = null;
    if (lastGlobal) {
      const p = screenToMap(lastGlobal.x, lastGlobal.y);
      const t = screenToTile(p.x, p.y);
      if (inBounds(t.x, t.y, mapWidth, mapHeight)) tile = t;
    }
    if (tile?.x !== last?.x || tile?.y !== last?.y) {
      last = tile;
      onHover(tile);
    }
  };
  const move = (e: FederatedPointerEvent) => {
    lastGlobal = { x: e.global.x, y: e.global.y };
    update();
  };
  const leave = () => {
    lastGlobal = null;
    update();
  };

  viewport.on('pointermove', move);
  canvas.addEventListener('pointerleave', leave);
  // The map moves under a still cursor while panning or zooming.
  viewport.on('moved', update);
  return () => {
    viewport.off('pointermove', move);
    canvas.removeEventListener('pointerleave', leave);
    viewport.off('moved', update);
  };
}
