import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Search, Plus, Building2, Box } from "lucide-react";
import { toast } from "sonner";
import NewOrderWizard from "@/components/wizard/Wizard";
import { OrderCreatedToast } from "@/components/inicio/Cards";
import { dataClient } from "@/components/api/dataClient";
import { statusInfo, PICKER_GROUPS, isOrderClosed } from "@/lib/orderStatus";
import OrdersKanban from "@/components/orders/OrdersKanban";
import { AlertDialog } from "@/components/pos/native/posUi";
import { fetchTenant, resolveCurrentEmployee, changeStatusRpc, changedByLabel, addInternalNote, fetchOrder, findOlderUndiagnosed } from "@/lib/orderDetailApi";
import { loadB2bCompanyMap } from "@/lib/invoicesApi";
import { sendStatusEmail, isMailableStatus } from "@/lib/orderEmails";
import { NoteForChangeSheet, QueueWarningSheet } from "@/components/orderDetail/Sheets";
import OrdersFilterMenu from "@/components/orders/OrdersFilterMenu";
import PartsToOrderDialog from "@/components/compras/PartsToOrder";
import { orderKind, createdAt, deviceTypeLabel } from "@/lib/ordersBoard";
import { DEVICE_BUCKETS, deviceBucket } from "@/lib/deviceBucket";
import { ConsolidatedInvoiceDialog, InvoiceHistoryDialog } from "@/components/invoices/InvoiceDialogs";
import { isMonthlyLimitReached, subscribeOrders } from "@/lib/inicioApi";
import { safeTZ } from "@/lib/finance/tz";
import { hiddenStatusesOf } from "@/lib/tenantSettings";
import { useBusinessMode } from "@/lib/businessMode";

export default function Orders() {
  const navigate = useNavigate();
  const location = useLocation();
  const searchRef = useRef(null);
  const ordersRef = useRef([]);
  const loadSeq = useRef(0);
  const businessMode = useBusinessMode();
  useEffect(() => { if (businessMode === "retail") navigate("/POS", { replace: true }); }, [businessMode, navigate]);
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [wizard, setWizard] = useState(false);
  const [created, setCreated] = useState(null);
  const [tenant, setTenant] = useState(null);
  const [limitAlert, setLimitAlert] = useState(false);
  const [b2b, setB2b] = useState(false);
  const [employeeName, setEmployeeName] = useState("");
  const [invoiceOpen, setInvoiceOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [tenantId, setTenantId] = useState("");
  const [companyById, setCompanyById] = useState({});
  const [kind, setKind] = useState(null);
  const [bucket, setBucket] = useState(() => { try { return localStorage.getItem("orders_bucket") || "all"; } catch { return "all"; } });
  const pickBucket = (id) => { setBucket(id); try { localStorage.setItem("orders_bucket", id); } catch { return; } };
  const [deviceType, setDeviceType] = useState(null);
  const [b2bOnly, setB2bOnly] = useState(false);
  const [showDates, setShowDates] = useState(false);
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [partsOpen, setPartsOpen] = useState(false);
  const [noteFor, setNoteFor] = useState(null);
  const [queueWarn, setQueueWarn] = useState(null);

  const loadOrders = useCallback(async () => {
    const seq = ++loadSeq.current;
    try {
      const [recent, open] = await Promise.all([
        dataClient.entities.Order.filter({ is_deleted: false }, "-updated_date", 500),
        dataClient.entities.Order.filter({ is_deleted: false, status: { $nin: ["delivered", "warranty", "abandoned"] } }, "-updated_date", 2000).catch(() => []),
      ]);
      const seen = new Set((recent || []).map((o) => o.id));
      const merged = [...(recent || []), ...(open || []).filter((o) => !seen.has(o.id))];
      if (seq === loadSeq.current) setOrders(merged);
    } catch (err) {
      console.error("Orders load error:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { ordersRef.current = orders; }, [orders]);

  useEffect(() => {
    if (!location.state?.focusSearch || loading) return;
    searchRef.current?.focus();
    navigate(location.pathname, { replace: true, state: null });
  }, [location.state, location.pathname, loading, navigate]);

  useEffect(() => {
    loadOrders();
  }, [loadOrders]);

  useEffect(() => {
    let tid = "";
    try { tid = localStorage.getItem("smartfix_tenant_id") || ""; } catch { tid = ""; }
    if (!tid) return undefined;
    const off = subscribeOrders(tid, loadOrders);
    const refreshVisible = () => { if (document.visibilityState === "visible") loadOrders(); };
    const poll = setInterval(refreshVisible, 45000);
    document.addEventListener("visibilitychange", refreshVisible);
    window.addEventListener("focus", refreshVisible);
    return () => {
      off();
      clearInterval(poll);
      document.removeEventListener("visibilitychange", refreshVisible);
      window.removeEventListener("focus", refreshVisible);
    };
  }, [loadOrders]);

  useEffect(() => {
    let tid = "";
    try { tid = localStorage.getItem("smartfix_tenant_id") || ""; } catch { tid = ""; }
    setTenantId(tid);
    if (!tid) return;
    fetchTenant(tid).then(setTenant).catch(() => {});
    loadB2bCompanyMap(tid).then((m) => { setCompanyById(m); setB2b(Object.keys(m).length > 0); }).catch(() => {});
    resolveCurrentEmployee(tid).then((e) => setEmployeeName(String(e?.full_name || "").trim())).catch(() => {});
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

  const hiddenStatuses = useMemo(() => hiddenStatusesOf(tenant), [tenant]);

  const statusCounts = useMemo(() => {
    const map = new Map();
    orders.forEach((o) => {
      const st = o.status;
      map.set(st, (map.get(st) || 0) + 1);
    });
    const listed = PICKER_GROUPS.flatMap((g) => g.statuses);
    const extra = Array.from(map.keys()).filter((id) => !listed.includes(id));
    return [...listed, ...extra]
      .filter((id) => !hiddenStatuses.includes(String(id)))
      .map((id) => ({ id, count: map.get(id) || 0, config: statusInfo(id) }));
  }, [orders, hiddenStatuses]);

  useEffect(() => {
    if (statusFilter !== "all" && hiddenStatuses.includes(String(statusFilter))) setStatusFilter("all");
  }, [hiddenStatuses, statusFilter]);

  const bucketCounts = useMemo(() => {
    const c = {};
    orders.forEach((o) => { if (!isOrderClosed(o)) { const b = deviceBucket(o); c[b] = (c[b] || 0) + 1; } });
    return c;
  }, [orders]);

  const kindCounts = useMemo(() => {
    const c = { repairs: 0, unlocks: 0, recharges: 0 };
    orders.forEach((o) => { c[orderKind(o)] += 1; });
    return c;
  }, [orders]);

  const deviceTypes = useMemo(() => {
    const set = new Set();
    orders.forEach((o) => { const t = deviceTypeLabel(o); if (t && !t.toLowerCase().startsWith("bloqueado:")) set.add(t); });
    return Array.from(set).sort((a, b) => a.localeCompare(b, undefined, { sensitivity: "base" }));
  }, [orders]);

  const b2bCount = useMemo(() => orders.filter((o) => o.customer_id && companyById[o.customer_id]).length, [orders, companyById]);

  const dateRange = useMemo(() => {
    const from = dateFrom ? new Date(`${dateFrom}T00:00:00`).getTime() : null;
    const to = dateTo ? new Date(`${dateTo}T23:59:59.999`).getTime() : null;
    return { from, to };
  }, [dateFrom, dateTo]);

  const hasFilters = bucket !== "all" || statusFilter !== "all" || !!kind || !!deviceType || b2bOnly || !!dateFrom || !!dateTo || !!search.trim();
  const menuActive = bucket !== "all" || !!kind || !!deviceType || b2bOnly || !!dateFrom || !!dateTo || showDates;

  const clearFilters = () => {
    setSearch(""); pickBucket("all"); setStatusFilter("all"); setKind(null); setDeviceType(null); setB2bOnly(false);
    setDateFrom(""); setDateTo(""); setShowDates(false);
  };

  const filteredOrders = useMemo(() => {
    const q = search.trim().toLowerCase();
    return orders.filter((o) => {
      if (statusFilter !== "all" && o.status !== statusFilter) return false;
      if (statusFilter === "all" && !q && isOrderClosed(o)) return false;
      if (b2bOnly && !(o.customer_id && companyById[o.customer_id])) return false;
      if (!q && bucket !== "all" && deviceBucket(o) !== bucket) return false;
      if (!q && kind && orderKind(o) !== kind) return false;
      if (!q && deviceType && deviceTypeLabel(o) !== deviceType) return false;
      if (!q && (dateRange.from || dateRange.to)) {
        const t = createdAt(o);
        if (dateRange.from && t < dateRange.from) return false;
        if (dateRange.to && t > dateRange.to) return false;
      }
      if (!q) return true;
      const digits = q.replace(/\D/g, "");
      return (
        o.customer_name?.toLowerCase().includes(q) ||
        o.order_number?.toLowerCase().includes(q) ||
        o.customer_phone?.toLowerCase().includes(q) ||
        o.customer_email?.toLowerCase().includes(q) ||
        o.device_brand?.toLowerCase().includes(q) ||
        o.device_model?.toLowerCase().includes(q) ||
        o.device_serial?.toLowerCase().includes(q) ||
        (digits.length >= 3 && String(o.customer_phone || "").replace(/\D/g, "").includes(digits))
      );
    });
  }, [orders, search, statusFilter, bucket, kind, deviceType, b2bOnly, companyById, dateRange]);

  const applyQuickStatus = useCallback(async (orderId, newStatus) => {
    const live = ordersRef.current.find((o) => o.id === orderId);
    if (!live) return;
    const prevStatus = live.status;
    const by = changedByLabel(employeeName);
    setOrders((list) => list.map((o) => (o.id === orderId ? { ...o, status: newStatus } : o)));
    try {
      await changeStatusRpc(orderId, newStatus, by, true);
    } catch (e) {
      setOrders((list) => list.map((o) => (o.id === orderId ? { ...o, status: prevStatus } : o)));
      toast.error(`No se pudo cambiar el estado: ${e?.message || e}`);
      return;
    }
    const fresh = await fetchOrder(orderId).catch(() => null);
    if (fresh) setOrders((list) => list.map((o) => (o.id === orderId ? { ...o, ...fresh } : o)));
    const target = fresh || { ...live, status: newStatus };
    if (tenant && isMailableStatus(newStatus) && String(target.customer_email || "").trim()) {
      sendStatusEmail({ order: { ...target, status: newStatus }, tenant, status: newStatus }).catch(() => {});
    }
    toast.success(`${live.order_number || "Orden"} · ${statusInfo(newStatus).label}`);
    setNoteFor({ id: orderId, status: newStatus });
  }, [employeeName, tenant]);

  const quickStatus = useCallback(async (order, newStatus) => {
    const live = ordersRef.current.find((o) => o.id === order.id) || order;
    if (live.status === newStatus) return;
    if ((live.status === "intake" || live.status === "diagnosing") && !live.is_quick_service) {
      const older = await findOlderUndiagnosed(live).catch(() => null);
      if (older) { setQueueWarn({ older, orderId: live.id, status: newStatus }); return; }
    }
    applyQuickStatus(live.id, newStatus);
  }, [applyQuickStatus]);

  const iconBtn = { display: "flex", alignItems: "center", justifyContent: "center", width: 40, height: 40, borderRadius: 999, background: "rgba(255,255,255,0.08)", color: "#fff", flexShrink: 0 };

  return (
    <div className="apple-type min-h-dvh" style={{ background: "#000", color: "#fff" }}>
      <div className="app-container pt-6 pb-3">
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <OrdersFilterMenu
            active={menuActive}
            b2bAvailable={b2b}
            b2bCount={b2bCount}
            b2bOnly={b2bOnly}
            onB2b={setB2bOnly}
            kind={kind}
            kindCounts={kindCounts}
            onKind={setKind}
            deviceType={deviceType}
            deviceTypes={deviceTypes}
            onDeviceType={setDeviceType}
            showDates={showDates}
            onToggleDates={() => { if (showDates) { setDateFrom(""); setDateTo(""); } setShowDates((v) => !v); }}
            onClear={clearFilters}
          />
          <h1 className="apple-text-title1 font-bold" style={{ color: "#fff", flex: 1 }}>Órdenes</h1>
          <button onClick={() => setPartsOpen(true)} aria-label="Piezas por ordenar" title="Piezas por ordenar" className="apple-press" style={iconBtn}>
            <Box className="w-4 h-4" />
          </button>
          {b2b && tenant && (
            <button onClick={() => setInvoiceOpen(true)} aria-label="Factura B2B" title="Factura B2B" className="apple-press" style={iconBtn}>
              <Building2 className="w-4 h-4" />
            </button>
          )}
          <button onClick={requestNewOrder} aria-label="Nueva orden" className="apple-press" style={{ display: "flex", alignItems: "center", gap: 6, height: 40, padding: "0 16px", borderRadius: 999, background: "#F2662E", color: "#fff", fontSize: 14, fontWeight: 700 }}>
            <Plus className="w-4 h-4" strokeWidth={3} /> Nueva orden
          </button>
        </div>
      </div>

      <div className="app-container pb-3">
        <div style={{ position: "relative" }}>
          <Search className="w-4 h-4" style={{ position: "absolute", left: 16, top: "50%", transform: "translateY(-50%)", color: "rgba(255,255,255,0.4)" }} />
          <input
            ref={searchRef}
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por orden, cliente, teléfono o equipo"
            className="apple-type w-full h-11"
            style={{ borderRadius: 999, paddingLeft: 40, paddingRight: 16, background: "rgba(255,255,255,0.06)", color: "#fff", border: "none", outline: "none", fontSize: 14 }}
          />
        </div>
      </div>

      <div className="app-container pb-3" style={{ display: "flex", gap: 8, overflowX: "auto" }}>
        {[{ id: "all", label: "Todos" }, ...DEVICE_BUCKETS].map((b) => {
          const on = bucket === b.id;
          const n = b.id === "all" ? Object.values(bucketCounts).reduce((x, y) => x + y, 0) : bucketCounts[b.id] || 0;
          return (
            <button key={b.id} onClick={() => pickBucket(b.id)} className="apple-press" style={{ padding: "8px 14px", borderRadius: 999, fontSize: 14, fontWeight: on ? 700 : 500, whiteSpace: "nowrap", border: "none", cursor: "pointer", display: "flex", gap: 6, alignItems: "baseline", background: on ? "#fff" : "rgba(118,118,128,0.24)", color: on ? "#000" : "#fff", opacity: n === 0 && !on ? 0.5 : 1 }}>
              {b.label} <span style={{ fontSize: 12, fontWeight: 700 }}>{n}</span>
            </button>
          );
        })}
      </div>

      <div className="app-container pb-3" style={{ display: "flex", gap: 8, overflowX: "auto" }}>
        <button
          onClick={() => setStatusFilter("all")}
          className="apple-press"
          style={{
            padding: "8px 14px", borderRadius: 999, fontSize: 14, fontWeight: statusFilter === "all" ? 600 : 400, whiteSpace: "nowrap", border: "none", cursor: "pointer", display: "flex", gap: 6, alignItems: "baseline",
            background: statusFilter === "all" ? "#F2662E" : "rgba(118,118,128,0.24)",
            color: "#fff",
          }}
        >
          Todas <span style={{ fontSize: 12, fontWeight: 600 }}>{orders.length}</span>
        </button>
        {statusCounts.map(({ id, count, config }) => {
          const selected = statusFilter === id;
          return (
            <button
              key={id}
              onClick={() => setStatusFilter(selected ? "all" : id)}
              className="apple-press"
              style={{
                padding: "8px 14px", borderRadius: 999, fontSize: 14, fontWeight: selected ? 600 : 400, whiteSpace: "nowrap", border: "none", cursor: "pointer", display: "flex", gap: 6, alignItems: "baseline",
                background: selected ? config.color : "rgba(118,118,128,0.24)",
                color: "#fff",
              }}
            >
              {config.label} <span style={{ fontSize: 12, fontWeight: 600 }}>{count}</span>
            </button>
          );
        })}
      </div>

      {showDates && (
        <div className="app-container pb-3" style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
          <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: "#8E8E93" }}>
            Desde
            <input type="date" value={dateFrom} max={dateTo || undefined} onChange={(e) => setDateFrom(e.target.value)} style={{ height: 36, padding: "0 10px", borderRadius: 10, background: "rgba(255,255,255,0.08)", color: "#fff", border: "none", outline: "none", colorScheme: "dark" }} />
          </label>
          <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: "#8E8E93" }}>
            Hasta
            <input type="date" value={dateTo} min={dateFrom || undefined} onChange={(e) => setDateTo(e.target.value)} style={{ height: 36, padding: "0 10px", borderRadius: 10, background: "rgba(255,255,255,0.08)", color: "#fff", border: "none", outline: "none", colorScheme: "dark" }} />
          </label>
        </div>
      )}

      <div className="app-container">
        {loading ? (
          <div className="text-center py-16" style={{ color: "rgba(255,255,255,0.4)" }}>Cargando órdenes…</div>
        ) : filteredOrders.length === 0 ? (
          <div className="text-center py-16" style={{ color: "rgba(255,255,255,0.4)", display: "flex", flexDirection: "column", alignItems: "center", gap: 14 }}>
            <span className="apple-text-subheadline">
              {orders.length === 0 ? "Aún no hay órdenes. Crea la primera." : hasFilters ? "Ninguna orden coincide con los filtros" : "No hay órdenes activas"}
            </span>
            {hasFilters ? (
              <button onClick={clearFilters} className="apple-press" style={{ height: 40, padding: "0 18px", borderRadius: 999, background: "rgba(255,255,255,0.08)", color: "#fff", fontSize: 14, fontWeight: 600 }}>Limpiar filtros</button>
            ) : orders.length === 0 ? (
              <button onClick={requestNewOrder} className="apple-press" style={{ height: 40, padding: "0 18px", borderRadius: 999, background: "#F2662E", color: "#fff", fontSize: 14, fontWeight: 700 }}>Nueva orden</button>
            ) : null}
          </div>
        ) : (
          <OrdersKanban orders={filteredOrders} onCardClick={openOrder} companyById={companyById} onQuickStatus={quickStatus} flat={!!search.trim()} hiddenStatuses={hiddenStatuses} />
        )}
      </div>
      {wizard && (
        <NewOrderWizard open onClose={() => setWizard(false)}
          onCreated={(order) => { setCreated(order); loadOrders(); setTimeout(() => setCreated((c) => (c && c.id === order?.id ? null : c)), 4000); }} />
      )}
      {invoiceOpen && <ConsolidatedInvoiceDialog open onClose={() => setInvoiceOpen(false)} tenant={tenant} tenantId={tenantId} employeeName={employeeName} onOpenHistory={() => setHistoryOpen(true)} />}
      {historyOpen && <InvoiceHistoryDialog open onClose={() => setHistoryOpen(false)} tenant={tenant} tenantId={tenantId} />}
      <PartsToOrderDialog open={partsOpen} tenantId={tenantId} employeeName={employeeName} onClose={() => setPartsOpen(false)} onChanged={loadOrders} />
      <NoteForChangeSheet
        open={!!noteFor}
        status={noteFor?.status}
        onClose={() => setNoteFor(null)}
        onSave={async (text) => {
          try {
            await addInternalNote(noteFor.id, text, changedByLabel(employeeName), noteFor.status);
            setNoteFor(null);
            loadOrders();
          } catch (e) {
            toast.error(`No se pudo guardar la nota: ${e?.message || e}`);
          }
        }}
      />
      <QueueWarningSheet open={!!queueWarn} olderNumber={queueWarn?.older?.order_number} onClose={() => setQueueWarn(null)} onContinue={() => { const q = queueWarn; setQueueWarn(null); if (q) applyQuickStatus(q.orderId, q.status); }} />
      <AlertDialog open={limitAlert} title="Límite del plan alcanzado" message="Alcanzaste el límite de 50 órdenes este mes. Actualiza a Plan Pro para crear órdenes sin límite." onClose={() => setLimitAlert(false)} actions={[{ label: "Entendido", bold: true }]} />
      <OrderCreatedToast order={created} onView={() => { const id = created?.id; setCreated(null); if (id) navigate(`/Orders/${id}`); }} />
    </div>
  );
}
