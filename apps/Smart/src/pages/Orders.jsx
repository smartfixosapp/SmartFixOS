import React, { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { dataClient } from "@/components/api/dataClient";
import { supabase } from "../../../../lib/supabase-client.js";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Search, Plus, Filter, X, Smartphone, Laptop, Tablet,
  Watch, Gamepad2, Camera, Box, Clock, AlertCircle, CheckCircle2,
  Package, Zap, User, Phone, Calendar, ChevronRight, Grid3X3,
  List, RefreshCw, Eye, Building2, FileText, Shield } from
"lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { es } from "date-fns/locale";
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

import RechargesPanel from "@/components/recharges/RechargesPanel";
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
  let tenantId = null;
  try {
    const rawSession =
      localStorage.getItem("employee_session") ||
      sessionStorage.getItem("911-session");
    if (rawSession) {
      const session = JSON.parse(rawSession);
      tenantId = session?.tenant_id || null;
    }
  } catch {
    tenantId = null;
  }

  tenantId =
    tenantId ||
    localStorage.getItem("smartfix_tenant_id") ||
    localStorage.getItem("current_tenant_id") ||
    null;

  let query = supabase
    .from("order")
    .select("*")
    .order("created_date", { ascending: false })
    .limit(600);

  if (tenantId) {
    query = query.eq("tenant_id", tenantId);
  }

  const { data, error } = await query;
  if (error) throw error;
  return Array.isArray(data) ? data : [];
}

const OrderCard = React.memo(function OrderCard({ order, onClick, onEditDevice }) {
  // Verificación defensiva: no renderizar si faltan datos críticos
  if (!order || !order.id) {
    return null;
  }
  
  const deviceType = resolveDeviceType(order);
  const DeviceIcon = DEVICE_ICONS[deviceType] || Box;
  const effectiveStatus = getEffectiveOrderStatus(order);
  const statusConfig = getStatusConfig(effectiveStatus);
  const isB2B = order.company_id || order.company_name;

  const deviceInfo = [
  order.device_brand,
  order.device_family,
  order.device_model].
  filter(Boolean).join(" ");

  const taskCount = Array.isArray(order.checklist_items) ? order.checklist_items.length : 0;
  const photoCount = Array.isArray(order.photos_metadata) ? order.photos_metadata.length :
  Array.isArray(order.device_photos) ? order.device_photos.length : 0;
  const assignedLabel = String(order.assigned_to_name || order.assigned_to || "").trim();
  const isAssigned = Boolean(assignedLabel);

  return (
    <motion.div
      role="button"
      tabIndex={0}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95 }}
      transition={{ duration: 0.3 }}
      onClick={onClick}
      onKeyDown={(e) => e.key === 'Enter' && onClick()}
      className={`group w-full text-left bg-gradient-to-br from-slate-900/95 to-slate-950/90 hover:from-slate-800/95 hover:to-slate-900/90 backdrop-blur-xl border rounded-[28px] p-6 transition-all duration-500 hover:scale-[1.02] hover:-translate-y-1 active:scale-95 shadow-xl hover:shadow-2xl relative overflow-hidden cursor-pointer ${
      isB2B ?
      "border-purple-500/50 hover:border-purple-500/70 hover:shadow-purple-500/40" :
      "border-cyan-500/50 hover:border-cyan-500/70 hover:shadow-cyan-500/35"}`
      }>

      {/* Fondo animado vibrante */}
      <div className={`absolute -right-16 -top-16 w-32 h-32 rounded-full blur-3xl opacity-0 group-hover:opacity-100 transition-all duration-500 ${
      isB2B ? "bg-gradient-to-br from-purple-500/30 to-pink-500/20" : "bg-gradient-to-br from-blue-500/30 to-cyan-500/20"}`
      } />
      {/* Glossy shine */}
      <div className="absolute inset-0 bg-gradient-to-br from-white/10 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none" />

      {/* Badge de Garantía */}
       {(effectiveStatus === "warranty" || (effectiveStatus === "ready_for_pickup" && order.warranty_countdown?.days_remaining > 0)) && (
         <div className="absolute top-3 right-3 z-20 bg-gradient-to-r from-amber-500 to-orange-500 px-3 py-1.5 rounded-full flex items-center gap-1.5 shadow-lg">
           <Shield className="w-4 h-4 text-white" />
           <span className="text-xs font-bold text-white">Garantía</span>
         </div>
       )}

      <div className="flex items-start gap-4 relative z-10">
        {/* Icono del dispositivo */}
        <div className={`flex-shrink-0 w-14 h-14 rounded-[20px] flex items-center justify-center shadow-xl transition-all duration-300 group-hover:scale-110 group-hover:rotate-3 bg-gradient-to-br ${
        isB2B ?
        "from-purple-500 to-pink-500" :
        "from-blue-500 to-cyan-500"}`
        }>
          <DeviceIcon className="w-7 h-7 text-white" strokeWidth={2.5} />
        </div>

        {/* Contenido principal */}
        <div className="flex-1 min-w-0">
          {/* Badge de estado arriba */}
          <div className="mb-2">
            <span className={`inline-block px-2.5 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wide border ${statusConfig.colorClasses} bg-opacity-10 border-opacity-20`}>
              {statusConfig.label}
            </span>
          </div>
          
          {/* Header con nombre destacado */}
	          <div className="mb-1.5">
	            <h3 className="font-bold text-lg text-white truncate group-hover:text-white transition-colors leading-tight">
	              {order.customer_name || "Cliente"}
	              {isB2B && <span className="ml-2 text-purple-400">🏢</span>}
	            </h3>
	            <p className="text-[11px] text-white/50 font-medium tracking-wide mt-0.5">
	              {order.order_number || "WO-LOCAL"}
	            </p>
              <div className="mt-1">
                <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold ${
                  isAssigned
                    ? "border-emerald-400/35 bg-emerald-500/12 text-emerald-200"
                    : "border-amber-400/35 bg-amber-500/12 text-amber-200"
                }`}>
                  <User className="w-3 h-3" />
                  {isAssigned ? `Asignado: ${assignedLabel}` : "Sin asignar"}
                </span>
              </div>
	          </div>

          {/* Dispositivo */}
          <div className="flex items-center gap-2 mb-3 group/device">
            <p className="text-sm text-white/70 truncate font-medium flex-1">
              {deviceInfo || order.device_type || "Sin info"}
            </p>
            <button
              onClick={(e) => {
                e.stopPropagation();
                onEditDevice(order);
              }}
              className="opacity-0 group-hover/device:opacity-100 transition-opacity text-cyan-400/60 hover:text-cyan-300 text-xs px-2 py-1 rounded bg-cyan-500/10 hover:bg-cyan-500/20"
            >
              Editar
            </button>
          </div>

          {/* Footer info */}
          <div className="flex items-center gap-3 pt-3 border-t border-white/5">
            <div className="flex items-center gap-1.5 text-white/40">
              <Clock className="w-3.5 h-3.5" />
              <span className="text-xs font-medium">
                {format(new Date(order.created_date || Date.now()), "d MMM", { locale: es })}
              </span>
            </div>
            
            {taskCount > 0 &&
            <div className="flex items-center gap-1 text-emerald-400/80">
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span className="text-xs font-bold">{taskCount}</span>
              </div>
            }
            
            {photoCount > 0 &&
            <div className="flex items-center gap-1 text-purple-400/80">
                <Camera className="w-3.5 h-3.5" />
                <span className="text-xs font-bold">{photoCount}</span>
              </div>
            }

            {/* Countdown Badge */}
            <CountdownBadge order={order} />

            <div className="ml-auto w-6 h-6 rounded-full bg-white/5 flex items-center justify-center group-hover:bg-white/10 transition-colors">
              <ChevronRight className="w-3.5 h-3.5 text-white/40 group-hover:text-white" />
            </div>
          </div>
        </div>
      </div>
    </motion.div>);

});

export default function OrdersPage() {
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
  const [activeTab, setActiveTab] = useState("work-orders"); // work-orders, quick-repairs, recharges, unlocks
  const [editingDeviceOrder, setEditingDeviceOrder] = useState(null);
  const [pullStart, setPullStart] = useState(0);
  const [pullDistance, setPullDistance] = useState(0);
  const containerRef = useRef(null);
  const ordersLoadInFlightRef = useRef(false);
  const ordersErrorToastShownRef = useRef(false);

  const openQuickOrderModal = useCallback(() => {
    setShowQuickModal(true);
    setShowStatusDropdown(false);
  }, []);

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

    window.addEventListener("force-refresh", handleRefresh);
    window.addEventListener("workorder-created", handleWorkorderCreated);
    window.addEventListener("workorder-deleted", handleWorkorderDeleted);

    return () => {
      window.removeEventListener("force-refresh", handleRefresh);
      window.removeEventListener("workorder-created", handleWorkorderCreated);
      window.removeEventListener("workorder-deleted", handleWorkorderDeleted);
    };
  }, [refreshTick]);

  // Pull-to-refresh handlers
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handleTouchStart = (e) => {
      if (container.scrollTop === 0) {
        setPullStart(e.touches[0].clientY);
      }
    };

    const handleTouchMove = (e) => {
      if (pullStart > 0) {
        const distance = e.touches[0].clientY - pullStart;
        if (distance > 0 && distance < 100) {
          setPullDistance(distance);
        }
      }
    };

    const handleTouchEnd = () => {
      if (pullDistance > 60) {
        window.dispatchEvent(new Event("force-refresh"));
        loadOrders();
      }
      setPullStart(0);
      setPullDistance(0);
    };

    container.addEventListener("touchstart", handleTouchStart);
    container.addEventListener("touchmove", handleTouchMove);
    container.addEventListener("touchend", handleTouchEnd);

    return () => {
      container.removeEventListener("touchstart", handleTouchStart);
      container.removeEventListener("touchmove", handleTouchMove);
      container.removeEventListener("touchend", handleTouchEnd);
    };
  }, [pullStart, pullDistance]);

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

    return result;
  }, [orders, selectedStatus, searchQuery, showB2BOnly]);

  const displayOrders = useMemo(() => {
    if (filteredOrders.length > 0) return filteredOrders;
    const hasSearch = Boolean(searchQuery?.trim());
    if (hasSearch) return filteredOrders;
    if ((orders || []).length === 0) return filteredOrders;
    return (orders || []).filter((o) => o && !o.deleted && o.id);
  }, [filteredOrders, orders, searchQuery]);

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
      if (!ord || String(ord.id || "") === String(targetOrder.id || "")) return false;
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
        paddingTop: "calc(env(safe-area-inset-top, 0px) + 6px)"
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
      <div className="max-w-[1920px] mx-auto px-3 sm:px-6 py-6">
        {/* Header Sequoia Style */}
        <div className="space-y-4 mb-6">
          {/* Tabs Navigation */}
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="bg-white/5 border border-white/10 p-1 rounded-[20px] w-full grid grid-cols-3 gap-1">
              <TabsTrigger 
                value="work-orders"
                className="rounded-[16px] text-sm font-bold data-[state=active]:bg-gradient-to-r data-[state=active]:from-cyan-500 data-[state=active]:to-blue-500 data-[state=active]:text-white text-white/60"
              >
                Órdenes
              </TabsTrigger>
              <TabsTrigger 
                value="recharges"
                className="rounded-[16px] text-sm font-bold data-[state=active]:bg-gradient-to-r data-[state=active]:from-amber-500 data-[state=active]:to-yellow-500 data-[state=active]:text-white text-white/60"
              >
                <Zap className="w-4 h-4 mr-1" />
                Recargas
              </TabsTrigger>
              <TabsTrigger 
                value="unlocks"
                className="rounded-[16px] text-sm font-bold data-[state=active]:bg-gradient-to-r data-[state=active]:from-emerald-500 data-[state=active]:to-green-500 data-[state=active]:text-white text-white/60"
              >
                Desbloqueo
              </TabsTrigger>
            </TabsList>
          </Tabs>
          {/* Título y acciones */}
          <div className="flex items-center justify-between gap-3">
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
                  selectedStatus === "active" && !showB2BOnly ?
                  "bg-gradient-to-r from-cyan-500 to-blue-500 text-white border-cyan-400 shadow-[0_0_20px_rgba(6,182,212,0.4)]" :
                  showB2BOnly ?
                  "bg-gradient-to-r from-purple-500 to-pink-500 text-white border-purple-400 shadow-[0_0_25px_rgba(168,85,247,0.5)]" :
                  "bg-gradient-to-r from-purple-500 to-pink-500 text-white border-purple-400 shadow-[0_0_20px_rgba(168,85,247,0.4)]"}`
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
                    className="absolute top-full right-0 sm:left-0 mt-2 w-80 bg-[#0A0A0A]/95 backdrop-blur-2xl border border-white/10 rounded-[24px] shadow-[0_20px_60px_rgba(0,0,0,0.5)] overflow-hidden z-50">

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
                className="h-10 sm:h-11 px-4 sm:px-5 rounded-full text-sm font-bold whitespace-nowrap bg-gradient-to-r from-blue-600 to-cyan-500 hover:from-blue-500 hover:to-cyan-400 border border-cyan-300/40 text-white shadow-[0_0_18px_rgba(34,211,238,0.35)]"
              >
                <Plus className="w-4 h-4 mr-2" />
                Nueva Orden
              </Button>



            </div>
          </div>

          {/* Búsqueda estilo Sequoia */}
          <div className="relative group">
            <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
              <Search className="h-5 w-5 text-gray-500 group-focus-within:text-cyan-400 transition-all duration-300" />
            </div>
            <input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Buscar por cliente, #orden, teléfono..." className="bg-slate-50 text-slate-900 pr-12 pl-12 py-4 text-base rounded-[20px] block w-full from-white/10 to-white/5 border border-white/10 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/50 focus:border-cyan-500/30 focus:from-white/15 focus:to-white/10 transition-all duration-300 backdrop-blur-xl shadow-inner" />


            {searchQuery &&
            <button
              onClick={() => setSearchQuery("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 w-7 h-7 rounded-full bg-white/10 hover:bg-white/20 text-white/60 hover:text-white flex items-center justify-center transition-all active:scale-95">

                <X className="w-4 h-4" />
              </button>
            }
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

        {/* Recharges Tab */}
        {activeTab === "recharges" && (
          <RechargesPanel />
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
          } else {
            loadOrders();
          }
          toast.success("✅ Orden creada");
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
