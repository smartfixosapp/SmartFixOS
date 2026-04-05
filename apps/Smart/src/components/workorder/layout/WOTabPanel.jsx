import React, { useState, useMemo, useCallback } from "react";
import { Activity, Camera, LockKeyhole, Send, Loader2 } from "lucide-react";
import OrderSecurity from "@/components/workorder/sections/OrderSecurity";
import OrderMultimedia from "@/components/workorder/sections/OrderMultimedia";
import WorkOrderTimeline from "@/components/orders/workorder/WorkOrderTimeline";
import { usePlanLimits } from "@/hooks/usePlanLimits";
import { cn } from "@/lib/utils";
import { base44 } from "@/api/base44Client";
import { toast } from "sonner";

const TABS = [
  { id: "timeline", label: "Actividad", icon: Activity },
  { id: "photos", label: "Fotos", icon: Camera, feature: "orders_photos" },
  { id: "security", label: "Seguridad", icon: LockKeyhole },
];

export default function WOTabPanel({ order, onUpdate }) {
  const { can: canPlan } = usePlanLimits();
  const o = order || {};

  // Smart default tab: photos if has photos, otherwise timeline
  const hasPhotos = useMemo(() => {
    const count = (Array.isArray(o.photos_metadata) ? o.photos_metadata.length : 0) +
                  (Array.isArray(o.device_photos) ? o.device_photos.length : 0);
    return count > 0;
  }, [o.photos_metadata, o.device_photos]);

  const [activeTab, setActiveTab] = useState(hasPhotos && canPlan("orders_photos") ? "photos" : "timeline");

  // Quick comment
  const [comment, setComment] = useState("");
  const [posting, setPosting] = useState(false);

  const postComment = useCallback(async () => {
    if (!comment.trim() || !o.id) return;
    setPosting(true);
    try {
      let me = null;
      try { me = await base44.auth.me(); } catch {}
      const actorName = me?.full_name || me?.email || "Sistema";
      const actorId = me?.id || null;

      await base44.entities.WorkOrderEvent.create({
        order_id: o.id,
        order_number: o.order_number,
        event_type: "note",
        description: comment.trim(),
        user_name: actorName,
        user_id: actorId,
      });
      setComment("");
      onUpdate?.();
      toast.success("Nota agregada");
    } catch (e) {
      toast.error("Error al guardar nota");
    } finally {
      setPosting(false);
    }
  }, [comment, o.id, o.order_number, onUpdate]);

  const visibleTabs = TABS.filter(t => !t.feature || canPlan(t.feature));

  return (
    <div className="h-full flex flex-col">
      {/* ── Quick Comment Input (at top, always visible) ── */}
      <div className="border-b border-white/[0.08] pb-3 mb-3">
        <p className="text-[10px] font-bold uppercase tracking-widest text-white/30 mb-2">Nota rápida</p>
        <div className="flex gap-1.5">
          <textarea
            value={comment}
            onChange={e => setComment(e.target.value)}
            placeholder="Escribe un comentario..."
            rows={2}
            className="flex-1 bg-white/[0.05] border border-white/10 rounded-lg px-3 py-2 text-xs text-white placeholder:text-white/30 outline-none focus:border-cyan-500/50 resize-none"
            onKeyDown={e => {
              if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); postComment(); }
            }}
          />
          <button
            onClick={postComment}
            disabled={posting || !comment.trim()}
            className={cn(
              "self-end p-2 rounded-lg transition-all active:scale-95",
              comment.trim() ? "bg-cyan-600 hover:bg-cyan-500 text-white" : "bg-white/[0.05] text-white/20"
            )}
          >
            {posting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
          </button>
        </div>
        <p className="text-[9px] text-white/20 mt-1">Enter para enviar, Shift+Enter nueva línea</p>
      </div>

      {/* ── Tab bar ── */}
      <div className="flex border-b border-white/[0.08] mb-3">
        {visibleTabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={cn(
              "flex items-center gap-1.5 px-3 py-2.5 text-xs font-bold transition-all border-b-2 -mb-px",
              activeTab === tab.id
                ? "border-cyan-500 text-white"
                : "border-transparent text-white/40 hover:text-white/70"
            )}
          >
            <tab.icon className="w-3.5 h-3.5" />
            <span>{tab.label}</span>
          </button>
        ))}
      </div>

      {/* ── Tab content ── */}
      <div className="flex-1 overflow-y-auto">
        {activeTab === "timeline" && <WorkOrderTimeline order={order} onUpdate={onUpdate} />}
        {activeTab === "photos" && canPlan("orders_photos") && <OrderMultimedia order={order} onUpdate={onUpdate} />}
        {activeTab === "security" && <OrderSecurity order={order} onUpdate={onUpdate} />}
      </div>
    </div>
  );
}
