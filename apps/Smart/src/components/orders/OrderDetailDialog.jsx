import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useNavigate } from "react-router-dom";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card } from "@/components/ui/card";
import {
  X,
  Save,
  Phone,
  Mail,
  DollarSign,
  Package,
  MessageSquare,
  Clock,
  CheckCircle2,
  Trash2,
  ShoppingCart,
  AlertCircle,
  MessageCircle,
  Share2,
  Printer
} from "lucide-react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { Alert, AlertDescription } from "@/components/ui/alert";
import OrderProgressBar from "./OrderProgressBar"; // This import might be removed if OrderTimeline fully replaces it
import OrderTimeline from "./OrderTimeline"; // New import
import DeleteOrderDialog from "./DeleteOrderDialog";
import RefundModal from "./RefundModal";
import { openWhatsApp, makeCall } from "@/components/utils/helpers";
import { sendTemplatedEmail } from "@/api/functions";
import { navigateToPOS } from "../utils/posNavigation";

const statusColors = {
  intake: "bg-blue-500/20 text-blue-400 border-blue-500/30",
  diagnosing: "bg-purple-500/20 text-purple-400 border-purple-500/30",
  awaiting_approval: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
  waiting_parts: "bg-orange-500/20 text-orange-400 border-orange-500/30",
  in_progress: "bg-cyan-500/20 text-cyan-400 border-cyan-500/30",
  ready_for_pickup: "bg-green-500/20 text-green-400 border-green-500/30",
  picked_up: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30",
  completed: "bg-gray-500/20 text-gray-400 border-gray-500/30",
  cancelled: "bg-red-500/20 text-red-400 border-red-500/30"
};

export default function OrderDetailDialog({ order, open, onClose, onOrderUpdated }) {
  const navigate = useNavigate();
  const [editedOrder, setEditedOrder] = useState(order);
  const [saving, setSaving] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showRefundModal, setShowRefundModal] = useState(false);
  const [showShareMenu, setShowShareMenu] = useState(false);
  const [user, setUser] = useState(null);

  useEffect(() => {
    setEditedOrder(order);
    loadUser();
  }, [order]);

  const loadUser = async () => {
    const userData = await base44.auth.me();
    setUser(userData);
  };

  const canDelete = user && ['admin', 'manager'].includes(user.position);
  const canRefund = user && ['admin', 'manager'].includes(user.position);

  const handleSave = async () => {
    setSaving(true);

    try {
      const previousStatus = order.status;
      const newStatus = editedOrder.status;

      // Update status history if status changed
      let statusHistory = editedOrder.status_history || [];
      if (previousStatus !== newStatus) {
        statusHistory = [
          ...statusHistory,
          {
            status: newStatus,
            timestamp: new Date().toISOString(),
            changed_by: user?.full_name || user?.email
          }
        ];

        if (editedOrder.customer_email) {
          try {
            console.log("[Email Dialog] 🚀 Enviando email templated para:", newStatus);
            await sendTemplatedEmail({
              event_type: newStatus,
              order_data: {
                order_number: editedOrder.order_number,
                customer_name: editedOrder.customer_name || "Cliente",
                customer_email: editedOrder.customer_email,
                device_info: `${editedOrder.device_brand || ""} ${editedOrder.device_model || ""}`.trim(),
                amount: editedOrder.total || editedOrder.cost_estimate || 0,
                balance: (editedOrder.cost_estimate || 0) - (editedOrder.amount_paid || 0),
                initial_problem: editedOrder.initial_problem || ""
              }
            });

            // Log email event
            await base44.entities.WorkOrderEvent.create({
              order_id: editedOrder.id,
              order_number: editedOrder.order_number,
              event_type: "email_sent",
              description: `Email de actualización (${newStatus}) enviado automáticamente`,
              user_name: user?.full_name || user?.email || "Sistema"
            });
          } catch (emailError) {
            console.error("[Email Dialog] ❌ Error sending templated email:", emailError);
          }
        }
      }

      // Calculate progress
      const completedTasks = editedOrder.repair_tasks?.filter(t => t.status === "completed").length || 0;
      const totalTasks = editedOrder.repair_tasks?.length || 1;
      const progress = Math.round((completedTasks / totalTasks) * 100);

      await base44.entities.Order.update(editedOrder.id, {
        ...editedOrder,
        status_history: statusHistory,
        progress_percentage: progress
      });

      // Log audit
      await base44.entities.AuditLog.create({
        action: "update_order",
        entity_type: "order",
        entity_id: editedOrder.id,
        entity_number: editedOrder.order_number,
        user_id: user.id,
        user_name: user.full_name || user.email,
        user_role: user.role,
        changes: {
          previous_status: previousStatus,
          new_status: newStatus
        }
      });

      onOrderUpdated();
      onClose();
    } catch (error) {
      console.error("Error saving order:", error);
      alert("Error al guardar: " + error.message);
    }

    setSaving(false);
  };

  const handleCloseAndGoToPOS = () => {
    if (!confirm("¿Cerrar esta orden y procesar pago en POS?")) return;
    navigateToPOS(editedOrder, navigate, { fromDashboard: true, openPaymentImmediately: true });
    onClose();
  };

  const handleWhatsApp = () => {
    const message = `Hola ${editedOrder.customer_name}, te contactamos de 911 SmartFix sobre tu orden ${editedOrder.order_number}`;
    openWhatsApp(editedOrder.customer_phone, message);
  };

  if (!editedOrder) return null;

  return (
    <>
      <Dialog open={open} onOpenChange={onClose}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto bg-gradient-to-br from-[#2B2B2B] to-black border-red-900/30">
          <DialogHeader>
            <div className="flex items-center justify-between">
              <div>
                <DialogTitle className="text-2xl font-bold text-white">
                  {editedOrder.order_number}
                </DialogTitle>
                <p className="text-sm text-gray-400 mt-1">
                  Creada {format(new Date(editedOrder.created_date), "MMM d, yyyy 'a las' h:mm a", { locale: es })}
                </p>
              </div>
              <div className="flex items-center gap-2">
                {/* Botón imprimir ticket */}
                <Button
                  onClick={() => window.open(`${window.location.origin}/Receipt?order_id=${editedOrder?.id}&print=1`, "_blank")}
                  variant="outline"
                  size="icon"
                  className="border-white/10 text-white/40 hover:bg-white/10"
                  title="Imprimir ticket"
                  aria-label="Imprimir ticket de la orden"
                >
                  <Printer className="w-4 h-4" />
                </Button>

                {/* Botón compartir recibo */}
                <div className="relative">
                  <Button
                    onClick={() => setShowShareMenu(v => !v)}
                    variant="outline"
                    size="icon"
                    className="border-violet-500/30 text-violet-400 hover:bg-violet-900/20"
                    title="Compartir recibo"
                    aria-label="Compartir recibo"
                  >
                    <Share2 className="w-4 h-4" />
                  </Button>
                  {showShareMenu && (
                    <>
                      {/* Overlay para cerrar al tocar fuera */}
                      <div className="fixed inset-0 z-40" onClick={() => setShowShareMenu(false)} />
                      <div className="absolute right-0 top-10 z-50 min-w-[180px] rounded-2xl bg-[#0e0e0e] border border-white/10 shadow-2xl shadow-black/60 overflow-hidden">
                        <p className="text-[9px] font-black text-white/25 uppercase tracking-widest px-3 pt-2.5 pb-1">Compartir recibo</p>
                        {/* WhatsApp */}
                        {editedOrder?.customer_phone && (() => {
                          const url  = `${window.location.origin}/Receipt?order_id=${editedOrder.id}`;
                          const PAID = ["completed", "delivered", "picked_up"];
                          const tipo = PAID.includes(editedOrder.status) ? "recibo de pago" : "recibo de recepción";
                          const msg  = `¡Hola ${editedOrder.customer_name}! 🧾 Aquí está tu ${tipo}:\n\n${url}`;
                          const wa   = `https://wa.me/${editedOrder.customer_phone.replace(/\D/g,"")}?text=${encodeURIComponent(msg)}`;
                          return (
                            <a href={wa} target="_blank" rel="noopener noreferrer"
                              onClick={() => setShowShareMenu(false)}
                              className="flex items-center gap-3 px-4 py-2.5 hover:bg-white/[0.06] transition-colors text-sm text-white/80">
                              <span className="text-base">💬</span> WhatsApp
                            </a>
                          );
                        })()}
                        {/* Email */}
                        {editedOrder?.customer_email && (() => {
                          const url  = `${window.location.origin}/Receipt?order_id=${editedOrder.id}`;
                          const subj = encodeURIComponent(`Tu recibo — ${editedOrder.order_number}`);
                          const body = encodeURIComponent(`Hola ${editedOrder.customer_name},\n\nAquí está tu recibo:\n${url}\n\nGracias.`);
                          return (
                            <a href={`mailto:${editedOrder.customer_email}?subject=${subj}&body=${body}`}
                              onClick={() => setShowShareMenu(false)}
                              className="flex items-center gap-3 px-4 py-2.5 hover:bg-white/[0.06] transition-colors text-sm text-white/80">
                              <Mail className="w-4 h-4 text-blue-400" /> Email
                            </a>
                          );
                        })()}
                        {/* Ver / Imprimir */}
                        <button
                          onClick={() => {
                            setShowShareMenu(false);
                            window.open(`${window.location.origin}/Receipt?order_id=${editedOrder.id}`, "_blank");
                          }}
                          className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-white/[0.06] transition-colors text-sm text-white/80">
                          <Printer className="w-4 h-4 text-white/40" /> Ver / Imprimir
                        </button>
                        {/* Copiar link */}
                        <button
                          onClick={() => {
                            navigator.clipboard.writeText(`${window.location.origin}/Receipt?order_id=${editedOrder.id}`);
                            setShowShareMenu(false);
                          }}
                          className="w-full flex items-center gap-3 px-4 pb-3 pt-1 hover:bg-white/[0.06] transition-colors text-sm text-white/40 border-t border-white/[0.06] mt-1">
                          <span className="text-base">🔗</span> Copiar link
                        </button>
                      </div>
                    </>
                  )}
                </div>

                {canDelete && (
                  <Button
                    onClick={() => setShowDeleteDialog(true)}
                    variant="outline"
                    size="icon"
                    className="border-red-500/30 text-red-400 hover:bg-red-900/20"
                    aria-label="Eliminar orden"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                )}
                <Button onClick={onClose} variant="ghost" size="icon" className="text-gray-400 hover:text-white">
                  <X className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </DialogHeader>

          <Tabs defaultValue="details" className="mt-4">
            <TabsList className="w-full bg-gray-900 border border-gray-800">
              <TabsTrigger value="details" className="flex-1">Detalles</TabsTrigger>
              <TabsTrigger value="timeline" className="flex-1">Timeline</TabsTrigger>
            </TabsList>

            <TabsContent value="details" className="space-y-6 mt-6">
              {/* Customer Info */}
              <Card className="p-4 bg-gray-900 border-gray-800">
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="font-semibold text-white mb-2">Cliente</h3>
                    <p className="text-gray-300">{editedOrder.customer_name}</p>
                    <div className="flex items-center gap-4 mt-2 text-sm text-gray-400">
                      <div className="flex items-center gap-1">
                        <Phone className="w-4 h-4" />
                        <button
                          onClick={() => makeCall(editedOrder.customer_phone)}
                          className="hover:text-red-400 transition-colors"
                        >
                          {editedOrder.customer_phone}
                        </button>
                      </div>
                      {editedOrder.customer_email && (
                        <div className="flex items-center gap-1">
                          <Mail className="w-4 h-4" />
                          <span>{editedOrder.customer_email}</span>
                        </div>
                      )}
                    </div>
                  </div>
                  <Button
                    onClick={handleWhatsApp}
                    size="sm"
                    className="bg-green-600 hover:bg-green-700"
                  >
                    <MessageCircle className="w-4 h-4 mr-2" />
                    WhatsApp
                  </Button>
                </div>
              </Card>

              {/* Status */}
              <div className="space-y-2">
                <Label className="text-gray-300">Estado</Label>
                <Select
                  value={editedOrder.status}
                  onValueChange={(value) => setEditedOrder({ ...editedOrder, status: value })}
                >
                  <SelectTrigger className="bg-black border-gray-700 text-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-gray-900 border-gray-700">
                    <SelectItem value="intake">Recepción</SelectItem>
                    <SelectItem value="diagnosing">Diagnóstico</SelectItem>
                    <SelectItem value="awaiting_approval">Esperando Aprobación</SelectItem>
                    <SelectItem value="waiting_parts">Esperando Piezas</SelectItem>
                    <SelectItem value="in_progress">En Progreso</SelectItem>
                    <SelectItem value="ready_for_pickup">Lista para Recoger</SelectItem>
                    <SelectItem value="picked_up">Recogida</SelectItem>
                    <SelectItem value="completed">Completada</SelectItem>
                    <SelectItem value="cancelled">Cancelada</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Device Info */}
              <Card className="p-4 bg-gray-900 border-gray-800">
                <h3 className="font-semibold text-white mb-3">Dispositivo</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-gray-400 text-sm">Tipo</Label>
                    <p className="text-white">{editedOrder.device_type}</p>
                  </div>
                  <div>
                    <Label className="text-gray-400 text-sm">Marca</Label>
                    <p className="text-white">{editedOrder.device_brand}</p>
                  </div>
                  <div>
                    <Label className="text-gray-400 text-sm">Modelo</Label>
                    <p className="text-white">{editedOrder.device_model}</p>
                  </div>
                </div>
              </Card>

              {/* Payment Info */}
              <Card className="p-4 bg-gray-900 border-gray-800">
                <h3 className="font-semibold text-white mb-3">Información de Pago</h3>
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-gray-400">Estimado:</span>
                    <span className="text-white font-semibold">${(editedOrder.cost_estimate || 0).toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Depósito/Pagado:</span>
                    <span className="text-green-400 font-semibold">${(editedOrder.amount_paid || 0).toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between pt-2 border-t border-gray-800">
                    <span className="text-gray-300 font-semibold">Balance:</span>
                    <span className="text-white font-bold text-lg">
                      ${((editedOrder.cost_estimate || 0) - (editedOrder.amount_paid || 0)).toFixed(2)}
                    </span>
                  </div>
                </div>
              </Card>

              {/* POS Button */}
              {(editedOrder.status === "ready_for_pickup" || editedOrder.status === "completed") && !editedOrder.wo_to_sale_id && (
                <Button
                  onClick={handleCloseAndGoToPOS}
                  className="w-full bg-gradient-to-r from-green-600 to-emerald-700 hover:from-green-700 hover:to-emerald-800 h-12"
                >
                  <ShoppingCart className="w-5 h-5 mr-2" />
                  Cerrar Orden y Procesar en POS
                </Button>
              )}

              {editedOrder.wo_to_sale_id && (
                <Alert className="bg-green-500/10 border-green-500/30">
                  <CheckCircle2 className="w-4 h-4 text-green-400" />
                  <AlertDescription className="text-green-400">
                    Esta orden ya fue procesada en POS
                  </AlertDescription>
                </Alert>
              )}

              {canRefund && (editedOrder.amount_paid || 0) > 0 && (
                <Button
                  onClick={() => setShowRefundModal(true)}
                  variant="outline"
                  className="w-full border-orange-500/30 text-orange-400 hover:bg-orange-900/20"
                >
                  💸 Registrar Reembolso
                </Button>
              )}

              <Button
                onClick={handleSave}
                className="w-full bg-gradient-to-r from-red-600 to-red-800 hover:from-red-700 hover:to-red-900"
                disabled={saving}
              >
                <Save className="w-4 h-4 mr-2" />
                {saving ? "Guardando..." : "Guardar Cambios"}
              </Button>
            </TabsContent>

            <TabsContent value="timeline" className="mt-6">
              <OrderTimeline order={editedOrder} />
            </TabsContent>
          </Tabs>
        </DialogContent>
      </Dialog>

      <DeleteOrderDialog
        order={editedOrder}
        open={showDeleteDialog}
        onClose={() => setShowDeleteDialog(false)}
        onSuccess={() => {
          setShowDeleteDialog(false);
          onOrderUpdated();
          onClose();
        }}
      />

      <RefundModal
        order={editedOrder}
        open={showRefundModal}
        onClose={() => setShowRefundModal(false)}
        onSuccess={() => {
          setShowRefundModal(false);
          onOrderUpdated();
        }}
      />
    </>
  );
}
