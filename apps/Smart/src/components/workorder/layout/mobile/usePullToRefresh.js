import { useState, useRef, useCallback } from "react";
import { triggerHaptic } from "@/lib/capacitor";

const THRESHOLD = 80;

/**
 * Pull-to-refresh hook optimizado:
 * - usa requestAnimationFrame para throttle
 * - solo dispara setState cuando realmente esta haciendo pull (no en scroll normal)
 * - evita re-renders innecesarios
 */
export default function usePullToRefresh(onRefresh) {
  const [pullDistance, setPullDistance] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const startY = useRef(0);
  const pulling = useRef(false);
  const triggered = useRef(false);
  const rafId = useRef(null);
  const lastDist = useRef(0);

  const onTouchStart = useCallback((e) => {
    const el = e.currentTarget;
    if (el.scrollTop > 0 || isRefreshing) return;
    startY.current = e.touches[0].clientY;
    pulling.current = false; // se activa solo si se desplaza hacia abajo
    triggered.current = false;
  }, [isRefreshing]);

  const onTouchMove = useCallback((e) => {
    if (isRefreshing) return;
    const el = e.currentTarget;
    if (el.scrollTop > 0) {
      if (pulling.current) {
        pulling.current = false;
        if (lastDist.current !== 0) {
          lastDist.current = 0;
          setPullDistance(0);
        }
      }
      return;
    }
    const dy = e.touches[0].clientY - startY.current;
    if (dy <= 0) return; // solo pull hacia abajo
    pulling.current = true;
    const dist = Math.min(dy * 0.5, 120);

    // Throttle con rAF — solo actualiza state una vez por frame
    if (rafId.current) return;
    rafId.current = requestAnimationFrame(() => {
      rafId.current = null;
      if (Math.abs(dist - lastDist.current) > 1) {
        lastDist.current = dist;
        setPullDistance(dist);
      }
      if (dist >= THRESHOLD && !triggered.current) {
        triggered.current = true;
        triggerHaptic("light");
      }
    });
  }, [isRefreshing]);

  const onTouchEnd = useCallback(async () => {
    if (rafId.current) {
      cancelAnimationFrame(rafId.current);
      rafId.current = null;
    }
    if (!pulling.current) return;
    pulling.current = false;
    if (lastDist.current >= THRESHOLD && onRefresh) {
      setIsRefreshing(true);
      try {
        await onRefresh();
        triggerHaptic("success");
      } catch {}
      setIsRefreshing(false);
    }
    lastDist.current = 0;
    setPullDistance(0);
  }, [onRefresh]);

  return { pullDistance, isRefreshing, onTouchStart, onTouchMove, onTouchEnd };
}
