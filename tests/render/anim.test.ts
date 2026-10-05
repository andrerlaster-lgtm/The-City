import { describe, expect, it } from 'vitest';
import { easeOutBack, easeOutCubic, Tweens } from '../../src/render/anim';

describe('easing', () => {
  it('starts at 0 and ends exactly at 1', () => {
    for (const ease of [easeOutCubic, (t: number) => easeOutBack(t)]) {
      expect(ease(0)).toBeCloseTo(0, 10);
      expect(ease(1)).toBeCloseTo(1, 10);
    }
  });

  it('easeOutBack overshoots past 1 before settling (the pop)', () => {
    expect(Math.max(...Array.from({ length: 50 }, (_, i) => easeOutBack(i / 49)))).toBeGreaterThan(1);
  });
});

describe('Tweens', () => {
  it('advances by elapsed time, ends with update(1) and calls done once', () => {
    const tweens = new Tweens();
    const seen: number[] = [];
    let done = 0;
    tweens.add(100, (t) => { seen.push(t); }, () => done++);
    tweens.tick(40);
    tweens.tick(40);
    tweens.tick(40);
    tweens.tick(40);
    expect(seen).toEqual([0, 0.4, 0.8, 1]);
    expect(done).toBe(1);
    expect(tweens.size).toBe(0);
  });

  it('stops early when update returns false', () => {
    const tweens = new Tweens();
    let calls = 0;
    tweens.add(100, () => { calls++; return calls < 2; });
    tweens.tick(10);
    tweens.tick(10);
    expect(tweens.size).toBe(0);
  });
});
