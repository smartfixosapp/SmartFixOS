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
  CheckCircle2, TrendingUp, Package
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
        await dataClient.entities.OneTimeExpense.update(editingExpense.id, expenseData);
        toast.success("Meta actualizada");
      } else {
        const user = await dataClient.auth.me();
        await dataClient.entities.OneTimeExpense.create({
          ...expenseData,
          created_by_name: user?.full_name || user?.email
        });
        toast.success("Meta creada");
      }

      resetForm();
      loadExpenses();
    } catch (error) {
      console.error("Error saving expense:", error);
      toast.error("Error al guardar");
    }
  };

  const handleDelete = async (id) => {
    if (!confirm("¿Eliminar esta meta?")) return;
    try {
      await dataClient.entities.OneTimeExpense.delete(id);
      toast.success("Meta eliminada");
      loadExpenses();
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
      toast.success("Meta completada");
      loadExpenses();
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
      <div className="bg-gradient-to-br from-amber-600/20 to-orange-600/20 border-2 border-amber-500/40 rounded-2xl p-4 theme-light:bg-gradient-to-br theme-light:from-amber-50 theme-light:to-orange-50 theme-light:border-amber-300">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center shadow-lg">
              <Target className="w-7 h-7 text-white" />
            </div>
            <div>
              <h3 className="text-white font-bold text-lg theme-light:text-gray-900">🎯 Metas y Compras</h3>
              <p className="text-amber-300 text-xs theme-light:text-amber-700">Gastos únicos o inversiones</p>
            </div>
          </div>
          <Button
            size="sm"
            onClick={() => { resetForm(); setShowDialog(true); }}
            className="bg-gradient-to-r from-amber-600 to-orange-600 h-9"
          >
            <Plus className="w-4 h-4 mr-1" />
            Nueva
          </Button>
        </div>

        <div className="space-y-3 max-h-[400px] overflow-y-auto">
          {loading ? (
            <p className="text-gray-400 text-center py-4">Cargando...</p>
          ) : expenses.length === 0 ? (
            <div className="text-center py-8">
              <Target className="w-12 h-12 text-gray-600 mx-auto mb-2 opacity-30" />
              <p className="text-gray-500 text-sm">No hay metas creadas</p>
            </div>
          ) : (
            expenses.map((expense) => {
              const progress = (expense.saved_amount / expense.target_amount) * 100;
              const remaining = expense.target_amount - expense.saved_amount;

              return (
                <div
                  key={expense.id}
                  className="bg-black/30 border border-amber-500/20 rounded-xl p-4 theme-light:bg-white theme-light:border-gray-200"
                >
                  <div className="flex items-start justify-between gap-2 mb-3">
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                      <span className="text-2xl">{getCategoryIcon(expense.category)}</span>
                      <div className="min-w-0">
                        <p className="text-white font-bold truncate theme-light:text-gray-900">{expense.name}</p>
                        <p className="text-xs text-gray-400 theme-light:text-gray-600">{expense.vendor || "Sin proveedor"}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => handleEdit(expense)}
                        className="h-7 w-7 text-cyan-400 hover:bg-cyan-600/20"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => handleMarkPurchased(expense.id)}
                        className="h-7 w-7 text-emerald-400 hover:bg-emerald-600/20"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => handleDelete(expense.id)}
                        className="h-7 w-7 text-red-400 hover:bg-red-600/20"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-400 theme-light:text-gray-600">Meta</span>
                      <span className="text-white font-bold theme-light:text-gray-900">${expense.target_amount.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-emerald-400 theme-light:text-emerald-700">Ahorrado</span>
                      <span className="text-emerald-400 font-bold theme-light:text-emerald-700">${expense.saved_amount.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-amber-400 theme-light:text-amber-700">Falta</span>
                      <span className="text-amber-400 font-bold theme-light:text-amber-700">${remaining.toFixed(2)}</span>
                    </div>

                    <Progress value={progress} className="h-2 bg-black/40 theme-light:bg-gray-200" />
                    <p className="text-xs text-center text-gray-500 theme-light:text-gray-600">{Math.round(progress)}% completado</p>

                    {expense.target_date && (
                      <Badge className="bg-cyan-600/20 text-cyan-300 border-cyan-600/30 text-xs">
                        <Calendar className="w-3 h-3 mr-1" />
                        {format(new Date(expense.target_date), "dd MMM yyyy", { locale: es })}
                      </Badge>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      <Dialog open={showDialog} onOpenChange={resetForm}>
        <DialogContent className="bg-gradient-to-br from-[#2B2B2B] to-black border-amber-500/30 max-w-2xl max-h-[90vh] overflow-y-auto theme-light:bg-white">
          <DialogHeader>
            <DialogTitle className="text-white flex items-center gap-2 theme-light:text-gray-900">
              <Target className="w-6 h-6 text-amber-400" />
              {editingExpense ? "Editar Meta" : "Nueva Meta"}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <Label className="text-gray-300 theme-light:text-gray-700">Nombre *</Label>
              <Input
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="Ej: Soldador nuevo, Computadora, Vitrina..."
                className="bg-black/40 border-amber-500/20 text-white theme-light:bg-white theme-light:text-gray-900"
              />
            </div>

            <div>
              <Label className="text-gray-300 theme-light:text-gray-700">Descripción</Label>
              <Textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Detalles de la meta..."
                className="bg-black/40 border-amber-500/20 text-white theme-light:bg-white theme-light:text-gray-900"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-gray-300 theme-light:text-gray-700">Categoría</Label>
                <select
                  value={formData.category}
                  onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                  className="w-full h-10 bg-black/40 border border-amber-500/20 rounded-md px-3 text-white theme-light:bg-white theme-light:text-gray-900"
                >
                  <option value="tool">Herramienta</option>
                  <option value="equipment">Equipo</option>
                  <option value="renovation">Renovación</option>
                  <option value="emergency">Emergencia</option>
                  <option value="investment">Inversión</option>
                  <option value="other">Otro</option>
                </select>
              </div>

              <div>
                <Label className="text-gray-300 theme-light:text-gray-700">Prioridad</Label>
                <select
                  value={formData.priority}
                  onChange={(e) => setFormData({ ...formData, priority: e.target.value })}
                  className="w-full h-10 bg-black/40 border border-amber-500/20 rounded-md px-3 text-white theme-light:bg-white theme-light:text-gray-900"
                >
                  <option value="low">Baja</option>
                  <option value="medium">Media</option>
                  <option value="high">Alta</option>
                  <option value="urgent">Urgente</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-gray-300 theme-light:text-gray-700">Costo Total *</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={formData.target_amount}
                  onChange={(e) => setFormData({ ...formData, target_amount: e.target.value })}
                  placeholder="0.00"
                  className="bg-black/40 border-amber-500/20 text-white theme-light:bg-white theme-light:text-gray-900"
                />
              </div>

              <div>
                <Label className="text-gray-300 theme-light:text-gray-700">Ahorrado</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={formData.saved_amount}
                  onChange={(e) => setFormData({ ...formData, saved_amount: e.target.value })}
                  placeholder="0.00"
                  className="bg-black/40 border-amber-500/20 text-white theme-light:bg-white theme-light:text-gray-900"
                />
              </div>
            </div>

            <div>
              <Label className="text-gray-300 theme-light:text-gray-700">Fecha objetivo (opcional)</Label>
              <Input
                type="date"
                value={formData.target_date}
                onChange={(e) => setFormData({ ...formData, target_date: e.target.value })}
                className="bg-black/40 border-amber-500/20 text-white theme-light:bg-white theme-light:text-gray-900"
              />
            </div>

            <div>
              <Label className="text-gray-300 theme-light:text-gray-700">Proveedor (opcional)</Label>
              <Input
                value={formData.vendor}
                onChange={(e) => setFormData({ ...formData, vendor: e.target.value })}
                placeholder="Ej: Amazon, Home Depot, Grainger..."
                className="bg-black/40 border-amber-500/20 text-white theme-light:bg-white theme-light:text-gray-900"
              />
            </div>

            <div>
              <Label className="text-gray-300 theme-light:text-gray-700">Notas</Label>
              <Textarea
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                placeholder="Notas adicionales..."
                className="bg-black/40 border-amber-500/20 text-white theme-light:bg-white theme-light:text-gray-900"
              />
            </div>

            <div className="flex gap-2 pt-4">
              <Button
                variant="outline"
                onClick={resetForm}
                className="flex-1 border-white/15"
              >
                Cancelar
              </Button>
              <Button
                onClick={handleSave}
                className="flex-1 bg-gradient-to-r from-amber-600 to-orange-600"
              >
                {editingExpense ? "Actualizar" : "Guardar"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
