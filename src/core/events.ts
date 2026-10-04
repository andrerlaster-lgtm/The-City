/**
 * Minimal typed event bus. Each system declares its events in an event map
 * type; handlers are checked against it at compile time.
 */
export type EventMap = Record<string, unknown>;
type Handler<T> = (payload: T) => void;

export class EventBus<E extends EventMap> {
  private handlers: { [K in keyof E]?: Set<Handler<E[K]>> } = {};

  on<K extends keyof E>(type: K, handler: Handler<E[K]>): () => void {
    let set = this.handlers[type];
    if (!set) {
      set = new Set();
      this.handlers[type] = set;
    }
    set.add(handler);
    return () => this.off(type, handler);
  }

  off<K extends keyof E>(type: K, handler: Handler<E[K]>): void {
    this.handlers[type]?.delete(handler);
  }

  emit<K extends keyof E>(type: K, payload: E[K]): void {
    const set = this.handlers[type];
    if (!set) return;
    for (const handler of [...set]) handler(payload);
  }

  clear(): void {
    this.handlers = {};
  }
}
