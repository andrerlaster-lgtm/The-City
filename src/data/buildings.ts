import { TerrainId } from './terrain';

export type BuildingId = 'cottage' | 'rowhouse' | 'farm' | 'workshop' | 'well';
export type BuildingCategory = 'Residential' | 'Employment' | 'Service';

export interface BuildingDefinition {
  id: BuildingId;
  name: string;
  category: BuildingCategory;
  description: string;
  size: number;
  cost: number;
  upkeep: number;
  housing: number;
  jobs: number;
  produces: 'food' | 'revenue' | null;
  serviceRadius: number;
  requires: { roadAccess: true; terrain: readonly TerrainId[] };
  art: string;
}

const land = [TerrainId.Grass, TerrainId.Sand] as const;

export const BUILDINGS: readonly BuildingDefinition[] = [
  { id: 'cottage', name: 'Cottage', category: 'Residential', description: 'A small home for a few residents.', size: 1, cost: 100, upkeep: 1, housing: 4, jobs: 0, produces: null, serviceRadius: 0, requires: { roadAccess: true, terrain: land }, art: 'cottage' },
  { id: 'rowhouse', name: 'Rowhouse', category: 'Residential', description: 'Compact housing for a growing neighborhood.', size: 2, cost: 350, upkeep: 3, housing: 16, jobs: 0, produces: null, serviceRadius: 0, requires: { roadAccess: true, terrain: land }, art: 'rowhouse' },
  { id: 'farm', name: 'Farm', category: 'Employment', description: 'Grows food and provides farm work.', size: 3, cost: 250, upkeep: 2, housing: 0, jobs: 6, produces: 'food', serviceRadius: 0, requires: { roadAccess: true, terrain: [TerrainId.Grass] }, art: 'farm' },
  { id: 'workshop', name: 'Workshop', category: 'Employment', description: 'Makes goods and provides skilled work.', size: 2, cost: 300, upkeep: 3, housing: 0, jobs: 8, produces: 'revenue', serviceRadius: 0, requires: { roadAccess: true, terrain: land }, art: 'workshop' },
  { id: 'well', name: 'Well', category: 'Service', description: 'A shared water source for nearby homes.', size: 1, cost: 150, upkeep: 2, housing: 0, jobs: 1, produces: null, serviceRadius: 6, requires: { roadAccess: true, terrain: land }, art: 'well' },
];

export function buildingDefinition(id: string): BuildingDefinition | undefined {
  return BUILDINGS.find((building) => building.id === id);
}
