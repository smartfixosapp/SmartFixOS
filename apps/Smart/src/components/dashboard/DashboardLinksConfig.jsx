import React, { useState, useEffect } from "react";
import {
  X, Save, Eye, EyeOff,
  DollarSign, TrendingUp, PackageCheck, Timer,
  AlertCircle, ShoppingCart, Users, Clock, Wrench,
  ClipboardList, Package, Wallet, BarChart3, Layers,
  LayoutGrid, Plus, Trash2, ExternalLink, Link, GripVertical
} from "lucide-react";
import { DragDropContext, Droppable, Draggable } from "@hello-pangea/dnd";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

const DASHBOARD_WIDGETS_KEY = "smartfix_dashboard_widgets_v2";
const CUSTOM_WIDGETS_KEY = "smartfix_custom_link_widgets";

const AVAILABLE_WIDGETS = [
  // ── Accesos directos de navegación ──────────────────────────────────────
  {
    id: "navNewOrder",
    group: "nav",
    label: "Nueva Orden",
    description: "Abre el asistente para crear una nueva orden de trabajo",
    icon: ClipboardList,
    color: "text-apple-blue",
    bg: "bg-apple-blue/15",
    border: "",
    defaultOn: true
  },
  {
    id: "navOrders",
    group: "nav",
    label: "Órdenes",
    description: "Navega al historial y gestión de órdenes",
    icon: ClipboardList,
    color: "text-apple-purple",
    bg: "bg-apple-purple/15",
    border: "",
    defaultOn: true
  },
  {
    id: "navInventory",
    group: "nav",
    label: "Inventario",
    description: "Gestiona stock, productos y servicios",
    icon: Package,
    color: "text-apple-green",
    bg: "bg-apple-green/15",
    border: "",
    defaultOn: true
  },
  {
    id: "navFinancial",
    group: "nav",
    label: "Finanzas",
    description: "Resumen financiero, caja y transacciones",
    icon: Wallet,
    color: "text-apple-green",
    bg: "bg-apple-green/15",
    border: "",
    defaultOn: true
  },
  {
    id: "navReports",
    group: "nav",
    label: "Reportes",
    description: "Reportes P&L, análisis y estadísticas",
    icon: BarChart3,
    color: "text-apple-indigo",
    bg: "bg-apple-indigo/15",
    border: "",
    defaultOn: false
  },
  // ── KPI widgets ──────────────────────────────────────────────────────────
  {
    id: "kpiIncome",
    group: "kpi",
    label: "Ingresos de hoy",
    description: "Ventas y ganancia del día actual",
    icon: DollarSign,
    color: "text-apple-green",
    bg: "bg-apple-green/15",
    border: "",
    defaultOn: true
  },
  {
    id: "kpiGoal",
    group: "kpi",
    label: "Meta diaria",
    description: "Porcentaje de avance hacia tu meta de ventas diaria",
    icon: TrendingUp,
    color: "text-apple-blue",
    bg: "bg-apple-blue/15",
    border: "",
    defaultOn: true
  },
  {
    id: "kpiActive",
    group: "kpi",
    label: "Órdenes activas",
    description: "Total de órdenes en progreso y listas para recoger",
    icon: Wrench,
    color: "text-apple-indigo",
    bg: "bg-apple-indigo/15",
    border: "",
    defaultOn: true
  },
  {
    id: "kpiDelivered",
    group: "kpi",
    label: "Entregadas hoy",
    description: "Reparaciones completadas y entregadas hoy",
    icon: PackageCheck,
    color: "text-apple-purple",
    bg: "bg-apple-purple/15",
    border: "",
    defaultOn: true
  },
  {
    id: "kpiOverdue",
    group: "kpi",
    label: "Sin movimiento",
    description: "Órdenes sin actualizar por más de 7 días",
    icon: Timer,
    color: "text-apple-red",
    bg: "bg-apple-red/15",
    border: "",
    defaultOn: true
  },
  {
    id: "orders",
    group: "data",
    label: "Gestión de Órdenes",
    description: "Filtros de estado, búsqueda y lista de órdenes activas",
    icon: ClipboardList,
    color: "text-apple-blue",
    bg: "bg-apple-blue/15",
    border: "",
    defaultOn: false
  },
  {
    id: "priceList",
    group: "data",
    label: "Lista de Precios",
    description: "Busca precios de productos y servicios al instante",
    icon: DollarSign,
    color: "text-apple-green",
    bg: "bg-apple-green/15",
    border: "",
    defaultOn: false
  },
  {
    id: "urgentOrders",
    group: "data",
    label: "Órdenes urgentes",
    description: "Órdenes activas sin actualizar por más de 5 días",
    icon: AlertCircle,
    color: "text-apple-red",
    bg: "bg-apple-red/15",
    border: "",
    defaultOn: false
  },
  {
    id: "readyPickup",
    group: "data",
    label: "Listos para recoger",
    description: "Reparaciones terminadas esperando al cliente",
    icon: PackageCheck,
    color: "text-apple-green",
    bg: "bg-apple-green/15",
    border: "",
    defaultOn: false
  },
  {
    id: "posSalesToday",
    group: "data",
    label: "Transacciones hoy",
    description: "Cantidad de movimientos financieros registrados hoy",
    icon: ShoppingCart,
    color: "text-apple-blue",
    bg: "bg-apple-blue/15",
    border: "",
    defaultOn: false
  },
  {
    id: "criticalStock",
    group: "data",
    label: "Stock crítico",
    description: "Productos con inventario bajo el mínimo configurado",
    icon: Package,
    color: "text-apple-orange",
    bg: "bg-apple-orange/15",
    border: "",
    defaultOn: false
  },
  {
    id: "newCustomers",
    group: "data",
    label: "Clientes nuevos",
    description: "Clientes registrados en los últimos 7 días",
    icon: Users,
    color: "text-apple-purple",
    bg: "bg-apple-purple/15",
    border: "",
    defaultOn: false
  },
  {
    id: "cashStatus",
    group: "data",
    label: "Estado de caja",
    description: "Si la caja está abierta e ingresos del día",
    icon: Wallet,
    color: "text-apple-green",
    bg: "bg-apple-green/15",
    border: "",
    defaultOn: false
  },
  {
    id: "avgRepairTime",
    group: "data",
    label: "Tiempo promedio",
    description: "Días promedio desde ingreso hasta entrega",
    icon: Clock,
    color: "text-apple-blue",
    bg: "bg-apple-blue/15",
    border: "",
    defaultOn: false
  },
  {
    id: "technicianLoad",
    group: "data",
    label: "Carga por técnico",
    description: "Órdenes activas asignadas a cada técnico",
    icon: Wrench,
    color: "text-apple-yellow",
    bg: "bg-apple-yellow/15",
    border: "",
    defaultOn: false
  },
];

const DEFAULT_WIDGET_CONFIG = {
  navNewOrder: true, navOrders: true, navInventory: true, navFinancial: true, navReports: false,
  kpiIncome: true, kpiGoal: true, kpiActive: true, kpiDelivered: true, kpiOverdue: true,
  orders: false, priceList: false, urgentOrders: false, readyPickup: false, posSalesToday: false,
  criticalStock: false, newCustomers: false, cashStatus: false, avgRepairTime: false, technicianLoad: false
};

export default function DashboardLinksConfig({ open, onClose }) {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [widgetConfig, setWidgetConfig] = useState({ ...DEFAULT_WIDGET_CONFIG });
  const [dailyGoal, setDailyGoal] = useState(() => {
    try { return localStorage.getItem("smartfix_daily_goal_override") || "1000"; } catch { return "1000"; }
  });
  const [customWidgets, setCustomWidgets] = useState([]);
  const WIDGET_ORDER_KEY = "smartfix_widget_order";
  const [widgetOrder, setWidgetOrder] = useState([]);
  const [showAddCustom, setShowAddCustom] = useState(false);
  const [newCustom, setNewCustom] = useState({ name: "", url: "" });

  useEffect(() => {
    if (open) {
      loadConfig();
    }
  }, [open]);

  const loadConfig = () => {
    setLoading(true);
    try {
      const raw = localStorage.getItem(DASHBOARD_WIDGETS_KEY);
      const parsed = raw ? JSON.parse(raw) : {};
      setWidgetConfig({ ...DEFAULT_WIDGET_CONFIG, ...parsed });
    } catch {
      setWidgetConfig({ ...DEFAULT_WIDGET_CONFIG });
    } finally {
      setLoading(false);
    }
    try {
      const rawCustom = localStorage.getItem(CUSTOM_WIDGETS_KEY);
      setCustomWidgets(rawCustom ? JSON.parse(rawCustom) : []);
    } catch {}
    try {
      const rawOrder = localStorage.getItem("smartfix_widget_order");
      if (rawOrder) {
        setWidgetOrder(JSON.parse(rawOrder));
      } else {
        setWidgetOrder(AVAILABLE_WIDGETS.map(w => w.id));
      }
    } catch {
      setWidgetOrder(AVAILABLE_WIDGETS.map(w => w.id));
    }
  };

  const handleSave = () => {
    setSaving(true);
    try {
      localStorage.setItem(DASHBOARD_WIDGETS_KEY, JSON.stringify(widgetConfig));
      const goalNum = Number(dailyGoal);
      if (!isNaN(goalNum) && goalNum > 0) {
        localStorage.setItem("smartfix_daily_goal_override", String(goalNum));
      }
      localStorage.setItem(CUSTOM_WIDGETS_KEY, JSON.stringify(customWidgets));
      localStorage.setItem("smartfix_widget_order", JSON.stringify(widgetOrder));
      window.dispatchEvent(new CustomEvent('dashboard-widgets-updated'));
      window.dispatchEvent(new CustomEvent('dashboard-custom-widgets-updated'));
      toast.success("Configuración guardada");
      onClose();
    } catch (error) {
      console.error("Error saving dashboard config:", error);
      toast.error("Error al guardar configuración");
    } finally {
      setSaving(false);
    }
  };

  const handleAddCustomWidget = () => {
    if (!newCustom.name.trim() || !newCustom.url.trim()) {
      toast.error("Completa el nombre y la URL");
      return;
    }
    let url = newCustom.url.trim();
    if (!url.startsWith("http://") && !url.startsWith("https://")) {
      url = "https://" + url;
    }
    const widget = {
      id: `custom_${Date.now()}`,
      name: newCustom.name.trim(),
      url
    };
    setCustomWidgets(prev => [...prev, widget]);
    setNewCustom({ name: "", url: "" });
    setShowAddCustom(false);
    toast.success("✅ Widget creado");
  };

  const handleDeleteCustomWidget = (id) => {
    setCustomWidgets(prev => prev.filter(w => w.id !== id));
  };

  const handleDragEnd = (result) => {
    if (!result.destination) return;
    const newOrder = Array.from(widgetOrder);
    const [moved] = newOrder.splice(result.source.index, 1);
    newOrder.splice(result.destination.index, 0, moved);
    setWidgetOrder(newOrder);
  };

  if (!open) return null;

  return (
    <div className="apple-type fixed inset-0 z-[9999] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="apple-surface-elevated rounded-apple-lg shadow-apple-xl border-0 max-w-3xl w-full max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="relative overflow-hidden apple-surface p-6" style={{ borderBottom: '0.5px solid rgb(var(--separator) / 0.29)' }}>
          <div className="relative flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 rounded-apple-md bg-apple-blue/15 flex items-center justify-center">
                <LayoutGrid className="w-8 h-8 text-apple-blue" />
              </div>
              <div>
                <h2 className="apple-text-title2 apple-label-primary">
                  Personalizar Dashboard
                </h2>
                <p className="apple-text-subheadline apple-label-secondary mt-1">
                  Activa o desactiva accesos y widgets
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="apple-press w-10 h-10 rounded-apple-sm bg-gray-sys6 dark:bg-gray-sys5 flex items-center justify-center transition-all"
            >
              <X className="w-5 h-5 apple-label-primary" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto max-h-[calc(90vh-200px)]">
          {loading ? (
            <div className="text-center py-12">
              <div className="w-12 h-12 border-4 border-apple-blue/30 border-t-apple-blue rounded-full animate-spin mx-auto mb-4" />
              <p className="apple-label-secondary apple-text-subheadline">Cargando configuración...</p>
            </div>
          ) : (
            <div className="space-y-6">
              {/* ── Widgets — Lista unificada con drag ── */}
              <div>
                <p className="apple-text-caption1 font-semibold apple-label-tertiary mb-3 flex items-center gap-2">
                  <Layers className="w-3.5 h-3.5" />
                  Widgets · arrastra para reorganizar
                </p>
                <DragDropContext onDragEnd={handleDragEnd}>
                  <Droppable droppableId="widgets-list">
                    {(provided) => (
                      <div
                        {...provided.droppableProps}
                        ref={provided.innerRef}
                        className="space-y-2"
                      >
                        {widgetOrder
                          .map(id => AVAILABLE_WIDGETS.find(w => w.id === id))
                          .filter(Boolean)
                          .map((widget, index) => {
                            const enabled = !!widgetConfig[widget.id];
                            const IconComp = widget.icon;
                            return (
                              <Draggable key={widget.id} draggableId={widget.id} index={index}>
                                {(provided, snapshot) => (
                                  <div
                                    ref={provided.innerRef}
                                    {...provided.draggableProps}
                                    className={`rounded-apple-md transition-all p-3 flex items-center gap-3 ${
                                      snapshot.isDragging ? "opacity-80 scale-[1.02] shadow-apple-xl" : ""
                                    } ${
                                      enabled
                                        ? widget.bg
                                        : "apple-surface opacity-60"
                                    }`}
                                  >
                                    {/* Drag handle */}
                                    <div
                                      {...provided.dragHandleProps}
                                      className="apple-label-tertiary transition-colors cursor-grab active:cursor-grabbing flex-shrink-0"
                                    >
                                      <GripVertical className="w-4 h-4" />
                                    </div>
                                    {/* Icon */}
                                    <div className={`w-9 h-9 rounded-apple-sm ${widget.bg} flex items-center justify-center flex-shrink-0`}>
                                      <IconComp className={`w-5 h-5 ${widget.color}`} />
                                    </div>
                                    {/* Label */}
                                    <div className="flex-1 min-w-0">
                                      <p className="apple-label-primary apple-text-subheadline font-semibold truncate">{widget.label}</p>
                                      <p className="apple-label-secondary apple-text-caption1 mt-0.5 truncate">{widget.description}</p>
                                    </div>
                                    {/* Toggle */}
                                    <button
                                      onClick={() => setWidgetConfig(prev => ({ ...prev, [widget.id]: !prev[widget.id] }))}
                                      className={`apple-press px-3 py-1.5 rounded-apple-sm font-semibold apple-text-caption1 transition-all flex items-center gap-1.5 flex-shrink-0 ${
                                        enabled
                                          ? "bg-apple-green text-white"
                                          : "bg-gray-sys6 dark:bg-gray-sys5 apple-label-secondary"
                                      }`}
                                    >
                                      {enabled ? (
                                        <><Eye className="w-3.5 h-3.5" /> Visible</>
                                      ) : (
                                        <><EyeOff className="w-3.5 h-3.5" /> Oculto</>
                                      )}
                                    </button>
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
              </div>

              {/* Meta diaria config */}
              <div className="pt-4" style={{ borderTop: '0.5px solid rgb(var(--separator) / 0.29)' }}>
                <p className="apple-text-caption1 font-semibold apple-label-tertiary mb-3">Configurar Meta Diaria</p>
                <div className="flex items-center gap-3 apple-surface rounded-apple-md px-4 py-3">
                  <TrendingUp className="w-4 h-4 text-apple-blue shrink-0" />
                  <span className="apple-text-caption1 apple-label-secondary font-semibold whitespace-nowrap">Meta $</span>
                  <input
                    type="number"
                    min="0"
                    value={dailyGoal}
                    onChange={(e) => setDailyGoal(e.target.value)}
                    placeholder="1000"
                    className="flex-1 bg-transparent apple-label-primary apple-text-subheadline font-semibold outline-none placeholder:opacity-40 min-w-0 tabular-nums"
                  />
                  <span className="apple-text-caption2 apple-label-secondary font-semibold">USD/día</span>
                </div>
              </div>

              {/* ── Widgets Personalizados ───────────────────────────────────────────── */}
              <div className="mt-6 pt-6" style={{ borderTop: '0.5px solid rgb(var(--separator) / 0.29)' }}>
                <div className="flex items-center justify-between mb-4">
                  <p className="apple-text-caption1 font-semibold apple-label-tertiary">Widgets Personalizados</p>
                  <button
                    onClick={() => setShowAddCustom(!showAddCustom)}
                    className="apple-press flex items-center gap-1.5 px-3 py-1.5 rounded-apple-sm bg-apple-blue/15 text-apple-blue apple-text-caption1 font-semibold transition-all"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    Agregar
                  </button>
                </div>

                {showAddCustom && (
                  <div className="mb-4 apple-surface rounded-apple-md p-4 space-y-3">
                    <div>
                      <label className="apple-text-caption1 font-semibold apple-label-tertiary block mb-1.5">Nombre</label>
                      <input
                        type="text"
                        value={newCustom.name}
                        onChange={e => setNewCustom(prev => ({ ...prev, name: e.target.value }))}
                        placeholder="Ej: Suplidor ABC"
                        className="apple-input w-full px-3 py-2.5"
                      />
                    </div>
                    <div>
                      <label className="apple-text-caption1 font-semibold apple-label-tertiary block mb-1.5">URL</label>
                      <input
                        type="url"
                        value={newCustom.url}
                        onChange={e => setNewCustom(prev => ({ ...prev, url: e.target.value }))}
                        placeholder="https://ejemplo.com"
                        className="apple-input w-full px-3 py-2.5"
                      />
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => { setShowAddCustom(false); setNewCustom({ name: "", url: "" }); }}
                        className="apple-btn apple-btn-secondary flex-1 py-2 apple-text-caption1 font-semibold"
                      >
                        Cancelar
                      </button>
                      <button
                        onClick={handleAddCustomWidget}
                        className="apple-btn apple-btn-primary flex-1 py-2 apple-text-caption1 font-semibold"
                      >
                        Crear Widget
                      </button>
                    </div>
                  </div>
                )}

                {customWidgets.length === 0 && !showAddCustom && (
                  <div className="text-center py-6 apple-surface rounded-apple-md">
                    <ExternalLink className="w-6 h-6 apple-label-tertiary mx-auto mb-2" />
                    <p className="apple-label-secondary apple-text-caption1 font-semibold">Sin widgets personalizados</p>
                    <p className="apple-label-tertiary apple-text-caption2 mt-0.5">Agrega links externos como accesos rápidos</p>
                  </div>
                )}

                <div className="space-y-2">
                  {customWidgets.map(widget => (
                    <div key={widget.id} className="flex items-center gap-3 p-3 apple-surface rounded-apple-md">
                      <div className="w-9 h-9 rounded-apple-sm bg-apple-blue/15 flex items-center justify-center flex-shrink-0">
                        <Link className="w-4 h-4 text-apple-blue" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="apple-label-primary apple-text-subheadline font-semibold truncate">{widget.name}</p>
                        <p className="apple-label-tertiary apple-text-caption2 truncate">{widget.url}</p>
                      </div>
                      <button
                        onClick={() => handleDeleteCustomWidget(widget.id)}
                        className="apple-press w-8 h-8 rounded-apple-sm bg-apple-red/15 flex items-center justify-center text-apple-red transition-all flex-shrink-0"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="apple-surface p-6 flex items-center justify-between gap-4" style={{ borderTop: '0.5px solid rgb(var(--separator) / 0.29)' }}>
          <p className="apple-label-secondary apple-text-subheadline">
            Los cambios se aplicarán inmediatamente
          </p>
          <div className="flex gap-3">
            <Button
              onClick={onClose}
              variant="outline"
              className="apple-btn apple-btn-secondary"
              disabled={saving}
            >
              Cancelar
            </Button>
            <Button
              onClick={handleSave}
              disabled={saving || loading}
              className="apple-btn apple-btn-primary"
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
