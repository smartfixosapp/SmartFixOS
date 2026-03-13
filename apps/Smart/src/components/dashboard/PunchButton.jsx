import React, { useState, useEffect } from "react";
import appClient from "@/api/appClient";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Clock, LogIn, LogOut } from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

const LOCAL_TIME_ENTRIES_KEY = "local_time_entries";

// ── Punch notification (fire-and-forget — never blocks the UI) ────────────────
function sendPunchNotification({ punch_type, employee_name, employee_role, timestamp, clock_in_time }) {
  try {
    let tenant_id = null;
    const raw = localStorage.getItem("employee_session") || sessionStorage.getItem("911-session");
    if (raw) {
      const s = JSON.parse(raw);
      tenant_id = s?.tenant_id || s?.user?.tenant_id || null;
    }
    if (!tenant_id) return; // no tenant context — skip silently
    fetch('/api/send-punch-notification', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tenant_id, punch_type, employee_name, employee_role, timestamp, clock_in_time }),
    }).catch(() => {}); // ignore errors — notification is best-effort
  } catch {
    // ignore
  }
}

const readLocalEntries = () => {
  try {
    const raw = localStorage.getItem(LOCAL_TIME_ENTRIES_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

const writeLocalEntries = (entries) => {
  try {
    localStorage.setItem(LOCAL_TIME_ENTRIES_KEY, JSON.stringify(entries));
  } catch {
    // ignore local persistence errors
  }
};

const findLocalOpenEntry = (employeeId) =>
readLocalEntries().find((entry) => entry?.employee_id === employeeId && !entry?.clock_out) || null;

const createLocalEntry = (data) => {
  const entries = readLocalEntries();
  const localEntry = { id: `local-time-${Date.now()}`, ...data };
  entries.unshift(localEntry);
  writeLocalEntries(entries);
  return localEntry;
};

const closeLocalEntry = (entryId) => {
  const entries = readLocalEntries();
  const updated = entries.map((entry) =>
  entry?.id === entryId ? { ...entry, clock_out: new Date().toISOString() } : entry
  );
  writeLocalEntries(updated);
  return updated.find((entry) => entry?.id === entryId) || null;
};

const normalizeTimeEntry = (payload) => {
  if (!payload) return null;
  if (payload.id || payload.employee_id || payload.clock_in) return payload;
  if (payload.data && (payload.data.id || payload.data.employee_id || payload.data.clock_in)) return payload.data;
  if (Array.isArray(payload.items) && payload.items[0]) return payload.items[0];
  if (Array.isArray(payload.data) && payload.data[0]) return payload.data[0];
  return null;
};

const normalizeTimeEntryList = (payload) => {
  if (Array.isArray(payload)) return payload.map(normalizeTimeEntry).filter(Boolean);
  const single = normalizeTimeEntry(payload);
  return single ? [single] : [];
};

// ── Helpers for local time picker ─────────────────────────────────────────────
function getLocalTimeHHMM() {
  const now = new Date();
  return `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
}

function timeHHMMtoISO(timeStr) {
  if (!timeStr) return new Date().toISOString();
  const [hh, mm] = timeStr.split(':').map(Number);
  const d = new Date();
  d.setHours(hh, mm, 0, 0);
  return d.toISOString();
}

export default function PunchButton({ userId, userName, onPunchStatusChange }) {
  const [punchStatus, setPunchStatus] = useState(null);
  const [loading, setLoading] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [pendingTime, setPendingTime] = useState("");

  const resolveIdentity = async () => {
    const directId = String(userId || "").trim();
    const directName = String(userName || "").trim();
    if (directId) return { id: directId, name: directName || "Empleado", role: "" };

    try {
      const raw = localStorage.getItem("employee_session");
      const parsed = raw ? JSON.parse(raw) : null;
      const sid = String(parsed?.userId || parsed?.id || "").trim();
      const sname = String(parsed?.userName || parsed?.full_name || parsed?.email || "").trim();
      const srole = String(parsed?.userRole || parsed?.role || "").trim();
      if (sid) return { id: sid, name: sname || "Empleado", role: srole };
    } catch {
      // ignore
    }

    try {
      const me = await appClient.auth.me();
      const aid = String(me?.id || "").trim();
      const aname = String(me?.full_name || me?.email || "").trim();
      const arole = String(me?.role || "").trim();
      if (aid) return { id: aid, name: aname || "Empleado", role: arole };
    } catch {
      // ignore
    }

    return { id: "", name: directName || "Empleado", role: "" };
  };

  useEffect(() => {
    checkPunchStatus();
  }, [userId, userName]);

  const checkPunchStatus = async () => {
    try {
      const identity = await resolveIdentity();
      if (!identity.id) {
        setPunchStatus(null);
        return;
      }

      const timeEntryId = sessionStorage.getItem("timeEntryId");
      if (timeEntryId) {
        const rawEntry = timeEntryId.startsWith("local-time-") ?
        findLocalOpenEntry(identity.id) :
        await appClient.entities.TimeEntry.get(timeEntryId).catch(() => null);
        const entry = normalizeTimeEntry(rawEntry);
        if (entry && !entry.clock_out) {
          setPunchStatus(entry);
          return;
        }
      }

      let openEntries = [];
      try {
        const payload = await appClient.entities.TimeEntry.filter({
          employee_id: identity.id,
          clock_out: null
        });
        openEntries = normalizeTimeEntryList(payload);
      } catch {
        const localOpen = findLocalOpenEntry(identity.id);
        openEntries = localOpen ? [localOpen] : [];
      }

      if (openEntries?.length > 0) {
        setPunchStatus(openEntries[0]);
        sessionStorage.setItem("timeEntryId", openEntries[0].id);
      } else {
        setPunchStatus(null);
      }
    } catch (error) {
      console.error("Error checking punch status:", error);
      setPunchStatus(null);
    }
  };

  const handlePunchClick = () => {
    setPendingTime(getLocalTimeHHMM());
    setConfirmOpen(true);
  };

  const handlePunchToggle = async (customTimeISO) => {
    setLoading(true);
    try {
      const identity = await resolveIdentity();
      if (!identity.id) {
        toast.error("No se pudo identificar el usuario para registrar el ponche.");
        return;
      }

      if (punchStatus) {
        // Clock out
        const clockOutTime = customTimeISO || new Date().toISOString();
        if (String(punchStatus.id || "").startsWith("local-time-")) {
          closeLocalEntry(punchStatus.id);
        } else {
          await appClient.entities.TimeEntry.update(punchStatus.id, {
            clock_out: clockOutTime
          });
        }
        sessionStorage.removeItem("timeEntryId");
        setPunchStatus(null);
        onPunchStatusChange?.(null);
        // Notify owner — fire-and-forget
        sendPunchNotification({
          punch_type: 'out',
          employee_name: identity.name,
          employee_role: identity.role,
          timestamp: clockOutTime,
          clock_in_time: punchStatus.clock_in || null,
        });
      } else {
        // Clock in
        const clockInTime = customTimeISO || new Date().toISOString();
        const payload = {
          employee_id: identity.id,
          employee_name: identity.name,
          clock_in: clockInTime
        };
        let newEntry;
        try {
          const createdPayload = await appClient.entities.TimeEntry.create(payload);
          newEntry = normalizeTimeEntry(createdPayload);
          if (!newEntry?.id) throw new Error("TIMEENTRY_CREATE_INVALID_RESPONSE");
        } catch (error) {
          console.warn("Punch create fallback local:", error);
          newEntry = createLocalEntry(payload);
          toast.info("Ponche guardado localmente");
        }
        sessionStorage.setItem("timeEntryId", String(newEntry?.id || ""));
        setPunchStatus(newEntry);
        onPunchStatusChange?.(newEntry);
        // Notify owner — fire-and-forget
        sendPunchNotification({
          punch_type: 'in',
          employee_name: identity.name,
          employee_role: identity.role,
          timestamp: clockInTime,
        });
      }

      window.dispatchEvent(new Event("force-refresh"));
    } catch (error) {
      console.error("Error toggling punch:", error);
      toast.error("Error al registrar ponche");
    } finally {
      setLoading(false);
    }
  };

  const isClockingOut = !!punchStatus;

  return (
    <>
      {/* ── Punch Button ── */}
      <Button
        onClick={handlePunchClick}
        disabled={loading}
        className={`relative overflow-hidden h-12 px-4 rounded-full border shadow-[0_10px_22px_rgba(0,0,0,0.14)] active:scale-95 transition-all flex items-center gap-2 backdrop-blur-xl ${
          punchStatus
            ? "bg-[linear-gradient(180deg,rgba(132,204,22,0.82),rgba(77,124,15,0.78))] border-lime-300/18 hover:border-lime-300/26"
            : "bg-[linear-gradient(180deg,rgba(16,185,129,0.82),rgba(5,150,105,0.78))] border-emerald-300/18 hover:border-emerald-300/26"
        }`}
      >
        <div className="bg-gradient-to-t rounded-full absolute inset-0 from-white/0 to-white/10" />
        {loading ? (
          <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin relative z-10" />
        ) : (
          <>
            {punchStatus ? (
              <>
                <LogOut className="w-5 h-5 relative z-10" />
                <div className="relative z-10 flex flex-col items-start">
                  <span className="text-sm font-bold leading-tight">Cerrar</span>
                  <span className="text-[9px] opacity-80">Turno activo</span>
                </div>
                <div className="w-2 h-2 rounded-full bg-white animate-pulse absolute top-2 right-2 z-10" />
              </>
            ) : (
              <>
                <LogIn className="w-5 h-5 relative z-10" />
                <span className="text-sm font-bold relative z-10">Ponche</span>
              </>
            )}
          </>
        )}
      </Button>

      {/* ── Confirm Dialog with time picker ── */}
      <Dialog open={confirmOpen} onOpenChange={(v) => { if (!v) setConfirmOpen(false); }}>
        <DialogContent
          style={{ background: '#0f1117' }}
          className="max-w-xs border border-white/10 rounded-2xl p-6"
          onKeyDown={(e) => e.stopPropagation()}
        >
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-white text-base">
              <Clock className="w-4 h-4 text-emerald-400" />
              {isClockingOut ? "Registrar salida" : "Registrar entrada"}
            </DialogTitle>
          </DialogHeader>

          <div className="mt-4 space-y-3">
            <label className="block text-xs font-semibold uppercase tracking-widest text-white/40">
              Hora registrada
            </label>
            <div className="w-full h-12 px-4 rounded-xl bg-black/20 border border-white/10 text-white text-lg font-bold flex items-center justify-center select-none">
              {pendingTime}
            </div>
          </div>

          <div className="mt-5 flex gap-2">
            <Button
              variant="ghost"
              className="flex-1 h-10 rounded-xl text-white/60 hover:text-white hover:bg-white/5"
              onClick={() => setConfirmOpen(false)}
            >
              Cancelar
            </Button>
            <Button
              className={`flex-1 h-10 rounded-xl font-bold ${
                isClockingOut
                  ? "bg-amber-500 hover:bg-amber-400 text-black"
                  : "bg-emerald-500 hover:bg-emerald-400 text-black"
              }`}
              onClick={() => {
                setConfirmOpen(false);
                handlePunchToggle(timeHHMMtoISO(pendingTime));
              }}
            >
              {isClockingOut ? "Registrar salida" : "Registrar entrada"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
