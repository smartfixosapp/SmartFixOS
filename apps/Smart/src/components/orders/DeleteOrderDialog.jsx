import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { AlertTriangle, Trash2, ShieldAlert } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { removeLocalOrder } from "@/components/utils/localOrderCache";

export default function DeleteOrderDialog({ open, onClose, order, onSuccess, user }) {
  const [adminPin, setAdminPin] = useState("");
  const [reason, setReason] = useState("");
  const [confirmationText, setConfirmationText] = useState("");
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState("");
  const [activeTab, setActiveTab] = useState("cancel");

  const handleCancelOrder = async () => {
    if (user?.role !== 'admin' && user?.role !== 'manager') {
      setError("Solo administradores o gerentes pueden cancelar órdenes.");
      return;
    }
    if (!reason.trim()) {
      setError("El motivo es obligatorio para cancelar la orden.");
      return;
    }
    if (!adminPin) {
      setError("Se requiere el PIN de administrador/gerente.");
      return;
    }
    if (user.pin !== adminPin) {
      setError("PIN incorrecto.");
      return;
    }

    setProcessing(true);
    setError("");

    try {
      await base44.entities.Order.update(order.id, {
        status: "cancelled",
        status_metadata: { ...order.status_metadata, cancellation_reason: reason }
      });

      await base44.entities.WorkOrderEvent.create({
        order_id: order.id,
        order_number: order.order_number,
        event_type: "status_change",
        description: `Orden cancelada. Motivo: ${reason}`,
        user_id: user?.id,
        user_name: user?.full_name,
        metadata: { reason }
      });
      
      // Enviar email de cancelación si tiene email
      if (order.customer_email) {
        try {
          await base44.integrations.Core.SendEmail({
            from_name: "SmartFixOS",
            to: order.customer_email,
            subject: `Orden ${order.order_number} - Cancelada`,
            body: `
              <h2>Orden Cancelada</h2>
              <p>Estimado/a ${order.customer_name},</p>
              <p>Su orden <strong>#${order.order_number}</strong> ha sido cancelada.</p>
              <p><strong>Motivo:</strong> ${reason}</p>
              <p>Si tiene preguntas, contáctenos.</p>
            `
          });
        } catch (emailErr) {
          console.error("Error sending cancellation email:", emailErr);
        }
      }
      
      alert(`✓ Orden ${order.order_number} cancelada correctamente.`);
      onSuccess();
    } catch (err) {
      setError("Error al cancelar la orden: " + err.message);
    } finally {
      setProcessing(false);
    }
  };
  
  const handleDeletePermanently = async () => {
      if (user?.role !== 'admin') {
          setError("Solo los administradores pueden eliminar órdenes permanentemente.");
          return;
      }
      if (confirmationText !== "ELIMINAR") {
          setError("Debe escribir ELIMINAR para confirmar.");
          return;
      }
      if (!adminPin) {
          setError("Se requiere el PIN de administrador.");
          return;
      }
      if (user.pin !== adminPin) {
          setError("PIN de administrador incorrecto.");
          return;
      }

      setProcessing(true);
      setError("");

      try {
          // Eliminar eventos relacionados (best-effort)
          const events = await base44.entities.WorkOrderEvent.filter({ order_id: order.id });
          if (Array.isArray(events) && typeof base44.entities.WorkOrderEvent.delete === "function") {
            for (const event of events) {
              await base44.entities.WorkOrderEvent.delete(event.id).catch(() => null);
            }
          }

          // Hard delete
          await base44.entities.Order.delete(order.id);
          removeLocalOrder(order.id);

          alert(`✓ Orden ${order.order_number} eliminada permanentemente.`);
          onSuccess();
      } catch (err) {
          setError("Error al eliminar la orden: " + err.message);
      } finally {
          setProcessing(false);
      }
  };

  const handleClose = () => {
    setAdminPin("");
    setReason("");
    setConfirmationText("");
    setError("");
    setProcessing(false);
    setActiveTab("cancel");
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="apple-type max-w-md apple-surface-elevated rounded-apple-lg shadow-apple-xl border-0 p-0 overflow-hidden">
        <DialogHeader className="p-6 pb-2">
          <DialogTitle className="apple-text-title2 apple-label-primary flex items-center gap-2">
            <AlertTriangle className="w-6 h-6 text-apple-red" />
            Gestionar Orden
          </DialogTitle>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full px-6 pb-6">
            <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="cancel">Cancelar Orden</TabsTrigger>
                <TabsTrigger value="delete" disabled={user?.role !== 'admin'}>Eliminar</TabsTrigger>
            </TabsList>
            <TabsContent value="cancel" className="mt-4">
                <div className="space-y-4">
                    <DialogDescription className="apple-label-secondary apple-text-subheadline">
                        Esta acción moverá la orden al estado "Cancelada" y la ocultará de las vistas activas. La orden permanecerá en el sistema para fines de auditoría.
                    </DialogDescription>
                    <div className="space-y-2">
                        <Label className="apple-label-secondary apple-text-footnote">Motivo de cancelación (obligatorio)</Label>
                        <Textarea value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Ej: Cliente canceló, error en la creación..." className="apple-input apple-text-body" />
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="admin-pin-cancel" className="apple-label-secondary apple-text-footnote">PIN de confirmación:</Label>
                        <Input id="admin-pin-cancel" type="password" value={adminPin} onChange={(e) => setAdminPin(e.target.value)} placeholder="****" className="apple-input apple-text-body tabular-nums" />
                    </div>
                    {error && activeTab === 'cancel' && <p className="apple-text-subheadline text-apple-red">{error}</p>}
                    <div className="flex gap-3 pt-4">
                        <Button onClick={handleClose} variant="outline" className="apple-btn apple-btn-secondary apple-press flex-1" disabled={processing}>Cerrar</Button>
                        <Button onClick={handleCancelOrder} disabled={processing || !reason.trim() || !adminPin} className="apple-btn apple-press flex-1 bg-apple-orange text-white hover:opacity-90"><ShieldAlert className="w-4 h-4 mr-2" />{processing ? "Procesando..." : "Confirmar Cancelación"}</Button>
                    </div>
                </div>
            </TabsContent>
            <TabsContent value="delete" className="mt-4">
                <div className="space-y-4">
                    <DialogDescription className="text-apple-red font-semibold apple-text-subheadline">
                        ¡ADVERTENCIA! Esta acción eliminará la orden y todos sus datos asociados de forma PERMANENTE. No se podrá deshacer.
                    </DialogDescription>
                    <div className="space-y-2">
                        <Label htmlFor="confirm-text" className="apple-label-secondary apple-text-footnote">Para confirmar, escribe "ELIMINAR" en el campo:</Label>
                        <Input id="confirm-text" value={confirmationText} onChange={(e) => setConfirmationText(e.target.value)} className="apple-input text-apple-red font-semibold" />
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="admin-pin-delete" className="apple-label-secondary apple-text-footnote">PIN de Administrador:</Label>
                        <Input id="admin-pin-delete" type="password" value={adminPin} onChange={(e) => setAdminPin(e.target.value)} placeholder="****" className="apple-input apple-text-body tabular-nums" />
                    </div>
                    {error && activeTab === 'delete' && <p className="apple-text-subheadline text-apple-red">{error}</p>}
                    <div className="flex gap-3 pt-4">
                        <Button onClick={handleClose} variant="outline" className="apple-btn apple-btn-secondary apple-press flex-1" disabled={processing}>Cerrar</Button>
                        <Button onClick={handleDeletePermanently} disabled={processing || confirmationText !== 'ELIMINAR' || !adminPin} variant="destructive" className="apple-btn apple-btn-destructive apple-press flex-1"><Trash2 className="w-4 h-4 mr-2" />{processing ? "Eliminando..." : "Eliminar Permanentemente"}</Button>
                    </div>
                </div>
            </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
