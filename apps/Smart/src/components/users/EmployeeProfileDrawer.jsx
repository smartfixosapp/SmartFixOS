import React, { useState, useEffect } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  X, Edit, Mail, Phone, Code, Calendar, Clock,
  DollarSign, Shield, Activity, Loader2, TrendingUp
} from "lucide-react";
import { dataClient } from "@/components/api/dataClient";
import { supabase } from "../../../../../lib/supabase-client.js";
import { format } from "date-fns";
import { es } from "date-fns/locale";

const PAYMENT_TYPE_LABEL = {
  salary: "Salario", bonus: "Bono", commission: "Comisión",
  advance: "Adelanto", other: "Otro"
};
const PAYMENT_EMOJI = {
  salary: "💵", bonus: "🎁", commission: "💰", advance: "⚡", other: "📋"
};

export default function EmployeeProfileDrawer({
  employee, roles, onClose, onEdit, onToggleActive
}) {
  const [tab, setTab] = useState("info");
  const [payments, setPayments] = useState([]);
  const [timeEntries, setTimeEntries] = useState([]);
  const [loadingPayments, setLoadingPayments] = useState(false);
  const [loadingTime, setLoadingTime] = useState(false);

  const userRole = employee.position || employee.role;
  const role = roles.find(r => r.value === userRole) || {
    label: "Empleado", color: "from-slate-500 to-slate-700", badge: "bg-slate-500", icon: Shield
  };
  const RoleIcon = role.icon;

  const nameParts = (employee.full_name || "").split(" ").filter(Boolean);
  const initials = nameParts.length >= 2
    ? (nameParts[0][0] + nameParts[1][0]).toUpperCase()
    : (nameParts[0]?.[0] || "?").toUpperCase();

  const isActive = employee.active !== false;
  const hourlyRate = Number(employee.hourly_rate || 0);

  // Auto-load on tab switch
  useEffect(() => {
    if (tab === "pagos") loadPayments();
    if (tab === "horas") loadTimeEntries();
  }, [tab]);

  // Pre-load hours for the quick stats in header
  useEffect(() => {
    loadTimeEntries();
  }, []);

  const loadPayments = async () => {
    if (loadingPayments) return;
    setLoadingPayments(true);
    try {
      const data = await dataClient.entities.EmployeePayment.filter(
        { employee_id: employee.id }, "-created_date", 20
      );
      setPayments(data || []);
    } catch (e) {
      console.error("Error loading payments:", e);
    } finally {
      setLoadingPayments(false);
    }
  };

  const loadTimeEntries = async () => {
    if (loadingTime) return;
    setLoadingTime(true);
    try {
      const since = new Date();
      since.setDate(since.getDate() - 14);
      const { data } = await supabase
        .from("time_entry")
        .select("*")
        .eq("employee_id", employee.id)
        .gte("clock_in", since.toISOString())
        .order("clock_in", { ascending: false })
        .limit(30);
      setTimeEntries(data || []);
    } catch (e) {
      console.error("Error loading time entries:", e);
    } finally {
      setLoadingTime(false);
    }
  };

  // Calculate this week's hours
  const weekStart = new Date();
  weekStart.setDate(weekStart.getDate() - weekStart.getDay());
  weekStart.setHours(0, 0, 0, 0);

  const weekHours = timeEntries
    .filter(e => new Date(e.clock_in) >= weekStart)
    .reduce((sum, e) => {
      if (e.total_hours) return sum + Number(e.total_hours);
      if (e.clock_in && e.clock_out)
        return sum + (new Date(e.clock_out) - new Date(e.clock_in)) / 3600000;
      return sum;
    }, 0);

  const weekEarnings = weekHours * hourlyRate;
  const totalPaid = payments.reduce((s, p) => s + Number(p.amount || 0), 0);

  // Trap ESC key
  useEffect(() => {
    const handler = (e) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, []);

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-[300] bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Drawer panel — slides in from right */}
      <div className="fixed right-0 top-0 bottom-0 z-[310] w-full max-w-[420px] bg-[#0c0d10] border-l border-white/[0.08] shadow-2xl flex flex-col overflow-hidden">

        {/* Top bar */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/[0.07] flex-shrink-0">
          <span className="text-white/40 text-xs font-black uppercase tracking-widest">Perfil de empleado</span>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full flex items-center justify-center text-white/40 hover:text-white hover:bg-white/10 transition-all"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Hero section */}
        <div className="px-6 py-5 border-b border-white/[0.06] flex-shrink-0">
          <div className="flex items-center gap-4 mb-5">
            {/* Avatar */}
            <div className="relative flex-shrink-0">
              <div className={`w-[72px] h-[72px] rounded-[20px] bg-gradient-to-br ${role.color} flex items-center justify-center shadow-2xl`}>
                <span className="text-white font-black text-2xl">{initials}</span>
              </div>
              <div className={`absolute -bottom-1 -right-1 w-4 h-4 rounded-full border-2 border-[#0c0d10] ${isActive ? "bg-emerald-400" : "bg-slate-600"}`} />
            </div>

            <div className="flex-1 min-w-0">
              <h2 className="text-white font-black text-xl leading-tight truncate">{employee.full_name}</h2>
              <div className="flex items-center gap-2 mt-2 flex-wrap">
                <Badge className={`${role.badge} text-white border-0 text-xs`}>
                  <RoleIcon className="w-3 h-3 mr-1" />
                  {role.label}
                </Badge>
                <span className={`text-xs font-bold flex items-center gap-1 ${isActive ? "text-emerald-400" : "text-slate-500"}`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${isActive ? "bg-emerald-400" : "bg-slate-500"}`} />
                  {isActive ? "Activo" : "Inactivo"}
                </span>
              </div>
            </div>
          </div>

          {/* Quick stats */}
          <div className="grid grid-cols-3 gap-2">
            <div className="bg-white/[0.05] rounded-2xl p-3 text-center">
              <p className="text-white font-black text-lg">{weekHours.toFixed(1)}</p>
              <p className="text-white/35 text-[10px] font-bold uppercase tracking-wide">Hrs semana</p>
            </div>
            <div className="bg-white/[0.05] rounded-2xl p-3 text-center">
              <p className="text-white font-black text-lg">${hourlyRate.toFixed(0)}</p>
              <p className="text-white/35 text-[10px] font-bold uppercase tracking-wide">Por hora</p>
            </div>
            <div className="bg-emerald-500/[0.1] border border-emerald-500/20 rounded-2xl p-3 text-center">
              <p className="text-emerald-400 font-black text-lg">${weekEarnings.toFixed(0)}</p>
              <p className="text-white/35 text-[10px] font-bold uppercase tracking-wide">Esta semana</p>
            </div>
          </div>
        </div>

        {/* Tab navigation */}
        <div className="flex px-5 pt-3 gap-0 flex-shrink-0">
          {[
            { id: "info", label: "Información" },
            { id: "pagos", label: "Pagos" },
            { id: "horas", label: "Horas" },
          ].map(t => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`flex-1 py-2.5 text-sm font-bold transition-all border-b-2 ${
                tab === t.id
                  ? "text-white border-cyan-400"
                  : "text-white/35 border-transparent hover:text-white/60"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Scrollable content */}
        <div className="flex-1 overflow-y-auto p-5 space-y-2.5">

          {/* ── INFORMACIÓN ── */}
          {tab === "info" && (
            <>
              {[
                employee.employee_code && {
                  icon: Code, label: "Código de empleado",
                  value: employee.employee_code, color: "text-cyan-400",
                  bg: "bg-cyan-500/10"
                },
                employee.email && {
                  icon: Mail, label: "Email",
                  value: employee.email, color: "text-blue-400",
                  bg: "bg-blue-500/10"
                },
                employee.phone && {
                  icon: Phone, label: "Teléfono",
                  value: employee.phone, color: "text-purple-400",
                  bg: "bg-purple-500/10"
                },
                (employee.created_date || employee.created_at) && {
                  icon: Calendar, label: "Miembro desde",
                  value: (() => {
                    try {
                      return format(
                        new Date(employee.created_date || employee.created_at),
                        "dd 'de' MMMM, yyyy", { locale: es }
                      );
                    } catch { return "—"; }
                  })(),
                  color: "text-white/50",
                  bg: "bg-white/5"
                },
              ].filter(Boolean).map(({ icon: Icon, label, value, color, bg }) => (
                <div key={label} className="flex items-center gap-3 bg-white/[0.03] rounded-2xl px-4 py-3.5">
                  <div className={`w-9 h-9 rounded-xl ${bg} flex items-center justify-center flex-shrink-0`}>
                    <Icon className={`w-4 h-4 ${color}`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-white/35 text-[10px] font-bold uppercase tracking-wider">{label}</p>
                    <p className="text-white text-sm font-semibold truncate mt-0.5">{value}</p>
                  </div>
                </div>
              ))}

              {/* Hourly rate highlight */}
              <div className="flex items-center gap-3 bg-emerald-500/[0.08] border border-emerald-500/20 rounded-2xl px-4 py-3.5">
                <div className="w-9 h-9 rounded-xl bg-emerald-500/20 flex items-center justify-center flex-shrink-0">
                  <DollarSign className="w-4 h-4 text-emerald-400" />
                </div>
                <div className="flex-1">
                  <p className="text-white/35 text-[10px] font-bold uppercase tracking-wider">Tarifa por hora</p>
                  <p className="text-emerald-400 text-base font-black mt-0.5">${hourlyRate.toFixed(2)}/hr</p>
                </div>
              </div>

              {/* Role & permissions summary */}
              <div className="flex items-center gap-3 bg-white/[0.03] rounded-2xl px-4 py-3.5">
                <div className={`w-9 h-9 rounded-xl bg-gradient-to-br ${role.color} flex items-center justify-center flex-shrink-0`}>
                  <RoleIcon className="w-4 h-4 text-white" />
                </div>
                <div className="flex-1">
                  <p className="text-white/35 text-[10px] font-bold uppercase tracking-wider">Rol en el sistema</p>
                  <p className="text-white text-sm font-semibold mt-0.5">{role.label}</p>
                </div>
              </div>
            </>
          )}

          {/* ── PAGOS ── */}
          {tab === "pagos" && (
            loadingPayments ? (
              <div className="flex justify-center py-16">
                <Loader2 className="w-6 h-6 animate-spin text-white/20" />
              </div>
            ) : payments.length === 0 ? (
              <div className="text-center py-16">
                <DollarSign className="w-10 h-10 text-white/10 mx-auto mb-3" />
                <p className="text-white/30 text-sm font-semibold">Sin pagos registrados</p>
              </div>
            ) : (
              <>
                {/* Total summary */}
                <div className="bg-emerald-500/[0.08] border border-emerald-500/20 rounded-2xl p-4 text-center mb-2">
                  <p className="text-white/50 text-xs font-bold uppercase tracking-wider mb-1">Total recibido (histórico)</p>
                  <p className="text-emerald-400 font-black text-3xl">${totalPaid.toFixed(2)}</p>
                  <p className="text-white/30 text-xs mt-1">{payments.length} pago{payments.length !== 1 ? "s" : ""}</p>
                </div>

                {payments.map(p => (
                  <div key={p.id} className="bg-white/[0.04] rounded-2xl px-4 py-3.5 flex items-center gap-3">
                    <span className="text-2xl flex-shrink-0">{PAYMENT_EMOJI[p.payment_type] || "📋"}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-white text-sm font-bold">{PAYMENT_TYPE_LABEL[p.payment_type] || p.payment_type}</p>
                      {p.notes && <p className="text-white/35 text-xs truncate mt-0.5">{p.notes}</p>}
                      <p className="text-white/25 text-[10px] mt-1">
                        {(() => {
                          try {
                            return format(new Date(p.created_date || p.created_at), "dd MMM yyyy", { locale: es });
                          } catch { return ""; }
                        })()}
                      </p>
                    </div>
                    <p className="text-emerald-400 font-black text-base flex-shrink-0">
                      ${Number(p.amount || 0).toFixed(2)}
                    </p>
                  </div>
                ))}
              </>
            )
          )}

          {/* ── HORAS ── */}
          {tab === "horas" && (
            loadingTime ? (
              <div className="flex justify-center py-16">
                <Loader2 className="w-6 h-6 animate-spin text-white/20" />
              </div>
            ) : timeEntries.length === 0 ? (
              <div className="text-center py-16">
                <Clock className="w-10 h-10 text-white/10 mx-auto mb-3" />
                <p className="text-white/30 text-sm font-semibold">Sin horas registradas</p>
                <p className="text-white/20 text-xs mt-1">Últimos 14 días</p>
              </div>
            ) : (
              <>
                {/* Summary */}
                <div className="grid grid-cols-2 gap-2 mb-2">
                  <div className="bg-white/[0.05] rounded-2xl p-3.5 text-center">
                    <p className="text-white font-black text-xl">{weekHours.toFixed(1)}h</p>
                    <p className="text-white/35 text-[10px] font-bold uppercase">Esta semana</p>
                  </div>
                  <div className="bg-emerald-500/[0.08] border border-emerald-500/20 rounded-2xl p-3.5 text-center">
                    <p className="text-emerald-400 font-black text-xl">${weekEarnings.toFixed(2)}</p>
                    <p className="text-white/35 text-[10px] font-bold uppercase">Estimado</p>
                  </div>
                </div>

                {timeEntries.map(entry => {
                  const hours = entry.total_hours
                    ? Number(entry.total_hours)
                    : (entry.clock_in && entry.clock_out)
                      ? (new Date(entry.clock_out) - new Date(entry.clock_in)) / 3600000
                      : null;
                  const isOpen = entry.clock_in && !entry.clock_out;

                  return (
                    <div
                      key={entry.id}
                      className={`rounded-2xl px-4 py-3.5 flex items-center gap-3 ${
                        isOpen
                          ? "bg-cyan-500/[0.08] border border-cyan-500/20"
                          : "bg-white/[0.03]"
                      }`}
                    >
                      <div className={`w-2 h-2 rounded-full flex-shrink-0 ${
                        isOpen ? "bg-cyan-400 animate-pulse" : "bg-white/15"
                      }`} />
                      <div className="flex-1 min-w-0">
                        <p className="text-white text-sm font-semibold capitalize">
                          {(() => {
                            try {
                              return format(new Date(entry.clock_in), "EEEE d 'de' MMM", { locale: es });
                            } catch { return "—"; }
                          })()}
                        </p>
                        <p className="text-white/35 text-xs mt-0.5">
                          {(() => {
                            try { return format(new Date(entry.clock_in), "hh:mm a"); } catch { return ""; }
                          })()}
                          {entry.clock_out
                            ? ` → ${(() => { try { return format(new Date(entry.clock_out), "hh:mm a"); } catch { return ""; } })()}`
                            : isOpen ? " → En curso" : ""}
                        </p>
                      </div>
                      <div className="text-right flex-shrink-0">
                        {hours !== null ? (
                          <>
                            <p className="text-white font-bold text-sm">{hours.toFixed(1)}h</p>
                            {hourlyRate > 0 && (
                              <p className="text-white/30 text-[11px]">${(hours * hourlyRate).toFixed(2)}</p>
                            )}
                          </>
                        ) : (
                          <p className="text-cyan-400 font-black text-xs uppercase animate-pulse">En curso</p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </>
            )
          )}
        </div>

        {/* Footer actions */}
        <div className="px-5 py-4 border-t border-white/[0.08] flex gap-2 flex-shrink-0">
          <Button
            onClick={onEdit}
            className="flex-1 bg-white/[0.07] hover:bg-white/[0.12] border border-white/[0.1] text-white h-11 rounded-[16px] text-sm font-bold"
          >
            <Edit className="w-4 h-4 mr-2" />
            Editar
          </Button>
          <Button
            onClick={() => { onToggleActive(); onClose(); }}
            className={`flex-1 h-11 rounded-[16px] text-sm font-bold border ${
              isActive
                ? "bg-red-500/[0.08] border-red-500/25 text-red-400 hover:bg-red-500/15"
                : "bg-emerald-500/[0.08] border-emerald-500/25 text-emerald-400 hover:bg-emerald-500/15"
            }`}
          >
            {isActive ? "Desactivar" : "Activar"}
          </Button>
        </div>
      </div>
    </>
  );
}
