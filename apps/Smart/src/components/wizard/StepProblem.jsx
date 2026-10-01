import { useEffect, useMemo, useState } from "react";
import { Plus, Minus, Wrench, Package, Lightbulb, Wand2, X, Check, Search, Loader2, PenLine, Tag, FileText, Truck, ChevronRight } from "lucide-react";
import { Dialog, TextAction, tint } from "@/components/pos/native/posUi";
import { IOS, problemSuggestions, toggleProblemText, appendProblemText, buildSuggestions, deviceMatchedProducts, searchProducts, effectivePrice, isServiceItem, lineSubtotal } from "@/lib/wizard/helpers";
import { resolveDeviceOffer, deviceOffersFor, offerDeviceCtx, lineOfferSavings } from "@/lib/wizard/offers";
import { offerType, offerDaysLeft } from "@/lib/inicioApi";
import { loadSupplierData } from "@/lib/wizard/api";
import { Banner, Caption, Card, Input, W, money } from "./ui";

export const partNeedsOrder = (p) => {
  if (isServiceItem(p)) return false;
  const st = p.stock === null || p.stock === undefined || p.stock === "" ? null : Number(p.stock);
  return st !== null && st <= 0;
};

function ProductRow({ p, onClick, right, promo }) {
  const service = isServiceItem(p);
  const Icon = service ? Wrench : Package;
  const color = service ? IOS.mint : IOS.yellow;
  return (
    <button onClick={onClick} className="apple-press w-full flex items-center gap-3 text-left" style={{ padding: "10px 12px" }}>
      <span style={{ width: 34, height: 34, borderRadius: 9, background: tint(color, 0.16), color, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}><Icon className="w-4 h-4" /></span>
      <span className="flex-1 min-w-0">
        <span className="block" style={{ fontSize: 14, fontWeight: 600, overflow: "hidden", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" }}>{p.name}</span>
        <span className="block truncate" style={{ fontSize: 11, color: W.sub }}>{p.category || ""}</span>
      </span>
      {promo ? (
        <span className="flex flex-col items-end" style={{ fontVariantNumeric: "tabular-nums" }}>
          <span style={{ fontSize: 11, color: W.sub, textDecoration: "line-through" }}>{money(promo.original)}</span>
          <span style={{ fontSize: 14, fontWeight: 700, color: IOS.green }}>{money(promo.promo)}</span>
        </span>
      ) : <span style={{ fontSize: 14, fontWeight: 700, color: IOS.green, fontVariantNumeric: "tabular-nums" }}>{money(effectivePrice(p))}</span>}
      {right}
    </button>
  );
}

function ManualDialog({ onClose, onAdd }) {
  const [name, setName] = useState("");
  const [price, setPrice] = useState("");
  const [service, setService] = useState(true);
  const p = Number(String(price).replace(",", ".")) || 0;
  const ok = name.trim() && p > 0;
  return (
    <Dialog open onClose={onClose} title="Entrada manual" width={420} leading={<TextAction onClick={onClose}>Cancelar</TextAction>} trailing={<TextAction bold disabled={!ok} onClick={() => { onAdd({ id: null, name: name.trim(), type: service ? "service" : "product", price: p, stock: null, __manualPrice: p }); onClose(); }}>Añadir</TextAction>}>
      <div className="flex flex-col" style={{ gap: 12, paddingTop: 8 }}>
        <Input label="Nombre" value={name} onChange={setName} placeholder="Ej: Diagnóstico, Pantalla LCD…" autoFocus />
        <Input label="Precio" value={price} onChange={setPrice} placeholder="$ 0.00" inputMode="decimal" />
        <div className="grid grid-cols-2" style={{ padding: 2, gap: 2, borderRadius: 9, background: "rgba(118,118,128,0.24)" }}>
          {[[true, "Servicio / mano de obra"], [false, "Pieza / producto"]].map(([v, l]) => <button key={l} onClick={() => setService(v)} style={{ padding: "7px 0", borderRadius: 7, fontSize: 13, fontWeight: 600, background: service === v ? "#636366" : "transparent" }}>{l}</button>)}
        </div>
      </div>
    </Dialog>
  );
}

export function AddItemDialog({ open, onClose, products, sel, servicesOnly, onPick, resolvePromo }) {
  const [q, setQ] = useState("");
  const [manual, setManual] = useState(false);
  useEffect(() => { if (open) setQ(""); }, [open]);
  const pool = useMemo(() => (servicesOnly ? products.filter((p) => p.type === "service") : products), [products, servicesOnly]);
  const matched = useMemo(() => (servicesOnly || q.trim() ? [] : deviceMatchedProducts(products, sel)), [products, sel, servicesOnly, q]);
  const filtered = useMemo(() => searchProducts(pool, q), [pool, q]);
  const deviceLabel = [sel?.family?.name, sel?.model?.name].filter(Boolean).join(" ");
  const rest = matched.length ? filtered.filter((p) => !matched.some((m) => m.id === p.id)) : filtered;
  if (!open) return null;
  return (
    <>
      <Dialog open onClose={onClose} title={servicesOnly ? "Añadir plan o servicio" : "Añadir pieza o servicio"} width={560} height="86dvh" leading={<TextAction onClick={onClose}>Cerrar</TextAction>} trailing={null}>
        <div className="flex flex-col" style={{ gap: 10, paddingTop: 6 }}>
          <p style={{ fontSize: 12, color: W.sub }}>{matched.length && deviceLabel ? `Primero: compatibles con ${deviceLabel}` : `${pool.length} productos disponibles`}</p>
          <label className="flex items-center gap-2" style={{ height: 42, padding: "0 12px", borderRadius: 12, background: W.card2 }}>
            <Search className="w-4 h-4" style={{ color: W.sub }} />
            <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar pieza o servicio…" className="flex-1 bg-transparent outline-none" style={{ color: "#fff", fontSize: 15 }} />
          </label>
          <button onClick={() => setManual(true)} className="apple-press flex items-center gap-3 text-left" style={{ padding: 12, borderRadius: 12, background: W.card2 }}>
            <span style={{ width: 34, height: 34, borderRadius: 9, background: tint(IOS.orange, 0.16), color: IOS.orange, display: "flex", alignItems: "center", justifyContent: "center" }}><PenLine className="w-4 h-4" /></span>
            <span><span className="block" style={{ fontSize: 14, fontWeight: 600 }}>Añadir manualmente</span><span className="block" style={{ fontSize: 12, color: W.sub }}>Pieza o servicio sin inventario</span></span>
          </button>
          {!pool.length ? <p className="text-center" style={{ padding: 24, color: W.sub }}>Sin productos en catálogo. Usa la entrada manual para añadir piezas o servicios</p> : (
            <>
              {matched.length > 0 && (<><Caption style={{ paddingTop: 6 }}>Para {deviceLabel || sel?.category?.name}</Caption><div style={{ borderRadius: 12, background: W.card2, overflow: "hidden" }}>{matched.map((p, i) => <div key={p.id} style={{ borderTop: i ? `0.5px solid ${W.sep}` : "none" }}><ProductRow p={p} promo={resolvePromo?.(p)} onClick={() => { onPick(p); onClose(); }} /></div>)}</div></>)}
              {q.trim() && !filtered.length ? <p className="text-center" style={{ padding: 20, color: W.sub }}>Sin resultados. Ningún producto coincide con “{q.trim()}”</p> : (
                <>
                  {matched.length > 0 && <Caption style={{ paddingTop: 6 }}>Todo el catálogo</Caption>}
                  <div style={{ borderRadius: 12, background: W.card2, overflow: "hidden" }}>{rest.slice(0, 200).map((p, i) => <div key={p.id} style={{ borderTop: i ? `0.5px solid ${W.sep}` : "none" }}><ProductRow p={p} promo={resolvePromo?.(p)} onClick={() => { onPick(p); onClose(); }} /></div>)}</div>
                </>
              )}
            </>
          )}
        </div>
      </Dialog>
      {manual && <ManualDialog onClose={() => setManual(false)} onAdd={(p) => { onPick(p); onClose(); }} />}
    </>
  );
}

export function CartCard({ w, onAdd, requiredHint }) {
  const { s } = w;
  const t = w.totals;
  const savings = s.cart.reduce((a, l) => a + lineOfferSavings(l), 0);
  return (
    <Card style={{ padding: 14 }}>
      <div className="flex items-center gap-2" style={{ marginBottom: 10 }}>
        <Wrench className="w-5 h-5" style={{ color: IOS.green }} />
        <span className="flex-1" style={{ fontSize: 16, fontWeight: 700 }}>Checkout</span>
        <button onClick={onAdd} className="apple-press flex items-center gap-1" style={{ padding: "6px 12px", borderRadius: 999, background: IOS.green, color: "#fff", fontSize: 13, fontWeight: 700 }}><Plus className="w-3.5 h-3.5" /> Añadir</button>
      </div>
      {!s.cart.length && requiredHint && <p style={{ fontSize: 13, color: IOS.green }}>Debes añadir al menos un servicio antes de continuar.</p>}
      {s.cart.map((l) => (
        <div key={l.key} className="flex items-center gap-2" style={{ padding: "6px 0" }}>
          <span style={{ width: 32, height: 32, borderRadius: 8, background: tint(isServiceItem(l.product) ? IOS.mint : IOS.yellow, 0.15), color: isServiceItem(l.product) ? IOS.mint : IOS.yellow, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>{isServiceItem(l.product) ? <Wrench className="w-4 h-4" /> : <Package className="w-4 h-4" />}</span>
          <span className="flex-1 min-w-0"><span className="block truncate" style={{ fontSize: 14, fontWeight: 600 }}>{l.product.name}</span>{lineOfferSavings(l) > 0 ? <span className="flex items-center gap-1.5" style={{ fontSize: 11 }}><span style={{ color: W.sub, textDecoration: "line-through" }}>{money(l.originalPrice)}</span><span style={{ color: IOS.green, fontWeight: 600 }}>{money(l.unitPrice)}</span><span style={{ padding: "0 6px", borderRadius: 999, background: tint(IOS.orange, 0.18), color: IOS.orange, fontSize: 9, fontWeight: 800 }}>Oferta</span></span> : <span className="block" style={{ fontSize: 11, color: W.sub }}>{money(l.unitPrice)}</span>}</span>
          <button onClick={() => w.setQuantity(l.key, l.quantity - 1)} aria-label="Menos" style={{ width: 26, height: 26, borderRadius: 999, background: "#3A3A3C", display: "flex", alignItems: "center", justifyContent: "center" }}><Minus className="w-3 h-3" /></button>
          <span style={{ width: 22, textAlign: "center", fontSize: 14, fontWeight: 700 }}>{l.quantity}</span>
          <button onClick={() => w.setQuantity(l.key, l.quantity + 1)} aria-label="Más" style={{ width: 26, height: 26, borderRadius: 999, background: IOS.green, display: "flex", alignItems: "center", justifyContent: "center" }}><Plus className="w-3 h-3" /></button>
          <span style={{ width: 64, textAlign: "right", fontSize: 14, fontWeight: 700, color: IOS.green, fontVariantNumeric: "tabular-nums" }}>{money(lineSubtotal(l))}</span>
        </div>
      ))}
      {s.cart.length > 0 && (
        <div className="flex flex-col" style={{ gap: 4, borderTop: `0.5px solid ${W.sep}`, marginTop: 8, paddingTop: 8, fontSize: 13 }}>
          <div className="flex justify-between"><span style={{ color: W.sub }}>Subtotal</span><span>{money(t.subtotal)}</span></div>
          {savings > 0.001 && <div className="flex justify-between"><span style={{ color: IOS.green }}>Ahorro por ofertas</span><span style={{ color: IOS.green, fontWeight: 600 }}>-{money(savings)}</span></div>}
          {t.tax > 0 && <div className="flex justify-between"><span style={{ color: W.sub }}>Impuesto</span><span>{money(t.tax)}</span></div>}
          <div className="flex justify-between" style={{ fontSize: 15, fontWeight: 700 }}><span>Total</span><span style={{ color: IOS.green }}>{money(t.total)}</span></div>
        </div>
      )}
    </Card>
  );
}

function OrderPartForm({ product, data, mode, onBack, onOrder }) {
  const [supplier, setSupplier] = useState(null);
  const [free, setFree] = useState("");
  const [qty, setQty] = useState(1);
  const [cost, setCost] = useState("");
  useEffect(() => {
    const pid = String(product.supplier_id || "");
    const pname = String(product.supplier_name || "").trim().toLowerCase();
    const pre = data.suppliers.find((x) => (pid && String(x.id || "") === pid) || (pname && String(x.name || "").trim().toLowerCase() === pname)) || (data.suppliers.length === 1 ? data.suppliers[0] : null);
    if (pre) {
      setSupplier(pre);
      const c0 = data.lastCost[pre.id || pre.name];
      if (c0 !== undefined && c0 > 0) setCost(String(c0));
    }
  }, [data, product]);
  const name = supplier ? supplier.name : free.trim();
  const c = Number(String(cost).replace(",", ".")) || 0;
  const key = supplier ? supplier.id || supplier.name : null;
  const last = key !== null ? data.lastCost[key] : undefined;
  const canOrder = !!name && (mode !== "draft" || !!supplier?.id);
  const actionLabel = mode === "draft" ? (name ? `Añadir al pedido de ${name}` : "Añadir al pedido") : "Crear orden de compra";
  return (
    <div className="flex flex-col" style={{ gap: 10 }}>
      <Caption>{mode === "draft" ? "A cuál suplidor" : "A quién se la pides"}</Caption>
      {data.suppliers.length ? (
        <div className="flex flex-wrap" style={{ gap: 8 }}>
          {data.suppliers.map((sp) => {
            const k = sp.id || sp.name;
            const on = supplier && (supplier.id || supplier.name) === k;
            const n = data.counts[k] || 0;
            return (
              <button key={k} onClick={() => { setSupplier(sp); if (data.lastCost[k] !== undefined && data.lastCost[k] > 0) setCost(String(data.lastCost[k])); }} className="apple-press text-left" style={{ padding: "8px 12px", borderRadius: 12, background: on ? tint(IOS.orange, 0.2) : W.card2, border: `1px solid ${on ? IOS.orange : "transparent"}` }}>
                <span className="block" style={{ fontSize: 13, fontWeight: 700 }}>{sp.name} {k === data.lastSupplierKey && <span style={{ fontSize: 10, color: IOS.orange }}>la última vez</span>}</span>
                <span className="block" style={{ fontSize: 11, color: W.sub }}>{data.lastCost[k] !== undefined ? `${money(data.lastCost[k])} · comprada ${n} veces` : "nunca le has comprado esta"}</span>
              </button>
            );
          })}
        </div>
      ) : mode === "draft" ? <p style={{ fontSize: 13, color: W.sub }}>No tienes suplidores guardados. Crea una orden de compra nueva para escribir uno.</p> : <Input value={free} onChange={setFree} placeholder="Nombre del suplidor" />}
      <div className="grid grid-cols-3" style={{ gap: 10, alignItems: "end" }}>
        <div><Caption style={{ paddingBottom: 4 }}>Cantidad</Caption><div className="flex items-center gap-2"><button onClick={() => setQty(Math.max(1, qty - 1))} style={{ width: 28, height: 28, borderRadius: 999, background: "#3A3A3C" }}>−</button><b>{qty}</b><button onClick={() => setQty(qty + 1)} style={{ width: 28, height: 28, borderRadius: 999, background: IOS.green }}>+</button></div></div>
        <Input label="COSTO C/U" value={cost} onChange={setCost} placeholder="¿Cuánto?" inputMode="decimal" />
        <div><Caption style={{ paddingBottom: 4 }}>Total</Caption><b>{money(qty * c)}</b></div>
      </div>
      <p style={{ fontSize: 12, color: W.sub }}>{c <= 0 ? "Sin costo no se puede calcular lo que ganas en esta reparación. Puedes pedir igual y ponerlo cuando llegue." : last !== undefined && Math.abs(c - last) > 0.004 ? `${c > last ? "Subió" : "Bajó"} ${money(Math.abs(c - last))} desde la última compra. Al recibirla, la ficha queda en ${money(c)}.` : ""}</p>
      <div className="flex" style={{ gap: 8 }}>
        <button onClick={onBack} className="apple-press flex-1" style={{ padding: "10px 0", borderRadius: 12, background: "#3A3A3C", fontWeight: 600 }}>Atrás</button>
        <button disabled={!canOrder} onClick={() => onOrder({ mode, productId: product.id || "", productName: product.name, supplierId: supplier?.id || product.supplier_id || null, supplierName: name || String(product.supplier_name || "").trim(), quantity: qty, unitCost: c, unitPrice: effectivePrice(product) })} className="apple-press flex-1 disabled:opacity-40" style={{ padding: "10px 0", borderRadius: 12, background: IOS.orange, fontWeight: 700 }}>{actionLabel}</button>
      </div>
    </div>
  );
}

function OutOfStockSheet({ product, tenantId, onClose, onOrder }) {
  const [data, setData] = useState(null);
  const [mode, setMode] = useState(null);
  useEffect(() => {
    let live = true;
    loadSupplierData(tenantId, product.id).then((d) => { if (live) setData(d); }).catch(() => { if (live) setData({ suppliers: [], counts: {}, lastCost: {}, incoming: 0, lastSupplierKey: null }); });
    return () => { live = false; };
  }, [tenantId, product.id]);
  const option = (Icon, color, title, sub, target) => (
    <button onClick={() => setMode(target)} className="apple-press w-full flex items-center gap-3 text-left" style={{ padding: 12, borderRadius: 14, background: W.card2 }}>
      <span style={{ width: 38, height: 38, borderRadius: 10, background: tint(color, 0.16), color, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}><Icon className="w-5 h-5" /></span>
      <span className="flex-1 min-w-0"><span className="block" style={{ fontSize: 15, fontWeight: 600 }}>{title}</span><span className="block" style={{ fontSize: 12, color: W.sub }}>{sub}</span></span>
      <ChevronRight className="w-4 h-4" style={{ color: W.ter }} />
    </button>
  );
  return (
    <Dialog open onClose={onClose} title="Sin stock" width={460} leading={<span />} trailing={<TextAction bold onClick={onClose}>Cerrar</TextAction>}>
      <div className="flex flex-col" style={{ gap: 12, paddingTop: 6 }}>
        <div>
          <p style={{ fontSize: 16, fontWeight: 700 }}>{product.name} no está en stock</p>
          <p style={{ fontSize: 13, color: W.sub }}>{!data ? "Revisando pedidos en camino…" : data.incoming > 0 ? `Vienen ${data.incoming} en camino` : "No viene ninguna en camino"}</p>
        </div>
        {!data ? <div className="flex justify-center" style={{ padding: 14 }}><Loader2 className="w-4 h-4 animate-spin" style={{ color: W.sub }} /></div>
          : mode ? <OrderPartForm product={product} data={data} mode={mode} onBack={() => setMode(null)} onOrder={onOrder} />
          : (
            <>
              {option(FileText, IOS.orange, "Orden de compra nueva", "Elige suplidor, cantidad y costo", "po")}
              {option(Truck, IOS.blue, "Pedir al suplidor", "Se suma al pedido abierto del suplidor", "draft")}
              <button onClick={onClose} className="apple-press" style={{ padding: "8px 0", fontSize: 14, fontWeight: 600, color: IOS.orange }}>Añadir sin pedir</button>
            </>
          )}
      </div>
    </Dialog>
  );
}

const offerValueText = (o) => {
  const v = Number(o.value) || 0;
  const t = offerType(o);
  return t === "amount" ? `-${money(v)}` : t === "percent" ? `-${v}%` : t === "fixed" ? money(v) : "";
};

const offerTitle = (o) => {
  const label = String(o.label || "").trim();
  const base = label || (String(o.part_filter || "").trim() ? String(o.part_filter).trim().replace(/^./, (c) => c.toUpperCase()) : "Piezas");
  return `${base} ${offerValueText(o)}`.trim();
};

function DeviceOffersStrip({ w, catalogSel }) {
  const { s } = w;
  const offers = deviceOffersFor(s.offers, offerDeviceCtx({ ...catalogSel, customModelText: s.customModelText }));
  if (!offers.length) return null;
  return (
    <div className="flex flex-col" style={{ gap: 8 }}>
      <Caption style={{ display: "flex", alignItems: "center", gap: 6 }}><Tag className="w-3.5 h-3.5" style={{ color: IOS.orange }} /> Ofertas para este equipo</Caption>
      <div style={{ borderRadius: 14, background: W.card, border: `1px solid ${tint(IOS.orange, 0.25)}`, overflow: "hidden" }}>
        {offers.map((o, i) => {
          const applied = s.cart.some((l) => l.offerId && l.offerId === o.id);
          const d = offerDaysLeft(o);
          return (
            <div key={o.id} className="flex items-center gap-3" style={{ padding: "9px 12px", borderTop: i ? `0.5px solid ${W.sep}` : "none" }}>
              <span style={{ width: 30, height: 30, borderRadius: 8, background: tint(IOS.orange, 0.14), color: IOS.orange, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}><Tag className="w-4 h-4" /></span>
              <span className="flex-1 min-w-0"><span className="block truncate" style={{ fontSize: 14, fontWeight: 600 }}>{offerTitle(o)}</span><span className="block" style={{ fontSize: 11, color: W.sub }}>{d === null ? "Permanente" : d === 0 ? "Vence hoy" : d === 1 ? "Vence mañana" : `Vence en ${d} días`}</span></span>
              <span style={{ padding: "2px 9px", borderRadius: 999, fontSize: 11, fontWeight: 700, background: applied ? tint(IOS.green, 0.16) : "rgba(255,255,255,0.08)", color: applied ? IOS.green : W.sub }}>{applied ? "Aplicada" : "Al añadir"}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function StepProblem({ w, tenantId, products, catalogSel, onAddItemOpen }) {
  const { s, set } = w;
  const [symptomsOpen, setSymptomsOpen] = useState(false);
  const suggestions = useMemo(() => buildSuggestions(products, catalogSel), [products, catalogSel]);
  const deviceLabel = (s.model?.name || s.family?.name || "este equipo").toUpperCase();
  const cats = s.category ? problemSuggestions(s.category) : [];
  const symptomsSelected = cats.filter((t) => s.problem.toLowerCase().includes(t.toLowerCase()));
  const [custom, setCustom] = useState("");

  const promoCtx = offerDeviceCtx({ ...catalogSel, customModelText: s.customModelText });
  const addSuggestion = (p) => {
    w.addItem(p);
    set({ oosFor: partNeedsOrder(p) ? p : null });
  };
  const stockChip = (p) => {
    if (isServiceItem(p)) return ["Servicio", IOS.mint];
    const stock = p.stock === null || p.stock === undefined || p.stock === "" ? null : Number(p.stock);
    if (stock === null) return null;
    if (stock <= 0) return ["Agotado", IOS.red];
    if (Number(p.min_stock) >= stock) return [`Quedan ${Math.trunc(stock)}`, IOS.orange];
    return [`Stock: ${Math.trunc(stock)}`, IOS.green];
  };
  const inCart = (p) => s.cart.some((l) => l.product.id === p.id);

  return (
    <div className="grid" style={{ gap: 20, gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", alignItems: "start" }}>
      <div className="flex flex-col" style={{ gap: 14 }}>
        <div className="relative">
          <textarea value={s.problem} onChange={(e) => set({ problem: e.target.value })} placeholder="Describe el problema…" aria-label="Problema reportado" rows={8} className="w-full outline-none" style={{ background: W.card, color: "#fff", borderRadius: 12, padding: "14px 16px", fontSize: 16, minHeight: 220, resize: "vertical" }} />
          {s.problem && <button onClick={() => set({ problem: "" })} className="absolute" style={{ right: 12, bottom: 12, fontSize: 13, color: IOS.orange }}>Limpiar</button>}
        </div>
        <button onClick={() => setSymptomsOpen(true)} className="apple-press flex flex-col text-left" style={{ gap: 8, padding: 14, borderRadius: 14, background: W.card }}>
          <span className="flex items-center gap-2"><Wand2 className="w-4 h-4" style={{ color: IOS.orange }} /><span style={{ fontSize: 15, fontWeight: 600 }}>Síntomas</span></span>
          {symptomsSelected.length ? (
            <span className="flex flex-wrap" style={{ gap: 6 }}>{symptomsSelected.map((t) => <span key={t} className="flex items-center gap-1" style={{ padding: "3px 9px", borderRadius: 999, background: tint(IOS.orange, 0.18), color: IOS.orange, fontSize: 12, fontWeight: 600 }}>{t} <X className="w-3 h-3" /></span>)}</span>
          ) : <span style={{ fontSize: 14, color: W.sub }}>Toca para seleccionar</span>}
        </button>
      </div>
      <div className="flex flex-col" style={{ gap: 14 }}>
        <CartCard w={w} onAdd={onAddItemOpen} requiredHint={s.mode === "quick"} />
        <div className="flex flex-col" style={{ gap: 8 }}>
          <Caption className="flex items-center gap-1.5" style={{ display: "flex", alignItems: "center", gap: 6 }}><Lightbulb className="w-3.5 h-3.5" style={{ color: IOS.yellow }} /> Sugerencias para {deviceLabel}</Caption>
          {suggestions.length === 0 ? (
            (s.family || s.model) ? <p style={{ fontSize: 13, color: W.sub }}>No hay piezas para {s.model?.name || s.family?.name} en tu catálogo. Añádela desde Catálogo para que aparezca aquí.</p> : null
          ) : suggestions.map((p) => {
            const chip = stockChip(p);
            return (
              <div key={p.id} className="flex flex-col" style={{ gap: 8 }}>
                <div style={{ borderRadius: 12, background: W.card }}>
                  <ProductRow p={p} promo={resolveDeviceOffer(p, s.offers, promoCtx)} onClick={() => addSuggestion(p)} right={<span className="flex items-center gap-1.5">{chip && <span style={{ padding: "1px 7px", borderRadius: 999, background: tint(chip[1], 0.16), color: chip[1], fontSize: 10, fontWeight: 700 }}>{chip[0]}</span>}{inCart(p) ? <Check className="w-4 h-4" style={{ color: IOS.green }} /> : <Plus className="w-4 h-4" style={{ color: W.sub }} />}</span>} />
                </div>
              </div>
            );
          })}
        </div>
        <DeviceOffersStrip w={w} catalogSel={catalogSel} />
        {s.pendingParts.length > 0 && <Banner color={IOS.orange}>{s.pendingParts.length} pedido{s.pendingParts.length === 1 ? "" : "s"} a suplidor se crear{s.pendingParts.length === 1 ? "á" : "án"} al confirmar la orden.</Banner>}
      </div>
      {s.oosFor && <OutOfStockSheet product={s.oosFor} tenantId={tenantId} onClose={() => set({ oosFor: null })} onOrder={(pending) => {
        const line = s.cart.find((l) => l.product.id === pending.productId);
        const queued = { ...pending, unitPrice: line ? line.unitPrice : pending.unitPrice };
        set((prev) => ({ pendingParts: [...prev.pendingParts.filter((x) => x.productId !== queued.productId), queued], oosFor: null }));
      }} />}
      <Dialog open={symptomsOpen} onClose={() => setSymptomsOpen(false)} title="Síntomas" width={440} leading={<span />} trailing={<TextAction bold onClick={() => setSymptomsOpen(false)}>Listo</TextAction>}>
        <div style={{ borderRadius: 12, background: W.card2, overflow: "hidden", marginTop: 8 }}>
          {cats.map((t, i) => {
            const on = s.problem.toLowerCase().includes(t.toLowerCase());
            return <button key={t} onClick={() => set((p) => ({ problem: toggleProblemText(p.problem, t) }))} className="w-full flex items-center gap-3 text-left" style={{ padding: "12px 14px", borderTop: i ? `0.5px solid ${W.sep}` : "none" }}><span className="flex-1" style={{ fontSize: 15 }}>{t}</span>{on && <Check className="w-4 h-4" style={{ color: IOS.orange }} />}</button>;
          })}
          <div className="flex items-center gap-2" style={{ padding: "8px 14px", borderTop: `0.5px solid ${W.sep}` }}>
            <Plus className="w-4 h-4" style={{ color: IOS.orange }} />
            <input value={custom} onChange={(e) => setCustom(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && custom.trim()) { set((p) => ({ problem: appendProblemText(p.problem, custom.trim()) })); setCustom(""); } }} placeholder="Escribir otro…" className="flex-1 bg-transparent outline-none" style={{ color: "#fff", fontSize: 15 }} />
          </div>
        </div>
      </Dialog>
    </div>
  );
}
