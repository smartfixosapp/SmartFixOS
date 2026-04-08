// === PurchaseOrderDetailDialog.jsx — Ver y editar orden de compra existente ===

import React, { useEffect, useState } from "react";
import { base44 } from "@/api/base44Client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter } from
"@/components/ui/dialog";
import { toast } from "sonner";
import {
  Calendar,
  FileText,
  PackageSearch,
  Truck,
  X,
  Save,
  Edit2 } from
"lucide-react";

const money = (n) => `$${Number(n || 0).toFixed(2)}`;

export default function PurchaseOrderDetailDialog({
  open,
  onClose,
  purchaseOrder,
  suppliers = [],
  products = [],
  workOrders = []
}) {
  const [editing, setEditing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [poData, setPoData] = useState(null);
  const [form, setForm] = useState({
    po_number: "",
    supplier_id: "",
    supplier_name: "",
    status: "draft",
    order_date: "",
    expected_date: "",
    notes: "",
    shipping_cost: 0,
    tracking_number: "",
    items: []
  });

  // Receive flow state
  const [showReceiveFlow, setShowReceiveFlow] = useState(false);
  const [receiveItems, setReceiveItems] = useState([]);
  const [receiving, setReceiving] = useState(false);
  // Return to supplier
  const [showReturnDialog, setShowReturnDialog] = useState(false);
  const [returnItems, setReturnItems] = useState({}); // {idx: qty}
  const [returnReason, setReturnReason] = useState("");
  const [processingReturn, setProcessingReturn] = useState(false);
  // Manual payment registration
  const [showPayDialog, setShowPayDialog] = useState(false);
  const [payMethod, setPayMethod] = useState("paypal");
  const [processingPay, setProcessingPay] = useState(false);

  useEffect(() => {
    if (!open || !purchaseOrder?.id) return;

    const loadPO = async () => {
      setLoading(true);
      try {
        const po = await base44.entities.PurchaseOrder.get(purchaseOrder.id);
        console.log("📦 PO cargada:", po);
        setPoData(po);

        // Cargar tracking_number del PO si existe
        const rawItems = po.items || po.line_items || [];
        const mappedItems = rawItems.map((it) => {
          const prodId = it.product_id || it.inventory_item_id;
          const prod = products.find((p) => p.id === prodId);
          const qty = Number(it.quantity || 1);
          const workOrderId = it.work_order_id || it.linked_work_order_id || "";
          return {
            id: it.id || `li-${Math.random().toString(36).slice(2, 9)}`,
            product_id: prodId,
            product_name: it.product_name || prod?.name || "",
            quantity: qty,
            // Recepción parcial: cuántas unidades llegaron físicamente
            received_quantity: it.received_quantity != null ? Number(it.received_quantity) : qty,
            unit_cost: Number(it.unit_cost || it.cost || prod?.cost || 0),
            unit_price: Number(it.unit_price || prod?.price || 0),
            work_order_id: workOrderId,
            // Guardamos el WO original para detectar cambios al guardar
            _original_work_order_id: workOrderId,
          };
        });

        setForm({
          po_number: po.po_number || "",
          supplier_id: po.supplier_id || "",
          supplier_name: po.supplier_name || "",
          status: po.status || "draft",
          order_date: po.order_date || "",
          expected_date: po.expected_date || "",
          notes: po.notes || "",
          shipping_cost: Number(po.shipping_cost || 0),
          tracking_number: po.tracking_number || "",
          items: mappedItems
        });
      } catch (err) {
        console.error("Error cargando PO:", err);
        toast.error("No se pudo cargar la orden");
      } finally {
        setLoading(false);
      }
    };

    loadPO();
  }, [open, purchaseOrder?.id, products]);

  // Helper: remueve items de una WO que vengan de una PO específica
  // (identificados por `po_number` o por `id` match exacto)
  const removeItemsFromWO = async (woId, predicate) => {
    try {
      const wo = await base44.entities.Order.get(woId);
      if (!wo) return false;
      const parts = Array.isArray(wo.parts_needed) ? wo.parts_needed : [];
      const orderItems = Array.isArray(wo.order_items) ? wo.order_items : [];
      const newParts = parts.filter((i) => !predicate(i));
      const newOrderItems = orderItems.filter((i) => !predicate(i));
      if (newParts.length === parts.length && newOrderItems.length === orderItems.length) {
        return false; // nothing to remove
      }
      await base44.entities.Order.update(woId, {
        parts_needed: newParts,
        order_items: newOrderItems,
      });
      console.log(`🗑 Removidos items de WO ${wo.order_number || woId}: parts_needed ${parts.length}→${newParts.length}, order_items ${orderItems.length}→${newOrderItems.length}`);
      return true;
    } catch (err) {
      console.warn(`No se pudo limpiar WO ${woId}:`, err);
      return false;
    }
  };

  // Helper: añadir un item a una WO (escribe a ambos campos)
  const addItemToWO = async (woId, item) => {
    try {
      const wo = await base44.entities.Order.get(woId);
      if (!wo) return false;
      const parts = Array.isArray(wo.parts_needed) ? wo.parts_needed : [];
      const orderItems = Array.isArray(wo.order_items) ? wo.order_items : [];
      await base44.entities.Order.update(woId, {
        parts_needed: [...parts, item],
        order_items: [...orderItems, item],
      });
      console.log(`➕ Añadido item a WO ${wo.order_number || woId}`);
      return true;
    } catch (err) {
      console.warn(`No se pudo añadir item a WO ${woId}:`, err);
      return false;
    }
  };

  // Build an item payload from a row + PO metadata
  const buildWOItem = (it) => {
    const sellPrice = Number(it.unit_price || 0) > 0
      ? Number(it.unit_price)
      : (Number(it.unit_cost || 0) > 0
          ? Math.round(Number(it.unit_cost) * 1.5 * 100) / 100
          : 0);
    return {
      id: `po-${purchaseOrder.id}-${it.id || Math.random().toString(36).slice(2, 9)}`,
      type: "product",
      name: it.product_name || "",
      quantity: Number(it.quantity || 0),
      price: sellPrice,
      cost: Number(it.unit_cost || 0),
      source: "purchase_order",
      supplier: form.supplier_name || "",
      po_number: form.po_number,
      po_id: purchaseOrder.id,
      product_id: it.product_id || null,
    };
  };

  const handleSave = async () => {
    try {
      // El schema de PurchaseOrder usa `line_items` (no `items`) y nombres
      // específicos para cada línea (`inventory_item_id`, `line_total`).
      const lineItems = form.items.map((it, i) => {
        const qty = Number(it.quantity || 1);
        const cost = Number(it.unit_cost || 0);
        const receivedQty = it.received_quantity != null ? Number(it.received_quantity) : qty;
        return {
          id: `li-${Date.now()}-${i}`,
          inventory_item_id: it.product_id || undefined,
          product_name: it.product_name || "",
          quantity: qty,
          received_quantity: receivedQty,
          unit_cost: cost,
          line_total: qty * cost,
          linked_work_order_id: it.work_order_id || undefined,
        };
      });

      const subtotal = lineItems.reduce((sum, it) => sum + (it.line_total || 0), 0);

      // Auto-detectar status partial si el usuario dice "recibida" pero algunas
      // líneas tienen received_quantity < quantity.
      let effectiveStatus = form.status;
      if (form.status === "received") {
        const hasAnyMissing = lineItems.some(
          (it) => Number(it.received_quantity || 0) < Number(it.quantity || 0),
        );
        const hasAnyReceived = lineItems.some(
          (it) => Number(it.received_quantity || 0) > 0,
        );
        if (hasAnyMissing && hasAnyReceived) effectiveStatus = "partial";
        else if (!hasAnyReceived) effectiveStatus = "ordered";
      }

      const payload = {
        po_number: form.po_number,
        supplier_id: form.supplier_id || "",
        supplier_name: form.supplier_name || "",
        status: effectiveStatus,
        order_date: form.order_date || null,
        expected_date: form.expected_date || null,
        notes: form.notes || "",
        shipping_cost: Number(form.shipping_cost || 0),
        tracking_number: form.tracking_number || "",
        line_items: lineItems,
        subtotal,
        total_amount: subtotal + Number(form.shipping_cost || 0),
      };

      const previousStatus = poData?.status;
      await base44.entities.PurchaseOrder.update(purchaseOrder.id, payload);

      // ── Sincronizar cambios de work_order_id por item ──────────────────
      // Para cada item, si cambió el work_order_id:
      //  - Remover de la WO anterior (si tenía una)
      //  - Añadir a la nueva WO (si tiene una)
      try {
        for (const it of form.items) {
          const originalWoId = it._original_work_order_id || "";
          const newWoId = it.work_order_id || "";
          if (originalWoId === newWoId) continue; // sin cambios

          if (originalWoId) {
            // Remover de la WO antigua los items de esta PO con el mismo nombre
            await removeItemsFromWO(originalWoId, (i) =>
              i.po_id === purchaseOrder.id && i.name === it.product_name,
            );
          }
          if (newWoId) {
            await addItemToWO(newWoId, buildWOItem(it));
          }
        }
      } catch (syncErr) {
        console.warn("Error sincronizando cambios de WO:", syncErr);
      }

      // ── AUTO-STOCK: al transicionar a "received" incrementar el inventario ────
      // Marcador [STOCKED] en notes para no duplicar si se re-guarda.
      const alreadyStocked = /\[STOCKED\]/.test(form.notes || "");
      if (form.status === "received" && previousStatus !== "received" && !alreadyStocked) {
        let stockedCount = 0;
        const performedBy = (() => {
          try { return JSON.parse(localStorage.getItem("employee_session") || "{}")?.name || "Sistema"; }
          catch { return "Sistema"; }
        })();
        for (const it of lineItems) {
          const pid = it.inventory_item_id;
          const qty = Number(it.quantity || 0);
          // received_quantity es opcional (recepción parcial): si está seteado, usarlo
          const receivedQty = it.received_quantity != null ? Number(it.received_quantity) : qty;
          if (!pid || receivedQty <= 0) continue;
          try {
            const product = await base44.entities.Product.get(pid);
            const prev = Number(product?.stock || 0);
            const next = prev + receivedQty;
            await base44.entities.Product.update(pid, { stock: next });
            await base44.entities.InventoryMovement.create({
              product_id: pid,
              product_name: product?.name || it.product_name || "",
              movement_type: "purchase",
              quantity: receivedQty,
              previous_stock: prev,
              new_stock: next,
              reference_type: "purchase",
              reference_id: purchaseOrder.id,
              reference_number: form.po_number || "",
              notes: `Recibido de OC ${form.po_number || ""}`,
              performed_by: performedBy,
            });
            stockedCount++;
          } catch (stockErr) {
            console.warn(`No se pudo actualizar stock de ${pid}:`, stockErr);
          }
        }
        if (stockedCount > 0) {
          // Añadir marcador [STOCKED] a las notes del PO para no duplicar
          try {
            const newNotes = (form.notes || "").trim() + (form.notes ? "\n" : "") + "[STOCKED]";
            await base44.entities.PurchaseOrder.update(purchaseOrder.id, { notes: newNotes });
          } catch { /* no-op */ }
          toast.success(`📦 Stock actualizado en ${stockedCount} producto${stockedCount === 1 ? "" : "s"}`);
        }
      }

      // ── AUTO-GASTO: cuando PO se marca como recibida ──────────────────────
      // Pero NO duplicar si ya se pagó al ordenar (marcador [PAID:method] en notes
      // que añade ImportPODialog cuando el usuario marca "Ya pagué").
      const alreadyPaid = /\[PAID:[^\]]+\]/.test(form.notes || "");
      if (form.status === "received" && previousStatus !== "received" && !alreadyPaid) {
        try {
          const totalAmount = Math.round(payload.total_amount * 100) / 100;
          const itemsDesc = form.items
            .map(it => `${it.product_name} x${it.quantity} @ $${Number(it.unit_cost).toFixed(2)}`)
            .join(", ");
          let tenantId = null;
          try { tenantId = localStorage.getItem("smartfix_tenant_id"); } catch { /* */ }
          const txPayload = {
            type: "expense",
            category: "parts",
            amount: totalAmount,
            // Sin campo `notes` — no existe en la tabla transaction
            description: `Orden de Compra ${form.po_number}${form.supplier_name ? ` — ${form.supplier_name}` : ""} · Recibida. ${itemsDesc}`.slice(0, 500),
            payment_method: "cash", // enum: cash/card/transfer/ath_movil
            order_number: form.po_number,
            ...(tenantId ? { tenant_id: tenantId } : {}),
          };
          console.log("📝 Creando Transaction al recibir:", txPayload);
          await base44.entities.Transaction.create(txPayload);
          toast.success(`✅ Orden recibida · Gasto de $${totalAmount.toFixed(2)} registrado en Finanzas`);
        } catch (expErr) {
          console.error("❌ No se pudo registrar el gasto automático:", expErr);
          toast.warning("Orden actualizada, pero el gasto no se registró: " + (expErr?.message || expErr));
        }
      } else if (form.status === "received" && previousStatus !== "received" && alreadyPaid) {
        // Ya se pagó al ordenar, no duplicamos el gasto
        toast.success("Orden recibida ✅ (gasto ya estaba registrado al ordenar)");
      } else {
        toast.success("Orden actualizada");
      }
      // ─────────────────────────────────────────────────────────────────────

      setEditing(false);
      onClose?.(true);
    } catch (err) {
      console.error("Error actualizando:", err);
      toast.error("No se pudo actualizar: " + (err?.message || "error desconocido"));
    }
  };

  const handleChangeItemQty = (idx, qty) => {
    const n = Math.max(1, Number(qty || 1));
    setForm((f) => ({
      ...f,
      items: f.items.map((it, i) =>
        i === idx ? { ...it, quantity: n, received_quantity: n } : it,
      ),
    }));
  };

  const handleChangeItemReceivedQty = (idx, qty) => {
    const n = Math.max(0, Number(qty || 0));
    setForm((f) => ({
      ...f,
      items: f.items.map((it, i) =>
        i === idx ? { ...it, received_quantity: Math.min(n, Number(it.quantity || 1)) } : it,
      ),
    }));
  };

  const handleChangeItemWorkOrder = (idx, workOrderId) => {
    setForm((f) => ({
      ...f,
      items: f.items.map((it, i) =>
        i === idx ? { ...it, work_order_id: workOrderId || "" } : it,
      ),
    }));
  };

  const handleChangeItemCost = (idx, cost) => {
    const n = Math.max(0, Number(cost || 0));
    setForm((f) => ({
      ...f,
      items: f.items.map((it, i) => i === idx ? { ...it, unit_cost: n } : it)
    }));
  };

  const handleRemoveItem = (idx) => {
    setForm((f) => ({
      ...f,
      items: f.items.filter((_, i) => i !== idx)
    }));
  };

  // ── Receive flow handlers ──────────────────────────────────────────────────
  const handleOpenReceiveFlow = () => {
    const currentItems = form.items || poData?.items || poData?.line_items || [];
    setReceiveItems(currentItems.map(item => ({
      product_id: item.product_id || item.inventory_item_id,
      product_name: item.product_name || item.name || "Producto",
      ordered_qty: Number(item.quantity || item.qty || 1),
      unit_cost: Number(item.unit_cost || item.cost || 0),
      received_qty: Number(item.quantity || item.qty || 1)
    })));
    setShowReceiveFlow(true);
  };

  const handleConfirmReceive = async () => {
    setReceiving(true);
    try {
      const { dataClient } = await import("@/components/api/dataClient").catch(() => ({ dataClient: null }));
      const { supabase } = await import("../../../../../lib/supabase-client.js").catch(() => ({ supabase: null }));

      // Update stock for each received item
      for (const item of receiveItems) {
        if (!item.product_id || item.received_qty <= 0) continue;
        try {
          if (dataClient?.entities?.Product) {
            const existing = await dataClient.entities.Product.get(item.product_id).catch(() => null);
            if (existing) {
              const newStock = Number(existing.stock || 0) + Number(item.received_qty);
              await dataClient.entities.Product.update(item.product_id, { stock: newStock });
            }
          } else if (supabase) {
            const { data: prod } = await supabase.from('product').select('stock').eq('id', item.product_id).single();
            if (prod) {
              await supabase.from('product').update({ stock: Number(prod.stock || 0) + Number(item.received_qty) }).eq('id', item.product_id);
            }
          }
        } catch (err) {
          console.warn("Error updating stock for", item.product_id, err);
        }
      }

      // Calculate total cost
      const totalCost = receiveItems.reduce((sum, item) => sum + (item.received_qty * item.unit_cost), 0) + Number(form.shipping_cost || poData?.shipping_cost || 0);

      // Create expense transaction
      try {
        const txPayload = {
          type: "expense",
          amount: totalCost,
          description: `Orden de compra recibida: ${form.po_number || poData?.po_number} — ${form.supplier_name || poData?.supplier_name || "Suplidor"}`,
          category: "inventory_purchase",
          payment_method: "other",
          notes: `PO: ${form.po_number || poData?.po_number}. Items recibidos: ${receiveItems.map(i => `${i.product_name} x${i.received_qty}`).join(", ")}`,
          created_date: new Date().toISOString().split("T")[0],
        };
        if (dataClient?.entities?.Transaction) {
          await dataClient.entities.Transaction.create(txPayload).catch(e => console.warn("Transaction create failed", e));
        } else if (supabase) {
          await supabase.from('transaction').insert(txPayload).catch(e => console.warn("Transaction insert failed", e));
        }
      } catch {}

      // Update PO status to received
      await base44.entities.PurchaseOrder.update(purchaseOrder.id, { status: "received" });
      setForm(prev => ({ ...prev, status: "received" }));
      setShowReceiveFlow(false);
      toast.success("✅ Orden recibida — stock actualizado y gasto registrado");
      onClose(true);
    } catch (err) {
      console.error("Error confirming receive:", err);
      toast.error("Error al confirmar recepción");
    } finally {
      setReceiving(false);
    }
  };

  const subtotal = form.items.reduce(
    (sum, it) => sum + Number(it.unit_cost || 0) * Number(it.quantity || 0),
    0
  );
  const total = subtotal + Number(form.shipping_cost || 0);

  const selectedSupplier = suppliers.find((s) => s.id === form.supplier_id);

  const statusConfig = {
    draft: { label: "Borrador", cls: "bg-slate-600/20 text-slate-300 border-slate-600/40" },
    pending: { label: "🔒 Pendiente aprobación", cls: "bg-amber-500/20 text-amber-300 border-amber-500/40" },
    ordered: { label: "Enviada", cls: "bg-blue-500/20 text-blue-300 border-blue-500/40" },
    partial: { label: "Parcial", cls: "bg-violet-500/20 text-violet-300 border-violet-500/40" },
    received: { label: "Recibida", cls: "bg-emerald-500/20 text-emerald-300 border-emerald-500/40" },
    cancelled: { label: "Cancelada", cls: "bg-red-500/20 text-red-300 border-red-500/40" }
  };

  const isAdminUser = (() => {
    try {
      const session = JSON.parse(localStorage.getItem("employee_session") || "{}");
      const role = String(session?.role || "user").toLowerCase();
      return ["admin", "owner", "manager", "superadmin"].includes(role);
    } catch { return false; }
  })();

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose?.(false)}>
      <DialogContent className="bg-[#0a0a0c] border border-white/[0.06] max-w-4xl max-h-[90vh] overflow-hidden flex flex-col text-white p-0">
        {/* Header */}
        <div className="px-6 pt-6 pb-4 border-b border-white/[0.05]">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-teal-500/15 border border-teal-500/25 flex items-center justify-center shrink-0">
                <FileText className="w-4 h-4 text-teal-400" />
              </div>
              <div>
                <h2 className="text-white font-black text-lg leading-tight">
                  Orden {form.po_number || "—"}
                </h2>
                <div className="flex items-center gap-2 mt-0.5">
                  {form.status && (
                    <span className={`text-[10px] font-black px-2 py-0.5 rounded-full border ${(statusConfig[form.status] || statusConfig.draft).cls}`}>
                      {(statusConfig[form.status] || statusConfig.draft).label}
                    </span>
                  )}
                  {(form.supplier_name || selectedSupplier?.name) && (
                    <span className="text-[11px] text-white/30 font-medium">
                      {selectedSupplier?.name || form.supplier_name}
                    </span>
                  )}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              {!editing && poData?.status !== "received" && poData?.status !== "cancelled" && (
                <button
                  onClick={handleOpenReceiveFlow}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 text-white text-sm font-bold hover:opacity-90 transition-all active:scale-95 shadow-[0_4px_12px_rgba(16,185,129,0.3)]"
                >
                  <PackageSearch className="w-4 h-4" />
                  Recibir Orden
                </button>
              )}
              {!editing && (
                <button
                  onClick={() => setEditing(true)}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white/5 border border-white/10 text-white/70 text-sm font-bold hover:bg-white/10 transition-all"
                >
                  <Edit2 className="w-4 h-4" />
                  Editar
                </button>
              )}
            </div>
          </div>
        </div>

        {loading ? (
          <div className="py-12 text-center text-white/30">Cargando...</div>
        ) : (
          <div className="overflow-y-auto flex-1 space-y-4 px-6 py-4">
            {/* Supplier */}
            <div className="bg-[#111114]/80 border border-white/[0.06] rounded-[24px] p-5">
              <div className="flex items-center gap-2 mb-3">
                <Truck className="w-4 h-4 text-teal-400" />
                <p className="text-[10px] font-black text-white/30 uppercase tracking-widest">Proveedor</p>
              </div>
              {editing ? (
                <div className="space-y-2">
                  <select
                    value={form.supplier_id}
                    onChange={(e) => {
                      const sup = suppliers.find((s) => s.id === e.target.value);
                      setForm((f) => ({
                        ...f,
                        supplier_id: e.target.value,
                        supplier_name: sup?.name || ""
                      }));
                    }}
                    className="w-full h-10 px-3 rounded-xl bg-[#111114]/60 border border-white/[0.08] text-white text-sm focus:outline-none focus:border-teal-500/50"
                  >
                    <option value="">Seleccionar proveedor</option>
                    {suppliers.map((s) => (
                      <option key={s.id} value={s.id}>{s.name}</option>
                    ))}
                  </select>
                  <input
                    value={form.supplier_name}
                    onChange={(e) => setForm((f) => ({ ...f, supplier_name: e.target.value }))}
                    placeholder="O escribe un nombre manual"
                    className="w-full bg-[#111114]/60 border border-white/[0.08] rounded-xl px-4 py-3 text-white text-sm placeholder:text-white/50 focus:outline-none focus:border-teal-500/50"
                  />
                </div>
              ) : (
                <p className="text-white font-bold">{selectedSupplier?.name || form.supplier_name || "No especificado"}</p>
              )}
            </div>

            {/* Dates + Status */}
            <div className="grid sm:grid-cols-2 gap-4">
              <div className="bg-[#111114]/80 border border-white/[0.06] rounded-[24px] p-5">
                <div className="flex items-center gap-2 mb-3">
                  <Calendar className="w-4 h-4 text-teal-400" />
                  <p className="text-[10px] font-black text-white/30 uppercase tracking-widest">Fechas</p>
                </div>
                {editing ? (
                  <div className="space-y-2">
                    <div>
                      <label className="text-[10px] text-white/30 font-bold block mb-1">Fecha orden</label>
                      <input
                        type="date"
                        value={form.order_date}
                        onChange={(e) => setForm((f) => ({ ...f, order_date: e.target.value }))}
                        className="w-full bg-[#111114]/60 border border-white/[0.08] rounded-xl px-3 py-2 text-white text-sm focus:outline-none focus:border-teal-500/50"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] text-white/30 font-bold block mb-1">Fecha estimada</label>
                      <input
                        type="date"
                        value={form.expected_date}
                        onChange={(e) => setForm((f) => ({ ...f, expected_date: e.target.value }))}
                        className="w-full bg-[#111114]/60 border border-white/[0.08] rounded-xl px-3 py-2 text-white text-sm focus:outline-none focus:border-teal-500/50"
                      />
                    </div>
                  </div>
                ) : (
                  <div className="space-y-1 text-sm">
                    <p className="text-white/60">Orden: <span className="text-white font-bold">{form.order_date || "—"}</span></p>
                    <p className="text-white/60">Estimada: <span className="text-white font-bold">{form.expected_date || "—"}</span></p>
                  </div>
                )}
              </div>

              <div className="bg-[#111114]/80 border border-white/[0.06] rounded-[24px] p-5">
                <div className="flex items-center gap-2 mb-3">
                  <Truck className="w-4 h-4 text-teal-400" />
                  <p className="text-[10px] font-black text-white/30 uppercase tracking-widest">Estado</p>
                </div>
                {editing ? (
                  <div className="flex flex-wrap gap-2">
                    {[
                      { value: "draft", label: "Borrador", active: "bg-slate-600 text-white border-slate-500" },
                      { value: "ordered", label: "Ordenado", active: "bg-blue-600 text-white border-blue-500" },
                      { value: "received", label: "Recibido", active: "bg-emerald-600 text-white border-emerald-500" },
                      { value: "cancelled", label: "Cancelado", active: "bg-red-600 text-white border-red-500" }
                    ].map((opt) => (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() => setForm((f) => ({ ...f, status: opt.value }))}
                        className={[
                          "px-3 py-1.5 rounded-xl text-xs font-bold border transition-all",
                          form.status === opt.value ? opt.active : "bg-[#111114]/60 border-white/[0.08] text-white/40"
                        ].join(" ")}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                ) : (
                  <span className={`inline-flex items-center text-sm font-bold px-3 py-1.5 rounded-xl border ${(statusConfig[form.status] || statusConfig.draft).cls}`}>
                    {(statusConfig[form.status] || statusConfig.draft).label}
                  </span>
                )}
              </div>
            </div>

            {/* Timeline visual del estado */}
            {!editing && (
              <div className="bg-[#111114]/80 border border-white/[0.06] rounded-[24px] p-5">
                <p className="text-[10px] font-black text-white/30 uppercase tracking-widest mb-4">
                  Progreso
                </p>
                {(() => {
                  const steps = [
                    { key: "draft", label: "Borrador", icon: "📝" },
                    { key: "ordered", label: "Enviada", icon: "📤" },
                    { key: "partial", label: "Parcial", icon: "📦", optional: true },
                    { key: "received", label: "Recibida", icon: "✅" },
                  ];
                  const order = ["draft", "ordered", "partial", "received"];
                  const currentIdx = order.indexOf(form.status || "draft");
                  const isCancelled = form.status === "cancelled";
                  return (
                    <div className="flex items-start gap-1">
                      {steps.map((step, idx) => {
                        const isActive = !isCancelled && order.indexOf(step.key) <= currentIdx;
                        const isCurrent = step.key === form.status;
                        // Skip partial si no aplica
                        if (step.key === "partial" && form.status !== "partial" && currentIdx > 2) return null;
                        return (
                          <React.Fragment key={step.key}>
                            <div className="flex flex-col items-center flex-1 min-w-0">
                              <div className={`w-10 h-10 rounded-full flex items-center justify-center text-lg border-2 transition-all ${
                                isCurrent
                                  ? "bg-cyan-500/30 border-cyan-400 scale-110"
                                  : isActive
                                    ? "bg-emerald-500/20 border-emerald-500/50"
                                    : "bg-white/[0.04] border-white/10"
                              }`}>
                                {step.icon}
                              </div>
                              <p className={`text-[10px] font-black mt-1.5 text-center ${
                                isCurrent ? "text-cyan-300" : isActive ? "text-emerald-400" : "text-white/30"
                              }`}>
                                {step.label}
                              </p>
                            </div>
                            {idx < steps.length - 1 && (
                              <div className={`h-0.5 flex-1 mt-5 transition-all ${
                                isActive && order.indexOf(steps[idx + 1].key) <= currentIdx
                                  ? "bg-emerald-500/50"
                                  : "bg-white/10"
                              }`} />
                            )}
                          </React.Fragment>
                        );
                      })}
                      {isCancelled && (
                        <div className="flex flex-col items-center flex-1">
                          <div className="w-10 h-10 rounded-full flex items-center justify-center text-lg border-2 bg-red-500/20 border-red-500/50">
                            ❌
                          </div>
                          <p className="text-[10px] font-black mt-1.5 text-red-400">Cancelada</p>
                        </div>
                      )}
                    </div>
                  );
                })()}
                {poData?.order_date && (
                  <p className="text-[10px] text-white/30 mt-3 text-center">
                    Ordenada el {new Date(poData.order_date).toLocaleDateString("es-ES", { day: "2-digit", month: "short", year: "numeric" })}
                    {poData.expected_date && ` · Esperada el ${new Date(poData.expected_date).toLocaleDateString("es-ES", { day: "2-digit", month: "short" })}`}
                  </p>
                )}
                {/* Audit log */}
                {(poData?.created_by_name || poData?.received_by_name || poData?.created_date) && (
                  <div className="mt-3 pt-3 border-t border-white/[0.05] flex flex-wrap gap-3 justify-center text-[10px] text-white/30">
                    {poData?.created_by_name && (
                      <span>📝 Creada por <span className="text-white/60 font-bold">{poData.created_by_name}</span></span>
                    )}
                    {poData?.created_date && (
                      <span>el {new Date(poData.created_date).toLocaleDateString("es-ES", { day: "2-digit", month: "short", year: "2-digit" })}</span>
                    )}
                    {poData?.received_by_name && (
                      <span>· ✅ Recibida por <span className="text-emerald-400 font-bold">{poData.received_by_name}</span></span>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Products */}
            <div className="bg-[#111114]/80 border border-white/[0.06] rounded-[24px] p-5">
              <div className="flex items-center gap-2 mb-4">
                <PackageSearch className="w-4 h-4 text-emerald-400" />
                <p className="text-[10px] font-black text-white/30 uppercase tracking-widest">
                  Productos ({form.items.length})
                </p>
              </div>

              <div className="space-y-2">
                {form.items.map((it, idx) => (
                  <div key={idx} className="bg-white/[0.03] border border-white/[0.05] rounded-2xl p-3 flex items-center gap-3">
                    <div className="flex-1 min-w-0">
                      <p className="text-white font-bold text-sm truncate">{it.product_name}</p>
                      {!editing && (
                        <>
                          <p className="text-white/30 text-xs mt-0.5">
                            {it.quantity} × {money(it.unit_cost)} = {money((it.unit_cost || 0) * (it.quantity || 0))}
                            {it.received_quantity != null && it.received_quantity < it.quantity && (
                              <span className="ml-2 px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-300 font-black">
                                Recibidas: {it.received_quantity}/{it.quantity}
                              </span>
                            )}
                          </p>
                          {it.work_order_id && (() => {
                            const wo = workOrders.find((w) => w.id === it.work_order_id);
                            if (!wo) {
                              return (
                                <p className="text-[10px] text-amber-400/70 mt-1">
                                  🔗 WO enlazada (no disponible en catálogo actual)
                                </p>
                              );
                            }
                            return (
                              <p className="text-[10px] mt-1 text-cyan-300 font-bold">
                                🔗 Para: {wo.order_number || wo.id?.slice(-6)}
                                {wo.customer_name ? ` · ${wo.customer_name}` : ""}
                              </p>
                            );
                          })()}
                        </>
                      )}
                      {editing && (
                        <div className="mt-1">
                          <p className="text-[9px] text-white/30 font-black uppercase mb-0.5">
                            🔗 Enlazar a orden de trabajo
                          </p>
                          <select
                            value={it.work_order_id || ""}
                            onChange={(e) => handleChangeItemWorkOrder(idx, e.target.value)}
                            className="w-full bg-zinc-900 border border-white/10 rounded-lg px-2 py-1 text-[11px] text-white"
                          >
                            <option value="">— Sin orden de trabajo —</option>
                            {workOrders.slice(0, 200).map((wo) => (
                              <option key={wo.id} value={wo.id}>
                                {wo.order_number || wo.id?.slice(-6)}
                                {wo.customer_name ? ` · ${wo.customer_name}` : ""}
                              </option>
                            ))}
                          </select>
                        </div>
                      )}
                    </div>
                    {editing && (
                      <div className="flex items-center gap-2 shrink-0">
                        <div className="flex flex-col items-end gap-1">
                          <label className="text-[9px] text-white/30 font-bold">Cant</label>
                          <input
                            type="number"
                            min={1}
                            value={it.quantity}
                            onChange={(e) => handleChangeItemQty(idx, e.target.value)}
                            className="h-8 w-16 text-right bg-white/5 border border-white/10 rounded-lg text-white text-xs focus:outline-none focus:border-teal-500/50 px-2"
                          />
                        </div>
                        <div className="flex flex-col items-end gap-1">
                          <label className="text-[9px] text-emerald-400/70 font-bold">Recib.</label>
                          <input
                            type="number"
                            min={0}
                            max={it.quantity}
                            value={it.received_quantity ?? it.quantity}
                            onChange={(e) => handleChangeItemReceivedQty(idx, e.target.value)}
                            title="Cantidad físicamente recibida (recepción parcial)"
                            className="h-8 w-16 text-right bg-emerald-500/[0.05] border border-emerald-500/20 rounded-lg text-white text-xs focus:outline-none focus:border-emerald-500/50 px-2"
                          />
                        </div>
                        <div className="flex flex-col items-end gap-1">
                          <label className="text-[9px] text-white/30 font-bold">Costo</label>
                          <input
                            type="number"
                            step="0.01"
                            min={0}
                            value={it.unit_cost}
                            onChange={(e) => handleChangeItemCost(idx, e.target.value)}
                            className="h-8 w-24 text-right bg-white/5 border border-white/10 rounded-lg text-white text-xs focus:outline-none focus:border-teal-500/50 px-2"
                          />
                        </div>
                        <button
                          onClick={() => handleRemoveItem(idx)}
                          className="w-8 h-8 mt-4 rounded-xl bg-red-500/10 border border-red-500/20 flex items-center justify-center text-red-400 hover:bg-red-500/20 transition-all"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    )}
                    {!editing && (
                      <div className="text-right shrink-0">
                        <p className="text-white font-black text-sm">{money((it.unit_cost || 0) * (it.quantity || 0))}</p>
                      </div>
                    )}
                  </div>
                ))}
              </div>

              {/* Totals */}
              <div className="mt-4 pt-4 border-t border-white/[0.05] space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-white/30 font-bold">Subtotal</span>
                  <span className="text-white/70">{money(subtotal)}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-white/30 font-bold">Envío</span>
                  {editing ? (
                    <input
                      type="number"
                      step="0.01"
                      min={0}
                      value={form.shipping_cost}
                      onChange={(e) => setForm((f) => ({ ...f, shipping_cost: Number(e.target.value) || 0 }))}
                      className="h-8 w-28 text-right bg-white/5 border border-white/10 rounded-lg text-white text-sm focus:outline-none focus:border-teal-500/50 px-2"
                    />
                  ) : (
                    <span className="text-white/70">{money(form.shipping_cost)}</span>
                  )}
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-white/50 font-black text-sm">Total</span>
                  <span className="text-emerald-400 font-black text-xl">{money(total)}</span>
                </div>
              </div>
            </div>

            {/* Tracking del envío */}
            <div className="bg-[#111114]/80 border border-white/[0.06] rounded-[24px] p-5">
              <p className="text-[10px] font-black text-white/30 uppercase tracking-widest mb-3">
                📦 Tracking del envío
              </p>
              {editing ? (
                <input
                  type="text"
                  value={form.tracking_number}
                  onChange={(e) => setForm((f) => ({ ...f, tracking_number: e.target.value }))}
                  placeholder="Número de tracking (USPS, UPS, FedEx, DHL, etc.)"
                  className="w-full bg-[#111114]/60 border border-white/[0.08] rounded-xl px-4 py-3 text-white text-sm placeholder:text-white/50 focus:outline-none focus:border-teal-500/50"
                />
              ) : form.tracking_number ? (() => {
                const tn = form.tracking_number.trim();
                // Detectar carrier por patrón
                const detectCarrier = (n) => {
                  const x = n.replace(/\s/g, "");
                  // USPS: 20-22 digits, starts with 9
                  if (/^9[0-9]{15,21}$/.test(x)) return { name: "USPS", url: `https://tools.usps.com/go/TrackConfirmAction?tLabels=${x}` };
                  // UPS: 1Z + 16 chars
                  if (/^1Z[0-9A-Z]{16}$/i.test(x)) return { name: "UPS", url: `https://www.ups.com/track?tracknum=${x}` };
                  // FedEx: 12 or 15 digits
                  if (/^[0-9]{12}$/.test(x) || /^[0-9]{15}$/.test(x)) return { name: "FedEx", url: `https://www.fedex.com/fedextrack/?trknbr=${x}` };
                  // DHL: 10 or 11 digits
                  if (/^[0-9]{10,11}$/.test(x)) return { name: "DHL", url: `https://www.dhl.com/us-en/home/tracking/tracking-express.html?submit=1&tracking-id=${x}` };
                  return { name: "Desconocido", url: `https://www.google.com/search?q=tracking+${encodeURIComponent(tn)}` };
                };
                const carrier = detectCarrier(tn);
                return (
                  <div className="flex items-center gap-3">
                    <div className="flex-1 min-w-0">
                      <p className="text-white font-bold text-sm font-mono truncate">{tn}</p>
                      <p className="text-[10px] text-white/40">Detectado: {carrier.name}</p>
                    </div>
                    <a
                      href={carrier.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-3 py-2 rounded-lg bg-cyan-500/15 border border-cyan-500/25 text-cyan-300 text-xs font-black hover:bg-cyan-500/25 flex items-center gap-1.5"
                    >
                      🔍 Rastrear
                    </a>
                  </div>
                );
              })() : (
                <p className="text-white/30 text-xs">Sin tracking registrado · Edita para añadir</p>
              )}
            </div>

            {/* Archivo importado — extraer URL del marcador en notes */}
            {(() => {
              const match = /📎\s*Archivo importado:\s*(\S+)/.exec(form.notes || "");
              if (!match) return null;
              const url = match[1];
              const isImage = /\.(jpg|jpeg|png|webp|gif|heic)(\?|$)/i.test(url);
              return (
                <div className="bg-[#111114]/80 border border-white/[0.06] rounded-[24px] p-5">
                  <p className="text-[10px] font-black text-white/30 uppercase tracking-widest mb-3">
                    📎 Archivo original
                  </p>
                  {isImage ? (
                    <a
                      href={url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="block rounded-xl overflow-hidden border border-white/10 hover:border-cyan-500/40 transition-colors"
                    >
                      <img
                        src={url}
                        alt="OC original"
                        className="w-full max-h-80 object-contain bg-black/40"
                      />
                    </a>
                  ) : (
                    <a
                      href={url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-2 px-4 py-3 rounded-xl bg-cyan-500/10 border border-cyan-500/20 text-cyan-300 text-sm font-black hover:bg-cyan-500/20"
                    >
                      <FileText className="w-4 h-4" />
                      Abrir archivo original
                    </a>
                  )}
                </div>
              );
            })()}

            {/* Notes — limpiamos los marcadores internos para la vista */}
            <div className="bg-[#111114]/80 border border-white/[0.06] rounded-[24px] p-5">
              <p className="text-[10px] font-black text-white/30 uppercase tracking-widest mb-3">Notas</p>
              {editing ? (
                <textarea
                  value={form.notes}
                  onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                  rows={3}
                  className="w-full bg-[#111114]/60 border border-white/[0.08] rounded-xl px-4 py-3 text-white text-sm placeholder:text-white/50 focus:outline-none focus:border-teal-500/50 resize-none"
                />
              ) : (() => {
                const cleanNotes = (form.notes || "")
                  .replace(/\[PAID:[^\]]+\]/g, "")
                  .replace(/\[STOCKED\]/g, "")
                  .replace(/📎\s*Archivo importado:\s*\S+/g, "")
                  .trim();
                return <p className="text-white/60 text-sm whitespace-pre-line">{cleanNotes || "Sin notas"}</p>;
              })()}
            </div>
          </div>
        )}

        <DialogFooter className="border-t border-white/[0.05] px-6 py-4">
          {editing ? (
            <div className="flex gap-2 w-full">
              <button
                onClick={() => setEditing(false)}
                className="flex-1 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white/50 text-sm font-bold hover:bg-white/10 transition-all"
              >
                Cancelar
              </button>
              <button
                onClick={handleSave}
                className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-teal-500 to-cyan-500 text-white text-sm font-bold hover:opacity-90 transition-all flex items-center justify-center gap-2"
              >
                <Save className="w-4 h-4" />
                Guardar Cambios
              </button>
            </div>
          ) : (
            <div className="flex gap-2 w-full flex-wrap">
              <button
                onClick={async () => {
                  // Contar items enlazados a WOs para avisar al usuario
                  const linkedItems = form.items.filter((it) => it.work_order_id);
                  const linkedWoIds = [...new Set(linkedItems.map((it) => it.work_order_id))];
                  const extraMsg = linkedWoIds.length > 0
                    ? `\n\n⚠️ Se removerán ${linkedItems.length} items de ${linkedWoIds.length} orden${linkedWoIds.length === 1 ? "" : "es"} de trabajo enlazada${linkedWoIds.length === 1 ? "" : "s"}.`
                    : "";
                  const ok = window.confirm(
                    `¿Borrar la orden de compra ${form.po_number || ""}?${extraMsg}\n\nNo se borran los gastos ya registrados en Finanzas (esos hay que borrarlos por separado si existen).`,
                  );
                  if (!ok) return;
                  try {
                    // Primero limpiar items de las WOs enlazadas
                    for (const woId of linkedWoIds) {
                      await removeItemsFromWO(woId, (i) => i.po_id === purchaseOrder.id);
                    }
                    // Luego borrar la PO
                    await base44.entities.PurchaseOrder.delete(purchaseOrder.id);
                    toast.success(
                      linkedWoIds.length > 0
                        ? `Orden borrada · ${linkedItems.length} items removidos de ${linkedWoIds.length} WO${linkedWoIds.length === 1 ? "" : "s"}`
                        : "Orden de compra borrada",
                    );
                    onClose?.(true);
                  } catch (err) {
                    console.error("Delete PO error:", err);
                    toast.error("No se pudo borrar: " + (err?.message || ""));
                  }
                }}
                className="px-3 py-2.5 rounded-xl bg-red-500/10 border border-red-500/20 text-red-300 text-xs font-bold hover:bg-red-500/20 transition-all flex items-center justify-center gap-1.5"
                title="Borrar orden de compra"
              >
                <X className="w-3.5 h-3.5" />
                Borrar
              </button>
              <button
                onClick={async () => {
                  try {
                    const now = new Date();
                    const datePart = now.toISOString().slice(2, 10).replace(/-/g, "");
                    const rand = Math.floor(Math.random() * 900 + 100);
                    const newPoNumber = `PO-${datePart}-${rand}`;
                    const cleanNotes = (form.notes || "")
                      .replace(/\[PAID:[^\]]+\]/g, "")
                      .replace(/\[STOCKED\]/g, "")
                      .replace(/📎\s*Archivo importado:\s*\S+/g, "")
                      .trim();
                    const newLineItems = form.items.map((it, i) => ({
                      id: `li-${Date.now()}-${i}`,
                      inventory_item_id: it.product_id || undefined,
                      product_name: it.product_name || "",
                      quantity: Number(it.quantity || 1),
                      unit_cost: Number(it.unit_cost || 0),
                      line_total: Number(it.quantity || 1) * Number(it.unit_cost || 0),
                    }));
                    const subtotal = newLineItems.reduce((s, it) => s + (it.line_total || 0), 0);
                    await base44.entities.PurchaseOrder.create({
                      po_number: newPoNumber,
                      supplier_id: form.supplier_id || "",
                      supplier_name: form.supplier_name || "",
                      status: "draft",
                      order_date: now.toISOString().slice(0, 10),
                      line_items: newLineItems,
                      subtotal,
                      shipping_cost: Number(form.shipping_cost || 0),
                      total_amount: subtotal + Number(form.shipping_cost || 0),
                      notes: `Duplicada de ${form.po_number}${cleanNotes ? "\n" + cleanNotes : ""}`,
                    });
                    toast.success(`Duplicada como ${newPoNumber}`);
                    onClose?.(true);
                  } catch (err) {
                    console.error("Duplicate PO error:", err);
                    toast.error("No se pudo duplicar: " + (err?.message || ""));
                  }
                }}
                className="px-3 py-2.5 rounded-xl bg-violet-500/10 border border-violet-500/20 text-violet-300 text-xs font-bold hover:bg-violet-500/20 transition-all flex items-center justify-center gap-1.5"
                title="Crear una copia como borrador nuevo"
              >
                📋 Duplicar
              </button>
              <button
                onClick={async () => {
                  const supplier = suppliers.find((s) => s.id === form.supplier_id);
                  const supplierEmail = supplier?.email;
                  if (!supplierEmail) {
                    toast.error("El proveedor no tiene email registrado. Edita el proveedor primero.");
                    return;
                  }
                  const ok = window.confirm(`¿Enviar esta OC por email a ${supplierEmail}?`);
                  if (!ok) return;
                  try {
                    const total = form.items.reduce((s, it) => s + (Number(it.unit_cost || 0) * Number(it.quantity || 0)), 0) + Number(form.shipping_cost || 0);
                    const itemsRows = form.items
                      .map((it) => `<tr><td>${String(it.product_name || "").replace(/</g, "&lt;")}</td><td style="text-align:right">${it.quantity || 0}</td><td style="text-align:right">$${Number(it.unit_cost || 0).toFixed(2)}</td><td style="text-align:right">$${(Number(it.unit_cost || 0) * Number(it.quantity || 0)).toFixed(2)}</td></tr>`)
                      .join("");
                    const html = `
                      <div style="font-family:-apple-system,sans-serif;max-width:600px;margin:0 auto;padding:20px;color:#222">
                        <h2 style="border-bottom:3px solid #0891b2;padding-bottom:10px">Orden de Compra ${form.po_number}</h2>
                        <p>Hola ${supplier?.contact_name || supplier?.name || "equipo"},</p>
                        <p>Adjunto los detalles de nuestra orden de compra:</p>
                        <p><strong>Fecha:</strong> ${form.order_date || "—"}<br>
                           <strong>Fecha esperada:</strong> ${form.expected_date || "—"}</p>
                        <table style="width:100%;border-collapse:collapse;margin:20px 0">
                          <thead><tr style="background:#f5f5f5"><th style="padding:8px;text-align:left">Producto</th><th style="padding:8px;text-align:right">Cant</th><th style="padding:8px;text-align:right">Costo u.</th><th style="padding:8px;text-align:right">Total</th></tr></thead>
                          <tbody>${itemsRows}</tbody>
                          <tfoot><tr><td colspan="3" style="padding:8px;text-align:right;border-top:2px solid #222"><strong>TOTAL</strong></td><td style="padding:8px;text-align:right;border-top:2px solid #222"><strong>$${total.toFixed(2)}</strong></td></tr></tfoot>
                        </table>
                        <p>Gracias.</p>
                      </div>
                    `;
                    await base44.integrations.Core.SendEmail({
                      to: supplierEmail,
                      subject: `Orden de Compra ${form.po_number}`,
                      html,
                    });
                    toast.success(`Email enviado a ${supplierEmail}`);
                  } catch (err) {
                    console.error("Send email error:", err);
                    toast.error("No se pudo enviar: " + (err?.message || ""));
                  }
                }}
                className="px-3 py-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 text-xs font-bold hover:bg-emerald-500/20 transition-all flex items-center justify-center gap-1.5"
                title="Enviar esta OC por email al proveedor"
              >
                ✉️ Email proveedor
              </button>
              <button
                onClick={() => {
                  const total = form.items.reduce((s, it) => s + (Number(it.unit_cost || 0) * Number(it.quantity || 0)), 0) + Number(form.shipping_cost || 0);
                  const win = window.open("", "_blank");
                  if (!win) { toast.error("Tu navegador bloqueó la ventana de impresión"); return; }
                  const cleanNotes = (form.notes || "")
                    .replace(/\[PAID:[^\]]+\]/g, "")
                    .replace(/\[STOCKED\]/g, "")
                    .replace(/📎\s*Archivo importado:\s*\S+/g, "")
                    .trim();
                  win.document.write(`
<!DOCTYPE html>
<html><head><title>OC ${form.po_number}</title>
<style>
  body { font-family: -apple-system, BlinkMacSystemFont, sans-serif; max-width: 800px; margin: 40px auto; padding: 20px; color: #222; }
  h1 { border-bottom: 3px solid #222; padding-bottom: 10px; }
  .header { display: flex; justify-content: space-between; margin: 20px 0; }
  .header div { flex: 1; }
  .label { color: #666; font-size: 11px; text-transform: uppercase; font-weight: bold; }
  .value { font-size: 16px; margin-top: 2px; }
  table { width: 100%; border-collapse: collapse; margin: 20px 0; }
  th, td { padding: 10px; text-align: left; border-bottom: 1px solid #ddd; }
  th { background: #f5f5f5; font-size: 12px; text-transform: uppercase; color: #666; }
  .total-row td { font-weight: bold; border-top: 2px solid #222; border-bottom: none; }
  .right { text-align: right; }
  .notes { margin-top: 30px; padding: 15px; background: #f9f9f9; border-left: 4px solid #0891b2; font-size: 13px; }
  @media print { body { margin: 20px; } }
</style></head>
<body>
  <h1>Orden de Compra — ${form.po_number}</h1>
  <div class="header">
    <div>
      <div class="label">Proveedor</div>
      <div class="value">${(form.supplier_name || "").replace(/</g, "&lt;")}</div>
    </div>
    <div>
      <div class="label">Estado</div>
      <div class="value">${(statusConfig[form.status] || statusConfig.draft).label}</div>
    </div>
    <div>
      <div class="label">Fecha orden</div>
      <div class="value">${form.order_date || "—"}</div>
    </div>
    <div>
      <div class="label">Fecha esperada</div>
      <div class="value">${form.expected_date || "—"}</div>
    </div>
  </div>
  <table>
    <thead>
      <tr><th>#</th><th>Producto</th><th class="right">Cant</th><th class="right">Costo u.</th><th class="right">Total</th></tr>
    </thead>
    <tbody>
      ${form.items.map((it, i) => `
        <tr>
          <td>${i + 1}</td>
          <td>${String(it.product_name || "").replace(/</g, "&lt;")}</td>
          <td class="right">${it.quantity || 0}</td>
          <td class="right">$${Number(it.unit_cost || 0).toFixed(2)}</td>
          <td class="right">$${(Number(it.unit_cost || 0) * Number(it.quantity || 0)).toFixed(2)}</td>
        </tr>
      `).join("")}
      ${Number(form.shipping_cost || 0) > 0 ? `
        <tr><td colspan="4" class="right">Envío</td><td class="right">$${Number(form.shipping_cost).toFixed(2)}</td></tr>
      ` : ""}
      <tr class="total-row">
        <td colspan="4" class="right">TOTAL</td>
        <td class="right">$${total.toFixed(2)}</td>
      </tr>
    </tbody>
  </table>
  ${cleanNotes ? `<div class="notes"><div class="label">Notas</div><div>${cleanNotes.replace(/</g, "&lt;").replace(/\n/g, "<br>")}</div></div>` : ""}
  <script>window.addEventListener('load', () => { window.print(); });</script>
</body></html>
                  `);
                  win.document.close();
                }}
                className="px-3 py-2.5 rounded-xl bg-cyan-500/10 border border-cyan-500/20 text-cyan-300 text-xs font-bold hover:bg-cyan-500/20 transition-all flex items-center justify-center gap-1.5"
                title="Imprimir orden de compra"
              >
                🖨️ Imprimir
              </button>
              {/* Registrar pago manual — visible si no hay marcador [PAID:...] en notes */}
              {!/\[PAID:[^\]]+\]/.test(form.notes || "") && form.status !== "cancelled" && form.status !== "draft" && (
                <button
                  onClick={() => {
                    // Pre-seleccionar método del supplier si tiene default
                    const sup = suppliers.find((s) => s.id === form.supplier_id);
                    setPayMethod(sup?.default_payment_method || "paypal");
                    setShowPayDialog(true);
                  }}
                  className="px-3 py-2.5 rounded-xl bg-emerald-500/15 border border-emerald-500/25 text-emerald-300 text-xs font-bold hover:bg-emerald-500/25 transition-all flex items-center justify-center gap-1.5"
                  title="Registrar el pago de esta orden en gastos diarios"
                >
                  💰 Registrar pago
                </button>
              )}
              {form.status === "pending" && isAdminUser && (
                <button
                  onClick={async () => {
                    if (!window.confirm(`¿Aprobar esta OC de $${form.items.reduce((s, it) => s + Number(it.unit_cost || 0) * Number(it.quantity || 0), 0).toFixed(2)}?`)) return;
                    try {
                      const performedBy = (() => {
                        try { return JSON.parse(localStorage.getItem("employee_session") || "{}")?.name || "Admin"; }
                        catch { return "Admin"; }
                      })();
                      await base44.entities.PurchaseOrder.update(purchaseOrder.id, {
                        status: "ordered",
                        notes: ((form.notes || "") + `\n[APPROVED ${new Date().toISOString().slice(0, 10)} by ${performedBy}]`).trim(),
                      });
                      toast.success("✅ OC aprobada y enviada");
                      onClose?.(true);
                    } catch (err) {
                      toast.error("No se pudo aprobar: " + (err?.message || ""));
                    }
                  }}
                  className="px-3 py-2.5 rounded-xl bg-emerald-500/15 border border-emerald-500/25 text-emerald-300 text-xs font-bold hover:bg-emerald-500/25 transition-all flex items-center justify-center gap-1.5"
                  title="Aprobar esta OC pendiente"
                >
                  ✅ Aprobar
                </button>
              )}
              {(form.status === "received" || form.status === "partial") && (
                <button
                  onClick={() => {
                    // Pre-fill con todas las cantidades en 0
                    const initial = {};
                    form.items.forEach((_, idx) => { initial[idx] = 0; });
                    setReturnItems(initial);
                    setReturnReason("");
                    setShowReturnDialog(true);
                  }}
                  className="px-3 py-2.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-300 text-xs font-bold hover:bg-amber-500/20 transition-all flex items-center justify-center gap-1.5"
                  title="Marcar items defectuosos / devolver al proveedor"
                >
                  ↩️ Devolver
                </button>
              )}
              <button
                onClick={() => onClose?.(false)}
                className="flex-1 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white/50 text-sm font-bold hover:bg-white/10 transition-all"
              >
                Cerrar
              </button>
            </div>
          )}
        </DialogFooter>

        {/* Receive Flow Overlay */}
        {showReceiveFlow && (
          <div className="fixed inset-0 z-[9999] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setShowReceiveFlow(false)}>
            <div className="bg-zinc-900 border border-emerald-500/30 rounded-3xl max-w-lg w-full shadow-2xl" onClick={e => e.stopPropagation()}>
              <div className="bg-gradient-to-r from-emerald-500/20 to-teal-500/20 border-b border-emerald-500/20 p-5 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center">
                    <PackageSearch className="w-5 h-5 text-emerald-400" />
                  </div>
                  <div>
                    <p className="text-white font-black text-lg">Recibir Orden</p>
                    <p className="text-emerald-300/70 text-xs">Confirma las cantidades recibidas</p>
                  </div>
                </div>
                <button onClick={() => setShowReceiveFlow(false)} className="w-8 h-8 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 flex items-center justify-center text-white/50 hover:text-white transition-all">
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div className="p-5 space-y-3 max-h-[50vh] overflow-y-auto">
                {receiveItems.map((item, idx) => (
                  <div key={idx} className="bg-white/[0.04] border border-white/[0.07] rounded-2xl p-4 flex items-center justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <p className="text-white font-bold text-sm truncate">{item.product_name}</p>
                      <p className="text-white/30 text-xs">Ordenado: {item.ordered_qty} · Costo: {money(item.unit_cost)}/u</p>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <button
                        onClick={() => setReceiveItems(prev => prev.map((r, i) => i === idx ? { ...r, received_qty: Math.max(0, r.received_qty - 1) } : r))}
                        className="w-8 h-8 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center text-white/60 hover:text-white hover:bg-white/10 transition-all font-bold text-lg"
                      >−</button>
                      <span className="text-white font-black text-lg w-8 text-center">{item.received_qty}</span>
                      <button
                        onClick={() => setReceiveItems(prev => prev.map((r, i) => i === idx ? { ...r, received_qty: r.received_qty + 1 } : r))}
                        className="w-8 h-8 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center text-white/60 hover:text-white hover:bg-white/10 transition-all font-bold text-lg"
                      >+</button>
                    </div>
                  </div>
                ))}
              </div>
              <div className="p-5 border-t border-white/[0.05]">
                <div className="flex items-center justify-between mb-4 text-sm">
                  <span className="text-white/40 font-bold">Total a registrar como gasto</span>
                  <span className="text-emerald-400 font-black text-xl">
                    {money(receiveItems.reduce((s, i) => s + i.received_qty * i.unit_cost, 0) + Number(form.shipping_cost || poData?.shipping_cost || 0))}
                  </span>
                </div>
                <div className="flex gap-3">
                  <button onClick={() => setShowReceiveFlow(false)} className="flex-1 py-3 rounded-2xl bg-white/5 border border-white/10 text-white/50 text-sm font-bold hover:bg-white/10 transition-all">
                    Cancelar
                  </button>
                  <button
                    onClick={handleConfirmReceive}
                    disabled={receiving}
                    className="flex-1 py-3 rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-500 text-white text-sm font-black hover:opacity-90 transition-all disabled:opacity-50"
                  >
                    {receiving ? "Procesando..." : "Confirmar Recepción"}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </DialogContent>

      {/* Modal — Registrar pago manual */}
      <Dialog open={showPayDialog} onOpenChange={(v) => !v && setShowPayDialog(false)}>
        <DialogContent className="max-w-md bg-zinc-950 border-white/10 text-white">
          <DialogHeader>
            <DialogTitle className="text-white flex items-center gap-2">
              💰 Registrar pago de OC
            </DialogTitle>
          </DialogHeader>
          {(() => {
            const total = form.items.reduce((s, it) => s + (Number(it.unit_cost || 0) * Number(it.quantity || 0)), 0) + Number(form.shipping_cost || 0);
            return (
              <div className="space-y-3">
                <div className="p-3 rounded-xl bg-white/[0.03] border border-white/[0.08]">
                  <p className="text-[10px] text-white/40 font-black uppercase">OC</p>
                  <p className="text-sm text-white font-bold">{form.po_number}</p>
                  <p className="text-[11px] text-white/50">{form.supplier_name || "Sin proveedor"}</p>
                </div>
                <div className="p-3 rounded-xl bg-emerald-500/[0.05] border border-emerald-500/20">
                  <p className="text-[10px] text-emerald-400/80 font-black uppercase">Monto a registrar</p>
                  <p className="text-2xl text-emerald-300 font-black tabular-nums">${total.toFixed(2)}</p>
                </div>
                <div>
                  <p className="text-[10px] text-white/40 font-black uppercase mb-1">Pagué con</p>
                  <select
                    value={payMethod}
                    onChange={(e) => setPayMethod(e.target.value)}
                    className="w-full bg-zinc-900 border border-white/10 rounded-lg px-3 py-2 text-sm text-white font-bold"
                  >
                    <option value="paypal">💳 PayPal</option>
                    <option value="check">🧾 Cheque</option>
                    <option value="card">💳 Tarjeta</option>
                    <option value="cash">💵 Efectivo</option>
                    <option value="transfer">🏦 Transferencia</option>
                    <option value="other">Otro</option>
                  </select>
                </div>
                <p className="text-[10px] text-white/40">
                  Esto crea un gasto en Finanzas con el monto total y el método elegido. La OC quedará marcada como pagada.
                </p>
              </div>
            );
          })()}
          <DialogFooter className="gap-2">
            <button
              onClick={() => setShowPayDialog(false)}
              disabled={processingPay}
              className="px-4 py-2 rounded-xl bg-white/[0.04] border border-white/10 text-white/60 text-xs font-bold disabled:opacity-40"
            >
              Cancelar
            </button>
            <button
              onClick={async () => {
                setProcessingPay(true);
                try {
                  const total = form.items.reduce((s, it) => s + (Number(it.unit_cost || 0) * Number(it.quantity || 0)), 0) + Number(form.shipping_cost || 0);
                  const mapPaymentMethod = (m) => {
                    switch (m) {
                      case "cash": return "cash";
                      case "card": return "card";
                      case "ath_movil": return "ath_movil";
                      case "transfer": return "transfer";
                      case "paypal": return "transfer";
                      case "check": return "transfer";
                      default: return "transfer";
                    }
                  };
                  const methodLabel = {
                    paypal: "PayPal", check: "Cheque", card: "Tarjeta",
                    cash: "Efectivo", transfer: "Transferencia", other: "Otro",
                  }[payMethod] || payMethod;
                  const itemsDesc = form.items
                    .map((it) => `${it.product_name} x${it.quantity}`)
                    .join(", ");
                  // CRÍTICO: pasar tenant_id explícito para garantizar visibilidad
                  let tenantId = null;
                  try { tenantId = localStorage.getItem("smartfix_tenant_id"); } catch { /* */ }
                  const txPayload = {
                    type: "expense",
                    category: "parts",
                    amount: Math.round(total * 100) / 100,
                    description: `OC ${form.po_number}${form.supplier_name ? ` — ${form.supplier_name}` : ""} · Pago: ${methodLabel}. ${itemsDesc}`.slice(0, 500),
                    payment_method: mapPaymentMethod(payMethod),
                    order_number: form.po_number,
                    ...(tenantId ? { tenant_id: tenantId } : {}),
                  };
                  console.log("📝 Creando Transaction (pago manual):", txPayload);
                  await base44.entities.Transaction.create(txPayload);
                  // Marcar la OC como pagada en notes
                  const newNotes = (form.notes || "").trim() + (form.notes ? "\n" : "") + `[PAID:${payMethod}]`;
                  await base44.entities.PurchaseOrder.update(purchaseOrder.id, { notes: newNotes });
                  setForm((f) => ({ ...f, notes: newNotes }));
                  toast.success(`✅ Pago de $${total.toFixed(2)} registrado en Finanzas`);
                  setShowPayDialog(false);
                  onClose?.(true);
                } catch (err) {
                  console.error("Pay error:", err);
                  toast.error("No se pudo registrar el pago: " + (err?.message || err));
                } finally {
                  setProcessingPay(false);
                }
              }}
              disabled={processingPay}
              className="px-4 py-2 rounded-xl bg-emerald-500/20 border border-emerald-500/30 text-emerald-200 text-xs font-black hover:bg-emerald-500/30 disabled:opacity-40"
            >
              {processingPay ? "Procesando..." : "Confirmar pago"}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal — Devolver al proveedor */}
      <Dialog open={showReturnDialog} onOpenChange={(v) => !v && setShowReturnDialog(false)}>
        <DialogContent className="max-w-lg bg-zinc-950 border-white/10 text-white">
          <DialogHeader>
            <DialogTitle className="text-white flex items-center gap-2">
              ↩️ Devolver al proveedor
            </DialogTitle>
          </DialogHeader>
          <p className="text-xs text-white/50">
            Marca la cantidad de cada item que estás devolviendo. El stock se decrementará automáticamente
            y se registrará un movimiento de inventario tipo "ajuste".
          </p>
          <div className="space-y-2 max-h-[40vh] overflow-y-auto pr-1">
            {form.items.map((it, idx) => (
              <div key={idx} className="flex items-center gap-2 p-2 rounded-lg bg-white/[0.03] border border-white/[0.06]">
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-white truncate">{it.product_name}</p>
                  <p className="text-[10px] text-white/40">Recibido: {it.received_quantity ?? it.quantity}</p>
                </div>
                <input
                  type="number"
                  min="0"
                  max={it.received_quantity ?? it.quantity}
                  value={returnItems[idx] || 0}
                  onChange={(e) => setReturnItems((r) => ({ ...r, [idx]: Math.min(Number(e.target.value || 0), it.received_quantity ?? it.quantity) }))}
                  className="w-16 h-8 text-center bg-white/[0.04] border border-white/10 rounded text-white text-xs"
                />
              </div>
            ))}
          </div>
          <div>
            <p className="text-[10px] text-white/40 font-black uppercase mb-1">Razón</p>
            <input
              type="text"
              value={returnReason}
              onChange={(e) => setReturnReason(e.target.value)}
              placeholder="Ej: defectuoso, equivocado, dañado..."
              className="w-full bg-white/[0.04] border border-white/10 rounded-lg px-3 py-2 text-white text-xs"
            />
          </div>
          <DialogFooter>
            <button
              onClick={() => setShowReturnDialog(false)}
              disabled={processingReturn}
              className="px-4 py-2 rounded-xl bg-white/[0.04] border border-white/10 text-white/60 text-xs font-bold"
            >
              Cancelar
            </button>
            <button
              onClick={async () => {
                const toReturn = Object.entries(returnItems).filter(([_, q]) => Number(q) > 0);
                if (toReturn.length === 0) {
                  toast.error("Marca al menos un item para devolver");
                  return;
                }
                setProcessingReturn(true);
                let ok = 0;
                const performedBy = (() => {
                  try { return JSON.parse(localStorage.getItem("employee_session") || "{}")?.name || "Sistema"; }
                  catch { return "Sistema"; }
                })();
                for (const [idxStr, qty] of toReturn) {
                  const idx = Number(idxStr);
                  const item = form.items[idx];
                  const pid = item?.product_id;
                  if (!pid) continue;
                  try {
                    const product = await base44.entities.Product.get(pid);
                    const prev = Number(product?.stock || 0);
                    const next = Math.max(0, prev - Number(qty));
                    await base44.entities.Product.update(pid, { stock: next });
                    await base44.entities.InventoryMovement.create({
                      product_id: pid,
                      product_name: product?.name || item.product_name,
                      movement_type: "adjustment",
                      quantity: -Number(qty),
                      previous_stock: prev,
                      new_stock: next,
                      reference_type: "purchase",
                      reference_id: purchaseOrder.id,
                      reference_number: form.po_number || "",
                      notes: `Devolución a proveedor (OC ${form.po_number})${returnReason ? ` · ${returnReason}` : ""}`,
                      performed_by: performedBy,
                    });
                    ok++;
                  } catch (err) {
                    console.warn("Return item error:", err);
                  }
                }
                // Añadir nota a la PO con el resumen del retorno
                try {
                  const summary = `[RETURN ${new Date().toISOString().slice(0, 10)}] ${ok} item(s)${returnReason ? ` · ${returnReason}` : ""}`;
                  const newNotes = (form.notes || "").trim() + (form.notes ? "\n" : "") + summary;
                  await base44.entities.PurchaseOrder.update(purchaseOrder.id, { notes: newNotes });
                  setForm((f) => ({ ...f, notes: newNotes }));
                } catch { /* */ }
                setProcessingReturn(false);
                setShowReturnDialog(false);
                toast.success(`Devolución registrada · ${ok} producto${ok === 1 ? "" : "s"} ajustado${ok === 1 ? "" : "s"}`);
              }}
              disabled={processingReturn}
              className="px-4 py-2 rounded-xl bg-amber-500/20 border border-amber-500/30 text-amber-200 text-xs font-black hover:bg-amber-500/30 disabled:opacity-40"
            >
              {processingReturn ? "Procesando..." : "Confirmar devolución"}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Dialog>
  );
}
