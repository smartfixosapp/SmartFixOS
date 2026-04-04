import React, { useState, useRef, useCallback } from "react";
import { supabase } from "../../../../../lib/supabase-client.js";
import appClient from "@/api/appClient";
import { generateCustomerNumber } from "@/components/utils/sequenceHelpers";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  Upload, Download, FileSpreadsheet, FileText, Database,
  Users, Package, ShoppingCart, DollarSign,
  CheckCircle, AlertCircle, Loader2, ArrowRight, Eye,
  Trash2, Search, Filter, RefreshCw, Zap, Globe,
  AlertTriangle, FileCheck, X, Check, ChevronDown,
  BarChart3
} from "lucide-react";

// ═══════════════════════════════════════════════════════════════
// Platform Detection & Parsers
// ═══════════════════════════════════════════════════════════════

const PLATFORMS = {
  repairshopr: {
    name: "RepairShopr / HelloClient",
    icon: "🔧",
    color: "from-blue-600 to-indigo-600",
    description: "Base de datos exportada de RepairShopr o HelloClient"
  },
  square: {
    name: "Square",
    icon: "⬜",
    color: "from-green-600 to-emerald-600",
    description: "Datos exportados desde Square POS"
  },
  smartfixos: {
    name: "SmartFixOS",
    icon: "🛠️",
    color: "from-cyan-600 to-blue-600",
    description: "Formato nativo de SmartFixOS"
  },
  generic: {
    name: "CSV Genérico",
    icon: "📄",
    color: "from-gray-600 to-slate-600",
    description: "Archivo CSV con formato desconocido"
  }
};

function detectPlatform(headers) {
  const h = headers.map(col => col.toLowerCase().trim());

  // RepairShopr / HelloClient
  if (h.includes("firstname") && h.includes("lastname") && h.includes("customerfacingemail")) {
    return "repairshopr";
  }
  if (h.includes("firstname") && h.includes("lastname") && (h.includes("phonenumber") || h.includes("phone_number"))) {
    return "repairshopr";
  }

  // Square
  if (h.includes("customer name") || (h.includes("given name") && h.includes("family name"))) {
    return "square";
  }

  // SmartFixOS native
  if (h.includes("name") && h.includes("phone") && (h.includes("customer_number") || h.includes("tenant_id"))) {
    return "smartfixos";
  }

  return "generic";
}

// ── Phone cleaner ──
function cleanPhone(raw) {
  if (!raw) return "";
  let cleaned = String(raw).replace(/[^0-9+]/g, "");
  if (cleaned.length < 6) return "";
  return cleaned;
}

// ── Email validator ──
function isValidEmail(email) {
  if (!email) return false;
  const e = email.trim().toLowerCase();
  if (e.endsWith("@rsemail.com")) return false; // RepairShopr internal
  if (e.length < 5) return false;
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)) return false;
  return true;
}

// ── Junk record filter ──
function isJunkRecord(record) {
  const name = (record.name || "").toLowerCase().trim();
  if (!name || name.length < 2) return true;
  if (name === "anónimo" || name === "anonimo" || name === "anónimo anónimo") return true;
  if (name === "test" || name === "test test" || name === "prueba") return true;
  // Gibberish detector: too many consonants in a row
  if (/^[bcdfghjklmnpqrstvwxyz]{4,}/i.test(name.replace(/\s/g, ""))) return true;
  // Must have at least a valid phone or email
  if (!record.phone && !record.email) return true;
  return false;
}

// ── Platform-specific parsers ──
function parseRepairShopr(row, headers) {
  const get = (key) => {
    const idx = headers.findIndex(h => h.toLowerCase().trim() === key.toLowerCase());
    return idx >= 0 ? (row[idx] || "").trim() : "";
  };

  const firstName = get("firstName");
  const lastName = get("lastName");
  const name = `${firstName} ${lastName}`.trim();
  const phone = cleanPhone(get("phoneNumber") || get("phone_number") || get("phone"));
  const rawEmail = get("customerFacingEmail") || get("email");
  const email = isValidEmail(rawEmail) ? rawEmail.trim() : "";
  const city = get("city");

  return {
    name,
    phone,
    email,
    notes: city ? `Ciudad: ${city}` : "",
    _source: "repairshopr"
  };
}

function parseSquare(row, headers) {
  const get = (key) => {
    const idx = headers.findIndex(h => h.toLowerCase().trim() === key.toLowerCase());
    return idx >= 0 ? (row[idx] || "").trim() : "";
  };

  let name = get("customer name");
  if (!name) {
    const given = get("given name");
    const family = get("family name");
    name = `${given} ${family}`.trim();
  }
  const phone = cleanPhone(get("phone") || get("phone number"));
  const rawEmail = get("email") || get("email address");
  const email = isValidEmail(rawEmail) ? rawEmail.trim() : "";

  return { name, phone, email, notes: "", _source: "square" };
}

function parseSmartFixOS(row, headers) {
  const get = (key) => {
    const idx = headers.findIndex(h => h.toLowerCase().trim() === key.toLowerCase());
    return idx >= 0 ? (row[idx] || "").trim() : "";
  };

  return {
    name: get("name"),
    phone: cleanPhone(get("phone")),
    email: isValidEmail(get("email")) ? get("email").trim() : "",
    notes: get("notes"),
    _source: "smartfixos"
  };
}

function parseGeneric(row, headers) {
  const get = (key) => {
    const idx = headers.findIndex(h => h.toLowerCase().trim().includes(key.toLowerCase()));
    return idx >= 0 ? (row[idx] || "").trim() : "";
  };

  // Try to intelligently find name/phone/email columns
  let name = get("name") || get("nombre") || get("client") || get("customer");
  if (!name) {
    const first = get("first") || get("primer");
    const last = get("last") || get("apellido");
    name = `${first} ${last}`.trim();
  }

  const phone = cleanPhone(get("phone") || get("tel") || get("celular") || get("movil"));
  const rawEmail = get("email") || get("correo") || get("e-mail");
  const email = isValidEmail(rawEmail) ? rawEmail.trim() : "";

  return { name, phone, email, notes: "", _source: "generic" };
}

const PARSERS = {
  repairshopr: parseRepairShopr,
  square: parseSquare,
  smartfixos: parseSmartFixOS,
  generic: parseGeneric
};

// ═══════════════════════════════════════════════════════════════
// CSV Parser (handles quoted fields with commas)
// ═══════════════════════════════════════════════════════════════

function parseCSV(text) {
  const lines = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch === '"') {
      if (inQuotes && text[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === "\n" && !inQuotes) {
      if (current.trim()) lines.push(current);
      current = "";
    } else if (ch === "\r" && !inQuotes) {
      // skip \r
    } else {
      current += ch;
    }
  }
  if (current.trim()) lines.push(current);

  return lines.map(line => {
    const fields = [];
    let field = "";
    let inQ = false;
    for (let i = 0; i < line.length; i++) {
      const c = line[i];
      if (c === '"') {
        if (inQ && line[i + 1] === '"') { field += '"'; i++; }
        else inQ = !inQ;
      } else if (c === "," && !inQ) {
        fields.push(field);
        field = "";
      } else {
        field += c;
      }
    }
    fields.push(field);
    return fields;
  });
}

// ═══════════════════════════════════════════════════════════════
// Deduplication
// ═══════════════════════════════════════════════════════════════

function deduplicateRecords(records) {
  const seen = new Map();
  const unique = [];
  const duplicates = [];

  for (const r of records) {
    const phoneKey = r.phone ? r.phone.replace(/\D/g, "") : "";
    const emailKey = r.email ? r.email.toLowerCase() : "";
    const key = phoneKey || emailKey || r.name.toLowerCase();

    if (seen.has(key)) {
      duplicates.push(r);
    } else {
      seen.set(key, true);
      unique.push(r);
    }
  }

  return { unique, duplicates };
}

// ═══════════════════════════════════════════════════════════════
// ENTITIES CONFIG
// ═══════════════════════════════════════════════════════════════

const IMPORT_ENTITIES = [
  { key: "customers", name: "Clientes", icon: Users, color: "from-blue-600 to-indigo-600", entity: "Customer" },
  { key: "products", name: "Productos", icon: Package, color: "from-emerald-600 to-green-600", entity: "Product" },
];

const EXPORT_ENTITIES = [
  { key: "customers", name: "Clientes", icon: Users, color: "from-blue-600 to-indigo-600", entity: "Customer" },
  { key: "products", name: "Productos", icon: Package, color: "from-emerald-600 to-green-600", entity: "Product" },
  { key: "orders", name: "Órdenes", icon: ShoppingCart, color: "from-purple-600 to-pink-600", entity: "Order" },
  { key: "sales", name: "Ventas", icon: DollarSign, color: "from-amber-600 to-orange-600", entity: "Sale" },
];

// ═══════════════════════════════════════════════════════════════
// COMPONENT
// ═══════════════════════════════════════════════════════════════

export default function SmartImportExport() {
  const [mode, setMode] = useState(null); // "import" | "export"
  const [entityType, setEntityType] = useState(null);
  const [file, setFile] = useState(null);
  const [detectedPlatform, setDetectedPlatform] = useState(null);
  const [parsedRecords, setParsedRecords] = useState([]);
  const [junkRecords, setJunkRecords] = useState([]);
  const [duplicateRecords, setDuplicateRecords] = useState([]);
  const [selectedRecords, setSelectedRecords] = useState(new Set());
  const [importing, setImporting] = useState(false);
  const [importProgress, setImportProgress] = useState(null);
  const [exporting, setExporting] = useState(false);
  const [exportFormat, setExportFormat] = useState("csv");
  const [searchFilter, setSearchFilter] = useState("");
  const fileInputRef = useRef(null);

  // ── Reset ──
  const resetAll = () => {
    setMode(null);
    setEntityType(null);
    setFile(null);
    setDetectedPlatform(null);
    setParsedRecords([]);
    setJunkRecords([]);
    setDuplicateRecords([]);
    setSelectedRecords(new Set());
    setImportProgress(null);
    setSearchFilter("");
  };

  // ── File Selection & Parse ──
  const handleFileSelect = useCallback((e) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;

    if (!selectedFile.name.match(/\.(csv|json|txt)$/i)) {
      toast.error("Formato no soportado. Usa CSV, JSON o TXT");
      return;
    }

    setFile(selectedFile);

    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const text = ev.target.result;
        let records = [];
        let junk = [];

        if (selectedFile.name.endsWith(".json")) {
          const json = JSON.parse(text);
          const arr = Array.isArray(json) ? json : [json];
          records = arr.map(r => ({
            name: r.name || `${r.firstName || ""} ${r.lastName || ""}`.trim(),
            phone: cleanPhone(r.phone || r.phoneNumber || ""),
            email: isValidEmail(r.email || r.customerFacingEmail) ? (r.email || r.customerFacingEmail).trim() : "",
            notes: r.notes || r.city || "",
            _source: "json"
          }));
          setDetectedPlatform("smartfixos");
        } else {
          // CSV parsing
          const parsed = parseCSV(text);
          if (parsed.length < 2) {
            toast.error("Archivo vacío o sin datos");
            return;
          }

          const headers = parsed[0];
          const platform = detectPlatform(headers);
          setDetectedPlatform(platform);

          const parser = PARSERS[platform];

          for (let i = 1; i < parsed.length; i++) {
            const row = parsed[i];
            if (row.every(cell => !cell.trim())) continue;
            const record = parser(row, headers);
            records.push(record);
          }
        }

        // Separate junk
        const clean = [];
        for (const r of records) {
          if (isJunkRecord(r)) {
            junk.push(r);
          } else {
            clean.push(r);
          }
        }

        // Deduplicate
        const { unique, duplicates } = deduplicateRecords(clean);

        setParsedRecords(unique);
        setJunkRecords(junk);
        setDuplicateRecords(duplicates);
        setSelectedRecords(new Set(unique.map((_, i) => i)));

        toast.success(`${unique.length} registros válidos detectados`);
        if (junk.length > 0) toast.warning(`${junk.length} registros basura filtrados`);
        if (duplicates.length > 0) toast.warning(`${duplicates.length} duplicados removidos`);

      } catch (err) {
        console.error("Error parsing file:", err);
        toast.error("Error al procesar archivo: " + err.message);
      }
    };
    reader.readAsText(selectedFile, "UTF-8");
  }, []);

  // ── Toggle record selection ──
  const toggleRecord = (idx) => {
    setSelectedRecords(prev => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx);
      else next.add(idx);
      return next;
    });
  };

  const toggleAll = () => {
    if (selectedRecords.size === parsedRecords.length) {
      setSelectedRecords(new Set());
    } else {
      setSelectedRecords(new Set(parsedRecords.map((_, i) => i)));
    }
  };

  // ── Import ──
  const handleImport = async () => {
    const toImport = parsedRecords.filter((_, i) => selectedRecords.has(i));
    if (toImport.length === 0) {
      toast.error("Selecciona al menos un registro");
      return;
    }

    setImporting(true);
    setImportProgress({ total: toImport.length, done: 0, errors: 0, skipped: 0 });

    const tenantId = localStorage.getItem("current_tenant_id") || localStorage.getItem("smartfix_tenant_id");
    if (!tenantId) {
      toast.error("No se encontró el tenant activo. Verifica tu sesión.");
      setImporting(false);
      return;
    }

    let done = 0;
    let errors = 0;
    let skipped = 0;
    const batchSize = 20;

    try {
      for (let i = 0; i < toImport.length; i += batchSize) {
        const batch = toImport.slice(i, i + batchSize);

        const results = await Promise.allSettled(
          batch.map(async (record) => {
            try {
              // Check for existing customer by phone
              if (record.phone) {
                const { data: existing } = await supabase
                  .from("customer")
                  .select("id")
                  .eq("phone", record.phone)
                  .eq("tenant_id", tenantId)
                  .limit(1);
                if (existing && existing.length > 0) {
                  skipped++;
                  return "skipped";
                }
              }

              const customerNumber = await generateCustomerNumber();

              const customerData = {
                name: record.name,
                phone: record.phone || undefined,
                email: record.email || undefined,
                notes: record.notes || undefined,
                customer_number: customerNumber,
                total_orders: 0,
                loyalty_points: 0,
                loyalty_tier: "bronze",
                total_spent: 0,
                tenant_id: tenantId,
              };

              // Remove undefined fields
              Object.keys(customerData).forEach(k => {
                if (customerData[k] === undefined) delete customerData[k];
              });

              const { error } = await supabase
                .from("customer")
                .insert(customerData);

              if (error) throw error;
              done++;
              return "ok";
            } catch (err) {
              console.error("Import error for:", record.name, err);
              errors++;
              return "error";
            }
          })
        );

        setImportProgress({ total: toImport.length, done, errors, skipped });
      }

      if (done > 0) {
        toast.success(`${done} clientes importados exitosamente`);
      }
      if (skipped > 0) {
        toast.info(`${skipped} ya existían (saltados)`);
      }
      if (errors > 0) {
        toast.error(`${errors} errores durante la importación`);
      }

      // Refresh
      window.dispatchEvent(new Event("force-refresh"));

    } catch (err) {
      console.error("Import failed:", err);
      toast.error("Error fatal en importación: " + err.message);
    } finally {
      setImporting(false);
    }
  };

  // ── Export ──
  const handleExport = async (entityKey) => {
    setExporting(true);
    try {
      const entityConfig = EXPORT_ENTITIES.find(e => e.key === entityKey);
      const tenantId = localStorage.getItem("current_tenant_id") || localStorage.getItem("smartfix_tenant_id");

      let query = supabase
        .from(entityConfig.entity.toLowerCase())
        .select("*")
        .order("created_at", { ascending: false });

      if (tenantId) {
        query = query.eq("tenant_id", tenantId);
      }

      const { data, error } = await query.limit(10000);
      if (error) throw error;

      if (!data || data.length === 0) {
        toast.error("No hay datos para exportar");
        return;
      }

      let content, mimeType, ext;

      if (exportFormat === "json") {
        content = JSON.stringify(data, null, 2);
        mimeType = "application/json";
        ext = "json";
      } else {
        // CSV
        const headers = Object.keys(data[0]);
        const csvRows = [headers.join(",")];
        data.forEach(row => {
          const values = headers.map(h => {
            const val = row[h];
            if (val === null || val === undefined) return "";
            if (typeof val === "object") return `"${JSON.stringify(val).replace(/"/g, '""')}"`;
            return `"${String(val).replace(/"/g, '""')}"`;
          });
          csvRows.push(values.join(","));
        });
        content = csvRows.join("\n");
        mimeType = "text/csv;charset=utf-8";
        ext = "csv";
      }

      const blob = new Blob(["\uFEFF" + content], { type: mimeType });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${entityKey}_${new Date().toISOString().split("T")[0]}.${ext}`;
      a.click();
      URL.revokeObjectURL(url);

      toast.success(`${data.length} registros exportados`);
    } catch (err) {
      console.error("Export error:", err);
      toast.error("Error al exportar: " + err.message);
    } finally {
      setExporting(false);
    }
  };

  // ── Filtered records ──
  const filteredRecords = parsedRecords.filter(r => {
    if (!searchFilter) return true;
    const q = searchFilter.toLowerCase();
    return (r.name || "").toLowerCase().includes(q) ||
           (r.phone || "").includes(q) ||
           (r.email || "").toLowerCase().includes(q);
  });

  // ═══════════════════════════════════════════════════════════════
  // RENDER
  // ═══════════════════════════════════════════════════════════════

  // ── Mode Selection ──
  if (!mode) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Import Card */}
          <button
            onClick={() => setMode("import")}
            className="group relative overflow-hidden bg-black/40 border border-white/10 hover:border-cyan-500/50 rounded-2xl p-8 transition-all hover:scale-[1.02] active:scale-[0.98] text-left theme-light:bg-white theme-light:border-gray-200 theme-light:hover:border-blue-400"
          >
            <div className="flex items-start gap-5">
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-600 flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform">
                <Upload className="w-8 h-8 text-white" />
              </div>
              <div className="flex-1">
                <h3 className="text-white text-xl font-bold mb-2 theme-light:text-gray-900">Importar Datos</h3>
                <p className="text-gray-400 text-sm mb-4 theme-light:text-gray-600">
                  Migra clientes y productos desde otras plataformas
                </p>
                <div className="flex flex-wrap gap-2">
                  {["RepairShopr", "HelloClient", "Square", "CSV"].map(p => (
                    <Badge key={p} variant="outline" className="text-xs border-blue-500/30 text-blue-300 theme-light:border-blue-300 theme-light:text-blue-700">
                      {p}
                    </Badge>
                  ))}
                </div>
              </div>
            </div>
            <div className="absolute top-4 right-4">
              <ArrowRight className="w-5 h-5 text-cyan-400 group-hover:translate-x-1 transition-transform" />
            </div>
          </button>

          {/* Export Card */}
          <button
            onClick={() => setMode("export")}
            className="group relative overflow-hidden bg-black/40 border border-white/10 hover:border-emerald-500/50 rounded-2xl p-8 transition-all hover:scale-[1.02] active:scale-[0.98] text-left theme-light:bg-white theme-light:border-gray-200 theme-light:hover:border-green-400"
          >
            <div className="flex items-start gap-5">
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-emerald-600 to-green-600 flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform">
                <Download className="w-8 h-8 text-white" />
              </div>
              <div className="flex-1">
                <h3 className="text-white text-xl font-bold mb-2 theme-light:text-gray-900">Exportar Datos</h3>
                <p className="text-gray-400 text-sm mb-4 theme-light:text-gray-600">
                  Descarga respaldos o migra a otra plataforma
                </p>
                <div className="flex flex-wrap gap-2">
                  {["CSV", "JSON"].map(f => (
                    <Badge key={f} variant="outline" className="text-xs border-emerald-500/30 text-emerald-300 theme-light:border-green-300 theme-light:text-green-700">
                      {f}
                    </Badge>
                  ))}
                </div>
              </div>
            </div>
            <div className="absolute top-4 right-4">
              <ArrowRight className="w-5 h-5 text-emerald-400 group-hover:translate-x-1 transition-transform" />
            </div>
          </button>
        </div>

        {/* Supported Platforms Info */}
        <Card className="bg-gradient-to-r from-indigo-600/10 to-blue-600/10 border border-indigo-500/30 p-6 theme-light:bg-indigo-50 theme-light:border-indigo-200">
          <div className="flex items-start gap-4">
            <Globe className="w-6 h-6 text-indigo-400 flex-shrink-0 theme-light:text-indigo-600" />
            <div>
              <h4 className="text-white font-bold mb-3 theme-light:text-gray-900">Plataformas Soportadas</h4>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {Object.entries(PLATFORMS).map(([key, p]) => (
                  <div key={key} className="flex items-center gap-2 text-sm">
                    <span className="text-lg">{p.icon}</span>
                    <span className="text-gray-300 theme-light:text-gray-700">{p.name}</span>
                  </div>
                ))}
              </div>
              <p className="text-indigo-300/70 text-xs mt-3 theme-light:text-indigo-600">
                La deteccion es automatica. Solo sube el archivo y el sistema identifica la plataforma de origen.
              </p>
            </div>
          </div>
        </Card>
      </div>
    );
  }

  // ═══════════════════════════════════════════════════════════════
  // EXPORT MODE
  // ═══════════════════════════════════════════════════════════════
  if (mode === "export") {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Download className="w-6 h-6 text-emerald-400" />
            <h3 className="text-white text-xl font-bold theme-light:text-gray-900">Exportar Datos</h3>
          </div>
          <Button variant="ghost" onClick={resetAll} className="text-gray-400 hover:text-white">
            <X className="w-4 h-4 mr-1" /> Volver
          </Button>
        </div>

        {/* Format selector */}
        <div className="flex gap-3">
          {[{ id: "csv", label: "CSV", icon: FileText }, { id: "json", label: "JSON", icon: Database }].map(f => (
            <button
              key={f.id}
              onClick={() => setExportFormat(f.id)}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl border-2 transition-all ${
                exportFormat === f.id
                  ? "bg-emerald-600/20 border-emerald-500/50 text-white"
                  : "bg-black/20 border-white/10 text-gray-400 hover:border-white/20 theme-light:bg-gray-50 theme-light:border-gray-200"
              }`}
            >
              <f.icon className="w-4 h-4" />
              {f.label}
            </button>
          ))}
        </div>

        {/* Entity cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {EXPORT_ENTITIES.map((entity) => {
            const Icon = entity.icon;
            return (
              <button
                key={entity.key}
                onClick={() => handleExport(entity.key)}
                disabled={exporting}
                className="group bg-black/30 border border-white/10 hover:border-emerald-500/40 rounded-xl p-5 transition-all hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 theme-light:bg-gray-50 theme-light:border-gray-200"
              >
                <div className="flex items-center gap-4">
                  <div className={`w-14 h-14 rounded-xl bg-gradient-to-br ${entity.color} flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform`}>
                    <Icon className="w-7 h-7 text-white" />
                  </div>
                  <div className="text-left flex-1">
                    <h4 className="text-white font-bold theme-light:text-gray-900">{entity.name}</h4>
                    <p className="text-gray-400 text-xs theme-light:text-gray-600">
                      Exportar a {exportFormat.toUpperCase()}
                    </p>
                  </div>
                  {exporting ? (
                    <Loader2 className="w-5 h-5 text-emerald-400 animate-spin" />
                  ) : (
                    <Download className="w-5 h-5 text-emerald-400 group-hover:translate-y-1 transition-transform" />
                  )}
                </div>
              </button>
            );
          })}
        </div>

        <div className="bg-blue-600/10 border border-blue-500/20 rounded-xl p-4 theme-light:bg-blue-50 theme-light:border-blue-200">
          <p className="text-blue-300 text-xs theme-light:text-blue-700">
            Los datos exportados son del tenant actual. El archivo incluye BOM para compatibilidad con Excel.
          </p>
        </div>
      </div>
    );
  }

  // ═══════════════════════════════════════════════════════════════
  // IMPORT MODE
  // ═══════════════════════════════════════════════════════════════
  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Upload className="w-6 h-6 text-blue-400" />
          <h3 className="text-white text-xl font-bold theme-light:text-gray-900">Importar Clientes</h3>
        </div>
        <Button variant="ghost" onClick={resetAll} className="text-gray-400 hover:text-white">
          <X className="w-4 h-4 mr-1" /> Volver
        </Button>
      </div>

      {/* File Upload Area */}
      {!file && (
        <label className="group cursor-pointer block">
          <div className="border-2 border-dashed border-blue-500/30 group-hover:border-blue-500/60 rounded-2xl p-10 transition-all bg-gradient-to-br from-blue-500/5 to-indigo-500/5 group-hover:from-blue-500/10 group-hover:to-indigo-500/10">
            <div className="text-center">
              <Upload className="w-14 h-14 text-blue-400 mx-auto mb-4" />
              <p className="text-white font-bold text-lg mb-2 theme-light:text-gray-900">
                Sube tu archivo de clientes
              </p>
              <p className="text-gray-400 text-sm mb-4 theme-light:text-gray-600">
                CSV, JSON o TXT - El sistema detecta la plataforma automaticamente
              </p>
              <div className="flex items-center justify-center gap-4 text-xs text-gray-500">
                {Object.entries(PLATFORMS).slice(0, 3).map(([k, p]) => (
                  <span key={k} className="flex items-center gap-1">
                    <span>{p.icon}</span> {p.name}
                  </span>
                ))}
              </div>
            </div>
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv,.json,.txt"
            onChange={handleFileSelect}
            className="hidden"
          />
        </label>
      )}

      {/* Platform Detection Badge */}
      {detectedPlatform && (
        <div className={`bg-gradient-to-r ${PLATFORMS[detectedPlatform].color}/10 border border-white/10 rounded-xl p-4 flex items-center gap-4 theme-light:border-gray-200`}>
          <span className="text-2xl">{PLATFORMS[detectedPlatform].icon}</span>
          <div className="flex-1">
            <p className="text-white font-bold theme-light:text-gray-900">
              Plataforma detectada: {PLATFORMS[detectedPlatform].name}
            </p>
            <p className="text-gray-400 text-xs theme-light:text-gray-600">
              {file?.name} - {PLATFORMS[detectedPlatform].description}
            </p>
          </div>
          <Badge className="bg-green-600/20 text-green-400 border-green-500/30">
            <Check className="w-3 h-3 mr-1" /> Detectado
          </Badge>
        </div>
      )}

      {/* Stats Bar */}
      {parsedRecords.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="bg-green-600/10 border border-green-500/20 rounded-xl p-3 text-center theme-light:bg-green-50 theme-light:border-green-200">
            <p className="text-green-400 text-2xl font-bold theme-light:text-green-700">{parsedRecords.length}</p>
            <p className="text-gray-400 text-xs theme-light:text-gray-600">Válidos</p>
          </div>
          <div className="bg-blue-600/10 border border-blue-500/20 rounded-xl p-3 text-center theme-light:bg-blue-50 theme-light:border-blue-200">
            <p className="text-blue-400 text-2xl font-bold theme-light:text-blue-700">{selectedRecords.size}</p>
            <p className="text-gray-400 text-xs theme-light:text-gray-600">Seleccionados</p>
          </div>
          <div className="bg-amber-600/10 border border-amber-500/20 rounded-xl p-3 text-center theme-light:bg-amber-50 theme-light:border-amber-200">
            <p className="text-amber-400 text-2xl font-bold theme-light:text-amber-700">{duplicateRecords.length}</p>
            <p className="text-gray-400 text-xs theme-light:text-gray-600">Duplicados</p>
          </div>
          <div className="bg-red-600/10 border border-red-500/20 rounded-xl p-3 text-center theme-light:bg-red-50 theme-light:border-red-200">
            <p className="text-red-400 text-2xl font-bold theme-light:text-red-700">{junkRecords.length}</p>
            <p className="text-gray-400 text-xs theme-light:text-gray-600">Descartados</p>
          </div>
        </div>
      )}

      {/* Search + Actions Bar */}
      {parsedRecords.length > 0 && (
        <div className="flex items-center gap-3 flex-wrap">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
            <input
              type="text"
              value={searchFilter}
              onChange={(e) => setSearchFilter(e.target.value)}
              placeholder="Buscar por nombre, teléfono o email..."
              className="w-full bg-black/30 border border-white/10 rounded-xl pl-10 pr-4 py-2.5 text-white text-sm placeholder-gray-500 focus:border-cyan-500/50 focus:outline-none theme-light:bg-white theme-light:border-gray-300 theme-light:text-gray-900"
            />
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={toggleAll}
            className="border-white/15 text-gray-300 hover:text-white"
          >
            {selectedRecords.size === parsedRecords.length ? "Deseleccionar todo" : "Seleccionar todo"}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => { setFile(null); setParsedRecords([]); setDetectedPlatform(null); setSelectedRecords(new Set()); }}
            className="border-white/15 text-gray-300 hover:text-white"
          >
            <RefreshCw className="w-4 h-4 mr-1" /> Cambiar archivo
          </Button>
        </div>
      )}

      {/* Records Preview Table */}
      {parsedRecords.length > 0 && (
        <Card className="bg-black/30 border border-white/10 overflow-hidden theme-light:bg-white theme-light:border-gray-200">
          <div className="max-h-[400px] overflow-auto">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-black/60 backdrop-blur-sm z-10 theme-light:bg-gray-100">
                <tr className="border-b border-white/10 theme-light:border-gray-200">
                  <th className="text-left text-gray-400 py-3 px-4 w-10 theme-light:text-gray-600">#</th>
                  <th className="text-left text-gray-400 py-3 px-4 theme-light:text-gray-600">Nombre</th>
                  <th className="text-left text-gray-400 py-3 px-4 theme-light:text-gray-600">Teléfono</th>
                  <th className="text-left text-gray-400 py-3 px-4 theme-light:text-gray-600">Email</th>
                  <th className="text-center text-gray-400 py-3 px-4 w-10 theme-light:text-gray-600">
                    <Check className="w-4 h-4 mx-auto" />
                  </th>
                </tr>
              </thead>
              <tbody>
                {filteredRecords.map((r, displayIdx) => {
                  const realIdx = parsedRecords.indexOf(r);
                  const isSelected = selectedRecords.has(realIdx);
                  return (
                    <tr
                      key={realIdx}
                      onClick={() => toggleRecord(realIdx)}
                      className={`border-b border-white/5 cursor-pointer transition-colors ${
                        isSelected
                          ? "bg-blue-600/10 hover:bg-blue-600/15"
                          : "bg-transparent hover:bg-white/5 opacity-50"
                      } theme-light:border-gray-100`}
                    >
                      <td className="py-2.5 px-4 text-gray-500 text-xs">{realIdx + 1}</td>
                      <td className="py-2.5 px-4 text-white font-medium theme-light:text-gray-900">{r.name}</td>
                      <td className="py-2.5 px-4 text-gray-300 theme-light:text-gray-700">{r.phone || "—"}</td>
                      <td className="py-2.5 px-4 text-gray-300 text-xs theme-light:text-gray-700">
                        {r.email || <span className="text-gray-600 italic">sin email</span>}
                      </td>
                      <td className="py-2.5 px-4 text-center">
                        <div className={`w-5 h-5 rounded border-2 flex items-center justify-center mx-auto transition-all ${
                          isSelected
                            ? "bg-blue-600 border-blue-500"
                            : "border-white/20 theme-light:border-gray-300"
                        }`}>
                          {isSelected && <Check className="w-3 h-3 text-white" />}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* Import Progress */}
      {importProgress && (
        <Card className="bg-black/40 border border-cyan-500/20 p-5 theme-light:bg-white theme-light:border-gray-200">
          <div className="flex items-center gap-3 mb-3">
            {importing ? (
              <Loader2 className="w-5 h-5 text-cyan-400 animate-spin" />
            ) : (
              <CheckCircle className="w-5 h-5 text-green-400" />
            )}
            <h4 className="text-white font-bold theme-light:text-gray-900">
              {importing ? "Importando..." : "Importación completada"}
            </h4>
          </div>

          {/* Progress bar */}
          <div className="w-full bg-black/40 rounded-full h-3 mb-3 theme-light:bg-gray-200">
            <div
              className="bg-gradient-to-r from-blue-600 to-cyan-500 h-3 rounded-full transition-all duration-300"
              style={{ width: `${Math.round(((importProgress.done + importProgress.errors + importProgress.skipped) / importProgress.total) * 100)}%` }}
            />
          </div>

          <div className="grid grid-cols-4 gap-3 text-center text-xs">
            <div>
              <p className="text-gray-400 theme-light:text-gray-600">Total</p>
              <p className="text-white font-bold theme-light:text-gray-900">{importProgress.total}</p>
            </div>
            <div>
              <p className="text-gray-400 theme-light:text-gray-600">Importados</p>
              <p className="text-green-400 font-bold">{importProgress.done}</p>
            </div>
            <div>
              <p className="text-gray-400 theme-light:text-gray-600">Saltados</p>
              <p className="text-amber-400 font-bold">{importProgress.skipped}</p>
            </div>
            <div>
              <p className="text-gray-400 theme-light:text-gray-600">Errores</p>
              <p className="text-red-400 font-bold">{importProgress.errors}</p>
            </div>
          </div>
        </Card>
      )}

      {/* Import Button */}
      {parsedRecords.length > 0 && !importing && (
        <div className="flex gap-3">
          <Button
            variant="outline"
            onClick={resetAll}
            className="flex-1 border-white/15 h-12"
          >
            Cancelar
          </Button>
          <Button
            onClick={handleImport}
            disabled={selectedRecords.size === 0}
            className="flex-1 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 h-12 text-base font-bold shadow-lg disabled:opacity-50"
          >
            <Upload className="w-5 h-5 mr-2" />
            Importar {selectedRecords.size} Clientes
          </Button>
        </div>
      )}

      {/* Junk/Duplicate details (collapsed) */}
      {(junkRecords.length > 0 || duplicateRecords.length > 0) && (
        <details className="group">
          <summary className="cursor-pointer text-gray-400 text-xs flex items-center gap-2 hover:text-gray-300 theme-light:text-gray-600">
            <ChevronDown className="w-4 h-4 group-open:rotate-180 transition-transform" />
            Ver {junkRecords.length} descartados y {duplicateRecords.length} duplicados
          </summary>
          <div className="mt-3 space-y-2">
            {junkRecords.map((r, i) => (
              <div key={`junk-${i}`} className="flex items-center gap-3 text-xs text-red-400/70 bg-red-600/5 rounded-lg px-3 py-2">
                <Trash2 className="w-3 h-3" />
                <span>{r.name || "(sin nombre)"} - {r.phone || "sin tel"} - {r.email || "sin email"}</span>
                <Badge variant="outline" className="text-[10px] border-red-500/30">basura</Badge>
              </div>
            ))}
            {duplicateRecords.map((r, i) => (
              <div key={`dup-${i}`} className="flex items-center gap-3 text-xs text-amber-400/70 bg-amber-600/5 rounded-lg px-3 py-2">
                <AlertTriangle className="w-3 h-3" />
                <span>{r.name} - {r.phone || "sin tel"} - {r.email || "sin email"}</span>
                <Badge variant="outline" className="text-[10px] border-amber-500/30">duplicado</Badge>
              </div>
            ))}
          </div>
        </details>
      )}
    </div>
  );
}
