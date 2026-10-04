/**
 * Terrain tile textures, drawn in code at start-up. Each texture is a 2:1
 * diamond, inflated by 1px so neighbouring tiles overlap and no seams show.
 * Per-tile variety comes from picking a variant and a slight tint.
 */
import { Graphics, Rectangle, Texture, type Renderer } from 'pixi.js';
import { Rng } from '../../core/rng';
import { TILE_HEIGHT, TILE_WIDTH } from '../../core/grid';
import { TerrainId } from '../../data/terrain';
import { PALETTE } from '../palette';

export const TILE_PAD = 1;
const W = TILE_WIDTH;
const H = TILE_HEIGHT;
const VARIANTS = 4;

export type TerrainTextures = Record<TerrainId, Texture[]>;

function diamond(g: Graphics, color: number): void {
  const p = TILE_PAD;
  g.poly([W / 2, -p, W + p, H / 2, W / 2, H + p, -p, H / 2]).fill(color);
}

/** Random point inside the diamond (for speckles), using the |x|+|y| test. */
function pointInDiamond(rng: Rng, margin: number): { x: number; y: number } {
  for (;;) {
    const u = rng.next() * 2 - 1;
    const v = rng.next() * 2 - 1;
    if (Math.abs(u) + Math.abs(v) <= 1 - margin) return { x: W / 2 + (u * W) / 2, y: H / 2 + (v * H) / 2 };
  }
}

function speckle(g: Graphics, rng: Rng, count: number, colors: number[], size: number, alpha: number): void {
  for (let i = 0; i < count; i++) {
    const { x, y } = pointInDiamond(rng, 0.08);
    const color = colors[rng.int(0, colors.length - 1)] ?? colors[0] ?? 0;
    g.ellipse(x, y, size * (0.6 + rng.next()), size * 0.5 * (0.6 + rng.next())).fill({ color, alpha });
  }
}

function drawGrass(g: Graphics, rng: Rng): void {
  diamond(g, PALETTE.grass);
  speckle(g, rng, 14, [PALETTE.grassLight, PALETTE.grassDark], 2.2, 0.55);
  // Small grass tufts: two short strokes.
  for (let i = 0; i < 4; i++) {
    const { x, y } = pointInDiamond(rng, 0.2);
    g.moveTo(x, y).lineTo(x - 1.5, y - 3).moveTo(x + 1.5, y).lineTo(x + 2.5, y - 3);
    g.stroke({ width: 1, color: PALETTE.grassDark, alpha: 0.7 });
  }
}

function drawSand(g: Graphics, rng: Rng): void {
  diamond(g, PALETTE.sand);
  speckle(g, rng, 12, [PALETTE.sandDark, PALETTE.highlight], 1.4, 0.5);
}

function drawWater(g: Graphics, rng: Rng): void {
  diamond(g, PALETTE.water);
  speckle(g, rng, 3, [PALETTE.waterDeep], 9, 0.18);
  for (let i = 0; i < 2; i++) {
    const { x, y } = pointInDiamond(rng, 0.3);
    g.moveTo(x - 5, y).quadraticCurveTo(x, y - 2, x + 5, y);
    g.stroke({ width: 1.2, color: PALETTE.waterLight, alpha: 0.6 });
  }
}

const DRAWERS: Record<TerrainId, (g: Graphics, rng: Rng) => void> = {
  [TerrainId.Grass]: drawGrass,
  [TerrainId.Sand]: drawSand,
  [TerrainId.Water]: drawWater,
};

export function buildTerrainTextures(renderer: Renderer): TerrainTextures {
  const frame = new Rectangle(-TILE_PAD, -TILE_PAD, W + TILE_PAD * 2, H + TILE_PAD * 2);
  const result = {} as TerrainTextures;
  for (const [idText, draw] of Object.entries(DRAWERS)) {
    const id = Number(idText) as TerrainId;
    result[id] = [];
    for (let v = 0; v < VARIANTS; v++) {
      const g = new Graphics();
      draw(g, new Rng(id * 100 + v + 1));
      result[id].push(renderer.generateTexture({ target: g, frame, resolution: 2, antialias: true }));
      g.destroy();
    }
  }
  return result;
}
