import React, { useState, useEffect, useMemo, useCallback } from "react";
import { supabase } from "../../../../lib/supabase-client.js";
import {
  format,
  startOfDay, endOfDay,
  startOfWeek, endOfWeek,
  startOfMonth, endOfMonth,
  startOfYear, endOfYear,
  parseISO,
} from "date-fns";
import { es } from "date-fns/locale";
import {
  DollarSign, TrendingUp, TrendingDown, BarChart3,
  Users, ClipboardList, CreditCard, Package, Download,
  FileText, RefreshCw, Calendar, ChevronDown, Filter,
  AlertCircle, CheckCircle, Clock, XCircle, Wrench,
  ShoppingBag, Layers, ArrowUpRight, ArrowDownRight,
} from "lucide-react";

// ─── helpers ────────────────────────────────────────────────────────────────

const getTenantId = () => localStorage.getItem("smartfix_tenant_id");

const fmt = (n) =>
  new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN" }).format(n ?? 0);

const fmtDate = (d) => {
  if (!d) return "—";
  try { return format(parseISO(d), "dd/MM/yyyy", { locale: es }); }
  catch { return d; }
};

const capitalize = (s) => s ? s.charAt(0).toUpperCase() + s.slice(1) : "—";

const PAYMENT_LABELS = {
  cash: "Efectivo",
  card: "Tarjeta",
  ath_movil: "ATH Móvil",
  bank_transfer: "Transferencia",
  credit: "Crédito",
  debit: "Débito",
  check: "Cheque",
  other: "Otro",
};

const paymentLabel = (m) => PAYMENT_LABELS[m] || capitalize(m) || "—";

const ORDER_STATUS_LABELS = {
  pending: "Pendiente",
  in_progress: "En Proceso",
  waiting_parts: "Esperando Piezas",
  completed: "Completada",
  delivered: "Entregada",
  cancelled: "Cancelada",
};

const orderStatusLabel = (s) => ORDER_STATUS_LABELS[s] || capitalize(s) || "—";

const STATUS_COLORS = {
  pending: "text-yellow-400 bg-yellow-400/10",
  in_progress: "text-blue-400 bg-blue-400/10",
  waiting_parts: "text-orange-400 bg-orange-400/10",
  completed: "text-emerald-400 bg-emerald-400/10",
  delivered: "text-cyan-400 bg-cyan-400/10",
  cancelled: "text-red-400 bg-red-400/10",
};

// ─── date range helpers ──────────────────────────────────────────────────────

const getPeriodDates = (period, customStart, customEnd) => {
  const now = new Date();
  switch (period) {
    case "today":
      return { start: startOfDay(now), end: endOfDay(now) };
    case "week":
      return { start: startOfWeek(now, { weekStartsOn: 1 }), end: endOfWeek(now, { weekStartsOn: 1 }) };
    case "month":
      return { start: startOfMonth(now), end: endOfMonth(now) };
    case "year":
      return { start: startOfYear(now), end: endOfYear(now) };
    case "custom":
      return {
        start: customStart ? startOfDay(new Date(customStart + "T00:00:00")) : startOfMonth(now),
        end: customEnd ? endOfDay(new Date(customEnd + "T00:00:00")) : endOfMonth(now),
      };
    default:
      return { start: startOfMonth(now), end: endOfMonth(now) };
  }
};

const periodLabel = (period, start, end) => {
  if (period === "today") return format(new Date(), "dd 'de' MMMM yyyy", { locale: es });
  if (period === "week") return `Semana del ${format(start, "dd/MM")} al ${format(end, "dd/MM/yyyy")}`;
  if (period === "month") return format(start, "MMMM yyyy", { locale: es }).replace(/^\w/, c => c.toUpperCase());
  if (period === "year") return format(start, "yyyy");
  return `${format(start, "dd/MM/yyyy")} — ${format(end, "dd/MM/yyyy")}`;
};

// ─── sub-components ──────────────────────────────────────────────────────────

const SkeletonCard = () => (
  <div className="bg-white/[0.03] border border-white/[0.07] rounded-2xl p-6 animate-pulse">
    <div className="h-4 bg-white/10 rounded w-1/3 mb-4" />
    <div className="h-8 bg-white/10 rounded w-1/2 mb-2" />
    <div className="h-3 bg-white/10 rounded w-1/4" />
  </div>
);

const SkeletonTable = () => (
  <div className="animate-pulse space-y-2">
    {[...Array(5)].map((_, i) => (
      <div key={i} className="h-10 bg-white/[0.04] rounded-lg" />
    ))}
  </div>
);

const EmptyState = ({ message = "No hay datos para el período seleccionado" }) => (
  <div className="flex flex-col items-center justify-center py-16 text-white/30">
    <BarChart3 className="w-12 h-12 mb-3 opacity-40" />
    <p className="text-sm">{message}</p>
  </div>
);

const SummaryCard = ({ icon: Icon, title, value, sub, color = "cyan", negative = false }) => {
  const palette = {
    cyan:    { bg: "bg-cyan-500/10",    border: "border-cyan-500/20",    text: "text-cyan-400",    icon: "text-cyan-400/70" },
    emerald: { bg: "bg-emerald-500/10", border: "border-emerald-500/20", text: "text-emerald-400", icon: "text-emerald-400/70" },
    red:     { bg: "bg-red-500/10",     border: "border-red-500/20",     text: "text-red-400",     icon: "text-red-400/70" },
    blue:    { bg: "bg-blue-500/10",    border: "border-blue-500/20",    text: "text-blue-400",    icon: "text-blue-400/70" },
    orange:  { bg: "bg-orange-500/10",  border: "border-orange-500/20",  text: "text-orange-400",  icon: "text-orange-400/70" },
    purple:  { bg: "bg-purple-500/10",  border: "border-purple-500/20",  text: "text-purple-400",  icon: "text-purple-400/70" },
  };
  const c = palette[color] || palette.cyan;
  return (
    <div className={`${c.bg} ${c.border} border rounded-2xl p-5 flex flex-col gap-3`}>
      <div className="flex items-center justify-between">
        <span className="text-white/50 text-xs font-medium uppercase tracking-wider">{title}</span>
        <span className={`${c.icon} p-2 rounded-xl bg-white/[0.04]`}><Icon className="w-4 h-4" /></span>
      </div>
      <div className={`text-2xl font-bold ${negative ? "text-red-400" : c.text}`}>{value}</div>
      {sub && <div className="text-white/40 text-xs">{sub}</div>}
    </div>
  );
};

// Pure-CSS horizontal bar
const CSSBar = ({ value, max, color = "#22d3ee" }) => {
  const pct = max > 0 ? Math.min((value / max) * 100, 100) : 0;
  return (
    <div className="w-full h-2 bg-white/[0.06] rounded-full overflow-hidden">
      <div
        className="h-full rounded-full transition-all duration-500"
        style={{ width: `${pct}%`, backgroundColor: color }}
      />
    </div>
  );
};

// Sticky table header wrapper
const DataTable = ({ headers, children, empty }) => (
  <div className="overflow-x-auto rounded-xl border border-white/[0.07]">
    <table className="w-full text-sm">
      <thead>
        <tr className="border-b border-white/[0.07] bg-white/[0.04]">
          {headers.map((h, i) => (
            <th key={i} className={`px-4 py-3 text-left text-white/50 font-medium text-xs uppercase tracking-wider ${h.right ? "text-right" : ""}`}>
              {h.label ?? h}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {children}
      </tbody>
    </table>
    {empty && <EmptyState />}
  </div>
);

const TR = ({ children, striped }) => (
  <tr className={`border-b border-white/[0.04] hover:bg-white/[0.03] transition-colors ${striped ? "bg-white/[0.015]" : ""}`}>
    {children}
  </tr>
);

const TD = ({ children, right, bold, muted, green, red }) => (
  <td className={`px-4 py-3 ${right ? "text-right" : ""} ${bold ? "font-semibold text-white" : ""} ${muted ? "text-white/40" : "text-white/80"} ${green ? "text-emerald-400 font-semibold" : ""} ${red ? "text-red-400 font-semibold" : ""}`}>
    {children}
  </td>
);

// ─── Period selector ──────────────────────────────────────────────────────────

const PERIODS = [
  { value: "today", label: "Hoy" },
  { value: "week",  label: "Esta Semana" },
  { value: "month", label: "Este Mes" },
  { value: "year",  label: "Este Año" },
  { value: "custom", label: "Personalizado" },
];

const PeriodSelector = ({ period, setPeriod, customStart, setCustomStart, customEnd, setCustomEnd }) => (
  <div className="flex flex-wrap items-center gap-2">
    <div className="flex bg-white/[0.05] border border-white/[0.08] rounded-xl p-1 gap-0.5">
      {PERIODS.map((p) => (
        <button
          key={p.value}
          onClick={() => setPeriod(p.value)}
          className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
            period === p.value
              ? "bg-cyan-500/20 text-cyan-400 border border-cyan-500/30"
              : "text-white/50 hover:text-white/80 hover:bg-white/[0.05]"
          }`}
        >
          {p.label}
        </button>
      ))}
    </div>
    {period === "custom" && (
      <div className="flex items-center gap-2 ml-1">
        <input
          type="date"
          value={customStart}
          onChange={(e) => setCustomStart(e.target.value)}
          className="bg-white/[0.05] border border-white/[0.1] rounded-lg px-3 py-1.5 text-sm text-white/80 focus:outline-none focus:border-cyan-500/50"
        />
        <span className="text-white/30 text-sm">—</span>
        <input
          type="date"
          value={customEnd}
          onChange={(e) => setCustomEnd(e.target.value)}
          className="bg-white/[0.05] border border-white/[0.1] rounded-lg px-3 py-1.5 text-sm text-white/80 focus:outline-none focus:border-cyan-500/50"
        />
      </div>
    )}
  </div>
);

// ─── PDF export ───────────────────────────────────────────────────────────────

const buildPdfHtml = ({ data, periodStr, tenantName }) => {
  const { summary, transactions, orders, products } = data;
  const income = transactions.filter(t => t.type === "income" || t.type === "ingreso");
  const expenses = transactions.filter(t => t.type === "expense" || t.type === "gasto");
  const totalIncome = income.reduce((s, t) => s + (t.amount || 0), 0);
  const totalExpenses = expenses.reduce((s, t) => s + (t.amount || 0), 0);

  const paymentBreakdown = {};
  income.forEach(t => {
    const k = paymentLabel(t.payment_method);
    if (!paymentBreakdown[k]) paymentBreakdown[k] = { count: 0, total: 0 };
    paymentBreakdown[k].count++;
    paymentBreakdown[k].total += t.amount || 0;
  });

  const rows = (arr, cols) =>
    arr.map((r, i) =>
      `<tr style="background:${i % 2 === 0 ? "#fafafa" : "#fff"}">` +
      cols.map(c => `<td style="padding:6px 10px;border-bottom:1px solid #eee;font-size:12px">${c(r)}</td>`).join("") +
      `</tr>`
    ).join("");

  return `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<title>Reporte — ${tenantName}</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; color: #1a1a2e; font-size: 13px; background: #fff; }
  .page { max-width: 1000px; margin: 0 auto; padding: 32px 24px; }
  .header { border-bottom: 3px solid #0ea5e9; padding-bottom: 16px; margin-bottom: 24px; display: flex; justify-content: space-between; align-items: flex-end; }
  .logo { font-size: 22px; font-weight: 800; color: #0ea5e9; }
  .period { font-size: 12px; color: #64748b; text-align: right; }
  .section { margin-bottom: 32px; }
  .section-title { font-size: 14px; font-weight: 700; color: #0f172a; text-transform: uppercase; letter-spacing: .05em; margin-bottom: 12px; padding-bottom: 6px; border-bottom: 1px solid #e2e8f0; }
  .cards { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; margin-bottom: 24px; }
  .card { padding: 16px; background: #f8fafc; border-radius: 8px; border: 1px solid #e2e8f0; }
  .card-label { font-size: 10px; text-transform: uppercase; letter-spacing: .05em; color: #94a3b8; margin-bottom: 4px; }
  .card-value { font-size: 20px; font-weight: 800; color: #0f172a; }
  .card-value.green { color: #10b981; }
  .card-value.red { color: #ef4444; }
  table { width: 100%; border-collapse: collapse; font-size: 12px; }
  thead tr { background: #0ea5e9; color: white; }
  thead th { padding: 8px 10px; text-align: left; font-weight: 600; font-size: 11px; }
  tbody tr:nth-child(even) { background: #f8fafc; }
  td { padding: 6px 10px; border-bottom: 1px solid #e2e8f0; color: #334155; }
  .tfoot td { font-weight: 700; background: #f1f5f9; color: #0f172a; }
  .badge { display: inline-block; padding: 2px 7px; border-radius: 999px; font-size: 10px; font-weight: 600; }
  .badge-green { background: #d1fae5; color: #065f46; }
  .badge-blue  { background: #dbeafe; color: #1e40af; }
  .badge-red   { background: #fee2e2; color: #991b1b; }
  .badge-yellow{ background: #fef9c3; color: #713f12; }
  .badge-gray  { background: #f1f5f9; color: #475569; }
  @media print { @page { margin: 15mm; } }
</style>
</head>
<body>
<div class="page">
  <div class="header">
    <div>
      <div class="logo">${tenantName || "SmartFixOS"}</div>
      <div style="color:#64748b;font-size:12px;margin-top:2px">Sistema de Gestión de Taller</div>
    </div>
    <div class="period">
      <div style="font-size:14px;font-weight:700;color:#0f172a">Reporte de Actividad</div>
      <div>${periodStr}</div>
      <div style="margin-top:4px;color:#94a3b8">Generado: ${format(new Date(), "dd/MM/yyyy HH:mm")}</div>
    </div>
  </div>

  <!-- RESUMEN -->
  <div class="section">
    <div class="section-title">Resumen General</div>
    <div class="cards">
      <div class="card"><div class="card-label">Ingresos Totales</div><div class="card-value green">${fmt(totalIncome)}</div></div>
      <div class="card"><div class="card-label">Gastos Totales</div><div class="card-value red">${fmt(totalExpenses)}</div></div>
      <div class="card"><div class="card-label">Ganancia Neta</div><div class="card-value ${totalIncome - totalExpenses >= 0 ? "green" : "red"}">${fmt(totalIncome - totalExpenses)}</div></div>
      <div class="card"><div class="card-label">Órdenes Completadas</div><div class="card-value">${summary.completedOrders}</div></div>
      <div class="card"><div class="card-label">Ticket Promedio</div><div class="card-value">${fmt(summary.avgTicket)}</div></div>
      <div class="card"><div class="card-label">Clientes Atendidos</div><div class="card-value">${summary.uniqueCustomers}</div></div>
    </div>
  </div>

  <!-- DESGLOSE PAGO -->
  <div class="section">
    <div class="section-title">Desglose por Método de Pago</div>
    <table>
      <thead><tr><th>Método</th><th>Transacciones</th><th>Total</th></tr></thead>
      <tbody>
        ${Object.entries(paymentBreakdown).map(([k, v]) =>
          `<tr><td>${k}</td><td>${v.count}</td><td>${fmt(v.total)}</td></tr>`
        ).join("") || "<tr><td colspan='3' style='color:#94a3b8;text-align:center;padding:12px'>Sin datos</td></tr>"}
        <tr class="tfoot"><td><strong>Total</strong></td><td><strong>${income.length}</strong></td><td><strong>${fmt(totalIncome)}</strong></td></tr>
      </tbody>
    </table>
  </div>

  <!-- INGRESOS -->
  <div class="section">
    <div class="section-title">Ingresos del Período</div>
    <table>
      <thead><tr><th>Fecha</th><th>Descripción</th><th>Categoría</th><th>Método Pago</th><th style="text-align:right">Monto</th></tr></thead>
      <tbody>
        ${income.length
          ? rows(income, [
              r => fmtDate(r.created_date || r.date),
              r => r.description || r.notes || "—",
              r => capitalize(r.category) || "—",
              r => paymentLabel(r.payment_method),
              r => `<span style="text-align:right;display:block;color:#10b981;font-weight:600">${fmt(r.amount)}</span>`,
            ])
          : "<tr><td colspan='5' style='color:#94a3b8;text-align:center;padding:12px'>Sin ingresos registrados</td></tr>"
        }
        <tr class="tfoot"><td colspan="4"><strong>Total Ingresos</strong></td><td style="text-align:right"><strong style="color:#10b981">${fmt(totalIncome)}</strong></td></tr>
      </tbody>
    </table>
  </div>

  <!-- GASTOS -->
  <div class="section">
    <div class="section-title">Gastos del Período</div>
    <table>
      <thead><tr><th>Fecha</th><th>Descripción</th><th>Categoría</th><th>Método Pago</th><th style="text-align:right">Monto</th></tr></thead>
      <tbody>
        ${expenses.length
          ? rows(expenses, [
              r => fmtDate(r.created_date || r.date),
              r => r.description || r.notes || "—",
              r => capitalize(r.category) || "—",
              r => paymentLabel(r.payment_method),
              r => `<span style="text-align:right;display:block;color:#ef4444;font-weight:600">${fmt(r.amount)}</span>`,
            ])
          : "<tr><td colspan='5' style='color:#94a3b8;text-align:center;padding:12px'>Sin gastos registrados</td></tr>"
        }
        <tr class="tfoot"><td colspan="4"><strong>Total Gastos</strong></td><td style="text-align:right"><strong style="color:#ef4444">${fmt(totalExpenses)}</strong></td></tr>
      </tbody>
    </table>
  </div>

  <!-- ÓRDENES -->
  <div class="section">
    <div class="section-title">Órdenes del Período</div>
    <table>
      <thead><tr><th># Orden</th><th>Cliente</th><th>Dispositivo</th><th>Técnico</th><th>Estado</th><th>Fecha</th><th style="text-align:right">Total</th></tr></thead>
      <tbody>
        ${orders.length
          ? rows(orders, [
              r => r.order_number || r.id?.substring(0, 8) || "—",
              r => r.customer_name || "—",
              r => [r.device_brand, r.device_model, r.device_type].filter(Boolean).join(" ") || "—",
              r => r.assigned_technician || "—",
              r => {
                const map = { completed: "badge-green", delivered: "badge-blue", cancelled: "badge-red", pending: "badge-yellow", in_progress: "badge-blue" };
                const cls = map[r.status] || "badge-gray";
                return `<span class="badge ${cls}">${orderStatusLabel(r.status)}</span>`;
              },
              r => fmtDate(r.created_date),
              r => `<span style="text-align:right;display:block;font-weight:600">${fmt(r.total_amount)}</span>`,
            ])
          : "<tr><td colspan='7' style='color:#94a3b8;text-align:center;padding:12px'>Sin órdenes registradas</td></tr>"
        }
      </tbody>
    </table>
  </div>

  <!-- INVENTARIO -->
  <div class="section">
    <div class="section-title">Productos con Stock Bajo</div>
    ${products.lowStock.length > 0
      ? `<table>
          <thead><tr><th>Nombre</th><th>Categoría</th><th style="text-align:right">Stock Actual</th><th style="text-align:right">Stock Mínimo</th></tr></thead>
          <tbody>
            ${rows(products.lowStock, [
              r => r.name,
              r => capitalize(r.category) || "—",
              r => `<span style="text-align:right;display:block;color:#ef4444;font-weight:700">${r.stock}</span>`,
              r => `<span style="text-align:right;display:block">${r.min_stock}</span>`,
            ])}
          </tbody>
        </table>`
      : `<p style="color:#10b981;font-size:13px;padding:12px 0">No hay productos con stock bajo.</p>`
    }
  </div>

  <div style="margin-top:40px;padding-top:16px;border-top:1px solid #e2e8f0;text-align:center;color:#94a3b8;font-size:11px">
    SmartFixOS — Reporte generado automáticamente el ${format(new Date(), "dd 'de' MMMM yyyy 'a las' HH:mm", { locale: es })}
  </div>
</div>
<script>window.onload = () => window.print();</script>
</body>
</html>`;
};

// ─── CSV builders ─────────────────────────────────────────────────────────────

const downloadCSV = (content, filename) => {
  const bom = "\uFEFF";
  const blob = new Blob([bom + content], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};

const csvRow = (arr) => arr.map(v => `"${String(v ?? "").replace(/"/g, '""')}"`).join(",");

const buildCSVForTab = (activeTab, data) => {
  const { transactions, orders, products } = data;
  const income  = transactions.filter(t => t.type === "income" || t.type === "ingreso");
  const expenses = transactions.filter(t => t.type === "expense" || t.type === "gasto");

  if (activeTab === "summary") {
    const paymentBreakdown = {};
    income.forEach(t => {
      const k = paymentLabel(t.payment_method);
      if (!paymentBreakdown[k]) paymentBreakdown[k] = { count: 0, total: 0 };
      paymentBreakdown[k].count++;
      paymentBreakdown[k].total += t.amount || 0;
    });
    const header = csvRow(["Método de Pago", "Transacciones", "Total"]);
    const rows = Object.entries(paymentBreakdown)
      .map(([m, v]) => csvRow([m, v.count, v.total.toFixed(2)]));
    return header + "\n" + rows.join("\n");
  }

  if (activeTab === "transactions") {
    const header = csvRow(["Tipo", "Fecha", "Descripción", "Categoría", "Método Pago", "Monto"]);
    const allTx = [...income, ...expenses].sort((a, b) =>
      (a.created_date || "").localeCompare(b.created_date || "")
    );
    const rows = allTx.map(t => csvRow([
      t.type === "income" || t.type === "ingreso" ? "Ingreso" : "Gasto",
      fmtDate(t.created_date || t.date),
      t.description || t.notes || "",
      t.category || "",
      paymentLabel(t.payment_method),
      (t.amount || 0).toFixed(2),
    ]));
    return header + "\n" + rows.join("\n");
  }

  if (activeTab === "orders") {
    const header = csvRow(["# Orden", "Cliente", "Dispositivo", "Técnico", "Estado", "Fecha", "Total"]);
    const rows = orders.map(o => csvRow([
      o.order_number || o.id || "",
      o.customer_name || "",
      [o.device_brand, o.device_model, o.device_type].filter(Boolean).join(" "),
      o.assigned_technician || "",
      orderStatusLabel(o.status),
      fmtDate(o.created_date),
      (o.total_amount || 0).toFixed(2),
    ]));
    return header + "\n" + rows.join("\n");
  }

  if (activeTab === "inventory") {
    const header = csvRow(["Nombre", "Categoría", "Stock Actual", "Stock Mínimo", "Costo", "Precio", "Valor Total"]);
    const rows = [...products.all].map(p => csvRow([
      p.name || "",
      p.category || "",
      p.stock ?? 0,
      p.min_stock ?? 0,
      (p.cost || 0).toFixed(2),
      (p.price || 0).toFixed(2),
      ((p.stock || 0) * (p.cost || 0)).toFixed(2),
    ]));
    return header + "\n" + rows.join("\n");
  }

  return "";
};

// ─── TAB 1: Resumen General ───────────────────────────────────────────────────

const TabResumen = ({ data, loading }) => {
  const { transactions, orders, summary } = data;
  const income   = useMemo(() => transactions.filter(t => t.type === "income" || t.type === "ingreso"), [transactions]);
  const expenses = useMemo(() => transactions.filter(t => t.type === "expense" || t.type === "gasto"), [transactions]);
  const totalIncome   = income.reduce((s, t) => s + (t.amount || 0), 0);
  const totalExpenses = expenses.reduce((s, t) => s + (t.amount || 0), 0);
  const netProfit = totalIncome - totalExpenses;

  const paymentBreakdown = useMemo(() => {
    const map = {};
    income.forEach(t => {
      const k = t.payment_method || "other";
      if (!map[k]) map[k] = { count: 0, total: 0 };
      map[k].count++;
      map[k].total += t.amount || 0;
    });
    return Object.entries(map).sort((a, b) => b[1].total - a[1].total);
  }, [income]);

  const maxPaymentTotal = paymentBreakdown.length > 0 ? Math.max(...paymentBreakdown.map(([, v]) => v.total)) : 1;

  if (loading) return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">{[...Array(6)].map((_, i) => <SkeletonCard key={i} />)}</div>
      <SkeletonTable />
    </div>
  );

  return (
    <div className="space-y-6">
      {/* KPI cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        <SummaryCard icon={TrendingUp}    color="emerald" title="Ingresos Totales"     value={fmt(totalIncome)}          sub={`${income.length} transacciones`} />
        <SummaryCard icon={TrendingDown}  color="red"     title="Gastos Totales"       value={fmt(totalExpenses)}         sub={`${expenses.length} transacciones`} />
        <SummaryCard icon={DollarSign}    color={netProfit >= 0 ? "cyan" : "red"} title="Ganancia Neta" value={fmt(netProfit)} negative={netProfit < 0} sub={netProfit >= 0 ? "Utilidad positiva" : "Pérdida en el período"} />
        <SummaryCard icon={CheckCircle}   color="blue"    title="Órdenes Completadas"  value={summary.completedOrders}   sub="del período" />
        <SummaryCard icon={CreditCard}    color="orange"  title="Ticket Promedio"       value={fmt(summary.avgTicket)}    sub="por orden completada" />
        <SummaryCard icon={Users}         color="purple"  title="Clientes Atendidos"    value={summary.uniqueCustomers}   sub="clientes únicos" />
      </div>

      {/* Payment method breakdown */}
      <div className="bg-white/[0.03] border border-white/[0.07] rounded-2xl overflow-hidden">
        <div className="px-6 py-4 border-b border-white/[0.07]">
          <h3 className="text-white font-semibold text-sm">Desglose por Método de Pago — Ingresos</h3>
        </div>
        {paymentBreakdown.length === 0
          ? <EmptyState message="Sin transacciones de ingreso en el período" />
          : (
            <DataTable headers={[{ label: "Método de Pago" }, { label: "Transacciones" }, { label: "Total" }, { label: "Participación" }]}>
              {paymentBreakdown.map(([method, v], i) => (
                <TR key={method} striped={i % 2 === 1}>
                  <TD bold>{paymentLabel(method)}</TD>
                  <TD muted>{v.count}</TD>
                  <TD green>{fmt(v.total)}</TD>
                  <td className="px-4 py-3 w-48">
                    <div className="flex items-center gap-2">
                      <CSSBar value={v.total} max={maxPaymentTotal} color="#22d3ee" />
                      <span className="text-white/40 text-xs w-10 text-right">
                        {totalIncome > 0 ? ((v.total / totalIncome) * 100).toFixed(1) : 0}%
                      </span>
                    </div>
                  </td>
                </TR>
              ))}
              <tr className="bg-white/[0.04] border-t border-white/[0.1]">
                <td className="px-4 py-3 text-white font-bold text-sm">Total</td>
                <td className="px-4 py-3 text-white/60 font-semibold text-sm">{income.length}</td>
                <td className="px-4 py-3 text-emerald-400 font-bold text-sm">{fmt(totalIncome)}</td>
                <td className="px-4 py-3" />
              </tr>
            </DataTable>
          )
        }
      </div>

      {/* Orders by status mini summary */}
      {orders.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          {[
            { status: "pending",       label: "Pendientes",    color: "text-yellow-400 bg-yellow-400/10 border-yellow-400/20" },
            { status: "in_progress",   label: "En Proceso",    color: "text-blue-400 bg-blue-400/10 border-blue-400/20" },
            { status: "waiting_parts", label: "Esp. Piezas",   color: "text-orange-400 bg-orange-400/10 border-orange-400/20" },
            { status: "completed",     label: "Completadas",   color: "text-emerald-400 bg-emerald-400/10 border-emerald-400/20" },
            { status: "cancelled",     label: "Canceladas",    color: "text-red-400 bg-red-400/10 border-red-400/20" },
          ].map(({ status, label, color }) => {
            const count = orders.filter(o => o.status === status).length;
            return (
              <div key={status} className={`${color} border rounded-xl p-3 text-center`}>
                <div className="text-2xl font-bold">{count}</div>
                <div className="text-xs mt-0.5 opacity-80">{label}</div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

// ─── TAB 2: Ingresos y Gastos ─────────────────────────────────────────────────

const TabTransactions = ({ data, loading }) => {
  const { transactions } = data;
  const income   = useMemo(() => transactions.filter(t => t.type === "income" || t.type === "ingreso")
    .sort((a, b) => (b.created_date || "").localeCompare(a.created_date || "")), [transactions]);
  const expenses = useMemo(() => transactions.filter(t => t.type === "expense" || t.type === "gasto")
    .sort((a, b) => (b.created_date || "").localeCompare(a.created_date || "")), [transactions]);

  const totalIncome   = income.reduce((s, t) => s + (t.amount || 0), 0);
  const totalExpenses = expenses.reduce((s, t) => s + (t.amount || 0), 0);

  if (loading) return <div className="space-y-6"><SkeletonTable /><SkeletonTable /></div>;

  const txHeaders = [
    { label: "Fecha" },
    { label: "Descripción" },
    { label: "Categoría" },
    { label: "Método Pago" },
    { label: "Monto", right: true },
  ];

  return (
    <div className="space-y-8">
      {/* Income */}
      <div className="bg-white/[0.03] border border-white/[0.07] rounded-2xl overflow-hidden">
        <div className="px-6 py-4 border-b border-white/[0.07] flex items-center justify-between">
          <h3 className="text-emerald-400 font-semibold text-sm flex items-center gap-2">
            <ArrowUpRight className="w-4 h-4" /> Ingresos
          </h3>
          <span className="text-emerald-400 font-bold">{fmt(totalIncome)}</span>
        </div>
        {income.length === 0
          ? <EmptyState message="Sin ingresos en el período seleccionado" />
          : (
            <DataTable headers={txHeaders}>
              {income.map((t, i) => (
                <TR key={t.id || i} striped={i % 2 === 1}>
                  <TD muted>{fmtDate(t.created_date || t.date)}</TD>
                  <TD>{t.description || t.notes || <span className="text-white/30 italic">Sin descripción</span>}</TD>
                  <TD muted>{capitalize(t.category) || "—"}</TD>
                  <TD muted>{paymentLabel(t.payment_method)}</TD>
                  <TD right green>{fmt(t.amount)}</TD>
                </TR>
              ))}
              <tr className="bg-emerald-500/[0.08] border-t border-emerald-500/20">
                <td colSpan={4} className="px-4 py-3 text-white font-bold text-sm">Total Ingresos</td>
                <td className="px-4 py-3 text-emerald-400 font-bold text-sm text-right">{fmt(totalIncome)}</td>
              </tr>
            </DataTable>
          )
        }
      </div>

      {/* Expenses */}
      <div className="bg-white/[0.03] border border-white/[0.07] rounded-2xl overflow-hidden">
        <div className="px-6 py-4 border-b border-white/[0.07] flex items-center justify-between">
          <h3 className="text-red-400 font-semibold text-sm flex items-center gap-2">
            <ArrowDownRight className="w-4 h-4" /> Gastos
          </h3>
          <span className="text-red-400 font-bold">{fmt(totalExpenses)}</span>
        </div>
        {expenses.length === 0
          ? <EmptyState message="Sin gastos en el período seleccionado" />
          : (
            <DataTable headers={txHeaders}>
              {expenses.map((t, i) => (
                <TR key={t.id || i} striped={i % 2 === 1}>
                  <TD muted>{fmtDate(t.created_date || t.date)}</TD>
                  <TD>{t.description || t.notes || <span className="text-white/30 italic">Sin descripción</span>}</TD>
                  <TD muted>{capitalize(t.category) || "—"}</TD>
                  <TD muted>{paymentLabel(t.payment_method)}</TD>
                  <TD right red>{fmt(t.amount)}</TD>
                </TR>
              ))}
              <tr className="bg-red-500/[0.08] border-t border-red-500/20">
                <td colSpan={4} className="px-4 py-3 text-white font-bold text-sm">Total Gastos</td>
                <td className="px-4 py-3 text-red-400 font-bold text-sm text-right">{fmt(totalExpenses)}</td>
              </tr>
            </DataTable>
          )
        }
      </div>
    </div>
  );
};

// ─── TAB 3: Órdenes ───────────────────────────────────────────────────────────

const TabOrders = ({ data, loading }) => {
  const { orders } = data;
  const [statusFilter, setStatusFilter] = useState("all");
  const [techFilter, setTechFilter] = useState("all");

  const technicians = useMemo(() => {
    const set = new Set(orders.map(o => o.assigned_technician).filter(Boolean));
    return [...set].sort();
  }, [orders]);

  const filtered = useMemo(() => {
    return orders.filter(o => {
      if (statusFilter !== "all" && o.status !== statusFilter) return false;
      if (techFilter !== "all" && o.assigned_technician !== techFilter) return false;
      return true;
    });
  }, [orders, statusFilter, techFilter]);

  const byTechnician = useMemo(() => {
    const map = {};
    orders.forEach(o => {
      const k = o.assigned_technician || "Sin asignar";
      if (!map[k]) map[k] = 0;
      map[k]++;
    });
    return Object.entries(map).sort((a, b) => b[1] - a[1]);
  }, [orders]);

  if (loading) return <div className="space-y-4"><SkeletonCard /><SkeletonTable /></div>;

  const statusCounts = {
    completed:     orders.filter(o => o.status === "completed").length,
    delivered:     orders.filter(o => o.status === "delivered").length,
    in_progress:   orders.filter(o => o.status === "in_progress").length,
    waiting_parts: orders.filter(o => o.status === "waiting_parts").length,
    pending:       orders.filter(o => o.status === "pending").length,
    cancelled:     orders.filter(o => o.status === "cancelled").length,
  };

  return (
    <div className="space-y-6">
      {/* Summary strip */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <SummaryCard icon={ClipboardList} color="blue"    title="Total Órdenes"      value={orders.length} />
        <SummaryCard icon={CheckCircle}   color="emerald" title="Completadas/Entregadas" value={statusCounts.completed + statusCounts.delivered} />
        <SummaryCard icon={Clock}         color="orange"  title="En Proceso"         value={statusCounts.in_progress + statusCounts.waiting_parts + statusCounts.pending} />
        <SummaryCard icon={XCircle}       color="red"     title="Canceladas"         value={statusCounts.cancelled} />
      </div>

      {/* By technician */}
      {byTechnician.length > 0 && (
        <div className="bg-white/[0.03] border border-white/[0.07] rounded-2xl overflow-hidden">
          <div className="px-6 py-4 border-b border-white/[0.07]">
            <h3 className="text-white font-semibold text-sm flex items-center gap-2"><Wrench className="w-4 h-4 text-white/40" /> Por Técnico</h3>
          </div>
          <div className="p-4 grid grid-cols-2 md:grid-cols-4 gap-3">
            {byTechnician.map(([tech, count]) => (
              <div key={tech} className="bg-white/[0.04] border border-white/[0.06] rounded-xl p-3">
                <div className="text-white/50 text-xs mb-1 truncate">{tech}</div>
                <div className="text-white font-bold text-xl">{count}</div>
                <CSSBar value={count} max={byTechnician[0][1]} color="#818cf8" />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-center">
        <div className="flex items-center gap-2 text-white/40 text-sm">
          <Filter className="w-4 h-4" /> Filtros:
        </div>
        <select
          value={statusFilter}
          onChange={e => setStatusFilter(e.target.value)}
          className="bg-white/[0.05] border border-white/[0.1] rounded-lg px-3 py-1.5 text-sm text-white/80 focus:outline-none focus:border-cyan-500/50"
        >
          <option value="all">Todos los estados</option>
          {Object.entries(ORDER_STATUS_LABELS).map(([v, l]) => (
            <option key={v} value={v}>{l}</option>
          ))}
        </select>
        {technicians.length > 0 && (
          <select
            value={techFilter}
            onChange={e => setTechFilter(e.target.value)}
            className="bg-white/[0.05] border border-white/[0.1] rounded-lg px-3 py-1.5 text-sm text-white/80 focus:outline-none focus:border-cyan-500/50"
          >
            <option value="all">Todos los técnicos</option>
            {technicians.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
        )}
        {(statusFilter !== "all" || techFilter !== "all") && (
          <span className="text-white/40 text-xs">{filtered.length} resultado{filtered.length !== 1 ? "s" : ""}</span>
        )}
      </div>

      {/* Orders table */}
      <div className="bg-white/[0.03] border border-white/[0.07] rounded-2xl overflow-hidden">
        {filtered.length === 0
          ? <EmptyState message="No hay órdenes para los filtros seleccionados" />
          : (
            <DataTable headers={[
              { label: "# Orden" }, { label: "Cliente" }, { label: "Dispositivo" },
              { label: "Técnico" }, { label: "Estado" }, { label: "Fecha" }, { label: "Total", right: true },
            ]}>
              {filtered.map((o, i) => (
                <TR key={o.id || i} striped={i % 2 === 1}>
                  <TD bold>{o.order_number || `#${o.id?.substring(0, 8)}`}</TD>
                  <TD>{o.customer_name || "—"}</TD>
                  <TD muted>{[o.device_brand, o.device_model].filter(Boolean).join(" ") || o.device_type || "—"}</TD>
                  <TD muted>{o.assigned_technician || <span className="text-white/20">Sin asignar</span>}</TD>
                  <td className="px-4 py-3">
                    <span className={`text-xs font-medium px-2 py-1 rounded-full ${STATUS_COLORS[o.status] || "text-white/40 bg-white/[0.05]"}`}>
                      {orderStatusLabel(o.status)}
                    </span>
                  </td>
                  <TD muted>{fmtDate(o.created_date)}</TD>
                  <TD right bold>{fmt(o.total_amount)}</TD>
                </TR>
              ))}
            </DataTable>
          )
        }
      </div>
    </div>
  );
};

// ─── TAB 4: Inventario ────────────────────────────────────────────────────────

const TabInventory = ({ data, loading }) => {
  const { products } = data;

  const inventoryValue = useMemo(
    () => products.all.reduce((s, p) => s + (p.stock || 0) * (p.cost || 0), 0),
    [products.all]
  );

  if (loading) return <div className="space-y-4"><SkeletonCard /><SkeletonTable /></div>;

  return (
    <div className="space-y-6">
      {/* Summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <SummaryCard icon={Package}    color="blue"    title="Total Productos"    value={products.all.length}        sub="productos activos" />
        <SummaryCard icon={AlertCircle} color="red"   title="Stock Bajo"          value={products.lowStock.length}   sub="requieren reposición" />
        <SummaryCard icon={Layers}     color="orange"  title="Valor del Inventario" value={fmt(inventoryValue)}      sub="al costo" />
        <SummaryCard icon={ShoppingBag} color="purple" title="Categorías"         value={new Set(products.all.map(p => p.category).filter(Boolean)).size} />
      </div>

      {/* Low stock alert */}
      <div className="bg-white/[0.03] border border-white/[0.07] rounded-2xl overflow-hidden">
        <div className="px-6 py-4 border-b border-white/[0.07] flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-red-400" />
          <h3 className="text-white font-semibold text-sm">Productos con Stock Bajo</h3>
          {products.lowStock.length > 0 && (
            <span className="ml-auto text-xs bg-red-500/20 text-red-400 border border-red-500/30 px-2 py-0.5 rounded-full">
              {products.lowStock.length} producto{products.lowStock.length !== 1 ? "s" : ""}
            </span>
          )}
        </div>
        {products.lowStock.length === 0
          ? (
            <div className="flex flex-col items-center justify-center py-10 text-white/30">
              <CheckCircle className="w-8 h-8 mb-2 text-emerald-400/40" />
              <p className="text-sm text-emerald-400/60">Todos los productos tienen stock suficiente</p>
            </div>
          )
          : (
            <DataTable headers={[
              { label: "Nombre" }, { label: "Categoría" },
              { label: "Stock Actual", right: true }, { label: "Stock Mínimo", right: true },
              { label: "Diferencia", right: true },
            ]}>
              {products.lowStock.map((p, i) => {
                const diff = (p.stock || 0) - (p.min_stock || 0);
                return (
                  <TR key={p.id || i} striped={i % 2 === 1}>
                    <TD bold>{p.name}</TD>
                    <TD muted>{capitalize(p.category) || "—"}</TD>
                    <TD right red>{p.stock ?? 0}</TD>
                    <TD right muted>{p.min_stock ?? 0}</TD>
                    <TD right red>{diff}</TD>
                  </TR>
                );
              })}
            </DataTable>
          )
        }
      </div>

      {/* Full inventory value table */}
      <div className="bg-white/[0.03] border border-white/[0.07] rounded-2xl overflow-hidden">
        <div className="px-6 py-4 border-b border-white/[0.07] flex items-center justify-between">
          <h3 className="text-white font-semibold text-sm flex items-center gap-2">
            <Layers className="w-4 h-4 text-white/40" /> Inventario Completo
          </h3>
          <span className="text-cyan-400 font-bold text-sm">{fmt(inventoryValue)}</span>
        </div>
        {products.all.length === 0
          ? <EmptyState message="Sin productos registrados" />
          : (
            <DataTable headers={[
              { label: "Nombre" }, { label: "Categoría" },
              { label: "Stock", right: true }, { label: "Mín.", right: true },
              { label: "Costo", right: true }, { label: "Precio", right: true },
              { label: "Valor Total", right: true },
            ]}>
              {[...products.all]
                .sort((a, b) => (b.stock * (b.cost || 0)) - (a.stock * (a.cost || 0)))
                .map((p, i) => (
                  <TR key={p.id || i} striped={i % 2 === 1}>
                    <TD bold>{p.name}</TD>
                    <TD muted>{capitalize(p.category) || "—"}</TD>
                    <td className={`px-4 py-3 text-right font-semibold text-sm ${p.stock <= (p.min_stock || 0) ? "text-red-400" : "text-white/80"}`}>{p.stock ?? 0}</td>
                    <TD right muted>{p.min_stock ?? 0}</TD>
                    <TD right muted>{fmt(p.cost)}</TD>
                    <TD right muted>{fmt(p.price)}</TD>
                    <TD right bold>{fmt((p.stock || 0) * (p.cost || 0))}</TD>
                  </TR>
                ))
              }
              <tr className="bg-cyan-500/[0.06] border-t border-cyan-500/20">
                <td colSpan={6} className="px-4 py-3 text-white font-bold text-sm">Valor Total del Inventario</td>
                <td className="px-4 py-3 text-cyan-400 font-bold text-sm text-right">{fmt(inventoryValue)}</td>
              </tr>
            </DataTable>
          )
        }
      </div>
    </div>
  );
};

// ─── MAIN PAGE ────────────────────────────────────────────────────────────────

const TABS = [
  { id: "summary",      label: "Resumen General",       icon: BarChart3 },
  { id: "transactions", label: "Ingresos y Gastos",      icon: DollarSign },
  { id: "orders",       label: "Órdenes",                icon: ClipboardList },
  { id: "inventory",    label: "Inventario",             icon: Package },
];

export default function Reports() {
  const [activeTab, setActiveTab] = useState("summary");
  const [period, setPeriod] = useState("month");
  const [customStart, setCustomStart] = useState(format(startOfMonth(new Date()), "yyyy-MM-dd"));
  const [customEnd, setCustomEnd]     = useState(format(endOfMonth(new Date()), "yyyy-MM-dd"));
  const [loading, setLoading] = useState(false);
  const [lastFetched, setLastFetched] = useState(null);

  const [transactions, setTransactions] = useState([]);
  const [orders, setOrders] = useState([]);
  const [products, setProducts] = useState({ all: [], lowStock: [] });

  const tenantId = getTenantId();

  const { start, end } = useMemo(
    () => getPeriodDates(period, customStart, customEnd),
    [period, customStart, customEnd]
  );

  const periodStr = useMemo(() => periodLabel(period, start, end), [period, start, end]);

  const startISO = start.toISOString();
  const endISO   = end.toISOString();

  const summary = useMemo(() => {
    const income = transactions.filter(t => t.type === "income" || t.type === "ingreso");
    const completedOrders = orders.filter(o => o.status === "completed" || o.status === "delivered");
    const totalIncome = income.reduce((s, t) => s + (t.amount || 0), 0);
    const uniqueCustomers = new Set(orders.map(o => o.customer_name).filter(Boolean)).size;
    return {
      completedOrders: completedOrders.length,
      avgTicket: completedOrders.length > 0 ? totalIncome / completedOrders.length : 0,
      uniqueCustomers,
    };
  }, [transactions, orders]);

  const fetchData = useCallback(async () => {
    if (!tenantId) return;
    setLoading(true);
    try {
      const [txRes, ordersRes, productsRes] = await Promise.all([
        supabase
          .from("transaction")
          .select("id, type, amount, description, notes, category, payment_method, created_date, date")
          .eq("tenant_id", tenantId)
          .gte("created_date", startISO)
          .lte("created_date", endISO)
          .order("created_date", { ascending: false }),

        supabase
          .from("order")
          .select("id, order_number, customer_name, device_type, device_brand, device_model, status, assigned_technician, total_amount, created_date")
          .eq("tenant_id", tenantId)
          .gte("created_date", startISO)
          .lte("created_date", endISO)
          .order("created_date", { ascending: false }),

        supabase
          .from("product")
          .select("id, name, stock, min_stock, category, cost, price")
          .eq("tenant_id", tenantId)
          .eq("active", true)
          .order("name"),
      ]);

      if (txRes.error)       console.error("[Reports] transactions error:", txRes.error);
      if (ordersRes.error)   console.error("[Reports] orders error:", ordersRes.error);
      if (productsRes.error) console.error("[Reports] products error:", productsRes.error);

      const allProducts = productsRes.data || [];
      const lowStock = allProducts.filter(p => (p.stock ?? 0) <= (p.min_stock ?? 0));

      setTransactions(txRes.data || []);
      setOrders(ordersRes.data || []);
      setProducts({ all: allProducts, lowStock });
      setLastFetched(new Date());
    } finally {
      setLoading(false);
    }
  }, [tenantId, startISO, endISO]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleExportPDF = () => {
    const tenantName = localStorage.getItem("smartfix_business_name") || "SmartFixOS";
    const html = buildPdfHtml({
      data: { summary, transactions, orders, products },
      periodStr,
      tenantName,
    });
    const win = window.open("", "_blank");
    if (win) {
      win.document.write(html);
      win.document.close();
    }
  };

  const handleExportCSV = () => {
    const csv = buildCSVForTab(activeTab, { transactions, orders, products });
    const tabLabel = TABS.find(t => t.id === activeTab)?.label || activeTab;
    const filename = `reporte_${tabLabel.replace(/\s+/g, "_").toLowerCase()}_${format(start, "yyyyMMdd")}_${format(end, "yyyyMMdd")}.csv`;
    downloadCSV(csv, filename);
  };

  const data = { transactions, orders, products, summary };

  if (!tenantId) {
    return (
      <div className="min-h-screen bg-[#0f0f12] flex items-center justify-center">
        <div className="text-white/40 text-center">
          <AlertCircle className="w-10 h-10 mx-auto mb-3 opacity-40" />
          <p>No se encontró el ID de tenant. Inicia sesión nuevamente.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0f0f12] text-white">
      {/* Sticky header */}
      <div className="sticky top-0 z-30 bg-[#0f0f12]/95 backdrop-blur-sm border-b border-white/[0.07] px-6 py-4">
        <div className="max-w-7xl mx-auto flex flex-col gap-4">
          {/* Title row */}
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div>
              <h1 className="text-xl font-bold text-white">Reportes</h1>
              <p className="text-white/40 text-xs mt-0.5">{periodStr}</p>
            </div>
            <div className="flex items-center gap-2">
              {lastFetched && (
                <span className="text-white/25 text-xs hidden md:block">
                  Actualizado {format(lastFetched, "HH:mm")}
                </span>
              )}
              <button
                onClick={fetchData}
                disabled={loading}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/[0.05] border border-white/[0.1] text-white/60 hover:text-white/90 text-sm transition-colors disabled:opacity-40"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
                <span className="hidden sm:inline">Actualizar</span>
              </button>
              <button
                onClick={handleExportCSV}
                disabled={loading}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/[0.05] border border-white/[0.1] text-white/60 hover:text-white/90 text-sm transition-colors disabled:opacity-40"
              >
                <Download className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">CSV</span>
              </button>
              <button
                onClick={handleExportPDF}
                disabled={loading}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-cyan-500/10 border border-cyan-500/30 text-cyan-400 hover:bg-cyan-500/20 text-sm font-medium transition-colors disabled:opacity-40"
              >
                <FileText className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Exportar PDF</span>
              </button>
            </div>
          </div>
          {/* Period selector */}
          <PeriodSelector
            period={period} setPeriod={setPeriod}
            customStart={customStart} setCustomStart={setCustomStart}
            customEnd={customEnd} setCustomEnd={setCustomEnd}
          />
        </div>
      </div>

      {/* Main content */}
      <div className="max-w-7xl mx-auto px-4 md:px-6 py-6">
        {/* Tabs */}
        <div className="flex border-b border-white/[0.07] mb-6 overflow-x-auto">
          {TABS.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setActiveTab(id)}
              className={`flex items-center gap-2 px-5 py-3 text-sm font-medium border-b-2 whitespace-nowrap transition-colors ${
                activeTab === id
                  ? "border-cyan-500 text-cyan-400"
                  : "border-transparent text-white/40 hover:text-white/70 hover:border-white/20"
              }`}
            >
              <Icon className="w-4 h-4" />
              {label}
            </button>
          ))}
        </div>

        {/* Tab content */}
        {activeTab === "summary"      && <TabResumen      data={data} loading={loading} />}
        {activeTab === "transactions" && <TabTransactions data={data} loading={loading} />}
        {activeTab === "orders"       && <TabOrders       data={data} loading={loading} />}
        {activeTab === "inventory"    && <TabInventory    data={data} loading={loading} />}
      </div>
    </div>
  );
}
