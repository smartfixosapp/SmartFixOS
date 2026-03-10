import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Plus,
  Trash2,
  Save,
  GripVertical,
  Edit2,
  Check,
  X,
  AlertCircle,
  Settings as SettingsIcon,
  RefreshCw,
  Copy
} from "lucide-react";
import { DragDropContext, Droppable, Draggable } from "@hello-pangea/dnd";

const DEFAULT_STATUSES = [
  { id: "intake", label: "Recepción", color: "#3B82F6", isActive: true, isTerminal: false, isSystem: false },
  { id: "diagnosing", label: "Diagnóstico", color: "#8B5CF6", isActive: true, isTerminal: false, isSystem: false },
  { id: "awaiting_approval", label: "Por Aprobar", color: "#EAB308", isActive: true, isTerminal: false, isSystem: false },
  { id: "pending_order", label: "Pendiente de Ordenar", color: "#DC2626", isActive: true, isTerminal: false, isSystem: false },
  { id: "waiting_parts", label: "Esperando Piezas", color: "#F97316", isActive: true, isTerminal: false, isSystem: false },
  { id: "reparacion_externa", label: "Taller Externo", color: "#EC4899", isActive: true, isTerminal: false, isSystem: false },
  { id: "in_progress", label: "En Reparación", color: "#06B6D4", isActive: true, isTerminal: false, isSystem: false },
  { id: "ready_for_pickup", label: "Listo para Recoger", color: "#10B981", isActive: true, isTerminal: false, isSystem: false },
  { id: "picked_up", label: "Entregado", color: "#059669", isActive: false, isTerminal: true, isSystem: true },
  { id: "completed", label: "Completado", color: "#6B7280", isActive: false, isTerminal: true, isSystem: true },
  { id: "cancelled", label: "Cancelado", color: "#DC2626", isActive: false, isTerminal: true, isSystem: true }
];

const COLOR_PRESETS = [
  { name: "Azul", value: "#3B82F6" },
  { name: "Púrpura", value: "#8B5CF6" },
  { name: "Amarillo", value: "#EAB308" },
  { name: "Naranja", value: "#F97316" },
  { name: "Rojo", value: "#DC2626" },
  { name: "Rosa", value: "#EC4899" },
  { name: "Cian", value: "#06B6D4" },
  { name: "Verde", value: "#10B981" },
  { name: "Esmeralda", value: "#059669" },
  { name: "Gris", value: "#6B7280" },
  { name: "Índigo", value: "#6366F1" },
  { name: "Fucsia", value: "#D946EF" }
];

function StatusItem({ status, index, onEdit, onDelete, onToggleActive, isEditing }) {
  const bgOpacity = status.isActive ? "20" : "10";
  const textOpacity = status.isActive ? "text-white" : "text-gray-500";
  
  return (
    <Draggable draggableId={status.id} index={index} isDragDisabled={isEditing}>
      {(provided, snapshot) => (
        <div
          ref={provided.innerRef}
          {...provided.draggableProps}
          className={`
            p-4 rounded-lg border transition-all
            ${snapshot.isDragging ? "border-red-600 shadow-lg shadow-red-600/20 scale-105" : "border-white/10"}
            ${status.isActive ? "bg-black/40" : "bg-black/20"}
          `}
        >
          <div className="flex items-center gap-3">
            <div {...provided.dragHandleProps} className={`cursor-grab active:cursor-grabbing ${textOpacity}`}>
              <GripVertical className="w-5 h-5" />
            </div>

            <div className="flex-1 flex items-center gap-3">
              <div
                className="w-8 h-8 rounded-lg border-2 flex items-center justify-center"
                style={{ 
                  backgroundColor: `${status.color}${bgOpacity}`,
                  borderColor: `${status.color}80`
                }}
              >
                <span className="text-xs font-bold" style={{ color: status.color }}>
                  {status.label.substring(0, 2).toUpperCase()}
                </span>
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className={`font-semibold ${textOpacity} truncate`}>
                    {status.label}
                  </p>
                  {status.isTerminal && (
                    <Badge className="bg-gray-600/20 text-gray-400 border-gray-600/30 text-xs">
                      Terminal
                    </Badge>
                  )}
                  {status.isSystem && (
                    <Badge className="bg-blue-600/20 text-blue-400 border-blue-600/30 text-xs">
                      Sistema
                    </Badge>
                  )}
                </div>
                <p className="text-xs text-gray-500 truncate">ID: {status.id}</p>
              </div>

              <div className="flex items-center gap-2">
                {!status.isSystem && (
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={status.isActive}
                      onChange={() => onToggleActive(status.id)}
                      className="w-4 h-4 rounded border-white/20 bg-black/40 text-red-600 focus:ring-red-600"
                    />
                    <span className="text-xs text-gray-400">Activo</span>
                  </label>
                )}

                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => onEdit(status)}
                  className="h-8 w-8 p-0"
                  disabled={isEditing && isEditing !== status.id}
                >
                  <Edit2 className="w-4 h-4" />
                </Button>

                {!status.isSystem && (
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => onDelete(status.id)}
                    className="h-8 w-8 p-0 text-red-400 hover:text-red-300"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </Draggable>
  );
}

function EditStatusDialog({ status, onSave, onCancel }) {
  const [formData, setFormData] = useState({
    id: status?.id || "",
    label: status?.label || "",
    color: status?.color || "#3B82F6",
    isActive: status?.isActive ?? true,
    isTerminal: status?.isTerminal ?? false
  });

  const [errors, setErrors] = useState({});

  const validate = () => {
    const errs = {};
    
    if (!formData.id.trim()) {
      errs.id = "El ID es requerido";
    } else if (!/^[a-z0-9_]+$/.test(formData.id)) {
      errs.id = "Solo minúsculas, números y guiones bajos";
    }

    if (!formData.label.trim()) {
      errs.label = "El label es requerido";
    }

    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSave = () => {
    if (validate()) {
      onSave(formData);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-gradient-to-br from-[#2B2B2B] to-black border border-red-900/30 rounded-xl max-w-2xl w-full p-6 space-y-6">
        <div className="flex items-center justify-between">
          <h3 className="text-xl font-bold text-white">
            {status ? "Editar Estado" : "Nuevo Estado"}
          </h3>
          <button onClick={onCancel} className="text-gray-400 hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="space-y-4">
          <div>
            <Label className="text-gray-300">ID del Estado *</Label>
            <Input
              value={formData.id}
              onChange={(e) => setFormData({ ...formData, id: e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, "_") })}
              placeholder="ej: en_reparacion"
              className="bg-black/40 border-white/15 text-white"
              disabled={!!status} // No editable si es edición
            />
            {errors.id && (
              <p className="text-xs text-red-400 mt-1 flex items-center gap-1">
                <AlertCircle className="w-3 h-3" />
                {errors.id}
              </p>
            )}
            <p className="text-xs text-gray-400 mt-1">
              Identificador único (no editable después de crear)
            </p>
          </div>

          <div>
            <Label className="text-gray-300">Etiqueta/Nombre *</Label>
            <Input
              value={formData.label}
              onChange={(e) => setFormData({ ...formData, label: e.target.value })}
              placeholder="ej: En Reparación"
              className="bg-black/40 border-white/15 text-white"
            />
            {errors.label && (
              <p className="text-xs text-red-400 mt-1 flex items-center gap-1">
                <AlertCircle className="w-3 h-3" />
                {errors.label}
              </p>
            )}
          </div>

          <div>
            <Label className="text-gray-300 mb-2 block">Color</Label>
            <div className="flex items-center gap-3">
              <div className="flex-1">
                <Input
                  type="color"
                  value={formData.color}
                  onChange={(e) => setFormData({ ...formData, color: e.target.value })}
                  className="h-12 bg-black/40 border-white/15"
                />
              </div>
              <div
                className="w-12 h-12 rounded-lg border-2 flex items-center justify-center"
                style={{ 
                  backgroundColor: `${formData.color}20`,
                  borderColor: `${formData.color}80`
                }}
              >
                <span className="text-xs font-bold" style={{ color: formData.color }}>
                  {formData.label.substring(0, 2).toUpperCase() || "XX"}
                </span>
              </div>
            </div>

            <div className="grid grid-cols-6 gap-2 mt-3">
              {COLOR_PRESETS.map(preset => (
                <button
                  key={preset.value}
                  onClick={() => setFormData({ ...formData, color: preset.value })}
                  className={`h-10 rounded-lg border-2 transition ${
                    formData.color === preset.value 
                      ? "border-white shadow-lg scale-110" 
                      : "border-white/20 hover:border-white/40"
                  }`}
                  style={{ backgroundColor: preset.value }}
                  title={preset.name}
                />
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <label className="flex items-center gap-3 cursor-pointer p-3 rounded-lg bg-black/20 border border-white/10 hover:bg-black/30 transition">
              <input
                type="checkbox"
                checked={formData.isActive}
                onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                className="w-5 h-5 rounded border-white/20 bg-black/40 text-red-600 focus:ring-red-600"
              />
              <div>
                <p className="text-white font-medium">Estado Activo</p>
                <p className="text-xs text-gray-400">Se muestra en el tablero y filtros</p>
              </div>
            </label>

            <label className="flex items-center gap-3 cursor-pointer p-3 rounded-lg bg-black/20 border border-white/10 hover:bg-black/30 transition">
              <input
                type="checkbox"
                checked={formData.isTerminal}
                onChange={(e) => setFormData({ ...formData, isTerminal: e.target.checked })}
                className="w-5 h-5 rounded border-white/20 bg-black/40 text-red-600 focus:ring-red-600"
              />
              <div>
                <p className="text-white font-medium">Estado Terminal</p>
                <p className="text-xs text-gray-400">Marca el final del proceso (no se muestra por defecto)</p>
              </div>
            </label>
          </div>
        </div>

        <div className="flex gap-3 pt-4 border-t border-white/10">
          <Button
            onClick={onCancel}
            variant="outline"
            className="flex-1 border-white/15"
          >
            Cancelar
          </Button>
          <Button
            onClick={handleSave}
            className="flex-1 bg-gradient-to-r from-red-600 to-red-800 hover:from-red-700 hover:to-red-900"
          >
            <Check className="w-4 h-4 mr-2" />
            Guardar
          </Button>
        </div>
      </div>
    </div>
  );
}

export default function OrderStatusManagementTab() {
  const [statuses, setStatuses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editingStatus, setEditingStatus] = useState(null);
  const [showNewDialog, setShowNewDialog] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);

  useEffect(() => {
    loadStatuses();
  }, []);

  const loadStatuses = async () => {
    setLoading(true);
    try {
      const rows = await base44.entities.SystemConfig.filter({ key: "order_statuses" });
      
      if (rows && rows.length > 0) {
        const raw = rows[0].value || rows[0].value_json;
        let loadedStatuses = [];
        
        if (typeof raw === "string") {
          try {
            loadedStatuses = JSON.parse(raw);
          } catch {
            loadedStatuses = DEFAULT_STATUSES;
          }
        } else if (Array.isArray(raw)) {
          loadedStatuses = raw;
        } else {
          loadedStatuses = DEFAULT_STATUSES;
        }

        setStatuses(loadedStatuses);
      } else {
        setStatuses(DEFAULT_STATUSES);
      }
    } catch (error) {
      console.error("Error loading statuses:", error);
      setStatuses(DEFAULT_STATUSES);
    }
    setLoading(false);
  };

  const saveStatuses = async () => {
    setSaving(true);
    try {
      const rows = await base44.entities.SystemConfig.filter({ key: "order_statuses" });
      
      const statusesData = statuses.map(s => ({
        id: s.id,
        label: s.label,
        color: s.color,
        isActive: s.isActive,
        isTerminal: s.isTerminal,
        isSystem: s.isSystem || false
      }));

      if (rows && rows.length > 0) {
        await base44.entities.SystemConfig.update(rows[0].id, {
          value_json: statusesData
        });
      } else {
        await base44.entities.SystemConfig.create({
          key: "order_statuses",
          category: "repair_status",
          value_json: statusesData,
          description: "Configuración de estados de órdenes"
        });
      }

      // Audit log
      const user = await base44.auth.me().catch(() => ({}));
      await base44.entities.AuditLog.create({
        action: "update_order_statuses",
        entity_type: "config",
        entity_id: "order_statuses",
        user_id: user?.id,
        user_name: user?.full_name || user?.email || "Sistema",
        user_role: user?.role || "admin",
        changes: { statuses: statusesData }
      });

      setHasChanges(false);
      alert("✅ Estados guardados correctamente. Recarga la página para ver los cambios.");
    } catch (error) {
      console.error("Error saving statuses:", error);
      alert("❌ Error al guardar: " + error.message);
    }
    setSaving(false);
  };

  const handleDragEnd = (result) => {
    if (!result.destination) return;

    const items = Array.from(statuses);
    const [reorderedItem] = items.splice(result.source.index, 1);
    items.splice(result.destination.index, 0, reorderedItem);

    setStatuses(items);
    setHasChanges(true);
  };

  const handleToggleActive = (statusId) => {
    setStatuses(prev => prev.map(s => 
      s.id === statusId ? { ...s, isActive: !s.isActive } : s
    ));
    setHasChanges(true);
  };

  const handleEdit = (status) => {
    setEditingStatus(status);
  };

  const handleSaveEdit = (formData) => {
    if (editingStatus) {
      // Edit existing
      setStatuses(prev => prev.map(s => 
        s.id === editingStatus.id 
          ? { ...s, label: formData.label, color: formData.color, isActive: formData.isActive, isTerminal: formData.isTerminal }
          : s
      ));
    } else {
      // Add new
      const newStatus = {
        ...formData,
        isSystem: false
      };
      setStatuses(prev => [...prev, newStatus]);
    }
    
    setEditingStatus(null);
    setShowNewDialog(false);
    setHasChanges(true);
  };

  const handleDelete = (statusId) => {
    if (!confirm("¿Eliminar este estado? Esta acción no se puede deshacer.")) return;
    
    setStatuses(prev => prev.filter(s => s.id !== statusId));
    setHasChanges(true);
  };

  const handleReset = () => {
    if (!confirm("¿Restaurar estados por defecto? Se perderán todos los cambios personalizados.")) return;
    
    setStatuses(DEFAULT_STATUSES);
    setHasChanges(true);
  };

  const handleDuplicate = (status) => {
    const newId = `${status.id}_copy`;
    const newLabel = `${status.label} (Copia)`;
    
    const duplicate = {
      ...status,
      id: newId,
      label: newLabel,
      isSystem: false
    };
    
    setStatuses(prev => [...prev, duplicate]);
    setHasChanges(true);
  };

  return (
    <div className="space-y-6">
      <Card className="bg-black/40 border-white/10">
        <CardHeader>
          <CardTitle className="text-white flex items-center gap-2">
            <SettingsIcon className="w-5 h-5 text-red-600" />
            Gestión de Estados de Órdenes
          </CardTitle>
          <p className="text-sm text-gray-400 mt-2">
            Configura los estados del ciclo de vida de las órdenes de trabajo. 
            Arrastra para reordenar, edita colores y labels, o crea estados personalizados.
          </p>
        </CardHeader>

        <CardContent className="space-y-6">
          {/* Actions Bar */}
          <div className="flex flex-wrap items-center justify-between gap-3 p-4 bg-black/40 rounded-lg border border-white/10">
            <div className="flex items-center gap-2">
              <Button
                onClick={() => {
                  setEditingStatus(null);
                  setShowNewDialog(true);
                }}
                className="bg-green-600 hover:bg-green-700"
              >
                <Plus className="w-4 h-4 mr-2" />
                Nuevo Estado
              </Button>

              <Button
                onClick={handleReset}
                variant="outline"
                className="border-white/15"
              >
                <RefreshCw className="w-4 h-4 mr-2" />
                Restaurar Defecto
              </Button>
            </div>

            <div className="flex items-center gap-2">
              {hasChanges && (
                <Badge className="bg-yellow-600/20 text-yellow-300 border-yellow-600/30">
                  Cambios sin guardar
                </Badge>
              )}
              
              <Button
                onClick={saveStatuses}
                disabled={!hasChanges || saving}
                className="bg-gradient-to-r from-red-600 to-red-800 hover:from-red-700 hover:to-red-900"
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
          </div>

          {/* Stats */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-4 rounded-lg bg-blue-600/10 border border-blue-600/30">
              <p className="text-sm text-blue-300">Total de Estados</p>
              <p className="text-3xl font-bold text-blue-400 mt-1">{statuses.length}</p>
            </div>

            <div className="p-4 rounded-lg bg-green-600/10 border border-green-600/30">
              <p className="text-sm text-green-300">Estados Activos</p>
              <p className="text-3xl font-bold text-green-400 mt-1">
                {statuses.filter(s => s.isActive).length}
              </p>
            </div>

            <div className="p-4 rounded-lg bg-gray-600/10 border border-gray-600/30">
              <p className="text-sm text-gray-300">Estados Terminales</p>
              <p className="text-3xl font-bold text-gray-400 mt-1">
                {statuses.filter(s => s.isTerminal).length}
              </p>
            </div>
          </div>

          {/* Status List */}
          {loading ? (
            <div className="py-12 flex items-center justify-center">
              <RefreshCw className="w-8 h-8 animate-spin text-red-600" />
            </div>
          ) : (
            <DragDropContext onDragEnd={handleDragEnd}>
              <Droppable droppableId="statuses">
                {(provided) => (
                  <div
                    {...provided.droppableProps}
                    ref={provided.innerRef}
                    className="space-y-2"
                  >
                    {statuses.map((status, index) => (
                      <StatusItem
                        key={status.id}
                        status={status}
                        index={index}
                        onEdit={handleEdit}
                        onDelete={handleDelete}
                        onToggleActive={handleToggleActive}
                        isEditing={editingStatus?.id || (showNewDialog ? "new" : null)}
                      />
                    ))}
                    {provided.placeholder}
                  </div>
                )}
              </Droppable>
            </DragDropContext>
          )}

          {statuses.length === 0 && !loading && (
            <div className="text-center py-12">
              <AlertCircle className="w-12 h-12 mx-auto text-gray-600 mb-4" />
              <p className="text-gray-400">No hay estados configurados</p>
              <Button
                onClick={() => setStatuses(DEFAULT_STATUSES)}
                className="mt-4 bg-red-600 hover:bg-red-700"
              >
                Cargar Estados Por Defecto
              </Button>
            </div>
          )}

          {/* Help */}
          <div className="p-4 bg-blue-600/10 border border-blue-600/30 rounded-lg">
            <h4 className="font-semibold text-blue-300 mb-2 flex items-center gap-2">
              <AlertCircle className="w-4 h-4" />
              Guía Rápida
            </h4>
            <ul className="text-sm text-blue-200 space-y-1">
              <li>• <strong>Arrastra</strong> los estados para cambiar el orden en el tablero</li>
              <li>• <strong>Estados Activos:</strong> Se muestran en el tablero principal</li>
              <li>• <strong>Estados Terminales:</strong> Se ocultan por defecto (completados/cancelados)</li>
              <li>• <strong>Estados del Sistema:</strong> No se pueden eliminar (protegidos)</li>
              <li>• <strong>ID único:</strong> No se puede cambiar después de crear (se usa en la base de datos)</li>
            </ul>
          </div>
        </CardContent>
      </Card>

      {/* Edit/New Dialog */}
      {(editingStatus || showNewDialog) && (
        <EditStatusDialog
          status={editingStatus}
          onSave={handleSaveEdit}
          onCancel={() => {
            setEditingStatus(null);
            setShowNewDialog(false);
          }}
        />
      )}
    </div>
  );
}
