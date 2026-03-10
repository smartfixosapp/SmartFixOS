import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const DEFAULT_DASHBOARD = {
  enabled: true,
  allow_send_all: true,
  allow_send_specific: true,
  default_audience: "all",
  note_position: "top",
  show_kpis: true,
  show_recent_orders: true,
  show_price_list: true,
};

export default function DashboardTab({ user }) {
  const [data, setData] = useState(DEFAULT_DASHBOARD);
  const [originalData, setOriginalData] = useState(DEFAULT_DASHBOARD);
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
      const rows = await base44.entities.SystemConfig.filter({ key: "settings.dashboard" });
      if (rows?.length) {
        const raw = rows[0].value || rows[0].value_json;
        const parsed = typeof raw === "string" ? JSON.parse(raw) : raw;
        setData({ ...DEFAULT_DASHBOARD, ...parsed });
        setOriginalData({ ...DEFAULT_DASHBOARD, ...parsed });
      } else {
        setData(DEFAULT_DASHBOARD);
        setOriginalData(DEFAULT_DASHBOARD);
      }
    } catch (e) {
      console.error("Error loading dashboard settings:", e);
    } finally {
      setLoading(false);
    }
  };

  const saveData = async () => {
    try {
      const rows = await base44.entities.SystemConfig.filter({ key: "settings.dashboard" });
      
      const payload = {
        key: "settings.dashboard",
        value: JSON.stringify(data),
        category: "general",
        description: "Configuración del Dashboard"
      };

      if (rows?.length) {
        await base44.entities.SystemConfig.update(rows[0].id, payload);
      } else {
        await base44.entities.SystemConfig.create(payload);
      }

      await base44.entities.AuditLog.create({
        action: "settings_update",
        entity_type: "config",
        entity_id: "settings.dashboard",
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
      <Card className="bg-black/30 border-white/10">
        <CardHeader>
          <CardTitle className="text-white">Nota/Oferta de la Semana</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <Label className="text-gray-300">Habilitar nota del dashboard</Label>
              <p className="text-xs text-gray-500">Permitir que admins/managers publiquen notas</p>
            </div>
            <Switch
              checked={data.enabled}
              onCheckedChange={(checked) => setData({ ...data, enabled: checked })}
            />
          </div>

          <div className="flex items-center justify-between">
            <div>
              <Label className="text-gray-300">Permitir envío a todos</Label>
              <p className="text-xs text-gray-500">Permitir enviar notificaciones a todos los usuarios</p>
            </div>
            <Switch
              checked={data.allow_send_all}
              onCheckedChange={(checked) => setData({ ...data, allow_send_all: checked })}
            />
          </div>

          <div className="flex items-center justify-between">
            <div>
              <Label className="text-gray-300">Permitir envío a usuarios específicos</Label>
              <p className="text-xs text-gray-500">Permitir seleccionar destinatarios individuales</p>
            </div>
            <Switch
              checked={data.allow_send_specific}
              onCheckedChange={(checked) => setData({ ...data, allow_send_specific: checked })}
            />
          </div>

          <div>
            <Label className="text-gray-300">Audiencia por defecto</Label>
            <Select
              value={data.default_audience}
              onValueChange={(value) => setData({ ...data, default_audience: value })}
            >
              <SelectTrigger className="bg-black border-gray-700 text-white">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="none">Ninguno (selección manual)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label className="text-gray-300">Posición de la nota</Label>
            <Select
              value={data.note_position}
              onValueChange={(value) => setData({ ...data, note_position: value })}
            >
              <SelectTrigger className="bg-black border-gray-700 text-white">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="top">Arriba (prioridad)</SelectItem>
                <SelectItem value="bottom">Abajo</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <Card className="bg-black/30 border-white/10">
        <CardHeader>
          <CardTitle className="text-white">Componentes del Dashboard</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <Label className="text-gray-300">Mostrar KPIs (ventas, órdenes, etc.)</Label>
            <Switch
              checked={data.show_kpis}
              onCheckedChange={(checked) => setData({ ...data, show_kpis: checked })}
            />
          </div>

          <div className="flex items-center justify-between">
            <Label className="text-gray-300">Mostrar órdenes recientes</Label>
            <Switch
              checked={data.show_recent_orders}
              onCheckedChange={(checked) => setData({ ...data, show_recent_orders: checked })}
            />
          </div>

          <div className="flex items-center justify-between">
            <Label className="text-gray-300">Mostrar lista de precios</Label>
            <Switch
              checked={data.show_price_list}
              onCheckedChange={(checked) => setData({ ...data, show_price_list: checked })}
            />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
