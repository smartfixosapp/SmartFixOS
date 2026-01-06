import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { dataClient } from '@/components/api/dataClient';
import { Tag, Percent, Calendar, Trash2 } from 'lucide-react';
import { toast } from 'sonner';

export default function SetDiscountDialog({ open, onClose, products, onSuccess }) {
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

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md bg-gradient-to-br from-black to-[#0D0D0D] border-orange-500/30 p-6">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold text-white flex items-center gap-3">
            <Tag className="w-6 h-6 text-orange-500" />
            Configurar Oferta
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {products.length > 1 && (
            <Badge className="bg-cyan-600/20 text-cyan-300">
              {products.length} productos seleccionados
            </Badge>
          )}

          <div>
            <Label className="text-gray-300 flex items-center gap-2 mb-2">
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
              className="bg-black/60 border-orange-500/30 text-white text-lg"
            />
          </div>

          <div>
            <Label className="text-gray-300 flex items-center gap-2 mb-2">
              <Tag className="w-4 h-4" />
              Etiqueta (opcional)
            </Label>
            <Input
              value={formData.discount_label}
              onChange={(e) => setFormData({ ...formData, discount_label: e.target.value })}
              placeholder="Ej: Black Friday, Liquidación"
              className="bg-black/60 border-orange-500/30 text-white"
            />
          </div>

          <div>
            <Label className="text-gray-300 flex items-center gap-2 mb-2">
              <Calendar className="w-4 h-4" />
              Fecha de expiración (opcional)
            </Label>
            <Input
              type="date"
              value={formData.discount_end_date}
              onChange={(e) => setFormData({ ...formData, discount_end_date: e.target.value })}
              className="bg-black/60 border-orange-500/30 text-white"
            />
            <p className="text-xs text-gray-500 mt-1">Déjalo vacío para oferta sin límite</p>
          </div>

          {products.length === 1 && (
            <div className="bg-orange-600/10 border border-orange-500/30 rounded-lg p-3">
              <p className="text-sm text-gray-400 mb-2">Vista previa:</p>
              <div className="flex items-baseline gap-2">
                <span className="text-2xl font-bold text-emerald-400">
                  ${((products[0].price * (100 - (parseFloat(formData.discount_percentage) || 0))) / 100).toFixed(2)}
                </span>
                {formData.discount_percentage && (
                  <span className="text-lg text-gray-500 line-through">
                    ${products[0].price.toFixed(2)}
                  </span>
                )}
              </div>
              {formData.discount_percentage && (
                <p className="text-xs text-orange-300 mt-1">
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
              className="border-red-500/30 text-red-300 hover:bg-red-600/10"
            >
              <Trash2 className="w-4 h-4 mr-2" />
              Quitar Descuento
            </Button>
          )}
          <Button
            variant="outline"
            onClick={onClose}
            disabled={loading}
            className="border-gray-700"
          >
            Cancelar
          </Button>
          <Button
            onClick={handleApply}
            disabled={loading}
            className="bg-gradient-to-r from-orange-600 to-red-700"
          >
            {loading ? 'Aplicando...' : 'Aplicar Descuento'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
