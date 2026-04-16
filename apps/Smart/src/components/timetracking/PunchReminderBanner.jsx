// PunchReminderBanner — recordatorio persistente al empleado para ponchar
// según su horario configurado en EmployeeSchedulesManager.
//
// Lógica:
// - Lee el employee_id del session/localStorage
// - Lee horarios desde AppSettings(slug=employee-schedules).payload[empId]
// - Verifica si hoy hay turno y si no ha ponchado entrada
// - Muestra banner amarillo (recordatorio normal) o rojo (>15 min de retraso)
// - Botón directo para ponchar entrada/salida
import React, { useEffect, useState, useCallback } from "react";
import { dataClient } from "@/components/api/dataClient";
import { Clock, AlertTriangle, X } from "lucide-react";
import { toast } from "sonner";
import { useVisibleInterval } from "@/hooks/useVisibleInterval";

const DAY_KEYS = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];

function readSession() {
  try {
    const raw =
      localStorage.getItem("employee_session") ||
      sessionStorage.getItem("911-session");
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

function nowHHMM() {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

function minsBetween(hhmmA, hhmmB) {
  const [ha, ma] = hhmmA.split(":").map(Number);
  const [hb, mb] = hhmmB.split(":").map(Number);
  return (ha * 60 + ma) - (hb * 60 + mb);
}

export default function PunchReminderBanner() {
  const [state, setState] = useState({ visible: false });
  const [dismissed, setDismissed] = useState(() => {
    try {
      const today = new Date().toDateString();
      return (
        sessionStorage.getItem("punch_banner_dismissed_today") === today ||
        localStorage.getItem("punch_banner_dismissed_today") === today
      );
    } catch { return false; }
  });
  const [busy, setBusy] = useState(false);

  const evaluate = useCallback(async () => {
    if (dismissed) { setState({ visible: false }); return; }

    const session = readSession();
    const employeeId = session?.employee_id || session?.userId || session?.id || session?.user?.id;
    const employeeName = session?.full_name || session?.userName || session?.name || session?.user?.full_name || "Empleado";
    if (!employeeId) { setState({ visible: false }); return; }

    // Optimistic hide: si hay timeEntryId, asumimos que esta ponchado → oculto de inmediato
    // y luego validamos contra la red sin bloquear la UI.
    const cachedId = sessionStorage.getItem("timeEntryId");
    if (cachedId) {
      setState({ visible: false });
    }

    // Quick check: si PunchButton acaba de ponchar, dejo timeEntryId en sessionStorage.
    // Si existe, asumimos que esta ponchado y evitamos un evento de carrera con la query.
    try {
      if (cachedId) {
        const entry = await dataClient.entities.TimeEntry.get(cachedId).catch(() => null);
        if (entry && !entry.clock_out) {
          // Esta ponchado — solo evaluar caso 2 (recordatorio de salida)
          const today = await (async () => {
            const settings = await dataClient.entities.AppSettings.filter({ slug: "employee-schedules" }).catch(() => []);
            const week = settings?.[0]?.payload?.[employeeId];
            return week?.[DAY_KEYS[new Date().getDay()]] || null;
          })();
          if (today && !today.off && today.end) {
            const minsToEnd = minsBetween(today.end, nowHHMM());
            if (minsToEnd <= 0 && minsToEnd > -30) {
              setState({
                visible: true,
                severity: "info",
                mode: "out",
                shift: today,
                employeeId,
                employeeName,
                openEntryId: entry.id,
                message: `Tu turno terminó a las ${today.end}. ¿Ponchar salida?`,
              });
            } else {
              setState({ visible: false });
            }
          } else {
            setState({ visible: false });
          }
          return;
        }
      }
    } catch {}

    try {
      // Cargar horarios
      const settings = await dataClient.entities.AppSettings.filter({ slug: "employee-schedules" }).catch(() => []);
      const schedules = settings?.[0]?.payload || {};
      const week = schedules[employeeId];
      if (!week) { setState({ visible: false }); return; }

      const today = week[DAY_KEYS[new Date().getDay()]];
      if (!today || today.off || !today.start || !today.end) {
        setState({ visible: false });
        return;
      }

      const now = nowHHMM();
      // Sólo mostramos entre 30min antes del turno y la hora de salida
      const minsToStart = minsBetween(today.start, now); // positivo = falta para empezar
      const minsAfterStart = -minsToStart; // positivo = ya empezó
      const minsToEnd = minsBetween(today.end, now);

      // Fuera del rango útil: 30min antes hasta hora de salida + 30min
      if (minsToStart > 30 || minsToEnd < -30) {
        setState({ visible: false });
        return;
      }

      // Estado de ponche actual
      let openEntries = [];
      try {
        openEntries = await dataClient.entities.TimeEntry.filter({
          employee_id: employeeId,
          clock_out: null,
        });
      } catch { openEntries = []; }

      const isPunchedIn = Array.isArray(openEntries) && openEntries.length > 0;

      // Caso 1: en turno y no ha ponchado entrada → recordatorio
      if (!isPunchedIn && minsAfterStart >= -30) {
        const isLate = minsAfterStart > 15;
        setState({
          visible: true,
          severity: isLate ? "danger" : "warning",
          mode: "in",
          shift: today,
          employeeId,
          employeeName,
          message: isLate
            ? `Llevas ${minsAfterStart} min de retraso. Ponchar entrada ahora.`
            : minsAfterStart >= 0
              ? `Tu turno comenzó a las ${today.start}. Ponchar entrada.`
              : `Tu turno comienza a las ${today.start}. Ponchar entrada.`,
        });
        return;
      }

      // Caso 2: ya ponchó pero hora de salida pasada → recordatorio
      if (isPunchedIn && minsToEnd <= 0) {
        setState({
          visible: true,
          severity: "info",
          mode: "out",
          shift: today,
          employeeId,
          employeeName,
          openEntryId: openEntries[0]?.id,
          message: `Tu turno terminó a las ${today.end}. ¿Ponchar salida?`,
        });
        return;
      }

      setState({ visible: false });
    } catch (err) {
      console.error("[PunchReminderBanner] eval error:", err);
      setState({ visible: false });
    }
  }, [dismissed]);

  useEffect(() => {
    evaluate();
    const onUpdate = () => {
      // Ocultar inmediatamente en entrada — el evento llega al instante del ponche
      if (sessionStorage.getItem("timeEntryId")) {
        setState({ visible: false });
      }
      evaluate();
    };
    window.addEventListener("employee-schedules-updated", onUpdate);
    window.addEventListener("punch-status-changed", onUpdate);
    return () => {
      window.removeEventListener("employee-schedules-updated", onUpdate);
      window.removeEventListener("punch-status-changed", onUpdate);
    };
  }, [evaluate]);

  // Pausa cuando la pestaña está oculta — ahorra batería
  useVisibleInterval(evaluate, 60_000, [evaluate]);

  const handlePunch = async () => {
    if (busy) return;
    setBusy(true);
    try {
      if (state.mode === "in") {
        await dataClient.entities.TimeEntry.create({
          employee_id: state.employeeId,
          employee_name: state.employeeName,
          clock_in: new Date().toISOString(),
          clock_out: null,
        });
        toast.success(`✅ Entrada ponchada — ${nowHHMM()}`);
      } else if (state.mode === "out" && state.openEntryId) {
        await dataClient.entities.TimeEntry.update(state.openEntryId, {
          clock_out: new Date().toISOString(),
        });
        toast.success(`✅ Salida ponchada — ${nowHHMM()}`);
      }
      window.dispatchEvent(new Event("punch-status-changed"));
      setState({ visible: false });
    } catch (err) {
      console.error("[PunchReminderBanner] punch error:", err);
      toast.error("No se pudo ponchar: " + (err?.message || "error"));
    } finally {
      setBusy(false);
    }
  };

  const handleDismiss = () => {
    try {
      sessionStorage.setItem("punch_banner_dismissed_today", new Date().toDateString());
      // Persistir por el dia completo en localStorage
      localStorage.setItem("punch_banner_dismissed_today", new Date().toDateString());
    } catch {}
    setDismissed(true);
    setState({ visible: false });
  };

  if (!state.visible) return null;

  // Colores semánticos Apple: warning=orange, danger=red, info=blue
  const colors = {
    warning: { iconBg: "bg-apple-orange/15", iconText: "text-apple-orange", btnClass: "apple-btn-primary", btnColor: "bg-apple-orange hover:bg-apple-orange/90" },
    danger:  { iconBg: "bg-apple-red/15",    iconText: "text-apple-red",    btnClass: "apple-btn-destructive", btnColor: "" },
    info:    { iconBg: "bg-apple-blue/15",   iconText: "text-apple-blue",   btnClass: "apple-btn-primary", btnColor: "" },
  }[state.severity || "warning"];

  return (
    <div className="apple-type mx-3 sm:mx-6 mt-3 apple-card apple-surface-elevated px-3.5 py-3 flex items-center gap-3 animate-apple-slide-up">
      <div className={`w-10 h-10 rounded-apple-sm flex items-center justify-center shrink-0 ${colors.iconBg} ${colors.iconText}`}>
        {state.severity === "danger"
          ? <AlertTriangle className="w-[18px] h-[18px]" />
          : <Clock className="w-[18px] h-[18px]" />}
      </div>
      <div className="flex-1 min-w-0">
        <p className="apple-text-subheadline font-semibold apple-label-primary leading-tight">
          {state.mode === "in" ? "Recuerda ponchar entrada" : "Recuerda ponchar salida"}
        </p>
        <p className="apple-text-caption1 apple-label-secondary leading-snug truncate mt-0.5">{state.message}</p>
      </div>
      <button
        onClick={handlePunch}
        disabled={busy}
        className={`apple-btn ${colors.btnClass} ${colors.btnColor} text-[13px] min-h-9 px-3 shrink-0`}
      >
        {busy ? "…" : state.mode === "in" ? "Entrada" : "Salida"}
      </button>
      <button
        onClick={handleDismiss}
        className="apple-press w-8 h-8 rounded-full bg-gray-sys6 dark:bg-gray-sys5 apple-label-tertiary flex items-center justify-center shrink-0"
        title="Recordar mañana"
        aria-label="Cerrar"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );
}
