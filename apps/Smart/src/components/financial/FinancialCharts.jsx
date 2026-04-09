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
  income: "#10b981",
  expense: "#ef4444",
  cyan: "#06b6d4",
  violet: "#8b5cf6",
  emerald: "#10b981",
  amber: "#f59e0b",
  pink: "#ec4899",
  blue: "#3b82f6",
  red: "#ef4444",
  teal: "#14b8a6",
};

const chartTooltip = {
  contentStyle: {
    background: "#111114",
    border: "1px solid #ffffff20",
    borderRadius: "8px",
    fontSize: "11px",
    padding: "8px 12px",
  },
  labelStyle: { color: "#ffffff80", marginBottom: "4px" },
  itemStyle: { color: "#fff" },
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
    <div className="bg-white/[0.03] border border-white/[0.06] rounded-2xl p-4">
      <div className="flex items-center justify-between mb-3">
        <div>
          <p className="text-xs font-black text-white/70 uppercase tracking-wider">{title}</p>
          {subtitle && <p className="text-[10px] text-white/30 mt-0.5">{subtitle}</p>}
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
        <defs>
          <linearGradient id="gIncome" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor={COLORS.income} stopOpacity={0.4} />
            <stop offset="95%" stopColor={COLORS.income} stopOpacity={0} />
          </linearGradient>
          <linearGradient id="gExpense" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor={COLORS.expense} stopOpacity={0.4} />
            <stop offset="95%" stopColor={COLORS.expense} stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="#ffffff08" />
        <XAxis dataKey="day" tick={{ fill: "#ffffff60", fontSize: 9 }} interval="preserveStartEnd" />
        <YAxis tick={{ fill: "#ffffff60", fontSize: 9 }} tickFormatter={(v) => `$${v}`} />
        <Tooltip {...chartTooltip} formatter={(v) => `$${Number(v).toFixed(2)}`} />
        <Legend wrapperStyle={{ fontSize: "10px", color: "#ffffff80" }} />
        <Area type="monotone" dataKey="income" name="Entró" stroke={COLORS.income} strokeWidth={2} fill="url(#gIncome)" fillOpacity={1} />
        <Area type="monotone" dataKey="expense" name="Salió" stroke={COLORS.expense} strokeWidth={2} fill="url(#gExpense)" fillOpacity={1} />
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
        <CartesianGrid strokeDasharray="3 3" stroke="#ffffff08" />
        <XAxis dataKey="day" tick={{ fill: "#ffffff60", fontSize: 9 }} interval="preserveStartEnd" />
        <YAxis tick={{ fill: "#ffffff60", fontSize: 9 }} tickFormatter={(v) => `$${v}`} />
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
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%", color: "#ffffff30", fontSize: "11px" }}>
          Sin órdenes registradas
        </div>
      </ChartCard>
    );
  }

  return (
    <ChartCard title="🔧 Órdenes por estado" subtitle="Total de OTs por etapa">
      <BarChart data={data} layout="vertical" margin={{ top: 5, right: 30, left: 50, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#ffffff08" horizontal={false} />
        <XAxis type="number" tick={{ fill: "#ffffff60", fontSize: 9 }} />
        <YAxis type="category" dataKey="status" width={110} tick={{ fill: "#ffffff80", fontSize: 10 }} />
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
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%", color: "#ffffff30", fontSize: "11px" }}>
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
          style={{ fontSize: 10, fill: "#ffffff90" }}
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
        <CartesianGrid strokeDasharray="3 3" stroke="#ffffff08" />
        <XAxis dataKey="week" tick={{ fill: "#ffffff60", fontSize: 9 }} interval={1} />
        <YAxis tick={{ fill: "#ffffff60", fontSize: 9 }} allowDecimals={false} />
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
    <div className="space-y-3">
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
