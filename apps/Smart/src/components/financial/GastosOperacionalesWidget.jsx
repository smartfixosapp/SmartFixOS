import React, { useState, useEffect, useMemo, useCallback } from "react";
import { dataClient } from "@/components/api/dataClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from "@/components/ui/select";
import {
  Plus, Edit2, Trash2, Calendar, Target, TrendingUp,
  AlertTriangle, CheckCircle2, Clock, DollarSign, RefreshCw,
  Zap, Home, Wifi, Phone, Shield, Users, Package, BarChart2,
  Tag, Settings2, X, Check, Layers
} from "lucide-react";
import { toast } from "sonner";

// ── Helpers ──────────────────────────────────────────────────────────────────

const CATEGORY_META = {
  rent:        { label: "Renta",        icon: Home,      color: "bg-apple-orange/12", accent: "text-apple-orange" },
  utilities:   { label: "Servicios",    icon: Zap,       color: "bg-apple-yellow/12", accent: "text-apple-yellow" },
  payroll:     { label: "Nómina",       icon: Users,     color: "bg-apple-blue/12",   accent: "text-apple-blue" },
  internet:    { label: "Internet",     icon: Wifi,      color: "bg-apple-blue/12",   accent: "text-apple-blue" },
  phone:       { label: "Teléfono",     icon: Phone,     color: "bg-apple-green/12",  accent: "text-apple-green" },
  insurance:   { label: "Seguro",       icon: Shield,    color: "bg-apple-purple/12", accent: "text-apple-purple" },
  inventory:   { label: "Inventario",   icon: Package,   color: "bg-apple-red/12",    accent: "text-apple-red" },
  marketing:   { label: "Marketing",    icon: BarChart2, color: "bg-apple-red/12",    accent: "text-apple-red" },
  maintenance: { label: "Mantenimiento",icon: RefreshCw, color: "bg-gray-sys6 dark:bg-gray-sys5", accent: "apple-label-secondary" },
  savings:     { label: "Ahorro",       icon: DollarSign,color: "bg-apple-green/12",  accent: "text-apple-green" },
  taxes:       { label: "Impuestos",    icon: AlertTriangle,color: "bg-apple-red/12", accent: "text-apple-red" },
  other:       { label: "Otro",         icon: Target,    color: "bg-gray-sys6 dark:bg-gray-sys5", accent: "apple-label-secondary" },
};

// Custom category color palette (Apple semantic colors)
const COLOR_OPTIONS = [
  { id: "sky",     color: "bg-apple-blue/12",   accent: "text-apple-blue" },
  { id: "lime",    color: "bg-apple-green/12",  accent: "text-apple-green" },
  { id: "fuchsia", color: "bg-apple-purple/12", accent: "text-apple-purple" },
  { id: "amber",   color: "bg-apple-orange/12", accent: "text-apple-orange" },
  { id: "teal",    color: "bg-apple-indigo/12", accent: "text-apple-indigo" },
  { id: "indigo",  color: "bg-apple-indigo/12", accent: "text-apple-indigo" },
  { id: "red",     color: "bg-apple-red/12",    accent: "text-apple-red" },
  { id: "slate",   color: "bg-gray-sys6 dark:bg-gray-sys5", accent: "apple-label-secondary" },
];

const COLOR_DOT_MAP = {
  sky: "bg-apple-blue", lime: "bg-apple-green", fuchsia: "bg-apple-purple",
  amber: "bg-apple-orange", teal: "bg-apple-indigo", indigo: "bg-apple-indigo",
  red: "bg-apple-red", slate: "bg-gray-sys3",
};

const LS_KEY = "smartfix_custom_expense_categories";

function loadCustomCategories() {
  try { return JSON.parse(localStorage.getItem(LS_KEY) || "[]"); }
  catch { return []; }
}
function saveCustomCategories(cats) {
  localStorage.setItem(LS_KEY, JSON.stringify(cats));
}

function buildCategoryMeta(customCats) {
  const merged = { ...CATEGORY_META };
  for (const c of customCats) {
    const colorOption = COLOR_OPTIONS.find((o) => o.id === c.colorId) || COLOR_OPTIONS[0];
    merged[c.id] = {
      label: c.label,
      icon: Tag,
      color: colorOption.color,
      accent: colorOption.accent,
      isCustom: true,
    };
  }
  return merged;
}

const getCategoryMeta = (cat, allMeta) => {
  const meta = allMeta || CATEGORY_META;
  return meta[cat] || meta.other;
};

/** Returns days until the payment window opens this month (or next if already past) */
function computeExpenseStatus(expense) {
  const now = new Date();
  const todayDay = now.getDate();
  const dueStart = Math.max(1, Math.min(31, Number(expense.due_day || 1)));
  const dueEnd = Math.max(dueStart, Math.min(31, Number(expense.due_day_end || dueStart)));
  const amount = Number(expense.amount || 0);

  // Is the window active this month?
  if (todayDay >= dueStart && todayDay <= dueEnd) {
    return {
      status: "in_window",
      label: "¡Pagar ahora!",
      daysUntilStart: 0,
      daysUntilEnd: dueEnd - todayDay,
      dailySavings: amount, // full amount needed immediately
      urgency: "critical",
    };
  }

  if (todayDay < dueStart) {
    // Window is coming this month
    const daysUntil = dueStart - todayDay;
    return {
      status: "upcoming",
      label: `En ${daysUntil} día${daysUntil === 1 ? "" : "s"}`,
      daysUntilStart: daysUntil,
      daysUntilEnd: dueEnd - todayDay,
      dailySavings: daysUntil > 0 ? amount / daysUntil : amount,
      urgency: daysUntil <= 5 ? "high" : daysUntil <= 10 ? "medium" : "low",
    };
  }

  // Window passed this month — next occurrence is next month
  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 2, 0).getDate();
  const daysUntil = daysInMonth - todayDay + dueStart;
  return {
    status: "next_month",
    label: `En ${daysUntil} días`,
    daysUntilStart: daysUntil,
    daysUntilEnd: daysUntil + (dueEnd - dueStart),
    dailySavings: daysUntil > 0 ? amount / daysUntil : amount,
    urgency: "low",
  };
}

const URGENCY_STYLES = {
  critical: { ring: "bg-apple-red/12",    dot: "bg-apple-red",    badge: "text-apple-red" },
  high:     { ring: "bg-apple-orange/12", dot: "bg-apple-orange", badge: "text-apple-orange" },
  medium:   { ring: "bg-apple-blue/12",   dot: "bg-apple-blue",   badge: "text-apple-blue" },
  low:      { ring: "",                   dot: "bg-gray-sys3",    badge: "apple-label-tertiary" },
};

// ── Month Timeline ─────────────────────────────────────────────────────────

function MonthTimeline({ expenses }) {
  const today = new Date().getDate();
  const daysInMonth = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).getDate();
  const days = Array.from({ length: daysInMonth }, (_, i) => i + 1);

  // Map each day to expenses due in that day range
  const dayExpenses = useMemo(() => {
    const map = {};
    for (const exp of expenses) {
      const start = Math.max(1, Math.min(31, Number(exp.due_day || 1)));
      const end = Math.max(start, Math.min(31, Number(exp.due_day_end || start)));
      for (let d = start; d <= end; d++) {
        if (!map[d]) map[d] = [];
        map[d].push(exp);
      }
    }
    return map;
  }, [expenses]);

  return (
    <div className="apple-type p-4 apple-card rounded-apple-md overflow-x-auto">
      <div className="flex items-end gap-[2px] min-w-[400px]">
        {days.map((d) => {
          const isToday = d === today;
          const expsHere = dayExpenses[d] || [];
          const hasExpense = expsHere.length > 0;
          const isInWindow = expsHere.some((e) => {
            const start = Number(e.due_day || 1);
            const end = Number(e.due_day_end || start);
            return d >= start && d <= end;
          });

          let dotColor = "bg-gray-sys6 dark:bg-gray-sys5";
          if (isInWindow && d < today) dotColor = "bg-gray-sys4";
          else if (isInWindow && d === today) dotColor = "bg-apple-red";
          else if (isInWindow) dotColor = "bg-apple-orange";

          return (
            <div key={d} className="relative flex flex-col items-center gap-1 flex-1 group/day" title={hasExpense ? expsHere.map(e => e.name).join(", ") : undefined}>
              {/* Bar */}
              <div className={`w-full rounded-apple-xs transition-all ${
                hasExpense ? (d < today ? "h-5 opacity-40" : "h-5") : "h-1"
              } ${dotColor}`} />
              {/* Day number */}
              {(d === 1 || d === 5 || d === 10 || d === 15 || d === 20 || d === 25 || d === daysInMonth || isToday) && (
                <span className={`apple-text-caption2 tabular-nums font-semibold ${isToday ? "apple-label-primary" : "apple-label-secondary"}`}>{d}</span>
              )}
              {/* Today marker */}
              {isToday && (
                <div className="absolute -top-1 left-1/2 -translate-x-1/2 w-1.5 h-1.5 bg-apple-blue rounded-full" />
              )}
              {/* Tooltip on hover */}
              {hasExpense && (
                <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 hidden group-hover/day:block z-10 pointer-events-none apple-surface-elevated rounded-apple-sm p-2 whitespace-nowrap apple-text-caption2 apple-label-primary tabular-nums shadow-apple-xl">
                  {expsHere.map((e) => <div key={e.id}>{e.name} — ${Number(e.amount || 0).toFixed(2)}</div>)}
                </div>
              )}
            </div>
          );
        })}
      </div>
      <div className="flex items-center gap-3 mt-3">
        <div className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-apple-xs bg-apple-orange" /><span className="apple-text-caption2 apple-label-tertiary font-semibold">Ventana próxima</span></div>
        <div className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-apple-xs bg-apple-red" /><span className="apple-text-caption2 apple-label-tertiary font-semibold">Hoy / urgente</span></div>
        <div className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-apple-xs bg-gray-sys6 dark:bg-gray-sys5" /><span className="apple-text-caption2 apple-label-tertiary font-semibold">Sin pago</span></div>
      </div>
    </div>
  );
}


// ── Manage Categories Dialog ──────────────────────────────────────────────────

function ManageCategoriesDialog({ open, onClose, onChanged }) {
  const [cats, setCats] = useState([]);
  const [newLabel, setNewLabel] = useState("");
  const [newColor, setNewColor] = useState("sky");
  const [editingId, setEditingId] = useState(null);
  const [editLabel, setEditLabel] = useState("");
  const [editColor, setEditColor] = useState("sky");

  useEffect(() => {
    if (open) setCats(loadCustomCategories());
  }, [open]);

  const persist = (next) => {
    saveCustomCategories(next);
    setCats(next);
    onChanged?.();
  };

  const handleAdd = () => {
    const label = newLabel.trim();
    if (!label) return;
    if (cats.some((c) => c.label.toLowerCase() === label.toLowerCase())) {
      toast.error("Ya existe una categoría con ese nombre"); return;
    }
    const id = `custom_${Date.now()}`;
    persist([...cats, { id, label, colorId: newColor }]);
    setNewLabel("");
    setNewColor("sky");
    toast.success("Categoría creada");
  };

  const handleDelete = (id) => {
    persist(cats.filter((c) => c.id !== id));
    toast.success("Categoría eliminada");
  };

  const startEdit = (c) => { setEditingId(c.id); setEditLabel(c.label); setEditColor(c.colorId); };
  const cancelEdit = () => { setEditingId(null); setEditLabel(""); setEditColor("sky"); };

  const confirmEdit = (id) => {
    const label = editLabel.trim();
    if (!label) return;
    persist(cats.map((c) => c.id === id ? { ...c, label, colorId: editColor } : c));
    cancelEdit();
    toast.success("Categoría actualizada");
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="apple-type apple-surface-elevated rounded-apple-lg shadow-apple-xl border-0 p-0 overflow-hidden max-w-sm">
        <div className="p-5">
          <DialogHeader>
            <DialogTitle className="apple-text-title3 apple-label-primary flex items-center gap-3">
              <div className="w-9 h-9 rounded-apple-md bg-apple-blue/15 flex items-center justify-center">
                <Layers className="w-4 h-4 text-apple-blue" />
              </div>
              Gestionar Categorías
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 pt-3">
            {/* Existing custom categories */}
            {cats.length === 0 ? (
              <p className="apple-text-footnote apple-label-tertiary text-center py-4">No hay categorías personalizadas aún.</p>
            ) : (
              <div className="space-y-2 max-h-52 overflow-y-auto pr-1">
                {cats.map((c) => {
                  const dot = COLOR_DOT_MAP[c.colorId] || "bg-gray-sys3";
                  return editingId === c.id ? (
                    <div key={c.id} className="flex items-center gap-2 bg-gray-sys6 dark:bg-gray-sys5 rounded-apple-md p-2.5">
                      <Input
                        value={editLabel}
                        onChange={(e) => setEditLabel(e.target.value)}
                        className="apple-input flex-1 h-8 apple-text-footnote rounded-apple-sm"
                        onKeyDown={(e) => e.key === "Enter" && confirmEdit(c.id)}
                        autoFocus
                      />
                      <div className="flex gap-1">
                        {COLOR_OPTIONS.map((opt) => (
                          <button
                            key={opt.id}
                            onClick={() => setEditColor(opt.id)}
                            className={`w-5 h-5 rounded-full ${COLOR_DOT_MAP[opt.id]} transition-all ${editColor === opt.id ? "ring-2 ring-apple-blue scale-110" : "opacity-60"}`}
                          />
                        ))}
                      </div>
                      <button onClick={() => confirmEdit(c.id)} className="apple-press w-7 h-7 rounded-apple-sm bg-apple-blue/15 text-apple-blue flex items-center justify-center">
                        <Check className="w-3.5 h-3.5" />
                      </button>
                      <button onClick={cancelEdit} className="apple-press w-7 h-7 rounded-apple-sm bg-gray-sys6 dark:bg-gray-sys5 apple-label-secondary flex items-center justify-center">
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ) : (
                    <div key={c.id} className="apple-card flex items-center gap-3 rounded-apple-md px-3 py-2.5 group">
                      <div className={`w-3 h-3 rounded-full flex-shrink-0 ${dot}`} />
                      <span className="flex-1 apple-text-footnote font-semibold apple-label-primary truncate">{c.label}</span>
                      <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button onClick={() => startEdit(c)} className="apple-press w-7 h-7 rounded-apple-sm bg-apple-blue/12 text-apple-blue flex items-center justify-center">
                          <Edit2 className="w-3 h-3" />
                        </button>
                        <button onClick={() => handleDelete(c.id)} className="apple-press w-7 h-7 rounded-apple-sm bg-apple-red/12 text-apple-red flex items-center justify-center">
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Divider */}
            <div style={{ borderTop: "0.5px solid rgb(var(--separator) / 0.29)" }} />

            {/* Add new */}
            <div className="space-y-3">
              <p className="apple-text-caption2 font-semibold apple-label-tertiary">Nueva Categoría</p>
              <Input
                value={newLabel}
                onChange={(e) => setNewLabel(e.target.value)}
                placeholder="Ej: Transporte, Limpieza..."
                className="apple-input rounded-apple-sm h-10 apple-text-footnote"
                onKeyDown={(e) => e.key === "Enter" && handleAdd()}
              />
              {/* Color picker */}
              <div className="flex items-center gap-2">
                <span className="apple-text-caption2 font-semibold apple-label-tertiary mr-1">Color:</span>
                {COLOR_OPTIONS.map((opt) => (
                  <button
                    key={opt.id}
                    onClick={() => setNewColor(opt.id)}
                    className={`w-6 h-6 rounded-full ${COLOR_DOT_MAP[opt.id]} transition-all ${newColor === opt.id ? "ring-2 ring-apple-blue scale-110" : "opacity-50"}`}
                  />
                ))}
              </div>
              <Button
                onClick={handleAdd}
                disabled={!newLabel.trim()}
                className="apple-btn apple-btn-primary w-full h-10 disabled:opacity-40"
              >
                <Plus className="w-4 h-4 mr-2" />
                Agregar Categoría
              </Button>
            </div>

            <Button onClick={onClose} variant="ghost" className="apple-btn apple-btn-secondary w-full h-10 mt-1">
              Cerrar
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ── Add / Edit Dialog ─────────────────────────────────────────────────────────

const EMPTY_FORM = {
  name: "",
  category: "other",
  amount: "",
  due_day: "",
  due_day_end: "",
  working_days_per_month: "26",
  notes: "",
};

function ExpenseFormDialog({ open, onClose, initial, onSave, allCategoryMeta }) {
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [showManageCats, setShowManageCats] = useState(false);

  useEffect(() => {
    if (open) {
      setForm(
        initial
          ? {
              name: initial.name || "",
              category: initial.category || "other",
              amount: String(initial.amount || ""),
              due_day: String(initial.due_day || ""),
              due_day_end: String(initial.due_day_end || ""),
              working_days_per_month: String(initial.working_days_per_month || "26"),
              notes: initial.notes || "",
            }
          : EMPTY_FORM
      );
    }
  }, [open, initial]);

  const set = (field, value) => setForm((f) => ({ ...f, [field]: value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    const name = form.name.trim();
    if (!name) { toast.error("El nombre es requerido"); return; }
    const amount = parseFloat(form.amount);
    if (!amount || amount <= 0) { toast.error("El monto debe ser mayor a 0"); return; }
    const dueDay = parseInt(form.due_day);
    if (!dueDay || dueDay < 1 || dueDay > 31) { toast.error("Día de vencimiento inválido (1-31)"); return; }

    setSaving(true);
    try {
      await onSave({
        name,
        category: form.category,
        amount,
        due_day: dueDay,
        due_day_end: form.due_day_end ? parseInt(form.due_day_end) : dueDay,
        working_days_per_month: parseInt(form.working_days_per_month) || 26,
        notes: form.notes.trim(),
        // Legacy fields — keep compatible
        percentage: 0,
        frequency: "monthly",
        active: true,
      });
      onClose();
    } catch (err) {
      toast.error(err?.message || "Error al guardar");
    } finally {
      setSaving(false);
    }
  };

  const meta = getCategoryMeta(form.category, allCategoryMeta);
  const IconComp = meta.icon;

  return (
    <>
      <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
        <DialogContent className="apple-type apple-surface-elevated rounded-apple-lg shadow-apple-xl border-0 p-0 overflow-hidden max-w-md">
          <div className="p-5">
            <DialogHeader>
              <DialogTitle className="apple-text-title2 apple-label-primary flex items-center gap-3">
                <div className={`w-10 h-10 rounded-apple-md ${meta.color} flex items-center justify-center`}>
                  <IconComp className={`w-5 h-5 ${meta.accent}`} />
                </div>
                {initial ? "Editar Gasto" : "Nuevo Gasto Operacional"}
              </DialogTitle>
            </DialogHeader>

            <form onSubmit={handleSubmit} className="space-y-4 pt-4">
              {/* Name */}
              <div className="space-y-1.5">
                <Label className="apple-text-caption2 font-semibold apple-label-tertiary">Nombre *</Label>
                <Input
                  value={form.name}
                  onChange={(e) => set("name", e.target.value)}
                  placeholder="Ej: Renta local, Internet, Luz..."
                  className="apple-input rounded-apple-md h-11"
                />
              </div>

              {/* Category + manage button */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label className="apple-text-caption2 font-semibold apple-label-tertiary">Categoría</Label>
                  <button
                    type="button"
                    onClick={() => setShowManageCats(true)}
                    className="apple-press flex items-center gap-1 apple-text-caption2 font-semibold text-apple-blue transition-colors"
                  >
                    <Settings2 className="w-3 h-3" />
                    Gestionar
                  </button>
                </div>
                <Select value={form.category} onValueChange={(v) => set("category", v)}>
                  <SelectTrigger className="apple-input rounded-apple-md h-11">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="apple-surface-elevated border-0 shadow-apple-xl rounded-apple-md">
                    {Object.entries(allCategoryMeta || CATEGORY_META).map(([key, m]) => {
                      const Icon = m.icon;
                      return (
                        <SelectItem key={key} value={key} className="rounded-apple-sm">
                          <div className="flex items-center gap-2">
                            <Icon className={`w-4 h-4 ${m.accent}`} />
                            <span>{m.label}</span>
                            {m.isCustom && <span className="apple-text-caption2 apple-label-tertiary ml-1">·personalizada</span>}
                          </div>
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
              </div>

              {/* Amount */}
              <div className="space-y-1.5">
                <Label className="apple-text-caption2 font-semibold apple-label-tertiary">Monto mensual *</Label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 apple-label-secondary font-semibold apple-text-footnote">$</span>
                  <Input
                    type="number"
                    min="0"
                    step="0.01"
                    value={form.amount}
                    onChange={(e) => set("amount", e.target.value)}
                    placeholder="0.00"
                    className="apple-input rounded-apple-md h-11 pl-7 tabular-nums"
                  />
                </div>
              </div>

              {/* Due day range */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="apple-text-caption2 font-semibold apple-label-tertiary">Día de inicio *</Label>
                  <Input
                    type="number"
                    min="1"
                    max="31"
                    value={form.due_day}
                    onChange={(e) => set("due_day", e.target.value)}
                    placeholder="Ej: 1"
                    className="apple-input rounded-apple-md h-11 tabular-nums"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="apple-text-caption2 font-semibold apple-label-tertiary">Día de fin</Label>
                  <Input
                    type="number"
                    min="1"
                    max="31"
                    value={form.due_day_end}
                    onChange={(e) => set("due_day_end", e.target.value)}
                    placeholder={form.due_day || "Ej: 5"}
                    className="apple-input rounded-apple-md h-11 tabular-nums"
                  />
                </div>
              </div>
              <p className="apple-text-caption2 apple-label-tertiary -mt-2">
                Rango en que se puede pagar, ej: renta del día 1 al 5, teléfono del 25 al 30.
              </p>

              {/* Working days */}
              <div className="space-y-1.5">
                <Label className="apple-text-caption2 font-semibold apple-label-tertiary">Días laborables / mes</Label>
                <Input
                  type="number"
                  min="1"
                  max="31"
                  value={form.working_days_per_month}
                  onChange={(e) => set("working_days_per_month", e.target.value)}
                  className="apple-input rounded-apple-md h-11 tabular-nums"
                />
                <p className="apple-text-caption2 apple-label-tertiary">Usado para calcular la meta diaria mínima.</p>
              </div>

              {/* Notes */}
              <div className="space-y-1.5">
                <Label className="apple-text-caption2 font-semibold apple-label-tertiary">Notas</Label>
                <Input
                  value={form.notes}
                  onChange={(e) => set("notes", e.target.value)}
                  placeholder="Notas opcionales..."
                  className="apple-input rounded-apple-md h-11"
                />
              </div>

              {/* Actions */}
              <div className="flex gap-3 pt-2">
                <Button type="button" onClick={onClose} variant="ghost" className="apple-btn apple-btn-secondary flex-1 h-11">
                  Cancelar
                </Button>
                <Button type="submit" disabled={saving} className="apple-btn apple-btn-primary flex-1 h-11">
                  {saving ? <RefreshCw className="w-4 h-4 animate-spin" /> : "Guardar"}
                </Button>
              </div>
            </form>
          </div>
        </DialogContent>
      </Dialog>

      {/* Nested manage-categories dialog */}
      <ManageCategoriesDialog
        open={showManageCats}
        onClose={() => setShowManageCats(false)}
        onChanged={() => {
          // bubble up so parent re-reads localStorage
          window.dispatchEvent(new Event("custom-categories-updated"));
        }}
      />
    </>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────

export default function GastosOperacionalesWidget() {
  const [expenses, setExpenses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showDialog, setShowDialog] = useState(false);
  const [editing, setEditing] = useState(null);
  const [allCategoryMeta, setAllCategoryMeta] = useState(() =>
    buildCategoryMeta(loadCustomCategories())
  );

  const refreshCategoryMeta = useCallback(() => {
    setAllCategoryMeta(buildCategoryMeta(loadCustomCategories()));
  }, []);

  useEffect(() => {
    loadExpenses();
    window.addEventListener("custom-categories-updated", refreshCategoryMeta);
    return () => window.removeEventListener("custom-categories-updated", refreshCategoryMeta);
  }, [refreshCategoryMeta]);

  const loadExpenses = async () => {
    setLoading(true);
    try {
      const data = await dataClient.entities.FixedExpense.list("-due_day", 100);
      setExpenses(Array.isArray(data) ? data.filter((e) => e.active !== false) : []);
    } catch (err) {
      console.error("GastosOperacionales load error:", err);
      setExpenses([]);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async (payload) => {
    if (editing) {
      await dataClient.entities.FixedExpense.update(editing.id, payload);
      toast.success("Gasto actualizado");
    } else {
      await dataClient.entities.FixedExpense.create(payload);
      toast.success("Gasto creado");
    }
    await loadExpenses();
    window.dispatchEvent(new Event("fixed-expenses-updated"));
  };

  const handleDelete = async (id) => {
    if (!window.confirm("¿Eliminar este gasto operacional?")) return;
    try {
      await dataClient.entities.FixedExpense.delete(id);
      setExpenses((prev) => prev.filter((e) => e.id !== id));
      toast.success("Gasto eliminado");
      window.dispatchEvent(new Event("fixed-expenses-updated"));
    } catch (err) {
      toast.error("Error al eliminar");
    }
  };

  const openAdd = () => { setEditing(null); setShowDialog(true); };
  const openEdit = (exp) => { setEditing(exp); setShowDialog(true); };

  // ── Computed ──────────────────────────────────────────────────────────────
  const enriched = useMemo(() =>
    expenses.map((e) => ({ ...e, ...computeExpenseStatus(e) }))
  , [expenses]);

  const totalMonthly = expenses.reduce((s, e) => s + Number(e.amount || 0), 0);
  const workingDays = expenses.length
    ? Math.round(expenses.reduce((s, e) => s + Number(e.working_days_per_month || 26), 0) / expenses.length)
    : 26;
  const dailyGoal = workingDays > 0 ? totalMonthly / workingDays : 0;

  // Sort by urgency
  const sortedExpenses = [...enriched].sort((a, b) => {
    const order = { critical: 0, high: 1, medium: 2, low: 3 };
    return (order[a.urgency] ?? 3) - (order[b.urgency] ?? 3);
  });

  return (
    <div className="apple-type apple-card rounded-apple-md p-4 space-y-3">
      {/* ── Header ───────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Target className="w-3.5 h-3.5 text-apple-blue" />
          <p className="apple-text-caption2 font-semibold apple-label-tertiary">Gastos Operacionales</p>
        </div>
        <button
          onClick={openAdd}
          className="apple-press flex items-center gap-1.5 px-3 py-1.5 rounded-apple-sm bg-apple-blue/15 text-apple-blue apple-text-caption1 font-semibold transition-colors"
        >
          <Plus className="w-3 h-3" /> Agregar
        </button>
      </div>

      {/* ── Summary strip ────────────────────────────────────────────────── */}
      {expenses.length > 0 && (
        <div className="grid grid-cols-3 gap-1.5">
          <div className="p-2.5 apple-card rounded-apple-sm">
            <p className="apple-text-caption2 font-semibold apple-label-tertiary mb-0.5">Mensual</p>
            <p className="apple-text-subheadline font-semibold apple-label-primary tabular-nums">${totalMonthly.toFixed(2)}</p>
          </div>
          <div className="p-2.5 bg-apple-blue/12 rounded-apple-sm">
            <p className="apple-text-caption2 font-semibold text-apple-blue mb-0.5">Meta/día</p>
            <p className="apple-text-subheadline font-semibold text-apple-blue tabular-nums">${dailyGoal.toFixed(2)}</p>
          </div>
          <div className="p-2.5 apple-card rounded-apple-sm">
            <p className="apple-text-caption2 font-semibold apple-label-tertiary mb-0.5">Días lab.</p>
            <p className="apple-text-subheadline font-semibold apple-label-secondary tabular-nums">{workingDays}d</p>
          </div>
        </div>
      )}

      {/* ── Month Timeline ────────────────────────────────────────────────── */}
      {expenses.length > 0 && <MonthTimeline expenses={expenses} />}

      {/* ── Content ──────────────────────────────────────────────────────── */}
      {loading ? (
        <div className="flex items-center justify-center py-6 gap-2">
          <RefreshCw className="w-3.5 h-3.5 animate-spin text-apple-blue" />
          <p className="apple-text-footnote apple-label-tertiary font-semibold">Cargando…</p>
        </div>
      ) : expenses.length === 0 ? (
        <div className="py-8 text-center rounded-apple-sm" style={{ border: "0.5px dashed rgb(var(--separator) / 0.29)" }}>
          <p className="apple-text-body apple-label-tertiary">Sin gastos operacionales</p>
          <button onClick={openAdd} className="apple-press mt-2 apple-text-caption1 font-semibold text-apple-blue transition-colors">+ Agregar primero</button>
        </div>
      ) : (
        <div className="space-y-1.5">
          {sortedExpenses.map((exp) => {
            const meta = getCategoryMeta(exp.category, allCategoryMeta);
            const IconComp = meta.icon;
            const urg = URGENCY_STYLES[exp.urgency] || URGENCY_STYLES.low;

            return (
              <div key={exp.id} className={`apple-list-row apple-press group flex items-center gap-3 p-3 rounded-apple-sm ${urg.ring || "bg-gray-sys6 dark:bg-gray-sys5"} transition-all`}>
                <div className={`w-7 h-7 rounded-apple-sm ${meta.color} flex items-center justify-center shrink-0`}>
                  <IconComp className={`w-3.5 h-3.5 ${meta.accent}`} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <p className="apple-text-footnote font-semibold apple-label-primary truncate">{exp.name}</p>
                    <span className={`apple-text-footnote font-semibold tabular-nums shrink-0 ml-2 ${meta.accent}`}>${Number(exp.amount || 0).toFixed(2)}</span>
                  </div>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className={`apple-text-caption2 font-semibold ${urg.badge}`}>{exp.label}</span>
                    <span className="apple-text-caption2 apple-label-tertiary">·</span>
                    <span className="apple-text-caption2 apple-label-tertiary tabular-nums">Día {exp.due_day}{exp.due_day_end && exp.due_day_end !== exp.due_day ? `–${exp.due_day_end}` : ""}</span>
                    <span className="apple-text-caption2 apple-label-tertiary">·</span>
                    <span className="apple-text-caption2 apple-label-secondary tabular-nums">${exp.dailySavings.toFixed(2)}/día</span>
                    {exp.status === "in_window" && <span className="apple-text-caption2 font-semibold text-apple-red">⚡ Ventana</span>}
                  </div>
                </div>
                <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                  <button onClick={() => openEdit(exp)} className="apple-press w-7 h-7 rounded-apple-sm bg-apple-blue/12 text-apple-blue flex items-center justify-center transition-colors">
                    <Edit2 className="w-3 h-3" />
                  </button>
                  <button onClick={() => handleDelete(exp.id)} className="apple-press w-7 h-7 rounded-apple-sm bg-apple-red/12 text-apple-red flex items-center justify-center transition-colors">
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── Add / Edit Dialog ─────────────────────────────────────────────── */}
      <ExpenseFormDialog
        open={showDialog}
        onClose={() => setShowDialog(false)}
        initial={editing}
        onSave={handleSave}
        allCategoryMeta={allCategoryMeta}
      />
    </div>
  );
}
