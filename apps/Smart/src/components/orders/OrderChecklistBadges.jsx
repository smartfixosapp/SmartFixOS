import React from "react";
import { Badge } from "@/components/ui/badge";
import { ShieldCheck, Droplet, Battery, Cable, Wifi, HardDrive, AlertTriangle } from "lucide-react";

/* Mapea tus keys del wizard a iconos */
const ICONS = {
  encendido: ShieldCheck,
  mojado: Droplet,
  bateria: Battery,
  cable: Cable,
  wifi: Wifi,
  almacenamiento: HardDrive,
  otro: AlertTriangle,
};

export default function OrderChecklistBadges({ items = [], notes }) {
  if (!items.length && !notes) {
    return <div className="apple-type apple-text-subheadline apple-label-tertiary">Sin checklist.</div>;
  }

  return (
    <div className="apple-type space-y-3">
      {items.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {items.map((it, idx) => {
            const key = (it.key || it.id || it.name || `item_${idx}`).toString().toLowerCase();
            const Icon = ICONS[key] || ShieldCheck;
            const checked = it.checked === undefined ? true : !!it.checked;
            return (
              <Badge
                key={key + idx}
                className={`apple-text-caption1 px-2 py-[2px] rounded-apple-sm border-0 ${
                  checked
                    ? "bg-apple-green/15 text-apple-green"
                    : "bg-gray-sys6 dark:bg-gray-sys5 apple-label-secondary"
                }`}
              >
                <Icon className="w-3.5 h-3.5 mr-1" />
                {it.label || it.name || key}
              </Badge>
            );
          })}
        </div>
      )}

      {notes && (
        <div className="apple-text-subheadline apple-label-secondary whitespace-pre-wrap rounded-apple-md p-2 apple-surface">
          {notes}
        </div>
      )}
    </div>
  );
}
