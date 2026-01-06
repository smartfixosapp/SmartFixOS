import React from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";

export default function MediaTab({ settings, onChange }) {
  return (
    <div className="space-y-6">
      <Card className="bg-zinc-900/50 border-white/10">
        <CardHeader>
          <CardTitle>Multimedia</CardTitle>
          <CardDescription>Configuración de imágenes y videos</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Tamaño máximo de subida (MB)</Label>
            <Input
              type="number"
              min="1"
              value={settings.max_upload_mb}
              onChange={(e) => onChange({ ...settings, max_upload_mb: Number(e.target.value) })}
              className="bg-black border-white/15"
            />
          </div>

          <div className="space-y-2">
            <Label>Calidad de imagen (0-1)</Label>
            <Input
              type="number"
              min="0.1"
              max="1"
              step="0.05"
              value={settings.image_quality}
              onChange={(e) => onChange({ ...settings, image_quality: Number(e.target.value) })}
              className="bg-black border-white/15"
            />
          </div>

          <div className="flex items-center justify-between p-3 bg-black/30 rounded-lg">
            <div>
              <Label>Redimensionar automáticamente</Label>
              <p className="text-xs text-gray-400">Reducir imágenes grandes</p>
            </div>
            <Switch
              checked={settings.auto_resize}
              onCheckedChange={(v) => onChange({ ...settings, auto_resize: v })}
            />
          </div>

          {settings.auto_resize && (
            <>
              <div className="space-y-2">
                <Label>Ancho máximo (px)</Label>
                <Input
                  type="number"
                  min="100"
                  value={settings.max_width}
                  onChange={(e) => onChange({ ...settings, max_width: Number(e.target.value) })}
                  className="bg-black border-white/15"
                />
              </div>

              <div className="space-y-2">
                <Label>Alto máximo (px)</Label>
                <Input
                  type="number"
                  min="100"
                  value={settings.max_height}
                  onChange={(e) => onChange({ ...settings, max_height: Number(e.target.value) })}
                  className="bg-black border-white/15"
                />
              </div>
            </>
          )}

          <div className="space-y-2">
            <Label className="text-base font-semibold">Tipos permitidos</Label>
            <div className="text-xs text-gray-400 space-y-1">
              {(settings.allowed_types || []).map((type) => (
                <div key={type} className="p-2 bg-black/30 rounded">{type}</div>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
