import type { SimSnapshot } from '../sim/Simulation';

const speeds = [0, 1, 2, 3] as const;

export function SpeedControls({ speed, onSet }: { speed: SimSnapshot['speed']; onSet: (speed: 0 | 1 | 2 | 3) => void }) {
  return <nav className="speed-controls" aria-label="Game speed">
    {speeds.map((value) => <button key={value} type="button" aria-pressed={speed === value} onClick={() => onSet(value)}>{value === 0 ? '⏸' : `${value}×`}</button>)}
  </nav>;
}
