import { BALANCE } from '../../data/balance';

const { ticksPerDay } = BALANCE.time;

/** A daily settlement is due at 00:00 after each full day, never at tick 0. */
export function isDayStart(tick: number): boolean {
  return tick > 0 && tick % ticksPerDay === 0;
}

/** Zero-based count of completed game days. */
export function dayIndex(tick: number): number {
  return Math.floor(tick / ticksPerDay);
}
