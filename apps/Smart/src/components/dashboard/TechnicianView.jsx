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
  intake:           { label: "Recepción",       color: "cyan",    bg: "bg-cyan-500/10",    border: "border-cyan-500/20",    text: "text-cyan-300" },
  diagnosing:       { label: "Diagnóstico",      color: "blue",    bg: "bg-blue-500/10",    border: "border-blue-500/20",    text: "text-blue-300" },
  in_progress:      { label: "En Reparación",    color: "amber",   bg: "bg-amber-500/10",   border: "border-amber-500/20",   text: "text-amber-300" },
  waiting_parts:    { label: "Esperando Piezas", color: "orange",  bg: "bg-orange-500/10",  border: "border-orange-500/20",  text: "text-orange-300" },
  ready_for_pickup: { label: "Lista p/ Recoger", color: "emerald", bg: "bg-emerald-500/10", border: "border-emerald-500/20", text: "text-emerald-300" },
  awaiting_approval:{ label: "Esperando aprob.", color: "yellow",  bg: "bg-yellow-500/10",  border: "border-yellow-500/20",  text: "text-yellow-300" },
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

  return (
    <div className="flex-1 min-h-0 overflow-y-auto">
      <div className="px-3 sm:px-6 pt-4 pb-24 max-w-2xl mx-auto space-y-4">

        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs text-white/30 font-black uppercase tracking-widest">{greeting}</p>
            <h1 className="text-xl font-black text-white">{userName}</h1>
          </div>
          <div className="flex items-center gap-2">
            <PunchButton userId={userId} userName={userName} variant="apple" />
            <button
              onClick={() => onNewOrder?.()}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-cyan-500/15 border border-cyan-500/20 text-cyan-300 font-black text-xs hover:bg-cyan-500/25 active:scale-95 transition-all"
            >
              <Plus className="w-3.5 h-3.5" />
              Nueva
            </button>
          </div>
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-3 gap-2">
          {[
            { label: "En progreso", count: counts.in_progress, icon: Wrench, color: "amber" },
            { label: "Esperando", count: counts.waiting_parts, icon: Package, color: "orange" },
            { label: "Listas", count: counts.ready_for_pickup, icon: CheckCircle2, color: "emerald" },
          ].map(s => {
            const Icon = s.icon;
            return (
              <button
                key={s.label}
                onClick={() => setActiveFilter(activeFilter === s.label.toLowerCase().replace(" ", "_") ? "all" : (s.label === "En progreso" ? "in_progress" : s.label === "Esperando" ? "waiting_parts" : "ready_for_pickup"))}
                className={`p-3 rounded-2xl border transition-all text-center bg-${s.color}-500/5 border-${s.color}-500/10 hover:bg-${s.color}-500/10`}
              >
                <Icon className={`w-4 h-4 text-${s.color}-400 mx-auto mb-1`} />
                <p className={`text-xl font-black text-${s.color}-300`}>{s.count}</p>
                <p className="text-[9px] font-black text-white/25 uppercase tracking-widest">{s.label}</p>
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
              className={`shrink-0 px-3 py-1.5 rounded-xl text-xs font-black transition-all ${
                activeFilter === f.id
                  ? "bg-cyan-600 text-white"
                  : "bg-white/[0.04] border border-white/[0.08] text-white/30 hover:text-white/60"
              }`}
            >
              {f.label}
            </button>
          ))}
          <button onClick={load} className="shrink-0 px-2 py-1.5 rounded-xl bg-white/[0.03] border border-white/[0.06] text-white/20 hover:text-white/50 transition-colors ml-auto">
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Orders list */}
        {loading ? (
          <div className="py-12 flex items-center justify-center">
            <RefreshCw className="w-5 h-5 text-white/20 animate-spin" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="py-12 text-center">
            <CheckCircle2 className="w-8 h-8 text-white/10 mx-auto mb-2" />
            <p className="text-white/25 text-sm font-medium">Sin órdenes en esta categoría</p>
          </div>
        ) : (
          <div className="space-y-2">
            {filtered.map(order => {
              const s = STATUS_CONFIG[order.status] || { label: order.status, bg: "bg-white/5", border: "border-white/10", text: "text-white/40" };
              const DevIcon = DEVICE_ICON(order.device_type);
              const updatedAt = order.updated_date ? new Date(order.updated_date) : null;
              return (
                <button
                  key={order.id}
                  onClick={() => navigate(createPageUrl("Orders") + `?order=${order.id}`)}
                  className="w-full text-left p-3.5 rounded-2xl bg-white/[0.03] border border-white/[0.06] hover:border-white/10 active:scale-[0.98] transition-all"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-white/5 flex items-center justify-center shrink-0">
                      <DevIcon className="w-4 h-4 text-white/30" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-bold text-white">
                          {order.order_number || order.id?.slice(0, 8)}
                        </p>
                        <span className={`text-[9px] font-black px-1.5 py-0.5 rounded-full border ${s.bg} ${s.border} ${s.text}`}>
                          {s.label}
                        </span>
                      </div>
                      <p className="text-xs text-white/40 truncate">
                        {order.customer_name} · {[order.device_brand, order.device_model].filter(Boolean).join(" ") || order.device_type}
                      </p>
                    </div>
                    <div className="shrink-0 text-right">
                      {updatedAt && (
                        <p className="text-[9px] text-white/20">{format(updatedAt, "d MMM", { locale: es })}</p>
                      )}
                      <ChevronRight className="w-3.5 h-3.5 text-white/20 ml-auto mt-1" />
                    </div>
                  </div>
                  {order.initial_problem && (
                    <p className="mt-1.5 ml-12 text-xs text-white/25 truncate">{order.initial_problem}</p>
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
