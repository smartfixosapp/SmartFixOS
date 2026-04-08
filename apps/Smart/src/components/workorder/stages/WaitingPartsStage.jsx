import React, { useState, useEffect } from "react";
import { ExternalLink, MapPin, Truck, X, Pencil, Check, Loader2, PhoneCall, MessageCircle, Mail, Zap } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { base44 } from "@/api/base44Client";
import { loadSuppliersSafe } from "@/components/utils/suppliers";
import WorkOrderUnifiedHub from "@/components/workorder/WorkOrderUnifiedHub";
import { loadOrderLinks } from "@/components/workorder/utils/orderLinksStore";
import SharedItemsSection from "@/components/workorder/SharedItemsSection";

function detectCarrier(trackingNum) {
  if (!trackingNum || !trackingNum.trim()) return "";
  const t = trackingNum.trim().toUpperCase();
  if (t.startsWith("1Z"))                                                  return "UPS";
  if (t.startsWith("TBA") || t.startsWith("A0"))                          return "Amazon";
  if (t.startsWith("9") && t.length >= 20 && /^\d+$/.test(t))             return "USPS";
  if ((t.length === 20 || t.length === 22) && /^\d+$/.test(t))            return "USPS";
  if ((t.length === 12 || t.length === 15) && /^\d+$/.test(t))            return "FedEx";
  if (t.length === 34 && /^[A-Z]{2}\d{9}[A-Z]{2}$/.test(t))              return "USPS";
  if (/^\d{10}$/.test(t))                                                  return "DHL";
  if (t.startsWith("JD") || t.startsWith("7489") || t.startsWith("7480")) return "DHL";
  return "";
}

const CARRIER_STYLE = {
  UPS:    { color: "text-amber-400",  border: "border-amber-500/30",  bg: "bg-amber-500/10"  },
  USPS:   { color: "text-blue-400",   border: "border-blue-500/30",   bg: "bg-blue-500/10"   },
  FedEx:  { color: "text-purple-400", border: "border-purple-500/30", bg: "bg-purple-500/10" },
  DHL:    { color: "text-yellow-400", border: "border-yellow-500/30", bg: "bg-yellow-500/10" },
  Amazon: { color: "text-orange-400", border: "border-orange-500/30", bg: "bg-orange-500/10" },
};

function getTrackingUrl(trackingNumber, carrier) {
  if (!trackingNumber || trackingNumber === "—") return null;
  const t = trackingNumber.trim().toUpperCase();
  const c = (carrier || "").toUpperCase();
  if (c === "UPS"   || t.startsWith("1Z"))                          return `https://www.ups.com/track?tracknum=${t}`;
  if (c === "USPS"  || (t.startsWith("9") && t.length >= 20))       return `https://tools.usps.com/go/TrackConfirmAction?tLabels=${t}`;
  if (c === "FEDEX" || t.length === 12 || t.length === 15)          return `https://www.fedex.com/fedextrack/?trknbr=${t}`;
  if (c === "DHL"   || /^\d{10}$/.test(t))                          return `https://www.dhl.com/en/express/tracking.html?AWB=${t}`;
  if (c === "AMAZON")                                                return `https://track.amazon.com/tracking/${t}`;
  return `https://www.google.com/search?q=${encodeURIComponent(t + " tracking")}`;
}

export default function WaitingPartsStage({ order, onUpdate, onOrderItemsUpdate, onRemoteSaved, onPaymentClick, compact }) {
  const o = order || {};
  const location = o.device_location || "taller";

  const [editingDetails, setEditingDetails] = useState(false);
  const [suppliers,      setSuppliers]      = useState([]);
  const [loadingSuppliers, setLoadingSuppliers] = useState(false);
  const [links,          setLinks]          = useState([]);
  const [editForm, setEditForm] = useState({ partName: "", supplier: "", carrier: "", tracking: "" });

  useEffect(() => {
    if (order?.id) { loadLinks(); loadSuppliers(); }
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

  // Derived display values
  const displayTracking = o.parts_tracking || "—";
  const displayCarrier  = o.parts_carrier  || detectCarrier(displayTracking) || "—";
  const displayPartName = o.part_name || links.map(l => l.partName).filter(Boolean).join(", ") || "—";
  const displaySupplier = o.parts_supplier || (() => {
    try { return links[0] ? new URL(links[0].url).hostname.replace("www.", "") : "—"; } catch { return "—"; }
  })();
  const carrierStyle = CARRIER_STYLE[displayCarrier] || null;
  const trackingUrl  = getTrackingUrl(displayTracking, displayCarrier);

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
      const trackingVal  = editForm.tracking.trim();
      const autoCarrier  = detectCarrier(trackingVal);
      const finalCarrier = editForm.carrier.trim() || autoCarrier;

      const updatedOrder = await base44.entities.Order.update(order.id, {
        part_name:      editForm.partName.trim(),
        parts_supplier: editForm.supplier.trim(),
        parts_carrier:  finalCarrier,
        parts_tracking: trackingVal
      });

      let me = null;
      try { me = await base44.auth.me(); } catch {}

      await base44.entities.WorkOrderEvent.create({
        order_id: order.id,
        order_number: order.order_number,
        event_type: "parts_info",
        description: `Detalles del pedido actualizados: ${editForm.partName || "—"} · ${finalCarrier || "—"} · Tracking: ${trackingVal || "—"}`,
        user_name: me?.full_name || me?.email || "Sistema",
        user_id: me?.id || null,
        metadata: { partName: editForm.partName, supplier: editForm.supplier, carrier: finalCarrier, tracking: trackingVal }
      });

      toast.success("Detalles actualizados");
      setEditingDetails(false);
      if (onUpdate) onUpdate({ ...updatedOrder, parts_carrier: finalCarrier });
    } catch (e) {
      console.error(e);
      toast.error("Error al actualizar");
    }
  };

  return (
    <div className="space-y-6">

      {/* ── HERO ──────────────────────────────────────────────────────────── */}
      {!compact && (
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
                  <p className="mt-1 text-xs text-white/45 truncate">{displaySupplier} · {displayCarrier}</p>
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
                  onClick={() => setEditingDetails(!editingDetails)}
                  aria-label={editingDetails ? "Cancelar edición de detalles" : "Editar detalles del pedido"}>
                  {editingDetails ? <X className="w-4 h-4" /> : <Pencil className="w-4 h-4" />}
                </Button>
              </div>
            </div>
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
      )}

      {/* ── COMPACT: Tracking info summary ─────────────────────────────────── */}
      {compact && (
        <div className="rounded-[22px] border border-orange-500/15 bg-black/25 p-4 space-y-3">
          <div className="flex items-center justify-between gap-2">
            <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-white/35">Detalles del pedido</p>
            <Button variant="ghost" size="icon"
              className="h-7 w-7 rounded-lg text-white/55 hover:bg-white/10 hover:text-white"
              onClick={() => setEditingDetails(!editingDetails)}
              aria-label={editingDetails ? "Cancelar edición" : "Editar detalles"}>
              {editingDetails ? <X className="w-3.5 h-3.5" /> : <Pencil className="w-3.5 h-3.5" />}
            </Button>
          </div>
          <div className="grid grid-cols-2 gap-2 text-sm">
            <span className="text-white/50">Pieza</span>
            <span className="text-right font-semibold text-white/80 truncate">{displayPartName}</span>
            <span className="text-white/50">Suplidor</span>
            <span className="text-right font-semibold text-white/80 truncate">{displaySupplier}</span>
            <span className="text-white/50">Carrier</span>
            <span className="text-right font-semibold text-white/80">{displayCarrier}</span>
            <span className="text-white/50">Ubicación</span>
            <span className="text-right font-semibold text-white/80">{location === "taller" ? "En Taller" : "Con Cliente"}</span>
          </div>
          {links.length > 0 && (
            <div className="flex flex-wrap gap-1 pt-1">
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
      )}

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
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs text-gray-400 uppercase font-bold tracking-wider">Suplidor</p>
                  <button
                    type="button"
                    onClick={() => setEditForm(p => ({ ...p, supplier: "", _manualSupplier: !p._manualSupplier }))}
                    className="text-[10px] font-bold text-cyan-400 hover:text-cyan-300"
                  >
                    {editForm._manualSupplier ? "Usar lista" : "Manual"}
                  </button>
                </div>
                {editForm._manualSupplier ? (
                  <Input
                    value={editForm.supplier}
                    onChange={e => setEditForm(p => ({ ...p, supplier: e.target.value }))}
                    placeholder="Nombre del suplidor..."
                    className="bg-black/40 border-white/15 text-white h-10"
                    autoComplete="off"
                  />
                ) : loadingSuppliers ? (
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
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs text-gray-400 uppercase font-bold tracking-wider">Carrier</p>
                  <button
                    type="button"
                    onClick={() => setEditForm(p => ({ ...p, carrier: "", _manualCarrier: !p._manualCarrier }))}
                    className="text-[10px] font-bold text-cyan-400 hover:text-cyan-300"
                  >
                    {editForm._manualCarrier ? "Usar lista" : "Manual"}
                  </button>
                </div>
                {editForm._manualCarrier ? (
                  <Input
                    value={editForm.carrier}
                    onChange={e => setEditForm(p => ({ ...p, carrier: e.target.value }))}
                    placeholder="Nombre del carrier..."
                    className="bg-black/40 border-white/15 text-white h-10"
                    autoComplete="off"
                  />
                ) : (
                  <select value={editForm.carrier} onChange={e => setEditForm(p => ({ ...p, carrier: e.target.value }))}
                    className="w-full h-10 px-3 rounded-md bg-black/40 border border-white/15 text-white">
                    <option value="">Auto-detectar</option>
                    {["USPS","FedEx","UPS","DHL","Amazon","Otro"].map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                )}
              </div>
              <div>
                <p className="text-xs text-gray-400 uppercase font-bold tracking-wider mb-2">Tracking #</p>
                <div className="relative">
                  <Input
                    value={editForm.tracking}
                    onChange={e => {
                      const val = e.target.value;
                      const auto = detectCarrier(val);
                      setEditForm(p => ({ ...p, tracking: val, carrier: auto || p.carrier }));
                    }}
                    placeholder="1Z999AA10123456784..."
                    className="bg-black/40 border-white/15 text-white h-10 pr-20"
                    autoComplete="off"
                  />
                  {detectCarrier(editForm.tracking) && (
                    <span className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1 rounded-lg bg-emerald-500/20 border border-emerald-500/30 px-2 py-0.5 text-[10px] font-bold text-emerald-300">
                      <Zap className="w-2.5 h-2.5" />{detectCarrier(editForm.tracking)}
                    </span>
                  )}
                </div>
                {detectCarrier(editForm.tracking) && (
                  <p className="mt-1 text-[10px] text-emerald-400 flex items-center gap-1">
                    <Zap className="w-2.5 h-2.5" />Carrier detectado automáticamente
                  </p>
                )}
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

      {/* ── TRACKING ──────────────────────────────────────────────────────── */}
      {displayTracking !== "—" ? (
        <a
          href={trackingUrl || "#"}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center justify-between gap-4 rounded-[22px] border border-orange-500/20 bg-orange-500/8 px-5 py-4 hover:bg-orange-500/14 transition-all group"
        >
          <div className="flex items-center gap-3 min-w-0">
            <MapPin className="w-5 h-5 text-orange-400 flex-shrink-0" />
            <div className="min-w-0">
              <p className="text-[10px] font-semibold uppercase tracking-widest text-orange-300/60 mb-0.5">Número de Tracking</p>
              <p className="font-mono text-sm font-bold text-white truncate">{displayTracking}</p>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            {carrierStyle ? (
              <span className={`inline-flex items-center gap-1 rounded-lg border ${carrierStyle.border} ${carrierStyle.bg} px-2.5 py-1 text-xs font-bold ${carrierStyle.color}`}>
                {displayCarrier}
              </span>
            ) : displayCarrier !== "—" && (
              <span className="text-xs text-white/40">{displayCarrier}</span>
            )}
            <span className="flex items-center gap-1.5 rounded-xl border border-orange-400/25 bg-orange-500/10 px-3 py-1.5 text-xs font-semibold text-orange-300 group-hover:bg-orange-500/20 transition-all">
              <ExternalLink className="w-3.5 h-3.5" />
              Ver en {displayCarrier !== "—" ? displayCarrier : "carrier"}
            </span>
          </div>
        </a>
      ) : (
        <div className="rounded-[22px] border border-white/8 bg-white/3 p-5 flex items-center gap-4">
          <MapPin className="w-8 h-8 text-white/50 flex-shrink-0" />
          <div>
            <p className="text-sm font-semibold text-white/50">Sin número de tracking aún</p>
            <p className="text-xs text-white/30">Edita los detalles del pedido y agrega el número de tracking.</p>
          </div>
          <Button variant="ghost" size="sm" onClick={() => setEditingDetails(true)}
            className="ml-auto flex-shrink-0 rounded-xl border border-white/15 text-white/60 hover:bg-white/8 text-xs">
            <Pencil className="w-3.5 h-3.5 mr-1.5" />Agregar
          </Button>
        </div>
      )}

      {/* ── PIEZAS Y SERVICIOS ────────────────────────────────────────────── */}
      {!compact && (
        <div>
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
      )}

      {!compact && (
        <WorkOrderUnifiedHub order={order} onUpdate={onUpdate} accent="amber" title="Centro de Historial" subtitle="Pedido, fotos, seguridad y notas operativas consolidadas en una sola pieza." />
      )}
    </div>
  );
}
