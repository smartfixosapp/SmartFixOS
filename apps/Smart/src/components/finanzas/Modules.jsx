import { useEffect, useMemo, useState } from "react";
import { Loader2, ArrowUpDown } from "lucide-react";
import { supabase } from "../../../../../lib/supabase-client.js";
import { Dialog, TextAction } from "@/components/pos/native/posUi";
import { FP, isRevenue, num, txDate } from "@/lib/finance/ledger";
import { addDays, addMonths, monthStart } from "@/lib/finance/tz";
import { periodWeekStart } from "@/lib/finance/ledger";
import { money, Segmented } from "./ui";

const card = { padding: 12, borderRadius: 12, background: "#1C1C1E" };
const Spinner = () => <div className="flex justify-center" style={{ paddingTop: 40 }}><Loader2 className="w-6 h-6 animate-spin" style={{ color: "#8E8E93" }} /></div>;
const Note = ({ children }) => <p style={{ fontSize: 12, color: "#8E8E93" }}>{children}</p>;
const metric = (label, value, sub) => (
  <div className="flex-1 min-w-0">
    <p style={{ fontSize: 11, color: "#8E8E93" }}>{label}</p>
    <p className="truncate" style={{ fontSize: 15, fontWeight: 700 }}>{value}</p>
    {sub && <p style={{ fontSize: 11, color: "#8E8E93" }}>{sub}</p>}
  </div>
);

function Profitability({ tenantId, tz }) {
  const [period, setPeriod] = useState("thisMonth");
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState({ rev: 0, cost: 0, byDevice: [], byTech: [] });
  useEffect(() => {
    let alive = true;
    (async () => {
      setLoading(true);
      const now = new Date();
      const startThis = monthStart(now, tz);
      const range = period === "thisMonth" ? [startThis, now] : period === "lastMonth" ? [addMonths(startThis, -1, tz), startThis] : [addDays(now, -90, tz), now];
      const [o, p] = await Promise.all([
        supabase.from("order").select("id,device_brand,device_family,assigned_to_name,amount_paid,updated_date").eq("tenant_id", tenantId).eq("status", "delivered").eq("is_deleted", false).gte("updated_date", range[0].toISOString()).limit(1000),
        supabase.from("purchase_order").select("line_items").eq("tenant_id", tenantId).neq("status", "cancelled").order("created_at", { ascending: false }).limit(300),
      ]);
      const cost = {};
      (p.data || []).forEach((po) => (Array.isArray(po.line_items) ? po.line_items : []).forEach((li) => {
        if (li?.linked_work_order_id) cost[li.linked_work_order_id] = (cost[li.linked_work_order_id] || 0) + num(li.line_total);
      }));
      const dev = {};
      const tech = {};
      let rev = 0;
      let cst = 0;
      (o.data || []).forEach((row) => {
        const up = row.updated_date ? new Date(row.updated_date) : null;
        if (!up || up > range[1]) return;
        const r = num(row.amount_paid);
        const c = cost[row.id] || 0;
        rev += r;
        cst += c;
        const dk = [row.device_brand, row.device_family].filter(Boolean).join(" ") || "Sin dispositivo";
        const tk = String(row.assigned_to_name || "").trim() || "Sin asignar";
        [[dev, dk], [tech, tk]].forEach(([m, k]) => { const g = m[k] || (m[k] = { label: k, revenue: 0, cost: 0, count: 0 }); g.revenue += r; g.cost += c; g.count += 1; });
      });
      const sort = (m) => Object.values(m).map((g) => ({ ...g, profit: g.revenue - g.cost, margin: g.revenue > 0 ? ((g.revenue - g.cost) / g.revenue) * 100 : 0 })).sort((a, b) => b.profit - a.profit);
      if (alive) { setData({ rev, cost: cst, byDevice: sort(dev), byTech: sort(tech) }); setLoading(false); }
    })();
    return () => { alive = false; };
  }, [period, tenantId, tz]);
  const profit = data.rev - data.cost;
  const margin = data.rev > 0 ? (profit / data.rev) * 100 : 0;
  const section = (title, groups) => (
    <div className="flex flex-col" style={{ gap: 8 }}>
      <p style={{ fontSize: 12, fontWeight: 700, letterSpacing: "0.04em", color: "#8E8E93" }}>{title.toUpperCase()}</p>
      {groups.length === 0 ? <Note>Sin datos suficientes en este período.</Note> : groups.map((g) => (
        <div key={g.label} style={card}>
          <div className="flex justify-between"><span style={{ fontSize: 15, fontWeight: 600 }}>{g.label}</span><span style={{ fontSize: 15, fontWeight: 700, color: g.profit >= 0 ? FP.brand : FP.danger }}>{money(g.profit)}</span></div>
          <p className="flex gap-2" style={{ fontSize: 12, color: "#8E8E93", marginTop: 4 }}>
            <span>{g.count} órdenes</span><span>· {money(g.revenue)} ingreso</span>{g.cost > 0 && <span>· {money(g.cost)} costo</span>}<span className="flex-1" /><span>{g.margin.toFixed(0)}%</span>
          </p>
        </div>
      ))}
    </div>
  );
  return (
    <div className="flex flex-col" style={{ gap: 16 }}>
      <Segmented options={[["thisMonth", "Este mes"], ["lastMonth", "Mes pasado"], ["last90", "Últimos 90 días"]]} value={period} onChange={setPeriod} />
      <Note>El costo solo cuenta piezas pedidas por Compras y vinculadas a la orden. Si usaste piezas de tu inventario sin vincular una compra, ese costo no se refleja aquí — la utilidad real puede ser menor.</Note>
      {loading ? <Spinner /> : (
        <>
          <div>
            <div className="flex gap-4">
              {metric("Ingreso cobrado", <span style={{ color: FP.success }}>{money(data.rev)}</span>)}
              {metric("Costo piezas", <span style={{ color: FP.warning }}>{money(data.cost)}</span>)}
              {metric("Utilidad bruta", <span style={{ color: profit >= 0 ? FP.brand : FP.danger }}>{money(profit)}</span>)}
            </div>
            <p className="text-right" style={{ fontSize: 11, fontWeight: 600, color: "#8E8E93" }}>{margin.toFixed(0)}% margen</p>
          </div>
          {section("Por dispositivo", data.byDevice)}
          {section("Por técnico", data.byTech)}
        </>
      )}
    </div>
  );
}

function TechScorecard({ tenantId }) {
  const [period, setPeriod] = useState("last30");
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState([]);
  useEffect(() => {
    let alive = true;
    (async () => {
      setLoading(true);
      let q = supabase.from("order").select("assigned_to_name,created_date,updated_date,promised_date,review_rating").eq("tenant_id", tenantId).eq("status", "delivered").eq("is_deleted", false);
      if (period !== "all") q = q.gte("updated_date", new Date(Date.now() - (period === "last30" ? 30 : 90) * 86400000).toISOString());
      const { data } = await q.limit(2000);
      const by = {};
      (data || []).forEach((row) => {
        const name = String(row.assigned_to_name || "").trim() || "Sin asignar";
        const s = by[name] || (by[name] = { name, delivered: 0, days: [], onTime: 0, withPromise: 0, revSum: 0, revCount: 0 });
        s.delivered += 1;
        const c = row.created_date ? new Date(row.created_date) : null;
        const u = row.updated_date ? new Date(row.updated_date) : null;
        if (c && u && !Number.isNaN(c.getTime()) && !Number.isNaN(u.getTime())) {
          const days = (u - c) / 86400000;
          if (days >= 0 && days < 90) s.days.push(days);
          if (row.promised_date) { s.withPromise += 1; if (u <= new Date(row.promised_date)) s.onTime += 1; }
        }
        if (row.review_rating !== null && row.review_rating !== undefined) { s.revSum += Number(row.review_rating) || 0; s.revCount += 1; }
      });
      if (alive) { setStats(Object.values(by).sort((a, b) => b.delivered - a.delivered)); setLoading(false); }
    })();
    return () => { alive = false; };
  }, [period, tenantId]);
  return (
    <div className="flex flex-col" style={{ gap: 16 }}>
      <Segmented options={[["last30", "30 días"], ["last90", "90 días"], ["all", "Todo"]]} value={period} onChange={setPeriod} />
      <Note>Basado en órdenes entregadas. Días = desde que se creó la orden hasta que se marcó entregada. A tiempo = entregada antes o el día de la fecha prometida.</Note>
      {loading ? <Spinner /> : stats.length === 0 ? <Note>Sin órdenes entregadas en este período.</Note> : stats.map((s) => (
        <div key={s.name} className="flex flex-col" style={{ ...card, gap: 10 }}>
          <div className="flex justify-between"><span style={{ fontSize: 15, fontWeight: 700 }}>{s.name}</span><span style={{ fontSize: 12, color: "#8E8E93" }}>{s.delivered} entregadas</span></div>
          <div className="flex gap-4">
            {metric("Días prom.", s.days.length ? (s.days.reduce((a, b) => a + b, 0) / s.days.length).toFixed(1) : "—")}
            {metric("A tiempo", s.withPromise ? `${((s.onTime / s.withPromise) * 100).toFixed(0)}%` : "—")}
            {metric("Reseña prom.", s.revCount ? `${(s.revSum / s.revCount).toFixed(1)}★` : "—")}
          </div>
        </div>
      ))}
    </div>
  );
}

function Forecast({ transactions, tz }) {
  const { weeks, forecast } = useMemo(() => {
    const thisWeek = periodWeekStart(new Date(), tz);
    const buckets = [];
    for (let off = 15; off >= 0; off -= 1) buckets.push({ start: addDays(thisWeek, -7 * off, tz), revenue: 0 });
    transactions.forEach((tx) => {
      if (!isRevenue(tx) || tx.is_deleted) return;
      const d = txDate(tx);
      if (!d) return;
      const b = buckets.find((x) => d >= x.start && d < addDays(x.start, 7, tz));
      if (b) b.revenue += num(tx.amount);
    });
    const ys = buckets.map((b) => b.revenue);
    const n = ys.length;
    const xs = ys.map((_, i) => i);
    const sumX = xs.reduce((a, b) => a + b, 0);
    const sumY = ys.reduce((a, b) => a + b, 0);
    const sumXY = xs.reduce((s, x, i) => s + x * ys[i], 0);
    const sumX2 = xs.reduce((s, x) => s + x * x, 0);
    const denom = n * sumX2 - sumX * sumX;
    let f;
    if (denom === 0) f = new Array(4).fill(sumY / n);
    else {
      const slope = (n * sumXY - sumX * sumY) / denom;
      const intercept = (sumY - slope * sumX) / n;
      f = [0, 1, 2, 3].map((i) => Math.max(0, intercept + slope * (n + i)));
    }
    return { weeks: buckets, forecast: f };
  }, [transactions, tz]);
  const max = Math.max(1, ...weeks.map((w) => w.revenue), ...forecast);
  return (
    <div className="flex flex-col" style={{ gap: 16 }}>
      <Note>{weeks.length >= 26 ? "Proyección basada en tendencia reciente y patrones semanales del historial." : "Aún no hay suficiente historial para detectar estacionalidad real (se necesitan 6+ meses). Esto es una proyección de tendencia simple, no un patrón estacional confirmado."}</Note>
      <div className="flex items-end" style={{ height: 140, gap: 3, padding: "0 8px" }}>
        {weeks.map((w, i) => <div key={i} className="flex-1" title={money(w.revenue)} style={{ height: `${Math.max(2, (w.revenue / max) * 140)}px`, borderRadius: 2, background: `${FP.brand}8C` }} />)}
        {forecast.map((v, i) => <div key={`f${i}`} className="flex-1" title={money(v)} style={{ height: `${Math.max(2, (v / max) * 140)}px`, borderRadius: 2, background: `${FP.brand}33`, border: `1px dashed ${FP.brand}` }} />)}
      </div>
      <div className="flex flex-col" style={{ ...card, gap: 8 }}>
        <p style={{ fontSize: 12, fontWeight: 700, color: "#8E8E93" }}>PRÓXIMAS 4 SEMANAS (estimado)</p>
        {forecast.map((v, i) => <div key={i} className="flex justify-between" style={{ padding: "4px 0" }}><span style={{ fontSize: 15 }}>Semana +{i + 1}</span><b style={{ color: FP.brand }}>{money(v)}</b></div>)}
        <div style={{ height: 0.5, background: "rgba(84,84,88,0.6)" }} />
        <div className="flex justify-between"><span style={{ fontSize: 15, fontWeight: 600 }}>Total proyectado</span><b>{money(forecast.reduce((a, b) => a + b, 0))}</b></div>
      </div>
    </div>
  );
}

function ManualSales({ tenantId }) {
  const [period, setPeriod] = useState("last30");
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState([]);
  useEffect(() => {
    let alive = true;
    (async () => {
      setLoading(true);
      let q = supabase.from("sale").select("employee,items,total").eq("tenant_id", tenantId).eq("is_deleted", false).eq("voided", false);
      if (period !== "all") q = q.gte("created_at", new Date(Date.now() - (period === "last30" ? 30 : 90) * 86400000).toISOString());
      const { data } = await q.limit(3000);
      const by = {};
      (data || []).forEach((row) => {
        const name = String(row.employee || "").trim() || "Sin asignar";
        const s = by[name] || (by[name] = { name, manualTotal: 0, manualCount: 0, catalogTotal: 0, catalogCount: 0, saleTotal: 0 });
        s.saleTotal += num(row.total);
        (Array.isArray(row.items) ? row.items : []).forEach((it) => {
          const t = num(it?.total);
          if (!it?.product_id) { s.manualTotal += t; s.manualCount += 1; } else { s.catalogTotal += t; s.catalogCount += 1; }
        });
      });
      if (alive) { setStats(Object.values(by).sort((a, b) => b.manualTotal - a.manualTotal)); setLoading(false); }
    })();
    return () => { alive = false; };
  }, [period, tenantId]);
  return (
    <div className="flex flex-col" style={{ gap: 16 }}>
      <Segmented options={[["last30", "30 días"], ["last90", "90 días"], ["all", "Todo"]]} value={period} onChange={setPeriod} />
      <Note>Ítems manuales = cobrados en POS sin ligar a un producto del catálogo. No es necesariamente un problema, pero un % alto o que solo suba en un empleado vale la pena revisarlo.</Note>
      {loading ? <Spinner /> : stats.length === 0 ? <Note>Sin ventas en este período.</Note> : stats.map((s) => {
        const denom = s.manualTotal + s.catalogTotal;
        const pct = denom > 0 ? (s.manualTotal / denom) * 100 : 0;
        return (
          <div key={s.name} className="flex flex-col" style={{ ...card, gap: 10 }}>
            <div className="flex justify-between"><span style={{ fontSize: 15, fontWeight: 700 }}>{s.name}</span><span style={{ fontSize: 12, fontWeight: 700, color: pct >= 30 ? FP.warning : "#8E8E93" }}>{pct.toFixed(0)}% manual</span></div>
            <div className="flex gap-4">
              {metric("Manual", money(s.manualTotal), `${s.manualCount} ítems`)}
              {metric("Catálogo", money(s.catalogTotal), `${s.catalogCount} ítems`)}
              {metric("Total ventas", money(s.saleTotal))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function Cuadres({ tenantId }) {
  const [loading, setLoading] = useState(true);
  const [entries, setEntries] = useState([]);
  const [byDiff, setByDiff] = useState(true);
  useEffect(() => {
    let alive = true;
    (async () => {
      setLoading(true);
      const { data } = await supabase.from("cash_register").select("id,date,closed_by,final_count").eq("tenant_id", tenantId).eq("status", "closed").order("date", { ascending: false }).limit(200);
      const rows = (data || []).map((r) => {
        const fc = r.final_count || {};
        if (fc.counted_total === null || fc.counted_total === undefined || fc.expected_cash === null || fc.expected_cash === undefined) return null;
        const counted = num(fc.counted_total);
        const expected = num(fc.expected_cash);
        return { id: r.id, closedBy: String(r.closed_by || "").trim() || "Sin asignar", dateLabel: r.date || "", counted, expected, difference: fc.difference !== null && fc.difference !== undefined ? num(fc.difference) : counted - expected };
      }).filter(Boolean);
      if (alive) { setEntries(rows); setLoading(false); }
    })();
    return () => { alive = false; };
  }, [tenantId]);
  const sorted = [...entries].sort((a, b) => (byDiff ? Math.abs(b.difference) - Math.abs(a.difference) : b.dateLabel.localeCompare(a.dateLabel)));
  return (
    <div className="flex flex-col" style={{ gap: 12 }}>
      <div className="flex justify-end"><button onClick={() => setByDiff(!byDiff)} className="flex items-center gap-1" style={{ fontSize: 13, fontWeight: 600, color: FP.brand }}><ArrowUpDown className="w-3.5 h-3.5" /> {byDiff ? "Por diferencia" : "Por fecha"}</button></div>
      {loading ? <Spinner /> : entries.length === 0 ? <Note>Sin cierres de caja registrados todavía.</Note> : (
        <>
          <div style={{ borderRadius: 12, background: "#1C1C1E" }}>
            {sorted.map((e, i) => {
              const bal = Math.abs(e.difference) <= 0.05;
              return (
                <div key={e.id} className="flex items-center" style={{ padding: "10px 14px", borderTop: i ? "0.5px solid rgba(84,84,88,0.6)" : "none" }}>
                  <div className="flex-1">
                    <p style={{ fontSize: 15, fontWeight: 600 }}>{e.closedBy}</p>
                    <p style={{ fontSize: 12, color: "#8E8E93" }}>{e.dateLabel}</p>
                    <p style={{ fontSize: 11, color: "#8E8E93" }}>Contado {money(e.counted)} · Esperado {money(e.expected)}</p>
                  </div>
                  <span style={{ fontSize: 15, fontWeight: 700, color: bal ? FP.success : e.difference < 0 ? FP.danger : FP.warning }}>{bal ? "Exacto" : money(e.difference)}</span>
                </div>
              );
            })}
          </div>
          <Note>Una diferencia aislada no dice mucho, pero un patrón recurrente en la misma persona vale la pena conversarlo.</Note>
        </>
      )}
    </div>
  );
}

const TITLES = {
  rentabilidad: "Rentabilidad real",
  tecnicos: "Desempeño por técnico",
  pronostico: "Pronóstico de ingresos",
  ventasManuales: "Ventas manuales por cajero",
  cuadres: "Historial de cuadres de caja",
};

export default function ReportModuleDialog({ module, onClose, tenantId, tz, transactions }) {
  if (!module) return null;
  return (
    <Dialog open onClose={onClose} title={TITLES[module]} width={760} height="86dvh" leading={<span />} trailing={<TextAction onClick={onClose}>Cerrar</TextAction>}>
      <div style={{ paddingTop: 8 }}>
        {module === "rentabilidad" && <Profitability tenantId={tenantId} tz={tz} />}
        {module === "tecnicos" && <TechScorecard tenantId={tenantId} />}
        {module === "pronostico" && <Forecast transactions={transactions} tz={tz} />}
        {module === "ventasManuales" && <ManualSales tenantId={tenantId} />}
        {module === "cuadres" && <Cuadres tenantId={tenantId} />}
      </div>
    </Dialog>
  );
}
