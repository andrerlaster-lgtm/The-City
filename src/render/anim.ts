/**
 * Tiny animation helpers for the renderer: easing curves and a tween runner that the
 * Pixi ticker drives. Pure (no Pixi), so it is unit-tested.
 */

export function easeOutCubic(t: number): number {
  return 1 - Math.pow(1 - t, 3);
}

/** Overshoots slightly past 1, then settles: a soft "pop". */
export function easeOutBack(t: number, overshoot = 1.70158): number {
  const c3 = overshoot + 1;
  return 1 + c3 * Math.pow(t - 1, 3) + overshoot * Math.pow(t - 1, 2);
}

interface Tween {
  elapsed: number;
  duration: number;
  /** Receives progress 0…1; return false to stop early (e.g. the target was destroyed). */
  update: (t: number) => boolean | void;
  done?: () => void;
}

export class Tweens {
  private items: Tween[] = [];

  add(duration: number, update: Tween['update'], done?: () => void): void {
    this.items.push({ elapsed: 0, duration: Math.max(1, duration), update, done });
    if (update(0) === false) this.items.pop();
  }

  /** Advances every tween by `deltaMS`; finished tweens get a final update(1) and `done`. */
  tick(deltaMS: number): void {
    const still: Tween[] = [];
    for (const tween of this.items) {
      tween.elapsed += deltaMS;
      const t = Math.min(1, tween.elapsed / tween.duration);
      const keep = tween.update(t) !== false;
      if (t < 1 && keep) still.push(tween);
      else tween.done?.();
    }
    this.items = still;
  }

  get size(): number { return this.items.length; }
}
