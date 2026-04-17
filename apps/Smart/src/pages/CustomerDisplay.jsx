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
    <div className="min-h-screen apple-surface apple-type p-8 flex flex-col">
      {/* Header */}
      <div
        className="flex items-center justify-between pb-6 mb-8"
        style={{ borderBottom: "0.5px solid rgb(var(--separator) / 0.29)" }}
      >
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 rounded-apple-sm bg-apple-red/15 flex items-center justify-center">
            <Smartphone className="w-8 h-8 text-apple-red" />
          </div>
          <div>
            <h1 className="apple-text-title1 apple-label-primary">911 SmartFix</h1>
            <p className="apple-text-callout apple-label-secondary">Tu experto en reparaciones</p>
          </div>
        </div>
        <div className="text-right">
          <p className="apple-text-title3 apple-label-secondary">{format(new Date(), "EEEE d, MMMM yyyy", { locale: es })}</p>
          <p className="apple-text-title1 apple-label-primary tabular-nums">{format(new Date(), "HH:mm")}</p>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 flex gap-8">
        {/* Left: Cart / Order Info */}
        <div className="flex-1 space-y-6 flex flex-col">
          {customer ? (
            <div className="apple-card p-6 flex items-center gap-4">
              <div className="w-14 h-14 rounded-apple-sm bg-apple-blue/12 flex items-center justify-center">
                <User className="w-8 h-8 text-apple-blue" />
              </div>
              <div>
                <p className="apple-text-callout apple-label-secondary">Cliente</p>
                <h2 className="apple-text-title2 apple-label-primary">{customer.name}</h2>
              </div>
            </div>
          ) : (
            <div className="apple-card p-6 text-center apple-label-tertiary">
              <p className="apple-text-title3">Bienvenido</p>
            </div>
          )}

          <div className="apple-card overflow-hidden flex-1 min-h-[400px] flex flex-col">
            <div
              className="p-4 apple-surface-secondary flex justify-between apple-text-callout apple-label-secondary font-semibold"
              style={{ borderBottom: "0.5px solid rgb(var(--separator) / 0.29)" }}
            >
              <span>Descripción</span>
              <span>Precio</span>
            </div>
            <div className="p-4 space-y-4 flex-1">
              {cart && cart.length > 0 ? (
                cart.map((item, idx) => (
                  <div key={idx} className="flex justify-between items-center apple-text-title3">
                    <div className="flex items-center gap-3">
                      <div className="bg-gray-sys6 dark:bg-gray-sys5 w-10 h-10 rounded-apple-sm flex items-center justify-center apple-text-callout font-semibold apple-label-secondary tabular-nums">
                        {item.qty || 1}×
                      </div>
                      <span className="apple-label-primary">{item.name}</span>
                    </div>
                    <span className="apple-label-primary tabular-nums font-medium">${(item.price * (item.qty || 1)).toFixed(2)}</span>
                  </div>
                ))
              ) : (
                <div className="text-center py-20 apple-label-tertiary">
                  <ShoppingCart className="w-16 h-16 mx-auto mb-4 opacity-40" />
                  <p className="apple-text-title3">Esperando items...</p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Right: Totals / Ads */}
        <div className="w-1/3 flex flex-col gap-6">
          {/* Ad Space or Promo */}
          <div className="flex-1 bg-apple-red/12 rounded-apple-lg p-6 flex flex-col justify-center text-center">
            <h3 className="apple-text-title2 text-apple-red font-semibold mb-2">¡Oferta del Mes!</h3>
            <p className="apple-label-primary apple-text-title3">20% de descuento en protectores de pantalla con tu reparación.</p>
          </div>

          {/* Totals */}
          <div className="apple-card p-8 space-y-4">
            <div className="flex justify-between apple-label-secondary apple-text-title3">
              <span>Subtotal</span>
              <span className="tabular-nums">${(total || 0).toFixed(2)}</span>
            </div>
            <div className="flex justify-between apple-label-secondary apple-text-title3">
              <span>IVU</span>
              <span className="tabular-nums">${((total || 0) * 0.115).toFixed(2)}</span>
            </div>
            <div
              className="pt-6 mt-2"
              style={{ borderTop: "0.5px solid rgb(var(--separator) / 0.29)" }}
            >
              <div className="flex justify-between text-apple-green apple-text-large-title font-semibold">
                <span>Total</span>
                <span className="tabular-nums">${((total || 0) * 1.115).toFixed(2)}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
