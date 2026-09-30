import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Search, Plus } from "lucide-react";
import NewOrderWizard from "@/components/wizard/Wizard";
import { OrderCreatedToast } from "@/components/inicio/Cards";
import { dataClient } from "@/components/api/dataClient";
import { statusInfo } from "@/lib/orderStatus";
import OrdersKanban from "@/components/orders/OrdersKanban";
import { AlertDialog } from "@/components/pos/native/posUi";
import { fetchTenant } from "@/lib/orderDetailApi";
import { isMonthlyLimitReached } from "@/lib/inicioApi";
import { safeTZ } from "@/lib/finance/tz";

export default function Orders() {
  const navigate = useNavigate();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [wizard, setWizard] = useState(false);
  const [created, setCreated] = useState(null);
  const [tenant, setTenant] = useState(null);
  const [limitAlert, setLimitAlert] = useState(false);

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

  useEffect(() => {
    let tid = "";
    try { tid = localStorage.getItem("smartfix_tenant_id") || ""; } catch { tid = ""; }
    if (tid) fetchTenant(tid).then(setTenant).catch(() => {});
  }, []);

  const requestNewOrder = () => {
    if (isMonthlyLimitReached(tenant, orders, safeTZ(tenant?.timezone))) { setLimitAlert(true); return; }
    setWizard(true);
  };

  const openOrder = (order) => {
    const seq = (o) => {
      const raw = String(o?.order_number || "").trim();
      const dash = raw.indexOf("-");
      if (dash < 0) return 0;
      const tail = raw.slice(dash + 1);
      return /^\d+$/.test(tail) ? parseInt(tail, 10) : 0;
    };
    let queueMessage = null;
    const current = seq(order);
    if (current > 0) {
      const blockers = orders
        .filter((o) => o.id !== order.id && !o.is_deleted && o.status === "intake" && seq(o) > 0 && seq(o) < current)
        .sort((a, b) => seq(a) - seq(b));
      if (blockers.length) {
        const names = blockers.slice(0, 5).map((o) => o.order_number).filter(Boolean).join(", ");
        queueMessage = blockers.length === 1
          ? `Tienes 1 orden anterior en Recepción (${names}) — recuerda trabajar en orden si es posible.`
          : `Tienes ${blockers.length} órdenes anteriores en Recepción (${names}) — recuerda trabajar en orden si es posible.`;
      }
    }
    navigate(`/Orders/${order.id}`, { state: queueMessage ? { queueMessage } : undefined });
  };

  const statusCounts = useMemo(() => {
    const map = new Map();
    orders.forEach((o) => {
      const st = o.status;
      map.set(st, (map.get(st) || 0) + 1);
    });
    return Array.from(map.entries())
      .map(([id, count]) => ({ id, count, config: statusInfo(id) }))
      .sort((a, b) => b.count - a.count);
  }, [orders]);

  const filteredOrders = useMemo(() => {
    const q = search.trim().toLowerCase();
    return orders.filter((o) => {
      if (statusFilter !== "all" && o.status !== statusFilter) return false;
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
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <h1 className="apple-text-title1 font-bold" style={{ color: "#fff", flex: 1 }}>Órdenes</h1>
          <button onClick={requestNewOrder} aria-label="Nueva orden" className="apple-press" style={{ display: "flex", alignItems: "center", gap: 6, height: 40, padding: "0 16px", borderRadius: 999, background: "#F2662E", color: "#fff", fontSize: 14, fontWeight: 700 }}>
            <Plus className="w-4 h-4" strokeWidth={3} /> Nueva orden
          </button>
        </div>
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
          <OrdersKanban orders={filteredOrders} onCardClick={openOrder} />
        )}
      </div>
      {wizard && (
        <NewOrderWizard open onClose={() => setWizard(false)}
          onCreated={(order) => { setCreated(order); loadOrders(); setTimeout(() => setCreated((c) => (c && c.id === order?.id ? null : c)), 4000); }} />
      )}
      <AlertDialog open={limitAlert} title="Límite del plan alcanzado" message="Alcanzaste el límite de 50 órdenes este mes. Actualiza a Plan Pro para crear órdenes sin límite." onClose={() => setLimitAlert(false)} actions={[{ label: "Entendido", bold: true }]} />
      <OrderCreatedToast order={created} onView={() => { const id = created?.id; setCreated(null); if (id) navigate(`/Orders/${id}`); }} />
    </div>
  );
}
