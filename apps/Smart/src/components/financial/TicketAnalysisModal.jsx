import React, { useMemo } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { TrendingUp, DollarSign } from "lucide-react";

export default function TicketAnalysisModal({ open, onClose, sales = [] }) {
  const analysis = useMemo(() => {
    const avgTicket = sales.length > 0 ? sales.reduce((sum, s) => sum + (s.total || 0), 0) / sales.length : 0;
    
    // Agrupar por rangos de ticket
    const ranges = {
      "0-25": { count: 0, total: 0, sales: [] },
      "25-50": { count: 0, total: 0, sales: [] },
      "50-100": { count: 0, total: 0, sales: [] },
      "100-200": { count: 0, total: 0, sales: [] },
      "200+": { count: 0, total: 0, sales: [] }
    };
    
    sales.forEach(sale => {
      const total = sale.total || 0;
      if (total < 25) {
        ranges["0-25"].count++;
        ranges["0-25"].total += total;
        ranges["0-25"].sales.push(sale);
      } else if (total < 50) {
        ranges["25-50"].count++;
        ranges["25-50"].total += total;
        ranges["25-50"].sales.push(sale);
      } else if (total < 100) {
        ranges["50-100"].count++;
        ranges["50-100"].total += total;
        ranges["50-100"].sales.push(sale);
      } else if (total < 200) {
        ranges["100-200"].count++;
        ranges["100-200"].total += total;
        ranges["100-200"].sales.push(sale);
      } else {
        ranges["200+"].count++;
        ranges["200+"].total += total;
        ranges["200+"].sales.push(sale);
      }
    });
    
    const sortedSales = [...sales].sort((a, b) => (b.total || 0) - (a.total || 0));
    const topSales = sortedSales.slice(0, 10);
    
    return { avgTicket, ranges, topSales };
  }, [sales]);

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="bg-gradient-to-br from-[#020617] to-black border-cyan-500/30 max-w-4xl max-h-[90vh] text-white theme-light:bg-white theme-light:border-gray-200 theme-light:text-gray-900">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-cyan-600 to-blue-600 flex items-center justify-center">
              <TrendingUp className="w-6 h-6 text-white" />
            </div>
            Análisis de Ticket Promedio
          </DialogTitle>
        </DialogHeader>

        {/* Ticket Promedio */}
        <div className="bg-gradient-to-br from-cyan-600/20 to-blue-800/20 border border-cyan-500/30 rounded-xl p-6 mb-6 theme-light:bg-cyan-50 theme-light:border-cyan-300">
          <p className="text-sm text-cyan-300 mb-2 theme-light:text-cyan-700">TICKET PROMEDIO</p>
          <p className="text-5xl font-bold text-cyan-400 theme-light:text-cyan-600">
            ${analysis.avgTicket.toFixed(2)}
          </p>
          <p className="text-xs text-cyan-300/70 mt-2 theme-light:text-cyan-600">
            Basado en {sales.length} transacciones
          </p>
        </div>

        {/* Distribución por Rangos */}
        <div className="mb-6">
          <h3 className="text-lg font-bold text-white mb-4 theme-light:text-gray-900">
            Distribución por Rango de Precio
          </h3>
          <div className="space-y-3">
            {Object.entries(analysis.ranges).map(([range, data]) => {
              const percentage = sales.length > 0 ? (data.count / sales.length * 100) : 0;
              return (
                <div key={range} className="bg-black/40 border border-cyan-500/10 rounded-xl p-4 theme-light:bg-gray-50 theme-light:border-gray-200">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-3">
                      <DollarSign className="w-5 h-5 text-cyan-400 theme-light:text-cyan-600" />
                      <span className="text-white font-semibold theme-light:text-gray-900">${range}</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <Badge className="bg-cyan-600/20 text-cyan-300 border-cyan-500/30 theme-light:bg-cyan-100 theme-light:text-cyan-700">
                        {data.count} ventas ({percentage.toFixed(1)}%)
                      </Badge>
                      <span className="text-emerald-400 font-bold theme-light:text-emerald-600">
                        ${data.total.toFixed(2)}
                      </span>
                    </div>
                  </div>
                  {/* Barra de progreso */}
                  <div className="w-full bg-black/40 rounded-full h-2 theme-light:bg-gray-200">
                    <div 
                      className="bg-gradient-to-r from-cyan-600 to-blue-600 h-2 rounded-full transition-all"
                      style={{ width: `${percentage}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Top 10 Ventas Más Altas */}
        <div>
          <h3 className="text-lg font-bold text-white mb-4 theme-light:text-gray-900">
            Top 10 Ventas Más Altas
          </h3>
          <div className="space-y-2 max-h-[300px] overflow-y-auto">
            {analysis.topSales.map((sale, index) => (
              <div key={sale.id} className="bg-black/40 border border-cyan-500/10 rounded-xl p-4 flex items-center justify-between theme-light:bg-gray-50 theme-light:border-gray-200">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-cyan-600/20 border border-cyan-500/30 flex items-center justify-center theme-light:bg-cyan-100">
                    <span className="text-white font-bold text-sm theme-light:text-cyan-700">#{index + 1}</span>
                  </div>
                  <div>
                    <p className="text-white font-medium theme-light:text-gray-900">{sale.customer_name || 'Cliente'}</p>
                    <p className="text-xs text-gray-400 theme-light:text-gray-600">
                      {sale.sale_number} • {sale.items?.length || 0} items
                    </p>
                  </div>
                </div>
                <p className="text-2xl font-bold text-emerald-400 theme-light:text-emerald-600">
                  ${(sale.total || 0).toFixed(2)}
                </p>
              </div>
            ))}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
