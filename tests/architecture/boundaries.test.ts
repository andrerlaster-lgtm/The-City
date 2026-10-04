/**
 * Architecture guards:
 *  - src/sim must stay pure (no rendering, UI, storage or browser globals),
 *    so it can be unit-tested, saved as plain data and moved to a Web Worker.
 *  - No source file grows past MAX_LINES.
 */
import { describe, expect, it } from 'vitest';

const MAX_LINES = 400;

// Vite reads the source files as text at test time (no Node APIs needed).
const SOURCES = import.meta.glob<string>('/src/**/*.{ts,tsx}', {
  query: '?raw',
  import: 'default',
  eager: true,
});

const FORBIDDEN_PACKAGES = ['pixi.js', 'pixi-viewport', 'react', 'react-dom', 'idb-keyval'];
const FORBIDDEN_LAYERS = ['render', 'ui', 'input', 'save', 'app'];
const FORBIDDEN_GLOBALS = /\b(window|document|localStorage|indexedDB|requestAnimationFrame|Math\.random)\b/;

function importsOf(source: string): string[] {
  return [...source.matchAll(/(?:import|export)[^'"]*?from\s*['"]([^'"]+)['"]/g)].map((m) => m[1] ?? '');
}

describe('simulation purity', () => {
  const simFiles = Object.entries(SOURCES).filter(([path]) => path.startsWith('/src/sim/'));

  it('has simulation files to check', () => {
    expect(simFiles.length).toBeGreaterThan(0);
  });

  for (const [rel, source] of simFiles) {
    // Ignore comments when checking for browser globals.
    const code = source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');

    it(`${rel} imports no rendering/UI/storage code`, () => {
      for (const spec of importsOf(source)) {
        expect(FORBIDDEN_PACKAGES, `${rel} imports ${spec}`).not.toContain(spec);
        for (const layer of FORBIDDEN_LAYERS) {
          expect(spec.includes(`/${layer}/`) || spec.endsWith(`/${layer}`), `${rel} imports ${spec}`).toBe(false);
        }
      }
    });

    it(`${rel} uses no browser globals or Math.random`, () => {
      expect(code).not.toMatch(FORBIDDEN_GLOBALS);
    });
  }
});

describe('file size', () => {
  for (const [rel, source] of Object.entries(SOURCES)) {
    it(`${rel} is at most ${MAX_LINES} lines`, () => {
      expect(source.split('\n').length).toBeLessThanOrEqual(MAX_LINES);
    });
  }
});
