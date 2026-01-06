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
    return <div className="text-sm text-gray-500">Sin checklist.</div>;
  }

  return (
    <div className="space-y-3">
      {items.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {items.map((it, idx) => {
            const key = (it.key || it.id || it.name || `item_${idx}`).toString().toLowerCase();
            const Icon = ICONS[key] || ShieldCheck;
            const checked = it.checked === undefined ? true : !!it.checked;
            return (
              <Badge
                key={key + idx}
                className={`text-[11px] px-2 py-[2px] border ${
                  checked
                    ? "bg-emerald-600/20 text-emerald-300 border-emerald-600/30"
                    : "bg-gray-600/20 text-gray-300 border-gray-600/30"
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
        <div className="text-sm text-gray-300 whitespace-pre-wrap border border-white/10 rounded p-2 bg-black/30">
          {notes}
        </div>
      )}
    </div>
  );
}
