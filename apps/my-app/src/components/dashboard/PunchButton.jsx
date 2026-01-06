import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Clock, LogIn, LogOut } from "lucide-react";
import { toast } from "sonner";

export default function PunchButton({ userId, userName, onPunchStatusChange }) {
  const [punchStatus, setPunchStatus] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (userId) {
      checkPunchStatus();
    }
  }, [userId]);

  const checkPunchStatus = async () => {
    try {
      const timeEntryId = sessionStorage.getItem("timeEntryId");
      if (timeEntryId) {
        const entry = await base44.entities.TimeEntry.get(timeEntryId).catch(() => null);
        if (entry && !entry.clock_out) {
          setPunchStatus(entry);
          return;
        }
      }

      const openEntries = await base44.entities.TimeEntry.filter({
        employee_id: userId,
        clock_out: null
      });

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
      if (punchStatus) {
        // Clock out
        await base44.entities.TimeEntry.update(punchStatus.id, {
          clock_out: new Date().toISOString()
        });
        sessionStorage.removeItem("timeEntryId");
        setPunchStatus(null);
        onPunchStatusChange?.(null);
      } else {
        // Clock in
        const newEntry = await base44.entities.TimeEntry.create({
          employee_id: userId,
          employee_name: userName,
          clock_in: new Date().toISOString()
        });
        sessionStorage.setItem("timeEntryId", newEntry.id);
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
      className={`relative overflow-hidden h-12 px-4 rounded-xl shadow-lg active:scale-95 transition-all flex items-center gap-2 ${
        punchStatus
          ? "bg-gradient-to-br from-lime-600 to-lime-800 hover:from-lime-700 hover:to-lime-900 hover:shadow-[0_8px_24px_rgba(132,204,22,0.4)]"
          : "bg-gradient-to-br from-emerald-600 to-emerald-800 hover:from-emerald-700 hover:to-emerald-900 hover:shadow-[0_8px_24px_rgba(16,185,129,0.4)]"
      }`}
    >
      <div className="absolute inset-0 bg-gradient-to-t from-white/0 to-white/10" />
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
  );
}
