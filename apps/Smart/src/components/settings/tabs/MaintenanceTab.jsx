import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Download, Upload, Database, AlertTriangle } from "lucide-react";

export default function MaintenanceTab({ user }) {
  const [exporting, setExporting] = useState(false);

  const handleExportSettings = async () => {
    setExporting(true);
    try {
      const allSettings = await base44.entities.SystemConfig.list();
      const blob = new Blob([JSON.stringify(allSettings, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `settings-backup-${Date.now()}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      alert("Error al exportar: " + e.message);
    } finally {
      setExporting(false);
    }
  };

  const handleImportSettings = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!confirm("¿Importar configuración? Esto sobrescribirá las configuraciones actuales.")) return;

    try {
      const text = await file.text();
      const settings = JSON.parse(text);

      for (const setting of settings) {
        const existing = await base44.entities.SystemConfig.filter({ key: setting.key });
        if (existing.length) {
          await base44.entities.SystemConfig.update(existing[0].id, {
            value: setting.value,
            category: setting.category,
            description: setting.description
          });
        } else {
          await base44.entities.SystemConfig.create({
            key: setting.key,
            value: setting.value,
            category: setting.category,
            description: setting.description
          });
        }
      }

      alert("Configuración importada correctamente");
      window.dispatchEvent(new Event("force-refresh"));
    } catch (e) {
      alert("Error al importar: " + e.message);
    }
  };

  return (
    <div className="apple-type space-y-6">
      <Card className="apple-card border-0">
        <CardHeader>
          <CardTitle className="apple-text-title3 apple-label-primary">Respaldo y Restauración</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-3">
            <Button
              onClick={handleExportSettings}
              disabled={exporting}
              className="apple-btn apple-btn-primary apple-press"
            >
              <Download className="w-4 h-4 mr-2" />
              {exporting ? "Exportando..." : "Exportar Configuración"}
            </Button>

            <div>
              <input
                type="file"
                accept=".json"
                onChange={handleImportSettings}
                className="hidden"
                id="import-settings"
              />
              <Button
                onClick={() => document.getElementById("import-settings").click()}
                variant="outline"
                className="apple-btn apple-btn-secondary apple-press"
              >
                <Upload className="w-4 h-4 mr-2" />
                Importar Configuración
              </Button>
            </div>
          </div>

          <div className="p-4 bg-apple-orange/12 rounded-apple-md">
            <div className="flex gap-3">
              <AlertTriangle className="w-5 h-5 text-apple-orange flex-shrink-0" />
              <div className="apple-text-subheadline text-apple-orange">
                <p className="apple-text-headline mb-1">Importante</p>
                <p>La importación sobrescribirá toda la configuración actual. Asegúrate de tener un respaldo antes de proceder.</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="apple-card border-0">
        <CardHeader>
          <CardTitle className="apple-text-title3 text-apple-red">Zona de Peligro</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="p-4 bg-apple-red/12 rounded-apple-md">
            <div className="flex items-center justify-between">
              <div>
                <p className="apple-text-headline apple-label-primary">Restablecer configuración</p>
                <p className="apple-text-subheadline apple-label-tertiary">Volver a valores por defecto (requiere PIN de admin)</p>
              </div>
              <Button
                variant="outline"
                className="apple-btn apple-btn-destructive apple-press"
                onClick={() => alert("Función protegida - requiere implementación de validación de PIN")}
              >
                <Database className="w-4 h-4 mr-2" />
                Restablecer
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
