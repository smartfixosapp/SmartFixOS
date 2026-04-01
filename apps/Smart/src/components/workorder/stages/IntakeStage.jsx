import { useMemo, useState } from "react";
import { Palette, ClipboardCheck, PhoneCall, MessageCircle, Mail } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import WorkOrderUnifiedHub from "@/components/workorder/WorkOrderUnifiedHub";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import SharedItemsSection from "@/components/workorder/SharedItemsSection";

export default function IntakeStage({ order, onUpdate, onOrderItemsUpdate, onRemoteSaved, onPaymentClick }) {
  const o = order || {};
  const [previewPhoto, setPreviewPhoto] = useState(null);

  const photos = useMemo(() => {
    const source = o.photos_metadata || o.device_photos || [];
    return (Array.isArray(source) ? source : [])
      .map((photo) => photo?.publicUrl || photo?.thumbUrl || photo?.url)
      .filter(Boolean);
  }, [o.photos_metadata, o.device_photos]);

  return (
    <div className="space-y-6">
      <section className="relative overflow-hidden rounded-[30px] border border-cyan-500/15 bg-[radial-gradient(circle_at_top_left,rgba(34,211,238,0.16),transparent_28%),radial-gradient(circle_at_bottom_right,rgba(168,85,247,0.16),transparent_30%),linear-gradient(135deg,rgba(11,22,36,0.98),rgba(18,12,32,0.96))] p-5 shadow-[0_22px_70px_rgba(0,0,0,0.35)] sm:p-6">
        <div className="absolute inset-0 bg-[linear-gradient(120deg,transparent,rgba(255,255,255,0.03),transparent)]" />
        <div className="relative z-10">
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
                        <img src={src} alt={`Foto ${idx + 1}`} loading="lazy" decoding="async" className="h-full w-full object-cover" />
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
        </div>
        {(o.customer_phone || o.customer_email) && (() => {
          const phone = o.customer_phone || "";
          const email = o.customer_email || "";
          const digits = phone.replace(/\D/g, "");
          const intl = digits.startsWith("1") ? digits : digits.length === 10 ? `1${digits}` : digits;
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

      <SharedItemsSection
        order={o}
        onUpdate={onUpdate}
        onOrderItemsUpdate={onOrderItemsUpdate}
        onRemoteSaved={onRemoteSaved}
        onPaymentClick={onPaymentClick}
        accentColor="cyan"
        subtitle="Si en recepción ya sabes qué hace falta, registra aquí piezas o servicios sin salir del flujo inicial."
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
