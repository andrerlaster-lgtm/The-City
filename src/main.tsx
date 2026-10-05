import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { Game } from './app/Game';
import { App } from './ui/App';
import './ui/styles/tokens.css';
import './ui/styles/hud.css';
import './ui/styles/economy.css';
import './ui/styles/citizens.css';

const canvasHost = document.getElementById('canvas-host');
const uiRoot = document.getElementById('ui-root');
if (!canvasHost || !uiRoot) throw new Error('Missing #canvas-host or #ui-root');

async function boot(canvasHost: HTMLElement, uiRoot: HTMLElement): Promise<void> {
  const game = new Game(20261004);
  await game.start(canvasHost);
  createRoot(uiRoot).render(
    <StrictMode>
      <App game={game} />
    </StrictMode>,
  );
}

void boot(canvasHost, uiRoot);
