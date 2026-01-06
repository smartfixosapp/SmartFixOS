import React, { useMemo, useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { User, Smartphone, Package, DollarSign, FileSignature, Plus, Loader2, Users } from "lucide-react";

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

  const subtotal = useMemo(() => {
    return items.reduce((sum, item) => sum + Number(item.price || 0) * Number(item.quantity || 1), 0);
  }, [items]);

  const taxAmount = subtotal * taxRate;
  const total = subtotal + taxAmount;

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

      {/* Totales */}
      {items.length > 0 && (
        <div className="bg-gradient-to-br from-gray-900/40 to-black/40 rounded-lg p-6 border border-white/10">
          <div className="flex items-center gap-3 mb-4">
            <DollarSign className="w-6 h-6 text-green-400" />
            <h3 className="text-lg font-semibold text-white">Financial summary</h3>
          </div>
          <div className="space-y-3 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-400">Subtotal:</span>
              <span className="text-white font-medium">${subtotal.toFixed(2)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">Tax ({(taxRate * 100).toFixed(1)}%):</span>
              <span className="text-white font-medium">${taxAmount.toFixed(2)}</span>
            </div>
            <div className="flex justify-between pt-3 border-t border-white/10">
              <span className="text-lg font-bold text-white">Total:</span>
              <span className="text-lg font-bold text-green-400">${total.toFixed(2)}</span>
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
