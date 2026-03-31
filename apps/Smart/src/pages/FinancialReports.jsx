import React, { useState, useEffect, useCallback, useMemo } from "react";
import { dataClient } from "@/components/api/dataClient";
import {
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend
} from "recharts";
import {
  TrendingUp, TrendingDown, DollarSign, ShoppingBag,
  Download, RefreshCcw, ArrowUpRight, ArrowDownRight,
  CreditCard, Banknote, Smartphone, Building2, CheckSquare
} from "lucide-react";
import { toast } from "sonner";
import {
  format, startOfDay, endOfDay, startOfWeek, endOfWeek,
  startOfMonth, endOfMonth, startOfYear, endOfYear,
  subMonths, subWeeks, subDays
} from "date-fns";
import { es } from "date-fns/locale";

/* ─── Helpers ─── */
const fmtMoney = (n) => `$${Number(n||0).toLocaleString("en-US",{minimumFractionDigits:2,maximumFractionDigits:2})}`;
const fmtShort = (n) => {
  const abs = Math.abs(Number(n||0));
  if (abs >= 1000) return `$${(abs/1000).toFixed(1)}k`;
  return `$${abs.toFixed(0)}`;
};
const fmtDay = (iso) => {
  try { return format(new Date(iso),"d MMM",{locale:es}); } catch { return iso; }
};

const METHOD_LABELS = {
  cash:"Efectivo", card:"Tarjeta", ath_movil:"ATH Móvil",
  bank_transfer:"Transferencia", check:"Cheque", other:"Otro"
};
const METHOD_COLORS = {
  cash:"#10b981", card:"#3b82f6", ath_movil:"#a855f7",
  bank_transfer:"#f59e0b", check:"#6366f1", other:"#94a3b8"
};
const METHOD_ICONS = {
  cash: Banknote, card: CreditCard, ath_movil: Smartphone,
  bank_transfer: Building2, check: CheckSquare, other: DollarSign
};

const EXPENSE_COLORS = {
  payroll:"#f59e0b", inventory:"#3b82f6", utilities:"#8b5cf6",
  rent:"#ec4899", marketing:"#06b6d4", maintenance:"#84cc16",
  other:"#94a3b8"
};
const EXPENSE_LABELS = {
  payroll:"Nómina", inventory:"Inventario", utilities:"Servicios",
  rent:"Renta", marketing:"Mercadeo", maintenance:"Mantenimiento",
  other:"Otros"
};

const PERIOD_OPTIONS = [
  { v:"today",  l:"Hoy" },
  { v:"week",   l:"Semana" },
  { v:"month",  l:"Mes" },
  { v:"year",   l:"Año" },
];

function getPeriodDates(p) {
  const now = new Date();
  switch(p) {
    case "today":  return { start: startOfDay(now),          end: endOfDay(now) };
    case "week":   return { start: startOfWeek(now,{weekStartsOn:1}), end: endOfWeek(now,{weekStartsOn:1}) };
    case "month":  return { start: startOfMonth(now),        end: endOfMonth(now) };
    case "year":   return { start: startOfYear(now),         end: endOfYear(now) };
    default:       return { start: startOfMonth(now),        end: endOfMonth(now) };
  }
}

function getPrevDates(p) {
  const now = new Date();
  switch(p) {
    case "today":  return { start: startOfDay(subDays(now,1)),       end: endOfDay(subDays(now,1)) };
    case "week":   return { start: startOfWeek(subWeeks(now,1),{weekStartsOn:1}), end: endOfWeek(subWeeks(now,1),{weekStartsOn:1}) };
    case "month":  return { start: startOfMonth(subMonths(now,1)),   end: endOfMonth(subMonths(now,1)) };
    case "year":   return { start: startOfYear(new Date(now.getFullYear()-1,0,1)), end: endOfYear(new Date(now.getFullYear()-1,0,1)) };
    default:       return { start: startOfMonth(subMonths(now,1)),   end: endOfMonth(subMonths(now,1)) };
  }
}

/* ─── Stat Card ─── */
function StatCard({ label, value, sub, icon: Icon, color, trend, trendLabel }) {
  const isPositive = trend >= 0;
  return (
    <div className={`bg-white/[0.04] border rounded-2xl p-5 ${color}`}>
      <div className="flex items-start justify-between mb-3">
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${color.replace("border-","bg-").replace("/30","/20")}`}>
          <Icon className="w-5 h-5" />
        </div>
        {trend !== undefined && (
          <div className={`flex items-center gap-1 text-xs font-bold px-2 py-1 rounded-lg ${
            isPositive ? "bg-emerald-500/15 text-emerald-400" : "bg-red-500/15 text-red-400"
          }`}>
            {isPositive ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
            {Math.abs(trend).toFixed(1)}%
          </div>
        )}
      </div>
      <p className="text-white/40 text-[10px] font-black uppercase tracking-widest">{label}</p>
      <p className="text-white font-black text-2xl mt-1">{value}</p>
      {sub && <p className="text-white/30 text-xs mt-1">{sub}</p>}
      {trendLabel && <p className="text-white/20 text-[10px] mt-0.5">{trendLabel}</p>}
    </div>
  );
}

/* ─── Custom Tooltip ─── */
function ChartTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-[#16171c] border border-white/10 rounded-xl px-3 py-2 text-xs shadow-2xl">
      <p className="text-white/50 font-bold mb-1">{label}</p>
      {payload.map((p,i) => (
        <p key={i} style={{color:p.color}} className="font-bold">
          {p.name}: {fmtMoney(p.value)}
        </p>
      ))}
    </div>
  );
}

/* ─── Main ─── */
export default function FinancialReportsPage() {
  const [period, setPeriod]       = useState("month");
  const [customStart, setCustomStart] = useState("");
  const [customEnd, setCustomEnd]     = useState("");
  const [isCustom, setIsCustom]       = useState(false);
  const [pmFilter, setPmFilter]       = useState("all");
  const [activeChart, setActiveChart] = useState("trend");
  const [loading, setLoading]         = useState(false);
  const [reportData, setReportData]   = useState(null);
  const [chartH, setChartH]           = useState(() => window.innerWidth < 640 ? 200 : 280);

  useEffect(() => {
    const onResize = () => setChartH(window.innerWidth < 640 ? 200 : 280);
    window.addEventListener("resize",onResize);
    return () => window.removeEventListener("resize",onResize);
  },[]);

  const generateReport = useCallback(async () => {
    setLoading(true);
    try {
      let start, end;
      if (isCustom && customStart && customEnd) {
        start = startOfDay(new Date(customStart));
        end   = endOfDay(new Date(customEnd));
      } else {
        const d = getPeriodDates(period);
        start = d.start; end = d.end;
      }
      const prev = getPrevDates(period);

      const [sales, transactions] = await Promise.all([
        dataClient.entities.Sale.list("-created_date", 2000),
        dataClient.entities.Transaction.list("-created_date", 2000)
      ]);

      const inRange = (d) => new Date(d) >= start && new Date(d) <= end;
      const inPrev  = (d) => new Date(d) >= prev.start && new Date(d) <= prev.end;

      const filteredSales = (sales||[]).filter(s => !s.voided && inRange(s.created_date) && (pmFilter==="all"||s.payment_method===pmFilter));
      const filteredTx    = (transactions||[]).filter(t => inRange(t.created_date));
      const prevSales     = (sales||[]).filter(s => !s.voided && inPrev(s.created_date));
      const prevTx        = (transactions||[]).filter(t => inPrev(t.created_date));

      const revenue = filteredSales.reduce((s,x) => s + (x.total||0), 0);
      const expenses= filteredTx.filter(t=>t.type==="expense").reduce((s,x)=>s+(x.amount||0),0);
      const deposits= filteredTx.filter(t=>t.type==="income"||t.type==="deposit").reduce((s,x)=>s+(x.amount||0),0);
      const net     = revenue + deposits - expenses;

      const prevRevenue = prevSales.reduce((s,x)=>s+(x.total||0),0);
      const prevExpenses= prevTx.filter(t=>t.type==="expense").reduce((s,x)=>s+(x.amount||0),0);
      const prevNet     = prevRevenue - prevExpenses;

      const pct = (cur, prev) => prev===0 ? (cur>0?100:0) : ((cur-prev)/prev)*100;

      // By payment method
      const byMethod = {};
      filteredSales.forEach(s => {
        const m = s.payment_method || "other";
        byMethod[m] = (byMethod[m]||0) + (s.total||0);
      });

      // By expense category
      const byCategory = {};
      filteredTx.filter(t=>t.type==="expense").forEach(t => {
        const c = t.category || "other";
        byCategory[c] = (byCategory[c]||0) + (t.amount||0);
      });

      // Daily trend
      const daily = {};
      filteredSales.forEach(s => {
        const d = format(new Date(s.created_date),"yyyy-MM-dd");
        if (!daily[d]) daily[d] = {date:d,label:fmtDay(s.created_date),revenue:0,expenses:0};
        daily[d].revenue += (s.total||0);
      });
      filteredTx.filter(t=>t.type==="expense").forEach(t => {
        const d = format(new Date(t.created_date),"yyyy-MM-dd");
        if (!daily[d]) daily[d] = {date:d,label:fmtDay(t.created_date),revenue:0,expenses:0};
        daily[d].expenses += (t.amount||0);
      });
      const trend = Object.values(daily).sort((a,b)=>a.date.localeCompare(b.date));

      // Top sales items
      const itemMap = {};
      filteredSales.forEach(s => {
        (s.items||[]).forEach(i => {
          const name = i.name||i.product_name||"Producto";
          itemMap[name] = (itemMap[name]||0) + (i.quantity||1);
        });
      });
      const topItems = Object.entries(itemMap).sort(([,a],[,b])=>b-a).slice(0,5).map(([name,qty])=>({name,qty}));

      setReportData({
        revenue, expenses, net, deposits,
        salesCount: filteredSales.length,
        prevRevenue, prevExpenses, prevNet,
        revenueTrend: pct(revenue, prevRevenue),
        expensesTrend: pct(expenses, prevExpenses),
        netTrend: pct(net, prevNet),
        byMethod, byCategory, trend, topItems,
        startDate: start, endDate: end
      });

    } catch (err) {
      console.error(err);
      toast.error("Error al generar reporte");
    } finally { setLoading(false); }
  }, [period, pmFilter, isCustom, customStart, customEnd]);

  // Auto-generate on load and when period/filter changes
  useEffect(() => { generateReport(); }, [generateReport]);

  const exportCSV = () => {
    if (!reportData) return;
    let csv = "Fecha,Ingresos,Gastos,Utilidad\n";
    reportData.trend.forEach(r => {
      csv += `${r.date},${r.revenue.toFixed(2)},${r.expenses.toFixed(2)},${(r.revenue-r.expenses).toFixed(2)}\n`;
    });
    const blob = new Blob([csv],{type:"text/csv"});
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement("a");
    a.href = url;
    a.download = `finanzas_${format(reportData.startDate,"yyyy-MM-dd")}_${format(reportData.endDate,"yyyy-MM-dd")}.csv`;
    a.click();
    toast.success("CSV exportado");
  };

  const methodData = reportData
    ? Object.entries(reportData.byMethod).map(([k,v])=>({name:METHOD_LABELS[k]||k,value:v,key:k}))
    : [];
  const categoryData = reportData
    ? Object.entries(reportData.byCategory).map(([k,v])=>({name:EXPENSE_LABELS[k]||k,value:v,key:k}))
    : [];

  return (
    <div className="min-h-screen bg-black/95 p-4 sm:p-6 pb-24">
      <div className="max-w-6xl mx-auto space-y-5">

        {/* ── Header ── */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center shadow-lg">
              <TrendingUp className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-black text-white tracking-tight">Reportes Financieros</h1>
              <p className="text-white/35 text-sm font-bold">Ingresos, gastos y utilidad</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {reportData && (
              <button onClick={exportCSV}
                className="flex items-center gap-2 px-3 py-2 rounded-xl bg-white/[0.06] hover:bg-white/[0.1] border border-white/[0.08] text-white/50 hover:text-white text-sm font-bold transition-all">
                <Download className="w-4 h-4" />
                <span className="hidden sm:inline">CSV</span>
              </button>
            )}
            <button onClick={generateReport} disabled={loading}
              className="flex items-center gap-2 px-3 py-2 rounded-xl bg-white/[0.06] hover:bg-white/[0.1] border border-white/[0.08] text-white/50 hover:text-white text-sm font-bold transition-all">
              <RefreshCcw className={`w-4 h-4 ${loading?"animate-spin":""}`} />
              <span className="hidden sm:inline">Actualizar</span>
            </button>
          </div>
        </div>

        {/* ── Filter bar ── */}
        <div className="bg-white/[0.04] border border-white/[0.07] rounded-2xl p-4 space-y-3">
          {/* Period pills */}
          <div className="flex gap-2 flex-wrap items-center">
            {PERIOD_OPTIONS.map(p => (
              <button key={p.v} onClick={()=>{setPeriod(p.v);setIsCustom(false);}}
                className={`px-4 py-2 rounded-xl text-sm font-bold transition-all ${
                  !isCustom && period===p.v
                    ? "bg-white text-black"
                    : "bg-white/[0.06] border border-white/[0.08] text-white/50 hover:text-white"
                }`}>
                {p.l}
              </button>
            ))}
            {/* Custom range */}
            <div className="flex items-center gap-2 ml-auto">
              <input type="date" value={customStart} onChange={e=>{setCustomStart(e.target.value);setIsCustom(true);}}
                className="bg-white/[0.05] border border-white/[0.08] rounded-xl px-3 py-1.5 text-sm text-white outline-none" />
              <span className="text-white/25 text-sm">→</span>
              <input type="date" value={customEnd} onChange={e=>{setCustomEnd(e.target.value);setIsCustom(true);}}
                className="bg-white/[0.05] border border-white/[0.08] rounded-xl px-3 py-1.5 text-sm text-white outline-none" />
            </div>
          </div>
          {/* Payment method filter */}
          <div className="flex gap-2 flex-wrap">
            <span className="text-white/30 text-xs font-bold self-center">Método:</span>
            {[{v:"all",l:"Todos"}, ...Object.entries(METHOD_LABELS).map(([v,l])=>({v,l}))].map(m => (
              <button key={m.v} onClick={()=>setPmFilter(m.v)}
                className={`px-3 py-1 rounded-xl text-xs font-bold transition-all ${
                  pmFilter===m.v
                    ? "bg-cyan-500 text-black"
                    : "bg-white/[0.05] border border-white/[0.07] text-white/40 hover:text-white"
                }`}>
                {m.l}
              </button>
            ))}
          </div>
        </div>

        {/* ── KPI Cards ── */}
        {loading && !reportData ? (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[...Array(4)].map((_,i)=>(
              <div key={i} className="bg-white/[0.04] border border-white/[0.06] rounded-2xl h-28 animate-pulse" />
            ))}
          </div>
        ) : reportData && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <StatCard
              label="Ingresos"
              value={fmtMoney(reportData.revenue)}
              sub={`${reportData.salesCount} ventas`}
              icon={TrendingUp}
              color="border-emerald-500/30 text-emerald-400"
              trend={reportData.revenueTrend}
              trendLabel="vs período anterior"
            />
            <StatCard
              label="Gastos"
              value={fmtMoney(reportData.expenses)}
              sub={reportData.deposits>0?`+ $${reportData.deposits.toFixed(0)} depósitos`:null}
              icon={ArrowDownRight}
              color="border-red-500/30 text-red-400"
              trend={-reportData.expensesTrend}
            />
            <StatCard
              label="Utilidad Neta"
              value={fmtMoney(reportData.net)}
              sub={reportData.net>=0?"Positivo ✓":"Negativo ✗"}
              icon={DollarSign}
              color={reportData.net>=0?"border-cyan-500/30 text-cyan-400":"border-red-500/30 text-red-400"}
              trend={reportData.netTrend}
            />
            <StatCard
              label="Ticket Promedio"
              value={reportData.salesCount>0?fmtMoney(reportData.revenue/reportData.salesCount):"$0.00"}
              sub={`${reportData.salesCount} transacciones`}
              icon={ShoppingBag}
              color="border-violet-500/30 text-violet-400"
            />
          </div>
        )}

        {/* ── Charts ── */}
        {reportData && (
          <>
            {/* Chart tabs */}
            <div className="flex gap-1 bg-white/[0.04] border border-white/[0.07] rounded-2xl p-1">
              {[
                {v:"trend",    l:"Tendencia"},
                {v:"methods",  l:"Métodos de Pago"},
                {v:"expenses", l:"Gastos"},
              ].map(t => (
                <button key={t.v} onClick={()=>setActiveChart(t.v)}
                  className={`flex-1 py-2 rounded-xl text-sm font-bold transition-all ${
                    activeChart===t.v ? "bg-white/[0.1] text-white" : "text-white/35 hover:text-white/60"
                  }`}>
                  {t.l}
                </button>
              ))}
            </div>

            {/* Trend chart */}
            {activeChart==="trend" && (
              <div className="bg-white/[0.04] border border-white/[0.07] rounded-2xl p-4">
                <p className="text-white font-black text-sm mb-4">Ingresos vs Gastos</p>
                {reportData.trend.length === 0 ? (
                  <div className="flex items-center justify-center h-40">
                    <p className="text-white/25 text-sm">Sin datos en este período</p>
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height={chartH}>
                    <LineChart data={reportData.trend} margin={{top:5,right:10,left:0,bottom:5}}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" />
                      <XAxis dataKey="label" stroke="#ffffff20" tick={{fontSize:10,fill:"#ffffff40"}} />
                      <YAxis stroke="#ffffff20" tick={{fontSize:10,fill:"#ffffff40"}} width={50}
                        tickFormatter={v=>`$${(v/1000).toFixed(0)}k`} />
                      <Tooltip content={<ChartTooltip />} />
                      <Legend wrapperStyle={{fontSize:11,color:"#ffffff50"}} />
                      <Line type="monotone" dataKey="revenue" stroke="#10b981" strokeWidth={2.5}
                        dot={false} name="Ingresos" />
                      <Line type="monotone" dataKey="expenses" stroke="#ef4444" strokeWidth={2.5}
                        dot={false} name="Gastos" />
                    </LineChart>
                  </ResponsiveContainer>
                )}
              </div>
            )}

            {/* Methods chart */}
            {activeChart==="methods" && (
              <div className="bg-white/[0.04] border border-white/[0.07] rounded-2xl p-4">
                <p className="text-white font-black text-sm mb-4">Ingresos por Método de Pago</p>
                {methodData.length === 0 ? (
                  <div className="flex items-center justify-center h-40">
                    <p className="text-white/25 text-sm">Sin ventas en este período</p>
                  </div>
                ) : (
                  <div className="flex flex-col sm:flex-row gap-6 items-center">
                    <ResponsiveContainer width={chartH} height={chartH}>
                      <PieChart>
                        <Pie data={methodData} cx="50%" cy="50%" innerRadius={chartH*0.25} outerRadius={chartH*0.42}
                          dataKey="value" paddingAngle={3}>
                          {methodData.map((e,i) => (
                            <Cell key={i} fill={METHOD_COLORS[e.key]||"#94a3b8"} />
                          ))}
                        </Pie>
                        <Tooltip content={<ChartTooltip />} />
                      </PieChart>
                    </ResponsiveContainer>
                    <div className="flex-1 space-y-2">
                      {methodData.sort((a,b)=>b.value-a.value).map((m,i) => {
                        const Icon = METHOD_ICONS[m.key] || DollarSign;
                        const total = methodData.reduce((s,x)=>s+x.value,0);
                        const pct = total>0 ? ((m.value/total)*100).toFixed(1) : "0";
                        return (
                          <div key={i} className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0"
                              style={{backgroundColor:METHOD_COLORS[m.key]+"20"}}>
                              <Icon className="w-4 h-4" style={{color:METHOD_COLORS[m.key]}} />
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center justify-between mb-1">
                                <p className="text-white text-xs font-bold truncate">{m.name}</p>
                                <p className="text-white text-xs font-black ml-2">{fmtMoney(m.value)}</p>
                              </div>
                              <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
                                <div className="h-full rounded-full" style={{width:`${pct}%`,backgroundColor:METHOD_COLORS[m.key]}} />
                              </div>
                            </div>
                            <p className="text-white/35 text-xs w-10 text-right flex-shrink-0">{pct}%</p>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Expenses chart */}
            {activeChart==="expenses" && (
              <div className="bg-white/[0.04] border border-white/[0.07] rounded-2xl p-4">
                <p className="text-white font-black text-sm mb-4">Gastos por Categoría</p>
                {categoryData.length === 0 ? (
                  <div className="flex items-center justify-center h-40">
                    <p className="text-white/25 text-sm">Sin gastos en este período</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {categoryData.sort((a,b)=>b.value-a.value).map((c,i) => {
                      const total = categoryData.reduce((s,x)=>s+x.value,0);
                      const pct = total>0 ? ((c.value/total)*100) : 0;
                      const color = EXPENSE_COLORS[c.key] || "#94a3b8";
                      return (
                        <div key={i} className="flex items-center gap-3">
                          <div className="w-2 h-2 rounded-full flex-shrink-0" style={{backgroundColor:color}} />
                          <p className="text-white text-sm font-semibold w-28 flex-shrink-0 truncate">{c.name}</p>
                          <div className="flex-1 h-2 bg-white/10 rounded-full overflow-hidden">
                            <div className="h-full rounded-full transition-all" style={{width:`${pct}%`,backgroundColor:color}} />
                          </div>
                          <p className="text-white font-black text-sm w-20 text-right flex-shrink-0">{fmtMoney(c.value)}</p>
                          <p className="text-white/30 text-xs w-10 text-right flex-shrink-0">{pct.toFixed(0)}%</p>
                        </div>
                      );
                    })}
                    <div className="flex items-center justify-between border-t border-white/10 pt-3">
                      <p className="text-white/40 text-xs font-bold uppercase tracking-wider">Total gastos</p>
                      <p className="text-red-400 font-black text-lg">
                        {fmtMoney(categoryData.reduce((s,c)=>s+c.value,0))}
                      </p>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Top products sold */}
            {reportData.topItems?.length > 0 && (
              <div className="bg-white/[0.04] border border-white/[0.07] rounded-2xl p-4">
                <p className="text-white font-black text-sm mb-4">Más Vendidos</p>
                <div className="space-y-2">
                  {reportData.topItems.map((item,i) => (
                    <div key={i} className="flex items-center gap-3">
                      <span className="text-white/20 text-sm font-black w-5 text-right flex-shrink-0">{i+1}</span>
                      <p className="text-white text-sm font-semibold flex-1 min-w-0 truncate">{item.name}</p>
                      <p className="text-white/50 text-xs font-bold flex-shrink-0">{item.qty} uds.</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Period note */}
            <p className="text-white/20 text-xs text-center pb-2">
              Período: {format(reportData.startDate,"d MMM yyyy",{locale:es})} — {format(reportData.endDate,"d MMM yyyy",{locale:es})}
              &nbsp;·&nbsp; {loading ? "Actualizando…" : "Actualizado ahora"}
            </p>
          </>
        )}
      </div>
    </div>
  );
}
