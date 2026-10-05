/**
 * One toast queue for the whole game: save/load results, failed actions and debt
 * warnings. At most three show at once; each closes on its own; repeats are merged.
 */
import { Store } from './store';

export type ToastKind = 'info' | 'success' | 'warning' | 'error';
export interface Toast { id: number; kind: ToastKind; text: string }

export const MAX_TOASTS = 3;
export const TOAST_MS = 4000;
export const ERROR_TOAST_MS = 6000;
/** The same message again within this window refreshes the existing toast instead of stacking. */
export const MERGE_MS = 1000;

export class ToastStore {
  readonly items = new Store<Toast[]>([]);
  private nextId = 1;
  private timers = new Map<number, ReturnType<typeof setTimeout>>();
  private lastShown = new Map<string, number>();

  constructor(private readonly now: () => number = () => Date.now()) {}

  push(kind: ToastKind, text: string): number {
    const key = `${kind}:${text}`;
    const existing = this.items.get().find((toast) => toast.kind === kind && toast.text === text);
    const last = this.lastShown.get(key);
    this.lastShown.set(key, this.now());
    if (existing && last !== undefined && this.now() - last < MERGE_MS) {
      this.schedule(existing);
      return existing.id;
    }
    const toast: Toast = { id: this.nextId++, kind, text };
    const list = [...this.items.get(), toast];
    while (list.length > MAX_TOASTS) this.clearTimer(list.shift()!.id);
    this.items.set(list);
    this.schedule(toast);
    return toast.id;
  }

  dismiss(id: number): void {
    this.clearTimer(id);
    const list = this.items.get();
    if (list.some((toast) => toast.id === id)) this.items.set(list.filter((toast) => toast.id !== id));
  }

  private schedule(toast: Toast): void {
    this.clearTimer(toast.id);
    this.timers.set(toast.id, setTimeout(() => this.dismiss(toast.id), toast.kind === 'error' ? ERROR_TOAST_MS : TOAST_MS));
  }

  private clearTimer(id: number): void {
    const timer = this.timers.get(id);
    if (timer !== undefined) clearTimeout(timer);
    this.timers.delete(id);
  }
}
