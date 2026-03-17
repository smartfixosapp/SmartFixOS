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
      <div className="relative overflow-hidden bg-white/5 backdrop-blur-2xl border border-white/10 rounded-[40px] p-8 shadow-2xl group">
        <div className="absolute -right-20 -top-20 w-80 h-80 bg-orange-600/10 rounded-full blur-[100px] group-hover:bg-orange-600/20 transition-all duration-700" />
        
        <div className="relative flex flex-col md:flex-row md:items-center justify-between gap-8 mb-8">
          <div className="flex items-center gap-6">
            <div className="w-16 h-16 rounded-3xl bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center shadow-2xl shadow-orange-500/20 transform -rotate-3 hover:rotate-0 transition-transform duration-500">
              <Target className="w-8 h-8 text-white" />
            </div>
            <div>
              <h3 className="text-2xl font-black text-white tracking-tighter mb-1">Metas & Inversiones</h3>
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
                <p className="text-xs text-white/40 font-bold uppercase tracking-[0.2em]">Adquisiciones Planeadas</p>
              </div>
            </div>
          </div>
          <Button
            size="lg"
            onClick={() => { resetForm(); setShowDialog(true); }}
            className="rounded-2xl bg-white/5 border border-white/10 hover:bg-white/10 text-white h-12 px-6 transition-all active:scale-95 font-bold"
          >
            <Plus className="w-5 h-5 mr-2 text-amber-500" />
            Nueva Meta
          </Button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-h-[600px] overflow-y-auto pr-2 custom-scrollbar">
          {loading ? (
            <div className="md:col-span-2 py-20 text-center">
              <RefreshCw className="w-12 h-12 animate-spin mx-auto mb-4 text-amber-500/50" />
              <p className="text-white/40 font-bold uppercase tracking-[0.2em] text-xs">Sincronizando Metas...</p>
            </div>
          ) : expenses.length === 0 ? (
            <div className="md:col-span-2 py-20 text-center bg-white/5 border border-white/10 border-dashed rounded-[32px]">
              <Target className="w-16 h-16 text-white/10 mx-auto mb-4" />
              <p className="text-xl font-black text-white/40 tracking-tight">Sin Metas Activas</p>
              <p className="text-sm text-white/20">Tu visionario está descansando. ¡Crea una nueva meta!</p>
            </div>
          ) : (
            expenses.map((expense) => {
              const progress = (expense.saved_amount / expense.target_amount) * 100;
              const remaining = expense.target_amount - expense.saved_amount;

              return (
                <div
                  key={expense.id}
                  className="group relative overflow-hidden bg-white/5 border border-white/10 rounded-[32px] p-6 hover:border-white/20 transition-all duration-300"
                >
                  <div className="flex items-start justify-between mb-6">
                    <div className="flex items-center gap-4">
                      <div className="w-14 h-14 rounded-2xl bg-black/40 border border-white/5 flex items-center justify-center text-3xl shadow-inner group-hover:scale-110 transition-transform duration-500">
                        {getCategoryIcon(expense.category)}
                      </div>
                      <div className="min-w-0">
                        <h4 className="text-white font-black tracking-tight text-lg">{expense.name}</h4>
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] font-black text-amber-400/70 border border-amber-400/20 px-2 py-0.5 rounded-lg uppercase tracking-widest">{expense.category}</span>
                          <span className="text-[10px] text-white/30 font-bold uppercase tracking-widest">{expense.vendor || "Directo"}</span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Button size="icon" onClick={() => handleEdit(expense)} className="w-9 h-9 rounded-xl bg-white/5 hover:bg-cyan-500/20 text-white/40 hover:text-cyan-400">
                        <Edit2 className="w-4 h-4" />
                      </Button>
                      <Button size="icon" onClick={() => handleMarkPurchased(expense.id)} className="w-9 h-9 rounded-xl bg-white/5 hover:bg-emerald-500/20 text-white/40 hover:text-emerald-400">
                        <CheckCircle2 className="w-4 h-4" />
                      </Button>
                      <Button size="icon" onClick={() => handleDelete(expense.id)} className="w-9 h-9 rounded-xl bg-white/5 hover:bg-red-500/20 text-white/40 hover:text-red-400">
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>

                  <div className="space-y-6">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="p-4 bg-white/[0.03] rounded-2xl border border-white/5">
                        <p className="text-[10px] font-black text-white/30 uppercase tracking-widest mb-1">Objetivo Fijo</p>
                        <p className="text-xl font-black text-white">${expense.target_amount.toFixed(2)}</p>
                      </div>
                      <div className="p-4 bg-emerald-500/5 rounded-2xl border border-emerald-500/10">
                        <p className="text-[10px] font-black text-emerald-400/50 uppercase tracking-widest mb-1">Recaudado</p>
                        <p className="text-xl font-black text-emerald-400">${expense.saved_amount.toFixed(2)}</p>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <div className="flex justify-between items-center px-1">
                        <span className="text-[10px] font-black text-white/40 uppercase tracking-widest">{Math.round(progress)}% Completado</span>
                        <span className="text-xs font-bold text-amber-400 tracking-tight">Faltan ${remaining.toFixed(2)}</span>
                      </div>
                      <div className="h-3 bg-black/40 rounded-full overflow-hidden border border-white/5 relative">
                        <div 
                          className="absolute top-0 left-0 h-full bg-gradient-to-r from-amber-600 to-emerald-500 transition-all duration-1000 shadow-[0_0_15px_rgba(16,185,129,0.4)]"
                          style={{ width: `${Math.min(100, progress)}%` }}
                        />
                      </div>
                    </div>

                    {expense.target_date && (
                      <div className="flex items-center gap-2 px-3 py-1.5 bg-white/5 border border-white/5 rounded-xl w-fit">
                        <Calendar className="w-3.5 h-3.5 text-white/40" />
                        <span className="text-[10px] font-black text-white/50 uppercase tracking-widest">
                          Meta: {format(new Date(expense.target_date), "dd MMMM", { locale: es })}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      <Dialog open={showDialog} onOpenChange={resetForm}>
        <DialogContent className="max-w-[95vw] sm:max-w-2xl bg-[#0A0A0A]/95 backdrop-blur-3xl border border-white/10 rounded-[32px] shadow-2xl p-0 overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-amber-600 to-orange-600" />
          
          <div className="p-8 sm:p-10">
            <DialogHeader className="mb-8">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-2xl bg-amber-500/10 flex items-center justify-center border border-amber-500/20">
                  <Target className="w-6 h-6 text-amber-400" />
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
