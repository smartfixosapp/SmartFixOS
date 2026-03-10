import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";

const DEFAULT_SECURITY = {
  pin_length: 4,
  pin_max_attempts: 3,
  pin_lockout_duration: 300,
  pin_expiration_days: 0,
  require_pin_for_delete_order: true,
  require_pin_for_delete_note: false,
  require_pin_for_refund: true,
  require_pin_for_void_sale: true,
  enable_audit_log: true,
  audit_retention_days: 365,
};

export default function SecurityTab({ user }) {
  const [data, setData] = useState(DEFAULT_SECURITY);
  const [originalData, setOriginalData] = useState(DEFAULT_SECURITY);
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
      const rows = await base44.entities.SystemConfig.filter({ key: "settings.security" });
      if (rows?.length) {
        const raw = rows[0].value || rows[0].value_json;
        const parsed = typeof raw === "string" ? JSON.parse(raw) : raw;
        setData({ ...DEFAULT_SECURITY, ...parsed });
        setOriginalData({ ...DEFAULT_SECURITY, ...parsed });
      } else {
        setData(DEFAULT_SECURITY);
        setOriginalData(DEFAULT_SECURITY);
      }
    } catch (e) {
      console.error("Error loading security:", e);
    } finally {
      setLoading(false);
    }
  };

  const saveData = async () => {
    try {
      const rows = await base44.entities.SystemConfig.filter({ key: "settings.security" });
      
      const payload = {
        key: "settings.security",
        value: JSON.stringify(data),
        category: "general",
        description: "Configuración de seguridad"
      };

      if (rows?.length) {
        await base44.entities.SystemConfig.update(rows[0].id, payload);
      } else {
        await base44.entities.SystemConfig.create(payload);
      }

      await base44.entities.AuditLog.create({
        action: "settings_update",
        entity_type: "config",
        entity_id: "settings.security",
        user_id: user.id,
        user_name: user.full_name || user.email,
        user_role: user.role,
        changes: { before: originalData, after: data }
      });

      setOriginalData(data);
      window.dispatchEvent(new Event("settings-clean"));
      window.dispatchEvent(new Event("force-refresh"));
      
      alert("Configuración de seguridad guardada");
    } catch (e) {
      alert("Error al guardar: " + e.message);
    }
  };

  if (loading) return <div className="text-gray-400">Cargando...</div>;

  return (
    <div className="space-y-6">
      <Card className="bg-black/30 border-white/10">
        <CardHeader>
          <CardTitle className="text-white">Política de PIN</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label className="text-gray-300">Longitud de PIN</Label>
            <Input
              type="number"
              min="4"
              max="8"
              value={data.pin_length}
              onChange={(e) => setData({ ...data, pin_length: Number(e.target.value) })}
              className="bg-black border-gray-700 text-white"
            />
            <p className="text-xs text-gray-500 mt-1">Entre 4 y 8 dígitos</p>
          </div>

          <div>
            <Label className="text-gray-300">Intentos máximos antes de bloqueo</Label>
            <Input
              type="number"
              min="1"
              max="10"
              value={data.pin_max_attempts}
              onChange={(e) => setData({ ...data, pin_max_attempts: Number(e.target.value) })}
              className="bg-black border-gray-700 text-white"
            />
          </div>

          <div>
            <Label className="text-gray-300">Duración del bloqueo (segundos)</Label>
            <Input
              type="number"
              min="60"
              step="60"
              value={data.pin_lockout_duration}
              onChange={(e) => setData({ ...data, pin_lockout_duration: Number(e.target.value) })}
              className="bg-black border-gray-700 text-white"
            />
            <p className="text-xs text-gray-500 mt-1">{Math.floor(data.pin_lockout_duration / 60)} minutos</p>
          </div>

          <div>
            <Label className="text-gray-300">Expiración de PIN (días)</Label>
            <Input
              type="number"
              min="0"
              value={data.pin_expiration_days}
              onChange={(e) => setData({ ...data, pin_expiration_days: Number(e.target.value) })}
              className="bg-black border-gray-700 text-white"
            />
            <p className="text-xs text-gray-500 mt-1">0 = nunca expira</p>
          </div>
        </CardContent>
      </Card>

      <Card className="bg-black/30 border-white/10">
        <CardHeader>
          <CardTitle className="text-white">Requerir PIN para acciones críticas</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between p-3 bg-black/30 rounded-lg">
            <div>
              <Label className="text-gray-300">Eliminar orden</Label>
              <p className="text-xs text-gray-500">Requerir PIN de admin para borrar órdenes</p>
            </div>
            <Switch
              checked={data.require_pin_for_delete_order}
              onCheckedChange={(v) => setData({ ...data, require_pin_for_delete_order: v })}
            />
          </div>

          <div className="flex items-center justify-between p-3 bg-black/30 rounded-lg">
            <div>
              <Label className="text-gray-300">Eliminar nota del dashboard</Label>
              <p className="text-xs text-gray-500">Requerir PIN para borrar notas</p>
            </div>
            <Switch
              checked={data.require_pin_for_delete_note}
              onCheckedChange={(v) => setData({ ...data, require_pin_for_delete_note: v })}
            />
          </div>

          <div className="flex items-center justify-between p-3 bg-black/30 rounded-lg">
            <div>
              <Label className="text-gray-300">Procesar reembolsos</Label>
              <p className="text-xs text-gray-500">Requerir PIN para emitir refunds</p>
            </div>
            <Switch
              checked={data.require_pin_for_refund}
              onCheckedChange={(v) => setData({ ...data, require_pin_for_refund: v })}
            />
          </div>

          <div className="flex items-center justify-between p-3 bg-black/30 rounded-lg">
            <div>
              <Label className="text-gray-300">Anular ventas</Label>
              <p className="text-xs text-gray-500">Requerir PIN para void sales</p>
            </div>
            <Switch
              checked={data.require_pin_for_void_sale}
              onCheckedChange={(v) => setData({ ...data, require_pin_for_void_sale: v })}
            />
          </div>
        </CardContent>
      </Card>

      <Card className="bg-black/30 border-white/10">
        <CardHeader>
          <CardTitle className="text-white">Auditoría y Logs</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between p-3 bg-black/30 rounded-lg">
            <div>
              <Label className="text-gray-300">Habilitar registro de auditoría</Label>
              <p className="text-xs text-gray-500">Registrar todos los cambios importantes</p>
            </div>
            <Switch
              checked={data.enable_audit_log}
              onCheckedChange={(v) => setData({ ...data, enable_audit_log: v })}
            />
          </div>

          <div>
            <Label className="text-gray-300">Retención de logs (días)</Label>
            <Input
              type="number"
              min="30"
              value={data.audit_retention_days}
              onChange={(e) => setData({ ...data, audit_retention_days: Number(e.target.value) })}
              className="bg-black border-gray-700 text-white"
            />
            <p className="text-xs text-gray-500 mt-1">Mínimo 30 días recomendado</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
