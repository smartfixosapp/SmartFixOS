
import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Card, CardContent } from "@/components/ui/card";
import { DollarSign, TrendingUp, AlertCircle } from "lucide-react";
import { format, startOfDay, endOfDay, isWithinInterval } from "date-fns";
import { motion } from "framer-motion";

export default function TodaySalesKPI({ onClick, drawerOpen }) {
  const [salesData, setSalesData] = useState({
    amount: 0,
    count: 0
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [lastUpdate, setLastUpdate] = useState(new Date());
  const [animateAmount, setAnimateAmount] = useState(false);
  const [animateCount, setAnimateCount] = useState(false);

  useEffect(() => {
    // ✅ Si la caja está cerrada, mostrar $0.00
    if (drawerOpen === false) {
      setSalesData({ amount: 0, count: 0 });
      setLoading(false);
      return;
    }

    loadTodaySales();
    
    const interval = setInterval(() => {
      if (drawerOpen !== false) {
        loadTodaySales();
      }
    }, 60000);

    const handleForceRefresh = () => {
      console.log('[TodaySalesKPI] Force refresh triggered');
      if (drawerOpen !== false) {
        loadTodaySales();
      }
    };
    window.addEventListener('force-refresh', handleForceRefresh);

    const handleDrawerClosed = () => {
      console.log('[TodaySalesKPI] 📊 Drawer closed - resetting to $0.00');
      setSalesData({ amount: 0, count: 0 });
      setLastUpdate(new Date());
      
      setAnimateAmount(true);
      setAnimateCount(true);
      setTimeout(() => {
        setAnimateAmount(false);
        setAnimateCount(false);
      }, 300);
    };
    window.addEventListener('drawer-closed', handleDrawerClosed);

    const handleSaleCompleted = (event) => {
      console.log('[TodaySalesKPI] Sale completed event:', event.detail);
      if (drawerOpen !== false) {
        loadTodaySales();
      }
    };
    window.addEventListener('sale-completed', handleSaleCompleted);

    const now = new Date();
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(0, 0, 0, 0);
    const msUntilMidnight = tomorrow - now;

    const midnightTimeout = setTimeout(() => {
      setSalesData({ amount: 0, count: 0 });
      if (drawerOpen !== false) {
        loadTodaySales();
      }
    }, msUntilMidnight);

    return () => {
      clearInterval(interval);
      clearTimeout(midnightTimeout);
      window.removeEventListener('force-refresh', handleForceRefresh);
      window.removeEventListener('sale-completed', handleSaleCompleted);
      window.removeEventListener('drawer-closed', handleDrawerClosed);
    };
  }, [drawerOpen]);

  const loadTodaySales = async () => {
    try {
      setError(null);
      setLoading(true); // Ensure loading is true at the start of a fetch attempt
      
      console.log('[TodaySalesKPI] 🔄 Loading transactions...');
      
      // Get today's date range in Puerto Rico timezone
      const now = new Date();
      const todayStart = startOfDay(now);
      const todayEnd = endOfDay(now);
      
      console.log('[TodaySalesKPI] 📅 Today range:', todayStart, 'to', todayEnd);
      
      // ✅ Reducir límites y agregar mejor error handling
      const [allTransactionsPromise, allSalesPromise] = await Promise.allSettled([
        base44.entities.Transaction.list("-created_date", 200), // Reduced limit from 500 to 200
        base44.entities.Sale.list("-created_date", 200) // Reduced limit from 500 to 200
      ]);
      
      const transactions = allTransactionsPromise.status === "fulfilled" ? allTransactionsPromise.value : [];
      const sales = allSalesPromise.status === "fulfilled" ? allSalesPromise.value : [];
      
      console.log('[TodaySalesKPI] 📊 Total loaded:', {
        transactions: transactions.length,
        sales: sales.length
      });
      
      // Filter transactions from today with type revenue
      const todayPayments = transactions.filter(tx => {
        try {
          // Solo revenue (ingresos reales)
          if (tx.type !== 'revenue') return false;
          
          const txDate = new Date(tx.created_date);
          if (!isWithinInterval(txDate, { start: todayStart, end: todayEnd })) return false;
          
          console.log('[TodaySalesKPI] ✅ Today transaction:', 
            tx.order_number || tx.id, 
            tx.amount, 
            format(txDate, 'HH:mm:ss')
          );
          
          return true;
        } catch (e) {
          return false;
        }
      });

      console.log('[TodaySalesKPI] 💰 Today payments count:', todayPayments.length);

      // Deduplicar por ID
      const uniquePayments = Array.from(
        new Map(todayPayments.map(tx => [tx.id, tx])).values()
      );

      console.log('[TodaySalesKPI] 🎯 Unique payments count:', uniquePayments.length);

      // Calcular total
      const totalAmount = uniquePayments.reduce((sum, tx) => {
        const amount = tx.amount || 0;
        return sum + amount;
      }, 0);
      
      console.log('[TodaySalesKPI] 💵 Total amount:', totalAmount);
      
      const totalCount = uniquePayments.length;

      // Animate if values changed
      if (totalAmount !== salesData.amount) {
        setAnimateAmount(true);
        setTimeout(() => setAnimateAmount(false), 300);
      }
      
      if (totalCount !== salesData.count) {
        setAnimateCount(true);
        setTimeout(() => setAnimateCount(false), 300);
      }

      setSalesData({
        amount: Math.max(0, totalAmount),
        count: totalCount
      });
      
      setLastUpdate(new Date());
      setLoading(false); // Only set loading to false on successful fetch
    } catch (error) {
      console.error("[TodaySalesKPI] ❌ Error loading today's sales:", error);
      setError(error.message || "Error al cargar ventas");
      // ✅ No setear loading a false si hay error para mostrar último dato conocido
      // If salesData is 0,0, then we set loading to false to show the error state with no data.
      // If salesData has existing data, we keep loading true to indicate that we're showing old data
      // and still trying to fetch new data.
      if (salesData.amount === 0 && salesData.count === 0) {
        setLoading(false);
      }
    }
  };

  // ✅ Mostrar estado especial si caja cerrada
  if (drawerOpen === false) {
    return (
      <Card 
        className="bg-gradient-to-br from-[#2B2B2B] to-black border-red-900/30 shadow-xl hover:shadow-red-600/20 transition-all cursor-pointer h-full relative overflow-hidden group"
        onClick={onClick}
        title="Caja cerrada - No hay ventas registradas"
      >
        <div className="absolute inset-0 bg-gradient-to-br from-gray-500/5 to-gray-500/5 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
        
        <CardContent className="pt-6 relative z-10">
          <div className="flex justify-between items-start">
            <div className="flex-1">
              <p className="text-sm font-medium text-gray-400 uppercase tracking-wide flex items-center gap-2">
                <TrendingUp className="w-4 h-4" />
                Ventas Hoy
              </p>
              <div className="mt-2 space-y-1">
                <p className="text-2xl sm:text-3xl font-bold text-white">$0.00</p>
                <p className="text-sm text-gray-500">· 0 pagos</p>
              </div>
            </div>
            <div className="p-3 rounded-xl bg-gradient-to-br from-gray-600/20 to-gray-800/20 border border-gray-500/30">
              <DollarSign className="w-6 h-6 text-gray-400" />
            </div>
          </div>
          
          <div className="mt-4 flex items-center justify-between">
            <span className="text-xs text-gray-500">
              ⚠️ Caja cerrada
            </span>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error && salesData.amount === 0 && salesData.count === 0) {
    return (
      <Card 
        className="bg-gradient-to-br from-[#2B2B2B] to-black border-red-900/30 shadow-xl h-full"
        title="Error al cargar ventas"
      >
        <CardContent className="pt-6">
          <div className="flex justify-between items-start">
            <div className="flex-1">
              <p className="text-sm font-medium text-gray-400 uppercase tracking-wide flex items-center gap-2">
                <TrendingUp className="w-4 h-4" />
                Ventas Hoy
              </p>
              <div className="mt-2 space-y-2">
                <div className="flex items-center gap-2 text-yellow-500">
                  <AlertCircle className="w-5 h-5" />
                  <p className="text-sm">Sin datos disponibles</p>
                </div>
              </div>
            </div>
            <div className="p-3 rounded-xl bg-gradient-to-br from-gray-600/20 to-gray-800/20 border border-gray-500/30">
              <DollarSign className="w-6 h-6 text-gray-400" />
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card 
      className="bg-gradient-to-br from-[#2B2B2B] to-black border-red-900/30 shadow-xl hover:shadow-red-600/20 transition-all cursor-pointer h-full relative overflow-hidden group"
      onClick={onClick}
      title="Solo dinero cobrado hoy (POS + Work Orders, 00:00–23:59 PR)"
    >
      {/* Animated background pulse */}
      <div className="absolute inset-0 bg-gradient-to-br from-green-500/5 to-emerald-500/5 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
      
      <CardContent className="pt-6 relative z-10">
        <div className="flex justify-between items-start">
          <div className="flex-1">
            <p className="text-sm font-medium text-gray-400 uppercase tracking-wide flex items-center gap-2">
              <TrendingUp className="w-4 h-4" />
              Ventas Hoy
            </p>
            <div className="mt-2 space-y-1">
              <motion.p 
                className="text-2xl sm:text-3xl font-bold text-white"
                animate={{ 
                  scale: animateAmount ? [1, 1.1, 1] : 1,
                  color: animateAmount ? ['#ffffff', '#00ff00', '#ffffff'] : '#ffffff'
                }}
                transition={{ duration: 0.3 }}
              >
                ${salesData.amount.toFixed(2)}
              </motion.p>
              <motion.p 
                className="text-sm text-gray-500"
                animate={{ 
                  scale: animateCount ? [1, 1.1, 1] : 1 
                }}
                transition={{ duration: 0.3 }}
              >
                · {salesData.count} {salesData.count === 1 ? 'pago' : 'pagos'}
              </motion.p>
            </div>
          </div>
          <div className="p-3 rounded-xl bg-gradient-to-br from-green-600/20 to-emerald-800/20 border border-green-500/30 group-hover:scale-110 transition-transform">
            <DollarSign className="w-6 h-6 text-green-400" />
          </div>
        </div>
        
        {!loading && !error && (
          <div className="mt-4 flex items-center justify-between">
            <span className="text-xs text-gray-500">
              Actualizado {format(lastUpdate, "HH:mm")} (PR)
            </span>
            <div className="flex items-center gap-1">
              <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
              <span className="text-xs text-green-500">En vivo</span>
            </div>
          </div>
        )}
        
        {loading && (
          <div className="mt-4">
            <div className="w-full h-1 bg-gray-800 rounded-full overflow-hidden">
              <div className="h-full bg-[#FF0000] animate-pulse" style={{ width: '60%' }} />
            </div>
          </div>
        )}

        {error && salesData.amount > 0 && ( // Display warning only if there's an error but data is available
          <div className="mt-4 flex items-center gap-2 text-yellow-500 text-xs">
            <AlertCircle className="w-3 h-3" />
            <span>Mostrando último dato conocido</span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
