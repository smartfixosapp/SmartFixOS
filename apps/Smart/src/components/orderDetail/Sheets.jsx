import React, { useEffect, useState } from "react";
import { Check, ArrowRight, AlertTriangle, Inbox, Phone, MessageSquare, MessageCircle, Mail, PenLine, UserCog, Hourglass, Loader2 } from "lucide-react";
import { PICKER_GROUPS, statusInfo, nextStatusFor, NOTE_PRESETS } from "@/lib/orderStatus";
import { orderTotal } from "@/lib/orderEmails";
import { C, tint, Sheet, Btn, money, displayDevice, relativeTime } from "./ui";

export function StatusPickerSheet({ open, onClose, current, onPick, hidden = [] }) {
  const next = nextStatusFor(current);
  return (
    <Sheet open={open} onClose={onClose} title="Cambiar Estado" width={520}>
      <div className="flex flex-col gap-5">
        {PICKER_GROUPS.map((g) => ({ ...g, statuses: g.statuses.filter((raw) => !hidden.includes(raw) || raw === current) })).filter((g) => g.statuses.length).map((g) => (
          <div key={g.key}>
            <p style={{ fontSize: 12, fontWeight: 700, letterSpacing: "0.06em", color: C.sub, margin: "0 4px 8px" }}>{g.title}</p>
            <div className="flex flex-col gap-2">
              {g.statuses.map((raw) => {
                const st = statusInfo(raw);
                const isCurrent = raw === current;
                const isNext = raw === next;
                return (
                  <button
                    key={raw}
                    onClick={() => onPick(raw)}
                    className="apple-press flex items-center gap-3 text-left"
                    style={{
                      padding: 10, borderRadius: 16,
                      background: isCurrent ? st.color : C.card2,
                      border: isNext && !isCurrent ? `2px solid ${C.green}` : "2px solid transparent",
                    }}
                  >
                    <span style={{ width: 46, height: 46, borderRadius: 12, background: isCurrent ? "rgba(255,255,255,0.22)" : st.color, color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                      <st.Icon className="w-5 h-5" />
                    </span>
                    <span className="flex-1 min-w-0">
                      <span className="block" style={{ fontSize: 16, fontWeight: 700, color: "#fff" }}>{st.label}</span>
                      {isCurrent && <span className="block" style={{ fontSize: 12, color: "rgba(255,255,255,0.85)" }}>Estado actual</span>}
                      {isNext && !isCurrent && <span className="block" style={{ fontSize: 12, color: C.green }}>Siguiente</span>}
                    </span>
                    {isCurrent && <Check className="w-5 h-5" style={{ color: "#fff" }} />}
                    {isNext && !isCurrent && <ArrowRight className="w-5 h-5" style={{ color: C.green }} />}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </Sheet>
  );
}

export function NoteForChangeSheet({ open, onClose, status, onSave }) {
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const st = statusInfo(status);
  const presets = NOTE_PRESETS[status] || [];
  useEffect(() => { if (open) setText(""); }, [open]);
  const save = async (value) => {
    const v = String(value || "").trim();
    if (!v) return;
    setBusy(true);
    try { await onSave(v); } finally { setBusy(false); }
  };
  return (
    <Sheet open={open} onClose={onClose} title="Nota para este cambio" width={460}>
      <p style={{ fontSize: 14, color: C.sub, marginBottom: 14 }}>Opcional — se guarda en el historial de la orden</p>
      <div className="flex flex-col gap-2">
        {presets.map((p) => (
          <button key={p} onClick={() => save(p)} disabled={busy} className="apple-press flex items-center gap-3 text-left disabled:opacity-50"
            style={{ padding: "12px 14px", borderRadius: 12, background: C.card2, color: C.text, fontSize: 15 }}>
            <span style={{ width: 8, height: 8, borderRadius: 999, background: st.color, flexShrink: 0 }} />
            {p}
          </button>
        ))}
      </div>
      {presets.length > 0 && <p style={{ fontSize: 12, fontWeight: 700, letterSpacing: "0.06em", color: C.sub, margin: "18px 4px 8px" }}>O ESCRIBE LA TUYA</p>}
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); save(text); } }}
        placeholder="Escribe una nota personalizada…"
        rows={3}
        className="w-full"
        style={{ background: C.card2, color: C.text, borderRadius: 12, padding: 12, fontSize: 15, border: "none", outline: "none", resize: "vertical", marginTop: presets.length ? 0 : 4 }}
      />
      <div className="flex flex-col gap-2" style={{ marginTop: 14 }}>
        <Btn onClick={() => save(text)} disabled={busy || !text.trim()} color={st.color}>Guardar nota</Btn>
        <Btn onClick={onClose} variant="ghost">Continuar sin nota</Btn>
      </div>
    </Sheet>
  );
}

export function AddNoteSheet({ open, onClose, onSave }) {
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => { if (open) setText(""); }, [open]);
  return (
    <Sheet
      open={open}
      onClose={onClose}
      title="Agregar nota"
      footer={(
        <div className="flex gap-2">
          <Btn onClick={onClose} variant="secondary" style={{ flex: 1 }}>Cancelar</Btn>
          <Btn
            onClick={async () => { setBusy(true); try { await onSave(text.trim()); } finally { setBusy(false); } }}
            disabled={busy || !text.trim()}
            style={{ flex: 1 }}
          >
            Guardar
          </Btn>
        </div>
      )}
    >
      <p style={{ fontSize: 13, fontWeight: 600, color: C.sub, margin: "0 4px 8px" }}>Nueva nota</p>
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="Ej: Se le explicó al cliente que hay que esperar la pieza…"
        rows={6}
        autoFocus
        className="w-full"
        style={{ background: C.card2, color: C.text, borderRadius: 12, padding: 12, fontSize: 15, border: "none", outline: "none", resize: "vertical" }}
      />
      <p style={{ fontSize: 12, color: C.sub, marginTop: 8 }}>Se añade a la línea de tiempo de la orden. Puedes marcarla como ✓ Hecho cuando ya no aplique.</p>
    </Sheet>
  );
}

export const ADVISORY_TEMPLATES = [
  { id: 1, title: "Batería con desgaste", text: "La batería del equipo presenta desgaste y podría requerir reemplazo próximamente. No está incluida en esta reparación." },
  { id: 2, title: "Face ID / True Tone", text: "Por limitación del fabricante, Face ID y True Tone pueden dejar de funcionar tras el cambio de pantalla. Esto no es un defecto de la pieza instalada." },
  { id: 3, title: "Daño por líquido previo", text: "El equipo presenta indicios de daño por líquido anteriores a esta reparación. Pueden surgir fallas futuras no relacionadas con el trabajo realizado." },
  { id: 4, title: "Pieza compatible, no original", text: "La pieza instalada es compatible de alta calidad, no original de fábrica. Cuenta con la garantía indicada en este recibo." },
  { id: 5, title: "Chasis o marco doblado", text: "El marco del equipo está doblado, lo que puede afectar el sellado y la duración de la pantalla nueva." },
  { id: 6, title: "Daño estético preexistente", text: "Se le mostró al cliente el daño estético que el equipo ya presentaba antes de la reparación." },
];

export function AdvisoriesSheet({ open, onClose, onSave }) {
  const [selected, setSelected] = useState([]);
  const [free, setFree] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => { if (open) { setSelected([]); setFree(""); } }, [open]);
  const texts = [...ADVISORY_TEMPLATES.filter((t) => selected.includes(t.id)).map((t) => t.text), ...(free.trim() ? [free.trim()] : [])];
  return (
    <Sheet
      open={open}
      onClose={onClose}
      title="Avisos al cliente"
      width={520}
      footer={(
        <div className="flex gap-2">
          <Btn onClick={onClose} variant="secondary" style={{ flex: 1 }}>Cancelar</Btn>
          <Btn onClick={async () => { setBusy(true); try { await onSave(texts); } finally { setBusy(false); } }} disabled={busy || texts.length === 0} style={{ flex: 1 }}>Guardar</Btn>
        </div>
      )}
    >
      <div className="flex items-start gap-2" style={{ padding: 12, borderRadius: 12, background: tint(C.amber, 0.12), color: C.amber, fontSize: 13, fontWeight: 600 }}>
        <AlertTriangle className="w-4 h-4 shrink-0" style={{ marginTop: 1 }} />
        Esto SÍ le llega al cliente en el recibo. Para lo que es solo del taller, usa Nota interna.
      </div>
      <p style={{ fontSize: 11, fontWeight: 800, letterSpacing: "0.06em", color: C.sub, margin: "18px 4px 8px" }}>LOS DE SIEMPRE — UN TOQUE</p>
      <div className="flex flex-col gap-2">
        {ADVISORY_TEMPLATES.map((t) => {
          const on = selected.includes(t.id);
          return (
            <button key={t.id} onClick={() => setSelected((s) => (on ? s.filter((x) => x !== t.id) : [...s, t.id]))}
              className="apple-press flex items-start gap-3 text-left"
              style={{ padding: 12, borderRadius: 12, background: C.card2, border: `1.5px solid ${on ? C.brand : "transparent"}` }}>
              <span style={{ width: 20, height: 20, borderRadius: 6, border: `2px solid ${on ? C.brand : C.sub}`, background: on ? C.brand : "transparent", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, marginTop: 2 }}>
                {on && <Check className="w-3.5 h-3.5" style={{ color: "#fff" }} />}
              </span>
              <span>
                <span className="block" style={{ fontSize: 15, fontWeight: 700, color: C.text }}>{t.title}</span>
                <span className="block" style={{ fontSize: 13, color: C.sub, marginTop: 2 }}>{t.text}</span>
              </span>
            </button>
          );
        })}
      </div>
      <p style={{ fontSize: 11, fontWeight: 800, letterSpacing: "0.06em", color: C.sub, margin: "18px 4px 8px" }}>OTRO AVISO</p>
      <textarea
        value={free}
        onChange={(e) => setFree(e.target.value)}
        placeholder="Escribe lo que le advertiste…"
        rows={3}
        className="w-full"
        style={{ background: C.card2, color: C.text, borderRadius: 12, padding: 12, fontSize: 15, border: "none", outline: "none", resize: "vertical" }}
      />
    </Sheet>
  );
}

function OptionButton({ Icon, label, color = C.text, onClick, disabled }) {
  return (
    <button onClick={onClick} disabled={disabled} className="apple-press w-full flex items-center gap-3 text-left disabled:opacity-50"
      style={{ padding: "13px 14px", borderRadius: 12, background: C.card2, color, fontSize: 15, fontWeight: 600 }}>
      {Icon && <Icon className="w-5 h-5" />}
      {label}
    </button>
  );
}

export function NotifySheet({ open, onClose, variant, order, busy, onChannel }) {
  const first = String(order?.customer_name || "").trim().split(/\s+/)[0] || "el cliente";
  const hasPhone = !!String(order?.customer_phone || "").trim();
  const hasEmail = !!String(order?.customer_email || "").trim();
  let title = "Notificar cliente";
  let message = order?.customer_name || "";
  if (variant === "ready") { title = `¿Avisar a ${first} que su equipo está listo?`; message = "Notifícale que ya puede pasar a recoger su equipo."; }
  if (variant === "abandoned") { title = `¿Avisar a ${first} que su equipo sigue sin reclamar?`; message = "Recuérdale que tiene un equipo sin reclamar acumulando cargos de almacenaje."; }
  if (variant === "general" && !hasPhone && !hasEmail) message = "Este cliente no tiene teléfono ni email.";
  return (
    <Sheet open={open} onClose={onClose} title={title} width={440}>
      {message && <p style={{ fontSize: 15, color: C.sub, marginBottom: 14 }}>{message}</p>}
      <div className="flex flex-col gap-2">
        {variant === "general" && hasPhone && <OptionButton Icon={Phone} label="Llamar" color={C.green} onClick={() => onChannel("call")} />}
        {hasPhone && variant === "general" && <OptionButton Icon={MessageSquare} label="SMS" color={C.blue} onClick={() => onChannel("sms")} />}
        {hasPhone && <OptionButton Icon={MessageCircle} label="WhatsApp" color="#25D366" onClick={() => onChannel("whatsapp")} />}
        {hasPhone && variant !== "general" && <OptionButton Icon={MessageSquare} label="SMS" color={C.blue} onClick={() => onChannel("sms")} />}
        {hasEmail && (
          <OptionButton
            Icon={busy ? Loader2 : Mail}
            label={variant === "general" ? `Email (${order.customer_email})` : "Email"}
            color={C.amber}
            disabled={busy}
            onClick={() => onChannel("email")}
          />
        )}
        {hasEmail && variant === "general" && <OptionButton Icon={PenLine} label="Componer email manualmente" onClick={() => onChannel("mailto")} />}
        <Btn onClick={onClose} variant="ghost">{variant === "general" ? "Cancelar" : "Ahora no"}</Btn>
      </div>
    </Sheet>
  );
}

export function TechPickerSheet({ open, onClose, technicians, currentId, onPick }) {
  return (
    <Sheet open={open} onClose={onClose} title="Técnico" width={420}>
      <div className="flex flex-col gap-2">
        {technicians.length === 0 && <p style={{ fontSize: 14, color: C.sub }}>No hay técnicos activos.</p>}
        {technicians.map((t) => (
          <button key={t.id} onClick={() => onPick(t)} className="apple-press flex items-center gap-3 text-left"
            style={{ padding: "12px 14px", borderRadius: 12, background: C.card2, color: C.text, fontSize: 15 }}>
            <UserCog className="w-5 h-5" style={{ color: C.teal }} />
            <span className="flex-1">{t.full_name}</span>
            {t.id === currentId && <Check className="w-5 h-5" style={{ color: C.brand }} />}
          </button>
        ))}
        {currentId && (
          <button onClick={() => onPick(null)} className="apple-press text-left" style={{ padding: "12px 14px", borderRadius: 12, background: C.card2, color: C.red, fontSize: 15, marginTop: 6 }}>
            Sin asignar
          </button>
        )}
      </div>
    </Sheet>
  );
}

export function CustomerHistorySheet({ open, onClose, loading, orders, onOpenOrder }) {
  const total = orders.reduce((s, o) => s + orderTotal(o), 0);
  return (
    <Sheet open={open} onClose={onClose} title="Historial del cliente" width={560}>
      {loading ? (
        <p className="flex items-center gap-2" style={{ fontSize: 15, color: C.sub, padding: "24px 0" }}><Loader2 className="w-4 h-4 animate-spin" /> Cargando historial…</p>
      ) : orders.length === 0 ? (
        <div className="flex flex-col items-center text-center" style={{ padding: "28px 0" }}>
          <Inbox className="w-10 h-10" style={{ color: C.sub }} />
          <p style={{ fontSize: 17, fontWeight: 700, marginTop: 10 }}>Sin historial</p>
          <p style={{ fontSize: 14, color: C.sub, marginTop: 4 }}>Este cliente no tiene otras órdenes registradas.</p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-2">
            <div style={{ padding: 14, borderRadius: 14, background: tint(C.blue, 0.12) }}>
              <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.06em", color: C.blue }}>ÓRDENES</p>
              <p style={{ fontSize: 24, fontWeight: 800 }}>{orders.length}</p>
            </div>
            <div style={{ padding: 14, borderRadius: 14, background: tint(C.green, 0.12) }}>
              <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.06em", color: C.green }}>TOTAL GASTADO</p>
              <p style={{ fontSize: 24, fontWeight: 800 }}>{money(total)}</p>
            </div>
          </div>
          <p style={{ fontSize: 12, fontWeight: 700, letterSpacing: "0.06em", color: C.sub, margin: "18px 4px 8px" }}>OTRAS ÓRDENES</p>
          <div className="flex flex-col gap-2">
            {orders.map((o) => {
              const st = statusInfo(o.status);
              return (
                <button key={o.id} onClick={() => onOpenOrder(o.id)} className="apple-press flex gap-3 text-left" style={{ padding: 12, borderRadius: 12, background: C.card2 }}>
                  <span style={{ width: 3, borderRadius: 999, background: st.color, flexShrink: 0 }} />
                  <span className="flex-1 min-w-0">
                    <span className="flex justify-between gap-2" style={{ fontSize: 12, color: C.sub }}>
                      <span>{o.order_number}</span>
                      <span>{relativeTime(o.created_date || o.created_at)}</span>
                    </span>
                    <span className="block truncate" style={{ fontSize: 15, fontWeight: 700, color: C.text }}>{displayDevice(o) || "Equipo"}</span>
                    <span className="inline-block" style={{ marginTop: 4, padding: "2px 9px", borderRadius: 999, fontSize: 12, fontWeight: 700, color: st.color, background: tint(st.color, 0.15) }}>{st.label}</span>
                  </span>
                </button>
              );
            })}
          </div>
          <p style={{ fontSize: 12, color: C.sub, marginTop: 12, textAlign: "center" }}>La orden actual no aparece en esta lista.</p>
        </>
      )}
    </Sheet>
  );
}

export function QueueWarningSheet({ open, onClose, olderNumber, onContinue }) {
  return (
    <Sheet open={open} onClose={onClose} width={420}>
      <div className="flex flex-col items-center text-center" style={{ paddingTop: 16 }}>
        <span style={{ width: 64, height: 64, borderRadius: 999, background: tint(C.amber, 0.14), color: C.amber, display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 16 }}>
          <Hourglass className="w-7 h-7" />
        </span>
        <p style={{ fontSize: 19, fontWeight: 800 }}>Hay una orden más antigua sin diagnosticar</p>
        <p style={{ fontSize: 15, color: C.sub, marginTop: 8 }}>La orden {olderNumber} lleva más tiempo esperando diagnóstico. ¿Continuar con esta de todos modos?</p>
        <div className="w-full flex flex-col gap-2" style={{ marginTop: 22 }}>
          <Btn onClick={onContinue}>Continuar de todos modos</Btn>
          <Btn onClick={onClose} variant="ghost">Cancelar</Btn>
        </div>
      </div>
    </Sheet>
  );
}

export function TechWarningSheet({ open, onClose, orderNumber, onContinue }) {
  return (
    <Sheet open={open} onClose={onClose} width={420}>
      <div className="flex flex-col items-center text-center" style={{ paddingTop: 16 }}>
        <span style={{ width: 64, height: 64, borderRadius: 999, background: tint(C.amber, 0.14), color: C.amber, display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 16 }}>
          <AlertTriangle className="w-7 h-7" />
        </span>
        <p style={{ fontSize: 19, fontWeight: 800 }}>Técnico con orden sin diagnosticar</p>
        <p style={{ fontSize: 15, color: C.sub, marginTop: 8 }}>Ya tiene la orden {orderNumber} sin diagnosticar. ¿Asignar esta también?</p>
        <div className="w-full flex flex-col gap-2" style={{ marginTop: 22 }}>
          <Btn onClick={onContinue}>Asignar de todos modos</Btn>
          <Btn onClick={onClose} variant="ghost">Cancelar</Btn>
        </div>
      </div>
    </Sheet>
  );
}

export function EmailViewerSheet({ open, onClose, email }) {
  if (!email) return null;
  const ok = email.status === "sent";
  const when = email.sent_at || email.created_at;
  return (
    <Sheet open={open} onClose={onClose} title="Email al cliente" width={700}>
      <p style={{ fontSize: 16, fontWeight: 700 }}>{email.subject || "Correo"}</p>
      <div className="flex items-center gap-2 flex-wrap" style={{ marginTop: 6, fontSize: 13, color: C.sub }}>
        <span>{email.to_email}</span>
        <span style={{ padding: "2px 9px", borderRadius: 999, fontWeight: 700, color: ok ? C.green : C.red, background: tint(ok ? C.green : C.red, 0.15) }}>{ok ? "Enviado" : "No enviado"}</span>
        {when && <span>{new Date(when).toLocaleString("es-PR", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" })}</span>}
      </div>
      {!ok && email.error_message && <p style={{ fontSize: 13, color: C.red, marginTop: 8 }}>{email.error_message}</p>}
      {email.body_html && (
        <iframe
          title="Email"
          sandbox=""
          srcDoc={email.body_html}
          style={{ width: "100%", height: 520, border: "none", borderRadius: 12, background: "#fff", marginTop: 12 }}
        />
      )}
    </Sheet>
  );
}
