import React, { useState, useEffect } from "react";
import {
  X, Save, Eye, EyeOff,
  DollarSign, TrendingUp, PackageCheck, Timer,
  AlertCircle, ShoppingCart, Users, Clock, Wrench,
  ClipboardList, Package, Wallet, BarChart3, Layers,
  LayoutGrid, Plus, Trash2, ExternalLink, Link
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

const DASHBOARD_WIDGETS_KEY = "smartfix_dashboard_widgets";
const CUSTOM_WIDGETS_KEY = "smartfix_custom_link_widgets";

const AVAILABLE_WIDGETS = [
  // ── Accesos directos de navegación ──────────────────────────────────────
  {
    id: "navNewOrder",
    group: "nav",
    label: "Nueva Orden",
    description: "Abre el asistente para crear una nueva orden de trabajo",
    icon: ClipboardList,
    color: "text-sky-400",
    bg: "bg-sky-500/10",
    border: "border-sky-500/20",
    defaultOn: true
  },
  {
    id: "navOrders",
    group: "nav",
    label: "Órdenes",
    description: "Navega al historial y gestión de órdenes",
    icon: ClipboardList,
    color: "text-purple-400",
    bg: "bg-purple-500/10",
    border: "border-purple-500/20",
    defaultOn: true
  },
  {
    id: "navInventory",
    group: "nav",
    label: "Inventario",
    description: "Gestiona stock, productos y servicios",
    icon: Package,
    color: "text-teal-400",
    bg: "bg-teal-500/10",
    border: "border-teal-500/20",
    defaultOn: true
  },
  {
    id: "navFinancial",
    group: "nav",
    label: "Finanzas",
    description: "Resumen financiero, caja y transacciones",
    icon: Wallet,
    color: "text-emerald-400",
    bg: "bg-emerald-500/10",
    border: "border-emerald-500/20",
    defaultOn: true
  },
  {
    id: "navReports",
    group: "nav",
    label: "Reportes",
    description: "Reportes P&L, análisis y estadísticas",
    icon: BarChart3,
    color: "text-indigo-400",
    bg: "bg-indigo-500/10",
    border: "border-indigo-500/20",
    defaultOn: false
  },
  // ── KPI widgets ──────────────────────────────────────────────────────────
  {
    id: "kpiIncome",
    group: "kpi",
    label: "Ingresos de hoy",
    description: "Ventas y ganancia del día actual",
    icon: DollarSign,
    color: "text-emerald-400",
    bg: "bg-emerald-500/10",
    border: "border-emerald-500/20",
    defaultOn: true
  },
  {
    id: "kpiGoal",
    group: "kpi",
    label: "Meta diaria",
    description: "Porcentaje de avance hacia tu meta de ventas diaria",
    icon: TrendingUp,
    color: "text-blue-400",
    bg: "bg-blue-500/10",
    border: "border-blue-500/20",
    defaultOn: true
  },
  {
    id: "kpiActive",
    group: "kpi",
    label: "Órdenes activas",
    description: "Total de órdenes en progreso y listas para recoger",
    icon: Wrench,
    color: "text-indigo-400",
    bg: "bg-indigo-500/10",
    border: "border-indigo-500/20",
    defaultOn: true
  },
  {
    id: "kpiDelivered",
    group: "kpi",
    label: "Entregadas hoy",
    description: "Reparaciones completadas y entregadas hoy",
    icon: PackageCheck,
    color: "text-purple-400",
    bg: "bg-purple-500/10",
    border: "border-purple-500/20",
    defaultOn: true
  },
  {
    id: "kpiOverdue",
    group: "kpi",
    label: "Sin movimiento",
    description: "Órdenes sin actualizar por más de 7 días",
    icon: Timer,
    color: "text-red-400",
    bg: "bg-red-500/10",
    border: "border-red-500/20",
    defaultOn: true
  },
  {
    id: "orders",
    group: "data",
    label: "Gestión de Órdenes",
    description: "Filtros de estado, búsqueda y lista de órdenes activas",
    icon: ClipboardList,
    color: "text-blue-400",
    bg: "bg-blue-500/10",
    border: "border-blue-500/20",
    defaultOn: false
  },
  {
    id: "priceList",
    group: "data",
    label: "Lista de Precios",
    description: "Busca precios de productos y servicios al instante",
    icon: DollarSign,
    color: "text-emerald-400",
    bg: "bg-emerald-500/10",
    border: "border-emerald-500/20",
    defaultOn: false
  },
  {
    id: "urgentOrders",
    group: "data",
    label: "Órdenes urgentes",
    description: "Órdenes activas sin actualizar por más de 5 días",
    icon: AlertCircle,
    color: "text-red-400",
    bg: "bg-red-500/10",
    border: "border-red-500/20",
    defaultOn: false
  },
  {
    id: "readyPickup",
    group: "data",
    label: "Listos para recoger",
    description: "Reparaciones terminadas esperando al cliente",
    icon: PackageCheck,
    color: "text-emerald-400",
    bg: "bg-emerald-500/10",
    border: "border-emerald-500/20",
    defaultOn: false
  },
  {
    id: "posSalesToday",
    group: "data",
    label: "Transacciones hoy",
    description: "Cantidad de movimientos financieros registrados hoy",
    icon: ShoppingCart,
    color: "text-cyan-400",
    bg: "bg-cyan-500/10",
    border: "border-cyan-500/20",
    defaultOn: false
  },
  {
    id: "criticalStock",
    group: "data",
    label: "Stock crítico",
    description: "Productos con inventario bajo el mínimo configurado",
    icon: Package,
    color: "text-orange-400",
    bg: "bg-orange-500/10",
    border: "border-orange-500/20",
    defaultOn: false
  },
  {
    id: "newCustomers",
    group: "data",
    label: "Clientes nuevos",
    description: "Clientes registrados en los últimos 7 días",
    icon: Users,
    color: "text-violet-400",
    bg: "bg-violet-500/10",
    border: "border-violet-500/20",
    defaultOn: false
  },
  {
    id: "cashStatus",
    group: "data",
    label: "Estado de caja",
    description: "Si la caja está abierta e ingresos del día",
    icon: Wallet,
    color: "text-emerald-400",
    bg: "bg-emerald-500/10",
    border: "border-emerald-500/20",
    defaultOn: false
  },
  {
    id: "avgRepairTime",
    group: "data",
    label: "Tiempo promedio",
    description: "Días promedio desde ingreso hasta entrega",
    icon: Clock,
    color: "text-sky-400",
    bg: "bg-sky-500/10",
    border: "border-sky-500/20",
    defaultOn: false
  },
  {
    id: "technicianLoad",
    group: "data",
    label: "Carga por técnico",
    description: "Órdenes activas asignadas a cada técnico",
    icon: Wrench,
    color: "text-amber-400",
    bg: "bg-amber-500/10",
    border: "border-amber-500/20",
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

  if (!open) return null;

  const navWidgets = AVAILABLE_WIDGETS.filter(w => w.group === "nav");
  const dataWidgets = AVAILABLE_WIDGETS.filter(w => w.group !== "nav");

  return (
    <div className="fixed inset-0 z-[9999] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 rounded-3xl border border-cyan-500/30 max-w-3xl w-full max-h-[90vh] overflow-hidden shadow-[0_0_100px_rgba(6,182,212,0.3)]">
        {/* Header */}
        <div className="relative overflow-hidden bg-gradient-to-r from-cyan-600/20 to-emerald-600/20 border-b border-cyan-500/30 p-6">
          <div className="absolute inset-0 bg-gradient-to-r from-cyan-500/5 to-emerald-500/5" />
          <div className="relative flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-cyan-500 to-emerald-500 flex items-center justify-center shadow-lg">
                <LayoutGrid className="w-8 h-8 text-white" />
              </div>
              <div>
                <h2 className="text-2xl font-black text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-emerald-400">
                  Personalizar Dashboard
                </h2>
                <p className="text-cyan-300/70 text-sm mt-1">
                  Activa o desactiva accesos y widgets
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
            <div className="space-y-6">
              {/* ── Accesos Directos ── */}
              <div>
                <p className="text-[10px] font-black text-white/30 uppercase tracking-widest mb-3 flex items-center gap-2">
                  <Layers className="w-3.5 h-3.5" />
                  Accesos Directos
                </p>
                <div className="space-y-3">
                  {navWidgets.map((widget) => {
                    const isEnabled = widgetConfig[widget.id] !== false && (widgetConfig[widget.id] === true || widget.defaultOn);
                    const enabled = !!widgetConfig[widget.id];
                    const IconComp = widget.icon;
                    return (
                      <div
                        key={widget.id}
                        className={`rounded-2xl border transition-all p-4 flex items-center gap-4 ${
                          enabled
                            ? `${widget.border} ${widget.bg}`
                            : "border-slate-700/30 bg-slate-900/40 opacity-70"
                        }`}
                      >
                        <div className={`w-12 h-12 rounded-xl ${widget.bg} border ${widget.border} flex items-center justify-center flex-shrink-0`}>
                          <IconComp className={`w-6 h-6 ${widget.color}`} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-white font-bold">{widget.label}</p>
                          <p className="text-slate-400 text-xs mt-0.5">{widget.description}</p>
                        </div>
                        <button
                          onClick={() => setWidgetConfig(prev => ({ ...prev, [widget.id]: !prev[widget.id] }))}
                          className={`px-4 py-2 rounded-xl font-semibold text-sm transition-all flex items-center gap-2 ${
                            enabled
                              ? "bg-gradient-to-r from-emerald-500 to-green-600 text-white shadow-lg"
                              : "bg-slate-700/50 text-slate-400 border border-slate-600"
                          }`}
                        >
                          {enabled ? (
                            <><Eye className="w-4 h-4" /> Visible</>
                          ) : (
                            <><EyeOff className="w-4 h-4" /> Oculto</>
                          )}
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* ── Widgets de Datos ── */}
              <div>
                <p className="text-[10px] font-black text-white/30 uppercase tracking-widest mb-3 flex items-center gap-2">
                  <Layers className="w-3.5 h-3.5" />
                  Widgets de Datos
                </p>
                <div className="space-y-3">
                  {dataWidgets.map((widget) => {
                    const enabled = !!widgetConfig[widget.id];
                    const IconComp = widget.icon;
                    return (
                      <div
                        key={widget.id}
                        className={`rounded-2xl border transition-all p-4 flex items-center gap-4 ${
                          enabled
                            ? `${widget.border} ${widget.bg}`
                            : "border-slate-700/30 bg-slate-900/40 opacity-70"
                        }`}
                      >
                        <div className={`w-12 h-12 rounded-xl ${widget.bg} border ${widget.border} flex items-center justify-center flex-shrink-0`}>
                          <IconComp className={`w-6 h-6 ${widget.color}`} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-white font-bold">{widget.label}</p>
                          <p className="text-slate-400 text-xs mt-0.5">{widget.description}</p>
                        </div>
                        <button
                          onClick={() => setWidgetConfig(prev => ({ ...prev, [widget.id]: !prev[widget.id] }))}
                          className={`px-4 py-2 rounded-xl font-semibold text-sm transition-all flex items-center gap-2 ${
                            enabled
                              ? "bg-gradient-to-r from-emerald-500 to-green-600 text-white shadow-lg"
                              : "bg-slate-700/50 text-slate-400 border border-slate-600"
                          }`}
                        >
                          {enabled ? (
                            <><Eye className="w-4 h-4" /> Visible</>
                          ) : (
                            <><EyeOff className="w-4 h-4" /> Oculto</>
                          )}
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Meta diaria config */}
              <div className="pt-4 border-t border-white/[0.06]">
                <p className="text-[10px] font-black text-white/30 uppercase tracking-widest mb-3">Configurar Meta Diaria</p>
                <div className="flex items-center gap-3 bg-white/[0.04] border border-white/[0.08] rounded-2xl px-4 py-3">
                  <TrendingUp className="w-4 h-4 text-blue-400 shrink-0" />
                  <span className="text-xs text-white/50 font-bold whitespace-nowrap">Meta $</span>
                  <input
                    type="number"
                    min="0"
                    value={dailyGoal}
                    onChange={(e) => setDailyGoal(e.target.value)}
                    placeholder="1000"
                    className="flex-1 bg-transparent text-white text-sm font-black outline-none placeholder-white/20 min-w-0"
                  />
                  <span className="text-[10px] text-white/20 font-bold">USD/día</span>
                </div>
              </div>

              {/* ── Widgets Personalizados ───────────────────────────────────────────── */}
              <div className="mt-6 pt-6 border-t border-white/[0.06]">
                <div className="flex items-center justify-between mb-4">
                  <p className="text-[10px] font-black text-white/30 uppercase tracking-widest">Widgets Personalizados</p>
                  <button
                    onClick={() => setShowAddCustom(!showAddCustom)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 text-xs font-black hover:bg-cyan-500/20 transition-all"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    Agregar
                  </button>
                </div>

                {showAddCustom && (
                  <div className="mb-4 bg-white/[0.03] border border-white/[0.08] rounded-2xl p-4 space-y-3">
                    <div>
                      <label className="text-[10px] font-black text-white/30 uppercase tracking-widest block mb-1.5">Nombre</label>
                      <input
                        type="text"
                        value={newCustom.name}
                        onChange={e => setNewCustom(prev => ({ ...prev, name: e.target.value }))}
                        placeholder="Ej: Suplidor ABC"
                        className="w-full bg-white/[0.06] border border-white/[0.1] rounded-xl px-3 py-2.5 text-sm text-white placeholder-white/20 focus:outline-none focus:ring-2 focus:ring-cyan-500/40"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-black text-white/30 uppercase tracking-widest block mb-1.5">URL</label>
                      <input
                        type="url"
                        value={newCustom.url}
                        onChange={e => setNewCustom(prev => ({ ...prev, url: e.target.value }))}
                        placeholder="https://ejemplo.com"
                        className="w-full bg-white/[0.06] border border-white/[0.1] rounded-xl px-3 py-2.5 text-sm text-white placeholder-white/20 focus:outline-none focus:ring-2 focus:ring-cyan-500/40"
                      />
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => { setShowAddCustom(false); setNewCustom({ name: "", url: "" }); }}
                        className="flex-1 py-2 rounded-xl bg-white/5 border border-white/10 text-white/40 text-xs font-black hover:bg-white/10 transition-all"
                      >
                        Cancelar
                      </button>
                      <button
                        onClick={handleAddCustomWidget}
                        className="flex-1 py-2 rounded-xl bg-gradient-to-r from-cyan-500 to-emerald-600 text-white text-xs font-black hover:opacity-90 transition-all"
                      >
                        Crear Widget
                      </button>
                    </div>
                  </div>
                )}

                {customWidgets.length === 0 && !showAddCustom && (
                  <div className="text-center py-6 bg-white/[0.02] border border-dashed border-white/[0.08] rounded-2xl">
                    <ExternalLink className="w-6 h-6 text-white/15 mx-auto mb-2" />
                    <p className="text-white/20 text-xs font-bold">Sin widgets personalizados</p>
                    <p className="text-white/10 text-[10px] mt-0.5">Agrega links externos como accesos rápidos</p>
                  </div>
                )}

                <div className="space-y-2">
                  {customWidgets.map(widget => (
                    <div key={widget.id} className="flex items-center gap-3 p-3 bg-white/[0.03] border border-white/[0.07] rounded-xl">
                      <div className="w-9 h-9 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center flex-shrink-0">
                        <Link className="w-4 h-4 text-white/40" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-white text-sm font-bold truncate">{widget.name}</p>
                        <p className="text-white/30 text-[10px] truncate">{widget.url}</p>
                      </div>
                      <button
                        onClick={() => handleDeleteCustomWidget(widget.id)}
                        className="w-8 h-8 rounded-xl bg-red-500/10 border border-red-500/20 flex items-center justify-center text-red-400 hover:bg-red-500/20 transition-all flex-shrink-0"
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
