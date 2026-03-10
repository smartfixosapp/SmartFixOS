import React, { useState, useEffect } from "react";
import { dataClient } from "@/components/api/dataClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  ListChecks,
  Wrench,
  Clock,
  AlertCircle,
  ChevronRight,
  Zap,
  TrendingUp
} from "lucide-react";

export default function WorkQueueWidget({ onSelectOrder, recentOrders = [] }) {
  const [queueStats, setQueueStats] = useState({
    in_progress: 0,
    waiting_parts: 0,
    awaiting_approval: 0,
    diagnosing: 0,
    total: 0,
    oldest: null
  });

  useEffect(() => {
    const calculateStats = () => {
      if (!recentOrders.length) {
        setQueueStats({
          intake: 0,
          diagnosing: 0,
          waiting_parts: 0,
          total: 0,
          oldest: null
        });
        return;
      }

      const criticalOrders = recentOrders.filter(
        o => ["intake", "diagnosing"].includes(o.status) &&
             o.device_type !== "Software" &&
             !(o.order_number && o.order_number.startsWith("SW-"))
      );

      const stats = {
        intake: criticalOrders.filter(o => o.status === "intake").length,
        diagnosing: criticalOrders.filter(o => o.status === "diagnosing").length,
        total: criticalOrders.length,
        oldest: criticalOrders.length > 0 
          ? criticalOrders.reduce((oldest, o) => 
              new Date(o.created_date) < new Date(oldest.created_date) ? o : oldest
            )
          : null
      };

      setQueueStats(stats);
    };

    calculateStats();
  }, [recentOrders]);

  const getOldestTime = () => {
    if (!queueStats.oldest) return null;
    const days = Math.floor((Date.now() - new Date(queueStats.oldest.created_date)) / (1000 * 60 * 60 * 24));
    const hours = Math.floor(((Date.now() - new Date(queueStats.oldest.created_date)) / (1000 * 60 * 60)) % 24);
    
    if (days > 0) return `${days}d ${hours}h`;
    return `${hours}h`;
  };

  const topOrders = recentOrders
    .filter(o => 
      !["delivered", "cancelled", "completed", "picked_up"].includes(o.status) &&
      o.device_type !== "Software" &&
      !(o.order_number && o.order_number.startsWith("SW-"))
    )
    .sort((a, b) => new Date(a.created_date) - new Date(b.created_date))
    .slice(0, 3);

  return (
    <Card className="bg-gradient-to-br from-indigo-600/10 via-purple-600/10 to-pink-600/10 backdrop-blur-3xl border border-indigo-500/20 rounded-[24px] shadow-xl relative overflow-hidden">
      <div className="absolute -right-12 -top-12 w-32 h-32 bg-indigo-500/20 rounded-full blur-3xl animate-pulse" />
      <div className="absolute -left-12 -bottom-12 w-32 h-32 bg-purple-500/20 rounded-full blur-3xl animate-pulse delay-1000" />
      
      <CardHeader className="pb-3 relative z-10">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-indigo-400 to-purple-500 flex items-center justify-center shadow-lg">
              <ListChecks className="w-5 h-5 text-white" />
            </div>
            <div>
              <CardTitle className="text-white text-lg">Cola de Trabajo</CardTitle>
              <p className="text-xs text-white/60 mt-0.5">
                {queueStats.total} órdenes activas
              </p>
            </div>
          </div>
          <div className="text-3xl font-black text-white/90">{queueStats.total}</div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4 relative z-10">
        {/* Stats Grid */}
        <div className="grid grid-cols-2 gap-2">
          {[
            { label: "En Recepción", value: queueStats.intake, icon: Wrench, color: "from-blue-400 to-blue-600" },
            { label: "Diagnosticando", value: queueStats.diagnosing, icon: Zap, color: "from-yellow-400 to-yellow-600" }
          ].map((item) => {
            const Icon = item.icon;
            return (
              <div key={item.label} className="bg-white/5 border border-white/10 rounded-lg p-2 flex items-center gap-2">
                <div className={`w-6 h-6 rounded bg-gradient-to-br ${item.color} flex items-center justify-center shrink-0`}>
                  <Icon className="w-3 h-3 text-white" />
                </div>
                <div className="min-w-0">
                  <p className="text-[10px] text-white/60 truncate">{item.label}</p>
                  <p className="text-sm font-bold text-white">{item.value}</p>
                </div>
              </div>
            );
          })}
        </div>

        {/* Tiempo más antiguo - Clickeable */}
        {queueStats.oldest && (
          <button
            onClick={() => onSelectOrder && onSelectOrder(queueStats.oldest.id)}
            className="w-full bg-gradient-to-r from-amber-500/20 to-red-500/20 border border-amber-500/30 hover:border-amber-500/60 rounded-lg p-3 flex items-center gap-2 transition-all active:scale-95"
          >
            <TrendingUp className="w-4 h-4 text-amber-400 shrink-0" />
            <div className="text-left flex-1">
              <p className="text-xs text-white/70">Orden más antigua</p>
              <p className="text-sm font-bold text-white">{getOldestTime()} • #{queueStats.oldest.order_number}</p>
            </div>
            <ChevronRight className="w-4 h-4 text-amber-400" />
          </button>
        )}



        {queueStats.total === 0 && (
          <div className="text-center py-6">
            <ListChecks className="w-8 h-8 mx-auto text-white/20 mb-2" />
            <p className="text-xs text-white/40">No hay órdenes activas</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
