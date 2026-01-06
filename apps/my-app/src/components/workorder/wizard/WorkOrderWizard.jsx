// src/components/workorder/WorkOrderWizard.jsx
import React, { useEffect, useMemo, useState } from "react";
import { base44 } from "@/api/base44Client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import {
  ChevronLeft,
  ChevronRight,
  Check,
  User,
  History,
  RefreshCw,
} from "lucide-react";

/* Steps (tus componentes existentes) */
import CustomerStep from "./wizard/CustomerStep";
import BrandIconGrid from "./wizard/BrandIconGrid";
import SubcategoryIconGrid from "./wizard/SubcategoryIconGrid";
import FamilyIconGrid from "./wizard/FamilyIconGrid";
import ModelIconGrid from "./wizard/ModelIconGrid";
import ProblemStep from "./wizard/ProblemStep";
import SecurityStep from "./wizard/SecurityStep";
import AssignmentStep from "./wizard/AssignmentStep";
import SignatureStep from "./wizard/SignatureStep";
import ChecklistIconsStep from "./wizard/ChecklistIconsStep"; // Updated from ChecklistStep to ChecklistIconsStep
import SummaryStep from "./wizard/SummaryStep";
import CustomerHistoryDialog from "./CustomerHistoryDialog";

/* New Imports for Catalog Feature */
import DeviceCatalogStep from "./wizard/DeviceCatalogStep";
import ServiceSelectorModal from "@/components/common/ServiceSelectorModal";
import { toast } from "sonner"; // Ensure toast is imported

/* =========================
   Estado inicial del formulario
========================= */
const INITIAL_FORM_DATA = {
  customer: {
    name: "",
    last_name: "",
    phone: "",
    additional_phones: [],
    email: "",
  },
  existing_customer_id: null,
  device_category: null,
  device_brand: null,        // { name } | string
  device_subcategory: null,  // { name } | string
  device_family: null,       // { id, name } | string | null
  device_model: null,        // { id, name } | string | null
  device_serial: "",
  problem_description: "",
  comments: "",
  suggested_items: [],
  security: {
    device_password: "",
    device_pin: "",
    pattern_mode: "none",
    pattern_image: null,
  },
  media_files: [],
  checklist_items: [],
  checklist_notes: "",
  signature: null,
  employee_signature: null,
  terms_accepted: false,
  created_by: "",
  created_by_role: "",
  assigned_to: "",
  assigned_to_name: "",
  custom_fields: {}, // Added custom_fields to initial state
  payment_data: null,
  deposit_data: null,
};

/* Orden base de pasos (antes de aplicar reglas por marca) */
const BASE_STEPS = [
  "customer",
  "brand",
  "subcategory",
  "family",
  "model",
  "problem",
  "security",
  "checklist",
  "assignment",
  "signature",
  "summary",
];

/* Utilidades */
const norm = (v) => (v ? String(v).toLowerCase() : "");
const titleMap = {
  customer: "Cliente",
  brand: "Marca",
  subcategory: "Tipo de Dispositivo",
  family: "Familia",
  model: "Modelo",
  problem: "Diagnóstico, Piezas y Fotos",
  security: "Seguridad del Dispositivo",
  assignment: "Asignación",
  signature: "Firma y Términos",
  checklist: "Checklist de Recepción",
  summary: "Resumen",
};

export default function WorkOrderWizard({
  open,
  onClose,
  onSuccess,
  preloadedCustomer,
}) {
  /* =========================
     Estado del Wizard
  ========================= */
  const [config, setConfig] = useState(null);
  const [user, setUser] = useState(null);

  const [formData, setFormData] = useState(INITIAL_FORM_DATA);
  const [loading, setLoading] = useState(false);
  const [taxRate, setTaxRate] = useState(0.115);

  const [configuredSteps, setConfiguredSteps] = useState(BASE_STEPS);
  const [currentStep, setCurrentStep] = useState(0);
  const [showCustomerHistory, setShowCustomerHistory] = useState(false);

  // Stack de historial para navegación precisa
  const [stepHistory, setStepHistory] = useState([]);
  // NEW: State for navigation direction (can be used for transitions if needed)
  const [navDir, setNavDir] = useState(null); // 'next' or 'back'

  // NEW: State to control whether to use the catalog-based device selection
  const [useCatalog, setUseCatalog] = useState(false);
  const [showServiceSelector, setShowServiceSelector] = useState(false);

  /* =========================
     Carga inicial al abrir
  ========================= */
  useEffect(() => {
    if (!open) return;
    (async () => {
      await Promise.all([loadUser(), loadTaxRate(), loadConfig()]);
    })();

    if (preloadedCustomer) {
      const fullName = preloadedCustomer.name || "";
      const [firstName, ...rest] = fullName.split(" ");
      setFormData({
        ...INITIAL_FORM_DATA,
        customer: {
          name: firstName || "",
          last_name: rest.join(" "),
          phone: preloadedCustomer.phone || "",
          email: preloadedCustomer.email || "",
          additional_phones: preloadedCustomer.additional_phones || [],
        },
        existing_customer_id: preloadedCustomer.id || null,
      });
    } else {
      setFormData(INITIAL_FORM_DATA);
    }

    setCurrentStep(0);
    setStepHistory([]); // Reset history on open
    setNavDir(null); // Reset nav direction on open
  }, [open, preloadedCustomer]);

  /* Limpieza suave al cerrar */
  useEffect(() => {
    if (open) return;
    const t = setTimeout(() => {
      setFormData(INITIAL_FORM_DATA);
      setCurrentStep(0);
      setStepHistory([]); // Reset history on close
      setNavDir(null); // Reset nav direction on close
      setUseCatalog(false); // Reset catalog setting on close
    }, 250);
    return () => clearTimeout(t);
  }, [open]);

  /* =========================
     Loaders
  ========================= */
  async function loadUser() {
    try {
      const u = await base44.auth.me();
      setUser(u || null);
    } catch {
      setUser(null);
    }
  }

  async function loadTaxRate() {
    try {
      const rows = await base44.entities.SystemConfig.filter({
        key: "global_settings",
      });
      const raw = rows?.[0]?.value;
      if (!raw) return;
      const parsed = typeof raw === "string" ? JSON.parse(raw) : raw;
      const t = parseFloat(parsed?.tax_rate);
      if (!Number.isNaN(t)) setTaxRate(t);
    } catch {
      /* noop */
    }
  }

  async function loadConfig() {
    try {
      const rows = await base44.entities.WorkOrderConfig.filter({
        key: "wizard_config",
      });
      const cfg = rows?.[0] || null;
      setConfig(cfg);

      const orderFromCfg =
        (cfg?.steps_order && Array.isArray(cfg.steps_order) && cfg.steps_order.length
          ? cfg.steps_order
          : BASE_STEPS
        ).filter((s) => cfg?.steps_enabled?.[s] !== false);

      // Legacy cleanup
      const cleaned = orderFromCfg.filter((s) => s !== "comments_media");
      setConfiguredSteps(cleaned.length ? cleaned : BASE_STEPS);

      // NEW: Set useCatalog based on config
      setUseCatalog(!!cfg?.use_catalog_wizard); // Assuming 'use_catalog_wizard' is a boolean flag in config
    } catch {
      setConfiguredSteps(BASE_STEPS);
      setUseCatalog(false); // Default to false on error
    }
  }

  /* =========================
     Reglas dinámicas por marca/subcategoría
  ========================= */
  const effectiveSteps = useMemo(() => {
    let steps = [...configuredSteps];

    const brandName = formData?.device_brand?.name || formData?.device_brand || "";
    const subcatName = formData?.device_subcategory?.name || formData?.device_subcategory || "";

    const b = norm(brandName);
    const sc = norm(subcatName);

    const isApple = b.includes("apple") || b.includes("iphone");
    const isSamsung = b.includes("samsung");
    const isIphone = sc.includes("phone") || b.includes("iphone");

    // NEW: If catalog was used to select a full device, remove subcategory, family, model
    if (useCatalog && formData.custom_fields?.catalog_device?.model) {
      steps = steps.filter(step =>
        step !== "subcategory" && step !== "family" && step !== "model"
      );
    } else {
      // Original dynamic rules (only apply if catalog was NOT used for full device selection)
      // Apple/iPhone => remover "family"
      if (isApple || isIphone) {
        const idx = steps.indexOf("family");
        if (idx !== -1) steps.splice(idx, 1);
      }

      // Samsung => asegurar "family" antes de "model"
      if (isSamsung && !steps.includes("family")) {
        const modelIndex = steps.indexOf("model");
        const insertAt = modelIndex === -1 ? steps.length : modelIndex;
        steps.splice(insertAt, 0, "family");
      }
    }

    const logical = [
      "customer",
      "brand",
      "subcategory",
      "family",
      "model",
      "problem",
      "security",
      "checklist",
      "assignment",
      "signature",
      "summary",
    ];
    // Filter to ensure only recognized steps are included in the final sequence
    return logical.filter((s) => steps.includes(s));
  }, [configuredSteps, formData?.device_brand, formData?.device_subcategory, formData.custom_fields?.catalog_device, useCatalog]); // Added custom_fields and useCatalog to dependencies

  /* Mantener índice válido al cambiar effectiveSteps */
  useEffect(() => {
    if (currentStep >= effectiveSteps.length) {
      const newIdx = Math.max(0, effectiveSteps.length - 1);
      setCurrentStep(newIdx);
    }
  }, [effectiveSteps.length, currentStep]); // Added currentStep as a dependency for more robust index adjustment

  /* =========================
     Helpers de estado
  ========================= */
  const updateFormData = (field, value) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleClearCustomer = () => {
    const hasData =
      currentStep > 1 || (formData.suggested_items?.length || 0) > 0;
    if (hasData && !confirm("¿Limpiar cliente? Se perderán datos del ticket.")) {
      return;
    }
    setFormData(INITIAL_FORM_DATA); // Reset to initial state
    setCurrentStep(0);
    setStepHistory([]); // Clear history when customer is cleared
    setNavDir(null); // Clear nav direction
    setUseCatalog(false); // Clear catalog setting
  };

  const handleServiceSelect = (item) => {
    const type = item.part_type === 'servicio' ? 'service' : 'product';
    const newItem = {
      id: item.id,
      type: type,
      name: item.name,
      price: Number(item.price || 0),
      quantity: 1
    };
    
    setFormData(prev => ({
      ...prev,
      suggested_items: [...(prev.suggested_items || []), newItem]
    }));
    toast.success(`${item.name} añadido a la orden`);
  };

  const onKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey && !loading && canProceed()) {
      e.preventDefault();
      handleNext();
    }
  };

  const stepName = effectiveSteps[currentStep] || "";
  const progress =
    effectiveSteps.length > 0
      ? ((currentStep + 1) / effectiveSteps.length) * 100
      : 0;

  /* ===========
     Guardar modelos nuevos SIN fecha y seleccionarlos
     (para que queden disponibles a futuro)
  =========== */
  const persistNewModel = async ({ brand, family, model }) => {
    try {
      const brandName = brand?.name || brand || "";
      const familyName = family?.name || family || "";
      const modelName = model?.name || model || "";

      // Evitar duplicados
      const existing = await base44.entities.DeviceModel?.filter?.({
        brand: brandName,
        family: familyName,
        name: modelName,
      });
      if (Array.isArray(existing) && existing.length) {
        return existing[0];
      }

      // Crear SIN fecha (tal como pediste)
      const created = await base44.entities.DeviceModel?.create?.({
        brand: brandName,
        family: familyName,
        name: modelName,
        active: true,
      });
      return created || null;
    } catch (e) {
      console.warn("persistNewModel error:", e);
      return null;
    }
  };

  const getStepComponent = (name) => {
    const props = {
      formData,
      updateFormData,
      config,
      taxRate,
      currentUser: user,
      onAutoAdvance: () => {
        if (currentStep < effectiveSteps.length - 1) {
          setNavDir("next"); // NEW: Set nav direction for auto-advance
          setStepHistory(prev => [...prev, currentStep]); // Ensure history is updated on auto advance
          setCurrentStep((s) => s + 1);
        }
      },
    };

    if (name === "summary") {
      return <SummaryStep {...props} />;
    }

    switch (name) {
      case "customer":
        return <CustomerStep {...props} />;

      case "brand": {
        if (useCatalog) {
          return (
            <DeviceCatalogStep
              {...props}
              onCreateModel={async ({ brand, family, series, model, suggested_items }) => {
                const modelName = series
                  ? `${series.label} ${model.label || model.name}`
                  : (model.label || model.name);

                updateFormData("device_brand", brand.label || brand.name);
                updateFormData("device_family", family.label || family.name);
                updateFormData("device_model", modelName);
                const deviceType = family.type || family.label?.toLowerCase() || "phone";
                updateFormData("device_type", deviceType); // Assuming device_type for order creation
                updateFormData("device_subcategory", family.label || family.name); // Assuming family label is subcategory
                updateFormData("device_category", { name: deviceType }); // Assuming device_category as an object

                updateFormData("custom_fields", {
                  ...(formData.custom_fields || {}),
                  catalog_device: { brand, family, series, model }
                });

                // NEW: Populate suggested items from catalog if available
                if (suggested_items && suggested_items.length > 0) {
                  updateFormData("suggested_items", suggested_items);
                }

                // Auto-advance only if all critical information is present
                if (brand && family && model && props.onAutoAdvance) {
                  setTimeout(() => props.onAutoAdvance(), 200);
                }
              }}
            />
          );
        }
        return <BrandIconGrid {...props} />;
      }

      case "subcategory":
        return <SubcategoryIconGrid {...props} />;

      case "family":
        return <FamilyIconGrid {...props} />;

      case "model":
        return (
          <ModelIconGrid
            {...props}
            // Retained: create and persist new models (without date)
            onCreateModel={async ({ brand, family, model }) => {
              const created = await persistNewModel({ brand, family, model });
              const modelName =
                created?.name ||
                (typeof model === "string" ? model : model?.name) ||
                "";

              updateFormData("device_brand", brand?.name || brand || "");
              updateFormData("device_family", family?.name || family || "");
              updateFormData("device_model", modelName);
              // (if your ModelIconGrid supports refreshing its list, you can call a callback here)
              return created;
            }}
          />
        );
      case "problem":
        return <ProblemStep {...props} />;
      case "security":
        return <SecurityStep {...props} />;
      case "assignment":
        return <AssignmentStep {...props} />;
      case "signature":
        return <SignatureStep {...props} />;
      case "checklist":
        return <ChecklistIconsStep {...props} />; // Changed from ChecklistStep to ChecklistIconsStep
      default:
        return null;
    }
  };

  /* Validación para avanzar */
  const canProceed = () => {
    const s = effectiveSteps[currentStep];
    if (!s) return false;
    switch (s) {
      case "customer":
        return !!formData.customer.name && !!formData.customer.phone;
      case "brand":
        // If using catalog, ensure a brand/device is selected from catalog.
        // Otherwise, ensure device_brand is selected.
        if (useCatalog) {
          return !!formData.custom_fields?.catalog_device?.brand;
        }
        return formData.device_brand != null;
      case "subcategory":
        return formData.device_subcategory != null;
      case "family":
        return formData.device_family != null;
      case "model":
        return formData.device_model != null;
      case "problem":
        return !!(
          (formData.problem_description || "").trim() ||
          (formData.suggested_items?.length || 0) > 0
        );
      case "signature":
        return !!formData.signature && !!formData.terms_accepted;
      case "summary":
        return !!formData.terms_accepted;
      default:
        return true;
    }
  };

  const handleNext = () => {
    setNavDir("next"); // NEW: Set nav direction
    if (currentStep < effectiveSteps.length - 1) {
      setStepHistory(prev => [...prev, currentStep]);
      setCurrentStep((s) => s + 1);
    } else {
      handleSubmit();
    }
  };

  const handleBack = () => {
    setNavDir("back"); // NEW: Set nav direction
    if (stepHistory.length > 0) {
      const prev = stepHistory[stepHistory.length - 1];
      setStepHistory(h => h.slice(0, -1));
      setCurrentStep(prev);
    } else if (currentStep > 0) {
      setCurrentStep((s) => s - 1);
    }
  };

  const handleClose = () => {
    setFormData(INITIAL_FORM_DATA);
    setCurrentStep(0);
    setStepHistory([]);
    setNavDir(null); // NEW: Clear nav direction
    setUseCatalog(false); // NEW: Clear catalog setting
    onClose?.();
  };

  /* =========================
     Util y Submit
  ========================= */
  const encryptData = (data) => {
    try {
      return btoa(String(data));
    } catch {
      return String(data);
    }
  };

  const toFileFromDataURL = async (dataURL, filename) => {
    const res = await fetch(dataURL);
    const blob = await res.blob();
    return new File([blob], filename, { type: blob.type || "image/png" });
  };

  const handleSubmit = async () => {
    setLoading(true);
    try {
      /* 1) Cliente (merge por phone) */
      let customerId = formData.existing_customer_id || null;
      if (!customerId) {
        const existing = await base44.entities.Customer.filter({
          phone: formData.customer.phone,
        });
        if (existing?.length) {
          customerId = existing[0].id;
          await base44.entities.Customer.update(customerId, {
            name: `${formData.customer.name} ${formData.customer.last_name}`.trim(),
            email: formData.customer.email || "",
            additional_phones: formData.customer.additional_phones || [],
          });
        } else {
          const created = await base44.entities.Customer.create({
            name: `${formData.customer.name} ${formData.customer.last_name}`.trim(),
            phone: formData.customer.phone,
            email: formData.customer.email || "",
            additional_phones: formData.customer.additional_phones || [],
            total_orders: 1,
          });
          customerId = created.id;
        }
      } else {
        await base44.entities.Customer.update(customerId, {
          name: `${formData.customer.name} ${formData.customer.last_name}`.trim(),
          email: formData.customer.email || "",
          additional_phones: formData.customer.additional_phones || [],
        });
        try {
          const c = await base44.entities.Customer.get(customerId);
          await base44.entities.Customer.update(customerId, {
            total_orders: (c?.total_orders || 0) + 1,
          });
        } catch { /* noop */ }
      }

      /* 2) Media: subir solo sin url */
      const photos_metadata = [];
      for (const mf of formData.media_files || []) {
        if (mf?.url) {
          photos_metadata.push({
            id: mf.id || `ph-${Date.now()}-${Math.random().toString(36).slice(2)}`,
            type: mf.type?.startsWith?.("image")
              ? "image"
              : mf.type?.startsWith?.("video")
              ? "video"
              : "image",
            mime: mf.type || "image/jpeg",
            filename: mf.name || "media",
            publicUrl: mf.url,
            thumbUrl: mf.thumbUrl || mf.url,
          });
          continue;
        }
        if (!(mf instanceof File) && !(mf instanceof Blob)) continue;
        const name =
          mf instanceof File && mf.name ? mf.name : `photo-${Date.now()}.jpg`;
        const file =
          mf instanceof File
            ? mf
            : new File([mf], name, { type: mf.type || "image/jpeg" });
        const { file_url } = await base44.integrations.Core.UploadFile({ file });
        photos_metadata.push({
          id: `ph-${Date.now()}-${name}`,
          type: (file.type || "").startsWith("image")
            ? "image"
            : (file.type || "").startsWith("video")
            ? "video"
            : "image",
          mime: file.type || "image/jpeg",
          filename: name,
          publicUrl: `${file_url}?v=${Date.now()}`,
          thumbUrl: `${file_url}?v=${Date.now()}`,
        });
      }

      /* 3) Firma */
      let signatureUrl = null;
      if (formData.signature) {
        const file =
          typeof formData.signature === "string" &&
          formData.signature.startsWith("data:")
            ? await toFileFromDataURL(
                formData.signature,
                `signature-${Date.now()}.png`
              )
            : formData.signature instanceof File
            ? formData.signature
            : null;

        if (file) {
          const { file_url } = await base44.integrations.Core.UploadFile({
            file,
          });
          signatureUrl = file_url;
        }
      }

      /* 4) Seguridad */
      const encryptedSecurity = {
        device_password: formData.security.device_password
          ? encryptData(formData.security.device_password)
          : null,
        device_pin: formData.security.device_pin
          ? encryptData(formData.security.device_pin)
          : null,
        pattern_image: formData.security.pattern_image || null,
      };

      /* 5) Totales */
      // Ensure suggested items have numeric price and quantity
      const suggestedItems = (formData.suggested_items || []).map(item => ({
        ...item,
        price: Number(item.price || 0),
        quantity: Number(item.quantity || 1),
      }));

      const subtotal = suggestedItems.reduce(
        (sum, it) => sum + it.price * it.quantity,
        0
      );
      const taxAmount = subtotal * Number(taxRate || 0);
      const total = subtotal + taxAmount;

      /* 6) Crear orden */
      const orderNumber = `WO-${Date.now().toString().slice(-8)}`;
      const order = await base44.entities.Order.create({
        order_number: orderNumber,
        customer_id: customerId,
        customer_name: `${formData.customer.name} ${formData.customer.last_name}`.trim(),
        customer_phone: formData.customer.phone,
        customer_email: formData.customer.email || "",
        device_type:
          formData.device_category?.name || formData.device_subcategory?.name, // Use category or subcategory name for type
        device_brand: formData.device_brand?.name || formData.device_brand || "",
        device_model: formData.device_model?.name || formData.device_model || "",
        device_serial: formData.device_serial || "",
        initial_problem: formData.problem_description || "",
        photos_metadata,
        customer_signature: signatureUrl,
        device_security: encryptedSecurity,
        checklist_items: formData.checklist_items || [],
        checklist_notes: formData.checklist_notes || "",
        status: "intake",
        cost_estimate: total,
        created_by: user?.full_name || user?.email || "",
        assigned_to: formData.assigned_to || "",
        assigned_to_name: formData.assigned_to_name || "",
        terms_accepted: !!formData.terms_accepted,
        suggested_items: suggestedItems, // Ensure suggested items are saved
        custom_fields: formData.custom_fields || {}, // NEW: save custom fields
      });

      /* 7) Eventos */
      if ((formData.comments || "").trim()) {
        await base44.entities.WorkOrderEvent.create({
          order_id: order.id,
          order_number: orderNumber,
          event_type: "note",
          description: formData.comments.trim(),
          user_id: user?.id || null,
          user_name: user?.full_name || user?.email || "Sistema",
          user_role: user?.role || "system",
          metadata: { for_customer: true },
        });
      }

      await base44.entities.WorkOrderEvent.create({
        order_id: order.id,
        order_number: orderNumber,
        event_type: "create",
        description: `Orden creada por ${
          user?.full_name || user?.email || "Sistema"
        }. Datos y adjuntos sincronizados desde el wizard.`,
        user_id: user?.id || null,
        user_name: user?.full_name || user?.email || "Sistema",
        user_role: user?.role || "system",
      });

      /* 8) Reset y callback */
      setFormData(INITIAL_FORM_DATA);
      setCurrentStep(0);
      setStepHistory([]);
      setNavDir(null); // NEW: Clear nav direction
      setUseCatalog(false); // NEW: Clear catalog setting
      onSuccess?.(order); // Pass the created order to the onSuccess callback
      onClose?.();
    } catch (err) {
      console.error("Error creating work order:", err);
      alert("Error al crear la orden: " + (err?.message || "desconocido"));
    } finally {
      setLoading(false);
    }
  };

  /* =========================
     Render
  ========================= */
  return (
    <>
      <Dialog
        open={open}
        onOpenChange={(v) => {
          if (!v) handleClose();
        }}
      >
        <DialogContent
          className="z-[70] max-w-4xl h-[90vh] max-h-[90dvh] bg-gradient-to-br from-[#2B2B2B] to-black border-red-900/30 p-0 flex flex-col overflow-hidden"
          onKeyDown={onKeyDown}
        >
          {/* Header */}
          <div className="px-4 sm:px-6 pt-4 sm:pt-6 pb-4 border-b border-gray-800 bg-gradient-to-br from-[#2B2B2B] to-black flex-shrink-0">
            <DialogHeader>
              <div className="flex items-center justify-between gap-4">
                <div>
                  <DialogTitle className="text-xl sm:text-2xl font-bold text-white mb-2">
                    {titleMap[stepName] || stepName || "—"}
                  </DialogTitle>

                  {formData.existing_customer_id && formData.customer.name && (
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge variant="secondary" className="bg-gray-800 text-gray-200">
                        <User className="w-3 h-3 mr-1" /> Cliente existente
                      </Badge>
                      <Badge
                        variant="secondary"
                        className="bg-gray-800 text-gray-200 cursor-pointer hover:bg-gray-700"
                        onClick={() => setShowCustomerHistory(true)}
                      >
                        <History className="w-3 h-3 mr-1" /> Ver historial
                      </Badge>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 px-2 text-xs text-gray-400 hover:bg-gray-700"
                        onClick={handleClearCustomer}
                      >
                        <RefreshCw className="w-3 h-3 mr-1" /> Limpiar
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            </DialogHeader>

            <div className="space-y-2 mt-4">
              <div className="flex items-center justify-between gap-4">
                <Progress value={progress} className="h-2 flex-1" />
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setShowServiceSelector(true)}
                  className="h-7 px-3 text-xs bg-purple-600/20 border-purple-500/30 text-purple-300 hover:bg-purple-600/30 whitespace-nowrap"
                >
                  <Search className="w-3 h-3 mr-1.5" />
                  Añadir Item
                </Button>
              </div>
              <div className="flex justify-between text-xs text-gray-400">
                <span>
                  Paso {Math.min(currentStep + 1, effectiveSteps.length)} de{" "}
                  {effectiveSteps.length}
                </span>
                <span>{Math.round(progress)}%</span>
              </div>
            </div>
          </div>

          {/* Body */}
          <div className="flex-1 overflow-y-auto custom-scrollbar app-scroll touch-pan-y" tabIndex={0}>
            <div className="p-4 sm:p-6">
              {stepName ? getStepComponent(stepName) : null}
            </div>
          </div>

          {/* Footer */}
          <div className="px-4 sm:px-6 py-4 bg-gradient-to-br from-[#2B2B2B] to-black border-t border-gray-800 flex-shrink-0">
            <div className="flex justify-between items-center gap-3">
              <Button
                onClick={handleBack}
                variant="outline"
                disabled={currentStep === 0 || loading}
                className="px-4 min-h-[48px] min-w-[100px] border-gray-700 hover:bg-gray-800"
              >
                <ChevronLeft className="w-4 h-4 mr-2" />
                Atrás
              </Button>

              <div className="flex gap-2">
                <Button
                  onClick={handleClose}
                  variant="outline"
                  disabled={loading}
                  className="px-4 min-h-[48px] border-gray-700 hover:bg-gray-800"
                >
                  Cancelar
                </Button>

                <Button
                  onClick={handleNext}
                  disabled={!canProceed() || loading}
                  className="bg-gradient-to-r from-[#FF0000] to-red-800 hover:from-red-700 hover:to-red-900 min-h-[48px] min-w-[120px]"
                >
                  {loading ? (
                    "Procesando…"
                  ) : currentStep === effectiveSteps.length - 1 ? (
                    <>
                      <Check className="w-4 h-4 mr-2" /> Confirmar
                    </>
                  ) : (
                    <>
                      Continuar <ChevronRight className="w-4 h-4 ml-2" />
                    </>
                  )}
                </Button>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {formData.existing_customer_id && (
        <CustomerHistoryDialog
          open={showCustomerHistory}
          onClose={() => setShowCustomerHistory(false)}
          customerId={formData.existing_customer_id}
          customerName={`${formData.customer.name} ${formData.customer.last_name}`.trim()}
        />
      )}

      <ServiceSelectorModal
        open={showServiceSelector}
        onClose={() => setShowServiceSelector(false)}
        onSelect={handleServiceSelect}
      />
    </>
  );
}
