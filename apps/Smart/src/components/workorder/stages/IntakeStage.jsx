import { useMemo, useState } from "react";
import { AlertTriangle, ShoppingCart, Mail, Send, PhoneCall, Palette, ClipboardCheck } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import AddItemModal from "@/components/workorder/AddItemModal";
import { logWorkOrderContactEvent } from "@/components/workorder/utils/auditEvents";
import WorkOrderUnifiedHub from "@/components/workorder/WorkOrderUnifiedHub";
import { Dialog, DialogContent } from "@/components/ui/dialog";

export default function IntakeStage({ order, onUpdate }) {
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

  const handleContactClick = (event, channel, target, href, newTab = false) => {
    if (!href) return;
    event?.preventDefault?.();
    void logWorkOrderContactEvent({
      order: o,
      channel,
      target
    });
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

      <section className="relative overflow-hidden rounded-[28px] border border-blue-500/20 bg-[linear-gradient(90deg,rgba(37,99,235,0.12),rgba(139,92,246,0.08))] p-5 shadow-[0_18px_50px_rgba(0,0,0,0.28)]">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_right,rgba(255,255,255,0.08),transparent_35%)] pointer-events-none" />
        <div className="relative z-10 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-start gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-blue-400/25 bg-blue-500/15">
              <AlertTriangle className="h-5 w-5 text-blue-400" />
            </div>
            <div>
              <h4 className="text-xl font-black tracking-tight text-white">Recepción del Equipo</h4>
              <p className="text-sm font-medium text-white/55">
                Verifica estado físico, funcional y prepara la orden con piezas o servicios si hace falta.
              </p>
            </div>
          </div>

          <Button
            onClick={() => setShowCatalog(true)}
            className="flex h-11 items-center whitespace-nowrap rounded-2xl border border-white/15 bg-white px-5 font-bold text-purple-700 shadow-lg transition-all hover:scale-[1.03] hover:bg-white/95 active:scale-95"
          >
            <ShoppingCart className="mr-2 h-4 w-4 flex-shrink-0" />
            <span>Piezas y Servicios</span>
          </Button>
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
        order={o}
        onUpdate={onUpdate}
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
