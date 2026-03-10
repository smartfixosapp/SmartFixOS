import React, { useMemo } from "react";
import {
  CheckCircle2,
  PartyPopper,
  Phone,
  Mail,
  Smartphone,
  ReceiptText,
  Shield,
  Clock3,
  BadgeCheck,
  ClipboardList,
  Wrench
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import WorkOrderUnifiedHub from "@/components/workorder/WorkOrderUnifiedHub";

export default function FinalizedStage({ order, onUpdate }) {
  const o = order || {};
  const items = Array.isArray(o.order_items) ? o.order_items : [];
  const status = String(o.status || "").toLowerCase();
  const isCompleted = status === "completed";

  const totals = useMemo(() => {
    const subtotal = items.reduce((sum, item) => {
      const qty = Number(item?.qty || item?.quantity || 1);
      const price = Number(item?.price || 0);
      const discountPercentage = Number(item?.discount_percentage || 0);
      const lineTotal = price * qty;
      return sum + (lineTotal - lineTotal * (discountPercentage / 100));
    }, 0);

    const taxableSubtotal = items.reduce((sum, item) => {
      if (item?.taxable === false) return sum;
      const qty = Number(item?.qty || item?.quantity || 1);
      const price = Number(item?.price || 0);
      const discountPercentage = Number(item?.discount_percentage || 0);
      const lineTotal = price * qty;
      return sum + (lineTotal - lineTotal * (discountPercentage / 100));
    }, 0);

    const tax = taxableSubtotal * 0.115;
    const total = subtotal + tax;
    const paid = Number(o?.total_paid || o?.amount_paid || 0);
    const balance = Math.max(0, total - paid);

    return { total, paid, balance };
  }, [items, o?.total_paid, o?.amount_paid]);

  const headerCopy = isCompleted
    ? {
        badge: "Completado",
        title: "Orden Cerrada",
        subtitle: "La orden ya salió del flujo activo. Esta vista funciona como cierre limpio con datos finales del cliente y referencia rápida."
      }
    : {
        badge: "Entregado",
        title: "Equipo Entregado",
        subtitle: "La entrega ya ocurrió. Aquí debe quedar un resumen final fácil de leer, no una pantalla de cobro ni edición pesada."
      };

  const warrantyDays = Number(o?.warranty_countdown?.days_remaining ?? -1);
  const warrantyActive = warrantyDays >= 0 && o?.warranty_countdown?.expired !== true;

  const finalCards = [
    {
      id: "customer",
      title: "Información final del cliente",
      text: `${o.customer_name || "No registrado"} · ${o.customer_phone || "Sin teléfono"}${o.customer_email ? ` · ${o.customer_email}` : ""}`,
      icon: Phone,
      tone: "bg-cyan-500/10 text-cyan-300"
    },
    {
      id: "problem",
      title: "Cliente indica",
      text: o.initial_problem || "No hay narrativa inicial del cliente registrada.",
      icon: ClipboardList,
      tone: "bg-amber-500/10 text-amber-300"
    },
    {
      id: "items",
      title: "Trabajo / artículos finales",
      text: items.length > 0
        ? items.map((item) => item?.name).filter(Boolean).slice(0, 3).join(", ")
        : "No hay piezas o servicios visibles en esta orden.",
      icon: Wrench,
      tone: "bg-emerald-500/10 text-emerald-300"
    }
  ];

  return (
    <div className="space-y-6">
      <section className="relative overflow-hidden rounded-[30px] border border-emerald-500/15 bg-[radial-gradient(circle_at_top_left,rgba(16,185,129,0.16),transparent_28%),radial-gradient(circle_at_bottom_right,rgba(6,182,212,0.14),transparent_30%),linear-gradient(135deg,rgba(6,20,18,0.98),rgba(10,16,24,0.96))] p-5 shadow-[0_22px_70px_rgba(0,0,0,0.35)] sm:p-6">
        <div className="absolute inset-0 bg-[linear-gradient(120deg,transparent,rgba(255,255,255,0.03),transparent)]" />
        <div className="relative z-10 grid gap-5 xl:grid-cols-[1.12fr_0.88fr] xl:items-start">
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-2">
              <Badge className="rounded-full border border-emerald-400/30 bg-emerald-500/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.25em] text-emerald-200">
                {headerCopy.badge}
              </Badge>
              <Badge variant="outline" className="rounded-full border-white/10 bg-white/5 px-3 py-1 text-xs text-white/65">
                Cierre final
              </Badge>
            </div>

            <div className="space-y-2">
              <p className="text-[11px] font-semibold uppercase tracking-[0.32em] text-white/35">Estado final</p>
              <div className="flex flex-wrap items-end gap-x-4 gap-y-2">
                <h2 className="text-3xl font-black tracking-tight text-white sm:text-4xl">{headerCopy.title}</h2>
                <div className="inline-flex items-center rounded-full border border-emerald-400/20 bg-emerald-500/10 px-3 py-1 text-sm font-semibold text-emerald-200">
                  {o.device_brand} {o.device_model}
                </div>
              </div>
              <p className="max-w-2xl text-sm leading-relaxed text-white/55">{headerCopy.subtitle}</p>
            </div>

            <div className="grid gap-3 md:grid-cols-4">
              <div className="rounded-[22px] border border-white/10 bg-black/25 p-4 backdrop-blur-md">
                <p className="mb-1 text-[11px] font-semibold uppercase tracking-[0.24em] text-white/35">Cliente</p>
                <p className="truncate text-lg font-bold text-emerald-200">{o.customer_name || "No registrado"}</p>
              </div>
              <div className="rounded-[22px] border border-white/10 bg-black/25 p-4 backdrop-blur-md">
                <p className="mb-1 text-[11px] font-semibold uppercase tracking-[0.24em] text-white/35">Total cobrado</p>
                <p className="truncate text-lg font-bold text-white">${totals.paid.toFixed(2)}</p>
              </div>
              <div className="rounded-[22px] border border-white/10 bg-black/25 p-4 backdrop-blur-md">
                <p className="mb-1 text-[11px] font-semibold uppercase tracking-[0.24em] text-white/35">Balance</p>
                <p className={`truncate text-lg font-bold ${totals.balance <= 0.01 ? "text-emerald-300" : "text-amber-300"}`}>
                  ${totals.balance.toFixed(2)}
                </p>
              </div>
              <div className="rounded-[22px] border border-white/10 bg-black/25 p-4 backdrop-blur-md">
                <p className="mb-1 text-[11px] font-semibold uppercase tracking-[0.24em] text-white/35">Última actualización</p>
                <p className="truncate text-sm font-semibold text-white/80">
                  {o.updated_date ? new Date(o.updated_date).toLocaleDateString() : "No registrada"}
                </p>
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <div className="rounded-[26px] border border-emerald-400/15 bg-black/25 p-5 backdrop-blur-md">
              <div className="flex items-start gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-emerald-400/20 bg-emerald-500/15">
                  {isCompleted ? (
                    <PartyPopper className="h-5 w-5 text-emerald-300" />
                  ) : (
                    <CheckCircle2 className="h-5 w-5 text-emerald-300" />
                  )}
                </div>
                <div className="min-w-0">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-white/35">Resultado</p>
                  <h3 className="mt-1 text-xl font-black tracking-tight text-white">
                    {totals.balance <= 0.01 ? "Orden saldada y entregada" : "Entrega registrada con balance visible"}
                  </h3>
                  <p className="mt-2 text-sm leading-relaxed text-white/55">
                    Esta etapa sirve como resumen de salida: qué se entregó, a quién y cómo quedó la orden después del cierre.
                  </p>
                </div>
              </div>
            </div>

            <div className="rounded-[26px] border border-cyan-400/15 bg-[linear-gradient(180deg,rgba(34,211,238,0.08),rgba(0,0,0,0.18))] p-4 backdrop-blur-md">
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-[20px] border border-white/10 bg-black/25 p-4">
                  <div className="flex items-center gap-2">
                    <Smartphone className="h-4 w-4 text-cyan-300" />
                    <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-white/35">Equipo</p>
                  </div>
                  <p className="mt-2 text-sm font-semibold text-white/80">
                    {o.device_brand || ""} {o.device_model || "Equipo no definido"}
                  </p>
                  <p className="mt-1 text-xs text-white/50">{o.device_color || "Color no registrado"}</p>
                </div>

                <div className="rounded-[20px] border border-white/10 bg-black/25 p-4">
                  <div className="flex items-center gap-2">
                    <Shield className="h-4 w-4 text-emerald-300" />
                    <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-white/35">Garantía posterior</p>
                  </div>
                  <p className="mt-2 text-sm font-semibold text-white/80">
                    {warrantyActive ? `${warrantyDays} días restantes` : "Sin garantía activa visible"}
                  </p>
                  <p className="mt-1 text-xs text-white/50">
                    {warrantyActive ? "La orden mantiene ventana de garantía activa." : "No hay contador de garantía disponible."}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <div className="grid gap-6 xl:grid-cols-[1.04fr_0.96fr]">
        <section className="overflow-hidden rounded-[28px] border border-emerald-500/15 bg-[linear-gradient(180deg,rgba(255,255,255,0.05),rgba(255,255,255,0.02))] shadow-[0_18px_50px_rgba(0,0,0,0.28)]">
          <div className="border-b border-white/10 bg-gradient-to-r from-emerald-500/10 to-transparent p-5">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-emerald-400/20 bg-emerald-500/15 text-emerald-300">
                <BadgeCheck className="h-5 w-5" />
              </div>
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-white/35">Resumen de salida</p>
                <h3 className="text-xl font-black tracking-tight text-white">Información final del cliente</h3>
              </div>
            </div>
          </div>
          <div className="grid gap-4 p-5 md:grid-cols-2">
            {finalCards.map((item) => {
              const Icon = item.icon;
              return (
                <div key={item.id} className="rounded-[22px] border border-white/8 bg-black/20 p-5">
                  <div className="flex items-start gap-3">
                    <div className={`mt-0.5 flex h-9 w-9 items-center justify-center rounded-xl ${item.tone}`}>
                      <Icon className="h-4.5 w-4.5" />
                    </div>
                    <div>
                      <p className="font-bold text-white">{item.title}</p>
                      <p className="mt-1 text-sm leading-relaxed text-white/65">{item.text}</p>
                    </div>
                  </div>
                </div>
              );
            })}

            <div className="rounded-[22px] border border-white/8 bg-black/20 p-5">
              <div className="flex items-start gap-3">
                <div className="mt-0.5 flex h-9 w-9 items-center justify-center rounded-xl bg-violet-500/10 text-violet-300">
                  <ReceiptText className="h-4.5 w-4.5" />
                </div>
                <div>
                  <p className="font-bold text-white">Totales finales</p>
                  <p className="mt-1 text-sm leading-relaxed text-white/65">
                    Total de la orden: ${totals.total.toFixed(2)}. Pagado: ${totals.paid.toFixed(2)}. Balance: ${totals.balance.toFixed(2)}.
                  </p>
                </div>
              </div>
            </div>

            <div className="rounded-[22px] border border-white/8 bg-black/20 p-5">
              <div className="flex items-start gap-3">
                <div className="mt-0.5 flex h-9 w-9 items-center justify-center rounded-xl bg-cyan-500/10 text-cyan-300">
                  <Clock3 className="h-4.5 w-4.5" />
                </div>
                <div>
                  <p className="font-bold text-white">Cierre cronológico</p>
                  <p className="mt-1 text-sm leading-relaxed text-white/65">
                    Estado actual: {isCompleted ? "Completado" : "Entregado"}. Última actualización: {o.updated_date ? new Date(o.updated_date).toLocaleString() : "No registrada"}.
                  </p>
                </div>
              </div>
            </div>

            <div className="rounded-[22px] border border-white/8 bg-black/20 p-5">
              <div className="flex items-start gap-3">
                <div className="mt-0.5 flex h-9 w-9 items-center justify-center rounded-xl bg-amber-500/10 text-amber-300">
                  <Mail className="h-4.5 w-4.5" />
                </div>
                <div>
                  <p className="font-bold text-white">Contacto post-entrega</p>
                  <p className="mt-1 text-sm leading-relaxed text-white/65">
                    {o.customer_email || "Sin email registrado"} · {o.customer_phone || "Sin teléfono registrado"}
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
        subtitle="Actividad, fotos, seguridad y referencia final de la orden entregada."
      />
    </div>
  );
}
