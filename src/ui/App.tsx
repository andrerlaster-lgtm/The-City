import type { Game } from '../app/Game';
import { TileInfo } from './TileInfo';
import { TopBar } from './TopBar';
import { useStore } from './useStore';

export function App({ game }: { game: Game }) {
  const snapshot = useStore(game.snapshot);
  const hover = useStore(game.hover);
  return (
    <div className="hud">
      <TopBar snapshot={snapshot} />
      <TileInfo info={hover} />
    </div>
  );
}
