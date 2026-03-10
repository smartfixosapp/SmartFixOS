import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Clock, LogIn, LogOut } from "lucide-react";
import { toast } from "sonner";

const LOCAL_TIME_ENTRIES_KEY = "local_time_entries";

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

export default function PunchButton({ userId, userName, onPunchStatusChange }) {
  const [punchStatus, setPunchStatus] = useState(null);
  const [loading, setLoading] = useState(false);

  const resolveIdentity = async () => {
    const directId = String(userId || "").trim();
    const directName = String(userName || "").trim();
    if (directId) return { id: directId, name: directName || "Empleado" };

    try {
      const raw = localStorage.getItem("employee_session");
      const parsed = raw ? JSON.parse(raw) : null;
      const sid = String(parsed?.userId || parsed?.id || "").trim();
      const sname = String(parsed?.userName || parsed?.full_name || parsed?.email || "").trim();
      if (sid) return { id: sid, name: sname || "Empleado" };
    } catch {
      // ignore
    }

    try {
      const me = await base44.auth.me();
      const aid = String(me?.id || "").trim();
      const aname = String(me?.full_name || me?.email || "").trim();
      if (aid) return { id: aid, name: aname || "Empleado" };
    } catch {
      // ignore
    }

    return { id: "", name: directName || "Empleado" };
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
        await base44.entities.TimeEntry.get(timeEntryId).catch(() => null);
        const entry = normalizeTimeEntry(rawEntry);
        if (entry && !entry.clock_out) {
          setPunchStatus(entry);
          return;
        }
      }

      let openEntries = [];
      try {
        const payload = await base44.entities.TimeEntry.filter({
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

  const handlePunchToggle = async () => {
    setLoading(true);
    try {
      const identity = await resolveIdentity();
      if (!identity.id) {
        toast.error("No se pudo identificar el usuario para registrar el ponche.");
        return;
      }

      if (punchStatus) {
        // Clock out
        if (String(punchStatus.id || "").startsWith("local-time-")) {
          closeLocalEntry(punchStatus.id);
        } else {
          await base44.entities.TimeEntry.update(punchStatus.id, {
            clock_out: new Date().toISOString()
          });
        }
        sessionStorage.removeItem("timeEntryId");
        setPunchStatus(null);
        onPunchStatusChange?.(null);
      } else {
        // Clock in
        const payload = {
          employee_id: identity.id,
          employee_name: identity.name,
          clock_in: new Date().toISOString()
        };
        let newEntry;
        try {
          const createdPayload = await base44.entities.TimeEntry.create(payload);
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
      }

      window.dispatchEvent(new Event("force-refresh"));
    } catch (error) {
      console.error("Error toggling punch:", error);
      toast.error("Error al registrar ponche");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Button
      onClick={handlePunchToggle}
      disabled={loading}
      className={`relative overflow-hidden h-12 px-4 rounded-full border shadow-[0_10px_22px_rgba(0,0,0,0.14)] active:scale-95 transition-all flex items-center gap-2 backdrop-blur-xl ${
      punchStatus ?
      "bg-[linear-gradient(180deg,rgba(132,204,22,0.82),rgba(77,124,15,0.78))] border-lime-300/18 hover:border-lime-300/26" :
      "bg-[linear-gradient(180deg,rgba(16,185,129,0.82),rgba(5,150,105,0.78))] border-emerald-300/18 hover:border-emerald-300/26"}`
      }>

      <div className="bg-gradient-to-t rounded-full absolute inset-0 from-white/0 to-white/10" />
      {loading ?
      <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin relative z-10" /> :

      <>
          {punchStatus ?
        <>
              <LogOut className="w-5 h-5 relative z-10" />
              <div className="relative z-10 flex flex-col items-start">
                <span className="text-sm font-bold leading-tight">Cerrar</span>
                <span className="text-[9px] opacity-80">Turno activo</span>
              </div>
              <div className="w-2 h-2 rounded-full bg-white animate-pulse absolute top-2 right-2 z-10" />
            </> :

        <>
              <LogIn className="w-5 h-5 relative z-10" />
              <span className="text-sm font-bold relative z-10">Ponche</span>
            </>
        }
        </>
      }
    </Button>);

}
