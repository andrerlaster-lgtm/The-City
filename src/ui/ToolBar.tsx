import type { Tool, ToolPreview } from '../app/Game';
import { formatNumber } from './format';

function describe(tool: Tool | null, preview: ToolPreview | null): { text: string; invalid: boolean } {
  if (preview?.kind === 'road') {
    const land = preview.valid ? 'land OK' : `${preview.invalid.length} blocked`;
    return {
      text: `${preview.cost} coins · ${land} · ${preview.affordable ? 'affordable' : 'too expensive'}`,
      invalid: !preview.valid || !preview.affordable,
    };
  }
  if (preview?.kind === 'demolish') {
    return preview.removable
      ? { text: `Remove ${preview.removable} road tile${preview.removable === 1 ? '' : 's'}`, invalid: false }
      : { text: 'No removable roads here', invalid: true };
  }
  if (tool === 'road') return { text: 'Drag across land to build · 10 per tile', invalid: false };
  if (tool === 'demolish') return { text: 'Drag across roads to demolish', invalid: false };
  return { text: 'Pick a tool · right-drag pans while building', invalid: false };
}

export function ToolBar({ tool, preview, treasury, onSelect }: {
  tool: Tool | null;
  preview: ToolPreview | null;
  treasury: number;
  onSelect: (tool: Tool | null) => void;
}) {
  const { text, invalid } = describe(tool, preview);
  return <section className="tool-bar" aria-label="Build tools">
    <button type="button" aria-pressed={tool === 'road'} onClick={() => onSelect(tool === 'road' ? null : 'road')}>Road</button>
    <button type="button" aria-pressed={tool === 'demolish'} onClick={() => onSelect(tool === 'demolish' ? null : 'demolish')}>Demolish</button>
    <span className={`tool-bar__preview${invalid ? ' tool-bar__preview--invalid' : ''}`}>{text}</span>
    <span className="tool-bar__money">{formatNumber(treasury)} coins</span>
  </section>;
}
