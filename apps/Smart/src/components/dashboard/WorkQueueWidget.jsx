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
  TrendingUp,
  ArrowRight
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/components/utils/helpers";

export default function WorkQueueWidget({ onSelectOrder, recentOrders = [] }) {
  const navigate = useNavigate();
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
    <Card className="bg-white/5 backdrop-blur-3xl border border-white/10 rounded-[32px] shadow-2xl relative overflow-hidden group">
      <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/5 via-purple-500/5 to-pink-500/5 pointer-events-none" />
      <div className="absolute -right-12 -top-12 w-40 h-40 bg-indigo-500/10 rounded-full blur-[60px] group-hover:bg-indigo-500/20 transition-all duration-700" />
      <div className="absolute -left-12 -bottom-12 w-40 h-40 bg-purple-500/10 rounded-full blur-[60px] group-hover:bg-purple-500/20 transition-all duration-700 delay-150" />
      
      <CardHeader className="pb-3 relative z-10">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-lg shadow-indigo-500/20">
              <ListChecks className="w-6 h-6 text-white" />
            </div>
            <div>
              <CardTitle className="text-white text-xl font-black tracking-tight">Cola de Trabajo</CardTitle>
              <p className="text-[10px] text-white/40 uppercase tracking-widest font-bold mt-0.5">
                {queueStats.total} órdenes activas
              </p>
            </div>
          </div>
          <div className="text-4xl font-black text-white/90 tracking-tighter">{queueStats.total}</div>
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
              <div key={item.label} className="bg-white/5 hover:bg-white/10 border border-white/5 hover:border-white/10 rounded-2xl p-3 flex items-center gap-3 transition-colors">
                <div className={`w-8 h-8 rounded-xl bg-gradient-to-br ${item.color} flex items-center justify-center shrink-0 shadow-lg`}>
                  <Icon className="w-4 h-4 text-white" />
                </div>
                <div className="min-w-0">
                  <p className="text-[10px] text-white/50 uppercase tracking-widest font-bold truncate">{item.label}</p>
                  <p className="text-xl font-black text-white tracking-tight">{item.value}</p>
                </div>
              </div>
            );
          })}
        </div>

        {/* Tiempo más antiguo - Clickeable */}
        {queueStats.oldest && (
          <button
            onClick={() => onSelectOrder && onSelectOrder(queueStats.oldest.id)}
            className="w-full bg-amber-500/5 hover:bg-amber-500/10 border border-amber-500/20 hover:border-amber-500/40 rounded-2xl p-4 flex items-center gap-4 transition-all active:scale-95 group"
          >
            <div className="w-10 h-10 rounded-xl bg-amber-500/10 flex items-center justify-center shrink-0">
              <TrendingUp className="w-5 h-5 text-amber-400 group-hover:scale-110 transition-transform" />
            </div>
            <div className="text-left flex-1">
              <p className="text-[10px] text-amber-400/60 uppercase tracking-widest font-black">Orden más antigua</p>
              <p className="text-white font-bold tracking-tight">{getOldestTime()} <span className="text-white/30">•</span> #{queueStats.oldest.order_number}</p>
            </div>
            <ChevronRight className="w-5 h-5 text-amber-400/50 group-hover:text-amber-400 transition-colors" />
          </button>
        )}

        {/* ⭐️ LINK AL MÓDULO DE ÓRDENES */}
        <Button
          onClick={() => navigate(createPageUrl("Orders"))}
          className="w-full bg-white/5 hover:bg-white/10 border border-white/10 text-white h-12 rounded-2xl font-bold transition-all mt-2 group"
        >
          Ver todas las órdenes
          <ArrowRight className="w-4 h-4 ml-2 text-white/50 group-hover:text-white group-hover:translate-x-1 transition-all" />
        </Button>



        {queueStats.total === 0 && (
          <div className="text-center py-8">
            <div className="w-16 h-16 rounded-full bg-white/5 flex items-center justify-center mx-auto mb-4">
              <ListChecks className="w-8 h-8 text-white/20" />
            </div>
            <p className="text-sm font-bold text-white/40 uppercase tracking-widest">No hay órdenes activas</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
