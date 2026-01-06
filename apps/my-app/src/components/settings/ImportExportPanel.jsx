import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";
import {
  Upload, Download, FileSpreadsheet, FileJson, FileText, 
  Database, Users, ShoppingCart, Package, CheckCircle, 
  AlertCircle, Loader2, Sparkles, ArrowRight, Eye, FileCheck,
  Zap, Brain, Settings
} from "lucide-react";

export default function ImportExportPanel() {
  const [importMode, setImportMode] = useState(null);
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [mapping, setMapping] = useState(null);
  const [loading, setLoading] = useState(false);
  const [processingStep, setProcessingStep] = useState(null);

  const entities = [
    { 
      key: "products", 
      name: "Productos/Inventario", 
      icon: Package, 
      color: "from-emerald-600 to-green-600",
      entity: "Product",
      requiredFields: ["name", "price", "cost"]
    },
    { 
      key: "customers", 
      name: "Clientes", 
      icon: Users, 
      color: "from-blue-600 to-indigo-600",
      entity: "Customer",
      requiredFields: ["name"]
    },
    { 
      key: "purchase_orders", 
      name: "Órdenes de Compra", 
      icon: ShoppingCart, 
      color: "from-purple-600 to-pink-600",
      entity: "PurchaseOrder",
      requiredFields: ["supplier_name", "total_amount"]
    },
    { 
      key: "suppliers", 
      name: "Proveedores", 
      icon: Database, 
      color: "from-orange-600 to-red-600",
      entity: "Supplier",
      requiredFields: ["name", "email"]
    }
  ];

  const handleFileSelect = (e) => {
    const selectedFile = e.target.files[0];
    if (!selectedFile) return;

    const validTypes = [
      'text/csv',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/json',
      'text/plain'
    ];

    if (!validTypes.includes(selectedFile.type) && !selectedFile.name.match(/\.(csv|xlsx|xls|json|txt)$/i)) {
      toast.error("Formato no soportado. Usa CSV, Excel, JSON o TXT");
      return;
    }

    setFile(selectedFile);
    toast.success(`✓ Archivo seleccionado: ${selectedFile.name}`);
  };

  const analyzeWithAI = async () => {
    if (!file || !importMode) return;

    setLoading(true);
    setProcessingStep("Analizando archivo con IA...");

    try {
      // 1. Subir archivo
      const uploadResult = await base44.integrations.Core.UploadFile({ file });
      const fileUrl = uploadResult.file_url || uploadResult.url;

      // 2. Extraer datos con IA
      const entityConfig = entities.find(e => e.key === importMode);
      const schema = await base44.entities[entityConfig.entity].schema();
      
      setProcessingStep("IA mapeando campos automáticamente...");

      const extractResult = await base44.integrations.Core.ExtractDataFromUploadedFile({
        file_url: fileUrl,
        json_schema: {
          type: "object",
          properties: {
            records: {
              type: "array",
              items: schema
            },
            mapping_suggestions: {
              type: "object",
              description: "Mapeo de columnas originales a campos del sistema"
            },
            total_records: { type: "number" },
            warnings: {
              type: "array",
              items: { type: "string" }
            }
          }
        }
      });

      if (extractResult.status === "error") {
        toast.error(extractResult.details || "Error al procesar archivo");
        return;
      }

      const data = extractResult.output;
      setPreview(data.records?.slice(0, 10) || []);
      setMapping(data.mapping_suggestions || {});
      
      setProcessingStep("¡Análisis completo!");
      toast.success(`✅ ${data.total_records || data.records?.length || 0} registros detectados`);

      if (data.warnings?.length > 0) {
        data.warnings.forEach(w => toast.warning(w));
      }

    } catch (error) {
      console.error("Error analyzing file:", error);
      toast.error("Error al analizar archivo");
    } finally {
      setLoading(false);
      setProcessingStep(null);
    }
  };

  const handleImport = async () => {
    if (!preview || preview.length === 0) {
      toast.error("No hay datos para importar");
      return;
    }

    setLoading(true);
    setProcessingStep("Importando datos...");

    try {
      const entityConfig = entities.find(e => e.key === importMode);
      const validRecords = [];
      const errors = [];

      // Validar registros
      preview.forEach((record, idx) => {
        const missing = entityConfig.requiredFields.filter(field => !record[field]);
        if (missing.length > 0) {
          errors.push(`Fila ${idx + 1}: Faltan campos ${missing.join(", ")}`);
        } else {
          validRecords.push(record);
        }
      });

      if (errors.length > 0) {
        toast.error(`${errors.length} registros con errores`);
        console.error("Errores de validación:", errors);
      }

      if (validRecords.length === 0) {
        toast.error("No hay registros válidos para importar");
        return;
      }

      // Importar en lotes
      const batchSize = 50;
      let imported = 0;

      for (let i = 0; i < validRecords.length; i += batchSize) {
        const batch = validRecords.slice(i, i + batchSize);
        setProcessingStep(`Importando ${i + batch.length} de ${validRecords.length}...`);
        
        await Promise.all(
          batch.map(record => base44.entities[entityConfig.entity].create(record))
        );
        
        imported += batch.length;
      }

      toast.success(`✅ ${imported} registros importados exitosamente`);
      
      // Reset
      setFile(null);
      setPreview(null);
      setMapping(null);
      setImportMode(null);

    } catch (error) {
      console.error("Error importing:", error);
      toast.error("Error al importar datos");
    } finally {
      setLoading(false);
      setProcessingStep(null);
    }
  };

  const handleExport = async (entityKey) => {
    setLoading(true);
    try {
      const entityConfig = entities.find(e => e.key === entityKey);
      const data = await base44.entities[entityConfig.entity].list("-created_date", 10000);

      if (!data || data.length === 0) {
        toast.error("No hay datos para exportar");
        return;
      }

      // Convertir a CSV
      const headers = Object.keys(data[0]).join(",");
      const rows = data.map(row => 
        Object.values(row).map(v => 
          typeof v === "string" && v.includes(",") ? `"${v}"` : v
        ).join(",")
      );
      const csv = [headers, ...rows].join("\n");

      // Descargar
      const blob = new Blob([csv], { type: "text/csv" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${entityKey}_${new Date().toISOString().split("T")[0]}.csv`;
      a.click();
      URL.revokeObjectURL(url);

      toast.success(`✅ ${data.length} registros exportados`);
    } catch (error) {
      console.error("Error exporting:", error);
      toast.error("Error al exportar");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Import Section */}
      <Card className="bg-black/40 border border-cyan-500/20 p-6 theme-light:bg-white theme-light:border-gray-200">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-indigo-600 to-blue-600 flex items-center justify-center shadow-lg">
            <Upload className="w-6 h-6 text-white" />
          </div>
          <div>
            <h3 className="text-white font-bold text-xl theme-light:text-gray-900">Importar Datos</h3>
            <p className="text-gray-400 text-sm theme-light:text-gray-600">Migra desde cualquier sistema con IA</p>
          </div>
        </div>

        {!importMode ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {entities.map((entity) => {
              const Icon = entity.icon;
              return (
                <button
                  key={entity.key}
                  onClick={() => setImportMode(entity.key)}
                  className="group relative overflow-hidden bg-black/30 border border-white/10 hover:border-cyan-500/50 rounded-xl p-6 transition-all hover:scale-105 active:scale-95 theme-light:bg-gray-50 theme-light:border-gray-200"
                >
                  <div className="flex items-center gap-4">
                    <div className={`w-14 h-14 rounded-xl bg-gradient-to-br ${entity.color} flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform`}>
                      <Icon className="w-7 h-7 text-white" />
                    </div>
                    <div className="text-left flex-1">
                      <h4 className="text-white font-bold theme-light:text-gray-900">{entity.name}</h4>
                      <p className="text-gray-400 text-xs theme-light:text-gray-600">CSV, Excel, JSON</p>
                    </div>
                    <ArrowRight className="w-5 h-5 text-cyan-400 group-hover:translate-x-1 transition-transform" />
                  </div>
                </button>
              );
            })}
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                {(() => {
                  const Icon = entities.find(e => e.key === importMode).icon;
                  return <Icon className="w-6 h-6 text-cyan-400" />;
                })()}
                <h4 className="text-white font-bold theme-light:text-gray-900">
                  {entities.find(e => e.key === importMode).name}
                </h4>
              </div>
              <Button variant="ghost" onClick={() => { setImportMode(null); setFile(null); setPreview(null); }} className="text-gray-400">
                Cambiar
              </Button>
            </div>

            {/* File Upload */}
            {!file && (
              <label className="group cursor-pointer block">
                <div className="border-2 border-dashed border-cyan-500/30 group-hover:border-cyan-500/60 rounded-xl p-8 transition-all bg-gradient-to-br from-cyan-500/5 to-blue-500/5 group-hover:from-cyan-500/10 group-hover:to-blue-500/10">
                  <div className="text-center">
                    <Upload className="w-12 h-12 text-cyan-400 mx-auto mb-4" />
                    <p className="text-white font-bold mb-2 theme-light:text-gray-900">
                      Arrastra tu archivo o haz clic
                    </p>
                    <p className="text-gray-400 text-sm theme-light:text-gray-600">
                      CSV, Excel (.xlsx, .xls), JSON o TXT
                    </p>
                    <div className="flex items-center justify-center gap-3 mt-4">
                      <FileSpreadsheet className="w-5 h-5 text-emerald-400" />
                      <FileJson className="w-5 h-5 text-blue-400" />
                      <FileText className="w-5 h-5 text-orange-400" />
                    </div>
                  </div>
                </div>
                <input 
                  type="file" 
                  accept=".csv,.xlsx,.xls,.json,.txt"
                  onChange={handleFileSelect}
                  className="hidden"
                />
              </label>
            )}

            {/* File Selected */}
            {file && !preview && (
              <div className="bg-gradient-to-br from-blue-600/10 to-indigo-600/10 border border-blue-500/30 rounded-xl p-6">
                <div className="flex items-center gap-4 mb-4">
                  <FileCheck className="w-8 h-8 text-blue-400" />
                  <div className="flex-1">
                    <h4 className="text-white font-bold theme-light:text-gray-900">{file.name}</h4>
                    <p className="text-gray-400 text-sm theme-light:text-gray-600">
                      {(file.size / 1024).toFixed(2)} KB
                    </p>
                  </div>
                </div>
                <Button 
                  onClick={analyzeWithAI} 
                  disabled={loading}
                  className="w-full bg-gradient-to-r from-indigo-600 to-blue-600 h-12 text-base font-bold shadow-lg"
                >
                  {loading ? (
                    <>
                      <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                      {processingStep || "Procesando..."}
                    </>
                  ) : (
                    <>
                      <Brain className="w-5 h-5 mr-2" />
                      Analizar con IA
                    </>
                  )}
                </Button>
                <p className="text-center text-xs text-gray-400 mt-3 theme-light:text-gray-600">
                  La IA detectará y mapeará automáticamente tus columnas
                </p>
              </div>
            )}

            {/* Preview */}
            {preview && preview.length > 0 && (
              <div className="space-y-4">
                <div className="bg-gradient-to-br from-green-600/10 to-emerald-600/10 border border-green-500/30 rounded-xl p-6">
                  <div className="flex items-center gap-3 mb-4">
                    <Eye className="w-6 h-6 text-green-400" />
                    <h4 className="text-white font-bold theme-light:text-gray-900">
                      Vista Previa ({preview.length} registros)
                    </h4>
                  </div>

                  <div className="bg-black/40 rounded-lg p-4 max-h-96 overflow-auto theme-light:bg-white">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-white/10">
                          {Object.keys(preview[0]).slice(0, 5).map(key => (
                            <th key={key} className="text-left text-gray-400 py-2 px-3 theme-light:text-gray-700">
                              {key}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {preview.slice(0, 5).map((row, idx) => (
                          <tr key={idx} className="border-b border-white/5">
                            {Object.values(row).slice(0, 5).map((val, i) => (
                              <td key={i} className="text-white py-2 px-3 theme-light:text-gray-900">
                                {String(val).substring(0, 50)}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {mapping && (
                    <div className="mt-4 p-4 bg-blue-600/10 border border-blue-500/30 rounded-lg">
                      <div className="flex items-center gap-2 mb-2">
                        <Zap className="w-4 h-4 text-blue-400" />
                        <p className="text-blue-300 font-bold text-sm theme-light:text-blue-700">Mapeo IA detectado</p>
                      </div>
                      <div className="grid grid-cols-2 gap-2 text-xs">
                        {Object.entries(mapping).slice(0, 6).map(([original, mapped]) => (
                          <div key={original} className="flex items-center gap-2">
                            <span className="text-gray-400 theme-light:text-gray-600">{original}</span>
                            <ArrowRight className="w-3 h-3 text-cyan-400" />
                            <span className="text-cyan-400 font-bold">{mapped}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                <div className="flex gap-3">
                  <Button 
                    variant="outline" 
                    onClick={() => { setPreview(null); setMapping(null); }}
                    className="flex-1 border-white/15"
                  >
                    Cancelar
                  </Button>
                  <Button 
                    onClick={handleImport}
                    disabled={loading}
                    className="flex-1 bg-gradient-to-r from-green-600 to-emerald-600 h-12 font-bold"
                  >
                    {loading ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Importando...
                      </>
                    ) : (
                      <>
                        <CheckCircle className="w-4 h-4 mr-2" />
                        Importar Ahora
                      </>
                    )}
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}
      </Card>

      {/* Export Section */}
      <Card className="bg-black/40 border border-cyan-500/20 p-6 theme-light:bg-white theme-light:border-gray-200">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-emerald-600 to-green-600 flex items-center justify-center shadow-lg">
            <Download className="w-6 h-6 text-white" />
          </div>
          <div>
            <h3 className="text-white font-bold text-xl theme-light:text-gray-900">Exportar Datos</h3>
            <p className="text-gray-400 text-sm theme-light:text-gray-600">Descarga tus datos en CSV</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {entities.map((entity) => {
            const Icon = entity.icon;
            return (
              <button
                key={entity.key}
                onClick={() => handleExport(entity.key)}
                disabled={loading}
                className="group relative overflow-hidden bg-black/30 border border-white/10 hover:border-green-500/50 rounded-xl p-4 transition-all hover:scale-105 active:scale-95 disabled:opacity-50 theme-light:bg-gray-50 theme-light:border-gray-200"
              >
                <div className="flex items-center gap-3">
                  <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${entity.color} flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform`}>
                    <Icon className="w-6 h-6 text-white" />
                  </div>
                  <div className="text-left flex-1">
                    <h4 className="text-white font-bold text-sm theme-light:text-gray-900">{entity.name}</h4>
                    <p className="text-gray-400 text-xs theme-light:text-gray-600">Exportar a CSV</p>
                  </div>
                  <Download className="w-5 h-5 text-emerald-400 group-hover:translate-y-1 transition-transform" />
                </div>
              </button>
            );
          })}
        </div>
      </Card>

      {/* Info */}
      <div className="bg-gradient-to-r from-indigo-600/10 to-blue-600/10 border border-indigo-500/30 rounded-xl p-6 theme-light:bg-indigo-50 theme-light:border-indigo-300">
        <div className="flex items-start gap-4">
          <Sparkles className="w-6 h-6 text-indigo-400 flex-shrink-0 theme-light:text-indigo-600" />
          <div className="flex-1">
            <h4 className="text-white font-bold mb-2 theme-light:text-gray-900">🤖 Migración Inteligente con IA</h4>
            <ul className="text-indigo-200/90 text-sm space-y-1 theme-light:text-gray-700">
              <li>• La IA adapta automáticamente cualquier formato a tu sistema</li>
              <li>• Detecta y mapea columnas sin configuración manual</li>
              <li>• Soporta CSV, Excel, JSON y archivos de texto</li>
              <li>• Valida datos antes de importar para evitar errores</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
