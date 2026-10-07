import { useEffect, useState } from 'react';
import type { SaveService } from '../app/saveService';
import type { SlotId } from '../save/format';
import { SLOT_LABELS, type SlotSummary } from '../save/slots';
import { formatNumber } from './format';
import { useStore } from './useStore';
import { ThemePicker } from './ThemePicker';

type Pending = { action: 'save' | 'load' | 'delete'; slot: SlotId } | { action: 'new'; seed: number | undefined };

export function SaveMenu({ saves, seed, onClose }: { saves: SaveService; seed: number; onClose: () => void }) {
  const slots = useStore(saves.slots);
  const status = useStore(saves.status);
  const available = useStore(saves.available);
  const [pending, setPending] = useState<Pending | null>(null);
  const [busy, setBusy] = useState(false);
  const [seedInput, setSeedInput] = useState('');
  const [copied, setCopied] = useState<string | null>(null);

  useEffect(() => { void saves.refresh(); }, [saves]);

  const run = async (task: () => Promise<unknown>) => {
    setBusy(true);
    try { await task(); } finally { setBusy(false); setPending(null); }
  };
  const confirm = () => {
    if (!pending) return;
    if (pending.action === 'new') void run(() => saves.newGame(pending.seed));
    else if (pending.action === 'save') void run(() => saves.saveTo(pending.slot));
    else if (pending.action === 'load') void run(() => saves.loadFrom(pending.slot));
    else void run(() => saves.remove(pending.slot));
  };
  const copySeed = async () => {
    try {
      await navigator.clipboard.writeText(String(seed));
      setCopied('Seed copied.');
    } catch {
      setCopied('Copy isn’t available here. Select the seed and copy it.');
    }
  };
  const typedSeed = parseSeed(seedInput);

  return <aside className="save-menu" aria-label="Game menu">
    <button className="save-menu__close" type="button" onClick={onClose} aria-label="Close menu">×</button>
    <h2>Game</h2>
    <div className="save-menu__seed-row">
      <span>Seed</span>
      <code className="save-menu__seed" title="Select to copy">{seed}</code>
      <button type="button" onClick={() => void copySeed()}>Copy</button>
    </div>
    {copied && <p className="save-menu__hint">{copied}</p>}
    {available === false && <p className="save-menu__warning">Saving isn’t available in this browser. The game still runs.</p>}
    {status && <p className={status.kind === 'error' ? 'save-menu__warning' : 'save-menu__status'} role="status">{status.text}</p>}

    <h3>Look</h3>
    <ThemePicker />

    <h3>Saves</h3>
    <ul className="save-menu__slots">
      {slots.map((summary) => <li key={summary.slot} className="save-slot">
        <div className="save-slot__info">
          <strong>{SLOT_LABELS[summary.slot]}</strong>
          <span>{describe(summary)}</span>
        </div>
        <div className="save-slot__actions">
          {summary.slot !== 'autosave' && <button type="button" disabled={busy || !available} onClick={() => summary.status === 'empty' ? void run(() => saves.saveTo(summary.slot)) : setPending({ action: 'save', slot: summary.slot })}>Save</button>}
          <button type="button" disabled={busy || summary.status !== 'ok'} onClick={() => setPending({ action: 'load', slot: summary.slot })}>Load</button>
          {summary.slot !== 'autosave' && summary.status !== 'empty' && <button type="button" disabled={busy} onClick={() => setPending({ action: 'delete', slot: summary.slot })}>Delete</button>}
        </div>
      </li>)}
    </ul>

    <h3>New game</h3>
    <div className="save-menu__new">
      <input aria-label="Seed for the new game (optional)" placeholder="Random seed" inputMode="numeric" value={seedInput} onChange={(event) => setSeedInput(event.target.value)} />
      <button type="button" disabled={busy || (seedInput.trim() !== '' && typedSeed === null)} onClick={() => setPending({ action: 'new', seed: typedSeed ?? undefined })}>New game</button>
    </div>
    {seedInput.trim() !== '' && typedSeed === null && <p className="save-menu__warning">A seed is a whole number from 0 to 4294967295.</p>}

    {pending && <div className="save-menu__confirm" role="alertdialog" aria-label="Confirm">
      <p>{confirmText(pending)}</p>
      <button type="button" disabled={busy} onClick={confirm}>Confirm</button>
      <button type="button" disabled={busy} onClick={() => setPending(null)}>Cancel</button>
    </div>}
  </aside>;
}

function describe(summary: SlotSummary): string {
  if (summary.status === 'empty') return 'Empty';
  if (summary.status === 'error') return `Can’t load: ${summary.reason}`;
  const { meta } = summary;
  return `Day ${formatNumber(meta.day)} · ${formatNumber(meta.population)} people · ${formatNumber(meta.treasury)} ◈ · seed ${meta.seed} · ${new Date(meta.savedAt).toLocaleString()}`;
}

function confirmText(pending: Pending): string {
  if (pending.action === 'new') return `Start a new game${pending.seed === undefined ? ' with a random seed' : ` with seed ${pending.seed}`}? Your current city is autosaved first.`;
  const label = SLOT_LABELS[pending.slot];
  if (pending.action === 'save') return `Overwrite ${label}?`;
  if (pending.action === 'delete') return `Delete ${label}? This can’t be undone.`;
  return pending.slot === 'autosave'
    ? 'Load the autosave? Unsaved progress since it was made will be lost.'
    : `Load ${label}? Your current city is autosaved first. The loaded game starts paused.`;
}

/** A uint32 seed, or null when the text isn't one. */
function parseSeed(text: string): number | null {
  const trimmed = text.trim();
  if (!/^\d+$/.test(trimmed)) return null;
  const value = Number(trimmed);
  return value <= 0xffffffff ? value : null;
}
