// === Inventory.jsx — ORGANIZADO POR CATEGORÍAS DE DISPOSITIVOS ===
// iPhone, iPad, MacBook → Pantallas, Baterías, Servicios

import React, { useState, useEffect, useMemo, useRef } from "react";
import { useNavigate } from "react-router-dom";
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
  Minus, ArrowUpDown, MoreHorizontal, Truck, Store, LayoutGrid } from
"lucide-react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter // 👈 DialogFooter añadido
} from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";

import SuppliersDialog from "../components/inventory/SuppliersDialog";
import { rankedSearch } from "@/lib/posLogic";
import { adjustStockAtomic } from "@/lib/stockAdjust";
import { usePlanLimits } from "@/hooks/usePlanLimits";
import NotificationService from "../components/notifications/NotificationService";
import DiscountBadge, { formatPriceWithDiscount } from "../components/inventory/DiscountBadge";
import SetDiscountDialog from "../components/inventory/SetDiscountDialog";
import ManageCategoriesDialog from "../components/inventory/ManageCategoriesDialog";
import InventoryReports from "../components/inventory/InventoryReports";
import RestockDialog from "../components/inventory/RestockDialog";
import ProductDetailDialog from "../components/inventory/ProductDetailDialog";
import { catalogCache } from "@/components/utils/dataCache";
import { AlertDialog } from "@/components/pos/native/posUi";
import { loadSuppliersSafe } from "@/components/utils/suppliers";
import { supabase } from "../../../../lib/supabase-client.js";
// IA removida del inventario — solo vive en Finanzas → Órdenes de Compra.

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

  const out = {
    ...payload,
    type: isService ? "service" : "product",
    category: mapPartTypeToProductCategory(payload?.part_type),
    tipo_principal: isService ? "servicios" : (payload?.tipo_principal || "dispositivos"),
    subcategoria: payload?.subcategoria === "servicio" ? "piezas_servicios" : (payload?.subcategoria || "piezas_servicios"),
    ...(isService ? { min_stock: 0 } : {}),
    supplier_id: payload?.supplier_id || "",
    supplier_name: payload?.supplier_name || "",
    active: payload?.active !== false,
  };
  if (isService) delete out.stock;
  return out;
}


// Formateo mejorado de dólares (solo 2 decimales, sin miles)
const money = (n) => {
  const num = Number(n || 0);
  return `$${num.toFixed(2)}`;
};

const ICON_MAP = {
  Smartphone, Tablet, Laptop, Monitor, Box, Battery, Wrench,
  Watch: Smartphone, Headphones: Box, Speaker: Box, Camera: Box,
  Gamepad: Box, Cpu: Box, HardDrive: Box, Wifi: Wrench, Cable: Wrench
};

function itemKind(item) {
  if (
    item.tipo_principal === "servicios" ||
    item.part_type === "servicio" ||
    item.part_type === "diagnostic" ||
    item.type === "service"
  ) return "servicios";
  if (item.tipo_principal === "accesorios") return "accesorios";
  if (item.subcategoria === "dispositivo_completo") return "dispositivos";
  return "piezas";
}

const KIND_STYLE = {
  dispositivos: { color: "#F2662E", Icon: Smartphone },
  piezas: { color: "#5AC8FA", Icon: Wrench },
  accesorios: { color: "#FF9F0A", Icon: Box },
  servicios: { color: "#BF5AF2", Icon: Sparkles },
};

function isLowStockItem(item) {
  if (itemKind(item) === "servicios") return false;
  const stock = Number(item.stock || 0);
  const min = Number(item.min_stock || 0);
  return stock <= 0 || (min > 0 && stock <= min);
}

function InventoryCard({ item, onEdit, onDelete, onOffer, onQuickAdjust, onStep, onDuplicate, onWhatsApp, selectMode, picked, onToggle }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const kind = itemKind(item);
  const { color, Icon } = KIND_STYLE[kind];
  const isService = kind === "servicios";
  const stockNum = Number(item.stock || 0);
  const low = isLowStockItem(item);
  const stockColor = low ? "#FF6961" : "#30D158";

  let priceInfo = { finalPrice: Number(item.price || 0), originalPrice: null };
  try { priceInfo = formatPriceWithDiscount(item); } catch { /* use defaults */ }
  const price = Number(priceInfo.finalPrice || 0);
  const cost = Number(item.cost || 0);
  const margin = price > 0 && cost > 0 ? Math.round(((price - cost) / price) * 100) : null;

  const stockLabel = isService
    ? "Servicio"
    : stockNum <= 0
      ? "Agotado"
      : low
        ? `Stock bajo · ${stockNum}`
        : `${stockNum} en stock`;

  return (
    <div
      onClick={() => (selectMode ? onToggle(item) : onEdit(item))}
      className="apple-type apple-press group relative cursor-pointer"
      style={{ background: "#1C1C1E", borderRadius: 16, padding: 14, display: "flex", flexDirection: "column", gap: 10, outline: picked ? "2px solid #F2662E" : "none" }}
    >
      {selectMode && (
        <span className="absolute flex items-center justify-center" style={{ top: 10, right: 10, zIndex: 2, width: 22, height: 22, borderRadius: 999, background: picked ? "#F2662E" : "rgba(0,0,0,0.5)", border: "1.5px solid #fff", color: "#fff" }}>
          {picked && <CheckSquare className="w-3 h-3" />}
        </span>
      )}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
        <span
          style={{ width: 36, height: 36, borderRadius: 10, background: `${color}26`, color, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}
        >
          <Icon className="w-[18px] h-[18px]" />
        </span>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            <button
              onClick={e => { e.stopPropagation(); onOffer(item); }}
              className="apple-press w-7 h-7 rounded-full flex items-center justify-center"
              style={{ background: "rgba(255,159,10,0.15)", color: "#FF9F0A" }}
              title="Configurar oferta"
              aria-label="Oferta"
            >
              <Tag className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={e => { e.stopPropagation(); onDelete(item); }}
              className="apple-press w-7 h-7 rounded-full flex items-center justify-center"
              style={{ background: "rgba(255,69,58,0.15)", color: "#FF6961" }}
              aria-label="Eliminar"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
          <div className="relative">
            <button
              onClick={e => { e.stopPropagation(); setMenuOpen((v) => !v); }}
              className="apple-press w-7 h-7 rounded-full flex items-center justify-center"
              style={{ background: "rgba(255,255,255,0.08)", color: "#fff" }}
              aria-label="Más acciones"
              aria-haspopup="menu"
              aria-expanded={menuOpen}
            >
              <MoreHorizontal className="w-3.5 h-3.5" />
            </button>
            {menuOpen && (
              <>
                <div className="fixed inset-0" style={{ zIndex: 60 }} onClick={e => { e.stopPropagation(); setMenuOpen(false); }} />
                <div role="menu" className="absolute right-0" style={{ top: 32, zIndex: 61, width: 200, borderRadius: 14, background: "#3A3A3C", overflow: "hidden", boxShadow: "0 12px 32px rgba(0,0,0,0.5)" }}>
                  {[["Duplicar", () => onDuplicate(item)], ["Compartir por WhatsApp", () => onWhatsApp(item)], ["Configurar oferta", () => onOffer(item)]].map(([label, fn]) => (
                    <button key={label} role="menuitem" onClick={e => { e.stopPropagation(); setMenuOpen(false); fn(); }} className="w-full text-left" style={{ padding: "11px 14px", fontSize: 15, color: "#fff" }}>{label}</button>
                  ))}
                </div>
              </>
            )}
          </div>
          {!isService && (
            <button
              onClick={e => { e.stopPropagation(); onQuickAdjust(item); }}
              className="apple-press tabular-nums"
              style={{ background: low ? "rgba(255,69,58,0.15)" : "rgba(48,209,88,0.15)", color: stockColor, borderRadius: 999, padding: "3px 11px", fontSize: 13, fontWeight: 700 }}
              title="Ajustar stock"
            >
              {stockNum}
            </button>
          )}
        </div>
      </div>

      <p style={{ fontSize: 15, fontWeight: 600, color: "#fff" }} className="truncate">{item.name || "—"}</p>

      <DiscountBadge product={item} />

      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 8 }}>
        <div style={{ display: "flex", alignItems: "baseline", gap: 6 }}>
          <span className="tabular-nums" style={{ color: "#30D158", fontSize: 17, fontWeight: 800 }}>{money(price)}</span>
          {priceInfo.originalPrice != null && priceInfo.originalPrice !== price && (
            <span className="tabular-nums line-through" style={{ color: "#8E8E93", fontSize: 12 }}>{money(priceInfo.originalPrice)}</span>
          )}
          {margin != null && (
            <span className="tabular-nums" style={{ color: margin >= 0 ? "#30D158" : "#FF6961", fontSize: 12, fontWeight: 600 }}>{margin}%</span>
          )}
        </div>
        <span style={{ fontSize: 12, color: isService ? "#8E8E93" : stockColor }}>{stockLabel}</span>
      </div>

      {Array.isArray(item.compatibility_models) && item.compatibility_models.length > 0 && (
        <p className="truncate" style={{ fontSize: 12, color: "#8E8E93" }}>
          Compatible: {item.compatibility_models.join(", ")}
        </p>
      )}

      {!isService && (
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 6 }}>
          <button
            onClick={e => { e.stopPropagation(); onStep(item, -1); }}
            disabled={stockNum <= 0}
            className="apple-press disabled:opacity-30"
            style={{ width: 40, height: 30, borderRadius: 999, background: "rgba(255,69,58,0.18)", color: "#FF6961", display: "flex", alignItems: "center", justifyContent: "center" }}
            aria-label="Quitar uno"
          >
            <Minus className="w-4 h-4" />
          </button>
          <button
            onClick={e => { e.stopPropagation(); onStep(item, 1); }}
            className="apple-press"
            style={{ width: 40, height: 30, borderRadius: 999, background: "rgba(48,209,88,0.18)", color: "#30D158", display: "flex", alignItems: "center", justifyContent: "center" }}
            aria-label="Agregar uno"
          >
            <Plus className="w-4 h-4" />
          </button>
        </div>
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
      <div className="relative w-full sm:w-96 bg-[#1C1C1E] border border-orange-500/30 rounded-[28px] rounded-b-none sm:rounded-[28px] p-5 shadow-[0_-8px_40px_rgba(0,0,0,0.5)] sm:shadow-[0_24px_60px_rgba(0,0,0,0.5)]">
        <div className="flex items-center justify-between mb-4">
          <div>
            <p className="text-white font-semibold text-sm truncate max-w-[220px]">{item.name}</p>
            <p className="text-white/40 text-xs mt-0.5">Stock actual: <span className="text-white font-bold">{currentStock}</span></p>
          </div>
          <button onClick={onClose} className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center text-white/50 hover:text-white" aria-label="Cerrar">✕</button>
        </div>

        {/* Mode selector */}
        <div className="grid grid-cols-3 gap-1.5 mb-4 bg-black/30 p-1 rounded-2xl">
          {[{k:"add",label:"+ Agregar",color:"text-emerald-400"},{k:"remove",label:"− Quitar",color:"text-red-400"},{k:"set",label:"= Fijar",color:"text-orange-400"}].map(({k,label,color}) => (
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
            className="flex-1 h-12 px-4 rounded-2xl bg-black/30 border border-white/10 text-white text-lg font-semibold text-center focus:border-orange-500/50 focus:outline-none focus:ring-2 focus:ring-orange-500/20 transition-all"
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
          className="w-full h-9 px-3 rounded-xl bg-black/20 border border-white/[0.07] text-white/70 text-xs mb-4 focus:border-orange-500/30 focus:outline-none"
        />

        <button
          onClick={handleSave}
          disabled={saving}
          className="w-full h-12 rounded-2xl bg-[#F2662E] text-white font-semibold text-sm shadow-lg hover:opacity-90 active:scale-[0.98] transition-all disabled:opacity-50"
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
    : t === "adjustment" ? "text-orange-400 bg-orange-500/10 border-white/10"
    : "text-emerald-400 bg-emerald-500/10 border-emerald-500/20";

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="bg-[#1C1C1E] border border-white/10 max-w-2xl max-h-[85vh] p-0 gap-0 flex flex-col">
        <DialogHeader className="px-5 pt-5 pb-3 border-b border-white/[0.07] flex-shrink-0">
          <DialogTitle className="text-white font-semibold flex items-center gap-2">
            <History className="w-5 h-5 text-orange-400" />
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
    sku: "",
    barcode: "",
    location: "",
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
        sku: value.sku || "",
        barcode: value.barcode || "",
        location: value.location || "",
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
        sku: "",
        barcode: "",
        location: "",
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
      sku: form.sku?.trim() || null,
      barcode: form.barcode?.trim() || null,
      location: form.location?.trim() || null,
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

    await onSave?.(payload, form.device_category, form.part_type);
  };

  const selectedPartType = partTypes.find((pt) => pt.slug === form.part_type);
  const isService = selectedPartType?.slug === "servicio" || form.tipo_principal === "servicios";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-[#1C1C1E] border border-white/10 w-[95vw] max-w-2xl max-h-[85vh] p-0 gap-0 theme-light:bg-white theme-light:border-gray-200 flex flex-col">
        <DialogHeader className="px-4 pt-4 pb-2 border-b border-white/10 theme-light:border-gray-200 flex-shrink-0">
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
                "bg-gradient-to-r from-orange-600 to-emerald-600 text-white border-transparent shadow-lg" :
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
                "bg-gradient-to-r from-orange-600 to-emerald-600 text-white border-transparent shadow-lg" :
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
                    "bg-gradient-to-r from-orange-600 to-emerald-600 text-white border-transparent shadow-lg" :
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
                    "bg-gradient-to-r from-orange-600 to-emerald-600 text-white border-transparent shadow-lg" :
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
              placeholder={form.subcategoria === "dispositivo_completo" ? "Ej: iPhone 14 Pro 256GB Azul" : "Ej: Pantalla iPhone 14 Pro"} className="bg-black/20 text-slate-50 px-3 py-1 text-base rounded-md flex h-9 w-full border shadow-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 md:text-sm border-white/10 theme-light:bg-white theme-light:border-gray-300" />


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
                  className="bg-black/20 border-white/10 theme-light:bg-white theme-light:border-gray-300" />
                </div>
                <div>
                  <label className="text-xs text-white/50 mb-1 block theme-light:text-gray-600">Almacenamiento</label>
                  <Input
                  value={form.device_storage}
                  onChange={(e) => setForm((f) => ({ ...f, device_storage: e.target.value }))}
                  placeholder="Ej: 256GB"
                  className="bg-black/20 border-white/10 theme-light:bg-white theme-light:border-gray-300" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-white/50 mb-1 block theme-light:text-gray-600">Color</label>
                  <Input
                  value={form.device_color}
                  onChange={(e) => setForm((f) => ({ ...f, device_color: e.target.value }))}
                  placeholder="Ej: Azul"
                  className="bg-black/20 border-white/10 theme-light:bg-white theme-light:border-gray-300" />
                </div>
                <div>
                  <label className="text-xs text-white/50 mb-1 block theme-light:text-gray-600">Operadora</label>
                  <Input
                  value={form.device_carrier}
                  onChange={(e) => setForm((f) => ({ ...f, device_carrier: e.target.value }))}
                  placeholder="Ej: Unlocked"
                  className="bg-black/20 border-white/10 theme-light:bg-white theme-light:border-gray-300" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-white/50 mb-1 block theme-light:text-gray-600">Condición *</label>
                  <select
                  value={form.device_condition}
                  onChange={(e) => setForm((f) => ({ ...f, device_condition: e.target.value }))}
                  className="w-full h-10 px-3 rounded-md bg-black/20 border border-white/10 text-white theme-light:bg-white theme-light:border-gray-300 theme-light:text-gray-900">
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
                  className="bg-black/20 border-white/10 theme-light:bg-white theme-light:border-gray-300" />
                </div>
              </div>

              <div className="flex items-center gap-4">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                  type="checkbox"
                  checked={form.device_warranty}
                  onChange={(e) => setForm((f) => ({ ...f, device_warranty: e.target.checked }))}
                  className="w-4 h-4 rounded border-white/10" />
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
                  className="bg-black/20 border-white/10 theme-light:bg-white theme-light:border-gray-300" />
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
                placeholder="0.00" className="bg-black/20 text-slate-50 px-3 py-1 text-base rounded-md flex h-9 w-full border shadow-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 md:text-sm border-white/10 theme-light:bg-white theme-light:border-gray-300" />


            </div>

            <div>
              <label className="text-xs text-white/50 mb-1 block theme-light:text-gray-600">Costo *</label>
              <Input
                type="number"
                step="0.01"
                value={form.cost}
                onChange={(e) => setForm((f) => ({ ...f, cost: e.target.value }))}
                placeholder="0.00" className="bg-black/20 text-slate-50 px-3 py-1 text-base rounded-md flex h-9 w-full border shadow-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 md:text-sm border-white/10 theme-light:bg-white theme-light:border-gray-300" />
            </div>
          </div>

          <div className="flex items-center gap-2 py-2">
            <input
              type="checkbox"
              id="taxable"
              checked={form.taxable}
              onChange={(e) => setForm((f) => ({ ...f, taxable: e.target.checked }))}
              className="w-5 h-5 rounded border-white/10 bg-black/20 text-orange-600 focus:ring-orange-500" />

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
                placeholder="0" className="bg-black/20 text-slate-50 px-3 py-1 text-base rounded-md flex h-9 w-full border shadow-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 md:text-sm border-white/10 theme-light:bg-white theme-light:border-gray-300" />


              </div>

              <div>
                <label className="text-xs text-white/50 mb-1 block theme-light:text-gray-600">Min</label>
                <Input
                type="number"
                value={form.min_stock}
                onChange={(e) => setForm((f) => ({ ...f, min_stock: e.target.value }))}
                placeholder="5" className="bg-black/20 text-slate-50 px-3 py-1 text-base rounded-md flex h-9 w-full border shadow-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 md:text-sm border-white/10 theme-light:bg-white theme-light:border-gray-300" />


              </div>
            </div>
          }

          <div>
            <label className="text-xs text-white/50 mb-1 block theme-light:text-gray-600">Proveedor</label>
            <select
              value={form.supplier_id}
              onChange={(e) => setForm((f) => ({ ...f, supplier_id: e.target.value }))}
              className="w-full h-10 px-3 rounded-md bg-black/20 border border-white/10 text-white theme-light:bg-white theme-light:border-gray-300 theme-light:text-gray-900">

              <option value="">Sin proveedor</option>
              {(suppliers || []).filter((s) => s.active !== false).map((sup) =>
              <option key={sup.id} value={sup.id}>{sup.name}</option>
              )}
            </select>
          </div>

          {Number(form.price) > 0 && Number(form.cost) > 0 && (
            <p className="text-xs" style={{ color: Number(form.price) <= Number(form.cost) ? "#FF7373" : "#4DC780", fontWeight: 700 }}>
              {`Ganancia ${money(Number(form.price) - Number(form.cost))} · margen ${Math.round(((Number(form.price) - Number(form.cost)) / Number(form.price)) * 100)}%`}
            </p>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="text-xs text-white/50 mb-1 block">SKU</label>
              <div className="flex gap-1">
                <Input value={form.sku} onChange={(e) => setForm((f) => ({ ...f, sku: e.target.value }))} placeholder="Opcional" className="bg-black/20 border-white/10 text-white" />
                <button type="button" onClick={() => setForm((f) => ({ ...f, sku: `${String(f.name || "PRD").replace(/[^a-zA-Z0-9]/g, "").slice(0, 3).toUpperCase() || "PRD"}-${Math.floor(1000 + Math.random() * 9000)}` }))} className="apple-press px-2 rounded-md bg-white/10 text-xs font-bold text-white/70" aria-label="Generar SKU">Auto</button>
              </div>
            </div>
            <div>
              <label className="text-xs text-white/50 mb-1 block">Código de barras</label>
              <Input value={form.barcode} onChange={(e) => setForm((f) => ({ ...f, barcode: e.target.value }))} placeholder="Opcional" className="bg-black/20 border-white/10 text-white" />
            </div>
            <div>
              <label className="text-xs text-white/50 mb-1 block">Ubicación</label>
              <Input value={form.location} onChange={(e) => setForm((f) => ({ ...f, location: e.target.value }))} placeholder="Estante, gaveta" className="bg-black/20 border-white/10 text-white" />
            </div>
          </div>

          <div>
            <label className="text-xs text-white/50 mb-1 block theme-light:text-gray-600">Descripción</label>
            <Textarea
              value={form.description}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              placeholder="Opcional" className="bg-black/20 text-slate-50 px-3 py-2 text-base rounded-md flex min-h-[60px] w-full border shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 md:text-sm border-white/10 h-16 theme-light:bg-white theme-light:border-gray-300" />


          </div>

          <div>
            <label className="text-xs text-white/50 mb-1 block theme-light:text-gray-600">Modelos compatibles</label>
            <Textarea
              value={form.compatibility_models_text}
              onChange={(e) => setForm((f) => ({ ...f, compatibility_models_text: e.target.value }))}
              placeholder="Uno por línea (opcional)" className="bg-black/20 text-slate-50 px-3 py-2 text-base rounded-md flex min-h-[60px] w-full border shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 md:text-sm border-white/10 h-16 theme-light:bg-white theme-light:border-gray-300" />


          </div>
        </div>

        <DialogFooter className="px-4 py-4 border-t border-white/10 flex-row gap-2 bg-[#1C1C1E] theme-light:bg-white theme-light:border-gray-200 flex-shrink-0">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            className="border-white/15 flex-1 theme-light:border-gray-300">

            Cancelar
          </Button>
          <Button
            onClick={handleSave}
            className="bg-gradient-to-r from-orange-600 to-emerald-700 flex-1">

            Guardar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>);

}



// === Componente principal ===
export default function Inventory() {
  const navigate = useNavigate();
  const { checkLimit, upgradeTo } = usePlanLimits();
  const [items, setItems] = useState([]);
  const [poList, setPoList] = useState([]);
  const [deleteTarget, setDeleteTarget] = useState(null);
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
  const [selectedProducts, setSelectedProducts] = useState([]);
  const [showDiscountDialog, setShowDiscountDialog] = useState(false);
  const [viewTab, setViewTab] = useState("products");
  const [page, setPage] = useState(1);
  const [mainCategory, setMainCategory] = useState("todos");
  const [sortKey, setSortKey] = useState("name");
  const [onlyLow, setOnlyLow] = useState(false);
  const [showReports, setShowReports] = useState(false);
  const [showRestock, setShowRestock] = useState(false);
  const [detailItem, setDetailItem] = useState(null);
  const [selectMode, setSelectMode] = useState(false);
  const [bulkIds, setBulkIds] = useState([]);
  const [bulkConfirm, setBulkConfirm] = useState(false);
  const toggleBulk = (it) => setBulkIds((prev) => (prev.includes(it.id) ? prev.filter((x) => x !== it.id) : [...prev, it.id]));
  const exitSelect = () => { setSelectMode(false); setBulkIds([]); };
  const bulkArchive = async () => {
    setBulkConfirm(false);
    const ids = bulkIds;
    let failed = 0;
    for (const id of ids) {
      try { await dataClient.entities.Product.update(id, { active: false }); } catch { failed += 1; }
    }
    setItems((prev) => prev.filter((x) => !ids.includes(x.id)));
    ["pos-active-products", "pos-active-services"].forEach((key) => { const c = catalogCache.get(key); if (Array.isArray(c)) catalogCache.set(key, c.filter((p) => !ids.includes(p.id))); });
    exitSelect();
    if (failed) { toast.error(`No se pudieron eliminar ${failed}`); loadInventory(); } else toast.success(ids.length === 1 ? "Producto eliminado" : `${ids.length} productos eliminados`);
  };
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

  const loadActiveProducts = async () => {
    const page = 1000;
    const out = [];
    for (let skip = 0; skip < 20000; skip += page) {
      const rows = await base44.entities.Product.filter({ active: true }, "id", page, skip);
      out.push(...(rows || []));
      if (!rows || rows.length < page) break;
    }
    return out;
  };

  // OPTIMIZACIÓN: Carga de datos con manejo robusto de errores y caché
  const loadInventory = async () => {
    try {
      const [pRes, poRes, supRes, woRes, catRes, ptRes, accRes] = await Promise.allSettled([
      loadActiveProducts().catch(() => []),
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
    let list = items.filter((item) => {
      if (onlyLow && !isLowStockItem(item)) return false;
      if (mainCategory === "todos") return true;
      if (itemKind(item) !== mainCategory) return false;
      if (mainCategory === "accesorios") {
        if (deviceCategory && item.subcategoria !== deviceCategory) return false;
        return true;
      }
      if (deviceCategory && item.device_category !== deviceCategory) return false;
      if (mainCategory === "piezas") {
        if (partTypeFilter !== "all" && item.part_type !== partTypeFilter) return false;
        if (viewTab === "offers") return item.discount_active === true && item.discount_percentage > 0;
      }
      return true;
    });

    if (q.trim()) {
      const t = q.toLowerCase();
      const ranked = new Set(rankedSearch(list, q).results.map((it) => it.id));
      list = list.filter((it) =>
        ranked.has(it.id) ||
        String(it.name || "").toLowerCase().includes(t) ||
        String(it.sku || "").toLowerCase().includes(t) ||
        String(it.barcode || "").toLowerCase().includes(t) ||
        String(it.supplier_name || "").toLowerCase().includes(t) ||
        String(it.device_brand || "").toLowerCase().includes(t) ||
        String(it.device_model || "").toLowerCase().includes(t) ||
        (Array.isArray(it.compatibility_models) &&
          it.compatibility_models.join(" ").toLowerCase().includes(t))
      );
    }

    const sorted = [...list];
    if (sortKey === "stock") {
      sorted.sort((a, b) => Number(a.stock || 0) - Number(b.stock || 0));
    } else if (sortKey === "price") {
      sorted.sort((a, b) => Number(b.price || 0) - Number(a.price || 0));
    } else {
      sorted.sort((a, b) => String(a.name || "").localeCompare(String(b.name || ""), "es", { sensitivity: "base" }));
    }
    return sorted;
  }, [items, mainCategory, deviceCategory, partTypeFilter, viewTab, q, sortKey, onlyLow]);

  const [drill, setDrill] = useState({ brand: null, family: null, model: null, all: false });
  useEffect(() => { setDrill({ brand: null, family: null, model: null, all: false }); setSelectMode(false); setBulkIds([]); }, [mainCategory, viewTab, q, deviceCategory, partTypeFilter]);
  useEffect(() => { setPage(1); }, [drill]);
  const drillOn = !q && viewTab === "products" && ["piezas", "accesorios", "servicios"].includes(mainCategory);
  const drillInfo = useMemo(() => {
    if (!drillOn) return { rows: null, items: filtered, level: null };
    const nm = (v) => String(v || "").trim();
    let list = filtered;
    let level = "device_brand";
    if (drill.brand) {
      list = list.filter((it) => nm(it.device_brand) === drill.brand);
      level = "device_family";
      if (drill.family) {
        list = list.filter((it) => nm(it.device_family) === drill.family);
        level = "device_model";
        if (drill.model) { list = list.filter((it) => nm(it.device_model) === drill.model); level = null; }
      }
    }
    const counts = new Map();
    if (level && !drill.all) list.forEach((it) => { const k = nm(it[level]); if (k) counts.set(k, (counts.get(k) || 0) + 1); });
    const rows = [...counts.entries()].sort((a, b) => a[0].localeCompare(b[0], undefined, { numeric: true })).map(([label, count]) => ({ label, count }));
    return { rows: rows.length ? rows : null, items: list, level };
  }, [filtered, drillOn, drill]);
  const scopedItems = drillInfo.items;
  const pageCount = Math.max(1, Math.ceil(scopedItems.length / pageSize));
  const pageItems = scopedItems.slice((page - 1) * pageSize, page * pageSize);

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
      const tenantForLog = localStorage.getItem("smartfix_tenant_id");
      if (tenantForLog && reference_type === "adjustment" && Number(quantity) && movement_type === "adjustment") {
        supabase.from("transaction").insert({
          tenant_id: tenantForLog,
          type: "stock_adjustment",
          category: Number(quantity) > 0 ? "stock_in" : "stock_out",
          amount: Math.abs(Number(quantity)),
          description: `[${product_name}] ${notes || "Ajuste manual"}`,
          recorded_by: performed_by,
        }).then(() => {}, () => {});
      }
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
  const handleQuickAdjust = async ({ item, newStock, previousStock: shownStock, mode, qty, note }) => {
    let clampedStock = Math.max(0, newStock);
    let previousStock = shownStock;
    try {
      if (mode === "set") {
        await dataClient.entities.Product.update(item.id, { stock: clampedStock });
      } else {
        const res = await adjustStockAtomic({ id: item.id, delta: mode === "add" ? qty : -qty });
        if (!res.ok) throw res.error || new Error("No se pudo actualizar el stock");
        clampedStock = res.after;
        previousStock = res.before;
      }
      setItems(prev => prev.map(p => p.id === item.id ? { ...p, stock: clampedStock } : p));

      const movQty = clampedStock - previousStock;
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
            title: `Stock bajo: ${item.name}`,
            body: `Solo quedan ${clampedStock} unidades (mínimo: ${item.min_stock || 0})`,
            relatedEntityType: "product",
            relatedEntityId: item.id,
            actionUrl: `/Inventory`,
            actionLabel: "Ver inventario",
            priority: clampedStock === 0 ? "urgent" : "high",
          });
        }
      }

      toast.success(`Stock actualizado: ${item.name} → ${clampedStock}`);
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
        const updatePayload = { ...normalizedPayload };
        const fresh = await dataClient.entities.Product.get(payload.id).catch(() => null);
        if (oldItem && Number(payload.stock || 0) === Number(oldItem.stock || 0)) delete updatePayload.stock;
        if (fresh?.barcode && !updatePayload.barcode) delete updatePayload.barcode;
        try {
          await dataClient.entities.Product.update(payload.id, updatePayload);
        } catch (primaryError) {
          console.warn("[Inventory] Product.update failed, trying direct supabase fallback:", primaryError);
          const { error } = await supabase
            .from("product")
            .update(updatePayload)
            .eq("id", payload.id);

          if (error) throw error;
        }

        const newStock = Number("stock" in updatePayload ? payload.stock : (fresh?.stock ?? payload.stock) || 0);
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
              title: `Stock bajo: ${payload.name}`,
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
      toast.success(payload.id ? "Actualizado" : "Pieza creada");
    } catch (err) {
      console.error("Error:", err);
      toast.error(err?.message || "No se pudo guardar");
    }
  };

  const handleDeleteItem = (item) => setDeleteTarget(item);

  const confirmDeleteItem = async () => {
    const item = deleteTarget;
    setDeleteTarget(null);
    if (!item) return;
    try {
      await dataClient.entities.Product.update(item.id, { active: false });
      setItems((prev) => prev.filter((x) => x.id !== item.id));
      recentCreatedRef.current = recentCreatedRef.current.filter((entry) => entry?.item?.id !== item.id);
      writeRecentCreatedProducts(recentCreatedRef.current);
      ["pos-active-products", "pos-active-services"].forEach((key) => {
        const cached = catalogCache.get(key);
        if (Array.isArray(cached)) catalogCache.set(key, cached.filter((p) => p.id !== item.id));
      });
      toast.success("Producto eliminado");
    } catch (err) {
      console.error("Error deleting:", err);
      toast.error("No se pudo eliminar");
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

  // Análisis IA del inventario removido — la IA solo vive en
  // Órdenes de Compra. Esta función queda como no-op.
  const fetchInventoryAnalysis = async () => {
    setAiInventoryLoading(false);
    setAiInventoryAnalysis("");
  };

  const handleDiscountSuccess = async () => {
    await loadInventory();
    setSelectedProducts([]);
    setShowDiscountDialog(false);
  };

  const handleStep = (item, delta) => {
    const prev = Number(item.stock || 0);
    const next = Math.max(0, prev + delta);
    if (next === prev) return;
    handleQuickAdjust({
      item,
      newStock: next,
      previousStock: prev,
      mode: delta > 0 ? "add" : "remove",
      qty: Math.abs(delta),
      note: "",
    }).catch(() => {});
  };

  const kindCounts = items.reduce((acc, i) => {
    const k = itemKind(i);
    acc[k] = (acc[k] || 0) + 1;
    return acc;
  }, {});
  const lowCount = items.filter(isLowStockItem).length;
  const inventoryValue = items.reduce(
    (sum, i) => sum + (itemKind(i) === "servicios" ? 0 : Number(i.stock || 0) * Number(i.cost || 0)),
    0
  );
  const SORT_LABELS = { name: "Nombre", stock: "Stock", price: "Precio" };
  const pillStyle = { background: "#1C1C1E", color: "#fff", borderRadius: 999, padding: "8px 14px", fontSize: 13, display: "flex", alignItems: "center", gap: 6, whiteSpace: "nowrap" };

  return (
    <div ref={containerRef} className="min-h-dvh apple-type overflow-y-auto apple-scroll pb-24" style={{ WebkitOverflowScrolling: 'touch', background: "#000", color: "#fff" }}>
      <div className="app-container py-4 sm:py-6" style={{ paddingTop: "calc(env(safe-area-inset-top, 0px) + 16px)" }}>
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <h1 style={{ fontSize: 34, fontWeight: 800, letterSpacing: "-0.02em", color: "#fff" }}>Inventario</h1>

          <div className="flex flex-wrap items-center gap-2">
            <button onClick={() => navigate("/Compras")} className="apple-press" style={pillStyle}>
              <Truck className="w-4 h-4" /> Órdenes de compra
            </button>
            <button onClick={() => navigate("/Compras?suppliers=1")} className="apple-press" style={pillStyle}>
              <Store className="w-4 h-4" /> Proveedores
            </button>

            <div className="relative" ref={moreMenuRef}>
              <button
                onClick={() => setShowMoreMenu(p => !p)}
                className="apple-press w-9 h-9 rounded-full flex items-center justify-center"
                style={{ background: showMoreMenu ? "rgba(242,102,46,0.18)" : "#1C1C1E", color: showMoreMenu ? "#F2662E" : "#fff" }}
                aria-label="Más opciones"
              >
                <MoreHorizontal className="w-[18px] h-[18px]" />
              </button>

              {showMoreMenu && (
                <div className="absolute right-0 top-11 z-[100] w-60 rounded-2xl overflow-hidden" style={{ background: "#1C1C1E", border: "0.5px solid rgba(255,255,255,0.1)", boxShadow: "0 16px 40px rgba(0,0,0,0.5)" }}>
                  {[
                    { label: 'Historial de movimientos', Icon: History, action: () => { setShowHistorial(true); setShowMoreMenu(false); } },
                    { label: 'Gestionar categorías', Icon: Settings, action: () => { setShowManageCategories(true); setShowMoreMenu(false); } },
                    { label: 'Reportes', Icon: TrendingUp, action: () => { setShowReports(true); setShowMoreMenu(false); } },
                    { label: 'Reabastecer', Icon: Box, action: () => { setShowRestock(true); setShowMoreMenu(false); } },
                  ].map((item, i) =>
                    item === null ? (
                      <div key={i} className="h-[0.5px] mx-3" style={{ backgroundColor: "rgba(255,255,255,0.1)" }} />
                    ) : (
                      <button
                        key={item.label}
                        onClick={item.action}
                        className="apple-press w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-white/5"
                        style={{ color: item.accent || "#fff", fontSize: 15 }}
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
                  toast.error(`Llegaste al límite de ${max} productos (${current}/${max}).`, { duration: 7000 });
                  return;
                }
                setEditing(null);
                setShowItemDialog(true);
              }}
              className="apple-press"
              style={{ ...pillStyle, background: "#F2662E", fontWeight: 700 }}
            >
              <Plus className="w-4 h-4" /> Nuevo
            </button>
          </div>
        </div>

        <div className="flex items-center gap-2 mb-4">
          <div className="relative flex-1">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: "#8E8E93" }} />
            <input
              value={q}
              onChange={e => { setQ(e.target.value); setPage(1); }}
              placeholder="Buscar producto, SKU, marca, modelo…"
              className="apple-type w-full h-11"
              style={{ borderRadius: 999, paddingLeft: 42, paddingRight: 16, background: "#1C1C1E", color: "#fff", border: "1px solid rgba(242,102,46,0.35)", outline: "none", fontSize: 14 }}
            />
          </div>
          <button
            onClick={() => setSortKey(k => (k === "name" ? "stock" : k === "stock" ? "price" : "name"))}
            className="apple-press h-11"
            style={{ ...pillStyle, color: "#F2662E", padding: "0 14px" }}
            title="Cambiar orden"
          >
            <ArrowUpDown className="w-4 h-4" /> {SORT_LABELS[sortKey]}
          </button>
        </div>

        <div className="grid grid-cols-5 gap-2 mb-3">
          {[
            { key: 'todos', label: 'Todos', Icon: LayoutGrid, count: items.length },
            { key: 'dispositivos', label: 'Dispositivos', Icon: Smartphone, count: kindCounts.dispositivos || 0 },
            { key: 'piezas', label: 'Piezas', Icon: Wrench, count: kindCounts.piezas || 0 },
            { key: 'accesorios', label: 'Accesorios', Icon: Box, count: kindCounts.accesorios || 0 },
            { key: 'servicios', label: 'Servicios', Icon: Sparkles, count: kindCounts.servicios || 0 },
          ].map(({ key, label, Icon, count }) => {
            const active = mainCategory === key;
            return (
              <button
                key={key}
                onClick={() => { setMainCategory(key); setDeviceCategory(null); setPartTypeFilter("all"); setViewTab("products"); setPage(1); }}
                className="apple-press flex flex-col items-center justify-center gap-1 py-2.5 px-1 min-w-0"
                style={{ background: active ? "#F2662E" : "#1C1C1E", color: "#fff", borderRadius: 14 }}
              >
                <Icon className="w-5 h-5" />
                <span className="truncate w-full text-center" style={{ fontSize: 12, fontWeight: 600 }}>{label}</span>
                <span className="tabular-nums" style={{ fontSize: 12, color: active ? "#fff" : "#8E8E93" }}>{count}</span>
              </button>
            );
          })}
        </div>

        <div className="flex flex-wrap items-center gap-2 mb-4" style={{ fontSize: 12 }}>
          {lowCount > 0 && (
            <button type="button" onClick={() => setOnlyLow((v) => !v)} aria-pressed={onlyLow} className="apple-press" style={{ background: onlyLow ? "#FF453A" : "rgba(255,69,58,0.15)", color: onlyLow ? "#fff" : "#FF6961", borderRadius: 999, padding: "5px 12px", display: "flex", alignItems: "center", gap: 5, fontWeight: onlyLow ? 700 : 400 }}>
              <AlertTriangle className="w-3.5 h-3.5" /> {lowCount} con stock bajo o agotado{onlyLow ? " · mostrando solo estos" : ""}
            </button>
          )}
          <span className="tabular-nums" style={{ background: "#1C1C1E", color: "#8E8E93", borderRadius: 999, padding: "5px 12px" }}>
            Valor del inventario ${inventoryValue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </span>
        </div>

        {/* ── Device sub-category pills ─────────────────────────── */}
        {(mainCategory === 'dispositivos' || mainCategory === 'piezas' || mainCategory === 'servicios') && deviceCategories.length > 0 && (
          <div className="flex items-center gap-2 overflow-x-auto pb-1 mb-4 scrollbar-none">
            <button
              onClick={() => { setDeviceCategory(null); setPage(1); }}
              className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold whitespace-nowrap flex-shrink-0 transition-all ${
                !deviceCategory ? 'bg-[#F2662E] text-white' : 'bg-[#1C1C1E] text-white/60 hover:text-white'
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
                    deviceCategory === catValue ? 'bg-[#F2662E] text-white' : 'bg-[#1C1C1E] text-white/60 hover:text-white'
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
                !deviceCategory ? 'bg-[#F2662E] text-white' : 'bg-[#1C1C1E] text-white/60 hover:text-white'
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
                    deviceCategory === acc.slug ? 'bg-[#F2662E] text-white' : 'bg-[#1C1C1E] text-white/60 hover:text-white'
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
                partTypeFilter === "all" ? 'bg-[#F2662E] text-white' : 'bg-[#1C1C1E] text-white/60 hover:text-white'
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
                    partTypeFilter === type.slug ? 'bg-[#F2662E] text-white' : 'bg-[#1C1C1E] text-white/60 hover:text-white'
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
            ].map(({ key, label, Icon }) => (
              <button
                key={key}
                onClick={() => { setViewTab(key); setPage(1); }}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all active:scale-95 ${
                  viewTab === key ? 'bg-[#F2662E] text-white' : 'text-white/50 hover:text-white'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                {label}
              </button>
            ))}
            <div className="h-5 w-px bg-white/10 mx-0.5" />
            {selectMode ? (
              <>
                <button onClick={() => bulkIds.length && setBulkConfirm(true)} disabled={!bulkIds.length} className="px-3 py-1.5 rounded-xl text-xs font-bold bg-red-500/20 text-red-400 disabled:opacity-40">{`Eliminar (${bulkIds.length})`}</button>
                <button onClick={exitSelect} className="px-3 py-1.5 rounded-xl text-xs font-bold text-white/60">Cancelar</button>
              </>
            ) : (
              <button onClick={() => setSelectMode(true)} className="px-3 py-1.5 rounded-xl text-xs font-bold text-white/60 hover:text-white">Seleccionar</button>
            )}
          </div>
        )}


        {/* ── Product grid ──────────────────────────────────────── */}
        <div className="min-h-[300px]">
          {drillOn && (drill.brand || drill.all) && (
            <div className="flex items-center gap-2 flex-wrap" style={{ marginBottom: 12 }}>
              <button onClick={() => setDrill((d) => (d.all ? { brand: d.brand, family: d.family, model: d.model, all: false } : d.model ? { brand: d.brand, family: d.family, model: null, all: false } : d.family ? { brand: d.brand, family: null, model: null, all: false } : { brand: null, family: null, model: null, all: false }))} className="apple-press" style={{ padding: "6px 14px", borderRadius: 999, background: "#2C2C2E", color: "#fff", fontSize: 13, fontWeight: 700 }}>‹ Atrás</button>
              <span style={{ fontSize: 14, fontWeight: 700 }}>{[drill.brand, drill.family, drill.model].filter(Boolean).join(" › ") || "Todos"}</span>
            </div>
          )}
          {drillOn && drillInfo.rows ? (
            <div style={{ borderRadius: 16, background: "#1C1C1E", overflow: "hidden" }}>
              {drillInfo.rows.map((r, i) => (
                <button key={r.label} onClick={() => setDrill((d) => (drillInfo.level === "device_brand" ? { ...d, brand: r.label } : drillInfo.level === "device_family" ? { ...d, family: r.label } : { ...d, model: r.label }))} className="apple-press w-full flex items-center gap-3 text-left" style={{ padding: "13px 16px", borderTop: i ? "0.5px solid rgba(84,84,88,0.6)" : "none" }}>
                  <span className="flex-1" style={{ fontSize: 16, fontWeight: 600 }}>{r.label}</span>
                  <span style={{ fontSize: 14, color: "#8E8E93" }}>{r.count}</span>
                  <ChevronRight className="w-4 h-4" style={{ color: "rgba(235,235,245,0.3)" }} />
                </button>
              ))}
              <button onClick={() => setDrill((d) => ({ ...d, all: true }))} className="apple-press w-full text-left" style={{ padding: "13px 16px", borderTop: "0.5px solid rgba(84,84,88,0.6)", color: "#F2662E", fontSize: 15, fontWeight: 600 }}>{`Ver todos (${scopedItems.length})`}</button>
            </div>
          ) : pageItems.length === 0 ? (
            <div className="text-center py-20">
              <Box className="w-14 h-14 text-white/40 mx-auto mb-4" />
              <p className="text-white/50 font-bold text-sm sm:text-base text-center px-4">
                {q ? `Sin resultados para "${q}"` : "No hay productos en esta categoría"}
              </p>
              <button
                onClick={() => { setEditing(null); setShowItemDialog(true); }}
                className="mt-4 inline-flex items-center gap-2 px-5 py-2.5 rounded-2xl bg-[#F2662E]/15 text-[#F2662E] text-sm font-bold hover:bg-[#F2662E]/25 transition-all"
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
                  onEdit={it => setDetailItem(it)}
                  onDelete={handleDeleteItem}
                  onOffer={it => handleSelectProduct(it, true)}
                  onQuickAdjust={it => setQuickAdjustItem(it)}
                  onStep={handleStep}
                  selectMode={selectMode}
                  picked={bulkIds.includes(item.id)}
                  onToggle={toggleBulk}
                  onDuplicate={it => { const { id, sku, barcode, ...rest } = it; setEditing({ ...rest, name: `${it.name} (copia)` }); setShowItemDialog(true); }}
                  onWhatsApp={it => { const price = Number(it.price || 0).toFixed(2); window.open(`https://wa.me/?text=${encodeURIComponent(`${it.name} - $${price}`)}`, "_blank", "noopener"); }}
                />
              ))}
            </div>
          )}
        </div>

        {/* ── Pagination ────────────────────────────────────────── */}
        {filtered.length > 0 && (
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mt-8 px-1">
            <p className="text-sm text-white/50 font-medium">
              Mostrando <span className="text-white font-bold">{pageItems.length}</span> de <span className="text-white font-bold">{scopedItems.length}</span> productos
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

        <ProductDetailDialog open={!!detailItem} item={detailItem} suppliers={suppliers} onChanged={() => loadInventory()} onClose={() => setDetailItem(null)} onEdit={(it) => { setDetailItem(null); setEditing(it); setShowItemDialog(true); }} />
        <RestockDialog open={showRestock} onClose={() => setShowRestock(false)} products={items} tenantId={localStorage.getItem("smartfix_tenant_id") || ""} employeeName={localStorage.getItem("smartfix_employee_name") || "Web"} />

        {showReports && (
          <InventoryReports open={showReports} onClose={() => setShowReports(false)} />
        )}

        {showSuppliers && (
          <SuppliersDialog open={showSuppliers} onClose={async () => { setShowSuppliers(false); const supRes = await loadSuppliersSafe(); setSuppliers(supRes || []); }} />
        )}

        {showDiscountDialog && (
          <SetDiscountDialog open={showDiscountDialog} onClose={() => setShowDiscountDialog(false)} products={selectedProducts} onSuccess={handleDiscountSuccess} />
        )}

        {showManageCategories && (
          <ManageCategoriesDialog open={showManageCategories} onClose={() => setShowManageCategories(false)} onUpdate={loadInventory} />
        )}

        {/* ── Ajuste Rápido de Stock ─────────────────────────────── */}
        {quickAdjustItem && (
          <QuickStockAdjust
            item={quickAdjustItem}
            onClose={() => setQuickAdjustItem(null)}
            onSave={handleQuickAdjust}
          />
        )}

        <AlertDialog
          open={bulkConfirm}
          title="Eliminar productos"
          message="Se ocultarán del inventario y del POS. Las órdenes y ventas pasadas mantienen los productos."
          onClose={() => setBulkConfirm(false)}
          actions={[{ label: "Eliminar", destructive: true, onPress: bulkArchive }, { label: "Cancelar", bold: true }]}
        />
        <AlertDialog
          open={!!deleteTarget}
          title="Eliminar producto"
          message="Se ocultará del inventario y del POS. Las órdenes y ventas pasadas mantienen el producto."
          onClose={() => setDeleteTarget(null)}
          actions={[{ label: "Eliminar", destructive: true, onPress: confirmDeleteItem }, { label: "Cancelar", bold: true }]}
        />

        {/* ── Historial de Movimientos ───────────────────────────── */}
        <HistorialMovimientosDialog
          open={showHistorial}
          onClose={() => setShowHistorial(false)}
        />

      </div>
    </div>
  );
}
