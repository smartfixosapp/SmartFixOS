import { useEffect, useMemo, useState } from "react";
import { Tag, Percent, Gift, MinusCircle, Plus, PlusCircle, ChevronRight, Loader2, Trash2, Power } from "lucide-react";
import { Dialog, TextAction, AlertDialog, tint } from "@/components/pos/native/posUi";
import { FP } from "@/lib/finance/ledger";
import { money } from "@/components/finanzas/ui";
import { parseMoney } from "@/lib/posLogic";
import { loadCatalog } from "@/lib/wizard/api";
import { effectivePrice, partMatchContext } from "@/lib/wizard/helpers";
import { offerIsDevice, offerDeviceLabel, offerMatchesProduct } from "@/lib/wizard/offers";
import {
  listOffers, offerType, offerLive, offerDaysLeft, offerExpiringSoon, offerLabel, offerPromoPrice, insertOffer, updateOffer, setOfferActive, deleteOffer,
  offerEndsAtFor, defaultOfferEnd, num,
} from "@/lib/inicioApi";

const TYPE_ICON = { fixed: Tag, percent: Percent, combo: Gift, amount: MinusCircle };

function titleFor(o, product) {
  if (offerIsDevice(o)) return `Equipo: ${offerDeviceLabel(o)}`;
  if (product) return product.name;
  if (o.category) return `Categoría: ${o.category}`;
  return offerLabel(o);
}

function PriceLine({ o, product }) {
  if (product && offerType(o) !== "combo") {
    const base = num(product.price);
    const promo = offerPromoPrice(o, base);
    return (
      <span className="flex items-center gap-1.5" style={{ fontSize: 12 }}>
        <span style={{ color: "#8E8E93", textDecoration: "line-through" }}>{money(base)}</span>
        <span style={{ color: FP.success, fontWeight: 700 }}>{money(promo)}</span>
        {offerType(o) === "percent" && <span style={{ color: "#8E8E93" }}>({num(o.value)}% off)</span>}
      </span>
    );
  }
  return <span style={{ fontSize: 12, color: "#8E8E93" }}>{offerLabel(o)}</span>;
}

export function ActiveOffersCard({ offers, products, onOpen }) {
  const byId = useMemo(() => new Map(products.map((p) => [p.id, p])), [products]);
  const live = offers.filter((o) => offerLive(o) && (!o.product_id || byId.has(o.product_id)));
  if (!live.length) return null;
  const soon = live.filter(offerExpiringSoon).length;
  return (
    <div className="flex flex-col" style={{ gap: 8, padding: 16, borderRadius: 16, background: "#1C1C1E" }}>
      <button onClick={onOpen} className="flex items-center gap-2 text-left">
        <Tag className="w-4 h-4" style={{ color: FP.success }} />
        <span className="flex-1" style={{ fontSize: 15, fontWeight: 700 }}>Ofertas activas</span>
        {soon > 0 && <span style={{ padding: "2px 8px", borderRadius: 999, background: tint(FP.warning, 0.15), color: FP.warning, fontSize: 11, fontWeight: 700 }}>{soon} por vencer</span>}
        <ChevronRight className="w-4 h-4" style={{ color: "rgba(235,235,245,0.3)" }} />
      </button>
      {live.slice(0, 4).map((o) => {
        const Icon = TYPE_ICON[offerType(o)];
        const product = o.product_id ? byId.get(o.product_id) : null;
        const dl = offerDaysLeft(o);
        return (
          <div key={o.id} className="flex items-center gap-3" style={{ padding: "4px 0" }}>
            <Icon className="w-4 h-4" style={{ color: FP.success }} />
            <span className="flex-1 min-w-0">
              <span className="block truncate" style={{ fontSize: 14, fontWeight: 600 }}>{titleFor(o, product)}</span>
              <PriceLine o={o} product={product} />
            </span>
            {dl !== null && <span style={{ fontSize: 12, fontWeight: 600, color: dl <= 2 ? FP.warning : "#8E8E93" }}>{dl === 0 ? "Hoy" : `${dl}d`}</span>}
          </div>
        );
      })}
      {live.length > 4 && <button onClick={onOpen} style={{ fontSize: 13, fontWeight: 600, color: FP.brand, textAlign: "left" }}>Ver todas ({live.length})</button>}
      <button onClick={onOpen} className="apple-press flex items-center justify-center gap-2" style={{ padding: "10px 0", borderRadius: 12, background: tint(FP.brand, 0.12), color: FP.brand, fontSize: 14, fontWeight: 600 }}>
        <PlusCircle className="w-4 h-4" /> Crear oferta
      </button>
    </div>
  );
}

const uniqSorted = (list) => [...new Set(list.map((x) => String(x || "").trim()).filter(Boolean))].sort((a, b) => a.localeCompare(b, "es"));
const eqName = (a, b) => String(a || "").trim().toLowerCase() === String(b || "").trim().toLowerCase();

export function OfferEditor({ open, offer, products, onClose, onSaved, tenantId }) {
  const [scope, setScope] = useState("device");
  const [category, setCategory] = useState("");
  const [productId, setProductId] = useState("");
  const [brand, setBrand] = useState("");
  const [family, setFamily] = useState("");
  const [model, setModel] = useState("");
  const [partFilter, setPartFilter] = useState("");
  const [cat, setCat] = useState(null);
  const [type, setType] = useState("amount");
  const [value, setValue] = useState("");
  const [label, setLabel] = useState("");
  const [hasEnd, setHasEnd] = useState(true);
  const [end, setEnd] = useState(defaultOfferEnd());
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);
  const categories = useMemo(() => uniqSorted(products.map((p) => p.category)), [products]);
  const isEdit = !!offer;
  useEffect(() => {
    if (!open) return;
    setError(null);
    if (offer) {
      setScope(offerIsDevice(offer) ? "device" : offer.product_id ? "product" : "category");
      setCategory(offer.category || "");
      setProductId(offer.product_id || "");
      setBrand(offer.device_brand || "");
      setFamily(offer.device_family || "");
      setModel(offer.device_model_tag || "");
      setPartFilter(offer.part_filter || "");
      setType(offerType(offer));
      setValue(offer.value !== null && offer.value !== undefined ? String(offer.value) : "");
      setLabel(offer.label || "");
      setHasEnd(!!offer.ends_at);
      if (offer.ends_at) { const d = new Date(offer.ends_at); setEnd(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`); } else setEnd(defaultOfferEnd());
    } else {
      setScope("device"); setCategory(""); setProductId(""); setBrand(""); setFamily(""); setModel(""); setPartFilter(""); setType("amount"); setValue(""); setLabel(""); setHasEnd(true); setEnd(defaultOfferEnd());
    }
  }, [open, offer]);
  useEffect(() => {
    if (open && scope === "device" && !cat && tenantId) loadCatalog(tenantId).then(setCat).catch(() => {});
  }, [open, scope, cat, tenantId]);
  const brandNames = useMemo(() => uniqSorted((cat?.brands || []).map((b) => b.name)), [cat]);
  const brandIds = useMemo(() => new Set((cat?.brands || []).filter((b) => eqName(b.name, brand)).map((b) => b.id)), [cat, brand]);
  const familyNames = useMemo(() => (brand ? uniqSorted((cat?.families || []).filter((f) => brandIds.has(f.brand_id)).map((f) => f.name)) : []), [cat, brand, brandIds]);
  const modelNames = useMemo(() => {
    if (!family) return [];
    const famIds = new Set((cat?.families || []).filter((f) => brandIds.has(f.brand_id) && eqName(f.name, family)).map((f) => f.id));
    return uniqSorted((cat?.models || []).filter((m) => famIds.has(m.family_id)).map((m) => m.name));
  }, [cat, family, brandIds]);
  const allowedTypes = scope === "device" ? [["percent", "% descuento"], ["amount", "$ menos"], ["fixed", "Precio fijo"]] : [["fixed", "Precio fijo"], ["percent", "% descuento"], ["combo", "Combo / regalo"]];
  const changeScope = (k) => {
    setScope(k);
    if (!(k === "device" ? ["percent", "amount", "fixed"] : ["fixed", "percent", "combo"]).includes(type)) setType(k === "device" ? "amount" : "percent");
  };
  const preview = useMemo(() => {
    if (scope !== "device" || !brand) return null;
    const v = parseMoney(value) || 0;
    if (!(v > 0)) return null;
    const probe = { offer_type: type, value: v, active: true, device_brand: brand, device_family: family, device_model_tag: model, part_filter: partFilter };
    const p = products.find((x) => {
      const fam = family || (x.device_family && familyNames.some((n) => eqName(n, x.device_family)) ? x.device_family : "");
      const ctx = partMatchContext({ category: x.device_category, brand, family: fam, model: model || x.device_model_tag });
      return offerMatchesProduct(probe, x, ctx);
    });
    if (!p) return null;
    const base = effectivePrice(p);
    return `Vista previa: ${p.name} ${money(base)} pasa a ${money(offerPromoPrice(probe, base))}`;
  }, [scope, brand, family, model, partFilter, type, value, products, familyNames]);
  const save = async () => {
    if (saving) return;
    if (scope === "device" && !brand) { setError("Elige un equipo"); return; }
    if (!isEdit && scope === "category" && !category) { setError("Elige una categoría"); return; }
    if (!isEdit && scope === "product" && !productId) { setError("Elige un producto"); return; }
    const v = parseMoney(value) || 0;
    if (type !== "combo" && !(v > 0)) { setError("Escribe un valor válido"); return; }
    if (type === "percent" && v > 100) { setError("El porcentaje no puede pasar de 100"); return; }
    setSaving(true);
    setError(null);
    try {
      const orig = offer?.ends_at ? new Date(offer.ends_at) : null;
      const endsAt = !hasEnd ? null : orig ? offerEndsAtFor(end, orig) : offerEndsAtFor(end);
      const device = { brand, family, model, partFilter };
      if (offer) await updateOffer(offer.id, { type, value: v, label, endsAt, device: offerIsDevice(offer) ? device : undefined });
      else await insertOffer({ tenantId, scope, productId, category, type, value: v, label, endsAt, device });
      onSaved();
      onClose();
    } catch (e) {
      setError(e?.message || String(e));
    }
    setSaving(false);
  };
  const box = { borderRadius: 12, background: "#2C2C2E", overflow: "hidden" };
  const rowCls = "flex items-center justify-between gap-3";
  const rowStyle = { padding: "11px 14px" };
  const divider = { borderTop: "0.5px solid rgba(84,84,88,0.6)" };
  const select = (v, set, opts, emptyLabel = "Elige…") => (
    <select value={v} onChange={(e) => set(e.target.value)} className="bg-transparent outline-none text-right" style={{ color: FP.brand, fontSize: 15, maxWidth: "60%", colorScheme: "dark" }}>
      <option value="">{emptyLabel}</option>
      {opts.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
    </select>
  );
  const segmented = (items, current, onPick, disabled) => (
    <div className="grid" style={{ gridTemplateColumns: `repeat(${items.length}, 1fr)`, padding: 2, gap: 2, borderRadius: 9, background: "rgba(118,118,128,0.24)", opacity: disabled ? 0.5 : 1 }}>
      {items.map(([k, l]) => <button key={String(k)} disabled={disabled} onClick={() => onPick(k)} style={{ padding: "6px 0", borderRadius: 7, fontSize: 13, fontWeight: 600, background: current === k ? "#636366" : "transparent" }}>{l}</button>)}
    </div>
  );
  return (
    <Dialog open={open} onClose={onClose} title={offer ? "Editar oferta" : "Nueva oferta"} width={480} leading={<TextAction onClick={onClose}>Cancelar</TextAction>} trailing={null}>
      <div className="flex flex-col" style={{ gap: 14, paddingTop: 8 }}>
        <div>
          <p style={{ fontSize: 13, color: "#8E8E93", padding: "0 4px 6px" }}>Aplica a</p>
          <div style={box}>
            <div style={rowStyle}>{segmented([["device", "Equipo"], ["category", "Categoría"], ["product", "Producto"]], scope, changeScope, isEdit)}</div>
            {scope === "device" && (
              <>
                <div className={rowCls} style={{ ...rowStyle, ...divider }}>
                  <span style={{ fontSize: 15 }}>Marca</span>
                  {select(brand, (v) => { setBrand(v); setFamily(""); setModel(""); }, brandNames.map((b) => [b, b]))}
                </div>
                {brand && (
                  <div className={rowCls} style={{ ...rowStyle, ...divider }}>
                    <span style={{ fontSize: 15 }}>Familia</span>
                    {select(family, (v) => { setFamily(v); setModel(""); }, familyNames.map((f) => [f, f]), "Todas")}
                  </div>
                )}
                {family && (
                  <div className={rowCls} style={{ ...rowStyle, ...divider }}>
                    <span style={{ fontSize: 15 }}>Modelo</span>
                    {select(model, setModel, modelNames.map((m) => [m, m]), "Todos")}
                  </div>
                )}
                <input value={partFilter} onChange={(e) => setPartFilter(e.target.value)} placeholder="Solo piezas que incluyan (ej. pantalla)" className="w-full bg-transparent outline-none" style={{ ...rowStyle, ...divider, color: "#fff", fontSize: 15 }} />
              </>
            )}
            {scope === "category" && (
              <div className={rowCls} style={{ ...rowStyle, ...divider }}>
                <span style={{ fontSize: 15 }}>Categoría</span>
                {select(category, setCategory, categories.map((c) => [c, c]))}
              </div>
            )}
            {scope === "product" && (
              <div className={rowCls} style={{ ...rowStyle, ...divider }}>
                <span style={{ fontSize: 15 }}>Producto</span>
                {select(productId, setProductId, products.map((p) => [p.id, p.name]))}
              </div>
            )}
          </div>
        </div>
        <div>
          <p style={{ fontSize: 13, color: "#8E8E93", padding: "0 4px 6px" }}>Tipo de oferta</p>
          <div style={box}>
            <div className={rowCls} style={rowStyle}>
              <span style={{ fontSize: 15 }}>Tipo</span>
              <select value={type} onChange={(e) => setType(e.target.value)} className="bg-transparent outline-none text-right" style={{ color: FP.brand, fontSize: 15, colorScheme: "dark" }}>
                {allowedTypes.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
              </select>
            </div>
            {type !== "combo" ? (
              <label className={rowCls} style={{ ...rowStyle, ...divider }}>
                <span style={{ fontSize: 15 }}>{type === "fixed" ? "Precio fijo" : type === "amount" ? "Monto menos" : "% descuento"}</span>
                <span className="flex items-center gap-1">
                  {type !== "percent" && <span style={{ color: "#8E8E93" }}>$</span>}
                  <input value={value} onChange={(e) => setValue(e.target.value)} inputMode="decimal" placeholder={type === "percent" ? "0" : "0.00"} className="bg-transparent outline-none text-right" style={{ width: 100, color: "#fff", fontSize: 15 }} />
                  {type === "percent" && <span style={{ color: "#8E8E93" }}>%</span>}
                </span>
              </label>
            ) : <p style={{ ...rowStyle, ...divider, fontSize: 13, color: "#8E8E93" }}>El combo no cambia el precio — usa la etiqueta para describirlo (ej. {'"Gratis instalación"'}).</p>}
          </div>
          {preview && <p style={{ fontSize: 12, color: FP.success, padding: "6px 4px 0" }}>{preview}</p>}
        </div>
        <div>
          <p style={{ fontSize: 13, color: "#8E8E93", padding: "0 4px 6px" }}>Etiqueta</p>
          <div style={box}><input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Ej. Calidad Original" className="w-full bg-transparent outline-none" style={{ ...rowStyle, color: "#fff", fontSize: 15 }} /></div>
        </div>
        <div>
          <p style={{ fontSize: 13, color: "#8E8E93", padding: "0 4px 6px" }}>Vigencia</p>
          <div style={box}>
            <div style={rowStyle}>{segmented([[false, "Permanente"], [true, "Hasta fecha"]], hasEnd, setHasEnd, false)}</div>
            {hasEnd ? (
              <label className={rowCls} style={{ ...rowStyle, ...divider }}>
                <span style={{ fontSize: 15 }}>Vence</span>
                <input type="date" value={end} onChange={(e) => setEnd(e.target.value)} className="bg-transparent outline-none" style={{ color: "#fff", colorScheme: "dark", fontSize: 15 }} />
              </label>
            ) : <p style={{ ...rowStyle, ...divider, fontSize: 13, color: "#8E8E93" }}>No vence. Se apaga cuando tú quieras.</p>}
          </div>
        </div>
        {error && <p style={{ fontSize: 13, color: "#FF453A" }}>{error}</p>}
        <button onClick={save} disabled={saving} className="apple-press flex items-center justify-center gap-2" style={{ height: 50, borderRadius: 14, background: FP.brand, color: "#fff", fontSize: 16, fontWeight: 700 }}>
          {saving && <Loader2 className="w-4 h-4 animate-spin" />} {offer ? "Guardar cambios" : "Crear oferta"}
        </button>
      </div>
    </Dialog>
  );
}

export function OffersDialog({ open, onClose, tenantId, products, onChanged }) {
  const [rows, setRows] = useState(null);
  const [editor, setEditor] = useState(null);
  const [confirm, setConfirm] = useState(null);
  const [error, setError] = useState(null);
  const byId = useMemo(() => new Map(products.map((p) => [p.id, p])), [products]);
  const load = () => listOffers(tenantId).then(setRows, (e) => { setError(e?.message || String(e)); setRows([]); });
  useEffect(() => { if (open) { setRows(null); setError(null); load(); } }, [open, tenantId]);
  const changed = () => { load(); onChanged?.(); };
  const soon = (rows || []).filter(offerExpiringSoon);
  const active = (rows || []).filter((o) => offerLive(o) && !offerExpiringSoon(o));
  const dead = (rows || []).filter((o) => !offerLive(o));
  const row = (o) => {
    const Icon = TYPE_ICON[offerType(o)];
    const live = offerLive(o);
    const product = o.product_id ? byId.get(o.product_id) : null;
    const dl = offerDaysLeft(o);
    const right = o.active === false ? ["Apagada", "#8E8E93"] : !live ? ["Vencida", FP.danger] : dl === null ? ["Permanente", FP.success] : [dl === 0 ? "Hoy" : `${dl}d`, dl <= 2 ? FP.warning : "#8E8E93"];
    const device = offerIsDevice(o);
    const valueText = offerType(o) === "fixed" ? `Precio ${money(num(o.value))}` : offerType(o) === "percent" ? `${num(o.value)}% off` : offerType(o) === "amount" ? `-${money(num(o.value))}` : "Combo / regalo";
    const sub = device ? [`Equipo: ${offerDeviceLabel(o)}`, String(o.part_filter || "").trim(), valueText].filter(Boolean).join(" · ") : product && offerType(o) !== "combo" ? null : [product ? product.name : o.category ? `Categoría: ${o.category}` : null, valueText].filter(Boolean).join(" · ");
    return (
      <div key={o.id} className="group flex items-center gap-3" style={{ padding: "11px 14px", borderTop: "0.5px solid rgba(84,84,88,0.6)" }}>
        <Icon className="w-4 h-4 flex-shrink-0" style={{ color: live ? FP.success : "#8E8E93" }} />
        <button onClick={() => setEditor({ offer: o })} className="flex-1 min-w-0 text-left">
          <span className="block truncate" style={{ fontSize: 15, fontWeight: 600 }}>{offerLabel(o)}</span>
          {sub ? <span className="block truncate" style={{ fontSize: 12, color: "#8E8E93" }}>{sub}</span> : (
            <span className="flex items-center gap-1.5" style={{ fontSize: 12 }}>
              <span className="truncate" style={{ color: "#8E8E93" }}>{product.name}</span>
              <PriceLine o={o} product={product} />
            </span>
          )}
        </button>
        {right && <span style={{ fontSize: 12, fontWeight: 600, color: right[1] }}>{right[0]}</span>}
        <button onClick={async () => { try { await setOfferActive(o.id, o.active === false); changed(); } catch (e) { setError(e?.message || String(e)); } }} aria-label={o.active === false ? "Prender" : "Apagar"} title={o.active === false ? "Prender" : "Apagar"} style={{ color: o.active === false ? FP.success : "#8E8E93" }}><Power className="w-4 h-4" /></button>
        <button onClick={() => setConfirm(o)} aria-label="Borrar" title="Borrar" style={{ color: "#FF453A" }}><Trash2 className="w-4 h-4" /></button>
      </div>
    );
  };
  const section = (title, list, emptyText) => (
    <div>
      <p style={{ fontSize: 13, color: "#8E8E93", padding: "14px 4px 6px", textTransform: "uppercase" }}>{title}</p>
      <div style={{ borderRadius: 12, background: "#1C1C1E", overflow: "hidden" }}>
        {list.length === 0 ? <p style={{ padding: 14, fontSize: 14, color: "#8E8E93" }}>{emptyText}</p> : <div style={{ marginTop: -0.5 }}>{list.map(row)}</div>}
      </div>
    </div>
  );
  return (
    <>
      <Dialog open={open} onClose={onClose} title="Ofertas" width={560} height="90dvh" leading={<TextAction onClick={onClose}>Cerrar</TextAction>} trailing={<button onClick={() => setEditor({ offer: null })} aria-label="Nueva oferta" style={{ color: FP.brand }}><Plus className="w-6 h-6" /></button>}>
        {rows === null ? <p className="flex items-center justify-center gap-2" style={{ padding: 40, color: "#8E8E93" }}><Loader2 className="w-4 h-4 animate-spin" /></p> : (
          <>
            {error && <p style={{ fontSize: 13, color: "#FF453A", paddingTop: 8 }}>{error}</p>}
            {soon.length > 0 && section("Por vencer", soon, "")}
            {section("Ofertas activas", active, "No hay ofertas activas. Crea una con el botón +.")}
            {dead.length > 0 && section("Vencidas / apagadas", dead, "")}
          </>
        )}
      </Dialog>
      <OfferEditor open={!!editor} offer={editor?.offer || null} products={products} tenantId={tenantId} onClose={() => setEditor(null)} onSaved={changed} />
      <AlertDialog open={!!confirm} title={`¿Borrar la oferta ${confirm ? offerLabel(confirm) : ""}?`} message="Esta acción no se puede deshacer. Los productos vuelven a su precio normal." onClose={() => setConfirm(null)}
        actions={[{ label: "Borrar oferta", destructive: true, onPress: async () => { try { await deleteOffer(confirm.id); changed(); } catch (e) { setError(e?.message || String(e)); } } }, { label: "Cancelar", bold: true }]} />
    </>
  );
}
