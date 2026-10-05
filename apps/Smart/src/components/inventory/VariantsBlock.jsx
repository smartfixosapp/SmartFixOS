import { useCallback, useEffect, useState } from "react";
import { Loader2, Plus, ChevronRight, Trash2 } from "lucide-react";
import { Dialog, TextAction } from "@/components/pos/native/posUi";
import { supabase } from "../../../../../lib/supabase-client.js";
import { usd } from "@/lib/posLogic";

const CARD = "#2C2C2E";
const SUB = "#8E8E93";
const num = (v) => { const n = Number(v); return Number.isFinite(n) ? n : 0; };
const field = { background: "#1C1C1E", color: "#fff", borderRadius: 12, padding: "12px 14px", fontSize: 16, width: "100%", colorScheme: "dark" };

function Label({ children }) {
  return <p style={{ fontSize: 12, fontWeight: 700, letterSpacing: "0.06em", color: SUB, textTransform: "uppercase", marginBottom: 6 }}>{children}</p>;
}

function VariantDialog({ open, variant, productId, tenantId, onClose, onSaved }) {
  const [label, setLabel] = useState("");
  const [stock, setStock] = useState("");
  const [price, setPrice] = useState("");
  const [sku, setSku] = useState("");
  const [barcode, setBarcode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    if (!open) return;
    setLabel(variant?.label || "");
    setStock(variant ? String(num(variant.stock)) : "");
    setPrice(variant && variant.price !== null && variant.price !== undefined ? num(variant.price).toFixed(2) : "");
    setSku(variant?.sku || "");
    setBarcode(variant?.barcode || "");
    setError(null);
    setBusy(false);
    setConfirmDelete(false);
  }, [open, variant?.id]);

  const canSave = label.trim().length > 0 && !busy;

  const save = async () => {
    if (!canSave) return;
    setBusy(true);
    setError(null);
    const priceNum = price.trim() === "" ? null : Number(price.replace(",", "."));
    if (priceNum !== null && (!Number.isFinite(priceNum) || priceNum < 0)) { setError("El precio no es válido."); setBusy(false); return; }
    const stockNum = stock.trim() === "" ? 0 : Number(stock.replace(",", "."));
    if (!Number.isFinite(stockNum) || stockNum < 0) { setError("El stock no es válido."); setBusy(false); return; }
    const fields = { label: label.trim(), stock: stockNum, sku: sku.trim() || null, barcode: barcode.trim() || null, price: priceNum };
    try {
      if (variant) {
        const { error: e } = await supabase.from("product_variant").update(fields).eq("id", variant.id);
        if (e) throw e;
      } else {
        const { error: e } = await supabase.from("product_variant").insert({ ...fields, tenant_id: tenantId, product_id: productId });
        if (e) throw e;
      }
      onSaved();
      onClose();
    } catch (e) {
      setError(e?.message || "No se pudo guardar la variante.");
      setBusy(false);
    }
  };

  const remove = async () => {
    if (!variant || busy) return;
    setBusy(true);
    setError(null);
    const { error: e } = await supabase.from("product_variant").delete().eq("id", variant.id);
    if (e) { setError(e.message || "No se pudo eliminar la variante."); setBusy(false); return; }
    onSaved();
    onClose();
  };

  return (
    <Dialog open={open} onClose={() => !busy && onClose()} title={variant ? "Editar variante" : "Nueva variante"} width={460} leading={<TextAction onClick={onClose} disabled={busy}>Cancelar</TextAction>} trailing={busy ? <Loader2 className="w-5 h-5 animate-spin" style={{ color: SUB }} /> : <TextAction bold disabled={!canSave} onClick={save}>Guardar</TextAction>}>
      <div className="flex flex-col" style={{ gap: 14, paddingTop: 8 }}>
        <div><Label>Variante</Label><input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Ej. iPhone 16 Negro" aria-label="Variante" style={{ ...field, fontWeight: 600 }} /></div>
        <div><Label>Stock</Label><input value={stock} onChange={(e) => setStock(e.target.value.replace(/[^\d.]/g, ""))} inputMode="numeric" placeholder="0" aria-label="Stock" style={field} /></div>
        <div>
          <Label>Precio (opcional)</Label>
          <input value={price} onChange={(e) => setPrice(e.target.value.replace(",", ".").replace(/[^\d.]/g, ""))} inputMode="decimal" placeholder="Usa el precio del producto" aria-label="Precio" style={field} />
          <p style={{ fontSize: 12, color: SUB, marginTop: 6 }}>Si lo dejas vacío, esta variante usa el precio del producto.</p>
        </div>
        <div><Label>SKU</Label><input value={sku} onChange={(e) => setSku(e.target.value.toUpperCase())} placeholder="Opcional" aria-label="SKU" style={field} /></div>
        <div><Label>Código de barras</Label><input value={barcode} onChange={(e) => setBarcode(e.target.value)} placeholder="Opcional" aria-label="Código de barras" style={field} /></div>
        {variant && !confirmDelete && (
          <button type="button" onClick={() => setConfirmDelete(true)} disabled={busy} className="apple-press inline-flex items-center justify-center gap-2" style={{ height: 46, borderRadius: 14, background: "rgba(255,115,115,0.14)", color: "#FF7373", fontWeight: 700 }}><Trash2 className="w-4 h-4" /> Eliminar variante</button>
        )}
        {variant && confirmDelete && (
          <div className="flex gap-2">
            <button type="button" onClick={() => setConfirmDelete(false)} disabled={busy} className="apple-press flex-1" style={{ height: 46, borderRadius: 14, background: CARD, fontWeight: 600 }}>Cancelar</button>
            <button type="button" onClick={remove} disabled={busy} className="apple-press flex-1" style={{ height: 46, borderRadius: 14, background: "#FF453A", color: "#fff", fontWeight: 700 }}>Sí, eliminar</button>
          </div>
        )}
        {error && <p style={{ fontSize: 13, color: "#FF7373" }}>{error}</p>}
      </div>
    </Dialog>
  );
}

export default function VariantsBlock({ item, onChanged }) {
  const [rows, setRows] = useState(null);
  const [editing, setEditing] = useState(undefined);

  const load = useCallback(() => {
    if (!item?.id) return Promise.resolve();
    return supabase.from("product_variant").select("*").eq("product_id", item.id).order("created_at", { ascending: true }).limit(100)
      .then(({ data }) => setRows(data || []), () => setRows([]));
  }, [item?.id]);

  useEffect(() => { setRows(null); load(); }, [load]);

  const afterSave = () => { load(); onChanged?.(); };

  return (
    <div>
      <p style={{ fontSize: 12, fontWeight: 600, color: SUB, textTransform: "uppercase", letterSpacing: "0.04em", padding: "0 4px 6px" }}>Variantes</p>
      <div style={{ borderRadius: 14, background: CARD, overflow: "hidden" }}>
        {rows === null ? (
          <p className="flex justify-center" style={{ padding: 18 }}><Loader2 className="w-4 h-4 animate-spin" style={{ color: SUB }} /></p>
        ) : rows.length === 0 ? (
          <p style={{ padding: 14, fontSize: 14, color: SUB }}>Sin variantes. Úsalas para colores, tamaños o modelos con su propio stock.</p>
        ) : rows.map((v, i) => (
          <button key={v.id} type="button" onClick={() => setEditing(v)} className="apple-press w-full flex items-center gap-3 text-left" style={{ padding: "12px 14px", borderTop: i ? "0.5px solid rgba(84,84,88,0.6)" : "none" }}>
            <span className="flex-1 min-w-0">
              <span className="block truncate" style={{ fontSize: 15, fontWeight: 600 }}>{v.label}</span>
              <span className="block" style={{ fontSize: 12, color: SUB }}>{v.sku ? `${v.sku} · ` : ""}{v.price !== null && v.price !== undefined ? usd(num(v.price)) : "Precio del producto"}</span>
            </span>
            <span style={{ fontSize: 15, fontWeight: 700, color: num(v.stock) <= 0 ? "#FF7373" : "#4DC780", fontVariantNumeric: "tabular-nums" }}>{num(v.stock)}</span>
            <ChevronRight className="w-3.5 h-3.5" style={{ color: "rgba(235,235,245,0.3)" }} strokeWidth={2.5} />
          </button>
        ))}
        <button type="button" onClick={() => setEditing(null)} className="apple-press w-full flex items-center gap-2" style={{ padding: "12px 14px", borderTop: rows && rows.length ? "0.5px solid rgba(84,84,88,0.6)" : "none", color: "#F2662E", fontWeight: 700, fontSize: 15 }}><Plus className="w-4 h-4" /> Agregar variante</button>
      </div>
      <VariantDialog open={editing !== undefined} variant={editing || null} productId={item.id} tenantId={item.tenant_id} onClose={() => setEditing(undefined)} onSaved={afterSave} />
    </div>
  );
}
