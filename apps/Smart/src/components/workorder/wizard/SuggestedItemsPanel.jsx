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
      return <Badge className="bg-red-500/20 text-red-400 border-red-500/30">Sin stock</Badge>;
    } else if (item.stock <= item.details.min_stock) {
      return <Badge className="bg-orange-500/20 text-orange-400 border-orange-500/30">Stock bajo ({item.stock})</Badge>;
    } else {
      return <Badge className="bg-green-500/20 text-green-400 border-green-500/30">Stock OK ({item.stock})</Badge>;
    }
  };

  const handleApply = () => {
    onApply(selectedItems);
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto bg-gradient-to-br from-[#2B2B2B] to-black border-[#FF0000]/30">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold text-white">
            Piezas y Servicios Sugeridos
          </DialogTitle>
          <p className="text-sm text-gray-400">
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
                className={`p-4 rounded-lg border transition-all ${
                  isSelected
                    ? 'bg-red-900/20 border-red-500/30'
                    : 'bg-gray-900 border-gray-800'
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
                          <Package className="w-5 h-5 text-blue-400" />
                        ) : (
                          <Wrench className="w-5 h-5 text-purple-400" />
                        )}
                        <div>
                          <p className="font-semibold text-white">{item.item_name || item.details.name}</p>
                          <p className="text-xs text-gray-400 capitalize">{item.type}</p>
                        </div>
                      </div>
                      
                      <div className="text-right">
                        <p className="font-bold text-white">${item.price?.toFixed(2)}</p>
                        {getStockBadge(item)}
                      </div>
                    </div>

                    {isSelected && (
                      <div className="grid grid-cols-2 gap-3 pt-2 border-t border-gray-800">
                        <div>
                          <label className="text-xs text-gray-400">Cantidad</label>
                          <Input
                            type="number"
                            min="1"
                            value={selectedItem.quantity}
                            onChange={(e) => handleUpdateQuantity(item.item_id, e.target.value)}
                            className="bg-black border-gray-700 text-white h-9"
                          />
                        </div>
                        <div>
                          <label className="text-xs text-gray-400">Nota (opcional)</label>
                          <Input
                            value={selectedItem.note}
                            onChange={(e) => handleUpdateNote(item.item_id, e.target.value)}
                            placeholder="Ej: con garantía"
                            className="bg-black border-gray-700 text-white h-9"
                          />
                        </div>
                      </div>
                    )}

                    {item.problem_type && (
                      <p className="text-xs text-gray-500">
                        Recomendado para: {item.problem_type}
                      </p>
                    )}

                    {item.type === "product" && item.stock === 0 && (
                      <div className="flex items-center gap-2 text-xs text-red-400">
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
            <Package className="w-16 h-16 mx-auto text-gray-700 mb-4" />
            <p className="text-gray-500">No hay items sugeridos para este modelo</p>
            <p className="text-xs text-gray-600 mt-2">
              Puedes configurar sugerencias en Configuración → Compatibilidad
            </p>
          </div>
        )}

        <div className="flex justify-between items-center pt-4 border-t border-gray-800">
          <div className="text-sm text-gray-400">
            {selectedItems.length} item(s) seleccionado(s)
          </div>
          <div className="flex gap-2">
            <Button
              onClick={onClose}
              variant="outline"
              className="border-gray-700 text-gray-300 hover:bg-gray-800"
            >
              Omitir
            </Button>
            <Button
              onClick={handleApply}
              className="bg-gradient-to-r from-red-600 to-red-800 hover:from-red-700 hover:to-red-900"
              disabled={selectedItems.length === 0}
            >
              <CheckCircle className="w-4 h-4 mr-2" />
              Aplicar Selección
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
