import { useEffect, useMemo, useRef, useState } from "react";
import { X, Search, Loader2, Inbox, Users, Check, AlertTriangle, UsersRound, Crown, Building2, Clock, UserPlus } from "lucide-react";
import { Dialog, TextAction, Toggle } from "@/components/pos/native/posUi";
import NativeOrderRow from "@/components/orders/NativeOrderRow";
import { money } from "@/components/finanzas/ui";
import {
  displayName, num, emptyInput, inputFromCustomer, inputValid, createCustomerRow, updateCustomerRow, CustomerInputError, searchCustomersForPicker, recentOrdersFor,
  campaignContext, SEGMENTS, segmentRecipients, sendCampaign,
} from "@/lib/customersApi";

const CARD = "#2C2C2E";
const SUB = "#8E8E93";
const BRAND = "#F2662E";

export function OrderRow({ order, onClick }) {
  return <NativeOrderRow order={order} onClick={onClick} />;
}

export function HistoryDialog({ open, onClose, tenantId, customer, onOpenOrder }) {
  const [rows, setRows] = useState(null);
  useEffect(() => {
    if (!open || !customer) return;
    setRows(null);
    if (!customer.id && !customer.name) { setRows([]); return; }
    recentOrdersFor(tenantId, customer, 100).then(setRows, () => setRows([]));
  }, [open, customer?.id]);
  const total = (rows || []).reduce((s, o) => s + num(o.cost_estimate ?? o.labor_cost ?? 0), 0);
  return (
    <Dialog open={open} onClose={onClose} title="Historial del cliente" width={520} height="86dvh" leading={<span />} trailing={<TextAction bold onClick={onClose}>Cerrar</TextAction>}>
      {rows === null ? <p className="flex items-center justify-center gap-2" style={{ padding: 40, color: SUB }}><Loader2 className="w-4 h-4 animate-spin" /> Cargando historial…</p> : rows.length === 0 ? (
        <div className="flex flex-col items-center text-center" style={{ padding: 40, gap: 6 }}><Inbox className="w-9 h-9" style={{ color: "rgba(235,235,245,0.3)" }} /><p style={{ fontSize: 16, fontWeight: 600 }}>Sin historial</p><p style={{ fontSize: 13, color: SUB }}>Este cliente no tiene otras órdenes registradas.</p></div>
      ) : (
        <div className="flex flex-col" style={{ gap: 14, paddingTop: 8 }}>
          <div className="flex" style={{ gap: 10 }}>
            {[["ÓRDENES", String(rows.length), "#66B3FF"], ["TOTAL GASTADO", money(total), "#4DC780"]].map(([l, v, c]) => <div key={l} className="flex-1 flex flex-col" style={{ gap: 2, padding: 12, borderRadius: 12, background: CARD }}><span style={{ fontSize: 10, fontWeight: 700, color: SUB }}>{l}</span><span style={{ fontSize: 20, fontWeight: 800, color: c }}>{v}</span></div>)}
          </div>
          <p style={{ fontSize: 12, color: SUB, textTransform: "uppercase" }}>Otras órdenes</p>
          <div style={{ borderRadius: 12, background: CARD, overflow: "hidden" }}>{rows.map((o, i) => <div key={o.id} style={{ borderTop: i ? "0.5px solid rgba(84,84,88,0.6)" : "none" }}><OrderRow order={o} onClick={() => onOpenOrder?.(o.id)} /></div>)}</div>
        </div>
      )}
    </Dialog>
  );
}

function ReferrerPicker({ open, tenantId, onClose, onPick }) {
  const [q, setQ] = useState("");
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  useEffect(() => {
    if (!open) return undefined;
    setLoading(true);
    const t = setTimeout(() => searchCustomersForPicker(tenantId, q).then((r) => { setRows(r); setLoading(false); }, () => { setRows([]); setLoading(false); }), 250);
    return () => clearTimeout(t);
  }, [open, q, tenantId]);
  return (
    <Dialog open={open} onClose={onClose} title="Referido por" width={480} height="76dvh" leading={<TextAction onClick={onClose}>Cancelar</TextAction>} trailing={null}>
      <label className="flex items-center gap-2" style={{ height: 42, padding: "0 12px", borderRadius: 12, background: CARD, marginTop: 6 }}><Search className="w-4 h-4" style={{ color: SUB }} /><input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar nombre, teléfono, email" className="flex-1 bg-transparent outline-none" style={{ color: "#fff", fontSize: 15 }} /></label>
      {loading && <div className="flex justify-center" style={{ padding: 20 }}><Loader2 className="w-5 h-5 animate-spin" style={{ color: SUB }} /></div>}
      <div style={{ borderRadius: 12, background: CARD, overflow: "hidden", marginTop: 12 }}>
        {rows.map((c, i) => <button key={c.id} onClick={() => { onPick(c); onClose(); }} className="w-full text-left" style={{ padding: "11px 14px", borderTop: i ? "0.5px solid rgba(84,84,88,0.6)" : "none" }}><span className="block" style={{ fontSize: 15, fontWeight: 600 }}>{displayName(c)}</span><span className="block" style={{ fontSize: 12, color: SUB }}>{c.phone || c.email || ""}</span></button>)}
      </div>
    </Dialog>
  );
}

export function CustomerEditDialog({ open, onClose, tenantId, customer, onSaved }) {
  const isEdit = !!customer;
  const [input, setInput] = useState(emptyInput());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [pickRef, setPickRef] = useState(false);
  useEffect(() => { if (open) { setInput(customer ? inputFromCustomer(customer) : emptyInput()); setError(null); setBusy(false); } }, [open, customer?.id]);
  const set = (patch) => setInput((p) => ({ ...p, ...patch }));
  const save = async () => {
    if (busy || !inputValid(input)) return;
    setBusy(true);
    setError(null);
    try {
      const row = isEdit ? await updateCustomerRow(customer.id, tenantId, input) : await createCustomerRow(tenantId, input);
      onSaved?.(row);
      onClose();
    } catch (e) {
      setError(e instanceof CustomerInputError ? e.message : e?.message || String(e));
    }
    setBusy(false);
  };
  const field = (label, key, extra = {}) => (
    <input value={input[key]} onChange={(e) => set({ [key]: e.target.value })} placeholder={label} aria-label={label} type={extra.type || "text"} inputMode={extra.inputMode} className="w-full outline-none" style={{ background: CARD, color: "#fff", borderRadius: 12, padding: "12px 14px", fontSize: 16, colorScheme: "dark" }} />
  );
  const box = (children, footer) => <div><div style={{ borderRadius: 12, background: CARD, overflow: "hidden" }}>{children}</div>{footer && <p style={{ fontSize: 12, color: SUB, padding: "6px 4px 0" }}>{footer}</p>}</div>;
  const row = (children, top) => <div style={{ padding: "11px 14px", borderTop: top ? "0.5px solid rgba(84,84,88,0.6)" : "none" }}>{children}</div>;
  return (
    <>
      <Dialog open={open && !pickRef} onClose={onClose} title={isEdit ? "Editar Cliente" : "Nuevo Cliente"} width={560} height="92dvh" leading={<TextAction onClick={onClose}>Cancelar</TextAction>} trailing={<TextAction bold disabled={!inputValid(input) || busy} onClick={save}>{busy ? "Guardando…" : "Guardar"}</TextAction>}>
        <div className="flex flex-col" style={{ gap: 16, paddingTop: 8 }}>
          <div>
            <p style={{ fontSize: 12, color: SUB, textTransform: "uppercase", padding: "0 4px 6px" }}>Información básica</p>
            <div className="grid" style={{ gap: 10, gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))" }}>{field("Nombre *", "name")}{field("Apellido", "lastName")}{field("Teléfono *", "phone", { inputMode: "tel" })}{field("Correo electrónico", "email", { type: "email" })}</div>
          </div>
          {box(row(<div className="grid grid-cols-2" style={{ padding: 2, gap: 2, borderRadius: 9, background: "rgba(118,118,128,0.24)" }}>{[["es", "Español"], ["en", "English"]].map(([k, l]) => <button key={k} onClick={() => set({ language: k })} style={{ padding: "7px 0", borderRadius: 7, fontSize: 14, fontWeight: 600, background: input.language === k ? "#636366" : "transparent" }}>{l}</button>)}</div>), "Sus correos de la orden (listo para recoger, esperando piezas, etc.) saldrán en este idioma.")}
          {box(row(<textarea value={input.notes} onChange={(e) => set({ notes: e.target.value })} placeholder="Notas opcionales" rows={3} className="w-full bg-transparent outline-none" style={{ color: "#fff", fontSize: 16, resize: "vertical" }} />))}
          {box(<>
            {row(<div className="flex items-center"><span className="flex-1" style={{ fontSize: 16 }}>Cumpleaños</span><Toggle on={input.birthdayOn} onChange={(v) => set({ birthdayOn: v, birthday: v && !input.birthday ? new Date().toISOString().slice(0, 10) : input.birthday })} label="Cumpleaños" compact /></div>)}
            {input.birthdayOn && row(<label className="flex items-center"><span className="flex-1" style={{ fontSize: 16 }}>Fecha</span><input type="date" value={input.birthday} onChange={(e) => set({ birthday: e.target.value })} className="bg-transparent outline-none" style={{ color: "#fff", colorScheme: "dark" }} /></label>, true)}
          </>, "Te avisamos el día de su cumpleaños para que le mandes un saludo o descuento.")}
          {!isEdit && box(row(
            <div className="flex items-center gap-2">
              <button onClick={() => setPickRef(true)} className="flex-1 flex items-center gap-2 text-left" style={{ color: input.referrer ? "#fff" : SUB, fontSize: 16 }}><UsersRound className="w-4 h-4" /> {input.referrer ? displayName(input.referrer) : "Referido por"}</button>
              {input.referrer && <button onClick={() => set({ referrer: null })} aria-label="Quitar referido" style={{ color: SUB }}><X className="w-4 h-4" /></button>}
            </div>
          ), "Si un cliente lo refirió, le acreditamos 50 puntos de lealtad al guardar.")}
          {box(<>
            {row(<div className="flex items-center gap-2"><AlertTriangle className="w-4 h-4" style={{ color: "#FF7373" }} /><span className="flex-1" style={{ fontSize: 16 }}>Cliente riesgoso (lista negra)</span><Toggle on={input.riskFlag} onChange={(v) => set({ riskFlag: v })} label="Cliente riesgoso" compact /></div>)}
            {input.riskFlag && row(<textarea value={input.riskNote} onChange={(e) => set({ riskNote: e.target.value })} placeholder="Motivo (ej. no recogió WO-29, chargeback)" rows={2} className="w-full bg-transparent outline-none" style={{ color: "#fff", fontSize: 16, resize: "vertical" }} />, true)}
          </>, "Al abrir una orden nueva con este cliente, el sistema te avisará y sugerirá exigir prepago.")}
          {box(<>
            {row(<div className="flex items-center"><span className="flex-1" style={{ fontSize: 16 }}>Cliente empresarial (B2B)</span><Toggle on={input.isB2b} onChange={(v) => set({ isB2b: v })} label="Cliente empresarial" compact /></div>)}
            {input.isB2b && row(<div className="flex flex-col" style={{ gap: 10 }}>{field("Nombre de empresa", "companyName")}{field("Tax ID / RUC", "taxId")}{field("Email de facturación", "billingEmail", { type: "email" })}</div>, true)}
          </>)}
          {error && <p style={{ fontSize: 13, color: "#FF453A" }}>{error}</p>}
        </div>
      </Dialog>
      <ReferrerPicker open={open && pickRef} tenantId={tenantId} onClose={() => setPickRef(false)} onPick={(c) => set({ referrer: c })} />
    </>
  );
}

export function CampaignDialog({ open, onClose, tenantId, tenant, customers }) {
  const [segment, setSegment] = useState("inactive");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [lastMap, setLastMap] = useState(null);
  const [progress, setProgress] = useState(null);
  const [sending, setSending] = useState(false);
  const abortRef = useRef(null);
  useEffect(() => {
    if (!open) return;
    setLastMap(null);
    setProgress(null);
    campaignContext(tenantId).then(setLastMap, () => setLastMap({}));
  }, [open, tenantId]);
  const recipients = useMemo(() => (lastMap ? segmentRecipients(customers, segment, lastMap) : []), [customers, segment, lastMap]);
  const canSend = !sending && lastMap && recipients.length > 0 && subject.trim() && body.trim();
  const send = async () => {
    if (!canSend) return;
    setSending(true);
    abortRef.current = new AbortController();
    setProgress({ sent: 0, failed: 0, total: recipients.length });
    const r = await sendCampaign({ tenant, tenantId, recipients, subject: subject.trim(), body, onProgress: setProgress, signal: abortRef.current.signal });
    setProgress({ ...r, total: recipients.length });
    setSending(false);
  };
  const segIcon = { all: Users, vip: Crown, b2b: Building2, inactive: Clock, new: UserPlus };
  return (
    <Dialog open={open} onClose={() => { if (!sending) onClose(); }} dismissable={!sending} title="Campaña de email" width={600} height="92dvh"
      leading={<TextAction onClick={onClose} disabled={sending}>Cerrar</TextAction>} trailing={<TextAction bold disabled={!canSend} onClick={send}>{sending ? "Enviando…" : "Enviar"}</TextAction>}>
      <div className="flex flex-col" style={{ gap: 16, paddingTop: 8 }}>
        <div>
          <p style={{ fontSize: 12, color: SUB, textTransform: "uppercase", padding: "0 4px 6px" }}>Segmento</p>
          <div style={{ borderRadius: 12, background: CARD, overflow: "hidden" }}>
            {SEGMENTS.map(([k, label], i) => { const Icon = segIcon[k]; return (
              <button key={k} onClick={() => setSegment(k)} className="w-full flex items-center gap-3 text-left" style={{ padding: "12px 14px", borderTop: i ? "0.5px solid rgba(84,84,88,0.6)" : "none" }}>
                <Icon className="w-4 h-4" style={{ color: BRAND }} /><span className="flex-1" style={{ fontSize: 15 }}>{label}</span>{segment === k && <Check className="w-4 h-4" style={{ color: BRAND }} />}
              </button>
            ); })}
          </div>
          <p style={{ fontSize: 13, padding: "6px 4px 0", color: lastMap && recipients.length === 0 ? "#FFA640" : "#4DC780" }}>{lastMap ? `${recipients.length} clientes con email en este segmento` : "Calculando actividad…"}</p>
        </div>
        <div>
          <p style={{ fontSize: 12, color: SUB, textTransform: "uppercase", padding: "0 4px 6px" }}>Mensaje</p>
          <div style={{ borderRadius: 12, background: CARD, overflow: "hidden" }}>
            <input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Asunto" className="w-full bg-transparent outline-none" style={{ padding: "12px 14px", color: "#fff", fontSize: 16, borderBottom: "0.5px solid rgba(84,84,88,0.6)" }} />
            <textarea value={body} onChange={(e) => setBody(e.target.value)} placeholder="Mensaje" className="w-full bg-transparent outline-none" style={{ padding: "12px 14px", color: "#fff", fontSize: 16, minHeight: 140, resize: "vertical" }} />
          </div>
          <p style={{ fontSize: 12, color: SUB, padding: "6px 4px 0" }}>Usa {"{nombre}"} para que se reemplace con el nombre de cada cliente.</p>
        </div>
        {body.trim() && (
          <div><p style={{ fontSize: 12, color: SUB, textTransform: "uppercase", padding: "0 4px 6px" }}>Vista previa</p><div style={{ borderRadius: 12, background: CARD, padding: 14, fontSize: 14, whiteSpace: "pre-wrap" }}>{body.replace(/\{nombre\}/gi, "Juan")}</div></div>
        )}
        {progress && (
          <div><p style={{ fontSize: 12, color: SUB, textTransform: "uppercase", padding: "0 4px 6px" }}>Progreso</p>
            <div style={{ borderRadius: 12, background: CARD, padding: 14 }}>
              <div style={{ height: 6, borderRadius: 999, background: "#3A3A3C", overflow: "hidden" }}><div style={{ width: `${progress.total ? ((progress.sent + progress.failed) / progress.total) * 100 : 0}%`, height: "100%", background: BRAND }} /></div>
              <p style={{ fontSize: 13, color: SUB, marginTop: 8 }}>{progress.sent} enviados · {progress.failed} fallidos de {progress.total}</p>
            </div>
          </div>
        )}
      </div>
    </Dialog>
  );
}
