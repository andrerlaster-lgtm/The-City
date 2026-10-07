/**
 * Trees and buildings share one depth-sorted layer,
 * depth-sorted so nearer objects draw over farther ones.
 */
import { Container, Graphics, Sprite } from 'pixi.js';
import { TILE_HEIGHT, tileToScreen } from '../../core/grid';
import { TreeKind } from '../../data/terrain';
import type { WorldMap } from '../../sim/world/World';
import type { TreeTexture } from '../art/treeArt';
import type { BuildingTexture } from '../art/buildingArt';
import { buildingTextureKey, extraKey } from '../art/buildingSchemes';
import { windowGlowFor } from '../occupancy';
import type { BuildingInstance } from '../../sim/buildings/buildings';
import { buildingDefinition } from '../../data/buildings';
import { footprintBottom } from '../cameraMath';

/** Depth key: tiles further down-screen (larger x + y) draw on top. */
export function depthOf(x: number, y: number, sub = 0): number {
  return (x + y) * 4 + sub;
}

/** Extra sprites drawn over a schemed building (see art/buildingSchemes `BuildingExtra`). */
interface Extras { lights?: Sprite; lived?: Sprite; vacant?: Sprite; connected: boolean }

export class ObjectLayer {
  readonly container = new Container({ label: 'objects', sortableChildren: true });
  private trees = new Map<number, Sprite>();
  private buildings = new Map<number, Sprite>();
  /** Window light (untinted), lived-in details and vacant sign per building. */
  private extras = new Map<number, Extras>();
  private selected: number | null = null;
  /** The current day/night tint and window glow (see render/lighting.ts). */
  private tint = 0xffffff;
  private glow = 0;
  /** How full each home or workplace is, 0–1 (see render/occupancy.ts). */
  private fill: ReadonlyMap<number, number> = new Map();

  constructor(private readonly treeTextures: Map<TreeKind, TreeTexture>, private readonly buildingTextures: Map<string, BuildingTexture>) {}

  build(world: Readonly<WorldMap>, buildings: readonly BuildingInstance[] = []): void {
    this.container.removeChildren().forEach((c) => c.destroy());
    this.trees.clear();
    this.buildings.clear();
    this.extras.clear();
    for (let i = 0; i < world.trees.length; i++) this.applyTree(world, i);
    this.applyBuildings(buildings);
  }

  /** The live sprite of a placed building (for effects), if it exists. */
  buildingSprite(id: number): Sprite | undefined { return this.buildings.get(id); }

  applyBuildings(buildings: readonly BuildingInstance[]): void {
    for (const child of [...this.container.children]) if (child.label.startsWith('building-outline-')) child.destroy();
    for (const sprite of this.buildings.values()) { this.container.removeChild(sprite); sprite.destroy(); }
    for (const extra of this.extras.values()) for (const sprite of [extra.lights, extra.lived, extra.vacant]) sprite?.destroy();
    this.buildings.clear();
    this.extras.clear();
    for (const building of buildings) {
      const definition = buildingDefinition(building.defId);
      if (!definition) continue;
      const art = this.buildingTextures.get(buildingTextureKey(definition.art, building.id)) ?? this.buildingTextures.get(definition.art);
      if (!art) continue;
      const sprite = new Sprite(art.texture);
      sprite.anchor.set(0.5, art.anchorY);
      const bottom = footprintBottom(building.x, building.y, definition.size);
      sprite.position.set(bottom.x, bottom.y);
      sprite.zIndex = depthOf(building.x + definition.size - 1, building.y + definition.size - 1, 3);
      sprite.cullable = true;
      sprite.tint = this.tint;
      this.buildings.set(building.id, sprite);
      this.container.addChild(sprite);
      const extras: Extras = {
        connected: building.connected,
        lived: this.extraSprite(sprite, extraKey(definition.art, 'lived'), 0.25),
        vacant: this.extraSprite(sprite, extraKey(definition.art, 'vacant'), 0.25),
        lights: this.extraSprite(sprite, extraKey(definition.art, 'lights'), 0.5),
      };
      if (extras.lights) extras.lights.tint = 0xffffff;
      this.extras.set(building.id, extras);
      this.showExtras(building.id, extras);
    }
    this.setSelected(this.selected);
  }

  /** Applies the day/night tint to trees and buildings and the evening glow to windows. */
  setDayLight(tint: number, glow: number): void {
    if (tint !== this.tint) {
      this.tint = tint;
      for (const sprite of this.trees.values()) sprite.tint = tint;
      for (const sprite of this.buildings.values()) sprite.tint = tint;
      for (const extra of this.extras.values()) for (const sprite of [extra.lived, extra.vacant]) if (sprite) sprite.tint = tint;
    }
    if (glow !== this.glow) {
      this.glow = glow;
      for (const [id, extra] of this.extras) this.showExtras(id, extra);
    }
  }

  /** New occupancy (once per game day, or after the city changes). */
  setOccupancy(fill: ReadonlyMap<number, number>): void {
    this.fill = fill;
    for (const [id, extra] of this.extras) this.showExtras(id, extra);
  }

  private extraSprite(body: Sprite, key: string, depth: number): Sprite | undefined {
    const art = this.buildingTextures.get(key);
    if (!art) return undefined;
    const sprite = new Sprite(art.texture);
    sprite.anchor.set(0.5, art.anchorY);
    sprite.position.copyFrom(body.position);
    sprite.zIndex = body.zIndex + depth;
    sprite.cullable = true;
    sprite.eventMode = 'none';
    sprite.tint = this.tint;
    this.container.addChild(sprite);
    return sprite;
  }

  /** Lived-in details once anyone is there, a vacant sign while empty, lights by how full. */
  private showExtras(id: number, extra: Extras): void {
    const ratio = this.fill.get(id);
    if (extra.lived) extra.lived.visible = (ratio ?? 0) > 0;
    if (extra.vacant) extra.vacant.visible = ratio === 0;
    if (extra.lights) {
      const glow = extra.connected ? windowGlowFor(this.glow, ratio) : 0;
      extra.lights.alpha = glow;
      extra.lights.visible = glow > 0.02;
    }
  }

  setSelected(id: number | null): void {
    this.selected = id;
    for (const child of [...this.container.children]) if (child.label.startsWith('building-outline-')) child.destroy();
    if (id === null) return;
    const sprite = this.buildings.get(id);
    if (!sprite) return;
    const top = -sprite.height * sprite.anchor.y;
    const outline = new Graphics().rect(-sprite.width / 2 - 3, top + 2, sprite.width + 6, sprite.height).stroke({ color: 0xfff6dc, width: 3 });
    outline.position.copyFrom(sprite.position);
    outline.zIndex = sprite.zIndex + 2;
    outline.label = `building-outline-${id}`;
    this.container.addChild(outline);
  }

  /** Add, change or remove the tree on one tile. */
  applyTree(world: Readonly<WorldMap>, index: number): void {
    const kind = (world.trees[index] ?? TreeKind.None) as TreeKind;
    const existing = this.trees.get(index);
    if (kind === TreeKind.None) {
      existing?.destroy();
      this.trees.delete(index);
      return;
    }
    const art = this.treeTextures.get(kind);
    if (!art) return;
    const sprite = existing ?? new Sprite();
    const x = index % world.width;
    const y = (index - x) / world.width;
    const variant = world.variant[index] ?? 0;
    const top = tileToScreen(x, y);
    // Nudge within the tile and vary the size a little, from the tile's variant.
    const offX = ((variant & 15) - 7.5) * 0.8;
    const offY = (((variant >> 4) & 7) - 3.5) * 0.8;
    const scale = 0.85 + ((variant >> 3) % 8) * 0.035;

    sprite.texture = art.texture;
    sprite.anchor.set(art.anchorX, art.anchorY);
    sprite.position.set(top.x + offX, top.y + TILE_HEIGHT / 2 + offY);
    sprite.scale.set(variant & 1 ? scale : -scale, scale);
    sprite.zIndex = depthOf(x, y, 2);
    sprite.cullable = true;
    sprite.tint = this.tint;
    if (!existing) {
      this.trees.set(index, sprite);
      this.container.addChild(sprite);
    }
  }
}
