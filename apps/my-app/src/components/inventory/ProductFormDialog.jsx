import React, { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { base44 } from "@/api/base44Client";
import { Camera, Trash2, Package, DollarSign, AlertCircle } from "lucide-react";

export default function ProductFormDialog({ open, onClose, product = null, onSuccess }) {
  const [formData, setFormData] = useState({
    name: "",
    sku: "",
    type: "product",
    price: "",
    cost: "",
    category: "screen",
    description: "",
    stock: "",
    min_stock: "5",
    taxable: true,
    is_serialized: false,
    barcode: "",
    compatibility_models: "",
    active: true
  });
  
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (open && product) {
      setFormData({
        name: product.name || "",
        sku: product.sku || "",
        type: product.type || "product",
        price: String(product.price || ""),
        cost: String(product.cost || ""),
        category: product.category || "screen",
        description: product.description || "",
        stock: String(product.stock || ""),
        min_stock: String(product.min_stock || "5"),
        taxable: product.taxable !== false,
        is_serialized: product.is_serialized || false,
        barcode: product.barcode || "",
        compatibility_models: Array.isArray(product.compatibility_models) 
          ? product.compatibility_models.join(", ") 
          : product.compatibility_models || "",
        active: product.active !== false
      });
    } else if (open) {
      setFormData({
        name: "",
        sku: "",
        type: "product",
        price: "",
        cost: "",
        category: "screen",
        description: "",
        stock: "",
        min_stock: "5",
        taxable: true,
        is_serialized: false,
        barcode: "",
        compatibility_models: "",
        active: true
      });
    }
  }, [open, product]);

  const handleSubmit = async () => {
    if (!formData.name.trim() || !formData.price || !formData.cost) {
      alert("Completa los campos requeridos: Nombre, Precio de Venta, Precio de Compra");
      return;
    }

    setLoading(true);
    try {
      const data = {
        name: formData.name.trim(),
        sku: formData.sku.trim(),
        type: formData.type,
        price: parseFloat(formData.price) || 0,
        cost: parseFloat(formData.cost) || 0,
        category: formData.category,
        description: formData.description.trim(),
        stock: parseInt(formData.stock) || 0,
        min_stock: parseInt(formData.min_stock) || 5,
        taxable: formData.taxable,
        is_serialized: formData.is_serialized,
        barcode: formData.barcode.trim(),
        compatibility_models: formData.compatibility_models
          .split(",")
          .map(m => m.trim())
          .filter(Boolean),
        active: formData.active
      };

      if (product) {
        await base44.entities.Product.update(product.id, data);
      } else {
        await base44.entities.Product.create(data);
      }

      onSuccess?.();
      onClose();
    } catch (error) {
      console.error("Error saving product:", error);
      alert("Error al guardar producto");
    } finally {
      setLoading(false);
    }
  };

  const handleDuplicate = () => {
    setFormData({
      ...formData,
      name: `${formData.name} (Copia)`,
      sku: formData.sku ? `${formData.sku}-COPY` : "",
      barcode: ""
    });
  };

  // Calcular margen de ganancia
  const profit = formData.price && formData.cost 
    ? parseFloat(formData.price) - parseFloat(formData.cost) 
    : 0;
  const profitPercent = formData.price && formData.cost 
    ? ((parseFloat(formData.price) - parseFloat(formData.cost)) / parseFloat(formData.cost)) * 100 
    : 0;

  // Verificar stock bajo
  const currentStock = parseInt(formData.stock) || 0;
  const minStock = parseInt(formData.min_stock) || 5;
  const isLowStock = currentStock <= minStock && currentStock > 0;
  const isOutOfStock = currentStock <= 0;

  if (!open) return null;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto bg-[#111114] border-white/10">
        <DialogHeader className="border-b border-white/10 pb-4">
          <div className="flex items-center justify-between">
            <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-lg">
              <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <DialogTitle className="text-xl font-semibold text-white">
              {product ? "Editar Producto" : "Crear Producto / Servicio"}
            </DialogTitle>
            <button 
              onClick={() => product && confirm("¿Eliminar este producto?") && onSuccess?.()}
              className="p-2 hover:bg-white/10 rounded-lg">
              <Trash2 className="w-5 h-5 text-gray-400" />
            </button>
          </div>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* SECCIÓN 1: INFORMACIÓN BÁSICA */}
          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wide flex items-center gap-2">
              <Package className="w-4 h-4" />
              Información Básica
            </h3>

            {/* Nombre y SKU */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <Label className="text-gray-300 font-medium mb-2 block">
                  Nombre del Producto *
                </Label>
                <Input
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Ej: Pantalla iPhone 14"
                  className="bg-black/40 border-white/15 text-white"
                />
              </div>
              <div>
                <Label className="text-gray-300 font-medium mb-2 block">SKU / Código</Label>
                <Input
                  value={formData.sku}
                  onChange={(e) => setFormData({ ...formData, sku: e.target.value })}
                  placeholder="18419"
                  className="bg-black/40 border-white/15 text-white"
                />
              </div>
            </div>

            {/* Tipo y Categoría */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <Label className="text-gray-300 font-medium mb-2 block">Tipo *</Label>
                <select
                  value={formData.type}
                  onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                  className="w-full h-10 px-3 rounded-md bg-black/40 border border-white/15 text-white">
                  <option value="product">Producto / Pieza</option>
                  <option value="service">Servicio</option>
                </select>
              </div>

              {formData.type === "product" && (
                <div>
                  <Label className="text-gray-300 font-medium mb-2 block">Categoría</Label>
                  <select
                    value={formData.category}
                    onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                    className="w-full h-10 px-3 rounded-md bg-black/40 border border-white/15 text-white">
                    <option value="diagnostic">Diagnóstico</option>
                    <option value="screen">Pantallas</option>
                    <option value="battery">Baterías</option>
                    <option value="charger">Cargadores</option>
                    <option value="cable">Cables</option>
                    <option value="case">Fundas/Cases</option>
                    <option value="other">Otro</option>
                  </select>
                </div>
              )}
            </div>

            {/* Descripción */}
            <div>
              <Label className="text-gray-300 font-medium mb-2 block">Descripción</Label>
              <Textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Detalles del producto o servicio..."
                className="bg-black/40 border-white/15 text-white min-h-[80px]"
              />
            </div>
          </div>

          {/* SECCIÓN 2: PRECIOS Y COSTOS */}
          <div className="space-y-4 p-4 bg-black/40 rounded-lg border border-white/10">
            <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wide flex items-center gap-2">
              <DollarSign className="w-4 h-4" />
              Precios y Costos
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Precio de Compra (Costo) */}
              <div>
                <Label className="text-gray-300 font-medium mb-2 block">
                  Precio de Compra (Costo) *
                </Label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">$</span>
                  <Input
                    type="number"
                    step="0.01"
                    value={formData.cost}
                    onChange={(e) => setFormData({ ...formData, cost: e.target.value })}
                    placeholder="100.00"
                    className="bg-black/40 border-white/15 text-white pl-7"
                  />
                </div>
                <p className="text-xs text-gray-500 mt-1">Lo que te cuesta a ti</p>
              </div>

              {/* Precio de Venta */}
              <div>
                <Label className="text-gray-300 font-medium mb-2 block">
                  Precio de Venta (Cliente) *
                </Label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">$</span>
                  <Input
                    type="number"
                    step="0.01"
                    value={formData.price}
                    onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                    placeholder="175.00"
                    className="bg-black/40 border-white/15 text-white pl-7"
                  />
                </div>
                <p className="text-xs text-gray-500 mt-1">Lo que cobra el cliente</p>
              </div>
            </div>

            {/* Margen de ganancia */}
            {formData.price && formData.cost && (
              <div className={`p-3 rounded-lg border ${
                profit > 0 
                  ? "bg-emerald-600/10 border-emerald-600/30" 
                  : "bg-red-600/10 border-red-600/30"
              }`}>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-300">Margen de Ganancia:</span>
                  <div className="text-right">
                    <span className={`text-lg font-bold ${
                      profit > 0 ? "text-emerald-400" : "text-red-400"
                    }`}>
                      ${profit.toFixed(2)}
                    </span>
                    <span className={`text-sm ml-2 ${
                      profit > 0 ? "text-emerald-300" : "text-red-300"
                    }`}>
                      ({profitPercent.toFixed(1)}%)
                    </span>
                  </div>
                </div>
              </div>
            )}

            {/* IVU Toggle */}
            <div className="flex items-center justify-between p-3 bg-white/5 rounded-lg border border-white/10">
              <div>
                <Label className="text-gray-300 font-medium">¿Lleva IVU (Impuestos)?</Label>
                <p className="text-xs text-gray-500 mt-1">
                  Se aplicará 11.5% de IVU en el cobro
                </p>
              </div>
              <button
                onClick={() => setFormData({ ...formData, taxable: !formData.taxable })}
                className={`relative w-14 h-7 rounded-full transition-colors ${
                  formData.taxable ? "bg-red-600" : "bg-gray-600"
                }`}>
                <span
                  className={`absolute top-1 left-1 w-5 h-5 bg-white rounded-full transition-transform ${
                    formData.taxable ? "translate-x-7" : ""
                  }`}
                />
              </button>
            </div>
          </div>

          {/* SECCIÓN 3: INVENTARIO (solo productos) */}
          {formData.type === "product" && (
            <div className="space-y-4 p-4 bg-black/40 rounded-lg border border-white/10">
              <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wide flex items-center gap-2">
                <AlertCircle className="w-4 h-4" />
                Control de Inventario
              </h3>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Stock Actual */}
                <div>
                  <Label className="text-gray-300 font-medium mb-2 block">
                    Cantidad en Stock (Actual)
                  </Label>
                  <Input
                    type="number"
                    value={formData.stock}
                    onChange={(e) => setFormData({ ...formData, stock: e.target.value })}
                    placeholder="0"
                    className="bg-black/40 border-white/15 text-white"
                  />
                  <p className="text-xs text-gray-500 mt-1">Cuánto tienes ahora</p>
                </div>

                {/* Stock Mínimo */}
                <div>
                  <Label className="text-gray-300 font-medium mb-2 block">
                    Stock Mínimo (Alerta)
                  </Label>
                  <Input
                    type="number"
                    value={formData.min_stock}
                    onChange={(e) => setFormData({ ...formData, min_stock: e.target.value })}
                    placeholder="5"
                    className="bg-black/40 border-white/15 text-white"
                  />
                  <p className="text-xs text-gray-500 mt-1">Cuánto debes tener mínimo</p>
                </div>
              </div>

              {/* Alerta de stock */}
              {isOutOfStock && (
                <div className="p-3 bg-red-600/10 border border-red-600/30 rounded-lg flex items-center gap-2">
                  <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0" />
                  <div>
                    <p className="text-red-300 font-semibold text-sm">⚠️ Producto Agotado</p>
                    <p className="text-red-200/70 text-xs">No hay stock disponible</p>
                  </div>
                </div>
              )}

              {isLowStock && !isOutOfStock && (
                <div className="p-3 bg-amber-600/10 border border-amber-600/30 rounded-lg flex items-center gap-2">
                  <AlertCircle className="w-5 h-5 text-amber-400 flex-shrink-0" />
                  <div>
                    <p className="text-amber-300 font-semibold text-sm">⚠️ Stock Bajo</p>
                    <p className="text-amber-200/70 text-xs">
                      Stock actual: {currentStock} | Mínimo: {minStock}
                    </p>
                  </div>
                </div>
              )}

              {!isLowStock && !isOutOfStock && currentStock > 0 && (
                <div className="p-3 bg-emerald-600/10 border border-emerald-600/30 rounded-lg flex items-center gap-2">
                  <AlertCircle className="w-5 h-5 text-emerald-400 flex-shrink-0" />
                  <div>
                    <p className="text-emerald-300 font-semibold text-sm">✅ Stock Óptimo</p>
                    <p className="text-emerald-200/70 text-xs">
                      Hay suficiente inventario ({currentStock} unidades)
                    </p>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* SECCIÓN 4: INFORMACIÓN ADICIONAL */}
          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wide">
              Información Adicional
            </h3>

            {/* Compatible con modelos */}
            <div>
              <Label className="text-gray-300 font-medium mb-2 block">
                Compatibilidad / Modelos
              </Label>
              <Input
                value={formData.compatibility_models}
                onChange={(e) => setFormData({ ...formData, compatibility_models: e.target.value })}
                placeholder="Ej: iPhone 14, iPhone 14 Plus, iPhone 15"
                className="bg-black/40 border-white/15 text-white"
              />
              <p className="text-xs text-gray-500 mt-1">Separa por comas</p>
            </div>

            {/* Item serializado */}
            <div className="flex items-center justify-between p-3 bg-white/5 rounded-lg border border-white/10">
              <div>
                <Label className="text-gray-300 font-medium">¿Item serializado?</Label>
                <p className="text-xs text-gray-500 mt-1">
                  Cada unidad tiene número de serie único
                </p>
              </div>
              <button
                onClick={() => setFormData({ ...formData, is_serialized: !formData.is_serialized })}
                className={`relative w-14 h-7 rounded-full transition-colors ${
                  formData.is_serialized ? "bg-red-600" : "bg-gray-600"
                }`}>
                <span
                  className={`absolute top-1 left-1 w-5 h-5 bg-white rounded-full transition-transform ${
                    formData.is_serialized ? "translate-x-7" : ""
                  }`}
                />
              </button>
            </div>

            {/* Código de barras */}
            <div>
              <Label className="text-gray-300 font-medium mb-2 block">
                Código de barras (opcional)
              </Label>
              <div className="flex gap-2">
                <Input
                  value={formData.barcode}
                  onChange={(e) => setFormData({ ...formData, barcode: e.target.value })}
                  placeholder="Escanea o escribe el código"
                  className="bg-black/40 border-white/15 text-white flex-1"
                />
                <Button variant="outline" size="icon" className="h-10 w-10 border-white/15">
                  <Camera className="w-5 h-5" />
                </Button>
              </div>
            </div>
          </div>

          {/* Botones de acción secundarios */}
          <div className="grid grid-cols-2 gap-3 pt-4 border-t border-white/10">
            <Button
              variant="outline"
              onClick={handleDuplicate}
              className="border-white/15">
              <Package className="w-4 h-4 mr-2" />
              Duplicar
            </Button>
            <Button
              variant="outline"
              className="border-white/15">
              Serializar
            </Button>
          </div>
        </div>

        {/* Botón principal */}
        <div className="border-t border-white/10 pt-4 sticky bottom-0 bg-[#111114]">
          <Button
            onClick={handleSubmit}
            disabled={loading}
            className="w-full bg-red-600 hover:bg-red-700 h-12 text-base font-semibold">
            {loading ? "Guardando..." : product ? "Actualizar Producto" : "Crear Producto"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
