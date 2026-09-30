import { useCallback, useEffect, useRef, useState } from "react";
import { Wrench, Plus, Loader2, Package, ShoppingBag, Globe, ExternalLink, ChevronRight, Trash2, Minus, AlertTriangle, PackageOpen, Check } from "lucide-react";
import { Dialog, TextAction, AlertDialog } from "@/components/pos/native/posUi";
import { Overlay, Banner } from "@/components/wizard/ui";
import { C, tint, money } from "@/components/orderDetail/ui";
import {
  itemLines, discountOf, taxModelOf, moneyModel, paymentsTotal, persistAll, lineTotalOf, fetchProductsByIds, fetchOrderPartLinks, updatePartLink, deletePartLink, setLinkStatus,
  fetchLinkedPurchaseCosts, openDraftsForOrder, orderLinkNow, addLinkToDraft, stockOf,
} from "@/lib/partsApi";
import { num, r2, STORES, storeOf, partTitle, safeUrl, PART_STATUS, fetchSuppliers, fetchOpenDraft, fetchPO, lineItems, receivePO, statusMeta, linePending } from "@/lib/comprasApi";
import AddPartsPage from "./AddParts";

const STORE_TILE = { amazon: () => <b style={{ fontSize: 18 }}>a</b>, ebay: () => <b style={{ fontSize: 18 }}>e</b>, aliexpress: () => <ShoppingBag className="w-5 h-5" />, other: () => <Globe className="w-5 h-5" /> };

function MoneyField({ value, onChange, width = 76, ariaLabel, disabled }) {
  const [text, setText] = useState(value);
  useEffect(() => { if (num(text) !== num(value)) setText(value); }, [value]);
  return (
    <span className="inline-flex items-center" style={{ background: C.card, borderRadius: 8, padding: "0 6px" }}>
      <span style={{ color: C.sub, fontSize: 13 }}>$</span>
      <input value={text} disabled={disabled} inputMode="decimal" aria-label={ariaLabel} onChange={(e) => { const r = e.target.value.replace(",", "."); if (/^\d*\.?\d{0,2}$/.test(r)) { setText(r); onChange(r); } }} className="bg-transparent outline-none text-right" style={{ width, color: "#fff", fontSize: 14, padding: "6px 0" }} />
    </span>
  );
}

export function EditPartPage({ open, line, product, orderNumber, onClose, onSave, onRemove }) {
  const isService = line?.type === "service";
  const isManual = line?.type === "manual";
  const [name, setName] = useState("");
  const [qty, setQty] = useState(1);
  const [price, setPrice] = useState("");
  const [mode, setMode] = useState("pct");
  const [disc, setDisc] = useState("");
  const [confirmRemove, setConfirmRemove] = useState(false);
  useEffect(() => {
    if (!open || !line) return;
    setName(line.name || ""); setQty(Math.max(1, Math.trunc(num(line.quantity)) || 1)); setPrice(String(num(line.price))); setMode("pct"); setDisc(num(line.discount_percent) > 0 ? String(num(line.discount_percent)) : "");
  }, [open, line?.id]);
  if (!open || !line) return null;
  const priceN = num(price);
  const gross = (isService ? Math.max(1, Math.trunc(num(line.quantity)) || 1) : qty) * priceN;
  const pct = mode === "pct" ? Math.min(100, Math.max(0, num(disc))) : gross > 0 ? Math.min(100, Math.max(0, Math.round((num(disc) / gross) * 100 * 1e6) / 1e6)) : 0;
  const total = r2(gross * (1 - pct / 100));
  const save = () => {
    const out = { ...line, quantity: isService ? Math.max(1, Math.trunc(num(line.quantity)) || 1) : qty, price: priceN, total, ...(isManual ? { name: name.trim() || line.name } : {}) };
    if (pct > 0) out.discount_percent = pct; else delete out.discount_percent;
    const same = out.quantity === num(line.quantity) && out.price === num(line.price) && (out.name || "") === (line.name || "") && num(out.discount_percent) === num(line.discount_percent);
    if (same) { onClose(); return; }
    onSave(out);
  };
  const stock = stockOf(product || {});
  const kind = isService ? "Servicio" : isManual ? "Pieza manual" : product ? "Pieza de inventario" : "Pieza";
  const Stepper = () => (
    <div className="flex items-center gap-4"><button onClick={() => setQty((q) => Math.max(1, q - 1))} aria-label="Menos" style={{ width: 44, height: 44, borderRadius: 999, background: C.card2 }}><Minus className="w-5 h-5 mx-auto" /></button><b style={{ fontSize: 32, minWidth: 54, textAlign: "center" }}>{qty}</b><button onClick={() => setQty((q) => Math.min(9999, q + 1))} aria-label="Más" style={{ width: 44, height: 44, borderRadius: 999, background: C.brand }}><Plus className="w-5 h-5 mx-auto" /></button></div>
  );
  return (
    <Overlay z={320} onEscape={onClose}>
      <div className="flex items-center gap-3" style={{ padding: "12px 20px", borderBottom: `0.5px solid ${C.sep}` }}>
        <button onClick={onClose} style={{ color: C.brand, fontWeight: 600 }}>Cancelar</button>
        <span className="flex-1 text-center"><b style={{ fontSize: 17 }}>Editar pieza</b><span className="block" style={{ fontSize: 12, color: C.sub }}>Orden {orderNumber}</span></span>
        <button onClick={save} className="apple-press" style={{ padding: "8px 18px", borderRadius: 999, background: C.brand, color: "#fff", fontWeight: 700 }}>Guardar</button>
      </div>
      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto grid" style={{ maxWidth: 980, padding: 20, gap: 24, gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", alignItems: "start" }}>
          <div className="flex flex-col" style={{ gap: 10 }}>
            <div style={{ width: "100%", maxWidth: 234, aspectRatio: "1", background: C.card, borderRadius: 18, display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden" }}>
              {product?.photo_urls?.[0] || product?.image_url ? <img src={product.photo_urls?.[0] || product.image_url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : <Package className="w-16 h-16" style={{ color: C.sub }} />}
            </div>
            <b style={{ fontSize: 19 }}>{line.name}</b>
            <div style={{ fontSize: 13, color: C.sub }}>
              {stock !== null && product && product.type !== "service" && <div className="flex justify-between"><span>Disponible</span><b style={{ color: stock > 0 ? C.green : C.red }}>{stock} en stock</b></div>}
              {product?.sku && <div className="flex justify-between"><span>SKU</span><b style={{ color: "#fff" }}>{product.sku}</b></div>}
              <div className="flex justify-between"><span>Tipo</span><b style={{ color: "#fff" }}>{kind}</b></div>
            </div>
          </div>
          <div className="flex flex-col" style={{ gap: 14, maxWidth: 640 }}>
            {isManual && <label className="flex flex-col" style={{ gap: 4 }}><span style={{ fontSize: 12, fontWeight: 700, color: C.sub }}>Nombre</span><input value={name} onChange={(e) => setName(e.target.value)} className="outline-none" style={{ background: C.card, color: "#fff", borderRadius: 12, padding: "12px 14px", fontSize: 16 }} /></label>}
            {!isService && <div><p style={{ fontSize: 12, fontWeight: 700, color: C.sub, marginBottom: 6 }}>Cantidad</p><Stepper />{product && !isManual && <p style={{ fontSize: 12, color: C.sub, marginTop: 6 }}>Se descuenta del inventario al guardar</p>}</div>}
            <div><p style={{ fontSize: 12, fontWeight: 700, color: C.sub, marginBottom: 6 }}>Precio por unidad</p><div className="flex items-center gap-2" style={{ background: C.card, borderRadius: 12, padding: "0 14px", height: 50 }}><span style={{ color: C.sub }}>$</span><input value={price} onChange={(e) => { const r = e.target.value.replace(",", "."); if (/^\d*\.?\d{0,2}$/.test(r)) setPrice(r); }} inputMode="decimal" aria-label="Precio por unidad" className="bg-transparent outline-none flex-1" style={{ color: "#fff", fontSize: 20, fontWeight: 700 }} /></div>{product && num(product.price) > 0 && <p style={{ fontSize: 12, color: C.sub, marginTop: 6 }}>Precio de lista {money(product.price)}</p>}</div>
            <div><p style={{ fontSize: 12, fontWeight: 700, color: C.sub, marginBottom: 6 }}>Descuento</p>
              <div className="flex items-center gap-2"><div className="grid grid-cols-2" style={{ padding: 2, gap: 2, borderRadius: 9, background: "rgba(118,118,128,0.24)", width: 110 }}>{[["pct", "%"], ["usd", "$"]].map(([k, l]) => <button key={k} onClick={() => setMode(k)} style={{ padding: "7px 0", borderRadius: 7, fontWeight: 700, background: mode === k ? "#636366" : "transparent" }}>{l}</button>)}</div>
                <input value={disc} onChange={(e) => { const r = e.target.value.replace(",", "."); if (/^\d*\.?\d{0,2}$/.test(r)) setDisc(r); }} inputMode="decimal" placeholder="0" aria-label="Descuento" className="outline-none flex-1" style={{ background: C.card, color: "#fff", borderRadius: 12, padding: "12px 14px", fontSize: 16, minWidth: 0 }} /></div>
              <p style={{ fontSize: 12, color: C.sub, marginTop: 6 }}>En porciento o en dólares</p></div>
            <div style={{ padding: 16, borderRadius: 16, border: `1px solid ${tint(C.brand, 0.4)}`, background: tint(C.brand, 0.08) }}>
              <p style={{ fontSize: 12, color: C.sub }}>Total de la línea</p><p style={{ fontSize: 34, fontWeight: 900 }}>{money(total)}</p>
              {pct > 0 && <p style={{ fontSize: 13, color: C.green, fontWeight: 700 }}>Ahorra {money(r2(gross - total))}</p>}
            </div>
            <button onClick={() => setConfirmRemove(true)} className="apple-press flex items-center justify-center gap-2" style={{ padding: "13px 0", borderRadius: 14, background: tint(C.red, 0.14), color: C.red, fontWeight: 700 }}><Trash2 className="w-4 h-4" /> Quitar del carrito</button>
          </div>
        </div>
      </div>
      <AlertDialog open={confirmRemove} title={`¿Quitar ${line.name} del carrito?`} message="" onClose={() => setConfirmRemove(false)} actions={[{ label: "Cancelar" }, { label: "Quitar", destructive: true, onPress: () => onRemove(line) }]} />
    </Overlay>
  );
}

function LinkEditDialog({ open, link, onClose, onSaved }) {
  const [url, setUrl] = useState("");
  const [title, setTitle] = useState("");
  const [cost, setCost] = useState("");
  const [price, setPrice] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => { if (open && link) { setUrl(link.url || ""); setTitle(link.title || ""); setPrice(link.price === null || link.price === undefined ? "" : String(link.price)); setCost(link.cost === null || link.cost === undefined ? "" : String(link.cost)); } }, [open, link?.id]);
  if (!link) return null;
  const store = STORES[storeOf(url)].label;
  const profit = price !== "" && cost !== "" ? num(price) - num(cost) : null;
  const inp = (label, v, set, ph, dec) => <label className="flex flex-col" style={{ gap: 4 }}><span style={{ fontSize: 12, fontWeight: 700, color: C.sub }}>{label}</span><input value={v} onChange={(e) => set(dec ? e.target.value.replace(",", ".") : e.target.value)} placeholder={ph} inputMode={dec ? "decimal" : undefined} className="outline-none" style={{ background: C.card2, color: "#fff", borderRadius: 12, padding: "12px 14px", fontSize: 16 }} /></label>;
  return (
    <Dialog open={open} onClose={onClose} title="Editar pieza" width={440} leading={<TextAction onClick={onClose}>Cancelar</TextAction>} trailing={<TextAction bold disabled={busy} onClick={async () => { setBusy(true); try { await updatePartLink(link.id, { url, title, cost, price }); onSaved(); onClose(); } finally { setBusy(false); } }}>Guardar</TextAction>}>
      <div className="flex flex-col" style={{ gap: 12, paddingTop: 8 }}>
        {inp("Link de la pieza", url, setUrl, "Pega la URL (Amazon, eBay…)")}
        <p style={{ fontSize: 12, color: C.sub }}>Tienda: {store}</p>
        {inp("Nombre de la pieza (opcional)", title, setTitle, "")}
        <div className="grid grid-cols-2" style={{ gap: 10 }}>{inp("Costo", cost, setCost, "0.00", true)}{inp("Precio", price, setPrice, "0.00", true)}</div>
        {profit !== null && <p style={{ fontSize: 14, fontWeight: 700, color: profit >= 0 ? C.green : C.red }}>Ganancia {money(profit)}</p>}
      </div>
    </Dialog>
  );
}

function OrderLinkSheet({ open, link, order, tenantId, employeeName, onClose, onDone, setMsg }) {
  const [suppliers, setSuppliers] = useState([]);
  const [sup, setSup] = useState(null);
  const [draftCount, setDraftCount] = useState(0);
  const [busy, setBusy] = useState(false);
  useEffect(() => { if (open) { setSup(null); setDraftCount(0); fetchSuppliers(tenantId).then(setSuppliers, () => setSuppliers([])); } }, [open, tenantId]);
  useEffect(() => { if (sup) fetchOpenDraft(tenantId, sup.id).then((d) => setDraftCount(d ? lineItems(d).length : 0), () => setDraftCount(0)); }, [sup?.id]);
  if (!link) return null;
  const site = String(sup?.website || "").toLowerCase();
  const singleShip = /amazon|ebay|aliexpress/.test(site);
  const promised = order.promised_date ? (new Date(order.promised_date) - new Date()) / 86400000 <= 1 : false;
  const accumulatePrimary = !singleShip && !promised;
  const run = async (fn) => { setBusy(true); try { const r = await fn(); onDone(r); onClose(); } catch (e) { setMsg(e?.message || String(e)); } finally { setBusy(false); } };
  const accumulate = () => run(() => addLinkToDraft({ tenantId, supplier: sup, link, order, by: employeeName }));
  const now = () => run(() => orderLinkNow({ tenantId, link, order, by: employeeName }));
  const btn = (label, onClick, primary) => <button onClick={onClick} disabled={busy} className="apple-press w-full disabled:opacity-50" style={{ padding: "13px 0", borderRadius: 14, background: primary ? C.brand : C.card2, color: "#fff", fontWeight: 700 }}>{label}</button>;
  return (
    <Dialog open={open} onClose={() => !busy && onClose()} dismissable={!busy} title={partTitle(link)} width={440} leading={<TextAction onClick={onClose} disabled={busy}>Cancelar</TextAction>} trailing={<b style={{ color: C.red }}>{link.cost !== null && link.cost !== undefined ? money(link.cost) : ""}</b>}>
      <div className="flex flex-col" style={{ gap: 12, paddingTop: 8 }}>
        <p style={{ fontSize: 11, fontWeight: 800, letterSpacing: "0.06em", color: C.sub }}>SUPLIDOR</p>
        <select value={sup?.id || ""} onChange={(e) => setSup(suppliers.find((s) => s.id === e.target.value) || null)} aria-label="Suplidor" style={{ background: C.card2, color: "#fff", borderRadius: 12, padding: "12px 14px", fontSize: 16, colorScheme: "dark" }}><option value="">Escoge un suplidor</option>{suppliers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select>
        {sup && (
          <>
            {singleShip && <p style={{ fontSize: 12, color: C.sub }}>Aquí juntar piezas no ahorra envío.</p>}
            {!singleShip && promised && <p style={{ fontSize: 12, color: C.sub }}>Esta orden entrega hoy o mañana.</p>}
            {btn(draftCount > 0 ? `Añadir al pedido de ${sup.name} (${draftCount})` : `Empezar pedido de ${sup.name}`, accumulate, accumulatePrimary)}
            {btn("Ordenar ahora, esta va sola", now, !accumulatePrimary)}
          </>
        )}
      </div>
    </Dialog>
  );
}

function LinkCard({ link, busy, onEdit, onOrder, onStatus, onDelete }) {
  const sk = storeOf(link.url, link.store);
  const store = STORES[sk];
  const Tile = STORE_TILE[sk];
  const st = PART_STATUS[link.status] || PART_STATUS.to_order;
  const profit = link.price !== null && link.price !== undefined && link.cost !== null && link.cost !== undefined ? num(link.price) - num(link.cost) : null;
  return (
    <div className="flex flex-col" style={{ gap: 8, padding: 12, borderRadius: 12, background: C.card2 }}>
      <div className="flex items-center gap-3">
        <button onClick={onEdit} className="flex items-center gap-3 flex-1 min-w-0 text-left">
          <span style={{ width: 40, height: 40, borderRadius: 10, background: store.color, color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}><Tile /></span>
          <span className="flex-1 min-w-0"><span className="block truncate" style={{ fontSize: 14, fontWeight: 600 }}>{partTitle(link)}</span>
            <span className="flex items-center gap-2 flex-wrap" style={{ fontSize: 12, color: C.sub }}>{store.label}{link.cost !== null && link.cost !== undefined && <span style={{ color: C.red }}>Costo {money(link.cost)}</span>}{link.price !== null && link.price !== undefined && <span style={{ color: C.green }}>Precio {money(link.price)}</span>}{profit !== null && <span style={{ color: profit >= 0 ? C.green : C.red }}>Ganancia {money(profit)}</span>}</span></span>
        </button>
        <button onClick={link.status === "to_order" ? undefined : onStatus} disabled={link.status === "to_order" || busy} className="apple-press" style={{ padding: "5px 11px", borderRadius: 999, background: tint(st.color, 0.18), color: st.color, fontSize: 12, fontWeight: 700, cursor: link.status === "to_order" ? "default" : "pointer" }}>{st.label}</button>
      </div>
      <div className="flex items-center" style={{ gap: 8 }}>
        <a href={safeUrl(link.url)} target="_blank" rel="noopener noreferrer" className="apple-press flex items-center gap-1" style={{ padding: "6px 12px", borderRadius: 999, background: "#3A3A3C", fontSize: 13, fontWeight: 600 }}><ExternalLink className="w-3.5 h-3.5" /> Abrir</a>
        {link.status === "to_order" && <button onClick={onOrder} className="apple-press" style={{ padding: "6px 12px", borderRadius: 999, background: C.brand, color: "#fff", fontSize: 13, fontWeight: 700 }}>Ordenar</button>}
        <span className="flex-1" />
        <button onClick={onDelete} aria-label="Eliminar" style={{ color: C.red }}><Trash2 className="w-4 h-4" /></button>
      </div>
    </div>
  );
}

export function PartsModule({ order, tenant, tenantId, employeeName, onReload, onOpenPO, onCloseDraft, onExtrasChanged }) {
  const itemsSig = JSON.stringify(order.order_items || []);
  const [lines, setLines] = useState(() => itemLines(order));
  const initTax = taxModelOf(order, tenant);
  const [labor, setLabor] = useState(String(num(order.labor_cost) || ""));
  const [taxOn, setTaxOn] = useState(initTax.on);
  const [taxPct, setTaxPct] = useState(String(initTax.pct));
  const [discount, setDiscount] = useState(discountOf(order) > 0 ? discountOf(order).toFixed(2) : "");
  const [credit, setCredit] = useState(num(order.amount_paid));
  const [products, setProducts] = useState({});
  const [links, setLinks] = useState([]);
  const [poEntries, setPoEntries] = useState([]);
  const [drafts, setDrafts] = useState([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [editLine, setEditLine] = useState(null);
  const [addOpen, setAddOpen] = useState(false);
  const [linkEdit, setLinkEdit] = useState(null);
  const [linkOrder, setLinkOrder] = useState(null);
  const [linkDel, setLinkDel] = useState(null);
  const [busyLink, setBusyLink] = useState(null);
  const [baseSig, setBaseSig] = useState("");
  const sigOf = (l, tx, tp, d) => `${num(l)}|${tx}|${num(tp)}|${num(d)}`;
  const savingRef = useRef(false);
  const busyLinkRef = useRef(null);
  const stateRef = useRef({});

  const dirty = baseSig !== "" && sigOf(labor, taxOn, taxPct, discount) !== baseSig;
  const moneySig = `${order.labor_cost}|${order.tax_rate}|${discountOf(order)}`;

  useEffect(() => { setLines(itemLines(order)); }, [order.id, itemsSig]);
  useEffect(() => {
    if (stateRef.current.dirty) return;
    const tm = taxModelOf(order, tenant);
    const lab = String(num(order.labor_cost) || "");
    const d = discountOf(order);
    const dText = d > 0 ? d.toFixed(2) : "";
    setLabor(lab); setTaxOn(tm.on); setTaxPct(String(tm.pct)); setDiscount(dText);
    setBaseSig(sigOf(lab, tm.on, tm.pct, dText));
  }, [order.id, moneySig, tenant?.id]);

  const loadExtras = useCallback(async () => {
    const ids = [...new Set(itemLines(order).filter((l) => l.id && l.type === "part").map((l) => l.id))];
    const [prods, lk, cr, pos, dr] = await Promise.all([
      fetchProductsByIds(tenantId, ids).catch(() => ({})), fetchOrderPartLinks(tenantId, order.id).catch(() => []), paymentsTotal(order.id).catch(() => 0),
      fetchLinkedPurchaseCosts(tenantId, order.id).catch(() => []), openDraftsForOrder(tenantId, order.id).catch(() => []),
    ]);
    setProducts(prods); setLinks(lk); setCredit(Math.max(cr, num(order.amount_paid))); setPoEntries(pos); setDrafts(dr);
    onExtrasChanged?.();
  }, [tenantId, order.id, itemsSig, order.amount_paid]);
  useEffect(() => { loadExtras(); }, [loadExtras]);

  const m = moneyModel({ lines, labor: num(labor), taxOn, taxPct, discount: num(discount), credit });
  stateRef.current = { lines, labor, taxOn, taxPct, discount, credit, dirty, order };

  const persist = useCallback(async (nextLines, rollback) => {
    if (savingRef.current) return false;
    savingRef.current = true; setSaving(true); setError(null);
    try {
      const s = stateRef.current;
      await persistAll({ order: s.order, tenantId, lines: nextLines, labor: num(s.labor), taxOn: s.taxOn, taxPct: s.taxPct, discount: num(s.discount), credit: s.credit, by: employeeName });
      setBaseSig(sigOf(s.labor, s.taxOn, s.taxPct, s.discount));
      stateRef.current = { ...stateRef.current, dirty: false };
      await onReload();
      return true;
    } catch (e) {
      setError(e?.message || String(e));
      if (rollback) setLines(rollback);
      return false;
    } finally { savingRef.current = false; setSaving(false); }
  }, [tenantId, employeeName, onReload]);

  useEffect(() => () => {
    const s = stateRef.current;
    if (s.dirty && s.order && !savingRef.current) persistAll({ order: s.order, tenantId, lines: s.lines, labor: num(s.labor), taxOn: s.taxOn, taxPct: s.taxPct, discount: num(s.discount), credit: s.credit, by: employeeName }).catch(() => {});
  }, []);

  const removeLine = (idx) => { const before = lines; const next = lines.filter((_, i) => i !== idx); setEditLine(null); setLines(next); persist(next, before); };
  const saveLine = (idx, updated) => { const before = lines; const next = lines.map((x, i) => (i === idx ? updated : x)); setEditLine(null); setLines(next); persist(next, before); };
  const openAdd = async () => { if (dirty) { const ok = await persist(lines); if (!ok) return; } setAddOpen(true); };

  const receiveLink = async (k) => {
    if (busyLinkRef.current) return;
    busyLinkRef.current = k.id; setBusyLink(k.id);
    try {
      if (k.status === "ordered") {
        if (k.purchase_order_id) {
          const po = await fetchPO(k.purchase_order_id);
          if (!po) throw new Error("No se encontró la compra vinculada a esta pieza.");
          if (po.status === "cancelled") throw new Error("Esta compra está cancelada; no se puede recibir.");
          const received = {};
          lineItems(po).forEach((l) => { received[l.id] = linePending(l); });
          await receivePO({ tenantId, poId: po.id, received, location: "", by: employeeName, tenant });
        }
        await setLinkStatus(k.id, "received");
      } else await setLinkStatus(k.id, "ordered");
      await loadExtras();
      await onReload();
    } catch (e) { setError(e?.message || String(e)); } finally { busyLinkRef.current = null; setBusyLink(null); }
  };

  const toOrderLinks = links.filter((l) => l.status === "to_order");
  const orderedLinks = links.filter((l) => l.status !== "to_order");
  const linkedPoIds = new Set(links.map((l) => l.purchase_order_id).filter(Boolean));
  const poOnly = poEntries.filter((e) => linePending(e.line) > 0 || e.po.status === "ordered").filter((e) => !linkedPoIds.has(e.po.id));
  const tagOf = (l) => (l.type === "service" ? "Servicio" : l.type === "manual" ? "Manual" : links.some((k) => k.id === l.source_part_link_id) ? `via ${STORES[storeOf(links.find((k) => k.id === l.source_part_link_id).url)].label}` : "En stock");
  const balanceRow = () => {
    const noItems = m.itemsSubtotal <= 0 && num(labor) <= 0;
    if (noItems && credit > 0) return ["Depósito recibido · en crédito", C.blue, credit];
    if (noItems) return ["Sin cargos todavía", C.sub, null];
    if (Math.abs(m.balance) < 0.01) return ["Pagado completo", C.green, null];
    if (m.balance < -0.01) return ["Crédito a favor del cliente", C.blue, Math.abs(m.balance)];
    return ["Saldo pendiente", C.brand, m.balance];
  };
  const [bLabel, bColor, bAmt] = balanceRow();

  return (
    <div style={{ background: C.card, borderRadius: 20, border: `0.5px solid ${C.sep}`, padding: 16 }}>
      <div className="flex items-center gap-3 flex-wrap" style={{ marginBottom: 12 }}>
        <span style={{ width: 34, height: 34, borderRadius: 10, background: tint(C.brand, 0.16), color: C.brand, display: "flex", alignItems: "center", justifyContent: "center" }}><Wrench className="w-4 h-4" /></span>
        <b style={{ fontSize: 18 }}>Piezas</b>
        <span style={{ padding: "3px 11px", borderRadius: 999, background: tint(C.teal, 0.16), color: C.teal, fontSize: 12, fontWeight: 700 }}>{lines.length} en el carrito · {money(m.itemsSubtotal)}</span>
        {toOrderLinks.length > 0 && <span style={{ padding: "3px 11px", borderRadius: 999, background: tint("#FFD60A", 0.18), color: "#FFD60A", fontSize: 12, fontWeight: 700 }}>{toOrderLinks.length} por pedir</span>}
        {saving && <Loader2 className="w-4 h-4 animate-spin" style={{ color: C.sub }} />}
      </div>
      {error && <div style={{ marginBottom: 10 }}><Banner color={C.red} onDismiss={() => setError(null)}>{error}</Banner></div>}
      <div className="grid" style={{ gap: 16, gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", alignItems: "start", opacity: saving ? 0.7 : 1 }}>
        <div className="flex flex-col" style={{ gap: 10, minWidth: 0 }}>
          {drafts.map((d) => { const clients = new Set(lineItems(d).map((l) => l.linked_work_order_id).filter(Boolean)).size; return (
            <div key={d.id} className="flex items-center gap-3" style={{ padding: "10px 12px", borderRadius: 12, background: tint("#FFD60A", 0.1), border: `1px solid ${tint("#FFD60A", 0.3)}` }}>
              <span className="flex-1 min-w-0"><span className="block" style={{ fontSize: 14, fontWeight: 600 }}>{d.supplier_name} · {lineItems(d).length} piezas</span><span className="block" style={{ fontSize: 12, color: C.sub }}>{clients === 1 ? "1 cliente esperando" : `${clients} clientes esperando`}</span></span>
              <button onClick={() => onCloseDraft?.(d)} className="apple-press" style={{ padding: "6px 14px", borderRadius: 999, background: "#FFD60A", color: "#000", fontWeight: 800, fontSize: 13 }}>Cerrar</button>
            </div>); })}
          <div className="flex items-center gap-2"><p style={{ fontSize: 12, fontWeight: 700, letterSpacing: "0.06em", color: C.sub }}>EN EL CARRITO</p><span style={{ padding: "1px 8px", borderRadius: 999, background: C.card2, fontSize: 11, fontWeight: 700 }}>{lines.length}</span></div>
          {lines.map((l, i) => { const p = products[l.id]; const img = p?.photo_urls?.[0] || p?.image_url; return (
            <button key={`${l.id}-${i}`} onClick={() => setEditLine({ line: l, idx: i })} disabled={saving} className="apple-press flex items-center gap-3 text-left disabled:opacity-60" style={{ padding: "8px 10px", borderRadius: 12, background: C.card2 }}>
              <span style={{ width: 48, height: 48, borderRadius: 10, background: C.card, display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden", flexShrink: 0 }}>{img ? <img src={img} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : l.type === "service" ? <Wrench className="w-5 h-5" style={{ color: C.sub }} /> : <Package className="w-5 h-5" style={{ color: C.sub }} />}</span>
              <span className="flex-1 min-w-0"><span className="block" style={{ fontSize: 14, fontWeight: 600, overflow: "hidden", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" }}>{l.name}</span><span className="block" style={{ fontSize: 11, color: C.sub }}>{tagOf(l)}</span></span>
              {num(l.discount_percent) > 0 && <span style={{ padding: "2px 8px", borderRadius: 999, background: tint(C.green, 0.16), color: C.green, fontSize: 11, fontWeight: 700 }}>Ahorra {money(r2(num(l.price) * num(l.quantity) - lineTotalOf(l)))}</span>}
              {l.type !== "service" && <span style={{ padding: "2px 9px", borderRadius: 999, background: tint(C.brand, 0.18), color: C.brand, fontSize: 12, fontWeight: 800 }}>×{num(l.quantity)}</span>}
              <b style={{ fontSize: 14, fontVariantNumeric: "tabular-nums" }}>{money(lineTotalOf(l))}</b>
            </button>); })}
          <button onClick={openAdd} disabled={saving} className="apple-press flex flex-col items-center justify-center gap-1 disabled:opacity-60" style={{ padding: lines.length ? "12px 0" : "22px 0", borderRadius: 12, border: `1.5px dashed ${tint(C.brand, 0.6)}`, color: C.brand, fontWeight: 700 }}>
            <span className="flex items-center gap-2"><Plus className="w-4 h-4" /> Agregar pieza</span>{!lines.length && <span style={{ fontSize: 12, color: C.sub, fontWeight: 500 }}>Carrito vacío</span>}
          </button>
          {(links.length > 0 || poOnly.length > 0) && (
            <>
              <div className="flex items-center gap-2"><p style={{ fontSize: 12, fontWeight: 700, letterSpacing: "0.06em", color: C.sub }}>PIEZAS POR CONSEGUIR</p><span style={{ padding: "1px 8px", borderRadius: 999, background: C.card2, fontSize: 11, fontWeight: 700 }}>{links.length + poOnly.length}</span></div>
              {[...toOrderLinks, ...orderedLinks].map((k) => <LinkCard key={k.id} link={k} onEdit={() => setLinkEdit(k)} onOrder={() => setLinkOrder(k)} onDelete={() => setLinkDel(k)}
                busy={busyLink === k.id} onStatus={() => receiveLink(k)} />)}
              {poOnly.map((e) => <button key={`${e.po.id}-${e.line.id}`} onClick={() => onOpenPO?.(e.po.id)} className="apple-press flex items-center gap-3 text-left" style={{ padding: "10px 12px", borderRadius: 12, background: C.card2 }}><PackageOpen className="w-5 h-5" style={{ color: C.sub }} /><span className="flex-1 min-w-0"><span className="block truncate" style={{ fontSize: 14, fontWeight: 600 }}>{e.line.product_name}</span><span className="block" style={{ fontSize: 12, color: C.sub }}>{e.po.po_number} · {statusMeta(e.po.status).label}</span></span><ChevronRight className="w-4 h-4" style={{ color: C.sub }} /></button>)}
            </>
          )}
        </div>
        <div className="flex flex-col" style={{ gap: 8, padding: 14, borderRadius: 16, background: "#2C2C2E66" }}>
          {credit > m.grand + 0.005 && m.grand > 0 && <span style={{ padding: "4px 10px", borderRadius: 999, background: tint(C.green, 0.16), color: C.green, fontSize: 12, fontWeight: 700, alignSelf: "flex-start" }}>Crédito disponible: {money(credit - m.grand)}</span>}
          <div className="flex justify-between" style={{ fontSize: 14 }}><span style={{ color: C.sub }}>Subtotal piezas</span><span style={{ fontVariantNumeric: "tabular-nums" }}>{money(m.itemsSubtotal)}</span></div>
          <div className="flex items-center justify-between" style={{ fontSize: 14 }}><span style={{ color: C.sub }}>Mano de obra</span><MoneyField value={labor} onChange={setLabor} ariaLabel="Mano de obra" disabled={saving} /></div>
          <div className="flex items-center justify-between" style={{ fontSize: 14 }}><span className="flex items-center gap-2"><button onClick={() => setTaxOn((v) => !v)} role="switch" aria-checked={taxOn} aria-label="Impuesto" style={{ width: 40, height: 24, borderRadius: 999, background: taxOn ? C.brand : "#3A3A3C", position: "relative" }}><span style={{ position: "absolute", top: 2, left: taxOn ? 18 : 2, width: 20, height: 20, borderRadius: 999, background: "#fff", transition: "left 0.2s" }} /></button><span style={{ color: C.sub }}>Impuesto</span></span>
            {taxOn && <span className="flex items-center gap-2"><span className="inline-flex items-center" style={{ background: C.card, borderRadius: 8, padding: "0 6px" }}><input value={taxPct} onChange={(e) => { const r = e.target.value.replace(",", "."); if (/^\d*\.?\d{0,2}$/.test(r)) setTaxPct(r); }} inputMode="decimal" aria-label="Porcentaje de impuesto" className="bg-transparent outline-none text-right" style={{ width: 44, color: "#fff", fontSize: 13, padding: "5px 0" }} /><span style={{ color: C.sub, fontSize: 12 }}>%</span></span><span style={{ fontVariantNumeric: "tabular-nums" }}>{money(m.tax)}</span></span>}</div>
          <div className="flex items-center justify-between" style={{ fontSize: 14 }}><span style={{ color: C.sub }}>Descuento</span><MoneyField value={discount} onChange={setDiscount} ariaLabel="Descuento" disabled={saving} /></div>
          <div style={{ height: 0.5, background: C.sep }} />
          <div className="flex justify-between" style={{ fontSize: 16, fontWeight: 800 }}><span>Total</span><span style={{ color: C.blue, fontVariantNumeric: "tabular-nums" }}>{money(m.grand)}</span></div>
          <div className="flex justify-between" style={{ fontSize: 14 }}><span style={{ color: C.sub }}>Pagado</span><span style={{ color: C.green }}>{money(credit)}</span></div>
          <div className="flex justify-between items-center" style={{ fontSize: 14, fontWeight: 700, color: bColor }}><span className="flex items-center gap-2"><Check className="w-4 h-4" />{bLabel}</span>{bAmt !== null && <span style={{ fontVariantNumeric: "tabular-nums" }}>{money(bAmt)}</span>}</div>
          {dirty && <button onClick={() => persist(lines)} disabled={saving} className="apple-press disabled:opacity-60" style={{ marginTop: 6, padding: "11px 0", borderRadius: 12, background: C.brand, color: "#fff", fontWeight: 700 }}>{saving ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : "Guardar cambios"}</button>}
        </div>
      </div>
      <EditPartPage open={!!editLine} line={editLine?.line} product={editLine ? products[editLine.line.id] : null} orderNumber={order.order_number} onClose={() => setEditLine(null)} onSave={(u) => saveLine(editLine.idx, u)} onRemove={() => removeLine(editLine.idx)} />
      {addOpen && <AddPartsPage order={order} tenantId={tenantId} employeeName={employeeName} lines={lines} onClose={(changed) => { setAddOpen(false); if (changed) onReload(); }} />}
      <LinkEditDialog open={!!linkEdit} link={linkEdit} onClose={() => setLinkEdit(null)} onSaved={loadExtras} />
      <OrderLinkSheet open={!!linkOrder} link={linkOrder} order={order} tenantId={tenantId} employeeName={employeeName} onClose={() => setLinkOrder(null)} setMsg={setError} onDone={async () => { await loadExtras(); await onReload(); }} />
      <AlertDialog open={!!linkDel} title={linkDel?.status === "to_order" ? "¿Eliminar esta pieza a conseguir?" : "¿Eliminar esta pieza ya ordenada?"} message={linkDel?.status === "to_order" ? partTitle(linkDel || {}) : "Ya se ordenó y puede tener un gasto registrado en Finanzas — eliminar esto no cancela esa compra."} onClose={() => setLinkDel(null)}
        actions={[{ label: "Cancelar" }, { label: "Eliminar", destructive: true, onPress: async () => { try { await deletePartLink(linkDel.id); await loadExtras(); } catch (e) { setError(e?.message || String(e)); } } }]} />
    </div>
  );
}

export function JobCostCard({ order, tenantId, onOpenPO, tick }) {
  const [entries, setEntries] = useState([]);
  useEffect(() => { fetchLinkedPurchaseCosts(tenantId, order.id).then(setEntries, () => setEntries([])); }, [tenantId, order.id, order.updated_date, tick]);
  if (!entries.length) return null;
  const isRec = (po) => po.status === "received" || po.status === "partial";
  const total = entries.reduce((s, e) => s + num(e.line.quantity) * num(e.line.unit_cost), 0);
  const received = entries.filter((e) => isRec(e.po)).reduce((s, e) => s + num(e.line.quantity) * num(e.line.unit_cost), 0);
  const pending = total - received;
  const paid = num(order.amount_paid);
  const net = paid - received;
  const grand = num(order.cost_estimate ?? order.labor_cost);
  return (
    <div style={{ background: C.card, borderRadius: 20, border: `0.5px solid ${C.sep}`, padding: 16 }}>
      <p style={{ fontSize: 12, fontWeight: 700, letterSpacing: "0.06em", color: C.sub, textTransform: "uppercase", marginBottom: 8 }}>Costo del trabajo</p>
      {entries.map((e) => (
        <button key={`${e.po.id}-${e.line.id}`} onClick={() => onOpenPO?.(e.po.id)} className="apple-press w-full flex items-center gap-3 text-left" style={{ padding: "8px 0" }}>
          <span style={{ color: isRec(e.po) ? C.green : C.amber }}>{isRec(e.po) ? <Check className="w-4 h-4" strokeWidth={3} /> : <AlertTriangle className="w-4 h-4" />}</span>
          <span className="flex-1 min-w-0"><span className="block truncate" style={{ fontSize: 14, fontWeight: 600 }}>{e.line.product_name}</span><span className="block" style={{ fontSize: 12, color: C.sub }}>{e.po.po_number} · {num(e.line.quantity)} × {money(num(e.line.unit_cost))}</span></span>
          <b style={{ color: C.red }}>{money(num(e.line.quantity) * num(e.line.unit_cost))}</b><ChevronRight className="w-4 h-4" style={{ color: C.sub }} />
        </button>
      ))}
      <div style={{ height: 0.5, background: C.sep, margin: "8px 0" }} />
      <div className="flex justify-between" style={{ fontWeight: 800 }}><span>Total piezas</span><span style={{ color: C.red }}>{money(total)}{pending > 0.005 && <span style={{ fontSize: 12, color: C.sub, fontWeight: 500 }}> (Pendiente recibir {money(pending)})</span>}</span></div>
      <p style={{ fontSize: 12, fontWeight: 700, letterSpacing: "0.06em", color: C.sub, textTransform: "uppercase", margin: "14px 0 8px" }}>Ganancia neta</p>
      <div className="flex justify-between" style={{ fontSize: 14, padding: "3px 0" }}><span style={{ color: C.sub }}>Cobrado</span><span style={{ color: C.green }}>{money(paid)}</span></div>
      <div className="flex justify-between" style={{ fontSize: 14, padding: "3px 0" }}><span style={{ color: C.sub }}>Piezas (recibidas)</span><span>− {money(received)}</span></div>
      <div style={{ height: 0.5, background: C.sep, margin: "6px 0" }} />
      <div className="flex justify-between" style={{ fontSize: 17, fontWeight: 800 }}><span>Neto actual</span><span style={{ color: net > 0 ? C.green : net < 0 ? C.red : C.sub }}>{money(net)}</span></div>
      {!order.paid && grand > paid && Math.abs(grand - received - net) > 0.005 && <p style={{ fontSize: 12, color: C.sub, marginTop: 6 }}>Al cobrar balance: {money(grand - received)}</p>}
    </div>
  );
}

