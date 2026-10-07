import { Graphics, Rectangle, type Renderer, type Texture } from 'pixi.js';
import type { BuildingDefinition } from '../../data/buildings';
import { TILE_HEIGHT, TILE_WIDTH } from '../../core/grid';
import { PALETTE } from '../palette';
import { BUILDING_SCHEMES, SCHEMED_ART, extraKey, schemeKey, shadeColor, type BuildingExtra, type BuildingScheme } from './buildingSchemes';

/** `anchorY` puts the texture's footprint diamond bottom on the sprite's position. */
export interface BuildingTexture { texture: Texture; width: number; height: number; anchorY: number; }
type Drawer = (g: Graphics, width: number, baseY: number, size: number, scheme: BuildingScheme) => void;

const DRAWERS: Record<string, Drawer> = {
  cottage: drawCottage,
  rowhouse: drawRowhouse,
  farm: drawFarm,
  workshop: drawWorkshop,
  well: drawWell,
  generic: drawGeneric,
};

/**
 * One texture per art key. Schemed art (homes, workshops) also gets one texture per
 * pastel scheme under `schemeKey(art, i)`; the plain key is scheme 0, for the ghost
 * and markers. Every scheme of an art key has the same size and anchor.
 */
export function buildBuildingTextures(renderer: Renderer, definitions: readonly BuildingDefinition[]): Map<string, BuildingTexture> {
  const result = new Map<string, BuildingTexture>();
  for (const definition of definitions) {
    if (!SCHEMED_ART.has(definition.art)) {
      result.set(definition.art, drawTexture(renderer, definition, BUILDING_SCHEMES[0]!));
      continue;
    }
    BUILDING_SCHEMES.forEach((scheme, i) => {
      const art = drawTexture(renderer, definition, scheme);
      result.set(schemeKey(definition.art, i), art);
      if (i === 0) result.set(definition.art, art);
    });
    for (const extra of ['lights', 'lived', 'vacant'] as const) result.set(extraKey(definition.art, extra), drawExtra(renderer, definition, extra));
  }
  return result;
}

/** An extra layer for a schemed building (see `BuildingExtra`), the same size and anchor as it. */
function drawExtra(renderer: Renderer, definition: BuildingDefinition, extra: BuildingExtra): BuildingTexture {
  const width = definition.size * TILE_WIDTH;
  const height = definition.size * TILE_HEIGHT + 72;
  const baseY = height - 12;
  const g = new Graphics();
  const shape = housePanels(width, baseY, definition.size);
  if (extra === 'lights') drawLights(g, shape);
  else if (extra === 'vacant') drawVacantSign(g, width, baseY, definition.size);
  else if (definition.housing > 0) drawLivedIn(g, shape);
  else drawCrates(g, width, baseY, definition.size);
  const frame = new Rectangle(0, 0, width, height);
  const texture = renderer.generateTexture({ target: g, frame, resolution: 2, antialias: true });
  g.destroy();
  return { texture, width, height, anchorY: baseY / height };
}

/** Warm window and door light for the evening. */
function drawLights(g: Graphics, shape: HouseShape): void {
  for (const panel of [shape.window, shape.door]) {
    g.poly(panel).fill({ color: PALETTE.windowLit, alpha: 0.95 });
    const [cx, cy] = centreOf(panel);
    g.ellipse(cx, cy, 12, 10).fill({ color: PALETTE.windowLit, alpha: 0.09 });
  }
}

/** Someone lives here: a flower box under the window, a chimney and a doormat. */
function drawLivedIn(g: Graphics, shape: HouseShape): void {
  const [wx0, wy0, wx1, wy1] = shape.windowFrame;
  g.poly([wx0! - 1, wy0! + 1, wx1! + 1, wy1! + 1, wx1! + 1, wy1! + 5, wx0! - 1, wy0! + 5]).fill(PALETTE.planter);
  for (let i = 0; i < 4; i++) {
    const t = (i + 0.5) / 4;
    g.circle(wx0! + (wx1! - wx0!) * t, wy0! + (wy1! - wy0!) * t - 0.5, 2.2).fill(i % 2 ? PALETTE.flowerA : PALETTE.flowerB);
  }
  const chimneyX = shape.left + shape.bodyW * 0.22;
  const chimneyBase = shape.bodyTop - 4;
  g.rect(chimneyX, chimneyBase - 13, 6, 13).fill(PALETTE.chimney);
  g.rect(chimneyX - 1, chimneyBase - 15, 8, 3).fill(shadeColor(PALETTE.chimney, 0.8));
  const [dx0, dy0, dx1, dy1] = shape.door;
  g.poly([dx0! - 2, dy0! + 1, dx1! + 2, dy1! + 1, dx1! - 1, dy1! + 4, dx0! - 5, dy0! + 4]).fill(PALETTE.doormat);
}

/** A busy workshop: a few crates stacked on the lot. */
function drawCrates(g: Graphics, width: number, baseY: number, size: number): void {
  const x = width * 0.2; const y = baseY - size * TILE_HEIGHT * 0.42;
  for (const [ox, oy] of [[0, 0], [9, 4], [4, -7]] as const) {
    g.rect(x + ox, y + oy - 7, 8, 7).fill(PALETTE.crate);
    g.rect(x + ox, y + oy - 7, 8, 2).fill(shadeColor(PALETTE.crate, 1.15));
    g.moveTo(x + ox, y + oy - 7).lineTo(x + ox + 8, y + oy).stroke({ color: shadeColor(PALETTE.crate, 0.75), width: 1 });
  }
}

/** Nobody here yet: a small sign post on the front of the lot. */
function drawVacantSign(g: Graphics, width: number, baseY: number, size: number): void {
  const x = width * 0.74; const y = baseY - size * TILE_HEIGHT * 0.3;
  g.rect(x - 1, y - 16, 2.5, 16).fill(PALETTE.trunk);
  g.roundRect(x - 8, y - 22, 16, 9, 2).fill(PALETTE.signBoard);
  g.rect(x - 5, y - 18.5, 10, 1.5).fill(PALETTE.signInk);
}

function centreOf(points: readonly number[]): [number, number] {
  let x = 0; let y = 0;
  for (let i = 0; i < points.length; i += 2) { x += points[i]!; y += points[i + 1]!; }
  return [x / (points.length / 2), y / (points.length / 2)];
}

function drawTexture(renderer: Renderer, definition: BuildingDefinition, scheme: BuildingScheme): BuildingTexture {
  const width = definition.size * TILE_WIDTH;
  const height = definition.size * TILE_HEIGHT + 72;
  const baseY = height - 12;
  const g = new Graphics();
  g.ellipse(width / 2 + 3, baseY, width * 0.34, 10).fill({ color: PALETTE.shadow, alpha: 0.25 });
  g.poly([width / 2, baseY - definition.size * TILE_HEIGHT, width, baseY - definition.size * TILE_HEIGHT / 2, width / 2, baseY, 0, baseY - definition.size * TILE_HEIGHT / 2]).fill(PALETTE.lotGround);
  (DRAWERS[definition.art] ?? DRAWERS.generic ?? drawGeneric)(g, width, baseY, definition.size, scheme);
  const frame = new Rectangle(0, 0, width, height);
  const texture = renderer.generateTexture({ target: g, frame, resolution: 2, antialias: true });
  g.destroy();
  return { texture, width, height, anchorY: baseY / height };
}

interface HouseShape {
  center: number; left: number; right: number; bodyW: number; ground: number; bodyTop: number;
  /** Polygons on the wall faces: the glass and door, plus their slightly larger frames. */
  door: number[]; doorFrame: number[]; window: number[]; windowFrame: number[];
}

/** Geometry shared by the house art and its evening lights. */
function housePanels(width: number, baseY: number, size: number): HouseShape {
  const footprintH = size * TILE_HEIGHT;
  const center = width / 2;
  const bodyW = Math.max(30, size * TILE_WIDTH * 0.48);
  const left = center - bodyW / 2;
  const ground = baseY - footprintH * 0.45;
  const bodyTop = ground - (35 + size * 3);
  // Door on the sunlit wall, window on the shaded one; both follow the wall's slope.
  const slope = 8 / (bodyW / 2);
  const front = (x: number) => ground + (x - left) * slope;
  const side = (x: number) => ground + 8 - (x - center) * slope;
  const doorX = left + bodyW * 0.22;
  const windowX = center + bodyW * 0.14;
  return {
    center, left, right: left + bodyW, bodyW, ground, bodyTop,
    doorFrame: panel(doorX - 1.5, doorX + 10.5, front, 19, 0),
    door: panel(doorX + 1, doorX + 8, front, 16, 0),
    windowFrame: panel(windowX - 1.5, windowX + 11.5, side, 26, 12),
    window: panel(windowX, windowX + 10, side, 24.5, 13.5),
  };
}

/** A house: sunlit left wall with the door, shaded right wall with a window, roof with a lit ridge. */
function drawHouse(g: Graphics, width: number, baseY: number, size: number, scheme: BuildingScheme, roof = scheme.roof): void {
  const { center, left, right, ground, bodyTop, door, doorFrame, window, windowFrame } = housePanels(width, baseY, size);
  g.poly([left, bodyTop, center, bodyTop + 10, center, ground + 8, left, ground]).fill(scheme.wall);
  g.poly([center, bodyTop + 10, right, bodyTop, right, ground, center, ground + 8]).fill(shadeColor(scheme.wall, 0.82));
  g.poly(doorFrame).fill(scheme.trim);
  g.poly(door).fill(PALETTE.door);
  g.poly(windowFrame).fill(scheme.trim);
  g.poly(window).fill(PALETTE.waterLight);
  // Roof: a lower, cosier peak; the far slope in shade, then a pale ridge line.
  const peak = bodyTop - 16;
  g.poly([left - 6, bodyTop + 4, center, peak, right + 6, bodyTop + 4, center, bodyTop + 18]).fill(roof);
  g.poly([center, peak, right + 6, bodyTop + 4, center, bodyTop + 18]).fill(shadeColor(roof, 0.86));
  g.moveTo(left - 6, bodyTop + 4).lineTo(center, peak).stroke({ color: scheme.trim, width: 1.5, alpha: 0.7 });
}

/** A panel on a sloped wall: x0..x1 across, from `bottom` px up to `top` px above the wall's base line. */
function panel(x0: number, x1: number, base: (x: number) => number, top: number, bottom: number): number[] {
  return [x0, base(x0) - bottom, x1, base(x1) - bottom, x1, base(x1) - top, x0, base(x0) - top];
}

function drawCottage(g: Graphics, width: number, baseY: number, size: number, scheme: BuildingScheme): void { drawHouse(g, width, baseY, size, scheme); }
function drawRowhouse(g: Graphics, width: number, baseY: number, size: number, scheme: BuildingScheme): void { drawHouse(g, width, baseY, size, scheme); }
/** Workshops keep a slate roof so they still read as work, not homes. */
function drawWorkshop(g: Graphics, width: number, baseY: number, size: number, scheme: BuildingScheme): void { drawHouse(g, width, baseY, size, scheme, PALETTE.slateRoof); }

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

function drawGeneric(g: Graphics, width: number, baseY: number, size: number, scheme: BuildingScheme): void {
  drawHouse(g, width, baseY, size, scheme, 0x87918b);
}
