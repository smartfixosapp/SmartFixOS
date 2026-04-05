import { useState, useRef, useCallback } from "react";
import { triggerHaptic } from "@/lib/capacitor";

const THRESHOLD = 80;

export default function usePullToRefresh(onRefresh) {
  const [pullDistance, setPullDistance] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const startY = useRef(0);
  const pulling = useRef(false);
  const triggered = useRef(false);

  const onTouchStart = useCallback((e) => {
    const el = e.currentTarget;
    if (el.scrollTop > 0 || isRefreshing) return;
    startY.current = e.touches[0].clientY;
    pulling.current = true;
    triggered.current = false;
  }, [isRefreshing]);

  const onTouchMove = useCallback((e) => {
    if (!pulling.current || isRefreshing) return;
    const el = e.currentTarget;
    if (el.scrollTop > 0) {
      pulling.current = false;
      setPullDistance(0);
      return;
    }
    const dy = Math.max(0, e.touches[0].clientY - startY.current);
    const dist = Math.min(dy * 0.5, 120);
    setPullDistance(dist);
    if (dist >= THRESHOLD && !triggered.current) {
      triggered.current = true;
      triggerHaptic("light");
    }
  }, [isRefreshing]);

  const onTouchEnd = useCallback(async () => {
    if (!pulling.current) return;
    pulling.current = false;
    if (pullDistance >= THRESHOLD && onRefresh) {
      setIsRefreshing(true);
      try {
        await onRefresh();
        triggerHaptic("success");
      } catch {}
      setIsRefreshing(false);
    }
    setPullDistance(0);
  }, [pullDistance, onRefresh]);

  return { pullDistance, isRefreshing, onTouchStart, onTouchMove, onTouchEnd };
}
