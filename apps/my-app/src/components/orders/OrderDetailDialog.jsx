
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
  MessageCircle
} from "lucide-react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { Alert, AlertDescription } from "@/components/ui/alert";
import OrderProgressBar from "./OrderProgressBar"; // This import might be removed if OrderTimeline fully replaces it
import OrderTimeline from "./OrderTimeline"; // New import
import DeleteOrderDialog from "./DeleteOrderDialog";
import { openWhatsApp, makeCall } from "@/components/utils/helpers";

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
  const [user, setUser] = useState(null);

  useEffect(() => {
    setEditedOrder(order);
    loadUser();
  }, [order]);

  const loadUser = async () => {
    const userData = await base44.auth.me();
    setUser(userData);
  };

  const canDelete = user && ['admin', 'manager'].includes(user.role);

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

        // Send email notification
        if (editedOrder.customer_email) {
          try {
            await base44.integrations.Core.SendEmail({
              to: editedOrder.customer_email,
              subject: `911 SmartFix - Actualización de su orden ${editedOrder.order_number}`,
              body: `
                <h2>Hola ${editedOrder.customer_name},</h2>
                <p>Su orden <strong>${editedOrder.order_number}</strong> ha cambiado de estado:</p>
                <p><strong>Nuevo Estado:</strong> ${newStatus.replace(/_/g, ' ')}</p>
                <p><strong>Dispositivo:</strong> ${editedOrder.device_brand} ${editedOrder.device_model}</p>
                <p>Puede contactarnos al (787) 123-4567 para más información.</p>
                <br>
                <p>Gracias por confiar en 911 SmartFix PR</p>
              `
            });

            // Log email
            await base44.entities.EmailLog.create({
              order_id: editedOrder.id,
              customer_id: editedOrder.customer_id,
              to_email: editedOrder.customer_email,
              subject: `Actualización de orden ${editedOrder.order_number}`,
              body: `Estado cambiado a: ${newStatus}`,
              event_type: "order_status_changed",
              status: "sent",
              sent_at: new Date().toISOString(),
              sent_by: user?.full_name || user?.email
            });
          } catch (emailError) {
            console.error("Error sending email:", emailError);
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

    // Prepare items
    const items = [];

    // Add services
    if (editedOrder.repair_tasks) {
      editedOrder.repair_tasks.forEach(task => {
        items.push({
          id: task.id || Date.now().toString() + Math.random(),
          name: task.description,
          type: "service",
          price: task.cost || 0,
          quantity: 1
        });
      });
    }

    // Add parts
    if (editedOrder.parts_needed) {
      editedOrder.parts_needed.forEach(part => {
        items.push({
          id: part.id || Date.now().toString() + Math.random(),
          name: part.name,
          type: "product",
          price: part.price || 0,
          quantity: part.quantity || 1
        });
      });
    }

    // Navigate to POS with state
    navigate("/POS", {
      state: {
        fromWorkOrder: true,
        order: editedOrder,
        items,
        customer: {
          id: editedOrder.customer_id,
          name: editedOrder.customer_name,
          phone: editedOrder.customer_phone,
          email: editedOrder.customer_email
        },
        deposit: editedOrder.deposit_amount || editedOrder.amount_paid || 0
      }
    });

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
                {canDelete && (
                  <Button
                    onClick={() => setShowDeleteDialog(true)}
                    variant="outline"
                    size="icon"
                    className="border-red-500/30 text-red-400 hover:bg-red-900/20"
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
              <TabsTrigger value="history" className="flex-1">Historial</TabsTrigger>
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

            <TabsContent value="history" className="mt-6">
              <div className="space-y-3">
                {editedOrder.status_history && editedOrder.status_history.length > 0 ? (
                  editedOrder.status_history.map((entry, idx) => (
                    <Card key={idx} className="p-4 bg-gray-900 border-gray-800">
                      <div className="flex items-start gap-3">
                        <div className="p-2 rounded-full bg-red-600/20">
                          <Clock className="w-4 h-4 text-red-400" />
                        </div>
                        <div className="flex-1">
                          <p className="text-white font-medium">{entry.status.replace(/_/g, ' ')}</p>
                          <p className="text-sm text-gray-400">
                            {format(new Date(entry.timestamp), "MMM d, yyyy 'a las' h:mm a", { locale: es })}
                          </p>
                          {entry.changed_by && (
                            <p className="text-xs text-gray-500">Por: {entry.changed_by}</p>
                          )}
                        </div>
                      </div>
                    </Card>
                  ))
                ) : (
                  <p className="text-center text-gray-500 py-8">No hay historial disponible</p>
                )}
              </div>
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
    </>
  );
}
