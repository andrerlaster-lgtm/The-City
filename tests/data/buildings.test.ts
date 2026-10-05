import { describe, expect, it } from 'vitest';
import { BUILDINGS } from '../../src/data/buildings';
import { TerrainId } from '../../src/data/terrain';

describe('building definitions', () => {
  it('contains exactly five definitions with unique ids', () => {
    expect(BUILDINGS).toHaveLength(5);
    expect(new Set(BUILDINGS.map(({ id }) => id)).size).toBe(5);
  });

  it('has complete, valid definitions', () => {
    for (const item of BUILDINGS) {
      expect(item.name.length).toBeGreaterThan(0);
      expect(item.description.length).toBeGreaterThan(0);
      expect(item.size).toBeGreaterThan(0);
      expect(item.cost).toBeGreaterThan(0);
      expect(item.upkeep).toBeGreaterThanOrEqual(0);
      expect(item.housing).toBeGreaterThanOrEqual(0);
      expect(item.jobs).toBeGreaterThanOrEqual(0);
      expect(item.requires.roadAccess).toBe(true);
      expect(item.requires.terrain.length).toBeGreaterThan(0);
      expect(item.requires.terrain.every((terrain) => terrain === TerrainId.Grass || terrain === TerrainId.Sand)).toBe(true);
      expect(item.art).toBe(item.id);
      for (const service of item.services) {
        expect(['water']).toContain(service.kind);
        expect(service.radius).toBeGreaterThan(0);
      }
      expect([null, 'food', 'revenue']).toContain(item.produces);
      expect(['Residential', 'Employment', 'Service']).toContain(item.category);
    }
  });

  it('requires grass for the farm and grass or sand for the other buildings', () => {
    expect(BUILDINGS.find(({ id }) => id === 'farm')?.requires.terrain).toEqual([TerrainId.Grass]);
    for (const item of BUILDINGS.filter(({ id }) => id !== 'farm')) {
      expect(item.requires.terrain).toEqual([TerrainId.Grass, TerrainId.Sand]);
    }
  });
});
