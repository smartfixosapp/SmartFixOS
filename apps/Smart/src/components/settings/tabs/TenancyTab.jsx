import React from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";

export default function TenancyTab({ settings, onChange }) {
  return (
    <div className="space-y-6">
      <Card className="bg-zinc-900/50 border-white/10">
        <CardHeader>
          <CardTitle>Multi-tenancy</CardTitle>
          <CardDescription>Configuración de múltiples inquilinos</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Modo</Label>
            <Select
              value={settings.mode}
              onValueChange={(v) => onChange({ ...settings, mode: v })}
            >
              <SelectTrigger className="bg-black border-white/15">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="single">Single (un solo inquilino)</SelectItem>
                <SelectItem value="multi">Multi (múltiples inquilinos)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {settings.mode === "multi" && (
            <>
              <div className="space-y-2">
                <Label>Nivel de aislamiento</Label>
                <Select
                  value={settings.isolation}
                  onValueChange={(v) => onChange({ ...settings, isolation: v })}
                >
                  <SelectTrigger className="bg-black border-white/15">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="strict">Estricto</SelectItem>
                    <SelectItem value="soft">Suave</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="flex items-center justify-between p-3 bg-black/30 rounded-lg">
                <div>
                  <Label>Permitir acceso entre inquilinos</Label>
                  <p className="text-xs text-gray-400">Compartir datos entre tenants</p>
                </div>
                <Switch
                  checked={settings.allow_cross_tenant}
                  onCheckedChange={(v) => onChange({ ...settings, allow_cross_tenant: v })}
                />
              </div>

              <div className="space-y-2">
                <Label>Inquilino por defecto</Label>
                <Input
                  value={settings.default_tenant}
                  onChange={(e) => onChange({ ...settings, default_tenant: e.target.value })}
                  className="bg-black border-white/15"
                />
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
