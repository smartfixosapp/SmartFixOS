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
      toast.success("Horarios guardados");
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
      <div className="apple-type flex items-center justify-center py-20 apple-label-tertiary">
        <Loader2 className="w-6 h-6 animate-spin mr-2" /> Cargando empleados...
      </div>
    );
  }

  return (
    <div className="apple-type space-y-4">
      <div className="bg-apple-green/12 rounded-apple-md p-4 sm:p-5">
        <div className="flex items-center gap-3 mb-1">
          <div className="w-11 h-11 rounded-apple-sm bg-apple-green/15 flex items-center justify-center">
            <Clock className="w-5 h-5 text-apple-green" />
          </div>
          <div className="flex-1">
            <p className="apple-label-primary apple-text-headline">Horarios semanales</p>
            <p className="apple-label-tertiary apple-text-caption1">Define entrada y salida por día. Los empleados verán recordatorios automáticos.</p>
          </div>
        </div>
      </div>

      {employees.length === 0 ? (
        <div className="text-center py-12 apple-label-tertiary apple-text-subheadline">
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
                className="apple-surface-elevated rounded-apple-md overflow-hidden"
              >
                <button
                  onClick={() => setExpanded(isOpen ? null : emp.id)}
                  className="w-full flex items-center gap-3 px-4 py-4 hover:bg-gray-sys6 dark:hover:bg-gray-sys5 transition-all text-left apple-press"
                >
                  <div className="w-10 h-10 rounded-apple-sm bg-apple-blue/15 flex items-center justify-center">
                    <User className="w-5 h-5 text-apple-blue" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="apple-label-primary apple-text-subheadline truncate">{emp.full_name}</p>
                    <p className="apple-label-tertiary apple-text-caption1 truncate">
                      {emp.position || emp.role || "Empleado"} · <span className="tabular-nums">{summary(week)}</span>
                    </p>
                  </div>
                  {isOpen ? (
                    <ChevronDown className="w-5 h-5 apple-label-tertiary" />
                  ) : (
                    <ChevronRight className="w-5 h-5 apple-label-tertiary" />
                  )}
                </button>

                {isOpen && (
                  <div className="px-4 py-4 space-y-2 bg-gray-sys6 dark:bg-gray-sys5" style={{ borderTop: '0.5px solid rgb(var(--separator) / 0.29)' }}>
                    {DAYS.map(({ key, label }) => {
                      const day = week[key] || DEFAULT_DAY;
                      return (
                        <div
                          key={key}
                          className="flex items-center gap-3 py-2 last:border-0"
                          style={{ borderBottom: '0.5px solid rgb(var(--separator) / 0.29)' }}
                        >
                          <span className="w-24 apple-label-primary apple-text-subheadline">{label}</span>

                          <label className="flex items-center gap-2 apple-label-tertiary apple-text-caption1">
                            <input
                              type="checkbox"
                              checked={!!day.off}
                              onChange={(e) => updateDay(emp.id, key, { off: e.target.checked })}
                              className="w-4 h-4 accent-apple-green"
                            />
                            Descansa
                          </label>

                          <input
                            type="time"
                            value={day.start}
                            disabled={day.off}
                            onChange={(e) => updateDay(emp.id, key, { start: e.target.value })}
                            className="apple-input flex-1 px-3 py-1.5 tabular-nums disabled:opacity-30"
                          />
                          <span className="apple-label-tertiary apple-text-caption2">→</span>
                          <input
                            type="time"
                            value={day.end}
                            disabled={day.off}
                            onChange={(e) => updateDay(emp.id, key, { end: e.target.value })}
                            className="apple-input flex-1 px-3 py-1.5 tabular-nums disabled:opacity-30"
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
        className="apple-btn apple-btn-primary apple-btn-lg apple-press w-full"
      >
        {saving ? <Loader2 className="w-5 h-5 mr-2 animate-spin" /> : <Save className="w-5 h-5 mr-2" />}
        Guardar Horarios
      </Button>
    </div>
  );
}
