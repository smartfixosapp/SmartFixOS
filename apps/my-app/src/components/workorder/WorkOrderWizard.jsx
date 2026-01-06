// === WorkOrderWizard.jsx — VERSIÓN PÁGINA ÚNICA (Mobile Optimized) ===
import React, { useState, useEffect, useRef, useMemo } from "react";
import { base44 } from "@/api/base44Client";
import NotificationService from "../notifications/NotificationService";
import { createWelcomeEmail, getBusinessInfo } from "@/components/utils/emailTemplates";
import {
  User, Smartphone, Wrench, Shield, CheckSquare, Plus,
  X, Mail, Loader2, Camera, Check, Search, Eye, Grid3X3, Users, Save
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Dialog, DialogContent } from "@/components/ui/dialog";

const CHECKLIST_ITEMS = [
  { key: "screen_broken", label: "Pantalla rota / rajada", icon: "💔", category: "Pantalla" },
  { key: "screen_no_image", label: "Pantalla sin imagen", icon: "📺", category: "Pantalla" },
  { key: "screen_lines", label: "Líneas en pantalla", icon: "📉", category: "Pantalla" },
  { key: "touch_not_working", label: "Touch no responde", icon: "👆", category: "Touch" },
  { key: "touch_ghost", label: "Touch fantasma", icon: "👻", category: "Touch" },
  { key: "battery_drains", label: "Batería se descarga rápido", icon: "🔋", category: "Batería" },
  { key: "battery_no_charge", label: "No carga", icon: "⚠️", category: "Batería" },
  { key: "battery_swollen", label: "Batería inflada", icon: "🎈", category: "Batería" },
  { key: "port_damaged", label: "Puerto dañado", icon: "🔌", category: "Carga" },
  { key: "port_dirty", label: "Puerto sucio", icon: "🧹", category: "Carga" },
  { key: "no_power", label: "No enciende", icon: "⚫", category: "Encendido" },
  { key: "random_shutdown", label: "Se apaga solo", icon: "🔄", category: "Encendido" },
  { key: "boot_loop", label: "Bootloop", icon: "🔁", category: "Encendido" },
  { key: "no_sound", label: "Sin sonido", icon: "🔇", category: "Audio" },
  { key: "mic_not_working", label: "Micrófono no funciona", icon: "🎤", category: "Audio" },
  { key: "rear_camera_issue", label: "Cámara trasera no funciona", icon: "📷", category: "Cámaras" },
  { key: "front_camera_issue", label: "Cámara frontal no funciona", icon: "🤳", category: "Cámaras" },
  { key: "wifi_not_working", label: "WiFi no conecta", icon: "📶", category: "Conectividad" },
  { key: "bluetooth_issue", label: "Bluetooth no funciona", icon: "🔵", category: "Conectividad" },
  { key: "signal_issue", label: "Sin señal", icon: "📵", category: "Conectividad" },
  { key: "water_damage", label: "Daño por líquido", icon: "💧", category: "Físico" },
  { key: "housing_damage", label: "Carcasa dañada", icon: "🔨", category: "Físico" }
];

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

export default function WorkOrderWizard({ open, onClose, onSuccess, preloadedCustomer }) {
  const [loading, setLoading] = useState(false);
  const [user, setUser] = useState(null);
  const [technicians, setTechnicians] = useState([]);
  
  // Cliente
  const [customerName, setCustomerName] = useState("");
  const [customerLastName, setCustomerLastName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [customerEmail, setCustomerEmail] = useState("");
  const [customerId, setCustomerId] = useState(null);
  const [isB2B, setIsB2B] = useState(false);
  const [companyName, setCompanyName] = useState("");
  const [companyTaxId, setCompanyTaxId] = useState("");
  const [billingContact, setBillingContact] = useState("");
  
  // Técnico
  const [assignedTo, setAssignedTo] = useState(null);
  
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
  
  // Seguridad
  const [devicePin, setDevicePin] = useState("");
  const [devicePassword, setDevicePassword] = useState("");
  const [securityPattern, setSecurityPattern] = useState(null);
  const [showPin, setShowPin] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [patternModalOpen, setPatternModalOpen] = useState(false);
  
  // Checklist
  const [checklist, setChecklist] = useState([]);
  
  // Catálogos
  const [types, setTypes] = useState([]);
  const [brands, setBrands] = useState([]);
  const [models, setModels] = useState([]);
  
  // Búsqueda
  const [customerSearchQuery, setCustomerSearchQuery] = useState("");
  const [customerResults, setCustomerResults] = useState([]);
  
  const fileInputRef = useRef(null);
  const cameraInputRef = useRef(null);

  // Items (piezas y servicios)
  const [orderItems, setOrderItems] = useState([]);
  const [showAddItemModal, setShowAddItemModal] = useState(false);
  const [suggestedProducts, setSuggestedProducts] = useState([]);
  const [allServices, setAllServices] = useState([]);

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
      }
    } else {
      resetForm();
    }
  }, [open, preloadedCustomer]);

  useEffect(() => {
    if (deviceType) loadBrands();
    else { setBrands([]); setModels([]); }
  }, [deviceType]);

  useEffect(() => {
    if (deviceBrand) loadModels();
    else setModels([]);
  }, [deviceBrand]);

  useEffect(() => {
    if (deviceModel) {
      loadSuggestedProducts();
      loadAllServices();
    }
  }, [deviceModel]);

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
      const allUsers = await base44.entities.User.filter({});
      const techs = (allUsers || []).filter(u => 
        u.role === "technician" || u.role === "admin" || u.role === "manager"
      );
      setTechnicians(techs);
    } catch {
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

  const loadSuggestedProducts = async () => {
    if (!deviceModel) {
      setSuggestedProducts([]);
      return;
    }

    try {
      const allProducts = await base44.entities.Product.filter({ active: true }, undefined, 200);
      const modelLower = deviceModel.toLowerCase();
      
      const filtered = allProducts.filter(p => {
        const nameLower = (p.name || "").toLowerCase();
        const compatModels = Array.isArray(p.compatibility_models) ? p.compatibility_models : [];
        const hasCompatMatch = compatModels.some(m => (m || "").toLowerCase().includes(modelLower));
        
        return nameLower.includes(modelLower) || hasCompatMatch;
      });
      
      setSuggestedProducts(filtered.slice(0, 8));
    } catch {
      setSuggestedProducts([]);
    }
  };

  const loadAllServices = async () => {
    try {
      const services = await base44.entities.Service.filter({ active: true }, "name");
      setAllServices(services || []);
    } catch {
      setAllServices([]);
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
    setDeviceFamily("");
    setDeviceSerial("");
    setDeviceColor("");
    setProblem("");
    setPhotos([]);
    setDevicePin("");
    setDevicePassword("");
    setSecurityPattern(null);
    setChecklist([]);
    setCustomerSearchQuery("");
    setCustomerResults([]);
    setOrderItems([]);
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

  const createOrder = async () => {
    const fullName = isB2B 
      ? companyName 
      : `${customerName} ${customerLastName}`.trim();
    
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

      // 2. Catálogos
      const typeName = deviceType;
      const brandName = typeof deviceBrand === "string" ? deviceBrand : deviceBrand?.name || "";
      const modelName = deviceModel;

      let categoryId = null;
      let brandId = null;

      if (typeName) {
        const foundCat = await base44.entities.DeviceCategory.filter({ name: typeName });
        if (foundCat?.length) {
          categoryId = foundCat[0].id;
        } else {
          const newCat = await base44.entities.DeviceCategory.create({
            name: typeName,
            active: true,
            order: 1
          });
          categoryId = newCat.id;
        }
      }

      if (brandName && categoryId) {
        const foundBrand = await base44.entities.Brand.filter({ name: brandName });
        if (foundBrand?.length) {
          brandId = foundBrand[0].id;
        } else {
          const newBrand = await base44.entities.Brand.create({
            name: brandName,
            category_id: categoryId,
            active: true,
            order: 1
          });
          brandId = newBrand.id;
        }
      }

      if (modelName && brandId) {
        const foundFamily = await base44.entities.DeviceFamily.filter({
          name: modelName,
          brand_id: brandId
        });
        if (!foundFamily?.length) {
          await base44.entities.DeviceFamily.create({
            name: modelName,
            brand_id: brandId,
            active: true,
            order: 1
          });
        }
      }

      // 3. Fotos
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

      // 5. Crear orden
      const orderNumber = `WO-${Date.now().toString().slice(-8)}`;
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
        initial_problem: problem || "",
        photos_metadata: photosMetadata,
        device_security: securityData,
        checklist_items: checklist,
        status: "intake",
        created_by: user?.full_name || user?.email || "System",
        assigned_to: assignedTo?.id || null,
        assigned_to_name: assignedTo?.full_name || "",
        terms_accepted: true,
        order_items: formattedItems,
        comments: []
      };

      const newOrder = await base44.entities.Order.create(orderData);

      // 6. Email
      if (customerEmail) {
        try {
          const businessInfo = await getBusinessInfo();
          const emailData = createWelcomeEmail({
            orderNumber: newOrder.order_number,
            customerName: customerName || companyName,
            deviceInfo: `${brandName} ${deviceModel}`,
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
      } catch (err) {
        console.error("Error notifications:", err);
      }

      // 8. Eventos
      window.dispatchEvent(new CustomEvent('workorder-created', { detail: { order: newOrder } }));
      window.dispatchEvent(new Event('force-refresh'));

      return newOrder;
    } catch (err) {
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

      toast.success("✅ Orden creada exitosamente");
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
    } catch (err) {
      console.error("Error:", err);
      toast.error("Error: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-3xl w-[98vw] h-[calc(100vh-120px)] sm:h-[94vh] p-0 border-cyan-500/25 shadow-[0_0_45px_rgba(0,168,232,0.35)] bg-[radial-gradient(circle_at_top,#0f172a_0%,#020617_45%,#000_90%)] overflow-hidden flex flex-col mt-16 sm:mt-0">
        
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-white/10 bg-gradient-to-r from-cyan-600/10 to-emerald-600/10">
          <div className="flex items-center gap-3">
            <img
              src="https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/68f767a3d5fce1486d4cf555/e9bc537e2_DynamicsmartfixosLogowithGearandDevice.png"
              alt="Logo"
              className="h-10 w-auto object-contain drop-shadow-[0_2px_12px_rgba(0,168,232,0.6)]"
            />
            <div>
              <h2 className="text-lg font-bold text-white">Nueva Orden</h2>
              <p className="text-xs text-gray-400">Completa todos los datos</p>
            </div>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-full bg-cyan-600/80 hover:bg-cyan-600 flex items-center justify-center">
            <X className="w-4 h-4 text-white" />
          </button>
        </div>

        {/* Body - TODAS LAS SECCIONES EN UNA PÁGINA */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4 pb-20">
          
          {/* 📋 CLIENTE */}
          <div className="bg-black/40 border border-cyan-500/20 rounded-xl p-4 space-y-3">
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
              </div>
            )}
          </div>

          {/* 👤 TÉCNICO */}
          <div className="bg-black/40 border border-emerald-500/20 rounded-xl p-4 space-y-3">
            <h3 className="text-white font-bold text-sm flex items-center gap-2">
              <Users className="w-4 h-4 text-emerald-400" />
              👤 Técnico (opcional)
            </h3>
            
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
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
                  <div className="w-5 h-5 rounded-full bg-cyan-600 flex items-center justify-center text-white text-[10px] font-bold">
                    {(tech.full_name || tech.email || "?")[0].toUpperCase()}
                  </div>
                  <span className="truncate">{tech.full_name?.split(' ')[0] || tech.email}</span>
                </button>
              ))}
            </div>
          </div>

          {/* 📱 DISPOSITIVO */}
          <div className="bg-black/40 border border-purple-500/20 rounded-xl p-4 space-y-3">
            <h3 className="text-white font-bold text-sm flex items-center gap-2">
              <Smartphone className="w-4 h-4 text-purple-400" />
              📱 Dispositivo
            </h3>

            {/* Tipo */}
            {types.length > 0 && (
              <div>
                <label className="text-xs text-gray-300 mb-2 block">Tipo *</label>
                <div className="flex flex-wrap gap-2">
                  {types.map(t => (
                    <button
                      key={t.id}
                      onClick={() => {
                        setDeviceType(t.name);
                        setDeviceBrand(null);
                        setDeviceModel("");
                      }}
                      className={`px-3 py-1.5 rounded-lg text-xs border-2 transition-all ${
                        deviceType === t.name
                          ? "bg-gradient-to-r from-cyan-600 to-emerald-600 border-cyan-400 text-white"
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
                <label className="text-xs text-gray-300 mb-2 block">Marca *</label>
                <div className="flex flex-wrap gap-2">
                  {brands.map(b => (
                    <button
                      key={b.id}
                      onClick={() => {
                        setDeviceBrand(b);
                        setDeviceModel("");
                      }}
                      className={`px-3 py-1.5 rounded-lg text-xs border-2 transition-all ${
                        deviceBrand?.id === b.id
                          ? "bg-gradient-to-r from-cyan-600 to-emerald-600 border-cyan-400 text-white"
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
                <label className="text-xs text-gray-300 mb-2 block">Modelo (click o escribe) *</label>
                <div className="flex flex-wrap gap-2 mb-2">
                  {models.map(m => (
                    <button
                      key={m.id}
                      onClick={() => {
                        setDeviceModel(m.name);
                        const fam = inferFamily(deviceType, deviceBrand, m.name);
                        if (fam) setDeviceFamily(fam);
                      }}
                      className={`px-3 py-1.5 rounded-lg text-xs border-2 transition-all ${
                        deviceModel === m.name
                          ? "bg-gradient-to-r from-cyan-600 to-emerald-600 border-cyan-400 text-white"
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
                onChange={(e) => {
                  setDeviceModel(e.target.value);
                  const fam = inferFamily(deviceType, deviceBrand, e.target.value);
                  if (fam) setDeviceFamily(fam);
                }}
                placeholder="iPhone 12 Pro, Galaxy S23..."
                className="w-full bg-black/30 border border-white/10 rounded-lg px-3 py-2 text-white text-sm"
              />
            </div>

            {deviceFamily && (
              <div className="bg-emerald-600/10 border border-emerald-500/30 rounded-lg p-2">
                <p className="text-xs text-emerald-300">
                  ✓ Familia: <span className="font-bold">{deviceFamily}</span>
                </p>
              </div>
            )}

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
          <div className="bg-black/40 border border-orange-500/20 rounded-xl p-4 space-y-3">
            <h3 className="text-white font-bold text-sm flex items-center gap-2">
              <Wrench className="w-4 h-4 text-orange-400" />
              🔧 Problema
            </h3>
            
            <textarea
              value={problem}
              onChange={(e) => setProblem(e.target.value)}
              placeholder="Describe el problema del equipo..."
              className="w-full bg-black/30 border border-white/10 rounded-lg px-3 py-2 text-white text-sm min-h-[80px]"
            />
          </div>

          {/* 🛠️ PIEZAS Y SERVICIOS */}
          <div className="bg-black/40 border border-lime-500/20 rounded-xl p-4 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-white font-bold text-sm flex items-center gap-2">
                <Wrench className="w-4 h-4 text-lime-400" />
                🛠️ Piezas y Servicios (opcional)
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
          <div className="bg-black/40 border border-blue-500/20 rounded-xl p-4 space-y-3">
            <h3 className="text-white font-bold text-sm flex items-center gap-2">
              <Shield className="w-4 h-4 text-blue-400" />
              🔐 Seguridad (opcional)
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

          {/* ✅ CHECKLIST */}
          <div className="bg-black/40 border border-green-500/20 rounded-xl p-4 space-y-3">
            <h3 className="text-white font-bold text-sm flex items-center gap-2">
              <CheckSquare className="w-4 h-4 text-green-400" />
              ✅ Checklist de Recepción
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
                    <span>{item.icon}</span> {item.label}
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
          <div className="bg-black/40 border border-pink-500/20 rounded-xl p-4 space-y-3">
            <h3 className="text-white font-bold text-sm flex items-center gap-2">
              <Camera className="w-4 h-4 text-pink-400" />
              📸 Fotos / Evidencia
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
              <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                {photos.map((file, idx) => {
                  const url = file instanceof File ? URL.createObjectURL(file) : file.url || file.publicUrl;
                  return (
                    <div key={idx} className="relative">
                      <img
                        src={url}
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
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Footer - FIXED AL FONDO DEL MODAL */}
        <div className="flex flex-col sm:flex-row gap-2 px-4 py-3 border-t border-white/10 bg-black/60 backdrop-blur-xl">
          <Button
            onClick={onClose}
            variant="outline"
            className="border-white/20 text-gray-300 h-11"
            disabled={loading}
          >
            Cancelar
          </Button>
          <Button
            onClick={handleAddAnother}
            disabled={loading}
            variant="outline"
            className="border-cyan-500/30 text-cyan-400 hover:bg-cyan-600/20 h-11"
          >
            <Plus className="w-4 h-4 mr-2" />
            Añadir otro equipo
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={loading}
            className="flex-1 bg-gradient-to-r from-cyan-600 to-emerald-600 hover:from-cyan-700 hover:to-emerald-700 h-11"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Creando...
              </>
            ) : (
              <>
                <Save className="w-4 h-4 mr-2" />
                Crear Orden
                {customerEmail && <Mail className="w-4 h-4 ml-2" />}
              </>
            )}
          </Button>
        </div>
      </DialogContent>

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
      {showAddItemModal && (
        <AddItemsModal
          open={showAddItemModal}
          onClose={() => setShowAddItemModal(false)}
          suggestedProducts={suggestedProducts}
          allServices={allServices}
          deviceModel={deviceModel}
          onAddItem={addItemToOrder}
          alreadyAdded={orderItems}
        />
      )}
    </Dialog>
  );
}

// === MODAL PARA AÑADIR ITEMS ===
function AddItemsModal({ open, onClose, suggestedProducts, allServices, deviceModel, onAddItem, alreadyAdded }) {
  const [searchQuery, setSearchQuery] = useState("");
  const [allProducts, setAllProducts] = useState([]);
  const [activeTab, setActiveTab] = useState("suggested"); // suggested, products, services

  useEffect(() => {
    if (open) loadAllProducts();
  }, [open]);

  const loadAllProducts = async () => {
    try {
      const products = await base44.entities.Product.filter({ active: true }, "name", 300);
      setAllProducts(products || []);
    } catch {
      setAllProducts([]);
    }
  };

  const filteredProducts = useMemo(() => {
    const q = searchQuery.toLowerCase();
    if (!q) return allProducts.slice(0, 20);
    return allProducts.filter(p => 
      p.name?.toLowerCase().includes(q) || 
      p.sku?.toLowerCase().includes(q)
    ).slice(0, 20);
  }, [allProducts, searchQuery]);

  const filteredServices = useMemo(() => {
    const q = searchQuery.toLowerCase();
    if (!q) return allServices;
    return allServices.filter(s => 
      s.name?.toLowerCase().includes(q) || 
      s.code?.toLowerCase().includes(q)
    );
  }, [allServices, searchQuery]);

  const isAdded = (item, type) => {
    return alreadyAdded.some(i => i.id === item.id && i.type === type);
  };

  return (
    <div className="fixed inset-0 z-[300] bg-black/80 flex items-center justify-center p-4">
      <div className="bg-[#0f172a] border border-cyan-500/30 rounded-2xl w-full max-w-2xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
          <h3 className="text-white font-bold text-lg">Añadir Items</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 px-4 py-3 border-b border-white/10">
          <button
            onClick={() => setActiveTab("suggested")}
            className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${
              activeTab === "suggested"
                ? "bg-gradient-to-r from-cyan-600 to-emerald-600 text-white"
                : "bg-black/20 text-gray-400 hover:bg-white/5"
            }`}
          >
            💡 Sugeridas ({suggestedProducts.length})
          </button>
          <button
            onClick={() => setActiveTab("products")}
            className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${
              activeTab === "products"
                ? "bg-gradient-to-r from-cyan-600 to-emerald-600 text-white"
                : "bg-black/20 text-gray-400 hover:bg-white/5"
            }`}
          >
            📦 Productos
          </button>
          <button
            onClick={() => setActiveTab("services")}
            className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${
              activeTab === "services"
                ? "bg-gradient-to-r from-cyan-600 to-emerald-600 text-white"
                : "bg-black/20 text-gray-400 hover:bg-white/5"
            }`}
          >
            🔧 Servicios ({allServices.length})
          </button>
        </div>

        {/* Búsqueda */}
        {(activeTab === "products" || activeTab === "services") && (
          <div className="px-4 py-3 border-b border-white/10">
            <div className="relative">
              <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={`Buscar ${activeTab === "products" ? "productos" : "servicios"}...`}
                className="w-full pl-10 pr-3 py-2 bg-black/30 border border-white/10 rounded-lg text-white text-sm"
              />
            </div>
          </div>
        )}

        {/* Contenido */}
        <div className="flex-1 overflow-y-auto p-4">
          {activeTab === "suggested" && (
            <div className="space-y-2">
              {deviceModel && (
                <p className="text-xs text-cyan-400 mb-3">
                  Piezas compatibles con <span className="font-bold">{deviceModel}</span>
                </p>
              )}
              {suggestedProducts.length === 0 ? (
                <p className="text-gray-400 text-sm text-center py-8">
                  {deviceModel ? "No hay piezas sugeridas" : "Selecciona un modelo para ver sugerencias"}
                </p>
              ) : (
                suggestedProducts.map(product => {
                  const added = isAdded(product, "product");
                  return (
                    <button
                      key={product.id}
                      type="button"
                      onClick={() => !added && onAddItem({ ...product, type: "product" })}
                      disabled={added}
                      className={`w-full p-3 rounded-lg border text-left transition-all ${
                        added
                          ? "bg-emerald-600/20 border-emerald-500/40"
                          : "bg-black/40 border-white/10 hover:bg-white/5"
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <p className="text-white text-sm font-medium truncate">{product.name}</p>
                          <div className="flex items-center gap-2 mt-1">
                            {product.sku && <span className="text-xs text-gray-400">{product.sku}</span>}
                            <span className="text-xs text-gray-400">Stock: {product.stock || 0}</span>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-lime-400 font-bold">${(product.price || 0).toFixed(2)}</span>
                          {added ? (
                            <Check className="w-5 h-5 text-emerald-400" />
                          ) : (
                            <Plus className="w-5 h-5 text-cyan-400" />
                          )}
                        </div>
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          )}

          {activeTab === "products" && (
            <div className="space-y-2">
              {filteredProducts.length === 0 ? (
                <p className="text-gray-400 text-sm text-center py-8">
                  {searchQuery ? "No se encontraron productos" : "Cargando productos..."}
                </p>
              ) : (
                filteredProducts.map(product => {
                  const added = isAdded(product, "product");
                  return (
                    <button
                      key={product.id}
                      type="button"
                      onClick={() => !added && onAddItem({ ...product, type: "product" })}
                      disabled={added}
                      className={`w-full p-3 rounded-lg border text-left transition-all ${
                        added
                          ? "bg-emerald-600/20 border-emerald-500/40"
                          : "bg-black/40 border-white/10 hover:bg-white/5"
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <p className="text-white text-sm font-medium truncate">{product.name}</p>
                          <div className="flex items-center gap-2 mt-1">
                            {product.sku && <span className="text-xs text-gray-400">{product.sku}</span>}
                            <span className="text-xs text-gray-400">Stock: {product.stock || 0}</span>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-lime-400 font-bold">${(product.price || 0).toFixed(2)}</span>
                          {added ? (
                            <Check className="w-5 h-5 text-emerald-400" />
                          ) : (
                            <Plus className="w-5 h-5 text-cyan-400" />
                          )}
                        </div>
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          )}

          {activeTab === "services" && (
            <div className="space-y-2">
              {filteredServices.length === 0 ? (
                <p className="text-gray-400 text-sm text-center py-8">
                  {searchQuery ? "No se encontraron servicios" : "No hay servicios disponibles"}
                </p>
              ) : (
                filteredServices.map(service => {
                  const added = isAdded(service, "service");
                  return (
                    <button
                      key={service.id}
                      type="button"
                      onClick={() => !added && onAddItem({ ...service, type: "service" })}
                      disabled={added}
                      className={`w-full p-3 rounded-lg border text-left transition-all ${
                        added
                          ? "bg-emerald-600/20 border-emerald-500/40"
                          : "bg-black/40 border-white/10 hover:bg-white/5"
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <p className="text-white text-sm font-medium truncate">{service.name}</p>
                          {service.code && (
                            <span className="text-xs text-gray-400">{service.code}</span>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-lime-400 font-bold">${(service.price || 0).toFixed(2)}</span>
                          {added ? (
                            <Check className="w-5 h-5 text-emerald-400" />
                          ) : (
                            <Plus className="w-5 h-5 text-cyan-400" />
                          )}
                        </div>
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-4 py-3 border-t border-white/10">
          <Button
            onClick={onClose}
            className="w-full bg-gradient-to-r from-cyan-600 to-emerald-600"
          >
            Cerrar
          </Button>
        </div>
      </div>
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
