/**
 * Camera: drag / wheel / pinch with inertia, zoom limits, and clamping to the
 * map's isometric extent. Built on pixi-viewport.
 */
import type { Application } from 'pixi.js';
import { Viewport } from 'pixi-viewport';
import { EDGE_PADDING, MAX_ZOOM, minZoomFor, type MapExtent } from './cameraMath';

export { mapExtent, worldOffset } from './cameraMath';

export function createCamera(app: Application, extent: MapExtent): Viewport {
  const worldWidth = extent.maxX - extent.minX + EDGE_PADDING * 2;
  const worldHeight = extent.maxY - extent.minY + EDGE_PADDING * 2;
  const viewport = new Viewport({
    screenWidth: app.screen.width,
    screenHeight: app.screen.height,
    worldWidth,
    worldHeight,
    events: app.renderer.events,
    ticker: app.ticker,
    passiveWheel: false,
  });

  viewport
    .drag({ mouseButtons: 'all' })
    .pinch()
    .wheel({ smooth: 6, percent: 0.12 })
    .decelerate({ friction: 0.93 });

  const applyLimits = () => {
    viewport.clampZoom({ minScale: minZoomFor(extent, app.screen.width, app.screen.height), maxScale: MAX_ZOOM });
    viewport.clamp({ direction: 'all', underflow: 'center' });
  };
  applyLimits();

  app.renderer.on('resize', (w: number, h: number) => {
    viewport.resize(w, h);
    applyLimits();
  });

  // Right-drag pans the map, so the browser menu would only get in the way.
  app.canvas.addEventListener('contextmenu', (e) => e.preventDefault());

  viewport.setZoom(1, true);
  viewport.moveCenter(worldWidth / 2, worldHeight / 2);
  return viewport;
}

/** While a tool is active, left-drag belongs to the tool; middle/right still pan. */
export function setToolDrag(viewport: Viewport, toolActive: boolean): void {
  // Re-adding the plugin replaces the old one and keeps its place in the plugin order.
  viewport.drag({ mouseButtons: toolActive ? 'middle-right' : 'all' });
}
