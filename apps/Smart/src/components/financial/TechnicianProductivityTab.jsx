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
  completed: "text-apple-green",
  ready_for_pickup: "text-apple-blue",
  in_progress: "text-apple-orange",
  pending: "apple-label-tertiary",
  cancelled: "text-apple-red",
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
      <div className="apple-type flex items-center justify-center py-16">
        <RefreshCw className="w-5 h-5 apple-label-secondary animate-spin" />
      </div>
    );
  }

  if (techStats.length === 0) {
    return (
      <div className="apple-type py-16 text-center">
        <Users className="w-8 h-8 apple-label-tertiary mx-auto mb-2" />
        <p className="apple-label-tertiary apple-text-footnote font-medium">Sin datos en el período seleccionado</p>
      </div>
    );
  }

  const summaryStats = [
    { label: "Técnicos activos", value: techStats.filter(t => t.id !== "__unassigned__").length, icon: Users, bg: "bg-apple-blue/12", text: "text-apple-blue" },
    { label: "Órdenes totales", value: filteredOrders.length, icon: Wrench, bg: "bg-apple-blue/12", text: "text-apple-blue" },
    { label: "Completadas", value: techStats.reduce((s, t) => s + t.completed, 0), icon: CheckCircle2, bg: "bg-apple-green/12", text: "text-apple-green" },
    { label: "Ingresos generados", value: `$${techStats.reduce((s, t) => s + t.revenue, 0).toFixed(0)}`, icon: TrendingUp, bg: "bg-apple-purple/12", text: "text-apple-purple" },
  ];

  return (
    <div className="apple-type space-y-3">
      {/* Summary row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        {summaryStats.map(stat => {
          const Icon = stat.icon;
          return (
            <div key={stat.label} className={`apple-card p-3 rounded-apple-md ${stat.bg}`}>
              <div className="flex items-center gap-2 mb-1">
                <Icon className={`w-3.5 h-3.5 ${stat.text}`} />
                <span className="apple-text-caption2 font-semibold apple-label-tertiary">{stat.label}</span>
              </div>
              <p className={`apple-text-title2 tabular-nums ${stat.text}`}>{stat.value}</p>
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
                className={`apple-press w-full text-left p-3 sm:p-4 rounded-apple-md transition-all ${
                  isSelected
                    ? "apple-card bg-gray-sys6 dark:bg-gray-sys5"
                    : "apple-card"
                }`}
              >
                <div className="flex items-center gap-3">
                  {/* Avatar */}
                  <div className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 font-semibold apple-text-footnote ${
                    tech.id === "__unassigned__" ? "bg-gray-sys6 dark:bg-gray-sys5 apple-label-secondary" : "bg-apple-blue/15 text-apple-blue"
                  }`}>
                    {tech.name[0].toUpperCase()}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="apple-text-footnote font-semibold apple-label-primary truncate">{tech.name}</p>
                      {isTop && (
                        <span className="apple-text-caption2 font-semibold bg-apple-orange/15 text-apple-orange px-1.5 py-0.5 rounded-full">TOP</span>
                      )}
                    </div>
                    {/* Progress bar */}
                    <div className="flex items-center gap-2 mt-1">
                      <div className="flex-1 h-1 bg-gray-sys6 dark:bg-gray-sys5 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-apple-green rounded-full transition-all"
                          style={{ width: `${completionRate}%` }}
                        />
                      </div>
                      <span className="apple-text-caption2 font-semibold apple-label-tertiary tabular-nums shrink-0">{completionRate}%</span>
                    </div>
                  </div>

                  {/* Stats */}
                  <div className="hidden sm:flex items-center gap-4 shrink-0">
                    <div className="text-center">
                      <p className="apple-text-footnote font-semibold tabular-nums text-apple-green">{tech.completed}</p>
                      <p className="apple-text-caption2 apple-label-tertiary">Completadas</p>
                    </div>
                    <div className="text-center">
                      <p className="apple-text-footnote font-semibold tabular-nums text-apple-orange">{tech.in_progress}</p>
                      <p className="apple-text-caption2 apple-label-tertiary">En progreso</p>
                    </div>
                    <div className="text-center">
                      <p className="apple-text-footnote font-semibold tabular-nums apple-label-secondary">{tech.total}</p>
                      <p className="apple-text-caption2 apple-label-tertiary">Total</p>
                    </div>
                    {tech.revenue > 0 && (
                      <div className="text-center">
                        <p className="apple-text-footnote font-semibold tabular-nums text-apple-purple">${tech.revenue.toFixed(0)}</p>
                        <p className="apple-text-caption2 apple-label-tertiary">Ingresos</p>
                      </div>
                    )}
                  </div>

                  {/* Mobile stats */}
                  <div className="flex sm:hidden items-center gap-3 shrink-0">
                    <span className="apple-text-footnote font-semibold tabular-nums text-apple-green">{tech.completed} ✓</span>
                    <span className="apple-text-footnote font-semibold tabular-nums apple-label-tertiary">{tech.total}</span>
                  </div>
                </div>
              </button>

              {/* Expanded order list */}
              {isSelected && (
                <div className="mt-1 ml-3 p-3 rounded-apple-md apple-card space-y-1.5">
                  <p className="apple-text-caption2 font-semibold apple-label-secondary mb-2">Órdenes del período</p>
                  {tech.orders.slice(0, 15).map(o => {
                    const s = o.status || o.current_status;
                    return (
                      <div key={o.id} className="flex items-center gap-2 apple-text-caption1">
                        <span className={`font-semibold tabular-nums w-16 truncate ${STATUS_COLOR[s] || "apple-label-tertiary"}`}>
                          {o.order_number || o.id?.slice(0, 6)}
                        </span>
                        <span className="apple-label-secondary flex-1 truncate">
                          {[o.device_brand, o.device_model].filter(Boolean).join(" ") || o.device_type || "—"}
                        </span>
                        <span className={`font-semibold ${STATUS_COLOR[s] || "apple-label-tertiary"}`}>
                          {STATUS_LABELS[s] || s || "—"}
                        </span>
                        {o.total_price ? (
                          <span className="text-apple-purple font-semibold tabular-nums">${Number(o.total_price).toFixed(0)}</span>
                        ) : null}
                      </div>
                    );
                  })}
                  {tech.orders.length > 15 && (
                    <p className="apple-text-caption2 apple-label-tertiary tabular-nums pt-1">+{tech.orders.length - 15} más</p>
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
