import React from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";

export default function TenancyTab({ settings, onChange }) {
  return (
    <div className="apple-type space-y-6">
      <Card className="apple-card border-0">
        <CardHeader>
          <CardTitle className="apple-text-title3 apple-label-primary">Multi-tenancy</CardTitle>
          <CardDescription className="apple-text-subheadline apple-label-secondary">Configuración de múltiples inquilinos</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label className="apple-text-footnote apple-label-secondary">Modo</Label>
            <Select
              value={settings.mode}
              onValueChange={(v) => onChange({ ...settings, mode: v })}
            >
              <SelectTrigger className="apple-input">
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
                <Label className="apple-text-footnote apple-label-secondary">Nivel de aislamiento</Label>
                <Select
                  value={settings.isolation}
                  onValueChange={(v) => onChange({ ...settings, isolation: v })}
                >
                  <SelectTrigger className="apple-input">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="strict">Estricto</SelectItem>
                    <SelectItem value="soft">Suave</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="flex items-center justify-between p-3 bg-gray-sys6 dark:bg-gray-sys5 rounded-apple-md">
                <div>
                  <Label className="apple-text-body apple-label-primary">Permitir acceso entre inquilinos</Label>
                  <p className="apple-text-caption1 apple-label-tertiary">Compartir datos entre tenants</p>
                </div>
                <Switch
                  checked={settings.allow_cross_tenant}
                  onCheckedChange={(v) => onChange({ ...settings, allow_cross_tenant: v })}
                />
              </div>

              <div className="space-y-2">
                <Label className="apple-text-footnote apple-label-secondary">Inquilino por defecto</Label>
                <Input
                  value={settings.default_tenant}
                  onChange={(e) => onChange({ ...settings, default_tenant: e.target.value })}
                  className="apple-input"
                />
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
