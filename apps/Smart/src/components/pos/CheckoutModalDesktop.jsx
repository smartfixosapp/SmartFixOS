import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { X, CreditCard, Package, Banknote, Smartphone, AlertCircle, Loader2, Lightbulb } from "lucide-react";
import { subscribeToCashRegister } from "@/components/cash/CashRegisterService";

export default function CheckoutModalDesktop({
  open,
  onClose,
  total,
  effectiveTotal,
  subtotal,
  tax,
  taxEnabled,
  setTaxEnabled,
  paymentMethod,
  setPaymentMethod,
  cashReceived,
  setCashReceived,
  splitCashAmount,
  setSplitCashAmount,
  splitAthAmount,
  setSplitAthAmount,
  depositAmount,
  setDepositAmount,
  athMovilPhone,
  setAthMovilPhone,
  athMovilName,
  setAthMovilName,
  cart,
  change,
  isPaymentValid,
  processing,
  onConfirmPayment,
  enabledPaymentMethods,
  paymentMode,
  totalPaid,
  workOrderId,
  discountAmount,
  quickDepositAmounts,
  quickCashAmounts,
  orderTotal
}) {
  // Cash register status indicator
  const [drawerOpen, setDrawerOpen] = useState(false);
  useEffect(() => {
    if (!open) return;
    const unsub = subscribeToCashRegister((cache) => {
      setDrawerOpen(!!cache?.isOpen);
    });
    return unsub;
  }, [open]);

  if (!open) return null;

  const finalTotal = effectiveTotal || total || 0;

  return (
    <div className="apple-type fixed inset-0 z-[100] flex items-center justify-center sm:p-4 p-0">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />

      <div className="relative w-full h-[100dvh] sm:h-auto sm:max-h-[90vh] sm:max-w-4xl apple-surface-elevated sm:rounded-apple-lg shadow-apple-xl border-0 overflow-hidden animate-in fade-in zoom-in-95 duration-300 flex flex-col">
        {/* Header */}
        <div className="sticky top-0 left-0 right-0 flex items-center justify-between p-4 sm:p-6 pb-3 sm:pb-4 z-20 apple-surface-elevated flex-shrink-0" style={{ paddingTop: "calc(env(safe-area-inset-top, 12px) + 12px)", borderBottom: "0.5px solid rgb(var(--separator) / 0.29)" }}>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-apple-sm bg-apple-blue/15 flex items-center justify-center text-apple-blue">
              <CreditCard className="w-5 h-5" />
            </div>
            <h3 className="apple-text-title2 apple-label-primary">Finalizar Cobro</h3>
          </div>
          <div className="flex items-center gap-2">
            {/* Cash register status indicator */}
            <div
              title={drawerOpen ? "Caja abierta" : "Caja cerrada — abre la caja para cobrar"}
              className={`w-10 h-10 rounded-full flex items-center justify-center transition-all ${
                drawerOpen
                  ? "bg-apple-green/15 text-apple-green"
                  : "bg-apple-red/15 text-apple-red animate-pulse"
              }`}
            >
              <Lightbulb className="w-5 h-5" />
            </div>
            <button onClick={onClose} className="apple-press w-10 h-10 rounded-full bg-gray-sys6 dark:bg-gray-sys5 apple-label-secondary hover:apple-label-primary transition-all flex items-center justify-center">
              <X className="w-6 h-6" />
            </button>
          </div>
        </div>

        {/* Content: single scroll on mobile, two columns on desktop */}
        <div className="flex-1 overflow-y-auto sm:overflow-hidden sm:flex sm:flex-row" style={{ WebkitOverflowScrolling: "touch" }}>
          {/* LEFT COLUMN - RESUMEN */}
          <div className="w-full sm:w-[40%] p-4 sm:p-6 space-y-4 sm:space-y-6 sm:overflow-y-auto apple-surface" style={{ borderRight: "0.5px solid rgb(var(--separator) / 0.29)" }}>
            {/* Resumen de Compra */}
            <div className="apple-card p-4">
              <div className="flex items-center gap-2 mb-4">
                <Package className="w-5 h-5 text-apple-orange" />
                <span className="apple-text-subheadline font-semibold text-apple-orange">Resumen de Compra</span>
              </div>

              <div className="space-y-2 mb-4 max-h-40 overflow-y-auto pr-2">
                {cart.map((item, idx) => {
                  const base = Number(item.price || 0) * Number(item.quantity || 1);
                  const disc = Number(item.discount_percentage || item.discount_percent || 0);
                  const lineTotal = base - base * (disc / 100);
                  const hasDiscount = disc > 0;
                  const isFullDiscount = disc >= 100;
                  return (
                    <div key={idx} className="flex justify-between apple-text-subheadline items-start">
                      <span className="apple-label-secondary truncate pr-4">
                        {item.quantity}x {item.name}
                        {hasDiscount && (
                          <span className="ml-1 apple-text-caption2 font-bold text-apple-yellow">
                            -{disc}%{isFullDiscount && " CORTESÍA"}
                          </span>
                        )}
                      </span>
                      <span className="whitespace-nowrap flex items-center gap-1.5 tabular-nums">
                        {hasDiscount && (
                          <span className="apple-label-tertiary line-through apple-text-caption1">${base.toFixed(2)}</span>
                        )}
                        <span className={`font-medium ${isFullDiscount ? "text-apple-green" : "apple-label-primary"}`}>
                          {isFullDiscount ? "GRATIS" : `$${lineTotal.toFixed(2)}`}
                        </span>
                      </span>
                    </div>
                  );
                })}
              </div>

              <div className="space-y-1 pt-3" style={{ borderTop: "0.5px solid rgb(var(--separator) / 0.29)" }}>
                <div className="flex justify-between apple-text-subheadline apple-label-secondary tabular-nums">
                  <span>Subtotal</span>
                  <span>${subtotal.toFixed(2)}</span>
                </div>
                {discountAmount > 0 && (
                  <div className="flex justify-between apple-text-subheadline text-apple-orange tabular-nums">
                    <span>Descuento</span>
                    <span>-${discountAmount.toFixed(2)}</span>
                  </div>
                )}
                <div className="flex justify-between apple-text-subheadline apple-label-secondary tabular-nums">
                  <span>IVU (11.5%)</span>
                  <span>${tax.toFixed(2)}</span>
                </div>
                <div className={`flex justify-between font-bold pt-2 tabular-nums ${workOrderId ? 'apple-text-headline apple-label-primary' : 'apple-text-title3 text-apple-blue'}`} style={{ borderTop: "0.5px solid rgb(var(--separator) / 0.29)" }}>
                  <span>{workOrderId ? "Total de la Orden" : "Total"}</span>
                  <span>${(Number(workOrderId ? orderTotal : finalTotal) || 0).toFixed(2)}</span>
                </div>

                {workOrderId && (
                  <>
                    {totalPaid > 0 && (
                      <div className="flex justify-between apple-text-subheadline text-apple-blue pt-1 tabular-nums">
                        <span>Ya Pagado</span>
                        <span className="font-bold">-${(Number(totalPaid) || 0).toFixed(2)}</span>
                      </div>
                    )}
                    <div className="flex justify-between apple-text-title3 font-bold text-apple-yellow pt-2 mt-2 tabular-nums" style={{ borderTop: "0.5px dashed rgb(var(--separator) / 0.29)" }}>
                      <span>Balance Pendiente</span>
                      <span>${(Number(finalTotal) || 0).toFixed(2)}</span>
                    </div>
                  </>
                )}

                {paymentMode === "deposit" && depositAmount && (
                  <div className="flex justify-between apple-text-headline font-bold text-apple-green pt-2 tabular-nums" style={{ borderTop: "0.5px solid rgb(var(--separator) / 0.29)" }}>
                    <span>A Pagar (Depósito)</span>
                    <span>${(parseFloat(depositAmount) || 0).toFixed(2)}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Toggle IVU */}
            <button
              onClick={() => setTaxEnabled(!taxEnabled)}
              className="apple-press w-full flex items-center justify-between px-3 py-2.5 apple-card"
            >
              <span className={`apple-text-footnote font-semibold ${taxEnabled ? "text-apple-green" : "apple-label-secondary"}`}>
                IVU 11.5%
              </span>
              <div className={`relative w-9 h-5 rounded-full transition-colors duration-200 ${taxEnabled ? "bg-apple-green" : "bg-gray-sys5"}`}>
                <span className={`absolute top-[2px] left-[2px] w-4 h-4 bg-white rounded-full transition-transform duration-200 ${taxEnabled ? "translate-x-4" : ""}`} />
              </div>
            </button>
          </div>

          {/* RIGHT COLUMN - PAGO */}
          <div className="flex-1 p-4 sm:p-6 space-y-5 sm:space-y-7 sm:overflow-y-auto flex flex-col apple-surface-elevated">
            {/* Métodos de Pago — icon row on mobile, full cards on desktop */}
            <div>
              <p className="apple-text-caption2 font-semibold apple-label-secondary mb-2 sm:hidden">Método de pago</p>
              {/* MOBILE: horizontal icon row */}
              <div className="flex gap-2 sm:hidden">
                {[
                  { id: "cash", icon: Banknote, label: "Efectivo", tint: "green", enabled: enabledPaymentMethods.cash },
                  { id: "card", icon: CreditCard, label: "Tarjeta", tint: "blue", enabled: enabledPaymentMethods.card },
                  { id: "ath_movil", icon: Smartphone, label: "ATH", tint: "orange", enabled: enabledPaymentMethods.ath_movil },
                  { id: "mixed", icon: CreditCard, label: "Dividido", tint: "purple", enabled: enabledPaymentMethods.cash && enabledPaymentMethods.ath_movil },
                ].filter(m => m.enabled).map(m => {
                  const selected = paymentMethod === m.id;
                  return (
                    <button
                      key={m.id}
                      onClick={() => setPaymentMethod(m.id)}
                      className={`apple-press flex-1 flex flex-col items-center gap-1.5 py-3 rounded-apple-md transition-all ${selected ? `bg-apple-${m.tint}/15` : "bg-gray-sys6 dark:bg-gray-sys5"}`}
                    >
                      <div className={`w-10 h-10 rounded-apple-sm flex items-center justify-center transition-all ${selected ? `bg-apple-${m.tint} text-white` : `bg-apple-${m.tint}/12 text-apple-${m.tint}`}`}>
                        <m.icon className="w-5 h-5" />
                      </div>
                      <span className={`apple-text-caption2 font-semibold ${selected ? "apple-label-primary" : "apple-label-secondary"}`}>{m.label}</span>
                    </button>
                  );
                })}
              </div>

              {/* DESKTOP: full card buttons */}
              <div className="hidden sm:block space-y-3">
                {enabledPaymentMethods.cash && (
                  <button onClick={() => setPaymentMethod("cash")}
                    className={`apple-press w-full p-5 rounded-apple-lg transition-all duration-300 flex items-center gap-5 ${paymentMethod === "cash" ? "bg-apple-green/12 ring-2 ring-apple-green/50" : "apple-card"}`}>
                    <div className={`w-14 h-14 rounded-apple-md flex items-center justify-center ${paymentMethod === "cash" ? "bg-apple-green text-white" : "bg-apple-green/15 text-apple-green"}`}>
                      <Banknote className="w-7 h-7" />
                    </div>
                    <div className="text-left flex-1">
                      <p className={`apple-text-headline ${paymentMethod === "cash" ? "apple-label-primary" : "apple-label-primary"}`}>Efectivo</p>
                      <p className="apple-text-footnote apple-label-secondary">Monto Recibido</p>
                    </div>
                  </button>
                )}
                {enabledPaymentMethods.card && (
                  <button onClick={() => setPaymentMethod("card")}
                    className={`apple-press w-full p-5 rounded-apple-lg transition-all duration-300 flex items-center gap-5 ${paymentMethod === "card" ? "bg-apple-blue/12 ring-2 ring-apple-blue/50" : "apple-card"}`}>
                    <div className={`w-14 h-14 rounded-apple-md flex items-center justify-center ${paymentMethod === "card" ? "bg-apple-blue text-white" : "bg-apple-blue/15 text-apple-blue"}`}>
                      <CreditCard className="w-7 h-7" />
                    </div>
                    <div className="text-left flex-1">
                      <p className={`apple-text-headline ${paymentMethod === "card" ? "apple-label-primary" : "apple-label-primary"}`}>Tarjeta</p>
                      <p className="apple-text-footnote apple-label-secondary tabular-nums">Exacto: ${(Number(finalTotal) || 0).toFixed(2)}</p>
                    </div>
                  </button>
                )}
                {enabledPaymentMethods.ath_movil && (
                  <button onClick={() => setPaymentMethod("ath_movil")}
                    className={`apple-press w-full p-5 rounded-apple-lg transition-all duration-300 flex items-center gap-5 ${paymentMethod === "ath_movil" ? "bg-apple-orange/12 ring-2 ring-apple-orange/50" : "apple-card"}`}>
                    <div className={`w-14 h-14 rounded-apple-md flex items-center justify-center ${paymentMethod === "ath_movil" ? "bg-apple-orange text-white" : "bg-apple-orange/15 text-apple-orange"}`}>
                      <Smartphone className="w-7 h-7" />
                    </div>
                    <div className="text-left flex-1">
                      <p className={`apple-text-headline ${paymentMethod === "ath_movil" ? "apple-label-primary" : "apple-label-primary"}`}>ATH Móvil</p>
                      <p className="apple-text-footnote apple-label-secondary">Pago Exacto</p>
                    </div>
                  </button>
                )}
                {enabledPaymentMethods.cash && enabledPaymentMethods.ath_movil && (
                  <button onClick={() => setPaymentMethod("mixed")}
                    className={`apple-press w-full p-5 rounded-apple-lg transition-all duration-300 flex items-center gap-5 ${paymentMethod === "mixed" ? "bg-apple-purple/12 ring-2 ring-apple-purple/50" : "apple-card"}`}>
                    <div className={`w-14 h-14 rounded-apple-md flex items-center justify-center ${paymentMethod === "mixed" ? "bg-apple-purple text-white" : "bg-apple-purple/15 text-apple-purple"}`}>
                      <CreditCard className="w-7 h-7" />
                    </div>
                    <div className="text-left flex-1">
                      <p className={`apple-text-headline ${paymentMethod === "mixed" ? "apple-label-primary" : "apple-label-primary"}`}>Dividido</p>
                      <p className="apple-text-footnote apple-label-secondary">Efectivo + ATH</p>
                    </div>
                  </button>
                )}
              </div>
            </div>

            {/* Inputs Dinámicos */}
            {paymentMode === "deposit" && (
              <div className="space-y-3">
                <p className="apple-text-footnote apple-label-secondary">Ingresa cantidad a depositar</p>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 apple-text-title3 font-bold apple-label-secondary">$</span>
                  <Input
                    type="text"
                    inputMode="decimal"
                    pattern="[0-9]*[.,]?[0-9]*"
                    value={depositAmount}
                    onChange={(e) => setDepositAmount(e.target.value.replace(/[^0-9.]/g, ""))}
                    placeholder="0.00"
                    className="apple-input pl-10 h-12 tabular-nums"
                    autoFocus
                  />
                </div>
                {depositAmount && parseFloat(depositAmount) > finalTotal && (
                   <div className="flex items-center gap-2 text-apple-red apple-text-caption1 p-2 bg-apple-red/12 rounded-apple-sm">
                     <AlertCircle className="w-3 h-3" />
                     No puede exceder ${(Number(finalTotal) || 0).toFixed(2)}
                   </div>
                 )}
              </div>
            )}

            {paymentMethod === "cash" && paymentMode !== "deposit" && (
              <div className="space-y-3">
                  <Input
                    type="text"
                    inputMode="decimal"
                    pattern="[0-9]*[.,]?[0-9]*"
                    value={cashReceived}
                    onChange={(e) => setCashReceived(e.target.value.replace(/[^0-9.]/g, ""))}
                    placeholder="Monto recibido"
                    className="apple-input h-16 apple-text-title1 text-center tabular-nums"
                    autoFocus
                  />
                  {change > 0 && (
                    <div className="p-5 bg-apple-green/12 rounded-apple-md flex justify-between items-center animate-in slide-in-from-top-2 duration-300">
                      <span className="text-apple-green apple-text-caption1 font-semibold">Cambio Sugerido</span>
                      <span className="text-apple-green apple-text-title2 font-bold tabular-nums">${change.toFixed(2)}</span>
                    </div>
                  )}
              </div>
            )}

            {paymentMethod === "ath_movil" && (
              <div className="space-y-2">
                <Input
                  value={athMovilPhone}
                  onChange={(e) => setAthMovilPhone(e.target.value)}
                  placeholder="Teléfono (Opcional)"
                  className="apple-input h-11"
                />
                <Input
                  value={athMovilName}
                  onChange={(e) => setAthMovilName(e.target.value)}
                  placeholder="Nombre del pagador (Opcional)"
                  className="apple-input h-11"
                />
              </div>
            )}

            {paymentMethod === "mixed" && (
              <div className="space-y-2">
                <Input
                  type="text"
                  inputMode="decimal"
                  pattern="[0-9]*[.,]?[0-9]*"
                  value={splitCashAmount}
                  onChange={(e) => setSplitCashAmount(e.target.value.replace(/[^0-9.]/g, ""))}
                  placeholder="Monto en efectivo"
                  className="apple-input h-11 tabular-nums"
                />
                <Input
                  type="text"
                  inputMode="decimal"
                  pattern="[0-9]*[.,]?[0-9]*"
                  value={splitAthAmount}
                  onChange={(e) => setSplitAthAmount(e.target.value.replace(/[^0-9.]/g, ""))}
                  placeholder="Monto en ATH Móvil"
                  className="apple-input h-11 tabular-nums"
                />
                <Input
                  value={athMovilPhone}
                  onChange={(e) => setAthMovilPhone(e.target.value)}
                  placeholder="Teléfono ATH (Opcional)"
                  className="apple-input h-11"
                />
                <Input
                  value={athMovilName}
                  onChange={(e) => setAthMovilName(e.target.value)}
                  placeholder="Nombre de quien envió ATH (Opcional)"
                  className="apple-input h-11"
                />
              </div>
            )}

            {/* Botón Confirmar */}
            {paymentMethod && (
              <Button
                onClick={onConfirmPayment}
                disabled={processing || !isPaymentValid}
                className={`apple-btn apple-btn-lg w-full h-16 sm:h-20 mt-auto ${
                  paymentMethod === "cash"
                    ? "apple-btn-primary bg-apple-green"
                    : paymentMethod === "card"
                    ? "apple-btn-primary"
                    : paymentMethod === "mixed"
                    ? "apple-btn-primary bg-apple-purple"
                    : "apple-btn-primary bg-apple-orange"
                }`}
              >
                {processing ? <Loader2 className="w-6 h-6 animate-spin mr-3 inline" /> : null}
                Finalizar Transacción
              </Button>
            )}

            {/* Safe area bottom padding for mobile */}
            <div className="sm:hidden" style={{ height: "env(safe-area-inset-bottom, 20px)" }} />
          </div>
        </div>
      </div>
    </div>
  );
}
