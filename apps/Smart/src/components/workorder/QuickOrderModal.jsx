import React, { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { base44 } from "@/api/base44Client";
import UniversalPrintDialog from "../printing/UniversalPrintDialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  X, Loader2, Check, User, Phone, Mail, Smartphone,
  Search, Users, Wrench, Camera, Save, Shield, CheckSquare,
  Eye, Grid3X3, Plus, Building2, Package, Lock } from
"lucide-react";
import { toast } from "sonner";
import { createWelcomeEmail, getBusinessInfo } from "@/components/utils/emailTemplates";
import NotificationService from "../notifications/NotificationService";
import ServiceSelectorModal from "@/components/common/ServiceSelectorModal";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { generateOrderNumber } from "@/components/utils/sequenceHelpers";
import { upsertLocalOrder } from "@/components/utils/localOrderCache";

const LOCAL_CUSTOMERS_KEY = "smartfix_local_customers";

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

const encryptData = (data) => {
  try {
    return btoa(String(data));
  } catch {
    return String(data);
  }
};

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

const CHECKLIST_ITEMS = [
{ key: "screen_broken", label: "Pantalla rota / rajada", icon: "💔", category: "Pantalla" },
{ key: "screen_no_image", label: "Pantalla sin imagen", icon: "📺", category: "Pantalla" },
{ key: "touch_not_working", label: "Touch no responde", icon: "👆", category: "Touch" },
{ key: "battery_drains", label: "Batería se descarga rápido", icon: "🔋", category: "Batería" },
{ key: "battery_no_charge", label: "No carga", icon: "⚠️", category: "Batería" },
{ key: "port_damaged", label: "Puerto dañado", icon: "🔌", category: "Carga" },
{ key: "no_power", label: "No enciende", icon: "⚫", category: "Encendido" },
{ key: "wifi_not_working", label: "WiFi no conecta", icon: "📶", category: "Conectividad" },
{ key: "signal_issue", label: "Sin señal", icon: "📵", category: "Conectividad" },
{ key: "water_damage", label: "Daño por líquido", icon: "💧", category: "Físico" }];


export default function QuickOrderModal({ open, onClose, onSuccess }) {
  const [loading, setLoading] = useState(false);
  const [user, setUser] = useState(null);
  const [technicians, setTechnicians] = useState([]);

  // Form data
  const [customerName, setCustomerName] = useState("");
  const [customerLastName, setCustomerLastName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [customerEmail, setCustomerEmail] = useState("");
  const [customerId, setCustomerId] = useState(null);
  const [isB2B, setIsB2B] = useState(false);
  const [companyName, setCompanyName] = useState("");
  const [companyTaxId, setCompanyTaxId] = useState("");
  const [billingContact, setBillingContact] = useState("");
  const [additionalContacts, setAdditionalContacts] = useState([]); // [{ type: 'phone', value: '', label: '' }]

  const [assignedTo, setAssignedTo] = useState(null);

  const [deviceType, setDeviceType] = useState("");
  const [deviceBrand, setDeviceBrand] = useState(null);
  const [deviceModel, setDeviceModel] = useState("");
  const [deviceSerial, setDeviceSerial] = useState("");
  const [deviceColor, setDeviceColor] = useState("");

  const [problem, setProblem] = useState("");
  const [photos, setPhotos] = useState([]);

  const [devicePin, setDevicePin] = useState("");
  const [devicePassword, setDevicePassword] = useState("");
  const [securityPattern, setSecurityPattern] = useState(null);
  const [showPin, setShowPin] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [patternModalOpen, setPatternModalOpen] = useState(false);
  const [showServiceSelector, setShowServiceSelector] = useState(false);

  const [checklist, setChecklist] = useState([]);
  const [taxRate, setTaxRate] = useState(0.115);

  // Parts & Services
  const [orderItems, setOrderItems] = useState([]);
  const [availableParts, setAvailableParts] = useState([]);
  const [availableServices, setAvailableServices] = useState([]);
  const [itemSearch, setItemSearch] = useState("");

  // Catalogs
  const [types, setTypes] = useState([]);
  const [brands, setBrands] = useState([]);
  const [models, setModels] = useState([]);

  // Search
  const [customerSearchQuery, setCustomerSearchQuery] = useState("");
  const [customerResults, setCustomerResults] = useState([]);

  // Load suggestions when model changes
  useEffect(() => {
    if (deviceModel && deviceModel.length > 2) {
      loadCompatibleItems(deviceModel);
    }
  }, [deviceModel]);

  const loadCompatibleItems = async (model) => {
    try {
      const q = model.toLowerCase();
      // Fetch parts
      const allProducts = await base44.entities.Product.list("-created_date", 100);
      const parts = allProducts.filter((p) => {
        const nameMatch = p.name.toLowerCase().includes(q);
        const compatMatch = p.compatibility_models?.some((m) => m.toLowerCase().includes(q));
        const active = p.active !== false;
        return active && (nameMatch || compatMatch) && p.stock > 0;
      });
      setAvailableParts(parts.slice(0, 10));

      // Fetch services
      const allServices = await base44.entities.Service.filter({ active: true });
      // Filter services that might be relevant (generic or specific)
      setAvailableServices(allServices);
    } catch (e) {
      console.error("Error loading items", e);
    }
  };

  const addItemToOrder = (item, type) => {
    const newItem = {
      id: item.id,
      type: type,
      name: item.name,
      price: item.price,
      cost: item.cost || 0,
      quantity: 1,
      taxable: item.taxable
    };
    setOrderItems((prev) => [...prev, newItem]);
    toast.success(`${item.name} añadido`);
  };

  const handleServiceSelect = (item) => {
    const type = item.part_type === 'servicio' ? 'service' : 'product';
    addItemToOrder(item, type);
  };

  const removeItemFromOrder = (index) => {
    setOrderItems(orderItems.filter((_, i) => i !== index));
  };

  const fileInputRef = useRef(null);
  const cameraInputRef = useRef(null);
  const bodyScrollRef = useRef(null);
  const swipeStateRef = useRef({ startY: 0, lastY: 0, active: false });
  const [isCompactDevice, setIsCompactDevice] = useState(false);

  useEffect(() => {
    const updateDeviceMode = () => {
      if (typeof window === "undefined") return;
      const compactWidth = window.innerWidth <= 1024;
      const touchCapable = "ontouchstart" in window || (navigator?.maxTouchPoints || 0) > 0;
      setIsCompactDevice(compactWidth || touchCapable);
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
    const inTopZone = y <= 150;
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

  useEffect(() => {
    if (open) {
      loadUser();
      loadTechnicians();
      loadTypes();
      loadSettings();
    } else {
      resetForm();
    }
  }, [open]);

  const loadSettings = async () => {
    try {
      const rows = await base44.entities.SystemConfig.filter({ key: "global_settings" });
      if (rows?.length) {
        const parsed = typeof rows[0].value === "string" ? JSON.parse(rows[0].value) : rows[0].value;
        if (parsed?.tax_rate) setTaxRate(parseFloat(parsed.tax_rate));
      }
    } catch (e) {
      console.warn("Error loading settings", e);
    }
  };

  useEffect(() => {
    if (deviceType) {
      loadBrands();
      checkDiagnosticService(deviceType);
    } else {
      setBrands([]);
      setModels([]);
    }
  }, [deviceType]);

  const checkDiagnosticService = async (type) => {
    try {
      // Buscar servicio de diagnóstico
      const services = await base44.entities.Product.filter({
        type: 'service',
        category: 'diagnostic',
        active: true
      });

      const typeLower = type.toLowerCase();
      let diagnosticService = null;

      // Lógica de mapeo específica por tipo de dispositivo
      if (typeLower.includes("laptop") || typeLower.includes("desktop") || typeLower.includes("computadora") || typeLower.includes("pc") || typeLower.includes("mac")) {
         diagnosticService = services.find(s => s.name.toLowerCase().includes("computadora") || s.name.toLowerCase().includes("computer"));
      } else if (typeLower.includes("phone") || typeLower.includes("celular") || typeLower.includes("smartphone") || typeLower.includes("iphone")) {
         diagnosticService = services.find(s => s.name.toLowerCase().includes("celular") || s.name.toLowerCase().includes("phone") || s.name.toLowerCase().includes("móvil"));
      } else if (typeLower.includes("tablet") || typeLower.includes("ipad")) {
         diagnosticService = services.find(s => s.name.toLowerCase().includes("tablet"));
      } else if (typeLower.includes("console") || typeLower.includes("consola")) {
         diagnosticService = services.find(s => s.name.toLowerCase().includes("consola") || s.name.toLowerCase().includes("console"));
      }

      // Fallback: Coincidencia general si no se encontró específico
      if (!diagnosticService) {
        diagnosticService = services.find((s) => {
            return (s.device_category && s.device_category.toLowerCase() === typeLower) ||
                   (s.name && s.name.toLowerCase().includes(typeLower));
        });
      }

      if (diagnosticService) {
        // Verificar si ya está añadido
        const exists = orderItems.some((i) => i.id === diagnosticService.id);
        if (!exists) {
          addItemToOrder(diagnosticService, 'service');
          toast.success(`Diagnóstico añadido: ${diagnosticService.name}`);
        }
      }
    } catch (e) {
      console.error("Error checking diagnostic service:", e);
    }
  };

  useEffect(() => {
    if (deviceBrand) loadModels();else
    setModels([]);
  }, [deviceBrand]);

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
      const [allUsers, activePunches] = await Promise.all([
      base44.entities.User.filter({}),
      base44.entities.TimeEntry.filter({}) // Traer todos y filtrar en cliente para asegurar
      ]);

      // Filtrar usuarios ponchados (sin clock_out)
      const clockedInIds = (activePunches || []).
      filter((p) => !p.clock_out).
      map((p) => p.employee_id);

      const techs = (allUsers || []).filter((u) =>
      {
      const role = String(u?.role || "").trim().toLowerCase();
      const name = String(u?.full_name || u?.name || "").trim().toLowerCase();
      const email = String(u?.email || "").trim().toLowerCase();
      const isRestrictedSuperAdmin =
      role === "superadmin" ||
      role === "super admin" ||
      name.includes("super admin") ||
      email.includes("superadmin");

      return !isRestrictedSuperAdmin &&
      (role === "technician" || role === "admin") &&
      clockedInIds.includes(u.id);
      }
      );
      setTechnicians(techs);
    } catch (e) {
      console.error(e);
      setTechnicians([]);
    }
  };

  const loadTypes = async () => {
    try {
      const data = await base44.entities.DeviceCategory.filter({ active: true }, "name");
      setTypes(data || []);
    } catch {
      setTypes([]);
    }
  };

  const loadBrands = async () => {
    try {
      const categories = await base44.entities.DeviceCategory.filter({ name: deviceType, active: true });
      if (categories?.length) {
        const brandsByCategory = await base44.entities.Brand.filter({
          category_id: categories[0].id,
          active: true
        }, "order");
        setBrands(brandsByCategory || []);
      } else {
        setBrands([]);
      }
    } catch {
      setBrands([]);
    }
  };

  const loadModels = async () => {
    try {
      const familiesByBrand = await base44.entities.DeviceFamily.filter({
        brand_id: deviceBrand?.id,
        active: true
      }, "order");
      setModels(familiesByBrand || []);
    } catch {
      setModels([]);
    }
  };

  const searchCustomers = async (query) => {
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
      const filtered = customers.filter((c) => {
        if (isB2B && !c.is_b2b) return false;
        if (!isB2B && c.is_b2b) return false;

        return (
          c.name?.toLowerCase().includes(q) ||
          c.phone?.includes(q) ||
          c.customer_number?.toLowerCase().includes(q) ||
          c.email?.toLowerCase().includes(q) ||
          isB2B && c.company_name?.toLowerCase().includes(q));

      });
      setCustomerResults(filtered.slice(0, 10));
    } catch {
      setCustomerResults([]);
    }
  };

  const selectCustomer = (customer) => {
    setCustomerId(customer.id);

    if (customer.is_b2b) {
      setIsB2B(true);
      setCompanyName(customer.company_name || "");
      setCompanyTaxId(customer.company_tax_id || "");
      setBillingContact(customer.billing_contact_person || "");
      setCustomerPhone(customer.phone || "");
      setCustomerEmail(customer.email || "");
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
      setCompanyName("");
      setCompanyTaxId("");
      setBillingContact("");
    }

    // Cargar contactos adicionales
    setAdditionalContacts(customer.additional_contact_info || []);

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
    const existingIndex = checklist.findIndex((item) => item.id === key);
    if (existingIndex >= 0) {
      setChecklist(checklist.filter((_, idx) => idx !== existingIndex));
    } else {
      setChecklist([...checklist, { id: key, label, status: "not_tested" }]);
    }
  };

  const resetForm = () => {
    setCustomerName("");
    setCustomerLastName("");
    setCustomerPhone("");
    setCustomerEmail("");
    setCustomerId(null);
    setIsB2B(false);
    setCompanyName("");
    setCompanyTaxId("");
    setBillingContact("");
    setAdditionalContacts([]);
    setAssignedTo(null);
    setDeviceType("");
    setDeviceBrand(null);
    setDeviceModel("");
    setDeviceSerial("");
    setDeviceColor("");
    setProblem("");
    setPhotos([]);
    setDevicePin("");
    setDevicePassword("");
    setSecurityPattern(null);
    setChecklist([]);
    setOrderItems([]);
    setAvailableParts([]);
    setCustomerSearchQuery("");
    setCustomerResults([]);
  };

  const handleSubmit = async () => {
    const fullName = isB2B ?
    companyName :
    `${customerName} ${customerLastName}`.trim();

    // Validación
    if (isB2B) {
      if (!companyName || !billingContact || !customerPhone || !customerEmail) {
        toast.error("Completa todos los campos requeridos de empresa");
        return;
      }
    } else {
      if (!customerName || !customerPhone) {
        toast.error("Completa nombre y teléfono del cliente");
        return;
      }
    }

    if (!deviceModel) {
      toast.error("Escribe el modelo del dispositivo");
      return;
    }

    setLoading(true);
    try {
      // 1. Cliente
      let finalCustomerId = customerId;
      const customerData = {
        name: fullName,
        phone: customerPhone,
        email: customerEmail || "",
        additional_contact_info: additionalContacts,
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

      // 2. Fotos
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

      // 3. Seguridad
      let securityData = {
        device_password: devicePassword ? encryptData(devicePassword) : null,
        device_pin: devicePin ? encryptData(devicePin) : null
      };

      if (securityPattern?.path?.length) {
        const patternVector = securityPattern.path.join('-');
        securityData.pattern_vector = `pattern:${patternVector}`;
        securityData.pattern_start = securityPattern.path[0];
        securityData.pattern_end = securityPattern.path[securityPattern.path.length - 1];
        securityData.pattern_length = securityPattern.path.length;
      }

      // 4. Crear orden con número secuencial
      const orderNumber = await generateOrderNumber();
      const orderData = {
        order_number: orderNumber,
        customer_id: finalCustomerId,
        customer_name: fullName,
        customer_phone: customerPhone,
        customer_email: customerEmail || "",
        company_id: isB2B ? finalCustomerId : null,
        company_name: isB2B ? companyName : null,
        device_type: deviceType || "Phone",
        device_brand: typeof deviceBrand === "string" ? deviceBrand : deviceBrand?.name || "",
        device_model: deviceModel,
        device_serial: deviceSerial,
        device_color: deviceColor,
        initial_problem: problem || "",
        photos_metadata: photosMetadata,
        device_security: securityData,
        checklist_items: checklist,
        status: "intake",
        created_by: user?.full_name || user?.email || "System",
        assigned_to: assignedTo?.id || null,
        assigned_to_name: assignedTo?.full_name || "",
        terms_accepted: true,
        order_items: orderItems, // Guardar items seleccionados
        parts_needed: orderItems.map((item) => ({
          id: item.id,
          type: item.type,
          name: item.name,
          quantity: item.quantity,
          price: item.price
        })),
        cost_estimate: orderItems.reduce((sum, item) => sum + item.price * item.quantity, 0),
        comments: []
      };

      const newOrder = await base44.entities.Order.create(orderData);
      upsertLocalOrder(newOrder);

      // 5. Email
      if (customerEmail) {
        try {
          const businessInfo = await getBusinessInfo();
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
          const emailData = createWelcomeEmail({
            orderNumber: newOrder.order_number,
            customerName: customerName,
            deviceInfo: `${deviceBrand?.name || ""} ${deviceModel}`,
            problem: problem || "",
            checklistItems: checklist.map((c) => c.label),
            photoUrls: finalPhotoUrls,
            businessInfo
          });

          await base44.integrations.Core.SendEmail({
            from_name: businessInfo.business_name || "SmartFixOS",
            to: customerEmail,
            subject: emailData.subject,
            body: emailData.body
          });
        } catch (err) {
          console.error("Error sending email:", err);
        }
      }

      // 6. Notificaciones
      try {
        const admins = await base44.entities.User.filter({});
        const eligible = admins.filter((u) => u.role === "admin" || u.role === "manager");

        for (const admin of eligible) {
          await NotificationService.createNotification({
            userId: admin.id,
            userEmail: admin.email,
            type: "new_order",
            title: `Nueva orden #${newOrder.order_number}`,
            body: `${fullName} - ${deviceBrand?.name || ""} ${deviceModel}`,
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
          deviceInfo: `${deviceBrand?.name || ""} ${deviceModel}`.trim(),
          orderId: newOrder.id,
        });
      } catch (err) {
        console.error("Error sending notifications:", err);
      }

      // 7. Eventos
      window.dispatchEvent(new CustomEvent('workorder-created', { detail: { order: newOrder } }));
      window.dispatchEvent(new Event('force-refresh'));

      toast.success("✅ Orden creada exitosamente");
      onSuccess?.(newOrder);
      onClose();
    } catch (err) {
      console.error("Error creating order:", err);
      toast.error("Error al crear la orden: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  if (!open) return null;

  const modalContent = (
    <div
      className="fixed inset-0 z-[9999] bg-black/80 backdrop-blur-md p-3 sm:p-6"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={bodyScrollRef}
        className="mx-auto flex h-full w-full max-w-5xl flex-col overflow-hidden rounded-[28px] border border-white/10 bg-[#050505] shadow-2xl"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-white/10 bg-black/70 px-4 py-4 sm:px-6">
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-500 to-cyan-500 shadow-lg shadow-cyan-500/20">
              <Wrench className="h-6 w-6 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-white sm:text-2xl">Nueva Orden</h1>
              <p className="text-sm text-gray-400">Completa los detalles de reparacion</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="ml-4 flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-white/5 text-white transition-colors hover:bg-white/10"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-4 sm:px-6 sm:py-6">
          <div className="space-y-6">
          
          {/* 📋 CLIENTE - Apple Style */}
          <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-[24px] p-6 space-y-5 shadow-lg">
            <h3 className="text-white font-bold text-sm flex items-center gap-2">
              <User className="w-4 h-4 text-cyan-400" />
              📋 Cliente
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
                !isB2B ?
                "bg-gradient-to-r from-cyan-600 to-emerald-600 border-cyan-400 text-white" :
                "bg-black/20 border-white/10 text-gray-400 hover:bg-white/5"}`
                }>

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
                isB2B ?
                "bg-gradient-to-r from-purple-600 to-pink-600 border-purple-400 text-white" :
                "bg-black/20 border-white/10 text-gray-400 hover:bg-white/5"}`
                }>

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
                className="w-full pl-10 pr-3 py-2 bg-black/30 border border-white/10 rounded-lg text-white text-sm" />

            </div>
            
            {customerResults.length > 0 &&
            <div className="bg-black/80 border border-white/10 rounded-lg max-h-32 overflow-y-auto">
                {customerResults.map((c) =>
              <button
                key={c.id}
                onClick={() => selectCustomer(c)}
                className="w-full text-left px-3 py-2 hover:bg-cyan-600/20 border-b border-white/5 last:border-0 transition-colors">

                    <p className="text-white text-sm font-semibold flex items-center gap-2">
                      {c.is_b2b ? "🏢" : "👤"} {c.name}
                    </p>
                    <p className="text-gray-400 text-xs">{c.phone}</p>
                  </button>
              )}
              </div>
            }

            {/* Campos según tipo */}
            {isB2B ?
            <div className="space-y-3 bg-purple-600/5 border border-purple-500/30 rounded-xl p-3">
                <div>
                  <label className="text-xs text-gray-300 mb-1 block">Empresa *</label>
                  <input
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                  placeholder="Tech Solutions Corp"
                  className="w-full bg-black/40 border border-purple-500/30 rounded-lg px-3 py-2 text-white text-sm" />

                </div>
                <div>
                  <label className="text-xs text-gray-300 mb-1 block">RUT/Tax ID (opcional)</label>
                  <input
                  value={companyTaxId}
                  onChange={(e) => setCompanyTaxId(e.target.value)}
                  placeholder="12-3456789-0"
                  className="w-full bg-black/40 border border-purple-500/30 rounded-lg px-3 py-2 text-white text-sm" />

                </div>
                <div>
                  <label className="text-xs text-gray-300 mb-1 block">Contacto *</label>
                  <input
                  value={billingContact}
                  onChange={(e) => setBillingContact(e.target.value)}
                  placeholder="María López - CFO"
                  className="w-full bg-black/40 border border-purple-500/30 rounded-lg px-3 py-2 text-white text-sm" />

                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-gray-300 mb-1 block">Teléfono *</label>
                    <input
                    value={customerPhone}
                    onChange={(e) => setCustomerPhone(e.target.value)}
                    placeholder="787-555-0123"
                    className="w-full bg-black/40 border border-purple-500/30 rounded-lg px-3 py-2 text-white text-sm" />

                  </div>
                  <div>
                    <label className="text-xs text-gray-300 mb-1 block">Email *</label>
                    <input
                    type="email"
                    value={customerEmail}
                    onChange={(e) => setCustomerEmail(e.target.value)}
                    placeholder="cuentas@empresa.com"
                    className="w-full bg-black/40 border border-purple-500/30 rounded-lg px-3 py-2 text-white text-sm" />

                  </div>
                </div>
              </div> :

            <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-gray-300 mb-1 block">Nombre *</label>
                    <input
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                    placeholder="Juan"
                    className="w-full bg-black/30 border border-white/10 rounded-lg px-3 py-2 text-white text-sm" />

                  </div>
                  <div>
                    <label className="text-xs text-gray-300 mb-1 block">Apellidos</label>
                    <input
                    value={customerLastName}
                    onChange={(e) => setCustomerLastName(e.target.value)}
                    placeholder="Pérez"
                    className="w-full bg-black/30 border border-white/10 rounded-lg px-3 py-2 text-white text-sm" />

                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-gray-300 mb-1 block">Teléfono *</label>
                    <input
                    value={customerPhone}
                    onChange={(e) => setCustomerPhone(e.target.value)}
                    placeholder="787-555-0123"
                    className="w-full bg-black/30 border border-white/10 rounded-lg px-3 py-2 text-white text-sm" />

                  </div>
                  <div>
                    <label className="text-xs text-gray-300 mb-1 block">Email (opcional)</label>
                    <input
                    type="email"
                    value={customerEmail}
                    onChange={(e) => setCustomerEmail(e.target.value)}
                    placeholder="cliente@email.com"
                    className="w-full bg-black/30 border border-white/10 rounded-lg px-3 py-2 text-white text-sm" />

                  </div>
                </div>
              </div>
            }

            {/* Contactos Adicionales */}
            <div className="pt-2 border-t border-white/10">
              <label className="text-xs text-gray-400 mb-2 block">Información Adicional</label>
              {additionalContacts.map((contact, idx) =>
              <div key={idx} className="flex gap-2 mb-2">
                  <select
                  value={contact.type}
                  onChange={(e) => {
                    const newContacts = [...additionalContacts];
                    newContacts[idx].type = e.target.value;
                    setAdditionalContacts(newContacts);
                  }}
                  className="w-24 bg-black/30 border border-white/10 rounded-lg px-2 py-2 text-white text-xs">

                    <option value="phone">Teléfono</option>
                    <option value="email">Email</option>
                    <option value="other">Otro</option>
                  </select>
                  <input
                  value={contact.value}
                  onChange={(e) => {
                    const newContacts = [...additionalContacts];
                    newContacts[idx].value = e.target.value;
                    setAdditionalContacts(newContacts);
                  }}
                  placeholder="Valor"
                  className="flex-1 bg-black/30 border border-white/10 rounded-lg px-3 py-2 text-white text-xs" />

                  <input
                  value={contact.label}
                  onChange={(e) => {
                    const newContacts = [...additionalContacts];
                    newContacts[idx].label = e.target.value;
                    setAdditionalContacts(newContacts);
                  }}
                  placeholder="Etiqueta (ej. Casa)"
                  className="w-24 bg-black/30 border border-white/10 rounded-lg px-3 py-2 text-white text-xs" />

                  <button
                  onClick={() => {
                    setAdditionalContacts(additionalContacts.filter((_, i) => i !== idx));
                  }}
                  className="text-red-400 hover:text-red-300 p-1">

                    <X className="w-4 h-4" />
                  </button>
                </div>
              )}
              <button
                onClick={() => setAdditionalContacts([...additionalContacts, { type: 'phone', value: '', label: '' }])}
                className="text-xs text-cyan-400 hover:text-cyan-300 flex items-center gap-1 mt-1">

                <Plus className="w-3 h-3" /> Agregar contacto/info
              </button>
            </div>
          </div>

          {/* 👤 TÉCNICO */}
          <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-[24px] p-6 space-y-5 shadow-lg">
            <h3 className="text-white font-bold text-sm flex items-center gap-2">
              <Users className="w-4 h-4 text-emerald-400" />
              👤 Técnico (opcional)
            </h3>
            
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => setAssignedTo(null)}
                className={`px-3 py-2 rounded-lg text-xs border transition-all ${
                !assignedTo ?
                "bg-gradient-to-r from-emerald-600 to-green-600 border-emerald-400 text-white" :
                "bg-black/20 border-white/10 text-gray-400 hover:bg-white/5"}`
                }>

                Sin asignar
              </button>
              {technicians.map((tech) =>
              <button
                key={tech.id}
                onClick={() => setAssignedTo(tech)}
                className={`px-3 py-2 rounded-lg text-xs border transition-all flex items-center gap-2 justify-center ${
                assignedTo?.id === tech.id ?
                "bg-gradient-to-r from-emerald-600 to-green-600 border-emerald-400 text-white" :
                "bg-black/20 border-white/10 text-gray-400 hover:bg-white/5"}`
                }>

                  <div className="w-5 h-5 rounded-full bg-cyan-600 flex items-center justify-center text-white text-xs font-bold">
                    {(tech.full_name || tech.email || "?")[0].toUpperCase()}
                  </div>
                  <span className="truncate text-xs">{tech.full_name?.split(' ')[0] || tech.email}</span>
                </button>
              )}
            </div>
          </div>

          {/* 📱 DISPOSITIVO */}
          <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-[24px] p-6 space-y-5 shadow-lg">
            <h3 className="text-white font-bold text-sm flex items-center gap-2">
              <Smartphone className="w-4 h-4 text-purple-400" />
              📱 Dispositivo
            </h3>

            {/* Tipo */}
            {types.length > 0 &&
            <div>
                <label className="text-xs text-gray-300 mb-2 block">Tipo</label>
                <div className="flex flex-wrap gap-2">
                  {types.map((t) =>
                <button
                  key={t.id}
                  onClick={() => {
                    setDeviceType(t.name);
                    setDeviceBrand(null);
                    setDeviceModel("");
                  }}
                  className={`px-3 py-1.5 rounded-lg text-xs border transition-all ${
                  deviceType === t.name ?
                  "bg-gradient-to-r from-purple-600 to-pink-600 border-purple-400 text-white" :
                  "bg-black/20 border-white/10 text-gray-400 hover:bg-white/5"}`
                  }>

                      {t.name}
                    </button>
                )}
                </div>
              </div>
            }

            {/* Marca */}
            {deviceType && brands.length > 0 &&
            <div>
                <label className="text-xs text-gray-300 mb-2 block">Marca</label>
                <div className="flex flex-wrap gap-2">
                  {brands.map((b) =>
                <button
                  key={b.id}
                  onClick={() => {
                    setDeviceBrand(b);
                    setDeviceModel("");
                  }}
                  className={`px-3 py-1.5 rounded-lg text-xs border transition-all ${
                  deviceBrand?.id === b.id ?
                  "bg-gradient-to-r from-purple-600 to-pink-600 border-purple-400 text-white" :
                  "bg-black/20 border-white/10 text-gray-400 hover:bg-white/5"}`
                  }>

                      {b.name}
                    </button>
                )}
                </div>
              </div>
            }

            {/* Modelo */}
            {deviceBrand && models.length > 0 &&
            <div>
                <label className="text-xs text-gray-300 mb-2 block">Modelo (selecciona o escribe)</label>
                <div className="flex flex-wrap gap-2 mb-2">
                  {models.slice(0, 8).map((m) =>
                <button
                  key={m.id}
                  onClick={() => setDeviceModel(m.name)}
                  className={`px-3 py-1.5 rounded-lg text-xs border transition-all ${
                  deviceModel === m.name ?
                  "bg-gradient-to-r from-purple-600 to-pink-600 border-purple-400 text-white" :
                  "bg-black/20 border-white/10 text-gray-400 hover:bg-white/5"}`
                  }>

                      {m.name}
                    </button>
                )}
                </div>
              </div>
            }

            <div>
              <label className="text-xs text-gray-300 mb-1 block">Modelo *</label>
              <input
                value={deviceModel}
                onChange={(e) => setDeviceModel(e.target.value)}
                placeholder="iPhone 12 Pro, Galaxy S23..."
                className="w-full bg-black/30 border border-white/10 rounded-lg px-3 py-2 text-white text-sm" />

            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-gray-300 mb-1 block">Color</label>
                <input
                  value={deviceColor}
                  onChange={(e) => setDeviceColor(e.target.value)}
                  placeholder="Negro, Azul..."
                  className="w-full bg-black/30 border border-white/10 rounded-lg px-3 py-2 text-white text-sm" />

              </div>
              <div>
                <label className="text-xs text-gray-300 mb-1 block">IMEI/Serie</label>
                <input
                  value={deviceSerial}
                  onChange={(e) => setDeviceSerial(e.target.value)}
                  placeholder="Opcional"
                  className="w-full bg-black/30 border border-white/10 rounded-lg px-3 py-2 text-white text-sm" />

              </div>
            </div>
          </div>

          {/* 🔧 PROBLEMA */}
          <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-[24px] p-6 space-y-5 shadow-lg">
            <h3 className="text-white font-bold text-sm flex items-center gap-2">
              <Wrench className="w-4 h-4 text-orange-400" />
              🔧 Problema
            </h3>
            
            <textarea
              value={problem}
              onChange={(e) => setProblem(e.target.value)}
              placeholder="Describe el problema..."
              className="w-full bg-black/30 border border-white/10 rounded-lg px-3 py-2 text-white text-sm min-h-[80px]" />

          </div>

          {/* 🔐 SEGURIDAD */}
          <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-[24px] p-6 space-y-5 shadow-lg">
            <h3 className="text-white font-bold text-sm flex items-center gap-2">
              <Shield className="w-4 h-4 text-blue-400" />
              🔐 Seguridad (opcional)
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="relative">
                <label className="text-xs text-gray-300 mb-1 block">PIN</label>
                <input
                  value={devicePin}
                  onChange={(e) => setDevicePin(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  type={showPin ? "text" : "password"}
                  inputMode="numeric"
                  maxLength={6}
                  placeholder="123456"
                  className="w-full bg-black/30 border border-white/10 rounded-lg px-3 py-2 pr-10 text-white text-sm" />

                <button
                  type="button"
                  onClick={() => setShowPin(!showPin)}
                  className="absolute right-2 top-8 text-gray-400 hover:text-white">

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
                  className="w-full bg-black/30 border border-white/10 rounded-lg px-3 py-2 pr-10 text-white text-sm" />

                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-2 top-8 text-gray-400 hover:text-white">

                  <Eye className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div>
              <Popover open={patternModalOpen} onOpenChange={setPatternModalOpen}>
                <PopoverTrigger asChild>
                  <Button
                    type="button"
                    variant="outline"
                    className="bg-black/30 text-white px-4 py-2 text-sm font-medium rounded-xl inline-flex items-center justify-center gap-2 whitespace-nowrap transition-colors border border-white/10 hover:bg-white/10 hover:text-white h-10 w-full backdrop-blur-md">

                    <Grid3X3 className="w-4 h-4 mr-2 text-cyan-400" />
                    {securityPattern?.path?.length ? `✓ Patrón (${securityPattern.path.length} puntos)` : "Capturar Patrón Android"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-80 p-0 bg-transparent border-none shadow-none" side="top" align="center">
                  <div className="bg-[#0f172a]/95 backdrop-blur-xl border border-cyan-500/30 rounded-2xl p-5 shadow-2xl">
                    <h4 className="text-white font-bold mb-4 text-center text-sm flex items-center justify-center gap-2">
                      <Lock className="w-4 h-4 text-cyan-400" />
                      Dibujar Patrón
                    </h4>
                    <PatternCanvas
                      onSave={(path) => {
                        setSecurityPattern({ path });
                        setPatternModalOpen(false);
                      }}
                      onCancel={() => setPatternModalOpen(false)} />

                  </div>
                </PopoverContent>
              </Popover>
            </div>
          </div>

          {/* ✅ CHECKLIST */}
          <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-[24px] p-6 space-y-5 shadow-lg">
            <h3 className="text-white font-bold text-sm flex items-center gap-2">
              <CheckSquare className="w-4 h-4 text-green-400" />
              ✅ Checklist (opcional)
            </h3>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {CHECKLIST_ITEMS.map((item) => {
                const isSelected = checklist.some((c) => c.id === item.key);
                return (
                  <button
                    key={item.key}
                    onClick={() => toggleChecklistItem(item.key, item.label)}
                    className={`px-3 py-2 rounded-lg text-xs border transition-all text-left ${
                    isSelected ?
                    "bg-gradient-to-r from-green-600 to-emerald-600 border-green-400 text-white" :
                    "bg-black/20 border-white/10 text-gray-400 hover:bg-white/5"}`
                    }>

                    <div className="flex items-center gap-2">
                      <span>{item.icon}</span>
                      <span className="flex-1">{item.label}</span>
                    </div>
                  </button>);

              })}
            </div>
            
            {checklist.length > 0 &&
            <div className="bg-green-600/10 border border-green-500/30 rounded-lg p-2 text-center">
                <p className="text-xs text-green-300">
                  ✓ {checklist.length} condición{checklist.length !== 1 ? 'es' : ''} marcada{checklist.length !== 1 ? 's' : ''}
                </p>
              </div>
            }
          </div>

          {/* 📸 FOTOS */}
          <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-[24px] p-6 space-y-5 shadow-lg">
            <h3 className="text-white font-bold text-sm flex items-center gap-2">
              <Camera className="w-4 h-4 text-pink-400" />
              📸 Fotos (opcional)
            </h3>

            <input
              ref={cameraInputRef}
              type="file"
              accept="image/*,video/*"
              capture="environment"
              multiple
              className="hidden"
              onChange={(e) => addPhotos(e.target.files)} />

            <input
              ref={fileInputRef}
              type="file"
              accept="image/*,video/*"
              multiple
              className="hidden"
              onChange={(e) => addPhotos(e.target.files)} />


            <div className="flex gap-2">
              <Button
                type="button"
                onClick={() => cameraInputRef.current?.click()}
                className="flex-1 bg-gradient-to-r from-pink-600 to-rose-600 text-sm h-9">

                <Camera className="w-4 h-4 mr-2" />
                Foto
              </Button>
              <Button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                variant="outline" className="bg-background text-stone-950 px-4 py-2 text-sm font-medium rounded-md inline-flex items-center justify-center gap-2 whitespace-nowrap transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 border shadow-sm hover:bg-accent hover:text-accent-foreground flex-1 border-white/20 h-9">


                📁 Subir
              </Button>
            </div>

            {photos.length > 0 &&
            <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                {photos.map((file, idx) =>
              <div key={idx} className="relative">
                    <img
                  src={URL.createObjectURL(file)}
                  alt={`foto-${idx}`}
                  className="w-full h-20 object-cover rounded-lg" />

                    <button
                  onClick={() => removePhoto(idx)}
                  className="absolute -top-1 -right-1 w-5 h-5 bg-red-600 rounded-full flex items-center justify-center">

                      <X className="w-3 h-3 text-white" />
                    </button>
                  </div>
              )}
              </div>
            }
          </div>

          {/* 📦 PIEZAS Y SERVICIOS */}
          <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-[24px] p-6 space-y-5 shadow-lg">
            <div className="flex items-center justify-between">
              <h3 className="text-white font-bold text-sm flex items-center gap-2">
                <Package className="w-4 h-4 text-purple-400" />
                📦 Piezas y Servicios
              </h3>
              <Button
                size="icon"
                variant="outline"
                onClick={() => setShowServiceSelector(true)}
                className="h-8 w-8 rounded-full border-purple-500/50 text-purple-400 hover:bg-purple-500/20 hover:text-white transition-all shadow-[0_0_10px_rgba(168,85,247,0.2)]">

                <Plus className="w-5 h-5" />
              </Button>
            </div>

            {orderItems.length > 0 &&
            <div className="space-y-2 mb-3">
                {orderItems.map((item, idx) =>
              <div key={idx} className="flex items-center justify-between bg-white/5 border border-white/10 rounded-lg p-2">
                    <div>
                      <p className="text-white text-sm font-medium">{item.name}</p>
                      <div className="flex items-center gap-2 text-xs text-gray-400">
                        <span>${Number(item.price).toFixed(2)}</span>
                        {item.type === 'product' && <span className="text-emerald-400">• Stock</span>}
                      </div>
                    </div>
                    <button onClick={() => removeItemFromOrder(idx)} className="text-red-400 hover:text-red-300 p-1">
                      <X className="w-4 h-4" />
                    </button>
                  </div>
              )}
                
                <div className="pt-3 border-t border-white/10 space-y-1">
                  <div className="flex justify-between text-xs text-gray-400">
                    <span>Subtotal</span>
                    <span>${orderItems.reduce((sum, item) => sum + Number(item.price), 0).toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-xs text-gray-400">
                    <span>IVU ({(taxRate * 100).toFixed(1)}%)</span>
                    <span>${(orderItems.reduce((sum, item) => sum + (item.taxable !== false ? Number(item.price) : 0), 0) * taxRate).toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-sm font-bold text-green-400 pt-1">
                    <span>Total Estimado</span>
                    <span>${orderItems.reduce((sum, item) => {
                      const price = Number(item.price);
                      const tax = item.taxable !== false ? price * taxRate : 0;
                      return sum + price + tax;
                    }, 0).toFixed(2)}</span>
                  </div>
                </div>
              </div>
            }

            {/* Servicios comunes */}
            <div className="mb-2">
              <p className="text-xs text-gray-400 mb-2">Servicios comunes:</p>
              <div className="flex flex-wrap gap-2">
                {availableServices.slice(0, 6).map((service) =>
                <button
                  key={service.id}
                  onClick={() => addItemToOrder(service, 'service')}
                  className="px-3 py-1.5 bg-black/30 hover:bg-blue-600/20 border border-white/10 hover:border-blue-500/30 rounded-lg text-xs text-white transition-all flex items-center gap-2">

                    <span>{service.name}</span>
                    <span className="text-blue-300">${service.price}</span>
                    <Plus className="w-3 h-3" />
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="border-t border-white/10 bg-black/80 px-4 py-4 sm:px-6">
          <div className="mx-auto flex max-w-5xl gap-4">
            <Button
              onClick={onClose}
              variant="outline"
              className="flex-1 h-12 rounded-2xl bg-white/5 border-white/10 hover:bg-white/10 text-white"
              disabled={loading}
            >
              Cancelar
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={
                loading ||
                (!isB2B && (!customerName || !customerPhone)) ||
                (isB2B && (!companyName || !billingContact || !customerPhone || !customerEmail)) ||
                !deviceModel
              }
              className="flex-[2] h-12 rounded-2xl bg-gradient-to-r from-blue-600 to-cyan-500 text-white font-bold shadow-lg shadow-cyan-500/20 hover:from-blue-500 hover:to-cyan-400"
            >
              {loading ? (
                <>
                  <Loader2 className="w-6 h-6 mr-3 animate-spin" />
                  Procesando...
                </>
              ) : (
                <>
                  <Save className="w-6 h-6 mr-3" />
                  Crear Orden
                  {customerEmail && <Mail className="w-5 h-5 ml-2 opacity-70" />}
                </>
              )}
            </Button>
          </div>
        </div>
      </div>

      <ServiceSelectorModal
        open={showServiceSelector}
        onClose={() => setShowServiceSelector(false)}
        onSelect={handleServiceSelect}
        deviceModel={deviceModel}
        deviceCategory={deviceType}
      />
    </div>
  );

  if (typeof document === "undefined" || !document.body) return modalContent;
  return createPortal(modalContent, document.body);
}

// === PATTERN CANVAS COMPONENT (Inline) ===
function PatternCanvas({ onSave, onCancel }) {
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

    // Grid 3x3
    for (let i = 0; i < 3; i++) {
      for (let j = 0; j < 3; j++) {
        const x = cellSize * j + cellSize / 2;
        const y = cellSize * i + cellSize / 2;
        const idx = i * 3 + j;

        ctx.beginPath();
        ctx.arc(x, y, 10, 0, 2 * Math.PI);
        ctx.fillStyle = currentPattern.includes(idx) ? '#06b6d4' : '#475569';
        ctx.fill();

        // Inner dot
        if (currentPattern.includes(idx)) {
          ctx.beginPath();
          ctx.arc(x, y, 4, 0, 2 * Math.PI);
          ctx.fillStyle = '#ffffff';
          ctx.fill();
        }
      }
    }

    // Líneas
    if (currentPattern.length > 1) {
      ctx.strokeStyle = '#06b6d4'; // Cyan-500
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

        if (i === 0) ctx.moveTo(x, y);else
        ctx.lineTo(x, y);
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
            setPattern((prev) => [...prev, idx]);
          }
          return;
        }
      }
    }
  };

  const handleSave = () => {
    if (pattern.length < 4) {
      toast.error("Conecta al menos 4 puntos");
      return;
    }
    onSave(pattern);
  };

  return (
    <div className="flex flex-col items-center gap-4">
      <div className="w-full aspect-square bg-black/50 rounded-xl border border-white/10 p-3 shadow-inner" style={{ touchAction: 'none' }}>
        <canvas
          ref={canvasRef}
          onMouseDown={() => setDrawing(true)}
          onMouseUp={() => setDrawing(false)}
          onMouseMove={(e) => drawing && handleCanvasInteraction(e)}
          onTouchStart={() => setDrawing(true)}
          onTouchEnd={() => setDrawing(false)}
          onTouchMove={(e) => drawing && handleCanvasInteraction(e)}
          className="w-full h-full cursor-crosshair touch-none" />

      </div>

      <div className="flex gap-2 w-full">
        <Button
          size="sm"
          onClick={() => setPattern([])}
          variant="outline" className="bg-slate-50 text-slate-900 px-3 text-xs font-medium rounded-md inline-flex items-center justify-center gap-2 whitespace-nowrap transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 border shadow-sm hover:bg-accent border-white/10 h-8 hover:text-white">


          Limpiar
        </Button>
        <Button
          size="sm"
          onClick={handleSave}
          disabled={pattern.length < 4}
          className="flex-1 bg-cyan-600 hover:bg-cyan-500 text-white text-xs h-8 font-bold">

          Guardar
        </Button>
      </div>
    </div>);

}
