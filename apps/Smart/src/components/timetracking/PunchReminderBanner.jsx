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
    try { return sessionStorage.getItem("punch_banner_dismissed_today") === new Date().toDateString(); }
    catch { return false; }
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
    try { sessionStorage.setItem("punch_banner_dismissed_today", new Date().toDateString()); } catch {}
    setDismissed(true);
    setState({ visible: false });
  };

  if (!state.visible) return null;

  const colors = {
    warning: {
      bg: "bg-gradient-to-r from-yellow-500/15 to-amber-500/10",
      border: "border-yellow-500/40",
      icon: "text-yellow-300",
      btn: "bg-yellow-500 hover:bg-yellow-400 text-black",
    },
    danger: {
      bg: "bg-gradient-to-r from-red-500/20 to-rose-500/10",
      border: "border-red-500/50",
      icon: "text-red-300",
      btn: "bg-red-500 hover:bg-red-400 text-white",
    },
    info: {
      bg: "bg-gradient-to-r from-cyan-500/15 to-blue-500/10",
      border: "border-cyan-500/40",
      icon: "text-cyan-300",
      btn: "bg-cyan-500 hover:bg-cyan-400 text-white",
    },
  }[state.severity || "warning"];

  return (
    <div className={`mx-3 sm:mx-6 mt-3 rounded-2xl border ${colors.border} ${colors.bg} backdrop-blur-xl shadow-lg`}>
      <div className="flex items-center gap-3 p-3 sm:p-4">
        <div className={`w-10 h-10 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center shrink-0 ${colors.icon}`}>
          {state.severity === "danger"
            ? <AlertTriangle className="w-5 h-5" />
            : <Clock className="w-5 h-5" />}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-white font-black text-sm uppercase tracking-tight">
            {state.mode === "in" ? "Recuerda Ponchar Entrada" : "Recuerda Ponchar Salida"}
          </p>
          <p className="text-white/70 text-xs mt-0.5 truncate">{state.message}</p>
        </div>
        <button
          onClick={handlePunch}
          disabled={busy}
          className={`px-4 h-10 rounded-xl font-black text-xs uppercase tracking-wider shrink-0 transition-all active:scale-95 disabled:opacity-50 ${colors.btn}`}
        >
          {busy ? "..." : state.mode === "in" ? "Ponchar Entrada" : "Ponchar Salida"}
        </button>
        <button
          onClick={handleDismiss}
          className="w-8 h-8 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 flex items-center justify-center text-white/40 hover:text-white shrink-0"
          title="Recordar mañana"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
