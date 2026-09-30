import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Settings, Clock, Users, LogOut, Loader2 } from "lucide-react";
import { Dialog, TextAction, AlertDialog } from "@/components/pos/native/posUi";
import { ownerPinExists } from "@/lib/posApi";
import { SignOutConfirm } from "@/components/layout/AccountMenu";
import { FP } from "@/lib/finance/ledger";
import { fmt } from "@/lib/finance/tz";
import { loadMiTurno } from "@/lib/inicioApi";
import { currentAuthUid } from "@/lib/punchApi";
import { requestAppLock } from "@/components/auth/AppLock";

export const firstName = (name) => String(name || "").trim().split(/\s+/)[0] || "";
export const avatarInitials = (name) => {
  const n = String(name || "").trim();
  if (!n) return "?";
  return n.split(/\s+/).slice(0, 2).map((w) => w[0]).join("").toUpperCase();
};

function LiveClock({ tz }) {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);
  return <span style={{ fontSize: 15, color: "#8E8E93", fontVariantNumeric: "tabular-nums", fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace" }}>{fmt(now, tz, { hour: "numeric", minute: "2-digit" })}</span>;
}

const WEEKDAYS = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"];

export function MiTurnoDialog({ open, onClose, tenantId, employee, tz }) {
  const [state, setState] = useState({ loading: true, hours: 0, rate: 0, schedule: null });
  useEffect(() => {
    if (!open) return;
    let alive = true;
    setState((s) => ({ ...s, loading: true }));
    currentAuthUid().then((uid) => loadMiTurno({ tenantId, employee, authUid: uid, tz })).then(
      (r) => { if (alive) setState({ loading: false, ...r }); },
      () => { if (alive) setState({ loading: false, hours: 0, rate: 0, schedule: null }); },
    );
    return () => { alive = false; };
  }, [open, tenantId, employee?.id, tz]);
  const row = (l, v, strong) => (
    <div className="flex items-center justify-between" style={{ padding: "12px 14px" }}>
      <span style={{ fontSize: strong ? 17 : 15, fontWeight: strong ? 600 : 400 }}>{l}</span>
      <span style={{ fontSize: strong ? 17 : 15, fontWeight: strong ? 700 : 400, color: strong ? FP.success : "#8E8E93", fontVariantNumeric: "tabular-nums" }}>{v}</span>
    </div>
  );
  const days = state.schedule?.days?.filter((d) => d.enabled) || [];
  return (
    <Dialog open={open} onClose={onClose} title="Mi turno y pago" width={440} leading={<span />} trailing={<TextAction bold onClick={onClose}>Cerrar</TextAction>}>
      <p style={{ fontSize: 13, color: "#8E8E93", padding: "12px 4px 6px" }}>Tu pago esta semana</p>
      <div style={{ borderRadius: 12, background: "#2C2C2E" }}>
        {state.loading ? <div className="flex justify-center" style={{ padding: 16 }}><Loader2 className="w-5 h-5 animate-spin" style={{ color: "#8E8E93" }} /></div> : (
          <>
            {row("Horas trabajadas", `${state.hours.toFixed(1)} h`)}
            <div style={{ height: 0.5, background: "rgba(84,84,88,0.6)", marginLeft: 14 }} />
            {row("Tarifa", state.rate > 0 ? `$${state.rate.toFixed(2)}/h` : "—")}
            <div style={{ height: 0.5, background: "rgba(84,84,88,0.6)", marginLeft: 14 }} />
            {row("Pago acumulado", `$${(state.hours * state.rate).toFixed(2)}`, true)}
          </>
        )}
      </div>
      {!state.loading && days.length > 0 && (
        <>
          <p style={{ fontSize: 13, color: "#8E8E93", padding: "18px 4px 6px" }}>Tu horario</p>
          <div style={{ borderRadius: 12, background: "#2C2C2E" }}>
            {days.map((d, i) => (
              <div key={d.weekday} className="flex items-center justify-between" style={{ padding: "12px 14px", borderTop: i ? "0.5px solid rgba(84,84,88,0.6)" : "none" }}>
                <span style={{ fontSize: 15, textTransform: "capitalize" }}>{WEEKDAYS[Math.max(0, Math.min(6, (d.weekday || 1) - 1))]}</span>
                <span style={{ fontSize: 15, color: "#8E8E93", fontVariantNumeric: "tabular-nums" }}>{`${d.startHour}:${String(d.startMinute).padStart(2, "0")} – ${d.endHour}:${String(d.endMinute).padStart(2, "0")}`}</span>
              </div>
            ))}
          </div>
        </>
      )}
    </Dialog>
  );
}

function AvatarMenu({ employeeName, logoUrl, onMiTurno, onSwitchUser }) {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const [logoOk, setLogoOk] = useState(true);
  const ref = useRef(null);
  useEffect(() => {
    if (!open) return undefined;
    const onDown = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    const onKey = (e) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => { document.removeEventListener("mousedown", onDown); document.removeEventListener("keydown", onKey); };
  }, [open]);
  const item = (Icon, label, onClick, color = "#fff") => (
    <button role="menuitem" onClick={() => { setOpen(false); onClick(); }} className="w-full flex items-center gap-3 text-left hover:bg-white/5" style={{ padding: "12px 16px", color, fontSize: 15 }}>
      <Icon className="w-[18px] h-[18px]" /> {label}
    </button>
  );
  return (
    <div className="relative" ref={ref}>
      <button onClick={() => setOpen((v) => !v)} aria-haspopup="menu" aria-expanded={open} aria-label="Mi cuenta" className="apple-press"
        style={{ width: 44, height: 44, borderRadius: 999, overflow: "hidden", background: FP.brand, color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, fontSize: 15, border: "1px solid rgba(255,255,255,0.08)" }}>
        {logoUrl && logoOk ? <img src={logoUrl} alt="" onError={() => setLogoOk(false)} style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : avatarInitials(employeeName)}
      </button>
      {open && (
        <div role="menu" className="absolute right-0 z-[120] overflow-hidden" style={{ top: 52, width: 250, background: "#1C1C1E", borderRadius: 16, border: "0.5px solid rgba(255,255,255,0.1)", boxShadow: "0 16px 40px rgba(0,0,0,0.5)" }}>
          <p className="truncate" style={{ padding: "12px 16px", fontSize: 13, color: "#8E8E93", borderBottom: "0.5px solid rgba(255,255,255,0.1)" }}>{employeeName || "Mi cuenta"}</p>
          {item(Clock, "Mi turno y pago", onMiTurno)}
          {item(Settings, "Ajustes", () => navigate("/Settings"))}
          {item(Users, "Cambiar de usuario", onSwitchUser)}
          <div style={{ height: 0.5, background: "rgba(255,255,255,0.1)" }} />
          {item(LogOut, "Cerrar sesión", () => setConfirm(true), "#FF6961")}
        </div>
      )}
      <SignOutConfirm open={confirm} onClose={() => setConfirm(false)} />
    </div>
  );
}

export default function InicioHeader({ employee, tenant, tz, wide, tenantId }) {
  const navigate = useNavigate();
  const [miTurno, setMiTurno] = useState(false);
  const [pinNeeded, setPinNeeded] = useState(false);
  const switchUser = async () => {
    let role = "";
    try { role = localStorage.getItem("smartfix_tenant_role") || ""; } catch { role = ""; }
    if (role === "owner") {
      const exists = await ownerPinExists(tenantId).catch(() => false);
      if (!exists) { setPinNeeded(true); return; }
    }
    requestAppLock();
  };
  const name = String(employee?.full_name || "").trim();
  const first = firstName(name);
  return (
    <div className="flex items-start gap-3">
      <div className="flex-1 min-w-0 flex flex-col" style={{ gap: 6 }}>
        <h2 className="truncate" style={{ margin: 0, fontSize: wide ? 42 : 32, fontWeight: 800, letterSpacing: "-0.02em", lineHeight: 1.1 }}>{first ? `Hola, ${first}` : "Hola"}</h2>
        <LiveClock tz={tz} />
      </div>
      {!wide && (
        <button onClick={() => navigate("/Settings")} aria-label="Ajustes" className="apple-press" style={{ width: 44, height: 44, borderRadius: 999, background: "#1C1C1E", border: "1px solid #2C2C2E", color: "#8E8E93", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <Settings className="w-5 h-5" />
        </button>
      )}
      <AvatarMenu employeeName={name} logoUrl={tenant?.logo_url} onMiTurno={() => setMiTurno(true)} onSwitchUser={switchUser} />
      <AlertDialog open={pinNeeded} title="Primero crea tu PIN de dueño" message="Crea tu PIN de dueño en la app Archilla OS (Ajustes, Seguridad) para poder cambiar de usuario." onClose={() => setPinNeeded(false)} actions={[{ label: "Entendido", bold: true }]} />
      <MiTurnoDialog open={miTurno} onClose={() => setMiTurno(false)} tenantId={tenantId} employee={employee} tz={tz} />
    </div>
  );
}
