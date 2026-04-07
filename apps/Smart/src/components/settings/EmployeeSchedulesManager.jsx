// EmployeeSchedulesManager.jsx — Admin: define el horario semanal de cada empleado.
// Persistencia: app_settings con slug "employee-schedules".
// payload = { [employee_id]: { monday: {start, end, off}, tuesday: {...}, ... } }
import React, { useState, useEffect, useMemo } from "react";
import { dataClient } from "@/components/api/dataClient";
import { Button } from "@/components/ui/button";
import { Loader2, Save, Clock, ChevronDown, ChevronRight, User } from "lucide-react";
import { toast } from "sonner";

const DAYS = [
  { key: "monday",    label: "Lunes" },
  { key: "tuesday",   label: "Martes" },
  { key: "wednesday", label: "Miércoles" },
  { key: "thursday",  label: "Jueves" },
  { key: "friday",    label: "Viernes" },
  { key: "saturday",  label: "Sábado" },
  { key: "sunday",    label: "Domingo" },
];

const DEFAULT_DAY = { start: "09:00", end: "18:00", off: false };
const DEFAULT_WEEK = DAYS.reduce((acc, d) => ({ ...acc, [d.key]: { ...DEFAULT_DAY } }), {});

function isSystemUserLike(emp) {
  // Solo excluimos cuentas internas SaaS (super_admin/saas_owner).
  // El dueño del taller (admin) SÍ debe poder asignarse horario.
  const role = String(emp?.role || "").trim().toLowerCase();
  if (role === "super_admin" || role === "saas_owner" || role === "superadmin") return true;
  return false;
}

export default function EmployeeSchedulesManager() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [employees, setEmployees] = useState([]);
  const [schedules, setSchedules] = useState({}); // { [empId]: weekObj }
  const [settingsRowId, setSettingsRowId] = useState(null);
  const [expanded, setExpanded] = useState(null);

  useEffect(() => {
    loadAll();
  }, []);

  const loadAll = async () => {
    setLoading(true);
    try {
      const [emps, settings] = await Promise.all([
        dataClient.entities.AppEmployee.filter({ active: true }, "full_name", 200).catch(() => []),
        dataClient.entities.AppSettings.filter({ slug: "employee-schedules" }).catch(() => []),
      ]);

      const cleanEmps = (emps || []).filter((e) => !isSystemUserLike(e));
      setEmployees(cleanEmps);

      if (settings?.length) {
        setSettingsRowId(settings[0].id);
        setSchedules(settings[0].payload || {});
      } else {
        setSettingsRowId(null);
        setSchedules({});
      }
    } catch (err) {
      console.error("[EmployeeSchedules] load error:", err);
      toast.error("Error cargando horarios");
    } finally {
      setLoading(false);
    }
  };

  const getWeekFor = (empId) => schedules[empId] || DEFAULT_WEEK;

  const updateDay = (empId, dayKey, patch) => {
    setSchedules((prev) => {
      const week = { ...(prev[empId] || DEFAULT_WEEK) };
      week[dayKey] = { ...(week[dayKey] || DEFAULT_DAY), ...patch };
      return { ...prev, [empId]: week };
    });
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      if (settingsRowId) {
        await dataClient.entities.AppSettings.update(settingsRowId, { payload: schedules });
      } else {
        const created = await dataClient.entities.AppSettings.create({
          slug: "employee-schedules",
          payload: schedules,
          description: "Horarios semanales por empleado",
        });
        if (created?.id) setSettingsRowId(created.id);
      }
      window.dispatchEvent(new Event("employee-schedules-updated"));
      toast.success("✅ Horarios guardados");
    } catch (err) {
      console.error("[EmployeeSchedules] save error:", err);
      toast.error("No se pudo guardar: " + (err?.message || "error"));
    } finally {
      setSaving(false);
    }
  };

  const summary = (week) => {
    const workDays = DAYS.filter((d) => !week?.[d.key]?.off).length;
    if (workDays === 0) return "Sin días laborables";
    return `${workDays} día(s) — ${week?.monday?.start || "—"} a ${week?.monday?.end || "—"}`;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20 text-white/60">
        <Loader2 className="w-6 h-6 animate-spin mr-2" /> Cargando empleados...
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="bg-gradient-to-br from-emerald-500/10 to-teal-500/5 border border-emerald-500/20 rounded-2xl p-4 sm:p-5">
        <div className="flex items-center gap-3 mb-1">
          <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center shadow-lg">
            <Clock className="w-5 h-5 text-white" />
          </div>
          <div className="flex-1">
            <p className="text-white font-black text-base">Horarios semanales</p>
            <p className="text-white/50 text-xs">Define entrada y salida por día. Los empleados verán recordatorios automáticos.</p>
          </div>
        </div>
      </div>

      {employees.length === 0 ? (
        <div className="text-center py-12 text-white/40 text-sm">
          No hay empleados activos para configurar.
        </div>
      ) : (
        <div className="space-y-3">
          {employees.map((emp) => {
            const week = getWeekFor(emp.id);
            const isOpen = expanded === emp.id;
            return (
              <div
                key={emp.id}
                className="bg-white/[0.04] border border-white/10 rounded-2xl overflow-hidden"
              >
                <button
                  onClick={() => setExpanded(isOpen ? null : emp.id)}
                  className="w-full flex items-center gap-3 px-4 py-4 hover:bg-white/[0.06] transition-all text-left"
                >
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-500/30 to-blue-500/20 border border-cyan-500/20 flex items-center justify-center">
                    <User className="w-5 h-5 text-cyan-300" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-white font-bold text-sm truncate">{emp.full_name}</p>
                    <p className="text-white/40 text-xs truncate">
                      {emp.position || emp.role || "Empleado"} · {summary(week)}
                    </p>
                  </div>
                  {isOpen ? (
                    <ChevronDown className="w-5 h-5 text-white/40" />
                  ) : (
                    <ChevronRight className="w-5 h-5 text-white/40" />
                  )}
                </button>

                {isOpen && (
                  <div className="border-t border-white/10 px-4 py-4 space-y-2 bg-black/20">
                    {DAYS.map(({ key, label }) => {
                      const day = week[key] || DEFAULT_DAY;
                      return (
                        <div
                          key={key}
                          className="flex items-center gap-3 py-2 border-b border-white/5 last:border-0"
                        >
                          <span className="w-24 text-white/80 text-sm font-semibold">{label}</span>

                          <label className="flex items-center gap-2 text-white/60 text-xs">
                            <input
                              type="checkbox"
                              checked={!!day.off}
                              onChange={(e) => updateDay(emp.id, key, { off: e.target.checked })}
                              className="w-4 h-4 accent-emerald-500"
                            />
                            Descansa
                          </label>

                          <input
                            type="time"
                            value={day.start}
                            disabled={day.off}
                            onChange={(e) => updateDay(emp.id, key, { start: e.target.value })}
                            className="flex-1 bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-white text-sm disabled:opacity-30"
                          />
                          <span className="text-white/30 text-xs">→</span>
                          <input
                            type="time"
                            value={day.end}
                            disabled={day.off}
                            onChange={(e) => updateDay(emp.id, key, { end: e.target.value })}
                            className="flex-1 bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-white text-sm disabled:opacity-30"
                          />
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      <Button
        onClick={handleSave}
        disabled={saving}
        className="w-full bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 text-white rounded-[20px] h-14 text-lg font-black shadow-[0_0_30px_rgba(16,185,129,0.4)] active:scale-95 transition-all"
      >
        {saving ? <Loader2 className="w-5 h-5 mr-2 animate-spin" /> : <Save className="w-5 h-5 mr-2" />}
        Guardar Horarios
      </Button>
    </div>
  );
}
