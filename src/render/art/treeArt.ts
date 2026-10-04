/**
 * Tree textures, drawn in code. Each is anchored at the trunk base so it can
 * be planted on a tile centre. Lit from the upper left.
 */
import { Graphics, Rectangle, type Renderer, type Texture } from 'pixi.js';
import { TreeKind } from '../../data/terrain';
import { PALETTE } from '../palette';

export interface TreeTexture {
  texture: Texture;
  /** Anchor (0–1) at the trunk base. */
  anchorX: number;
  anchorY: number;
}

const TW = 40;
const TH = 60;
const BASE_X = TW / 2;
const BASE_Y = TH - 6;

function groundShadow(g: Graphics, rx: number): void {
  g.ellipse(BASE_X + 3, BASE_Y, rx, rx * 0.45).fill({ color: PALETTE.shadow, alpha: 0.28 });
}

function drawRound(g: Graphics): void {
  groundShadow(g, 12);
  g.rect(BASE_X - 2, BASE_Y - 16, 4, 16).fill(PALETTE.trunk);
  g.circle(BASE_X + 3, BASE_Y - 22, 11).fill(PALETTE.leafDark);
  g.circle(BASE_X - 3, BASE_Y - 25, 11).fill(PALETTE.leaf);
  g.circle(BASE_X + 1, BASE_Y - 31, 9).fill(PALETTE.leaf);
  g.circle(BASE_X - 5, BASE_Y - 29, 5).fill({ color: PALETTE.leafLight, alpha: 0.9 });
}

function drawPine(g: Graphics): void {
  groundShadow(g, 9);
  g.rect(BASE_X - 2, BASE_Y - 8, 4, 8).fill(PALETTE.trunk);
  const tiers = [
    { y: BASE_Y - 6, w: 12, h: 18 },
    { y: BASE_Y - 17, w: 10, h: 16 },
    { y: BASE_Y - 27, w: 7, h: 15 },
  ];
  for (const t of tiers) {
    // Right half in shade, left half lit.
    g.poly([BASE_X, t.y - t.h, BASE_X + t.w, t.y, BASE_X, t.y]).fill(PALETTE.pineDark);
    g.poly([BASE_X, t.y - t.h, BASE_X, t.y, BASE_X - t.w, t.y]).fill(PALETTE.pine);
    g.poly([BASE_X, t.y - t.h, BASE_X - t.w * 0.45, t.y - t.h * 0.45, BASE_X - 1, t.y - t.h * 0.4]).fill({
      color: PALETTE.pineLight,
      alpha: 0.8,
    });
  }
}

function drawBush(g: Graphics): void {
  groundShadow(g, 9);
  g.circle(BASE_X + 4, BASE_Y - 5, 6).fill(PALETTE.leafDark);
  g.circle(BASE_X - 3, BASE_Y - 6, 6.5).fill(PALETTE.leaf);
  g.circle(BASE_X + 1, BASE_Y - 10, 5.5).fill(PALETTE.leaf);
  g.circle(BASE_X - 4, BASE_Y - 9, 2.8).fill({ color: PALETTE.leafLight, alpha: 0.9 });
}

const DRAWERS: Record<Exclude<TreeKind, 0>, (g: Graphics) => void> = {
  [TreeKind.Round]: drawRound,
  [TreeKind.Pine]: drawPine,
  [TreeKind.Bush]: drawBush,
};

export function buildTreeTextures(renderer: Renderer): Map<TreeKind, TreeTexture> {
  const frame = new Rectangle(0, 0, TW, TH);
  const result = new Map<TreeKind, TreeTexture>();
  for (const [kindText, draw] of Object.entries(DRAWERS)) {
    const g = new Graphics();
    draw(g);
    const texture = renderer.generateTexture({ target: g, frame, resolution: 2, antialias: true });
    result.set(Number(kindText) as TreeKind, { texture, anchorX: BASE_X / TW, anchorY: BASE_Y / TH });
    g.destroy();
  }
  return result;
}
