import React, { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Wallet, DollarSign, TrendingUp, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import { closeCashRegister } from "./CashRegisterService";
import { base44 } from "@/api/base44Client";

const DENOMINATIONS = [
  { key: 'bills_100', label: '$100', value: 100, color: 'from-purple-600 to-purple-800' },
  { key: 'bills_50', label: '$50', value: 50, color: 'from-blue-600 to-blue-800' },
  { key: 'bills_20', label: '$20', value: 20, color: 'from-green-600 to-green-800' },
  { key: 'bills_10', label: '$10', value: 10, color: 'from-yellow-600 to-yellow-800' },
  { key: 'bills_5', label: '$5', value: 5, color: 'from-orange-600 to-orange-800' },
  { key: 'bills_1', label: '$1', value: 1, color: 'from-gray-600 to-gray-800' },
  { key: 'coins_1', label: '$1', value: 1, color: 'from-gray-500 to-gray-700' },
  { key: 'coins_050', label: '$0.50', value: 0.50, color: 'from-gray-400 to-gray-600' },
  { key: 'coins_025', label: '$0.25', value: 0.25, color: 'from-gray-400 to-gray-600' }
];

export default function CloseDrawerDialog({ open, onClose, onSuccess, drawer }) {
  const [denominations, setDenominations] = useState(
    DENOMINATIONS.reduce((acc, d) => ({ ...acc, [d.key]: 0 }), {})
  );
  const [loading, setLoading] = useState(false);
  const [editing, setEditing] = useState(null);
  const [salesSummary, setSalesSummary] = useState(null);

  useEffect(() => {
    if (open && drawer) {
      loadSalesSummary();
    }
  }, [open, drawer]);

  const loadSalesSummary = async () => {
    try {
      const drawerOpenDate = new Date(drawer.created_date);
      const sales = await base44.entities.Sale.list("-created_date", 500);
      
      const salesInDrawer = sales.filter(s => {
        if (s.voided) return false;
        try {
          return new Date(s.created_date) >= drawerOpenDate;
        } catch {
          return false;
        }
      });

      const totalCash = salesInDrawer
        .filter(s => s.payment_method === "cash")
        .reduce((sum, s) => sum + (s.total || 0), 0);

      const totalCard = salesInDrawer
        .filter(s => s.payment_method === "card")
        .reduce((sum, s) => sum + (s.total || 0), 0);

      const totalATH = salesInDrawer
        .filter(s => s.payment_method === "ath_movil")
        .reduce((sum, s) => sum + (s.total || 0), 0);

      setSalesSummary({
        totalSales: salesInDrawer.length,
        totalRevenue: salesInDrawer.reduce((sum, s) => sum + (s.total || 0), 0),
        totalCash,
        totalCard,
        totalATH,
        expectedCash: drawer.opening_balance + totalCash
      });
    } catch (error) {
      console.error("Error loading sales summary:", error);
    }
  };

  const total = DENOMINATIONS.reduce((sum, d) => 
    sum + (denominations[d.key] || 0) * d.value, 0
  );

  const difference = salesSummary ? total - salesSummary.expectedCash : 0;

  const handleIncrement = (key) => {
    setDenominations(prev => ({ ...prev, [key]: (prev[key] || 0) + 1 }));
  };

  const handleEdit = (key, value) => {
    setDenominations(prev => ({ ...prev, [key]: Math.max(0, parseInt(value) || 0) }));
  };

  const handleClose = async () => {
    setLoading(true);
    try {
      const user = await base44.auth.me();
      await closeCashRegister(drawer, denominations, user);
      toast.success("✅ Caja cerrada exitosamente");
      
      // ✅ Disparar evento para resetear stats del Dashboard
      window.dispatchEvent(new Event('cash-register-closed'));
      
      if (onSuccess) onSuccess();
      onClose();
    } catch (error) {
      console.error("Error closing drawer:", error);
      toast.error(error.message || "Error al cerrar caja");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto bg-gradient-to-br from-black to-[#0D0D0D] border-cyan-500/30">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold text-white flex items-center gap-3">
            <Wallet className="w-7 h-7 text-red-500" />
            Cerrar Caja Registradora
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {salesSummary && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="bg-blue-600/20 border border-blue-500/30 rounded-xl p-4">
                <p className="text-blue-300 text-sm">Ventas Totales</p>
                <p className="text-white text-2xl font-bold">{salesSummary.totalSales}</p>
              </div>
              <div className="bg-emerald-600/20 border border-emerald-500/30 rounded-xl p-4">
                <p className="text-emerald-300 text-sm">Ingresos Totales</p>
                <p className="text-white text-2xl font-bold">${salesSummary.totalRevenue.toFixed(2)}</p>
              </div>
              <div className="bg-green-600/20 border border-green-500/30 rounded-xl p-4">
                <p className="text-green-300 text-sm">💵 Efectivo</p>
                <p className="text-white text-2xl font-bold">${salesSummary.totalCash.toFixed(2)}</p>
              </div>
              <div className="bg-yellow-600/20 border border-yellow-500/30 rounded-xl p-4">
                <p className="text-yellow-300 text-sm">Efectivo Esperado</p>
                <p className="text-white text-2xl font-bold">${salesSummary.expectedCash.toFixed(2)}</p>
              </div>
            </div>
          )}

          <div>
            <h3 className="text-white font-bold mb-3">Contar Efectivo en Caja</h3>
            <div className="grid grid-cols-3 gap-3">
              {DENOMINATIONS.map(denom => (
                <div key={denom.key}>
                  {editing === denom.key ? (
                    <Input
                      type="number"
                      value={denominations[denom.key]}
                      onChange={(e) => handleEdit(denom.key, e.target.value)}
                      onBlur={() => setEditing(null)}
                      autoFocus
                      className="bg-black/60 border-cyan-500/30 text-white text-center"
                    />
                  ) : (
                    <button
                      onClick={() => handleIncrement(denom.key)}
                      onContextMenu={(e) => {
                        e.preventDefault();
                        setEditing(denom.key);
                      }}
                      className={`w-full bg-gradient-to-br ${denom.color} p-4 rounded-xl border-2 border-white/20 hover:border-white/40 transition-all`}
                    >
                      <div className="text-white font-bold text-lg">{denom.label}</div>
                      <div className="text-white/80 text-2xl font-black mt-1">
                        {denominations[denom.key] || 0}
                      </div>
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>

          <div className="bg-gradient-to-br from-cyan-600/20 to-blue-600/20 border-2 border-cyan-500/40 rounded-xl p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <DollarSign className="w-8 h-8 text-cyan-400" />
                <span className="text-white font-bold text-lg">TOTAL CONTADO</span>
              </div>
              <span className="text-5xl font-black text-cyan-400">
                ${total.toFixed(2)}
              </span>
            </div>

            {salesSummary && (
              <div className={`p-4 rounded-lg ${Math.abs(difference) > 0.01 ? 'bg-red-600/20 border border-red-500/30' : 'bg-emerald-600/20 border border-emerald-500/30'}`}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {Math.abs(difference) > 0.01 ? (
                      <AlertCircle className="w-5 h-5 text-red-400" />
                    ) : (
                      <TrendingUp className="w-5 h-5 text-emerald-400" />
                    )}
                    <span className={`font-semibold ${Math.abs(difference) > 0.01 ? 'text-red-300' : 'text-emerald-300'}`}>
                      Diferencia
                    </span>
                  </div>
                  <span className={`text-2xl font-black ${difference > 0 ? 'text-emerald-400' : difference < 0 ? 'text-red-400' : 'text-gray-400'}`}>
                    {difference > 0 ? '+' : ''}${difference.toFixed(2)}
                  </span>
                </div>
              </div>
            )}
          </div>

          <div className="flex gap-3">
            <Button
              variant="outline"
              onClick={onClose}
              className="flex-1 border-gray-700 text-gray-300 hover:bg-gray-800"
            >
              Cancelar
            </Button>
            <Button
              onClick={handleClose}
              disabled={loading}
              className="flex-1 bg-gradient-to-r from-red-600 to-red-800 hover:from-red-700 hover:to-red-900"
            >
              {loading ? "Cerrando..." : "Cerrar Caja"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
