import React, { useEffect, useMemo, useState } from "react";
import QRCode from "qrcode";
import { DollarSign, Wallet, Undo2, ChevronRight, Banknote, CreditCard, Smartphone, QrCode, Lock, BadgeCheck, ArrowLeftRight, Plus, Pencil, Trash2, Loader2 } from "lucide-react";
import { orderTotal, remainingBalance } from "@/lib/orderEmails";
import { PAYMENT_METHODS, methodLabel, tenantPaymentMethods, listDeposits, listRefunds } from "@/lib/orderMoneyApi";
import { C, tint, Sheet, Btn, money, displayDevice } from "./ui";

const METHOD_ICON = { cash: Banknote, card: CreditCard, ath_movil: Smartphone };
const GOLD = "#D4A017";

function parseAmount(v) {
  const x = parseFloat(String(v || "").replace(",", "."));
  return Number.isFinite(x) ? x : 0;
}

export function CashClosedSheet({ open, onClose, message, onOpenRegister, onGoHome }) {
  return (
    <Sheet open={open} onClose={onClose} width={420}>
      <div className="flex flex-col items-center text-center" style={{ paddingTop: 16 }}>
        <span style={{ width: 64, height: 64, borderRadius: 999, background: tint(C.amber, 0.14), color: C.amber, display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 16 }}>
          <Lock className="w-7 h-7" />
        </span>
        <p style={{ fontSize: 19, fontWeight: 800 }}>Caja cerrada</p>
        <p style={{ fontSize: 15, color: C.sub, marginTop: 8 }}>{message || "Abre la caja antes de registrar un cobro o depósito."}</p>
        <div className="w-full flex flex-col gap-2" style={{ marginTop: 22 }}>
          <Btn onClick={onOpenRegister}>Abrir caja aquí</Btn>
          <Btn onClick={onGoHome} variant="secondary">Ir al Inicio</Btn>
          <Btn onClick={onClose} variant="ghost">Cancelar</Btn>
        </div>
      </div>
    </Sheet>
  );
}

export function CobrarMenuSheet({ open, onClose, order, onFull, onDeposit, onRefund }) {
  if (!order) return null;
  const balance = remainingBalance(order);
  const paid = !!order.paid;
  const Option = ({ Icon, title, subtitle, onClick, highlight, danger, iconColor }) => (
    <button onClick={onClick} className="apple-press w-full flex items-center gap-3 text-left"
      style={{ padding: 16, borderRadius: 20, background: highlight ? `linear-gradient(135deg, ${C.brand}, #E5532A)` : C.card2 }}>
      <span style={{ width: 44, height: 44, borderRadius: 12, background: highlight ? "rgba(255,255,255,0.22)" : tint(iconColor, 0.15), color: highlight ? "#fff" : iconColor, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
        <Icon className="w-5 h-5" />
      </span>
      <span className="flex-1 min-w-0">
        <span className="block" style={{ fontSize: 16, fontWeight: 700, color: highlight ? "#fff" : danger ? C.red : C.text }}>{title}</span>
        <span className="block" style={{ fontSize: 13, color: highlight ? "rgba(255,255,255,0.85)" : C.sub }}>{subtitle}</span>
      </span>
      <ChevronRight className="w-4 h-4" style={{ color: highlight ? "#fff" : C.sub }} />
    </button>
  );
  return (
    <Sheet open={open} onClose={onClose} title="Cobrar" width={480}>
      <div className="flex flex-col items-center text-center" style={{ padding: "8px 0 18px" }}>
        <p style={{ fontSize: 12, fontWeight: 700, letterSpacing: "0.06em", color: C.sub }}>{paid ? "ORDEN SALDADA" : "BALANCE PENDIENTE"}</p>
        <p style={{ fontSize: 44, fontWeight: 900, color: paid ? C.green : C.text, lineHeight: 1.1 }}>{paid ? "✓" : money(balance)}</p>
        <p style={{ fontSize: 13, color: C.sub }}>{order.order_number} · {displayDevice(order)}</p>
      </div>
      <div className="flex flex-col gap-2">
        {balance > 0 && <Option Icon={DollarSign} title={`Cobrar ${money(balance)}`} subtitle="Cobro completo del balance" onClick={onFull} highlight />}
        {balance > 0 && <Option Icon={Wallet} title="Depósito" subtitle="Abonar parte del balance — los mismos métodos de siempre" onClick={onDeposit} iconColor={C.amber} />}
        {Number(order.amount_paid || 0) > 0 && <Option Icon={Undo2} title="Devolver" subtitle="Reembolsar dinero ya cobrado" onClick={onRefund} danger iconColor={C.red} />}
      </div>
    </Sheet>
  );
}

function MethodChip({ label, Icon, color, selected, onClick }) {
  return (
    <button onClick={onClick} className="apple-press flex-1 flex flex-col items-center justify-center gap-1"
      style={{ minHeight: 64, padding: "8px 6px", borderRadius: 14, background: selected ? color : tint(color, 0.14), border: `1px solid ${selected ? color : tint(color, 0.3)}`, color: selected ? "#fff" : color, fontSize: 13, fontWeight: 700, boxShadow: selected ? `0 4px 14px ${tint(color, 0.35)}` : "none" }}>
      <Icon className="w-5 h-5" />
      {label}
    </button>
  );
}

function QRView({ config, amount, customerName, shopName, onPaid, onCancel, methodName }) {
  const [src, setSrc] = useState(null);
  useEffect(() => {
    if (config?.imageBase64) {
      const b = String(config.imageBase64);
      setSrc(b.startsWith("data:") ? b : `data:image/png;base64,${b}`);
    } else if (config?.paymentURL) {
      QRCode.toDataURL(config.paymentURL, { margin: 1, width: 560 }).then(setSrc, () => setSrc(null));
    } else setSrc(null);
  }, [config]);
  return (
    <div className="flex flex-col items-center text-center">
      <p style={{ fontSize: 16, fontWeight: 700 }}>{methodName}</p>
      <p style={{ fontSize: 12, fontWeight: 700, letterSpacing: "0.06em", color: C.sub, marginTop: 14 }}>MONTO A COBRAR</p>
      <p style={{ fontSize: 44, fontWeight: 900, color: C.green, lineHeight: 1.1 }}>{money(amount)}</p>
      {customerName && <p style={{ fontSize: 14, color: C.sub }}>De {customerName}</p>}
      <div style={{ background: "#fff", borderRadius: 20, padding: 16, marginTop: 16 }}>
        {src ? <img src={src} alt="QR de pago" style={{ width: 280, maxWidth: "100%", height: "auto" }} /> : <div style={{ width: 240, padding: 30, color: "#666", fontSize: 14 }}><QrCode className="w-10 h-10 mx-auto" />No hay QR configurado para este método</div>}
      </div>
      <p style={{ fontSize: 14, color: C.sub, marginTop: 12 }}>Cliente escanea con su cámara o app de pago</p>
      {shopName && <p style={{ fontSize: 14, color: C.sub }}>Paga a {shopName}</p>}
      <div className="w-full flex flex-col gap-2" style={{ marginTop: 18 }}>
        <Btn onClick={onPaid} color={C.green}>Marcar como pagado</Btn>
        <Btn onClick={onCancel} variant="ghost">Cancelar cobro</Btn>
      </div>
    </div>
  );
}

export function QuickPaySheet({ open, onClose, order, tenant, onSubmit }) {
  const { builtIns, custom, qrFor } = useMemo(() => tenantPaymentMethods(tenant), [tenant]);
  const balance = order ? remainingBalance(order) : 0;
  const total = order ? orderTotal(order) : 0;
  const [method, setMethod] = useState("cash");
  const [customSel, setCustomSel] = useState(null);
  const [amount, setAmount] = useState("");
  const [busy, setBusy] = useState(false);
  const [screen, setScreen] = useState("pay");
  const [change, setChange] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!open) return;
    const first = builtIns[0] || "cash";
    setMethod(first);
    setCustomSel(null);
    setAmount(first === "cash" ? "" : balance.toFixed(2));
    setScreen("pay");
    setChange(null);
    setError(null);
  }, [open]);

  if (!order) return null;
  const isCash = method === "cash" && !customSel;
  const target = isCash ? parseAmount(amount) : balance;
  const entered = parseAmount(amount);
  const selQR = customSel ? (customSel.qr && (customSel.qr.imageBase64 || customSel.qr.paymentURL) ? customSel.qr : null) : (!isCash ? qrFor(method) : null);
  const currentLabel = customSel ? customSel.label : PAYMENT_METHODS[method]?.label;

  const submit = async () => {
    if (target <= 0 || busy) return;
    setBusy(true);
    setError(null);
    try {
      const baseMethod = customSel ? "ath_movil" : method;
      await onSubmit({ amount: target, method: baseMethod, customLabel: customSel?.label || null, label: currentLabel, prevBalance: balance });
      if (isCash && entered - balance > 0.004 && balance > 0) {
        setChange({ received: entered, total: balance, change: entered - balance });
        setScreen("change");
      } else {
        onClose();
      }
    } catch (e) {
      setError(e?.message || String(e));
    } finally {
      setBusy(false);
    }
  };

  if (screen === "qr") {
    return (
      <Sheet open={open} onClose={() => setScreen("pay")} width={460}>
        <QRView config={selQR} amount={target} customerName={order.customer_name} shopName={tenant?.name} methodName={currentLabel} onPaid={() => { setScreen("pay"); submit(); }} onCancel={() => setScreen("pay")} />
      </Sheet>
    );
  }

  if (screen === "change" && change) {
    return (
      <Sheet open={open} onClose={() => {}} dismissable={false} title="Cambio" width={440}>
        <div className="flex flex-col items-center text-center" style={{ padding: "12px 0" }}>
          <span style={{ width: 72, height: 72, borderRadius: 999, background: C.green, color: "#fff", display: "flex", alignItems: "center", justifyContent: "center" }}><Banknote className="w-8 h-8" /></span>
          <p style={{ fontSize: 15, color: C.sub, marginTop: 14 }}>Cambio a entregar</p>
          <p style={{ fontSize: 44, fontWeight: 900, lineHeight: 1.1 }}>{money(change.change)}</p>
          <span style={{ marginTop: 10, padding: "6px 14px", borderRadius: 999, background: C.card2, fontSize: 14, color: C.sub }}>Recibido {money(change.received)} · Total {money(change.total)}</span>
          <Btn onClick={onClose} color={C.green} style={{ width: "100%", marginTop: 22 }}>Ya le di el cambio</Btn>
        </div>
      </Sheet>
    );
  }

  return (
    <Sheet
      open={open}
      onClose={() => !busy && onClose()}
      dismissable={!busy}
      title="Registrar Pago"
      width={520}
      footer={selQR && target > 0 ? (
        <Btn onClick={() => setScreen("qr")} icon={QrCode} color={C.green} style={{ width: "100%" }}>Mostrar QR para cobrar</Btn>
      ) : (
        <Btn onClick={submit} disabled={target <= 0 || busy} color={target > 0 ? C.green : C.card2} style={{ width: "100%" }}>
          {busy ? <Loader2 className="w-5 h-5 animate-spin" /> : `Registrar ${money(target)}`}
        </Btn>
      )}
    >
      <div style={{ background: C.card2, borderRadius: 16, padding: "4px 16px" }}>
        <div className="flex justify-between" style={{ padding: "10px 0", fontSize: 15 }}><span style={{ color: C.sub }}>Total orden</span><span>{money(total)}</span></div>
        {Number(order.amount_paid || 0) > 0 && <div className="flex justify-between" style={{ padding: "10px 0", fontSize: 15 }}><span style={{ color: C.sub }}>Ya pagado</span><span style={{ color: C.green }}>{money(order.amount_paid)}</span></div>}
        <div className="flex justify-between" style={{ padding: "10px 0", fontSize: 16, fontWeight: 800, borderTop: `0.5px solid ${C.sep}` }}><span>Balance pendiente</span><span style={{ color: balance > 0 ? C.red : C.green }}>{money(balance)}</span></div>
      </div>
      <p style={{ fontSize: 12, fontWeight: 700, letterSpacing: "0.06em", color: C.sub, margin: "18px 4px 8px" }}>MÉTODO DE PAGO</p>
      <div className="flex gap-2">
        {builtIns.map((m) => (
          <MethodChip key={m} label={PAYMENT_METHODS[m].label} Icon={METHOD_ICON[m]} color={PAYMENT_METHODS[m].color} selected={!customSel && method === m}
            onClick={() => { setCustomSel(null); setMethod(m); setAmount(m === "cash" ? "" : balance.toFixed(2)); }} />
        ))}
      </div>
      {custom.length > 0 && (
        <div className="flex gap-2" style={{ marginTop: 8 }}>
          {custom.map((c) => (
            <MethodChip key={c.id || c.label} label={c.label} Icon={CreditCard} color={GOLD} selected={customSel?.label === c.label}
              onClick={() => { setCustomSel(c); setAmount(balance.toFixed(2)); }} />
          ))}
        </div>
      )}
      {isCash ? (
        <>
          <p style={{ fontSize: 12, fontWeight: 700, letterSpacing: "0.06em", color: C.sub, margin: "18px 4px 8px" }}>MONTO RECIBIDO</p>
          <div className="flex items-center" style={{ background: C.card2, borderRadius: 14, padding: "6px 16px" }}>
            <span style={{ fontSize: 28, color: C.sub, marginRight: 6 }}>$</span>
            <input value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0.00" inputMode="decimal"
              style={{ flex: 1, background: "transparent", border: "none", outline: "none", color: C.text, fontSize: 32, fontWeight: 800 }} />
          </div>
          <div className="flex gap-2" style={{ marginTop: 10 }}>
            <button onClick={() => setAmount(balance.toFixed(2))} className="apple-press" style={{ padding: "7px 14px", borderRadius: 999, background: tint(C.green, 0.15), color: C.green, fontSize: 13, fontWeight: 700 }}>Pago completo</button>
            {balance > 0 && <button onClick={() => setAmount((balance / 2).toFixed(2))} className="apple-press" style={{ padding: "7px 14px", borderRadius: 999, background: C.card2, color: C.text, fontSize: 13, fontWeight: 700 }}>Mitad ({money(balance / 2)})</button>}
          </div>
          {entered > balance && balance > 0 && (
            <div className="flex justify-between" style={{ marginTop: 12, padding: 12, borderRadius: 12, background: tint(C.green, 0.12), color: C.green, fontSize: 15, fontWeight: 700 }}>
              <span>Cambio a entregar:</span><span>{money(entered - balance)}</span>
            </div>
          )}
        </>
      ) : (
        <div className="flex items-center gap-3" style={{ marginTop: 18, padding: 14, borderRadius: 14, background: C.card2 }}>
          <span style={{ width: 40, height: 40, borderRadius: 10, background: tint(customSel ? GOLD : PAYMENT_METHODS[method].color, 0.18), color: customSel ? GOLD : PAYMENT_METHODS[method].color, display: "flex", alignItems: "center", justifyContent: "center" }}>
            {customSel ? <CreditCard className="w-5 h-5" /> : React.createElement(METHOD_ICON[method], { className: "w-5 h-5" })}
          </span>
          <span className="flex-1" style={{ fontSize: 15, color: C.sub }}>Se cobrará por {currentLabel}</span>
          <span style={{ fontSize: 20, fontWeight: 800 }}>{money(target)}</span>
        </div>
      )}
      {error && (
        <div style={{ marginTop: 14, padding: 12, borderRadius: 12, background: tint(C.red, 0.12), color: C.red }}>
          <p style={{ fontSize: 14, fontWeight: 700 }}>No se pudo registrar el pago</p>
          <p style={{ fontSize: 13 }}>{error}</p>
        </div>
      )}
    </Sheet>
  );
}

const DEPOSIT_ICON = { cash: Banknote, card: CreditCard, ath_movil: Smartphone, transfer: ArrowLeftRight };

export function DepositsSheet({ open, onClose, order, tenant, onAdd, onEdit, onDelete, refreshKey }) {
  const [deposits, setDeposits] = useState([]);
  const [refunds, setRefunds] = useState([]);
  const [loading, setLoading] = useState(false);
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState("cash");
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState(null);
  const [editAmount, setEditAmount] = useState("");
  const [deleting, setDeleting] = useState(null);
  const [error, setError] = useState(null);
  const [showQR, setShowQR] = useState(false);
  const { qrFor } = useMemo(() => tenantPaymentMethods(tenant), [tenant]);

  useEffect(() => {
    if (!open || !order) return;
    setLoading(true);
    Promise.all([listDeposits(order.id).catch(() => []), listRefunds(order.id).catch(() => [])])
      .then(([d, r]) => { setDeposits(d); setRefunds(r); })
      .finally(() => setLoading(false));
  }, [open, order?.id, refreshKey]);

  useEffect(() => { if (open) { setAmount(""); setMethod("cash"); setError(null); setShowQR(false); } }, [open]);

  if (!order) return null;
  const total = orderTotal(order);
  const totalPaid = deposits.reduce((s, d) => s + Number(d.amount || 0), 0);
  const remaining = Math.max(0, total - totalPaid);
  const typed = parseAmount(amount);
  const charge = remaining > 0 ? Math.min(typed, remaining) : typed;
  const qr = qrFor(method);

  const submit = async () => {
    if (charge <= 0 || busy) return;
    setBusy(true);
    setError(null);
    try { await onAdd({ amount: charge, method }); setAmount(""); } catch (e) { setError(e?.message || String(e)); } finally { setBusy(false); }
  };

  if (showQR) {
    return (
      <Sheet open={open} onClose={() => setShowQR(false)} width={460}>
        <QRView config={qr} amount={charge} customerName={order.customer_name} shopName={tenant?.name} methodName={PAYMENT_METHODS[method].label} onPaid={() => { setShowQR(false); submit(); }} onCancel={() => setShowQR(false)} />
      </Sheet>
    );
  }

  return (
    <Sheet open={open} onClose={onClose} title="Depósitos" width={920}>
      <div className="grid gap-5" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))" }}>
        <div className="flex flex-col gap-4">
          <div>
            <p style={{ fontSize: 12, fontWeight: 700, letterSpacing: "0.06em", color: C.sub, margin: "0 4px 8px" }}>RESUMEN</p>
            <div style={{ background: C.card2, borderRadius: 14, padding: "2px 14px" }}>
              <div className="flex justify-between" style={{ padding: "10px 0" }}><span style={{ color: C.sub }}>Total estimado</span><span>{money(total)}</span></div>
              <div className="flex justify-between" style={{ padding: "10px 0" }}><span style={{ color: C.sub }}>Total pagado</span><span style={{ color: C.green }}>{money(totalPaid)}</span></div>
              <div className="flex justify-between" style={{ padding: "10px 0" }}><span style={{ color: C.sub }}>Saldo</span><span style={{ color: remaining > 0 ? C.amber : C.green, fontWeight: 700 }}>{money(remaining)}</span></div>
            </div>
          </div>
          <div>
            <p style={{ fontSize: 12, fontWeight: 700, letterSpacing: "0.06em", color: C.sub, margin: "0 4px 8px" }}>PAGOS REGISTRADOS</p>
            <div style={{ background: C.card2, borderRadius: 14, padding: "2px 14px" }}>
              {loading ? <p className="flex items-center gap-2" style={{ padding: "12px 0", color: C.sub }}><Loader2 className="w-4 h-4 animate-spin" /> Cargando…</p> : deposits.length === 0 ? (
                <p style={{ padding: "12px 0", color: C.sub, fontSize: 14 }}>Sin depósitos registrados</p>
              ) : deposits.map((d) => {
                const Icon = DEPOSIT_ICON[d.payment_method] || DollarSign;
                return (
                  <div key={d.id} className="flex items-center gap-3" style={{ padding: "10px 0", borderBottom: `0.5px solid ${C.sep}` }}>
                    <span style={{ width: 34, height: 34, borderRadius: 9, background: tint(C.green, 0.15), color: C.green, display: "flex", alignItems: "center", justifyContent: "center" }}><Icon className="w-4 h-4" /></span>
                    <span className="flex-1 min-w-0">
                      <span className="flex items-center gap-2">
                        <span style={{ fontSize: 15, fontWeight: 700 }}>{money(d.amount)}</span>
                        <span style={{ padding: "1px 8px", borderRadius: 999, background: C.card, fontSize: 11, color: C.sub }}>{methodLabel(d.payment_method)}</span>
                      </span>
                      <span className="block" style={{ fontSize: 12, color: C.sub }}>
                        {new Date(d.created_at).toLocaleString("es-PR", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" })}
                        {d.recorded_by && d.recorded_by !== "system" ? ` · ${d.recorded_by}` : ""}
                      </span>
                    </span>
                    <button onClick={() => { setEditing(d); setEditAmount(Number(d.amount).toFixed(2)); }} aria-label="Editar" className="apple-press" style={{ color: C.blue }}><Pencil className="w-4 h-4" /></button>
                    <button onClick={() => setDeleting(d)} aria-label="Eliminar" className="apple-press" style={{ color: C.red }}><Trash2 className="w-4 h-4" /></button>
                  </div>
                );
              })}
            </div>
            <p style={{ fontSize: 12, color: C.sub, margin: "6px 4px 0" }}>Usa los botones de cada pago para editarlo o eliminarlo.</p>
          </div>
          {refunds.length > 0 && (
            <div>
              <p style={{ fontSize: 12, fontWeight: 700, letterSpacing: "0.06em", color: C.sub, margin: "0 4px 8px" }}>DEVOLUCIONES</p>
              <div style={{ background: C.card2, borderRadius: 14, padding: "2px 14px" }}>
                {refunds.map((r) => (
                  <div key={r.id} style={{ padding: "10px 0", borderBottom: `0.5px solid ${C.sep}` }}>
                    <span className="flex items-center gap-2"><span style={{ fontSize: 15, fontWeight: 700, color: C.red }}>-{money(Math.abs(Number(r.amount)))}</span><span style={{ padding: "1px 8px", borderRadius: 999, background: C.card, fontSize: 11, color: C.sub }}>{methodLabel(r.payment_method)}</span></span>
                    {r.refund_metadata?.reason && <span className="block" style={{ fontSize: 12, color: C.sub }}>{r.refund_metadata.reason}</span>}
                    <span className="block" style={{ fontSize: 12, color: C.sub }}>{new Date(r.created_at).toLocaleString("es-PR", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" })}{r.recorded_by ? ` · ${r.recorded_by}` : ""}</span>
                  </div>
                ))}
              </div>
              <p style={{ fontSize: 12, color: C.sub, margin: "6px 4px 0" }}>El pago original se conserva; la devolución es su propia entrada.</p>
            </div>
          )}
        </div>

        <div style={{ background: C.card2, borderRadius: 18, padding: 16, alignSelf: "start" }}>
          <p className="flex items-center gap-2" style={{ fontSize: 16, fontWeight: 800 }}><Plus className="w-4 h-4" /> Nuevo depósito</p>
          {remaining <= 0 ? (
            <div className="flex flex-col items-center text-center" style={{ padding: "22px 0" }}>
              <BadgeCheck className="w-10 h-10" style={{ color: C.green }} />
              <p style={{ fontSize: 17, fontWeight: 800, marginTop: 8 }}>Orden saldada</p>
              <p style={{ fontSize: 14, color: C.sub }}>No hay saldo pendiente por cobrar.</p>
              <p style={{ fontSize: 14, marginTop: 8 }}>Total pagado {money(totalPaid)}</p>
            </div>
          ) : (
            <>
              <div style={{ background: C.card, borderRadius: 12, padding: "2px 12px", marginTop: 12 }}>
                <div className="flex justify-between" style={{ padding: "8px 0" }}><span style={{ color: C.sub }}>Total estimado</span><span>{money(total)}</span></div>
                <div className="flex justify-between" style={{ padding: "8px 0" }}><span style={{ color: C.sub }}>Ya pagado</span><span>{money(totalPaid)}</span></div>
                <div className="flex justify-between" style={{ padding: "8px 0", borderTop: `0.5px solid ${C.sep}` }}><span>Saldo</span><span style={{ color: C.amber, fontSize: 20, fontWeight: 800 }}>{money(remaining)}</span></div>
              </div>
              <p style={{ fontSize: 12, fontWeight: 700, letterSpacing: "0.06em", color: C.sub, margin: "16px 4px 8px" }}>MONTO DEL DEPÓSITO</p>
              <div className="flex items-center" style={{ background: C.card, borderRadius: 12, padding: "4px 14px" }}>
                <span style={{ fontSize: 22, color: C.sub, marginRight: 6 }}>$</span>
                <input value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0.00" inputMode="decimal" style={{ flex: 1, background: "transparent", border: "none", outline: "none", color: C.text, fontSize: 26, fontWeight: 800 }} />
              </div>
              <div className="flex gap-2" style={{ marginTop: 8 }}>
                {[["25%", 0.25], ["50%", 0.5], ["Saldo", 1]].map(([l, f]) => (
                  <button key={l} onClick={() => setAmount((remaining * f).toFixed(2))} className="apple-press" style={{ padding: "6px 12px", borderRadius: 999, background: tint(C.amber, 0.14), color: C.amber, fontSize: 13, fontWeight: 700 }}>{l}</button>
                ))}
              </div>
              <p style={{ fontSize: 12, fontWeight: 700, letterSpacing: "0.06em", color: C.sub, margin: "16px 4px 8px" }}>MÉTODO DE PAGO</p>
              <div className="flex gap-2">
                {["cash", "card", "ath_movil"].map((m) => (
                  <MethodChip key={m} label={PAYMENT_METHODS[m].label} Icon={METHOD_ICON[m]} color={PAYMENT_METHODS[m].color} selected={method === m} onClick={() => setMethod(m)} />
                ))}
              </div>
              {qr && charge > 0 && (
                <button onClick={() => setShowQR(true)} className="apple-press w-full flex items-center justify-center gap-2" style={{ marginTop: 10, padding: "10px 0", borderRadius: 12, background: tint(C.green, 0.14), color: C.green, fontSize: 14, fontWeight: 700 }}>
                  <QrCode className="w-4 h-4" /> Mostrar QR para cobrar ({PAYMENT_METHODS[method].label})
                </button>
              )}
              {typed > remaining && <p style={{ fontSize: 13, color: C.amber, marginTop: 10 }}>El monto excede el saldo. Se ajustará automáticamente a {money(remaining)}.</p>}
              {error && <p style={{ fontSize: 13, color: C.red, marginTop: 10 }}>{error}</p>}
              <Btn onClick={submit} disabled={charge <= 0 || busy} style={{ width: "100%", marginTop: 14 }}>
                {busy ? <Loader2 className="w-5 h-5 animate-spin" /> : charge > 0 ? `Registrar ${money(charge)}` : "Registrar depósito"}
              </Btn>
            </>
          )}
        </div>
      </div>

      <Sheet open={!!editing} onClose={() => setEditing(null)} title="Editar depósito" width={400}
        footer={<div className="flex gap-2"><Btn onClick={() => setEditing(null)} variant="secondary" style={{ flex: 1 }}>Cancelar</Btn><Btn
          disabled={parseAmount(editAmount) <= 0 || Math.abs(parseAmount(editAmount) - Number(editing?.amount || 0)) < 0.005}
          onClick={async () => { try { await onEdit({ txId: editing.id, amount: parseAmount(editAmount) }); setEditing(null); } catch (e) { setError(e?.message || String(e)); setEditing(null); } }}
          style={{ flex: 1 }}>Guardar</Btn></div>}>
        <p style={{ fontSize: 12, fontWeight: 700, letterSpacing: "0.06em", color: C.sub, margin: "0 4px 8px" }}>DEPÓSITO ACTUAL</p>
        <div className="flex justify-between" style={{ padding: "10px 14px", borderRadius: 12, background: C.card2 }}><span style={{ color: C.sub }}>Monto original</span><span>{money(editing?.amount)}</span></div>
        <p style={{ fontSize: 12, fontWeight: 700, letterSpacing: "0.06em", color: C.sub, margin: "16px 4px 8px" }}>NUEVO MONTO</p>
        <div className="flex items-center" style={{ background: C.card2, borderRadius: 12, padding: "4px 14px" }}>
          <span style={{ fontSize: 20, color: C.sub, marginRight: 6 }}>$</span>
          <input value={editAmount} onChange={(e) => setEditAmount(e.target.value)} inputMode="decimal" style={{ flex: 1, background: "transparent", border: "none", outline: "none", color: C.text, fontSize: 22, fontWeight: 800 }} />
        </div>
      </Sheet>

      <Sheet open={!!deleting} onClose={() => setDeleting(null)} width={400}>
        <div className="flex flex-col items-center text-center" style={{ paddingTop: 16 }}>
          <span style={{ width: 60, height: 60, borderRadius: 999, background: tint(C.red, 0.14), color: C.red, display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 14 }}><Trash2 className="w-6 h-6" /></span>
          <p style={{ fontSize: 18, fontWeight: 800 }}>¿Eliminar este depósito?</p>
          <p style={{ fontSize: 15, color: C.sub, marginTop: 6 }}>Se borra {money(deleting?.amount)} y no se puede deshacer.</p>
          <div className="w-full flex flex-col gap-2" style={{ marginTop: 20 }}>
            <Btn color={C.red} onClick={async () => { try { await onDelete({ txId: deleting.id }); } catch (e) { setError(e?.message || String(e)); } setDeleting(null); }}>Eliminar</Btn>
            <Btn variant="ghost" onClick={() => setDeleting(null)}>Cancelar</Btn>
          </div>
        </div>
      </Sheet>
    </Sheet>
  );
}

export function RefundSheet({ open, onClose, order, onRefund }) {
  const paid = Number(order?.amount_paid || 0);
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState("cash");
  const [reason, setReason] = useState("");
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  useEffect(() => { if (open) { setAmount(paid.toFixed(2)); setMethod("cash"); setReason(""); setConfirm(false); setError(null); } }, [open]);
  if (!order) return null;
  const a = parseAmount(amount);
  const valid = a > 0 && a <= paid + 0.001;
  return (
    <Sheet open={open} onClose={() => !busy && onClose()} dismissable={!busy} title="Devolver dinero" width={920}
      footer={<Btn onClick={() => setConfirm(true)} disabled={!valid || busy} color={valid ? C.red : C.card2} style={{ width: "100%" }}>Devolver {money(a)}</Btn>}>
      <div className="grid gap-5" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))" }}>
        <div>
          <div style={{ background: C.card2, borderRadius: 14, padding: "2px 14px" }}>
            <div className="flex justify-between" style={{ padding: "10px 0" }}><span style={{ color: C.sub }}>Orden</span><span>{order.order_number}</span></div>
            <div className="flex justify-between" style={{ padding: "10px 0" }}><span style={{ color: C.sub }}>Cliente</span><span>{order.customer_name || "—"}</span></div>
            <div className="flex justify-between" style={{ padding: "10px 0", borderTop: `0.5px solid ${C.sep}` }}><span>Pagado hasta ahora</span><span style={{ color: C.green, fontSize: 20, fontWeight: 800 }}>{money(paid)}</span></div>
          </div>
          <p style={{ fontSize: 12, fontWeight: 700, letterSpacing: "0.06em", color: C.sub, margin: "16px 4px 8px" }}>MONTO A DEVOLVER</p>
          <div className="flex items-center" style={{ background: C.card2, borderRadius: 12, padding: "4px 14px" }}>
            <span style={{ fontSize: 22, color: C.sub, marginRight: 6 }}>$</span>
            <input value={amount} onChange={(e) => setAmount(e.target.value)} inputMode="decimal" style={{ flex: 1, background: "transparent", border: "none", outline: "none", color: C.text, fontSize: 26, fontWeight: 800 }} />
          </div>
          <button onClick={() => setAmount(paid.toFixed(2))} className="apple-press" style={{ marginTop: 8, padding: "6px 12px", borderRadius: 999, background: tint(C.brand, 0.14), color: C.brand, fontSize: 13, fontWeight: 700 }}>Todo ({money(paid)})</button>
          {a > paid + 0.001 && <p style={{ fontSize: 13, color: C.red, marginTop: 8 }}>No puedes devolver más de lo pagado.</p>}
        </div>
        <div>
          <p style={{ fontSize: 12, fontWeight: 700, letterSpacing: "0.06em", color: C.sub, margin: "0 4px 8px" }}>MÉTODO DE DEVOLUCIÓN</p>
          <div className="flex gap-2">
            {["cash", "card", "ath_movil"].map((m) => (
              <MethodChip key={m} label={PAYMENT_METHODS[m].label} Icon={METHOD_ICON[m]} color={PAYMENT_METHODS[m].color} selected={method === m} onClick={() => setMethod(m)} />
            ))}
          </div>
          <p style={{ fontSize: 12, fontWeight: 700, letterSpacing: "0.06em", color: C.sub, margin: "16px 4px 8px" }}>RAZÓN</p>
          <textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={3} placeholder="Ej. cliente canceló, equipo sin reparación…"
            style={{ width: "100%", background: C.card2, color: C.text, borderRadius: 12, padding: 12, fontSize: 15, border: "none", outline: "none", resize: "vertical" }} />
          {error && <p style={{ fontSize: 13, color: C.red, marginTop: 8 }}>{error}</p>}
        </div>
      </div>
      <Sheet open={confirm} onClose={() => !busy && setConfirm(false)} width={420}>
        <div className="flex flex-col items-center text-center" style={{ paddingTop: 16 }}>
          <span style={{ width: 60, height: 60, borderRadius: 999, background: tint(C.red, 0.14), color: C.red, display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 14 }}><Undo2 className="w-6 h-6" /></span>
          <p style={{ fontSize: 18, fontWeight: 800 }}>Confirmar devolución</p>
          <p style={{ fontSize: 15, color: C.sub, marginTop: 6 }}>Vas a devolver {money(a)} por {PAYMENT_METHODS[method].label} al cliente. El pago original se conserva en el historial.</p>
          <div className="w-full flex flex-col gap-2" style={{ marginTop: 20 }}>
            <Btn color={C.red} disabled={busy} onClick={async () => { setBusy(true); try { await onRefund({ amount: a, method, reason }); setConfirm(false); } catch (e) { setError(e?.message || String(e)); setConfirm(false); } finally { setBusy(false); } }}>{busy ? "Devolviendo…" : `Devolver ${money(a)}`}</Btn>
            <Btn variant="ghost" disabled={busy} onClick={() => setConfirm(false)}>Cancelar</Btn>
          </div>
        </div>
      </Sheet>
    </Sheet>
  );
}
