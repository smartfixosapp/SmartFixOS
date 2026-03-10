import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Download, TrendingUp, DollarSign, Package } from "lucide-react";

const DEFAULT_REPORTS = {
  auto_daily_report: true,
  auto_weekly_report: true,
  auto_monthly_report: false,
  report_recipients: [],
  include_charts: true,
  include_inventory: true,
  include_employees: false,
  pos_report_detail_level: "summary",
  financial_categories: ["repair_payment", "parts", "supplies", "other_expense"],
  export_formats: ["pdf", "excel"],
};

export default function ReportsConfigTab({ user }) {
  const [data, setData] = useState(DEFAULT_REPORTS);
  const [originalData, setOriginalData] = useState(DEFAULT_REPORTS);
  const [loading, setLoading] = useState(true);
  const [newRecipient, setNewRecipient] = useState("");

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
      const rows = await base44.entities.SystemConfig.filter({ key: "settings.reports" });
      if (rows?.length) {
        const raw = rows[0].value || rows[0].value_json;
        const parsed = typeof raw === "string" ? JSON.parse(raw) : raw;
        setData({ ...DEFAULT_REPORTS, ...parsed });
        setOriginalData({ ...DEFAULT_REPORTS, ...parsed });
      } else {
        setData(DEFAULT_REPORTS);
        setOriginalData(DEFAULT_REPORTS);
      }
    } catch (e) {
      console.error("Error loading reports config:", e);
    } finally {
      setLoading(false);
    }
  };

  const saveData = async () => {
    try {
      const rows = await base44.entities.SystemConfig.filter({ key: "settings.reports" });
      
      const payload = {
        key: "settings.reports",
        value: JSON.stringify(data),
        category: "general",
        description: "Configuración de reportes"
      };

      if (rows?.length) {
        await base44.entities.SystemConfig.update(rows[0].id, payload);
      } else {
        await base44.entities.SystemConfig.create(payload);
      }

      await base44.entities.AuditLog.create({
        action: "settings_update",
        entity_type: "config",
        entity_id: "settings.reports",
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

  const addRecipient = () => {
    if (!newRecipient || !newRecipient.includes("@")) {
      alert("Email inválido");
      return;
    }
    setData({
      ...data,
      report_recipients: [...(data.report_recipients || []), newRecipient]
    });
    setNewRecipient("");
  };

  const removeRecipient = (email) => {
    setData({
      ...data,
      report_recipients: data.report_recipients.filter(e => e !== email)
    });
  };

  if (loading) return <div className="text-gray-400">Cargando...</div>;

  return (
    <div className="space-y-6">
      <Card className="bg-zinc-900/50 border-white/10">
        <CardHeader>
          <CardTitle className="text-white flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-red-500" />
            Reportes Automáticos
          </CardTitle>
          <CardDescription>Envío automático de reportes por email</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between p-3 bg-black/30 rounded-lg">
            <div>
              <Label className="text-gray-300">Reporte diario</Label>
              <p className="text-xs text-gray-400">Enviar resumen diario de ventas</p>
            </div>
            <Switch
              checked={data.auto_daily_report}
              onCheckedChange={(v) => setData({ ...data, auto_daily_report: v })}
            />
          </div>

          <div className="flex items-center justify-between p-3 bg-black/30 rounded-lg">
            <div>
              <Label className="text-gray-300">Reporte semanal</Label>
              <p className="text-xs text-gray-400">Resumen semanal todos los lunes</p>
            </div>
            <Switch
              checked={data.auto_weekly_report}
              onCheckedChange={(v) => setData({ ...data, auto_weekly_report: v })}
            />
          </div>

          <div className="flex items-center justify-between p-3 bg-black/30 rounded-lg">
            <div>
              <Label className="text-gray-300">Reporte mensual</Label>
              <p className="text-xs text-gray-400">Resumen mensual el primer día del mes</p>
            </div>
            <Switch
              checked={data.auto_monthly_report}
              onCheckedChange={(v) => setData({ ...data, auto_monthly_report: v })}
            />
          </div>

          <div className="space-y-2">
            <Label className="text-gray-300">Destinatarios de reportes</Label>
            <div className="flex gap-2">
              <Input
                type="email"
                placeholder="email@ejemplo.com"
                value={newRecipient}
                onChange={(e) => setNewRecipient(e.target.value)}
                className="bg-black border-gray-700 text-white flex-1"
                onKeyPress={(e) => e.key === "Enter" && addRecipient()}
              />
              <Button onClick={addRecipient} className="bg-red-600 hover:bg-red-700">
                Agregar
              </Button>
            </div>
            <div className="space-y-1 mt-2">
              {(data.report_recipients || []).map((email) => (
                <div key={email} className="flex items-center justify-between bg-black/30 p-2 rounded">
                  <span className="text-sm text-gray-300">{email}</span>
                  <Button 
                    size="sm" 
                    variant="ghost" 
                    onClick={() => removeRecipient(email)}
                    className="text-red-400 hover:text-red-300"
                  >
                    Eliminar
                  </Button>
                </div>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="bg-zinc-900/50 border-white/10">
        <CardHeader>
          <CardTitle className="text-white flex items-center gap-2">
            <Package className="w-5 h-5 text-red-500" />
            Contenido de Reportes
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between p-3 bg-black/30 rounded-lg">
            <Label className="text-gray-300">Incluir gráficas</Label>
            <Switch
              checked={data.include_charts}
              onCheckedChange={(v) => setData({ ...data, include_charts: v })}
            />
          </div>

          <div className="flex items-center justify-between p-3 bg-black/30 rounded-lg">
            <Label className="text-gray-300">Incluir estado de inventario</Label>
            <Switch
              checked={data.include_inventory}
              onCheckedChange={(v) => setData({ ...data, include_inventory: v })}
            />
          </div>

          <div className="flex items-center justify-between p-3 bg-black/30 rounded-lg">
            <Label className="text-gray-300">Incluir datos de empleados</Label>
            <Switch
              checked={data.include_employees}
              onCheckedChange={(v) => setData({ ...data, include_employees: v })}
            />
          </div>

          <div className="space-y-2">
            <Label className="text-gray-300">Nivel de detalle (POS)</Label>
            <Select
              value={data.pos_report_detail_level}
              onValueChange={(value) => setData({ ...data, pos_report_detail_level: value })}
            >
              <SelectTrigger className="bg-black border-gray-700 text-white">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="summary">Resumen</SelectItem>
                <SelectItem value="detailed">Detallado</SelectItem>
                <SelectItem value="full">Completo (todas las transacciones)</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <Card className="bg-zinc-900/50 border-white/10">
        <CardHeader>
          <CardTitle className="text-white flex items-center gap-2">
            <Download className="w-5 h-5 text-red-500" />
            Formatos de Exportación
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between p-3 bg-black/30 rounded-lg">
            <Label className="text-gray-300">PDF</Label>
            <Switch
              checked={data.export_formats?.includes("pdf")}
              onCheckedChange={(v) => {
                const formats = data.export_formats || [];
                setData({
                  ...data,
                  export_formats: v ? [...formats, "pdf"] : formats.filter(f => f !== "pdf")
                });
              }}
            />
          </div>

          <div className="flex items-center justify-between p-3 bg-black/30 rounded-lg">
            <Label className="text-gray-300">Excel (XLSX)</Label>
            <Switch
              checked={data.export_formats?.includes("excel")}
              onCheckedChange={(v) => {
                const formats = data.export_formats || [];
                setData({
                  ...data,
                  export_formats: v ? [...formats, "excel"] : formats.filter(f => f !== "excel")
                });
              }}
            />
          </div>

          <div className="flex items-center justify-between p-3 bg-black/30 rounded-lg">
            <Label className="text-gray-300">CSV</Label>
            <Switch
              checked={data.export_formats?.includes("csv")}
              onCheckedChange={(v) => {
                const formats = data.export_formats || [];
                setData({
                  ...data,
                  export_formats: v ? [...formats, "csv"] : formats.filter(f => f !== "csv")
                });
              }}
            />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
