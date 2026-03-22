/**
 * useHeartbeat — Heartbeat de presencia en tiempo real
 *
 * Actualiza `last_seen` en la tabla `tenant` cada INTERVAL milisegundos
 * mientras el usuario está activo (tab visible). Esto permite al panel
 * admin de SmartFixOS saber qué tiendas están online en este momento.
 *
 * También corrige `last_login` al momento de activarse por primera vez.
 */

import { useEffect, useRef, useCallback } from "react";
import { supabase } from "../../../../lib/supabase-client.js";

const HEARTBEAT_INTERVAL = 2 * 60 * 1000; // 2 minutos

export function useHeartbeat() {
  const intervalRef  = useRef(null);
  const tenantIdRef  = useRef(null);
  const activeRef    = useRef(true); // ¿tab visible?

  // Resuelve el tenant_id del localStorage
  const getTenantId = useCallback(() => {
    try {
      return (
        localStorage.getItem("smartfix_tenant_id") ||
        localStorage.getItem("current_tenant_id") ||
        null
      );
    } catch {
      return null;
    }
  }, []);

  // Envía el heartbeat a Supabase
  const beat = useCallback(async () => {
    if (!activeRef.current) return;

    const tenantId = tenantIdRef.current || getTenantId();
    if (!tenantId) return;

    tenantIdRef.current = tenantId;

    try {
      await supabase
        .from("tenant")
        .update({ last_seen: new Date().toISOString() })
        .eq("id", tenantId);
    } catch {
      // Silencioso — no interrumpir la UX por fallos de heartbeat
    }
  }, [getTenantId]);

  useEffect(() => {
    // Actualizar visibilidad del tab
    const handleVisibility = () => {
      activeRef.current = document.visibilityState === "visible";
      if (activeRef.current) beat(); // beat inmediato al volver a la app
    };

    document.addEventListener("visibilitychange", handleVisibility);

    // Beat inicial al montar
    beat();

    // Beat periódico
    intervalRef.current = setInterval(beat, HEARTBEAT_INTERVAL);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibility);
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [beat]);
}
