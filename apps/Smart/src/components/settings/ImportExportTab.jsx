import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Download, Upload, FileText, Database, Loader2, AlertCircle,
  Users, Package, Sparkles
} from "lucide-react";
import { toast } from "sonner";
import { format } from 'date-fns';

export default function ImportExportTab() {
  const [exportType, setExportType] = useState("orders");
  const [exportFormat, setExportFormat] = useState("csv");
  const [exporting, setExporting] = useState(false);
  const [importing, setImporting] = useState(false);

  const handleExport = async () => {
    setExporting(true);
    try {
      let data = [];
      let filename = "";

      switch (exportType) {
        case "orders":
          data = await base44.entities.Order.list("-created_date", 1000);
          filename = `orders_${format(new Date(), 'yyyy-MM-dd')}.${exportFormat}`;
          break;
        case "customers":
          data = await base44.entities.Customer.list("-created_date", 1000);
          filename = `customers_${format(new Date(), 'yyyy-MM-dd')}.${exportFormat}`;
          break;
        case "products":
          data = await base44.entities.Product.list("-created_date", 1000);
          filename = `products_${format(new Date(), 'yyyy-MM-dd')}.${exportFormat}`;
          break;
        case "sales":
          data = await base44.entities.Sale.list("-created_date", 1000);
          filename = `sales_${format(new Date(), 'yyyy-MM-dd')}.${exportFormat}`;
          break;
      }

      let content = "";
      let mimeType = "";

      if (exportFormat === "csv") {
        if (data.length === 0) {
          toast.error("No hay datos para exportar");
          setExporting(false);
          return;
        }

        const headers = Object.keys(data[0]);
        const csvRows = [headers.join(",")];

        data.forEach(row => {
          const values = headers.map(header => {
            const value = row[header];
            if (value === null || value === undefined) return "";
            if (typeof value === "object") return JSON.stringify(value).replace(/"/g, '""');
            return `"${String(value).replace(/"/g, '""')}"`;
          });
          csvRows.push(values.join(","));
        });

        content = csvRows.join("\n");
        mimeType = "text/csv";
      } else {
        content = JSON.stringify(data, null, 2);
        mimeType = "application/json";
      }

      const blob = new Blob([content], { type: mimeType });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      a.remove();

      toast.success(`${data.length} registros exportados`);
    } catch (error) {
      console.error("Error exporting:", error);
      toast.error("Error al exportar datos");
    } finally {
      setExporting(false);
    }
  };

  const handleImport = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setImporting(true);
    try {
      const text = await file.text();
      let records = [];

      if (file.name.endsWith('.json')) {
        records = JSON.parse(text);
      } else if (file.name.endsWith('.csv')) {
        const lines = text.split("\n").filter(l => l.trim());
        const headers = lines[0].split(",").map(h => h.trim().replace(/^"|"$/g, ''));

        for (let i = 1; i < lines.length; i++) {
          const values = lines[i].split(",").map(v => v.trim().replace(/^"|"$/g, ''));
          const record = {};
          headers.forEach((header, idx) => {
            record[header] = values[idx] || "";
          });
          records.push(record);
        }
      }

      if (!Array.isArray(records) || records.length === 0) {
        toast.error("Archivo vacío o formato inválido");
        setImporting(false);
        return;
      }

      let created = 0;
      for (const record of records) {
        try {
          delete record.id;
          delete record.created_date;
          delete record.updated_date;
          delete record.created_by;

          switch (exportType) {
            case "customers":
              await base44.entities.Customer.create(record);
              created++;
              break;
            case "products":
              await base44.entities.Product.create(record);
              created++;
              break;
          }
        } catch (err) {
          console.error("Error importing record:", err);
        }
      }

      toast.success(`${created} de ${records.length} registros importados`);

      if (exportType === "customers" || exportType === "products") {
        window.dispatchEvent(new Event("force-refresh"));
      }
    } catch (error) {
      console.error("Error importing:", error);
      toast.error("Error al importar archivo");
    } finally {
      setImporting(false);
      event.target.value = "";
    }
  };

  return (
    <div className="apple-type space-y-4">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="apple-card border-0">
          <CardHeader>
            <CardTitle className="apple-text-title3 apple-label-primary flex items-center gap-2">
              <Download className="w-5 h-5 text-apple-blue" />
              Exportar Datos
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="apple-label-secondary apple-text-footnote mb-2 block">Tipo de Datos</label>
              <select
                value={exportType}
                onChange={(e) => setExportType(e.target.value)}
                className="apple-input w-full"
              >
                <option value="orders">Órdenes de Trabajo</option>
                <option value="customers">Clientes</option>
                <option value="products">Productos</option>
                <option value="sales">Ventas</option>
              </select>
            </div>

            <div>
              <label className="apple-label-secondary apple-text-footnote mb-2 block">Formato</label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={() => setExportFormat("csv")}
                  className={`p-4 rounded-apple-md transition-all apple-press ${
                    exportFormat === "csv"
                      ? "bg-apple-blue/12"
                      : "apple-surface-elevated"
                  }`}
                >
                  <FileText className="w-8 h-8 mx-auto mb-2 text-apple-blue" />
                  <p className="apple-text-subheadline apple-label-primary">CSV</p>
                  <p className="apple-text-caption1 apple-label-tertiary mt-1">Excel compatible</p>
                </button>
                <button
                  onClick={() => setExportFormat("json")}
                  className={`p-4 rounded-apple-md transition-all apple-press ${
                    exportFormat === "json"
                      ? "bg-apple-blue/12"
                      : "apple-surface-elevated"
                  }`}
                >
                  <Database className="w-8 h-8 mx-auto mb-2 text-apple-green" />
                  <p className="apple-text-subheadline apple-label-primary">JSON</p>
                  <p className="apple-text-caption1 apple-label-tertiary mt-1">Formato completo</p>
                </button>
              </div>
            </div>

            <Button
              onClick={handleExport}
              disabled={exporting}
              className="apple-btn apple-btn-primary apple-btn-lg apple-press w-full"
            >
              {exporting ? (
                <>
                  <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                  Exportando...
                </>
              ) : (
                <>
                  <Download className="w-5 h-5 mr-2" />
                  Exportar {exportType === "orders" ? "Órdenes" : exportType === "customers" ? "Clientes" : exportType === "products" ? "Productos" : "Ventas"}
                </>
              )}
            </Button>

            <div className="bg-apple-blue/12 rounded-apple-md p-4">
              <p className="text-apple-blue apple-text-caption1">
                Los datos exportados incluirán todos los campos disponibles.
                Útil para respaldos o análisis externo.
              </p>
            </div>
          </CardContent>
        </Card>

        <Card className="apple-card border-0">
          <CardHeader>
            <CardTitle className="apple-text-title3 apple-label-primary flex items-center gap-2">
              <Upload className="w-5 h-5 text-apple-green" />
              Importar Datos
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="apple-label-secondary apple-text-footnote mb-2 block">Tipo de Datos</label>
              <select
                value={exportType}
                onChange={(e) => setExportType(e.target.value)}
                className="apple-input w-full"
              >
                <option value="customers">Clientes</option>
                <option value="products">Productos</option>
              </select>
              <p className="apple-text-caption1 apple-label-tertiary mt-1">Solo se permite importar clientes y productos</p>
            </div>

            <div>
              <label className="apple-label-secondary apple-text-footnote mb-2 block">Formato Aceptado</label>
              <div className="grid grid-cols-2 gap-3">
                <div className="p-4 rounded-apple-md apple-surface-elevated">
                  <FileText className="w-8 h-8 mx-auto mb-2 text-apple-blue" />
                  <p className="apple-text-subheadline apple-label-primary text-center">CSV</p>
                  <p className="apple-text-caption1 apple-label-tertiary mt-1 text-center">Con encabezados</p>
                </div>
                <div className="p-4 rounded-apple-md apple-surface-elevated">
                  <Database className="w-8 h-8 mx-auto mb-2 text-apple-green" />
                  <p className="apple-text-subheadline apple-label-primary text-center">JSON</p>
                  <p className="apple-text-caption1 apple-label-tertiary mt-1 text-center">Array de objetos</p>
                </div>
              </div>
            </div>

            <div className="relative">
              <input
                type="file"
                accept=".csv,.json"
                onChange={handleImport}
                className="hidden"
                id="import-file-input"
                disabled={importing || exportType === "orders" || exportType === "sales"}
              />
              <label
                htmlFor="import-file-input"
                className={`block w-full ${
                  importing || exportType === "orders" || exportType === "sales"
                    ? "opacity-50 cursor-not-allowed"
                    : "cursor-pointer"
                }`}
              >
                <div className="apple-btn apple-btn-primary apple-btn-lg apple-press w-full flex items-center justify-center">
                  {importing ? (
                    <>
                      <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                      Importando...
                    </>
                  ) : (
                    <>
                      <Upload className="w-5 h-5 mr-2" />
                      Seleccionar Archivo
                    </>
                  )}
                </div>
              </label>
            </div>

            <div className="bg-apple-orange/12 rounded-apple-md p-4">
              <div className="flex items-start gap-2">
                <AlertCircle className="w-5 h-5 text-apple-orange flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-apple-orange apple-text-caption1 apple-text-headline mb-1">Importante</p>
                  <p className="apple-label-secondary apple-text-caption1">
                    Los datos importados se añaden a los existentes, no los reemplazan.
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="apple-card border-0 lg:col-span-2">
          <CardHeader>
            <CardTitle className="apple-text-title3 apple-label-primary flex items-center gap-2">
              <FileText className="w-5 h-5 text-apple-blue" />
              Plantillas y Guías
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="bg-apple-blue/12 rounded-apple-md p-5">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-12 h-12 rounded-apple-sm bg-apple-blue/15 flex items-center justify-center">
                    <Users className="w-6 h-6 text-apple-blue" />
                  </div>
                  <div>
                    <h4 className="apple-label-primary apple-text-headline">Clientes</h4>
                    <p className="text-apple-blue apple-text-caption1">Formato de importación</p>
                  </div>
                </div>
                <div className="apple-surface-elevated rounded-apple-sm p-3 mb-4">
                  <p className="apple-text-caption1 apple-label-secondary mb-1">Campos CSV:</p>
                  <p className="apple-text-caption1 apple-label-tertiary tabular-nums">name, phone, email, notes</p>
                </div>
                <div className="apple-surface-elevated rounded-apple-sm p-3">
                  <p className="apple-text-caption1 apple-label-secondary mb-1">Ejemplo JSON:</p>
                  <pre className="apple-text-caption1 apple-label-tertiary overflow-x-auto tabular-nums">
{`[{
  "name": "Juan Pérez",
  "phone": "7871234567",
  "email": "juan@email.com"
}]`}
                  </pre>
                </div>
              </div>

              <div className="bg-apple-green/12 rounded-apple-md p-5">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-12 h-12 rounded-apple-sm bg-apple-green/15 flex items-center justify-center">
                    <Package className="w-6 h-6 text-apple-green" />
                  </div>
                  <div>
                    <h4 className="apple-label-primary apple-text-headline">Productos</h4>
                    <p className="text-apple-green apple-text-caption1">Formato de importación</p>
                  </div>
                </div>
                <div className="apple-surface-elevated rounded-apple-sm p-3 mb-4">
                  <p className="apple-text-caption1 apple-label-secondary mb-1">Campos CSV:</p>
                  <p className="apple-text-caption1 apple-label-tertiary tabular-nums">name, price, cost, stock, category</p>
                </div>
                <div className="apple-surface-elevated rounded-apple-sm p-3">
                  <p className="apple-text-caption1 apple-label-secondary mb-1">Ejemplo JSON:</p>
                  <pre className="apple-text-caption1 apple-label-tertiary overflow-x-auto tabular-nums">
{`[{
  "name": "Pantalla iPhone 14",
  "price": 150.00,
  "cost": 80.00,
  "stock": 10
}]`}
                  </pre>
                </div>
              </div>
            </div>

            <div className="bg-apple-purple/12 rounded-apple-md p-5 mt-6">
              <div className="flex items-start gap-3">
                <Sparkles className="w-6 h-6 text-apple-purple flex-shrink-0 mt-1" />
                <div>
                  <h4 className="text-apple-purple apple-text-headline mb-2">Recomendaciones</h4>
                  <ul className="apple-label-secondary apple-text-subheadline space-y-1">
                    <li>• Exporta datos primero para ver la estructura exacta</li>
                    <li>• Usa UTF-8 para caracteres especiales (tildes, ñ)</li>
                    <li>• Los campos obligatorios varían según el tipo de dato</li>
                    <li>• La importación es incremental, no borra datos existentes</li>
                  </ul>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
