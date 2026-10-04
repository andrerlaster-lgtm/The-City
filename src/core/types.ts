/** Shared primitive types. No game rules live here. */

export interface TileCoord {
  x: number;
  y: number;
}

export interface ScreenCoord {
  x: number;
  y: number;
}

/** Stable numeric id for buildings, citizens, etc. Never reused within a save. */
export type EntityId = number;
