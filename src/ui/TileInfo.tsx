import type { HoverInfo } from '../app/Game';
import { buildingDefinition } from '../data/buildings';

/** Small chip in the bottom-left describing the tile under the cursor. */
export function TileInfo({ info }: { info: HoverInfo | null }) {
  return (
    <div className={`tile-info${info ? ' tile-info--visible' : ''}`} aria-live="polite">
      {info && (
        <>
          <span className="tile-info__terrain">
            {info.building ? buildingDefinition(info.building)?.name : info.terrain}
            {info.wooded ? ' · Trees' : ''}
          </span>
          <span className="tile-info__coord">
            {info.tile.x}, {info.tile.y}
          </span>
        </>
      )}
    </div>
  );
}
