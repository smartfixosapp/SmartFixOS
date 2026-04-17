import React, { useState, useEffect } from "react";
import { ExternalLink, Plus, MapPin, Truck, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import OrderItems from "@/components/orders/workorder/WorkOrderItems";
import OrderSecurity from "@/components/workorder/sections/OrderSecurity";
import OrderMultimedia from "@/components/workorder/sections/OrderMultimedia";
import OrderNotes from "@/components/workorder/sections/OrderNotes";
import WorkOrderTimeline from "@/components/orders/workorder/WorkOrderTimeline";
import { base44 } from "@/api/base44Client";
import { Camera, History, Shield } from "lucide-react";

export default function PartArrivedStage({ order, onUpdate }) {
  const o = order || {};
  const [activeModal, setActiveModal] = useState(null);
  const [links, setLinks] = useState([]);

  useEffect(() => {
    if (order?.id) {
      loadLinks();
    }
  }, [order?.id]);

  const loadLinks = async () => {
    if (!order?.id) return;
    try {
      const data = await base44.entities.WorkOrderEvent.filter({ 
        order_id: order.id,
        event_type: "link_added"
      }, "-created_date", 20);
      
      setLinks(data || []);
    } catch (e) {
      console.error(e);
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

  // ✅ Fallback Data Logic
  const latestLink = links.length > 0 ? links[0] : null;
  const linkMeta = latestLink?.metadata || {};
  
  // Parse description if metadata missing (fallback)
  let fallbackPart = linkMeta.partName || linkMeta.part || linkMeta.name;
  let fallbackUrl = linkMeta.link || linkMeta.url;
  
  if (!fallbackPart && latestLink?.description) {
     const match = latestLink.description.match(/🔗 (.*?):/);
     if (match) fallbackPart = match[1];
  }

  const displayPartName = o.part_name || fallbackPart || "—";
  const displaySupplier = o.parts_supplier || (fallbackUrl ? new URL(fallbackUrl).hostname.replace('www.','') : "—");
  const displayCarrier = o.parts_carrier || "—";
  
  const displayTracking = o.parts_tracking || "—";
  const trackingUrl = getTrackingUrl(displayTracking);

  // Status is specifically waiting for customer to bring device
  const location = "cliente"; 

  return (
    <div className="space-y-6">
      {/* Header Pieza Lista */}
      <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-[24px] p-6 shadow-lg relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-r from-yellow-600/5 to-amber-600/5 pointer-events-none" />
        <div className="relative z-10 flex flex-col sm:flex-row sm:items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-yellow-500/20 flex items-center justify-center border border-yellow-500/30 shadow-[0_0_15px_rgba(234,179,8,0.3)]">
            <CheckCircle2 className="w-6 h-6 text-yellow-400" />
          </div>
          <div>
            <h4 className="text-xl font-bold text-white tracking-tight">Pieza lista / Esperando cliente</h4>
            <p className="text-sm text-gray-400 font-medium">
              La pieza ya llegó. Estamos esperando que el cliente entregue el equipo.
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white/5 backdrop-blur-xl border border-purple-500/30 rounded-[24px] overflow-hidden shadow-lg">
          <div className="p-5 border-b bg-white/5 border-purple-500/20">
            <h3 className="text-white font-bold text-sm flex items-center gap-2">
              <MapPin className="w-4 h-4 text-purple-400" />
              Ubicación del Equipo
            </h3>
          </div>
          <div className="p-6">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-2xl flex items-center justify-center bg-purple-500/20 text-purple-400 border border-purple-500/30">
                <MapPin className="w-7 h-7" />
              </div>
              <div>
                <p className="text-2xl font-bold text-white">
                  {order?.device_location === "taller" ? "En Taller" : "Con Cliente"}
                </p>
                <p className="text-sm text-gray-400 font-medium">
                  {order?.device_location === "taller" ? "El equipo está físicamente aquí." : "El cliente se llevó el dispositivo."}
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-[24px] overflow-hidden shadow-lg">
          <div className="p-5 border-b border-white/10 bg-white/5">
            <div className="flex items-center justify-between">
              <h3 className="text-white font-bold text-sm flex items-center gap-2">
                <Truck className="w-4 h-4 text-gray-400" />
                Detalles del Pedido
              </h3>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-gray-400 hover:text-white hover:bg-white/10 rounded-lg transition-all"
                onClick={() => setActiveModal('notes')}
                title="Añadir/Editar Info (Links)"
                aria-label="Añadir o editar links del pedido"
              >
                <Plus className="w-4 h-4" />
              </Button>
            </div>
          </div>
          <div className="p-6 space-y-5">
            <div>
              <p className="text-xs text-gray-500 font-bold mb-1">Pieza Solicitada</p>
              <p className="text-white font-bold text-lg truncate" title={displayPartName}>{displayPartName}</p>
            </div>
            <div className="grid grid-cols-3 gap-6">
              <div>
                <p className="text-xs text-gray-500 font-bold mb-1">Suplidor</p>
                {fallbackUrl ? (
                  <a 
                    href={fallbackUrl} 
                    target="_blank" 
                    rel="noopener noreferrer" 
                    className="text-blue-400 hover:text-blue-300 hover:underline flex items-center gap-1 truncate font-medium"
                  >
                    {displaySupplier} <ExternalLink className="w-3 h-3" />
                  </a>
                ) : (
                  <p className="text-white font-medium truncate">{displaySupplier}</p>
                )}
              </div>
              <div>
                <p className="text-xs text-gray-500 font-bold mb-1">Envío</p>
                <p className="text-white font-medium truncate">{displayCarrier}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500 font-bold mb-1">Tracking</p>
                {trackingUrl ? (
                  <a 
                    href={trackingUrl} 
                    target="_blank" 
                    rel="noopener noreferrer" 
                    className="text-emerald-400 hover:text-emerald-300 font-mono hover:underline flex items-center gap-1 truncate font-medium"
                  >
                    {displayTracking} <ExternalLink className="w-3 h-3" />
                  </a>
                ) : (
                  <p className="text-white font-mono font-medium truncate">{displayTracking}</p>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Modules Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Photos Module Trigger */}
        <div 
          onClick={() => setActiveModal('multimedia')}
          className="bg-white/5 border border-white/10 rounded-2xl p-4 hover:bg-white/10 transition-all cursor-pointer group"
        >
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-full bg-blue-500/20 flex items-center justify-center text-blue-400 group-hover:scale-110 transition-transform">
              <Camera className="w-5 h-5" />
            </div>
            <h3 className="font-semibold text-white">Fotos y Videos</h3>
          </div>
          <p className="text-sm text-gray-400">Ver o agregar evidencia multimedia.</p>
        </div>

        {/* History Module Trigger */}
        <div 
          onClick={() => setActiveModal('history')}
          className="bg-white/5 border border-white/10 rounded-2xl p-4 hover:bg-white/10 transition-all cursor-pointer group"
        >
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-full bg-orange-500/20 flex items-center justify-center text-orange-400 group-hover:scale-110 transition-transform">
              <History className="w-5 h-5" />
            </div>
            <h3 className="font-semibold text-white">Historial</h3>
          </div>
          <p className="text-sm text-gray-400">Ver eventos y cambios de la orden.</p>
        </div>

        {/* Security Module Trigger */}
        <div 
          onClick={() => setActiveModal('security')}
          className="bg-white/5 border border-white/10 rounded-2xl p-4 hover:bg-white/10 transition-all cursor-pointer group"
        >
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-full bg-emerald-500/20 flex items-center justify-center text-emerald-400 group-hover:scale-110 transition-transform">
              <Shield className="w-5 h-5" />
            </div>
            <h3 className="font-semibold text-white">Seguridad</h3>
          </div>
          <p className="text-sm text-gray-400">Patrón, PIN y contraseñas.</p>
        </div>
      </div>

      {/* Reused generic modals for details */}
      <Dialog open={activeModal === 'items'} onOpenChange={() => setActiveModal(null)}>
        <DialogContent className="max-w-4xl bg-[#0a0a0a] border-gray-800 p-0 z-[9999] overflow-hidden">
          <div className="p-4 max-h-[85vh] overflow-y-auto custom-scrollbar"><OrderItems order={order} onUpdate={onUpdate} /></div>
        </DialogContent>
      </Dialog>
      <Dialog open={activeModal === 'security'} onOpenChange={() => setActiveModal(null)}>
        <DialogContent className="max-w-2xl bg-[#0a0a0a] border-gray-800 p-0 z-[9999] overflow-hidden">
          <div className="p-4"><OrderSecurity order={order} onUpdate={onUpdate} /></div>
        </DialogContent>
      </Dialog>
      <Dialog open={activeModal === 'multimedia'} onOpenChange={() => setActiveModal(null)}>
        <DialogContent className="max-w-4xl bg-[#0a0a0a] border-gray-800 p-0 z-[9999] overflow-hidden">
          <div className="p-4"><OrderMultimedia order={order} onUpdate={onUpdate} /></div>
        </DialogContent>
      </Dialog>
      <Dialog open={activeModal === 'notes'} onOpenChange={() => setActiveModal(null)}>
        <DialogContent className="max-w-3xl bg-[#0a0a0a] border-gray-800 p-0 z-[9999] overflow-hidden">
          <div className="p-4"><OrderNotes order={order} onUpdate={onUpdate} /></div>
        </DialogContent>
      </Dialog>
      <Dialog open={activeModal === 'history'} onOpenChange={() => setActiveModal(null)}>
        <DialogContent className="max-w-3xl bg-[#0a0a0a] border-gray-800 p-0 z-[9999] overflow-hidden">
          <div className="p-4"><WorkOrderTimeline order={order} /></div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
