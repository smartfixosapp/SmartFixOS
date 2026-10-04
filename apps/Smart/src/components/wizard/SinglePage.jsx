import { useEffect, useMemo, useRef, useState } from "react";
import { X, Search, Loader2, UserRound, RefreshCw, Check, Trash2, Plus, Images, Camera, Home, MapPin, ClipboardList, Zap, PhoneOutgoing, LockOpen, ShieldCheck, ChevronRight } from "lucide-react";
import { Dialog, TextAction, tint } from "@/components/pos/native/posUi";
import { CustomerSelectorDialog } from "@/components/pos/native/Dialogs";
import { searchOrdersForWarranty } from "@/lib/wizard/api";
import { statusInfo } from "@/lib/orderStatus";
import { tacLookup } from "@/lib/wizard/tac";
import { IOS, CARRIERS, UNLOCK_TYPES, MODES, cartTotals } from "@/lib/wizard/helpers";
import { Avatar, Banner, Caption, Card, Chip, Input, Switch, TextArea, W, money } from "./ui";
import { AddItemDialog } from "./StepProblem";
import { usePhotoAdder } from "./StepPhotos";

export function CustomerCard({ w, tenantId, allowAnonymous }) {
  const { s, set } = w;
  const [open, setOpen] = useState(false);
  return (
    <Card style={{ padding: 14 }}>
      <Caption style={{ paddingBottom: 8 }}>Cliente</Caption>
      {s.customer ? (
        <button onClick={() => setOpen(true)} className="apple-press w-full flex items-center gap-3 text-left">
          <Avatar name={s.customer.name} color={IOS.green} size={44} />
          <span className="flex-1 min-w-0"><span className="block truncate" style={{ fontSize: 16, fontWeight: 700 }}>{s.customer.name}</span><span className="block" style={{ fontSize: 13, color: W.sub }}>{s.customer.phone || s.customer.email || ""}</span></span>
          <RefreshCw className="w-4 h-4" style={{ color: W.sub }} />
        </button>
      ) : (
        <div className="flex flex-col" style={{ gap: 10 }}>
          <button onClick={() => setOpen(true)} className="apple-press flex items-center gap-2 justify-center" style={{ padding: "12px 0", borderRadius: 12, background: tint(IOS.blue, 0.15), color: IOS.blue, fontWeight: 700 }}><UserRound className="w-4 h-4" /> Buscar o crear cliente</button>
          {allowAnonymous && <div className="flex items-center gap-3"><span className="flex-1" style={{ fontSize: 14 }}>Continuar sin cliente (anónimo)</span><Switch on={s.anonymous} onChange={(v) => set({ anonymous: v, customer: v ? null : s.customer })} color={IOS.green} label="Cliente anónimo" /></div>}
        </div>
      )}
      <CustomerSelectorDialog open={open} tenantId={tenantId} selected={s.customer} onClose={() => setOpen(false)} onSelect={(c) => set({ customer: c, anonymous: false })} />
    </Card>
  );
}

function VisitAddress({ w }) {
  const { s, set } = w;
  if (s.serviceType !== "visit") return null;
  return (
    <Card style={{ padding: 14 }}>
      <TextArea label="Dirección de la visita" value={s.appointmentLocation} onChange={(v) => set({ appointmentLocation: v })} placeholder="Ej. 123 Calle Principal, San Juan, PR 00901" rows={3} />
      <p style={{ fontSize: 12, color: W.sub, marginTop: 6 }}>Indica dónde realizaremos la visita técnica.</p>
    </Card>
  );
}

function BottomActions({ label, busy, canCreate, missing, onCreate, onCreateOnly }) {
  return (
    <div className="flex flex-col" style={{ gap: 8, position: "sticky", bottom: 0, zIndex: 5, padding: "12px 0 8px", background: "linear-gradient(180deg, rgba(0,0,0,0), #000 28%)" }}>
      {!canCreate && missing.length > 0 && <p style={{ fontSize: 12, color: W.sub }}>Falta: {missing.join(", ")}</p>}
      <button onClick={onCreate} disabled={!canCreate || busy} className="apple-press flex items-center justify-center gap-2 disabled:opacity-40" style={{ height: 54, borderRadius: 16, background: IOS.green, color: "#fff", fontSize: 17, fontWeight: 700 }}>{busy ? <><Loader2 className="w-5 h-5 animate-spin" /> Creando…</> : label}</button>
      <button onClick={onCreateOnly} disabled={!canCreate || busy} className="disabled:opacity-40" style={{ fontSize: 14, color: IOS.orange, padding: 6 }}>Solo registrar (cobrar después)</button>
    </div>
  );
}

export function RechargePage({ w, tenantId, products, busy, onCreate, hint }) {
  const { s, set } = w;
  const [adding, setAdding] = useState(false);
  const phoneOk = s.rechargePhone.replace(/\D/g, "").length >= 7;
  const canCreate = (!!s.customer || s.anonymous) && phoneOk && s.cart.length > 0 && (s.serviceType !== "visit" || !!s.appointmentLocation.trim());
  const missing = [!(s.customer || s.anonymous) && "Cliente", !phoneOk && "Número", !s.cart.length && "Plan o monto"].filter(Boolean);
  return (
    <div className="mx-auto flex flex-col" style={{ gap: 14, maxWidth: 720 }}>
      <CustomerCard w={w} tenantId={tenantId} allowAnonymous />
      <Card style={{ padding: 14 }}>
        <Caption style={{ paddingBottom: 8 }}>Número a recargar</Caption>
        <div className="flex items-center gap-2"><Input value={s.rechargePhone} onChange={(v) => set({ rechargePhone: v })} placeholder="10 dígitos…" inputMode="tel" mono style={{ flex: 1 }} />{phoneOk && <Check className="w-5 h-5" style={{ color: IOS.green }} />}</div>
        {s.rechargePhone && !phoneOk && <p style={{ fontSize: 12, color: IOS.orange, marginTop: 6 }}>Mínimo 7 dígitos</p>}
      </Card>
      <Card style={{ padding: 14 }}>
        <Caption style={{ paddingBottom: 8 }}>Operadora</Caption>
        <div className="flex flex-wrap" style={{ gap: 8 }}>{CARRIERS.map((c) => <Chip key={c} label={c} active={s.rechargeCarrier === c} color={IOS.green} onClick={() => set({ rechargeCarrier: s.rechargeCarrier === c ? "" : c })} />)}</div>
        {s.rechargeCarrier === "Otro" && <div style={{ marginTop: 10 }}><Input value={s.rechargeCarrierOther} onChange={(v) => set({ rechargeCarrierOther: v })} placeholder="Nombre de la operadora…" /></div>}
      </Card>
      <Card style={{ padding: 14 }}>
        <Caption style={{ paddingBottom: 8 }}>Plan o monto</Caption>
        <button onClick={() => setAdding(true)} className="apple-press flex items-center justify-center gap-2" style={{ width: "100%", padding: "11px 0", borderRadius: 12, background: tint(IOS.green, 0.15), color: IOS.green, fontWeight: 700 }}><Plus className="w-4 h-4" /> {s.cart.length ? "Añadir otro" : "Añadir plan o monto"}</button>
        <p style={{ fontSize: 12, color: W.sub, margin: "8px 0" }}>Elige el plan del catálogo o usa “Añadir manualmente” para escribir el monto.</p>
        {s.cart.map((l) => <div key={l.key} className="flex items-center gap-2" style={{ padding: "6px 0" }}><span className="flex-1 truncate" style={{ fontSize: 14 }}>{l.product.name} × {l.quantity}</span><span style={{ fontWeight: 700 }}>{money(l.unitPrice * l.quantity)}</span><button onClick={() => w.setQuantity(l.key, 0)} aria-label="Quitar" style={{ color: IOS.red }}><Trash2 className="w-4 h-4" /></button></div>)}
        {s.cart.length > 0 && <div className="flex justify-between" style={{ borderTop: `0.5px solid ${W.sep}`, marginTop: 6, paddingTop: 8, fontSize: 16, fontWeight: 800 }}><span>Total</span><span style={{ color: IOS.green }}>{money(cartTotals(s.cart).total)}</span></div>}
      </Card>
      <VisitAddress w={w} />
      {hint}
      <BottomActions label="Registrar y Cobrar" busy={busy} canCreate={canCreate} missing={missing} onCreate={() => onCreate(true)} onCreateOnly={() => onCreate(false)} />
      <AddItemDialog open={adding} onClose={() => setAdding(false)} products={products} sel={{}} servicesOnly onPick={(p) => w.addItem(p)} />
    </div>
  );
}

export function UnlockPage({ w, tenantId, products, busy, onCreate, hint }) {
  const { s, set } = w;
  const [adding, setAdding] = useState(false);
  const galleryRef = useRef(null);
  const cameraRef = useRef(null);
  const addPhotos = usePhotoAdder({ tenantId, w, max: 8, key: "unlockPhotos", warm: false });
  const digits = s.imei.replace(/\D/g, "");
  const imeiOk = digits.length >= 14 && digits.length <= 15;
  const tacRef = useRef("");
  useEffect(() => {
    if (digits.length < 14) { if (s.imeiAutoFilled) set({ imeiAutoFilled: false }); tacRef.current = ""; return; }
    if (tacRef.current === digits) return;
    tacRef.current = digits;
    const hit = tacLookup(digits);
    if (hit) set({ unlockBrand: hit.brand, unlockModel: hit.model, imeiAutoFilled: true });
  }, [digits]);
  const canCreate = !!s.customer && imeiOk && !!s.unlockType && s.cart.length > 0 && (s.serviceType !== "visit" || !!s.appointmentLocation.trim());
  const missing = [!s.customer && "Cliente", !imeiOk && "IMEI", !s.unlockType && "Tipo de desbloqueo", !s.cart.length && "Precio"].filter(Boolean);
  return (
    <div className="mx-auto flex flex-col" style={{ gap: 14, maxWidth: 720 }}>
      <CustomerCard w={w} tenantId={tenantId} allowAnonymous={false} />
      <Card style={{ padding: 14 }}>
        <Caption style={{ paddingBottom: 8 }}>Equipo</Caption>
        <div className="flex flex-col" style={{ gap: 12 }}>
          <div>
            <div className="flex items-center" style={{ marginBottom: 4 }}><span className="flex-1" style={{ fontSize: 12, fontWeight: 600, color: W.sub }}>IMEI *</span><span style={{ fontSize: 12, fontWeight: 700, color: imeiOk ? IOS.green : digits.length ? IOS.orange : W.sub }}>{digits.length}/15</span></div>
            <Input value={s.imei} onChange={(v) => set({ imei: v })} placeholder="000000000000000" inputMode="numeric" mono />
            {digits.length > 15 && <p style={{ fontSize: 12, color: IOS.orange, marginTop: 4 }}>El IMEI tiene 15 dígitos. Marca *#06#</p>}
          </div>
          {s.imeiAutoFilled && <Banner color={IOS.green}>Equipo identificado automáticamente</Banner>}
          <Input label="Compañía bloqueada *" value={s.unlockCarrier} onChange={(v) => set({ unlockCarrier: v })} placeholder="Ej: AT&T, T-Mobile, Claro…" />
          <div className="grid grid-cols-2" style={{ gap: 12 }}>
            <Input label="Marca" value={s.unlockBrand} onChange={(v) => set({ unlockBrand: v })} placeholder="Apple, Samsung…" />
            <Input label="Modelo" value={s.unlockModel} onChange={(v) => set({ unlockModel: v })} placeholder="iPhone 15, Galaxy S24…" />
          </div>
        </div>
      </Card>
      <Card style={{ padding: 14 }}>
        <Caption style={{ paddingBottom: 8 }}>Tipo de desbloqueo</Caption>
        <div className="flex flex-col" style={{ gap: 8 }}>
          {Object.entries(UNLOCK_TYPES).map(([k, t]) => {
            const on = s.unlockType === k;
            return (
              <button key={k} onClick={() => set({ unlockType: k })} className="apple-press flex items-center gap-3 text-left" style={{ padding: 12, borderRadius: 12, background: on ? tint(t.color, 0.14) : W.card2, border: `1px solid ${on ? t.color : "transparent"}` }}>
                <span style={{ width: 20, height: 20, borderRadius: 999, border: `2px solid ${on ? t.color : W.sub}`, display: "flex", alignItems: "center", justifyContent: "center" }}>{on && <span style={{ width: 10, height: 10, borderRadius: 999, background: t.color }} />}</span>
                <span><span className="block" style={{ fontSize: 15, fontWeight: 600 }}>{t.label}</span><span className="block" style={{ fontSize: 12, color: W.sub }}>{t.description}</span></span>
              </button>
            );
          })}
        </div>
      </Card>
      <Card style={{ padding: 14 }}>
        <Caption style={{ paddingBottom: 8 }}>Precio</Caption>
        <button onClick={() => setAdding(true)} className="apple-press flex items-center justify-center gap-2" style={{ width: "100%", padding: "11px 0", borderRadius: 12, background: tint(IOS.green, 0.15), color: IOS.green, fontWeight: 700 }}><Plus className="w-4 h-4" /> {s.cart.length ? "Añadir otro" : "Añadir servicio o monto"}</button>
        <p style={{ fontSize: 12, color: W.sub, margin: "8px 0" }}>Elígelo del catálogo de servicios o usa “Añadir manualmente” para escribir el monto.</p>
        {s.cart.map((l) => <div key={l.key} className="flex items-center gap-2" style={{ padding: "6px 0" }}><span className="flex-1 truncate" style={{ fontSize: 14 }}>{l.product.name} × {l.quantity}</span><span style={{ fontWeight: 700 }}>{money(l.unitPrice * l.quantity)}</span><button onClick={() => w.setQuantity(l.key, 0)} aria-label="Quitar" style={{ color: IOS.red }}><Trash2 className="w-4 h-4" /></button></div>)}
        {s.cart.length > 0 && <div className="flex justify-between" style={{ borderTop: `0.5px solid ${W.sep}`, marginTop: 6, paddingTop: 8, fontSize: 16, fontWeight: 800 }}><span>Total</span><span style={{ color: IOS.green }}>{money(cartTotals(s.cart).total)}</span></div>}
      </Card>
      <VisitAddress w={w} />
      <Card style={{ padding: 14 }}>
        <Caption style={{ paddingBottom: 8 }}>Foto (opcional)</Caption>
        <input ref={galleryRef} type="file" accept="image/*" multiple className="hidden" onChange={(e) => { addPhotos(e.target.files); e.target.value = ""; }} />
        <input ref={cameraRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => { addPhotos(e.target.files); e.target.value = ""; }} />
        <div className="flex" style={{ gap: 10 }}>
          <button onClick={() => galleryRef.current?.click()} disabled={s.unlockPhotos.length >= 8} className="apple-press flex-1 flex items-center justify-center gap-2 disabled:opacity-40" style={{ padding: "10px 0", borderRadius: 12, background: W.card2, fontWeight: 600 }}><Images className="w-4 h-4" /> Galería</button>
          <button onClick={() => cameraRef.current?.click()} disabled={s.unlockPhotos.length >= 8} className="apple-press flex-1 flex items-center justify-center gap-2 disabled:opacity-40" style={{ padding: "10px 0", borderRadius: 12, background: W.card2, fontWeight: 600 }}><Camera className="w-4 h-4" /> Cámara</button>
        </div>
        {s.unlockPhotos.length > 0 && <div className="flex flex-wrap" style={{ gap: 8, marginTop: 10 }}>{s.unlockPhotos.map((p) => <span key={p.id} className="relative"><img src={p.preview} alt="" style={{ width: 76, height: 76, borderRadius: 10, objectFit: "cover" }} /><button onClick={() => set((prev) => ({ unlockPhotos: prev.unlockPhotos.filter((x) => x.id !== p.id) }))} aria-label="Quitar foto" className="absolute" style={{ top: 4, right: 4, width: 20, height: 20, borderRadius: 999, background: "rgba(0,0,0,0.65)", display: "flex", alignItems: "center", justifyContent: "center" }}><X className="w-3 h-3" /></button></span>)}</div>}
      </Card>
      {hint}
      <BottomActions label="Registrar y Cobrar" busy={busy} canCreate={canCreate} missing={missing} onCreate={() => onCreate(true)} onCreateOnly={() => onCreate(false)} />
      <AddItemDialog open={adding} onClose={() => setAdding(false)} products={products} sel={{}} servicesOnly onPick={(p) => w.addItem(p)} />
    </div>
  );
}

export function WarrantySearchDialog({ open, tenantId, onClose, onPick }) {
  const [rows, setRows] = useState(null);
  const [q, setQ] = useState("");
  const [error, setError] = useState(null);
  const [debounced, setDebounced] = useState("");
  useEffect(() => { if (open) { setQ(""); setDebounced(""); setError(null); setRows(null); searchOrdersForWarranty(tenantId).then(setRows, (e) => { setError(e?.message || String(e)); setRows([]); }); } }, [open, tenantId]);
  useEffect(() => { const t = setTimeout(() => setDebounced(q.trim().toLowerCase()), 250); return () => clearTimeout(t); }, [q]);
  const results = useMemo(() => (debounced ? (rows || []).filter((o) => String(o.order_number || "").toLowerCase().includes(debounced) || String(o.customer_name || "").toLowerCase().includes(debounced)) : []), [rows, debounced]);
  const device = (o) => { const seen = new Set(); return [o.device_brand, o.device_family, o.device_model].filter(Boolean).join(" ").split(/\s+/).filter((x) => { const k = x.toLowerCase(); if (seen.has(k)) return false; seen.add(k); return true; }).join(" "); };
  return (
    <Dialog open={open} onClose={onClose} title="Garantías" width={520} height="80dvh" leading={<TextAction onClick={onClose}>Cancelar</TextAction>} trailing={null}>
      <Caption style={{ padding: "10px 0 6px" }}>Buscar la orden original</Caption>
      <label className="flex items-center gap-2" style={{ height: 44, padding: "0 12px", borderRadius: 12, background: W.card2 }}>
        <Search className="w-4 h-4" style={{ color: W.sub }} />
        <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Número o nombre del cliente" className="flex-1 bg-transparent outline-none" style={{ color: "#fff", fontSize: 16 }} />
      </label>
      <p style={{ fontSize: 12, color: W.sub, padding: "6px 4px" }}>Busca la orden que ya se entregó y que el cliente trae de vuelta.</p>
      {rows === null && <div className="flex justify-center" style={{ padding: 20 }}><Loader2 className="w-5 h-5 animate-spin" style={{ color: W.sub }} /></div>}
      {error && <p style={{ color: IOS.red, fontSize: 13 }}>{error}</p>}
      {results.length > 0 && (
        <>
          <Caption style={{ padding: "8px 0" }}>Resultados</Caption>
          <div style={{ borderRadius: 12, background: W.card2, overflow: "hidden" }}>
            {results.map((o, i) => (
              <button key={o.id} onClick={() => onPick(o)} className="w-full flex items-center gap-3 text-left" style={{ padding: "12px 14px", borderTop: i ? `0.5px solid ${W.sep}` : "none" }}>
                <span className="flex-1 min-w-0">
                  <span className="flex items-center gap-2"><span style={{ fontSize: 12, color: W.sub }}>{o.order_number}</span><span style={{ padding: "1px 7px", borderRadius: 999, background: tint(statusInfo(o.status).color || IOS.blue, 0.18), color: statusInfo(o.status).color || IOS.blue, fontSize: 10, fontWeight: 700 }}>{statusInfo(o.status).label}</span></span>
                  <span className="block truncate" style={{ fontSize: 15, fontWeight: 600 }}>{o.customer_name}</span>
                  <span className="block truncate" style={{ fontSize: 12, color: W.sub }}>{device(o)}</span>
                </span>
                <ChevronRight className="w-4 h-4" style={{ color: W.ter }} />
              </button>
            ))}
          </div>
        </>
      )}
    </Dialog>
  );
}

const MODE_CARDS = [
  ["regular", "Intake completo", ["8 pasos", "Fotos", "Firma", "Estimado"], ClipboardList],
  ["quick", "Cambio exprés", ["5 pasos", "Sin fotos", "Directo"], Zap],
  ["recharge", "Recarga telefónica", ["1 página", "Cliente", "Cobrar"], PhoneOutgoing],
  ["unlock", "Desbloqueo de equipo", ["1 página", "IMEI", "Precio"], LockOpen],
];

export function ModeSelection({ onPick, onCancel, onWarranty }) {
  const [service, setService] = useState(null);
  const svcCard = (k, label, Icon, color) => (
    <button key={k} onClick={() => setService(k)} className="apple-press flex-1 flex items-center justify-center gap-2" style={{ padding: 16, borderRadius: 16, background: service === k ? tint(color, 0.12) : W.card, border: `2px solid ${service === k ? color : "transparent"}`, fontSize: 16, fontWeight: 700 }}><Icon className="w-5 h-5" style={{ color }} /> {label}</button>
  );
  return (
    <div className="mx-auto flex flex-col" style={{ gap: 18, maxWidth: 760, padding: "8px 16px 32px" }}>
      <div className="flex items-center gap-3">
        <span style={{ width: 44, height: 44, borderRadius: 12, background: IOS.orange, color: "#fff", display: "flex", alignItems: "center", justifyContent: "center" }}><ClipboardList className="w-6 h-6" /></span>
        <span><span className="block" style={{ fontSize: 24, fontWeight: 800 }}>Nueva orden</span><span className="block" style={{ fontSize: 14, color: W.sub }}>Selecciona servicio y modo</span></span>
      </div>
      <p style={{ fontSize: 15, fontWeight: 700 }}>¿Cómo se presta el servicio?</p>
      <div className="flex" style={{ gap: 12 }}>{svcCard("workshop", "En Taller", Home, IOS.blue)}{svcCard("visit", "Visita técnica", MapPin, IOS.orange)}</div>
      <div style={{ height: 0.5, background: W.sep }} />
      <p style={{ fontSize: 15, fontWeight: 700 }}>¿Qué tipo de trabajo es?</p>
      <div className="grid grid-cols-2" style={{ gap: 12, opacity: service ? 1 : 0.45 }}>
        {MODE_CARDS.map(([k, detail, feats, Icon]) => (
          <button key={k} disabled={!service} onClick={() => onPick(k, service)} className="apple-press flex flex-col text-left disabled:cursor-not-allowed" style={{ minHeight: 200, padding: 16, gap: 8, borderRadius: 18, background: W.card, border: `1px solid ${tint(MODES[k].color, 0.25)}` }}>
            <span style={{ width: 52, height: 52, borderRadius: 14, background: `linear-gradient(135deg, ${MODES[k].color}, ${tint(MODES[k].color, 0.6)})`, color: "#fff", display: "flex", alignItems: "center", justifyContent: "center" }}><Icon className="w-6 h-6" /></span>
            <span style={{ fontSize: 17, fontWeight: 800 }}>{MODES[k].label}</span>
            <span style={{ fontSize: 13, color: W.sub }}>{detail}</span>
            {feats.map((f) => <span key={f} className="flex items-center gap-1.5" style={{ fontSize: 12, color: W.sub }}><Check className="w-3 h-3" style={{ color: MODES[k].color }} /> {f}</span>)}
          </button>
        ))}
      </div>
      {!service && <p className="text-center" style={{ fontSize: 13, color: W.sub }}>Selecciona el tipo de servicio para continuar</p>}
      <button onClick={onWarranty} className="apple-press flex items-center gap-3 text-left" style={{ padding: 14, borderRadius: 16, background: W.card, border: `1.5px solid ${tint(IOS.green, 0.35)}` }}>
        <ShieldCheck className="w-6 h-6" style={{ color: IOS.green }} />
        <span className="flex-1"><span className="flex items-center gap-2" style={{ fontSize: 16, fontWeight: 700 }}>Garantías <span style={{ padding: "1px 8px", borderRadius: 999, background: IOS.green, color: "#fff", fontSize: 10 }}>Nuevo</span></span><span className="block" style={{ fontSize: 12, color: W.sub }}>Equipo de vuelta · busca la orden original</span></span>
        <ChevronRight className="w-4 h-4" style={{ color: W.ter }} />
      </button>
      <button onClick={onCancel} className="apple-press" style={{ padding: 14, borderRadius: 14, background: tint(IOS.red, 0.12), color: IOS.red, fontSize: 16, fontWeight: 700 }}>Cancelar</button>
    </div>
  );
}
