import React, { useCallback, useEffect, useState } from "react";
import { dataClient } from "@/components/api/dataClient";
import OrdersKanban from "@/components/orders/OrdersKanban";
import OrderDetailDialog from "@/components/orders/OrderDetailDialog";

export default function Orders() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedOrder, setSelectedOrder] = useState(null);

  const loadOrders = useCallback(async () => {
    try {
      const rows = await dataClient.entities.Order.list("-updated_date", 500);
      setOrders(rows || []);
    } catch (err) {
      console.error("Orders load error:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadOrders();
  }, [loadOrders]);

  const handleOrderUpdated = (updated) => {
    setOrders((prev) => prev.map((o) => (o.id === updated.id ? { ...o, ...updated } : o)));
    setSelectedOrder((prev) => (prev && prev.id === updated.id ? { ...prev, ...updated } : prev));
  };

  return (
    <div className="apple-type min-h-dvh apple-surface pb-16">
      <div className="app-container pt-6 pb-3 flex items-center justify-between">
        <div>
          <h1 className="apple-text-title1 apple-label-primary font-bold">Órdenes</h1>
          <p className="apple-text-subheadline apple-label-tertiary mt-0.5">
            {loading ? "Cargando…" : `${orders.length} órdenes`}
          </p>
        </div>
      </div>

      <div className="app-container">
        {loading ? (
          <div className="text-center py-16 apple-label-tertiary apple-text-subheadline">Cargando órdenes…</div>
        ) : (
          <OrdersKanban orders={orders} onCardClick={setSelectedOrder} onOrderUpdated={handleOrderUpdated} />
        )}
      </div>

      <OrderDetailDialog
        order={selectedOrder}
        open={!!selectedOrder}
        onClose={() => setSelectedOrder(null)}
        onOrderUpdated={handleOrderUpdated}
      />
    </div>
  );
}
