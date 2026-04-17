import React from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";

export default function PurchasingTab({ settings, onChange }) {
  return (
    <div className="apple-type space-y-6">
      <Card className="apple-card border-0">
        <CardHeader>
          <CardTitle className="apple-text-title3 apple-label-primary">Configuración de Compras</CardTitle>
          <CardDescription className="apple-text-subheadline apple-label-secondary">Órdenes de compra y proveedores</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label className="apple-text-footnote apple-label-secondary">Prefijo de PO</Label>
            <Input
              value={settings.po_prefix}
              onChange={(e) => onChange({ ...settings, po_prefix: e.target.value })}
              className="apple-input"
            />
          </div>

          <div className="space-y-2">
            <Label className="apple-text-footnote apple-label-secondary">Requiere aprobación sobre</Label>
            <Input
              type="number"
              min="0"
              value={settings.require_approval_over_amount}
              onChange={(e) => onChange({ ...settings, require_approval_over_amount: Number(e.target.value) })}
              className="apple-input tabular-nums"
            />
          </div>

          <div className="space-y-2">
            <Label className="apple-text-footnote apple-label-secondary">Términos por defecto</Label>
            <Input
              value={settings.default_terms}
              onChange={(e) => onChange({ ...settings, default_terms: e.target.value })}
              className="apple-input"
            />
          </div>

          <div className="flex items-center justify-between p-3 bg-gray-sys6 dark:bg-gray-sys5 rounded-apple-md">
            <div>
              <Label className="apple-text-body apple-label-primary">Auto-crear desde stock bajo</Label>
              <p className="apple-text-caption1 apple-label-tertiary">Generar POs automáticamente</p>
            </div>
            <Switch
              checked={settings.auto_create_from_low_stock}
              onCheckedChange={(v) => onChange({ ...settings, auto_create_from_low_stock: v })}
            />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
