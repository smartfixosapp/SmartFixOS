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
    <div className="apple-type fixed inset-0 z-[9999] bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="apple-surface-elevated rounded-apple-lg shadow-apple-xl border-0 p-0 overflow-hidden max-w-md w-full">
        {/* Header */}
        <div className="bg-apple-purple/12 p-5 flex items-center justify-between" style={{ borderBottom: "0.5px solid rgb(var(--separator) / 0.29)" }}>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-apple-sm bg-apple-purple/15 flex items-center justify-center">
              <Zap className="w-5 h-5 text-apple-purple" />
            </div>
            <div>
              <p className="apple-label-primary apple-text-headline">Orden Especial</p>
              <p className="apple-label-secondary apple-text-caption1">Pieza específica para un boleto</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className={`w-2 h-2 rounded-full ${step === 1 ? 'bg-apple-purple' : 'bg-gray-sys5'}`} />
            <span className={`w-2 h-2 rounded-full ${step === 2 ? 'bg-apple-purple' : 'bg-gray-sys5'}`} />
            <button onClick={handleClose} className="apple-press ml-2 w-8 h-8 rounded-apple-sm bg-gray-sys6 dark:bg-gray-sys5 flex items-center justify-center apple-label-secondary transition-all">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Step 1 — La pieza */}
        {step === 1 && (
          <div className="p-5 space-y-4">
            <div>
              <label className="apple-text-caption1 font-semibold apple-label-secondary block mb-1.5">¿Qué pieza necesitas? *</label>
              <input
                type="text"
                value={partName}
                onChange={e => setPartName(e.target.value)}
                placeholder="Ej: Pantalla iPhone XR LCD"
                className="apple-input w-full px-4 py-3 apple-text-subheadline"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="apple-text-caption1 font-semibold apple-label-secondary block mb-1.5">Costo estimado</label>
                <input
                  type="number"
                  value={partCost}
                  onChange={e => setPartCost(e.target.value)}
                  placeholder="0.00"
                  className="apple-input w-full px-4 py-3 apple-text-subheadline tabular-nums"
                />
              </div>
              <div>
                <label className="apple-text-caption1 font-semibold apple-label-secondary block mb-1.5">Suplidor</label>
                <input
                  type="text"
                  value={supplierName}
                  onChange={e => setSupplierName(e.target.value)}
                  placeholder="MobilSentrix..."
                  className="apple-input w-full px-4 py-3 apple-text-subheadline"
                />
              </div>
            </div>
            <div>
              <label className="apple-text-caption1 font-semibold apple-label-secondary block mb-1.5">Notas</label>
              <textarea
                value={notes}
                onChange={e => setNotes(e.target.value)}
                placeholder="Detalles adicionales..."
                rows={2}
                className="apple-input w-full px-4 py-3 apple-text-subheadline resize-none"
              />
            </div>
            <button
              onClick={() => { if (!partName.trim()) { toast.error("Escribe la pieza"); return; } setStep(2); }}
              className="apple-btn apple-btn-primary bg-apple-purple w-full"
            >
              Siguiente <ChevronRight className="w-4 h-4 ml-2" />
            </button>
          </div>
        )}

        {/* Step 2 — El boleto */}
        {step === 2 && (
          <div className="p-5 space-y-4">
            <div>
              <label className="apple-text-caption1 font-semibold apple-label-secondary block mb-2">¿Para cuál boleto? (opcional)</label>
              <div className="space-y-2 max-h-56 overflow-y-auto">
                <button
                  onClick={() => setSelectedWorkOrderId("")}
                  className={`apple-press apple-list-row w-full flex items-center gap-3 p-3.5 rounded-apple-md text-left transition-all ${!selectedWorkOrderId ? 'bg-apple-purple/12 ring-2 ring-apple-purple/40' : 'apple-card'}`}
                >
                  <X className="w-4 h-4 apple-label-tertiary" />
                  <span className="apple-label-secondary apple-text-subheadline font-semibold">Sin boleto asignado</span>
                </button>
                {workOrders.slice(0, 20).map(wo => (
                  <button
                    key={wo.id}
                    onClick={() => setSelectedWorkOrderId(wo.id)}
                    className={`apple-press apple-list-row w-full flex items-center gap-3 p-3.5 rounded-apple-md text-left transition-all ${selectedWorkOrderId === wo.id ? 'bg-apple-purple/12 ring-2 ring-apple-purple/40' : 'apple-card'}`}
                  >
                    <ClipboardList className="w-4 h-4 text-apple-purple shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="apple-label-primary apple-text-subheadline font-semibold truncate">{wo.order_number || wo.id?.slice(-6)}</p>
                      <p className="apple-label-tertiary apple-text-caption1 truncate">{wo.customer_name || "Sin cliente"} · {wo.device_model || wo.device_type || ""}</p>
                    </div>
                    {selectedWorkOrderId === wo.id && <div className="w-2 h-2 rounded-full bg-apple-purple shrink-0" />}
                  </button>
                ))}
              </div>
            </div>

            {/* Summary */}
            <div className="apple-card p-4 space-y-1.5">
              <div className="flex justify-between apple-text-caption1">
                <span className="apple-label-tertiary font-semibold">Pieza</span>
                <span className="apple-label-primary font-semibold truncate max-w-[200px]">{partName}</span>
              </div>
              {partCost && (
                <div className="flex justify-between apple-text-caption1 tabular-nums">
                  <span className="apple-label-tertiary font-semibold">Costo</span>
                  <span className="text-apple-green font-semibold">{money(partCost)}</span>
                </div>
              )}
              {supplierName && (
                <div className="flex justify-between apple-text-caption1">
                  <span className="apple-label-tertiary font-semibold">Suplidor</span>
                  <span className="apple-label-primary font-semibold">{supplierName}</span>
                </div>
              )}
            </div>

            <div className="flex gap-3">
              <button onClick={() => setStep(1)} className="apple-btn apple-btn-secondary flex-1">
                Atrás
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="apple-btn apple-btn-primary bg-apple-purple flex-1"
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
