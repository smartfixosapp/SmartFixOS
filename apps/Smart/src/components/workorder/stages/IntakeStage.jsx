import { useMemo, useState } from "react";
import { AlertTriangle, ShoppingCart, Mail, Send, PhoneCall, Palette, ClipboardCheck, Package } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import AddItemModal from "@/components/workorder/AddItemModal";
import { logWorkOrderContactEvent } from "@/components/workorder/utils/auditEvents";
import WorkOrderUnifiedHub from "@/components/workorder/WorkOrderUnifiedHub";
import { Dialog, DialogContent } from "@/components/ui/dialog";

export default function IntakeStage({ order, onUpdate, onOrderItemsUpdate, onRemoteSaved }) {
  const o = order || {};
  const [showCatalog, setShowCatalog] = useState(false);
  const [previewPhoto, setPreviewPhoto] = useState(null);

  const phoneRaw = o.customer_phone || "";
  const digits = phoneRaw.replace(/\D+/g, "");
  const intl = digits.startsWith("1") ? digits : digits.length === 10 ? `1${digits}` : digits;
  const telHref = digits ? `tel:+${intl}` : null;
  const waHref = digits ? `https://wa.me/${intl}` : null;
  const photos = useMemo(() => {
    const source = o.photos_metadata || o.device_photos || [];
    return (Array.isArray(source) ? source : [])
      .map((photo) => photo?.publicUrl || photo?.thumbUrl || photo?.url)
      .filter(Boolean);
  }, [o.photos_metadata, o.device_photos]);

  const items = Array.isArray(o.order_items) ? o.order_items : [];

  const totals = useMemo(() => {
    const subtotal = items.reduce((sum, it) => {
      const qty = Number(it?.qty || 1);
      const price = Number(it?.price || 0);
      const discount = Number(it?.discount_percentage || 0);
      const line = price * qty;
      return sum + (line - line * (discount / 100));
    }, 0);
    const taxable = items.reduce((sum, it) => {
      if (it?.taxable === false) return sum;
      const qty = Number(it?.qty || 1);
      const price = Number(it?.price || 0);
      const discount = Number(it?.discount_percentage || 0);
      const line = price * qty;
      return sum + (line - line * (discount / 100));
    }, 0);
    const tax = taxable * 0.115;
    return { subtotal, tax, total: subtotal + tax };
  }, [items]);

  const handleContactClick = (event, channel, target, href, newTab = false) => {
    if (!href) return;
    event?.preventDefault?.();
    void logWorkOrderContactEvent({ order: o, channel, target });
    if (newTab) {
      window.open(href, "_blank", "noopener,noreferrer");
    } else {
      window.location.href = href;
    }
  };

  return (
    <div className="space-y-6">
      <section className="relative overflow-hidden rounded-[30px] border border-cyan-500/15 bg-[radial-gradient(circle_at_top_left,rgba(34,211,238,0.16),transparent_28%),radial-gradient(circle_at_bottom_right,rgba(168,85,247,0.16),transparent_30%),linear-gradient(135deg,rgba(11,22,36,0.98),rgba(18,12,32,0.96))] p-5 shadow-[0_22px_70px_rgba(0,0,0,0.35)] sm:p-6">
        <div className="absolute inset-0 bg-[linear-gradient(120deg,transparent,rgba(255,255,255,0.03),transparent)]" />
        <div className="relative z-10 grid gap-5 xl:grid-cols-[1.25fr_0.75fr] xl:items-start">
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-2">
              <Badge className="rounded-full border border-cyan-400/30 bg-cyan-500/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.25em] text-cyan-200">
                Recepcion
              </Badge>
              <Badge variant="outline" className="rounded-full border-white/10 bg-white/5 px-3 py-1 text-xs text-white/65">
                Problema inicial del equipo
              </Badge>
            </div>

            <div className="space-y-2">
              <p className="text-[11px] font-semibold uppercase tracking-[0.32em] text-white/35">Resumen rapido</p>
              <div className="flex flex-wrap items-end gap-x-4 gap-y-2">
                <h2 className="text-3xl font-black tracking-tight text-white sm:text-4xl">
                  {o.customer_name || "Cliente sin nombre"}
                </h2>
                <div className="inline-flex items-center rounded-full border border-fuchsia-400/20 bg-fuchsia-500/10 px-3 py-1 text-sm font-semibold text-fuchsia-200">
                  {o.device_brand} {o.device_model}
                </div>
              </div>
              <p className="max-w-2xl text-sm leading-relaxed text-white/55">
                Confirma contacto, datos del equipo y condiciones iniciales. Esta vista debe dejar clara la recepción sin obligarte a leer bloques pesados.
              </p>
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              <div className="rounded-[22px] border border-white/10 bg-black/25 p-4 backdrop-blur-md">
                <p className="mb-1 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.24em] text-white/35">
                  <ClipboardCheck className="h-3.5 w-3.5" /> Recepción
                </p>
                <p className="mb-1 truncate text-lg font-bold text-cyan-300">
                  {o.initial_problem || "Sin problema reportado"}
                </p>
                <p className="text-xs text-white/45">
                  {(o.checklist_items?.length || 0)} registro{(o.checklist_items?.length || 0) === 1 ? "" : "s"} documentado{(o.checklist_items?.length || 0) === 1 ? "" : "s"}
                </p>
              </div>
              <div className="rounded-[22px] border border-white/10 bg-black/25 p-4 backdrop-blur-md">
                <p className="mb-1 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.24em] text-white/35">
                  <Palette className="h-3.5 w-3.5" /> Fotos
                </p>
                {photos.length > 0 ? (
                  <div className="flex items-center gap-2">
                    {photos.slice(0, 3).map((src, idx) => (
                      <button
                        key={`${src}-${idx}`}
                        type="button"
                        onClick={() => setPreviewPhoto(src)}
                        className="h-14 w-14 overflow-hidden rounded-xl border border-white/10 bg-black/30 transition hover:scale-[1.03]"
                      >
                        <img src={src} alt={`Foto ${idx + 1}`} className="h-full w-full object-cover" />
                      </button>
                    ))}
                    <div className="text-xs font-semibold text-violet-200">
                      {photos.length} foto{photos.length === 1 ? "" : "s"}
                    </div>
                  </div>
                ) : (
                  <p className="truncate text-sm font-semibold text-violet-200">Sin fotos cargadas</p>
                )}
              </div>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-3 xl:grid-cols-1">
            <button
              type="button"
              onClick={(event) => handleContactClick(event, "call", o.customer_phone, telHref)}
              className={`flex min-h-[92px] flex-col items-start justify-between rounded-[24px] border px-4 py-4 text-left transition-all ${
                telHref
                  ? "border-cyan-400/25 bg-cyan-500/10 text-white hover:bg-cyan-500/15"
                  : "border-white/10 bg-white/5 text-white/35"
              }`}
            >
              <PhoneCall className="h-5 w-5" />
              <div>
                <p className="text-[11px] uppercase tracking-[0.25em] text-white/45">Llamar</p>
                <p className="text-sm font-bold">{o.customer_phone || "No disponible"}</p>
              </div>
            </button>

            <button
              type="button"
              onClick={(event) => handleContactClick(event, "whatsapp", o.customer_phone, waHref, true)}
              className={`flex min-h-[92px] flex-col items-start justify-between rounded-[24px] border px-4 py-4 text-left transition-all ${
                waHref
                  ? "border-emerald-400/25 bg-emerald-500/10 text-white hover:bg-emerald-500/15"
                  : "border-white/10 bg-white/5 text-white/35"
              }`}
            >
              <Send className="h-5 w-5" />
              <div>
                <p className="text-[11px] uppercase tracking-[0.25em] text-white/45">WhatsApp</p>
                <p className="text-sm font-bold">Mensaje rapido</p>
              </div>
            </button>

            <button
              type="button"
              onClick={(event) => handleContactClick(event, "email", o.customer_email, o.customer_email ? `mailto:${o.customer_email}` : null)}
              className={`flex min-h-[92px] flex-col items-start justify-between rounded-[24px] border px-4 py-4 text-left transition-all ${
                o.customer_email
                  ? "border-violet-400/25 bg-violet-500/10 text-white hover:bg-violet-500/15"
                  : "border-white/10 bg-white/5 text-white/35"
              }`}
            >
              <Mail className="h-5 w-5" />
              <div>
                <p className="text-[11px] uppercase tracking-[0.25em] text-white/45">Email</p>
                <p className="truncate text-sm font-bold">{o.customer_email || "No disponible"}</p>
              </div>
            </button>
          </div>
        </div>
      </section>

      {/* ── Piezas y Servicios ── */}
      <section className="relative overflow-hidden rounded-[30px] border border-cyan-500/15 bg-[radial-gradient(circle_at_top_left,rgba(34,211,238,0.12),transparent_26%),radial-gradient(circle_at_bottom_right,rgba(59,130,246,0.12),transparent_30%),linear-gradient(180deg,rgba(24,24,27,0.98),rgba(10,10,12,0.98))] shadow-[0_22px_70px_rgba(0,0,0,0.35)]">
        <div className="absolute inset-0 bg-[linear-gradient(120deg,transparent,rgba(255,255,255,0.025),transparent)]" />

        {/* Header */}
        <div className="relative z-10 border-b border-white/10 px-6 py-5">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="flex items-start gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-cyan-400/20 bg-cyan-500/15 shadow-[0_10px_30px_rgba(34,211,238,0.12)]">
                <ShoppingCart className="h-5 w-5 text-cyan-300" />
              </div>
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-white/35">Recepción y presupuesto</p>
                <h3 className="mt-1 text-2xl font-black tracking-tight text-white">Piezas y Servicios</h3>
                <p className="mt-2 max-w-2xl text-sm leading-relaxed text-white/55">
                  Si en recepción ya sabes qué hace falta, registra aquí piezas o servicios sin salir del flujo inicial.
                </p>
              </div>
            </div>
            <Button
              onClick={() => setShowCatalog(true)}
              className="h-10 rounded-2xl bg-gradient-to-r from-cyan-500 to-blue-500 px-5 font-bold text-slate-950 shadow-[0_12px_30px_rgba(34,211,238,0.22)] hover:from-cyan-400 hover:to-blue-400"
            >
              <ShoppingCart className="mr-2 h-4 w-4" />
              Piezas y Servicios
            </Button>
          </div>
        </div>

        {/* Items list */}
        <div className="relative z-10 p-6">
          {items.length === 0 ? (
            <div className="rounded-[24px] border border-dashed border-white/10 bg-black/20 px-6 py-10 text-center">
              <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl border border-white/10 bg-white/5">
                <Package className="h-5 w-5 text-white/35" />
              </div>
              <p className="text-sm font-semibold text-white/60">No hay items registrados</p>
              <p className="mt-1 text-xs text-white/35">Haz clic en "Piezas y Servicios" para agregar desde el catálogo.</p>
            </div>
          ) : (
            <div className="overflow-hidden rounded-[26px] border border-white/10 bg-black/25">
              <div className="divide-y divide-white/5">
                {items.map((item, idx) => {
                  const qty = Number(item?.qty || 1);
                  const price = Number(item?.price || 0);
                  const discount = Number(item?.discount_percentage || 0);
                  const lineTotal = (price * qty) - (price * qty * (discount / 100));
                  const isSvc = item?.type === "service";
                  return (
                    <div key={`${item?.id || item?.name}-${idx}`} className="flex items-start justify-between gap-4 p-4 hover:bg-white/[0.03] transition-colors">
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-bold text-white">{item?.name || "Item"}</p>
                        <div className="mt-1.5 flex flex-wrap gap-2">
                          <Badge variant="outline" className="rounded-full border-white/10 bg-white/5 px-2 py-0.5 text-[10px] text-gray-300">
                            ${price.toFixed(2)} c/u
                          </Badge>
                          <Badge variant="outline" className={`rounded-full border-white/10 px-2 py-0.5 text-[10px] ${isSvc ? "bg-violet-500/15 text-violet-300" : "bg-cyan-500/15 text-cyan-300"}`}>
                            {isSvc ? "Servicio" : "Pieza"}
                          </Badge>
                          {discount > 0 && (
                            <Badge variant="outline" className="rounded-full border-orange-500/20 bg-orange-500/10 px-2 py-0.5 text-[10px] text-orange-300">
                              -{discount}%
                            </Badge>
                          )}
                        </div>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <div className="inline-flex items-center rounded-full border border-white/10 bg-white/5 px-2.5 py-0.5 text-xs font-semibold text-white/60 mb-1.5">
                          x{qty}
                        </div>
                        <p className="text-xl font-black tracking-tight text-cyan-300">${lineTotal.toFixed(2)}</p>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Totals */}
              <div className="border-t border-white/10 bg-black/30 px-5 py-4 space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-white/50">Subtotal</span>
                  <span className="font-semibold text-white">${totals.subtotal.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-white/50">IVU (11.5%)</span>
                  <span className="font-semibold text-white">${totals.tax.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-base font-black pt-1 border-t border-white/10">
                  <span className="text-cyan-300">Total Estimado</span>
                  <span className="text-cyan-300 text-xl">${totals.total.toFixed(2)}</span>
                </div>
              </div>
            </div>
          )}
        </div>
      </section>

      <WorkOrderUnifiedHub
        order={o}
        onUpdate={onUpdate}
        accent="cyan"
        title="Centro de Historial"
        subtitle="Recepción, problema reportado, fotos, seguridad, notas y actividad reunidos en un solo módulo."
      />

      <AddItemModal
        open={showCatalog}
        onClose={() => setShowCatalog(false)}
        onSave={(newItems) => {
          onOrderItemsUpdate?.(newItems);
          setShowCatalog(false);
        }}
        onRemoteSaved={onRemoteSaved}
        order={o}
      />

      <Dialog open={Boolean(previewPhoto)} onOpenChange={(open) => !open && setPreviewPhoto(null)}>
        <DialogContent className="max-w-4xl border-white/10 bg-black/95 p-2">
          {previewPhoto ? (
            <img src={previewPhoto} alt="Vista previa" className="max-h-[80vh] w-full rounded-xl object-contain" />
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}
