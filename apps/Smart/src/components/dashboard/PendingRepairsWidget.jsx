import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Wrench, Clock, AlertCircle, AlertTriangle, Search, ChevronRight } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { getStatusConfig, normalizeStatusId } from "@/components/utils/statusRegistry";
import { format } from "date-fns";
import { es } from "date-fns/locale";

export default function PendingRepairsWidget({ statusCounts, onNavigateWithFilter, searchTerm, setSearchTerm, filteredOrders, handleOrderSelect }) {
  const [repairsData, setRepairsData] = useState({
    inProgress: 0,
    diagnosing: 0,
    waitingParts: 0,
    awaitingApproval: 0,
    total: 0
  });
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    loadRepairsData();
    const interval = setInterval(loadRepairsData, 120000);
    return () => clearInterval(interval);
  }, []);

  const loadRepairsData = async () => {
    try {
      const orders = await base44.entities.Order.list("-updated_date", 500);
      
      const activeStatuses = ["intake", "diagnosing", "awaiting_approval", "waiting_parts", "pending_order", "in_progress", "reparacion_externa"];
      const activeOrders = orders.filter(o => activeStatuses.includes(normalizeStatusId(o.status)));

      setRepairsData({
        inProgress: activeOrders.filter(o => normalizeStatusId(o.status) === "in_progress").length,
        diagnosing: activeOrders.filter(o => normalizeStatusId(o.status) === "diagnosing").length,
        waitingParts: activeOrders.filter(o => normalizeStatusId(o.status) === "waiting_parts").length,
        awaitingApproval: activeOrders.filter(o => normalizeStatusId(o.status) === "awaiting_approval").length,
        total: activeOrders.length
      });
      setLoading(false);
    } catch (error) {
      console.error("Error loading repairs data:", error);
      setLoading(false);
    }
  };

  const pendingOrderCount = statusCounts?.pending_order || 0;

  const statusItems = [
    { key: "inProgress", label: "En Reparación", count: repairsData.inProgress, icon: Wrench, color: "text-blue-400" },
    { key: "diagnosing", label: "Diagnóstico", count: repairsData.diagnosing, icon: Clock, color: "text-purple-400" },
    { key: "waitingParts", label: "Esperando Piezas", count: repairsData.waitingParts, icon: AlertCircle, color: "text-orange-400" },
    { key: "awaitingApproval", label: "Por Aprobar", count: repairsData.awaitingApproval, icon: AlertCircle, color: "text-yellow-400" },
  ];

  const SimplifiedOrderCard = ({ order }) => {
    const statusConfig = getStatusConfig(order.status);
    return (
      <div onClick={() => handleOrderSelect(order.id)} className="p-3 bg-gray-900 rounded-lg border border-gray-800 hover:border-red-600/50 cursor-pointer transition-all">
        <div className="flex justify-between items-start">
          <div className="min-w-0">
            <p className="font-semibold text-white text-sm truncate">{order.order_number || "SIN #ORDEN"}</p>
            <p className="text-xs text-gray-400 truncate">
              {order.customer_name || "—"} {order.customer_phone ? `• ${order.customer_phone}` : ""}
            </p>
          </div>
          <span className={`px-2 py-0.5 rounded-md border text-xs whitespace-nowrap ${statusConfig.colorClasses}`}>
            {statusConfig.label}
          </span>
        </div>
        <div className="mt-2 pt-2 border-t border-gray-800 flex justify-between items-center text-xs text-gray-500">
          <span className="truncate">{(order.device_brand || "") + " " + (order.device_model || "")}</span>
          <span className="whitespace-nowrap">
            {order.created_date ? format(new Date(order.created_date), "dd MMM, yyyy", { locale: es }) : "—"}
          </span>
        </div>
      </div>
    );
  };

  return (
    <Card className="bg-gradient-to-br from-[#2B2B2B] to-black border-red-900/30 shadow-xl">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-white text-lg flex items-center gap-2">
            <Wrench className="w-5 h-5 text-red-600" />
            Reparaciones Activas
          </CardTitle>
          <Badge className="bg-red-600/20 text-red-300 border-red-600/30 text-lg px-3 py-1">
            {repairsData.total}
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="h-32 flex items-center justify-center">
            <div className="animate-spin w-8 h-8 border-4 border-red-600 border-t-transparent rounded-full" />
          </div>
        ) : (
          <>
            {pendingOrderCount > 0 && (
              <div 
                onClick={() => onNavigateWithFilter?.("pending_order")}
                className="mb-4 p-4 rounded-xl bg-gradient-to-br from-red-600 to-red-700 border-2 border-red-500 cursor-pointer hover:from-red-500 hover:to-red-600 transition-all shadow-[0_0_30px_rgba(220,38,38,0.6)] hover:shadow-[0_0_40px_rgba(220,38,38,0.8)] animate-pulse relative overflow-hidden"
              >
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent animate-shimmer" />
                <div className="flex items-center justify-between relative z-10">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-full bg-white/20 flex items-center justify-center animate-pulse">
                      <AlertTriangle className="w-7 h-7 text-white drop-shadow-lg" />
                    </div>
                    <div>
                      <p className="font-black text-white text-base tracking-wide drop-shadow-lg">🚨 ÓRDENES NET PENDIENTES</p>
                      <p className="text-sm text-red-100 font-semibold">Requieren atención inmediata</p>
                    </div>
                  </div>
                  <Badge className="bg-white text-red-600 border-0 text-2xl font-black px-4 py-2 shadow-2xl">
                    {pendingOrderCount}
                  </Badge>
                </div>
              </div>
            )}

            {repairsData.total === 0 ? (
              <div className="text-center py-8">
                <Wrench className="w-12 h-12 mx-auto text-gray-600/50 mb-2" />
                <p className="text-sm text-gray-400">No hay reparaciones activas</p>
              </div>
            ) : (
              <div className="space-y-3">
                {statusItems.filter(item => item.count > 0).map((item) => {
                  const Icon = item.icon;
                  return (
                    <div
                      key={item.key}
                      onClick={() => navigate(createPageUrl("Orders"))}
                      className="flex items-center justify-between p-3 rounded-lg bg-white/5 hover:bg-white/10 transition cursor-pointer"
                    >
                      <div className="flex items-center gap-3">
                        <Icon className={`w-5 h-5 ${item.color}`} />
                        <span className="text-sm text-gray-300">{item.label}</span>
                      </div>
                      <span className="text-lg font-bold text-white">{item.count}</span>
                    </div>
                  );
                })}

                {/* ✅ FIX: Click en orden individual ahora funciona */}
                <div className="pt-3 border-t border-white/10">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-sm font-semibold text-gray-300">Buscar Órdenes</p>
                    <button
                      onClick={() => navigate(createPageUrl("Orders"))}
                      className="text-xs text-gray-400 hover:text-white transition flex items-center gap-1"
                    >
                      Ver todas <ChevronRight className="w-3 h-3" />
                    </button>
                  </div>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 w-4 h-4 pointer-events-none" />
                    <input 
                      type="text" 
                      placeholder="Buscar por #, cliente, teléfono…" 
                      value={searchTerm} 
                      onChange={(e) => setSearchTerm(e.target.value)} 
                      className="w-full h-10 px-4 pl-10 rounded-lg bg-black/40 border border-white/15 text-slate-100 text-sm focus:ring-2 focus:ring-red-600 focus:outline-none transition-all" 
                    />
                  </div>
                  
                  {searchTerm.trim() && (
                    <div className="mt-3 space-y-2 max-h-64 overflow-y-auto">
                      {filteredOrders.length > 0 ? (
                        filteredOrders.slice(0, 5).map((o) => (
                          <SimplifiedOrderCard key={o.id} order={o} />
                        ))
                      ) : (
                        <p className="text-gray-500 text-center py-4 text-xs">
                          Sin coincidencias para tu búsqueda.
                        </p>
                      )}
                    </div>
                  )}
                </div>

                <button
                  onClick={() => navigate(createPageUrl("Orders"))}
                  className="w-full mt-3 py-2 rounded-lg bg-white/5 hover:bg-white/10 text-sm text-gray-300 transition"
                >
                  Ver todas las órdenes →
                </button>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
