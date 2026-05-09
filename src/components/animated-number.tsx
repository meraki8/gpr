"use client";

import { useEffect, useRef, useState } from "react";

// Counts from 0 to `value` over `durationMs` on mount. Uses
// requestAnimationFrame for smooth easing so big numbers feel
// satisfying without flicker on small ones. Re-runs if `value` or
// `runKey` changes — pass runKey when you want to force a fresh
// count-up from 0 (e.g. tab switch).
export function AnimatedNumber({
  value,
  durationMs = 700,
  runKey,
  format = (n) => n.toLocaleString(),
}: {
  value: number;
  durationMs?: number;
  runKey?: string | number;
  format?: (n: number) => string;
}) {
  const [display, setDisplay] = useState<number>(0);
  const target = Number.isFinite(value) ? value : 0;
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    const start = performance.now();
    const from = 0;
    const to = target;

    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / durationMs);
      // ease-out cubic — fast at first, settles smoothly.
      const eased = 1 - Math.pow(1 - t, 3);
      const current = Math.round(from + (to - from) * eased);
      setDisplay(current);
      if (t < 1) {
        rafRef.current = requestAnimationFrame(tick);
      }
    };

    rafRef.current = requestAnimationFrame(tick);

    return () => {
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
    };
  }, [target, durationMs, runKey]);

  return <>{format(display)}</>;
}
