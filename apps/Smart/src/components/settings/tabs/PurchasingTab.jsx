import React from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";

export default function PurchasingTab({ settings, onChange }) {
  return (
    <div className="space-y-6">
      <Card className="bg-zinc-900/50 border-white/10">
        <CardHeader>
          <CardTitle>Configuración de Compras</CardTitle>
          <CardDescription>Órdenes de compra y proveedores</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Prefijo de PO</Label>
            <Input
              value={settings.po_prefix}
              onChange={(e) => onChange({ ...settings, po_prefix: e.target.value })}
              className="bg-black border-white/15"
            />
          </div>

          <div className="space-y-2">
            <Label>Requiere aprobación sobre</Label>
            <Input
              type="number"
              min="0"
              value={settings.require_approval_over_amount}
              onChange={(e) => onChange({ ...settings, require_approval_over_amount: Number(e.target.value) })}
              className="bg-black border-white/15"
            />
          </div>

          <div className="space-y-2">
            <Label>Términos por defecto</Label>
            <Input
              value={settings.default_terms}
              onChange={(e) => onChange({ ...settings, default_terms: e.target.value })}
              className="bg-black border-white/15"
            />
          </div>

          <div className="flex items-center justify-between p-3 bg-black/30 rounded-lg">
            <div>
              <Label>Auto-crear desde stock bajo</Label>
              <p className="text-xs text-gray-400">Generar POs automáticamente</p>
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
