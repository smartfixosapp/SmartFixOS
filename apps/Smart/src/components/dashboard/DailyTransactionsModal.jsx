import React, { useState, useEffect } from "react";
import { dataClient } from "@/components/api/dataClient";
import { Badge } from "@/components/ui/badge";
import { DollarSign, X, TrendingUp } from "lucide-react";
import { format, startOfDay } from "date-fns";
import { es } from "date-fns/locale";

export default function DailyTransactionsModal({ open, onClose, currentDrawer }) {
  const [sales, setSales] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (open && currentDrawer) {
      loadData();
    }
  }, [open, currentDrawer]);

  const loadData = async () => {
    setLoading(true);
    try {
      const drawerOpenDate = new Date(currentDrawer.created_date);
      
      // Cargar ventas y transacciones
      const [salesData, transactionsData] = await Promise.all([
        dataClient.entities.Sale.list("-created_date", 300),
        dataClient.entities.Transaction.list("-created_date", 300)
      ]);

      // Filtrar por fecha (desde que se abrió la caja)
      const filteredSales = (salesData || []).filter(
        (s) => !s.voided && new Date(s.created_date) >= drawerOpenDate
      );

      const filteredTransactions = (transactionsData || []).filter(
        (t) => new Date(t.created_date) >= drawerOpenDate
      );

      setSales(filteredSales);
      setTransactions(filteredTransactions);
    } catch (error) {
      console.error("Error loading data:", error);
    } finally {
      setLoading(false);
    }
  };

  // Calcular totales
  const totalRevenue = sales.reduce((sum, s) => sum + (s.amount_paid || 0), 0);
  const totalExpenses = transactions
    .filter(t => t.type === "expense")
    .reduce((sum, t) => sum + (t.amount || 0), 0);
  const netProfit = totalRevenue - totalExpenses;

  // Agrupar órdenes (ventas) por estado
  const orderSummary = sales.reduce((acc, sale) => {
    const status = sale.payment_method || "cash";
    if (!acc[status]) {
      acc[status] = { count: 0, total: 0 };
    }
    acc[status].count++;
    acc[status].total += sale.amount_paid || 0;
    return acc;
  }, {});

  const paymentMethods = {
    cash: "Efectivo",
    card: "Tarjeta",
    ath_movil: "ATH Móvil",
    transfer: "Transferencia"
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4" onClick={onClose}>
      <div 
        className="w-full max-w-2xl max-h-[85vh] overflow-y-auto rounded-3xl bg-gradient-to-br from-cyan-950/40 via-blue-950/30 to-slate-950/40 backdrop-blur-2xl border border-cyan-400/40 shadow-2xl relative"
        onClick={(e) => e.stopPropagation()}
      >
        {/* HEADER CON X */}
        <div className="sticky top-0 z-10 bg-gradient-to-b from-cyan-500/15 to-transparent px-6 py-5 border-b border-cyan-400/30 backdrop-blur-xl">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-cyan-400 to-emerald-400 flex items-center justify-center shadow-lg">
                <DollarSign className="w-5 h-5 text-white" strokeWidth={3} />
              </div>
              <div>
                <h2 className="text-xl font-black text-white tracking-tight">Transacciones</h2>
                <p className="text-xs text-white/60 font-medium">{format(new Date(), "d MMMM yyyy", { locale: es })}</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-full bg-cyan-400/20 hover:bg-cyan-400/30 flex items-center justify-center transition-all active:scale-95 group"
            >
              <X className="w-4 h-4 text-white/70 group-hover:text-white" strokeWidth={3} />
            </button>
          </div>
        </div>

        {/* CONTENIDO */}
        <div className="space-y-4 px-6 py-5">
          {/* TRANSACCIONES */}
          <div className="space-y-4 px-6 py-5">
            {/* VENTAS DIRECTAS */}
            {sales.filter(s => !s.order_id).length > 0 && (
              <div className="space-y-3">
                <h3 className="text-sm font-bold text-white/90 uppercase tracking-wider flex items-center gap-2">
                  🛒 Ventas Directas
                  <span className="ml-auto bg-white/10 px-2 py-0.5 rounded-full text-xs text-white/70">{sales.filter(s => !s.order_id).length}</span>
                </h3>
                <div className="space-y-2">
                  {sales.filter(s => !s.order_id).map((sale, idx) => (
                    <div
                      key={`direct-sale-${idx}`}
                      className="flex justify-between items-start p-3 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl transition-all"
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="text-white font-semibold text-sm">
                            {sale.sale_number || `Venta ${idx + 1}`}
                          </p>
                          <Badge className="text-[10px] bg-blue-600/30 text-blue-300 border-0">
                            Venta
                          </Badge>
                          {sale.customer_name && (
                            <p className="text-white/60 text-xs">• {sale.customer_name}</p>
                          )}
                        </div>
                        <p className="text-white/40 text-xs mt-1">
                          {format(new Date(sale.created_date), "p", { locale: es })} • {paymentMethods[sale.payment_method] || sale.payment_method}
                        </p>
                      </div>
                      <p className="text-emerald-400 font-bold ml-2 whitespace-nowrap">
                        +${(sale.amount_paid || 0).toFixed(2)}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* PAGOS DE ORDEN */}
            {sales.filter(s => s.order_id).length > 0 && (
              <div className="space-y-3">
                <h3 className="text-sm font-bold text-white/90 uppercase tracking-wider flex items-center gap-2">
                  💳 Pagos de Orden
                  <span className="ml-auto bg-white/10 px-2 py-0.5 rounded-full text-xs text-white/70">{sales.filter(s => s.order_id).length}</span>
                </h3>
                <div className="space-y-2">
                  {sales.filter(s => s.order_id).map((sale, idx) => (
                    <div
                      key={`order-payment-${idx}`}
                      className="flex justify-between items-start p-3 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl transition-all"
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="text-white font-semibold text-sm">
                            {sale.order_number || sale.sale_number}
                          </p>
                          <Badge className="text-[10px] bg-orange-600/30 text-orange-300 border-0">
                            Pago de orden
                          </Badge>
                          {sale.customer_name && (
                            <p className="text-white/60 text-xs">• {sale.customer_name}</p>
                          )}
                        </div>
                        <p className="text-white/40 text-xs mt-1">
                          {format(new Date(sale.created_date), "p", { locale: es })} • {paymentMethods[sale.payment_method] || sale.payment_method}
                        </p>
                      </div>
                      <p className="text-emerald-400 font-bold ml-2 whitespace-nowrap">
                        +${(sale.amount_paid || 0).toFixed(2)}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* OTROS GASTOS/TRANSACCIONES */}
            {transactions.filter(t => t.type === "expense").length > 0 && (
              <div className="space-y-3">
                <h3 className="text-sm font-bold text-white/90 uppercase tracking-wider flex items-center gap-2">
                  ⚠️ Otros Gastos
                  <span className="ml-auto bg-white/10 px-2 py-0.5 rounded-full text-xs text-white/70">{transactions.filter(t => t.type === "expense").length}</span>
                </h3>
                <div className="space-y-2">
                  {transactions.filter(t => t.type === "expense").map((trans, idx) => (
                    <div
                      key={`expense-${idx}`}
                      className="flex justify-between items-start p-3 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl transition-all"
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="text-white font-semibold text-sm">
                            {trans.description}
                          </p>
                          <Badge className="text-[10px] bg-red-600/30 text-red-300 border-0">
                            Gasto
                          </Badge>
                        </div>
                        <p className="text-white/40 text-xs mt-1">
                          {format(new Date(trans.created_date), "p", { locale: es })} • {trans.category}
                        </p>
                      </div>
                      <p className="text-red-400 font-bold ml-2 whitespace-nowrap">
                        -${(trans.amount || 0).toFixed(2)}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {sales.length === 0 && transactions.length === 0 && !loading && (
              <div className="text-center py-12 text-white/40">
                <p className="text-sm font-medium">Sin transacciones hoy</p>
              </div>
            )}
            </div>
            </div>
            </div>
            </div>
            );
            }
