import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Search, Minus, Plus, Trash2, ShoppingCart } from "lucide-react";
import { toast } from "sonner";
import { dataClient } from "@/components/api/dataClient";
import StockWarningBadge, { canAddToCart } from "@/components/pos/StockWarningBadge";
import PaymentModal from "@/components/pos/PaymentModal";

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
    <div className="apple-type min-h-dvh apple-surface pb-16">
      <div className="app-container pt-6 pb-3">
        <h1 className="apple-text-title1 apple-label-primary font-bold">POS</h1>
        <p className="apple-text-subheadline apple-label-tertiary mt-0.5">
          {loading ? "Cargando…" : `${products.length} productos`}
        </p>
      </div>

      <div className="app-container flex flex-col lg:flex-row gap-4">
        <div className="flex-1 min-w-0">
          <div className="relative mb-3">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 apple-label-tertiary" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar producto, SKU o código de barra…"
              className="apple-type w-full h-11 rounded-apple-md pl-10 pr-4 apple-surface-elevated apple-text-body apple-label-primary border border-transparent focus:outline-none"
            />
          </div>

          {loading ? (
            <div className="text-center py-16 apple-label-tertiary apple-text-subheadline">Cargando productos…</div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
              {filteredProducts.map((product) => {
                const qtyInCart = cart.find((c) => c.id === product.id)?.quantity || 0;
                const outOfStock = typeof product.stock === "number" && product.stock <= 0;
                return (
                  <button
                    key={product.id}
                    onClick={() => addToCart(product)}
                    disabled={outOfStock}
                    className="apple-card text-left rounded-apple-lg p-3 flex flex-col gap-1.5 disabled:opacity-40 disabled:cursor-not-allowed apple-press"
                  >
                    <p className="apple-text-subheadline apple-label-primary font-semibold line-clamp-2">
                      {product.name}
                    </p>
                    <p className="apple-text-headline apple-label-primary font-bold tabular-nums">
                      ${Number(product.price || 0).toFixed(2)}
                    </p>
                    <StockWarningBadge product={product} requestedQty={qtyInCart + 1} />
                  </button>
                );
              })}
              {filteredProducts.length === 0 && (
                <div className="col-span-full text-center py-16 apple-label-tertiary apple-text-subheadline">
                  Sin resultados
                </div>
              )}
            </div>
          )}
        </div>

        <div className="w-full lg:w-80 shrink-0">
          <div className="apple-card rounded-apple-lg p-4 sticky top-4">
            <div className="flex items-center gap-2 mb-3">
              <ShoppingCart className="w-4 h-4 apple-label-secondary" />
              <h2 className="apple-text-headline apple-label-primary font-semibold">Carrito</h2>
            </div>

            {cart.length === 0 ? (
              <p className="apple-text-subheadline apple-label-tertiary text-center py-8">
                Toca un producto para agregarlo
              </p>
            ) : (
              <div className="flex flex-col gap-2 mb-4 max-h-[50vh] overflow-y-auto">
                {cart.map((item) => (
                  <div key={item.id} className="flex items-center gap-2">
                    <div className="flex-1 min-w-0">
                      <p className="apple-text-footnote apple-label-primary font-semibold truncate">{item.name}</p>
                      <p className="apple-text-caption1 apple-label-tertiary tabular-nums">
                        ${item.price.toFixed(2)} c/u
                      </p>
                    </div>
                    <button
                      onClick={() => updateQty(item.id, -1)}
                      className="w-6 h-6 rounded-full apple-surface-elevated flex items-center justify-center apple-press"
                    >
                      <Minus className="w-3 h-3" />
                    </button>
                    <span className="apple-text-footnote font-semibold w-5 text-center tabular-nums">
                      {item.quantity}
                    </span>
                    <button
                      onClick={() => updateQty(item.id, 1)}
                      className="w-6 h-6 rounded-full apple-surface-elevated flex items-center justify-center apple-press"
                    >
                      <Plus className="w-3 h-3" />
                    </button>
                    <button
                      onClick={() => removeFromCart(item.id)}
                      className="w-6 h-6 rounded-full flex items-center justify-center apple-press text-apple-red"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            <div className="flex items-center justify-between pt-3 mb-3" style={{ borderTop: '0.5px solid rgb(var(--separator) / 0.29)' }}>
              <span className="apple-text-subheadline apple-label-secondary">Subtotal</span>
              <span className="apple-text-title3 font-bold tabular-nums">${cartSubtotal.toFixed(2)}</span>
            </div>

            <button
              onClick={() => setShowPayment(true)}
              disabled={cart.length === 0}
              className="apple-btn apple-btn-primary apple-btn-lg w-full disabled:opacity-40"
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
