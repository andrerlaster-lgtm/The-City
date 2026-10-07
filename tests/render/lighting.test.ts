import { describe, expect, it } from 'vitest';
import { clockOf, cycleStrength, dayLightAt, mixColor } from '../../src/render/lighting';

const channels = (c: number) => [(c >> 16) & 0xff, (c >> 8) & 0xff, c & 0xff];

describe('day and night lighting', () => {
  it('leaves the map untouched at noon', () => {
    expect(dayLightAt(0.5, 1).tint).toBe(0xffffff);
    expect(dayLightAt(0.5, 1).windowGlow).toBe(0);
  });

  it('keeps nights soft: a light blue tint, never dark', () => {
    const [r, g, b] = channels(dayLightAt(0, 1).tint);
    expect(Math.min(r!, g!, b!)).toBeGreaterThan(170);
    expect(b!).toBeGreaterThan(r!);
  });

  it('turns the effect off at strength 0, whatever the hour', () => {
    for (const clock of [0, 0.25, 0.75, 0.9]) {
      expect(dayLightAt(clock, 0).tint).toBe(0xffffff);
      expect(dayLightAt(clock, 0).skyTop).toBe(dayLightAt(0.5, 1).skyTop);
    }
  });

  it('lights windows in the evening, fewer after midnight', () => {
    const evening = dayLightAt(21 / 24, 1).windowGlow;
    expect(evening).toBeGreaterThan(0.8);
    expect(dayLightAt(3 / 24, 1).windowGlow).toBeLessThan(evening);
  });

  it('changes smoothly: no jumps between nearby times', () => {
    for (let i = 0; i < 240; i++) {
      const a = channels(dayLightAt(i / 240, 1).skyBottom);
      const b = channels(dayLightAt((i + 1) / 240, 1).skyBottom);
      for (let c = 0; c < 3; c++) expect(Math.abs(a[c]! - b[c]!)).toBeLessThan(24);
    }
  });

  it('is gentler at faster speeds and with reduced motion', () => {
    expect(cycleStrength(1, false)).toBe(1);
    expect(cycleStrength(3, false)).toBeLessThan(cycleStrength(2, false));
    expect(cycleStrength(1, true)).toBeLessThan(1);
    const [r1] = channels(dayLightAt(0, cycleStrength(1, false)).tint);
    const [r3] = channels(dayLightAt(0, cycleStrength(3, false)).tint);
    expect(r3!).toBeGreaterThan(r1!);
  });

  it('turns the sim tick and tick progress into a time of day', () => {
    expect(clockOf(0, 0, 24)).toBe(0);
    expect(clockOf(12, 0, 24)).toBe(0.5);
    expect(clockOf(36, 0.5, 24)).toBeCloseTo(12.5 / 24);
    expect(clockOf(23, 1, 24)).toBe(0);
  });

  it('mixes colours channel by channel', () => {
    expect(mixColor(0x000000, 0xffffff, 0.5)).toBe(0x808080);
    expect(mixColor(0x102030, 0x405060, 0)).toBe(0x102030);
  });
});
