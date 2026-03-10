import React, { useMemo } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { FileText, TrendingUp, Calendar } from "lucide-react";
import { format } from "date-fns";
import { es } from "date-fns/locale";

export default function TaxBreakdownModal({ open, onClose, sales = [] }) {
  const analysis = useMemo(() => {
    const totalTax = sales.reduce((sum, s) => sum + (s.tax_amount || 0), 0);
    const totalRevenue = sales.reduce((sum, s) => sum + (s.total || 0), 0);
    const totalSubtotal = sales.reduce((sum, s) => sum + (s.subtotal || 0), 0);
    
    // Desglose por día
    const byDay = {};
    sales.forEach(sale => {
      const day = format(new Date(sale.created_date), 'yyyy-MM-dd');
      if (!byDay[day]) {
        byDay[day] = { tax: 0, revenue: 0, count: 0 };
      }
      byDay[day].tax += (sale.tax_amount || 0);
      byDay[day].revenue += (sale.total || 0);
      byDay[day].count++;
    });
    
    // Ordenar por fecha descendente
    const sortedDays = Object.entries(byDay)
      .sort(([a], [b]) => new Date(b) - new Date(a));
    
    return { totalTax, totalRevenue, totalSubtotal, byDay: sortedDays };
  }, [sales]);

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="bg-gradient-to-br from-[#020617] to-black border-purple-500/30 max-w-4xl max-h-[90vh] text-white theme-light:bg-white theme-light:border-gray-200 theme-light:text-gray-900">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-purple-600 to-pink-600 flex items-center justify-center">
              <FileText className="w-6 h-6 text-white" />
            </div>
            Desglose de IVU (11.5%)
          </DialogTitle>
        </DialogHeader>

        {/* Resumen General */}
        <div className="grid grid-cols-3 gap-4 mb-6">
          <div className="bg-gradient-to-br from-purple-600/20 to-purple-800/20 border border-purple-500/30 rounded-xl p-4 theme-light:bg-purple-50 theme-light:border-purple-300">
            <p className="text-xs text-purple-300 mb-2 theme-light:text-purple-700">SUBTOTAL SIN IVU</p>
            <p className="text-2xl font-bold text-purple-400 theme-light:text-purple-600">
              ${analysis.totalSubtotal.toFixed(2)}
            </p>
          </div>
          
          <div className="bg-gradient-to-br from-pink-600/20 to-pink-800/20 border border-pink-500/30 rounded-xl p-4 theme-light:bg-pink-50 theme-light:border-pink-300">
            <p className="text-xs text-pink-300 mb-2 theme-light:text-pink-700">IVU RECAUDADO</p>
            <p className="text-2xl font-bold text-pink-400 theme-light:text-pink-600">
              ${analysis.totalTax.toFixed(2)}
            </p>
          </div>
          
          <div className="bg-gradient-to-br from-emerald-600/20 to-emerald-800/20 border border-emerald-500/30 rounded-xl p-4 theme-light:bg-emerald-50 theme-light:border-emerald-300">
            <p className="text-xs text-emerald-300 mb-2 theme-light:text-emerald-700">TOTAL CON IVU</p>
            <p className="text-2xl font-bold text-emerald-400 theme-light:text-emerald-600">
              ${analysis.totalRevenue.toFixed(2)}
            </p>
          </div>
        </div>

        {/* Info Box */}
        <div className="bg-purple-600/10 border border-purple-500/20 rounded-xl p-4 mb-6 theme-light:bg-purple-50 theme-light:border-purple-300">
          <div className="flex items-start gap-3">
            <TrendingUp className="w-5 h-5 text-purple-400 mt-1 theme-light:text-purple-600" />
            <div>
              <p className="text-white font-semibold mb-1 theme-light:text-gray-900">
                Información Importante sobre el IVU
              </p>
              <p className="text-sm text-gray-400 theme-light:text-gray-700">
                El IVU (Impuesto sobre Ventas y Uso) en Puerto Rico es del 11.5% sobre el subtotal de cada venta.
                Este desglose muestra el IVU recaudado por día para facilitar tu declaración mensual.
              </p>
            </div>
          </div>
        </div>

        {/* Desglose por Día */}
        <div>
          <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2 theme-light:text-gray-900">
            <Calendar className="w-5 h-5 text-purple-400 theme-light:text-purple-600" />
            Desglose Diario
          </h3>
          <div className="space-y-2 max-h-[400px] overflow-y-auto">
            {analysis.byDay.map(([day, data]) => (
              <div key={day} className="bg-black/40 border border-purple-500/10 rounded-xl p-4 theme-light:bg-gray-50 theme-light:border-gray-200">
                <div className="flex items-center justify-between mb-2">
                  <div>
                    <p className="text-white font-semibold theme-light:text-gray-900">
                      {format(new Date(day), 'EEEE, d MMMM yyyy', { locale: es })}
                    </p>
                    <p className="text-xs text-gray-400 theme-light:text-gray-600">
                      {data.count} transacciones
                    </p>
                  </div>
                  <Badge className="bg-purple-600/20 text-purple-300 border-purple-500/30 theme-light:bg-purple-100 theme-light:text-purple-700">
                    IVU: ${data.tax.toFixed(2)}
                  </Badge>
                </div>
                <div className="grid grid-cols-2 gap-3 pt-3 border-t border-white/10 theme-light:border-gray-200">
                  <div>
                    <p className="text-[10px] text-gray-500 theme-light:text-gray-600">Ingresos del día</p>
                    <p className="text-sm text-emerald-400 font-semibold theme-light:text-emerald-600">
                      ${data.revenue.toFixed(2)}
                    </p>
                  </div>
                  <div>
                    <p className="text-[10px] text-gray-500 theme-light:text-gray-600">Subtotal sin IVU</p>
                    <p className="text-sm text-white font-semibold theme-light:text-gray-900">
                      ${(data.revenue - data.tax).toFixed(2)}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
