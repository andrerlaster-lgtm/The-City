import { describe, expect, it } from 'vitest';
import { applyTheme, parseTheme, THEME_CHOICES } from '../../src/app/theme';

describe('interface theme', () => {
  it('reads a saved choice, falling back to matching the computer', () => {
    expect(parseTheme('light')).toBe('light');
    expect(parseTheme('dark')).toBe('dark');
    expect(parseTheme(null)).toBe('system');
    expect(parseTheme('neon')).toBe('system');
    expect(THEME_CHOICES[0]).toBe('system');
  });

  it('sets data-theme for light and dark, and clears it to follow the computer', () => {
    const root = { dataset: {} as Record<string, string> } as unknown as HTMLElement;
    applyTheme('light', root);
    expect(root.dataset.theme).toBe('light');
    applyTheme('dark', root);
    expect(root.dataset.theme).toBe('dark');
    applyTheme('system', root);
    expect(root.dataset.theme).toBeUndefined();
  });
});
