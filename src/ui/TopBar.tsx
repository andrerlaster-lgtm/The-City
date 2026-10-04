import type { SimSnapshot } from '../sim/Simulation';
import { formatDate, formatHour, formatNumber } from './format';

interface Stat {
  label: string;
  value: string;
  icon: string;
}

export function TopBar({ snapshot }: { snapshot: SimSnapshot }) {
  const stats: Stat[] = [
    { label: 'Treasury', value: formatNumber(snapshot.treasury), icon: '◈' },
    { label: 'Population', value: formatNumber(snapshot.population), icon: '☺' },
    { label: 'Free housing', value: formatNumber(snapshot.freeHousing), icon: '⌂' },
    { label: 'Open jobs', value: formatNumber(snapshot.freeJobs), icon: '⚒' },
  ];

  return (
    <header className="top-bar" aria-label="City status">
      <div className="top-bar__title">The City Life</div>
      <ul className="top-bar__stats">
        {stats.map((s) => (
          <li key={s.label} className="stat" title={s.label}>
            <span className="stat__icon" aria-hidden="true">{s.icon}</span>
            <span className="stat__body">
              <span className="stat__label">{s.label}</span>
              <span className="stat__value">{s.value}</span>
            </span>
          </li>
        ))}
      </ul>
      <div className="top-bar__clock" aria-label="Date">
        <span className="clock__date">{formatDate(snapshot.date)}</span>
        <span className="clock__hour">{formatHour(snapshot.date)}</span>
      </div>
    </header>
  );
}
