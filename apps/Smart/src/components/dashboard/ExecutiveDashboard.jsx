import React, { useState, useEffect, memo } from "react";
import { useVisibleInterval } from "@/hooks/useVisibleInterval";
import { dataClient } from "@/components/api/dataClient";
import {
  TrendingUp, TrendingDown, Clock, CheckCircle2, AlertTriangle,
  ChevronRight, Package, Wrench, Zap, ArrowUpRight, ArrowDownRight,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import {
  ResponsiveContainer,
  AreaChart, Area,
  XAxis, YAxis, Tooltip, CartesianGrid,
  BarChart, Bar, Cell,
} from "recharts";

// ── helpers ────────────────────────────────────────────────────────
function currency(n) {
  return (Number(n) || 0).toLocaleString("en-US", {
    style: "currency", currency: "USD", maximumFractionDigits: 0,
  });
}
function shortCurrency(n) {
  const v = Number(n) || 0;
  if (v >= 1000) return `$${(v / 1000).toFixed(1)}k`;
  return `$${v.toFixed(0)}`;
}

const STATUS_LABELS = {
  intake: "Recepción",
  diagnosing: "Diagnóstico",
  pending_order: "Pte. Ordenar",
  waiting_parts: "Esp. Piezas",
  part_arrived_waiting_device: "Pieza Lista",
  reparacion_externa: "Rep. Externa",
  in_progress: "En Rep.",
  ready_for_pickup: "Listo",
  ready: "Listo",
  completed: "Completado",
  delivered: "Entregado",
  cancelled: "Cancelado",
};

const STATUS_DOT = {
  intake: "#818cf8",
  diagnosing: "#a78bfa",
  pending_order: "#f87171",
  waiting_parts: "#fb923c",
  in_progress: "#60a5fa",
  ready_for_pickup: "#4ade80",
  ready: "#4ade80",
  completed: "#34d399",
  delivered: "#34d399",
};

const CLOSED = ["completed", "cancelled", "delivered", "picked_up"];

function fmtDay(d) {
  return d.toLocaleDateString("es-ES", { day: "2-digit", month: "short" });
}

// ── Custom tooltip ─────────────────────────────────────────────────
function AreaTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div style={{
      background: "rgba(18,12,40,0.96)",
      border: "1px solid rgba(139,92,246,0.35)",
      borderRadius: 10, padding: "8px 12px", fontSize: 12,
    }}>
      <p style={{ color: "rgba(255,255,255,0.4)", marginBottom: 3 }}>{label}</p>
      <p style={{ color: "#c4b5fd", fontWeight: 700, fontSize: 15 }}>
        {currency(payload[0]?.value)}
      </p>
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────
function ExecutiveDashboardImpl() {
  const navigate = useNavigate();
  const [data, setData]     = useState(null);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod]  = useState("month"); // 'today' | 'week' | 'month'

  useEffect(() => { load(); }, []);
  useVisibleInterval(() => load(), 5 * 60_000, []);

  const load = async () => {
    try {
      const now   = new Date();
      const today = now.toISOString().slice(0, 10);
      const month = now.toISOString().slice(0, 7);
      const week  = new Date(now.getTime() - 7 * 86400000).toISOString().slice(0, 10);
      const prevMonthDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const prevMonth = prevMonthDate.toISOString().slice(0, 7);

      const [orders, txs, products, employees] = await Promise.all([
        dataClient.entities.Order.list("-updated_date", 500),
        dataClient.entities.Transaction.list("-created_date", 1000),
        dataClient.entities.Product.list("-created_date", 300),
        dataClient.entities.AppEmployee.list("full_name", 50),
      ]);

      const allOrders = orders || [];
      const allTxs    = txs    || [];

      const isIncome = (t) => t.type === "income" || t.type === "revenue";

      const incToday     = allTxs.filter(t => isIncome(t) && t.created_date?.slice(0,10) === today).reduce((s,t)=>s+(t.amount||0),0);
      const incWeek      = allTxs.filter(t => isIncome(t) && t.created_date?.slice(0,10) >= week ).reduce((s,t)=>s+(t.amount||0),0);
      const incMonth     = allTxs.filter(t => isIncome(t) && t.created_date?.slice(0,7)  === month).reduce((s,t)=>s+(t.amount||0),0);
      const incPrevMonth = allTxs.filter(t => isIncome(t) && t.created_date?.slice(0,7)  === prevMonth).reduce((s,t)=>s+(t.amount||0),0);
      const expMonth     = allTxs.filter(t => t.type === "expense" && t.created_date?.slice(0,7) === month).reduce((s,t)=>s+(t.amount||0),0);

      const pctChange = incPrevMonth > 0
        ? Math.round(((incMonth - incPrevMonth) / incPrevMonth) * 100)
        : null;

      // 30-day series
      const series30 = [];
      for (let i = 29; i >= 0; i--) {
        const d   = new Date(now.getTime() - i * 86400000);
        const key = d.toISOString().slice(0, 10);
        const val = allTxs.filter(t => isIncome(t) && t.created_date?.slice(0,10) === key).reduce((s,t)=>s+(t.amount||0),0);
        series30.push({ day: fmtDay(d), value: Math.round(val) });
      }
      const series7 = series30.slice(-7);

      // Órdenes
      const activas   = allOrders.filter(o => !CLOSED.includes(o.status));
      const listas    = activas.filter(o => o.status === "ready" || o.status === "ready_for_pickup");
      const retrasadas = activas.filter(o => {
        const dias = o.updated_date ? (Date.now() - new Date(o.updated_date).getTime()) / 86400000 : 99;
        return dias >= 3;
      });

      // Top técnicos
      const completadasMes = allOrders.filter(o =>
        (o.status === "completed" || o.status === "delivered") &&
        o.updated_date?.slice(0,7) === month && o.assigned_to
      );
      const porTec = {};
      completadasMes.forEach(o => { porTec[o.assigned_to] = (porTec[o.assigned_to] || 0) + 1; });
      const empMap  = Object.fromEntries((employees || []).map(e => [e.id, e]));
      const topTechs = Object.entries(porTec)
        .sort((a,b) => b[1]-a[1]).slice(0,5)
        .map(([id,n]) => ({ name: (empMap[id]?.full_name || "—").split(" ")[0], ordenes: n }));

      // Stock crítico
      const stockCrit = (products || []).filter(p =>
        p.stock != null && p.min_stock != null && p.stock <= p.min_stock
      );

      // Tiempo prom.
      const entregadasMes = allOrders.filter(o =>
        (o.status === "delivered" || o.status === "completed") &&
        o.updated_date?.slice(0,7) === month && o.created_date
      );
      const avgRepairDays = entregadasMes.length
        ? entregadasMes.reduce((acc,o) => acc + Math.max(0, (new Date(o.updated_date) - new Date(o.created_date)) / 86400000), 0) / entregadasMes.length
        : 0;

      // Tasa completado
      const totalMes     = allOrders.filter(o => o.created_date?.slice(0,7) === month);
      const completedMes = totalMes.filter(o => o.status === "completed" || o.status === "delivered");
      const completionRate = totalMes.length > 0 ? Math.round((completedMes.length / totalMes.length) * 100) : 0;

      // Actividad reciente
      const recentOrders = allOrders.slice(0, 6);

      setData({
        incToday, incWeek, incMonth, incPrevMonth, expMonth,
        netoMes: incMonth - expMonth, pctChange,
        activas: activas.length, listas: listas.length, retrasadas: retrasadas.length,
        stockCrit: stockCrit.length, avgRepairDays, completionRate,
        series30, series7, topTechs, recentOrders,
      });
    } catch (e) {
      console.error("ExecutiveDashboard:", e);
    } finally {
      setLoading(false);
    }
  };

  // ── Loading skeleton ──────────────────────────────────────────────
  if (loading) return (
    <div className="space-y-3 animate-pulse">
      <div className="h-36 rounded-2xl" style={{ background: "rgba(139,92,246,0.08)", border: "1px solid rgba(139,92,246,0.12)" }} />
      <div className="h-44 rounded-2xl" style={{ background: "rgba(255,255,255,0.03)" }} />
      <div className="grid grid-cols-2 gap-3">
        {[1,2,3,4].map(i => <div key={i} className="h-20 rounded-2xl" style={{ background: "rgba(255,255,255,0.03)" }} />)}
      </div>
    </div>
  );
  if (!data) return null;

  const activeSeries = period === "week" ? data.series7 : data.series30;
  const mainValue = period === "today" ? data.incToday : period === "week" ? data.incWeek : data.incMonth;
  const periodLabel = { today: "Hoy", week: "7 días", month: "Este mes" }[period];

  const TECH_COLORS = ["#8b5cf6", "#7c3aed", "#6d28d9", "#5b21b6", "#4c1d95"];

  return (
    <div className="space-y-4">

      {/* ── Hero card ─────────────────────────────────────────── */}
      <div
        className="rounded-2xl p-5 relative overflow-hidden"
        style={{
          background: "linear-gradient(135deg, rgba(109,40,217,0.22) 0%, rgba(79,70,229,0.12) 55%, rgba(12,10,28,0.7) 100%)",
          border: "1px solid rgba(139,92,246,0.22)",
        }}
      >
        {/* decorative glow */}
        <div
          className="absolute -top-10 -right-10 w-40 h-40 rounded-full pointer-events-none"
          style={{ background: "radial-gradient(circle, rgba(139,92,246,0.28) 0%, transparent 70%)" }}
        />

        <div className="relative">
          {/* Period tabs */}
          <div className="flex items-center gap-1.5 mb-4">
            {[
              { key: "today", label: "Hoy"    },
              { key: "week",  label: "7 días"  },
              { key: "month", label: "Mes"     },
            ].map(({ key, label }) => (
              <button
                key={key}
                onClick={() => setPeriod(key)}
                className="px-3 py-1 rounded-full text-xs font-semibold transition-all"
                style={{
                  background: period === key ? "rgba(139,92,246,0.85)" : "rgba(255,255,255,0.06)",
                  color:      period === key ? "#fff" : "rgba(255,255,255,0.4)",
                  border: `1px solid ${period === key ? "rgba(167,139,250,0.4)" : "rgba(255,255,255,0.06)"}`,
                }}
              >
                {label}
              </button>
            ))}
            <button
              onClick={() => navigate("/Financial")}
              className="ml-auto flex items-center gap-0.5 text-xs font-semibold"
              style={{ color: "rgba(196,181,253,0.75)" }}
            >
              Detalle <ChevronRight className="w-3 h-3" />
            </button>
          </div>

          {/* Main number */}
          <p className="text-xs font-medium mb-0.5" style={{ color: "rgba(255,255,255,0.4)" }}>
            Ingresos · {periodLabel}
          </p>
          <div className="flex items-end gap-3 mb-3">
            <span
              className="text-4xl font-extrabold tabular-nums leading-none"
              style={{
                background: "linear-gradient(90deg, #ede9fe 0%, #c4b5fd 50%, #818cf8 100%)",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
                backgroundClip: "text",
              }}
            >
              {currency(mainValue)}
            </span>
            {period === "month" && data.pctChange !== null && (
              <span
                className="flex items-center gap-0.5 text-xs font-bold mb-1 px-2 py-0.5 rounded-full"
                style={{
                  background: data.pctChange >= 0 ? "rgba(74,222,128,0.14)" : "rgba(248,113,113,0.14)",
                  color:      data.pctChange >= 0 ? "#4ade80" : "#f87171",
                }}
              >
                {data.pctChange >= 0 ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
                {Math.abs(data.pctChange)}%
              </span>
            )}
          </div>

          {/* Sub metrics — only for month */}
          {period === "month" && (
            <div className="flex items-center gap-5">
              <div>
                <p className="text-[10px] uppercase tracking-wide" style={{ color: "rgba(255,255,255,0.3)" }}>Gastos</p>
                <p className="text-sm font-bold" style={{ color: "#f87171" }}>{currency(data.expMonth)}</p>
              </div>
              <div>
                <p className="text-[10px] uppercase tracking-wide" style={{ color: "rgba(255,255,255,0.3)" }}>Neto</p>
                <p className="text-sm font-bold" style={{ color: data.netoMes >= 0 ? "#4ade80" : "#f87171" }}>
                  {currency(data.netoMes)}
                </p>
              </div>
              <div>
                <p className="text-[10px] uppercase tracking-wide" style={{ color: "rgba(255,255,255,0.3)" }}>Completadas</p>
                <p className="text-sm font-bold" style={{ color: "#c4b5fd" }}>{data.completionRate}%</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── Area chart ─────────────────────────────────────────── */}
      <div
        className="rounded-2xl px-3 pt-4 pb-2"
        style={{ background: "rgba(255,255,255,0.025)", border: "1px solid rgba(255,255,255,0.065)" }}
      >
        <div style={{ width: "100%", height: 150 }}>
          <ResponsiveContainer>
            <AreaChart data={activeSeries} margin={{ top: 4, right: 4, left: -28, bottom: 0 }}>
              <defs>
                <linearGradient id="fg" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor="#8b5cf6" stopOpacity={0.38} />
                  <stop offset="92%" stopColor="#8b5cf6" stopOpacity={0}    />
                </linearGradient>
              </defs>
              <CartesianGrid stroke="rgba(255,255,255,0.04)" vertical={false} />
              <XAxis
                dataKey="day"
                tick={{ fill: "rgba(255,255,255,0.27)", fontSize: 9.5 }}
                axisLine={false} tickLine={false}
                interval={period === "month" ? 5 : "preserveStartEnd"}
              />
              <YAxis
                tick={{ fill: "rgba(255,255,255,0.27)", fontSize: 9.5 }}
                axisLine={false} tickLine={false}
                tickFormatter={shortCurrency}
              />
              <Tooltip content={<AreaTooltip />} />
              <Area
                type="monotone"
                dataKey="value"
                stroke="#8b5cf6"
                strokeWidth={2.2}
                fill="url(#fg)"
                dot={false}
                activeDot={{ r: 4.5, fill: "#c4b5fd", stroke: "#160d30", strokeWidth: 2 }}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* ── 4 KPI tiles ──────────────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-3">
        {[
          {
            label: "Órdenes activas",
            value: data.activas, suffix: "",
            Icon: Zap,
            color:  "#818cf8",
            bg:     "rgba(129,140,248,0.1)",
            border: "rgba(129,140,248,0.18)",
            onClick: () => navigate("/Orders"),
          },
          {
            label: "Listas p/ entrega",
            value: data.listas, suffix: "",
            Icon: CheckCircle2,
            color:  data.listas > 0 ? "#4ade80" : "rgba(255,255,255,0.25)",
            bg:     data.listas > 0 ? "rgba(74,222,128,0.08)" : "rgba(255,255,255,0.025)",
            border: data.listas > 0 ? "rgba(74,222,128,0.18)" : "rgba(255,255,255,0.06)",
            onClick: () => navigate("/Orders"),
          },
          {
            label: "Stock crítico",
            value: data.stockCrit, suffix: "",
            Icon: AlertTriangle,
            color:  data.stockCrit > 0 ? "#fb923c" : "rgba(255,255,255,0.25)",
            bg:     data.stockCrit > 0 ? "rgba(251,146,60,0.1)" : "rgba(255,255,255,0.025)",
            border: data.stockCrit > 0 ? "rgba(251,146,60,0.2)" : "rgba(255,255,255,0.06)",
            onClick: () => navigate("/Inventory"),
          },
          {
            label: "Tiempo prom.",
            value: data.avgRepairDays.toFixed(1), suffix: "d",
            Icon: Clock,
            color:  "rgba(255,255,255,0.35)",
            bg:     "rgba(255,255,255,0.025)",
            border: "rgba(255,255,255,0.06)",
            onClick: null,
          },
        ].map(({ label, value, suffix, Icon, color, bg, border, onClick }) => (
          <button
            key={label}
            onClick={onClick}
            disabled={!onClick}
            className="flex flex-col gap-2.5 p-4 rounded-2xl text-left transition-all active:scale-95 disabled:cursor-default"
            style={{ background: bg, border: `1px solid ${border}` }}
          >
            <div className="flex items-center justify-between w-full">
              <Icon className="w-4 h-4 shrink-0" style={{ color }} />
              {onClick && <ChevronRight className="w-3.5 h-3.5 opacity-25" />}
            </div>
            <div>
              <p className="text-2xl font-extrabold tabular-nums leading-none" style={{ color: "rgba(255,255,255,0.9)" }}>
                {value}{suffix}
              </p>
              <p className="text-xs font-medium mt-1" style={{ color: "rgba(255,255,255,0.38)" }}>
                {label}
              </p>
            </div>
          </button>
        ))}
      </div>

      {/* ── Top técnicos ────────────────────────────────────────── */}
      {data.topTechs.length > 0 && (
        <div
          className="rounded-2xl p-4"
          style={{ background: "rgba(255,255,255,0.025)", border: "1px solid rgba(255,255,255,0.065)" }}
        >
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Wrench className="w-3.5 h-3.5" style={{ color: "rgba(139,92,246,0.8)" }} />
              <span className="text-sm font-semibold" style={{ color: "rgba(255,255,255,0.7)" }}>
                Top técnicos
              </span>
            </div>
            <span className="text-xs" style={{ color: "rgba(255,255,255,0.28)" }}>
              Completadas este mes
            </span>
          </div>
          <div style={{ width: "100%", height: Math.min(data.topTechs.length * 38 + 12, 210) }}>
            <ResponsiveContainer>
              <BarChart
                data={data.topTechs}
                layout="vertical"
                margin={{ top: 0, right: 6, left: 0, bottom: 0 }}
              >
                <CartesianGrid stroke="rgba(255,255,255,0.04)" horizontal={false} />
                <XAxis type="number" tick={{ fill: "rgba(255,255,255,0.28)", fontSize: 9.5 }} axisLine={false} tickLine={false} />
                <YAxis dataKey="name" type="category" width={68}
                  tick={{ fill: "rgba(255,255,255,0.5)", fontSize: 11 }} axisLine={false} tickLine={false} />
                <Tooltip
                  contentStyle={{
                    background: "rgba(18,12,40,0.96)",
                    border: "1px solid rgba(139,92,246,0.3)",
                    borderRadius: 10, fontSize: 12,
                  }}
                  cursor={{ fill: "rgba(255,255,255,0.02)" }}
                  formatter={(v) => [v, "Órdenes"]}
                />
                <Bar dataKey="ordenes" radius={[0, 7, 7, 0]}>
                  {data.topTechs.map((_, i) => (
                    <Cell key={i} fill={TECH_COLORS[i] || TECH_COLORS[TECH_COLORS.length - 1]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* ── Actividad reciente ───────────────────────────────────── */}
      {data.recentOrders.length > 0 && (
        <div
          className="rounded-2xl p-4"
          style={{ background: "rgba(255,255,255,0.025)", border: "1px solid rgba(255,255,255,0.065)" }}
        >
          <div className="flex items-center justify-between mb-1">
            <span className="text-sm font-semibold" style={{ color: "rgba(255,255,255,0.7)" }}>
              Actividad reciente
            </span>
            <button
              onClick={() => navigate("/Orders")}
              className="flex items-center gap-0.5 text-xs font-semibold transition-colors"
              style={{ color: "rgba(196,181,253,0.75)" }}
            >
              Ver todas <ChevronRight className="w-3 h-3" />
            </button>
          </div>

          <div>
            {data.recentOrders.map((order, i) => {
              const dot    = STATUS_DOT[order.status] || "rgba(255,255,255,0.2)";
              const label  = STATUS_LABELS[order.status] || (order.status || "—");
              const device = order.device_model || order.device_brand || "Dispositivo";
              const cust   = order.customer_name || "Cliente";
              const initials = (cust[0] || "?").toUpperCase();
              const dateStr = order.created_date
                ? new Date(order.created_date).toLocaleDateString("es-ES", { day: "2-digit", month: "short" })
                : "—";

              return (
                <button
                  key={order.id || i}
                  onClick={() => navigate("/Orders")}
                  className="flex items-center gap-3 w-full py-2.5 text-left transition-all active:opacity-70"
                  style={{
                    borderBottom: i < data.recentOrders.length - 1
                      ? "1px solid rgba(255,255,255,0.045)"
                      : "none",
                  }}
                >
                  {/* Avatar */}
                  <div
                    className="w-8 h-8 rounded-full flex items-center justify-center shrink-0 text-xs font-bold"
                    style={{ background: "rgba(139,92,246,0.18)", color: "#c4b5fd" }}
                  >
                    {initials}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate leading-tight" style={{ color: "rgba(255,255,255,0.85)" }}>
                      {cust}
                    </p>
                    <p className="text-xs truncate" style={{ color: "rgba(255,255,255,0.32)" }}>
                      {device}
                    </p>
                  </div>

                  {/* Status + date */}
                  <div className="flex flex-col items-end gap-1 shrink-0">
                    <span className="flex items-center gap-1.5 text-[11px] font-semibold">
                      <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: dot }} />
                      <span style={{ color: dot }}>{label}</span>
                    </span>
                    <span className="text-[10px]" style={{ color: "rgba(255,255,255,0.27)" }}>
                      {dateStr}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}

    </div>
  );
}

export default memo(ExecutiveDashboardImpl);
