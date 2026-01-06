import React from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Wallet, CreditCard, Landmark, DollarSign, Receipt } from "lucide-react";
import { format } from "date-fns";

export default function TransactionsModal({ open, onClose, sales = [], title = "Transacciones" }) {
  const paymentMethodIcons = { 
    cash: Wallet, 
    card: CreditCard, 
    ath_movil: Landmark, 
    mixed: DollarSign 
  };

  // Calcular totales
  const totalRevenue = sales.reduce((sum, s) => sum + (s.total || 0), 0);
  const totalTax = sales.reduce((sum, s) => sum + (s.tax_amount || 0), 0);
  const avgTicket = sales.length > 0 ? totalRevenue / sales.length : 0;
  const transactionCount = sales.length;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="bg-gradient-to-br from-[#020617] to-black border-cyan-500/30 max-w-4xl max-h-[90vh] text-white theme-light:bg-white theme-light:border-gray-200 theme-light:text-gray-900">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-cyan-600 to-emerald-600 flex items-center justify-center">
              <Receipt className="w-6 h-6 text-white" />
            </div>
            {title}
          </DialogTitle>
        </DialogHeader>

        {/* Resumen de totales */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
          <div className="bg-gradient-to-br from-emerald-600/20 to-emerald-800/20 border border-emerald-500/30 rounded-xl p-4 theme-light:bg-emerald-50 theme-light:border-emerald-300">
            <p className="text-xs text-emerald-300 mb-1 theme-light:text-emerald-700">INGRESOS TOTALES</p>
            <p className="text-2xl font-bold text-emerald-400 theme-light:text-emerald-600">${totalRevenue.toFixed(2)}</p>
            <p className="text-[10px] text-emerald-300/70 mt-1 theme-light:text-emerald-600">{transactionCount} transacciones</p>
          </div>

          <div className="bg-gradient-to-br from-cyan-600/20 to-cyan-800/20 border border-cyan-500/30 rounded-xl p-4 theme-light:bg-cyan-50 theme-light:border-cyan-300">
            <p className="text-xs text-cyan-300 mb-1 theme-light:text-cyan-700">TICKET PROMEDIO</p>
            <p className="text-2xl font-bold text-cyan-400 theme-light:text-cyan-600">${avgTicket.toFixed(2)}</p>
            <p className="text-[10px] text-cyan-300/70 mt-1 theme-light:text-cyan-600">Por transacción</p>
          </div>

          <div className="bg-gradient-to-br from-purple-600/20 to-purple-800/20 border border-purple-500/30 rounded-xl p-4 theme-light:bg-purple-50 theme-light:border-purple-300">
            <p className="text-xs text-purple-300 mb-1 theme-light:text-purple-700">IVU RECAUDADO</p>
            <p className="text-2xl font-bold text-purple-400 theme-light:text-purple-600">${totalTax.toFixed(2)}</p>
            <p className="text-[10px] text-purple-300/70 mt-1 theme-light:text-purple-600">11.5% de ventas</p>
          </div>

          <div className="bg-gradient-to-br from-amber-600/20 to-amber-800/20 border border-amber-500/30 rounded-xl p-4 theme-light:bg-amber-50 theme-light:border-amber-300">
            <p className="text-xs text-amber-300 mb-1 theme-light:text-amber-700">TRANSACCIONES</p>
            <p className="text-2xl font-bold text-amber-400 theme-light:text-amber-600">{transactionCount}</p>
            <p className="text-[10px] text-amber-300/70 mt-1 theme-light:text-amber-600">Ventas completadas</p>
          </div>
        </div>

        {/* Lista de transacciones */}
        <div className="space-y-2 max-h-[450px] overflow-y-auto pr-2">
          {sales.length === 0 ? (
            <div className="text-center py-12">
              <Receipt className="w-16 h-16 mx-auto text-gray-600 mb-4 opacity-50" />
              <p className="text-gray-400 theme-light:text-gray-600">No hay transacciones en este período</p>
            </div>
          ) : (
            sales.map((sale) => {
              const Icon = paymentMethodIcons[sale.payment_method] || DollarSign;
              
              return (
                <div key={sale.id} className="bg-black/40 border border-cyan-500/10 rounded-xl p-4 hover:bg-black/50 transition-all theme-light:bg-gray-50 theme-light:border-gray-200">
                  <div className="flex items-center justify-between gap-4 mb-2">
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <div className="w-10 h-10 rounded-lg bg-cyan-600/20 border border-cyan-500/30 flex items-center justify-center flex-shrink-0 theme-light:bg-cyan-100">
                        <Icon className="w-5 h-5 text-cyan-400 theme-light:text-cyan-600" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <Badge className="bg-cyan-600/20 text-cyan-300 border-cyan-500/30 font-mono text-xs theme-light:bg-cyan-100 theme-light:text-cyan-700">
                            {sale.sale_number}
                          </Badge>
                          <Badge variant="outline" className="capitalize text-xs theme-light:text-gray-700">
                            {sale.payment_method === 'ath_movil' ? 'ATH Móvil' : sale.payment_method}
                          </Badge>
                        </div>
                        <p className="text-white text-sm truncate theme-light:text-gray-900">
                          {sale.customer_name || 'Cliente'} • {sale.items?.length || 0} items
                        </p>
                        <p className="text-gray-500 text-xs theme-light:text-gray-600">
                          {format(new Date(sale.created_date), 'dd/MM/yyyy HH:mm')}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-2xl font-bold text-emerald-400 theme-light:text-emerald-600">
                        ${(sale.total || 0).toFixed(2)}
                      </p>
                      <p className="text-xs text-gray-500 theme-light:text-gray-600">
                        IVU: ${(sale.tax_amount || 0).toFixed(2)}
                      </p>
                    </div>
                  </div>

                  {/* Desglose */}
                  <div className="grid grid-cols-3 gap-2 mt-3 pt-3 border-t border-white/10 theme-light:border-gray-200">
                    <div>
                      <p className="text-[10px] text-gray-500 theme-light:text-gray-600">Subtotal</p>
                      <p className="text-sm text-white font-semibold theme-light:text-gray-900">
                        ${(sale.subtotal || 0).toFixed(2)}
                      </p>
                    </div>
                    <div>
                      <p className="text-[10px] text-gray-500 theme-light:text-gray-600">IVU (11.5%)</p>
                      <p className="text-sm text-purple-400 font-semibold theme-light:text-purple-600">
                        ${(sale.tax_amount || 0).toFixed(2)}
                      </p>
                    </div>
                    <div>
                      <p className="text-[10px] text-gray-500 theme-light:text-gray-600">Total</p>
                      <p className="text-sm text-emerald-400 font-semibold theme-light:text-emerald-600">
                        ${(sale.total || 0).toFixed(2)}
                      </p>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
