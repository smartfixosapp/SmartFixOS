import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { 
  Plus, 
  Trash2, 
  Edit, 
  ToggleLeft, 
  ToggleRight,
  Bell,
  Clock,
  Users,
  Settings as SettingsIcon,
  Save,
  X
} from "lucide-react";
import { dataClient } from "@/components/api/dataClient";
import { toast } from "sonner";

export default function NotificationRulesManager() {
  const [rules, setRules] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingRule, setEditingRule] = useState(null);

  useEffect(() => {
    loadRules();
  }, []);

  const loadRules = async () => {
    try {
      const data = await dataClient.entities.NotificationRule.list("-created_date");
      setRules(data || []);
    } catch (error) {
      console.error("Error loading rules:", error);
      toast.error("Error al cargar reglas");
    } finally {
      setLoading(false);
    }
  };

  const handleToggleActive = async (rule) => {
    try {
      await dataClient.entities.NotificationRule.update(rule.id, {
        active: !rule.active
      });
      toast.success(rule.active ? "Regla desactivada" : "Regla activada");
      loadRules();
    } catch (error) {
      toast.error("Error al actualizar regla");
    }
  };

  const handleDelete = async (ruleId) => {
    if (!confirm("¿Eliminar esta regla?")) return;
    
    try {
      await dataClient.entities.NotificationRule.delete(ruleId);
      toast.success("Regla eliminada");
      loadRules();
    } catch (error) {
      toast.error("Error al eliminar regla");
    }
  };

  const triggerTypeLabels = {
    low_stock: "📦 Stock Bajo",
    pending_order: "⏳ Orden Pendiente",
    inactive_customer: "😴 Cliente Inactivo",
    order_deadline: "⚠️ Deadline Cercano",
    payment_due: "💰 Pago Pendiente",
    custom_condition: "⚙️ Condición Personalizada"
  };

  const priorityColors = {
    low: "bg-gray-500/20 text-gray-400",
    normal: "bg-blue-500/20 text-blue-400",
    high: "bg-orange-500/20 text-orange-400",
    urgent: "bg-red-500/20 text-red-400"
  };

  if (loading) {
    return (
      <div className="text-center py-8">
        <div className="w-8 h-8 border-4 border-cyan-500/30 border-t-cyan-500 rounded-full animate-spin mx-auto"></div>
        <p className="text-gray-400 mt-2">Cargando reglas...</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-bold text-white">Reglas de Notificación</h3>
          <p className="text-sm text-gray-400">Configura notificaciones automáticas</p>
        </div>
        <Button
          onClick={() => setShowCreateModal(true)}
          className="bg-gradient-to-r from-cyan-600 to-emerald-600"
        >
          <Plus className="w-4 h-4 mr-2" />
          Nueva Regla
        </Button>
      </div>

      {rules.length === 0 ? (
        <Card className="bg-slate-900/60 border-slate-700">
          <CardContent className="py-12 text-center">
            <Bell className="w-12 h-12 text-gray-600 mx-auto mb-4" />
            <p className="text-gray-400">No hay reglas configuradas</p>
            <Button
              onClick={() => setShowCreateModal(true)}
              variant="outline"
              className="mt-4"
            >
              Crear Primera Regla
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {rules.map(rule => (
            <Card key={rule.id} className="bg-slate-900/60 border-slate-700 hover:border-cyan-500/30 transition-all">
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h4 className="text-white font-bold">{rule.name}</h4>
                      <Badge className={priorityColors[rule.notification_config?.priority || 'normal']}>
                        {rule.notification_config?.priority || 'normal'}
                      </Badge>
                      <Badge variant="outline" className="text-xs">
                        {triggerTypeLabels[rule.trigger_type] || rule.trigger_type}
                      </Badge>
                    </div>
                    
                    {rule.description && (
                      <p className="text-sm text-gray-400 mb-3">{rule.description}</p>
                    )}

                    <div className="flex items-center gap-4 text-xs text-gray-500">
                      <span className="flex items-center gap-1">
                        <Bell className="w-3 h-3" />
                        Disparada {rule.trigger_count || 0} veces
                      </span>
                      {rule.last_triggered && (
                        <span className="flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          Última: {new Date(rule.last_triggered).toLocaleDateString()}
                        </span>
                      )}
                      <span className="flex items-center gap-1">
                        <Users className="w-3 h-3" />
                        {rule.target_roles?.join(", ") || "Admins"}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handleToggleActive(rule)}
                      className={rule.active ? "text-emerald-400" : "text-gray-500"}
                    >
                      {rule.active ? (
                        <ToggleRight className="w-5 h-5" />
                      ) : (
                        <ToggleLeft className="w-5 h-5" />
                      )}
                    </Button>
                    
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => setEditingRule(rule)}
                    >
                      <Edit className="w-4 h-4" />
                    </Button>
                    
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handleDelete(rule.id)}
                      className="text-red-400 hover:text-red-300"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {(showCreateModal || editingRule) && (
        <RuleEditorModal
          rule={editingRule}
          onClose={() => {
            setShowCreateModal(false);
            setEditingRule(null);
          }}
          onSave={() => {
            loadRules();
            setShowCreateModal(false);
            setEditingRule(null);
          }}
        />
      )}
    </div>
  );
}

function RuleEditorModal({ rule, onClose, onSave }) {
  const [formData, setFormData] = useState(rule || {
    name: "",
    description: "",
    trigger_type: "low_stock",
    conditions: { threshold: 5 },
    notification_config: {
      title: "",
      message: "",
      priority: "normal",
      actions: []
    },
    target_roles: ["admin"],
    frequency: "daily",
    active: true
  });
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!formData.name || !formData.notification_config.title) {
      toast.error("Completa los campos requeridos");
      return;
    }

    setSaving(true);
    try {
      if (rule) {
        await dataClient.entities.NotificationRule.update(rule.id, formData);
        toast.success("Regla actualizada");
      } else {
        await dataClient.entities.NotificationRule.create(formData);
        toast.success("Regla creada");
      }
      onSave();
    } catch (error) {
      console.error("Error saving rule:", error);
      toast.error("Error al guardar regla");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
      <Card className="w-full max-w-2xl bg-slate-900 border-slate-700 max-h-[90vh] overflow-y-auto">
        <CardHeader className="border-b border-slate-700">
          <div className="flex items-center justify-between">
            <CardTitle className="text-white">
              {rule ? "Editar Regla" : "Nueva Regla"}
            </CardTitle>
            <Button size="sm" variant="ghost" onClick={onClose}>
              <X className="w-4 h-4" />
            </Button>
          </div>
        </CardHeader>
        <CardContent className="p-6 space-y-4">
          <div>
            <label className="text-sm text-gray-400 mb-2 block">Nombre *</label>
            <Input
              value={formData.name}
              onChange={(e) => setFormData({...formData, name: e.target.value})}
              placeholder="Ej: Alerta de Stock Crítico"
              className="bg-black/40 border-slate-700 text-white"
            />
          </div>

          <div>
            <label className="text-sm text-gray-400 mb-2 block">Descripción</label>
            <Input
              value={formData.description}
              onChange={(e) => setFormData({...formData, description: e.target.value})}
              placeholder="Descripción opcional"
              className="bg-black/40 border-slate-700 text-white"
            />
          </div>

          <div>
            <label className="text-sm text-gray-400 mb-2 block">Tipo de Disparador *</label>
            <select
              value={formData.trigger_type}
              onChange={(e) => setFormData({...formData, trigger_type: e.target.value})}
              className="w-full h-10 px-3 bg-black/40 border border-slate-700 rounded-md text-white"
            >
              <option value="low_stock">📦 Stock Bajo</option>
              <option value="pending_order">⏳ Orden Pendiente</option>
              <option value="inactive_customer">😴 Cliente Inactivo</option>
              <option value="order_deadline">⚠️ Deadline Cercano</option>
            </select>
          </div>

          <div>
            <label className="text-sm text-gray-400 mb-2 block">Umbral</label>
            <Input
              type="number"
              value={formData.conditions?.threshold || 5}
              onChange={(e) => setFormData({
                ...formData,
                conditions: {...formData.conditions, threshold: Number(e.target.value)}
              })}
              placeholder="Ej: 5 unidades, 7 días"
              className="bg-black/40 border-slate-700 text-white"
            />
          </div>

          <div>
            <label className="text-sm text-gray-400 mb-2 block">Título de Notificación *</label>
            <Input
              value={formData.notification_config?.title}
              onChange={(e) => setFormData({
                ...formData,
                notification_config: {...formData.notification_config, title: e.target.value}
              })}
              placeholder="Usa {{campo}} para variables dinámicas"
              className="bg-black/40 border-slate-700 text-white"
            />
          </div>

          <div>
            <label className="text-sm text-gray-400 mb-2 block">Mensaje</label>
            <textarea
              value={formData.notification_config?.message}
              onChange={(e) => setFormData({
                ...formData,
                notification_config: {...formData.notification_config, message: e.target.value}
              })}
              placeholder="Mensaje detallado..."
              className="w-full h-20 px-3 py-2 bg-black/40 border border-slate-700 rounded-md text-white resize-none"
            />
          </div>

          <div>
            <label className="text-sm text-gray-400 mb-2 block">Prioridad</label>
            <select
              value={formData.notification_config?.priority || 'normal'}
              onChange={(e) => setFormData({
                ...formData,
                notification_config: {...formData.notification_config, priority: e.target.value}
              })}
              className="w-full h-10 px-3 bg-black/40 border border-slate-700 rounded-md text-white"
            >
              <option value="low">Baja</option>
              <option value="normal">Normal</option>
              <option value="high">Alta</option>
              <option value="urgent">Urgente</option>
            </select>
          </div>

          <div className="flex gap-3 pt-4 border-t border-slate-700">
            <Button
              onClick={onClose}
              variant="outline"
              className="flex-1"
              disabled={saving}
            >
              Cancelar
            </Button>
            <Button
              onClick={handleSave}
              disabled={saving}
              className="flex-1 bg-gradient-to-r from-cyan-600 to-emerald-600"
            >
              {saving ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin mr-2" />
                  Guardando...
                </>
              ) : (
                <>
                  <Save className="w-4 h-4 mr-2" />
                  Guardar
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
