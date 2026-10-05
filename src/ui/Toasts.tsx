import type { ToastStore } from '../app/toasts';
import { useStore } from './useStore';

/** The game's single toast stack; errors are announced assertively, the rest politely. */
export function Toasts({ toasts }: { toasts: ToastStore }) {
  const items = useStore(toasts.items);
  return <div className="toasts" aria-live="polite">
    {items.map((toast) => (
      <div key={toast.id} className={`toast toast--${toast.kind}`} role={toast.kind === 'error' ? 'alert' : 'status'}>
        <span>{toast.text}</span>
        <button type="button" aria-label="Dismiss" onClick={() => toasts.dismiss(toast.id)}>×</button>
      </div>
    ))}
  </div>;
}
