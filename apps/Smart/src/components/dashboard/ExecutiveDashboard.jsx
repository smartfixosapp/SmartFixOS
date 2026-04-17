import React, { useState, useEffect, useMemo, memo } from "react";
import { useVisibleInterval } from "@/hooks/useVisibleInterval";
import { dataClient } from "@/components/api/dataClient";
import {
  TrendingUp, TrendingDown, Clock, CheckCircle2, AlertTriangle,
  Users, ChevronRight, DollarSign, Package, Wrench
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import {
  ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid,
  PieChart, Pie, Cell, BarChart, Bar, Legend
} from "recharts";

function currency(n) {
  return (Number(n) || 0).toLocaleString("en-US", {
    style: "currency", currency: "USD", maximumFractionDigits: 0
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
};
const STATUS_HEX = {
  intake: "#007AFF",
  diagnosing: "#AF52DE",
  pending_order: "#FF3B30",
  waiting_parts: "#FF9500",
  part_arrived_waiting_device: "#FFCC00",
  reparacion_externa: "#AF52DE",
  in_progress: "#007AFF",
  ready_for_pickup: "#34C759",
  ready: "#34C759",
};
const CLOSED = ["completed", "cancelled", "delivered", "picked_up"];

function fmtDay(d) {
  return d.toLocaleDateString("es-ES", { day: "2-digit", month: "short" });
}

function ExecutiveDashboardImpl() {
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => { load(); }, []);
  // Auto-refresh cada 5 min, solo si pestaña visible
  useVisibleInterval(() => load(), 5 * 60_000, []);

  const load = async () => {
    try {
      const now = new Date();
      const today = now.toISOString().slice(0, 10);
      const month = now.toISOString().slice(0, 7);
      const week = new Date(now.getTime() - 7 * 86400000).toISOString().slice(0, 10);

      const [orders, txs, products, employees] = await Promise.all([
        dataClient.entities.Order.list("-updated_date", 500),
        dataClient.entities.Transaction.list("-created_date", 1000),
        dataClient.entities.Product.list("-created_date", 300),
        dataClient.entities.AppEmployee.list("full_name", 50),
      ]);

      const allOrders = orders || [];
      const allTxs = txs || [];

      // Ingresos — acepta "revenue" (schema actual) e "income" (legacy)
      const isIncome = (t) => t.type === "income" || t.type === "revenue";
      const incToday = allTxs
        .filter(t => isIncome(t) && t.created_date?.slice(0, 10) === today)
        .reduce((s, t) => s + (t.amount || 0), 0);
      const incWeek = allTxs
        .filter(t => isIncome(t) && t.created_date?.slice(0, 10) >= week)
        .reduce((s, t) => s + (t.amount || 0), 0);
      const incMonth = allTxs
        .filter(t => isIncome(t) && t.created_date?.slice(0, 7) === month)
        .reduce((s, t) => s + (t.amount || 0), 0);
      const expMonth = allTxs
        .filter(t => t.type === "expense" && t.created_date?.slice(0, 7) === month)
        .reduce((s, t) => s + (t.amount || 0), 0);

      // Serie 14 días — ingresos diarios
      const series = [];
      for (let i = 13; i >= 0; i--) {
        const d = new Date(now.getTime() - i * 86400000);
        const key = d.toISOString().slice(0, 10);
        const day = allTxs
          .filter(t => isIncome(t) && t.created_date?.slice(0, 10) === key)
          .reduce((s, t) => s + (t.amount || 0), 0);
        series.push({ day: fmtDay(d), ingresos: Math.round(day) });
      }

      // Órdenes activas por estado
      const activas = allOrders.filter(o => !CLOSED.includes(o.status));
      const porEstado = {};
      activas.forEach(o => {
        const s = o.status || "intake";
        porEstado[s] = (porEstado[s] || 0) + 1;
      });
      const donut = Object.entries(porEstado).map(([k, v]) => ({
        name: STATUS_LABELS[k] || k,
        value: v,
        color: STATUS_HEX[k] || "#64748b",
      }));

      // Listas / retrasadas
      const listas = activas.filter(o =>
        o.status === "ready" || o.status === "ready_for_pickup"
      );
      const retrasadas = activas.filter(o => {
        const dias = o.updated_date
          ? (Date.now() - new Date(o.updated_date).getTime()) / 86400000
          : 99;
        return dias >= 3;
      });

      // Top 5 técnicos del mes (por # órdenes completadas)
      const completadasMes = allOrders.filter(o =>
        (o.status === "completed" || o.status === "delivered") &&
        o.updated_date?.slice(0, 7) === month &&
        o.assigned_to
      );
      const porTec = {};
      completadasMes.forEach(o => {
        porTec[o.assigned_to] = (porTec[o.assigned_to] || 0) + 1;
      });
      const empMap = Object.fromEntries((employees || []).map(e => [e.id, e]));
      const topTechs = Object.entries(porTec)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([id, n]) => ({
          name: (empMap[id]?.full_name || "—").split(" ")[0],
          ordenes: n,
        }));

      // Stock crítico
      const stockCrit = (products || []).filter(p =>
        p.stock != null && p.min_stock != null && p.stock <= p.min_stock
      );

      // Tiempo promedio reparación (entregadas este mes)
      const entregadasMes = allOrders.filter(o =>
        (o.status === "delivered" || o.status === "completed") &&
        o.updated_date?.slice(0, 7) === month &&
        o.created_date
      );
      const avgRepairDays = entregadasMes.length
        ? entregadasMes.reduce((acc, o) => {
            const d = (new Date(o.updated_date) - new Date(o.created_date)) / 86400000;
            return acc + Math.max(0, d);
          }, 0) / entregadasMes.length
        : 0;

      setData({
        incToday, incWeek, incMonth, expMonth,
        netoMes: incMonth - expMonth,
        activas: activas.length,
        listas: listas.length,
        retrasadas: retrasadas.length,
        donut, series, topTechs,
        stockCrit: stockCrit.length,
        avgRepairDays,
      });
    } catch (e) {
      console.error("ExecutiveDashboard:", e);
    } finally {
      setLoading(false);
    }
  };

  if (loading) return (
    <div className="apple-type rounded-apple-lg apple-card p-5 space-y-3 animate-pulse">
      {[1, 2, 3, 4].map(i => <div key={i} className="h-20 rounded-apple-md apple-surface" />)}
    </div>
  );
  if (!data) return null;

  const totalDonut = data.donut.reduce((s, d) => s + d.value, 0) || 1;

  const KPI_STYLES = {
    today: "bg-apple-green/12 text-apple-green",
    week: "bg-apple-blue/12 text-apple-blue",
    month: "bg-apple-purple/12 text-apple-purple",
  };

  return (
    <div className="apple-type space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="apple-text-subheadline font-semibold apple-label-secondary">
          Dashboard Ejecutivo
        </h2>
        <div className="flex items-center gap-3">
          <button onClick={() => navigate("/Appointments")}
            className="apple-text-caption1 text-apple-purple font-semibold transition-colors">
            📅 Citas
          </button>
          <button onClick={load}
            className="apple-text-caption1 apple-label-tertiary font-semibold transition-colors">
            ↻ Actualizar
          </button>
        </div>
      </div>

      {/* KPIs ingresos */}
      <div className="grid grid-cols-3 gap-2">
        {[
          { label: "Hoy", val: data.incToday, key: "today" },
          { label: "7 días", val: data.incWeek, key: "week" },
          { label: "Mes", val: data.incMonth, key: "month" },
        ].map(({ label, val, key }) => (
          <div key={label} onClick={() => navigate("/Financial")}
            className={`apple-press rounded-apple-md ${KPI_STYLES[key]} p-3 cursor-pointer transition-colors`}>
            <p className="apple-text-headline font-semibold leading-none tabular-nums">
              {currency(val)}
            </p>
            <p className="apple-text-caption2 apple-label-tertiary font-semibold mt-1">
              {label}
            </p>
          </div>
        ))}
      </div>

      {/* Neto del mes */}
      <div className="flex items-center justify-between px-4 py-3 rounded-apple-md apple-card">
        <div className="flex items-center gap-2">
          {data.netoMes >= 0
            ? <TrendingUp className="w-4 h-4 text-apple-green" />
            : <TrendingDown className="w-4 h-4 text-apple-red" />}
          <span className="apple-text-subheadline apple-label-secondary">Neto del mes</span>
        </div>
        <span className={`apple-text-headline font-semibold tabular-nums ${data.netoMes >= 0 ? "text-apple-green" : "text-apple-red"}`}>
          {currency(data.netoMes)}
        </span>
      </div>

      {/* === GRÁFICOS === */}

      {/* Línea de ingresos 14 días */}
      <div className="rounded-apple-md apple-card p-4">
        <div className="flex items-center justify-between mb-3">
          <span className="apple-text-caption1 font-semibold apple-label-tertiary">
            Ingresos · 14 días
          </span>
          <DollarSign className="w-3.5 h-3.5 apple-label-tertiary" />
        </div>
        <div style={{ width: "100%", height: 180 }}>
          <ResponsiveContainer>
            <LineChart data={data.series} margin={{ top: 5, right: 8, left: -20, bottom: 0 }}>
              <CartesianGrid stroke="rgba(255,255,255,0.05)" vertical={false} />
              <XAxis dataKey="day" tick={{ fill: "rgba(255,255,255,0.4)", fontSize: 10 }}
                axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: "rgba(255,255,255,0.4)", fontSize: 10 }}
                axisLine={false} tickLine={false} tickFormatter={shortCurrency} />
              <Tooltip
                contentStyle={{
                  background: "#111",
                  border: "1px solid rgba(255,255,255,0.1)",
                  borderRadius: 12,
                  fontSize: 12,
                }}
                labelStyle={{ color: "#fff" }}
                formatter={(v) => [currency(v), "Ingresos"]}
              />
              <Line
                type="monotone"
                dataKey="ingresos"
                stroke="#34C759"
                strokeWidth={2.5}
                dot={false}
                activeDot={{ r: 5, fill: "#34C759" }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Donut estados + Bar top técnicos */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        {/* Donut estados */}
        <div className="rounded-apple-md apple-card p-4">
          <div className="flex items-center justify-between mb-3">
            <span className="apple-text-caption1 font-semibold apple-label-tertiary">
              Órdenes por estado
            </span>
            <button onClick={() => navigate("/Orders")}
              className="flex items-center gap-1 apple-text-caption1 text-apple-purple font-semibold transition-colors tabular-nums">
              {data.activas} <ChevronRight className="w-3 h-3" />
            </button>
          </div>
          {data.donut.length > 0 ? (
            <div style={{ width: "100%", height: 180 }}>
              <ResponsiveContainer>
                <PieChart>
                  <Pie
                    data={data.donut}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    innerRadius={45}
                    outerRadius={70}
                    paddingAngle={2}
                  >
                    {data.donut.map((entry, idx) => (
                      <Cell key={idx} fill={entry.color} stroke="rgba(0,0,0,0.4)" strokeWidth={1} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      background: "#111",
                      border: "1px solid rgba(255,255,255,0.1)",
                      borderRadius: 12,
                      fontSize: 12,
                    }}
                    formatter={(v, n) => [`${v} (${Math.round((v / totalDonut) * 100)}%)`, n]}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="h-[180px] flex items-center justify-center apple-label-tertiary apple-text-caption1">
              Sin órdenes activas
            </div>
          )}
          {/* leyenda compacta */}
          <div className="grid grid-cols-2 gap-x-3 gap-y-1 mt-2">
            {data.donut.slice(0, 6).map((d) => (
              <div key={d.name} className="flex items-center gap-1.5 apple-text-caption2">
                <span className="w-2 h-2 rounded-full" style={{ background: d.color }} />
                <span className="apple-label-secondary truncate">{d.name}</span>
                <span className="apple-label-primary font-semibold ml-auto tabular-nums">{d.value}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Bar top técnicos */}
        <div className="rounded-apple-md apple-card p-4">
          <div className="flex items-center justify-between mb-3">
            <span className="apple-text-caption1 font-semibold apple-label-tertiary">
              Top técnicos · mes
            </span>
            <Wrench className="w-3.5 h-3.5 apple-label-tertiary" />
          </div>
          {data.topTechs.length > 0 ? (
            <div style={{ width: "100%", height: 180 }}>
              <ResponsiveContainer>
                <BarChart
                  data={data.topTechs}
                  layout="vertical"
                  margin={{ top: 5, right: 8, left: 0, bottom: 0 }}
                >
                  <CartesianGrid stroke="rgba(255,255,255,0.05)" horizontal={false} />
                  <XAxis type="number" tick={{ fill: "rgba(255,255,255,0.4)", fontSize: 10 }}
                    axisLine={false} tickLine={false} />
                  <YAxis dataKey="name" type="category" width={70}
                    tick={{ fill: "rgba(255,255,255,0.55)", fontSize: 11 }}
                    axisLine={false} tickLine={false} />
                  <Tooltip
                    contentStyle={{
                      background: "#111",
                      border: "1px solid rgba(255,255,255,0.1)",
                      borderRadius: 12,
                      fontSize: 12,
                    }}
                    cursor={{ fill: "rgba(255,255,255,0.04)" }}
                    formatter={(v) => [v, "Órdenes"]}
                  />
                  <Bar dataKey="ordenes" fill="#AF52DE" radius={[0, 6, 6, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="h-[180px] flex items-center justify-center apple-label-tertiary apple-text-caption1">
              Sin completadas este mes
            </div>
          )}
        </div>
      </div>

      {/* Alertas rápidas */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
        <button onClick={() => navigate("/Orders")}
          className={`apple-press flex items-center gap-2 px-3 py-2.5 rounded-apple-md transition-colors ${data.listas > 0 ? "bg-apple-green/12" : "apple-card"}`}>
          <CheckCircle2 className={`w-4 h-4 shrink-0 ${data.listas > 0 ? "text-apple-green" : "apple-label-tertiary"}`} />
          <div className="text-left">
            <p className={`apple-text-headline font-semibold leading-none tabular-nums ${data.listas > 0 ? "text-apple-green" : "apple-label-tertiary"}`}>
              {data.listas}
            </p>
            <p className="apple-text-caption2 apple-label-tertiary">Listas</p>
          </div>
        </button>
        <button onClick={() => navigate("/Orders")}
          className={`apple-press flex items-center gap-2 px-3 py-2.5 rounded-apple-md transition-colors ${data.retrasadas > 0 ? "bg-apple-orange/12" : "apple-card"}`}>
          <Clock className={`w-4 h-4 shrink-0 ${data.retrasadas > 0 ? "text-apple-orange" : "apple-label-tertiary"}`} />
          <div className="text-left">
            <p className={`apple-text-headline font-semibold leading-none tabular-nums ${data.retrasadas > 0 ? "text-apple-orange" : "apple-label-tertiary"}`}>
              {data.retrasadas}
            </p>
            <p className="apple-text-caption2 apple-label-tertiary">Retrasadas</p>
          </div>
        </button>
        <button onClick={() => navigate("/Inventory")}
          className={`apple-press flex items-center gap-2 px-3 py-2.5 rounded-apple-md transition-colors ${data.stockCrit > 0 ? "bg-apple-red/12" : "apple-card"}`}>
          <AlertTriangle className={`w-4 h-4 shrink-0 ${data.stockCrit > 0 ? "text-apple-red" : "apple-label-tertiary"}`} />
          <div className="text-left">
            <p className={`apple-text-headline font-semibold leading-none tabular-nums ${data.stockCrit > 0 ? "text-apple-red" : "apple-label-tertiary"}`}>
              {data.stockCrit}
            </p>
            <p className="apple-text-caption2 apple-label-tertiary">Stock crítico</p>
          </div>
        </button>
        <div className="flex items-center gap-2 px-3 py-2.5 rounded-apple-md apple-card">
          <Package className="w-4 h-4 apple-label-tertiary shrink-0" />
          <div className="text-left">
            <p className="apple-text-headline font-semibold leading-none apple-label-secondary tabular-nums">
              {data.avgRepairDays.toFixed(1)}d
            </p>
            <p className="apple-text-caption2 apple-label-tertiary">Tiempo prom.</p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default memo(ExecutiveDashboardImpl);
