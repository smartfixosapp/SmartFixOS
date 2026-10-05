import { useState, useEffect, useRef } from "react";
import { Mail, ShieldCheck, Bell, Wrench, CreditCard, Check, Moon, Inbox, Stethoscope, GitBranch, BadgeCheck, Truck, OctagonX, ShieldOff, PackageOpen, Package, ThumbsUp, OctagonAlert, BadgeX, BadgeDollarSign, ShoppingBag, Undo2, UserRoundX, Power, Type, MessageSquareText, Eye, AtSign, AlignLeft, Sparkles, Trash2, CheckCircle2, XCircle, HelpCircle, BellOff, RefreshCw, Settings as Gear, ChevronRight, Clock } from "lucide-react";
import { AlertDialog, tint } from "@/components/pos/native/posUi";
import { A, SubPage, Group, Row, ToggleRow, Toggle, Field, PrimaryBtn, ErrorLine, ActionRow } from "./ui";
import { updateTenant, settingsOf, policiesOf, DEFAULT_ABANDONMENT, localGet, localSet } from "@/lib/tenantSettings";
import { EMAIL_TEMPLATE_DEFAULTS } from "@/lib/emailTemplateDefaults";

const ORDER_T = [
  ["intake", "Orden Recibida", "¡Orden recibida!", A.info, Inbox], ["diagnosing", "Diagnóstico en Proceso", "Diagnóstico en proceso", A.vip, Stethoscope], ["in_progress", "En Reparación", "Reparación en progreso", A.vip, Wrench],
  ["waiting_customer", "Esperando al Cliente", "Necesitamos tu respuesta", A.vip, UserRoundX], ["waiting_parts", "Esperando Piezas", "Esperando llegada de la pieza", A.warning, PackageOpen], ["part_arrived", "Pieza Lista — Trae el Equipo", "¡La pieza ya llegó!", A.teal, Package],
  ["reparacion_externa", "Reparación en Taller Externo", "Equipo en taller externo (interno)", "#FF375F", GitBranch], ["ready_for_pickup", "Listo para Recoger", "¡Tu equipo está listo!", A.success, BadgeCheck], ["delivered", "Equipo Entregado", "¡Orden completada!", A.success, Truck],
  ["cancelled", "Orden Cancelada", "Orden cancelada", A.danger, OctagonX], ["warranty_expired", "Garantía Vencida", "Tu garantía finalizó", "#8E8E93", ShieldOff], ["pending_order", "Pendiente de Ordenar", "Pendiente de ordenar pieza", A.warning, PackageOpen],
  ["device_picked_up", "Equipo Recogido", "Gracias por recoger tu equipo", A.success, ThumbsUp], ["abandoned", "Equipo Sin Reclamar", "Tu equipo sigue esperando", A.danger, OctagonAlert], ["not_repairable", "No Reparable", "No pudimos repararlo", A.warning, BadgeX],
];
const PAY_T = [["deposit_receipt", "Recibo de Depósito", "Depósito recibido", A.info, BadgeDollarSign], ["payment_receipt", "Recibo de Pago", "Pago recibido", A.success, CreditCard], ["sale_receipt", "Recibo de Venta", "¡Gracias por tu compra!", A.warning, ShoppingBag], ["refund_processed", "Reembolso Procesado", "Reembolso procesado", A.danger, Undo2]];
const ALL_T = [...ORDER_T, ...PAY_T];

const tplMap = (tenant) => { const m = settingsOf(tenant).email_templates; return m && typeof m === "object" && !Array.isArray(m) ? m : {}; };
const hasText = (o) => !!(String(o?.subject || "").trim() || String(o?.hero_title || "").trim() || String(o?.hero_line || "").trim());

export function ComunicacionList({ tenant, go }) {
  const map = tplMap(tenant);
  const edited = Object.values(map).filter((o) => hasText(o)).length;
  const silenced = Object.values(map).filter((o) => o?.isActive === false).length;
  const parts = [edited > 0 && `${edited} ${edited === 1 ? "editada" : "editadas"}`, silenced > 0 && `${silenced} ${silenced === 1 ? "silenciada" : "silenciadas"}`].filter(Boolean);
  const p = policiesOf(tenant);
  const blocks = [p.repair_warranty, p.sales_warranty, p.sales_terms].filter((x) => String(x).trim()).length;
  return (
    <SubPage title="Comunicación" onBack={() => go(null)}>
      <Group header="Con tus clientes y equipo" pad={false}>
        <Row first Icon={Mail} color={A.success} title="Plantillas de Email" sub={parts.length ? parts.join(" · ") : "19 plantillas listas"} onClick={() => go("comunicacion", "plantillas")} />
        <Row Icon={ShieldCheck} color={A.vip} title="Políticas del Negocio" sub={blocks ? `${blocks} de 3 bloques` : "Sin políticas configuradas"} onClick={() => go("comunicacion", "politicas")} />
        <Row Icon={Bell} color={A.danger} title="Notificaciones push" sub="Órdenes, cobros, alertas" onClick={() => go("comunicacion", "push")} />
      </Group>
    </SubPage>
  );
}

export function PlantillasLista({ tenant, go, back }) {
  const map = tplMap(tenant);
  const pill = (text, color) => <span style={{ padding: "2px 6px", borderRadius: 999, background: tint(color, 0.18), color, fontSize: 11, fontWeight: 600 }}>{text}</span>;
  const row = ([id, label, sub, color, Ic], i) => {
    const o = map[id];
    const edited = hasText(o);
    const active = o?.isActive ?? true;
    return (
      <button key={id} onClick={() => go("comunicacion", `plantilla:${id}`)} className="apple-press relative flex items-center gap-3 text-left w-full" style={{ padding: "10px 16px" }}>
        {i > 0 && <span aria-hidden="true" style={{ position: "absolute", top: 0, left: 64, right: 0, height: 0.5, background: A.sep }} />}
        <span style={{ width: 36, height: 36, borderRadius: 8, background: tint(color, 0.18), color, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}><Ic className="w-4 h-4" strokeWidth={2.4} /></span>
        <span className="flex-1 min-w-0"><span className="block truncate" style={{ fontSize: 17, fontWeight: 600 }}>{label}</span><span className="block truncate" style={{ fontSize: 12, color: A.sub }}>{sub}</span></span>
        <span className="flex flex-col items-end" style={{ gap: 4 }}>{edited ? pill("Editada", "#64D2FF") : pill("Sistema", "#8E8E93")}{active ? pill("Activa", A.success) : pill("Silenciada", A.danger)}</span>
        <ChevronRight className="w-3.5 h-3.5" style={{ color: A.ter }} strokeWidth={2.5} />
      </button>
    );
  };
  return (
    <SubPage title="Notificaciones" onBack={back}>
      <Group header="Órdenes de Trabajo" icon={Wrench} form footer="Estos correos se envían automáticamente cuando una orden cambia de estado." pad={false}>{ORDER_T.map(row)}</Group>
      <Group header="Pagos & Ventas" icon={CreditCard} form footer="Estos correos se envían cuando registras un pago, depósito, venta o reembolso." pad={false}>{PAY_T.map(row)}</Group>
    </SubPage>
  );
}

export function EditorPlantilla({ id, tenant, tenantId, reload, back }) {
  const meta = ALL_T.find((t) => t[0] === id) || [id, id, "", A.brand, Mail];
  const sys = EMAIL_TEMPLATE_DEFAULTS[id] || {};
  const sysS = sys.subject?.es || "";
  const sysT = sys.hero_title?.es || "";
  const sysL = sys.hero_line?.es || "";
  const cur = tplMap(tenant)[id] || {};
  const [d, setD] = useState({ subject: cur.subject || "", hero_title: cur.hero_title || "", hero_line: cur.hero_line || "", isActive: cur.isActive ?? true });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [confirm, setConfirm] = useState(false);
  const own = hasText(d);
  const fill = (s) => String(s || "").replace(/\{order_number\}|\{number\}/g, "WO-101");
  const save = async () => {
    setBusy(true); setError(null);
    try {
      const map = { ...tplMap(tenant) };
      if (hasText(d) || d.isActive === false) map[id] = { id, subject: d.subject.trim(), hero_title: d.hero_title.trim(), hero_line: d.hero_line.trim(), isActive: d.isActive };
      else delete map[id];
      await updateTenant({ tenantId, settingsEdits: { email_templates: Object.keys(map).length ? map : null }, baseSettings: { email_templates: settingsOf(tenant).email_templates } });
      await reload();
      back();
    } catch (e) { setError(`No se pudo guardar: ${e?.message || e}`); } finally { setBusy(false); }
  };
  const MetaIcon = meta[4];
  const lbl = (Ic, t) => <p className="flex items-center gap-2" style={{ fontSize: 12, fontWeight: 600, color: A.sub, marginBottom: 4 }}><Ic className="w-3.5 h-3.5" />{t}</p>;
  return (
    <SubPage inline title={meta[1]} onBack={back}>
      <Group form pad={false}>
        <div className="flex items-center gap-3" style={{ padding: "12px 16px" }}>
          <span style={{ width: 44, height: 44, borderRadius: 10, background: tint(A.brand, 0.18), color: A.brand, display: "flex", alignItems: "center", justifyContent: "center" }}><MetaIcon className="w-6 h-6" /></span>
          <span><span className="block" style={{ fontSize: 17, fontWeight: 600 }}>{meta[1]}</span><span className="block" style={{ fontSize: 12, color: A.sub }}>{PAY_T.some((t) => t[0] === id) ? "Pagos & Ventas" : "Órdenes de Trabajo"}</span></span>
        </div>
      </Group>
      <Group header="Estado" icon={Power} form pad={false}><ToggleRow first title="Plantilla activa" sub={d.isActive ? "Se enviará automáticamente cuando aplique" : "Silenciada — no se enviará aunque el evento ocurra"} on={d.isActive} onChange={(v) => setD({ ...d, isActive: v })} tintColor={A.success} /></Group>
      <Group header="Asunto del email" icon={Mail} footer={d.subject.trim() ? null : `Sin personalizar — se usará el asunto del sistema:\n${sysS}`}>
        <div><Field plain rows={2} value={d.subject} onChange={(v) => setD({ ...d, subject: v })} placeholder={sysS} /><p style={{ fontSize: 12, color: A.ter, marginTop: 6 }}>Usa `{"{order_number}"}` o `{"{number}"}` donde quieras que aparezca el número de orden.</p></div>
      </Group>
      <Group header="Título principal" icon={Type} footer="Aparece en grande arriba del contenido del email."><Field plain rows={2} value={d.hero_title} onChange={(v) => setD({ ...d, hero_title: v })} placeholder={sysT} /></Group>
      <Group header="Mensaje al cliente" icon={MessageSquareText} footer="Bloque principal de texto. El cuerpo estructurado (datos del equipo, piezas, totales) se agrega automáticamente abajo."><Field plain rows={5} value={d.hero_line} onChange={(v) => setD({ ...d, hero_line: v })} placeholder={sysL} /></Group>
      <Group header="Vista previa" icon={Eye}>
        <div className="flex flex-col" style={{ gap: 10 }}>
          <div>{lbl(Mail, "Asunto")}<p style={{ fontSize: 15, fontWeight: 500 }}>{fill(d.subject.trim() || sysS)}</p></div>
          <span aria-hidden="true" style={{ height: 0.5, background: A.sep }} />
          <div>{lbl(AlignLeft, "Cuerpo")}<p style={{ fontSize: 20, fontWeight: 700 }}>{d.hero_title.trim() || sysT}</p><p style={{ fontSize: 17 }}>{d.hero_line.trim() || sysL}</p></div>
        </div>
      </Group>
      <Group form pad={false} footer="Borra tus cambios y vuelve al texto original del sistema."><ActionRow first Icon={Undo2} label="Restaurar al sistema" color={A.danger} disabled={!own} onClick={() => setConfirm(true)} /></Group>
      <ErrorLine message={error} />
      <PrimaryBtn onClick={save} busy={busy}>Guardar cambios</PrimaryBtn>
      <AlertDialog open={confirm} title="¿Restaurar plantilla?" message="Vas a perder los cambios personalizados de esta plantilla." onClose={() => setConfirm(false)} actions={[{ label: "Cancelar" }, { label: "Restaurar al sistema", destructive: true, onPress: () => setD({ subject: "", hero_title: "", hero_line: "", isActive: true }) }]} />
    </SubPage>
  );
}

const SUGGESTED = {
  repair_warranty: "* Las pantallas no tienen garantía contra roturas o fisuras luego de la entrega.\n* Cualquier daño físico posterior invalida la garantía automáticamente.",
  sales_warranty: "Políticas de Ventas — Mi Taller\nTodas nuestras ventas se realizan bajo los siguientes términos:\n1. Condición de los Productos: todos los equipos o piezas vendidas son revisadas antes de salir.",
  sales_terms: "Políticas Generales\n1. No aceptamos devoluciones de productos abiertos.\n2. Para garantías, presenta el recibo original.",
};

export function Politicas({ tenant, tenantId, reload, back }) {
  const p = policiesOf(tenant);
  const [d, setD] = useState({ ...p, abandonment_terms: p.abandonment_terms || DEFAULT_ABANDONMENT });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const save = async () => {
    setBusy(true); setError(null);
    try {
      const all = [d.repair_warranty, d.sales_warranty, d.sales_terms, d.abandonment_terms].every((x) => !String(x).trim());
      await updateTenant({ tenantId, settingsEdits: { policies: all ? null : { repair_warranty: d.repair_warranty, sales_warranty: d.sales_warranty, sales_terms: d.sales_terms, abandonment_terms: d.abandonment_terms } }, baseSettings: { policies: settingsOf(tenant).policies } });
      await reload();
      back();
    } catch (e) { setError(`No se pudo guardar: ${e?.message || e}`); } finally { setBusy(false); }
  };
  const block = (k, title, Ic, footer) => (
    <Group key={k} header={title} icon={Ic} footer={footer}>
      <div>
        <textarea value={d[k]} onChange={(e) => setD({ ...d, [k]: e.target.value })} aria-label={title} className="outline-none w-full" style={{ background: "transparent", color: "#fff", fontSize: 17, minHeight: 140, resize: "vertical", display: "block" }} />
        <p style={{ fontSize: 12, marginTop: 6, color: d[k].length > 600 ? A.warning : "rgba(142,142,147,0.6)" }}>{d[k].length} caracteres</p>
      </div>
    </Group>
  );
  return (
    <SubPage title="Políticas del Negocio" onBack={back}>
      {block("repair_warranty", "Garantía de Reparaciones", ShieldCheck, "Aparece en emails de entrega/recogida y en recibos de servicio.")}
      {block("sales_warranty", "Garantía de Ventas", BadgeCheck, "Aplica a productos vendidos — aparece en recibos de POS y emails de pago.")}
      {block("sales_terms", "Condiciones de Venta", AlignLeft, "Política de devoluciones y términos generales — aparece en todos los recibos.")}
      {block("abandonment_terms", "Política de Abandono y Almacenaje", Clock, "Aparece en recepción y 'listo para recoger' (email), en el PDF de la orden y en los términos que el cliente firma.")}
      <Group header="Acciones rápidas" form pad={false}>
        <ActionRow first Icon={Sparkles} color={A.brand} label="Cargar políticas sugeridas (PR)" onClick={() => setD({ ...SUGGESTED, abandonment_terms: DEFAULT_ABANDONMENT })} />
        <ActionRow Icon={Trash2} color={A.danger} label="Borrar todas las políticas" onClick={() => setD({ repair_warranty: "", sales_warranty: "", sales_terms: "", abandonment_terms: "" })} />
      </Group>
      <ErrorLine message={error} />
      <PrimaryBtn onClick={save} busy={busy} color={A.vip}>Guardar Políticas</PrimaryBtn>
    </SubPage>
  );
}

const PREF_KEY = "smartfixos.notification_preferences";
const PREF_DEFAULTS = { orderStatus: true, payments: true, cashRegister: false, lowStock: true, customerMessages: true, internalMessages: true, deliveryFollowUp: true, maintenanceReminder: true };
const PREF_ROWS = [["orderStatus", "Cambios de estado de órdenes"], ["payments", "Cobros y abonos"], ["cashRegister", "Caja registradora abierta/cerrada"], ["lowStock", "Alertas de stock bajo"], ["customerMessages", "Mensajes del cliente"], ["internalMessages", "Mensajes internos del equipo"], ["deliveryFollowUp", "Seguimiento 3 días tras entrega"], ["maintenanceReminder", "Mantenimiento preventivo 6 meses tras entrega"]];

export function PushSettings({ tenant, tenantId, reload, back }) {
  const readPrefs = () => { try { return { ...PREF_DEFAULTS, ...JSON.parse(localGet(PREF_KEY, "{}")) }; } catch { return PREF_DEFAULTS; } };
  const [prefs, setPrefs] = useState(readPrefs);
  const [perm, setPerm] = useState(typeof Notification !== "undefined" ? Notification.permission : "denied");
  const q = settingsOf(tenant).push_quiet_hours;
  const [quiet, setQuiet] = useState({ enabled: q?.enabled === true, start_hour: Number.isFinite(Number(q?.start_hour)) ? Number(q.start_hour) : 21, end_hour: Number.isFinite(Number(q?.end_hour)) ? Number(q.end_hour) : 7 });
  const [error, setError] = useState(null);
  const [saved, setSaved] = useState(false);
  useEffect(() => { if (!saved) return undefined; const t = setTimeout(() => setSaved(false), 1500); return () => clearTimeout(t); }, [saved]);
  const setPref = (k, v) => { const n = { ...prefs, [k]: v }; setPrefs(n); localSet(PREF_KEY, JSON.stringify(n)); setSaved(true); };
  const quietRef = useRef(quiet);
  const lastSaved = useRef(quiet);
  const baseQuiet = useRef(q);
  const chain = useRef(Promise.resolve());
  const saveQuiet = (patch) => {
    const n = { ...quietRef.current, ...patch };
    quietRef.current = n;
    setQuiet(n);
    setError(null);
    chain.current = chain.current.then(async () => {
      const sending = quietRef.current;
      try {
        const row = await updateTenant({ tenantId, settingsEdits: { push_quiet_hours: sending }, baseSettings: { push_quiet_hours: baseQuiet.current } });
        baseQuiet.current = settingsOf(row).push_quiet_hours;
        lastSaved.current = sending;
        await reload();
        setSaved(true);
      } catch (e) {
        quietRef.current = lastSaved.current;
        setQuiet(lastSaved.current);
        setError(`No se pudo guardar: ${e?.message || e}`);
      }
    });
  };
  const enable = async () => { try { setPerm(await Notification.requestPermission()); } catch { setPerm("denied"); } };
  const granted = perm === "granted";
  const hours = Array.from({ length: 24 }, (_, h) => h);

  const StatusIcon = granted ? CheckCircle2 : perm === "denied" ? XCircle : HelpCircle;
  const statusColor = granted ? A.success : perm === "denied" ? A.danger : A.warning;
  const timeSel = (label, v, on) => (
    <label className="relative flex items-center gap-3" style={{ cursor: "pointer", fontSize: 17, minHeight: 30 }}>
      <span className="flex-1">{label}</span>
      <span style={{ color: A.sub }}>{String(v).padStart(2, "0")}:00</span>
      <select value={v} onChange={(e) => on(Number(e.target.value))} aria-label={label} style={{ position: "absolute", inset: 0, width: "100%", height: "100%", opacity: 0, cursor: "pointer", colorScheme: "dark" }}>{hours.map((h) => <option key={h} value={h}>{String(h).padStart(2, "0")}:00</option>)}</select>
    </label>
  );
  return (
    <SubPage inline title="Notificaciones Push" onBack={back}>
      <Group header="Estado del sistema" form pad={false}>
        <div className="flex items-center gap-3" style={{ padding: "12px 16px" }}>
          <span style={{ width: 36, height: 36, borderRadius: 8, background: tint(statusColor, 0.18), color: statusColor, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}><StatusIcon className="w-4 h-4" strokeWidth={2.4} /></span>
          <span className="flex-1"><span className="block" style={{ fontSize: 15, fontWeight: 600 }}>{granted ? "Activadas" : perm === "denied" ? "Denegadas" : "Sin configurar"}</span><span className="block" style={{ fontSize: 12, color: A.sub }}>{granted ? "Recibirás avisos en tiempo real" : perm === "denied" ? "Tendrás que activarlas en el navegador" : 'Toca "Activar notificaciones" para habilitarlas'}</span></span>
          {saved && <CheckCircle2 className="w-5 h-5" style={{ color: A.success }} />}
        </div>
      </Group>
      {typeof Notification !== "undefined" && perm === "default" ? (
        <Group form pad={false} footer="Activa el permiso para recibir avisos en tiempo real."><ActionRow first Icon={Bell} color={A.brand} label="Activar notificaciones" onClick={enable} /></Group>
      ) : (
        <p style={{ fontSize: 13, color: A.sub, padding: "0 16px", marginTop: -12 }}>{granted ? "Las notificaciones están activas mientras Archilla OS esté abierto en una pestaña o en la app instalada. Los ajustes de abajo se guardan automáticamente." : perm === "denied" ? "Las denegaste antes. Actívalas en los ajustes del navegador para este sitio." : "Activa el permiso para recibir avisos en tiempo real."}</p>
      )}
      <Group header="Tipos de aviso" form footer={granted ? "Cambios se guardan automáticamente. En la web solo avisamos de cambios de estado de órdenes y de cobros." : "Activa el permiso de notificaciones para que estos ajustes tengan efecto."} pad={false}>
        {PREF_ROWS.map(([k, l], i) => <ToggleRow key={k} first={!i} bold={false} title={l} on={prefs[k]} onChange={(v) => setPref(k, v)} disabled={!granted} />)}
      </Group>
      <Group header="No molestar" icon={Moon} form footer="En este horario (hora del taller) no se envían notificaciones. Útil para no recibir avisos de noche.">
        <div className="flex items-center gap-3"><span className="flex-1" style={{ fontSize: 17 }}>No molestar de noche</span><Toggle on={quiet.enabled} onChange={(v) => saveQuiet({ enabled: v })} label="No molestar de noche" color={A.brand} /></div>
        {quiet.enabled && timeSel("Desde", quiet.start_hour, (v) => saveQuiet({ start_hour: v }))}
        {quiet.enabled && timeSel("Hasta", quiet.end_hour, (v) => saveQuiet({ end_hour: v }))}
      </Group>
      <ErrorLine message={error} />
    </SubPage>
  );
}
