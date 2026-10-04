/**
 * WASD / arrow-key panning. Speed is in screen pixels so it feels the same at
 * every zoom level.
 */
import type { Ticker } from 'pixi.js';
import type { Viewport } from 'pixi-viewport';

const SPEED = 900;
const KEYS: Record<string, [number, number]> = {
  KeyW: [0, -1],
  ArrowUp: [0, -1],
  KeyS: [0, 1],
  ArrowDown: [0, 1],
  KeyA: [-1, 0],
  ArrowLeft: [-1, 0],
  KeyD: [1, 0],
  ArrowRight: [1, 0],
};

function isTyping(target: EventTarget | null): boolean {
  return target instanceof HTMLElement && (target.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName));
}

export function attachKeyboardPan(viewport: Viewport, ticker: Ticker): () => void {
  const held = new Set<string>();
  const down = (e: KeyboardEvent) => {
    if (!(e.code in KEYS) || isTyping(e.target) || e.metaKey || e.ctrlKey) return;
    held.add(e.code);
    e.preventDefault();
  };
  const up = (e: KeyboardEvent) => held.delete(e.code);
  const blur = () => held.clear();
  const step = (t: Ticker) => {
    if (held.size === 0) return;
    let dx = 0;
    let dy = 0;
    for (const code of held) {
      const dir = KEYS[code];
      if (dir) {
        dx += dir[0];
        dy += dir[1];
      }
    }
    const dist = (SPEED * t.deltaMS) / 1000 / viewport.scale.x;
    const center = viewport.center;
    viewport.moveCenter(center.x + dx * dist, center.y + dy * dist);
    viewport.emit('moved', { viewport, type: 'keyboard' } as never);
  };

  window.addEventListener('keydown', down);
  window.addEventListener('keyup', up);
  window.addEventListener('blur', blur);
  ticker.add(step);
  return () => {
    window.removeEventListener('keydown', down);
    window.removeEventListener('keyup', up);
    window.removeEventListener('blur', blur);
    ticker.remove(step);
  };
}
