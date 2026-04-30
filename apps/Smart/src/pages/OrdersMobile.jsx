// ============================================
// 📱 ORDERS MOBILE - Diseño minimalista iOS
// ============================================

import React, { useState, useEffect, useMemo } from "react";
import { dataClient } from "@/components/api/dataClient";
import { getLocalOrders, getUnsyncedLocalOrders, mergeOrders } from "@/components/utils/localOrderCache";
import { useNavigate, useLocation } from "react-router-dom";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Search, SlidersHorizontal, ChevronDown, Calendar as CalendarIcon, Bot, User, ListOrdered } from "lucide-react";
import OrdersQueueSidebar from "@/components/orders/OrdersQueueSidebar";
import { Drawer, DrawerContent, DrawerTitle } from "@/components/ui/drawer";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { toast } from "sonner";
import { useI18n } from "@/components/utils/i18n";
import { createPageUrl } from "@/components/utils/helpers";
import { getEffectiveOrderStatus, getStatusConfig, normalizeStatusId, ORDER_STATUSES } from "@/components/utils/statusRegistry";
import WorkOrderPanel from "../components/workorder/WorkOrderPanel";
import WorkOrderPanelErrorBoundary from "../components/workorder/WorkOrderPanelErrorBoundary";

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
        } max-w-[92vw] rounded-2xl border border-white/20 bg-white/10 backdrop-blur-2xl shadow-[0_18px_60px_rgba(0,0,0,0.45)] p-3`}
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

export default function OrdersMobile() {
  const { t } = useI18n();
  const navigate = useNavigate();
  const location = useLocation();
  
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedStatus, setSelectedStatus] = useState(null);
  const [showFilters, setShowFilters] = useState(false);
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [selectedOrderId, setSelectedOrderId] = useState(null);
  // Bottom sheet con la cola de trabajo (paridad con el sidebar del iPad).
  // Por defecto cerrado en iPhone para no quitar pantalla; se abre con el
  // botón "Cola" del header.
  const [showQueueSheet, setShowQueueSheet] = useState(false);

  useEffect(() => {
    loadOrders();
  }, []);

  // Abrir orden específica cuando viene desde POS (post-pago)
  useEffect(() => {
    try {
      const params = new URLSearchParams(location.search);
      const openOrderId = params.get("openOrderId");
      if (openOrderId) setSelectedOrderId(openOrderId);
    } catch {}
  }, [location.search]);

  const loadOrders = async () => {
    setLoading(true);
    try {
      const list = await dataClient.entities.Order.list("-updated_date", 200);
      const remoteOrders = Array.isArray(list) ? list : [];
      setOrders(mergeOrders(remoteOrders, getUnsyncedLocalOrders(remoteOrders)));
    } catch (err) {
      console.error("Error loading orders:", err);
      setOrders(getLocalOrders());
    } finally {
      setLoading(false);
    }
  };

  const filteredOrders = useMemo(() => {
    let result = orders;

    // Filtrar por estado
    if (selectedStatus) {
      result = result.filter(o => getEffectiveOrderStatus(o) === selectedStatus);
    }

    // Filtrar por búsqueda
    const q = searchTerm.trim().toLowerCase();
    if (q) {
      result = result.filter(o =>
        String(o.customer_name || "").toLowerCase().includes(q) ||
        String(o.order_number || "").toLowerCase().includes(q) ||
        String(o.device_model || "").toLowerCase().includes(q)
      );
    }

    // Filtrar por fechas
    if (dateFrom) {
      const from = new Date(dateFrom);
      result = result.filter(o => new Date(o.created_date) >= from);
    }
    if (dateTo) {
      const to = new Date(dateTo);
      to.setHours(23, 59, 59);
      result = result.filter(o => new Date(o.created_date) <= to);
    }

    // Ordenar: más nuevo primero (número de orden mayor primero)
    result = [...result].sort((a, b) => {
      const seqA = extractOrderSequence(a.order_number);
      const seqB = extractOrderSequence(b.order_number);
      if (seqA !== 0 && seqB !== 0) return seqB - seqA;
      const dateA = a.created_date || a.created_at || "";
      const dateB = b.created_date || b.created_at || "";
      return dateB.localeCompare(dateA);
    });

    return result;
  }, [orders, searchTerm, selectedStatus, dateFrom, dateTo]);

  // Agrupar por fecha (grupos ordenados de más reciente a más antiguo)
  const groupedOrders = useMemo(() => {
    const groups = {};
    filteredOrders.forEach(order => {
      const dateKey = format(new Date(order.created_date), "d MMM, yyyy", { locale: es });
      if (!groups[dateKey]) groups[dateKey] = [];
      groups[dateKey].push(order);
    });
    // Ordenar las claves de fecha de más reciente a más antigua
    return Object.fromEntries(
      Object.entries(groups).sort(([a], [b]) => {
        const da = new Date(a); const db = new Date(b);
        return db - da;
      })
    );
  }, [filteredOrders]);

  const handleOrderClick = async (order) => {
    const target = order || {};
    if (!target?.id) return;

    const currentSeq = extractOrderSequence(target.order_number);
    if (currentSeq > 0) {
      const blockingStatuses = new Set(["intake"]);
      let remoteOrders = [];
      try {
        const list = await dataClient.entities.Order.list("-created_date", 600);
        const normalizedRemoteOrders = Array.isArray(list) ? list : [];
        remoteOrders = mergeOrders(normalizedRemoteOrders, getUnsyncedLocalOrders(normalizedRemoteOrders));
      } catch {
        remoteOrders = mergeOrders(orders || [], getUnsyncedLocalOrders(orders || []));
      }

      const blockers = (remoteOrders || []).filter((ord) => {
        if (!ord || ord.deleted) return false; // órdenes borradas no bloquean
        if (String(ord.id || "") === String(target.id || "")) return false;
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
    }

    setSelectedOrderId(target.id);
  };

  const activeStatuses = ORDER_STATUSES.filter(s => s.isActive);

  return (
    <div className="min-h-dvh apple-surface apple-type pb-20 overscroll-none" style={{ overscrollBehavior: "none" }}>
      {/* ── Header estilo iOS: large title + acciones ───────────────── */}
      <div
        className="sticky top-0 z-20 apple-surface-secondary px-4 pt-2 pb-3 border-b border-[rgb(var(--separator)/0.29)]"
        style={{ paddingTop: "calc(env(safe-area-inset-top, 0px) + 8px)" }}
      >
        <div className="flex items-center justify-between gap-3 mb-3">
          <h1 className="apple-text-large-title apple-label-primary">Órdenes</h1>
          <div className="flex items-center gap-2">
            <button
              onClick={() => navigate(createPageUrl("Orders/new"))}
              className="apple-btn apple-btn-primary text-[15px] min-h-9 px-3.5"
            >
              <span className="text-lg leading-none font-light">+</span>
              <span>Nueva</span>
            </button>
            <button
              onClick={() => document.querySelector('.orders-chatbot-trigger')?.click()}
              className="apple-press w-9 h-9 rounded-full bg-apple-blue/15 flex items-center justify-center text-apple-blue"
              aria-label="Asistente"
            >
              <Bot className="w-[18px] h-[18px]" />
            </button>
          </div>
        </div>

        {/* ── Búsqueda ─── */}
        <div className="relative mb-3">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-[18px] h-[18px] apple-label-tertiary pointer-events-none" />
          <Input
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Buscar por cliente o número"
            className="apple-input pl-10 border-0"
          />
        </div>

        {/* ── Filtros Rápidos (segmented-style chips) ─── */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar apple-scroll-snap-x -mx-1 px-1">
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`apple-press flex-shrink-0 px-3.5 h-9 rounded-full apple-text-footnote font-medium flex items-center gap-1.5 transition-colors ${
              showFilters
                ? "bg-apple-blue text-white"
                : "bg-gray-sys6 dark:bg-gray-sys5 apple-label-secondary"
            }`}
          >
            <SlidersHorizontal className="w-3.5 h-3.5" />
            Filtros
          </button>

          {activeStatuses.map(status => {
            const count = orders.filter(o => getEffectiveOrderStatus(o) === status.id).length;
            const isSelected = selectedStatus === status.id;

            return (
              <button
                key={status.id}
                onClick={() => setSelectedStatus(isSelected ? null : status.id)}
                disabled={count === 0}
                className={`apple-press flex-shrink-0 px-3.5 h-9 rounded-full apple-text-footnote font-medium whitespace-nowrap transition-colors disabled:opacity-30 ${
                  isSelected
                    ? "bg-apple-blue text-white"
                    : status.id === "pending_order" && count > 0
                    ? "bg-apple-red/15 text-apple-red"
                    : "bg-gray-sys6 dark:bg-gray-sys5 apple-label-secondary"
                }`}
              >
                {status.label} <span className="opacity-60 tabular-nums">({count})</span>
              </button>
            );
          })}
        </div>

        {/* ── Panel de Filtros Expandible ─── */}
        {showFilters && (
          <div className="mt-3 apple-card p-3 space-y-2 animate-apple-slide-up">
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <label className="apple-text-caption1 apple-label-secondary px-1">Desde</label>
                <Input
                  type="date"
                  value={dateFrom}
                  onChange={(e) => setDateFrom(e.target.value)}
                  className="apple-input border-0 py-2 text-sm"
                />
              </div>
              <div className="space-y-1">
                <label className="apple-text-caption1 apple-label-secondary px-1">Hasta</label>
                <Input
                  type="date"
                  value={dateTo}
                  onChange={(e) => setDateTo(e.target.value)}
                  className="apple-input border-0 py-2 text-sm"
                />
              </div>
            </div>
            <button
              onClick={() => {
                setDateFrom("");
                setDateTo("");
                setSelectedStatus(null);
                setSearchTerm("");
              }}
              className="apple-btn apple-btn-plain mx-auto"
            >
              Limpiar filtros
            </button>
          </div>
        )}
      </div>

      {/* ── Lista de Órdenes agrupadas por día ─────────────────────── */}
      <div className="px-4 pt-4 space-y-5">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="animate-spin w-7 h-7 border-2 border-apple-blue border-t-transparent rounded-full" />
          </div>
        ) : Object.keys(groupedOrders).length === 0 ? (
          <div className="text-center py-20 space-y-2">
            <div className="mx-auto w-14 h-14 rounded-full bg-gray-sys6 dark:bg-gray-sys5 flex items-center justify-center">
              <Search className="w-6 h-6 apple-label-tertiary" />
            </div>
            <p className="apple-text-callout apple-label-secondary">{t('noOrdersFound')}</p>
          </div>
        ) : (
          Object.entries(groupedOrders).map(([dateKey, dateOrders]) => (
            <div key={dateKey} className="space-y-2">
              <h3 className="apple-text-footnote apple-label-secondary font-medium px-1 tracking-wide">{dateKey}</h3>
              <div className="apple-list">
                {dateOrders.map(order => {
                  const statusConfig = getStatusConfig(getEffectiveOrderStatus(order));
                  const assignedLabel = String(order.assigned_to_name || order.assigned_to || "").trim();
                  const isAssigned = Boolean(assignedLabel);

                  return (
                    <div
                      key={order.id}
                      onClick={() => handleOrderClick(order)}
                      className="apple-list-row !min-h-0 !py-3.5 cursor-pointer apple-press"
                    >
                      {/* Icono dispositivo */}
                      <div className="w-10 h-10 rounded-apple-sm bg-apple-blue/15 text-apple-blue flex items-center justify-center flex-shrink-0">
                        <span className="text-[18px]">📱</span>
                      </div>

                      {/* Contenido principal */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0 flex-1">
                            <p className="apple-text-headline apple-label-primary truncate">
                              {order.customer_name || "Sin nombre"}
                            </p>
                            <p className="apple-text-footnote apple-label-secondary truncate tabular-nums">
                              {order.order_number} · {order.device_model || order.device_brand || order.device_type || "Dispositivo"}
                            </p>
                          </div>
                          <div className="text-right flex-shrink-0">
                            <p className="apple-text-caption1 apple-label-tertiary tabular-nums">
                              {format(new Date(order.created_date), "h:mm a", { locale: es })}
                            </p>
                            <p className="apple-text-footnote font-semibold text-apple-green tabular-nums mt-0.5">
                              ${(order.cost_estimate || 0).toFixed(2)}
                            </p>
                          </div>
                        </div>

                        {/* Badges de status + asignado */}
                        <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                          <Badge className={`${statusConfig.colorClasses} text-[10px] px-2 py-0.5 border-0 rounded-full`}>
                            {statusConfig.label}
                          </Badge>
                          <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium ${
                            isAssigned
                              ? "bg-apple-green/15 text-apple-green"
                              : "bg-apple-orange/15 text-apple-orange"
                          }`}>
                            <User className="w-3 h-3" />
                            {isAssigned ? assignedLabel : "Sin asignar"}
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))
        )}
      </div>

      {/* Panel de Orden Seleccionada */}
      {selectedOrderId && (
        <div className="fixed inset-0 z-[60] bg-black/60 backdrop-blur-sm">
          <WorkOrderPanelErrorBoundary onClose={() => setSelectedOrderId(null)} onReset={() => setSelectedOrderId(null)}>
          <WorkOrderPanel
            orderId={selectedOrderId}
            onClose={() => setSelectedOrderId(null)}
            onUpdate={() => {
              setSelectedOrderId(null);
              loadOrders();
            }}
            onDelete={() => {
              setSelectedOrderId(null);
              loadOrders();
            }}
          />
          </WorkOrderPanelErrorBoundary>
        </div>
      )}

    </div>
  );
}
