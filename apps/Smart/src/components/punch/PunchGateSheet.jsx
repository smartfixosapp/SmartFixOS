import { useMemo, useState } from "react";
import { Clock, AlertTriangle, Loader2 } from "lucide-react";
import { AlertDialog } from "@/components/pos/native/posUi";
import { C, Sheet, Btn, tint } from "@/components/orderDetail/ui";
import { safeTZ } from "@/lib/finance/tz";
import {
  matchIdsFor, fetchOpenEntry, punchIn, closeAutomatically, requiresAutomaticClose, isFromEarlierDay, automaticCloseMessage, punchTimeLabel, entryIn,
  saveLastPunchEmployee, PunchError,
} from "@/lib/punchApi";
import { fetchTenant } from "@/lib/orderDetailApi";
import { PunchPinScreen } from "./PunchKiosk";

export default function PunchGateSheet({ open, context, tenantId, tenant, sessionEmployee, authUid, onClose, onPunched }) {
  const tz = safeTZ(tenant?.timezone);
  const [pinOpen, setPinOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [stale, setStale] = useState(null);
  const selfIds = useMemo(() => matchIdsFor(sessionEmployee, authUid), [sessionEmployee, authUid]);

  const finish = (employee) => {
    saveLastPunchEmployee(tenantId, employee.full_name);
    onPunched?.();
    onClose();
  };

  const clockIn = async (employee) => {
    try {
      await punchIn({ tenantId, employee });
      finish(employee);
    } catch (e) {
      if (e instanceof PunchError && e.kind === "alreadyOpen") { await handleOpen(e.entry, employee); return; }
      setError("No se pudo confirmar el ponche. Revisa tu conexión e intenta de nuevo.");
    }
  };

  const handleOpen = async (entry, employee) => {
    if (isFromEarlierDay(entry, tz)) {
      try {
        const fresh = await fetchTenant(tenantId);
        const hours = fresh?.settings?.business_hours;
        if (requiresAutomaticClose(entry, hours, tz)) {
          setStale({ entry, employee, hours });
          return;
        }
      } catch {
        setError("No se pudo confirmar el ponche. Revisa tu conexión e intenta de nuevo.");
        return;
      }
    }
    finish(employee);
  };

  const onVerified = async (employee) => {
    setPinOpen(false);
    setError(null);
    if (!employee?.id || !selfIds.includes(employee.id)) {
      setError(`Ese PIN es de ${String(employee?.full_name || "otra persona").trim()}. Para continuar tienes que ponchar tú mismo.`);
      return;
    }
    setBusy(true);
    try {
      const open = await fetchOpenEntry(tenantId, matchIdsFor(employee, authUid));
      if (open) await handleOpen(open, employee);
      else await clockIn(employee);
    } catch {
      setError("Sin conexión. Intenta de nuevo.");
    }
    setBusy(false);
  };

  const closeStaleAndPunch = async (s) => {
    if (!s) return;
    setBusy(true);
    try {
      await closeAutomatically(s.entry, s.hours, tz, tenantId);
      await clockIn(s.employee);
    } catch {
      setError("No se pudo confirmar el ponche. Revisa tu conexión e intenta de nuevo.");
    }
    setBusy(false);
  };

  return (
    <>
      <Sheet
        open={open && !pinOpen}
        onClose={busy ? undefined : onClose}
        title="Ponchar entrada"
        width={440}
        dismissable={!busy}
        footer={(
          <div className="flex flex-col gap-2">
            <Btn onClick={() => { setError(null); setPinOpen(true); }} disabled={busy}>{busy ? "Un momento…" : "Ponchar entrada y continuar"}</Btn>
            <Btn onClick={onClose} disabled={busy} variant="ghost">Ahora no</Btn>
          </div>
        )}
      >
        <div className="flex flex-col gap-3">
          <div style={{ padding: 14, borderRadius: 16, background: C.card2 }}>
            <div className="flex items-center gap-3">
              <span style={{ width: 40, height: 40, borderRadius: 12, background: tint(C.brand, 0.18), color: C.brand, display: "flex", alignItems: "center", justifyContent: "center" }}><Clock className="w-5 h-5" /></span>
              <span className="flex-1">
                <span className="block" style={{ fontSize: 15, fontWeight: 600 }}>Turno no iniciado</span>
                <span className="block" style={{ fontSize: 12, color: C.sub }}>Registra tu entrada para continuar</span>
              </span>
            </div>
            <div className="flex items-center justify-between" style={{ marginTop: 12, paddingTop: 12, borderTop: `0.5px solid ${C.sep}`, fontSize: 14 }}>
              <span style={{ color: C.sub }}>Destino</span>
              <span style={{ fontWeight: 600, color: C.brand }}>{context}</span>
            </div>
          </div>
          <div className="flex items-center gap-3" style={{ padding: 14, borderRadius: 16, background: C.card2 }}>
            <span style={{ width: 40, height: 40, borderRadius: 12, background: tint(C.amber, 0.18), color: C.amber, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}><AlertTriangle className="w-5 h-5" /></span>
            <span>
              <span className="block" style={{ fontSize: 15, fontWeight: 600 }}>Horas sin registrar</span>
              <span className="block" style={{ fontSize: 12, color: C.sub }}>Ponchar entrada ahora asegura que tus horas queden correctas.</span>
            </span>
          </div>
          {busy && <p className="flex items-center justify-center gap-2" style={{ fontSize: 13, color: C.sub }}><Loader2 className="w-4 h-4 animate-spin" /> Registrando…</p>}
          {error && <p style={{ fontSize: 13, color: C.red }}>{error}</p>}
        </div>
      </Sheet>
      {pinOpen && <PunchPinScreen tenantId={tenantId} title="Ponchar entrada" onCancel={() => setPinOpen(false)} onVerified={onVerified} />}
      <AlertDialog
        open={!!stale}
        title={stale ? `Tienes un turno abierto desde ${punchTimeLabel(entryIn(stale.entry), tz)}` : ""}
        message={stale ? automaticCloseMessage(entryIn(stale.entry), stale.hours, tz) : ""}
        onClose={() => setStale(null)}
        actions={[{ label: "Cerrar y ponchar entrada", bold: true, onPress: () => closeStaleAndPunch(stale) }, { label: "Dejarlo abierto", onPress: () => stale && finish(stale.employee) }]}
      />
    </>
  );
}
