import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import DeviceCatalogManager from "@/components/settings/DeviceCatalogManager";
import {
  Save, Loader2, Plus, Trash2, GripVertical, User, Smartphone, 
  Wrench, Shield, CheckSquare, ClipboardList, AlertCircle, Eye, EyeOff
} from "lucide-react";

const DEFAULT_CONFIG = {
  key: "default",
  steps_enabled: {
    customer: true,
    device: true,
    problem: true,
    security: true,
    checklist: true,
    summary: true
  },
  steps_order: ["customer", "device", "problem", "security", "checklist", "summary"],
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

const STEP_ICONS = {
  customer: User,
  device: Smartphone,
  problem: Wrench,
  security: Shield,
  checklist: CheckSquare,
  summary: ClipboardList
};

function buildWizardConfigPayload(config = {}) {
  return {
    steps_enabled: config.steps_enabled || DEFAULT_CONFIG.steps_enabled,
    steps_order: Array.isArray(config.steps_order) ? config.steps_order : DEFAULT_CONFIG.steps_order,
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
  const [activeTab, setActiveTab] = useState("steps");

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
    if (activeTab === "catalog") {
      toast.success("El catálogo se guarda automáticamente al crear, editar o eliminar.");
      return;
    }

    setLoading(true);
    try {
      const payload = buildWizardConfigPayload(config);
      const configs = await base44.entities.WorkOrderWizardConfig.list();
      if (configs?.length) {
        await base44.entities.WorkOrderWizardConfig.update(configs[0].id, payload);
      } else {
        await base44.entities.WorkOrderWizardConfig.create(payload);
      }
      toast.success("✅ Configuración del wizard guardada");
    } catch (error) {
      console.error("Error saving config:", error);
      toast.error("Error al guardar configuración");
    } finally {
      setLoading(false);
    }
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

  const tabs = [
    { id: "steps", label: "Pasos", icon: ClipboardList },
    { id: "customer", label: "Cliente", icon: User },
    { id: "catalog", label: "Catálogo", icon: Smartphone }
  ];

  return (
    <div className="space-y-6">
      {/* Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`group relative overflow-hidden rounded-2xl p-6 text-left transition-all border-2 ${
                isActive
                  ? "bg-gradient-to-br from-cyan-600/30 to-emerald-600/30 border-cyan-400/50 shadow-lg shadow-cyan-500/20"
                  : "bg-black/40 border-white/10 hover:border-cyan-500/30 hover:bg-white/5"
              }`}
            >
              <div className={`w-14 h-14 rounded-xl flex items-center justify-center mb-4 ${
                isActive
                  ? "bg-gradient-to-br from-cyan-500 to-emerald-600"
                  : "bg-white/10"
              }`}>
                <Icon className={`w-7 h-7 ${isActive ? "text-white" : "text-cyan-400"}`} />
              </div>
              <h3 className={`font-bold text-base mb-1 ${isActive ? "text-white" : "text-gray-200"}`}>
                {tab.label}
              </h3>
              <p className="text-xs text-gray-400">
                {tab.id === "steps" && "Activar/desactivar pasos"}
                {tab.id === "customer" && "Campos del cliente"}
                {tab.id === "catalog" && "Tipos, marcas, modelos"}
              </p>
            </button>
          );
        })}
      </div>

      {/* PASOS */}
      {activeTab === "steps" && (
        <div className="space-y-4">
          <Card className="bg-black/40 border border-cyan-500/20 p-6">
            <h3 className="text-white font-bold mb-4 flex items-center gap-2">
              <ClipboardList className="w-5 h-5 text-cyan-400" />
              Pasos del Wizard
            </h3>
            <p className="text-xs text-gray-400 mb-4">
              Activa o desactiva los pasos que se mostrarán al crear una orden
            </p>
            <div className="space-y-3">
              {config.steps_order.map((stepKey) => {
                const Icon = STEP_ICONS[stepKey];
                const stepLabels = {
                  customer: "Cliente",
                  device: "Dispositivo",
                  problem: "Problema",
                  security: "Seguridad",
                  checklist: "Checklist",
                  summary: "Resumen"
                };
                return (
                  <div
                    key={stepKey}
                    className="flex items-center justify-between p-4 bg-black/30 border border-white/10 rounded-xl"
                  >
                    <div className="flex items-center gap-3">
                      <GripVertical className="w-4 h-4 text-gray-500" />
                      {Icon && <Icon className="w-5 h-5 text-cyan-400" />}
                      <span className="text-white font-medium">{stepLabels[stepKey]}</span>
                    </div>
                    <Switch
                      checked={config.steps_enabled[stepKey]}
                      onCheckedChange={(checked) => {
                        if (stepKey === "customer" || stepKey === "device" || stepKey === "summary") {
                          toast.error("Este paso es obligatorio");
                          return;
                        }
                        setConfig({
                          ...config,
                          steps_enabled: {
                            ...config.steps_enabled,
                            [stepKey]: checked
                          }
                        });
                      }}
                    />
                  </div>
                );
              })}
            </div>
            <div className="mt-4 bg-blue-600/10 border border-blue-500/20 rounded-lg p-3">
              <p className="text-blue-300 text-xs">
                💡 Los pasos Cliente, Dispositivo y Resumen son obligatorios y no se pueden desactivar
              </p>
            </div>
          </Card>
        </div>
      )}

      {/* CAMPOS DE CLIENTE */}
      {activeTab === "customer" && (
        <div className="space-y-4">
          <Card className="bg-black/40 border border-cyan-500/20 p-6">
            <h3 className="text-white font-bold mb-4 flex items-center gap-2">
              <User className="w-5 h-5 text-cyan-400" />
              Campos del Cliente
            </h3>
            <div className="space-y-3">
              {config.customer_fields.map((field, index) => (
                <div
                  key={index}
                  className="flex items-center gap-3 p-3 bg-black/30 border border-white/10 rounded-lg"
                >
                  <div className="flex-1 grid grid-cols-2 gap-3">
                    <Input
                      value={field.label}
                      onChange={(e) => {
                        const updated = [...config.customer_fields];
                        updated[index].label = e.target.value;
                        setConfig({ ...config, customer_fields: updated });
                      }}
                      placeholder="Etiqueta"
                      className="bg-black/30 border-white/10 text-white"
                    />
                    <select
                      value={field.type}
                      onChange={(e) => {
                        const updated = [...config.customer_fields];
                        updated[index].type = e.target.value;
                        setConfig({ ...config, customer_fields: updated });
                      }}
                      className="bg-black/30 border border-white/10 rounded-lg px-3 py-2 text-white text-sm"
                    >
                      <option value="text">Texto</option>
                      <option value="email">Email</option>
                      <option value="tel">Teléfono</option>
                      <option value="textarea">Área de texto</option>
                    </select>
                  </div>
                  <div className="flex items-center gap-2">
                    <label className="text-xs text-gray-400">Requerido</label>
                    <Switch
                      checked={field.required}
                      onCheckedChange={(checked) => {
                        const updated = [...config.customer_fields];
                        updated[index].required = checked;
                        setConfig({ ...config, customer_fields: updated });
                      }}
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <label className="text-xs text-gray-400">Visible</label>
                    <Switch
                      checked={field.visible}
                      onCheckedChange={(checked) => {
                        const updated = [...config.customer_fields];
                        updated[index].visible = checked;
                        setConfig({ ...config, customer_fields: updated });
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </div>
      )}

      {/* CATÁLOGO DE DISPOSITIVOS */}
      {activeTab === "catalog" && (
        <DeviceCatalogManager />
      )}

      {/* Botón Guardar */}
      <Button
        onClick={saveConfig}
        disabled={loading}
        className="w-full bg-gradient-to-r from-cyan-600 to-emerald-600 h-14 text-lg font-bold shadow-lg"
      >
        {loading ? (
          <>
            <Loader2 className="w-5 h-5 mr-2 animate-spin" />
            Guardando...
          </>
        ) : (
          <>
            <Save className="w-5 h-5 mr-2" />
            {activeTab === "catalog" ? "Catálogo con guardado automático" : "Guardar Configuración"}
          </>
        )}
      </Button>

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
