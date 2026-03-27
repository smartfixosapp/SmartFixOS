import React, { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Factory, Wrench, ExternalLink, ShoppingCart, Shield, Camera, History, Link as LinkIcon, PhoneCall, MessageCircle, Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import AddItemModal from "@/components/workorder/AddItemModal";
import OrderSecurity from "@/components/workorder/sections/OrderSecurity";
import OrderMultimedia from "@/components/workorder/sections/OrderMultimedia";
import WorkOrderTimeline from "@/components/orders/workorder/WorkOrderTimeline";
import WorkOrderUnifiedHub from "@/components/workorder/WorkOrderUnifiedHub";

export default function ExternalRepairStage({ order, onUpdate }) {
  const o = order || {};
  const [activeModal, setActiveModal] = useState(null);
  const [showCatalog, setShowCatalog] = useState(false);

  return (
    <div className="space-y-6">
      <section className="relative overflow-hidden rounded-[30px] border border-fuchsia-500/15 bg-[radial-gradient(circle_at_top_left,rgba(217,70,239,0.16),transparent_28%),radial-gradient(circle_at_bottom_right,rgba(236,72,153,0.14),transparent_30%),linear-gradient(135deg,rgba(30,10,32,0.98),rgba(20,12,26,0.96))] p-5 shadow-[0_22px_70px_rgba(0,0,0,0.35)] sm:p-6">
        <div className="absolute inset-0 bg-[linear-gradient(120deg,transparent,rgba(255,255,255,0.03),transparent)]" />
        <div className="relative z-10 grid gap-5 xl:grid-cols-[1.2fr_0.8fr] xl:items-start">
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-2">
              <Badge className="rounded-full border border-fuchsia-400/30 bg-fuchsia-500/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.25em] text-fuchsia-200">
                Reparacion externa
              </Badge>
              <Badge variant="outline" className="rounded-full border-white/10 bg-white/5 px-3 py-1 text-xs text-white/65">
                Taller asociado
              </Badge>
            </div>

            <div className="space-y-2">
              <p className="text-[11px] font-semibold uppercase tracking-[0.32em] text-white/35">Etapa activa</p>
              <div className="flex flex-wrap items-end gap-x-4 gap-y-2">
                <h2 className="text-3xl font-black tracking-tight text-white sm:text-4xl">Servicio Fuera del Taller</h2>
                <div className="inline-flex items-center rounded-full border border-fuchsia-400/20 bg-fuchsia-500/10 px-3 py-1 text-sm font-semibold text-fuchsia-200">
                  {o.device_brand} {o.device_model}
                </div>
              </div>
              <p className="max-w-2xl text-sm leading-relaxed text-white/55">
                Mantén claro qué tercero está trabajando la orden, qué se pidió y cómo seguir el proceso sin llenar la pantalla de bloques genéricos.
              </p>
            </div>

            <div className="grid gap-3 md:grid-cols-3">
              <div className="rounded-[22px] border border-white/10 bg-black/25 p-4 backdrop-blur-md">
                <p className="mb-1 text-[11px] font-semibold uppercase tracking-[0.24em] text-white/35">Cliente</p>
                <p className="truncate text-lg font-bold text-fuchsia-200">{o.customer_name || "No registrado"}</p>
              </div>
              <div className="rounded-[22px] border border-white/10 bg-black/25 p-4 backdrop-blur-md">
                <p className="mb-1 text-[11px] font-semibold uppercase tracking-[0.24em] text-white/35">Taller asignado</p>
                <p className="truncate text-sm font-semibold text-white/75">{o.external_shop || "Sin asignar"}</p>
              </div>
              <div className="rounded-[22px] border border-white/10 bg-black/25 p-4 backdrop-blur-md">
                <p className="mb-1 text-[11px] font-semibold uppercase tracking-[0.24em] text-white/35">Orden</p>
                <p className="truncate text-lg font-bold text-cyan-200">{o.order_number || "Sin numero"}</p>
              </div>
            </div>
          </div>

          <section className="relative overflow-hidden rounded-[28px] border border-fuchsia-500/15 bg-[radial-gradient(circle_at_top_left,rgba(217,70,239,0.12),transparent_24%),radial-gradient(circle_at_bottom_right,rgba(34,211,238,0.10),transparent_28%),linear-gradient(180deg,rgba(24,24,27,0.98),rgba(10,10,12,0.98))] shadow-[0_18px_50px_rgba(0,0,0,0.28)]">
            <div className="absolute inset-0 bg-[linear-gradient(120deg,transparent,rgba(255,255,255,0.025),transparent)]" />
            <div className="relative z-10 border-b border-white/10 px-5 py-4">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div className="flex items-start gap-4">
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-cyan-400/20 bg-cyan-500/15 shadow-[0_10px_30px_rgba(34,211,238,0.12)]">
                    <ShoppingCart className="h-5 w-5 text-cyan-300" />
                  </div>
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-white/35">Cobro y trazabilidad</p>
                    <h3 className="mt-1 text-2xl font-black tracking-tight text-white">Piezas y Servicios</h3>
                    <p className="mt-2 max-w-2xl text-sm leading-relaxed text-white/55">
                      Añade piezas y servicios relacionados al trabajo externo para mantener la cotización y el cierre alineados.
                    </p>
                  </div>
                </div>
                <Button
                  onClick={() => setShowCatalog(true)}
                  className="h-10 rounded-2xl bg-gradient-to-r from-cyan-500 to-fuchsia-500 px-5 font-bold text-slate-950 shadow-[0_12px_30px_rgba(34,211,238,0.2)] hover:from-cyan-400 hover:to-fuchsia-400"
                >
                  <ShoppingCart className="mr-2 h-4 w-4" />
                  Piezas y Servicios
                </Button>
              </div>
            </div>
          </section>
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

      <div className="grid gap-6 xl:grid-cols-2">
        <section className="overflow-hidden rounded-[28px] border border-fuchsia-500/15 bg-[linear-gradient(180deg,rgba(255,255,255,0.05),rgba(255,255,255,0.02))] shadow-[0_18px_50px_rgba(0,0,0,0.28)]">
          <div className="border-b border-white/10 bg-gradient-to-r from-fuchsia-500/10 to-transparent p-5">
            <h3 className="flex items-center gap-2 text-lg font-black tracking-tight text-white">
              <Factory className="h-5 w-5 text-fuchsia-400" />
              Informacion del Tercero
            </h3>
          </div>
          <div className="grid gap-4 p-5 md:grid-cols-2">
            <div className="rounded-[22px] border border-white/8 bg-black/20 p-5">
              <p className="mb-2 text-[11px] font-bold uppercase tracking-[0.28em] text-white/35">Taller</p>
              <p className="text-2xl font-black tracking-tight text-white">{o.external_shop || "—"}</p>
            </div>
            <div className="rounded-[22px] border border-white/8 bg-black/20 p-5">
              <p className="mb-2 text-[11px] font-bold uppercase tracking-[0.28em] text-white/35">Contacto / referencia</p>
              <p className="text-sm font-semibold leading-relaxed text-white/75">{o.external_reference || o.external_phone || "Sin referencia"}</p>
            </div>
          </div>
        </section>

        <section className="overflow-hidden rounded-[28px] border border-orange-500/15 bg-[linear-gradient(180deg,rgba(255,255,255,0.05),rgba(255,255,255,0.02))] shadow-[0_18px_50px_rgba(0,0,0,0.28)]">
          <div className="border-b border-white/10 bg-gradient-to-r from-orange-500/10 to-transparent p-5">
            <h3 className="flex items-center gap-2 text-lg font-black tracking-tight text-white">
              <Wrench className="h-5 w-5 text-orange-300" />
              Trabajo Solicitado
            </h3>
          </div>
          <div className="p-5">
            <div className="rounded-[22px] border border-white/8 bg-black/20 p-5">
              <p className="mb-2 text-[11px] font-bold uppercase tracking-[0.28em] text-white/35">Descripcion</p>
              <p className="text-base leading-relaxed text-white/75">{o.external_work || "No se ha descrito el trabajo externo."}</p>
            </div>
          </div>
        </section>
      </div>

      <WorkOrderUnifiedHub order={order} onUpdate={onUpdate} accent="fuchsia" title="Centro de Historial" subtitle="Seguimiento externo, evidencia, seguridad y notas en una sola vista." />

      <AddItemModal open={showCatalog} onClose={() => setShowCatalog(false)} order={o} onUpdate={onUpdate} />

    </div>
  );
}
