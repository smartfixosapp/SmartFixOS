import { useEffect, useRef, useState } from "react";
import { Landmark, Home, Users, ShoppingCart, CheckCircle2, Loader2 } from "lucide-react";
import { Dialog, TextAction, AlertDialog, ErrorBanner, tint } from "@/components/pos/native/posUi";
import { FP } from "@/lib/finance/ledger";
import { money, cardStyle, Empty } from "./ui";

export const STANDARD_METHODS = [["cash", "Efectivo"], ["card", "Tarjeta"], ["ath_movil", "ATH Móvil"]];
export const PAYROLL_PAY_METHODS = [["cash", "Efectivo"], ["ath_movil", "ATH Móvil"], ["transfer", "Transferencia"]];

function PartialPayDialog({ open, name, totalDue, accent, methods, onClose, onConfirm }) {
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState(methods[0]?.[0] || "cash");
  useEffect(() => { if (open) { setAmount(totalDue.toFixed(2)); setMethod(methods[0]?.[0] || "cash"); } }, [open, totalDue, methods]);
  const entered = Number(String(amount).replace(",", ".")) || 0;
  const partial = entered > 0 && entered < totalDue - 0.01;
  return (
    <Dialog open={open} onClose={onClose} title={name} width={460}
      leading={<TextAction onClick={onClose}>Cancelar</TextAction>}
      trailing={<TextAction bold color={accent} disabled={entered <= 0} onClick={() => { onConfirm(Math.min(entered, totalDue), method); onClose(); }}>Confirmar</TextAction>}>
      <p style={{ fontSize: 12, color: "#8E8E93", textTransform: "uppercase", margin: "12px 4px 6px" }}>Monto a pagar de {money(totalDue)}</p>
      <div style={{ borderRadius: 12, background: "#2C2C2E", padding: "10px 14px" }}>
        <div className="flex items-center gap-1.5">
          <span style={{ fontSize: 22, color: "#8E8E93" }}>$</span>
          <input autoFocus value={amount} onChange={(e) => setAmount(e.target.value)} inputMode="decimal" style={{ flex: 1, background: "transparent", border: "none", outline: "none", color: "#fff", fontSize: 22, fontWeight: 700 }} />
        </div>
        {partial && <p style={{ fontSize: 12, color: "#8E8E93", marginTop: 4 }}>Pago parcial · queda {money(Math.max(0, totalDue - entered))} pendiente</p>}
      </div>
      <p style={{ fontSize: 12, color: "#8E8E93", textTransform: "uppercase", margin: "18px 4px 6px" }}>Método de pago</p>
      <div className="grid" style={{ gridTemplateColumns: `repeat(${methods.length}, 1fr)`, padding: 2, gap: 2, borderRadius: 9, background: "rgba(118,118,128,0.24)" }}>
        {methods.map(([k, l]) => <button key={k} onClick={() => setMethod(k)} style={{ padding: "6px 4px", borderRadius: 7, fontSize: 13, fontWeight: 600, background: method === k ? "#636366" : "transparent" }}>{l}</button>)}
      </div>
    </Dialog>
  );
}

function PagarLine({ name, subtitle, amount, accent, methods, allowsPartial, overdue, onPay }) {
  const [busy, setBusy] = useState(false);
  const [picker, setPicker] = useState(false);
  const [partial, setPartial] = useState(false);
  const run = async (amt, m) => {
    setBusy(true);
    try { await onPay(amt, m); } finally { setBusy(false); }
  };
  return (
    <div className="flex items-center gap-2" style={{ padding: "10px 12px" }}>
      <div className="flex-1 min-w-0">
        <p className="truncate" style={{ fontSize: 15, fontWeight: 600 }}>{name}</p>
        <p className="truncate" style={{ fontSize: 12, fontWeight: overdue ? 600 : 400, color: overdue ? FP.danger : "#8E8E93" }}>{subtitle}</p>
      </div>
      <span style={{ fontSize: 15, fontWeight: 700 }}>{money(amount)}</span>
      <button onClick={() => (allowsPartial ? setPartial(true) : setPicker(true))} disabled={busy} className="apple-press"
        style={{ height: 32, padding: "0 12px", borderRadius: 999, background: accent, color: "#fff", fontSize: 12, fontWeight: 700, minWidth: 60, display: "flex", alignItems: "center", justifyContent: "center" }}>
        {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : "Pagar"}
      </button>
      <AlertDialog open={picker} title="Método de pago" onClose={() => setPicker(false)}
        actions={[...methods.map(([k, l]) => ({ label: l, onPress: () => run(amount, k) })), { label: "Cancelar", bold: true }]} />
      <PartialPayDialog open={partial} name={name} totalDue={amount} accent={accent} methods={methods} onClose={() => setPartial(false)} onConfirm={(a, m) => run(a, m)} />
    </div>
  );
}

function GroupCard({ Icon, title, color, total, children }) {
  return (
    <div style={cardStyle}>
      <div className="flex items-center gap-2" style={{ padding: "12px 12px 8px" }}>
        <Icon className="w-5 h-5" style={{ color }} />
        <span className="flex-1" style={{ fontSize: 17, fontWeight: 700 }}>{title}</span>
        <span style={{ fontSize: 17, fontWeight: 700, color }}>{money(total)}</span>
      </div>
      <div style={{ height: 0.5, background: "rgba(84,84,88,0.6)" }} />
      {children}
    </div>
  );
}

const Divider = () => <div style={{ height: 0.5, background: "rgba(84,84,88,0.6)", marginLeft: 12 }} />;

export default function CuentasPorPagarDialog({ open, onClose, model, monthLabel, recordedBy }) {
  const [justPaid, setJustPaid] = useState(null);
  const [bulk, setBulk] = useState(false);
  const timer = useRef(null);
  useEffect(() => () => clearTimeout(timer.current), []);
  useEffect(() => { if (!open) setJustPaid(null); }, [open]);
  const m = model;
  const hasAny = m.totalCuentasPorPagar > 0;
  const pendingCount = (m.pendingIVU > 0 ? 1 : 0) + m.unpaidRecurring.length + m.pendingPayrollLines.filter((l) => l.gross > 0).length + m.pendingPOs.length;
  const today = new Date().getDate();

  const afterPay = (tx, name, amount, methodLabel) => {
    if (!tx) return;
    const rec = { tx, name, amount, methodLabel };
    setJustPaid(rec);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setJustPaid((j) => (j?.tx.id === rec.tx.id ? null : j)), 6000);
  };

  const label = (methods, k) => (methods.find(([x]) => x === k) || [k, k])[1];

  return (
    <>
      <Dialog open={open} onClose={onClose} title="Cuentas por pagar" width={760} height="90dvh" leading={<span />} trailing={<TextAction onClick={onClose}>Cerrar</TextAction>}>
        <div className="flex flex-col" style={{ gap: 16, paddingTop: 8 }}>
          <div style={{ ...cardStyle, padding: 16 }}>
            <p style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.04em", color: "#8E8E93" }}>TOTAL POR PAGAR</p>
            <p style={{ fontSize: 38, fontWeight: 800, color: FP.sale, fontVariantNumeric: "tabular-nums" }}>{money(m.totalCuentasPorPagar)}</p>
            {hasAny && (
              <button onClick={() => setBulk(true)} disabled={m.payingAll} className="apple-press w-full" style={{ marginTop: 8, height: 40, borderRadius: 12, background: FP.sale, color: "#fff", fontSize: 15, fontWeight: 700 }}>
                {m.payingAll ? <Loader2 className="w-5 h-5 animate-spin mx-auto" /> : "Pagar todo"}
              </button>
            )}
          </div>
          <ErrorBanner message={m.error} onDismiss={m.clearError} />
          {justPaid && (
            <div className="flex items-center gap-2" style={{ padding: 12, borderRadius: 16, background: tint(FP.success, 0.12) }}>
              <CheckCircle2 className="w-5 h-5" style={{ color: FP.success }} />
              <div className="flex-1">
                <p style={{ fontSize: 15, fontWeight: 600 }}>{justPaid.name} · {money(justPaid.amount)}</p>
                <p style={{ fontSize: 12, color: "#8E8E93" }}>Pagado por {String(recordedBy || "").trim() || "Web"} · {justPaid.methodLabel}</p>
              </div>
              <button onClick={async () => { const rec = justPaid; setJustPaid(null); await m.undo(rec.tx); }} style={{ fontSize: 12, fontWeight: 700, color: FP.brand }}>Deshacer</button>
            </div>
          )}
          {m.payrollError && <ErrorBanner message={m.payrollError} />}
          {!hasAny ? (
            !m.payrollError && <div style={{ paddingTop: 20 }}><Empty>Todo al día. No hay cuentas por pagar.</Empty></div>
          ) : (
            <>
              {m.pendingIVU > 0 && (
                <GroupCard Icon={Landmark} title="Impuestos" color={FP.comprometido} total={m.pendingIVU}>
                  <PagarLine name={`IVU de ${monthLabel}`} subtitle="Impuesto sobre ventas" amount={m.pendingIVU} accent={FP.comprometido} methods={STANDARD_METHODS}
                    onPay={async (_, k) => { const amt = m.pendingIVU; const tx = await m.payIVU(k); afterPay(tx, `IVU de ${monthLabel}`, amt, label(STANDARD_METHODS, k)); }} />
                </GroupCard>
              )}
              {m.unpaidRecurring.length > 0 && (
                <GroupCard Icon={Home} title="Gastos fijos" color={FP.warning} total={m.fixedPendingTotal}>
                  {m.unpaidRecurring.map((item, i) => {
                    const overdue = item.day_of_month < today;
                    return (
                      <div key={item.id}>
                        {i > 0 && <Divider />}
                        <PagarLine name={item.name} subtitle={overdue ? `Vencido · día ${item.day_of_month}` : `Fijo · vence día ${item.day_of_month}`} amount={m.recurringRemaining(item)}
                          accent={overdue ? FP.danger : FP.warning} methods={STANDARD_METHODS} allowsPartial overdue={overdue}
                          onPay={async (amt, k) => { const tx = await m.payRecurring(item, amt, k); afterPay(tx, item.name, amt, label(STANDARD_METHODS, k)); }} />
                      </div>
                    );
                  })}
                </GroupCard>
              )}
              {m.pendingPayrollLines.some((l) => l.gross > 0) && (
                <GroupCard Icon={Users} title="Nómina" color={FP.nomina} total={m.pendingPayrollTotal}>
                  {m.pendingPayrollLines.filter((l) => l.balance > 0).map((l, i) => {
                    const note = l.hasUnperiodedPayments ? `Pago sin período ${money(l.unperiodedPaid)}` : null;
                    return (
                      <div key={l.id}>
                        {i > 0 && <Divider />}
                        <PagarLine name={l.employee.full_name} subtitle={note || `${l.hours.toFixed(1)} h · ${m.payrollPeriodLabel}`} amount={l.balance}
                          accent={FP.nomina} methods={PAYROLL_PAY_METHODS} allowsPartial overdue={!!note}
                          onPay={async (amt, k) => { const tx = await m.payEmployee(l.employee, amt, k); afterPay(tx, l.employee.full_name, amt, label(PAYROLL_PAY_METHODS, k)); }} />
                      </div>
                    );
                  })}
                </GroupCard>
              )}
              {m.pendingPOs.length > 0 && (
                <GroupCard Icon={ShoppingCart} title="Compras" color={FP.info} total={m.pendingPOsTotal}>
                  {m.pendingPOs.map((po, i) => (
                    <div key={po.id}>
                      {i > 0 && <Divider />}
                      <PagarLine name={po.supplier_name || "Suplidor desconocido"} subtitle={`Orden de compra · ${po.po_number || ""}`} amount={Number(po.total_amount) || 0}
                        accent={FP.info} methods={STANDARD_METHODS}
                        onPay={async (_, k) => { const tx = await m.payPO(po, k); afterPay(tx, po.supplier_name || "Suplidor desconocido", Number(po.total_amount) || 0, label(STANDARD_METHODS, k)); }} />
                    </div>
                  ))}
                </GroupCard>
              )}
            </>
          )}
        </div>
      </Dialog>
      <AlertDialog
        open={bulk}
        title={`Pagar ${pendingCount} partidas por ${money(m.totalCuentasPorPagar)}?`}
        message={m.unperiodedPayrollWarning || undefined}
        onClose={() => setBulk(false)}
        actions={[{ label: "Confirmar, pagar todo", onPress: m.payEverything }, { label: "Cancelar", bold: true }]}
      />
    </>
  );
}
