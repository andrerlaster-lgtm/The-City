/**
 * Turns unknown stored data into a trusted SaveFile, or a reason it can't be
 * loaded. Order: envelope → migrate → full state checks. Nothing here touches the
 * running game, so a rejected save can never break it.
 */
import { toIndex } from '../core/grid';
import { buildingDefinition } from '../data/buildings';
import { TERRAIN, TerrainId } from '../data/terrain';
import { SAVE_FORMAT, type SaveFile, type SerializedState } from './format';
import { migrate } from './migrations';

export type LoadResult = { ok: true; file: SaveFile } | { ok: false; reason: string };

export function readSave(data: unknown): LoadResult {
  if (!isRecord(data) || data.format !== SAVE_FORMAT) return fail('Not a The City Life save.');
  const migrated = migrate(data);
  if (!migrated.ok) return migrated;
  const { meta, state } = migrated.save;
  if (!isRecord(meta) || typeof meta.name !== 'string' || typeof meta.savedAt !== 'string') return fail('Save details are missing.');
  const problem = stateProblem(state);
  return problem ? fail(problem) : { ok: true, file: migrated.save as unknown as SaveFile };
}

/** The first thing wrong with a serialized state, or null when it is safe to load. */
export function stateProblem(value: unknown): string | null {
  if (!isRecord(value)) return 'Save has no game state.';
  const s = value as Partial<SerializedState> & Record<string, unknown>;
  for (const key of ['width', 'height', 'seed', 'rngState', 'tick', 'nextEntityId', 'nextCitizenId'] as const) {
    if (!isInt(s[key]) || (s[key] as number) < 0) return `"${key}" is not a valid whole number.`;
  }
  for (const key of ['treasury', 'food'] as const) if (!isFiniteNumber(s[key])) return `"${key}" is not a number.`;
  const width = s.width!; const height = s.height!;
  if (width < 1 || height < 1) return 'Map size is invalid.';
  const size = width * height;
  for (const key of ['terrain', 'variant', 'trees', 'roads'] as const) {
    const layer = s[key];
    if (!(layer instanceof Uint8Array)) return `Map layer "${key}" is missing.`;
    if (layer.length !== size) return `Map layer "${key}" has ${layer.length} tiles; expected ${size}.`;
  }
  const terrain = s.terrain!; const roads = s.roads!;
  if (terrain.some((t) => !(t in TERRAIN))) return 'Map has an unknown terrain type.';
  if (!isInt(s.entranceIndex) || s.entranceIndex! < -1 || s.entranceIndex! >= size) return 'Entrance is off the map.';
  if (s.entranceIndex! >= 0 && roads[s.entranceIndex!] !== 1) return 'Entrance has no road.';
  if (![0, 1, 2, 3].includes(s.speed as number)) return 'Speed is out of range.';
  if (!isEconomy(s.economy)) return 'Economy ledger is malformed.';

  if (!Array.isArray(s.buildings)) return 'Building list is missing.';
  const occupied = new Int32Array(size);
  const buildingIds = new Set<number>();
  let lastId = 0;
  for (const b of s.buildings as unknown[]) {
    if (!isRecord(b) || !isInt(b.id) || !isInt(b.x) || !isInt(b.y)) return 'A building record is malformed.';
    const id = b.id as number;
    if (id <= lastId) return `Building ids are duplicated or out of order (id ${id}).`;
    lastId = id;
    const definition = typeof b.defId === 'string' ? buildingDefinition(b.defId) : undefined;
    if (!definition) return `Unknown building type "${String(b.defId)}".`;
    for (let dy = 0; dy < definition.size; dy++) for (let dx = 0; dx < definition.size; dx++) {
      const x = (b.x as number) + dx; const y = (b.y as number) + dy;
      if (x < 0 || y < 0 || x >= width || y >= height) return `Building ${id} is off the map.`;
      const index = toIndex(x, y, width);
      if (occupied[index] !== 0) return `Buildings ${occupied[index]} and ${id} overlap.`;
      if (roads[index] === 1) return `Building ${id} sits on a road.`;
      if (!TERRAIN[terrain[index] as TerrainId].buildable) return `Building ${id} sits on unbuildable land.`;
      occupied[index] = id;
    }
    buildingIds.add(id);
  }
  if (s.nextEntityId! <= lastId) return 'Building id counter is behind the saved buildings.';

  if (!Array.isArray(s.citizens)) return 'Citizen list is missing.';
  let lastCitizen = 0;
  for (const c of s.citizens as unknown[]) {
    if (!isRecord(c) || !isInt(c.id)) return 'A citizen record is malformed.';
    for (const key of ['home', 'job', 'hungryDays', 'unemployedDays', 'homelessDays'] as const) {
      if (!isInt(c[key]) || (c[key] as number) < 0) return `Citizen ${String(c.id)} has an invalid "${key}".`;
    }
    if ((c.id as number) <= lastCitizen) return `Citizen ids are duplicated or out of order (id ${String(c.id)}).`;
    lastCitizen = c.id as number;
    for (const key of ['home', 'job'] as const) {
      const ref = c[key] as number;
      if (ref !== 0 && !buildingIds.has(ref)) return `Citizen ${lastCitizen} points to missing building ${ref}.`;
    }
  }
  if (s.nextCitizenId! <= lastCitizen) return 'Citizen id counter is behind the saved citizens.';
  return null;
}

function isEconomy(value: unknown): boolean {
  if (!isRecord(value) || !isLedger(value.today)) return false;
  return value.lastDay === null || (isLedger(value.lastDay) && isRecord(value.lastDay) && isFiniteNumber(value.lastDay.net));
}

function isLedger(value: unknown): boolean {
  if (!isRecord(value)) return false;
  const numbers = ['construction', 'upkeepBuildings', 'upkeepRoads', 'taxes', 'taxesResidents', 'taxesEmployed', 'revenue', 'foodProduced', 'foodEaten'];
  if (!numbers.every((key) => isFiniteNumber(value[key]))) return false;
  const migration = value.migration;
  return isRecord(migration) && isFiniteNumber(migration.arrived) && isRecord(migration.left)
    && ['hunger', 'unemployment', 'homeless'].every((key) => isFiniteNumber((migration.left as Record<string, unknown>)[key]));
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
function isFiniteNumber(value: unknown): value is number { return typeof value === 'number' && Number.isFinite(value); }
function isInt(value: unknown): value is number { return Number.isInteger(value); }
function fail(reason: string): LoadResult { return { ok: false, reason }; }
