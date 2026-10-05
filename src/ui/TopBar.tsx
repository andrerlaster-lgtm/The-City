import type { SimSnapshot } from '../sim/Simulation';
import { formatDate, formatHour, formatNumber, formatSigned } from './format';
import { useTweenedNumber } from './useTweenedNumber';

interface Stat {
  label: string;
  value: number;
  /** Small secondary text after the value, e.g. "+12/day". */
  sub?: string;
  icon: string;
}

export function TopBar({ snapshot, reducedMotion, onEconomy, onCitizens, onMenu }: {
  snapshot: SimSnapshot;
  reducedMotion: boolean;
  onEconomy: () => void;
  onCitizens: () => void;
  onMenu: () => void;
}) {
  const treasury = useTweenedNumber(snapshot.treasury, reducedMotion);
  const stats: Stat[] = [
    { label: 'Population', value: snapshot.population, icon: '☺' },
    { label: 'Free housing', value: snapshot.freeHousing, icon: '⌂' },
    { label: 'Open jobs', value: snapshot.freeJobs, icon: '⚒' },
    { label: 'Food', value: snapshot.food, sub: `${formatSigned(snapshot.foodChange)}/day`, icon: '●' },
  ];

  return (
    <header className="top-bar" aria-label="City status">
      <div className="top-bar__title">The City Life</div>
      <button className={`stat treasury-stat ${snapshot.economy.projected.net >= 0 ? 'treasury-stat--positive' : 'treasury-stat--negative'}`} type="button" onClick={onEconomy} aria-label="Open economy breakdown">
        <span className="stat__icon" aria-hidden="true">◈</span>
        <span className="stat__body"><span className="stat__label">Treasury</span><span className="stat__value">{formatNumber(treasury)} <small>{formatSigned(snapshot.economy.projected.net)}/day</small></span></span>
      </button>
      <ul className="top-bar__stats">
        {stats.map((s) => (
          <li key={s.label} className="stat" title={s.label}>
            {s.label === 'Population'
              ? <button className="stat__button" type="button" onClick={onCitizens} aria-label="Open citizens panel"><StatBody stat={s} reducedMotion={reducedMotion} /></button>
              : <StatBody stat={s} reducedMotion={reducedMotion} />}
          </li>
        ))}
      </ul>
      <div className="top-bar__clock" aria-label="Date">
        <span className="clock__date">{formatDate(snapshot.date)}</span>
        <span className="clock__hour">{formatHour(snapshot.date)}</span>
      </div>
      <span className="top-bar__speed">{snapshot.speed === 0 ? '⏸' : `${snapshot.speed}×`}</span>
      <button className="top-bar__menu" type="button" onClick={onMenu} aria-label="Open game menu (save, load, new game)">Menu</button>
    </header>
  );
}

function StatBody({ stat, reducedMotion }: { stat: Stat; reducedMotion: boolean }) {
  const value = useTweenedNumber(stat.value, reducedMotion);
  return <>
    <span className="stat__icon" aria-hidden="true">{stat.icon}</span>
    <span className="stat__body">
      <span className="stat__label">{stat.label}</span>
      <span className="stat__value">{formatNumber(value)}{stat.sub && <> <small>{stat.sub}</small></>}</span>
    </span>
  </>;
}
