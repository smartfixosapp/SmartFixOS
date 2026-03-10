import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Zap, AlertTriangle, Database, Code } from "lucide-react";

const DEFAULT_ADVANCED = {
  enable_debug_mode: false,
  cache_duration_seconds: 180,
  max_upload_size_mb: 10,
  session_timeout_minutes: 480,
  enable_analytics: true,
  enable_error_reporting: true,
  api_rate_limit: 100,
  maintenance_mode: false
};

export default function AdvancedTab({ user }) {
  const [data, setData] = useState(DEFAULT_ADVANCED);
  const [originalData, setOriginalData] = useState(DEFAULT_ADVANCED);
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
      const rows = await base44.entities.SystemConfig.filter({ key: "settings.advanced" });
      if (rows?.length) {
        const raw = rows[0].value || rows[0].value_json;
        const parsed = typeof raw === "string" ? JSON.parse(raw) : raw;
        setData({ ...DEFAULT_ADVANCED, ...parsed });
        setOriginalData({ ...DEFAULT_ADVANCED, ...parsed });
      } else {
        setData(DEFAULT_ADVANCED);
        setOriginalData(DEFAULT_ADVANCED);
      }
    } catch (e) {
      console.error("Error loading advanced settings:", e);
    } finally {
      setLoading(false);
    }
  };

  const saveData = async () => {
    try {
      const rows = await base44.entities.SystemConfig.filter({ key: "settings.advanced" });
      
      const payload = {
        key: "settings.advanced",
        value: JSON.stringify(data),
        category: "general",
        description: "Configuración avanzada del sistema"
      };

      if (rows?.length) {
        await base44.entities.SystemConfig.update(rows[0].id, payload);
      } else {
        await base44.entities.SystemConfig.create(payload);
      }

      await base44.entities.AuditLog.create({
        action: "settings_update",
        entity_type: "config",
        entity_id: "settings.advanced",
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
      <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-lg">
        <div className="flex gap-3">
          <AlertTriangle className="w-5 h-5 text-red-500 flex-shrink-0" />
          <div className="text-sm text-red-200">
            <p className="font-semibold mb-1">Configuración Avanzada</p>
            <p>Estas configuraciones afectan el rendimiento y comportamiento del sistema. Modifícalas solo si sabes lo que haces.</p>
          </div>
        </div>
      </div>

      <Card className="bg-zinc-900/50 border-white/10">
        <CardHeader>
          <CardTitle className="text-white flex items-center gap-2">
            <Zap className="w-5 h-5 text-red-500" />
            Rendimiento
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label className="text-gray-300">Duración de caché (segundos)</Label>
            <Input
              type="number"
              min="30"
              max="600"
              value={data.cache_duration_seconds}
              onChange={(e) => setData({ ...data, cache_duration_seconds: Number(e.target.value) })}
              className="bg-black border-gray-700 text-white"
            />
            <p className="text-xs text-gray-500">Tiempo que se guardan datos en memoria (30-600 seg)</p>
          </div>

          <div className="space-y-2">
            <Label className="text-gray-300">Límite de tasa API (requests/min)</Label>
            <Input
              type="number"
              min="10"
              max="1000"
              value={data.api_rate_limit}
              onChange={(e) => setData({ ...data, api_rate_limit: Number(e.target.value) })}
              className="bg-black border-gray-700 text-white"
            />
          </div>
        </CardContent>
      </Card>

      <Card className="bg-zinc-900/50 border-white/10">
        <CardHeader>
          <CardTitle className="text-white flex items-center gap-2">
            <Database className="w-5 h-5 text-red-500" />
            Sistema
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label className="text-gray-300">Tamaño máximo de archivo (MB)</Label>
            <Input
              type="number"
              min="1"
              max="100"
              value={data.max_upload_size_mb}
              onChange={(e) => setData({ ...data, max_upload_size_mb: Number(e.target.value) })}
              className="bg-black border-gray-700 text-white"
            />
          </div>

          <div className="space-y-2">
            <Label className="text-gray-300">Timeout de sesión (minutos)</Label>
            <Input
              type="number"
              min="30"
              max="1440"
              value={data.session_timeout_minutes}
              onChange={(e) => setData({ ...data, session_timeout_minutes: Number(e.target.value) })}
              className="bg-black border-gray-700 text-white"
            />
          </div>

          <div className="flex items-center justify-between p-3 bg-black/30 rounded-lg">
            <div>
              <Label className="text-gray-300">Modo debug</Label>
              <p className="text-xs text-gray-400">Mostrar logs en consola</p>
            </div>
            <Switch
              checked={data.enable_debug_mode}
              onCheckedChange={(v) => setData({ ...data, enable_debug_mode: v })}
            />
          </div>

          <div className="flex items-center justify-between p-3 bg-black/30 rounded-lg">
            <div>
              <Label className="text-gray-300">Analytics</Label>
              <p className="text-xs text-gray-400">Recopilar datos de uso</p>
            </div>
            <Switch
              checked={data.enable_analytics}
              onCheckedChange={(v) => setData({ ...data, enable_analytics: v })}
            />
          </div>

          <div className="flex items-center justify-between p-3 bg-black/30 rounded-lg">
            <div>
              <Label className="text-gray-300">Reporte de errores</Label>
              <p className="text-xs text-gray-400">Enviar errores automáticamente</p>
            </div>
            <Switch
              checked={data.enable_error_reporting}
              onCheckedChange={(v) => setData({ ...data, enable_error_reporting: v })}
            />
          </div>
        </CardContent>
      </Card>

      <Card className="bg-zinc-900/50 border-red-500/30">
        <CardHeader>
          <CardTitle className="text-red-400">Zona de Peligro</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between p-4 bg-red-500/10 rounded-lg border border-red-500/30">
            <div>
              <Label className="text-white">Modo mantenimiento</Label>
              <p className="text-xs text-gray-400">Deshabilitar acceso para usuarios (solo admins)</p>
            </div>
            <Switch
              checked={data.maintenance_mode}
              onCheckedChange={(v) => {
                if (v && !confirm("⚠️ Esto deshabilitará el acceso para todos los usuarios excepto admins. ¿Continuar?")) return;
                setData({ ...data, maintenance_mode: v });
              }}
            />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
