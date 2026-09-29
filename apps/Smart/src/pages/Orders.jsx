import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Search } from "lucide-react";
import { dataClient } from "@/components/api/dataClient";
import { getEffectiveOrderStatus, getStatusConfig } from "@/components/utils/statusRegistry";
import OrdersKanban from "@/components/orders/OrdersKanban";
import OrderDetailDialog from "@/components/orders/OrderDetailDialog";

export default function Orders() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  const loadOrders = useCallback(async () => {
    try {
      const rows = await dataClient.entities.Order.filter({ is_deleted: false }, "-updated_date", 500);
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

  const handleOrderUpdated = async (updated) => {
    if (!updated?.id) {
      const currentId = selectedOrder?.id;
      await loadOrders();
      if (currentId) {
        const fresh = await dataClient.entities.Order.get(currentId).catch(() => null);
        setSelectedOrder(fresh && !fresh.is_deleted ? fresh : null);
      }
      return;
    }
    setOrders((prev) => prev.map((o) => (o.id === updated.id ? { ...o, ...updated } : o)));
    setSelectedOrder((prev) => (prev && prev.id === updated.id ? { ...prev, ...updated } : prev));
  };

  const statusCounts = useMemo(() => {
    const map = new Map();
    orders.forEach((o) => {
      const st = getEffectiveOrderStatus(o);
      map.set(st, (map.get(st) || 0) + 1);
    });
    return Array.from(map.entries())
      .map(([id, count]) => ({ id, count, config: getStatusConfig(id) }))
      .sort((a, b) => b.count - a.count);
  }, [orders]);

  const filteredOrders = useMemo(() => {
    const q = search.trim().toLowerCase();
    return orders.filter((o) => {
      if (statusFilter !== "all" && getEffectiveOrderStatus(o) !== statusFilter) return false;
      if (!q) return true;
      return (
        o.customer_name?.toLowerCase().includes(q) ||
        o.order_number?.toLowerCase().includes(q) ||
        o.customer_phone?.toLowerCase().includes(q) ||
        o.device_brand?.toLowerCase().includes(q) ||
        o.device_model?.toLowerCase().includes(q)
      );
    });
  }, [orders, search, statusFilter]);

  return (
    <div className="apple-type min-h-dvh" style={{ background: "#000", color: "#fff" }}>
      <div className="app-container pt-6 pb-3">
        <h1 className="apple-text-title1 font-bold" style={{ color: "#fff" }}>Órdenes</h1>
      </div>

      <div className="app-container pb-3">
        <div style={{ position: "relative" }}>
          <Search className="w-4 h-4" style={{ position: "absolute", left: 16, top: "50%", transform: "translateY(-50%)", color: "rgba(255,255,255,0.4)" }} />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por orden, cliente, teléfono o equipo"
            className="apple-type w-full h-11"
            style={{ borderRadius: 999, paddingLeft: 40, paddingRight: 16, background: "rgba(255,255,255,0.06)", color: "#fff", border: "none", outline: "none", fontSize: 14 }}
          />
        </div>
      </div>

      <div className="app-container pb-4" style={{ display: "flex", gap: 8, overflowX: "auto" }}>
        <button
          onClick={() => setStatusFilter("all")}
          className="apple-press"
          style={{
            padding: "8px 16px", borderRadius: 999, fontSize: 14, fontWeight: 700, whiteSpace: "nowrap", border: "none", cursor: "pointer",
            background: statusFilter === "all" ? "#FF5722" : "rgba(255,255,255,0.06)",
            color: statusFilter === "all" ? "#fff" : "rgba(255,255,255,0.7)",
          }}
        >
          Todas {orders.length}
        </button>
        {statusCounts.map(({ id, count, config }) => (
          <button
            key={id}
            onClick={() => setStatusFilter(id)}
            className="apple-press"
            style={{
              padding: "8px 16px", borderRadius: 999, fontSize: 14, fontWeight: statusFilter === id ? 700 : 400, whiteSpace: "nowrap", border: "none", cursor: "pointer",
              background: statusFilter === id ? "#FF5722" : "rgba(255,255,255,0.06)",
              color: statusFilter === id ? "#fff" : "rgba(255,255,255,0.7)",
            }}
          >
            {config.label} {count}
          </button>
        ))}
      </div>

      <div className="app-container">
        {loading ? (
          <div className="text-center py-16" style={{ color: "rgba(255,255,255,0.4)" }}>Cargando órdenes…</div>
        ) : (
          <OrdersKanban orders={filteredOrders} onCardClick={setSelectedOrder} onOrderUpdated={handleOrderUpdated} />
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
