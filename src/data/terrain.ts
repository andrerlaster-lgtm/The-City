/**
 * Terrain definitions. Stored in the world's terrain layer as the numeric id.
 * Adding a terrain type = adding an entry here (plus its art).
 */
export const TerrainId = {
  Grass: 0,
  Sand: 1,
  Water: 2,
} as const;
export type TerrainId = (typeof TerrainId)[keyof typeof TerrainId];

export interface TerrainDef {
  id: TerrainId;
  name: string;
  buildable: boolean;
}

export const TERRAIN: Record<TerrainId, TerrainDef> = {
  [TerrainId.Grass]: { id: TerrainId.Grass, name: 'Grass', buildable: true },
  [TerrainId.Sand]: { id: TerrainId.Sand, name: 'Sand', buildable: true },
  [TerrainId.Water]: { id: TerrainId.Water, name: 'Water', buildable: false },
};

/** Tree layer values: 0 = none, otherwise a tree style. */
export const TreeKind = {
  None: 0,
  Round: 1,
  Pine: 2,
  Bush: 3,
} as const;
export type TreeKind = (typeof TreeKind)[keyof typeof TreeKind];
