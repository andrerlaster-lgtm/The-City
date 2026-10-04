/**
 * Seeded world generation: elevation decides water / sand / grass,
 * moisture decides forests. Same seed → identical world.
 *
 * Thresholds are quantiles of each map's own values (e.g. "the lowest 16%
 * is water"), so every seed gets a similar balance of land and water.
 */
import { Rng } from '../../core/rng';
import { WORLDGEN } from '../../data/balance';
import { TerrainId, TreeKind } from '../../data/terrain';
import { fractalNoise } from './noise';
import { createEmptyWorld, type WorldMap } from './World';
import { placeSettlementEntrance } from '../roads';

export function generateWorld(seed: number, width: number, height: number): WorldMap {
  const world = createEmptyWorld(width, height);
  const size = width * height;
  const rng = new Rng(seed ^ 0x5eed);
  const elevation = new Float32Array(size);
  const moisture = new Float32Array(size);
  const freqX = WORLDGEN.baseFrequency / width;
  const freqY = WORLDGEN.baseFrequency / height;

  for (let y = 0, i = 0; y < height; y++) {
    for (let x = 0; x < width; x++, i++) {
      elevation[i] = elevationAt(x, y, width, height, seed, freqX, freqY);
      moisture[i] = fractalNoise(x * freqX * 2, y * freqY * 2, seed + 7919, 3);
    }
  }

  const waterLevel = quantile(elevation, WORLDGEN.waterShare);
  const sandLevel = quantile(elevation, WORLDGEN.waterShare + WORLDGEN.sandShare);
  const forestMoisture = quantile(moisture, 1 - WORLDGEN.forestShare);

  for (let i = 0; i < size; i++) {
    const e = elevation[i] ?? 0;
    const terrain = e < waterLevel ? TerrainId.Water : e < sandLevel ? TerrainId.Sand : TerrainId.Grass;
    world.terrain[i] = terrain;
    world.variant[i] = rng.int(0, 255);
    if (terrain === TerrainId.Grass) world.trees[i] = pickTree(moisture[i] ?? 0, forestMoisture, rng);
  }
  placeSettlementEntrance(world);
  return world;
}

function elevationAt(
  x: number,
  y: number,
  width: number,
  height: number,
  seed: number,
  freqX: number,
  freqY: number,
): number {
  const base = fractalNoise(x * freqX, y * freqY, seed, WORLDGEN.octaves);
  // Distance from centre: 0 at the middle, ~1 at the corners.
  const dx = (x / (width - 1)) * 2 - 1;
  const dy = (y / (height - 1)) * 2 - 1;
  const d = Math.min(1, Math.sqrt(dx * dx + dy * dy) / Math.SQRT2);
  return base + WORLDGEN.centreLift * (1 - d * d);
}

/** Value below which `share` of the samples fall. */
function quantile(values: Float32Array, share: number): number {
  const sorted = Float32Array.from(values).sort();
  const index = Math.min(sorted.length - 1, Math.max(0, Math.floor(share * sorted.length)));
  return sorted[index] ?? 0;
}

function pickTree(moisture: number, forestMoisture: number, rng: Rng): TreeKind {
  const forest = moisture > forestMoisture;
  // Forests are dense but not solid; open land gets the odd lone tree.
  const chance = forest ? Math.min(0.85, 0.55 + (moisture - forestMoisture) * 3) : WORLDGEN.scatteredTreeChance;
  if (rng.next() >= chance) return TreeKind.None;
  const roll = rng.next();
  if (forest) return roll < 0.55 ? TreeKind.Pine : roll < 0.9 ? TreeKind.Round : TreeKind.Bush;
  return roll < 0.5 ? TreeKind.Round : TreeKind.Bush;
}
