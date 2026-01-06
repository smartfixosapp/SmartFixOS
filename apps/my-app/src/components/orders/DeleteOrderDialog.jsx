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
          // Enviar email de eliminación si tiene email
          if (order.customer_email) {
            try {
              await base44.integrations.Core.SendEmail({
                from_name: "SmartFixOS",
                to: order.customer_email,
                subject: `Orden ${order.order_number} - Eliminada`,
                body: `
                  <h2>Orden Eliminada</h2>
                  <p>Estimado/a ${order.customer_name},</p>
                  <p>Su orden <strong>#${order.order_number}</strong> ha sido eliminada del sistema.</p>
                  <p>Si tiene preguntas, contáctenos.</p>
                `
              });
            } catch (emailErr) {
              console.error("Error sending deletion email:", emailErr);
            }
          }

          // This is a destructive action.
          await base44.entities.Order.delete(order.id);
          // Also delete related events
          const events = await base44.entities.WorkOrderEvent.filter({ order_id: order.id });
          for (const event of events) {
              await base44.entities.WorkOrderEvent.delete(event.id);
          }

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
      <DialogContent className="max-w-md bg-gradient-to-br from-[#2B2B2B] to-black border-red-900/30">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold text-white flex items-center gap-2">
            <AlertTriangle className="w-6 h-6 text-red-500" />
            Gestionar Orden
          </DialogTitle>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="cancel">Cancelar Orden</TabsTrigger>
                <TabsTrigger value="delete" disabled={user?.role !== 'admin'}>Eliminar</TabsTrigger>
            </TabsList>
            <TabsContent value="cancel" className="mt-4">
                <div className="space-y-4">
                    <DialogDescription className="text-gray-400">
                        Esta acción moverá la orden al estado "Cancelada" y la ocultará de las vistas activas. La orden permanecerá en el sistema para fines de auditoría.
                    </DialogDescription>
                    <div className="space-y-2">
                        <Label className="text-gray-300">Motivo de cancelación (obligatorio)</Label>
                        <Textarea value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Ej: Cliente canceló, error en la creación..." className="bg-black border-gray-700 text-white" />
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="admin-pin-cancel" className="text-gray-300">PIN de confirmación:</Label>
                        <Input id="admin-pin-cancel" type="password" value={adminPin} onChange={(e) => setAdminPin(e.target.value)} placeholder="****" className="bg-black border-gray-700 text-white" />
                    </div>
                    {error && activeTab === 'cancel' && <p className="text-sm text-red-400">{error}</p>}
                    <div className="flex gap-3 pt-4">
                        <Button onClick={handleClose} variant="outline" className="flex-1 border-gray-700" disabled={processing}>Cerrar</Button>
                        <Button onClick={handleCancelOrder} disabled={processing || !reason.trim() || !adminPin} className="flex-1 bg-yellow-600 hover:bg-yellow-700"><ShieldAlert className="w-4 h-4 mr-2" />{processing ? "Procesando..." : "Confirmar Cancelación"}</Button>
                    </div>
                </div>
            </TabsContent>
            <TabsContent value="delete" className="mt-4">
                <div className="space-y-4">
                    <DialogDescription className="text-red-400 font-bold">
                        ¡ADVERTENCIA! Esta acción eliminará la orden y todos sus datos asociados de forma PERMANENTE. No se podrá deshacer.
                    </DialogDescription>
                    <div className="space-y-2">
                        <Label htmlFor="confirm-text" className="text-gray-300">Para confirmar, escribe "ELIMINAR" en el campo:</Label>
                        <Input id="confirm-text" value={confirmationText} onChange={(e) => setConfirmationText(e.target.value)} className="bg-black border-red-700 text-red-400 font-bold tracking-widest" />
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="admin-pin-delete" className="text-gray-300">PIN de Administrador:</Label>
                        <Input id="admin-pin-delete" type="password" value={adminPin} onChange={(e) => setAdminPin(e.target.value)} placeholder="****" className="bg-black border-gray-700 text-white" />
                    </div>
                    {error && activeTab === 'delete' && <p className="text-sm text-red-400">{error}</p>}
                    <div className="flex gap-3 pt-4">
                        <Button onClick={handleClose} variant="outline" className="flex-1 border-gray-700" disabled={processing}>Cerrar</Button>
                        <Button onClick={handleDeletePermanently} disabled={processing || confirmationText !== 'ELIMINAR' || !adminPin} variant="destructive" className="flex-1"><Trash2 className="w-4 h-4 mr-2" />{processing ? "Eliminando..." : "Eliminar Permanentemente"}</Button>
                    </div>
                </div>
            </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
