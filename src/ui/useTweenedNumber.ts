import { useEffect, useRef, useState } from 'react';

/**
 * Counts smoothly from the previous value to `target` over `ms`, always landing on the
 * exact target. With reduced motion (or a non-finite value) it jumps instead.
 */
export function useTweenedNumber(target: number, reduced: boolean, ms = 400): number {
  const [shown, setShown] = useState(target);
  const from = useRef(target);
  useEffect(() => {
    if (reduced || !Number.isFinite(target) || from.current === target) {
      from.current = target;
      setShown(target);
      return;
    }
    const start = from.current;
    const began = performance.now();
    let frame = 0;
    const step = (now: number) => {
      const t = Math.min(1, (now - began) / ms);
      const eased = 1 - Math.pow(1 - t, 3);
      const value = t >= 1 ? target : start + (target - start) * eased;
      from.current = value;
      setShown(value);
      if (t < 1) frame = requestAnimationFrame(step);
    };
    frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
  }, [target, reduced, ms]);
  return shown;
}
