// === FinancialCharts.jsx — 5 gráficos para el dashboard de SmartFixOS ===
//   #1  Ingresos vs Gastos diarios (area chart, últimos 30 días)
//   #2  Ganancia neta diaria (bar chart, verde/rojo según signo)
//   #6  Órdenes por estado (bar chart vertical)
//   #11 Stock por categoría (donut chart)
//   #15 Nuevos clientes por semana (line chart, últimas 12 semanas)

import React, { useMemo } from "react";
import {
  LineChart, Line, AreaChart, Area, BarChart, Bar,
  PieChart, Pie, Cell,
  XAxis, YAxis, Tooltip, ResponsiveContainer, Legend, CartesianGrid,
} from "recharts";

const COLORS = {
  income: "#34C759",   // apple-green
  expense: "#FF3B30",  // apple-red
  cyan: "#007AFF",     // apple-blue
  violet: "#AF52DE",   // apple-purple
  emerald: "#34C759",  // apple-green
  amber: "#FF9500",    // apple-orange
  pink: "#FF2D55",     // apple-pink -> use red
  blue: "#007AFF",     // apple-blue
  red: "#FF3B30",
  teal: "#5856D6",     // apple-indigo
};

const chartTooltip = {
  contentStyle: {
    background: "rgb(var(--bg-elevated))",
    border: "0.5px solid rgb(var(--separator) / 0.29)",
    borderRadius: "10px",
    fontSize: "13px",
    padding: "8px 12px",
    fontVariantNumeric: "tabular-nums",
  },
  labelStyle: { color: "rgb(var(--label-secondary))", marginBottom: "4px" },
  itemStyle: { color: "rgb(var(--label-primary))" },
};

const dateKey = (d) => {
  const dt = d instanceof Date ? d : new Date(d);
  return dt.toISOString().slice(0, 10);
};
const labelDay = (k) => {
  const [, m, d] = k.split("-");
  return `${d}/${m}`;
};
const weekKey = (d) => {
  const dt = d instanceof Date ? d : new Date(d);
  const day = dt.getUTCDay();
  const diff = dt.getUTCDate() - day + (day === 0 ? -6 : 1);
  const monday = new Date(Date.UTC(dt.getUTCFullYear(), dt.getUTCMonth(), diff));
  return monday.toISOString().slice(0, 10);
};
const labelWeek = (k) => {
  const [, m, d] = k.split("-");
  return `${d}/${m}`;
};

function ChartCard({ title, subtitle, children, height = 240 }) {
  return (
    <div className="apple-type apple-card rounded-apple-md p-4">
      <div className="flex items-center justify-between mb-3">
        <div>
          <p className="apple-text-footnote font-semibold apple-label-primary">{title}</p>
          {subtitle && <p className="apple-text-caption2 apple-label-tertiary mt-0.5 tabular-nums">{subtitle}</p>}
        </div>
      </div>
      <ResponsiveContainer width="100%" height={height}>
        {children}
      </ResponsiveContainer>
    </div>
  );
}

// ── #1 Ingresos vs Gastos diarios ────────────────────────────────────────
function IncomeVsExpenseChart({ sales = [], expenses = [], days = 30 }) {
  const data = useMemo(() => {
    const map = new Map();
    const now = new Date();
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      map.set(dateKey(d), { day: labelDay(dateKey(d)), income: 0, expense: 0 });
    }
    for (const s of sales || []) {
      if (s?.voided) continue;
      const k = dateKey(s.created_date || s.created_at);
      if (map.has(k)) map.get(k).income += Number(s.total || s.amount_paid || 0);
    }
    for (const e of expenses || []) {
      const k = dateKey(e.created_date || e.created_at);
      if (map.has(k)) map.get(k).expense += Math.abs(Number(e.amount || 0));
    }
    return Array.from(map.values());
  }, [sales, expenses, days]);

  return (
    <ChartCard title="💰 Ingresos vs Gastos" subtitle={`Últimos ${days} días`}>
      <AreaChart data={data} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="rgb(var(--separator) / 0.29)" />
        <XAxis dataKey="day" tick={{ fill: "rgb(var(--label-secondary))", fontSize: 11 }} interval="preserveStartEnd" />
        <YAxis tick={{ fill: "rgb(var(--label-secondary))", fontSize: 11 }} tickFormatter={(v) => `$${v}`} />
        <Tooltip {...chartTooltip} formatter={(v) => `$${Number(v).toFixed(2)}`} />
        <Legend wrapperStyle={{ fontSize: "12px", color: "rgb(var(--label-secondary))" }} />
        <Area type="monotone" dataKey="income" name="Entró" stroke={COLORS.income} strokeWidth={2} fill={COLORS.income} fillOpacity={0.15} />
        <Area type="monotone" dataKey="expense" name="Salió" stroke={COLORS.expense} strokeWidth={2} fill={COLORS.expense} fillOpacity={0.15} />
      </AreaChart>
    </ChartCard>
  );
}

// ── #2 Ganancia neta diaria ──────────────────────────────────────────────
function NetProfitChart({ sales = [], expenses = [], days = 30 }) {
  const data = useMemo(() => {
    const map = new Map();
    const now = new Date();
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      map.set(dateKey(d), { day: labelDay(dateKey(d)), income: 0, expense: 0, net: 0 });
    }
    for (const s of sales || []) {
      if (s?.voided) continue;
      const k = dateKey(s.created_date || s.created_at);
      if (map.has(k)) map.get(k).income += Number(s.total || 0);
    }
    for (const e of expenses || []) {
      const k = dateKey(e.created_date || e.created_at);
      if (map.has(k)) map.get(k).expense += Math.abs(Number(e.amount || 0));
    }
    return Array.from(map.values()).map((d) => ({ ...d, net: d.income - d.expense }));
  }, [sales, expenses, days]);

  return (
    <ChartCard title="📈 Ganancia neta diaria" subtitle="Verde = ganancia · Rojo = pérdida">
      <BarChart data={data} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="rgb(var(--separator) / 0.29)" />
        <XAxis dataKey="day" tick={{ fill: "rgb(var(--label-secondary))", fontSize: 11 }} interval="preserveStartEnd" />
        <YAxis tick={{ fill: "rgb(var(--label-secondary))", fontSize: 11 }} tickFormatter={(v) => `$${v}`} />
        <Tooltip {...chartTooltip} formatter={(v) => `$${Number(v).toFixed(2)}`} />
        <Bar dataKey="net" name="Neto" radius={[4, 4, 0, 0]}>
          {data.map((d, i) => (
            <Cell key={i} fill={d.net >= 0 ? COLORS.income : COLORS.expense} />
          ))}
        </Bar>
      </BarChart>
    </ChartCard>
  );
}

// ── #6 Órdenes por estado ────────────────────────────────────────────────
function OrdersByStatusChart({ orders = [] }) {
  const data = useMemo(() => {
    const labels = {
      intake: "Recepción",
      diagnosing: "Diagnóstico",
      pending_order: "Pendiente",
      waiting_parts: "Esperando piezas",
      in_repair: "En reparación",
      ready_for_pickup: "Lista",
      delivered: "Entregada",
      cancelled: "Cancelada",
    };
    const counts = new Map();
    for (const o of orders || []) {
      const s = o?.status || "intake";
      counts.set(s, (counts.get(s) || 0) + 1);
    }
    return Array.from(counts.entries())
      .map(([k, v]) => ({ status: labels[k] || k, count: v, key: k }))
      .sort((a, b) => b.count - a.count);
  }, [orders]);

  const colorByStatus = (k) => {
    if (k === "delivered") return COLORS.emerald;
    if (k === "ready_for_pickup") return COLORS.cyan;
    if (k === "in_repair" || k === "diagnosing") return COLORS.violet;
    if (k === "waiting_parts" || k === "pending_order") return COLORS.amber;
    if (k === "cancelled") return COLORS.red;
    return COLORS.blue;
  };

  if (data.length === 0) {
    return (
      <ChartCard title="🔧 Órdenes por estado" subtitle="Distribución de OTs">
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%", color: "rgb(var(--label-tertiary))", fontSize: "13px" }}>
          Sin órdenes registradas
        </div>
      </ChartCard>
    );
  }

  return (
    <ChartCard title="🔧 Órdenes por estado" subtitle="Total de OTs por etapa">
      <BarChart data={data} layout="vertical" margin={{ top: 5, right: 30, left: 50, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="rgb(var(--separator) / 0.29)" horizontal={false} />
        <XAxis type="number" tick={{ fill: "rgb(var(--label-secondary))", fontSize: 11 }} />
        <YAxis type="category" dataKey="status" width={110} tick={{ fill: "rgb(var(--label-primary))", fontSize: 12 }} />
        <Tooltip {...chartTooltip} formatter={(v) => [v, "Órdenes"]} />
        <Bar dataKey="count" radius={[0, 4, 4, 0]}>
          {data.map((d, i) => (
            <Cell key={i} fill={colorByStatus(d.key)} />
          ))}
        </Bar>
      </BarChart>
    </ChartCard>
  );
}

// ── #11 Stock por categoría ──────────────────────────────────────────────
function StockByCategoryChart({ products = [] }) {
  const data = useMemo(() => {
    const labels = {
      screen: "Pantallas",
      battery: "Baterías",
      charger: "Cargadores",
      cable: "Cables",
      case: "Cases",
      diagnostic: "Diagnóstico",
      other: "Otros",
    };
    const counts = new Map();
    for (const p of products || []) {
      if (p?.active === false) continue;
      const cat = p?.category || "other";
      const stock = Number(p?.stock || 0);
      counts.set(cat, (counts.get(cat) || 0) + stock);
    }
    return Array.from(counts.entries())
      .filter(([_, v]) => v > 0)
      .map(([k, v]) => ({ name: labels[k] || k, value: v, key: k }))
      .sort((a, b) => b.value - a.value);
  }, [products]);

  const palette = [COLORS.cyan, COLORS.violet, COLORS.emerald, COLORS.amber, COLORS.pink, COLORS.blue, COLORS.teal];

  if (data.length === 0) {
    return (
      <ChartCard title="📦 Stock por categoría" subtitle="Unidades en inventario">
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%", color: "rgb(var(--label-tertiary))", fontSize: "13px" }}>
          Sin productos en stock
        </div>
      </ChartCard>
    );
  }

  const total = data.reduce((s, d) => s + d.value, 0);

  return (
    <ChartCard title="📦 Stock por categoría" subtitle={`${total} unidades totales`}>
      <PieChart>
        <Pie
          data={data}
          cx="50%" cy="50%"
          innerRadius={50} outerRadius={90}
          paddingAngle={2}
          dataKey="value"
          label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
          labelLine={false}
          style={{ fontSize: 11, fill: "rgb(var(--label-primary))", fontVariantNumeric: "tabular-nums" }}
        >
          {data.map((_, i) => (
            <Cell key={i} fill={palette[i % palette.length]} />
          ))}
        </Pie>
        <Tooltip {...chartTooltip} formatter={(v, name) => [`${v} unidades`, name]} />
      </PieChart>
    </ChartCard>
  );
}

// ── #15 Nuevos clientes por semana ───────────────────────────────────────
function NewCustomersChart({ customers = [], weeks = 12 }) {
  const data = useMemo(() => {
    const map = new Map();
    const now = new Date();
    for (let i = weeks - 1; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(d.getDate() - i * 7);
      const k = weekKey(d);
      map.set(k, { week: labelWeek(k), count: 0 });
    }
    for (const c of customers || []) {
      const k = weekKey(c.created_date || c.created_at);
      if (map.has(k)) map.get(k).count++;
    }
    return Array.from(map.values());
  }, [customers, weeks]);

  return (
    <ChartCard title="👥 Nuevos clientes por semana" subtitle={`Últimas ${weeks} semanas`}>
      <LineChart data={data} margin={{ top: 5, right: 10, left: -25, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="rgb(var(--separator) / 0.29)" />
        <XAxis dataKey="week" tick={{ fill: "rgb(var(--label-secondary))", fontSize: 11 }} interval={1} />
        <YAxis tick={{ fill: "rgb(var(--label-secondary))", fontSize: 11 }} allowDecimals={false} />
        <Tooltip {...chartTooltip} formatter={(v) => [v, "Clientes nuevos"]} />
        <Line
          type="monotone"
          dataKey="count"
          stroke={COLORS.violet}
          strokeWidth={2.5}
          dot={{ fill: COLORS.violet, r: 4 }}
          activeDot={{ r: 6 }}
        />
      </LineChart>
    </ChartCard>
  );
}

// ── Componente principal ─────────────────────────────────────────────────
export default function FinancialCharts({
  sales = [],
  expenses = [],
  orders = [],
  products = [],
  customers = [],
}) {
  return (
    <div className="apple-type space-y-3">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        <IncomeVsExpenseChart sales={sales} expenses={expenses} />
        <NetProfitChart sales={sales} expenses={expenses} />
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        <OrdersByStatusChart orders={orders} />
        <StockByCategoryChart products={products} />
      </div>
      <NewCustomersChart customers={customers} />
    </div>
  );
}

export {
  IncomeVsExpenseChart,
  NetProfitChart,
  OrdersByStatusChart,
  StockByCategoryChart,
  NewCustomersChart,
};
