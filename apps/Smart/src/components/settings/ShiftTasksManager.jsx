// ShiftTasksManager.jsx — Admin panel para gestionar tareas de turno
import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { toast } from "sonner";
import {
  Plus, Edit2, Trash2, X, Sunrise, Sunset, Users,
  AlertCircle, CheckCircle2, GripVertical, History
} from "lucide-react";
import { format } from "date-fns";
import { es } from "date-fns/locale";

const ROLE_LABELS = {
  admin: "Administrador",
  manager: "Gerente",
  technician: "Técnico",
  cashier: "Cajero",
};

const EMPTY_FORM = {
  title: "",
  description: "",
  type: "opening",
  priority: "normal",
  assigned_to_employee_id: "",
  assigned_to_role: "",
  active: true,
  sort_order: 0,
};

export default function ShiftTasksManager() {
  const [tasks, setTasks] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [activeTab, setActiveTab] = useState("opening");
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [recentLogs, setRecentLogs] = useState([]);
  const [showHistory, setShowHistory] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadTasks();
    loadEmployees();
  }, []);

  const loadTasks = async () => {
    try {
      const data = await base44.entities.ShiftTask.filter({}, "sort_order", 200);
      setTasks(data || []);
    } catch (e) {
      console.error("[ShiftTasksManager] Error loading tasks:", e);
    }
  };

  const loadEmployees = async () => {
    try {
      const data = await base44.entities.AppEmployee.filter({ active: true }, "full_name", 100);
      setEmployees(data || []);
    } catch (e) {
      console.error("[ShiftTasksManager] Error loading employees:", e);
    }
  };

  const loadHistory = async () => {
    try {
      const today = new Date().toISOString().slice(0, 10);
      const data = await base44.entities.ShiftTaskLog.filter(
        { shift_date: today },
        "-completed_at",
        50
      );
      setRecentLogs(data || []);
      setShowHistory(true);
    } catch (e) {
      console.error("[ShiftTasksManager] Error loading history:", e);
    }
  };

  const openNew = (type) => {
    setEditing(null);
    setForm({ ...EMPTY_FORM, type });
    setShowForm(true);
  };

  const openEdit = (task) => {
    setEditing(task);
    setForm({
      title: task.title || "",
      description: task.description || "",
      type: task.type || "opening",
      priority: task.priority || "normal",
      assigned_to_employee_id: task.assigned_to_employee_id || "",
      assigned_to_role: task.assigned_to_role || "",
      active: task.active !== false,
      sort_order: task.sort_order || 0,
    });
    setShowForm(true);
    setShowHistory(false);
  };

  const handleSave = async () => {
    if (!form.title.trim()) { toast.error("El nombre es requerido"); return; }
    setSaving(true);
    try {
      if (editing?.id) {
        await base44.entities.ShiftTask.update(editing.id, form);
        toast.success("Tarea actualizada");
      } else {
        await base44.entities.ShiftTask.create(form);
        toast.success("Tarea creada");
      }
      setShowForm(false);
      setEditing(null);
      loadTasks();
    } catch (e) {
      toast.error("Error guardando tarea");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (task) => {
    if (!confirm(`¿Eliminar "${task.title}"?`)) return;
    try {
      await base44.entities.ShiftTask.delete(task.id);
      toast.success("Tarea eliminada");
      loadTasks();
    } catch (e) {
      toast.error("Error eliminando tarea");
    }
  };

  const handleToggleActive = async (task) => {
    try {
      await base44.entities.ShiftTask.update(task.id, { active: !task.active });
      loadTasks();
    } catch (e) {
      toast.error("Error actualizando tarea");
    }
  };

  const getAssignedLabel = (task) => {
    if (task.assigned_to_employee_id) {
      const emp = employees.find(e => e.id === task.assigned_to_employee_id);
      return emp ? emp.full_name : "Empleado específico";
    }
    if (task.assigned_to_role) return ROLE_LABELS[task.assigned_to_role] || task.assigned_to_role;
    return "Todos los empleados";
  };

  const getAssignValue = () => {
    if (form.assigned_to_employee_id) return `emp:${form.assigned_to_employee_id}`;
    if (form.assigned_to_role) return `role:${form.assigned_to_role}`;
    return "all";
  };

  const handleAssignChange = (val) => {
    if (val === "all") {
      setForm(p => ({ ...p, assigned_to_employee_id: "", assigned_to_role: "" }));
    } else if (val.startsWith("role:")) {
      setForm(p => ({ ...p, assigned_to_employee_id: "", assigned_to_role: val.replace("role:", "") }));
    } else if (val.startsWith("emp:")) {
      setForm(p => ({ ...p, assigned_to_employee_id: val.replace("emp:", ""), assigned_to_role: "" }));
    }
  };

  const filteredTasks = tasks.filter(t => t.type === activeTab);

  return (
    <div className="apple-type space-y-5">
      {/* Header con historial */}
      <div className="flex items-center justify-between">
        <p className="apple-text-caption1 apple-label-tertiary">
          Crea tareas que aparecerán automáticamente en el panel de cada empleado al iniciar o cerrar turno.
        </p>
        <button
          onClick={showHistory ? () => setShowHistory(false) : loadHistory}
          className="apple-btn apple-btn-secondary apple-press flex items-center gap-1.5 flex-shrink-0"
        >
          <History className="w-3.5 h-3.5" />
          Historial hoy
        </button>
      </div>

      {/* Historial de hoy */}
      {showHistory && (
        <div className="apple-surface-elevated rounded-apple-md overflow-hidden">
          <div className="px-4 py-3 flex items-center gap-2" style={{ borderBottom: '0.5px solid rgb(var(--separator) / 0.29)' }}>
            <History className="w-3.5 h-3.5 text-apple-blue" />
            <p className="apple-text-caption1 apple-label-secondary">Completadas hoy</p>
          </div>
          {recentLogs.length === 0 ? (
            <p className="apple-text-caption1 apple-label-tertiary text-center py-6">Sin completaciones registradas hoy.</p>
          ) : (
            <div className="max-h-52 overflow-y-auto">
              {recentLogs.map((log, idx) => (
                <div key={log.id} className="flex items-center gap-3 px-4 py-3" style={idx > 0 ? { borderTop: '0.5px solid rgb(var(--separator) / 0.29)' } : undefined}>
                  <CheckCircle2 className="w-4 h-4 text-apple-green flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="apple-text-caption1 apple-label-primary truncate">{log.task_title || "Tarea"}</p>
                    <p className="apple-text-caption2 apple-label-tertiary">{log.employee_name || log.employee_id}</p>
                  </div>
                  <span className="apple-text-caption2 apple-label-tertiary flex-shrink-0 tabular-nums">
                    {log.completed_at
                      ? format(new Date(log.completed_at), "HH:mm", { locale: es })
                      : "—"}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Tabs apertura / cierre */}
      <div className="flex gap-2">
        {[
          { id: "opening", label: "Apertura", icon: Sunrise, color: "text-apple-orange" },
          { id: "closing", label: "Cierre", icon: Sunset, color: "text-apple-indigo" },
        ].map(({ id, label, icon: Icon, color }) => {
          const count = tasks.filter(t => t.type === id && t.active).length;
          return (
            <button
              key={id}
              onClick={() => { setActiveTab(id); setShowForm(false); }}
              className={`flex items-center gap-2 px-4 py-2 rounded-apple-sm apple-text-subheadline transition-all apple-press ${
                activeTab === id
                  ? "apple-btn apple-btn-primary"
                  : "bg-gray-sys6 dark:bg-gray-sys5 apple-label-secondary"
              }`}
            >
              <Icon className={`w-4 h-4 ${activeTab === id ? "" : color}`} />
              {label}
              {count > 0 && (
                <span className={`apple-text-caption2 px-1.5 py-0.5 rounded-full tabular-nums ${
                  activeTab === id ? "bg-white/20" : "bg-gray-sys6 dark:bg-gray-sys5 apple-label-tertiary"
                }`}>{count}</span>
              )}
            </button>
          );
        })}
      </div>

      {/* Lista de tareas */}
      <div className="space-y-2">
        {filteredTasks.length === 0 && !showForm && (
          <div className="text-center py-8 apple-label-tertiary apple-text-subheadline">
            No hay tareas de {activeTab === "opening" ? "apertura" : "cierre"} configuradas.
          </div>
        )}
        {filteredTasks.map(task => (
          <div
            key={task.id}
            className={`flex items-center gap-3 p-4 rounded-apple-md transition-all ${
              task.active
                ? "apple-surface-elevated"
                : "apple-surface-elevated opacity-50"
            }`}
          >
            <GripVertical className="w-4 h-4 apple-label-tertiary flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <p className="apple-text-subheadline apple-label-primary truncate">{task.title}</p>
                {task.priority === "urgent" && (
                  <span className="apple-text-caption2 px-2 py-0.5 rounded-full bg-apple-red/15 text-apple-red flex items-center gap-1">
                    <AlertCircle className="w-2.5 h-2.5" /> Urgente
                  </span>
                )}
              </div>
              {task.description && (
                <p className="apple-text-caption1 apple-label-tertiary mt-0.5 truncate">{task.description}</p>
              )}
              <div className="flex items-center gap-1 mt-1">
                <Users className="w-2.5 h-2.5 apple-label-tertiary" />
                <p className="apple-text-caption2 apple-label-tertiary">{getAssignedLabel(task)}</p>
              </div>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              {/* Toggle activa */}
              <button
                onClick={() => handleToggleActive(task)}
                className={`w-10 h-5 rounded-full transition-all relative apple-press ${
                  task.active ? "bg-apple-green/15" : "bg-gray-sys6 dark:bg-gray-sys5"
                }`}
              >
                <div className={`absolute top-0.5 w-4 h-4 rounded-full transition-all ${
                  task.active ? "left-5 bg-apple-green" : "left-0.5 bg-white/20"
                }`} />
              </button>
              <button
                onClick={() => openEdit(task)}
                className="w-8 h-8 rounded-apple-sm bg-gray-sys6 dark:bg-gray-sys5 flex items-center justify-center apple-label-tertiary transition-all apple-press"
              >
                <Edit2 className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => handleDelete(task)}
                className="w-8 h-8 rounded-apple-sm bg-apple-red/12 flex items-center justify-center text-apple-red transition-all apple-press"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Botón agregar */}
      {!showForm && (
        <button
          onClick={() => openNew(activeTab)}
          className="w-full flex items-center justify-center gap-2 py-3 rounded-apple-md apple-surface-elevated apple-label-secondary apple-text-subheadline hover:bg-apple-blue/12 transition-all apple-press"
        >
          <Plus className="w-4 h-4" />
          Nueva tarea de {activeTab === "opening" ? "apertura" : "cierre"}
        </button>
      )}

      {/* Formulario */}
      {showForm && (
        <div className="apple-surface-elevated rounded-apple-md p-5 space-y-4">
          <div className="flex items-center justify-between">
            <p className="apple-text-subheadline apple-label-primary">{editing ? "Editar tarea" : "Nueva tarea"}</p>
            <button onClick={() => { setShowForm(false); setEditing(null); }} className="apple-label-tertiary hover:apple-label-primary transition-colors apple-press">
              <X className="w-4 h-4" />
            </button>
          </div>

          <div>
            <label className="apple-text-caption2 apple-label-tertiary block mb-1.5">Nombre *</label>
            <input
              value={form.title}
              onChange={e => setForm(p => ({ ...p, title: e.target.value }))}
              placeholder="Ej: Verificar emails del día"
              className="apple-input w-full"
            />
          </div>

          <div>
            <label className="apple-text-caption2 apple-label-tertiary block mb-1.5">Descripción (opcional)</label>
            <textarea
              value={form.description}
              onChange={e => setForm(p => ({ ...p, description: e.target.value }))}
              rows={2}
              placeholder="Instrucciones adicionales para el empleado..."
              className="apple-input w-full resize-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="apple-text-caption2 apple-label-tertiary block mb-1.5">Tipo</label>
              <select
                value={form.type}
                onChange={e => setForm(p => ({ ...p, type: e.target.value }))}
                className="apple-input w-full h-10"
              >
                <option value="opening">Apertura</option>
                <option value="closing">Cierre</option>
              </select>
            </div>
            <div>
              <label className="apple-text-caption2 apple-label-tertiary block mb-1.5">Prioridad</label>
              <select
                value={form.priority}
                onChange={e => setForm(p => ({ ...p, priority: e.target.value }))}
                className="apple-input w-full h-10"
              >
                <option value="normal">Normal</option>
                <option value="urgent">Urgente</option>
              </select>
            </div>
          </div>

          <div>
            <label className="apple-text-caption2 apple-label-tertiary block mb-1.5">Asignar a</label>
            <select
              value={getAssignValue()}
              onChange={e => handleAssignChange(e.target.value)}
              className="apple-input w-full h-10"
            >
              <option value="all">Todos los empleados</option>
              <optgroup label="— Por rol —">
                <option value="role:admin">Administrador</option>
                <option value="role:manager">Gerente</option>
                <option value="role:technician">Técnico</option>
                <option value="role:cashier">Cajero</option>
              </optgroup>
              {employees.length > 0 && (
                <optgroup label="— Empleado específico —">
                  {employees.map(emp => (
                    <option key={emp.id} value={`emp:${emp.id}`}>{emp.full_name}</option>
                  ))}
                </optgroup>
              )}
            </select>
          </div>

          <div className="flex gap-2 pt-1">
            <button
              onClick={() => { setShowForm(false); setEditing(null); }}
              className="apple-btn apple-btn-secondary apple-press flex-1"
            >
              Cancelar
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="apple-btn apple-btn-primary apple-press flex-1 disabled:opacity-60"
            >
              {saving ? "Guardando..." : editing ? "Actualizar" : "Crear tarea"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
