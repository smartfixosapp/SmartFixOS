import { supabase } from "../../../../lib/supabase-client.js";

const MAX_TRIES = 5;

export async function adjustStockAtomic({ table = "product", id, delta, floor = true, extra = null }) {
  let lastError = null;
  for (let attempt = 0; attempt < MAX_TRIES; attempt += 1) {
    const { data, error } = await supabase.from(table).select("id,stock").eq("id", id).maybeSingle();
    if (error) return { ok: false, error };
    if (!data) return { ok: false, error: new Error("Producto no encontrado") };
    const before = Number(data.stock) || 0;
    const next = before + Number(delta || 0);
    const after = floor ? Math.max(0, next) : next;
    let q = supabase.from(table).update({ stock: after, ...(extra || {}) }).eq("id", id);
    q = data.stock === null || data.stock === undefined ? q.is("stock", null) : q.eq("stock", data.stock);
    const { data: rows, error: updError } = await q.select("id");
    if (updError) return { ok: false, error: updError };
    if (rows && rows.length) return { ok: true, before, after };
    lastError = new Error("Otro dispositivo cambió el stock al mismo tiempo");
  }
  return { ok: false, error: lastError };
}
