import React, { useEffect, useMemo, useState, useCallback } from "react";
import { base44 } from "@/api/base44Client";
import { dataClient } from "@/components/api/dataClient";
import { supabase } from "../../../../../lib/supabase-client.js";
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
const LOCAL_USERS_STORAGE_KEY = "smartfix_local_users";
const LOCAL_TIME_ENTRIES_KEY = "local_time_entries";

function getCurrentTenantId() {
  const fromStorage =
    localStorage.getItem("smartfix_tenant_id") ||
    localStorage.getItem("current_tenant_id");
  if (fromStorage) return fromStorage;

  const sessionCandidates = [
    sessionStorage.getItem("911-session"),
    localStorage.getItem("employee_session"),
    localStorage.getItem("smartfix_session")
  ];

  for (const raw of sessionCandidates) {
    try {
      const parsed = raw ? JSON.parse(raw) : null;
      const tenantId =
        parsed?.tenant_id ||
        parsed?.tenantId ||
        parsed?.user?.tenant_id ||
        parsed?.session?.tenant_id;
      if (tenantId) return tenantId;
    } catch {}
  }

  return null;
}

function getSessionCandidates() {
  return [
    sessionStorage.getItem("911-session"),
    localStorage.getItem("employee_session"),
    localStorage.getItem("smartfix_session")
  ];
}

function readSessionIdentity() {
  for (const raw of getSessionCandidates()) {
    try {
      const parsed = raw ? JSON.parse(raw) : null;
      if (!parsed) continue;
      const email = parsed?.email || parsed?.userEmail || parsed?.user?.email || null;
      const authId = parsed?.auth_id || parsed?.authId || parsed?.id || parsed?.userId || null;
      if (email || authId) {
        return {
          email: String(email || "").trim().toLowerCase() || null,
          authId: authId || null,
        };
      }
    } catch {}
  }
  return { email: null, authId: null };
}

async function resolveTenantIdFromSession() {
  const { email, authId } = readSessionIdentity();

  if (authId) {
    const { data: authUsers } = await supabase
      .from("users")
      .select("tenant_id")
      .eq("auth_id", authId)
      .not("tenant_id", "is", null)
      .limit(1);
    const authTenantId = authUsers?.[0]?.tenant_id || null;
    if (authTenantId) return authTenantId;
  }

  if (email) {
    const [{ data: userRows }, { data: employeeRows }] = await Promise.all([
      supabase
        .from("users")
        .select("tenant_id")
        .eq("email", email)
        .not("tenant_id", "is", null)
        .limit(1),
      supabase
        .from("app_employee")
        .select("tenant_id")
        .eq("email", email)
        .not("tenant_id", "is", null)
        .limit(1)
    ]);

    return userRows?.[0]?.tenant_id || employeeRows?.[0]?.tenant_id || null;
  }

  return null;
}

async function insertSupabaseRecordWithTenantRetry(table, payload) {
  const attempts = [payload];
  if (payload?.tenant_id) {
    const { tenant_id, ...withoutTenant } = payload;
    attempts.push(withoutTenant);
  }

  let lastError = null;
  for (let index = 0; index < attempts.length; index += 1) {
    const { error } = await supabase.from(table).insert(attempts[index]);
    if (!error) return;

    lastError = error;
    const message = String(error?.message || "");
    const retryable =
      index === 0 &&
      payload?.tenant_id &&
      (error?.code === "42501" || /row-level security|policy/i.test(message));

    if (!retryable) break;
  }

  throw lastError || new Error(`${table.toUpperCase()}_INSERT_FAILED`);
}

function normalizeExpenseCategory(category) {
  const validCategories = new Set(["other_expense", "parts", "payroll", "repair_payment", "supplies", "refund"]);
  return validCategories.has(category) ? category : "other_expense";
}

function readLocalFallbackEmployees() {
  try {
    const raw = localStorage.getItem(LOCAL_USERS_STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(parsed)) return [];
    const tenantId = getCurrentTenantId();
    return parsed
      .filter((u) => {
        if (!u || u.active === false) return false;
        if (!tenantId) return true;
        return !u.tenant_id || String(u.tenant_id) === String(tenantId);
      })
      .map((u) => ({
        id: u.id,
        full_name: u.full_name || u.email || "Usuario",
        role: u.role || u.position || "user",
        hourly_rate: u.hourly_rate || 0,
        email: u.email || "",
        employee_code: u.employee_code || "",
        auth_id: u.auth_id || ""
      }))
      .filter((u) => u.id);
  } catch {
    return [];
  }
}

function readLocalTimeEntries() {
  try {
    const raw = localStorage.getItem(LOCAL_TIME_ENTRIES_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

async function fetchRemoteTimeEntriesDirect(limit = 500) {
  const { data, error } = await supabase
    .from("time_entry")
    .select("*")
    .order("clock_in", { ascending: false })
    .limit(limit);

  if (error) throw error;
  return normalizeTimeEntryList(data);
}

function normalizeTimeEntry(payload) {
  if (!payload) return null;
  if (payload.id || payload.employee_id || payload.clock_in) return payload;
  if (payload.data && (payload.data.id || payload.data.employee_id || payload.data.clock_in)) return payload.data;
  if (Array.isArray(payload.items) && payload.items[0]) return payload.items[0];
  if (Array.isArray(payload.data) && payload.data[0]) return payload.data[0];
  return null;
}

function normalizeTimeEntryList(payload) {
  if (Array.isArray(payload)) return payload.map(normalizeTimeEntry).filter(Boolean);
  const single = normalizeTimeEntry(payload);
  return single ? [single] : [];
}

function mergeTimeEntries(remoteEntries = [], localEntries = []) {
  const map = new Map();
  [...localEntries, ...remoteEntries].forEach((entry) => {
    if (!entry?.id) return;
    map.set(String(entry.id), { ...(map.get(String(entry.id)) || {}), ...entry });
  });
  return Array.from(map.values()).sort((a, b) =>
    new Date(b?.clock_in || 0).getTime() - new Date(a?.clock_in || 0).getTime()
  );
}


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
  year: "numeric",
  month: "short",
  day: "numeric",
  hour: "numeric",
  minute: "2-digit",
  hour12: true
});

const SYSTEM_USER_EMAILS = new Set([
  "admin@smartfixos.com",
  "911smartfix@gmail.com",
  "smartfixosapp@gmail.com"
]);

function isSystemUserLike(candidate) {
  const fullName = String(candidate?.full_name || candidate?.employee_name || candidate?.name || "").trim().toLowerCase();
  const role = String(candidate?.role || "").trim().toLowerCase();
  const email = String(candidate?.email || "").trim().toLowerCase();

  if (SYSTEM_USER_EMAILS.has(email)) return true;
  if (role === "super_admin" || role === "saas_owner" || role === "superadmin") return true;
  if (fullName.includes("smartfixos")) return true;
  if (fullName.includes("super admin")) return true;
  return false;
}

function getUserIdentityKeys(user) {
  const keys = [];
  if (user?.id) keys.push(`id:${String(user.id).toLowerCase()}`);
  if (user?.auth_id) keys.push(`auth:${String(user.auth_id).toLowerCase()}`);
  if (user?.email) keys.push(`email:${String(user.email).trim().toLowerCase()}`);
  if (user?.employee_code) keys.push(`code:${String(user.employee_code).trim().toLowerCase()}`);
  return keys;
}

function mergeEmployees(remoteUsers = [], localUsers = []) {
  const merged = [];
  const keyToIndex = new Map();

  for (const candidate of [...(remoteUsers || []), ...(localUsers || [])]) {
    if (!candidate || candidate.active === false || isSystemUserLike(candidate)) continue;

    const keys = getUserIdentityKeys(candidate);
    const existingIndex = keys.map((key) => keyToIndex.get(key)).find((idx) => Number.isInteger(idx));

    if (Number.isInteger(existingIndex)) {
      merged[existingIndex] = {
        ...candidate,
        ...merged[existingIndex],
        full_name: merged[existingIndex]?.full_name || candidate.full_name,
        role: merged[existingIndex]?.role || candidate.role || candidate.position,
        hourly_rate: merged[existingIndex]?.hourly_rate ?? candidate.hourly_rate,
        email: merged[existingIndex]?.email || candidate.email,
        employee_code: merged[existingIndex]?.employee_code || candidate.employee_code,
        tenant_id: merged[existingIndex]?.tenant_id || candidate.tenant_id,
      };
      getUserIdentityKeys(merged[existingIndex]).forEach((key) => keyToIndex.set(key, existingIndex));
      continue;
    }

    const nextIndex = merged.length;
    merged.push(candidate);
    keys.forEach((key) => keyToIndex.set(key, nextIndex));
  }

  return merged;
}

function getWorkedMillis(entry) {
  if (!entry) return 0;
  if (typeof entry.total_hours === "number" && Number.isFinite(entry.total_hours) && entry.clock_out) {
    return Math.max(0, entry.total_hours * 3600000);
  }
  const start = entry.clock_in ? new Date(entry.clock_in).getTime() : 0;
  const end = entry.clock_out ? new Date(entry.clock_out).getTime() : Date.now();
  return Math.max(0, end - start);
}

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
  { value: "transfer", label: "🏦 Dep\u00F3sito Directo", icon: "🏦" },
  { value: "ath_movil", label: "📱 ATH M\u00F3vil", icon: "📱" },
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

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
                  <span className="text-xs font-medium">{method.label}</span>
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
function EmployeeDetailModal({ open, onClose, employee, entries, formatHM, formatHMS, allEntries, employees, from, to, setSelectedEmployee, setFrom, setTo, loadEntries, onPayment, initialTab = "ponches" }) {
  const [activeTab, setActiveTab] = React.useState(initialTab);
  const [paymentHistory, setPaymentHistory] = React.useState([]);
  const [loadingHistory, setLoadingHistory] = React.useState(false);

  React.useEffect(() => {
    if (open) {
      setActiveTab(initialTab);
    }
  }, [open, initialTab]);

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

                </div>
              </div>

              {/* Stats Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
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
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <p className="text-xs text-gray-400">Entrada</p>
                      <p className="text-sm font-mono text-white">{fmt(employee.currentEntry.clock_in)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-400">Tiempo Trabajado</p>
                      <p className="text-lg font-bold text-green-400">{formatHMS(currentMillis)}</p>
                    </div>
                  </div>
                </div>
            }

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
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
  const [nowTick, setNowTick] = useState(Date.now());

  const [from, setFrom] = useState(startOfWeekSunday(new Date()));
  const [to, setTo] = useState(endOfWeekSaturday(new Date()));

  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(false);

  const [editOpen, setEditOpen] = useState(false);
  const [editRow, setEditRow] = useState(null);

  const [activeUsers, setActiveUsers] = useState([]);
  const [paymentModalOpen, setPaymentModalOpen] = useState(false);
  const [selectedEmployeeForPayment, setSelectedEmployeeForPayment] = useState(null);
  const [paidEmployees, setPaidEmployees] = useState(new Set());
  const [detailModalOpen, setDetailModalOpen] = useState(false);
  const [detailModalTab, setDetailModalTab] = useState("ponches");

  /* ---------- cargar usuarios activos ---------- */
  const loadActiveUsers = useCallback(async () => {
    try {
      const payload = await dataClient.entities.TimeEntry.filter({ clock_out: null }, "-clock_in", 50);
      const sdkEntries = normalizeTimeEntryList(payload);
      const directEntries = (await fetchRemoteTimeEntriesDirect(50)).filter((entry) => !entry?.clock_out);
      const recentEntries = mergeTimeEntries(sdkEntries, directEntries);
      const allowedEmployeeIds = new Set(
        employees.filter((emp) => emp.id !== "all").map((emp) => String(emp.id))
      );
      const now = Date.now();
      const active = recentEntries.filter((e) => {
        const clockIn = new Date(e.clock_in).getTime();
        const allowed =
          allowedEmployeeIds.size === 0 || allowedEmployeeIds.has(String(e.employee_id || ""));
        return allowed && now - clockIn < 24 * 3600000 && !isSystemUserLike(e);
      });
      setActiveUsers(active);
    } catch (e) {
      console.error("Error loading active users:", e);
      const now = Date.now();
      const localOpenEntries = readLocalTimeEntries().filter((entry) => entry && !entry.clock_out);
      const active = localOpenEntries.filter((entry) => {
        const clockIn = new Date(entry.clock_in).getTime();
        return now - clockIn < 24 * 3600000 && !isSystemUserLike(entry);
      });
      setActiveUsers(active);
    }
  }, [employees]);

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
      let tenantId = getCurrentTenantId();
      const runQueries = async (currentTenantId) => {
        let usersQuery = supabase
          .from("users")
          .select("id, email, full_name, role, position, employee_code, hourly_rate, active, tenant_id, auth_id")
          .eq("active", true);
        if (currentTenantId) usersQuery = usersQuery.eq("tenant_id", currentTenantId);

        let employeesQuery = supabase
          .from("app_employee")
          .select("id, email, full_name, role, position, employee_code, hourly_rate, active, tenant_id")
          .eq("active", true);
        if (currentTenantId) employeesQuery = employeesQuery.eq("tenant_id", currentTenantId);

        const [{ data: userRows, error: usersError }, { data: employeeRows, error: employeesError }] = await Promise.all([
          usersQuery,
          employeesQuery,
        ]);

        if (usersError) throw usersError;
        if (employeesError) throw employeesError;

        return { userRows: userRows || [], employeeRows: employeeRows || [] };
      };

      let { userRows, employeeRows } = await runQueries(tenantId);

      if ((!userRows.length && !employeeRows.length) && tenantId) {
        const resolvedTenantId = await resolveTenantIdFromSession().catch(() => null);
        if (resolvedTenantId && String(resolvedTenantId) !== String(tenantId)) {
          localStorage.setItem("smartfix_tenant_id", resolvedTenantId);
          localStorage.setItem("current_tenant_id", resolvedTenantId);
          tenantId = resolvedTenantId;
          ({ userRows, employeeRows } = await runQueries(tenantId));
        }
      }

      const merged = mergeEmployees(userRows || [], employeeRows || []);
      const formatted = merged.map((u) => ({
        id: u.id,
        full_name: u.full_name || u.email || "Usuario",
        role: u.position || u.role || "user",
        hourly_rate: u.hourly_rate || 0,
        email: u.email || "",
        employee_code: u.employee_code || "",
        auth_id: u.auth_id || "",
      }));
      setEmployees([{ id: "all", full_name: "Todos", hourly_rate: 0 }, ...formatted]);
    } catch (error) {
      console.error("Error loading employees for time tracking:", error);
      setEmployees([{ id: "all", full_name: "Todos", hourly_rate: 0 }, ...mergeEmployees([], readLocalFallbackEmployees())]);
    }
  }, []);

  useEffect(() => {
    if (open) loadEmployees();
  }, [open, loadEmployees]);

  /* ---------- cargar ponches ---------- */
  const loadEntries = useCallback(async () => {
    setLoading(true);
    try {
      const remotePayload = await dataClient.entities.TimeEntry.filter({}, "-clock_in", 500);
      const sdkEntries = normalizeTimeEntryList(remotePayload);
      const directEntries = await fetchRemoteTimeEntriesDirect(500);
      const mergedEntries = mergeTimeEntries(sdkEntries, directEntries);
      const allowedEmployeeIds = new Set(
        employees.filter((emp) => emp.id !== "all").map((emp) => String(emp.id))
      );
      const tenantEntries = allowedEmployeeIds.size > 0
        ? mergedEntries.filter((entry) => allowedEmployeeIds.has(String(entry?.employee_id || "")))
        : mergedEntries;
      const filteredByEmployee = selectedEmployee === "all"
        ? tenantEntries
        : tenantEntries.filter((t) => String(t?.employee_id || "") === String(selectedEmployee));
      const inRange = filteredByEmployee.filter((t) => {
        const ci = new Date(t.clock_in);
        return ci >= startOfDay(from) && ci <= endOfDay(to) && !isSystemUserLike(t);
      });

      setEntries(inRange);
    } catch (e) {
      console.error(e);
      const localEntries = readLocalTimeEntries().filter((entry) => !isSystemUserLike(entry));
      const filteredByEmployee = selectedEmployee === "all"
        ? localEntries
        : localEntries.filter((t) => String(t?.employee_id || "") === String(selectedEmployee));
      const inRange = filteredByEmployee.filter((t) => {
        const ci = new Date(t.clock_in);
        return ci >= startOfDay(from) && ci <= endOfDay(to) && !isSystemUserLike(t);
      });
      setEntries(inRange);
    } finally {
      setLoading(false);
    }
  }, [selectedEmployee, from, to, employees]);

  useEffect(() => {
    if (open) loadEntries();
  }, [open, loadEntries]);

  useEffect(() => {
    if (!open) return undefined;
    const interval = setInterval(() => setNowTick(Date.now()), 1000);
    return () => clearInterval(interval);
  }, [open]);

  /* ---------- helpers ---------- */
  const totalMillis = (list) =>
  list.reduce((acc, t) => {
    return acc + getWorkedMillis(t);
  }, 0);

  const formatHM = (ms) => {
    const h = Math.floor(ms / 3600000);
    const m = Math.floor(ms % 3600000 / 60000);
    return `${h}h ${m.toString().padStart(2, "0")}m`;
  };

  const formatHMS = (ms) => {
    const h = Math.floor(ms / 3600000);
    const m = Math.floor(ms % 3600000 / 60000);
    const s = Math.floor(ms % 60000 / 1000);
    return `${h}h ${m.toString().padStart(2, "0")}m ${s.toString().padStart(2, "0")}s`;
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
  }, [entries, nowTick]);

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
  }, [entries, employees, paidEmployees, nowTick]);

  const filteredTotalMillis = useMemo(() => totalMillis(entries), [entries, nowTick]);
  const rangeLabel = useMemo(() => {
    return `${from.toLocaleDateString("es-PR", {
      month: "short",
      day: "numeric",
      year: "numeric"
    })} - ${to.toLocaleDateString("es-PR", {
      month: "short",
      day: "numeric",
      year: "numeric"
    })}`;
  }, [from, to]);

  const employeeSummaries = useMemo(() => {
    return employees
      .filter((emp) => emp.id !== "all")
      .map((emp) => {
        const empEntries = entries.filter((entry) => String(entry.employee_id || "") === String(emp.id));
        const activeEntry = activeUsers.find((entry) => String(entry.employee_id || "") === String(emp.id)) || null;
        const millis = totalMillis(empEntries);
        const hours = millis / 3600000;
        const rate = Number(emp.hourly_rate || 0);
        const projectedPay = hours * rate;
        const shifts = empEntries.length;
        const lastEntry = empEntries[0] || null;

        return {
          id: emp.id,
          name: emp.full_name,
          role: emp.role,
          rate,
          hours,
          millis,
          projectedPay,
          shifts,
          activeEntry,
          lastEntry,
          isPaid: paidEmployees.has(emp.id)
        };
      })
      .filter((emp) => emp.shifts > 0 || emp.activeEntry || Number(emp.rate || 0) > 0)
      .sort((a, b) => {
        if (a.activeEntry && !b.activeEntry) return -1;
        if (b.activeEntry && !a.activeEntry) return 1;
        return b.projectedPay - a.projectedPay;
      });
  }, [employees, entries, activeUsers, paidEmployees, nowTick]);

  const payrollProjection = useMemo(() => {
    return employeeSummaries.reduce((sum, emp) => sum + emp.projectedPay, 0);
  }, [employeeSummaries]);

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
      const tenantId = getCurrentTenantId();
      const normalizedPaymentMethod =
        paymentMethod === "ath_movil" ? "transfer" : paymentMethod;
      const normalizedNotes = paymentMethod === "ath_movil"
        ? [notes, "M\u00E9todo real: ATH M\u00F3vil"].filter(Boolean).join(" | ")
        : notes;

      // ✅ 1. Crear registro de pago al empleado
      const employeePaymentPayload = {
        employee_id: selectedEmployeeForPayment.id,
        employee_name: selectedEmployeeForPayment.name,
        employee_code: employees.find((e) => e.id === selectedEmployeeForPayment.id)?.employee_code || "",
        amount: paymentAmount,
        payment_type: type,
        payment_method: normalizedPaymentMethod,
        period_start: from.toISOString(),
        period_end: to.toISOString(),
        notes: normalizedNotes,
        paid_by: currentUser?.id || session?.userId,
        paid_by_name: currentUser?.full_name || session?.userName,
        tenant_id: tenantId
      };

      try {
        await dataClient.entities.EmployeePayment.create(employeePaymentPayload);
      } catch {
        await insertSupabaseRecordWithTenantRetry("employee_payment", employeePaymentPayload);
      }

      // ✅ 2. Registrar como gasto (expense) en transacciones
      const transactionPayload = {
        type: "expense",
        amount: Math.abs(paymentAmount),
        category: normalizeExpenseCategory("payroll"),
        description: `Pago de nómina - ${selectedEmployeeForPayment.name} (${type}) [${paymentMethod}]`,
        payment_method: normalizedPaymentMethod,
        recorded_by: currentUser?.full_name || session?.userName || "Sistema",
        tenant_id: tenantId
      };

      try {
        await dataClient.entities.Transaction.create(transactionPayload);
      } catch {
        await insertSupabaseRecordWithTenantRetry("transaction", transactionPayload);
      }

      // ✅ 3. RESETEAR las horas trabajadas del empleado en el periodo
      // Obtener todos los time entries del empleado en el periodo de pago
      const employeeEntries = await dataClient.entities.TimeEntry.filter({
        employee_id: selectedEmployeeForPayment.id
      });

      // Filtrar solo los que están en el rango de pago
      const entriesInPeriod = employeeEntries.filter((e) => {
        const entryDate = new Date(e.clock_in);
        return entryDate >= from && entryDate <= to;
      });

      // Eliminar los time entries del periodo ya pagado
      for (const entry of entriesInPeriod) {
        try {
          await dataClient.entities.TimeEntry.delete(entry.id);
        } catch {
          const { error } = await supabase.from("time_entry").delete().eq("id", entry.id);
          if (error) throw error;
        }
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
      alert(`Error al procesar el pago${e?.message ? `: ${e.message}` : ""}`);
    }
  };

  const canEditPunch = ["admin", "manager"].includes(session?.userRole);
  const employeeDirectory = useMemo(() => {
    const summaryById = new Map(employeeSummaries.map((emp) => [String(emp.id), emp]));
    return employees
      .filter((emp) => emp.id !== "all")
      .map((emp) => {
        const summary = summaryById.get(String(emp.id));
        return {
          id: emp.id,
          name: emp.full_name,
          role: emp.role,
          rate: Number(emp.hourly_rate || 0),
          shifts: summary?.shifts || 0,
          hours: summary?.hours || 0,
          millis: summary?.millis || 0,
          projectedPay: summary?.projectedPay || 0,
          activeEntry: summary?.activeEntry || activeUsers.find((entry) => String(entry.employee_id) === String(emp.id)) || null,
          lastEntry: summary?.lastEntry || null,
          isPaid: summary?.isPaid || false
        };
      })
      .sort((a, b) => {
        if (a.activeEntry && !b.activeEntry) return -1;
        if (b.activeEntry && !a.activeEntry) return 1;
        if (b.projectedPay !== a.projectedPay) return b.projectedPay - a.projectedPay;
        return String(a.name || "").localeCompare(String(b.name || ""));
      });
  }, [employees, employeeSummaries, activeUsers]);

  const focusedEmployeeId =
    selectedEmployee !== "all"
      ? String(selectedEmployee)
      : String(employeeDirectory[0]?.id || "");

  const focusedEmployee = useMemo(
    () => employeeDirectory.find((emp) => String(emp.id) === focusedEmployeeId) || null,
    [employeeDirectory, focusedEmployeeId]
  );

  const focusedEntries = useMemo(() => {
    if (!focusedEmployee) return [];
    return entries.filter((entry) => String(entry.employee_id || "") === String(focusedEmployee.id));
  }, [entries, focusedEmployee]);

  const focusedPayment = useMemo(() => {
    if (!focusedEmployee) return null;
    return employeePayments.find((emp) => String(emp.id) === String(focusedEmployee.id)) || null;
  }, [employeePayments, focusedEmployee]);

  const openEntriesCount = entries.filter((entry) => !entry.clock_out).length;

  if (!open) return null;

  return (
    <>
    <div className="fixed inset-0 z-[9999] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="w-full max-w-7xl overflow-y-auto rounded-[28px] border border-cyan-500/30 bg-[linear-gradient(180deg,rgba(15,23,42,0.98),rgba(2,6,23,0.98))] text-white shadow-[0_30px_120px_rgba(0,0,0,0.55)] max-h-[95vh]">
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-white/8 bg-slate-950/90 px-6 py-4 backdrop-blur-sm">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-cyan-400/20 bg-cyan-500/10">
              <Clock className="h-6 w-6 text-cyan-300" />
            </div>
            <div>
              <h2 className="text-2xl font-black tracking-tight">Control de Tiempo</h2>
              <p className="text-sm text-slate-400">Horas, turnos y pago del periodo</p>
            </div>
          </div>
          <Button onClick={onClose} variant="ghost" className="rounded-full text-slate-400 hover:text-white">
            <X className="w-6 h-6" />
          </Button>
        </div>

        <div className="p-6 space-y-6">
          <div className="rounded-[26px] border border-white/8 bg-white/[0.03] p-5">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-[0.28em] text-cyan-300/75">Periodo</p>
                <h3 className="mt-2 text-2xl font-black tracking-tight text-white">{rangeLabel}</h3>
                <p className="mt-1 text-sm text-slate-400">Vista operativa conectada al flujo real de ponches y al cálculo de nómina.</p>
              </div>
            </div>

            <div className="mt-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
              <div className="rounded-2xl border border-white/8 bg-black/25 px-4 py-3">
                <p className="text-[11px] uppercase tracking-[0.2em] text-slate-500">Empleados</p>
                <p className="mt-2 text-2xl font-black text-white">{employeeDirectory.length}</p>
              </div>
              <div className="rounded-2xl border border-white/8 bg-black/25 px-4 py-3">
                <p className="text-[11px] uppercase tracking-[0.2em] text-slate-500">Horas</p>
                <p className="mt-2 text-2xl font-black text-fuchsia-300">{formatHM(filteredTotalMillis)}</p>
              </div>
              <div className="rounded-2xl border border-white/8 bg-black/25 px-4 py-3">
                <p className="text-[11px] uppercase tracking-[0.2em] text-slate-500">Abiertos</p>
                <p className="mt-2 text-2xl font-black text-emerald-300">{openEntriesCount}</p>
              </div>
              <div className="rounded-2xl border border-white/8 bg-black/25 px-4 py-3">
                <p className="text-[11px] uppercase tracking-[0.2em] text-slate-500">Nómina</p>
                <p className="mt-2 text-2xl font-black text-amber-300">${payrollProjection.toFixed(2)}</p>
              </div>
            </div>
          </div>

          {activeUsers.length > 0 && (
            <div className="rounded-[24px] border border-emerald-500/20 bg-emerald-500/[0.06] p-4">
              <div className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5 text-emerald-300" />
                <h4 className="text-sm font-bold uppercase tracking-[0.18em] text-emerald-200">En turno ahora</h4>
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                {activeUsers.map((entry) => (
                  <button
                    key={entry.id}
                    onClick={() => setSelectedEmployee(String(entry.employee_id))}
                    className="inline-flex items-center gap-2 rounded-full border border-emerald-400/20 bg-black/20 px-3 py-2 text-sm text-emerald-100 transition hover:bg-black/30"
                  >
                    <span className="h-2.5 w-2.5 rounded-full bg-emerald-400 animate-pulse" />
                    <span>{entry.employee_name}</span>
                    <span className="text-emerald-200/70">
                      {new Date(entry.clock_in).toLocaleTimeString("es-PR", { hour: "numeric", minute: "2-digit", hour12: true })}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="grid gap-6 xl:grid-cols-[360px_minmax(0,1fr)]">
            <div className="rounded-[24px] border border-white/8 bg-white/[0.03] p-4">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-lg font-bold text-white">Equipo</h4>
                  <p className="text-sm text-slate-400">Selecciona un empleado para ver su detalle.</p>
                </div>
                <span className="rounded-full border border-white/10 bg-black/25 px-3 py-1 text-xs text-slate-400">
                  {employeeDirectory.length} empleados
                </span>
              </div>

              <div className="mt-4 space-y-2">
                {employeeDirectory.map((emp) => {
                  const isSelected = String(emp.id) === focusedEmployeeId;
                  return (
                    <button
                      key={emp.id}
                      onClick={() => setSelectedEmployee(String(emp.id))}
                      className={`w-full rounded-2xl border px-4 py-3 text-left transition ${
                        isSelected
                          ? "border-cyan-400/35 bg-cyan-500/10"
                          : "border-white/8 bg-black/20 hover:bg-white/[0.04]"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className={`h-2.5 w-2.5 rounded-full ${emp.activeEntry ? "bg-emerald-400 animate-pulse" : "bg-slate-500"}`} />
                            <p className="truncate font-semibold text-white">{emp.name}</p>
                          </div>
                          <p className="mt-1 text-xs uppercase tracking-[0.16em] text-slate-500">{emp.role || "empleado"}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-bold text-amber-300">${emp.projectedPay.toFixed(2)}</p>
                          <p className="text-xs text-slate-500">{formatHM(emp.millis)}</p>
                        </div>
                      </div>
                    </button>
                  );
                })}
                {!employeeDirectory.length && (
                  <div className="rounded-2xl border border-dashed border-white/10 px-4 py-8 text-center text-sm text-slate-500">
                    No hay empleados disponibles para este tenant.
                  </div>
                )}
              </div>
            </div>

            <div className="rounded-[24px] border border-white/8 bg-white/[0.03] p-4 sm:p-5">
              {focusedEmployee ? (
                <>
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className={`h-3 w-3 rounded-full ${focusedEmployee.activeEntry ? "bg-emerald-400 animate-pulse" : "bg-slate-500"}`} />
                        <h4 className="text-2xl font-black tracking-tight text-white">{focusedEmployee.name}</h4>
                      </div>
                      <p className="mt-1 text-sm uppercase tracking-[0.18em] text-slate-500">{focusedEmployee.role || "empleado"}</p>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      {focusedEmployee.isPaid ? (
                        <span className="rounded-full border border-emerald-400/25 bg-emerald-500/10 px-3 py-2 text-xs font-bold uppercase tracking-[0.18em] text-emerald-300">Pagado</span>
                      ) : (
                        <span className="rounded-full border border-amber-400/25 bg-amber-500/10 px-3 py-2 text-xs font-bold uppercase tracking-[0.18em] text-amber-300">Por pagar</span>
                      )}
                      {focusedEmployee.activeEntry && (
                        <span className="rounded-full border border-emerald-400/25 bg-emerald-500/10 px-3 py-2 text-xs font-bold uppercase tracking-[0.18em] text-emerald-300">En turno</span>
                      )}
                    </div>
                  </div>

                  <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                    <div className="rounded-2xl border border-white/8 bg-black/20 p-4">
                      <p className="text-[11px] uppercase tracking-[0.18em] text-slate-500">Horas</p>
                      <p className="mt-2 text-2xl font-black text-fuchsia-300">{formatHM(focusedEmployee.millis)}</p>
                    </div>
                    <div className="rounded-2xl border border-white/8 bg-black/20 p-4">
                      <p className="text-[11px] uppercase tracking-[0.18em] text-slate-500">Jornadas</p>
                      <p className="mt-2 text-2xl font-black text-white">{focusedEmployee.shifts}</p>
                    </div>
                    <div className="rounded-2xl border border-white/8 bg-black/20 p-4">
                      <p className="text-[11px] uppercase tracking-[0.18em] text-slate-500">Tarifa</p>
                      <p className="mt-2 text-2xl font-black text-emerald-300">{focusedEmployee.rate > 0 ? `$${focusedEmployee.rate.toFixed(2)}` : "--"}</p>
                    </div>
                    <div className="rounded-2xl border border-white/8 bg-black/20 p-4">
                      <p className="text-[11px] uppercase tracking-[0.18em] text-slate-500">Pago</p>
                      <p className="mt-2 text-2xl font-black text-amber-300">${focusedEmployee.projectedPay.toFixed(2)}</p>
                    </div>
                  </div>

                  <div className="mt-5 grid gap-4 lg:grid-cols-[minmax(0,1fr)_240px]">
                    <div className="rounded-2xl border border-white/8 bg-black/20 p-4">
                      <h5 className="text-sm font-bold uppercase tracking-[0.18em] text-slate-400">Actividad del Periodo</h5>
                      <div className="mt-4 space-y-3">
                        <div className="flex items-center justify-between rounded-2xl border border-white/8 bg-white/[0.03] px-4 py-3">
                          <span className="text-slate-400">Última entrada</span>
                          <span className="text-right font-semibold text-white">{focusedEmployee.lastEntry?.clock_in ? fmt(focusedEmployee.lastEntry.clock_in) : "Sin registro"}</span>
                        </div>
                        <div className="flex items-center justify-between rounded-2xl border border-white/8 bg-white/[0.03] px-4 py-3">
                          <span className="text-slate-400">Última salida</span>
                          <span className="text-right font-semibold text-white">{focusedEmployee.lastEntry?.clock_out ? fmt(focusedEmployee.lastEntry.clock_out) : focusedEmployee.activeEntry ? "Turno abierto" : "Sin salida"}</span>
                        </div>
                        <div className="flex items-center justify-between rounded-2xl border border-white/8 bg-white/[0.03] px-4 py-3">
                          <span className="text-slate-400">Registro activo</span>
                          <span className="text-right font-semibold text-white">
                            {focusedEmployee.activeEntry ? formatHMS(getWorkedMillis(focusedEmployee.activeEntry)) : "No activo"}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="rounded-2xl border border-white/8 bg-black/20 p-4">
                      <h5 className="text-sm font-bold uppercase tracking-[0.18em] text-slate-400">Acciones</h5>
                      <div className="mt-4 space-y-2">
                        <Button
                          onClick={() => focusedPayment && handlePayment(focusedPayment)}
                          disabled={!focusedPayment || focusedPayment.hours === 0 || focusedEmployee.isPaid}
                          className="w-full justify-start bg-emerald-600 text-white hover:bg-emerald-500 disabled:opacity-40"
                        >
                          Procesar pago
                        </Button>
                        <Button
                          onClick={() => {
                            setDetailModalTab("pagos");
                            setDetailModalOpen(true);
                          }}
                          variant="outline"
                          className="w-full justify-start border-white/10 bg-black/20 text-white hover:bg-white/5"
                        >
                          Historial
                        </Button>
                      </div>
                    </div>
                  </div>

                  <div className="mt-5">
                    <h5 className="text-sm font-bold uppercase tracking-[0.18em] text-slate-400">Últimas jornadas</h5>
                    <div className="mt-3 overflow-hidden rounded-2xl border border-white/8">
                      <table className="w-full text-sm">
                        <thead className="bg-white/[0.03] text-left text-[11px] uppercase tracking-[0.18em] text-slate-500">
                          <tr>
                            <th className="px-4 py-3">Entrada</th>
                            <th className="px-4 py-3">Salida</th>
                            <th className="px-4 py-3">Duración</th>
                            <th className="px-4 py-3">Estado</th>
                          </tr>
                        </thead>
                        <tbody>
                          {focusedEntries.slice(0, 6).map((entry) => (
                            <tr key={entry.id} className="border-t border-white/6">
                              <td className="px-4 py-3 text-white">{entry.clock_in ? fmt(entry.clock_in) : "--"}</td>
                              <td className="px-4 py-3 text-white">{entry.clock_out ? fmt(entry.clock_out) : "--"}</td>
                              <td className="px-4 py-3 font-semibold text-fuchsia-300">{formatHM(getWorkedMillis(entry))}</td>
                              <td className="px-4 py-3">
                                <span className={`inline-flex rounded-full border px-2.5 py-1 text-[11px] font-bold uppercase tracking-[0.18em] ${
                                  entry.clock_out
                                    ? "border-slate-400/20 bg-slate-500/10 text-slate-300"
                                    : "border-emerald-400/20 bg-emerald-500/10 text-emerald-300"
                                }`}>
                                  {entry.clock_out ? "Cerrado" : "Abierto"}
                                </span>
                              </td>
                            </tr>
                          ))}
                          {!focusedEntries.length && (
                            <tr>
                              <td colSpan={4} className="px-4 py-8 text-center text-slate-500">
                                No hay jornadas para este empleado en el rango seleccionado.
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </>
              ) : (
                <div className="flex min-h-[320px] items-center justify-center rounded-[20px] border border-dashed border-white/10 text-center text-slate-500">
                  Selecciona un empleado para ver detalle.
                </div>
              )}
            </div>
          </div>

      </div>
    </div>

      <EditPunchModal
        open={editOpen}
        onClose={() => setEditOpen(false)}
        punch={editRow}
        onSaved={loadEntries}
      />

      {paymentModalOpen && selectedEmployeeForPayment ? (
        <PaymentModal
          open={paymentModalOpen}
          onClose={() => {
            setPaymentModalOpen(false);
            setSelectedEmployeeForPayment(null);
          }}
          employee={selectedEmployeeForPayment}
          onConfirm={processPayment}
        />
      ) : null}

      {detailModalOpen && focusedEmployee ? (
        <EmployeeDetailModal
          open={detailModalOpen}
          onClose={() => setDetailModalOpen(false)}
          employee={focusedEmployee}
          entries={focusedEntries}
          formatHM={formatHM}
          formatHMS={formatHMS}
          allEntries={focusedEntries}
          employees={employeeDirectory.map((employee) => ({
            id: employee.id,
            full_name: employee.name,
            hourly_rate: employee.rate
          }))}
          from={from}
          to={to}
          setSelectedEmployee={setSelectedEmployee}
          setFrom={setFrom}
          setTo={setTo}
          loadEntries={loadEntries}
          onPayment={handlePayment}
          initialTab={detailModalTab}
        />
      ) : null}
    </>
  );

}
