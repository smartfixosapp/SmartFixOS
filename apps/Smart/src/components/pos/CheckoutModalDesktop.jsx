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
  quickCashAmounts,
  orderTotal
}) {
  if (!open) return null;

  const finalTotal = effectiveTotal || total || 0;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center sm:p-4 p-0">
      <div className="absolute inset-0 bg-[#000000]/95" onClick={onClose} />

      <div className="relative w-full h-[100dvh] sm:h-auto sm:max-h-[90vh] sm:max-w-4xl bg-[#0F0F12] border-x sm:border border-white/10 sm:rounded-[32px] overflow-hidden shadow-2xl animate-in fade-in zoom-in-95 duration-300 flex flex-col">
        {/* Header */}
        <div className="sticky top-0 left-0 right-0 flex items-center justify-between p-4 sm:p-6 pb-3 sm:pb-4 z-20 bg-[#0F0F12]/95 backdrop-blur-xl border-b border-white/5 flex-shrink-0" style={{ paddingTop: "calc(env(safe-area-inset-top, 12px) + 12px)" }}>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-blue-500/20 flex items-center justify-center text-blue-500">
              <CreditCard className="w-5 h-5" />
            </div>
            <h3 className="text-xl sm:text-2xl font-black text-white uppercase tracking-tight">Finalizar Cobro</h3>
          </div>
          <button onClick={onClose} className="w-10 h-10 rounded-full bg-white/5 hover:bg-white/10 text-zinc-500 hover:text-white transition-all flex items-center justify-center">
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Content: single scroll on mobile, two columns on desktop */}
        <div className="flex-1 overflow-y-auto sm:overflow-hidden sm:flex sm:flex-row" style={{ WebkitOverflowScrolling: "touch" }}>
          {/* LEFT COLUMN - RESUMEN */}
          <div className="w-full sm:w-[40%] sm:border-r border-white/10 p-4 sm:p-6 space-y-4 sm:space-y-6 sm:overflow-y-auto bg-black/20">
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
                <div className={`flex justify-between font-bold pt-2 border-t border-white/5 ${workOrderId ? 'text-lg text-zinc-300' : 'text-xl text-cyan-400'}`}>
                  <span>{workOrderId ? "Total de la Orden" : "Total"}</span>
                  <span>${(Number(workOrderId ? orderTotal : finalTotal) || 0).toFixed(2)}</span>
                </div>

                {workOrderId && (
                  <>
                    {totalPaid > 0 && (
                      <div className="flex justify-between text-sm text-blue-400 pt-1">
                        <span>Ya Pagado</span>
                        <span className="font-bold">-${(Number(totalPaid) || 0).toFixed(2)}</span>
                      </div>
                    )}
                    <div className="flex justify-between text-xl font-bold text-yellow-500 pt-2 mt-2 border-t border-dashed border-white/10">
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
            <button
              onClick={() => setTaxEnabled(!taxEnabled)}
              className="w-full flex items-center justify-between px-3 py-2.5 bg-white/[0.03] rounded-xl border border-white/[0.06] active:scale-[0.98] transition-all"
            >
              <span className={`text-xs font-semibold ${taxEnabled ? "text-emerald-400" : "text-zinc-500"}`}>
                IVU 11.5%
              </span>
              <div className={`relative w-9 h-5 rounded-full transition-colors duration-200 ${taxEnabled ? "bg-emerald-500" : "bg-zinc-700"}`}>
                <span className={`absolute top-[2px] left-[2px] w-4 h-4 bg-white rounded-full transition-transform duration-200 ${taxEnabled ? "translate-x-4" : ""}`} />
              </div>
            </button>
          </div>

          {/* RIGHT COLUMN - PAGO */}
          <div className="flex-1 p-4 sm:p-6 space-y-5 sm:space-y-7 sm:overflow-y-auto flex flex-col bg-transparent">
            {/* Métodos de Pago — icon row on mobile, full cards on desktop */}
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-500 mb-2 sm:hidden">Metodo de pago</p>
              {/* MOBILE: horizontal icon row */}
              <div className="flex gap-2 sm:hidden">
                {[
                  { id: "cash", icon: Banknote, label: "Efectivo", color: "emerald", enabled: enabledPaymentMethods.cash },
                  { id: "card", icon: CreditCard, label: "Tarjeta", color: "blue", enabled: enabledPaymentMethods.card },
                  { id: "ath_movil", icon: Smartphone, label: "ATH", color: "orange", enabled: enabledPaymentMethods.ath_movil },
                  { id: "mixed", icon: CreditCard, label: "Dividido", color: "purple", enabled: enabledPaymentMethods.cash && enabledPaymentMethods.ath_movil },
                ].filter(m => m.enabled).map(m => {
                  const selected = paymentMethod === m.id;
                  return (
                    <button
                      key={m.id}
                      onClick={() => setPaymentMethod(m.id)}
                      className={`flex-1 flex flex-col items-center gap-1.5 py-3 rounded-2xl border transition-all active:scale-95 ${
                        selected
                          ? `bg-${m.color}-500/15 border-${m.color}-500/50`
                          : "bg-white/[0.03] border-white/10"
                      }`}
                      style={selected ? { backgroundColor: `var(--color-${m.color})`, borderColor: `var(--color-${m.color})` } : undefined}
                    >
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all ${
                        selected ? `bg-${m.color}-500 text-white` : `bg-white/[0.06] text-zinc-400`
                      }`}
                        style={selected ? { backgroundColor: { emerald: "#10b981", blue: "#3b82f6", orange: "#f97316", purple: "#a855f7" }[m.color] } : undefined}
                      >
                        <m.icon className="w-5 h-5" />
                      </div>
                      <span className={`text-[10px] font-bold ${selected ? "text-white" : "text-zinc-500"}`}>{m.label}</span>
                    </button>
                  );
                })}
              </div>

              {/* DESKTOP: full card buttons */}
              <div className="hidden sm:block space-y-3">
                {enabledPaymentMethods.cash && (
                  <button onClick={() => setPaymentMethod("cash")}
                    className={`w-full p-5 rounded-[24px] border transition-all duration-300 flex items-center gap-5 ${paymentMethod === "cash" ? "bg-emerald-500/10 border-emerald-500/50 ring-1 ring-emerald-500/20" : "bg-white/[0.03] border-white/10 hover:border-emerald-500/30"}`}>
                    <div className={`w-14 h-14 rounded-[18px] flex items-center justify-center ${paymentMethod === "cash" ? "bg-emerald-500 text-white" : "bg-emerald-500/10 text-emerald-500"}`}>
                      <Banknote className="w-7 h-7" />
                    </div>
                    <div className="text-left flex-1">
                      <p className={`font-black text-lg uppercase tracking-tight ${paymentMethod === "cash" ? "text-white" : "text-zinc-300"}`}>Efectivo</p>
                      <p className="text-xs text-zinc-500 uppercase tracking-widest font-bold">Monto Recibido</p>
                    </div>
                  </button>
                )}
                {enabledPaymentMethods.card && (
                  <button onClick={() => setPaymentMethod("card")}
                    className={`w-full p-5 rounded-[24px] border transition-all duration-300 flex items-center gap-5 ${paymentMethod === "card" ? "bg-blue-500/10 border-blue-500/50 ring-1 ring-blue-500/20" : "bg-white/[0.03] border-white/10 hover:border-blue-500/30"}`}>
                    <div className={`w-14 h-14 rounded-[18px] flex items-center justify-center ${paymentMethod === "card" ? "bg-blue-500 text-white" : "bg-blue-500/10 text-blue-500"}`}>
                      <CreditCard className="w-7 h-7" />
                    </div>
                    <div className="text-left flex-1">
                      <p className={`font-black text-lg uppercase tracking-tight ${paymentMethod === "card" ? "text-white" : "text-zinc-300"}`}>Tarjeta</p>
                      <p className="text-xs text-zinc-500 uppercase tracking-widest font-bold">Exacto: ${(Number(finalTotal) || 0).toFixed(2)}</p>
                    </div>
                  </button>
                )}
                {enabledPaymentMethods.ath_movil && (
                  <button onClick={() => setPaymentMethod("ath_movil")}
                    className={`w-full p-5 rounded-[24px] border transition-all duration-300 flex items-center gap-5 ${paymentMethod === "ath_movil" ? "bg-orange-500/10 border-orange-500/50 ring-1 ring-orange-500/20" : "bg-white/[0.03] border-white/10 hover:border-orange-500/30"}`}>
                    <div className={`w-14 h-14 rounded-[18px] flex items-center justify-center ${paymentMethod === "ath_movil" ? "bg-orange-500 text-white" : "bg-orange-500/10 text-orange-500"}`}>
                      <Smartphone className="w-7 h-7" />
                    </div>
                    <div className="text-left flex-1">
                      <p className={`font-black text-lg uppercase tracking-tight ${paymentMethod === "ath_movil" ? "text-white" : "text-zinc-300"}`}>ATH Movil</p>
                      <p className="text-xs text-zinc-500 uppercase tracking-widest font-bold">Pago Exacto</p>
                    </div>
                  </button>
                )}
                {enabledPaymentMethods.cash && enabledPaymentMethods.ath_movil && (
                  <button onClick={() => setPaymentMethod("mixed")}
                    className={`w-full p-5 rounded-[24px] border transition-all duration-300 flex items-center gap-5 ${paymentMethod === "mixed" ? "bg-purple-500/10 border-purple-500/50 ring-1 ring-purple-500/20" : "bg-white/[0.03] border-white/10 hover:border-purple-500/30"}`}>
                    <div className={`w-14 h-14 rounded-[18px] flex items-center justify-center ${paymentMethod === "mixed" ? "bg-purple-500 text-white" : "bg-purple-500/10 text-purple-400"}`}>
                      <CreditCard className="w-7 h-7" />
                    </div>
                    <div className="text-left flex-1">
                      <p className={`font-black text-lg uppercase tracking-tight ${paymentMethod === "mixed" ? "text-white" : "text-zinc-300"}`}>Dividido</p>
                      <p className="text-xs text-zinc-500 uppercase tracking-widest font-bold">Efectivo + ATH</p>
                    </div>
                  </button>
                )}
              </div>
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
                    className="h-16 bg-white/[0.03] border-emerald-500/30 text-3xl font-black text-center rounded-[20px] focus:border-emerald-500/60 focus:ring-emerald-500/10 transition-all shadow-inner"
                    autoFocus
                  />
                  {change > 0 && (
                    <div className="p-5 bg-emerald-500/10 rounded-[20px] border border-emerald-500/20 flex justify-between items-center shadow-lg shadow-emerald-500/5 animate-in slide-in-from-top-2 duration-300">
                      <span className="text-emerald-400 font-black uppercase tracking-widest text-[10px]">Cambio Sugerido</span>
                      <span className="text-emerald-400 font-black text-2xl tracking-tighter">${change.toFixed(2)}</span>
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
                  className="h-11 bg-[#18181B] border-orange-500/30"
                />
                <Input
                  value={athMovilName}
                  onChange={(e) => setAthMovilName(e.target.value)}
                  placeholder="Nombre del pagador (Opcional)"
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
                  placeholder="Teléfono ATH (Opcional)"
                  className="h-11 bg-[#18181B] border-orange-500/30"
                />
                <Input
                  value={athMovilName}
                  onChange={(e) => setAthMovilName(e.target.value)}
                  placeholder="Nombre de quien envió ATH (Opcional)"
                  className="h-11 bg-[#18181B] border-orange-500/30"
                />
              </div>
            )}

            {/* Botón Confirmar */}
            {paymentMethod && (
              <Button
                onClick={onConfirmPayment}
                disabled={processing || !isPaymentValid}
                className={`w-full h-16 sm:h-20 text-lg sm:text-xl font-black rounded-[24px] shadow-2xl transition-all duration-500 uppercase tracking-widest mt-auto border-t border-white/10 ${
                  paymentMethod === "cash"
                    ? "bg-emerald-600 hover:bg-emerald-500 shadow-emerald-500/20"
                    : paymentMethod === "card"
                    ? "bg-blue-600 hover:bg-blue-500 shadow-blue-500/20"
                    : paymentMethod === "mixed"
                    ? "bg-purple-600 hover:bg-purple-500 shadow-purple-500/20"
                    : "bg-orange-600 hover:bg-orange-500 shadow-orange-500/20"
                } active:scale-[0.98]`}
              >
                {processing ? <Loader2 className="w-6 h-6 animate-spin mr-3 inline" /> : null}
                Finalizar Transaccion
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
