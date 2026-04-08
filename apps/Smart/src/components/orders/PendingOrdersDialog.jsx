import React, { useState, useEffect, useMemo } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, DollarSign, Clock, ArrowRight, TrendingUp, Calendar } from "lucide-react";
import { format, differenceInDays } from "date-fns";
import { es } from "date-fns/locale";
import { dataClient } from "@/components/api/dataClient";
import { getStatusConfig } from "@/components/utils/statusRegistry";
import { motion, AnimatePresence } from "framer-motion";

export default function PendingOrdersDialog({ open, onClose }) {
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    pendingOrders: [],
    totalDebt: 0
  });

  useEffect(() => {
    if (open) {
      loadData();
    }
  }, [open]);

  const loadData = async () => {
    setLoading(true);
    try {
      // Fetch only ready for pickup orders
      const allOrders = await dataClient.entities.Order.filter({ 
        deleted: false,
        status: "ready_for_pickup"
      });

      let totalDebt = 0;
      const readyOrders = [];
      const today = new Date();

      allOrders.forEach(o => {
        const balanceDue = Number(o.balance_due) || 0;
        const costEstimate = Number(o.cost_estimate) || 0;
        const amountPaid = Number(o.amount_paid) || 0;
        const daysOld = o.created_date ? differenceInDays(today, new Date(o.created_date)) : 0;
        
        // Calculate real balance including orders with cost but no payment
        let actualBalance = balanceDue;
        if (actualBalance === 0 && costEstimate > 0 && amountPaid === 0) {
          actualBalance = costEstimate;
        }
        
        totalDebt += actualBalance;
        readyOrders.push({ ...o, daysOld, balance: actualBalance });
      });

      // Sort by debt desc, then age
      readyOrders.sort((a, b) => b.balance - a.balance || b.daysOld - a.daysOld);

      setStats({
        pendingOrders: readyOrders,
        totalDebt,
        readyForPickup: readyOrders.length
      });

    } catch (error) {
      console.error("Error loading pending stats:", error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-full sm:max-w-3xl bg-[#0A0A0A]/95 backdrop-blur-2xl border-white/10 text-white max-h-[90vh] overflow-y-auto shadow-2xl rounded-[32px] sm:rounded-[32px] rounded-t-[32px] p-0 overflow-hidden m-0 sm:m-4">
        <div className="sticky top-0 z-20 bg-[#0A0A0A]/95 backdrop-blur-xl border-b border-white/5 p-4 sm:p-6 pb-4">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div className="space-y-1">
              <DialogTitle className="text-xl sm:text-2xl font-bold flex items-center gap-2 sm:gap-3">
                <div className="p-1.5 sm:p-2 bg-red-500/10 rounded-xl sm:rounded-2xl">
                  <AlertTriangle className="w-5 h-5 sm:w-6 sm:h-6 text-red-500" />
                </div>
                <span className="text-white tracking-tight">Centro de Prioridad</span>
              </DialogTitle>
              <p className="text-white/50 text-xs sm:text-sm font-medium pl-10 sm:pl-14">
                Gestión de cobros y trabajos pendientes
              </p>
            </div>
            
            <Button variant="ghost" size="icon" onClick={onClose} className="rounded-full hover:bg-white/10">
               {/* Close button handled by Dialog primitive usually, but good to have explicit close if needed */}
            </Button>
          </div>
        </div>

        {loading ? (
          <div className="py-20 flex justify-center">
            <div className="w-10 h-10 border-4 border-white/20 border-t-white rounded-full animate-spin" />
          </div>
        ) : (
          <div className="p-4 sm:p-6 pt-2 space-y-6 sm:space-y-8">
            {/* Main Debt Card - Apple Style */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ type: "spring", stiffness: 300, damping: 25 }}
            >
                <Card 
                  className="bg-gradient-to-br from-red-500/20 to-red-900/10 border-red-500/20 relative overflow-hidden cursor-pointer hover:scale-[1.02] active:scale-[0.98] transition-all duration-300 shadow-2xl shadow-red-900/20 group"
                  onClick={() => {
                    const list = document.getElementById('pending-list');
                    if(list) list.scrollIntoView({ behavior: 'smooth' });
                  }}
                >
                  <CardContent className="p-6 sm:p-8 relative z-10">
                    <div className="text-center mb-6">
                      <motion.div 
                          initial={{ y: 10, opacity: 0 }}
                          animate={{ y: 0, opacity: 1 }}
                          transition={{ delay: 0.1 }}
                          className="inline-flex items-center gap-2 mb-2 px-3 py-1 rounded-full bg-red-500/20 text-red-300 text-xs font-bold uppercase tracking-wider border border-red-500/20"
                      >
                          <DollarSign className="w-3 h-3" /> Por Cobrar
                      </motion.div>
                      
                      <motion.h3 
                          initial={{ scale: 0.8, opacity: 0 }}
                          animate={{ scale: 1, opacity: 1 }}
                          transition={{ type: "spring", stiffness: 200, delay: 0.2 }}
                          className="text-4xl sm:text-6xl md:text-7xl font-bold text-white tracking-tighter my-3 sm:my-4"
                      >
                        ${stats.totalDebt.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </motion.h3>
                      
                      <motion.p 
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          transition={{ delay: 0.4 }}
                          className="text-red-300/80 font-medium text-sm sm:text-base md:text-lg"
                      >
                        {stats.pendingOrders.length} {stats.pendingOrders.length === 1 ? 'trabajo' : 'trabajos'} requieren atención
                      </motion.p>
                    </div>

                    {/* Listas para Recoger - Destacado */}
                    {stats.readyForPickup > 0 && (
                      <motion.div 
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.5 }}
                        className="bg-gradient-to-r from-emerald-500/20 to-green-500/20 border border-emerald-500/40 rounded-2xl p-4 sm:p-5 text-center relative overflow-hidden"
                      >
                        <div className="absolute inset-0 bg-gradient-to-br from-emerald-400/10 to-transparent" />
                        <div className="relative z-10">
                          <div className="flex items-center justify-center gap-2 mb-2">
                            <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                            <span className="text-xs font-bold text-emerald-300 uppercase tracking-wider">Listas para Recoger</span>
                          </div>
                          <div className="text-4xl sm:text-5xl font-bold text-emerald-400">{stats.readyForPickup}</div>
                          <div className="text-xs text-emerald-300/70 mt-1">Equipos terminados esperando cobro</div>
                        </div>
                      </motion.div>
                    )}

                    {/* Background Glow */}
                    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 bg-red-500/20 rounded-full blur-[100px] -z-10 group-hover:bg-red-500/30 transition-all duration-500" />
                  </CardContent>
                </Card>
            </motion.div>

            {/* List Header */}
            <div className="flex items-center justify-between px-2">
              <h3 className="text-xl font-bold text-white flex items-center gap-2">
                <Clock className="w-5 h-5 text-white/40" />
                Trabajos Pendientes
              </h3>
              <Badge variant="secondary" className="bg-white/10 text-white border-none text-sm px-3 py-1 rounded-full">
                {stats.pendingOrders.length}
              </Badge>
            </div>

            {/* Orders List with Scroll */}
            <div id="pending-list" className="space-y-3 pb-6 max-h-[500px] overflow-y-auto pr-2">
              <AnimatePresence>
              {stats.pendingOrders.length === 0 ? (
                <motion.div 
                    initial={{ opacity: 0 }} 
                    animate={{ opacity: 1 }}
                    className="py-16 text-center border border-dashed border-white/10 rounded-3xl bg-white/5"
                >
                  <div className="w-16 h-16 bg-white/5 rounded-full flex items-center justify-center mx-auto mb-4">
                    <Clock className="w-8 h-8 text-white/50" />
                  </div>
                  <p className="text-white font-medium text-lg">¡Todo limpio!</p>
                  <p className="text-white/40 text-sm mt-1">No hay equipos listos para recoger.</p>
                </motion.div>
              ) : (
                <>
                  {stats.pendingOrders.map((order, index) => {
                    const isLate = order.daysOld > 7;
                    return (
                      <motion.div 
                        key={order.id}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: index * 0.05, type: "spring", stiffness: 300, damping: 24 }}
                        className="group bg-[#161616] hover:bg-emerald-500/5 border border-emerald-500/20 hover:border-emerald-500/40 p-3 sm:p-4 rounded-2xl transition-all flex items-center justify-between cursor-default"
                      >
                        <div className="flex items-center gap-3 sm:gap-4 flex-1 min-w-0">
                          <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-xl sm:rounded-2xl flex flex-col items-center justify-center font-bold border bg-emerald-500/10 text-emerald-400 border-emerald-500/20 group-hover:bg-emerald-500/20 transition-colors flex-shrink-0">
                            {order.balance > 0 ? (
                              <DollarSign className="w-5 h-5 sm:w-6 sm:h-6" />
                            ) : (
                              <Clock className="w-5 h-5 sm:w-6 sm:h-6" />
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-1.5 sm:gap-2 mb-1 flex-wrap">
                              <span className="font-bold text-white text-base sm:text-lg tracking-tight">{order.order_number}</span>
                              {isLate && (
                                  <span className="text-[10px] px-1.5 sm:px-2 py-0.5 rounded-full font-bold uppercase tracking-wide border border-orange-500/30 text-orange-400 bg-orange-500/10">
                                      {order.daysOld}d
                                  </span>
                              )}
                            </div>
                            <div className="flex flex-col sm:flex-row sm:items-center gap-0.5 sm:gap-2 text-xs sm:text-sm text-white/60">
                              <span className="font-medium text-white/80 truncate">{order.customer_name}</span>
                              <span className="hidden sm:inline">•</span>
                              <span className="truncate">{order.device_model}</span>
                            </div>
                          </div>
                        </div>
                        <div className="text-right flex-shrink-0 ml-2">
                          {order.balance > 0 && (
                              <>
                                  <p className="text-[9px] sm:text-[10px] text-red-400/70 uppercase tracking-wide font-bold mb-0.5">Por Cobrar</p>
                                  <p className="text-base sm:text-xl font-bold tracking-tight text-red-400">${order.balance.toFixed(2)}</p>
                              </>
                          )}
                          {order.balance <= 0 && (
                              <ArrowRight className="w-4 h-4 sm:w-5 sm:h-5 text-emerald-400/40 group-hover:text-emerald-400 transition-colors ml-auto" />
                          )}
                          </div>
                        </motion.div>
                      );
                    })}
                  </>
                )}
              </AnimatePresence>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
