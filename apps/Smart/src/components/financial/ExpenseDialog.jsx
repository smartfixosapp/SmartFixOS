import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { dataClient } from "@/components/api/dataClient";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { TrendingDown } from "lucide-react";
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
