import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter
} from "@/components/ui/dialog";
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export default function ExternalRepairDialog({ open, onClose, order, user, onSuccess }) {
    const [workshop, setWorkshop] = useState('');
    const [reason, setReason] = useState('');
    const [loading, setLoading] = useState(false);

    const handleSubmit = async () => {
        setLoading(true);
        try {
            const statusMetadata = {
                external_workshop: workshop,
                reason: reason,
            };

            await base44.entities.Order.update(order.id, { 
                status: 'reparacion_externa',
                status_metadata: statusMetadata
            });
            
            await base44.entities.WorkOrderEvent.create({
                order_id: order.id,
                order_number: order.order_number,
                event_type: "status_change",
                description: `Enviado a Reparación Externa. Taller: ${workshop}. Motivo: ${reason}.`,
                user_id: user.id,
                user_name: user.full_name
            });

            onSuccess();
        } catch (error) {
            console.error("Error setting external repair status:", error);
        }
        setLoading(false);
    };

    return (
        <Dialog open={open} onOpenChange={onClose}>
            <DialogContent className="bg-gray-900 border-gray-800">
                <DialogHeader>
                    <DialogTitle>Actualizar a "Reparación Externa"</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 py-4">
                    <div>
                        <Label htmlFor="workshop">Taller Externo</Label>
                        <Input id="workshop" value={workshop} onChange={e => setWorkshop(e.target.value)} />
                    </div>
                    <div>
                        <Label htmlFor="reason">Motivo</Label>
                        <Input id="reason" value={reason} onChange={e => setReason(e.target.value)} />
                    </div>
                </div>
                <DialogFooter>
                    <Button variant="outline" onClick={onClose}>Cancelar</Button>
                    <Button onClick={handleSubmit} disabled={loading || !workshop}>
                        {loading ? "Guardando..." : "Confirmar"}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
