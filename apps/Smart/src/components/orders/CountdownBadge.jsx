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

  // Estilos según urgencia y tipo (Apple HIG tinted)
  let styles, icon;

  if (countdown.type === 'warranty') {
    styles = countdown.urgent
      ? "bg-apple-red/15 text-apple-red animate-pulse"
      : countdown.warning
      ? "bg-apple-orange/15 text-apple-orange"
      : "bg-apple-yellow/15 text-apple-yellow";

    icon = countdown.urgent ? (
      <AlertTriangle className="w-3.5 h-3.5" />
    ) : (
      <Shield className="w-3.5 h-3.5" />
    );
  } else {
    styles = countdown.urgent
      ? "bg-apple-red/15 text-apple-red animate-pulse"
      : countdown.warning
      ? "bg-apple-orange/15 text-apple-orange"
      : "bg-apple-blue/15 text-apple-blue";

    icon = countdown.urgent ? (
      <AlertTriangle className="w-3.5 h-3.5" />
    ) : (
      <Clock className="w-3.5 h-3.5" />
    );
  }

  return (
    <div
      className={`apple-type inline-flex items-center gap-1.5 px-2.5 py-1 rounded-apple-sm apple-text-caption1 font-semibold tabular-nums ${styles}`}
    >
      {icon}
      <span className="tabular-nums">{countdown.days}</span>
      {countdown.type === 'pickup' && <span className="hidden sm:inline">días</span>}
      {countdown.type === 'warranty' && countdown.expired && <span className="hidden sm:inline">✓</span>}
    </div>
  );
}
