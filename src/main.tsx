import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { Game } from './app/Game';
import { SaveService, startupSimulation } from './app/saveService';
import { IndexedDbSaveProvider } from './save/providers/indexedDb';
import { SaveSlots } from './save/slots';
import { App } from './ui/App';
import './ui/styles/tokens.css';
import './ui/styles/hud.css';
import './ui/styles/economy.css';
import './ui/styles/citizens.css';
import './ui/styles/save.css';

const canvasHost = document.getElementById('canvas-host');
const uiRoot = document.getElementById('ui-root');
if (!canvasHost || !uiRoot) throw new Error('Missing #canvas-host or #ui-root');

async function boot(canvasHost: HTMLElement, uiRoot: HTMLElement): Promise<void> {
  const slots = new SaveSlots(new IndexedDbSaveProvider());
  // Continue from the autosave (paused) when there is one; otherwise a new game with a random seed.
  const startup = await startupSimulation(slots);
  const game = new Game(startup.sim, { paused: startup.paused });
  await game.start(canvasHost);
  const saves = new SaveService(game, slots);
  game.onTick = (tick) => saves.onTick(tick);
  saves.attachVisibility(document);
  if (startup.note) saves.status.set(startup.note);
  void saves.refresh();
  createRoot(uiRoot).render(
    <StrictMode>
      <App game={game} saves={saves} />
    </StrictMode>,
  );
}

void boot(canvasHost, uiRoot);
