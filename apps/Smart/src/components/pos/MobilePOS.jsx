import React, { useState, useMemo, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Search,
  Plus,
  Minus,
  ArrowLeft,
  ShoppingCart,
  Package,
  Wrench,
  Tag,
  CreditCard,
  Trash2,
  X,
  ChevronUp,
  Zap,
  Grid,
  Headphones,
  Component
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { calculateDiscountedPrice } from "../inventory/DiscountBadge";
import { motion, AnimatePresence } from "framer-motion";
import MobilePartsCatalog from "../catalog/MobilePartsCatalog";

export default function MobilePOS({
  products,
  services,
  cart,
  addToCart,
  updateCartQuantity,
  removeItem,
  clearCart,
  selectedCustomer,
  onOpenCustomerSelector,
  onProceedToPayment,
  onOpenRechargeDialog,
  subtotal,
  tax,
  total,
  discountAmount,
  appliedDiscount,
  loading,
  searchQuery,
  setSearchQuery,
  filteredProducts,
  filteredServices,
  activeTab,
  setActiveTab,
  workOrderId,
  paymentMode,
  currentDrawer,
  onCloseRegister
}) {
  const navigate = useNavigate();
  const [showCartSheet, setShowCartSheet] = useState(false);
  const [showClearCartDialog, setShowClearCartDialog] = useState(false);

  const handleClearCart = useCallback(() => {
    clearCart();
    setShowClearCartDialog(false);
  }, [clearCart]);

  // NOTE: currentItems removed - now using MobilePartsCatalog component

  const getCartQuantity = useCallback((itemId, itemType) => {
    const cartItem = cart.find(i => i.id === itemId && i.type === itemType);
    return cartItem?.quantity || 0;
  }, [cart]);

  const totalItems = useMemo(() => 
    cart.reduce((a, b) => a + b.quantity, 0), 
    [cart]
  );

  return (
    <div className="h-full flex flex-col bg-[#000000] overflow-hidden relative">
      
      {/* Content Area - Reusable Mobile Catalog */}
      <div className="flex-1 overflow-hidden bg-[#000000]">
        <MobilePartsCatalog
          products={products}
          services={services}
          loading={loading}
          onAddItem={(item) => {
            const isProduct = item._type === 'product';
            addToCart(item, isProduct ? "product" : "service");
          }}
        />
      </div>

      {/* Floating Cart Bar - Simplified */}
      <AnimatePresence>
        {cart.length > 0 && (
          <motion.div
            initial={{ y: 100 }}
            animate={{ y: 0 }}
            exit={{ y: 100 }}
            transition={{ type: "spring", damping: 30, stiffness: 200, mass: 0.8 }}
            className="absolute bottom-6 left-4 right-4 z-30"
          >
            <div 
              className="bg-[#0a0a0a] backdrop-blur-xl rounded-2xl p-4 shadow-[0_8px_32px_rgba(0,0,0,0.5)] border border-white/10"
              onClick={() => setShowCartSheet(true)}
            >
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <ShoppingCart className="w-5 h-5 text-cyan-400" />
                  <span className="text-white font-semibold text-sm">
                    {totalItems} Items
                  </span>
                </div>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowClearCartDialog(true);
                  }}
                  className="text-red-400 text-xs font-semibold"
                >
                  Vaciar
                </button>
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <p className="text-gray-400 text-xs mb-1">Total</p>
                  <p className="text-white text-2xl font-bold">${total.toFixed(2)}</p>
                </div>
                <button 
                  onClick={(e) => {
                    e.stopPropagation();
                    onProceedToPayment();
                  }}
                  className="bg-cyan-500 text-white px-8 py-3 rounded-xl font-bold text-sm active:scale-95 transition-transform shadow-lg shadow-cyan-500/30"
                >
                  Cobrar
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Cart Sheet Modal */}
      <AnimatePresence>
        {showCartSheet && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="absolute inset-0 bg-black/60 z-40 backdrop-blur-sm"
              onClick={() => setShowCartSheet(false)}
            />
            <motion.div
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 30, stiffness: 250, mass: 0.8 }}
              className="absolute bottom-0 left-0 right-0 bg-[#0a0a0a] rounded-t-[32px] z-50 max-h-[88vh] flex flex-col shadow-[0_-8px_32px_rgba(0,0,0,0.8)] border-t border-white/10"
            >
              <div className="w-10 h-1 bg-white/20 rounded-full mx-auto mt-4 mb-3" />
              
              <div className="px-6 py-4 flex items-center justify-between border-b border-white/5 flex-shrink-0">
                <h2 className="text-[28px] font-black text-white tracking-tight">Carrito</h2>
                <button 
                  onClick={() => setShowClearCartDialog(true)} 
                  className="text-red-400 text-[15px] font-bold bg-red-500/10 px-4 py-2 rounded-full active:scale-95 transition-transform"
                >
                  Vaciar
                </button>
              </div>

              <div className="flex-1 overflow-y-auto px-6 py-5 space-y-3" style={{ WebkitOverflowScrolling: 'touch' }}>
                {cart.map((item, index) => (
                  <div key={item.id || index} className="bg-[#1a1a1a] rounded-[20px] p-4 border border-white/10">
                    <div className="flex items-start gap-3 mb-3">
                      <div className="bg-cyan-500/10 w-12 h-12 rounded-xl flex items-center justify-center shadow-sm border border-cyan-500/20 flex-shrink-0">
                        <span className="font-black text-cyan-400 text-base">x{item.quantity}</span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-white text-[15px] leading-snug line-clamp-2 mb-1">{item.name}</p>
                        <p className="text-sm text-cyan-400 font-bold">${item.price.toFixed(2)}</p>
                      </div>
                    </div>
                    
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 bg-white/5 rounded-xl p-1">
                        <button 
                          onClick={() => updateCartQuantity(index, -1)}
                          className="w-9 h-9 rounded-lg bg-white/10 border border-white/10 flex items-center justify-center text-white active:scale-95 transition-transform"
                        >
                          <Minus className="w-4 h-4" strokeWidth={2.5} />
                        </button>
                        <button 
                          onClick={() => updateCartQuantity(index, 1)}
                          className="w-9 h-9 rounded-lg bg-cyan-500 text-white flex items-center justify-center shadow-lg shadow-cyan-500/30 active:scale-95 transition-transform"
                        >
                          <Plus className="w-4 h-4" strokeWidth={2.5} />
                        </button>
                      </div>
                      <span className="text-white font-bold text-lg">${(item.price * item.quantity).toFixed(2)}</span>
                    </div>
                  </div>
                ))}
              </div>


            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Clear Cart Confirmation Dialog */}
      <AnimatePresence>
        {showClearCartDialog && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
              className="fixed inset-0 bg-black/70 z-[60] backdrop-blur-sm flex items-center justify-center"
              onClick={() => setShowClearCartDialog(false)}
            />
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
              className="fixed inset-0 z-[70] flex items-center justify-center pointer-events-none"
            >
              <div className="bg-[#0a0a0a] border border-white/10 rounded-3xl overflow-hidden shadow-2xl w-[90%] max-w-sm pointer-events-auto">
                <div className="p-6 border-b border-white/5">
                  <div className="flex items-center gap-3 mb-2">
                    <div className="w-12 h-12 bg-red-500/10 rounded-xl flex items-center justify-center border border-red-500/20">
                      <Trash2 className="w-6 h-6 text-red-400" />
                    </div>
                    <h3 className="text-xl font-bold text-white">¿Vaciar el carrito?</h3>
                  </div>
                  <p className="text-gray-400 text-sm ml-[60px]">
                    Se eliminarán todos los productos del carrito.
                  </p>
                </div>
                
                <div className="p-6 flex gap-3">
                  <button
                    onClick={() => setShowClearCartDialog(false)}
                    className="flex-1 py-3.5 bg-white/8 border border-white/10 rounded-xl text-white font-semibold active:scale-95 transition-transform"
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={handleClearCart}
                    className="flex-1 py-3.5 bg-gradient-to-r from-red-500 to-red-600 text-white font-semibold rounded-xl active:scale-95 transition-transform shadow-lg shadow-red-500/30"
                  >
                    Vaciar
                  </button>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>


    </div>
  );
}
