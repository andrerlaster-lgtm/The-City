import { buildingDefinition } from '../data/buildings';
import type { BuildingInstance } from '../sim/buildings/buildings';
import { formatNumber } from './format';
import type { BuildingOccupancy } from '../sim/citizens/citizens';
import type { BuildingProduction } from '../sim/resources/production';
import { BALANCE } from '../data/balance';
import { Fragment } from 'react';
import type { ServiceKind } from '../data/buildings';

const SERVICE_LABELS: Record<ServiceKind, string> = { water: 'Water coverage' };

export function InfoPanel({ building, occupancy, production }: { building: BuildingInstance | null; occupancy: BuildingOccupancy | null; production: BuildingProduction | null }) {
  if (!building) return null;
  const definition = buildingDefinition(building.defId);
  if (!definition) return null;
  const capacity = definition.housing > 0
    ? `Residents: ${occupancy?.residents ?? 0} / ${definition.housing}`
    : `Workers: ${occupancy?.workers ?? 0} / ${definition.jobs}`;
  return <aside className="info-panel" aria-label={`${definition.name} information`}>
    <h2>{definition.name}</h2>
    <p>{definition.description}</p>
    <dl>
      <dt>Cost</dt><dd>{formatNumber(definition.cost)} coins</dd>
      <dt>Upkeep</dt><dd>{formatNumber(definition.upkeep)} coins / day</dd>
      <dt>{definition.housing > 0 ? 'Housing' : 'Work'}</dt><dd>{capacity}</dd>
      {definition.produces === 'food' && <><dt>Food</dt><dd className={production?.food ? '' : 'info-panel__warning'}>{outputText(production?.food ?? 0, production?.workers ?? 0, BALANCE.citizens.foodPerFarmWorker, 'food')}</dd></>}
      {definition.produces === 'revenue' && <><dt>Revenue</dt><dd className={production?.revenue ? '' : 'info-panel__warning'}>{outputText(production?.revenue ?? 0, production?.workers ?? 0, BALANCE.economy.workshopRevenuePerWorker, 'coins')}</dd></>}
      {definition.services.map((service) => <Fragment key={service.kind}><dt>{SERVICE_LABELS[service.kind]}</dt><dd>{service.radius} tiles</dd></Fragment>)}
      <dt>Road access</dt><dd>{building.roadAccess ? 'Yes' : 'No'}</dd>
      <dt>Entrance connection</dt><dd className={!building.connected ? 'info-panel__warning' : ''}>{building.connected ? 'Connected' : 'Disconnected'}</dd>
      {!building.connected && <><dt className="info-panel__warning" /><dd className="info-panel__warning">Residents/jobs don't count until connected</dd></>}
    </dl>
  </aside>;
}

/** "+10 food / day (5 workers × 2)", or why it's zero. */
function outputText(amount: number, workers: number, perWorker: number, unit: string): string {
  if (workers === 0) return `0 ${unit} / day · needs workers`;
  return `+${formatNumber(amount)} ${unit} / day (${workers} worker${workers === 1 ? '' : 's'} × ${perWorker})`;
}
