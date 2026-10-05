/**
 * The single source for the player's reduced-motion preference. The renderer and the
 * React hooks follow it; CSS follows the same media query directly.
 */
const QUERY = '(prefers-reduced-motion: reduce)';

/** Calls `onChange` now and whenever the preference changes; returns an unsubscribe. */
export function watchReducedMotion(onChange: (reduced: boolean) => void): () => void {
  if (typeof window === 'undefined' || !window.matchMedia) {
    onChange(false);
    return () => {};
  }
  const media = window.matchMedia(QUERY);
  const listener = () => onChange(media.matches);
  listener();
  media.addEventListener('change', listener);
  return () => media.removeEventListener('change', listener);
}
