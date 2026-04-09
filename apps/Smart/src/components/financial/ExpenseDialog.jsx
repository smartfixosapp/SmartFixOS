import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { dataClient } from "@/components/api/dataClient";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { TrendingDown, DollarSign, Calendar } from "lucide-react";
import AIExpenseCategorizor from "./AIExpenseCategorizor";
import { toast } from "sonner";
import {
  PAYMENT_METHOD_LABELS,
  PAYMENT_METHOD_ICONS,
  isDeferredMethod,
  defaultSettlementDate,
  buildSettlementFields,
} from "@/components/utils/deferredPayments";

export default function ExpenseDialog({ open, onClose, onSuccess, drawer, defaultCategory }) {
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    amount: "",
    description: "",
    category: defaultCategory || "other_expense",
    reference: "",
    payment_method: "cash",
    settles_on: "",
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
    const validCategories = new Set([
      "other_expense", "parts", "payroll", "repair_payment", "supplies", "refund",
      "rent", "utilities", "maintenance", "insurance", "taxes"
    ]);
    return validCategories.has(category) ? category : "other_expense";
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

      // Determinar si el pago es diferido (sale del banco después)
      const settlementFields = buildSettlementFields({
        method: formData.payment_method,
        settlesOn: formData.settles_on,
      });

      // Crear transacción de gasto en el mismo cliente que usa Finanzas
      const createdTransaction = await dataClient.entities.Transaction.create({
        type: "expense",
        amount: amount,
        description: formData.description,
        category: normalizeCategory(formData.category),
        payment_method: formData.payment_method,
        recorded_by: me?.full_name || me?.email || "Sistema",
        ...settlementFields,
      });
      const createdExpensePayload = createdTransaction || {
        id: `local-expense-${Date.now()}`,
        type: "expense",
        amount,
        description: formData.description,
        category: normalizeCategory(formData.category),
        payment_method: formData.payment_method,
        recorded_by: me?.full_name || me?.email || "Sistema",
        created_date: new Date().toISOString(),
        ...settlementFields,
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
        reference: "",
        payment_method: "cash",
        settles_on: "",
      });
      
    } catch (error) {
      console.error("Error registrando gasto:", error);
      toast.error("Error al registrar gasto: " + (error.message || "Error desconocido"));
    }
    setLoading(false);
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md bg-[#0A0A0A] border border-white/10 rounded-2xl p-0 overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-0.5 bg-gradient-to-r from-orange-600 to-red-800" />

        <div className="p-5">
          <DialogHeader className="mb-4">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-xl bg-orange-500/10 flex items-center justify-center border border-orange-500/20">
                <TrendingDown className="w-4 h-4 text-orange-400" />
              </div>
              <DialogTitle className="text-xl font-black text-white tracking-tight text-left">
                {defaultCategory === "payroll" ? "Pagar Nómina" : "Registrar Gasto"}
              </DialogTitle>
            </div>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <label className="text-[10px] font-black text-white/40 uppercase tracking-widest ml-1">Monto ($)</label>
              <div className="relative">
                <DollarSign className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-orange-500/50" />
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  value={formData.amount}
                  onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                  className="bg-white/5 border-white/10 text-white text-2xl h-12 rounded-2xl pl-10 pr-5 focus:border-orange-500/50 font-black tracking-tighter"
                  placeholder="0.00"
                  required
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-black text-white/40 uppercase tracking-widest ml-1">Descripción</label>
              <Textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                className="bg-white/5 border-white/10 text-white min-h-[80px] rounded-2xl p-4 focus:border-orange-500/50 font-medium resize-none"
                placeholder="Ej: Pago de electricidad, repuestos de emergencia..."
                required
              />
            </div>

            <AIExpenseCategorizor
              description={formData.description}
              amount={formData.amount}
              onCategorySuggestion={handleCategorySuggestion}
            />

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <label className="text-[10px] font-black text-white/40 uppercase tracking-widest ml-1">Categoría</label>
                <Select
                  value={formData.category}
                  onValueChange={(value) => setFormData({ ...formData, category: value })}
                  disabled={!!defaultCategory}
                >
                  <SelectTrigger className="bg-white/5 border-white/10 text-white h-11 rounded-2xl px-4 focus:border-orange-500/50 font-bold disabled:opacity-50">
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
                  className="bg-white/5 border-white/10 text-white h-11 rounded-2xl px-4 focus:border-orange-500/50 font-bold"
                  placeholder="#Factura, ID..."
                />
              </div>
            </div>

            {/* Método de pago + detección de pago diferido */}
            <div className="space-y-2">
              <label className="text-[10px] font-black text-white/40 uppercase tracking-widest ml-1">
                Método de pago
              </label>
              <Select
                value={formData.payment_method}
                onValueChange={(value) =>
                  setFormData((prev) => ({
                    ...prev,
                    payment_method: value,
                    settles_on: isDeferredMethod(value)
                      ? (prev.settles_on || defaultSettlementDate(value))
                      : "",
                  }))
                }
              >
                <SelectTrigger className="bg-white/5 border-white/10 text-white h-11 rounded-2xl px-4 focus:border-orange-500/50 font-bold">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-[#111] border-white/10 text-white rounded-2xl">
                  <SelectItem value="cash" className="focus:bg-orange-500/20 rounded-xl mx-1 my-0.5">
                    {PAYMENT_METHOD_ICONS.cash} {PAYMENT_METHOD_LABELS.cash}
                  </SelectItem>
                  <SelectItem value="card" className="focus:bg-orange-500/20 rounded-xl mx-1 my-0.5">
                    {PAYMENT_METHOD_ICONS.card} {PAYMENT_METHOD_LABELS.card}
                  </SelectItem>
                  <SelectItem value="transfer" className="focus:bg-orange-500/20 rounded-xl mx-1 my-0.5">
                    {PAYMENT_METHOD_ICONS.transfer} {PAYMENT_METHOD_LABELS.transfer}
                  </SelectItem>
                  <SelectItem value="ath_movil" className="focus:bg-orange-500/20 rounded-xl mx-1 my-0.5">
                    {PAYMENT_METHOD_ICONS.ath_movil} {PAYMENT_METHOD_LABELS.ath_movil}
                  </SelectItem>
                  <div className="my-1 border-t border-white/10" />
                  <div className="px-3 py-1 text-[9px] uppercase tracking-widest text-amber-400/60 font-black">
                    ⏳ Sale del banco después
                  </div>
                  <SelectItem value="credit_card" className="focus:bg-amber-500/20 rounded-xl mx-1 my-0.5">
                    {PAYMENT_METHOD_ICONS.credit_card} {PAYMENT_METHOD_LABELS.credit_card}
                  </SelectItem>
                  <SelectItem value="klarna" className="focus:bg-amber-500/20 rounded-xl mx-1 my-0.5">
                    {PAYMENT_METHOD_ICONS.klarna} {PAYMENT_METHOD_LABELS.klarna}
                  </SelectItem>
                  <SelectItem value="check" className="focus:bg-amber-500/20 rounded-xl mx-1 my-0.5">
                    {PAYMENT_METHOD_ICONS.check} {PAYMENT_METHOD_LABELS.check}
                  </SelectItem>
                  <SelectItem value="paypal_credit" className="focus:bg-amber-500/20 rounded-xl mx-1 my-0.5">
                    {PAYMENT_METHOD_ICONS.paypal_credit} {PAYMENT_METHOD_LABELS.paypal_credit}
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            {isDeferredMethod(formData.payment_method) && (
              <div className="space-y-2 rounded-2xl bg-amber-500/[0.05] border border-amber-500/20 p-4">
                <label className="text-[10px] font-black text-amber-300 uppercase tracking-widest flex items-center gap-2">
                  <Calendar className="w-3 h-3" />
                  ¿Cuándo saldrá del banco?
                </label>
                <Input
                  type="date"
                  value={formData.settles_on}
                  onChange={(e) => setFormData({ ...formData, settles_on: e.target.value })}
                  className="bg-white/5 border-amber-500/20 text-white h-11 rounded-xl px-4 focus:border-amber-500/50 font-bold"
                />
                <p className="text-[10px] text-amber-300/60 leading-relaxed">
                  Este gasto NO se descontará del efectivo/banco hoy. Aparecerá en
                  "Pagos diferidos" hasta la fecha seleccionada, donde podrás
                  marcarlo como pagado cuando veas el cargo en tu estado de cuenta.
                </p>
              </div>
            )}

            <div className="flex gap-3 pt-2">
              <Button
                type="button"
                variant="ghost"
                onClick={onClose}
                disabled={loading}
                className="flex-1 bg-white/5 text-white/40 hover:text-white hover:bg-white/10 h-12 rounded-2xl font-black uppercase tracking-widest transition-all"
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                disabled={loading}
                className="flex-1 bg-gradient-to-r from-orange-600 to-red-800 hover:from-orange-500 hover:to-red-700 text-white h-12 rounded-2xl font-black uppercase tracking-widest active:scale-95 transition-all"
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
