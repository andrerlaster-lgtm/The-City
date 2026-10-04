import { describe, expect, it } from 'vitest';
import { EventBus } from '../../src/core/events';
import { fromIndex, screenToTile, tileToScreen, toIndex } from '../../src/core/grid';
import { Rng } from '../../src/core/rng';

describe('Rng', () => {
  it('gives the same sequence for the same seed', () => {
    const a = new Rng(42);
    const b = new Rng(42);
    for (let i = 0; i < 100; i++) expect(a.next()).toBe(b.next());
  });

  it('stays in [0, 1)', () => {
    const r = new Rng(7);
    for (let i = 0; i < 10_000; i++) {
      const v = r.next();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });

  it('resumes exactly from a saved state', () => {
    const r = new Rng(99);
    r.next();
    const saved = r.getState();
    const expected = [r.next(), r.next()];
    const restored = new Rng(0);
    restored.setState(saved);
    expect([restored.next(), restored.next()]).toEqual(expected);
  });

  it('int() is inclusive of both ends', () => {
    const r = new Rng(1);
    const seen = new Set<number>();
    for (let i = 0; i < 1000; i++) seen.add(r.int(1, 3));
    expect([...seen].sort()).toEqual([1, 2, 3]);
  });
});

describe('grid', () => {
  it('round-trips flat indexes', () => {
    expect(fromIndex(toIndex(5, 9, 128), 128)).toEqual({ x: 5, y: 9 });
  });

  it('round-trips iso projection through tile centres', () => {
    for (const [x, y] of [[0, 0], [3, 7], [100, 20], [127, 127]] as const) {
      const top = tileToScreen(x, y);
      // Centre of the diamond is half a tile below its top corner.
      expect(screenToTile(top.x, top.y + 16)).toEqual({ x, y });
    }
  });
});

describe('EventBus', () => {
  it('delivers typed payloads and unsubscribes', () => {
    const bus = new EventBus<{ ping: number }>();
    const got: number[] = [];
    const off = bus.on('ping', (n) => got.push(n));
    bus.emit('ping', 1);
    off();
    bus.emit('ping', 2);
    expect(got).toEqual([1]);
  });
});
