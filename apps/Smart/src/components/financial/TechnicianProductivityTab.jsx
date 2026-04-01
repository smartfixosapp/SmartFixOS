import React, { useState, useEffect, useMemo } from "react";
import { dataClient } from "@/components/api/dataClient";
import { Users, CheckCircle2, Clock, TrendingUp, Wrench, RefreshCw } from "lucide-react";
import { format, isWithinInterval, startOfDay, endOfDay } from "date-fns";
import { es } from "date-fns/locale";

const STATUS_LABELS = {
  completed: "Completada",
  ready_for_pickup: "Lista",
  in_progress: "En progreso",
  pending: "Pendiente",
  cancelled: "Cancelada",
};

const STATUS_COLOR = {
  completed: "text-emerald-400",
  ready_for_pickup: "text-cyan-400",
  in_progress: "text-amber-400",
  pending: "text-white/40",
  cancelled: "text-red-400",
};

export default function TechnicianProductivityTab({ dateFilter, customStartDate, customEndDate }) {
  const [orders, setOrders] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedTech, setSelectedTech] = useState(null);

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const [ords, emps] = await Promise.all([
          dataClient.entities.Order.list("-updated_date", 1000),
          dataClient.entities.AppEmployee.list(),
        ]);
        setOrders(ords || []);
        setEmployees(emps || []);
      } catch (e) {
        console.error("TechnicianProductivityTab load error:", e);
      }
      setLoading(false);
    }
    load();
  }, []);

  // Date range filter
  const filteredOrders = useMemo(() => {
    const now = new Date();
    let start, end;
    if (dateFilter === "today") { start = startOfDay(now); end = endOfDay(now); }
    else if (dateFilter === "week") { start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 6); end = endOfDay(now); }
    else if (dateFilter === "month") { start = new Date(now.getFullYear(), now.getMonth(), 1); end = endOfDay(now); }
    else if (dateFilter === "quarter") { start = new Date(now.getFullYear(), now.getMonth() - 2, 1); end = endOfDay(now); }
    else if (dateFilter === "year") { start = new Date(now.getFullYear(), 0, 1); end = endOfDay(now); }
    else if (dateFilter === "custom" && customStartDate && customEndDate) {
      start = startOfDay(new Date(customStartDate));
      end = endOfDay(new Date(customEndDate));
    }
    if (!start || !end) return orders;
    return orders.filter(o => {
      const d = new Date(o.created_date || o.updated_date);
      return isWithinInterval(d, { start, end });
    });
  }, [orders, dateFilter, customStartDate, customEndDate]);

  // Group by technician
  const techStats = useMemo(() => {
    const map = {};

    for (const o of filteredOrders) {
      const key = o.assigned_to || "__unassigned__";
      const name = o.assigned_to_name || "Sin asignar";
      if (!map[key]) {
        map[key] = {
          id: key,
          name,
          total: 0,
          completed: 0,
          in_progress: 0,
          ready_for_pickup: 0,
          cancelled: 0,
          revenue: 0,
          orders: [],
        };
      }
      map[key].total++;
      map[key].orders.push(o);
      const s = o.status || o.current_status;
      if (s === "completed") { map[key].completed++; map[key].revenue += Number(o.total_price || o.grand_total || 0); }
      else if (s === "in_progress") map[key].in_progress++;
      else if (s === "ready_for_pickup") map[key].ready_for_pickup++;
      else if (s === "cancelled") map[key].cancelled++;
    }

    return Object.values(map).sort((a, b) => b.completed - a.completed);
  }, [filteredOrders]);

  const topTech = techStats[0];

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <RefreshCw className="w-5 h-5 text-white/20 animate-spin" />
      </div>
    );
  }

  if (techStats.length === 0) {
    return (
      <div className="py-16 text-center">
        <Users className="w-8 h-8 text-white/10 mx-auto mb-2" />
        <p className="text-white/30 text-sm font-medium">Sin datos en el período seleccionado</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Summary row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        {[
          { label: "Técnicos activos", value: techStats.filter(t => t.id !== "__unassigned__").length, icon: Users, color: "cyan" },
          { label: "Órdenes totales", value: filteredOrders.length, icon: Wrench, color: "blue" },
          { label: "Completadas", value: techStats.reduce((s, t) => s + t.completed, 0), icon: CheckCircle2, color: "emerald" },
          { label: "Ingresos generados", value: `$${techStats.reduce((s, t) => s + t.revenue, 0).toFixed(0)}`, icon: TrendingUp, color: "violet" },
        ].map(stat => {
          const Icon = stat.icon;
          return (
            <div key={stat.label} className={`p-3 rounded-2xl bg-${stat.color}-500/5 border border-${stat.color}-500/10`}>
              <div className="flex items-center gap-2 mb-1">
                <Icon className={`w-3.5 h-3.5 text-${stat.color}-400`} />
                <span className="text-[10px] font-black text-white/30 uppercase tracking-widest">{stat.label}</span>
              </div>
              <p className={`text-xl font-black text-${stat.color}-300`}>{stat.value}</p>
            </div>
          );
        })}
      </div>

      {/* Technician cards */}
      <div className="space-y-2">
        {techStats.map((tech, idx) => {
          const completionRate = tech.total > 0 ? Math.round((tech.completed / tech.total) * 100) : 0;
          const isTop = idx === 0 && tech.completed > 0 && tech.id !== "__unassigned__";
          const isSelected = selectedTech === tech.id;
          return (
            <div key={tech.id}>
              <button
                onClick={() => setSelectedTech(isSelected ? null : tech.id)}
                className={`w-full text-left p-3 sm:p-4 rounded-2xl border transition-all ${
                  isSelected
                    ? "bg-white/[0.07] border-white/20"
                    : "bg-white/[0.03] border-white/[0.06] hover:border-white/10"
                }`}
              >
                <div className="flex items-center gap-3">
                  {/* Avatar */}
                  <div className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 font-black text-sm ${
                    tech.id === "__unassigned__" ? "bg-white/5 text-white/20" : "bg-gradient-to-br from-cyan-500/20 to-blue-500/20 text-cyan-300"
                  }`}>
                    {tech.name[0].toUpperCase()}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-bold text-white truncate">{tech.name}</p>
                      {isTop && (
                        <span className="text-[9px] font-black bg-amber-500/15 text-amber-400 border border-amber-500/20 px-1.5 py-0.5 rounded-full">TOP</span>
                      )}
                    </div>
                    {/* Progress bar */}
                    <div className="flex items-center gap-2 mt-1">
                      <div className="flex-1 h-1 bg-white/5 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-gradient-to-r from-cyan-500 to-emerald-500 rounded-full transition-all"
                          style={{ width: `${completionRate}%` }}
                        />
                      </div>
                      <span className="text-[10px] font-black text-white/30 shrink-0">{completionRate}%</span>
                    </div>
                  </div>

                  {/* Stats */}
                  <div className="hidden sm:flex items-center gap-4 shrink-0">
                    <div className="text-center">
                      <p className="text-xs font-black text-emerald-400">{tech.completed}</p>
                      <p className="text-[9px] text-white/20">Completadas</p>
                    </div>
                    <div className="text-center">
                      <p className="text-xs font-black text-amber-400">{tech.in_progress}</p>
                      <p className="text-[9px] text-white/20">En progreso</p>
                    </div>
                    <div className="text-center">
                      <p className="text-xs font-black text-white/50">{tech.total}</p>
                      <p className="text-[9px] text-white/20">Total</p>
                    </div>
                    {tech.revenue > 0 && (
                      <div className="text-center">
                        <p className="text-xs font-black text-violet-400">${tech.revenue.toFixed(0)}</p>
                        <p className="text-[9px] text-white/20">Ingresos</p>
                      </div>
                    )}
                  </div>

                  {/* Mobile stats */}
                  <div className="flex sm:hidden items-center gap-3 shrink-0">
                    <span className="text-xs font-black text-emerald-400">{tech.completed} ✓</span>
                    <span className="text-xs font-black text-white/30">{tech.total}</span>
                  </div>
                </div>
              </button>

              {/* Expanded order list */}
              {isSelected && (
                <div className="mt-1 ml-3 p-3 rounded-2xl bg-white/[0.02] border border-white/[0.05] space-y-1.5">
                  <p className="text-[10px] font-black text-white/20 uppercase tracking-widest mb-2">Órdenes del período</p>
                  {tech.orders.slice(0, 15).map(o => {
                    const s = o.status || o.current_status;
                    return (
                      <div key={o.id} className="flex items-center gap-2 text-[11px]">
                        <span className={`font-bold w-16 truncate ${STATUS_COLOR[s] || "text-white/40"}`}>
                          {o.order_number || o.id?.slice(0, 6)}
                        </span>
                        <span className="text-white/50 flex-1 truncate">
                          {[o.device_brand, o.device_model].filter(Boolean).join(" ") || o.device_type || "—"}
                        </span>
                        <span className={`font-bold ${STATUS_COLOR[s] || "text-white/30"}`}>
                          {STATUS_LABELS[s] || s || "—"}
                        </span>
                        {o.total_price ? (
                          <span className="text-violet-400 font-black">${Number(o.total_price).toFixed(0)}</span>
                        ) : null}
                      </div>
                    );
                  })}
                  {tech.orders.length > 15 && (
                    <p className="text-[10px] text-white/20 pt-1">+{tech.orders.length - 15} más</p>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
