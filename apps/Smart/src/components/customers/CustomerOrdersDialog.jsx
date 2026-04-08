import React, { useState } from "react";
import { callJENAI } from "@/lib/jenaiEngine";
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
import { ArrowRight, Package, Trash2, Star } from "lucide-react";
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

export default function CustomerOrdersDialog({ customer, orders = [], open, onClose, onDelete }) {
  const navigate = useNavigate();
  const [aiClientSummary, setAiClientSummary] = useState("");
  const [aiClientLoading, setAiClientLoading] = useState(false);

  const handleOrderClick = (orderId) => {
    navigate(createPageUrl(`Orders?order=${orderId}`));
    onClose();
  };

  const fetchClientSummary = async () => {
    setAiClientLoading(true);
    setAiClientSummary("");
    try {
      const totalSpent = orders.reduce((sum, o) => sum + (o.total || o.quoted_price || 0), 0);
      const avgTicket = orders.length > 0 ? totalSpent / orders.length : 0;
      const lastOrder = orders.sort((a,b) => new Date(b.created_date||b.created_at) - new Date(a.created_date||a.created_at))[0];
      const daysSinceLast = lastOrder ? Math.floor((Date.now() - new Date(lastOrder.created_date||lastOrder.created_at)) / 86400000) : null;
      const devices = [...new Set(orders.map(o => o.device_model || o.brand || "").filter(Boolean))].slice(0,3);

      const prompt = `Eres el asistente de SmartFixOS para un taller de reparación.
Analiza este perfil de cliente en ESPAÑOL. Máximo 80 palabras.

CLIENTE: ${customer?.full_name || customer?.name || "Cliente"}
- Total de visitas/órdenes: ${orders.length}
- Gasto total histórico: $${totalSpent.toFixed(0)}
- Ticket promedio: $${avgTicket.toFixed(0)}
- Días desde última visita: ${daysSinceLast !== null ? daysSinceLast : "desconocido"}
- Dispositivos: ${devices.join(", ") || "varios"}

Dime: tipo de cliente (frecuente/ocasional/nuevo), su valor para el negocio, y una acción recomendada (ej: ofrecer descuento, llamar para seguimiento, etc).`;

      const text = await callJENAI(prompt, { maxTokens: 200 });
      setAiClientSummary(text);
    } catch(err) {
      setAiClientSummary("⚠️ " + err.message);
    } finally {
      setAiClientLoading(false);
    }
  };

  if (!customer) return null;

  // Asegurar que orders sea un array
  const ordersList = Array.isArray(orders) ? orders : [];

  // Separar órdenes por estado
  const activeOrders = ordersList.filter(o => !o.deleted && !['completed', 'delivered', 'picked_up', 'cancelled'].includes(o.status));
  const completedOrders = ordersList.filter(o => !o.deleted && ['completed', 'delivered', 'picked_up'].includes(o.status));
  const deletedOrders = ordersList.filter(o => o.deleted);

  const vip = (customer.total_orders || 0) >= 3;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto bg-[#121215] border border-white/10">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <DialogTitle className="text-xl sm:text-2xl font-black text-white">
                {customer.name}
              </DialogTitle>
              {vip && (
                <span className="flex items-center gap-1 px-2 py-1 bg-yellow-500/15 border border-yellow-500/30 rounded-lg">
                  <Star className="w-3 h-3 text-yellow-400 fill-yellow-400" />
                  <span className="text-[10px] font-black text-yellow-400 uppercase tracking-tight">VIP</span>
                </span>
              )}
            </div>
            {onDelete && (
              <button
                onClick={() => onDelete(customer.id)}
                className="flex items-center gap-1.5 px-3 py-1.5 text-red-400/60 hover:text-red-400 hover:bg-red-500/10 border border-transparent hover:border-red-500/20 rounded-xl text-xs font-bold transition-all"
              >
                <Trash2 className="w-3.5 h-3.5" />
                Eliminar cliente
              </button>
            )}
          </div>
        </DialogHeader>

        {/* IA — Resumen del cliente */}
        <div className="mx-4 mb-3 border border-violet-500/20 rounded-2xl overflow-hidden bg-white/[0.02]">
          <div className="flex items-center justify-between px-4 py-2.5">
            <div className="flex items-center gap-2">
              <span className="text-violet-400 text-xs">✨</span>
              <span className="text-[10px] font-black text-white/40 uppercase tracking-widest">Análisis IA del cliente</span>
            </div>
            <button
              onClick={fetchClientSummary}
              disabled={aiClientLoading}
              className="text-[10px] font-black text-violet-400/70 hover:text-violet-300 disabled:opacity-40 uppercase tracking-widest transition-colors"
            >
              {aiClientLoading ? "…" : "Analizar"}
            </button>
          </div>
          {(aiClientSummary || aiClientLoading) && (
            <div className="px-4 pb-3">
              {aiClientLoading ? (
                <div className="flex gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-violet-400 animate-bounce" style={{animationDelay:"0ms"}} />
                  <span className="w-1.5 h-1.5 rounded-full bg-violet-400 animate-bounce" style={{animationDelay:"150ms"}} />
                  <span className="w-1.5 h-1.5 rounded-full bg-violet-400 animate-bounce" style={{animationDelay:"300ms"}} />
                </div>
              ) : (
                <p className="text-xs text-white/70 leading-relaxed">{aiClientSummary}</p>
              )}
            </div>
          )}
          {!aiClientSummary && !aiClientLoading && (
            <div className="px-4 pb-2">
              <p className="text-[10px] text-white/50">Presiona "Analizar" para ver el perfil IA del cliente</p>
            </div>
          )}
        </div>

        {ordersList.length === 0 ? (
          <div className="text-center py-12">
            <Package className="w-12 h-12 sm:w-16 sm:h-16 mx-auto text-slate-500 mb-4" />
            <p className="text-slate-400 text-base sm:text-lg">No hay órdenes registradas</p>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Órdenes Activas */}
            {activeOrders.length > 0 && (
              <div>
                <h3 className="text-sm font-bold text-emerald-400 mb-3 flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                  Órdenes Activas ({activeOrders.length})
                </h3>
                <div className="space-y-3">
                  {activeOrders.map((order) => (
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
              </div>
            )}

            {/* Órdenes Completadas */}
            {completedOrders.length > 0 && (
              <div>
                <h3 className="text-sm font-bold text-blue-400 mb-3 flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-blue-500" />
                  Órdenes Completadas ({completedOrders.length})
                </h3>
                <div className="space-y-3">
                  {completedOrders.map((order) => (
                    <Card 
                      key={order.id} 
                      className="cursor-pointer hover:shadow-lg transition-all bg-[#121212] border-white/10 hover:border-blue-600/40"
                      onClick={() => handleOrderClick(order.id)}
                    >
                      <CardContent className="p-3 sm:p-4">
                        <div className="space-y-3 opacity-80">
                          <div className="flex items-start justify-between gap-2">
                            <div className="space-y-1 min-w-0 flex-1">
                              <div className="flex items-center gap-2 flex-wrap">
                                <h3 className="font-bold text-base sm:text-lg text-white">{order.order_number}</h3>
                                <Badge className={`${statusColors[order.status] || 'bg-gray-100 text-gray-800'} text-xs`} variant="outline">
                                  {order.status?.replace(/_/g, ' ')}
                                </Badge>
                              </div>
                              <p className="text-xs sm:text-sm text-slate-400">
                                {order.device_brand} {order.device_model} • Creado {order.created_date ? format(new Date(order.created_date), "dd MMM, yyyy") : "—"}
                              </p>
                            </div>
                            <ArrowRight className="w-5 h-5 text-slate-500 flex-shrink-0" />
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            )}

            {/* Órdenes Eliminadas */}
            {deletedOrders.length > 0 && (
              <div>
                <h3 className="text-sm font-bold text-red-400 mb-3 flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-red-500" />
                  Órdenes Eliminadas ({deletedOrders.length})
                </h3>
                <div className="space-y-3">
                  {deletedOrders.map((order) => (
                    <Card 
                      key={order.id} 
                      className="cursor-pointer hover:shadow-lg transition-all bg-[#121212] border-white/10 hover:border-red-600/40"
                      onClick={() => handleOrderClick(order.id)}
                    >
                      <CardContent className="p-3 sm:p-4">
                        <div className="space-y-3 opacity-60">
                          <div className="flex items-start justify-between gap-2">
                            <div className="space-y-1 min-w-0 flex-1">
                              <div className="flex items-center gap-2 flex-wrap">
                                <h3 className="font-bold text-base sm:text-lg text-white line-through">{order.order_number}</h3>
                                <Badge className="bg-red-500/20 text-red-300 border-red-500/40 text-xs" variant="outline">
                                  Eliminada
                                </Badge>
                              </div>
                              <p className="text-xs sm:text-sm text-slate-500">
                                {order.device_brand} {order.device_model}
                              </p>
                              {order.deleted_at && (
                                <p className="text-xs text-red-400">
                                  Eliminada {format(new Date(order.deleted_at), "dd MMM, yyyy")}
                                </p>
                              )}
                            </div>
                            <ArrowRight className="w-5 h-5 text-slate-600 flex-shrink-0" />
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
