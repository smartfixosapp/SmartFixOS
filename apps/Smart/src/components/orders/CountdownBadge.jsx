import React, { useMemo } from "react";
import { Clock, AlertTriangle, Shield } from "lucide-react";

export default function CountdownBadge({ order }) {
  const countdown = useMemo(() => {
    // Contador de Garantía (Mostrar incluso si status es warranty)
    if (order.warranty_countdown?.days_remaining !== undefined) {
      const days = order.warranty_countdown.days_remaining;
      return {
        type: 'warranty',
        days,
        label: `${days} días de garantía`,
        urgent: days <= 3,
        warning: days <= 7 && days > 3,
        expired: days === 0
      };
    }

    // Contador de Pickup (Listo para recoger)
    if (order.status === 'ready_for_pickup' && order.pickup_countdown?.days_remaining !== undefined) {
      const days = order.pickup_countdown.days_remaining;
      return {
        type: 'pickup',
        days,
        label: `${days} días para recoger`,
        urgent: days <= 3,
        warning: days <= 7 && days > 3
      };
    }

    return null;
  }, [order]);

  if (!countdown) return null;

  // Estilos según urgencia y tipo
  let styles, icon;
  
  if (countdown.type === 'warranty') {
    styles = countdown.urgent
      ? "bg-red-500/20 border-red-500/40 text-red-400 animate-pulse"
      : countdown.warning
      ? "bg-orange-500/20 border-orange-500/40 text-orange-400"
      : "bg-amber-500/20 border-amber-500/40 text-amber-400";
    
    icon = countdown.urgent ? (
      <AlertTriangle className="w-3.5 h-3.5" />
    ) : (
      <Shield className="w-3.5 h-3.5" />
    );
  } else {
    styles = countdown.urgent
      ? "bg-red-500/20 border-red-500/40 text-red-400 animate-pulse"
      : countdown.warning
      ? "bg-orange-500/20 border-orange-500/40 text-orange-400"
      : "bg-cyan-500/20 border-cyan-500/40 text-cyan-400";
    
    icon = countdown.urgent ? (
      <AlertTriangle className="w-3.5 h-3.5" />
    ) : (
      <Clock className="w-3.5 h-3.5" />
    );
  }

  return (
    <div
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold border ${styles}`}
    >
      {icon}
      <span>{countdown.days}</span>
      {countdown.type === 'pickup' && <span className="hidden sm:inline">días</span>}
      {countdown.type === 'warranty' && countdown.expired && <span className="hidden sm:inline">✓</span>}
    </div>
  );
}
