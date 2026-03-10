import React from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";

export default function UiTab({ settings, onChange }) {
  return (
    <div className="space-y-6">
      <Card className="bg-zinc-900/50 border-white/10">
        <CardHeader>
          <CardTitle className="text-slate-50 text-2xl font-semibold tracking-tight leading-none">Tema y Apariencia</CardTitle>
          <CardDescription>Personaliza la apariencia de la interfaz</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Tema</Label>
            <Select value={settings.theme} onValueChange={(v) => onChange({ ...settings, theme: v })}>
              <SelectTrigger className="bg-black text-slate-50 px-3 py-2 text-sm rounded-md flex h-10 w-full items-center justify-between border ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring disabled:cursor-not-allowed disabled:opacity-50 [&>span]:line-clamp-1 border-white/15">
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
            <Label>Color de acento</Label>
            <Input
              type="color"
              value={settings.accent_color}
              onChange={(e) => onChange({ ...settings, accent_color: e.target.value })}
              className="h-10" />

          </div>

          <div className="space-y-2">
            <Label>Densidad</Label>
            <Select value={settings.density} onValueChange={(v) => onChange({ ...settings, density: v })}>
              <SelectTrigger className="bg-black text-slate-50 px-3 py-2 text-sm rounded-md flex h-10 w-full items-center justify-between border ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring disabled:cursor-not-allowed disabled:opacity-50 [&>span]:line-clamp-1 border-white/15">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="compact">Compacto</SelectItem>
                <SelectItem value="comfortable">Confortable</SelectItem>
                <SelectItem value="spacious">Espacioso</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center justify-between p-3 bg-black/30 rounded-lg">
            <div>
              <Label className="text-slate-50 text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">Animaciones</Label>
              <p className="text-xs text-gray-400">Habilitar transiciones y efectos</p>
            </div>
            <Switch
              checked={settings.animations?.enabled}
              onCheckedChange={(v) => onChange({ ...settings, animations: { ...settings.animations, enabled: v } })} />

          </div>
        </CardContent>
      </Card>
    </div>);

}
