import { useEffect, useMemo, useRef, useState } from "react";
import { Search, X, ScanBarcode, Smartphone, BatteryFull, Plug, Camera, Square, Cpu, Shield, Stethoscope, Package, MoreHorizontal, Copy, MessageCircle, Loader2 } from "lucide-react";
import { Dialog, TextAction, tint } from "@/components/pos/native/posUi";
import { FP } from "@/lib/finance/ledger";
import { money } from "@/components/finanzas/ui";
import { rankedSearch, effectivePrice, displayCategory, fold, parseMoney, tenantTaxPercent } from "@/lib/posLogic";
import { listActiveProducts, insertQuote, laborChipAmounts, recordLaborChip, r2q } from "@/lib/inicioApi";

const MINT = "#63E6BE";
const PURPLE = "#BF5AF2";
const PINK = "#FF6482";
const BROWN = "#AC8E68";
const TEAL = "#40C8E0";

export function partIcon(p) {
  const n = fold(p?.name);
  const has = (...w) => w.some((x) => n.includes(x));
  if (has("pantalla", "oled", "lcd", "display", "screen", "digitizer")) return [Smartphone, FP.info];
  if (has("bateria", "battery")) return [BatteryFull, FP.success];
  if (has("puerto", "carga", "charging", "port", "hdmi", "flex")) return [Plug, FP.warning];
  if (has("camara", "camera", "lente", "lens")) return [Camera, PURPLE];
  if (has("back glass", "tapa", "cristal", "glass", "cover")) return [Square, BROWN];
  if (has("board", "logic", "chip", "ic")) return [Cpu, PINK];
  if (has("protector", "tempered", "film")) return [Shield, TEAL];
  if (has("diagnos", "servicio", "instalacion", "sistema")) return [Stethoscope, MINT];
  return [Package, "#8E8E93"];
}

function stockChip(p) {
  if (p?.type === "service") return ["Servicio", MINT];
  const stock = p?.stock === null || p?.stock === undefined || p?.stock === "" ? null : Number(p.stock);
  if (stock === null || Number.isNaN(stock)) return null;
  if (stock <= 0) return ["Agotado", FP.danger];
  const min = Number(p?.min_stock);
  if (Number.isFinite(min) && stock <= min) return [`Quedan ${Math.trunc(stock)}`, FP.warning];
  return [`Stock: ${Math.trunc(stock)}`, FP.success];
}

function ResultRow({ p, onPick, onCopy, onWhatsApp }) {
  const [menu, setMenu] = useState(false);
  const [Icon, color] = partIcon(p);
  const price = effectivePrice(p);
  const chip = stockChip(p);
  const meta = [displayCategory(p), p.location].filter(Boolean).join(" · ");
  return (
    <div className="relative flex items-center gap-3" style={{ padding: "10px 12px" }} onContextMenu={(e) => { e.preventDefault(); setMenu(true); }}>
      <button onClick={() => onPick(p)} className="flex-1 min-w-0 flex items-center gap-3 text-left">
        <span style={{ width: 36, height: 36, borderRadius: 10, background: tint(color, 0.15), color, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}><Icon className="w-4 h-4" /></span>
        <span className="flex-1 min-w-0">
          <span className="block" style={{ fontSize: 15, fontWeight: 600, overflow: "hidden", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" }}>{p.name}</span>
          <span className="flex flex-wrap items-center" style={{ gap: 6, marginTop: 3 }}>
            {meta && <span style={{ fontSize: 11, color: "#8E8E93" }}>{meta}</span>}
            {chip && <span style={{ padding: "1px 7px", borderRadius: 999, background: tint(chip[1], 0.15), color: chip[1], fontSize: 11, fontWeight: 600 }}>{chip[0]}</span>}
          </span>
        </span>
        <span style={{ fontSize: 15, fontWeight: 700, color: FP.success, fontVariantNumeric: "tabular-nums" }}>{money(price)}</span>
      </button>
      <button onClick={() => setMenu((v) => !v)} aria-label="Más opciones" style={{ color: "#8E8E93", padding: 4 }}><MoreHorizontal className="w-4 h-4" /></button>
      {menu && (
        <>
          <div className="fixed inset-0" style={{ zIndex: 60 }} onClick={() => setMenu(false)} />
          <div className="absolute right-2" style={{ top: 40, zIndex: 61, width: 210, borderRadius: 12, background: "#3A3A3C", boxShadow: "0 12px 32px rgba(0,0,0,0.5)", overflow: "hidden" }}>
            <button onClick={() => { setMenu(false); onCopy(p); }} className="w-full flex items-center gap-2 text-left" style={{ padding: "10px 12px", fontSize: 14 }}><Copy className="w-4 h-4" /> Copiar precio</button>
            <button onClick={() => { setMenu(false); onWhatsApp(p); }} className="w-full flex items-center gap-2 text-left" style={{ padding: "10px 12px", fontSize: 14, borderTop: "0.5px solid rgba(84,84,88,0.6)" }}><MessageCircle className="w-4 h-4" /> Enviar por WhatsApp</button>
          </div>
        </>
      )}
    </div>
  );
}

export function PartSearchBar({ tenantId, tenant, onQuote }) {
  const [query, setQuery] = useState("");
  const [debounced, setDebounced] = useState("");
  const [focused, setFocused] = useState(false);
  const [products, setProducts] = useState(null);
  const [toast, setToast] = useState(null);
  const inputRef = useRef(null);

  useEffect(() => {
    const t = setTimeout(() => setDebounced(query), 220);
    return () => clearTimeout(t);
  }, [query]);

  const reload = () => { listActiveProducts(tenantId).then(setProducts, () => setProducts((p) => p || [])); };
  const outcome = useMemo(() => {
    const q = debounced.trim();
    if (!q || !products) return { results: [], partial: false };
    const r = rankedSearch(products, q);
    return { results: r.results.slice(0, 20), partial: r.partial };
  }, [debounced, products]);

  const shop = String(tenant?.name || "").trim() || "Archilla OS";
  const flash = (msg) => { setToast(msg); setTimeout(() => setToast(null), 2000); };
  const copy = async (p) => {
    try { await navigator.clipboard.writeText(`${p.name}: ${money(effectivePrice(p))}`); flash("Precio copiado"); } catch { flash("No se pudo copiar"); }
  };
  const whatsapp = (p) => window.open(`https://wa.me/?text=${encodeURIComponent(`${p.name}: ${money(effectivePrice(p))}\n${shop}`)}`, "_blank", "noopener");
  const onEnter = () => {
    const code = fold(query.trim());
    if (!code || !products) return;
    const hit = products.find((p) => fold(p.sku) === code || fold(p.barcode) === code);
    if (hit) setQuery(hit.name);
  };
  const cancel = () => { setQuery(""); setFocused(false); inputRef.current?.blur(); };
  const showCard = query.trim().length > 0;

  return (
    <div className="flex flex-col" style={{ gap: 8 }}>
      <div className="flex items-center gap-3">
        <label className="flex-1 flex items-center gap-2" style={{ height: 48, padding: "0 14px", borderRadius: 12, background: "#1C1C1E", border: `1px solid ${focused ? tint(FP.brand, 0.65) : "transparent"}` }}>
          <Search className="w-4 h-4 flex-shrink-0" style={{ color: focused ? FP.brand : "#8E8E93" }} />
          <input ref={inputRef} value={query} onChange={(e) => setQuery(e.target.value)} onFocus={() => { setFocused(true); reload(); }} onBlur={() => setFocused(false)}
            onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); onEnter(); } else if (e.key === "Escape") cancel(); }}
            placeholder="Buscar pieza, precio o servicio…" aria-label="Buscar pieza, precio o servicio" className="flex-1 bg-transparent outline-none" style={{ color: "#fff", fontSize: 16, minWidth: 0 }} />
          {query ? <button onMouseDown={(e) => e.preventDefault()} onClick={() => setQuery("")} aria-label="Limpiar" style={{ color: "#8E8E93" }}><X className="w-4 h-4" /></button> : <ScanBarcode className="w-5 h-5" style={{ color: "#8E8E93" }} aria-hidden="true" />}
        </label>
        {(focused || query) && <button onMouseDown={(e) => e.preventDefault()} onClick={cancel} style={{ fontSize: 16, color: FP.brand }}>Cancelar</button>}
      </div>
      {showCard && (
        <div style={{ borderRadius: 14, background: "#1C1C1E" }}>
          {products === null ? (
            <p className="flex items-center gap-2" style={{ padding: 14, fontSize: 14, color: "#8E8E93" }}><Loader2 className="w-4 h-4 animate-spin" /> Cargando catálogo…</p>
          ) : outcome.results.length === 0 ? (
            <div className="flex flex-wrap items-center gap-2" style={{ padding: 14, fontSize: 14, color: "#8E8E93" }}>
              <Search className="w-4 h-4" /> Nada en el catálogo para “{query.trim()}”.
              <button onClick={() => onQuote({ partLabel: query.trim() })} style={{ color: FP.brand, fontWeight: 600 }}>Cotizar igual</button>
            </div>
          ) : (
            <>
              {outcome.partial && <p style={{ padding: "8px 12px", fontSize: 12, fontWeight: 600, color: FP.brand, background: tint(FP.brand, 0.1) }}>Nada exacto — esto es lo más parecido.</p>}
              {outcome.results.map((p, i) => (
                <div key={p.id} style={{ borderTop: i ? "0.5px solid rgba(84,84,88,0.5)" : "none" }}>
                  <ResultRow p={p} onPick={(x) => onQuote({ partLabel: x.name, partPrice: effectivePrice(x), productId: x.id, partCost: Number(x.cost) || 0 })} onCopy={copy} onWhatsApp={whatsapp} />
                </div>
              ))}
            </>
          )}
        </div>
      )}
      {toast && <div className="fixed left-1/2" style={{ bottom: 100, transform: "translateX(-50%)", zIndex: 260, padding: "10px 16px", borderRadius: 999, background: "#2C2C2E", color: "#fff", fontSize: 14, fontWeight: 600 }}>{toast}</div>}
    </div>
  );
}

export function QuickQuoteDialog({ open, seed, onClose, tenantId, tenant, employeeName, onSaved }) {
  const [device, setDevice] = useState("");
  const [part, setPart] = useState("");
  const [partPrice, setPartPrice] = useState("");
  const [labor, setLabor] = useState("");
  const [withTax, setWithTax] = useState(true);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const laborRef = useRef(null);
  const chips = useMemo(() => (open ? laborChipAmounts(tenantId) : []), [open, tenantId]);
  const ratePct = tenantTaxPercent(tenant);

  useEffect(() => {
    if (!open) return;
    setDevice("");
    setPart(seed?.partLabel || "");
    setPartPrice(seed?.partPrice ? Number(seed.partPrice).toFixed(2) : "");
    setLabor("");
    setWithTax(true);
    setName("");
    setPhone("");
    setError(null);
    setTimeout(() => laborRef.current?.focus(), 50);
  }, [open, seed]);

  const pp = Math.max(0, parseMoney(partPrice) || 0);
  const lb = Math.max(0, parseMoney(labor) || 0);
  const subtotal = pp + lb;
  const tax = withTax ? r2q(subtotal * (Math.max(0, ratePct) / 100)) : 0;
  const total = r2q(subtotal + tax);
  const cost = Number(seed?.partCost) || 0;

  const save = async () => {
    if (!(total > 0) || saving) return;
    setSaving(true);
    setError(null);
    try {
      const q = await insertQuote({ tenantId, partPrice: pp, labor: lb, taxRatePercent: withTax ? ratePct : 0, customerName: name, customerPhone: phone, deviceLabel: device, partLabel: part, productId: seed?.productId, partCost: cost, createdByName: employeeName });
      recordLaborChip(tenantId, lb);
      onSaved?.(q);
      onClose();
    } catch (e) {
      setError(`No se pudo guardar: ${e?.message || e}`);
    }
    setSaving(false);
  };

  const section = (label, children) => (
    <div>
      <p style={{ fontSize: 12, fontWeight: 600, color: "#8E8E93", padding: "14px 4px 6px", letterSpacing: "0.04em" }}>{label}</p>
      <div style={{ borderRadius: 12, background: "#2C2C2E", overflow: "hidden" }}>{children}</div>
    </div>
  );
  const textRow = (label, value, set, placeholder, extra = {}) => (
    <label className="flex items-center gap-3" style={{ padding: "11px 14px", borderTop: extra.first ? "none" : "0.5px solid rgba(84,84,88,0.6)" }}>
      <span style={{ fontSize: 15, width: 130, flexShrink: 0 }}>{label}</span>
      <input value={value} onChange={(e) => set(e.target.value)} placeholder={placeholder} inputMode={extra.inputMode} className="flex-1 bg-transparent outline-none text-right" style={{ color: "#fff", fontSize: 15, minWidth: 0 }} />
    </label>
  );
  const moneyRow = (label, value, set, ref, first) => (
    <label className="flex items-center gap-2" style={{ padding: "11px 14px", borderTop: first ? "none" : "0.5px solid rgba(84,84,88,0.6)" }}>
      <span className="flex-1" style={{ fontSize: 15 }}>{label}</span>
      <span style={{ fontSize: 20, fontWeight: 700, color: "#8E8E93" }}>$</span>
      <input ref={ref} value={value} onChange={(e) => set(e.target.value)} placeholder="0.00" inputMode="decimal" className="bg-transparent outline-none text-right" style={{ width: 130, color: "#fff", fontSize: 20, fontWeight: 700 }} />
    </label>
  );
  const pill = (label, active, onClick) => (
    <button key={label} onClick={onClick} className="apple-press whitespace-nowrap" style={{ padding: "6px 12px", borderRadius: 999, background: active ? FP.brand : "#3A3A3C", color: "#fff", fontSize: 13, fontWeight: 600 }}>{label}</button>
  );

  return (
    <Dialog open={open} onClose={onClose} title="Cotización rápida" width={520}
      leading={<TextAction onClick={onClose}>Cerrar</TextAction>}
      trailing={<TextAction bold disabled={!(total > 0) || saving} onClick={save}>{saving ? <Loader2 className="w-4 h-4 animate-spin" /> : "Guardar"}</TextAction>}>
      {section("EQUIPO Y PIEZA", <>{textRow("Equipo", device, setDevice, "iPhone 14 Pro Max", { first: true })}{textRow("Pieza", part, setPart, "Pantalla OLED")}</>)}
      {section("NÚMEROS", <>{moneyRow("Precio de la pieza", partPrice, setPartPrice, null, true)}{moneyRow("Mano de obra", labor, setLabor, laborRef)}</>)}
      <div className="flex flex-wrap" style={{ gap: 6, paddingTop: 10 }}>
        {chips.map((c) => pill(money(c), Math.abs(lb - c) < 0.005, () => setLabor(c.toFixed(2))))}
      </div>
      <div className="flex flex-wrap" style={{ gap: 6, paddingTop: 8 }}>
        {pill(`IVU ${ratePct.toFixed(1)}%`, withTax, () => setWithTax(true))}
        {pill("Sin IVU", !withTax, () => setWithTax(false))}
      </div>
      <div className="flex flex-col" style={{ gap: 6, marginTop: 14, padding: 16, borderRadius: 16, background: tint(FP.success, 0.1), border: `1px solid ${tint(FP.success, 0.3)}` }}>
        {[["Pieza", pp], ["Mano de obra", lb], ...(withTax ? [["IVU", tax]] : [])].map(([l, v]) => (
          <div key={l} className="flex justify-between" style={{ fontSize: 14 }}><span style={{ color: "#8E8E93" }}>{l}</span><span style={{ fontVariantNumeric: "tabular-nums" }}>{money(v)}</span></div>
        ))}
        <div style={{ height: 0.5, background: "rgba(84,84,88,0.6)", margin: "4px 0" }} />
        <div className="flex items-baseline justify-between"><span style={{ fontSize: 15, fontWeight: 600 }}>Precio al cliente</span><span style={{ fontSize: 32, fontWeight: 800, color: FP.success, fontVariantNumeric: "tabular-nums" }}>{money(total)}</span></div>
        {cost > 0 && <p style={{ fontSize: 12, color: "#8E8E93" }}>Tu costo: {money(cost)} · Ganancia estimada {money(pp - cost + lb)}</p>}
      </div>
      {section("CLIENTE (OPCIONAL)", <>{textRow("Nombre", name, setName, "Nombre del cliente", { first: true })}{textRow("Teléfono", phone, setPhone, "787-000-0000", { inputMode: "tel" })}</>)}
      {error && <p style={{ marginTop: 10, fontSize: 13, color: "#FF453A" }}>{error}</p>}
    </Dialog>
  );
}
