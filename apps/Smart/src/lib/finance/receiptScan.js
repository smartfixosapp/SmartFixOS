import { supabase } from "../../../../../lib/supabase-client.js";
import { uploadPublic, uuid, num } from "@/lib/comprasApi";

const FUNCTIONS_URL = import.meta.env.VITE_FUNCTION_URL || "https://smartfixos.onrender.com";
export const RECEIPT_MAX_BYTES = 10 * 1024 * 1024;

function kindOf(file) {
  const ext = (String(file.name || "").split(".").pop() || "").toLowerCase();
  if (file.type === "application/pdf" || ext === "pdf") return ["pdf", "application/pdf"];
  if (/png/.test(file.type) || ext === "png") return ["png", "image/png"];
  if (/heic|heif/.test(file.type) || /heic|heif/.test(ext)) return ["heic", "image/heic"];
  return ["jpg", "image/jpeg"];
}

export async function scanExpenseReceipt(file, tenantId) {
  if (file.size > RECEIPT_MAX_BYTES) throw new Error("El archivo excede 10MB. Reduce la calidad o sube un PDF más liviano.");
  const [ext, type] = kindOf(file);
  const receiptUrl = await uploadPublic(`expense_receipts/${tenantId}/${uuid()}.${ext}`, file, type);
  let token = null;
  try { token = (await supabase.auth.getSession())?.data?.session?.access_token || null; } catch { token = null; }
  const headers = { "Content-Type": "application/json" };
  if (token) headers.Authorization = `Bearer ${token}`;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 60000);
  try {
    const res = await fetch(`${FUNCTIONS_URL}/ai/extract-expense`, { method: "POST", headers, body: JSON.stringify({ file_url: receiptUrl, document_type: "invoice" }), signal: ctrl.signal });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(body?.error || "El servidor no pudo leer el recibo.");
    }
    const data = await res.json();
    const total = num(data.total_amount ?? data.amount);
    return {
      receiptUrl,
      amount: total,
      taxAmount: num(data.tax_amount),
      vendor: String(data.supplier_name || data.vendor || "").trim(),
      invoiceNumber: String(data.invoice_number || "").trim(),
      date: /^\d{4}-\d{2}-\d{2}/.test(String(data.date || "")) ? String(data.date).slice(0, 10) : null,
    };
  } finally {
    clearTimeout(timer);
  }
}
