import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Loader2, QrCode, Users, CalendarClock, ClipboardCheck, History, MessagesSquare, Clock, Wallet } from "lucide-react";
import { W } from "@/components/wizard/ui";
import { tint } from "@/components/pos/native/posUi";
import { fetchTenant, resolveCurrentEmployee } from "@/lib/orderDetailApi";
import { fetchEmployees, fetchEmployeesLite, rolesOf, isAdminLevel, shiftTaskSummary } from "@/lib/teamApi";
import { workshopCode } from "@/lib/punchApi";
import Empleados from "@/components/equipo/Empleados";
import Nomina from "@/components/equipo/Nomina";
import { TareasConfig, HistorialHoy } from "@/components/equipo/Tareas";
import { MiHorario } from "@/components/equipo/Schedule";
import MiTurno from "@/components/equipo/MiTurno";
import Mensajes from "@/components/equipo/Chat";
import WorkshopCodeDialog from "@/components/equipo/WorkshopCode";

const BRAND = "#F2662E";

export default function Equipo() {
  const [params, setParams] = useSearchParams();
  const [tenantId] = useState(() => { try { return localStorage.getItem("smartfix_tenant_id") || ""; } catch { return ""; } });
  const [tenant, setTenant] = useState(null);
  const [self, setSelf] = useState(undefined);
  const [employees, setEmployees] = useState([]);
  const [codeOpen, setCodeOpen] = useState(false);

  useEffect(() => {
    if (!tenantId) { setSelf(null); return; }
    fetchTenant(tenantId).then(setTenant).catch(() => {});
    resolveCurrentEmployee(tenantId).then((s) => {
      setSelf(s);
      (isAdminLevel(rolesOf(s)) ? fetchEmployees : fetchEmployeesLite)(tenantId).then(setEmployees).catch(() => {});
    }, () => setSelf(null));
  }, [tenantId]);

  const refreshSelf = () => resolveCurrentEmployee(tenantId).then(setSelf).catch(() => {});

  const admin = !!self && isAdminLevel(rolesOf(self));
  const tabs = useMemo(() => {
    const t = [];
    if (admin) t.push(["empleados", "Empleados", Users], ["nomina", "Nómina y Horario", Wallet], ["tareas", "Tareas de Turno", ClipboardCheck], ["historial", "Historial hoy", History]);
    t.push(["horario", "Mi horario", CalendarClock], ["turno", "Mi turno y pago", Clock], ["mensajes", "Mensajes", MessagesSquare]);
    return t;
  }, [admin]);
  const requested = params.get("tab");
  const tab = tabs.some((t) => t[0] === requested) ? requested : tabs[0][0];
  const setTab = (k) => { const n = new URLSearchParams(params); n.set("tab", k); setParams(n, { replace: true }); };

  if (self === undefined) return <div className="apple-type min-h-dvh flex items-center justify-center" style={{ background: "#000", color: "#fff" }}><Loader2 className="w-6 h-6 animate-spin" /></div>;

  const name = String(self?.full_name || "").trim() || "Empleado";
  return (
    <div className="apple-type min-h-dvh" style={{ background: "#000", color: "#fff" }}>
      <div className="app-container" style={{ padding: "24px 16px 96px" }}>
        <div className="flex items-center gap-3 flex-wrap" style={{ marginBottom: 14 }}>
          <div className="flex-1 min-w-0"><h1 style={{ fontSize: 32, fontWeight: 800, letterSpacing: "-0.02em" }}>{admin ? "Equipo" : "Mi Turno"}</h1><p style={{ fontSize: 13, color: W.sub }}>{admin ? `Horario, tareas y empleados${tenant ? ` · Tareas: ${shiftTaskSummary(tenant)}` : ""}` : "Mi horario y recordatorios"}</p></div>
          {admin && <button onClick={() => setCodeOpen(true)} className="apple-press flex items-center gap-2" style={{ padding: "10px 14px", borderRadius: 14, background: "#1C1C1E" }}><QrCode className="w-4 h-4" style={{ color: BRAND }} /><span style={{ fontSize: 13, color: W.sub }}>Código del taller</span><b style={{ fontFamily: "ui-monospace, Menlo, monospace", letterSpacing: "0.05em" }}>{workshopCode(tenantId)}</b></button>}
        </div>
        <div className="flex overflow-x-auto" style={{ gap: 8, paddingBottom: 12 }}>
          {tabs.map(([k, label, Icon]) => <button key={k} onClick={() => setTab(k)} className="apple-press flex items-center gap-2 whitespace-nowrap" style={{ padding: "9px 16px", borderRadius: 999, background: tab === k ? tint(BRAND, 0.18) : "#1C1C1E", color: tab === k ? BRAND : "#fff", fontSize: 14, fontWeight: 700 }}><Icon className="w-4 h-4" /> {label}</button>)}
        </div>
        {tab === "empleados" && admin && <Empleados tenant={tenant} tenantId={tenantId} self={self} onSelfUpdated={refreshSelf} />}
        {tab === "nomina" && admin && <Nomina tenant={tenant} tenantId={tenantId} self={self} />}
        {tab === "tareas" && admin && <TareasConfig tenant={tenant} tenantId={tenantId} onSaved={(settings) => setTenant((t) => ({ ...t, settings }))} />}
        {tab === "historial" && admin && <HistorialHoy tenant={tenant} tenantId={tenantId} employeeName={name} />}
        {tab === "horario" && <MiHorario employee={self} />}
        {tab === "turno" && <MiTurno tenant={tenant} tenantId={tenantId} self={self} />}
        {tab === "mensajes" && <Mensajes tenantId={tenantId} self={self} employees={employees} initialChannel={params.get("channel")} initialTitle={params.get("title")} />}
      </div>
      <WorkshopCodeDialog open={codeOpen} onClose={() => setCodeOpen(false)} tenant={tenant} tenantId={tenantId} />
    </div>
  );
}
