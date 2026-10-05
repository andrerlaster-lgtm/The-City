import type { Game } from '../app/Game';
import { TileInfo } from './TileInfo';
import { TopBar } from './TopBar';
import { useStore } from './useStore';
import { ToolBar } from './ToolBar';
import { BuildMenu } from './BuildMenu';
import { InfoPanel } from './InfoPanel';
import { SpeedControls } from './SpeedControls';
import { EconomyPanel } from './EconomyPanel';
import { CitizensPanel } from './CitizensPanel';
import { useState } from 'react';

export function App({ game }: { game: Game }) {
  const snapshot = useStore(game.snapshot);
  const hover = useStore(game.hover);
  const tool = useStore(game.tool);
  const toolPreview = useStore(game.toolPreview);
  const selectedBuilding = useStore(game.selectedBuilding);
  const [economyOpen, setEconomyOpen] = useState(false);
  const [citizensOpen, setCitizensOpen] = useState(false);
  return (
    <div className="hud">
      <TopBar snapshot={snapshot} onEconomy={() => setEconomyOpen(!economyOpen)} onCitizens={() => setCitizensOpen(!citizensOpen)} />
      <SpeedControls speed={snapshot.speed} onSet={(speed) => game.setSpeed(speed)} />
      {economyOpen && <EconomyPanel snapshot={snapshot} onClose={() => setEconomyOpen(false)} />}
      {citizensOpen && <CitizensPanel snapshot={snapshot} onClose={() => setCitizensOpen(false)} />}
      {snapshot.economy.immigrationPaused && <div className="debt-banner" role="status">Funds empty — immigration paused</div>}
      <ToolBar tool={tool} preview={toolPreview} treasury={snapshot.treasury} onSelect={(next) => game.setTool(next)} />
      <TileInfo info={hover} />
      <BuildMenu tool={tool} treasury={snapshot.treasury} onSelect={(next) => game.setTool(next)} />
      <InfoPanel building={selectedBuilding} occupancy={selectedBuilding ? game.sim.getOccupancy(selectedBuilding.id) : null} />
    </div>
  );
}
