import React, { useMemo, useState } from "react";
import {
  Wrench,
  Camera,
  Shield,
  CheckCircle2,
  Activity,
  Sparkles,
  LockKeyhole,
  BadgeCheck,
  ShoppingCart,
  Plus,
  Package2,
  ReceiptText,
  TimerReset,
  ClipboardList
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import WorkOrderUnifiedHub from "@/components/workorder/WorkOrderUnifiedHub";
import AddItemModal from "@/components/workorder/AddItemModal";

export default function RepairStage({ order, onUpdate }) {
  const o = order || {};
  const [showCatalog, setShowCatalog] = useState(false);

  const mediaCount = useMemo(() => {
    const pools = [
      Array.isArray(o.photos_metadata) ? o.photos_metadata.length : 0,
      Array.isArray(o.photos) ? o.photos.length : 0,
      Array.isArray(o.videos) ? o.videos.length : 0,
      Array.isArray(o.media_files) ? o.media_files.length : 0,
      Array.isArray(o.multimedia) ? o.multimedia.length : 0
    ];
    return Math.max(...pools, 0);
  }, [o]);

  const securityCount = useMemo(() => {
    return [
      o?.device_security?.device_pin,
      o?.device_security?.device_password,
      o?.device_security?.pattern_vector,
      o?.device_security?.pattern_image,
      o.unlock_pin,
      o.device_pin,
      o.device_password,
      o.password,
      o.pattern_code,
      o.android_pattern
    ].filter(Boolean).length;
  }, [o]);

  const checklistCount = Array.isArray(o.checklist_items) ? o.checklist_items.length : 0;
  const orderItems = Array.isArray(o.order_items) ? o.order_items : [];
  const itemCount = orderItems.length;
  const itemTotal = useMemo(
    () =>
      orderItems.reduce((sum, item) => {
        const qty = Number(item?.qty || item?.quantity || 1);
        const price = Number(item?.price || 0);
        return sum + qty * price;
      }, 0),
    [orderItems]
  );
  const itemPreview = orderItems.slice(0, 3);

  const historyHint = useMemo(() => {
    if (o.updated_date) {
      return `Actualizado ${new Date(o.updated_date).toLocaleDateString()}`;
    }
    return "Sin cambios recientes";
  }, [o.updated_date]);

  const focusItems = useMemo(() => {
    const items = [];
    if (itemCount === 0) {
      items.push({
        id: "items",
        title: "Añadir lo que usarás",
        text: "Registra piezas o servicios solo si impactan la reparación o el cobro final.",
        icon: ShoppingCart,
        tone: "text-amber-300 bg-amber-500/10"
      });
    }
    if (mediaCount === 0) {
      items.push({
        id: "media",
        title: "Documentar antes y después",
        text: "Toma evidencia de intervención para dejar rastro técnico del trabajo.",
        icon: Camera,
        tone: "text-cyan-300 bg-cyan-500/10"
      });
    }
    if (securityCount === 0) {
      items.push({
        id: "security",
        title: "Verificar accesos",
        text: "Confirma PIN, patrón o contraseña antes de pruebas finales.",
        icon: LockKeyhole,
        tone: "text-violet-300 bg-violet-500/10"
      });
    }
    if (items.length === 0) {
      items.push({
        id: "clear",
        title: "Flujo técnico limpio",
        text: "La orden ya tiene evidencia, accesos y piezas registradas para avanzar sin fricción.",
        icon: CheckCircle2,
        tone: "text-emerald-300 bg-emerald-500/10"
      });
    }
    return items.slice(0, 3);
  }, [itemCount, mediaCount, securityCount]);

  return (
    <div className="space-y-6">
      <section className="relative overflow-hidden rounded-[30px] border border-emerald-500/15 bg-[radial-gradient(circle_at_top_left,rgba(16,185,129,0.16),transparent_28%),radial-gradient(circle_at_bottom_right,rgba(34,197,94,0.12),transparent_30%),linear-gradient(135deg,rgba(8,24,18,0.98),rgba(10,14,24,0.96))] p-5 shadow-[0_22px_70px_rgba(0,0,0,0.35)] sm:p-6">
        <div className="absolute inset-0 bg-[linear-gradient(120deg,transparent,rgba(255,255,255,0.03),transparent)]" />
        <div className="relative z-10 grid gap-5 xl:grid-cols-[1.18fr_0.82fr] xl:items-start">
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-2">
              <Badge className="rounded-full border border-emerald-400/30 bg-emerald-500/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.25em] text-emerald-200">
                Reparación
              </Badge>
              <Badge variant="outline" className="rounded-full border-white/10 bg-white/5 px-3 py-1 text-xs text-white/65">
                Mesa técnica activa
              </Badge>
              {o?.status_metadata?.quick_order === true && (
                <Badge className="rounded-full border border-amber-400/25 bg-amber-500/15 px-3 py-1 text-xs text-amber-100">
                  Rápida
                </Badge>
              )}
            </div>

            <div className="space-y-2">
              <p className="text-[11px] font-semibold uppercase tracking-[0.32em] text-white/35">Etapa activa</p>
              <div className="flex flex-wrap items-end gap-x-4 gap-y-2">
                <h2 className="text-3xl font-black tracking-tight text-white sm:text-4xl">En Reparación</h2>
                <div className="inline-flex items-center rounded-full border border-emerald-400/20 bg-emerald-500/10 px-3 py-1 text-sm font-semibold text-emerald-200">
                  {o.device_brand} {o.device_model}
                </div>
              </div>
              <p className="max-w-2xl text-sm leading-relaxed text-white/55">
                Esta vista debe ayudarte a reparar, no a distraerte. Mantiene la orden técnica al frente y deja piezas, evidencia y seguridad disponibles cuando las necesitas.
              </p>
            </div>

            <div className="grid gap-3 md:grid-cols-4">
              <div className="rounded-[22px] border border-white/10 bg-black/25 p-4 backdrop-blur-md">
                <p className="mb-1 text-[11px] font-semibold uppercase tracking-[0.24em] text-white/35">Cliente</p>
                <p className="truncate text-lg font-bold text-emerald-200">{o.customer_name || "No registrado"}</p>
              </div>
              <div className="rounded-[22px] border border-white/10 bg-black/25 p-4 backdrop-blur-md">
                <p className="mb-1 text-[11px] font-semibold uppercase tracking-[0.24em] text-white/35">Contacto</p>
                <p className="truncate text-sm font-semibold text-cyan-200">{o.customer_phone || "Sin telefono"}</p>
              </div>
              <div className="rounded-[22px] border border-white/10 bg-black/25 p-4 backdrop-blur-md">
                <p className="mb-1 text-[11px] font-semibold uppercase tracking-[0.24em] text-white/35">Color / Serie</p>
                <p className="truncate text-sm font-semibold text-white/75">
                  {o.device_color || "Color pendiente"}{o.device_serial ? ` · ${o.device_serial}` : ""}
                </p>
              </div>
              <div className="rounded-[22px] border border-white/10 bg-black/25 p-4 backdrop-blur-md">
                <p className="mb-1 text-[11px] font-semibold uppercase tracking-[0.24em] text-white/35">Cliente indica</p>
                <p className="line-clamp-2 text-sm font-semibold text-white/75">{o.initial_problem || "Sin nota inicial"}</p>
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <div className="rounded-[26px] border border-emerald-400/15 bg-black/25 p-5 backdrop-blur-md">
              <div className="flex items-start gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-emerald-400/20 bg-emerald-500/15">
                  <CheckCircle2 className="h-5 w-5 text-emerald-300" />
                </div>
                <div className="min-w-0">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-white/35">Enfoque</p>
                  <h3 className="mt-1 text-xl font-black tracking-tight text-white">Trabajo técnico</h3>
                  <p className="mt-2 text-sm leading-relaxed text-white/55">
                    Avanza, documenta y deja el historial listo para cierre sin llenar esta etapa de ruido comercial.
                  </p>
                </div>
              </div>
            </div>

            <section className="relative overflow-hidden rounded-[28px] border border-amber-500/15 bg-[radial-gradient(circle_at_top_left,rgba(245,158,11,0.12),transparent_24%),radial-gradient(circle_at_bottom_right,rgba(34,211,238,0.10),transparent_28%),linear-gradient(180deg,rgba(24,24,27,0.98),rgba(10,10,12,0.98))] shadow-[0_18px_50px_rgba(0,0,0,0.28)]">
              <div className="absolute inset-0 bg-[linear-gradient(120deg,transparent,rgba(255,255,255,0.025),transparent)]" />
              <div className="relative z-10 border-b border-white/10 px-5 py-4">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                  <div className="flex items-start gap-4">
                    <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-amber-400/20 bg-amber-500/15 shadow-[0_10px_30px_rgba(245,158,11,0.12)]">
                      <ShoppingCart className="h-5 w-5 text-amber-300" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-white/35">Soporte de reparación</p>
                      <h3 className="mt-1 text-2xl font-black tracking-tight text-white">Piezas y Servicios</h3>
                      <p className="mt-2 max-w-2xl text-sm leading-relaxed text-white/55">
                        {itemCount > 0
                          ? `${itemCount} item${itemCount === 1 ? "" : "s"} registrado${itemCount === 1 ? "" : "s"} · $${itemTotal.toFixed(2)} estimado`
                          : "Sin piezas registradas todavía. Añade solo lo que impacta esta reparación."}
                      </p>
                    </div>
                  </div>
                  <Button
                    type="button"
                    onClick={() => setShowCatalog(true)}
                    className="h-10 rounded-2xl bg-gradient-to-r from-amber-500 to-orange-500 px-5 font-bold text-slate-950 shadow-[0_12px_30px_rgba(245,158,11,0.22)] hover:from-amber-400 hover:to-orange-400"
                  >
                    <Plus className="mr-2 h-4 w-4" />
                    Añadir
                  </Button>
                </div>
              </div>

              {itemPreview.length > 0 && (
                <div className="relative z-10 px-5 py-4">
                  <div className="flex flex-wrap gap-2">
                    {itemPreview.map((item, index) => (
                      <div
                        key={`${item?.id || item?.name || "item"}-${index}`}
                        className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-black/25 px-3 py-1.5 text-xs text-white/80"
                      >
                        <ReceiptText className="h-3.5 w-3.5 text-amber-300" />
                        <span className="max-w-[220px] truncate">{item?.name || "Item"}</span>
                      </div>
                    ))}
                    {itemCount > itemPreview.length && (
                      <div className="inline-flex items-center rounded-full border border-white/10 bg-black/25 px-3 py-1.5 text-xs text-white/60">
                        +{itemCount - itemPreview.length} más
                      </div>
                    )}
                  </div>
                </div>
              )}
            </section>
          </div>
        </div>
      </section>

      <div className="grid gap-6 xl:grid-cols-[1.08fr_0.92fr]">
        <section className="overflow-hidden rounded-[28px] border border-emerald-500/15 bg-[linear-gradient(180deg,rgba(255,255,255,0.05),rgba(255,255,255,0.02))] shadow-[0_18px_50px_rgba(0,0,0,0.28)]">
          <div className="border-b border-white/10 bg-gradient-to-r from-emerald-500/10 to-transparent p-5">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-emerald-400/20 bg-emerald-500/15 text-emerald-300">
                <Sparkles className="h-5 w-5" />
              </div>
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-white/35">Resumen operativo</p>
                <h3 className="text-xl font-black tracking-tight text-white">Pulso de la reparación</h3>
              </div>
            </div>
          </div>
          <div className="grid gap-4 p-5 md:grid-cols-2 xl:grid-cols-4">
            <div className="rounded-[22px] border border-white/8 bg-black/20 p-5">
              <div className="flex items-center justify-between">
                <p className="text-[11px] font-bold uppercase tracking-[0.28em] text-white/35">Checklist</p>
                <Badge className="border-emerald-500/20 bg-emerald-500/10 text-emerald-200">{checklistCount}</Badge>
              </div>
              <p className="mt-3 text-sm leading-relaxed text-white/65">
                {checklistCount > 0
                  ? "Condiciones iniciales disponibles para comparar antes del cierre."
                  : "Faltan referencias visuales de recepción para comparar el resultado final."}
              </p>
            </div>
            <div className="rounded-[22px] border border-white/8 bg-black/20 p-5">
              <div className="flex items-center justify-between">
                <p className="text-[11px] font-bold uppercase tracking-[0.28em] text-white/35">Multimedia</p>
                <Badge className="border-blue-500/20 bg-blue-500/10 text-blue-200">{mediaCount}</Badge>
              </div>
              <p className="mt-3 text-sm leading-relaxed text-white/65">
                {mediaCount > 0 ? "Ya hay evidencia técnica para respaldar la intervención." : "Todavía no hay fotos ni videos del proceso."}
              </p>
            </div>
            <div className="rounded-[22px] border border-white/8 bg-black/20 p-5">
              <div className="flex items-center justify-between">
                <p className="text-[11px] font-bold uppercase tracking-[0.28em] text-white/35">Seguridad</p>
                <Badge className="border-violet-500/20 bg-violet-500/10 text-violet-200">{securityCount}</Badge>
              </div>
              <p className="mt-3 text-sm leading-relaxed text-white/65">
                {securityCount > 0 ? "Hay accesos registrados para pruebas y validación." : "No hay credenciales guardadas en esta orden."}
              </p>
            </div>
            <div className="rounded-[22px] border border-white/8 bg-black/20 p-5">
              <div className="flex items-center justify-between">
                <p className="text-[11px] font-bold uppercase tracking-[0.28em] text-white/35">Movimiento</p>
                <Badge className="border-orange-500/20 bg-orange-500/10 text-orange-200">Live</Badge>
              </div>
              <p className="mt-3 text-sm leading-relaxed text-white/65">{historyHint}</p>
            </div>
          </div>
        </section>

        <section className="overflow-hidden rounded-[28px] border border-cyan-500/15 bg-[linear-gradient(180deg,rgba(255,255,255,0.05),rgba(255,255,255,0.02))] shadow-[0_18px_50px_rgba(0,0,0,0.28)]">
          <div className="border-b border-white/10 bg-gradient-to-r from-cyan-500/10 to-transparent p-5">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-cyan-400/20 bg-cyan-500/15 text-cyan-300">
                <Activity className="h-5 w-5" />
              </div>
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-white/35">Bitácora del técnico</p>
                <h3 className="text-xl font-black tracking-tight text-white">Prioridades de esta etapa</h3>
              </div>
            </div>
          </div>
          <div className="space-y-4 p-5">
            {focusItems.map((item) => {
              const Icon = item.icon;
              return (
                <div key={item.id} className="rounded-[22px] border border-white/8 bg-black/20 p-4">
                  <div className="flex items-start gap-3">
                    <div className={`mt-0.5 flex h-9 w-9 items-center justify-center rounded-xl ${item.tone}`}>
                      <Icon className="h-4.5 w-4.5" />
                    </div>
                    <div>
                      <p className="font-bold text-white">{item.title}</p>
                      <p className="mt-1 text-sm leading-relaxed text-white/60">{item.text}</p>
                    </div>
                  </div>
                </div>
              );
            })}

            <div className="rounded-[22px] border border-white/8 bg-black/20 p-4">
              <div className="flex items-start gap-3">
                <div className="mt-0.5 flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-300">
                  <BadgeCheck className="h-4.5 w-4.5" />
                </div>
                <div>
                  <p className="font-bold text-white">Cerrar con criterio</p>
                  <p className="mt-1 text-sm leading-relaxed text-white/60">
                    Antes de mover la orden, confirma resultado técnico, evidencia final y claridad en la bitácora.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>
      </div>

      <WorkOrderUnifiedHub
        order={order}
        onUpdate={onUpdate}
        accent="emerald"
        title="Centro de Historial"
        subtitle="Fotos, actividad, seguridad y notas técnicas en un solo flujo."
      />

      <AddItemModal
        open={showCatalog}
        onClose={() => setShowCatalog(false)}
        onSave={() => setShowCatalog(false)}
        order={o}
        onUpdate={onUpdate}
      />
    </div>
  );
}
