import React, { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { X, CreditCard, Banknote, Smartphone, AlertCircle, Loader2, ShoppingCart, ChevronLeft } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

export default function CheckoutModalMobileRedesigned({
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
  discountAmount,
  orderTotal
}) {
  const [showCartDetails, setShowCartDetails] = useState(false);
  
  if (!open) return null;

  const cartTotal = useMemo(() => 
    cart.reduce((sum, item) => sum + item.quantity, 0), 
    [cart]
  );

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 md:hidden">
      <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={onClose} />

      <motion.div
        initial={{ y: "100%", opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: "100%", opacity: 0 }}
        transition={{ type: "spring", damping: 30, stiffness: 250 }}
        className="relative w-full max-w-sm bg-[#000000] border border-white/10 rounded-3xl overflow-hidden shadow-2xl max-h-[90vh] flex flex-col"
      >
        {/* === HEADER FIJO === */}
        <div className="flex-shrink-0 px-4 pt-4 pb-3 bg-[#0a0a0a] border-b border-white/5 z-20">
          <div className="flex items-center gap-3 mb-4">
            <button
              onClick={onClose}
              className="w-9 h-9 rounded-full bg-white/10 hover:bg-white/15 flex items-center justify-center transition-colors"
            >
              <ChevronLeft className="w-5 h-5 text-white" />
            </button>
            <div className="flex-1">
              <h1 className="text-[28px] font-bold text-white leading-tight">Pago</h1>
              <p className="text-xs text-gray-400">Selecciona el método para completar el cobro</p>
            </div>
            <button 
              onClick={onClose}
              className="w-9 h-9 rounded-full bg-white/10 hover:bg-white/15 flex items-center justify-center transition-colors"
            >
              <X className="w-5 h-5 text-white" />
            </button>
          </div>
        </div>

        {/* === SCROLL CONTENT === */}
        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4 bg-[#000000]" style={{ WebkitOverflowScrolling: 'touch' }}>
          
          {/* RESUMEN FINANCIERO */}
          <div className="bg-gradient-to-br from-cyan-500/10 to-emerald-500/10 border border-cyan-500/20 rounded-2xl p-5">
            <div className="space-y-3">
              <div className="flex justify-between items-start">
                <span className="text-gray-400 text-sm">Subtotal</span>
                <span className="text-white font-bold">${(Number(subtotal) || 0).toFixed(2)}</span>
              </div>
              
              {discountAmount > 0 && (
                <div className="flex justify-between items-start">
                  <span className="text-orange-400 text-sm">Descuento</span>
                  <span className="text-orange-400 font-bold">-${(Number(discountAmount) || 0).toFixed(2)}</span>
                </div>
              )}
              
              <div className="flex justify-between items-start">
                <span className="text-gray-400 text-sm">IVU (11.5%)</span>
                <span className="text-white font-bold">${(Number(tax) || 0).toFixed(2)}</span>
              </div>
              
              <div className="border-t border-cyan-500/20 pt-3 flex justify-between items-center">
                <span className={`font-bold ${workOrderId ? 'text-gray-400 text-sm' : 'text-cyan-400 text-lg'}`}>
                  {workOrderId ? "Total Orden" : "Total"}
                </span>
                <span className={`font-bold ${workOrderId ? 'text-white text-lg' : 'text-cyan-400 text-2xl'}`}>
                  ${(Number(workOrderId ? orderTotal : effectiveTotal) || 0).toFixed(2)}
                </span>
              </div>

              {workOrderId && (
                <div className="space-y-2 pt-2 border-t border-dashed border-cyan-500/10">
                  {totalPaid > 0 && (
                    <div className="flex justify-between items-center text-xs">
                      <span className="text-blue-400">Ya Pagado</span>
                      <span className="text-blue-400 font-bold">-${(Number(totalPaid) || 0).toFixed(2)}</span>
                    </div>
                  )}
                  <div className="flex justify-between items-center">
                    <span className="text-cyan-400 font-bold">A Cobrar</span>
                    <span className="text-cyan-400 font-black text-2xl">${(Number(effectiveTotal) || 0).toFixed(2)}</span>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* TOGGLE IVU */}
          <div className="flex items-center justify-between p-4 bg-[#0a0a0a] rounded-2xl border border-white/5">
            <div>
              <p className="text-sm font-semibold text-white">IVU (Impuesto 11.5%)</p>
              <p className="text-xs text-gray-500">Aplicar impuesto a la venta</p>
            </div>
            <button
              onClick={() => setTaxEnabled(!taxEnabled)}
              className={`relative w-12 h-7 rounded-full transition-colors ${
                taxEnabled ? "bg-cyan-600" : "bg-gray-600"
              }`}
            >
              <span
                className={`absolute top-1 left-1 w-5 h-5 bg-white rounded-full transition-transform ${
                  taxEnabled ? "translate-x-5" : ""
                }`}
              />
            </button>
          </div>

          {/* ITEMS SELECCIONADOS */}
          <div className="p-4 bg-[#0a0a0a] rounded-2xl border border-white/5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ShoppingCart className="w-4 h-4 text-cyan-400" />
                <h3 className="text-white font-bold">Items Seleccionados ({cartTotal})</h3>
              </div>
              <button
                onClick={() => setShowCartDetails(!showCartDetails)}
                className="text-cyan-400 hover:text-cyan-300 text-xs font-medium transition-colors"
              >
                {showCartDetails ? "Cerrar" : "Ver items"}
              </button>
            </div>

            {/* Detalles items (expandible) */}
            <AnimatePresence>
              {showCartDetails && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.2 }}
                  className="mt-3 pt-3 border-t border-white/5 space-y-2"
                >
                  {cart.length === 0 ? (
                    <p className="text-xs text-gray-500 text-center py-2">El carrito está vacío</p>
                  ) : (
                    cart.map((item, idx) => (
                      <div key={idx} className="flex justify-between items-center text-xs">
                        <span className="text-gray-400">{item.name}</span>
                        <div className="flex items-center gap-2">
                          <span className="text-gray-500">x{item.quantity}</span>
                          <span className="text-white font-bold">${(Number(item.price || 0) * Number(item.quantity || 1)).toFixed(2)}</span>
                        </div>
                      </div>
                    ))
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* ESTADO VACÍO (si no hay items) */}
          {cart.length === 0 && (
            <div className="py-8 flex flex-col items-center justify-center text-center">
              <ShoppingCart className="w-16 h-16 mb-4 opacity-20 text-gray-500" />
              <p className="text-white font-semibold mb-1">El carrito está vacío</p>
              <p className="text-xs text-gray-500">Agrega al menos un item para poder cobrar</p>
              <button
                onClick={onClose}
                className="text-cyan-400 hover:text-cyan-300 text-sm font-medium mt-3 transition-colors"
              >
                Ir al catálogo
              </button>
            </div>
          )}

          {/* MÉTODOS DE PAGO */}
          {cart.length > 0 && (
            <>
              <div>
                <p className="text-xs text-gray-500 font-semibold px-1 mb-3">Selecciona método de pago</p>

                <div className="space-y-3">
                  {enabledPaymentMethods.cash && (
                    <button
                      onClick={() => setPaymentMethod("cash")}
                      className={`w-full p-4 rounded-2xl border transition-all flex items-center gap-4 ${
                        paymentMethod === "cash"
                          ? "bg-emerald-900/30 border-emerald-500/50 ring-2 ring-emerald-500/30"
                          : "bg-[#0a0a0a] border-white/5 hover:border-emerald-500/30 active:scale-95"
                      }`}
                    >
                      <div
                        className={`w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 ${
                          paymentMethod === "cash"
                            ? "bg-emerald-500 text-white"
                            : "bg-emerald-500/20 text-emerald-400"
                        }`}
                      >
                        <Banknote className="w-6 h-6" />
                      </div>
                      <div className="text-left flex-1">
                        <p className="font-bold text-white">Efectivo</p>
                        <p className="text-xs text-gray-500">Ingresa el monto recibido</p>
                      </div>
                      {paymentMethod === "cash" && <div className="w-5 h-5 rounded-full bg-emerald-500" />}
                    </button>
                  )}

                  {enabledPaymentMethods.card && (
                    <button
                      onClick={() => setPaymentMethod("card")}
                      className={`w-full p-4 rounded-2xl border transition-all flex items-center gap-4 ${
                        paymentMethod === "card"
                          ? "bg-blue-900/30 border-blue-500/50 ring-2 ring-blue-500/30"
                          : "bg-[#0a0a0a] border-white/5 hover:border-blue-500/30 active:scale-95"
                      }`}
                    >
                      <div
                        className={`w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 ${
                          paymentMethod === "card" ? "bg-blue-500 text-white" : "bg-blue-500/20 text-blue-400"
                        }`}
                      >
                        <CreditCard className="w-6 h-6" />
                      </div>
                      <div className="text-left flex-1">
                        <p className="font-bold text-white">Tarjeta</p>
                        <p className="text-xs text-gray-500">Exacto: ${(Number(effectiveTotal) || 0).toFixed(2)}</p>
                      </div>
                      {paymentMethod === "card" && <div className="w-5 h-5 rounded-full bg-blue-500" />}
                    </button>
                  )}

                  {enabledPaymentMethods.ath_movil && (
                    <button
                      onClick={() => setPaymentMethod("ath_movil")}
                      className={`w-full p-4 rounded-2xl border transition-all flex items-center gap-4 ${
                        paymentMethod === "ath_movil"
                          ? "bg-orange-900/30 border-orange-500/50 ring-2 ring-orange-500/30"
                          : "bg-[#0a0a0a] border-white/5 hover:border-orange-500/30 active:scale-95"
                      }`}
                    >
                      <div
                        className={`w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 ${
                          paymentMethod === "ath_movil"
                            ? "bg-orange-500 text-white"
                            : "bg-orange-500/20 text-orange-400"
                        }`}
                      >
                        <Smartphone className="w-6 h-6" />
                      </div>
                      <div className="text-left flex-1">
                        <p className="font-bold text-white">ATH Móvil</p>
                        <p className="text-xs text-gray-500">Exacto: ${(Number(effectiveTotal) || 0).toFixed(2)}</p>
                      </div>
                      {paymentMethod === "ath_movil" && <div className="w-5 h-5 rounded-full bg-orange-500" />}
                    </button>
                  )}
                </div>
              </div>

              {/* INPUTS DINÁMICOS */}
              <AnimatePresence mode="wait">
                {paymentMethod === "cash" && paymentMode !== "deposit" && (
                  <motion.div
                    key="cash-inputs"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    className="space-y-3"
                  >
                    <div className="bg-[#0a0a0a] rounded-2xl border border-white/5 p-4">
                      <label className="text-sm font-semibold text-white mb-2 block">Monto recibido</label>
                      <div className="relative">
                        <span className="absolute left-4 top-1/2 -translate-y-1/2 text-xl font-bold text-white/60">$</span>
                        <Input
                          type="number"
                          step="0.01"
                          value={cashReceived}
                          onChange={(e) => setCashReceived(e.target.value)}
                          placeholder="0.00"
                          className="pl-10 h-14 bg-black/40 border-emerald-500/30 text-2xl font-bold text-center"
                          autoFocus
                        />
                      </div>
                      <p className="text-xs text-gray-500 mt-2">El sistema calculará el cambio automáticamente</p>
                    </div>

                    {change > 0 && (
                      <div className="p-3 bg-emerald-500/10 rounded-xl border border-emerald-500/20 flex justify-between items-center">
                        <span className="text-emerald-400 font-medium">Cambio</span>
                        <span className="text-emerald-400 font-bold text-xl">${(Number(change) || 0).toFixed(2)}</span>
                      </div>
                    )}
                  </motion.div>
                )}

                {paymentMethod === "ath_movil" && (
                  <motion.div
                    key="ath-inputs"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    className="space-y-3 bg-[#0a0a0a] rounded-2xl border border-white/5 p-4"
                  >
                    <div>
                      <label className="text-sm font-semibold text-white mb-2 block">Teléfono (ATH Móvil)</label>
                      <Input
                        value={athMovilPhone}
                        onChange={(e) => setAthMovilPhone(e.target.value)}
                        placeholder="Ej. 787-000-0000"
                        className="h-12 bg-black/40 border-orange-500/30"
                        autoFocus
                      />
                    </div>
                    <div>
                      <label className="text-sm font-semibold text-white mb-2 block">Nombre</label>
                      <Input
                        value={athMovilName}
                        onChange={(e) => setAthMovilName(e.target.value)}
                        placeholder="Ej. Juan Pérez"
                        className="h-12 bg-black/40 border-orange-500/30"
                      />
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </>
          )}
        </div>

        {/* === FOOTER STICKY === */}
        {paymentMethod && cart.length > 0 && (
          <div className="flex-shrink-0 px-4 py-4 border-t border-white/5 bg-[#0a0a0a] space-y-2">
            <Button
              onClick={onConfirmPayment}
              disabled={processing || !isPaymentValid}
              className={`w-full h-14 text-lg font-bold rounded-xl shadow-lg transition-all ${
                paymentMethod === "cash"
                  ? "bg-emerald-600 hover:bg-emerald-500 disabled:bg-emerald-600/50"
                  : paymentMethod === "card"
                  ? "bg-blue-600 hover:bg-blue-500 disabled:bg-blue-600/50"
                  : "bg-orange-600 hover:bg-orange-500 disabled:bg-orange-600/50"
              }`}
            >
              {processing ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin mr-2" />
                  Procesando...
                </>
              ) : (
                `Cobrar $${(Number(effectiveTotal) || 0).toFixed(2)}`
              )}
            </Button>
            <Button
              onClick={onClose}
              variant="outline"
              className="w-full h-11 rounded-xl border-white/10 bg-white/5 text-white hover:bg-white/10"
            >
              Cancelar
            </Button>
          </div>
        )}
      </motion.div>
    </div>
  );
}
