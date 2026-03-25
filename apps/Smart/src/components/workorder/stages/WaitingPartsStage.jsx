import React, { useRef, useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { ShoppingCart, ExternalLink, Package, Plus, Trash2, MapPin, Box, Truck, Shield, X, Camera, History, Pencil, Check, Minus, Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
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
import { createPageUrl } from "@/components/utils/helpers";
import SharedItemsSection from "@/components/workorder/SharedItemsSection";

export default function WaitingPartsStage({ order, onUpdate, onOrderItemsUpdate, onRemoteSaved }) {
  const o = order || {};
  const navigate = useNavigate();
  const location = o.device_location || "taller"; // taller | cliente
  const [activeModal, setActiveModal] = useState(null);
  const [links, setLinks] = useState([]);
  const itemsSectionRef = useRef(null);
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
      <section className="relative overflow-hidden rounded-[30px] border border-orange-500/15 bg-[radial-gradient(circle_at_top_left,rgba(249,115,22,0.16),transparent_28%),radial-gradient(circle_at_bottom_right,rgba(239,68,68,0.14),transparent_30%),linear-gradient(135deg,rgba(32,16,10,0.98),rgba(20,12,10,0.96))] p-4 sm:p-6 shadow-[0_22px_70px_rgba(0,0,0,0.35)]">
        <div className="absolute inset-0 bg-[linear-gradient(120deg,transparent,rgba(255,255,255,0.03),transparent)]" />
        <div className="relative z-10 space-y-4">

          {/* Encabezado */}
          <div className="flex flex-wrap items-center gap-2">
            <Badge className="rounded-full border border-orange-400/30 bg-orange-500/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.25em] text-orange-200">
              Esperando piezas
            </Badge>
            <Badge variant="outline" className="rounded-full border-white/10 bg-white/5 px-2 py-1 text-[11px] text-white/65">
              Seguimiento de pedido
            </Badge>
          </div>

          {/* Título + modelo */}
          <div className="space-y-1">
            <p className="text-[11px] font-semibold uppercase tracking-[0.32em] text-white/35">Etapa activa</p>
            <div className="flex flex-wrap items-end gap-x-3 gap-y-2">
              <h2 className="text-2xl font-black tracking-tight text-white sm:text-4xl">Esperando Repuestos</h2>
              {(o.device_brand || o.device_model) && (
                <span className="inline-flex items-center rounded-full border border-orange-400/20 bg-orange-500/10 px-3 py-1 text-sm font-semibold text-orange-200">
                  {o.device_brand} {o.device_model}
                </span>
              )}
            </div>
          </div>

          {/* Tarjetas info — siempre columna única en móvil, 3 en md+ */}
          <div className="grid gap-3 sm:grid-cols-3">
            {/* Cliente */}
            <div className="rounded-[18px] border border-white/10 bg-black/25 p-4">
              <p className="mb-1 text-[11px] font-semibold uppercase tracking-[0.24em] text-white/35">Cliente</p>
              <p className="truncate text-base font-bold text-orange-200">{o.customer_name || "No registrado"}</p>
            </div>

            {/* Ubicación */}
            <div className="rounded-[18px] border border-white/10 bg-black/25 p-4">
              <p className="mb-1 text-[11px] font-semibold uppercase tracking-[0.24em] text-white/35">Ubicación del equipo</p>
              <p className="text-sm font-semibold text-white/75">{location === "taller" ? "🏢 En Taller" : "👤 Con Cliente"}</p>
              <p className="mt-1 text-xs text-white/45 leading-snug">{location === "taller" ? "Listo para montar la pieza." : "Pendiente a que el cliente entregue el equipo."}</p>
            </div>

            {/* Detalles del pedido */}
            <div className="rounded-[18px] border border-white/10 bg-black/25 p-4">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <p className="mb-1 text-[11px] font-semibold uppercase tracking-[0.24em] text-white/35">Detalles del pedido</p>
                  <p className="truncate text-sm font-semibold text-white/75">{displayPartName}</p>
                  <p className="mt-1 text-xs text-white/45 truncate">{displaySupplier} · {displayCarrier} · {displayTracking}</p>
                  {/* Links de compra si existen */}
                  {links.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1">
                      {links.slice(0, 3).map((link, i) => (
                        <a
                          key={i}
                          href={link.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 rounded-lg border border-orange-400/20 bg-orange-500/10 px-2 py-0.5 text-[10px] font-semibold text-orange-300 hover:bg-orange-500/20"
                        >
                          <ExternalLink className="w-2.5 h-2.5" />
                          {link.partName || new URL(link.url).hostname.replace("www.", "")}
                        </a>
                      ))}
                    </div>
                  )}
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="flex-shrink-0 h-8 w-8 rounded-lg text-white/55 hover:bg-white/10 hover:text-white"
                  onClick={() => setEditingDetails(!editingDetails)}
                  title={editingDetails ? "Cancelar edición" : "Editar información"}
                >
                  {editingDetails ? <X className="w-4 h-4" /> : <Pencil className="w-4 h-4" />}
                </Button>
              </div>
            </div>
          </div>

          {/* Siguiente paso — fila en móvil */}
          <div className="rounded-[22px] border border-orange-400/15 bg-black/25 p-4">
            <div className="flex items-center gap-3">
              <div className="flex-shrink-0 flex h-10 w-10 items-center justify-center rounded-2xl border border-orange-400/20 bg-orange-500/15">
                <Truck className="h-4 w-4 text-orange-300" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[10px] font-semibold uppercase tracking-[0.28em] text-white/35">Siguiente paso</p>
                <h3 className="text-base font-black tracking-tight text-white">Monitorear llegada</h3>
              </div>
              {/* Botón añadir piezas — hace scroll al section */}
              <Button
                onClick={() => itemsSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" })}
                className="flex-shrink-0 rounded-2xl bg-gradient-to-r from-cyan-600 to-emerald-600 px-3 py-2 text-white text-sm shadow-lg hover:from-cyan-700 hover:to-emerald-700"
              >
                <Plus className="h-4 w-4 sm:mr-2" />
                <span className="hidden sm:inline">Añadir piezas</span>
              </Button>
            </div>
            {/* Tracking link directo si hay tracking */}
            {trackingUrl && displayTracking !== "—" && (
              <a
                href={trackingUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-3 flex items-center gap-2 rounded-xl border border-orange-400/20 bg-orange-500/10 px-3 py-2 text-sm text-orange-300 hover:bg-orange-500/20"
              >
                <Truck className="w-4 h-4 flex-shrink-0" />
                <span className="truncate font-medium">Rastrear: {displayTracking}</span>
                <ExternalLink className="w-3.5 h-3.5 flex-shrink-0 ml-auto" />
              </a>
            )}
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

      <div ref={itemsSectionRef}>
        <SharedItemsSection
          order={o}
          onUpdate={onUpdate}
          onOrderItemsUpdate={onOrderItemsUpdate}
          onRemoteSaved={onRemoteSaved}
          accentColor="orange"
          subtitle="Mantén aquí la lista final de repuestos y servicios mientras el pedido está en tránsito."
        />
      </div>

      <WorkOrderUnifiedHub order={order} onUpdate={onUpdate} accent="amber" title="Centro de Historial" subtitle="Pedido, fotos, seguridad y notas operativas consolidadas en una sola pieza." />

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
