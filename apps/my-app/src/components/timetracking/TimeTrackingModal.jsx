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
  TrendingUp } from
"lucide-react";

/* ============ Fallback local para lista de empleados ============ */
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
const startOfWeekSunday = (d) => {
  const x = startOfDay(d);
  const day = x.getDay();
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

/* ====================== Modal edición ====================== */
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
      inIso ? new Date(inIso.getTime() - inIso.getTimezoneOffset() * 60000).toISOString().slice(0, 16) : ""
    );
    setClockOut(
      outIso ? new Date(outIso.getTime() - outIso.getTimezoneOffset() * 60000).toISOString().slice(0, 16) : ""
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
    <div className="fixed inset-0 z-[99999] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
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
                className="mt-1 w-full bg-black/40 border border-white/10 rounded-md px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-red-600" />

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
            <label className="text-xs text-gray-400">Justificación (obligatoria)</label>
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
    </div>);

}

/* ====================== Modal de Pago ====================== */
function PaymentModal({ open, onClose, employee, onConfirm }) {
  const [amount, setAmount] = useState(employee.payment.toFixed(2));
  const [type, setType] = useState("salary");
  const [paymentMethod, setPaymentMethod] = useState("cash");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  if (!open) return null;

  const handleSubmit = async () => {
    if (!amount || parseFloat(amount) <= 0) {
      alert("Monto inválido");
      return;
    }
    setSaving(true);
    await onConfirm(amount, type, paymentMethod, notes);
    setSaving(false);
  };

  const paymentMethods = [
  { value: "cash", label: "💵 Efectivo", icon: "💵" },
  { value: "transfer", label: "🏦 Depósito Directo", icon: "🏦" },
  { value: "ath_movil", label: "📱 ATH Móvil", icon: "📱" },
  { value: "check", label: "📝 Cheque", icon: "📝" }];


  return (
    <div className="fixed inset-0 z-[99999] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
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
              className="mt-1 w-full bg-black/40 border border-emerald-500/30 rounded-lg px-4 py-3 text-xl font-bold text-emerald-400 outline-none focus:ring-2 focus:ring-emerald-500" />

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
            <label className="text-xs text-emerald-300 mb-2 block">Método de Pago</label>
            <div className="grid grid-cols-2 gap-2">
              {paymentMethods.map((method) =>
              <button
                key={method.value}
                onClick={() => setPaymentMethod(method.value)}
                className={`p-3 rounded-lg border-2 transition-all flex items-center gap-2 ${
                paymentMethod === method.value ?
                "bg-emerald-500/30 border-emerald-400/60 shadow-lg" :
                "bg-black/20 border-white/10 hover:border-white/20"}`
                }>

                  <span className="text-lg">{method.icon}</span>
                  <span className="text-xs font-medium">{method.label.replace(/[^a-zA-Z\s]/g, '')}</span>
                  {paymentMethod === method.value && <Check className="w-4 h-4 ml-auto text-emerald-400" />}
                </button>
              )}
            </div>
          </div>

          <div>
            <label className="text-xs text-emerald-300">Notas</label>
            <textarea
              rows={3}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="mt-1 w-full bg-black/40 border border-emerald-500/30 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-emerald-500 resize-none"
              placeholder="Notas adicionales..." />

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
    </div>);

}

/* ====================== Modal de Detalle de Empleado ====================== */
function EmployeeDetailModal({ open, onClose, employee, entries, formatHM, allEntries, employees, from, to, onlyOpen, setSelectedEmployee, setFrom, setTo, setOnlyOpen, loadEntries, onPayment }) {
  const [activeTab, setActiveTab] = React.useState("ponches");
  const [paymentHistory, setPaymentHistory] = React.useState([]);
  const [loadingHistory, setLoadingHistory] = React.useState(false);

  React.useEffect(() => {
    if (open && activeTab === "pagos" && employee?.id) {
      loadPaymentHistory();
    }
  }, [open, activeTab, employee?.id, from, to]);

  const loadPaymentHistory = async () => {
    if (!employee?.id) return;
    setLoadingHistory(true);
    try {
      const payments = await base44.entities.EmployeePayment.filter(
        { employee_id: employee.id },
        "-created_date",
        100
      );
      setPaymentHistory(payments || []);
    } catch (error) {
      console.error("Error loading payment history:", error);
      setPaymentHistory([]);
    } finally {
      setLoadingHistory(false);
    }
  };

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

  const openPunches = allEntries.filter((e) => !e.clock_out).length;
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

  // Calcular pago para el periodo actual
  const employeeData = employees.find((e) => e.id === employee.id);
  const hourlyRate = parseFloat(employeeData?.hourly_rate) || 0;
  const totalHours = filteredTotalMillis / 3600000;
  const calculatedPayment = totalHours * hourlyRate;

  return (
    <div className="fixed inset-0 z-[99999] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
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

        {/* Tabs */}
        <div className="border-b border-white/10 px-6">
          <div className="flex gap-1">
            <button
              onClick={() => setActiveTab("ponches")}
              className={`px-4 py-3 text-sm font-semibold transition-all relative ${
              activeTab === "ponches" ?
              "text-cyan-400" :
              "text-gray-400 hover:text-gray-300"}`
              }>

              Ponches & Horas
              {activeTab === "ponches" &&
              <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-cyan-400" />
              }
            </button>
            <button
              onClick={() => setActiveTab("pagos")}
              className={`px-4 py-3 text-sm font-semibold transition-all relative ${
              activeTab === "pagos" ?
              "text-emerald-400" :
              "text-gray-400 hover:text-gray-300"}`
              }>

              Pagos & Nómina
              {activeTab === "pagos" &&
              <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-emerald-400" />
              }
            </button>
          </div>
        </div>

        <div className="p-6 space-y-6">
          {/* Tab Content: Ponches */}
          {activeTab === "ponches" &&
          <>
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

                      {employees.map((u) =>
                    <option key={u.id} value={u.id}>{u.full_name}</option>
                    )}
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
                      onChange={(e) => {setFrom(new Date(e.target.value));setTimeout(loadEntries, 100);}}
                      className="bg-black/60 text-slate-50 px-2 py-1.5 text-xs rounded-md border border-white/10 flex-1" />

                      <span className="text-gray-400">→</span>
                      <input
                      type="date"
                      value={to.toISOString().slice(0, 10)}
                      onChange={(e) => {setTo(new Date(e.target.value));setTimeout(loadEntries, 100);}}
                      className="bg-black/60 text-slate-50 px-2 py-1.5 text-xs rounded-md border border-white/10 flex-1" />

                    </div>
                  </div>

                  <label className="inline-flex items-center gap-2 text-sm text-gray-300">
                    <input
                    type="checkbox"
                    className="accent-cyan-600"
                    checked={onlyOpen}
                    onChange={(e) => {setOnlyOpen(e.target.checked);setTimeout(loadEntries, 100);}} />

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

              {employee.currentEntry &&
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
            }

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
            </>
          }

          {/* Tab Content: Pagos */}
          {activeTab === "pagos" &&
          <>
              {/* Filtros de Periodo */}
              <div className="bg-black/40 border border-white/10 rounded-xl p-4">
                <h4 className="text-white font-bold mb-3 flex items-center gap-2">
                  <Filter className="w-5 h-5 text-emerald-400" />
                  Periodo de Pago
                </h4>
                <div className="flex flex-wrap gap-2 mb-3">
                  <button onClick={setToday} className="px-3 py-1.5 bg-emerald-600/20 hover:bg-emerald-600/30 border border-emerald-500/30 rounded-md text-sm text-emerald-300">
                    Hoy
                  </button>
                  <button onClick={setThisWeek} className="px-3 py-1.5 bg-emerald-600/20 hover:bg-emerald-600/30 border border-emerald-500/30 rounded-md text-sm text-emerald-300">
                    Semana
                  </button>
                  <button onClick={setThisMonth} className="px-3 py-1.5 bg-emerald-600/20 hover:bg-emerald-600/30 border border-emerald-500/30 rounded-md text-sm text-emerald-300">
                    Mes
                  </button>
                </div>
                <div className="flex gap-2 items-center">
                  <input
                  type="date"
                  value={from.toISOString().slice(0, 10)}
                  onChange={(e) => {setFrom(new Date(e.target.value));setTimeout(loadEntries, 100);}}
                  className="bg-black/60 text-slate-50 px-2 py-1.5 text-xs rounded-md border border-white/10 flex-1" />

                  <span className="text-gray-400">→</span>
                  <input
                  type="date"
                  value={to.toISOString().slice(0, 10)}
                  onChange={(e) => {setTo(new Date(e.target.value));setTimeout(loadEntries, 100);}}
                  className="bg-black/60 text-slate-50 px-2 py-1.5 text-xs rounded-md border border-white/10 flex-1" />

                </div>
              </div>

              {/* Cálculo de Pago Actual */}
              <div className="bg-gradient-to-br from-emerald-950/40 to-green-950/40 border border-emerald-500/30 rounded-xl p-6">
                <h4 className="text-emerald-400 text-lg font-bold mb-4 flex items-center gap-2">
                  <DollarSign className="w-6 h-6" />
                  Pago Calculado - Periodo Actual
                </h4>

                <div className="grid grid-cols-3 gap-4 mb-4">
                  <div className="bg-black/40 border border-emerald-500/20 rounded-lg p-3">
                    <p className="text-xs text-emerald-300 mb-1">Horas Trabajadas</p>
                    <p className="text-2xl font-bold text-white">{totalHours.toFixed(2)}h</p>
                  </div>
                  <div className="bg-black/40 border border-emerald-500/20 rounded-lg p-3">
                    <p className="text-xs text-emerald-300 mb-1">Tarifa/Hora</p>
                    <p className="text-2xl font-bold text-white">${hourlyRate.toFixed(2)}</p>
                  </div>
                  <div className="bg-black/40 border border-emerald-500/20 rounded-lg p-3">
                    <p className="text-xs text-emerald-300 mb-1">Total a Pagar</p>
                    <p className="text-2xl font-bold text-emerald-400">${calculatedPayment.toFixed(2)}</p>
                  </div>
                </div>

                {hourlyRate > 0 && calculatedPayment > 0 ?
              <Button
                onClick={() => onPayment?.({
                  id: employee.id,
                  name: employee.name,
                  hours: totalHours,
                  rate: hourlyRate,
                  payment: calculatedPayment
                })}
                disabled={totalHours === 0}
                className="w-full bg-gradient-to-r from-emerald-600 to-green-600 hover:from-emerald-700 hover:to-green-700 text-white h-12 disabled:opacity-50 disabled:cursor-not-allowed">

                    <DollarSign className="w-5 h-5 mr-2" />
                    {totalHours === 0 ? "Sin Horas - Pagado" : "Procesar Pago"}
                  </Button> :

              <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-3 text-center">
                    <p className="text-yellow-400 text-sm">
                      {hourlyRate === 0 ?
                  "⚠️ Configure la tarifa por hora en Settings → Users" :
                  "Sin horas trabajadas en este periodo"}
                    </p>
                  </div>
              }
              </div>

              {/* Historial de Pagos */}
              <div className="bg-black/40 border border-white/10 rounded-xl p-4">
                <div className="flex items-center justify-between mb-4">
                  <h4 className="text-white font-bold flex items-center gap-2">
                    <TrendingUp className="w-5 h-5 text-emerald-400" />
                    Historial de Pagos
                  </h4>
                  <Button
                  onClick={loadPaymentHistory}
                  size="sm"
                  variant="outline" className="bg-background text-slate-900 px-3 text-xs font-medium rounded-md inline-flex items-center justify-center gap-2 whitespace-nowrap transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 border shadow-sm hover:bg-accent hover:text-accent-foreground border-white/15 h-7"

                  disabled={loadingHistory}>

                    <RefreshCcw className={`w-3.5 h-3.5 ${loadingHistory ? 'animate-spin' : ''}`} />
                  </Button>
                </div>

                {loadingHistory ?
              <div className="text-center py-8 text-gray-400">Cargando...</div> :
              paymentHistory.length === 0 ?
              <div className="text-center py-8 text-gray-400">
                    <DollarSign className="w-12 h-12 mx-auto mb-2 opacity-30" />
                    <p>No hay pagos registrados</p>
                  </div> :

              <div className="space-y-2 max-h-[400px] overflow-y-auto">
                    {paymentHistory.map((payment) =>
                <div
                  key={payment.id}
                  className="bg-black/40 border border-emerald-500/10 rounded-lg p-3 hover:bg-emerald-500/5 transition-colors">

                        <div className="flex items-start justify-between mb-2">
                          <div>
                            <p className="text-white font-semibold">${parseFloat(payment.amount || 0).toFixed(2)}</p>
                            <p className="text-xs text-gray-400">
                              {new Date(payment.created_date).toLocaleDateString('es-PR', {
                          year: 'numeric',
                          month: 'short',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit'
                        })}
                            </p>
                          </div>
                          <div className="text-right">
                            <span className="px-2 py-1 bg-emerald-500/20 text-emerald-300 text-xs rounded">
                              {payment.payment_type || 'salary'}
                            </span>
                          </div>
                        </div>
                        {payment.period_start && payment.period_end &&
                  <p className="text-xs text-gray-500">
                            Periodo: {new Date(payment.period_start).toLocaleDateString('es-PR')} - {new Date(payment.period_end).toLocaleDateString('es-PR')}
                          </p>
                  }
                        {payment.notes &&
                  <p className="text-xs text-gray-400 mt-1">{payment.notes}</p>
                  }
                        {payment.paid_by_name &&
                  <p className="text-xs text-gray-500 mt-1">Procesado por: {payment.paid_by_name}</p>
                  }
                      </div>
                )}
                  </div>
              }
              </div>
            </>
          }
        </div>
      </div>
    </div>);

}

/* ====================== MODAL PRINCIPAL ====================== */
export default function TimeTrackingModal({ open, onClose, session }) {
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
  const [selectedEmployeeDetail, setSelectedEmployeeDetail] = useState(null);
  const [paidEmployees, setPaidEmployees] = useState(new Set());

  /* ---------- cargar usuarios activos ---------- */
  const loadActiveUsers = useCallback(async () => {
    try {
      const recentEntries = await base44.entities.TimeEntry.filter({ clock_out: null }, "-clock_in", 50);
      const now = Date.now();
      const active = recentEntries.filter((e) => {
        const clockIn = new Date(e.clock_in).getTime();
        return now - clockIn < 24 * 3600000;
      });
      setActiveUsers(active);
    } catch (e) {
      console.error("Error loading active users:", e);
      setActiveUsers([]);
    }
  }, []);

  useEffect(() => {
    if (open && (session?.userRole === "admin" || session?.userRole === "manager")) {
      loadActiveUsers();
      const interval = setInterval(loadActiveUsers, 30000);
      return () => clearInterval(interval);
    }
  }, [open, session, loadActiveUsers]);

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
    if (open) loadEmployees();
  }, [open, loadEmployees]);

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
    if (open) loadEntries();
  }, [open, loadEntries]);

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
        weekLabel: `${s.toLocaleDateString("es-PR", { month: "short", day: "numeric" })} – ${e.toLocaleDateString("es-PR", { month: "short", day: "numeric" })}`,
        range: [s, e],
        total: arr.length,
        open: arr.filter((t) => !t.clock_out).length,
        millis: totalMillis(arr)
      };
    });
  }, [entries]);

  const employeePayments = useMemo(() => {
    const paymentMap = new Map();

    entries.forEach((entry) => {
      if (!entry.employee_id) return;

      const employee = employees.find((e) => e.id === entry.employee_id);
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

    return Array.from(paymentMap.entries()).
    map(([id, data]) => ({ id, ...data })).
    filter((emp) => !paidEmployees.has(emp.id)).
    sort((a, b) => b.payment - a.payment);
  }, [entries, employees, paidEmployees]);

  const filteredTotalMillis = useMemo(() => totalMillis(entries), [entries]);

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

  const handlePayment = async (employeeData) => {
    setSelectedEmployeeForPayment(employeeData);
    setPaymentModalOpen(true);
  };

  const loadPaidEmployees = useCallback(async () => {
    try {
      const payments = await base44.entities.EmployeePayment.filter({
        period_start: from.toISOString(),
        period_end: to.toISOString()
      });
      const paidIds = new Set(payments.map((p) => p.employee_id));
      setPaidEmployees(paidIds);
    } catch (e) {
      console.error("Error loading paid employees:", e);
    }
  }, [from, to]);

  useEffect(() => {
    if (open) loadPaidEmployees();
  }, [open, loadPaidEmployees, from, to]);

  const processPayment = async (amount, type, paymentMethod, notes) => {
    if (!selectedEmployeeForPayment) return;

    try {
      const paymentAmount = parseFloat(amount);
      const currentUser = await base44.auth.me();

      // ✅ 1. Crear registro de pago al empleado
      await base44.entities.EmployeePayment.create({
        employee_id: selectedEmployeeForPayment.id,
        employee_name: selectedEmployeeForPayment.name,
        employee_code: employees.find((e) => e.id === selectedEmployeeForPayment.id)?.employee_code || "",
        amount: paymentAmount,
        payment_type: type,
        payment_method: paymentMethod,
        period_start: from.toISOString(),
        period_end: to.toISOString(),
        notes: notes,
        paid_by: currentUser?.id || session?.userId,
        paid_by_name: currentUser?.full_name || session?.userName
      });

      // ✅ 2. Registrar como gasto (expense) en transacciones
      await base44.entities.Transaction.create({
        type: "expense",
        amount: paymentAmount,
        category: "payroll",
        description: `Pago de nómina - ${selectedEmployeeForPayment.name} (${type}) [${paymentMethod}]`,
        payment_method: paymentMethod,
        recorded_by: currentUser?.full_name || session?.userName || "Sistema"
      });

      // ✅ 3. RESETEAR las horas trabajadas del empleado en el periodo
      // Obtener todos los time entries del empleado en el periodo de pago
      const employeeEntries = await base44.entities.TimeEntry.filter({
        employee_id: selectedEmployeeForPayment.id
      });

      // Filtrar solo los que están en el rango de pago
      const entriesInPeriod = employeeEntries.filter((e) => {
        const entryDate = new Date(e.clock_in);
        return entryDate >= from && entryDate <= to;
      });

      // Eliminar los time entries del periodo ya pagado
      for (const entry of entriesInPeriod) {
        await base44.entities.TimeEntry.delete(entry.id);
      }

      // ✅ 4. Marcar como pagado en el estado local
      setPaidEmployees((prev) => new Set([...prev, selectedEmployeeForPayment.id]));

      setPaymentModalOpen(false);
      setSelectedEmployeeForPayment(null);
      await loadPaidEmployees();
      await loadEntries();
      await loadActiveUsers();

      // ✅ 5. Notificar al sistema para actualizar stats
      window.dispatchEvent(new Event('expense-created'));

    } catch (e) {
      console.error("Error processing payment:", e);
      alert("Error al procesar el pago");
    }
  };

  const canEditPunch = ["admin", "manager"].includes(session?.userRole);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[9999] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="w-full max-w-7xl bg-gradient-to-br from-slate-900 to-black border-2 border-cyan-500/50 rounded-2xl text-white shadow-[0_0_80px_rgba(6,182,212,0.4)] max-h-[95vh] overflow-y-auto">
        {/* Header */}
        <div className="px-6 py-4 border-b border-cyan-500/30 flex items-center justify-between sticky top-0 bg-slate-900/90 backdrop-blur-sm z-10">
          <div className="flex items-center gap-3">
            <Clock className="w-7 h-7 text-cyan-400" />
            <div>
              <h2 className="font-bold text-2xl">Control de Tiempo</h2>
              <p className="text-gray-400 text-sm">Registro de ponches y horas trabajadas</p>
            </div>
          </div>
          <Button onClick={onClose} variant="ghost" className="text-gray-400 hover:text-white">
            <X className="w-6 h-6" />
          </Button>
        </div>

        <div className="p-6 space-y-6">
          {/* Todos los Empleados */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Usuarios Activos */}
            {activeUsers.length > 0 &&
            <div className="bg-gradient-to-r from-green-950/40 to-emerald-950/40 border border-green-500/30 rounded-xl p-4">
                <h4 className="text-green-400 text-lg font-bold flex items-center gap-2 mb-3">
                  <TrendingUp className="w-5 h-5" />
                  Activos Ahora ({activeUsers.length})
                </h4>
                <div className="flex flex-wrap gap-2">
                  {activeUsers.map((entry) =>
                <button
                  key={entry.id}
                  onClick={() => {
                    setSelectedEmployeeDetail({
                      id: entry.employee_id,
                      name: entry.employee_name,
                      currentEntry: entry
                    });
                  }}
                  className="px-4 py-2 bg-green-500/20 hover:bg-green-500/30 border border-green-500/40 rounded-lg text-green-300 text-sm font-semibold transition-all flex items-center gap-2">

                      <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
                      {entry.employee_name}
                    </button>
                )}
                </div>
              </div>
            }

            {/* Todos los Empleados */}
            <div className="bg-gradient-to-r from-cyan-950/40 to-blue-950/40 border border-cyan-500/30 rounded-xl p-4">
              <h4 className="text-cyan-400 text-lg font-bold flex items-center gap-2 mb-3">
                <Clock className="w-5 h-5" />
                Todos los Empleados ({employees.filter((e) => e.id !== "all").length})
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {employees.filter((e) => e.id !== "all").map((emp) => {
                  const isActive = activeUsers.some((a) => a.employee_id === emp.id);
                  const activeEntry = activeUsers.find((a) => a.employee_id === emp.id);
                  const empEntries = entries.filter((e) => e.employee_id === emp.id);
                  const totalHours = formatHM(totalMillis(empEntries));

                  return (
                    <button
                      key={emp.id}
                      onClick={() => {
                        setSelectedEmployeeDetail({
                          id: emp.id,
                          name: emp.full_name,
                          currentEntry: activeEntry || null
                        });
                      }}
                      className={`p-4 border rounded-xl text-left transition-all hover:scale-105 ${
                      isActive ?
                      'bg-green-500/10 hover:bg-green-500/20 border-green-500/40' :
                      'bg-cyan-500/5 hover:bg-cyan-500/10 border-cyan-500/20'}`
                      }>

                      <div className="flex items-start justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <span className={`w-3 h-3 rounded-full ${isActive ? 'bg-green-400 animate-pulse' : 'bg-gray-500'}`} />
                          <span className={`font-bold ${isActive ? 'text-green-300' : 'text-cyan-300'}`}>
                            {emp.full_name}
                          </span>
                        </div>
                      </div>
                      
                      {isActive && activeEntry &&
                      <div className="text-xs text-green-400 mb-2 flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          Entró: {new Date(activeEntry.clock_in).toLocaleTimeString('es-PR', { hour: '2-digit', minute: '2-digit' })}
                        </div>
                      }
                      
                      <div className="grid grid-cols-2 gap-2 text-xs">
                        <div>
                          <p className="text-gray-400">Ponches</p>
                          <p className="text-white font-bold">{empEntries.length}</p>
                        </div>
                        <div>
                          <p className="text-gray-400">Horas</p>
                          <p className="text-white font-bold">{totalHours}</p>
                        </div>
                      </div>
                      
                      {emp.hourly_rate > 0 &&
                      <div className="mt-2 pt-2 border-t border-white/10">
                          <p className="text-xs text-gray-400">Tarifa</p>
                          <p className="text-emerald-400 font-bold">${emp.hourly_rate}/hr</p>
                        </div>
                      }
                    </button>);

                })}
              </div>
            </div>
          </div>

          {/* Detalles del empleado seleccionado */}
          {selectedEmployeeDetail &&
          <EmployeeDetailModal
            open={!!selectedEmployeeDetail}
            onClose={() => setSelectedEmployeeDetail(null)}
            employee={selectedEmployeeDetail}
            entries={entries.filter((e) => e.employee_id === selectedEmployeeDetail.id)}
            formatHM={formatHM}
            allEntries={entries.filter((e) => e.employee_id === selectedEmployeeDetail.id)}
            employees={employees}
            from={from}
            to={to}
            onlyOpen={onlyOpen}
            setSelectedEmployee={(id) => {
              const emp = employees.find((e) => e.id === id);
              const empEntry = activeUsers.find((a) => a.employee_id === id);
              if (emp) {
                setSelectedEmployeeDetail({
                  id: emp.id,
                  name: emp.full_name,
                  currentEntry: empEntry || null
                });
              }
            }}
            setFrom={setFrom}
            setTo={setTo}
            setOnlyOpen={setOnlyOpen}
            loadEntries={loadEntries}
            onPayment={handlePayment} />

          }

          {/* Filtros */}
          <div className="bg-black/40 border border-white/10 rounded-xl p-4">
            <h4 className="text-white font-bold text-lg mb-3">Filtros</h4>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div>
                <label className="text-xs text-gray-400 mb-1 block">Empleado</label>
                <select
                  value={selectedEmployee}
                  onChange={(e) => setSelectedEmployee(e.target.value)}
                  className="bg-black/40 text-slate-50 px-3 py-2 text-sm rounded-md w-full border border-white/10">

                  {employees.map((u) =>
                  <option key={u.id} value={u.id}>{u.full_name}</option>
                  )}
                </select>
              </div>

              <div className="md:col-span-2">
                <label className="text-xs text-gray-400 mb-1 block">Rango</label>
                <div className="flex flex-wrap items-center gap-2">
                  <div className="flex items-center bg-black/40 border border-white/10 rounded-md overflow-hidden">
                    <button onClick={setToday} className="text-slate-50 px-3 py-2 text-sm hover:bg-white/5 flex items-center gap-1">
                      <CalendarDays className="w-4 h-4" /> Hoy
                    </button>
                    <button onClick={setThisWeek} className="text-slate-50 px-3 py-2 text-sm hover:bg-white/5 border-l border-white/10">
                      Domingo–Sábado
                    </button>
                    <button onClick={setThisMonth} className="text-slate-50 px-3 py-2 text-sm hover:bg-white/5 border-l border-white/10">
                      Mes
                    </button>
                  </div>

                  <input
                    type="date"
                    value={startOfDay(from).toISOString().slice(0, 10)}
                    onChange={(e) => setFrom(new Date(e.target.value))}
                    className="bg-black/40 text-slate-50 px-3 py-2 text-sm rounded-md border border-white/10" />

                  <span className="text-gray-400">→</span>
                  <input
                    type="date"
                    value={startOfDay(to).toISOString().slice(0, 10)}
                    onChange={(e) => setTo(new Date(e.target.value))}
                    className="bg-black/40 text-slate-50 px-3 py-2 text-sm rounded-md border border-white/10" />


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
          </div>

          {/* KPIs */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-black/40 border border-cyan-500/30 rounded-xl p-4">
              <p className="text-xs text-cyan-300 uppercase mb-1">Ponches filtrados</p>
              <p className="text-3xl font-bold text-cyan-400">{entries.length}</p>
            </div>
            <div className="bg-black/40 border border-emerald-500/30 rounded-xl p-4">
              <p className="text-xs text-emerald-300 uppercase mb-1">Ponches abiertos</p>
              <p className="text-3xl font-bold text-emerald-400">
                {entries.filter((e) => !e.clock_out).length}
              </p>
            </div>
            <div className="bg-black/40 border border-red-500/30 rounded-xl p-4">
              <p className="text-xs text-red-300 uppercase mb-1">Horas en el rango</p>
              <p className="text-3xl font-bold text-red-400">
                {formatHM(filteredTotalMillis)}
              </p>
            </div>
          </div>

          {/* Pagos Calculados */}
          {employeePayments.length > 0 &&
          <div className="bg-gradient-to-br from-emerald-950/40 to-green-950/40 border border-emerald-500/30 rounded-xl p-4">
              <h3 className="text-emerald-400 text-xl font-bold mb-2 flex items-center gap-2">
                <DollarSign className="w-6 h-6" />
                Pagos Calculados
              </h3>
              <p className="text-gray-400 text-sm mb-4">Basado en horas trabajadas y tarifa por hora</p>
              
              <div className="overflow-x-auto">
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
                    {employeePayments.map((emp) =>
                  <tr key={emp.id} className="border-t border-emerald-500/10 hover:bg-emerald-500/5 transition-colors">
                        <td className="text-slate-50 pr-4 py-3 font-medium">{emp.name}</td>
                        <td className="text-slate-50 pr-4 py-3 text-right font-mono">{emp.hours.toFixed(2)}h</td>
                        <td className="text-slate-50 pr-4 py-3 text-right font-mono">${emp.rate.toFixed(2)}</td>
                        <td className="text-emerald-400 pr-4 py-3 text-right font-bold text-lg">${emp.payment.toFixed(2)}</td>
                        <td className="py-3 text-center">
                          <Button
                        onClick={() => handlePayment(emp)}
                        size="sm"
                        disabled={paidEmployees.has(emp.id) || emp.hours === 0}
                        className="bg-gradient-to-r from-emerald-600 to-green-600 hover:from-emerald-700 hover:to-green-700 text-white disabled:opacity-50 disabled:cursor-not-allowed">

                            {paidEmployees.has(emp.id) ?
                        <>
                                <Check className="w-4 h-4 mr-1" />
                                Pagado
                              </> :
                        emp.hours === 0 ?
                        "Sin Horas" :

                        <>
                                <DollarSign className="w-4 h-4 mr-1" />
                                Pagar
                              </>
                        }
                          </Button>
                        </td>
                      </tr>
                  )}
                    <tr className="border-t-2 border-emerald-500/30">
                      <td className="text-emerald-400 pr-4 py-3 font-bold" colSpan={3}>TOTAL A PAGAR</td>
                      <td className="text-emerald-400 py-3 text-right font-black text-xl">
                        ${employeePayments.reduce((sum, e) => sum + e.payment, 0).toFixed(2)}
                      </td>
                      <td></td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          }


        </div>
      </div>

      {/* Modal edición */}
      <EditPunchModal
        open={editOpen}
        onClose={() => setEditOpen(false)}
        punch={editRow}
        onSaved={loadEntries} />


      {/* Modal de pago */}
      {paymentModalOpen && selectedEmployeeForPayment &&
      <PaymentModal
        open={paymentModalOpen}
        onClose={() => {
          setPaymentModalOpen(false);
          setSelectedEmployeeForPayment(null);
        }}
        employee={selectedEmployeeForPayment}
        onConfirm={processPayment} />

      }

    </div>);

}
