// QuickOrderDialog.jsx — Orden Especial: 1 pieza para 1 boleto

import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { toast } from "sonner";
import { Package, ClipboardList, X, ChevronRight, Zap } from "lucide-react";

const money = (n) => `$${Number(n || 0).toFixed(2)}`;

export default function QuickOrderDialog({ open, onClose, workOrders = [], suppliers = [] }) {
  const [step, setStep] = useState(1);
  const [partName, setPartName] = useState("");
  const [partCost, setPartCost] = useState("");
  const [supplierName, setSupplierName] = useState("");
  const [selectedWorkOrderId, setSelectedWorkOrderId] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  const reset = () => {
    setStep(1); setPartName(""); setPartCost(""); setSupplierName("");
    setSelectedWorkOrderId(""); setNotes("");
  };

  const handleClose = () => { reset(); onClose(); };

  const handleSave = async () => {
    if (!partName.trim()) { toast.error("Escribe el nombre de la pieza"); return; }
    setSaving(true);
    try {
      const poNumber = `QO-${new Date().toLocaleDateString("en-US", { month: "2-digit", day: "2-digit", year: "2-digit" }).replace(/\//g, "")}-${Math.floor(Math.random() * 900 + 100)}`;
      const selectedWO = workOrders.find(w => w.id === selectedWorkOrderId);
      const payload = {
        po_number: poNumber,
        supplier_name: supplierName || "Por definir",
        order_type: "special",
        status: "ordered",
        order_date: new Date().toISOString().split("T")[0],
        notes: notes || "",
        items: [{
          product_name: partName,
          quantity: 1,
          unit_cost: Number(partCost || 0),
          work_order_id: selectedWorkOrderId || null,
          work_order_number: selectedWO?.order_number || selectedWO?.id || null
        }],
        total_amount: Number(partCost || 0),
        linked_work_order_id: selectedWorkOrderId || null,
        linked_work_order_number: selectedWO?.order_number || null
      };
      await base44.entities.PurchaseOrder.create(payload);
      toast.success("✅ Orden especial creada");
      handleClose();
      onClose(true);
    } catch (err) {
      console.error(err);
      toast.error("No se pudo crear la orden especial");
    } finally {
      setSaving(false);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[9999] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-zinc-950 border border-white/[0.08] rounded-3xl max-w-md w-full shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-violet-500/15 to-purple-500/15 border-b border-white/[0.06] p-5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-violet-500/20 border border-violet-500/30 flex items-center justify-center">
              <Zap className="w-5 h-5 text-violet-400" />
            </div>
            <div>
              <p className="text-white font-black text-lg">Orden Especial</p>
              <p className="text-white/40 text-xs">Pieza específica para un boleto</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className={`w-2 h-2 rounded-full ${step === 1 ? 'bg-violet-400' : 'bg-white/20'}`} />
            <span className={`w-2 h-2 rounded-full ${step === 2 ? 'bg-violet-400' : 'bg-white/20'}`} />
            <button onClick={handleClose} className="ml-2 w-8 h-8 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 flex items-center justify-center text-white/50 hover:text-white transition-all">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Step 1 — La pieza */}
        {step === 1 && (
          <div className="p-5 space-y-4">
            <div>
              <label className="text-[10px] font-black text-white/30 uppercase tracking-widest block mb-1.5">¿Qué pieza necesitas? *</label>
              <input
                type="text"
                value={partName}
                onChange={e => setPartName(e.target.value)}
                placeholder="Ej: Pantalla iPhone XR LCD"
                className="w-full bg-[#111114]/60 border border-white/[0.08] rounded-xl px-4 py-3 text-white text-sm placeholder:text-white/50 focus:outline-none focus:border-violet-500/50 focus:ring-2 focus:ring-violet-500/15"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[10px] font-black text-white/30 uppercase tracking-widest block mb-1.5">Costo estimado</label>
                <input
                  type="number"
                  value={partCost}
                  onChange={e => setPartCost(e.target.value)}
                  placeholder="0.00"
                  className="w-full bg-[#111114]/60 border border-white/[0.08] rounded-xl px-4 py-3 text-white text-sm placeholder:text-white/50 focus:outline-none focus:border-violet-500/50"
                />
              </div>
              <div>
                <label className="text-[10px] font-black text-white/30 uppercase tracking-widest block mb-1.5">Suplidor</label>
                <input
                  type="text"
                  value={supplierName}
                  onChange={e => setSupplierName(e.target.value)}
                  placeholder="MobilSentrix..."
                  className="w-full bg-[#111114]/60 border border-white/[0.08] rounded-xl px-4 py-3 text-white text-sm placeholder:text-white/50 focus:outline-none focus:border-violet-500/50"
                />
              </div>
            </div>
            <div>
              <label className="text-[10px] font-black text-white/30 uppercase tracking-widest block mb-1.5">Notas</label>
              <textarea
                value={notes}
                onChange={e => setNotes(e.target.value)}
                placeholder="Detalles adicionales..."
                rows={2}
                className="w-full bg-[#111114]/60 border border-white/[0.08] rounded-xl px-4 py-3 text-white text-sm placeholder:text-white/50 focus:outline-none focus:border-violet-500/50 resize-none"
              />
            </div>
            <button
              onClick={() => { if (!partName.trim()) { toast.error("Escribe la pieza"); return; } setStep(2); }}
              className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-violet-500 to-purple-600 text-white font-black text-sm hover:opacity-90 transition-all active:scale-95 flex items-center justify-center gap-2"
            >
              Siguiente <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Step 2 — El boleto */}
        {step === 2 && (
          <div className="p-5 space-y-4">
            <div>
              <label className="text-[10px] font-black text-white/30 uppercase tracking-widest block mb-2">¿Para cuál boleto? (opcional)</label>
              <div className="space-y-2 max-h-56 overflow-y-auto">
                <button
                  onClick={() => setSelectedWorkOrderId("")}
                  className={`w-full flex items-center gap-3 p-3.5 rounded-2xl border text-left transition-all ${!selectedWorkOrderId ? 'border-violet-500/40 bg-violet-500/10' : 'border-white/[0.07] bg-[#111114]/60 hover:bg-white/5'}`}
                >
                  <X className="w-4 h-4 text-white/30" />
                  <span className="text-white/50 text-sm font-bold">Sin boleto asignado</span>
                </button>
                {workOrders.slice(0, 20).map(wo => (
                  <button
                    key={wo.id}
                    onClick={() => setSelectedWorkOrderId(wo.id)}
                    className={`w-full flex items-center gap-3 p-3.5 rounded-2xl border text-left transition-all ${selectedWorkOrderId === wo.id ? 'border-violet-500/40 bg-violet-500/10' : 'border-white/[0.07] bg-[#111114]/60 hover:bg-white/5'}`}
                  >
                    <ClipboardList className="w-4 h-4 text-violet-400 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-white font-bold text-sm truncate">{wo.order_number || wo.id?.slice(-6)}</p>
                      <p className="text-white/30 text-xs truncate">{wo.customer_name || "Sin cliente"} · {wo.device_model || wo.device_type || ""}</p>
                    </div>
                    {selectedWorkOrderId === wo.id && <div className="w-2 h-2 rounded-full bg-violet-400 shrink-0" />}
                  </button>
                ))}
              </div>
            </div>

            {/* Summary */}
            <div className="bg-[#111114]/60 border border-white/[0.07] rounded-2xl p-4 space-y-1.5">
              <div className="flex justify-between text-xs">
                <span className="text-white/30 font-bold">Pieza</span>
                <span className="text-white font-bold truncate max-w-[200px]">{partName}</span>
              </div>
              {partCost && (
                <div className="flex justify-between text-xs">
                  <span className="text-white/30 font-bold">Costo</span>
                  <span className="text-emerald-400 font-bold">{money(partCost)}</span>
                </div>
              )}
              {supplierName && (
                <div className="flex justify-between text-xs">
                  <span className="text-white/30 font-bold">Suplidor</span>
                  <span className="text-white font-bold">{supplierName}</span>
                </div>
              )}
            </div>

            <div className="flex gap-3">
              <button onClick={() => setStep(1)} className="flex-1 py-3 rounded-2xl bg-white/5 border border-white/10 text-white/50 text-sm font-bold hover:bg-white/10 transition-all">
                Atrás
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="flex-1 py-3 rounded-2xl bg-gradient-to-r from-violet-500 to-purple-600 text-white text-sm font-black hover:opacity-90 transition-all disabled:opacity-50"
              >
                {saving ? "Guardando..." : "Crear Orden"}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
