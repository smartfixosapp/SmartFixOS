import React, { useState, useEffect } from 'react';
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2 } from 'lucide-react';
import { loadSuppliersSafe } from '@/components/utils/suppliers';

export default function WaitingForPartDialog({ open, onClose, order, user, onSuccess }) {
    const [partName, setPartName] = useState('');
    const [supplier, setSupplier] = useState('');
    const [trackingNumber, setTrackingNumber] = useState('');
    const [loading, setLoading] = useState(false);
    const [suppliers, setSuppliers] = useState([]);
    const [loadingSuppliers, setLoadingSuppliers] = useState(false);

    useEffect(() => {
        if (open) {
            setPartName('');
            setSupplier('');
            setTrackingNumber('');
            loadSuppliers();
        }
    }, [open]);

    const loadSuppliers = async () => {
        setLoadingSuppliers(true);
        try {
            const data = await loadSuppliersSafe();
            setSuppliers(data || []);
        } catch (error) {
            console.error("Error loading suppliers:", error);
        } finally {
            setLoadingSuppliers(false);
        }
    };

    const handleSubmit = async () => {
        setLoading(true);
        try {
            const statusMetadata = {
                part_name: partName,
                supplier: supplier,
                tracking_number: trackingNumber,
            };

            await base44.entities.Order.update(order.id, { 
                status: 'waiting_parts',
                status_metadata: statusMetadata
            });
            
            await base44.entities.WorkOrderEvent.create({
                order_id: order.id,
                order_number: order.order_number,
                event_type: "status_change",
                description: `Estado cambiado a Esperando Piezas. Pieza: ${partName}, Suplidor: ${supplier}, Tracking: ${trackingNumber || 'N/A'}.`,
                user_id: user.id,
                user_name: user.full_name
            });

            onSuccess();
        } catch (error) {
            console.error("Error setting waiting for parts status:", error);
        }
        setLoading(false);
    };

    return (
        <Dialog open={open} onOpenChange={onClose}>
            <DialogContent className="bg-gray-900 border-gray-800">
                <DialogHeader>
                    <DialogTitle>Actualizar a "Esperando Piezas"</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 py-4">
                    <div>
                        <Label htmlFor="part-name">Nombre de la Pieza *</Label>
                        <Input 
                            id="part-name" 
                            value={partName} 
                            onChange={(e) => setPartName(e.target.value)}
                            placeholder="Ej. Pantalla LCD, Batería, Puerto de carga..."
                        />
                    </div>
                    <div>
                        <Label htmlFor="supplier">Suplidor *</Label>
                        {loadingSuppliers ? (
                            <div className="flex items-center justify-center h-11 bg-white/5 rounded-xl border border-white/10">
                                <Loader2 className="w-4 h-4 animate-spin text-white/60" />
                            </div>
                        ) : (
                            <Select value={supplier} onValueChange={setSupplier}>
                                <SelectTrigger id="supplier">
                                    <SelectValue placeholder="Selecciona un suplidor" />
                                </SelectTrigger>
                                <SelectContent>
                                    {suppliers.map((s) => (
                                        <SelectItem key={s.id} value={s.name}>
                                            {s.name}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        )}
                    </div>
                    <div>
                        <Label htmlFor="tracking-number">Tracking Number (Opcional)</Label>
                        <Input 
                            id="tracking-number" 
                            value={trackingNumber} 
                            onChange={(e) => setTrackingNumber(e.target.value)}
                            placeholder="Ej. 1Z999AA..."
                        />
                    </div>
                </div>
                <DialogFooter>
                    <Button variant="outline" onClick={onClose}>Cancelar</Button>
                    <Button onClick={handleSubmit} disabled={loading || !partName || !supplier}>
                        {loading ? "Guardando..." : "Confirmar"}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
