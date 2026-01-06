import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { base44 } from "@/api/base44Client";
import { Download, Upload, FileSpreadsheet, Loader2, CheckCircle, FileText } from "lucide-react";
import { generateExpensesPDF, generateEventsPDF } from "./PDFExporter";

export default function ImportExportModal({ open, onOpenChange, type, data, onImport, clients }) {
  const [importing, setImporting] = useState(false);
  const [importSuccess, setImportSuccess] = useState(false);

  const generateCSV = (items, fields) => {
    const headers = fields.join(",");
    const rows = items.map(item => 
      fields.map(field => {
        const value = item[field];
        if (value === null || value === undefined) return "";
        if (typeof value === "string" && (value.includes(",") || value.includes('"'))) {
          return `"${value.replace(/"/g, '""')}"`;
        }
        return value;
      }).join(",")
    );
    return [headers, ...rows].join("\n");
  };

  const handleExportCSV = () => {
    let csv, filename;
    
    if (type === "expenses") {
      const fields = ["title", "amount", "type", "currency", "date", "is_personal", "notes"];
      csv = generateCSV(data, fields);
      filename = `expenses_${new Date().toISOString().split("T")[0]}.csv`;
    } else {
      const fields = ["title", "description", "date", "time", "location", "is_personal", "status", "notes"];
      csv = generateCSV(data, fields);
      filename = `events_${new Date().toISOString().split("T")[0]}.csv`;
    }

    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleExportPDF = () => {
    let htmlContent, filename;
    
    if (type === "expenses") {
      htmlContent = generateExpensesPDF(data, clients);
      filename = `expenses_${new Date().toISOString().split("T")[0]}.pdf`;
    } else {
      htmlContent = generateEventsPDF(data, clients);
      filename = `events_${new Date().toISOString().split("T")[0]}.pdf`;
    }

    // Open print dialog which allows saving as PDF
    const printWindow = window.open('', '_blank');
    printWindow.document.write(htmlContent);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => {
      printWindow.print();
    }, 250);
  };

  const handleImport = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setImporting(true);
    setImportSuccess(false);

    const { file_url } = await base44.integrations.Core.UploadFile({ file });

    const schema = type === "expenses" 
      ? {
          type: "array",
          items: {
            type: "object",
            properties: {
              title: { type: "string" },
              amount: { type: "number" },
              type: { type: "string" },
              currency: { type: "string" },
              date: { type: "string" },
              is_personal: { type: "boolean" },
              notes: { type: "string" }
            }
          }
        }
      : {
          type: "array",
          items: {
            type: "object",
            properties: {
              title: { type: "string" },
              description: { type: "string" },
              date: { type: "string" },
              time: { type: "string" },
              location: { type: "string" },
              is_personal: { type: "boolean" },
              status: { type: "string" },
              notes: { type: "string" }
            }
          }
        };

    const result = await base44.integrations.Core.ExtractDataFromUploadedFile({
      file_url,
      json_schema: schema
    });

    if (result.status === "success" && result.output) {
      await onImport(result.output);
      setImportSuccess(true);
    }

    setImporting(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-xl font-semibold flex items-center gap-2">
            <FileSpreadsheet className="w-5 h-5 text-emerald-600" />
            Import / Export {type === "expenses" ? "Expenses" : "Events"}
          </DialogTitle>
        </DialogHeader>

        <Tabs defaultValue="export" className="mt-4">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="export">Export</TabsTrigger>
            <TabsTrigger value="import">Import</TabsTrigger>
          </TabsList>

          <TabsContent value="export" className="space-y-4 pt-4">
            <p className="text-sm text-slate-500">
              Export all your {type} to a CSV file that you can open in Excel or Google Sheets.
            </p>
            <div className="bg-slate-50 rounded-xl p-4 text-center">
              <p className="text-2xl font-semibold text-slate-800">{data?.length || 0}</p>
              <p className="text-sm text-slate-500">{type} to export</p>
            </div>
            <div className="space-y-3">
              <Button 
                onClick={handleExportCSV} 
                className="w-full bg-emerald-600 hover:bg-emerald-700"
                disabled={!data?.length}
              >
                <FileSpreadsheet className="w-4 h-4 mr-2" />
                Download CSV
              </Button>
              <Button 
                onClick={handleExportPDF} 
                variant="outline"
                className="w-full"
                disabled={!data?.length}
              >
                <FileText className="w-4 h-4 mr-2" />
                Download PDF
              </Button>
            </div>
          </TabsContent>

          <TabsContent value="import" className="space-y-4 pt-4">
            <p className="text-sm text-slate-500">
              Import {type} from a CSV file. The file should have columns matching your data fields.
            </p>
            
            {importSuccess ? (
              <div className="bg-emerald-50 rounded-xl p-6 text-center">
                <CheckCircle className="w-12 h-12 text-emerald-600 mx-auto mb-2" />
                <p className="text-emerald-700 font-medium">Import successful!</p>
              </div>
            ) : (
              <div className="space-y-4">
                <Input
                  type="file"
                  accept=".csv"
                  onChange={handleImport}
                  disabled={importing}
                  className="hidden"
                  id="csv-import"
                />
                <Label
                  htmlFor="csv-import"
                  className={`flex flex-col items-center gap-3 p-8 border-2 border-dashed border-slate-200 rounded-xl cursor-pointer hover:bg-slate-50 transition-colors ${importing ? 'opacity-50 pointer-events-none' : ''}`}
                >
                  {importing ? (
                    <Loader2 className="w-8 h-8 text-emerald-600 animate-spin" />
                  ) : (
                    <Upload className="w-8 h-8 text-slate-400" />
                  )}
                  <span className="text-sm text-slate-500">
                    {importing ? "Processing..." : "Click to upload CSV file"}
                  </span>
                </Label>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
