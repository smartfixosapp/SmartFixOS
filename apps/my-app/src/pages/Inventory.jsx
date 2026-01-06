// === Inventory.jsx — ORGANIZADO POR CATEGORÍAS DE DISPOSITIVOS ===
// iPhone, iPad, MacBook → Pantallas, Baterías, Servicios

import React, { useState, useEffect, useMemo } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  Search, Plus, Smartphone, Tablet, Laptop, AlertTriangle,
  FileText, Upload, Trash2, Edit, ChevronLeft, ChevronRight,
  Globe, Tag, CheckSquare, Monitor, Battery, Wrench, Box,
  Sparkles, Settings } from
"lucide-react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter // 👈 DialogFooter añadido
} from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";

import SuppliersDialog from "../components/inventory/SuppliersDialog";
import PurchaseOrderDialog from "../components/inventory/PurchaseOrderDialog";
import PurchaseOrderDetailDialog from "../components/inventory/PurchaseOrderDetailDialog";
import NotificationService from "../components/notifications/NotificationService";
import DiscountBadge, { formatPriceWithDiscount } from "../components/inventory/DiscountBadge";
import SetDiscountDialog from "../components/inventory/SetDiscountDialog";
import ManageCategoriesDialog from "../components/inventory/ManageCategoriesDialog";
import InventoryReports from "../components/inventory/InventoryReports";
import InventoryChatbot from "../components/inventory/InventoryChatbot";

const money = (n) => `$${Number(n || 0).toFixed(2)}`;

const ICON_MAP = {
  Smartphone, Tablet, Laptop, Monitor, Box, Battery, Wrench,
  Watch: Smartphone, Headphones: Box, Speaker: Box, Camera: Box,
  Gamepad: Box, Cpu: Box, HardDrive: Box, Wifi: Wrench, Cable: Wrench
};

// === Tarjeta de inventario ===
function InventoryCard({ item, onEdit, onDelete, onSelect, isSelected }) {
  const st = item.stock <= 0 ? { tag: "Agotado", color: "text-red-400" } :
  item.stock <= (item.min_stock || 0) ? { tag: "Bajo", color: "text-amber-400" } :
  { tag: "OK", color: "text-emerald-400" };

  const priceInfo = formatPriceWithDiscount(item);

  return (
    <div
      className={`bg-[#111]/70 border rounded-2xl p-4 flex flex-col gap-3 hover:shadow-[0_8px_32px_rgba(0,168,232,0.2)] transition theme-light:bg-white theme-light:border-gray-200 ${
      isSelected ? 'border-orange-500 bg-orange-600/10 ring-2 ring-orange-500/40' : 'border-cyan-500/20 hover:border-cyan-500/50'}`
      }
      onClick={() => onSelect?.(item)}>

      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-2 flex-1 min-w-0">
          <div
            className={`w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 ${
            isSelected ? 'bg-orange-500 border-orange-500' : 'border-cyan-500/40'}`
            }>

            {isSelected && <CheckSquare className="w-4 h-4 text-white" />}
          </div>

          <div className="flex-1 min-w-0">
            <p className="font-semibold text-white leading-tight truncate theme-light:text-gray-900">
              {item.name || "—"}
            </p>
            <div className="flex items-center gap-1.5 mt-1 flex-wrap">
              <Badge className="text-[10px] bg-cyan-600/20 text-cyan-300 border-cyan-600/30 theme-light:bg-cyan-100 theme-light:text-cyan-700">
                {item.device_category || "Otros"}
              </Badge>
              <Badge className="text-[10px] bg-emerald-600/20 text-emerald-300 border-emerald-600/30 theme-light:bg-emerald-100 theme-light:text-emerald-700">
                {item.part_type || "Pieza"}
              </Badge>
            </div>
          </div>
        </div>

        <div className="flex gap-1 flex-shrink-0">
          <Button
            size="icon"
            variant="ghost"
            className="h-7 w-7 text-orange-400 hover:text-orange-300 hover:bg-orange-600/10"
            onClick={(e) => {
              e.stopPropagation();
              // Seleccionamos el producto y abrimos el modal de oferta inmediatamente
              onSelect?.(item, true); // true indica abrir modal
            }}
            title="Configurar Oferta"
          >
            <Tag className="w-4 h-4" />
          </Button>
          <Button
            size="icon"
            variant="ghost"
            className="h-7 w-7 hover:bg-cyan-600/10"
            onClick={(e) => {e.stopPropagation();onEdit(item);}}>

            <Edit className="w-4 h-4" />
          </Button>
          <Button
            size="icon"
            variant="ghost"
            className="h-7 w-7 text-red-300 hover:text-red-200 hover:bg-red-600/10"
            onClick={(e) => {e.stopPropagation();onDelete(item);}}>

            <Trash2 className="w-4 h-4" />
          </Button>
        </div>
      </div>

      <DiscountBadge product={item} />

      <div className="flex items-end justify-between gap-3">
        <div>
          <div className="flex items-baseline gap-2">
            <p className="text-lg font-bold text-emerald-300 theme-light:text-emerald-600">
              {money(priceInfo.finalPrice)}
            </p>
            {priceInfo.originalPrice &&
            <p className="text-sm text-gray-500 line-through">{money(priceInfo.originalPrice)}</p>
            }
          </div>
          {priceInfo.savings > 0 &&
          <p className="text-xs text-orange-400">Ahorras {money(priceInfo.savings)}</p>
          }
          <p className="text-xs text-white/30 theme-light:text-gray-500">
            Costo {money(item.cost)}
          </p>
        </div>

        <div className="text-right">
          <p className={`text-lg font-semibold ${st.color}`}>{Number(item.stock || 0)}</p>
          <p className="text-[10px] text-white/30 theme-light:text-gray-500">{st.tag}</p>
        </div>
      </div>

      {item.compatibility_models?.length > 0 &&
      <p className="text-[11px] text-white/35 line-clamp-2 theme-light:text-gray-500">
          Compatible: {item.compatibility_models.join(", ")}
        </p>
      }

      {Number(item.stock || 0) > 0 && Number(item.stock || 0) <= Number(item.min_stock || 0) &&
      <div className="flex items-center gap-2 text-[11px] text-amber-200 bg-amber-500/10 border border-amber-400/30 px-2 py-1 rounded-md theme-light:bg-amber-50 theme-light:text-amber-700">
          <AlertTriangle className="w-3.5 h-3.5" />
          Bajo stock
        </div>
      }
    </div>);

}

// === Modal para crear/editar item ===
function InventoryItemDialog({
  open,
  onOpenChange,
  value,
  onSave,
  deviceCategories,
  partTypes,
  accessoryCategories,
  currentDeviceCategory,
  currentPartType,
  suppliers
}) {
  const [form, setForm] = useState({
    name: "",
    tipo_principal: "dispositivos",
    subcategoria: "piezas_servicios",
    device_category: "",
    part_type: "",
    price: "",
    cost: "",
    stock: "",
    min_stock: "",
    supplier_id: "",
    supplier_name: "",
    description: "",
    compatibility_models_text: "",
    device_imei: "",
    device_condition: "excelente",
    device_storage: "",
    device_color: "",
    device_carrier: "",
    device_battery_health: "",
    device_warranty: false,
    device_warranty_months: ""
  });

  useEffect(() => {
    if (value) {
      setForm({
        ...value,
        tipo_principal: value.tipo_principal || "dispositivos",
        subcategoria: value.subcategoria || "piezas_servicios",
        price: value.price || "",
        cost: value.cost || "",
        stock: value.stock || "",
        min_stock: value.min_stock || "",
        supplier_id: value.supplier_id || "",
        supplier_name: value.supplier_name || "",
        description: value.description || "",
        compatibility_models_text: Array.isArray(value.compatibility_models) ?
        value.compatibility_models.join("\n") : "",
        device_imei: value.device_imei || "",
        device_condition: value.device_condition || "excelente",
        device_storage: value.device_storage || "",
        device_color: value.device_color || "",
        device_carrier: value.device_carrier || "",
        device_battery_health: value.device_battery_health || "",
        device_warranty: value.device_warranty || false,
        device_warranty_months: value.device_warranty_months || ""
      });
    } else {
      const defaultCategory = currentDeviceCategory || deviceCategories[0]?.icon || deviceCategories[0]?.name?.toLowerCase() || "iphone";
      const defaultPartType = currentPartType !== "all" ? currentPartType : partTypes[0]?.slug || "pantalla";

      setForm({
        name: "",
        tipo_principal: "dispositivos",
        subcategoria: "piezas_servicios",
        device_category: defaultCategory,
        part_type: defaultPartType,
        price: "",
        cost: "",
        stock: "",
        min_stock: "",
        supplier_id: "",
        supplier_name: "",
        description: "",
        compatibility_models_text: "",
        device_imei: "",
        device_condition: "excelente",
        device_storage: "",
        device_color: "",
        device_carrier: "",
        device_battery_health: "",
        device_warranty: false,
        device_warranty_months: ""
      });
    }
  }, [value, open, deviceCategories, partTypes, currentDeviceCategory, currentPartType]);

  const handleSave = async () => {
    if (!form.name?.trim()) {
      toast.error("El nombre es requerido");
      return;
    }
    if (!form.device_category) {
      toast.error("La categoría de dispositivo es requerida");
      return;
    }
    if (!form.part_type) {
      toast.error("El tipo de pieza/servicio es requerido");
      return;
    }
    if (Number(form.price) <= 0) {
      toast.error("El precio de venta debe ser mayor a 0");
      return;
    }
    if (Number(form.cost) <= 0) {
      toast.error("El costo debe ser mayor a 0");
      return;
    }

    const selectedSupplier = suppliers?.find((s) => s.id === form.supplier_id);

    const payload = {
      name: form.name.trim(),
      tipo_principal: form.tipo_principal || "dispositivos",
      subcategoria: form.subcategoria,
      price: Number(form.price || 0),
      cost: Number(form.cost || 0),
      stock: Number(form.stock || 0),
      min_stock: Number(form.min_stock || 0),
      category: `${form.device_category}_${form.part_type}`,
      device_category: form.device_category,
      part_type: form.part_type,
      supplier_id: form.supplier_id || "",
      supplier_name: selectedSupplier?.name || form.supplier_name?.trim() || "",
      description: form.description?.trim() || "",
      active: true,
      compatibility_models: (form.compatibility_models_text || "").
      split("\n").
      map((s) => s.trim()).
      filter(Boolean)
    };

    // Agregar campos de dispositivo completo si aplica
    if (form.subcategoria === "dispositivo_completo") {
      payload.device_imei = form.device_imei?.trim() || "";
      payload.device_condition = form.device_condition || "excelente";
      payload.device_storage = form.device_storage?.trim() || "";
      payload.device_color = form.device_color?.trim() || "";
      payload.device_carrier = form.device_carrier?.trim() || "";
      payload.device_battery_health = form.device_battery_health ? Number(form.device_battery_health) : null;
      payload.device_warranty = form.device_warranty || false;
      payload.device_warranty_months = form.device_warranty_months ? Number(form.device_warranty_months) : null;
    }

    if (value?.id) {
      payload.id = value.id;
    }

    console.log("💾 Guardando:", payload);
    await onSave?.(payload, form.device_category, form.part_type);
  };

  const selectedPartType = partTypes.find((pt) => pt.slug === form.part_type);
  const isService = selectedPartType?.slug === "servicio";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-[#0f0f10] border border-cyan-500/20 w-[95vw] max-w-2xl max-h-[85vh] p-0 gap-0 theme-light:bg-white theme-light:border-gray-200 flex flex-col">
        <DialogHeader className="px-4 pt-4 pb-2 border-b border-cyan-500/20 theme-light:border-gray-200 flex-shrink-0">
          <DialogTitle className="text-white text-lg theme-light:text-gray-900">
            {value?.id ? "Editar producto" : "Agregar producto"}
          </DialogTitle>
        </DialogHeader>

        <div className="overflow-y-auto px-4 py-4 space-y-4 flex-1" style={{ WebkitOverflowScrolling: 'touch' }}>
          <div>
            <label className="text-xs text-white/50 mb-2 block theme-light:text-gray-600">Categoría Principal *</label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setForm((f) => ({ ...f, tipo_principal: "dispositivos" }))}
                className={`flex items-center justify-center gap-2 px-4 py-4 rounded-xl border-2 text-base font-bold transition-all ${
                form.tipo_principal === "dispositivos" ?
                "bg-gradient-to-r from-cyan-600 to-emerald-600 text-white border-transparent shadow-lg" :
                "bg-white/5 border-white/10 text-white/60 hover:bg-white/10 theme-light:bg-gray-100 theme-light:border-gray-300"}`
                }>
                <Smartphone className="w-5 h-5 flex-shrink-0" />
                <span>Dispositivos</span>
              </button>
              <button
                type="button"
                onClick={() => setForm((f) => ({ ...f, tipo_principal: "accesorios" }))}
                className={`flex items-center justify-center gap-2 px-4 py-4 rounded-xl border-2 text-base font-bold transition-all ${
                form.tipo_principal === "accesorios" ?
                "bg-gradient-to-r from-purple-600 to-pink-600 text-white border-transparent shadow-lg" :
                "bg-white/5 border-white/10 text-white/60 hover:bg-white/10 theme-light:bg-gray-100 theme-light:border-gray-300"}`
                }>
                <Box className="w-5 h-5 flex-shrink-0" />
                <span>Accesorios</span>
              </button>
            </div>
          </div>

          {form.tipo_principal === "dispositivos" &&
          <>
              <div>
                <label className="text-xs text-white/50 mb-2 block theme-light:text-gray-600">Subcategoría *</label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                  type="button"
                  onClick={() => setForm((f) => ({ ...f, subcategoria: "dispositivo_completo" }))}
                  className={`flex items-center justify-center gap-2 px-3 py-3 rounded-lg border-2 text-sm font-bold transition-all ${
                  form.subcategoria === "dispositivo_completo" ?
                  "bg-gradient-to-r from-blue-600 to-indigo-600 text-white border-transparent shadow-lg" :
                  "bg-white/5 border-white/10 text-white/60 hover:bg-white/10 theme-light:bg-gray-100 theme-light:border-gray-300"}`
                  }>
                    <Smartphone className="w-4 h-4 flex-shrink-0" />
                    <span>Dispositivo Completo</span>
                  </button>
                  <button
                  type="button"
                  onClick={() => setForm((f) => ({ ...f, subcategoria: "piezas_servicios" }))}
                  className={`flex items-center justify-center gap-2 px-3 py-3 rounded-lg border-2 text-sm font-bold transition-all ${
                  form.subcategoria === "piezas_servicios" ?
                  "bg-gradient-to-r from-cyan-600 to-emerald-600 text-white border-transparent shadow-lg" :
                  "bg-white/5 border-white/10 text-white/60 hover:bg-white/10 theme-light:bg-gray-100 theme-light:border-gray-300"}`
                  }>
                    <Wrench className="w-4 h-4 flex-shrink-0" />
                    <span>Piezas/Servicios</span>
                  </button>
                </div>
              </div>

              <div>
                <label className="text-xs text-white/50 mb-2 block theme-light:text-gray-600">Tipo de Dispositivo</label>
                <div className="grid grid-cols-2 gap-2">
                  {deviceCategories.map((cat) => {
                  const IconComponent = ICON_MAP[cat.icon_name] || Smartphone;
                  const catValue = cat.icon || cat.name.toLowerCase();
                  return (
                    <button
                      key={cat.id}
                      type="button"
                      onClick={() => setForm((f) => ({ ...f, device_category: catValue }))}
                      className={`flex items-center gap-2 px-3 py-3 rounded-lg border text-sm font-medium transition-all ${
                      form.device_category === catValue ?
                      "bg-gradient-to-r from-cyan-600 to-emerald-600 text-white border-transparent shadow-lg" :
                      "bg-white/5 border-white/10 text-white/60 hover:bg-white/10 theme-light:bg-gray-100 theme-light:border-gray-300"}`
                      }>

                        <IconComponent className="w-4 h-4 flex-shrink-0" />
                        <span className="truncate">{cat.name}</span>
                      </button>);

                })}
                </div>
              </div>
            </>
          }

          {form.tipo_principal === "accesorios" &&
          <div>
              <label className="text-xs text-white/50 mb-2 block theme-light:text-gray-600">Tipo de Accesorio *</label>
              <div className="grid grid-cols-2 gap-2">
                {accessoryCategories.length === 0 ?
              <div className="col-span-2 text-center py-4">
                    <p className="text-white/40 text-xs theme-light:text-gray-600">
                      No hay categorías de accesorios. Créalas en "Gestionar Categorías"
                    </p>
                  </div> :

              accessoryCategories.map((acc) => {
                const IconComponent = ICON_MAP[acc.icon_name] || Box;
                return (
                  <button
                    key={acc.id}
                    type="button"
                    onClick={() => setForm((f) => ({ ...f, subcategoria: acc.slug, device_category: "accesorios" }))}
                    className={`flex items-center gap-2 px-3 py-3 rounded-lg border text-sm font-medium transition-all ${
                    form.subcategoria === acc.slug ?
                    "bg-gradient-to-r from-purple-600 to-pink-600 text-white border-transparent shadow-lg" :
                    "bg-white/5 border-white/10 text-white/60 hover:bg-white/10 theme-light:bg-gray-100 theme-light:border-gray-300"}`
                    }>
                        <IconComponent className="w-4 h-4 flex-shrink-0" />
                        <span className="truncate">{acc.name}</span>
                      </button>);

              })
              }
              </div>
            </div>
          }

          {form.tipo_principal === "dispositivos" && form.subcategoria === "piezas_servicios" &&
          <div>
              <label className="text-xs text-white/50 mb-2 block theme-light:text-gray-600">Tipo de Pieza/Servicio *</label>
              <div className="grid grid-cols-2 gap-2">
                {partTypes.map((type) => {
                const IconComponent = ICON_MAP[type.icon_name] || Monitor;
                return (
                  <button
                    key={type.id}
                    type="button"
                    onClick={() => setForm((f) => ({ ...f, part_type: type.slug }))}
                    className={`flex items-center gap-2 px-3 py-3 rounded-lg border text-sm font-medium transition-all ${
                    form.part_type === type.slug ?
                    "bg-gradient-to-r from-cyan-600 to-emerald-600 text-white border-transparent shadow-lg" :
                    "bg-white/5 border-white/10 text-white/60 hover:bg-white/10 theme-light:bg-gray-100 theme-light:border-gray-300"}`
                    }>

                      <IconComponent className="w-4 h-4 flex-shrink-0" />
                      <span className="truncate">{type.name}</span>
                    </button>);

              })}
              </div>
            </div>
          }

          <div>
            <label className="text-xs text-white/50 mb-1 block theme-light:text-gray-600">Nombre *</label>
            <Input
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              placeholder={form.subcategoria === "dispositivo_completo" ? "Ej: iPhone 14 Pro 256GB Azul" : "Ej: Pantalla iPhone 14 Pro"} className="bg-black/20 text-slate-50 px-3 py-1 text-base rounded-md flex h-9 w-full border shadow-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 md:text-sm border-cyan-500/20 theme-light:bg-white theme-light:border-gray-300" />


          </div>

          {/* Campos específicos para dispositivos completos */}
          {form.subcategoria === "dispositivo_completo" &&
          <>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-white/50 mb-1 block theme-light:text-gray-600">IMEI</label>
                  <Input
                  value={form.device_imei}
                  onChange={(e) => setForm((f) => ({ ...f, device_imei: e.target.value }))}
                  placeholder="Opcional"
                  className="bg-black/20 border-cyan-500/20 theme-light:bg-white theme-light:border-gray-300" />
                </div>
                <div>
                  <label className="text-xs text-white/50 mb-1 block theme-light:text-gray-600">Almacenamiento</label>
                  <Input
                  value={form.device_storage}
                  onChange={(e) => setForm((f) => ({ ...f, device_storage: e.target.value }))}
                  placeholder="Ej: 256GB"
                  className="bg-black/20 border-cyan-500/20 theme-light:bg-white theme-light:border-gray-300" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-white/50 mb-1 block theme-light:text-gray-600">Color</label>
                  <Input
                  value={form.device_color}
                  onChange={(e) => setForm((f) => ({ ...f, device_color: e.target.value }))}
                  placeholder="Ej: Azul"
                  className="bg-black/20 border-cyan-500/20 theme-light:bg-white theme-light:border-gray-300" />
                </div>
                <div>
                  <label className="text-xs text-white/50 mb-1 block theme-light:text-gray-600">Operadora</label>
                  <Input
                  value={form.device_carrier}
                  onChange={(e) => setForm((f) => ({ ...f, device_carrier: e.target.value }))}
                  placeholder="Ej: Unlocked"
                  className="bg-black/20 border-cyan-500/20 theme-light:bg-white theme-light:border-gray-300" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-white/50 mb-1 block theme-light:text-gray-600">Condición *</label>
                  <select
                  value={form.device_condition}
                  onChange={(e) => setForm((f) => ({ ...f, device_condition: e.target.value }))}
                  className="w-full h-10 px-3 rounded-md bg-black/20 border border-cyan-500/20 text-white theme-light:bg-white theme-light:border-gray-300 theme-light:text-gray-900">
                    <option value="nuevo">Nuevo</option>
                    <option value="como_nuevo">Como Nuevo</option>
                    <option value="excelente">Excelente</option>
                    <option value="bueno">Bueno</option>
                    <option value="aceptable">Aceptable</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs text-white/50 mb-1 block theme-light:text-gray-600">Salud de Batería (%)</label>
                  <Input
                  type="number"
                  min="0"
                  max="100"
                  value={form.device_battery_health}
                  onChange={(e) => setForm((f) => ({ ...f, device_battery_health: e.target.value }))}
                  placeholder="Ej: 95"
                  className="bg-black/20 border-cyan-500/20 theme-light:bg-white theme-light:border-gray-300" />
                </div>
              </div>

              <div className="flex items-center gap-4">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                  type="checkbox"
                  checked={form.device_warranty}
                  onChange={(e) => setForm((f) => ({ ...f, device_warranty: e.target.checked }))}
                  className="w-4 h-4 rounded border-cyan-500/30" />
                  <span className="text-sm text-white/70 theme-light:text-gray-700">Con garantía</span>
                </label>
                {form.device_warranty &&
              <div className="flex-1">
                    <Input
                  type="number"
                  min="0"
                  value={form.device_warranty_months}
                  onChange={(e) => setForm((f) => ({ ...f, device_warranty_months: e.target.value }))}
                  placeholder="Meses de garantía"
                  className="bg-black/20 border-cyan-500/20 theme-light:bg-white theme-light:border-gray-300" />
                  </div>
              }
              </div>
            </>
          }

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-white/50 mb-1 block theme-light:text-gray-600">Precio *</label>
              <Input
                type="number"
                step="0.01"
                value={form.price}
                onChange={(e) => setForm((f) => ({ ...f, price: e.target.value }))}
                placeholder="0.00" className="bg-black/20 text-slate-50 px-3 py-1 text-base rounded-md flex h-9 w-full border shadow-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 md:text-sm border-cyan-500/20 theme-light:bg-white theme-light:border-gray-300" />


            </div>

            <div>
              <label className="text-xs text-white/50 mb-1 block theme-light:text-gray-600">Costo *</label>
              <Input
                type="number"
                step="0.01"
                value={form.cost}
                onChange={(e) => setForm((f) => ({ ...f, cost: e.target.value }))}
                placeholder="0.00" className="bg-black/20 text-slate-50 px-3 py-1 text-base rounded-md flex h-9 w-full border shadow-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 md:text-sm border-cyan-500/20 theme-light:bg-white theme-light:border-gray-300" />


            </div>
          </div>

          {!isService &&
          <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-white/50 mb-1 block theme-light:text-gray-600">Stock</label>
                <Input
                type="number"
                value={form.stock}
                onChange={(e) => setForm((f) => ({ ...f, stock: e.target.value }))}
                placeholder="0" className="bg-black/20 text-slate-50 px-3 py-1 text-base rounded-md flex h-9 w-full border shadow-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 md:text-sm border-cyan-500/20 theme-light:bg-white theme-light:border-gray-300" />


              </div>

              <div>
                <label className="text-xs text-white/50 mb-1 block theme-light:text-gray-600">Min</label>
                <Input
                type="number"
                value={form.min_stock}
                onChange={(e) => setForm((f) => ({ ...f, min_stock: e.target.value }))}
                placeholder="5" className="bg-black/20 text-slate-50 px-3 py-1 text-base rounded-md flex h-9 w-full border shadow-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 md:text-sm border-cyan-500/20 theme-light:bg-white theme-light:border-gray-300" />


              </div>
            </div>
          }

          <div>
            <label className="text-xs text-white/50 mb-1 block theme-light:text-gray-600">Proveedor</label>
            <select
              value={form.supplier_id}
              onChange={(e) => setForm((f) => ({ ...f, supplier_id: e.target.value }))}
              className="w-full h-10 px-3 rounded-md bg-black/20 border border-cyan-500/20 text-white theme-light:bg-white theme-light:border-gray-300 theme-light:text-gray-900">

              <option value="">Sin proveedor</option>
              {(suppliers || []).filter((s) => s.active !== false).map((sup) =>
              <option key={sup.id} value={sup.id}>{sup.name}</option>
              )}
            </select>
          </div>

          <div>
            <label className="text-xs text-white/50 mb-1 block theme-light:text-gray-600">Descripción</label>
            <Textarea
              value={form.description}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              placeholder="Opcional"
              className="bg-black/20 border-cyan-500/20 h-16 theme-light:bg-white theme-light:border-gray-300" />

          </div>

          <div>
            <label className="text-xs text-white/50 mb-1 block theme-light:text-gray-600">Modelos compatibles</label>
            <Textarea
              value={form.compatibility_models_text}
              onChange={(e) => setForm((f) => ({ ...f, compatibility_models_text: e.target.value }))}
              placeholder="Uno por línea (opcional)" className="bg-black/20 text-slate-50 px-3 py-2 text-base rounded-md flex min-h-[60px] w-full border shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 md:text-sm border-cyan-500/20 h-16 theme-light:bg-white theme-light:border-gray-300" />


          </div>
        </div>

        <DialogFooter className="px-4 py-4 border-t border-cyan-500/20 flex-row gap-2 bg-[#0f0f10] theme-light:bg-white theme-light:border-gray-200 flex-shrink-0">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            className="border-white/15 flex-1 theme-light:border-gray-300">

            Cancelar
          </Button>
          <Button
            onClick={handleSave}
            className="bg-gradient-to-r from-cyan-600 to-emerald-700 flex-1">

            Guardar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>);

}



// === Componente principal ===
export default function Inventory() {
  const [items, setItems] = useState([]);
  const [poList, setPoList] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [workOrders, setWorkOrders] = useState([]);
  const [deviceCategories, setDeviceCategories] = useState([]);
  const [partTypes, setPartTypes] = useState([]);
  const [accessoryCategories, setAccessoryCategories] = useState([]);
  const [deviceCategory, setDeviceCategory] = useState(null);
  const [partTypeFilter, setPartTypeFilter] = useState("all");
  const [q, setQ] = useState("");
  const [showItemDialog, setShowItemDialog] = useState(false);
  const [editing, setEditing] = useState(null);
  const [showSuppliers, setShowSuppliers] = useState(false);
  const [showPODialog, setShowPODialog] = useState(false);
  const [showPOMenu, setShowPOMenu] = useState(false);
  const [showPOList, setShowPOList] = useState(false);
  const [editingPO, setEditingPO] = useState(null);
  const [showPODetail, setShowPODetail] = useState(false);
  const [viewingPO, setViewingPO] = useState(null);
  const [selectedProducts, setSelectedProducts] = useState([]);
  const [showDiscountDialog, setShowDiscountDialog] = useState(false);
  const [viewTab, setViewTab] = useState("products");
  const [page, setPage] = useState(1);
  const [mainCategory, setMainCategory] = useState("dispositivos");
  const [showReports, setShowReports] = useState(false);
  const [showManageCategories, setShowManageCategories] = useState(false);
  const [viewMode, setViewMode] = useState("reports"); // reports | products | categories
  const pageSize = 24;

  useEffect(() => {
    loadInventory();
  }, []);

  const loadInventory = async () => {
    try {
      const [pRes, poRes, supRes, woRes, catRes, ptRes, accRes] = await Promise.allSettled([
      base44.entities.Product?.list?.() ?? [],
      base44.entities.PurchaseOrder?.list?.("-created_date", 100) ?? [],
      base44.entities.Supplier?.list?.("-created_date") ?? [],
      base44.entities.Order?.list?.("-created_date", 100) ?? [],
      base44.entities.DeviceCategory?.list?.() ?? [],
      base44.entities.PartType?.list?.() ?? [],
      base44.entities.AccessoryCategory?.list?.() ?? []]
      );

      const prods = pRes.status === "fulfilled" ? pRes.value || [] : [];
      const cats = catRes.status === "fulfilled" ? catRes.value || [] : [];
      const pts = ptRes.status === "fulfilled" ? ptRes.value || [] : [];
      const accs = accRes.status === "fulfilled" ? accRes.value || [] : [];

      console.log("📦 Inventario cargado:", {
        productos: prods.length,
        categorías: cats.length,
        tipos: pts.length,
        muestraProductos: prods.slice(0, 3).map((p) => ({
          name: p.name,
          device_category: p.device_category,
          part_type: p.part_type
        }))
      });

      setItems(prods);
      setPoList(poRes.status === "fulfilled" ? poRes.value || [] : []);
      setSuppliers(supRes.status === "fulfilled" ? supRes.value || [] : []);
      setWorkOrders(woRes.status === "fulfilled" ? woRes.value || [] : []);
      setDeviceCategories(cats);
      setPartTypes(pts);
      setAccessoryCategories(accs);

      if (!deviceCategory && cats.length > 0) {
        const initialCategory = cats[0].icon || cats[0].name.toLowerCase();
        console.log("🎯 Categoría inicial:", initialCategory);
        setDeviceCategory(initialCategory);
      }
    } catch (err) {
      console.error("Error loading inventory:", err);
    }
  };

  const filtered = useMemo(() => {
    console.log("🔍 Filtrando:", {
      total: items.length,
      mainCategory,
      deviceCategory,
      partTypeFilter,
      viewTab
    });

    let list = items.filter((item) => {
      // Filtrar por categoría principal
      if (mainCategory === "dispositivos") {
        // Mostrar solo dispositivos completos
        if (item.tipo_principal !== "dispositivos" || item.subcategoria !== "dispositivo_completo") return false;
        // Filtrar por categoría de dispositivo si está seleccionada
        if (deviceCategory && item.device_category !== deviceCategory) return false;
      } else if (mainCategory === "piezas") {
        // Mostrar solo piezas/servicios de dispositivos
        if (item.tipo_principal !== "dispositivos" || item.subcategoria !== "piezas_servicios") return false;
        // Filtrar por categoría de dispositivo si está seleccionada
        if (deviceCategory && item.device_category !== deviceCategory) return false;
        // Filtrar por tipo de pieza
        if (partTypeFilter !== "all" && item.part_type !== partTypeFilter) return false;

        // Filtrar por tabs de vista
        if (viewTab === "offers") {
          return item.discount_active === true && item.discount_percentage > 0;
        } else if (viewTab === "services") {
          return item.part_type === "servicio";
        } else if (viewTab === "products") {
          return item.part_type !== "servicio";
        }
      } else if (mainCategory === "accesorios") {
        // Mostrar solo accesorios
        if (item.tipo_principal !== "accesorios") return false;
        // Filtrar por subcategoría de accesorio si está seleccionada
        if (deviceCategory && item.subcategoria !== deviceCategory) return false;
      }

      return true;
    });

    // Búsqueda por texto
    if (q.trim()) {
      const t = q.toLowerCase();
      list = list.filter((it) =>
      String(it.name || "").toLowerCase().includes(t) ||
      String(it.supplier_name || "").toLowerCase().includes(t) ||
      Array.isArray(it.compatibility_models) &&
      it.compatibility_models.join(" ").toLowerCase().includes(t)
      );
    }

    console.log("✅ Items filtrados:", list.length);
    return list;
  }, [items, mainCategory, deviceCategory, partTypeFilter, viewTab, q]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize));
  const pageItems = filtered.slice((page - 1) * pageSize, page * pageSize);

  const handleSelectProduct = (item, openModal = false) => {
    if (openModal) {
      // Si openModal es true, seleccionamos solo este producto y abrimos el modal
      setSelectedProducts([item]);
      setShowDiscountDialog(true);
    } else {
      // Comportamiento normal de selección múltiple
      setSelectedProducts((prev) => {
        const isSelected = prev.some((p) => p.id === item.id);
        return isSelected ? prev.filter((p) => p.id !== item.id) : [...prev, item];
      });
    }
  };

  const handleSaveItem = async (payload, savedCategory, savedPartType) => {
    try {
      const oldStock = payload.id ? items.find((i) => i.id === payload.id)?.stock : null;

      if (payload.id) {
        console.log("✏️ Actualizando pieza:", payload.id, payload);
        await base44.entities.Product.update(payload.id, payload);

        const newStock = Number(payload.stock || 0);
        const minStock = Number(payload.min_stock || 5);

        if (newStock <= minStock && (oldStock === null || oldStock > minStock)) {
          const admins = await base44.entities.User.list();
          const eligibleUsers = (admins || []).filter((u) => u.role === "admin" || u.role === "manager");

          for (const targetUser of eligibleUsers) {
            if (!targetUser.id || !targetUser.email) continue;
            await NotificationService.createNotification({
              userId: targetUser.id,
              userEmail: targetUser.email,
              type: "low_stock",
              title: `⚠️ Stock bajo: ${payload.name}`,
              body: `Solo quedan ${newStock} unidades (mínimo: ${minStock})`,
              relatedEntityType: "product",
              relatedEntityId: payload.id,
              actionUrl: `/Inventory`,
              actionLabel: "Ver inventario",
              priority: newStock === 0 ? "urgent" : "high",
              metadata: {
                product_name: payload.name,
                current_stock: newStock,
                min_stock: minStock
              }
            });
          }
        }

        // Recargar inventario
        await loadInventory();
      } else {
        console.log("➕ Creando nueva pieza:", payload);
        const newItem = await base44.entities.Product.create(payload);
        console.log("✅ Pieza creada:", newItem);

        // 🔥 FIX: Esperar y recargar
        await new Promise((resolve) => setTimeout(resolve, 500));
        await loadInventory();

        // Cambiar a la vista correcta
        if (savedPartType === "servicio") {
          setViewTab("services");
        } else {
          setViewTab("products");
        }

        // Cambiar los filtros a la categoría/tipo del nuevo producto
        if (savedCategory) {
          console.log("🎯 Cambiando a categoría:", savedCategory);
          setDeviceCategory(savedCategory);
        }
        if (savedPartType && savedPartType !== "servicio") {
          console.log("🎯 Cambiando a tipo:", savedPartType);
          setPartTypeFilter(savedPartType);
        }
        setPage(1);
      }

      setShowItemDialog(false);
      setEditing(null);
      toast.success(payload.id ? "✅ Actualizado" : "✅ Pieza creada");
    } catch (err) {
      console.error("❌ Error:", err);
      toast.error("No se pudo guardar");
    }
  };

  const handleDeleteItem = async (item) => {
    if (!confirm(`¿Eliminar "${item.name}"?`)) return;
    try {
      // Verificar si el producto existe antes de eliminar
      const exists = items.find((x) => x.id === item.id);
      if (!exists) {
        toast.error("El producto ya no existe");
        await loadInventory();
        return;
      }

      await base44.entities.Product.delete(item.id);
      setItems((prev) => prev.filter((x) => x.id !== item.id));
      toast.success("Eliminado");
    } catch (err) {
      console.error("Error deleting:", err);

      // Manejar error específico de "not found"
      if (err.message?.includes("not found") || err.message?.includes("Not found")) {
        toast.error("El producto ya fue eliminado");
        await loadInventory();
      } else {
        toast.error("No se pudo eliminar");
      }
    }
  };

  const handleUploadPO = async (poId, file) => {
    try {
      const r = await base44.integrations.Core.UploadFile({ file });
      const fileUrl = r.file_url || r.url;
      if (fileUrl) {
        await base44.entities.PurchaseOrder.update(poId, { attachment_url: fileUrl });
        const po = await base44.entities.PurchaseOrder.list("-created_date", 100);
        setPoList(po || []);
        toast.success("PDF adjuntado");
      }
    } catch (err) {
      console.error("Error uploading PDF:", err);
      toast.error("No se pudo adjuntar");
    }
  };

  const handleDiscountSuccess = async () => {
    await loadInventory();
    setSelectedProducts([]);
    setShowDiscountDialog(false);
  };

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,#0f172a_0%,#020617_45%,#000_90%)] theme-light:bg-gray-50 p-4 sm:p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="bg-gradient-to-br from-cyan-600/10 to-emerald-600/10 backdrop-blur-xl border border-cyan-500/20 rounded-2xl p-6 mb-6 shadow-[0_8px_32px_rgba(0,168,232,0.3)] theme-light:bg-white theme-light:border-gray-200">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <div>
              <h1 className="text-3xl font-bold text-white flex items-center gap-3 theme-light:text-gray-900">
                <Sparkles className="w-8 h-8 text-cyan-500" />
                Inventario por Dispositivos
              </h1>
              <p className="text-gray-400 mt-2 theme-light:text-gray-600">
                Piezas y servicios organizados por tipo de equipo
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button 
                onClick={() => setViewMode("reports")} 
                variant={viewMode === "reports" ? "default" : "outline"}
                className={viewMode === "reports" 
                  ? "bg-gradient-to-r from-emerald-600 to-green-600" 
                  : "border-emerald-500/30 text-emerald-400 hover:bg-emerald-600/10 theme-light:border-emerald-300 theme-light:text-emerald-700"
                }
              >
                <FileText className="w-4 h-4 mr-2" />
                Reportes
              </Button>
              <Button 
                onClick={() => setViewMode("products")} 
                variant={viewMode === "products" ? "default" : "outline"}
                className={viewMode === "products" 
                  ? "bg-gradient-to-r from-cyan-600 to-emerald-600" 
                  : "border-cyan-500/30 text-cyan-400 hover:bg-cyan-600/10 theme-light:border-cyan-300 theme-light:text-cyan-700"
                }
              >
                <Box className="w-4 h-4 mr-2" />
                Productos
              </Button>
              <Button onClick={() => setShowManageCategories(true)} variant="outline" className="border-purple-500/30 text-purple-400 hover:bg-purple-600/10 theme-light:border-purple-300 theme-light:text-purple-700">
                <Settings className="w-4 h-4 mr-2" />
                Gestionar Categorías
              </Button>
              <Button onClick={() => setShowSuppliers(true)} variant="outline" className="bg-background text-slate-900 px-4 py-2 text-sm font-medium rounded-md inline-flex items-center justify-center gap-2 whitespace-nowrap transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 border shadow-sm hover:text-accent-foreground h-9 border-cyan-500/20 hover:bg-cyan-600/10 theme-light:border-gray-300">
                <Globe className="w-4 h-4 mr-2" />
                Proveedores
              </Button>
              <Button onClick={() => setShowPOMenu(true)} variant="outline" className="bg-background text-slate-900 px-4 py-2 text-sm font-medium rounded-md inline-flex items-center justify-center gap-2 whitespace-nowrap transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 border shadow-sm hover:text-accent-foreground h-9 border-cyan-500/20 hover:bg-cyan-600/10 theme-light:border-gray-300">
                <FileText className="w-4 h-4 mr-2" />
                Órdenes de Compra
              </Button>
              <Button onClick={() => {setEditing(null);setShowItemDialog(true);}} className="bg-gradient-to-r from-cyan-600 to-emerald-700 shadow-[0_4px_20px_rgba(0,168,232,0.4)]">
                <Plus className="w-5 h-5 mr-2" />
                Agregar Producto
              </Button>
              {selectedProducts.length > 0 &&
              <Button onClick={() => setShowDiscountDialog(true)} className="bg-gradient-to-r from-orange-600 to-red-700 animate-pulse">
                  <Tag className="w-4 h-4 mr-2" />
                  Oferta ({selectedProducts.length})
                </Button>
              }
            </div>
          </div>
        </div>

        {/* Vista de Reportes o Productos */}
        {viewMode === "reports" ? (
          <div className="bg-black/40 backdrop-blur-xl border border-cyan-500/20 rounded-2xl p-6 mb-6 theme-light:bg-white theme-light:border-gray-200">
            <InventoryReports 
              open={true} 
              onClose={() => {}} 
              isEmbedded={true}
            />
          </div>
        ) : (
          <>
        {/* NUEVO: Selector de categoría principal (Dispositivos/Piezas/Accesorios) */}
        <div className="bg-black/40 backdrop-blur-xl border border-cyan-500/20 rounded-2xl p-6 mb-6 theme-light:bg-white theme-light:border-gray-200">
          <div className="grid grid-cols-3 gap-3">
            <button
              onClick={() => {
                setMainCategory("dispositivos");
                setDeviceCategory(null);
                setPartTypeFilter("all");
                setPage(1);
              }}
              className={`flex items-center justify-center gap-2 px-6 py-5 rounded-xl border-2 transition-all ${
              mainCategory === "dispositivos" ?
              "bg-gradient-to-r from-cyan-600 to-emerald-600 text-white border-transparent shadow-[0_8px_32px_rgba(0,168,232,0.5)]" :
              "bg-white/5 border-white/10 text-white/60 hover:bg-white/10 theme-light:bg-gray-100 theme-light:border-gray-300"}`
              }>

              <Smartphone className="w-6 h-6" />
              <span className="font-bold text-lg">Dispositivos</span>
            </button>

            <button
              onClick={() => {
                setMainCategory("piezas");
                setDeviceCategory(null);
                setPartTypeFilter("all");
                setPage(1);
              }}
              className={`flex items-center justify-center gap-2 px-6 py-5 rounded-xl border-2 transition-all ${
              mainCategory === "piezas" ?
              "bg-gradient-to-r from-cyan-600 to-emerald-600 text-white border-transparent shadow-[0_8px_32px_rgba(0,168,232,0.5)]" :
              "bg-white/5 border-white/10 text-white/60 hover:bg-white/10 theme-light:bg-gray-100 theme-light:border-gray-300"}`
              }>

              <Wrench className="w-6 h-6" />
              <span className="font-bold text-lg">Piezas</span>
            </button>

            <button
              onClick={() => {
                setMainCategory("accesorios");
                setDeviceCategory(null);
                setPartTypeFilter("all");
                setPage(1);
              }}
              className={`flex items-center justify-center gap-2 px-6 py-5 rounded-xl border-2 transition-all ${
              mainCategory === "accesorios" ?
              "bg-gradient-to-r from-purple-600 to-pink-600 text-white border-transparent shadow-[0_8px_32px_rgba(168,85,247,0.5)]" :
              "bg-white/5 border-white/10 text-white/60 hover:bg-white/10 theme-light:bg-gray-100 theme-light:border-gray-300"}`
              }>

              <Box className="w-6 h-6" />
              <span className="font-bold text-lg">Accesorios</span>
            </button>
          </div>
        </div>

        {/* Categorías de dispositivos (solo si mainCategory === "dispositivos" o "piezas") */}
        {(mainCategory === "dispositivos" || mainCategory === "piezas") &&
        <div className="bg-black/40 backdrop-blur-xl border border-cyan-500/20 rounded-2xl p-6 mb-6 theme-light:bg-white theme-light:border-gray-200">
            <h2 className="text-white text-lg font-bold mb-4 flex items-center gap-2 theme-light:text-gray-900">
              <Smartphone className="w-5 h-5 text-cyan-400" />
              Categoría de Dispositivo
            </h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
              {deviceCategories.length === 0 ?
            <div className="col-span-full text-center py-8">
                  <p className="text-white/40 text-sm theme-light:text-gray-600">
                    No hay categorías. Crea una en "Gestionar Categorías"
                  </p>
                </div> :

            deviceCategories.map((cat) => {
              const IconComponent = ICON_MAP[cat.icon_name] || Smartphone;
              const catValue = cat.icon || cat.name.toLowerCase();
              const count = items.filter((i) => {
                if (mainCategory === "dispositivos") {
                  return i.tipo_principal === "dispositivos" && i.subcategoria === "dispositivo_completo" && i.device_category === catValue;
                } else {
                  return i.tipo_principal === "dispositivos" && i.subcategoria === "piezas_servicios" && i.device_category === catValue;
                }
              }).length;
              return (
                <button
                  key={cat.id}
                  onClick={() => {setDeviceCategory(catValue);setPage(1);}}
                  className={`flex flex-col items-center gap-3 p-4 rounded-xl border-2 transition-all ${
                  deviceCategory === catValue ?
                  "bg-gradient-to-br from-cyan-600 to-emerald-600 text-white border-transparent shadow-[0_8px_24px_rgba(0,168,232,0.4)]" :
                  "bg-white/5 border-white/10 text-white/60 hover:bg-white/10 hover:border-white/20 theme-light:bg-gray-50 theme-light:border-gray-300"}`
                  }>

                      <IconComponent className="w-8 h-8" />
                      <div className="text-center">
                        <p className="font-bold text-base">{cat.name}</p>
                        <p className="text-xs opacity-70">{count} items</p>
                      </div>
                    </button>);

            })
            }
            </div>
          </div>
        }

        {/* Categorías de accesorios (solo si mainCategory === "accesorios") */}
        {mainCategory === "accesorios" &&
        <div className="bg-black/40 backdrop-blur-xl border border-cyan-500/20 rounded-2xl p-6 mb-6 theme-light:bg-white theme-light:border-gray-200">
            <h2 className="text-white text-lg font-bold mb-4 flex items-center gap-2 theme-light:text-gray-900">
              <Box className="w-5 h-5 text-purple-400" />
              Tipo de Accesorio
            </h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
              {accessoryCategories.length === 0 ?
            <div className="col-span-full text-center py-8">
                  <p className="text-white/40 text-sm theme-light:text-gray-600">
                    No hay categorías de accesorios. Créalas en "Gestionar Categorías"
                  </p>
                </div> :

            accessoryCategories.map((acc) => {
              const IconComponent = ICON_MAP[acc.icon_name] || Box;
              const count = items.filter((i) => i.tipo_principal === "accesorios" && i.subcategoria === acc.slug).length;
              return (
                <button
                  key={acc.id}
                  onClick={() => {setDeviceCategory(acc.slug);setPage(1);}}
                  className={`flex flex-col items-center gap-3 p-4 rounded-xl border-2 transition-all ${
                  deviceCategory === acc.slug ?
                  "bg-gradient-to-br from-purple-600 to-pink-600 text-white border-transparent shadow-[0_8px_24px_rgba(168,85,247,0.4)]" :
                  "bg-white/5 border-white/10 text-white/60 hover:bg-white/10 hover:border-white/20 theme-light:bg-gray-50 theme-light:border-gray-300"}`
                  }>

                      <IconComponent className="w-8 h-8" />
                      <div className="text-center">
                        <p className="font-bold text-base">{acc.name}</p>
                        <p className="text-xs opacity-70">{count} items</p>
                      </div>
                    </button>);

            })
            }
            </div>
          </div>
        }

        {/* Filtros de tipo de pieza (solo para mainCategory === "piezas") */}
        {mainCategory === "piezas" &&
        <div className="bg-black/40 backdrop-blur-xl border border-cyan-500/20 rounded-2xl p-6 mb-6 theme-light:bg-white theme-light:border-gray-200">
            <h2 className="text-white text-lg font-bold mb-4 flex items-center gap-2 theme-light:text-gray-900">
              <Monitor className="w-5 h-5 text-emerald-400" />
              Tipo de Pieza
            </h2>
            <div className="flex flex-wrap gap-2">
              <button
              onClick={() => {setPartTypeFilter("all");setPage(1);}}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              partTypeFilter === "all" ?
              "bg-gradient-to-r from-cyan-600 to-emerald-600 text-white shadow-lg" :
              "bg-white/5 border border-white/10 text-white/60 hover:bg-white/10 theme-light:bg-gray-100 theme-light:border-gray-300"}`
              }>

                Todas
              </button>
              {partTypes.filter((pt) => pt.active !== false).map((type) => {
              const IconComponent = ICON_MAP[type.icon_name] || Monitor;
              const count = items.filter((i) => {
                return i.tipo_principal === "dispositivos" &&
                i.subcategoria === "piezas_servicios" &&
                i.part_type === type.slug && (
                !deviceCategory || i.device_category === deviceCategory);
              }).length;
              return (
                <button
                  key={type.id}
                  onClick={() => {setPartTypeFilter(type.slug);setPage(1);}}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                  partTypeFilter === type.slug ?
                  "bg-gradient-to-r from-cyan-600 to-emerald-600 text-white shadow-lg" :
                  "bg-white/5 border border-white/10 text-white/60 hover:bg-white/10 theme-light:bg-gray-100 theme-light:border-gray-300"}`
                  }>

                    <IconComponent className="w-4 h-4" />
                    {type.name} ({count})
                  </button>);

            })}
            </div>
          </div>
        }

        {/* Tabs Productos/Ofertas/Servicios (solo para mainCategory === "piezas") */}
        {mainCategory === "piezas" &&
        <Tabs value={viewTab} onValueChange={(v) => {setViewTab(v);setPage(1);}} className="mb-6">
            <TabsList className="bg-black/40 border border-cyan-500/20 p-1 w-full grid grid-cols-3 theme-light:bg-white theme-light:border-gray-200">
              <TabsTrigger value="products" className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-cyan-600 data-[state=active]:to-emerald-600 data-[state=active]:text-white">
                <Box className="w-4 h-4 mr-2" />
                Productos
              </TabsTrigger>
              <TabsTrigger value="offers" className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-orange-600 data-[state=active]:to-red-700 data-[state=active]:text-white">
                <Tag className="w-4 h-4 mr-2" />
                Ofertas
              </TabsTrigger>
              <TabsTrigger value="services" className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-purple-600 data-[state=active]:to-indigo-700 data-[state=active]:text-white">
                <Wrench className="w-4 h-4 mr-2" />
                Servicios
              </TabsTrigger>
            </TabsList>
          </Tabs>
        }

        {/* Búsqueda */}
        <div className="relative mb-6">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-white/40 theme-light:text-gray-500" />
          <Input
            value={q}
            onChange={(e) => {setQ(e.target.value);setPage(1);}}
            placeholder="Buscar por nombre, modelo compatible, proveedor..."
            className="pl-12 h-12 bg-black/25 border-cyan-500/20 text-white text-lg theme-light:bg-white theme-light:border-gray-300" />

        </div>

        {/* Grid de items */}
        <div className="min-h-[400px]">
          {pageItems.length === 0 ?
          <div className="text-center py-16">
              <Box className="w-16 h-16 text-white/20 mx-auto mb-4 theme-light:text-gray-300" />
              <p className="text-white/40 text-lg theme-light:text-gray-600">
                {q ? "No se encontraron resultados" : "No hay items en esta categoría"}
              </p>
            </div> :

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4 gap-4">
              {pageItems.map((item) =>
            <InventoryCard
              key={item.id}
              item={item}
              isSelected={selectedProducts.some((p) => p.id === item.id)}
              onSelect={handleSelectProduct}
              onEdit={(it) => {setEditing(it);setShowItemDialog(true);}}
              onDelete={handleDeleteItem} />

            )}
            </div>
          }
        </div>

        {/* Paginación */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 mt-6 text-sm text-white/40 theme-light:text-gray-600">
          <p>Mostrando {pageItems.length} de {filtered.length} ítems</p>
          <div className="flex items-center gap-2">
            <Button
              size="icon"
              variant="outline"
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              className="border-cyan-500/20 theme-light:border-gray-300">

              <ChevronLeft className="w-4 h-4" />
            </Button>
            <span className="px-3">{page} / {pageCount}</span>
            <Button
              size="icon"
              variant="outline"
              disabled={page >= pageCount}
              onClick={() => setPage((p) => Math.min(pageCount, p + 1))}
              className="border-cyan-500/20 theme-light:border-gray-300">

              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        </div>
          </>
        )}

        {/* Dialogs */}
        {showItemDialog &&
        <InventoryItemDialog
          open={showItemDialog}
          onOpenChange={setShowItemDialog}
          value={editing}
          onSave={handleSaveItem}
          deviceCategories={deviceCategories}
          partTypes={partTypes}
          accessoryCategories={accessoryCategories}
          currentDeviceCategory={deviceCategory}
          currentPartType={partTypeFilter}
          suppliers={suppliers} />

        }

        {showReports &&
        <InventoryReports
          open={showReports}
          onClose={() => setShowReports(false)} />

        }

        {/* Modal de menú de Órdenes de Compra */}
        {showPOMenu &&
        <Dialog open={showPOMenu} onOpenChange={setShowPOMenu}>
          <DialogContent className="bg-[#0f0f10] border border-cyan-500/20 max-w-md text-white theme-light:bg-white theme-light:border-gray-200">
            <DialogHeader>
              <DialogTitle className="text-xl font-bold text-white theme-light:text-gray-900 flex items-center gap-2">
                <FileText className="w-6 h-6 text-cyan-400" />
                Órdenes de Compra
              </DialogTitle>
            </DialogHeader>

            <div className="space-y-3 py-4">
              <button
                type="button"
                onClick={() => {
                  setShowPOMenu(false);
                  setShowPOList(true);
                }}
                className="w-full flex items-center gap-4 p-6 rounded-xl bg-gradient-to-br from-cyan-600/20 to-emerald-600/20 border-2 border-cyan-500/30 hover:border-cyan-500/50 transition-all group"
              >
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-cyan-600 to-emerald-600 flex items-center justify-center">
                  <FileText className="w-6 h-6 text-white" />
                </div>
                <div className="text-left flex-1">
                  <p className="text-lg font-bold text-white theme-light:text-gray-900">Ver Órdenes</p>
                  <p className="text-sm text-white/60 theme-light:text-gray-600">Historial de órdenes de compra</p>
                </div>
              </button>

              <button
                type="button"
                onClick={() => {
                  setShowPOMenu(false);
                  setShowPODialog(true);
                }}
                className="w-full flex items-center gap-4 p-6 rounded-xl bg-gradient-to-br from-emerald-600/20 to-green-600/20 border-2 border-emerald-500/30 hover:border-emerald-500/50 transition-all group"
              >
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-emerald-600 to-green-600 flex items-center justify-center">
                  <Plus className="w-6 h-6 text-white" />
                </div>
                <div className="text-left flex-1">
                  <p className="text-lg font-bold text-white theme-light:text-gray-900">Nueva Orden</p>
                  <p className="text-sm text-white/60 theme-light:text-gray-600">Crear orden de compra</p>
                </div>
              </button>
            </div>
          </DialogContent>
        </Dialog>
        }

        {/* Listado de órdenes existentes */}
        {showPOList &&
        <Dialog open={showPOList} onOpenChange={setShowPOList}>
          <DialogContent className="bg-[#0f0f10] border border-cyan-500/20 max-w-4xl text-white theme-light:bg-white theme-light:border-gray-200">
            <DialogHeader>
              <DialogTitle className="text-xl font-bold text-white theme-light:text-gray-900">
                Historial de Órdenes de Compra
              </DialogTitle>
            </DialogHeader>

            <div className="space-y-3 max-h-[60vh] overflow-y-auto">
              {poList.length === 0 ?
              <p className="text-white/40 text-sm text-center py-8 theme-light:text-gray-500">
                  Aún no hay órdenes de compra.
                </p> :

              poList.map((po) =>
              <div
                key={po.id}
                className="flex items-center justify-between gap-3 rounded-lg border border-cyan-500/20 px-4 py-3 hover:border-cyan-500/40 theme-light:border-gray-200"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <p className="text-sm font-semibold text-white theme-light:text-gray-900">{po.po_number}</p>
                    <Badge className={`text-xs ${
                      po.status === "received" ? "bg-green-600/20 text-green-300 border-green-600/30" :
                      po.status === "ordered" ? "bg-blue-600/20 text-blue-300 border-blue-600/30" :
                      "bg-gray-600/20 text-gray-300 border-gray-600/30"
                    }`}>
                      {po.status === "draft" ? "Borrador" :
                      po.status === "ordered" ? "Ordenado" :
                      po.status === "received" ? "Recibido" : "Cancelado"}
                    </Badge>
                  </div>
                  <p className="text-xs text-white/40 theme-light:text-gray-600">
                    {po.supplier_name || "Suplidor no definido"} • ${Number(po.total_amount || 0).toFixed(2)} • {(po.items || po.line_items || []).length} productos
                  </p>
                </div>

                <div className="flex gap-2">
                  <Button
                    type="button"
                    size="sm"
                    onClick={() => {
                      console.log("🔍 Abriendo orden:", po);
                      setViewingPO(po);
                      setShowPOList(false);
                      setShowPODetail(true);
                    }}
                    className="bg-cyan-600 hover:bg-cyan-700 h-8 text-xs"
                  >
                    Ver/Editar
                  </Button>
                </div>
              </div>
              )}
            </div>
          </DialogContent>
        </Dialog>
        }

        {showSuppliers &&
        <SuppliersDialog
          open={showSuppliers}
          onClose={async () => {
            setShowSuppliers(false);
            const supRes = await base44.entities.Supplier.list("-created_date");
            setSuppliers(supRes || []);
          }} />

        }

        {showPODialog &&
        <PurchaseOrderDialog
          open={showPODialog}
          onClose={async (reload) => {
            setShowPODialog(false);
            setEditingPO(null);
            if (reload) await loadInventory();
          }}
          purchaseOrder={editingPO}
          suppliers={suppliers}
          products={items}
          workOrders={workOrders} />

        }

        {showPODetail &&
        <PurchaseOrderDetailDialog
          open={showPODetail}
          onClose={async (reload) => {
            setShowPODetail(false);
            setViewingPO(null);
            if (reload) await loadInventory();
          }}
          purchaseOrder={viewingPO}
          suppliers={suppliers}
          products={items}
          workOrders={workOrders} />

        }

        {showDiscountDialog &&
        <SetDiscountDialog
          open={showDiscountDialog}
          onClose={() => setShowDiscountDialog(false)}
          products={selectedProducts}
          onSuccess={handleDiscountSuccess} />

        }

        {showReports &&
        <InventoryReports
          open={showReports}
          onClose={() => setShowReports(false)} />

        }

        {showManageCategories &&
        <ManageCategoriesDialog
          open={showManageCategories}
          onClose={() => setShowManageCategories(false)}
          onUpdate={loadInventory} />

        }

        {/* 🤖 Inventory Chatbot */}
        <InventoryChatbot
          products={items.filter((i) => i.part_type !== 'servicio')}
          services={items.filter((i) => i.part_type === 'servicio')}
          onSelectItem={(item) => {
            setEditing(item);
            setShowItemDialog(true);
          }} />


      </div>
    </div>);

}
