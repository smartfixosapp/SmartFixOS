import { useEffect, useRef, useState } from "react";
import { Printer, Share, MessageSquare, Mail, CheckCircle2, ChevronRight, Undo2, Loader2, CircleDashed, UserCircle2, ShieldCheck, Lock, XCircle, Banknote, CreditCard, Phone, Check } from "lucide-react";
import { P, tint, Dialog, ErrorBanner, TextAction, PromptDialog } from "./posUi";
import { usd, lineTotalWithTax, tenantDisplayName, customerDisplayName } from "@/lib/posLogic";
import { ownerPinExists, verifyOwnerPin } from "@/lib/posApi";
import { sendPOSReceipt } from "@/lib/orderEmails";

const METHOD_ICON = { cash: [Banknote, P.cash], card: [CreditCard, P.card_], ath_movil: [Phone, P.ath] };

export async function buildSaleReceiptPDF(sale, tenant) {
  const { jsPDF } = await import("jspdf");
  const W = 380;
  const measure = new jsPDF({ unit: "pt", format: [W, 800] });
  measure.setFont("helvetica", "normal");
  measure.setFontSize(12);
  const itemLines = sale.items.map((it) => measure.splitTextToSize(`${it.productName} ×${it.quantity}`, W - 130));
  const H = Math.max(420, 340 + itemLines.reduce((s, l) => s + l.length * 15 + 2, 0) + (sale.customer ? 19 : 0));
  const doc = new jsPDF({ unit: "pt", format: [W, H] });
  let y = 28;
  const line = (text, { size = 12, bold = false, weight, x = 20, right } = {}) => {
    doc.setFont("helvetica", bold || weight === "semibold" ? "bold" : "normal");
    doc.setFontSize(size);
    doc.setTextColor(0, 0, 0);
    doc.text(String(text), x, y, { baseline: "top" });
    if (right !== undefined) doc.text(String(right), W - 20, y, { baseline: "top", align: "right" });
    y += size * 1.25;
  };
  const divider = () => {
    y += 6;
    doc.setDrawColor(77, 77, 77);
    doc.setLineWidth(0.5);
    doc.line(20, y, W - 20, y);
    y += 10;
  };
  line(tenantDisplayName(tenant), { size: 17, bold: true });
  if (tenant?.address) line(tenant.address, { size: 11, weight: "medium" });
  if (tenant?.admin_phone) line(`Tel: ${tenant.admin_phone}`, { size: 11 });
  if (tenant?.email) line(tenant.email, { size: 11 });
  line("RECIBO DE VENTA", { size: 11 });
  line(new Intl.DateTimeFormat("es-PR", { dateStyle: "medium", timeStyle: "short" }).format(sale.occurredAt), { size: 11 });
  divider();
  if (sale.customer) {
    line(`Cliente: ${customerDisplayName(sale.customer)}`);
    y += 4;
  }
  sale.items.forEach((it, i) => {
    const parts = itemLines[i];
    parts.forEach((p, j) => {
      if (j === 0) line(p, { right: usd(lineTotalWithTax(it)) });
      else line(p);
    });
    y += 2;
  });
  divider();
  line("Subtotal", { right: usd(sale.subtotal) });
  line("IVU", { right: usd(sale.taxAmount) });
  if (sale.discount > 0) line("Descuento", { right: `-${usd(sale.discount)}` });
  y += 4;
  line("TOTAL", { size: 13, bold: true, right: usd(sale.total) });
  divider();
  line(`Método: ${sale.methodLabel}`, { size: 11 });
  if (sale.changeDue > 0) line(`Cambio: ${usd(sale.changeDue)}`, { size: 11 });
  y += 14;
  line("¡Gracias por su compra!", { size: 11, x: W / 2 - 60 });
  return doc.output("blob");
}

export function printPDFBlob(blob) {
  return new Promise((resolve, reject) => {
    try {
      const url = URL.createObjectURL(blob);
      const frame = document.createElement("iframe");
      frame.style.position = "fixed";
      frame.style.right = "0";
      frame.style.bottom = "0";
      frame.style.width = "0";
      frame.style.height = "0";
      frame.style.border = "0";
      frame.src = url;
      frame.onload = () => {
        try {
          frame.contentWindow.focus();
          frame.contentWindow.print();
          resolve(true);
        } catch {
          window.open(url, "_blank", "noopener");
          resolve(true);
        }
        setTimeout(() => { frame.remove(); URL.revokeObjectURL(url); }, 60000);
      };
      document.body.appendChild(frame);
    } catch (e) {
      reject(e);
    }
  });
}

export async function sharePDFBlob(blob, filename) {
  const file = new File([blob], filename, { type: "application/pdf" });
  if (typeof navigator !== "undefined" && navigator.canShare && navigator.canShare({ files: [file] })) {
    try {
      await navigator.share({ files: [file] });
      return;
    } catch (e) {
      if (e?.name === "AbortError") return;
    }
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 30000);
}

export function ManagerPinDialog({ open, reason, tenantId, onClose, onAuthorized }) {
  const [pin, setPin] = useState("");
  const [status, setStatus] = useState("loading");
  const [showError, setShowError] = useState(false);
  const [busy, setBusy] = useState(false);
  const [lockedUntil, setLockedUntil] = useState(0);
  const failKey = `pin_failures_${tenantId}`;
  const lockKey = `pin_lockout_until_${tenantId}`;
  useEffect(() => {
    if (!open) return;
    setPin("");
    setShowError(false);
    setStatus("loading");
    let ts = 0;
    try { ts = Number(localStorage.getItem(lockKey)) || 0; } catch { ts = 0; }
    setLockedUntil(ts * 1000);
    ownerPinExists(tenantId).then((ok) => setStatus(ok ? "exists" : "missing"), () => setStatus("missing"));
  }, [open, tenantId, lockKey]);
  const locked = lockedUntil > Date.now();
  const submit = async () => {
    if (pin.length < 4 || locked || busy) return;
    setBusy(true);
    const ok = await verifyOwnerPin(tenantId, pin);
    setBusy(false);
    if (ok) {
      try { localStorage.removeItem(failKey); localStorage.removeItem(lockKey); } catch { setLockedUntil(0); }
      onAuthorized();
      onClose();
      return;
    }
    let fails = 0;
    try { fails = (Number(localStorage.getItem(failKey)) || 0) + 1; localStorage.setItem(failKey, String(fails)); } catch { fails = 1; }
    if (fails >= 5) {
      const until = Date.now() + 5 * 60 * 1000;
      try { localStorage.setItem(lockKey, String(until / 1000)); } catch { setLockedUntil(until); }
      setLockedUntil(until);
    }
    setShowError(true);
    setPin("");
  };
  return (
    <Dialog open={open} onClose={onClose} title="Verificacion" width={420} leading={<TextAction onClick={onClose}>Cancelar</TextAction>} trailing={null}>
      <div className="flex flex-col items-center text-center" style={{ gap: 16, paddingTop: 20, paddingBottom: 12 }}>
        <ShieldCheck className="w-12 h-12" style={{ color: P.brand }} />
        <p style={{ fontSize: 20, fontWeight: 600 }}>Autorizacion del dueno</p>
        <p style={{ fontSize: 15, color: P.sub }}>{reason}</p>
        {status === "loading" ? (
          <Loader2 className="w-5 h-5 animate-spin" style={{ color: P.sub }} />
        ) : status === "exists" ? (
          <>
            <input
              autoFocus
              type="password"
              inputMode="numeric"
              value={pin}
              onChange={(e) => setPin(e.target.value.replace(/[^\d]/g, ""))}
              onKeyDown={(e) => { if (e.key === "Enter") submit(); }}
              placeholder="PIN del dueno"
              autoComplete="one-time-code"
              style={{ width: "100%", textAlign: "center", fontSize: 22, padding: 16, borderRadius: 12, background: "#2C2C2E", color: P.text, border: "none", outline: "none" }}
            />
            {locked ? (
              <p className="flex items-center gap-1" style={{ fontSize: 12, color: P.danger }}><Lock className="w-3 h-3" /> Demasiados intentos. Espera unos minutos.</p>
            ) : showError ? (
              <p className="flex items-center gap-1" style={{ fontSize: 12, color: P.danger }}><XCircle className="w-3 h-3" /> PIN incorrecto</p>
            ) : null}
            <button onClick={submit} disabled={pin.length < 4 || locked || busy} className="apple-press w-full disabled:opacity-40" style={{ padding: "12px 0", borderRadius: 12, background: P.brand, color: "#fff", fontSize: 16, fontWeight: 600 }}>
              {busy ? <Loader2 className="w-5 h-5 animate-spin mx-auto" /> : "Autorizar"}
            </button>
          </>
        ) : (
          <p style={{ fontSize: 13, color: P.sub }}>El dueno aun no ha configurado un PIN. Pidele que lo cree en Ajustes, Seguridad.</p>
        )}
      </div>
    </Dialog>
  );
}

export function VoidReasonDialog({ open, amountLabel, onClose, onConfirm }) {
  const [reason, setReason] = useState("");
  useEffect(() => { if (open) setReason(""); }, [open]);
  const quick = ["Cliente se arrepintió", "Error al cobrar", "Producto equivocado"];
  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Anular venta"
      width={460}
      leading={<TextAction onClick={onClose}>Cancelar</TextAction>}
      trailing={<TextAction bold disabled={!reason.trim()} onClick={() => { onConfirm(reason.trim()); onClose(); }}>Continuar</TextAction>}
    >
      <p style={{ fontSize: 12, color: P.sub, textTransform: "uppercase", margin: "8px 4px 6px" }}>¿Por qué se anula esta venta de {amountLabel}?</p>
      <div style={{ borderRadius: 12, background: "#2C2C2E", overflow: "hidden" }}>
        {quick.map((r, i) => (
          <button key={r} onClick={() => setReason(r)} className="w-full flex items-center justify-between" style={{ padding: "12px 14px", fontSize: 15, borderTop: i ? `0.5px solid ${P.sep}` : "none" }}>
            {r}
            {reason === r && <Check className="w-4 h-4" style={{ color: P.brand }} />}
          </button>
        ))}
      </div>
      <textarea
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        placeholder="Detalle (opcional)"
        rows={3}
        style={{ marginTop: 16, width: "100%", padding: 12, borderRadius: 12, background: "#2C2C2E", color: P.text, fontSize: 15, border: "none", outline: "none", resize: "none" }}
      />
      <p style={{ fontSize: 12, color: P.sub, margin: "6px 4px 0" }}>Queda registrado en la transacción de reembolso — quién anuló y por qué.</p>
    </Dialog>
  );
}

export default function ReceiptDialog({ open, sale, tenant, isAdmin, tenantId, onDone, onVoid }) {
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(null);
  const [error, setError] = useState(null);
  const [showReason, setShowReason] = useState(false);
  const [showPin, setShowPin] = useState(false);
  const [pendingReason, setPendingReason] = useState("");
  const [voiding, setVoiding] = useState(false);
  const [askPhone, setAskPhone] = useState(false);

  const aliveRef = useRef(open);
  aliveRef.current = open;
  useEffect(() => {
    setShowPin(false);
    setShowReason(false);
    setPendingReason("");
    setAskPhone(false);
    if (open) { setSent(null); setError(null); setVoiding(false); }
  }, [open, sale]);

  if (!sale) return null;
  const email = String(sale.customer?.email || "").trim();
  const phone = String(sale.customer?.phone || "").trim();
  const [MIcon, mColor] = sale.customLabel ? [CreditCard, P.vip] : METHOD_ICON[sale.method] || [CreditCard, P.vip];

  const printReceipt = async () => {
    setError(null);
    let blob;
    try {
      blob = await buildSaleReceiptPDF(sale, tenant);
    } catch {
      setError("No se pudo generar el recibo para imprimir.");
      return;
    }
    try {
      await printPDFBlob(blob);
      setSent("Recibo enviado a la impresora.");
    } catch (e) {
      setError(`No se pudo imprimir: ${e?.message || e}`);
    }
  };

  const sharePDF = async () => {
    setError(null);
    try {
      const blob = await buildSaleReceiptPDF(sale, tenant);
      await sharePDFBlob(blob, "Recibo.pdf");
    } catch {
      setError("No se pudo generar el recibo para imprimir.");
    }
  };

  const whatsappMessage = () => {
    const lines = [`Recibo de venta — ${tenantDisplayName(tenant)}`, ""];
    if (sale.customer) lines.push(`Cliente: ${customerDisplayName(sale.customer)}`);
    lines.push("");
    sale.items.forEach((it) => lines.push(`• ${it.productName} x${it.quantity} — ${usd(lineTotalWithTax(it))}`));
    lines.push("");
    lines.push(`Subtotal: ${usd(sale.subtotal)}`);
    if (sale.taxAmount > 0) lines.push(`IVU: ${usd(sale.taxAmount)}`);
    if (sale.discount > 0) lines.push(`Descuento: -${usd(sale.discount)}`);
    lines.push(`Total: ${usd(sale.total)}`);
    lines.push(`Pago: ${sale.methodLabel}`);
    lines.push("");
    lines.push("¡Gracias por tu compra!");
    return lines.join("\n");
  };

  const openWhatsApp = (override) => {
    const raw = phone || override || "";
    if (!raw) { setError("Ingresa un número de teléfono válido"); return; }
    const clean = raw.replace(/\D/g, "");
    if (!clean) { setError("Número de teléfono inválido"); return; }
    window.open(`https://wa.me/${clean}?text=${encodeURIComponent(whatsappMessage())}`, "_blank", "noopener");
    setSent("WhatsApp abierto — confirma el envío en la app");
  };

  const sendEmail = async () => {
    if (!email) return;
    setBusy(true);
    setError(null);
    try {
      await sendPOSReceipt({
        to: email,
        customerName: customerDisplayName(sale.customer),
        items: sale.items.map((it) => ({ productName: it.productName, quantity: it.quantity, totalWithTax: lineTotalWithTax(it) })),
        subtotal: sale.subtotal,
        taxAmount: sale.taxAmount,
        discount: sale.discount,
        total: sale.total,
        method: sale.method,
        customLabel: sale.customLabel,
        amountReceived: sale.amountReceived,
        changeDue: sale.changeDue,
        tenant,
        lang: sale.customer?.preferred_language === "en" ? "en" : "es",
      });
      setSent(`Recibo enviado a ${email}`);
    } catch (e) {
      setError(`No se pudo enviar el email: ${e?.message || e}`);
    }
    setBusy(false);
  };

  const performVoid = async (reason) => {
    setVoiding(true);
    await onVoid(reason);
    setVoiding(false);
  };

  const row = (Icon, color, title, subtitle, onClick, enabled = true) => (
    <button onClick={onClick} disabled={!enabled || busy} className="apple-press w-full flex items-center gap-3.5 text-left" style={{ padding: 14, borderRadius: 14, background: "#2C2C2E", opacity: enabled ? 1 : 0.7 }}>
      <span style={{ width: 44, height: 44, borderRadius: 10, background: tint(color, enabled ? 0.18 : 0.08), color: enabled ? color : P.sub, display: "flex", alignItems: "center", justifyContent: "center" }}><Icon className="w-5 h-5" /></span>
      <span className="flex-1 min-w-0">
        <span className="block" style={{ fontSize: 15, fontWeight: 600, color: enabled ? P.text : P.sub }}>{title}</span>
        <span className="block truncate" style={{ fontSize: 12, color: P.sub }}>{subtitle}</span>
      </span>
      {busy ? <Loader2 className="w-4 h-4 animate-spin" style={{ color: P.sub }} /> : <ChevronRight className="w-4 h-4" style={{ color: P.sub }} />}
    </button>
  );

  return (
    <>
      <Dialog open={open} onClose={() => { if (!voiding) onDone(); }} title="Recibo" width={520} leading={<span />} trailing={<TextAction bold disabled={voiding} onClick={() => { if (!voiding) onDone(); }}>Listo</TextAction>}>
        <div className="flex flex-col" style={{ gap: 16, paddingTop: 4 }}>
          <div className="flex flex-col" style={{ gap: 10, padding: 16, borderRadius: 14, background: "#2C2C2E" }}>
            <div className="flex items-center justify-between">
              <div>
                <p style={{ fontSize: 12, color: P.sub }}>Venta completada</p>
                <p style={{ fontSize: 28, fontWeight: 700 }}>{usd(sale.total)}</p>
              </div>
              <CheckCircle2 className="w-9 h-9" style={{ color: P.success }} />
            </div>
            {sale.changeDue > 0 && (
              <div className="flex items-center justify-between" style={{ padding: 12, borderRadius: 12, background: tint(P.success, 0.12) }}>
                <span style={{ fontSize: 15, fontWeight: 600 }}>Cambio a entregar</span>
                <span style={{ fontSize: 22, fontWeight: 700, color: P.success }}>{usd(sale.changeDue)}</span>
              </div>
            )}
            <div style={{ height: 0.5, background: P.sep }} />
            <div className="flex items-center gap-2" style={{ fontSize: 12 }}>
              <MIcon className="w-4 h-4" style={{ color: mColor }} />
              <span style={{ fontWeight: 500 }}>{sale.methodLabel}</span>
              <span className="flex-1" />
              <span style={{ color: P.sub }}>{sale.items.length} item{sale.items.length === 1 ? "" : "s"}</span>
            </div>
            {sale.customer && (
              <div className="flex items-center gap-1.5" style={{ fontSize: 12, fontWeight: 500 }}>
                <UserCircle2 className="w-4 h-4" style={{ color: P.sub }} /> {customerDisplayName(sale.customer)}
              </div>
            )}
          </div>
          <ErrorBanner message={error} onDismiss={() => setError(null)} />
          {sent && (
            <div className="flex items-center gap-2.5" style={{ padding: 12, borderRadius: 12, background: tint(P.success, 0.1), fontSize: 15 }}>
              <CheckCircle2 className="w-4 h-4" style={{ color: P.success }} /> {sent}
            </div>
          )}
          <div className="flex flex-col" style={{ gap: 10 }}>
            {row(Printer, P.success, "Imprimir recibo", "Envía a tu impresora térmica", printReceipt)}
            {row(Share, P.brand, "Compartir recibo PDF", "WhatsApp, Email, iMessage, AirDrop…", sharePDF)}
            {row(MessageSquare, P.success, "Enviar por WhatsApp", phone ? "Al número del cliente" : "Toca para escribir el número", () => (phone ? openWhatsApp() : setAskPhone(true)))}
            {row(Mail, P.info, "Enviar por email", email ? "Al correo del cliente" : "El cliente no tiene email", sendEmail, !!email)}
            <div style={{ height: 0.5, background: P.sep }} />
            <button onClick={() => setShowReason(true)} disabled={voiding} className="apple-press w-full flex items-center gap-2 text-left" style={{ padding: 14, borderRadius: 14, background: tint(P.danger, 0.08), color: P.danger, fontSize: 15, fontWeight: 500 }}>
              {voiding ? <CircleDashed className="w-5 h-5" /> : <Undo2 className="w-5 h-5" />}
              {voiding ? "Anulando..." : "Anular esta venta"}
            </button>
          </div>
        </div>
      </Dialog>
      <VoidReasonDialog
        open={showReason}
        amountLabel={usd(sale.total)}
        onClose={() => setShowReason(false)}
        onConfirm={async (reason) => {
          setPendingReason(reason);
          if (isAdmin) { performVoid(reason); return; }
          const exists = await ownerPinExists(tenantId);
          if (!aliveRef.current) return;
          if (exists) setShowPin(true);
          else setError("El dueño debe configurar su PIN en Ajustes, Seguridad para que un empleado pueda anular.");
        }}
      />
      <ManagerPinDialog open={showPin} reason="Anular esta venta" tenantId={tenantId} onClose={() => setShowPin(false)} onAuthorized={() => performVoid(pendingReason)} />
      <PromptDialog
        open={askPhone}
        title="Número de WhatsApp"
        message="Este cliente no tiene teléfono guardado. Escríbelo para enviar el recibo por WhatsApp."
        placeholder="Teléfono"
        inputMode="tel"
        onClose={() => setAskPhone(false)}
        actions={[{ label: "Cancelar" }, { label: "Enviar", primary: true, onPress: (v) => openWhatsApp(v) }]}
      />
    </>
  );
}
