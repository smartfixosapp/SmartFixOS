import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Search, Plus, Building2, Smartphone, Laptop, Tablet, Gamepad2, LockOpen, Wrench, List, Archive, ChevronRight, ChevronLeft, ChevronsUpDown } from "lucide-react";
import { toast } from "sonner";
import NewOrderWizard from "@/components/wizard/Wizard";
import { OrderCreatedToast } from "@/components/inicio/Cards";
import { dataClient } from "@/components/api/dataClient";
import { statusInfo, isOrderClosed } from "@/lib/orderStatus";
import OrdersKanban from "@/components/orders/OrdersKanban";
import { AlertDialog } from "@/components/pos/native/posUi";
import { fetchTenant, resolveCurrentEmployee, changeStatusRpc, changedByLabel, addInternalNote, fetchOrder, findOlderUndiagnosed } from "@/lib/orderDetailApi";
import { loadB2bCompanyMap } from "@/lib/invoicesApi";
import { sendStatusEmail, isMailableStatus } from "@/lib/orderEmails";
import { NoteForChangeSheet, QueueWarningSheet } from "@/components/orderDetail/Sheets";
import { DEVICE_BUCKETS, deviceBucket } from "@/lib/deviceBucket";
import CountUp from "@/components/ui/CountUp";
import { SkeletonCards } from "@/components/ui/Skeleton";
import { ConsolidatedInvoiceDialog, InvoiceHistoryDialog } from "@/components/invoices/InvoiceDialogs";
import { isMonthlyLimitReached, subscribeOrders } from "@/lib/inicioApi";
import { safeTZ } from "@/lib/finance/tz";
import { useBusinessMode } from "@/lib/businessMode";

const BUCKET_STYLE = {
  phones: { Icon: Smartphone, color: "#0A84FF" },
  computers: { Icon: Laptop, color: "#BF5AF2" },
  tablets: { Icon: Tablet, color: "#40C8E0" },
  consoles: { Icon: Gamepad2, color: "#FF375F" },
  unlocks: { Icon: LockOpen, color: "#FF9F0A" },
  other: { Icon: Wrench, color: "#8E8E93" },
};

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
  const stored = (() => { try { return JSON.parse(sessionStorage.getItem("orders_view") || "{}") || {}; } catch { return {}; } })();
  const [search, setSearch] = useState(stored.search || "");
  const [statusFilter, setStatusFilter] = useState(stored.statusFilter || "all");
  const [bucket, setBucket] = useState(stored.bucket || null);
  const [historyMenu, setHistoryMenu] = useState(false);
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
  const [noteFor, setNoteFor] = useState(null);
  const [queueWarn, setQueueWarn] = useState(null);

  useEffect(() => { try { sessionStorage.setItem("orders_view", JSON.stringify({ search, statusFilter, bucket })); } catch { return; } }, [search, statusFilter, bucket]);

  const lastLoad = useRef(0);
  const trailing = useRef(null);
  const loadOrdersRef = useRef(() => {});
  const loadOrders = useCallback(async (force = true) => {
    if (force !== true && Date.now() - lastLoad.current < 3000) {
      clearTimeout(trailing.current);
      trailing.current = setTimeout(() => loadOrdersRef.current(true), 3000);
      return;
    }
    clearTimeout(trailing.current);
    lastLoad.current = Date.now();
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
  useEffect(() => { loadOrdersRef.current = loadOrders; }, [loadOrders]);
  useEffect(() => () => clearTimeout(trailing.current), []);

  useEffect(() => {
    if (!location.state?.focusSearch || loading) return;
    searchRef.current?.focus();
    navigate(location.pathname, { replace: true, state: null });
  }, [location.state, location.pathname, loading, navigate]);

  useEffect(() => {
    loadOrders(true);
  }, [loadOrders]);

  useEffect(() => {
    let tid = "";
    try { tid = localStorage.getItem("smartfix_tenant_id") || ""; } catch { tid = ""; }
    if (!tid) return undefined;
    const off = subscribeOrders(tid, () => loadOrders(false));
    const refreshVisible = () => { if (document.visibilityState === "visible") loadOrders(false); };
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

  const bucketCounts = useMemo(() => {
    const c = {};
    orders.forEach((o) => { if (!isOrderClosed(o)) { const b = deviceBucket(o); c[b] = (c[b] || 0) + 1; } });
    return c;
  }, [orders]);

  const statusTotals = useMemo(() => {
    const c = {};
    orders.forEach((o) => { c[o.status] = (c[o.status] || 0) + 1; });
    return c;
  }, [orders]);

  const openTotal = Object.values(bucketCounts).reduce((x, y) => x + y, 0);
  const isHome = bucket === null && statusFilter === "all" && !search.trim();

  const goHome = () => { setBucket(null); setStatusFilter("all"); setSearch(""); setHistoryMenu(false); };

  const filteredOrders = useMemo(() => {
    const q = search.trim().toLowerCase();
    return orders.filter((o) => {
      if (statusFilter !== "all" && o.status !== statusFilter) return false;
      if (statusFilter === "all" && !q && isOrderClosed(o)) return false;
      if (!q && bucket && bucket !== "all" && deviceBucket(o) !== bucket) return false;
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
  }, [orders, search, statusFilter, bucket]);

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
  const bucketLabel = bucket && bucket !== "all" ? DEVICE_BUCKETS.find((b) => b.id === bucket)?.label : null;
  const headerTitle = statusFilter !== "all" ? statusInfo(statusFilter).label : bucketLabel || "Todas";
  const headerColor = statusFilter !== "all" ? statusInfo(statusFilter).color : bucket && bucket !== "all" ? BUCKET_STYLE[bucket].color : "#fff";

  return (
    <div className="apple-type min-h-dvh" style={{ background: "#000", color: "#fff" }}>
      <div className="app-container pt-6 pb-3">
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <h1 className="apple-text-title1 font-bold" style={{ color: "#fff", flex: 1 }}>Órdenes</h1>
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

      <div className="app-container">
        {loading ? (
          <SkeletonCards count={6} height={150} min={220} />
        ) : isHome ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 12, paddingBottom: 40 }}>
            <div className="stagger" style={{ display: "grid", gap: 12, gridTemplateColumns: "repeat(auto-fill, minmax(min(100%, 220px), 1fr))" }}>
              {DEVICE_BUCKETS.filter((b) => (bucketCounts[b.id] || 0) > 0).map((b) => {
                const { Icon, color } = BUCKET_STYLE[b.id];
                const n = bucketCounts[b.id] || 0;
                return (
                  <button key={b.id} onClick={() => setBucket(b.id)} className="apple-press hover-lift" style={{ textAlign: "left", minHeight: 150, padding: 14, borderRadius: 20, background: "#1C1C1E", border: `1px solid ${color}2E`, display: "flex", flexDirection: "column", justifyContent: "space-between", gap: 10 }}>
                    <span style={{ width: 44, height: 44, borderRadius: 12, background: `${color}29`, color, display: "flex", alignItems: "center", justifyContent: "center" }}><Icon className="w-6 h-6" /></span>
                    <span>
                      <span style={{ display: "block", fontSize: 38, fontWeight: 800, lineHeight: 1, fontVariantNumeric: "tabular-nums" }}><CountUp value={n} /></span>
                      <span style={{ display: "block", fontSize: 17, fontWeight: 600, marginTop: 4 }}>{b.label}</span>
                      <span style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#8E8E93" }}>{n === 1 ? "1 pendiente" : `${n} pendientes`}</span>
                    </span>
                  </button>
                );
              })}
            </div>
            {openTotal === 0 && <p className="text-center" style={{ color: "#8E8E93", fontSize: 14 }}>{orders.length === 0 ? "Aún no hay órdenes. Crea la primera." : "No hay órdenes pendientes."}</p>}
            <button onClick={() => setBucket("all")} className="apple-press flex items-center gap-3 text-left" style={{ padding: 16, borderRadius: 16, background: "#1C1C1E" }}>
              <List className="w-5 h-5" />
              <span className="flex-1" style={{ fontSize: 16, fontWeight: 600 }}>Todas las órdenes</span>
              <span style={{ color: "#8E8E93", fontVariantNumeric: "tabular-nums" }}>{openTotal}</span>
              <ChevronRight className="w-4 h-4" style={{ color: "rgba(235,235,245,0.3)" }} />
            </button>
            <div style={{ position: "relative" }}>
              <button onClick={() => setHistoryMenu((v) => !v)} aria-haspopup="menu" aria-expanded={historyMenu} className="apple-press w-full flex items-center gap-3 text-left" style={{ padding: 16, borderRadius: 16, background: "#1C1C1E", color: "#F2662E" }}>
                <Archive className="w-5 h-5" />
                <span className="flex-1" style={{ fontSize: 16, fontWeight: 600 }}>Historial y cerradas</span>
                <ChevronsUpDown className="w-4 h-4" style={{ color: "rgba(235,235,245,0.3)" }} />
              </button>
              {historyMenu && (
                <>
                  <div className="fixed inset-0" style={{ zIndex: 60 }} onClick={() => setHistoryMenu(false)} />
                  <div role="menu" style={{ position: "absolute", top: 60, left: 0, right: 0, zIndex: 61, borderRadius: 16, background: "#3A3A3C", overflow: "hidden", boxShadow: "0 12px 32px rgba(0,0,0,0.5)" }}>
                    {["delivered", "warranty", "cancelled", "not_repairable", "abandoned"].map((st) => {
                      const info = statusInfo(st);
                      return (
                        <button key={st} role="menuitem" onClick={() => { setStatusFilter(st); setHistoryMenu(false); }} className="w-full flex items-center gap-3 text-left" style={{ padding: "13px 16px", fontSize: 15 }}>
                          <span style={{ width: 8, height: 8, borderRadius: 999, background: info.color }} />
                          <span className="flex-1">{info.label}</span>
                          <span style={{ color: "#8E8E93" }}>{statusTotals[st] || 0}</span>
                        </button>
                      );
                    })}
                  </div>
                </>
              )}
            </div>
          </div>
        ) : (
          <>
            {!search.trim() && (
              <div className="flex items-center justify-between" style={{ padding: "4px 2px 14px" }}>
                <button onClick={goHome} className="apple-press flex items-center gap-1" style={{ color: "#F2662E", fontSize: 15, fontWeight: 600 }}><ChevronLeft className="w-4 h-4" /> Categorías</button>
                <span style={{ fontSize: 17, fontWeight: 700, color: headerColor }}>{headerTitle}</span>
              </div>
            )}
            {filteredOrders.length === 0 ? (
              <div className="text-center py-16" style={{ color: "rgba(255,255,255,0.4)", display: "flex", flexDirection: "column", alignItems: "center", gap: 14 }}>
                <span className="apple-text-subheadline">{search.trim() ? "Ninguna orden coincide con la búsqueda" : "No hay órdenes aquí"}</span>
                <button onClick={goHome} className="apple-press" style={{ height: 40, padding: "0 18px", borderRadius: 999, background: "rgba(255,255,255,0.08)", color: "#fff", fontSize: 14, fontWeight: 600 }}>Volver a categorías</button>
              </div>
            ) : (
              <OrdersKanban orders={filteredOrders} onCardClick={openOrder} companyById={companyById} onQuickStatus={quickStatus} flat={!!search.trim()} />
            )}
          </>
        )}
      </div>
      {wizard && (
        <NewOrderWizard open onClose={() => setWizard(false)}
          onCreated={(order) => { setCreated(order); loadOrders(); setTimeout(() => setCreated((c) => (c && c.id === order?.id ? null : c)), 4000); }} />
      )}
      {invoiceOpen && <ConsolidatedInvoiceDialog open onClose={() => setInvoiceOpen(false)} tenant={tenant} tenantId={tenantId} employeeName={employeeName} onOpenHistory={() => setHistoryOpen(true)} />}
      {historyOpen && <InvoiceHistoryDialog open onClose={() => setHistoryOpen(false)} tenant={tenant} tenantId={tenantId} />}
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
