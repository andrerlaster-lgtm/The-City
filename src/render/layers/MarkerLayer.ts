/**
 * Map markers drawn above everything else: the settlement entrance sign and a warning
 * badge over each building that isn't connected to the entrance. Reads only.
 */
import { Container, Graphics, Text } from 'pixi.js';
import { TILE_HEIGHT, tileToScreen } from '../../core/grid';
import { buildingDefinition } from '../../data/buildings';
import type { BuildingInstance } from '../../sim/buildings/buildings';
import type { WorldMap } from '../../sim/world/World';
import type { BuildingTexture } from '../art/buildingArt';
import { footprintBottom } from '../cameraMath';
import { PALETTE } from '../palette';

export class MarkerLayer {
  readonly container = new Container({ label: 'markers' });
  private readonly entrance = new Container({ label: 'entrance-marker' });
  private readonly warnings = new Container({ label: 'building-warnings' });

  constructor(private readonly buildingTextures: ReadonlyMap<string, BuildingTexture>) {
    this.container.addChild(this.entrance, this.warnings);
  }

  /** A downward arrow and an "Entrance" label floating over the entrance tile. */
  setEntrance(world: Readonly<WorldMap>): void {
    this.entrance.removeChildren().forEach((child) => child.destroy());
    if (world.entranceIndex < 0) return;
    const x = world.entranceIndex % world.width;
    const y = Math.floor(world.entranceIndex / world.width);
    const top = tileToScreen(x, y);
    const cx = top.x; const tipY = top.y + TILE_HEIGHT / 2 - 6;
    const arrow = new Graphics()
      .poly([cx, tipY, cx - 11, tipY - 14, cx - 4, tipY - 14, cx - 4, tipY - 30, cx + 4, tipY - 30, cx + 4, tipY - 14, cx + 11, tipY - 14])
      .fill(PALETTE.entrance)
      .stroke({ color: PALETTE.shadow, width: 2, alpha: 0.8 });
    const label = new Text({
      text: 'Entrance',
      style: { fontFamily: 'system-ui, sans-serif', fontSize: 12, fontWeight: '700', fill: PALETTE.entrance, stroke: { color: PALETTE.shadow, width: 3 } },
      resolution: 2,
    });
    label.anchor.set(0.5, 1);
    label.position.set(cx, tipY - 33);
    this.entrance.addChild(arrow, label);
  }

  /** Rebuilds a "!" badge above every placed building that isn't connected to the entrance. */
  setBuildingWarnings(buildings: readonly BuildingInstance[]): void {
    this.warnings.removeChildren().forEach((child) => child.destroy());
    for (const building of buildings) {
      if (building.connected) continue;
      const definition = buildingDefinition(building.defId);
      if (!definition) continue;
      const texture = this.buildingTextures.get(definition.art);
      const bottom = footprintBottom(building.x, building.y, definition.size);
      // Sprite top sits anchorY × height above its anchor (see ObjectLayer).
      const spriteTop = texture ? bottom.y - texture.height * texture.anchorY : bottom.y - definition.size * TILE_HEIGHT - 40;
      this.warnings.addChild(warningBadge(bottom.x, spriteTop + 4));
    }
  }
}

function warningBadge(x: number, y: number): Graphics {
  const badge = new Graphics()
    .circle(0, 0, 10).fill(PALETTE.accessWarn).stroke({ color: PALETTE.shadow, width: 2 })
    .roundRect(-1.75, -6, 3.5, 7.5, 1.5).fill(PALETTE.shadow)
    .circle(0, 4.5, 1.9).fill(PALETTE.shadow);
  badge.position.set(x, y);
  badge.label = 'building-warning';
  return badge;
}
