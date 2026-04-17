import { useState, useMemo } from "react";
import { ShoppingCart, XCircle, AlertTriangle, Wrench, Plus, PhoneCall, MessageCircle, Mail } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import AddItemModal from "@/components/workorder/AddItemModal";
import WorkOrderUnifiedHub from "@/components/workorder/WorkOrderUnifiedHub";

export default function CancelledStage({ order, onUpdate, compact }) {
  const o = order || {};
  const [showCatalog, setShowCatalog] = useState(false);

  const cancelReason =
    o?.status_metadata?.cancellation_reason ||
    o?.cancellation_reason ||
    "No se registró motivo de cancelación.";

  const items = useMemo(() => Array.isArray(o.order_items) ? o.order_items : [], [o.order_items]);

  const totals = useMemo(() => {
    const subtotal = items.reduce((sum, item) => {
      const qty = Number(item?.qty || item?.quantity || 1);
      const price = Number(item?.price || 0);
      const discount = Number(item?.discount_percentage || 0);
      const line = price * qty;
      return sum + (line - line * (discount / 100));
    }, 0);
    const tax = items
      .filter((i) => i?.taxable !== false)
      .reduce((sum, item) => {
        const qty = Number(item?.qty || item?.quantity || 1);
        const price = Number(item?.price || 0);
        const discount = Number(item?.discount_percentage || 0);
        const line = price * qty;
        return sum + (line - line * (discount / 100));
      }, 0) * 0.115;
    return { subtotal, tax, total: subtotal + tax };
  }, [items]);

  return (
    <div className="space-y-6">
      {/* ── Hero ── */}
      {!compact && (
      <section className="relative overflow-hidden rounded-[30px] border border-red-500/15 bg-[radial-gradient(circle_at_top_left,rgba(239,68,68,0.14),transparent_28%),radial-gradient(circle_at_bottom_right,rgba(249,115,22,0.10),transparent_30%),linear-gradient(135deg,rgba(24,8,8,0.98),rgba(20,10,10,0.96))] p-5 shadow-[0_22px_70px_rgba(0,0,0,0.35)] sm:p-6">
        <div className="absolute inset-0 bg-[linear-gradient(120deg,transparent,rgba(255,255,255,0.025),transparent)]" />
        <div className="relative z-10 grid gap-5 xl:grid-cols-[1.2fr_0.8fr] xl:items-start">
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-2">
              <Badge className="rounded-full border border-red-400/30 bg-red-500/10 px-3 py-1 text-[11px] font-semibold tracking-[0.25em] text-red-200">
                Cancelado
              </Badge>
              <Badge variant="outline" className="rounded-full border-white/10 bg-white/5 px-3 py-1 text-xs text-white/65">
                Orden cerrada
              </Badge>
            </div>
            <div className="space-y-2">
              <p className="text-[11px] font-semibold tracking-[0.32em] text-white/35">Estado</p>
              <div className="flex flex-wrap items-end gap-x-4 gap-y-2">
                <h2 className="text-3xl font-semibold tracking-tight text-white sm:text-4xl">Orden Cancelada</h2>
                <div className="inline-flex items-center rounded-full border border-red-400/20 bg-red-500/10 px-3 py-1 text-sm font-semibold text-red-200">
                  {o.device_brand} {o.device_model}
                </div>
              </div>
              <p className="max-w-2xl text-sm leading-relaxed text-white/55">
                Esta orden fue cancelada. Aún puedes consultarla, revisar sus piezas y el historial registrado.
              </p>
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              <div className="rounded-[22px] border border-white/10 bg-black/25 p-4 backdrop-blur-md">
                <p className="mb-1 text-[11px] font-semibold tracking-[0.24em] text-white/35">Cliente</p>
                <p className="truncate text-lg font-bold text-red-200">{o.customer_name || "No registrado"}</p>
              </div>
              <div className="rounded-[22px] border border-red-500/20 bg-red-500/5 p-4 backdrop-blur-md">
                <div className="flex items-start gap-2">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-red-400" />
                  <div>
                    <p className="text-[11px] font-semibold tracking-[0.24em] text-white/35">Motivo</p>
                    <p className="mt-1 text-sm font-semibold text-red-200 leading-relaxed">{cancelReason}</p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="rounded-[26px] border border-red-400/15 bg-black/25 p-5 backdrop-blur-md">
            <div className="flex items-start gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-red-400/20 bg-red-500/15">
                <XCircle className="h-5 w-5 text-red-300" />
              </div>
              <div className="min-w-0">
                <p className="text-[11px] font-semibold tracking-[0.28em] text-white/35">Impacto</p>
                <h3 className="mt-1 text-xl font-semibold tracking-tight text-white">
                  {items.length > 0 ? `${items.length} item${items.length > 1 ? "s" : ""} en la orden` : "Sin items registrados"}
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-white/55">
                  {totals.total > 0 ? `Total estimado: $${totals.total.toFixed(2)}` : "No hay costos registrados."}
                </p>
              </div>
            </div>
          </div>
        </div>
        {(o.customer_phone || o.customer_email) && (() => {
          const phone = o.customer_phone || "";
          const email = o.customer_email || "";
          const digits = phone.replace(/\D/g, "");
          const intl = digits.startsWith("1") ? digits : digits.length === 10 ? `1${digits}` : digits;
          return (
            <div className="relative z-10 mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
              {digits && (
                <a href={`tel:+${intl}`} className="flex items-center justify-center gap-3 h-14 rounded-2xl border border-white/15 bg-white/5 text-white hover:bg-white/10 font-bold text-sm tracking-wide transition-all active:scale-95">
                  <PhoneCall className="w-5 h-5 text-white/60" />{phone}
                </a>
              )}
              {digits && (
                <a href={`https://wa.me/${intl}`} target="_blank" rel="noreferrer"
                  className="flex items-center justify-center gap-3 h-14 rounded-2xl border border-emerald-500/30 bg-emerald-500/12 text-emerald-300 hover:bg-emerald-500/20 font-bold text-sm tracking-wide transition-all active:scale-95">
                  <MessageCircle className="w-5 h-5" />WhatsApp
                </a>
              )}
              {email && (
                <a href={`mailto:${email}`} className="flex items-center justify-center gap-3 h-14 rounded-2xl border border-blue-500/30 bg-blue-500/12 text-blue-300 hover:bg-blue-500/20 font-bold text-sm tracking-wide transition-all active:scale-95">
                  <Mail className="w-5 h-5" /><span className="truncate">{email}</span>
                </a>
              )}
            </div>
          );
        })()}
      </section>
      )}

      {/* ── Cancellation reason (compact) ── */}
      {compact && (
        <div className="rounded-[22px] border border-red-500/20 bg-red-500/5 p-4">
          <div className="flex items-start gap-2">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-red-400" />
            <div>
              <p className="text-[11px] font-semibold tracking-[0.24em] text-white/35">Motivo de cancelación</p>
              <p className="mt-1 text-sm font-semibold text-red-200 leading-relaxed">{cancelReason}</p>
            </div>
          </div>
        </div>
      )}

      {/* ── Piezas y Servicios ── */}
      <section className="relative overflow-hidden rounded-[30px] border border-red-500/15 bg-[radial-gradient(circle_at_top_left,rgba(239,68,68,0.08),transparent_24%),linear-gradient(180deg,rgba(24,24,27,0.98),rgba(10,10,12,0.98))] shadow-[0_22px_70px_rgba(0,0,0,0.35)]">
        <div className="absolute inset-0 bg-[linear-gradient(120deg,transparent,rgba(255,255,255,0.025),transparent)]" />
        <div className="relative z-10 border-b border-white/10 px-6 py-5">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="flex items-start gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-red-400/20 bg-red-500/15 shadow-[0_10px_30px_rgba(239,68,68,0.12)]">
                <ShoppingCart className="h-5 w-5 text-red-300" />
              </div>
              <div>
                <p className="text-[11px] font-semibold tracking-[0.28em] text-white/35">Cotización operativa</p>
                <h3 className="mt-1 text-2xl font-semibold tracking-tight text-white">Piezas y Servicios</h3>
                <p className="mt-2 max-w-2xl text-sm leading-relaxed text-white/55">
                  Conserva aquí la lista de piezas y servicios asociados a esta orden aunque esté cancelada.
                </p>
              </div>
            </div>
            <Button
              onClick={() => setShowCatalog(true)}
              className="h-10 rounded-2xl bg-gradient-to-r from-red-600 to-orange-600 px-5 font-bold text-white shadow-[0_12px_30px_rgba(239,68,68,0.22)] hover:from-red-500 hover:to-orange-500"
            >
              <Plus className="mr-2 h-4 w-4" />
              Añadir
            </Button>
          </div>
        </div>

        <div className="relative z-10 p-6">
          {items.length === 0 ? (
            <div className="rounded-[24px] border border-dashed border-white/10 bg-black/20 px-6 py-12 text-center">
              <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl border border-white/10 bg-white/5">
                <ShoppingCart className="h-6 w-6 text-white/35" />
              </div>
              <p className="text-sm font-semibold text-white/70">No hay piezas ni servicios</p>
              <p className="mt-1 text-xs text-white/40">Añade items si necesitas dejar evidencia de lo cotizado.</p>
            </div>
          ) : (
            <div className="overflow-hidden rounded-[22px] border border-white/10 bg-black/25">
              <div className="divide-y divide-white/5">
                {items.map((item, idx) => {
                  const qty = Number(item?.qty || item?.quantity || 1);
                  const price = Number(item?.price || 0);
                  const discount = Number(item?.discount_percentage || 0);
                  const lineTotal = price * qty - price * qty * (discount / 100);
                  return (
                    <div key={`${item?.id || item?.name}-${idx}`} className="flex items-center justify-between gap-4 p-4 hover:bg-white/[0.03] transition-colors">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-bold text-white">{item?.name || "Item"}</p>
                        <p className="text-xs text-white/40">${price.toFixed(2)} c/u · {item?.type === "service" ? "Servicio" : "Producto"}</p>
                      </div>
                      <div className="shrink-0 text-right">
                        <p className="text-xs text-white/40">x{qty}</p>
                        <p className="text-sm font-semibold text-red-300">${lineTotal.toFixed(2)}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
              <div className="border-t border-white/10 bg-black/35 px-5 py-3 flex justify-between items-center">
                <span className="text-xs text-white/50 font-semibold tracking-[0.16em]">Total estimado</span>
                <span className="text-lg font-semibold text-red-300">${totals.total.toFixed(2)}</span>
              </div>
            </div>
          )}
        </div>
      </section>

      {!compact && (
      <WorkOrderUnifiedHub
        order={o}
        onUpdate={onUpdate}
        accent="red"
        title="Centro de Historial"
        subtitle="Notas, fotos, actividad y evidencia de la orden cancelada."
      />
      )}

      <AddItemModal
        open={showCatalog}
        onClose={() => setShowCatalog(false)}
        order={o}
        onUpdate={onUpdate}
      />
    </div>
  );
}
