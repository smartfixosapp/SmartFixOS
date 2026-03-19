import React, { useState, useEffect, useMemo, useCallback } from "react";
import { supabase } from "../../../../lib/supabase-client.js";
import {
  format, startOfDay, endOfDay, startOfWeek, endOfWeek,
  startOfMonth, endOfMonth, startOfYear, endOfYear, parseISO, subMonths,
} from "date-fns";
import { es } from "date-fns/locale";
import {
  DollarSign, TrendingUp, TrendingDown, BarChart3, Users,
  ClipboardList, CreditCard, Package, Download, FileText,
  RefreshCw, Calendar, ChevronDown, ArrowUpRight, ArrowDownRight,
  CheckCircle, Clock, XCircle, Wrench, Printer, AlertCircle,
  ShoppingBag, Receipt, PieChart, Banknote, Percent,
} from "lucide-react";
import {
  LineChart, Line, BarChart, Bar, PieChart as RPieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from "recharts";

// ─── helpers ────────────────────────────────────────────────────────────────
const getTenantId  = () => localStorage.getItem("smartfix_tenant_id");
const getBizName   = () => localStorage.getItem("smartfix_business_name") || "SmartFixOS";

const usd = (n) =>
  new Intl.NumberFormat("es-PR", { style: "currency", currency: "USD" }).format(n ?? 0);

const fmtDate = (d) => {
  if (!d) return "—";
  try { return format(parseISO(d), "dd/MM/yyyy", { locale: es }); }
  catch { return d; }
};

const capitalize = (s) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : "—");

const PAYMENT_LABELS = {
  cash: "Efectivo", card: "Tarjeta", ath_movil: "ATH Móvil",
  bank_transfer: "Transferencia", credit: "Crédito", debit: "Débito",
  check: "Cheque", other: "Otro",
};
const payLabel = (m) => PAYMENT_LABELS[m] || capitalize(m) || "Otro";

const STATUS_META = {
  pending:       { label: "Pendiente",         color: "text-yellow-400 bg-yellow-400/10 border-yellow-400/20" },
  in_progress:   { label: "En Proceso",        color: "text-blue-400   bg-blue-400/10   border-blue-400/20"   },
  waiting_parts: { label: "Esp. Piezas",       color: "text-orange-400 bg-orange-400/10 border-orange-400/20" },
  completed:     { label: "Completada",        color: "text-emerald-400 bg-emerald-400/10 border-emerald-400/20"},
  delivered:     { label: "Entregada",         color: "text-cyan-400   bg-cyan-400/10   border-cyan-400/20"   },
  cancelled:     { label: "Cancelada",         color: "text-red-400    bg-red-400/10    border-red-400/20"    },
};
const statusMeta = (s) => STATUS_META[s] || { label: capitalize(s), color: "text-gray-400 bg-gray-400/10 border-gray-400/20" };

const CHART_COLORS = ["#10B981","#06B6D4","#8B5CF6","#F59E0B","#EF4444","#EC4899","#84CC16","#F97316"];

const getPeriodDates = (period, cStart, cEnd) => {
  const now = new Date();
  switch (period) {
    case "today":   return { start: startOfDay(now),   end: endOfDay(now) };
    case "week":    return { start: startOfWeek(now, { weekStartsOn: 1 }), end: endOfWeek(now, { weekStartsOn: 1 }) };
    case "month":   return { start: startOfMonth(now), end: endOfMonth(now) };
    case "lastmonth": { const lm = subMonths(now,1); return { start: startOfMonth(lm), end: endOfMonth(lm) }; }
    case "year":    return { start: startOfYear(now),  end: endOfYear(now) };
    case "custom":  return { start: cStart ? new Date(cStart) : startOfMonth(now), end: cEnd ? new Date(cEnd + "T23:59:59") : endOfMonth(now) };
    default:        return { start: startOfMonth(now), end: endOfMonth(now) };
  }
};

const periodLabel = (p, s, e) => {
  if (p === "today")     return `Hoy ${format(s, "dd/MM/yyyy")}`;
  if (p === "week")      return `Semana ${format(s,"dd/MM")} – ${format(e,"dd/MM/yyyy")}`;
  if (p === "lastmonth") return format(s, "MMMM yyyy", { locale: es });
  if (p === "month")     return format(s, "MMMM yyyy", { locale: es });
  if (p === "year")      return format(s, "yyyy");
  return `${format(s,"dd/MM/yyyy")} – ${format(e,"dd/MM/yyyy")}`;
};

// ─── KPI Card ───────────────────────────────────────────────────────────────
const KpiCard = ({ icon: Icon, label, value, sub, color = "emerald", trend, onClick }) => {
  const colors = {
    emerald: "from-emerald-500/10 to-emerald-700/5 border-emerald-500/20 text-emerald-400",
    red:     "from-red-500/10     to-red-700/5     border-red-500/20     text-red-400",
    cyan:    "from-cyan-500/10    to-cyan-700/5    border-cyan-500/20    text-cyan-400",
    purple:  "from-purple-500/10  to-purple-700/5  border-purple-500/20  text-purple-400",
    amber:   "from-amber-500/10   to-amber-700/5   border-amber-500/20   text-amber-400",
    blue:    "from-blue-500/10    to-blue-700/5    border-blue-500/20    text-blue-400",
  };
  return (
    <button
      onClick={onClick}
      className={`group w-full text-left bg-gradient-to-br ${colors[color]} border rounded-2xl p-5 transition-all hover:scale-[1.02] hover:shadow-lg`}
    >
      <div className="flex items-start justify-between mb-3">
        <div className={`p-2 rounded-xl bg-white/5 ${colors[color].split(" ")[3]}`}>
          <Icon className="w-5 h-5" />
        </div>
        {trend !== undefined && (
          <span className={`text-xs font-semibold flex items-center gap-0.5 ${trend >= 0 ? "text-emerald-400" : "text-red-400"}`}>
            {trend >= 0 ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
            {Math.abs(trend).toFixed(1)}%
          </span>
        )}
      </div>
      <p className="text-gray-400 text-xs uppercase tracking-wider mb-1">{label}</p>
      <p className={`text-2xl font-black ${colors[color].split(" ")[3]}`}>{value}</p>
      {sub && <p className="text-gray-500 text-xs mt-1">{sub}</p>}
    </button>
  );
};

// ─── Main Component ─────────────────────────────────────────────────────────
export default function Reports() {
  const [period, setPeriod]         = useState("month");
  const [customStart, setCustomStart] = useState("");
  const [customEnd, setCustomEnd]   = useState("");
  const [loading, setLoading]       = useState(false);
  const [lastFetched, setLastFetched] = useState(null);
  const [activeTab, setActiveTab]   = useState("pl");

  const [transactions, setTransactions] = useState([]);
  const [orders, setOrders]             = useState([]);
  const [products, setProducts]         = useState([]);

  const tenantId = getTenantId();

  const { start, end } = useMemo(
    () => getPeriodDates(period, customStart, customEnd),
    [period, customStart, customEnd]
  );

  const fetchData = useCallback(async () => {
    if (!tenantId) return;
    setLoading(true);
    try {
      const [txRes, ordersRes, productsRes] = await Promise.all([
        supabase
          .from("transaction")
          .select("id,type,amount,description,notes,category,payment_method,created_date")
          .eq("tenant_id", tenantId)
          .gte("created_date", start.toISOString())
          .lte("created_date", end.toISOString())
          .order("created_date", { ascending: false }),

        supabase
          .from("order")
          .select("id,order_number,customer_name,device_type,device_brand,device_model,status,assigned_technician,total_amount,deposit_amount,created_date")
          .eq("tenant_id", tenantId)
          .gte("created_date", start.toISOString())
          .lte("created_date", end.toISOString())
          .order("created_date", { ascending: false }),

        supabase
          .from("product")
          .select("id,name,stock,min_stock,category,cost,price,active")
          .eq("tenant_id", tenantId),
      ]);

      setTransactions(txRes.data || []);
      setOrders(ordersRes.data || []);
      setProducts((productsRes.data || []).filter(p => p.active));
      setLastFetched(new Date());
    } catch (e) {
      console.error("[Reports] fetchData error:", e);
    } finally {
      setLoading(false);
    }
  }, [tenantId, start, end]);

  useEffect(() => { fetchData(); }, [fetchData]);

  // ─── computed metrics ────────────────────────────────────────────────────
  const income = useMemo(() =>
    transactions.filter(t => t.type === "income" || t.type === "ingreso"),
    [transactions]
  );
  const expenses = useMemo(() =>
    transactions.filter(t => t.type === "expense" || t.type === "gasto"),
    [transactions]
  );

  const totalIncome   = useMemo(() => income.reduce((s,t)  => s + (t.amount || 0), 0), [income]);
  const totalExpenses = useMemo(() => expenses.reduce((s,t) => s + (t.amount || 0), 0), [expenses]);
  const netProfit     = totalIncome - totalExpenses;
  const margin        = totalIncome > 0 ? (netProfit / totalIncome) * 100 : 0;

  const completedOrders = useMemo(() =>
    orders.filter(o => o.status === "completed" || o.status === "delivered"),
    [orders]
  );
  const avgTicket = completedOrders.length > 0 ? totalIncome / completedOrders.length : 0;
  const uniqueCustomers = useMemo(() =>
    new Set(orders.map(o => o.customer_name).filter(Boolean)).size,
    [orders]
  );
  const lowStock = useMemo(() =>
    products.filter(p => (p.stock ?? 0) <= (p.min_stock ?? 0)),
    [products]
  );

  // income breakdown by payment method
  const byPayment = useMemo(() => {
    const map = {};
    income.forEach(t => {
      const k = t.payment_method || "other";
      map[k] = (map[k] || 0) + (t.amount || 0);
    });
    return Object.entries(map)
      .map(([method, amount]) => ({ method, label: payLabel(method), amount }))
      .sort((a, b) => b.amount - a.amount);
  }, [income]);

  // expense breakdown by category
  const byCategory = useMemo(() => {
    const map = {};
    expenses.forEach(t => {
      const k = t.category || "other";
      map[k] = (map[k] || 0) + (t.amount || 0);
    });
    return Object.entries(map)
      .map(([cat, amount]) => ({ cat: capitalize(cat), amount }))
      .sort((a, b) => b.amount - a.amount);
  }, [expenses]);

  // daily trend for chart
  const dailyTrend = useMemo(() => {
    const map = {};
    transactions.forEach(t => {
      const day = t.created_date ? t.created_date.slice(0, 10) : null;
      if (!day) return;
      if (!map[day]) map[day] = { date: day, label: format(parseISO(day), "dd/MM", { locale: es }), income: 0, expenses: 0 };
      if (t.type === "income" || t.type === "ingreso") map[day].income += t.amount || 0;
      if (t.type === "expense" || t.type === "gasto")  map[day].expenses += t.amount || 0;
    });
    return Object.values(map).sort((a, b) => a.date.localeCompare(b.date));
  }, [transactions]);

  // orders by status for bar chart
  const ordersByStatus = useMemo(() => {
    const map = {};
    orders.forEach(o => {
      const s = o.status || "unknown";
      map[s] = (map[s] || 0) + 1;
    });
    return Object.entries(map).map(([status, count]) => ({
      status: statusMeta(status).label,
      count,
    }));
  }, [orders]);

  // ─── Export PDF ──────────────────────────────────────────────────────────
  const handleExportPDF = () => {
    const bizName  = getBizName();
    const periStr  = periodLabel(period, start, end);
    const now      = format(new Date(), "dd/MM/yyyy HH:mm", { locale: es });

    const rowsIncome = byPayment.map(b => `
      <tr><td>${b.label}</td><td class="num">${usd(b.amount)}</td><td class="num">${totalIncome > 0 ? ((b.amount/totalIncome)*100).toFixed(1) : 0}%</td></tr>
    `).join("");
    const rowsExpenses = byCategory.map(b => `
      <tr><td>${b.cat}</td><td class="num">${usd(b.amount)}</td><td class="num">${totalExpenses > 0 ? ((b.amount/totalExpenses)*100).toFixed(1) : 0}%</td></tr>
    `).join("");
    const rowsOrders = completedOrders.slice(0, 50).map(o => `
      <tr>
        <td>${o.order_number || "—"}</td>
        <td>${o.customer_name || "—"}</td>
        <td>${o.device_brand || ""} ${o.device_model || ""}</td>
        <td>${o.assigned_technician || "—"}</td>
        <td class="num">${usd(o.total_amount)}</td>
        <td>${fmtDate(o.created_date)}</td>
      </tr>
    `).join("");

    const html = `<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8">
    <title>Reporte ${bizName} — ${periStr}</title>
    <style>
      * { margin:0; padding:0; box-sizing:border-box; }
      body { font-family: 'Segoe UI', Arial, sans-serif; color:#111; padding:30px; font-size:13px; }
      .header { display:flex; justify-content:space-between; align-items:flex-start; border-bottom:3px solid #111; padding-bottom:16px; margin-bottom:24px; }
      .biz { font-size:22px; font-weight:900; }
      .sub { font-size:12px; color:#555; margin-top:4px; }
      .kpi-grid { display:grid; grid-template-columns:repeat(3,1fr); gap:12px; margin-bottom:24px; }
      .kpi { border:1px solid #ddd; border-radius:10px; padding:14px; }
      .kpi-label { font-size:10px; text-transform:uppercase; letter-spacing:.05em; color:#666; }
      .kpi-val { font-size:22px; font-weight:900; margin-top:4px; }
      .kpi-val.green { color:#059669; } .kpi-val.red { color:#DC2626; } .kpi-val.blue { color:#0284C7; }
      h2 { font-size:15px; font-weight:800; margin:20px 0 10px; border-bottom:1px solid #eee; padding-bottom:6px; }
      table { width:100%; border-collapse:collapse; margin-bottom:20px; }
      th { background:#f4f4f4; font-size:11px; text-transform:uppercase; letter-spacing:.04em; padding:8px 10px; text-align:left; }
      td { padding:7px 10px; border-bottom:1px solid #f0f0f0; font-size:12px; }
      .num { text-align:right; font-variant-numeric:tabular-nums; }
      .total-row td { font-weight:800; border-top:2px solid #111; }
      .footer { margin-top:30px; font-size:10px; color:#999; text-align:center; }
      @media print { body { padding:20px; } }
    </style></head><body>
    <div class="header">
      <div><div class="biz">${bizName}</div><div class="sub">Estado de Resultados — ${periStr}</div></div>
      <div class="sub" style="text-align:right">Generado: ${now}<br>SmartFixOS</div>
    </div>

    <div class="kpi-grid">
      <div class="kpi"><div class="kpi-label">Ingresos Totales</div><div class="kpi-val green">${usd(totalIncome)}</div></div>
      <div class="kpi"><div class="kpi-label">Gastos Totales</div><div class="kpi-val red">${usd(totalExpenses)}</div></div>
      <div class="kpi"><div class="kpi-label">Utilidad Neta</div><div class="kpi-val ${netProfit >= 0 ? "green" : "red"}">${usd(netProfit)}</div></div>
      <div class="kpi"><div class="kpi-label">Margen</div><div class="kpi-val blue">${margin.toFixed(1)}%</div></div>
      <div class="kpi"><div class="kpi-label">Órdenes Completadas</div><div class="kpi-val">${completedOrders.length}</div></div>
      <div class="kpi"><div class="kpi-label">Ticket Promedio</div><div class="kpi-val">${usd(avgTicket)}</div></div>
    </div>

    <h2>💰 Ingresos por Método de Pago</h2>
    <table><thead><tr><th>Método</th><th class="num">Monto</th><th class="num">%</th></tr></thead>
    <tbody>${rowsIncome}<tr class="total-row"><td>TOTAL</td><td class="num">${usd(totalIncome)}</td><td class="num">100%</td></tr></tbody></table>

    <h2>📉 Gastos por Categoría</h2>
    <table><thead><tr><th>Categoría</th><th class="num">Monto</th><th class="num">%</th></tr></thead>
    <tbody>${rowsExpenses}<tr class="total-row"><td>TOTAL</td><td class="num">${usd(totalExpenses)}</td><td class="num">100%</td></tr></tbody></table>

    <h2>📋 Órdenes Completadas (últimas 50)</h2>
    <table><thead><tr><th>#</th><th>Cliente</th><th>Dispositivo</th><th>Técnico</th><th class="num">Total</th><th>Fecha</th></tr></thead>
    <tbody>${rowsOrders}</tbody></table>

    <div class="footer">Reporte generado por SmartFixOS • ${bizName} • ${periStr}</div>
    </body></html>`;

    const w = window.open("", "_blank");
    w.document.write(html);
    w.document.close();
    setTimeout(() => w.print(), 500);
  };

  // ─── Export CSV ──────────────────────────────────────────────────────────
  const handleExportCSV = () => {
    const rows = [["Fecha","Tipo","Categoría","Descripción","Método de Pago","Monto"]];
    transactions.forEach(t => {
      rows.push([
        fmtDate(t.created_date),
        t.type === "income" || t.type === "ingreso" ? "Ingreso" : "Gasto",
        capitalize(t.category || ""),
        `"${(t.description || "").replace(/"/g, "'")}"`,
        payLabel(t.payment_method),
        (t.amount || 0).toFixed(2),
      ]);
    });
    const csv = rows.map(r => r.join(",")).join("\n");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    a.download = `reporte_${format(start,"yyyy-MM-dd")}_${format(end,"yyyy-MM-dd")}.csv`;
    a.click();
  };

  // ─── UI ──────────────────────────────────────────────────────────────────
  const tabs = [
    { id: "pl",      label: "Estado de Resultados", icon: Receipt },
    { id: "orders",  label: "Órdenes",              icon: ClipboardList },
    { id: "txns",    label: "Transacciones",         icon: DollarSign },
    { id: "charts",  label: "Gráficas",             icon: BarChart3 },
  ];

  return (
    <div className="min-h-screen bg-[#080810] text-white">
      {/* Header */}
      <div className="bg-[#0f0f18]/80 backdrop-blur-xl border-b border-white/5 px-6 py-5 sticky top-0 z-20">
        <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-black tracking-tight">Reportes</h1>
            <p className="text-gray-500 text-sm mt-0.5">
              {periodLabel(period, start, end)}
              {lastFetched && <span className="ml-2 text-gray-600">· actualizado {format(lastFetched,"HH:mm")}</span>}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Period pills */}
            {[
              { k:"today", l:"Hoy" },
              { k:"week",  l:"Semana" },
              { k:"month", l:"Este mes" },
              { k:"lastmonth", l:"Mes anterior" },
              { k:"year",  l:"Año" },
              { k:"custom",l:"Personalizado" },
            ].map(p => (
              <button
                key={p.k}
                onClick={() => setPeriod(p.k)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                  period === p.k
                    ? "bg-cyan-500/20 text-cyan-300 border border-cyan-500/40"
                    : "bg-white/5 text-gray-400 border border-white/5 hover:border-white/20"
                }`}
              >
                {p.l}
              </button>
            ))}

            {period === "custom" && (
              <>
                <input type="date" value={customStart} onChange={e => setCustomStart(e.target.value)}
                  className="bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-xs text-white" />
                <input type="date" value={customEnd} onChange={e => setCustomEnd(e.target.value)}
                  className="bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-xs text-white" />
              </>
            )}

            <button onClick={fetchData} disabled={loading}
              className="p-2 rounded-lg bg-white/5 border border-white/10 hover:border-white/20 transition-all">
              <RefreshCw className={`w-4 h-4 text-gray-400 ${loading ? "animate-spin" : ""}`} />
            </button>
            <button onClick={handleExportCSV}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 hover:border-emerald-500/40 text-gray-400 hover:text-emerald-400 text-xs font-semibold transition-all">
              <Download className="w-3.5 h-3.5" /> CSV
            </button>
            <button onClick={handleExportPDF}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-cyan-500/10 border border-cyan-500/30 text-cyan-400 hover:bg-cyan-500/20 text-xs font-semibold transition-all">
              <Printer className="w-3.5 h-3.5" /> Exportar PDF
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-6 space-y-6">
        {/* KPI Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          <KpiCard icon={TrendingUp}    color="emerald" label="Ingresos"         value={usd(totalIncome)}       sub={`${income.length} transacciones`} />
          <KpiCard icon={TrendingDown}  color="red"     label="Gastos"           value={usd(totalExpenses)}     sub={`${expenses.length} transacciones`} />
          <KpiCard icon={DollarSign}    color="cyan"    label="Utilidad Neta"    value={usd(netProfit)}         sub={netProfit >= 0 ? "Positivo ✓" : "⚠ Negativo"} />
          <KpiCard icon={Percent}       color="purple"  label="Margen"           value={`${margin.toFixed(1)}%`} sub="Sobre ingresos" />
          <KpiCard icon={ClipboardList} color="blue"    label="Órdenes"          value={orders.length}          sub={`${completedOrders.length} completadas`} />
          <KpiCard icon={Banknote}      color="amber"   label="Ticket Promedio"  value={usd(avgTicket)}         sub={`${uniqueCustomers} clientes`} />
        </div>

        {/* Tabs */}
        <div className="flex gap-1 bg-white/5 rounded-xl p-1 border border-white/5">
          {tabs.map(t => (
            <button key={t.id} onClick={() => setActiveTab(t.id)}
              className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-3 rounded-lg text-sm font-semibold transition-all ${
                activeTab === t.id
                  ? "bg-white/10 text-white shadow"
                  : "text-gray-500 hover:text-gray-300"
              }`}
            >
              <t.icon className="w-4 h-4" />
              <span className="hidden sm:inline">{t.label}</span>
            </button>
          ))}
        </div>

        {/* ── TAB: P&L ── */}
        {activeTab === "pl" && (
          <div className="grid lg:grid-cols-2 gap-6">
            {/* Estado de resultados */}
            <div className="bg-white/[0.03] border border-white/8 rounded-2xl overflow-hidden">
              <div className="px-6 py-4 border-b border-white/5">
                <h2 className="font-black text-white">Estado de Resultados</h2>
                <p className="text-gray-500 text-xs mt-0.5">{periodLabel(period, start, end)}</p>
              </div>
              <div className="p-6 space-y-3">
                {/* Income lines */}
                <p className="text-xs text-gray-500 uppercase tracking-wider font-semibold">Ingresos</p>
                {byPayment.length === 0
                  ? <p className="text-gray-600 text-sm">Sin ingresos en el período</p>
                  : byPayment.map(b => (
                    <div key={b.method} className="flex justify-between items-center py-1">
                      <span className="text-gray-300 text-sm">{b.label}</span>
                      <span className="text-emerald-400 font-semibold tabular-nums">{usd(b.amount)}</span>
                    </div>
                  ))
                }
                <div className="flex justify-between items-center py-2 border-t border-white/10">
                  <span className="font-black text-white">Total Ingresos</span>
                  <span className="font-black text-emerald-400 text-lg tabular-nums">{usd(totalIncome)}</span>
                </div>

                <div className="pt-2">
                  <p className="text-xs text-gray-500 uppercase tracking-wider font-semibold mb-2">Gastos</p>
                  {byCategory.length === 0
                    ? <p className="text-gray-600 text-sm">Sin gastos en el período</p>
                    : byCategory.map(b => (
                      <div key={b.cat} className="flex justify-between items-center py-1">
                        <span className="text-gray-300 text-sm">{b.cat}</span>
                        <span className="text-red-400 font-semibold tabular-nums">({usd(b.amount)})</span>
                      </div>
                    ))
                  }
                  <div className="flex justify-between items-center py-2 border-t border-white/10">
                    <span className="font-black text-white">Total Gastos</span>
                    <span className="font-black text-red-400 text-lg tabular-nums">({usd(totalExpenses)})</span>
                  </div>
                </div>

                <div className={`flex justify-between items-center py-3 px-4 rounded-xl mt-2 ${netProfit >= 0 ? "bg-emerald-500/10 border border-emerald-500/20" : "bg-red-500/10 border border-red-500/20"}`}>
                  <div>
                    <p className="font-black text-white text-base">Utilidad Neta</p>
                    <p className="text-gray-400 text-xs">Margen: {margin.toFixed(1)}%</p>
                  </div>
                  <span className={`font-black text-2xl tabular-nums ${netProfit >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                    {usd(netProfit)}
                  </span>
                </div>
              </div>
            </div>

            {/* Sidebar cards */}
            <div className="space-y-4">
              {/* Payment method breakdown */}
              <div className="bg-white/[0.03] border border-white/8 rounded-2xl p-5">
                <h3 className="font-bold text-white mb-4 text-sm">Ingresos por Método de Pago</h3>
                <div className="space-y-3">
                  {byPayment.map((b, i) => (
                    <div key={b.method}>
                      <div className="flex justify-between text-sm mb-1">
                        <span className="text-gray-300">{b.label}</span>
                        <span className="text-white font-semibold tabular-nums">{usd(b.amount)}</span>
                      </div>
                      <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full"
                          style={{
                            width: totalIncome > 0 ? `${(b.amount/totalIncome)*100}%` : "0%",
                            background: CHART_COLORS[i % CHART_COLORS.length],
                          }}
                        />
                      </div>
                    </div>
                  ))}
                  {byPayment.length === 0 && <p className="text-gray-600 text-sm">Sin datos</p>}
                </div>
              </div>

              {/* Expense by category */}
              <div className="bg-white/[0.03] border border-white/8 rounded-2xl p-5">
                <h3 className="font-bold text-white mb-4 text-sm">Gastos por Categoría</h3>
                <div className="space-y-3">
                  {byCategory.map((b, i) => (
                    <div key={b.cat}>
                      <div className="flex justify-between text-sm mb-1">
                        <span className="text-gray-300">{b.cat}</span>
                        <span className="text-red-400 font-semibold tabular-nums">{usd(b.amount)}</span>
                      </div>
                      <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full bg-red-500"
                          style={{ width: totalExpenses > 0 ? `${(b.amount/totalExpenses)*100}%` : "0%", opacity: 0.6 + (i * 0.1) }}
                        />
                      </div>
                    </div>
                  ))}
                  {byCategory.length === 0 && <p className="text-gray-600 text-sm">Sin datos</p>}
                </div>
              </div>

              {/* Low stock alert */}
              {lowStock.length > 0 && (
                <div className="bg-amber-500/5 border border-amber-500/20 rounded-2xl p-5">
                  <div className="flex items-center gap-2 mb-3">
                    <AlertCircle className="w-4 h-4 text-amber-400" />
                    <h3 className="font-bold text-amber-400 text-sm">{lowStock.length} Productos con Stock Bajo</h3>
                  </div>
                  <div className="space-y-1.5 max-h-32 overflow-auto">
                    {lowStock.map(p => (
                      <div key={p.id} className="flex justify-between text-xs">
                        <span className="text-gray-300">{p.name}</span>
                        <span className="text-amber-400 font-semibold">{p.stock} / {p.min_stock} mín</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── TAB: ORDERS ── */}
        {activeTab === "orders" && (
          <div className="bg-white/[0.03] border border-white/8 rounded-2xl overflow-hidden">
            <div className="px-6 py-4 border-b border-white/5 flex items-center justify-between">
              <h2 className="font-black text-white">Órdenes del Período</h2>
              <span className="text-gray-500 text-sm">{orders.length} órdenes</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-white/5">
                    {["#","Cliente","Dispositivo","Técnico","Estado","Total","Fecha"].map(h => (
                      <th key={h} className="px-5 py-3 text-left text-xs text-gray-500 uppercase tracking-wider font-semibold">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {orders.length === 0 ? (
                    <tr><td colSpan={7} className="px-5 py-10 text-center text-gray-600">Sin órdenes en este período</td></tr>
                  ) : orders.map(o => {
                    const sm = statusMeta(o.status);
                    return (
                      <tr key={o.id} className="border-b border-white/[0.03] hover:bg-white/[0.02] transition-colors">
                        <td className="px-5 py-3 font-mono text-cyan-400 text-xs">{o.order_number || "—"}</td>
                        <td className="px-5 py-3 text-white font-medium">{o.customer_name || "—"}</td>
                        <td className="px-5 py-3 text-gray-400">{[o.device_brand, o.device_model].filter(Boolean).join(" ") || o.device_type || "—"}</td>
                        <td className="px-5 py-3 text-gray-400">{o.assigned_technician || "—"}</td>
                        <td className="px-5 py-3">
                          <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-semibold border ${sm.color}`}>{sm.label}</span>
                        </td>
                        <td className="px-5 py-3 text-white font-semibold tabular-nums">{usd(o.total_amount)}</td>
                        <td className="px-5 py-3 text-gray-400 text-xs">{fmtDate(o.created_date)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ── TAB: TRANSACTIONS ── */}
        {activeTab === "txns" && (
          <div className="bg-white/[0.03] border border-white/8 rounded-2xl overflow-hidden">
            <div className="px-6 py-4 border-b border-white/5 flex items-center justify-between">
              <h2 className="font-black text-white">Transacciones</h2>
              <div className="flex items-center gap-4 text-sm">
                <span className="text-emerald-400 font-semibold">{income.length} ingresos</span>
                <span className="text-red-400 font-semibold">{expenses.length} gastos</span>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-white/5">
                    {["Fecha","Tipo","Descripción","Categoría","Método","Monto"].map(h => (
                      <th key={h} className="px-5 py-3 text-left text-xs text-gray-500 uppercase tracking-wider font-semibold">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {transactions.length === 0 ? (
                    <tr><td colSpan={6} className="px-5 py-10 text-center text-gray-600">Sin transacciones en este período</td></tr>
                  ) : transactions.map(t => {
                    const isIncome = t.type === "income" || t.type === "ingreso";
                    return (
                      <tr key={t.id} className="border-b border-white/[0.03] hover:bg-white/[0.02] transition-colors">
                        <td className="px-5 py-3 text-gray-400 text-xs">{fmtDate(t.created_date)}</td>
                        <td className="px-5 py-3">
                          <span className={`inline-flex items-center gap-1 text-xs font-semibold ${isIncome ? "text-emerald-400" : "text-red-400"}`}>
                            {isIncome ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
                            {isIncome ? "Ingreso" : "Gasto"}
                          </span>
                        </td>
                        <td className="px-5 py-3 text-white max-w-xs truncate">{t.description || "—"}</td>
                        <td className="px-5 py-3 text-gray-400 text-xs">{capitalize(t.category) || "—"}</td>
                        <td className="px-5 py-3 text-gray-400 text-xs">{payLabel(t.payment_method)}</td>
                        <td className={`px-5 py-3 font-black tabular-nums ${isIncome ? "text-emerald-400" : "text-red-400"}`}>
                          {isIncome ? "+" : "-"}{usd(t.amount)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                {transactions.length > 0 && (
                  <tfoot>
                    <tr className="border-t border-white/10 bg-white/[0.02]">
                      <td colSpan={4} className="px-5 py-3 font-black text-white text-sm">TOTALES</td>
                      <td className="px-5 py-3 font-black text-emerald-400 tabular-nums">+{usd(totalIncome)}</td>
                      <td className="px-5 py-3 font-black text-red-400 tabular-nums">-{usd(totalExpenses)}</td>
                    </tr>
                    <tr className="bg-white/[0.03]">
                      <td colSpan={4} className="px-5 py-3 font-black text-white text-sm">UTILIDAD NETA</td>
                      <td colSpan={2} className={`px-5 py-3 font-black text-xl tabular-nums ${netProfit >= 0 ? "text-cyan-400" : "text-red-400"}`}>{usd(netProfit)}</td>
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
          </div>
        )}

        {/* ── TAB: CHARTS ── */}
        {activeTab === "charts" && (
          <div className="grid lg:grid-cols-2 gap-6">
            {/* Trend chart */}
            <div className="bg-white/[0.03] border border-white/8 rounded-2xl p-5 lg:col-span-2">
              <h3 className="font-bold text-white mb-5">Evolución: Ingresos vs Gastos</h3>
              {dailyTrend.length === 0
                ? <p className="text-gray-600 text-sm text-center py-10">Sin datos para graficar</p>
                : (
                  <ResponsiveContainer width="100%" height={280}>
                    <LineChart data={dailyTrend}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#ffffff08" />
                      <XAxis dataKey="label" stroke="#555" tick={{ fontSize: 11 }} />
                      <YAxis stroke="#555" tick={{ fontSize: 11 }} tickFormatter={v => `$${v}`} />
                      <Tooltip
                        contentStyle={{ background:"#12121e", border:"1px solid #ffffff15", borderRadius:"12px" }}
                        labelStyle={{ color:"#fff", fontWeight:700 }}
                        formatter={(v, n) => [usd(v), n === "income" ? "Ingresos" : "Gastos"]}
                      />
                      <Legend formatter={n => n === "income" ? "Ingresos" : "Gastos"} />
                      <Line type="monotone" dataKey="income"   stroke="#10B981" strokeWidth={2} dot={false} />
                      <Line type="monotone" dataKey="expenses" stroke="#EF4444" strokeWidth={2} dot={false} />
                    </LineChart>
                  </ResponsiveContainer>
                )}
            </div>

            {/* Payment pie */}
            <div className="bg-white/[0.03] border border-white/8 rounded-2xl p-5">
              <h3 className="font-bold text-white mb-5">Ingresos por Método</h3>
              {byPayment.length === 0
                ? <p className="text-gray-600 text-sm text-center py-10">Sin datos</p>
                : (
                  <ResponsiveContainer width="100%" height={260}>
                    <RPieChart>
                      <Pie data={byPayment} dataKey="amount" nameKey="label" cx="50%" cy="50%"
                        outerRadius={90} label={({ label, percent }) => `${label} ${(percent*100).toFixed(0)}%`}
                        labelLine={false}>
                        {byPayment.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
                      </Pie>
                      <Tooltip contentStyle={{ background:"#12121e", border:"1px solid #ffffff15", borderRadius:"12px" }}
                        formatter={v => usd(v)} />
                    </RPieChart>
                  </ResponsiveContainer>
                )}
            </div>

            {/* Orders by status bar */}
            <div className="bg-white/[0.03] border border-white/8 rounded-2xl p-5">
              <h3 className="font-bold text-white mb-5">Órdenes por Estado</h3>
              {ordersByStatus.length === 0
                ? <p className="text-gray-600 text-sm text-center py-10">Sin datos</p>
                : (
                  <ResponsiveContainer width="100%" height={260}>
                    <BarChart data={ordersByStatus} layout="vertical">
                      <CartesianGrid strokeDasharray="3 3" stroke="#ffffff08" horizontal={false} />
                      <XAxis type="number" stroke="#555" tick={{ fontSize: 11 }} />
                      <YAxis dataKey="status" type="category" stroke="#555" tick={{ fontSize: 11 }} width={90} />
                      <Tooltip contentStyle={{ background:"#12121e", border:"1px solid #ffffff15", borderRadius:"12px" }} />
                      <Bar dataKey="count" fill="#06B6D4" radius={[0,6,6,0]}>
                        {ordersByStatus.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
