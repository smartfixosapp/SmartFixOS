import React, { useState, useEffect } from "react";
import { Badge } from "@/components/ui/badge";
import { ShoppingCart, Package, Link as LinkIcon, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import AddItemModal from "@/components/workorder/AddItemModal";
import WorkOrderUnifiedHub from "@/components/workorder/WorkOrderUnifiedHub";
import OrderLinksDialog from "@/components/workorder/OrderLinksDialog";
import { loadOrderLinks } from "@/components/workorder/utils/orderLinksStore";

export default function PendingOrderStage({ order, onUpdate, user }) {
  const [activeModal, setActiveModal] = useState(null);
  const [links, setLinks] = useState([]);
  const [showCatalog, setShowCatalog] = useState(false);
  
  useEffect(() => {
    if (order?.id) {
      loadLinks();
    }
  }, [order?.id]);

  const loadLinks = async () => {
    if (!order?.id) return;
    try {
      const result = await loadOrderLinks(order);
      setLinks(Array.isArray(result?.links) ? result.links : []);
    } catch (e) {
      console.error("Error loading links in PendingOrderStage:", e);
      setLinks([]);
    }
  };

  const handleCatalogRemoteSaved = async (payload) => {
    const mergedOrder = {
      ...(order || {}),
      ...(payload || {}),
    };
    onUpdate?.(mergedOrder);
  };

  return (
    <div className="space-y-6">
      <section className="relative overflow-hidden rounded-[30px] border border-yellow-500/15 bg-[radial-gradient(circle_at_top_left,rgba(250,204,21,0.16),transparent_28%),radial-gradient(circle_at_bottom_right,rgba(249,115,22,0.14),transparent_30%),linear-gradient(135deg,rgba(34,24,8,0.98),rgba(22,16,10,0.96))] p-5 shadow-[0_22px_70px_rgba(0,0,0,0.35)] sm:p-6">
        <div className="absolute inset-0 bg-[linear-gradient(120deg,transparent,rgba(255,255,255,0.03),transparent)]" />
        <div className="relative z-10 grid gap-5 xl:grid-cols-[1.2fr_0.8fr] xl:items-start">
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-2">
              <Badge className="rounded-full border border-yellow-400/30 bg-yellow-500/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.25em] text-yellow-200">
                Pendiente de piezas
              </Badge>
              <Badge variant="outline" className="rounded-full border-white/10 bg-white/5 px-3 py-1 text-xs text-white/65">
                Gestion de compra
              </Badge>
            </div>

            <div className="space-y-2">
              <p className="text-[11px] font-semibold uppercase tracking-[0.32em] text-white/35">Etapa activa</p>
              <div className="flex flex-wrap items-end gap-x-4 gap-y-2">
                <h2 className="text-3xl font-black tracking-tight text-white sm:text-4xl">Gestión de Piezas</h2>
                <div className="inline-flex items-center rounded-full border border-yellow-400/20 bg-yellow-500/10 px-3 py-1 text-sm font-semibold text-yellow-200">
                  {order?.device_brand} {order?.device_model}
                </div>
              </div>
              <p className="max-w-2xl text-sm leading-relaxed text-white/55">
                Centraliza enlaces de compra, costos y seguimiento del pedido sin perder claridad visual ni duplicar bloques viejos.
              </p>
            </div>

            <div className="grid gap-3 md:grid-cols-3">
              <div className="rounded-[22px] border border-white/10 bg-black/25 p-4 backdrop-blur-md">
                <p className="mb-1 text-[11px] font-semibold uppercase tracking-[0.24em] text-white/35">Cliente</p>
                <p className="truncate text-lg font-bold text-yellow-200">{order?.customer_name || "No registrado"}</p>
              </div>
              <div className="rounded-[22px] border border-white/10 bg-black/25 p-4 backdrop-blur-md">
                <p className="mb-1 text-[11px] font-semibold uppercase tracking-[0.24em] text-white/35">Equipo</p>
                <p className="truncate text-sm font-semibold text-white/75">{order?.device_brand} {order?.device_model || "Sin modelo"}</p>
              </div>
              <div className="rounded-[22px] border border-white/10 bg-black/25 p-4 backdrop-blur-md">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0 flex-1">
                    <p className="mb-1 text-[11px] font-semibold uppercase tracking-[0.24em] text-white/35">Links Guardados</p>
                    <p className="truncate text-sm font-semibold text-white/75">
                      {links.length > 0 ? `${links.length} link${links.length === 1 ? "" : "s"} registrado${links.length === 1 ? "" : "s"}` : "Sin links todavía"}
                    </p>
                  </div>
                  <Button
                    onClick={() => setActiveModal("links")}
                    size="sm"
                    className="w-full rounded-xl bg-yellow-500 px-3 text-black hover:bg-yellow-400 sm:w-auto"
                  >
                    Abrir
                  </Button>
                </div>
              </div>
            </div>
          </div>

          <div className="rounded-[26px] border border-yellow-400/15 bg-black/25 p-5 backdrop-blur-md">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-yellow-400/20 bg-yellow-500/15">
                <Package className="h-5 w-5 text-yellow-300" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-white/35">Accion rápida</p>
                <h3 className="mt-1 text-xl font-black tracking-tight text-white">Cotizar y ordenar</h3>
                <p className="mt-2 text-sm leading-relaxed text-white/55">
                  Añade las piezas o servicios que van a formar parte de la orden final y mantén el costo visible.
                </p>
                <Button
                  onClick={() => setShowCatalog(true)}
                  className="mt-4 w-full rounded-2xl border-0 bg-yellow-500 px-5 text-black shadow-lg shadow-yellow-950/20 hover:bg-yellow-400 sm:w-auto"
                >
                  <ShoppingCart className="mr-2 h-4 w-4" />
                  Piezas y Servicios
                </Button>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Auto-created items from links ─────────────────────────────────── */}
      {(() => {
        const items = Array.isArray(order?.order_items) ? order.order_items : [];
        if (items.length === 0) return null;
        const subtotal = items.reduce((s, it) => s + Number(it.total || Number(it.price || 0) * Number(it.qty || 1)), 0);
        return (
          <div className="bg-white/5 backdrop-blur-xl border border-yellow-500/15 rounded-[24px] overflow-hidden shadow-lg">
            <div className="p-5 border-b border-white/10 bg-yellow-500/5">
              <div className="flex items-center justify-between">
                <h3 className="text-white font-bold flex items-center gap-2">
                  <ShoppingCart className="w-5 h-5 text-yellow-400" />
                  Piezas y Servicios
                  <span className="text-xs text-yellow-300/70 font-normal ml-1">({items.length} item{items.length !== 1 ? 's' : ''})</span>
                </h3>
                <Button
                  size="sm"
                  onClick={() => setShowCatalog(true)}
                  className="h-8 bg-yellow-500 hover:bg-yellow-400 text-black rounded-xl font-bold text-xs px-3"
                >
                  + Añadir
                </Button>
              </div>
            </div>
            <div className="divide-y divide-white/5">
              {items.map((item, idx) => (
                <div key={idx} className="flex items-center justify-between px-5 py-3 hover:bg-white/[0.03] transition-colors">
                  <div className="min-w-0 flex-1">
                    <p className="text-white text-sm font-semibold truncate">{item.name}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-[11px] text-gray-400">${Number(item.price || 0).toFixed(2)} c/u · x{item.qty || 1}</span>
                      {item.link_url && (
                        <a
                          href={item.link_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={(e) => e.stopPropagation()}
                          className="inline-flex items-center gap-1 text-[10px] text-yellow-300/70 hover:text-yellow-300 transition-colors"
                        >
                          <LinkIcon className="w-2.5 h-2.5" /> ver link
                        </a>
                      )}
                    </div>
                  </div>
                  <span className="text-yellow-300 font-bold text-sm ml-4">
                    ${Number(item.total || Number(item.price || 0) * Number(item.qty || 1)).toFixed(2)}
                  </span>
                </div>
              ))}
            </div>
            <div className="px-5 py-3 border-t border-white/10 bg-black/20 flex justify-between items-center">
              <span className="text-xs text-gray-400 font-medium">Subtotal (sin IVU)</span>
              <span className="text-white font-bold text-base">${subtotal.toFixed(2)}</span>
            </div>
          </div>
        );
      })()}

      {/* Modules Grid */}
      <WorkOrderUnifiedHub order={order} onUpdate={onUpdate} accent="amber" title="Centro de Historial" subtitle="Compras, links, seguridad, fotos y notas agrupadas en un mismo centro." />

      {/* Catalog Modal Replacement */}
      <AddItemModal 
        open={showCatalog} 
        onClose={() => setShowCatalog(false)} 
        order={order}
        onUpdate={onUpdate}
        onRemoteSaved={handleCatalogRemoteSaved}
      />
      <OrderLinksDialog
        order={order}
        user={user}
        onUpdate={() => {
          loadLinks();
          onUpdate?.();
        }}
        open={activeModal === "links"}
        onOpenChange={(open) => setActiveModal(open ? "links" : null)}
        accent="amber"
        allowAdd={true}
        title="Links Guardados"
        subtitle="Gestión de compra"
        onLinksChange={setLinks}
      />
    </div>
  );
}
