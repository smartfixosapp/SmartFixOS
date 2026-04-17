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

  if (loading) return <div className="apple-type apple-label-tertiary apple-text-body">Cargando...</div>;

  return (
    <div className="apple-type space-y-6">
      <Card className="apple-card border-0">
        <CardHeader>
          <CardTitle className="apple-text-title3 apple-label-primary flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-apple-red" />
            Reportes Automáticos
          </CardTitle>
          <CardDescription className="apple-text-subheadline apple-label-secondary">Envío automático de reportes por email</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between p-3 bg-gray-sys6 dark:bg-gray-sys5 rounded-apple-md">
            <div>
              <Label className="apple-label-primary apple-text-body">Reporte diario</Label>
              <p className="apple-text-caption1 apple-label-tertiary">Enviar resumen diario de ventas</p>
            </div>
            <Switch
              checked={data.auto_daily_report}
              onCheckedChange={(v) => setData({ ...data, auto_daily_report: v })}
            />
          </div>

          <div className="flex items-center justify-between p-3 bg-gray-sys6 dark:bg-gray-sys5 rounded-apple-md">
            <div>
              <Label className="apple-label-primary apple-text-body">Reporte semanal</Label>
              <p className="apple-text-caption1 apple-label-tertiary">Resumen semanal todos los lunes</p>
            </div>
            <Switch
              checked={data.auto_weekly_report}
              onCheckedChange={(v) => setData({ ...data, auto_weekly_report: v })}
            />
          </div>

          <div className="flex items-center justify-between p-3 bg-gray-sys6 dark:bg-gray-sys5 rounded-apple-md">
            <div>
              <Label className="apple-label-primary apple-text-body">Reporte mensual</Label>
              <p className="apple-text-caption1 apple-label-tertiary">Resumen mensual el primer día del mes</p>
            </div>
            <Switch
              checked={data.auto_monthly_report}
              onCheckedChange={(v) => setData({ ...data, auto_monthly_report: v })}
            />
          </div>

          <div className="space-y-2">
            <Label className="apple-label-secondary apple-text-footnote">Destinatarios de reportes</Label>
            <div className="flex gap-2">
              <Input
                type="email"
                placeholder="email@ejemplo.com"
                value={newRecipient}
                onChange={(e) => setNewRecipient(e.target.value)}
                className="apple-input flex-1"
                onKeyPress={(e) => e.key === "Enter" && addRecipient()}
              />
              <Button onClick={addRecipient} className="apple-btn apple-btn-primary apple-press">
                Agregar
              </Button>
            </div>
            <div className="space-y-1 mt-2">
              {(data.report_recipients || []).map((email) => (
                <div key={email} className="flex items-center justify-between bg-gray-sys6 dark:bg-gray-sys5 p-2 rounded-apple-sm">
                  <span className="apple-text-subheadline apple-label-primary">{email}</span>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => removeRecipient(email)}
                    className="apple-btn apple-btn-plain text-apple-red apple-press"
                  >
                    Eliminar
                  </Button>
                </div>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="apple-card border-0">
        <CardHeader>
          <CardTitle className="apple-text-title3 apple-label-primary flex items-center gap-2">
            <Package className="w-5 h-5 text-apple-red" />
            Contenido de Reportes
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between p-3 bg-gray-sys6 dark:bg-gray-sys5 rounded-apple-md">
            <Label className="apple-label-primary apple-text-body">Incluir gráficas</Label>
            <Switch
              checked={data.include_charts}
              onCheckedChange={(v) => setData({ ...data, include_charts: v })}
            />
          </div>

          <div className="flex items-center justify-between p-3 bg-gray-sys6 dark:bg-gray-sys5 rounded-apple-md">
            <Label className="apple-label-primary apple-text-body">Incluir estado de inventario</Label>
            <Switch
              checked={data.include_inventory}
              onCheckedChange={(v) => setData({ ...data, include_inventory: v })}
            />
          </div>

          <div className="flex items-center justify-between p-3 bg-gray-sys6 dark:bg-gray-sys5 rounded-apple-md">
            <Label className="apple-label-primary apple-text-body">Incluir datos de empleados</Label>
            <Switch
              checked={data.include_employees}
              onCheckedChange={(v) => setData({ ...data, include_employees: v })}
            />
          </div>

          <div className="space-y-2">
            <Label className="apple-label-secondary apple-text-footnote">Nivel de detalle (POS)</Label>
            <Select
              value={data.pos_report_detail_level}
              onValueChange={(value) => setData({ ...data, pos_report_detail_level: value })}
            >
              <SelectTrigger className="apple-input">
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

      <Card className="apple-card border-0">
        <CardHeader>
          <CardTitle className="apple-text-title3 apple-label-primary flex items-center gap-2">
            <Download className="w-5 h-5 text-apple-red" />
            Formatos de Exportación
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between p-3 bg-gray-sys6 dark:bg-gray-sys5 rounded-apple-md">
            <Label className="apple-label-primary apple-text-body">PDF</Label>
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

          <div className="flex items-center justify-between p-3 bg-gray-sys6 dark:bg-gray-sys5 rounded-apple-md">
            <Label className="apple-label-primary apple-text-body">Excel (XLSX)</Label>
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

          <div className="flex items-center justify-between p-3 bg-gray-sys6 dark:bg-gray-sys5 rounded-apple-md">
            <Label className="apple-label-primary apple-text-body">CSV</Label>
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
