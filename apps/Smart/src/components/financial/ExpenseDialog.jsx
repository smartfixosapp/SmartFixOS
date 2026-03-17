import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { dataClient } from "@/components/api/dataClient";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { TrendingDown, DollarSign } from "lucide-react";
import AIExpenseCategorizor from "./AIExpenseCategorizor";
import { toast } from "sonner";

export default function ExpenseDialog({ open, onClose, onSuccess, drawer }) {
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    amount: "",
    description: "",
    category: "other_expense",
    reference: ""
  });

  const categories = [
    { value: "rent", label: "Renta" },
    { value: "utilities", label: "Utilidades (Luz, Agua, Internet)" },
    { value: "supplies", label: "Suministros" },
    { value: "payroll", label: "Nómina" },
    { value: "parts", label: "Piezas/Inventario" },
    { value: "maintenance", label: "Mantenimiento" },
    { value: "insurance", label: "Seguros" },
    { value: "taxes", label: "Impuestos" },
    { value: "other_expense", label: "Otros Gastos" }
  ];

  const handleCategorySuggestion = (suggestedCategory) => {
    setFormData(prev => ({ ...prev, category: suggestedCategory }));
  };

  const normalizeCategory = (category) => {
    const validCategories = new Set(["other_expense", "parts", "payroll", "repair_payment", "supplies", "refund"]);
    if (validCategories.has(category)) return category;

    const mapToValid = {
      rent: "other_expense",
      utilities: "other_expense",
      maintenance: "supplies",
      insurance: "other_expense",
      taxes: "other_expense"
    };

    return mapToValid[category] || "other_expense";
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    const amount = parseFloat(formData.amount);
    if (!amount || amount <= 0) {
      toast.error("Ingresa un monto válido");
      return;
    }

    if (!formData.description.trim()) {
      toast.error("Ingresa una descripción");
      return;
    }

    setLoading(true);
    try {
      let me = null;
      try { me = await base44.auth.me(); } catch {}

      // Crear transacción de gasto en el mismo cliente que usa Finanzas
      const createdTransaction = await dataClient.entities.Transaction.create({
        type: "expense",
        amount: amount,
        description: formData.description,
        category: normalizeCategory(formData.category),
        payment_method: "cash",
        recorded_by: me?.full_name || me?.email || "Sistema"
      });
      const createdExpensePayload = createdTransaction || {
        id: `local-expense-${Date.now()}`,
        type: "expense",
        amount,
        description: formData.description,
        category: normalizeCategory(formData.category),
        payment_method: "cash",
        recorded_by: me?.full_name || me?.email || "Sistema",
        created_date: new Date().toISOString(),
        _source: "transaction"
      };

      // Si hay caja abierta, registrar movimiento
      if (drawer?.id) {
        try {
          await dataClient.entities.CashDrawerMovement.create({
            drawer_id: drawer.id,
            type: "expense",
            amount: amount,
            description: formData.description,
            reference: formData.reference || "Gasto general",
            employee: me?.full_name || me?.email || "Sistema"
          });
        } catch (movementError) {
          console.error("Error registrando movimiento de caja:", movementError);
          toast.warning("Gasto creado, pero no se pudo registrar el movimiento de caja");
        }
      }

      // Crear log de auditoría sin bloquear el flujo principal
      try {
        await dataClient.entities.AuditLog.create({
          action: "expense_registered",
          entity_type: "transaction",
          user_id: me?.id || null,
          user_name: me?.full_name || me?.email || "Sistema",
          user_role: me?.role || "system",
          changes: {
            amount: amount,
            category: normalizeCategory(formData.category),
            description: formData.description
          }
        });
      } catch (auditError) {
        console.error("Error creando audit log:", auditError);
      }

      if (onSuccess) onSuccess(createdExpensePayload);
      if (typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent("expense-created", { detail: createdExpensePayload }));
      }
      toast.success("Gasto registrado");
      setFormData({
        amount: "",
        description: "",
        category: "other_expense",
        reference: ""
      });
      
    } catch (error) {
      console.error("Error registrando gasto:", error);
      toast.error("Error al registrar gasto: " + (error.message || "Error desconocido"));
    }
    setLoading(false);
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md bg-[#0A0A0A]/95 backdrop-blur-3xl border border-white/10 rounded-[32px] shadow-2xl p-0 overflow-hidden">
        {/* Top Accent line */}
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-orange-600 to-red-800" />
        
        <div className="p-8">
          <DialogHeader className="mb-8">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-2xl bg-orange-500/10 flex items-center justify-center border border-orange-500/20">
                <TrendingDown className="w-6 h-6 text-orange-400" />
              </div>
              <DialogTitle className="text-2xl font-black text-white tracking-tight text-left">
                Registrar Gasto
              </DialogTitle>
            </div>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2">
              <label className="text-[10px] font-black text-white/40 uppercase tracking-widest ml-1">Monto del Gasto ($)</label>
              <div className="relative">
                <DollarSign className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-orange-500/50" />
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  value={formData.amount}
                  onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                  className="bg-white/5 border-white/10 text-white text-3xl h-16 rounded-2xl pl-12 pr-5 focus:border-orange-500/50 font-black tracking-tighter"
                  placeholder="0.00"
                  required
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-black text-white/40 uppercase tracking-widest ml-1">Descripción / Justificación</label>
              <Textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                className="bg-white/5 border-white/10 text-white min-h-[100px] rounded-2xl p-5 focus:border-orange-500/50 font-medium resize-none"
                placeholder="Ej: Pago de electricidad, repuestos de emergencia..."
                required
              />
            </div>

            {/* ✨ CATEGORIZACIÓN CON IA */}
            <div className="px-1">
              <AIExpenseCategorizor
                description={formData.description}
                amount={formData.amount}
                onCategorySuggestion={handleCategorySuggestion}
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <label className="text-[10px] font-black text-white/40 uppercase tracking-widest ml-1">Categoría</label>
                <Select 
                  value={formData.category} 
                  onValueChange={(value) => setFormData({ ...formData, category: value })}
                >
                  <SelectTrigger className="bg-white/5 border-white/10 text-white h-12 rounded-2xl px-5 focus:border-orange-500/50 font-bold">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-[#111] border-white/10 text-white rounded-2xl">
                    {categories.map(cat => (
                      <SelectItem key={cat.value} value={cat.value} className="focus:bg-orange-500/20 focus:text-white rounded-xl mx-1 my-0.5">
                        {cat.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black text-white/40 uppercase tracking-widest ml-1">Referencia</label>
                <Input
                  value={formData.reference}
                  onChange={(e) => setFormData({ ...formData, reference: e.target.value })}
                  className="bg-white/5 border-white/10 text-white h-12 rounded-2xl px-5 focus:border-orange-500/50 font-bold"
                  placeholder="#Factura, ID..."
                />
              </div>
            </div>

            <div className="flex gap-4 pt-6">
              <Button
                type="button"
                variant="ghost"
                onClick={onClose}
                disabled={loading}
                className="flex-1 bg-white/5 text-white/40 hover:text-white hover:bg-white/10 h-14 rounded-2xl font-black uppercase tracking-widest transition-all"
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                disabled={loading}
                className="flex-1 bg-gradient-to-r from-orange-600 to-red-800 hover:from-orange-500 hover:to-red-700 text-white h-14 rounded-2xl font-black uppercase tracking-widest shadow-xl shadow-orange-900/20 active:scale-95 transition-all"
              >
                {loading ? "Registrando..." : "Confirmar Gasto"}
              </Button>
            </div>
          </form>
        </div>
      </DialogContent>
    </Dialog>

  );
}
