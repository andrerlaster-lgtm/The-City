import { Container, Graphics } from 'pixi.js';
import { TILE_HEIGHT, TILE_WIDTH, toIndex, tileToScreen } from '../../core/grid';
import type { TileCoord } from '../../core/types';
import type { WorldMap } from '../../sim/world/World';
import { roadMask } from '../../sim/roads';
import { PALETTE } from '../palette';

const W = TILE_WIDTH;
const H = TILE_HEIGHT;

export class RoadLayer {
  readonly container = new Container({ label: 'roads', sortableChildren: true });
  private roads = new Map<number, Graphics>();

  build(world: Readonly<WorldMap>): void {
    this.container.removeChildren().forEach((child) => child.destroy());
    this.roads.clear();
    for (let i = 0; i < world.roads.length; i++) if (world.roads[i] === 1) this.draw(world, i);
  }

  /** Redraws each given tile and its neighbours (whose masks may have changed). */
  refresh(world: Readonly<WorldMap>, tiles: readonly TileCoord[]): void {
    const affected = new Set<number>();
    const offsets: readonly [number, number][] = [[0, 0], [0, -1], [1, 0], [0, 1], [-1, 0]];
    for (const { x, y } of tiles) for (const [dx, dy] of offsets) {
      const nx = x + dx; const ny = y + dy;
      if (nx >= 0 && ny >= 0 && nx < world.width && ny < world.height) affected.add(toIndex(nx, ny, world.width));
    }
    for (const index of affected) {
      this.roads.get(index)?.destroy();
      this.roads.delete(index);
      if (world.roads[index] === 1) this.draw(world, index);
    }
  }

  private draw(world: Readonly<WorldMap>, index: number): void {
    const x = index % world.width; const y = Math.floor(index / world.width);
    const mask = roadMask(world, x, y);
    // Roads that can't reach the settlement entrance are drawn in a warning tone.
    const color = world.roadConnected[index] === 1 ? PALETTE.road : PALETTE.roadDisconnected;
    const g = new Graphics();
    // Local origin is the tile's top corner (same as terrain and hover); the centre is (0, H/2).
    g.poly([0, 5, W / 2 - 6, H / 2, 0, H - 5, -W / 2 + 6, H / 2]).fill(color);
    // Connectors run from the centre to the edge shared with each road neighbour:
    // N (y-1) is up-right, E (x+1) down-right, S (y+1) down-left, W (x-1) up-left.
    const edges: readonly [number, number, number][] = [[1, W / 4, H / 4], [2, W / 4, 3 * H / 4], [4, -W / 4, 3 * H / 4], [8, -W / 4, H / 4]];
    for (const [bit, ex, ey] of edges) if (mask & bit) g.moveTo(0, H / 2).lineTo(ex, ey);
    if (mask) g.stroke({ width: 9, color, cap: 'round' });
    const pos = tileToScreen(x, y);
    g.position.set(pos.x, pos.y);
    g.zIndex = (x + y) * 4 + 1;
    this.roads.set(index, g);
    this.container.addChild(g);
  }
}
