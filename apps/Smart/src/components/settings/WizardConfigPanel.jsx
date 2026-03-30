import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { toast } from "sonner";
import DeviceCatalogManager from "@/components/settings/DeviceCatalogManager";
import { Loader2, AlertCircle } from "lucide-react";
const DEFAULT_CONFIG = {
  key: "default",
  problem_presets: [
    { label: "Pantalla", text: "Pantalla rota / touch no responde" },
    { label: "Batería", text: "Batería se descarga rápido / se apaga" },
    { label: "Puerto", text: "No carga / puerto dañado" },
    { label: "Desbloqueo", text: "Desbloqueo de cuenta / operadora" },
    { label: "Lista negra", text: "Remover de lista negra / blacklist" }
  ],
  checklist_presets: [
    { key: "screen_broken", label: "Pantalla rota", category: "Pantalla" },
    { key: "touch_not_working", label: "Touch no responde", category: "Touch" },
    { key: "battery_drains", label: "Batería se descarga rápido", category: "Batería" },
    { key: "port_damaged", label: "Puerto de carga dañado", category: "Carga" }
  ],
  customer_fields: [
    { name: "name", label: "Nombre", type: "text", required: true, visible: true },
    { name: "last_name", label: "Apellidos", type: "text", required: false, visible: true },
    { name: "phone", label: "Teléfono", type: "tel", required: true, visible: true },
    { name: "email", label: "Email", type: "email", required: false, visible: true }
  ],
  media_config: {
    max_files: 10,
    max_size_mb: 10,
    required: false,
    allow_video: true
  },
  signature_required: true,
  terms_required: true
};

function buildWizardConfigPayload(config = {}) {
  return {
    steps_enabled: {
      customer: true,
      device: true,
      problem: true,
      security: true,
      checklist: true,
      summary: true
    },
    steps_order: ["customer", "device", "problem", "security", "checklist", "summary"],
    customer_search_enabled: config.customer_search_enabled ?? true,
    customer_fields_required: config.customer_fields_required || {
      name: true,
      last_name: false,
      phone: true,
      email: false
    },
    device_auto_family: config.device_auto_family ?? true,
    problem_presets: Array.isArray(config.problem_presets) ? config.problem_presets : DEFAULT_CONFIG.problem_presets,
    media_config: {
      max_files: Number(config.media_config?.max_files ?? DEFAULT_CONFIG.media_config.max_files),
      max_size_mb: Number(config.media_config?.max_size_mb ?? DEFAULT_CONFIG.media_config.max_size_mb),
      required: config.media_config?.required ?? DEFAULT_CONFIG.media_config.required,
      allow_video: config.media_config?.allow_video ?? DEFAULT_CONFIG.media_config.allow_video,
      camera_first: config.media_config?.camera_first ?? true
    },
    security_config: {
      pin_required: config.security_config?.pin_required ?? false,
      password_required: config.security_config?.password_required ?? false,
      pattern_enabled: config.security_config?.pattern_enabled ?? true,
      encrypt_data: config.security_config?.encrypt_data ?? true
    },
    auto_send_email: config.auto_send_email ?? true,
    default_status: config.default_status || "intake",
    auto_assign: config.auto_assign ?? false,
    active: config.active ?? true
  };
}

export default function WizardConfigPanel() {
  const [config, setConfig] = useState(DEFAULT_CONFIG);
  const [loading, setLoading] = useState(false);
  const [loadingData, setLoadingData] = useState(true);

  useEffect(() => {
    loadConfig();
  }, []);

  const loadConfig = async () => {
    setLoadingData(true);
    try {
      const configs = await base44.entities.WorkOrderWizardConfig.list();
      if (configs?.length) {
        setConfig({ ...DEFAULT_CONFIG, ...configs[0] });
      }
    } catch (error) {
      console.error("Error loading wizard config:", error);
    } finally {
      setLoadingData(false);
    }
  };

  const saveConfig = async () => {
    toast.success("El catálogo se guarda automáticamente al crear, editar o eliminar.");
  };

  const addProblemPreset = () => {
    setConfig({
      ...config,
      problem_presets: [
        ...config.problem_presets,
        { label: "", text: "" }
      ]
    });
  };

  const updateProblemPreset = (index, field, value) => {
    const updated = [...config.problem_presets];
    updated[index] = { ...updated[index], [field]: value };
    setConfig({ ...config, problem_presets: updated });
  };

  const removeProblemPreset = (index) => {
    setConfig({
      ...config,
      problem_presets: config.problem_presets.filter((_, i) => i !== index)
    });
  };

  const addChecklistItem = () => {
    setConfig({
      ...config,
      checklist_presets: [
        ...config.checklist_presets,
        { key: `custom_${Date.now()}`, label: "", category: "General" }
      ]
    });
  };

  const updateChecklistItem = (index, field, value) => {
    const updated = [...config.checklist_presets];
    updated[index] = { ...updated[index], [field]: value };
    setConfig({ ...config, checklist_presets: updated });
  };

  const removeChecklistItem = (index) => {
    setConfig({
      ...config,
      checklist_presets: config.checklist_presets.filter((_, i) => i !== index)
    });
  };

  if (loadingData) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="w-8 h-8 animate-spin text-cyan-400" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* CATÁLOGO DE DISPOSITIVOS */}
      <DeviceCatalogManager />

      {/* Info */}
      <div className="bg-gradient-to-r from-blue-600/10 to-purple-600/10 border border-blue-500/20 rounded-xl p-4">
        <div className="flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-blue-400 flex-shrink-0 mt-0.5" />
          <div>
            <h4 className="text-white font-bold text-sm mb-1">
              Configuración en Tiempo Real
            </h4>
            <p className="text-blue-200/80 text-xs">
              Los cambios se aplicarán inmediatamente en el wizard de creación de órdenes.
              Puedes personalizar cada aspecto del proceso de recepción.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
