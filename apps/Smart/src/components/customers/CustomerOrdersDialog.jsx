import React, { useState } from "react";
// IA removida — solo vive en Finanzas → Órdenes de Compra.
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
import { ArrowRight, Package, Trash2, Star, Brain } from "lucide-react";
import { useNavigate } from "react-router-dom";
import JeaniDiagnosticPanel from "@/components/workorder/JeaniDiagnosticPanel";
import { createPageUrl } from "@/utils";

const statusColors = {
  pending: "bg-apple-yellow/15 text-apple-yellow border-0",
  in_progress: "bg-apple-blue/15 text-apple-blue border-0",
  waiting_parts: "bg-apple-orange/15 text-apple-orange border-0",
  ready: "bg-apple-green/15 text-apple-green border-0",
  completed: "bg-gray-sys6 dark:bg-gray-sys5 apple-label-secondary border-0",
  delivered: "bg-gray-sys6 dark:bg-gray-sys5 apple-label-secondary border-0"
};

export default function CustomerOrdersDialog({ customer, orders = [], open, onClose, onDelete }) {
  const navigate = useNavigate();
  const [aiClientSummary, setAiClientSummary] = useState("");
  const [aiClientLoading, setAiClientLoading] = useState(false);
  const [showDiagnostic, setShowDiagnostic] = useState(false);

  const handleOrderClick = (orderId) => {
    navigate(createPageUrl(`Orders?order=${orderId}`));
    onClose();
  };

  // Resumen IA del cliente removido — IA solo vive en Órdenes de Compra.
  const fetchClientSummary = async () => {
    setAiClientLoading(false);
    setAiClientSummary("");
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
      <DialogContent className="apple-type max-w-3xl max-h-[80vh] overflow-y-auto apple-surface-elevated rounded-apple-lg shadow-apple-xl border-0 p-0 overflow-hidden">
        <DialogHeader className="p-6 pb-0">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <DialogTitle className="apple-text-title2 apple-label-primary">
                {customer.name}
              </DialogTitle>
              {vip && (
                <span className="flex items-center gap-1 px-2 py-1 bg-apple-yellow/15 rounded-apple-sm">
                  <Star className="w-3 h-3 text-apple-yellow fill-current" />
                  <span className="apple-text-caption2 font-semibold text-apple-yellow">VIP</span>
                </span>
              )}
            </div>
            {onDelete && (
              <button
                onClick={() => onDelete(customer.id)}
                className="apple-btn apple-btn-plain apple-press flex items-center gap-1.5 px-3 py-1.5 text-apple-red hover:bg-apple-red/12 rounded-apple-md apple-text-footnote font-semibold"
              >
                <Trash2 className="w-3.5 h-3.5" />
                Eliminar cliente
              </button>
            )}
          </div>
        </DialogHeader>

        {/* IA — Resumen del cliente */}
        <div className="mx-4 mb-3 rounded-apple-md overflow-hidden bg-apple-purple/12">
          <div className="flex items-center justify-between px-4 py-2.5">
            <div className="flex items-center gap-2">
              <span className="text-apple-purple apple-text-caption1">✨</span>
              <span className="apple-text-caption2 font-semibold apple-label-secondary">Análisis IA del cliente</span>
            </div>
            <button
              onClick={fetchClientSummary}
              disabled={aiClientLoading}
              className="apple-text-caption2 font-semibold text-apple-purple hover:opacity-80 disabled:opacity-40 transition-opacity"
            >
              {aiClientLoading ? "…" : "Analizar"}
            </button>
          </div>
          {(aiClientSummary || aiClientLoading) && (
            <div className="px-4 pb-3">
              {aiClientLoading ? (
                <div className="flex gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-apple-purple animate-bounce" style={{animationDelay:"0ms"}} />
                  <span className="w-1.5 h-1.5 rounded-full bg-apple-purple animate-bounce" style={{animationDelay:"150ms"}} />
                  <span className="w-1.5 h-1.5 rounded-full bg-apple-purple animate-bounce" style={{animationDelay:"300ms"}} />
                </div>
              ) : (
                <p className="apple-text-footnote apple-label-secondary leading-relaxed">{aiClientSummary}</p>
              )}
            </div>
          )}
          {!aiClientSummary && !aiClientLoading && (
            <div className="px-4 pb-2">
              <p className="apple-text-caption2 apple-label-tertiary">Presiona "Analizar" para ver el perfil IA del cliente</p>
            </div>
          )}
        </div>

        {/* Diagnóstico IA — analizar historial completo del cliente */}
        <div className="mx-4 mb-3">
          {!showDiagnostic ? (
            <button
              onClick={() => setShowDiagnostic(true)}
              className="apple-btn apple-btn-tinted apple-press w-full flex items-center justify-center gap-2 py-3 rounded-apple-md bg-apple-purple/12 text-apple-purple apple-text-footnote font-semibold"
            >
              <Brain className="w-4 h-4" />
              Diagnóstico IA — Cliente regresa con problema
            </button>
          ) : (
            <JeaniDiagnosticPanel
              customer={customer}
              onClose={() => setShowDiagnostic(false)}
            />
          )}
        </div>

        {ordersList.length === 0 ? (
          <div className="text-center py-12">
            <Package className="w-12 h-12 sm:w-16 sm:h-16 mx-auto apple-label-tertiary mb-4" />
            <p className="apple-label-secondary apple-text-body">No hay órdenes registradas</p>
          </div>
        ) : (
          <div className="space-y-6 p-4">
            {/* Órdenes Activas */}
            {activeOrders.length > 0 && (
              <div>
                <h3 className="apple-text-subheadline font-semibold text-apple-green mb-3 flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-apple-green animate-pulse" />
                  Órdenes Activas ({activeOrders.length})
                </h3>
                <div className="space-y-3">
                  {activeOrders.map((order) => (
              <Card
                key={order.id}
                className="apple-card apple-press cursor-pointer transition-all border-0"
                onClick={() => handleOrderClick(order.id)}
              >
                <CardContent className="p-3 sm:p-4">
                  <div className="space-y-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="space-y-1 min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="apple-text-headline apple-label-primary tabular-nums">{order.order_number}</h3>
                          <Badge className={`apple-text-caption1 rounded-apple-sm ${statusColors[order.status] || 'bg-gray-sys6 dark:bg-gray-sys5 apple-label-secondary'}`} variant="outline">
                            {order.status?.replace(/_/g, ' ')}
                          </Badge>
                          {order.priority !== "normal" && (
                            <Badge variant="outline" className="bg-apple-red/15 text-apple-red apple-text-caption1 rounded-apple-sm border-0">
                              {order.priority}
                            </Badge>
                          )}
                        </div>
                        <p className="apple-text-footnote apple-label-secondary tabular-nums">
                          {order.device_brand} {order.device_model} • Creado {order.created_date ? format(new Date(order.created_date), "dd MMM, yyyy") : "—"}
                        </p>
                      </div>
                      <ArrowRight className="w-5 h-5 apple-label-tertiary flex-shrink-0" />
                    </div>

                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <span className="apple-text-caption1 apple-label-tertiary">Progreso</span>
                        <span className="apple-text-caption1 font-semibold apple-label-secondary tabular-nums">{order.progress_percentage || 0}%</span>
                      </div>
                      <div className="w-full bg-gray-sys6 dark:bg-gray-sys5 rounded-full h-2 overflow-hidden">
                        <div
                          className="h-full bg-apple-red transition-all duration-300"
                          style={{ width: `${Math.max(0, Math.min(Number(order.progress_percentage || 0), 100))}%` }}
                        />
                      </div>
                    </div>

                    {order.repair_tasks && order.repair_tasks.length > 0 && (
                      <div className="pt-2" style={{ borderTop: '0.5px solid rgb(var(--separator) / 0.29)' }}>
                        <p className="apple-text-caption1 apple-label-tertiary mb-1 tabular-nums">
                          {order.repair_tasks.filter(t => t.status === "completed").length} / {order.repair_tasks.length} tareas completadas
                        </p>
                        <div className="flex flex-wrap gap-1">
                          {order.repair_tasks.slice(0, 3).map((task, idx) => (
                            <Badge key={idx} variant="secondary" className="apple-text-caption1 bg-gray-sys6 dark:bg-gray-sys5 apple-label-secondary rounded-apple-sm border-0">
                              {task.description}
                            </Badge>
                          ))}
                          {order.repair_tasks.length > 3 && (
                            <Badge variant="secondary" className="apple-text-caption1 bg-gray-sys6 dark:bg-gray-sys5 apple-label-secondary rounded-apple-sm border-0">
                              +{order.repair_tasks.length - 3} más
                            </Badge>
                          )}
                        </div>
                      </div>
                    )}

                    {order.cost_estimate && (
                      <div className="flex justify-between items-center pt-2" style={{ borderTop: '0.5px solid rgb(var(--separator) / 0.29)' }}>
                        <span className="apple-text-subheadline apple-label-secondary">Estimado (incl. IVU):</span>
                        <span className="apple-text-headline font-semibold text-apple-red tabular-nums">${(order.cost_estimate * 1.115).toFixed(2)}</span>
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
                <h3 className="apple-text-subheadline font-semibold text-apple-blue mb-3 flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-apple-blue" />
                  Órdenes Completadas ({completedOrders.length})
                </h3>
                <div className="space-y-3">
                  {completedOrders.map((order) => (
                    <Card
                      key={order.id}
                      className="apple-card apple-press cursor-pointer transition-all border-0"
                      onClick={() => handleOrderClick(order.id)}
                    >
                      <CardContent className="p-3 sm:p-4">
                        <div className="space-y-3 opacity-80">
                          <div className="flex items-start justify-between gap-2">
                            <div className="space-y-1 min-w-0 flex-1">
                              <div className="flex items-center gap-2 flex-wrap">
                                <h3 className="apple-text-headline apple-label-primary tabular-nums">{order.order_number}</h3>
                                <Badge className={`apple-text-caption1 rounded-apple-sm ${statusColors[order.status] || 'bg-gray-sys6 dark:bg-gray-sys5 apple-label-secondary'}`} variant="outline">
                                  {order.status?.replace(/_/g, ' ')}
                                </Badge>
                              </div>
                              <p className="apple-text-footnote apple-label-secondary tabular-nums">
                                {order.device_brand} {order.device_model} • Creado {order.created_date ? format(new Date(order.created_date), "dd MMM, yyyy") : "—"}
                              </p>
                            </div>
                            <ArrowRight className="w-5 h-5 apple-label-tertiary flex-shrink-0" />
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
                <h3 className="apple-text-subheadline font-semibold text-apple-red mb-3 flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-apple-red" />
                  Órdenes Eliminadas ({deletedOrders.length})
                </h3>
                <div className="space-y-3">
                  {deletedOrders.map((order) => (
                    <Card
                      key={order.id}
                      className="apple-card apple-press cursor-pointer transition-all border-0"
                      onClick={() => handleOrderClick(order.id)}
                    >
                      <CardContent className="p-3 sm:p-4">
                        <div className="space-y-3 opacity-60">
                          <div className="flex items-start justify-between gap-2">
                            <div className="space-y-1 min-w-0 flex-1">
                              <div className="flex items-center gap-2 flex-wrap">
                                <h3 className="apple-text-headline apple-label-primary line-through tabular-nums">{order.order_number}</h3>
                                <Badge className="bg-apple-red/15 text-apple-red apple-text-caption1 rounded-apple-sm border-0" variant="outline">
                                  Eliminada
                                </Badge>
                              </div>
                              <p className="apple-text-footnote apple-label-tertiary">
                                {order.device_brand} {order.device_model}
                              </p>
                              {order.deleted_at && (
                                <p className="apple-text-caption1 text-apple-red tabular-nums">
                                  Eliminada {format(new Date(order.deleted_at), "dd MMM, yyyy")}
                                </p>
                              )}
                            </div>
                            <ArrowRight className="w-5 h-5 apple-label-tertiary flex-shrink-0" />
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
