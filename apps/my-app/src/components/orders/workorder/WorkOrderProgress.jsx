import React, { useMemo, useState } from "react";
import { base44 } from "@/api/base44Client";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/components/utils/helpers";

import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";

import {
  Clock, Brain, Package, Wrench, Store, Check, PartyPopper, XCircle, Truck, FileText, DollarSign, Building2
} from "lucide-react";

/* === Estados solicitados ===
   Recepción (intake)
   Diagnóstico (diagnosing)
   Esperando para ordenar (awaiting_approval)
   Esperando pieza (waiting_parts) -> proveedor, tracking, pieza, fecha orden
   Reparación externa (reparacion_externa) -> nota
   En reparación (in_progress)
   Listo para recoger (ready_for_pickup)
   Completado (completed) -> salta a POS
   Cancelado (cancelled) -> motivo
*/
const STATUS = {
  intake:             { label: "Recepción",              icon: Clock,       progress: 10,  color: "bg-gray-600/20 text-gray-200 border-gray-600/40" },
  diagnosing:         { label: "Diagnóstico",            icon: Brain,       progress: 30,  color: "bg-purple-600/20 text-purple-200 border-purple-600/40" },
  awaiting_approval:  { label: "Esperando para ordenar", icon: Store,       progress: 40,  color: "bg-amber-600/20 text-amber-200 border-amber-600/40" },
  waiting_parts:      { label: "Esperando pieza",        icon: Package,     progress: 55,  color: "bg-orange-600/20 text-orange-200 border-orange-600/40" },
  reparacion_externa: { label: "Reparación externa",     icon: Building2,   progress: 65,  color: "bg-indigo-600/20 text-indigo-200 border-indigo-600/40" },
  in_progress:        { label: "En reparación",          icon: Wrench,      progress: 75,  color: "bg-blue-600/20 text-blue-200 border-blue-600/40" },
  ready_for_pickup:   { label: "Listo para recoger",     icon: Check,       progress: 90,  color: "bg-emerald-600/20 text-emerald-200 border-emerald-600/40" },
  completed:          { label: "Completado",             icon: PartyPopper, progress: 100, color: "bg-gray-600/20 text-gray-300 border-gray-600/40" },
  cancelled:          { label: "Cancelado",              icon: XCircle,     progress: 0,   color: "bg-red-600/20 text-red-200 border-red-600/40" },
};
const STATUS_LIST = Object.keys(STATUS);

export default function WorkOrderProgress({ order, onUpdate, user }) {
  const nav = useNavigate();
  const st = STATUS[order?.status] || STATUS.intake;
  const Icon = st.icon || Clock;

  const [busy, setBusy] = useState(false);

  // Modal de datos extra
  const [modalOpen, setModalOpen] = useState(false);
  const [pendingStatus, setPendingStatus] = useState(null);

  // Formularios
  const [waiting, setWaiting] = useState({
    supplier: order?.status_metadata?.supplier || "",
    tracking_number: order?.status_metadata?.tracking_number || "",
    part_name: order?.status_metadata?.part_name || "",
    ordered_at: order?.status_metadata?.ordered_at || new Date().toISOString().slice(0,10),
  });
  const [extNote, setExtNote] = useState(order?.status_metadata?.external_shop_note || "");
  const [cancelNote, setCancelNote] = useState(order?.status_metadata?.cancellation_reason || order?.status_note || "");

  const progress = useMemo(() => st.progress, [st.progress]);

  const updateStatus = async (newStatus, metadataPatch = {}, note = "") => {
    if (!order?.id) return;
    setBusy(true);
    try {
      const status_metadata = { ...(order?.status_metadata || {}), ...metadataPatch };

      await base44.entities.Order.update(order.id, {
        status: newStatus,
        status_metadata,
        status_note: note || undefined,
      });

      await base44.entities.WorkOrderEvent.create({
        order_id: order.id,
        order_number: order.order_number,
        event_type: "status_change",
        description: `Estado: ${STATUS[newStatus]?.label || newStatus}${note ? ` — ${note}` : ""}`,
        user_id: user?.id,
        user_name: user?.full_name || user?.email || "Sistema",
        metadata: { status: newStatus, status_metadata }
      });

      if (newStatus === "completed") {
        nav(createPageUrl(`POS?workOrderId=${order.id}`), { state: { fromDashboard: true } });
      }

      onUpdate?.({});
    } catch (e) {
      console.error("Error actualizando estado", e);
      alert("No se pudo actualizar el estado.");
    } finally {
      setBusy(false);
    }
  };

  const handleStatusChange = (val) => {
    if (val === "waiting_parts" || val === "reparacion_externa" || val === "cancelled") {
      setPendingStatus(val);
      setModalOpen(true);
      return;
    }
    if (val === "completed") {
      updateStatus("completed");
      return;
    }
    updateStatus(val);
  };

  const submitModal = async () => {
    if (pendingStatus === "waiting_parts") {
      const meta = {
        supplier: waiting.supplier || "",
        tracking_number: waiting.tracking_number || "",
        part_name: waiting.part_name || "",
        ordered_at: waiting.ordered_at || new Date().toISOString().slice(0,10),
      };
      await updateStatus("waiting_parts", meta);
    } else if (pendingStatus === "reparacion_externa") {
      await updateStatus("reparacion_externa", { external_shop_note: extNote || "" }, extNote || "");
    } else if (pendingStatus === "cancelled") {
      await updateStatus("cancelled", { cancellation_reason: cancelNote || "" }, cancelNote || "");
    }
    setModalOpen(false);
    setPendingStatus(null);
  };

  const closeModal = () => {
    setModalOpen(false);
    setPendingStatus(null);
  };

  return (
    <div className="w-full">
      {/* Estado actual + selector (footer queda compacto y sin solaparse) */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex-1 min-w-0">
          <Badge className={`${st.color} mb-1.5`}>
            <Icon className="w-3.5 h-3.5 mr-1.5" />
            {st.label}
          </Badge>
          <Progress value={progress} className="h-2" />
        </div>

        <div className="w-[260px] shrink-0">
          <Select value={order?.status} onValueChange={handleStatusChange} disabled={busy}>
            <SelectTrigger className="bg-gray-900 border-gray-700 text-white h-9">
              <SelectValue placeholder="Cambiar estado…" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="intake">Recepción</SelectItem>
              <SelectItem value="diagnosing">Diagnóstico</SelectItem>
              <SelectItem value="awaiting_approval">Esperando para ordenar</SelectItem>
              <SelectItem value="waiting_parts">Esperando pieza</SelectItem>
              <SelectItem value="reparacion_externa">Reparación externa</SelectItem>
              <SelectItem value="in_progress">En reparación</SelectItem>
              <SelectItem value="ready_for_pickup">Listo para recoger</SelectItem>
              <SelectItem value="completed">Completado (ir a POS)</SelectItem>
              <SelectItem value="cancelled">Cancelado</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Acciones rápidas */}
      <div className="mt-2 hidden sm:flex items-center gap-2">
        <Button
          variant="outline"
          className="h-8 border-white/15"
          onClick={()=>updateStatus("ready_for_pickup")}
          disabled={busy || order?.status === "ready_for_pickup"}
          title="Marcar listo para recoger"
        >
          <Check className="w-4 h-4 mr-2" /> Listo para recoger
        </Button>

        <Button
          className="h-8 bg-green-600 hover:bg-green-700"
          onClick={()=>updateStatus("completed")}
          disabled={busy}
          title="Completar e ir al POS"
        >
          <DollarSign className="w-4 h-4 mr-2" /> Completar & POS
        </Button>
      </div>

      {/* ===== Modal de datos extra (evita solaparse con el footer) ===== */}
      <Dialog open={modalOpen} onOpenChange={(o)=>{ if(!o) closeModal(); }}>
        <DialogContent className="max-w-2xl bg-[#0D0D0D] text-white border border-white/10">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {pendingStatus === "waiting_parts" && (<><Package className="w-5 h-5" /> Datos de “Esperando pieza”</>)}
              {pendingStatus === "reparacion_externa" && (<><Building2 className="w-5 h-5" /> Datos de “Reparación externa”</>)}
              {pendingStatus === "cancelled" && (<><XCircle className="w-5 h-5" /> Motivo de “Cancelado”</>)}
            </DialogTitle>
          </DialogHeader>

          {/* Contenido por estado */}
          {pendingStatus === "waiting_parts" && (
            <div className="grid grid-cols-1 md:grid-cols-4 gap-3 mt-2">
              <div>
                <label className="text-xs text-gray-400">Proveedor</label>
                <Input
                  className="h-9 bg-black/40 border-white/10"
                  value={waiting.supplier}
                  onChange={(e)=>setWaiting(v=>({...v, supplier:e.target.value}))}
                  placeholder="Ej. Injured Gadgets"
                />
              </div>
              <div>
                <label className="text-xs text-gray-400">Tracking</label>
                <Input
                  className="h-9 bg-black/40 border-white/10"
                  value={waiting.tracking_number}
                  onChange={(e)=>setWaiting(v=>({...v, tracking_number:e.target.value}))}
                  placeholder="1Z..."
                />
              </div>
              <div>
                <label className="text-xs text-gray-400">Pieza</label>
                <Input
                  className="h-9 bg-black/40 border-white/10"
                  value={waiting.part_name}
                  onChange={(e)=>setWaiting(v=>({...v, part_name:e.target.value}))}
                  placeholder="Pantalla iPhone 13"
                />
              </div>
              <div>
                <label className="text-xs text-gray-400">Fecha de orden</label>
                <Input
                  type="date"
                  className="h-9 bg-black/40 border-white/10"
                  value={waiting.ordered_at}
                  onChange={(e)=>setWaiting(v=>({...v, ordered_at:e.target.value}))}
                />
              </div>
            </div>
          )}

          {pendingStatus === "reparacion_externa" && (
            <div className="mt-2">
              <label className="text-xs text-gray-400">Nota (p. ej. “taller de soldadura”)</label>
              <Textarea
                rows={3}
                className="bg-black/40 border-white/10"
                placeholder="Ej. enviado a taller de soldadura para microjumpers en PMIC."
                value={extNote}
                onChange={(e)=>setExtNote(e.target.value)}
              />
            </div>
          )}

          {pendingStatus === "cancelled" && (
            <div className="mt-2">
              <label className="text-xs text-gray-400">Motivo</label>
              <Textarea
                rows={2}
                className="bg-black/40 border-white/10"
                placeholder="Cliente canceló / equipo irrecuperable / otros."
                value={cancelNote}
                onChange={(e)=>setCancelNote(e.target.value)}
              />
            </div>
          )}

          <DialogFooter className="mt-4">
            <Button variant="outline" className="h-9 border-white/15" onClick={closeModal}>Cancelar</Button>
            <Button className="h-9 bg-white/10 hover:bg-white/20" disabled={busy} onClick={submitModal}>
              {pendingStatus === "waiting_parts" && (<><Truck className="w-4 h-4 mr-2" /> Guardar “Esperando pieza”</>)}
              {pendingStatus === "reparacion_externa" && (<><FileText className="w-4 h-4 mr-2" /> Guardar “Reparación externa”</>)}
              {pendingStatus === "cancelled" && (<><XCircle className="w-4 h-4 mr-2" /> Guardar “Cancelado”</>)}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
