import React, { useState, useEffect, useCallback } from "react";
import { Send, Loader2 } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { toast } from "sonner";
import { dataClient } from "@/components/api/dataClient";
import MobileVisualTimeline from "./MobileVisualTimeline";
import { triggerHaptic } from "@/lib/capacitor";

export default function MobileHistorialTab({ order, onUpdate }) {
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

  return (
    <div className="space-y-4 pb-8">
      {/* Note composer */}
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

      {/* Unified Timeline */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin w-6 h-6 border-2 border-cyan-500 border-t-transparent rounded-full" />
        </div>
      ) : (
        <MobileVisualTimeline
          events={events}
          emptyMessage="Sin historial registrado"
        />
      )}
    </div>
  );
}
