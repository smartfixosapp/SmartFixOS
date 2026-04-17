import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ShoppingCart, Plus, Package, Wallet, DollarSign, CheckCircle2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import AddItemModal from "@/components/workorder/AddItemModal";
import { createPageUrl } from "@/components/utils/helpers";
import { navigateToPOS } from "../utils/posNavigation";

const IVU_RATE = 0.115;

/**
 * Reusable "Piezas y Servicios" section for all work-order stages.
 *
 * Props:
 *   order            – current order object (read-only)
 *   onUpdate         – called after non-catalog events
 *   onOrderItemsUpdate – optimistic callback(newItems) – merge items into parent state instantly
 *   onRemoteSaved    – called after AddItemModal finishes the DB write
 *   onClose          – closes the WorkOrderPanel before navigating to POS
 *   accentColor      – tailwind color key: "cyan" | "purple" | "amber" | "orange" | "yellow" | "emerald"
 *   subtitle         – optional description text under the section title
 *   catalogButtonLabel – optional label for the catalog button (default "Piezas y Servicios")
 */
export default function SharedItemsSection({
  order,
  onUpdate,
  onOrderItemsUpdate,
  onRemoteSaved,
  onClose,
  onPaymentClick,
  accentColor = "cyan",
  subtitle = "Añade piezas o servicios y mantén el costo visible en todo momento.",
  catalogButtonLabel = "Piezas y Servicios",
}) {
  const o = order || {};
  const navigate = useNavigate();
  const [showCatalog, setShowCatalog] = useState(false);

  const items = useMemo(
    () => (Array.isArray(o.order_items) ? o.order_items : []),
    [o.order_items]
  );

  const totals = useMemo(() => {
    const subtotal = items.reduce((sum, it) => {
      const base = Number(it?.price || 0) * Number(it?.qty || 1);
      const disc = base * (Number(it?.discount_percentage || 0) / 100);
      return sum + (base - disc);
    }, 0);
    const taxable = items.reduce((sum, it) => {
      if (it?.taxable === false) return sum;
      const base = Number(it?.price || 0) * Number(it?.qty || 1);
      const disc = base * (Number(it?.discount_percentage || 0) / 100);
      return sum + (base - disc);
    }, 0);
    const tax = taxable * IVU_RATE;
    const total = subtotal + tax;
    const paid = Number(o?.amount_paid || o?.total_paid || 0);
    const balance = Math.max(0, total - paid);
    const isPaid = balance <= 0.01;
    return { subtotal, tax, total, paid, balance, isPaid };
  }, [items, o?.amount_paid, o?.total_paid]);

  // accent colour utilities
  const accent = {
    cyan: {
      border: "border-cyan-500/15",
      icon: "border-cyan-400/20 bg-cyan-500/15 shadow-[0_10px_30px_rgba(34,211,238,0.12)]",
      iconColor: "text-cyan-300",
      btn: "bg-gradient-to-r from-cyan-500 to-blue-500 text-slate-950 shadow-[0_12px_30px_rgba(34,211,238,0.22)] hover:from-cyan-400 hover:to-blue-400",
      badge: "border-cyan-400/20 bg-cyan-500/10 text-cyan-300",
      itemColor: "text-cyan-300",
    },
    purple: {
      border: "border-purple-500/15",
      icon: "border-purple-400/20 bg-purple-500/15 shadow-[0_10px_30px_rgba(168,85,247,0.12)]",
      iconColor: "text-purple-300",
      btn: "bg-gradient-to-r from-purple-600 to-indigo-500 text-white shadow-[0_12px_30px_rgba(124,58,237,0.24)] hover:from-purple-500 hover:to-indigo-400",
      badge: "border-purple-400/20 bg-purple-500/10 text-purple-300",
      itemColor: "text-purple-300",
    },
    amber: {
      border: "border-amber-500/15",
      icon: "border-amber-400/20 bg-amber-500/15 shadow-[0_10px_30px_rgba(250,204,21,0.12)]",
      iconColor: "text-amber-200",
      btn: "bg-gradient-to-r from-amber-500 to-orange-500 text-black shadow-[0_12px_30px_rgba(245,158,11,0.25)] hover:from-amber-400 hover:to-orange-400",
      badge: "border-amber-400/20 bg-amber-500/10 text-amber-300",
      itemColor: "text-amber-300",
    },
    orange: {
      border: "border-orange-500/15",
      icon: "border-cyan-400/20 bg-cyan-500/15 shadow-[0_10px_30px_rgba(34,211,238,0.12)]",
      iconColor: "text-cyan-300",
      btn: "bg-gradient-to-r from-cyan-600 to-emerald-600 text-white shadow-lg shadow-cyan-950/20 hover:from-cyan-700 hover:to-emerald-700",
      badge: "border-orange-400/20 bg-orange-500/10 text-orange-300",
      itemColor: "text-emerald-300",
    },
    yellow: {
      border: "border-yellow-500/15",
      icon: "border-yellow-400/20 bg-yellow-500/15 shadow-[0_10px_30px_rgba(250,204,21,0.12)]",
      iconColor: "text-yellow-300",
      btn: "bg-yellow-500 text-black shadow-lg shadow-yellow-950/20 hover:bg-yellow-400",
      badge: "border-yellow-400/20 bg-yellow-500/10 text-yellow-300",
      itemColor: "text-yellow-300",
    },
    emerald: {
      border: "border-emerald-500/15",
      icon: "border-emerald-400/20 bg-emerald-500/15 shadow-[0_10px_30px_rgba(16,185,129,0.12)]",
      iconColor: "text-emerald-300",
      btn: "bg-gradient-to-r from-emerald-500 to-teal-500 text-white shadow-lg hover:from-emerald-400",
      badge: "border-emerald-400/20 bg-emerald-500/10 text-emerald-300",
      itemColor: "text-emerald-300",
    },
  }[accentColor] || {};

  const handleDeposit = () => {
    if (onPaymentClick) {
      onPaymentClick("deposit");
    } else {
      if (onClose) onClose();
      else window.dispatchEvent(new Event("close-workorder-panel"));
      navigateToPOS(o, navigate, { fromDashboard: true, openPaymentImmediately: true, paymentMode: "deposit" });
    }
  };

  const handleCollect = () => {
    if (onPaymentClick) {
      onPaymentClick("full");
    } else {
      if (onClose) onClose();
      else window.dispatchEvent(new Event("close-workorder-panel"));
      navigateToPOS(o, navigate, { fromDashboard: true, openPaymentImmediately: true, paymentMode: "full" });
    }
  };

  return (
    <section
      className={`relative overflow-hidden rounded-[30px] border ${accent.border} bg-[radial-gradient(circle_at_top_left,rgba(34,211,238,0.08),transparent_26%),radial-gradient(circle_at_bottom_right,rgba(59,130,246,0.08),transparent_30%),linear-gradient(180deg,rgba(24,24,27,0.98),rgba(10,10,12,0.98))] shadow-[0_22px_70px_rgba(0,0,0,0.35)]`}
    >
      <div className="absolute inset-0 bg-[linear-gradient(120deg,transparent,rgba(255,255,255,0.025),transparent)]" />

      {/* ── Header ── */}
      <div className="relative z-10 border-b border-white/10 px-6 py-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="flex items-start gap-4">
            <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border ${accent.icon}`}>
              <ShoppingCart className={`h-5 w-5 ${accent.iconColor}`} />
            </div>
            <div>
              <p className="text-[11px] font-semibold tracking-[0.28em] text-white/35">
                Compra y costo
              </p>
              <h3 className="mt-1 text-2xl font-semibold tracking-tight text-white">
                Piezas y Servicios
              </h3>
              <p className="mt-2 max-w-2xl text-sm leading-relaxed text-white/55">{subtitle}</p>
            </div>
          </div>
          <Button
            onClick={() => setShowCatalog(true)}
            className={`h-10 shrink-0 rounded-2xl px-5 font-bold ${accent.btn}`}
          >
            <ShoppingCart className="mr-2 h-4 w-4" />
            {catalogButtonLabel}
          </Button>
        </div>
      </div>

      {/* ── Items body ── */}
      <div className="relative z-10 p-6">
        {items.length === 0 ? (
          <div className="rounded-[24px] border border-dashed border-white/10 bg-black/20 px-6 py-12 text-center">
            <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl border border-white/10 bg-white/5">
              <Package className="h-5 w-5 text-white/35" />
            </div>
            <p className="text-sm font-semibold text-white/60">No hay items registrados</p>
            <p className="mt-1 text-xs text-white/35">
              Haz clic en "{catalogButtonLabel}" para agregar desde el catálogo.
            </p>
          </div>
        ) : (
          <div className="overflow-hidden rounded-[26px] border border-white/10 bg-black/25">
            {/* Item rows */}
            <div className="divide-y divide-white/5">
              {items.map((item, idx) => {
                const qty = Number(item?.qty || 1);
                const price = Number(item?.price || 0);
                const disc = Number(item?.discount_percentage || 0);
                const lineTotal = price * qty - price * qty * (disc / 100);
                const isSvc = item?.type === "service";
                return (
                  <div
                    key={`${item?.id || item?.name}-${idx}`}
                    className="flex items-start justify-between gap-4 px-5 py-4 transition-colors hover:bg-white/[0.03]"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-bold text-white">{item?.name || "Item"}</p>
                      <div className="mt-1.5 flex flex-wrap gap-2">
                        <Badge
                          variant="outline"
                          className="rounded-full border-white/10 bg-white/5 px-2 py-0.5 text-[10px] text-gray-300"
                        >
                          ${price.toFixed(2)} c/u
                        </Badge>
                        <Badge
                          variant="outline"
                          className={`rounded-full border-white/10 px-2 py-0.5 text-[10px] ${
                            isSvc ? "bg-violet-500/15 text-violet-300" : "bg-cyan-500/15 text-cyan-300"
                          }`}
                        >
                          {isSvc ? "Servicio" : "Pieza"}
                        </Badge>
                        {disc > 0 && (
                          <Badge
                            variant="outline"
                            className="rounded-full border-orange-500/20 bg-orange-500/10 px-2 py-0.5 text-[10px] text-orange-300"
                          >
                            -{disc}%
                          </Badge>
                        )}
                        {item?.taxable === false && (
                          <Badge className="rounded-full border-purple-500/30 bg-purple-500/20 px-2 py-0.5 text-[10px] text-purple-300">
                            Sin IVU
                          </Badge>
                        )}
                      </div>
                    </div>
                    <div className="shrink-0 text-right">
                      <div className="inline-flex items-center rounded-full border border-white/10 bg-white/5 px-2.5 py-0.5 text-xs font-semibold text-white/60">
                        x{qty}
                      </div>
                      <p className={`mt-1.5 text-xl font-semibold tracking-tight ${accent.itemColor}`}>
                        ${lineTotal.toFixed(2)}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Totals + payment */}
            <div className="grid gap-4 border-t border-white/10 bg-black/35 p-5 lg:grid-cols-[1fr_320px]">
              {/* Totals column */}
              <div className="space-y-2">
                <div className="rounded-[18px] border border-white/8 bg-black/20 px-5 py-3">
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-medium text-gray-400">Subtotal</span>
                    <span className="text-lg font-semibold text-white">${totals.subtotal.toFixed(2)}</span>
                  </div>
                </div>
                <div className="rounded-[18px] border border-white/8 bg-black/20 px-5 py-3">
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-medium text-gray-400">IVU (11.5%)</span>
                    <span className="text-lg font-semibold text-white">${totals.tax.toFixed(2)}</span>
                  </div>
                </div>
                {totals.paid > 0 && (
                  <div className="rounded-[18px] border border-blue-500/15 bg-blue-500/10 px-5 py-3">
                    <div className="flex items-center justify-between text-sm">
                      <span className="flex items-center gap-1.5 font-medium text-blue-300">
                        <Wallet className="h-3.5 w-3.5" />
                        Pagado&nbsp;/&nbsp;Depósito
                      </span>
                      <span className="text-lg font-semibold text-blue-300">-${totals.paid.toFixed(2)}</span>
                    </div>
                  </div>
                )}
                <div className="rounded-[18px] border border-emerald-500/15 bg-emerald-500/10 px-5 py-4">
                  <div className="flex items-center justify-between">
                    <span className="text-base font-bold text-white">Total Estimado</span>
                    <span className={`text-2xl font-semibold tracking-tight ${accent.itemColor}`}>
                      ${totals.total.toFixed(2)}
                    </span>
                  </div>
                </div>
              </div>

              {/* Payment buttons column */}
              <div className="rounded-[22px] border border-white/10 bg-black/20 p-4 flex flex-col justify-between gap-3">
                <div>
                  <p className="text-[11px] font-semibold tracking-[0.28em] text-white/35">
                    Cobro
                  </p>
                  <h4 className="mt-1.5 text-xl font-semibold tracking-tight text-white">
                    {totals.isPaid ? "Sin balance pendiente" : `Balance: $${totals.balance.toFixed(2)}`}
                  </h4>
                </div>

                {totals.isPaid ? (
                  <div className="flex items-center gap-2 rounded-[16px] border border-emerald-500/20 bg-emerald-500/10 p-3">
                    <CheckCircle2 className="h-5 w-5 text-emerald-400" />
                    <span className="text-sm font-bold text-emerald-300">Orden saldada</span>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-2">
                    <Button
                      onClick={handleDeposit}
                      className="h-11 rounded-2xl bg-gradient-to-r from-emerald-600 to-green-600 text-white shadow-lg hover:from-emerald-500 hover:to-green-500"
                    >
                      <Wallet className="h-4 w-4 mr-2 flex-shrink-0" />
                      Depósito
                    </Button>
                    <Button
                      onClick={handleCollect}
                      className="h-11 rounded-2xl bg-gradient-to-r from-cyan-600 to-blue-600 text-white shadow-lg hover:from-cyan-500 hover:to-blue-500"
                    >
                      <DollarSign className="h-4 w-4 mr-2 flex-shrink-0" />
                      Cobrar
                    </Button>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ── AddItemModal ── */}
      <AddItemModal
        open={showCatalog}
        onClose={() => setShowCatalog(false)}
        order={o}
        onSave={(newItems) => {
          onOrderItemsUpdate?.(newItems);
          setShowCatalog(false);
        }}
        onRemoteSaved={onRemoteSaved}
        onUpdate={onUpdate}
      />
    </section>
  );
}
