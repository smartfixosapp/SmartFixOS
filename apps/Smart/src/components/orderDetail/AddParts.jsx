import { useEffect, useMemo, useRef, useState } from "react";
import { X, Search, ScanBarcode, Package, Wrench, Loader2, Minus, Plus, Camera } from "lucide-react";
import { AlertDialog } from "@/components/pos/native/posUi";
import { Overlay, Banner } from "@/components/wizard/ui";
import { C, tint, money } from "@/components/orderDetail/ui";
import { fetchProducts, num, r2, uuid } from "@/lib/comprasApi";
import { rankParts, rankServices, filterProducts, isAccessory, stockOf, deviceContext, createInventoryProduct, uploadProductPhoto, addItems, lineTotalOf } from "@/lib/partsApi";

const CATEGORIES = [["", "Sin categoría"], ["screen", "Pantalla"], ["battery", "Batería"], ["charger", "Cargador"], ["cable", "Cable"], ["case", "Funda"], ["diagnostic", "Diagnóstico"], ["other", "Otro"]];

function useWide() {
  const q = "(min-width: 800px)";
  const [v, setV] = useState(() => typeof window !== "undefined" && window.matchMedia(q).matches);
  useEffect(() => { const m = window.matchMedia(q); const on = () => setV(m.matches); m.addEventListener("change", on); return () => m.removeEventListener("change", on); }, []);
  return v;
}

function Card({ title, sub, children }) {
  return (
    <div style={{ padding: 14, borderRadius: 16, background: C.card }}>
      <p style={{ fontSize: 14, fontWeight: 700 }}>{title}</p>
      {sub && <p style={{ fontSize: 12, color: C.sub, marginTop: 2 }}>{sub}</p>}
      <div style={{ marginTop: 10 }}>{children}</div>
    </div>
  );
}

function Seg({ value, options, onChange }) {
  return <div className="grid" style={{ gridTemplateColumns: `repeat(${options.length}, 1fr)`, padding: 2, gap: 2, borderRadius: 9, background: "rgba(118,118,128,0.24)" }}>{options.map(([k, l]) => <button key={k} onClick={() => onChange(k)} style={{ padding: "8px 0", borderRadius: 7, fontSize: 14, fontWeight: 600, background: value === k ? "#636366" : "transparent" }}>{l}</button>)}</div>;
}

function NumInput({ value, onChange, prefix = "$", ariaLabel, big }) {
  return (
    <div className="flex items-center gap-2" style={{ background: C.card2, borderRadius: 12, padding: "0 14px", height: big ? 52 : 44 }}>
      {prefix && <span style={{ color: C.sub }}>{prefix}</span>}
      <input value={value} onChange={(e) => { const r = e.target.value.replace(",", "."); if (/^\d*\.?\d{0,2}$/.test(r)) onChange(r); }} inputMode="decimal" placeholder="0.00" aria-label={ariaLabel} className="bg-transparent outline-none flex-1" style={{ color: "#fff", fontSize: big ? 22 : 17, fontWeight: 700, minWidth: 0 }} />
    </div>
  );
}

function Stepper({ value, onChange, min = 1, max = 999, size = 44 }) {
  return (
    <div className="flex items-center gap-3">
      <button onClick={() => onChange(Math.max(min, value - 1))} aria-label="Menos" style={{ width: size, height: size, borderRadius: 999, background: C.card2 }}><Minus className="w-4 h-4 mx-auto" /></button>
      <b style={{ fontSize: size > 36 ? 26 : 16, minWidth: 34, textAlign: "center" }}>{value}</b>
      <button onClick={() => onChange(Math.min(max, value + 1))} aria-label="Más" style={{ width: size, height: size, borderRadius: 999, background: C.brand }}><Plus className="w-4 h-4 mx-auto" /></button>
    </div>
  );
}

export default function AddPartsPage({ order, tenantId, employeeName, lines, onClose }) {
  const wide = useWide();
  const [products, setProducts] = useState(null);
  const [tab, setTab] = useState("piezas");
  const [query, setQuery] = useState("");
  const [pending, setPending] = useState([]);
  const [notice, setNotice] = useState(null);
  const [confirm, setConfirm] = useState(null);
  const [discard, setDiscard] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [m, setM] = useState({ service: false, name: "", qty: 1, price: "", cost: "", mode: "once", category: "", stock: 0, sku: "", location: "", photo: null });
  const fileRef = useRef(null);
  const ctx = deviceContext(order);
  const deviceLabel = [order.device_brand, order.device_family, order.device_model].filter(Boolean).join(" ") || String(order.device_type || "").trim();

  useEffect(() => { fetchProducts(tenantId).then(setProducts, () => setProducts([])); }, [tenantId]);
  useEffect(() => { if (!notice) return undefined; const t = setTimeout(() => setNotice(null), 3500); return () => clearTimeout(t); }, [notice]);

  const parts = useMemo(() => (products ? rankParts(products, order) : { matched: [], rest: [] }), [products, order]);
  const services = useMemo(() => (products ? rankServices(products, order) : { matched: [], rest: [] }), [products, order]);
  const accessories = useMemo(() => (products || []).filter(isAccessory), [products]);
  const pendingQty = (id) => pending.filter((p) => p.kind === "catalog" && p.product.id === id).reduce((s, p) => s + p.quantity, 0);

  const addProduct = (p, force = false) => {
    const service = p.type === "service";
    const st = stockOf(p);
    const have = pendingQty(p.id);
    if (!service && st !== null && st <= 0 && !force) { setConfirm({ title: "¿Añadir pieza sin stock?", message: `No tienes "${p.name}" en stock ahora mismo. ¿Confirmas que quieres añadirla a la orden de todos modos?`, onYes: () => addProduct(p, true) }); return; }
    if (!service && st !== null && st > 0 && have + 1 > st) { setNotice(`Solo quedan ${st} en stock`); return; }
    setPending((prev) => {
      const i = prev.findIndex((x) => x.kind === "catalog" && x.product.id === p.id);
      if (i >= 0) return prev.map((x, j) => (j === i ? { ...x, quantity: service ? 1 : x.quantity + 1 } : x));
      return [...prev, { key: uuid(), kind: "catalog", product: p, name: p.name, quantity: 1, price: String(num(p.price)), cost: 0 }];
    });
  };

  const trySearchEnter = () => {
    const q = query.trim().toLowerCase();
    if (!q || !products) return;
    const hit = products.find((p) => String(p.barcode || "").toLowerCase() === q || String(p.sku || "").toLowerCase() === q);
    if (!hit) return;
    const inParts = [...parts.matched, ...parts.rest].some((p) => p.id === hit.id) || [...services.matched, ...services.rest].some((p) => p.id === hit.id);
    const isAcc = isAccessory(hit);
    if (!inParts && !isAcc) { setNotice("Ese producto no es para este equipo"); return; }
    setTab(isAcc ? "accesorios" : "piezas");
    setQuery(hit.sku || hit.barcode || "");
    addProduct(hit);
  };

  const addManual = async (save) => {
    const price = num(m.price);
    const qty = m.service ? 1 : m.qty;
    if (!m.name.trim() || price <= 0 || qty <= 0) return;
    const doAdd = async () => {
      setBusy(true); setError(null);
      try {
        if (save) {
          let url = null;
          if (m.photo) url = await uploadProductPhoto(tenantId, m.photo).catch(() => null);
          const prod = await createInventoryProduct({ tenantId, order, name: m.name.trim(), service: m.service, price, cost: num(m.cost), stock: m.stock, sku: m.sku, location: m.location, category: m.category, photoUrl: url });
          setProducts((p) => [...(p || []), prod]);
          setPending((prev) => [...prev, { key: uuid(), kind: "catalog", product: prod, name: prod.name, quantity: qty, price: String(price), cost: 0 }]);
        } else {
          setPending((prev) => [...prev, { key: uuid(), kind: m.service ? "manual-service" : "manual-part", name: m.name.trim(), quantity: qty, price: String(price), cost: num(m.cost) }]);
        }
        setM((x) => ({ ...x, name: "", price: "", cost: "", qty: 1, sku: "", location: "", photo: null, stock: 0 }));
        setNotice("Sumada a la lista");
      } catch (e) { setError(e?.message || String(e)); } finally { setBusy(false); }
    };
    if (!m.service && num(m.cost) === 0) { setConfirm({ title: "¿Añadir sin costo?", message: "El costo quedó en $0 — esta pieza se verá con 100% de margen en Finanzas aunque haya costado dinero real.", yes: "Añadir de todos modos", no: "Volver a editar", onYes: doAdd }); return; }
    doAdd();
  };

  const pendTotal = r2(pending.reduce((s, p) => s + num(p.price) * p.quantity, 0));
  const units = pending.reduce((s, p) => s + p.quantity, 0);
  const cartTotal = r2(lines.reduce((s, l) => s + lineTotalOf(l), 0));

  const commit = () => {
    if (!pending.length || busy) return;
    const run = async () => {
      setBusy(true); setError(null);
      try {
        await addItems({ order, tenantId, pending: pending.map((p) => ({ ...p, price: num(p.price) })), by: employeeName });
        onClose(true);
      } catch (e) { setError(e?.message || String(e)); setBusy(false); }
    };
    if (pending.some((p) => num(p.price) <= 0)) { setConfirm({ title: "¿Añadir sin precio?", message: "Hay piezas con precio en $0. Se agregarán al carrito sin costo para el cliente.", yes: "Añadir de todos modos", no: "Volver a editar", onYes: run }); return; }
    run();
  };

  const requestClose = () => { if (busy) return; if (pending.length) setDiscard(true); else onClose(false); };

  const card = (p) => {
    const service = p.type === "service";
    const st = stockOf(p);
    const pend = pendingQty(p.id);
    const img = p.photo_urls?.[0] || p.image_url;
    const label = service ? ["Servicio", "#5E5CE6"] : st === null ? null : st <= 0 ? ["Agotado", C.red] : [`${st} en stock`, st < 5 ? C.amber : C.green];
    return (
      <button key={p.id} onClick={() => addProduct(p)} className="apple-press relative flex flex-col text-left" style={{ padding: 10, borderRadius: 16, background: C.card, border: `2px solid ${pend ? C.brand : "transparent"}`, gap: 6 }}>
        {pend > 0 && <span className="absolute" style={{ top: 6, right: 6, minWidth: 24, height: 24, borderRadius: 999, background: C.brand, color: "#fff", fontSize: 12, fontWeight: 800, display: "flex", alignItems: "center", justifyContent: "center", padding: "0 6px" }}>{pend}</span>}
        <span style={{ height: 92, borderRadius: 12, background: C.card2, display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden" }}>{img ? <img src={img} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : service ? <Wrench className="w-7 h-7" style={{ color: C.sub }} /> : <Package className="w-7 h-7" style={{ color: C.sub }} />}</span>
        <span style={{ fontSize: 13, fontWeight: 600, overflow: "hidden", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", minHeight: 34 }}>{p.name}</span>
        <b style={{ fontSize: 16 }}>{money(num(p.price))}</b>
        {label && <span style={{ fontSize: 11, color: label[1], fontWeight: 700 }}>{label[0]}</span>}
      </button>
    );
  };

  const grid = (items) => <div className="grid" style={{ gap: 10, gridTemplateColumns: "repeat(auto-fill, minmax(172px, 1fr))" }}>{items.map(card)}</div>;
  const section = (title, items, color) => items.length ? (
    <div className="flex flex-col" style={{ gap: 8 }}>
      <p className="flex items-center gap-2" style={{ fontSize: 12, fontWeight: 800, letterSpacing: "0.06em", color }}>{title}<span style={{ padding: "1px 8px", borderRadius: 999, background: tint(color, 0.16), fontSize: 11 }}>{items.length}</span></p>
      {grid(items)}
    </div>
  ) : null;

  const dev = deviceLabel.toUpperCase();
  const q = query.trim();
  let content;
  if (products === null) content = <div className="flex items-center justify-center gap-2" style={{ padding: 50, color: C.sub }}><Loader2 className="w-5 h-5 animate-spin" /> Cargando productos…</div>;
  else if (tab === "manual") {
    const cost0 = !m.service && num(m.cost) === 0;
    const ok = m.name.trim() && num(m.price) > 0 && (m.service || m.qty > 0);
    content = (
      <div className="flex flex-col mx-auto w-full" style={{ gap: 12, maxWidth: 580 }}>
        <Card title="Tipo" sub="Una pieza no cuenta inventario; un servicio es mano de obra"><Seg value={m.service ? "s" : "p"} onChange={(k) => setM({ ...m, service: k === "s" })} options={[["p", "Pieza"], ["s", "Servicio"]]} /></Card>
        <Card title="Nombre"><input value={m.name} onChange={(e) => setM({ ...m, name: e.target.value })} placeholder="Ej. Flex de pantalla genérico" aria-label="Nombre" className="w-full outline-none" style={{ background: C.card2, color: "#fff", borderRadius: 12, padding: "12px 14px", fontSize: 16 }} /></Card>
        {!m.service && <Card title="Cantidad"><Stepper value={m.qty} onChange={(v) => setM({ ...m, qty: v })} /></Card>}
        <Card title="Precio por unidad"><NumInput value={m.price} onChange={(v) => setM({ ...m, price: v })} ariaLabel="Precio" big /></Card>
        {!m.service && <Card title="Costo" sub={cost0 ? null : "Lo que te cuesta a ti; se registra como gasto en Finanzas"}><NumInput value={m.cost} onChange={(v) => setM({ ...m, cost: v })} ariaLabel="Costo" />{cost0 && <p style={{ fontSize: 12, color: C.amber, marginTop: 6 }}>Sin costo, esta pieza se verá con 100% de margen en los reportes.</p>}</Card>}
        <Card title="¿Cómo quieres guardarla?" sub={m.mode === "once" ? "Se usa solo en esta orden — no queda guardada para la próxima vez." : "Se crea como producto real de Inventario, además de añadirse a esta orden."}><Seg value={m.mode} onChange={(k) => setM({ ...m, mode: k })} options={[["once", "Usar una vez"], ["save", "Guardar en Inventario"]]} /></Card>
        {m.mode === "save" && (
          <>
            <Banner color={C.amber}>{ctx.has ? `Se guardará etiquetada para ${deviceLabel}` : "Esta orden no tiene equipo asociado — se guardará sin etiqueta de marca/modelo."}</Banner>
            <Card title="Categoría"><select value={m.category} onChange={(e) => setM({ ...m, category: e.target.value })} aria-label="Categoría" className="w-full" style={{ background: C.card2, color: "#fff", borderRadius: 12, padding: "12px 14px", fontSize: 16, colorScheme: "dark" }}>{CATEGORIES.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></Card>
            {!m.service && <Card title="Stock inicial"><Stepper value={m.stock} min={0} onChange={(v) => setM({ ...m, stock: v })} /></Card>}
            <Card title="SKU" sub="Opcional — se genera uno si lo dejas vacío"><input value={m.sku} onChange={(e) => setM({ ...m, sku: e.target.value })} placeholder="Auto-generado" className="w-full outline-none" style={{ background: C.card2, color: "#fff", borderRadius: 12, padding: "12px 14px", fontSize: 16 }} /></Card>
            <Card title="Ubicación"><input value={m.location} onChange={(e) => setM({ ...m, location: e.target.value })} placeholder="Ej. Gaveta A3" className="w-full outline-none" style={{ background: C.card2, color: "#fff", borderRadius: 12, padding: "12px 14px", fontSize: 16 }} /></Card>
            <Card title="Foto" sub="Opcional">
              <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; if (f) setM((x) => ({ ...x, photo: f })); }} />
              <button onClick={() => fileRef.current?.click()} className="apple-press flex items-center gap-2" style={{ padding: "10px 14px", borderRadius: 12, background: C.card2, color: C.brand, fontWeight: 600 }}><Camera className="w-4 h-4" /> {m.photo ? m.photo.name : "Elegir foto"}</button>
            </Card>
          </>
        )}
        <button onClick={() => addManual(m.mode === "save")} disabled={!ok || busy} className="apple-press disabled:opacity-40" style={{ padding: "14px 0", borderRadius: 14, background: C.brand, color: "#fff", fontWeight: 700, fontSize: 16 }}>{busy ? <Loader2 className="w-5 h-5 animate-spin mx-auto" /> : m.mode === "save" ? "Guardar y sumar a la lista" : "Sumar a la lista"}</button>
      </div>
    );
  } else if (tab === "accesorios") {
    const list = q ? filterProducts(accessories, q) : accessories;
    content = !accessories.length ? <div className="text-center" style={{ padding: 40, color: C.sub }}><b style={{ color: "#fff" }}>Sin accesorios</b><p style={{ fontSize: 13 }}>No hay accesorios en inventario.</p></div>
      : q && !list.length ? <p className="text-center" style={{ padding: 40, color: C.sub }}>Sin resultados para &quot;{q}&quot;</p> : section("ACCESORIOS", list, C.blue);
  } else {
    const all = [...parts.matched, ...parts.rest, ...services.matched, ...services.rest];
    if (!products.length) content = <div className="text-center" style={{ padding: 40, color: C.sub }}><b style={{ color: "#fff" }}>Sin productos</b><p style={{ fontSize: 13 }}>Agrega inventario en el panel web o en la pestaña Inventario.</p></div>;
    else if (q) { const list = filterProducts(all, q); content = list.length ? grid(list) : <p className="text-center" style={{ padding: 40, color: C.sub }}>Sin resultados para &quot;{q}&quot;</p>; }
    else if (!all.length) content = <div className="text-center" style={{ padding: 40, color: C.sub }}><b style={{ color: "#fff" }}>{ctx.has ? "Sin piezas para este equipo" : "Sin piezas"}</b><p style={{ fontSize: 13, marginTop: 4 }}>{ctx.has ? `No hay piezas ni servicios en inventario para ${deviceLabel}.` : "No hay piezas ni servicios en inventario."}</p>{ctx.has && <button onClick={() => setTab("manual")} className="apple-press" style={{ marginTop: 10, color: C.brand, fontWeight: 700 }}>Agregar a mano</button>}</div>;
    else content = <div className="flex flex-col" style={{ gap: 18 }}>{!ctx.has && <p style={{ fontSize: 12, color: C.sub }}>Esta orden no tiene equipo. Se muestran todas las piezas y servicios.</p>}{section(ctx.has ? `PIEZAS PARA ${dev}` : "PIEZAS", parts.matched, C.green)}{section(ctx.has && parts.matched.length ? "PIEZAS" : ctx.has ? "OTRAS PIEZAS" : "PIEZAS", ctx.has ? parts.rest : parts.rest, C.green)}{section(ctx.has ? "SERVICIOS PARA ESTE EQUIPO" : "SERVICIOS", services.matched, "#5E5CE6")}{section("SERVICIOS", services.rest, "#5E5CE6")}</div>;
  }

  const panel = (
    <div className="flex flex-col" style={{ gap: 10, padding: 14, borderRadius: 16, background: C.card, height: wide ? "100%" : "auto" }}>
      <p style={{ fontSize: 15, fontWeight: 800 }}>Por agregar</p>
      <p style={{ fontSize: 12, color: C.sub }}>Ya en el carrito: {lines.length} · {money(cartTotal)}</p>
      <div className="flex-1 overflow-y-auto flex flex-col" style={{ gap: 8, minHeight: 60 }}>
        {!pending.length ? <p style={{ color: C.sub, fontSize: 13, padding: "14px 0" }}>Toca una pieza para agregarla</p> : pending.map((p) => {
          const st = p.kind === "catalog" ? stockOf(p.product) : null;
          const max = st && st > 0 ? st : 999;
          const svc = p.kind === "manual-service" || (p.kind === "catalog" && p.product.type === "service");
          return (
            <div key={p.key} style={{ padding: 10, borderRadius: 12, background: C.card2 }}>
              <div className="flex items-start gap-2"><span className="flex-1 min-w-0"><span className="block" style={{ fontSize: 13, fontWeight: 600 }}>{p.name}</span>{p.kind !== "catalog" && <span className="block" style={{ fontSize: 11, color: C.sub }}>{p.kind === "manual-service" ? "Servicio manual" : "Pieza manual"}</span>}</span>
                <button onClick={() => setConfirm({ title: `¿Quitar ${p.name} de la lista?`, message: "", yes: "Quitar", no: "Cancelar", destructive: true, onYes: () => setPending((x) => x.filter((y) => y.key !== p.key)) })} aria-label="Quitar" style={{ color: C.sub }}><X className="w-4 h-4" /></button></div>
              <div className="flex items-center gap-2" style={{ marginTop: 6 }}>
                {!svc && <Stepper size={28} value={p.quantity} max={max} onChange={(v) => setPending((x) => x.map((y) => (y.key === p.key ? { ...y, quantity: v } : y)))} />}
                <span className="flex-1" />
                <span className="inline-flex items-center" style={{ background: C.card, borderRadius: 8, padding: "0 6px" }}><span style={{ color: C.sub, fontSize: 12 }}>$</span><input value={p.price} onChange={(e) => { const r = e.target.value.replace(",", "."); if (/^\d*\.?\d{0,2}$/.test(r)) setPending((x) => x.map((y) => (y.key === p.key ? { ...y, price: r } : y))); }} inputMode="decimal" aria-label={`Precio ${p.name}`} className="bg-transparent outline-none text-right" style={{ width: 60, color: "#fff", fontSize: 13, padding: "5px 0" }} /></span>
                <b style={{ fontSize: 13, minWidth: 54, textAlign: "right" }}>{money(num(p.price) * p.quantity)}</b>
              </div>
            </div>
          );
        })}
      </div>
      <div className="flex justify-between" style={{ fontSize: 15, fontWeight: 800 }}><span>Total a agregar</span><span>{money(pendTotal)}</span></div>
      <button onClick={commit} disabled={!pending.length || busy} className="apple-press disabled:opacity-40" style={{ padding: "13px 0", borderRadius: 14, background: C.brand, color: "#fff", fontWeight: 700 }}>{busy ? <Loader2 className="w-5 h-5 animate-spin mx-auto" /> : pending.length ? `Agregar al carrito (${units}) · ${money(pendTotal)}` : "Agregar al carrito"}</button>
    </div>
  );

  return (
    <Overlay z={320} onEscape={requestClose}>
      <div className="flex items-center gap-3" style={{ padding: "12px 20px", borderBottom: `0.5px solid ${C.sep}` }}>
        <button onClick={requestClose} style={{ color: C.brand, fontWeight: 600 }}>Cancelar</button>
        <span className="flex-1 text-center"><b style={{ fontSize: 17 }}>Agregar piezas</b><span className="block" style={{ fontSize: 12, color: C.sub }}>Orden {order.order_number}{deviceLabel ? ` · ${deviceLabel}` : ""}</span></span>
        <span style={{ width: 60 }} />
      </div>
      <div className="flex flex-1 min-h-0" style={{ flexDirection: wide ? "row" : "column" }}>
        <div className="flex-1 overflow-y-auto" style={{ padding: 16 }}>
          <div className="flex flex-col mx-auto" style={{ gap: 14, maxWidth: 1000 }}>
            <Seg value={tab} onChange={(k) => { setTab(k); setQuery(""); }} options={[["piezas", "Piezas"], ["accesorios", "Accesorios"], ["manual", "Manual"]]} />
            {tab !== "manual" && (
              <label className="flex items-center gap-2" style={{ height: 44, padding: "0 14px", borderRadius: 12, background: C.card }}>
                <Search className="w-4 h-4" style={{ color: C.sub }} />
                <input value={query} onChange={(e) => setQuery(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") trySearchEnter(); }} placeholder={tab === "accesorios" ? "Buscar accesorios" : ctx.has ? "Buscar piezas de este equipo" : "Buscar piezas y servicios"} aria-label="Buscar" className="flex-1 bg-transparent outline-none" style={{ color: "#fff", fontSize: 15, minWidth: 0 }} />
                {query && <button onClick={() => setQuery("")} aria-label="Limpiar" style={{ color: C.sub }}><X className="w-4 h-4" /></button>}
                <ScanBarcode className="w-5 h-5" style={{ color: C.sub }} />
              </label>
            )}
            {notice && <Banner color={C.amber}>{notice}</Banner>}
            {error && <Banner color={C.red} onDismiss={() => setError(null)}>{error}</Banner>}
            {content}
            {!wide && <div style={{ marginTop: 10 }}>{panel}</div>}
          </div>
        </div>
        {wide && <div style={{ width: 340, flexShrink: 0, padding: 16, borderLeft: `0.5px solid ${C.sep}`, overflowY: "auto" }}>{panel}</div>}
      </div>
      <AlertDialog open={!!confirm} title={confirm?.title || ""} message={confirm?.message || ""} onClose={() => setConfirm(null)} actions={[{ label: confirm?.no || "Cancelar" }, { label: confirm?.yes || "Sí, añadir", bold: true, destructive: !!confirm?.destructive, onPress: () => confirm?.onYes?.() }]} />
      <AlertDialog open={discard} title="¿Descartar las piezas por agregar?" message="" onClose={() => setDiscard(false)} actions={[{ label: "Volver a editar", bold: true }, { label: "Descartar", destructive: true, onPress: () => onClose(false) }]} />
    </Overlay>
  );
}
