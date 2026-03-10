import React from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";

export default function ReportsTab({ settings, onChange }) {
  return (
    <div className="space-y-6">
      <Card className="bg-zinc-900/50 border-white/10">
        <CardHeader>
          <CardTitle>Configuración de Reportes</CardTitle>
          <CardDescription>Formatos y opciones de exportación</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between p-3 bg-black/30 rounded-lg">
            <div>
              <Label>Reportes habilitados</Label>
              <p className="text-xs text-gray-400">Activar módulo de reportes</p>
            </div>
            <Switch
              checked={settings.enabled}
              onCheckedChange={(v) => onChange({ ...settings, enabled: v })}
            />
          </div>

          <div className="flex items-center justify-between p-3 bg-black/30 rounded-lg">
            <div>
              <Label>Email diario automático</Label>
              <p className="text-xs text-gray-400">Enviar resumen cada día</p>
            </div>
            <Switch
              checked={settings.auto_email_daily}
              onCheckedChange={(v) => onChange({ ...settings, auto_email_daily: v })}
            />
          </div>

          <div className="space-y-2">
            <Label className="text-base font-semibold">Formatos de exportación</Label>
            {['csv', 'xlsx', 'pdf'].map((format) => (
              <div key={format} className="flex items-center justify-between p-3 bg-black/30 rounded-lg">
                <Label className="uppercase">{format}</Label>
                <Switch
                  checked={settings.export_formats?.includes(format)}
                  onCheckedChange={(v) => {
                    const formats = settings.export_formats || [];
                    onChange({
                      ...settings,
                      export_formats: v
                        ? [...formats, format]
                        : formats.filter(f => f !== format)
                    });
                  }}
                />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
