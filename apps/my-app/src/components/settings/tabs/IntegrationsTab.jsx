import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { TestTube } from "lucide-react";

const DEFAULT_INTEGRATIONS = {
  smtp_host: "",
  smtp_port: "587",
  smtp_user: "",
  smtp_password: "",
  webhook_url: "",
};

export default function IntegrationsTab({ user }) {
  const [data, setData] = useState(DEFAULT_INTEGRATIONS);
  const [originalData, setOriginalData] = useState(DEFAULT_INTEGRATIONS);
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
      const rows = await base44.entities.SystemConfig.filter({ key: "settings.integrations" });
      if (rows?.length) {
        const raw = rows[0].value || rows[0].value_json;
        const parsed = typeof raw === "string" ? JSON.parse(raw) : raw;
        setData({ ...DEFAULT_INTEGRATIONS, ...parsed });
        setOriginalData({ ...DEFAULT_INTEGRATIONS, ...parsed });
      } else {
        setData(DEFAULT_INTEGRATIONS);
        setOriginalData(DEFAULT_INTEGRATIONS);
      }
    } catch (e) {
      console.error("Error loading integrations:", e);
    } finally {
      setLoading(false);
    }
  };

  const saveData = async () => {
    try {
      const rows = await base44.entities.SystemConfig.filter({ key: "settings.integrations" });
      
      const payload = {
        key: "settings.integrations",
        value: JSON.stringify(data),
        category: "general",
        description: "Configuración de integraciones"
      };

      if (rows?.length) {
        await base44.entities.SystemConfig.update(rows[0].id, payload);
      } else {
        await base44.entities.SystemConfig.create(payload);
      }

      await base44.entities.AuditLog.create({
        action: "settings_update",
        entity_type: "config",
        entity_id: "settings.integrations",
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

  const testWebhook = async () => {
    alert("Probando webhook... (implementar ping)");
  };

  if (loading) return <div className="text-gray-400">Cargando...</div>;

  return (
    <div className="space-y-6">
      <Card className="bg-zinc-900/50 border-white/10">
        <CardHeader>
          <CardTitle className="text-white">SMTP / Email</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="text-gray-300">Host SMTP</Label>
              <Input
                value={data.smtp_host}
                onChange={(e) => setData({ ...data, smtp_host: e.target.value })}
                className="bg-black border-gray-700 text-white"
                placeholder="smtp.gmail.com"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-gray-300">Puerto</Label>
              <Input
                type="number"
                value={data.smtp_port}
                onChange={(e) => setData({ ...data, smtp_port: e.target.value })}
                className="bg-black border-gray-700 text-white"
                placeholder="587"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-gray-300">Usuario</Label>
              <Input
                value={data.smtp_user}
                onChange={(e) => setData({ ...data, smtp_user: e.target.value })}
                className="bg-black border-gray-700 text-white"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-gray-300">Contraseña</Label>
              <Input
                type="password"
                value={data.smtp_password}
                onChange={(e) => setData({ ...data, smtp_password: e.target.value })}
                className="bg-black border-gray-700 text-white"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="bg-zinc-900/50 border-white/10">
        <CardHeader>
          <CardTitle className="text-white">Webhooks</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label className="text-gray-300">URL del webhook</Label>
            <div className="flex gap-2">
              <Input
                value={data.webhook_url}
                onChange={(e) => setData({ ...data, webhook_url: e.target.value })}
                className="bg-black border-gray-700 text-white flex-1"
                placeholder="https://api.ejemplo.com/webhook"
              />
              <Button onClick={testWebhook} variant="outline" className="border-gray-700">
                <TestTube className="w-4 h-4 mr-2" />
                Probar
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
