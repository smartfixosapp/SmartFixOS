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
  rent:        { label: "Renta",        icon: Home,      color: "from-orange-500/20 to-amber-500/10",   accent: "text-orange-400",  border: "border-orange-500/20" },
  utilities:   { label: "Servicios",    icon: Zap,       color: "from-yellow-500/20 to-amber-500/10",   accent: "text-yellow-400",  border: "border-yellow-500/20" },
  payroll:     { label: "Nómina",       icon: Users,     color: "from-blue-500/20 to-indigo-500/10",    accent: "text-blue-400",    border: "border-blue-500/20" },
  internet:    { label: "Internet",     icon: Wifi,      color: "from-cyan-500/20 to-blue-500/10",      accent: "text-cyan-400",    border: "border-cyan-500/20" },
  phone:       { label: "Teléfono",     icon: Phone,     color: "from-green-500/20 to-emerald-500/10",  accent: "text-green-400",   border: "border-green-500/20" },
  insurance:   { label: "Seguro",       icon: Shield,    color: "from-violet-500/20 to-purple-500/10",  accent: "text-violet-400",  border: "border-violet-500/20" },
  inventory:   { label: "Inventario",   icon: Package,   color: "from-pink-500/20 to-rose-500/10",      accent: "text-pink-400",    border: "border-pink-500/20" },
  marketing:   { label: "Marketing",    icon: BarChart2, color: "from-rose-500/20 to-pink-500/10",      accent: "text-rose-400",    border: "border-rose-500/20" },
  maintenance: { label: "Mantenimiento",icon: RefreshCw, color: "from-slate-500/20 to-gray-500/10",    accent: "text-slate-400",   border: "border-slate-500/20" },
  savings:     { label: "Ahorro",       icon: DollarSign,color: "from-emerald-500/20 to-teal-500/10",  accent: "text-emerald-400", border: "border-emerald-500/20" },
  taxes:       { label: "Impuestos",    icon: AlertTriangle,color: "from-red-500/20 to-rose-500/10",   accent: "text-red-400",     border: "border-red-500/20" },
  other:       { label: "Otro",         icon: Target,    color: "from-white/10 to-white/5",             accent: "text-white/60",    border: "border-white/10" },
};

// Custom category color palette (tailwind-safe classes)
const COLOR_OPTIONS = [
  { id: "sky",     color: "from-sky-500/20 to-sky-500/10",       accent: "text-sky-400",       border: "border-sky-500/20" },
  { id: "lime",    color: "from-lime-500/20 to-green-500/10",    accent: "text-lime-400",      border: "border-lime-500/20" },
  { id: "fuchsia", color: "from-fuchsia-500/20 to-pink-500/10", accent: "text-fuchsia-400",   border: "border-fuchsia-500/20" },
  { id: "amber",   color: "from-amber-500/20 to-yellow-500/10", accent: "text-amber-400",     border: "border-amber-500/20" },
  { id: "teal",    color: "from-teal-500/20 to-cyan-500/10",    accent: "text-teal-400",      border: "border-teal-500/20" },
  { id: "indigo",  color: "from-indigo-500/20 to-violet-500/10",accent: "text-indigo-400",    border: "border-indigo-500/20" },
  { id: "red",     color: "from-red-500/20 to-orange-500/10",   accent: "text-red-400",       border: "border-red-500/20" },
  { id: "slate",   color: "from-slate-400/20 to-slate-500/10",  accent: "text-slate-300",     border: "border-slate-400/20" },
];

const COLOR_DOT_MAP = {
  sky: "bg-sky-400", lime: "bg-lime-400", fuchsia: "bg-fuchsia-400",
  amber: "bg-amber-400", teal: "bg-teal-400", indigo: "bg-indigo-400",
  red: "bg-red-400", slate: "bg-slate-400",
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
      border: colorOption.border,
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
  critical: { ring: "border-red-500/40",   dot: "bg-red-500",    badge: "bg-red-500/20 text-red-400 border-red-500/30" },
  high:     { ring: "border-amber-500/40", dot: "bg-amber-500",  badge: "bg-amber-500/20 text-amber-400 border-amber-500/30" },
  medium:   { ring: "border-cyan-500/30",  dot: "bg-cyan-500",   badge: "bg-cyan-500/20 text-cyan-400 border-cyan-500/30" },
  low:      { ring: "border-white/10",     dot: "bg-white/20",   badge: "bg-white/10 text-white/50 border-white/10" },
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
    <div className="p-4 bg-white/[0.02] rounded-2xl border border-white/[0.06] overflow-x-auto">
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

          let dotColor = "bg-white/10";
          if (isInWindow && d < today) dotColor = "bg-white/20";
          else if (isInWindow && d === today) dotColor = "bg-red-500";
          else if (isInWindow) dotColor = "bg-amber-400";

          return (
            <div key={d} className="relative flex flex-col items-center gap-1 flex-1 group/day" title={hasExpense ? expsHere.map(e => e.name).join(", ") : undefined}>
              {/* Bar */}
              <div className={`w-full rounded-sm transition-all ${
                hasExpense ? (d < today ? "h-5 opacity-40" : "h-5") : "h-1"
              } ${dotColor}`} />
              {/* Day number */}
              {(d === 1 || d === 5 || d === 10 || d === 15 || d === 20 || d === 25 || d === daysInMonth || isToday) && (
                <span className={`text-[8px] font-bold ${isToday ? "text-white" : "text-white/20"}`}>{d}</span>
              )}
              {/* Today marker */}
              {isToday && (
                <div className="absolute -top-1 left-1/2 -translate-x-1/2 w-1.5 h-1.5 bg-white rounded-full shadow-[0_0_6px_white]" />
              )}
              {/* Tooltip on hover */}
              {hasExpense && (
                <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 hidden group-hover/day:block z-10 pointer-events-none bg-black/90 border border-white/10 rounded-xl p-2 whitespace-nowrap text-[10px] text-white/80 shadow-xl">
                  {expsHere.map((e) => <div key={e.id}>{e.name} — ${Number(e.amount || 0).toFixed(2)}</div>)}
                </div>
              )}
            </div>
          );
        })}
      </div>
      <div className="flex items-center gap-3 mt-3">
        <div className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-sm bg-amber-400" /><span className="text-[9px] text-white/30 font-bold uppercase tracking-widest">Ventana próxima</span></div>
        <div className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-sm bg-red-500" /><span className="text-[9px] text-white/30 font-bold uppercase tracking-widest">Hoy / urgente</span></div>
        <div className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-sm bg-white/10" /><span className="text-[9px] text-white/30 font-bold uppercase tracking-widest">Sin pago</span></div>
      </div>
    </div>
  );
}

// ── Empty state ───────────────────────────────────────────────────────────────

function EmptyState({ onAdd }) {
  return (
    <div className="py-20 text-center bg-white/[0.02] border border-dashed border-white/10 rounded-[28px]">
      <div className="w-16 h-16 mx-auto mb-4 rounded-3xl bg-white/5 flex items-center justify-center">
        <Target className="w-8 h-8 text-white/20" />
      </div>
      <p className="text-xl font-black text-white/30 tracking-tight">Sin Gastos Operacionales</p>
      <p className="text-sm text-white/20 mt-1 mb-8">Define tus gastos recurrentes para que el sistema calcule cuánto apartar diariamente.</p>
      <Button onClick={onAdd} className="rounded-2xl bg-gradient-to-r from-cyan-600 to-blue-600 text-white px-8 h-12 font-bold">
        <Plus className="w-4 h-4 mr-2" />
        Agregar Primer Gasto
      </Button>
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
      <DialogContent className="bg-[#111114] border border-white/10 text-white rounded-[28px] max-w-sm">
        <DialogHeader>
          <DialogTitle className="text-lg font-black tracking-tight flex items-center gap-3">
            <div className="w-9 h-9 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center">
              <Layers className="w-4 h-4 text-cyan-400" />
            </div>
            Gestionar Categorías
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 pt-1">
          {/* Existing custom categories */}
          {cats.length === 0 ? (
            <p className="text-xs text-white/30 text-center py-4">No hay categorías personalizadas aún.</p>
          ) : (
            <div className="space-y-2 max-h-52 overflow-y-auto pr-1">
              {cats.map((c) => {
                const dot = COLOR_DOT_MAP[c.colorId] || "bg-white/30";
                return editingId === c.id ? (
                  <div key={c.id} className="flex items-center gap-2 bg-white/5 rounded-2xl p-2.5">
                    <Input
                      value={editLabel}
                      onChange={(e) => setEditLabel(e.target.value)}
                      className="flex-1 bg-white/5 border-white/10 text-white h-8 text-sm rounded-xl"
                      onKeyDown={(e) => e.key === "Enter" && confirmEdit(c.id)}
                      autoFocus
                    />
                    <div className="flex gap-1">
                      {COLOR_OPTIONS.map((opt) => (
                        <button
                          key={opt.id}
                          onClick={() => setEditColor(opt.id)}
                          className={`w-5 h-5 rounded-full ${COLOR_DOT_MAP[opt.id]} transition-all ${editColor === opt.id ? "ring-2 ring-white ring-offset-1 ring-offset-black scale-110" : "opacity-60 hover:opacity-100"}`}
                        />
                      ))}
                    </div>
                    <button onClick={() => confirmEdit(c.id)} className="w-7 h-7 rounded-xl bg-cyan-500/20 text-cyan-400 hover:bg-cyan-500/40 flex items-center justify-center">
                      <Check className="w-3.5 h-3.5" />
                    </button>
                    <button onClick={cancelEdit} className="w-7 h-7 rounded-xl bg-white/5 text-white/40 hover:bg-white/10 flex items-center justify-center">
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ) : (
                  <div key={c.id} className="flex items-center gap-3 bg-white/[0.03] border border-white/[0.06] rounded-2xl px-3 py-2.5 group">
                    <div className={`w-3 h-3 rounded-full flex-shrink-0 ${dot}`} />
                    <span className="flex-1 text-sm font-semibold text-white/80 truncate">{c.label}</span>
                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button onClick={() => startEdit(c)} className="w-7 h-7 rounded-xl bg-white/5 hover:bg-white/15 text-white/40 hover:text-white flex items-center justify-center">
                        <Edit2 className="w-3 h-3" />
                      </button>
                      <button onClick={() => handleDelete(c.id)} className="w-7 h-7 rounded-xl bg-white/5 hover:bg-red-500/20 text-white/40 hover:text-red-400 flex items-center justify-center">
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Divider */}
          <div className="border-t border-white/[0.06]" />

          {/* Add new */}
          <div className="space-y-3">
            <p className="text-[9px] font-black uppercase tracking-widest text-white/30">Nueva Categoría</p>
            <Input
              value={newLabel}
              onChange={(e) => setNewLabel(e.target.value)}
              placeholder="Ej: Transporte, Limpieza..."
              className="bg-white/5 border-white/10 text-white placeholder:text-white/20 rounded-xl h-10 text-sm"
              onKeyDown={(e) => e.key === "Enter" && handleAdd()}
            />
            {/* Color picker */}
            <div className="flex items-center gap-2">
              <span className="text-[9px] font-black uppercase tracking-widest text-white/30 mr-1">Color:</span>
              {COLOR_OPTIONS.map((opt) => (
                <button
                  key={opt.id}
                  onClick={() => setNewColor(opt.id)}
                  className={`w-6 h-6 rounded-full ${COLOR_DOT_MAP[opt.id]} transition-all ${newColor === opt.id ? "ring-2 ring-white ring-offset-1 ring-offset-black scale-110" : "opacity-50 hover:opacity-100"}`}
                />
              ))}
            </div>
            <Button
              onClick={handleAdd}
              disabled={!newLabel.trim()}
              className="w-full rounded-xl bg-gradient-to-r from-cyan-600 to-blue-600 text-white font-bold h-10 disabled:opacity-40"
            >
              <Plus className="w-4 h-4 mr-2" />
              Agregar Categoría
            </Button>
          </div>

          <Button onClick={onClose} variant="ghost" className="w-full rounded-xl bg-white/5 text-white/50 hover:text-white h-10 mt-1">
            Cerrar
          </Button>
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
        <DialogContent className="bg-[#111114] border border-white/10 text-white rounded-[28px] max-w-md">
          <DialogHeader>
            <DialogTitle className="text-xl font-black tracking-tight flex items-center gap-3">
              <div className={`w-10 h-10 rounded-2xl bg-gradient-to-br ${meta.color} border ${meta.border} flex items-center justify-center`}>
                <IconComp className={`w-5 h-5 ${meta.accent}`} />
              </div>
              {initial ? "Editar Gasto" : "Nuevo Gasto Operacional"}
            </DialogTitle>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-4 pt-2">
            {/* Name */}
            <div className="space-y-1.5">
              <Label className="text-xs font-black uppercase tracking-widest text-white/40">Nombre *</Label>
              <Input
                value={form.name}
                onChange={(e) => set("name", e.target.value)}
                placeholder="Ej: Renta local, Internet, Luz..."
                className="bg-white/5 border-white/10 text-white placeholder:text-white/20 rounded-xl h-11"
              />
            </div>

            {/* Category + manage button */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-black uppercase tracking-widest text-white/40">Categoría</Label>
                <button
                  type="button"
                  onClick={() => setShowManageCats(true)}
                  className="flex items-center gap-1 text-[9px] font-black uppercase tracking-widest text-cyan-400/70 hover:text-cyan-300 transition-colors"
                >
                  <Settings2 className="w-3 h-3" />
                  Gestionar
                </button>
              </div>
              <Select value={form.category} onValueChange={(v) => set("category", v)}>
                <SelectTrigger className="bg-white/5 border-white/10 text-white rounded-xl h-11">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-[#18181b] border-white/10 text-white rounded-2xl">
                  {Object.entries(allCategoryMeta || CATEGORY_META).map(([key, m]) => {
                    const Icon = m.icon;
                    return (
                      <SelectItem key={key} value={key} className="rounded-xl">
                        <div className="flex items-center gap-2">
                          <Icon className={`w-4 h-4 ${m.accent}`} />
                          <span>{m.label}</span>
                          {m.isCustom && <span className="text-[9px] text-white/30 ml-1">·personalizada</span>}
                        </div>
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            </div>

            {/* Amount */}
            <div className="space-y-1.5">
              <Label className="text-xs font-black uppercase tracking-widest text-white/40">Monto mensual *</Label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-white/40 font-bold text-sm">$</span>
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.amount}
                  onChange={(e) => set("amount", e.target.value)}
                  placeholder="0.00"
                  className="bg-white/5 border-white/10 text-white placeholder:text-white/20 rounded-xl h-11 pl-7"
                />
              </div>
            </div>

            {/* Due day range */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-black uppercase tracking-widest text-white/40">Día de inicio *</Label>
                <Input
                  type="number"
                  min="1"
                  max="31"
                  value={form.due_day}
                  onChange={(e) => set("due_day", e.target.value)}
                  placeholder="Ej: 1"
                  className="bg-white/5 border-white/10 text-white placeholder:text-white/20 rounded-xl h-11"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-black uppercase tracking-widest text-white/40">Día de fin</Label>
                <Input
                  type="number"
                  min="1"
                  max="31"
                  value={form.due_day_end}
                  onChange={(e) => set("due_day_end", e.target.value)}
                  placeholder={form.due_day || "Ej: 5"}
                  className="bg-white/5 border-white/10 text-white placeholder:text-white/20 rounded-xl h-11"
                />
              </div>
            </div>
            <p className="text-[10px] text-white/25 -mt-2">
              Rango en que se puede pagar, ej: renta del día 1 al 5, teléfono del 25 al 30.
            </p>

            {/* Working days */}
            <div className="space-y-1.5">
              <Label className="text-xs font-black uppercase tracking-widest text-white/40">Días laborables / mes</Label>
              <Input
                type="number"
                min="1"
                max="31"
                value={form.working_days_per_month}
                onChange={(e) => set("working_days_per_month", e.target.value)}
                className="bg-white/5 border-white/10 text-white placeholder:text-white/20 rounded-xl h-11"
              />
              <p className="text-[10px] text-white/25">Usado para calcular la meta diaria mínima.</p>
            </div>

            {/* Notes */}
            <div className="space-y-1.5">
              <Label className="text-xs font-black uppercase tracking-widest text-white/40">Notas</Label>
              <Input
                value={form.notes}
                onChange={(e) => set("notes", e.target.value)}
                placeholder="Notas opcionales..."
                className="bg-white/5 border-white/10 text-white placeholder:text-white/20 rounded-xl h-11"
              />
            </div>

            {/* Actions */}
            <div className="flex gap-3 pt-2">
              <Button type="button" onClick={onClose} variant="ghost" className="flex-1 rounded-xl bg-white/5 text-white/60 hover:text-white h-11">
                Cancelar
              </Button>
              <Button type="submit" disabled={saving} className="flex-1 rounded-xl bg-gradient-to-r from-cyan-600 to-blue-600 text-white font-bold h-11">
                {saving ? <RefreshCw className="w-4 h-4 animate-spin" /> : "Guardar"}
              </Button>
            </div>
          </form>
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
    <div className="bg-white/[0.03] border border-white/[0.08] rounded-2xl p-4 space-y-3">
      {/* ── Header ───────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Target className="w-3.5 h-3.5 text-cyan-400" />
          <p className="text-[10px] font-black text-white/40 uppercase tracking-widest">Gastos Operacionales</p>
        </div>
        <button
          onClick={openAdd}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 text-[11px] font-black hover:bg-cyan-500/20 transition-colors active:scale-95"
        >
          <Plus className="w-3 h-3" /> Agregar
        </button>
      </div>

      {/* ── Summary strip ────────────────────────────────────────────────── */}
      {expenses.length > 0 && (
        <div className="grid grid-cols-3 gap-1.5">
          <div className="p-2.5 bg-white/[0.03] rounded-xl border border-white/[0.06]">
            <p className="text-[9px] font-black uppercase tracking-widest text-white/30 mb-0.5">Mensual</p>
            <p className="text-sm font-black text-white">${totalMonthly.toFixed(2)}</p>
          </div>
          <div className="p-2.5 bg-cyan-500/10 rounded-xl border border-cyan-500/20">
            <p className="text-[9px] font-black uppercase tracking-widest text-cyan-400/60 mb-0.5">Meta/día</p>
            <p className="text-sm font-black text-cyan-400">${dailyGoal.toFixed(2)}</p>
          </div>
          <div className="p-2.5 bg-white/[0.03] rounded-xl border border-white/[0.06]">
            <p className="text-[9px] font-black uppercase tracking-widest text-white/30 mb-0.5">Días lab.</p>
            <p className="text-sm font-black text-white/60">{workingDays}d</p>
          </div>
        </div>
      )}

      {/* ── Month Timeline ────────────────────────────────────────────────── */}
      {expenses.length > 0 && <MonthTimeline expenses={expenses} />}

      {/* ── Content ──────────────────────────────────────────────────────── */}
      {loading ? (
        <div className="flex items-center justify-center py-6 gap-2">
          <RefreshCw className="w-3.5 h-3.5 animate-spin text-cyan-400/50" />
          <p className="text-xs text-white/25 font-bold">Cargando…</p>
        </div>
      ) : expenses.length === 0 ? (
        <div className="py-8 text-center border border-white/[0.06] border-dashed rounded-xl">
          <p className="text-sm font-black text-white/25">Sin gastos operacionales</p>
          <button onClick={openAdd} className="mt-2 text-[11px] font-black text-cyan-400/60 hover:text-cyan-400 transition-colors">+ Agregar primero</button>
        </div>
      ) : (
        <div className="space-y-1.5">
          {sortedExpenses.map((exp) => {
            const meta = getCategoryMeta(exp.category, allCategoryMeta);
            const IconComp = meta.icon;
            const urg = URGENCY_STYLES[exp.urgency] || URGENCY_STYLES.low;

            return (
              <div key={exp.id} className={`group flex items-center gap-3 p-3 rounded-xl bg-white/[0.02] hover:bg-white/[0.05] border ${urg.ring} transition-all`}>
                <div className={`w-7 h-7 rounded-lg bg-black/30 border ${meta.border} flex items-center justify-center shrink-0`}>
                  <IconComp className={`w-3.5 h-3.5 ${meta.accent}`} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-black text-white truncate">{exp.name}</p>
                    <span className={`text-xs font-black shrink-0 ml-2 ${meta.accent}`}>${Number(exp.amount || 0).toFixed(2)}</span>
                  </div>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className={`text-[9px] font-black uppercase tracking-widest ${urg.badge.split(' ').find(c => c.startsWith('text-'))}`}>{exp.label}</span>
                    <span className="text-[10px] text-white/25">·</span>
                    <span className="text-[10px] text-white/25">Día {exp.due_day}{exp.due_day_end && exp.due_day_end !== exp.due_day ? `–${exp.due_day_end}` : ""}</span>
                    <span className="text-[10px] text-white/25">·</span>
                    <span className="text-[10px] text-white/40">${exp.dailySavings.toFixed(2)}/día</span>
                    {exp.status === "in_window" && <span className="text-[9px] font-black text-red-400 uppercase tracking-widest">⚡ Ventana</span>}
                  </div>
                </div>
                <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                  <button onClick={() => openEdit(exp)} className="w-7 h-7 rounded-lg bg-white/5 hover:bg-cyan-500/20 text-white/30 hover:text-cyan-400 flex items-center justify-center transition-colors">
                    <Edit2 className="w-3 h-3" />
                  </button>
                  <button onClick={() => handleDelete(exp.id)} className="w-7 h-7 rounded-lg bg-white/5 hover:bg-red-500/20 text-white/30 hover:text-red-400 flex items-center justify-center transition-colors">
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
