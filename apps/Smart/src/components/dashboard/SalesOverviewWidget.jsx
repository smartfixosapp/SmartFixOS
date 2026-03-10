import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { TrendingUp, TrendingDown, DollarSign, Calendar } from "lucide-react";
import { format, startOfDay, endOfDay, subDays, isWithinInterval } from "date-fns";
import { es } from "date-fns/locale";

export default function SalesOverviewWidget() {
  const [salesData, setSalesData] = useState({
    today: 0,
    yesterday: 0,
    week: 0,
    todayCount: 0,
    weekCount: 0
  });
  const [recentTransactions, setRecentTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState("today");

  useEffect(() => {
    loadSalesData();
    const interval = setInterval(loadSalesData, 120000);
    return () => clearInterval(interval);
  }, []);

  const loadSalesData = async () => {
    try {
      const now = new Date();
      const todayStart = startOfDay(now);
      const todayEnd = endOfDay(now);
      const yesterdayStart = startOfDay(subDays(now, 1));
      const yesterdayEnd = endOfDay(subDays(now, 1));
      const weekStart = startOfDay(subDays(now, 7));

      const transactions = await base44.entities.Transaction.list("-created_date", 500);

      const todayTx = transactions.filter(tx => 
        tx.type === 'revenue' && 
        isWithinInterval(new Date(tx.created_date), { start: todayStart, end: todayEnd })
      );

      const yesterdayTx = transactions.filter(tx => 
        tx.type === 'revenue' && 
        isWithinInterval(new Date(tx.created_date), { start: yesterdayStart, end: yesterdayEnd })
      );

      const weekTx = transactions.filter(tx => 
        tx.type === 'revenue' && 
        isWithinInterval(new Date(tx.created_date), { start: weekStart, end: todayEnd })
      );

      setSalesData({
        today: todayTx.reduce((sum, tx) => sum + (tx.amount || 0), 0),
        yesterday: yesterdayTx.reduce((sum, tx) => sum + (tx.amount || 0), 0),
        week: weekTx.reduce((sum, tx) => sum + (tx.amount || 0), 0),
        todayCount: todayTx.length,
        weekCount: weekTx.length
      });

      setRecentTransactions(todayTx.slice(0, 5));
      setLoading(false);
    } catch (error) {
      console.error("Error loading sales data:", error);
      setLoading(false);
    }
  };

  const trend = salesData.today - salesData.yesterday;
  const trendPercent = salesData.yesterday > 0 ? ((trend / salesData.yesterday) * 100).toFixed(1) : 0;

  return (
    <Card className="bg-gradient-to-br from-[#2B2B2B] to-black border-red-900/30 shadow-xl">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-white text-lg flex items-center gap-2">
            <DollarSign className="w-5 h-5 text-red-600" />
            Resumen de Ventas
          </CardTitle>
          <div className="flex gap-1">
            <button
              onClick={() => setPeriod("today")}
              className={`px-3 py-1 rounded-lg text-xs transition ${
                period === "today" 
                  ? "bg-red-600 text-white" 
                  : "bg-white/5 text-gray-400 hover:bg-white/10"
              }`}
            >
              Hoy
            </button>
            <button
              onClick={() => setPeriod("week")}
              className={`px-3 py-1 rounded-lg text-xs transition ${
                period === "week" 
                  ? "bg-red-600 text-white" 
                  : "bg-white/5 text-gray-400 hover:bg-white/10"
              }`}
            >
              Semana
            </button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {loading ? (
          <div className="h-24 flex items-center justify-center">
            <div className="animate-spin w-8 h-8 border-4 border-red-600 border-t-transparent rounded-full" />
          </div>
        ) : (
          <>
            {period === "today" ? (
              <>
                <div>
                  <p className="text-3xl font-bold text-white">
                    ${salesData.today.toFixed(2)}
                  </p>
                  <p className="text-sm text-gray-400 mt-1">
                    {salesData.todayCount} {salesData.todayCount === 1 ? "transacción" : "transacciones"} hoy
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  {trend >= 0 ? (
                    <TrendingUp className="w-4 h-4 text-green-500" />
                  ) : (
                    <TrendingDown className="w-4 h-4 text-red-500" />
                  )}
                  <span className={`text-sm font-medium ${trend >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                    {trend >= 0 ? '+' : ''}{trendPercent}%
                  </span>
                  <span className="text-xs text-gray-400">vs ayer</span>
                </div>

                <div className="pt-3 border-t border-white/10">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-400">Ayer:</span>
                    <span className="text-white font-medium">${salesData.yesterday.toFixed(2)}</span>
                  </div>
                </div>

                {recentTransactions.length > 0 && (
                  <div className="pt-3 border-t border-white/10">
                    <p className="text-xs font-semibold text-gray-400 mb-2">Transacciones del POS recientes</p>
                    <div className="space-y-2 max-h-32 overflow-y-auto">
                      {recentTransactions.map((tx, idx) => (
                        <div key={tx.id || idx} className="flex items-center justify-between text-xs p-2 bg-white/5 rounded">
                          <div className="flex-1 min-w-0">
                            <p className="text-white truncate">{tx.order_number || tx.description || "Venta"}</p>
                            <p className="text-gray-500 text-[10px]">{format(new Date(tx.created_date), "HH:mm", { locale: es })}</p>
                          </div>
                          <span className="text-green-400 font-semibold ml-2">${tx.amount?.toFixed(2)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </>
            ) : (
              <>
                <div>
                  <p className="text-3xl font-bold text-white">
                    ${salesData.week.toFixed(2)}
                  </p>
                  <p className="text-sm text-gray-400 mt-1">
                    {salesData.weekCount} transacciones esta semana
                  </p>
                </div>

                <div className="pt-3 border-t border-white/10">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-400">Promedio diario:</span>
                    <span className="text-white font-medium">${(salesData.week / 7).toFixed(2)}</span>
                  </div>
                </div>
              </>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
