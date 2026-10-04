import { useEffect, useMemo, useRef, useState } from "react";
import QRCode from "qrcode";
import { Target, Repeat, CalendarClock, Percent, CreditCard, FileText, Banknote, Smartphone, Trash2, Plus, Check, ShoppingBag, Wrench, Loader2, Mail, MessageCircle, Printer } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Dialog, TextAction, tint } from "@/components/pos/native/posUi";
import { A, SubPage, Group, Row, ToggleRow, Field, PrimaryBtn, ErrorLine } from "./ui";
import { updateTenant, fetchTenantRow, settingsOf, paymentMethodsOf, posReciboOf, recurringOf, taxPercentOf, isPlanTeamOrAbove } from "@/lib/tenantSettings";
import { imageToJpegBlob } from "@/lib/comprasApi";

const uuid = () => (typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(16).slice(2)}`).toUpperCase();
const usd0 = (v) => `$${Math.round(v).toLocaleString("en-US")}`;
const usd = (v) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(Number(v) || 0);

export function FinanzasList({ tenant, go }) {
  const navigate = useNavigate();
  const items = recurringOf(tenant);
  const pm = paymentMethodsOf(tenant);
  const methods = [pm.cash && "Efectivo", pm.card && "Tarjeta", pm.ath && !pm.athHidden && "ATH Móvil"].filter(Boolean).join(" · ");
  const r = posReciboOf(tenant);
  const channels = [r.send_email && "Email", r.send_whatsapp && "WhatsApp", r.send_print && "Imprimir"].filter(Boolean).join(" · ");
  return (
    <SubPage title="Finanzas" onBack={() => go(null)}>
      <Group header="Dinero del taller" pad={false}>
        <Row first Icon={Target} color="#FF6482" title="Plan financiero" sub="Gastos, nómina y meta → mínimo diario" onClick={() => navigate("/Financial")} />
        <Row Icon={Repeat} color={A.danger} title="Gastos Fijos" sub={items.length ? `${items.length} gastos · ${usd0(items.reduce((s, i) => s + i.amount, 0))}/mes` : "Sin configurar"} onClick={() => go("finanzas", "gastos-fijos")} />
        <Row Icon={CalendarClock} color={A.vip} title="Nómina y Horario" sub="Pago, horas y calendario" locked={!isPlanTeamOrAbove(tenant)} onClick={() => navigate("/Equipo?tab=nomina")} />
        <Row Icon={Percent} color={A.warning} title="Impuesto (IVU)" sub={`${taxPercentOf(tenant).toFixed(1)}% — se edita en Info del Negocio`} onClick={() => go("mi-negocio", "info")} />
        <Row Icon={CreditCard} color={A.success} title="Métodos de Pago" sub={methods || "Ninguno habilitado"} onClick={() => go("finanzas", "metodos-pago")} />
        <Row Icon={FileText} color={A.warning} title="POS & Recibo" sub={channels || "Ningún canal habilitado"} onClick={() => go("finanzas", "pos-recibo")} />
      </Group>
    </SubPage>
  );
}

function QRSheet({ open, label, config, onClose, onChange }) {
  const [qrUrl, setQrUrl] = useState(null);
  const fileRef = useRef(null);
  const cfg = config || {};
  useEffect(() => {
    if (!open || !cfg.paymentURL) { setQrUrl(null); return; }
    QRCode.toDataURL(cfg.paymentURL, { width: 400, margin: 1 }).then(setQrUrl, () => setQrUrl(null));
  }, [open, cfg.paymentURL]);
  const image = cfg.imageBase64 ? `data:image/jpeg;base64,${cfg.imageBase64}` : null;
  const pick = async (file) => {
    if (!file) return;
    const blob = await imageToJpegBlob(file, 800);
    const b64 = await new Promise((resolve) => { const r = new FileReader(); r.onload = () => resolve(String(r.result).split(",")[1] || ""); r.readAsDataURL(blob); });
    onChange({ ...cfg, imageBase64: b64 });
  };
  const preview = image || qrUrl;
  return (
    <Dialog open={open} onClose={onClose} title={`QR de ${label}`} width={480} leading={<span />} trailing={<TextAction bold onClick={onClose}>Hecho</TextAction>}>
      <div className="flex flex-col" style={{ gap: 16, paddingTop: 8 }}>
        <p style={{ fontSize: 12, fontWeight: 700, letterSpacing: "0.06em", color: A.sub, textTransform: "uppercase" }}>Vista previa</p>
        {preview ? <img src={preview} alt="QR" style={{ maxWidth: 200, background: "#fff", borderRadius: 12, padding: 8, alignSelf: "center" }} /> : <p style={{ color: A.sub }}>Aún no hay QR configurado para este método</p>}
        <p style={{ fontSize: 12, fontWeight: 700, letterSpacing: "0.06em", color: A.sub, textTransform: "uppercase" }}>Opción A — Imagen del QR</p>
        <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; pick(f); }} />
        <button onClick={() => fileRef.current?.click()} className="apple-press" style={{ padding: "12px 0", borderRadius: 12, background: A.card2, color: A.brand, fontWeight: 700 }}>{cfg.imageBase64 ? "Cambiar imagen del QR" : "Subir imagen del QR"}</button>
        {cfg.imageBase64 && <button onClick={() => onChange({ ...cfg, imageBase64: undefined })} className="apple-press" style={{ padding: "12px 0", borderRadius: 12, background: tint(A.danger, 0.14), color: A.danger, fontWeight: 700 }}>Quitar imagen</button>}
        <p style={{ fontSize: 12, color: A.sub }}>Toma screenshot del QR de tu app (ATH Móvil, ATH Empresarial, Yappy, etc.) y súbelo. La app lo guarda y lo muestra tal cual al cobrar.</p>
        <p style={{ fontSize: 12, fontWeight: 700, letterSpacing: "0.06em", color: A.sub, textTransform: "uppercase" }}>Opción B — URL de pago</p>
        <textarea value={cfg.paymentURL || ""} onChange={(e) => onChange({ ...cfg, paymentURL: e.target.value.trim() || undefined })} rows={2} placeholder="https://paypal.me/tu-usuario  o  https://cash.app/$tu-tag" aria-label="URL de pago" className="outline-none" style={{ background: A.card2, color: "#fff", borderRadius: 12, padding: "12px 14px", fontSize: 15 }} />
        {cfg.paymentURL && <button onClick={() => onChange({ ...cfg, paymentURL: undefined })} className="apple-press" style={{ padding: "12px 0", borderRadius: 12, background: tint(A.danger, 0.14), color: A.danger, fontWeight: 700 }}>Quitar URL</button>}
        <p style={{ fontSize: 12, color: A.sub }}>Para procesadores que sí dan URL pública (PayPal.me, Stripe link, Cash App $cashtag, Venmo link…). La app genera el QR automáticamente. Si subes imagen Y URL, gana la imagen.</p>
      </div>
    </Dialog>
  );
}

const hasQR = (c) => !!(c && (c.imageBase64 || c.paymentURL));

export function MetodosPago({ tenant, tenantId, reload, back }) {
  const orig = useMemo(() => paymentMethodsOf(tenant), [tenant?.id]);
  const [d, setD] = useState(orig);
  const [newName, setNewName] = useState("");
  const [qr, setQr] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const valid = d.cash || d.card || d.ath || d.custom.some((c) => c.enabled);

  const setQrFor = (key, cfg) => {
    const clean = hasQR(cfg) ? { ...(cfg.imageBase64 ? { imageBase64: cfg.imageBase64 } : {}), ...(cfg.paymentURL?.trim() ? { paymentURL: cfg.paymentURL.trim() } : {}) } : null;
    if (key === "athQR") setD((p) => { const n = { ...p }; if (clean) n.athQR = clean; else delete n.athQR; return n; });
    else setD((p) => ({ ...p, custom: p.custom.map((c) => { if (c.id !== key) return c; const n = { ...c }; if (clean) n.qr = clean; else delete n.qr; return n; }) }));
  };
  const add = () => { const t = newName.trim(); if (!t) return; setD((p) => ({ ...p, custom: [...p.custom, { id: uuid(), label: t, enabled: true }] })); setNewName(""); };

  const save = async () => {
    if (!valid || busy) return;
    setBusy(true); setError(null);
    try {
      const out = { cash: d.cash, card: d.card, ath: d.ath, athHidden: d.athHidden, custom: d.custom.map((c) => ({ id: c.id, label: c.label, enabled: c.enabled, ...(hasQR(c.qr) ? { qr: c.qr } : {}) })) };
      if (hasQR(d.cashQR)) out.cashQR = d.cashQR;
      if (hasQR(d.cardQR)) out.cardQR = d.cardQR;
      if (hasQR(d.athQR)) out.athQR = d.athQR;
      await updateTenant({ tenantId, settingsEdits: { payment_methods: out }, baseSettings: { payment_methods: settingsOf(tenant).payment_methods } });
      await reload();
      back();
    } catch (e) { setError(`No se pudo guardar: ${e?.message || e}`); } finally { setBusy(false); }
  };

  const chip = (has, onClick) => <button onClick={onClick} className="apple-press" style={{ padding: "3px 10px", borderRadius: 999, background: has ? A.success : tint(A.brand, 0.12), color: has ? "#fff" : A.brand, border: has ? "none" : `1px solid ${tint(A.brand, 0.35)}`, fontSize: 12, fontWeight: 800 }}>{has ? "QR" : "+ QR"}</button>;
  const qrTarget = qr ? (qr.key === "athQR" ? { label: "ATH Móvil", cfg: d.athQR } : (() => { const c = d.custom.find((x) => x.id === qr.key); return { label: c?.label || "método", cfg: c?.qr }; })()) : null;
  return (
    <SubPage title="Métodos de Pago" onBack={back}>
      <Group header="Métodos base" icon={CreditCard} footer="Efectivo y Tarjeta son los métodos base de cualquier taller. Agrega métodos regionales o personalizados abajo." pad={false}>
        <ToggleRow first Icon={Banknote} color={A.success} title="Efectivo" sub="Dinero en efectivo en caja" on={d.cash} onChange={(v) => setD({ ...d, cash: v })} />
        <ToggleRow Icon={CreditCard} color="#0A84FF" title="Tarjeta" sub="Tarjeta de crédito o débito" on={d.card} onChange={(v) => setD({ ...d, card: v })} />
      </Group>
      {!d.athHidden ? (
        <Group header="Regional (Puerto Rico)" footer="Métodos según tu país. ATH Móvil es de Puerto Rico y acepta QR. Bórralo (basurero) si no lo usas." pad={false}>
          <div className="flex items-center gap-3" style={{ padding: "13px 16px" }}>
            <span style={{ width: 32, height: 32, borderRadius: 8, background: tint("#ED4A17", 0.16), color: "#ED4A17", display: "flex", alignItems: "center", justifyContent: "center" }}><Smartphone className="w-4 h-4" /></span>
            <span className="flex-1"><span className="block" style={{ fontSize: 16 }}>ATH Móvil</span><span className="block" style={{ fontSize: 12, color: A.sub }}>Pago vía ATH Móvil (Puerto Rico)</span></span>
            {chip(hasQR(d.athQR), () => setQr({ key: "athQR" }))}
            <button onClick={() => setD({ ...d, athHidden: true, ath: false })} aria-label="Quitar ATH Móvil" style={{ color: A.danger }}><Trash2 className="w-4 h-4" /></button>
            <button onClick={() => setD({ ...d, ath: !d.ath })} role="switch" aria-checked={d.ath} aria-label="ATH Móvil" style={{ width: 51, height: 31, borderRadius: 999, background: d.ath ? A.success : "#3A3A3C", position: "relative" }}><span style={{ position: "absolute", top: 2, left: d.ath ? 22 : 2, width: 27, height: 27, borderRadius: 999, background: "#fff", transition: "left 0.2s" }} /></button>
          </div>
        </Group>
      ) : (
        <Group pad={false}><Row first Icon={Smartphone} color="#ED4A17" title="Restaurar ATH Móvil" sub="Volverá a aparecer arriba como método habilitado." onClick={() => setD({ ...d, athHidden: false, ath: true })} /></Group>
      )}
      <Group header="Métodos personalizados" footer="Métodos extra que tu taller acepta (Apple Pay, Zelle, Venmo, ATH Empresarial…). El QR es opcional: úsalo solo en los que cobran por QR. Apple Pay / Google Pay no lo necesitan." pad={false}>
        {d.custom.map((c, i) => (
          <div key={c.id} className="flex items-center gap-3" style={{ padding: "12px 16px", borderTop: i ? `0.5px solid ${A.sep}` : "none" }}>
            <span style={{ width: 32, height: 32, borderRadius: 8, background: tint(A.vip, 0.16), color: A.vip, display: "flex", alignItems: "center", justifyContent: "center" }}><CreditCard className="w-4 h-4" /></span>
            <input value={c.label} onChange={(e) => setD({ ...d, custom: d.custom.map((x) => (x.id === c.id ? { ...x, label: e.target.value } : x)) })} placeholder="Nombre (Apple Pay, Cash App, PayPal…)" aria-label="Nombre del método" className="flex-1 bg-transparent outline-none" style={{ color: "#fff", fontSize: 16, minWidth: 0 }} />
            {chip(hasQR(c.qr), () => setQr({ key: c.id }))}
            <button onClick={() => setD({ ...d, custom: d.custom.filter((x) => x.id !== c.id) })} aria-label={`Eliminar ${c.label}`} style={{ color: A.danger }}><Trash2 className="w-4 h-4" /></button>
            <button onClick={() => setD({ ...d, custom: d.custom.map((x) => (x.id === c.id ? { ...x, enabled: !x.enabled } : x)) })} role="switch" aria-checked={c.enabled} aria-label={c.label} style={{ width: 51, height: 31, borderRadius: 999, background: c.enabled ? A.success : "#3A3A3C", position: "relative" }}><span style={{ position: "absolute", top: 2, left: c.enabled ? 22 : 2, width: 27, height: 27, borderRadius: 999, background: "#fff", transition: "left 0.2s" }} /></button>
          </div>
        ))}
        <div className="flex items-center gap-3" style={{ padding: "12px 16px", borderTop: d.custom.length ? `0.5px solid ${A.sep}` : "none" }}>
          <Plus className="w-5 h-5" style={{ color: A.success }} />
          <input value={newName} onChange={(e) => setNewName(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") add(); }} placeholder="Nombre del método personalizado" aria-label="Nuevo método" className="flex-1 bg-transparent outline-none" style={{ color: "#fff", fontSize: 16, minWidth: 0 }} />
          <button onClick={add} disabled={!newName.trim()} aria-label="Agregar método" className="apple-press disabled:opacity-40" style={{ width: 34, height: 34, borderRadius: 999, background: A.success, display: "flex", alignItems: "center", justifyContent: "center" }}><Check className="w-4 h-4" /></button>
        </div>
        {!d.custom.length && !newName && <p style={{ padding: "0 16px 14px", fontSize: 12, color: A.sub }}>Ej: Venmo, ATH Empresarial, Zelle, ApplePay…</p>}
      </Group>
      <ErrorLine message={error} />
      <PrimaryBtn onClick={save} busy={busy} disabled={!valid} color={A.success}>Guardar Métodos de Pago</PrimaryBtn>
      {!valid && <p style={{ fontSize: 12, color: A.danger }}>Debes tener al menos un método habilitado para poder cobrar.</p>}
      <QRSheet open={!!qr} label={qrTarget?.label || ""} config={qrTarget?.cfg} onClose={() => setQr(null)} onChange={(cfg) => setQrFor(qr.key, cfg)} />
    </SubPage>
  );
}

export function PosRecibo({ tenant, tenantId, reload, back }) {
  const orig = useMemo(() => posReciboOf(tenant), [tenant?.id]);
  const [d, setD] = useState(orig);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const s = settingsOf(tenant);
  const any = d.send_email || d.send_whatsapp || d.send_print;
  const sale = (d.sale_subject.trim() || "Tu recibo #{number}").replace(/\{number\}/g, "1024");
  const ord = (d.order_subject.trim() || "Tu orden #{number}").replace(/\{number\}/g, "WO-101");
  const save = async () => {
    if (!any || busy) return;
    setBusy(true); setError(null);
    try {
      await updateTenant({ tenantId, settingsEdits: { pos_recibo: { sale_subject: d.sale_subject, order_subject: d.order_subject, send_email: d.send_email, send_whatsapp: d.send_whatsapp, send_print: d.send_print } }, baseSettings: { pos_recibo: s.pos_recibo } });
      await reload();
      back();
    } catch (e) { setError(`No se pudo guardar: ${e?.message || e}`); } finally { setBusy(false); }
  };
  const tax = taxPercentOf(tenant);
  const line = (l, r) => <div className="flex justify-between"><span>{l}</span><span>{r}</span></div>;
  return (
    <SubPage title="POS & Recibo" onBack={back}>
      <Group header="Asuntos de email" footer="Usa `{number}` para que se reemplace por el número de venta u orden al enviar.">
        <div className="flex flex-col" style={{ gap: 14 }}>
          <div><p className="flex items-center gap-2" style={{ fontWeight: 600, marginBottom: 6 }}><ShoppingBag className="w-4 h-4" /> Recibo de Venta (POS)</p><Field value={d.sale_subject} onChange={(v) => setD({ ...d, sale_subject: v })} placeholder="Tu recibo de venta #{number}" /><p style={{ fontSize: 12, color: A.sub, marginTop: 4 }}>Ejemplo: &quot;{sale}&quot;</p></div>
          <div><p className="flex items-center gap-2" style={{ fontWeight: 600, marginBottom: 6 }}><Wrench className="w-4 h-4" /> Orden de Reparación</p><Field value={d.order_subject} onChange={(v) => setD({ ...d, order_subject: v })} placeholder="Tu orden de reparación #{number}" /><p style={{ fontSize: 12, color: A.sub, marginTop: 4 }}>Ejemplo: &quot;{ord}&quot;</p></div>
        </div>
      </Group>
      <Group header="Métodos de envío disponibles" footer="Elige qué opciones aparecen al finalizar una venta. Los canales que apagues no se mostrarán en el botón de envío." pad={false}>
        <ToggleRow first Icon={Mail} color={A.info} title="Email" sub="Envío de recibo por correo electrónico" on={d.send_email} onChange={(v) => setD({ ...d, send_email: v })} />
        <ToggleRow Icon={MessageCircle} color={A.success} title="WhatsApp" sub="Abre conversación con el recibo" on={d.send_whatsapp} onChange={(v) => setD({ ...d, send_whatsapp: v })} />
        <ToggleRow Icon={Printer} color={A.warning} title="Imprimir" sub="Impresora térmica o regular" on={d.send_print} onChange={(v) => setD({ ...d, send_print: v })} />
      </Group>
      <Group header="Vista previa · Recibo 80mm" footer="Así se ve el recibo en una impresora térmica de 80mm. El email usa este mismo asunto pero con diseño completo.">
        <div className="mx-auto" style={{ width: 260, background: "#fff", color: "#111", padding: 14, borderRadius: 6, fontFamily: "ui-monospace, Menlo, monospace", fontSize: 11 }}>
          <div className="text-center"><b style={{ fontSize: 13 }}>{tenant?.logo_url ? <img src={tenant.logo_url} alt="" style={{ maxHeight: 36, margin: "0 auto" }} /> : String(tenant?.name || "Mi Taller").toUpperCase()}</b>{s.slogan && <div>{s.slogan}</div>}{tenant?.admin_phone && <div>{tenant.admin_phone}</div>}</div>
          <div style={{ borderTop: "1px dashed #999", margin: "6px 0" }} />
          <div className="text-center"><b>RECIBO DE VENTA</b><div>Venta #1024 · {new Date().toLocaleDateString("es-PR")}</div></div>
          <div style={{ borderTop: "1px dashed #999", margin: "6px 0" }} />
          {line("1x Pantalla iPhone 15", "$250.00")}{line("1x Instalación", "$50.00")}{line("2x Cristal templado", "$19.98")}
          <div style={{ borderTop: "1px dashed #999", margin: "6px 0" }} />
          {line("Subtotal", "$319.98")}{line(`IVU ${tax}%`, usd(319.98 * tax / 100))}<b>{line("TOTAL", usd(319.98 * (1 + tax / 100)))}</b>
          <div className="text-center" style={{ marginTop: 8 }}>¡Gracias por tu compra!<div style={{ color: "#666" }}>{sale}</div></div>
        </div>
      </Group>
      <ErrorLine message={error} />
      <PrimaryBtn onClick={save} busy={busy} disabled={!any}>Guardar Configuración</PrimaryBtn>
      {!any && <p style={{ fontSize: 12, color: A.danger }}>Debes mantener al menos un canal de envío habilitado.</p>}
    </SubPage>
  );
}

const CATS = [["rent", "Renta"], ["utilities", "Servicios"], ["supplies", "Insumos"], ["marketing", "Marketing"], ["repairs", "Reparaciones"], ["taxes", "Impuestos"], ["other", "Otro"]];

export function GastosFijos({ tenant, tenantId, reload, back }) {
  const [items, setItems] = useState(() => recurringOf(tenant));
  const [sheet, setSheet] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [f, setF] = useState({ name: "", amount: "", category: "other", day: 1, notes: "" });

  const apply = async (op) => {
    setBusy(true); setError(null);
    try {
      const fresh = await fetchTenantRow(tenantId);
      const cur = recurringOf(fresh);
      const next = op.kind === "add" ? [...cur, op.item] : op.kind === "replace" ? cur.map((i) => (i.id === op.item.id ? { ...op.item, ...(i.last_confirmed_ym ? { last_confirmed_ym: i.last_confirmed_ym } : {}) } : i)) : cur.filter((i) => i.id !== op.id);
      const clean = next.map((i) => { const o = { id: i.id, name: i.name, amount: i.amount, category: i.category, day_of_month: i.day_of_month }; if (i.notes) o.notes = i.notes; if (i.last_confirmed_ym) o.last_confirmed_ym = i.last_confirmed_ym; return o; });
      await updateTenant({ tenantId, settingsEdits: { recurring_expenses: clean.length ? { items: clean } : null }, baseSettings: { recurring_expenses: fresh.settings?.recurring_expenses } });
      setItems(next);
      await reload();
      setSheet(null);
    } catch (e) { setError(`No se pudo guardar: ${e?.message || e}`); } finally { setBusy(false); }
  };

  const open = (item) => { setError(null); setF(item ? { name: item.name, amount: String(item.amount), category: item.category || "other", day: item.day_of_month, notes: item.notes || "" } : { name: "", amount: "", category: "other", day: 1, notes: "" }); setSheet({ item }); };
  const amount = Number(String(f.amount).replace(",", ".")) || 0;
  const submit = () => {
    if (!f.name.trim() || amount <= 0 || busy) return;
    const item = { id: sheet.item?.id || uuid(), name: f.name.trim(), amount, category: f.category, day_of_month: f.day, ...(f.notes.trim() ? { notes: f.notes.trim() } : {}) };
    apply({ kind: sheet.item ? "replace" : "add", item });
  };
  return (
    <SubPage title="Gastos Fijos" onBack={back} right={<button onClick={() => open(null)} aria-label="Agregar gasto" className="apple-press" style={{ width: 38, height: 38, borderRadius: 999, background: A.brand, display: "flex", alignItems: "center", justifyContent: "center" }}><Plus className="w-5 h-5" /></button>}>
      {!items.length ? (
        <div className="flex flex-col items-center text-center" style={{ padding: "50px 10px", gap: 8 }}>
          <Repeat className="w-10 h-10" style={{ color: A.sub }} /><b style={{ fontSize: 19 }}>Sin gastos fijos</b>
          <p style={{ color: A.sub, maxWidth: 320 }}>Agrega renta, internet, luz y otras facturas mensuales para que aparezcan en Finanzas cada mes.</p>
          <button onClick={() => open(null)} className="apple-press" style={{ marginTop: 8, padding: "12px 22px", borderRadius: 999, background: A.brand, color: "#fff", fontWeight: 700 }}>Agregar primer gasto</button>
        </div>
      ) : (
        <Group header={`Gastos configurados · ${items.length}`} footer="Toca para editar · Elimina con la papelera · Se confirman cada mes en Finanzas" pad={false}>
          {items.map((i, idx) => (
            <div key={i.id} className="flex items-center gap-3" style={{ padding: "12px 16px", borderTop: idx ? `0.5px solid ${A.sep}` : "none" }}>
              <button onClick={() => open(i)} className="apple-press flex items-center gap-3 flex-1 min-w-0 text-left"><span style={{ width: 36, height: 36, borderRadius: 10, background: tint(A.danger, 0.14), color: A.danger, display: "flex", alignItems: "center", justifyContent: "center" }}><Repeat className="w-4 h-4" /></span><span className="flex-1 min-w-0"><span className="block truncate" style={{ fontWeight: 600 }}>{i.name}</span><span className="block truncate" style={{ fontSize: 12, color: A.sub }}>Día {i.day_of_month}{i.notes ? ` · ${i.notes}` : ""}</span></span><b style={{ color: A.danger }}>{usd(i.amount)}</b></button>
              <button onClick={() => apply({ kind: "remove", id: i.id })} disabled={busy} aria-label={`Eliminar ${i.name}`} style={{ color: A.danger }}><Trash2 className="w-4 h-4" /></button>
            </div>
          ))}
        </Group>
      )}
      <ErrorLine message={!sheet ? error : null} />
      <Dialog open={!!sheet} onClose={() => !busy && setSheet(null)} dismissable={!busy} title={sheet?.item ? "Editar gasto fijo" : "Nuevo gasto fijo"} width={460} leading={<TextAction onClick={() => setSheet(null)} disabled={busy}>Cancelar</TextAction>} trailing={<TextAction bold onClick={submit} disabled={busy || !f.name.trim() || amount <= 0}>{busy ? <Loader2 className="w-4 h-4 animate-spin" /> : sheet?.item ? "Guardar" : "Agregar"}</TextAction>}>
        <div className="flex flex-col" style={{ gap: 14, paddingTop: 8 }}>
          <Field label="Nombre" value={f.name} onChange={(v) => setF({ ...f, name: v })} placeholder="Ej: Renta, Internet, Spotify..." />
          <Field label="Monto mensual" value={f.amount} onChange={(v) => { const r = v.replace(",", "."); if (/^\d*\.?\d{0,2}$/.test(r)) setF({ ...f, amount: r }); }} placeholder="$ 0.00" inputMode="decimal" />
          <div><p style={{ fontSize: 14, fontWeight: 600, marginBottom: 6 }}>Categoría</p><div style={{ borderRadius: 12, background: A.card2, overflow: "hidden" }}>{CATS.map(([k, l], i) => <button key={k} onClick={() => setF({ ...f, category: k })} className="apple-press w-full flex items-center text-left" style={{ padding: "11px 14px", borderTop: i ? `0.5px solid ${A.sep}` : "none" }}><span className="flex-1">{l}</span>{f.category === k && <Check className="w-4 h-4" style={{ color: A.brand }} strokeWidth={3} />}</button>)}</div></div>
          <div className="flex items-center gap-3"><span className="flex-1" style={{ fontWeight: 600 }}>Día del mes</span><button onClick={() => setF({ ...f, day: Math.max(1, f.day - 1) })} aria-label="Menos" style={{ width: 34, height: 34, borderRadius: 999, background: A.card2 }}>−</button><b style={{ minWidth: 60, textAlign: "center" }}>Día {f.day}</b><button onClick={() => setF({ ...f, day: Math.min(28, f.day + 1) })} aria-label="Más" style={{ width: 34, height: 34, borderRadius: 999, background: A.brand }}>+</button></div>
          <Field label="Notas (opcional)" value={f.notes} onChange={(v) => setF({ ...f, notes: v })} placeholder="Proveedor, contrato, etc." />
          <ErrorLine message={error} />
        </div>
      </Dialog>
    </SubPage>
  );
}

