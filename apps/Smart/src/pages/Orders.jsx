import React, { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { dataClient } from "@/components/api/dataClient";
import { useLocation, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Search, Plus, Filter, X, Smartphone, Laptop, Tablet,
  Watch, Gamepad2, Camera, Box, Clock, AlertCircle, CheckCircle2,
  Package, Zap, User, Phone, Calendar, ChevronRight, Grid3X3,
  List, RefreshCw, Eye, Building2, FileText, Shield, FilePlus } from
"lucide-react";
import { toast } from "sonner";
import { format, formatDistanceToNow } from "date-fns";
import { es } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { ORDER_STATUSES, getEffectiveOrderStatus, getStatusConfig, normalizeStatusId } from "@/components/utils/statusRegistry";
import WorkOrderPanel from "../components/workorder/WorkOrderPanel";
import WorkOrderPanelErrorBoundary from "../components/workorder/WorkOrderPanelErrorBoundary";
import WorkOrderWizard from "../components/workorder/WorkOrderWizard";
import CreateInvoiceDialog from "../components/invoice/CreateInvoiceDialog";
import PendingOrdersDialog from "../components/orders/PendingOrdersDialog";
import { debounce } from "@/components/utils/dataCache";
import { OrderCardSkeleton } from "@/components/ui/loading-skeleton";
import { AnimatePresence, motion } from "framer-motion";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import CountdownBadge from "@/components/orders/CountdownBadge";

import UnlocksPanel from "@/components/unlocks/UnlocksPanel";
import { usePlanLimits } from "@/hooks/usePlanLimits";
import EditDeviceModal from "@/components/orders/EditDeviceModal";
import { getLocalOrders, getUnsyncedLocalOrders, mergeOrders, upsertLocalOrder } from "@/components/utils/localOrderCache";
import OrdersQueueSidebar from "@/components/orders/OrdersQueueSidebar";
import { LayoutGrid } from "lucide-react";

const DEVICE_ICONS = {
  phone: Smartphone,
  tablet: Tablet,
  computer: Laptop,
  watch: Watch,
  console: Gamepad2,
  camera: Camera,
  other: Box
};

function resolveDeviceType(order) {
  const src = [
  order?.device_type,
  order?.device_subcategory,
  order?.device_family,
  order?.device_model,
  order?.device_brand].
  filter(Boolean).join(" ").toLowerCase();

  const has = (k) => src.includes(k);

  if (has("iphone") || has("phone") || has("smartphone") || has("galaxy") || has("pixel")) return "phone";
  if (has("tablet") || has("ipad")) return "tablet";
  if (has("laptop") || has("macbook") || has("computer") || has("pc")) return "computer";
  if (has("watch") || has("reloj")) return "watch";
  if (has("console") || has("playstation") || has("xbox") || has("nintendo")) return "console";
  if (has("camera") || has("gopro") || has("drone")) return "camera";
  return "other";
}

function extractOrderSequence(orderNumber) {
  const raw = String(orderNumber || "").trim();
  const match = raw.match(/^WO-(\d+)$/i);
  if (!match) return 0;
  const n = Number(match[1] || 0);
  return Number.isFinite(n) ? n : 0;
}

function showGlobalGateToast(message) {
  toast.custom(
    (t) => (
      <div
        className={`${
          t.visible ? "animate-in slide-in-from-top-2 fade-in-0" : "animate-out fade-out-0"
        } max-w-[92vw] sm:max-w-md rounded-2xl border border-white/20 bg-white/10 backdrop-blur-2xl shadow-[0_18px_60px_rgba(0,0,0,0.45)] p-3`}
      >
        <div className="rounded-xl border border-cyan-300/25 bg-gradient-to-r from-cyan-500/20 via-blue-500/15 to-white/10 p-3">
          <p className="text-[11px] tracking-[0.22em] text-cyan-100/80 font-semibold">Regla Global</p>
          <p className="mt-1 text-sm font-semibold text-white">{message}</p>
        </div>
      </div>
    ),
    { duration: 4200 }
  );
}

// Cuántas órdenes traemos en la carga inicial. Antes eran 600 lo cual hacía
// la página lentísima al abrir. 150 cubre la mayoría de usos (cola + grid
// visible + búsqueda reciente) y baja el tiempo de carga dramáticamente.
// Si el usuario necesita ver más, el botón ↻ trae lo más reciente de nuevo.
const ORDERS_FETCH_LIMIT = 150;

async function fetchTenantOrders() {
  const list = await dataClient.entities.Order.list("-created_date", ORDERS_FETCH_LIMIT);
  return Array.isArray(list) ? list : [];
}

const OrderCard = React.memo(function OrderCard({ order, onClick, onEditDevice }) {
  if (!order || !order.id) return null;

  const deviceType = resolveDeviceType(order);
  const DeviceIcon = DEVICE_ICONS[deviceType] || Box;
  const effectiveStatus = getEffectiveOrderStatus(order);
  const statusConfig = getStatusConfig(effectiveStatus);
  const isB2B = order.company_id || order.company_name;

  const deviceInfo = [order.device_brand, order.device_family, order.device_model].filter(Boolean).join(" ");
  const taskCount = Array.isArray(order.checklist_items) ? order.checklist_items.length : 0;
  const photoItems = Array.isArray(order.photos_metadata) && order.photos_metadata.length > 0
    ? order.photos_metadata
    : Array.isArray(order.device_photos) ? order.device_photos : [];
  const photoCount = photoItems.length;
  // Mostramos UNA sola foto grande en la card (primera disponible).
  // Si hay más fotos, el contador en el footer (📷 N) ya lo indica.
  // photos_metadata: array de {publicUrl, thumbUrl, filename, ...}
  // device_photos (legacy): array de strings con URLs directas.
  const firstPhotoUrl = photoItems
    .map(p => typeof p === 'string' ? p : (p?.publicUrl || p?.thumbUrl || null))
    .find(Boolean) || null;
  const assignedLabel = String(order.assigned_to_name || order.assigned_to || "").trim();
  const phone = order.customer_phone || order.phone || "";

  let ageLabel = "";
  try {
    const d = new Date(order.created_date || order.created_at || Date.now());
    ageLabel = formatDistanceToNow(d, { addSuffix: true, locale: es });
  } catch {}

  // Status accent color
  const accentColor = statusConfig.color || "#3B82F6";

  return (
    <motion.div
      role="button"
      tabIndex={0}
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.98 }}
      transition={{ duration: 0.25 }}
      onClick={onClick}
      onKeyDown={(e) => e.key === 'Enter' && onClick()}
      className={cn(
        "relative overflow-hidden apple-card apple-card-interactive apple-type apple-press w-full p-4 cursor-pointer",
        isB2B && "ring-1 ring-apple-purple/30"
      )}
    >
      {/* ── Status accent stripe (top) ── */}
      <div
        className="absolute top-0 left-0 right-0 h-[2.5px]"
        style={{ background: accentColor, opacity: 0.75 }}
      />

      <div className="flex flex-col gap-3 pt-0.5">
        {/* Top row: icon + customer + status */}
        <div className="flex items-start gap-3">
          <div
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-apple-sm"
            style={{
              background: `${accentColor}1a`,
              color: accentColor,
            }}
          >
            <DeviceIcon className="h-5 w-5" strokeWidth={2} />
          </div>

          <div className="flex-1 min-w-0">
            <h3 className="apple-text-headline apple-label-primary truncate leading-tight">
              {order.customer_name || "Cliente"}
              {isB2B && <span className="ml-1 text-[13px]">🏢</span>}
            </h3>
            <p className="apple-text-footnote apple-label-secondary truncate mt-0.5 tabular-nums">
              {deviceInfo || order.device_type || "Dispositivo"} · <span className="apple-label-primary">{order.order_number || "LOCAL"}</span>
            </p>
          </div>

          <span
            className="inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-bold shrink-0"
            style={{
              background: `${accentColor}22`,
              color: accentColor,
              border: `1px solid ${accentColor}44`,
            }}
          >
            {statusConfig.label}
          </span>
        </div>

        {/* Foto principal */}
        {firstPhotoUrl && (
          <div className="relative w-full aspect-[16/10] rounded-apple-md overflow-hidden bg-white/5 border border-white/10">
            <img
              src={firstPhotoUrl}
              alt=""
              loading="lazy"
              decoding="async"
              className="w-full h-full object-cover"
              onError={(e) => { e.currentTarget.parentElement.style.display = 'none'; }}
            />
          </div>
        )}

        {/* Sin foto: mostrar descripción del problema si existe */}
        {!firstPhotoUrl && (order.issue_description || order.notes || order.service_description) && (
          <p
            className="text-[12px] leading-relaxed line-clamp-2 px-0.5"
            style={{ color: "rgba(255,255,255,0.38)" }}
          >
            {order.issue_description || order.notes || order.service_description}
          </p>
        )}

        {/* Footer: age + tech + badges + phone */}
        <div className="flex items-center justify-between gap-2 pt-2.5" style={{ borderTop: "0.5px solid rgb(var(--separator) / 0.20)" }}>
          <div className="flex items-center gap-2 min-w-0 overflow-hidden">
            <span className="apple-text-caption1 apple-label-tertiary shrink-0">{ageLabel}</span>
            {assignedLabel && (
              <span className="inline-flex items-center gap-1 rounded-full bg-apple-green/15 px-2 py-0.5 text-apple-green apple-text-caption2 font-medium truncate max-w-[110px]">
                <User className="h-2.5 w-2.5 shrink-0" />
                <span className="truncate">{assignedLabel}</span>
              </span>
            )}
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {taskCount > 0 && (
              <div className="flex items-center gap-0.5 text-apple-green">
                <CheckCircle2 className="w-3 h-3" />
                <span className="apple-text-caption1 font-semibold tabular-nums">{taskCount}</span>
              </div>
            )}
            {photoCount > 0 && (
              <div className="flex items-center gap-0.5 text-apple-purple">
                <Camera className="w-3 h-3" />
                <span className="apple-text-caption1 font-semibold tabular-nums">{photoCount}</span>
              </div>
            )}
            <CountdownBadge order={order} />
            {effectiveStatus === "warranty" && (
              <div className="flex items-center gap-1 rounded-full bg-apple-yellow/20 text-apple-yellow px-1.5 py-0.5">
                <Shield className="w-3 h-3" />
                <span className="apple-text-caption2 font-semibold">Gtía</span>
              </div>
            )}
            {phone && (
              <a
                href={`tel:${phone}`}
                onClick={e => e.stopPropagation()}
                className="apple-press w-7 h-7 rounded-full bg-apple-blue/10 flex items-center justify-center text-apple-blue"
                title={phone}
              >
                <Phone className="w-3.5 h-3.5" />
              </a>
            )}
          </div>
        </div>
      </div>
    </motion.div>
  );
});

export default function OrdersPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const { checkLimit, upgradeTo } = usePlanLimits();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedStatus, setSelectedStatus] = useState("active"); // Default to "active" (Todos/Activos)
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [showQuickModal, setShowQuickModal] = useState(false);
  const [refreshTick, setRefreshTick] = useState(0);
  const [showB2BOnly, setShowB2BOnly] = useState(false);
  const [showCreateInvoice, setShowCreateInvoice] = useState(false);
  const [showPendingAlerts, setShowPendingAlerts] = useState(false);
  const [showStatusDropdown, setShowStatusDropdown] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const [activeTab, setActiveTab] = useState("work-orders"); // work-orders, unlocks
  const [editingDeviceOrder, setEditingDeviceOrder] = useState(null);
  // Pull-to-refresh state eliminado — refresh solo por botón
  const containerRef = useRef(null);
  const ordersLoadInFlightRef = useRef(false);
  const ordersErrorToastShownRef = useRef(false);
  const pendingOpenOrderIdRef = useRef(null);

  const openQuickOrderModal = useCallback(() => {
    // Plan limit check — count orders created in the current calendar month
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const monthlyCount = orders.filter((o) => {
      if (o.deleted) return false;
      const created = new Date(o.created_date || o.created_at || 0);
      return created >= monthStart;
    }).length;
    const { allowed, current, max } = checkLimit('max_orders_monthly', monthlyCount);
    if (!allowed) {
      // Show as info toast (not blocker) — real enforcement is server-side.
      // Client-side blocking caused false positives when tenant.plan didn't load correctly.
      const next = upgradeTo?.label || 'Pro';
      toast.info(`${current}/${max} órdenes este mes. Considera upgrade a ${next} para órdenes ilimitadas.`, { duration: 5000 });
    }
    setShowQuickModal(true);
    setShowStatusDropdown(false);
  }, [orders, checkLimit, upgradeTo]);

  useEffect(() => {
    try {
      const params = new URLSearchParams(location.search);
      const openOrderId = params.get("openOrderId") || params.get("order");
      pendingOpenOrderIdRef.current = openOrderId || null;
    } catch {
      pendingOpenOrderIdRef.current = null;
    }
  }, [location.search]);

  useEffect(() => {
    loadOrders();

    try {
      const bySessionFlag = sessionStorage.getItem("smartfix_open_new_order") === "1";
      if (bySessionFlag) {
        setShowQuickModal(true);
        sessionStorage.removeItem("smartfix_open_new_order");
      }
    } catch {
      // no-op
    }

    const handleRefresh = () => {
      console.log("[Orders] Evento force-refresh detectado");
      loadOrders();
    };
    const handleWorkorderCreated = (event) => {
      const createdOrder = event?.detail?.order;
      if (createdOrder?.id) {
        upsertLocalOrder(createdOrder);
        setOrders((prev) => mergeOrders(prev, [createdOrder]));
      }
      loadOrders();
    };
    const handleWorkorderDeleted = (event) => {
      const deletedOrderId = event?.detail?.orderId;
      const deletedOrderNumber = event?.detail?.orderNumber;

      if (!deletedOrderId && !deletedOrderNumber) return;

      setOrders((prev) =>
        (prev || []).filter((order) => {
          const sameId = deletedOrderId ? String(order?.id) === String(deletedOrderId) : false;
          const sameNumber =
            deletedOrderNumber && order?.order_number
              ? String(order.order_number) === String(deletedOrderNumber)
              : false;
          return !(sameId || sameNumber);
        })
      );

      setSelectedOrder((prev) => {
        if (!prev) return prev;
        const sameId = deletedOrderId ? String(prev?.id) === String(deletedOrderId) : false;
        const sameNumber =
          deletedOrderNumber && prev?.order_number
            ? String(prev.order_number) === String(deletedOrderNumber)
            : false;
        return sameId || sameNumber ? null : prev;
      });
    };
    const handleSaleCompleted = (event) => {
      const updatedOrder = event?.detail?.order;
      if (updatedOrder?.id) {
        upsertLocalOrder(updatedOrder);
        setOrders((prev) => mergeOrders([updatedOrder], prev || []));
        setSelectedOrder((prev) => {
          if (!prev) return prev;
          return String(prev?.id || "") === String(updatedOrder.id)
            ? { ...prev, ...updatedOrder }
            : prev;
        });
      }
    };

    window.addEventListener("force-refresh", handleRefresh);
    window.addEventListener("workorder-created", handleWorkorderCreated);
    window.addEventListener("workorder-deleted", handleWorkorderDeleted);
    window.addEventListener("sale-completed", handleSaleCompleted);

    return () => {
      window.removeEventListener("force-refresh", handleRefresh);
      window.removeEventListener("workorder-created", handleWorkorderCreated);
      window.removeEventListener("workorder-deleted", handleWorkorderDeleted);
      window.removeEventListener("sale-completed", handleSaleCompleted);
    };
  }, [refreshTick]);

  // Pull-to-refresh DESHABILITADO por request del usuario.
  // Razón: el gesto se disparaba accidentalmente al hacer scroll normal,
  // causando recargas no deseadas. El usuario ahora refresca solo con
  // el botón "↻" en el header.

  const loadOrders = async () => {
    if (ordersLoadInFlightRef.current) return;
    ordersLoadInFlightRef.current = true;
    setLoading(true);
    let remoteOrders = [];
    let remoteFailed = false;
    try {
      remoteOrders = await fetchTenantOrders();
      remoteOrders.forEach((order) => upsertLocalOrder(order));
      console.log("[Orders] Órdenes remotas cargadas:", remoteOrders.length);
      ordersErrorToastShownRef.current = false;
    } catch (error) {
      remoteFailed = true;
      console.error("Error cargando órdenes:", error);
    } finally {
      const merged = mergeOrders(remoteOrders, getUnsyncedLocalOrders(remoteOrders));
      setOrders(merged);
      if (pendingOpenOrderIdRef.current) {
        const targetOrder = merged.find((order) => String(order?.id || "") === String(pendingOpenOrderIdRef.current));
        if (targetOrder) {
          setSelectedOrder(targetOrder);
          pendingOpenOrderIdRef.current = null;
          try {
            const params = new URLSearchParams(location.search);
            params.delete("openOrderId");
            navigate({
              pathname: location.pathname,
              search: params.toString() ? `?${params.toString()}` : "",
            }, { replace: true });
          } catch {
            // no-op
          }
        }
      }
      if (remoteFailed) {
        if (!ordersErrorToastShownRef.current) {
          if (merged.length > 0) {
            toast.warning("Sin conexión a órdenes. Mostrando datos guardados.");
          } else {
            toast.warning("Sin conexión a órdenes.");
          }
          ordersErrorToastShownRef.current = true;
        }
      }
      setLoading(false);
      ordersLoadInFlightRef.current = false;
    }
  };

  const handleOrderUpdated = useCallback((updatedOrder) => {
    if (updatedOrder) {
      upsertLocalOrder(updatedOrder);
      setOrders((prevOrders) => mergeOrders([updatedOrder], prevOrders || []));
    } else {
      // Fallback: refrescar si no hay datos
      setRefreshTick((t) => t + 1);
    }
  }, []);

  // Filtros
  const filteredOrders = useMemo(() => {
    // Filtrar solo órdenes válidas con datos completos
    let result = orders.filter((o) => o && !o.deleted && o.id);

    // Excluir desbloqueos (Software) del tab de work-orders
    if (activeTab === "work-orders") {
      result = result.filter((o) => o.device_type !== "Software");
    }

    // Filtrar B2B
    if (showB2BOnly) {
      result = result.filter((o) => o.company_id || o.company_name);
    }

    // Filtrar por estado
    if (selectedStatus === "active") {
      // Mostrar todo lo no cerrado como "activo" para no ocultar estados válidos
      const closedStatuses = ["picked_up", "completed", "cancelled", "delivered"];
      result = result.filter((o) => !closedStatuses.includes(getEffectiveOrderStatus(o)));
    } else if (selectedStatus === "closed") {
      // Nuevo filtro "Cerrados" (sin warranty)
      const closedStatuses = ["picked_up", "completed", "cancelled", "delivered"];
      result = result.filter((o) => closedStatuses.includes(getEffectiveOrderStatus(o)));
    } else if (selectedStatus) {
      // Filtro por estado específico
      result = result.filter((o) => getEffectiveOrderStatus(o) === selectedStatus);
    }

    // Filtrar por búsqueda
    const q = searchQuery.toLowerCase().trim();
    if (q) {
      result = result.filter((o) =>
      String(o.order_number).toLowerCase().includes(q) ||
      String(o.customer_name).toLowerCase().includes(q) ||
      String(o.customer_phone).toLowerCase().includes(q) ||
      String(o.device_brand).toLowerCase().includes(q) ||
      String(o.device_model).toLowerCase().includes(q) ||
      String(o.company_name).toLowerCase().includes(q)
      );
    }

    // Ordenar: más nuevo primero (número de orden mayor primero)
    result.sort((a, b) => {
      const seqA = extractOrderSequence(a.order_number);
      const seqB = extractOrderSequence(b.order_number);
      if (seqA !== 0 && seqB !== 0) return seqB - seqA;
      // Fallback por fecha si el número no es parseable
      const dateA = a.created_date || a.created_at || "";
      const dateB = b.created_date || b.created_at || "";
      return dateB.localeCompare(dateA);
    });

    return result;
  }, [orders, selectedStatus, searchQuery, showB2BOnly]);

  const displayOrders = useMemo(() => {
    // Siempre respetar el filtro activo — nunca hacer fallback a "todos"
    // para evitar que órdenes cerradas/entregadas aparezcan en el filtro "Activos"
    return filteredOrders;
  }, [filteredOrders]);

  const clearOrderUrl = useCallback(() => {
    try {
      const params = new URLSearchParams(location.search);
      params.delete("order");
      params.delete("openOrderId");
      const search = params.toString();
      navigate({ pathname: location.pathname, search: search ? `?${search}` : "" }, { replace: true });
    } catch {}
  }, [navigate, location]);

  const tryOpenOrderWithGlobalGate = useCallback(async (targetOrder) => {
    if (!targetOrder?.id) return;
    setSelectedOrder(targetOrder);
    // Persist order ID in URL so Cmd+R keeps the order open
    try {
      const params = new URLSearchParams(location.search);
      params.set("order", targetOrder.id);
      navigate({ pathname: location.pathname, search: `?${params.toString()}` }, { replace: true });
    } catch {}
  }, [navigate, location]);

  // Contadores por estado
  const statusCounts = useMemo(() => {
    const counts = {};
    ORDER_STATUSES.filter((s) => s.isActive).forEach((s) => {
      counts[s.id] = orders.filter((o) =>
      !o.deleted && getEffectiveOrderStatus(o) === s.id
      ).length;
    });

    // Contar cerrados (sin warranty)
    const closedStatuses = ["picked_up", "completed", "cancelled", "delivered"];
    counts["closed"] = orders.filter((o) =>
    !o.deleted && closedStatuses.includes(getEffectiveOrderStatus(o))
    ).length;

    // Contar garantías
    counts["warranty"] = orders.filter((o) =>
    !o.deleted && getEffectiveOrderStatus(o) === "warranty"
    ).length;

    // Contar activos (Todos - incluye warranty)
    counts["active"] = orders.filter((o) =>
    !o.deleted && !closedStatuses.includes(getEffectiveOrderStatus(o))
    ).length;

    return counts;
  }, [orders]);

  return (
    <div
      ref={containerRef}
      className="min-h-screen apple-surface apple-type pb-24 overflow-y-auto"
      style={{
        WebkitOverflowScrolling: "touch",
        paddingTop: "calc(env(safe-area-inset-top, 0px) + 6px)"
      }}
    >
      {/* Pull-to-refresh indicator ELIMINADO */}

      {/* Contenido */}
      <div className="app-container py-3 sm:py-6">
        {/* Header — tabs + acciones mobile, sticky con blur iOS */}
        <div
          className="relative sticky z-40 -mx-4 px-4 py-2 sm:relative sm:z-0 sm:p-0 sm:mb-6 sm:mx-0 sm:bg-transparent"
          style={{
            top: 0,
            backgroundColor: "rgb(var(--surface-primary) / 0.78)",
            WebkitBackdropFilter: "blur(24px) saturate(180%)",
            backdropFilter: "blur(24px) saturate(180%)",
            borderBottom: "0.5px solid rgb(var(--separator) / 0.29)",
          }}
        >
          {/* Row 1: Segmented Control estilo iOS — liquid glass */}
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="liquid-glass-subtle p-1 rounded-apple-md w-full grid grid-cols-2 gap-1 border-0">
              <TabsTrigger
                value="work-orders"
                className="rounded-apple-sm apple-text-footnote font-semibold data-[state=active]:bg-[rgb(var(--surface-elevated))] data-[state=active]:text-apple-blue data-[state=active]:shadow-apple-sm apple-label-secondary transition-all duration-200"
              >
                Órdenes
              </TabsTrigger>
              <TabsTrigger
                value="unlocks"
                className="rounded-apple-sm apple-text-footnote font-semibold data-[state=active]:bg-[rgb(var(--surface-elevated))] data-[state=active]:text-apple-purple data-[state=active]:shadow-apple-sm apple-label-secondary transition-all duration-200"
              >
                Desbloqueo
              </TabsTrigger>
            </TabsList>
          </Tabs>

          {/* Row 2: Mobile-only compact action row */}
          <div className="flex items-center gap-2 mt-2 sm:hidden">
            <button
              onClick={() => loadOrders()}
              className="apple-press w-9 h-9 rounded-full bg-gray-sys6 dark:bg-gray-sys5 flex items-center justify-center apple-label-secondary"
              aria-label="Refrescar"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
            <button
              onClick={openQuickOrderModal}
              className="apple-btn apple-btn-primary text-[14px] min-h-9 px-3 whitespace-nowrap flex-1"
            >
              <FilePlus className="w-4 h-4" />
              Nueva Orden
            </button>
          </div>
        </div>

        {/* ── Header + Pills/Search ── */}
        <div className="flex flex-col gap-3 mb-6">

          {/* Desktop title row */}
          <div className="hidden sm:flex items-center gap-3">
            <h1 className="text-3xl font-bold text-white tracking-tight">Órdenes</h1>
            <button
              onClick={() => loadOrders()}
              className="w-10 h-10 rounded-full bg-white/8 hover:bg-white/12 border border-white/10 flex items-center justify-center text-white/60 hover:text-white transition-all active:scale-95"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
            <Button
              onClick={openQuickOrderModal}
              className="ml-auto h-10 px-5 rounded-full text-sm font-bold bg-gradient-to-r from-blue-600 to-cyan-500 hover:from-blue-500 hover:to-cyan-400 border border-cyan-300/40 text-white shadow-[0_0_18px_rgba(34,211,238,0.3)]"
            >
              <FilePlus className="w-4 h-4 mr-2" />
              Nueva Orden
            </Button>
          </div>

          {/* ── Pills row OR inline search ── */}
          <AnimatePresence mode="wait">
            {showSearch ? (
              /* Search mode — full-width compact input */
              <motion.div
                key="search-input"
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                transition={{ duration: 0.15 }}
                className="flex items-center gap-2"
              >
                <div className="relative flex-1">
                  <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 pointer-events-none" style={{ color: "rgba(255,255,255,0.4)" }} />
                  <input
                    autoFocus
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    onKeyDown={(e) => e.key === 'Escape' && (setShowSearch(false), setSearchQuery(""))}
                    placeholder="Cliente, #orden, teléfono, dispositivo..."
                    className="w-full pl-10 pr-10 py-2.5 rounded-full text-sm text-white placeholder-white/25 focus:outline-none transition-all"
                    style={{
                      background: "rgba(255,255,255,0.07)",
                      border: "1px solid rgba(255,255,255,0.14)",
                    }}
                  />
                  {searchQuery && (
                    <button
                      onClick={() => setSearchQuery("")}
                      className="absolute right-3.5 top-1/2 -translate-y-1/2"
                    >
                      <X className="w-3.5 h-3.5" style={{ color: "rgba(255,255,255,0.4)" }} />
                    </button>
                  )}
                </div>
                <button
                  onClick={() => { setShowSearch(false); setSearchQuery(""); }}
                  className="shrink-0 text-xs font-semibold px-3 py-2 rounded-full transition-all"
                  style={{ color: "rgba(255,255,255,0.5)", background: "rgba(255,255,255,0.06)" }}
                >
                  Cancelar
                </button>
              </motion.div>
            ) : (
              /* Pills mode */
              <motion.div
                key="pills"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.12 }}
                className="flex gap-2 overflow-x-auto pb-0.5 no-scrollbar items-center"
              >
                {/* 🔍 Search icon */}
                <button
                  onClick={() => setShowSearch(true)}
                  className="shrink-0 w-8 h-8 rounded-full flex items-center justify-center transition-all active:scale-90"
                  style={{ background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.1)" }}
                  title="Buscar"
                >
                  <Search className="w-3.5 h-3.5" style={{ color: "rgba(255,255,255,0.5)" }} />
                </button>

                {/* Divider */}
                <div className="shrink-0 w-px h-5 rounded-full" style={{ background: "rgba(255,255,255,0.1)" }} />

                {/* Todos */}
                <button
                  onClick={() => setSelectedStatus("active")}
                  className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold transition-all"
                  style={{
                    background: selectedStatus === "active" ? "rgba(96,165,250,0.18)" : "rgba(255,255,255,0.05)",
                    color: selectedStatus === "active" ? "#60a5fa" : "rgba(255,255,255,0.38)",
                    border: selectedStatus === "active" ? "1px solid rgba(96,165,250,0.35)" : "1px solid rgba(255,255,255,0.08)",
                  }}
                >
                  Todos
                  <span className="px-1.5 py-0.5 rounded-full text-[10px]" style={{ background: "rgba(255,255,255,0.1)" }}>
                    {statusCounts["active"] || 0}
                  </span>
                </button>

          {/* ── Status quick-filter pills (below the former code, now merged) ── */}
          <div className="contents">
            {/* Todos activos */}
            <button
              onClick={() => setSelectedStatus("active")}
              className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold transition-all"
              style={{
                background: selectedStatus === "active" ? "rgba(96,165,250,0.18)" : "rgba(255,255,255,0.05)",
                color: selectedStatus === "active" ? "#60a5fa" : "rgba(255,255,255,0.38)",
                border: selectedStatus === "active" ? "1px solid rgba(96,165,250,0.35)" : "1px solid rgba(255,255,255,0.08)",
              }}
            >
              Todos
              <span className="px-1.5 py-0.5 rounded-full text-[10px]" style={{ background: "rgba(255,255,255,0.1)" }}>
                {statusCounts["active"] || 0}
              </span>
            </button>

            {/* Estados activos con órdenes */}
            {ORDER_STATUSES
              .filter(s => s.isActive && !["picked_up","completed","cancelled","delivered","warranty"].includes(s.id) && (statusCounts[s.id] || 0) > 0)
              .sort((a, b) => (b.order || 0) - (a.order || 0))
              .map(s => (
                <button
                  key={s.id}
                  onClick={() => setSelectedStatus(selectedStatus === s.id ? "active" : s.id)}
                  className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold transition-all"
                  style={{
                    background: selectedStatus === s.id ? `${s.color}22` : "rgba(255,255,255,0.05)",
                    color: selectedStatus === s.id ? s.color : "rgba(255,255,255,0.38)",
                    border: selectedStatus === s.id ? `1px solid ${s.color}40` : "1px solid rgba(255,255,255,0.08)",
                  }}
                >
                  <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: s.color }} />
                  {s.label}
                  <span className="px-1.5 py-0.5 rounded-full text-[10px]" style={{ background: "rgba(255,255,255,0.1)" }}>
                    {statusCounts[s.id]}
                  </span>
                </button>
              ))
            }

            {/* Cerrados */}
            {(statusCounts["closed"] || 0) > 0 && (
              <button
                onClick={() => setSelectedStatus(selectedStatus === "closed" ? "active" : "closed")}
                className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold transition-all"
                style={{
                  background: selectedStatus === "closed" ? "rgba(255,255,255,0.12)" : "rgba(255,255,255,0.05)",
                  color: selectedStatus === "closed" ? "rgba(255,255,255,0.85)" : "rgba(255,255,255,0.35)",
                  border: selectedStatus === "closed" ? "1px solid rgba(255,255,255,0.25)" : "1px solid rgba(255,255,255,0.08)",
                }}
              >
                Cerrados
                <span className="px-1.5 py-0.5 rounded-full text-[10px]" style={{ background: "rgba(255,255,255,0.1)" }}>
                  {statusCounts["closed"]}
                </span>
              </button>
            )}
          </div>

        </div>

        {/* Tabs Content */}
        {/* Work Orders Tab */}
        {activeTab === "work-orders" && (
          <>
            {loading ?
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-3 md:gap-4">

                {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => <OrderCardSkeleton key={i} />)}
              </motion.div> :
            displayOrders.length === 0 ?
        <div className="flex flex-col items-center justify-center py-20">
            <div className="relative mb-6">
              <div className="absolute inset-0 bg-cyan-500 blur-3xl opacity-10"></div>
              <Package className="relative w-24 h-24 text-gray-700 opacity-20 theme-light:text-gray-400" />
            </div>
            <h3 className="text-2xl font-bold text-gray-600 mb-2 theme-light:text-gray-700">
              {searchQuery || selectedStatus ? "No se encontraron órdenes" : "Sin órdenes"}
            </h3>
            <p className="text-gray-500 mb-6 theme-light:text-gray-600">
              {searchQuery || selectedStatus ? "Intenta con otros filtros" : "Crea tu primera orden"}
            </p>
            {(searchQuery || selectedStatus) &&
          <Button
            onClick={() => {
              setSearchQuery("");
              setSelectedStatus(null);
            }}
            variant="outline"
            className="border-cyan-500/30 text-cyan-400 hover:bg-cyan-600/20 theme-light:border-cyan-300 theme-light:text-cyan-600">

                <X className="w-4 h-4 mr-2" />
                Limpiar filtros
              </Button>
          }
          </div> :

        <>
            {/* Info de filtros activos (OCULTO A PETICIÓN) */}
            {/* {(searchQuery || selectedStatus) && (
             <div className="mb-4 flex items-center justify-between gap-3 bg-cyan-600/10 border border-cyan-500/30 rounded-xl p-3 theme-light:bg-cyan-50 theme-light:border-cyan-300">
               <div className="flex items-center gap-2">
                 <Filter className="w-4 h-4 text-cyan-400 theme-light:text-cyan-600" />
                 <span className="text-sm text-cyan-300 font-semibold theme-light:text-cyan-700">
                   {displayOrders.length} {displayOrders.length === 1 ? 'orden' : 'órdenes'}
                 </span>
                 {searchQuery && (
                   <Badge className="bg-white/10 text-white theme-light:bg-white theme-light:text-gray-900">
                     "{searchQuery}"
                   </Badge>
                 )}
               </div>
               <Button
                 size="sm"
                 variant="ghost"
                 onClick={() => {
                   setSearchQuery("");
                   setSelectedStatus("active");
                 }}
                 className="text-cyan-400 hover:text-cyan-300 theme-light:text-cyan-600"
               >
                 <X className="w-4 h-4" />
               </Button>
             </div>
            )} */}

            {/* Layout: Sidebar de cola + Grid de cards */}
            <div className="flex gap-4">
              {/* Sidebar lateral con cola de trabajo (desktop only) */}
              <aside className="hidden lg:block w-[280px] shrink-0 rounded-[20px] border border-white/[0.08] bg-[#0D0D0F]/60 backdrop-blur-xl overflow-hidden sticky top-4 h-[calc(100vh-8rem)]">
                <OrdersQueueSidebar
                  orders={orders}
                  selectedOrderId={selectedOrder?.id}
                  onSelectOrder={(order) => tryOpenOrderWithGlobalGate(order)}
                />
              </aside>

              {/* Grid de órdenes */}
              <motion.div
                layout
                className="flex-1 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-3 md:gap-4"
              >
                <AnimatePresence mode="popLayout">
                  {displayOrders.map((order) =>
                    <OrderCard
                      key={order.id}
                      order={order}
                      onClick={() => tryOpenOrderWithGlobalGate(order)}
                      onEditDevice={setEditingDeviceOrder} />
                  )}
                </AnimatePresence>
              </motion.div>
            </div>
          </>
        }
        </>
        )}

        {/* Unlocks Tab */}
        {activeTab === "unlocks" && <UnlocksPanel />}
      </div>

      {/* Modal de orden seleccionada */}
      {selectedOrder &&
      <div className="fixed inset-0 z-[9999] bg-black/80 backdrop-blur-sm">
          <WorkOrderPanelErrorBoundary onClose={() => { setSelectedOrder(null); clearOrderUrl(); }} onReset={() => { setSelectedOrder(null); clearOrderUrl(); }}>
          <WorkOrderPanel
          orderId={selectedOrder.id}
          onClose={() => {
            setSelectedOrder(null);
            clearOrderUrl();
          }}
          onUpdate={handleOrderUpdated}
          onDelete={(deletedOrderId) => {
            console.log("[Orders] Orden eliminada:", deletedOrderId);
            setSelectedOrder(null);
            clearOrderUrl();
            setOrders((prev) => prev.filter((o) => o.id !== deletedOrderId));
          }} />
          </WorkOrderPanelErrorBoundary>

        </div>
      }

      {/* Modal de nueva orden */}
      {showQuickModal &&
      <WorkOrderWizard
        open={showQuickModal}
        onClose={() => setShowQuickModal(false)}
        onSuccess={(newOrder) => {
          setShowQuickModal(false);
          if (newOrder) {
            upsertLocalOrder(newOrder);
            setOrders(prev => mergeOrders(prev, [newOrder]));
            // Abrir la orden recién creada
            if (newOrder.id) setSelectedOrder(newOrder);
          } else {
            loadOrders();
          }
          toast.success("Orden creada");
        }} />

      }

      {/* Modal de crear factura B2B */}
      {showCreateInvoice &&
      <CreateInvoiceDialog
        open={showCreateInvoice}
        onClose={() => setShowCreateInvoice(false)}
        onSuccess={() => {
          setShowCreateInvoice(false);
          toast.success("✅ Factura creada");
        }} />

      }

      {/* Modal de Alertas Pendientes */}
      <PendingOrdersDialog
        open={showPendingAlerts}
        onClose={() => setShowPendingAlerts(false)} />

      {/* Modal de editar equipo */}
      {editingDeviceOrder && (
        <EditDeviceModal
          open={!!editingDeviceOrder}
          order={editingDeviceOrder}
          onClose={() => setEditingDeviceOrder(null)}
          onUpdate={(updatedOrder) => {
            setOrders(prev => prev.map(o => o.id === updatedOrder.id ? updatedOrder : o));
            setEditingDeviceOrder(null);
          }}
        />
      )}
    </div>
  );
}
