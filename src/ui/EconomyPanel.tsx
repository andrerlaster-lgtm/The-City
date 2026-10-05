import type { SimSnapshot } from '../sim/Simulation';
import { formatNumber, formatSigned } from './format';

export function EconomyPanel({ snapshot, onClose }: { snapshot: SimSnapshot; onClose: () => void }) {
  const { lastDay: last, today, projected } = snapshot.economy;
  return <aside className="economy-panel" aria-label="Economy breakdown">
    <button className="economy-panel__close" type="button" onClick={onClose} aria-label="Close economy">×</button>
    <h2>Economy</h2>
    <p><strong>Projected daily net:</strong> {formatSigned(projected.net)} <small>(taxes − upkeep, before construction)</small></p>
    <h3>Today so far</h3>
    <dl>
      <dt>Construction</dt><dd>−{formatNumber(today.construction)}</dd>
      <dt>Taxes due at 00:00</dt><dd>+{formatNumber(projected.income)} <small>(citizens arrive in M5)</small></dd>
      <dt>Upkeep due at 00:00</dt><dd>−{formatNumber(projected.expenses)}</dd>
    </dl>
    <h3>Yesterday</h3>
    {last ? <dl>
      <dt>Taxes</dt><dd>+{formatNumber(last.taxes)}</dd>
      <dt>Building upkeep</dt><dd>−{formatNumber(last.upkeepBuildings)}</dd>
      <dt>Road upkeep</dt><dd>−{formatNumber(last.upkeepRoads)}</dd>
      <dt>Construction</dt><dd>−{formatNumber(last.construction)}</dd>
      <dt>Net</dt><dd>{formatSigned(last.net)}</dd>
    </dl> : <p>No completed day yet.</p>}
  </aside>;
}
