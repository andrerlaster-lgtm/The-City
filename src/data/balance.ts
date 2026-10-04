/**
 * Every tunable number in one place. Systems read from here; nothing
 * hard-codes balance values.
 */
export const BALANCE = {
  map: {
    width: 128,
    height: 128,
  },
  time: {
    /** Sim ticks per in-game day (1 tick = 1 game hour). */
    ticksPerDay: 24,
    /** Real milliseconds per tick at 1x speed. */
    msPerTickAt1x: 500,
    /** Upper bound on ticks drained in one frame (prevents catch-up bursts). */
    maxCatchUpTicks: 8,
    speeds: [0, 1, 2, 3] as const,
    daysPerMonth: 30,
    monthsPerYear: 12,
  },
  economy: {
    startingTreasury: 5000,
  },
} as const;
