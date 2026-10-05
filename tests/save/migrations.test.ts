import { describe, expect, it } from 'vitest';
import { SAVE_VERSION } from '../../src/save/format';
import { migrate } from '../../src/save/migrations';

describe('save migrations', () => {
  it('passes a current (v1) save through unchanged', () => {
    const save = { format: 'the-city-life', version: SAVE_VERSION, meta: {}, state: { x: 1 } };
    expect(migrate(save)).toEqual({ ok: true, save });
  });

  it('refuses saves from a newer version', () => {
    const result = migrate({ version: SAVE_VERSION + 1 });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toContain('newer version');
  });

  it('applies each step in order up to the target version', () => {
    const table = {
      1: (save: Record<string, unknown>) => ({ ...save, renamed: save.old, old: undefined }),
      2: (save: Record<string, unknown>) => ({ ...save, added: true }),
    };
    expect(migrate({ version: 1, old: 'value' }, table, 3)).toEqual({ ok: true, save: { version: 3, renamed: 'value', old: undefined, added: true } });
  });

  it('reports a missing step and an invalid version', () => {
    expect(migrate({ version: 1 }, {}, 2)).toEqual({ ok: false, reason: 'No migration from save v1.' });
    expect(migrate({ version: 'one' }).ok).toBe(false);
    expect(migrate({}).ok).toBe(false);
  });
});
