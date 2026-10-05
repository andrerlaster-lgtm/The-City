import { inBounds, toIndex } from '../../core/grid';
import { buildingDefinition } from '../../data/buildings';
import type { BuildingInstance } from '../buildings/buildings';
import type { WorldMap } from '../world/World';
import { ensureCitizenOrder, type Citizen } from './citizens';
import { connectedHomes } from './housing';

type RoadWorkplaces = Map<number, number[]>;
interface RoadSearch {
  /** 1 where a road tile borders at least one connected workplace (dense, so the BFS skips the Map elsewhere). */
  hasWorkplace: Uint8Array;
  queue: Int32Array;
  visited: Int32Array;
  candidateMarks: Int32Array;
  /** Job slots per workplace id, looked up once per day instead of per BFS step. */
  jobSlots: Int32Array;
  candidates: number[];
  visitId: number;
  candidateId: number;
}

/** Rebuilt once per day; each road tile lists adjacent connected workplaces by id. */
export function buildRoadWorkplaceMap(buildings: readonly BuildingInstance[], world: Readonly<WorldMap>): RoadWorkplaces {
  const result: RoadWorkplaces = new Map();
  for (const building of [...buildings].sort((a, b) => a.id - b.id)) {
    const definition = buildingDefinition(building.defId);
    if (!building.connected || !definition || definition.jobs === 0) continue;
    const roads = new Set<number>();
    for (let oy = 0; oy < definition.size; oy++) for (let ox = 0; ox < definition.size; ox++) {
      const x = building.x + ox; const y = building.y + oy;
      for (const [nx, ny] of [[x, y - 1], [x + 1, y], [x, y + 1], [x - 1, y]] as const) {
        if (!inBounds(nx, ny, world.width, world.height)) continue;
        const index = toIndex(nx, ny, world.width);
        if (world.roadConnected[index] === 1) roads.add(index);
      }
    }
    for (const road of roads) {
      const adjacent = result.get(road) ?? [];
      adjacent.push(building.id);
      result.set(road, adjacent);
    }
  }
  return result;
}

/** Keeps valid jobs stable and matches only unemployed citizens by BFS distance. */
export function assignJobs(citizens: Citizen[], buildings: readonly BuildingInstance[], world: Readonly<WorldMap>): void {
  const byId = new Map(buildings.map((building) => [building.id, building]));
  const used = new Map<number, number>();
  for (const citizen of citizens) {
    const home = byId.get(citizen.home);
    const job = byId.get(citizen.job);
    const jobDef = job && buildingDefinition(job.defId);
    if (!home?.connected || !job?.connected || !jobDef || jobDef.jobs === 0) citizen.job = 0;
    else used.set(job.id, (used.get(job.id) ?? 0) + 1);
  }

  const jobs = buildRoadWorkplaceMap(buildings, world);
  const maxId = buildings.reduce((max, building) => Math.max(max, building.id), 0);
  const jobSlots = new Int32Array(maxId + 1);
  for (const building of buildings) jobSlots[building.id] = buildingDefinition(building.defId)?.jobs ?? 0;
  const hasWorkplace = new Uint8Array(world.roads.length);
  for (const road of jobs.keys()) hasWorkplace[road] = 1;
  const search: RoadSearch = {
    hasWorkplace, queue: new Int32Array(world.roads.length), visited: new Int32Array(world.roads.length),
    candidateMarks: new Int32Array(maxId + 1), jobSlots, candidates: [], visitId: 0, candidateId: 0,
  };
  const demands = new Map<number, Citizen[]>();
  ensureCitizenOrder(citizens);
  for (const citizen of citizens) {
    if (citizen.job !== 0) continue;
    if (!byId.get(citizen.home)?.connected) continue;
    const group = demands.get(citizen.home) ?? [];
    group.push(citizen);
    demands.set(citizen.home, group);
  }
  const homes = connectedHomes(buildings).filter((home) => demands.has(home.id));
  let remaining = 0;
  for (const building of buildings) if (building.connected) remaining += Math.max(0, (buildingDefinition(building.defId)?.jobs ?? 0) - (used.get(building.id) ?? 0));
  for (const home of homes) {
    if (remaining <= 0) break;
    remaining -= matchHome(demands.get(home.id)!, home, world, jobs, used, search);
  }

  for (const citizen of citizens) {
    if (citizen.job === 0) citizen.unemployedDays++;
    else citizen.unemployedDays = 0;
  }
}

export function connectedOpenJobs(buildings: readonly BuildingInstance[], citizens: readonly Citizen[]): number {
  const byId = new Map(buildings.map((building) => [building.id, building]));
  const occupied = new Map<number, number>();
  for (const citizen of citizens) {
    if (citizen.job > 0 && byId.get(citizen.home)?.connected && byId.get(citizen.job)?.connected) {
      occupied.set(citizen.job, (occupied.get(citizen.job) ?? 0) + 1);
    }
  }
  let open = 0;
  for (const building of buildings) if (building.connected) open += Math.max(0, (buildingDefinition(building.defId)?.jobs ?? 0) - (occupied.get(building.id) ?? 0));
  return open;
}

/**
 * Layered BFS over connected roads from one home. Each layer's reachable workplaces are
 * filled lowest id first, so equal road distance ties go to the lowest id. The loop
 * allocates nothing per road tile: it is the hot path when many homes search far away.
 */
function matchHome(citizens: Citizen[], home: BuildingInstance, world: Readonly<WorldMap>, workplaces: RoadWorkplaces, used: Map<number, number>, search: RoadSearch): number {
  const { hasWorkplace, queue, visited, candidateMarks, jobSlots, candidates } = search;
  const { width, height, roadConnected } = world;
  const visitId = ++search.visitId;
  let head = 0; let tail = 0;
  const definition = buildingDefinition(home.defId);
  if (!definition) return 0;
  for (const index of adjacentRoadTiles(home.x, home.y, definition.size, world)) {
    if (visited[index] === visitId) continue;
    visited[index] = visitId; queue[tail++] = index;
  }
  const visit = (next: number) => {
    if (roadConnected[next] !== 1 || visited[next] === visitId) return;
    visited[next] = visitId;
    queue[tail++] = next;
  };
  let assigned = 0;
  while (head < tail && assigned < citizens.length) {
    const layerEnd = tail;
    candidates.length = 0;
    const candidateId = ++search.candidateId;
    while (head < layerEnd) {
      const index = queue[head++]!;
      if (hasWorkplace[index] === 1) for (const id of workplaces.get(index)!) {
        if (candidateMarks[id] === candidateId) continue;
        candidateMarks[id] = candidateId;
        candidates.push(id);
      }
      const x = index % width;
      // N, E, S, W — the same neighbour order as every other road search.
      if (index >= width) visit(index - width);
      if (x < width - 1) visit(index + 1);
      if (index < (height - 1) * width) visit(index + width);
      if (x > 0) visit(index - 1);
    }
    if (candidates.length > 1) candidates.sort((a, b) => a - b);
    for (const id of candidates) {
      const slots = Math.max(0, jobSlots[id]! - (used.get(id) ?? 0));
      const count = Math.min(slots, citizens.length - assigned);
      for (let i = 0; i < count; i++) citizens[assigned + i]!.job = id;
      assigned += count;
      if (count) used.set(id, (used.get(id) ?? 0) + count);
      if (assigned >= citizens.length) break;
    }
  }
  return assigned;
}

function adjacentRoadTiles(x: number, y: number, size: number, world: Readonly<WorldMap>): number[] {
  const result = new Set<number>();
  for (let offset = 0; offset < size; offset++) {
    for (const [nx, ny] of [[x + offset, y - 1], [x + size, y + offset], [x + offset, y + size], [x - 1, y + offset]] as const) {
      if (!inBounds(nx, ny, world.width, world.height)) continue;
      const index = toIndex(nx, ny, world.width);
      if (world.roadConnected[index] === 1) result.add(index);
    }
  }
  return [...result];
}
