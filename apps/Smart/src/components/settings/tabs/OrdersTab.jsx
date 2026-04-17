import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";

const DEFAULT_ORDERS = {
  device_catalog_wizard: true,
  brand_family_flow: true,
  signature_precision_lock: true,
  always_show_pattern: true,
  order_summary_part_suggestions: true,
  wizard_summary_readonly: true,
};

export default function OrdersTab({ user }) {
  const [data, setData] = useState(DEFAULT_ORDERS);
  const [originalData, setOriginalData] = useState(DEFAULT_ORDERS);
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
      const rows = await base44.entities.SystemConfig.filter({ key: "settings.orders" });
      if (rows?.length) {
        const raw = rows[0].value || rows[0].value_json;
        const parsed = typeof raw === "string" ? JSON.parse(raw) : raw;
        setData({ ...DEFAULT_ORDERS, ...parsed });
        setOriginalData({ ...DEFAULT_ORDERS, ...parsed });
      } else {
        setData(DEFAULT_ORDERS);
        setOriginalData(DEFAULT_ORDERS);
      }
    } catch (e) {
      console.error("Error loading orders settings:", e);
    } finally {
      setLoading(false);
    }
  };

  const saveData = async () => {
    try {
      const rows = await base44.entities.SystemConfig.filter({ key: "settings.orders" });

      const payload = {
        key: "settings.orders",
        value: JSON.stringify(data),
        category: "general",
        description: "Configuración de órdenes y wizard"
      };

      if (rows?.length) {
        await base44.entities.SystemConfig.update(rows[0].id, payload);
      } else {
        await base44.entities.SystemConfig.create(payload);
      }

      await base44.entities.AuditLog.create({
        action: "settings_update",
        entity_type: "config",
        entity_id: "settings.orders",
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
          <CardTitle className="apple-text-title3 apple-label-primary">Work Order Wizard</CardTitle>
          <CardDescription className="apple-text-subheadline apple-label-secondary">Configuración del asistente de creación de órdenes</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between p-3 bg-gray-sys6 dark:bg-gray-sys5 rounded-apple-md">
            <div>
              <Label className="apple-text-body apple-label-primary">Usar catálogo de dispositivos</Label>
              <p className="apple-text-caption1 apple-label-tertiary">Selección rápida de modelos desde catálogo</p>
            </div>
            <Switch
              checked={data.device_catalog_wizard}
              onCheckedChange={(v) => setData({ ...data, device_catalog_wizard: v })}
            />
          </div>

          <div className="flex items-center justify-between p-3 bg-gray-sys6 dark:bg-gray-sys5 rounded-apple-md">
            <div>
              <Label className="apple-text-body apple-label-primary">Flujo Brand → Familia → Modelo</Label>
              <p className="apple-text-caption1 apple-label-tertiary">Organización jerárquica (Apple → iPhone → 14 Pro)</p>
            </div>
            <Switch
              checked={data.brand_family_flow}
              onCheckedChange={(v) => setData({ ...data, brand_family_flow: v })}
            />
          </div>

          <div className="flex items-center justify-between p-3 bg-gray-sys6 dark:bg-gray-sys5 rounded-apple-md">
            <div>
              <Label className="apple-text-body apple-label-primary">Firma de alta precisión</Label>
              <p className="apple-text-caption1 apple-label-tertiary">Bloqueo de pantalla y canvas de alta resolución</p>
            </div>
            <Switch
              checked={data.signature_precision_lock}
              onCheckedChange={(v) => setData({ ...data, signature_precision_lock: v })}
            />
          </div>

          <div className="flex items-center justify-between p-3 bg-gray-sys6 dark:bg-gray-sys5 rounded-apple-md">
            <div>
              <Label className="apple-text-body apple-label-primary">Patrón siempre visible</Label>
              <p className="apple-text-caption1 apple-label-tertiary">Mostrar patrón Android por defecto</p>
            </div>
            <Switch
              checked={data.always_show_pattern}
              onCheckedChange={(v) => setData({ ...data, always_show_pattern: v })}
            />
          </div>

          <div className="flex items-center justify-between p-3 bg-gray-sys6 dark:bg-gray-sys5 rounded-apple-md">
            <div>
              <Label className="apple-text-body apple-label-primary">Sugerencias de piezas en resumen</Label>
              <p className="apple-text-caption1 apple-label-tertiary">Mostrar piezas compatibles según modelo</p>
            </div>
            <Switch
              checked={data.order_summary_part_suggestions}
              onCheckedChange={(v) => setData({ ...data, order_summary_part_suggestions: v })}
            />
          </div>

          <div className="flex items-center justify-between p-3 bg-gray-sys6 dark:bg-gray-sys5 rounded-apple-md">
            <div>
              <Label className="apple-text-body apple-label-primary">Resumen de solo lectura</Label>
              <p className="apple-text-caption1 apple-label-tertiary">Deshabilitar edición en paso final</p>
            </div>
            <Switch
              checked={data.wizard_summary_readonly}
              onCheckedChange={(v) => setData({ ...data, wizard_summary_readonly: v })}
            />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
