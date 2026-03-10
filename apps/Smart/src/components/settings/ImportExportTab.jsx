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

      toast.success(`✅ ${data.length} registros exportados`);
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

      toast.success(`✅ ${created} de ${records.length} registros importados`);
      
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
    <div className="space-y-4">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="bg-black/40 backdrop-blur-xl border-white/10 shadow-[0_8px_32px_rgba(0,0,0,0.3)] theme-light:bg-white theme-light:border-gray-200">
          <CardHeader>
            <CardTitle className="text-white flex items-center gap-2 theme-light:text-gray-900">
              <Download className="w-5 h-5 text-cyan-500" />
              Exportar Datos
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="text-gray-300 text-sm mb-2 block theme-light:text-gray-700">Tipo de Datos</label>
              <select
                value={exportType}
                onChange={(e) => setExportType(e.target.value)}
                className="w-full bg-black/40 border border-white/15 rounded-lg px-4 py-3 text-white theme-light:bg-white theme-light:border-gray-300 theme-light:text-gray-900"
              >
                <option value="orders">📋 Órdenes de Trabajo</option>
                <option value="customers">👥 Clientes</option>
                <option value="products">📦 Productos</option>
                <option value="sales">💰 Ventas</option>
              </select>
            </div>

            <div>
              <label className="text-gray-300 text-sm mb-2 block theme-light:text-gray-700">Formato</label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={() => setExportFormat("csv")}
                  className={`p-4 rounded-xl border-2 transition-all ${
                    exportFormat === "csv"
                      ? "bg-cyan-600/20 border-cyan-500/50 text-white"
                      : "bg-black/20 border-white/10 text-gray-300 hover:bg-white/5 theme-light:bg-gray-50 theme-light:border-gray-200"
                  }`}
                >
                  <FileText className="w-8 h-8 mx-auto mb-2 text-cyan-400" />
                  <p className="font-bold text-sm theme-light:text-gray-900">CSV</p>
                  <p className="text-xs text-gray-400 mt-1">Excel compatible</p>
                </button>
                <button
                  onClick={() => setExportFormat("json")}
                  className={`p-4 rounded-xl border-2 transition-all ${
                    exportFormat === "json"
                      ? "bg-cyan-600/20 border-cyan-500/50 text-white"
                      : "bg-black/20 border-white/10 text-gray-300 hover:bg-white/5 theme-light:bg-gray-50 theme-light:border-gray-200"
                  }`}
                >
                  <Database className="w-8 h-8 mx-auto mb-2 text-emerald-400" />
                  <p className="font-bold text-sm theme-light:text-gray-900">JSON</p>
                  <p className="text-xs text-gray-400 mt-1">Formato completo</p>
                </button>
              </div>
            </div>

            <Button
              onClick={handleExport}
              disabled={exporting}
              className="w-full bg-gradient-to-r from-cyan-600 to-emerald-700 hover:from-cyan-700 hover:to-emerald-800 h-14 text-lg font-bold shadow-lg"
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

            <div className="bg-blue-600/10 border border-blue-500/20 rounded-xl p-4 theme-light:bg-blue-50 theme-light:border-blue-300">
              <p className="text-blue-300 text-xs theme-light:text-blue-700">
                💡 Los datos exportados incluirán todos los campos disponibles.
                Útil para respaldos o análisis externo.
              </p>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-black/40 backdrop-blur-xl border-white/10 shadow-[0_8px_32px_rgba(0,0,0,0.3)] theme-light:bg-white theme-light:border-gray-200">
          <CardHeader>
            <CardTitle className="text-white flex items-center gap-2 theme-light:text-gray-900">
              <Upload className="w-5 h-5 text-emerald-500" />
              Importar Datos
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="text-gray-300 text-sm mb-2 block theme-light:text-gray-700">Tipo de Datos</label>
              <select
                value={exportType}
                onChange={(e) => setExportType(e.target.value)}
                className="w-full bg-black/40 border border-white/15 rounded-lg px-4 py-3 text-white theme-light:bg-white theme-light:border-gray-300 theme-light:text-gray-900"
              >
                <option value="customers">👥 Clientes</option>
                <option value="products">📦 Productos</option>
              </select>
              <p className="text-xs text-gray-500 mt-1">Solo se permite importar clientes y productos</p>
            </div>

            <div>
              <label className="text-gray-300 text-sm mb-2 block theme-light:text-gray-700">Formato Aceptado</label>
              <div className="grid grid-cols-2 gap-3">
                <div className="p-4 rounded-xl border-2 border-white/10 bg-black/20 theme-light:bg-gray-50 theme-light:border-gray-200">
                  <FileText className="w-8 h-8 mx-auto mb-2 text-cyan-400" />
                  <p className="font-bold text-sm text-white text-center theme-light:text-gray-900">CSV</p>
                  <p className="text-xs text-gray-400 mt-1 text-center">Con encabezados</p>
                </div>
                <div className="p-4 rounded-xl border-2 border-white/10 bg-black/20 theme-light:bg-gray-50 theme-light:border-gray-200">
                  <Database className="w-8 h-8 mx-auto mb-2 text-emerald-400" />
                  <p className="font-bold text-sm text-white text-center theme-light:text-gray-900">JSON</p>
                  <p className="text-xs text-gray-400 mt-1 text-center">Array de objetos</p>
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
                <div className="w-full bg-gradient-to-r from-emerald-600 to-lime-700 hover:from-emerald-700 hover:to-lime-800 h-14 rounded-xl flex items-center justify-center text-lg font-bold shadow-lg transition-all">
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

            <div className="bg-amber-600/10 border border-amber-500/20 rounded-xl p-4 theme-light:bg-amber-50 theme-light:border-amber-300">
              <div className="flex items-start gap-2">
                <AlertCircle className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5 theme-light:text-amber-700" />
                <div>
                  <p className="text-amber-300 text-xs font-bold mb-1 theme-light:text-amber-800">⚠️ Importante</p>
                  <p className="text-gray-300 text-xs theme-light:text-gray-700">
                    Los datos importados se AÑADEN a los existentes, no los reemplazan.
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-black/40 backdrop-blur-xl border-white/10 shadow-[0_8px_32px_rgba(0,0,0,0.3)] lg:col-span-2 theme-light:bg-white theme-light:border-gray-200">
          <CardHeader>
            <CardTitle className="text-white flex items-center gap-2 theme-light:text-gray-900">
              <FileText className="w-5 h-5 text-blue-500" />
              Plantillas y Guías
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="bg-gradient-to-br from-blue-600/10 to-blue-800/10 border border-blue-500/30 rounded-xl p-5 theme-light:from-blue-50 theme-light:to-blue-100 theme-light:border-blue-300">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-12 h-12 rounded-xl bg-blue-600/30 border border-blue-500/40 flex items-center justify-center theme-light:bg-blue-200">
                    <Users className="w-6 h-6 text-blue-400 theme-light:text-blue-700" />
                  </div>
                  <div>
                    <h4 className="text-white font-bold text-lg theme-light:text-gray-900">Clientes</h4>
                    <p className="text-blue-300 text-xs theme-light:text-blue-700">Formato de importación</p>
                  </div>
                </div>
                <div className="bg-black/40 rounded-lg p-3 mb-4 theme-light:bg-white theme-light:border theme-light:border-gray-200">
                  <p className="text-xs text-gray-300 font-mono mb-1 theme-light:text-gray-700">Campos CSV:</p>
                  <p className="text-xs text-gray-400 theme-light:text-gray-600">name, phone, email, notes</p>
                </div>
                <div className="bg-black/40 rounded-lg p-3 theme-light:bg-white theme-light:border theme-light:border-gray-200">
                  <p className="text-xs text-gray-300 font-mono mb-1 theme-light:text-gray-700">Ejemplo JSON:</p>
                  <pre className="text-xs text-gray-400 overflow-x-auto theme-light:text-gray-600">
{`[{
  "name": "Juan Pérez",
  "phone": "7871234567",
  "email": "juan@email.com"
}]`}
                  </pre>
                </div>
              </div>

              <div className="bg-gradient-to-br from-emerald-600/10 to-emerald-800/10 border border-emerald-500/30 rounded-xl p-5 theme-light:from-emerald-50 theme-light:to-emerald-100 theme-light:border-emerald-300">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-12 h-12 rounded-xl bg-emerald-600/30 border border-emerald-500/40 flex items-center justify-center theme-light:bg-emerald-200">
                    <Package className="w-6 h-6 text-emerald-400 theme-light:text-emerald-700" />
                  </div>
                  <div>
                    <h4 className="text-white font-bold text-lg theme-light:text-gray-900">Productos</h4>
                    <p className="text-emerald-300 text-xs theme-light:text-emerald-700">Formato de importación</p>
                  </div>
                </div>
                <div className="bg-black/40 rounded-lg p-3 mb-4 theme-light:bg-white theme-light:border theme-light:border-gray-200">
                  <p className="text-xs text-gray-300 font-mono mb-1 theme-light:text-gray-700">Campos CSV:</p>
                  <p className="text-xs text-gray-400 theme-light:text-gray-600">name, price, cost, stock, category</p>
                </div>
                <div className="bg-black/40 rounded-lg p-3 theme-light:bg-white theme-light:border theme-light:border-gray-200">
                  <p className="text-xs text-gray-300 font-mono mb-1 theme-light:text-gray-700">Ejemplo JSON:</p>
                  <pre className="text-xs text-gray-400 overflow-x-auto theme-light:text-gray-600">
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

            <div className="bg-gradient-to-r from-purple-600/10 to-purple-800/10 border border-purple-500/30 rounded-xl p-5 mt-6 theme-light:from-purple-50 theme-light:to-purple-100 theme-light:border-purple-300">
              <div className="flex items-start gap-3">
                <Sparkles className="w-6 h-6 text-purple-400 flex-shrink-0 mt-1 theme-light:text-purple-700" />
                <div>
                  <h4 className="text-purple-300 font-bold mb-2 theme-light:text-purple-800">Recomendaciones</h4>
                  <ul className="text-gray-300 text-sm space-y-1 theme-light:text-gray-700">
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
