/**
 * Ground tiles plus the "diorama" skirt along the map's two front edges.
 * Static after build; individual tiles can be refreshed by index later.
 */
import { Container, Graphics, Sprite } from 'pixi.js';
import { TILE_HEIGHT, TILE_WIDTH, tileToScreen } from '../../core/grid';
import { TerrainId } from '../../data/terrain';
import type { WorldMap } from '../../sim/world/World';
import { TILE_PAD, type TerrainTextures } from '../art/terrainArt';
import { SKIRT_DEPTH } from '../cameraMath';
import { PALETTE } from '../palette';


/** Slight per-tile tints so the ground never looks tiled. */
const TINTS = [0xffffff, 0xf7faf2, 0xfbfdf6, 0xf2f6ec, 0xfffdf6, 0xf9fbf4];

export class TerrainLayer {
  readonly container = new Container({ label: 'terrain' });
  private sprites: Sprite[] = [];

  constructor(private readonly textures: TerrainTextures) {}

  build(world: Readonly<WorldMap>): void {
    this.container.removeChildren().forEach((c) => c.destroy());
    this.sprites = [];
    const { width, height } = world;
    const anchorX = (TILE_WIDTH / 2 + TILE_PAD) / (TILE_WIDTH + TILE_PAD * 2);
    const anchorY = TILE_PAD / (TILE_HEIGHT + TILE_PAD * 2);

    this.container.addChild(this.buildSkirt(world));

    for (let y = 0, i = 0; y < height; y++) {
      for (let x = 0; x < width; x++, i++) {
        const sprite = new Sprite();
        sprite.anchor.set(anchorX, anchorY);
        const top = tileToScreen(x, y);
        sprite.position.set(top.x, top.y);
        sprite.cullable = true;
        this.sprites[i] = sprite;
        this.applyTile(world, i);
        this.container.addChild(sprite);
      }
    }
  }

  /** Re-skin one tile after its terrain changes. */
  applyTile(world: Readonly<WorldMap>, index: number): void {
    const sprite = this.sprites[index];
    if (!sprite) return;
    const terrain = (world.terrain[index] ?? TerrainId.Grass) as TerrainId;
    const variant = world.variant[index] ?? 0;
    const options = this.textures[terrain];
    sprite.texture = options[variant % options.length] ?? options[0]!;
    sprite.tint = TINTS[(variant >> 2) % TINTS.length] ?? 0xffffff;
  }

  /** Earth (or water) sides below the south-west and south-east map edges. */
  private buildSkirt(world: Readonly<WorldMap>): Graphics {
    const g = new Graphics();
    const { width, height } = world;
    const hw = TILE_WIDTH / 2;
    const hh = TILE_HEIGHT / 2;
    const D = SKIRT_DEPTH;
    const isWater = (x: number, y: number) => world.terrain[y * width + x] === TerrainId.Water;

    // South-west face: bottom-left edge of the last row (lit side).
    for (let x = 0; x < width; x++) {
      const t = tileToScreen(x, height - 1);
      const left = { x: t.x - hw, y: t.y + hh };
      const bottom = { x: t.x, y: t.y + TILE_HEIGHT };
      const water = isWater(x, height - 1);
      g.poly([left.x, left.y, bottom.x, bottom.y, bottom.x, bottom.y + D, left.x, left.y + D]).fill(
        water ? PALETTE.water : PALETTE.soilLight,
      );
      if (!water) g.poly([left.x, left.y, bottom.x, bottom.y, bottom.x, bottom.y + 4, left.x, left.y + 4]).fill(PALETTE.grassDark);
    }
    // South-east face: bottom-right edge of the last column (shaded side).
    for (let y = 0; y < height; y++) {
      const t = tileToScreen(width - 1, y);
      const bottom = { x: t.x, y: t.y + TILE_HEIGHT };
      const right = { x: t.x + hw, y: t.y + hh };
      const water = isWater(width - 1, y);
      g.poly([bottom.x, bottom.y, right.x, right.y, right.x, right.y + D, bottom.x, bottom.y + D]).fill(
        water ? PALETTE.waterDeep : PALETTE.soilDark,
      );
      if (!water) g.poly([bottom.x, bottom.y, right.x, right.y, right.x, right.y + 4, bottom.x, bottom.y + 4]).fill(PALETTE.pineDark);
    }
    return g;
  }
}
