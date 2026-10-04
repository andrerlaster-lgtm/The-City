import { buildingDefinition } from '../data/buildings';
import type { BuildingInstance } from '../sim/buildings/buildings';
import { formatNumber } from './format';

export function InfoPanel({ building }: { building: BuildingInstance | null }) {
  if (!building) return null;
  const definition = buildingDefinition(building.defId);
  if (!definition) return null;
  const capacity = definition.housing > 0 ? `Residents: 0 / ${definition.housing}` : `Jobs: 0 / ${definition.jobs}`;
  return <aside className="info-panel" aria-label={`${definition.name} information`}>
    <h2>{definition.name}</h2>
    <p>{definition.description}</p>
    <dl>
      <dt>Cost</dt><dd>{formatNumber(definition.cost)} coins</dd>
      <dt>Upkeep</dt><dd>{formatNumber(definition.upkeep)} coins / day</dd>
      <dt>{definition.housing > 0 ? 'Housing' : 'Work'}</dt><dd>{capacity}</dd>
      {definition.serviceRadius > 0 && <><dt>Service radius</dt><dd>{definition.serviceRadius} tiles</dd></>}
      <dt>Road access</dt><dd>{building.roadAccess ? 'Yes' : 'No'}</dd>
      <dt>Entrance connection</dt><dd className={!building.connected ? 'info-panel__warning' : ''}>{building.connected ? 'Connected' : 'Disconnected — will not count until connected'}</dd>
    </dl>
  </aside>;
}
