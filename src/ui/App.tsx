import type { Game } from '../app/Game';
import { TopBar } from './TopBar';
import { useSimSnapshot } from './useSimSnapshot';

export function App({ game }: { game: Game }) {
  const snapshot = useSimSnapshot(game);
  return (
    <div className="hud">
      <TopBar snapshot={snapshot} />
    </div>
  );
}
