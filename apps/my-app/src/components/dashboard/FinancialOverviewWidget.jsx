import React, { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DollarSign } from "lucide-react";
import { subscribeToCashRegister } from "../cash/CashRegisterService";
import { base44 } from "@/api/base44Client";

export default function FinancialOverviewWidget() {
  const [stats, setStats] = useState({ byMethod: {}, totalRevenue: 0, salesCount: 0 });
  const [isOpen, setIsOpen] = useState(false);
  const [drawer, setDrawer] = useState(null);

  useEffect(() => {
    const unsubscribe = subscribeToCashRegister(({ isOpen, drawer }) => {
      setIsOpen(isOpen);
      setDrawer(drawer);
      
      if (isOpen && drawer) {
        loadSales(drawer);
      } else {
        setStats({ byMethod: {}, totalRevenue: 0, salesCount: 0 });
      }
    });

    return unsubscribe;
  }, []);

  const loadSales = async (drawer) => {
    try {
      const drawerOpenDate = new Date(drawer.created_date);
      const sales = await base44.entities.Sale.list("-created_date", 500);
      
      const validSales = sales.filter(s => {
        if (s.voided) return false;
        try {
          return new Date(s.created_date) >= drawerOpenDate;
        } catch {
          return false;
        }
      });

      const byMethod = { cash: 0, card: 0, ath_movil: 0 };
      validSales.forEach(s => {
        const method = s.payment_method || "other";
        byMethod[method] = (byMethod[method] || 0) + (s.total || 0);
      });

      setStats({
        byMethod,
        totalRevenue: Object.values(byMethod).reduce((sum, v) => sum + v, 0),
        salesCount: validSales.length
      });
    } catch (error) {
      console.error("Error loading sales:", error);
    }
  };

  const methodLabels = {
    cash: '💵 Efectivo',
    card: '💳 Tarjeta',
    ath_movil: '📱 ATH Móvil'
  };

  const methodColors = {
    cash: 'from-emerald-500 to-emerald-700',
    card: 'from-blue-500 to-blue-700',
    ath_movil: 'from-orange-500 to-orange-700'
  };

  return (
    <Card className="bg-gradient-to-br from-[#2B2B2B] to-black border-emerald-900/30 shadow-xl">
      <CardHeader className="pb-3 border-b border-white/10">
        <div className="flex items-center justify-between">
          <CardTitle className="text-white text-lg flex items-center gap-2">
            <DollarSign className="w-5 h-5 text-emerald-500" />
            Ingresos del Turno
          </CardTitle>
          <div className={`px-3 py-1 ${isOpen ? 'bg-emerald-600/20 border-emerald-500/40' : 'bg-red-600/20 border-red-500/40'} border rounded-lg`}>
            <span className={`text-xs font-semibold ${isOpen ? 'text-emerald-400' : 'text-red-400'}`}>
              {isOpen ? '🟢 Abierta' : '🔴 Cerrada'}
            </span>
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-6">
        {!isOpen ? (
          <div className="h-32 flex flex-col items-center justify-center text-gray-500">
            <DollarSign className="w-12 h-12 mb-2 opacity-30" />
            <p className="text-sm font-semibold">Caja Cerrada</p>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-2">
              {Object.entries(stats.byMethod).filter(([, v]) => v > 0).map(([method, amount]) => (
                <div key={method} className={`bg-gradient-to-br ${methodColors[method]} rounded-lg p-3 border border-white/20`}>
                  <p className="text-white/90 text-xs font-semibold">{methodLabels[method]}</p>
                  <p className="text-white text-xl font-bold">${amount.toFixed(2)}</p>
                </div>
              ))}
            </div>
            <div className="p-4 bg-gradient-to-br from-emerald-600/20 to-green-600/20 border-2 border-emerald-500/40 rounded-xl">
              <div className="flex items-center justify-between">
                <span className="text-sm text-emerald-300 font-semibold">TOTAL</span>
                <div className="text-right">
                  <p className="text-3xl font-black text-emerald-400">${stats.totalRevenue.toFixed(2)}</p>
                  <p className="text-xs text-emerald-300">{stats.salesCount} ventas</p>
                </div>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
