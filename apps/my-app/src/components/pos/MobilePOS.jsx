
import React, { useState, useMemo } from "react";
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
  AlertCircle,
  User,
  X,
  DollarSign,
  Trash2,
  Gift,
  Tag,
  Percent,
  CreditCard,
  Smartphone,
  Banknote,
  Landmark,
  FileText,
  Zap
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { calculateDiscountedPrice } from "../inventory/DiscountBadge";

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
  subtotal,
  tax,
  total,
  discountAmount,
  appliedDiscount,
  removeDiscount,
  applyQuickDiscount,
  setDiscountType,
  discountType,
  manualDiscountAmount,
  setManualDiscountAmount,
  applyManualDiscount,
  loading,
  searchQuery,
  setSearchQuery,
  filteredProducts,
  filteredServices,
  activeTab,
  setActiveTab,
  workOrderId,
  paymentMode,
  balanceFromUrl,
  pointsToEarn,
  enabledPaymentMethods,
  athMovilPhone,
  setAthMovilPhone,
  athMovilName,
  setAthMovilName,
  paymentMethod,
  setPaymentMethod,
  cashReceived,
  setCashReceived,
  depositAmount,
  setDepositAmount,
  processing,
  handleProcessPayment,
  isPaymentValid,
  amountToPay,
  change
}) {
  const navigate = useNavigate();
  const [showCart, setShowCart] = useState(false);

  const currentItems = activeTab === "products" ? filteredProducts : 
                       activeTab === "offers" ? filteredProducts.filter(p => p.discount_active && p.discount_percentage > 0 && (!p.discount_end_date || new Date(p.discount_end_date) >= new Date())) :
                       filteredServices;

  const getCartQuantity = (itemId, itemType) => {
    const cartItem = cart.find(i => i.id === itemId && i.type === itemType);
    return cartItem?.quantity || 0;
  };

  return (
    <div className="h-screen flex flex-col bg-gradient-to-br from-slate-950 via-gray-900 to-slate-950 theme-light:bg-gray-50 overflow-hidden">
      <div className="flex-shrink-0 bg-gradient-to-r from-cyan-600/10 to-emerald-600/10 backdrop-blur-xl border-b border-white/10 p-4 theme-light:bg-white theme-light:border-gray-200">
        <div className="flex items-center justify-between max-w-screen-sm mx-auto">
          <button
            onClick={() => navigate(-1)}
            className="p-2 -ml-2 hover:bg-white/10 rounded-lg theme-light:hover:bg-gray-100"
          >
            <ArrowLeft className="w-5 h-5 text-white theme-light:text-gray-900" />
          </button>
          <div className="text-center flex-1">
            <h1 className="text-lg font-bold text-white theme-light:text-gray-900">Punto de Venta</h1>
            {workOrderId && (
              <p className="text-xs text-blue-300 theme-light:text-blue-600">
                {paymentMode === "deposit" ? "Depósito" : "Cobrar total"}
              </p>
            )}
          </div>
          <div className="w-9" />
        </div>
      </div>

      {selectedCustomer && (
        <div className="flex-shrink-0 px-4 py-2 bg-gradient-to-r from-red-600/10 to-red-800/10 border-b border-red-500/30 theme-light:from-red-50 theme-light:to-red-100 theme-light:border-red-300">
          <div className="flex items-center justify-between max-w-screen-sm mx-auto">
            <div className="flex items-center gap-2">
              <User className="w-4 h-4 text-red-400 theme-light:text-red-600" />
              <div>
                <p className="text-sm font-semibold text-white theme-light:text-gray-900">{selectedCustomer.name}</p>
                <p className="text-xs text-gray-400 theme-light:text-gray-600">{selectedCustomer.phone}</p>
              </div>
            </div>
            <Button
              size="sm"
              variant="ghost"
              onClick={onOpenCustomerSelector}
              className="text-white hover:bg-white/10 theme-light:text-gray-700 theme-light:hover:bg-gray-100"
            >
              Cambiar
            </Button>
          </div>
        </div>
      )}

      <div className="flex-shrink-0 px-4 py-3 bg-black/40 border-b border-white/10 theme-light:bg-white theme-light:border-gray-200">
        <div className="flex gap-2 max-w-screen-sm mx-auto overflow-x-auto">
          <button
            onClick={() => setActiveTab("products")}
            className={`flex-shrink-0 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              activeTab === "products"
                ? "bg-red-600 text-white shadow-lg"
                : "bg-white/5 text-gray-300 hover:bg-white/10 theme-light:bg-gray-100 theme-light:text-gray-700 theme-light:hover:bg-gray-200"
            }`}
          >
            <Package className="w-4 h-4 inline mr-2" />
            Productos
          </button>
          <button
            onClick={() => setActiveTab("offers")}
            className={`flex-shrink-0 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              activeTab === "offers"
                ? "bg-gradient-to-r from-orange-600 to-red-600 text-white shadow-lg animate-pulse"
                : "bg-white/5 text-gray-300 hover:bg-white/10 theme-light:bg-gray-100 theme-light:text-gray-700 theme-light:hover:bg-gray-200"
            }`}
          >
            <Tag className="w-4 h-4 inline mr-2" />
            Ofertas ({products.filter(p => p.discount_active && p.discount_percentage > 0 && (!p.discount_end_date || new Date(p.discount_end_date) >= new Date())).length})
          </button>
          <button
            onClick={() => setActiveTab("services")}
            className={`flex-shrink-0 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              activeTab === "services"
                ? "bg-red-600 text-white shadow-lg"
                : "bg-white/5 text-gray-300 hover:bg-white/10 theme-light:bg-gray-100 theme-light:text-gray-700 theme-light:hover:bg-gray-200"
            }`}
          >
            <Wrench className="w-4 h-4 inline mr-2" />
            Servicios
          </button>
        </div>
      </div>

      <div className="flex-shrink-0 px-4 py-3 bg-black/40 border-b border-white/10 theme-light:bg-white theme-light:border-gray-200">
        <div className="relative max-w-screen-sm mx-auto">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Buscar..."
            className="pl-10 bg-black/20 border-white/10 text-white theme-light:bg-gray-50 theme-light:border-gray-200 theme-light:text-gray-900"
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-3">
        <div className="max-w-screen-sm mx-auto">
          {loading ? (
            <div className="flex items-center justify-center h-full">
              <div className="text-gray-400 theme-light:text-gray-600">Cargando...</div>
            </div>
          ) : currentItems.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-gray-500 theme-light:text-gray-600">
              {activeTab === "offers" ? <Tag className="w-16 h-16 mb-4 opacity-30" /> : <Package className="w-16 h-16 mb-4 opacity-30" />}
              <p className="text-center">
                {searchQuery ? "Sin resultados" : activeTab === "offers" ? "No hay ofertas activas" : "No hay items disponibles"}
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {currentItems.map((item) => {
                const isProduct = activeTab === "products" || activeTab === "offers";
                const cartQty = getCartQuantity(item.id, isProduct ? "product" : "service");
                
                const isOutOfStock = isProduct && item.stock <= 0;
                const isLowStock = isProduct && item.stock > 0 && item.stock <= (item.min_stock || 5);
                
                // 🎯 CALCULAR DESCUENTO
                const finalPrice = isProduct ? calculateDiscountedPrice(item) : item.price;
                const hasDiscount = isProduct && finalPrice < item.price;

                return (
                  <div key={`${activeTab}-${item.id}`} className="relative">
                    {cartQty > 0 && (
                      <div className="absolute -top-3 -left-3 bg-gradient-to-r from-red-500 via-red-600 to-red-700 text-white w-12 h-12 rounded-full flex items-center justify-center text-lg font-black shadow-[0_8px_24px_rgba(220,38,38,0.8)] border-4 border-slate-950/50 animate-bounce z-20 theme-light:border-white">
                        {cartQty}
                      </div>
                    )}

                    {hasDiscount && (
                      <div className="absolute -top-3 -right-3 bg-gradient-to-r from-orange-500 to-red-600 text-white px-2 py-1 rounded-full text-xs font-black shadow-lg z-20 animate-pulse border-2 border-white">
                        🏷️ -{item.discount_percentage}%
                      </div>
                    )}

                    <div
                      className={`backdrop-blur-xl rounded-xl border p-4 transition-all theme-light:bg-white theme-light:border-gray-200 ${
                        hasDiscount 
                          ? "bg-gradient-to-r from-orange-800/40 to-red-900/40 border-orange-500/50 ring-2 ring-orange-500/40"
                          : "bg-slate-800/50 border-white/10 hover:border-red-600/30 theme-light:hover:border-red-600/50"
                      } ${cartQty > 0 ? "border-red-500/50 shadow-lg theme-light:border-red-300" : ""}`}
                    >
                      <div className="flex items-start justify-between gap-3 mb-3">
                        <div className="flex-1 min-w-0">
                          <h4 className="font-semibold text-white truncate theme-light:text-gray-900">
                            {item.name}
                          </h4>
                          {(item.sku || item.code) && (
                            <p className="text-xs text-gray-400 mt-1 theme-light:text-gray-600">
                              {item.sku || item.code}
                            </p>
                          )}
                          {hasDiscount && item.discount_label && (
                            <Badge className="bg-red-600/40 text-white text-xs mt-1">
                              {item.discount_label}
                            </Badge>
                          )}
                          <div className="flex items-center gap-2 mt-2">
                            <Badge className={
                              isProduct
                                ? "bg-emerald-600/20 text-emerald-300 border-emerald-600/30 text-xs theme-light:bg-emerald-100 theme-light:text-emerald-700 theme-light:border-emerald-300"
                                : "bg-blue-600/20 text-blue-300 border-blue-600/30 text-xs theme-light:bg-blue-100 theme-light:text-blue-700 theme-light:border-blue-300"
                            }>
                              {isProduct ? "Producto" : "Servicio"}
                            </Badge>
                            {isProduct && (
                              isOutOfStock ? (
                                <Badge className="bg-red-600/20 text-red-300 border-red-600/30 text-xs theme-light:bg-red-100 theme-light:text-red-700 theme-light:border-red-300">
                                  Agotado
                                </Badge>
                              ) : isLowStock ? (
                                <Badge className="bg-yellow-600/20 text-yellow-300 border-yellow-600/30 text-xs theme-light:bg-yellow-100 theme-light:text-yellow-700 theme-light:border-yellow-300">
                                  Bajo ({item.stock})
                                </Badge>
                              ) : (
                                <Badge className="bg-emerald-600/20 text-emerald-300 border-emerald-600/30 text-xs theme-light:bg-emerald-100 theme-light:text-emerald-700 theme-light:border-emerald-300">
                                  {item.stock} unid.
                                </Badge>
                              )
                            )}
                          </div>
                        </div>
                        <div className="flex-shrink-0 text-right">
                          <p className={`text-xl font-bold ${hasDiscount ? 'text-orange-400 theme-light:text-orange-600' : 'text-emerald-400 theme-light:text-emerald-600'}`}>
                            ${finalPrice.toFixed(2)}
                          </p>
                          {hasDiscount && (
                            <>
                              <p className="text-xs text-gray-500 line-through">${item.price.toFixed(2)}</p>
                              <p className="text-xs text-orange-300 font-bold theme-light:text-orange-600">
                                Ahorras ${(item.price - finalPrice).toFixed(2)}
                              </p>
                            </>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center justify-center gap-2">
                        {cartQty > 0 ? (
                          <div className="flex items-center gap-2 bg-gradient-to-r from-red-600/20 to-red-800/20 backdrop-blur-sm rounded-xl p-1.5 border-2 border-red-500/40 theme-light:from-red-50 theme-light:to-red-100 theme-light:border-red-300">
                            <button
                              onClick={() => {
                                const index = cart.findIndex(i => i.id === item.id && i.type === (isProduct ? "product" : "service"));
                                if (index >= 0) updateCartQuantity(index, -1);
                              }}
                              className="w-10 h-10 rounded-lg bg-red-600 hover:bg-red-700 text-white flex items-center justify-center font-bold shadow-lg"
                            >
                              <Minus className="w-5 h-5" />
                            </button>
                            <span className="text-2xl font-black text-white w-12 text-center theme-light:text-gray-900">
                              {cartQty}
                            </span>
                            <button
                              onClick={() => addToCart(item, isProduct ? "product" : "service")}
                              disabled={isOutOfStock || (isProduct && item.stock !== null && cartQty >= item.stock)}
                              className="w-10 h-10 rounded-lg bg-red-600 hover:bg-red-700 text-white flex items-center justify-center font-bold shadow-lg disabled:opacity-50"
                            >
                              <Plus className="w-5 h-5" />
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => addToCart(item, isProduct ? "product" : "service")}
                            disabled={isOutOfStock}
                            className={`px-8 h-11 rounded-xl text-white font-bold disabled:opacity-50 flex items-center gap-2 shadow-lg ${
                              hasDiscount 
                                ? 'bg-gradient-to-r from-orange-600 to-red-700 hover:from-orange-700 hover:to-red-800'
                                : 'bg-gradient-to-r from-red-600 to-red-800 hover:from-red-700 hover:to-red-900'
                            }`}
                          >
                            <Plus className="w-5 h-5" />
                            {hasDiscount ? '🏷️ Añadir con oferta' : 'Añadir al carrito'}
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      <div className="flex-shrink-0 bg-black/60 backdrop-blur-xl border-t border-white/10 p-4 space-y-3 theme-light:bg-white theme-light:border-gray-200">
        <div className="max-w-screen-sm mx-auto space-y-3">
          {!appliedDiscount ? (
            <div className="flex flex-wrap gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={() => applyQuickDiscount(10)}
                className="flex-1 border-emerald-600/30 text-emerald-400 hover:bg-emerald-600/20 theme-light:border-emerald-300 theme-light:text-emerald-700 theme-light:hover:bg-emerald-100"
              >
                <Percent className="w-3 h-3 mr-1" />
                10%
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => applyQuickDiscount(20)}
                className="flex-1 border-emerald-600/30 text-emerald-400 hover:bg-emerald-600/20 theme-light:border-emerald-300 theme-light:text-emerald-700 theme-light:hover:bg-emerald-100"
              >
                <Percent className="w-3 h-3 mr-1" />
                20%
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => setDiscountType(discountType === 'manual' ? null : 'manual')}
                className="border-blue-600/30 text-blue-400 hover:bg-blue-600/20 theme-light:border-blue-300 theme-light:text-blue-700 theme-light:hover:bg-blue-100"
              >
                <DollarSign className="w-3 h-3" />
              </Button>
            </div>
          ) : (
            <div className="bg-emerald-600/10 border border-emerald-500/30 rounded-lg p-3 theme-light:bg-emerald-50 theme-light:border-emerald-200">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Gift className="w-4 h-4 text-emerald-400 theme-light:text-emerald-600" />
                  <div>
                    <p className="text-emerald-300 font-semibold text-xs theme-light:text-emerald-700">
                      {appliedDiscount.description}
                    </p>
                    <p className="text-emerald-400 font-bold theme-light:text-emerald-800">-${discountAmount.toFixed(2)}</p>
                  </div>
                </div>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={removeDiscount}
                  className="text-red-400 hover:text-red-300 theme-light:text-red-600 theme-light:hover:text-red-700"
                >
                  <X className="w-4 h-4" />
                </Button>
              </div>
            </div>
          )}

          {discountType === 'manual' && (
            <div className="flex gap-2">
              <Input
                type="number"
                step="0.01"
                value={manualDiscountAmount}
                onChange={(e) => setManualDiscountAmount(e.target.value)}
                placeholder="Monto en $"
                className="flex-1 bg-black/40 border-white/15 text-white theme-light:bg-white theme-light:border-gray-300 theme-light:text-gray-900"
              />
              <Button
                onClick={applyManualDiscount}
                disabled={!manualDiscountAmount || parseFloat(manualDiscountAmount) <= 0}
                className="bg-blue-600 hover:bg-blue-700"
              >
                Aplicar
              </Button>
            </div>
          )}

          <div className="space-y-2 pt-3 border-t border-white/10 theme-light:border-gray-200">
            <div className="flex justify-between text-sm text-gray-400 theme-light:text-gray-700">
              <span>Subtotal</span>
              <span className="text-white font-semibold theme-light:text-gray-900">${subtotal.toFixed(2)}</span>
            </div>
            {discountAmount > 0 && (
              <div className="flex justify-between text-sm">
                <span className="text-emerald-400 theme-light:text-emerald-700">Descuento</span>
                <span className="text-emerald-400 font-semibold theme-light:text-emerald-700">-${discountAmount.toFixed(2)}</span>
              </div>
            )}
            <div className="flex justify-between text-sm text-gray-400 theme-light:text-gray-700">
              <span>IVU (11.5%)</span>
              <span className="text-white font-semibold theme-light:text-gray-900">${tax.toFixed(2)}</span>
            </div>
            <div className="flex justify-between items-center pt-2 border-t border-white/10 theme-light:border-gray-200">
              <span className="text-xl font-bold text-white theme-light:text-gray-900">Total</span>
              <span className="text-3xl font-bold text-red-500 theme-light:text-red-600">
                ${total.toFixed(2)}
              </span>
            </div>
            <div className="text-xs text-gray-500 text-center theme-light:text-gray-600">
              {cart.length} {cart.length === 1 ? 'artículo' : 'artículos'}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Button
              onClick={onOpenCustomerSelector}
              variant="outline"
              className="h-12 border-cyan-600/30 text-cyan-400 hover:bg-cyan-600/20 theme-light:border-cyan-300 theme-light:text-cyan-700 theme-light:hover:bg-cyan-50"
            >
              <User className="w-5 h-5 mr-2" />
              {selectedCustomer ? "Cambiar" : "Cliente"}
            </Button>
            <Button
              onClick={onProceedToPayment}
              disabled={cart.length === 0}
              className="h-12 bg-gradient-to-r from-emerald-600 to-emerald-800 hover:from-emerald-700 hover:to-emerald-900 disabled:opacity-50"
            >
              <DollarSign className="w-5 h-5 mr-2" />
              Pagar
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
