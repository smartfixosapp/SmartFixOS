import React, { useMemo, useState } from "react";
import { base44 } from "@/api/base44Client";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/components/utils/helpers";
import { navigateToPOS } from "../../utils/posNavigation";
import { motion, AnimatePresence } from "framer-motion";

import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";

import {
  Clock, Brain, Package, Wrench, Store, Check, CheckCircle2, PartyPopper, XCircle, Truck, FileText, DollarSign, Building2,
  ArrowRight, ChevronRight, Shield
} from "lucide-react";
import WarrantyReasonDialog from "../WarrantyReasonDialog";

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
  warranty:           { label: "Garantía",               icon: Shield,      progress: 85,  color: "bg-amber-600/20 text-amber-200 border-amber-600/40" },
  completed:          { label: "Completado",             icon: PartyPopper, progress: 100, color: "bg-gray-600/20 text-gray-300 border-gray-600/40" },
  cancelled:          { label: "Cancelado",              icon: XCircle,     progress: 0,   color: "bg-red-600/20 text-red-200 border-red-600/40" },
};
const STATUS_LIST = Object.keys(STATUS);

export default function WorkOrderProgress({ order, onUpdate, user, changeStatus }) {
  const nav = useNavigate();
  const displayStatus = optimisticStatus || order?.status;
  const st = STATUS[displayStatus] || STATUS.intake;
  const Icon = st.icon || Clock;

  const [busy, setBusy] = useState(false);
  const [optimisticStatus, setOptimisticStatus] = useState(null);

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
  const [warrantyReason, setWarrantyReason] = useState(order?.warranty_mode?.warranty_reason || "");
  const [showWarrantyDialog, setShowWarrantyDialog] = useState(false);

  const progress = useMemo(() => st.progress, [st.progress]);

  // Logic for Suggested Next Step
  const nextStep = useMemo(() => {
    switch (order?.status) {
        case 'intake': return 'diagnosing';
        case 'diagnosing': return 'awaiting_approval'; // or in_progress depending on flow
        case 'awaiting_approval': return 'waiting_parts';
        case 'waiting_parts': return 'part_arrived_waiting_device';
        case 'part_arrived_waiting_device': return 'in_progress';
        case 'reparacion_externa': return 'in_progress';
        case 'in_progress': return 'ready_for_pickup';
        case 'ready_for_pickup': return 'completed';
        default: return null;
    }
  }, [order?.status]);

  const updateStatus = async (newStatus, metadataPatch = {}, note = "") => {
    if (!order?.id) return;
    
    // Optimistic update - show immediately
    setOptimisticStatus(newStatus);
    setBusy(true);
    
    try {
      if (typeof changeStatus === "function") {
        await changeStatus(newStatus, note, metadataPatch, true);
      } else {
        // Fallback si no se pasa la función (no recomendado pero evita romper)
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
      }

    if (newStatus === "completed") {
      navigateToPOS(order, nav, { fromDashboard: true, openPaymentImmediately: true });
    }

      onUpdate?.({});
      setOptimisticStatus(null); // Clear optimistic state after success
    } catch (e) {
      console.error("Error actualizando estado", e);
      setOptimisticStatus(null); // Revert on error
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
    if (val === "warranty") {
      setShowWarrantyDialog(true);
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

  const handleWarrantyConfirm = async (reason) => {
    const warrantyData = {
      is_warranty_claim: true,
      warranty_entry_date: new Date().toISOString(),
      warranty_reason: reason
    };
    
    await base44.entities.Order.update(order.id, {
      status: "warranty",
      warranty_mode: warrantyData,
      passed_warranty: true
    });

    await base44.entities.WorkOrderEvent.create({
      order_id: order.id,
      order_number: order.order_number,
      event_type: "warranty_claim",
      description: `Equipo ingresó por garantía: ${reason}`,
      user_id: user?.id,
      user_name: user?.full_name || user?.email || "Sistema",
      metadata: { warranty_reason: reason }
    });

    onUpdate?.({});
    setShowWarrantyDialog(false);
  };

  const closeModal = () => {
    setModalOpen(false);
    setPendingStatus(null);
  };

  return (
    <div className="w-full bg-white/5 border border-white/10 rounded-[24px] p-6 backdrop-blur-xl shadow-lg">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-2 h-2 rounded-full bg-blue-500 shadow-[0_0_10px_rgba(59,130,246,0.5)]" />
        <h3 className="text-lg font-bold text-white tracking-tight">Estado de la Orden</h3>
      </div>

      {/* Estado Actual Card Animated */}
      <motion.div 
        layout
        className="relative overflow-hidden bg-black/40 border border-white/10 rounded-[24px] p-6 mb-6 group transition-all duration-300 hover:border-white/20"
      >
        <div className="absolute inset-0 bg-gradient-to-r from-blue-500/5 to-purple-500/5 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
        
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 relative z-10">
          <div>
            <p className="text-white/40 text-xs font-semibold uppercase tracking-wider mb-1">Estado Actual</p>
            <div className="flex items-center gap-3">
              <h2 className="text-3xl font-bold text-white tracking-tight">{st.label}</h2>
            </div>
          </div>
          <Badge className={`px-4 py-1.5 rounded-full text-sm font-medium ${st.color} border-0 shadow-lg backdrop-blur-md self-start sm:self-center`}>
            {order?.status}
          </Badge>
        </div>
        
        <motion.div 
            className="mt-6 h-2 bg-white/10 rounded-full overflow-hidden"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
        >
            <motion.div 
                className="h-full bg-gradient-to-r from-blue-500 to-purple-500 rounded-full"
                initial={{ width: 0 }}
                animate={{ width: `${progress}%` }}
                transition={{ type: "spring", stiffness: 50, damping: 15 }}
            />
        </motion.div>
      </motion.div>

      {/* Suggested Next Step */}
      <AnimatePresence mode="wait">
        {nextStep && (
            <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="mb-6"
            >
                <button
                    onClick={() => handleStatusChange(nextStep)}
                    disabled={busy}
                    className="w-full relative overflow-hidden group bg-gradient-to-r from-blue-600/20 to-purple-600/20 hover:from-blue-600/30 hover:to-purple-600/30 border border-blue-500/30 rounded-[20px] p-1 pr-4 flex items-center transition-all duration-300"
                >
                    <div className="p-3 bg-blue-500 rounded-2xl shadow-lg shadow-blue-900/50 mr-4 group-hover:scale-105 transition-transform">
                        <ArrowRight className="w-6 h-6 text-white" />
                    </div>
                    <div className="text-left flex-1 py-3">
                        <p className="text-blue-300 text-[10px] font-bold uppercase tracking-wider">Siguiente Paso Sugerido</p>
                        <p className="text-white font-bold text-lg">{STATUS[nextStep]?.label}</p>
                    </div>
                    <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all -translate-x-2 group-hover:translate-x-0">
                        <ChevronRight className="w-5 h-5 text-white" />
                    </div>
                </button>
            </motion.div>
        )}
      </AnimatePresence>

      {/* Grid de Estados */}
      <div className="space-y-3">
        <p className="text-white/40 text-xs font-semibold uppercase tracking-wider pl-1">Flujo de Trabajo</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {STATUS_LIST.map((key, index) => {
            const s = STATUS[key];
            const isActive = displayStatus === key;
            const SIcon = s.icon;
            
            if (key === "completed" || key === "cancelled") return null;

            return (
              <motion.button
                key={key}
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: index * 0.05 }}
                onClick={() => handleStatusChange(key)}
                disabled={busy}
                className={`
                  relative flex items-center gap-3 p-4 rounded-[16px] text-left transition-all duration-200
                  ${isActive 
                    ? "bg-white/10 border border-white/20 shadow-lg scale-[1.02]" 
                    : "bg-black/20 border border-white/5 hover:bg-white/5 hover:border-white/10 active:scale-95"
                  }
                `}
              >
                {isActive && (
                  <div className="absolute top-2 right-2">
                    <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }}>
                        <Check className="w-4 h-4 text-blue-400" />
                    </motion.div>
                  </div>
                )}
                <div className={`p-2 rounded-xl transition-colors ${isActive ? "bg-white/10 text-white" : "bg-black/20 text-white/40 group-hover:text-white/60"}`}>
                  <SIcon className="w-5 h-5" />
                </div>
                <div>
                  <p className={`text-sm font-semibold transition-colors ${isActive ? "text-white" : "text-white/60"}`}>{s.label}</p>
                  {isActive && <p className="text-[10px] text-blue-400">Estado actual</p>}
                </div>
              </motion.button>
            );
          })}
        </div>

        {/* Estados Finales */}
        <div className="pt-2">
          <p className="text-white/40 text-xs font-semibold uppercase tracking-wider pl-1 mb-3">Estados Finales</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <button
              onClick={() => handleStatusChange("completed")}
              disabled={busy}
              className="flex items-center gap-3 p-4 rounded-[16px] bg-black/20 border border-white/5 hover:bg-green-500/10 hover:border-green-500/30 transition-all group"
            >
              <div className="p-2 rounded-xl bg-black/20 text-green-500/60 group-hover:text-green-400 group-hover:bg-green-500/20 transition-colors">
                <DollarSign className="w-5 h-5" />
              </div>
              <span className="text-sm font-semibold text-white/60 group-hover:text-white">Entregado & Cobrar</span>
            </button>

            <button
              onClick={() => handleStatusChange("cancelled")}
              disabled={busy}
              className="flex items-center gap-3 p-4 rounded-[16px] bg-black/20 border border-white/5 hover:bg-red-500/10 hover:border-red-500/30 transition-all group"
            >
              <div className="p-2 rounded-xl bg-black/20 text-red-500/60 group-hover:text-red-400 group-hover:bg-red-500/20 transition-colors">
                <XCircle className="w-5 h-5" />
              </div>
              <span className="text-sm font-semibold text-white/60 group-hover:text-white">Cancelado</span>
            </button>
          </div>
        </div>
      </div>

      {/* ===== Modal de datos extra (evita solaparse con el footer) ===== */}
      <Dialog open={modalOpen} onOpenChange={(o)=>{ if(!o) closeModal(); }}>
        <DialogContent className="max-w-2xl bg-[#0D0D0D] text-white border border-white/10" hideCloseButton>
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

      {/* Modal de Garantía */}
      <WarrantyReasonDialog
        open={showWarrantyDialog}
        onClose={() => setShowWarrantyDialog(false)}
        onConfirm={handleWarrantyConfirm}
      />
    </div>
  );
}
