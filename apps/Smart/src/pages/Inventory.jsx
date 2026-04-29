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
import { cn } from "@/lib/utils";
import {
  Search, Plus, Smartphone, Tablet, Laptop, AlertTriangle,
  FileText, Upload, Trash2, Edit, ChevronLeft, ChevronRight,
  Globe, Tag, CheckSquare, Monitor, Battery, Wrench, Box,
  Sparkles, Settings, Package, Zap, History, TrendingUp, TrendingDown,
  Minus, ArrowUpDown, MoreHorizontal } from
"lucide-react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter // 👈 DialogFooter añadido
} from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";

import SuppliersDialog from "../components/inventory/SuppliersDialog";
import PurchaseOrderDialog from "../components/inventory/PurchaseOrderDialog";
import { usePlanLimits } from "@/hooks/usePlanLimits";
import PurchaseOrderDetailDialog from "../components/inventory/PurchaseOrderDetailDialog";
import NotificationService from "../components/notifications/NotificationService";
import DiscountBadge, { formatPriceWithDiscount } from "../components/inventory/DiscountBadge";
import SetDiscountDialog from "../components/inventory/SetDiscountDialog";
import ManageCategoriesDialog from "../components/inventory/ManageCategoriesDialog";
import QuickOrderDialog from "../components/inventory/QuickOrderDialog";
import InventoryReports from "../components/inventory/InventoryReports";
import { catalogCache } from "@/components/utils/dataCache";
import { loadSuppliersSafe } from "@/components/utils/suppliers";
import { supabase } from "../../../../lib/supabase-client.js";
import { callJENAI } from "@/lib/jenaiEngine";
import JENAIInsightBanner from "@/components/jenai/JENAIInsightBanner";

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

function mapPartTypeToProductCategory(partType) {
  switch (partType) {
    case "pantalla":
      return "screen";
    case "bateria":
      return "battery";
    case "cargador":
      return "charger";
    case "cable":
      return "cable";
    case "cover":
    case "funda":
      return "case";
    case "diagnostic":
    case "diagnostico":
      return "diagnostic";
    default:
      return "other";
  }
}

function normalizeProductPayload(payload) {
  const isService =
    payload?.tipo_principal === "servicios" ||
    payload?.part_type === "servicio" ||
    payload?.part_type === "diagnostic" ||
    payload?.category === "diagnostic";

  return {
    ...payload,
    type: isService ? "service" : "product",
    category: mapPartTypeToProductCategory(payload?.part_type),
    tipo_principal: payload?.tipo_principal === "servicios" ? "dispositivos" : (payload?.tipo_principal || "dispositivos"),
    subcategoria: payload?.subcategoria === "servicio" ? "piezas_servicios" : (payload?.subcategoria || "piezas_servicios"),
    supplier_id: payload?.supplier_id || "",
    supplier_name: payload?.supplier_name || "",
    active: payload?.active !== false,
  };
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
function InventoryCard({ item, onEdit, onDelete, onSelect, isSelected, onQuickAdjust }) {
  const isService = item.part_type === 'servicio' || item.tipo_principal === 'servicios' || item.part_type === 'diagnostic';
  const stockNum = Number(item.stock || 0);
  const minStockNum = Number(item.min_stock || 0);

  let stockBadge = null;
  if (!isService) {
    if (stockNum <= 0) {
      stockBadge = { label: "Agotado", sub: null, bg: "bg-apple-red/15", text: "text-apple-red" };
    } else if (minStockNum > 0 && stockNum <= minStockNum) {
      stockBadge = { label: String(stockNum), sub: "Bajo", bg: "bg-apple-orange/15", text: "text-apple-orange" };
    } else {
      stockBadge = { label: String(stockNum), sub: "ajustar ▾", bg: "bg-apple-green/12", text: "text-apple-green" };
    }
  }

  let priceInfo = { finalPrice: Number(item.price || 0), originalPrice: null };
  try { priceInfo = formatPriceWithDiscount(item); } catch { /* use defaults */ }

  const price = Number(priceInfo.finalPrice || 0);
  const cost = Number(item.cost || 0);
  const profit = price - cost;
  const margin = price > 0 ? Math.round((profit / price) * 100) : 0;

  return (
    <div
      className={cn(
        "apple-card apple-card-interactive apple-type apple-press group relative p-4 flex flex-col gap-3 cursor-pointer",
        isSelected && "ring-2 ring-apple-blue/70"
      )}
      onClick={() => onSelect?.(item)}
    >
      {/* Selection dot */}
      <div className={cn(
        "absolute top-3.5 left-3.5 w-5 h-5 rounded-full flex items-center justify-center transition-all",
        isSelected ? "bg-apple-blue" : "border-2 border-[rgb(var(--separator-opaque))]"
      )}>
        {isSelected && <CheckSquare className="w-3 h-3 text-white" />}
      </div>

      {/* Actions (aparecen en hover) */}
      <div className="absolute top-3 right-3 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        <button
          onClick={e => { e.stopPropagation(); onSelect?.(item, true); }}
          className="apple-press w-7 h-7 rounded-full bg-apple-orange/15 text-apple-orange flex items-center justify-center"
          title="Configurar oferta"
          aria-label="Oferta"
        >
          <Tag className="w-3.5 h-3.5" />
        </button>
        <button
          onClick={e => { e.stopPropagation(); onEdit(item); }}
          className="apple-press w-7 h-7 rounded-full bg-apple-blue/15 text-apple-blue flex items-center justify-center"
          aria-label="Editar"
        >
          <Edit className="w-3.5 h-3.5" />
        </button>
        <button
          onClick={e => { e.stopPropagation(); onDelete(item); }}
          className="apple-press w-7 h-7 rounded-full bg-apple-red/15 text-apple-red flex items-center justify-center"
          aria-label="Eliminar"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Name + badges */}
      <div className="pl-7 pr-16">
        <p className="apple-text-headline apple-label-primary truncate">{item.name || "—"}</p>
        <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
          {item.device_category && (
            <span className="apple-text-caption2 font-medium px-2 py-0.5 rounded-full bg-apple-blue/12 text-apple-blue">
              {item.device_category}
            </span>
          )}
          {item.part_type && item.part_type !== 'servicio' && (
            <span className="apple-text-caption2 font-medium px-2 py-0.5 rounded-full bg-apple-green/15 text-apple-green">
              {item.part_type}
            </span>
          )}
          {isService && (
            <span className="apple-text-caption2 font-medium px-2 py-0.5 rounded-full bg-apple-orange/15 text-apple-orange">
              Servicio
            </span>
          )}
        </div>
      </div>

      {/* Discount badge */}
      <DiscountBadge product={item} />

      {/* Price + stock row */}
      <div
        className="flex items-end justify-between gap-3 pt-2.5"
        style={{ borderTop: "0.5px solid rgb(var(--separator) / 0.20)" }}
      >
        <div>
          <div className="flex items-baseline gap-1.5">
            <p className="apple-text-title3 apple-label-primary tabular-nums">{money(price)}</p>
            {priceInfo.originalPrice != null && priceInfo.originalPrice !== price && (
              <p className="apple-text-caption1 apple-label-tertiary line-through tabular-nums">{money(priceInfo.originalPrice)}</p>
            )}
          </div>
          <p className="apple-text-caption1 apple-label-secondary mt-0.5 tabular-nums">
            Costo {money(cost)} ·{" "}
            <span className={profit >= 0 ? "text-apple-green" : "text-apple-red"}>
              {profit >= 0 ? "+" : ""}{margin}%
            </span>
          </p>
        </div>
        {stockBadge && (
          <button
            onClick={e => { e.stopPropagation(); onQuickAdjust?.(item); }}
            className={cn(
              "apple-press px-3 py-1.5 rounded-full text-center min-w-[56px]",
              stockBadge.bg
            )}
            title="Toca para ajustar stock rápido"
          >
            <p className={cn("apple-text-body font-semibold leading-tight tabular-nums", stockBadge.text)}>{stockBadge.label}</p>
            {stockBadge.sub && (
              <p className="apple-text-caption2 apple-label-tertiary mt-0.5">{stockBadge.sub}</p>
            )}
          </button>
        )}
      </div>

      {Array.isArray(item.compatibility_models) && item.compatibility_models.length > 0 && (
        <p className="apple-text-caption1 apple-label-tertiary truncate">
          Compatible: {item.compatibility_models.join(", ")}
        </p>
      )}
    </div>
  );
}

// === QuickStockAdjust — mini popup para ajustar stock sin abrir el form completo ===
function QuickStockAdjust({ item, onClose, onSave }) {
  const currentStock = Number(item.stock || 0);
  const [mode, setMode] = React.useState("add"); // "add" | "remove" | "set"
  const [qty, setQty] = React.useState("");
  const [note, setNote] = React.useState("");
  const [saving, setSaving] = React.useState(false);

  const newStock = mode === "set"
    ? Number(qty || 0)
    : mode === "add"
      ? currentStock + Number(qty || 0)
      : Math.max(0, currentStock - Number(qty || 0));

  const handleSave = async () => {
    const n = Number(qty);
    if (mode !== "set" && (!qty || n <= 0)) { toast.error("Ingresa una cantidad mayor a 0"); return; }
    if (mode === "set" && qty === "") { toast.error("Ingresa el nuevo stock"); return; }
    setSaving(true);
    try {
      await onSave({ item, newStock, previousStock: currentStock, mode, qty: n, note });
      onClose();
    } catch { /* error handled in parent */ }
    finally { setSaving(false); }
  };

  return (
    <div className="fixed inset-0 z-[200] flex items-end sm:items-center justify-center">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full sm:w-96 bg-[#111114] border border-teal-500/30 rounded-[28px] rounded-b-none sm:rounded-[28px] p-5 shadow-[0_-8px_40px_rgba(0,0,0,0.5)] sm:shadow-[0_24px_60px_rgba(0,0,0,0.5)]">
        <div className="flex items-center justify-between mb-4">
          <div>
            <p className="text-white font-semibold text-sm truncate max-w-[220px]">{item.name}</p>
            <p className="text-white/40 text-xs mt-0.5">Stock actual: <span className="text-white font-bold">{currentStock}</span></p>
          </div>
          <button onClick={onClose} className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center text-white/50 hover:text-white" aria-label="Cerrar">✕</button>
        </div>

        {/* Mode selector */}
        <div className="grid grid-cols-3 gap-1.5 mb-4 bg-black/30 p-1 rounded-2xl">
          {[{k:"add",label:"+ Agregar",color:"text-emerald-400"},{k:"remove",label:"− Quitar",color:"text-red-400"},{k:"set",label:"= Fijar",color:"text-cyan-400"}].map(({k,label,color}) => (
            <button key={k} onClick={() => { setMode(k); setQty(""); }}
              className={`py-2 px-2 rounded-xl text-[11px] font-semibold transition-all ${
                mode === k ? `bg-white/10 ${color}` : "text-white/50 hover:text-white/60"
              }`}>{label}</button>
          ))}
        </div>

        <div className="flex items-center gap-3 mb-3">
          <input
            type="number"
            min="0"
            value={qty}
            onChange={e => setQty(e.target.value)}
            onKeyDown={e => e.key === "Enter" && handleSave()}
            autoFocus
            placeholder={mode === "set" ? "Nuevo stock" : "Cantidad"}
            className="flex-1 h-12 px-4 rounded-2xl bg-black/30 border border-white/10 text-white text-lg font-semibold text-center focus:border-teal-500/50 focus:outline-none focus:ring-2 focus:ring-teal-500/20 transition-all"
          />
          {qty !== "" && (
            <div className={`px-4 py-3 rounded-2xl border text-center min-w-[80px] ${
              newStock < 0 ? "bg-red-500/15 border-red-500/30" :
              newStock === 0 ? "bg-red-500/10 border-red-500/20" :
              newStock <= (item.min_stock || 0) ? "bg-amber-500/15 border-amber-500/30" :
              "bg-emerald-500/10 border-emerald-500/20"
            }`}>
              <p className="text-xs text-white/40 font-bold">→ quedará</p>
              <p className={`text-xl font-semibold ${
                newStock <= 0 ? "text-red-400" :
                newStock <= (item.min_stock || 0) ? "text-amber-400" : "text-emerald-400"
              }`}>{Math.max(0, newStock)}</p>
            </div>
          )}
        </div>

        <input
          value={note}
          onChange={e => setNote(e.target.value)}
          placeholder="Nota (opcional): razón del ajuste..."
          className="w-full h-9 px-3 rounded-xl bg-black/20 border border-white/[0.07] text-white/70 text-xs mb-4 focus:border-teal-500/30 focus:outline-none"
        />

        <button
          onClick={handleSave}
          disabled={saving}
          className="w-full h-12 rounded-2xl bg-gradient-to-r from-teal-500 to-cyan-500 text-white font-semibold text-sm shadow-lg hover:opacity-90 active:scale-[0.98] transition-all disabled:opacity-50"
        >
          {saving ? "Guardando..." : "Guardar Ajuste"}
        </button>
      </div>
    </div>
  );
}

// === HistorialMovimientos — dialog con los últimos movimientos ===
function HistorialMovimientosDialog({ open, onClose }) {
  const [movements, setMovements] = React.useState([]);
  const [loading, setLoading] = React.useState(true);
  const [filterType, setFilterType] = React.useState("all");

  React.useEffect(() => {
    if (!open) return;
    setLoading(true);
    dataClient.entities.InventoryMovement.list("-created_date", 200)
      .then(r => setMovements(r || []))
      .catch(() => setMovements([]))
      .finally(() => setLoading(false));
  }, [open]);

  if (!open) return null;

  const TYPES = [
    { k: "all", label: "Todos" },
    { k: "adjustment", label: "Ajustes" },
    { k: "sale", label: "Ventas" },
    { k: "purchase", label: "Compras" },
    { k: "order_add", label: "Órdenes" },
  ];

  const filtered = filterType === "all" ? movements : movements.filter(m => m.movement_type === filterType);

  const typeLabel = (t) => ({ sale: "Venta", order_add: "Orden+", order_remove: "Orden-",
    void_return: "Devolución", adjustment: "Ajuste", purchase: "Compra", initial: "Inicial" })[t] || t;

  const typeColor = (t) => t === "sale" || t === "order_remove" ? "text-red-400 bg-red-500/10 border-red-500/20"
    : t === "adjustment" ? "text-cyan-400 bg-cyan-500/10 border-cyan-500/20"
    : "text-emerald-400 bg-emerald-500/10 border-emerald-500/20";

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="bg-[#0f0f10] border border-cyan-500/20 max-w-2xl max-h-[85vh] p-0 gap-0 flex flex-col">
        <DialogHeader className="px-5 pt-5 pb-3 border-b border-white/[0.07] flex-shrink-0">
          <DialogTitle className="text-white font-semibold flex items-center gap-2">
            <History className="w-5 h-5 text-cyan-400" />
            Historial de Movimientos
          </DialogTitle>
        </DialogHeader>

        <div className="flex items-center gap-1.5 px-5 py-3 border-b border-white/[0.05] overflow-x-auto flex-shrink-0">
          {TYPES.map(t => (
            <button key={t.k} onClick={() => setFilterType(t.k)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${
                filterType === t.k ? "bg-white/15 text-white" : "text-white/50 hover:text-white"
              }`}>{t.label}</button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-2">
          {loading ? (
            <div className="py-12 text-center text-white/50 text-sm">Cargando historial...</div>
          ) : filtered.length === 0 ? (
            <div className="py-12 text-center">
              <History className="w-10 h-10 text-white/40 mx-auto mb-3" />
              <p className="text-white/50 text-sm">No hay movimientos registrados aún</p>
            </div>
          ) : filtered.map((m, idx) => (
            <div key={m.id || idx} className="flex items-center gap-3 p-3 bg-white/[0.03] border border-white/[0.05] rounded-2xl">
              <div className={`w-9 h-9 rounded-xl border flex items-center justify-center flex-shrink-0 text-xs font-semibold ${typeColor(m.movement_type)}`}>
                {Number(m.quantity) > 0 ? "+" : ""}{m.quantity}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-white text-sm font-semibold truncate">{m.product_name || "Producto"}</p>
                <p className="text-white/50 text-xs">
                  {m.previous_stock ?? "—"} → {m.new_stock ?? "—"} unids
                  {m.notes ? ` · ${m.notes}` : ""}
                  {m.performed_by ? ` · ${m.performed_by}` : ""}
                </p>
              </div>
              <div className="text-right flex-shrink-0">
                <span className={`text-xs font-bold px-2 py-0.5 rounded-lg border ${typeColor(m.movement_type)}`}>{typeLabel(m.movement_type)}</span>
                <p className="text-white/50 text-[10px] mt-1">
                  {m.created_date ? new Date(m.created_date).toLocaleDateString("es-PR", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }) : ""}
                </p>
              </div>
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
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
  const { checkLimit, upgradeTo } = usePlanLimits();
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
  const [showQuickOrder, setShowQuickOrder] = useState(false);
  const [viewTab, setViewTab] = useState("products");
  const [page, setPage] = useState(1);
  const [mainCategory, setMainCategory] = useState("dispositivos");
  const [showReports, setShowReports] = useState(false);
  const [showManageCategories, setShowManageCategories] = useState(false);
  const [viewMode, setViewMode] = useState("products"); // products | categories
  // ── Ajuste Rápido de Stock ────────────────────────────────────────────
  const [quickAdjustItem, setQuickAdjustItem] = useState(null);
  // ── Historial de Movimientos ─────────────────────────────────────────
  const [showHistorial, setShowHistorial] = useState(false);
  // ── Menú ⋯ (acciones secundarias) ────────────────────────────────────
  const [showMoreMenu, setShowMoreMenu] = useState(false);
  const moreMenuRef = useRef(null);
  const pageSize = 24;
  const recentCreatedRef = useRef([]);
  const [aiInventoryAnalysis, setAiInventoryAnalysis] = useState("");
  const [aiInventoryLoading, setAiInventoryLoading] = useState(false);
  const containerRef = useRef(null);

  useEffect(() => {
    loadInventory();
  }, []);

  // Pull-to-refresh DESHABILITADO por request del usuario.
  // El refresh se hace solo por el botón en el header.

  // Cerrar menú ⋯ al hacer clic fuera
  useEffect(() => {
    if (!showMoreMenu) return;
    const handler = (e) => {
      if (moreMenuRef.current && !moreMenuRef.current.contains(e.target)) {
        setShowMoreMenu(false);
      }
    };
    document.addEventListener("mousedown", handler);
    document.addEventListener("touchstart", handler);
    return () => {
      document.removeEventListener("mousedown", handler);
      document.removeEventListener("touchstart", handler);
    };
  }, [showMoreMenu]);

  // ✅ OPTIMIZACIÓN: Carga de datos con manejo robusto de errores y caché
  const loadInventory = async () => {
    try {
      const [pRes, poRes, supRes, woRes, catRes, ptRes, accRes] = await Promise.allSettled([
      dataClient.entities.Product?.list?.("-created_date", 500).catch(() => []),
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

    // Búsqueda por texto (nombre + SKU + barcode + proveedor + modelos)
    if (q.trim()) {
      const t = q.toLowerCase();
      list = list.filter((it) =>
        String(it.name || "").toLowerCase().includes(t) ||
        String(it.sku || "").toLowerCase().includes(t) ||
        String(it.barcode || "").toLowerCase().includes(t) ||
        String(it.supplier_name || "").toLowerCase().includes(t) ||
        (Array.isArray(it.compatibility_models) &&
          it.compatibility_models.join(" ").toLowerCase().includes(t))
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

  // ── Helper: registrar movimiento de inventario ─────────────────────
  const recordMovement = async ({ product_id, product_name, movement_type, quantity, previous_stock, new_stock, notes, reference_type }) => {
    try {
      const sessionRaw = localStorage.getItem("employee_session") || sessionStorage.getItem("911-session");
      const session = sessionRaw ? JSON.parse(sessionRaw) : null;
      const performed_by = session?.full_name || session?.userName || session?.email || "Usuario";
      await dataClient.entities.InventoryMovement.create({
        product_id,
        product_name,
        movement_type,
        quantity,
        previous_stock,
        new_stock,
        notes: notes || "",
        reference_type: reference_type || "adjustment",
        performed_by,
      });
    } catch (e) {
      console.warn("[Inventory] No se pudo registrar movimiento:", e);
    }
  };

  // ── Ajuste Rápido de Stock ────────────────────────────────────────────
  const handleQuickAdjust = async ({ item, newStock, previousStock, mode, qty, note }) => {
    const clampedStock = Math.max(0, newStock);
    try {
      // Actualizar producto
      await dataClient.entities.Product.update(item.id, { stock: clampedStock });
      // Actualizar estado local inmediatamente
      setItems(prev => prev.map(p => p.id === item.id ? { ...p, stock: clampedStock } : p));

      // Registrar movimiento
      const movQty = mode === "set" ? (clampedStock - previousStock)
        : mode === "add" ? qty : -qty;
      await recordMovement({
        product_id: item.id,
        product_name: item.name,
        movement_type: "adjustment",
        quantity: movQty,
        previous_stock: previousStock,
        new_stock: clampedStock,
        notes: note || `Ajuste manual (${mode === "add" ? "+" : mode === "remove" ? "-" : "="}${Math.abs(movQty)})`,
        reference_type: "adjustment",
      });

      // Alerta de stock bajo
      if (clampedStock <= (item.min_stock || 0) && previousStock > (item.min_stock || 0)) {
        const admins = await dataClient.entities.User.list();
        for (const admin of (admins || []).filter(u => u.role === "admin" || u.role === "manager")) {
          if (!admin.id || !admin.email) continue;
          await NotificationService.createNotification({
            userId: admin.id,
            userEmail: admin.email,
            type: "low_stock",
            title: `⚠️ Stock bajo: ${item.name}`,
            body: `Solo quedan ${clampedStock} unidades (mínimo: ${item.min_stock || 0})`,
            relatedEntityType: "product",
            relatedEntityId: item.id,
            actionUrl: `/Inventory`,
            actionLabel: "Ver inventario",
            priority: clampedStock === 0 ? "urgent" : "high",
          });
        }
      }

      toast.success(`✅ Stock actualizado: ${item.name} → ${clampedStock}`);
    } catch (err) {
      console.error("[QuickAdjust] Error:", err);
      toast.error("No se pudo actualizar el stock");
      throw err;
    }
  };

  const handleSaveItem = async (payload, savedCategory, savedPartType) => {
    try {
      const normalizedPayload = normalizeProductPayload(payload);
      const oldItem = payload.id ? items.find((i) => i.id === payload.id) : null;
      const oldStock = oldItem?.stock ?? null;

      if (payload.id) {
        console.log("✏️ Actualizando pieza:", payload.id, normalizedPayload);
        try {
          await dataClient.entities.Product.update(payload.id, normalizedPayload);
        } catch (primaryError) {
          console.warn("[Inventory] Product.update failed, trying direct supabase fallback:", primaryError);
          const { error } = await supabase
            .from("product")
            .update(normalizedPayload)
            .eq("id", payload.id);

          if (error) throw error;
        }

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

        // Registrar movimiento si cambió el stock
        if (oldStock !== null && oldStock !== newStock) {
          await recordMovement({
            product_id: payload.id,
            product_name: payload.name,
            movement_type: "adjustment",
            quantity: newStock - oldStock,
            previous_stock: oldStock,
            new_stock: newStock,
            notes: "Edición de producto",
            reference_type: "adjustment",
          });
        }

        // Recargar inventario
        await loadInventory();
      } else {
        console.log("➕ Creando nueva pieza:", normalizedPayload);
        let created = null;
        try {
          created = await dataClient.entities.Product.create(normalizedPayload);
          // Registrar movimiento inicial si tiene stock
          if (created?.id && Number(normalizedPayload.stock || 0) > 0) {
            await recordMovement({
              product_id: created.id,
              product_name: normalizedPayload.name,
              movement_type: "initial",
              quantity: Number(normalizedPayload.stock),
              previous_stock: 0,
              new_stock: Number(normalizedPayload.stock),
              notes: "Stock inicial al crear producto",
              reference_type: "adjustment",
            });
          }
        } catch (primaryError) {
          console.warn("[Inventory] Product.create failed, trying direct supabase fallback:", primaryError);
          const { data, error } = await supabase
            .from("product")
            .insert(normalizedPayload)
            .select("*")
            .single();

          if (error) throw error;
          created = data;
        }
        const newItem = created && created.id ? created : {
          ...normalizedPayload,
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
          normalizedPayload.tipo_principal === "accesorios"
            ? "accesorios"
            : normalizedPayload.type === "service" || savedPartType === "servicio"
              ? "servicios"
              : normalizedPayload.subcategoria === "dispositivo_completo"
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
          normalizedPayload.type === "service" ||
          savedPartType === "servicio" ||
          normalizedPayload.part_type === "servicio";
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
      toast.error(err?.message || "No se pudo guardar");
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

  const fetchInventoryAnalysis = async () => {
    setAiInventoryLoading(true);
    setAiInventoryAnalysis("");
    try {
      const allItems = items || [];
      const lowStock = allItems.filter(p => p.active !== false && Number(p.stock||0) <= Number(p.min_stock||0) && Number(p.stock||0) >= 0);
      const outOfStock = allItems.filter(p => p.active !== false && Number(p.stock||0) <= 0);
      const top = allItems
        .filter(p => p.active !== false && Number(p.stock||0) > 0)
        .sort((a,b) => Number(a.stock||0) - Number(b.stock||0))
        .slice(0, 5)
        .map(p => `${p.name} (stock: ${p.stock}, mín: ${p.min_stock||0})`);

      const activeItems = allItems.filter(p => p.active !== false);
      const totalValue = activeItems.reduce((s, p) => s + (Number(p.cost||0) * Number(p.stock||0)), 0);
      const totalRetailValue = activeItems.reduce((s, p) => s + (Number(p.price||0) * Number(p.stock||0)), 0);

      const prompt = `INVENTARIO DEL TALLER:
- Total productos activos: ${activeItems.length}
- Agotados (0 stock): ${outOfStock.length}
- Stock bajo: ${lowStock.length}
- Valor costo total: $${totalValue.toFixed(0)}
- Valor venta total: $${totalRetailValue.toFixed(0)}
- Margen potencial: $${(totalRetailValue - totalValue).toFixed(0)}
- Productos criticos: ${top.join(", ") || "ninguno"}
${outOfStock.length > 0 ? `- SIN STOCK: ${outOfStock.slice(0,5).map(p => p.name).join(", ")}` : ""}

Analiza como experto en gestion de inventario de taller de reparacion.`;

      const text = await callJENAI(prompt, {
        maxTokens: 300,
        temperature: 0.35,
        systemPrompt: `Eres JENAI, analista de inventario de SmartFixOS. Responde en espanol.
Formato obligatorio:
1. ESTADO: resumen de 2 oraciones del inventario
2. URGENTE: que piezas comprar YA (si hay agotados)
3. RIESGO: que puede pasar si no se actua
4. VALOR: analisis del valor del inventario y margen
5. ACCION: recomendacion concreta y priorizada
Maximo 150 palabras. Texto plano, sin markdown.`
      });
      setAiInventoryAnalysis(text);
    } catch(err) {
      setAiInventoryAnalysis("⚠️ " + err.message);
    } finally {
      setAiInventoryLoading(false);
    }
  };

  const handleDiscountSuccess = async () => {
    await loadInventory();
    setSelectedProducts([]);
    setShowDiscountDialog(false);
  };

  return (
    <div ref={containerRef} className="min-h-dvh apple-surface apple-type overflow-y-auto apple-scroll pb-24" style={{ WebkitOverflowScrolling: 'touch' }}>
      {/* Pull-to-refresh indicator ELIMINADO */}

      <div className="app-container py-4 sm:py-6" style={{ paddingTop: "calc(env(safe-area-inset-top, 0px) + 16px)" }}>
        {/* ── Header estilo iOS (large title + acciones) ─────────── */}
        <div className="flex items-end justify-between gap-3 mb-5">
          <div className="min-w-0 flex-1">
            <h1 className="apple-text-large-title apple-label-primary">Inventario</h1>
            <p className="apple-text-footnote apple-label-secondary mt-0.5 truncate tabular-nums">
              {items.length} productos · <span className={items.filter(i => i.part_type !== 'servicio' && Number(i.stock||0) <= 0).length > 0 ? 'text-apple-red' : 'apple-label-tertiary'}>{items.filter(i => i.part_type !== 'servicio' && Number(i.stock||0) <= 0).length} agotados</span>
            </p>
          </div>

          <div className="flex items-center gap-2 flex-shrink-0">
            {selectedProducts.length > 0 && (
              <button
                onClick={() => setShowDiscountDialog(true)}
                className="apple-btn text-[13px] min-h-9 px-3 bg-apple-orange/15 text-apple-orange flex items-center gap-1.5"
              >
                <Tag className="w-3.5 h-3.5" /> Oferta ({selectedProducts.length})
              </button>
            )}

            {/* ⋯ Menú secundario */}
            <div className="relative" ref={moreMenuRef}>
              <button
                onClick={() => setShowMoreMenu(p => !p)}
                className={`apple-press w-9 h-9 rounded-full flex items-center justify-center transition-all ${
                  showMoreMenu ? 'bg-apple-blue/15 text-apple-blue' : 'bg-gray-sys6 dark:bg-gray-sys5 apple-label-secondary'
                }`}
                aria-label="Más opciones"
              >
                <MoreHorizontal className="w-[18px] h-[18px]" />
              </button>

              {showMoreMenu && (
                <div className="absolute right-0 top-11 z-[100] w-60 apple-surface-elevated rounded-apple-md overflow-hidden shadow-apple-xl animate-apple-scale-in" style={{ border: "0.5px solid rgb(var(--separator) / 0.29)" }}>
                  {[
                    { label: 'Historial de movimientos', Icon: History, action: () => { setShowHistorial(true); setShowMoreMenu(false); } },
                    { label: 'Gestionar categorías', Icon: Settings, action: () => { setShowManageCategories(true); setShowMoreMenu(false); } },
                    { label: 'Proveedores', Icon: Globe, action: () => { setShowSuppliers(true); setShowMoreMenu(false); } },
                    null,
                    { label: 'Orden especial', Icon: Zap, action: () => { setShowQuickOrder(true); setShowMoreMenu(false); }, accent: 'text-apple-purple' },
                  ].map((item, i) =>
                    item === null ? (
                      <div key={i} className="h-[0.5px] mx-3" style={{ backgroundColor: "rgb(var(--separator) / 0.29)" }} />
                    ) : (
                      <button
                        key={item.label}
                        onClick={item.action}
                        className={`apple-press w-full flex items-center gap-3 px-4 py-3 apple-text-body text-left ${item.accent || 'apple-label-primary'}`}
                      >
                        <item.Icon className="w-[18px] h-[18px] flex-shrink-0" />
                        {item.label}
                      </button>
                    )
                  )}
                </div>
              )}
            </div>

            <button
              onClick={() => {
                const { allowed, current, max } = checkLimit('max_skus', items.length);
                if (!allowed) {
                  const next = upgradeTo?.label || 'Pro';
                  toast.error(`Límite alcanzado: ${current}/${max} productos. Upgrade a ${next} ($${upgradeTo?.price || '39.99'}/mes) para inventario ilimitado.`, { duration: 7000 });
                  return;
                }
                setEditing(null);
                setShowItemDialog(true);
              }}
              className="apple-btn apple-btn-primary text-[13px] min-h-9 px-3.5"
            >
              <Plus className="w-[18px] h-[18px]" /> Nuevo
            </button>
          </div>
        </div>

        {/* ── KPI Bar (apple-cards) ─────────────────────────────── */}
        {(() => {
          const total = items.length;
          const outOfStock = items.filter(i => i.type !== 'service' && i.part_type !== 'servicio' && Number(i.stock || 0) <= 0).length;
          const lowStock = items.filter(i => i.type !== 'service' && i.part_type !== 'servicio' && Number(i.stock || 0) > 0 && Number(i.stock || 0) <= Number(i.min_stock || 0)).length;
          const totalValue = items.reduce((sum, i) => sum + Number(i.stock || 0) * Number(i.cost || 0), 0);
          const kpis = [
            { label: 'Total', value: total, icon: Package, color: 'apple-label-secondary', val: 'apple-label-primary' },
            { label: 'Stock bajo', value: lowStock, icon: TrendingDown, color: lowStock > 0 ? 'text-apple-yellow' : 'apple-label-tertiary', val: lowStock > 0 ? 'text-apple-yellow' : 'apple-label-tertiary' },
            { label: 'Agotados', value: outOfStock, icon: AlertTriangle, color: outOfStock > 0 ? 'text-apple-red' : 'apple-label-tertiary', val: outOfStock > 0 ? 'text-apple-red' : 'apple-label-tertiary' },
            { label: 'Valor inv.', value: `$${totalValue.toLocaleString('en-US', { maximumFractionDigits: 0 })}`, icon: TrendingUp, color: 'text-apple-green', val: 'text-apple-green' },
          ];
          return (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 mb-5">
              {kpis.map(({ label, value, icon: Icon, color, val }) => (
                <div key={label} className="apple-card p-3 flex items-center gap-2.5">
                  <Icon className={`w-4 h-4 ${color} flex-shrink-0`} />
                  <div className="min-w-0">
                    <p className="apple-text-caption2 apple-label-secondary truncate">{label}</p>
                    <p className={`apple-text-headline leading-tight tabular-nums ${val}`}>{value}</p>
                  </div>
                </div>
              ))}
            </div>
          );
        })()}

        {/* ── JENAI Inventory Insights ── */}
        <div className="mb-4">
          <JENAIInsightBanner
            context="inventory"
            data={{
              totalProducts: items.length,
              outOfStock: items.filter(p => (p.stock || 0) <= 0).length,
              lowStock: items.filter(p => (p.stock || 0) > 0 && (p.stock || 0) <= (p.min_stock || 3)).length,
              healthy: items.filter(p => (p.stock || 0) > (p.min_stock || 3)).length,
              totalValue: items.reduce((s, p) => s + (p.cost || 0) * (p.stock || 0), 0).toFixed(0),
              criticalItems: items.filter(p => (p.stock || 0) <= 0).slice(0, 5).map(p => p.name).join(", "),
            }}
            accentColor="amber"
            autoLoad={false}
          />
        </div>

        {/* ── IA Inventario ── */}
        <div className="border border-violet-500/20 rounded-2xl overflow-hidden bg-white/[0.02] mb-4">
          <div className="flex items-center justify-between px-4 py-3">
            <div className="flex items-center gap-2">
              <span className="text-violet-400">✨</span>
              <span className="text-xs font-semibold text-white/50">Análisis IA del inventario</span>
            </div>
            <button
              onClick={fetchInventoryAnalysis}
              disabled={aiInventoryLoading}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-violet-500/10 border border-violet-500/20 text-violet-300 text-xs font-semibold hover:bg-violet-500/20 transition-all active:scale-95 disabled:opacity-50"
            >
              {aiInventoryLoading ? "Analizando…" : "✨ Analizar stock"}
            </button>
          </div>
          {(aiInventoryAnalysis || aiInventoryLoading) && (
            <div className="px-4 pb-4">
              {aiInventoryLoading ? (
                <div className="flex gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-violet-400 animate-bounce" style={{animationDelay:"0ms"}} />
                  <span className="w-1.5 h-1.5 rounded-full bg-violet-400 animate-bounce" style={{animationDelay:"150ms"}} />
                  <span className="w-1.5 h-1.5 rounded-full bg-violet-400 animate-bounce" style={{animationDelay:"300ms"}} />
                </div>
              ) : (
                <p className="text-sm text-white/70 leading-relaxed">{aiInventoryAnalysis}</p>
              )}
            </div>
          )}
        </div>

        {/* ── Main Category Tabs ────────────────────────────────── */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 mb-4 scrollbar-none">
          {[
            { key: 'dispositivos', label: 'Dispositivos', Icon: Smartphone, color: 'text-cyan-400', filterFn: i => i.tipo_principal === 'dispositivos' && i.subcategoria === 'dispositivo_completo' },
            { key: 'piezas', label: 'Piezas', Icon: Wrench, color: 'text-emerald-400', filterFn: i => i.tipo_principal === 'dispositivos' && i.subcategoria === 'piezas_servicios' && i.part_type !== 'servicio' },
            { key: 'accesorios', label: 'Accesorios', Icon: Box, color: 'text-purple-400', filterFn: i => i.tipo_principal === 'accesorios' },
            { key: 'servicios', label: 'Servicios', Icon: Sparkles, color: 'text-orange-400', filterFn: i => i.tipo_principal === 'servicios' || i.part_type === 'servicio' || i.part_type === 'diagnostic' },
          ].map(({ key, label, Icon, color, filterFn }) => {
            const count = items.filter(filterFn).length;
            const active = mainCategory === key;
            return (
              <button
                key={key}
                onClick={() => { setMainCategory(key); setDeviceCategory(null); setPartTypeFilter("all"); setPage(1); }}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-2xl text-sm font-semibold whitespace-nowrap transition-all active:scale-95 flex-shrink-0 ${
                  active ? 'bg-white text-gray-900 shadow-lg' : 'bg-[#111114]/60 border border-white/[0.07] text-white/50 hover:text-white hover:bg-white/10'
                }`}
              >
                <Icon className={`w-4 h-4 ${active ? 'text-gray-700' : color}`} />
                {label}
                <span className={`text-xs font-bold ${active ? 'text-gray-500' : 'text-white/50'}`}>{count}</span>
              </button>
            );
          })}
        </div>

        {/* ── Device sub-category pills ─────────────────────────── */}
        {(mainCategory === 'dispositivos' || mainCategory === 'piezas' || mainCategory === 'servicios') && deviceCategories.length > 0 && (
          <div className="flex items-center gap-2 overflow-x-auto pb-1 mb-4 scrollbar-none">
            <button
              onClick={() => { setDeviceCategory(null); setPage(1); }}
              className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold whitespace-nowrap flex-shrink-0 transition-all ${
                !deviceCategory ? 'bg-white/15 text-white' : 'bg-[#111114]/60 border border-white/[0.07] text-white/40 hover:text-white'
              }`}
            >
              Todos
            </button>
            {deviceCategories.map(cat => {
              const catValue = cat.icon || cat.name.toLowerCase();
              const IconComp = ICON_MAP[cat.icon_name] || Smartphone;
              return (
                <button
                  key={cat.id}
                  onClick={() => { setDeviceCategory(catValue); setPage(1); }}
                  className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold whitespace-nowrap flex-shrink-0 transition-all active:scale-95 ${
                    deviceCategory === catValue ? 'bg-white/15 text-white' : 'bg-[#111114]/60 border border-white/[0.07] text-white/40 hover:text-white'
                  }`}
                >
                  <IconComp className="w-3.5 h-3.5" />
                  {cat.name}
                </button>
              );
            })}
          </div>
        )}

        {/* ── Accessory sub-category pills ─────────────────────── */}
        {mainCategory === 'accesorios' && accessoryCategories.length > 0 && (
          <div className="flex items-center gap-2 overflow-x-auto pb-1 mb-4 scrollbar-none">
            <button
              onClick={() => { setDeviceCategory(null); setPage(1); }}
              className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold whitespace-nowrap flex-shrink-0 transition-all ${
                !deviceCategory ? 'bg-white/15 text-white' : 'bg-[#111114]/60 border border-white/[0.07] text-white/40 hover:text-white'
              }`}
            >
              Todos
            </button>
            {accessoryCategories.map(acc => {
              const IconComp = ICON_MAP[acc.icon_name] || Box;
              return (
                <button
                  key={acc.id}
                  onClick={() => { setDeviceCategory(acc.slug); setPage(1); }}
                  className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold whitespace-nowrap flex-shrink-0 transition-all active:scale-95 ${
                    deviceCategory === acc.slug ? 'bg-white/15 text-white' : 'bg-[#111114]/60 border border-white/[0.07] text-white/40 hover:text-white'
                  }`}
                >
                  <IconComp className="w-3.5 h-3.5" />
                  {acc.name}
                </button>
              );
            })}
          </div>
        )}

        {/* ── Part type + view tabs (piezas only) ──────────────── */}
        {mainCategory === 'piezas' && (
          <div className="flex flex-wrap items-center gap-2 mb-4">
            <button
              onClick={() => { setPartTypeFilter("all"); setPage(1); }}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                partTypeFilter === "all" ? 'bg-white/15 text-white' : 'bg-[#111114]/60 border border-white/[0.07] text-white/40 hover:text-white'
              }`}
            >
              Todas
            </button>
            {partTypes.filter(pt => pt.active !== false).map(type => {
              const IconComp = ICON_MAP[type.icon_name] || Monitor;
              const count = items.filter(i => i.tipo_principal === 'dispositivos' && i.subcategoria === 'piezas_servicios' && i.part_type === type.slug && (!deviceCategory || i.device_category === deviceCategory)).length;
              return (
                <button
                  key={type.id}
                  onClick={() => { setPartTypeFilter(type.slug); setPage(1); }}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all active:scale-95 ${
                    partTypeFilter === type.slug ? 'bg-emerald-500/15 border border-emerald-500/30 text-emerald-300' : 'bg-[#111114]/60 border border-white/[0.07] text-white/40 hover:text-white'
                  }`}
                >
                  <IconComp className="w-3.5 h-3.5" />
                  {type.name}
                  <span className="opacity-40">{count}</span>
                </button>
              );
            })}
            <div className="h-5 w-px bg-white/10 mx-0.5" />
            {[
              { key: 'products', label: 'Productos', Icon: Box },
              { key: 'offers', label: 'Ofertas', Icon: Tag },
              { key: 'services', label: 'Servicios', Icon: Wrench },
            ].map(({ key, label, Icon }) => (
              <button
                key={key}
                onClick={() => { setViewTab(key); setPage(1); }}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all active:scale-95 ${
                  viewTab === key ? 'bg-white/15 text-white' : 'text-white/50 hover:text-white'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                {label}
              </button>
            ))}
          </div>
        )}

        {/* ── Search ────────────────────────────────────────────── */}
        <div className="relative mb-5 group">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-white/50 group-focus-within:text-teal-400 transition-colors" />
          <Input
            value={q}
            onChange={e => { setQ(e.target.value); setPage(1); }}
            placeholder="Buscar por nombre, SKU, código, proveedor, modelos..."
            className="pl-11 h-11 bg-[#111114]/60 border border-white/[0.08] rounded-2xl text-white text-sm placeholder:text-white/50 focus:bg-[#111114]/80 focus:border-teal-500/50 focus:ring-2 focus:ring-teal-500/20 transition-all"
          />
        </div>

        {/* ── Product grid ──────────────────────────────────────── */}
        <div className="min-h-[300px]">
          {pageItems.length === 0 ? (
            <div className="text-center py-20">
              <Box className="w-14 h-14 text-white/40 mx-auto mb-4" />
              <p className="text-white/50 font-bold text-sm sm:text-base text-center px-4">
                {q ? `Sin resultados para "${q}"` : "No hay productos en esta categoría"}
              </p>
              <button
                onClick={() => { setEditing(null); setShowItemDialog(true); }}
                className="mt-4 inline-flex items-center gap-2 px-5 py-2.5 rounded-2xl bg-teal-500/15 border border-teal-500/25 text-teal-400 text-sm font-bold hover:bg-teal-500/25 transition-all"
              >
                <Plus className="w-4 h-4" /> Agregar producto
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4 gap-3">
              {pageItems.map(item => (
                <InventoryCard
                  key={item.id}
                  item={item}
                  isSelected={selectedProducts.some(p => p.id === item.id)}
                  onSelect={handleSelectProduct}
                  onEdit={it => { setEditing(it); setShowItemDialog(true); }}
                  onDelete={handleDeleteItem}
                  onQuickAdjust={it => setQuickAdjustItem(it)}
                />
              ))}
            </div>
          )}
        </div>

        {/* ── Pagination ────────────────────────────────────────── */}
        {filtered.length > 0 && (
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mt-8 px-1">
            <p className="text-sm text-white/50 font-medium">
              Mostrando <span className="text-white font-bold">{pageItems.length}</span> de <span className="text-white font-bold">{filtered.length}</span> productos
            </p>
            <div className="flex items-center gap-3">
              <Button size="icon" variant="ghost" disabled={page <= 1} onClick={() => setPage(p => Math.max(1, p - 1))}
                aria-label="Página anterior"
                className="h-9 w-9 rounded-full bg-white/5 hover:bg-white/10 border border-white/10 disabled:opacity-30 transition-all">
                <ChevronLeft className="w-4 h-4" />
              </Button>
              <div className="px-4 py-2 bg-white/5 rounded-full border border-white/10">
                <span className="text-white font-bold text-sm">{page}</span>
                <span className="text-white/50 mx-1.5">/</span>
                <span className="text-white/50 font-semibold text-sm">{pageCount}</span>
              </div>
              <Button size="icon" variant="ghost" disabled={page >= pageCount} onClick={() => setPage(p => Math.min(pageCount, p + 1))}
                aria-label="Página siguiente"
                className="h-9 w-9 rounded-full bg-white/5 hover:bg-white/10 border border-white/10 disabled:opacity-30 transition-all">
                <ChevronRight className="w-4 h-4" />
              </Button>
            </div>
          </div>
        )}

        {/* ── Dialogs (unchanged) ───────────────────────────────── */}
        {showItemDialog && (
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
            suppliers={suppliers}
          />
        )}

        {showReports && (
          <InventoryReports open={showReports} onClose={() => setShowReports(false)} />
        )}

        {showPOMenu && (
          <Dialog open={showPOMenu} onOpenChange={setShowPOMenu}>
            <DialogContent className="bg-[#0f0f10] border border-cyan-500/20 max-w-md text-white">
              <DialogHeader>
                <DialogTitle className="text-xl font-bold text-white flex items-center gap-2">
                  <FileText className="w-6 h-6 text-cyan-400" />
                  Órdenes de Compra
                </DialogTitle>
              </DialogHeader>
              <div className="space-y-3 py-4">
                <button type="button" onClick={() => { setShowPOMenu(false); setShowPOList(true); }}
                  className="w-full flex items-center gap-4 p-6 rounded-xl bg-gradient-to-br from-cyan-600/20 to-emerald-600/20 border-2 border-cyan-500/30 hover:border-cyan-500/50 transition-all">
                  <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-cyan-600 to-emerald-600 flex items-center justify-center">
                    <FileText className="w-6 h-6 text-white" />
                  </div>
                  <div className="text-left flex-1">
                    <p className="text-lg font-bold text-white">Ver Órdenes</p>
                    <p className="text-sm text-white/60">Historial de órdenes de compra</p>
                  </div>
                </button>
                <button type="button" onClick={() => { setShowPOMenu(false); setShowPODialog(true); }}
                  className="w-full flex items-center gap-4 p-6 rounded-xl bg-gradient-to-br from-emerald-600/20 to-green-600/20 border-2 border-emerald-500/30 hover:border-emerald-500/50 transition-all">
                  <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-emerald-600 to-green-600 flex items-center justify-center">
                    <Plus className="w-6 h-6 text-white" />
                  </div>
                  <div className="text-left flex-1">
                    <p className="text-lg font-bold text-white">Nueva Orden</p>
                    <p className="text-sm text-white/60">Crear orden de compra</p>
                  </div>
                </button>
              </div>
            </DialogContent>
          </Dialog>
        )}

        {showPOList && (
          <Dialog open={showPOList} onOpenChange={setShowPOList}>
            <DialogContent className="bg-[#0f0f10] border border-cyan-500/20 max-w-4xl text-white">
              <DialogHeader>
                <DialogTitle className="text-xl font-bold text-white">Historial de Órdenes de Compra</DialogTitle>
              </DialogHeader>
              <div className="space-y-3 max-h-[60vh] overflow-y-auto">
                {poList.length === 0 ? (
                  <p className="text-white/40 text-sm text-center py-8">Aún no hay órdenes de compra.</p>
                ) : poList.map(po => (
                  <div key={po.id} className="flex items-center justify-between gap-3 rounded-lg border border-cyan-500/20 px-4 py-3 hover:border-cyan-500/40">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <p className="text-sm font-semibold text-white">{po.po_number}</p>
                        <Badge className={`text-xs ${po.status === "received" ? "bg-green-600/20 text-green-300 border-green-600/30" : po.status === "ordered" ? "bg-blue-600/20 text-blue-300 border-blue-600/30" : "bg-gray-600/20 text-gray-300 border-gray-600/30"}`}>
                          {po.status === "draft" ? "Borrador" : po.status === "ordered" ? "Ordenado" : po.status === "received" ? "Recibido" : "Cancelado"}
                        </Badge>
                      </div>
                      <p className="text-xs text-white/40">{po.supplier_name || "Suplidor no definido"} · ${Number(po.total_amount || 0).toFixed(2)} · {(po.items || po.line_items || []).length} productos</p>
                    </div>
                    <Button type="button" size="sm" onClick={() => { setViewingPO(po); setShowPOList(false); setShowPODetail(true); }} className="bg-cyan-600 hover:bg-cyan-700 h-8 text-xs">
                      Ver/Editar
                    </Button>
                  </div>
                ))}
              </div>
            </DialogContent>
          </Dialog>
        )}

        {showSuppliers && (
          <SuppliersDialog open={showSuppliers} onClose={async () => { setShowSuppliers(false); const supRes = await loadSuppliersSafe(); setSuppliers(supRes || []); }} />
        )}

        {showPODialog && (
          <PurchaseOrderDialog
            open={showPODialog}
            onClose={async (reload) => { setShowPODialog(false); setEditingPO(null); if (reload) await loadInventory(); }}
            purchaseOrder={editingPO}
            suppliers={suppliers}
            products={items}
            workOrders={workOrders}
          />
        )}

        {showPODetail && (
          <PurchaseOrderDetailDialog
            open={showPODetail}
            onClose={async (reload) => { setShowPODetail(false); setViewingPO(null); if (reload) await loadInventory(); }}
            purchaseOrder={viewingPO}
            suppliers={suppliers}
            products={items}
            workOrders={workOrders}
          />
        )}

        {showDiscountDialog && (
          <SetDiscountDialog open={showDiscountDialog} onClose={() => setShowDiscountDialog(false)} products={selectedProducts} onSuccess={handleDiscountSuccess} />
        )}

        {showManageCategories && (
          <ManageCategoriesDialog open={showManageCategories} onClose={() => setShowManageCategories(false)} onUpdate={loadInventory} />
        )}

        {showQuickOrder && (
          <QuickOrderDialog
            open={showQuickOrder}
            onClose={(reload) => { setShowQuickOrder(false); if (reload) loadInventory(); }}
            workOrders={workOrders}
            suppliers={suppliers}
          />
        )}

        {/* ── Ajuste Rápido de Stock ─────────────────────────────── */}
        {quickAdjustItem && (
          <QuickStockAdjust
            item={quickAdjustItem}
            onClose={() => setQuickAdjustItem(null)}
            onSave={handleQuickAdjust}
          />
        )}

        {/* ── Historial de Movimientos ───────────────────────────── */}
        <HistorialMovimientosDialog
          open={showHistorial}
          onClose={() => setShowHistorial(false)}
        />

      </div>
    </div>
  );
}
