import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";

const DEFAULT_POS = {
  require_opening_balance: true,
  warn_discrepancies: true,
  receipt_footer: "Gracias por su compra. Visítenos en 911smartfix.com",
  external_recharge_url: "",
};

export default function POSTab({ user }) {
  const [data, setData] = useState(DEFAULT_POS);
  const [originalData, setOriginalData] = useState(DEFAULT_POS);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    const onSave = () => saveData();
    const onRevert = () => setData(originalData);

    window.addEventListener("settings-save", onSave);
    window.addEventListener("settings-revert", onRevert);

    return () => {
      window.removeEventListener("settings-save", onSave);
      window.removeEventListener("settings-revert", onRevert);
    };
  }, [originalData]);

  useEffect(() => {
    const isDirty = JSON.stringify(data) !== JSON.stringify(originalData);
    if (isDirty) {
      window.dispatchEvent(new Event("settings-dirty"));
    }
  }, [data, originalData]);

  const loadData = async () => {
    try {
      const rows = await base44.entities.SystemConfig.filter({ key: "settings.pos" });
      if (rows?.length) {
        const raw = rows[0].value || rows[0].value_json;
        const parsed = typeof raw === "string" ? JSON.parse(raw) : raw;
        setData({ ...DEFAULT_POS, ...parsed });
        setOriginalData({ ...DEFAULT_POS, ...parsed });
      } else {
        setData(DEFAULT_POS);
        setOriginalData(DEFAULT_POS);
      }
    } catch (e) {
      console.error("Error loading POS:", e);
    } finally {
      setLoading(false);
    }
  };

  const saveData = async () => {
    try {
      const rows = await base44.entities.SystemConfig.filter({ key: "settings.pos" });

      const payload = {
        key: "settings.pos",
        value: JSON.stringify(data),
        category: "general",
        description: "Configuración de POS y caja"
      };

      if (rows?.length) {
        await base44.entities.SystemConfig.update(rows[0].id, payload);
      } else {
        await base44.entities.SystemConfig.create(payload);
      }

      await base44.entities.AuditLog.create({
        action: "settings_update",
        entity_type: "config",
        entity_id: "settings.pos",
        user_id: user.id,
        user_name: user.full_name || user.email,
        user_role: user.role,
        changes: { before: originalData, after: data }
      });

      setOriginalData(data);
      window.dispatchEvent(new Event("settings-clean"));
      window.dispatchEvent(new Event("force-refresh"));

      alert("Configuración guardada");
    } catch (e) {
      alert("Error al guardar: " + e.message);
    }
  };

  if (loading) return <div className="apple-type apple-label-tertiary apple-text-body">Cargando...</div>;

  return (
    <div className="apple-type space-y-6">
      <Card className="apple-card border-0">
        <CardHeader>
          <CardTitle className="apple-text-title3 apple-label-primary">Configuración de Caja</CardTitle>
          <CardDescription className="apple-text-subheadline apple-label-secondary">Reglas de apertura y cierre</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between p-3 bg-gray-sys6 dark:bg-gray-sys5 rounded-apple-md">
            <div>
              <Label className="apple-text-body apple-label-primary">Requerir fondo inicial</Label>
              <p className="apple-text-caption1 apple-label-tertiary">Obligar conteo al abrir caja</p>
            </div>
            <Switch
              checked={data.require_opening_balance}
              onCheckedChange={(v) => setData({ ...data, require_opening_balance: v })}
            />
          </div>

          <div className="flex items-center justify-between p-3 bg-gray-sys6 dark:bg-gray-sys5 rounded-apple-md">
            <div>
              <Label className="apple-text-body apple-label-primary">Advertir discrepancias</Label>
              <p className="apple-text-caption1 apple-label-tertiary">Alertar si el conteo no coincide con el esperado</p>
            </div>
            <Switch
              checked={data.warn_discrepancies}
              onCheckedChange={(v) => setData({ ...data, warn_discrepancies: v })}
            />
          </div>
        </CardContent>
      </Card>

      <Card className="apple-card border-0">
        <CardHeader>
          <CardTitle className="apple-text-title3 apple-label-primary">Recibos</CardTitle>
          <CardDescription className="apple-text-subheadline apple-label-secondary">Configuración de impresión</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label className="apple-text-footnote apple-label-secondary">Pie de recibo</Label>
            <Textarea
              value={data.receipt_footer}
              onChange={(e) => setData({ ...data, receipt_footer: e.target.value })}
              className="apple-input"
              placeholder="Gracias por su compra. Visítenos en 911smartfix.com"
              rows={3}
            />
          </div>
        </CardContent>
      </Card>

      <Card className="apple-card border-0">
        <CardHeader>
          <CardTitle className="apple-text-title3 apple-label-primary">Recarga Externa</CardTitle>
          <CardDescription className="apple-text-subheadline apple-label-secondary">Link para recargas desde proveedor externo</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label className="apple-text-footnote apple-label-secondary">URL de Recarga Externa</Label>
            <Input
              value={data.external_recharge_url || ""}
              onChange={(e) => setData({ ...data, external_recharge_url: e.target.value })}
              className="apple-input h-11"
              placeholder="https://ejemplo.com/recargas"
            />
            <p className="apple-text-caption1 apple-label-tertiary mt-1">
              Este botón aparecerá en el POS para acceder rápidamente a tu sistema de recargas
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
