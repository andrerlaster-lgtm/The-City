import type { SimSnapshot } from '../sim/Simulation';
import { formatNumber, formatSigned } from './format';

export function EconomyPanel({ snapshot, onClose }: { snapshot: SimSnapshot; onClose: () => void }) {
  const { lastDay: last, today, projected } = snapshot.economy;
  return <aside className="economy-panel" aria-label="Economy breakdown">
    <button className="economy-panel__close" type="button" onClick={onClose} aria-label="Close economy">×</button>
    <h2>Economy</h2>
    <p><strong>Projected daily net:</strong> {formatSigned(projected.net)}</p>
    <h3>Today so far</h3>
    <dl>
      <dt>Construction</dt><dd>−{formatNumber(today.construction)}</dd>
      <dt>Resident taxes due</dt><dd>+{formatNumber(projected.taxesResidents)}</dd>
      <dt>Employment taxes due</dt><dd>+{formatNumber(projected.taxesEmployed)}</dd>
      <dt>Workshop revenue due</dt><dd>+{formatNumber(projected.revenue)}</dd>
      <dt>Upkeep due at 00:00</dt><dd>−{formatNumber(projected.expenses)}</dd>
    </dl>
    <h3>Yesterday</h3>
    {last ? <dl>
      <dt>Resident taxes</dt><dd>+{formatNumber(last.taxesResidents)}</dd>
      <dt>Employment taxes</dt><dd>+{formatNumber(last.taxesEmployed)}</dd>
      <dt>Workshop revenue</dt><dd>+{formatNumber(last.revenue)}</dd>
      <dt>Building upkeep</dt><dd>−{formatNumber(last.upkeepBuildings)}</dd>
      <dt>Road upkeep</dt><dd>−{formatNumber(last.upkeepRoads)}</dd>
      <dt>Construction</dt><dd>−{formatNumber(last.construction)}</dd>
      <dt>Food produced / eaten</dt><dd>{formatNumber(last.foodProduced)} / {formatNumber(last.foodEaten)}</dd>
      <dt>Arrived / left</dt><dd>{formatNumber(last.migration.arrived)} / {formatNumber(last.migration.left.hunger + last.migration.left.unemployment + last.migration.left.homeless)}</dd>
      <dt>Net</dt><dd>{formatSigned(last.net)}</dd>
    </dl> : <p>No completed day yet.</p>}
  </aside>;
}
