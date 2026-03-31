import React, { useEffect, useMemo, useState, useCallback } from "react";
import { dataClient } from "@/components/api/dataClient";
import { supabase } from "../../../../lib/supabase-client.js";
import {
  RefreshCcw, Clock, DollarSign, Check, X, Edit3,
  Users, TrendingUp, ChevronDown, ChevronUp, Search,
  CalendarDays, Zap
} from "lucide-react";
import { toast } from "sonner";

/* ─────────────── helpers locales ─────────────── */
const LOCAL_USERS_KEY = "smartfix_local_users";
const LOCAL_ENTRIES_KEY = "local_time_entries";

function readLocalEmployees() {
  try {
    const raw = localStorage.getItem(LOCAL_USERS_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed)
      ? parsed.filter(u => u?.active !== false).map(u => ({
          id: u.id, full_name: u.full_name || u.email || "Usuario",
          role: u.role || u.position || "user", hourly_rate: u.hourly_rate || 0
        })).filter(u => u.id)
      : [];
  } catch { return []; }
}

function readLocalEntries() {
  try {
    const raw = localStorage.getItem(LOCAL_ENTRIES_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch { return []; }
}

function mergeEntries(remote = [], local = []) {
  const map = new Map();
  [...local, ...remote].forEach(e => { if (e?.id) map.set(String(e.id), { ...(map.get(String(e.id)) || {}), ...e }); });
  return Array.from(map.values()).sort((a, b) => new Date(b.clock_in || 0) - new Date(a.clock_in || 0));
}

function getCurrentTenantId() {
  const direct = localStorage.getItem("smartfix_tenant_id") || localStorage.getItem("current_tenant_id");
  if (direct) return direct;
  for (const key of ["911-session", "employee_session", "smartfix_session"]) {
    const raw = key === "911-session" ? sessionStorage.getItem(key) : localStorage.getItem(key);
    try {
      const p = raw ? JSON.parse(raw) : null;
      const tid = p?.tenant_id || p?.tenantId || p?.user?.tenant_id;
      if (tid) return tid;
    } catch {}
  }
  return null;
}

const sod = (d) => { const x = new Date(d); x.setHours(0,0,0,0); return x; };
const eod = (d) => { const x = new Date(d); x.setHours(23,59,59,999); return x; };
const sowSun = (d) => { const x = sod(d); x.setDate(x.getDate() - x.getDay()); return x; };
const eowSat = (d) => { const x = sowSun(d); x.setDate(x.getDate() + 6); x.setHours(23,59,59,999); return x; };

function fmtHM(ms) {
  const h = Math.floor(ms / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  return `${h}h ${String(m).padStart(2,"0")}m`;
}
function fmtHMS(ms) {
  const h = Math.floor(ms / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  const s = Math.floor((ms % 60000) / 1000);
  return `${h}h ${String(m).padStart(2,"0")}m ${String(s).padStart(2,"0")}s`;
}
function fmtTime(iso) {
  try { return new Date(iso).toLocaleTimeString("es-PR",{hour:"2-digit",minute:"2-digit"}); } catch { return "—"; }
}
function fmtDate(iso) {
  try { return new Date(iso).toLocaleDateString("es-PR",{weekday:"short",month:"short",day:"numeric"}); } catch { return "—"; }
}

/* ─────────────── Modal Editar Ponche ─────────────── */
function EditPunchModal({ punch, onClose, onSaved }) {
  const [clockIn, setClockIn]   = useState("");
  const [clockOut, setClockOut] = useState("");
  const [note, setNote]         = useState("");
  const [saving, setSaving]     = useState(false);
  const [err, setErr]           = useState("");

  useEffect(() => {
    if (!punch) return;
    const toLocal = (iso) => iso
      ? new Date(new Date(iso).getTime() - new Date(iso).getTimezoneOffset()*60000).toISOString().slice(0,16)
      : "";
    setClockIn(toLocal(punch.clock_in));
    setClockOut(toLocal(punch.clock_out));
    setNote(""); setErr("");
  }, [punch]);

  const handleSave = async () => {
    if (!note.trim()) { setErr("Escribe una justificación."); return; }
    if (!clockIn)     { setErr("La entrada es obligatoria."); return; }
    setSaving(true); setErr("");
    try {
      await dataClient.entities.TimeEntry.update(punch.id, {
        clock_in:  new Date(clockIn).toISOString(),
        clock_out: clockOut ? new Date(clockOut).toISOString() : null,
        edited_at: new Date().toISOString()
      });
      onSaved?.(); onClose?.();
    } catch (e) { setErr("No se pudo guardar."); } finally { setSaving(false); }
  };

  return (
    <div className="fixed inset-0 z-[400] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-[#0f1014] border border-white/10 rounded-3xl text-white overflow-hidden">
        <div className="px-5 py-4 border-b border-white/10 flex items-center gap-3">
          <Edit3 className="w-4 h-4 text-amber-400" />
          <p className="font-bold">Editar ponche — {punch?.employee_name}</p>
        </div>
        <div className="p-5 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[10px] text-white/40 font-bold uppercase tracking-wider">Entrada</label>
              <input type="datetime-local" value={clockIn} onChange={e=>setClockIn(e.target.value)}
                className="mt-1.5 w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-white outline-none focus:border-cyan-500" />
            </div>
            <div>
              <label className="text-[10px] text-white/40 font-bold uppercase tracking-wider">Salida</label>
              <input type="datetime-local" value={clockOut} onChange={e=>setClockOut(e.target.value)}
                className="mt-1.5 w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-white outline-none focus:border-cyan-500" />
            </div>
          </div>
          <div>
            <label className="text-[10px] text-white/40 font-bold uppercase tracking-wider">Justificación *</label>
            <textarea rows={3} value={note} onChange={e=>setNote(e.target.value)}
              placeholder="¿Por qué se modifica este ponche?"
              className="mt-1.5 w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-white outline-none focus:border-cyan-500 resize-none" />
          </div>
          {err && <p className="text-red-400 text-xs">{err}</p>}
        </div>
        <div className="px-5 py-4 border-t border-white/10 flex gap-2">
          <button onClick={onClose}
            className="flex-1 h-10 rounded-xl border border-white/10 text-white/60 hover:bg-white/5 text-sm font-bold transition-all">
            Cancelar
          </button>
          <button onClick={handleSave} disabled={saving}
            className="flex-1 h-10 rounded-xl bg-amber-500 hover:bg-amber-400 text-black text-sm font-black transition-all disabled:opacity-50">
            {saving ? "Guardando…" : "Guardar"}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ─────────────── Modal Pago ─────────────── */
function PaymentModal({ employee, onClose, onConfirm }) {
  const [amount, setAmount] = useState((employee?.payment || 0).toFixed(2));
  const [type, setType]     = useState("salary");
  const [notes, setNotes]   = useState("");
  const [saving, setSaving] = useState(false);

  const TYPES = [
    { v:"salary",     l:"Salario" },
    { v:"bonus",      l:"Bono" },
    { v:"commission", l:"Comisión" },
    { v:"advance",    l:"Adelanto" },
    { v:"other",      l:"Otro" },
  ];

  const handleSubmit = async () => {
    if (!amount || parseFloat(amount) <= 0) { toast.error("Monto inválido"); return; }
    setSaving(true);
    await onConfirm(amount, type, notes);
    setSaving(false);
  };

  return (
    <div className="fixed inset-0 z-[400] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-[#0f1014] border border-emerald-500/30 rounded-3xl text-white overflow-hidden">
        <div className="px-5 py-4 border-b border-emerald-500/20 flex items-center gap-3">
          <DollarSign className="w-5 h-5 text-emerald-400" />
          <p className="font-black text-lg">Procesar Pago</p>
        </div>
        <div className="p-5 space-y-4">
          {/* Employee summary */}
          <div className="bg-emerald-500/[0.08] border border-emerald-500/20 rounded-2xl p-4">
            <p className="text-white font-bold text-lg">{employee?.name}</p>
            <div className="flex gap-4 mt-2 text-sm text-white/50">
              <span>{employee?.hours?.toFixed(2)}h trabajadas</span>
              <span>× ${employee?.rate?.toFixed(2)}/hr</span>
            </div>
          </div>
          {/* Amount */}
          <div>
            <label className="text-[10px] text-white/40 font-bold uppercase tracking-wider">Monto a pagar</label>
            <div className="relative mt-1.5">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-emerald-400 font-bold">$</span>
              <input type="number" step="0.01" value={amount} onChange={e=>setAmount(e.target.value)}
                className="w-full bg-white/5 border border-emerald-500/30 rounded-xl pl-8 pr-4 py-3 text-xl font-black text-emerald-400 outline-none focus:border-emerald-400" />
            </div>
          </div>
          {/* Type pills */}
          <div>
            <label className="text-[10px] text-white/40 font-bold uppercase tracking-wider">Tipo</label>
            <div className="flex flex-wrap gap-2 mt-2">
              {TYPES.map(t => (
                <button key={t.v} onClick={() => setType(t.v)}
                  className={`px-3 py-1.5 rounded-xl text-sm font-bold transition-all ${
                    type===t.v ? "bg-emerald-500 text-black" : "bg-white/5 border border-white/10 text-white/50 hover:bg-white/10"
                  }`}>
                  {t.l}
                </button>
              ))}
            </div>
          </div>
          {/* Notes */}
          <div>
            <label className="text-[10px] text-white/40 font-bold uppercase tracking-wider">Notas</label>
            <textarea rows={2} value={notes} onChange={e=>setNotes(e.target.value)} placeholder="Opcional…"
              className="mt-1.5 w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-white outline-none focus:border-emerald-500 resize-none" />
          </div>
        </div>
        <div className="px-5 py-4 border-t border-white/10 flex gap-2">
          <button onClick={onClose}
            className="flex-1 h-11 rounded-xl border border-white/10 text-white/60 hover:bg-white/5 text-sm font-bold">
            Cancelar
          </button>
          <button onClick={handleSubmit} disabled={saving}
            className="flex-1 h-11 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-black font-black text-sm transition-all disabled:opacity-50">
            {saving ? "Procesando…" : `Pagar $${parseFloat(amount||0).toFixed(2)}`}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ─────────────── Página Principal ─────────────── */
export default function TimeTrackingPage() {
  const [session, setSession]             = useState(null);
  const [employees, setEmployees]         = useState([]);
  const [entries, setEntries]             = useState([]);
  const [activeUsers, setActiveUsers]     = useState([]);
  const [loading, setLoading]             = useState(false);
  const [nowTick, setNowTick]             = useState(Date.now());
  const [search, setSearch]               = useState("");

  // Filters
  const [from, setFrom]           = useState(sowSun(new Date()));
  const [to, setTo]               = useState(eowSat(new Date()));
  const [selEmployee, setSelEmp]  = useState("all");
  const [onlyOpen, setOnlyOpen]   = useState(false);
  const [activePeriod, setActivePeriod] = useState("week");

  // Modals
  const [editPunch, setEditPunch]       = useState(null);
  const [payEmployee, setPayEmployee]   = useState(null);

  // Expanded weeks
  const [expandedWeeks, setExpandedWeeks] = useState(new Set());

  /* ── session ── */
  useEffect(() => {
    const raw = sessionStorage.getItem("911-session") || localStorage.getItem("employee_session");
    try { if (raw) setSession(JSON.parse(raw)); } catch {}
  }, []);

  /* ── live clock ── */
  useEffect(() => {
    const t = setInterval(() => setNowTick(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  /* ── Load employees ── */
  const loadEmployees = useCallback(async () => {
    try {
      const tenantId = getCurrentTenantId();
      let q = supabase.from("users").select("id,full_name,role,position,hourly_rate,active").eq("active",true);
      if (tenantId) q = q.eq("tenant_id", tenantId);
      const { data } = await q;
      if (data?.length) {
        setEmployees([{id:"all",full_name:"Todos",hourly_rate:0}, ...data.map(u=>({
          id:u.id, full_name:u.full_name||"Usuario",
          role:u.position||u.role||"user", hourly_rate:Number(u.hourly_rate||0)
        }))]);
        return;
      }
    } catch {}
    setEmployees([{id:"all",full_name:"Todos",hourly_rate:0}, ...readLocalEmployees()]);
  }, []);

  useEffect(() => { loadEmployees(); }, [loadEmployees]);

  /* ── Load entries ── */
  const loadEntries = useCallback(async () => {
    setLoading(true);
    try {
      const tenantId = getCurrentTenantId();
      let q = supabase.from("time_entry").select("*").order("clock_in",{ascending:false}).limit(500);
      if (tenantId) q = q.eq("tenant_id", tenantId);
      const { data: remote } = await q;
      const merged = mergeEntries(remote||[], readLocalEntries());

      const filtered = merged.filter(e => {
        if (!e?.clock_in) return false;
        const ci = new Date(e.clock_in);
        if (ci < sod(from) || ci > eod(to)) return false;
        if (selEmployee !== "all" && String(e.employee_id) !== String(selEmployee)) return false;
        if (onlyOpen && e.clock_out) return false;
        return true;
      });
      setEntries(filtered);

      // active users = open entries in last 24h
      const now = Date.now();
      setActiveUsers((remote||[]).filter(e => !e.clock_out && (now - new Date(e.clock_in).getTime()) < 86400000));
    } catch (err) {
      console.error(err);
      toast.error("Error al cargar ponches");
    } finally { setLoading(false); }
  }, [from, to, selEmployee, onlyOpen]);

  useEffect(() => { loadEntries(); }, [loadEntries]);
  useEffect(() => {
    if (session?.userRole === "admin" || session?.userRole === "manager") {
      const t = setInterval(loadEntries, 30000);
      return () => clearInterval(t);
    }
  }, [session, loadEntries]);

  /* ── Period shortcuts ── */
  const setPeriod = (p) => {
    setActivePeriod(p);
    const now = new Date();
    if (p==="today")  { setFrom(sod(now)); setTo(eod(now)); }
    if (p==="week")   { setFrom(sowSun(now)); setTo(eowSat(now)); }
    if (p==="month")  { setFrom(new Date(now.getFullYear(),now.getMonth(),1)); setTo(new Date(now.getFullYear(),now.getMonth()+1,0,23,59,59,999)); }
  };

  /* ── Payment ── */
  const processPayment = async (amount, type, notes) => {
    if (!payEmployee) return;
    try {
      const me = session;
      await dataClient.entities.EmployeePayment.create({
        employee_id: payEmployee.id,
        employee_name: payEmployee.name,
        amount: parseFloat(amount),
        payment_type: type,
        payment_method: "transfer",
        period_start: from.toISOString(),
        period_end: to.toISOString(),
        notes,
        paid_by: me?.userId || me?.id,
        paid_by_name: me?.userName || me?.full_name
      });
      await dataClient.entities.Transaction.create({
        type: "expense",
        amount: Math.abs(parseFloat(amount)),
        category: "payroll",
        description: `Nómina — ${payEmployee.name} (${type})`,
        payment_method: "transfer",
        recorded_by: me?.userName || me?.full_name || "Sistema"
      });
      toast.success(`✅ Pago registrado para ${payEmployee.name}`);
      setPayEmployee(null);
      loadEntries();
    } catch (e) {
      console.error(e);
      toast.error("Error al procesar el pago");
    }
  };

  /* ── Computed ── */
  const totalMillis = useMemo(() =>
    entries.reduce((s,e) => {
      const start = e.clock_in ? new Date(e.clock_in).getTime() : 0;
      const end   = e.clock_out ? new Date(e.clock_out).getTime() : nowTick;
      return s + Math.max(0, end - start);
    }, 0), [entries, nowTick]);

  const employeePayments = useMemo(() => {
    const map = new Map();
    entries.forEach(e => {
      if (!e.employee_id) return;
      const emp = employees.find(u => String(u.id) === String(e.employee_id));
      const rate = Number(emp?.hourly_rate || 0);
      if (!rate) return;
      const ms = Math.max(0, (e.clock_out ? new Date(e.clock_out) : new Date(nowTick)) - new Date(e.clock_in));
      const cur = map.get(e.employee_id) || { id:e.employee_id, name:e.employee_name||emp?.full_name||"?", hours:0, rate, payment:0 };
      cur.hours += ms / 3600000;
      cur.payment += (ms / 3600000) * rate;
      map.set(e.employee_id, cur);
    });
    return [...map.values()].sort((a,b) => b.payment - a.payment);
  }, [entries, employees, nowTick]);

  const weeklySummary = useMemo(() => {
    const map = new Map();
    entries.forEach(e => {
      const s = sowSun(new Date(e.clock_in));
      const key = s.toISOString().slice(0,10);
      const arr = map.get(key) || [];
      arr.push(e); map.set(key, arr);
    });
    return [...map.entries()].sort(([a],[b])=>b.localeCompare(a)).map(([key, arr]) => {
      const s = new Date(key);
      const en = eowSat(s);
      const ms = arr.reduce((t,e) => {
        const start = e.clock_in ? new Date(e.clock_in).getTime() : 0;
        const end = e.clock_out ? new Date(e.clock_out).getTime() : nowTick;
        return t + Math.max(0, end-start);
      },0);
      return {
        key,
        label: `${s.toLocaleDateString("es-PR",{month:"short",day:"numeric"})} – ${en.toLocaleDateString("es-PR",{month:"short",day:"numeric"})}`,
        entries: arr, open: arr.filter(e=>!e.clock_out).length, ms
      };
    });
  }, [entries, nowTick]);

  const isAdmin = ["admin","manager"].includes(session?.userRole);
  const canEdit = isAdmin;

  // Search filter on weekly entries
  const searchLow = search.toLowerCase();

  /* ─────────────── RENDER ─────────────── */
  return (
    <div className="min-h-screen bg-black/95 p-4 sm:p-6 pb-24">
      <div className="max-w-6xl mx-auto space-y-5">

        {/* ── Header ── */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-red-500 to-pink-600 flex items-center justify-center shadow-lg">
              <Clock className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-black text-white tracking-tight">Control de Tiempo</h1>
              <p className="text-white/35 text-sm font-bold">Ponches y horas trabajadas</p>
            </div>
          </div>
          <button onClick={loadEntries} disabled={loading}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white/[0.06] hover:bg-white/[0.1] border border-white/[0.08] text-white/50 hover:text-white text-sm font-bold transition-all">
            <RefreshCcw className={`w-4 h-4 ${loading?"animate-spin":""}`} />
            <span className="hidden sm:inline">Actualizar</span>
          </button>
        </div>

        {/* ── Active users strip ── */}
        {activeUsers.length > 0 && (
          <div className="bg-emerald-500/[0.07] border border-emerald-500/20 rounded-2xl px-4 py-3 flex items-center gap-3 flex-wrap">
            <div className="flex items-center gap-2 flex-shrink-0">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <p className="text-emerald-400 text-xs font-black uppercase tracking-wider">En turno ahora</p>
            </div>
            {activeUsers.map(e => (
              <span key={e.id} className="text-sm font-bold text-white/80 bg-white/[0.07] rounded-lg px-2.5 py-1">
                {e.employee_name || "—"}
              </span>
            ))}
          </div>
        )}

        {/* ── KPI Cards ── */}
        <div className="grid grid-cols-3 gap-3">
          {[
            { label:"Ponches",        value: entries.length,                       color:"text-white" },
            { label:"Abiertos",       value: entries.filter(e=>!e.clock_out).length, color:"text-cyan-400" },
            { label:"Horas totales",  value: fmtHM(totalMillis),                  color:"text-red-400" },
          ].map(k => (
            <div key={k.label} className="bg-white/[0.04] border border-white/[0.07] rounded-2xl p-4 text-center">
              <p className={`font-black text-2xl ${k.color}`}>{k.value}</p>
              <p className="text-white/30 text-[10px] font-bold uppercase tracking-wide mt-0.5">{k.label}</p>
            </div>
          ))}
        </div>

        {/* ── Filters ── */}
        <div className="bg-white/[0.04] border border-white/[0.07] rounded-2xl p-4 space-y-3">
          {/* Period pills */}
          <div className="flex gap-2 flex-wrap">
            {[
              {v:"today",  l:"Hoy"},
              {v:"week",   l:"Semana"},
              {v:"month",  l:"Mes"},
            ].map(p => (
              <button key={p.v} onClick={() => setPeriod(p.v)}
                className={`px-3.5 py-1.5 rounded-xl text-sm font-bold transition-all ${
                  activePeriod===p.v
                    ? "bg-white text-black"
                    : "bg-white/[0.06] border border-white/[0.08] text-white/50 hover:text-white"
                }`}>
                {p.l}
              </button>
            ))}
            <div className="flex items-center gap-2 ml-auto">
              <input type="date" value={sod(from).toISOString().slice(0,10)}
                onChange={e=>{setFrom(new Date(e.target.value));setActivePeriod("custom");}}
                className="bg-white/[0.05] border border-white/[0.08] rounded-xl px-3 py-1.5 text-sm text-white outline-none" />
              <span className="text-white/25 text-sm">→</span>
              <input type="date" value={sod(to).toISOString().slice(0,10)}
                onChange={e=>{setTo(new Date(e.target.value));setActivePeriod("custom");}}
                className="bg-white/[0.05] border border-white/[0.08] rounded-xl px-3 py-1.5 text-sm text-white outline-none" />
            </div>
          </div>
          {/* Employee + search + open toggle */}
          <div className="flex gap-2 flex-wrap items-center">
            <select value={selEmployee} onChange={e=>setSelEmp(e.target.value)}
              className="bg-white/[0.05] border border-white/[0.08] rounded-xl px-3 py-2 text-sm text-white outline-none">
              {employees.map(u=><option key={u.id} value={u.id}>{u.full_name}</option>)}
            </select>
            <div className="relative flex-1 min-w-[160px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-white/30" />
              <input placeholder="Buscar…" value={search} onChange={e=>setSearch(e.target.value)}
                className="w-full bg-white/[0.05] border border-white/[0.08] rounded-xl pl-8 pr-3 py-2 text-sm text-white outline-none" />
            </div>
            <label className="flex items-center gap-2 text-sm text-white/50 cursor-pointer">
              <input type="checkbox" checked={onlyOpen} onChange={e=>setOnlyOpen(e.target.checked)} className="accent-cyan-500" />
              Solo abiertos
            </label>
          </div>
        </div>

        {/* ── Pagos calculados ── */}
        {employeePayments.length > 0 && (
          <div className="bg-emerald-500/[0.06] border border-emerald-500/20 rounded-2xl overflow-hidden">
            <div className="px-4 py-3 border-b border-emerald-500/15 flex items-center gap-2">
              <DollarSign className="w-4 h-4 text-emerald-400" />
              <p className="text-emerald-400 font-black text-sm uppercase tracking-wider">Pagos Calculados</p>
            </div>
            <div className="p-2 space-y-1">
              {employeePayments.map(emp => (
                <div key={emp.id} className="flex items-center gap-3 bg-white/[0.03] rounded-xl px-4 py-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-white font-bold text-sm truncate">{emp.name}</p>
                    <p className="text-white/35 text-xs mt-0.5">{emp.hours.toFixed(2)}h × ${emp.rate.toFixed(2)}/hr</p>
                  </div>
                  <p className="text-emerald-400 font-black text-base flex-shrink-0">${emp.payment.toFixed(2)}</p>
                  {isAdmin && (
                    <button onClick={()=>setPayEmployee(emp)}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 text-xs font-bold hover:bg-emerald-500/30 transition-all flex-shrink-0">
                      <DollarSign className="w-3 h-3" /> Pagar
                    </button>
                  )}
                </div>
              ))}
              <div className="flex items-center justify-between px-4 py-2 border-t border-emerald-500/15 mt-1">
                <p className="text-emerald-400/60 text-xs font-bold uppercase tracking-wider">Total a pagar</p>
                <p className="text-emerald-400 font-black text-xl">
                  ${employeePayments.reduce((s,e)=>s+e.payment,0).toFixed(2)}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* ── Resumen semanal + ponches ── */}
        {loading ? (
          <div className="space-y-2">
            {[...Array(3)].map((_,i)=>(
              <div key={i} className="bg-white/[0.04] border border-white/[0.06] rounded-2xl h-16 animate-pulse" />
            ))}
          </div>
        ) : weeklySummary.length === 0 ? (
          <div className="text-center py-16">
            <Clock className="w-10 h-10 text-white/10 mx-auto mb-3" />
            <p className="text-white/30 text-sm font-semibold">Sin ponches en este período</p>
          </div>
        ) : (
          <div className="space-y-2">
            {weeklySummary.map(week => {
              const isExpanded = expandedWeeks.has(week.key);
              const weekEntries = week.entries.filter(e =>
                !searchLow || (e.employee_name||"").toLowerCase().includes(searchLow)
              );
              return (
                <div key={week.key} className="bg-white/[0.04] border border-white/[0.07] rounded-2xl overflow-hidden">
                  {/* Week header */}
                  <button
                    onClick={() => {
                      const next = new Set(expandedWeeks);
                      isExpanded ? next.delete(week.key) : next.add(week.key);
                      setExpandedWeeks(next);
                    }}
                    className="w-full flex items-center gap-4 px-4 py-3.5 hover:bg-white/[0.04] transition-all"
                  >
                    <div className="flex-1 min-w-0 text-left">
                      <p className="text-white font-bold text-sm">{week.label}</p>
                      <div className="flex items-center gap-3 mt-0.5 text-xs text-white/35 font-semibold">
                        <span>{week.entries.length} ponche{week.entries.length!==1?"s":""}</span>
                        {week.open > 0 && <span className="text-cyan-400">{week.open} abierto{week.open!==1?"s":""}</span>}
                        <span className="text-red-400">{fmtHM(week.ms)}</span>
                      </div>
                    </div>
                    {isExpanded ? <ChevronUp className="w-4 h-4 text-white/30" /> : <ChevronDown className="w-4 h-4 text-white/30" />}
                  </button>

                  {/* Week entries */}
                  {isExpanded && (
                    <div className="border-t border-white/[0.06]">
                      {weekEntries.length === 0 ? (
                        <p className="text-white/25 text-sm text-center py-4">Sin resultados</p>
                      ) : weekEntries.map(e => {
                        const ms = Math.max(0,
                          (e.clock_out ? new Date(e.clock_out) : new Date(nowTick)) - new Date(e.clock_in)
                        );
                        const isOpen = !e.clock_out;
                        return (
                          <div key={e.id} className={`flex items-center gap-3 px-4 py-3 border-b border-white/[0.04] last:border-0 ${
                            isOpen ? "bg-cyan-500/[0.04]" : ""
                          }`}>
                            <div className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${
                              isOpen ? "bg-cyan-400 animate-pulse" : "bg-white/15"
                            }`} />
                            <div className="flex-1 min-w-0">
                              <p className="text-white text-sm font-semibold truncate">{e.employee_name || "—"}</p>
                              <p className="text-white/30 text-xs mt-0.5">
                                {fmtDate(e.clock_in)} · {fmtTime(e.clock_in)}
                                {e.clock_out ? ` → ${fmtTime(e.clock_out)}` : " → en curso"}
                              </p>
                            </div>
                            <div className="text-right flex-shrink-0">
                              <p className={`text-sm font-bold ${isOpen ? "text-cyan-400" : "text-white"}`}>
                                {isOpen ? fmtHMS(ms) : fmtHM(ms)}
                              </p>
                            </div>
                            {canEdit && (
                              <button onClick={()=>setEditPunch(e)}
                                className="w-8 h-8 flex items-center justify-center rounded-xl text-white/20 hover:text-amber-400 hover:bg-amber-500/10 transition-all flex-shrink-0">
                                <Edit3 className="w-3.5 h-3.5" />
                              </button>
                            )}
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
      </div>

      {/* Modals */}
      {editPunch && (
        <EditPunchModal punch={editPunch} onClose={()=>setEditPunch(null)} onSaved={()=>{loadEntries();toast.success("Ponche actualizado");}} />
      )}
      {payEmployee && (
        <PaymentModal employee={payEmployee} onClose={()=>setPayEmployee(null)} onConfirm={processPayment} />
      )}
    </div>
  );
}
