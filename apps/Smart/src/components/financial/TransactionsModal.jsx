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
      <DialogContent className="apple-type apple-surface-elevated rounded-apple-lg shadow-apple-xl border-0 p-0 overflow-hidden max-w-4xl max-h-[90vh]">
        <DialogHeader className="px-6 pt-6 pb-2">
          <DialogTitle className="apple-text-title2 apple-label-primary flex items-center gap-3">
            <div className="w-12 h-12 rounded-apple-sm bg-apple-blue/15 flex items-center justify-center">
              <Receipt className="w-6 h-6 text-apple-blue" />
            </div>
            {title}
          </DialogTitle>
        </DialogHeader>

        {/* Resumen de totales */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6 px-6">
          <div className="apple-card bg-apple-green/12 rounded-apple-md p-4">
            <p className="apple-text-caption2 font-semibold apple-label-tertiary mb-1">Ingresos Totales</p>
            <p className="apple-text-title1 tabular-nums text-apple-green">${totalRevenue.toFixed(2)}</p>
            <p className="apple-text-caption2 apple-label-tertiary tabular-nums mt-1">{transactionCount} transacciones</p>
          </div>

          <div className="apple-card bg-apple-blue/12 rounded-apple-md p-4">
            <p className="apple-text-caption2 font-semibold apple-label-tertiary mb-1">Ticket Promedio</p>
            <p className="apple-text-title1 tabular-nums text-apple-blue">${avgTicket.toFixed(2)}</p>
            <p className="apple-text-caption2 apple-label-tertiary mt-1">Por transacción</p>
          </div>

          <div className="apple-card bg-apple-purple/12 rounded-apple-md p-4">
            <p className="apple-text-caption2 font-semibold apple-label-tertiary mb-1">IVU Recaudado</p>
            <p className="apple-text-title1 tabular-nums text-apple-purple">${totalTax.toFixed(2)}</p>
            <p className="apple-text-caption2 apple-label-tertiary tabular-nums mt-1">11.5% de ventas</p>
          </div>

          <div className="apple-card bg-apple-orange/12 rounded-apple-md p-4">
            <p className="apple-text-caption2 font-semibold apple-label-tertiary mb-1">Transacciones</p>
            <p className="apple-text-title1 tabular-nums text-apple-orange">{transactionCount}</p>
            <p className="apple-text-caption2 apple-label-tertiary mt-1">Ventas completadas</p>
          </div>
        </div>

        {/* Lista de transacciones */}
        <div className="space-y-2 max-h-[450px] overflow-y-auto pr-2 px-6 pb-6">
          {sales.length === 0 ? (
            <div className="text-center py-12">
              <Receipt className="w-16 h-16 mx-auto apple-label-tertiary mb-4 opacity-50" />
              <p className="apple-label-secondary apple-text-body">No hay transacciones en este período</p>
            </div>
          ) : (
            sales.map((sale) => {
              const Icon = paymentMethodIcons[sale.payment_method] || DollarSign;

              return (
                <div key={sale.id} className="apple-card rounded-apple-md p-4 transition-all">
                  <div className="flex items-center justify-between gap-4 mb-2">
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <div className="w-10 h-10 rounded-apple-sm bg-apple-blue/15 flex items-center justify-center flex-shrink-0">
                        <Icon className="w-5 h-5 text-apple-blue" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <Badge className="bg-apple-blue/15 text-apple-blue border-0 font-mono apple-text-caption2 tabular-nums">
                            {sale.sale_number}
                          </Badge>
                          <Badge variant="outline" className="capitalize apple-text-caption2 apple-label-secondary border-0 bg-gray-sys6 dark:bg-gray-sys5">
                            {sale.payment_method === 'ath_movil' ? 'ATH Móvil' : sale.payment_method}
                          </Badge>
                        </div>
                        <p className="apple-label-primary apple-text-footnote truncate">
                          {sale.customer_name || 'Cliente'} • {sale.items?.length || 0} items
                        </p>
                        <p className="apple-label-tertiary apple-text-caption2 tabular-nums">
                          {format(new Date(sale.created_date), 'dd/MM/yyyy HH:mm')}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="apple-text-title2 tabular-nums text-apple-green">
                        ${(sale.total || 0).toFixed(2)}
                      </p>
                      <p className="apple-text-caption2 apple-label-tertiary tabular-nums">
                        IVU: ${(sale.tax_amount || 0).toFixed(2)}
                      </p>
                    </div>
                  </div>

                  {/* Desglose */}
                  <div className="grid grid-cols-3 gap-2 mt-3 pt-3" style={{ borderTop: "0.5px solid rgb(var(--separator) / 0.29)" }}>
                    <div>
                      <p className="apple-text-caption2 apple-label-tertiary">Subtotal</p>
                      <p className="apple-text-footnote apple-label-primary font-semibold tabular-nums">
                        ${(sale.subtotal || 0).toFixed(2)}
                      </p>
                    </div>
                    <div>
                      <p className="apple-text-caption2 apple-label-tertiary tabular-nums">IVU (11.5%)</p>
                      <p className="apple-text-footnote text-apple-purple font-semibold tabular-nums">
                        ${(sale.tax_amount || 0).toFixed(2)}
                      </p>
                    </div>
                    <div>
                      <p className="apple-text-caption2 apple-label-tertiary">Total</p>
                      <p className="apple-text-footnote text-apple-green font-semibold tabular-nums">
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
