import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { dataClient } from '@/components/api/dataClient';
import { Tag, Percent, Calendar, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { usePlanLimits } from "@/hooks/usePlanLimits";
import { UpgradePrompt } from "@/components/plan/UpgradePrompt";

export default function SetDiscountDialog({ open, onClose, products, onSuccess }) {
  const { can: canPlan } = usePlanLimits();
  const [formData, setFormData] = useState({
    discount_percentage: '',
    discount_label: '',
    discount_end_date: '',
    discount_active: true
  });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (products?.length === 1 && products[0].discount_active) {
      const p = products[0];
      setFormData({
        discount_percentage: p.discount_percentage || '',
        discount_label: p.discount_label || '',
        discount_end_date: p.discount_end_date ? new Date(p.discount_end_date).toISOString().split('T')[0] : '',
        discount_active: p.discount_active
      });
    }
  }, [products]);

  const handleApply = async () => {
    const percentage = parseFloat(formData.discount_percentage);
    if (!percentage || percentage <= 0 || percentage > 100) {
      toast.error('Ingresa un descuento válido (1-100%)');
      return;
    }

    setLoading(true);
    try {
      for (const product of products) {
        await dataClient.entities.Product.update(product.id, {
          discount_percentage: percentage,
          discount_active: true,
          discount_label: formData.discount_label || null,
          discount_end_date: formData.discount_end_date || null
        });
      }

      toast.success(`✅ Descuento aplicado a ${products.length} producto(s)`);
      if (onSuccess) onSuccess();
      onClose();
    } catch (error) {
      console.error('Error applying discount:', error);
      toast.error('Error aplicando descuento');
    } finally {
      setLoading(false);
    }
  };

  const handleRemove = async () => {
    setLoading(true);
    try {
      for (const product of products) {
        await dataClient.entities.Product.update(product.id, {
          discount_percentage: 0,
          discount_active: false,
          discount_label: null,
          discount_end_date: null
        });
      }

      toast.success(`🗑️ Descuento eliminado de ${products.length} producto(s)`);
      if (onSuccess) onSuccess();
      onClose();
    } catch (error) {
      console.error('Error removing discount:', error);
      toast.error('Error eliminando descuento');
    } finally {
      setLoading(false);
    }
  };

  if (!products?.length) return null;

  if (!canPlan('pos_discounts')) {
    return (
      <Dialog open={open} onOpenChange={onClose}>
        <DialogContent className="apple-type apple-surface-elevated rounded-apple-lg shadow-apple-xl border-0 p-6 overflow-hidden max-w-md">
          <DialogHeader>
            <DialogTitle className="apple-text-headline apple-label-primary">Descuentos</DialogTitle>
          </DialogHeader>
          <UpgradePrompt feature="pos_discounts" message="Descuentos y ofertas disponibles en el plan Pro" />
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="apple-type apple-surface-elevated rounded-apple-lg shadow-apple-xl border-0 p-6 overflow-hidden max-w-md">
        <DialogHeader>
          <DialogTitle className="apple-text-title2 apple-label-primary flex items-center gap-3">
            <div className="w-10 h-10 rounded-apple-sm bg-apple-orange/15 flex items-center justify-center">
              <Tag className="w-5 h-5 text-apple-orange" />
            </div>
            Configurar Oferta
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {products.length > 1 && (
            <Badge className="bg-apple-blue/15 text-apple-blue border-0">
              {products.length} productos seleccionados
            </Badge>
          )}

          <div>
            <Label className="apple-label-secondary apple-text-subheadline flex items-center gap-2 mb-2">
              <Percent className="w-4 h-4" />
              Descuento (%)
            </Label>
            <Input
              type="number"
              min="1"
              max="100"
              value={formData.discount_percentage}
              onChange={(e) => setFormData({ ...formData, discount_percentage: e.target.value })}
              placeholder="Ej: 20"
              className="apple-input apple-text-headline tabular-nums"
            />
          </div>

          <div>
            <Label className="apple-label-secondary apple-text-subheadline flex items-center gap-2 mb-2">
              <Tag className="w-4 h-4" />
              Etiqueta (opcional)
            </Label>
            <Input
              value={formData.discount_label}
              onChange={(e) => setFormData({ ...formData, discount_label: e.target.value })}
              placeholder="Ej: Black Friday, Liquidación"
              className="apple-input"
            />
          </div>

          <div>
            <Label className="apple-label-secondary apple-text-subheadline flex items-center gap-2 mb-2">
              <Calendar className="w-4 h-4" />
              Fecha de expiración (opcional)
            </Label>
            <Input
              type="date"
              value={formData.discount_end_date}
              onChange={(e) => setFormData({ ...formData, discount_end_date: e.target.value })}
              className="apple-input"
            />
            <p className="apple-text-caption1 apple-label-tertiary mt-1">Déjalo vacío para oferta sin límite</p>
          </div>

          {products.length === 1 && (
            <div className="bg-apple-orange/12 rounded-apple-md p-3">
              <p className="apple-text-subheadline apple-label-secondary mb-2">Vista previa:</p>
              <div className="flex items-baseline gap-2 tabular-nums">
                <span className="apple-text-title2 font-bold text-apple-green">
                  ${((products[0].price * (100 - (parseFloat(formData.discount_percentage) || 0))) / 100).toFixed(2)}
                </span>
                {formData.discount_percentage && (
                  <span className="apple-text-headline apple-label-tertiary line-through">
                    ${products[0].price.toFixed(2)}
                  </span>
                )}
              </div>
              {formData.discount_percentage && (
                <p className="apple-text-caption1 text-apple-orange mt-1 tabular-nums">
                  Ahorras ${(products[0].price * (parseFloat(formData.discount_percentage) || 0) / 100).toFixed(2)}
                </p>
              )}
            </div>
          )}
        </div>

        <DialogFooter className="gap-2">
          {products.some(p => p.discount_active) && (
            <Button
              variant="outline"
              onClick={handleRemove}
              disabled={loading}
              className="apple-btn apple-btn-destructive"
            >
              <Trash2 className="w-4 h-4 mr-2" />
              Quitar Descuento
            </Button>
          )}
          <Button
            variant="outline"
            onClick={onClose}
            disabled={loading}
            className="apple-btn apple-btn-secondary"
          >
            Cancelar
          </Button>
          <Button
            onClick={handleApply}
            disabled={loading}
            className="apple-btn apple-btn-primary bg-apple-orange"
          >
            {loading ? 'Aplicando...' : 'Aplicar Descuento'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
