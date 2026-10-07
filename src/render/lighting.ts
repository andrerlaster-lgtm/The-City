/**
 * Day and night (LF-2, see docs/LOOK-AND-FEEL-IDEAS.md). Pure maths, no Pixi: turns the
 * time of day into a map tint, sky colours and how brightly windows glow.
 *
 * A game day lasts 12 s at 1× (4 s at 3×), so the cycle is deliberately gentle: nights
 * are a soft blue, never dark, and `strength` scales the whole effect down at faster
 * speeds and under reduced motion so it never flashes. Adapted from Pocket Metropolis.
 */

export interface DayLight {
  /** Multiplied into the map's colours (0xffffff = untouched). */
  tint: number;
  skyTop: number;
  skyBottom: number;
  /** 0 = windows dark, 1 = fully lit. */
  windowGlow: number;
}

/** [time of day, sky top, sky bottom]; 0 and 1 are midnight. */
const SKY: readonly (readonly [number, number, number])[] = [
  [0.0, 0x2f3463, 0x4f4a80],
  [0.2, 0x363a6b, 0x60548b],
  [0.26, 0x9ba8da, 0xffc8b5],
  [0.34, 0xa8d5ee, 0xf6ebe0],
  [0.5, 0x9fd4f0, 0xe5f5f1],
  [0.66, 0xa9d0eb, 0xf8e9dc],
  [0.74, 0x8d87ca, 0xffb8a7],
  [0.8, 0x3f4074, 0x6d5692],
  [1.0, 0x2f3463, 0x4f4a80],
];
const DAY_SKY = SKY[4]!;
/** The deepest night tint, at full strength. A soft blue: the map stays readable. */
const NIGHT = [0.74, 0.79, 0.95] as const;

/** How strong the cycle is at each speed (paused keeps the 1× look). */
export function cycleStrength(speed: 0 | 1 | 2 | 3, reducedMotion: boolean): number {
  const bySpeed = speed === 3 ? 0.45 : speed === 2 ? 0.7 : 1;
  return reducedMotion ? bySpeed * 0.5 : bySpeed;
}

/** Time of day in [0, 1) from the sim tick plus progress towards the next tick. */
export function clockOf(tick: number, progress: number, ticksPerDay: number): number {
  const hours = (tick % ticksPerDay) + Math.min(1, Math.max(0, progress));
  return (hours / ticksPerDay) % 1;
}

/** -1 at midnight, 1 at noon. */
export function sunHeight(clock: number): number {
  return Math.sin((clock - 0.25) * Math.PI * 2);
}

/** 0 at night, 1 in full daylight. */
export function daylightAt(clock: number): number {
  return smoothstep(-0.18, 0.22, sunHeight(clock));
}

export function dayLightAt(clock: number, strength: number): DayLight {
  const s = Math.min(1, Math.max(0, strength));
  const daylight = daylightAt(clock);
  const night = (1 - daylight) * s;
  // Golden hour: warmer (less blue) light when the sun is near the horizon.
  const warm = Math.exp(-(((sunHeight(clock) - 0.05) / 0.2) ** 2)) * s;
  const tint = rgb(
    lerp(1, NIGHT[0], night),
    lerp(1, NIGHT[1], night) * (1 - 0.03 * warm),
    lerp(1, NIGHT[2], night) * (1 - 0.12 * warm),
  );
  const [top, bottom] = skyAt(clock);
  // Most windows light up in the evening; past midnight many residents are asleep.
  const lateNight = smoothstep(0.02, 0.1, clock) * (1 - smoothstep(0.19, 0.25, clock));
  const glow = (1 - daylight) * (1 - 0.6 * lateNight);
  return {
    tint,
    skyTop: mixColor(DAY_SKY[1], top, s),
    skyBottom: mixColor(DAY_SKY[2], bottom, s),
    windowGlow: glow * Math.max(0.6, s),
  };
}

function skyAt(clock: number): [number, number] {
  for (let i = 0; i < SKY.length - 1; i++) {
    const a = SKY[i]!; const b = SKY[i + 1]!;
    if (clock >= a[0] && clock <= b[0]) {
      const t = smoothstep(0, 1, (clock - a[0]) / (b[0] - a[0]));
      return [mixColor(a[1], b[1], t), mixColor(a[2], b[2], t)];
    }
  }
  return [SKY[0]![1], SKY[0]![2]];
}

/** Blends two 0xRRGGBB colours; t = 0 gives `a`, 1 gives `b`. */
export function mixColor(a: number, b: number, t: number): number {
  const channel = (shift: number) => Math.round(((a >> shift) & 0xff) + ((((b >> shift) & 0xff) - ((a >> shift) & 0xff)) * t));
  return (channel(16) << 16) | (channel(8) << 8) | channel(0);
}

function rgb(r: number, g: number, b: number): number {
  const c = (v: number) => Math.max(0, Math.min(255, Math.round(v * 255)));
  return (c(r) << 16) | (c(g) << 8) | c(b);
}

function lerp(a: number, b: number, t: number): number { return a + (b - a) * t; }

function smoothstep(edge0: number, edge1: number, x: number): number {
  const t = Math.min(1, Math.max(0, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}
