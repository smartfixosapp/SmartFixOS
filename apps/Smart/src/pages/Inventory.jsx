// === Inventory.jsx — ORGANIZADO POR CATEGORÍAS DE DISPOSITIVOS ===
// iPhone, iPad, MacBook → Pantallas, Baterías, Servicios

import React, { useState, useEffect, useMemo, useRef } from "react";
import { base44 } from "@/api/base44Client";
import { dataClient } from "@/components/api/dataClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  Search, Plus, Smartphone, Tablet, Laptop, AlertTriangle,
  FileText, Upload, Trash2, Edit, ChevronLeft, ChevronRight,
  Globe, Tag, CheckSquare, Monitor, Battery, Wrench, Box,
  Sparkles, Settings, Package } from
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
import { catalogCache } from "@/components/utils/dataCache";
import { loadSuppliersSafe } from "@/components/utils/suppliers";

const RECENT_CREATED_PRODUCTS_KEY = "smartfix_recent_created_products";

function readRecentCreatedProducts() {
  try {
    const raw = localStorage.getItem(RECENT_CREATED_PRODUCTS_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeRecentCreatedProducts(list) {
  try {
    localStorage.setItem(RECENT_CREATED_PRODUCTS_KEY, JSON.stringify(list || []));
  } catch {
    // no-op
  }
}

function dedupeById(list = []) {
  const seen = new Set();
  const out = [];
  for (const item of list) {
    const id = item?.id;
    if (!id || seen.has(id)) continue;
    seen.add(id);
    out.push(item);
  }
  return out;
}


// ✅ Formateo mejorado de dólares (solo 2 decimales, sin miles)
const money = (n) => {
  const num = Number(n || 0);
  return `$${num.toFixed(2)}`;
};

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
      className={`group bg-white/5 backdrop-blur-xl border rounded-[20px] p-5 flex flex-col gap-3 hover:shadow-[0_12px_40px_rgba(0,168,232,0.25)] transition-all duration-300 cursor-pointer active:scale-[0.98] theme-light:bg-white theme-light:border-gray-200 theme-light:hover:shadow-lg ${
      isSelected ? 'border-cyan-500 bg-cyan-500/10 ring-2 ring-cyan-500/40 scale-[1.02]' : 'border-white/10 hover:border-cyan-500/30'}`
      }
      onClick={() => onSelect?.(item)}>

      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3 flex-1 min-w-0">
          <div
            className={`w-6 h-6 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-all ${
            isSelected ? 'bg-cyan-500 border-cyan-500 scale-110' : 'border-white/20 group-hover:border-cyan-500/50'}`
            }>
            {isSelected && <CheckSquare className="w-4 h-4 text-white" />}
          </div>

          <div className="flex-1 min-w-0">
            <p className="font-bold text-white leading-tight truncate text-base theme-light:text-gray-900">
              {item.name || "—"}
            </p>
            <div className="flex items-center gap-1.5 mt-2 flex-wrap">
              <Badge className="text-[10px] px-2 py-0.5 rounded-full bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 theme-light:bg-cyan-100 theme-light:text-cyan-700 theme-light:border-cyan-300">
                {item.device_category || "Otros"}
              </Badge>
              <Badge className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 theme-light:bg-emerald-100 theme-light:text-emerald-700 theme-light:border-emerald-300">
                {item.part_type || "Pieza"}
              </Badge>
            </div>
          </div>
        </div>

        <div className="flex gap-1.5 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
          <Button
            size="icon"
            variant="ghost"
            className="h-8 w-8 rounded-full text-orange-400 hover:text-orange-300 hover:bg-orange-500/20"
            onClick={(e) => {
              e.stopPropagation();
              onSelect?.(item, true);
            }}
            title="Configurar Oferta">

            <Tag className="w-4 h-4" />
          </Button>
          <Button
            size="icon"
            variant="ghost"
            className="h-8 w-8 rounded-full text-white/70 hover:text-white hover:bg-white/10"
            onClick={(e) => {e.stopPropagation();onEdit(item);}}>
            <Edit className="w-4 h-4" />
          </Button>
          <Button
            size="icon"
            variant="ghost"
            className="h-8 w-8 rounded-full text-red-400 hover:text-red-300 hover:bg-red-500/20"
            onClick={(e) => {e.stopPropagation();onDelete(item);}}>
            <Trash2 className="w-4 h-4" />
          </Button>
        </div>
      </div>

      <DiscountBadge product={item} />

      <div className="flex items-center justify-between gap-4 pt-3 border-t border-white/5 theme-light:border-gray-100">
        <div className="flex-1">
          <div className="flex items-baseline gap-2 mb-1">
            <p className="text-2xl font-black text-white tracking-tight theme-light:text-gray-900">
              {money(priceInfo.finalPrice)}
            </p>
            {priceInfo.originalPrice &&
            <p className="text-sm text-gray-500 line-through">{money(priceInfo.originalPrice)}</p>
            }
          </div>
          {priceInfo.savings > 0 &&
          <p className="text-xs text-orange-400 font-bold">💰 Ahorras {money(priceInfo.savings)}</p>
          }
          <p className="text-xs text-white/40 mt-1 theme-light:text-gray-500">
            Costo: {money(item.cost)} • Ganancia: {money(Number(item.price || 0) - Number(item.cost || 0))}
          </p>
        </div>

        {item.part_type !== 'servicio' && item.tipo_principal !== 'servicios' &&
        <div className="text-right">
            <div className={`px-3 py-1.5 rounded-full border ${
          item.stock <= 0 ?
          'bg-red-500/20 border-red-500/40 text-red-300' :
          item.stock <= (item.min_stock || 0) ?
          'bg-amber-500/20 border-amber-500/40 text-amber-300' :
          'bg-emerald-500/20 border-emerald-500/40 text-emerald-300'}`
          }>
              <p className="text-2xl font-black leading-none">{Number(item.stock || 0)}</p>
            </div>
            <p className="text-[10px] text-white/40 mt-1 font-medium theme-light:text-gray-500">{st.tag}</p>
          </div>
        }
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
    device_warranty_months: "",
    taxable: true
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
        device_warranty_months: value.device_warranty_months || "",
        taxable: value.taxable !== false
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
        device_warranty_months: "",
        taxable: true
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
    // Validar costo solo si no es servicio
    const isServiceType = form.tipo_principal === "servicios" || form.part_type === "servicio";
    if (Number(form.cost) < 0 || !isServiceType && Number(form.cost) <= 0) {
      toast.error(isServiceType ? "El costo no puede ser negativo" : "El costo debe ser mayor a 0");
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
      taxable: form.taxable,
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
  const isService = selectedPartType?.slug === "servicio" || form.tipo_principal === "servicios";

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
              <button
                type="button"
                onClick={() => setForm((f) => ({ ...f, tipo_principal: "servicios", subcategoria: "servicio", part_type: "servicio", stock: 9999, min_stock: 0 }))}
                className={`flex items-center justify-center gap-2 px-4 py-4 rounded-xl border-2 text-base font-bold transition-all col-span-2 sm:col-span-1 ${
                form.tipo_principal === "servicios" ?
                "bg-gradient-to-r from-orange-600 to-red-600 text-white border-transparent shadow-lg" :
                "bg-white/5 border-white/10 text-white/60 hover:bg-white/10 theme-light:bg-gray-100 theme-light:border-gray-300"}`
                }>
                <Sparkles className="w-5 h-5 flex-shrink-0" />
                <span>Servicios</span>
              </button>
            </div>
          </div>

          {form.tipo_principal === "dispositivos" &&
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
                    <span>Piezas</span>
                  </button>
                </div>
              </div>
          }

          {(form.tipo_principal === "dispositivos" || form.tipo_principal === "servicios") &&
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
              <label className="text-xs text-white/50 mb-2 block theme-light:text-gray-600">Tipo de Pieza *</label>
              <div className="grid grid-cols-2 gap-2">
                {partTypes.filter((pt) => pt.slug !== 'servicio').map((type) => {
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

          <div className="flex items-center gap-2 py-2">
            <input
              type="checkbox"
              id="taxable"
              checked={form.taxable}
              onChange={(e) => setForm((f) => ({ ...f, taxable: e.target.checked }))}
              className="w-5 h-5 rounded border-cyan-500/30 bg-black/20 text-cyan-600 focus:ring-cyan-500" />

            <label htmlFor="taxable" className="text-sm font-medium text-white theme-light:text-gray-700 cursor-pointer">
              Cobrar IVU (Impuestos)
            </label>
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
              placeholder="Opcional" className="bg-black/20 text-slate-50 px-3 py-2 text-base rounded-md flex min-h-[60px] w-full border shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 md:text-sm border-cyan-500/20 h-16 theme-light:bg-white theme-light:border-gray-300" />


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
  const recentCreatedRef = useRef([]);
  const [pullStart, setPullStart] = useState(0);
  const [pullDistance, setPullDistance] = useState(0);
  const containerRef = useRef(null);

  useEffect(() => {
    loadInventory();
  }, []);

  // Pull-to-refresh handlers
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handleTouchStart = (e) => {
      if (container.scrollTop === 0) {
        setPullStart(e.touches[0].clientY);
      }
    };

    const handleTouchMove = (e) => {
      if (pullStart > 0) {
        const distance = e.touches[0].clientY - pullStart;
        if (distance > 0 && distance < 100) {
          setPullDistance(distance);
        }
      }
    };

    const handleTouchEnd = () => {
      if (pullDistance > 60) {
        window.dispatchEvent(new Event("force-refresh"));
        loadInventory();
      }
      setPullStart(0);
      setPullDistance(0);
    };

    container.addEventListener("touchstart", handleTouchStart);
    container.addEventListener("touchmove", handleTouchMove);
    container.addEventListener("touchend", handleTouchEnd);

    return () => {
      container.removeEventListener("touchstart", handleTouchStart);
      container.removeEventListener("touchmove", handleTouchMove);
      container.removeEventListener("touchend", handleTouchEnd);
    };
  }, [pullStart, pullDistance]);

  // ✅ OPTIMIZACIÓN: Carga de datos con manejo robusto de errores y caché
  const loadInventory = async () => {
    try {
      const [pRes, poRes, supRes, woRes, catRes, ptRes, accRes] = await Promise.allSettled([
      dataClient.entities.Product?.filter?.({ active: true }, "-created_date", 500).catch(() => []),
      dataClient.entities.PurchaseOrder?.list?.("-created_date", 100).catch(() => []),
      loadSuppliersSafe().catch(() => []),
      dataClient.entities.Order?.filter?.({ deleted: false }, "-created_date", 100).catch(() => []),
      base44.entities.DeviceCategory?.list?.().catch(() => []),
      base44.entities.PartType?.list?.().catch(() => []),
      base44.entities.AccessoryCategory?.list?.().catch(() => [])]
      );

      const prods = pRes.status === "fulfilled" ? pRes.value || [] : [];
      const now = Date.now();
      recentCreatedRef.current = [
        ...recentCreatedRef.current,
        ...readRecentCreatedProducts()
      ].filter(
        (entry) => entry?.item?.id
      );
      // Evitar acumulación duplicada entre memoria + localStorage.
      const dedupRecentMap = new Map();
      for (const entry of recentCreatedRef.current) {
        const id = entry?.item?.id;
        if (!id) continue;
        const prev = dedupRecentMap.get(id);
        if (!prev || Number(entry?.ts || 0) > Number(prev?.ts || 0)) {
          dedupRecentMap.set(id, entry);
        }
      }
      recentCreatedRef.current = Array.from(dedupRecentMap.values());
      recentCreatedRef.current = recentCreatedRef.current.filter(
        (entry) => now - Number(entry?.ts || 0) < 5 * 60 * 1000
      );
      writeRecentCreatedProducts(recentCreatedRef.current);
      const recentVisible = dedupeById(recentCreatedRef.current
        .map((entry) => entry.item)
        .filter((item) => item?.id && !prods.some((p) => p.id === item.id)));
      const mergedProducts = dedupeById([...recentVisible, ...prods]);
      const cats = catRes.status === "fulfilled" ? catRes.value || [] : [];
      const pts = ptRes.status === "fulfilled" ? ptRes.value || [] : [];
      const accs = accRes.status === "fulfilled" ? accRes.value || [] : [];

      console.log("📦 Inventario cargado:", {
        productos: prods.length,
        categorías: cats.length,
        tipos: pts.length
      });

      setItems(mergedProducts);
      setPoList(poRes.status === "fulfilled" ? poRes.value || [] : []);
      setSuppliers(supRes.status === "fulfilled" ? supRes.value || [] : []);
      setWorkOrders(woRes.status === "fulfilled" ? woRes.value || [] : []);
      setDeviceCategories(cats);
      setPartTypes(pts);
      setAccessoryCategories(accs);

      if (!deviceCategory && cats.length > 0) {
        const initialCategory = cats[0].icon || cats[0].name.toLowerCase();
        setDeviceCategory(initialCategory);
      }
    } catch (err) {
      console.error("Error loading inventory:", err);
      toast.error("Error al cargar inventario");
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
        // Mostrar piezas de forma tolerante (algunos registros nuevos pueden venir sin subcategoria).
        const isAccessory = item.tipo_principal === "accesorios";
        const isDeviceComplete = item.subcategoria === "dispositivo_completo";
        const isService = item.part_type === "servicio" || item.tipo_principal === "servicios";
        const isPiece =
          !isAccessory &&
          !isDeviceComplete &&
          !isService;
        if (!isPiece) return false;
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
      } else if (mainCategory === "servicios") {
        // Mostrar servicios, diagnósticos y items marcados como servicio
        const isService = item.tipo_principal === "servicios" ||
        item.part_type === "servicio" ||
        item.part_type === "diagnostic" ||
        item.category === "diagnostic" ||
        (item.name || "").toLowerCase().includes("diagnostico");

        if (!isService) return false;

        // Filtrar por categoría de dispositivo si está seleccionada
        if (deviceCategory && item.device_category !== deviceCategory) return false;
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
          const admins = await dataClient.entities.User.list();
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
        const created = await dataClient.entities.Product.create(payload);
        const newItem = created && created.id ? created : {
          ...payload,
          id: `local-product-${Date.now()}`,
          created_date: new Date().toISOString(),
          updated_date: new Date().toISOString(),
          _local_pending_sync: true
        };
        console.log("✅ Pieza creada:", created || newItem);

        // Mostrar de inmediato el nuevo item sin depender de consistencia eventual del backend.
        if (newItem?.id) {
          setItems((prev) => dedupeById([newItem, ...prev.filter((i) => i.id !== newItem.id)]));
          recentCreatedRef.current.unshift({ item: newItem, ts: Date.now() });
          recentCreatedRef.current = recentCreatedRef.current.slice(0, 30);
          writeRecentCreatedProducts(recentCreatedRef.current);
        }

        // Cambiar a la categoría principal correcta para que sí se vea el item recién creado.
        const nextMainCategory =
          payload.tipo_principal === "accesorios"
            ? "accesorios"
            : payload.tipo_principal === "servicios" || savedPartType === "servicio"
              ? "servicios"
              : payload.subcategoria === "dispositivo_completo"
                ? "dispositivos"
                : "piezas";
        setMainCategory(nextMainCategory);

        // Vista secundaria por tipo
        if (nextMainCategory === "piezas") {
          setViewTab(savedPartType === "servicio" ? "services" : "products");
          if (savedPartType && savedPartType !== "servicio") {
            setPartTypeFilter(savedPartType);
          } else {
            setPartTypeFilter("all");
          }
        } else if (nextMainCategory === "servicios") {
          setViewTab("services");
          setPartTypeFilter("all");
        } else {
          setViewTab("products");
          setPartTypeFilter("all");
        }

        // Cambiar los filtros a la categoría/tipo del nuevo producto
        if (savedCategory) {
          console.log("🎯 Cambiando a categoría:", savedCategory);
          setDeviceCategory(savedCategory);
        } else if (nextMainCategory === "piezas" || nextMainCategory === "servicios") {
          // Evita que un filtro viejo esconda la pieza recién creada.
          setDeviceCategory(null);
        }
        setQ("");
        setPage(1);

        // Invalidar caché de POS para que al entrar vuelva a cargar productos recientes.
        const posProducts = catalogCache.get("pos-active-products") || [];
        const posServices = catalogCache.get("pos-active-services") || [];
        const isServiceLike =
          payload.tipo_principal === "servicios" ||
          savedPartType === "servicio" ||
          payload.part_type === "servicio";
        if (isServiceLike) {
          catalogCache.set(
            "pos-active-services",
            [newItem, ...posServices.filter((s) => s.id !== newItem.id)]
          );
        } else {
          catalogCache.set(
            "pos-active-products",
            [newItem, ...posProducts.filter((p) => p.id !== newItem.id)]
          );
        }
        // Refresco en segundo plano para sincronizar completamente con backend.
        setTimeout(() => {
          loadInventory();
        }, 700);
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

      await dataClient.entities.Product.delete(item.id);
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
        const po = await dataClient.entities.PurchaseOrder.list("-created_date", 100);
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
    <div ref={containerRef} className="min-h-screen bg-gradient-to-br from-slate-950 via-blue-950 to-slate-900 theme-light:bg-gradient-to-br theme-light:from-gray-50 theme-light:to-blue-50 p-3 sm:p-6 overflow-y-auto" style={{ WebkitOverflowScrolling: 'touch' }}>
      {/* Pull-to-refresh indicator */}
      {pullDistance > 0 &&
      <div
        className="absolute top-0 left-0 right-0 flex justify-center py-2 z-50"
        style={{ transform: `translateY(${Math.min(pullDistance, 60)}px)` }}>

          <Settings className={`w-6 h-6 text-cyan-400 ${pullDistance > 60 ? 'animate-spin' : ''}`} />
        </div>
      }
      <div className="max-w-[1600px] mx-auto">
        {/* Header Estilo iOS */}
        <div className="bg-white/5 backdrop-blur-2xl border border-white/10 rounded-[28px] p-6 sm:p-8 mb-6 shadow-[0_20px_60px_rgba(0,0,0,0.4)] relative overflow-hidden theme-light:bg-white/90 theme-light:border-gray-200">
          <div className="absolute inset-0 bg-gradient-to-br from-cyan-500/10 via-transparent to-emerald-500/10 pointer-events-none" />
          <div className="relative z-10 flex flex-col md:flex-row items-center justify-between gap-4">
            <div>
              <h1 className="text-3xl sm:text-4xl font-black text-white flex items-center gap-3 tracking-tight theme-light:text-gray-900">
                <div className="w-12 h-12 rounded-[16px] bg-gradient-to-br from-cyan-500 to-emerald-500 flex items-center justify-center shadow-lg">
                  <Sparkles className="w-7 h-7 text-white" />
                </div>
                Inventario
              </h1>
              <p className="text-white/60 mt-2 font-medium theme-light:text-gray-600 flex items-center gap-2">
                <Package className="w-4 h-4" />
                Gestión de productos por categorías de dispositivos
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                onClick={() => setViewMode("reports")}
                variant="ghost"
                className={`h-10 rounded-full px-5 font-bold transition-all ${viewMode === "reports" ?
                "bg-white/15 text-white shadow-lg scale-105 theme-light:bg-gray-900 theme-light:text-white" :
                "text-white/60 hover:bg-white/10 hover:text-white theme-light:text-gray-600 theme-light:hover:bg-gray-100"}`
                }>

                <FileText className="w-4 h-4 mr-2" />
                Reportes
              </Button>
              <Button
                onClick={() => setViewMode("products")}
                variant="ghost"
                className={`h-10 rounded-full px-5 font-bold transition-all ${viewMode === "products" ?
                "bg-white/15 text-white shadow-lg scale-105 theme-light:bg-gray-900 theme-light:text-white" :
                "text-white/60 hover:bg-white/10 hover:text-white theme-light:text-gray-600 theme-light:hover:bg-gray-100"}`
                }>

                <Box className="w-4 h-4 mr-2" />
                Productos
              </Button>
              <Button onClick={() => setShowManageCategories(true)} variant="ghost" className="h-10 rounded-full px-5 text-white/60 hover:bg-white/10 hover:text-white font-semibold theme-light:text-gray-600 theme-light:hover:bg-gray-100">
                <Settings className="w-4 h-4 mr-2" />
                Categorías
              </Button>
              <Button onClick={() => setShowSuppliers(true)} variant="ghost" className="h-10 rounded-full px-5 text-white/60 hover:bg-white/10 hover:text-white font-semibold theme-light:text-gray-600 theme-light:hover:bg-gray-100">
                <Globe className="w-4 h-4 mr-2" />
                Proveedores
              </Button>
              <Button onClick={() => setShowPOMenu(true)} variant="ghost" className="h-10 rounded-full px-5 text-white/60 hover:bg-white/10 hover:text-white font-semibold theme-light:text-gray-600 theme-light:hover:bg-gray-100">
                <FileText className="w-4 h-4 mr-2" />
                Compras
              </Button>
              <Button onClick={() => {setEditing(null);setShowItemDialog(true);}} className="h-10 rounded-full px-6 bg-gradient-to-r from-cyan-500 to-emerald-500 hover:from-cyan-600 hover:to-emerald-600 text-white font-bold shadow-[0_8px_24px_rgba(6,182,212,0.4)] transition-all hover:scale-105 active:scale-95">
                <Plus className="w-5 h-5 mr-2" />
                Nuevo
              </Button>
              {selectedProducts.length > 0 &&
              <Button onClick={() => setShowDiscountDialog(true)} className="h-10 rounded-full px-5 bg-gradient-to-r from-orange-500 to-pink-500 text-white font-bold shadow-lg animate-pulse">
                  <Tag className="w-4 h-4 mr-2" />
                  Oferta ({selectedProducts.length})
                </Button>
              }
            </div>
          </div>
        </div>

        {/* Vista de Reportes o Productos */}
        {viewMode === "reports" ?
        <div className="bg-black/40 backdrop-blur-xl border border-cyan-500/20 rounded-2xl p-6 mb-6 theme-light:bg-white theme-light:border-gray-200">
            <InventoryReports
            open={true}
            onClose={() => {}}
            isEmbedded={true} />

          </div> :

        <>
        {/* Selector de categoría principal - Apple Style */}
        <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-[24px] p-4 sm:p-5 mb-6 theme-light:bg-white/80 theme-light:border-gray-200">
          <div className="grid grid-cols-2 gap-2 sm:gap-3">
            <button
                onClick={() => {
                  setMainCategory("dispositivos");
                  setDeviceCategory(null);
                  setPartTypeFilter("all");
                  setPage(1);
                }}
                className={`group flex flex-col items-center gap-2 sm:gap-3 px-3 sm:px-5 py-4 sm:py-6 rounded-[20px] transition-all duration-300 ${
                mainCategory === "dispositivos" ?
                "bg-gradient-to-br from-cyan-500 to-blue-500 text-white shadow-[0_12px_40px_rgba(6,182,212,0.4)] scale-105" :
                "bg-white/5 text-white/60 hover:bg-white/10 hover:scale-[1.02] theme-light:bg-gray-50 theme-light:text-gray-600 theme-light:hover:bg-gray-100"}`
                }>
              <div className={`w-10 h-10 sm:w-14 sm:h-14 rounded-[18px] flex items-center justify-center transition-transform group-hover:scale-110 ${
                mainCategory === "dispositivos" ? "bg-white/20" : "bg-cyan-500/20"}`
                }>
                <Smartphone className="w-5 h-5 sm:w-7 sm:h-7" />
              </div>
              <span className="font-black text-sm sm:text-base">Dispositivos</span>
            </button>

            <button
                onClick={() => {
                  setMainCategory("piezas");
                  setDeviceCategory(null);
                  setPartTypeFilter("all");
                  setPage(1);
                }}
                className={`group flex flex-col items-center gap-2 sm:gap-3 px-3 sm:px-5 py-4 sm:py-6 rounded-[20px] transition-all duration-300 ${
                mainCategory === "piezas" ?
                "bg-gradient-to-br from-emerald-500 to-green-500 text-white shadow-[0_12px_40px_rgba(16,185,129,0.4)] scale-105" :
                "bg-white/5 text-white/60 hover:bg-white/10 hover:scale-[1.02] theme-light:bg-gray-50 theme-light:text-gray-600 theme-light:hover:bg-gray-100"}`
                }>
              <div className={`w-10 h-10 sm:w-14 sm:h-14 rounded-[18px] flex items-center justify-center transition-transform group-hover:scale-110 ${
                mainCategory === "piezas" ? "bg-white/20" : "bg-emerald-500/20"}`
                }>
                <Wrench className="w-5 h-5 sm:w-7 sm:h-7" />
              </div>
              <span className="font-black text-sm sm:text-base">Piezas</span>
            </button>

            <button
                onClick={() => {
                  setMainCategory("accesorios");
                  setDeviceCategory(null);
                  setPartTypeFilter("all");
                  setPage(1);
                }}
                className={`group flex flex-col items-center gap-2 sm:gap-3 px-3 sm:px-5 py-4 sm:py-6 rounded-[20px] transition-all duration-300 ${
                mainCategory === "accesorios" ?
                "bg-gradient-to-br from-purple-500 to-pink-500 text-white shadow-[0_12px_40px_rgba(168,85,247,0.4)] scale-105" :
                "bg-white/5 text-white/60 hover:bg-white/10 hover:scale-[1.02] theme-light:bg-gray-50 theme-light:text-gray-600 theme-light:hover:bg-gray-100"}`
                }>
              <div className={`w-10 h-10 sm:w-14 sm:h-14 rounded-[18px] flex items-center justify-center transition-transform group-hover:scale-110 ${
                mainCategory === "accesorios" ? "bg-white/20" : "bg-purple-500/20"}`
                }>
                <Box className="w-5 h-5 sm:w-7 sm:h-7" />
              </div>
              <span className="font-black text-sm sm:text-base">Accesorios</span>
            </button>

            <button
                onClick={() => {
                  setMainCategory("servicios");
                  setDeviceCategory(null);
                  setPartTypeFilter("all");
                  setPage(1);
                }}
                className={`group flex flex-col items-center gap-2 sm:gap-3 px-3 sm:px-5 py-4 sm:py-6 rounded-[20px] transition-all duration-300 ${
                mainCategory === "servicios" ?
                "bg-gradient-to-br from-orange-500 to-red-500 text-white shadow-[0_12px_40px_rgba(249,115,22,0.4)] scale-105" :
                "bg-white/5 text-white/60 hover:bg-white/10 hover:scale-[1.02] theme-light:bg-gray-50 theme-light:text-gray-600 theme-light:hover:bg-gray-100"}`
                }>
              <div className={`w-10 h-10 sm:w-14 sm:h-14 rounded-[18px] flex items-center justify-center transition-transform group-hover:scale-110 ${
                mainCategory === "servicios" ? "bg-white/20" : "bg-orange-500/20"}`
                }>
                <Sparkles className="w-5 h-5 sm:w-7 sm:h-7" />
              </div>
              <span className="font-black text-sm sm:text-base">Servicios</span>
            </button>
            </div>
            </div>

        {/* Categorías de dispositivos - Apple Style */}
        {(mainCategory === "dispositivos" || mainCategory === "piezas" || mainCategory === "servicios") &&
          <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-[24px] p-6 mb-6 theme-light:bg-white/80 theme-light:border-gray-200">
            <h2 className="text-white text-base font-bold mb-5 flex items-center gap-2 tracking-tight theme-light:text-gray-900">
              <Smartphone className="w-5 h-5 text-cyan-400 theme-light:text-cyan-600" />
              Dispositivo
            </h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 xl:grid-cols-6 gap-3">
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
                  } else if (mainCategory === "piezas") {
                    return i.tipo_principal === "dispositivos" && i.subcategoria === "piezas_servicios" && i.device_category === catValue;
                  } else if (mainCategory === "servicios") {
                    return (i.tipo_principal === "servicios" || i.part_type === "servicio" || i.part_type === "diagnostic" || i.category === "diagnostic" || (i.name || "").toLowerCase().includes("diagnostico")) && i.device_category === catValue;
                  }
                  return false;
                }).length;
                return (
                  <button
                    key={cat.id}
                    onClick={() => {setDeviceCategory(catValue);setPage(1);}}
                    className={`group relative flex flex-col items-center gap-3 p-5 rounded-[20px] transition-all duration-300 active:scale-95 ${
                    deviceCategory === catValue ?
                    "bg-gradient-to-br from-cyan-500 to-emerald-500 text-white shadow-[0_12px_32px_rgba(6,182,212,0.35)] scale-105" :
                    "bg-white/5 text-white/60 hover:bg-white/10 hover:text-white hover:scale-[1.02] theme-light:bg-gray-50 theme-light:text-gray-600 theme-light:hover:bg-gray-100"}`
                    }>
                      <div className={`w-12 h-12 rounded-[16px] flex items-center justify-center transition-transform group-hover:scale-110 ${
                    deviceCategory === catValue ? "bg-white/20" : "bg-cyan-500/20"}`
                    }>
                        <IconComponent className="w-6 h-6" />
                      </div>
                      <div className="text-center">
                        <p className="font-black text-sm tracking-tight">{cat.name}</p>
                        <p className={`text-[10px] mt-1 font-bold ${deviceCategory === catValue ? 'text-white/80' : 'text-white/40 theme-light:text-gray-500'}`}>
                          {count} {count === 1 ? 'item' : 'items'}
                        </p>
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
              <Box className="w-5 h-5 text-purple-400" strokeWidth={2.5} />
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

        {/* Filtros de tipo de pieza - Apple Style */}
        {mainCategory === "piezas" &&
          <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-[24px] p-5 mb-6 theme-light:bg-white/80 theme-light:border-gray-200">
            <h2 className="text-white text-base font-bold mb-4 flex items-center gap-2 tracking-tight theme-light:text-gray-900">
              <Monitor className="w-5 h-5 text-emerald-400 theme-light:text-emerald-600" strokeWidth={2.5} />
              Tipo de Pieza
            </h2>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => {setPartTypeFilter("all");setPage(1);}}
                className={`px-4 py-2.5 rounded-full text-sm font-bold transition-all ${
                partTypeFilter === "all" ?
                "bg-white/15 text-white shadow-lg scale-105 theme-light:bg-gray-900 theme-light:text-white" :
                "bg-white/5 text-white/60 hover:bg-white/10 hover:text-white theme-light:bg-gray-100 theme-light:text-gray-600 theme-light:hover:bg-gray-200"}`
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
                    className={`flex items-center gap-2 px-4 py-2.5 rounded-full text-sm font-bold transition-all ${
                    partTypeFilter === type.slug ?
                    "bg-white/15 text-white shadow-lg scale-105 theme-light:bg-gray-900 theme-light:text-white" :
                    "bg-white/5 text-white/60 hover:bg-white/10 hover:text-white theme-light:bg-gray-100 theme-light:text-gray-600 theme-light:hover:bg-gray-200"}`
                    }>
                    <IconComponent className="w-4 h-4" />
                    {type.name} <span className="opacity-60">•</span> {count}
                  </button>);
              })}
            </div>
          </div>
          }

        {/* Tabs - Apple Style */}
        {mainCategory === "piezas" &&
          <div className="flex gap-2 mb-6 p-1.5 bg-white/5 backdrop-blur-xl border border-white/10 rounded-[18px] theme-light:bg-gray-100 theme-light:border-gray-200 overflow-x-auto">
          <button
              onClick={() => {setViewTab("products");setPage(1);}}
              className={`flex items-center justify-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-3 rounded-[14px] text-xs sm:text-sm font-bold transition-all whitespace-nowrap ${
              viewTab === "products" ?
              "bg-white text-gray-900 shadow-lg theme-light:bg-white theme-light:text-gray-900" :
              "text-white/60 hover:text-white theme-light:text-gray-600"}`
              }>

            <Box className="w-4 h-4" />
            <span>Productos</span>
          </button>
          <button
              onClick={() => {setViewTab("offers");setPage(1);}}
              className={`flex items-center justify-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-3 rounded-[14px] text-xs sm:text-sm font-bold transition-all whitespace-nowrap ${
              viewTab === "offers" ?
              "bg-white text-gray-900 shadow-lg theme-light:bg-white theme-light:text-gray-900" :
              "text-white/60 hover:text-white theme-light:text-gray-600"}`
              }>

            <Tag className="w-4 h-4" />
            <span>Ofertas</span>
          </button>
          <button
              onClick={() => {setViewTab("services");setPage(1);}}
              className={`flex items-center justify-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-3 rounded-[14px] text-xs sm:text-sm font-bold transition-all whitespace-nowrap ${
              viewTab === "services" ?
              "bg-white text-gray-900 shadow-lg theme-light:bg-white theme-light:text-gray-900" :
              "text-white/60 hover:text-white theme-light:text-gray-600"}`
              }>

            <Wrench className="w-4 h-4" />
            <span>Servicios</span>
          </button>
        </div>
          }

        {/* Búsqueda estilo iOS */}
        <div className="relative mb-6 group">
          <Search className="absolute left-5 top-1/2 -translate-y-1/2 w-5 h-5 text-white/30 group-focus-within:text-cyan-400 transition-colors theme-light:text-gray-400 theme-light:group-focus-within:text-cyan-600" />
          <Input
              value={q}
              onChange={(e) => {setQ(e.target.value);setPage(1);}}
              placeholder="Buscar productos, modelos, proveedores..."
              className="pl-14 h-14 bg-white/5 backdrop-blur-xl border border-white/10 rounded-[18px] text-white text-base placeholder:text-white/30 focus:bg-white/10 focus:border-cyan-500/50 focus:ring-2 focus:ring-cyan-500/20 transition-all theme-light:bg-white theme-light:border-gray-200 theme-light:text-gray-900 theme-light:placeholder:text-gray-400" />
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

        {/* Paginación - Apple Style */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mt-8 px-2">
          <p className="text-sm text-white/50 font-medium theme-light:text-gray-600">
            Mostrando <span className="text-white font-bold theme-light:text-gray-900">{pageItems.length}</span> de <span className="text-white font-bold theme-light:text-gray-900">{filtered.length}</span> productos
          </p>
          <div className="flex items-center gap-3">
            <Button
                size="icon"
                variant="ghost"
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className="h-10 w-10 rounded-full bg-white/5 hover:bg-white/10 border border-white/10 disabled:opacity-30 disabled:cursor-not-allowed transition-all theme-light:bg-gray-100 theme-light:hover:bg-gray-200">
              <ChevronLeft className="w-5 h-5" />
            </Button>
            <div className="px-4 py-2 bg-white/10 rounded-full border border-white/10 theme-light:bg-gray-100 theme-light:border-gray-200">
              <span className="text-white font-bold text-sm theme-light:text-gray-900">{page}</span>
              <span className="text-white/40 mx-1.5 theme-light:text-gray-500">/</span>
              <span className="text-white/60 font-semibold text-sm theme-light:text-gray-600">{pageCount}</span>
            </div>
            <Button
                size="icon"
                variant="ghost"
                disabled={page >= pageCount}
                onClick={() => setPage((p) => Math.min(pageCount, p + 1))}
                className="h-10 w-10 rounded-full bg-white/5 hover:bg-white/10 border border-white/10 disabled:opacity-30 disabled:cursor-not-allowed transition-all theme-light:bg-gray-100 theme-light:hover:bg-gray-200">
              <ChevronRight className="w-5 h-5" />
            </Button>
          </div>
        </div>
          </>
        }

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
                className="w-full flex items-center gap-4 p-6 rounded-xl bg-gradient-to-br from-cyan-600/20 to-emerald-600/20 border-2 border-cyan-500/30 hover:border-cyan-500/50 transition-all group">

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
                className="w-full flex items-center gap-4 p-6 rounded-xl bg-gradient-to-br from-emerald-600/20 to-green-600/20 border-2 border-emerald-500/30 hover:border-emerald-500/50 transition-all group">

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
                className="flex items-center justify-between gap-3 rounded-lg border border-cyan-500/20 px-4 py-3 hover:border-cyan-500/40 theme-light:border-gray-200">

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <p className="text-sm font-semibold text-white theme-light:text-gray-900">{po.po_number}</p>
                    <Badge className={`text-xs ${
                    po.status === "received" ? "bg-green-600/20 text-green-300 border-green-600/30" :
                    po.status === "ordered" ? "bg-blue-600/20 text-blue-300 border-blue-600/30" :
                    "bg-gray-600/20 text-gray-300 border-gray-600/30"}`
                    }>
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
                    className="bg-cyan-600 hover:bg-cyan-700 h-8 text-xs">

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
            const supRes = await loadSuppliersSafe();
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




      </div>
    </div>);

}
