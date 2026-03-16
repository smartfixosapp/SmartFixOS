import React, { useState, useEffect, useMemo } from "react";
import { Badge } from "@/components/ui/badge";
import { ShoppingCart, Plus, CheckCircle2, MessageSquare, ReceiptText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { base44 } from "@/api/base44Client";
import WorkOrderUnifiedHub from "@/components/workorder/WorkOrderUnifiedHub";
import AddItemModal from "@/components/workorder/AddItemModal";

export default function PartArrivedStage({ order, onUpdate }) {
  const o = order || {};
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
      const data = await base44.entities.WorkOrderEvent.filter(
        {
          order_id: order.id,
          event_type: "link_added"
        },
        "-created_date",
        20
      );
      setLinks(data || []);
    } catch (e) {
      console.error(e);
    }
  };

  const getTrackingUrl = (trackingNumber) => {
    if (!trackingNumber || trackingNumber === "—") return null;
    const t = trackingNumber.trim().toUpperCase();
    if (t.startsWith("1Z") || (t.length === 12 && /^[0-9]+$/.test(t))) return `https://www.ups.com/track?tracknum=${t}`;
    if (t.length === 12 || t.length === 15 || t.length === 20 || t.length === 22 || t.length === 34) {
      if (/^[0-9]+$/.test(t)) {
        if (t.length === 12 || t.length === 15) return `https://www.fedex.com/fedextrack/?trknbr=${t}`;
        return `https://tools.usps.com/go/TrackConfirmAction?tLabels=${t}`;
      }
    }
    if (t.startsWith("9")) return `https://tools.usps.com/go/TrackConfirmAction?tLabels=${t}`;
    if (t.length === 10 && /^[0-9]+$/.test(t)) return `https://www.dhl.com/en/express/tracking.html?AWB=${t}`;
    return `https://www.google.com/search?q=${t}`;
  };

  const latestLink = links.length > 0 ? links[0] : null;
  const linkMeta = latestLink?.metadata || {};
  let fallbackPart = linkMeta.partName || linkMeta.part || linkMeta.name;
  let fallbackUrl = linkMeta.link || linkMeta.url;

  if (!fallbackPart && latestLink?.description) {
    const match = latestLink.description.match(/🔗 (.*?):/);
    if (match) fallbackPart = match[1];
  }

  const displayPartName = o.part_name || fallbackPart || "—";
  const displaySupplier = o.parts_supplier || (fallbackUrl ? new URL(fallbackUrl).hostname.replace("www.", "") : "—");
  const displayCarrier = o.parts_carrier || "—";
  const displayTracking = o.parts_tracking || "—";
  const trackingUrl = getTrackingUrl(displayTracking);
  const deviceLocation = o.device_location || "";
  const customerDigits = String(o.customer_phone || "").replace(/\D+/g, "");
  const waDigits = customerDigits.startsWith("1") ? customerDigits : customerDigits.length === 10 ? `1${customerDigits}` : customerDigits;
  const items = Array.isArray(o.order_items) ? o.order_items : [];

  const totals = useMemo(() => {
    const subtotal = items.reduce((sum, item) => {
      const qty = Number(item?.qty || item?.quantity || 1);
      const price = Number(item?.price || 0);
      const discount = Number(item?.discount_percentage || 0);
      const line = price * qty;
      return sum + (line - line * (discount / 100));
    }, 0);

    const taxableSubtotal = items.reduce((sum, item) => {
      if (item?.taxable === false) return sum;
      const qty = Number(item?.qty || item?.quantity || 1);
      const price = Number(item?.price || 0);
      const discount = Number(item?.discount_percentage || 0);
      const line = price * qty;
      return sum + (line - line * (discount / 100));
    }, 0);

    const tax = taxableSubtotal * 0.115;
    const total = subtotal + tax;
    const paid = Number(o?.total_paid || o?.amount_paid || 0);
    const balance = Math.max(0, total - paid);

    return { subtotal, tax, total, balance };
  }, [items, o?.total_paid, o?.amount_paid]);

  const updateDeviceLocation = async (nextLocation) => {
    try {
      await base44.entities.Order.update(o.id, { device_location: nextLocation });
      await base44.entities.WorkOrderEvent.create({
        order_id: o.id,
        order_number: o.order_number,
        event_type: "device_location_updated",
        description: `Ubicación del equipo actualizada: ${nextLocation === "taller" ? "En Taller" : "Con Cliente"}`,
        metadata: { location: nextLocation }
      });
      onUpdate?.();
    } catch (error) {
      console.error(error);
    }
  };

  const handleNotifyClient = () => {
    if (!waDigits) return;
    const text = `Hola ${o.customer_name || ""}, ya tenemos la pieza de tu orden ${o.order_number || ""}. Cuando puedas, trae el equipo para completar el trabajo.`.trim();
    window.open(`https://wa.me/${waDigits}?text=${encodeURIComponent(text)}`, "_blank", "noopener,noreferrer");
  };

  return (
    <div className="space-y-6">
      <section className="relative overflow-hidden rounded-[30px] border border-amber-500/15 bg-[radial-gradient(circle_at_top_left,rgba(251,191,36,0.16),transparent_28%),radial-gradient(circle_at_bottom_right,rgba(249,115,22,0.14),transparent_30%),linear-gradient(135deg,rgba(33,20,8,0.98),rgba(20,16,10,0.96))] p-5 shadow-[0_22px_70px_rgba(0,0,0,0.35)] sm:p-6">
        <div className="absolute inset-0 bg-[linear-gradient(120deg,transparent,rgba(255,255,255,0.03),transparent)]" />
        <div className="relative z-10 grid gap-5 xl:grid-cols-[1.2fr_0.8fr] xl:items-start">
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-2">
              <Badge className="rounded-full border border-amber-400/30 bg-amber-500/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.25em] text-amber-200">Pieza lista</Badge>
              <Badge variant="outline" className="rounded-full border-white/10 bg-white/5 px-3 py-1 text-xs text-white/65">Esperando cliente</Badge>
            </div>
            <div className="space-y-2">
              <p className="text-[11px] font-semibold uppercase tracking-[0.32em] text-white/35">Etapa activa</p>
              <div className="flex flex-wrap items-end gap-x-4 gap-y-2">
                <h2 className="text-3xl font-black tracking-tight text-white sm:text-4xl">Pieza Recibida</h2>
                <div className="inline-flex items-center rounded-full border border-amber-400/20 bg-amber-500/10 px-3 py-1 text-sm font-semibold text-amber-200">{o.device_brand} {o.device_model}</div>
              </div>
              <p className="max-w-2xl text-sm leading-relaxed text-white/55">La pieza ya está disponible. Esta vista debe dejar claro dónde está el equipo y qué pedido llegó para poder llamar al cliente sin fricción.</p>
            </div>
            <div className="grid gap-3 md:grid-cols-3">
              <div className="rounded-[22px] border border-white/10 bg-black/25 p-4 backdrop-blur-md">
                <p className="mb-1 text-[11px] font-semibold uppercase tracking-[0.24em] text-white/35">Cliente</p>
                <p className="truncate text-lg font-bold text-amber-200">{o.customer_name || "No registrado"}</p>
              </div>
              <div className="rounded-[22px] border border-white/10 bg-black/25 p-4 backdrop-blur-md">
                <p className="mb-1 text-[11px] font-semibold uppercase tracking-[0.24em] text-white/35">Ubicación del equipo</p>
                <p className="truncate text-sm font-semibold text-white/75">
                  {deviceLocation === "taller" ? "En Taller" : deviceLocation === "cliente" ? "Con Cliente" : "Sin confirmar"}
                </p>
              </div>
              <div className="rounded-[22px] border border-white/10 bg-black/25 p-4 backdrop-blur-md">
                <p className="mb-1 text-[11px] font-semibold uppercase tracking-[0.24em] text-white/35">Detalles del pedido</p>
                <p className="truncate text-sm font-semibold text-white/75">{displayPartName}</p>
                <p className="mt-1 text-xs text-white/45">{displaySupplier} · {displayCarrier} · {displayTracking}</p>
              </div>
            </div>
          </div>

          <div className="rounded-[26px] border border-amber-400/15 bg-black/25 p-5 backdrop-blur-md">
            <div className="flex items-start gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-amber-400/20 bg-amber-500/15">
                <CheckCircle2 className="h-5 w-5 text-amber-300" />
              </div>
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-white/35">Siguiente paso</p>
                <h3 className="mt-1 text-xl font-black tracking-tight text-white">Estado del equipo</h3>
                <p className="mt-2 text-sm leading-relaxed text-white/55">Confirma si el equipo está con el cliente o en el taller. Si lo tiene el cliente, puedes avisarle de inmediato.</p>
                <div className="mt-4 flex flex-wrap gap-2">
                  <Button onClick={() => updateDeviceLocation("taller")} className="rounded-2xl border-0 bg-emerald-600 px-4 text-white shadow-lg shadow-emerald-950/25 hover:bg-emerald-500">
                    En Taller
                  </Button>
                  <Button onClick={() => updateDeviceLocation("cliente")} className="rounded-2xl border-0 bg-amber-600 px-4 text-white shadow-lg shadow-amber-950/25 hover:bg-amber-500">
                    Con Cliente
                  </Button>
                  {deviceLocation === "cliente" && (
                    <Button onClick={handleNotifyClient} variant="outline" className="rounded-2xl border-white/10 bg-white/5 text-white hover:bg-white/10">
                      <MessageSquare className="mr-2 h-4 w-4" />
                      Notificar cliente
                    </Button>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="relative overflow-hidden rounded-[30px] border border-amber-500/15 bg-[radial-gradient(circle_at_top_left,rgba(250,204,21,0.10),transparent_24%),radial-gradient(circle_at_bottom_right,rgba(20,184,166,0.10),transparent_28%),linear-gradient(180deg,rgba(24,24,27,0.98),rgba(10,10,12,0.98))] shadow-[0_22px_70px_rgba(0,0,0,0.35)]">
        <div className="absolute inset-0 bg-[linear-gradient(120deg,transparent,rgba(255,255,255,0.025),transparent)]" />
        <div className="relative z-10 border-b border-white/10 px-6 py-5">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-start gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-amber-400/20 bg-amber-500/15 shadow-[0_10px_30px_rgba(250,204,21,0.12)]">
                <ShoppingCart className="h-5 w-5 text-amber-200" />
              </div>
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-white/35">Compra y costo</p>
                <h3 className="mt-1 text-2xl font-black tracking-tight text-white">Piezas y Servicios</h3>
                <p className="mt-2 max-w-2xl text-sm leading-relaxed text-white/55">
                  Aunque la pieza ya llegó, aquí mantienes a la vista los artículos, el costo y el balance antes de pasar a reparación o entrega.
                </p>
              </div>
            </div>
            <Button
              size="sm"
              onClick={() => setShowCatalog(true)}
              className="h-10 rounded-2xl bg-gradient-to-r from-amber-500 to-orange-500 px-5 font-bold text-black shadow-[0_12px_30px_rgba(245,158,11,0.25)] hover:from-amber-400 hover:to-orange-400"
            >
              <Plus className="mr-2 h-4 w-4" />
              Añadir
            </Button>
          </div>
        </div>

        <div className="relative z-10 p-6">
          {items.length === 0 ? (
            <div className="rounded-[24px] border border-dashed border-white/10 bg-black/20 px-6 py-14 text-center">
              <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl border border-white/10 bg-white/5">
                <ShoppingCart className="h-6 w-6 text-white/35" />
              </div>
              <p className="text-sm font-semibold text-white/70">No hay items en esta orden</p>
              <p className="mt-2 text-xs text-white/40">Añade piezas o servicios para mantener el costo visible mientras esperas al cliente.</p>
            </div>
          ) : (
            <div className="overflow-hidden rounded-[26px] border border-white/10 bg-black/25 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]">
              <div className="divide-y divide-white/5">
                {items.map((item, idx) => {
                  const qty = Number(item?.qty || item?.quantity || 1);
                  const price = Number(item?.price || 0);
                  const discount = Number(item?.discount_percentage || 0);
                  const lineTotal = (price * qty) - (price * qty * (discount / 100));
                  return (
                    <div key={`${item?.id || item?.name || "item"}-${idx}`} className="p-5 transition-colors hover:bg-white/[0.04]">
                      <div className="flex items-start justify-between gap-4">
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-base font-bold text-white">{item?.name || "Item"}</p>
                          <p className="mt-1 text-xs text-white/35">
                            {item?.type === "service" ? "Servicio ya disponible para completar el trabajo." : "Producto ya recibido y listo para usarse."}
                          </p>
                          <div className="mt-3 flex flex-wrap gap-2">
                            <Badge variant="outline" className="rounded-full border-white/10 bg-white/5 px-2.5 py-1 text-[10px] text-gray-300">
                              ${price.toFixed(2)} c/u
                            </Badge>
                            <Badge variant="outline" className="rounded-full border-white/10 bg-white/5 px-2.5 py-1 text-[10px] text-gray-300">
                              {item?.type === "service" ? "Servicio" : "Producto"}
                            </Badge>
                            {item?.taxable === false && (
                              <Badge className="rounded-full border-purple-500/30 bg-purple-500/20 px-2.5 py-1 text-[10px] text-purple-300">
                                Sin IVU
                              </Badge>
                            )}
                          </div>
                        </div>
                        <div className="pl-4 text-right">
                          <div className="inline-flex items-center rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-semibold text-white/70">
                            x{qty}
                          </div>
                          <p className="mt-3 text-3xl font-black tracking-tight text-amber-300">${lineTotal.toFixed(2)}</p>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="grid gap-4 border-t border-white/10 bg-black/35 p-5 lg:grid-cols-[1fr_360px]">
                <div className="space-y-3">
                  <div className="rounded-[20px] border border-white/8 bg-black/20 px-5 py-4">
                    <div className="flex items-center justify-between text-sm">
                      <span className="font-medium text-gray-400">Subtotal</span>
                      <span className="text-xl font-black tracking-tight text-white">${totals.subtotal.toFixed(2)}</span>
                    </div>
                  </div>
                  <div className="rounded-[20px] border border-white/8 bg-black/20 px-5 py-4">
                    <div className="flex items-center justify-between text-sm">
                      <span className="font-medium text-gray-400">IVU (11.5%)</span>
                      <span className="text-xl font-black tracking-tight text-white">${totals.tax.toFixed(2)}</span>
                    </div>
                  </div>
                  <div className="rounded-[20px] border border-emerald-500/15 bg-emerald-500/10 px-5 py-4">
                    <div className="flex items-center justify-between">
                      <span className="text-base font-bold text-white">Balance actual</span>
                      <span className="text-3xl font-black tracking-tight text-white">${totals.balance.toFixed(2)}</span>
                    </div>
                  </div>
                </div>

                <div className="rounded-[24px] border border-amber-500/15 bg-[linear-gradient(180deg,rgba(245,158,11,0.08),rgba(0,0,0,0.18))] p-5">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-white/35">Estado económico</p>
                  <h4 className="mt-2 text-2xl font-black tracking-tight text-white">
                    {totals.balance > 0.01 ? "Cargos visibles" : "Sin balance pendiente"}
                  </h4>
                  <p className="mt-2 text-sm leading-relaxed text-white/55">
                    Úsalo para validar de inmediato qué piezas ya impactaron el total antes de mover la orden al siguiente estado.
                  </p>
                  <div className="mt-5 rounded-[18px] border border-white/10 bg-black/20 p-4">
                    <div className="flex items-center gap-2">
                      <ReceiptText className="h-4 w-4 text-amber-200" />
                      <span className="text-sm font-semibold text-white">Total estimado</span>
                    </div>
                    <p className="mt-3 text-3xl font-black tracking-tight text-amber-200">${totals.total.toFixed(2)}</p>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </section>

      <WorkOrderUnifiedHub order={order} onUpdate={onUpdate} accent="amber" title="Centro de Historial" subtitle="Llegada de pieza, evidencia, seguridad y notas sincronizadas en un solo lugar." />
      <AddItemModal
        open={showCatalog}
        onClose={() => setShowCatalog(false)}
        order={o}
        onUpdate={onUpdate}
      />
    </div>
  );
}
