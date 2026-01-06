import React from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export default function PrintingTab({ settings, onChange }) {
  return (
    <div className="space-y-6">
      <Card className="bg-zinc-900/50 border-white/10">
        <CardHeader>
          <CardTitle>Configuración de Impresión</CardTitle>
          <CardDescription>Plantillas y opciones de impresión</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Plantilla de ticket</Label>
            <Select
              value={settings.templates?.workorder_ticket}
              onValueChange={(v) => onChange({
                ...settings,
                templates: { ...settings.templates, workorder_ticket: v }
              })}
            >
              <SelectTrigger className="bg-black border-white/15">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="default">Por defecto</SelectItem>
                <SelectItem value="compact">Compacto</SelectItem>
                <SelectItem value="detailed">Detallado</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Tamaño de etiqueta</Label>
            <Select
              value={settings.label_size}
              onValueChange={(v) => onChange({ ...settings, label_size: v })}
            >
              <SelectTrigger className="bg-black border-white/15">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="4x6">4x6</SelectItem>
                <SelectItem value="4x4">4x4</SelectItem>
                <SelectItem value="thermal">Térmica</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-3">
            <Label className="text-base font-semibold">Opciones de impresión</Label>
            {[
              { key: 'show_logo', label: 'Mostrar logo' },
              { key: 'show_qr', label: 'Mostrar código QR' },
              { key: 'show_barcode', label: 'Mostrar código de barras' },
              { key: 'show_photos', label: 'Incluir fotos' },
            ].map(({ key, label }) => (
              <div key={key} className="flex items-center justify-between p-3 bg-black/30 rounded-lg">
                <Label>{label}</Label>
                <Switch
                  checked={settings.options?.[key]}
                  onCheckedChange={(v) => onChange({
                    ...settings,
                    options: { ...settings.options, [key]: v }
                  })}
                />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
