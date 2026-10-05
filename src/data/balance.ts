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
    startSpeed: 1,
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
    roadUpkeepPerTile: 0.1,
    taxPerEmployed: 2,
    taxPerResident: 1,
  },
} as const;

/** World-generation tuning. */
export const WORLDGEN = {
  /** Share of the map that is water (the lowest tiles). */
  waterShare: 0.16,
  /** Share of the map that is beach sand (the next-lowest tiles). */
  sandShare: 0.05,
  /** Lifts the middle of the map so the settlement has land to start on. */
  centreLift: 0.22,
  /** Share of the map's land with forest-level moisture. */
  forestShare: 0.22,
  /** Chance of a lone tree on grass outside forests. */
  scatteredTreeChance: 0.02,
  /** Number of noise octaves and base frequency (cycles across the map). */
  octaves: 4,
  baseFrequency: 3,
} as const;
