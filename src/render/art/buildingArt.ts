import { Graphics, Rectangle, type Renderer, type Texture } from 'pixi.js';
import type { BuildingDefinition } from '../../data/buildings';
import { TILE_HEIGHT, TILE_WIDTH } from '../../core/grid';
import { PALETTE } from '../palette';
import { BUILDING_SCHEMES, SCHEMED_ART, lightsKey, schemeKey, shadeColor, type BuildingScheme } from './buildingSchemes';

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
    result.set(lightsKey(definition.art), drawLights(renderer, definition));
  }
  return result;
}

/** Warm window and door light for the evening, the same size and anchor as the building. */
function drawLights(renderer: Renderer, definition: BuildingDefinition): BuildingTexture {
  const width = definition.size * TILE_WIDTH;
  const height = definition.size * TILE_HEIGHT + 72;
  const baseY = height - 12;
  const g = new Graphics();
  const panels = housePanels(width, baseY, definition.size);
  for (const panel of [panels.window, panels.door]) {
    g.poly(panel).fill({ color: PALETTE.windowLit, alpha: 0.95 });
    const [cx, cy] = centreOf(panel);
    g.ellipse(cx, cy, 12, 10).fill({ color: PALETTE.windowLit, alpha: 0.09 });
  }
  const frame = new Rectangle(0, 0, width, height);
  const texture = renderer.generateTexture({ target: g, frame, resolution: 2, antialias: true });
  g.destroy();
  return { texture, width, height, anchorY: baseY / height };
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
