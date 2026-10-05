import type { GameDate } from '../sim/time/calendar';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export function formatNumber(n: number): string {
  return Math.round(n).toLocaleString('en-US');
}

export function formatSigned(n: number): string {
  return `${n < 0 ? '−' : '+'}${formatNumber(Math.abs(n))}`;
}

export function formatDate(d: GameDate): string {
  return `${MONTHS[d.month - 1] ?? '?'} ${d.day}, Year ${d.year}`;
}

export function formatHour(d: GameDate): string {
  return `${String(d.hour).padStart(2, '0')}:00`;
}
