import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Smartphone } from "lucide-react";

export default function DeviceSection({ order }) {
  // 👈 E) Soporte para modelos sin ícono
  const catalogDevice = order.custom_fields?.catalog_device;
  const modelLabel = catalogDevice?.model?.label || order.device_model;
  let iconUrl = catalogDevice?.icon_url || catalogDevice?.model?.icon_url;
  
  // Placeholder si no hay ícono
  if (!iconUrl) {
    iconUrl = `data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='96' height='96' viewBox='0 0 24 24' fill='none' stroke='%23666' stroke-width='2'%3E%3Crect x='5' y='2' width='14' height='20' rx='2' /%3E%3Cpath d='M12 18h.01'/%3E%3C/svg%3E`;
  }

  return (
    <Card className="bg-gray-900 border-gray-800">
      <CardHeader>
        <CardTitle className="text-white flex items-center gap-2">
          <Smartphone className="w-5 h-5" />
          Información del Equipo
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex justify-center py-4">
          <img
            src={iconUrl}
            alt="Device"
            loading="lazy"
            decoding="async"
            className="w-24 h-24 object-contain"
            onError={(e) => {
              // Fallback final
              e.target.src = `data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='96' height='96' viewBox='0 0 24 24' fill='none' stroke='%23666' stroke-width='2'%3E%3Crect x='5' y='2' width='14' height='20' rx='2' /%3E%3Cpath d='M12 18h.01'/%3E%3C/svg%3E`;
            }}
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-sm text-gray-400">Marca</label>
            <p className="text-white">{order.device_brand || "—"}</p>
          </div>

          <div>
            <label className="text-sm text-gray-400">Tipo</label>
            <p className="text-white">{order.device_type || order.device_subcategory || "—"}</p>
          </div>

          <div>
            <label className="text-sm text-gray-400">Familia</label>
            <p className="text-white">{order.device_family || "—"}</p>
          </div>

          <div>
            <label className="text-sm text-gray-400">Modelo</label>
            <p className="text-white font-semibold">{modelLabel || "—"}</p>
          </div>
        </div>

        {order.device_serial && (
          <div className="pt-4 border-t border-gray-800">
            <label className="text-sm text-gray-400">Serial / IMEI</label>
            <p className="text-white font-mono">{order.device_serial}</p>
          </div>
        )}

        {catalogDevice?.series && (
          <div className="pt-2">
            <label className="text-sm text-gray-400">Serie</label>
            <p className="text-gray-300">{catalogDevice.series.label || catalogDevice.series.name}</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
