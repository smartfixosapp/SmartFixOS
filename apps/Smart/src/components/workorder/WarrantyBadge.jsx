import React, { useMemo } from "react";
import { Shield, AlertTriangle, Clock } from "lucide-react";

export default function WarrantyBadge({ order }) {
  const warranty = useMemo(() => {
    // Mostrar garantía si el status es "warranty" O si hay warranty_countdown activo
    const hasWarrantyStatus = order?.status === 'warranty';
    const hasWarrantyCountdown = order?.warranty_countdown?.days_remaining !== undefined;
    
    if (!hasWarrantyStatus && !hasWarrantyCountdown) return null;

    const days = order?.warranty_countdown?.days_remaining ?? 30;
    
    return {
      days,
      label: `${days} días`,
      urgent: days <= 3,
      warning: days <= 7 && days > 3,
      expired: days === 0
    };
  }, [order]);

  if (!warranty) return null;

  const styles = warranty.urgent
    ? "bg-red-500/20 border-red-500/40 text-red-400 animate-pulse"
    : warranty.warning
    ? "bg-orange-500/20 border-orange-500/40 text-orange-400"
    : "bg-amber-500/20 border-amber-500/40 text-amber-400";

  const icon = warranty.urgent ? (
    <AlertTriangle className="w-4 h-4" />
  ) : (
    <Shield className="w-4 h-4" />
  );

  return (
    <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-bold border ${styles}`}>
      {icon}
      <span>Garantía</span>
      <span className="font-bold">{warranty.days}d</span>
    </div>
  );
}
