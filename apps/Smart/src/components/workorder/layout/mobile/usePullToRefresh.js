import { useState, useRef, useCallback } from "react";
import { triggerHaptic } from "@/lib/capacitor";

const THRESHOLD = 80;
const MIN_PULL_START = 15; // minimo px hacia abajo antes de activar pull

export default function usePullToRefresh(onRefresh) {
  const [pullDistance, setPullDistance] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const startY = useRef(0);
  const startedAtTop = useRef(false);
  const pulling = useRef(false);
  const triggered = useRef(false);
  const rafId = useRef(null);
  const lastDist = useRef(0);

  const onTouchStart = useCallback((e) => {
    if (isRefreshing) return;
    const el = e.currentTarget;
    // Solo registrar si ya estamos en el top del scroll
    startedAtTop.current = el.scrollTop <= 0;
    if (!startedAtTop.current) return;
    startY.current = e.touches[0].clientY;
    pulling.current = false;
    triggered.current = false;
  }, [isRefreshing]);

  const onTouchMove = useCallback((e) => {
    if (isRefreshing || !startedAtTop.current) return;
    const el = e.currentTarget;

    // Si el scroll ya no esta en top, cancelar pull
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
    // Solo pull hacia abajo con minimo de distancia
    if (dy < MIN_PULL_START) return;

    pulling.current = true;
    const dist = Math.min((dy - MIN_PULL_START) * 0.5, 120);

    if (rafId.current) return;
    rafId.current = requestAnimationFrame(() => {
      rafId.current = null;
      if (Math.abs(dist - lastDist.current) > 2) {
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
    startedAtTop.current = false;
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
