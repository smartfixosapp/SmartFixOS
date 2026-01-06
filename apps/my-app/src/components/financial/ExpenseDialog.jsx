import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { TrendingDown } from "lucide-react";
import AIExpenseCategorizor from "./AIExpenseCategorizor";

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

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    const amount = parseFloat(formData.amount);
    if (!amount || amount <= 0) {
      alert("Ingresa un monto válido");
      return;
    }

    if (!formData.description.trim()) {
      alert("Ingresa una descripción");
      return;
    }

    setLoading(true);
    try {
      let me = null;
      try { me = await base44.auth.me(); } catch {}

      // Crear transacción de gasto
      await base44.entities.Transaction.create({
        type: "expense",
        amount: amount,
        description: formData.description,
        category: formData.category,
        payment_method: "cash",
        recorded_by: me?.full_name || me?.email || "Sistema"
      });

      // Si hay caja abierta, registrar movimiento
      if (drawer?.id) {
        await base44.entities.CashDrawerMovement.create({
          drawer_id: drawer.id,
          type: "expense",
          amount: amount,
          description: formData.description,
          reference: formData.reference || "Gasto general",
          employee: me?.full_name || me?.email || "Sistema"
        });
      }

      // Crear log de auditoría
      await base44.entities.AuditLog.create({
        action: "expense_registered",
        entity_type: "transaction",
        user_id: me?.id || null,
        user_name: me?.full_name || me?.email || "Sistema",
        user_role: me?.role || "system",
        changes: {
          amount: amount,
          category: formData.category,
          description: formData.description
        }
      });

      if (onSuccess) onSuccess();
      
    } catch (error) {
      console.error("Error registrando gasto:", error);
      alert("Error al registrar gasto: " + (error.message || "Error desconocido"));
    }
    setLoading(false);
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md bg-gradient-to-br from-[#2B2B2B] to-black border-red-900/30">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold text-white flex items-center gap-2">
            <TrendingDown className="w-6 h-6 text-orange-500" />
            Registrar Gasto
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label className="text-gray-300">Monto *</Label>
            <Input
              type="number"
              step="0.01"
              min="0"
              value={formData.amount}
              onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
              className="bg-black border-gray-700 text-white text-lg"
              placeholder="0.00"
              required
            />
          </div>

          <div>
            <Label className="text-gray-300">Descripción *</Label>
            <Textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              className="bg-black border-gray-700 text-white"
              placeholder="Ej: Pago de electricidad del mes de diciembre"
              rows={3}
              required
            />
          </div>

          {/* ✨ CATEGORIZACIÓN CON IA */}
          <AIExpenseCategorizor
            description={formData.description}
            amount={formData.amount}
            onCategorySuggestion={handleCategorySuggestion}
          />

          <div>
            <Label className="text-gray-300">Categoría *</Label>
            <Select 
              value={formData.category} 
              onValueChange={(value) => setFormData({ ...formData, category: value })}
            >
              <SelectTrigger className="bg-black border-gray-700 text-white">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-[#2B2B2B] border-gray-700">
                {categories.map(cat => (
                  <SelectItem key={cat.value} value={cat.value} className="text-white">
                    {cat.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label className="text-gray-300">Referencia (opcional)</Label>
            <Input
              value={formData.reference}
              onChange={(e) => setFormData({ ...formData, reference: e.target.value })}
              className="bg-black border-gray-700 text-white"
              placeholder="Ej: Factura #12345"
            />
          </div>

          <DialogFooter className="gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={loading}
              className="border-gray-700"
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={loading}
              className="bg-gradient-to-r from-orange-600 to-red-800"
            >
              {loading ? "Guardando..." : "Registrar Gasto"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
