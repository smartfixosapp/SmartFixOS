import React, { useState, useEffect, useMemo, useCallback } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Search, Plus, Filter, X, Smartphone, Laptop, Tablet, 
  Watch, Gamepad2, Camera, Box, Clock, AlertCircle, CheckCircle2,
  Package, Zap, User, Phone, Calendar, ChevronRight, Grid3X3,
  List, RefreshCw, Eye, Building2, FileText
} from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { ORDER_STATUSES, getStatusConfig, normalizeStatusId } from "@/components/utils/statusRegistry";
import WorkOrderPanel from "../components/workorder/WorkOrderPanel";
import QuickOrderModal from "../components/workorder/QuickOrderModal";
import CreateInvoiceDialog from "../components/invoice/CreateInvoiceDialog";

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
    order?.device_brand
  ].filter(Boolean).join(" ").toLowerCase();
  
  const has = (k) => src.includes(k);
  
  if (has("iphone") || has("phone") || has("smartphone") || has("galaxy") || has("pixel")) return "phone";
  if (has("tablet") || has("ipad")) return "tablet";
  if (has("laptop") || has("macbook") || has("computer") || has("pc")) return "computer";
  if (has("watch") || has("reloj")) return "watch";
  if (has("console") || has("playstation") || has("xbox") || has("nintendo")) return "console";
  if (has("camera") || has("gopro") || has("drone")) return "camera";
  return "other";
}

function OrderCard({ order, onClick }) {
  const deviceType = resolveDeviceType(order);
  const DeviceIcon = DEVICE_ICONS[deviceType] || Box;
  const statusConfig = getStatusConfig(order.status);
  const isB2B = order.company_id || order.company_name;
  
  const deviceInfo = [
    order.device_brand,
    order.device_family,
    order.device_model
  ].filter(Boolean).join(" ");

  const taskCount = Array.isArray(order.checklist_items) ? order.checklist_items.length : 0;
  const photoCount = Array.isArray(order.photos_metadata) ? order.photos_metadata.length : 
                     Array.isArray(order.device_photos) ? order.device_photos.length : 0;

  return (
    <button
      onClick={onClick}
      className={`group w-full text-left bg-gradient-to-br backdrop-blur-xl border-2 rounded-xl p-4 transition-all active:scale-[0.98] ${
        isB2B 
          ? "from-purple-900/60 to-purple-800/60 border-purple-500/50 hover:border-purple-400/70 hover:shadow-[0_12px_40px_rgba(168,85,247,0.4)] theme-light:from-purple-50 theme-light:to-purple-100 theme-light:border-purple-300 theme-light:hover:border-purple-400"
          : "from-slate-900/60 to-slate-800/60 border-slate-700/50 hover:border-cyan-500/60 hover:shadow-[0_12px_40px_rgba(0,168,232,0.3)] theme-light:from-white theme-light:to-gray-50 theme-light:border-gray-200 theme-light:hover:border-cyan-500/60"
      }`}
    >
      <div className="flex items-start gap-4">
        {/* Icono del dispositivo */}
        <div className={`flex-shrink-0 w-12 h-12 rounded-xl bg-gradient-to-br border flex items-center justify-center group-hover:scale-110 transition-transform ${
          isB2B
            ? "from-purple-600/20 to-purple-700/20 border-purple-500/30 theme-light:from-purple-100 theme-light:to-purple-200 theme-light:border-purple-300"
            : "from-cyan-600/20 to-emerald-600/20 border-cyan-500/30 theme-light:from-cyan-100 theme-light:to-emerald-100 theme-light:border-cyan-300"
        }`}>
          <DeviceIcon className={`w-6 h-6 ${isB2B ? "text-purple-400 theme-light:text-purple-600" : "text-cyan-400 theme-light:text-cyan-600"}`} />
        </div>

        {/* Contenido principal */}
        <div className="flex-1 min-w-0">
          {/* Header */}
          <div className="flex items-start justify-between gap-2 mb-2">
            <div className="flex-1 min-w-0">
              <h3 className={`font-bold text-base truncate transition-colors ${
                isB2B
                  ? "text-purple-200 group-hover:text-purple-100 theme-light:text-purple-900 theme-light:group-hover:text-purple-700"
                  : "text-white group-hover:text-cyan-300 theme-light:text-gray-900 theme-light:group-hover:text-cyan-700"
              }`}>
                {order.customer_name || "Sin nombre"}
                {isB2B && <span className="ml-2">🏢</span>}
              </h3>
              <p className="text-xs text-gray-400 theme-light:text-gray-600">
                {order.order_number}
              </p>
            </div>
            <Badge className={`${statusConfig.colorClasses} text-[10px] px-2 py-0.5 whitespace-nowrap`}>
              {statusConfig.label}
            </Badge>
          </div>

          {/* Dispositivo */}
          <div className="flex items-center gap-2 mb-2">
            <p className="text-sm text-gray-300 truncate theme-light:text-gray-700">
              {deviceInfo || order.device_type || "Sin info"}
            </p>
          </div>

          {/* Problema inicial */}
          {order.initial_problem && (
            <p className="text-xs text-gray-500 line-clamp-2 mb-2 theme-light:text-gray-600">
              {order.initial_problem}
            </p>
          )}

          {/* Footer info */}
          <div className="flex items-center gap-3 pt-2 border-t border-white/10 theme-light:border-gray-200">
            <div className="flex items-center gap-1 text-gray-400 theme-light:text-gray-600">
              <Clock className="w-3 h-3" />
              <span className="text-xs">
                {format(new Date(order.created_date), "d MMM", { locale: es })}
              </span>
            </div>
            
            {taskCount > 0 && (
              <div className="flex items-center gap-1 text-emerald-400 theme-light:text-emerald-600">
                <CheckCircle2 className="w-3 h-3" />
                <span className="text-xs">{taskCount}</span>
              </div>
            )}
            
            {photoCount > 0 && (
              <div className="flex items-center gap-1 text-purple-400 theme-light:text-purple-600">
                <Camera className="w-3 h-3" />
                <span className="text-xs">{photoCount}</span>
              </div>
            )}

            <ChevronRight className="w-4 h-4 text-gray-600 ml-auto group-hover:text-cyan-400 transition-colors theme-light:text-gray-400" />
          </div>
        </div>
      </div>
    </button>
  );
}

export default function OrdersPage() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedStatus, setSelectedStatus] = useState(null);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [showQuickModal, setShowQuickModal] = useState(false);
  const [viewMode, setViewMode] = useState("grid"); // grid o list
  const [refreshTick, setRefreshTick] = useState(0);
  const [showB2BOnly, setShowB2BOnly] = useState(false);
  const [showCreateInvoice, setShowCreateInvoice] = useState(false);

  useEffect(() => {
    loadOrders();
    
    const handleRefresh = () => {
      console.log("[Orders] Evento force-refresh detectado");
      loadOrders();
    };
    
    window.addEventListener("force-refresh", handleRefresh);
    window.addEventListener("workorder-created", handleRefresh);
    
    return () => {
      window.removeEventListener("force-refresh", handleRefresh);
      window.removeEventListener("workorder-created", handleRefresh);
    };
  }, [refreshTick]);

  const loadOrders = async () => {
    setLoading(true);
    try {
      const data = await base44.entities.Order.filter({ deleted: false }, "-created_date", 200);
      console.log("[Orders] Órdenes cargadas:", data?.length || 0);
      setOrders(data || []);
    } catch (error) {
      console.error("Error cargando órdenes:", error);
      toast.error("Error al cargar órdenes");
      setOrders([]);
    } finally {
      setLoading(false);
    }
  };

  const handleOrderUpdated = useCallback(() => {
    console.log("[Orders] Orden actualizada, recargando...");
    setRefreshTick(t => t + 1);
  }, []);

  // Filtros
  const filteredOrders = useMemo(() => {
    let result = orders.filter(o => o && !o.deleted);

    // Filtrar B2B
    if (showB2BOnly) {
      result = result.filter(o => o.company_id || o.company_name);
    }

    // Filtrar por estado
    if (selectedStatus) {
      result = result.filter(o => normalizeStatusId(o.status) === selectedStatus);
    }

    // Filtrar por búsqueda
    const q = searchQuery.toLowerCase().trim();
    if (q) {
      result = result.filter(o =>
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

  // Contadores por estado
  const statusCounts = useMemo(() => {
    const counts = {};
    ORDER_STATUSES.filter(s => s.isActive).forEach(s => {
      counts[s.id] = orders.filter(o => 
        !o.deleted && normalizeStatusId(o.status) === s.id
      ).length;
    });
    return counts;
  }, [orders]);

  return (
    <div className="min-h-screen bg-[#0A0A0A] pb-24 theme-light:bg-gray-50">
      {/* Header */}
      <div className="sticky top-0 z-40 bg-gradient-to-br from-slate-950/95 via-cyan-950/95 to-slate-950/95 backdrop-blur-xl border-b border-cyan-500/20 shadow-[0_8px_32px_rgba(0,168,232,0.2)] theme-light:bg-white/95 theme-light:border-gray-200">
        <div className="max-w-[1920px] mx-auto px-3 sm:px-6 py-4 space-y-4">
          {/* Título y acciones */}
          <div className="flex items-center justify-between gap-3">
            <h1 className="text-2xl sm:text-3xl font-black text-white flex items-center gap-3 theme-light:text-gray-900">
              <div className="relative">
                <div className="absolute inset-0 bg-cyan-500 blur-xl opacity-50"></div>
                <Package className="relative w-7 h-7 sm:w-8 sm:h-8 text-cyan-500" />
              </div>
              Órdenes
            </h1>
            
            <div className="flex items-center gap-2">
              <Button
                onClick={() => loadOrders()}
                variant="outline"
                size="icon"
                className="border-cyan-500/30 text-cyan-400 hover:bg-cyan-600/20 theme-light:border-cyan-300 theme-light:text-cyan-600"
              >
                <RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
              </Button>

              <Button
                onClick={() => setShowB2BOnly(!showB2BOnly)}
                variant="outline"
                className={`border-2 ${showB2BOnly ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white border-blue-500/50' : 'border-blue-500/30 text-blue-400 hover:bg-blue-600/20'} theme-light:border-blue-300 theme-light:text-blue-600`}
              >
                <Building2 className="w-5 h-5 mr-0 sm:mr-2" />
                <span className="hidden sm:inline">B2B</span>
              </Button>

              <Button
                onClick={() => setShowCreateInvoice(true)}
                variant="outline"
                className="border-2 border-purple-500/30 text-purple-400 hover:bg-purple-600/20 hover:border-purple-500/50 theme-light:border-purple-300 theme-light:text-purple-700 theme-light:hover:bg-purple-50"
              >
                <FileText className="w-5 h-5 mr-0 sm:mr-2" />
                <span className="hidden sm:inline">Facturas</span>
              </Button>
              
              <Button
                onClick={() => setShowQuickModal(true)}
                className="bg-gradient-to-r from-cyan-600 to-emerald-600 hover:from-cyan-700 hover:to-emerald-700 shadow-lg h-10"
              >
                <Plus className="w-4 h-4 sm:mr-2" />
                <span className="hidden sm:inline">Nueva</span>
              </Button>
            </div>
          </div>

          {/* Búsqueda */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <Input
              placeholder="🔍 Buscar por cliente, #orden, teléfono, dispositivo..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 pr-10 h-12 bg-black/40 border-2 border-cyan-500/30 text-white placeholder:text-gray-500 focus:border-cyan-500/60 theme-light:bg-white theme-light:border-gray-300 theme-light:text-gray-900"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 w-6 h-6 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center theme-light:bg-gray-200 theme-light:hover:bg-gray-300"
              >
                <X className="w-4 h-4 text-gray-400" />
              </button>
            )}
          </div>

          {/* Filtros de estado */}
          <div className="flex gap-2 overflow-x-auto pb-2 no-scrollbar">
            <button
              onClick={() => setSelectedStatus(null)}
              className={`px-4 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all border-2 ${
                !selectedStatus
                  ? "bg-gradient-to-r from-cyan-600 to-emerald-600 text-white border-cyan-500/50 shadow-lg"
                  : "bg-black/40 border-slate-700 text-gray-400 hover:border-slate-600 theme-light:bg-white theme-light:border-gray-300"
              }`}
            >
              Todos ({orders.filter(o => !o.deleted).length})
            </button>
            
            {ORDER_STATUSES.filter(s => s.isActive).map(status => {
              const count = statusCounts[status.id] || 0;
              const isSelected = selectedStatus === status.id;
              const config = getStatusConfig(status.id);
              
              return (
                <button
                  key={status.id}
                  onClick={() => setSelectedStatus(isSelected ? null : status.id)}
                  disabled={count === 0}
                  className={`px-4 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all border-2 ${
                    isSelected
                      ? `${config.colorClasses} border-current shadow-lg scale-105`
                      : count === 0
                      ? "bg-black/20 border-slate-800 text-gray-600 cursor-not-allowed opacity-40 theme-light:bg-gray-100 theme-light:border-gray-200"
                      : "bg-black/40 border-slate-700 text-gray-400 hover:border-slate-600 theme-light:bg-white theme-light:border-gray-300"
                  }`}
                >
                  {status.label} ({count})
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Contenido */}
      <div className="max-w-[1920px] mx-auto px-3 sm:px-6 py-6">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20">
            <div className="w-16 h-16 border-4 border-cyan-500 border-t-transparent rounded-full animate-spin mb-4"></div>
            <p className="text-gray-400 text-lg theme-light:text-gray-600">Cargando órdenes...</p>
          </div>
        ) : filteredOrders.length === 0 ? (
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
            {(searchQuery || selectedStatus) && (
              <Button
                onClick={() => {
                  setSearchQuery("");
                  setSelectedStatus(null);
                }}
                variant="outline"
                className="border-cyan-500/30 text-cyan-400 hover:bg-cyan-600/20 theme-light:border-cyan-300 theme-light:text-cyan-600"
              >
                <X className="w-4 h-4 mr-2" />
                Limpiar filtros
              </Button>
            )}
          </div>
        ) : (
          <>
            {/* Info de filtros activos */}
            {(searchQuery || selectedStatus) && (
              <div className="mb-4 flex items-center justify-between gap-3 bg-cyan-600/10 border border-cyan-500/30 rounded-xl p-3 theme-light:bg-cyan-50 theme-light:border-cyan-300">
                <div className="flex items-center gap-2">
                  <Filter className="w-4 h-4 text-cyan-400 theme-light:text-cyan-600" />
                  <span className="text-sm text-cyan-300 font-semibold theme-light:text-cyan-700">
                    {filteredOrders.length} {filteredOrders.length === 1 ? 'orden' : 'órdenes'}
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
                    setSelectedStatus(null);
                  }}
                  className="text-cyan-400 hover:text-cyan-300 theme-light:text-cyan-600"
                >
                  <X className="w-4 h-4" />
                </Button>
              </div>
            )}

            {/* Grid de órdenes */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-3 md:gap-4">
              {filteredOrders.map(order => (
                <OrderCard
                  key={order.id}
                  order={order}
                  onClick={() => setSelectedOrder(order)}
                />
              ))}
            </div>
          </>
        )}
      </div>

      {/* Modal de orden seleccionada */}
      {selectedOrder && (
        <div className="fixed inset-0 z-[9999] bg-black/80 backdrop-blur-sm">
          <WorkOrderPanel
            orderId={selectedOrder.id}
            onClose={() => {
              setSelectedOrder(null);
              loadOrders();
            }}
            onUpdate={handleOrderUpdated}
            onDelete={(deletedOrderId) => {
              console.log("[Orders] Orden eliminada:", deletedOrderId);
              setSelectedOrder(null);
              setOrders(prev => {
                const filtered = prev.filter(o => o.id !== deletedOrderId);
                console.log("[Orders] Órdenes antes:", prev.length, "después:", filtered.length);
                return filtered;
              });
              setTimeout(() => setRefreshTick(t => t + 1), 500);
            }}
          />
        </div>
      )}

      {/* Modal de nueva orden */}
      {showQuickModal && (
        <QuickOrderModal
          open={showQuickModal}
          onClose={() => setShowQuickModal(false)}
          onSuccess={() => {
            setShowQuickModal(false);
            loadOrders();
            toast.success("✅ Orden creada");
          }}
        />
      )}

      {/* Modal de crear factura B2B */}
      {showCreateInvoice && (
        <CreateInvoiceDialog
          open={showCreateInvoice}
          onClose={() => setShowCreateInvoice(false)}
          onSuccess={() => {
            setShowCreateInvoice(false);
            toast.success("✅ Factura creada");
          }}
        />
      )}
    </div>
  );
}
