import React from "react";
import {
  Lock, RotateCcw, Camera, Loader2, DollarSign, StickyNote, Bell, AlertTriangle,
  KeyRound, UserCog, BadgeCheck, Check, X, Archive, FileText,
} from "lucide-react";
import { statusInfo, nextStatusFor, isOrderClosed, COMMON_STATUSES, STAGE_GUIDE } from "@/lib/orderStatus";
import { remainingBalance, photoThumbURL } from "@/lib/orderEmails";
import { repairEvidence, photoThumbCandidate } from "@/lib/orderDetailApi";
import { C, tint, Card, relativeTime, money } from "./ui";

function Thumb({ url, size = 28 }) {
  return (
    <img
      src={photoThumbCandidate(url)}
      onError={(e) => {
        const el = e.currentTarget;
        if (el.dataset.fallback === "2") return;
        el.src = el.dataset.fallback === "1" ? url : photoThumbURL(url, 120);
        el.dataset.fallback = el.dataset.fallback === "1" ? "2" : "1";
      }}
      alt=""
      style={{ width: size, height: size, borderRadius: 6, objectFit: "cover", background: C.card2 }}
    />
  );
}

function Notice({ notice, onUndo, onSms, onDismiss }) {
  if (!notice) return null;
  const map = {
    countdown: { color: C.amber, text: `El correo sale en ${notice.seconds}s` },
    sent: { color: C.green, text: `Correo enviado a ${notice.email}` },
    none: { color: C.sub, text: "El cliente no tiene email ni teléfono" },
    failed: { color: C.red, text: "No se pudo enviar el correo" },
    undone: { color: C.amber, text: "Se deshizo, el correo no salió" },
    undoneLate: { color: C.amber, text: "Se deshizo, pero el correo ya había salido" },
    noEmail: { color: C.blue, text: "Cliente sin email" },
  };
  const m = map[notice.kind];
  if (!m) return null;
  return (
    <div className="flex items-center gap-2 flex-wrap" style={{ fontSize: 13, color: m.color, marginTop: 2 }}>
      <span>{m.text}</span>
      {notice.kind === "countdown" && (
        <button onClick={onUndo} className="apple-press" style={{ padding: "3px 10px", borderRadius: 999, background: tint(C.amber, 0.16), color: C.amber, fontWeight: 700 }}>Deshacer</button>
      )}
      {notice.kind === "noEmail" && (
        <button onClick={onSms} className="apple-press" style={{ padding: "3px 10px", borderRadius: 999, background: tint(C.blue, 0.16), color: C.blue, fontWeight: 700 }}>Avisar por SMS</button>
      )}
      {(notice.kind === "failed" || notice.kind === "noEmail") && (
        <button onClick={onDismiss} className="apple-press" aria-label="Cerrar aviso" style={{ color: m.color }}><X className="w-3.5 h-3.5" /></button>
      )}
    </div>
  );
}

function stageGuide(order, tenant) {
  const s = order.status;
  if (s === "not_repairable") {
    return order.not_repairable_resolved_at
      ? { title: "No reparable — resuelto", subtitle: "Ya se resolvió con el cliente (equipo recogido o pagado).", pills: [] }
      : {
        title: "No reparable",
        subtitle: "El equipo fue diagnosticado y no se pudo reparar. Cobra el diagnóstico y avisa al cliente para que lo recoja.",
        pills: [
          { key: "notify", label: "Enviar mensaje", color: C.blue },
        ],
      };
  }
  if (s === "abandoned") {
    const ready = !!order.property_claim_ready_at && !order.property_claimed_at;
    const fee = Number(tenant?.settings?.abandonment_policy?.daily_fee ?? 3);
    const acc = money(order.storage_fee_total || 0);
    return {
      title: ready ? "Listo para reclamar" : "Abandonado",
      subtitle: ready
        ? `Sin reclamar hace 90+ días · ${acc} acumulados en almacenaje. Puedes disponer del equipo o dar más tiempo.`
        : `Sin reclamar · ${acc} acumulados en almacenaje (${money(fee)}/día).`,
      pills: [
        { key: "notify_abandoned", label: "Notificar cliente", color: C.pink },
        { key: "claimed", label: "Marcar como reclamado", color: C.green },
        { key: "notify", label: "Contactar cliente", color: C.blue },
        ...(ready ? [{ key: "confirm_property", label: "Confirmar y mover a inventario", color: C.brand }, { key: "defer_property", label: "Dar 15 días más", color: C.sub }] : []),
      ],
    };
  }
  const g = STAGE_GUIDE[s];
  if (!g) return null;
  if (s === "cancelled" && !order.not_repairable_resolved_at) {
    return { ...g, subtitle: "El cliente canceló la orden. Cobra lo pendiente, si aplica, y ciérrala." };
  }
  if (s === "delivered") {
    const social = tenant?.settings?.social || {};
    const canReview = (order.customer_phone || order.customer_email) && (social.google_reviews || social.yelp);
    return { ...g, pills: canReview ? [{ key: "review", label: "Pedir reseña", color: C.amber }] : [] };
  }
  return g;
}

const STEPS = [
  { id: "intake", label: "Recepción" },
  { id: "diagnosing", label: "Diagnóstico" },
  { id: "in_progress", label: "Reparación" },
  { id: "ready_for_pickup", label: "Listo" },
  { id: "delivered", label: "Entregado" },
];

const STEP_INDEX = {
  intake: 0, scheduled: 0,
  diagnosing: 1, waiting_customer: 1, pending_order: 1, waiting_parts: 1, part_arrived_waiting_device: 1, reparacion_externa: 1, por_reparar: 1,
  in_progress: 2, ready_for_pickup: 3, delivered: 4, warranty: 4,
};

function Stepper({ status, color, label }) {
  const idx = STEP_INDEX[status];
  if (idx === undefined) return null;
  return (
    <div style={{ position: "relative" }}>
      <div style={{ position: "absolute", left: "10%", right: "10%", top: 9, height: 3, borderRadius: 2, background: C.card2 }} />
      <div style={{ position: "absolute", left: "10%", width: `${idx * 20}%`, top: 9, height: 3, borderRadius: 2, background: C.green, transition: "width 0.45s cubic-bezier(0.2, 0.8, 0.2, 1)" }} />
      <div className="grid" style={{ gridTemplateColumns: "repeat(5, minmax(0, 1fr))", position: "relative" }}>
        {STEPS.map((step, i) => {
          const done = i < idx;
          const current = i === idx;
          const text = current && label && STEPS[i].id !== status ? label : step.label;
          return (
            <div key={step.id} className="flex flex-col items-center" style={{ gap: 6 }}>
              <span style={{
                width: 21, height: 21, borderRadius: 999, display: "flex", alignItems: "center", justifyContent: "center",
                background: done ? C.green : current ? color : C.card2,
                boxShadow: current ? `0 0 0 4px ${tint(color, 0.22)}` : "none",
                transition: "background 0.3s, box-shadow 0.3s",
              }}>
                {done && <Check className="w-3 h-3" style={{ color: "#fff" }} strokeWidth={3.5} />}
              </span>
              <span className="text-center" style={{ fontSize: 11, lineHeight: 1.15, fontWeight: current ? 700 : 500, color: current ? C.text : C.sub }}>{text}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function QuickTile({ label, Icon, color, badge, onClick, disabled }) {
  return (
    <button onClick={onClick} disabled={disabled} className="apple-press hover-lift flex flex-col items-center gap-1.5 shrink-0 disabled:opacity-50" style={{ width: 68 }}>
      <span className="relative" style={{ width: 54, height: 54, borderRadius: 999, background: tint(color, 0.16), border: `1px solid ${tint(color, 0.3)}`, color, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <Icon className="w-6 h-6" />
        {badge !== undefined && badge !== null && badge !== "" && (
          <span style={{ position: "absolute", top: -5, right: -8, minWidth: 18, padding: "0 5px", borderRadius: 999, background: color, color: "#fff", fontSize: 10, fontWeight: 700, lineHeight: "18px" }}>{badge}</span>
        )}
      </span>
      <span className="text-center truncate w-full" style={{ fontSize: 12, color: C.text }}>{label}</span>
    </button>
  );
}

export function notesCount(order) {
  const hist = Array.isArray(order.status_history) ? order.status_history : [];
  const notes = hist.filter((e) => String(e?.note || "").trim() && e?.kind !== "internal_note");
  let n = notes.length;
  const sn = String(order.status_note || "").trim();
  if (sn && !notes.some((e) => String(e.note).trim() === sn)) n += 1;
  return n;
}

export default function StatusModule({
  order, tenant, saving, notice, isDesktop, uploadingPhotos, techName,
  onAdvance, onDeliver, onOpenPicker, onReopen, onUndo, onSmsFallback, onDismissNotice,
  onTakePhoto, onStagePill, onQuick,
}) {
  const st = statusInfo(order.status);
  const closed = isOrderClosed(order);
  const next = nextStatusFor(order.status);
  const nextInfo = next ? statusInfo(next) : null;
  const evidence = order.status === "in_progress" || order.status === "ready_for_pickup" ? repairEvidence(order) : null;
  const guide = stageGuide(order, tenant);
  const balance = remainingBalance(order);
  const photos = Array.isArray(order.device_photos) ? order.device_photos : [];

  const caption = [
    closed ? "Orden cerrada" : !COMMON_STATUSES.includes(order.status) ? "Estado especial" : null,
    `Actualizada ${relativeTime(order.updated_date || order.updated_at)}`,
  ].filter(Boolean).join(" · ");

  const collectClose = (order.status === "cancelled" || order.status === "not_repairable") && !closed;
  const collectButtons = collectClose ? (balance > 0.009 ? (
    <>
      <button onClick={() => onStagePill("charge")} disabled={saving} className="apple-press flex items-center justify-center gap-2 disabled:opacity-50"
        style={{ minHeight: 50, padding: "0 18px", borderRadius: 14, background: C.green, color: "#fff", fontWeight: 700, fontSize: 15, flex: 1 }}>
        <DollarSign className="w-5 h-5" /> Cobrar {money(balance)}
      </button>
      <button onClick={() => onStagePill("resolve_nr")} disabled={saving} className="apple-press flex items-center justify-center gap-2 disabled:opacity-50"
        style={{ minHeight: 50, padding: "0 18px", borderRadius: 14, background: C.card2, color: C.sub, fontWeight: 600, fontSize: 15, flex: 1 }}>
        Cerrar sin cobrar
      </button>
    </>
  ) : (
    <button onClick={() => onStagePill("resolve_nr")} disabled={saving} className="apple-press flex items-center justify-center gap-2 disabled:opacity-50"
      style={{ minHeight: 50, padding: "0 18px", borderRadius: 14, background: C.brand, color: "#fff", fontWeight: 700, fontSize: 15, flex: 1 }}>
      <BadgeCheck className="w-5 h-5" /> Cerrar orden
    </button>
  )) : null;

  const advancePrimary = next && (
    order.status === "ready_for_pickup" ? (
      <button onClick={onDeliver} disabled={saving} className="apple-press flex items-center justify-center gap-2 disabled:opacity-50"
        style={{ minHeight: 50, padding: "0 18px", borderRadius: 14, background: "#059669", color: "#fff", fontWeight: 700, fontSize: 15, flex: 1 }}>
        <BadgeCheck className="w-5 h-5" /> Marcar entregado
      </button>
    ) : (
      <button onClick={() => onAdvance(next)} disabled={saving} className="apple-press flex items-center justify-center gap-2 disabled:opacity-50"
        style={{ minHeight: 50, padding: "0 18px", borderRadius: 14, background: `linear-gradient(90deg, ${tint(nextInfo.color, 0.85)}, ${nextInfo.color})`, color: "#fff", fontWeight: 700, fontSize: 15, flex: 1, boxShadow: `0 6px 18px ${tint(nextInfo.color, 0.3)}` }}>
        <nextInfo.Icon className="w-5 h-5" /> Avanzar a: {nextInfo.label}
      </button>
    )
  );

  const reopenButton = closed ? (
    <button onClick={onReopen} disabled={saving} className="apple-press flex items-center justify-center gap-2 disabled:opacity-50"
      style={{ minHeight: 50, padding: "0 18px", borderRadius: 14, background: C.brand, color: "#fff", fontWeight: 700, fontSize: 15, flex: 1 }}>
      <RotateCcw className="w-4 h-4" /> Reabrir orden
    </button>
  ) : null;

  const primary = collectButtons || advancePrimary || reopenButton;

  const guideShown = guide && !["intake", "diagnosing", "por_reparar", "in_progress", "ready_for_pickup", "delivered", "warranty", "scheduled"].includes(order.status) ? guide : null;
  const guidePills = guide ? guide.pills : [];

  const links = !closed && (
    <div className="flex flex-wrap items-center" style={{ gap: "2px 18px", marginTop: 8 }}>
      <button onClick={onOpenPicker} disabled={saving} className="apple-press disabled:opacity-50" style={{ padding: "6px 0", fontSize: 13, fontWeight: 600, color: C.sub }}>
        Cambiar estado
      </button>
      {guidePills.map((p) => (
        <button key={p.key} onClick={() => onStagePill(p.key)} disabled={saving} className="apple-press disabled:opacity-50"
          style={{ padding: "6px 0", fontSize: 13, fontWeight: 600, color: p.color === C.sub ? C.sub : p.color }}>
          {p.label}
        </button>
      ))}
    </div>
  );

  const tiles = [
    { key: "charge", label: "Cobrar", Icon: DollarSign, color: C.green, badge: order.paid ? "✓" : balance > 0 ? money(balance) : null },
    { key: "photo", label: uploadingPhotos ? "Subiendo…" : "Foto", Icon: Camera, color: C.indigo, badge: photos.length || null },
    { key: "note", label: "Nota", Icon: StickyNote, color: C.blue, badge: notesCount(order) || null },
    ...(order.status === "ready_for_pickup" ? [
      { key: "notify_ready", label: "Avisar", Icon: Bell, color: C.green },
      { key: "advisories", label: "Avisos", Icon: AlertTriangle, color: C.amber },
      { key: "abandon_notice", label: "Abandono", Icon: Archive, color: C.pink },
    ] : []),
    { key: "documents", label: "Documentos", Icon: FileText, color: C.brand },
    { key: "security", label: "PIN", Icon: KeyRound, color: C.sub },
    ...(isDesktop ? [{ key: "tech", label: techName || "Técnico", Icon: UserCog, color: C.teal }] : []),
  ];

  const status = (
    <div style={{ minHeight: 18, marginTop: 12 }}>
      {saving ? (
        <p className="flex items-center gap-1.5" style={{ fontSize: 12, color: C.sub }}><Loader2 className="w-3.5 h-3.5 animate-spin" /> guardando…</p>
      ) : notice ? (
        <Notice notice={notice} onUndo={onUndo} onSms={onSmsFallback} onDismiss={onDismissNotice} />
      ) : (
        <p style={{ fontSize: 12, color: C.sub }}>{caption}</p>
      )}
    </div>
  );

  const stepper = <Stepper status={order.status} color={st.color} label={st.label} />;

  return (
    <Card>
      {isDesktop && primary && stepper ? (
        <div className="flex items-center gap-5 flex-wrap">
          <div style={{ flex: "1 1 320px", minWidth: 0 }}>{stepper}</div>
          <div className="flex gap-2" style={{ flex: "0 1 300px", minWidth: 220 }}>{primary}</div>
        </div>
      ) : (
        <>
          {stepper}
          {primary && <div className="flex flex-col gap-2" style={{ marginTop: 14 }}>{primary}</div>}
        </>
      )}
      {links}
      {status}

      {closed && (
        <div className="flex items-start gap-3" style={{ marginTop: 6, padding: 12, borderRadius: 12, background: tint(C.sub, 0.12) }}>
          <Lock className="w-4 h-4 shrink-0" style={{ color: C.sub, marginTop: 2 }} />
          <div>
            <p style={{ fontSize: 14, fontWeight: 700, color: C.text }}>Orden cerrada</p>
            <p style={{ fontSize: 13, color: C.sub }}>¿Marcaste un estado por error? Podés reabrirla y volverla a un estado activo.</p>
          </div>
        </div>
      )}

      {Number(order.reopen_count || 0) > 0 && (
        <div style={{ marginTop: 12, padding: 12, borderRadius: 12, background: tint(C.amber, 0.12) }}>
          <p style={{ fontSize: 14, fontWeight: 700, color: C.amber }}>Reabierta {order.reopen_count}x — retrabajo</p>
          {order.last_reopen_reason && <p style={{ fontSize: 13, color: C.text, marginTop: 2 }}>{order.last_reopen_reason}</p>}
        </div>
      )}

      {evidence && (
        evidence.length > 0 ? (
          <div className="flex items-center gap-3 flex-wrap" style={{ marginTop: 12, padding: 12, borderRadius: 12, background: tint(C.green, 0.12) }}>
            <Check className="w-4 h-4" style={{ color: C.green }} />
            <span style={{ fontSize: 14, color: C.green, fontWeight: 600 }}>
              Prueba de reparación: {evidence.length} {evidence.length === 1 ? "foto" : "fotos"}
            </span>
            <span className="flex items-center gap-1">
              {evidence.slice(0, 3).map((m) => <Thumb key={m.url} url={m.url} />)}
              {evidence.length > 3 && <span style={{ fontSize: 12, color: C.sub }}>+{evidence.length - 3}</span>}
            </span>
          </div>
        ) : (
          <div className="flex items-center justify-between gap-3" style={{ marginTop: 12, padding: 12, borderRadius: 12, background: tint(C.amber, 0.14) }}>
            <span className="flex items-center gap-2" style={{ fontSize: 14, color: C.amber, fontWeight: 600 }}>
              <AlertTriangle className="w-4 h-4" /> Falta foto de reparación terminada
            </span>
            <button onClick={onTakePhoto} className="apple-press flex items-center gap-1.5" style={{ padding: "7px 14px", borderRadius: 999, background: C.amber, color: "#fff", fontSize: 13, fontWeight: 700 }}>
              <Camera className="w-4 h-4" /> Tomar foto
            </button>
          </div>
        )
      )}

      {guideShown && (
        <div className="flex items-start gap-3" style={{ marginTop: 12, padding: 12, borderRadius: 12, background: tint(st.color, 0.1) }}>
          <st.Icon className="w-4 h-4 shrink-0" style={{ color: st.color, marginTop: 2 }} />
          <div className="min-w-0">
            <p style={{ fontSize: 14, fontWeight: 700, color: C.text }}>{guideShown.title}</p>
            <p style={{ fontSize: 13, color: C.sub }}>{guideShown.subtitle}</p>
          </div>
        </div>
      )}

      <div style={{ height: 0.5, background: C.sep, margin: "16px 0 12px" }} />
      <div className="flex overflow-x-auto" style={{ gap: 10, paddingTop: 8, paddingRight: 10, paddingBottom: 2 }}>
        {tiles.map((t) => (
          <QuickTile key={t.key} {...t} onClick={() => onQuick(t.key)} disabled={t.key === "photo" && uploadingPhotos} />
        ))}
      </div>
    </Card>
  );
}
