import React, { useState, useEffect, useMemo, useCallback } from "react";
import { Send, Loader2 } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { dataClient } from "@/components/api/dataClient";
import MobileVisualTimeline from "./MobileVisualTimeline";
import { triggerHaptic } from "@/lib/capacitor";

const SUB_TABS = [
  { id: "ventas", label: "Ventas" },
  { id: "diagnostico", label: "Diagnostico" },
  { id: "estado", label: "Estado" },
  { id: "notas", label: "Notas" },
];

const VENTAS_TYPES = new Set(["payment", "item_added", "item_removed", "sale", "refund"]);
const DIAG_TYPES = new Set(["diagnostic", "initial_problem", "create", "checklist"]);
const STATUS_TYPES = new Set(["status_change"]);
const NOTE_TYPES = new Set(["note", "note_added", "comment"]);

export default function MobileHistorialTab({ order, onUpdate }) {
  const [activeSubTab, setActiveSubTab] = useState("ventas");
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [comment, setComment] = useState("");
  const [posting, setPosting] = useState(false);

  const o = order || {};

  // Load events
  useEffect(() => {
    if (!o.id) return;
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      try {
        const result = await dataClient.entities.WorkOrderEvent.filter(
          { order_id: o.id },
          "-created_date",
          200
        );
        if (!cancelled) setEvents(Array.isArray(result) ? result : []);
      } catch {
        if (!cancelled) setEvents([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    return () => { cancelled = true; };
  }, [o.id]);

  // Filter events per sub-tab
  const filteredEvents = useMemo(() => {
    const typeSet =
      activeSubTab === "ventas" ? VENTAS_TYPES
      : activeSubTab === "diagnostico" ? DIAG_TYPES
      : activeSubTab === "estado" ? STATUS_TYPES
      : NOTE_TYPES;

    return events.filter(ev => typeSet.has(ev.event_type));
  }, [events, activeSubTab]);

  // Financial summary for ventas
  const ventasSummary = useMemo(() => {
    const total = Number(o.total || o.cost_estimate || 0);
    const paid = Number(o.amount_paid ?? o.total_paid ?? 0);
    const balance = o.balance_due != null ? Math.max(0, Number(o.balance_due || 0)) : Math.max(0, total - paid);
    return { total, paid, balance };
  }, [o]);

  // Post comment
  const postComment = useCallback(async () => {
    if (!comment.trim() || !o.id) return;
    setPosting(true);
    triggerHaptic("light");
    try {
      let me = null;
      try { me = await base44.auth.me(); } catch {}
      await base44.entities.WorkOrderEvent.create({
        order_id: o.id,
        order_number: o.order_number,
        event_type: "note",
        description: comment.trim(),
        user_name: me?.full_name || me?.email || "Sistema",
        user_id: me?.id || null,
      });
      setComment("");
      // Reload events
      const result = await dataClient.entities.WorkOrderEvent.filter({ order_id: o.id }, "-created_date", 200);
      setEvents(Array.isArray(result) ? result : []);
      onUpdate?.();
      toast.success("Nota agregada");
    } catch {
      toast.error("Error al guardar nota");
    } finally {
      setPosting(false);
    }
  }, [comment, o.id, o.order_number, onUpdate]);

  const emptyMessages = {
    ventas: "No sales to show",
    diagnostico: "Sin diagnosticos registrados",
    estado: "Sin cambios de estado",
    notas: "Sin notas registradas",
  };

  return (
    <div className="space-y-4 pb-8">
      {/* Sub-tabs */}
      <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1">
        {SUB_TABS.map(tab => (
          <button
            key={tab.id}
            onClick={() => { setActiveSubTab(tab.id); triggerHaptic("light"); }}
            className={cn(
              "flex-shrink-0 px-4 py-2 rounded-full text-xs font-semibold transition-all whitespace-nowrap",
              activeSubTab === tab.id
                ? "bg-white/10 text-white border border-white/20"
                : "bg-white/[0.03] text-white/40 border border-white/[0.06]"
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Ventas summary banner */}
      {activeSubTab === "ventas" && (
        <div className="rounded-2xl bg-gradient-to-r from-emerald-600/20 to-emerald-500/10 border border-emerald-500/20 p-4">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs font-semibold text-emerald-300">Total pagado</span>
            <span className="text-sm font-bold text-emerald-300">${ventasSummary.paid.toFixed(2)}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-white/60">Balance</span>
            <span className={cn("text-sm font-bold", ventasSummary.balance > 0 ? "text-red-400" : "text-emerald-400")}>
              ${ventasSummary.balance.toFixed(2)}
            </span>
          </div>
        </div>
      )}

      {/* Note composer (only on notas tab) */}
      {activeSubTab === "notas" && (
        <div className="flex gap-2">
          <input
            value={comment}
            onChange={e => setComment(e.target.value)}
            placeholder="Escribe una nota..."
            className="flex-1 bg-white/[0.05] border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white placeholder:text-white/30 outline-none focus:border-cyan-500/50"
            onKeyDown={e => { if (e.key === "Enter") postComment(); }}
          />
          <button
            onClick={postComment}
            disabled={posting || !comment.trim()}
            className="px-4 py-2.5 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white font-bold transition-all active:scale-95 disabled:opacity-30"
          >
            {posting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
          </button>
        </div>
      )}

      {/* Timeline */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin w-6 h-6 border-2 border-cyan-500 border-t-transparent rounded-full" />
        </div>
      ) : (
        <MobileVisualTimeline
          events={filteredEvents}
          emptyMessage={emptyMessages[activeSubTab]}
        />
      )}
    </div>
  );
}
