import React, { useMemo } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { ShoppingCart, Clock, User, Calendar } from "lucide-react";
import { format } from "date-fns";
import { es } from "date-fns/locale";

export default function TransactionCountModal({ open, onClose, sales = [] }) {
  const analysis = useMemo(() => {
    // Agrupar por día
    const byDay = {};
    sales.forEach(sale => {
      const day = format(new Date(sale.created_date), 'yyyy-MM-dd');
      if (!byDay[day]) {
        byDay[day] = [];
      }
      byDay[day].push(sale);
    });
    
    // Ordenar por fecha descendente
    const sortedDays = Object.entries(byDay)
      .sort(([a], [b]) => new Date(b) - new Date(a));
    
    // Agrupar por hora del día
    const byHour = {};
    sales.forEach(sale => {
      const hour = format(new Date(sale.created_date), 'HH:00');
      byHour[hour] = (byHour[hour] || 0) + 1;
    });
    
    // Encontrar hora pico
    const peakHour = Object.entries(byHour).sort(([,a], [,b]) => b - a)[0];
    
    // Empleado con más ventas
    const byEmployee = {};
    sales.forEach(sale => {
      const emp = sale.employee || 'Sin asignar';
      byEmployee[emp] = (byEmployee[emp] || 0) + 1;
    });
    
    const topEmployee = Object.entries(byEmployee).sort(([,a], [,b]) => b - a)[0];
    
    return { byDay: sortedDays, peakHour, topEmployee, byEmployee };
  }, [sales]);

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="bg-gradient-to-br from-[#020617] to-black border-amber-500/30 max-w-4xl max-h-[90vh] text-white theme-light:bg-white theme-light:border-gray-200 theme-light:text-gray-900">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-amber-600 to-orange-600 flex items-center justify-center">
              <ShoppingCart className="w-6 h-6 text-white" />
            </div>
            Análisis de Transacciones
          </DialogTitle>
        </DialogHeader>

        {/* Resumen */}
        <div className="grid grid-cols-3 gap-4 mb-6">
          <div className="bg-gradient-to-br from-amber-600/20 to-amber-800/20 border border-amber-500/30 rounded-xl p-4 theme-light:bg-amber-50 theme-light:border-amber-300">
            <p className="text-xs text-amber-300 mb-2 theme-light:text-amber-700">TOTAL TRANSACCIONES</p>
            <p className="text-4xl font-bold text-amber-400 theme-light:text-amber-600">{sales.length}</p>
          </div>
          
          {analysis.peakHour && (
            <div className="bg-gradient-to-br from-orange-600/20 to-orange-800/20 border border-orange-500/30 rounded-xl p-4 theme-light:bg-orange-50 theme-light:border-orange-300">
              <p className="text-xs text-orange-300 mb-2 theme-light:text-orange-700">HORA PICO</p>
              <div className="flex items-center gap-2">
                <Clock className="w-5 h-5 text-orange-400 theme-light:text-orange-600" />
                <p className="text-2xl font-bold text-orange-400 theme-light:text-orange-600">
                  {analysis.peakHour[0]}
                </p>
              </div>
              <p className="text-xs text-orange-300/70 mt-1 theme-light:text-orange-600">
                {analysis.peakHour[1]} ventas
              </p>
            </div>
          )}
          
          {analysis.topEmployee && (
            <div className="bg-gradient-to-br from-yellow-600/20 to-yellow-800/20 border border-yellow-500/30 rounded-xl p-4 theme-light:bg-yellow-50 theme-light:border-yellow-300">
              <p className="text-xs text-yellow-300 mb-2 theme-light:text-yellow-700">TOP VENDEDOR</p>
              <div className="flex items-center gap-2">
                <User className="w-5 h-5 text-yellow-400 theme-light:text-yellow-600" />
                <p className="text-sm font-bold text-yellow-400 truncate theme-light:text-yellow-600">
                  {analysis.topEmployee[0]}
                </p>
              </div>
              <p className="text-xs text-yellow-300/70 mt-1 theme-light:text-yellow-600">
                {analysis.topEmployee[1]} ventas
              </p>
            </div>
          )}
        </div>

        {/* Ventas por Empleado */}
        {Object.keys(analysis.byEmployee).length > 1 && (
          <div className="mb-6">
            <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2 theme-light:text-gray-900">
              <User className="w-5 h-5 text-amber-400 theme-light:text-amber-600" />
              Transacciones por Empleado
            </h3>
            <div className="grid grid-cols-2 gap-3">
              {Object.entries(analysis.byEmployee)
                .sort(([,a], [,b]) => b - a)
                .map(([employee, count]) => (
                  <div key={employee} className="bg-black/40 border border-amber-500/10 rounded-xl p-4 flex items-center justify-between theme-light:bg-gray-50 theme-light:border-gray-200">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-amber-600/20 border border-amber-500/30 flex items-center justify-center theme-light:bg-amber-100">
                        <User className="w-5 h-5 text-amber-400 theme-light:text-amber-600" />
                      </div>
                      <p className="text-white font-medium theme-light:text-gray-900">{employee}</p>
                    </div>
                    <Badge className="bg-amber-600/20 text-amber-300 border-amber-500/30 theme-light:bg-amber-100 theme-light:text-amber-700">
                      {count} ventas
                    </Badge>
                  </div>
                ))}
            </div>
          </div>
        )}

        {/* Transacciones por Día */}
        <div>
          <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2 theme-light:text-gray-900">
            <Calendar className="w-5 h-5 text-amber-400 theme-light:text-amber-600" />
            Desglose Diario
          </h3>
          <div className="space-y-2 max-h-[350px] overflow-y-auto">
            {analysis.byDay.map(([day, daySales]) => {
              const dayTotal = daySales.reduce((sum, s) => sum + (s.total || 0), 0);
              return (
                <div key={day} className="bg-black/40 border border-amber-500/10 rounded-xl p-4 theme-light:bg-gray-50 theme-light:border-gray-200">
                  <div className="flex items-center justify-between mb-2">
                    <div>
                      <p className="text-white font-semibold theme-light:text-gray-900">
                        {format(new Date(day), 'EEEE, d MMMM yyyy', { locale: es })}
                      </p>
                      <p className="text-xs text-gray-400 theme-light:text-gray-600">
                        {daySales.length} transacciones
                      </p>
                    </div>
                    <div className="text-right">
                      <Badge className="bg-amber-600/20 text-amber-300 border-amber-500/30 theme-light:bg-amber-100 theme-light:text-amber-700">
                        ${dayTotal.toFixed(2)}
                      </Badge>
                    </div>
                  </div>
                  <div className="w-full bg-black/40 rounded-full h-2 theme-light:bg-gray-200">
                    <div 
                      className="bg-gradient-to-r from-amber-600 to-orange-600 h-2 rounded-full transition-all"
                      style={{ width: `${(daySales.length / sales.length * 100)}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
