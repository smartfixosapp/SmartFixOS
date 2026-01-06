// ============================================
// 📱 ORDERS MOBILE - Diseño minimalista iOS
// ============================================

import React, { useState, useEffect, useMemo } from "react";
import { dataClient } from "@/components/api/dataClient";
import { useNavigate, useLocation } from "react-router-dom";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Search, SlidersHorizontal, ChevronDown, Calendar as CalendarIcon, Bot } from "lucide-react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { useI18n } from "@/components/utils/i18n";
import { createPageUrl } from "@/components/utils/helpers";
import { getStatusConfig, normalizeStatusId, ORDER_STATUSES } from "@/components/utils/statusRegistry";
import WorkOrderPanel from "../components/workorder/WorkOrderPanel";
import OrdersChatbot from "../components/orders/OrdersChatbot";

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

  useEffect(() => {
    loadOrders();
  }, []);

  const loadOrders = async () => {
    setLoading(true);
    try {
      const list = await dataClient.entities.Order.list("-updated_date", 200);
      setOrders(list || []);
    } catch (err) {
      console.error("Error loading orders:", err);
    } finally {
      setLoading(false);
    }
  };

  const filteredOrders = useMemo(() => {
    let result = orders;

    // Filtrar por estado
    if (selectedStatus) {
      result = result.filter(o => normalizeStatusId(o.status) === selectedStatus);
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

    return result;
  }, [orders, searchTerm, selectedStatus, dateFrom, dateTo]);

  // Agrupar por fecha
  const groupedOrders = useMemo(() => {
    const groups = {};
    filteredOrders.forEach(order => {
      const dateKey = format(new Date(order.created_date), "d MMM, yyyy", { locale: es });
      if (!groups[dateKey]) groups[dateKey] = [];
      groups[dateKey].push(order);
    });
    return groups;
  }, [filteredOrders]);

  const handleOrderClick = (orderId) => {
    setSelectedOrderId(orderId);
  };

  const activeStatuses = ORDER_STATUSES.filter(s => s.isActive);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 to-slate-900 pb-20">
      {/* Header */}
      <div className="sticky top-0 z-20 bg-gradient-to-r from-slate-950 to-slate-900 border-b border-cyan-500/20 px-4 py-3">
        <div className="flex items-center justify-between mb-3">
          <h1 className="text-2xl font-bold text-white">Órdenes</h1>
          <button
            onClick={() => document.querySelector('.orders-chatbot-trigger')?.click()}
            className="p-2 bg-gradient-to-r from-blue-600 to-cyan-600 rounded-xl"
          >
            <Bot className="w-5 h-5 text-white" />
          </button>
        </div>
        
        {/* Búsqueda */}
        <div className="relative mb-3">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
          <Input
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Buscar por cliente o número..."
            className="pl-10 bg-slate-900/60 border-slate-700 text-white placeholder:text-gray-500 rounded-xl h-11"
          />
        </div>

        {/* Filtros Rápidos */}
        <div className="flex items-center gap-2 overflow-x-auto pb-2 no-scrollbar">
          <button
            onClick={() => setShowFilters(!showFilters)}
            className="flex-shrink-0 px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-white text-xs font-medium flex items-center gap-1"
          >
            <SlidersHorizontal className="w-4 h-4" />
            Filtros
          </button>
          
          {activeStatuses.map(status => {
            const count = orders.filter(o => normalizeStatusId(o.status) === status.id).length;
            const isSelected = selectedStatus === status.id;
            
            return (
              <button
                key={status.id}
                onClick={() => setSelectedStatus(isSelected ? null : status.id)}
                disabled={count === 0}
                className={`flex-shrink-0 px-3 py-2 rounded-xl text-xs font-medium whitespace-nowrap transition-all disabled:opacity-30 ${
                  isSelected
                    ? "bg-gradient-to-r from-cyan-600 to-emerald-600 text-white scale-105"
                    : status.id === "pending_order"
                    ? "bg-gradient-to-r from-red-600 to-red-800 text-white animate-pulse"
                    : `${status.colorClasses} border`
                }`}
              >
                {status.label} ({count})
              </button>
            );
          })}
        </div>

        {/* Panel de Filtros Expandible */}
        {showFilters && (
          <div className="mt-3 p-3 bg-slate-900/60 border border-slate-700 rounded-xl space-y-2">
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-xs text-gray-400 mb-1 block">Desde</label>
                <div className="relative">
                  <Input
                    type="date"
                    value={dateFrom}
                    onChange={(e) => setDateFrom(e.target.value)}
                    className="bg-slate-800 border-slate-700 text-white text-sm"
                  />
                </div>
              </div>
              <div>
                <label className="text-xs text-gray-400 mb-1 block">Hasta</label>
                <div className="relative">
                  <Input
                    type="date"
                    value={dateTo}
                    onChange={(e) => setDateTo(e.target.value)}
                    className="bg-slate-800 border-slate-700 text-white text-sm"
                  />
                </div>
              </div>
            </div>
            <Button
              onClick={() => {
                setDateFrom("");
                setDateTo("");
                setSelectedStatus(null);
                setSearchTerm("");
              }}
              variant="outline"
              className="w-full h-8 text-xs border-slate-700"
            >
              Limpiar Filtros
            </Button>
          </div>
        )}
      </div>

      {/* Lista de Órdenes */}
      <div className="px-4 py-4 space-y-4">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="animate-spin w-8 h-8 border-2 border-cyan-500 border-t-transparent rounded-full" />
          </div>
        ) : Object.keys(groupedOrders).length === 0 ? (
          <div className="text-center py-20">
            <p className="text-gray-400">{t('noOrdersFound')}</p>
          </div>
        ) : (
          Object.entries(groupedOrders).map(([dateKey, dateOrders]) => (
            <div key={dateKey}>
              <h3 className="text-sm text-gray-400 font-semibold mb-2 px-1">{dateKey}</h3>
              <div className="space-y-2">
                {dateOrders.map(order => {
                  const statusConfig = getStatusConfig(order.status);
                  
                  return (
                    <div
                      key={order.id}
                      onClick={() => handleOrderClick(order.id)}
                      className="bg-slate-900/40 backdrop-blur-sm border border-slate-800 rounded-2xl p-4 active:scale-[0.98] transition-transform cursor-pointer"
                    >
                      <div className="flex items-start justify-between gap-3 mb-2">
                        <div className="flex-1 min-w-0">
                          <p className="text-white font-semibold text-base truncate">
                            {order.customer_name || "Sin nombre"}
                          </p>
                          <p className="text-gray-400 text-xs truncate">
                            {order.order_number}
                          </p>
                        </div>
                        <div className="text-right flex-shrink-0">
                          <p className="text-xs text-gray-400">
                            {format(new Date(order.created_date), "h:mm a", { locale: es })}
                          </p>
                          <p className="text-xs font-semibold text-emerald-400 mt-0.5">
                            ${(order.cost_estimate || 0).toFixed(2)}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2 flex-1 min-w-0">
                          <div className="w-8 h-8 rounded-lg bg-slate-800 flex items-center justify-center flex-shrink-0">
                            <span className="text-lg">📱</span>
                          </div>
                          <p className="text-gray-300 text-sm truncate">
                            {order.device_model || order.device_brand || order.device_type || "Dispositivo"}
                          </p>
                        </div>
                        
                        <Badge className={`${statusConfig.colorClasses} text-[10px] px-2 py-1 whitespace-nowrap`}>
                          {statusConfig.label}
                        </Badge>
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
        </div>
      )}

      {/* Chatbot */}
      <div className="orders-chatbot-wrapper">
        <OrdersChatbot orders={orders} onOpenOrder={(id) => setSelectedOrderId(id)} />
      </div>
    </div>
  );
}
