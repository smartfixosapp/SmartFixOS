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
import EditDeviceModal from "@/components/orders/EditDeviceModal";
import { getLocalOrders, getUnsyncedLocalOrders, mergeOrders, upsertLocalOrder } from "@/components/utils/localOrderCache";

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
          <p className="text-[11px] uppercase tracking-[0.22em] text-cyan-100/80 font-semibold">Regla Global</p>
          <p className="mt-1 text-sm font-semibold text-white">{message}</p>
        </div>
      </div>
    ),
    { duration: 4200 }
  );
}

async function fetchTenantOrders() {
  const list = await dataClient.entities.Order.list("-created_date", 600);
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
  const photoCount = Array.isArray(order.photos_metadata) ? order.photos_metadata.length :
    Array.isArray(order.device_photos) ? order.device_photos.length : 0;
  const assignedLabel = String(order.assigned_to_name || order.assigned_to || "").trim();
  const phone = order.customer_phone || order.phone || "";

  let ageLabel = "";
  try {
    const d = new Date(order.created_date || order.created_at || Date.now());
    ageLabel = formatDistanceToNow(d, { addSuffix: true, locale: es });
  } catch {}

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
        "group relative w-full overflow-hidden rounded-[24px] border p-4 transition-all duration-300 cursor-pointer",
        "bg-[#121215]/40 backdrop-blur-2xl border-white/[0.06] hover:border-white/20 hover:bg-[#16161a]/60",
        "shadow-[0_4px_20px_rgba(0,0,0,0.3)] active:scale-[0.985]",
        isB2B && "border-purple-500/20 hover:border-purple-500/40"
      )}
    >
      <div className="relative z-10 flex flex-col gap-3">
        {/* Top row: icon + customer + status */}
        <div className="flex items-start gap-3">
          <div className={cn(
            "flex h-11 w-11 shrink-0 items-center justify-center rounded-[16px] shadow-lg",
            isB2B
              ? "bg-gradient-to-br from-purple-500 to-indigo-600"
              : "bg-gradient-to-br from-blue-500 to-cyan-600"
          )}>
            <DeviceIcon className="h-5 w-5 text-white" strokeWidth={2.5} />
          </div>

          <div className="flex-1 min-w-0">
            <h3 className="text-[15px] font-black text-white truncate leading-tight">
              {order.customer_name || "Cliente"}
              {isB2B && <span className="ml-1 text-[11px]">🏢</span>}
            </h3>
            <p className="text-[10px] text-white/30 font-medium truncate mt-0.5">
              {deviceInfo || order.device_type || "Dispositivo"} · <span className="text-white/20">{order.order_number || "LOCAL"}</span>
            </p>
          </div>

          <span className={cn(
            "inline-flex items-center rounded-full px-2 py-0.5 text-[9px] font-black uppercase tracking-[0.08em] border shrink-0",
            statusConfig.colorClasses
          )}>
            {statusConfig.label}
          </span>
        </div>

        {/* Footer: age + tech + badges + phone */}
        <div className="flex items-center justify-between gap-2 pt-2.5 border-t border-white/[0.05]">
          <div className="flex items-center gap-2 min-w-0 overflow-hidden">
            <span className="text-[10px] font-bold text-white/25 shrink-0">{ageLabel}</span>
            {assignedLabel && (
              <span className="inline-flex items-center gap-1 rounded-lg border border-emerald-500/15 bg-emerald-500/5 px-2 py-0.5 text-emerald-400/80 text-[9px] font-black uppercase tracking-wide truncate max-w-[100px]">
                <User className="h-2.5 w-2.5 shrink-0" />
                <span className="truncate">{assignedLabel}</span>
              </span>
            )}
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {taskCount > 0 && (
              <div className="flex items-center gap-0.5 text-emerald-400/50">
                <CheckCircle2 className="w-3 h-3" />
                <span className="text-[10px] font-black">{taskCount}</span>
              </div>
            )}
            {photoCount > 0 && (
              <div className="flex items-center gap-0.5 text-purple-400/50">
                <Camera className="w-3 h-3" />
                <span className="text-[10px] font-black">{photoCount}</span>
              </div>
            )}
            <CountdownBadge order={order} />
            {effectiveStatus === "warranty" && (
              <div className="flex items-center gap-1 rounded-full bg-amber-500/20 text-amber-400 border border-amber-500/20 px-1.5 py-0.5">
                <Shield className="w-3 h-3" />
                <span className="text-[9px] font-black uppercase tracking-tight">Gtía</span>
              </div>
            )}
            {phone && (
              <a
                href={`tel:${phone}`}
                onClick={e => e.stopPropagation()}
                className="w-6 h-6 rounded-lg bg-white/[0.04] border border-white/10 flex items-center justify-center text-white/25 hover:text-white/70 hover:bg-white/10 transition-all active:scale-90"
                title={phone}
              >
                <Phone className="w-3 h-3" />
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
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedStatus, setSelectedStatus] = useState("active"); // Default to "active" (Todos/Activos)
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [showQuickModal, setShowQuickModal] = useState(false);
  const [viewMode, setViewMode] = useState("grid"); // grid o list
  const [refreshTick, setRefreshTick] = useState(0);
  const [showB2BOnly, setShowB2BOnly] = useState(false);
  const [showCreateInvoice, setShowCreateInvoice] = useState(false);
  const [showPendingAlerts, setShowPendingAlerts] = useState(false);
  const [showStatusDropdown, setShowStatusDropdown] = useState(false);
  const [activeTab, setActiveTab] = useState("work-orders"); // work-orders, unlocks
  const [editingDeviceOrder, setEditingDeviceOrder] = useState(null);
  const [pullDistance, setPullDistance] = useState(0);
  const pullStartRef = useRef(0);
  const isPullingRef = useRef(false);
  const containerRef = useRef(null);
  const ordersLoadInFlightRef = useRef(false);
  const ordersErrorToastShownRef = useRef(false);
  const pendingOpenOrderIdRef = useRef(null);

  const openQuickOrderModal = useCallback(() => {
    setShowQuickModal(true);
    setShowStatusDropdown(false);
  }, []);

  useEffect(() => {
    try {
      const params = new URLSearchParams(location.search);
      const openOrderId = params.get("openOrderId");
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

  // Pull-to-refresh handlers (stable — uses refs to avoid re-registering on every move)
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handleTouchStart = (e) => {
      // Only activate if already at top AND it's a fresh touch (not finishing a scroll)
      if (container.scrollTop === 0) {
        pullStartRef.current = e.touches[0].clientY;
        isPullingRef.current = false;
      } else {
        pullStartRef.current = 0;
      }
    };

    const handleTouchMove = (e) => {
      if (pullStartRef.current === 0) return;
      const distance = e.touches[0].clientY - pullStartRef.current;
      if (distance > 5) {
        isPullingRef.current = true;
        setPullDistance(Math.min(distance, 100));
      } else {
        // Scrolling up or sideways — cancel pull
        pullStartRef.current = 0;
        isPullingRef.current = false;
        setPullDistance(0);
      }
    };

    const handleTouchEnd = () => {
      if (isPullingRef.current && pullStartRef.current > 0) {
        setPullDistance(prev => {
          if (prev > 60) {
            window.dispatchEvent(new Event("force-refresh"));
            loadOrders();
          }
          return 0;
        });
      } else {
        setPullDistance(0);
      }
      pullStartRef.current = 0;
      isPullingRef.current = false;
    };

    container.addEventListener("touchstart", handleTouchStart, { passive: true });
    container.addEventListener("touchmove", handleTouchMove, { passive: true });
    container.addEventListener("touchend", handleTouchEnd, { passive: true });

    return () => {
      container.removeEventListener("touchstart", handleTouchStart);
      container.removeEventListener("touchmove", handleTouchMove);
      container.removeEventListener("touchend", handleTouchEnd);
    };
  }, []); // stable — no deps needed, refs handle mutable values

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

  const tryOpenOrderWithGlobalGate = useCallback(async (targetOrder) => {
    if (!targetOrder?.id) return;
    const currentSeq = extractOrderSequence(targetOrder.order_number);
    if (currentSeq <= 0) {
      setSelectedOrder(targetOrder);
      return;
    }

    const blockingStatuses = new Set(["intake"]);
    let remoteOrders = [];
    try {
      remoteOrders = await fetchTenantOrders();
    } catch {
      remoteOrders = [];
    }

    const merged = mergeOrders(remoteOrders, getUnsyncedLocalOrders(remoteOrders));
    const blockers = (merged || []).filter((ord) => {
      if (!ord || ord.deleted) return false; // órdenes borradas no bloquean
      if (String(ord.id || "") === String(targetOrder.id || "")) return false;
      const seq = extractOrderSequence(ord.order_number);
      if (seq <= 0 || seq >= currentSeq) return false;
        const st = getEffectiveOrderStatus(ord);
        return blockingStatuses.has(st);
    });

    if (blockers.length > 0) {
      const list = blockers
        .sort((a, b) => extractOrderSequence(a.order_number) - extractOrderSequence(b.order_number))
        .slice(0, 5)
        .map((b) => b.order_number || b.id)
        .join(", ");
      showGlobalGateToast(`Primero trabaja boletos anteriores en Recepcion (${list}).`);
      return;
    }

    setSelectedOrder(targetOrder);
  }, []);

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
      className="min-h-screen bg-[#0A0A0A] theme-light:bg-gray-50 pb-24 overflow-y-auto"
      style={{
        WebkitOverflowScrolling: "touch",
        paddingTop: "6px"
      }}
    >
      {/* Pull-to-refresh indicator */}
      {pullDistance > 0 && (
        <div 
          className="absolute top-0 left-0 right-0 flex justify-center py-2 z-50"
          style={{ transform: `translateY(${Math.min(pullDistance, 60)}px)` }}
        >
          <RefreshCw className={`w-6 h-6 text-cyan-400 ${pullDistance > 60 ? 'animate-spin' : ''}`} />
        </div>
      )}
      {/* Fondos animados flotantes */}
      <div className="fixed -top-40 -right-40 w-96 h-96 bg-cyan-500/10 rounded-full blur-[120px] animate-pulse pointer-events-none" />
      <div className="fixed -bottom-40 -left-40 w-96 h-96 bg-purple-500/10 rounded-full blur-[120px] animate-pulse delay-1000 pointer-events-none" />
      
      {/* Contenido */}
      <div className="max-w-[1920px] mx-auto px-3 sm:px-6 py-4 sm:py-6">
        {/* Header Sequoia Style - Sticky on Mobile (tabs + actions combined) */}
        <div className="relative sticky z-40 bg-[#0A0A0A]/80 backdrop-blur-2xl -mx-3 px-3 py-2 border-b border-white/[0.05] sm:relative sm:z-0 sm:bg-transparent sm:backdrop-blur-none sm:border-none sm:p-0 sm:mb-6"
          style={{ top: "0px" }}>
          {/* Row 1: Tabs */}
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="bg-white/5 border border-white/10 p-1 rounded-2xl w-full grid grid-cols-2 gap-1 shadow-lg">
              <TabsTrigger
                value="work-orders"
                className="rounded-xl text-[11px] sm:text-[13px] font-black tracking-tight data-[state=active]:bg-white data-[state=active]:text-black text-white/50 transition-all duration-300"
              >
                Órdenes
              </TabsTrigger>
              <TabsTrigger
                value="unlocks"
                className="rounded-xl text-[11px] sm:text-[13px] font-black tracking-tight data-[state=active]:bg-violet-500 data-[state=active]:text-white text-white/50 transition-all duration-300"
              >
                Desbloqueo
              </TabsTrigger>
            </TabsList>
          </Tabs>

          {/* Row 2: Mobile-only compact action row */}
          <div className="flex items-center gap-2 mt-2 sm:hidden">
            <button
              onClick={() => loadOrders()}
              className="w-9 h-9 rounded-full bg-white/5 border border-white/10 flex items-center justify-center text-white/60 active:scale-95"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
            <button
              onClick={() => setShowStatusDropdown(!showStatusDropdown)}
              className={`flex-1 h-9 px-3 rounded-full text-xs font-bold border flex items-center gap-2 ${
                selectedStatus === "active" && !showB2BOnly
                  ? "bg-gradient-to-r from-cyan-500/30 to-blue-500/30 border-cyan-400/50 text-cyan-200"
                  : "bg-white/5 border-white/15 text-white/70"
              }`}
            >
              <Filter className="w-3.5 h-3.5 flex-shrink-0" />
              <span className="truncate">
                {showB2BOnly ? "B2B" :
                  selectedStatus === "active" ? `Todos (${displayOrders.length})` :
                  selectedStatus === "closed" ? "Cerrados" :
                  ORDER_STATUSES.find((s) => s.id === selectedStatus)?.label || "Filtros"}
              </span>
            </button>
            <Button
              onClick={openQuickOrderModal}
              className="h-9 px-3 rounded-full text-xs font-bold bg-gradient-to-r from-blue-600 to-cyan-500 text-white border border-cyan-300/40 whitespace-nowrap"
            >
              <FilePlus className="w-4 h-4 mr-1" />
              Nueva
            </Button>
          </div>

          {/* Mobile dropdown panel */}
          <AnimatePresence>
            {showStatusDropdown && (
              <motion.div
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.15 }}
                className="sm:hidden absolute top-full left-0 right-0 bg-[#0A0A0A]/97 backdrop-blur-2xl border-x border-b border-white/10 rounded-b-[20px] shadow-[0_20px_60px_rgba(0,0,0,0.6)] z-50 max-h-[65vh] overflow-y-auto"
              >
                <div className="p-3 space-y-1">
                  <button
                    onClick={() => { setShowStatusDropdown(false); openQuickOrderModal(); }}
                    className="w-full px-4 py-3 rounded-[14px] text-left text-sm font-bold flex items-center gap-3 bg-gradient-to-r from-blue-500/20 to-cyan-500/20 border border-blue-400/30 text-white"
                  >
                    <Plus className="w-4 h-4" /> Nueva Orden
                  </button>
                  <div className="h-px bg-white/10 my-2" />
                  <p className="text-[10px] font-black text-white/30 uppercase tracking-wider px-3 pb-1">Estado</p>
                  {[{ id: "active", label: "Todos (Activos)" }, ...ORDER_STATUSES.filter(s => s.isActive && !["picked_up","completed","cancelled","delivered","warranty"].includes(s.id)), { id: "closed", label: "Cerrados / Historial" }].map(s => (
                    <button
                      key={s.id}
                      onClick={() => { setSelectedStatus(s.id); setShowStatusDropdown(false); }}
                      className={`w-full px-4 py-2.5 rounded-[14px] text-left text-sm font-bold flex items-center justify-between transition-all ${
                        selectedStatus === s.id ? "bg-white/10 text-white border border-white/20" : "text-white/60 hover:bg-white/5 hover:text-white"
                      }`}
                    >
                      <span>{s.label}</span>
                      <span className="text-xs bg-white/10 px-2 py-0.5 rounded-full">{statusCounts[s.id] || 0}</span>
                    </button>
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Search & Actions Bar - Desktop only full version */}
        <div className="flex flex-col gap-4 mb-8">
          {/* Título y acciones */}
          <div className="hidden sm:flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <h1 className="text-3xl font-bold text-white tracking-tight">
                Órdenes
              </h1>

              <button
                onClick={() => loadOrders()}
                className="w-10 h-10 sm:w-11 sm:h-11 rounded-full bg-gradient-to-br from-white/10 to-white/5 hover:from-white/15 hover:to-white/10 border border-white/10 flex items-center justify-center text-white/70 hover:text-white transition-all duration-300 active:scale-95 shadow-lg">

                <RefreshCw className={`w-4 h-4 sm:w-5 sm:h-5 ${loading ? 'animate-spin' : ''}`} />
              </button>

              {/* Dropdown de Filtros Centralizado (Todos los filtros en uno) */}
              <div className="relative">
                <button
                  onClick={() => setShowStatusDropdown(!showStatusDropdown)}
                  className={`h-10 sm:h-11 px-4 sm:px-5 rounded-full text-sm font-bold whitespace-nowrap transition-all duration-300 border flex items-center gap-2 ${
                  showB2BOnly ?
                  "bg-gradient-to-r from-purple-500 to-pink-500 text-white border-purple-400 shadow-[0_0_25px_rgba(168,85,247,0.5)]" :
                  selectedStatus !== "active" ?
                  "bg-gradient-to-r from-purple-500 to-pink-500 text-white border-purple-400 shadow-[0_0_20px_rgba(168,85,247,0.4)]" :
                  "bg-white/[0.06] text-white/60 border-white/10 hover:bg-white/10 hover:text-white/80"}`
                  }>

                  <Filter className="w-4 h-4" />
                  <span className="hidden xs:inline">
                    {showB2BOnly ? "B2B" :
                    selectedStatus === "active" ? "Todos" :
                    selectedStatus === "closed" ? "Cerrados" :
                    ORDER_STATUSES.find((s) => s.id === selectedStatus)?.label || "Filtros"}
                  </span>
                  <span className="px-2 py-1 rounded-full text-xs font-black bg-white/20">
                    {displayOrders.length}
                  </span>
                  <ChevronRight className={`w-4 h-4 transition-transform duration-300 ${showStatusDropdown ? 'rotate-90' : ''}`} />
                </button>

                {/* Dropdown Panel - Con opción B2B integrada */}
                <AnimatePresence>
                  {showStatusDropdown &&
                  <motion.div
                    initial={{ opacity: 0, y: -10, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: -10, scale: 0.95 }}
                    transition={{ duration: 0.2 }}
                    className="absolute top-full right-0 sm:left-0 mt-2 w-[calc(100vw-2rem)] sm:w-80 max-w-sm bg-[#0A0A0A]/95 backdrop-blur-2xl border border-white/10 rounded-[24px] shadow-[0_20px_60px_rgba(0,0,0,0.5)] overflow-hidden z-50">

                      <div className="p-3 space-y-1 max-h-[520px] overflow-y-auto scrollbar-thin">
                        {/* Acciones Rápidas */}
                        <div className="mb-3">
                          <p className="text-xs font-bold text-white/40 uppercase tracking-wider px-4 mb-2">Acciones</p>
                          
                          <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setShowStatusDropdown(false);
                            setShowQuickModal(true);
                          }}
                          className="w-full px-4 py-3 rounded-[16px] text-left text-sm font-bold transition-all duration-200 flex items-center gap-3 bg-gradient-to-r from-blue-500/20 to-cyan-500/20 border border-blue-400/30 text-white hover:from-blue-500/30 hover:to-cyan-500/30">

                            <Plus className="w-4 h-4" />
                            <span>Nueva Orden</span>
                          </button>

                          <button
                          onClick={() => {
                            setShowCreateInvoice(true);
                            setShowStatusDropdown(false);
                          }}
                          className="w-full px-4 py-3 rounded-[16px] text-left text-sm font-bold transition-all duration-200 flex items-center gap-3 text-white/70 hover:bg-white/5 hover:text-white">

                            <FileText className="w-4 h-4" />
                            <span>Crear Factura</span>
                          </button>


                        </div>

                        <div className="h-px bg-white/10 my-2" />

                        {/* Filtros */}
                        <p className="text-xs font-bold text-white/40 uppercase tracking-wider px-4 mb-2 mt-3">Filtros</p>

                        {/* Toggle B2B */}
                        <button
                        onClick={() => {
                          setShowB2BOnly(!showB2BOnly);
                        }}
                        className={`w-full px-4 py-3 rounded-[16px] text-left text-sm font-bold transition-all duration-200 flex items-center justify-between ${
                        showB2BOnly ?
                        "bg-gradient-to-r from-purple-500/20 to-pink-500/20 border border-purple-400/30 text-white" :
                        "text-white/70 hover:bg-white/5 hover:text-white"}`
                        }>

                          <div className="flex items-center gap-2">
                            <Building2 className="w-4 h-4" />
                            <span>Solo B2B</span>
                          </div>
                          <div className={`w-5 h-5 rounded-full flex items-center justify-center ${showB2BOnly ? 'bg-purple-400/30' : 'bg-white/10'}`}>
                            {showB2BOnly && <div className="w-2 h-2 rounded-full bg-purple-400" />}
                          </div>
                        </button>

                        <div className="h-px bg-white/10 my-2" />

                        {/* Todos (Activos) */}
                         <button
                         onClick={() => {
                           setSelectedStatus("active");
                           setShowStatusDropdown(false);
                         }}
                         className={`w-full px-4 py-3 rounded-[16px] text-left text-sm font-bold transition-all duration-200 flex items-center justify-between ${
                         selectedStatus === "active" ?
                         "bg-gradient-to-r from-cyan-500/20 to-blue-500/20 border border-cyan-400/30 text-white" :
                         "text-white/70 hover:bg-white/5 hover:text-white"}`
                         }>

                           <span>Todos (Activos)</span>
                           <span className={`px-2 py-1 rounded-full text-xs font-black ${selectedStatus === "active" ? 'bg-cyan-400/20 text-cyan-300' : 'bg-white/10 text-white/50'}`}>
                             {statusCounts["active"] || 0}
                           </span>
                         </button>

                         {/* Garantías */}
                         <button
                         onClick={() => {
                           setSelectedStatus("warranty");
                           setShowStatusDropdown(false);
                         }}
                         className={`w-full px-4 py-3 rounded-[16px] text-left text-sm font-bold transition-all duration-200 flex items-center justify-between ${
                         selectedStatus === "warranty" ?
                         "bg-gradient-to-r from-amber-500/20 to-orange-500/20 border border-amber-400/30 text-white" :
                         "text-white/70 hover:bg-white/5 hover:text-white"}`
                         }>

                           <div className="flex items-center gap-2">
                             <Shield className="w-4 h-4" />
                             <span>Garantías</span>
                           </div>
                           <span className={`px-2 py-1 rounded-full text-xs font-black ${selectedStatus === "warranty" ? 'bg-amber-400/20 text-amber-300' : 'bg-white/10 text-white/50'}`}>
                             {statusCounts["warranty"] || 0}
                           </span>
                         </button>

                        {/* Ver Alertas Prioritarias */}
                        <button
                        onClick={() => {
                          setShowPendingAlerts(true);
                          setShowStatusDropdown(false);
                        }}
                        className="w-full px-4 py-3 rounded-[16px] text-left text-sm font-bold transition-all duration-200 flex items-center gap-3 text-white/70 hover:bg-white/5 hover:text-white">

                          <AlertCircle className="w-4 h-4" />
                          <span>Ver Alertas Prioritarias</span>
                        </button>

                        <div className="h-px bg-white/10 my-2" />

                        {/* Estados individuales */}
                        {ORDER_STATUSES.filter((s) => s.isActive).map((status) => {
                        const count = statusCounts[status.id] || 0;
                        const isClosedStatus = ["picked_up", "completed", "cancelled", "delivered", "warranty"].includes(status.id);
                        if (isClosedStatus) return null;

                        return (
                          <button
                            key={status.id}
                            onClick={() => {
                              setSelectedStatus(status.id);
                              setShowStatusDropdown(false);
                            }}
                            disabled={count === 0}
                            className={`w-full px-4 py-3 rounded-[16px] text-left text-sm font-bold transition-all duration-200 flex items-center justify-between ${
                            selectedStatus === status.id ?
                            "bg-gradient-to-r from-blue-500/20 to-purple-500/20 border border-blue-400/30 text-white" :
                            count === 0 ?
                            "text-white/30 cursor-not-allowed" :
                            "text-white/70 hover:bg-white/5 hover:text-white"}`
                            }>

                              <span>{status.label}</span>
                              {count > 0 &&
                            <span className={`px-2 py-1 rounded-full text-xs font-black ${selectedStatus === status.id ? 'bg-blue-400/20 text-blue-300' : 'bg-white/10 text-white/50'}`}>
                                  {count}
                                </span>
                            }
                            </button>);

                      })}

                        <div className="h-px bg-white/10 my-2" />

                        {/* Cerrados / Historial */}
                        <button
                        onClick={() => {
                          setSelectedStatus("closed");
                          setShowStatusDropdown(false);
                        }}
                        className={`w-full px-4 py-3 rounded-[16px] text-left text-sm font-bold transition-all duration-200 flex items-center justify-between ${
                        selectedStatus === "closed" ?
                        "bg-gradient-to-r from-purple-500/20 to-pink-500/20 border border-purple-400/30 text-white" :
                        "text-white/70 hover:bg-white/5 hover:text-white"}`
                        }>

                          <span>Cerrados / Historial</span>
                          <span className={`px-2 py-1 rounded-full text-xs font-black ${selectedStatus === "closed" ? 'bg-purple-400/20 text-purple-300' : 'bg-white/10 text-white/50'}`}>
                            {statusCounts["closed"] || 0}
                          </span>
                        </button>
                      </div>
                    </motion.div>
                  }
                </AnimatePresence>
              </div>

              <Button
                onClick={openQuickOrderModal}
                className="h-10 sm:h-11 px-3 sm:px-5 rounded-full text-sm font-bold whitespace-nowrap bg-gradient-to-r from-blue-600 to-cyan-500 hover:from-blue-500 hover:to-cyan-400 border border-cyan-300/40 text-white shadow-[0_0_18px_rgba(34,211,238,0.35)]"
              >
                <FilePlus className="w-5 h-5 sm:mr-2" />
                <span className="hidden sm:inline">Nueva Orden</span>
              </Button>



            </div>
          </div>

          {/* Búsqueda estilo Sequoia */}
          <div className="relative group/search">
            <div className="absolute inset-y-0 left-0 pl-5 flex items-center pointer-events-none">
              <Search className="h-5 w-5 text-white/20 group-focus-within/search:text-cyan-400 group-focus-within/search:scale-110 transition-all duration-500" />
            </div>
            <input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Buscar por cliente, #orden, teléfono..." 
              className="bg-[#121215]/40 text-white pr-14 pl-14 py-5 text-base rounded-[24px] block w-full border border-white/10 placeholder-white/20 focus:outline-none focus:ring-4 focus:ring-cyan-500/10 focus:border-cyan-500/40 focus:bg-[#121215]/80 transition-all duration-500 backdrop-blur-2xl shadow-[inset_0_2px_10px_rgba(0,0,0,0.2)]" 
            />

            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className="absolute right-4 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-white/5 hover:bg-white/10 text-white/40 hover:text-white flex items-center justify-center transition-all active:scale-95 border border-white/10"
              >
                <X className="w-4 h-4" />
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

            {/* Grid de órdenes con animaciones */}
            <motion.div
              layout
              className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-3 md:gap-4"
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
          <WorkOrderPanelErrorBoundary onClose={() => setSelectedOrder(null)} onReset={() => setSelectedOrder(null)}>
          <WorkOrderPanel
          orderId={selectedOrder.id}
          onClose={() => {
            setSelectedOrder(null);
          }}
          onUpdate={handleOrderUpdated}
          onDelete={(deletedOrderId) => {
            console.log("[Orders] Orden eliminada:", deletedOrderId);
            setSelectedOrder(null);
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
            if (newOrder.id) setSelectedOrderId(newOrder.id);
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
