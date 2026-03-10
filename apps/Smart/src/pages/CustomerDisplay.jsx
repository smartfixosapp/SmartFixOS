import React, { useEffect, useState } from "react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { Smartphone, ShoppingCart, DollarSign, User } from "lucide-react";

export default function CustomerDisplay() {
  const [data, setData] = useState({
    cart: [],
    customer: null,
    total: 0,
    status: "idle", // idle, active_order, payment_success
    orderInfo: null
  });

  useEffect(() => {
    // Listen to localStorage changes for simple cross-tab communication
    const handleStorageChange = (e) => {
      if (e.key === "customer_display_data") {
        try {
          const newData = JSON.parse(e.newValue);
          setData(newData || { status: "idle", cart: [], total: 0 });
        } catch (err) {
          console.error("Error parsing display data", err);
        }
      }
    };

    window.addEventListener("storage", handleStorageChange);
    
    // Initial load
    const stored = localStorage.getItem("customer_display_data");
    if (stored) {
      try {
        setData(JSON.parse(stored));
      } catch {}
    }

    return () => window.removeEventListener("storage", handleStorageChange);
  }, []);

  const { cart, customer, total, status, orderInfo } = data;

  return (
    <div className="min-h-screen bg-black text-white p-8 flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-gray-800 pb-6 mb-8">
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 bg-red-600 rounded-full flex items-center justify-center">
            <Smartphone className="w-8 h-8 text-white" />
          </div>
          <div>
            <h1 className="text-3xl font-bold">911 SmartFix</h1>
            <p className="text-gray-400">Tu experto en reparaciones</p>
          </div>
        </div>
        <div className="text-right">
          <p className="text-gray-500 text-lg">{format(new Date(), "EEEE d, MMMM yyyy", { locale: es })}</p>
          <p className="text-2xl font-mono">{format(new Date(), "HH:mm")}</p>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 flex gap-8">
        {/* Left: Cart / Order Info */}
        <div className="flex-1 space-y-6">
          {customer ? (
            <div className="bg-gray-900 rounded-xl p-6 border border-gray-800 flex items-center gap-4">
              <div className="bg-blue-900/30 p-3 rounded-full">
                <User className="w-8 h-8 text-blue-400" />
              </div>
              <div>
                <p className="text-gray-400 text-sm">Cliente</p>
                <h2 className="text-2xl font-bold">{customer.name}</h2>
              </div>
            </div>
          ) : (
            <div className="bg-gray-900 rounded-xl p-6 border border-gray-800 text-center text-gray-500">
              <p>Bienvenido</p>
            </div>
          )}

          <div className="bg-gray-900 rounded-xl border border-gray-800 overflow-hidden flex-1 min-h-[400px]">
            <div className="p-4 bg-gray-800 border-b border-gray-700 font-medium text-gray-300 flex justify-between">
              <span>Descripción</span>
              <span>Precio</span>
            </div>
            <div className="p-4 space-y-4">
              {cart && cart.length > 0 ? (
                cart.map((item, idx) => (
                  <div key={idx} className="flex justify-between items-center text-lg">
                    <div className="flex items-center gap-3">
                      <div className="bg-gray-800 w-8 h-8 rounded flex items-center justify-center text-sm font-bold text-gray-400">
                        {item.qty || 1}x
                      </div>
                      <span>{item.name}</span>
                    </div>
                    <span className="font-mono">${(item.price * (item.qty || 1)).toFixed(2)}</span>
                  </div>
                ))
              ) : (
                <div className="text-center py-20 text-gray-600">
                  <ShoppingCart className="w-16 h-16 mx-auto mb-4 opacity-20" />
                  <p className="text-xl">Esperando items...</p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Right: Totals / Ads */}
        <div className="w-1/3 flex flex-col gap-6">
          {/* Ad Space or Promo */}
          <div className="flex-1 bg-gradient-to-br from-red-900/20 to-black rounded-xl border border-red-900/30 p-6 flex flex-col justify-center text-center">
            <h3 className="text-2xl font-bold text-red-500 mb-2">¡Oferta del Mes!</h3>
            <p className="text-gray-300 text-lg">20% de descuento en protectores de pantalla con tu reparación.</p>
          </div>

          {/* Totals */}
          <div className="bg-gray-900 rounded-xl p-8 border border-gray-800 space-y-4">
            <div className="flex justify-between text-gray-400 text-xl">
              <span>Subtotal</span>
              <span>${(total || 0).toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-gray-400 text-xl">
              <span>IVU</span>
              <span>${((total || 0) * 0.115).toFixed(2)}</span>
            </div>
            <div className="border-t border-gray-700 pt-6 mt-2">
              <div className="flex justify-between text-green-400 font-bold text-5xl">
                <span>Total</span>
                <span>${((total || 0) * 1.115).toFixed(2)}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
