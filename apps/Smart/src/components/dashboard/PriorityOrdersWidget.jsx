import React, { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { 
  ClipboardList, 
  Clock, 
  ChevronRight, 
  Smartphone, 
  User, 
  Calendar,
  AlertCircle,
  ArrowUpCircle,
  Maximize2
} from "lucide-react";
import { dataClient } from "@/components/api/dataClient";
import { format, differenceInDays } from "date-fns";
import { es } from "date-fns/locale";
import { getStatusConfig, normalizeStatusId } from "@/components/utils/statusRegistry";
import PendingOrdersDialog from "../orders/PendingOrdersDialog";

export default function PriorityOrdersWidget({ onSelectOrder }) {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showDialog, setShowDialog] = useState(false);

  useEffect(() => {
    loadPriorityOrders();
    // Refresh every 5 minutes
    const interval = setInterval(loadPriorityOrders, 300000);
    return () => clearInterval(interval);
  }, []);

  const loadPriorityOrders = async () => {
    try {
      setLoading(true);
      // Fetch active orders - oldest first
      const allOrders = await dataClient.entities.Order.filter({ deleted: false }, "created_date", 150);
      
      const activeOrders = allOrders.filter(o => {
        const s = normalizeStatusId(o.status || "");
        return !["completed", "delivered", "cancelled", "picked_up"].includes(s);
      });

      setOrders(activeOrders);
    } catch (error) {
      console.error("Error loading priority orders:", error);
    } finally {
      setLoading(false);
    }
  };

  if (loading && orders.length === 0) {
    return (
      <Card className="bg-black/40 backdrop-blur-3xl border border-white/5 rounded-[24px] shadow-xl h-[300px] flex items-center justify-center">
        <div className="animate-spin w-8 h-8 border-4 border-red-500 border-t-transparent rounded-full" />
      </Card>
    );
  }

  if (orders.length === 0) {
    return null; // Don't show if empty
  }

  // Agrupar órdenes por categoría - mostrar solo primeras 5
  const readyForPickup = orders.filter(o => normalizeStatusId(o.status) === "ready_for_pickup").slice(0, 5);
  const waitingParts = orders.filter(o => {
    const st = normalizeStatusId(o.status);
    return st === "waiting_parts" || st === "pending_order";
  }).slice(0, 5);
  const inRepair = orders.filter(o => {
    const st = normalizeStatusId(o.status);
    return st === "in_progress" || st === "diagnosing";
  }).slice(0, 5);
  const urgent = orders.filter(o => 
    o.priority === "urgent" && 
    !["ready_for_pickup", "waiting_parts", "pending_order", "in_progress", "diagnosing"].includes(normalizeStatusId(o.status))
  ).slice(0, 5);

  return (
    <>
    <Card className="bg-gradient-to-br from-blue-900/10 to-black/60 backdrop-blur-3xl border border-white/10 rounded-[24px] shadow-2xl relative overflow-hidden flex flex-col h-full">
      {/* Glossy overlay */}
      <div className="absolute inset-0 bg-gradient-to-b from-white/5 to-transparent pointer-events-none" />
      
      <CardHeader className="pb-2 border-b border-white/5 cursor-pointer hover:bg-white/5 transition-colors" onClick={() => setShowDialog(true)}>
        <div className="flex items-center justify-between">
          <CardTitle className="text-xl font-bold text-white flex items-center gap-2">
            <div className="p-2 bg-blue-500/20 rounded-xl">
              <ClipboardList className="w-5 h-5 text-blue-400" />
            </div>
            Cola de Trabajo
          </CardTitle>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="bg-blue-500/10 text-blue-400 border-blue-500/20">
                {orders.length} Activas
            </Badge>
            <Maximize2 className="w-4 h-4 text-white/30" />
          </div>
        </div>
      </CardHeader>
      
      <CardContent className="p-0 flex-1 overflow-hidden">
        <div className="space-y-1 max-h-[350px] overflow-y-auto scrollbar-thin scrollbar-thumb-blue-500 scrollbar-track-white/5">
          {/* Listas para Recoger */}
          {readyForPickup.length > 0 && (
            <div>
              <div className="px-4 py-2 bg-gradient-to-r from-emerald-500/20 to-green-500/20 border-b border-emerald-500/30">
                <h3 className="text-xs font-bold text-emerald-300 flex items-center gap-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  LISTAS PARA RECOGER ({readyForPickup.length})
                </h3>
              </div>
              {readyForPickup.map((order) => {
                const daysOld = order.created_date ? differenceInDays(new Date(), new Date(order.created_date)) : 0;
                return (
                  <div 
                    key={order.id}
                    onClick={() => onSelectOrder && onSelectOrder(order.id)}
                    className="group p-4 hover:bg-emerald-500/10 transition-all cursor-pointer relative border-l-2 border-emerald-500"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-mono text-xs text-emerald-300 bg-emerald-500/20 px-1.5 py-0.5 rounded">
                            {order.order_number}
                          </span>
                        </div>
                        <h4 className="text-white font-semibold truncate text-sm">{order.customer_name}</h4>
                        <p className="text-xs text-white/50 truncate mt-0.5">{order.device_model}</p>
                      </div>
                      <ChevronRight className="w-4 h-4 text-emerald-400 self-center" />
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Esperando Piezas */}
          {waitingParts.length > 0 && (
            <div>
              <div className="px-4 py-2 bg-gradient-to-r from-orange-500/20 to-amber-500/20 border-b border-orange-500/30">
                <h3 className="text-xs font-bold text-orange-300 flex items-center gap-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-orange-500 animate-pulse" />
                  ESPERANDO PIEZAS ({waitingParts.length})
                </h3>
              </div>
              {waitingParts.map((order) => {
                const daysOld = order.created_date ? differenceInDays(new Date(), new Date(order.created_date)) : 0;
                return (
                  <div 
                    key={order.id}
                    onClick={() => onSelectOrder && onSelectOrder(order.id)}
                    className="group p-4 hover:bg-orange-500/10 transition-all cursor-pointer relative border-l-2 border-orange-500"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-mono text-xs text-orange-300 bg-orange-500/20 px-1.5 py-0.5 rounded">
                            {order.order_number}
                          </span>
                          {daysOld > 5 && (
                            <Badge className="h-5 px-1.5 bg-red-500/20 text-red-300 border-none text-[10px]">
                              +{daysOld}d
                            </Badge>
                          )}
                        </div>
                        <h4 className="text-white font-semibold truncate text-sm">{order.customer_name}</h4>
                        <p className="text-xs text-white/50 truncate mt-0.5">{order.device_model}</p>
                      </div>
                      <ChevronRight className="w-4 h-4 text-orange-400 self-center" />
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* En Reparación */}
          {inRepair.length > 0 && (
            <div>
              <div className="px-4 py-2 bg-gradient-to-r from-blue-500/20 to-cyan-500/20 border-b border-blue-500/30">
                <h3 className="text-xs font-bold text-blue-300 flex items-center gap-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse" />
                  EN REPARACIÓN ({inRepair.length})
                </h3>
              </div>
              {inRepair.map((order) => {
                const daysOld = order.created_date ? differenceInDays(new Date(), new Date(order.created_date)) : 0;
                return (
                  <div 
                    key={order.id}
                    onClick={() => onSelectOrder && onSelectOrder(order.id)}
                    className="group p-4 hover:bg-blue-500/10 transition-all cursor-pointer relative border-l-2 border-blue-500"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-mono text-xs text-blue-300 bg-blue-500/20 px-1.5 py-0.5 rounded">
                            {order.order_number}
                          </span>
                        </div>
                        <h4 className="text-white font-semibold truncate text-sm">{order.customer_name}</h4>
                        <p className="text-xs text-white/50 truncate mt-0.5">{order.device_model}</p>
                      </div>
                      <ChevronRight className="w-4 h-4 text-blue-400 self-center" />
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Urgentes */}
          {urgent.length > 0 && (
            <div>
              <div className="px-4 py-2 bg-gradient-to-r from-red-500/20 to-pink-500/20 border-b border-red-500/30">
                <h3 className="text-xs font-bold text-red-300 flex items-center gap-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
                  URGENTES ({urgent.length})
                </h3>
              </div>
              {urgent.map((order) => {
                const daysOld = order.created_date ? differenceInDays(new Date(), new Date(order.created_date)) : 0;
                return (
                  <div 
                    key={order.id}
                    onClick={() => onSelectOrder && onSelectOrder(order.id)}
                    className="group p-4 hover:bg-red-500/10 transition-all cursor-pointer relative border-l-2 border-red-500"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-mono text-xs text-red-300 bg-red-500/20 px-1.5 py-0.5 rounded">
                            {order.order_number}
                          </span>
                        </div>
                        <h4 className="text-white font-semibold truncate text-sm">{order.customer_name}</h4>
                        <p className="text-xs text-white/50 truncate mt-0.5">{order.device_model}</p>
                      </div>
                      <ChevronRight className="w-4 h-4 text-red-400 self-center" />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </CardContent>
    </Card>

    <PendingOrdersDialog 
        open={showDialog} 
        onClose={() => setShowDialog(false)} 
    />
    </>
  );
}
