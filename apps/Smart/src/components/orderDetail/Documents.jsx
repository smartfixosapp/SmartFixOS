import { useEffect, useState } from "react";
import { FileText, Receipt, Tag, Printer, Download, Share2, MessageCircle, Mail, Loader2, Link2, Copy, QrCode, Check } from "lucide-react";
import { C, tint, Sheet } from "@/components/orderDetail/ui";
import { QUOTE_STATUSES, docFileName, labelsEnabled, setLabelsEnabled, qrData } from "@/lib/orderDocs";
import { createReceiptLink, receiptUrl, receiptMessage, smsHref, whatsappHref } from "@/lib/receiptLink";
import { downloadBlob } from "@/lib/invoicesApi";

function Item({ Icon, color, title, sub, onClick, disabled, busy }) {
  return (
    <button onClick={onClick} disabled={disabled || busy} className="apple-press w-full flex items-center gap-3 text-left disabled:opacity-50" style={{ padding: "12px 14px", background: C.card2 }}>
      <span style={{ width: 34, height: 34, borderRadius: 9, background: tint(color, 0.18), color, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>{busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Icon className="w-4 h-4" />}</span>
      <span className="flex-1 min-w-0"><span className="block" style={{ fontSize: 15, fontWeight: 600 }}>{title}</span>{sub && <span className="block" style={{ fontSize: 12, color: C.sub }}>{sub}</span>}</span>
    </button>
  );
}

export function DocumentsSheet({ open, onClose, order, busy, onReceipt, onQuote, onLabel }) {
  const [labels, setLabels] = useState(labelsEnabled());
  useEffect(() => { if (open) setLabels(labelsEnabled()); }, [open]);
  const quoteOk = QUOTE_STATUSES.includes(order?.status);
  return (
    <Sheet open={open} onClose={onClose} title="Documentos" width={420}>
      <div style={{ borderRadius: 14, overflow: "hidden" }} className="flex flex-col gap-px">
        <Item Icon={Receipt} color={C.brand} title="Recibo PDF" sub="Recibo con servicios, pagos y garantía" onClick={onReceipt} busy={busy === "receipt"} disabled={!!busy} />
        <Item Icon={FileText} color={C.indigo} title="Cotización" sub={quoteOk ? "Estimación con validez de 7 días" : "Solo antes de cobrar"} onClick={onQuote} busy={busy === "quote"} disabled={!quoteOk || !!busy} />
        <Item Icon={Tag} color={C.teal} title="Imprimir etiqueta" sub="Etiqueta de equipo con QR (200 x 110 pt)" onClick={onLabel} busy={busy === "label"} disabled={!!busy} />
      </div>
      <div className="flex items-center gap-3" style={{ marginTop: 14, padding: "10px 4px" }}>
        <span className="flex-1"><span className="block" style={{ fontSize: 14, fontWeight: 600 }}>Etiquetas de equipo</span><span className="block" style={{ fontSize: 12, color: C.sub }}>{labels ? "Imprime etiqueta al crear una orden" : "No se imprime etiqueta"}</span></span>
        <button onClick={() => { setLabelsEnabled(!labels); setLabels(!labels); }} role="switch" aria-checked={labels} aria-label="Etiquetas de equipo" style={{ width: 46, height: 28, borderRadius: 999, background: labels ? C.green : "#3A3A3C", position: "relative" }}><span style={{ position: "absolute", top: 2, left: labels ? 20 : 2, width: 24, height: 24, borderRadius: 999, background: "#fff", transition: "left 0.2s" }} /></button>
      </div>
    </Sheet>
  );
}

export function DocumentShareSheet({ open, onClose, kind, order, tenant, blob }) {
  const [msg, setMsg] = useState(null);
  const [link, setLink] = useState({ state: "idle", url: "" });
  const [qr, setQr] = useState(null);
  const [copied, setCopied] = useState(false);
  const orderId = order?.id;
  useEffect(() => {
    if (!open) return undefined;
    setMsg(null);
    setQr(null);
    setCopied(false);
    if (kind !== "receipt" || !orderId) { setLink({ state: "idle", url: "" }); return undefined; }
    let alive = true;
    setLink({ state: "loading", url: "" });
    createReceiptLink(orderId).then(
      (token) => { if (alive) setLink({ state: "ready", url: receiptUrl(token) }); },
      () => { if (alive) setLink({ state: "error", url: "" }); },
    );
    return () => { alive = false; };
  }, [open, kind, orderId]);
  if (!blob || !order) return null;
  const title = kind === "quote" ? "Cotización" : "Recibo";
  const linkReady = link.state === "ready";
  const caption = kind === "quote"
    ? `Aquí tienes tu cotización de la orden ${order.order_number}.`
    : linkReady
      ? receiptMessage({ tenantName: tenant?.name, customerName: order.customer_name, orderNumber: order.order_number, url: link.url })
      : `Aquí tienes tu recibo de la orden ${order.order_number}.`;
  const file = docFileName(kind, order);
  const phone = String(order.customer_phone || "").replace(/\D/g, "");
  const email = String(order.customer_email || "").trim();
  const print = () => {
    const url = URL.createObjectURL(blob);
    const frame = document.createElement("iframe");
    frame.style.cssText = "position:fixed;right:0;bottom:0;width:1px;height:1px;border:0;opacity:0";
    frame.src = url;
    let done = false;
    const fallback = () => { if (done) return; done = true; window.open(url, "_blank"); setMsg("Si no se abrió la impresión, usa Descargar PDF."); };
    const timer = setTimeout(fallback, 1800);
    frame.onerror = fallback;
    frame.onload = () => { if (done) return; done = true; clearTimeout(timer); try { frame.contentWindow.focus(); frame.contentWindow.print(); } catch { window.open(url, "_blank"); setMsg("Si no se abrió la impresión, usa Descargar PDF."); } };
    document.body.appendChild(frame);
    setTimeout(() => { frame.remove(); URL.revokeObjectURL(url); }, 120000);
  };
  const share = async () => {
    try {
      const f = new File([blob], file, { type: "application/pdf" });
      if (navigator.canShare && navigator.canShare({ files: [f] })) await navigator.share({ files: [f], title: `${title} - ${order.order_number}`, text: caption });
      else setMsg("Tu navegador no permite compartir archivos. Usa Descargar PDF.");
    } catch (e) { if (e?.name !== "AbortError") setMsg("No se pudo compartir."); }
  };
  const copyLink = async () => {
    try { await navigator.clipboard.writeText(link.url); setCopied(true); setTimeout(() => setCopied(false), 2200); } catch { setMsg("No se pudo copiar. Selecciona el link y cópialo."); }
  };
  const toggleQr = async () => {
    if (qr) { setQr(null); return; }
    try { setQr(await qrData(link.url, 360)); } catch { setMsg("No se pudo generar el QR."); }
  };
  const linkItem = (Icon, color, text, sub, href) => (
    <a href={href} target={href.startsWith("http") ? "_blank" : undefined} rel="noopener noreferrer" className="apple-press w-full flex items-center gap-3 text-left" style={{ padding: "12px 14px", background: C.card2 }}>
      <span style={{ width: 34, height: 34, borderRadius: 9, background: tint(color, 0.18), color, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}><Icon className="w-4 h-4" /></span>
      <span className="flex-1 min-w-0"><span className="block" style={{ fontSize: 15, fontWeight: 600 }}>{text}</span><span className="block" style={{ fontSize: 12, color: C.sub }}>{sub}</span></span>
    </a>
  );
  return (
    <Sheet open={open} onClose={onClose} title={title} width={420}>
      {kind === "receipt" && (
        <>
          <p style={{ fontSize: 12, fontWeight: 700, letterSpacing: "0.06em", color: C.sub, marginBottom: 8 }}>LINK DEL RECIBO</p>
          {link.state === "loading" && <p className="flex items-center gap-2" style={{ fontSize: 13, color: C.sub, marginBottom: 14 }}><Loader2 className="w-4 h-4 animate-spin" /> Preparando el link</p>}
          {link.state === "error" && <p style={{ fontSize: 13, color: C.amber, marginBottom: 14 }}>El link del recibo no está disponible todavía. Puedes usar el PDF.</p>}
          {linkReady && (
            <div style={{ marginBottom: 16 }}>
              <div style={{ borderRadius: 14, overflow: "hidden" }} className="flex flex-col gap-px">
                {phone && linkItem(MessageCircle, C.brand, "Enviar por mensaje", `SMS o iMessage a ${order.customer_phone}`, smsHref(order.customer_phone, caption))}
                {phone && linkItem(MessageCircle, C.green, "WhatsApp", "Mensaje con el link del recibo", whatsappHref(phone, caption))}
                {email && linkItem(Mail, C.blue, `Email a ${email}`, "Correo con el link del recibo", `mailto:${email}?subject=${encodeURIComponent(`${title} - ${order.order_number}`)}&body=${encodeURIComponent(caption)}`)}
                <Item Icon={copied ? Check : Copy} color={C.indigo} title={copied ? "Link copiado" : "Copiar link"} sub={link.url} onClick={copyLink} />
                <Item Icon={QrCode} color={C.teal} title={qr ? "Ocultar QR" : "Mostrar QR"} sub="El cliente lo escanea con la cámara" onClick={toggleQr} />
              </div>
              {qr && <div style={{ background: "#fff", borderRadius: 14, padding: 14, marginTop: 10, display: "flex", justifyContent: "center" }}><img src={qr} alt="QR del recibo" style={{ width: 220, height: 220 }} /></div>}
              <p style={{ fontSize: 12, color: C.sub, marginTop: 8 }}>El link abre el recibo en cualquier teléfono y caduca a los 90 días.</p>
            </div>
          )}
        </>
      )}
      <p style={{ fontSize: 12, fontWeight: 700, letterSpacing: "0.06em", color: C.sub, marginBottom: 8 }}>{kind === "receipt" ? "PDF" : "ENVIAR A"}</p>
      <div style={{ borderRadius: 14, overflow: "hidden" }} className="flex flex-col gap-px">
        <Item Icon={Printer} color={C.blue} title="Imprimir" sub="Abre el diálogo de impresión" onClick={print} />
        <Item Icon={Download} color={C.brand} title="Descargar PDF" sub={file} onClick={() => downloadBlob(blob, file)} />
        <Item Icon={Share2} color={C.indigo} title="Compartir" sub="Menú de compartir del dispositivo" onClick={share} />
        {kind !== "receipt" && phone && <a href={`https://wa.me/${phone.length === 10 ? `1${phone}` : phone}?text=${encodeURIComponent(caption)}`} target="_blank" rel="noopener noreferrer" className="apple-press w-full flex items-center gap-3 text-left" style={{ padding: "12px 14px", background: C.card2 }}><span style={{ width: 34, height: 34, borderRadius: 9, background: tint(C.green, 0.18), color: C.green, display: "flex", alignItems: "center", justifyContent: "center" }}><MessageCircle className="w-4 h-4" /></span><span className="flex-1"><span className="block" style={{ fontSize: 15, fontWeight: 600 }}>WhatsApp</span><span className="block" style={{ fontSize: 12, color: C.sub }}>Mensaje sin adjunto; descarga el PDF y envíalo</span></span></a>}
        {kind !== "receipt" && email && <a href={`mailto:${email}?subject=${encodeURIComponent(`${title} - ${order.order_number}`)}&body=${encodeURIComponent(caption)}`} className="apple-press w-full flex items-center gap-3 text-left" style={{ padding: "12px 14px", background: C.card2 }}><span style={{ width: 34, height: 34, borderRadius: 9, background: tint(C.blue, 0.18), color: C.blue, display: "flex", alignItems: "center", justifyContent: "center" }}><Mail className="w-4 h-4" /></span><span className="flex-1"><span className="block" style={{ fontSize: 15, fontWeight: 600 }}>Email a {email}</span><span className="block" style={{ fontSize: 12, color: C.sub }}>Correo sin adjunto; descarga el PDF y adjúntalo</span></span></a>}
        {kind === "receipt" && !linkReady && link.state !== "loading" && phone && <a href={`https://wa.me/${phone.length === 10 ? `1${phone}` : phone}?text=${encodeURIComponent(caption)}`} target="_blank" rel="noopener noreferrer" className="apple-press w-full flex items-center gap-3 text-left" style={{ padding: "12px 14px", background: C.card2 }}><span style={{ width: 34, height: 34, borderRadius: 9, background: tint(C.green, 0.18), color: C.green, display: "flex", alignItems: "center", justifyContent: "center" }}><MessageCircle className="w-4 h-4" /></span><span className="flex-1"><span className="block" style={{ fontSize: 15, fontWeight: 600 }}>WhatsApp</span><span className="block" style={{ fontSize: 12, color: C.sub }}>Mensaje sin adjunto; descarga el PDF y envíalo</span></span></a>}
        {kind === "receipt" && !linkReady && link.state !== "loading" && email && <a href={`mailto:${email}?subject=${encodeURIComponent(`${title} - ${order.order_number}`)}&body=${encodeURIComponent(caption)}`} className="apple-press w-full flex items-center gap-3 text-left" style={{ padding: "12px 14px", background: C.card2 }}><span style={{ width: 34, height: 34, borderRadius: 9, background: tint(C.blue, 0.18), color: C.blue, display: "flex", alignItems: "center", justifyContent: "center" }}><Mail className="w-4 h-4" /></span><span className="flex-1"><span className="block" style={{ fontSize: 15, fontWeight: 600 }}>Email a {email}</span><span className="block" style={{ fontSize: 12, color: C.sub }}>Correo sin adjunto; descarga el PDF y adjúntalo</span></span></a>}
      </div>
      <p style={{ fontSize: 12, color: C.sub, marginTop: 10 }}>En la web no se puede adjuntar el PDF a un SMS o correo automáticamente.</p>
      {msg && <p style={{ fontSize: 13, color: C.amber, marginTop: 6 }}>{msg}</p>}
    </Sheet>
  );
}
