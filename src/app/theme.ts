/**
 * The interface theme (LF-5): light, dark, or matching the computer's setting (the
 * default). Applied as `data-theme` on <html>, which ui/styles/tokens.css reads, and
 * remembered on this device. Storage can be missing or blocked, so every access is
 * guarded and the game works without it.
 */
import { Store } from './store';

export type ThemeChoice = 'system' | 'light' | 'dark';
export const THEME_CHOICES: readonly ThemeChoice[] = ['system', 'light', 'dark'];
const STORAGE_KEY = 'the-city-life:theme';

export function parseTheme(value: string | null | undefined): ThemeChoice {
  return value === 'light' || value === 'dark' ? value : 'system';
}

function loadTheme(): ThemeChoice {
  try { return parseTheme(localStorage.getItem(STORAGE_KEY)); } catch { return 'system'; }
}

function saveTheme(choice: ThemeChoice): void {
  try {
    if (choice === 'system') localStorage.removeItem(STORAGE_KEY);
    else localStorage.setItem(STORAGE_KEY, choice);
  } catch { /* storage unavailable: the choice lasts until reload */ }
}

/** Sets or clears `data-theme`; with none, the CSS follows prefers-color-scheme. */
export function applyTheme(choice: ThemeChoice, root: HTMLElement = document.documentElement): void {
  if (choice === 'system') delete root.dataset.theme;
  else root.dataset.theme = choice;
}

export const theme = new Store<ThemeChoice>(loadTheme());
if (typeof document !== 'undefined') {
  applyTheme(theme.get());
  theme.subscribe(() => { applyTheme(theme.get()); saveTheme(theme.get()); });
}
