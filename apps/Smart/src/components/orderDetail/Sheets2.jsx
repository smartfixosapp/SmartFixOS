import React, { useEffect, useMemo, useRef, useState } from "react";
import { Eye, EyeOff, Star, MessageCircle, MessageSquare, Mail, ShieldCheck, Check, ChevronRight, Camera, ImagePlus, X } from "lucide-react";
import { C, tint, Sheet, Btn } from "./ui";

const inputStyle = { width: "100%", background: C.card2, color: C.text, borderRadius: 12, padding: "12px 14px", fontSize: 15, border: "none", outline: "none" };
const labelStyle = { fontSize: 13, fontWeight: 600, color: C.sub, margin: "14px 4px 6px", display: "block" };

function Field({ label, children }) {
  return (
    <label style={{ display: "block" }}>
      <span style={labelStyle}>{label}</span>
      {children}
    </label>
  );
}

function SecretInput({ value, onChange, placeholder, inputMode }) {
  const [show, setShow] = useState(false);
  return (
    <div className="relative">
      <input type={show ? "text" : "password"} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} inputMode={inputMode} style={{ ...inputStyle, paddingRight: 44 }} autoComplete="off" />
      <button type="button" onClick={() => setShow((s) => !s)} aria-label={show ? "Ocultar" : "Mostrar"} className="apple-press absolute" style={{ right: 10, top: "50%", transform: "translateY(-50%)", color: C.sub }}>
        {show ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
      </button>
    </div>
  );
}

function PatternGrid({ value, onChange }) {
  return (
    <div>
      <div className="grid grid-cols-3 gap-4" style={{ width: 200, margin: "8px auto" }}>
        {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => {
          const pos = value.indexOf(n);
          const on = pos >= 0;
          return (
            <button key={n} type="button" onClick={() => !on && onChange([...value, n])} className="apple-press"
              style={{ width: 52, height: 52, borderRadius: 999, background: on ? C.brand : C.card2, color: "#fff", fontWeight: 800, fontSize: 16, margin: "0 auto" }}>
              {on ? pos + 1 : ""}
            </button>
          );
        })}
      </div>
      <p className="text-center" style={{ fontSize: 13, color: C.sub }}>{value.length ? `Patrón: ${value.join("→")}` : "Toca los puntos en orden"}</p>
      {value.length > 0 && (
        <button type="button" onClick={() => onChange([])} className="apple-press w-full text-center" style={{ fontSize: 14, color: C.red, marginTop: 6 }}>Limpiar patrón</button>
      )}
    </div>
  );
}

export function SecuritySheet({ open, onClose, order, onSave }) {
  const sec = order?.device_security || {};
  const [pin, setPin] = useState("");
  const [password, setPassword] = useState("");
  const [pattern, setPattern] = useState([]);
  const [showPattern, setShowPattern] = useState(false);
  const [imei, setImei] = useState("");
  const [serial, setSerial] = useState("");
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (!open) return;
    setPin(sec.device_pin || "");
    setPassword(sec.device_password || "");
    const pv = Array.isArray(sec.pattern_vector) ? sec.pattern_vector.map((n) => parseInt(n, 10)).filter((n) => n >= 1 && n <= 9) : [];
    setPattern(pv);
    setShowPattern(pv.length > 0);
    setImei(sec.device_imei || "");
    setSerial(sec.device_serial || (!sec.device_imei ? order?.device_serial || "" : ""));
    setNotes(sec.notes || "");
  }, [open]);
  const save = async () => {
    const next = {};
    ["signature_url", "imei_check_result", "photo_exception_reason"].forEach((k) => { if (sec[k] !== undefined && sec[k] !== null && sec[k] !== "") next[k] = sec[k]; });
    if (pin.trim()) next.device_pin = pin.trim();
    if (password.trim()) next.device_password = password.trim();
    if (imei.trim()) next.device_imei = imei.trim();
    if (serial.trim()) next.device_serial = serial.trim();
    if (notes.trim()) next.notes = notes.trim();
    if (pattern.length) next.pattern_vector = pattern.map((n) => parseInt(n, 10));
    setBusy(true);
    try { await onSave(next, imei.trim() || serial.trim() || null); } finally { setBusy(false); }
  };
  return (
    <Sheet open={open} onClose={onClose} title="Editar seguridad" width={480}
      footer={<div className="flex gap-2"><Btn onClick={onClose} variant="secondary" style={{ flex: 1 }}>Cancelar</Btn><Btn onClick={save} disabled={busy} style={{ flex: 1 }}>Guardar</Btn></div>}>
      <Field label="PIN"><SecretInput value={pin} onChange={setPin} placeholder="PIN (4–6 dígitos)" inputMode="numeric" /></Field>
      <Field label="Contraseña"><SecretInput value={password} onChange={setPassword} placeholder="Contraseña alfanumérica" /></Field>
      <span style={labelStyle}>Patrón (Android)</span>
      <button type="button" onClick={() => setShowPattern((s) => !s)} className="apple-press w-full flex items-center justify-between" style={{ ...inputStyle }}>
        <span>{pattern.length ? `Patrón: ${pattern.join("→")}` : "Configurar patrón"}</span>
        <ChevronRight className="w-4 h-4" style={{ color: C.sub, transform: showPattern ? "rotate(90deg)" : "none" }} />
      </button>
      {showPattern && <PatternGrid value={pattern} onChange={setPattern} />}
      <span style={{ ...labelStyle, marginTop: 20 }}>Identificadores</span>
      <input value={imei} onChange={(e) => setImei(e.target.value)} placeholder="IMEI (15 dígitos · *#06#)" inputMode="numeric" style={inputStyle} />
      <input value={serial} onChange={(e) => setSerial(e.target.value)} placeholder="Serial / S/N" style={{ ...inputStyle, marginTop: 8 }} />
      <Field label="Notas de seguridad">
        <textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Cuenta Google, observaciones…" rows={3} style={{ ...inputStyle, resize: "vertical" }} />
      </Field>
    </Sheet>
  );
}

export function PromisedDateSheet({ open, onClose, current, onSave }) {
  const [value, setValue] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (!open) return;
    const d = current ? new Date(current) : new Date();
    setValue(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`);
  }, [open, current]);
  const run = async (v) => { setBusy(true); try { await onSave(v); } finally { setBusy(false); } };
  return (
    <Sheet open={open} onClose={onClose} title="Fecha prometida" width={420}
      footer={<div className="flex gap-2"><Btn onClick={onClose} variant="secondary" style={{ flex: 1 }}>Cancelar</Btn><Btn onClick={() => run(value)} disabled={busy || !value} style={{ flex: 1 }}>{busy ? "Guardando…" : "Guardar"}</Btn></div>}>
      <Field label="Listo para"><input type="date" value={value} onChange={(e) => setValue(e.target.value)} style={{ ...inputStyle, colorScheme: "dark" }} /></Field>
      {current && <button onClick={() => run(null)} disabled={busy} className="apple-press w-full text-center" style={{ marginTop: 16, fontSize: 15, color: C.red, fontWeight: 600 }}>Quitar fecha prometida</button>}
    </Sheet>
  );
}

export function EditOrderSheet({ open, onClose, order, technicians, onSave }) {
  const [f, setF] = useState({});
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (!open || !order) return;
    setF({
      customer_name: order.customer_name || "",
      customer_phone: order.customer_phone || "",
      customer_email: order.customer_email || "",
      initial_problem: order.initial_problem || "",
      cost_estimate: order.cost_estimate ?? "",
      labor_cost: order.labor_cost ?? "",
      device_brand: order.device_brand || "",
      device_family: order.device_family || "",
      device_model: order.device_model || "",
      device_color: order.device_color || "",
      device_serial: order.device_serial || "",
      priority: order.priority || "normal",
      assigned_to: order.assigned_to || "",
      status_note: order.status_note || "",
    });
  }, [open]);
  const set = (k) => (e) => setF((p) => ({ ...p, [k]: e.target.value }));
  return (
    <Sheet open={open} onClose={onClose} title="Editar Orden" width={560}
      footer={<div className="flex gap-2"><Btn onClick={onClose} variant="secondary" style={{ flex: 1 }}>Cancelar</Btn><Btn onClick={async () => { setBusy(true); try { await onSave(f); } finally { setBusy(false); } }} disabled={busy} style={{ flex: 1 }}>Guardar</Btn></div>}>
      <span style={labelStyle}>Cliente</span>
      <input value={f.customer_name || ""} onChange={set("customer_name")} placeholder="Nombre del cliente" style={inputStyle} />
      <input value={f.customer_phone || ""} onChange={set("customer_phone")} placeholder="787-555-0000" style={{ ...inputStyle, marginTop: 8 }} />
      <input value={f.customer_email || ""} onChange={set("customer_email")} placeholder="cliente@email.com" type="email" style={{ ...inputStyle, marginTop: 8 }} />
      <Field label="Problema reportado"><textarea value={f.initial_problem || ""} onChange={set("initial_problem")} rows={3} style={{ ...inputStyle, resize: "vertical" }} /></Field>
      <span style={labelStyle}>Financiero</span>
      <div className="grid grid-cols-2 gap-2">
        <input value={f.cost_estimate} onChange={set("cost_estimate")} placeholder="Cotizacion ($)" inputMode="decimal" style={inputStyle} />
        <input value={f.labor_cost} onChange={set("labor_cost")} placeholder="Mano de obra ($)" inputMode="decimal" style={inputStyle} />
      </div>
      <span style={labelStyle}>Dispositivo</span>
      <input value={f.device_brand || ""} onChange={set("device_brand")} placeholder="Marca (Apple, Samsung...)" style={inputStyle} />
      <input value={f.device_family || ""} onChange={set("device_family")} placeholder="Familia (iPhone, Galaxy S...)" style={{ ...inputStyle, marginTop: 8 }} />
      <input value={f.device_model || ""} onChange={set("device_model")} placeholder="Modelo (iPhone 14 Pro Max)" style={{ ...inputStyle, marginTop: 8 }} />
      <input value={f.device_color || ""} onChange={set("device_color")} placeholder="Color (Negro, Blanco...)" style={{ ...inputStyle, marginTop: 8 }} />
      <input value={f.device_serial || ""} onChange={set("device_serial")} placeholder="Serial / IMEI" style={{ ...inputStyle, marginTop: 8 }} />
      <span style={labelStyle}>Prioridad</span>
      <div className="grid grid-cols-3 gap-1" style={{ padding: 3, borderRadius: 12, background: C.card2 }}>
        {[["normal", "Normal"], ["high", "Alta"], ["urgent", "Urgente"]].map(([v, l]) => (
          <button key={v} type="button" onClick={() => setF((p) => ({ ...p, priority: v }))} className="apple-press"
            style={{ padding: "9px 0", borderRadius: 10, fontSize: 14, fontWeight: 700, background: f.priority === v ? "#fff" : "transparent", color: f.priority === v ? "#000" : C.sub }}>{l}</button>
        ))}
      </div>
      <Field label="Técnico asignado">
        <select value={f.assigned_to || ""} onChange={set("assigned_to")} style={{ ...inputStyle, colorScheme: "dark" }}>
          <option value="">Sin asignar</option>
          {order?.assigned_to && !technicians.some((t) => t.id === order.assigned_to) && (
            <option value={order.assigned_to}>{order.assigned_to_name || "Asignado"}</option>
          )}
          {technicians.map((t) => <option key={t.id} value={t.id}>{t.full_name}</option>)}
        </select>
      </Field>
      <Field label="Nota del técnico"><textarea value={f.status_note || ""} onChange={set("status_note")} rows={3} style={{ ...inputStyle, resize: "vertical" }} /></Field>
    </Sheet>
  );
}

export function WarrantySheet({ open, onClose, current, onSave, number }) {
  const [days, setDays] = useState(30);
  const [custom, setCustom] = useState(false);
  const [qty, setQty] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (!open) return;
    const d = current === null || current === undefined ? 30 : Number(current);
    setDays(d);
    setCustom(![0, 30, 90].includes(d));
    setQty("");
  }, [open, current]);
  const circle = (active, top, bottom, onClick, badge) => (
    <button type="button" onClick={onClick} className="apple-press relative flex flex-col items-center justify-center"
      style={{ width: 120, height: 120, borderRadius: 999, background: active ? C.brand : C.card2, color: "#fff" }}>
      {badge && <span style={{ position: "absolute", top: 8, padding: "1px 8px", borderRadius: 999, background: active ? "rgba(255,255,255,0.25)" : tint(C.brand, 0.2), color: active ? "#fff" : C.brand, fontSize: 10, fontWeight: 800 }}>{badge}</span>}
      <span style={{ fontSize: 26, fontWeight: 800 }}>{top}</span>
      <span style={{ fontSize: 13, color: active ? "#fff" : C.sub }}>{bottom}</span>
    </button>
  );
  return (
    <Sheet open={open} onClose={onClose} title={`Garantía — ${number || ""}`} width={440}
      footer={<div className="flex gap-2"><Btn onClick={onClose} variant="secondary" style={{ flex: 1 }}>Cancelar</Btn><Btn onClick={async () => { setBusy(true); try { await onSave(parseInt(days, 10) || 0); } finally { setBusy(false); } }} disabled={busy} style={{ flex: 1 }}>Guardar</Btn></div>}>
      <div className="grid grid-cols-2 gap-4 justify-items-center" style={{ padding: "8px 0" }}>
        {circle(days === 0 && !custom, "Sin", "garantía", () => { setCustom(false); setDays(0); })}
        {circle(custom, custom ? days : "Custom", custom ? "días" : "elige tú", () => setCustom(true))}
        {circle(days === 30 && !custom, "30", "días", () => { setCustom(false); setDays(30); }, "DEFAULT")}
        {circle(days === 90 && !custom, "90", "días", () => { setCustom(false); setDays(90); })}
      </div>
      {custom && (
        <div className="flex gap-2 items-center" style={{ marginTop: 10 }}>
          <input value={qty} onChange={(e) => setQty(e.target.value.replace(/\D/g, ""))} placeholder="Cantidad" inputMode="numeric" style={{ ...inputStyle, flex: 1 }} />
          <Btn variant="secondary" onClick={() => qty && setDays(parseInt(qty, 10))}>Días</Btn>
          <Btn variant="secondary" onClick={() => qty && setDays(parseInt(qty, 10) * 30)}>Meses</Btn>
        </div>
      )}
      <p style={{ fontSize: 13, color: C.sub, marginTop: 14, textAlign: "center" }}>Se aplica desde la fecha de entrega del equipo al cliente.</p>
    </Sheet>
  );
}

export function warrantyLabel(d) {
  const days = d === null || d === undefined ? 30 : Number(d);
  if (days === 0) return "Sin garantía";
  if (days % 30 === 0) return days === 30 ? "1 mes" : `${days / 30} meses`;
  return `${days} días`;
}

export function ReviewSheet({ open, onClose, order, tenant, onSend }) {
  const [platform, setPlatform] = useState(null);
  const social = tenant?.settings?.social || {};
  const name = order?.customer_name || "el cliente";
  useEffect(() => { if (!open) setPlatform(null); }, [open]);
  const hasPhone = !!String(order?.customer_phone || "").trim();
  const hasEmail = !!String(order?.customer_email || "").trim();
  return (
    <Sheet open={open} onClose={onClose} width={440}>
      <div className="flex flex-col items-center text-center" style={{ paddingTop: 16 }}>
        <span style={{ width: 64, height: 64, borderRadius: 999, background: tint(C.amber, 0.14), color: C.amber, display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 16 }}>
          <Star className="w-7 h-7" />
        </span>
        <p style={{ fontSize: 19, fontWeight: 800 }}>{platform ? "Enviar por" : "¡Pídele una reseña!"}</p>
        {!platform && <p style={{ fontSize: 15, color: C.sub, marginTop: 8 }}>Envíale a {name} el enlace de reseña por WhatsApp, SMS o email.</p>}
        <div className="w-full flex flex-col gap-2" style={{ marginTop: 22 }}>
          {!platform ? (
            <>
              {social.google_reviews && <Btn color="#EA4335" onClick={() => setPlatform({ label: "Google Reviews", url: social.google_reviews })}>Solicitar reseña en Google Reviews</Btn>}
              {social.yelp && <Btn color="#D32323" onClick={() => setPlatform({ label: "Yelp", url: social.yelp })}>Solicitar reseña en Yelp</Btn>}
              <Btn onClick={onClose} variant="ghost">Ahora no</Btn>
            </>
          ) : (
            <>
              {hasPhone && <Btn color="#25D366" icon={MessageCircle} onClick={() => onSend("whatsapp", platform)}>WhatsApp</Btn>}
              {hasPhone && <Btn color={C.blue} icon={MessageSquare} onClick={() => onSend("sms", platform)}>Mensaje de texto</Btn>}
              {hasEmail && <Btn color={C.amber} icon={Mail} onClick={() => onSend("email", platform)}>Email ({order.customer_email})</Btn>}
              <Btn onClick={() => setPlatform(null)} variant="ghost">Cancelar</Btn>
            </>
          )}
        </div>
      </div>
    </Sheet>
  );
}

export function ConfirmDeliverySheet({ open, onClose, order, tenant, onConfirm, onOpenWarranty, warrantyDays, flowId }) {
  const [attach, setAttach] = useState(true);
  const [review, setReview] = useState(true);
  const [busy, setBusy] = useState(false);
  const social = tenant?.settings?.social || {};
  const hasEmail = !!String(order?.customer_email || "").trim();
  const hasPhone = !!String(order?.customer_phone || "").trim();
  const hasPhotos = Array.isArray(order?.device_photos) && order.device_photos.length > 0;
  const canReview = (hasEmail || hasPhone) && (social.google_reviews || social.yelp);
  useEffect(() => { setAttach(true); setReview(true); }, [flowId]);
  const Toggle = ({ on, set, label }) => (
    <button type="button" onClick={() => set(!on)} className="apple-press w-full flex items-center justify-between" style={{ padding: "12px 14px", borderRadius: 12, background: C.card2 }}>
      <span style={{ fontSize: 15, color: C.text }}>{label}</span>
      <span style={{ width: 46, height: 28, borderRadius: 999, background: on ? C.green : "#3A3A3C", position: "relative", transition: "background 0.2s" }}>
        <span style={{ position: "absolute", top: 2, left: on ? 20 : 2, width: 24, height: 24, borderRadius: 999, background: "#fff", transition: "left 0.2s" }} />
      </span>
    </button>
  );
  return (
    <Sheet open={open} onClose={onClose} title="Confirmar entrega" width={480}
      footer={<Btn onClick={async () => { setBusy(true); try { await onConfirm({ attachPhotos: hasEmail && hasPhotos && attach, askReview: canReview && review }); } finally { setBusy(false); } }} disabled={busy} style={{ width: "100%" }}>{busy ? "Entregando…" : "Confirmar entrega"}</Btn>}>
      {hasEmail && hasPhotos && (
        <div style={{ marginBottom: 14 }}>
          <Toggle on={attach} set={setAttach} label="Adjuntar fotos al correo" />
          <p style={{ fontSize: 12, color: C.sub, margin: "6px 4px 0" }}>Antes y después: protege al taller si el cliente reclama un daño que el equipo ya traía.</p>
        </div>
      )}
      <button type="button" onClick={onOpenWarranty} className="apple-press w-full flex items-center justify-between" style={{ padding: "12px 14px", borderRadius: 12, background: C.card2 }}>
        <span className="flex items-center gap-2" style={{ fontSize: 15, color: C.text }}><ShieldCheck className="w-4 h-4" style={{ color: C.green }} /> Garantía</span>
        <span className="flex items-center gap-1" style={{ fontSize: 15, color: C.sub }}>{warrantyLabel(warrantyDays)} <ChevronRight className="w-4 h-4" /></span>
      </button>
      {canReview && (
        <div style={{ marginTop: 14 }}>
          <Toggle on={review} set={setReview} label="Pedir reseña" />
          <p style={{ fontSize: 12, color: C.sub, margin: "6px 4px 0" }}>Le mandamos un enlace para calificar el servicio.</p>
        </div>
      )}
      {!hasEmail && hasPhone && <p style={{ fontSize: 13, color: C.sub, marginTop: 14 }}>Este cliente no tiene correo — le avisamos por SMS al confirmar.</p>}
    </Sheet>
  );
}

const REOPEN_REASONS = ["Volvió a fallar (retrabajo)", "El cliente reportó otro problema", "Se marcó como entregada por error"];
const WARRANTY_REASONS = ["El equipo volvió a fallar", "El mismo problema no se resolvió", "Apareció un problema nuevo"];

export function ReopenSheet({ open, onClose, onContinue, onWarranty }) {
  const [reason, setReason] = useState("");
  const [detail, setDetail] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => { if (open) { setReason(""); setDetail(""); } }, [open]);
  const text = [reason, detail.trim()].filter(Boolean).join(" — ");
  return (
    <Sheet open={open} onClose={onClose} title="Reabrir orden" width={480}
      footer={<div className="flex gap-2"><Btn onClick={onClose} variant="secondary" style={{ flex: 1 }}>Cancelar</Btn><Btn onClick={async () => { setBusy(true); try { await onContinue(text); } finally { setBusy(false); } }} disabled={busy || !text} style={{ flex: 1 }}>Continuar</Btn></div>}>
      <button type="button" onClick={onWarranty} className="apple-press w-full flex items-center gap-3 text-left" style={{ padding: 14, borderRadius: 14, background: tint(C.amber, 0.12) }}>
        <ShieldCheck className="w-6 h-6" style={{ color: C.amber }} />
        <span className="flex-1">
          <span className="block" style={{ fontSize: 15, fontWeight: 700, color: C.text }}>Es garantía</span>
          <span className="block" style={{ fontSize: 13, color: C.sub }}>Pide motivo, fotos obligatorias y manda el correo de garantía</span>
        </span>
        <ChevronRight className="w-4 h-4" style={{ color: C.sub }} />
      </button>
      <span style={labelStyle}>Otro motivo</span>
      <div className="flex flex-col gap-2">
        {REOPEN_REASONS.map((r) => (
          <button key={r} type="button" onClick={() => setReason(r)} className="apple-press flex items-center justify-between text-left" style={{ padding: "12px 14px", borderRadius: 12, background: C.card2, color: C.text, fontSize: 15 }}>
            {r}
            {reason === r && <Check className="w-4 h-4" style={{ color: C.brand }} />}
          </button>
        ))}
      </div>
      <Field label="Detalle (opcional)"><textarea value={detail} onChange={(e) => setDetail(e.target.value)} rows={2} style={{ ...inputStyle, resize: "vertical" }} /></Field>
      <p style={{ fontSize: 12, color: C.sub, marginTop: 8 }}>Queda registrado en la orden — útil para ver retrabajos por técnico.</p>
    </Sheet>
  );
}

export function WarrantyReopenSheet({ open, onClose, onContinue }) {
  const [reason, setReason] = useState("");
  const [detail, setDetail] = useState("");
  const [files, setFiles] = useState([]);
  const [busy, setBusy] = useState(false);
  const cam = useRef(null);
  const gal = useRef(null);
  const previews = useMemo(() => files.map((f) => URL.createObjectURL(f)), [files]);
  useEffect(() => () => previews.forEach((u) => URL.revokeObjectURL(u)), [previews]);
  useEffect(() => { if (open) { setReason(""); setDetail(""); setFiles([]); } }, [open]);
  const add = (list) => setFiles((p) => [...p, ...Array.from(list || []).filter((f) => f.type.startsWith("image/"))].slice(0, 8));
  const text = [reason, detail.trim()].filter(Boolean).join(" — ");
  return (
    <Sheet open={open} onClose={() => !busy && onClose()} dismissable={!busy} title="Garantías" width={520}
      footer={<div className="flex gap-2"><Btn onClick={onClose} variant="secondary" disabled={busy} style={{ flex: 1 }}>Cancelar</Btn><Btn onClick={async () => { setBusy(true); try { await onContinue(text, files); } finally { setBusy(false); } }} disabled={busy || !text || files.length === 0} style={{ flex: 1 }}>{busy ? "Guardando…" : "Continuar"}</Btn></div>}>
      <input ref={cam} type="file" accept="image/*" capture="environment" multiple hidden onChange={(e) => { add(e.target.files); e.target.value = ""; }} />
      <input ref={gal} type="file" accept="image/*" multiple hidden onChange={(e) => { add(e.target.files); e.target.value = ""; }} />
      <span style={labelStyle}>¿Por qué volvió el equipo?</span>
      <div className="flex flex-col gap-2">
        {WARRANTY_REASONS.map((r) => (
          <button key={r} type="button" onClick={() => setReason(r)} className="apple-press flex items-center justify-between text-left" style={{ padding: "12px 14px", borderRadius: 12, background: C.card2, color: C.text, fontSize: 15 }}>
            {r}
            {reason === r && <Check className="w-4 h-4" style={{ color: C.brand }} />}
          </button>
        ))}
      </div>
      <Field label="Detalle del problema"><textarea value={detail} onChange={(e) => setDetail(e.target.value)} rows={2} style={{ ...inputStyle, resize: "vertical" }} /></Field>
      <p style={{ fontSize: 12, color: C.sub, margin: "6px 4px 0" }}>Se le envía por correo al cliente junto con las fotos.</p>
      <span style={labelStyle}>Fotos de como llegó el equipo</span>
      <div className="flex flex-wrap gap-2">
        {previews.map((u, i) => (
          <div key={u} className="relative" style={{ width: 84, height: 84 }}>
            <img src={u} alt="" style={{ width: 84, height: 84, objectFit: "cover", borderRadius: 10 }} />
            <button type="button" onClick={() => setFiles((f) => f.filter((_, j) => j !== i))} aria-label="Quitar foto" className="apple-press absolute" style={{ top: 3, right: 3, width: 22, height: 22, borderRadius: 999, background: "rgba(0,0,0,0.7)", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center" }}><X className="w-3 h-3" /></button>
          </div>
        ))}
      </div>
      <div className="flex gap-2" style={{ marginTop: 10 }}>
        <Btn variant="secondary" icon={Camera} onClick={() => cam.current?.click()} disabled={files.length >= 8} style={{ flex: 1 }}>Tomar foto</Btn>
        <Btn variant="secondary" icon={ImagePlus} onClick={() => gal.current?.click()} disabled={files.length >= 8} style={{ flex: 1 }}>Elegir fotos</Btn>
      </div>
      <p style={{ fontSize: 12, color: C.sub, margin: "8px 4px 0" }}>Obligatorio — deja constancia del estado del equipo al recibirlo de vuelta.</p>
    </Sheet>
  );
}
