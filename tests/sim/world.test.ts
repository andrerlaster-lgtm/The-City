import { describe, expect, it } from 'vitest';
import { toIndex } from '../../src/core/grid';
import { TerrainId, TreeKind } from '../../src/data/terrain';
import { generateWorld } from '../../src/sim/world/generate';
import { fractalNoise } from '../../src/sim/world/noise';
import { isBuildableTerrain, terrainAt } from '../../src/sim/world/World';

const SIZE = 128;
const SEEDS = [1, 42, 20261004, 987654, 31337];

function share(layer: Uint8Array, predicate: (v: number) => boolean): number {
  let n = 0;
  for (const v of layer) if (predicate(v)) n++;
  return n / layer.length;
}

describe('noise', () => {
  it('is deterministic and stays in [0, 1]', () => {
    for (let i = 0; i < 500; i++) {
      const v = fractalNoise(i * 0.37, i * 0.11, 9, 4);
      expect(v).toBe(fractalNoise(i * 0.37, i * 0.11, 9, 4));
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThanOrEqual(1);
    }
  });
});

describe('generateWorld', () => {
  it('is identical for the same seed', () => {
    const a = generateWorld(42, SIZE, SIZE);
    const b = generateWorld(42, SIZE, SIZE);
    expect(a.terrain).toEqual(b.terrain);
    expect(a.trees).toEqual(b.trees);
    expect(a.variant).toEqual(b.variant);
  });

  it('differs between seeds', () => {
    expect(generateWorld(1, SIZE, SIZE).terrain).not.toEqual(generateWorld(2, SIZE, SIZE).terrain);
  });

  it('supports other map sizes without code changes', () => {
    const w = generateWorld(5, 64, 200);
    expect(w.terrain.length).toBe(64 * 200);
  });

  for (const seed of SEEDS) {
    it(`seed ${seed}: mostly land, some water, buildable centre, trees only on grass`, () => {
      const w = generateWorld(seed, SIZE, SIZE);
      const water = share(w.terrain, (v) => v === TerrainId.Water);
      expect(water).toBeGreaterThan(0.03);
      expect(water).toBeLessThan(0.4);
      expect(share(w.trees, (v) => v !== TreeKind.None)).toBeGreaterThan(0.03);

      // The middle 16×16 is at least 80% buildable.
      let buildable = 0;
      for (let y = 56; y < 72; y++) for (let x = 56; x < 72; x++) if (isBuildableTerrain(w, x, y)) buildable++;
      expect(buildable / 256).toBeGreaterThan(0.8);

      for (let i = 0; i < w.trees.length; i++) {
        if (w.trees[i] !== TreeKind.None) expect(w.terrain[i]).toBe(TerrainId.Grass);
      }
    });
  }

  it('reports out-of-bounds tiles as null', () => {
    const w = generateWorld(1, 8, 8);
    expect(terrainAt(w, -1, 0)).toBeNull();
    expect(terrainAt(w, 8, 0)).toBeNull();
    expect(terrainAt(w, 3, 3)).toBe(w.terrain[toIndex(3, 3, 8)]);
  });
});
