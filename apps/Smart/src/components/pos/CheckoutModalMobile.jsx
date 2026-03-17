import React from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { X, CreditCard, Banknote, Smartphone, AlertCircle, Loader2, Package } from "lucide-react";

export default function CheckoutModalMobile({
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
  quickCashAmounts
}) {
  if (!open) return null;

  const finalTotal = effectiveTotal || total || 0;

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 pointer-events-auto">
      <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={onClose} />

      <div className="relative w-full max-w-4xl bg-[#0F0F12] border border-white/10 rounded-3xl overflow-hidden shadow-2xl animate-in fade-in zoom-in-95 duration-200 max-h-[90vh] flex pointer-events-auto">
        {/* Header - Fijo */}
        <div className="absolute top-0 left-0 right-0 flex items-center justify-between p-6 pb-2 z-10 bg-gradient-to-b from-[#0F0F12] to-transparent">
          <div className="flex items-center gap-3">
            <CreditCard className="w-6 h-6 text-blue-500" />
            <h3 className="text-xl font-bold text-white">Finalizar Cobro</h3>
          </div>
          <button onClick={onClose} className="text-zinc-500 hover:text-white transition-colors">
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* LAYOUT HORIZONTAL - Dos columnas lado a lado */}
        <div className="flex flex-1 overflow-hidden pt-20">
          {/* COLUMNA IZQUIERDA - Resumen */}
          <div className="flex-1 border-r border-white/10 p-5 space-y-4 overflow-y-auto">
            {/* Resumen de compra */}
            <div className="bg-gradient-to-br from-blue-500/20 to-blue-600/10 rounded-2xl p-4 border border-blue-500/30">
              <p className="text-xs text-blue-300 mb-2 font-semibold">TOTAL A PAGAR</p>
              <div className="text-3xl font-black text-white mb-3">${(Number(finalTotal) || 0).toFixed(2)}</div>

              {workOrderId && totalPaid > 0 && (
                <div className="text-sm text-yellow-300 mb-2">
                  <p>Ya pagado: ${(Number(totalPaid) || 0).toFixed(2)}</p>
                </div>
              )}

              <div className="space-y-1 text-xs text-white/60 border-t border-blue-500/20 pt-2">
                <div className="flex justify-between">
                  <span>Subtotal</span>
                  <span>${subtotal.toFixed(2)}</span>
                </div>
                {discountAmount > 0 && (
                  <div className="flex justify-between text-orange-400">
                    <span>Descuento</span>
                    <span>-${discountAmount.toFixed(2)}</span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span>IVU (11.5%)</span>
                  <span>${tax.toFixed(2)}</span>
                </div>
              </div>
            </div>

            {/* Toggle IVU */}
            <div className="flex items-center justify-between p-3 bg-[#18181B] rounded-xl border border-white/5">
              <div>
                <p className="text-sm font-semibold text-white">Aplicar IVU</p>
                <p className="text-xs text-zinc-500">+11.5%</p>
              </div>
              <button
                onClick={() => setTaxEnabled(!taxEnabled)}
                className={`relative w-12 h-7 rounded-full transition-colors ${
                  taxEnabled ? "bg-blue-600" : "bg-gray-600"
                }`}
              >
                <span
                  className={`absolute top-1 left-1 w-5 h-5 bg-white rounded-full transition-transform ${
                    taxEnabled ? "translate-x-5" : ""
                  }`}
                />
              </button>
            </div>
          </div>

          {/* COLUMNA DERECHA - Métodos de pago */}
          <div className="flex-1 p-5 space-y-4 overflow-y-auto flex flex-col">
            <p className="text-xs text-zinc-500 font-semibold">Elige método de pago</p>

            {/* Métodos de pago */}
            <div className="space-y-3">
              {enabledPaymentMethods.cash && (
                <button
                  onClick={() => setPaymentMethod("cash")}
                  className={`w-full p-3 rounded-2xl border transition-all flex items-center gap-3 ${
                    paymentMethod === "cash"
                      ? "bg-emerald-900/30 border-emerald-500/70"
                      : "bg-[#18181B] border-emerald-500/50 hover:border-emerald-500/70"
                  }`}
                >
                  {paymentMethod === "cash" && (
                    <div className="w-5 h-5 rounded flex items-center justify-center bg-emerald-500 flex-shrink-0">
                      <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                    </div>
                  )}
                  <div
                    className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                      paymentMethod === "cash" ? "bg-emerald-500 text-white" : "bg-emerald-500/20 text-emerald-500"
                    }`}
                  >
                    <Banknote className="w-5 h-5" />
                  </div>
                  <div className="text-left flex-1">
                    <p className="font-bold text-white text-sm">Efectivo</p>
                    <p className="text-xs text-zinc-500">Ingresa monto</p>
                  </div>
                </button>
              )}

              {enabledPaymentMethods.card && (
                <button
                  onClick={() => setPaymentMethod("card")}
                  className={`w-full p-3 rounded-2xl border transition-all flex items-center gap-3 ${
                    paymentMethod === "card"
                      ? "bg-blue-900/30 border-blue-500/70"
                      : "bg-[#18181B] border-blue-500/50 hover:border-blue-500/70"
                  }`}
                >
                  {paymentMethod === "card" && (
                    <div className="w-5 h-5 rounded flex items-center justify-center bg-blue-500 flex-shrink-0">
                      <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                    </div>
                  )}
                  <div
                    className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                      paymentMethod === "card" ? "bg-blue-500 text-white" : "bg-blue-500/20 text-blue-500"
                    }`}
                  >
                    <CreditCard className="w-5 h-5" />
                  </div>
                  <div className="text-left flex-1">
                    <p className="font-bold text-white text-sm">Tarjeta</p>
                    <p className="text-xs text-zinc-500">Exacto: ${(Number(finalTotal) || 0).toFixed(2)}</p>
                  </div>
                </button>
              )}

              {enabledPaymentMethods.ath_movil && (
                <button
                  onClick={() => setPaymentMethod("ath_movil")}
                  className={`w-full p-3 rounded-2xl border transition-all flex items-center gap-3 ${
                    paymentMethod === "ath_movil"
                      ? "bg-orange-900/30 border-orange-500/70"
                      : "bg-[#18181B] border-orange-500/50 hover:border-orange-500/70"
                  }`}
                >
                  {paymentMethod === "ath_movil" && (
                    <div className="w-5 h-5 rounded flex items-center justify-center bg-orange-500 flex-shrink-0">
                      <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                    </div>
                  )}
                  <div
                    className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                      paymentMethod === "ath_movil" ? "bg-orange-500 text-white" : "bg-orange-500/20 text-orange-500"
                    }`}
                  >
                    <Smartphone className="w-5 h-5" />
                  </div>
                  <div className="text-left flex-1">
                    <p className="font-bold text-white text-sm">ATH Móvil</p>
                    <p className="text-xs text-zinc-500">Por teléfono</p>
                  </div>
                </button>
              )}

              {enabledPaymentMethods.cash && enabledPaymentMethods.ath_movil && (
                <button
                  onClick={() => setPaymentMethod("mixed")}
                  className={`w-full p-3 rounded-2xl border transition-all flex items-center gap-3 ${
                    paymentMethod === "mixed"
                      ? "bg-purple-900/30 border-purple-500/70"
                      : "bg-[#18181B] border-purple-500/50 hover:border-purple-500/70"
                  }`}
                >
                  {paymentMethod === "mixed" && (
                    <div className="w-5 h-5 rounded flex items-center justify-center bg-purple-500 flex-shrink-0">
                      <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                    </div>
                  )}
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                    paymentMethod === "mixed" ? "bg-purple-500 text-white" : "bg-purple-500/20 text-purple-400"
                  }`}>
                    <CreditCard className="w-5 h-5" />
                  </div>
                  <div className="text-left flex-1">
                    <p className="font-bold text-white text-sm">Pago Dividido</p>
                    <p className="text-xs text-zinc-500">Efectivo + ATH</p>
                  </div>
                </button>
              )}
            </div>

            {/* Inputs dinámicos */}
            {paymentMode === "deposit" && (
              <div className="space-y-2">
                <p className="text-xs text-gray-400">Monto a depositar</p>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-lg font-bold text-white/60">$</span>
                  <Input
                    type="number"
                    step="0.01"
                    value={depositAmount}
                    onChange={(e) => setDepositAmount(e.target.value)}
                    placeholder="0.00"
                    className="pl-9 h-12 bg-[#18181B] border-blue-500/30 text-xl font-bold text-center"
                    autoFocus
                  />
                </div>
                {depositAmount && parseFloat(depositAmount) > finalTotal && (
                  <div className="flex items-center gap-2 text-red-400 text-xs p-2 bg-red-500/10 rounded border border-red-500/20">
                    <AlertCircle className="w-3 h-3" />
                    No puede exceder ${(Number(finalTotal) || 0).toFixed(2)}
                  </div>
                )}
              </div>
            )}

            {paymentMethod === "cash" && paymentMode !== "deposit" && (
              <div className="space-y-2">
                <Input
                  type="number"
                  value={cashReceived}
                  onChange={(e) => setCashReceived(e.target.value)}
                  placeholder="Monto recibido"
                  className="h-12 bg-[#18181B] border-emerald-500/30 text-xl font-bold text-center"
                  autoFocus
                />
                {change > 0 && (
                  <div className="p-3 bg-emerald-500/10 rounded-xl border border-emerald-500/20 flex justify-between">
                    <span className="text-emerald-400 font-medium">Cambio</span>
                    <span className="text-emerald-400 font-bold text-lg">${change.toFixed(2)}</span>
                  </div>
                )}
              </div>
            )}

            {paymentMethod === "ath_movil" && (
              <div className="space-y-2">
                <Input
                  value={athMovilPhone}
                  onChange={(e) => setAthMovilPhone(e.target.value)}
                  placeholder="Teléfono (787...)"
                  className="h-11 bg-[#18181B] border-orange-500/30"
                />
                <Input
                  value={athMovilName}
                  onChange={(e) => setAthMovilName(e.target.value)}
                  placeholder="Nombre del pagador"
                  className="h-11 bg-[#18181B] border-orange-500/30"
                />
              </div>
            )}

            {paymentMethod === "mixed" && (
              <div className="space-y-2">
                <Input
                  type="number"
                  value={splitCashAmount}
                  onChange={(e) => setSplitCashAmount(e.target.value)}
                  placeholder="Monto en efectivo"
                  className="h-11 bg-[#18181B] border-emerald-500/30"
                />
                <Input
                  type="number"
                  value={splitAthAmount}
                  onChange={(e) => setSplitAthAmount(e.target.value)}
                  placeholder="Monto en ATH Móvil"
                  className="h-11 bg-[#18181B] border-orange-500/30"
                />
                <Input
                  value={athMovilPhone}
                  onChange={(e) => setAthMovilPhone(e.target.value)}
                  placeholder="Teléfono ATH"
                  className="h-11 bg-[#18181B] border-orange-500/30"
                />
                <Input
                  value={athMovilName}
                  onChange={(e) => setAthMovilName(e.target.value)}
                  placeholder="Nombre de quien envió ATH"
                  className="h-11 bg-[#18181B] border-orange-500/30"
                />
              </div>
            )}

            {/* Botón Confirmar */}
            {paymentMethod && (
              <Button
                onClick={onConfirmPayment}
                disabled={processing || !isPaymentValid}
                className={`w-full h-12 text-lg font-bold rounded-xl shadow-lg transition-all mt-auto ${
                  paymentMethod === "cash"
                    ? "bg-emerald-600 hover:bg-emerald-500"
                    : paymentMethod === "card"
                    ? "bg-blue-600 hover:bg-blue-500"
                    : paymentMethod === "mixed"
                    ? "bg-purple-600 hover:bg-purple-500"
                    : "bg-orange-600 hover:bg-orange-500"
                }`}
              >
                {processing ? <Loader2 className="w-5 h-5 animate-spin mr-2 inline" /> : null}
                Confirmar Pago
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
