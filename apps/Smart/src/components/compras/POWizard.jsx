import { useEffect, useMemo, useRef, useState } from "react";
import { X, ChevronLeft, ChevronRight, Check, Loader2, Plus, Minus, Trash2, Pencil, Camera, FileText, Link2, ShoppingBag, Sparkles, Package, Search, Wrench, BadgeCheck, AlertTriangle, Image as ImageIcon, Clipboard } from "lucide-react";
import { Dialog, TextAction, AlertDialog, tint } from "@/components/pos/native/posUi";
import { Overlay, Banner, Caption, Card, Input, TextArea, W, money } from "@/components/wizard/ui";
import { searchProducts } from "@/lib/wizard/helpers";
import { statusInfo } from "@/lib/orderStatus";
import {
  num, r2, prDay, addDaysStr, delayedDays, PAY_METHODS, newLine, fetchSuppliers, fetchProducts, fetchLinkableOrders, archiveSupplier, createSupplier, uploadInvoiceFile, extractInvoice, applyExtraction, createPurchaseOrder, longDate,
} from "@/lib/comprasApi";
import { SupplierAvatar, SupplierEditDialog } from "./Suppliers";

const BRAND = "#F2662E";
const GREEN = "#4DC780";
const RED = "#FF7373";
const VIP = "#FFC733";
const INFO = "#66B3FF";
const PURPLE = "#BF5AF2";
const TEAL = "#40C8E0";

function NumField({ value, onChange, placeholder = "0.00", style, ariaLabel }) {
  const [text, setText] = useState(value ? String(value) : "");
  useEffect(() => { if (num(text) !== value) setText(value ? String(value) : ""); }, [value]);
  return (
    <input value={text} inputMode="decimal" placeholder={placeholder} aria-label={ariaLabel}
      onChange={(e) => { const raw = e.target.value.replace(",", "."); if (!/^\d*\.?\d{0,2}$/.test(raw)) return; setText(raw); onChange(num(raw)); }}
      className="bg-transparent outline-none" style={{ minWidth: 0, ...style }} />
  );
}

function ProductPicker({ open, products, initialQuery, allowClear, onPick, onClear, onClose }) {
  const [q, setQ] = useState(initialQuery || "");
  useEffect(() => { if (open) setQ(initialQuery || ""); }, [open, initialQuery]);
  const list = useMemo(() => searchProducts(products, q).slice(0, 120), [products, q]);
  return (
    <Dialog open={open} onClose={onClose} title="Vincular al catálogo" width={520} height="80dvh" leading={<TextAction onClick={onClose}>Cancelar</TextAction>} trailing={allowClear ? <TextAction onClick={() => { onClear(); onClose(); }}>Sin vincular</TextAction> : <span />}>
      <div className="flex flex-col" style={{ gap: 10, paddingTop: 6 }}>
        <label className="flex items-center gap-2" style={{ height: 42, padding: "0 12px", borderRadius: 12, background: W.card2 }}>
          <Search className="w-4 h-4" style={{ color: W.sub }} />
          <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar nombre, SKU o categoría…" className="flex-1 bg-transparent outline-none" style={{ color: "#fff", fontSize: 15, minWidth: 0 }} />
        </label>
        <div style={{ borderRadius: 12, background: W.card2, overflow: "hidden" }}>
          {list.map((p, i) => (
            <button key={p.id} onClick={() => { onPick(p); onClose(); }} className="apple-press w-full flex items-center gap-3 text-left" style={{ padding: "10px 12px", borderTop: i ? `0.5px solid ${W.sep}` : "none" }}>
              <span style={{ width: 34, height: 34, borderRadius: 9, background: tint(p.type === "service" ? "#63E6BE" : VIP, 0.16), color: p.type === "service" ? "#63E6BE" : VIP, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>{p.type === "service" ? <Wrench className="w-4 h-4" /> : <Package className="w-4 h-4" />}</span>
              <span className="flex-1 min-w-0"><span className="block truncate" style={{ fontSize: 14, fontWeight: 600 }}>{p.name}</span><span className="block truncate" style={{ fontSize: 11, color: W.sub }}>{[p.sku, p.category].filter(Boolean).join(" · ")}</span></span>
              <span style={{ fontSize: 13, fontWeight: 700, color: GREEN }}>{money(p.price)}</span>
            </button>
          ))}
          {!list.length && <p className="text-center" style={{ padding: 24, color: W.sub, fontSize: 14 }}>Sin resultados</p>}
        </div>
      </div>
    </Dialog>
  );
}

export function OrderPicker({ open, tenantId, onPick, onClear, allowClear, onClose }) {
  const [rows, setRows] = useState(null);
  const [q, setQ] = useState("");
  useEffect(() => { if (open) { setRows(null); setQ(""); fetchLinkableOrders(tenantId).then(setRows, () => setRows([])); } }, [open, tenantId]);
  const list = (rows || []).filter((o) => {
    const s = q.trim().toLowerCase();
    if (!s) return true;
    return [o.customer_name, o.order_number, o.device_model, o.device_family, o.device_brand].some((v) => String(v || "").toLowerCase().includes(s));
  });
  return (
    <Dialog open={open} onClose={onClose} title="Vincular a orden" width={520} height="80dvh" leading={<span />} trailing={<TextAction bold onClick={onClose}>Cerrar</TextAction>}>
      <div className="flex flex-col" style={{ gap: 10, paddingTop: 6 }}>
        <label className="flex items-center gap-2" style={{ height: 42, padding: "0 12px", borderRadius: 12, background: W.card2 }}>
          <Search className="w-4 h-4" style={{ color: W.sub }} />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Cliente, número o modelo" className="flex-1 bg-transparent outline-none" style={{ color: "#fff", fontSize: 15, minWidth: 0 }} />
        </label>
        {allowClear && (
          <button onClick={() => { onClear(); onClose(); }} className="apple-press text-left" style={{ padding: 12, borderRadius: 12, background: W.card2 }}>
            <span className="block" style={{ fontSize: 14, fontWeight: 600 }}>Sin orden de trabajo</span>
            <span className="block" style={{ fontSize: 12, color: W.sub }}>Pieza para stock o uso general del taller</span>
          </button>
        )}
        {rows === null ? <div className="flex justify-center" style={{ padding: 30 }}><Loader2 className="w-5 h-5 animate-spin" style={{ color: W.sub }} /></div>
          : !list.length ? <div className="text-center" style={{ padding: 24, color: W.sub }}><b style={{ color: "#fff" }}>Sin órdenes activas</b><p style={{ fontSize: 13, marginTop: 4 }}>No hay órdenes en estados accionables. Las órdenes entregadas o canceladas no aparecen aquí.</p></div>
            : (
              <div style={{ borderRadius: 12, background: W.card2, overflow: "hidden" }}>
                {list.map((o, i) => {
                  const info = statusInfo(o.status);
                  return (
                    <button key={o.id} onClick={() => { onPick(o); onClose(); }} className="apple-press w-full flex items-center gap-3 text-left" style={{ padding: "10px 12px", borderTop: i ? `0.5px solid ${W.sep}` : "none" }}>
                      <span style={{ width: 4, alignSelf: "stretch", borderRadius: 999, background: info.color }} />
                      <span className="flex-1 min-w-0"><span className="block" style={{ fontSize: 14, fontWeight: 700 }}>{o.order_number}</span><span className="block truncate" style={{ fontSize: 12, color: W.sub }}>{o.customer_name || "—"} · {[o.device_brand, o.device_family, o.device_model].filter(Boolean).join(" ")}</span></span>
                      <span style={{ padding: "1px 8px", borderRadius: 999, background: tint(info.color, 0.15), color: info.color, fontSize: 11, fontWeight: 600 }}>{info.label}</span>
                    </button>
                  );
                })}
              </div>
            )}
      </div>
    </Dialog>
  );
}

function LinkSheet({ open, initial, onClose, onSave }) {
  const [v, setV] = useState("");
  useEffect(() => { if (open) setV(initial || ""); }, [open, initial]);
  return (
    <Dialog open={open} onClose={onClose} title="Añadir link" width={460} leading={<TextAction onClick={onClose}>Cancelar</TextAction>} trailing={<TextAction bold disabled={!v.trim()} onClick={() => { onSave(v.trim()); onClose(); }}>Guardar</TextAction>}>
      <div className="flex flex-col" style={{ gap: 10, paddingTop: 8 }}>
        <Caption>Link del recibo</Caption>
        <Input value={v} onChange={setV} placeholder="https://..." autoFocus />
        <div className="flex" style={{ gap: 8 }}>
          <button onClick={async () => { try { setV((await navigator.clipboard.readText()) || v); } catch { return; } }} className="apple-press flex items-center gap-1" style={{ padding: "7px 12px", borderRadius: 999, background: tint(BRAND, 0.16), color: BRAND, fontSize: 13, fontWeight: 700 }}><Clipboard className="w-3.5 h-3.5" /> Pegar del portapapeles</button>
          {v && <button onClick={() => { setV(""); onSave(""); onClose(); }} className="apple-press" style={{ padding: "7px 12px", borderRadius: 999, background: tint(RED, 0.16), color: RED, fontSize: 13, fontWeight: 700 }}>Borrar link</button>}
        </div>
        <p style={{ fontSize: 12, color: W.sub }}>Pega la URL exacta donde está el recibo o factura. Queda guardada en la orden de compra para abrirla luego.</p>
      </div>
    </Dialog>
  );
}

function UploadSheet({ open, onClose, onFile }) {
  const cam = useRef(null);
  const gal = useRef(null);
  const pdf = useRef(null);
  const opt = (Icon, color, title, sub, ref) => (
    <button onClick={() => ref.current?.click()} className="apple-press w-full flex items-center gap-3 text-left" style={{ padding: 14, borderRadius: 14, background: W.card2 }}>
      <span style={{ width: 40, height: 40, borderRadius: 12, background: tint(color, 0.16), color, display: "flex", alignItems: "center", justifyContent: "center" }}><Icon className="w-5 h-5" /></span>
      <span><span className="block" style={{ fontSize: 15, fontWeight: 700 }}>{title}</span><span className="block" style={{ fontSize: 12, color: W.sub }}>{sub}</span></span>
    </button>
  );
  const pick = (e) => { const f = e.target.files?.[0]; e.target.value = ""; if (f) { onClose(); onFile(f); } };
  return (
    <Dialog open={open} onClose={onClose} title="Subir factura" width={440} leading={<span />} trailing={<TextAction onClick={onClose}>Cancelar</TextAction>}>
      <div className="flex flex-col" style={{ gap: 10, paddingTop: 6 }}>
        <p style={{ fontSize: 13, color: W.sub }}>Smart IA leerá los productos, cantidades y precios.</p>
        {opt(Camera, BRAND, "Tomar foto", "Directo a la cámara", cam)}
        {opt(ImageIcon, INFO, "Foto o imagen", "Desde tu galería", gal)}
        {opt(FileText, PURPLE, "Archivo PDF", "Factura digital", pdf)}
        <input ref={cam} type="file" accept="image/*" capture="environment" className="hidden" onChange={pick} />
        <input ref={gal} type="file" accept="image/*" className="hidden" onChange={pick} />
        <input ref={pdf} type="file" accept="application/pdf" className="hidden" onChange={pick} />
      </div>
    </Dialog>
  );
}

function PathCard({ Icon, color, title, sub, onClick }) {
  return (
    <button onClick={onClick} className="apple-press flex flex-col items-start text-left" style={{ gap: 8, padding: 14, borderRadius: 16, background: tint(color, 0.12), border: `1px solid ${tint(color, 0.3)}` }}>
      <span style={{ width: 40, height: 40, borderRadius: 12, background: color, color: "#fff", display: "flex", alignItems: "center", justifyContent: "center" }}><Icon className="w-5 h-5" /></span>
      <span><span className="block" style={{ fontSize: 15, fontWeight: 700 }}>{title}</span><span className="block" style={{ fontSize: 12, color: W.sub }}>{sub}</span></span>
    </button>
  );
}

export default function POWizard({ open, onClose, tenantId, employeeName, prefill }) {
  if (!open) return null;
  return <Inner onClose={onClose} tenantId={tenantId} employeeName={employeeName} prefill={prefill || null} />;
}

function Inner({ onClose, tenantId, employeeName, prefill }) {
  const [step, setStep] = useState(1);
  const [suppliers, setSuppliers] = useState([]);
  const [products, setProducts] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const [supplier, setSupplier] = useState(null);
  const [manualName, setManualName] = useState("");
  const [lines, setLines] = useState([]);
  const [invoiceLink, setInvoiceLink] = useState("");
  const [method, setMethod] = useState("cash");
  const [expected, setExpected] = useState("");
  const [notes, setNotes] = useState("");
  const [tracking, setTracking] = useState("");
  const [error, setError] = useState(null);
  const [proc, setProc] = useState(null);
  const [busy, setBusy] = useState(false);
  const [success, setSuccess] = useState(null);
  const [confirmClose, setConfirmClose] = useState(false);
  const [supForm, setSupForm] = useState(null);
  const [delSup, setDelSup] = useState(null);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [linkOpen, setLinkOpen] = useState(false);
  const [picker, setPicker] = useState(null);
  const [woPicker, setWoPicker] = useState(null);
  const appliedRef = useRef(false);
  const prelinked = prefill?.prelinked || null;

  useEffect(() => {
    let alive = true;
    Promise.all([fetchSuppliers(tenantId).catch(() => []), fetchProducts(tenantId).catch(() => [])]).then(([s, p]) => {
      if (!alive) return;
      setSuppliers(s);
      setProducts(p);
      setLoaded(true);
    });
    return () => { alive = false; };
  }, [tenantId]);

  useEffect(() => {
    if (!loaded || appliedRef.current || !prefill) return;
    appliedRef.current = true;
    if (prefill.supplierId || prefill.supplierName) {
      const hit = suppliers.find((s) => (prefill.supplierId && s.id === prefill.supplierId) || (prefill.supplierName && s.name === prefill.supplierName));
      if (hit) setSupplier(hit); else if (prefill.supplierName) setManualName(prefill.supplierName);
    }
    const base = Array.isArray(prefill.lines) ? prefill.lines : [];
    const fromCatalog = (prefill.catalogItems || []).map((c) => newLine({ inventory_item_id: c.product.id, product_name: c.product.name, quantity: c.quantity || 1, unit_cost: num(c.product.cost ?? c.product.price), unit_price: num(c.product.price), linked_work_order_id: prelinked?.id || null, linked_work_order_number: prelinked?.order_number || null }));
    setLines([...base, ...fromCatalog]);
    if (prefill.startStep && base.length + fromCatalog.length > 0) setStep(prefill.startStep);
  }, [loaded]);

  const hasSupplier = !!supplier || !!manualName.trim();
  const total = r2(lines.reduce((s, l) => s + num(l.quantity) * num(l.unit_cost), 0));
  const canAdvance2 = lines.length > 0 && lines.every((l) => String(l.product_name || "").trim());
  const dirty = lines.length > 0 || hasSupplier || !!invoiceLink || !!notes.trim() || !!tracking.trim();
  const delayed = method === "check" || method === "credit";
  const dueDay = delayed ? addDaysStr(prDay(), delayedDays(method)) : null;

  const requestClose = () => {
    if (busy || proc || success) return;
    if (dirty) setConfirmClose(true); else onClose(false);
  };

  const patchLine = (id, patch) => setLines((prev) => prev.map((l) => {
    if (l.id !== id) return l;
    const n = { ...l, ...patch };
    if (patch.unit_cost !== undefined && num(l.unit_price) <= 0 && num(n.unit_cost) > 0) n.unit_price = r2(num(n.unit_cost) * 1.5);
    n.quantity = Math.max(1, Math.trunc(num(n.quantity)) || 1);
    n.line_total = r2(n.quantity * num(n.unit_cost));
    return n;
  }));

  const applyExtracted = (data) => {
    const r = applyExtraction(data, { suppliers, products, currentSupplier: supplier, prelinked });
    if (r.supplier && !supplier) setSupplier(r.supplier);
    if (!r.supplier && r.manualName && !manualName.trim()) setManualName(r.manualName);
    setLines((prev) => [...prev, ...r.lines]);
  };

  const processFile = async (file) => {
    setError(null);
    if (file.size > 10 * 1024 * 1024) { setError("El archivo excede 10MB. Reduce la calidad o sube un PDF más liviano."); return; }
    setProc("uploading");
    let url;
    try { url = await uploadInvoiceFile(tenantId, file); } catch (e) { setProc(null); setError(`Error al subir: ${e?.message || e}`); return; }
    setInvoiceLink(url);
    setProc("analyzing");
    try {
      applyExtracted(await extractInvoice(url));
      setStep(2);
    } catch {
      setError("Smart IA no pudo leer la factura. Reintenta o continúa manualmente.");
    } finally {
      setProc(null);
    }
  };

  const processLink = async (raw) => {
    setError(null);
    if (!raw) { setInvoiceLink(""); return; }
    const url = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
    setInvoiceLink(url);
    setProc("analyzing");
    try {
      applyExtracted(await extractInvoice(url));
      setStep(2);
    } catch {
      setError("Smart IA no pudo leer ese link. Usa un link directo al recibo (PDF o imagen) o añade los productos manual. El link queda guardado.");
    } finally {
      setProc(null);
    }
  };

  const doDeleteSupplier = async (s) => {
    try {
      await archiveSupplier(s.id);
      setSuppliers((p) => p.filter((x) => x.id !== s.id));
      if (supplier?.id === s.id) setSupplier(null);
    } catch (e) {
      setError(`No se pudo borrar: ${e?.message || e}`);
    }
  };

  const addFromInventory = (p) => {
    setLines((prev) => {
      const idx = prev.findIndex((l) => l.inventory_item_id === p.id);
      if (idx >= 0) return prev.map((l, i) => (i === idx ? { ...l, quantity: num(l.quantity) + 1, line_total: r2((num(l.quantity) + 1) * num(l.unit_cost)) } : l));
      return [...prev, newLine({ inventory_item_id: p.id, product_name: p.name, quantity: 1, unit_cost: num(p.cost ?? p.price), unit_price: num(p.price), linked_work_order_id: prelinked?.id || null, linked_work_order_number: prelinked?.order_number || null })];
    });
  };

  const linkLine = (lineId, p) => setLines((prev) => prev.map((l) => {
    if (l.id !== lineId) return l;
    const n = { ...l, inventory_item_id: p.id };
    if (!String(l.product_name || "").trim()) n.product_name = p.name;
    if (num(p.price) > 0) n.unit_price = num(p.price);
    return n;
  }));

  const unlinkLine = (lineId) => setLines((prev) => prev.map((l) => { if (l.id !== lineId) return l; const n = { ...l }; delete n.inventory_item_id; return n; }));

  const setWo = (lineId, o) => setLines((prev) => prev.map((l) => {
    if (l.id !== lineId) return l;
    const n = { ...l };
    if (o) { n.linked_work_order_id = o.id; n.linked_work_order_number = o.order_number; } else { delete n.linked_work_order_id; delete n.linked_work_order_number; }
    return n;
  }));

  const create = async () => {
    if (busy) return;
    setError(null);
    if (!tenantId) { setError("No se pudo identificar tu tienda. Cierra sesión y vuelve a entrar."); return; }
    if (!lines.length) { setError("Agrega al menos un producto antes de crear la orden."); return; }
    if (!hasSupplier) { setError("Selecciona un suplidor antes de crear la orden."); return; }
    setBusy(true);
    try {
      let sup = supplier;
      if (!sup) {
        sup = await createSupplier(tenantId, { name: manualName.trim(), phone: "" });
        setSupplier(sup);
        setSuppliers((p) => [...p, sup].sort((a, b) => String(a.name).localeCompare(String(b.name))));
        setManualName("");
      }
      const res = await createPurchaseOrder({ tenantId, supplier: sup, manualName: "", lines, expectedDate: expected || null, notes, tracking, invoiceLink, method, by: employeeName, checkDate: dueDay });
      setSuccess({ po: res.po, expenseFailed: res.expenseFailed });
      if (!res.expenseFailed) setTimeout(() => onClose(true), 1600);
    } catch (e) {
      setError(e?.message || String(e));
    } finally {
      setBusy(false);
    }
  };

  const stepName = ["SUPLIDOR", "PRODUCTOS", "CONFIRMAR"][step - 1];
  const supName = supplier?.name || manualName.trim();

  const body1 = (
    <div className="flex flex-col" style={{ gap: 16 }}>
      {prelinked && <Banner color={INFO}>Pidiendo pieza para {prelinked.order_number}{prelinked.customer_name ? ` · ${prelinked.customer_name}` : ""}</Banner>}
      <div><Caption>PASO 1 DE 3</Caption><p style={{ fontSize: 26, fontWeight: 800 }}>Selecciona el suplidor</p></div>
      {!loaded ? <div className="flex justify-center" style={{ padding: 40 }}><Loader2 className="w-6 h-6 animate-spin" style={{ color: W.sub }} /></div>
        : !suppliers.length ? <div className="text-center" style={{ padding: 20, color: W.sub }}><b style={{ color: "#fff" }}>Sin suplidores</b><p style={{ fontSize: 13 }}>Crea tu primer suplidor para empezar</p></div>
          : (
            <div className="grid" style={{ gap: 12, gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))" }}>
              {suppliers.map((s) => {
                const on = supplier?.id === s.id;
                return (
                  <div key={s.id} className="relative">
                    <button onClick={() => { setSupplier(on ? null : s); setManualName(""); }} className="apple-press w-full flex flex-col items-center justify-center text-center" style={{ height: 130, borderRadius: 16, gap: 8, padding: "0 10px", background: on ? tint(BRAND, 0.12) : W.card, border: `1.5px solid ${on ? BRAND : "transparent"}` }}>
                      <SupplierAvatar supplier={s} size={56} />
                      <span style={{ fontSize: 14, fontWeight: 600, overflow: "hidden", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" }}>{s.name}</span>
                    </button>
                    {on && <span className="absolute" style={{ top: 8, left: 8, width: 22, height: 22, borderRadius: 999, background: BRAND, color: "#fff", display: "flex", alignItems: "center", justifyContent: "center" }}><Check className="w-3.5 h-3.5" strokeWidth={3} /></span>}
                    <span className="absolute flex" style={{ top: 6, right: 6, gap: 4 }}>
                      <button onClick={() => setSupForm(s)} aria-label={`Editar ${s.name}`} style={{ width: 26, height: 26, borderRadius: 999, background: "#3A3A3C", display: "flex", alignItems: "center", justifyContent: "center" }}><Pencil className="w-3 h-3" /></button>
                      <button onClick={() => setDelSup(s)} aria-label={`Borrar ${s.name}`} style={{ width: 26, height: 26, borderRadius: 999, background: tint(RED, 0.2), color: RED, display: "flex", alignItems: "center", justifyContent: "center" }}><Trash2 className="w-3 h-3" /></button>
                    </span>
                  </div>
                );
              })}
            </div>
          )}
      <button onClick={() => setSupForm({})} className="apple-press flex items-center gap-3 text-left" style={{ padding: 14, borderRadius: 14, background: W.card }}>
        <span style={{ width: 36, height: 36, borderRadius: 999, background: tint(BRAND, 0.16), color: BRAND, display: "flex", alignItems: "center", justifyContent: "center" }}><Plus className="w-5 h-5" /></span>
        <span style={{ fontSize: 15, fontWeight: 600 }}>Crear nuevo suplidor</span>
      </button>
      <Input label="O escribe un nombre" value={manualName} onChange={(v) => { setManualName(v); if (v.trim()) setSupplier(null); }} placeholder="Ej: Ferretería La Esquina" />
      {hasSupplier && (
        <>
          <Caption style={{ paddingTop: 4 }}>¿Cómo quieres añadir los productos?</Caption>
          <div className="grid" style={{ gap: 12, gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))" }}>
            <PathCard Icon={Camera} color={BRAND} title="Subir factura" sub="Foto o PDF" onClick={() => setUploadOpen(true)} />
            <PathCard Icon={Pencil} color={VIP} title="Añadir manual" sub="Sin factura" onClick={() => setStep(2)} />
            {supplier?.website && <PathCard Icon={Link2} color={PURPLE} title={invoiceLink ? "Link guardado" : "Añadir link"} sub={invoiceLink ? "Guardado" : "AI lo lee"} onClick={() => setLinkOpen(true)} />}
            {supplier?.website && <PathCard Icon={ShoppingBag} color={TEAL} title="Comprar online" sub="Abre en Safari" onClick={() => window.open(/^https?:\/\//i.test(supplier.website) ? supplier.website : `https://${supplier.website}`, "_blank", "noopener")} />}
          </div>
        </>
      )}
    </div>
  );

  const body2 = (
    <div className="flex flex-col" style={{ gap: 14 }}>
      <div><Caption>PASO 2 DE 3</Caption><p style={{ fontSize: 26, fontWeight: 800 }}>Revisa los productos</p><p style={{ fontSize: 14, color: W.sub }}>Ajusta nombres, costos y precios de venta. Marca si es pieza nueva o si va a una orden.</p></div>
      {!lines.length && <div className="text-center" style={{ padding: 24, color: W.sub }}><b style={{ color: "#fff" }}>Sin productos aún</b><p style={{ fontSize: 13, marginTop: 4 }}>Añade items manualmente abajo o sube una factura desde el paso anterior.</p></div>}
      <div className="grid" style={{ gap: 14, gridTemplateColumns: "repeat(auto-fit, minmax(340px, 1fr))", alignItems: "start" }}>
        {lines.map((l) => {
          const prod = l.inventory_item_id ? products.find((p) => p.id === l.inventory_item_id) : null;
          const cost = num(l.unit_cost);
          const price = num(l.unit_price);
          const margin = cost > 0 && price > 0 ? Math.round(((price - cost) / cost) * 100) : null;
          const mColor = margin === null ? W.sub : margin >= 30 ? GREEN : margin >= 10 ? "#FFA640" : margin < 0 ? RED : W.sub;
          const invPrice = prod ? num(prod.price) : 0;
          return (
            <Card key={l.id} style={{ padding: 14 }}>
              <div className="flex items-center gap-2" style={{ marginBottom: 10 }}>
                {l.is_ai_imported ? <Sparkles className="w-4 h-4" style={{ color: VIP }} /> : <Package className="w-4 h-4" style={{ color: W.sub }} />}
                <span className="flex-1" style={{ fontSize: 12, fontWeight: 600, color: l.is_ai_imported ? VIP : W.sub }}>{l.is_ai_imported ? "Importado de factura" : "Producto"}</span>
                <button onClick={() => setLines((p) => p.filter((x) => x.id !== l.id))} aria-label="Quitar producto" style={{ color: RED }}><Trash2 className="w-4 h-4" /></button>
              </div>
              <input value={l.product_name} onChange={(e) => patchLine(l.id, { product_name: e.target.value })} placeholder="Nombre del producto" aria-label="Nombre del producto" className="w-full outline-none" style={{ background: W.card2, color: "#fff", borderRadius: 12, padding: "12px 14px", fontSize: 17, fontWeight: 600 }} />
              <div className="grid grid-cols-2" style={{ gap: 12, marginTop: 12 }}>
                <div>
                  <Caption style={{ paddingBottom: 6 }}>Cantidad</Caption>
                  <div className="flex items-center gap-3">
                    <button onClick={() => patchLine(l.id, { quantity: Math.max(1, num(l.quantity) - 1) })} aria-label="Menos" style={{ width: 34, height: 34, borderRadius: 999, background: "#3A3A3C", display: "flex", alignItems: "center", justifyContent: "center" }}><Minus className="w-4 h-4" /></button>
                    <b style={{ fontSize: 18, minWidth: 24, textAlign: "center" }}>{l.quantity}</b>
                    <button onClick={() => patchLine(l.id, { quantity: num(l.quantity) + 1 })} aria-label="Más" style={{ width: 34, height: 34, borderRadius: 999, background: BRAND, display: "flex", alignItems: "center", justifyContent: "center" }}><Plus className="w-4 h-4" /></button>
                  </div>
                </div>
                <div>
                  <Caption style={{ paddingBottom: 6 }}>Costo (factura)</Caption>
                  <div className="flex items-center gap-1" style={{ background: W.card2, borderRadius: 12, padding: "0 12px", height: 40 }}><span style={{ color: W.sub }}>$</span><NumField value={cost} onChange={(v) => patchLine(l.id, { unit_cost: v })} ariaLabel="Costo" style={{ width: "100%", color: "#fff", fontSize: 17, fontWeight: 600 }} /></div>
                </div>
              </div>
              <div style={{ height: 0.5, background: W.sep, margin: "12px 0" }} />
              <Caption style={{ paddingBottom: 6 }}>Precio de venta</Caption>
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-1 flex-1" style={{ background: W.card2, borderRadius: 12, padding: "0 12px", height: 44 }}><span style={{ color: GREEN }}>$</span><NumField value={price} onChange={(v) => patchLine(l.id, { unit_price: v })} ariaLabel="Precio de venta" style={{ width: "100%", color: GREEN, fontSize: 20, fontWeight: 800 }} /></div>
                <span style={{ fontSize: 13, fontWeight: 700, color: mColor }}>{margin === null ? "Pon el precio para vender" : `Margen ${margin >= 0 ? "+" : ""}${margin}%`}</span>
              </div>
              {prod && invPrice > 0 && (
                Math.abs(invPrice - price) < 0.005
                  ? <p style={{ fontSize: 12, color: W.sub, marginTop: 6 }}>Precio actual en inventario: {money(invPrice)}</p>
                  : (
                    <div className="flex items-center gap-2" style={{ marginTop: 6 }}>
                      <span className="flex-1" style={{ fontSize: 12, color: price > invPrice ? "#FFA640" : GREEN }}>Inventario: {money(invPrice)} · {price > invPrice ? `Vas a actualizar a un precio más alto (+${money(price - invPrice)})` : `Vas a bajar el precio (−${money(invPrice - price)})`}</span>
                      <button onClick={() => patchLine(l.id, { unit_price: invPrice })} className="apple-press" style={{ padding: "4px 10px", borderRadius: 999, background: tint(BRAND, 0.16), color: BRAND, fontSize: 12, fontWeight: 700 }}>Usar inventario</button>
                    </div>
                  )
              )}
              <div style={{ height: 0.5, background: W.sep, margin: "12px 0" }} />
              <div className="flex items-center gap-2" style={{ fontSize: 13 }}>
                <span className="flex-1 min-w-0 truncate" style={{ color: prod ? "#fff" : W.sub }}>{prod ? `Vinculado a: ${prod.name}` : l.inventory_item_id ? "Vinculado a un producto" : "Pieza nueva — se añadirá al inventario"}</span>
                <button onClick={() => setPicker({ lineId: l.id, query: l.product_name, allowClear: !!l.inventory_item_id })} className="apple-press" style={{ color: BRAND, fontWeight: 700 }}>{l.inventory_item_id ? "Cambiar" : "Vincular a existente"}</button>
              </div>
              <div className="flex items-center gap-2" style={{ fontSize: 13, marginTop: 8 }}>
                <span className="flex-1 min-w-0 truncate" style={{ color: l.linked_work_order_id ? INFO : W.sub }}>{l.linked_work_order_id ? `Para orden: ${l.linked_work_order_number || ""}` : "¿Es para una orden de trabajo?"}</span>
                <button onClick={() => setWoPicker({ lineId: l.id, allowClear: !!l.linked_work_order_id })} className="apple-press" style={{ color: BRAND, fontWeight: 700 }}>{l.linked_work_order_id ? "Cambiar" : "Vincular"}</button>
              </div>
              <div className="flex justify-between" style={{ marginTop: 12, fontSize: 14 }}><span style={{ color: W.sub }}>Subtotal</span><b style={{ color: BRAND }}>{money(num(l.quantity) * cost)}</b></div>
            </Card>
          );
        })}
      </div>
      <Card style={{ padding: 14 }}>
        <div className="flex justify-between" style={{ fontSize: 13, color: W.sub }}><span>{lines.length} producto{lines.length === 1 ? "" : "s"}</span><span>Total de la orden</span></div>
        <p className="text-right" style={{ fontSize: 26, fontWeight: 800, color: BRAND }}>{money(total)}</p>
      </Card>
      <div className="flex flex-wrap" style={{ gap: 10 }}>
        <button onClick={() => setPicker({ lineId: null, query: "", allowClear: false })} className="apple-press flex items-center gap-2" style={{ padding: "12px 16px", borderRadius: 14, background: W.card, fontWeight: 600 }}><Package className="w-4 h-4" style={{ color: BRAND }} /> Del inventario</button>
        <button onClick={() => setLines((p) => [...p, newLine({ quantity: 1, linked_work_order_id: prelinked?.id || null, linked_work_order_number: prelinked?.order_number || null })])} className="apple-press flex items-center gap-2" style={{ padding: "12px 16px", borderRadius: 14, background: W.card, fontWeight: 600 }}><Plus className="w-4 h-4" style={{ color: BRAND }} /> Añadir producto manualmente</button>
      </div>
    </div>
  );

  const body3 = (
    <div className="flex flex-col" style={{ gap: 14 }}>
      <div><Caption>PASO 3 DE 3</Caption><p style={{ fontSize: 26, fontWeight: 800 }}>Confirmar y guardar</p></div>
      <Card style={{ padding: 14 }}>
        {[["Suplidor", supName || "—"], ["Productos", `${lines.length} ${lines.length === 1 ? "item" : "items"}`]].map(([k, v]) => <div key={k} className="flex justify-between" style={{ padding: "5px 0", fontSize: 15 }}><span style={{ color: W.sub }}>{k}</span><b>{v}</b></div>)}
        <div className="flex justify-between" style={{ padding: "8px 0 0", borderTop: `0.5px solid ${W.sep}`, marginTop: 6, fontSize: 18, fontWeight: 800 }}><span>Total</span><span style={{ color: BRAND }}>{money(total)}</span></div>
      </Card>
      <Caption>Método de pago</Caption>
      <div className="grid" style={{ gap: 8, gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))" }}>
        {PAY_METHODS.map(([k, label]) => <button key={k} onClick={() => setMethod(k)} className="apple-press" style={{ padding: "12px 0", borderRadius: 12, background: method === k ? BRAND : W.card, color: "#fff", fontSize: 14, fontWeight: 700 }}>{label}</button>)}
      </div>
      {delayed && (
        <Card color="#FFA640" style={{ padding: 14 }}>
          <p style={{ fontSize: 12, fontWeight: 800, letterSpacing: "0.06em", color: "#FFA640" }}>PAGO DEMORADO</p>
          <p style={{ fontSize: 13, color: W.sub, marginTop: 4 }}>Los cheques tardan ~2–3 días en descontarse del banco. El gasto se registrará con esa fecha estimada.</p>
          <p style={{ fontSize: 14, marginTop: 6 }}>Gasto se descuenta el: <b>{longDate(dueDay)}</b></p>
        </Card>
      )}
      <Caption>Llegada estimada (opcional)</Caption>
      {expected ? (
        <div className="flex items-center gap-2">
          <Input label="Debe llegar el" type="date" value={expected} onChange={setExpected} style={{ flex: 1 }} />
          <button onClick={() => setExpected("")} className="apple-press" style={{ color: RED, fontWeight: 700, alignSelf: "flex-end", padding: "12px 8px" }}>Quitar</button>
        </div>
      ) : <button onClick={() => setExpected(addDaysStr(prDay(), 3))} className="apple-press self-start" style={{ padding: "10px 14px", borderRadius: 12, background: W.card, fontWeight: 600 }}>Poner fecha de llegada</button>}
      <Caption>Notas (opcional)</Caption>
      <TextArea value={notes} onChange={setNotes} rows={3} placeholder="Ej: llamar al recibir, factura física pendiente, etc." />
      <Caption>Tracking (opcional)</Caption>
      <Input value={tracking} onChange={setTracking} placeholder="Número de tracking" />
    </div>
  );

  return (
    <Overlay z={300} onEscape={requestClose}>
      <div className="flex items-center gap-3" style={{ padding: "12px 20px 8px" }}>
        <span className="flex-1" style={{ fontSize: 13, fontWeight: 800, letterSpacing: "0.08em", color: BRAND }}>{stepName}</span>
        <span style={{ fontSize: 13, color: W.sub }}>{step}/3</span>
        <button onClick={requestClose} aria-label="Cerrar" style={{ width: 30, height: 30, borderRadius: 999, background: "#3A3A3C", display: "flex", alignItems: "center", justifyContent: "center" }}><X className="w-4 h-4" /></button>
      </div>
      <div className="flex" style={{ gap: 6, padding: "0 20px 8px" }}>{[1, 2, 3].map((n) => <span key={n} style={{ flex: 1, height: 4, borderRadius: 999, background: n <= step ? BRAND : "#3A3A3C" }} />)}</div>
      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto flex flex-col" style={{ maxWidth: 980, padding: "12px 20px 28px", gap: 14 }}>
          {step === 1 ? body1 : step === 2 ? body2 : body3}
          {error && <Banner color={RED} onDismiss={() => setError(null)}>{error}</Banner>}
        </div>
      </div>
      <div className="flex items-center" style={{ padding: "12px 20px", borderTop: `0.5px solid ${W.sep}`, background: "rgba(28,28,30,0.95)", gap: 12 }}>
        {step > 1 && <button onClick={() => setStep(step - 1)} disabled={busy} aria-label="Atrás" className="apple-press disabled:opacity-40" style={{ width: 56, height: 56, borderRadius: 999, background: "#3A3A3C", display: "flex", alignItems: "center", justifyContent: "center" }}><ChevronLeft className="w-6 h-6" /></button>}
        <span className="flex-1" />
        {step === 2 && <button onClick={() => canAdvance2 && setStep(3)} disabled={!canAdvance2} aria-label="Siguiente" className="apple-press" style={{ width: 56, height: 56, borderRadius: 999, background: canAdvance2 ? BRAND : "#3A3A3C", color: canAdvance2 ? "#fff" : W.sub, display: "flex", alignItems: "center", justifyContent: "center" }}><ChevronRight className="w-6 h-6" /></button>}
        {step === 3 && <button onClick={create} disabled={busy || !lines.length} className="apple-press flex items-center justify-center gap-2 disabled:opacity-50" style={{ height: 56, padding: "0 28px", borderRadius: 999, background: BRAND, color: "#fff", fontSize: 17, fontWeight: 700 }}>{busy ? <><Loader2 className="w-5 h-5 animate-spin" /> Creando…</> : <><Check className="w-5 h-5" /> Crear orden</>}</button>}
      </div>

      {proc && (
        <div className="fixed inset-0 flex flex-col items-center justify-center text-center" style={{ zIndex: 460, background: "rgba(0,0,0,0.85)", gap: 10 }}>
          <Loader2 className="w-10 h-10 animate-spin" style={{ color: BRAND }} />
          <p style={{ fontSize: 20, fontWeight: 800 }}>{proc === "uploading" ? "Subiendo factura…" : "Analizando con Smart IA…"}</p>
          <p style={{ fontSize: 14, color: W.sub }}>{proc === "uploading" ? "Conectando con el servidor" : "Reconociendo productos y precios"}</p>
        </div>
      )}
      {success && (
        <div className="fixed inset-0 flex flex-col items-center justify-center text-center" style={{ zIndex: 470, background: "rgba(0,0,0,0.88)", gap: 10, padding: 24 }}>
          {success.expenseFailed ? <AlertTriangle className="w-16 h-16" style={{ color: "#FFA640" }} /> : <BadgeCheck className="w-20 h-20" style={{ color: GREEN }} />}
          <p style={{ fontSize: 26, fontWeight: 800 }}>¡Orden creada!</p>
          <p style={{ fontSize: 16, color: W.sub }}>{success.po.po_number} · {money(total)}</p>
          {success.expenseFailed
            ? <><p style={{ fontSize: 14, color: "#FFA640", maxWidth: 380 }}>La orden se creó, pero el gasto no se registró en Finanzas. Agrégalo manualmente en Gastos para no descuadrar el mes.</p><button onClick={() => onClose(true)} className="apple-press" style={{ marginTop: 10, padding: "12px 28px", borderRadius: 999, background: BRAND, fontWeight: 700 }}>Entendido</button></>
            : <p style={{ fontSize: 14, color: GREEN }}>Gasto registrado automáticamente</p>}
          {delayed && !success.expenseFailed && <p style={{ fontSize: 13, color: W.sub }}>Fecha estimada del cheque: +{delayedDays(method)} días</p>}
        </div>
      )}
      <SupplierEditDialog open={!!supForm} tenantId={tenantId} supplier={supForm && supForm.id ? supForm : null} onClose={() => setSupForm(null)}
        onSaved={(s) => { if (!s) return; const editing = !!supForm?.id; setSuppliers((p) => { const i = p.findIndex((x) => x.id === s.id); return i >= 0 ? p.map((x) => (x.id === s.id ? s : x)) : [...p, s].sort((a, b) => String(a.name).localeCompare(String(b.name))); }); if (!editing) { setSupplier(s); setManualName(""); } else if (supplier?.id === s.id) setSupplier(s); }} />
      <UploadSheet open={uploadOpen} onClose={() => setUploadOpen(false)} onFile={processFile} />
      <LinkSheet open={linkOpen} initial={invoiceLink} onClose={() => setLinkOpen(false)} onSave={processLink} />
      <ProductPicker open={!!picker} products={products} initialQuery={picker?.query} allowClear={picker?.allowClear} onClose={() => setPicker(null)}
        onPick={(p) => (picker?.lineId ? linkLine(picker.lineId, p) : addFromInventory(p))} onClear={() => picker?.lineId && unlinkLine(picker.lineId)} />
      <OrderPicker open={!!woPicker} tenantId={tenantId} allowClear={woPicker?.allowClear} onClose={() => setWoPicker(null)} onPick={(o) => woPicker && setWo(woPicker.lineId, o)} onClear={() => woPicker && setWo(woPicker.lineId, null)} />
      <AlertDialog open={!!delSup} title={`¿Borrar ${delSup?.name || ""}?`} message="Las órdenes ya creadas mantienen el suplidor. Solo se oculta para nuevas compras." onClose={() => setDelSup(null)}
        actions={[{ label: "Cancelar" }, { label: "Borrar suplidor", destructive: true, onPress: () => delSup && doDeleteSupplier(delSup) }]} />
      <AlertDialog open={confirmClose} title="¿Descartar orden de compra?" message="Se perderán los productos y datos que ingresaste. Esta acción no se puede deshacer." onClose={() => setConfirmClose(false)}
        actions={[{ label: "Descartar", destructive: true, onPress: () => onClose(false) }, { label: "Continuar editando", bold: true }]} />
    </Overlay>
  );
}
