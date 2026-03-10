import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { 
  Package, 
  DollarSign, 
  Clock, 
  ExternalLink,
  FileText
} from "lucide-react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { createPageUrl } from "@/components/utils/helpers";

export default function CustomerHistoryDialog({ open, onClose, customerId, customerName }) {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    totalOrders: 0,
    totalSpent: 0,
    activeOrders: 0
  });

  useEffect(() => {
    if (open && customerId) {
      loadCustomerHistory();
    }
  }, [open, customerId]);

  const loadCustomerHistory = async () => {
    setLoading(true);
    try {
      const allOrders = await base44.entities.Order.filter({ customer_id: customerId });
      
      // Sort by most recent first
      const sortedOrders = allOrders.sort((a, b) => 
        new Date(b.created_date) - new Date(a.created_date)
      );

      setOrders(sortedOrders);

      // Calculate stats
      const totalSpent = allOrders.reduce((sum, order) => sum + (order.cost_estimate || 0), 0);
      const activeOrders = allOrders.filter(o => 
        !["completed", "delivered", "picked_up", "cancelled"].includes(o.status)
      ).length;

      setStats({
        totalOrders: allOrders.length,
        totalSpent,
        activeOrders
      });
    } catch (error) {
      console.error("Error loading customer history:", error);
    }
    setLoading(false);
  };

  const statusColors = {
    intake: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
    diagnosing: "bg-blue-500/20 text-blue-400 border-blue-500/30",
    in_progress: "bg-blue-500/20 text-blue-400 border-blue-500/30",
    waiting_parts: "bg-orange-500/20 text-orange-400 border-orange-500/30",
    ready_for_pickup: "bg-green-500/20 text-green-400 border-green-500/30",
    completed: "bg-gray-500/20 text-gray-400 border-gray-500/30",
    delivered: "bg-purple-500/20 text-purple-400 border-purple-500/30",
    cancelled: "bg-red-500/20 text-red-400 border-red-500/30"
  };

  const handleOpenOrder = (orderId) => {
    window.open(createPageUrl(`Orders?order=${orderId}`), '_blank');
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[85vh] bg-gradient-to-br from-[#2B2B2B] to-black border-red-900/30 overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold text-white">
            Historial de {customerName}
          </DialogTitle>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="spinner" />
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto custom-scrollbar">
            {/* Stats Summary */}
            <div className="grid grid-cols-3 gap-3 mb-6">
              <Card className="bg-gray-900 border-gray-800">
                <CardContent className="p-4 text-center">
                  <Package className="w-6 h-6 text-blue-400 mx-auto mb-2" />
                  <p className="text-2xl font-bold text-white">{stats.totalOrders}</p>
                  <p className="text-xs text-gray-500">Total Órdenes</p>
                </CardContent>
              </Card>
              
              <Card className="bg-gray-900 border-gray-800">
                <CardContent className="p-4 text-center">
                  <DollarSign className="w-6 h-6 text-green-400 mx-auto mb-2" />
                  <p className="text-2xl font-bold text-white">${stats.totalSpent.toFixed(2)}</p>
                  <p className="text-xs text-gray-500">Total Gastado</p>
                </CardContent>
              </Card>
              
              <Card className="bg-gray-900 border-gray-800">
                <CardContent className="p-4 text-center">
                  <Clock className="w-6 h-6 text-orange-400 mx-auto mb-2" />
                  <p className="text-2xl font-bold text-white">{stats.activeOrders}</p>
                  <p className="text-xs text-gray-500">Órdenes Activas</p>
                </CardContent>
              </Card>
            </div>

            {/* Orders List */}
            <div className="space-y-3">
              <h3 className="text-lg font-semibold text-white mb-3 flex items-center gap-2">
                <FileText className="w-5 h-5 text-[#FF0000]" />
                Órdenes Anteriores
              </h3>
              
              {orders.length === 0 ? (
                <Card className="bg-gray-900 border-gray-800">
                  <CardContent className="p-8 text-center">
                    <Package className="w-12 h-12 mx-auto text-gray-600 mb-3" />
                    <p className="text-gray-500">No hay órdenes previas</p>
                  </CardContent>
                </Card>
              ) : (
                orders.map(order => (
                  <Card 
                    key={order.id} 
                    className="bg-gray-900 border-gray-800 hover:border-[#FF0000]/50 transition-all cursor-pointer group"
                    onClick={() => handleOpenOrder(order.id)}
                  >
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 space-y-2">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-bold text-white">{order.order_number}</span>
                            <Badge className={statusColors[order.status]} variant="outline">
                              {order.status.replace(/_/g, ' ')}
                            </Badge>
                            {order.priority !== "normal" && (
                              <Badge className="bg-[#FF0000]/20 text-red-400 border-red-500/30">
                                {order.priority}
                              </Badge>
                            )}
                          </div>
                          
                          <p className="text-sm text-gray-400">
                            {order.device_brand} {order.device_model}
                          </p>
                          
                          <div className="flex items-center gap-4 text-xs text-gray-500">
                            <span>
                              {format(new Date(order.created_date), "d MMM yyyy", { locale: es })}
                            </span>
                            {order.cost_estimate && (
                              <span className="text-green-400 font-medium">
                                ${order.cost_estimate.toFixed(2)}
                              </span>
                            )}
                          </div>
                        </div>
                        
                        <Button
                          variant="ghost"
                          size="icon"
                          className="opacity-0 group-hover:opacity-100 transition-opacity"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleOpenOrder(order.id);
                          }}
                        >
                          <ExternalLink className="w-4 h-4 text-[#FF0000]" />
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))
              )}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
