import React, { useMemo, useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { User, Smartphone, Package, DollarSign, FileSignature, Plus, Loader2, Users } from "lucide-react";
import { Input } from "@/components/ui/input";

function SuggestedItemsPanel({ formData, updateFormData }) {
  const [suggestions, setSuggestions] = useState([]);
  const [loading, setLoading] = useState(false);
  const selectedItems = formData.suggested_items || [];

  useEffect(() => {
    loadSuggestions();
  }, [formData.device_model, formData.device_brand]);

  const loadSuggestions = async () => {
    setLoading(true);
    try {
      const model = formData.device_model || "";
      const brand = formData.device_brand || "";

      if (!model && !brand) {
        setSuggestions([]);
        setLoading(false);
        return;
      }

      const allProducts = await base44.entities.Product.filter({ active: true });
      
      const matches = (allProducts || []).filter(p => {
        const compatModels = p.compatibility_models || [];
        const compatBrands = p.compatible_brands || [];
        const tags = (p.tags || []).map(t => t.toLowerCase());
        
        if (model && compatModels.some(cm => cm.toLowerCase() === model.toLowerCase())) {
          return true;
        }
        
        if (brand && compatBrands.some(cb => cb.toLowerCase() === brand.toLowerCase())) {
          return true;
        }
        
        if (model && tags.some(t => t.includes(model.toLowerCase()))) {
          return true;
        }
        
        return false;
      });

      matches.sort((a, b) => {
        const stockA = a.stock || 0;
        const stockB = b.stock || 0;
        if (stockA > 0 && stockB <= 0) return -1;
        if (stockB > 0 && stockA <= 0) return 1;
        return (a.price || 0) - (b.price || 0);
      });

      setSuggestions(matches.slice(0, 20));
    } catch (e) {
      console.error("Error loading suggestions:", e);
      setSuggestions([]);
    } finally {
      setLoading(false);
    }
  };

  const handleAddItem = (item) => {
    const isAlready = selectedItems.some(i => i.id === `inv-${item.id}`);
    if (isAlready) {
      updateFormData("suggested_items", selectedItems.filter(i => i.id !== `inv-${item.id}`));
    } else {
      updateFormData("suggested_items", [
        ...selectedItems,
        {
          id: `inv-${item.id}`,
          type: "product",
          name: item.name,
          quantity: 1,
          price: item.price || 0,
        }
      ]);
    }
  };

  if (loading) {
    return (
      <div className="bg-gradient-to-br from-emerald-900/20 to-emerald-800/10 rounded-lg p-6 border border-emerald-500/20">
        <div className="flex items-center justify-center py-8">
          <Loader2 className="w-6 h-6 text-emerald-400 animate-spin mr-3" />
          <span className="text-gray-300">Loading suggestions...</span>
        </div>
      </div>
    );
  }

  if (!formData.device_model) {
    return (
      <div className="bg-gradient-to-br from-yellow-900/20 to-yellow-800/10 rounded-lg p-6 border border-yellow-500/20">
        <h3 className="text-lg font-semibold text-white mb-2">Suggested parts</h3>
        <p className="text-sm text-gray-300">Select a device model to see suggestions</p>
      </div>
    );
  }

  if (suggestions.length === 0) {
    return (
      <div className="bg-gradient-to-br from-gray-900/20 to-gray-800/10 rounded-lg p-6 border border-gray-500/20">
        <h3 className="text-lg font-semibold text-white mb-2">Suggested parts for this device</h3>
        <p className="text-sm text-gray-400">No suggestions available for this model</p>
      </div>
    );
  }

  return (
    <div className="bg-gradient-to-br from-emerald-900/20 to-emerald-800/10 rounded-lg p-6 border border-emerald-500/20">
      <div className="flex items-center gap-3 mb-4">
        <Package className="w-6 h-6 text-emerald-400" />
        <h3 className="text-lg font-semibold text-white">Suggested parts for this device</h3>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
        {suggestions.map((item) => {
          const isSelected = selectedItems.some(i => i.id === `inv-${item.id}`);
          const stock = item.stock || 0;
          const isLowStock = stock > 0 && stock <= (item.min_stock || 5);

          return (
            <button
              key={item.id}
              onClick={() => handleAddItem(item)}
              className={`
                p-4 rounded-lg border text-left transition-all
                ${isSelected 
                  ? "bg-emerald-600/30 border-emerald-500" 
                  : "bg-gray-900/40 border-gray-700 hover:border-emerald-600/50"
                }
              `}
            >
              <div className="flex items-start justify-between gap-2 mb-2">
                <p className="text-sm font-medium text-white line-clamp-2 flex-1">{item.name}</p>
                <div className={`
                  w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0
                  ${isSelected ? "bg-emerald-600" : "bg-gray-700"}
                `}>
                  {isSelected && <Plus className="w-4 h-4 text-white rotate-45" />}
                  {!isSelected && <Plus className="w-4 h-4 text-gray-400" />}
                </div>
              </div>
              
              <div className="flex items-center justify-between">
                <span className="text-sm text-emerald-400 font-semibold">
                  ${(item.price || 0).toFixed(2)}
                </span>
                {stock > 0 ? (
                  <span className={`text-xs ${isLowStock ? "text-yellow-400" : "text-gray-400"}`}>
                    Stock: {stock}
                  </span>
                ) : (
                  <span className="text-xs text-red-400">Out of stock</span>
                )}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

export default function SummaryStep({ formData, updateFormData, technicians, onBack, onSubmit, loading, onAddAnotherDevice, taxRate = 0.115 }) {
  const items = formData.suggested_items || [];

  const updateItemQuantity = (idx, qty) => {
    const next = [...items];
    next[idx].quantity = Math.max(1, Number(qty));
    updateFormData("suggested_items", next);
  };

  const updateItemDiscount = (idx, discountPercent) => {
    const next = [...items];
    next[idx].discount_percent = Math.max(0, Math.min(100, Number(discountPercent)));
    updateFormData("suggested_items", next);
  };

  const toggleItemTax = (idx) => {
    const next = [...items];
    next[idx].taxable = next[idx].taxable === false ? true : false;
    updateFormData("suggested_items", next);
  };

  const removeItem = (idx) => {
    const next = items.filter((_, i) => i !== idx);
    updateFormData("suggested_items", next);
  };

  const { subtotal, taxAmount, total, itemsWithCalc } = useMemo(() => {
    const itemsCalc = items.map(item => {
      const basePrice = Number(item.price || 0);
      const discountPercent = Number(item.discount_percent || 0);
      const priceAfterDiscount = basePrice - (basePrice * (discountPercent / 100));
      const itemTotal = priceAfterDiscount * Number(item.quantity || 1);
      return { ...item, itemTotal, priceAfterDiscount };
    });

    const subtotalVal = itemsCalc.reduce((sum, item) => sum + item.itemTotal, 0);
    
    const taxableAmount = itemsCalc.reduce((sum, item) => {
      return sum + (item.taxable !== false ? item.itemTotal : 0);
    }, 0);
    
    const taxVal = taxableAmount * taxRate;
    const totalVal = subtotalVal + taxVal;

    return {
      subtotal: subtotalVal,
      taxAmount: taxVal,
      total: totalVal,
      itemsWithCalc: itemsCalc
    };
  }, [items, taxRate]);

  const checklistItems = Array.isArray(formData.checklist_items) ?
    formData.checklist_items.map((item) => item.label || item) :
    [];

  return (
    <div className="space-y-6">
      {/* Cliente */}
      <div className="bg-gradient-to-br from-blue-900/20 to-blue-800/10 rounded-lg p-6 border border-blue-500/20">
        <div className="flex items-center gap-3 mb-4">
          <User className="w-6 h-6 text-blue-400" />
          <h3 className="text-lg font-semibold text-white">Cliente</h3>
        </div>
        <div className="space-y-2 text-sm">
          <p className="text-gray-300">
            <span className="font-medium">Nombre:</span> {formData.customer.name} {formData.customer.last_name}
          </p>
          <p className="text-gray-300">
            <span className="font-medium">Teléfono:</span> {formData.customer.phone}
          </p>
          {formData.customer.email && (
            <p className="text-gray-300">
              <span className="font-medium">Email:</span> {formData.customer.email}
            </p>
          )}
        </div>
      </div>

      {/* Dispositivo */}
      <div className="bg-gradient-to-br from-purple-900/20 to-purple-800/10 rounded-lg p-6 border border-purple-500/20">
        <div className="flex items-center gap-3 mb-4">
          <Smartphone className="w-6 h-6 text-purple-400" />
          <h3 className="text-lg font-semibold text-white">Dispositivo</h3>
        </div>
        <div className="space-y-2 text-sm">
          <p className="text-gray-300">
            <span className="font-medium">Marca:</span> {formData.device_brand || "—"}
          </p>
          <p className="text-gray-300">
            <span className="font-medium">Modelo:</span> {formData.device_model || "—"}
          </p>
          {formData.device_serial && (
            <p className="text-gray-300">
              <span className="font-medium">Serial/IMEI:</span> {formData.device_serial}
            </p>
          )}
          {formData.initial_problem && (
            <p className="text-gray-300 mt-3">
              <span className="font-medium">Problema:</span> {formData.initial_problem}
            </p>
          )}
        </div>
      </div>

      {/* Técnico Asignado */}
      {technicians && technicians.length > 0 && (
        <div className="bg-gradient-to-br from-cyan-600/10 to-emerald-600/10 backdrop-blur-xl border border-cyan-500/20 rounded-2xl p-5 shadow-[0_8px_32px_rgba(0,168,232,0.2)]">
          <h3 className="text-base font-bold text-white mb-4 flex items-center gap-2">
            <Users className="w-5 h-5 text-cyan-400" />
            👤 Técnico Asignado
          </h3>

          <p className="text-xs text-gray-400 mb-3">Selecciona el técnico que trabajará en esta orden (opcional)</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => {
                updateFormData("assigned_to_id", null);
                updateFormData("assigned_to_name", "");
              }}
              className={`px-4 py-3 rounded-xl text-sm border-2 transition-all text-left ${
                !formData.assigned_to_id ?
                "bg-gradient-to-br from-cyan-600/80 to-emerald-800/80 border-cyan-300/50 text-white shadow-lg shadow-cyan-600/30" :
                "bg-black/30 backdrop-blur-sm border-white/10 text-gray-100 hover:border-cyan-400/40 hover:bg-white/10"
              }`}>
              <div className="flex items-center gap-2">
                <Users className="w-4 h-4" />
                <span>Sin asignar</span>
              </div>
              <p className="text-xs text-gray-400 mt-1">Se asignará después</p>
            </button>

            {technicians.map((tech) => {
              const isSelected = formData.assigned_to_id === tech.id;
              return (
                <button
                  key={tech.id}
                  type="button"
                  onClick={() => {
                    updateFormData("assigned_to_id", tech.id);
                    updateFormData("assigned_to_name", tech.full_name || tech.email);
                  }}
                  className={`px-4 py-3 rounded-xl text-sm border-2 transition-all text-left ${
                    isSelected ?
                    "bg-gradient-to-br from-cyan-600/80 to-emerald-800/80 border-cyan-300/50 text-white shadow-lg shadow-cyan-600/30" :
                    "bg-black/30 backdrop-blur-sm border-white/10 text-gray-100 hover:border-cyan-400/40 hover:bg-white/10"
                  }`}>
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-cyan-500 to-emerald-600 flex items-center justify-center text-white font-bold text-sm">
                      {(tech.full_name || tech.email || "?").charAt(0).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold truncate">{tech.full_name || tech.email}</p>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>

          {formData.assigned_to_name && (
            <div className="mt-3 bg-emerald-600/10 border border-emerald-500/30 rounded-lg p-3">
              <p className="text-xs text-emerald-300">
                ✓ Asignado a: <span className="font-bold">{formData.assigned_to_name}</span>
              </p>
            </div>
          )}
        </div>
      )}

      {/* Sugerencias */}
      <SuggestedItemsPanel formData={formData} updateFormData={updateFormData} />

      {/* Items con descuentos individuales */}
      {items.length > 0 && (
        <div className="bg-gradient-to-br from-emerald-900/20 to-teal-900/10 rounded-lg border border-emerald-500/20 overflow-hidden">
          <div className="bg-black/30 px-6 py-4 border-b border-emerald-500/20">
            <div className="flex items-center gap-3">
              <Package className="w-5 h-5 text-emerald-400" />
              <h3 className="text-lg font-semibold text-white">Piezas y Servicios</h3>
            </div>
          </div>

          <div className="p-4 space-y-2">
            {itemsWithCalc.map((item, idx) => (
              <div key={idx} className="bg-black/40 border border-white/10 rounded-lg p-3 space-y-2">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-white text-sm font-medium">{item.name}</p>
                    <div className="flex items-center gap-2 mt-1 flex-wrap">
                      <Badge variant="outline" className="text-[10px] border-gray-700 text-gray-400">
                        ${Number(item.price).toFixed(2)} c/u
                      </Badge>
                      <Badge variant="outline" className="text-[10px] border-gray-700 text-gray-400">
                        {item.type === 'service' ? 'Servicio' : 'Producto'}
                      </Badge>
                      {item.discount_percent > 0 && (
                        <Badge className="text-[10px] bg-orange-600/20 text-orange-400 border-orange-500/30">
                          -{item.discount_percent}% desc
                        </Badge>
                      )}
                      {item.taxable === false && (
                        <Badge className="text-[10px] bg-blue-600/20 text-blue-400 border-blue-500/30">
                          Sin IVU
                        </Badge>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <div className="flex items-center gap-1">
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-11 w-11 text-gray-400 hover:text-white"
                        onClick={() => updateItemQuantity(idx, item.quantity - 1)}
                        aria-label={`Disminuir cantidad de ${item.name}`}
                      >
                        <span className="text-lg">−</span>
                      </Button>
                      <span className="text-white text-sm w-8 text-center font-medium">{item.quantity}</span>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-11 w-11 text-gray-400 hover:text-white"
                        onClick={() => updateItemQuantity(idx, item.quantity + 1)}
                        aria-label={`Aumentar cantidad de ${item.name}`}
                      >
                        <span className="text-lg">+</span>
                      </Button>
                    </div>
                    <span className="text-emerald-400 font-bold text-sm min-w-[60px] text-right">
                      ${item.itemTotal.toFixed(2)}
                    </span>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-7 w-7 text-red-400 hover:text-red-300"
                      onClick={() => removeItem(idx)}
                      aria-label={`Eliminar ${item.name}`}
                    >
                      <span className="text-lg">×</span>
                    </Button>
                  </div>
                </div>

                {/* Controles por item */}
                <div className="flex items-center gap-3 pt-2 border-t border-white/5">
                  <div className="flex items-center gap-2 flex-1">
                    <label className="text-xs text-gray-400 whitespace-nowrap">Desc. %</label>
                    <Input
                      type="number"
                      min="0"
                      max="100"
                      step="1"
                      value={item.discount_percent || 0}
                      onChange={(e) => updateItemDiscount(idx, e.target.value)}
                      className="h-7 w-20 bg-black/40 border-orange-500/30 text-white text-right text-xs"
                    />
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <label className="text-xs text-gray-400 whitespace-nowrap">IVU</label>
                    <button
                      onClick={() => toggleItemTax(idx)}
                      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                        item.taxable !== false ? 'bg-emerald-600' : 'bg-gray-600'
                      }`}
                    >
                      <span
                        className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                          item.taxable !== false ? 'translate-x-6' : 'translate-x-1'
                        }`}
                      />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Resumen financiero - Adaptado para móvil */}
          <div className="bg-emerald-950/20 px-4 sm:px-6 py-3 sm:py-4 border-t border-emerald-500/20 space-y-1.5 sm:space-y-2">
            <div className="flex justify-between text-xs sm:text-sm">
              <span className="text-gray-400">Subtotal</span>
              <span className="text-white font-medium">${subtotal.toFixed(2)}</span>
            </div>
            
            <div className="flex justify-between text-xs sm:text-sm">
              <span className="text-gray-400">IVU ({(taxRate * 100).toFixed(1)}%)</span>
              <span className="text-white font-medium">${taxAmount.toFixed(2)}</span>
            </div>

            <div className="flex justify-between pt-2 border-t border-emerald-500/20">
              <span className="text-emerald-400 text-sm sm:text-base font-bold">Total Estimado</span>
              <span className="text-emerald-400 font-bold text-lg sm:text-2xl">${total.toFixed(2)}</span>
            </div>
          </div>
        </div>
      )}

      {/* Firma */}
      {formData.signature && (
        <div className="bg-gradient-to-br from-indigo-900/20 to-indigo-800/10 rounded-lg p-6 border border-indigo-500/20">
          <div className="flex items-center gap-3 mb-4">
            <FileSignature className="w-6 h-6 text-indigo-400" />
            <h3 className="text-lg font-semibold text-white">Customer signature</h3>
          </div>
          <div className="bg-white rounded-lg p-4">
            <img
              src={formData.signature}
              alt="Customer signature"
              className="mx-auto max-w-full h-auto"
              style={{ maxHeight: "200px" }}
            />
          </div>
          <p className="text-xs text-gray-400 text-center mt-3">Digitally captured signature</p>
        </div>
      )}

      <p className="text-[10px] text-gray-500 mt-3 text-center">*Verifica la información antes de crear la orden.</p>

      {/* Botones de acción */}
      <div className="flex items-center justify-end gap-2 pt-4 border-t border-white/10">
        <Button
          variant="outline"
          onClick={onBack}
          disabled={loading}
          className="border-white/15 theme-light:border-gray-300">
          ← Atrás
        </Button>
        
        {onAddAnotherDevice && (
          <Button
            variant="outline"
            onClick={onAddAnotherDevice}
            disabled={loading}
            className="border-cyan-500/30 text-cyan-400 hover:bg-cyan-600/20 theme-light:border-cyan-300 theme-light:text-cyan-700">
            <Plus className="w-4 h-4 mr-2" />
            Añadir otro equipo
          </Button>
        )}

        <Button
          onClick={onSubmit}
          disabled={loading}
          className="bg-gradient-to-r from-cyan-600 to-emerald-700 hover:from-cyan-700 hover:to-emerald-800">
          {loading ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Creando...
            </>
          ) : (
            "✓ Crear Orden"
          )}
        </Button>
      </div>
    </div>
  );
}
