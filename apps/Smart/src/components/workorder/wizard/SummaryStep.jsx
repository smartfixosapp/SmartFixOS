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
      <div className="apple-card p-6">
        <div className="flex items-center justify-center py-8">
          <Loader2 className="w-6 h-6 text-apple-green animate-spin mr-3" />
          <span className="apple-text-body apple-label-secondary">Loading suggestions...</span>
        </div>
      </div>
    );
  }

  if (!formData.device_model) {
    return (
      <div className="apple-card p-6">
        <h3 className="apple-text-headline apple-label-primary mb-2">Suggested parts</h3>
        <p className="apple-text-subheadline apple-label-secondary">Select a device model to see suggestions</p>
      </div>
    );
  }

  if (suggestions.length === 0) {
    return (
      <div className="apple-card p-6">
        <h3 className="apple-text-headline apple-label-primary mb-2">Suggested parts for this device</h3>
        <p className="apple-text-subheadline apple-label-tertiary">No suggestions available for this model</p>
      </div>
    );
  }

  return (
    <div className="apple-card p-6">
      <div className="flex items-center gap-3 mb-4">
        <div className="w-9 h-9 rounded-apple-sm bg-apple-green/15 text-apple-green flex items-center justify-center">
          <Package className="w-5 h-5" />
        </div>
        <h3 className="apple-text-headline apple-label-primary">Suggested parts for this device</h3>
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
              className={`apple-press p-4 rounded-apple-lg text-left transition-all ${
                isSelected
                  ? "bg-apple-green/15 ring-1 ring-apple-green/40"
                  : "bg-gray-sys6 dark:bg-gray-sys5 hover:bg-apple-green/10"
              }`}
            >
              <div className="flex items-start justify-between gap-2 mb-2">
                <p className="apple-text-subheadline apple-label-primary line-clamp-2 flex-1 font-medium">{item.name}</p>
                <div className={`w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 ${
                  isSelected ? "bg-apple-green text-white" : "bg-gray-sys5 dark:bg-gray-sys4 apple-label-tertiary"
                }`}>
                  {isSelected && <Plus className="w-4 h-4 rotate-45" />}
                  {!isSelected && <Plus className="w-4 h-4" />}
                </div>
              </div>

              <div className="flex items-center justify-between">
                <span className="apple-text-subheadline text-apple-green font-semibold tabular-nums">
                  ${(item.price || 0).toFixed(2)}
                </span>
                {stock > 0 ? (
                  <span className={`apple-text-caption1 tabular-nums ${isLowStock ? "text-apple-yellow" : "apple-label-tertiary"}`}>
                    Stock: {stock}
                  </span>
                ) : (
                  <span className="apple-text-caption1 text-apple-red">Out of stock</span>
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
    <div className="apple-type space-y-6">
      {/* Cliente */}
      <div className="apple-card p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-9 h-9 rounded-apple-sm bg-apple-blue/15 text-apple-blue flex items-center justify-center">
            <User className="w-5 h-5" />
          </div>
          <h3 className="apple-text-headline apple-label-primary">Cliente</h3>
        </div>
        <div className="space-y-2">
          <p className="apple-text-subheadline apple-label-secondary">
            <span className="apple-label-primary font-medium">Nombre:</span> {formData.customer.name} {formData.customer.last_name}
          </p>
          <p className="apple-text-subheadline apple-label-secondary">
            <span className="apple-label-primary font-medium">Teléfono:</span> <span className="tabular-nums">{formData.customer.phone}</span>
          </p>
          {formData.customer.email && (
            <p className="apple-text-subheadline apple-label-secondary">
              <span className="apple-label-primary font-medium">Email:</span> {formData.customer.email}
            </p>
          )}
        </div>
      </div>

      {/* Dispositivo */}
      <div className="apple-card p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-9 h-9 rounded-apple-sm bg-apple-purple/12 text-apple-purple flex items-center justify-center">
            <Smartphone className="w-5 h-5" />
          </div>
          <h3 className="apple-text-headline apple-label-primary">Dispositivo</h3>
        </div>
        <div className="space-y-2">
          <p className="apple-text-subheadline apple-label-secondary">
            <span className="apple-label-primary font-medium">Marca:</span> {formData.device_brand || "—"}
          </p>
          <p className="apple-text-subheadline apple-label-secondary">
            <span className="apple-label-primary font-medium">Modelo:</span> {formData.device_model || "—"}
          </p>
          {formData.device_serial && (
            <p className="apple-text-subheadline apple-label-secondary">
              <span className="apple-label-primary font-medium">Serial/IMEI:</span> <span className="tabular-nums">{formData.device_serial}</span>
            </p>
          )}
          {formData.initial_problem && (
            <p className="apple-text-subheadline apple-label-secondary mt-3">
              <span className="apple-label-primary font-medium">Problema:</span> {formData.initial_problem}
            </p>
          )}
        </div>
      </div>

      {/* Técnico Asignado */}
      {technicians && technicians.length > 0 && (
        <div className="apple-card p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-9 h-9 rounded-apple-sm bg-apple-indigo/12 text-apple-indigo flex items-center justify-center">
              <Users className="w-5 h-5" />
            </div>
            <h3 className="apple-text-headline apple-label-primary">Técnico Asignado</h3>
          </div>

          <p className="apple-text-footnote apple-label-tertiary mb-3">Selecciona el técnico que trabajará en esta orden (opcional)</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => {
                updateFormData("assigned_to_id", null);
                updateFormData("assigned_to_name", "");
              }}
              className={`apple-press px-4 py-3 rounded-apple-md text-left transition-all ${
                !formData.assigned_to_id ?
                "bg-apple-indigo/12 ring-1 ring-apple-indigo/40 text-apple-indigo" :
                "bg-gray-sys6 dark:bg-gray-sys5 apple-label-primary hover:bg-apple-indigo/10"
              }`}>
              <div className="flex items-center gap-2">
                <Users className="w-4 h-4" />
                <span className="apple-text-subheadline font-medium">Sin asignar</span>
              </div>
              <p className="apple-text-caption1 apple-label-tertiary mt-1">Se asignará después</p>
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
                  className={`apple-press px-4 py-3 rounded-apple-md text-left transition-all ${
                    isSelected ?
                    "bg-apple-indigo/12 ring-1 ring-apple-indigo/40 text-apple-indigo" :
                    "bg-gray-sys6 dark:bg-gray-sys5 apple-label-primary hover:bg-apple-indigo/10"
                  }`}>
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-full bg-apple-indigo/15 text-apple-indigo flex items-center justify-center font-semibold apple-text-subheadline">
                      {(tech.full_name || tech.email || "?").charAt(0).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="apple-text-subheadline font-semibold truncate">{tech.full_name || tech.email}</p>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>

          {formData.assigned_to_name && (
            <div className="mt-3 bg-apple-green/15 rounded-apple-md p-3">
              <p className="apple-text-footnote text-apple-green">
                ✓ Asignado a: <span className="font-semibold">{formData.assigned_to_name}</span>
              </p>
            </div>
          )}
        </div>
      )}

      {/* Sugerencias */}
      <SuggestedItemsPanel formData={formData} updateFormData={updateFormData} />

      {/* Items con descuentos individuales */}
      {items.length > 0 && (
        <div className="apple-card overflow-hidden">
          <div className="px-6 py-4" style={{ borderBottom: "0.5px solid rgb(var(--separator) / 0.29)" }}>
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-apple-sm bg-apple-green/15 text-apple-green flex items-center justify-center">
                <Package className="w-5 h-5" />
              </div>
              <h3 className="apple-text-headline apple-label-primary">Piezas y Servicios</h3>
            </div>
          </div>

          <div className="p-4 space-y-2">
            {itemsWithCalc.map((item, idx) => (
              <div key={idx} className="bg-gray-sys6 dark:bg-gray-sys5 rounded-apple-md p-3 space-y-2">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="apple-text-subheadline apple-label-primary font-medium">{item.name}</p>
                    <div className="flex items-center gap-2 mt-1 flex-wrap">
                      <Badge variant="outline" className="apple-text-caption2 apple-label-tertiary tabular-nums">
                        ${Number(item.price).toFixed(2)} c/u
                      </Badge>
                      <Badge variant="outline" className="apple-text-caption2 apple-label-tertiary">
                        {item.type === 'service' ? 'Servicio' : 'Producto'}
                      </Badge>
                      {item.discount_percent > 0 && (
                        <Badge className="apple-text-caption2 bg-apple-orange/15 text-apple-orange border-transparent tabular-nums">
                          -{item.discount_percent}% desc
                        </Badge>
                      )}
                      {item.taxable === false && (
                        <Badge className="apple-text-caption2 bg-apple-blue/12 text-apple-blue border-transparent">
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
                        className="apple-press h-11 w-11 apple-label-secondary hover:apple-label-primary"
                        onClick={() => updateItemQuantity(idx, item.quantity - 1)}
                        aria-label={`Disminuir cantidad de ${item.name}`}
                      >
                        <span className="text-lg">−</span>
                      </Button>
                      <span className="apple-text-subheadline apple-label-primary w-8 text-center font-medium tabular-nums">{item.quantity}</span>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="apple-press h-11 w-11 apple-label-secondary hover:apple-label-primary"
                        onClick={() => updateItemQuantity(idx, item.quantity + 1)}
                        aria-label={`Aumentar cantidad de ${item.name}`}
                      >
                        <span className="text-lg">+</span>
                      </Button>
                    </div>
                    <span className="text-apple-green font-semibold apple-text-subheadline min-w-[60px] text-right tabular-nums">
                      ${item.itemTotal.toFixed(2)}
                    </span>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="apple-press h-11 w-11 text-apple-red hover:text-apple-red"
                      onClick={() => removeItem(idx)}
                      aria-label={`Eliminar ${item.name}`}
                    >
                      <span className="text-lg">×</span>
                    </Button>
                  </div>
                </div>

                {/* Controles por item */}
                <div className="flex items-center gap-3 pt-2" style={{ borderTop: "0.5px solid rgb(var(--separator) / 0.29)" }}>
                  <div className="flex items-center gap-2 flex-1">
                    <label className="apple-text-caption1 apple-label-tertiary whitespace-nowrap">Desc. %</label>
                    <Input
                      type="number"
                      min="0"
                      max="100"
                      step="1"
                      value={item.discount_percent || 0}
                      onChange={(e) => updateItemDiscount(idx, e.target.value)}
                      className="apple-input h-7 w-20 text-right apple-text-caption1 tabular-nums"
                    />
                  </div>

                  <div className="flex items-center gap-2">
                    <label className="apple-text-caption1 apple-label-tertiary whitespace-nowrap">IVU</label>
                    <button
                      onClick={() => toggleItemTax(idx)}
                      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                        item.taxable !== false ? 'bg-apple-green' : 'bg-gray-sys4'
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

          {/* Resumen financiero */}
          <div className="px-4 sm:px-6 py-3 sm:py-4 space-y-1.5 sm:space-y-2" style={{ borderTop: "0.5px solid rgb(var(--separator) / 0.29)" }}>
            <div className="flex justify-between">
              <span className="apple-text-subheadline apple-label-secondary">Subtotal</span>
              <span className="apple-text-subheadline apple-label-primary font-medium tabular-nums">${subtotal.toFixed(2)}</span>
            </div>

            <div className="flex justify-between">
              <span className="apple-text-subheadline apple-label-secondary tabular-nums">IVU ({(taxRate * 100).toFixed(1)}%)</span>
              <span className="apple-text-subheadline apple-label-primary font-medium tabular-nums">${taxAmount.toFixed(2)}</span>
            </div>

            <div className="flex justify-between pt-2" style={{ borderTop: "0.5px solid rgb(var(--separator) / 0.29)" }}>
              <span className="apple-text-headline text-apple-green font-semibold">Total Estimado</span>
              <span className="apple-text-title2 text-apple-green font-bold tabular-nums">${total.toFixed(2)}</span>
            </div>
          </div>
        </div>
      )}

      {/* Firma */}
      {formData.signature && (
        <div className="apple-card p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-9 h-9 rounded-apple-sm bg-apple-indigo/12 text-apple-indigo flex items-center justify-center">
              <FileSignature className="w-5 h-5" />
            </div>
            <h3 className="apple-text-headline apple-label-primary">Customer signature</h3>
          </div>
          <div className="bg-white rounded-apple-md p-4">
            <img
              src={formData.signature}
              alt="Customer signature"
              className="mx-auto max-w-full h-auto"
              style={{ maxHeight: "200px" }}
            />
          </div>
          <p className="apple-text-caption1 apple-label-tertiary text-center mt-3">Digitally captured signature</p>
        </div>
      )}

      <p className="apple-text-caption2 apple-label-tertiary mt-3 text-center">*Verifica la información antes de crear la orden.</p>

      {/* Botones de acción */}
      <div className="flex items-center justify-end gap-2 pt-4" style={{ borderTop: "0.5px solid rgb(var(--separator) / 0.29)" }}>
        <Button
          variant="outline"
          onClick={onBack}
          disabled={loading}
          className="apple-btn apple-btn-secondary apple-press">
          ← Atrás
        </Button>

        {onAddAnotherDevice && (
          <Button
            variant="outline"
            onClick={onAddAnotherDevice}
            disabled={loading}
            className="apple-btn apple-btn-tinted apple-press">
            <Plus className="w-4 h-4 mr-2" />
            Añadir otro equipo
          </Button>
        )}

        <Button
          onClick={onSubmit}
          disabled={loading}
          className="apple-btn apple-btn-primary apple-press">
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
