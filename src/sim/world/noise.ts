/**
 * Seeded 2D value noise with fractal octaves. Deterministic for a seed,
 * independent of Math.random. Output roughly in [0, 1].
 */

function hash(x: number, y: number, seed: number): number {
  let h = Math.imul(x, 374761393) ^ Math.imul(y, 668265263) ^ Math.imul(seed, 2147483647);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}

const smooth = (t: number): number => t * t * (3 - 2 * t);
const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;

/** Smoothly interpolated noise on an integer lattice. */
export function valueNoise(x: number, y: number, seed: number): number {
  const x0 = Math.floor(x);
  const y0 = Math.floor(y);
  const tx = smooth(x - x0);
  const ty = smooth(y - y0);
  const top = lerp(hash(x0, y0, seed), hash(x0 + 1, y0, seed), tx);
  const bottom = lerp(hash(x0, y0 + 1, seed), hash(x0 + 1, y0 + 1, seed), tx);
  return lerp(top, bottom, ty);
}

/** Fractal (multi-octave) noise, normalised to [0, 1]. */
export function fractalNoise(x: number, y: number, seed: number, octaves: number): number {
  let sum = 0;
  let amplitude = 1;
  let frequency = 1;
  let total = 0;
  for (let o = 0; o < octaves; o++) {
    sum += valueNoise(x * frequency, y * frequency, seed + o * 1013) * amplitude;
    total += amplitude;
    amplitude *= 0.5;
    frequency *= 2;
  }
  return sum / total;
}
