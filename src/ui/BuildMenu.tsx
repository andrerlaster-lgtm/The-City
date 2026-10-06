import { useState } from 'react';
import { BUILDINGS, type BuildingId } from '../data/buildings';
import { formatNumber } from './format';
import type { Tool } from '../app/Game';

export function BuildMenu({ tool, treasury, onSelect }: {
  tool: Tool | null;
  treasury: number;
  onSelect: (tool: Tool | null) => void;
}) {
  const categories = ['Residential', 'Employment', 'Service'] as const;
  const activeId = tool && typeof tool === 'object' ? tool.build : null;
  const [collapsed, setCollapsed] = useState(false);
  const activeName = activeId ? BUILDINGS.find((building) => building.id === activeId)?.name : null;
  return <aside className={collapsed ? 'build-menu is-collapsed' : 'build-menu'} aria-label="Building menu">
    <h2>
      <button type="button" className="build-menu__toggle" aria-expanded={!collapsed} aria-controls="build-menu-list"
        title={collapsed ? 'Show buildings' : 'Hide buildings'} onClick={() => setCollapsed(!collapsed)}>
        <span>Buildings{collapsed && activeName ? <small> · {activeName}</small> : null}</span>
        <span className="build-menu__chevron" aria-hidden="true">{collapsed ? '▸' : '▾'}</span>
      </button>
    </h2>
    {!collapsed && <div id="build-menu-list">{categories.map((category) => <section key={category}>
      <h3>{category}</h3>
      {BUILDINGS.filter((building) => building.category === category).map((building) => {
        const unaffordable = treasury < building.cost;
        return <button key={building.id} type="button" className={unaffordable ? 'build-menu__item is-unaffordable' : 'build-menu__item'}
          aria-pressed={activeId === building.id} aria-disabled={unaffordable}
          onClick={() => onSelect(activeId === building.id ? null : { build: building.id as BuildingId })}>
          <span>{building.name}</span><span>{formatNumber(building.cost)} ◈</span>
        </button>;
      })}
    </section>)}</div>}
  </aside>;
}
