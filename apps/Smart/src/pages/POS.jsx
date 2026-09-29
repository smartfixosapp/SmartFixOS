import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Search, Minus, Plus, Trash2, ShoppingCart, Package, Lock } from "lucide-react";
import { toast } from "sonner";
import { dataClient } from "@/components/api/dataClient";
import StockWarningBadge, { canAddToCart } from "@/components/pos/StockWarningBadge";
import PaymentModal from "@/components/pos/PaymentModal";

const TILE_COLORS = ["#34C759", "#FF9F0A", "#5AC8FA", "#BF5AF2", "#FF453A", "#FFD60A"];
function tileColor(id) {
  let hash = 0;
  const s = String(id || "");
  for (let i = 0; i < s.length; i++) hash = (hash * 31 + s.charCodeAt(i)) >>> 0;
  return TILE_COLORS[hash % TILE_COLORS.length];
}

export default function POS() {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [cart, setCart] = useState([]);
  const [showPayment, setShowPayment] = useState(false);

  const loadProducts = useCallback(async () => {
    try {
      const rows = await dataClient.entities.Product.list("name", 1000);
      setProducts(rows || []);
    } catch (err) {
      console.error("POS products load error:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadProducts();
  }, [loadProducts]);

  const filteredProducts = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return products;
    return products.filter(
      (p) =>
        p.name?.toLowerCase().includes(q) ||
        p.sku?.toLowerCase().includes(q) ||
        p.barcode?.toLowerCase().includes(q)
    );
  }, [products, search]);

  const addToCart = (product) => {
    const qtyInCart = cart.find((c) => c.id === product.id)?.quantity || 0;
    const check = canAddToCart(product, 1, qtyInCart);
    if (!check.allowed) {
      toast.error(check.message);
      return;
    }
    setCart((prev) => {
      const existing = prev.find((c) => c.id === product.id);
      if (existing) {
        return prev.map((c) => (c.id === product.id ? { ...c, quantity: c.quantity + 1 } : c));
      }
      return [
        ...prev,
        {
          id: product.id,
          name: product.name,
          price: Number(product.price || 0),
          quantity: 1,
          taxable: product.taxable !== false,
        },
      ];
    });
  };

  const updateQty = (id, delta) => {
    setCart((prev) =>
      prev
        .map((c) => (c.id === id ? { ...c, quantity: c.quantity + delta } : c))
        .filter((c) => c.quantity > 0)
    );
  };

  const removeFromCart = (id) => setCart((prev) => prev.filter((c) => c.id !== id));

  const cartSubtotal = cart.reduce((sum, c) => sum + c.price * c.quantity, 0);

  const handlePaymentSuccess = async () => {
    try {
      await Promise.all(
        cart.map((item) => {
          const product = products.find((p) => p.id === item.id);
          if (!product || typeof product.stock !== "number") return Promise.resolve();
          const newStock = Math.max(0, Number(product.stock) - item.quantity);
          return dataClient.entities.Product.update(item.id, { stock: newStock });
        })
      );
    } catch (err) {
      console.error("Stock update error:", err);
      toast.error("Venta cobrada, pero hubo un problema actualizando el inventario.");
    }
    setCart([]);
    setShowPayment(false);
    toast.success("Venta completada");
    loadProducts();
  };

  return (
    <div className="apple-type min-h-dvh pb-16" style={{ background: "#000", color: "#fff" }}>
      <div className="app-container pt-6 pb-3">
        <h1 className="apple-text-title1 font-bold text-center" style={{ color: "#fff" }}>Punto de Venta</h1>
      </div>

      <div className="app-container flex flex-col lg:flex-row gap-4">
        <div className="flex-1 min-w-0">
          <div style={{ position: "relative", marginBottom: 12 }}>
            <Search className="w-4 h-4" style={{ position: "absolute", left: 16, top: "50%", transform: "translateY(-50%)", color: "rgba(255,255,255,0.4)" }} />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar producto, SKU…"
              className="apple-type w-full h-11"
              style={{ borderRadius: 999, paddingLeft: 40, paddingRight: 16, background: "rgba(255,255,255,0.06)", color: "#fff", border: "none", outline: "none", fontSize: 14 }}
            />
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
            <div style={{ padding: "6px 14px", borderRadius: 999, background: "rgba(52,199,89,0.12)", border: "1px solid rgba(52,199,89,0.3)", display: "flex", alignItems: "center", gap: 6 }}>
              <Lock className="w-3 h-3" style={{ color: "#34C759" }} />
              <span style={{ fontSize: 13, color: "#34C759", fontWeight: 700 }}>${cartSubtotal.toFixed(2)}</span>
            </div>
            <div style={{ padding: "6px 14px", borderRadius: 999, background: "rgba(255,255,255,0.06)", fontSize: 13, color: "rgba(255,255,255,0.55)" }}>
              Sin cliente
            </div>
          </div>

          {loading ? (
            <div className="text-center py-16" style={{ color: "rgba(255,255,255,0.4)" }}>Cargando productos…</div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
              {filteredProducts.map((product) => {
                const qtyInCart = cart.find((c) => c.id === product.id)?.quantity || 0;
                const outOfStock = typeof product.stock === "number" && product.stock <= 0;
                const color = tileColor(product.id);
                return (
                  <button
                    key={product.id}
                    onClick={() => addToCart(product)}
                    disabled={outOfStock}
                    className="apple-press text-left disabled:opacity-40 disabled:cursor-not-allowed"
                    style={{ borderRadius: 16, background: "rgba(255,255,255,0.05)", padding: 10, display: "flex", flexDirection: "column", gap: 8, border: "none", cursor: "pointer" }}
                  >
                    <div style={{ height: 84, borderRadius: 12, background: `${color}24`, display: "flex", alignItems: "center", justifyContent: "center" }}>
                      <Package className="w-6 h-6" style={{ color }} />
                    </div>
                    <span style={{ fontSize: 17, fontWeight: 800, color: "#FF6A3D" }}>
                      ${Number(product.price || 0).toFixed(2)}
                    </span>
                    <span style={{ fontSize: 13, color: "rgba(255,255,255,0.7)" }} className="line-clamp-2">
                      {product.name}
                    </span>
                    <StockWarningBadge product={product} requestedQty={qtyInCart + 1} />
                  </button>
                );
              })}
              {filteredProducts.length === 0 && (
                <div className="col-span-full text-center py-16" style={{ color: "rgba(255,255,255,0.4)" }}>
                  Sin resultados
                </div>
              )}
            </div>
          )}
        </div>

        <div className="w-full lg:w-80 shrink-0">
          <div style={{ borderRadius: 18, background: "rgba(255,255,255,0.05)", padding: 16, position: "sticky", top: 16 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
              <ShoppingCart className="w-4 h-4" style={{ color: "rgba(255,255,255,0.6)" }} />
              <h2 style={{ fontSize: 16, fontWeight: 700, color: "#fff" }}>Carrito</h2>
            </div>

            {cart.length === 0 ? (
              <p className="text-center py-8" style={{ fontSize: 14, color: "rgba(255,255,255,0.4)" }}>
                Toca un producto para agregarlo
              </p>
            ) : (
              <div className="flex flex-col gap-2 mb-4 max-h-[50vh] overflow-y-auto">
                {cart.map((item) => (
                  <div key={item.id} className="flex items-center gap-2">
                    <div className="flex-1 min-w-0">
                      <p style={{ fontSize: 13, fontWeight: 700, color: "#fff" }} className="truncate">{item.name}</p>
                      <p style={{ fontSize: 12, color: "rgba(255,255,255,0.4)" }} className="tabular-nums">
                        ${item.price.toFixed(2)} c/u
                      </p>
                    </div>
                    <button
                      onClick={() => updateQty(item.id, -1)}
                      className="w-6 h-6 rounded-full flex items-center justify-center apple-press"
                      style={{ background: "rgba(255,255,255,0.08)" }}
                    >
                      <Minus className="w-3 h-3" style={{ color: "#fff" }} />
                    </button>
                    <span style={{ fontSize: 13, fontWeight: 700, color: "#fff" }} className="w-5 text-center tabular-nums">
                      {item.quantity}
                    </span>
                    <button
                      onClick={() => updateQty(item.id, 1)}
                      className="w-6 h-6 rounded-full flex items-center justify-center apple-press"
                      style={{ background: "rgba(255,255,255,0.08)" }}
                    >
                      <Plus className="w-3 h-3" style={{ color: "#fff" }} />
                    </button>
                    <button
                      onClick={() => removeFromCart(item.id)}
                      className="w-6 h-6 rounded-full flex items-center justify-center apple-press"
                      style={{ color: "#FF453A" }}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            <div className="flex items-center justify-between pt-3 mb-3" style={{ borderTop: "0.5px solid rgba(255,255,255,0.12)" }}>
              <span style={{ fontSize: 14, color: "rgba(255,255,255,0.6)" }}>Subtotal</span>
              <span style={{ fontSize: 20, fontWeight: 800, color: "#fff" }} className="tabular-nums">${cartSubtotal.toFixed(2)}</span>
            </div>

            <button
              onClick={() => setShowPayment(true)}
              disabled={cart.length === 0}
              className="apple-btn apple-btn-lg w-full disabled:opacity-40"
              style={{ background: "#FF5722", color: "#fff" }}
            >
              Cobrar
            </button>
          </div>
        </div>
      </div>

      <PaymentModal
        open={showPayment}
        onClose={() => setShowPayment(false)}
        subtotal={cartSubtotal}
        items={cart}
        onSuccess={handlePaymentSuccess}
      />
    </div>
  );
}
