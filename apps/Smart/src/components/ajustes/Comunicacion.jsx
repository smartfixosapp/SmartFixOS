import { useState, useEffect, useRef } from "react";
import { Mail, ShieldCheck, Bell, Wrench, CreditCard, Check, Moon } from "lucide-react";
import { AlertDialog, tint } from "@/components/pos/native/posUi";
import { A, SubPage, Group, Row, ToggleRow, Toggle, Field, PrimaryBtn, ErrorLine } from "./ui";
import { updateTenant, settingsOf, policiesOf, DEFAULT_ABANDONMENT, localGet, localSet } from "@/lib/tenantSettings";
import { EMAIL_TEMPLATE_DEFAULTS } from "@/lib/emailTemplateDefaults";

const ORDER_T = [
  ["intake", "Orden Recibida", "¡Orden recibida!", "#3B82F6"], ["diagnosing", "Diagnóstico en Proceso", "Diagnóstico en proceso", "#8B5CF6"], ["in_progress", "En Reparación", "Reparación en progreso", "#06B6D4"],
  ["waiting_customer", "Esperando al Cliente", "Necesitamos tu respuesta", "#F43F5E"], ["waiting_parts", "Esperando Piezas", "Esperando llegada de la pieza", "#F97316"], ["part_arrived", "Pieza Lista — Trae el Equipo", "¡La pieza ya llegó!", "#FACC15"],
  ["reparacion_externa", "Reparación en Taller Externo", "Equipo en taller externo (interno)", "#EC4899"], ["ready_for_pickup", "Listo para Recoger", "¡Tu equipo está listo!", "#10B981"], ["delivered", "Equipo Entregado", "¡Orden completada!", "#059669"],
  ["cancelled", "Orden Cancelada", "Orden cancelada", "#DC2626"], ["warranty_expired", "Garantía Vencida", "Tu garantía finalizó", "#F59E0B"], ["pending_order", "Pendiente de Ordenar", "Pendiente de ordenar pieza", "#B71C1C"],
  ["device_picked_up", "Equipo Recogido", "Gracias por recoger tu equipo", "#059669"], ["abandoned", "Equipo Sin Reclamar", "Tu equipo sigue esperando", "#800021"], ["not_repairable", "No Reparable", "No pudimos repararlo", "#44403C"],
];
const PAY_T = [["deposit_receipt", "Recibo de Depósito", "Depósito recibido", "#0A84FF"], ["payment_receipt", "Recibo de Pago", "Pago recibido", "#4DC780"], ["sale_receipt", "Recibo de Venta", "¡Gracias por tu compra!", "#FFA640"], ["refund_processed", "Reembolso Procesado", "Reembolso procesado", "#FF7373"]];
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
  const row = ([id, label, sub, color], i) => {
    const o = map[id];
    const edited = hasText(o);
    const active = o?.isActive ?? true;
    return (
      <button key={id} onClick={() => go("comunicacion", `plantilla:${id}`)} className="apple-press flex items-center gap-3 text-left w-full" style={{ padding: "12px 16px", borderTop: i ? `0.5px solid ${A.sep}` : "none" }}>
        <span style={{ width: 34, height: 34, borderRadius: 9, background: tint(color, 0.18), color, display: "flex", alignItems: "center", justifyContent: "center" }}><Mail className="w-4 h-4" /></span>
        <span className="flex-1 min-w-0"><span className="block" style={{ fontSize: 15, fontWeight: 700 }}>{label}</span><span className="block" style={{ fontSize: 12, color: A.sub }}>{sub}</span></span>
        <span style={{ padding: "2px 9px", borderRadius: 999, background: tint(edited ? "#40C8E0" : "#8E8E93", 0.18), color: edited ? "#40C8E0" : "#8E8E93", fontSize: 11, fontWeight: 700 }}>{edited ? "Editada" : "Sistema"}</span>
        <span style={{ padding: "2px 9px", borderRadius: 999, background: tint(active ? A.success : A.danger, 0.18), color: active ? A.success : A.danger, fontSize: 11, fontWeight: 700 }}>{active ? "Activa" : "Silenciada"}</span>
      </button>
    );
  };
  return (
    <SubPage title="Notificaciones" onBack={back}>
      <Group header="Órdenes de Trabajo" icon={Wrench} footer="Estos correos se envían automáticamente cuando una orden cambia de estado." pad={false}>{ORDER_T.map(row)}</Group>
      <Group header="Pagos & Ventas" icon={CreditCard} footer="Estos correos se envían cuando registras un pago, depósito, venta o reembolso." pad={false}>{PAY_T.map(row)}</Group>
    </SubPage>
  );
}

export function EditorPlantilla({ id, tenant, tenantId, reload, back }) {
  const meta = ALL_T.find((t) => t[0] === id) || [id, id, "", A.brand];
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
  return (
    <SubPage title={meta[1]} onBack={back}>
      <div className="flex items-center gap-3"><span style={{ width: 44, height: 44, borderRadius: 12, background: tint(meta[3], 0.18), color: meta[3], display: "flex", alignItems: "center", justifyContent: "center" }}><Mail className="w-5 h-5" /></span><span><b style={{ fontSize: 17 }}>{meta[1]}</b><span className="block" style={{ fontSize: 12, color: A.sub }}>{PAY_T.some((t) => t[0] === id) ? "Pagos & Ventas" : "Órdenes de Trabajo"}</span></span></div>
      <Group header="Estado" pad={false}><ToggleRow first title="Plantilla activa" sub={d.isActive ? "Se enviará automáticamente cuando aplique" : "Silenciada — no se enviará aunque el evento ocurra"} on={d.isActive} onChange={(v) => setD({ ...d, isActive: v })} color={A.success} /></Group>
      <Group header="Asunto del email" footer={d.subject.trim() ? null : `Sin personalizar — se usará el asunto del sistema:\n${sysS}`}>
        <Field rows={2} value={d.subject} onChange={(v) => setD({ ...d, subject: v })} placeholder={sysS} />
        <p style={{ fontSize: 12, color: A.sub, marginTop: 6 }}>Usa `{"{order_number}"}` o `{"{number}"}` donde quieras que aparezca el número de orden.</p>
      </Group>
      <Group header="Título principal" footer="Aparece en grande arriba del contenido del email."><Field value={d.hero_title} onChange={(v) => setD({ ...d, hero_title: v })} placeholder={sysT} /></Group>
      <Group header="Mensaje al cliente" footer="Bloque principal de texto. El cuerpo estructurado (datos del equipo, piezas, totales) se agrega automáticamente abajo."><Field rows={5} value={d.hero_line} onChange={(v) => setD({ ...d, hero_line: v })} placeholder={sysL} /></Group>
      <Group header="Vista previa" footer="Borra tus cambios y vuelve al texto original del sistema.">
        <p style={{ fontSize: 12, color: A.sub }}>Asunto</p><p style={{ fontWeight: 600, marginBottom: 10 }}>{fill(d.subject.trim() || sysS)}</p>
        <p style={{ fontSize: 12, color: A.sub }}>Cuerpo</p><p style={{ fontSize: 18, fontWeight: 800 }}>{d.hero_title.trim() || sysT}</p><p style={{ fontSize: 14, color: "#ddd" }}>{d.hero_line.trim() || sysL}</p>
        <button onClick={() => setConfirm(true)} disabled={!own} className="apple-press disabled:opacity-40" style={{ marginTop: 14, padding: "11px 0", borderRadius: 12, background: tint(A.danger, 0.14), color: A.danger, fontWeight: 700, width: "100%" }}>Restaurar al sistema</button>
      </Group>
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
  const block = (k, title, footer) => (
    <Group key={k} header={title} footer={footer}>
      <textarea value={d[k]} onChange={(e) => setD({ ...d, [k]: e.target.value })} aria-label={title} className="outline-none w-full" style={{ background: A.card2, color: "#fff", borderRadius: 12, padding: "12px 14px", fontSize: 15, minHeight: 140, resize: "vertical" }} />
      <p style={{ fontSize: 12, marginTop: 6, color: d[k].length > 600 ? A.warning : A.sub }}>{d[k].length} caracteres</p>
    </Group>
  );
  return (
    <SubPage title="Políticas del Negocio" onBack={back}>
      {block("repair_warranty", "Garantía de Reparaciones", "Aparece en emails de entrega/recogida y en recibos de servicio.")}
      {block("sales_warranty", "Garantía de Ventas", "Aplica a productos vendidos — aparece en recibos de POS y emails de pago.")}
      {block("sales_terms", "Condiciones de Venta", "Política de devoluciones y términos generales — aparece en todos los recibos.")}
      {block("abandonment_terms", "Política de Abandono y Almacenaje", "Aparece en recepción y 'listo para recoger' (email), en el PDF de la orden y en los términos que el cliente firma.")}
      <Group header="Acciones rápidas" pad={false}>
        <Row first Icon={Check} color={A.vip} title="Cargar políticas sugeridas (PR)" onClick={() => setD({ ...SUGGESTED, abandonment_terms: DEFAULT_ABANDONMENT })} />
        <Row Icon={Check} color={A.danger} title="Borrar todas las políticas" onClick={() => setD({ repair_warranty: "", sales_warranty: "", sales_terms: "", abandonment_terms: "" })} />
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
  const sel = (v, on) => <select value={v} onChange={(e) => on(Number(e.target.value))} style={{ background: A.card2, color: "#fff", borderRadius: 10, padding: "8px 10px", colorScheme: "dark" }}>{hours.map((h) => <option key={h} value={h}>{String(h).padStart(2, "0")}:00</option>)}</select>;
  return (
    <SubPage title="Notificaciones Push" onBack={back}>
      <Group header="Estado del sistema" footer={granted ? "Las notificaciones están activas. Los ajustes de abajo se guardan automáticamente." : perm === "denied" ? "Las denegaste antes. Actívalas en los ajustes del navegador para este sitio." : "Activa el permiso para recibir avisos en tiempo real."}>
        <div className="flex items-center gap-3"><span style={{ width: 36, height: 36, borderRadius: 999, background: tint(granted ? A.success : A.warning, 0.16), color: granted ? A.success : A.warning, display: "flex", alignItems: "center", justifyContent: "center" }}><Bell className="w-4 h-4" /></span><span className="flex-1"><b>{granted ? "Activadas" : perm === "denied" ? "Denegadas" : "Sin configurar"}</b><span className="block" style={{ fontSize: 12, color: A.sub }}>{granted ? "Recibirás avisos en tiempo real" : perm === "denied" ? "Tendrás que activarlas en el navegador" : 'Toca "Activar notificaciones" para habilitarlas'}</span></span>{saved && <Check className="w-5 h-5" style={{ color: A.success }} />}</div>
        {perm === "default" && typeof Notification !== "undefined" && <button onClick={enable} className="apple-press" style={{ marginTop: 12, padding: "12px 0", borderRadius: 12, background: A.brand, color: "#fff", fontWeight: 700 }}>Activar notificaciones</button>}
      </Group>
      <Group header="Tipos de aviso" footer={granted ? "Cambios se guardan automáticamente." : "Activa el permiso de notificaciones para que estos ajustes tengan efecto."} pad={false}>
        {PREF_ROWS.map(([k, l], i) => <ToggleRow key={k} first={!i} title={l} on={prefs[k]} onChange={(v) => setPref(k, v)} disabled={!granted} />)}
      </Group>
      <Group header="No molestar" icon={Moon} footer="En este horario (hora del taller) no se envían notificaciones. Útil para no recibir avisos de noche.">
        <div className="flex items-center gap-3"><span className="flex-1" style={{ fontSize: 16 }}>No molestar de noche</span><Toggle on={quiet.enabled} onChange={(v) => saveQuiet({ enabled: v })} label="No molestar de noche" color={A.brand} /></div>
        {quiet.enabled && <div className="flex items-center gap-3" style={{ marginTop: 12 }}><span>Desde</span>{sel(quiet.start_hour, (v) => saveQuiet({ start_hour: v }))}<span>Hasta</span>{sel(quiet.end_hour, (v) => saveQuiet({ end_hour: v }))}</div>}
      </Group>
      <ErrorLine message={error} />
    </SubPage>
  );
}

