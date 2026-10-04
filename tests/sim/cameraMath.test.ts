import { describe, expect, it } from 'vitest';
import { screenToTile, tileToScreen } from '../../src/core/grid';
import { EDGE_PADDING, footprintBottom, mapExtent, minZoomFor, worldOffset } from '../../src/render/cameraMath';

describe('camera geometry', () => {
  const extent = mapExtent(128, 128);

  it('covers all four map corners', () => {
    for (const [x, y] of [[0, 0], [127, 0], [0, 127], [127, 127]] as const) {
      const p = tileToScreen(x, y);
      expect(p.x).toBeGreaterThanOrEqual(extent.minX);
      expect(p.x).toBeLessThanOrEqual(extent.maxX);
      expect(p.y).toBeGreaterThanOrEqual(extent.minY);
      expect(p.y).toBeLessThanOrEqual(extent.maxY);
    }
  });

  it('offsets the map so its world box starts at (padding, padding)', () => {
    const o = worldOffset(extent);
    expect(extent.minX + o.x).toBe(EDGE_PADDING);
    expect(extent.minY + o.y).toBe(EDGE_PADDING);
  });

  it('min zoom fits the whole map and never exceeds 1', () => {
    const z = minZoomFor(extent, 1600, 900);
    expect((extent.maxX - extent.minX) * z).toBeLessThanOrEqual(1600);
    expect((extent.maxY - extent.minY) * z).toBeLessThanOrEqual(900);
    expect(minZoomFor(mapExtent(4, 4), 1600, 900)).toBe(1);
  });

  it('picks the right tile anywhere inside a diamond', () => {
    const top = tileToScreen(40, 70);
    // Points just inside each corner of tile (40, 70)'s diamond.
    for (const [dx, dy] of [[0, 2], [30, 16], [0, 30], [-30, 16], [0, 16]] as const) {
      expect(screenToTile(top.x + dx, top.y + dy)).toEqual({ x: 40, y: 70 });
    }
  });
});

describe('footprint bottom corner', () => {
  // Cursor (5, 5) gives origins (5, 5), (5, 5) and (4, 4) for sizes 1, 2 and 3.
  it('is the front corner of 1x1, 2x2 and 3x3 footprints', () => {
    expect(footprintBottom(5, 5, 1)).toEqual({ x: 0, y: 192 });
    expect(footprintBottom(5, 5, 2)).toEqual({ x: 0, y: 224 });
    expect(footprintBottom(4, 4, 3)).toEqual({ x: 0, y: 224 });
    expect(footprintBottom(2, 6, 2)).toEqual({ x: -128, y: 192 });
  });

  it('is the bottom corner of the footprint\'s last tile, directly below its first tile\'s top corner on the diagonal', () => {
    for (const size of [1, 2, 3]) {
      const top = tileToScreen(3, 7);
      const lastTop = tileToScreen(3 + size - 1, 7 + size - 1);
      const bottom = footprintBottom(3, 7, size);
      expect(bottom).toEqual({ x: lastTop.x, y: lastTop.y + 32 });
      expect(bottom.x).toBe(top.x);
      expect(bottom.y - top.y).toBe(size * 32);
    }
  });
});
