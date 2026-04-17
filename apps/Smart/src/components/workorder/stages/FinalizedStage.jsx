import React, { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
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
  Wrench,
  ShoppingCart,
  Plus,
  PhoneCall,
  MessageCircle
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import WorkOrderUnifiedHub from "@/components/workorder/WorkOrderUnifiedHub";
import AddItemModal from "@/components/workorder/AddItemModal";
import { Button } from "@/components/ui/button";
import { createPageUrl } from "@/components/utils/helpers";

export default function FinalizedStage({ order, onUpdate, onPaymentClick, compact }) {
  const o = order || {};
  const navigate = useNavigate();
  const [showCatalog, setShowCatalog] = useState(false);
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

    return { subtotal, tax, total, paid, balance };
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
      {!compact && (
      <section className="relative overflow-hidden rounded-[30px] border border-emerald-500/15 bg-[radial-gradient(circle_at_top_left,rgba(16,185,129,0.16),transparent_28%),radial-gradient(circle_at_bottom_right,rgba(6,182,212,0.14),transparent_30%),linear-gradient(135deg,rgba(6,20,18,0.98),rgba(10,16,24,0.96))] p-5 shadow-[0_22px_70px_rgba(0,0,0,0.35)] sm:p-6">
        <div className="absolute inset-0 bg-[linear-gradient(120deg,transparent,rgba(255,255,255,0.03),transparent)]" />
        <div className="relative z-10 grid gap-5 xl:grid-cols-[1.12fr_0.88fr] xl:items-start">
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-2">
              <Badge className="rounded-full border border-emerald-400/30 bg-emerald-500/10 px-3 py-1 text-[11px] font-semibold tracking-[0.25em] text-emerald-200">
                {headerCopy.badge}
              </Badge>
              <Badge variant="outline" className="rounded-full border-white/10 bg-white/5 px-3 py-1 text-xs text-white/65">
                Cierre final
              </Badge>
            </div>

            <div className="space-y-2">
              <p className="text-[11px] font-semibold tracking-[0.32em] text-white/35">Estado final</p>
              <div className="flex flex-wrap items-end gap-x-4 gap-y-2">
                <h2 className="text-3xl font-semibold tracking-tight text-white sm:text-4xl">{headerCopy.title}</h2>
                <div className="inline-flex items-center rounded-full border border-emerald-400/20 bg-emerald-500/10 px-3 py-1 text-sm font-semibold text-emerald-200">
                  {o.device_brand} {o.device_model}
                </div>
              </div>
              <p className="max-w-2xl text-sm leading-relaxed text-white/55">{headerCopy.subtitle}</p>
            </div>

            <div className="grid gap-3 md:grid-cols-4">
              <div className="rounded-[22px] border border-white/10 bg-black/25 p-4 backdrop-blur-md">
                <p className="mb-1 text-[11px] font-semibold tracking-[0.24em] text-white/35">Cliente</p>
                <p className="truncate text-lg font-bold text-emerald-200">{o.customer_name || "No registrado"}</p>
              </div>
              <div className="rounded-[22px] border border-white/10 bg-black/25 p-4 backdrop-blur-md">
                <p className="mb-1 text-[11px] font-semibold tracking-[0.24em] text-white/35">Total cobrado</p>
                <p className="truncate text-lg font-bold text-white">${totals.paid.toFixed(2)}</p>
              </div>
              <div className="rounded-[22px] border border-white/10 bg-black/25 p-4 backdrop-blur-md">
                <p className="mb-1 text-[11px] font-semibold tracking-[0.24em] text-white/35">Balance</p>
                <p className={`truncate text-lg font-bold ${totals.balance <= 0.01 ? "text-emerald-300" : "text-amber-300"}`}>
                  ${totals.balance.toFixed(2)}
                </p>
              </div>
              <div className="rounded-[22px] border border-white/10 bg-black/25 p-4 backdrop-blur-md">
                <p className="mb-1 text-[11px] font-semibold tracking-[0.24em] text-white/35">Última actualización</p>
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
                  <p className="text-[11px] font-semibold tracking-[0.28em] text-white/35">Resultado</p>
                  <h3 className="mt-1 text-xl font-semibold tracking-tight text-white">
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
                    <p className="text-[11px] font-semibold tracking-[0.24em] text-white/35">Equipo</p>
                  </div>
                  <p className="mt-2 text-sm font-semibold text-white/80">
                    {o.device_brand || ""} {o.device_model || "Equipo no definido"}
                  </p>
                  <p className="mt-1 text-xs text-white/50">{o.device_color || "Color no registrado"}</p>
                </div>

                <div className="rounded-[20px] border border-white/10 bg-black/25 p-4">
                  <div className="flex items-center gap-2">
                    <Shield className="h-4 w-4 text-emerald-300" />
                    <p className="text-[11px] font-semibold tracking-[0.24em] text-white/35">Garantía posterior</p>
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

      {/* ── COMPACT: simple badge summary ─────────────────────────────────── */}
      {compact && (
        <div className="rounded-[22px] border border-emerald-500/15 bg-black/25 p-4 space-y-3">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-emerald-400/20 bg-emerald-500/15">
              {isCompleted
                ? <PartyPopper className="h-5 w-5 text-emerald-300" />
                : <CheckCircle2 className="h-5 w-5 text-emerald-300" />
              }
            </div>
            <div>
              <Badge className="rounded-full border border-emerald-400/30 bg-emerald-500/10 px-3 py-1 text-[11px] font-semibold tracking-[0.25em] text-emerald-200">
                {isCompleted ? "Completado" : "Entregado"}
              </Badge>
              {o.updated_date && (
                <p className="mt-1 text-xs text-white/45">
                  {new Date(o.updated_date).toLocaleDateString()}
                </p>
              )}
            </div>
          </div>
          {warrantyActive && (
            <div className="flex items-center gap-2 rounded-xl border border-emerald-400/15 bg-emerald-500/8 px-3 py-2">
              <Shield className="h-4 w-4 text-emerald-300 flex-shrink-0" />
              <span className="text-sm font-semibold text-emerald-200">
                Garantia: {warrantyDays} dias restantes
              </span>
            </div>
          )}
        </div>
      )}

      {/* ── FULL: Resumen de salida cards ──────────────────────────────────── */}
      {!compact && (
      <>
      <div className="grid gap-6 xl:grid-cols-[1.04fr_0.96fr]">
        <section className="overflow-hidden rounded-[28px] border border-emerald-500/15 bg-[linear-gradient(180deg,rgba(255,255,255,0.05),rgba(255,255,255,0.02))] shadow-[0_18px_50px_rgba(0,0,0,0.28)]">
          <div className="border-b border-white/10 bg-gradient-to-r from-emerald-500/10 to-transparent p-5">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-emerald-400/20 bg-emerald-500/15 text-emerald-300">
                <BadgeCheck className="h-5 w-5" />
              </div>
              <div>
                <p className="text-[11px] font-semibold tracking-[0.28em] text-white/35">Resumen de salida</p>
                <h3 className="text-xl font-semibold tracking-tight text-white">Información final del cliente</h3>
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
                    Subtotal: ${totals.subtotal.toFixed(2)}. IVU: ${totals.tax.toFixed(2)}. Pagado: ${totals.paid.toFixed(2)}. Balance: ${totals.balance.toFixed(2)}.
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

      <section className="relative overflow-hidden rounded-[30px] border border-emerald-500/15 bg-[radial-gradient(circle_at_top_left,rgba(16,185,129,0.10),transparent_24%),radial-gradient(circle_at_bottom_right,rgba(6,182,212,0.10),transparent_28%),linear-gradient(180deg,rgba(24,24,27,0.98),rgba(10,10,12,0.98))] shadow-[0_22px_70px_rgba(0,0,0,0.35)]">
        <div className="absolute inset-0 bg-[linear-gradient(120deg,transparent,rgba(255,255,255,0.025),transparent)]" />
        <div className="relative z-10 border-b border-white/10 px-6 py-5">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-start gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-emerald-400/20 bg-emerald-500/15 shadow-[0_10px_30px_rgba(16,185,129,0.12)]">
                <ShoppingCart className="h-5 w-5 text-emerald-300" />
              </div>
              <div>
                <p className="text-[11px] font-semibold tracking-[0.28em] text-white/35">Cierre económico</p>
                <h3 className="mt-1 text-2xl font-semibold tracking-tight text-white">Piezas y Servicios</h3>
                <p className="mt-2 max-w-2xl text-sm leading-relaxed text-white/55">
                  Mantén visible el detalle final de piezas, servicios y balance sin importar si la orden ya fue entregada o completada.
                </p>
              </div>
            </div>
            <div className="flex gap-3">
              <Button
                size="sm"
                variant="outline"
                onClick={() => setShowCatalog(true)}
                className="h-10 rounded-2xl border-white/10 bg-white/5 px-4 text-white hover:bg-white/10"
              >
                Editar
              </Button>
              <Button
                size="sm"
                onClick={() => setShowCatalog(true)}
                className="h-10 rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-500 px-5 font-bold text-white shadow-[0_12px_30px_rgba(16,185,129,0.25)] hover:from-emerald-400 hover:to-teal-400"
              >
                <Plus className="mr-2 h-4 w-4" />
                Añadir
              </Button>
            </div>
          </div>
        </div>

        <div className="relative z-10 p-6">
          {items.length === 0 ? (
            <div className="rounded-[24px] border border-dashed border-white/10 bg-black/20 px-6 py-14 text-center">
              <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl border border-white/10 bg-white/5">
                <ShoppingCart className="h-6 w-6 text-white/35" />
              </div>
              <p className="text-sm font-semibold text-white/70">No hay items en esta orden</p>
              <p className="mt-2 text-xs text-white/40">Añade piezas o servicios si hace falta ajustar el cierre final.</p>
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
                            {item?.type === "service" ? "Servicio agregado al cierre." : "Producto agregado al cierre."}
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
                          <p className="mt-3 text-3xl font-semibold tracking-tight text-emerald-300">${lineTotal.toFixed(2)}</p>
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
                      <span className="text-xl font-semibold tracking-tight text-white">${(totals.total - (items.filter((item) => item?.taxable !== false).reduce((sum, item) => {
                        const qty = Number(item?.qty || item?.quantity || 1);
                        const price = Number(item?.price || 0);
                        const discount = Number(item?.discount_percentage || 0);
                        const line = price * qty;
                        return sum + (line - line * (discount / 100));
                      }, 0) * 0.115)).toFixed(2)}</span>
                    </div>
                  </div>
                  <div className="rounded-[20px] border border-white/8 bg-black/20 px-5 py-4">
                    <div className="flex items-center justify-between text-sm">
                      <span className="font-medium text-gray-400">Total</span>
                      <span className="text-xl font-semibold tracking-tight text-white">${totals.total.toFixed(2)}</span>
                    </div>
                  </div>
                  <div className="rounded-[20px] border border-emerald-500/15 bg-emerald-500/10 px-5 py-4">
                    <div className="flex items-center justify-between">
                      <span className="text-base font-bold text-white">Balance</span>
                      <span className="text-3xl font-semibold tracking-tight text-white">${totals.balance.toFixed(2)}</span>
                    </div>
                  </div>
                </div>

                <div className="rounded-[24px] border border-emerald-500/15 bg-[linear-gradient(180deg,rgba(16,185,129,0.08),rgba(0,0,0,0.18))] p-5">
                  <p className="text-[11px] font-semibold tracking-[0.28em] text-white/35">Acciones de cobro</p>
                  <h4 className="mt-2 text-2xl font-semibold tracking-tight text-white">
                    {totals.balance > 0.01 ? "Cierra el balance de la orden" : "Orden saldada"}
                  </h4>
                  <p className="mt-2 text-sm leading-relaxed text-white/55">
                    Registra un depósito adicional o cobra el restante completo desde POS sin salir del cierre final.
                  </p>
                  {totals.balance > 0.01 ? (
                    <div className="mt-5 grid grid-cols-1 gap-4">
                      <Button
                        variant="outline"
                        className="h-12 rounded-2xl border-emerald-500/30 text-emerald-300 hover:bg-emerald-500/10"
                        onClick={() => onPaymentClick?.("deposit")}
                      >
                        Depósito
                      </Button>
                      <Button
                        className="h-12 rounded-2xl bg-emerald-600 text-white shadow-lg shadow-emerald-900/20 hover:bg-emerald-500"
                        onClick={() => onPaymentClick?.("full")}
                      >
                        Cobrar Restante
                      </Button>
                    </div>
                  ) : (
                    <div className="mt-5 rounded-[18px] border border-emerald-500/20 bg-emerald-500/10 p-4 text-center">
                      <p className="text-lg font-bold text-emerald-400">Orden Saldada</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </section>
      </>
      )}

      {!compact && (
      <WorkOrderUnifiedHub
        order={order}
        onUpdate={onUpdate}
        accent="emerald"
        title="Centro de Historial"
        subtitle="Actividad, fotos, seguridad y referencia final de la orden entregada."
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
