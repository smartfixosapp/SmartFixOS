import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ChevronLeft, ChevronRight, Share } from "lucide-react";
import { supabase } from "../../../../lib/supabase-client.js";
import { AlertDialog, tint } from "@/components/pos/native/posUi";
import { fetchTenant, resolveCurrentEmployee } from "@/lib/orderDetailApi";
import { safeTZ, monthRange, addMonths, monthStart, sameMonth, sameDay, fmt, capitalize, startOfDay, addDays, zonedParts } from "@/lib/finance/tz";
import {
  FP, monthTransactions, ledgerTotals, netoDeltaPercent, monthIVU, ivuPaid, taxRatePercent, recurringItems, recurringRemaining,
  isOneTimePending, pendingPurchaseOrders, isRefund, refundAmount, periodTotals, revenueByCategory, revenueByMethod, expenseRanking,
  monthlySummaries, chartData, monthProjection, planDailyMinimum, MOV_CATEGORY_OPTIONS, periodWeekStart, txDate, num,
} from "@/lib/finance/ledger";
import { loadLedger, subscribeTransactions, payRecurring, payIVU, payPurchaseOrder, undoPayment, updateCategory, currentMonthTransactions } from "@/lib/finance/api";
import { EditPunchesDialog } from "@/components/equipo/Ponches";
import { lastClosedWeek, loadPayroll, payrollLines, paymentsDiffer, punchesDiffer, periodRangeLabel, recordPayrollPayment, fetchEmployees, employeeRate, hoursLabel, payrollDbLabel } from "@/lib/finance/payroll";
import { TodayStrip, MesCard, CuentasButton, QuickActions, DevolucionesCard, Movimientos } from "@/components/finanzas/Resumen";
import ReportesTab from "@/components/finanzas/Reportes";
import PlanTab, { PayrollEditDialog, PayrollHistoryDialog, PayrollReceiptDialog, buildPayrollReceiptPDF, PlanFinancieroDialog, GastosFijosDialog, payrollCSV, displayRole } from "@/components/finanzas/Plan";
import CuentasPorPagarDialog from "@/components/finanzas/Cuentas";
import { AddExpenseDialog, AddIncomeDialog, EditExpenseDialog } from "@/components/finanzas/Forms";
import ReportModuleDialog from "@/components/finanzas/Modules";
import MonthlyReportDialog from "@/components/finanzas/MonthlyReport";
import { sharePDFBlob } from "@/components/pos/native/Receipt";

function storedTenantId() {
  try {
    return localStorage.getItem("smartfix_tenant_id") || "";
  } catch {
    return "";
  }
}

function readNum(key) {
  try {
    return Number(localStorage.getItem(key)) || 0;
  } catch {
    return 0;
  }
}

function writeNum(key, v) {
  try {
    localStorage.setItem(key, String(v || 0));
  } catch {
    return;
  }
}

function readRecurringPayroll() {
  try {
    const a = JSON.parse(localStorage.getItem("smartfix.recurring_payroll.v1") || "[]");
    return Array.isArray(a) ? a : [];
  } catch {
    return [];
  }
}

function useWide() {
  const q = "(min-width: 820px)";
  const [v, setV] = useState(() => typeof window !== "undefined" && window.matchMedia(q).matches);
  useEffect(() => {
    const m = window.matchMedia(q);
    const on = () => setV(m.matches);
    m.addEventListener("change", on);
    return () => m.removeEventListener("change", on);
  }, []);
  return v;
}

const METHOD_LABEL = { cash: "Efectivo", card: "Tarjeta", ath_movil: "ATH Móvil", transfer: "Transferencia", check: "Cheque" };

export default function Finanzas() {
  const navigate = useNavigate();
  const wide = useWide();
  const tenantId = storedTenantId();
  const [tenant, setTenant] = useState(null);
  const [employee, setEmployee] = useState(null);
  const tz = safeTZ(tenant?.timezone);
  const [selectedMonth, setSelectedMonth] = useState(() => new Date());
  const [tab, setTab] = useState("resumen");
  const [ledger, setLedger] = useState({ transactions: [], purchaseOrders: [], oneTimeExpenses: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [employees, setEmployees] = useState([]);
  const [payroll, setPayroll] = useState({ data: null, period: null, lines: [], error: null });
  const [payingAll, setPayingAll] = useState(false);
  const [dialog, setDialog] = useState(null);
  const [editTx, setEditTx] = useState(null);
  const [categoryTx, setCategoryTx] = useState(null);
  const [module, setModule] = useState(null);
  const [payrollEdit, setPayrollEdit] = useState(null);
  const [payrollHistory, setPayrollHistory] = useState(null);
  const [punchScope, setPunchScope] = useState(null);
  const [receipt, setReceipt] = useState(null);
  const [profitGoal, setProfitGoal] = useState(() => readNum("smartfix.plan.monthlyProfitGoal"));
  const [laborOverride, setLaborOverride] = useState(() => readNum("smartfix.plan.laborOverride"));
  const [recurringPayroll, setRecurringPayroll] = useState(readRecurringPayroll);
  const [period, setPeriodState] = useState("mes");
  const [selectedDay, setSelectedDay] = useState(() => new Date());
  const [selectedWeek, setSelectedWeek] = useState(() => new Date());
  const [customRange, setCustomRange] = useState(null);
  const [thisYear, setThisYear] = useState(false);
  const recordedBy = employee?.full_name || "";
  const payrollRef = useRef(payroll);
  payrollRef.current = payroll;
  const ledgerSeq = useRef(0);
  const payrollSeq = useRef(0);
  const [planRows, setPlanRows] = useState([]);

  const load = useCallback(async () => {
    if (!tenantId) return;
    const id = ++ledgerSeq.current;
    setLoading(true);
    try {
      const l = await loadLedger(tenantId, selectedMonth, tz);
      if (id !== ledgerSeq.current) return;
      setLedger(l);
    } catch (e) {
      if (id !== ledgerSeq.current) return;
      setError(e?.message || String(e));
    }
    setLoading(false);
  }, [tenantId, selectedMonth, tz]);

  const refreshPayroll = useCallback(async () => {
    if (!tenantId) return null;
    const id = ++payrollSeq.current;
    const p = lastClosedWeek(tz);
    try {
      const data = await loadPayroll(tenantId, p);
      const lines = payrollLines(data, p).filter((l) => !l.isOrphan);
      const next = { data, period: p, lines, error: null };
      if (id === payrollSeq.current) {
        setPayroll(next);
        payrollRef.current = next;
        setEmployees(data.employees);
      }
      return next;
    } catch (e) {
      const next = { data: null, period: p, lines: [], error: e?.message || String(e) };
      if (id === payrollSeq.current) {
        setPayroll(next);
        payrollRef.current = next;
        fetchEmployees(tenantId).then(setEmployees).catch(() => {});
      }
      return next;
    }
  }, [tenantId, tz]);

  useEffect(() => {
    if (!tenantId) return;
    fetchTenant(tenantId).then(setTenant).catch(() => {});
    resolveCurrentEmployee(tenantId).then(setEmployee).catch(() => {});
  }, [tenantId]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    if (dialog !== "planFin" || !tenantId) return;
    currentMonthTransactions(tenantId, tz).then(setPlanRows).catch(() => setPlanRows(txs));
  }, [dialog, tenantId, tz]);
  useEffect(() => { refreshPayroll(); }, [refreshPayroll]);
  useEffect(() => {
    if (!tenantId) return undefined;
    return subscribeTransactions(tenantId, () => { load(); refreshPayroll(); });
  }, [tenantId, load, refreshPayroll]);

  const reloadAll = useCallback(async () => { await Promise.all([load(), refreshPayroll()]); }, [load, refreshPayroll]);

  const txs = ledger.transactions;
  const monthRows = useMemo(() => monthTransactions(txs, selectedMonth, tz), [txs, selectedMonth, tz]);
  const now = new Date();
  const todayRows = useMemo(() => { const n = new Date(); return txs.filter((t) => { const d = txDate(t); return d && sameDay(d, n, tz); }); }, [txs, tz]);
  const monthLabel = capitalize(fmt(monthStart(selectedMonth, tz), tz, { month: "long", year: "numeric" }).replace(" de ", " "));
  const monthName = capitalize(fmt(monthStart(selectedMonth, tz), tz, { month: "long" }));
  const ratePct = taxRatePercent(tenant);
  const recItems = recurringItems(tenant);
  const totalIVU = monthIVU(monthRows, ratePct);
  const pendingIVU = Math.max(0, totalIVU - ivuPaid(monthRows));
  const unpaidRecurring = recItems.filter((i) => recurringRemaining(i, monthRows) > 0.01);
  const fixedPendingTotal = unpaidRecurring.reduce((s, i) => s + recurringRemaining(i, monthRows), 0);
  const pendingOneTime = ledger.oneTimeExpenses.filter(isOneTimePending).reduce((s, o) => s + num(o.target_amount), 0);
  const pendingPOs = useMemo(() => pendingPurchaseOrders(ledger.purchaseOrders, txs, selectedMonth, tz), [ledger.purchaseOrders, txs, selectedMonth, tz]);
  const pendingPOsTotal = pendingPOs.reduce((s, p) => s + num(p.total_amount), 0);
  const pendingPayrollLines = payroll.error ? [] : payroll.lines.filter((l) => l.balance > 0.01);
  const pendingPayrollTotal = pendingPayrollLines.reduce((s, l) => s + l.balance, 0);
  const totalCuentasPorPagar = fixedPendingTotal + pendingPOsTotal + pendingIVU + pendingPayrollTotal;
  const totalPorPagar = fixedPendingTotal + pendingOneTime + pendingPOsTotal;
  const unperiodedWarning = (() => {
    const names = payroll.lines.filter((l) => l.balance > 0.01 && l.hasUnperiodedPayments).map((l) => `${l.employee.full_name} ${new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(l.unperiodedPaid)}`);
    return names.length ? `Pagos sin período: ${names.join(", ")}` : null;
  })();
  const minimum = planDailyMinimum({ tenant, employees, profitGoal, laborOverride }).minimum;

  const payEmployee = async (emp, amount, method, shownOverride) => {
    const shown = shownOverride || payrollRef.current.lines.find((l) => l.id === emp.id);
    if (payrollRef.current.error) { setError(payrollRef.current.error); return null; }
    const fresh = await refreshPayroll();
    if (!fresh || fresh.error) return null;
    const freshLine = fresh.lines.find((l) => l.id === emp.id);
    const changed = freshLine ? paymentsDiffer(freshLine, shown) || punchesDiffer(freshLine, shown) : paymentsDiffer(shown, null);
    if (changed) { setError("Los ponches o pagos cambiaron en otro dispositivo. Revisa antes de registrar."); return null; }
    const total = amount ?? (freshLine?.balance || 0);
    if (!(total > 0)) { setError(`Define tarifa y horario para ${emp.full_name} antes de pagar.`); return null; }
    try {
      const tx = await recordPayrollPayment({
        tenantId, employeeId: emp.id, employeeName: emp.full_name, amount: total, method,
        notes: `Nomina semanal: ${payrollDbLabel(fresh.period)}`, period: fresh.period, kind: "sueldo",
      });
      setLedger((l) => ({ ...l, transactions: [tx, ...l.transactions] }));
      await refreshPayroll();
      return { tx, receipt: { employeeName: emp.full_name, role: displayRole(emp), paidAt: new Date(), hours: freshLine?.hours || 0, hourlyRate: freshLine?.rate ?? employeeRate(emp), total, method: METHOD_LABEL[method] || method, periodLabel: periodRangeLabel(fresh.period) } };
    } catch (e) {
      setError(e?.message || String(e));
      return null;
    }
  };

  const cuentasModel = {
    totalCuentasPorPagar, pendingIVU, unpaidRecurring, fixedPendingTotal, pendingPayrollLines, pendingPayrollTotal, pendingPOs, pendingPOsTotal,
    payrollError: payroll.error, payrollPeriodLabel: payroll.period ? periodRangeLabel(payroll.period) : "", unperiodedPayrollWarning: unperiodedWarning,
    error, clearError: () => setError(null), payingAll,
    recurringRemaining: (i) => recurringRemaining(i, monthRows),
    payIVU: async (method) => {
      if (!(pendingIVU > 0)) return null;
      try { const tx = await payIVU({ tenantId, amount: pendingIVU, monthName, method, recordedBy }); await load(); return tx; } catch (e) { setError(e?.message || String(e)); return null; }
    },
    payRecurring: async (item, amount, method) => {
      try { const tx = await payRecurring({ tenantId, item, amount, method, recordedBy }); await load(); return tx; } catch (e) { setError(e?.message || String(e)); return null; }
    },
    payPO: async (po, method) => {
      try { const tx = await payPurchaseOrder({ tenantId, po, method, recordedBy }); await load(); return tx; } catch (e) { setError(e?.message || String(e)); return null; }
    },
    payEmployee: async (emp, amount, method) => { const r = await payEmployee(emp, amount, method); await load(); return r?.tx || null; },
    undo: async (tx) => {
      try { await undoPayment({ tx, purchaseOrders: ledger.purchaseOrders }); } catch (e) { setError(e?.message || String(e)); }
      await reloadAll();
    },
    payEverything: async () => {
      if (payingAll) return;
      setPayingAll(true);
      try {
        if (pendingIVU > 0) await payIVU({ tenantId, amount: pendingIVU, monthName, method: "cash", recordedBy }).catch((e) => setError(e?.message || String(e)));
        for (const item of unpaidRecurring) await payRecurring({ tenantId, item, amount: recurringRemaining(item, monthRows), method: "cash", recordedBy }).catch((e) => setError(e?.message || String(e)));
        const fresh = await refreshPayroll();
        for (const l of (fresh?.lines || []).filter((x) => x.balance > 0.01)) await payEmployee(l.employee, undefined, "cash", l);
        for (const po of pendingPOs) await payPurchaseOrder({ tenantId, po, method: "cash", recordedBy }).catch((e) => setError(e?.message || String(e)));
      } finally {
        setPayingAll(false);
        await reloadAll();
      }
    },
  };

  const periodRows = useMemo(() => {
    let range;
    if (customRange) range = customRange;
    else if (period === "dia") { const s = startOfDay(selectedDay, tz); range = { start: s, end: new Date(addDays(s, 1, tz).getTime() - 1000) }; }
    else if (period === "semana") { const s = periodWeekStart(selectedWeek, tz); range = { start: s, end: new Date(addDays(s, 7, tz).getTime() - 1000) }; }
    else range = monthRange(selectedMonth, tz);
    return txs.filter((t) => { const d = txDate(t); return d && d >= range.start && d <= range.end; });
  }, [txs, customRange, period, selectedDay, selectedWeek, selectedMonth, tz]);
  const pt = periodTotals(periodRows);
  const monthPT = periodTotals(monthRows);
  const toISODay = (d) => { const p = zonedParts(d, tz); return `${p.y}-${String(p.m).padStart(2, "0")}-${String(p.d).padStart(2, "0")}`; };
  const fromISODay = (s) => { const [y, m, d] = s.split("-").map(Number); return startOfDay(new Date(Date.UTC(y, m - 1, d, 12)), tz); };
  const navLabel = (() => {
    const short = (d) => fmt(d, tz, { day: "numeric", month: "short" }).replace(".", "");
    if (customRange) {
      const a = short(customRange.start);
      const b = short(customRange.end);
      return capitalize(a === b ? a : `${a} – ${b}`);
    }
    if (period === "dia") return capitalize(fmt(selectedDay, tz, { weekday: "short", day: "numeric", month: "short" }).replace(/\./g, ""));
    if (period === "semana") { const s = periodWeekStart(selectedWeek, tz); return capitalize(`${short(s)} – ${short(addDays(s, 6, tz))}`); }
    return "";
  })();
  const reportes = {
    period, setPeriod: (p) => { setPeriodState(p); setCustomRange(null); },
    customActive: !!customRange, navLabel,
    advanceDay: (d) => setSelectedDay((x) => addDays(x, d, tz)),
    advanceWeek: (d) => setSelectedWeek((x) => addDays(x, 7 * d, tz)),
    selectedDayStr: toISODay(selectedDay), setSelectedDayStr: (s) => setSelectedDay(fromISODay(s)),
    customFromStr: toISODay(customRange?.start || new Date()), customToStr: toISODay(customRange?.end || new Date()),
    applyCustom: (f, t) => {
      const a = fromISODay(f < t ? f : t);
      const b = fromISODay(f < t ? t : f);
      setCustomRange({ start: a, end: new Date(addDays(b, 1, tz).getTime() - 1000) });
    },
    periodEntro: pt.entro, periodSalio: pt.salio, periodNeto: pt.neto, totalPorPagar,
    chart: chartData({ transactions: txs, period, selectedMonth, selectedDay, selectedWeek, customRange, tz }),
    byCategory: revenueByCategory(monthRows), totalEntro: monthPT.entro, byMethod: revenueByMethod(monthRows), ranking: expenseRanking(periodRows),
    months: monthlySummaries(txs, selectedMonth, thisYear ? Math.max(1, zonedParts(selectedMonth, tz).m) : 6, tz),
    thisYear, setThisYear,
    projection: period === "mes" && !customRange ? monthProjection(pt.neto, selectedMonth, tz) : null,
  };

  const lineFor = (emp) => payroll.lines.find((l) => l.id === emp.id);
  const isRecurring = (emp) => recurringPayroll.includes(emp.id);
  const payrollEmployees = payroll.data ? payroll.lines.map((l) => l.employee) : employees.filter((e) => e.active !== false);
  const planModel = {
    periodLabel: payroll.period ? periodRangeLabel(payroll.period) : "",
    pendingCount: pendingPayrollLines.length, pendingTotal: pendingPayrollTotal, weeklyTotal: payroll.lines.reduce((s, l) => s + l.gross, 0),
    activeCount: employees.filter((e) => e.active !== false).length, error: payroll.error, employees: payrollEmployees, unavailable: !payroll.data,
    lineFor, isPaid: (emp) => !!payroll.data && (payroll.error ? 0 : lineFor(emp)?.balance || 0) <= 0.01,
    noteFor: (emp) => {
      const l = lineFor(emp);
      if (!l) return null;
      const parts = [];
      if (l.hasOverlaps) parts.push(`Ponches encimados: ${l.overlapCount} (−${hoursLabel(l.overlapHours)})`);
      if (l.hasUnperiodedPayments) parts.push(`Pago sin período ${new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(l.unperiodedPaid)}`);
      if (l.undatedOrders > 0) parts.push(`Órdenes sin fecha de entrega: ${l.undatedOrders}`);
      return parts.length ? parts.join(" · ") : null;
    },
    isRecurring,
    setRecurring: (emp, on) => setRecurringPayroll((prev) => {
      const next = on ? [...new Set([...prev, emp.id])] : prev.filter((x) => x !== emp.id);
      try { localStorage.setItem("smartfix.recurring_payroll.v1", JSON.stringify(next)); } catch { return next; }
      return next;
    }),
    onEdit: setPayrollEdit, onHistory: setPayrollHistory, onReviewPunches: (emp) => payroll.period && setPunchScope({ employee: emp, period: payroll.period }), payingAll,
    pendingNames: pendingPayrollLines.map((l) => l.employee.full_name).join(", "), unperiodedWarning,
    payAll: async (method) => {
      if (payingAll) return;
      setPayingAll(true);
      try {
        const fresh = await refreshPayroll();
        for (const l of (fresh?.lines || []).filter((x) => x.balance > 0.01)) await payEmployee(l.employee, undefined, method, l);
      } finally {
        setPayingAll(false);
        await reloadAll();
      }
    },
    exportCSV: () => payrollCSV(payrollEmployees, planModel),
  };

  const saveEmployeePayroll = async (baseline, rate, schedule) => {
    const currentRate = employeeRate(baseline);
    const rateChanged = Math.abs(rate - currentRate) > 0.0001 || ((baseline.hourly_rate === null || baseline.hourly_rate === undefined) && rate > 0);
    const newRate = rateChanged ? Math.max(0, rate) : currentRate;
    const baseSched = baseline.schedule && Array.isArray(baseline.schedule.days) ? baseline.schedule : null;
    const schedChanged = JSON.stringify(schedule.days) !== JSON.stringify(baseSched?.days || schedule.days.map((d) => ({ ...d, enabled: false, startHour: 9, startMinute: 0, endHour: 17, endMinute: 0 })))
      || schedule.reminderLeadMinutes !== (baseSched?.reminderLeadMinutes ?? 10) || schedule.remindersEnabled !== (baseSched?.remindersEnabled ?? false);
    const fields = {};
    if (rateChanged) fields.hourly_rate = newRate;
    if (schedChanged || (rateChanged && baseSched)) fields.schedule = { ...schedule, hourlyRate: newRate };
    if (!Object.keys(fields).length) return;
    let q = supabase.from("app_employee").update(fields).eq("id", baseline.id).eq("tenant_id", tenantId);
    if (baseline.updated_at) q = q.eq("updated_at", baseline.updated_at);
    const { data, error: e } = await q.select("*");
    if (e) throw e;
    if (!data || data.length === 0) {
      const { data: cur, error: ce } = await supabase.from("app_employee").select("*").eq("id", baseline.id).eq("tenant_id", tenantId).limit(1);
      if (ce) throw ce;
      if (!cur?.[0]) throw new Error("Este empleado ya no existe.");
      const err = new Error("changed");
      err.fresh = cur[0];
      throw err;
    }
    await refreshPayroll();
  };

  const loadRecurringItems = async () => {
    const { data, error: e } = await supabase.from("tenant").select("settings").eq("id", tenantId).single();
    if (e) throw e;
    setTenant((t) => ({ ...(t || {}), settings: data?.settings || {} }));
    return recurringItems({ settings: data?.settings || {} });
  };

  const applyRecurringOp = async (op) => {
    const { data, error: e } = await supabase.from("tenant").select("settings").eq("id", tenantId).single();
    if (e) throw e;
    const settings = { ...(data?.settings || {}) };
    const current = recurringItems({ settings });
    let items;
    if (op.type === "add") items = [...current, op.item];
    else if (op.type === "replace") items = current.some((x) => x.id === op.item.id) ? current.map((x) => (x.id === op.item.id ? op.item : x)) : [...current, op.item];
    else items = current.filter((x) => x.id !== op.item.id);
    if (items.length) settings.recurring_expenses = { items };
    else delete settings.recurring_expenses;
    const { error: e2 } = await supabase.from("tenant").update({ settings }).eq("id", tenantId);
    if (e2) throw e2;
    setTenant((t) => ({ ...(t || {}), settings }));
    return items;
  };

  const header = (
    <div className="flex items-center gap-3">
      <button onClick={() => setSelectedMonth((m) => addMonths(monthStart(m, tz), -1, tz))} aria-label="Mes anterior" className="apple-press" style={{ width: 36, height: 36, borderRadius: 999, background: tint(FP.brand, 0.12), color: FP.brand, display: "flex", alignItems: "center", justifyContent: "center" }}><ChevronLeft className="w-4 h-4" strokeWidth={2.5} /></button>
      <p className="flex-1 text-center" style={{ fontSize: 22, fontWeight: 700 }}>{monthLabel}</p>
      <button onClick={() => setSelectedMonth((m) => addMonths(monthStart(m, tz), 1, tz))} aria-label="Mes siguiente" className="apple-press" style={{ width: 36, height: 36, borderRadius: 999, background: tint(FP.brand, 0.12), color: FP.brand, display: "flex", alignItems: "center", justifyContent: "center" }}><ChevronRight className="w-4 h-4" strokeWidth={2.5} /></button>
      <button onClick={() => setDialog("monthly")} aria-label="Reporte del mes" className="apple-press" style={{ width: 36, height: 36, borderRadius: 999, background: tint(FP.brand, 0.12), color: FP.brand, display: "flex", alignItems: "center", justifyContent: "center" }}><Share className="w-4 h-4" /></button>
    </div>
  );

  const secondary = (title) => (
    <div className="flex items-center gap-2">
      <button onClick={() => setTab("resumen")} className="flex items-center gap-1" style={{ fontSize: 15, fontWeight: 600, color: FP.brand, width: 90 }}><ChevronLeft className="w-4 h-4" strokeWidth={3} /> Resumen</button>
      <p className="flex-1 text-center" style={{ fontSize: 17, fontWeight: 700 }}>{title}</p>
      <span style={{ width: 90 }} />
    </div>
  );

  return (
    <div className="apple-type" style={{ background: "#000", color: "#fff", minHeight: "calc(100dvh / var(--ui-zoom, 1) - var(--app-nav-h, 0px))", paddingBottom: 120 }}>
      <div className="mx-auto flex flex-col" style={{ maxWidth: 1400, padding: "16px 16px 0", gap: 16 }}>
        <p style={{ fontSize: 34, fontWeight: 800 }}>Contabilidad</p>
        {header}
        {tab === "resumen" && (
          <>
            {sameMonth(selectedMonth, now, tz) && <TodayStrip totals={ledgerTotals(todayRows)} minimum={minimum} />}
            <MesCard totals={ledgerTotals(monthRows)} delta={netoDeltaPercent(txs, selectedMonth, tz)} />
            <CuentasButton total={totalCuentasPorPagar} onClick={() => setDialog("cuentas")} />
            <QuickActions onIncome={() => setDialog("income")} onExpense={() => setDialog("expense")} onReportes={() => setTab("reportes")} onPlan={() => setTab("plan")} />
            <Movimientos
              monthRows={monthRows} loading={loading} error={error} onDismissError={() => setError(null)} monthLabel={monthLabel} tz={tz} wide={wide}
              onAddIncome={() => setDialog("income")} onAddExpense={() => setDialog("expense")} onEditExpense={setEditTx}
              onOpenOrder={(id) => navigate(`/Orders/${id}`)} onChangeCategory={(tx) => setCategoryTx(tx)}
            />
            <DevolucionesCard count={monthRows.filter(isRefund).length} total={monthRows.filter(isRefund).reduce((s, t) => s + refundAmount(t), 0)} />
          </>
        )}
        {tab === "reportes" && (<>{secondary("Reportes")}<ReportesTab r={reportes} wide={wide} onOpenModule={setModule} onOpenMonthly={() => setDialog("monthly")} /></>)}
        {tab === "plan" && (<>{secondary("Plan")}<PlanTab p={planModel} onPlanFinanciero={() => setDialog("planFin")} onGastosFijos={() => setDialog("gastosFijos")} /></>)}
      </div>

      <CuentasPorPagarDialog open={dialog === "cuentas"} onClose={() => setDialog(null)} model={cuentasModel} monthLabel={monthLabel} recordedBy={recordedBy} />
      <AddExpenseDialog open={dialog === "expense"} onClose={() => setDialog(null)} tenantId={tenantId} recordedBy={recordedBy} onSaved={() => load()} />
      <AddIncomeDialog open={dialog === "income"} onClose={() => setDialog(null)} tenantId={tenantId} recordedBy={recordedBy} onSaved={() => load()} />
      <EditExpenseDialog tx={editTx} onClose={() => setEditTx(null)} onChanged={() => load()} />
      <AlertDialog
        open={!!categoryTx}
        title="Cambiar categoría"
        message="Escoge la categoría del gasto"
        onClose={() => setCategoryTx(null)}
        actions={[
          ...MOV_CATEGORY_OPTIONS.map(([k, l]) => ({ label: l, onPress: async () => { const tx = categoryTx; try { await updateCategory(tx.id, tenantId, k); } catch (e) { setError(e?.message || String(e)); } load(); } })),
          { label: "Cancelar", bold: true },
        ]}
      />
      <ReportModuleDialog module={module} onClose={() => setModule(null)} tenantId={tenantId} tz={tz} transactions={txs} />
      <PayrollEditDialog employee={payrollEdit} onClose={() => setPayrollEdit(null)} onSave={saveEmployeePayroll}
        refetch={async (emp) => { const { data, error: e } = await supabase.from("app_employee").select("*").eq("id", emp.id).eq("tenant_id", tenantId).limit(1); if (e) throw e; return data?.[0] || null; }} />
      <EditPunchesDialog open={!!punchScope} scope={punchScope} tenant={tenant} tenantId={tenantId} self={employee} onClose={() => { setPunchScope(null); refreshPayroll(); }} />
      <PayrollHistoryDialog employee={payrollHistory} onClose={() => setPayrollHistory(null)}
        loader={async (emp) => { const { data } = await supabase.from("transaction").select("*").eq("tenant_id", tenantId).eq("type", "expense").eq("category", "payroll").ilike("description", `[emp:${emp.id}]%`).eq("is_deleted", false).order("created_at", { ascending: false }).limit(25); return data || []; }} />
      <PayrollReceiptDialog receipt={receipt} onClose={() => setReceipt(null)}
        onShare={async () => { const blob = await buildPayrollReceiptPDF(receipt, tenant); await sharePDFBlob(blob, `Nomina_${receipt.employeeName.replace(/ /g, "_")}.pdf`); }} />
      <PlanFinancieroDialog open={dialog === "planFin"} onClose={() => setDialog(null)} tenant={tenant} employees={employees}
        monthRows={monthTransactions(planRows, new Date(), tz)} todayRows={planRows.filter((t) => { const d = txDate(t); return d && sameDay(d, new Date(), tz); })} profitGoal={profitGoal} laborOverride={laborOverride}
        onProfitGoal={(v) => { setProfitGoal(v); writeNum("smartfix.plan.monthlyProfitGoal", v); }}
        onLaborOverride={(v) => { setLaborOverride(v); writeNum("smartfix.plan.laborOverride", v); }} />
      <GastosFijosDialog open={dialog === "gastosFijos"} onClose={() => { setDialog(null); load(); }} loadItems={loadRecurringItems} applyOp={applyRecurringOp} />
      <MonthlyReportDialog open={dialog === "monthly"} onClose={() => setDialog(null)} tenantId={tenantId} tenant={tenant} tz={tz} />
    </div>
  );
}
