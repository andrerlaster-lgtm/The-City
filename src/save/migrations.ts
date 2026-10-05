/**
 * Brings older saves up to SAVE_VERSION, one version at a time. Version 1 is the
 * first format, so there is nothing to migrate yet; the pipeline exists so later
 * versions only add a table entry. Saves newer than this build are refused.
 */
import { SAVE_VERSION } from './format';

/** Maps a version n to a function returning the same save in version n + 1. */
export type MigrationTable = Readonly<Record<number, (save: Record<string, unknown>) => Record<string, unknown>>>;

export const MIGRATIONS: MigrationTable = {};

export type MigrationResult = { ok: true; save: Record<string, unknown> } | { ok: false; reason: string };

export function migrate(save: Record<string, unknown>, table: MigrationTable = MIGRATIONS, target = SAVE_VERSION): MigrationResult {
  let version = save.version;
  if (typeof version !== 'number' || !Number.isInteger(version) || version < 1) return { ok: false, reason: 'Save has no valid version.' };
  if (version > target) return { ok: false, reason: `Save is from a newer version (v${version}); this build reads up to v${target}.` };
  let current = save;
  while (version < target) {
    const step = table[version];
    if (!step) return { ok: false, reason: `No migration from save v${version}.` };
    current = { ...step(current), version: version + 1 };
    version += 1;
  }
  return { ok: true, save: current };
}
