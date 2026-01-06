import React, { useEffect, useMemo, useState, useCallback } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { createPageUrl } from "@/components/utils/helpers";
import {
  Filter,
  RefreshCcw,
  CalendarDays,
  Edit3,
  Check,
  X,
  LockKeyhole,
} from "lucide-react";

/* ============ Fallback local para lista de empleados (si Base44 no responde) ============ */
const roles_config = [
  { id: "1", full_name: "Yuka", role: "admin" },
  { id: "2", full_name: "Tiffany", role: "service" },
  { id: "3", full_name: "Francis", role: "technician" },
];

/* ====================== Utiles de fechas ====================== */
const startOfDay = (d) => {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
};
const endOfDay = (d) => {
  const x = new Date(d);
  x.setHours(23, 59, 59, 999);
  return x;
};
// Domingo como primer día de semana
const startOfWeekSunday = (d) => {
  const x = startOfDay(d);
  const day = x.getDay(); // 0 = Sunday
  x.setDate(x.getDate() - day);
  return x;
};
const endOfWeekSaturday = (d) => {
  const x = startOfWeekSunday(d);
  x.setDate(x.getDate() + 6);
  x.setHours(23, 59, 59, 999);
  return x;
};
const fmt = (d) =>
  new Date(d).toLocaleString("es-PR", {
    dateStyle: "medium",
    timeStyle: "short",
  });

/* ====================== Modal edición (solo admin) ====================== */
function EditPunchModal({ open, onClose, punch, onSaved }) {
  const [clockIn, setClockIn] = useState("");
  const [clockOut, setClockOut] = useState("");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open || !punch) return;
    const inIso = punch.clock_in ? new Date(punch.clock_in) : null;
    const outIso = punch.clock_out ? new Date(punch.clock_out) : null;
    setClockIn(
      inIso
        ? new Date(inIso.getTime() - inIso.getTimezoneOffset() * 60000)
            .toISOString()
            .slice(0, 16)
        : ""
    );
    setClockOut(
      outIso
        ? new Date(outIso.getTime() - outIso.getTimezoneOffset() * 60000)
            .toISOString()
            .slice(0, 16)
        : ""
    );
    setNote("");
    setError("");
  }, [open, punch]);

  const handleSave = async () => {
    if (!note.trim()) {
      setError("Debes escribir una nota de justificación.");
      return;
    }
    if (!clockIn) {
      setError("La hora de entrada es obligatoria.");
      return;
    }
    const body = {
      clock_in: new Date(clockIn).toISOString(),
      clock_out: clockOut ? new Date(clockOut).toISOString() : null,
      edited_at: new Date().toISOString(),
    };
    setSaving(true);
    setError("");
    try {
      await base44.entities.TimeEntry.update(punch.id, body);
      // Auditoría (si existe AuditLog; sino, KeyValue de respaldo)
      try {
        await base44.entities.AuditLog.create({
          scope: "punch_edit",
          ref_id: punch.id,
          user: punch.employee_name,
          payload: {
            note,
            before: {
              clock_in: punch.clock_in || null,
              clock_out: punch.clock_out || null,
            },
            after: body,
          },
          created_at: new Date().toISOString(),
        });
      } catch {
        try {
          await base44.entities.KeyValue.create({
            scope: "audit_punch_edit",
            value_json: {
              punch_id: punch.id,
              note,
              after: body,
              at: new Date().toISOString(),
            },
          });
        } catch {
          // no-op si no existe KeyValue
        }
      }
      onSaved?.();
      onClose?.();
    } catch (e) {
      console.error(e);
      setError("No se pudo guardar el cambio.");
    } finally {
      setSaving(false);
    }
  };

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="w-full max-w-xl bg-[#111] border border-white/10 rounded-2xl text-white">
        <div className="px-5 py-4 border-b border-white/10 flex items-center gap-2">
          <Edit3 className="w-5 h-5 text-red-500" />
          <h3 className="font-semibold">Editar ponche</h3>
        </div>

        <div className="p-5 space-y-4">
          <div>
            <label className="text-xs text-gray-400">Empleado</label>
            <div className="mt-1 text-sm font-medium">{punch?.employee_name}</div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="text-xs text-gray-400">Entrada</label>
              <input
                type="datetime-local"
                value={clockIn}
                onChange={(e) => setClockIn(e.target.value)}
                className="mt-1 w-full bg-black/40 border border-white/10 rounded-md px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-red-600"
              />
            </div>
            <div>
              <label className="text-xs text-gray-400">Salida (opcional)</label>
              <input
                type="datetime-local"
                value={clockOut}
                onChange={(e) => setClockOut(e.target.value)}
                className="mt-1 w-full bg-black/40 border border-white/10 rounded-md px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-red-600"
              />
            </div>
          </div>

          <div>
            <label className="text-xs text-gray-400">
              Justificación (obligatoria)
            </label>
            <textarea
              rows={3}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              className="mt-1 w-full bg-black/40 border border-white/10 rounded-md px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-red-600 resize-none"
              placeholder="Escribe por qué se modifica este ponche…"
            />
          </div>

          {error && <p className="text-red-400 text-sm">{error}</p>}
        </div>

        <div className="px-5 py-4 border-t border-white/10 flex justify-end gap-2">
          <Button
            variant="outline"
            className="border-white/20 text-gray-200 hover:bg-white/5"
            onClick={onClose}
          >
            <X className="w-4 h-4 mr-2" />
            Cancelar
          </Button>
          <Button
            onClick={handleSave}
            disabled={saving}
            className="bg-gradient-to-r from-red-600 to-red-800 hover:from-red-500 hover:to-red-700"
          >
            <Check className="w-4 h-4 mr-2" />
            Guardar
          </Button>
        </div>
      </div>
    </div>
  );
}

/* ====================== Página principal de Ponches ====================== */
export default function Punches() {
  const [session, setSession] = useState(null); // {userId, userName, userRole}
  const [employees, setEmployees] = useState([]);
  const [selectedEmployee, setSelectedEmployee] = useState("all");

  const [from, setFrom] = useState(startOfWeekSunday(new Date()));
  const [to, setTo] = useState(endOfWeekSaturday(new Date()));
  const [onlyOpen, setOnlyOpen] = useState(false);

  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(false);

  const [editOpen, setEditOpen] = useState(false);
  const [editRow, setEditRow] = useState(null);

  /* ---------- cargar sesión ---------- */
  useEffect(() => {
    const raw = sessionStorage.getItem("911-session");
    if (raw) setSession(JSON.parse(raw));
  }, []);

  /* ---------- cargar empleados ---------- */
  const loadEmployees = useCallback(async () => {
    try {
      const list = await base44.entities.User.filter({ active: true });
      const formatted = list.map((u) => ({
        id: u.id,
        full_name: u.full_name,
        role: u.role,
      }));
      setEmployees([{ id: "all", full_name: "Todos" }, ...formatted]);
    } catch {
      setEmployees([{ id: "all", full_name: "Todos" }, ...roles_config]);
    }
  }, []);

  useEffect(() => {
    loadEmployees();
  }, [loadEmployees]);

  /* ---------- cargar ponches ---------- */
  const loadEntries = useCallback(async () => {
    setLoading(true);
    try {
      const params = {};
      if (selectedEmployee !== "all") params.employee_id = selectedEmployee;
      if (onlyOpen) params.clock_out = null;

      const data = await base44.entities.TimeEntry.filter(params, "-clock_in", 500);

      const inRange = data.filter((t) => {
        const ci = new Date(t.clock_in);
        return ci >= startOfDay(from) && ci <= endOfDay(to);
      });

      setEntries(inRange);
    } catch (e) {
      console.error(e);
      setEntries([]);
    } finally {
      setLoading(false);
    }
  }, [selectedEmployee, onlyOpen, from, to]);

  useEffect(() => {
    loadEntries();
  }, [loadEntries]);

  /* ---------- helpers ---------- */
  const totalMillis = (list) =>
    list.reduce((acc, t) => {
      const start = t.clock_in ? new Date(t.clock_in).getTime() : 0;
      const end = t.clock_out ? new Date(t.clock_out).getTime() : Date.now();
      return acc + Math.max(0, end - start);
    }, 0);

  const formatHM = (ms) => {
    const h = Math.floor(ms / 3600000);
    const m = Math.floor((ms % 3600000) / 60000);
    return `${h}h ${m.toString().padStart(2, "0")}m`;
    };

  // resumen semanal por rango domingo-sábado
  const weeklySummary = useMemo(() => {
    if (!entries.length) return [];
    const map = new Map();
    entries.forEach((t) => {
      const d = new Date(t.clock_in);
      const start = startOfWeekSunday(d);
      const key = start.toISOString().slice(0, 10);
      const arr = map.get(key) || [];
      arr.push(t);
      map.set(key, arr);
    });
    return [...map.entries()]
      .sort(([a], [b]) => (a < b ? 1 : -1))
      .map(([key, arr]) => {
        const s = new Date(key);
        const e = endOfWeekSaturday(s);
        return {
          weekLabel: `${s.toLocaleDateString("es-PR", {
            month: "short",
            day: "numeric",
          })} – ${e.toLocaleDateString("es-PR", { month: "short", day: "numeric" })}`,
          range: [s, e],
          total: arr.length,
          open: arr.filter((t) => !t.clock_out).length,
          millis: totalMillis(arr),
        };
      });
  }, [entries]);

  const filteredTotalMillis = useMemo(() => totalMillis(entries), [entries]);

  /* ---------- Botones rápidos de rango ---------- */
  const setToday = () => {
    const d = new Date();
    setFrom(startOfDay(d));
    setTo(endOfDay(d));
  };
  const setThisWeek = () => {
    const s = startOfWeekSunday(new Date());
    setFrom(s);
    setTo(endOfWeekSaturday(new Date()));
  };
  const setThisMonth = () => {
    const d = new Date();
    const s = new Date(d.getFullYear(), d.getMonth(), 1);
    const e = new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59, 999);
    setFrom(s);
    setTo(e);
  };

  /* ---------- Render ---------- */
  const isAdmin = session?.userRole === "admin";

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0D0D0D] to-[#1A1A1A] text-white p-4 md:p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-red-500" />
          <h1 className="text-xl font-semibold">Ponches</h1>
        </div>
        <Button
          onClick={loadEntries}
          className="bg-zinc-800 hover:bg-zinc-700 text-slate-100"
        >
          <RefreshCcw className="w-4 h-4 mr-2" />
          Refrescar
        </Button>
      </div>

      {/* Filtros */}
      <Card className="bg-[#121212] border border-white/10 mb-6">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2">
            <Filter className="w-5 h-5 text-red-500" />
            Filtros
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Empleado */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div>
              <label className="text-xs text-gray-400 mb-1 block">Empleado</label>
              <div className="relative">
                <select
                  value={selectedEmployee}
                  onChange={(e) => setSelectedEmployee(e.target.value)}
                  className="w-full bg-black/40 border border-white/10 rounded-md px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-red-600 appearance-none"
                >
                  {employees.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.full_name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Rango por botones */}
            <div className="md:col-span-2">
              <label className="text-xs text-gray-400 mb-1 block">Rango</label>
              <div className="flex flex-wrap items-center gap-2">
                <div className="flex items-center bg-black/40 border border-white/10 rounded-md overflow-hidden">
                  <button
                    onClick={setToday}
                    className="px-3 py-2 text-sm hover:bg-white/5 flex items-center gap-1"
                  >
                    <CalendarDays className="w-4 h-4" /> Hoy
                  </button>
                  <button
                    onClick={setThisWeek}
                    className="px-3 py-2 text-sm hover:bg-white/5 border-l border-white/10"
                  >
                    Domingo–Sábado
                  </button>
                  <button
                    onClick={setThisMonth}
                    className="px-3 py-2 text-sm hover:bg-white/5 border-l border-white/10"
                  >
                    Mes
                  </button>
                </div>

                {/* DatePickers separados */}
                <input
                  type="date"
                  value={startOfDay(from).toISOString().slice(0, 10)}
                  onChange={(e) => setFrom(new Date(e.target.value))}
                  className="bg-black/40 border border-white/10 rounded-md px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-red-600"
                />
                <span className="text-gray-400">→</span>
                <input
                  type="date"
                  value={startOfDay(to).toISOString().slice(0, 10)}
                  onChange={(e) => setTo(new Date(e.target.value))}
                  className="bg-black/40 border border-white/10 rounded-md px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-red-600"
                />

                <label className="ml-auto inline-flex items-center gap-2 text-sm text-gray-300">
                  <input
                    type="checkbox"
                    className="accent-red-600"
                    checked={onlyOpen}
                    onChange={(e) => setOnlyOpen(e.target.checked)}
                  />
                  Mostrar solo abiertos
                </label>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <Card className="bg-[#121212] border border-white/10">
          <CardContent className="pt-5">
            <p className="text-xs text-gray-400 uppercase">Ponches filtrados</p>
            <p className="text-3xl font-bold mt-1">{entries.length}</p>
          </CardContent>
        </Card>
        <Card className="bg-[#121212] border border-white/10">
          <CardContent className="pt-5">
            <p className="text-xs text-gray-400 uppercase">Ponches abiertos</p>
            <p className="text-3xl font-bold mt-1 text-emerald-400">
              {entries.filter((e) => !e.clock_out).length}
            </p>
          </CardContent>
        </Card>
        <Card className="bg-[#121212] border border-white/10">
          <CardContent className="pt-5">
            <p className="text-xs text-gray-400 uppercase">Horas en el rango</p>
            <p className="text-3xl font-bold mt-1 text-red-400">
              {formatHM(filteredTotalMillis)}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Resumen semanal */}
      <Card className="bg-[#121212] border border-white/10 mb-6">
        <CardHeader className="pb-2">
          <CardTitle>Resumen semanal</CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          {weeklySummary.length ? (
            <table className="w-full text-sm">
              <thead className="text-gray-400">
                <tr className="text-left">
                  <th className="py-2 pr-4">Semana</th>
                  <th className="py-2 pr-4">Rango</th>
                  <th className="py-2 pr-4">Ponches</th>
                  <th className="py-2 pr-4">Abiertos</th>
                  <th className="py-2">Horas</th>
                </tr>
              </thead>
              <tbody>
                {weeklySummary.map((w, i) => (
                  <tr
                    key={i}
                    className="border-t border-white/5 hover:bg-white/5 transition-colors"
                  >
                    <td className="py-2 pr-4">{w.weekLabel}</td>
                    <td className="py-2 pr-4">
                      {w.range[0].toLocaleDateString("es-PR")} —{" "}
                      {w.range[1].toLocaleDateString("es-PR")}
                    </td>
                    <td className="py-2 pr-4">{w.total}</td>
                    <td className="py-2 pr-4">{w.open}</td>
                    <td className="py-2">{formatHM(w.millis)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p className="text-sm text-gray-400">No hay ponches que coincidan con el filtro.</p>
          )}
        </CardContent>
      </Card>

      {/* Historial */}
      <Card className="bg-[#121212] border border-white/10">
        <CardHeader className="pb-2">
          <CardTitle>Historial de Ponches</CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-gray-400">
              <tr className="text-left">
                <th className="py-2 pr-4">Empleado</th>
                <th className="py-2 pr-4">Entrada</th>
                <th className="py-2 pr-4">Salida</th>
                <th className="py-2 pr-4">Estado</th>
                <th className="py-2">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {!loading && entries.length === 0 && (
                <tr>
                  <td colSpan={5} className="py-6 text-center text-gray-400">
                    No hay ponches.
                  </td>
                </tr>
              )}
              {entries.map((t) => (
                <tr
                  key={t.id}
                  className="border-t border-white/5 hover:bg-white/5 transition-colors"
                >
                  <td className="py-2 pr-4">{t.employee_name}</td>
                  <td className="py-2 pr-4">{t.clock_in ? fmt(t.clock_in) : "—"}</td>
                  <td className="py-2 pr-4">{t.clock_out ? fmt(t.clock_out) : "—"}</td>
                  <td className="py-2 pr-4">
                    <Badge
                      className={`text-xs ${
                        t.clock_out
                          ? "bg-emerald-600/20 text-emerald-300 border-emerald-500/30"
                          : "bg-yellow-600/20 text-yellow-300 border-yellow-500/30"
                      }`}
                    >
                      {t.clock_out ? "Cerrado" : "Abierto"}
                    </Badge>
                  </td>
                  <td className="py-2">
                    {isAdmin ? (
                      <Button
                        size="sm"
                        className="bg-zinc-800 hover:bg-zinc-700 text-slate-100"
                        onClick={() => {
                          setEditRow(t);
                          setEditOpen(true);
                        }}
                      >
                        <Edit3 className="w-4 h-4 mr-2" />
                        Editar
                      </Button>
                    ) : (
                      <span className="inline-flex items-center text-gray-500 text-xs">
                        <LockKeyhole className="w-3.5 h-3.5 mr-1" />
                        Solo admin
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {loading && (
            <p className="text-center text-gray-400 py-6">Cargando ponches…</p>
          )}
        </CardContent>
      </Card>

      {/* Modal edición */}
      <EditPunchModal
        open={editOpen}
        onClose={() => setEditOpen(false)}
        punch={editRow}
        onSaved={loadEntries}
      />
    </div>
  );
}
