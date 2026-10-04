/**
 * Everything that stands up off the ground (trees now; buildings later),
 * depth-sorted so nearer objects draw over farther ones.
 */
import { Container, Sprite } from 'pixi.js';
import { TILE_HEIGHT, tileToScreen } from '../../core/grid';
import { TreeKind } from '../../data/terrain';
import type { WorldMap } from '../../sim/world/World';
import type { TreeTexture } from '../art/treeArt';

/** Depth key: tiles further down-screen (larger x + y) draw on top. */
export function depthOf(x: number, y: number, sub = 0): number {
  return (x + y) * 4 + sub;
}

export class ObjectLayer {
  readonly container = new Container({ label: 'objects', sortableChildren: true });
  private trees = new Map<number, Sprite>();

  constructor(private readonly treeTextures: Map<TreeKind, TreeTexture>) {}

  build(world: Readonly<WorldMap>): void {
    this.container.removeChildren().forEach((c) => c.destroy());
    this.trees.clear();
    for (let i = 0; i < world.trees.length; i++) this.applyTree(world, i);
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
    if (!existing) {
      this.trees.set(index, sprite);
      this.container.addChild(sprite);
    }
  }
}
