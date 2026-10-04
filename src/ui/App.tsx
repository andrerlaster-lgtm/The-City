import type { Game } from '../app/Game';
import { TileInfo } from './TileInfo';
import { TopBar } from './TopBar';
import { useStore } from './useStore';
import { ToolBar } from './ToolBar';

export function App({ game }: { game: Game }) {
  const snapshot = useStore(game.snapshot);
  const hover = useStore(game.hover);
  const tool = useStore(game.tool);
  const toolPreview = useStore(game.toolPreview);
  return (
    <div className="hud">
      <TopBar snapshot={snapshot} />
      <ToolBar tool={tool} preview={toolPreview} treasury={snapshot.treasury} onSelect={(next) => game.setTool(next)} />
      <TileInfo info={hover} />
    </div>
  );
}
