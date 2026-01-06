import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { DollarSign, Package, Plus, Minus, Trash2, Clock } from "lucide-react";
import { format } from "date-fns";
import { es } from "date-fns/locale";

/* 👈 D) Piezas sugeridas por modelo */
export default function SummarySection({ order, events, onUpdate }) {
  const [suggestedParts, setSuggestedParts] = useState([]);
  const [selectedItems, setSelectedItems] = useState([]);
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);

  useEffect(() => {
    loadSuggestions();
  }, [order.device_model]);

  const loadSuggestions = async () => {
    const modelName = order.device_model || order.custom_fields?.catalog_device?.model?.label;
    if (!modelName) return;
    
    setLoadingSuggestions(true);
    try {
      // Estrategia flexible de búsqueda
      let parts = await base44.entities.Product.filter({
        active: true
      }).catch(() => []);

      // Filtrar en cliente
      const model = modelName.toLowerCase();
      const brand = (order.device_brand || '').toLowerCase();
      const family = (order.device_family || '').toLowerCase();

      parts = parts.filter(p => {
        if (p.type && p.type !== 'part') return false;
        
        const name = (p.name || '').toLowerCase();
        const sku = (p.sku || '').toLowerCase();
        
        // Buscar en compatible_models
        if (p.compatible_models) {
          const compat = Array.isArray(p.compatible_models) 
            ? p.compatible_models.join(' ').toLowerCase()
            : String(p.compatible_models).toLowerCase();
          
          if (compat.includes(model)) return true;
        }
        
        // Buscar en tags
        if (Array.isArray(p.tags)) {
          const tags = p.tags.join(' ').toLowerCase();
          if (tags.includes(model)) return true;
        }
        
        // Buscar en nombre/SKU
        if (name.includes(model) || sku.includes(model)) return true;
        
        // Match por marca + familia
        if (brand && family && name.includes(brand) && name.includes(family)) return true;
        
        return false;
      });

      // Ordenar por precio
      parts.sort((a, b) => (a.price || 0) - (b.price || 0));

      setSuggestedParts(parts.slice(0, 50));
    } catch (e) {
      console.error("Error loading suggestions:", e);
    } finally {
      setLoadingSuggestions(false);
    }
  };

  const addToCart = (product) => {
    const existing = selectedItems.find(i => i.product_id === product.id);
    if (existing) {
      setSelectedItems(selectedItems.map(i =>
        i.product_id === product.id ? { ...i, quantity: i.quantity + 1 } : i
      ));
    } else {
      setSelectedItems([
        ...selectedItems,
        {
          id: `inv-${product.id}`,
          type: 'product',
          name: product.name,
          price: Number(product.price || 0),
          quantity: 1,
          product_id: product.id,
          sku: product.sku
        }
      ]);
    }
  };

  const removeFromCart = (itemId) => {
    setSelectedItems(selectedItems.filter(i => i.id !== itemId));
  };

  const updateQuantity = (itemId, delta) => {
    setSelectedItems(selectedItems.map(i => {
      if (i.id === itemId) {
        const newQty = Math.max(1, i.quantity + delta);
        return { ...i, quantity: newQty };
      }
      return i;
    }));
  };

  const subtotal = selectedItems.reduce((sum, item) => 
    sum + (item.price * item.quantity), 0
  );

  const stockPill = (product) => {
    if (typeof product.stock !== 'number') return null;
    
    if (product.stock <= 0) {
      return <Badge className="bg-red-600/20 text-red-300 border-red-600/30 text-xs">Agotado</Badge>;
    }
    if (product.stock <= 3) {
      return <Badge className="bg-yellow-600/20 text-yellow-300 border-yellow-600/30 text-xs">Bajo</Badge>;
    }
    return <Badge className="bg-emerald-600/20 text-emerald-300 border-emerald-600/30 text-xs">Disp.</Badge>;
  };

  return (
    <div className="space-y-6">
      {/* Totales */}
      <Card className="bg-gray-900 border-gray-800">
        <CardHeader>
          <CardTitle className="text-white flex items-center gap-2">
            <DollarSign className="w-5 h-5" />
            Resumen Financiero
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex justify-between text-lg">
            <span className="text-gray-400">Costo estimado:</span>
            <span className="text-white font-bold">
              ${Number(order.cost_estimate || 0).toFixed(2)}
            </span>
          </div>
          
          <div className="flex justify-between">
            <span className="text-gray-400">Pagado:</span>
            <span className="text-green-400">
              ${Number(order.amount_paid || 0).toFixed(2)}
            </span>
          </div>

          {order.balance_due > 0 && (
            <div className="flex justify-between pt-3 border-t border-gray-800">
              <span className="text-gray-400">Balance:</span>
              <span className="text-yellow-400 font-semibold">
                ${Number(order.balance_due || 0).toFixed(2)}
              </span>
            </div>
          )}
        </CardContent>
      </Card>

      {/* 👈 D) Piezas sugeridas */}
      <Card className="bg-gray-900 border-gray-800">
        <CardHeader>
          <CardTitle className="text-white flex items-center gap-2">
            <Package className="w-5 h-5" />
            Piezas sugeridas para este equipo
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {loadingSuggestions ? (
            <div className="text-center py-8 text-gray-400">
              Cargando sugerencias...
            </div>
          ) : suggestedParts.length > 0 ? (
            <div className="space-y-3">
              {suggestedParts.map(part => (
                <div
                  key={part.id}
                  className="flex items-center justify-between p-3 bg-black/30 rounded-lg border border-gray-800 hover:border-gray-700 transition-colors"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <p className="font-medium text-white">{part.name}</p>
                      {stockPill(part)}
                    </div>
                    <p className="text-sm text-gray-400">${Number(part.price || 0).toFixed(2)}</p>
                  </div>
                  <Button
                    size="sm"
                    onClick={() => addToCart(part)}
                    className="ml-3 bg-red-600 hover:bg-red-700 h-9 w-9 p-0"
                    disabled={part.stock <= 0}
                  >
                    <Plus className="w-4 h-4" />
                  </Button>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-gray-500 text-sm text-center py-8">
              No hay piezas sugeridas para {order.device_model || "este modelo"}
            </p>
          )}

          {/* Carrito */}
          {selectedItems.length > 0 && (
            <div className="pt-4 border-t border-gray-800 space-y-3">
              <h4 className="font-semibold text-white">Seleccionadas ({selectedItems.length})</h4>
              
              {selectedItems.map(item => (
                <div
                  key={item.id}
                  className="flex items-center justify-between p-3 bg-black/50 rounded-lg border border-gray-700"
                >
                  <div className="flex-1 min-w-0 mr-3">
                    <p className="font-medium text-white text-sm">{item.name}</p>
                    <p className="text-xs text-gray-400">
                      ${item.price.toFixed(2)} × {item.quantity} = ${(item.price * item.quantity).toFixed(2)}
                    </p>
                  </div>
                  
                  <div className="flex items-center gap-1">
                    <Button
                      size="icon"
                      variant="outline"
                      onClick={() => updateQuantity(item.id, -1)}
                      className="h-8 w-8 border-gray-700"
                    >
                      <Minus className="w-3 h-3" />
                    </Button>
                    
                    <span className="text-white w-8 text-center text-sm">{item.quantity}</span>
                    
                    <Button
                      size="icon"
                      variant="outline"
                      onClick={() => updateQuantity(item.id, 1)}
                      className="h-8 w-8 border-gray-700"
                    >
                      <Plus className="w-3 h-3" />
                    </Button>
                    
                    <Button
                      size="icon"
                      variant="outline"
                      onClick={() => removeFromCart(item.id)}
                      className="h-8 w-8 border-red-800 text-red-400 hover:bg-red-900/30 ml-1"
                    >
                      <Trash2 className="w-3 h-3" />
                    </Button>
                  </div>
                </div>
              ))}

              <div className="flex justify-end text-base pt-2">
                <span className="text-gray-400 mr-2">Subtotal:</span>
                <span className="text-white font-bold">${subtotal.toFixed(2)}</span>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Timeline */}
      {events?.length > 0 && (
        <Card className="bg-gray-900 border-gray-800">
          <CardHeader>
            <CardTitle className="text-white flex items-center gap-2">
              <Clock className="w-5 h-5" />
              Historial de eventos
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {events.slice(0, 10).map((event, idx) => (
                <div
                  key={event.id || idx}
                  className="flex gap-3 pb-3 border-b border-gray-800 last:border-0"
                >
                  <div className="flex-shrink-0 w-2 h-2 rounded-full bg-red-600 mt-2" />
                  <div className="flex-1 min-w-0">
                    <p className="text-white text-sm">{event.description}</p>
                    <p className="text-xs text-gray-500 mt-1">
                      {event.user_name} • {format(new Date(event.created_date), "dd MMM yyyy, HH:mm", { locale: es })}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
