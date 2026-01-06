import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";

const DEFAULT_INVENTORY = {
  low_stock_threshold: 5,
  allow_negative_stock: false,
  stock_alerts: { enabled: true },
  track_serials: true,
};

export default function InventoryTab({ user }) {
  const [data, setData] = useState(DEFAULT_INVENTORY);
  const [originalData, setOriginalData] = useState(DEFAULT_INVENTORY);
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
      const rows = await base44.entities.SystemConfig.filter({ key: "settings.inventory" });
      if (rows?.length) {
        const raw = rows[0].value || rows[0].value_json;
        const parsed = typeof raw === "string" ? JSON.parse(raw) : raw;
        setData({ ...DEFAULT_INVENTORY, ...parsed });
        setOriginalData({ ...DEFAULT_INVENTORY, ...parsed });
      } else {
        setData(DEFAULT_INVENTORY);
        setOriginalData(DEFAULT_INVENTORY);
      }
    } catch (e) {
      console.error("Error loading inventory:", e);
    } finally {
      setLoading(false);
    }
  };

  const saveData = async () => {
    try {
      const rows = await base44.entities.SystemConfig.filter({ key: "settings.inventory" });
      
      const payload = {
        key: "settings.inventory",
        value: JSON.stringify(data),
        category: "general",
        description: "Configuración de inventario"
      };

      if (rows?.length) {
        await base44.entities.SystemConfig.update(rows[0].id, payload);
      } else {
        await base44.entities.SystemConfig.create(payload);
      }

      await base44.entities.AuditLog.create({
        action: "settings_update",
        entity_type: "config",
        entity_id: "settings.inventory",
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
          <CardTitle>Configuración de Inventario</CardTitle>
          <CardDescription>Gestión de stock y productos</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Umbral de stock bajo</Label>
            <Input
              type="number"
              min="0"
              value={data.low_stock_threshold}
              onChange={(e) => setData({ ...data, low_stock_threshold: Number(e.target.value) })}
              className="bg-black border-white/15"
            />
          </div>

          <div className="flex items-center justify-between p-3 bg-black/30 rounded-lg">
            <div>
              <Label>Permitir stock negativo</Label>
              <p className="text-xs text-gray-400">Vender sin inventario disponible</p>
            </div>
            <Switch
              checked={data.allow_negative_stock}
              onCheckedChange={(v) => setData({ ...data, allow_negative_stock: v })}
            />
          </div>

          <div className="flex items-center justify-between p-3 bg-black/30 rounded-lg">
            <div>
              <Label>Alertas de stock bajo</Label>
              <p className="text-xs text-gray-400">Notificar cuando hay poco stock</p>
            </div>
            <Switch
              checked={data.stock_alerts?.enabled}
              onCheckedChange={(v) => setData({
                ...data,
                stock_alerts: { ...data.stock_alerts, enabled: v }
              })}
            />
          </div>

          <div className="flex items-center justify-between p-3 bg-black/30 rounded-lg">
            <div>
              <Label>Rastrear seriales</Label>
              <p className="text-xs text-gray-400">Llevar control de números de serie</p>
            </div>
            <Switch
              checked={data.track_serials}
              onCheckedChange={(v) => setData({ ...data, track_serials: v })}
            />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
