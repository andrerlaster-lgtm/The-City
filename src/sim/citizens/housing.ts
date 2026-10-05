import { inBounds, toIndex } from '../../core/grid';
import { buildingDefinition } from '../../data/buildings';
import type { BuildingInstance } from '../buildings/buildings';
import type { WorldMap } from '../world/World';
import type { Citizen } from './citizens';
import { wellCovers } from '../services/coverage';

export function roadDistancesFromEntrance(world: Readonly<WorldMap>): Int32Array {
  const distances = new Int32Array(world.roads.length).fill(-1);
  const start = world.entranceIndex;
  if (start < 0 || world.roadConnected[start] !== 1) return distances;
  const queue = new Int32Array(world.roads.length);
  let head = 0; let tail = 0;
  queue[tail++] = start;
  distances[start] = 0;
  while (head < tail) {
    const index = queue[head++] ?? 0;
    const x = index % world.width; const y = Math.floor(index / world.width);
    for (const [nx, ny] of [[x, y - 1], [x + 1, y], [x, y + 1], [x - 1, y]] as const) {
      if (!inBounds(nx, ny, world.width, world.height)) continue;
      const next = toIndex(nx, ny, world.width);
      if ((world.roadConnected[next] ?? 0) !== 1 || distances[next]! >= 0) continue;
      distances[next] = distances[index]! + 1;
      queue[tail++] = next;
    }
  }
  return distances;
}

export function homeRoadDistance(home: BuildingInstance, distances: Int32Array, world: Readonly<WorldMap>): number {
  const definition = buildingDefinition(home.defId);
  if (!definition) return Number.MAX_SAFE_INTEGER;
  let best = Number.MAX_SAFE_INTEGER;
  const size = definition.size;
  for (let offset = 0; offset < size; offset++) {
    best = adjacentDistance(home.x + offset, home.y - 1, distances, world, best);
    best = adjacentDistance(home.x + size, home.y + offset, distances, world, best);
    best = adjacentDistance(home.x + offset, home.y + size, distances, world, best);
    best = adjacentDistance(home.x - 1, home.y + offset, distances, world, best);
  }
  return best;
}

export function connectedHomes(buildings: readonly BuildingInstance[]): BuildingInstance[] {
  return buildings.filter((building) => building.connected && (buildingDefinition(building.defId)?.housing ?? 0) > 0).sort((a, b) => a.id - b.id);
}

export function connectedHousingCapacity(buildings: readonly BuildingInstance[], citizens: readonly Citizen[]): { free: number; occupancy: Map<number, number>; capacities: Map<number, number> } {
  const homes = connectedHomes(buildings);
  const occupancy = new Map<number, number>();
  const capacities = new Map<number, number>();
  for (const home of homes) {
    occupancy.set(home.id, 0);
    capacities.set(home.id, buildingDefinition(home.defId)?.housing ?? 0);
  }
  for (const citizen of citizens) {
    if (occupancy.has(citizen.home)) occupancy.set(citizen.home, (occupancy.get(citizen.home) ?? 0) + 1);
  }
  let free = 0;
  for (const home of homes) free += Math.max(0, (capacities.get(home.id) ?? 0) - (occupancy.get(home.id) ?? 0));
  return { free, occupancy, capacities };
}

/** Rehouse citizens with no home; connected homes sort by Well, entrance distance, then id. */
export function assignHomeless(citizens: Citizen[], buildings: readonly BuildingInstance[], world: Readonly<WorldMap>, wells: readonly BuildingInstance[], distances: Int32Array): void {
  const homeless = citizens.filter((citizen) => citizen.home === 0).sort((a, b) => a.id - b.id);
  if (homeless.length === 0) return;
  const capacity = connectedHousingCapacity(buildings, citizens);
  const homes = connectedHomes(buildings);
  const covered = new Set(homes.filter((home) => wellCovers(home, wells)).map((home) => home.id));
  homes.sort((a, b) => Number(covered.has(b.id)) - Number(covered.has(a.id)) || homeRoadDistance(a, distances, world) - homeRoadDistance(b, distances, world) || a.id - b.id);
  let homeIndex = 0;
  for (const citizen of homeless) {
    while (homeIndex < homes.length) {
      const home = homes[homeIndex]!;
      const used = capacity.occupancy.get(home.id) ?? 0;
      if (used < (capacity.capacities.get(home.id) ?? 0)) {
        citizen.home = home.id;
        citizen.homelessDays = 0;
        capacity.occupancy.set(home.id, used + 1);
        break;
      }
      homeIndex++;
    }
  }
}

function adjacentDistance(x: number, y: number, distances: Int32Array, world: Readonly<WorldMap>, best: number): number {
  if (!inBounds(x, y, world.width, world.height)) return best;
  const value = distances[toIndex(x, y, world.width)] ?? -1;
  return value >= 0 && value < best ? value : best;
}
