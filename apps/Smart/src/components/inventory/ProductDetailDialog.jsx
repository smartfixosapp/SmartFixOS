import { useEffect, useState } from "react";
import { Loader2, Package, Phone, Mail, MessageCircle, Pencil } from "lucide-react";
import { Dialog, TextAction, tint } from "@/components/pos/native/posUi";
import { supabase } from "../../../../../lib/supabase-client.js";
import { usd } from "@/lib/posLogic";
import BarcodeLabelDialog from "./BarcodeLabelDialog";

const CARD = "#2C2C2E";
const SUB = "#8E8E93";
const num = (v) => { const n = Number(v); return Number.isFinite(n) ? n : 0; };

function Row({ label, value, color }) {
  if (value === null || value === undefined || value === "") return null;
  return (
    <div className="flex items-center justify-between gap-3" style={{ padding: "11px 14px", borderTop: "0.5px solid rgba(84,84,88,0.6)" }}>
      <span style={{ color: SUB, fontSize: 14 }}>{label}</span>
      <span style={{ fontSize: 15, fontWeight: 600, color: color || "#fff", textAlign: "right", overflowWrap: "anywhere" }}>{value}</span>
    </div>
  );
}

function Block({ title, children }) {
  return (
    <div>
      <p style={{ fontSize: 12, fontWeight: 600, color: SUB, textTransform: "uppercase", letterSpacing: "0.04em", padding: "0 4px 6px" }}>{title}</p>
      <div style={{ borderRadius: 14, background: CARD, overflow: "hidden" }}>{children}</div>
    </div>
  );
}

export default function ProductDetailDialog({ open, item, suppliers, onClose, onEdit, onChanged }) {
  const [moves, setMoves] = useState(null);
  const [labelOpen, setLabelOpen] = useState(false);

  useEffect(() => {
    if (!open || !item) return undefined;
    let live = true;
    setMoves(null);
    supabase.from("transaction").select("id,category,amount,description,created_at,recorded_by")
      .eq("tenant_id", item.tenant_id).eq("type", "stock_adjustment").like("description", `[${item.name}]%`)
      .order("created_at", { ascending: false }).limit(12)
      .then(({ data }) => { if (live) setMoves(data || []); }, () => { if (live) setMoves([]); });
    return () => { live = false; };
  }, [open, item?.id]);

  if (!item) return null;
  const service = item.type === "service" || item.part_type === "servicio" || item.part_type === "diagnostic";
  const stock = num(item.stock);
  const min = num(item.min_stock);
  const price = num(item.price);
  const cost = num(item.cost);
  const margin = price > 0 && cost > 0 ? Math.round(((price - cost) / price) * 100) : null;
  const status = service ? ["Servicio", "#66B3FF"] : stock <= 0 ? ["Agotado", "#FF7373"] : min > 0 && stock <= min ? ["Stock bajo", "#FFA640"] : ["En stock", "#4DC780"];
  const photos = [item.image_url, ...(Array.isArray(item.photo_urls) ? item.photo_urls : [])].filter(Boolean);
  const supplier = (suppliers || []).find((s) => s.id === item.supplier_id);
  const digits = String(supplier?.phone || "").replace(/[^\d]/g, "");

  return (
    <>
    <Dialog open={open} onClose={onClose} title="Producto" width={620} height="90dvh" leading={<TextAction onClick={onClose}>Cerrar</TextAction>} trailing={<TextAction bold onClick={() => onEdit(item)}><span className="inline-flex items-center gap-1"><Pencil className="w-4 h-4" /> Editar</span></TextAction>}>
      <div className="flex flex-col" style={{ gap: 16, paddingTop: 6 }}>
        <div className="flex items-center gap-4">
          <div className="flex items-center justify-center flex-shrink-0" style={{ width: 96, height: 96, borderRadius: 16, background: photos[0] ? "#fff" : CARD, overflow: "hidden" }}>
            {photos[0] ? <img src={photos[0]} alt={item.name} style={{ maxWidth: "100%", maxHeight: "100%", objectFit: "contain" }} /> : <Package className="w-9 h-9" style={{ color: SUB }} />}
          </div>
          <div className="min-w-0">
            <p style={{ fontSize: 22, fontWeight: 800, overflowWrap: "anywhere" }}>{item.name}</p>
            <span style={{ display: "inline-block", marginTop: 6, padding: "3px 10px", borderRadius: 999, background: tint(status[1], 0.16), color: status[1], fontSize: 12, fontWeight: 700 }}>{status[0]}</span>
          </div>
        </div>
        {photos.length > 1 && (
          <div className="flex gap-2 overflow-x-auto">
            {photos.map((u) => <img key={u} src={u} alt="" loading="lazy" style={{ width: 72, height: 72, objectFit: "cover", borderRadius: 10, background: CARD, flexShrink: 0 }} />)}
          </div>
        )}
        <Block title="Precio">
          <Row label="Precio de venta" value={usd(price)} />
          {!service && <Row label="Costo" value={cost > 0 ? usd(cost) : null} />}
          <Row label="Margen" value={margin !== null ? `${margin}%` : null} color={margin !== null && margin < 20 ? "#FFA640" : "#4DC780"} />
          <Row label="Oferta" value={item.discount_active === true && num(item.discount_percentage) > 0 ? `${num(item.discount_percentage)}% de descuento` : null} color="#FF9F0A" />
        </Block>
        {!service && (
          <Block title="Inventario">
            <Row label="En stock" value={stock} color={status[1]} />
            <Row label="Mínimo" value={min > 0 ? min : null} />
            <Row label="Valor en inventario" value={cost > 0 ? usd(cost * stock) : null} />
          </Block>
        )}
        {!service && (
          <button onClick={() => setLabelOpen(true)} className="apple-press" style={{ height: 46, borderRadius: 14, background: CARD, color: "#F2662E", fontWeight: 700, fontSize: 15 }}>Etiqueta de código de barras</button>
        )}
        <Block title="Detalles">
          <Row label="Categoría" value={item.category} />
          <Row label="Marca" value={item.device_brand} />
          <Row label="Familia" value={item.device_family} />
          <Row label="Modelo" value={item.device_model} />
          <Row label="SKU" value={item.sku} />
          <Row label="Código de barras" value={item.barcode} />
          <Row label="Ubicación" value={item.location} />
          <Row label="Descripción" value={item.description} />
        </Block>
        {(supplier || item.supplier_name) && (
          <Block title="Suplidor">
            <Row label="Nombre" value={supplier?.name || item.supplier_name} />
            {supplier && (
              <div className="flex gap-2 flex-wrap" style={{ padding: "11px 14px", borderTop: "0.5px solid rgba(84,84,88,0.6)" }}>
                {digits && <a href={`tel:${digits}`} className="apple-press inline-flex items-center gap-1.5" style={{ padding: "6px 12px", borderRadius: 999, background: tint("#4DC780", 0.16), color: "#4DC780", fontSize: 13, fontWeight: 600 }}><Phone className="w-3.5 h-3.5" /> Llamar</a>}
                {digits && <a href={`https://wa.me/${digits.length === 10 ? `1${digits}` : digits}`} target="_blank" rel="noopener noreferrer" className="apple-press inline-flex items-center gap-1.5" style={{ padding: "6px 12px", borderRadius: 999, background: tint("#1ABA66", 0.16), color: "#1ABA66", fontSize: 13, fontWeight: 600 }}><MessageCircle className="w-3.5 h-3.5" /> WhatsApp</a>}
                {supplier.email && <a href={`mailto:${supplier.email}`} className="apple-press inline-flex items-center gap-1.5" style={{ padding: "6px 12px", borderRadius: 999, background: tint("#FFC733", 0.16), color: "#FFC733", fontSize: 13, fontWeight: 600 }}><Mail className="w-3.5 h-3.5" /> Email</a>}
              </div>
            )}
          </Block>
        )}
        {!service && (
          <Block title="Movimientos recientes">
            {moves === null ? (
              <p className="flex justify-center" style={{ padding: 18 }}><Loader2 className="w-4 h-4 animate-spin" style={{ color: SUB }} /></p>
            ) : moves.length === 0 ? (
              <p style={{ padding: 14, fontSize: 14, color: SUB }}>Sin movimientos registrados.</p>
            ) : moves.map((m, i) => (
              <div key={m.id} className="flex items-center justify-between gap-3" style={{ padding: "10px 14px", borderTop: i ? "0.5px solid rgba(84,84,88,0.6)" : "none" }}>
                <span className="min-w-0">
                  <span className="block truncate" style={{ fontSize: 14 }}>{String(m.description || "").replace(/^\[[^\]]*\]\s*/, "")}</span>
                  <span className="block" style={{ fontSize: 11, color: SUB }}>{new Date(m.created_at).toLocaleString("es-PR", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" })}{m.recorded_by ? ` · ${m.recorded_by}` : ""}</span>
                </span>
                <span style={{ fontSize: 15, fontWeight: 700, color: m.category === "stock_in" ? "#4DC780" : "#FF7373", fontVariantNumeric: "tabular-nums" }}>{m.category === "stock_in" ? "+" : "-"}{num(m.amount)}</span>
              </div>
            ))}
          </Block>
        )}
      </div>
    </Dialog>
      <BarcodeLabelDialog open={labelOpen} item={item} onClose={() => setLabelOpen(false)} onSaved={() => onChanged?.()} />
    </>
  );
}
