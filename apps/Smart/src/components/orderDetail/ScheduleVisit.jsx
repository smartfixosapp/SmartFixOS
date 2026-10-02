import { useEffect, useState } from "react";
import { Loader2, MapPin } from "lucide-react";
import { Dialog, TextAction } from "@/components/pos/native/posUi";
import { Banner, W } from "@/components/wizard/ui";
import { schedulePatch } from "@/lib/tasksApi";
import { changeStatusRpc } from "@/lib/orderDetailApi";
import { sendRawEmail, tenantEmailFromName } from "@/lib/orderEmails";

const toInput = (d) => { const x = new Date(d); return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, "0")}-${String(x.getDate()).padStart(2, "0")}T${String(x.getHours()).padStart(2, "0")}:${String(x.getMinutes()).padStart(2, "0")}`; };
import { isTerminal } from "@/lib/orderStatus";
const esc = (t) => String(t ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

export default function ScheduleVisitSheet({ open, order, tenant, by, onClose, onSaved }) {
  const editing = order?.service_type === "visit" && !!order?.appointment_at;
  const [when, setWhen] = useState("");
  const [location, setLocation] = useState("");
  const [note, setNote] = useState("");
  const [toStatus, setToStatus] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  useEffect(() => {
    if (!open || !order) return;
    setError(null);
    setWhen(toInput(order.appointment_at ? new Date(order.appointment_at) : new Date(Date.now() + 3600000)));
    setLocation(order.appointment_location || ""); setNote(order.appointment_note || "");
    setToStatus(order.status !== "scheduled" && !isTerminal(order.status));
  }, [open, order?.id]);
  if (!order) return null;
  const at = new Date(when);
  const valid = !Number.isNaN(at.getTime());
  const days = valid ? Math.round((new Date(at.getFullYear(), at.getMonth(), at.getDate()) - new Date(new Date().getFullYear(), new Date().getMonth(), new Date().getDate())) / 86400000) : 0;
  const canToggle = order.status !== "scheduled" && !isTerminal(order.status);
  const save = async () => {
    if (!valid || busy) return;
    const changedDate = !order.appointment_at || Math.abs(at.getTime() - new Date(order.appointment_at).getTime()) >= 60000;
    if (changedDate && at.getTime() < Date.now() - 60000) { setError("La fecha ya pasó. Escoge una fecha y hora futuras."); return; }
    setBusy(true); setError(null);
    try {
      await schedulePatch(order, { at, location, note });
      if (toStatus && canToggle) await changeStatusRpc(order.id, "scheduled", by || "Web", true);
      if (!editing && String(order.customer_email || "").trim()) {
        const shop = tenantEmailFromName(tenant);
        const when2 = new Intl.DateTimeFormat("es-PR", { dateStyle: "full", timeStyle: "short" }).format(at);
        const html = `<div style="font-family:-apple-system,Segoe UI,sans-serif;max-width:520px;margin:0 auto;padding:24px;color:#111"><h2>Cita confirmada</h2><p>Hola ${esc(order.customer_name || "")}, tu cita para la orden <b>${esc(order.order_number)}</b> quedó confirmada.</p><p><b>${esc(when2)}</b></p>${location.trim() ? `<p>Ubicación: ${esc(location.trim())}</p>` : ""}${note.trim() ? `<p>${esc(note.trim())}</p>` : ""}<p style="color:#666">${esc(shop)}</p></div>`;
        sendRawEmail({ tenantId: order.tenant_id, to: order.customer_email, subject: `Cita confirmada · Orden ${order.order_number}`, html, replyTo: tenant?.email, fromName: shop }).catch(() => {});
      }
      onSaved?.(); onClose();
    } catch (e) { setError(e?.message || String(e)); } finally { setBusy(false); }
  };
  const field = { background: "#2C2C2E", color: "#fff", borderRadius: 12, padding: "12px 14px", fontSize: 16, colorScheme: "dark" };
  return (
    <Dialog open={open} onClose={() => !busy && onClose()} dismissable={!busy} title={editing ? "Editar cita" : "Agendar cita"} width={480} height="90dvh" leading={<TextAction onClick={onClose} disabled={busy}>Cancelar</TextAction>} trailing={<TextAction bold onClick={save} disabled={!valid || busy}>{busy ? <Loader2 className="w-4 h-4 animate-spin" /> : "Guardar"}</TextAction>}>
      <div className="flex flex-col" style={{ gap: 14, paddingTop: 8 }}>
        <div style={{ padding: 12, borderRadius: 14, background: "#2C2C2E" }}><b>{order.order_number}</b> <span style={{ color: W.sub }}>{order.customer_name}</span></div>
        <p style={{ fontSize: 12, fontWeight: 700, letterSpacing: "0.06em", color: W.sub, textTransform: "uppercase" }}>Tipo de servicio</p>
        <div style={{ padding: 12, borderRadius: 14, background: "#2C2C2E" }}><b>Visita técnica</b><p style={{ fontSize: 12, color: W.sub }}>Tú vas donde el cliente — necesitas la dirección o ubicación.</p></div>
        <p style={{ fontSize: 12, fontWeight: 700, letterSpacing: "0.06em", color: W.sub, textTransform: "uppercase" }}>Fecha y hora</p>
        <input type="datetime-local" value={when} min={toInput(new Date())} onChange={(e) => setWhen(e.target.value)} aria-label="Fecha y hora" style={field} />
        {valid && <p style={{ fontSize: 13, color: W.sub }}>{new Intl.DateTimeFormat("es-PR", { dateStyle: "medium", timeStyle: "short" }).format(at)} · {days < 0 ? "Pasada" : days === 0 ? "Hoy" : days === 1 ? "Mañana" : `En ${days} días`}</p>}
        <p style={{ fontSize: 12, fontWeight: 700, letterSpacing: "0.06em", color: W.sub, textTransform: "uppercase" }}>Ubicación</p>
        <textarea value={location} onChange={(e) => setLocation(e.target.value)} rows={3} placeholder="Pega aquí el enlace de Google Maps o escribe la dirección…" aria-label="Ubicación" style={field} />
        {/^https?:\/\//i.test(location.trim()) && <p className="flex items-center gap-1" style={{ fontSize: 12, color: "#66B3FF" }}><MapPin className="w-3.5 h-3.5" /> Enlace de mapa detectado</p>}
        <p style={{ fontSize: 12, color: W.sub }}>Comparte la ubicación exacta para no perder tiempo buscando.</p>
        <p style={{ fontSize: 12, fontWeight: 700, letterSpacing: "0.06em", color: W.sub, textTransform: "uppercase" }}>Nota de la visita</p>
        <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} placeholder="Ej: llevar cargador, batería iPhone 14 Pro, verificar Face ID…" aria-label="Nota de la visita" style={field} />
        <p style={{ fontSize: 12, color: W.sub }}>Aparecerá en la agenda como recordatorio de lo que llevas o vas a hacer.</p>
        <p style={{ fontSize: 12, fontWeight: 700, letterSpacing: "0.06em", color: W.sub, textTransform: "uppercase" }}>Estado de la orden</p>
        <div className="flex items-center gap-3" style={{ padding: 12, borderRadius: 14, background: "#2C2C2E" }}>
          <span className="flex-1"><span className="block" style={{ fontSize: 15, fontWeight: 600 }}>Cambiar estado a Agendado</span><span className="block" style={{ fontSize: 12, color: W.sub }}>{canToggle ? "Marca que el trabajo está listo y solo falta la visita." : order.status === "scheduled" ? "La orden ya está en estado Agendado." : "La orden está cerrada."}</span></span>
          <button onClick={() => canToggle && setToStatus((v) => !v)} role="switch" aria-checked={toStatus && canToggle} disabled={!canToggle} aria-label="Cambiar estado a Agendado" style={{ width: 46, height: 28, borderRadius: 999, background: toStatus && canToggle ? "#4DC780" : "#3A3A3C", position: "relative", opacity: canToggle ? 1 : 0.4 }}><span style={{ position: "absolute", top: 2, left: toStatus && canToggle ? 20 : 2, width: 24, height: 24, borderRadius: 999, background: "#fff", transition: "left 0.2s" }} /></button>
        </div>
        {error && <Banner color="#FF7373">{error}</Banner>}
      </div>
    </Dialog>
  );
}
