import React, { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Shield,
  AlertTriangle,
  CalendarClock,
  BadgeCheck,
  ReceiptText,
  Plus,
  ShoppingCart,
  Wallet,
  DollarSign,
  TimerReset,
  ClipboardList,
  Wrench,
  CheckCircle2,
  Clock3
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import AddItemModal from "@/components/workorder/AddItemModal";
import WorkOrderUnifiedHub from "@/components/workorder/WorkOrderUnifiedHub";

export default function WarrantyStage({ order, onUpdate }) {
  const o = order || {};
  const navigate = useNavigate();
  const [showCatalog, setShowCatalog] = useState(false);

  const items = Array.isArray(o.order_items) ? o.order_items : [];
  const itemCount = items.length;

  const claimReason = String(o?.warranty_mode?.warranty_reason || "").trim();
  const customerStory = String(o?.initial_problem || "").trim();
  const entryDate = o?.warranty_mode?.warranty_entry_date || null;
  const startedAt = o?.warranty_countdown?.started_at || null;
  const daysRemaining = Number(o?.warranty_countdown?.days_remaining ?? -1);
  const warrantyExpired = o?.warranty_countdown?.expired === true || daysRemaining === 0;
  const totalPaid = Number(o?.total_paid || o?.amount_paid || 0);

  const totals = useMemo(() => {
    const subtotal = items.reduce((sum, item) => {
      const qty = Number(item?.qty || item?.quantity || 1);
      const basePrice = Number(item?.price || 0);
      const discountPercentage = Number(item?.discount_percentage || 0);
      const lineTotal = basePrice * qty;
      return sum + (lineTotal - lineTotal * (discountPercentage / 100));
    }, 0);

    const taxableSubtotal = items.reduce((sum, item) => {
      if (item?.taxable === false) return sum;
      const qty = Number(item?.qty || item?.quantity || 1);
      const basePrice = Number(item?.price || 0);
      const discountPercentage = Number(item?.discount_percentage || 0);
      const lineTotal = basePrice * qty;
      return sum + (lineTotal - lineTotal * (discountPercentage / 100));
    }, 0);

    const tax = taxableSubtotal * 0.115;
    const total = subtotal + tax;
    const balanceDue = Math.max(0, total - totalPaid);

    return { subtotal, tax, total, balanceDue };
  }, [items, totalPaid]);

  const itemPreview = items.slice(0, 3);

  const warrantyTone = warrantyExpired
    ? {
        badge: "border-red-400/25 bg-red-500/10 text-red-200",
        emphasis: "text-red-300",
        title: "Fuera de ventana de garantía",
        text: "La garantía ya expiró. Si continúas el trabajo, trata esta etapa como reclamo revisado con cargos potenciales."
      }
    : daysRemaining >= 0 && daysRemaining <= 7
      ? {
          badge: "border-amber-400/25 bg-amber-500/10 text-amber-100",
          emphasis: "text-amber-300",
          title: "Garantía por vencer",
          text: "El reclamo sigue activo, pero conviene documentar hallazgos y definir cobertura con rapidez."
        }
      : {
          badge: "border-emerald-400/25 bg-emerald-500/10 text-emerald-100",
          emphasis: "text-emerald-300",
          title: "Garantía activa",
          text: "El reclamo entra dentro de la ventana de garantía. Prioriza diagnóstico de causa y claridad sobre cobertura."
        };

  const coverageSummary = totals.balanceDue > 0.01
    ? {
        title: "Hay cargos adicionales",
        text: "La orden ya tiene piezas o servicios con impacto económico. Si algo no está cubierto por garantía, queda listo para cobro.",
        tone: "text-amber-300 bg-amber-500/10 border-amber-400/20"
      }
    : {
        title: "Sin cargos pendientes",
        text: "Todavía no hay balance adicional. Útil si el reclamo será cubierto o aún no se han añadido extras.",
        tone: "text-emerald-300 bg-emerald-500/10 border-emerald-400/20"
      };

  const actionCards = [
    {
      id: "reason",
      title: "Motivo del reclamo",
      text: claimReason || "Falta registrar la razón específica por la que el cliente regresó bajo garantía.",
      icon: ClipboardList,
      tone: "bg-amber-500/10 text-amber-300"
    },
    {
      id: "story",
      title: "Cliente indica",
      text: customerStory || "No hay narrativa inicial del cliente. Conviene documentarla para comparar con el trabajo previo.",
      icon: Wrench,
      tone: "bg-cyan-500/10 text-cyan-300"
    },
    {
      id: "coverage",
      title: coverageSummary.title,
      text: coverageSummary.text,
      icon: totals.balanceDue > 0.01 ? ReceiptText : BadgeCheck,
      tone: totals.balanceDue > 0.01 ? "bg-orange-500/10 text-orange-300" : "bg-emerald-500/10 text-emerald-300"
    }
  ];

  return (
    <div className="space-y-6">
      <section className="relative overflow-hidden rounded-[30px] border border-amber-500/15 bg-[radial-gradient(circle_at_top_left,rgba(245,158,11,0.16),transparent_28%),radial-gradient(circle_at_bottom_right,rgba(234,179,8,0.14),transparent_30%),linear-gradient(135deg,rgba(28,18,8,0.98),rgba(18,14,10,0.96))] p-5 shadow-[0_22px_70px_rgba(0,0,0,0.35)] sm:p-6">
        <div className="absolute inset-0 bg-[linear-gradient(120deg,transparent,rgba(255,255,255,0.03),transparent)]" />
        <div className="relative z-10 grid gap-5 xl:grid-cols-[1.12fr_0.88fr] xl:items-start">
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-2">
              <Badge className="rounded-full border border-amber-400/30 bg-amber-500/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.25em] text-amber-100">
                Garantía
              </Badge>
              <Badge variant="outline" className={`rounded-full px-3 py-1 text-xs ${warrantyTone.badge}`}>
                {warrantyExpired ? "Reclamo vencido" : "Reclamo activo"}
              </Badge>
              {o?.passed_warranty === true && (
                <Badge variant="outline" className="rounded-full border-white/10 bg-white/5 px-3 py-1 text-xs text-white/65">
                  Historial de garantía
                </Badge>
              )}
            </div>

            <div className="space-y-2">
              <p className="text-[11px] font-semibold uppercase tracking-[0.32em] text-white/35">Etapa activa</p>
              <div className="flex flex-wrap items-end gap-x-4 gap-y-2">
                <h2 className="text-3xl font-black tracking-tight text-white sm:text-4xl">Revisión por Garantía</h2>
                <div className="inline-flex items-center rounded-full border border-amber-400/20 bg-amber-500/10 px-3 py-1 text-sm font-semibold text-amber-100">
                  {o.device_brand} {o.device_model}
                </div>
              </div>
              <p className="max-w-2xl text-sm leading-relaxed text-white/55">
                Esta etapa no debe parecer entrega. Debe ayudar a validar si el reclamo aplica, qué se hará y si existen cargos nuevos fuera de garantía.
              </p>
            </div>

            <div className="grid gap-3 md:grid-cols-4">
              <div className="rounded-[22px] border border-white/10 bg-black/25 p-4 backdrop-blur-md">
                <p className="mb-1 text-[11px] font-semibold uppercase tracking-[0.24em] text-white/35">Cliente</p>
                <p className="truncate text-lg font-bold text-amber-200">{o.customer_name || "No registrado"}</p>
              </div>
              <div className="rounded-[22px] border border-white/10 bg-black/25 p-4 backdrop-blur-md">
                <p className="mb-1 text-[11px] font-semibold uppercase tracking-[0.24em] text-white/35">Ingreso a garantía</p>
                <p className="truncate text-sm font-semibold text-white/80">
                  {entryDate ? new Date(entryDate).toLocaleDateString() : "No registrado"}
                </p>
              </div>
              <div className="rounded-[22px] border border-white/10 bg-black/25 p-4 backdrop-blur-md">
                <p className="mb-1 text-[11px] font-semibold uppercase tracking-[0.24em] text-white/35">Días restantes</p>
                <p className={`truncate text-lg font-bold ${warrantyTone.emphasis}`}>
                  {daysRemaining >= 0 ? `${daysRemaining} días` : "Sin contador"}
                </p>
              </div>
              <div className="rounded-[22px] border border-white/10 bg-black/25 p-4 backdrop-blur-md">
                <p className="mb-1 text-[11px] font-semibold uppercase tracking-[0.24em] text-white/35">Balance adicional</p>
                <p className={`truncate text-lg font-bold ${totals.balanceDue > 0.01 ? "text-amber-300" : "text-emerald-300"}`}>
                  ${totals.balanceDue.toFixed(2)}
                </p>
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <div className="rounded-[26px] border border-amber-400/15 bg-black/25 p-5 backdrop-blur-md">
              <div className="flex items-start gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-amber-400/20 bg-amber-500/15">
                  {warrantyExpired ? (
                    <AlertTriangle className="h-5 w-5 text-red-300" />
                  ) : (
                    <Shield className="h-5 w-5 text-amber-200" />
                  )}
                </div>
                <div className="min-w-0">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-white/35">Estado de cobertura</p>
                  <h3 className="mt-1 text-xl font-black tracking-tight text-white">{warrantyTone.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-white/55">{warrantyTone.text}</p>
                </div>
              </div>
            </div>

            <div className="rounded-[26px] border border-cyan-400/15 bg-[linear-gradient(180deg,rgba(34,211,238,0.08),rgba(0,0,0,0.18))] p-4 backdrop-blur-md">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <ShoppingCart className="h-4 w-4 text-cyan-300" />
                    <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-white/35">Intervención adicional</p>
                  </div>
                  <h3 className="mt-1 text-lg font-black tracking-tight text-white">Piezas y servicios</h3>
                  <p className="mt-1 text-sm text-white/55">
                    {itemCount > 0
                      ? `${itemCount} item${itemCount === 1 ? "" : "s"} registrado${itemCount === 1 ? "" : "s"} · total actual $${totals.total.toFixed(2)}`
                      : "Añade solo lo que realmente no quede cubierto o deba quedar trazado en garantía."}
                  </p>
                </div>
                <Button
                  type="button"
                  onClick={() => setShowCatalog(true)}
                  className="rounded-2xl bg-cyan-500/90 px-5 text-slate-950 shadow-lg shadow-cyan-950/20 hover:bg-cyan-400"
                >
                  <Plus className="mr-2 h-4 w-4" />
                  Añadir extras
                </Button>
              </div>

              {itemPreview.length > 0 && (
                <div className="mt-4 flex flex-wrap gap-2">
                  {itemPreview.map((item, index) => (
                    <div
                      key={`${item?.id || item?.name || "item"}-${index}`}
                      className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-black/25 px-3 py-1.5 text-xs text-white/80"
                    >
                      <ReceiptText className="h-3.5 w-3.5 text-cyan-300" />
                      <span className="max-w-[220px] truncate">{item?.name || "Item"}</span>
                    </div>
                  ))}
                  {itemCount > itemPreview.length && (
                    <div className="inline-flex items-center rounded-full border border-white/10 bg-black/25 px-3 py-1.5 text-xs text-white/60">
                      +{itemCount - itemPreview.length} más
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </section>

      <div className="grid gap-6 xl:grid-cols-[1.04fr_0.96fr]">
        <section className="overflow-hidden rounded-[28px] border border-amber-500/15 bg-[linear-gradient(180deg,rgba(255,255,255,0.05),rgba(255,255,255,0.02))] shadow-[0_18px_50px_rgba(0,0,0,0.28)]">
          <div className="border-b border-white/10 bg-gradient-to-r from-amber-500/10 to-transparent p-5">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-amber-400/20 bg-amber-500/15 text-amber-200">
                <TimerReset className="h-5 w-5" />
              </div>
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-white/35">Lectura rápida</p>
                <h3 className="text-xl font-black tracking-tight text-white">Pulso del reclamo</h3>
              </div>
            </div>
          </div>
          <div className="grid gap-4 p-5 md:grid-cols-2 xl:grid-cols-2">
            <div className="rounded-[22px] border border-white/8 bg-black/20 p-5">
              <div className="flex items-center justify-between">
                <p className="text-[11px] font-bold uppercase tracking-[0.28em] text-white/35">Motivo</p>
                <Badge className="border-amber-500/20 bg-amber-500/10 text-amber-200">Cliente</Badge>
              </div>
              <p className="mt-3 text-sm leading-relaxed text-white/70">
                {claimReason || "Falta registrar la razón del reclamo de garantía."}
              </p>
            </div>

            <div className="rounded-[22px] border border-white/8 bg-black/20 p-5">
              <div className="flex items-center justify-between">
                <p className="text-[11px] font-bold uppercase tracking-[0.28em] text-white/35">Cliente indica</p>
                <Badge className="border-cyan-500/20 bg-cyan-500/10 text-cyan-200">Recepción</Badge>
              </div>
              <p className="mt-3 text-sm leading-relaxed text-white/70">
                {customerStory || "No hay nota inicial disponible para comparar con el reclamo actual."}
              </p>
            </div>

            <div className="rounded-[22px] border border-white/8 bg-black/20 p-5">
              <div className="flex items-center justify-between">
                <p className="text-[11px] font-bold uppercase tracking-[0.28em] text-white/35">Ventana</p>
                <Badge className={warrantyTone.badge}>
                  {warrantyExpired ? "Expirada" : "Activa"}
                </Badge>
              </div>
              <p className="mt-3 text-sm leading-relaxed text-white/70">
                {startedAt
                  ? `La cobertura arrancó el ${new Date(startedAt).toLocaleDateString()} y quedan ${daysRemaining >= 0 ? daysRemaining : "?"} días.`
                  : "No hay fecha de inicio de garantía registrada."}
              </p>
            </div>

            <div className="rounded-[22px] border border-white/8 bg-black/20 p-5">
              <div className="flex items-center justify-between">
                <p className="text-[11px] font-bold uppercase tracking-[0.28em] text-white/35">Cobro</p>
                <Badge className={coverageSummary.tone}>
                  {totals.balanceDue > 0.01 ? "Con extras" : "Sin cargos"}
                </Badge>
              </div>
              <p className="mt-3 text-sm leading-relaxed text-white/70">
                {totals.balanceDue > 0.01
                  ? `El balance pendiente es $${totals.balanceDue.toFixed(2)}. Útil para trabajos mixtos: parte cubierta, parte adicional.`
                  : "No hay balance adicional. Si el reclamo se cubre completo, puedes trabajar sin ruido comercial."}
              </p>
            </div>
          </div>
        </section>

        <section className="overflow-hidden rounded-[28px] border border-cyan-500/15 bg-[linear-gradient(180deg,rgba(255,255,255,0.05),rgba(255,255,255,0.02))] shadow-[0_18px_50px_rgba(0,0,0,0.28)]">
          <div className="border-b border-white/10 bg-gradient-to-r from-cyan-500/10 to-transparent p-5">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-cyan-400/20 bg-cyan-500/15 text-cyan-300">
                <Clock3 className="h-5 w-5" />
              </div>
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-white/35">Qué debe resolverse</p>
                <h3 className="text-xl font-black tracking-tight text-white">Prioridades de garantía</h3>
              </div>
            </div>
          </div>
          <div className="space-y-4 p-5">
            {actionCards.map((item) => {
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
                  <CheckCircle2 className="h-4.5 w-4.5" />
                </div>
                <div>
                  <p className="font-bold text-white">Cerrar criterio de cobertura</p>
                  <p className="mt-1 text-sm leading-relaxed text-white/60">
                    Antes de salir de esta etapa, debe quedar claro si se cubre todo, si hay extras o si el reclamo no procede dentro de garantía.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>
      </div>

      <section className="relative overflow-hidden rounded-[30px] border border-amber-500/15 bg-[radial-gradient(circle_at_top_left,rgba(245,158,11,0.10),transparent_24%),radial-gradient(circle_at_bottom_right,rgba(34,211,238,0.10),transparent_28%),linear-gradient(180deg,rgba(24,24,27,0.98),rgba(10,10,12,0.98))] shadow-[0_22px_70px_rgba(0,0,0,0.35)]">
        <div className="absolute inset-0 bg-[linear-gradient(120deg,transparent,rgba(255,255,255,0.025),transparent)]" />
        <div className="relative z-10 border-b border-white/10 px-6 py-5">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-start gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-cyan-400/20 bg-cyan-500/15 shadow-[0_10px_30px_rgba(34,211,238,0.12)]">
                <ShoppingCart className="h-5 w-5 text-cyan-300" />
              </div>
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-white/35">Cobertura y extras</p>
                <h3 className="mt-1 text-2xl font-black tracking-tight text-white">Piezas y Servicios</h3>
                <p className="mt-2 max-w-2xl text-sm leading-relaxed text-white/55">
                  Úsalo solo si la garantía requiere piezas nuevas, cargos parciales o una trazabilidad económica más precisa.
                </p>
              </div>
            </div>
            <Button
              size="sm"
              onClick={() => setShowCatalog(true)}
              className="h-10 rounded-2xl bg-cyan-500/90 px-4 text-sm font-bold text-slate-950 shadow-lg shadow-cyan-950/20 hover:bg-cyan-400"
            >
              <Plus className="mr-2 h-4 w-4" />
              Añadir
            </Button>
          </div>
        </div>

        <div className="relative z-10 p-6">
          {itemCount === 0 ? (
            <div className="rounded-[24px] border border-dashed border-white/10 bg-black/20 px-6 py-14 text-center">
              <ShoppingCart className="mx-auto mb-4 h-12 w-12 text-white/20" />
              <p className="text-base font-semibold text-white/55">No hay extras registrados en esta garantía.</p>
              <p className="mt-2 text-sm text-white/35">Si algo no queda cubierto o requiere trazabilidad adicional, añádelo desde aquí.</p>
            </div>
          ) : (
            <div className="overflow-hidden rounded-[24px] border border-white/10 bg-black/20">
              <div className="divide-y divide-white/5">
                {items.map((item, idx) => {
                  const qty = Number(item?.qty || item?.quantity || 1);
                  const price = Number(item?.price || 0);
                  const discount = Number(item?.discount_percentage || 0);
                  const lineTotal = price * qty;
                  const itemTotal = lineTotal - lineTotal * (discount / 100);

                  return (
                    <div key={`${item?.id || item?.name || "item"}-${idx}`} className="px-6 py-5 transition-colors hover:bg-white/[0.03]">
                      <div className="flex items-start justify-between gap-4">
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-xl font-black tracking-tight text-white">{item?.name || "Item"}</p>
                          <p className="mt-2 text-sm text-white/45">
                            {item?.type === "service" ? "Servicio agregado a cobertura de garantía." : "Producto agregado a cobertura de garantía."}
                          </p>
                          <div className="mt-4 flex flex-wrap gap-2">
                            <Badge variant="outline" className="rounded-full border-white/10 bg-white/5 px-3 py-1 text-[11px] text-gray-300">
                              ${price.toFixed(2)} c/u
                            </Badge>
                            <Badge variant="outline" className="rounded-full border-white/10 bg-white/5 px-3 py-1 text-[11px] text-gray-300">
                              {item?.type === "service" ? "Servicio" : "Producto"}
                            </Badge>
                            {discount > 0 && (
                              <Badge className="rounded-full border-orange-500/30 bg-orange-500/20 px-3 py-1 text-[11px] text-orange-300">
                                -{discount}% desc.
                              </Badge>
                            )}
                            {item?.taxable === false && (
                              <Badge className="rounded-full border-violet-500/30 bg-violet-500/20 px-3 py-1 text-[11px] text-violet-300">
                                Sin IVU
                              </Badge>
                            )}
                          </div>
                        </div>
                        <div className="pl-4 text-right">
                          <div className="inline-flex items-center rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-semibold text-white/70">
                            x{qty}
                          </div>
                          <p className="mt-3 text-3xl font-black tracking-tight text-emerald-300">${itemTotal.toFixed(2)}</p>
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
                      <span className="text-base font-bold text-white">Total</span>
                      <span className="text-3xl font-black tracking-tight text-white">${totals.total.toFixed(2)}</span>
                    </div>
                  </div>
                </div>

                <div className="rounded-[24px] border border-amber-500/15 bg-[linear-gradient(180deg,rgba(245,158,11,0.08),rgba(0,0,0,0.18))] p-5">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-white/35">Acciones de cobro</p>
                  <h4 className="mt-2 text-2xl font-black tracking-tight text-white">
                    {totals.balanceDue > 0.01 ? "Cerrar diferencia de garantía" : "Sin cobro adicional"}
                  </h4>
                  <p className="mt-2 text-sm leading-relaxed text-white/55">
                    {totals.balanceDue > 0.01
                      ? "Si el reclamo no cubre todo, puedes registrar depósito o cobrar el restante sin salir de la orden."
                      : "La garantía no dejó balance adicional pendiente. Puedes continuar sin fricción comercial."}
                  </p>
                  {totalPaid > 0 && (
                    <div className="mt-4 rounded-[18px] border border-emerald-500/15 bg-emerald-500/10 px-4 py-3">
                      <div className="flex items-center justify-between text-sm">
                        <span className="font-medium text-emerald-100/80">Pagado / Depósito</span>
                        <span className="font-bold text-emerald-300">-${totalPaid.toFixed(2)}</span>
                      </div>
                      <div className="mt-3 flex items-center justify-between border-t border-emerald-400/10 pt-3">
                        <span className="font-semibold text-white">Balance pendiente</span>
                        <span className={`text-2xl font-black tracking-tight ${totals.balanceDue <= 0.01 ? "text-emerald-300" : "text-white"}`}>
                          ${totals.balanceDue.toFixed(2)}
                        </span>
                      </div>
                    </div>
                  )}
                  {totals.balanceDue > 0.01 ? (
                    <div className="mt-5 grid grid-cols-1 gap-4">
                      <Button
                        variant="outline"
                        className="h-12 rounded-2xl border-emerald-500/30 text-emerald-300 hover:bg-emerald-500/10"
                        onClick={() => {
                          window.dispatchEvent(new Event("close-workorder-panel"));
                          navigate(`/POS?workOrderId=${o.id}&mode=deposit`);
                        }}
                      >
                        <Wallet className="mr-2 h-5 w-5" />
                        Depósito
                      </Button>
                      <Button
                        className="h-12 rounded-2xl bg-emerald-600 text-white shadow-lg shadow-emerald-900/20 hover:bg-emerald-500"
                        onClick={() => {
                          window.dispatchEvent(new Event("close-workorder-panel"));
                          navigate(`/POS?workOrderId=${o.id}&mode=full`);
                        }}
                      >
                        <DollarSign className="mr-2 h-5 w-5" />
                        Cobrar Restante
                      </Button>
                    </div>
                  ) : (
                    <div className="mt-5 rounded-[18px] border border-emerald-500/20 bg-emerald-500/10 p-4 text-center">
                      <p className="flex items-center justify-center gap-2 text-lg font-bold text-emerald-400">
                        <BadgeCheck className="h-5 w-5" />
                        Sin cobro adicional pendiente
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </section>

      <WorkOrderUnifiedHub
        order={order}
        onUpdate={onUpdate}
        accent="amber"
        title="Centro de Garantía"
        subtitle="Historial, notas técnicas, evidencias y seguridad reunidos para validar el reclamo."
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
