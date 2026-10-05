import { inBounds, toIndex } from '../../core/grid';
import { buildingDefinition } from '../../data/buildings';
import type { BuildingInstance } from '../buildings/buildings';
import type { WorldMap } from '../world/World';
import { ensureCitizenOrder, type Citizen } from './citizens';
import { connectedHomes } from './housing';

type RoadWorkplaces = Map<number, number[]>;

/**
 * The connected road network as a compact graph, built once per day: each connected road
 * tile gets a dense node id, and its road neighbours are precomputed in N, E, S, W order.
 * Searches then touch only real road neighbours (no bounds checks, no full-map arrays).
 */
interface RoadGraph {
  /** Map tile index → node id, or -1 if the tile isn't a connected road. */
  node: Int32Array;
  /** Neighbours of node n are `edges[offsets[n] .. offsets[n + 1])`. */
  offsets: Int32Array;
  edges: Int32Array;
  /** Workplace ids bordering each node (ascending), or undefined. */
  workplaces: (number[] | undefined)[];
}

function buildRoadGraph(world: Readonly<WorldMap>, roadWorkplaces: RoadWorkplaces): RoadGraph {
  const { width, height, roadConnected } = world;
  const node = new Int32Array(roadConnected.length).fill(-1);
  const tiles: number[] = [];
  for (let i = 0; i < roadConnected.length; i++) if (roadConnected[i] === 1) { node[i] = tiles.length; tiles.push(i); }
  const offsets = new Int32Array(tiles.length + 1);
  const edges = new Int32Array(tiles.length * 4);
  let count = 0;
  for (let n = 0; n < tiles.length; n++) {
    offsets[n] = count;
    const tile = tiles[n]!;
    const x = tile % width;
    if (tile >= width && node[tile - width]! >= 0) edges[count++] = node[tile - width]!;
    if (x < width - 1 && node[tile + 1]! >= 0) edges[count++] = node[tile + 1]!;
    if (tile < (height - 1) * width && node[tile + width]! >= 0) edges[count++] = node[tile + width]!;
    if (x > 0 && node[tile - 1]! >= 0) edges[count++] = node[tile - 1]!;
  }
  offsets[tiles.length] = count;
  const workplaces: (number[] | undefined)[] = new Array(tiles.length);
  for (const [tile, ids] of roadWorkplaces) workplaces[node[tile]!] = ids;
  return { node, offsets, edges, workplaces };
}

const UNREACHABLE = 0x7fffffff;

/**
 * Road distance from every node to the nearest workplace that had open jobs at the start
 * of the day (multi-source BFS). Workplaces only ever fill during matching, so this stays a
 * lower bound on the true distance to any still-open workplace: a consistent heuristic.
 */
function distanceToOpenWork(graph: RoadGraph, isOpen: (id: number) => boolean): Int32Array {
  const nodes = graph.offsets.length - 1;
  const h = new Int32Array(nodes).fill(UNREACHABLE);
  const queue = new Int32Array(nodes);
  let head = 0; let tail = 0;
  for (let n = 0; n < nodes; n++) {
    const ids = graph.workplaces[n];
    if (ids && ids.some(isOpen)) { h[n] = 0; queue[tail++] = n; }
  }
  while (head < tail) {
    const n = queue[head++]!;
    for (let e = graph.offsets[n]!, end = graph.offsets[n + 1]!; e < end; e++) {
      const m = graph.edges[e]!;
      if (h[m] !== UNREACHABLE) continue;
      h[m] = h[n]! + 1;
      queue[tail++] = m;
    }
  }
  return h;
}

interface RoadSearch {
  graph: RoadGraph;
  /** Lower bound on the distance to an open workplace (see distanceToOpenWork). */
  h: Int32Array;
  /** Best road distance from the current home, valid where visited[n] === visitId. */
  g: Int32Array;
  /**
   * Three reusable queues for f, f + 1 and f + 2. With unit road steps and a consistent h,
   * expanding a node at f can only add nodes at f, f + 1 or f + 2.
   */
  levels: [Int32Array, Int32Array, Int32Array];
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
  if (homes.length > 0 && remaining > 0) {
    const graph = buildRoadGraph(world, buildRoadWorkplaceMap(buildings, world));
    const nodes = graph.offsets.length - 1;
    const maxId = buildings.reduce((max, building) => Math.max(max, building.id), 0);
    const jobSlots = new Int32Array(maxId + 1);
    for (const building of buildings) jobSlots[building.id] = buildingDefinition(building.defId)?.jobs ?? 0;
    const h = distanceToOpenWork(graph, (id) => jobSlots[id]! - (used.get(id) ?? 0) > 0);
    const search: RoadSearch = {
      graph, h, g: new Int32Array(nodes), visited: new Int32Array(nodes),
      levels: [new Int32Array(nodes * 4 + 8), new Int32Array(nodes * 4 + 8), new Int32Array(nodes * 4 + 8)],
      candidateMarks: new Int32Array(maxId + 1), jobSlots, candidates: [], visitId: 0, candidateId: 0,
    };
    for (const home of homes) {
      if (remaining <= 0) break;
      remaining -= matchHome(demands.get(home.id)!, home, world, used, search);
    }
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
 * Finds the home's nearest open workplaces in exact road-distance order (ties → lowest id)
 * with an A*-style search guided by `h`. Because `h` is a consistent lower bound, nodes are
 * expanded in nondecreasing f = g + h with optimal g, and every workplace at distance d is
 * discovered while processing f = d — the same order a plain BFS from the home produces,
 * so assignments match the Stage 1 matcher exactly. Allocates nothing per node.
 */
function matchHome(citizens: Citizen[], home: BuildingInstance, world: Readonly<WorldMap>, used: Map<number, number>, search: RoadSearch): number {
  const { graph, h, g, visited, candidateMarks, jobSlots, candidates } = search;
  const { node, offsets, edges, workplaces } = graph;
  const visitId = ++search.visitId;
  const definition = buildingDefinition(home.defId);
  if (!definition) return 0;
  // Start nodes enter the search when f reaches their own f (they can differ by a few steps).
  const starts: number[] = [];
  for (const tile of adjacentRoadTiles(home.x, home.y, definition.size, world)) {
    const start = node[tile]!;
    if (visited[start] === visitId || h[start] === UNREACHABLE) continue;
    visited[start] = visitId; g[start] = 0;
    starts.push(start);
  }
  if (starts.length === 0) return 0;
  starts.sort((a, b) => h[a]! - h[b]!);
  let [cur, next1, next2] = search.levels;
  let curLen = 0; let len1 = 0; let len2 = 0;
  let nextStart = 0;
  let assigned = 0;
  for (let f = h[starts[0]!]!; assigned < citizens.length; f++) {
    while (nextStart < starts.length && h[starts[nextStart]!] === f) cur[curLen++] = starts[nextStart++]!;
    if (curLen === 0 && len1 === 0 && len2 === 0 && nextStart >= starts.length) break;
    candidates.length = 0;
    const candidateId = ++search.candidateId;
    for (let i = 0; i < curLen; i++) {
      const n: number = cur[i]!;
      if (g[n]! + h[n]! !== f) continue; // stale: a shorter route to n was found later
      const adjacent = h[n] === 0 ? workplaces[n] : undefined;
      if (adjacent) for (const id of adjacent) {
        if (candidateMarks[id] === candidateId) continue;
        candidateMarks[id] = candidateId;
        candidates.push(id);
      }
      const step = g[n]! + 1;
      for (let e: number = offsets[n]!, end: number = offsets[n + 1]!; e < end; e++) {
        const m: number = edges[e]!;
        const hm = h[m]!;
        if (hm === UNREACHABLE) continue;
        if (visited[m] === visitId && g[m]! <= step) continue;
        visited[m] = visitId; g[m] = step;
        const delta = step + hm - f; // 0, 1 or 2 (consistent heuristic)
        if (delta === 0) cur[curLen++] = m;
        else if (delta === 1) next1[len1++] = m;
        else next2[len2++] = m;
      }
    }
    if (candidates.length > 1) candidates.sort((a, b) => a - b);
    for (const id of candidates) {
      const slots = Math.max(0, jobSlots[id]! - (used.get(id) ?? 0));
      const count = Math.min(slots, citizens.length - assigned);
      for (let k = 0; k < count; k++) citizens[assigned + k]!.job = id;
      assigned += count;
      if (count) used.set(id, (used.get(id) ?? 0) + count);
      if (assigned >= citizens.length) break;
    }
    const done = cur;
    cur = next1; curLen = len1;
    next1 = next2; len1 = len2;
    next2 = done; len2 = 0;
  }
  search.levels = [cur, next1, next2];
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
