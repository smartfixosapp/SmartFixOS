import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  X, Lock, LockOpen, Minus, Plus, Undo2, Star, Loader2, Banknote, CreditCard, Smartphone,
  MinusCircle, AlertTriangle, RotateCw, BadgeCheck, CheckCircle2, AlertCircle, UserRoundCheck, RefreshCw,
} from "lucide-react";
import {
  DENOMINATIONS, emptyCounts, countsTotal, sameCounts, usd, savedDenoms, saveDenoms, lastCloseKey, standardKey,
  openRegister, fetchShiftSummary, summaryChanged, fetchOpenTimeEntries, closeRegister, RegisterAlreadyClosedError,
  canCloseCashRegister, employeeDisplayName, openDuration, sendClosingEmail, EMPTY_SUMMARY, expectedCashFor,
} from "@/lib/cashRegisterApi";
import { useEscapeLayer } from "@/components/orderDetail/ui";
import { closeEntry, isFromEarlierDay } from "@/lib/punchApi";

export const K = {
  bg: "#000",
  card: "#1C1C1E",
  card2: "#2C2C2E",
  fill: "rgba(118,118,128,0.24)",
  text: "#fff",
  sub: "#8E8E93",
  ter: "rgba(235,235,245,0.3)",
  brand: "#F2662E",
  success: "#4DC780",
  warning: "#FFA640",
  danger: "#FF7373",
  info: "#66B3FF",
  vip: "#FFC733",
  sep: "rgba(84,84,88,0.6)",
};

export function tintK(hex, a) {
  const alpha = Math.round(Math.max(0, Math.min(1, a)) * 255).toString(16).padStart(2, "0");
  return `${hex}${alpha}`;
}

function initials(name) {
  const n = String(name || "").trim();
  if (!n) return "?";
  return n.split(/\s+/).slice(0, 2).map((w) => w[0]).join("").toUpperCase();
}

function FullSheet({ open, onClose, children, footer, dismissable = true }) {
  useEscapeLayer(open, () => { if (dismissable) onClose?.(); });
  if (!open || typeof document === "undefined") return null;
  return createPortal(
    <div className="apple-type fixed inset-0 z-[320] flex items-end sm:items-center justify-center" role="dialog" aria-modal="true">
      <div className="absolute inset-0" style={{ background: "rgba(0,0,0,0.65)" }} onClick={() => dismissable && onClose?.()} />
      <div className="relative w-full flex flex-col" style={{ maxWidth: 580, height: "94dvh", background: K.bg, borderRadius: 24, color: K.text, overflow: "hidden" }}>
        <div className="flex-1 overflow-y-auto" style={{ padding: "18px 16px 24px" }}>{children}</div>
        {footer && (
          <div style={{ padding: 20, background: "rgba(28,28,30,0.92)", backdropFilter: "blur(20px)", WebkitBackdropFilter: "blur(20px)", borderTop: `0.5px solid ${K.sep}` }}>
            {footer}
          </div>
        )}
      </div>
    </div>,
    document.body
  );
}

function ModalHeader({ color, Icon, title, subtitle, onClose }) {
  return (
    <div className="flex items-center gap-3">
      <span style={{ width: 44, height: 44, borderRadius: 12, background: color, boxShadow: `0 4px 16px ${tintK(color, 0.45)}`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
        <Icon className="w-5 h-5" style={{ color: "#fff" }} strokeWidth={2.4} />
      </span>
      <div className="flex-1 min-w-0">
        <p style={{ fontSize: 20, fontWeight: 700, lineHeight: 1.2 }}>{title}</p>
        <p style={{ fontSize: 12, color: K.sub }}>{subtitle}</p>
      </div>
      <button onClick={onClose} aria-label="Cerrar" className="apple-press" style={{ width: 30, height: 30, borderRadius: 999, background: K.card2, color: K.sub, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <X className="w-3.5 h-3.5" strokeWidth={3} />
      </button>
    </div>
  );
}

function SectionTitle({ children }) {
  return <p style={{ fontSize: 12, fontWeight: 600, letterSpacing: "0.04em", color: K.sub, textTransform: "uppercase", marginBottom: 8 }}>{children}</p>;
}

function ErrorBanner({ message, onDismiss }) {
  if (!message) return null;
  return (
    <div className="flex items-start gap-2" style={{ padding: 12, borderRadius: 12, background: tintK(K.danger, 0.12), border: `1px solid ${tintK(K.danger, 0.3)}` }}>
      <AlertCircle className="w-4 h-4 flex-shrink-0" style={{ color: K.danger, marginTop: 2 }} />
      <p className="flex-1" style={{ fontSize: 13, color: K.text }}>{message}</p>
      <button onClick={onDismiss} aria-label="Cerrar aviso" style={{ color: K.sub }}><X className="w-4 h-4" /></button>
    </div>
  );
}

export function DenominationCard({ denom, qty, onChange }) {
  const color = denom.isCoin ? K.brand : K.success;
  const has = qty > 0;
  const [editing, setEditing] = useState(false);
  const [typed, setTyped] = useState("");
  const holdTimer = useRef(null);
  const repeatTimer = useRef(null);
  const qtyRef = useRef(qty);
  qtyRef.current = qty;

  const stopHold = useCallback(() => {
    clearTimeout(holdTimer.current);
    clearInterval(repeatTimer.current);
    holdTimer.current = null;
    repeatTimer.current = null;
  }, []);

  useEffect(() => stopHold, [stopHold]);

  const bump = (step) => onChange(Math.max(0, qtyRef.current + step));

  const startHold = (e) => {
    if (e.pointerType === "mouse" && e.button !== 0) return;
    e.preventDefault();
    if (holdTimer.current || repeatTimer.current) return;
    bump(1);
    holdTimer.current = setTimeout(() => {
      repeatTimer.current = setInterval(() => bump(1), 100);
    }, 450);
  };

  const commitTyped = () => {
    const n = parseInt(typed, 10);
    onChange(Number.isFinite(n) && n >= 0 ? n : qty);
    setEditing(false);
  };

  return (
    <div className="flex flex-col items-center" style={{ gap: 8, padding: 12, background: K.card, borderRadius: 14, border: `1px solid ${has ? tintK(color, 0.3) : "rgba(84,84,88,0.35)"}` }}>
      <span className="w-full text-center" style={{ fontSize: 15, fontWeight: 700, color, background: tintK(color, 0.14), borderRadius: 8, padding: "6px 0" }}>{denom.label}</span>
      <div style={{ height: 44, width: "100%", display: "flex", alignItems: "center", justifyContent: "center" }}>
        {editing ? (
          <input
            autoFocus
            inputMode="numeric"
            value={typed}
            onChange={(e) => setTyped(e.target.value.replace(/[^\d]/g, ""))}
            onBlur={commitTyped}
            onKeyDown={(e) => {
              if (e.key === "Enter") commitTyped();
              if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); setEditing(false); }
            }}
            placeholder="0"
            style={{ width: "100%", textAlign: "center", fontSize: 36, fontWeight: 800, background: "transparent", color: K.text, border: `1px solid ${color}`, borderRadius: 8, outline: "none", height: 44 }}
          />
        ) : (
          <button
            onClick={() => { setTyped(has ? String(qty) : ""); setEditing(true); }}
            className="w-full"
            style={{ fontSize: 36, fontWeight: 800, color: has ? K.text : K.ter, fontVariantNumeric: "tabular-nums", lineHeight: "44px" }}
          >
            {qty}
          </button>
        )}
      </div>
      <div className="flex items-center" style={{ gap: 14 }}>
        <button
          onClick={() => bump(-1)}
          disabled={!has}
          aria-label={`Quitar ${denom.label}`}
          className="apple-press"
          style={{ width: 36, height: 36, borderRadius: 999, background: has ? tintK(color, 0.14) : K.fill, color: has ? color : K.ter, display: "flex", alignItems: "center", justifyContent: "center" }}
        >
          <Minus className="w-4 h-4" strokeWidth={3} />
        </button>
        <button
          onPointerDown={startHold}
          onClick={(e) => { if (e.detail === 0) bump(1); }}
          onPointerUp={stopHold}
          onPointerLeave={stopHold}
          onPointerCancel={stopHold}
          onContextMenu={(e) => e.preventDefault()}
          aria-label={`Añadir ${denom.label}`}
          className="apple-press select-none"
          style={{ width: 36, height: 36, borderRadius: 999, background: color, color: "#fff", boxShadow: `0 3px 12px ${tintK(color, 0.35)}`, display: "flex", alignItems: "center", justifyContent: "center", touchAction: "none" }}
        >
          <Plus className="w-4 h-4" strokeWidth={3} />
        </button>
      </div>
      <div className="flex items-center" style={{ gap: 4 }}>
        {[5, 10, 20].map((n) => (
          <button key={n} onClick={() => bump(n)} style={{ fontSize: 11, fontWeight: 700, color, background: tintK(color, 0.14), borderRadius: 999, padding: "4px 8px" }}>+{n}</button>
        ))}
        {has && (
          <button onClick={() => onChange(0)} aria-label="Reiniciar" style={{ color: K.sub, background: K.fill, borderRadius: 999, padding: "4px 8px" }}>
            <X className="w-3 h-3" strokeWidth={3} />
          </button>
        )}
      </div>
      <span style={{ fontSize: 12, fontWeight: 600, color: has ? color : K.ter, fontVariantNumeric: "tabular-nums" }}>{usd(qty * denom.value)}</span>
    </div>
  );
}

function DenominationGrid({ counts, setCounts }) {
  const set = (id) => (q) => setCounts((c) => ({ ...c, [id]: q }));
  return (
    <>
      <div>
        <SectionTitle>Billetes</SectionTitle>
        <div className="grid grid-cols-2" style={{ gap: 8 }}>
          {DENOMINATIONS.filter((d) => !d.isCoin).map((d) => <DenominationCard key={d.id} denom={d} qty={counts[d.id] || 0} onChange={set(d.id)} />)}
        </div>
      </div>
      <div>
        <SectionTitle>Monedas</SectionTitle>
        <div className="grid grid-cols-2" style={{ gap: 8 }}>
          {DENOMINATIONS.filter((d) => d.isCoin).map((d) => <DenominationCard key={d.id} denom={d} qty={counts[d.id] || 0} onChange={set(d.id)} />)}
        </div>
      </div>
    </>
  );
}

function QuickChip({ Icon, children, onClick }) {
  return (
    <button onClick={onClick} className="apple-press inline-flex items-center" style={{ gap: 6, fontSize: 12, fontWeight: 600, padding: "8px 12px", borderRadius: 999, background: tintK(K.brand, 0.12), color: K.brand }}>
      <Icon className="w-3.5 h-3.5" /> {children}
    </button>
  );
}

export function OpenCashSheet({ open, onClose, tenantId, tenant, employee, onOpened }) {
  const [counts, setCounts] = useState(emptyCounts);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [savedTick, setSavedTick] = useState(0);

  useEffect(() => {
    if (open) {
      setCounts(emptyCounts());
      setError(null);
      setSubmitting(false);
    }
  }, [open]);

  const total = countsTotal(counts);
  const lastClose = useMemo(() => (open && tenantId ? savedDenoms(lastCloseKey(tenantId)) : null), [open, tenantId]);
  const standard = useMemo(() => (open && tenantId ? savedDenoms(standardKey(tenantId)) : null), [open, tenantId, savedTick]);
  const name = employeeDisplayName(employee);

  const submit = async () => {
    if (submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      const reg = await openRegister({ tenantId, tenant, counts, employee });
      setSubmitting(false);
      onOpened?.(reg);
      onClose?.();
    } catch (e) {
      setSubmitting(false);
      setError(e?.message || "No se pudo abrir la caja.");
    }
  };

  const footer = (
    <div className="flex flex-col" style={{ gap: 10 }}>
      <div className="flex items-center justify-between">
        <span style={{ fontSize: 12, fontWeight: 600, letterSpacing: "0.04em", color: K.sub }}>TOTAL INICIAL</span>
        <span style={{ fontSize: 32, fontWeight: 800, color: K.success, fontVariantNumeric: "tabular-nums" }}>{usd(total)}</span>
      </div>
      <button
        onClick={submit}
        disabled={submitting}
        className="apple-press flex items-center justify-center disabled:opacity-60"
        style={{ gap: 8, padding: "14px 0", borderRadius: 14, background: K.success, color: "#fff", fontSize: 16, fontWeight: 600, boxShadow: `0 6px 24px ${tintK(K.success, 0.3)}` }}
      >
        {submitting ? <Loader2 className="w-5 h-5 animate-spin" /> : <><LockOpen className="w-[18px] h-[18px]" /> {total > 0 ? "Confirmar apertura" : "Abrir caja vacía"}</>}
      </button>
    </div>
  );

  return (
    <FullSheet open={open} onClose={onClose} footer={footer}>
      <div className="flex flex-col" style={{ gap: 20 }}>
        <ModalHeader color={K.success} Icon={LockOpen} title="Abrir caja" subtitle="Cuenta el efectivo inicial" onClose={onClose} />
        <div className="flex items-center gap-3" style={{ padding: 12, background: K.card, borderRadius: 12 }}>
          <span style={{ width: 36, height: 36, borderRadius: 999, background: tintK(K.success, 0.2), color: K.success, fontSize: 14, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center" }}>{initials(employee?.full_name)}</span>
          <div>
            <p style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.03em", color: K.sub }}>ABRE LA CAJA</p>
            <p style={{ fontSize: 15, fontWeight: 600 }}>{name}</p>
          </div>
        </div>
        {(lastClose || standard || total > 0) && (
          <div>
            <SectionTitle>Inicio rápido</SectionTitle>
            <div className="flex flex-wrap" style={{ gap: 8 }}>
              {lastClose && <QuickChip Icon={Undo2} onClick={() => setCounts({ ...lastClose })}>Repetir último cierre · {usd(countsTotal(lastClose))}</QuickChip>}
              {standard && <QuickChip Icon={Star} onClick={() => setCounts({ ...standard })}>Fondo estándar · {usd(countsTotal(standard))}</QuickChip>}
              {total > 0 && !sameCounts(counts, standard || {}) && (
                <QuickChip Icon={Star} onClick={() => { saveDenoms(standardKey(tenantId), counts); setSavedTick((t) => t + 1); }}>
                  {standard ? "Actualizar fondo estándar" : "Guardar actual como estándar"}
                </QuickChip>
              )}
            </div>
          </div>
        )}
        <DenominationGrid counts={counts} setCounts={setCounts} />
        <ErrorBanner message={error} onDismiss={() => setError(null)} />
      </div>
    </FullSheet>
  );
}

function BreakdownRow({ Icon, color, label, amount, amountColor }) {
  return (
    <div className="flex items-center gap-3" style={{ padding: "8px 16px" }}>
      <span style={{ width: 28, height: 28, borderRadius: 8, background: tintK(color, 0.18), color, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <Icon className="w-3.5 h-3.5" />
      </span>
      <span className="flex-1" style={{ fontSize: 15 }}>{label}</span>
      <span style={{ fontSize: 15, fontWeight: 600, color: amountColor || K.text, fontVariantNumeric: "tabular-nums" }}>{usd(amount)}</span>
    </div>
  );
}

function BreakdownTotal({ label, amount, color }) {
  return (
    <div className="flex items-center justify-between" style={{ padding: "8px 16px", background: tintK(color, 0.06) }}>
      <span style={{ fontSize: 15, fontWeight: 700 }}>{label}</span>
      <span style={{ fontSize: 17, fontWeight: 700, color, fontVariantNumeric: "tabular-nums" }}>{usd(amount)}</span>
    </div>
  );
}

function Divider({ inset = 50 }) {
  return <div style={{ height: 0.5, background: K.sep, marginLeft: inset }} />;
}

function ConfirmDialog({ open, Icon, color, title, message, confirmLabel, cancelLabel = "Cancelar", onConfirm, onCancel }) {
  useEscapeLayer(open, onCancel);
  if (!open || typeof document === "undefined") return null;
  return createPortal(
    <div className="apple-type fixed inset-0 z-[340] flex items-center justify-center" style={{ padding: 16 }} role="alertdialog" aria-modal="true">
      <div className="absolute inset-0" style={{ background: "rgba(0,0,0,0.6)" }} onClick={onCancel} />
      <div className="relative w-full flex flex-col items-center text-center" style={{ maxWidth: 400, background: K.card, borderRadius: 24, padding: "24px 20px 18px", color: K.text }}>
        {Icon && (
          <span style={{ width: 60, height: 60, borderRadius: 999, background: tintK(color, 0.14), color, display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 14 }}>
            <Icon className="w-7 h-7" />
          </span>
        )}
        <p style={{ fontSize: 19, fontWeight: 800 }}>{title}</p>
        {message && <p style={{ fontSize: 15, color: K.sub, marginTop: 8 }}>{message}</p>}
        <div className="w-full flex flex-col" style={{ gap: 8, marginTop: 20 }}>
          <button onClick={onConfirm} className="apple-press" style={{ minHeight: 48, borderRadius: 14, background: color, color: "#fff", fontSize: 15, fontWeight: 700 }}>{confirmLabel}</button>
          {cancelLabel && <button onClick={onCancel} className="apple-press" style={{ minHeight: 44, borderRadius: 14, color: K.sub, fontSize: 15, fontWeight: 600 }}>{cancelLabel}</button>}
        </div>
      </div>
    </div>,
    document.body
  );
}

function Celebration({ data }) {
  if (!data || typeof document === "undefined") return null;
  const short = data.difference <= -0.01;
  const exact = Math.abs(data.difference) < 0.01;
  const color = short ? K.warning : K.success;
  const badge = exact ? "Cuadre exacto" : data.difference > 0 ? `Sobran ${usd(data.difference)}` : `Faltan ${usd(Math.abs(data.difference))}`;
  return createPortal(
    <div className="apple-type fixed inset-0 z-[360] flex items-center justify-center pointer-events-none" style={{ background: "rgba(0,0,0,0.55)" }}>
      <div className="flex flex-col items-center text-center" style={{ padding: "28px 32px", borderRadius: 28, background: K.card, color: K.text, minWidth: 260, boxShadow: "0 20px 60px rgba(0,0,0,0.5)" }}>
        <span style={{ width: 72, height: 72, borderRadius: 999, background: tintK(color, 0.16), color, display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 14 }}>
          <Lock className="w-8 h-8" />
        </span>
        <p style={{ fontSize: 22, fontWeight: 800 }}>Caja cerrada</p>
        <p style={{ fontSize: 15, color: K.sub, marginTop: 4 }}>Hoy entraron {usd(data.revenue)}</p>
        <span style={{ marginTop: 12, padding: "5px 12px", borderRadius: 999, background: tintK(color, 0.16), color, fontSize: 13, fontWeight: 700 }}>{badge}</span>
      </div>
    </div>,
    document.body
  );
}

export function CloseCashSheet({ open, onClose, register, tenantId, tenant, employee, onClosed, onAlreadyClosed }) {
  const [counts, setCounts] = useState(emptyCounts);
  const [observations, setObservations] = useState("");
  const [summary, setSummary] = useState(EMPTY_SUMMARY);
  const [loadingSummary, setLoadingSummary] = useState(true);
  const [summaryFailed, setSummaryFailed] = useState(false);
  const [openShifts, setOpenShifts] = useState([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [recountNotice, setRecountNotice] = useState(null);
  const [incompleteConfirm, setIncompleteConfirm] = useState(false);
  const [alreadyClosed, setAlreadyClosed] = useState(null);
  const [didClose, setDidClose] = useState(false);
  const [celebration, setCelebration] = useState(null);
  const [punchPrompt, setPunchPrompt] = useState(null);
  const [punchBusy, setPunchBusy] = useState(false);
  const [punchErr, setPunchErr] = useState(null);

  const loadSummary = useCallback(async () => {
    if (!register) return;
    setLoadingSummary(true);
    try {
      const s = await fetchShiftSummary(register, tenantId);
      setSummary(s);
      setSummaryFailed(false);
    } catch {
      setSummaryFailed(true);
    } finally {
      setLoadingSummary(false);
    }
  }, [register, tenantId]);

  useEffect(() => {
    if (!open || !register) return;
    setCounts(emptyCounts());
    setObservations("");
    setSummary(EMPTY_SUMMARY);
    setSummaryFailed(false);
    setError(null);
    setRecountNotice(null);
    setDidClose(false);
    setSubmitting(false);
    loadSummary();
    fetchOpenTimeEntries(tenantId).then(setOpenShifts).catch(() => setOpenShifts([]));
  }, [open, register?.id]);

  const opening = Number(register?.opening_balance) || 0;
  const counted = countsTotal(counts);
  const expected = expectedCashFor(opening, summary);
  const difference = counted - expected;
  const balanced = Math.abs(difference) <= 0.05;
  const diffColor = balanced ? K.success : difference < 0 ? K.danger : K.warning;
  const diffLabel = balanced ? "Cuadre exacto" : difference < 0 ? "Faltante" : "Sobrante";
  const canSubmit = counted >= 0 && !submitting && !loadingSummary && !didClose;

  const summaryStillCurrent = async () => {
    let fresh;
    try {
      fresh = await fetchShiftSummary(register, tenantId);
    } catch {
      if (summaryFailed) return true;
      setError("No se pudo actualizar el resumen del turno. Revisa tu conexión e intenta de nuevo.");
      return false;
    }
    if (summaryFailed) {
      setSummary(fresh);
      setSummaryFailed(false);
      setRecountNotice("Ya cargó el resumen del turno. Revisa el cuadre y confirma otra vez.");
      return false;
    }
    if (!summaryChanged(summary, fresh)) {
      setRecountNotice(null);
      return true;
    }
    setSummary(fresh);
    setRecountNotice("Hubo movimientos nuevos durante el conteo. Revisa el cuadre y confirma otra vez.");
    return false;
  };

  const submit = async () => {
    if (didClose || submitting || !register) return;
    if (!canCloseCashRegister({ register, employee, tenant })) {
      setError("Solo el dueño, un administrador o quien abrió la caja puede cerrarla.");
      return;
    }
    setSubmitting(true);
    setError(null);
    if (!(await summaryStillCurrent())) {
      setSubmitting(false);
      return;
    }
    const obs = observations.trim();
    const snapCounts = { ...counts };
    const snapSummary = summary;
    try {
      const res = await closeRegister({ register, counts: snapCounts, employee, summary: snapSummary, observations: obs });
      const uiExpected = res.expectedCash;
      const uiDifference = res.difference;
      setDidClose(true);
      setSubmitting(false);
      const closedAt = new Date();
      sendClosingEmail({
        tenant, register, closedBy: employeeDisplayName(employee), closedAt, opening, counted, expected: uiExpected,
        difference: uiDifference, summary: snapSummary, counts: snapCounts, observations: obs,
      });
      setCelebration({ revenue: snapSummary.totalRevenue, difference: uiDifference });
      const mine = openShifts.find((x) => !!employee?.id && String(x.employee_id || "") === String(employee.id));
      setTimeout(() => {
        setCelebration(null);
        let askPunch = false;
        try { askPunch = !!mine?.id && !isFromEarlierDay(mine, tenant?.timezone || undefined); } catch { askPunch = false; }
        if (askPunch) { setPunchPrompt(mine); return; }
        onClosed?.();
        onClose?.();
      }, 2000);
    } catch (e) {
      setSubmitting(false);
      if (e instanceof RegisterAlreadyClosedError) {
        setAlreadyClosed(e.message);
        onAlreadyClosed?.();
      } else {
        setError(e?.message || "No se pudo cerrar la caja. Intenta de nuevo.");
      }
    }
  };

  const onConfirmPress = () => {
    if (summaryFailed) setIncompleteConfirm(true);
    else submit();
  };

  const isMe = (entry) => !!employee?.id && String(entry.employee_id || "") === String(employee.id);
  const timeLabel = (iso) => {
    try {
      return new Date(iso).toLocaleTimeString("es-PR", { hour: "numeric", minute: "2-digit" });
    } catch {
      return "";
    }
  };

  const footer = (
    <div className="flex flex-col" style={{ gap: 8 }}>
      <div className="flex items-center justify-between">
        <span style={{ fontSize: 12, fontWeight: 600, letterSpacing: "0.04em", color: K.sub }}>TOTAL CONTADO</span>
        <span style={{ fontSize: 32, fontWeight: 800, color: counted > 0 ? K.text : K.sub, fontVariantNumeric: "tabular-nums" }}>{usd(counted)}</span>
      </div>
      <div className="flex items-center" style={{ gap: 4, fontSize: 13, color: diffColor }}>
        <span style={{ color: K.sub }}>Esperado {usd(expected)}</span>
        <span className="flex-1" />
        {balanced ? <CheckCircle2 className="w-3.5 h-3.5" /> : <AlertCircle className="w-3.5 h-3.5" />}
        <span style={{ fontWeight: 600 }}>{balanced ? "Cuadra" : `${difference < 0 ? "Faltante" : "Sobrante"} ${usd(Math.abs(difference))}`}</span>
      </div>
      {recountNotice && (
        <p className="flex items-center" style={{ gap: 6, fontSize: 13, fontWeight: 600, color: K.warning }}>
          <RefreshCw className="w-3.5 h-3.5 flex-shrink-0" /> {recountNotice}
        </p>
      )}
      <button
        onClick={onConfirmPress}
        disabled={!canSubmit}
        className="apple-press flex items-center justify-center"
        style={{ gap: 8, padding: "14px 0", borderRadius: 14, background: canSubmit ? K.danger : "#48484A", color: "#fff", fontSize: 16, fontWeight: 600, boxShadow: canSubmit ? `0 6px 24px ${tintK(K.danger, 0.3)}` : "none" }}
      >
        {submitting ? <Loader2 className="w-5 h-5 animate-spin" /> : <><Lock className="w-[18px] h-[18px]" /> Confirmar cierre</>}
      </button>
    </div>
  );

  return (
    <>
      <FullSheet open={open && !!register} onClose={onClose} footer={footer} dismissable={!submitting && !didClose}>
        <div className="flex flex-col" style={{ gap: 20 }}>
          <ModalHeader color={K.danger} Icon={Lock} title="Cerrar caja" subtitle="Cuenta el efectivo final" onClose={onClose} />
          <div className="flex items-center" style={{ gap: 12, padding: 12, background: K.card, borderRadius: 12 }}>
            {[
              ["ABIERTA POR", register?.opened_by || "—", K.sub],
              ["DURACIÓN", openDuration(register), K.sub],
              ["INICIO", usd(opening), K.success],
            ].map(([label, value, color], i) => (
              <React.Fragment key={label}>
                {i > 0 && <span style={{ width: 0.5, height: 36, background: K.sep }} />}
                <div className="flex-1 min-w-0">
                  <p style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.03em", color: K.sub }}>{label}</p>
                  <p className="truncate" style={{ fontSize: 15, fontWeight: 600, color }}>{value}</p>
                </div>
              </React.Fragment>
            ))}
          </div>
          <div style={{ background: K.card, borderRadius: 14, overflow: "hidden", paddingBottom: 4 }}>
            <div className="flex items-center justify-between" style={{ padding: "12px 16px 8px" }}>
              <span style={{ fontSize: 12, fontWeight: 600, letterSpacing: "0.03em", color: K.sub }}>RESUMEN DEL TURNO</span>
              {loadingSummary ? (
                <Loader2 className="w-4 h-4 animate-spin" style={{ color: K.sub }} />
              ) : (
                <span style={{ fontSize: 11, fontWeight: 600, color: K.sub, background: K.fill, borderRadius: 999, padding: "3px 8px" }}>
                  {summary.saleCount} venta{summary.saleCount === 1 ? "" : "s"}
                </span>
              )}
            </div>
            <BreakdownRow Icon={Banknote} color={K.success} label="Efectivo" amount={summary.totalCash} />
            <Divider />
            <BreakdownRow Icon={CreditCard} color={K.info} label="Tarjeta" amount={summary.totalCard} />
            <Divider />
            <BreakdownRow Icon={Smartphone} color={K.vip} label="ATH Móvil" amount={summary.totalAth} />
            <Divider inset={16} />
            <BreakdownTotal label="Ingresos totales" amount={summary.totalRevenue} color={K.success} />
            {summary.totalExpenses > 0 && (
              <>
                <Divider />
                <BreakdownRow Icon={MinusCircle} color={K.danger} label="Gastos del turno" amount={-summary.totalExpenses} amountColor={K.danger} />
                <Divider inset={16} />
                <BreakdownTotal label="Ganancia neta" amount={summary.realProfit} color={summary.realProfit >= 0 ? K.success : K.danger} />
              </>
            )}
          </div>
          {summaryFailed && (
            <div className="flex items-center" style={{ gap: 10, padding: 12, borderRadius: 12, background: "rgba(255,149,0,0.12)", border: "1px solid rgba(255,149,0,0.3)" }}>
              <AlertTriangle className="w-4 h-4 flex-shrink-0" style={{ color: "#FF9500" }} />
              <div className="flex-1">
                <p style={{ fontSize: 12, fontWeight: 600 }}>Datos del turno incompletos</p>
                <p style={{ fontSize: 11, color: K.sub }}>No se pudo cargar el resumen de ventas. El cuadre muestra solo el saldo inicial. Verifica la conexión y vuelve a intentar.</p>
              </div>
              <button onClick={loadSummary} aria-label="Reintentar" style={{ color: "#FF9500" }}><RotateCw className="w-4 h-4" /></button>
            </div>
          )}
          <div style={{ padding: 12, borderRadius: 14, background: tintK(diffColor, 0.08), border: `1px solid ${tintK(diffColor, 0.3)}` }}>
            <div className="flex items-center justify-between" style={{ marginBottom: 8 }}>
              <span style={{ fontSize: 12, fontWeight: 600, letterSpacing: "0.03em", color: K.sub }}>CUADRE</span>
              <span className="inline-flex items-center" style={{ gap: 4, fontSize: 12, fontWeight: 600, color: diffColor, background: tintK(diffColor, 0.14), borderRadius: 999, padding: "3px 8px" }}>
                {balanced ? <BadgeCheck className="w-3.5 h-3.5" /> : <AlertTriangle className="w-3.5 h-3.5" />} {diffLabel}
              </span>
            </div>
            <div className="flex items-center" style={{ gap: 4 }}>
              {[["ESPERADO", expected, K.info], ["CONTADO", counted, K.text], ["DIFERENCIA", difference, diffColor]].map(([label, value, color], i) => (
                <React.Fragment key={label}>
                  {i > 0 && <span style={{ fontSize: 12, fontWeight: 700, color: K.ter }}>{i === 1 ? "−" : "="}</span>}
                  <div className="flex-1 min-w-0">
                    <p style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.03em", color: K.sub }}>{label}</p>
                    <p className="truncate" style={{ fontSize: 15, fontWeight: 700, color, fontVariantNumeric: "tabular-nums" }}>{usd(value)}</p>
                  </div>
                </React.Fragment>
              ))}
            </div>
          </div>
          <DenominationGrid counts={counts} setCounts={setCounts} />
          <div>
            <SectionTitle>Observaciones (opcional)</SectionTitle>
            <textarea
              value={observations}
              onChange={(e) => setObservations(e.target.value)}
              placeholder="Notas sobre el cierre, faltantes, billetes dañados…"
              rows={3}
              style={{ width: "100%", padding: 12, borderRadius: 12, background: K.card, color: K.text, fontSize: 15, border: "none", outline: "none", resize: "vertical" }}
            />
          </div>
          {openShifts.length > 0 && (
            <div className="flex flex-col" style={{ gap: 8, padding: 12, background: K.card, borderRadius: 12 }}>
              <div className="flex items-center" style={{ gap: 8 }}>
                <UserRoundCheck className="w-4 h-4" style={{ color: K.info }} />
                <span style={{ fontSize: 12, fontWeight: 600, letterSpacing: "0.03em", color: K.sub }}>SIGUEN PONCHADOS</span>
              </div>
              {openShifts.map((e, i) => (
                <div key={e.id || i} className="flex items-center justify-between" style={{ gap: 8 }}>
                  <span className="truncate" style={{ fontSize: 15, fontWeight: 600 }}>{isMe(e) ? "Tú" : String(e.employee_name || "").trim() || "Empleado"}</span>
                  {e.clock_in && <span style={{ fontSize: 12, color: K.sub }}>desde {timeLabel(e.clock_in)}</span>}
                </div>
              ))}
              <p style={{ fontSize: 11, color: K.sub }}>Cerrar la caja no cierra estos turnos.</p>
            </div>
          )}
          <ErrorBanner message={error} onDismiss={() => setError(null)} />
        </div>
      </FullSheet>
      <ConfirmDialog
        open={incompleteConfirm}
        Icon={AlertTriangle}
        color={K.warning}
        title="¿Cerrar sin datos completos?"
        message="El resumen del turno no se pudo cargar. El cuadre solo incluye el saldo inicial. Puedes reintentar o cerrar igualmente."
        confirmLabel="Cerrar de todas formas"
        onConfirm={() => { setIncompleteConfirm(false); submit(); }}
        onCancel={() => setIncompleteConfirm(false)}
      />
      <ConfirmDialog
        open={!!alreadyClosed}
        Icon={Lock}
        color={K.brand}
        title="Caja cerrada"
        message={alreadyClosed}
        confirmLabel="Entendido"
        cancelLabel={null}
        onConfirm={() => { setAlreadyClosed(null); onClose?.(); }}
        onCancel={() => { setAlreadyClosed(null); onClose?.(); }}
      />
      <ConfirmDialog
        open={!!punchPrompt}
        Icon={UserRoundCheck}
        color={K.brand}
        title="¿Ponchar salida también?"
        message={punchErr || (punchPrompt?.clock_in ? `Cerraste la caja del día. Tu turno sigue abierto desde ${timeLabel(punchPrompt.clock_in)}. ¿Ponchar tu salida ahora?` : "Cerraste la caja del día. ¿Quieres registrar tu salida ahora para cerrar tu turno?")}
        confirmLabel={punchBusy ? "Ponchando…" : "Ponchar salida"}
        cancelLabel="No, sigo trabajando"
        onConfirm={async () => {
          if (punchBusy) return;
          setPunchBusy(true);
          setPunchErr(null);
          try { await closeEntry({ entryId: punchPrompt.id, tenantId }); } catch (e) { setPunchBusy(false); setPunchErr(e?.message || "No se pudo ponchar la salida. Ciérrala desde Ponchar."); return; }
          setPunchBusy(false);
          setPunchPrompt(null);
          onClosed?.();
          onClose?.();
        }}
        onCancel={() => { if (punchBusy) return; setPunchErr(null); setPunchPrompt(null); onClosed?.(); onClose?.(); }}
      />
      <Celebration data={celebration} />
    </>
  );
}
