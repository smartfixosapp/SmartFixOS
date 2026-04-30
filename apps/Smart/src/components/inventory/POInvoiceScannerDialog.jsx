/**
 * POInvoiceScannerDialog
 *
 * Único punto de IA en SmartFixOS: escaneo de facturas de proveedor para
 * autollenar una nueva Orden de Compra.
 *
 * Flujo:
 *   1. Usuario abre PurchaseOrderDialog para crear una PO nueva.
 *   2. Toca "Escanear factura con IA" → este modal se abre.
 *   3. Toma foto o sube PDF/imagen de la factura del proveedor.
 *   4. Backend `/ai/extract-expense` (document_type=invoice) extrae:
 *        - supplier_name
 *        - line_items[] (product_name, quantity, unit_cost, line_total)
 *        - invoice_number, date
 *        - subtotal, tax_amount, shipping_cost, total_amount
 *   5. Usuario revisa los datos extraídos.
 *   6. Confirma → `onExtracted(data)` rellena el form principal de la PO.
 *
 * NOTA: NO crea la PO directamente — solo extrae datos. El usuario
 * confirma/edita en PurchaseOrderDialog antes de guardar.
 */

import React, { useState, useRef } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  Sparkles, Loader2, Camera, Upload, ArrowLeft, X,
  Package, CheckCircle2, AlertCircle, Building2,
} from "lucide-react";
import { base44 } from "@/api/base44Client";
import { toast } from "sonner";

const FUNCTIONS_URL = import.meta.env.VITE_FUNCTION_URL || "https://smartfixos.onrender.com";

export default function POInvoiceScannerDialog({ open, onClose, onExtracted }) {
  // step: "upload" | "processing" | "confirm" | "saving"
  const [step, setStep] = useState("upload");
  const [file, setFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [extracted, setExtracted] = useState(null);
  const [error, setError] = useState("");
  const fileInputRef = useRef(null);
  const cameraInputRef = useRef(null);

  const reset = () => {
    setStep("upload");
    setFile(null);
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(null);
    setExtracted(null);
    setError("");
  };

  const handleClose = () => {
    reset();
    onClose?.();
  };

  const handleFileSelect = (e) => {
    const selected = e.target.files?.[0];
    if (!selected) return;
    const isImage = selected.type.startsWith("image/");
    const isPdf = selected.type === "application/pdf";
    if (!isImage && !isPdf) {
      toast.error("Solo se aceptan imágenes (PNG, JPG, WEBP) o PDF");
      return;
    }
    if (selected.size > 10 * 1024 * 1024) {
      toast.error("Archivo muy grande (max 10MB)");
      return;
    }
    setFile(selected);
    setPreviewUrl(URL.createObjectURL(selected));
    setError("");
  };

  const handleProcess = async () => {
    if (!file) return;
    setStep("processing");
    setError("");
    try {
      // 1. Subir archivo
      const uploadResult = await base44.integrations.Core.UploadFile({ file, category: "purchase_orders" });
      const uploadedUrl = uploadResult?.file_url;
      if (!uploadedUrl) throw new Error("No se pudo subir el archivo");

      // 2. Extraer con IA (mismo endpoint que ya existe — document_type=invoice)
      const res = await fetch(`${FUNCTIONS_URL}/ai/extract-expense`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ file_url: uploadedUrl, document_type: "invoice" }),
      });
      if (!res.ok) {
        const errBody = await res.json().catch(() => ({}));
        throw new Error(errBody.error || `Error ${res.status}`);
      }
      const data = await res.json();
      setExtracted({ ...data, file_url: uploadedUrl });
      setStep("confirm");
    } catch (err) {
      console.error("AI extract error:", err);
      setError(err.message || "Error procesando la factura");
      setStep("upload");
    }
  };

  const handleConfirm = () => {
    if (!extracted) return;
    // Pasar datos al padre para que rellene el form de la PO.
    onExtracted?.({
      supplier_name: extracted.supplier_name || "",
      invoice_number: extracted.invoice_number || "",
      order_date: extracted.date || new Date().toISOString().slice(0, 10),
      line_items: (extracted.line_items || []).map((it, i) => ({
        id: `ai-${Date.now()}-${i}`,
        product_name: it.product_name || "",
        quantity: Number(it.quantity || 1),
        unit_cost: Number(it.unit_cost || 0),
        line_total: Number(
          it.line_total ?? (Number(it.unit_cost || 0) * Number(it.quantity || 1))
        ),
      })),
      subtotal: Number(extracted.subtotal || 0),
      tax_amount: Number(extracted.tax_amount || 0),
      shipping_cost: Number(extracted.shipping_cost || 0),
      total_amount: Number(extracted.total_amount || 0),
      file_url: extracted.file_url,
    });
    toast.success("Datos cargados. Revisa antes de guardar.");
    handleClose();
  };

  const lineItems = extracted?.line_items || [];

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) handleClose(); }}>
      <DialogContent className="max-w-lg p-0 overflow-hidden bg-[#0D0D0F] border border-white/10">
        <DialogHeader className="px-5 pt-5 pb-3 border-b border-white/[0.06]">
          <DialogTitle className="flex items-center gap-2 text-white">
            <div className="w-8 h-8 rounded-xl bg-amber-500/15 flex items-center justify-center">
              <Sparkles className="w-4 h-4 text-amber-400" />
            </div>
            <span>Escanear factura de proveedor</span>
          </DialogTitle>
        </DialogHeader>

        <div className="p-5 max-h-[70dvh] overflow-y-auto">
          {/* ─── STEP: UPLOAD ────────────────────────────────────────── */}
          {step === "upload" && (
            <div className="space-y-4">
              {error && (
                <div className="flex items-start gap-2 p-3 rounded-xl border border-red-500/30 bg-red-500/10 text-red-300 text-sm">
                  <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                  <span>{error}</span>
                </div>
              )}

              {!previewUrl ? (
                <>
                  <p className="text-sm text-white/60">
                    Toma una foto de la factura o sube un archivo. La IA extraerá
                    automáticamente el proveedor, las piezas y los precios.
                  </p>
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      onClick={() => cameraInputRef.current?.click()}
                      className="border-2 border-dashed border-amber-500/40 bg-amber-500/5 rounded-2xl p-6 flex flex-col items-center gap-2 hover:bg-amber-500/10 transition-colors"
                    >
                      <Camera className="w-8 h-8 text-amber-400" />
                      <p className="text-sm font-bold text-amber-300">Tomar foto</p>
                      <p className="text-[11px] text-white/40 text-center">Usa la cámara</p>
                    </button>
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      className="border-2 border-dashed border-amber-500/40 bg-amber-500/5 rounded-2xl p-6 flex flex-col items-center gap-2 hover:bg-amber-500/10 transition-colors"
                    >
                      <Upload className="w-8 h-8 text-amber-400" />
                      <p className="text-sm font-bold text-amber-300">Subir archivo</p>
                      <p className="text-[11px] text-white/40 text-center">PNG, JPG o PDF</p>
                    </button>
                  </div>
                  <input
                    ref={cameraInputRef}
                    type="file"
                    accept="image/*"
                    capture="environment"
                    className="hidden"
                    onChange={handleFileSelect}
                  />
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*,application/pdf"
                    className="hidden"
                    onChange={handleFileSelect}
                  />
                </>
              ) : (
                <div className="space-y-3">
                  <div className="relative rounded-2xl overflow-hidden border border-white/10 bg-black/40">
                    {file?.type === "application/pdf" ? (
                      <div className="flex items-center justify-center p-12 gap-3 text-white/70">
                        <Package className="w-8 h-8 text-amber-400" />
                        <span className="text-sm font-medium truncate">{file.name}</span>
                      </div>
                    ) : (
                      <img src={previewUrl} alt="Factura" className="w-full max-h-[300px] object-contain" />
                    )}
                    <button
                      onClick={() => { setFile(null); if (previewUrl) URL.revokeObjectURL(previewUrl); setPreviewUrl(null); }}
                      className="absolute top-2 right-2 w-8 h-8 rounded-full bg-black/70 backdrop-blur text-white flex items-center justify-center hover:bg-black"
                      aria-label="Descartar archivo"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                  <Button
                    onClick={handleProcess}
                    className="w-full h-11 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white font-bold"
                  >
                    <Sparkles className="w-4 h-4 mr-2" /> Extraer datos
                  </Button>
                </div>
              )}
            </div>
          )}

          {/* ─── STEP: PROCESSING ────────────────────────────────────── */}
          {step === "processing" && (
            <div className="flex flex-col items-center justify-center py-12 gap-4">
              <div className="relative">
                <Loader2 className="w-12 h-12 text-amber-400 animate-spin" />
                <Sparkles className="w-5 h-5 text-amber-300 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 animate-pulse" />
              </div>
              <p className="text-white font-bold text-sm">Analizando factura…</p>
              <p className="text-white/50 text-xs text-center">
                Extrayendo proveedor, piezas y precios.<br />
                Esto puede tardar 10-20 segundos.
              </p>
            </div>
          )}

          {/* ─── STEP: CONFIRM ───────────────────────────────────────── */}
          {step === "confirm" && extracted && (
            <div className="space-y-4">
              <div className="flex items-center gap-2 p-3 rounded-xl border border-emerald-500/30 bg-emerald-500/10 text-emerald-300 text-sm">
                <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
                <span>Datos extraídos. Revisa antes de cargarlos.</span>
              </div>

              {/* Proveedor */}
              <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
                <div className="flex items-center gap-2 mb-1">
                  <Building2 className="w-3.5 h-3.5 text-amber-400" />
                  <span className="text-[10px] uppercase tracking-wider text-white/50 font-semibold">Proveedor</span>
                </div>
                <p className="text-white text-sm font-bold">{extracted.supplier_name || "—"}</p>
                {extracted.invoice_number && (
                  <p className="text-white/50 text-xs mt-0.5">Factura #{extracted.invoice_number}</p>
                )}
              </div>

              {/* Line items */}
              {lineItems.length > 0 && (
                <div className="rounded-xl border border-white/10 bg-white/[0.03] overflow-hidden">
                  <div className="px-3 py-2 border-b border-white/[0.06] flex items-center justify-between">
                    <span className="text-[10px] uppercase tracking-wider text-white/50 font-semibold">
                      Piezas detectadas ({lineItems.length})
                    </span>
                  </div>
                  <ul className="divide-y divide-white/[0.04] max-h-48 overflow-y-auto">
                    {lineItems.map((it, i) => (
                      <li key={i} className="px-3 py-2 flex items-center gap-2 text-sm">
                        <span className="text-amber-400 font-bold tabular-nums w-8">{it.quantity || 1}×</span>
                        <span className="flex-1 text-white truncate">{it.product_name || "Sin nombre"}</span>
                        <span className="text-white tabular-nums font-semibold">${Number(it.unit_cost || 0).toFixed(2)}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Totals */}
              <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3 space-y-1 text-sm">
                <div className="flex justify-between text-white/50"><span>Subtotal</span><span className="tabular-nums">${Number(extracted.subtotal || 0).toFixed(2)}</span></div>
                {Number(extracted.tax_amount || 0) > 0 && (
                  <div className="flex justify-between text-white/50"><span>Impuesto</span><span className="tabular-nums">${Number(extracted.tax_amount).toFixed(2)}</span></div>
                )}
                {Number(extracted.shipping_cost || 0) > 0 && (
                  <div className="flex justify-between text-white/50"><span>Envío</span><span className="tabular-nums">${Number(extracted.shipping_cost).toFixed(2)}</span></div>
                )}
                <div className="flex justify-between text-white font-bold pt-1 border-t border-white/[0.06]">
                  <span>Total</span>
                  <span className="tabular-nums">${Number(extracted.total_amount || 0).toFixed(2)}</span>
                </div>
              </div>

              {/* Actions */}
              <div className="flex gap-2 pt-2">
                <Button
                  variant="outline"
                  onClick={() => { reset(); }}
                  className="flex-1 h-11 border-white/10 bg-white/5 text-white/70 hover:bg-white/10"
                >
                  <ArrowLeft className="w-4 h-4 mr-2" /> Otra factura
                </Button>
                <Button
                  onClick={handleConfirm}
                  className="flex-1 h-11 bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700 text-white font-bold"
                >
                  <CheckCircle2 className="w-4 h-4 mr-2" /> Cargar al formulario
                </Button>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
