import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Package, Wrench, AlertTriangle, CheckCircle } from "lucide-react";

export default function SuggestedItemsPanel({ open, onClose, suggestedItems, onApply }) {
  const [items, setItems] = useState([]);
  const [selectedItems, setSelectedItems] = useState([]);

  useEffect(() => {
    if (open && suggestedItems) {
      loadItemDetails();
    }
  }, [open, suggestedItems]);

  const loadItemDetails = async () => {
    const enrichedItems = [];

    for (const suggested of suggestedItems) {
      try {
        let itemDetails;
        if (suggested.type === "product") {
          const products = await base44.entities.Product.filter({ id: suggested.item_id });
          if (products.length > 0) {
            itemDetails = {
              ...suggested,
              details: products[0],
              stock: products[0].stock,
              price: products[0].price
            };
          }
        } else {
          const services = await base44.entities.Service.filter({ id: suggested.item_id });
          if (services.length > 0) {
            itemDetails = {
              ...suggested,
              details: services[0],
              price: services[0].price
            };
          }
        }

        if (itemDetails) {
          enrichedItems.push(itemDetails);
        }
      } catch (error) {
        console.error("Error loading item:", error);
      }
    }

    setItems(enrichedItems);

    // Pre-select items by default
    const preselected = enrichedItems.map((item, index) => ({
      ...item,
      quantity: item.default_quantity || 1,
      note: ""
    }));
    setSelectedItems(preselected);
  };

  const handleToggleItem = (item) => {
    const exists = selectedItems.find(si => si.item_id === item.item_id);
    if (exists) {
      setSelectedItems(selectedItems.filter(si => si.item_id !== item.item_id));
    } else {
      setSelectedItems([...selectedItems, {
        ...item,
        quantity: item.default_quantity || 1,
        note: ""
      }]);
    }
  };

  const handleUpdateQuantity = (itemId, quantity) => {
    setSelectedItems(selectedItems.map(si =>
      si.item_id === itemId ? { ...si, quantity: parseInt(quantity) || 1 } : si
    ));
  };

  const handleUpdateNote = (itemId, note) => {
    setSelectedItems(selectedItems.map(si =>
      si.item_id === itemId ? { ...si, note } : si
    ));
  };

  const getStockBadge = (item) => {
    if (item.type !== "product") return null;

    if (item.stock === 0) {
      return <Badge className="bg-apple-red/15 text-apple-red border-0 apple-text-caption1 tabular-nums">Sin stock</Badge>;
    } else if (item.stock <= item.details.min_stock) {
      return <Badge className="bg-apple-orange/15 text-apple-orange border-0 apple-text-caption1 tabular-nums">Stock bajo ({item.stock})</Badge>;
    } else {
      return <Badge className="bg-apple-green/15 text-apple-green border-0 apple-text-caption1 tabular-nums">Stock OK ({item.stock})</Badge>;
    }
  };

  const handleApply = () => {
    onApply(selectedItems);
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="apple-surface-elevated rounded-apple-lg shadow-apple-xl border-0 p-0 overflow-hidden max-w-3xl max-h-[90vh] overflow-y-auto">
        <div className="apple-surface apple-type p-6">
          <DialogHeader>
            <DialogTitle className="apple-text-title2 apple-label-primary">
              Piezas y Servicios Sugeridos
            </DialogTitle>
            <p className="apple-text-subheadline apple-label-secondary">
              Basado en el modelo seleccionado. Puedes ajustar cantidades y añadir notas.
            </p>
          </DialogHeader>

          <div className="space-y-3 mt-4">
            {items.map(item => {
              const isSelected = selectedItems.find(si => si.item_id === item.item_id);
              const selectedItem = isSelected || item;

              return (
                <div
                  key={item.item_id}
                  className={`apple-press p-4 rounded-apple-md transition-all ${
                    isSelected
                      ? 'apple-card ring-2 ring-apple-red bg-apple-red/12'
                      : 'apple-card'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <Checkbox
                      checked={!!isSelected}
                      onCheckedChange={() => handleToggleItem(item)}
                      className="mt-1"
                    />

                    <div className="flex-1 space-y-2">
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-2">
                          {item.type === "product" ? (
                            <div className="w-8 h-8 rounded-apple-sm bg-apple-blue/15 flex items-center justify-center">
                              <Package className="w-5 h-5 text-apple-blue" />
                            </div>
                          ) : (
                            <div className="w-8 h-8 rounded-apple-sm bg-apple-purple/15 flex items-center justify-center">
                              <Wrench className="w-5 h-5 text-apple-purple" />
                            </div>
                          )}
                          <div>
                            <p className="apple-text-headline apple-label-primary">{item.item_name || item.details.name}</p>
                            <p className="apple-text-caption1 apple-label-tertiary capitalize">{item.type}</p>
                          </div>
                        </div>

                        <div className="text-right flex flex-col items-end gap-1">
                          <p className="apple-text-headline apple-label-primary tabular-nums">${item.price?.toFixed(2)}</p>
                          {getStockBadge(item)}
                        </div>
                      </div>

                      {isSelected && (
                        <div
                          className="grid grid-cols-2 gap-3 pt-2"
                          style={{ borderTop: "0.5px solid rgb(var(--separator) / 0.29)" }}
                        >
                          <div>
                            <label className="apple-text-caption1 apple-label-secondary">Cantidad</label>
                            <Input
                              type="number"
                              min="1"
                              value={selectedItem.quantity}
                              onChange={(e) => handleUpdateQuantity(item.item_id, e.target.value)}
                              className="apple-input h-9 tabular-nums"
                            />
                          </div>
                          <div>
                            <label className="apple-text-caption1 apple-label-secondary">Nota (opcional)</label>
                            <Input
                              value={selectedItem.note}
                              onChange={(e) => handleUpdateNote(item.item_id, e.target.value)}
                              placeholder="Ej: con garantía"
                              className="apple-input h-9"
                            />
                          </div>
                        </div>
                      )}

                      {item.problem_type && (
                        <p className="apple-text-caption1 apple-label-tertiary">
                          Recomendado para: {item.problem_type}
                        </p>
                      )}

                      {item.type === "product" && item.stock === 0 && (
                        <div className="flex items-center gap-2 apple-text-caption1 text-apple-red">
                          <AlertTriangle className="w-4 h-4" />
                          Sin stock disponible - Se creará backorder
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {items.length === 0 && (
            <div className="text-center py-12">
              <Package className="w-16 h-16 mx-auto apple-label-tertiary mb-4" />
              <p className="apple-text-subheadline apple-label-secondary">No hay items sugeridos para este modelo</p>
              <p className="apple-text-caption1 apple-label-tertiary mt-2">
                Puedes configurar sugerencias en Configuración → Compatibilidad
              </p>
            </div>
          )}

          <div
            className="flex justify-between items-center pt-4 mt-4"
            style={{ borderTop: "0.5px solid rgb(var(--separator) / 0.29)" }}
          >
            <div className="apple-text-subheadline apple-label-secondary tabular-nums">
              {selectedItems.length} item(s) seleccionado(s)
            </div>
            <div className="flex gap-2">
              <Button
                onClick={onClose}
                variant="outline"
                className="apple-btn apple-btn-secondary"
              >
                Omitir
              </Button>
              <Button
                onClick={handleApply}
                className="apple-btn apple-btn-primary"
                disabled={selectedItems.length === 0}
              >
                <CheckCircle className="w-4 h-4 mr-2" />
                Aplicar Selección
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
