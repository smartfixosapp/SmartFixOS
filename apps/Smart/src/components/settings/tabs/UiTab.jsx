import React from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";

export default function UiTab({ settings, onChange }) {
  return (
    <div className="apple-type space-y-6">
      <Card className="apple-card border-0">
        <CardHeader>
          <CardTitle className="apple-text-title2 apple-label-primary">Tema y Apariencia</CardTitle>
          <CardDescription className="apple-text-subheadline apple-label-secondary">Personaliza la apariencia de la interfaz</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label className="apple-text-footnote apple-label-secondary">Tema</Label>
            <Select value={settings.theme} onValueChange={(v) => onChange({ ...settings, theme: v })}>
              <SelectTrigger className="apple-input">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="dark">Oscuro</SelectItem>
                <SelectItem value="light">Claro</SelectItem>
                <SelectItem value="system">Sistema</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label className="apple-text-footnote apple-label-secondary">Color de acento</Label>
            <Input
              type="color"
              value={settings.accent_color}
              onChange={(e) => onChange({ ...settings, accent_color: e.target.value })}
              className="apple-input h-10" />

          </div>

          <div className="space-y-2">
            <Label className="apple-text-footnote apple-label-secondary">Densidad</Label>
            <Select value={settings.density} onValueChange={(v) => onChange({ ...settings, density: v })}>
              <SelectTrigger className="apple-input">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="compact">Compacto</SelectItem>
                <SelectItem value="comfortable">Confortable</SelectItem>
                <SelectItem value="spacious">Espacioso</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center justify-between p-3 bg-gray-sys6 dark:bg-gray-sys5 rounded-apple-md">
            <div>
              <Label className="apple-text-body apple-label-primary">Animaciones</Label>
              <p className="apple-text-caption1 apple-label-tertiary">Habilitar transiciones y efectos</p>
            </div>
            <Switch
              checked={settings.animations?.enabled}
              onCheckedChange={(v) => onChange({ ...settings, animations: { ...settings.animations, enabled: v } })} />

          </div>
        </CardContent>
      </Card>
    </div>);

}
