import React from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";

export default function MediaTab({ settings, onChange }) {
  return (
    <div className="apple-type space-y-6">
      <Card className="apple-card border-0">
        <CardHeader>
          <CardTitle className="apple-text-title3 apple-label-primary">Multimedia</CardTitle>
          <CardDescription className="apple-text-subheadline apple-label-secondary">Configuración de imágenes y videos</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label className="apple-text-footnote apple-label-secondary">Tamaño máximo de subida (MB)</Label>
            <Input
              type="number"
              min="1"
              value={settings.max_upload_mb}
              onChange={(e) => onChange({ ...settings, max_upload_mb: Number(e.target.value) })}
              className="apple-input tabular-nums"
            />
          </div>

          <div className="space-y-2">
            <Label className="apple-text-footnote apple-label-secondary">Calidad de imagen (0-1)</Label>
            <Input
              type="number"
              min="0.1"
              max="1"
              step="0.05"
              value={settings.image_quality}
              onChange={(e) => onChange({ ...settings, image_quality: Number(e.target.value) })}
              className="apple-input tabular-nums"
            />
          </div>

          <div className="flex items-center justify-between p-3 bg-gray-sys6 dark:bg-gray-sys5 rounded-apple-md">
            <div>
              <Label className="apple-text-body apple-label-primary">Redimensionar automáticamente</Label>
              <p className="apple-text-caption1 apple-label-tertiary">Reducir imágenes grandes</p>
            </div>
            <Switch
              checked={settings.auto_resize}
              onCheckedChange={(v) => onChange({ ...settings, auto_resize: v })}
            />
          </div>

          {settings.auto_resize && (
            <>
              <div className="space-y-2">
                <Label className="apple-text-footnote apple-label-secondary">Ancho máximo (px)</Label>
                <Input
                  type="number"
                  min="100"
                  value={settings.max_width}
                  onChange={(e) => onChange({ ...settings, max_width: Number(e.target.value) })}
                  className="apple-input tabular-nums"
                />
              </div>

              <div className="space-y-2">
                <Label className="apple-text-footnote apple-label-secondary">Alto máximo (px)</Label>
                <Input
                  type="number"
                  min="100"
                  value={settings.max_height}
                  onChange={(e) => onChange({ ...settings, max_height: Number(e.target.value) })}
                  className="apple-input tabular-nums"
                />
              </div>
            </>
          )}

          <div className="space-y-2">
            <Label className="apple-text-headline apple-label-primary">Tipos permitidos</Label>
            <div className="apple-text-caption1 apple-label-tertiary space-y-1">
              {(settings.allowed_types || []).map((type) => (
                <div key={type} className="p-2 bg-gray-sys6 dark:bg-gray-sys5 rounded-apple-sm">{type}</div>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
