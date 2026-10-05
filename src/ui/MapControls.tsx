import type { Game } from '../app/Game';
import { OVERLAY_LEGENDS, OVERLAY_ORDER, Tint, type OverlayKind } from '../render/overlays';
import { useStore } from './useStore';

const LABELS: Record<OverlayKind, string> = { none: 'None', water: 'Water', roads: 'Roads' };
const SWATCH: Record<Exclude<Tint, typeof Tint.None>, string> = {
  [Tint.Good]: 'map-legend__swatch--good',
  [Tint.Warn]: 'map-legend__swatch--warn',
  [Tint.Bad]: 'map-legend__swatch--bad',
};

/** Overlay picker (O cycles), its legend, and the go-to-Entrance button (Home key). */
export function MapControls({ game }: { game: Game }) {
  const overlay = useStore(game.overlay);
  const legend = overlay === 'none' ? null : OVERLAY_LEGENDS[overlay];
  return <section className="map-controls" aria-label="Map controls">
    {legend && <div className="map-legend" aria-label={`${legend.label} legend`}>
      <strong>{legend.label}</strong>
      {legend.entries.map((entry) => <span key={entry.text} className="map-legend__entry">
        <span className={`map-legend__swatch ${SWATCH[entry.tint as Exclude<Tint, typeof Tint.None>]}`} aria-hidden="true" />{entry.text}
      </span>)}
    </div>}
    <div className="map-controls__row">
      <span className="map-controls__label" title="Press O to cycle overlays">Overlay</span>
      <div role="group" aria-label="Map overlay">
        {OVERLAY_ORDER.map((kind) => <button key={kind} type="button" aria-pressed={overlay === kind} onClick={() => game.setOverlay(kind)}>{LABELS[kind]}</button>)}
      </div>
      <button type="button" className="map-controls__entrance" onClick={() => game.goToEntrance()} title="Go to the Entrance (Home key)">⌂ Entrance</button>
    </div>
  </section>;
}
