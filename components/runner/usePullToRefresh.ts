import { useEffect, useRef, useState } from "react";

const THRESHOLD = 70; // px the user must drag to trigger a refresh

/**
 * Lightweight pull-to-refresh for touch devices. Tracks a downward drag while
 * the page is scrolled to the top and fires `onRefresh` once the drag passes
 * the threshold. `onRefresh` should be memoised (useCallback) by the caller.
 *
 * Returns `pull` (current pull distance in px, for an indicator) and
 * `refreshing` (whether a refresh is in flight).
 */
export function usePullToRefresh(
  onRefresh: () => Promise<void> | void,
  enabled = true,
) {
  const [pull, setPull] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const startY = useRef<number | null>(null);
  const pullRef = useRef(0);
  const refreshingRef = useRef(false);

  useEffect(() => {
    if (!enabled) return;

    const setPullValue = (v: number) => {
      pullRef.current = v;
      setPull(v);
    };

    function onTouchStart(e: TouchEvent) {
      startY.current = window.scrollY <= 0 ? e.touches[0].clientY : null;
    }

    function onTouchMove(e: TouchEvent) {
      if (startY.current === null || refreshingRef.current) return;
      const delta = e.touches[0].clientY - startY.current;
      if (delta > 0 && window.scrollY <= 0) {
        // Dampen the drag so it feels rubber-bandy and caps out.
        setPullValue(Math.min(delta * 0.5, 90));
      }
    }

    async function onTouchEnd() {
      if (startY.current === null) return;
      startY.current = null;

      if (pullRef.current >= THRESHOLD && !refreshingRef.current) {
        refreshingRef.current = true;
        setRefreshing(true);
        setPullValue(THRESHOLD);
        try {
          await onRefresh();
        } finally {
          refreshingRef.current = false;
          setRefreshing(false);
          setPullValue(0);
        }
      } else {
        setPullValue(0);
      }
    }

    window.addEventListener("touchstart", onTouchStart, { passive: true });
    window.addEventListener("touchmove", onTouchMove, { passive: true });
    window.addEventListener("touchend", onTouchEnd);
    return () => {
      window.removeEventListener("touchstart", onTouchStart);
      window.removeEventListener("touchmove", onTouchMove);
      window.removeEventListener("touchend", onTouchEnd);
    };
  }, [enabled, onRefresh]);

  return { pull, refreshing };
}
