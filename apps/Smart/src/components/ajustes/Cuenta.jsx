import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { ShieldCheck, Stethoscope, Hand, LogOut, Check, CheckCircle2, XCircle, Power, Clock, Lock, Loader2, RefreshCw, Crown, Sparkles, X, AlertTriangle, Send, Copy, Mail, SlidersHorizontal, Wrench, UserRound, Layers, MoonStar, CreditCard } from "lucide-react";
import { Dialog, TextAction, tint } from "@/components/pos/native/posUi";
import { supabase } from "../../../../../lib/supabase-client.js";
import { A, SubPage, Group, Row, ToggleRow, Field, PrimaryBtn, ErrorLine, SelectRow, ActionRow } from "./ui";
import { localGet, localSet, planName, planKey, trialDays } from "@/lib/tenantSettings";
import { requestAppLock } from "@/components/auth/AppLock";
import { SignOutConfirm } from "@/components/layout/AccountMenu";
import { sendRawEmail, tenantEmailFromName } from "@/lib/orderEmails";
import { PLANS, TRIAL_DAYS, isStripeConfigured } from "@/lib/stripe";
import { createStripePortalSession } from "@/api/functions";

export const IDLE_OPTS = [[0, "Inmediato"], [15, "15 segundos"], [30, "30 segundos"], [60, "1 minuto"], [300, "5 minutos"], [900, "15 minutos"], [1800, "30 minutos"], [3600, "1 hora"], [86400, "Nunca"]];
const IDLE_LABEL = (s) => { const v = Number(s); const best = IDLE_OPTS.reduce((b, o) => (Math.abs(o[0] - v) < Math.abs(b[0] - v) ? o : b), IDLE_OPTS[0]); return best[1]; };
export const secGet = () => ({ idle: Number(localGet("security.idleLockSeconds", "1800")), bg: Number(localGet("security.backgroundLockSeconds", "900")), cold: localGet("security.lockOnColdLaunch", "false") === "true" });

export function CuentaList({ go }) {
  const navigate = useNavigate();
  const [out, setOut] = useState(false);
  return (
    <SubPage title="Cuenta" onBack={() => go(null)}>
      <Group header="Acceso y soporte" pad={false}>
        <Row first Icon={ShieldCheck} color={A.danger} title="Seguridad y Sesión" sub={`Inactividad: ${IDLE_LABEL(secGet().idle)}`} onClick={() => go("cuenta", "seguridad")} />
        <Row Icon={Stethoscope} color={A.brand} title="Diagnóstico" sub="Conexión, emails enviados y soporte" onClick={() => go("cuenta", "diagnostico")} />
        <Row Icon={Hand} color={A.brand} title="Ver guía de inicio" onClick={() => { localSet("onboarding.welcomeSeen", "false"); try { localStorage.removeItem("onboarding.welcomeSeen"); } catch { return; } navigate("/Dashboard"); }} />
        <Row Icon={LogOut} color={A.danger} title="Cerrar sesión" onClick={() => setOut(true)} />
      </Group>
      <SignOutConfirm open={out} onClose={() => setOut(false)} />
    </SubPage>
  );
}

export function Seguridad({ back }) {
  const [s, setS] = useState(secGet());
  const apply = (n) => { setS(n); localSet("security.idleLockSeconds", n.idle); localSet("security.backgroundLockSeconds", n.bg); localSet("security.lockOnColdLaunch", n.cold); };
  const presets = [["Modo taller", "Sin interrupciones. PIN raro. Para cajero de tiempo completo.", { idle: 3600, bg: 1800, cold: false }, Wrench], ["Modo personal", "Balance entre comodidad y seguridad. Recomendado.", { idle: 1800, bg: 900, cold: false }, UserRound], ["Modo seguro", "Re-PIN frecuente. Para dispositivos compartidos o data sensible.", { idle: 300, bg: 30, cold: true }, ShieldCheck]];
  return (
    <SubPage title="Seguridad y Sesión" onBack={back}>
      <Group header="Perfil rápido" icon={SlidersHorizontal} form footer="Cambia los 3 ajustes de abajo en un toque. El detalle queda visible por si quieres ajustar fino." pad={false}>
        {presets.map(([t, sub, p, PI], i) => { const on = s.idle === p.idle && s.bg === p.bg && s.cold === p.cold; return (
          <button key={t} onClick={() => apply(p)} className="apple-press relative flex items-center gap-3 text-left w-full" style={{ padding: "12px 16px" }}>
            {i > 0 && <span aria-hidden="true" style={{ position: "absolute", top: 0, left: 64, right: 0, height: 0.5, background: A.sep }} />}
            <span style={{ width: 36, height: 36, borderRadius: 8, background: tint(on ? A.brand : A.sub, 0.18), color: on ? A.brand : A.sub, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}><PI className="w-4 h-4" strokeWidth={2.4} /></span>
            <span className="flex-1"><span className="block" style={{ fontSize: 17, fontWeight: 600 }}>{t}</span><span className="block" style={{ fontSize: 12, color: A.sub }}>{sub}</span></span>
            {on && <CheckCircle2 className="w-[22px] h-[22px]" style={{ color: A.brand }} fill={A.brand} stroke="#1C1C1E" />}
          </button>); })}
      </Group>
      <Group header="Inicio en frío" icon={Power} form pad={false}><ToggleRow first tintColor={A.success} title="Pedir PIN al abrir la app" sub="Si cierras la app y la vuelves a abrir, te pide PIN" on={s.cold} onChange={(v) => apply({ ...s, cold: v })} /></Group>
      <Group header="Bloquear al regresar" icon={Layers} form footer="Si cambias a otra pestaña o app por más de este tiempo, te pedimos PIN al volver. Cambios cortos no bloquean."><SelectRow label="Tiempo en segundo plano" value={s.bg} onChange={(v) => apply({ ...s, bg: Number(v) })} options={IDLE_OPTS} /></Group>
      <Group header="Bloquear por inactividad" icon={MoonStar} form footer="Si la app está abierta sin tocarse por este tiempo, se bloquea automáticamente."><SelectRow label="Tiempo de inactividad" value={s.idle} onChange={(v) => apply({ ...s, idle: Number(v) })} options={IDLE_OPTS.filter((o) => o[0] >= 60)} /></Group>
      <Group form pad={false} footer="Forza el bloqueo inmediatamente. Útil para probar tu PIN."><ActionRow first Icon={Lock} color={A.danger} label="Bloquear ahora" onClick={requestAppLock} /></Group>
    </SubPage>
  );
}

const rel = (raw) => { const s = Math.max(0, Math.floor((Date.now() - new Date(raw).getTime()) / 1000)); if (s < 60) return "hace un momento"; if (s < 3600) return `hace ${Math.floor(s / 60)} min`; if (s < 86400) return `hace ${Math.floor(s / 3600)} h`; return `hace ${Math.floor(s / 86400)} d`; };

export function Diagnostico({ tenant, tenantId, employee, role, back }) {
  const [rows, setRows] = useState(null);
  const [onlyFailed, setOnlyFailed] = useState(false);
  const [online, setOnline] = useState(typeof navigator !== "undefined" ? navigator.onLine : true);
  const [rt, setRt] = useState(true);
  const [lastReconnect, setLastReconnect] = useState(null);
  const [toast, setToast] = useState(null);
  const [retrying, setRetrying] = useState(null);
  const [, tick] = useState(0);
  const load = useCallback(() => supabase.from("email_log").select("id,to_email,subject,from_name,body_html,status,error_message,created_at").eq("tenant_id", tenantId).order("created_at", { ascending: false }).limit(30).then(({ data }) => setRows(data || []), () => setRows([])), [tenantId]);
  useEffect(() => { load(); const t = setInterval(() => tick((n) => n + 1), 2000); const on = () => setOnline(true); const off = () => setOnline(false); window.addEventListener("online", on); window.addEventListener("offline", off); return () => { clearInterval(t); window.removeEventListener("online", on); window.removeEventListener("offline", off); }; }, [load]);
  useEffect(() => { const ch = supabase.getChannels?.() || []; setRt(ch.length === 0 || ch.some((c) => c.state === "joined")); }, [online]);
  const reconnect = async () => { try { await supabase.removeAllChannels(); } catch { return; } setLastReconnect(new Date()); setRt(true); };
  const failed = (rows || []).filter((r) => r.status === "failed");
  const list = onlyFailed ? failed : rows || [];
  const dump = [`Archilla OS Diagnóstico`, `Versión: web`, `Internet: ${online ? "Conectado" : "Sin conexión"}`, `Realtime: ${rt ? "Conectado" : "Desconectado"}`, `Modo: ${localStorage.getItem("employee_session") ? "Empleado (PIN)" : "Dueño (OAuth)"}`, `Tenant: ${tenantId.slice(0, 8)}…${tenantId.slice(-4)}`, `Usuario: ${employee?.full_name || "—"}`, `Email: ${employee?.email || "—"}`, `Rol: ${role || "—"}`, `Último reconectar: ${lastReconnect ? lastReconnect.toLocaleString("es-PR") : "—"}`, `Fecha del reporte: ${new Date().toLocaleString("es-PR")}`].join("\n");
  const retry = async (r) => {
    setRetrying(r.id);
    try { await sendRawEmail({ tenantId, to: r.to_email, subject: r.subject, html: r.body_html, replyTo: tenant?.email, fromName: r.from_name || tenantEmailFromName(tenant) }); } catch { return; } finally { setRetrying(null); load(); }
  };
  const status = !online ? ["Sin conexión a internet", A.danger, "Revisa tu red. Los cambios se guardarán cuando vuelva la conexión."] : !rt ? ["Sincronización en tiempo real desconectada", A.warning, "Toca Reconectar sincronización."] : ["Todo funcionando", A.success, "Conexión y sincronización en orden."];
  return (
    <SubPage inline title="Diagnóstico" onBack={back}>
      <div style={{ padding: 20, borderRadius: 16, background: tint(status[1], 0.1) }}><p className="flex items-center gap-2"><span style={{ width: 12, height: 12, borderRadius: 999, background: status[1] }} /><b style={{ fontSize: 20, fontWeight: 600 }}>{status[0]}</b></p><p style={{ fontSize: 15, color: A.sub, marginTop: 10 }}>{status[2]}</p></div>
      <Group header="Emails a clientes" pad={false}>
        <div className="flex items-center gap-2" style={{ padding: "10px 16px" }}>
          {failed.length > 0 && <button onClick={() => setOnlyFailed((v) => !v)} style={{ padding: "3px 10px", borderRadius: 999, background: onlyFailed ? A.danger : tint(A.danger, 0.16), color: onlyFailed ? "#fff" : A.danger, fontSize: 12, fontWeight: 700 }}>{failed.length} fallido{failed.length === 1 ? "" : "s"}</button>}
          <span className="flex-1" /><button onClick={load} aria-label="Recargar" style={{ color: A.sub }}><RefreshCw className="w-4 h-4" /></button>
        </div>
        {rows === null ? <div className="flex justify-center" style={{ padding: 20 }}><Loader2 className="w-5 h-5 animate-spin" style={{ color: A.sub }} /></div> : !list.length ? <p style={{ padding: "8px 16px 16px", color: A.sub, fontSize: 13 }}>No hay emails registrados desde esta app todavía. Los próximos envíos a clientes aparecerán aquí.</p> : list.map((r) => (
          <div key={r.id} className="flex items-start gap-3" style={{ padding: "11px 16px", borderTop: `0.5px solid ${A.sep}` }}>
            {r.status === "failed" ? <X className="w-4 h-4" style={{ color: A.danger, marginTop: 3 }} /> : <Check className="w-4 h-4" style={{ color: A.success, marginTop: 3 }} />}
            <span className="flex-1 min-w-0"><span className="block truncate" style={{ fontWeight: 600, fontSize: 14 }}>{r.subject || "(sin asunto)"}</span><span className="block truncate" style={{ fontSize: 12, color: A.sub }}>{r.to_email} · {rel(r.created_at)}</span>{r.status === "failed" && r.error_message && <span className="block" style={{ fontSize: 12, color: A.danger }}>{r.error_message}</span>}</span>
            {r.status === "failed" && r.body_html && <button onClick={() => retry(r)} disabled={retrying === r.id} className="apple-press" style={{ padding: "3px 10px", borderRadius: 999, background: tint(A.brand, 0.16), color: A.brand, fontSize: 12, fontWeight: 700 }}>{retrying === r.id ? "…" : "Reintentar"}</button>}
          </div>
        ))}
      </Group>
      <div className="flex flex-col" style={{ gap: 8 }}>
        <button onClick={reconnect} className="apple-press flex items-center justify-center gap-2" style={{ padding: "14px 0", borderRadius: 16, background: tint(A.brand, 0.12), color: A.brand, fontWeight: 600 }}><RefreshCw className="w-4 h-4" /> Reconectar sincronización</button>
        <button onClick={async () => { try { await navigator.clipboard.writeText(dump); setToast("Copiado al portapapeles"); setTimeout(() => setToast(null), 2000); } catch { return; } }} className="apple-press flex items-center justify-center gap-2" style={{ padding: "14px 0", borderRadius: 16, background: "rgba(142,142,147,0.15)", fontWeight: 600 }}><Copy className="w-4 h-4" /> Copiar diagnóstico</button>
        <a href={`mailto:archillastudios@gmail.com?subject=${encodeURIComponent("Archilla OS — Diagnóstico app vweb")}&body=${encodeURIComponent(dump)}`} className="apple-press flex items-center justify-center gap-2" style={{ padding: "14px 0", borderRadius: 16, background: "rgba(142,142,147,0.15)", fontWeight: 600 }}><Mail className="w-4 h-4" /> Enviar a soporte</a>
      </div>
      {toast && <p style={{ color: A.success, textAlign: "center", fontWeight: 600 }}>{toast}</p>}
      <Group header="Detalles técnicos">
        {[["Internet", online ? "Conectado" : "Sin conexión"], ["Realtime", rt ? "Conectado" : "Desconectado"], ["Modo", localStorage.getItem("employee_session") ? "Empleado (PIN)" : "Dueño (OAuth)"], ["Tenant", `${tenantId.slice(0, 8)}…${tenantId.slice(-4)}`], ["Usuario", employee?.full_name || "—"], ["Versión app", "web"], ["Último reconectar", lastReconnect ? lastReconnect.toLocaleTimeString("es-PR") : "—"]].map(([k, v]) => <div key={k} className="flex justify-between" style={{ padding: "5px 0", fontSize: 14 }}><span style={{ color: A.sub }}>{k}</span><span style={{ fontFamily: "ui-monospace, Menlo, monospace" }}>{v}</span></div>)}
      </Group>
      <p style={{ fontSize: 12, color: A.sub }}>Esta pantalla NO comparte datos automáticamente. Solo se envía cuando tú tocas &quot;Copiar&quot; o &quot;Enviar a soporte&quot;.</p>
    </SubPage>
  );
}

const CATS = [["bug", "Error / Comportamiento inesperado"], ["crash", "La app cerró de repente"], ["feature", "Sugerencia de mejora"], ["other", "Otro"]];

export function ReportarProblema({ open, onClose, tenant, tenantId, employee }) {
  const [cat, setCat] = useState("bug");
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [done, setDone] = useState(false);
  useEffect(() => { if (open) { setCat("bug"); setMsg(""); setError(null); setDone(false); } }, [open]);
  const send = async () => {
    if (!msg.trim() || busy) return;
    setBusy(true); setError(null);
    try {
      const { error: e } = await supabase.from("beta_feedback").insert({ tenant_id: tenantId, tenant_name: tenant?.name || "Sin nombre", employee_name: employee?.full_name || "—", message: msg.trim(), category: cat, app_version: "web", build_number: "web", device: `Web · ${navigator.userAgent.slice(0, 120)}`, ios_version: navigator.platform || "web" });
      if (e) throw e;
      setDone(true);
    } catch (e) { setError(`No se pudo enviar: ${e?.message || e}`); } finally { setBusy(false); }
  };
  return (
    <Dialog open={open} onClose={() => !busy && onClose()} dismissable={!busy} title="Reportar problema" width={480} height="86dvh" leading={<TextAction onClick={onClose}>{done ? "Cerrar" : "Cancelar"}</TextAction>} trailing={<span />}>
      {done ? (
        <div className="flex flex-col items-center text-center" style={{ gap: 10, padding: "40px 10px" }}><span style={{ width: 76, height: 76, borderRadius: 999, background: tint(A.success, 0.16), color: A.success, display: "flex", alignItems: "center", justifyContent: "center" }}><Check className="w-9 h-9" strokeWidth={3} /></span><b style={{ fontSize: 22 }}>¡Reporte enviado!</b><p style={{ color: A.sub }}>Gracias por ayudarnos a mejorar Archilla OS.<br />Revisaremos tu reporte pronto.</p><button onClick={onClose} className="apple-press" style={{ marginTop: 10, padding: "12px 28px", borderRadius: 14, background: A.brand, color: "#fff", fontWeight: 700 }}>Cerrar</button></div>
      ) : (
        <div className="flex flex-col" style={{ gap: 14, paddingTop: 8 }}>
          <p style={{ fontSize: 12, fontWeight: 700, letterSpacing: "0.06em", color: A.sub, textTransform: "uppercase" }}>Tipo de reporte</p>
          <div style={{ borderRadius: 14, background: A.card2, overflow: "hidden" }}>{CATS.map(([k, l], i) => <button key={k} onClick={() => setCat(k)} className="apple-press w-full flex items-center text-left" style={{ padding: "12px 14px", borderTop: i ? `0.5px solid ${A.sep}` : "none" }}><span className="flex-1">{l}</span>{cat === k && <Check className="w-4 h-4" style={{ color: A.warning }} strokeWidth={3} />}</button>)}</div>
          <p style={{ fontSize: 12, fontWeight: 700, letterSpacing: "0.06em", color: A.sub, textTransform: "uppercase" }}>Descripción</p>
          <Field rows={6} value={msg} onChange={setMsg} placeholder="Describe el problema con el mayor detalle posible…" />
          <ErrorLine message={error} />
          <PrimaryBtn onClick={send} busy={busy} disabled={!msg.trim()} color={A.warning} busyLabel="Enviando...">Enviar reporte</PrimaryBtn>
        </div>
      )}
    </Dialog>
  );
}

export function PaywallDialog({ open, onClose, blocking, onSignOut }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const tenantId = localGet("smartfix_tenant_id", "");
  const start = async () => {
    setBusy(true); setError(null);
    try { window.location.href = `/upgrade?plan=solo${tenantId ? `&tenant=${tenantId}` : ""}`; } catch (e) { setError(e?.message || String(e)); setBusy(false); }
  };
  const feats = ["Órdenes, POS y Finanzas", "Inventario e IVU", "Portal del cliente", "Hasta 5 usuarios", "Chat interno del equipo", "Nómina y comisiones", "Multi-device en tiempo real"];
  const body = (
    <div className="flex flex-col" style={{ gap: 14, paddingTop: 8 }}>
      <div className="flex items-center gap-3"><span style={{ width: 52, height: 52, borderRadius: 14, background: tint(A.brand, 0.16), color: A.brand, display: "flex", alignItems: "center", justifyContent: "center" }}><Crown className="w-6 h-6" /></span><span><b style={{ fontSize: 22 }}>{blocking ? "Activa tu suscripción" : "Tu plan"}</b><span className="block" style={{ fontSize: 13, color: A.sub }}>{TRIAL_DAYS} días gratis. Cancela cuando quieras.</span></span></div>
      <div style={{ padding: 16, borderRadius: 18, background: A.card2 }}>
        <p className="flex items-baseline gap-1"><b style={{ fontSize: 34, color: A.brand }}>${PLANS.solo.price}</b><span style={{ color: A.sub }}>/mes</span></p>
        <p style={{ color: A.sub, fontSize: 14 }}>{PLANS.solo.tagline}</p>
        <p style={{ margin: "10px 0", padding: "6px 12px", borderRadius: 999, background: tint(A.success, 0.14), color: A.success, fontWeight: 700, fontSize: 13, display: "inline-block" }}>{TRIAL_DAYS} días gratis, luego ${PLANS.solo.price}/mes</p>
        {feats.map((f) => <p key={f} className="flex items-center gap-2" style={{ fontSize: 14, padding: "3px 0" }}><Check className="w-4 h-4" style={{ color: A.brand }} strokeWidth={3} /> {f}</p>)}
        <button onClick={start} disabled={busy || !isStripeConfigured()} className="apple-press w-full flex items-center justify-center gap-2 disabled:opacity-50" style={{ marginTop: 14, padding: "14px 0", borderRadius: 14, background: A.brand, color: "#fff", fontWeight: 700, fontSize: 16 }}>{busy ? <Loader2 className="w-5 h-5 animate-spin" /> : <Sparkles className="w-5 h-5" />} Empezar {TRIAL_DAYS} días gratis</button>
        {!isStripeConfigured() && <p style={{ fontSize: 12, color: A.warning, marginTop: 8 }}>El cobro en línea aún no está configurado para este entorno.</p>}
      </div>
      <p style={{ fontSize: 12, color: A.sub }}>Al continuar aceptas los <a href="https://archillaos.com/terms" target="_blank" rel="noopener noreferrer" style={{ color: A.brand }}>Términos</a> · <a href="https://archillaos.com/privacy" target="_blank" rel="noopener noreferrer" style={{ color: A.brand }}>Privacidad</a>. La suscripción se cobra con tarjeta mediante Stripe y puedes cancelarla en cualquier momento.</p>
      <ErrorLine message={error} />
      {blocking && <button onClick={onSignOut} className="apple-press" style={{ color: A.sub, fontWeight: 600 }}>Cerrar sesión</button>}
    </div>
  );
  if (blocking) return <div className="fixed inset-0 overflow-y-auto" style={{ zIndex: 500, background: "#000", color: "#fff", padding: 20 }}><div className="mx-auto" style={{ maxWidth: 460 }}>{body}</div></div>;
  return <Dialog open={open} onClose={onClose} title="Planes" width={480} height="90dvh" leading={<span />} trailing={<TextAction bold onClick={onClose}>Cerrar</TextAction>}>{body}</Dialog>;
}

export function Suscripcion({ tenant, tenantId, back }) {
  const [emps, setEmps] = useState(null);
  const [paywall, setPaywall] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  useEffect(() => { supabase.from("app_employee").select("id").eq("tenant_id", tenantId).eq("active", true).limit(100).then(({ data }) => setEmps((data || []).length), () => setEmps(0)); }, [tenantId]);
  const plan = planKey(tenant);
  const days = trialDays(tenant);
  const status = String(tenant?.subscription_status || "").toLowerCase();
  const subscribed = status === "active" || status === "trialing" || ["solo", "team", "pro", "enterprise", "founders_lifetime"].includes(plan);
  const color = plan === "trial" ? A.info : plan === "beta" ? A.success : plan === "expired" ? A.danger : ["solo", "team", "pro", "enterprise", "founders_lifetime"].includes(plan) ? A.success : A.sub;
  const sub = plan === "trial" ? (days !== null ? `Días restantes de prueba: ${days}` : "Prueba activa") : plan === "expired" ? "Tu prueba terminó. Activa un plan para seguir usando Archilla OS." : subscribed ? "Suscripción activa" : "Sin suscripción activa";
  const manage = async () => {
    if (tenant?.billing_source === "apple") { setError("Administra tu suscripción desde tu Apple ID en el iPhone."); return; }
    setBusy(true); setError(null);
    try {
      const res = await createStripePortalSession({ tenant_id: tenantId, return_url: `${window.location.origin}/billing?portal_return=true` });
      const url = res?.url || res?.data?.url;
      if (!url) throw new Error(res?.error || "No se pudo generar el enlace del portal.");
      window.location.href = url;
    } catch (e) { setError(e?.message || String(e)); setBusy(false); }
  };
  return (
    <SubPage inline title="Suscripción" onBack={back}>
      <div style={{ padding: 20, borderRadius: 16, background: tint(color, 0.1) }}><p className="flex items-center gap-2"><span style={{ width: 12, height: 12, borderRadius: 999, background: color }} /><b style={{ fontSize: 20, fontWeight: 600 }}>Plan actual: {planName(tenant)}</b></p><p style={{ fontSize: 15, color: A.sub, marginTop: 10 }}>{sub}</p></div>
      {status === "past_due" && <div style={{ padding: 20, borderRadius: 16, background: "#FF453A" }}><p className="flex items-center gap-2" style={{ fontWeight: 600, color: "#fff", fontSize: 15 }}><AlertTriangle className="w-4 h-4" /> Hay un problema con tu pago</p><p style={{ fontSize: 12, color: "#fff", marginTop: 8 }}>Revisa tu método de pago desde Administrar suscripción para no perder el acceso.</p></div>}
      <div style={{ padding: "10px 20px", borderRadius: 16, background: "rgba(142,142,147,0.06)" }}>
        {[["Empleados activos", emps === null ? "…" : `${emps} de 5`], ["Estado", status ? status.charAt(0).toUpperCase() + status.slice(1) : "—"], ...(tenant?.next_billing_date ? [["Próximo cobro", new Intl.DateTimeFormat("es-PR", { dateStyle: "medium" }).format(new Date(tenant.next_billing_date))]] : [])].map(([k, v], i) => (
          <div key={k} className="flex justify-between" style={{ padding: "10px 0", borderTop: i ? "0.5px solid rgba(142,142,147,0.15)" : "none" }}><span style={{ color: A.sub, fontSize: 17 }}>{k}</span><span style={{ fontFamily: "ui-monospace, Menlo, monospace", fontSize: 15 }}>{v}</span></div>
        ))}
      </div>
      {subscribed ? <button onClick={manage} disabled={busy} className="apple-press flex items-center justify-center gap-2" style={{ padding: "14px 0", borderRadius: 16, background: tint(A.brand, 0.12), color: A.brand, fontWeight: 600 }}>{busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <CreditCard className="w-4 h-4" />} Administrar suscripción</button>
        : <button onClick={() => setPaywall(true)} className="apple-press flex items-center justify-center gap-2" style={{ padding: "14px 0", borderRadius: 16, background: A.brand, color: "#fff", fontWeight: 600 }}><Sparkles className="w-4 h-4" /> Ver planes</button>}
      <ErrorLine message={error} />
      <div style={{ paddingTop: 20 }}><p style={{ fontSize: 15, fontWeight: 600 }}>¿Preguntas sobre tu plan?</p><p style={{ fontSize: 12, color: A.sub }}>Contacta a archillastudios@gmail.com</p></div>
      <PaywallDialog open={paywall} onClose={() => setPaywall(false)} />
    </SubPage>
  );
}

