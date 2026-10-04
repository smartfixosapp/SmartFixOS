import React, { useMemo, useState } from "react";
import { StickyNote, Camera, Phone, MessageSquare, MessageCircle, Mail, Pin, AlertTriangle, Check, Inbox, PenLine } from "lucide-react";
import { statusInfo } from "@/lib/orderStatus";
import { ACTIVITY_LABELS } from "@/lib/orderDetailApi";
import { C, tint, Card, SectionHeader, relativeTime } from "./ui";

const KIND_STYLE = {
  note: { Icon: StickyNote, color: C.brand },
  photo: { Icon: Camera, color: C.indigo },
  call: { Icon: Phone, color: C.blue },
  sms: { Icon: MessageSquare, color: C.blue },
  whatsapp: { Icon: MessageCircle, color: C.blue },
  email: { Icon: Mail, color: C.blue },
  internal_note: { Icon: Pin, color: "#F97316" },
  customer_advisory: { Icon: AlertTriangle, color: C.amber },
};

function entryView(e) {
  const kind = e?.kind;
  if (kind && KIND_STYLE[kind]) {
    const k = KIND_STYLE[kind];
    const title = kind === "photo" ? (e.note || ACTIVITY_LABELS.photo) : ACTIVITY_LABELS[kind];
    const body = ["note", "internal_note", "customer_advisory"].includes(kind) ? e.note : null;
    return { ...k, title, body, isStatus: false, isNote: !!body };
  }
  if (e?.status) {
    const st = statusInfo(e.status);
    return { Icon: st.Icon, color: st.color, title: st.label, body: e.note || null, isStatus: true, isNote: !!e.note };
  }
  if (e?.note) return { ...KIND_STYLE.note, title: "Nota", body: e.note, isStatus: false, isNote: true };
  return null;
}

export function RecentActivity({ order, onSeeAll }) {
  const rows = useMemo(() => (Array.isArray(order.status_history) ? order.status_history : [])
    .filter((e) => e?.kind !== "email" && entryView(e))
    .sort((a, b) => new Date(b?.timestamp || 0) - new Date(a?.timestamp || 0))
    .slice(0, 2), [order.status_history]);
  if (!rows.length) return null;
  return (
    <Card style={{ padding: "12px 16px" }}>
      <div className="flex items-center justify-between" style={{ marginBottom: 6 }}>
        <p style={{ fontSize: 12, fontWeight: 700, letterSpacing: "0.06em", color: C.sub }}>ÚLTIMA ACTIVIDAD</p>
        <button onClick={onSeeAll} className="apple-press" style={{ fontSize: 13, fontWeight: 600, color: C.brand }}>Ver todo</button>
      </div>
      {rows.map((e, i) => {
        const v = entryView(e);
        return (
          <div key={`${e.timestamp || i}-${i}`} className="flex items-center gap-3" style={{ padding: "8px 0", borderTop: i ? `0.5px solid ${C.sep}` : "none" }}>
            <span style={{ width: 28, height: 28, borderRadius: 8, background: tint(v.color, 0.18), color: v.color, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
              <v.Icon className="w-3.5 h-3.5" />
            </span>
            <span className="flex-1 min-w-0">
              <span className="block truncate" style={{ fontSize: 14, fontWeight: 600, color: C.text }}>{v.title}</span>
              {v.body && <span className="block truncate" style={{ fontSize: 12, color: C.sub }}>{v.body}</span>}
            </span>
            <span style={{ fontSize: 12, color: C.sub, whiteSpace: "nowrap" }}>{relativeTime(e.timestamp)}</span>
          </div>
        );
      })}
    </Card>
  );
}

export default function Timeline({ order, emails, onOpenEmail, onDoneInternal, onAddNote, compact }) {
  const [filter, setFilter] = useState("all");
  const rows = useMemo(() => {
    const hist = (Array.isArray(order.status_history) ? order.status_history : [])
      .filter((e) => e?.kind !== "email")
      .map((e, idx) => ({ type: "entry", entry: e, ts: e?.timestamp, key: `h${idx}` }));
    const mail = (emails || []).map((m) => ({ type: "email", email: m, ts: m.sent_at || m.created_at, key: `m${m.id}` }));
    let list = [...hist, ...mail];
    if (filter === "notes") list = list.filter((r) => r.type === "entry" && String(r.entry?.note || "").trim());
    if (filter === "status") list = list.filter((r) => r.type === "entry" && r.entry?.status);
    return list.sort((a, b) => new Date(b.ts || 0) - new Date(a.ts || 0));
  }, [order.status_history, emails, filter]);

  return (
    <div>
      <SectionHeader
        right={!compact && (
          <button onClick={onAddNote} className="apple-press flex items-center gap-1" style={{ fontSize: 13, color: C.brand, fontWeight: 600 }}>
            <PenLine className="w-3.5 h-3.5" /> Nota
          </button>
        )}
      >
        {compact ? "Línea de tiempo" : "Actividad"}
      </SectionHeader>
      {!compact && (
        <div className="flex gap-2" style={{ marginBottom: 10 }}>
          {[["all", "Todo"], ["notes", "Notas"], ["status", "Estados"]].map(([k, l]) => (
            <button key={k} onClick={() => setFilter(k)} className="apple-press"
              style={{ padding: "6px 14px", borderRadius: 999, fontSize: 13, fontWeight: 600, background: filter === k ? "#fff" : C.card2, color: filter === k ? "#000" : C.sub }}>
              {l}
            </button>
          ))}
        </div>
      )}
      <Card style={{ padding: "4px 16px" }}>
        {rows.map((r) => {
          if (r.type === "email") {
            const ok = r.email.status === "sent";
            return (
              <button key={r.key} onClick={() => onOpenEmail(r.email)} className="apple-press w-full flex items-start gap-3 text-left" style={{ padding: "12px 0", borderBottom: `0.5px solid ${C.sep}` }}>
                <span style={{ width: 32, height: 32, borderRadius: 8, background: tint(ok ? C.blue : C.red, 0.18), color: ok ? C.blue : C.red, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                  {ok ? <Mail className="w-4 h-4" /> : <AlertTriangle className="w-4 h-4" />}
                </span>
                <span className="flex-1 min-w-0">
                  <span className="flex justify-between gap-2">
                    <span className="truncate" style={{ fontSize: 15, fontWeight: 600, color: C.text }}>{r.email.subject || "Correo"}</span>
                    <span style={{ fontSize: 12, color: C.sub, whiteSpace: "nowrap" }}>{relativeTime(r.ts)}</span>
                  </span>
                  <span className="block truncate" style={{ fontSize: 13, color: ok ? C.sub : C.red }}>{ok ? r.email.to_email : "No se pudo enviar"}</span>
                </span>
              </button>
            );
          }
          const v = entryView(r.entry);
          if (!v) return null;
          const isInternal = r.entry.kind === "internal_note";
          return (
            <div key={r.key} className="flex items-start gap-3" style={{ padding: "12px 0", borderBottom: `0.5px solid ${C.sep}` }}>
              <span style={{ width: 32, height: 32, borderRadius: 8, background: tint(v.color, 0.18), color: v.color, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                <v.Icon className="w-4 h-4" />
              </span>
              <div className="flex-1 min-w-0">
                <div className="flex justify-between gap-2">
                  <span style={{ fontSize: 15, fontWeight: 600, color: C.text }}>{v.title}</span>
                  <span style={{ fontSize: 12, color: C.sub, whiteSpace: "nowrap" }}>{relativeTime(r.ts)}</span>
                </div>
                {r.entry.changed_by && <p style={{ fontSize: 12, color: C.sub }}>{r.entry.changed_by}</p>}
                {v.body && <p className={v.isStatus ? "line-clamp-3" : ""} style={{ fontSize: 14, color: v.isStatus ? C.sub : C.text, marginTop: 4, whiteSpace: "pre-wrap" }}>{v.body}</p>}
                {r.entry.visible_to_customer === true && (
                  <span className="inline-block" style={{ marginTop: 6, padding: "2px 8px", borderRadius: 999, fontSize: 11, fontWeight: 700, color: C.green, background: tint(C.green, 0.15) }}>Visible al cliente</span>
                )}
              </div>
              {isInternal && r.entry.note_id && (
                <button onClick={() => onDoneInternal(r.entry.note_id)} aria-label="Marcar hecho" className="apple-press" style={{ width: 32, height: 32, borderRadius: 999, background: tint(C.green, 0.18), color: C.green, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                  <Check className="w-4 h-4" />
                </button>
              )}
            </div>
          );
        })}
        <div className="flex items-start gap-3" style={{ padding: "12px 0" }}>
          <span style={{ width: 32, height: 32, borderRadius: 8, background: tint(C.blue, 0.18), color: C.blue, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            <Inbox className="w-4 h-4" />
          </span>
          <div className="flex-1 min-w-0">
            <div className="flex justify-between gap-2">
              <span style={{ fontSize: 15, fontWeight: 600, color: C.text }}>Orden creada</span>
              <span style={{ fontSize: 12, color: C.sub }}>{relativeTime(order.created_date || order.created_at)}</span>
            </div>
            {order.created_by_name && <p style={{ fontSize: 12, color: C.sub }}>{order.created_by_name}</p>}
          </div>
        </div>
      </Card>
    </div>
  );
}
