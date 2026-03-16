// === WorkOrderWizard.jsx — VERSIÓN PÁGINA ÚNICA (Mobile Optimized) ===
import React, { useState, useEffect, useRef, useMemo } from "react";
import { createPortal } from "react-dom";
import { DragDropContext, Droppable, Draggable } from "@hello-pangea/dnd";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { base44 } from "@/api/base44Client";
import { sendTemplatedEmail } from "@/api/functions";
import NotificationService from "../notifications/NotificationService";
import AddItemModal from "./AddItemModal";
import {
  User, Smartphone, Wrench, Shield, CheckSquare, Plus,
  X, Mail, Loader2, Camera, Check, Search, Eye, Grid3X3, Users, Save,
  Laptop, Tablet, Monitor, Watch, Gamepad2, Zap, Pencil, Trash2
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Dialog, DialogOverlay, DialogPortal } from "@/components/ui/dialog";
import { catalogCache, debounce } from "@/components/utils/dataCache";
import { motion, AnimatePresence } from "framer-motion";
import { generateOrderNumber } from "@/components/utils/sequenceHelpers";
import { upsertLocalOrder } from "@/components/utils/localOrderCache";

const pickUploadUrl = (uploadResult) => {
  const raw =
    uploadResult?.file_url ||
    uploadResult?.url ||
    uploadResult?.public_url ||
    uploadResult?.signed_url ||
    uploadResult?.download_url ||
    "";
  if (!raw || typeof raw !== "string") return null;
  return /^https?:\/\//i.test(raw) ? raw : null;
};

const extractEmailPhotoUrls = (orderLike = {}, fallback = []) => {
  const fromMetadata = (orderLike?.photos_metadata || [])
    .map((p) => p?.publicUrl || p?.thumbUrl || p?.url)
    .filter(Boolean);
  const fromAttachments = (orderLike?.attachments || [])
    .map((a) => (typeof a === "string" ? a : a?.url || a?.file_url || a?.publicUrl))
    .filter(Boolean);
  const fromFallback = (fallback || [])
    .map((u) => (typeof u === "string" ? u : u?.publicUrl || u?.thumbUrl || u?.url))
    .filter(Boolean);
  return Array.from(new Set([...fromMetadata, ...fromAttachments, ...fromFallback]));
};

async function sendAdminNewOrderEmail({ recipients, orderNumber, customerName, deviceInfo, orderId }) {
  const emails = Array.from(
    new Set(
      (recipients || [])
        .map((user) => String(user?.email || "").trim())
        .filter(Boolean)
    )
  );

  if (emails.length === 0) return;

  const safeCustomer = customerName || "Cliente";
  const safeDevice = deviceInfo || "Equipo";
  const safeOrder = orderNumber || "Nueva orden";
  const actionUrl = `/Orders?order=${orderId}`;

  const html = `
    <div style="font-family:Arial,sans-serif;max-width:640px;margin:0 auto;padding:24px;background:#0b1220;color:#e5eefc;">
      <div style="background:linear-gradient(135deg,#06b6d4,#10b981);padding:24px;border-radius:16px;">
        <h1 style="margin:0;font-size:28px;color:#ffffff;">Nueva orden ${safeOrder}</h1>
        <p style="margin:10px 0 0;color:#eaffff;font-size:16px;">Se registró una nueva orden en SmartFixOS.</p>
      </div>
      <div style="background:#111827;border:1px solid #1f2937;border-radius:16px;padding:24px;margin-top:20px;">
        <p style="margin:0 0 12px;font-size:15px;"><strong>Cliente:</strong> ${safeCustomer}</p>
        <p style="margin:0 0 12px;font-size:15px;"><strong>Equipo:</strong> ${safeDevice}</p>
        <p style="margin:0 0 20px;font-size:15px;"><strong>Orden:</strong> ${safeOrder}</p>
        <a href="${actionUrl}" style="display:inline-block;padding:12px 20px;border-radius:10px;background:#22c55e;color:#052e16;text-decoration:none;font-weight:700;">Ver orden</a>
      </div>
    </div>
  `;

  const response = await fetch("/api/send-raw-email", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      to: emails,
      subject: `Nueva orden ${safeOrder} - ${safeCustomer}`,
      body: html,
      from_name: "SmartFixOS",
    }),
  });

  const result = await response.json().catch(() => ({}));
  if (!response.ok || result?.success === false) {
    throw new Error(result?.error || "No se pudo enviar email de nueva orden");
  }
}

const LOCAL_CUSTOMERS_KEY = "smartfix_local_customers";
const LOCAL_DEVICE_CATALOG_KEY = "smartfix_local_device_catalog";
const LOCAL_TIME_ENTRIES_KEY = "local_time_entries";

function getCurrentTenantId() {
  const fromStorage =
    localStorage.getItem("smartfix_tenant_id") ||
    localStorage.getItem("current_tenant_id");
  if (fromStorage) return String(fromStorage);

  const sessionCandidates = [
    sessionStorage.getItem("911-session"),
    localStorage.getItem("employee_session"),
    localStorage.getItem("smartfix_session")
  ];

  for (const raw of sessionCandidates) {
    try {
      const parsed = raw ? JSON.parse(raw) : null;
      const tenantId =
        parsed?.tenant_id ||
        parsed?.tenantId ||
        parsed?.user?.tenant_id ||
        parsed?.session?.tenant_id;
      if (tenantId) return String(tenantId);
    } catch {}
  }

  return null;
}

function readLocalCustomers() {
  try {
    const raw = localStorage.getItem(LOCAL_CUSTOMERS_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function upsertLocalCustomer(customer) {
  try {
    const current = readLocalCustomers();
    const merged = [customer, ...current.filter((c) => c?.id !== customer?.id)];
    localStorage.setItem(LOCAL_CUSTOMERS_KEY, JSON.stringify(merged.slice(0, 1000)));
  } catch {
    // no-op
  }
}

function buildLocalCustomer(data, existingId = null) {
  const id = existingId || `local-customer-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  return {
    id,
    ...data,
    total_orders: Number(data?.total_orders || 0),
    created_date: new Date().toISOString(),
    updated_date: new Date().toISOString()
  };
}

function readLocalDeviceCatalog() {
  try {
    const raw = localStorage.getItem(LOCAL_DEVICE_CATALOG_KEY);
    const parsed = raw ? JSON.parse(raw) : { categories: [], brands: [], families: [], models: [] };
    return {
      categories: Array.isArray(parsed?.categories) ? parsed.categories : [],
      brands: Array.isArray(parsed?.brands) ? parsed.brands : [],
      families: Array.isArray(parsed?.families) ? parsed.families : [],
      models: Array.isArray(parsed?.models) ? parsed.models : []
    };
  } catch {
    return { categories: [], brands: [], families: [], models: [] };
  }
}

function readLocalTimeEntries() {
  try {
    const raw = localStorage.getItem(LOCAL_TIME_ENTRIES_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    const list = Array.isArray(parsed) ? parsed : [];
    const tenantId = getCurrentTenantId();
    return list.filter((entry) => {
      if (!entry) return false;
      if (!tenantId) return true;
      const entryTenant = entry?.tenant_id || entry?.tenantId || null;
      return !entryTenant || String(entryTenant) === String(tenantId);
    });
  } catch {
    return [];
  }
}

function writeLocalDeviceCatalog(catalog) {
  try {
    localStorage.setItem(LOCAL_DEVICE_CATALOG_KEY, JSON.stringify(catalog));
  } catch {
    // no-op
  }
}

function upsertLocalDeviceCatalogEntry({ categoryName, brandName, familyName, modelName }) {
  const current = readLocalDeviceCatalog();
  let category = current.categories.find((item) => normalizedText(item?.name) === normalizedText(categoryName));
  if (!category) {
    category = {
      id: `local-device-category-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      name: categoryName,
      icon: getCategoryVisual({ name: categoryName }).emoji,
      active: true,
      order: current.categories.length + 1
    };
    current.categories.unshift(category);
  }

  let brand = current.brands.find(
    (item) =>
      item?.category_id === category.id &&
      normalizedText(item?.name) === normalizedText(brandName)
  );
  if (!brand) {
    brand = {
      id: `local-device-brand-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      name: brandName,
      category_id: category.id,
      active: true,
      order: current.brands.filter((item) => item?.category_id === category.id).length + 1
    };
    current.brands.unshift(brand);
  }

  let family = current.families.find(
    (item) =>
      item?.brand_id === brand.id &&
      normalizedText(item?.name) === normalizedText(familyName)
  );
  if (!family) {
    family = {
      id: `local-device-family-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      name: familyName,
      brand_id: brand.id,
      active: true,
      order: current.families.filter((item) => item?.brand_id === brand.id).length + 1
    };
    current.families.unshift(family);
  }

  let model = current.models.find(
    (item) =>
      item?.brand_id === brand.id &&
      item?.family_id === family.id &&
      normalizedText(item?.name) === normalizedText(modelName)
  );
  if (!model) {
    model = {
      id: `local-device-model-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      name: modelName,
      brand_id: brand.id,
      family_id: family.id,
      family: family.name,
      active: true,
      order: current.models.filter((item) => item?.brand_id === brand.id && item?.family_id === family.id).length + 1
    };
    current.models.unshift(model);
  }

  writeLocalDeviceCatalog(current);
  return { category, brand, family, model };
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

function dedupeCatalogEntries(list = [], keyBuilder = (item) => item?.id) {
  const out = [];
  const keyToIndex = new Map();

  for (const item of list) {
    if (!item) continue;
    const key = keyBuilder(item);
    if (!key) continue;

    const existingIndex = keyToIndex.get(key);
    if (existingIndex === undefined) {
      keyToIndex.set(key, out.length);
      out.push(item);
      continue;
    }

    const current = out[existingIndex];
    const currentScore =
      (current?.active ? 2 : 0) +
      (current?.id ? 1 : 0) +
      (current?.order !== undefined ? 1 : 0);
    const nextScore =
      (item?.active ? 2 : 0) +
      (item?.id ? 1 : 0) +
      (item?.order !== undefined ? 1 : 0);

    if (nextScore > currentScore) {
      out[existingIndex] = item;
    }
  }

  return out;
}

function simplifyPersonName(value = "") {
  const parts = String(value)
    .trim()
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean);
  if (parts.length === 0) return "";
  if (parts.length === 1) return parts[0];
  return `${parts[0]} ${parts[parts.length - 1]}`;
}

function sameTechnician(a, b) {
  if (!a || !b) return false;

  const leftAuth = String(a.auth_id || "").trim().toLowerCase();
  const rightAuth = String(b.auth_id || "").trim().toLowerCase();
  if (leftAuth && rightAuth && leftAuth === rightAuth) return true;

  const leftEmail = String(a.email || "").trim().toLowerCase();
  const rightEmail = String(b.email || "").trim().toLowerCase();
  if (leftEmail && rightEmail && leftEmail === rightEmail) return true;

  const leftCode = String(a.employee_code || "").trim().toLowerCase();
  const rightCode = String(b.employee_code || "").trim().toLowerCase();
  if (leftCode && rightCode && leftCode === rightCode) return true;

  const leftName = simplifyPersonName(a.full_name || a.name || "");
  const rightName = simplifyPersonName(b.full_name || b.name || "");
  if (leftName && rightName && leftName === rightName) return true;

  const leftFull = String(a.full_name || a.name || "").trim().toLowerCase();
  const rightFull = String(b.full_name || b.name || "").trim().toLowerCase();
  if (leftFull && rightFull) {
    const leftTokens = leftFull.split(/\s+/).filter(Boolean);
    const rightTokens = rightFull.split(/\s+/).filter(Boolean);
    const smaller = leftTokens.length <= rightTokens.length ? leftTokens : rightTokens;
    const larger = leftTokens.length > rightTokens.length ? leftTokens : rightTokens;
    if (smaller.length && smaller.every((token) => larger.includes(token))) {
      const leftRole = String(a.position || a.role || "").trim().toLowerCase();
      const rightRole = String(b.position || b.role || "").trim().toLowerCase();
      if (leftRole === rightRole || (!leftRole && !rightRole) || leftRole === "admin" || rightRole === "admin") {
        return true;
      }
    }
  }

  return false;
}

function pickPreferredTechnician(current, incoming) {
  const currentScore =
    (current?.auth_id ? 4 : 0) +
    (current?.email ? 3 : 0) +
    (current?.employee_code ? 2 : 0) +
    (current?._fallback_from_punch ? 0 : 1);
  const incomingScore =
    (incoming?.auth_id ? 4 : 0) +
    (incoming?.email ? 3 : 0) +
    (incoming?.employee_code ? 2 : 0) +
    (incoming?._fallback_from_punch ? 0 : 1);

  return incomingScore > currentScore ? incoming : current;
}

function dedupeTechnicians(list = []) {
  const out = [];

  for (const tech of list) {
    if (!tech) continue;
    const existingIndex = out.findIndex((existing) => sameTechnician(existing, tech));
    if (existingIndex === -1) {
      out.push(tech);
      continue;
    }
    out[existingIndex] = pickPreferredTechnician(out[existingIndex], tech);
  }

  return out;
}

function isRestrictedSuperAdmin(user) {
  const role = String(user?.position || user?.role || "").trim().toLowerCase();
  const name = String(user?.full_name || user?.name || "").trim().toLowerCase();
  const email = String(user?.email || "").trim().toLowerCase();
  return (
    role === "superadmin" ||
    role === "super admin" ||
    name.includes("super admin") ||
    email.includes("superadmin")
  );
}

const normalizedText = (value = "") => String(value).trim().toLowerCase();
const normalizedNameKey = (value = "") =>
  String(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();

const getCategoryVisual = (category) => {
  const name = normalizedText(category?.name);
  if (category?.icon) {
    return { emoji: category.icon, Icon: null };
  }
  if (name.includes("laptop") || name.includes("macbook") || name.includes("notebook")) {
    return { emoji: "💻", Icon: Laptop };
  }
  if (name.includes("tablet") || name.includes("ipad")) {
    return { emoji: "📱", Icon: Tablet };
  }
  if (name.includes("desktop") || name.includes("torre") || name.includes("pc") || name.includes("computadora")) {
    return { emoji: "🖥️", Icon: Monitor };
  }
  if (name.includes("watch") || name.includes("reloj")) {
    return { emoji: "⌚", Icon: Watch };
  }
  if (name.includes("console") || name.includes("consola") || name.includes("playstation") || name.includes("xbox") || name.includes("switch")) {
    return { emoji: "🎮", Icon: Gamepad2 };
  }
  if (name.includes("phone") || name.includes("iphone") || name.includes("cel") || name.includes("movil") || name.includes("smart")) {
    return { emoji: "📱", Icon: Smartphone };
  }
  return { emoji: "🔧", Icon: Wrench };
};

const CHECKLIST_LIBRARY = {
  celulares: [
    { key: "screen_broken", label: "Pantalla rota / rajada", icon: "💔" },
    { key: "screen_no_image", label: "Pantalla sin imagen", icon: "📺" },
    { key: "touch_not_working", label: "Touch no responde", icon: "👆" },
    { key: "battery_no_charge", label: "No carga", icon: "🔋" },
    { key: "port_damaged", label: "Puerto dañado", icon: "🔌" },
    { key: "rear_camera_issue", label: "Cámara trasera con falla", icon: "📷" },
    { key: "signal_issue", label: "Sin señal", icon: "📵" },
    { key: "water_damage", label: "Daño por líquido", icon: "💧" }
  ],
  tabletas: [
    { key: "tablet_screen_broken", label: "Pantalla rota", icon: "💔" },
    { key: "tablet_touch_fail", label: "Touch con falla", icon: "👆" },
    { key: "tablet_no_charge", label: "No carga", icon: "🔋" },
    { key: "tablet_port_fail", label: "Puerto dañado", icon: "🔌" },
    { key: "tablet_wifi_fail", label: "WiFi no conecta", icon: "📶" },
    { key: "tablet_audio_fail", label: "Audio / micrófono con falla", icon: "🔇" }
  ],
  computadoras: [
    { key: "pc_no_power", label: "No enciende", icon: "⚫" },
    { key: "pc_slow", label: "Rendimiento lento", icon: "🐢" },
    { key: "pc_disk_fail", label: "Disco con errores", icon: "💽" },
    { key: "pc_ram_fail", label: "Memoria RAM con falla", icon: "🧠" },
    { key: "pc_overheat", label: "Sobrecalentamiento", icon: "🌡️" },
    { key: "pc_keyboard_fail", label: "Teclado / trackpad con falla", icon: "⌨️" },
    { key: "pc_display_fail", label: "Pantalla / video con falla", icon: "🖥️" }
  ],
  accesorios: [
    { key: "acc_not_detected", label: "No lo detecta el sistema", icon: "❌" },
    { key: "acc_damaged_connector", label: "Conector dañado", icon: "🔌" },
    { key: "acc_physical_damage", label: "Daño físico", icon: "🔨" },
    { key: "acc_intermittent", label: "Falla intermitente", icon: "⚠️" },
    { key: "acc_liquid_damage", label: "Daño por líquido", icon: "💧" }
  ]
};

function resolveChecklistTemplate(deviceType = "") {
  const type = normalizedText(deviceType);
  if (
    type.includes("laptop") ||
    type.includes("pc") ||
    type.includes("torre") ||
    type.includes("desktop") ||
    type.includes("computadora")
  ) return "computadoras";
  if (type.includes("tablet") || type.includes("ipad")) return "tabletas";
  if (
    type.includes("accesorio") ||
    type.includes("disco") ||
    type.includes("ssd") ||
    type.includes("hdd")
  ) return "accesorios";
  return "celulares";
}

const inferFamily = (typeName, brandName, modelName) => {
  const t = (typeName || "").toLowerCase();
  const b = (brandName || "").toLowerCase();
  const m = (modelName || "").toLowerCase();
  
  if (b === "apple") {
    if (t === "smartphone" || m.includes("iphone")) return "iPhone";
    if (t === "tablet" || m.includes("ipad")) return "iPad";
    if (t === "laptop" || m.includes("macbook")) return "MacBook";
  }
  if (b === "samsung") {
    if (t === "smartphone" || m.includes("galaxy")) {
      if (m.includes(" tab")) return "Galaxy Tab";
      return "Galaxy";
    }
    if (t === "tablet") return "Galaxy Tab";
  }
  return "";
};

const mapWizardItemToDraftCartItem = (item) => ({
  id: item.id,
  __kind: item.__kind || item.type || "product",
  __source_id: item.__source_id || item.id || null,
  type: item.type,
  name: item.name,
  description: item.description || "",
  price: Number(item.price || 0),
  qty: Number(item.quantity || item.qty || 1),
  taxable: item.taxable !== false,
  discount_percentage: Number(item.discount_percentage || item.discount_percent || 0),
  from_inventory: item.from_inventory ?? item.type === "product",
  stock: item.stock,
  min_stock: item.min_stock,
  sku: item.sku,
  code: item.code,
  cost: item.cost,
  originalPrice: item.originalPrice,
  discountApplied: item.discountApplied,
  is_manual: item.is_manual === true
});

const mapDraftCartItemToWizardItem = (item, index) => ({
  id: item.__source_id || item.id || `draft-item-${Date.now()}-${index}`,
  __kind: item.__kind || item.type || "product",
  __source_id: item.__source_id || item.id || null,
  type: item.type || (item.__kind === "service" || item.__kind === "manual" ? "service" : "product"),
  name: item.name,
  description: item.description || "",
  price: Number(item.price || 0),
  quantity: Number(item.qty || item.quantity || 1),
  taxable: item.taxable !== false,
  discount_percentage: Number(item.discount_percentage || item.discount_percent || 0),
  from_inventory: item.from_inventory ?? item.type === "product",
  stock: item.stock,
  min_stock: item.min_stock,
  sku: item.sku,
  code: item.code,
  cost: item.cost,
  originalPrice: item.originalPrice,
  discountApplied: item.discountApplied,
  is_manual: item.is_manual === true
});


function reorderLocalCatalogItems(level, newOrderedList) {
  try {
    const current = readLocalDeviceCatalog();
    if (level === "categories") {
      const remaining = current.categories.filter(c => !newOrderedList.find(n => n.id === c.id));
      current.categories = [...newOrderedList, ...remaining];
      current.categories.forEach((c, idx) => c.order = idx + 1);
    } else if (level === "brands") {
       const remaining = current.brands.filter(c => !newOrderedList.find(n => n.id === c.id));
      current.brands = [...newOrderedList, ...remaining];
      current.brands.forEach((c, idx) => c.order = idx + 1);
    } else if (level === "families") {
       const remaining = current.families.filter(c => !newOrderedList.find(n => n.id === c.id));
      current.families = [...newOrderedList, ...remaining];
      current.families.forEach((c, idx) => c.order = idx + 1);
    } else if (level === "models") {
       const remaining = current.models.filter(c => !newOrderedList.find(n => n.id === c.id));
      current.models = [...newOrderedList, ...remaining];
      current.models.forEach((c, idx) => c.order = idx + 1);
    }
    writeLocalDeviceCatalog(current);
  } catch (err) {
    console.error("Error reordering catalog:", err);
  }
}

export default function WorkOrderWizard({ open, onClose, onSuccess, preloadedCustomer }) {
  const [loading, setLoading] = useState(false);
  const [user, setUser] = useState(null);
  const [technicians, setTechnicians] = useState([]);
  const [availableTechnicianIds, setAvailableTechnicianIds] = useState(new Set());
  
  // Cliente
  const [customerName, setCustomerName] = useState("");
  const [customerLastName, setCustomerLastName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [customerEmail, setCustomerEmail] = useState("");
  const [customerAltPhone, setCustomerAltPhone] = useState("");
  const [customerAltEmail, setCustomerAltEmail] = useState("");
  const [showAdditionalContact, setShowAdditionalContact] = useState(false);
  const [customerId, setCustomerId] = useState(null);
  const [isB2B, setIsB2B] = useState(false);
  const [companyName, setCompanyName] = useState("");
  const [companyTaxId, setCompanyTaxId] = useState("");
  const [billingContact, setBillingContact] = useState("");
  
  // Técnico
  const [assignedTo, setAssignedTo] = useState(null);
  const [quickOrderMode, setQuickOrderMode] = useState(false);
  
  // Dispositivo
  const [deviceType, setDeviceType] = useState("");
  const [deviceBrand, setDeviceBrand] = useState(null);
  const [deviceModel, setDeviceModel] = useState("");
  const [deviceFamily, setDeviceFamily] = useState("");
  const [deviceSerial, setDeviceSerial] = useState("");
  const [deviceColor, setDeviceColor] = useState("");
  
  // Problema
  const [problem, setProblem] = useState("");
  const [photos, setPhotos] = useState([]);
  const [previewMedia, setPreviewMedia] = useState(null);
  
  // Seguridad
  const [devicePin, setDevicePin] = useState("");
  const [devicePassword, setDevicePassword] = useState("");
  const [securityPattern, setSecurityPattern] = useState(null);
  const [showPin, setShowPin] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [patternModalOpen, setPatternModalOpen] = useState(false);
  
  // Checklist
  const [checklist, setChecklist] = useState([]);
  const [checklistQuickText, setChecklistQuickText] = useState("");
  
  // Catálogos
  const [types, setTypes] = useState([]);
  const [brands, setBrands] = useState([]);
  const [families, setFamilies] = useState([]);
  const [models, setModels] = useState([]);
  const [showDeviceCatalogModal, setShowDeviceCatalogModal] = useState(false);
  const [deviceCatalogCategory, setDeviceCatalogCategory] = useState("");
  const [deviceCatalogBrand, setDeviceCatalogBrand] = useState("");
  const [deviceCatalogFamily, setDeviceCatalogFamily] = useState("");
  const [deviceCatalogModel, setDeviceCatalogModel] = useState("");
  const [deviceCatalogBrands, setDeviceCatalogBrands] = useState([]);
  const [deviceCatalogFamilies, setDeviceCatalogFamilies] = useState([]);
  const [deviceCatalogModels, setDeviceCatalogModels] = useState([]);
  const [showManualDeviceCatalogBrand, setShowManualDeviceCatalogBrand] = useState(false);
  const [showManualDeviceCatalogFamily, setShowManualDeviceCatalogFamily] = useState(false);
  const [showManualDeviceCatalogModel, setShowManualDeviceCatalogModel] = useState(false);
  const [loadingDeviceCatalogBrands, setLoadingDeviceCatalogBrands] = useState(false);
  const [loadingDeviceCatalogFamilies, setLoadingDeviceCatalogFamilies] = useState(false);
  const [loadingDeviceCatalogModels, setLoadingDeviceCatalogModels] = useState(false);
  
  // Búsqueda
  const [customerSearchQuery, setCustomerSearchQuery] = useState("");
  const [customerResults, setCustomerResults] = useState([]);

  const handleDragEndCatalog = (result) => {
    if (!result.destination) return;
    const { source, destination, droppableId } = result;
    if (source.index === destination.index) return;
    
    // We update local state, modify order, and persist to local storage.
    let reordered = [];
    if (droppableId === "catalog-categories") {
      const items = Array.from(types);
      const [moved] = items.splice(source.index, 1);
      items.splice(destination.index, 0, moved);
      setTypes(items);
      reorderLocalCatalogItems("categories", items);
    } else if (droppableId === "catalog-brands") {
      const items = Array.from(deviceCatalogBrands);
      const [moved] = items.splice(source.index, 1);
      items.splice(destination.index, 0, moved);
      setDeviceCatalogBrands(items);
      reorderLocalCatalogItems("brands", items);
    } else if (droppableId === "catalog-families") {
      const items = Array.from(deviceCatalogFamilies);
      const [moved] = items.splice(source.index, 1);
      items.splice(destination.index, 0, moved);
      setDeviceCatalogFamilies(items);
      reorderLocalCatalogItems("families", items);
    } else if (droppableId === "catalog-models") {
      const items = Array.from(deviceCatalogModels);
      const [moved] = items.splice(source.index, 1);
      items.splice(destination.index, 0, moved);
      setDeviceCatalogModels(items);
      reorderLocalCatalogItems("models", items);
    }
  };

  
  const fileInputRef = useRef(null);
  const cameraInputRef = useRef(null);
  const bodyScrollRef = useRef(null);
  const swipeStateRef = useRef({ startY: 0, lastY: 0, active: false });
  const [isCompactDevice, setIsCompactDevice] = useState(false);

  // Items (piezas y servicios)
  const [orderItems, setOrderItems] = useState([]);
  const [showAddItemModal, setShowAddItemModal] = useState(false);
  const [suggestedProducts, setSuggestedProducts] = useState([]);
  const checklistTemplateKey = useMemo(() => resolveChecklistTemplate(deviceType), [deviceType]);
  const checklistTemplateItems = useMemo(
    () => CHECKLIST_LIBRARY[checklistTemplateKey] || CHECKLIST_LIBRARY.celulares,
    [checklistTemplateKey]
  );
  const uniqueBrands = useMemo(
    () => dedupeCatalogEntries(brands, (item) => normalizedNameKey(item?.name)),
    [brands]
  );
  const uniqueFamilies = useMemo(
    () => dedupeCatalogEntries(families, (item) => normalizedNameKey(item?.name)),
    [families]
  );
  const uniqueModels = useMemo(
    () =>
      dedupeCatalogEntries(
        models,
        (item) => `${normalizedNameKey(item?.family || item?.family_id || "")}::${normalizedNameKey(item?.name)}`
      ),
    [models]
  );

  useEffect(() => {
    if (open) {
      loadUser();
      loadTechnicians();
      loadTypes();
      
      if (preloadedCustomer) {
        const parts = (preloadedCustomer.name || "").split(" ");
        const first = parts.slice(0, -1).join(" ") || parts[0] || "";
        const last = parts.length > 1 ? parts[parts.length - 1] : "";
        
        setCustomerId(preloadedCustomer.id);
        setCustomerName(first);
        setCustomerLastName(last);
        setCustomerPhone(preloadedCustomer.phone || "");
        setCustomerEmail(preloadedCustomer.email || "");
        setCustomerAltPhone("");
        setCustomerAltEmail("");
      }
    } else {
      resetForm();
    }
  }, [open, preloadedCustomer]);

  useEffect(() => {
    if (deviceType) loadBrands();
    else { setBrands([]); setFamilies([]); setModels([]); }
  }, [deviceType]);

  useEffect(() => {
    if (deviceBrand) loadFamilies();
    else {
      setFamilies([]);
      setModels([]);
      setDeviceFamily("");
    }
  }, [deviceBrand]);

  useEffect(() => {
    if (deviceBrand && deviceFamily) loadModels();
    else setModels([]);
  }, [deviceBrand, deviceFamily]);

  useEffect(() => {
    if (!showDeviceCatalogModal) {
      setDeviceCatalogBrands([]);
      setDeviceCatalogFamilies([]);
      setDeviceCatalogModels([]);
      setShowManualDeviceCatalogBrand(false);
      setShowManualDeviceCatalogFamily(false);
      setShowManualDeviceCatalogModel(false);
      setLoadingDeviceCatalogBrands(false);
      setLoadingDeviceCatalogFamilies(false);
      setLoadingDeviceCatalogModels(false);
      return;
    }
    loadDeviceCatalogBrandsForModal(deviceCatalogCategory);
  }, [showDeviceCatalogModal, deviceCatalogCategory]);

  useEffect(() => {
    if (!showDeviceCatalogModal) return;
    loadDeviceCatalogFamiliesForModal(deviceCatalogCategory, deviceCatalogBrand);
  }, [showDeviceCatalogModal, deviceCatalogCategory, deviceCatalogBrand]);

  useEffect(() => {
    if (!showDeviceCatalogModal) return;
    loadDeviceCatalogModelsForModal(deviceCatalogCategory, deviceCatalogBrand, deviceCatalogFamily);
  }, [showDeviceCatalogModal, deviceCatalogCategory, deviceCatalogBrand, deviceCatalogFamily]);

  useEffect(() => {
    if (deviceModel) {
      loadSuggestedProducts();
    }
  }, [deviceModel]);

  useEffect(() => {
    const updateDeviceMode = () => {
      if (typeof window === "undefined") return;
      const width = window.innerWidth;
      const height = window.innerHeight;
      const shortestSide = Math.min(width, height);
      const isiPhoneLikeViewport = shortestSide <= 500;
      setIsCompactDevice(isiPhoneLikeViewport);
    };

    updateDeviceMode();
    window.addEventListener("resize", updateDeviceMode);
    return () => window.removeEventListener("resize", updateDeviceMode);
  }, []);

  const handleSwipeStart = (e) => {
    if (!isCompactDevice) return;
    const y = e.touches?.[0]?.clientY ?? 0;
    const target = e.target;
    const isField =
      target?.tagName === "INPUT" ||
      target?.tagName === "TEXTAREA" ||
      target?.tagName === "SELECT" ||
      target?.isContentEditable;
    if (isField) {
      swipeStateRef.current = { startY: 0, lastY: 0, active: false };
      return;
    }

    const scroller = bodyScrollRef.current;
    const atTop = !scroller || scroller.scrollTop <= 10;
    const inTopZone = y <= 140;
    swipeStateRef.current = { startY: y, lastY: y, active: atTop && inTopZone };
  };

  const handleSwipeMove = (e) => {
    if (!swipeStateRef.current.active) return;
    swipeStateRef.current.lastY = e.touches?.[0]?.clientY ?? swipeStateRef.current.lastY;
  };

  const handleSwipeEnd = () => {
    if (!swipeStateRef.current.active) return;
    const deltaY = swipeStateRef.current.lastY - swipeStateRef.current.startY;
    swipeStateRef.current = { startY: 0, lastY: 0, active: false };
    if (deltaY > 90) onClose();
  };

  const loadUser = async () => {
    try {
      const me = await base44.auth.me();
      setUser(me);
    } catch {
      setUser(null);
    }
  };

  const loadTechnicians = async () => {
    try {
      const safeFilter = async (entityName, query = {}, order, limit) => {
        const entity = base44?.entities?.[entityName];
        if (!entity?.filter) return [];
        try {
          const response = await entity.filter(query, order, limit);
          return Array.isArray(response) ? response : [];
        } catch {
          return [];
        }
      };

      const [appEmployeesPayload, usersPayload, openPunchesPayload, allPunchesPayload] = await Promise.all([
        safeFilter("AppEmployee", {}, undefined, 1000),
        safeFilter("User", { active: true }, undefined, 1000),
        safeFilter("TimeEntry", { clock_out: null }, "-clock_in", 200),
        safeFilter("TimeEntry", {}, "-clock_in", 500),
      ]);

      const allEmployees = [...(Array.isArray(appEmployeesPayload) ? appEmployeesPayload : []), ...(Array.isArray(usersPayload) ? usersPayload : [])];
      const serverOpenPunches = [
        ...(Array.isArray(openPunchesPayload) ? openPunchesPayload : []),
        ...(Array.isArray(allPunchesPayload) ? allPunchesPayload : []).filter((p) => p && !p.clock_out),
      ];
      const localEntries = readLocalTimeEntries();
      const allPunches = [...serverOpenPunches, ...localEntries];

      const isTechRole = (emp) => {
        const role = String(emp?.position || emp?.role || "").toLowerCase().trim();
        return role === "technician" || role === "técnico" || role === "admin" || role === "manager" || role === "administrador";
      };

      const techs = allEmployees
        .filter((u) => u && u.status !== "inactive" && !isRestrictedSuperAdmin(u) && isTechRole(u))
        .map((u) => ({
          ...u,
          role: u.position || u.role || "technician",
          full_name: u.full_name || u.name || u.email || "Tecnico",
        }));
      const dedupedServerTechs = dedupeTechnicians(techs);

      const employeeLatestPunch = new Map();
      const getPunchKeys = (entry) => {
        const keys = [];
        const idKey = String(entry?.employee_id || "").trim().toLowerCase();
        const nameKey = String(entry?.employee_name || "").trim().toLowerCase();
        const emailKey = String(entry?.employee_email || "").trim().toLowerCase();
        if (idKey) keys.push(idKey);
        if (nameKey) keys.push(nameKey);
        if (emailKey) keys.push(emailKey);
        return keys;
      };

      for (const punch of allPunches) {
        if (!punch) continue;
        const ts = new Date(punch?.clock_in || punch?.created_date || 0).getTime() || 0;
        const keys = getPunchKeys(punch);
        for (const key of keys) {
          const prev = employeeLatestPunch.get(key);
          const prevTs = new Date(prev?.clock_in || prev?.created_date || 0).getTime() || 0;
          if (!prev || ts >= prevTs) {
            employeeLatestPunch.set(key, punch);
          }
        }
      }

      const openPunches = Array.from(employeeLatestPunch.values()).filter((p) => p && !p.clock_out);
      const openKeys = new Set();
      for (const p of openPunches) {
        for (const key of getPunchKeys(p)) openKeys.add(key);
      }

      // Fallback: si existen ponches abiertos sin match contra AppEmployee,
      // mostrarlos como técnicos temporales para no dejar la UI en 0.
      const fallbackTechs = [];
      for (const p of openPunches) {
        const pid = String(p?.employee_id || "").trim();
        const pname = String(p?.employee_name || "").trim();
        if (!pid && !pname) continue;

        const alreadyExists = dedupedServerTechs.some((tech) => {
          const keys = [
            String(tech?.id || "").trim().toLowerCase(),
            String(tech?.email || "").trim().toLowerCase(),
            String(tech?.employee_code || "").trim().toLowerCase(),
            String(tech?.full_name || "").trim().toLowerCase()
          ].filter(Boolean);
          const targetKeys = [pid.toLowerCase(), pname.toLowerCase()].filter(Boolean);
          return targetKeys.some((k) => keys.includes(k));
        });
        if (alreadyExists) continue;

        fallbackTechs.push({
          id: pid || `punch-${pname.toLowerCase().replace(/\s+/g, "-")}`,
          full_name: pname || pid,
          email: "",
          role: "technician",
          _fallback_from_punch: true
        });
      }

      const mergedTechs = dedupeTechnicians([...dedupedServerTechs, ...fallbackTechs]);
      const mergedAvailableIds = new Set(
        mergedTechs
          .filter((tech) => {
            const keys = [
              String(tech?.id || "").trim().toLowerCase(),
              String(tech?.email || "").trim().toLowerCase(),
              String(tech?.employee_code || "").trim().toLowerCase(),
              String(tech?.full_name || "").trim().toLowerCase()
            ].filter(Boolean);
            return keys.some((key) => openKeys.has(key));
          })
          .map((tech) => tech.id)
      );

      setTechnicians(mergedTechs);
      setAvailableTechnicianIds(mergedAvailableIds);
    } catch {
      setTechnicians([]);
      setAvailableTechnicianIds(new Set());
    }
  };

  useEffect(() => {
    if (!open) return;
    const handlePunchRefresh = () => {
      loadTechnicians();
    };
    window.addEventListener("force-refresh", handlePunchRefresh);
    window.addEventListener("storage", handlePunchRefresh);
    return () => {
      window.removeEventListener("force-refresh", handlePunchRefresh);
      window.removeEventListener("storage", handlePunchRefresh);
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const iv = setInterval(() => {
      loadTechnicians();
    }, 8000);
    return () => clearInterval(iv);
  }, [open]);

  const availableTechnicians = useMemo(
    () => technicians.filter((tech) => availableTechnicianIds.has(tech.id)),
    [technicians, availableTechnicianIds]
  );

  const unavailableTechnicians = useMemo(
    () => technicians.filter((tech) => !availableTechnicianIds.has(tech.id)),
    [technicians, availableTechnicianIds]
  );

  const loadTypes = async () => {
    const localCatalog = readLocalDeviceCatalog();
    try {
      const cached = catalogCache.get('device_categories');
      if (cached) {
        setTypes(
          dedupeCatalogEntries(
            [...(localCatalog.categories || []), ...(cached || [])],
            (item) => normalizedNameKey(item?.name)
          )
        );
        return;
      }

      const data = await base44.entities.DeviceCategory.filter({active: true}, "order");
      const merged = dedupeCatalogEntries(
        [...(localCatalog.categories || []), ...(data || [])],
        (item) => normalizedNameKey(item?.name)
      );
      catalogCache.set('device_categories', merged);
      setTypes(merged);
    } catch {
      setTypes(
        dedupeCatalogEntries(localCatalog.categories || [], (item) => normalizedNameKey(item?.name))
      );
    }
  };

  const loadBrands = async () => {
    const localCatalog = readLocalDeviceCatalog();
    try {
      const cacheKey = `brands_${deviceType}`;
      const cached = catalogCache.get(cacheKey);
      if (cached) {
        const localCategory = (localCatalog.categories || []).find(
          (item) => normalizedText(item?.name) === normalizedText(deviceType)
        );
        const localBrands = localCategory
          ? (localCatalog.brands || []).filter((item) => item?.category_id === localCategory.id)
          : [];
        setBrands(
          dedupeCatalogEntries(
            [...(localBrands || []), ...(cached || [])],
            (item) => normalizedNameKey(item?.name)
          )
        );
        return;
      }

      const categories = await base44.entities.DeviceCategory.filter({ name: deviceType, active: true });
      if (categories?.length) {
        const brandsByCategory = await base44.entities.Brand.filter({
          category_id: categories[0].id,
          active: true
        }, "order");
        const localCategory = (localCatalog.categories || []).find(
          (item) => normalizedText(item?.name) === normalizedText(deviceType)
        );
        const localBrands = localCategory
          ? (localCatalog.brands || []).filter((item) => item?.category_id === localCategory.id)
          : [];
        const merged = dedupeCatalogEntries(
          [...(localBrands || []), ...(brandsByCategory || [])],
          (item) => normalizedNameKey(item?.name)
        );
        catalogCache.set(cacheKey, merged);
        setBrands(merged);
      } else {
        const localCategory = (localCatalog.categories || []).find(
          (item) => normalizedText(item?.name) === normalizedText(deviceType)
        );
        const localBrands = localCategory
          ? (localCatalog.brands || []).filter((item) => item?.category_id === localCategory.id)
          : [];
        setBrands(
          dedupeCatalogEntries(localBrands, (item) => normalizedNameKey(item?.name))
        );
      }
    } catch {
      const localCategory = (localCatalog.categories || []).find(
        (item) => normalizedText(item?.name) === normalizedText(deviceType)
      );
      const localBrands = localCategory
        ? (localCatalog.brands || []).filter((item) => item?.category_id === localCategory.id)
        : [];
      setBrands(
        dedupeCatalogEntries(localBrands, (item) => normalizedNameKey(item?.name))
      );
    }
  };

  const loadFamilies = async () => {
    const localCatalog = readLocalDeviceCatalog();
    try {
      const cacheKey = `families_${deviceBrand?.id}`;
      const cached = catalogCache.get(cacheKey);
      if (cached) {
        const localFamilies = (localCatalog.families || []).filter((item) => item?.brand_id === deviceBrand?.id);
        setFamilies(
          dedupeCatalogEntries(
            [...(localFamilies || []), ...(cached || [])],
            (item) => normalizedNameKey(item?.name)
          )
        );
        return;
      }

      const remoteFamilies = await base44.entities.DeviceFamily.filter({
        brand_id: deviceBrand?.id,
        active: true
      }, "order");
      const localFamilies = (localCatalog.families || []).filter((item) => item?.brand_id === deviceBrand?.id);
      const merged = dedupeCatalogEntries(
        [...(localFamilies || []), ...(remoteFamilies || [])],
        (item) => normalizedNameKey(item?.name)
      );
      catalogCache.set(cacheKey, merged);
      setFamilies(merged);
    } catch {
      const localFamilies = (localCatalog.families || []).filter((item) => item?.brand_id === deviceBrand?.id);
      setFamilies(
        dedupeCatalogEntries(localFamilies, (item) => normalizedNameKey(item?.name))
      );
    }
  };

  const loadModels = async () => {
    const localCatalog = readLocalDeviceCatalog();
    try {
      const selectedFamilyName = String(deviceFamily || "").trim();
      const selectedFamilyRecord = families.find((item) => normalizedNameKey(item?.name) === normalizedNameKey(selectedFamilyName));
      const cacheKey = `models_${deviceBrand?.id}_${selectedFamilyRecord?.id || selectedFamilyName}`;
      const cached = catalogCache.get(cacheKey);
      if (cached) {
        const localModels = (localCatalog.models || []).filter((item) =>
          item?.brand_id === deviceBrand?.id &&
          (
            item?.family_id === selectedFamilyRecord?.id ||
            normalizedText(item?.family) === normalizedText(selectedFamilyName)
          )
        );
        setModels(
          dedupeCatalogEntries(
            [...(localModels || []), ...(cached || [])],
            (item) =>
              `${normalizedNameKey(item?.family || item?.device_family || item?.family_id || "")}::${normalizedNameKey(item?.name)}`
          )
        );
        return;
      }

      const remoteModelsByBrand = await base44.entities.DeviceModel.filter({
        brand_id: deviceBrand?.id,
        active: true
      }, "order");

      const familyMatchedRemoteModels = (remoteModelsByBrand || []).filter((item) => {
        const explicitFamilyId = item?.family_id;
        const explicitFamilyName = item?.family || item?.device_family;
        const inferred = inferFamily(deviceType, deviceBrand?.name || deviceBrand, item?.name);

        if (selectedFamilyRecord?.id && explicitFamilyId === selectedFamilyRecord.id) return true;
        if (explicitFamilyName && normalizedText(explicitFamilyName) === normalizedText(selectedFamilyName)) return true;
        if (!explicitFamilyId && !explicitFamilyName && inferred && normalizedText(inferred) === normalizedText(selectedFamilyName)) return true;
        return false;
      });

      const localModels = (localCatalog.models || []).filter((item) =>
        item?.brand_id === deviceBrand?.id &&
        (
          item?.family_id === selectedFamilyRecord?.id ||
          normalizedText(item?.family) === normalizedText(selectedFamilyName)
        )
      );
      const merged = dedupeCatalogEntries(
        [...(localModels || []), ...familyMatchedRemoteModels],
        (item) =>
          `${normalizedNameKey(item?.family || item?.device_family || item?.family_id || "")}::${normalizedNameKey(item?.name)}`
      );
      catalogCache.set(cacheKey, merged);
      setModels(merged);
    } catch {
      const selectedFamilyName = String(deviceFamily || "").trim();
      const selectedFamilyRecord = families.find((item) => normalizedNameKey(item?.name) === normalizedNameKey(selectedFamilyName));
      const localModels = (localCatalog.models || []).filter((item) =>
        item?.brand_id === deviceBrand?.id &&
        (
          item?.family_id === selectedFamilyRecord?.id ||
          normalizedText(item?.family) === normalizedText(selectedFamilyName)
        )
      );
      setModels(
        dedupeCatalogEntries(
          localModels,
          (item) =>
            `${normalizedNameKey(item?.family || item?.device_family || item?.family_id || "")}::${normalizedNameKey(item?.name)}`
        )
      );
    }
  };

  const loadSuggestedProducts = async () => {
    if (!deviceModel) {
      setSuggestedProducts([]);
      return;
    }

    try {
      const allProducts = await base44.entities.Product.filter({ active: true }, undefined, 200);
      const modelLower = normalizedText(deviceModel);
      const familyLower = normalizedText(deviceFamily);
      const brandLower = normalizedText(deviceBrand?.name);
      const typeLower = normalizedText(deviceType);

      const deviceCategoryMatch = (product) => {
        const haystack = [
          product?.device_category,
          product?.category,
          product?.part_type,
          product?.tipo_principal,
          product?.subcategoria,
          product?.name
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        if (!typeLower) return true;
        if (typeLower.includes("tablet")) return haystack.includes("tablet") || haystack.includes("ipad");
        if (
          typeLower.includes("laptop") ||
          typeLower.includes("pc") ||
          typeLower.includes("desktop") ||
          typeLower.includes("computadora")
        ) {
          return (
            haystack.includes("laptop") ||
            haystack.includes("pc") ||
            haystack.includes("desktop") ||
            haystack.includes("computadora")
          );
        }
        if (typeLower.includes("accesorio")) return haystack.includes("accesorio");
        return (
          haystack.includes("phone") ||
          haystack.includes("iphone") ||
          haystack.includes("galaxy") ||
          haystack.includes("celular") ||
          haystack.includes("smartphone")
        );
      };

      const filtered = allProducts.filter(p => {
        const nameLower = normalizedText(p.name || "");
        const compatModels = Array.isArray(p.compatibility_models) ? p.compatibility_models : [];
        const compatFamilies = Array.isArray(p.compatible_families) ? p.compatible_families : [];
        const compatBrands = Array.isArray(p.compatible_brands) ? p.compatible_brands : [];
        const hasCompatMatch = compatModels.some(m => normalizedText(m).includes(modelLower));
        const hasFamilyMatch = familyLower && compatFamilies.some(f => normalizedText(f).includes(familyLower));
        const hasBrandMatch = brandLower && compatBrands.some(b => normalizedText(b).includes(brandLower));
        const nameMatch =
          nameLower.includes(modelLower) ||
          (familyLower && nameLower.includes(familyLower)) ||
          (brandLower && nameLower.includes(brandLower));

        return deviceCategoryMatch(p) && (nameMatch || hasCompatMatch || hasFamilyMatch || hasBrandMatch);
      });
      
      setSuggestedProducts(filtered.slice(0, 8));
    } catch {
      setSuggestedProducts([]);
    }
  };

  const loadDeviceCatalogBrandsForModal = async (categoryName) => {
    const categoryQuery = categoryName.trim();
    if (!categoryQuery) {
      setDeviceCatalogBrands([]);
      setLoadingDeviceCatalogBrands(false);
      return;
    }

    setLoadingDeviceCatalogBrands(true);
    const localCatalog = readLocalDeviceCatalog();
    const localCategoryIds = (localCatalog.categories || [])
      .filter((item) => normalizedText(item?.name) === normalizedText(categoryQuery))
      .map((item) => item.id);

    const localBrands = (localCatalog.brands || []).filter((item) =>
      localCategoryIds.includes(item?.category_id)
    );

    try {
      const remoteCategories = await base44.entities.DeviceCategory.filter({
        name: categoryQuery,
        active: true
      }).catch(() => []);
      const categoryIds = Array.from(
        new Set([...(remoteCategories || []).map((item) => item?.id).filter(Boolean), ...localCategoryIds])
      );

      if (categoryIds.length === 0) {
        const nextBrands = dedupeCatalogEntries(
          localBrands,
          (item) => `${item?.category_id || ""}::${normalizedText(item?.name)}`
        );
        setDeviceCatalogBrands(nextBrands);
        setLoadingDeviceCatalogBrands(false);
        return;
      }

      const remoteBrandsByCategory = await Promise.all(
        categoryIds.map((categoryId) =>
          base44.entities.Brand.filter({ category_id: categoryId, active: true }, "order").catch(() => [])
        )
      );

      const nextBrands = dedupeCatalogEntries(
        [...(localBrands || []), ...remoteBrandsByCategory.flat()],
        (item) => `${item?.category_id || ""}::${normalizedText(item?.name)}`
      );
      setDeviceCatalogBrands(nextBrands);
    } catch {
      const nextBrands = dedupeCatalogEntries(
        localBrands,
        (item) => `${item?.category_id || ""}::${normalizedText(item?.name)}`
      );
      setDeviceCatalogBrands(nextBrands);
    } finally {
      setLoadingDeviceCatalogBrands(false);
    }
  };

  const loadDeviceCatalogFamiliesForModal = async (categoryName, brandName) => {
    const categoryQuery = categoryName.trim();
    const brandQuery = brandName.trim();
    if (!categoryQuery || !brandQuery) {
      setDeviceCatalogFamilies([]);
      setLoadingDeviceCatalogFamilies(false);
      return;
    }

    setLoadingDeviceCatalogFamilies(true);
    const localCatalog = readLocalDeviceCatalog();
    const localCategoryIds = (localCatalog.categories || [])
      .filter((item) => normalizedText(item?.name) === normalizedText(categoryQuery))
      .map((item) => item.id);

    const localBrandIds = (localCatalog.brands || [])
      .filter(
        (item) =>
          localCategoryIds.includes(item?.category_id) &&
          normalizedText(item?.name) === normalizedText(brandQuery)
      )
      .map((item) => item.id);

    const localFamilies = (localCatalog.families || []).filter((item) =>
      localBrandIds.includes(item?.brand_id)
    );

    try {
      const remoteCategories = await base44.entities.DeviceCategory.filter({
        name: categoryQuery,
        active: true
      }).catch(() => []);
      const remoteCategoryIds = (remoteCategories || []).map((item) => item?.id).filter(Boolean);

      const remoteBrandsByCategory = await Promise.all(
        remoteCategoryIds.map((categoryId) =>
          base44.entities.Brand.filter({ category_id: categoryId, active: true }, "order").catch(() => [])
        )
      );

      const remoteBrandIds = remoteBrandsByCategory
        .flat()
        .filter((item) => normalizedText(item?.name) === normalizedText(brandQuery))
        .map((item) => item.id);

      const brandIds = Array.from(new Set([...localBrandIds, ...remoteBrandIds]));
      if (brandIds.length === 0) {
        setDeviceCatalogFamilies(
          dedupeCatalogEntries(localFamilies, (item) => `${item?.brand_id || ""}::${normalizedText(item?.name)}`)
        );
        setLoadingDeviceCatalogFamilies(false);
        return;
      }

      const remoteFamiliesByBrand = await Promise.all(
        brandIds.map((brandId) =>
          base44.entities.DeviceFamily.filter({ brand_id: brandId, active: true }, "order").catch(() => [])
        )
      );

      setDeviceCatalogFamilies(
        dedupeCatalogEntries(
          [...(localFamilies || []), ...remoteFamiliesByBrand.flat()],
          (item) => `${item?.brand_id || ""}::${normalizedText(item?.name)}`
        )
      );
    } catch {
      setDeviceCatalogFamilies(
        dedupeCatalogEntries(localFamilies, (item) => `${item?.brand_id || ""}::${normalizedText(item?.name)}`)
      );
    } finally {
      setLoadingDeviceCatalogFamilies(false);
    }
  };

  const loadDeviceCatalogModelsForModal = async (categoryName, brandName, familyName) => {
    const categoryQuery = categoryName.trim();
    const brandQuery = brandName.trim();
    const familyQuery = familyName.trim();
    if (!categoryQuery || !brandQuery || !familyQuery) {
      setDeviceCatalogModels([]);
      setLoadingDeviceCatalogModels(false);
      return;
    }

    setLoadingDeviceCatalogModels(true);
    const localCatalog = readLocalDeviceCatalog();
    const localCategoryIds = (localCatalog.categories || [])
      .filter((item) => normalizedText(item?.name) === normalizedText(categoryQuery))
      .map((item) => item.id);

    const localBrandIds = (localCatalog.brands || [])
      .filter(
        (item) =>
          localCategoryIds.includes(item?.category_id) &&
          normalizedText(item?.name) === normalizedText(brandQuery)
      )
      .map((item) => item.id);

    const localFamilyIds = (localCatalog.families || [])
      .filter(
        (item) =>
          localBrandIds.includes(item?.brand_id) &&
          normalizedText(item?.name) === normalizedText(familyQuery)
      )
      .map((item) => item.id);

    const localModels = (localCatalog.models || []).filter((item) =>
      localBrandIds.includes(item?.brand_id) &&
      (localFamilyIds.includes(item?.family_id) || normalizedText(item?.family) === normalizedText(familyQuery))
    );

    try {
      const remoteCategories = await base44.entities.DeviceCategory.filter({
        name: categoryQuery,
        active: true
      }).catch(() => []);
      const remoteCategoryIds = (remoteCategories || []).map((item) => item?.id).filter(Boolean);

      const remoteBrandsByCategory = await Promise.all(
        remoteCategoryIds.map((categoryId) =>
          base44.entities.Brand.filter({ category_id: categoryId, active: true }, "order").catch(() => [])
        )
      );

      const remoteBrandIds = remoteBrandsByCategory
        .flat()
        .filter((item) => normalizedText(item?.name) === normalizedText(brandQuery))
        .map((item) => item.id);

      const brandIds = Array.from(new Set([...localBrandIds, ...remoteBrandIds]));
      if (brandIds.length === 0) {
        const nextModels = dedupeCatalogEntries(
          localModels,
          (item) =>
            `${item?.brand_id || ""}::${item?.family_id || normalizedText(item?.family)}::${normalizedText(item?.name)}`
        );
        setDeviceCatalogModels(nextModels);
        setLoadingDeviceCatalogModels(false);
        return;
      }

      const remoteFamiliesByBrand = await Promise.all(
        brandIds.map((brandId) =>
          base44.entities.DeviceFamily.filter({ brand_id: brandId, active: true }, "order").catch(() => [])
        )
      );

      const remoteFamilyIds = remoteFamiliesByBrand
        .flat()
        .filter((item) => normalizedText(item?.name) === normalizedText(familyQuery))
        .map((item) => item.id);

      const remoteModelsByBrand = await Promise.all(
        brandIds.map((brandId) =>
          base44.entities.DeviceModel.filter({ brand_id: brandId, active: true }, "order").catch(() => [])
        )
      );

      const matchedRemoteModels = remoteModelsByBrand.flat().filter((item) => {
        if (remoteFamilyIds.includes(item?.family_id)) return true;
        if (normalizedText(item?.family || item?.device_family) === normalizedText(familyQuery)) return true;
        return false;
      });

      const nextModels = dedupeCatalogEntries(
        [...(localModels || []), ...matchedRemoteModels],
        (item) =>
          `${item?.brand_id || ""}::${item?.family_id || normalizedText(item?.family)}::${normalizedText(item?.name)}`
      );
      setDeviceCatalogModels(nextModels);
    } catch {
      const nextModels = dedupeCatalogEntries(
        localModels,
        (item) =>
          `${item?.brand_id || ""}::${item?.family_id || normalizedText(item?.family)}::${normalizedText(item?.name)}`
      );
      setDeviceCatalogModels(nextModels);
    } finally {
      setLoadingDeviceCatalogModels(false);
    }
  };

  // Búsqueda de clientes optimizada con debounce
  const searchCustomersDebounced = useMemo(
    () => debounce(async (query) => {
      if (!query || query.trim().length < 3) {
        setCustomerResults([]);
        return;
      }
      
      try {
        const [remoteCustomers, localCustomers] = await Promise.all([
          base44.entities.Customer.list("-updated_date", 200).catch(() => []),
          Promise.resolve(readLocalCustomers())
        ]);
        const customers = dedupeById([...(remoteCustomers || []), ...(localCustomers || [])]);
        const q = query.toLowerCase();
        const filtered = customers.filter(c => {
          if (isB2B && !c.is_b2b) return false;
          if (!isB2B && c.is_b2b) return false;
          
          return (
            c.name?.toLowerCase().includes(q) ||
            c.phone?.includes(q) ||
            c.customer_number?.toLowerCase().includes(q) ||
            c.email?.toLowerCase().includes(q) ||
            (isB2B && c.company_name?.toLowerCase().includes(q))
          );
        });
        setCustomerResults(filtered.slice(0, 10));
      } catch {
        setCustomerResults([]);
      }
    }, 300),
    [isB2B]
  );

  const searchCustomers = (query) => searchCustomersDebounced(query);

  const selectCustomer = (customer) => {
    setCustomerId(customer.id);
    
    if (customer.is_b2b) {
      setIsB2B(true);
      setCompanyName(customer.company_name || "");
      setCompanyTaxId(customer.company_tax_id || "");
      setBillingContact(customer.billing_contact_person || "");
      setCustomerPhone(customer.phone || "");
      setCustomerEmail(customer.email || "");
      setCustomerAltPhone("");
      setCustomerAltEmail("");
      setCustomerName("");
      setCustomerLastName("");
    } else {
      const parts = (customer.name || "").split(" ");
      const first = parts.slice(0, -1).join(" ") || parts[0] || "";
      const last = parts.length > 1 ? parts[parts.length - 1] : "";
      
      setIsB2B(false);
      setCustomerName(first);
      setCustomerLastName(last);
      setCustomerPhone(customer.phone || "");
      setCustomerEmail(customer.email || "");
      setCustomerAltPhone("");
      setCustomerAltEmail("");
      setCompanyName("");
      setCompanyTaxId("");
      setBillingContact("");
    }
    
    setCustomerSearchQuery("");
    setCustomerResults([]);
  };

  const addPhotos = (files) => {
    const fileArray = Array.from(files || []);
    setPhotos([...photos, ...fileArray]);
  };

  const removePhoto = (index) => {
    setPhotos(photos.filter((_, i) => i !== index));
  };

  const toggleChecklistItem = (key, label) => {
    setChecklist((prev) => {
      const existingIndex = prev.findIndex((item) => item.id === key);
      if (existingIndex >= 0) {
        return prev.filter((_, idx) => idx !== existingIndex);
      }
      return [...prev, { id: key, label, status: "not_tested" }];
    });
  };

  const addQuickChecklistItem = () => {
    const text = checklistQuickText.trim();
    if (!text) return;
    const key = `custom-${text.toLowerCase().replace(/[^a-z0-9]+/gi, "-")}`;
    setChecklist((prev) => {
      const exists = prev.some((item) => String(item?.label || "").trim().toLowerCase() === text.toLowerCase());
      if (exists) return prev;
      return [...prev, { id: key, label: text, status: "not_tested", source: "manual_input" }];
    });
    setChecklistQuickText("");
  };

  const resetForm = () => {
    setCustomerName("");
    setCustomerLastName("");
    setCustomerPhone("");
    setCustomerEmail("");
    setCustomerAltPhone("");
    setCustomerAltEmail("");
    setShowAdditionalContact(false);
    setCustomerId(null);
    setIsB2B(false);
    setCompanyName("");
    setCompanyTaxId("");
    setBillingContact("");
    setAssignedTo(null);
    setDeviceType("");
    setDeviceBrand(null);
    setDeviceModel("");
    setDeviceFamily("");
    setDeviceSerial("");
    setDeviceColor("");
    setProblem("");
    setPhotos([]);
    setDevicePin("");
    setDevicePassword("");
    setSecurityPattern(null);
    setChecklist([]);
    setChecklistQuickText("");
    setCustomerSearchQuery("");
    setCustomerResults([]);
    setOrderItems([]);
    setQuickOrderMode(false);
  };

  const addItemToOrder = (item) => {
    const existingIdx = orderItems.findIndex(i => i.id === item.id && i.type === item.type);
    
    if (existingIdx >= 0) {
      const updated = [...orderItems];
      updated[existingIdx].quantity = (updated[existingIdx].quantity || 1) + 1;
      setOrderItems(updated);
    } else {
      setOrderItems([...orderItems, { ...item, quantity: 1 }]);
    }
    
    toast.success(`✅ ${item.name} añadido`);
  };

  const removeItemFromOrder = (idx) => {
    setOrderItems(orderItems.filter((_, i) => i !== idx));
  };

  const updateItemQuantity = (idx, qty) => {
    const updated = [...orderItems];
    updated[idx].quantity = Math.max(1, parseInt(qty) || 1);
    setOrderItems(updated);
  };

  const draftOrderItems = useMemo(
    () => orderItems.map(mapWizardItemToDraftCartItem),
    [orderItems]
  );

  const applyDraftOrderItems = (items) => {
    const normalized = Array.isArray(items) ? items.map(mapDraftCartItemToWizardItem) : [];
    setOrderItems(normalized);
  };

  const handleSaveDeviceCatalogEntry = async () => {
    const categoryName = deviceCatalogCategory.trim();
    const brandName = deviceCatalogBrand.trim();
    const familyName = deviceCatalogFamily.trim();
    const modelName = deviceCatalogModel.trim();

    if (!categoryName || !brandName || !familyName || !modelName) {
      toast.error("Completa categoría, marca, línea y modelo");
      return;
    }

    const localEntry = upsertLocalDeviceCatalogEntry({
      categoryName,
      brandName,
      familyName,
      modelName
    });
    catalogCache.delete?.("device_categories");
    catalogCache.delete?.(`brands_${categoryName}`);
    catalogCache.delete?.(`families_${localEntry.brand.id}`);
    catalogCache.delete?.(`models_${localEntry.brand.id}_${localEntry.family.id}`);
    await loadTypes();
    setDeviceType(localEntry.category.name);
    setDeviceBrand(localEntry.brand);
    setDeviceFamily(localEntry.family.name);
    setDeviceModel(localEntry.model.name);
    setShowDeviceCatalogModal(false);
    setDeviceCatalogCategory("");
    setDeviceCatalogBrand("");
    setDeviceCatalogFamily("");
    setDeviceCatalogModel("");
    toast.success("Dispositivo guardado");

    try {
      let categoryRecord = null;
      const existingCategories = await base44.entities.DeviceCategory.filter({ active: true }).catch(() => []);
      categoryRecord =
        (existingCategories || []).find((item) => normalizedText(item?.name) === normalizedText(categoryName)) ||
        (await base44.entities.DeviceCategory.filter({ name: categoryName }).catch(() => []))?.[0] ||
        null;

      if (!categoryRecord) {
        await base44.entities.DeviceCategory.create({
          name: categoryName,
          active: true,
          order: (existingCategories || []).length + 1
        });
        categoryRecord =
          (await base44.entities.DeviceCategory.filter({ name: categoryName }).catch(() => []))?.[0] ||
          null;
      }

      if (!categoryRecord?.id) {
        throw new Error("No se pudo confirmar la categoría guardada");
      }

      let brandRecord = null;
      const existingBrands = await base44.entities.Brand.filter({
        category_id: categoryRecord.id,
        active: true
      }).catch(() => []);
      brandRecord =
        (existingBrands || []).find((item) => normalizedText(item?.name) === normalizedText(brandName)) ||
        null;

      if (!brandRecord) {
        await base44.entities.Brand.create({
          name: brandName,
          category_id: categoryRecord.id,
          active: true,
          order: (existingBrands || []).length + 1
        });
        brandRecord =
          (await base44.entities.Brand.filter({ category_id: categoryRecord.id, active: true }).catch(() => []))
            ?.find((item) => normalizedText(item?.name) === normalizedText(brandName)) ||
          null;
      }

      if (!brandRecord?.id) {
        throw new Error("No se pudo confirmar la marca guardada");
      }

      let familyRecord = null;
      const existingFamilies = await base44.entities.DeviceFamily.filter({
        brand_id: brandRecord.id,
        active: true
      }).catch(() => []);

      familyRecord =
        (existingFamilies || []).find(
          (item) => normalizedText(item?.name) === normalizedText(familyName)
        ) || null;

      if (!familyRecord) {
        await base44.entities.DeviceFamily.create({
          name: familyName,
          brand_id: brandRecord.id,
          active: true,
          order: (existingFamilies || []).length + 1
        });
        familyRecord =
          (await base44.entities.DeviceFamily.filter({ brand_id: brandRecord.id, active: true }).catch(() => []))
            ?.find((item) => normalizedText(item?.name) === normalizedText(familyName)) ||
          null;
      }

      const existingModels = await base44.entities.DeviceModel.filter({
        brand_id: brandRecord.id,
        active: true
      }).catch(() => []);
      const matchingModel = (existingModels || []).find(
        (item) => normalizedText(item?.name) === normalizedText(modelName)
          && (
            item?.family_id === familyRecord?.id ||
            normalizedText(item?.family || item?.device_family) === normalizedText(familyName)
          )
      );

      if (!matchingModel) {
        await base44.entities.DeviceModel.create({
          name: modelName,
          brand_id: brandRecord.id,
          family_id: familyRecord?.id || null,
          family: familyName,
          active: true,
          order: (existingModels || []).filter((item) =>
            item?.family_id === familyRecord?.id ||
            normalizedText(item?.family || item?.device_family) === normalizedText(familyName)
          ).length + 1
        });
      }

      catalogCache.delete?.("device_categories");
      catalogCache.delete?.(`brands_${categoryRecord.name}`);
      catalogCache.delete?.(`families_${brandRecord.id}`);
      catalogCache.delete?.(`models_${brandRecord.id}_${familyRecord?.id || familyName}`);
    } catch (error) {
      console.error("Error saving device catalog entry:", error);
      console.warn("Device catalog remote sync failed, conservando guardado local.");
    }
  };

  const updateLocalCatalogEntryName = ({ level, entry, nextName }) => {
    const cleanName = String(nextName || "").trim();
    if (!cleanName) return false;
    const catalog = readLocalDeviceCatalog();
    let changed = false;
    const levelKeyById = {
      category: "categories",
      brand: "brands",
      family: "families",
      model: "models"
    };
    const levelKey = levelKeyById[level];
    if (!levelKey) return false;

    catalog[levelKey] = (catalog[levelKey] || []).map((item) => {
      if (String(item?.id || "") !== String(entry?.id || "")) return item;
      changed = true;
      return { ...item, name: cleanName };
    });

    if (changed) writeLocalDeviceCatalog(catalog);
    return changed;
  };

  const removeLocalCatalogEntry = ({ level, entry }) => {
    const catalog = readLocalDeviceCatalog();
    const targetId = String(entry?.id || "");
    if (!targetId) return false;
    let changed = false;

    if (level === "model") {
      const size = catalog.models.length;
      catalog.models = catalog.models.filter((item) => String(item?.id || "") !== targetId);
      changed = changed || size !== catalog.models.length;
    }

    if (level === "family") {
      const modelsSize = catalog.models.length;
      const familiesSize = catalog.families.length;
      catalog.models = catalog.models.filter((item) => String(item?.family_id || "") !== targetId);
      catalog.families = catalog.families.filter((item) => String(item?.id || "") !== targetId);
      changed = changed || modelsSize !== catalog.models.length || familiesSize !== catalog.families.length;
    }

    if (level === "brand") {
      const familyIds = new Set(
        catalog.families
          .filter((item) => String(item?.brand_id || "") === targetId)
          .map((item) => String(item?.id || ""))
      );
      const modelsSize = catalog.models.length;
      const familiesSize = catalog.families.length;
      const brandsSize = catalog.brands.length;
      catalog.models = catalog.models.filter(
        (item) =>
          String(item?.brand_id || "") !== targetId &&
          !familyIds.has(String(item?.family_id || ""))
      );
      catalog.families = catalog.families.filter((item) => String(item?.brand_id || "") !== targetId);
      catalog.brands = catalog.brands.filter((item) => String(item?.id || "") !== targetId);
      changed = changed ||
        modelsSize !== catalog.models.length ||
        familiesSize !== catalog.families.length ||
        brandsSize !== catalog.brands.length;
    }

    if (level === "category") {
      const brandIds = new Set(
        catalog.brands
          .filter((item) => String(item?.category_id || "") === targetId)
          .map((item) => String(item?.id || ""))
      );
      const familyIds = new Set(
        catalog.families
          .filter((item) => brandIds.has(String(item?.brand_id || "")))
          .map((item) => String(item?.id || ""))
      );
      const modelsSize = catalog.models.length;
      const familiesSize = catalog.families.length;
      const brandsSize = catalog.brands.length;
      const categoriesSize = catalog.categories.length;
      catalog.models = catalog.models.filter(
        (item) =>
          !brandIds.has(String(item?.brand_id || "")) &&
          !familyIds.has(String(item?.family_id || ""))
      );
      catalog.families = catalog.families.filter((item) => !brandIds.has(String(item?.brand_id || "")));
      catalog.brands = catalog.brands.filter((item) => String(item?.category_id || "") !== targetId);
      catalog.categories = catalog.categories.filter((item) => String(item?.id || "") !== targetId);
      changed = changed ||
        modelsSize !== catalog.models.length ||
        familiesSize !== catalog.families.length ||
        brandsSize !== catalog.brands.length ||
        categoriesSize !== catalog.categories.length;
    }

    if (changed) writeLocalDeviceCatalog(catalog);
    return changed;
  };

  const handleEditCatalogEntry = async ({ level, entry }) => {
    const currentName = String(entry?.name || "").trim();
    if (!currentName) return;
    const nextName = window.prompt(`Nuevo nombre para ${currentName}`, currentName);
    const cleanName = String(nextName || "").trim();
    if (!cleanName || cleanName === currentName) return;

    try {
      if (String(entry?.id || "").startsWith("local-")) {
        const changed = updateLocalCatalogEntryName({ level, entry, nextName: cleanName });
        if (!changed) throw new Error("No se pudo editar localmente");
      } else {
        if (level === "category") await base44.entities.DeviceCategory.update(entry.id, { name: cleanName });
        if (level === "brand") await base44.entities.Brand.update(entry.id, { name: cleanName });
        if (level === "family") await base44.entities.DeviceFamily.update(entry.id, { name: cleanName });
        if (level === "model") await base44.entities.DeviceModel.update(entry.id, { name: cleanName });
      }

      await loadTypes();
      await loadDeviceCatalogBrandsForModal(deviceCatalogCategory);
      await loadDeviceCatalogFamiliesForModal(deviceCatalogCategory, deviceCatalogBrand);
      await loadDeviceCatalogModelsForModal(deviceCatalogCategory, deviceCatalogBrand, deviceCatalogFamily);
      toast.success("Elemento actualizado");
    } catch (error) {
      console.error("Error editing device catalog entry:", error);
      toast.error("No se pudo actualizar");
    }
  };

  const handleDeleteCatalogEntry = async ({ level, entry }) => {
    const currentName = String(entry?.name || "").trim();
    if (!currentName) return;
    const confirmed = window.confirm(`¿Eliminar "${currentName}"?`);
    if (!confirmed) return;

    try {
      if (String(entry?.id || "").startsWith("local-")) {
        const removed = removeLocalCatalogEntry({ level, entry });
        if (!removed) throw new Error("No se pudo eliminar localmente");
      } else {
        if (level === "model") await base44.entities.DeviceModel.delete(entry.id);
        if (level === "family") await base44.entities.DeviceFamily.delete(entry.id);
        if (level === "brand") await base44.entities.Brand.delete(entry.id);
        if (level === "category") await base44.entities.DeviceCategory.delete(entry.id);
      }

      if (normalizedNameKey(deviceCatalogBrand) === normalizedNameKey(currentName) && level === "brand") {
        setDeviceCatalogBrand("");
        setDeviceCatalogFamily("");
        setDeviceCatalogModel("");
      }
      if (normalizedNameKey(deviceCatalogFamily) === normalizedNameKey(currentName) && level === "family") {
        setDeviceCatalogFamily("");
        setDeviceCatalogModel("");
      }
      if (normalizedNameKey(deviceCatalogModel) === normalizedNameKey(currentName) && level === "model") {
        setDeviceCatalogModel("");
      }

      await loadTypes();
      await loadDeviceCatalogBrandsForModal(deviceCatalogCategory);
      await loadDeviceCatalogFamiliesForModal(deviceCatalogCategory, deviceCatalogBrand);
      await loadDeviceCatalogModelsForModal(deviceCatalogCategory, deviceCatalogBrand, deviceCatalogFamily);
      toast.success("Elemento eliminado");
    } catch (error) {
      console.error("Error deleting device catalog entry:", error);
      toast.error("No se pudo eliminar (puede estar en uso)");
    }
  };

  const createOrder = async () => {
    let createdOrder = null;
    const fullName = isB2B 
      ? companyName 
      : `${customerName} ${customerLastName}`.trim();
    const normalizedItems = Array.isArray(orderItems) ? orderItems : [];
    const quickProblemSummary = normalizedItems.length > 0
      ? normalizedItems
          .map((item) => item?.name)
          .filter(Boolean)
          .slice(0, 3)
          .join(", ")
      : "Reparación rápida";
    
    // Validación
    if (isB2B) {
      if (!companyName || !billingContact || !customerPhone || !customerEmail) {
        toast.error("Completa todos los campos requeridos de empresa");
        return null;
      }
    } else {
      if (!customerName || !customerPhone) {
        toast.error("Completa nombre y teléfono del cliente");
        return null;
      }
    }
    
    if (!deviceBrand || !deviceModel) {
      toast.error("Selecciona marca y modelo del dispositivo");
      return null;
    }

    if (quickOrderMode && normalizedItems.length === 0) {
      toast.error("La orden rápida requiere al menos una pieza o servicio");
      return null;
    }

    try {
      // 1. Cliente
      let finalCustomerId = customerId;
      const customerData = {
        name: fullName,
        phone: customerPhone,
        email: customerEmail || "",
        is_b2b: isB2B,
        company_name: isB2B ? companyName : "",
        company_tax_id: isB2B ? companyTaxId : "",
        billing_contact_person: isB2B ? billingContact : ""
      };
      
      try {
        if (!finalCustomerId) {
          const existing = await base44.entities.Customer.filter({ phone: customerPhone });
          if (existing?.length) {
            finalCustomerId = existing[0].id;
            await base44.entities.Customer.update(finalCustomerId, {
              ...customerData,
              total_orders: (existing[0].total_orders || 0) + 1
            });
          } else {
            const newCustomer = await base44.entities.Customer.create({
              ...customerData,
              total_orders: 1
            });
            finalCustomerId = newCustomer?.id;
          }
        } else {
          let updated = false;
          try {
            if (String(finalCustomerId).startsWith("local-customer-")) {
              throw new Error("Local customer id");
            }
            const c = await base44.entities.Customer.get(finalCustomerId);
            await base44.entities.Customer.update(finalCustomerId, {
              ...customerData,
              total_orders: (c?.total_orders || 0) + 1
            });
            updated = true;
          } catch {
            const byPhone = await base44.entities.Customer.filter({ phone: customerPhone }).catch(() => []);
            if (byPhone?.length) {
              finalCustomerId = byPhone[0].id;
              await base44.entities.Customer.update(finalCustomerId, {
                ...customerData,
                total_orders: (byPhone[0]?.total_orders || 0) + 1
              });
              updated = true;
            }
          }
          if (!updated) {
            const created = await base44.entities.Customer.create({
              ...customerData,
              total_orders: 1
            });
            if (created?.id) finalCustomerId = created.id;
          }
        }
      } catch (customerError) {
        console.warn("Customer API unavailable, usando cliente local:", customerError);
      }

      if (!finalCustomerId) {
        const localCustomer = buildLocalCustomer({
          ...customerData,
          total_orders: 1
        });
        upsertLocalCustomer(localCustomer);
        finalCustomerId = localCustomer.id;
      }

      // 2. Catálogos
      const typeName = deviceType;
      const brandName = typeof deviceBrand === "string" ? deviceBrand : deviceBrand?.name || "";
      const modelName = deviceModel;

      let brandId = null;

      try {
        if (brandName) {
          const foundBrand = await base44.entities.Brand.filter({ name: brandName }).catch(() => []);
          if (foundBrand?.length) {
            brandId = foundBrand[0].id;
          }
        }

        if (modelName && brandId) {
          const foundFamily = await base44.entities.DeviceFamily.filter({
            name: modelName,
            brand_id: brandId
          }).catch(() => []);
          if (!foundFamily?.length) {
            await base44.entities.DeviceFamily.create({
              name: modelName,
              brand_id: brandId,
              active: true,
              order: 1
            }).catch(() => null);
          }
        }
      } catch (catalogError) {
        console.warn("Device catalog sync skipped during order creation:", catalogError);
      }

      // 3. Fotos
      const photosMetadata = [];
      const photoUrls = [];
      for (const item of photos) {
        try {
          const sourceFile =
            item instanceof File || item instanceof Blob
              ? item
              : (item?.file instanceof File || item?.file instanceof Blob)
              ? item.file
              : null;
          if (!sourceFile) continue;

          const uploadResult = await base44.integrations.Core.UploadFile({ file: sourceFile });
          const baseUrl = pickUploadUrl(uploadResult);
          if (!baseUrl) {
            throw new Error("Upload sin URL pública válida");
          }
          const url = `${baseUrl}${baseUrl.includes("?") ? "&" : "?"}v=${Date.now()}`;
          photosMetadata.push({
            id: `${Date.now()}-${(sourceFile && sourceFile.name) || "photo"}`,
            type: sourceFile.type?.startsWith("video") ? "video" : "image",
            mime: sourceFile.type || "image/jpeg",
            filename: sourceFile.name || "photo.jpg",
            publicUrl: url,
            thumbUrl: url
          });
          photoUrls.push(url);
        } catch (err) {
          console.warn("Error uploading photo:", err);
        }
      }

      // 4. Seguridad
      let securityData = {
        device_password: devicePassword ? btoa(devicePassword) : null,
        device_pin: devicePin ? btoa(devicePin) : null
      };

      if (securityPattern?.path?.length) {
        const patternVector = securityPattern.path.join('-');
        securityData.pattern_vector = `pattern:${patternVector}`;
        securityData.pattern_start = securityPattern.path[0];
        securityData.pattern_end = securityPattern.path[securityPattern.path.length - 1];
        securityData.pattern_length = securityPattern.path.length;
      }

      // 5. Generar número de orden secuencial
      const orderNumber = await generateOrderNumber('daily');
      
      // Preparar order_items con formato correcto
      const formattedItems = orderItems.map(item => ({
        id: item.id,
        name: item.name,
        price: item.price || 0,
        qty: item.quantity || 1,
        type: item.type,
        __kind: item.type,
        __source_id: item.id,
        from_inventory: item.type === "product",
        stock: item.stock,
        min_stock: item.min_stock,
        sku: item.sku
      }));

      const initialStatus = quickOrderMode ? "in_progress" : "intake";
      const statusHistory = [
        {
          status: initialStatus,
          timestamp: new Date().toISOString(),
          changed_by: user?.full_name || user?.email || "System",
          note: quickOrderMode ? "Orden creada como reparación rápida" : "Orden creada"
        }
      ];
      const repairTasks = quickOrderMode
        ? formattedItems.map((item) => ({
            id: item.id,
            description: item.name,
            status: "in_progress",
            cost: Number(item.price || 0)
          }))
        : [];

      const orderData = {
        order_number: orderNumber,
        customer_id: finalCustomerId,
        customer_name: fullName,
        customer_phone: customerPhone,
        customer_email: customerEmail || "",
        company_id: isB2B ? finalCustomerId : null,
        company_name: isB2B ? companyName : null,
        device_type: deviceType || "Phone",
        device_brand: brandName,
        device_family: deviceFamily,
        device_model: deviceModel,
        device_serial: deviceSerial,
        device_color: deviceColor,
        initial_problem: (problem || "").trim() || (quickOrderMode ? quickProblemSummary : ""),
        photos_metadata: photosMetadata,
        device_security: securityData,
        checklist_items: checklist,
        status: initialStatus,
        created_by: user?.full_name || user?.email || "System",
        assigned_to: assignedTo?.id || null,
        assigned_to_name: assignedTo?.full_name || "",
        terms_accepted: true,
        order_items: formattedItems,
        comments: quickOrderMode
          ? [
              {
                id: `quick-order-${Date.now()}`,
                text: "Orden creada en modo rápida. Se omitió la etapa de diagnóstico.",
                created_at: new Date().toISOString(),
                created_by: user?.full_name || user?.email || "System",
                internal: true
              }
            ]
          : [],
        repair_tasks: repairTasks,
        status_history: statusHistory,
        status_metadata: {
          quick_order: quickOrderMode,
          flow_type: quickOrderMode ? "quick_repair" : "standard",
          created_from: quickOrderMode ? "work_order_wizard_quick" : "work_order_wizard",
          additional_contact: {
            phone: customerAltPhone || "",
            email: customerAltEmail || "",
          },
        }
      };

      const newOrder = await base44.entities.Order.create(orderData);
      createdOrder = newOrder;
      upsertLocalOrder(newOrder);

      if (quickOrderMode) {
        try {
          await base44.entities.WorkOrderEvent.create({
            order_id: newOrder.id,
            order_number: newOrder.order_number,
            event_type: "status_changed",
            description: "Orden creada como reparación rápida y enviada directo a En Reparación",
            metadata: {
              quick_order: true,
              to_status: "in_progress"
            },
            user_name: user?.full_name || user?.email || "System",
            user_id: user?.id || null
          });
        } catch (eventError) {
          console.warn("Quick order event skipped:", eventError);
        }
      }

      // 6. Email
      if (customerEmail) {
        try {
          let persistedOrder = null;
          try {
            persistedOrder = await base44.entities.Order.get(newOrder.id);
          } catch {
            persistedOrder = null;
          }
          const finalPhotoUrls = extractEmailPhotoUrls(
            persistedOrder || newOrder || {},
            [...(photosMetadata || []), ...(photoUrls || [])]
          );
          await sendTemplatedEmail({
            event_type: "intake",
            order_data: {
              order_number: newOrder.order_number,
              customer_name: customerName || companyName || "Cliente",
              customer_email: customerEmail,
              device_info: `${brandName} ${deviceModel}`.trim(),
              checklist_items: checklist.map((c) => ({ label: c.label, status: "ok" })),
              photos_metadata: (persistedOrder || newOrder || {}).photos_metadata?.length
                ? (persistedOrder || newOrder || {}).photos_metadata
                : finalPhotoUrls.map((url) => ({ publicUrl: url, thumbUrl: url, visible_to_customer: true })),
              initial_problem: problem || ""
            }
          });
        } catch (err) {
          console.error("Error sending email:", err);
        }
      }

      // 7. Notificaciones
      try {
        const admins = await base44.entities.User.filter({});
        const eligible = admins.filter(u => u.role === "admin" || u.role === "manager");
        
        for (const admin of eligible) {
          await NotificationService.createNotification({
            userId: admin.id,
            userEmail: admin.email,
            type: "new_order",
            title: `Nueva orden #${newOrder.order_number}`,
            body: `${fullName} - ${brandName} ${deviceModel}`,
            relatedEntityType: "order",
            relatedEntityId: newOrder.id,
            relatedEntityNumber: newOrder.order_number,
            actionUrl: `/Orders?order=${newOrder.id}`,
            actionLabel: "Ver orden",
            priority: "normal"
          });
        }

        await sendAdminNewOrderEmail({
          recipients: eligible,
          orderNumber: newOrder.order_number,
          customerName: fullName,
          deviceInfo: `${brandName} ${deviceModel}`.trim(),
          orderId: newOrder.id,
        });
      } catch (err) {
        console.error("Error notifications:", err);
      }

      // 8. Eventos
      try {
        window.dispatchEvent(new CustomEvent('workorder-created', { detail: { order: newOrder } }));
        window.dispatchEvent(new Event('force-refresh'));
      } catch (eventErr) {
        console.warn("Error dispatching workorder events:", eventErr);
      }

      return newOrder;
    } catch (err) {
      if (createdOrder && /invalid api key/i.test(String(err?.message || ""))) {
        console.warn("Ignoring non-blocking error after order creation:", err);
        return createdOrder;
      }
      throw err;
    }
  };

  const handleSubmit = async () => {
    setLoading(true);
    try {
      const newOrder = await createOrder();
      if (!newOrder) {
        setLoading(false);
        return;
      }

      toast.success(quickOrderMode ? "✅ Orden rápida creada y enviada a reparación" : "✅ Orden creada exitosamente");
      onSuccess?.(newOrder);
      onClose();
    } catch (err) {
      console.error("Error creating order:", err);
      toast.error("Error: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleAddAnother = async () => {
    setLoading(true);
    try {
      const newOrder = await createOrder();
      if (!newOrder) {
        setLoading(false);
        return;
      }

      toast.success("✅ Orden creada. Añade otro equipo");
      
      // Mantener datos del cliente, resetear dispositivo
      setDeviceType("");
      setDeviceBrand(null);
      setDeviceModel("");
      setDeviceFamily("");
      setDeviceSerial("");
      setDeviceColor("");
      setProblem("");
      setPhotos([]);
      setDevicePin("");
      setDevicePassword("");
      setSecurityPattern(null);
      setChecklist([]);
      setOrderItems([]);
      setQuickOrderMode(false);
    } catch (err) {
      console.error("Error:", err);
      toast.error("Error: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog modal={false} open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogPortal>
        <DialogOverlay className="z-[120] bg-black/80 backdrop-blur-md" />
        <div
          className={`fixed inset-0 z-[121] flex pointer-events-none ${
            isCompactDevice ? "items-end justify-center" : "items-start justify-center"
          }`}
          style={{
            paddingTop: isCompactDevice ? 0 : "max(8px, env(safe-area-inset-top, 0px))",
            paddingRight: isCompactDevice ? 0 : "max(14px, env(safe-area-inset-right, 0px))",
            paddingBottom: isCompactDevice ? "env(safe-area-inset-bottom, 0px)" : "max(8px, env(safe-area-inset-bottom, 0px))",
            paddingLeft: isCompactDevice ? 0 : "max(14px, env(safe-area-inset-left, 0px))"
          }}
        >
          <DialogPrimitive.Content
            className={`pointer-events-auto p-0 border overflow-hidden flex flex-col relative outline-none ${
              quickOrderMode
                ? "border-amber-400/30 shadow-[0_20px_100px_rgba(245,158,11,0.28)] bg-gradient-to-br from-[#261602] via-[#1D1306] to-black"
                : "border-white/20 shadow-[0_20px_100px_rgba(6,182,212,0.4)] bg-gradient-to-br from-[#0A1628] via-[#0D1B2A] to-black"
            } ${
              isCompactDevice
                ? "max-w-3xl w-[98vw] h-[calc(100dvh-120px)] rounded-t-[28px] rounded-b-none"
                : "max-w-none w-[min(96vw,1480px)] h-[min(96dvh,1180px)] rounded-[28px]"
            }`}
            onInteractOutside={(e) => e.preventDefault()}
            onPointerDownOutside={(e) => e.preventDefault()}
            onFocusOutside={(e) => e.preventDefault()}
            onTouchStart={handleSwipeStart}
            onTouchMove={handleSwipeMove}
            onTouchEnd={handleSwipeEnd}
          >
        {isCompactDevice && (
          <div className="pt-2 flex justify-center">
            <div className="w-12 h-1.5 rounded-full bg-white/35" />
          </div>
        )}
        {/* Fondos animados flotantes */}
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-gradient-to-br from-cyan-500/20 to-blue-500/10 rounded-full blur-[120px] animate-pulse pointer-events-none" />
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-gradient-to-br from-purple-500/20 to-pink-500/10 rounded-full blur-[120px] animate-pulse delay-1000 pointer-events-none" />
        
        {/* Header */}
        <div className={`flex items-center justify-between border-b border-white/10 backdrop-blur-xl relative z-10 ${
          quickOrderMode
            ? "bg-gradient-to-r from-amber-500/18 via-yellow-500/12 to-orange-500/12"
            : "bg-gradient-to-r from-cyan-600/15 to-purple-600/15"
        } ${
          isCompactDevice ? "px-5 py-4" : "px-4 py-3"
        }`}>
          <div className="flex items-center gap-4">
            <div className={`${isCompactDevice ? "w-14 h-14 rounded-[20px]" : "w-12 h-12 rounded-[18px]"} ${
              quickOrderMode
                ? "bg-gradient-to-br from-amber-400 to-yellow-500"
                : "bg-gradient-to-br from-cyan-500 to-blue-600"
            } flex items-center justify-center shadow-2xl`}>
              <Wrench className={`${isCompactDevice ? "w-7 h-7" : "w-6 h-6"} text-white`} strokeWidth={2.5} />
            </div>
            <div>
              <h2 className={`${isCompactDevice ? "text-xl" : "text-lg"} font-black text-white tracking-tight`}>Nueva Orden</h2>
              <p className={`${isCompactDevice ? "text-sm" : "text-xs"} text-white/60 font-semibold`}>Completa todos los datos</p>
            </div>
          </div>
          {!isCompactDevice && (
            <button onClick={onClose} className="w-10 h-10 rounded-full bg-gradient-to-br from-white/10 to-white/5 border border-white/10 hover:from-white/15 hover:to-white/10 flex items-center justify-center transition-all active:scale-95">
              <X className="w-5 h-5 text-white" />
            </button>
          )}
        </div>

        <div className={`relative z-10 border-b border-white/8 ${
          quickOrderMode
            ? "bg-[linear-gradient(90deg,rgba(245,158,11,0.10),rgba(234,179,8,0.08),rgba(249,115,22,0.06))]"
            : "bg-[linear-gradient(90deg,rgba(8,145,178,0.08),rgba(16,185,129,0.08),rgba(124,58,237,0.06))]"
        } ${
          isCompactDevice ? "px-5 py-3" : "px-4 py-3"
        }`}>
          <button
            type="button"
            onClick={() => setQuickOrderMode((prev) => !prev)}
            className={`w-full rounded-[18px] border px-4 py-3 text-left transition-all ${
              quickOrderMode
                ? "border-amber-400/35 bg-amber-500/12 shadow-[0_0_30px_rgba(245,158,11,0.14)]"
                : "border-white/10 bg-black/20 hover:bg-white/5"
            }`}
          >
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-start gap-3">
                <div className={`flex h-11 w-11 items-center justify-center rounded-2xl ${
                  quickOrderMode
                    ? "bg-gradient-to-br from-amber-400 to-yellow-500 text-white"
                    : "bg-white/8 text-cyan-200"
                }`}>
                  <Zap className="h-5 w-5" strokeWidth={2.5} />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-black uppercase tracking-[0.22em] text-white">Orden rápida</p>
                    {quickOrderMode && (
                      <span className="rounded-full border border-amber-400/30 bg-amber-500/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.2em] text-amber-100">
                        Activa
                      </span>
                    )}
                  </div>
                  <p className="mt-1 text-sm text-white/60">
                    Para trabajos directos como pantalla, batería o puerto de carga. Crea la orden y la envía directo a En Reparación.
                  </p>
                </div>
              </div>
              <div className={`shrink-0 rounded-full px-3 py-1 text-xs font-bold uppercase tracking-[0.22em] ${
                quickOrderMode
                  ? "bg-amber-500/18 text-amber-100"
                  : "bg-white/8 text-white/45"
              }`}>
                {quickOrderMode ? "Salta diagnóstico" : "Modo estándar"}
              </div>
            </div>
          </button>
        </div>

        {/* Body - TODAS LAS SECCIONES EN UNA PÁGINA */}
        <div
          ref={bodyScrollRef}
          className={`flex-1 p-5 relative z-10 ${
            isCompactDevice
              ? "overflow-y-auto space-y-5 pb-28"
              : "overflow-y-auto grid grid-cols-12 gap-4 auto-rows-min p-4 pb-4"
          }`}
        >
          
          {/* 📋 CLIENTE */}
          <div className="bg-gradient-to-br from-cyan-500/10 to-blue-500/5 border border-cyan-500/30 rounded-[20px] p-5 space-y-4 backdrop-blur-xl shadow-lg relative overflow-hidden lg:col-span-4 lg:p-4 lg:space-y-3">
            <div className="absolute -right-16 -top-16 w-32 h-32 bg-gradient-to-br from-cyan-400/20 to-blue-500/10 rounded-full blur-3xl" />
            <h3 className="text-white font-black text-base flex items-center gap-2.5 relative z-10">
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-cyan-400 to-blue-500 flex items-center justify-center shadow-lg">
                <User className="w-4 h-4 text-white" strokeWidth={2.5} />
              </div>
              Cliente
            </h3>

            {/* Selector B2B */}
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => {
                  setIsB2B(false);
                  setCompanyName("");
                  setCompanyTaxId("");
                  setBillingContact("");
                }}
                className={`px-4 py-3 rounded-xl border-2 transition-all ${
                  !isB2B
                    ? "bg-gradient-to-r from-cyan-600 to-emerald-600 border-cyan-400 text-white"
                    : "bg-black/20 border-white/10 text-gray-400 hover:bg-white/5"
                }`}
              >
                <div className="text-center">
                  <div className="text-xl mb-1">👤</div>
                  <div className="font-bold text-xs">Individual</div>
                </div>
              </button>
              <button
                onClick={() => {
                  setIsB2B(true);
                  setCustomerName("");
                  setCustomerLastName("");
                }}
                className={`px-4 py-3 rounded-xl border-2 transition-all ${
                  isB2B
                    ? "bg-gradient-to-r from-purple-600 to-pink-600 border-purple-400 text-white"
                    : "bg-black/20 border-white/10 text-gray-400 hover:bg-white/5"
                }`}
              >
                <div className="text-center">
                  <div className="text-xl mb-1">🏢</div>
                  <div className="font-bold text-xs">Empresa</div>
                </div>
              </button>
            </div>
            
            {/* Búsqueda */}
            <div className="relative">
              <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                value={customerSearchQuery}
                onChange={(e) => {
                  setCustomerSearchQuery(e.target.value);
                  searchCustomers(e.target.value);
                }}
                placeholder={isB2B ? "Buscar empresa..." : "Buscar cliente..."}
                className="w-full pl-10 pr-3 py-2 bg-black/30 border border-white/10 rounded-lg text-white text-sm"
              />
            </div>
            
            {customerResults.length > 0 && (
              <div className="bg-black/80 border border-white/10 rounded-lg max-h-32 overflow-y-auto">
                {customerResults.map(c => (
                  <button
                    key={c.id}
                    onClick={() => selectCustomer(c)}
                    className="w-full text-left px-3 py-2 hover:bg-cyan-600/20 border-b border-white/5 last:border-0"
                  >
                    <p className="text-white text-sm font-semibold flex items-center gap-2">
                      {c.is_b2b ? "🏢" : "👤"} {c.name}
                    </p>
                    <p className="text-gray-400 text-xs">{c.phone}</p>
                  </button>
                ))}
              </div>
            )}

            {/* Campos según tipo */}
            {isB2B ? (
              <div className="space-y-3 bg-purple-600/5 border border-purple-500/30 rounded-xl p-3">
                <div>
                  <label className="text-xs text-gray-300 mb-1 block">Empresa *</label>
                  <input
                    value={companyName}
                    onChange={(e) => setCompanyName(e.target.value)}
                    placeholder="Tech Solutions Corp"
                    className="w-full bg-black/40 border border-purple-500/30 rounded-lg px-3 py-2 text-white text-sm"
                  />
                </div>
                <div>
                  <label className="text-xs text-gray-300 mb-1 block">RUT/Tax ID (opcional)</label>
                  <input
                    value={companyTaxId}
                    onChange={(e) => setCompanyTaxId(e.target.value)}
                    placeholder="12-3456789-0"
                    className="w-full bg-black/40 border border-purple-500/30 rounded-lg px-3 py-2 text-white text-sm"
                  />
                </div>
                <div>
                  <label className="text-xs text-gray-300 mb-1 block">Contacto *</label>
                  <input
                    value={billingContact}
                    onChange={(e) => setBillingContact(e.target.value)}
                    placeholder="María López - CFO"
                    className="w-full bg-black/40 border border-purple-500/30 rounded-lg px-3 py-2 text-white text-sm"
                  />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-gray-300 mb-1 block">Teléfono *</label>
                    <input
                      value={customerPhone}
                      onChange={(e) => setCustomerPhone(e.target.value)}
                      placeholder="787-555-0123"
                      className="w-full bg-black/40 border border-purple-500/30 rounded-lg px-3 py-2 text-white text-sm"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-gray-300 mb-1 block">Email *</label>
                    <input
                      type="email"
                      value={customerEmail}
                      onChange={(e) => setCustomerEmail(e.target.value)}
                      placeholder="cuentas@empresa.com"
                      className="w-full bg-black/40 border border-purple-500/30 rounded-lg px-3 py-2 text-white text-sm"
                    />
                  </div>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-gray-300 mb-1 block">Nombre *</label>
                    <input
                      value={customerName}
                      onChange={(e) => setCustomerName(e.target.value)}
                      placeholder="Juan"
                      className="w-full bg-black/30 border border-white/10 rounded-lg px-3 py-2 text-white text-sm"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-gray-300 mb-1 block">Apellidos</label>
                    <input
                      value={customerLastName}
                      onChange={(e) => setCustomerLastName(e.target.value)}
                      placeholder="Pérez"
                      className="w-full bg-black/30 border border-white/10 rounded-lg px-3 py-2 text-white text-sm"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-gray-300 mb-1 block">Teléfono *</label>
                    <input
                      value={customerPhone}
                      onChange={(e) => setCustomerPhone(e.target.value)}
                      placeholder="787-555-0123"
                      className="w-full bg-black/30 border border-white/10 rounded-lg px-3 py-2 text-white text-sm"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-gray-300 mb-1 block">Email (opcional)</label>
                    <input
                      type="email"
                      value={customerEmail}
                      onChange={(e) => setCustomerEmail(e.target.value)}
                      placeholder="cliente@email.com"
                      className="w-full bg-black/30 border border-white/10 rounded-lg px-3 py-2 text-white text-sm"
                    />
                  </div>
                </div>
                <div className="flex justify-end">
                  <button
                    type="button"
                    onClick={() => setShowAdditionalContact((prev) => !prev)}
                    className="text-xs font-semibold text-cyan-300 hover:text-cyan-200"
                  >
                    {showAdditionalContact ? "Ocultar contacto adicional" : "+ Añadir contacto adicional"}
                  </button>
                </div>
                {showAdditionalContact && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs text-gray-300 mb-1 block">Teléfono adicional</label>
                      <input
                        value={customerAltPhone}
                        onChange={(e) => setCustomerAltPhone(e.target.value)}
                        placeholder="787-555-0456"
                        className="w-full bg-black/30 border border-white/10 rounded-lg px-3 py-2 text-white text-sm"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-gray-300 mb-1 block">Email adicional</label>
                      <input
                        type="email"
                        value={customerAltEmail}
                        onChange={(e) => setCustomerAltEmail(e.target.value)}
                        placeholder="otro@email.com"
                        className="w-full bg-black/30 border border-white/10 rounded-lg px-3 py-2 text-white text-sm"
                      />
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* 👤 TÉCNICO */}
          {!quickOrderMode && (
          <div className="bg-gradient-to-br from-emerald-500/10 to-green-500/5 border border-emerald-500/30 rounded-[20px] p-5 space-y-4 backdrop-blur-xl shadow-lg relative overflow-hidden lg:col-span-3 lg:p-4 lg:space-y-3">
            <div className="absolute -right-16 -bottom-16 w-32 h-32 bg-gradient-to-br from-emerald-400/20 to-green-500/10 rounded-full blur-3xl" />
            <h3 className="text-white font-black text-base flex items-center gap-2.5 relative z-10">
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-emerald-400 to-green-500 flex items-center justify-center shadow-lg">
                <Users className="w-4 h-4 text-white" strokeWidth={2.5} />
              </div>
              Técnico (opcional)
            </h3>
            
            <div className="space-y-3">
              <button
                onClick={() => setAssignedTo(null)}
                className={`w-full px-3 py-2 rounded-lg text-xs border transition-all ${
                  !assignedTo 
                    ? "bg-gradient-to-r from-emerald-600 to-green-600 border-emerald-400 text-white"
                    : "bg-black/20 border-white/10 text-gray-300 hover:bg-white/5"
                }`}
              >
                Sin asignar
              </button>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <p className="text-[11px] uppercase tracking-[0.2em] text-emerald-300/80">Disponibles</p>
                  <span className="text-[10px] text-white/45">{availableTechnicians.length}</span>
                </div>
                <div className="grid grid-cols-1 gap-2">
                  {availableTechnicians.length === 0 && (
                    <div className="rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-xs text-white/45">
                      No hay técnicos ponchados ahora mismo
                    </div>
                  )}
                  {availableTechnicians.map((tech) => (
                    <button
                      key={tech.id}
                      onClick={() => setAssignedTo(tech)}
                      className={`px-3 py-2 rounded-lg text-xs border transition-all flex items-center gap-2 justify-between ${
                        assignedTo?.id === tech.id
                          ? "bg-gradient-to-r from-emerald-600 to-green-600 border-emerald-400 text-white"
                          : "bg-emerald-600/10 border-emerald-500/30 text-white hover:bg-emerald-500/15"
                      }`}
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <div className="w-5 h-5 rounded-full bg-cyan-600 flex items-center justify-center text-white text-[10px] font-bold">
                          {(tech.full_name || tech.email || "?")[0].toUpperCase()}
                        </div>
                        <span className="truncate">{tech.full_name || tech.email}</span>
                      </div>
                      <span className="text-[10px] text-emerald-200">Activo</span>
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <p className="text-[11px] uppercase tracking-[0.2em] text-amber-300/80">No disponibles</p>
                  <span className="text-[10px] text-white/45">{unavailableTechnicians.length}</span>
                </div>
                <div className="grid grid-cols-1 gap-2">
                  {unavailableTechnicians.map((tech) => (
                    <button
                      key={tech.id}
                      onClick={() => {
                        setAssignedTo(tech);
                        toast.info(`${tech.full_name || tech.email} no está ponchado ahora mismo.`);
                      }}
                      className={`px-3 py-2 rounded-lg text-xs border transition-all flex items-center gap-2 justify-between ${
                        assignedTo?.id === tech.id
                          ? "bg-gradient-to-r from-amber-600 to-orange-600 border-amber-400 text-white"
                          : "bg-black/20 border-white/10 text-gray-300 hover:bg-white/5"
                      }`}
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <div className="w-5 h-5 rounded-full bg-white/10 flex items-center justify-center text-white text-[10px] font-bold">
                          {(tech.full_name || tech.email || "?")[0].toUpperCase()}
                        </div>
                        <span className="truncate">{tech.full_name || tech.email}</span>
                      </div>
                      <span className="text-[10px] text-amber-200">No activo</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
          )}

          {/* 📱 DISPOSITIVO */}
          <div className="bg-gradient-to-br from-purple-500/10 to-pink-500/5 border border-purple-500/30 rounded-[20px] p-5 space-y-4 backdrop-blur-xl shadow-lg relative overflow-hidden lg:col-span-5 lg:p-4 lg:space-y-3">
            <div className="absolute -left-16 -top-16 w-32 h-32 bg-gradient-to-br from-purple-400/20 to-pink-500/10 rounded-full blur-3xl animate-pulse" />
            <div className="flex items-center justify-between relative z-10">
              <h3 className="text-white font-black text-base flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-400 to-pink-500 flex items-center justify-center shadow-lg">
                  <Smartphone className="w-4 h-4 text-white" strokeWidth={2.5} />
                </div>
                Dispositivo
              </h3>
              <button
                type="button"
                onClick={() => {
                  setDeviceCatalogCategory(deviceType || "");
                  setDeviceCatalogBrand(deviceBrand?.name || "");
                  setDeviceCatalogModel(deviceModel || "");
                  setShowManualDeviceCatalogBrand(false);
                  setShowManualDeviceCatalogModel(false);
                  setLoadingDeviceCatalogBrands(Boolean(deviceType));
                  setLoadingDeviceCatalogModels(Boolean(deviceType && deviceBrand?.name));
                  setShowDeviceCatalogModal(true);
                }}
                className="w-9 h-9 rounded-full border border-purple-400/40 bg-purple-500/15 text-white flex items-center justify-center hover:bg-purple-500/25 transition-all"
              >
                <Plus className="w-4 h-4" />
              </button>
            </div>

            {/* Tipo */}
            <div className="relative z-10">
              <label className="text-sm text-white/70 mb-3 block font-semibold">Categoría *</label>
              <div className="grid grid-cols-2 gap-2">
                <AnimatePresence mode="popLayout">
                  {types.map(t => (
                    <motion.button
                      key={t.id}
                      initial={{ opacity: 0, scale: 0.8 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.8 }}
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      type="button"
                      onClick={() => {
                        setDeviceType(t.name);
                        setDeviceBrand(null);
                        setDeviceModel("");
                      }}
                      className={`px-3 py-3 rounded-[16px] text-sm border-2 transition-all duration-300 font-bold ${
                        deviceType === t.name
                          ? "bg-gradient-to-r from-cyan-500 to-emerald-500 border-cyan-400 text-white shadow-[0_0_20px_rgba(6,182,212,0.4)] scale-105"
                          : "bg-black/20 border-white/10 text-gray-400 hover:bg-white/5"
                      }`}
                    >
                      <div className="flex flex-col items-center justify-center gap-1">
                        {getCategoryVisual(t).Icon ? (
                          React.createElement(getCategoryVisual(t).Icon, { className: "w-5 h-5" })
                        ) : (
                          <span className="text-lg leading-none">{getCategoryVisual(t).emoji}</span>
                        )}
                        <span className="text-xs sm:text-sm">{t.name}</span>
                      </div>
                    </motion.button>
                  ))}
                </AnimatePresence>
              </div>
            </div>

            {/* Marca */}
            {deviceType && (
              <div className="relative z-10">
                <label className="text-sm text-white/70 mb-3 block font-semibold">Marca *</label>
                <div className="flex flex-wrap gap-2">
                  <AnimatePresence mode="popLayout">
                    {uniqueBrands.map(b => (
                      <motion.button
                        key={b.id}
                        initial={{ opacity: 0, scale: 0.8 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.8 }}
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        type="button"
                        onClick={() => {
                          setDeviceBrand(b);
                          setDeviceFamily("");
                          setDeviceModel("");
                        }}
                        className={`px-4 py-2 rounded-[14px] text-sm border-2 transition-all duration-300 font-bold ${
                          normalizedNameKey(deviceBrand?.name || "") === normalizedNameKey(b?.name || "")
                            ? "bg-gradient-to-r from-emerald-500 to-green-500 border-emerald-400 text-white shadow-[0_0_20px_rgba(16,185,129,0.4)] scale-105"
                            : "bg-black/20 border-white/10 text-gray-400 hover:bg-white/5"
                        }`}
                      >
                        {b.name}
                      </motion.button>
                    ))}
                  </AnimatePresence>
                </div>
              </div>
            )}

            {/* Familia */}
            {deviceBrand && (
              <div className="relative z-10">
                <div className="mb-3">
                  <label className="text-sm text-white/70 font-semibold">Línea *</label>
                  <p className="text-xs text-white/45 mt-1">
                    Ejemplo: iPhone, iPhone Pro, Galaxy S, Galaxy A, iPad Pro.
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {uniqueFamilies.map(f => (
                    <button
                      key={f.id}
                      type="button"
                      onClick={() => {
                        setDeviceFamily(f.name);
                        setDeviceModel("");
                      }}
                      className={`px-4 py-2 rounded-[14px] text-sm border-2 transition-all duration-300 font-bold ${
                        normalizedNameKey(deviceFamily) === normalizedNameKey(f?.name || "")
                          ? "bg-gradient-to-r from-cyan-500 to-blue-500 border-cyan-400 text-white shadow-[0_0_20px_rgba(34,211,238,0.35)] scale-105"
                          : "bg-black/20 border-white/10 text-gray-400 hover:bg-white/5 active:scale-95"
                      }`}
                    >
                      {f.name}
                    </button>
                  ))}
                </div>
                {uniqueFamilies.length === 0 && (
                  <div className="mt-3 rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-xs text-white/45">
                    No hay líneas guardadas para esta marca. Usa el botón `+` para añadir una.
                  </div>
                )}
              </div>
            )}

            {/* Modelo */}
            {deviceBrand && deviceFamily && (
              <div className="relative z-10">
                <div className="mb-3">
                  <label className="text-sm text-white/70 font-semibold">Modelo *</label>
                  <p className="text-xs text-white/45 mt-1">Si no aparece en la lista, agrégalo desde el botón `+`.</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {uniqueModels.map(m => (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => {
                        setDeviceModel(m.name);
                      }}
                      className={`px-4 py-2 rounded-[14px] text-sm border-2 transition-all duration-300 font-bold ${
                        normalizedNameKey(deviceModel) === normalizedNameKey(m?.name || "")
                          ? "bg-gradient-to-r from-purple-500 to-pink-500 border-purple-400 text-white shadow-[0_0_20px_rgba(168,85,247,0.4)] scale-105"
                          : "bg-black/20 border-white/10 text-gray-400 hover:bg-white/5 active:scale-95"
                      }`}
                    >
                      {m.name}
                    </button>
                  ))}
                </div>
                {uniqueModels.length === 0 && (
                  <div className="mt-3 rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-xs text-white/45">
                    No hay modelos guardados para esta línea. Usa el botón `+` para añadir uno.
                  </div>
                )}
              </div>
            )}

            {deviceFamily && (
              <div className="bg-emerald-600/10 border border-emerald-500/30 rounded-lg p-2">
                <p className="text-xs text-emerald-300">
                  ✓ Familia: <span className="font-bold">{deviceFamily}</span>
                </p>
              </div>
            )}

          </div>

          {/* 🔧 PROBLEMA */}
          <div className="bg-gradient-to-br from-orange-500/10 to-amber-500/5 border border-orange-500/30 rounded-[20px] p-5 space-y-4 backdrop-blur-xl shadow-lg relative overflow-hidden lg:col-span-4 lg:p-4 lg:space-y-3">
            <div className="absolute -right-16 -top-16 w-32 h-32 bg-gradient-to-br from-orange-400/20 to-amber-500/10 rounded-full blur-3xl" />
            <h3 className="text-white font-black text-base flex items-center gap-2.5 relative z-10">
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-orange-400 to-amber-500 flex items-center justify-center shadow-lg">
                <Wrench className="w-4 h-4 text-white" strokeWidth={2.5} />
              </div>
              Cliente indica
            </h3>
            
            <textarea
              value={problem}
              onChange={(e) => setProblem(e.target.value)}
              placeholder={quickOrderMode ? "Ej: Cliente indica que solo necesita cambio de pantalla o batería..." : "Ej: Cliente indica que el equipo estaba cargando y de momento se apagó..."}
              className="w-full bg-black/30 border border-white/10 rounded-lg px-3 py-2 text-white text-sm min-h-[80px]"
            />
          </div>

          {/* 🛠️ PIEZAS Y SERVICIOS */}
          <div className="bg-gradient-to-br from-lime-500/10 to-emerald-500/5 border border-lime-500/30 rounded-[20px] p-5 space-y-4 backdrop-blur-xl shadow-lg relative overflow-hidden lg:col-span-8 lg:p-4 lg:space-y-3">
            <div className="absolute -left-16 -bottom-16 w-32 h-32 bg-gradient-to-br from-lime-400/20 to-emerald-500/10 rounded-full blur-3xl" />
            <div className="flex items-center justify-between relative z-10">
              <h3 className="text-white font-black text-base flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-lime-400 to-emerald-500 flex items-center justify-center shadow-lg">
                  <Wrench className="w-4 h-4 text-white" strokeWidth={2.5} />
                </div>
                Piezas y Servicios {quickOrderMode ? "(requerido)" : "(opcional)"}
              </h3>
              <Button
                type="button"
                onClick={() => setShowAddItemModal(true)}
                size="sm"
                className="bg-gradient-to-r from-lime-600 to-emerald-600 h-8"
              >
                <Plus className="w-3 h-3 mr-1" />
                Añadir
              </Button>
            </div>

            {quickOrderMode && (
              <div className="rounded-xl border border-emerald-400/25 bg-emerald-500/10 px-3 py-2">
                <p className="text-xs font-semibold text-emerald-200">
                  En modo rápido debes añadir al menos una pieza o servicio antes de crear la orden.
                </p>
              </div>
            )}

            {/* Sugerencias de piezas */}
            {deviceModel && suggestedProducts.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs text-gray-400 uppercase">💡 Sugerencias para {deviceModel}</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {suggestedProducts.slice(0, 4).map(product => {
                    const isAdded = orderItems.some(i => i.id === product.id && i.type === "product");
                    return (
                      <button
                        key={product.id}
                        type="button"
                        onClick={() => !isAdded && addItemToOrder({ ...product, type: "product" })}
                        disabled={isAdded}
                        className={`px-3 py-2 rounded-lg text-xs text-left border transition-all ${
                          isAdded
                            ? "bg-emerald-600/20 border-emerald-500/40 text-emerald-300"
                            : "bg-black/20 border-white/10 text-white hover:bg-white/5"
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="truncate">{product.name}</span>
                          <span className="text-lime-400 font-bold">${(product.price || 0).toFixed(2)}</span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Items añadidos */}
            {orderItems.length > 0 && (
              <div className="space-y-2 bg-lime-600/5 border border-lime-500/20 rounded-lg p-3">
                <p className="text-xs text-lime-300 uppercase font-bold">Items en la orden ({orderItems.length})</p>
                {orderItems.map((item, idx) => (
                  <div key={idx} className="flex items-center justify-between gap-2 bg-black/40 border border-white/10 rounded-lg p-2">
                    <div className="flex-1 min-w-0">
                      <p className="text-white text-xs font-medium truncate">{item.name}</p>
                      <p className="text-gray-400 text-[10px]">
                        {item.type === "product" ? "📦 Producto" : "🔧 Servicio"}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        min="1"
                        value={item.quantity}
                        onChange={(e) => updateItemQuantity(idx, e.target.value)}
                        className="w-12 h-7 text-center bg-black/40 border border-white/10 rounded text-white text-xs"
                      />
                      <span className="text-emerald-400 text-xs font-bold">
                        ${((item.price || 0) * (item.quantity || 1)).toFixed(2)}
                      </span>
                      <button
                        type="button"
                        onClick={() => removeItemFromOrder(idx)}
                        className="text-red-400 hover:text-red-300"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* 🔐 SEGURIDAD */}
          {!quickOrderMode && (
          <div className="bg-gradient-to-br from-blue-500/10 to-indigo-500/5 border border-blue-500/30 rounded-[20px] p-5 space-y-4 backdrop-blur-xl shadow-lg relative overflow-hidden lg:col-span-4 lg:p-4 lg:space-y-3">
            <div className="absolute -right-16 -top-16 w-32 h-32 bg-gradient-to-br from-blue-400/20 to-indigo-500/10 rounded-full blur-3xl" />
            <h3 className="text-white font-black text-base flex items-center gap-2.5 relative z-10">
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-400 to-indigo-500 flex items-center justify-center shadow-lg">
                <Shield className="w-4 h-4 text-white" strokeWidth={2.5} />
              </div>
              Seguridad (opcional)
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="relative">
                <label className="text-xs text-gray-300 mb-1 block">PIN (6 dígitos)</label>
                <input
                  value={devicePin}
                  onChange={(e) => setDevicePin(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  type={showPin ? "text" : "password"}
                  inputMode="numeric"
                  maxLength={6}
                  placeholder="123456"
                  className="w-full bg-black/30 border border-white/10 rounded-lg px-3 py-2 pr-10 text-white text-sm"
                />
                <button
                  type="button"
                  onClick={() => setShowPin(!showPin)}
                  className="absolute right-2 top-8 text-gray-400 hover:text-white"
                >
                  <Eye className="w-4 h-4" />
                </button>
              </div>

              <div className="relative">
                <label className="text-xs text-gray-300 mb-1 block">Password</label>
                <input
                  value={devicePassword}
                  onChange={(e) => setDevicePassword(e.target.value)}
                  type={showPassword ? "text" : "password"}
                  placeholder="MiPassword123"
                  className="w-full bg-black/30 border border-white/10 rounded-lg px-3 py-2 pr-10 text-white text-sm"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-2 top-8 text-gray-400 hover:text-white"
                >
                  <Eye className="w-4 h-4" />
                </button>
              </div>
            </div>

            <Button
              type="button"
              onClick={() => setPatternModalOpen(true)}
              variant="outline"
              className="border-blue-500/30 text-blue-300 hover:bg-blue-600/20 w-full"
            >
              <Grid3X3 className="w-4 h-4 mr-2" />
              {securityPattern?.path?.length ? `✓ Patrón (${securityPattern.path.length} puntos)` : "Capturar Patrón Android"}
            </Button>
          </div>
          )}

          {/* ✅ CHECKLIST */}
          {!quickOrderMode && (
          <div className="bg-gradient-to-br from-green-500/10 to-emerald-500/5 border border-green-500/30 rounded-[20px] p-5 space-y-4 backdrop-blur-xl shadow-lg relative overflow-hidden lg:col-span-4 lg:p-4 lg:space-y-3">
            <div className="absolute -left-16 -top-16 w-32 h-32 bg-gradient-to-br from-green-400/20 to-emerald-500/10 rounded-full blur-3xl" />
            <h3 className="text-white font-black text-base flex items-center gap-2.5 relative z-10">
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-green-400 to-emerald-500 flex items-center justify-center shadow-lg">
                <CheckSquare className="w-4 h-4 text-white" strokeWidth={2.5} />
              </div>
              Checklist de Recepción
            </h3>

            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div className="inline-flex items-center rounded-full border border-green-500/30 bg-black/30 p-1">
                {[
                  { key: "celulares", label: "Celulares" },
                  { key: "tabletas", label: "Tabletas" },
                  { key: "computadoras", label: "Computadoras" },
                  { key: "accesorios", label: "Accesorios" }
                ].map((opt) => {
                  const active = checklistTemplateKey === opt.key;
                  return (
                    <span
                      key={opt.key}
                      className={`px-3 py-1 rounded-full text-[11px] font-semibold ${
                        active ? "bg-green-500/25 text-green-100" : "text-green-200/60"
                      }`}
                    >
                      {opt.label}
                    </span>
                  );
                })}
              </div>
              <span className="text-[11px] text-green-200/80">
                {checklist.length} marcado{checklist.length === 1 ? "" : "s"}
              </span>
            </div>

            <div className="rounded-xl border border-green-500/25 bg-black/30 p-3 space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 lg:max-h-[260px] lg:overflow-y-auto pr-1">
                {checklistTemplateItems.map((item) => {
                  const isSelected = checklist.some((c) => c.id === item.key);
                  return (
                    <button
                      key={item.key}
                      type="button"
                      onClick={() => toggleChecklistItem(item.key, item.label)}
                      className={`px-3 py-2 rounded-lg text-xs border transition-all text-left ${
                        isSelected
                          ? "bg-gradient-to-r from-green-600 to-emerald-600 border-green-400 text-white"
                          : "bg-black/20 border-white/10 text-gray-300 hover:bg-white/5"
                      }`}
                    >
                      <span>{item.icon}</span> {item.label}
                    </button>
                  );
                })}
              </div>

              <div className="flex gap-2">
                <input
                  value={checklistQuickText}
                  onChange={(e) => setChecklistQuickText(e.target.value)}
                  onBlur={addQuickChecklistItem}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      addQuickChecklistItem();
                    }
                  }}
                  placeholder="Añadir condición manual y Enter..."
                  className="w-full bg-black/30 border border-white/10 rounded-lg px-3 py-2 text-white text-xs"
                />
              </div>
            </div>
            
            {checklist.length > 0 && (
              <div className="bg-green-600/10 border border-green-500/30 rounded-lg p-2 text-center">
                <p className="text-xs text-green-300">
                  ✓ {checklist.length} condición{checklist.length !== 1 ? 'es' : ''} marcada{checklist.length !== 1 ? 's' : ''}
                </p>
              </div>
            )}
          </div>
          )}

          {/* 📸 FOTOS */}
          {!quickOrderMode && (
          <div className="bg-gradient-to-br from-pink-500/10 to-rose-500/5 border border-pink-500/30 rounded-[20px] p-5 space-y-4 backdrop-blur-xl shadow-lg relative overflow-hidden lg:col-span-4 lg:p-4 lg:space-y-3">
            <div className="absolute -right-16 -bottom-16 w-32 h-32 bg-gradient-to-br from-pink-400/20 to-rose-500/10 rounded-full blur-3xl" />
            <h3 className="text-white font-black text-base flex items-center gap-2.5 relative z-10">
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-pink-400 to-rose-500 flex items-center justify-center shadow-lg">
                <Camera className="w-4 h-4 text-white" strokeWidth={2.5} />
              </div>
              Fotos / Evidencia
            </h3>

            <input
              ref={cameraInputRef}
              type="file"
              accept="image/*,video/*"
              capture="environment"
              multiple
              className="hidden"
              onChange={(e) => addPhotos(e.target.files)}
            />
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*,video/*"
              multiple
              className="hidden"
              onChange={(e) => addPhotos(e.target.files)}
            />

            <div className="flex gap-2">
              <Button
                type="button"
                onClick={() => cameraInputRef.current?.click()}
                className="flex-1 bg-gradient-to-r from-pink-600 to-rose-600"
              >
                <Camera className="w-4 h-4 mr-2" />
                Tomar Foto
              </Button>
              <Button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                variant="outline"
                className="flex-1 border-white/20 text-gray-300"
              >
                📁 Subir
              </Button>
            </div>

            {photos.length > 0 && (
              <div className="grid grid-cols-3 gap-2">
                {photos.map((file, idx) => {
                  const url = file instanceof File ? URL.createObjectURL(file) : file.url || file.publicUrl;
                  return (
                    <div key={idx} className="relative">
                      <button
                        type="button"
                        onClick={() => setPreviewMedia(url)}
                        className="block w-full"
                      >
                        <img
                          src={url}
                          alt={`foto-${idx}`}
                          className="w-full h-20 object-cover rounded-lg"
                        />
                      </button>
                      <button
                        type="button"
                        onClick={() => removePhoto(idx)}
                        className="absolute -top-1 -right-1 w-5 h-5 bg-red-600 rounded-full flex items-center justify-center"
                      >
                        <X className="w-3 h-3 text-white" />
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
          )}
        </div>

        {/* Footer - FIXED AL FONDO DEL MODAL */}
        <div
          className={`flex flex-col sm:flex-row gap-3 border-t border-white/10 bg-gradient-to-r from-black/90 via-gray-900/80 to-black/90 backdrop-blur-xl relative z-10 ${
            isCompactDevice ? "px-5 py-4" : "px-4 py-3"
          }`}
          style={{ paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 1rem)" }}
        >
          {!isCompactDevice && (
            <Button
              onClick={onClose}
              variant="outline"
              className="border-white/20 text-gray-300 hover:bg-white/10 h-12 rounded-[16px] font-bold active:scale-95 transition-all"
              disabled={loading}
            >
              Cancelar
            </Button>
          )}
          {!isCompactDevice && isB2B && (
            <Button
              onClick={handleAddAnother}
              disabled={loading}
              variant="outline"
              className="border-cyan-500/40 bg-cyan-500/10 text-cyan-400 hover:bg-cyan-600/20 h-12 rounded-[16px] font-bold active:scale-95 transition-all"
            >
              <Plus className="w-5 h-5 mr-2" />
              Añadir otro equipo
            </Button>
          )}
          <Button
            onClick={handleSubmit}
            disabled={loading}
            className={`w-full sm:flex-1 text-white h-12 rounded-[16px] font-black active:scale-95 transition-all duration-300 ${
              quickOrderMode
                ? "bg-gradient-to-r from-amber-500 to-yellow-500 hover:from-amber-600 hover:to-yellow-600 shadow-[0_0_25px_rgba(245,158,11,0.35)] text-slate-950"
                : "bg-gradient-to-r from-cyan-500 to-emerald-500 hover:from-cyan-600 hover:to-emerald-600 shadow-[0_0_25px_rgba(6,182,212,0.4)]"
            }`}
          >
            {loading ? (
              <>
                <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                {quickOrderMode ? "Creando rápida..." : "Creando..."}
              </>
            ) : (
              <>
                <Save className="w-5 h-5 mr-2" />
                {quickOrderMode ? "Crear Orden Rápida" : "Crear Orden"}
                {customerEmail && <Mail className="w-5 h-5 ml-2" />}
              </>
            )}
          </Button>
        </div>
          </DialogPrimitive.Content>
        </div>
      </DialogPortal>

      {/* Modal de patrón */}
      {patternModalOpen && (
        <PatternModal
          onClose={() => setPatternModalOpen(false)}
          onSave={(path) => {
            setSecurityPattern({ path });
            setPatternModalOpen(false);
            toast.success("✓ Patrón guardado");
          }}
        />
      )}

      {/* Modal de añadir items */}
      {showAddItemModal && createPortal((
        <AddItemModal
          open={showAddItemModal}
          onClose={() => setShowAddItemModal(false)}
          onSave={() => setShowAddItemModal(false)}
          draftMode
          order={{ order_items: draftOrderItems }}
          initialItems={draftOrderItems}
          onApplyItems={applyDraftOrderItems}
          deviceType={deviceType}
          deviceBrand={deviceBrand?.name || ""}
          deviceFamily={deviceFamily}
          deviceModel={deviceModel}
        />
      ), document.body)}

      {showDeviceCatalogModal && createPortal(
        <div className="fixed inset-0 z-[99999] bg-black/85 backdrop-blur-xl flex items-center justify-center p-4">
          <div className="bg-gradient-to-br from-[#1C1C1E] to-black border border-white/20 backdrop-blur-3xl text-white max-w-lg w-full rounded-[28px] overflow-hidden shadow-[0_30px_100px_rgba(168,85,247,0.35)] relative">
            <div className="px-6 py-5 border-b border-white/10 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center shadow-lg">
                  <Plus className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h3 className="text-lg font-black">Nuevo dispositivo</h3>
                  <p className="text-xs text-white/55">Crea categoría, marca, línea y modelo en un solo paso</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowDeviceCatalogModal(false)}
                className="w-10 h-10 rounded-full bg-white/10 border border-white/10 flex items-center justify-center"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <DragDropContext onDragEnd={handleDragEndCatalog}>
              <div className="px-6 py-5 space-y-5">
              <div>
                <label className="text-sm text-white/70 mb-2 block">Categoría</label>
                <input
                  value={deviceCatalogCategory}
                    onChange={(e) => {
                      const nextCategory = e.target.value;
                      setLoadingDeviceCatalogBrands(Boolean(nextCategory.trim()));
                      setLoadingDeviceCatalogFamilies(false);
                      setLoadingDeviceCatalogModels(false);
                      setDeviceCatalogCategory(e.target.value);
                      setDeviceCatalogBrand("");
                      setDeviceCatalogFamily("");
                      setDeviceCatalogModel("");
                      setShowManualDeviceCatalogBrand(false);
                      setShowManualDeviceCatalogFamily(false);
                      setShowManualDeviceCatalogModel(false);
                    }}
                  placeholder="Ej: Laptop, Tablet, Celular"
                  className="w-full bg-white/5 border border-white/20 rounded-xl px-4 py-3 text-white"
                />
                {types.length > 0 && (
                  <Droppable droppableId="catalog-categories" direction="horizontal">
                  {(provided) => (
                    <div
                      className="mt-3 flex flex-wrap gap-2"
                      ref={provided.innerRef}
                      {...provided.droppableProps}
                    >
                    {types.slice(0, 20).map((type, index) => {
                      const active = normalizedText(deviceCatalogCategory) === normalizedText(type?.name);
                      return (
                        <div
                          key={type.id}>
                          <Draggable draggableId={type.id || "cat-"+index} index={index}>
                            {(provided) => (
                              <div
                                ref={provided.innerRef}
                                {...provided.draggableProps}
                                {...provided.dragHandleProps}
                                className={`inline-flex items-center gap-1 rounded-full border pr-1 pl-2 py-1 transition-all ${active ? "bg-cyan-500/20 border-cyan-400/60 text-cyan-200" : "bg-white/5 border-white/10 text-white/70"}`}
                              >
                          <button
                            type="button"
                            onClick={() => {
                              setLoadingDeviceCatalogBrands(true);
                              setLoadingDeviceCatalogFamilies(false);
                              setLoadingDeviceCatalogModels(false);
                              setDeviceCatalogCategory(type.name);
                              setDeviceCatalogBrand("");
                              setDeviceCatalogFamily("");
                              setDeviceCatalogModel("");
                              setShowManualDeviceCatalogBrand(false);
                              setShowManualDeviceCatalogFamily(false);
                              setShowManualDeviceCatalogModel(false);
                            }}
                            className="text-xs"
                          >
                            {type.icon ? `${type.icon} ` : ""}{type.name}
                          </button>
                          <button
                            type="button"
                            onClick={() => handleEditCatalogEntry({ level: "category", entry: type })}
                            className="p-1 rounded-full hover:bg-white/10"
                            title="Editar categoría"
                          >
                            <Pencil className="w-3 h-3" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteCatalogEntry({ level: "category", entry: type })}
                            className="p-1 rounded-full hover:bg-red-500/20 text-red-200"
                            title="Eliminar categoría"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                              </div>
                            )}
                          </Draggable>
                        </div>
                      );
                    })}
                    {provided.placeholder}
                    </div>
                  )}
                </Droppable>
                )}
              <div>
                <label className="text-sm text-white/70 mb-2 block">Marca</label>
                {loadingDeviceCatalogBrands && deviceCatalogBrands.length === 0 ? (
                  <div className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white/45">
                    Cargando marcas...
                  </div>
                ) : (showManualDeviceCatalogBrand || deviceCatalogBrands.length === 0) ? (
                  <input
                    value={deviceCatalogBrand}
                    onChange={(e) => {
                      const nextBrand = e.target.value;
                      setLoadingDeviceCatalogFamilies(Boolean(deviceCatalogCategory.trim() && nextBrand.trim()));
                      setLoadingDeviceCatalogModels(false);
                      setDeviceCatalogBrand(e.target.value);
                      setDeviceCatalogFamily("");
                      setDeviceCatalogModel("");
                      setShowManualDeviceCatalogFamily(false);
                      setShowManualDeviceCatalogModel(false);
                    }}
                    placeholder="Ej: Apple, HP, Samsung"
                    className="w-full bg-white/5 border border-white/20 rounded-xl px-4 py-3 text-white"
                  />
                ) : (
                  <div className="flex items-center justify-between gap-3 rounded-xl border border-white/10 bg-white/5 px-4 py-3">
                    <span className="text-sm text-white/55">
                      {deviceCatalogBrand ? `Marca elegida: ${deviceCatalogBrand}` : "Selecciona una marca de la lista"}
                    </span>
                    <button
                      type="button"
                      onClick={() => setShowManualDeviceCatalogBrand(true)}
                      className="text-xs font-semibold text-cyan-300 hover:text-cyan-200"
                    >
                      Nueva marca
                    </button>
                  </div>
                )}
                {deviceCatalogBrands.length > 0 && (
                <Droppable droppableId="catalog-brands" direction="horizontal">
                  {(provided) => (
                    <div
                      className="mt-3 flex flex-wrap gap-2"
                      ref={provided.innerRef}
                      {...provided.droppableProps}
                    >
                    {deviceCatalogBrands.map((brand, index) => {
                      const active = normalizedText(deviceCatalogBrand) === normalizedText(brand?.name);
                      return (
                        <div
                          key={brand.id}>
                          <Draggable draggableId={brand.id || "br-"+index} index={index}>
                            {(provided) => (
                              <div
                                ref={provided.innerRef}
                                {...provided.draggableProps}
                                {...provided.dragHandleProps}
                                className={`inline-flex items-center gap-1 rounded-full border pr-1 pl-2 py-1 transition-all ${active ? "bg-purple-500/20 border-purple-400/60 text-purple-200" : "bg-white/5 border-white/10 text-white/70"}`}
                              >
                          <button
                            type="button"
                            onClick={() => {
                              setLoadingDeviceCatalogFamilies(true);
                              setLoadingDeviceCatalogModels(false);
                              setDeviceCatalogBrand(brand.name);
                              setDeviceCatalogFamily("");
                              setDeviceCatalogModel("");
                              setShowManualDeviceCatalogBrand(false);
                              setShowManualDeviceCatalogFamily(false);
                              setShowManualDeviceCatalogModel(false);
                            }}
                            className="text-xs"
                          >
                            {brand.name}
                          </button>
                          <button
                            type="button"
                            onClick={() => handleEditCatalogEntry({ level: "brand", entry: brand })}
                            className="p-1 rounded-full hover:bg-white/10"
                            title="Editar marca"
                          >
                            <Pencil className="w-3 h-3" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteCatalogEntry({ level: "brand", entry: brand })}
                            className="p-1 rounded-full hover:bg-red-500/20 text-red-200"
                            title="Eliminar marca"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                              </div>
                            )}
                          </Draggable>
                        </div>
                      );
                    })}
                    {provided.placeholder}
                    </div>
                  )}
                </Droppable>
                )}
              <div>
                <label className="text-sm text-white/70 mb-2 block">Línea / familia</label>
                {loadingDeviceCatalogFamilies && deviceCatalogFamilies.length === 0 ? (
                  <div className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white/45">
                    Cargando líneas...
                  </div>
                ) : (showManualDeviceCatalogFamily || deviceCatalogFamilies.length === 0) ? (
                  <input
                    value={deviceCatalogFamily}
                    onChange={(e) => {
                      const nextFamily = e.target.value;
                      setLoadingDeviceCatalogModels(Boolean(deviceCatalogCategory.trim() && deviceCatalogBrand.trim() && nextFamily.trim()));
                      setDeviceCatalogFamily(nextFamily);
                      setDeviceCatalogModel("");
                      setShowManualDeviceCatalogModel(false);
                    }}
                    placeholder="Ej: iPhone Pro, iPhone, Galaxy S"
                    className="w-full bg-white/5 border border-white/20 rounded-xl px-4 py-3 text-white"
                  />
                ) : (
                  <div className="flex items-center justify-between gap-3 rounded-xl border border-white/10 bg-white/5 px-4 py-3">
                    <span className="text-sm text-white/55">
                      {deviceCatalogFamily ? `Línea elegida: ${deviceCatalogFamily}` : "Selecciona una línea o crea una nueva"}
                    </span>
                    <button
                      type="button"
                      onClick={() => setShowManualDeviceCatalogFamily(true)}
                      className="text-xs font-semibold text-violet-300 hover:text-violet-200"
                    >
                      Nueva línea
                    </button>
                  </div>
                )}
                {deviceCatalogFamilies.length > 0 && (
                <Droppable droppableId="catalog-families" direction="horizontal">
                  {(provided) => (
                    <div
                      className="mt-3 flex flex-wrap gap-2"
                      ref={provided.innerRef}
                      {...provided.droppableProps}
                    >
                    {deviceCatalogFamilies.map((family, index) => {
                      const active = normalizedText(deviceCatalogFamily) === normalizedText(family?.name);
                      return (
                        <div
                          key={family.id}>
                          <Draggable draggableId={family.id || "fa-"+index} index={index}>
                            {(provided) => (
                              <div
                                ref={provided.innerRef}
                                {...provided.draggableProps}
                                {...provided.dragHandleProps}
                                className={`inline-flex items-center gap-1 rounded-full border pr-1 pl-2 py-1 transition-all ${active ? "bg-violet-500/20 border-violet-400/60 text-violet-200" : "bg-white/5 border-white/10 text-white/70"}`}
                              >
                          <button
                            type="button"
                            onClick={() => {
                              setLoadingDeviceCatalogModels(true);
                              setDeviceCatalogFamily(family.name);
                              setDeviceCatalogModel("");
                              setShowManualDeviceCatalogFamily(false);
                              setShowManualDeviceCatalogModel(false);
                            }}
                            className="text-xs"
                          >
                            {family.name}
                          </button>
                          <button
                            type="button"
                            onClick={() => handleEditCatalogEntry({ level: "family", entry: family })}
                            className="p-1 rounded-full hover:bg-white/10"
                            title="Editar línea"
                          >
                            <Pencil className="w-3 h-3" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteCatalogEntry({ level: "family", entry: family })}
                            className="p-1 rounded-full hover:bg-red-500/20 text-red-200"
                            title="Eliminar línea"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                              </div>
                            )}
                          </Draggable>
                        </div>
                      );
                    })}
                    {provided.placeholder}
                    </div>
                  )}
                </Droppable>
                )}
              <div>
                <label className="text-sm text-white/70 mb-2 block">Modelo</label>
                {loadingDeviceCatalogModels && deviceCatalogModels.length === 0 ? (
                  <div className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white/45">
                    Cargando modelos...
                  </div>
                ) : (showManualDeviceCatalogModel || deviceCatalogModels.length === 0) ? (
                  <input
                    value={deviceCatalogModel}
                    onChange={(e) => setDeviceCatalogModel(e.target.value)}
                    placeholder="Escribe el modelo nuevo"
                    className="w-full bg-white/5 border border-white/20 rounded-xl px-4 py-3 text-white"
                    onKeyDown={(e) => {
                      if (e.key === "Enter") handleSaveDeviceCatalogEntry();
                    }}
                  />
                ) : (
                  <div className="flex items-center justify-between gap-3 rounded-xl border border-white/10 bg-white/5 px-4 py-3">
                    <span className="text-sm text-white/55">
                      {deviceCatalogModel ? `Modelo elegido: ${deviceCatalogModel}` : "Selecciona un modelo o crea uno nuevo"}
                    </span>
                    <button
                      type="button"
                      onClick={() => setShowManualDeviceCatalogModel(true)}
                      className="text-xs font-semibold text-emerald-300 hover:text-emerald-200"
                    >
                      Nuevo modelo
                    </button>
                  </div>
                )}
                <div className="mt-3 rounded-2xl border border-white/10 bg-white/5 p-3">
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <p className="text-xs font-semibold uppercase tracking-[0.2em] text-white/45">
                      Modelos existentes
                    </p>
                    <span className="text-[11px] text-white/40">{deviceCatalogModels.length}</span>
                  </div>
                  {deviceCatalogModels.length > 0 ? (
                    <Droppable droppableId="catalog-models" direction="horizontal">
                      {(provided) => (
                        <div
                          className="flex flex-wrap gap-2 max-h-36 overflow-y-auto pr-1"
                          ref={provided.innerRef}
                          {...provided.droppableProps}
                        >
                      {deviceCatalogModels.map((model, index) => {
                        const active = normalizedText(deviceCatalogModel) === normalizedText(model?.name);
                        return (
                          <div
                            key={model.id}>
                            <Draggable draggableId={model.id || "mo-"+index} index={index}>
                              {(provided) => (
                                <div
                                  ref={provided.innerRef}
                                  {...provided.draggableProps}
                                  {...provided.dragHandleProps}
                                  className={`inline-flex items-center gap-1 rounded-full border pr-1 pl-2 py-1 transition-all ${active ? "bg-emerald-500/20 border-emerald-400/60 text-emerald-200" : "bg-black/30 border-white/10 text-white/70"}`}
                                >
                            <button
                              type="button"
                              onClick={() => {
                                setDeviceCatalogModel(model.name);
                                setShowManualDeviceCatalogModel(false);
                              }}
                              className="text-xs"
                            >
                              {model.name}
                            </button>
                            <button
                              type="button"
                              onClick={() => handleEditCatalogEntry({ level: "model", entry: model })}
                              className="p-1 rounded-full hover:bg-white/10"
                              title="Editar modelo"
                            >
                              <Pencil className="w-3 h-3" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteCatalogEntry({ level: "model", entry: model })}
                              className="p-1 rounded-full hover:bg-red-500/20 text-red-200"
                              title="Eliminar modelo"
                            >
                              <Trash2 className="w-3 h-3" />
                            </button>
                                </div>
                              )}
                            </Draggable>
                          </div>
                        );
                      })}
                      {provided.placeholder}
                      </div>
                    )}
                  </Droppable>
                  ) : (
                    <p className="text-sm text-white/45">
                      Selecciona categoría y marca para ver los modelos que ya guardaste.
                    </p>
                  )}
                </div>
              </div>
            </DragDropContext>
            <div className="px-6 pb-6 flex gap-3">
              <button
                type="button"
                onClick={() => setShowDeviceCatalogModal(false)}
                className="flex-1 px-4 py-3 bg-white/10 hover:bg-white/15 border border-white/10 text-white rounded-xl font-semibold transition-all"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleSaveDeviceCatalogEntry}
                className="flex-1 px-4 py-3 bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white rounded-xl font-semibold shadow-lg transition-all"
              >
                Guardar
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {previewMedia && createPortal(
        <div
          className="fixed inset-0 z-[100000] bg-black/90 backdrop-blur-md flex items-center justify-center p-4"
          onClick={() => setPreviewMedia(null)}
        >
          <div className="relative max-w-5xl w-full flex items-center justify-center">
            <button
              type="button"
              onClick={() => setPreviewMedia(null)}
              className="absolute top-3 right-3 z-10 w-10 h-10 rounded-full bg-black/50 border border-white/20 text-white flex items-center justify-center"
            >
              <X className="w-5 h-5" />
            </button>
            <img
              src={previewMedia}
              alt="Vista previa"
              className="max-w-full max-h-[85vh] object-contain rounded-2xl border border-white/10 shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            />
          </div>
        </div>,
        document.body
      )}
    </Dialog>
  );
}

// === PATTERN MODAL ===
function PatternModal({ onClose, onSave }) {
  const canvasRef = useRef(null);
  const [pattern, setPattern] = useState([]);
  const [drawing, setDrawing] = useState(false);

  useEffect(() => {
    renderPattern(pattern);
  }, [pattern]);

  const renderPattern = (currentPattern) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    
    canvas.width = Math.floor(rect.width * dpr);
    canvas.height = Math.floor(rect.height * dpr);
    
    const ctx = canvas.getContext('2d');
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, rect.width, rect.height);

    const cellSize = rect.width / 3;

    for (let i = 0; i < 3; i++) {
      for (let j = 0; j < 3; j++) {
        const x = cellSize * j + cellSize / 2;
        const y = cellSize * i + cellSize / 2;
        const idx = i * 3 + j;
        
        ctx.beginPath();
        ctx.arc(x, y, 14, 0, 2 * Math.PI);
        ctx.fillStyle = currentPattern.includes(idx) ? '#00a8e8' : '#6b7280';
        ctx.fill();
      }
    }

    if (currentPattern.length > 1) {
      ctx.strokeStyle = '#00a8e8';
      ctx.lineWidth = 4;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.beginPath();
      
      for (let i = 0; i < currentPattern.length; i++) {
        const idx = currentPattern[i];
        const row = Math.floor(idx / 3);
        const col = idx % 3;
        const x = cellSize * col + cellSize / 2;
        const y = cellSize * row + cellSize / 2;
        
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      
      ctx.stroke();
    }
  };

  const getCoordinates = (e) => {
    const canvas = canvasRef.current;
    if (!canvas) return null;

    const rect = canvas.getBoundingClientRect();
    const pt = e.touches?.[0] ?? e;
    
    return {
      x: pt.clientX - rect.left,
      y: pt.clientY - rect.top
    };
  };

  const handleCanvasInteraction = (e) => {
    e.preventDefault();
    const coords = getCoordinates(e);
    if (!coords) return;

    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const cellSize = rect.width / 3;

    for (let i = 0; i < 3; i++) {
      for (let j = 0; j < 3; j++) {
        const px = cellSize * j + cellSize / 2;
        const py = cellSize * i + cellSize / 2;
        const dist = Math.sqrt((coords.x - px) ** 2 + (coords.y - py) ** 2);
        
        if (dist < cellSize / 3) {
          const idx = i * 3 + j;
          if (!pattern.includes(idx)) {
            setPattern(prev => [...prev, idx]);
          }
          return;
        }
      }
    }
  };

  const handleSave = () => {
    if (pattern.length < 4) {
      toast.error("El patrón debe tener al menos 4 puntos");
      return;
    }
    onSave(pattern);
  };

  return (
    <div className="fixed inset-0 z-[200] bg-black/80 flex items-center justify-center p-4">
      <div className="bg-[#0f172a] border border-cyan-500/30 rounded-2xl p-6 w-full max-w-md">
        <h4 className="text-white font-bold mb-4 text-lg">Patrón de Desbloqueo Android</h4>
        
        <div className="flex flex-col items-center gap-4">
          <div className="w-full aspect-square bg-black rounded-xl border border-cyan-500/20 p-4" style={{ touchAction: 'none' }}>
            <canvas
              ref={canvasRef}
              onMouseDown={() => setDrawing(true)}
              onMouseUp={() => setDrawing(false)}
              onMouseMove={(e) => drawing && handleCanvasInteraction(e)}
              onTouchStart={() => setDrawing(true)}
              onTouchEnd={() => setDrawing(false)}
              onTouchMove={(e) => drawing && handleCanvasInteraction(e)}
              className="w-full h-full cursor-crosshair"
              style={{ touchAction: 'none' }}
            />
          </div>

          <p className="text-sm text-gray-400 text-center">
            Dibuja conectando al menos 4 puntos
          </p>

          <div className="flex gap-3 w-full">
            <Button
              onClick={() => setPattern([])}
              variant="outline"
              className="flex-1 border-white/20 text-gray-300"
            >
              Limpiar
            </Button>
            <Button
              onClick={onClose}
              variant="outline"
              className="flex-1 border-white/20 text-gray-300"
            >
              Cancelar
            </Button>
            <Button
              onClick={handleSave}
              disabled={pattern.length < 4}
              className="flex-1 bg-gradient-to-r from-cyan-600 to-emerald-600"
            >
              <Check className="w-4 h-4 mr-2" />
              Guardar
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
