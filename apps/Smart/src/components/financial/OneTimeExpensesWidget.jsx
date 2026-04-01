import React, { useState, useEffect } from "react";
import { dataClient } from "@/components/api/dataClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import {
  Target, Plus, DollarSign, Calendar, Edit2, Trash2,
  CheckCircle2, TrendingUp, Package, RefreshCw
} from "lucide-react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { toast } from "sonner";

export default function OneTimeExpensesWidget() {
  const [expenses, setExpenses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showDialog, setShowDialog] = useState(false);
  const [editingExpense, setEditingExpense] = useState(null);

  const [formData, setFormData] = useState({
    name: "",
    description: "",
    category: "tool",
    target_amount: "",
    saved_amount: 0,
    status: "planning",
    priority: "medium",
    target_date: "",
    vendor: "",
    notes: ""
  });

  useEffect(() => {
    loadExpenses();
  }, []);

  const loadExpenses = async () => {
    setLoading(true);
    try {
      const data = await dataClient.entities.OneTimeExpense.filter({
        status: ["planning", "saving", "ready"]
      }, "-priority");
      setExpenses(data || []);
    } catch (error) {
      console.error("Error loading expenses:", error);
      toast.error("Error cargando metas");
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!formData.name.trim() || !formData.target_amount) {
      toast.error("Nombre y monto son obligatorios");
      return;
    }

    try {
      const expenseData = {
        ...formData,
        target_amount: parseFloat(formData.target_amount),
        saved_amount: parseFloat(formData.saved_amount || 0)
      };

      if (editingExpense) {
        const updated = await dataClient.entities.OneTimeExpense.update(editingExpense.id, expenseData);
        const updatedLocal = updated || {
          ...editingExpense,
          ...expenseData,
          id: editingExpense.id
        };
        setExpenses((prev) => (prev || []).map((item) => item.id === editingExpense.id ? updatedLocal : item));
        toast.success("Meta actualizada");
      } else {
        let user = null;
        try {
          user = await dataClient.auth.me();
        } catch {
          user = null;
        }
        const created = await dataClient.entities.OneTimeExpense.create({
          ...expenseData,
          created_by_name: user?.full_name || user?.email
        });
        const createdLocal = created || {
          id: `local-goal-${Date.now()}`,
          ...expenseData,
          created_by_name: user?.full_name || user?.email || "Sistema",
          created_date: new Date().toISOString()
        };
        setExpenses((prev) => [createdLocal, ...(prev || [])]);
        toast.success("Meta creada");
      }

      resetForm();
      // No recargar inmediatamente para no pisar el estado optimista
      setTimeout(() => loadExpenses(), 1500);
    } catch (error) {
      console.error("Error saving expense:", error);
      toast.error("Error al guardar");
    }
  };

  const handleDelete = async (id) => {
    if (!confirm("¿Eliminar esta meta?")) return;
    try {
      await dataClient.entities.OneTimeExpense.delete(id);
      setExpenses((prev) => (prev || []).filter((item) => item.id !== id));
      toast.success("Meta eliminada");
      setTimeout(() => loadExpenses(), 1500);
    } catch (error) {
      console.error("Error deleting:", error);
      toast.error("Error al eliminar");
    }
  };

  const handleEdit = (expense) => {
    setEditingExpense(expense);
    setFormData({
      name: expense.name || "",
      description: expense.description || "",
      category: expense.category || "tool",
      target_amount: expense.target_amount || "",
      saved_amount: expense.saved_amount || 0,
      status: expense.status || "planning",
      priority: expense.priority || "medium",
      target_date: expense.target_date || "",
      vendor: expense.vendor || "",
      notes: expense.notes || ""
    });
    setShowDialog(true);
  };

  const handleMarkPurchased = async (id) => {
    if (!confirm("¿Marcar como comprado?")) return;
    try {
      await dataClient.entities.OneTimeExpense.update(id, {
        status: "purchased",
        purchased_date: new Date().toISOString().split('T')[0]
      });
      setExpenses((prev) => (prev || []).filter((item) => item.id !== id));
      toast.success("Meta completada");
      setTimeout(() => loadExpenses(), 1500);
    } catch (error) {
      console.error("Error:", error);
      toast.error("Error al actualizar");
    }
  };

  const resetForm = () => {
    setFormData({
      name: "",
      description: "",
      category: "tool",
      target_amount: "",
      saved_amount: 0,
      status: "planning",
      priority: "medium",
      target_date: "",
      vendor: "",
      notes: ""
    });
    setEditingExpense(null);
    setShowDialog(false);
  };

  const getCategoryIcon = (category) => {
    const icons = {
      tool: "🔧",
      equipment: "⚙️",
      renovation: "🏗️",
      emergency: "🚨",
      investment: "💼",
      other: "📦"
    };
    return icons[category] || "💰";
  };

  return (
    <>
      <div className="bg-white/[0.03] border border-white/[0.08] rounded-2xl p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Target className="w-3.5 h-3.5 text-amber-400" />
            <p className="text-[10px] font-black text-white/40 uppercase tracking-widest">Metas & Inversiones</p>
          </div>
          <button
            onClick={() => { resetForm(); setShowDialog(true); }}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400 text-[11px] font-black hover:bg-amber-500/20 transition-colors active:scale-95"
          >
            <Plus className="w-3 h-3" /> Nueva meta
          </button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-8 gap-2">
            <RefreshCw className="w-3.5 h-3.5 animate-spin text-amber-400/50" />
            <p className="text-xs text-white/25 font-bold">Cargando…</p>
          </div>
        ) : expenses.length === 0 ? (
          <div className="py-8 text-center border border-white/[0.06] border-dashed rounded-xl">
            <p className="text-sm font-black text-white/25">Sin metas activas</p>
          </div>
        ) : (
          <div className="space-y-2">
            {expenses.map((expense) => {
              const progress = (expense.saved_amount / expense.target_amount) * 100;
              const remaining = expense.target_amount - expense.saved_amount;
              return (
                <div key={expense.id} className="group flex items-center gap-3 p-3 rounded-xl bg-white/[0.02] hover:bg-white/[0.05] border border-white/[0.04] transition-all">
                  <span className="text-lg w-7 text-center shrink-0">{getCategoryIcon(expense.category)}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-1">
                      <p className="text-sm font-black text-white truncate">{expense.name}</p>
                      <span className="text-xs font-black text-amber-400 shrink-0 ml-2">${expense.target_amount.toFixed(2)}</span>
                    </div>
                    <div className="w-full bg-white/5 rounded-full h-1.5 mb-1">
                      <div className="h-full rounded-full bg-gradient-to-r from-amber-500/70 to-emerald-500/70 transition-all"
                        style={{ width: `${Math.min(100, progress)}%` }} />
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] text-white/25">{Math.round(progress)}% · Faltan ${remaining.toFixed(2)}</span>
                      {expense.target_date && (
                        <span className="text-[10px] text-white/25">{format(new Date(expense.target_date), "dd MMM", { locale: es })}</span>
                      )}
                    </div>
                  </div>
                  <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                    <button onClick={() => handleEdit(expense)} className="w-7 h-7 rounded-lg bg-white/5 hover:bg-cyan-500/20 text-white/30 hover:text-cyan-400 flex items-center justify-center transition-colors">
                      <Edit2 className="w-3 h-3" />
                    </button>
                    <button onClick={() => handleMarkPurchased(expense.id)} className="w-7 h-7 rounded-lg bg-white/5 hover:bg-emerald-500/20 text-white/30 hover:text-emerald-400 flex items-center justify-center transition-colors">
                      <CheckCircle2 className="w-3 h-3" />
                    </button>
                    <button onClick={() => handleDelete(expense.id)} className="w-7 h-7 rounded-lg bg-white/5 hover:bg-red-500/20 text-white/30 hover:text-red-400 flex items-center justify-center transition-colors">
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <Dialog open={showDialog} onOpenChange={resetForm}>
        <DialogContent className="max-w-[95vw] sm:max-w-lg bg-[#0A0A0A] border border-white/10 rounded-2xl overflow-hidden p-0">
          <div className="absolute top-0 left-0 w-full h-0.5 bg-gradient-to-r from-amber-500 to-orange-500" />
          <div className="p-5">
            <DialogHeader className="mb-4">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-xl bg-amber-500/10 flex items-center justify-center border border-amber-500/20">
                  <Target className="w-4 h-4 text-amber-400" />
                </div>
                <DialogTitle className="text-2xl font-black text-white tracking-tight text-left">
                  {editingExpense ? "Actualizar Meta" : "Forjar Nueva Meta"}
                </DialogTitle>
              </div>
            </DialogHeader>

            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-white/40 uppercase tracking-widest ml-1">Proyecto / Logro</label>
                  <Input 
                    value={formData.name} 
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })} 
                    placeholder="Ej. Nueva Estación de Soldado" 
                    className="bg-white/5 border-white/10 text-white h-12 rounded-2xl px-5 focus:border-amber-500/50 font-bold" 
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-white/40 uppercase tracking-widest ml-1">Proveedor / Link</label>
                  <Input 
                    value={formData.vendor} 
                    onChange={(e) => setFormData({ ...formData, vendor: e.target.value })} 
                    placeholder="Ej. Amazon, Home Depot..." 
                    className="bg-white/5 border-white/10 text-white h-12 rounded-2xl px-5 focus:border-amber-500/50 font-bold" 
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black text-white/40 uppercase tracking-widest ml-1">Misión y Propósito</label>
                <Textarea 
                  value={formData.description} 
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })} 
                  placeholder="Describe por qué esta meta es importante para el taller..." 
                  className="bg-white/5 border-white/10 text-white min-h-[100px] rounded-2xl p-5 focus:border-amber-500/50 font-medium resize-none" 
                />
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {Object.entries({
                  tool: "🔧 Herram.",
                  equipment: "⚙️ Equipo",
                  renovation: "🏗️ Local",
                  emergency: "🚨 Emer.",
                  investment: "💼 Inves.",
                  other: "📦 Otro"
                }).map(([val, label]) => (
                  <button 
                    key={val} 
                    onClick={() => setFormData({ ...formData, category: val })}
                    className={`py-3 rounded-2xl border transition-all text-[10px] font-black uppercase tracking-tight ${
                      formData.category === val 
                        ? "bg-amber-500/20 border-amber-500/40 text-amber-400" 
                        : "bg-white/5 border-white/5 text-white/40 hover:border-white/20"
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>

              <div className="grid grid-cols-2 md:grid-cols-3 gap-6">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-white/40 uppercase tracking-widest ml-1">Presupuesto ($)</label>
                  <Input 
                    type="number" 
                    value={formData.target_amount} 
                    onChange={(e) => setFormData({ ...formData, target_amount: e.target.value })} 
                    placeholder="0.00" 
                    className="bg-white/5 border-white/10 text-white h-12 rounded-2xl px-5 focus:border-amber-500/50 font-bold" 
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-white/40 uppercase tracking-widest ml-1">Capital Actual ($)</label>
                  <Input 
                    type="number" 
                    value={formData.saved_amount} 
                    onChange={(e) => setFormData({ ...formData, saved_amount: e.target.value })} 
                    placeholder="0.00" 
                    className="bg-white/5 border-white/10 text-white h-12 rounded-2xl px-5 focus:border-emerald-500/50 font-bold" 
                  />
                </div>
                <div className="space-y-2 md:col-span-1 col-span-2">
                  <label className="text-[10px] font-black text-white/40 uppercase tracking-widest ml-1">Fecha Límite</label>
                  <Input 
                    type="date" 
                    value={formData.target_date} 
                    onChange={(e) => setFormData({ ...formData, target_date: e.target.value })} 
                    className="bg-white/5 border-white/10 text-white h-12 rounded-2xl px-5 focus:border-cyan-500/50 font-bold" 
                  />
                </div>
              </div>
            </div>

            <div className="flex gap-4 pt-8">
              <Button 
                onClick={resetForm} 
                className="flex-1 bg-white/5 border border-white/10 hover:bg-white/10 text-white h-14 rounded-2xl font-black uppercase tracking-widest active:scale-95 transition-all"
              >
                Suspender
              </Button>
              <Button 
                onClick={handleSave} 
                className="flex-1 bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-500 hover:to-orange-500 text-white h-14 rounded-2xl font-black uppercase tracking-widest shadow-xl shadow-orange-900/20 active:scale-95 transition-all"
              >
                {editingExpense ? "Actualizar Plan" : "Iniciar Proyecto"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
