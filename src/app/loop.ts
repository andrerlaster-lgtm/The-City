import { BALANCE } from '../data/balance';

/** Accumulates real frame time into deterministic simulation-hour steps. */
export class FixedStepper {
  private accumulator = 0;

  advance(elapsedMs: number, speed: 0 | 1 | 2 | 3): number {
    if (speed === 0) {
      this.accumulator = 0;
      return 0;
    }
    const tickMs = BALANCE.time.msPerTickAt1x / speed;
    this.accumulator += Math.max(0, elapsedMs);
    const available = Math.floor(this.accumulator / tickMs);
    const ticks = Math.min(available, BALANCE.time.maxCatchUpTicks);
    if (available > BALANCE.time.maxCatchUpTicks) this.accumulator = 0;
    else this.accumulator -= ticks * tickMs;
    return ticks;
  }
}
