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
import { SaveMenu } from './SaveMenu';
import type { SaveService } from '../app/saveService';
import { useState } from 'react';
import { Toasts } from './Toasts';

export function App({ game, saves }: { game: Game; saves: SaveService }) {
  const snapshot = useStore(game.snapshot);
  const hover = useStore(game.hover);
  const tool = useStore(game.tool);
  const toolPreview = useStore(game.toolPreview);
  const selectedBuilding = useStore(game.selectedBuilding);
  const [economyOpen, setEconomyOpen] = useState(false);
  const [citizensOpen, setCitizensOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const reducedMotion = useStore(game.reducedMotion);
  return (
    <div className="hud">
      <TopBar snapshot={snapshot} reducedMotion={reducedMotion} onEconomy={() => setEconomyOpen(!economyOpen)} onCitizens={() => setCitizensOpen(!citizensOpen)} onMenu={() => setMenuOpen(!menuOpen)} />
      <SpeedControls speed={snapshot.speed} onSet={(speed) => game.setSpeed(speed)} />
      {economyOpen && <EconomyPanel snapshot={snapshot} onClose={() => setEconomyOpen(false)} />}
      {citizensOpen && <CitizensPanel snapshot={snapshot} onClose={() => setCitizensOpen(false)} />}
      {menuOpen && <SaveMenu saves={saves} seed={snapshot.seed} onClose={() => setMenuOpen(false)} />}
      <Toasts toasts={game.toasts} />
      {snapshot.economy.immigrationPaused && <div className="debt-banner" role="status">Funds empty — immigration paused</div>}
      <ToolBar tool={tool} preview={toolPreview} treasury={snapshot.treasury} onSelect={(next) => game.setTool(next)} />
      <TileInfo info={hover} />
      <BuildMenu tool={tool} treasury={snapshot.treasury} onSelect={(next) => game.setTool(next)} />
      <InfoPanel building={selectedBuilding} occupancy={selectedBuilding ? game.sim.getOccupancy(selectedBuilding.id) : null} production={selectedBuilding ? game.sim.getProduction(selectedBuilding.id) : null} />
    </div>
  );
}
