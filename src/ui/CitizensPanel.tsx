import type { SimSnapshot } from '../sim/Simulation';
import { formatNumber } from './format';

export function CitizensPanel({ snapshot, onClose }: { snapshot: SimSnapshot; onClose: () => void }) {
  const last = snapshot.economy.lastDay?.migration;
  return <aside className="citizens-panel" aria-label="Citizens">
    <button className="citizens-panel__close" type="button" onClick={onClose} aria-label="Close citizens">×</button>
    <h2>Citizens</h2>
    <dl>
      <dt>Employed</dt><dd>{formatNumber(snapshot.employed)}</dd>
      <dt>Unemployed</dt><dd>{formatNumber(snapshot.unemployed)}</dd>
      <dt>Hungry</dt><dd>{formatNumber(snapshot.hungry)}</dd>
      <dt>Homeless / disconnected</dt><dd>{formatNumber(snapshot.homeless)}</dd>
    </dl>
    <h3>Yesterday</h3>
    {last ? <dl>
      <dt>Arrived</dt><dd>{formatNumber(last.arrived)}</dd>
      <dt>Left hungry</dt><dd>{formatNumber(last.left.hunger)}</dd>
      <dt>Left unemployed</dt><dd>{formatNumber(last.left.unemployment)}</dd>
      <dt>Left homeless</dt><dd>{formatNumber(last.left.homeless)}</dd>
    </dl> : <p>No completed day yet.</p>}
    {snapshot.economy.immigrationPaused && <p className="citizens-panel__warning">Immigration paused</p>}
  </aside>;
}
