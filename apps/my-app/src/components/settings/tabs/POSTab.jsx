import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";

const DEFAULT_POS = {
  require_opening_balance: true,
  warn_discrepancies: true,
  receipt_footer: "Gracias por su compra. Visítenos en 911smartfix.com",
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

  if (loading) return <div className="text-gray-400">Cargando...</div>;

  return (
    <div className="space-y-6">
      <Card className="bg-zinc-900/50 border-white/10">
        <CardHeader>
          <CardTitle>Configuración de Caja</CardTitle>
          <CardDescription>Reglas de apertura y cierre</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between p-3 bg-black/30 rounded-lg">
            <div>
              <Label>Requerir fondo inicial</Label>
              <p className="text-xs text-gray-400">Obligar conteo al abrir caja</p>
            </div>
            <Switch
              checked={data.require_opening_balance}
              onCheckedChange={(v) => setData({ ...data, require_opening_balance: v })}
            />
          </div>

          <div className="flex items-center justify-between p-3 bg-black/30 rounded-lg">
            <div>
              <Label>Advertir discrepancias</Label>
              <p className="text-xs text-gray-400">Alertar si el conteo no coincide con el esperado</p>
            </div>
            <Switch
              checked={data.warn_discrepancies}
              onCheckedChange={(v) => setData({ ...data, warn_discrepancies: v })}
            />
          </div>
        </CardContent>
      </Card>

      <Card className="bg-zinc-900/50 border-white/10">
        <CardHeader>
          <CardTitle>Recibos</CardTitle>
          <CardDescription>Configuración de impresión</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Pie de recibo</Label>
            <Textarea
              value={data.receipt_footer}
              onChange={(e) => setData({ ...data, receipt_footer: e.target.value })}
              className="bg-black border-white/15"
              placeholder="Gracias por su compra. Visítenos en 911smartfix.com"
              rows={3}
            />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
