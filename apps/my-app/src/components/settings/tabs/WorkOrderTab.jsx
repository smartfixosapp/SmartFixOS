import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ChevronUp, ChevronDown, Save, RefreshCw } from "lucide-react";

const STEPS = [
  { id: "customer", label: "Cliente" },
  { id: "brand", label: "Marca" },
  { id: "subcategory", label: "Subcategoría" },
  { id: "family", label: "Familia" },
  { id: "model", label: "Modelo" },
  { id: "problem", label: "Diagnóstico/Piezas" },
  { id: "security", label: "Seguridad" },
  { id: "checklist", label: "Checklist" },
  { id: "assignment", label: "Asignación" },
  { id: "signature", label: "Firma" },
  { id: "summary", label: "Resumen" }
];

const DEFAULT_SETTINGS = {
  wizard: {
    steps_order: ["customer", "brand", "subcategory", "family", "model", "problem", "security", "checklist", "assignment", "signature", "summary"],
    steps_enabled: {
      customer: true,
      brand: true,
      subcategory: true,
      family: true,
      model: true,
      problem: true,
      security: true,
      checklist: true,
      assignment: true,
      signature: true,
      summary: true
    },
    auto_advance: false,
    signature_policy: "required_before_create",
    require_family_by_brand: {
      apple: "required",
      samsung: "auto",
      default: "skip"
    },
    media: {
      require_photo_on_intake: false,
      allow_video: true,
      max_photo_size_mb: 10,
      max_video_size_mb: 50
    }
  },
  panel: {
    default_view: "summary",
    timeline: {
      enable_images: true,
      lightbox: true,
      swipe_navigation: true
    },
    comments: {
      enable_mentions: true,
      enable_attachments: true
    }
  }
};

export default function WorkOrderTab({ user }) {
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  const [originalSettings, setOriginalSettings] = useState(DEFAULT_SETTINGS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);

  useEffect(() => {
    loadSettings();
  }, []);

  useEffect(() => {
    const isDirty = JSON.stringify(settings) !== JSON.stringify(originalSettings);
    if (isDirty !== hasChanges) {
      setHasChanges(isDirty);
      if (isDirty) {
        window.dispatchEvent(new Event("settings-dirty"));
      } else {
        window.dispatchEvent(new Event("settings-clean"));
      }
    }
  }, [settings, originalSettings, hasChanges]);

  useEffect(() => {
    const onSave = () => saveSettings();
    const onRevert = () => setSettings(originalSettings);
    
    window.addEventListener("settings-save", onSave);
    window.addEventListener("settings-revert", onRevert);
    
    return () => {
      window.removeEventListener("settings-save", onSave);
      window.removeEventListener("settings-revert", onRevert);
    };
  }, [originalSettings]);

  const loadSettings = async () => {
    setLoading(true);
    try {
      const rows = await base44.entities.SystemConfig.filter({ key: "settings.workorder" });
      
      if (rows && rows.length > 0) {
        const raw = rows[0].value || rows[0].value_json;
        let loadedSettings = DEFAULT_SETTINGS;
        
        if (typeof raw === "string") {
          try {
            loadedSettings = JSON.parse(raw);
          } catch (e) {
            console.warn("Error parsing workorder settings:", e);
            loadedSettings = DEFAULT_SETTINGS;
          }
        } else if (typeof raw === "object" && raw !== null) {
          loadedSettings = raw;
        }

        // Merge with defaults to ensure all properties exist
        const mergedSettings = {
          wizard: {
            ...DEFAULT_SETTINGS.wizard,
            ...loadedSettings.wizard,
            steps_enabled: {
              ...DEFAULT_SETTINGS.wizard.steps_enabled,
              ...loadedSettings.wizard?.steps_enabled
            },
            require_family_by_brand: {
              ...DEFAULT_SETTINGS.wizard.require_family_by_brand,
              ...loadedSettings.wizard?.require_family_by_brand
            },
            media: {
              ...DEFAULT_SETTINGS.wizard.media,
              ...loadedSettings.wizard?.media
            }
          },
          panel: {
            ...DEFAULT_SETTINGS.panel,
            ...loadedSettings.panel,
            timeline: {
              ...DEFAULT_SETTINGS.panel.timeline,
              ...loadedSettings.panel?.timeline
            },
            comments: {
              ...DEFAULT_SETTINGS.panel.comments,
              ...loadedSettings.panel?.comments
            }
          }
        };

        setSettings(mergedSettings);
        setOriginalSettings(mergedSettings);
      } else {
        setSettings(DEFAULT_SETTINGS);
        setOriginalSettings(DEFAULT_SETTINGS);
      }
    } catch (error) {
      console.error("Error loading workorder settings:", error);
      setSettings(DEFAULT_SETTINGS);
      setOriginalSettings(DEFAULT_SETTINGS);
    }
    setLoading(false);
  };

  const saveSettings = async () => {
    setSaving(true);
    try {
      const rows = await base44.entities.SystemConfig.filter({ key: "settings.workorder" });
      
      const payload = {
        key: "settings.workorder",
        value: JSON.stringify(settings),
        category: "general",
        description: "Configuración de Work Order Wizard"
      };

      if (rows && rows.length > 0) {
        await base44.entities.SystemConfig.update(rows[0].id, payload);
      } else {
        await base44.entities.SystemConfig.create(payload);
      }

      // Audit log
      if (user) {
        await base44.entities.AuditLog.create({
          action: "settings_update",
          entity_type: "config",
          entity_id: "settings.workorder",
          user_id: user.id,
          user_name: user.full_name || user.email || "Sistema",
          user_role: user.role || "admin",
          changes: { before: originalSettings, after: settings }
        });
      }

      setOriginalSettings(settings);
      setHasChanges(false);
      window.dispatchEvent(new Event("settings-clean"));
      
      alert("✅ Configuración guardada correctamente");
    } catch (error) {
      console.error("Error saving workorder settings:", error);
      alert("❌ Error al guardar: " + error.message);
    }
    setSaving(false);
  };

  const handleStepMove = (index, direction) => {
    const newOrder = [...settings.wizard.steps_order];
    const newIndex = index + direction;

    if (newIndex < 0 || newIndex >= newOrder.length) return;

    [newOrder[index], newOrder[newIndex]] = [newOrder[newIndex], newOrder[index]];

    setSettings({
      ...settings,
      wizard: { ...settings.wizard, steps_order: newOrder }
    });
  };

  const handleStepToggle = (stepId, enabled) => {
    setSettings({
      ...settings,
      wizard: {
        ...settings.wizard,
        steps_enabled: {
          ...settings.wizard.steps_enabled,
          [stepId]: enabled
        }
      }
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <RefreshCw className="w-8 h-8 animate-spin text-red-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Wizard Configuration */}
      <Card className="bg-zinc-900/50 border-white/10">
        <CardHeader>
          <CardTitle>Configuración del Wizard</CardTitle>
          <CardDescription>Personaliza el flujo de creación de órdenes</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Steps Order */}
          <div>
            <Label className="text-base font-semibold mb-3 block">Orden de pasos</Label>
            <div className="space-y-2">
              {settings.wizard.steps_order.map((stepId, index) => {
                const step = STEPS.find((s) => s.id === stepId);
                const enabled = settings.wizard.steps_enabled[stepId] !== false;

                return (
                  <div key={stepId} className="flex items-center gap-3 p-3 bg-black/30 rounded-lg border border-white/10">
                    <div className="flex flex-col gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 w-6 p-0"
                        onClick={() => handleStepMove(index, -1)}
                        disabled={index === 0}
                      >
                        <ChevronUp className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 w-6 p-0"
                        onClick={() => handleStepMove(index, 1)}
                        disabled={index === settings.wizard.steps_order.length - 1}
                      >
                        <ChevronDown className="w-4 h-4" />
                      </Button>
                    </div>
                    
                    <span className="text-slate-50 text-sm flex-1">{index + 1}. {step?.label || stepId}</span>
                    
                    <Switch
                      checked={enabled}
                      onCheckedChange={(checked) => handleStepToggle(stepId, checked)}
                    />
                  </div>
                );
              })}
            </div>
          </div>

          {/* Auto Advance */}
          <div className="flex items-center justify-between p-3 bg-black/30 rounded-lg">
            <div>
              <Label className="text-sm font-medium">Auto-avanzar</Label>
              <p className="text-xs text-gray-400">Pasar automáticamente al siguiente paso</p>
            </div>
            <Switch
              checked={settings.wizard.auto_advance}
              onCheckedChange={(v) => setSettings({ ...settings, wizard: { ...settings.wizard, auto_advance: v } })}
            />
          </div>

          {/* Signature Policy */}
          <div className="space-y-2">
            <Label>Política de firma</Label>
            <Select
              value={settings.wizard.signature_policy}
              onValueChange={(v) => setSettings({ ...settings, wizard: { ...settings.wizard, signature_policy: v } })}
            >
              <SelectTrigger className="bg-black border-white/15">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="required_before_create">Requerida antes de crear</SelectItem>
                <SelectItem value="allow_later">Permitir firmar después</SelectItem>
                <SelectItem value="optional">Opcional</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Family Requirements by Brand */}
          <div className="space-y-3">
            <Label className="text-base font-semibold">Requerir familia por marca</Label>
            
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="space-y-2">
                <Label className="text-xs text-gray-400">Apple</Label>
                <Select
                  value={settings.wizard.require_family_by_brand.apple}
                  onValueChange={(v) => setSettings({
                    ...settings,
                    wizard: {
                      ...settings.wizard,
                      require_family_by_brand: {
                        ...settings.wizard.require_family_by_brand,
                        apple: v
                      }
                    }
                  })}
                >
                  <SelectTrigger className="bg-black border-white/15">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="skip">Saltar</SelectItem>
                    <SelectItem value="auto">Auto</SelectItem>
                    <SelectItem value="required">Requerido</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label className="text-xs text-gray-400">Samsung</Label>
                <Select
                  value={settings.wizard.require_family_by_brand.samsung}
                  onValueChange={(v) => setSettings({
                    ...settings,
                    wizard: {
                      ...settings.wizard,
                      require_family_by_brand: {
                        ...settings.wizard.require_family_by_brand,
                        samsung: v
                      }
                    }
                  })}
                >
                  <SelectTrigger className="bg-black border-white/15">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="skip">Saltar</SelectItem>
                    <SelectItem value="auto">Auto</SelectItem>
                    <SelectItem value="required">Requerido</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label className="text-xs text-gray-400">Por defecto</Label>
                <Select
                  value={settings.wizard.require_family_by_brand.default}
                  onValueChange={(v) => setSettings({
                    ...settings,
                    wizard: {
                      ...settings.wizard,
                      require_family_by_brand: {
                        ...settings.wizard.require_family_by_brand,
                        default: v
                      }
                    }
                  })}
                >
                  <SelectTrigger className="bg-black border-white/15">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="skip">Saltar</SelectItem>
                    <SelectItem value="auto">Auto</SelectItem>
                    <SelectItem value="required">Requerido</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          {/* Media Settings */}
          <div className="space-y-3">
            <Label className="text-base font-semibold">Media</Label>
            
            <div className="flex items-center justify-between p-3 bg-black/30 rounded-lg">
              <div>
                <Label className="text-sm">Requerir foto al ingresar</Label>
                <p className="text-xs text-gray-400">Obligar foto en la recepción</p>
              </div>
              <Switch
                checked={settings.wizard.media.require_photo_on_intake}
                onCheckedChange={(v) => setSettings({
                  ...settings,
                  wizard: {
                    ...settings.wizard,
                    media: { ...settings.wizard.media, require_photo_on_intake: v }
                  }
                })}
              />
            </div>

            <div className="flex items-center justify-between p-3 bg-black/30 rounded-lg">
              <div>
                <Label className="text-sm">Permitir videos</Label>
                <p className="text-xs text-gray-400">Habilitar carga de videos</p>
              </div>
              <Switch
                checked={settings.wizard.media.allow_video}
                onCheckedChange={(v) => setSettings({
                  ...settings,
                  wizard: {
                    ...settings.wizard,
                    media: { ...settings.wizard.media, allow_video: v }
                  }
                })}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label className="text-xs">Máx. tamaño foto (MB)</Label>
                <Input
                  type="number"
                  value={settings.wizard.media.max_photo_size_mb}
                  onChange={(e) => setSettings({
                    ...settings,
                    wizard: {
                      ...settings.wizard,
                      media: { ...settings.wizard.media, max_photo_size_mb: Number(e.target.value) }
                    }
                  })}
                  className="bg-black border-white/15"
                />
              </div>

              <div className="space-y-2">
                <Label className="text-xs">Máx. tamaño video (MB)</Label>
                <Input
                  type="number"
                  value={settings.wizard.media.max_video_size_mb}
                  onChange={(e) => setSettings({
                    ...settings,
                    wizard: {
                      ...settings.wizard,
                      media: { ...settings.wizard.media, max_video_size_mb: Number(e.target.value) }
                    }
                  })}
                  className="bg-black border-white/15"
                  disabled={!settings.wizard.media.allow_video}
                />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Panel Configuration */}
      <Card className="bg-zinc-900/50 border-white/10">
        <CardHeader>
          <CardTitle>Configuración del Panel</CardTitle>
          <CardDescription>Personaliza la vista de órdenes individuales</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Vista por defecto</Label>
            <Select
              value={settings.panel.default_view}
              onValueChange={(v) => setSettings({ ...settings, panel: { ...settings.panel, default_view: v } })}
            >
              <SelectTrigger className="bg-black border-white/15">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="summary">Resumen</SelectItem>
                <SelectItem value="timeline">Timeline</SelectItem>
                <SelectItem value="checklist">Checklist</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-3">
            <Label className="text-sm font-semibold">Timeline</Label>
            
            <div className="flex items-center justify-between p-3 bg-black/30 rounded-lg">
              <Label className="text-sm">Mostrar imágenes inline</Label>
              <Switch
                checked={settings.panel.timeline.enable_images}
                onCheckedChange={(v) => setSettings({
                  ...settings,
                  panel: {
                    ...settings.panel,
                    timeline: { ...settings.panel.timeline, enable_images: v }
                  }
                })}
              />
            </div>

            <div className="flex items-center justify-between p-3 bg-black/30 rounded-lg">
              <Label className="text-sm">Lightbox</Label>
              <Switch
                checked={settings.panel.timeline.lightbox}
                onCheckedChange={(v) => setSettings({
                  ...settings,
                  panel: {
                    ...settings.panel,
                    timeline: { ...settings.panel.timeline, lightbox: v }
                  }
                })}
              />
            </div>

            <div className="flex items-center justify-between p-3 bg-black/30 rounded-lg">
              <Label className="text-sm">Navegación por swipe</Label>
              <Switch
                checked={settings.panel.timeline.swipe_navigation}
                onCheckedChange={(v) => setSettings({
                  ...settings,
                  panel: {
                    ...settings.panel,
                    timeline: { ...settings.panel.timeline, swipe_navigation: v }
                  }
                })}
              />
            </div>
          </div>

          <div className="space-y-3">
            <Label className="text-sm font-semibold">Comentarios</Label>
            
            <div className="flex items-center justify-between p-3 bg-black/30 rounded-lg">
              <Label className="text-sm">Habilitar menciones (@usuario)</Label>
              <Switch
                checked={settings.panel.comments.enable_mentions}
                onCheckedChange={(v) => setSettings({
                  ...settings,
                  panel: {
                    ...settings.panel,
                    comments: { ...settings.panel.comments, enable_mentions: v }
                  }
                })}
              />
            </div>

            <div className="flex items-center justify-between p-3 bg-black/30 rounded-lg">
              <Label className="text-sm">Permitir adjuntos</Label>
              <Switch
                checked={settings.panel.comments.enable_attachments}
                onCheckedChange={(v) => setSettings({
                  ...settings,
                  panel: {
                    ...settings.panel,
                    comments: { ...settings.panel.comments, enable_attachments: v }
                  }
                })}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Catalog Management Info */}
      <Card className="bg-zinc-900/50 border-white/10">
        <CardHeader>
          <CardTitle>Gestión de Catálogo</CardTitle>
          <CardDescription>Administrar marcas, tipos, familias y modelos</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-gray-400">
            La gestión completa del catálogo estará disponible próximamente. 
            Por ahora puedes gestionar los datos desde el Dashboard → Data.
          </p>
        </CardContent>
      </Card>

      {/* Save Button */}
      {hasChanges && (
        <div className="fixed bottom-6 right-6 z-50">
          <Button
            onClick={saveSettings}
            disabled={saving}
            className="bg-gradient-to-r from-red-600 to-red-800 hover:from-red-700 hover:to-red-900 shadow-lg"
          >
            {saving ? (
              <>
                <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
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
      )}
    </div>
  );
}
