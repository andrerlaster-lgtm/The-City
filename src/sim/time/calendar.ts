import { BALANCE } from '../../data/balance';

export interface GameDate {
  year: number;
  /** 1-based. */
  month: number;
  /** 1-based. */
  day: number;
  hour: number;
}

const { ticksPerDay, daysPerMonth, monthsPerYear } = BALANCE.time;

/** Converts a tick count to a calendar date. Year 1, month 1, day 1, 00:00 is tick 0. */
export function tickToDate(tick: number): GameDate {
  const hour = tick % ticksPerDay;
  const totalDays = Math.floor(tick / ticksPerDay);
  const day = (totalDays % daysPerMonth) + 1;
  const totalMonths = Math.floor(totalDays / daysPerMonth);
  const month = (totalMonths % monthsPerYear) + 1;
  const year = Math.floor(totalMonths / monthsPerYear) + 1;
  return { year, month, day, hour };
}
