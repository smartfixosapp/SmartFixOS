import { normalizeTaxPercent } from "@/lib/taxRate";
import { monthRange, addMonths, addDays, startOfDay, zonedParts, sameDay, daysInMonth, daysBetween, fmt, capitalize } from "@/lib/finance/tz";

export function periodWeekStart(date, tz) {
  const day = startOfDay(date, tz);
  const weekday = zonedParts(day, tz).weekday;
  return addDays(day, -((weekday - 1 + 7) % 7), tz);
}

export const FP = {
  entra: "#4DC773",
  sale: "#FF6B61",
  comprometido: "#FFC74D",
  nomina: "#B380E6",
  cheque: "#59A6FF",
  brand: "#F2662E",
  success: "#4DC780",
  warning: "#FFA640",
  danger: "#FF7373",
  info: "#66B3FF",
  vip: "#FFC733",
  brown: "#AC8E68",
  teal: "#40C8E0",
  secondary: "#8E8E93",
};

export const num = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

export const isRevenue = (tx) => tx.type === "revenue";
export const isExpense = (tx) => tx.type === "expense";
export const isRefund = (tx) => tx.type === "refund";
export const isLedgerTx = (tx) => isRevenue(tx) || isExpense(tx) || isRefund(tx);
export const isCheckIssued = (tx) => tx.payment_method === "check" && tx.check_status === "issued";
export const refundAmount = (tx) => Math.abs(num(tx.amount));
export const txDate = (tx) => (tx.created_at ? new Date(tx.created_at) : null);

export function inRange(tx, range) {
  const d = txDate(tx);
  return !!d && d >= range.start && d <= range.end;
}

export function movSigned(tx) {
  if (isRevenue(tx)) return num(tx.amount);
  if (isCheckIssued(tx)) return 0;
  if (isRefund(tx)) return -Math.abs(num(tx.amount));
  return -num(tx.amount);
}

export function movOutMagnitude(tx) {
  return isRefund(tx) ? Math.abs(num(tx.amount)) : num(tx.amount);
}

export function movCatStyle(tx) {
  if (isRefund(tx)) return { key: "refund", label: "Devolución", color: FP.cheque, editable: false };
  const c = String(tx.category || "").toLowerCase();
  if (isRevenue(tx)) {
    if (c === "sale") return { key: "venta", label: "Venta POS", color: FP.entra, editable: false };
    if (c === "repair_payment") return { key: "servicio", label: "Reparación", color: FP.entra, editable: false };
    return { key: "ingreso", label: "Ingreso", color: FP.entra, editable: false };
  }
  switch (c) {
    case "payroll": return { key: "nomina", label: "Nómina", color: FP.nomina, editable: true };
    case "parts": case "inventory": case "supplies": case "purchase": case "stock_in": case "stock_out":
      return { key: "piezas", label: "Piezas", color: FP.brown, editable: true };
    case "rent": return { key: "renta", label: "Renta", color: FP.warning, editable: true };
    case "utilities": return { key: "luz", label: "Luz / Servicios", color: FP.info, editable: true };
    case "tax": case "ivu": case "taxes": return { key: "impuesto", label: "Impuesto", color: FP.comprometido, editable: true };
    case "fixed": return { key: "fijo", label: "Gasto fijo", color: FP.brand, editable: true };
    case "marketing": return { key: "marketing", label: "Marketing", color: FP.danger, editable: true };
    case "repairs": return { key: "reparaciones", label: "Reparaciones", color: FP.teal, editable: true };
    default: return { key: "otro", label: "Otro", color: FP.secondary, editable: true };
  }
}

export const MOV_CATEGORY_OPTIONS = [
  ["parts", "Piezas"], ["rent", "Renta"], ["utilities", "Luz / Servicios"], ["payroll", "Nómina"], ["tax", "Impuesto"],
  ["fixed", "Gasto fijo"], ["marketing", "Marketing"], ["repairs", "Reparaciones"], ["other", "Otro"],
];

export function paymentMethodLabel(raw) {
  switch (String(raw || "").toLowerCase()) {
    case "cash": return "Efectivo";
    case "ath_movil": case "ath": return "ATH Móvil";
    case "card": return "Tarjeta";
    case "transfer": return "Transferencia";
    case "check": return "Cheque";
    case "": return "Otro";
    default: return raw.charAt(0).toUpperCase() + raw.slice(1).toLowerCase();
  }
}

export function displayPaymentMethod(raw) {
  switch (raw) {
    case "cash": return "Efectivo";
    case "card": return "Tarjeta";
    case "ath_movil": return "ATH Movil";
    case "transfer": return "Transferencia";
    default: return raw ? raw.charAt(0).toUpperCase() + raw.slice(1).toLowerCase() : "Otro";
  }
}

export function taxRatePercent(tenant) {
  return normalizeTaxPercent(tenant?.settings?.tax_rate);
}

export function recurringItems(tenant) {
  const items = tenant?.settings?.recurring_expenses?.items;
  return Array.isArray(items) ? items.map((i) => ({ ...i, amount: num(i.amount), day_of_month: parseInt(i.day_of_month, 10) || 1 })) : [];
}

export function monthTransactions(transactions, month, tz) {
  const r = monthRange(month, tz);
  return transactions.filter((tx) => inRange(tx, r));
}

function totalsIn(transactions, range) {
  let entro = 0;
  let salio = 0;
  transactions.forEach((tx) => {
    if (!inRange(tx, range)) return;
    if (isRevenue(tx)) entro += num(tx.amount);
    else if (isExpense(tx) && !isCheckIssued(tx)) salio += num(tx.amount);
    else if (isRefund(tx)) salio += refundAmount(tx);
  });
  return { entro, salio };
}

export function ledgerTotals(rows) {
  let e = 0;
  let s = 0;
  rows.forEach((tx) => {
    if (tx.is_deleted || !isLedgerTx(tx)) return;
    if (isRevenue(tx)) e += num(tx.amount);
    else if (!isCheckIssued(tx)) s += movOutMagnitude(tx);
  });
  return { entro: e, salio: s };
}

export function netoDeltaPercent(transactions, month, tz) {
  const cur = periodTotals(monthTransactions(transactions, month, tz));
  const prev = totalsIn(transactions, monthRange(addMonths(month, -1, tz), tz));
  const prevNet = prev.entro - prev.salio;
  if (prevNet === 0) return null;
  return ((cur.neto - prevNet) / Math.abs(prevNet)) * 100;
}

export function monthIVU(monthRows, ratePercent) {
  const r = ratePercent / 100;
  return monthRows.filter(isRevenue).reduce((sum, tx) => {
    if (tx.tax_amount !== null && tx.tax_amount !== undefined && tx.tax_amount !== "") return sum + num(tx.tax_amount);
    return sum + (num(tx.amount) * r) / (1 + r);
  }, 0);
}

export function ivuPaid(monthRows) {
  return monthRows.filter((tx) => isExpense(tx) && ["tax", "ivu", "taxes"].includes(String(tx.category || "").toLowerCase())).reduce((s, t) => s + num(t.amount), 0);
}

export function recurringPaidAmount(item, monthRows) {
  const needle = String(item.name || "").toLowerCase();
  return monthRows.reduce((sum, tx) => {
    if (!isExpense(tx)) return sum;
    const d = String(tx.description || "").toLowerCase();
    const c = String(tx.category || "").toLowerCase();
    return d.includes(needle) || c.includes(needle) ? sum + num(tx.amount) : sum;
  }, 0);
}

export function recurringRemaining(item, monthRows) {
  return Math.max(0, num(item.amount) - recurringPaidAmount(item, monthRows));
}

export function isOneTimePending(o) {
  const s = String(o.status || "").toLowerCase();
  if (!o.status) return true;
  return !["done", "purchased", "completed", "paid", "comprado", "pagado"].includes(s);
}

export function pendingPurchaseOrders(purchaseOrders, transactions, month, tz) {
  const r = monthRange(month, tz);
  const withExpense = new Set(transactions.filter((t) => isExpense(t) && !t.is_deleted && t.order_id).map((t) => t.order_id));
  return purchaseOrders.filter((po) => {
    const d = po.order_date ? parseISODay(po.order_date, tz) : null;
    if (!d || d < r.start || d > r.end) return false;
    const status = po.status === null || po.status === undefined ? "draft" : String(po.status);
    if (status !== "ordered" && status !== "partial") return false;
    if (/\[PAID:[a-z]+\]/.test(po.notes || "")) return false;
    return !withExpense.has(po.id);
  });
}

function parseISODay(s, tz) {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(s));
  if (!m) return null;
  return startOfDay(new Date(Date.UTC(+m[1], +m[2] - 1, +m[3], 12)), tz);
}

export function revenueByCategory(rows) {
  const t = {};
  rows.filter(isRevenue).forEach((tx) => {
    const key = tx.category === "sale" ? "Ventas POS" : tx.category === "repair_payment" ? "Reparaciones" : "Otros";
    t[key] = (t[key] || 0) + num(tx.amount);
  });
  return Object.entries(t).map(([label, amount]) => ({ label, amount })).sort((a, b) => b.amount - a.amount);
}

export function revenueByMethod(rows) {
  const t = {};
  rows.filter((tx) => isRevenue(tx) && !tx.is_deleted).forEach((tx) => {
    const key = paymentMethodLabel(tx.payment_method);
    t[key] = (t[key] || 0) + num(tx.amount);
  });
  return Object.entries(t).map(([label, amount]) => ({ label, amount })).sort((a, b) => b.amount - a.amount);
}

export function expenseRanking(rows) {
  const t = {};
  rows.filter((tx) => isExpense(tx) && !isCheckIssued(tx)).forEach((tx) => {
    let key;
    if (tx.category === "payroll") key = "Nómina";
    else {
      switch (tx.category) {
        case "fixed": key = "Gastos fijos"; break;
        case "parts": case "inventory": case "supplies": key = "Piezas"; break;
        case "rent": key = "Renta"; break;
        case "utilities": key = "Luz / agua"; break;
        case "tax": case "ivu": case "taxes": key = "Impuesto"; break;
        default: key = tx.category ? tx.category.charAt(0).toUpperCase() + tx.category.slice(1).toLowerCase() : "Otros";
      }
    }
    t[key] = (t[key] || 0) + num(tx.amount);
  });
  return Object.entries(t).map(([label, amount]) => ({ label, amount })).sort((a, b) => b.amount - a.amount);
}

export function periodTotals(rows) {
  const entro = rows.filter(isRevenue).reduce((s, t) => s + num(t.amount), 0);
  const refunds = rows.filter(isRefund).reduce((s, t) => s + refundAmount(t), 0);
  const salio = rows.filter((t) => isExpense(t) && !isCheckIssued(t)).reduce((s, t) => s + num(t.amount), 0) + refunds;
  return { entro, salio, neto: entro - salio, refunds };
}

export function monthlySummaries(transactions, selectedMonth, count, tz) {
  const out = [];
  const anchor = monthRange(selectedMonth, tz).start;
  for (let off = count - 1; off >= 0; off -= 1) {
    const m = addMonths(anchor, -off, tz);
    const t = totalsIn(transactions, monthRange(m, tz));
    out.push({ key: m.getTime(), label: capitalize(fmt(m, tz, { month: "short" }).replace(".", "")), entro: t.entro, salio: t.salio, neto: t.entro - t.salio, isCurrent: off === 0 });
  }
  return out;
}

function bucketsInOut(transactions, keyFn) {
  const b = new Map();
  transactions.forEach((tx) => {
    const d = txDate(tx);
    if (!d) return;
    const k = keyFn(d);
    if (k === null) return;
    const e = b.get(k) || { ingresos: 0, gastos: 0 };
    if (isRevenue(tx)) e.ingresos += num(tx.amount);
    else if (isExpense(tx)) e.gastos += num(tx.amount);
    b.set(k, e);
  });
  return b;
}

export function chartData({ transactions, period, selectedMonth, selectedDay, selectedWeek, customRange, tz }) {
  if (customRange) {
    const start = startOfDay(customRange.start, tz);
    const days = daysBetween(start, customRange.end, tz) + 1;
    if (days <= 0) return [];
    const b = bucketsInOut(transactions.filter((t) => { const d = txDate(t); return d && d >= customRange.start && d <= customRange.end; }), (d) => startOfDay(d, tz).getTime());
    if (days <= 31) {
      const out = [];
      for (let i = 0; i < days; i += 1) {
        const day = addDays(start, i, tz);
        const e = b.get(day.getTime()) || { ingresos: 0, gastos: 0 };
        out.push({ label: fmt(day, tz, { day: "numeric", month: "numeric" }), ...e });
      }
      return out;
    }
    const wk = new Map();
    b.forEach((e, k) => {
      const w = periodWeekStart(new Date(k), tz).getTime();
      const acc = wk.get(w) || { ingresos: 0, gastos: 0 };
      acc.ingresos += e.ingresos;
      acc.gastos += e.gastos;
      wk.set(w, acc);
    });
    return [...wk.keys()].sort((a, c) => a - c).map((k) => ({ label: `Sem ${weekNumber(new Date(k), tz)}`, ...wk.get(k) }));
  }
  if (period === "dia") {
    const b = bucketsInOut(transactions, (d) => startOfDay(d, tz).getTime());
    const anchor = startOfDay(selectedDay, tz);
    const out = [];
    for (let off = 9; off >= 0; off -= 1) {
      const day = addDays(anchor, -off, tz);
      const e = b.get(day.getTime()) || { ingresos: 0, gastos: 0 };
      out.push({ label: fmt(day, tz, { day: "numeric", month: "numeric" }), ...e });
    }
    return out;
  }
  if (period === "semana") {
    const b = bucketsInOut(transactions, (d) => periodWeekStart(d, tz).getTime());
    const anchor = periodWeekStart(selectedWeek, tz);
    const out = [];
    for (let off = 5; off >= 0; off -= 1) {
      const w = addDays(anchor, -7 * off, tz);
      const e = b.get(w.getTime()) || { ingresos: 0, gastos: 0 };
      out.push({ label: `Sem ${weekNumber(w, tz)}`, ...e });
    }
    return out;
  }
  const b = bucketsInOut(transactions, (d) => monthRange(d, tz).start.getTime());
  const anchor = monthRange(selectedMonth, tz).start;
  const out = [];
  for (let off = 4; off >= 0; off -= 1) {
    const m = addMonths(anchor, -off, tz);
    const e = b.get(m.getTime()) || { ingresos: 0, gastos: 0 };
    out.push({ label: capitalize(fmt(m, tz, { month: "short" }).replace(".", "")), ...e });
  }
  return out;
}

export function weekNumber(date, tz) {
  const endOfWeek = zonedParts(addDays(periodWeekStart(date, tz), 6, tz), tz);
  if (endOfWeek.y > zonedParts(date, tz).y) return 1;
  const p = zonedParts(date, tz);
  const jan1 = new Date(Date.UTC(p.y, 0, 1));
  const jan1Weekday = jan1.getUTCDay();
  const dayOfYear = Math.round((Date.UTC(p.y, p.m - 1, p.d) - jan1.getTime()) / 86400000);
  return Math.floor((dayOfYear + jan1Weekday) / 7) + 1;
}

export function monthProjection(periodNeto, selectedMonth, tz) {
  const r = monthRange(selectedMonth, tz);
  const totalDays = daysInMonth(r.start, tz);
  const now = new Date();
  const ref = now < r.end ? now : r.end;
  if (ref < r.start) return null;
  const elapsed = Math.max(1, Math.min(daysBetween(r.start, ref, tz) + 1, totalDays));
  return { elapsedDays: elapsed, totalDays, projectedNet: (periodNeto / elapsed) * totalDays };
}

export function planDailyMinimum({ tenant, employees, profitGoal, laborOverride }) {
  const fixed = recurringItems(tenant).reduce((s, i) => s + num(i.amount), 0);
  const autoLabor = (employees || []).filter((e) => e.active !== false).reduce((sum, emp) => {
    const rate = num(emp.hourly_rate);
    const weekly = (emp.schedule?.days || []).filter((d) => d.enabled).reduce((s, d) => s + dayHours(d), 0);
    return sum + rate * weekly * 4.33;
  }, 0);
  const labor = laborOverride > 0 ? laborOverride : autoLabor;
  const total = fixed + labor + (profitGoal || 0);
  if (!(total > 0)) return { minimum: 0, fixed, labor, autoLabor, total, openDays: openDaysPerWeek(tenant) };
  const openDays = openDaysPerWeek(tenant);
  return { minimum: total / Math.max(1, openDays * 4.33), fixed, labor, autoLabor, total, openDays };
}

export function dayHours(d) {
  let mins = (num(d.endHour) * 60 + num(d.endMinute)) - (num(d.startHour) * 60 + num(d.startMinute));
  if (mins < 0) mins += 24 * 60;
  return mins / 60;
}

export function openDaysPerWeek(tenant) {
  const bh = tenant?.settings?.business_hours;
  if (!bh || typeof bh !== "object") return 6;
  return ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"].filter((k) => bh[k] && !bh[k].closed).length;
}

export { sameDay };
