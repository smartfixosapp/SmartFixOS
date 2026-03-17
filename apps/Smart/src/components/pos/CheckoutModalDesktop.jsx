import React from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { X, CreditCard, Package, Banknote, Smartphone, AlertCircle, Loader2 } from "lucide-react";

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
  quickCashAmounts
}) {
  if (!open) return null;

  const finalTotal = effectiveTotal || total || 0;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={onClose} />

      <div className="relative w-full max-w-4xl bg-[#0F0F12] border border-white/10 rounded-3xl overflow-hidden shadow-2xl animate-in fade-in zoom-in-95 duration-200 flex max-h-[90vh]">
        {/* Header */}
        <div className="absolute top-0 left-0 right-0 flex items-center justify-between p-6 pb-2 z-10 bg-gradient-to-b from-[#0F0F12] to-transparent">
          <div className="flex items-center gap-3">
            <CreditCard className="w-6 h-6 text-blue-500" />
            <h3 className="text-2xl font-bold text-white">Finalizar Cobro</h3>
          </div>
          <button onClick={onClose} className="text-zinc-500 hover:text-white transition-colors">
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Two Column Layout */}
        <div className="flex flex-1 overflow-hidden pt-20">
          {/* LEFT COLUMN - RESUMEN */}
          <div className="flex-1 border-r border-white/10 p-6 space-y-6 overflow-y-auto">
            {/* Resumen de Compra */}
            <div className="bg-[#18181B] rounded-2xl p-4 border border-white/5">
              <div className="flex items-center gap-2 mb-4">
                <Package className="w-5 h-5 text-orange-400" />
                <span className="text-sm font-semibold text-orange-400">Resumen de Compra</span>
              </div>

              <div className="space-y-2 mb-4 max-h-40 overflow-y-auto pr-2">
                {cart.map((item, idx) => (
                  <div key={idx} className="flex justify-between text-sm">
                    <span className="text-zinc-400 truncate pr-4">
                      {item.quantity}x {item.name}
                    </span>
                    <span className="text-white font-medium whitespace-nowrap">
                      ${(item.price * item.quantity).toFixed(2)}
                    </span>
                  </div>
                ))}
              </div>

              <div className="space-y-1 pt-3 border-t border-white/5">
                <div className="flex justify-between text-sm text-zinc-500">
                  <span>Subtotal</span>
                  <span>${subtotal.toFixed(2)}</span>
                </div>
                {discountAmount > 0 && (
                  <div className="flex justify-between text-sm text-orange-400">
                    <span>Descuento</span>
                    <span>-${discountAmount.toFixed(2)}</span>
                  </div>
                )}
                <div className="flex justify-between text-sm text-zinc-500">
                  <span>IVU (11.5%)</span>
                  <span>${tax.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-xl font-bold text-cyan-400 pt-2 border-t border-white/5">
                  <span>Total</span>
                  <span>${(Number(finalTotal) || 0).toFixed(2)}</span>
                </div>

                {workOrderId && totalPaid > 0 && (
                  <>
                    <div className="flex justify-between text-sm text-blue-400 pt-2 border-t border-white/5">
                      <span>Ya Pagado</span>
                      <span className="font-bold">-${(Number(totalPaid) || 0).toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-lg font-bold text-yellow-400 pt-1">
                      <span>Balance Pendiente</span>
                      <span>${(Number(finalTotal) || 0).toFixed(2)}</span>
                    </div>
                  </>
                )}

                {paymentMode === "deposit" && depositAmount && (
                  <div className="flex justify-between text-lg font-bold text-emerald-400 pt-2 border-t border-white/5">
                    <span>A Pagar (Depósito)</span>
                    <span>${(parseFloat(depositAmount) || 0).toFixed(2)}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Toggle IVU */}
            <div className="flex items-center justify-between p-3 bg-[#18181B] rounded-xl border border-white/5">
              <div>
                <p className="text-sm font-semibold text-white">IVU (Impuesto 11.5%)</p>
                <p className="text-xs text-zinc-500 mt-0.5">Aplicar impuesto a la venta</p>
              </div>
              <button
                onClick={() => setTaxEnabled(!taxEnabled)}
                className={`relative w-14 h-7 rounded-full transition-colors ${
                  taxEnabled ? "bg-blue-600" : "bg-gray-600"
                }`}
              >
                <span
                  className={`absolute top-1 left-1 w-5 h-5 bg-white rounded-full transition-transform ${
                    taxEnabled ? "translate-x-7" : ""
                  }`}
                />
              </button>
            </div>
          </div>

          {/* RIGHT COLUMN - PAGO */}
          <div className="flex-1 p-6 space-y-6 overflow-y-auto flex flex-col">
            {/* Métodos de Pago */}
             <div className="space-y-3">

              {enabledPaymentMethods.cash && (
                <button
                  onClick={() => setPaymentMethod("cash")}
                  className={`w-full p-4 rounded-2xl border transition-all flex items-center gap-4 group ${
                    paymentMethod === "cash"
                      ? "bg-emerald-900/30 border-emerald-500/70"
                      : "bg-[#18181B] border-emerald-500/50 hover:border-emerald-500/70 hover:bg-emerald-900/20"
                  }`}
                >
                  {paymentMethod === "cash" && (
                    <div className="w-6 h-6 rounded flex items-center justify-center bg-emerald-500 flex-shrink-0">
                      <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                    </div>
                  )}
                  <div
                    className={`w-12 h-12 rounded-xl flex items-center justify-center transition-colors ${
                      paymentMethod === "cash"
                        ? "bg-emerald-500 text-white"
                        : "bg-emerald-500/20 text-emerald-500"
                    }`}
                  >
                    <Banknote className="w-6 h-6" />
                  </div>
                  <div className="text-left">
                    <p className={`font-bold text-lg ${paymentMethod === "cash" ? "text-white" : "text-zinc-300"}`}>
                      Efectivo
                    </p>
                    <p className="text-xs text-zinc-500">Ingresa monto recibido</p>
                  </div>
                </button>
              )}

              {enabledPaymentMethods.card && (
                <button
                  onClick={() => setPaymentMethod("card")}
                  className={`w-full p-4 rounded-2xl border transition-all flex items-center gap-4 group ${
                    paymentMethod === "card"
                      ? "bg-blue-900/30 border-blue-500/70"
                      : "bg-[#18181B] border-blue-500/50 hover:border-blue-500/70 hover:bg-blue-900/20"
                  }`}
                >
                  {paymentMethod === "card" && (
                    <div className="w-6 h-6 rounded flex items-center justify-center bg-blue-500 flex-shrink-0">
                      <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                    </div>
                  )}
                  <div
                    className={`w-12 h-12 rounded-xl flex items-center justify-center transition-colors ${
                      paymentMethod === "card"
                        ? "bg-blue-500 text-white"
                        : "bg-blue-500/20 text-blue-500"
                    }`}
                  >
                    <CreditCard className="w-6 h-6" />
                  </div>
                  <div className="text-left">
                    <p className={`font-bold text-lg ${paymentMethod === "card" ? "text-white" : "text-zinc-300"}`}>
                      Tarjeta
                    </p>
                    <p className="text-xs text-zinc-500">Exacto: ${(Number(finalTotal) || 0).toFixed(2)}</p>
                  </div>
                </button>
              )}

              {enabledPaymentMethods.ath_movil && (
                <button
                  onClick={() => setPaymentMethod("ath_movil")}
                  className={`w-full p-4 rounded-2xl border transition-all flex items-center gap-4 group ${
                    paymentMethod === "ath_movil"
                      ? "bg-orange-900/30 border-orange-500/70"
                      : "bg-[#18181B] border-orange-500/50 hover:border-orange-500/70 hover:bg-orange-900/20"
                  }`}
                >
                  {paymentMethod === "ath_movil" && (
                    <div className="w-6 h-6 rounded flex items-center justify-center bg-orange-500 flex-shrink-0">
                      <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                    </div>
                  )}
                  <div
                    className={`w-12 h-12 rounded-xl flex items-center justify-center transition-colors ${
                      paymentMethod === "ath_movil"
                        ? "bg-orange-500 text-white"
                        : "bg-orange-500/20 text-orange-500"
                    }`}
                  >
                    <Smartphone className="w-6 h-6" />
                  </div>
                  <div className="text-left">
                    <p className={`font-bold text-lg ${paymentMethod === "ath_movil" ? "text-white" : "text-zinc-300"}`}>
                      ATH Móvil
                    </p>
                    <p className="text-xs text-zinc-500">Exacto: ${finalTotal.toFixed(2)}</p>
                  </div>
                </button>
              )}

              {enabledPaymentMethods.cash && enabledPaymentMethods.ath_movil && (
                <button
                  onClick={() => setPaymentMethod("mixed")}
                  className={`w-full p-4 rounded-2xl border transition-all flex items-center gap-4 group ${
                    paymentMethod === "mixed"
                      ? "bg-purple-900/30 border-purple-500/70"
                      : "bg-[#18181B] border-purple-500/50 hover:border-purple-500/70 hover:bg-purple-900/20"
                  }`}
                >
                  {paymentMethod === "mixed" && (
                    <div className="w-6 h-6 rounded flex items-center justify-center bg-purple-500 flex-shrink-0">
                      <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                    </div>
                  )}
                  <div className={`w-12 h-12 rounded-xl flex items-center justify-center transition-colors ${
                    paymentMethod === "mixed" ? "bg-purple-500 text-white" : "bg-purple-500/20 text-purple-400"
                  }`}>
                    <CreditCard className="w-6 h-6" />
                  </div>
                  <div className="text-left">
                    <p className={`font-bold text-lg ${paymentMethod === "mixed" ? "text-white" : "text-zinc-300"}`}>
                      Pago Dividido
                    </p>
                    <p className="text-xs text-zinc-500">Efectivo + ATH Móvil</p>
                  </div>
                </button>
              )}
            </div>

            {/* Inputs Dinámicos */}
            {paymentMode === "deposit" && (
              <div className="space-y-3">
                <p className="text-xs text-gray-400">Ingresa cantidad a depositar</p>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-xl font-bold text-white/60">$</span>
                  <Input
                    type="number"
                    step="0.01"
                    value={depositAmount}
                    onChange={(e) => setDepositAmount(e.target.value)}
                    placeholder="0.00"
                    className="pl-10 h-12 bg-[#18181B] border-blue-500/30"
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
              <div className="space-y-3">
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
                  placeholder="Teléfono"
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
