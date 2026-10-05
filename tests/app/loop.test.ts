import { describe, expect, it } from 'vitest';
import { FixedStepper } from '../../src/app/loop';

describe('FixedStepper', () => {
  it('converts elapsed time to ticks at each speed', () => {
    for (const [speed, expected] of [[1, 2], [2, 4], [3, 6]] as const) {
      expect(new FixedStepper().advance(1000, speed)).toBe(expected);
    }
  });

  it('carries partial ticks, clears them while paused, and preserves them when speed changes', () => {
    const stepper = new FixedStepper();
    expect(stepper.advance(250, 1)).toBe(0);
    expect(stepper.advance(250, 1)).toBe(1);
    expect(stepper.advance(250, 1)).toBe(0);
    expect(stepper.advance(0, 0)).toBe(0);
    expect(stepper.advance(250, 1)).toBe(0);
    expect(stepper.advance(250, 2)).toBe(2);
  });

  it('caps long frames and discards excess time', () => {
    const stepper = new FixedStepper();
    expect(stepper.advance(60_000, 1)).toBe(8);
    expect(stepper.advance(0, 1)).toBe(0);
  });

  it('gives the same tick count however the elapsed time is split into frames', () => {
    for (const speed of [1, 2, 3] as const) {
      const whole = new FixedStepper().advance(1000, speed);
      for (const [frames, ms] of [[10, 100], [20, 50], [8, 125]] as const) {
        const chunked = new FixedStepper();
        let total = 0;
        for (let i = 0; i < frames; i++) total += chunked.advance(ms, speed);
        expect(total).toBe(whole);
      }
      // 60 fps frames don't sum exactly in floating point; any tick left over runs on the next frame.
      const sixty = new FixedStepper();
      let total = 0;
      for (let i = 0; i < 61; i++) total += sixty.advance(1000 / 60, speed);
      expect(total).toBe(whole);
    }
  });
});
