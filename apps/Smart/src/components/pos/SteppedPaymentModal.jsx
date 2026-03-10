import React, { useState } from "react";
import { X, CreditCard, Package, Banknote, Smartphone, Loader2, AlertCircle } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export default function SteppedPaymentModal({
  isOpen,
  onClose,
  cart,
  subtotal,
  tax,
  effectiveTotal,
  taxEnabled,
  setTaxEnabled,
  paymentMethod,
  setPaymentMethod,
  cashReceived,
  setCashReceived,
  change,
  depositAmount,
  setDepositAmount,
  athMovilPhone,
  setAthMovilPhone,
  athMovilName,
  setAthMovilName,
  paymentMode,
  amountToPay,
  enabledPaymentMethods,
  isPaymentValid,
  processing,
  onProcessPayment,
}) {
  const [step, setStep] = useState(1); // 1: Resumen, 2: Método, 3: Depósito (si aplica), 4: Confirmación

  const totalSteps = paymentMode === "deposit" ? 4 : 3;
  const quickDepositAmounts = [50, 100, 150];

  if (!isOpen) return null;

  const handleNextStep = () => {
    if (step < totalSteps) {
      setStep(step + 1);
    }
  };

  const handlePrevStep = () => {
    if (step > 1) {
      setStep(step - 1);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-black/80 backdrop-blur-sm"
        onClick={onClose}
      />

      <div className="relative w-full max-w-sm bg-[#0F0F12] border border-white/10 rounded-3xl overflow-hidden shadow-2xl animate-in fade-in zoom-in-95 duration-200 max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 pb-2 flex-shrink-0">
          <div className="flex items-center gap-3">
            <CreditCard className="w-6 h-6 text-blue-500" />
            <h3 className="text-2xl font-bold text-white">
              {step === 1 && "Resumen"}
              {step === 2 && "Método de Pago"}
              {step === 3 && paymentMode === "deposit" && "Cantidad"}
              {step === 3 && paymentMode !== "deposit" && "Confirmar"}
              {step === 4 && paymentMode === "deposit" && "Confirmar"}
            </h3>
          </div>
          <button
            onClick={onClose}
            className="text-zinc-500 hover:text-white transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Step Indicator */}
        <div className="px-6 flex gap-2">
          {Array.from({ length: totalSteps }).map((_, idx) => (
            <div
              key={idx}
              className={`h-1 flex-1 rounded-full transition-colors ${
                idx + 1 <= step ? "bg-blue-500" : "bg-white/10"
              }`}
            />
          ))}
        </div>

        {/* Content */}
        <div className="p-6 pt-4 space-y-6 overflow-y-auto flex-1">
          {/* PASO 1: RESUMEN */}
          {step === 1 && (
            <>
              <div className="bg-[#18181B] rounded-2xl p-4 border border-white/5">
                <div className="flex items-center gap-2 mb-3">
                  <Package className="w-4 h-4 text-orange-400" />
                  <span className="text-sm font-semibold text-orange-400">
                    Resumen de Compra
                  </span>
                </div>

                <div className="space-y-2 mb-4 max-h-32 overflow-y-auto pr-2 custom-scrollbar">
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
                  <div className="flex justify-between text-sm text-zinc-500">
                    <span>IVU (11.5%)</span>
                    <span>${tax.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-xl font-bold text-cyan-400 pt-1">
                    <span>Total</span>
                    <span>${effectiveTotal.toFixed(2)}</span>
                  </div>
                </div>
              </div>

              {/* Toggle IVU */}
              <div className="flex items-center justify-between p-3 bg-[#18181B] rounded-xl border border-white/5">
                <div>
                  <p className="text-sm font-semibold text-white">
                    IVU (Impuesto 11.5%)
                  </p>
                  <p className="text-xs text-zinc-500 mt-0.5">
                    Aplicar impuesto a la venta
                  </p>
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
            </>
          )}

          {/* PASO 2: MÉTODO DE PAGO */}
          {step === 2 && (
            <div className="space-y-3">
              <p className="text-sm text-zinc-500 font-medium">
                Selecciona método de pago
              </p>

              {enabledPaymentMethods.cash && (
                <button
                  onClick={() => setPaymentMethod("cash")}
                  className={`w-full p-4 rounded-2xl border transition-all flex items-center gap-4 group ${
                    paymentMethod === "cash"
                      ? "bg-emerald-900/20 border-emerald-500/50"
                      : "bg-[#18181B] border-white/5 hover:border-emerald-500/30 hover:bg-emerald-900/10"
                  }`}
                >
                  <div
                    className={`w-12 h-12 rounded-xl flex items-center justify-center transition-colors ${
                      paymentMethod === "cash"
                        ? "bg-emerald-500 text-white"
                        : "bg-emerald-500/10 text-emerald-500 group-hover:bg-emerald-500 group-hover:text-white"
                    }`}
                  >
                    <Banknote className="w-6 h-6" />
                  </div>
                  <div className="text-left">
                    <p
                      className={`font-bold text-lg ${
                        paymentMethod === "cash"
                          ? "text-white"
                          : "text-zinc-300"
                      }`}
                    >
                      Efectivo
                    </p>
                    <p className="text-xs text-zinc-500">
                      Ingresa monto recibido
                    </p>
                  </div>
                </button>
              )}

              {enabledPaymentMethods.card && (
                <button
                  onClick={() => setPaymentMethod("card")}
                  className={`w-full p-4 rounded-2xl border transition-all flex items-center gap-4 group ${
                    paymentMethod === "card"
                      ? "bg-blue-900/20 border-blue-500/50"
                      : "bg-[#18181B] border-white/5 hover:border-blue-500/30 hover:bg-blue-900/10"
                  }`}
                >
                  <div
                    className={`w-12 h-12 rounded-xl flex items-center justify-center transition-colors ${
                      paymentMethod === "card"
                        ? "bg-blue-500 text-white"
                        : "bg-blue-500/10 text-blue-500 group-hover:bg-blue-500 group-hover:text-white"
                    }`}
                  >
                    <CreditCard className="w-6 h-6" />
                  </div>
                  <div className="text-left">
                    <p
                      className={`font-bold text-lg ${
                        paymentMethod === "card"
                          ? "text-white"
                          : "text-zinc-300"
                      }`}
                    >
                      Tarjeta
                    </p>
                    <p className="text-xs text-zinc-500">
                      Exacto: ${amountToPay.toFixed(2)}
                    </p>
                  </div>
                </button>
              )}

              {enabledPaymentMethods.ath_movil && (
                <button
                  onClick={() => setPaymentMethod("ath_movil")}
                  className={`w-full p-4 rounded-2xl border transition-all flex items-center gap-4 group ${
                    paymentMethod === "ath_movil"
                      ? "bg-orange-900/20 border-orange-500/50"
                      : "bg-[#18181B] border-white/5 hover:border-orange-500/30 hover:bg-orange-900/10"
                  }`}
                >
                  <div
                    className={`w-12 h-12 rounded-xl flex items-center justify-center transition-colors ${
                      paymentMethod === "ath_movil"
                        ? "bg-orange-500 text-white"
                        : "bg-orange-500/10 text-orange-500 group-hover:bg-orange-500 group-hover:text-white"
                    }`}
                  >
                    <Smartphone className="w-6 h-6" />
                  </div>
                  <div className="text-left">
                    <p
                      className={`font-bold text-lg ${
                        paymentMethod === "ath_movil"
                          ? "text-white"
                          : "text-zinc-300"
                      }`}
                    >
                      ATH Móvil
                    </p>
                    <p className="text-xs text-zinc-500">
                      Exacto: ${amountToPay.toFixed(2)}
                    </p>
                  </div>
                </button>
              )}

              {/* Inputs contextuales */}
              {paymentMethod === "cash" && paymentMode !== "deposit" && (
                <div className="animate-in slide-in-from-top-2 duration-200 mt-4">
                  <Input
                    type="number"
                    value={cashReceived}
                    onChange={(e) => setCashReceived(e.target.value)}
                    placeholder="Monto recibido"
                    className="h-14 bg-[#18181B] border-emerald-500/30 text-white text-2xl font-bold text-center rounded-xl focus:ring-emerald-500/50"
                    autoFocus
                  />
                  {change > 0 && (
                    <div className="mt-2 p-3 bg-emerald-500/10 rounded-xl border border-emerald-500/20 flex justify-between items-center">
                      <span className="text-emerald-400 font-medium">
                        Cambio
                      </span>
                      <span className="text-emerald-400 font-bold text-xl">
                        ${change.toFixed(2)}
                      </span>
                    </div>
                  )}
                </div>
              )}

              {paymentMethod === "ath_movil" && (
                <div className="space-y-3 animate-in slide-in-from-top-2 duration-200 mt-4">
                  <Input
                    value={athMovilPhone}
                    onChange={(e) => setAthMovilPhone(e.target.value)}
                    placeholder="Teléfono (787...)"
                    className="h-12 bg-[#18181B] border-orange-500/30 text-white rounded-xl"
                  />
                  <Input
                    value={athMovilName}
                    onChange={(e) => setAthMovilName(e.target.value)}
                    placeholder="Nombre del pagador"
                    className="h-12 bg-[#18181B] border-orange-500/30 text-white rounded-xl"
                  />
                </div>
              )}
            </div>
          )}

          {/* PASO 3: CANTIDAD (solo depósitos) */}
          {step === 3 && paymentMode === "deposit" && (
            <div className="space-y-3">
              <p className="text-sm text-gray-400">
                Ingresa la cantidad a depositar (máximo: $
                {effectiveTotal.toFixed(2)})
              </p>

              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-xl font-bold text-white/60">
                  $
                </span>
                <Input
                  type="number"
                  step="0.01"
                  value={depositAmount}
                  onChange={(e) => setDepositAmount(e.target.value)}
                  placeholder="0.00"
                  className="pl-10 h-14 bg-[#18181B] border-blue-500/30 text-white text-2xl font-bold text-center rounded-xl focus:ring-blue-500/50"
                  autoFocus
                />
              </div>

              <div className="flex gap-2">
                {quickDepositAmounts.map((amt) => (
                  <button
                    key={amt}
                    onClick={() => setDepositAmount(amt.toString())}
                    disabled={amt > effectiveTotal}
                    className={`flex-1 py-2 rounded-lg text-sm font-bold transition-all ${
                      depositAmount === amt.toString()
                        ? "bg-blue-500 text-white"
                        : "bg-white/10 text-white/70 hover:bg-white/20"
                    } disabled:opacity-30 disabled:cursor-not-allowed`}
                  >
                    ${amt}
                  </button>
                ))}
              </div>

              {depositAmount &&
                parseFloat(depositAmount) > effectiveTotal && (
                  <div className="flex items-center gap-2 text-red-400 text-sm p-3 bg-red-500/10 rounded-xl border border-red-500/20">
                    <AlertCircle className="w-4 h-4" />
                    <span>
                      El depósito no puede exceder ${effectiveTotal.toFixed(2)}
                    </span>
                  </div>
                )}
            </div>
          )}

          {/* PASO 4/3: CONFIRMACIÓN */}
          {((step === 3 && paymentMode !== "deposit") ||
            (step === 4 && paymentMode === "deposit")) && (
            <div className="bg-[#18181B] rounded-2xl p-4 border border-white/5 space-y-3">
              <h4 className="text-white font-bold">Resumen Final</h4>

              <div className="space-y-2 text-sm">
                <div className="flex justify-between text-zinc-400">
                  <span>Items:</span>
                  <span className="text-white">{cart.length}</span>
                </div>
                <div className="flex justify-between text-zinc-400">
                  <span>Subtotal:</span>
                  <span className="text-white">${subtotal.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-zinc-400">
                  <span>IVU:</span>
                  <span className="text-white">${tax.toFixed(2)}</span>
                </div>

                <div className="border-t border-white/10 pt-2 flex justify-between font-bold text-lg text-cyan-400">
                  <span>A Pagar:</span>
                  <span>${amountToPay.toFixed(2)}</span>
                </div>

                <div className="pt-2 text-xs text-zinc-500">
                  <p>
                    <strong>Método:</strong> {paymentMethod?.toUpperCase()}
                  </p>
                  {paymentMode === "deposit" && (
                    <p>
                      <strong>Tipo:</strong> Depósito
                    </p>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer - Buttons */}
        <div className="p-6 pt-2 bg-[#0F0F12] border-t border-white/10 flex gap-3 flex-shrink-0">
          {step > 1 && (
            <Button
              onClick={handlePrevStep}
              variant="outline"
              className="h-12 rounded-xl flex-1 border-white/10 bg-white/5 text-white hover:bg-white/10"
            >
              Atrás
            </Button>
          )}

          {step < totalSteps ? (
            <Button
              onClick={handleNextStep}
              disabled={
                (step === 1 && false) ||
                (step === 2 &&
                  (!paymentMethod ||
                    (paymentMethod === "cash" &&
                      paymentMode !== "deposit" &&
                      !cashReceived) ||
                    (paymentMethod === "ath_movil" &&
                      (!athMovilPhone || !athMovilName)))) ||
                (step === 3 &&
                  paymentMode === "deposit" &&
                  (!depositAmount ||
                    parseFloat(depositAmount) <= 0 ||
                    parseFloat(depositAmount) > effectiveTotal))
              }
              className="h-12 rounded-xl flex-1 bg-blue-600 hover:bg-blue-500 text-white font-bold"
            >
              Siguiente
            </Button>
          ) : (
            <Button
              onClick={onProcessPayment}
              disabled={processing || !isPaymentValid}
              className="h-12 rounded-xl flex-1 bg-emerald-600 hover:bg-emerald-500 text-white font-bold"
            >
              {processing ? (
                <Loader2 className="w-5 h-5 animate-spin mr-2" />
              ) : null}
              Confirmar Pago
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
