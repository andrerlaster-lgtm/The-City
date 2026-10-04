import { useSyncExternalStore } from 'react';
import type { Game } from '../app/Game';
import type { SimSnapshot } from '../sim/Simulation';

export function useSimSnapshot(game: Game): SimSnapshot {
  return useSyncExternalStore(game.subscribe, game.getSnapshot);
}
