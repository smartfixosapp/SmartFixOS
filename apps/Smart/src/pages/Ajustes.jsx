import { useCallback, useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { Navigate, useNavigate, useSearchParams } from "react-router-dom";
import { Search, X, Home, DollarSign, CalendarDays, Wrench, Mail, MessageCircle, ShieldCheck, Crown, Lock, Trash2, Loader2, SearchX, ChevronRight, ExternalLink, QrCode, Users, ClipboardCheck, Clock } from "lucide-react";
import { tint } from "@/components/pos/native/posUi";
import { supabase } from "../../../../lib/supabase-client.js";
import { signOut } from "@/components/auth/signOut";
import { requestAppLock } from "@/components/auth/AppLock";
import { fetchTenantRow, isAdminRole, hasInternalChat, planSummary, localGet, isPlanProOrAbove, isPlanTeamOrAbove } from "@/lib/tenantSettings";
import { resolveCurrentEmployee } from "@/lib/orderDetailApi";
import { rolesOf, isAdminLevel, shiftTaskSummary } from "@/lib/teamApi";
import { workshopCode } from "@/lib/punchApi";
import WorkshopCodeDialog from "@/components/equipo/WorkshopCode";
import { A, SubPage, Group, Row, ErrorLine } from "@/components/ajustes/ui";
import { MiNegocioList, InfoNegocio, Apariencia, Region } from "@/components/ajustes/MiNegocio";
import { OfertasAjustes } from "@/components/ajustes/Ofertas";
import { FinanzasList, MetodosPago, PosRecibo, GastosFijos } from "@/components/ajustes/Finanzas";
import { TallerList, TipoNegocio, EstadosOrden, DatosTaller } from "@/components/ajustes/Taller";
import { ComunicacionList, PlantillasLista, EditorPlantilla, Politicas, PushSettings } from "@/components/ajustes/Comunicacion";
import { CuentaList, Seguridad, Diagnostico, ReportarProblema, Suscripcion } from "@/components/ajustes/Cuenta";

const BUILD = String(import.meta.env.VITE_COMMIT_SHA || import.meta.env.VITE_VERCEL_GIT_COMMIT_SHA || "").slice(0, 7) || "web";

const SECTIONS = [
  { id: "mi-negocio", title: "Mi Negocio", sub: () => "Info, apariencia y región", Icon: Home, color: A.brand, admin: true, keywords: ["Info del Negocio", "Apariencia", "Región", "Idioma", "Logo", "Dirección", "Teléfono"] },
  { id: "finanzas", title: "Finanzas", sub: () => "Plan, gastos, nómina e IVU", Icon: DollarSign, color: A.success, admin: true, keywords: ["Plan financiero", "Meta diaria", "Gastos Fijos", "Nómina", "Impuesto IVU", "Métodos de Pago", "ATH Móvil", "POS y Recibo", "Recibo"] },
  { id: "equipo", title: (admin) => (admin ? "Equipo" : "Mi Turno"), sub: (admin) => (admin ? "Horario, tareas y empleados" : "Mi horario y recordatorios"), Icon: CalendarDays, color: A.vip, keywords: ["Mi horario", "Recordatorios", "Código del taller", "Empleados", "Tareas de Turno", "Ponche"] },
  { id: "taller", title: "Taller", sub: () => "Catálogo, inventario y etiquetas", Icon: Wrench, color: A.warning, admin: true, keywords: ["Tipo de negocio", "Catálogo de Dispositivos", "Inventario", "Stock", "Precios", "Estados de la orden", "Visita técnica", "Etiquetas de equipo", "Ofertas", "Descuentos", "Promociones", "Oferta por equipo", "Vigencia", "Vence", "Permanente", "Datos del Taller", "Exportar"] },
  { id: "comunicacion", title: "Comunicación", sub: () => "Emails, políticas y push", Icon: Mail, color: A.info, admin: true, keywords: ["Plantillas de Email", "Políticas del Negocio", "Garantía", "Notificaciones push", "Alertas"] },
  { id: "mensajes", title: "Mensajes", sub: () => "Chat con tu equipo", Icon: MessageCircle, color: A.teal, chat: true, keywords: ["Chat del equipo", "Mensajes internos"] },
  { id: "cuenta", title: "Cuenta", sub: () => "Seguridad y diagnóstico", Icon: ShieldCheck, color: A.danger, keywords: ["Seguridad y Sesión", "PIN", "Cerrar sesión", "Diagnóstico", "Guía de inicio", "Borrar cuenta", "Bloquear app"] },
  { id: "suscripcion", title: "Suscripción", sub: (admin, tenant) => planSummary(tenant), Icon: Crown, color: A.vip, keywords: ["Plan", "Facturación", "Suscripción", "Trial"] },
];

const OPEN_MAP = { infoNegocio: ["mi-negocio", "info"], impuesto: ["mi-negocio", "info"], metodosPago: ["finanzas", "metodos-pago"], recibo: ["finanzas", "pos-recibo"], seguridad: ["cuenta", "seguridad"] };
const titleOf = (s, admin) => (typeof s.title === "function" ? s.title(admin) : s.title);
const norm = (v) => String(v || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

function DeleteAccountDialog({ open, tenantId, onClose }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  useEffect(() => { if (open) { setBusy(false); setError(null); } }, [open]);
  if (!open || typeof document === "undefined") return null;
  const confirm = async () => {
    setBusy(true); setError(null);
    const { error: e } = await supabase.rpc("request_tenant_deletion", { p_tenant_id: tenantId });
    if (e) { setError(e.message || "No se pudo procesar la solicitud."); setBusy(false); return; }
    await signOut();
  };
  return createPortal(
    <div className="apple-type fixed inset-0 flex items-end sm:items-center justify-center" style={{ zIndex: 330 }} role="alertdialog" aria-modal="true">
      <div className="absolute inset-0" style={{ background: "rgba(0,0,0,0.6)" }} onClick={() => !busy && onClose()} />
      <div className="relative w-full sm:w-[400px] flex flex-col items-center" style={{ background: "#1C1C1E", borderRadius: 28, padding: "28px 20px 20px", color: "#fff" }}>
        <span style={{ width: 76, height: 76, borderRadius: 999, background: tint(A.danger, 0.12), color: A.danger, display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 16 }}><Trash2 className="w-8 h-8" /></span>
        <p style={{ fontSize: 20, fontWeight: 800 }}>¿Borrar tu cuenta?</p>
        <p style={{ fontSize: 14, color: A.sub, margin: "8px 0 20px", textAlign: "center" }}>Se eliminará permanentemente tu taller, clientes, órdenes, ventas e inventario en 30 días. Puedes reactivar entrando antes de esa fecha. Esta acción no se puede deshacer después de 30 días.</p>
        <div className="w-full flex flex-col" style={{ gap: 10 }}>
          <ErrorLine message={error ? `Error al borrar cuenta: ${error}` : null} />
          <button onClick={confirm} disabled={busy} className="apple-press w-full flex items-center justify-center gap-2 disabled:opacity-60" style={{ height: 52, borderRadius: 14, background: "#FF453A", color: "#fff", fontSize: 15, fontWeight: 700 }}>{busy ? <Loader2 className="w-5 h-5 animate-spin" /> : null} Sí, borrar mi cuenta</button>
          <button onClick={onClose} disabled={busy} className="apple-press w-full" style={{ height: 44, borderRadius: 14, color: A.sub, fontSize: 15, fontWeight: 500 }}>Cancelar</button>
        </div>
      </div>
    </div>,
    document.body
  );
}

function EquipoList({ tenant, tenantId, admin, go }) {
  const navigate = useNavigate();
  const [codeOpen, setCodeOpen] = useState(false);
  const code = workshopCode(tenantId);
  return (
    <SubPage title={admin ? "Equipo" : "Mi Turno"} onBack={() => go(null)}>
      <Group header="Mi horario" pad={false}>
        <Row first Icon={CalendarDays} color={A.teal} title="Mi horario" sub="Mi horario y recordatorios" onClick={() => navigate("/Equipo?tab=horario")} />
        <Row Icon={Clock} color={A.brand} title="Mi turno y pago" sub="Horas, ponches y pago del periodo" onClick={() => navigate("/Equipo?tab=turno")} />
      </Group>
      {admin && (
        <Group header="Equipo" pad={false}>
          <Row first Icon={QrCode} color={A.brand} title="Código del taller" sub="Compártelo con tus empleados para que accedan desde su propio dispositivo" right={<span style={{ fontFamily: "ui-monospace, Menlo, monospace", fontWeight: 800, fontSize: 14 }}>{code}</span>} onClick={() => setCodeOpen(true)} />
          <Row Icon={Users} color={A.info} title="Empleados" sub="Equipo, roles, PIN, acceso" locked={!isPlanTeamOrAbove(tenant)} onClick={() => navigate("/Equipo?tab=empleados")} />
          <Row Icon={ClipboardCheck} color={A.warning} title="Tareas de Turno" sub={tenant ? shiftTaskSummary(tenant) : "Sin configurar"} onClick={() => navigate("/Equipo?tab=tareas")} />
        </Group>
      )}
      <WorkshopCodeDialog open={codeOpen} onClose={() => setCodeOpen(false)} tenant={tenant} tenantId={tenantId} />
    </SubPage>
  );
}

function Tile({ s, admin, tenant, onOpen }) {
  const Icon = s.Icon;
  return (
    <button onClick={onOpen} className="apple-press flex flex-col text-left justify-between" style={{ background: A.card, borderRadius: 16, padding: 12, minHeight: 124 }}>
      <span style={{ width: 44, height: 44, borderRadius: 8, background: tint(s.color, 0.16), color: s.color, display: "flex", alignItems: "center", justifyContent: "center" }}><Icon className="w-5 h-5" /></span>
      <span>
        <span className="block truncate" style={{ fontSize: 15, fontWeight: 700 }}>{titleOf(s, admin)}</span>
        <span className="block" style={{ fontSize: 11, color: A.sub, overflow: "hidden", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" }}>{s.sub(admin, tenant)}</span>
      </span>
    </button>
  );
}

export default function Ajustes() {
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const [tenantId] = useState(() => localGet("smartfix_tenant_id", ""));
  const role = localGet("smartfix_tenant_role", "");
  const [tenant, setTenant] = useState(null);
  const [self, setSelf] = useState(null);
  const [loadError, setLoadError] = useState(null);
  const [query, setQuery] = useState("");
  const [report, setReport] = useState(false);
  const [del, setDel] = useState(false);

  const reload = useCallback(async () => { const row = await fetchTenantRow(tenantId); setTenant(row); return row; }, [tenantId]);
  useEffect(() => {
    if (!tenantId) return;
    reload().catch((e) => setLoadError(e?.message || String(e)));
    resolveCurrentEmployee(tenantId).then(setSelf, () => setSelf(null));
  }, [tenantId, reload]);

  const admin = isAdminRole(role) || (!role && !!self && isAdminLevel(rolesOf(self)));
  const isOwner = String(role).toLowerCase() === "owner";
  const visible = useMemo(() => SECTIONS.filter((s) => (!s.admin || admin) && (!s.chat || hasInternalChat(tenant))), [admin, tenant]);

  const section = params.get("section") || "";
  const screen = params.get("screen") || "";
  const openKey = params.get("open") || "";
  const known = SECTIONS.some((s) => s.id === section);
  const active = visible.find((s) => s.id === section) || null;

  useEffect(() => {
    if (!openKey) return;
    if (openKey === "empleados") { navigate("/Equipo?tab=empleados", { replace: true }); return; }
    const target = OPEN_MAP[openKey];
    if (target && tenant) { setParams({ section: target[0], screen: target[1] }, { replace: true }); return; }
    if (!target) setParams({}, { replace: true });
  }, [openKey, tenant, navigate, setParams]);

  useEffect(() => { if (section === "mensajes" && active) navigate("/Equipo?tab=mensajes", { replace: true }); }, [section, active, navigate]);

  const go = useCallback((sec, scr) => {
    if (!sec) { setParams({}); return; }
    setParams(scr ? { section: sec, screen: scr } : { section: sec });
  }, [setParams]);

  const hits = useMemo(() => {
    const q = norm(query.trim());
    if (!q) return null;
    const out = [];
    visible.forEach((s) => {
      const title = titleOf(s, admin);
      if (norm(title).includes(q) || norm(s.sub(admin, tenant)).includes(q)) out.push({ key: s.id, s, label: title });
      s.keywords.forEach((k) => { if (norm(k).includes(q)) out.push({ key: `${s.id}-${k}`, s, label: k }); });
    });
    return out;
  }, [query, visible, admin, tenant]);

  if (!tenantId) return <Navigate to="/Login" replace />;
  if (section === "ofertas") return <Navigate to="/Settings?section=taller&screen=ofertas" replace />;
  if (section && !known && section !== "mensajes") {
    if (!admin) return <Navigate to="/Settings" replace />;
    const qs = params.toString();
    return <Navigate to={`/SettingsLegacy${qs ? `?${qs}` : ""}`} replace />;
  }

  const shell = (child) => (
    <div className="apple-type min-h-dvh" style={{ background: "#000", color: "#fff" }}>
      <div className="app-container" style={{ padding: "24px 16px 96px" }}>{child}</div>
    </div>
  );

  if (active && (tenant || active.id === "equipo")) {
    const back = () => go(active.id);
    const common = { tenant, tenantId, reload, back };
    const s = screen;
    let view = null;
    if (active.id === "mi-negocio") view = s === "info" ? <InfoNegocio {...common} /> : s === "apariencia" ? <Apariencia back={back} /> : s === "region" ? <Region {...common} /> : <MiNegocioList tenant={tenant} go={go} />;
    else if (active.id === "finanzas") view = s === "metodos-pago" ? <MetodosPago {...common} /> : s === "pos-recibo" ? <PosRecibo {...common} /> : s === "gastos-fijos" ? <GastosFijos {...common} /> : <FinanzasList tenant={tenant} go={go} />;
    else if (active.id === "taller") view = s === "tipo-negocio" ? <TipoNegocio {...common} /> : s === "estados" ? <EstadosOrden {...common} /> : s === "ofertas" ? <OfertasAjustes tenantId={tenantId} back={back} /> : s === "datos" && isPlanProOrAbove(tenant) ? <DatosTaller {...common} /> : <TallerList tenant={tenant} go={go} />;
    else if (active.id === "comunicacion") {
      const listBack = () => go("comunicacion", "plantillas");
      view = s === "plantillas" ? <PlantillasLista tenant={tenant} go={go} back={back} /> : s.startsWith("plantilla:") ? <EditorPlantilla id={s.slice(10)} tenant={tenant} tenantId={tenantId} reload={reload} back={listBack} /> : s === "politicas" ? <Politicas {...common} /> : s === "push" ? <PushSettings {...common} /> : <ComunicacionList tenant={tenant} go={go} />;
    } else if (active.id === "cuenta") view = s === "seguridad" ? <Seguridad back={back} /> : s === "diagnostico" ? <Diagnostico tenant={tenant} tenantId={tenantId} employee={self} role={role} back={back} /> : <CuentaList go={go} />;
    else if (active.id === "suscripcion") view = <Suscripcion tenant={tenant} tenantId={tenantId} back={() => go(null)} />;
    else if (active.id === "equipo") view = <EquipoList tenant={tenant} tenantId={tenantId} admin={admin} go={go} />;
    return shell(view);
  }

  if (section && !active && tenant) return <Navigate to="/Settings" replace />;

  return shell(
    <div className="mx-auto" style={{ maxWidth: 1400 }}>
      <h1 style={{ fontSize: 34, fontWeight: 800, letterSpacing: "-0.02em", marginBottom: 14 }}>Ajustes</h1>
      <div className="flex items-center gap-2" style={{ background: A.card, borderRadius: 12, padding: "10px 12px", border: `1px solid ${tint(A.brand, 0.18)}`, marginBottom: 16 }}>
        <Search className="w-4 h-4" style={{ color: A.sub }} />
        <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Buscar ajuste: IVU, empleados, recibo…" aria-label="Buscar ajuste" className="flex-1 outline-none bg-transparent" style={{ fontSize: 16, color: "#fff" }} />
        {query && <button onClick={() => setQuery("")} aria-label="Limpiar búsqueda" style={{ color: A.sub }}><X className="w-4 h-4" /></button>}
      </div>
      <ErrorLine message={loadError ? `No se pudo cargar tu taller: ${loadError}` : null} />
      {hits ? (
        hits.length ? (
          <div style={{ background: A.card, borderRadius: 16, overflow: "hidden" }}>
            {hits.map((h, i) => { const Icon = h.s.Icon; return (
              <button key={h.key} onClick={() => go(h.s.id)} className="apple-press w-full flex items-center gap-3 text-left" style={{ padding: "12px 16px", borderTop: i ? `0.5px solid ${A.sep}` : "none" }}>
                <span style={{ width: 32, height: 32, borderRadius: 8, background: tint(h.s.color, 0.14), color: h.s.color, display: "flex", alignItems: "center", justifyContent: "center" }}><Icon className="w-4 h-4" /></span>
                <span className="flex-1 min-w-0"><span className="block" style={{ fontSize: 16 }}>{h.label}</span><span className="block" style={{ fontSize: 12, color: A.sub }}>{titleOf(h.s, admin)}</span></span>
                <ChevronRight className="w-4 h-4" style={{ color: A.ter }} />
              </button>); })}
          </div>
        ) : (
          <div className="flex flex-col items-center" style={{ gap: 10, padding: "60px 0", color: A.sub }}><SearchX className="w-10 h-10" /><p>Nada coincide con &quot;{query}&quot;</p></div>
        )
      ) : (
        <div className="flex flex-col" style={{ gap: 24 }}>
          <div className="grid" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(min(100%, 200px), 1fr))", gap: 12 }}>
            {visible.map((s) => <Tile key={s.id} s={s} admin={admin} tenant={tenant} onOpen={() => go(s.id)} />)}
          </div>
          <Group header="Acerca de Archilla OS" pad={false}>
            <div className="flex justify-between" style={{ padding: "13px 16px" }}><span>Versión</span><span style={{ fontFamily: "ui-monospace, Menlo, monospace", color: A.sub }}>web</span></div>
            <div className="flex justify-between" style={{ padding: "13px 16px", borderTop: `0.5px solid ${A.sep}` }}><span>Build</span><span style={{ fontFamily: "ui-monospace, Menlo, monospace", color: A.sub }}>{BUILD}</span></div>
            <a href="https://smartfixos.com/privacy" target="_blank" rel="noopener noreferrer" className="apple-press flex justify-between items-center" style={{ padding: "13px 16px", borderTop: `0.5px solid ${A.sep}`, color: A.brand }}>Política de Privacidad <ExternalLink className="w-4 h-4" /></a>
            <a href="https://smartfixos.com/terms" target="_blank" rel="noopener noreferrer" className="apple-press flex justify-between items-center" style={{ padding: "13px 16px", borderTop: `0.5px solid ${A.sep}`, color: A.brand }}>Términos de Uso <ExternalLink className="w-4 h-4" /></a>
            <button onClick={() => setReport(true)} className="apple-press flex justify-between items-center w-full text-left" style={{ padding: "13px 16px", borderTop: `0.5px solid ${A.sep}`, color: A.brand }}>Reportar problema <ChevronRight className="w-4 h-4" style={{ color: A.ter }} /></button>
          </Group>
          <p style={{ fontSize: 12, color: A.sub, textAlign: "center" }}>© 2026 archistudios · Archilla OS. Todos los derechos reservados.</p>
          <div>
            <button onClick={requestAppLock} className="apple-press w-full flex items-center justify-center gap-2" style={{ padding: "17px 0", borderRadius: 16, background: A.brand, color: "#fff", fontSize: 17, fontWeight: 700 }}><Lock className="w-5 h-5" /> Bloquear app</button>
            <p style={{ fontSize: 12, color: A.sub, textAlign: "center", marginTop: 6 }}>Bloquea con PIN. Tu sesión y PIN se conservan — al volver entras directo.</p>
          </div>
          {isOwner && (
            <div className="flex flex-col items-center" style={{ gap: 6 }}>
              <button onClick={() => setDel(true)} className="apple-press flex items-center gap-2" style={{ color: A.danger, fontWeight: 600 }}><Trash2 className="w-4 h-4" /> Borrar mi cuenta</button>
              <p style={{ fontSize: 12, color: A.sub, textAlign: "center", maxWidth: 520 }}>Borrar tu cuenta elimina permanentemente tu taller, clientes, órdenes, ventas e inventario. Se procesa en 30 días — puedes reactivar entrando antes de esa fecha.</p>
            </div>
          )}
        </div>
      )}
      <ReportarProblema open={report} onClose={() => setReport(false)} tenant={tenant} tenantId={tenantId} employee={self} />
      <DeleteAccountDialog open={del} tenantId={tenantId} onClose={() => setDel(false)} />
    </div>
  );
}

