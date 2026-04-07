// usePunchReminders.js — Toast in-app cuando se acerca o pasa la hora de
// entrada/salida del empleado actual, basado en employee-schedules.
// Montado una sola vez en Layout.jsx.
import { useEffect, useRef } from "react";
import { toast } from "sonner";
import { dataClient } from "@/components/api/dataClient";

const DAY_KEYS = [
  "sunday",
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
];

const TICK_MS = 60_000; // 1 min

function readSession() {
  try {
    const raw =
      sessionStorage.getItem("911-session") ||
      localStorage.getItem("employee_session");
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function todayKey() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate()
  ).padStart(2, "0")}`;
}

function alreadyShown(empId, slot) {
  const key = `punch_reminder:${empId}:${todayKey()}:${slot}`;
  return localStorage.getItem(key) === "1";
}

function markShown(empId, slot) {
  const key = `punch_reminder:${empId}:${todayKey()}:${slot}`;
  try {
    localStorage.setItem(key, "1");
  } catch {}
}

function parseHHMM(str) {
  if (!str || typeof str !== "string") return null;
  const [h, m] = str.split(":").map((n) => parseInt(n, 10));
  if (Number.isNaN(h) || Number.isNaN(m)) return null;
  return h * 60 + m;
}

function nowMinutes() {
  const d = new Date();
  return d.getHours() * 60 + d.getMinutes();
}

export function usePunchReminders() {
  const schedulesRef = useRef(null);
  const lastLoadRef = useRef(0);

  useEffect(() => {
    let cancelled = false;
    let timer = null;

    const loadSchedules = async () => {
      try {
        const rows = await dataClient.entities.AppSettings.filter({
          slug: "employee-schedules",
        });
        if (!cancelled) {
          schedulesRef.current = rows?.[0]?.payload || {};
          lastLoadRef.current = Date.now();
        }
      } catch (err) {
        if (!cancelled) schedulesRef.current = {};
      }
    };

    const tick = async () => {
      const session = readSession();
      const empId =
        session?.employee_id ||
        session?.id ||
        session?.userId ||
        session?.user?.id ||
        null;
      if (!empId) return;

      // Recargar horarios cada 5 min para reflejar cambios del admin
      if (
        !schedulesRef.current ||
        Date.now() - lastLoadRef.current > 5 * 60_000
      ) {
        await loadSchedules();
      }
      const all = schedulesRef.current || {};
      const week = all[empId];
      if (!week) return;

      const dayKey = DAY_KEYS[new Date().getDay()];
      const day = week[dayKey];
      if (!day || day.off) return;

      const startMin = parseHHMM(day.start);
      const endMin = parseHHMM(day.end);
      const now = nowMinutes();

      // Aviso previo entrada (10 min antes)
      if (startMin != null) {
        const diffStart = startMin - now;
        if (diffStart >= 0 && diffStart <= 10 && !alreadyShown(empId, "in")) {
          markShown(empId, "in");
          toast.info(
            `⏰ Tu turno empieza a las ${day.start} — recuerda ponchar entrada`,
            { duration: 8000 }
          );
        }
        // Tarde (5+ min después de la hora) — solo una vez
        if (now - startMin >= 5 && now - startMin <= 120 && !alreadyShown(empId, "late_in")) {
          markShown(empId, "late_in");
          toast.warning(
            `⚠️ Llegaste tarde — no olvides ponchar entrada (${day.start})`,
            { duration: 10000 }
          );
        }
      }

      // Aviso previo salida (10 min antes)
      if (endMin != null) {
        const diffEnd = endMin - now;
        if (diffEnd >= 0 && diffEnd <= 10 && !alreadyShown(empId, "out")) {
          markShown(empId, "out");
          toast.info(
            `⏰ Tu turno termina a las ${day.end} — recuerda ponchar salida`,
            { duration: 8000 }
          );
        }
        // Después de la hora de salida
        if (now - endMin >= 5 && now - endMin <= 120 && !alreadyShown(empId, "late_out")) {
          markShown(empId, "late_out");
          toast.warning(
            `⚠️ Tu turno ya terminó (${day.end}) — recuerda ponchar salida`,
            { duration: 10000 }
          );
        }
      }
    };

    // Recargar cuando admin guarde cambios
    const onSchedulesUpdated = () => {
      schedulesRef.current = null;
      lastLoadRef.current = 0;
    };
    window.addEventListener("employee-schedules-updated", onSchedulesUpdated);

    // Primer tick rápido + intervalo
    tick();
    timer = setInterval(tick, TICK_MS);

    return () => {
      cancelled = true;
      if (timer) clearInterval(timer);
      window.removeEventListener("employee-schedules-updated", onSchedulesUpdated);
    };
  }, []);
}

export default usePunchReminders;
