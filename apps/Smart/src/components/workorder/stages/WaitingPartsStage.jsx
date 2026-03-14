import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { ShoppingCart, ExternalLink, Package, Plus, Trash2, MapPin, Box, Truck, Shield, X, Camera, History, Pencil, Check, Minus, Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import AddItemModal from "@/components/workorder/AddItemModal";
import WorkOrderTimeline from "@/components/orders/workorder/WorkOrderTimeline";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import OrderSecurity from "@/components/workorder/sections/OrderSecurity";
import OrderMultimedia from "@/components/workorder/sections/OrderMultimedia";
import OrderNotes from "@/components/workorder/sections/OrderNotes";
import { base44 } from "@/api/base44Client";
import { loadSuppliersSafe } from "@/components/utils/suppliers";
import WorkOrderUnifiedHub from "@/components/workorder/WorkOrderUnifiedHub";
import { loadOrderLinks } from "@/components/workorder/utils/orderLinksStore";

export default function WaitingPartsStage({ order, onUpdate }) {
  const o = order || {};
  const navigate = useNavigate();
  const location = o.device_location || "taller"; // taller | cliente
  const [activeModal, setActiveModal] = useState(null);
  const [links, setLinks] = useState([]);
  const [editingDetails, setEditingDetails] = useState(false);
  const [suppliers, setSuppliers] = useState([]);
  const [loadingSuppliers, setLoadingSuppliers] = useState(false);
  const [editForm, setEditForm] = useState({
    partName: "",
    supplier: "",
    carrier: "",
    tracking: ""
  });

  // Items management
  const [items, setItems] = useState([]);
  const [showAddItemModal, setShowAddItemModal] = useState(false);
  const [isEditingItems, setIsEditingItems] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (order?.id) {
      loadLinks();
      loadSuppliers();
    }
  }, [order?.id]);

  const loadSuppliers = async () => {
    setLoadingSuppliers(true);
    try {
      const data = await loadSuppliersSafe();
      setSuppliers(data || []);
    } catch (error) {
      console.error("Error loading suppliers:", error);
    } finally {
      setLoadingSuppliers(false);
    }
  };

  useEffect(() => {
    setItems(Array.isArray(o.order_items) ? o.order_items.map(item => ({
      ...item,
      discount_percentage: item.discount_percentage || 0,
      taxable: item.taxable !== undefined ? item.taxable : true
    })) : []);
  }, [o.order_items, o.id]);

  const loadLinks = async () => {
    if (!order?.id) return;
    try {
      const result = await loadOrderLinks(order);
      setLinks(Array.isArray(result?.links) ? result.links : []);
    } catch (e) {
      console.error(e);
      setLinks([]);
    }
  };

  // Tracking link generator
  const getTrackingUrl = (trackingNumber) => {
    if (!trackingNumber || trackingNumber === "—") return null;
    
    const t = trackingNumber.trim().toUpperCase();
    
    // Heuristics
    if (t.startsWith("1Z") || (t.length === 12 && /^[0-9]+$/.test(t))) {
      return `https://www.ups.com/track?tracknum=${t}`;
    }
    if (t.length === 12 || t.length === 15 || t.length === 20 || t.length === 22 || t.length === 34) {
      if (/^[0-9]+$/.test(t)) {
        // Could be FedEx or USPS. FedEx ground often 15 digits.
        if (t.length === 12 || t.length === 15) return `https://www.fedex.com/fedextrack/?trknbr=${t}`;
        return `https://tools.usps.com/go/TrackConfirmAction?tLabels=${t}`;
      }
    }
    if (t.startsWith("9")) {
      return `https://tools.usps.com/go/TrackConfirmAction?tLabels=${t}`;
    }
    if (t.length === 10 && /^[0-9]+$/.test(t)) {
      return `https://www.dhl.com/en/express/tracking.html?AWB=${t}`;
    }

    // Default to Google if structure unknown
    return `https://www.google.com/search?q=${t}`;
  };

  const latestLink = links.length > 0 ? links[0] : null;
  const groupedLinkNames = links.reduce((acc, link) => {
    const name = String(link?.partName || "").trim();
    if (!name) return acc;
    acc[name] = (acc[name] || 0) + 1;
    return acc;
  }, {});
  const groupedLinkList = Object.entries(groupedLinkNames);
  const displayPartName =
    o.part_name ||
    groupedLinkList.map(([name, count]) => (count > 1 ? `${name} (${count})` : name)).join(", ") ||
    "—";
  const displaySupplier = o.parts_supplier || (() => {
    const fallbackUrl = latestLink?.url || "";
    if (!fallbackUrl) return "—";
    try {
      return new URL(fallbackUrl).hostname.replace("www.", "");
    } catch {
      return "—";
    }
  })();
  const displayCarrier = o.parts_carrier || "—";
  
  const displayTracking = o.parts_tracking || "—";
  const trackingUrl = getTrackingUrl(displayTracking);

  useEffect(() => {
    if (editingDetails) {
      setEditForm({
        partName: o.part_name || groupedLinkList.map(([name]) => name).join(", ") || "",
        supplier: o.parts_supplier || "",
        carrier: o.parts_carrier || "",
        tracking: o.parts_tracking || ""
      });
    }
  }, [editingDetails, o.part_name, o.parts_supplier, o.parts_carrier, o.parts_tracking, groupedLinkList]);

  const handleSaveDetails = async () => {
    try {
      const updatedOrder = await base44.entities.Order.update(order.id, {
        part_name: editForm.partName.trim(),
        parts_supplier: editForm.supplier.trim(),
        parts_carrier: editForm.carrier.trim(),
        parts_tracking: editForm.tracking.trim()
      });

      let me = null;
      try { me = await base44.auth.me(); } catch (authError) { console.warn("Auth no disponible:", authError); }

      await base44.entities.WorkOrderEvent.create({
        order_id: order.id,
        order_number: order.order_number,
        event_type: "parts_info",
        description: `Detalles de pedido actualizados: ${editForm.partName || "—"} | ${editForm.supplier || "—"} | ${editForm.carrier || "—"} | ${editForm.tracking || "—"}`,
        user_name: me?.full_name || me?.email || "Sistema",
        user_id: me?.id || null,
        metadata: { 
          partName: editForm.partName,
          supplier: editForm.supplier,
          carrier: editForm.carrier,
          tracking: editForm.tracking
        }
      });

      setEditingDetails(false);
      toast.success("Detalles actualizados");
      if (onUpdate) onUpdate(updatedOrder);
    } catch (error) {
      console.error("Error updating details:", error);
      toast.error("Error al actualizar");
    }
  };

  // Items functions
  const calculateItemSubtotal = (item) => {
    const basePrice = Number(item.price || 0) * Number(item.qty || 1);
    const discount = basePrice * (Number(item.discount_percentage || 0) / 100);
    return basePrice - discount;
  };

  const calculateTotals = () => {
    const itemsSubtotal = items.reduce((sum, item) => sum + calculateItemSubtotal(item), 0);
    const taxableSubtotal = items.reduce((sum, item) => {
      if (item.taxable) {
        return sum + calculateItemSubtotal(item);
      }
      return sum;
    }, 0);
    const taxAmount = taxableSubtotal * 0.115;
    const total = itemsSubtotal + taxAmount;
    return { itemsSubtotal, taxAmount, total };
  };

  const { itemsSubtotal, taxAmount, total } = calculateTotals();
  const amountPaid = Number(o.total_paid || o.amount_paid || 0);
  const balanceDue = Math.max(0, total - amountPaid);

  const setQty = (idx, qty) => {
    const next = [...items];
    next[idx].qty = Math.max(1, Number(qty));
    setItems(next);
  };

  const setDiscount = (idx, discount) => {
    const next = [...items];
    next[idx].discount_percentage = Math.max(0, Math.min(100, Number(discount)));
    setItems(next);
  };

  const toggleTaxable = (idx) => {
    const next = [...items];
    next[idx].taxable = !next[idx].taxable;
    setItems(next);
  };

  const removeLine = (idx) => {
    const next = items.filter((_, i) => i !== idx);
    setItems(next);
  };

  const persistItems = async (itemsToSave = items) => {
    setSaving(true);
    try {
      const itemsWithTotal = itemsToSave.map((it) => ({
        ...it,
        discount_percentage: Number(it.discount_percentage || 0),
        taxable: it.taxable !== undefined ? it.taxable : true,
        total: calculateItemSubtotal(it)
      }));

      const subtotal = itemsWithTotal.reduce((s, it) => s + (it.total || 0), 0);
      const taxableTotal = itemsWithTotal.reduce((s, it) => {
        if (it.taxable) return s + (it.total || 0);
        return s;
      }, 0);
      const tax = taxableTotal * 0.115;
      const newTotal = subtotal + tax;

      const currentPaid = Number(o.total_paid || o.amount_paid || 0);
      const newBalance = Math.max(0, newTotal - currentPaid);

      const updatedOrder = await base44.entities.Order.update(o.id, {
        order_items: itemsWithTotal,
        total: newTotal,
        cost_estimate: newTotal,
        balance_due: newBalance,
        tax_rate: 0.115
      });

      setItems(itemsWithTotal);
      setIsEditingItems(false);
      toast.success("Items actualizados");
      if (onUpdate) onUpdate(updatedOrder);
    } catch (e) {
      console.error(e);
      toast.error("Error al guardar items");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <section className="relative overflow-hidden rounded-[30px] border border-orange-500/15 bg-[radial-gradient(circle_at_top_left,rgba(249,115,22,0.16),transparent_28%),radial-gradient(circle_at_bottom_right,rgba(239,68,68,0.14),transparent_30%),linear-gradient(135deg,rgba(32,16,10,0.98),rgba(20,12,10,0.96))] p-5 shadow-[0_22px_70px_rgba(0,0,0,0.35)] sm:p-6">
        <div className="absolute inset-0 bg-[linear-gradient(120deg,transparent,rgba(255,255,255,0.03),transparent)]" />
        <div className="relative z-10 grid gap-5 xl:grid-cols-[1.2fr_0.8fr] xl:items-start">
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-2">
              <Badge className="rounded-full border border-orange-400/30 bg-orange-500/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.25em] text-orange-200">
                Esperando piezas
              </Badge>
              <Badge variant="outline" className="rounded-full border-white/10 bg-white/5 px-3 py-1 text-xs text-white/65">
                Seguimiento de pedido
              </Badge>
            </div>

            <div className="space-y-2">
              <p className="text-[11px] font-semibold uppercase tracking-[0.32em] text-white/35">Etapa activa</p>
              <div className="flex flex-wrap items-end gap-x-4 gap-y-2">
                <h2 className="text-3xl font-black tracking-tight text-white sm:text-4xl">Esperando Repuestos</h2>
                <div className="inline-flex items-center rounded-full border border-orange-400/20 bg-orange-500/10 px-3 py-1 text-sm font-semibold text-orange-200">
                  {o.device_brand} {o.device_model}
                </div>
              </div>
              <p className="max-w-2xl text-sm leading-relaxed text-white/55">
                Esta etapa debe dejar claro dónde está el equipo, qué pedido está en tránsito y cuánto impacta en el total de la orden.
              </p>
            </div>

            <div className="grid gap-3 md:grid-cols-3">
              <div className="rounded-[22px] border border-white/10 bg-black/25 p-4 backdrop-blur-md">
                <p className="mb-1 text-[11px] font-semibold uppercase tracking-[0.24em] text-white/35">Cliente</p>
                <p className="truncate text-lg font-bold text-orange-200">{o.customer_name || "No registrado"}</p>
              </div>
              <div className="rounded-[22px] border border-white/10 bg-black/25 p-4 backdrop-blur-md">
                <p className="mb-1 text-[11px] font-semibold uppercase tracking-[0.24em] text-white/35">Ubicación del equipo</p>
                <p className="truncate text-sm font-semibold text-white/75">{location === "taller" ? "En Taller" : "Con Cliente"}</p>
                <p className="mt-1 text-xs text-white/45">{location === "taller" ? "Listo para montar la pieza." : "Pendiente a que el cliente entregue el equipo."}</p>
              </div>
              <div className="rounded-[22px] border border-white/10 bg-black/25 p-4 backdrop-blur-md">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="mb-1 text-[11px] font-semibold uppercase tracking-[0.24em] text-white/35">Detalles del pedido</p>
                    <p className="truncate text-sm font-semibold text-white/75">{displayPartName}</p>
                    <p className="mt-1 text-xs text-white/45">{displaySupplier} · {displayCarrier} · {displayTracking}</p>
                  </div>
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    className="h-8 w-8 rounded-lg text-white/55 hover:bg-white/10 hover:text-white"
                    onClick={() => setEditingDetails(!editingDetails)}
                    title={editingDetails ? "Cancelar edición" : "Editar información"}
                  >
                    {editingDetails ? <X className="w-4 h-4" /> : <Pencil className="w-4 h-4" />}
                  </Button>
                </div>
              </div>
            </div>
          </div>

          <div className="rounded-[26px] border border-orange-400/15 bg-black/25 p-5 backdrop-blur-md">
            <div className="flex items-start gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-orange-400/20 bg-orange-500/15">
                <Truck className="h-5 w-5 text-orange-300" />
              </div>
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-white/35">Siguiente paso</p>
                <h3 className="mt-1 text-xl font-black tracking-tight text-white">Monitorear llegada</h3>
                <p className="mt-2 text-sm leading-relaxed text-white/55">
                  Actualiza tracking, suplidor y costos en una sola vista sin sacrificar la claridad de la orden.
                </p>
                <div className="mt-4 flex flex-wrap gap-2">
                  <Button
                    onClick={() => setShowAddItemModal(true)}
                    className="rounded-2xl bg-gradient-to-r from-cyan-600 to-emerald-600 px-4 text-white shadow-lg shadow-cyan-950/20 hover:from-cyan-700 hover:to-emerald-700"
                  >
                    <Plus className="mr-2 h-4 w-4" />
                    Añadir piezas
                  </Button>
                  <div className="inline-flex items-center rounded-2xl border border-white/10 bg-white/5 px-4 py-2 text-sm text-white/55">
                    Los links ya se agregan automáticamente a items manuales.
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {editingDetails && (
        <div className="overflow-hidden rounded-[28px] border border-cyan-500/15 bg-[linear-gradient(180deg,rgba(255,255,255,0.05),rgba(255,255,255,0.02))] shadow-[0_18px_50px_rgba(0,0,0,0.28)]">
          <div className="border-b border-white/10 bg-gradient-to-r from-cyan-500/10 to-transparent p-5">
            <div className="flex items-center justify-between">
              <h3 className="text-white font-bold text-sm uppercase tracking-wider flex items-center gap-2">
                <Truck className="w-4 h-4 text-cyan-300" />
                Detalles del Pedido
              </h3>
            </div>
          </div>
          <div className="p-6 space-y-5">
            {(
              <>
                <div>
                  <p className="text-xs text-gray-400 uppercase font-bold tracking-wider mb-2">Pieza Solicitada</p>
                  <Input
                    value={editForm.partName}
                    onChange={(e) => setEditForm(prev => ({ ...prev, partName: e.target.value }))}
                    placeholder="Nombre de la pieza..."
                    className="bg-black/40 border-white/15 text-white h-10"
                    autoComplete="off"
                  />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div>
                    <p className="text-xs text-gray-400 uppercase font-bold tracking-wider mb-2">Suplidor</p>
                    {loadingSuppliers ? (
                      <div className="flex items-center justify-center h-10 bg-black/40 rounded-md border border-white/15">
                        <Loader2 className="w-4 h-4 animate-spin text-white/60" />
                      </div>
                    ) : (
                      <Select 
                        value={editForm.supplier} 
                        onValueChange={(value) => setEditForm(prev => ({ ...prev, supplier: value }))}
                      >
                        <SelectTrigger className="bg-black/40 border-white/15 text-white h-10">
                          <SelectValue placeholder="Seleccionar suplidor" />
                        </SelectTrigger>
                        <SelectContent>
                          {suppliers.map((s) => (
                            <SelectItem key={s.id} value={s.name}>
                              {s.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  </div>
                  <div>
                    <p className="text-xs text-gray-400 uppercase font-bold tracking-wider mb-2">Envío</p>
                    <select
                      value={editForm.carrier}
                      onChange={(e) => setEditForm(prev => ({ ...prev, carrier: e.target.value }))}
                      className="w-full h-10 px-3 rounded-md bg-black/40 border border-white/15 text-white"
                    >
                      <option value="">Seleccionar...</option>
                      <option value="USPS">USPS</option>
                      <option value="FedEx">FedEx</option>
                      <option value="UPS">UPS</option>
                      <option value="DHL">DHL</option>
                      <option value="Amazon">Amazon Logistics</option>
                      <option value="Otro">Otro</option>
                    </select>
                  </div>
                  <div>
                    <p className="text-xs text-gray-400 uppercase font-bold tracking-wider mb-2">Tracking</p>
                    <Input
                      value={editForm.tracking}
                      onChange={(e) => setEditForm(prev => ({ ...prev, tracking: e.target.value }))}
                      placeholder="1Z999AA..."
                      className="bg-black/40 border-white/15 text-white h-10"
                      autoComplete="off"
                    />
                  </div>
                </div>
                <div className="flex justify-end gap-2 pt-3 border-t border-white/10">
                  <Button 
                    variant="outline"
                    onClick={() => setEditingDetails(false)}
                    className="border-white/15"
                  >
                    Cancelar
                  </Button>
                  <Button 
                    onClick={handleSaveDetails}
                    className="bg-gradient-to-r from-cyan-600 to-emerald-600 hover:from-cyan-700 hover:to-emerald-700"
                  >
                    <Check className="w-4 h-4 mr-2" />
                    Guardar
                  </Button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Piezas y Servicios Module */}
      <section className="relative overflow-hidden rounded-[30px] border border-orange-500/15 bg-[radial-gradient(circle_at_top_left,rgba(249,115,22,0.10),transparent_24%),radial-gradient(circle_at_bottom_right,rgba(20,184,166,0.10),transparent_28%),linear-gradient(180deg,rgba(24,24,27,0.98),rgba(10,10,12,0.98))] shadow-[0_22px_70px_rgba(0,0,0,0.35)]">
        <div className="absolute inset-0 bg-[linear-gradient(120deg,transparent,rgba(255,255,255,0.025),transparent)]" />
        <div className="relative z-10 border-b border-white/10 px-6 py-5">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-start gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-cyan-400/20 bg-cyan-500/15 shadow-[0_10px_30px_rgba(34,211,238,0.12)]">
                <ShoppingCart className="h-5 w-5 text-cyan-300" />
              </div>
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-white/35">Compra y costo</p>
                <h3 className="mt-1 text-2xl font-black tracking-tight text-white">Piezas y Servicios</h3>
                <p className="mt-2 max-w-2xl text-sm leading-relaxed text-white/55">
                  Mantén aquí la lista final de repuestos y servicios mientras el pedido está en tránsito, con edición rápida y total visible.
                </p>
              </div>
            </div>
            <div className="flex gap-3">
              {items.length > 0 && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => isEditingItems ? persistItems() : setIsEditingItems(true)}
                  disabled={saving}
                  className="h-10 rounded-2xl border-white/10 bg-white/5 px-4 text-sm font-medium text-white hover:bg-white/10"
                >
                  {isEditingItems ? <Check className="mr-2 h-4 w-4" /> : <Pencil className="mr-2 h-4 w-4" />}
                  {isEditingItems ? "Guardar" : "Editar"}
                </Button>
              )}
              <Button
                size="sm"
                onClick={() => setShowAddItemModal(true)}
                disabled={saving}
                className="h-10 rounded-2xl bg-gradient-to-r from-cyan-600 to-emerald-600 px-4 text-sm font-bold text-white shadow-lg shadow-cyan-950/20 hover:from-cyan-700 hover:to-emerald-700"
              >
                <Plus className="mr-2 h-4 w-4" />
                Añadir
              </Button>
            </div>
          </div>
        </div>
        
        <div className="relative z-10 p-6">
          {items.length === 0 ? (
            <div className="rounded-[24px] border border-dashed border-white/10 bg-black/20 px-6 py-14 text-center">
              <ShoppingCart className="mx-auto mb-4 h-12 w-12 text-white/20" />
              <p className="text-base font-semibold text-white/55">No hay items en esta orden.</p>
              <p className="mt-2 text-sm text-white/35">Añade las piezas o servicios que quedan pendientes de llegada y mantén el total visible.</p>
              <Button 
                onClick={() => setShowAddItemModal(true)}
                variant="outline"
                className="mt-5 rounded-2xl border-cyan-500/30 px-4 text-cyan-300 hover:bg-cyan-500/10"
              >
                <Plus className="mr-2 h-4 w-4" />
                Añadir Item
              </Button>
            </div>
          ) : (
            <div className="overflow-hidden rounded-[24px] border border-white/10 bg-black/20">
              <div className="divide-y divide-white/5">
                {items.map((item, idx) => (
                  <div key={idx} className="px-6 py-5 transition-colors hover:bg-white/[0.03]">
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-xl font-black tracking-tight text-white">{item.name}</p>
                        <p className="mt-2 text-sm text-white/45">
                          {item.type === 'service' ? 'Servicio incluido mientras la orden espera repuestos.' : 'Producto incluido mientras la orden espera repuestos.'}
                        </p>
                        <div className="mt-4 flex flex-wrap gap-2">
                          <Badge variant="outline" className="rounded-full border-white/10 bg-white/5 px-3 py-1 text-[11px] text-gray-300">
                            ${Number(item.price).toFixed(2)} c/u
                          </Badge>
                          <Badge variant="outline" className="rounded-full border-white/10 bg-white/5 px-3 py-1 text-[11px] text-gray-300">
                            {item.type === 'service' ? 'Servicio' : 'Producto'}
                          </Badge>
                          {item.discount_percentage > 0 && (
                            <Badge className="rounded-full border-orange-500/30 bg-orange-500/20 px-3 py-1 text-[11px] text-orange-300">
                              -{item.discount_percentage}% desc.
                            </Badge>
                          )}
                          {!item.taxable && (
                            <Badge className="rounded-full border-purple-500/30 bg-purple-500/20 px-3 py-1 text-[11px] text-purple-300">
                              Sin IVU
                            </Badge>
                          )}
                        </div>

                        {isEditingItems && (
                          <div className="mt-4 space-y-3">
                            <div className="flex flex-wrap items-center gap-3">
                              <div className="flex items-center gap-2">
                                <Label className="min-w-[80px] text-xs text-gray-400">Descuento %:</Label>
                                <div className="flex items-center gap-1 rounded-xl border border-white/10 bg-black/40 p-1">
                                  <Button 
                                    size="icon" 
                                    variant="ghost" 
                                    className="h-7 w-7 rounded-md hover:bg-white/10 hover:text-white" 
                                    onClick={() => setDiscount(idx, (item.discount_percentage || 0) - 5)}
                                  >
                                    <Minus className="h-3 w-3" />
                                  </Button>
                                  <Input 
                                    type="number"
                                    value={item.discount_percentage || 0}
                                    onChange={(e) => setDiscount(idx, e.target.value)}
                                    className="h-7 w-16 border-0 bg-transparent text-center text-sm text-white"
                                    min="0"
                                    max="100"
                                  />
                                  <Button 
                                    size="icon" 
                                    variant="ghost" 
                                    className="h-7 w-7 rounded-md hover:bg-white/10 hover:text-white" 
                                    onClick={() => setDiscount(idx, (item.discount_percentage || 0) + 5)}
                                  >
                                    <Plus className="h-3 w-3" />
                                  </Button>
                                </div>
                              </div>
                              
                              <div className="ml-0 flex items-center gap-2 sm:ml-4">
                                <Switch 
                                  id={`tax-${idx}`}
                                  checked={item.taxable}
                                  onCheckedChange={() => toggleTaxable(idx)}
                                  className="data-[state=checked]:bg-emerald-500"
                                />
                                <Label htmlFor={`tax-${idx}`} className="cursor-pointer text-xs text-gray-400">
                                  Aplicar IVU
                                </Label>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                      
                      <div className="flex items-center gap-4 pl-4">
                        {isEditingItems ? (
                          <>
                            <div className="flex items-center gap-1 rounded-xl border border-white/10 bg-black/40 p-1">
                              <Button 
                                size="icon" 
                                variant="ghost" 
                                className="h-8 w-8 rounded-md hover:bg-white/10 hover:text-white" 
                                onClick={() => setQty(idx, item.qty - 1)}
                              >
                                <Minus className="h-3 w-3" />
                              </Button>
                              <span className="w-8 text-center text-sm font-bold text-white">{item.qty}</span>
                              <Button 
                                size="icon" 
                                variant="ghost" 
                                className="h-8 w-8 rounded-md hover:bg-white/10 hover:text-white" 
                                onClick={() => setQty(idx, item.qty + 1)}
                              >
                                <Plus className="h-3 w-3" />
                              </Button>
                            </div>
                            <Button 
                              size="icon" 
                              variant="ghost" 
                              className="h-9 w-9 rounded-lg text-red-400 hover:bg-red-500/10 hover:text-red-300" 
                              onClick={() => removeLine(idx)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </>
                        ) : (
                          <div className="text-right">
                            <div className="inline-flex items-center rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-semibold text-white/70">
                              x{item.qty}
                            </div>
                            <p className="mt-3 text-3xl font-black tracking-tight text-emerald-300">
                              ${calculateItemSubtotal(item).toFixed(2)}
                            </p>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              
              <div className="grid gap-4 border-t border-white/10 bg-black/35 p-5 lg:grid-cols-[1fr_360px]">
                <div className="space-y-3">
                  <div className="rounded-[20px] border border-white/8 bg-black/20 px-5 py-4">
                    <div className="flex items-center justify-between text-sm">
                      <span className="font-medium text-gray-400">Subtotal</span>
                      <span className="text-xl font-black tracking-tight text-white">${itemsSubtotal.toFixed(2)}</span>
                    </div>
                  </div>
                  <div className="rounded-[20px] border border-white/8 bg-black/20 px-5 py-4">
                    <div className="flex items-center justify-between text-sm">
                      <span className="font-medium text-gray-400">IVU (11.5%)</span>
                      <span className="text-xl font-black tracking-tight text-white">${taxAmount.toFixed(2)}</span>
                    </div>
                  </div>
                  <div className="rounded-[20px] border border-emerald-500/15 bg-emerald-500/10 px-5 py-4">
                    <div className="flex items-center justify-between">
                      <span className="text-base font-bold text-white">Total</span>
                      <span className="text-3xl font-black tracking-tight text-white">${total.toFixed(2)}</span>
                    </div>
                  </div>
                </div>

                <div className="rounded-[24px] border border-orange-500/15 bg-[linear-gradient(180deg,rgba(249,115,22,0.08),rgba(0,0,0,0.18))] p-5">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-white/35">Acciones de cobro</p>
                  <h4 className="mt-2 text-2xl font-black tracking-tight text-white">
                    {balanceDue > 0.01 ? "Cierra el pedido pendiente" : "Orden saldada"}
                  </h4>
                  <p className="mt-2 text-sm leading-relaxed text-white/55">
                    {balanceDue > 0.01
                      ? "Si el repuesto ya impacta el total, puedes registrar depósito o cobrar el restante sin salir del flujo."
                      : "No hay cobro adicional pendiente. La orden ya está lista en términos económicos."}
                  </p>
                  {amountPaid > 0 && (
                    <div className="mt-4 rounded-[18px] border border-emerald-500/15 bg-emerald-500/10 px-4 py-3">
                      <div className="flex items-center justify-between text-sm">
                        <span className="font-medium text-emerald-100/80">Pagado / Depósito</span>
                        <span className="font-bold text-emerald-300">-${amountPaid.toFixed(2)}</span>
                      </div>
                      <div className="mt-3 flex items-center justify-between border-t border-emerald-400/10 pt-3">
                        <span className="font-semibold text-white">Balance pendiente</span>
                        <span className={`text-2xl font-black tracking-tight ${balanceDue <= 0.01 ? 'text-emerald-300' : 'text-white'}`}>
                          ${balanceDue.toFixed(2)}
                        </span>
                      </div>
                    </div>
                  )}
                  {balanceDue > 0.01 ? (
                    <div className="mt-5 grid grid-cols-1 gap-4">
                      <Button
                        variant="outline"
                        className="h-12 rounded-2xl border-emerald-500/30 text-emerald-300 hover:bg-emerald-500/10"
                        onClick={() => {
                          window.dispatchEvent(new Event('close-workorder-panel'));
                          navigate(`/POS?workOrderId=${o.id}&mode=deposit`);
                        }}
                      >
                        Depósito
                      </Button>
                      <Button
                        className="h-12 rounded-2xl bg-emerald-600 text-white shadow-lg shadow-emerald-900/20 hover:bg-emerald-500"
                        onClick={() => {
                          window.dispatchEvent(new Event('close-workorder-panel'));
                          navigate(`/POS?workOrderId=${o.id}&mode=full`);
                        }}
                      >
                        Cobrar Restante
                      </Button>
                    </div>
                  ) : (
                    <div className="mt-5 rounded-[18px] border border-emerald-500/20 bg-emerald-500/10 p-4 text-center">
                      <p className="text-lg font-bold text-emerald-400">Orden Saldada</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </section>

      <WorkOrderUnifiedHub order={order} onUpdate={onUpdate} accent="amber" title="Centro de Historial" subtitle="Pedido, fotos, seguridad y notas operativas consolidadas en una sola pieza." />

      <AddItemModal
        open={showAddItemModal}
        onClose={() => setShowAddItemModal(false)}
        order={o}
        onUpdate={onUpdate}
      />

      <Dialog open={activeModal === 'notes'} onOpenChange={() => setActiveModal(null)}>
        <DialogContent className="max-w-3xl bg-gradient-to-br from-[#0a0a0a] to-black border border-white/10 p-0 z-[9999] overflow-hidden shadow-2xl">
          <button 
            onClick={() => setActiveModal(null)}
            className="absolute right-5 top-5 z-[10000] w-11 h-11 rounded-full bg-gradient-to-br from-white/10 to-white/5 hover:from-white/20 hover:to-white/10 backdrop-blur-xl border border-white/20 hover:border-white/30 text-white/70 hover:text-white flex items-center justify-center transition-all duration-300 active:scale-95 shadow-[0_8px_32px_rgba(0,0,0,0.4)] hover:shadow-[0_8px_32px_rgba(255,255,255,0.15)] group"
          >
            <X className="w-5 h-5 transition-transform group-hover:rotate-90 duration-300" />
          </button>
          <div className="p-6 pt-20"><OrderNotes order={order} onUpdate={onUpdate} /></div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
