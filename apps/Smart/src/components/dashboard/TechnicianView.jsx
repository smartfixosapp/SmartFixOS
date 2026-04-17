import React, { useState, useEffect } from "react";
import { dataClient } from "@/components/api/dataClient";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/components/utils/helpers";
import { Wrench, Clock, Package, CheckCircle2, Plus, ChevronRight, RefreshCw, Smartphone, Laptop, Tablet, Watch, Box } from "lucide-react";
import PunchButton from "@/components/dashboard/PunchButton";
import { format } from "date-fns";
import { es } from "date-fns/locale";

const DEVICE_ICON = (type = "") => {
  const t = String(type).toLowerCase();
  if (t.includes("phone") || t.includes("iphone") || t.includes("galaxy")) return Smartphone;
  if (t.includes("laptop") || t.includes("mac") || t.includes("computer")) return Laptop;
  if (t.includes("tablet") || t.includes("ipad")) return Tablet;
  if (t.includes("watch")) return Watch;
  return Box;
};

const STATUS_CONFIG = {
  intake:           { label: "Recepción",       bg: "bg-apple-blue/15",   text: "text-apple-blue" },
  diagnosing:       { label: "Diagnóstico",      bg: "bg-apple-blue/15",   text: "text-apple-blue" },
  in_progress:      { label: "En Reparación",    bg: "bg-apple-yellow/15", text: "text-apple-yellow" },
  waiting_parts:    { label: "Esperando Piezas", bg: "bg-apple-orange/15", text: "text-apple-orange" },
  ready_for_pickup: { label: "Lista p/ Recoger", bg: "bg-apple-green/15",  text: "text-apple-green" },
  awaiting_approval:{ label: "Esperando aprob.", bg: "bg-apple-yellow/15", text: "text-apple-yellow" },
};

export default function TechnicianView({ session, onNewOrder }) {
  const navigate = useNavigate();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeFilter, setActiveFilter] = useState("all");

  const userId = session?.userId;
  const userName = session?.userName || "Técnico";

  useEffect(() => {
    load();
  }, [userId]);

  async function load() {
    setLoading(true);
    try {
      const all = await dataClient.entities.Order.list("-updated_date", 200);
      const closed = new Set(["delivered", "cancelled", "completed", "picked_up"]);
      const mine = (all || []).filter(o => {
        if (closed.has(o.status)) return false;
        if (userId && o.assigned_to && o.assigned_to !== userId) return false;
        return true;
      });
      setOrders(mine);
    } catch (e) {
      console.error(e);
    }
    setLoading(false);
  }

  const FILTERS = [
    { id: "all",           label: "Todas" },
    { id: "in_progress",   label: "En progreso" },
    { id: "waiting_parts", label: "Piezas" },
    { id: "ready_for_pickup", label: "Listas" },
  ];

  const filtered = activeFilter === "all" ? orders : orders.filter(o => o.status === activeFilter);

  const counts = {
    in_progress: orders.filter(o => o.status === "in_progress").length,
    waiting_parts: orders.filter(o => o.status === "waiting_parts").length,
    ready_for_pickup: orders.filter(o => o.status === "ready_for_pickup").length,
  };

  const greeting = (() => {
    const h = new Date().getHours();
    if (h < 12) return "Buenos días";
    if (h < 18) return "Buenas tardes";
    return "Buenas noches";
  })();

  const STAT_COLORS = {
    in_progress: "bg-apple-yellow/12 text-apple-yellow",
    waiting_parts: "bg-apple-orange/12 text-apple-orange",
    ready_for_pickup: "bg-apple-green/12 text-apple-green",
  };

  return (
    <div className="apple-type flex-1 min-h-0 overflow-y-auto">
      <div className="px-3 sm:px-6 pt-4 pb-24 max-w-2xl mx-auto space-y-4">

        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <p className="apple-text-caption2 apple-label-tertiary font-semibold">{greeting}</p>
            <h1 className="apple-text-title2 apple-label-primary">{userName}</h1>
          </div>
          <div className="flex items-center gap-2">
            <PunchButton userId={userId} userName={userName} variant="apple" />
            <button
              onClick={() => onNewOrder?.()}
              className="apple-press flex items-center gap-1.5 px-3 py-2 rounded-apple-md bg-apple-blue/15 text-apple-blue font-semibold apple-text-caption1 transition-all"
            >
              <Plus className="w-3.5 h-3.5" />
              Nueva
            </button>
          </div>
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-3 gap-2">
          {[
            { label: "En progreso", key: "in_progress", count: counts.in_progress, icon: Wrench },
            { label: "Esperando",   key: "waiting_parts", count: counts.waiting_parts, icon: Package },
            { label: "Listas",      key: "ready_for_pickup", count: counts.ready_for_pickup, icon: CheckCircle2 },
          ].map(s => {
            const Icon = s.icon;
            const colorClass = STAT_COLORS[s.key];
            return (
              <button
                key={s.label}
                onClick={() => setActiveFilter(activeFilter === s.key ? "all" : s.key)}
                className={`apple-press p-3 rounded-apple-md transition-all text-center ${colorClass}`}
              >
                <Icon className="w-4 h-4 mx-auto mb-1" />
                <p className="apple-text-title3 font-semibold tabular-nums">{s.count}</p>
                <p className="apple-text-caption2 font-semibold opacity-80">{s.label}</p>
              </button>
            );
          })}
        </div>

        {/* Filter pills */}
        <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-none">
          {FILTERS.map(f => (
            <button
              key={f.id}
              onClick={() => setActiveFilter(f.id)}
              className={`apple-press shrink-0 px-3 py-1.5 rounded-apple-md apple-text-caption1 font-semibold transition-all ${
                activeFilter === f.id
                  ? "bg-apple-blue text-white"
                  : "apple-surface apple-label-secondary"
              }`}
            >
              {f.label}
            </button>
          ))}
          <button onClick={load} className="apple-press shrink-0 px-2 py-1.5 rounded-apple-md apple-surface apple-label-secondary transition-colors ml-auto">
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Orders list */}
        {loading ? (
          <div className="py-12 flex items-center justify-center">
            <RefreshCw className="w-5 h-5 apple-label-tertiary animate-spin" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="py-12 text-center">
            <CheckCircle2 className="w-8 h-8 apple-label-tertiary mx-auto mb-2" />
            <p className="apple-label-tertiary apple-text-subheadline font-medium">Sin órdenes en esta categoría</p>
          </div>
        ) : (
          <div className="space-y-2">
            {filtered.map(order => {
              const s = STATUS_CONFIG[order.status] || { label: order.status, bg: "bg-gray-sys6 dark:bg-gray-sys5", text: "apple-label-secondary" };
              const DevIcon = DEVICE_ICON(order.device_type);
              const updatedAt = order.updated_date ? new Date(order.updated_date) : null;
              return (
                <button
                  key={order.id}
                  onClick={() => navigate(createPageUrl("Orders") + `?order=${order.id}`)}
                  className="apple-press w-full text-left p-3.5 rounded-apple-md apple-card transition-all"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-apple-sm bg-apple-blue/15 flex items-center justify-center shrink-0">
                      <DevIcon className="w-4 h-4 text-apple-blue" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="apple-text-subheadline font-semibold apple-label-primary">
                          {order.order_number || order.id?.slice(0, 8)}
                        </p>
                        <span className={`apple-text-caption2 font-semibold px-1.5 py-0.5 rounded-full ${s.bg} ${s.text}`}>
                          {s.label}
                        </span>
                      </div>
                      <p className="apple-text-caption1 apple-label-secondary truncate">
                        {order.customer_name} · {[order.device_brand, order.device_model].filter(Boolean).join(" ") || order.device_type}
                      </p>
                    </div>
                    <div className="shrink-0 text-right">
                      {updatedAt && (
                        <p className="apple-text-caption2 apple-label-tertiary tabular-nums">{format(updatedAt, "d MMM", { locale: es })}</p>
                      )}
                      <ChevronRight className="w-3.5 h-3.5 apple-label-tertiary ml-auto mt-1" />
                    </div>
                  </div>
                  {order.initial_problem && (
                    <p className="mt-1.5 ml-12 apple-text-caption1 apple-label-tertiary truncate">{order.initial_problem}</p>
                  )}
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
