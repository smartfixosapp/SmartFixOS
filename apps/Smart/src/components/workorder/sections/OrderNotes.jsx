import React, { useState, useEffect } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { MessageSquare, Plus, Link as LinkIcon, Loader2, Activity } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { toast } from "sonner";
import { LinkifiedText } from "@/components/utils/linkify";
import { PlanGate, UpgradePrompt } from "@/components/plan/UpgradePrompt";

export default function OrderNotes({ order, onUpdate }) {
  const o = order || {};
  const [note, setNote] = useState("");
  const [linkPart, setLinkPart] = useState("");
  const [linkUrl, setLinkUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [events, setEvents] = useState([]);

  useEffect(() => {
    loadEvents();
  }, [o.id]);

  async function loadEvents() {
    if (!o.id) return;
    try {
      const data = await base44.entities.WorkOrderEvent.filter({ order_id: o.id }, "-created_date", 20);
      setEvents(data);
    } catch (e) {
      console.error(e);
    }
  }

  async function addNote() {
    if (!note.trim()) return;
    setLoading(true);
    try {
      const user = await base44.auth.me();
      await base44.entities.WorkOrderEvent.create({
        order_id: o.id,
        order_number: o.order_number,
        event_type: "note_added",
        description: note,
        user_name: user?.full_name || "Sistema",
        metadata: { internal: true }
      });
      setNote("");
      loadEvents();
      onUpdate?.();
      toast.success("Nota añadida");
    } catch (e) {
      toast.error("Error al añadir nota");
    } finally {
      setLoading(false);
    }
  }

  async function addLink() {
    if (!linkPart.trim() || !linkUrl.trim()) return;
    setLoading(true);
    try {
      const user = await base44.auth.me();
      const cleanPart = linkPart.trim();
      const cleanUrl = linkUrl.trim();

      const createdEvent = await base44.entities.WorkOrderEvent.create({
        order_id: o.id,
        order_number: o.order_number,
        event_type: "note_added",
        description: `🔗 Link para ${cleanPart}: ${cleanUrl}`,
        user_name: user?.full_name || "Sistema",
        metadata: {
          link: cleanUrl,
          part: cleanPart,
          partName: cleanPart,
          entry_kind: "link_added",
          is_link: true
        }
      });

      const freshOrder = await base44.entities.Order.get(o.id).catch(() => o);
      const prevMeta = freshOrder?.status_metadata && typeof freshOrder.status_metadata === "object"
        ? freshOrder.status_metadata
        : {};
      const prevRegistry = Array.isArray(prevMeta.links_registry) ? prevMeta.links_registry : [];
      const nextRegistry = [
        {
          id: createdEvent?.id || `note-link-${Date.now()}`,
          partName: cleanPart,
          link: cleanUrl,
          created_at: new Date().toISOString()
        },
        ...prevRegistry
      ];
      await base44.entities.Order.update(o.id, {
        status_metadata: {
          ...prevMeta,
          links_registry: nextRegistry
        }
      });

      setLinkPart("");
      setLinkUrl("");
      loadEvents();
      onUpdate?.();
      toast.success("Link añadido");
    } catch (e) {
      toast.error("Error al añadir link");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-4">
      {/* Input Section */}
      <Card className="bg-[#0F0F12] border-white/10">
        <CardHeader className="py-3 border-b border-white/10">
          <CardTitle className="text-white text-base flex items-center gap-2">
            <MessageSquare className="w-4 h-4 text-white" />
            Comentarios
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-4 space-y-4">
          <div className="space-y-2">
            <label className="text-xs text-gray-500 font-medium">AÑADIR COMENTARIO</label>
            <div className="flex gap-2">
              <Input 
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Escribe un comentario..."
                className="bg-black/40 border-white/10 text-white"
                onKeyDown={(e) => e.key === 'Enter' && addNote()}
              />
              <Button onClick={addNote} disabled={loading || !note.trim()} size="icon" className="bg-emerald-600 hover:bg-emerald-700 shrink-0">
                <Plus className="w-4 h-4" />
              </Button>
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-xs text-gray-500 font-medium">AÑADIR LINK DE PIEZA</label>
            <div className="space-y-2">
              <Input 
                value={linkPart}
                onChange={(e) => setLinkPart(e.target.value)}
                placeholder="Nombre de la pieza *"
                className="bg-black/40 border-white/10 text-white"
              />
              <div className="flex gap-2">
                <Input 
                  value={linkUrl}
                  onChange={(e) => setLinkUrl(e.target.value)}
                  placeholder="https://proveedor.com/producto..."
                  className="bg-black/40 border-white/10 text-white"
                />
                <Button onClick={addLink} disabled={loading || !linkPart.trim() || !linkUrl.trim()} size="icon" className="bg-blue-600 hover:bg-blue-700 shrink-0">
                  <LinkIcon className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </div>

          {/* Comentarios */}
          {events.filter(e => e.event_type !== 'status_change').length > 0 && (
            <div className="space-y-2 mt-4 pt-4 border-t border-white/10">
              <label className="text-xs text-gray-500 font-medium">COMENTARIOS REGISTRADOS</label>
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {events.filter(e => e.event_type !== 'status_change').map((event) => (
                  <div key={event.id} className="p-3 rounded-lg border border-blue-500/30 bg-blue-900/10 text-blue-200 text-sm">
                    <div className="flex justify-between items-start gap-2">
                      <div className="flex-1">
                        <p className="font-medium">{event.user_name}</p>
                        <p className="text-xs opacity-70 mt-0.5">{new Date(event.created_date).toLocaleString('es-PR')}</p>
                      </div>
                    </div>
                    <p className="mt-2">{event.description}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
