import React, { useState, useEffect, useRef } from "react";
import { base44 } from "@/api/base44Client";
import UniversalPrintDialog from "../printing/UniversalPrintDialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { 
  X, Loader2, Check, User, Phone, Mail, Smartphone, 
  Search, Users, Wrench, Camera, Save, Shield, CheckSquare,
  Eye, Grid3X3, Plus, Building2, Package
} from "lucide-react";
import { toast } from "sonner";
import { createWelcomeEmail, getBusinessInfo } from "@/components/utils/emailTemplates";
import NotificationService from "../notifications/NotificationService";
import ServiceSelectorModal from "@/components/common/ServiceSelectorModal";

const encryptData = (data) => {
  try {
    return btoa(String(data));
  } catch {
    return String(data);
  }
};

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
  { key: "water_damage", label: "Daño por líquido", icon: "💧", category: "Físico" }
];

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
      const parts = allProducts.filter(p => {
        const nameMatch = p.name.toLowerCase().includes(q);
        const compatMatch = p.compatibility_models?.some(m => m.toLowerCase().includes(q));
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
      quantity: 1
    };
    setOrderItems(prev => [...prev, newItem]);
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
      // Buscar servicio de diagnóstico para este tipo de dispositivo
      // Buscamos productos que sean tipo 'service' y categoría 'diagnostic'
      // Y que coincidan con la categoría del dispositivo
      const services = await base44.entities.Product.filter({ 
        type: 'service',
        category: 'diagnostic',
        active: true
      });
      
      const typeLower = type.toLowerCase();
      const diagnosticService = services.find(s => {
        // Coincidencia laxa con nombre o categoría de dispositivo
        return (s.device_category && s.device_category.toLowerCase() === typeLower) ||
               (s.name && s.name.toLowerCase().includes(typeLower));
      });

      if (diagnosticService) {
        // Verificar si ya está añadido
        const exists = orderItems.some(i => i.id === diagnosticService.id);
        if (!exists) {
          addItemToOrder(diagnosticService, 'service');
          toast.success(`Servicio de diagnóstico añadido: ${diagnosticService.name}`);
        }
      }
    } catch (e) {
      console.error("Error checking diagnostic service:", e);
    }
  };

  useEffect(() => {
    if (deviceBrand) loadModels();
    else setModels([]);
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
        base44.entities.TimeEntry.filter({ }) // Traer todos y filtrar en cliente para asegurar
      ]);

      // Filtrar usuarios ponchados (sin clock_out)
      const clockedInIds = (activePunches || [])
        .filter(p => !p.clock_out)
        .map(p => p.employee_id);

      const techs = (allUsers || []).filter(u => 
        (u.role === "technician" || u.role === "admin" || u.role === "superadmin") &&
        clockedInIds.includes(u.id)
      );
      setTechnicians(techs);
    } catch (e) {
      console.error(e);
      setTechnicians([]);
    }
  };

  const loadTypes = async () => {
    try {
      const data = await base44.entities.DeviceCategory.filter({active: true}, "name");
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
    if (!query || query.length < 2) {
      setCustomerResults([]);
      return;
    }
    
    try {
      const customers = await base44.entities.Customer.list("-updated_date", 100);
      const q = query.toLowerCase();
      const filtered = customers.filter(c => {
        if (isB2B && !c.is_b2b) return false;
        if (!isB2B && c.is_b2b) return false;
        
        return (
          c.name?.toLowerCase().includes(q) ||
          c.phone?.includes(q) ||
          c.email?.toLowerCase().includes(q) ||
          (isB2B && c.company_name?.toLowerCase().includes(q))
        );
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
    const existingIndex = checklist.findIndex(item => item.id === key);
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
    const fullName = isB2B 
      ? companyName 
      : `${customerName} ${customerLastName}`.trim();
    
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
        is_b2b: isB2B,
        company_name: isB2B ? companyName : "",
        company_tax_id: isB2B ? companyTaxId : "",
        billing_contact_person: isB2B ? billingContact : ""
      };
      
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
          finalCustomerId = newCustomer.id;
        }
      } else {
        const c = await base44.entities.Customer.get(finalCustomerId);
        await base44.entities.Customer.update(finalCustomerId, {
          ...customerData,
          total_orders: (c.total_orders || 0) + 1
        });
      }

      // 2. Fotos
      const photosMetadata = [];
      const photoUrls = [];
      for (const file of photos) {
        try {
          const uploadResult = await base44.integrations.Core.UploadFile({ file });
          const url = `${uploadResult.file_url}?v=${Date.now()}`;
          photosMetadata.push({
            id: `${Date.now()}-${file.name}`,
            type: file.type?.startsWith("video") ? "video" : "image",
            mime: file.type || "image/jpeg",
            filename: file.name,
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

      // 4. Crear orden
      const orderNumber = `WO-${Date.now().toString().slice(-8)}`;
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
        parts_needed: orderItems.map(item => ({
          id: item.id,
          type: item.type,
          name: item.name,
          quantity: item.quantity,
          price: item.price
        })),
        cost_estimate: orderItems.reduce((sum, item) => sum + (item.price * item.quantity), 0),
        comments: []
      };

      const newOrder = await base44.entities.Order.create(orderData);

      // 5. Email
      if (customerEmail) {
        try {
          const businessInfo = await getBusinessInfo();
          const emailData = createWelcomeEmail({
            orderNumber: newOrder.order_number,
            customerName: customerName,
            deviceInfo: `${deviceBrand?.name || ""} ${deviceModel}`,
            problem: problem || "",
            checklistItems: checklist.map(c => c.label),
            photoUrls,
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
        const eligible = admins.filter(u => u.role === "admin" || u.role === "manager");
        
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

  return (
    <div className="fixed inset-0 z-50 pt-20 bg-[radial-gradient(circle_at_top,#0f172a_0%,#020617_45%,#000_90%)] overflow-y-auto">
      <div className="min-h-screen p-3 sm:p-6 max-w-5xl mx-auto">
        
        {/* Header */}
        <div className="bg-gradient-to-br from-cyan-600/10 to-emerald-600/10 backdrop-blur-xl border border-cyan-500/20 rounded-2xl p-4 sm:p-6 mb-4 shadow-[0_8px_32px_rgba(0,168,232,0.3)]">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3 sm:gap-4">
              <div className="w-12 h-12 sm:w-16 sm:h-16 rounded-2xl bg-gradient-to-br from-cyan-600 to-emerald-600 flex items-center justify-center shadow-lg">
                <Wrench className="w-6 h-6 sm:w-8 sm:h-8 text-white" />
              </div>
              <div>
                <h1 className="text-xl sm:text-3xl font-bold text-white">⚡ Orden Completa</h1>
                <p className="text-xs sm:text-sm text-cyan-200/80">Toda la información en una página</p>
              </div>
            </div>
            <button 
              onClick={onClose} 
              className="w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors"
            >
              <X className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="space-y-4">
          
          {/* 📋 CLIENTE */}
          <div className="bg-black/40 border border-cyan-500/20 rounded-xl p-3 sm:p-4 space-y-3">
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
                    className="w-full text-left px-3 py-2 hover:bg-cyan-600/20 border-b border-white/5 last:border-0 transition-colors"
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
              </div>
            )}
          </div>

          {/* 👤 TÉCNICO */}
          <div className="bg-black/40 border border-emerald-500/20 rounded-xl p-3 sm:p-4 space-y-3">
            <h3 className="text-white font-bold text-sm flex items-center gap-2">
              <Users className="w-4 h-4 text-emerald-400" />
              👤 Técnico (opcional)
            </h3>
            
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => setAssignedTo(null)}
                className={`px-3 py-2 rounded-lg text-xs border transition-all ${
                  !assignedTo 
                    ? "bg-gradient-to-r from-emerald-600 to-green-600 border-emerald-400 text-white"
                    : "bg-black/20 border-white/10 text-gray-400 hover:bg-white/5"
                }`}
              >
                Sin asignar
              </button>
              {technicians.map(tech => (
                <button
                  key={tech.id}
                  onClick={() => setAssignedTo(tech)}
                  className={`px-3 py-2 rounded-lg text-xs border transition-all flex items-center gap-2 justify-center ${
                    assignedTo?.id === tech.id
                      ? "bg-gradient-to-r from-emerald-600 to-green-600 border-emerald-400 text-white"
                      : "bg-black/20 border-white/10 text-gray-400 hover:bg-white/5"
                  }`}
                >
                  <div className="w-5 h-5 rounded-full bg-cyan-600 flex items-center justify-center text-white text-xs font-bold">
                    {(tech.full_name || tech.email || "?")[0].toUpperCase()}
                  </div>
                  <span className="truncate text-xs">{tech.full_name?.split(' ')[0] || tech.email}</span>
                </button>
              ))}
            </div>
          </div>

          {/* 📱 DISPOSITIVO */}
          <div className="bg-black/40 border border-purple-500/20 rounded-xl p-3 sm:p-4 space-y-3">
            <h3 className="text-white font-bold text-sm flex items-center gap-2">
              <Smartphone className="w-4 h-4 text-purple-400" />
              📱 Dispositivo
            </h3>

            {/* Tipo */}
            {types.length > 0 && (
              <div>
                <label className="text-xs text-gray-300 mb-2 block">Tipo</label>
                <div className="flex flex-wrap gap-2">
                  {types.map(t => (
                    <button
                      key={t.id}
                      onClick={() => {
                        setDeviceType(t.name);
                        setDeviceBrand(null);
                        setDeviceModel("");
                      }}
                      className={`px-3 py-1.5 rounded-lg text-xs border transition-all ${
                        deviceType === t.name
                          ? "bg-gradient-to-r from-purple-600 to-pink-600 border-purple-400 text-white"
                          : "bg-black/20 border-white/10 text-gray-400 hover:bg-white/5"
                      }`}
                    >
                      {t.name}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Marca */}
            {deviceType && brands.length > 0 && (
              <div>
                <label className="text-xs text-gray-300 mb-2 block">Marca</label>
                <div className="flex flex-wrap gap-2">
                  {brands.map(b => (
                    <button
                      key={b.id}
                      onClick={() => {
                        setDeviceBrand(b);
                        setDeviceModel("");
                      }}
                      className={`px-3 py-1.5 rounded-lg text-xs border transition-all ${
                        deviceBrand?.id === b.id
                          ? "bg-gradient-to-r from-purple-600 to-pink-600 border-purple-400 text-white"
                          : "bg-black/20 border-white/10 text-gray-400 hover:bg-white/5"
                      }`}
                    >
                      {b.name}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Modelo */}
            {deviceBrand && models.length > 0 && (
              <div>
                <label className="text-xs text-gray-300 mb-2 block">Modelo (selecciona o escribe)</label>
                <div className="flex flex-wrap gap-2 mb-2">
                  {models.slice(0, 8).map(m => (
                    <button
                      key={m.id}
                      onClick={() => setDeviceModel(m.name)}
                      className={`px-3 py-1.5 rounded-lg text-xs border transition-all ${
                        deviceModel === m.name
                          ? "bg-gradient-to-r from-purple-600 to-pink-600 border-purple-400 text-white"
                          : "bg-black/20 border-white/10 text-gray-400 hover:bg-white/5"
                      }`}
                    >
                      {m.name}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div>
              <label className="text-xs text-gray-300 mb-1 block">Modelo *</label>
              <input
                value={deviceModel}
                onChange={(e) => setDeviceModel(e.target.value)}
                placeholder="iPhone 12 Pro, Galaxy S23..."
                className="w-full bg-black/30 border border-white/10 rounded-lg px-3 py-2 text-white text-sm"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-gray-300 mb-1 block">Color</label>
                <input
                  value={deviceColor}
                  onChange={(e) => setDeviceColor(e.target.value)}
                  placeholder="Negro, Azul..."
                  className="w-full bg-black/30 border border-white/10 rounded-lg px-3 py-2 text-white text-sm"
                />
              </div>
              <div>
                <label className="text-xs text-gray-300 mb-1 block">IMEI/Serie</label>
                <input
                  value={deviceSerial}
                  onChange={(e) => setDeviceSerial(e.target.value)}
                  placeholder="Opcional"
                  className="w-full bg-black/30 border border-white/10 rounded-lg px-3 py-2 text-white text-sm"
                />
              </div>
            </div>
          </div>

          {/* 🔧 PROBLEMA */}
          <div className="bg-black/40 border border-orange-500/20 rounded-xl p-3 sm:p-4 space-y-3">
            <h3 className="text-white font-bold text-sm flex items-center gap-2">
              <Wrench className="w-4 h-4 text-orange-400" />
              🔧 Problema
            </h3>
            
            <textarea
              value={problem}
              onChange={(e) => setProblem(e.target.value)}
              placeholder="Describe el problema..."
              className="w-full bg-black/30 border border-white/10 rounded-lg px-3 py-2 text-white text-sm min-h-[80px]"
            />
          </div>

          {/* 🔐 SEGURIDAD */}
          <div className="bg-black/40 border border-blue-500/20 rounded-xl p-3 sm:p-4 space-y-3">
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

            <div>
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
          </div>

          {/* ✅ CHECKLIST */}
          <div className="bg-black/40 border border-green-500/20 rounded-xl p-3 sm:p-4 space-y-3">
            <h3 className="text-white font-bold text-sm flex items-center gap-2">
              <CheckSquare className="w-4 h-4 text-green-400" />
              ✅ Checklist (opcional)
            </h3>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {CHECKLIST_ITEMS.map(item => {
                const isSelected = checklist.some(c => c.id === item.key);
                return (
                  <button
                    key={item.key}
                    onClick={() => toggleChecklistItem(item.key, item.label)}
                    className={`px-3 py-2 rounded-lg text-xs border transition-all text-left ${
                      isSelected
                        ? "bg-gradient-to-r from-green-600 to-emerald-600 border-green-400 text-white"
                        : "bg-black/20 border-white/10 text-gray-400 hover:bg-white/5"
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <span>{item.icon}</span>
                      <span className="flex-1">{item.label}</span>
                    </div>
                  </button>
                );
              })}
            </div>
            
            {checklist.length > 0 && (
              <div className="bg-green-600/10 border border-green-500/30 rounded-lg p-2 text-center">
                <p className="text-xs text-green-300">
                  ✓ {checklist.length} condición{checklist.length !== 1 ? 'es' : ''} marcada{checklist.length !== 1 ? 's' : ''}
                </p>
              </div>
            )}
          </div>

          {/* 📸 FOTOS */}
          <div className="bg-black/40 border border-pink-500/20 rounded-xl p-3 sm:p-4 space-y-3">
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
                className="flex-1 bg-gradient-to-r from-pink-600 to-rose-600 text-sm h-9"
              >
                <Camera className="w-4 h-4 mr-2" />
                Foto
              </Button>
              <Button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                variant="outline"
                className="flex-1 border-white/20 text-gray-300 text-sm h-9"
              >
                📁 Subir
              </Button>
            </div>

            {photos.length > 0 && (
              <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                {photos.map((file, idx) => (
                  <div key={idx} className="relative">
                    <img
                      src={URL.createObjectURL(file)}
                      alt={`foto-${idx}`}
                      className="w-full h-20 object-cover rounded-lg"
                    />
                    <button
                      onClick={() => removePhoto(idx)}
                      className="absolute -top-1 -right-1 w-5 h-5 bg-red-600 rounded-full flex items-center justify-center"
                    >
                      <X className="w-3 h-3 text-white" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* 📦 PIEZAS Y SERVICIOS */}
          <div className="bg-black/40 border border-purple-500/20 rounded-xl p-3 sm:p-4 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-white font-bold text-sm flex items-center gap-2">
                <Package className="w-4 h-4 text-purple-400" />
                📦 Piezas y Servicios
              </h3>
              <Button
                size="icon"
                variant="outline"
                onClick={() => setShowServiceSelector(true)}
                className="h-8 w-8 rounded-full border-purple-500/50 text-purple-400 hover:bg-purple-500/20 hover:text-white transition-all shadow-[0_0_10px_rgba(168,85,247,0.2)]"
              >
                <Plus className="w-5 h-5" />
              </Button>
            </div>

            {orderItems.length > 0 && (
              <div className="space-y-2 mb-3">
                {orderItems.map((item, idx) => (
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
                ))}
                
                <div className="pt-3 border-t border-white/10 space-y-1">
                  <div className="flex justify-between text-xs text-gray-400">
                    <span>Subtotal</span>
                    <span>${orderItems.reduce((sum, item) => sum + Number(item.price), 0).toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-xs text-gray-400">
                    <span>IVU ({(taxRate * 100).toFixed(1)}%)</span>
                    <span>${(orderItems.reduce((sum, item) => sum + Number(item.price), 0) * taxRate).toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-sm font-bold text-green-400 pt-1">
                    <span>Total Estimado</span>
                    <span>${(orderItems.reduce((sum, item) => sum + Number(item.price), 0) * (1 + taxRate)).toFixed(2)}</span>
                  </div>
                </div>
              </div>
            )}

            {/* Servicios comunes */}
            <div className="mb-2">
              <p className="text-xs text-gray-400 mb-2">Servicios comunes:</p>
              <div className="flex flex-wrap gap-2">
                {availableServices.slice(0, 6).map(service => (
                  <button
                    key={service.id}
                    onClick={() => addItemToOrder(service, 'service')}
                    className="px-3 py-1.5 bg-black/30 hover:bg-blue-600/20 border border-white/10 hover:border-blue-500/30 rounded-lg text-xs text-white transition-all flex items-center gap-2"
                  >
                    <span>{service.name}</span>
                    <span className="text-blue-300">${service.price}</span>
                    <Plus className="w-3 h-3" />
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Footer Sticky */}
        <div className="sticky bottom-0 bg-black/60 backdrop-blur-xl border-t border-white/10 p-4 sm:p-6 mt-6">
          <div className="flex gap-3">
            <Button
              onClick={onClose}
              variant="outline"
              className="flex-1 border-white/20 text-gray-300 h-12 sm:h-14 text-base"
              disabled={loading}
            >
              Cancelar
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={loading || (!isB2B && (!customerName || !customerPhone)) || (isB2B && (!companyName || !billingContact || !customerPhone || !customerEmail)) || !deviceModel}
              className="flex-1 bg-gradient-to-r from-cyan-600 to-emerald-600 hover:from-cyan-700 hover:to-emerald-700 h-12 sm:h-14 text-base font-bold shadow-lg"
            >
              {loading ? (
                <>
                  <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                  Creando...
                </>
              ) : (
                <>
                  <Save className="w-5 h-5 mr-2" />
                  Crear Orden
                  {customerEmail && <Mail className="w-5 h-5 ml-2" />}
                </>
              )}
            </Button>
          </div>
        </div>
      </div>

      {/* Modal de patrón */}
      {patternModalOpen && (
        <PatternModal
          onClose={() => setPatternModalOpen(false)}
          onSave={(path) => {
            setSecurityPattern({ path });
            setPatternModalOpen(false);
          }}
        />
      )}

      {/* Selector de Servicios */}
      <ServiceSelectorModal
        open={showServiceSelector}
        onClose={() => setShowServiceSelector(false)}
        onSelect={handleServiceSelect}
      />
    </div>
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

    // Grid 3x3
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

    // Líneas
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
        <h4 className="text-white font-bold mb-4 text-lg">Patrón de Desbloqueo</h4>
        
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
