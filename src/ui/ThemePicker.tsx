import { THEME_CHOICES, theme, type ThemeChoice } from '../app/theme';
import { useStore } from './useStore';

const LABELS: Record<ThemeChoice, string> = { system: 'Match my computer', light: 'Light', dark: 'Dark' };

/** Light, dark, or matching the computer: remembered on this device. */
export function ThemePicker() {
  const current = useStore(theme);
  return <div className="theme-picker" role="group" aria-label="Interface theme">
    {THEME_CHOICES.map((choice) => <button key={choice} type="button" aria-pressed={current === choice} onClick={() => theme.set(choice)}>
      {LABELS[choice]}
    </button>)}
  </div>;
}
