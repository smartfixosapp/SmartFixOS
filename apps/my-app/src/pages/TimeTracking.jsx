import React, { useEffect, useMemo, useState, useCallback } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Filter,
  RefreshCcw,
  CalendarDays,
  Edit3,
  Check,
  X,
  LockKeyhole,
  Clock,
  DollarSign,
  TrendingUp
} from
"lucide-react";

/* ============ Fallback local para lista de empleados (si Base44 no responde) ============ */
const roles_config = [
{ id: "1", full_name: "Yuka", role: "admin" },
{ id: "2", full_name: "Tiffany", role: "service" },
{ id: "3", full_name: "Francis", role: "technician" }];


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
  timeStyle: "short"
});

/* ====================== Modal edición (solo admin/manager) ====================== */
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
      inIso ?
      new Date(inIso.getTime() - inIso.getTimezoneOffset() * 60000).
      toISOString().
      slice(0, 16) :
      ""
    );
    setClockOut(
      outIso ?
      new Date(outIso.getTime() - outIso.getTimezoneOffset() * 60000).
      toISOString().
      slice(0, 16) :
      ""
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
      edited_at: new Date().toISOString()
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
              clock_out: punch.clock_out || null
            },
            after: body
          },
          created_at: new Date().toISOString()
        });
      } catch {
        try {
          await base44.entities.KeyValue.create({
            scope: "audit_punch_edit",
            value_json: {
              punch_id: punch.id,
              note,
              after: body,
              at: new Date().toISOString()
            }
          });
        } catch (e) {
          console.error("Failed to log audit or keyvalue:", e);
          // no-op si no existe KeyValue
        }}onSaved?.();onClose?.();} catch (e) {console.error(e);setError("No se pudo guardar el cambio.");} finally {setSaving(false);}};if (!open) return null;return <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
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
              <input type="datetime-local" value={clockIn} onChange={(e) => setClockIn(e.target.value)} className="mt-1 w-full bg-black/40 border border-white/10 rounded-md px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-red-600" />

            </div>
            <div>
              <label className="text-xs text-gray-400">Salida (opcional)</label>
              <input
              type="datetime-local"
              value={clockOut}
              onChange={(e) => setClockOut(e.target.value)}
              className="mt-1 w-full bg-black/40 border border-white/10 rounded-md px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-red-600" />

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
            placeholder="Escribe por qué se modifica este ponche…" />

          </div>

          {error && <p className="text-red-400 text-sm">{error}</p>}
        </div>

        <div className="px-5 py-4 border-t border-white/10 flex justify-end gap-2">
          <Button
          variant="outline"
          className="border-white/20 text-gray-200 hover:bg-white/5"
          onClick={onClose}>

            <X className="w-4 h-4 mr-2" />
            Cancelar
          </Button>
          <Button
          onClick={handleSave}
          disabled={saving}
          className="bg-gradient-to-r from-red-600 to-red-800 hover:from-red-500 hover:to-red-700">

            <Check className="w-4 h-4 mr-2" />
            Guardar
          </Button>
        </div>
      </div>
    </div>;

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

  const [activeUsers, setActiveUsers] = useState([]);
  const [paymentModalOpen, setPaymentModalOpen] = useState(false);
  const [selectedEmployeeForPayment, setSelectedEmployeeForPayment] = useState(null);
  const [detailModalOpen, setDetailModalOpen] = useState(false);
  const [selectedEmployeeDetail, setSelectedEmployeeDetail] = useState(null);

  /* ---------- cargar sesión ---------- */
  useEffect(() => {
    const raw = sessionStorage.getItem("911-session");
    if (raw) setSession(JSON.parse(raw));
  }, []);

  /* ---------- cargar usuarios activos ---------- */
  const loadActiveUsers = useCallback(async () => {
    try {
      const recentEntries = await base44.entities.TimeEntry.filter(
        { clock_out: null },
        "-clock_in",
        50
      );
      const now = Date.now();
      const active = recentEntries.filter(e => {
        const clockIn = new Date(e.clock_in).getTime();
        return (now - clockIn) < 24 * 3600000; // últimas 24h
      });
      setActiveUsers(active);
    } catch (e) {
      console.error("Error loading active users:", e);
      setActiveUsers([]);
    }
  }, []);

  useEffect(() => {
    if (session?.userRole === "admin" || session?.userRole === "manager") {
      loadActiveUsers();
      const interval = setInterval(loadActiveUsers, 30000); // actualizar cada 30s
      return () => clearInterval(interval);
    }
  }, [session, loadActiveUsers]);

  /* ---------- cargar empleados ---------- */
  const loadEmployees = useCallback(async () => {
    try {
      const list = await base44.entities.User.filter({ active: true });
      const formatted = list.map((u) => ({
        id: u.id,
        full_name: u.full_name,
        role: u.role,
        hourly_rate: u.hourly_rate || 0
      }));
      setEmployees([{ id: "all", full_name: "Todos", hourly_rate: 0 }, ...formatted]);
    } catch {
      setEmployees([{ id: "all", full_name: "Todos", hourly_rate: 0 }, ...roles_config]);
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
    const m = Math.floor(ms % 3600000 / 60000);
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
    return [...map.entries()].
    sort(([a], [b]) => a < b ? 1 : -1).
    map(([key, arr]) => {
      const s = new Date(key);
      const e = endOfWeekSaturday(s);
      return {
        weekLabel: `${s.toLocaleDateString("es-PR", {
          month: "short",
          day: "numeric"
        })} – ${e.toLocaleDateString("es-PR", { month: "short", day: "numeric" })}`,
        range: [s, e],
        total: arr.length,
        open: arr.filter((t) => !t.clock_out).length,
        millis: totalMillis(arr)
      };
    });
  }, [entries]);

  // Calcular pagos por empleado
  const employeePayments = useMemo(() => {
    const paymentMap = new Map();
    
    entries.forEach((entry) => {
      if (!entry.employee_id) return;
      
      const employee = employees.find(e => e.id === entry.employee_id);
      if (!employee || employee.id === "all") return;
      
      const hourlyRate = parseFloat(employee.hourly_rate) || 0;
      if (hourlyRate === 0) return;
      
      const start = entry.clock_in ? new Date(entry.clock_in).getTime() : 0;
      const end = entry.clock_out ? new Date(entry.clock_out).getTime() : Date.now();
      const millis = Math.max(0, end - start);
      const hours = millis / 3600000;
      const payment = hours * hourlyRate;
      
      const current = paymentMap.get(entry.employee_id) || {
        name: entry.employee_name,
        hours: 0,
        payment: 0,
        rate: hourlyRate
      };
      
      current.hours += hours;
      current.payment += payment;
      paymentMap.set(entry.employee_id, current);
    });
    
    return Array.from(paymentMap.entries())
      .map(([id, data]) => ({ id, ...data }))
      .sort((a, b) => b.payment - a.payment);
  }, [entries, employees]);

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

  /* ---------- hacer pago ---------- */
  const handlePayment = async (employeeData) => {
    setSelectedEmployeeForPayment(employeeData);
    setPaymentModalOpen(true);
  };

  const processPayment = async (amount, type, notes) => {
    if (!selectedEmployeeForPayment) return;
    
    try {
      await base44.entities.EmployeePayment.create({
        employee_id: selectedEmployeeForPayment.id,
        employee_name: selectedEmployeeForPayment.name,
        employee_code: employees.find(e => e.id === selectedEmployeeForPayment.id)?.employee_code || "",
        amount: parseFloat(amount),
        payment_type: type,
        payment_method: "transfer",
        period_start: from.toISOString(),
        period_end: to.toISOString(),
        notes: notes,
        paid_by: session?.userId,
        paid_by_name: session?.userName
      });
      
      setPaymentModalOpen(false);
      setSelectedEmployeeForPayment(null);
      loadEntries();
    } catch (e) {
      console.error("Error processing payment:", e);
      alert("Error al procesar el pago");
    }
  };

  /* ---------- Render ---------- */
  const canEditPunch = ["admin", "manager"].includes(session?.userRole);
  const isAdmin = ["admin", "manager"].includes(session?.userRole);

  if (!isAdmin) {
    return (
      <div className="min-h-screen bg-[radial-gradient(circle_at_top,#0f172a_0%,#020617_45%,#000_90%)] p-4 sm:p-6 flex items-center justify-center">
        <div className="bg-black/40 backdrop-blur-xl border border-red-500/30 rounded-2xl p-8 text-center max-w-md">
          <LockKeyhole className="w-16 h-16 text-red-500 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-white mb-2">Acceso Restringido</h2>
          <p className="text-gray-400">Solo administradores pueden acceder a Control de Tiempo.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,#0f172a_0%,#020617_45%,#000_90%)] p-4 sm:p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header Glass */}
        <div className="bg-black/40 backdrop-blur-xl border border-white/10 rounded-2xl p-6 shadow-[0_8px_32px_rgba(0,0,0,0.3)]">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-white flex items-center gap-3">
                <Clock className="w-8 h-8 text-red-500" />
                Control de Tiempo
              </h1>
              <p className="text-gray-400 mt-2">Registro de ponches y horas trabajadas</p>
            </div>
            <Button
              onClick={loadEntries}
              className="bg-zinc-800 hover:bg-zinc-700 text-slate-100">

              <RefreshCcw className="w-4 h-4 mr-2" />
              Refrescar
            </Button>
          </div>
        </div>

        {/* Usuarios Activos Ahora */}
        {activeUsers.length > 0 && (
          <Card className="bg-gradient-to-r from-cyan-950/40 to-blue-950/40 border border-cyan-500/30">
            <CardHeader className="pb-2">
              <CardTitle className="text-cyan-400 text-xl font-semibold flex items-center gap-2">
                <TrendingUp className="w-5 h-5" />
                Usuarios Activos Ahora ({activeUsers.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2">
                {activeUsers.map((entry) => (
                  <button
                    key={entry.id}
                    onClick={() => {
                      setSelectedEmployeeDetail({
                        id: entry.employee_id,
                        name: entry.employee_name,
                        currentEntry: entry
                      });
                      setDetailModalOpen(true);
                    }}
                    className="px-4 py-2 bg-cyan-500/20 hover:bg-cyan-500/30 border border-cyan-500/40 rounded-lg text-cyan-300 text-sm font-semibold transition-all flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
                    {entry.employee_name}
                  </button>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Existing content starts here */}
        {/* Header */}
        {/*
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-red-500" />
            <h1 className="text-xl font-semibold">Ponches</h1>
          </div>
          <Button
            onClick={loadEntries}
            className="bg-zinc-800 hover:bg-zinc-700 text-slate-100">

            <RefreshCcw className="w-4 h-4 mr-2" />
            Refrescar
          </Button>
        </div>
        */}

        {/* Filtros */}
        <Card className="bg-[#121212] border border-white/10">
          <CardHeader className="pb-2">
            <CardTitle className="text-slate-50 text-2xl font-semibold tracking-tight leading-none flex items-center gap-2">Filtros


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
                    onChange={(e) => setSelectedEmployee(e.target.value)} className="bg-black/40 text-slate-50 px-3 py-2 text-sm rounded-md w-full border border-white/10 outline-none focus:ring-2 focus:ring-red-600 appearance-none">


                    {employees.map((u) =>
                    <option key={u.id} value={u.id}>
                        {u.full_name}
                      </option>
                    )}
                  </select>
                </div>
              </div>

              {/* Rango por botones */}
              <div className="md:col-span-2">
                <label className="text-xs text-gray-400 mb-1 block">Rango</label>
                <div className="flex flex-wrap items-center gap-2">
                  <div className="flex items-center bg-black/40 border border-white/10 rounded-md overflow-hidden">
                    <button
                      onClick={setToday} className="text-slate-50 px-3 py-2 text-sm hover:bg-white/5 flex items-center gap-1">


                      <CalendarDays className="w-4 h-4" /> Hoy
                    </button>
                    <button
                      onClick={setThisWeek} className="text-slate-50 px-3 py-2 text-sm hover:bg-white/5 border-l border-white/10">


                      Domingo–Sábado
                    </button>
                    <button
                      onClick={setThisMonth} className="text-slate-50 px-3 py-2 text-sm hover:bg-white/5 border-l border-white/10">


                      Mes
                    </button>
                  </div>

                  {/* DatePickers separados */}
                  <input
                    type="date"
                    value={startOfDay(from).toISOString().slice(0, 10)}
                    onChange={(e) => setFrom(new Date(e.target.value))} className="bg-black/40 text-slate-50 px-3 py-2 text-sm rounded-md border border-white/10 outline-none focus:ring-2 focus:ring-red-600" />


                  <span className="text-gray-400">→</span>
                  <input
                    type="date"
                    value={startOfDay(to).toISOString().slice(0, 10)}
                    onChange={(e) => setTo(new Date(e.target.value))} className="bg-black/40 text-slate-50 px-3 py-2 text-sm rounded-md border border-white/10 outline-none focus:ring-2 focus:ring-red-600" />



                  <label className="ml-auto inline-flex items-center gap-2 text-sm text-gray-300">
                    <input
                      type="checkbox"
                      className="accent-red-600"
                      checked={onlyOpen}
                      onChange={(e) => setOnlyOpen(e.target.checked)} />

                    Mostrar solo abiertos
                  </label>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* KPIs */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card className="bg-[#121212] border border-white/10">
            <CardContent className="pt-5">
              <p className="text-xs text-gray-400 uppercase">Ponches filtrados</p>
              <p className="text-slate-50 mt-1 text-3xl font-bold">{entries.length}</p>
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

        {/* Resumen de Pagos por Empleado */}
        {employeePayments.length > 0 && (
          <Card className="bg-gradient-to-br from-emerald-950/40 to-green-950/40 border border-emerald-500/30">
            <CardHeader className="pb-2">
              <CardTitle className="text-emerald-400 text-2xl font-semibold tracking-tight leading-none flex items-center gap-2">
                <DollarSign className="w-6 h-6" />
                Pagos Calculados
              </CardTitle>
              <p className="text-gray-400 text-sm mt-1">Basado en horas trabajadas y tarifa por hora</p>
            </CardHeader>
            <CardContent className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-emerald-400/80">
                  <tr className="text-left">
                    <th className="py-2 pr-4">Empleado</th>
                    <th className="py-2 pr-4 text-right">Horas</th>
                    <th className="py-2 pr-4 text-right">Tarifa/Hora</th>
                    <th className="py-2 pr-4 text-right">Pago Total</th>
                    <th className="py-2 text-center">Acción</th>
                  </tr>
                </thead>
                <tbody>
                  {employeePayments.map((emp) => (
                    <tr
                      key={emp.id}
                      className="border-t border-emerald-500/10 hover:bg-emerald-500/5 transition-colors">
                      <td className="text-slate-50 pr-4 py-3 font-medium">{emp.name}</td>
                      <td className="text-slate-50 pr-4 py-3 text-right font-mono">
                        {emp.hours.toFixed(2)}h
                      </td>
                      <td className="text-slate-50 pr-4 py-3 text-right font-mono">
                        ${emp.rate.toFixed(2)}
                      </td>
                      <td className="text-emerald-400 pr-4 py-3 text-right font-bold text-lg">
                        ${emp.payment.toFixed(2)}
                      </td>
                      <td className="py-3 text-center">
                        <Button
                          onClick={() => handlePayment(emp)}
                          size="sm"
                          className="bg-gradient-to-r from-emerald-600 to-green-600 hover:from-emerald-700 hover:to-green-700 text-white">
                          <DollarSign className="w-4 h-4 mr-1" />
                          Pagar
                        </Button>
                      </td>
                    </tr>
                  ))}
                  <tr className="border-t-2 border-emerald-500/30">
                    <td className="text-emerald-400 pr-4 py-3 font-bold" colSpan={3}>
                      TOTAL A PAGAR
                    </td>
                    <td className="text-emerald-400 py-3 text-right font-black text-xl">
                      ${employeePayments.reduce((sum, e) => sum + e.payment, 0).toFixed(2)}
                    </td>
                  </tr>
                </tbody>
              </table>
            </CardContent>
          </Card>
        )}

        {/* Resumen semanal */}
        <Card className="bg-[#121212] border border-white/10">
          <CardHeader className="pb-2">
            <CardTitle className="text-slate-50 text-2xl font-semibold tracking-tight leading-none">Resumen semanal</CardTitle>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            {weeklySummary.length ?
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
                  {weeklySummary.map((w, i) =>
                <tr
                  key={i}
                  className="border-t border-white/5 hover:bg-white/5 transition-colors">

                      <td className="text-slate-50 pr-4 py-2">{w.weekLabel}</td>
                      <td className="text-slate-50 pr-4 py-2">
                        {w.range[0].toLocaleDateString("es-PR")} —{" "}
                        {w.range[1].toLocaleDateString("es-PR")}
                      </td>
                      <td className="text-slate-50 pr-4 py-2">{w.total}</td>
                      <td className="text-slate-50 pr-4 py-2">{w.open}</td>
                      <td className="text-slate-50 py-2">{formatHM(w.millis)}</td>
                    </tr>
                )}
                </tbody>
              </table> :

            <p className="text-sm text-gray-400">No hay ponches que coincidan con el filtro.</p>
            }
          </CardContent>
        </Card>


      </div>

      {/* Modal edición */}
      <EditPunchModal
        open={editOpen}
        onClose={() => setEditOpen(false)}
        punch={editRow}
        onSaved={loadEntries} />

      {/* Modal de pago */}
      {paymentModalOpen && selectedEmployeeForPayment && (
        <PaymentModal
          open={paymentModalOpen}
          onClose={() => {
            setPaymentModalOpen(false);
            setSelectedEmployeeForPayment(null);
          }}
          employee={selectedEmployeeForPayment}
          onConfirm={processPayment}
        />
      )}

      {/* Modal de detalle */}
      {detailModalOpen && selectedEmployeeDetail && (
        <EmployeeDetailModal
          open={detailModalOpen}
          onClose={() => {
            setDetailModalOpen(false);
            setSelectedEmployeeDetail(null);
          }}
          employee={selectedEmployeeDetail}
          entries={entries.filter(e => e.employee_id === selectedEmployeeDetail.id)}
          allEntries={entries}
          employees={employees}
          from={from}
          to={to}
          onlyOpen={onlyOpen}
          setSelectedEmployee={setSelectedEmployee}
          setFrom={setFrom}
          setTo={setTo}
          setOnlyOpen={setOnlyOpen}
          loadEntries={loadEntries}
          formatHM={formatHM}
        />
      )}

    </div>);

}

/* ====================== Modal de Pago ====================== */
function PaymentModal({ open, onClose, employee, onConfirm }) {
  const [amount, setAmount] = useState(employee.payment.toFixed(2));
  const [type, setType] = useState("salary");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  if (!open) return null;

  const handleSubmit = async () => {
    if (!amount || parseFloat(amount) <= 0) {
      alert("Monto inválido");
      return;
    }
    setSaving(true);
    await onConfirm(amount, type, notes);
    setSaving(false);
  };

  return (
    <div className="fixed inset-0 z-[9999] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-gradient-to-br from-emerald-950 to-green-950 border-2 border-emerald-500/50 rounded-2xl text-white shadow-[0_0_80px_rgba(16,185,129,0.4)]">
        <div className="px-6 py-4 border-b border-emerald-500/30 flex items-center gap-3">
          <DollarSign className="w-6 h-6 text-emerald-400" />
          <h3 className="font-bold text-xl">Procesar Pago</h3>
        </div>

        <div className="p-6 space-y-4">
          <div>
            <label className="text-xs text-emerald-300">Empleado</label>
            <div className="mt-1 text-lg font-bold">{employee.name}</div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs text-emerald-300">Horas</label>
              <div className="mt-1 font-mono text-emerald-400">{employee.hours.toFixed(2)}h</div>
            </div>
            <div>
              <label className="text-xs text-emerald-300">Tarifa/Hora</label>
              <div className="mt-1 font-mono text-emerald-400">${employee.rate.toFixed(2)}</div>
            </div>
          </div>

          <div>
            <label className="text-xs text-emerald-300">Monto a Pagar</label>
            <input
              type="number"
              step="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="mt-1 w-full bg-black/40 border border-emerald-500/30 rounded-lg px-4 py-3 text-xl font-bold text-emerald-400 outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>

          <div>
            <label className="text-xs text-emerald-300">Tipo de Pago</label>
            <select
              value={type}
              onChange={(e) => setType(e.target.value)}
              className="mt-1 w-full bg-black/40 border border-emerald-500/30 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-emerald-500">
              <option value="salary">Salario</option>
              <option value="bonus">Bono</option>
              <option value="commission">Comisión</option>
              <option value="advance">Adelanto</option>
              <option value="other">Otro</option>
            </select>
          </div>

          <div>
            <label className="text-xs text-emerald-300">Notas</label>
            <textarea
              rows={3}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="mt-1 w-full bg-black/40 border border-emerald-500/30 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-emerald-500 resize-none"
              placeholder="Notas adicionales..."
            />
          </div>
        </div>

        <div className="px-6 py-4 border-t border-emerald-500/30 flex justify-end gap-3">
          <Button
            variant="outline"
            onClick={onClose}
            disabled={saving}
            className="border-emerald-500/30 text-emerald-300 hover:bg-emerald-500/10">
            <X className="w-4 h-4 mr-2" />
            Cancelar
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={saving}
            className="bg-gradient-to-r from-emerald-600 to-green-600 hover:from-emerald-700 hover:to-green-700">
            {saving ? "Procesando..." : "Confirmar Pago"}
          </Button>
        </div>
      </div>
    </div>
  );
}

/* ====================== Modal de Detalle de Empleado ====================== */
function EmployeeDetailModal({ open, onClose, employee, entries, formatHM, allEntries, employees, from, to, onlyOpen, setSelectedEmployee, setFrom, setTo, setOnlyOpen, loadEntries }) {
  if (!open) return null;

  const totalMillis = entries.reduce((acc, e) => {
    const start = e.clock_in ? new Date(e.clock_in).getTime() : 0;
    const end = e.clock_out ? new Date(e.clock_out).getTime() : Date.now();
    return acc + Math.max(0, end - start);
  }, 0);

  const currentMillis = employee.currentEntry ? (() => {
    const start = new Date(employee.currentEntry.clock_in).getTime();
    const end = Date.now();
    return end - start;
  })() : 0;

  const openPunches = allEntries.filter(e => !e.clock_out).length;
  const filteredTotalMillis = allEntries.reduce((acc, e) => {
    const start = e.clock_in ? new Date(e.clock_in).getTime() : 0;
    const end = e.clock_out ? new Date(e.clock_out).getTime() : Date.now();
    return acc + Math.max(0, end - start);
  }, 0);

  const setToday = () => {
    const d = new Date();
    const startD = new Date(d);
    startD.setHours(0, 0, 0, 0);
    const endD = new Date(d);
    endD.setHours(23, 59, 59, 999);
    setFrom(startD);
    setTo(endD);
    setTimeout(loadEntries, 100);
  };

  const setThisWeek = () => {
    const d = new Date();
    const day = d.getDay();
    const startD = new Date(d);
    startD.setDate(d.getDate() - day);
    startD.setHours(0, 0, 0, 0);
    const endD = new Date(startD);
    endD.setDate(startD.getDate() + 6);
    endD.setHours(23, 59, 59, 999);
    setFrom(startD);
    setTo(endD);
    setTimeout(loadEntries, 100);
  };

  const setThisMonth = () => {
    const d = new Date();
    const startD = new Date(d.getFullYear(), d.getMonth(), 1);
    const endD = new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59, 999);
    setFrom(startD);
    setTo(endD);
    setTimeout(loadEntries, 100);
  };

  return (
    <div className="fixed inset-0 z-[9999] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="w-full max-w-4xl bg-gradient-to-br from-slate-900 to-black border-2 border-cyan-500/50 rounded-2xl text-white shadow-[0_0_80px_rgba(6,182,212,0.4)] max-h-[90vh] overflow-y-auto">
        <div className="px-6 py-4 border-b border-cyan-500/30 flex items-center justify-between sticky top-0 bg-slate-900/90 backdrop-blur-sm z-10">
          <div className="flex items-center gap-3">
            <Clock className="w-6 h-6 text-cyan-400" />
            <h3 className="font-bold text-xl">{employee.name}</h3>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-white">
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="p-6 space-y-6">
          {/* Filtros */}
          <div className="bg-black/40 border border-white/10 rounded-xl p-4">
            <h4 className="text-white font-bold mb-3 flex items-center gap-2">
              <Filter className="w-5 h-5 text-cyan-400" />
              Filtros
            </h4>
            <div className="space-y-3">
              <div>
                <label className="text-xs text-gray-400 mb-1 block">Empleado</label>
                <select
                  value={employee.id}
                  onChange={(e) => setSelectedEmployee(e.target.value)}
                  className="bg-black/60 text-slate-50 px-3 py-2 text-sm rounded-md w-full border border-white/10">
                  {employees.map((u) => (
                    <option key={u.id} value={u.id}>{u.full_name}</option>
                  ))}
                </select>
              </div>
              
              <div>
                <label className="text-xs text-gray-400 mb-2 block">Rango</label>
                <div className="flex flex-wrap gap-2 mb-2">
                  <button onClick={setToday} className="px-3 py-1.5 bg-cyan-600/20 hover:bg-cyan-600/30 border border-cyan-500/30 rounded-md text-sm text-cyan-300">
                    Hoy
                  </button>
                  <button onClick={setThisWeek} className="px-3 py-1.5 bg-cyan-600/20 hover:bg-cyan-600/30 border border-cyan-500/30 rounded-md text-sm text-cyan-300">
                    Semana
                  </button>
                  <button onClick={setThisMonth} className="px-3 py-1.5 bg-cyan-600/20 hover:bg-cyan-600/30 border border-cyan-500/30 rounded-md text-sm text-cyan-300">
                    Mes
                  </button>
                </div>
                <div className="flex gap-2 items-center">
                  <input
                    type="date"
                    value={from.toISOString().slice(0, 10)}
                    onChange={(e) => { setFrom(new Date(e.target.value)); setTimeout(loadEntries, 100); }}
                    className="bg-black/60 text-slate-50 px-2 py-1.5 text-xs rounded-md border border-white/10 flex-1"
                  />
                  <span className="text-gray-400">→</span>
                  <input
                    type="date"
                    value={to.toISOString().slice(0, 10)}
                    onChange={(e) => { setTo(new Date(e.target.value)); setTimeout(loadEntries, 100); }}
                    className="bg-black/60 text-slate-50 px-2 py-1.5 text-xs rounded-md border border-white/10 flex-1"
                  />
                </div>
              </div>

              <label className="inline-flex items-center gap-2 text-sm text-gray-300">
                <input
                  type="checkbox"
                  className="accent-cyan-600"
                  checked={onlyOpen}
                  onChange={(e) => { setOnlyOpen(e.target.checked); setTimeout(loadEntries, 100); }}
                />
                Mostrar solo abiertos
              </label>
            </div>
          </div>

          {/* Stats Cards */}
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-black/40 border border-cyan-500/30 rounded-xl p-3">
              <p className="text-xs text-cyan-300 mb-1">PONCHES FILTRADOS</p>
              <p className="text-2xl font-bold text-cyan-400">{allEntries.length}</p>
            </div>
            <div className="bg-black/40 border border-emerald-500/30 rounded-xl p-3">
              <p className="text-xs text-emerald-300 mb-1">PONCHES ABIERTOS</p>
              <p className="text-2xl font-bold text-emerald-400">{openPunches}</p>
            </div>
            <div className="bg-black/40 border border-red-500/30 rounded-xl p-3">
              <p className="text-xs text-red-300 mb-1">HORAS EN RANGO</p>
              <p className="text-2xl font-bold text-red-400">{formatHM(filteredTotalMillis)}</p>
            </div>
          </div>

          {employee.currentEntry && (
            <div className="bg-green-500/10 border border-green-500/30 rounded-xl p-4">
              <div className="flex items-center gap-2 mb-2">
                <span className="w-3 h-3 rounded-full bg-green-400 animate-pulse" />
                <p className="text-green-400 font-bold">ACTIVO AHORA</p>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs text-gray-400">Entrada</p>
                  <p className="text-sm font-mono text-white">{fmt(employee.currentEntry.clock_in)}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-400">Tiempo Trabajado</p>
                  <p className="text-lg font-bold text-green-400">{formatHM(currentMillis)}</p>
                </div>
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div className="bg-cyan-500/10 border border-cyan-500/30 rounded-xl p-4">
              <p className="text-xs text-cyan-300 mb-1">Total Ponches</p>
              <p className="text-3xl font-bold text-cyan-400">{entries.length}</p>
            </div>
            <div className="bg-purple-500/10 border border-purple-500/30 rounded-xl p-4">
              <p className="text-xs text-purple-300 mb-1">Total Horas</p>
              <p className="text-3xl font-bold text-purple-400">{formatHM(totalMillis)}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
