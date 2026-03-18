import React, { useState, useEffect, useCallback, useRef } from "react";
import { dataClient } from "@/components/api/dataClient";
import { supabase } from "../../../../../lib/supabase-client.js";
import { Button } from "@/components/ui/button";
import {
  Target, CheckCircle2, TrendingUp, RefreshCw, ChevronRight,
  Flame, Calendar, DollarSign, AlertCircle, Pencil, Check, X
} from "lucide-react";
import { format, startOfDay, endOfDay, subDays, parseISO } from "date-fns";
import { es } from "date-fns/locale";
import { toast } from "sonner";

// ── Helpers ──────────────────────────────────────────────────────────────────

function getTenantId() {
  try {
    const raw = localStorage.getItem("employee_session") || sessionStorage.getItem("911-session");
    if (raw) {
      const s = JSON.parse(raw);
      if (s?.tenant_id) return s.tenant_id;
      if (s?.user?.tenant_id) return s.user.tenant_id;
    }
    return (
      localStorage.getItem("smartfix_tenant_id") ||
      localStorage.getItem("current_tenant_id") ||
      null
    );
  } catch { return null; }
}

function todayISO() { return format(new Date(), "yyyy-MM-dd"); }

const GOAL_OVERRIDE_KEY = "smartfix_daily_goal_override";

function getGoalOverride() {
  try { return parseFloat(localStorage.getItem(GOAL_OVERRIDE_KEY) || "0") || 0; }
  catch { return 0; }
}
function setGoalOverride(val) {
  localStorage.setItem(GOAL_OVERRIDE_KEY, String(val));
}

// ── Weekly mini bar chart ─────────────────────────────────────────────────────

function WeeklyChart({ days, goal }) {
  const maxRev = Math.max(goal, ...days.map((d) => d.revenue));

  return (
    <div className="space-y-1.5">
      <p className="text-[9px] font-black uppercase tracking-widest text-white/25">Últimos 7 días</p>
      <div className="flex items-end gap-1 h-14">
        {days.map((day) => {
          const heightPct = maxRev > 0 ? (day.revenue / maxRev) * 100 : 0;
          const metGoal = goal > 0 && day.revenue >= goal;
          const isToday = day.isToday;
          let barColor = "bg-white/15";
          if (day.revenue > 0) {
            barColor = metGoal
              ? "bg-emerald-400"
              : day.revenue >= goal * 0.7
              ? "bg-amber-400"
              : "bg-cyan-500/60";
          }

          return (
            <div key={day.key} className="flex-1 flex flex-col items-center gap-1 group/bar relative">
              {/* Goal line indicator */}
              {goal > 0 && (
                <div
                  className="absolute w-full border-t border-dashed border-white/20 pointer-events-none"
                  style={{ bottom: `${(goal / maxRev) * 100}%` }}
                />
              )}
              {/* Tooltip */}
              {day.revenue > 0 && (
                <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 hidden group-hover/bar:block z-10 pointer-events-none bg-black/90 border border-white/10 rounded-xl px-2 py-1 whitespace-nowrap text-[10px] text-white/80 shadow-xl">
                  ${day.revenue.toFixed(2)}
                </div>
              )}
              {/* Bar */}
              <div
                className={`w-full rounded-t-md transition-all duration-500 ${barColor} ${isToday ? "ring-1 ring-white/30" : ""}`}
                style={{ height: heightPct > 2 ? `${heightPct}%` : "4px" }}
              />
              {/* Day label */}
              <span className={`text-[8px] font-black ${isToday ? "text-white" : "text-white/25"}`}>
                {format(day.date, "EEE", { locale: es }).slice(0, 2).toUpperCase()}
              </span>
            </div>
          );
        })}
      </div>
      {/* Legend */}
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-1"><div className="w-2 h-2 rounded-sm bg-emerald-400" /><span className="text-[8px] text-white/25 font-bold">Meta</span></div>
        <div className="flex items-center gap-1"><div className="w-2 h-2 rounded-sm bg-amber-400" /><span className="text-[8px] text-white/25 font-bold">+70%</span></div>
        <div className="flex items-center gap-1"><div className="w-2 h-2 rounded-sm bg-cyan-500/60" /><span className="text-[8px] text-white/25 font-bold">Bajo</span></div>
      </div>
    </div>
  );
}

// ── Widget ────────────────────────────────────────────────────────────────────

export default function SmartDailyGoalWidget({ compact = false, onClick }) {
  const [autoGoal, setAutoGoal] = useState(0);
  const [todayRevenue, setTodayRevenue] = useState(0);
  const [confirmed, setConfirmed] = useState(false);
  const [confirmedAt, setConfirmedAt] = useState(null);
  const [streak, setStreak] = useState(0);
  const [loading, setLoading] = useState(true);
  const [confirming, setConfirming] = useState(false);
  const [hasGoal, setHasGoal] = useState(false);
  const [weeklyData, setWeeklyData] = useState([]);
  // Editable goal
  const [goalOverride, setGoalOverrideState] = useState(() => getGoalOverride());
  const [editingGoal, setEditingGoal] = useState(false);
  const [editGoalValue, setEditGoalValue] = useState("");
  const editInputRef = useRef(null);

  const dailyGoal = goalOverride > 0 ? goalOverride : autoGoal;

  const load = useCallback(async () => {
    setLoading(true);
    try {
      // 1. Operational expenses → auto daily goal
      const expenses = await dataClient.entities.FixedExpense.list("-due_day", 100).catch(() => []);
      const active = Array.isArray(expenses)
        ? expenses.filter((e) => e.active !== false && Number(e.amount || 0) > 0)
        : [];
      const totalMonthly = active.reduce((s, e) => s + Number(e.amount || 0), 0);
      const avgWorkingDays = active.length
        ? active.reduce((s, e) => s + Number(e.working_days_per_month || 26), 0) / active.length
        : 26;
      const autoG = avgWorkingDays > 0 ? totalMonthly / avgWorkingDays : 0;
      setAutoGoal(autoG);
      setHasGoal(active.length > 0 || getGoalOverride() > 0);

      // 2. Load last 7 days transactions
      const txs = await dataClient.entities.Transaction.list("-created_date", 1000).catch(() => []);
      const txArr = Array.isArray(txs) ? txs : [];

      const dayMap = {};
      const today = new Date();
      for (const tx of txArr) {
        if (tx.type !== "revenue") continue;
        const d = new Date(tx.created_date || tx.created_at || 0);
        const key = format(d, "yyyy-MM-dd");
        dayMap[key] = (dayMap[key] || 0) + Number(tx.amount || 0);
      }

      const days = [];
      for (let i = 6; i >= 0; i--) {
        const d = new Date(today);
        d.setDate(d.getDate() - i);
        const key = format(d, "yyyy-MM-dd");
        days.push({ date: new Date(d), key, revenue: dayMap[key] || 0, isToday: i === 0 });
      }
      setWeeklyData(days);

      // Today's revenue
      const todayKey = todayISO();
      setTodayRevenue(dayMap[todayKey] || 0);

      // 3. Today's confirmation
      const todayStr = todayISO();
      const { data: logRows } = await supabase
        .from("daily_goal_log")
        .select("*")
        .eq("goal_date", todayStr)
        .limit(1);
      const todayLog = Array.isArray(logRows) ? logRows[0] : null;
      setConfirmed(!!todayLog?.confirmed);
      setConfirmedAt(todayLog?.confirmed_at || null);

      // 4. Streak
      const { data: streakRows } = await supabase
        .from("daily_goal_log")
        .select("goal_date, confirmed")
        .eq("confirmed", true)
        .order("goal_date", { ascending: false })
        .limit(30);
      if (Array.isArray(streakRows) && streakRows.length > 0) {
        let s = 0;
        const checkDate = new Date();
        checkDate.setDate(checkDate.getDate() - 1);
        for (const row of streakRows) {
          if (row.goal_date === format(checkDate, "yyyy-MM-dd")) {
            s++;
            checkDate.setDate(checkDate.getDate() - 1);
          } else break;
        }
        if (todayLog?.confirmed) s++;
        setStreak(s);
      } else {
        setStreak(confirmed ? 1 : 0);
      }
    } catch (err) {
      console.error("SmartDailyGoal load error:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    const handleUpdate = () => load();
    window.addEventListener("fixed-expenses-updated", handleUpdate);
    window.addEventListener("sale-completed", handleUpdate);
    window.addEventListener("expense-created", handleUpdate);
    window.addEventListener("deposit-created", handleUpdate);
    return () => {
      window.removeEventListener("fixed-expenses-updated", handleUpdate);
      window.removeEventListener("sale-completed", handleUpdate);
      window.removeEventListener("expense-created", handleUpdate);
      window.removeEventListener("deposit-created", handleUpdate);
    };
  }, [load]);

  useEffect(() => {
    if (editingGoal && editInputRef.current) editInputRef.current.focus();
  }, [editingGoal]);

  const handleConfirm = async () => {
    if (confirmed || confirming) return;
    setConfirming(true);
    try {
      const tid = getTenantId();
      const { error } = await supabase.from("daily_goal_log").upsert({
        goal_date: todayISO(),
        target_amount: dailyGoal,
        actual_revenue: todayRevenue,
        confirmed: true,
        confirmed_at: new Date().toISOString(),
        tenant_id: tid,
      }, { onConflict: "goal_date,tenant_id" });
      if (error) throw error;
      setConfirmed(true);
      setConfirmedAt(new Date().toISOString());
      setStreak((s) => s + 1);
      toast.success(`✅ ¡Meta confirmada! Apartaste $${dailyGoal.toFixed(2)}`);
    } catch (err) {
      toast.error("Error al confirmar meta");
      console.error(err);
    } finally {
      setConfirming(false);
    }
  };

  const startEditGoal = () => {
    setEditGoalValue(dailyGoal > 0 ? dailyGoal.toFixed(2) : "");
    setEditingGoal(true);
  };

  const saveEditGoal = () => {
    const val = parseFloat(editGoalValue);
    if (!isNaN(val) && val >= 0) {
      setGoalOverride(val);
      setGoalOverrideState(val);
      setHasGoal(true);
      toast.success(val === 0 ? "Meta restablecida al cálculo automático" : `Meta diaria actualizada: $${val.toFixed(2)}`);
    }
    setEditingGoal(false);
  };

  const cancelEditGoal = () => setEditingGoal(false);
  const resetGoal = () => {
    setGoalOverride(0);
    setGoalOverrideState(0);
    setEditingGoal(false);
    toast.success("Meta restablecida al cálculo automático");
  };

  // ── Derived ──────────────────────────────────────────────────────────────
  const progress = dailyGoal > 0 ? Math.min(100, (todayRevenue / dailyGoal) * 100) : 0;
  const metGoal = todayRevenue >= dailyGoal && dailyGoal > 0;
  const deficit = Math.max(0, dailyGoal - todayRevenue);

  // ── Compact mode (for mobile/side-by-side) ────────────────────────────────
  if (compact) {
    return (
      <div
        onClick={onClick}
        className={`relative overflow-hidden rounded-[24px] border p-4 cursor-pointer transition-all active:scale-[0.98] ${
          metGoal ? "bg-emerald-500/10 border-emerald-500/20" : "bg-white/[0.03] border-white/[0.08]"
        }`}
      >
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <Target className={`w-4 h-4 ${metGoal ? "text-emerald-400" : "text-cyan-400"}`} />
            <span className="text-[10px] font-black uppercase tracking-widest text-white/40">Meta Diaria</span>
          </div>
          {streak > 1 && (
            <span className="flex items-center gap-1 text-[9px] font-black text-amber-400">
              <Flame className="w-3 h-3" />{streak}
            </span>
          )}
        </div>
        <div className="flex items-end justify-between">
          <p className={`text-xl font-black tracking-tight ${metGoal ? "text-emerald-400" : "text-white"}`}>
            ${todayRevenue.toFixed(2)}
          </p>
          <p className="text-xs text-white/30">/ ${dailyGoal.toFixed(2)}</p>
        </div>
        <div className="mt-2 h-1.5 bg-white/10 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-500 ${metGoal ? "bg-emerald-400" : "bg-cyan-500"}`}
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>
    );
  }

  // ── Full mode ─────────────────────────────────────────────────────────────
  return (
    <div className="relative overflow-hidden bg-gradient-to-br from-cyan-500/10 via-blue-500/5 to-indigo-500/10 border border-white/10 rounded-[32px] p-6 shadow-xl">
      <div className={`absolute -right-8 -top-8 w-32 h-32 rounded-full blur-[60px] opacity-30 transition-all duration-500 ${
        metGoal ? "bg-emerald-400" : "bg-cyan-400"
      }`} />

      {/* Header */}
      <div className="relative flex items-start justify-between mb-5">
        <div className="flex items-center gap-3">
          <div className={`w-11 h-11 rounded-2xl border flex items-center justify-center transition-all ${
            metGoal ? "bg-emerald-500/20 border-emerald-500/30" : "bg-cyan-500/20 border-cyan-500/30"
          }`}>
            <Target className={`w-5 h-5 ${metGoal ? "text-emerald-400" : "text-cyan-400"}`} />
          </div>
          <div>
            <h4 className="text-base font-black text-white tracking-tight">Meta Diaria</h4>
            <p className="text-[9px] font-black uppercase tracking-widest text-white/30">
              {format(new Date(), "EEEE d 'de' MMMM", { locale: es })}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {streak > 0 && (
            <div className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-500/15 border border-amber-500/25 rounded-full">
              <Flame className="w-3.5 h-3.5 text-amber-400" />
              <span className="text-xs font-black text-amber-400">{streak}d</span>
            </div>
          )}
          {onClick && (
            <button onClick={onClick} className="w-8 h-8 rounded-xl bg-white/5 hover:bg-white/10 text-white/30 hover:text-white flex items-center justify-center transition-all">
              <ChevronRight className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Revenue vs Goal */}
      <div className="relative grid grid-cols-2 gap-4 mb-4">
        <div>
          <p className="text-[9px] font-black uppercase tracking-widest text-white/30 mb-1">Ingresado Hoy</p>
          <p className={`text-3xl font-black tracking-tighter ${metGoal ? "text-emerald-400" : "text-white"}`}>
            ${todayRevenue.toFixed(2)}
          </p>
        </div>
        <div className="text-right">
          <div className="flex items-center justify-end gap-1.5 mb-1">
            <p className="text-[9px] font-black uppercase tracking-widest text-white/30">Meta</p>
            {!editingGoal && (
              <button onClick={startEditGoal} className="w-5 h-5 rounded-lg bg-white/5 hover:bg-white/15 flex items-center justify-center transition-all" title="Modificar meta">
                <Pencil className="w-2.5 h-2.5 text-white/40 hover:text-white" />
              </button>
            )}
            {goalOverride > 0 && !editingGoal && (
              <button onClick={resetGoal} className="w-5 h-5 rounded-lg bg-white/5 hover:bg-red-500/20 flex items-center justify-center transition-all" title="Restablecer auto">
                <X className="w-2.5 h-2.5 text-white/30 hover:text-red-400" />
              </button>
            )}
          </div>
          {editingGoal ? (
            <div className="flex items-center justify-end gap-1">
              <span className="text-white/40 text-sm font-bold">$</span>
              <input
                ref={editInputRef}
                type="number"
                min="0"
                step="0.01"
                value={editGoalValue}
                onChange={(e) => setEditGoalValue(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") saveEditGoal(); if (e.key === "Escape") cancelEditGoal(); }}
                className="w-24 bg-white/10 border border-white/20 text-white text-right text-xl font-black rounded-xl px-2 py-0.5 outline-none focus:border-cyan-400/50"
              />
              <button onClick={saveEditGoal} className="w-7 h-7 rounded-xl bg-cyan-500/20 text-cyan-400 hover:bg-cyan-500/30 flex items-center justify-center">
                <Check className="w-3.5 h-3.5" />
              </button>
              <button onClick={cancelEditGoal} className="w-7 h-7 rounded-xl bg-white/5 text-white/40 hover:bg-white/10 flex items-center justify-center">
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          ) : (
            <p className="text-3xl font-black tracking-tighter text-white/50 cursor-pointer hover:text-white/70 transition-colors" onClick={startEditGoal}>
              ${dailyGoal.toFixed(2)}
            </p>
          )}
          {goalOverride > 0 && !editingGoal && (
            <p className="text-[8px] text-white/20 mt-0.5">Manual · Auto: ${autoGoal.toFixed(2)}</p>
          )}
        </div>
      </div>

      {/* Progress bar */}
      <div className="relative mb-4">
        <div className="flex justify-between items-center mb-2">
          <span className="text-[10px] font-black uppercase tracking-widest text-white/30">Progreso</span>
          <span className={`text-xs font-black ${metGoal ? "text-emerald-400" : "text-cyan-400"}`}>
            {progress.toFixed(0)}%
          </span>
        </div>
        <div className="h-3 bg-white/10 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-700 ease-out ${
              metGoal
                ? "bg-gradient-to-r from-emerald-400 to-teal-400 shadow-[0_0_12px_rgba(52,211,153,0.6)]"
                : progress >= 75
                ? "bg-gradient-to-r from-cyan-400 to-blue-400"
                : "bg-gradient-to-r from-cyan-600 to-blue-600"
            }`}
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      {/* Weekly chart */}
      {weeklyData.length > 0 && (
        <div className="relative mb-4 pb-4 border-b border-white/[0.06]">
          <WeeklyChart days={weeklyData} goal={dailyGoal} />
        </div>
      )}

      {/* Status / Action */}
      <div className="relative">
        {loading ? (
          <div className="flex items-center justify-center py-2">
            <RefreshCw className="w-4 h-4 text-white/20 animate-spin" />
          </div>
        ) : confirmed ? (
          <div className="flex items-center gap-3 p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl">
            <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
            <div>
              <p className="text-sm font-black text-emerald-400">¡Apartado confirmado!</p>
              {confirmedAt && (
                <p className="text-[10px] text-emerald-400/60">A las {format(new Date(confirmedAt), "hh:mm a")}</p>
              )}
            </div>
          </div>
        ) : metGoal ? (
          <Button
            onClick={handleConfirm}
            disabled={confirming}
            className="w-full h-12 rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-white font-black text-sm shadow-[0_4px_20px_rgba(52,211,153,0.3)] transition-all active:scale-[0.98]"
          >
            {confirming ? <RefreshCw className="w-4 h-4 animate-spin" /> : (
              <><CheckCircle2 className="w-4 h-4 mr-2" />Confirmar — Apartar ${dailyGoal.toFixed(2)}</>
            )}
          </Button>
        ) : (
          <div className="flex items-center gap-3 p-3 bg-white/[0.03] border border-white/[0.06] rounded-2xl">
            <TrendingUp className="w-5 h-5 text-cyan-400/60 shrink-0" />
            <div>
              <p className="text-sm font-black text-white/60">Faltan ${deficit.toFixed(2)} para la meta</p>
              <p className="text-[10px] text-white/30">Confirma cuando alcances ${dailyGoal.toFixed(2)}</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
