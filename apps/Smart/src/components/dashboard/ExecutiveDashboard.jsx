import React, { useState, useEffect } from "react";
import { dataClient } from "@/components/api/dataClient";
import { TrendingUp, TrendingDown, Clock, CheckCircle2, AlertTriangle, Users, ChevronRight } from "lucide-react";
import { useNavigate } from "react-router-dom";

function currency(n) {
  return (Number(n) || 0).toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
}

const STATUS_LABELS = {
  intake: "Entrada", diagnosing: "Diagnóstico", in_progress: "En rep.", waiting_parts: "Esp. piezas",
  ready: "Listo", ready_for_pickup: "Listo", completed: "Completado",
};
const STATUS_COLORS = {
  intake: "bg-blue-500", diagnosing: "bg-purple-500", in_progress: "bg-cyan-500",
  waiting_parts: "bg-orange-500", ready: "bg-emerald-500", ready_for_pickup: "bg-emerald-500",
};
const CLOSED = ["completed", "cancelled", "delivered", "picked_up"];

export default function ExecutiveDashboard() {
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    load();
  }, []);

  const load = async () => {
    try {
      const now    = new Date();
      const today  = now.toISOString().slice(0, 10);
      const month  = now.toISOString().slice(0, 7);
      const week   = new Date(now.getTime() - 7 * 86400000).toISOString().slice(0, 10);

      const [orders, txs, products, employees] = await Promise.all([
        dataClient.entities.Order.list("-updated_date", 300),
        dataClient.entities.Transaction.list("-created_date", 500),
        dataClient.entities.Product.list("-created_date", 200),
        dataClient.entities.AppEmployee.list("full_name", 50),
      ]);

      const allOrders  = orders || [];
      const allTxs     = txs    || [];

      // Ingresos
      const incToday = allTxs.filter(t => t.type === "income" && t.created_date?.slice(0, 10) === today).reduce((s, t) => s + (t.amount || 0), 0);
      const incWeek  = allTxs.filter(t => t.type === "income" && t.created_date?.slice(0, 10) >= week).reduce((s, t) => s + (t.amount || 0), 0);
      const incMonth = allTxs.filter(t => t.type === "income" && t.created_date?.slice(0, 7) === month).reduce((s, t) => s + (t.amount || 0), 0);
      const expMonth = allTxs.filter(t => t.type === "expense" && t.created_date?.slice(0, 7) === month).reduce((s, t) => s + (t.amount || 0), 0);

      // Órdenes activas por estado
      const activas = allOrders.filter(o => !CLOSED.includes(o.status));
      const porEstado = {};
      activas.forEach(o => {
        const s = o.status || "intake";
        porEstado[s] = (porEstado[s] || 0) + 1;
      });

      // Órdenes listas
      const listas = activas.filter(o => o.status === "ready" || o.status === "ready_for_pickup");

      // Órdenes retrasadas (+3 días sin movimiento)
      const retrasadas = activas.filter(o => {
        const dias = o.updated_date ? (Date.now() - new Date(o.updated_date).getTime()) / 86400000 : 99;
        return dias >= 3;
      });

      // Top técnico del mes
      const completadasMes = allOrders.filter(o => o.status === "completed" && o.updated_date?.slice(0, 7) === month && o.assigned_to);
      const porTecnico = {};
      completadasMes.forEach(o => { porTecnico[o.assigned_to] = (porTecnico[o.assigned_to] || 0) + 1; });
      const topEntry = Object.entries(porTecnico).sort((a, b) => b[1] - a[1])[0];
      const topTech  = topEntry ? (employees || []).find(e => e.id === topEntry[0]) : null;

      // Stock crítico
      const stockCrit = (products || []).filter(p => p.stock != null && p.min_stock != null && p.stock <= p.min_stock);

      setData({ incToday, incWeek, incMonth, expMonth, netoMes: incMonth - expMonth, activas: activas.length, listas: listas.length, retrasadas: retrasadas.length, porEstado, topTech: topTech ? { nombre: topTech.full_name, ordenes: topEntry[1] } : null, stockCrit: stockCrit.length });
    } catch (e) {
      console.error("ExecutiveDashboard:", e);
    } finally {
      setLoading(false);
    }
  };

  if (loading) return (
    <div className="rounded-3xl bg-white/[0.03] border border-white/[0.06] p-5 space-y-3 animate-pulse">
      {[1,2,3].map(i => <div key={i} className="h-10 rounded-xl bg-white/[0.04]" />)}
    </div>
  );

  if (!data) return null;

  const estadosOrdenados = Object.entries(data.porEstado).sort((a, b) => b[1] - a[1]);
  const totalActivas = data.activas || 1;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-black text-white/60 uppercase tracking-widest">Dashboard Ejecutivo</h2>
        <div className="flex items-center gap-3">
          <button onClick={() => navigate("/Appointments")}
            className="text-[10px] text-violet-400 hover:text-violet-300 font-bold uppercase tracking-widest transition-colors">
            📅 Citas
          </button>
          <button onClick={load} className="text-[10px] text-white/25 hover:text-white/50 font-bold uppercase tracking-widest transition-colors">↻</button>
        </div>
      </div>

      {/* KPIs de ingresos */}
      <div className="grid grid-cols-3 gap-2">
        {[
          { label: "Hoy",    val: data.incToday, color: "emerald" },
          { label: "7 días", val: data.incWeek,  color: "cyan" },
          { label: "Mes",    val: data.incMonth, color: "violet" },
        ].map(({ label, val, color }) => (
          <div key={label} onClick={() => navigate("/Financial")}
            className={`rounded-2xl bg-${color}-500/[0.08] border border-${color}-500/20 p-3 cursor-pointer hover:bg-${color}-500/[0.14] transition-colors`}>
            <p className={`text-lg font-black text-${color}-300 leading-none`}>{currency(val)}</p>
            <p className="text-[10px] text-white/30 font-bold uppercase tracking-widest mt-1">{label}</p>
          </div>
        ))}
      </div>

      {/* Neto del mes */}
      <div className="flex items-center justify-between px-4 py-3 rounded-2xl bg-white/[0.03] border border-white/[0.06]">
        <div className="flex items-center gap-2">
          {data.netoMes >= 0
            ? <TrendingUp className="w-4 h-4 text-emerald-400" />
            : <TrendingDown className="w-4 h-4 text-red-400" />}
          <span className="text-sm text-white/60">Neto del mes</span>
        </div>
        <span className={`text-base font-black ${data.netoMes >= 0 ? "text-emerald-300" : "text-red-400"}`}>
          {currency(data.netoMes)}
        </span>
      </div>

      {/* Órdenes activas por estado */}
      <div className="rounded-2xl bg-white/[0.03] border border-white/[0.06] p-4 space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-xs font-black text-white/40 uppercase tracking-widest">Órdenes activas</span>
          <button onClick={() => navigate("/Orders")} className="flex items-center gap-1 text-[11px] text-violet-400 hover:text-violet-300 font-bold transition-colors">
            {data.activas} total <ChevronRight className="w-3 h-3" />
          </button>
        </div>
        {estadosOrdenados.slice(0, 5).map(([status, count]) => {
          const pct = Math.round((count / totalActivas) * 100);
          return (
            <div key={status} className="space-y-1">
              <div className="flex justify-between text-xs">
                <span className="text-white/50">{STATUS_LABELS[status] || status}</span>
                <span className="text-white/70 font-bold">{count}</span>
              </div>
              <div className="h-1.5 rounded-full bg-white/[0.06] overflow-hidden">
                <div className={`h-full rounded-full ${STATUS_COLORS[status] || "bg-white/30"} transition-all`}
                  style={{ width: `${pct}%` }} />
              </div>
            </div>
          );
        })}
      </div>

      {/* Alertas rápidas */}
      <div className="grid grid-cols-2 gap-2">
        <button onClick={() => navigate("/Orders")}
          className={`flex items-center gap-2 px-3 py-2.5 rounded-2xl border transition-colors ${data.listas > 0 ? "bg-emerald-500/[0.08] border-emerald-500/25 hover:bg-emerald-500/[0.14]" : "bg-white/[0.03] border-white/[0.06]"}`}>
          <CheckCircle2 className={`w-4 h-4 shrink-0 ${data.listas > 0 ? "text-emerald-400" : "text-white/20"}`} />
          <div className="text-left">
            <p className={`text-base font-black leading-none ${data.listas > 0 ? "text-emerald-300" : "text-white/30"}`}>{data.listas}</p>
            <p className="text-[10px] text-white/30">Listas</p>
          </div>
        </button>
        <button onClick={() => navigate("/Orders")}
          className={`flex items-center gap-2 px-3 py-2.5 rounded-2xl border transition-colors ${data.retrasadas > 0 ? "bg-orange-500/[0.08] border-orange-500/25 hover:bg-orange-500/[0.14]" : "bg-white/[0.03] border-white/[0.06]"}`}>
          <Clock className={`w-4 h-4 shrink-0 ${data.retrasadas > 0 ? "text-orange-400" : "text-white/20"}`} />
          <div className="text-left">
            <p className={`text-base font-black leading-none ${data.retrasadas > 0 ? "text-orange-300" : "text-white/30"}`}>{data.retrasadas}</p>
            <p className="text-[10px] text-white/30">Retrasadas</p>
          </div>
        </button>
        {data.stockCrit > 0 && (
          <button onClick={() => navigate("/Inventory")}
            className="flex items-center gap-2 px-3 py-2.5 rounded-2xl border bg-red-500/[0.08] border-red-500/25 hover:bg-red-500/[0.14] transition-colors">
            <AlertTriangle className="w-4 h-4 text-red-400 shrink-0" />
            <div className="text-left">
              <p className="text-base font-black text-red-300 leading-none">{data.stockCrit}</p>
              <p className="text-[10px] text-white/30">Stock crítico</p>
            </div>
          </button>
        )}
        {data.topTech && (
          <div className="flex items-center gap-2 px-3 py-2.5 rounded-2xl border bg-violet-500/[0.06] border-violet-500/20">
            <Users className="w-4 h-4 text-violet-400 shrink-0" />
            <div className="text-left min-w-0">
              <p className="text-xs font-black text-violet-300 leading-none truncate">{data.topTech.nombre.split(" ")[0]}</p>
              <p className="text-[10px] text-white/30">{data.topTech.ordenes} este mes</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
