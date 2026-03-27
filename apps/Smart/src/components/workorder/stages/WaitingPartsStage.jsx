import React, { useRef, useState, useEffect } from "react";
import { ExternalLink, Plus, MapPin, Box, Truck, X, Pencil, Check, Loader2, PhoneCall, MessageCircle, Mail, ShoppingCart, Package, CheckCircle2, Clock } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { base44 } from "@/api/base44Client";
import { loadSuppliersSafe } from "@/components/utils/suppliers";
import WorkOrderUnifiedHub from "@/components/workorder/WorkOrderUnifiedHub";
import { loadOrderLinks } from "@/components/workorder/utils/orderLinksStore";
import SharedItemsSection from "@/components/workorder/SharedItemsSection";

// ── Etapas del recorrido de la pieza ────────────────────────────────────────
const TRACKING_STAGES = [
  { key: "ordered",    label: "Pedido",      emoji: "🛒", desc: "Orden colocada al proveedor"       },
  { key: "confirmed",  label: "Confirmado",  emoji: "📦", desc: "Proveedor confirmó disponibilidad" },
  { key: "shipped",    label: "Enviado",     emoji: "🚚", desc: "La pieza salió del almacén"        },
  { key: "in_transit", label: "En Tránsito", emoji: "🗺️", desc: "En camino hacia destino"           },
  { key: "arrived",    label: "En Destino",  emoji: "📍", desc: "Llegó a la oficina local"          },
  { key: "received",   label: "Recibido",    emoji: "✅", desc: "Pieza en el taller"                },
];

const STAGE_IDX = Object.fromEntries(TRACKING_STAGES.map((s, i) => [s.key, i]));

export default function WaitingPartsStage({ order, onUpdate, onOrderItemsUpdate, onRemoteSaved, onPaymentClick }) {
  const o = order || {};
  const location = o.device_location || "taller";
  const itemsSectionRef = useRef(null);

  const [editingDetails, setEditingDetails] = useState(false);
  const [suppliers, setSuppliers] = useState([]);
  const [loadingSuppliers, setLoadingSuppliers] = useState(false);
  const [links, setLinks] = useState([]);
  const [trackingEvents, setTrackingEvents] = useState([]);
  const [savingStage, setSavingStage] = useState(false);

  const [editForm, setEditForm] = useState({
    partName: "", supplier: "", carrier: "", tracking: ""
  });

  useEffect(() => {
    if (order?.id) {
      loadLinks();
      loadSuppliers();
      loadTrackingEvents();
    }
  }, [order?.id]);

  const loadSuppliers = async () => {
    setLoadingSuppliers(true);
    try { setSuppliers((await loadSuppliersSafe()) || []); }
    catch { /* silent */ }
    finally { setLoadingSuppliers(false); }
  };

  const loadLinks = async () => {
    if (!order?.id) return;
    try {
      const result = await loadOrderLinks(order);
      setLinks(Array.isArray(result?.links) ? result.links : []);
    } catch { setLinks([]); }
  };

  const loadTrackingEvents = async () => {
    if (!order?.id) return;
    try {
      const events = await base44.entities.WorkOrderEvent.filter({
        order_id: order.id,
        event_type: "parts_tracking"
      });
      setTrackingEvents(Array.isArray(events) ? events.sort((a, b) => new Date(b.created_at) - new Date(a.created_at)) : []);
    } catch { setTrackingEvents([]); }
  };

  // ── Tracking URL heurístico ─────────────────────────────────────────────
  const getTrackingUrl = (trackingNumber) => {
    if (!trackingNumber || trackingNumber === "—") return null;
    const t = trackingNumber.trim().toUpperCase();
    if (t.startsWith("1Z")) return `https://www.ups.com/track?tracknum=${t}`;
    if (t.startsWith("9") && t.length >= 20) return `https://tools.usps.com/go/TrackConfirmAction?tLabels=${t}`;
    if ((t.length === 12 || t.length === 15) && /^\d+$/.test(t)) return `https://www.fedex.com/fedextrack/?trknbr=${t}`;
    if (t.length === 10 && /^\d+$/.test(t)) return `https://www.dhl.com/en/express/tracking.html?AWB=${t}`;
    return `https://www.google.com/search?q=${encodeURIComponent(t + " tracking")}`;
  };

  const latestLink = links[0] || null;
  const displayPartName = o.part_name || links.map(l => l.partName).filter(Boolean).join(", ") || "—";
  const displaySupplier = o.parts_supplier || (() => {
    try { return latestLink ? new URL(latestLink.url).hostname.replace("www.", "") : "—"; }
    catch { return "—"; }
  })();
  const displayCarrier  = o.parts_carrier  || "—";
  const displayTracking = o.parts_tracking || "—";
  const trackingUrl     = getTrackingUrl(displayTracking);

  // ── Stage actual ────────────────────────────────────────────────────────
  const currentStageKey = o.parts_status || "ordered";
  const currentIdx      = STAGE_IDX[currentStageKey] ?? 0;

  const handleAdvanceStage = async (stageKey) => {
    if (savingStage) return;
    setSavingStage(true);
    try {
      const stage = TRACKING_STAGES.find(s => s.key === stageKey);
      const updatedOrder = await base44.entities.Order.update(order.id, { parts_status: stageKey });

      let me = null;
      try { me = await base44.auth.me(); } catch {}

      const event = await base44.entities.WorkOrderEvent.create({
        order_id: order.id,
        order_number: order.order_number,
        event_type: "parts_tracking",
        description: `${stage.emoji} Pieza marcada como: ${stage.label} — ${stage.desc}`,
        user_name: me?.full_name || me?.email || "Sistema",
        user_id: me?.id || null,
        metadata: { stage: stageKey, partName: displayPartName, carrier: displayCarrier, tracking: displayTracking }
      });

      setTrackingEvents(prev => [event, ...prev]);
      toast.success(`${stage.emoji} ${stage.label}`);
      if (onUpdate) onUpdate(updatedOrder);
    } catch (e) {
      console.error(e);
      toast.error("Error al actualizar etapa");
    } finally {
      setSavingStage(false);
    }
  };

  useEffect(() => {
    if (editingDetails) {
      setEditForm({
        partName: o.part_name || links.map(l => l.partName).filter(Boolean).join(", ") || "",
        supplier: o.parts_supplier || "",
        carrier:  o.parts_carrier  || "",
        tracking: o.parts_tracking || ""
      });
    }
  }, [editingDetails]);

  const handleSaveDetails = async () => {
    try {
      const updatedOrder = await base44.entities.Order.update(order.id, {
        part_name:       editForm.partName.trim(),
        parts_supplier:  editForm.supplier.trim(),
        parts_carrier:   editForm.carrier.trim(),
        parts_tracking:  editForm.tracking.trim()
      });
      let me = null;
      try { me = await base44.auth.me(); } catch {}
      await base44.entities.WorkOrderEvent.create({
        order_id: order.id,
        order_number: order.order_number,
        event_type: "parts_info",
        description: `Detalles del pedido actualizados: ${editForm.partName || "—"} · ${editForm.supplier || "—"} · ${editForm.carrier || "—"} · Tracking: ${editForm.tracking || "—"}`,
        user_name: me?.full_name || me?.email || "Sistema",
        user_id: me?.id || null,
        metadata: { partName: editForm.partName, supplier: editForm.supplier, carrier: editForm.carrier, tracking: editForm.tracking }
      });
      setEditingDetails(false);
      toast.success("Detalles actualizados");
      if (onUpdate) onUpdate(updatedOrder);
    } catch (e) {
      console.error(e);
      toast.error("Error al actualizar");
    }
  };

  const formatTime = (iso) => {
    if (!iso) return "";
    const d = new Date(iso);
    return d.toLocaleString("es", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
  };

  return (
    <div className="space-y-6">

      {/* ── HERO ──────────────────────────────────────────────────────────── */}
      <section className="relative overflow-hidden rounded-[30px] border border-orange-500/15 bg-[radial-gradient(circle_at_top_left,rgba(249,115,22,0.16),transparent_28%),radial-gradient(circle_at_bottom_right,rgba(239,68,68,0.14),transparent_30%),linear-gradient(135deg,rgba(32,16,10,0.98),rgba(20,12,10,0.96))] p-4 sm:p-6 shadow-[0_22px_70px_rgba(0,0,0,0.35)]">
        <div className="absolute inset-0 bg-[linear-gradient(120deg,transparent,rgba(255,255,255,0.03),transparent)]" />
        <div className="relative z-10 space-y-4">

          <div className="flex flex-wrap items-center gap-2">
            <Badge className="rounded-full border border-orange-400/30 bg-orange-500/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.25em] text-orange-200">
              Esperando piezas
            </Badge>
            <Badge variant="outline" className="rounded-full border-white/10 bg-white/5 px-2 py-1 text-[11px] text-white/65">
              Seguimiento de pedido
            </Badge>
          </div>

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
                  {links.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1">
                      {links.slice(0, 3).map((link, i) => (
                        <a key={i} href={link.url} target="_blank" rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 rounded-lg border border-orange-400/20 bg-orange-500/10 px-2 py-0.5 text-[10px] font-semibold text-orange-300 hover:bg-orange-500/20">
                          <ExternalLink className="w-2.5 h-2.5" />
                          {link.partName || (() => { try { return new URL(link.url).hostname.replace("www.", ""); } catch { return "Link"; } })()}
                        </a>
                      ))}
                    </div>
                  )}
                </div>
                <Button variant="ghost" size="icon"
                  className="flex-shrink-0 h-8 w-8 rounded-lg text-white/55 hover:bg-white/10 hover:text-white"
                  onClick={() => setEditingDetails(!editingDetails)}>
                  {editingDetails ? <X className="w-4 h-4" /> : <Pencil className="w-4 h-4" />}
                </Button>
              </div>
            </div>
          </div>

          {/* Botón scroll a piezas */}
          <div className="rounded-[22px] border border-orange-400/15 bg-black/25 p-4">
            <div className="flex items-center gap-3">
              <div className="flex-shrink-0 flex h-10 w-10 items-center justify-center rounded-2xl border border-orange-400/20 bg-orange-500/15">
                <Truck className="h-4 w-4 text-orange-300" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[10px] font-semibold uppercase tracking-[0.28em] text-white/35">Siguiente paso</p>
                <h3 className="text-base font-black tracking-tight text-white">Monitorear llegada</h3>
              </div>
              <Button
                onClick={() => itemsSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" })}
                className="flex-shrink-0 rounded-2xl bg-gradient-to-r from-cyan-600 to-emerald-600 px-3 py-2 text-white text-sm shadow-lg hover:from-cyan-700 hover:to-emerald-700">
                <Plus className="h-4 w-4 sm:mr-2" />
                <span className="hidden sm:inline">Añadir piezas</span>
              </Button>
            </div>
            {trackingUrl && displayTracking !== "—" && (
              <a href={trackingUrl} target="_blank" rel="noopener noreferrer"
                className="mt-3 flex items-center gap-2 rounded-xl border border-orange-400/20 bg-orange-500/10 px-3 py-2 text-sm text-orange-300 hover:bg-orange-500/20">
                <Truck className="w-4 h-4 flex-shrink-0" />
                <span className="truncate font-medium">Rastrear: {displayTracking}</span>
                <ExternalLink className="w-3.5 h-3.5 flex-shrink-0 ml-auto" />
              </a>
            )}
          </div>
        </div>

        {/* Botones de contacto */}
        {(o.customer_phone || o.customer_email) && (() => {
          const phone  = o.customer_phone || "";
          const email  = o.customer_email || "";
          const digits = phone.replace(/\D/g, "");
          const intl   = digits.startsWith("1") ? digits : digits.length === 10 ? `1${digits}` : digits;
          return (
            <div className="relative z-10 mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
              {digits && (
                <a href={`tel:+${intl}`} className="flex items-center justify-center gap-3 h-14 rounded-2xl border border-white/15 bg-white/5 text-white hover:bg-white/10 font-bold text-sm uppercase tracking-wide transition-all active:scale-95">
                  <PhoneCall className="w-5 h-5 text-white/60" />{phone}
                </a>
              )}
              {digits && (
                <a href={`https://wa.me/${intl}`} target="_blank" rel="noreferrer"
                  className="flex items-center justify-center gap-3 h-14 rounded-2xl border border-emerald-500/30 bg-emerald-500/12 text-emerald-300 hover:bg-emerald-500/20 font-bold text-sm uppercase tracking-wide transition-all active:scale-95">
                  <MessageCircle className="w-5 h-5" />WhatsApp
                </a>
              )}
              {email && (
                <a href={`mailto:${email}`} className="flex items-center justify-center gap-3 h-14 rounded-2xl border border-blue-500/30 bg-blue-500/12 text-blue-300 hover:bg-blue-500/20 font-bold text-sm uppercase tracking-wide transition-all active:scale-95">
                  <Mail className="w-5 h-5" /><span className="truncate">{email}</span>
                </a>
              )}
            </div>
          );
        })()}
      </section>

      {/* ── EDICIÓN DETALLES DEL PEDIDO ────────────────────────────────────── */}
      {editingDetails && (
        <div className="overflow-hidden rounded-[28px] border border-cyan-500/15 bg-[linear-gradient(180deg,rgba(255,255,255,0.05),rgba(255,255,255,0.02))] shadow-[0_18px_50px_rgba(0,0,0,0.28)]">
          <div className="border-b border-white/10 bg-gradient-to-r from-cyan-500/10 to-transparent p-5">
            <h3 className="text-white font-bold text-sm uppercase tracking-wider flex items-center gap-2">
              <Truck className="w-4 h-4 text-cyan-300" />Detalles del Pedido
            </h3>
          </div>
          <div className="p-6 space-y-5">
            <div>
              <p className="text-xs text-gray-400 uppercase font-bold tracking-wider mb-2">Pieza Solicitada</p>
              <Input value={editForm.partName} onChange={e => setEditForm(p => ({ ...p, partName: e.target.value }))}
                placeholder="Nombre de la pieza..." className="bg-black/40 border-white/15 text-white h-10" autoComplete="off" />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <p className="text-xs text-gray-400 uppercase font-bold tracking-wider mb-2">Suplidor</p>
                {loadingSuppliers ? (
                  <div className="flex items-center justify-center h-10 bg-black/40 rounded-md border border-white/15">
                    <Loader2 className="w-4 h-4 animate-spin text-white/60" />
                  </div>
                ) : (
                  <Select value={editForm.supplier} onValueChange={v => setEditForm(p => ({ ...p, supplier: v }))}>
                    <SelectTrigger className="bg-black/40 border-white/15 text-white h-10">
                      <SelectValue placeholder="Seleccionar suplidor" />
                    </SelectTrigger>
                    <SelectContent>
                      {suppliers.map(s => <SelectItem key={s.id} value={s.name}>{s.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                )}
              </div>
              <div>
                <p className="text-xs text-gray-400 uppercase font-bold tracking-wider mb-2">Envío</p>
                <select value={editForm.carrier} onChange={e => setEditForm(p => ({ ...p, carrier: e.target.value }))}
                  className="w-full h-10 px-3 rounded-md bg-black/40 border border-white/15 text-white">
                  <option value="">Seleccionar...</option>
                  {["USPS","FedEx","UPS","DHL","Amazon","Otro"].map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div>
                <p className="text-xs text-gray-400 uppercase font-bold tracking-wider mb-2">Tracking #</p>
                <Input value={editForm.tracking} onChange={e => setEditForm(p => ({ ...p, tracking: e.target.value }))}
                  placeholder="1Z999AA..." className="bg-black/40 border-white/15 text-white h-10" autoComplete="off" />
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-3 border-t border-white/10">
              <Button variant="outline" onClick={() => setEditingDetails(false)} className="border-white/15">Cancelar</Button>
              <Button onClick={handleSaveDetails} className="bg-gradient-to-r from-cyan-600 to-emerald-600 hover:from-cyan-700 hover:to-emerald-700">
                <Check className="w-4 h-4 mr-2" />Guardar
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ── MAPA DE TRACKING DE LA PIEZA ──────────────────────────────────── */}
      <div className="overflow-hidden rounded-[28px] border border-orange-500/15 bg-[linear-gradient(180deg,rgba(255,255,255,0.04),rgba(255,255,255,0.01))] shadow-[0_18px_50px_rgba(0,0,0,0.25)]">
        {/* Header */}
        <div className="border-b border-white/8 bg-gradient-to-r from-orange-500/10 to-transparent p-5">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-white font-bold text-sm uppercase tracking-wider flex items-center gap-2">
                <MapPin className="w-4 h-4 text-orange-400" />
                Seguimiento de la Pieza
              </h3>
              <p className="text-xs text-white/40 mt-0.5">
                {displayPartName !== "—" ? displayPartName : "Actualiza el estado según avance el pedido"}
                {displayCarrier !== "—" ? ` · ${displayCarrier}` : ""}
                {displayTracking !== "—" ? ` · #${displayTracking}` : ""}
              </p>
            </div>
            {trackingUrl && displayTracking !== "—" && (
              <a href={trackingUrl} target="_blank" rel="noopener noreferrer"
                className="flex items-center gap-1.5 rounded-xl border border-orange-400/25 bg-orange-500/10 px-3 py-1.5 text-xs font-semibold text-orange-300 hover:bg-orange-500/20 transition-all">
                <ExternalLink className="w-3.5 h-3.5" />
                Rastrear
              </a>
            )}
          </div>
        </div>

        {/* Stepper */}
        <div className="p-5 space-y-5">
          {/* Barra de progreso + etapas */}
          <div className="relative">
            {/* Línea de progreso de fondo */}
            <div className="absolute top-6 left-6 right-6 h-0.5 bg-white/8 hidden sm:block" />
            {/* Línea de progreso completada */}
            <div
              className="absolute top-6 left-6 h-0.5 bg-gradient-to-r from-orange-500 to-emerald-500 hidden sm:block transition-all duration-700"
              style={{ width: currentIdx === 0 ? "0%" : `${(currentIdx / (TRACKING_STAGES.length - 1)) * (100 - 48 / (TRACKING_STAGES.length - 1))}%` }}
            />

            <div className="grid grid-cols-3 sm:grid-cols-6 gap-3 sm:gap-2 relative z-10">
              {TRACKING_STAGES.map((stage, idx) => {
                const isCompleted = idx < currentIdx;
                const isCurrent   = idx === currentIdx;
                const isFuture    = idx > currentIdx;

                return (
                  <button
                    key={stage.key}
                    disabled={savingStage}
                    onClick={() => handleAdvanceStage(stage.key)}
                    title={stage.desc}
                    className={`
                      flex flex-col items-center gap-2 p-3 rounded-2xl border transition-all duration-200 text-center
                      ${isCurrent   ? "border-orange-400/50 bg-orange-500/15 shadow-[0_0_20px_rgba(249,115,22,0.15)] scale-105"  : ""}
                      ${isCompleted ? "border-emerald-500/30 bg-emerald-500/10 cursor-pointer hover:bg-emerald-500/15"             : ""}
                      ${isFuture    ? "border-white/8 bg-white/3 cursor-pointer hover:bg-white/6 opacity-60 hover:opacity-90"      : ""}
                      ${savingStage ? "opacity-50 cursor-not-allowed" : ""}
                    `}
                  >
                    <div className={`
                      relative w-12 h-12 rounded-2xl flex items-center justify-center text-2xl
                      ${isCurrent   ? "bg-orange-500/20 ring-2 ring-orange-400/40" : ""}
                      ${isCompleted ? "bg-emerald-500/15" : ""}
                      ${isFuture    ? "bg-white/5" : ""}
                    `}>
                      <span>{stage.emoji}</span>
                      {isCompleted && (
                        <div className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-emerald-500 flex items-center justify-center">
                          <Check className="w-2.5 h-2.5 text-white" />
                        </div>
                      )}
                      {isCurrent && (
                        <div className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-orange-400 flex items-center justify-center animate-pulse">
                          <Clock className="w-2.5 h-2.5 text-white" />
                        </div>
                      )}
                    </div>
                    <div>
                      <p className={`text-[11px] font-bold leading-tight ${isCurrent ? "text-orange-200" : isCompleted ? "text-emerald-300" : "text-white/40"}`}>
                        {stage.label}
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Estado actual destacado */}
          <div className="rounded-[18px] border border-orange-400/20 bg-gradient-to-r from-orange-500/10 to-transparent p-4 flex items-center gap-3">
            <span className="text-3xl">{TRACKING_STAGES[currentIdx]?.emoji}</span>
            <div className="flex-1 min-w-0">
              <p className="text-[10px] font-semibold uppercase tracking-widest text-white/35">Estado actual</p>
              <p className="text-base font-black text-white">{TRACKING_STAGES[currentIdx]?.label}</p>
              <p className="text-xs text-white/50">{TRACKING_STAGES[currentIdx]?.desc}</p>
            </div>
            {currentIdx < TRACKING_STAGES.length - 1 && (
              <Button
                size="sm"
                disabled={savingStage}
                onClick={() => handleAdvanceStage(TRACKING_STAGES[currentIdx + 1].key)}
                className="flex-shrink-0 rounded-xl bg-gradient-to-r from-orange-600 to-amber-600 hover:from-orange-700 hover:to-amber-700 text-white text-xs font-bold px-3"
              >
                {savingStage ? <Loader2 className="w-3 h-3 animate-spin" /> : (
                  <>{TRACKING_STAGES[currentIdx + 1]?.emoji} <span className="ml-1 hidden sm:inline">{TRACKING_STAGES[currentIdx + 1]?.label}</span></>
                )}
              </Button>
            )}
          </div>

          {/* Historial de cambios de estado */}
          {trackingEvents.length > 0 && (
            <div className="space-y-2">
              <p className="text-[10px] font-semibold uppercase tracking-widest text-white/30">Historial de movimientos</p>
              <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                {trackingEvents.map((ev, i) => (
                  <div key={ev.id || i} className="flex items-start gap-3 rounded-xl border border-white/6 bg-white/3 px-3 py-2">
                    <div className="w-1.5 h-1.5 rounded-full bg-orange-400 mt-2 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-white/75 leading-snug">{ev.description}</p>
                      <p className="text-[10px] text-white/30 mt-0.5">{formatTime(ev.created_at)}{ev.user_name ? ` · ${ev.user_name}` : ""}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── PIEZAS Y SERVICIOS ────────────────────────────────────────────── */}
      <div ref={itemsSectionRef}>
        <SharedItemsSection
          order={o}
          onUpdate={onUpdate}
          onOrderItemsUpdate={onOrderItemsUpdate}
          onRemoteSaved={onRemoteSaved}
          onPaymentClick={onPaymentClick}
          accentColor="orange"
          subtitle="Mantén aquí la lista final de repuestos y servicios mientras el pedido está en tránsito."
        />
      </div>

      <WorkOrderUnifiedHub order={order} onUpdate={onUpdate} accent="amber" title="Centro de Historial" subtitle="Pedido, fotos, seguridad y notas operativas consolidadas en una sola pieza." />
    </div>
  );
}
