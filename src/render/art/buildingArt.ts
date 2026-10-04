import { Graphics, Rectangle, type Renderer, type Texture } from 'pixi.js';
import type { BuildingDefinition } from '../../data/buildings';
import { TILE_HEIGHT, TILE_WIDTH } from '../../core/grid';
import { PALETTE } from '../palette';

/** `anchorY` puts the texture's footprint diamond bottom on the sprite's position. */
export interface BuildingTexture { texture: Texture; width: number; height: number; anchorY: number; }
type Drawer = (g: Graphics, width: number, baseY: number, size: number) => void;

const DRAWERS: Record<string, Drawer> = {
  cottage: drawCottage,
  rowhouse: drawRowhouse,
  farm: drawFarm,
  workshop: drawWorkshop,
  well: drawWell,
  generic: drawGeneric,
};

export function buildBuildingTextures(renderer: Renderer, definitions: readonly BuildingDefinition[]): Map<string, BuildingTexture> {
  const result = new Map<string, BuildingTexture>();
  for (const definition of definitions) {
    const width = definition.size * TILE_WIDTH;
    const height = definition.size * TILE_HEIGHT + 72;
    const baseY = height - 12;
    const g = new Graphics();
    g.ellipse(width / 2 + 3, baseY, width * 0.34, 10).fill({ color: PALETTE.shadow, alpha: 0.35 });
    g.poly([width / 2, baseY - definition.size * TILE_HEIGHT, width, baseY - definition.size * TILE_HEIGHT / 2, width / 2, baseY, 0, baseY - definition.size * TILE_HEIGHT / 2]).fill(PALETTE.soilDark);
    (DRAWERS[definition.art] ?? DRAWERS.generic ?? drawGeneric)(g, width, baseY, definition.size);
    const frame = new Rectangle(0, 0, width, height);
    const texture = renderer.generateTexture({ target: g, frame, resolution: 2, antialias: true });
    result.set(definition.art, { texture, width, height, anchorY: baseY / height });
    g.destroy();
  }
  return result;
}

function drawHouse(g: Graphics, width: number, baseY: number, size: number, roof: number): void {
  const footprintH = size * TILE_HEIGHT;
  const center = width / 2;
  const bodyW = Math.max(30, size * TILE_WIDTH * 0.48);
  const bodyH = 35 + size * 3;
  const left = center - bodyW / 2;
  const bodyTop = baseY - footprintH * 0.45 - bodyH;
  g.poly([left, bodyTop, center, bodyTop + 10, center, baseY - footprintH * 0.45 + 8, left, baseY - footprintH * 0.45]).fill(PALETTE.wallCream);
  g.poly([center, bodyTop + 10, left + bodyW, bodyTop, left + bodyW, baseY - footprintH * 0.45, center, baseY - footprintH * 0.45 + 8]).fill(PALETTE.soilLight);
  g.poly([left - 6, bodyTop + 4, center, bodyTop - 21, left + bodyW + 6, bodyTop + 4, center, bodyTop + 18]).fill(roof);
  g.rect(center - 5, baseY - footprintH * 0.45 - 24, 10, 24).fill(PALETTE.trunk);
  g.rect(left + 8, bodyTop + 14, 9, 9).fill(PALETTE.waterLight);
}

function drawCottage(g: Graphics, width: number, baseY: number, size: number): void { drawHouse(g, width, baseY, size, PALETTE.roofRed); }
function drawRowhouse(g: Graphics, width: number, baseY: number, size: number): void { drawHouse(g, width, baseY, size, 0x9d5143); }
function drawWorkshop(g: Graphics, width: number, baseY: number, size: number): void { drawHouse(g, width, baseY, size, 0x687d85); }

function drawFarm(g: Graphics, width: number, baseY: number, size: number): void {
  const center = width / 2; const left = center - width * 0.24; const top = baseY - size * TILE_HEIGHT * 0.45 - 26;
  g.poly([left, top, center, top + 9, center, baseY - 8, left, baseY]).fill(PALETTE.wallCream);
  g.poly([center, top + 9, left + width * 0.48, top, left + width * 0.48, baseY - 5, center, baseY - 8]).fill(PALETTE.soilLight);
  g.poly([left - 8, top + 3, center, top - 16, left + width * 0.48 + 8, top + 3, center, top + 21]).fill(0xd5ad55);
  for (let i = 0; i < 3; i++) g.moveTo(left - 8, baseY - 8 - i * 5).lineTo(left + width * 0.48 + 8, baseY - 8 - i * 5).stroke({ color: PALETTE.grassDark, width: 2 });
}

function drawWell(g: Graphics, width: number, baseY: number): void {
  const center = width / 2;
  g.ellipse(center, baseY - 8, 18, 8).fill(PALETTE.soilDark);
  g.ellipse(center, baseY - 10, 15, 6).fill(PALETTE.water);
  g.rect(center - 15, baseY - 35, 4, 27).fill(PALETTE.soilLight);
  g.rect(center + 11, baseY - 35, 4, 27).fill(PALETTE.soilDark);
  g.moveTo(center - 18, baseY - 36).lineTo(center, baseY - 46).lineTo(center + 18, baseY - 36).stroke({ color: PALETTE.trunk, width: 4 });
}

function drawGeneric(g: Graphics, width: number, baseY: number, size: number): void {
  drawHouse(g, width, baseY, size, 0x87918b);
}
