/**
 * Turns pointer movement over the map into a hovered tile (or null when the
 * pointer is off the map). Tools (road, build, demolish) will build on this.
 */
import type { FederatedPointerEvent } from 'pixi.js';
import type { Viewport } from 'pixi-viewport';
import { inBounds, screenToTile, tileLine } from '../core/grid';
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

/** Drag paints each crossed tile once (4-connected); release delivers one deterministic command. */
export function attachTileDrag(
  viewport: Viewport,
  screenToTileAt: (x: number, y: number) => TileCoord | null,
  mapWidth: number,
  mapHeight: number,
  onPreview: (tiles: TileCoord[] | null) => void,
  onCommit: (tiles: TileCoord[]) => void,
): () => void {
  let drawing = false;
  let tiles: TileCoord[] = [];
  let seen = new Set<string>();
  let last: TileCoord | null = null;
  const append = (tile: TileCoord) => {
    if (!inBounds(tile.x, tile.y, mapWidth, mapHeight)) return;
    const key = `${tile.x},${tile.y}`;
    if (!seen.has(key)) { seen.add(key); tiles.push(tile); }
  };
  const add = (e: FederatedPointerEvent) => {
    const tile = screenToTileAt(e.global.x, e.global.y);
    if (!tile) return;
    if (last) tileLine(last, tile).forEach(append); else append(tile);
    last = tile;
    onPreview([...tiles]);
  };
  const down = (e: FederatedPointerEvent) => {
    if (e.button !== 0) return;
    drawing = true; tiles = []; seen = new Set(); last = null; add(e);
  };
  const move = (e: FederatedPointerEvent) => { if (drawing) add(e); };
  const up = () => {
    if (!drawing) return;
    drawing = false;
    const done = tiles; tiles = []; seen.clear(); last = null; onPreview(null);
    if (done.length) onCommit(done);
  };
  viewport.on('pointerdown', down); viewport.on('pointermove', move);
  viewport.on('pointerup', up); viewport.on('pointerupoutside', up);
  return () => {
    viewport.off('pointerdown', down); viewport.off('pointermove', move);
    viewport.off('pointerup', up); viewport.off('pointerupoutside', up);
  };
}
