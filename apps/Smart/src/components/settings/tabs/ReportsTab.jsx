import React from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";

export default function ReportsTab({ settings, onChange }) {
  return (
    <div className="apple-type space-y-6">
      <Card className="apple-card border-0">
        <CardHeader>
          <CardTitle className="apple-text-title3 apple-label-primary">Configuración de Reportes</CardTitle>
          <CardDescription className="apple-text-subheadline apple-label-secondary">Formatos y opciones de exportación</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between p-3 bg-gray-sys6 dark:bg-gray-sys5 rounded-apple-md">
            <div>
              <Label className="apple-text-body apple-label-primary">Reportes habilitados</Label>
              <p className="apple-text-caption1 apple-label-tertiary">Activar módulo de reportes</p>
            </div>
            <Switch
              checked={settings.enabled}
              onCheckedChange={(v) => onChange({ ...settings, enabled: v })}
            />
          </div>

          <div className="flex items-center justify-between p-3 bg-gray-sys6 dark:bg-gray-sys5 rounded-apple-md">
            <div>
              <Label className="apple-text-body apple-label-primary">Email diario automático</Label>
              <p className="apple-text-caption1 apple-label-tertiary">Enviar resumen cada día</p>
            </div>
            <Switch
              checked={settings.auto_email_daily}
              onCheckedChange={(v) => onChange({ ...settings, auto_email_daily: v })}
            />
          </div>

          <div className="space-y-2">
            <Label className="apple-text-headline apple-label-primary">Formatos de exportación</Label>
            {['csv', 'xlsx', 'pdf'].map((format) => (
              <div key={format} className="flex items-center justify-between p-3 bg-gray-sys6 dark:bg-gray-sys5 rounded-apple-md">
                <Label className="apple-text-body apple-label-primary">{format}</Label>
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
