import React, { useState, useEffect } from "react";
import { dataClient } from "@/components/api/dataClient";
import { 
  ClipboardList, Wrench, Smartphone, Zap, X, Save, 
  Layout, Grid, Eye, EyeOff, GripVertical, Package,
  Wallet, BarChart3, Plus, Edit2, ExternalLink, Trash2
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { DragDropContext, Droppable, Draggable } from "@hello-pangea/dnd";

const ICON_OPTIONS = [
  { value: "ClipboardList", label: "Clipboard", component: ClipboardList },
  { value: "Wrench", label: "Herramienta", component: Wrench },
  { value: "Smartphone", label: "Teléfono", component: Smartphone },
  { value: "Zap", label: "Rayo", component: Zap },
  { value: "Package", label: "Paquete", component: Package },
  { value: "Wallet", label: "Billetera", component: Wallet },
  { value: "BarChart3", label: "Gráfica", component: BarChart3 },
  { value: "ExternalLink", label: "Enlace", component: ExternalLink }
];

const GRADIENT_OPTIONS = [
  { value: "from-purple-500 to-pink-600", label: "Morado-Rosa" },
  { value: "from-orange-500 to-red-600", label: "Naranja-Rojo" },
  { value: "from-indigo-500 to-purple-600", label: "Índigo-Morado" },
  { value: "from-amber-500 to-yellow-600", label: "Ámbar-Amarillo" },
  { value: "from-teal-500 to-cyan-600", label: "Verde-Cian" },
  { value: "from-green-600 to-emerald-700", label: "Verde-Esmeralda" },
  { value: "from-blue-600 to-indigo-700", label: "Azul-Índigo" },
  { value: "from-cyan-600 to-blue-600", label: "Cian-Azul" }
];

const PREDEFINED_BUTTONS = [
  {
    id: "new_order",
    label: "Nueva Orden",
    icon: "ClipboardList",
    gradient: "from-purple-500 to-pink-600",
    action: "showWorkOrderWizard",
    type: "modal"
  },
  {
    id: "quick_repair",
    label: "Órdenes Rápidas",
    icon: "Wrench",
    gradient: "from-orange-500 to-red-600",
    action: "showQuickRepair",
    type: "modal"
  },
  {
    id: "unlocks",
    label: "Desbloqueos",
    icon: "Smartphone",
    gradient: "from-indigo-500 to-purple-600",
    action: "showUnlocksDialog",
    type: "modal"
  },
  {
    id: "recharges",
    label: "Recargas",
    icon: "Zap",
    gradient: "from-amber-500 to-yellow-600",
    action: "Recharges",
    type: "navigate"
  },
  {
    id: "inventory",
    label: "Inventario",
    icon: "Package",
    gradient: "from-teal-500 to-cyan-600",
    action: "Settings",
    type: "navigate"
  },
  {
    id: "financial",
    label: "Finanzas",
    icon: "Wallet",
    gradient: "from-green-600 to-emerald-700",
    action: "Settings",
    type: "navigate"
  },
  {
    id: "reports",
    label: "Reportes",
    icon: "BarChart3",
    gradient: "from-blue-600 to-indigo-700",
    action: "Settings",
    type: "navigate"
  }
];

export default function DashboardLinksConfig({ open, onClose }) {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [buttons, setButtons] = useState([]);
  const [showCreateCustom, setShowCreateCustom] = useState(false);
  const [customButton, setCustomButton] = useState({
    label: "",
    icon: "ExternalLink",
    gradient: "from-cyan-600 to-blue-600",
    action: "",
    type: "navigate"
  });

  useEffect(() => {
    if (open) {
      loadConfig();
    }
  }, [open]);

  const loadConfig = async () => {
    setLoading(true);
    try {
      const configs = await dataClient.entities.AppSettings.filter({ slug: "dashboard-buttons" });
      
      if (configs?.length > 0) {
        const savedButtons = configs[0].payload?.buttons || [];
        
        // Combinar predefinidos con custom guardados
        const predefinedWithState = PREDEFINED_BUTTONS.map(btn => {
          const saved = savedButtons.find(s => s.id === btn.id);
          return {
            ...btn,
            enabled: saved !== undefined ? saved.enabled : (btn.id === "inventory" || btn.id === "financial" || btn.id === "reports" ? false : true),
            order: saved !== undefined ? saved.order : PREDEFINED_BUTTONS.indexOf(btn)
          };
        });
        
        const customButtons = savedButtons.filter(s => !PREDEFINED_BUTTONS.some(p => p.id === s.id));
        
        const allButtons = [...predefinedWithState, ...customButtons].sort((a, b) => a.order - b.order);
        setButtons(allButtons);
      } else {
        // Configuración por defecto: solo top 4 habilitados
        setButtons(PREDEFINED_BUTTONS.map((btn, idx) => ({
          ...btn,
          enabled: ["new_order", "quick_repair", "unlocks", "recharges"].includes(btn.id),
          order: idx
        })));
      }
    } catch (error) {
      console.error("Error loading dashboard buttons config:", error);
      toast.error("Error al cargar configuración");
      setButtons(PREDEFINED_BUTTONS.map((btn, idx) => ({
        ...btn,
        enabled: ["new_order", "quick_repair", "unlocks", "recharges"].includes(btn.id),
        order: idx
      })));
    } finally {
      setLoading(false);
    }
  };

  const handleToggle = (buttonId) => {
    setButtons(buttons.map(btn => 
      btn.id === buttonId ? { ...btn, enabled: !btn.enabled } : btn
    ));
  };

  const handleDeleteCustom = (buttonId) => {
    if (confirm("¿Eliminar este botón personalizado?")) {
      setButtons(buttons.filter(btn => btn.id !== buttonId));
    }
  };

  const handleCreateCustom = () => {
    if (!customButton.label.trim() || !customButton.action.trim()) {
      toast.error("Completa el nombre y la acción");
      return;
    }

    const newButton = {
      id: `custom_${Date.now()}`,
      label: customButton.label,
      icon: customButton.icon,
      gradient: customButton.gradient,
      action: customButton.action,
      type: customButton.type,
      isCustom: true,
      enabled: true,
      order: buttons.length
    };

    setButtons([...buttons, newButton]);
    setCustomButton({
      label: "",
      icon: "ExternalLink",
      gradient: "from-cyan-600 to-blue-600",
      action: "",
      type: "navigate"
    });
    setShowCreateCustom(false);
    toast.success("✅ Botón creado");
  };

  const handleDragEnd = (result) => {
    if (!result.destination) return;

    const items = Array.from(buttons);
    const [reorderedItem] = items.splice(result.source.index, 1);
    items.splice(result.destination.index, 0, reorderedItem);

    const updatedButtons = items.map((btn, idx) => ({
      ...btn,
      order: idx
    }));

    setButtons(updatedButtons);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const configs = await dataClient.entities.AppSettings.filter({ slug: "dashboard-buttons" });
      
      const payload = {
        buttons: buttons.map(btn => ({
          id: btn.id,
          label: btn.label,
          icon: btn.icon,
          gradient: btn.gradient,
          action: btn.action,
          type: btn.type,
          isCustom: btn.isCustom || false,
          enabled: btn.enabled,
          order: btn.order
        }))
      };

      if (configs?.length > 0) {
        await dataClient.entities.AppSettings.update(configs[0].id, { payload });
      } else {
        await dataClient.entities.AppSettings.create({
          slug: "dashboard-buttons",
          payload
        });
      }

      toast.success("✅ Configuración guardada");
      window.dispatchEvent(new CustomEvent('dashboard-buttons-updated'));
      onClose();
    } catch (error) {
      console.error("Error saving dashboard buttons config:", error);
      toast.error("Error al guardar configuración");
    } finally {
      setSaving(false);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[9999] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 rounded-3xl border border-cyan-500/30 max-w-3xl w-full max-h-[90vh] overflow-hidden shadow-[0_0_100px_rgba(6,182,212,0.3)]">
        {/* Header */}
        <div className="relative overflow-hidden bg-gradient-to-r from-cyan-600/20 to-emerald-600/20 border-b border-cyan-500/30 p-6">
          <div className="absolute inset-0 bg-gradient-to-r from-cyan-500/5 to-emerald-500/5" />
          <div className="relative flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-cyan-500 to-emerald-500 flex items-center justify-center shadow-lg">
                <Layout className="w-8 h-8 text-white" />
              </div>
              <div>
                <h2 className="text-2xl font-black text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-emerald-400">
                  Enlaces del Dashboard
                </h2>
                <p className="text-cyan-300/70 text-sm mt-1">
                  Personaliza los botones de acceso rápido
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="w-10 h-10 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 flex items-center justify-center transition-all"
            >
              <X className="w-5 h-5 text-white" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto max-h-[calc(90vh-200px)]">
          {loading ? (
            <div className="text-center py-12">
              <div className="w-12 h-12 border-4 border-cyan-500/30 border-t-cyan-500 rounded-full animate-spin mx-auto mb-4" />
              <p className="text-cyan-300/70">Cargando configuración...</p>
            </div>
          ) : (
            <>
              <div className="mb-6 bg-cyan-500/10 border border-cyan-500/30 rounded-2xl p-4">
                <div className="flex items-start gap-3">
                  <Grid className="w-5 h-5 text-cyan-400 mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="text-white font-semibold mb-1">Gestiona tus Botones</p>
                    <p className="text-cyan-300/70 text-sm">
                      Arrastra para reordenar • Activa/Desactiva según necesites • Crea botones personalizados
                    </p>
                  </div>
                </div>
              </div>

              {/* Botón para crear personalizado */}
              <Button
                onClick={() => setShowCreateCustom(!showCreateCustom)}
                className="w-full mb-4 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 h-12 shadow-lg"
              >
                <Plus className="w-5 h-5 mr-2" />
                Crear Botón Personalizado
              </Button>

              {/* Formulario para crear botón personalizado */}
              {showCreateCustom && (
                <div className="mb-6 bg-slate-800/60 border border-purple-500/30 rounded-2xl p-4 space-y-3">
                  <h4 className="text-white font-bold flex items-center gap-2">
                    <Plus className="w-5 h-5 text-purple-400" />
                    Nuevo Botón Personalizado
                  </h4>
                  
                  <div>
                    <label className="text-xs text-gray-400 mb-1 block">Nombre del Botón</label>
                    <Input
                      value={customButton.label}
                      onChange={(e) => setCustomButton({...customButton, label: e.target.value})}
                      placeholder="Ej: Mis Notas, Ver Clientes..."
                      className="bg-black/40 border-white/10 text-white"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs text-gray-400 mb-1 block">Ícono</label>
                      <select
                        value={customButton.icon}
                        onChange={(e) => setCustomButton({...customButton, icon: e.target.value})}
                        className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-sm text-white"
                      >
                        {ICON_OPTIONS.map(opt => (
                          <option key={opt.value} value={opt.value}>{opt.label}</option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="text-xs text-gray-400 mb-1 block">Gradiente</label>
                      <select
                        value={customButton.gradient}
                        onChange={(e) => setCustomButton({...customButton, gradient: e.target.value})}
                        className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-sm text-white"
                      >
                        {GRADIENT_OPTIONS.map(opt => (
                          <option key={opt.value} value={opt.value}>{opt.label}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="text-xs text-gray-400 mb-1 block">Tipo de Acción</label>
                    <select
                      value={customButton.type}
                      onChange={(e) => setCustomButton({...customButton, type: e.target.value})}
                      className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-sm text-white"
                    >
                      <option value="navigate">Navegar a Página</option>
                      <option value="external">URL Externa</option>
                    </select>
                  </div>

                  <div>
                    <label className="text-xs text-gray-400 mb-1 block">
                      {customButton.type === "navigate" ? "Nombre de Página" : "URL Externa"}
                    </label>
                    <Input
                      value={customButton.action}
                      onChange={(e) => setCustomButton({...customButton, action: e.target.value})}
                      placeholder={customButton.type === "navigate" ? "Ej: Customers, Orders..." : "https://..."}
                      className="bg-black/40 border-white/10 text-white"
                    />
                  </div>

                  <div className="flex gap-2">
                    <Button
                      onClick={() => setShowCreateCustom(false)}
                      variant="outline"
                      className="flex-1 border-slate-600"
                    >
                      Cancelar
                    </Button>
                    <Button
                      onClick={handleCreateCustom}
                      className="flex-1 bg-gradient-to-r from-purple-600 to-pink-600"
                    >
                      <Plus className="w-4 h-4 mr-2" />
                      Crear
                    </Button>
                  </div>
                </div>
              )}

              <DragDropContext onDragEnd={handleDragEnd}>
                <Droppable droppableId="buttons">
                  {(provided) => (
                    <div
                      {...provided.droppableProps}
                      ref={provided.innerRef}
                      className="space-y-3"
                    >
                      {buttons.map((button, index) => {
                        const IconComponent = typeof button.icon === 'string' 
                          ? ICON_OPTIONS.find(i => i.value === button.icon)?.component || ExternalLink
                          : button.icon;
                        
                        return (
                          <Draggable key={button.id} draggableId={button.id} index={index}>
                            {(provided, snapshot) => (
                              <div
                                ref={provided.innerRef}
                                {...provided.draggableProps}
                                className={`relative overflow-hidden rounded-2xl border transition-all ${
                                  snapshot.isDragging
                                    ? "border-cyan-500 shadow-[0_0_40px_rgba(6,182,212,0.4)] scale-105"
                                    : button.enabled
                                    ? "border-cyan-500/30 bg-slate-800/40 hover:border-cyan-500/50"
                                    : "border-slate-700/30 bg-slate-900/40 opacity-60"
                                }`}
                              >
                                <div className="flex items-center gap-4 p-4">
                                  <div
                                    {...provided.dragHandleProps}
                                    className="cursor-grab active:cursor-grabbing"
                                  >
                                    <GripVertical className="w-5 h-5 text-slate-500" />
                                  </div>

                                  <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${button.gradient} flex items-center justify-center shadow-lg flex-shrink-0`}>
                                    <IconComponent className="w-6 h-6 text-white" />
                                  </div>

                                  <div className="flex-1">
                                    <p className="text-white font-bold">{button.label}</p>
                                    <p className="text-slate-400 text-xs mt-0.5">
                                      {button.isCustom ? `Custom • ${button.type === 'external' ? 'URL' : 'Página'}: ${button.action}` : `Orden: ${index + 1}`}
                                    </p>
                                  </div>

                                  {button.isCustom && (
                                    <Button
                                      onClick={() => handleDeleteCustom(button.id)}
                                      variant="ghost"
                                      size="icon"
                                      className="text-red-400 hover:text-red-300 hover:bg-red-600/20"
                                    >
                                      <Trash2 className="w-4 h-4" />
                                    </Button>
                                  )}

                                  <button
                                    onClick={() => handleToggle(button.id)}
                                    className={`px-4 py-2 rounded-xl font-semibold text-sm transition-all flex items-center gap-2 ${
                                      button.enabled
                                        ? "bg-gradient-to-r from-emerald-500 to-green-600 text-white shadow-lg"
                                        : "bg-slate-700/50 text-slate-400 border border-slate-600"
                                    }`}
                                  >
                                    {button.enabled ? (
                                      <>
                                        <Eye className="w-4 h-4" />
                                        Activo
                                      </>
                                    ) : (
                                      <>
                                        <EyeOff className="w-4 h-4" />
                                        Inactivo
                                      </>
                                    )}
                                  </button>
                                </div>
                              </div>
                            )}
                          </Draggable>
                        );
                      })}
                      {provided.placeholder}
                    </div>
                  )}
                </Droppable>
              </DragDropContext>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-cyan-500/30 bg-slate-900/60 backdrop-blur-xl p-6 flex items-center justify-between gap-4">
          <p className="text-slate-400 text-sm">
            Los cambios se aplicarán inmediatamente
          </p>
          <div className="flex gap-3">
            <Button
              onClick={onClose}
              variant="outline"
              className="border-slate-600 text-slate-300 hover:bg-slate-800"
              disabled={saving}
            >
              Cancelar
            </Button>
            <Button
              onClick={handleSave}
              disabled={saving || loading}
              className="bg-gradient-to-r from-cyan-500 to-emerald-600 hover:from-cyan-600 hover:to-emerald-700 text-white shadow-lg"
            >
              {saving ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin mr-2" />
                  Guardando...
                </>
              ) : (
                <>
                  <Save className="w-4 h-4 mr-2" />
                  Guardar Cambios
                </>
              )}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
