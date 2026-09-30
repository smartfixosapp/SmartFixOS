import { useEffect, useMemo, useState } from "react";
import { Search, X, ShieldAlert, ShieldHalf, Shield, Phone, MessageCircle, Loader2, CalendarClock, Sun, Sunrise, CalendarDays, MapPin, Video, StickyNote, ChevronRight } from "lucide-react";
import { Dialog, TextAction, tint } from "@/components/pos/native/posUi";
import { FP } from "@/lib/finance/ledger";
import { fold } from "@/lib/posLogic";
import { fmt } from "@/lib/finance/tz";
import {
  fetchWarrantyScreenOrders, warrantyScreenDaysLeft, warrantyDays, displayDevice, displayName, displayNumber, waMessage, waLink, cleanPhone,
  fetchAppointments, appointmentBucket, deliveredAt,
} from "@/lib/inicioApi";

const PURPLE = "#BF5AF2";

export function WarrantiesDialog({ open, onClose, tenantId, tz, shopName, onOpenOrder }) {
  const [rows, setRows] = useState(null);
  const [query, setQuery] = useState("");
  useEffect(() => {
    if (!open) return;
    setRows(null);
    fetchWarrantyScreenOrders(tenantId).then(setRows, () => setRows([]));
  }, [open, tenantId]);
  const filtered = useMemo(() => {
    const f = fold(query.trim());
    return (rows || []).filter((o) => !f || fold([o.customer_name, o.order_number, displayDevice(o), o.customer_phone].join(" ")).includes(f));
  }, [rows, query]);
  const claims = filtered.filter((o) => o.status === "warranty");
  const soon = filtered.filter((o) => o.status !== "warranty" && warrantyScreenDaysLeft(o) <= 7).sort((a, b) => warrantyScreenDaysLeft(a) - warrantyScreenDaysLeft(b));
  const later = filtered.filter((o) => o.status !== "warranty" && warrantyScreenDaysLeft(o) > 7).sort((a, b) => warrantyScreenDaysLeft(a) - warrantyScreenDaysLeft(b));
  const stat = (count, label, c) => (
    <div className="flex-1 flex flex-col items-center" style={{ gap: 2, padding: "8px 0", borderRadius: 12, background: tint(c, count > 0 ? 0.1 : 0.04), border: `1px solid ${tint(c, count > 0 ? 0.3 : 0.1)}` }}>
      <span style={{ fontSize: 20, fontWeight: 700, color: count > 0 ? c : "#8E8E93" }}>{count}</span>
      <span style={{ fontSize: 9, fontWeight: 600, color: "#8E8E93", textTransform: "uppercase" }}>{label}</span>
    </div>
  );
  const card = (o, withActions) => {
    const claim = o.status === "warranty";
    const dl = warrantyScreenDaysLeft(o);
    const total = Math.max(1, warrantyDays(o));
    const c = claim || dl <= 3 ? FP.danger : dl <= 7 ? FP.warning : FP.success;
    const Icon = claim ? ShieldAlert : ShieldHalf;
    const pill = claim ? "Reclamación" : dl === 0 ? "Vence hoy" : `Vence en ${dl}d`;
    const used = claim ? 1 : Math.min(1, Math.max(0, (total - dl) / total));
    const phone = cleanPhone(o.customer_phone);
    return (
      <div key={o.id} className="flex flex-col" style={{ borderRadius: 16, background: "#1C1C1E", overflow: "hidden" }}>
        <button onClick={() => onOpenOrder(o.id)} className="flex flex-col text-left" style={{ gap: 6, padding: 14 }}>
          <span className="flex items-center gap-2">
            <span style={{ width: 38, height: 38, borderRadius: 999, background: tint(c, 0.15), color: c, display: "flex", alignItems: "center", justifyContent: "center" }}><Icon className="w-5 h-5" /></span>
            <span className="flex-1" />
            <span style={{ padding: "3px 8px", borderRadius: 999, background: tint(c, 0.15), color: c, fontSize: 11, fontWeight: 700 }}>{pill}</span>
          </span>
          <span className="truncate" style={{ fontSize: 15, fontWeight: 700 }}>{displayDevice(o) || displayName(o)}</span>
          <span className="truncate" style={{ fontSize: 13, color: "#8E8E93" }}>{displayName(o)}</span>
          <span style={{ fontSize: 12, color: "#8E8E93" }}>{displayNumber(o)} · entregada {fmt(deliveredAt(o), tz, { day: "numeric", month: "short" }).replace(".", "")}</span>
          {!claim && <span style={{ height: 4, borderRadius: 999, background: "#3A3A3C", overflow: "hidden" }}><span style={{ display: "block", width: `${used * 100}%`, height: "100%", background: c }} /></span>}
        </button>
        {withActions && phone && (
          <div className="flex" style={{ borderTop: "0.5px solid rgba(84,84,88,0.6)" }}>
            <a href={`tel:${phone}`} className="flex-1 flex items-center justify-center gap-1.5" style={{ padding: "10px 0", fontSize: 13, fontWeight: 600, color: FP.brand }}><Phone className="w-4 h-4" /> Llamar</a>
            <a href={waLink(phone, waMessage(o, shopName))} target="_blank" rel="noopener noreferrer" className="flex-1 flex items-center justify-center gap-1.5" style={{ padding: "10px 0", fontSize: 13, fontWeight: 600, color: FP.success, borderLeft: "0.5px solid rgba(84,84,88,0.6)" }}><MessageCircle className="w-4 h-4" /> WhatsApp</a>
          </div>
        )}
      </div>
    );
  };
  const group = (Icon, title, color, list, actions) => list.length > 0 && (
    <div className="flex flex-col" style={{ gap: 10 }}>
      <p className="flex items-center gap-2" style={{ fontSize: 15, fontWeight: 700 }}><Icon className="w-4 h-4" style={{ color }} /> {title} <span style={{ color: "#8E8E93", fontWeight: 500 }}>{list.length}</span></p>
      <div className="grid" style={{ gap: 10, gridTemplateColumns: "repeat(auto-fill, minmax(250px, 1fr))" }}>{list.map((o) => card(o, actions))}</div>
    </div>
  );
  return (
    <Dialog open={open} onClose={onClose} title="Garantías activas" width={980} height="92dvh" leading={<TextAction onClick={onClose}>Cerrar</TextAction>} trailing={null}>
      <div className="flex flex-col" style={{ gap: 16, paddingTop: 6 }}>
        <label className="flex items-center gap-2" style={{ height: 42, padding: "0 12px", borderRadius: 12, background: "#1C1C1E" }}>
          <Search className="w-4 h-4" style={{ color: "#8E8E93" }} />
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Buscar cliente, orden, equipo…" className="flex-1 bg-transparent outline-none" style={{ color: "#fff", fontSize: 15 }} />
          {query && <button onClick={() => setQuery("")} aria-label="Limpiar" style={{ color: "#8E8E93" }}><X className="w-4 h-4" /></button>}
        </label>
        {rows === null ? <p className="flex items-center justify-center gap-2" style={{ padding: 40, color: "#8E8E93" }}><Loader2 className="w-4 h-4 animate-spin" /> Cargando garantías…</p> : rows.length === 0 ? (
          <div className="flex flex-col items-center text-center" style={{ padding: "48px 16px", gap: 8 }}>
            <Shield className="w-10 h-10" style={{ color: FP.success }} />
            <p style={{ fontSize: 17, fontWeight: 600 }}>Sin garantías activas</p>
            <p style={{ fontSize: 13, color: "#8E8E93" }}>Las órdenes entregadas en los últimos 30 días aparecerán aquí.</p>
          </div>
        ) : (
          <>
            <div className="flex" style={{ gap: 8 }}>{stat(later.length, "Al día", FP.success)}{stat(soon.length, "Vence pronto", FP.warning)}{stat(claims.length, claims.length === 1 ? "Reclamo" : "Reclamos", FP.danger)}</div>
            {group(ShieldAlert, "Reclamaciones en proceso", FP.danger, claims, false)}
            {group(ShieldHalf, "Por vencer (≤7 días)", FP.warning, soon, true)}
            {group(Shield, "Con tiempo", FP.success, later, false)}
          </>
        )}
      </div>
    </Dialog>
  );
}

const typeStyle = (o) => ((o.service_type || "workshop") === "remote" ? [Video, PURPLE, "Remoto"] : [MapPin, FP.brand, "Visita técnica"]);

export function UpcomingVisitsCard({ orders, tz, onOpenOrder, onViewAll }) {
  const list = orders.slice(0, 5);
  if (!list.length) return null;
  const todayKey = fmt(new Date(), tz, { year: "numeric", month: "2-digit", day: "2-digit" });
  return (
    <div className="flex flex-col" style={{ gap: 8, padding: 16, borderRadius: 16, background: "#1C1C1E" }}>
      <div className="flex items-center gap-2">
        <span style={{ width: 30, height: 30, borderRadius: 999, background: tint(FP.brand, 0.15), color: FP.brand, display: "flex", alignItems: "center", justifyContent: "center" }}><CalendarClock className="w-4 h-4" /></span>
        <span className="flex-1" style={{ fontSize: 15, fontWeight: 700 }}>Próximas citas</span>
        <button onClick={onViewAll} style={{ fontSize: 13, fontWeight: 600, color: FP.brand }}>Ver agenda</button>
        <span style={{ padding: "2px 8px", borderRadius: 999, background: "#3A3A3C", fontSize: 12, fontWeight: 600 }}>{list.length}</span>
      </div>
      {list.map((o) => {
        const [Icon, color, label] = typeStyle(o);
        const at = new Date(o.appointment_at);
        const isToday = fmt(at, tz, { year: "numeric", month: "2-digit", day: "2-digit" }) === todayKey;
        return (
          <button key={o.id} onClick={() => onOpenOrder(o.id)} className="flex items-center gap-3 text-left" style={{ padding: "6px 0" }}>
            <span style={{ width: 36, height: 36, borderRadius: 10, background: tint(color, 0.15), color, display: "flex", alignItems: "center", justifyContent: "center" }}><Icon className="w-4 h-4" /></span>
            <span className="flex-1 min-w-0">
              <span className="block truncate" style={{ fontSize: 14, fontWeight: 600 }}>{displayName(o)}</span>
              <span className="block truncate" style={{ fontSize: 12, color: "#8E8E93" }}>{displayDevice(o) || label}</span>
              {o.appointment_note && <span className="block truncate" style={{ fontSize: 12, color: FP.brand }}>{o.appointment_note}</span>}
            </span>
            <span className="flex flex-col items-end">
              <span style={{ fontSize: 14, fontWeight: 700, color: isToday ? color : "#fff" }}>{fmt(at, tz, { hour: "numeric", minute: "2-digit" })}</span>
              <span style={{ fontSize: 11, color: "#8E8E93" }}>{fmt(at, tz, { day: "numeric", month: "short" }).replace(".", "")}</span>
            </span>
          </button>
        );
      })}
    </div>
  );
}

export function AppointmentsDialog({ open, onClose, tenantId, tz, onOpenOrder }) {
  const [rows, setRows] = useState(null);
  useEffect(() => {
    if (!open) return;
    setRows(null);
    fetchAppointments(tenantId, tz).then(setRows, () => setRows([]));
  }, [open, tenantId, tz]);
  const groups = [
    ["hoy", "Hoy", Sun, FP.brand],
    ["manana", "Mañana", Sunrise, FP.vip],
    ["semana", "Esta semana", CalendarClock, FP.info],
    ["despues", "Más adelante", CalendarDays, PURPLE],
  ];
  return (
    <Dialog open={open} onClose={onClose} title="Agenda de citas" width={600} height="90dvh" leading={<span />} trailing={<TextAction bold onClick={onClose}>Cerrar</TextAction>}>
      {rows === null ? <p className="flex items-center justify-center gap-2" style={{ padding: 40, color: "#8E8E93" }}><Loader2 className="w-4 h-4 animate-spin" /> Cargando…</p> : rows.length === 0 ? (
        <div className="flex flex-col items-center text-center" style={{ padding: "48px 16px", gap: 10 }}>
          <span style={{ width: 64, height: 64, borderRadius: 999, background: tint(FP.brand, 0.15), color: FP.brand, display: "flex", alignItems: "center", justifyContent: "center" }}><CalendarClock className="w-8 h-8" /></span>
          <p style={{ fontSize: 17, fontWeight: 600 }}>Sin citas programadas</p>
          <p style={{ fontSize: 13, color: "#8E8E93", whiteSpace: "pre-line" }}>{"Las visitas técnicas y sesiones remotas\naparecerán aquí ordenadas por día."}</p>
          <p style={{ fontSize: 13, color: "#8E8E93", whiteSpace: "pre-line" }}>{"Al crear una orden elige \"Visita técnica\"\npara agendar la cita con fecha y hora."}</p>
        </div>
      ) : (
        <div className="flex flex-col" style={{ gap: 18, paddingTop: 6 }}>
          {groups.map(([k, title, Icon, color]) => {
            const list = rows.filter((o) => appointmentBucket(new Date(o.appointment_at), tz) === k);
            if (!list.length) return null;
            return (
              <div key={k} className="flex flex-col" style={{ gap: 8 }}>
                <p className="flex items-center gap-2" style={{ fontSize: 15, fontWeight: 700 }}><Icon className="w-4 h-4" style={{ color }} /> {title} <span style={{ fontSize: 12, color: "#8E8E93", fontWeight: 500 }}>{list.length} cita{list.length === 1 ? "" : "s"}</span></p>
                <div style={{ borderRadius: 14, background: "#1C1C1E", overflow: "hidden" }}>
                  {list.map((o, i) => {
                    const [TIcon, tcolor, label] = typeStyle(o);
                    const at = new Date(o.appointment_at);
                    const loc = String(o.appointment_location || "").trim();
                    return (
                      <button key={o.id} onClick={() => onOpenOrder(o.id)} className="w-full flex items-stretch gap-3 text-left" style={{ padding: 12, borderTop: i ? "0.5px solid rgba(84,84,88,0.6)" : "none" }}>
                        <span className="flex flex-col items-center justify-center" style={{ width: 52 }}>
                          <span style={{ fontSize: 14, fontWeight: 700 }}>{fmt(at, tz, { hour: "numeric", minute: "2-digit" })}</span>
                          <span style={{ fontSize: 11, color: "#8E8E93" }}>{k === "hoy" ? "Hoy" : fmt(at, tz, { day: "numeric", month: "short" }).replace(".", "")}</span>
                        </span>
                        <span style={{ width: 3, borderRadius: 2, background: tcolor }} />
                        <span className="flex-1 min-w-0 flex flex-col" style={{ gap: 2 }}>
                          <span className="truncate" style={{ fontSize: 15, fontWeight: 600 }}>{displayName(o)}</span>
                          <span className="flex items-center gap-1 truncate" style={{ fontSize: 12, color: "#8E8E93" }}><TIcon className="w-3 h-3" /> {label}{displayDevice(o) ? ` · ${displayDevice(o)}` : ""}</span>
                          {loc && <span className="flex items-center gap-1" style={{ fontSize: 12, color: "#8E8E93", overflow: "hidden" }}><MapPin className="w-3 h-3 flex-shrink-0" /> <span className="truncate">{loc}</span></span>}
                          {o.appointment_note && <span className="flex items-start gap-1" style={{ fontSize: 12, color: FP.brand }}><StickyNote className="w-3 h-3 flex-shrink-0 mt-0.5" /> <span style={{ overflow: "hidden", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" }}>{o.appointment_note}</span></span>}
                        </span>
                        <ChevronRight className="w-4 h-4 self-center" style={{ color: "rgba(235,235,245,0.3)" }} />
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </Dialog>
  );
}
