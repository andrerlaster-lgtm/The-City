import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ERROR_TOAST_MS, MAX_TOASTS, MERGE_MS, TOAST_MS, ToastStore } from '../../src/app/toasts';

describe('ToastStore', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('closes info toasts after TOAST_MS and errors after ERROR_TOAST_MS', () => {
    const toasts = new ToastStore(() => Date.now());
    toasts.push('success', 'Saved');
    toasts.push('error', 'Not enough money.');
    vi.advanceTimersByTime(TOAST_MS);
    expect(toasts.items.get().map((t) => t.text)).toEqual(['Not enough money.']);
    vi.advanceTimersByTime(ERROR_TOAST_MS - TOAST_MS);
    expect(toasts.items.get()).toEqual([]);
  });

  it(`keeps at most ${MAX_TOASTS}, dropping the oldest`, () => {
    const toasts = new ToastStore(() => Date.now());
    for (const text of ['a', 'b', 'c', 'd']) toasts.push('info', text);
    expect(toasts.items.get().map((t) => t.text)).toEqual(['b', 'c', 'd']);
  });

  it('merges a repeat within MERGE_MS instead of stacking, and refreshes its timer', () => {
    const toasts = new ToastStore(() => Date.now());
    const first = toasts.push('error', 'Needs road access');
    vi.advanceTimersByTime(MERGE_MS - 1);
    expect(toasts.push('error', 'Needs road access')).toBe(first);
    expect(toasts.items.get()).toHaveLength(1);
    vi.advanceTimersByTime(ERROR_TOAST_MS - 1);
    expect(toasts.items.get()).toHaveLength(1);
    vi.advanceTimersByTime(1);
    expect(toasts.items.get()).toEqual([]);
  });

  it('dismisses on request', () => {
    const toasts = new ToastStore(() => Date.now());
    const id = toasts.push('warning', 'Funds empty — immigration paused');
    toasts.dismiss(id);
    expect(toasts.items.get()).toEqual([]);
  });
});
