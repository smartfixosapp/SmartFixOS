import { supabase } from "../../../../lib/supabase-client.js";

export const RECEIPT_ORIGIN = "https://archillaos.com";

export const receiptUrl = (token) => `${RECEIPT_ORIGIN}/r/${token}`;

export async function createReceiptLink(orderId) {
  const { data, error } = await supabase.rpc("create_receipt_link", { p_order_id: String(orderId) });
  if (error) throw error;
  if (!data) throw new Error("No se pudo crear el link del recibo.");
  return data;
}

export async function fetchPublicReceipt(token) {
  const { data, error } = await supabase.rpc("get_public_receipt", { p_token: String(token || "") });
  if (error) throw error;
  return data || null;
}

export function receiptMessage({ tenantName, customerName, orderNumber, url }) {
  const first = String(customerName || "").trim().split(/\s+/)[0];
  const hello = first ? `Hola ${first}` : "Hola";
  const from = tenantName ? ` de ${tenantName}` : "";
  const ref = orderNumber ? ` (${orderNumber})` : "";
  return `${hello}, aquí está tu recibo${from}${ref}: ${url}`;
}

export function smsHref(phone, text) {
  const digits = String(phone || "").replace(/[^\d+]/g, "");
  return `sms:${digits}?&body=${encodeURIComponent(text)}`;
}

export function whatsappHref(phone, text) {
  const digits = String(phone || "").replace(/\D/g, "");
  const full = digits.length === 10 ? `1${digits}` : digits;
  return `https://wa.me/${full}?text=${encodeURIComponent(text)}`;
}
