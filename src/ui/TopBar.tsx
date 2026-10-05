import type { SimSnapshot } from '../sim/Simulation';
import { formatDate, formatHour, formatNumber, formatSigned } from './format';

interface Stat {
  label: string;
  value: string;
  icon: string;
}

export function TopBar({ snapshot, onEconomy, onCitizens }: { snapshot: SimSnapshot; onEconomy: () => void; onCitizens: () => void }) {
  const stats: Stat[] = [
    { label: 'Population', value: formatNumber(snapshot.population), icon: '☺' },
    { label: 'Free housing', value: formatNumber(snapshot.freeHousing), icon: '⌂' },
    { label: 'Open jobs', value: formatNumber(snapshot.freeJobs), icon: '⚒' },
    { label: 'Food', value: `${formatNumber(snapshot.food)} (${formatSigned(snapshot.foodChange)}/day)`, icon: '●' },
  ];

  return (
    <header className="top-bar" aria-label="City status">
      <div className="top-bar__title">The City Life</div>
      <button className={`stat treasury-stat ${snapshot.economy.projected.net >= 0 ? 'treasury-stat--positive' : 'treasury-stat--negative'}`} type="button" onClick={onEconomy} aria-label="Open economy breakdown">
        <span className="stat__icon" aria-hidden="true">◈</span>
        <span className="stat__body"><span className="stat__label">Treasury</span><span className="stat__value">{formatNumber(snapshot.treasury)} <small>{formatSigned(snapshot.economy.projected.net)}/day</small></span></span>
      </button>
      <ul className="top-bar__stats">
        {stats.map((s) => (
          <li key={s.label} className="stat" title={s.label}>
            {s.label === 'Population' ? <button className="stat__button" type="button" onClick={onCitizens} aria-label="Open citizens panel">{renderStat(s)}</button> : renderStat(s)}
          </li>
        ))}
      </ul>
      <div className="top-bar__clock" aria-label="Date">
        <span className="clock__date">{formatDate(snapshot.date)}</span>
        <span className="clock__hour">{formatHour(snapshot.date)}</span>
      </div>
      <span className="top-bar__speed">{snapshot.speed === 0 ? '⏸' : `${snapshot.speed}×`}</span>
    </header>
  );
}

function renderStat(stat: Stat) {
  return <><span className="stat__icon" aria-hidden="true">{stat.icon}</span><span className="stat__body"><span className="stat__label">{stat.label}</span><span className="stat__value">{stat.value}</span></span></>;
}
