import React from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { format } from "date-fns";
import { ArrowRight, Package } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";

const statusColors = {
  pending: "bg-yellow-100 text-yellow-800 border-yellow-200",
  in_progress: "bg-blue-100 text-blue-800 border-blue-200",
  waiting_parts: "bg-orange-100 text-orange-800 border-orange-200",
  ready: "bg-green-100 text-green-800 border-green-200",
  completed: "bg-gray-100 text-gray-800 border-gray-200",
  delivered: "bg-slate-100 text-slate-800 border-slate-200"
};

export default function CustomerOrdersDialog({ customer, orders = [], open, onClose }) {
  const navigate = useNavigate();

  const handleOrderClick = (orderId) => {
    navigate(createPageUrl(`Orders?order=${orderId}`));
    onClose();
  };

  if (!customer) return null;

  // Asegurar que orders sea un array
  const ordersList = Array.isArray(orders) ? orders : [];

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto bg-gradient-to-br from-[#2B2B2B] to-black border-red-900/30">
        <DialogHeader>
          <DialogTitle className="text-xl sm:text-2xl font-bold text-white">
            Órdenes de {customer.name}
          </DialogTitle>
        </DialogHeader>

        {ordersList.length === 0 ? (
          <div className="text-center py-12">
            <Package className="w-12 h-12 sm:w-16 sm:h-16 mx-auto text-slate-500 mb-4" />
            <p className="text-slate-400 text-base sm:text-lg">No hay órdenes activas</p>
          </div>
        ) : (
          <div className="space-y-3">
            {ordersList.map((order) => (
              <Card 
                key={order.id} 
                className="cursor-pointer hover:shadow-lg transition-all bg-[#121212] border-white/10 hover:border-red-600/40"
                onClick={() => handleOrderClick(order.id)}
              >
                <CardContent className="p-3 sm:p-4">
                  <div className="space-y-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="space-y-1 min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="font-bold text-base sm:text-lg text-white">{order.order_number}</h3>
                          <Badge className={`${statusColors[order.status] || 'bg-gray-100 text-gray-800'} text-xs`} variant="outline">
                            {order.status?.replace(/_/g, ' ')}
                          </Badge>
                          {order.priority !== "normal" && (
                            <Badge variant="outline" className="bg-red-100 text-red-800 text-xs">
                              {order.priority}
                            </Badge>
                          )}
                        </div>
                        <p className="text-xs sm:text-sm text-slate-400">
                          {order.device_brand} {order.device_model} • Creado {order.created_date ? format(new Date(order.created_date), "dd MMM, yyyy") : "—"}
                        </p>
                      </div>
                      <ArrowRight className="w-5 h-5 text-slate-500 flex-shrink-0" />
                    </div>

                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs text-slate-500">Progreso</span>
                        <span className="text-xs font-bold text-slate-300">{order.progress_percentage || 0}%</span>
                      </div>
                      <div className="w-full bg-slate-800 rounded-full h-2 overflow-hidden">
                        <div 
                          className="h-full bg-gradient-to-r from-red-600 to-red-700 transition-all duration-300"
                          style={{ width: `${Math.max(0, Math.min(Number(order.progress_percentage || 0), 100))}%` }}
                        />
                      </div>
                    </div>

                    {order.repair_tasks && order.repair_tasks.length > 0 && (
                      <div className="pt-2 border-t border-white/10">
                        <p className="text-xs text-slate-500 mb-1">
                          {order.repair_tasks.filter(t => t.status === "completed").length} / {order.repair_tasks.length} tareas completadas
                        </p>
                        <div className="flex flex-wrap gap-1">
                          {order.repair_tasks.slice(0, 3).map((task, idx) => (
                            <Badge key={idx} variant="secondary" className="text-xs bg-slate-800 text-slate-300">
                              {task.description}
                            </Badge>
                          ))}
                          {order.repair_tasks.length > 3 && (
                            <Badge variant="secondary" className="text-xs bg-slate-800 text-slate-300">
                              +{order.repair_tasks.length - 3} más
                            </Badge>
                          )}
                        </div>
                      </div>
                    )}

                    {order.cost_estimate && (
                      <div className="flex justify-between items-center pt-2 border-t border-white/10">
                        <span className="text-sm text-slate-400">Estimado (incl. IVU):</span>
                        <span className="font-bold text-red-400">${(order.cost_estimate * 1.115).toFixed(2)}</span>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
