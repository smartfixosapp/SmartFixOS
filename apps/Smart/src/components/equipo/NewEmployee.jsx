import { useEffect, useState } from "react";
import { Loader2, Check, Copy } from "lucide-react";
import { Dialog, TextAction, tint } from "@/components/pos/native/posUi";
import { Banner, Input, W } from "@/components/wizard/ui";
import { ASSIGNABLE_ON_CREATE, ROLE_META, primaryRole, createEmployee, sendWelcomeEmail, shareAccessText, shareText, copyText, roleLabels, rolesOf, roleColor } from "@/lib/teamApi";

const BRAND = "#F2662E";

export default function NewEmployeeDialog({ open, onClose, tenant, tenantId, onCreated }) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [roles, setRoles] = useState(["technician"]);
  const [rate, setRate] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [result, setResult] = useState(null);
  const [copied, setCopied] = useState(false);
  const [note, setNote] = useState(null);

  useEffect(() => {
    if (!open) return;
    setName(""); setEmail(""); setPhone(""); setRoles(["technician"]); setRate(""); setBusy(false); setError(null); setResult(null); setCopied(false); setNote(null);
  }, [open]);
  useEffect(() => { if (!copied) return undefined; const t = setTimeout(() => setCopied(false), 2000); return () => clearTimeout(t); }, [copied]);

  const toggle = (r) => setRoles((prev) => { const has = prev.includes(r); if (has && prev.length === 1) return prev; return has ? prev.filter((x) => x !== r) : [...prev, r]; });

  const create = async () => {
    if (!name.trim() || busy) return;
    setBusy(true);
    setError(null);
    try {
      const { employee, pin } = await createEmployee(tenantId, { fullName: name, email, phone, roles, hourlyRate: rate });
      let emailState = null;
      if (String(employee.email || "").trim()) {
        try { emailState = (await sendWelcomeEmail({ tenant, tenantId, employee, pin })) ? "sent" : "failed"; } catch { emailState = "failed"; }
      }
      setResult({ employee, pin, emailState });
      onCreated?.(employee);
    } catch (e) {
      setError(`No se pudo crear: ${e?.message || e}`);
    } finally {
      setBusy(false);
    }
  };

  if (result) {
    const emp = result.employee;
    const text = shareAccessText(emp, result.pin);
    return (
      <Dialog open={open} onClose={onClose} title="Acceso creado" width={460} leading={<span />} trailing={<span />}>
        <div className="flex flex-col items-center text-center" style={{ gap: 12, paddingTop: 8 }}>
          <span style={{ width: 64, height: 64, borderRadius: 999, background: tint("#4DC780", 0.16), color: "#4DC780", display: "flex", alignItems: "center", justifyContent: "center" }}><Check className="w-8 h-8" strokeWidth={3} /></span>
          <p style={{ fontSize: 22, fontWeight: 800 }}>¡Empleado creado!</p>
          <p style={{ fontSize: 16, fontWeight: 600, color: roleColor(emp) }}>{emp.full_name}</p>
          <p style={{ fontSize: 13, color: W.sub }}>{roleLabels(rolesOf(emp)).join(" · ")}</p>
          <div className="w-full" style={{ padding: 14, borderRadius: 16, background: "#2C2C2E" }}>
            <p style={{ fontSize: 11, fontWeight: 800, letterSpacing: "0.06em", color: W.sub }}>PIN DE ACCESO</p>
            <div className="flex justify-center" style={{ gap: 8, margin: "10px 0" }}>{result.pin.split("").map((d, i) => <span key={i} style={{ width: 48, height: 58, borderRadius: 12, background: "#1C1C1E", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 28, fontWeight: 800, fontFamily: "ui-monospace, Menlo, monospace" }}>{d}</span>)}</div>
            <button onClick={async () => setCopied(await copyText(result.pin))} className="apple-press" style={{ color: copied ? "#4DC780" : BRAND, fontWeight: 700, fontSize: 14 }}><Copy className="w-3.5 h-3.5 inline" /> {copied ? "¡Copiado!" : "Copiar PIN"}</button>
          </div>
          {result.emailState && <p style={{ fontSize: 13, color: result.emailState === "sent" ? "#4DC780" : "#FFA640" }}>{result.emailState === "sent" ? `Email enviado a ${emp.email}` : "No se pudo enviar el email — comparte el PIN manualmente"}</p>}
          <div className="w-full text-left" style={{ fontSize: 13, color: W.sub }}>
            <p style={{ fontWeight: 700, color: "#fff", marginBottom: 4 }}>¿Cómo accede el empleado?</p>
            <p>1. Abre Archilla OS en el dispositivo del taller</p>
            <p>2. Toca &quot;Cambiar usuario&quot; en la pantalla de inicio o en el menú del Dashboard</p>
            <p>3. Ingresa su PIN de 4 dígitos para acceder</p>
          </div>
          <button onClick={async () => { const ok = await shareText(text); setNote(ok ? (navigator.share ? null : "Acceso copiado") : "No se pudo compartir"); }} className="apple-press w-full" style={{ padding: "12px 0", borderRadius: 14, background: "#3A3A3C", fontWeight: 700 }}>Compartir acceso</button>
          <a href={`https://wa.me/?text=${encodeURIComponent(text)}`} target="_blank" rel="noopener noreferrer" className="apple-press w-full" style={{ padding: "12px 0", borderRadius: 14, background: "#25A244", color: "#fff", fontWeight: 700, textAlign: "center" }}>Enviar por WhatsApp</a>
          {note && <p style={{ fontSize: 12, color: W.sub }}>{note}</p>}
          <button onClick={onClose} className="apple-press w-full" style={{ padding: "13px 0", borderRadius: 14, background: BRAND, color: "#fff", fontWeight: 700, fontSize: 16 }}>Listo</button>
        </div>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onClose={() => !busy && onClose()} dismissable={!busy} title="Nuevo empleado" width={480} height="90dvh" leading={<TextAction onClick={onClose} disabled={busy}>Cancelar</TextAction>} trailing={<span />}
      footer={<button onClick={create} disabled={!name.trim() || busy} className="apple-press w-full flex items-center justify-center gap-2 disabled:opacity-50" style={{ padding: "14px 0", borderRadius: 14, background: BRAND, color: "#fff", fontSize: 16, fontWeight: 700 }}>{busy ? <Loader2 className="w-5 h-5 animate-spin" /> : null} Crear empleado</button>}>
      <div className="flex flex-col" style={{ gap: 12, paddingTop: 8 }}>
        <p style={{ fontSize: 12, fontWeight: 700, letterSpacing: "0.06em", color: W.sub, textTransform: "uppercase" }}>Datos del empleado</p>
        <Input label="Nombre completo" value={name} onChange={setName} autoFocus />
        <Input label="Email (opcional)" value={email} onChange={setEmail} type="email" />
        <Input label="Teléfono (opcional)" value={phone} onChange={setPhone} inputMode="tel" />
        <p style={{ fontSize: 12, fontWeight: 700, letterSpacing: "0.06em", color: W.sub, textTransform: "uppercase", marginTop: 4 }}>Roles</p>
        <div style={{ borderRadius: 14, background: "#2C2C2E", overflow: "hidden" }}>
          {ASSIGNABLE_ON_CREATE.map((r, i) => {
            const on = roles.includes(r);
            return (
              <button key={r} onClick={() => toggle(r)} className="apple-press w-full flex items-center gap-3 text-left" style={{ padding: "12px 14px", borderTop: i ? `0.5px solid ${W.sep}` : "none" }}>
                <span className="flex-1" style={{ fontSize: 15, color: ROLE_META[r].color, fontWeight: 600 }}>{ROLE_META[r].label}</span>
                {on && <Check className="w-4 h-4" style={{ color: BRAND }} strokeWidth={3} />}
              </button>
            );
          })}
        </div>
        <p style={{ fontSize: 12, color: W.sub }}>Puedes marcar varios — los permisos se suman. Rol principal: {ROLE_META[primaryRole(roles)].label}.</p>
        <p style={{ fontSize: 12, fontWeight: 700, letterSpacing: "0.06em", color: W.sub, textTransform: "uppercase", marginTop: 4 }}>Compensación</p>
        <div className="flex items-center" style={{ background: "#2C2C2E", borderRadius: 12, padding: "0 14px", height: 48 }}>
          <span className="flex-1" style={{ fontSize: 15 }}>Pago por hora</span>
          <span style={{ color: W.sub, marginRight: 4 }}>$</span>
          <input value={rate} onChange={(e) => { const r = e.target.value.replace(",", "."); if (/^\d*\.?\d{0,2}$/.test(r)) setRate(r); }} inputMode="decimal" placeholder="0.00" aria-label="Pago por hora" className="bg-transparent outline-none text-right" style={{ width: 90, color: "#fff", fontSize: 16 }} />
        </div>
        <p style={{ fontSize: 12, color: W.sub }}>Se generará un PIN temporal automáticamente. Si el empleado tiene email, recibirá las instrucciones de acceso y podrá crear su propio PIN al primer ingreso.</p>
        {error && <Banner color="#FF7373">{error}</Banner>}
      </div>
    </Dialog>
  );
}
