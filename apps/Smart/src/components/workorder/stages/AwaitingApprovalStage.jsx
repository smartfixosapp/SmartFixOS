import { useState, useMemo } from "react";
import { ShoppingCart, Clock, Send, Plus, CheckCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import AddItemModal from "@/components/workorder/AddItemModal";
import WorkOrderUnifiedHub from "@/components/workorder/WorkOrderUnifiedHub";

export default function AwaitingApprovalStage({ order, onUpdate }) {
  const o = order || {};
  const [showCatalog, setShowCatalog] = useState(false);

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

  const whatsappHref = o.customer_phone
    ? `https://wa.me/${o.customer_phone.replace(/\D/g, "")}`
    : null;

  return (
    <div className="space-y-6">
      {/* ── Hero ── */}
      <section className="relative overflow-hidden rounded-[30px] border border-yellow-500/15 bg-[radial-gradient(circle_at_top_left,rgba(234,179,8,0.14),transparent_28%),radial-gradient(circle_at_bottom_right,rgba(249,115,22,0.10),transparent_30%),linear-gradient(135deg,rgba(20,18,6,0.98),rgba(20,14,6,0.96))] p-5 shadow-[0_22px_70px_rgba(0,0,0,0.35)] sm:p-6">
        <div className="absolute inset-0 bg-[linear-gradient(120deg,transparent,rgba(255,255,255,0.025),transparent)]" />
        <div className="relative z-10 grid gap-5 xl:grid-cols-[1.2fr_0.8fr] xl:items-start">
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-2">
              <Badge className="rounded-full border border-yellow-400/30 bg-yellow-500/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.25em] text-yellow-200">
                Esperando aprobación
              </Badge>
              <Badge variant="outline" className="rounded-full border-white/10 bg-white/5 px-3 py-1 text-xs text-white/65">
                Cliente por confirmar
              </Badge>
            </div>
            <div className="space-y-2">
              <p className="text-[11px] font-semibold uppercase tracking-[0.32em] text-white/35">Etapa activa</p>
              <div className="flex flex-wrap items-end gap-x-4 gap-y-2">
                <h2 className="text-3xl font-black tracking-tight text-white sm:text-4xl">Esperando Aprobación</h2>
                <div className="inline-flex items-center rounded-full border border-yellow-400/20 bg-yellow-500/10 px-3 py-1 text-sm font-semibold text-yellow-200">
                  {o.device_brand} {o.device_model}
                </div>
              </div>
              <p className="max-w-2xl text-sm leading-relaxed text-white/55">
                La cotización fue enviada al cliente. Ajusta piezas y servicios mientras esperas confirmación.
              </p>
            </div>

            <div className="grid gap-3 md:grid-cols-3">
              <div className="rounded-[22px] border border-white/10 bg-black/25 p-4 backdrop-blur-md">
                <p className="mb-1 text-[11px] font-semibold uppercase tracking-[0.24em] text-white/35">Cliente</p>
                <p className="truncate text-lg font-bold text-yellow-200">{o.customer_name || "No registrado"}</p>
              </div>
              <div className="rounded-[22px] border border-white/10 bg-black/25 p-4 backdrop-blur-md">
                <p className="mb-1 text-[11px] font-semibold uppercase tracking-[0.24em] text-white/35">Estimado</p>
                <p className="text-lg font-black text-white">${totals.total.toFixed(2)}</p>
              </div>
              <div className="rounded-[22px] border border-white/10 bg-black/25 p-4 backdrop-blur-md">
                <p className="mb-1 text-[11px] font-semibold uppercase tracking-[0.24em] text-white/35">Items</p>
                <p className="text-lg font-black text-white">{items.length}</p>
              </div>
            </div>
          </div>

          <div className="grid gap-3">
            <div className="rounded-[26px] border border-yellow-400/15 bg-black/25 p-5 backdrop-blur-md">
              <div className="flex items-start gap-3 mb-4">
                <div className="flex h-10 w-10 items-center justify-center rounded-2xl border border-yellow-400/20 bg-yellow-500/15">
                  <Clock className="h-5 w-5 text-yellow-300" />
                </div>
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-white/35">Acciones rápidas</p>
                  <h3 className="mt-0.5 text-base font-black text-white">Contactar al cliente</h3>
                </div>
              </div>
              <div className="space-y-2">
                {whatsappHref && (
                  <a
                    href={whatsappHref}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 w-full rounded-xl border border-emerald-500/25 bg-emerald-500/10 px-4 py-2.5 text-sm font-semibold text-emerald-200 hover:bg-emerald-500/20 transition"
                  >
                    <Send className="h-4 w-4" />
                    WhatsApp
                  </a>
                )}
                {o.customer_phone && (
                  <a
                    href={`tel:${o.customer_phone}`}
                    className="flex items-center gap-2 w-full rounded-xl border border-cyan-500/25 bg-cyan-500/10 px-4 py-2.5 text-sm font-semibold text-cyan-200 hover:bg-cyan-500/20 transition"
                  >
                    <CheckCircle className="h-4 w-4" />
                    Llamar
                  </a>
                )}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Piezas y Servicios ── */}
      <section className="relative overflow-hidden rounded-[30px] border border-yellow-500/15 bg-[radial-gradient(circle_at_top_left,rgba(234,179,8,0.08),transparent_24%),linear-gradient(180deg,rgba(24,24,27,0.98),rgba(10,10,12,0.98))] shadow-[0_22px_70px_rgba(0,0,0,0.35)]">
        <div className="absolute inset-0 bg-[linear-gradient(120deg,transparent,rgba(255,255,255,0.025),transparent)]" />
        <div className="relative z-10 border-b border-white/10 px-6 py-5">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="flex items-start gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-yellow-400/20 bg-yellow-500/15 shadow-[0_10px_30px_rgba(234,179,8,0.12)]">
                <ShoppingCart className="h-5 w-5 text-yellow-300" />
              </div>
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-white/35">Cotización operativa</p>
                <h3 className="mt-1 text-2xl font-black tracking-tight text-white">Piezas y Servicios</h3>
                <p className="mt-2 max-w-2xl text-sm leading-relaxed text-white/55">
                  Ajusta aquí los items mientras el cliente decide. La cotización refleja lo que está en esta lista.
                </p>
              </div>
            </div>
            <Button
              onClick={() => setShowCatalog(true)}
              className="h-10 rounded-2xl bg-gradient-to-r from-yellow-500 to-amber-500 px-5 font-bold text-slate-950 shadow-[0_12px_30px_rgba(234,179,8,0.22)] hover:from-yellow-400 hover:to-amber-400"
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
              <p className="text-sm font-semibold text-white/70">Sin items todavía</p>
              <p className="mt-1 text-xs text-white/40">Añade lo que necesitas para que el cliente vea la cotización completa.</p>
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
                        <p className="text-sm font-black text-yellow-300">${lineTotal.toFixed(2)}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
              <div className="border-t border-white/10 bg-black/35 px-5 py-3 flex justify-between items-center">
                <span className="text-xs text-white/50 font-semibold uppercase tracking-[0.16em]">Total estimado</span>
                <span className="text-lg font-black text-yellow-300">${totals.total.toFixed(2)}</span>
              </div>
            </div>
          )}
        </div>
      </section>

      <WorkOrderUnifiedHub
        order={o}
        onUpdate={onUpdate}
        accent="yellow"
        title="Centro de Historial"
        subtitle="Seguimiento mientras el cliente aprueba o rechaza la cotización."
      />

      <AddItemModal
        open={showCatalog}
        onClose={() => setShowCatalog(false)}
        order={o}
        onUpdate={onUpdate}
      />
    </div>
  );
}
