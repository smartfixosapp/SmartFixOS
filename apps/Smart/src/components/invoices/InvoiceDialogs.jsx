import { useEffect, useMemo, useRef, useState } from "react";
import { Search, Loader2, Building2, ChevronRight, ChevronLeft, Check, Circle, Send, FileText, Mail, Download, History, AlertTriangle, XCircle, Copy, X } from "lucide-react";
import { Dialog, TextAction, PromptDialog, Toggle, tint } from "@/components/pos/native/posUi";
import { statusInfo } from "@/lib/orderStatus";
import {
  TERMS, termsLabel, dueDateFor, fmtDate, fmtMoney, companyName, orderTotal, orderSubtotal, loadCompanies, loadInvoiceableOrders, createInvoice, listInvoices, attachPDF, voidInvoice,
  uploadInvoicePDF, buildInvoicePDF, sendInvoiceEmail, regenerateVoidedPDF, regenerateInvoicePDF, sharePdfBlob, taxRateOf, recipientEmail, isVoided, isOverdue, num,
} from "@/lib/invoicesApi";

const CARD = "#2C2C2E";
const SUB = "#8E8E93";
const BRAND = "#F2662E";
const GREEN = "#4DC780";
const RED = "#FF7373";
const ORANGE = "#FFA640";

const r2 = (v) => Math.round((Number(v) || 0) * 100) / 100;
const deviceOf = (o) => [o.device_brand, o.device_family, o.device_model].filter(Boolean).join(" ");

function Centered({ children }) {
  return <div className="flex flex-col items-center text-center" style={{ padding: "48px 16px", gap: 10, color: SUB }}>{children}</div>;
}

function Segmented({ value, options, onChange }) {
  return (
    <div className="grid" style={{ gridTemplateColumns: `repeat(${options.length}, 1fr)`, padding: 2, gap: 2, borderRadius: 9, background: "rgba(118,118,128,0.24)" }}>
      {options.map(([v, l]) => <button key={v} onClick={() => onChange(v)} style={{ padding: "7px 0", borderRadius: 7, fontSize: 13, fontWeight: 600, background: value === v ? "#636366" : "transparent" }}>{l}</button>)}
    </div>
  );
}

function Message({ msg, onClose }) {
  if (!msg) return null;
  const color = msg.error ? RED : GREEN;
  return (
    <div className="flex items-start gap-2" style={{ padding: "10px 12px", borderRadius: 12, background: tint(color, 0.12), color, fontSize: 13, fontWeight: 600 }}>
      <span className="flex-1" style={{ whiteSpace: "pre-wrap" }}>{msg.text}</span>
      {msg.error && <button onClick={() => { try { navigator.clipboard?.writeText(msg.text); } catch { return; } }} aria-label="Copiar" style={{ color: SUB }}><Copy className="w-4 h-4" /></button>}
      <button onClick={onClose} aria-label="Cerrar mensaje" style={{ color: SUB }}><X className="w-4 h-4" /></button>
    </div>
  );
}

export function ConsolidatedInvoiceDialog({ open, onClose, tenant, tenantId, employeeName, onOpenHistory }) {
  const [companies, setCompanies] = useState(null);
  const [loadError, setLoadError] = useState(null);
  const [search, setSearch] = useState("");
  const [company, setCompany] = useState(null);
  const [orders, setOrders] = useState([]);
  const [loadingOrders, setLoadingOrders] = useState(false);
  const [selected, setSelected] = useState(() => new Set());
  const [language, setLanguage] = useState("es");
  const [terms, setTerms] = useState("due_on_receipt");
  const [notes, setNotes] = useState("");
  const [sendByEmail, setSendByEmail] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [lastInvoice, setLastInvoice] = useState(null);
  const [pdfBlob, setPdfBlob] = useState(null);
  const [msg, setMsg] = useState(null);
  const generatingRef = useRef(false);
  const selectSeq = useRef(0);

  const taxRate = taxRateOf(tenant);
  const currency = tenant?.currency || "USD";
  const fm = (v) => fmtMoney(v, currency, "es");

  useEffect(() => {
    if (!open) return undefined;
    let alive = true;
    setCompanies(null);
    setLoadError(null);
    setCompany(null);
    setOrders([]);
    setSelected(new Set());
    setSearch("");
    setNotes("");
    setLanguage("es");
    setTerms("due_on_receipt");
    setSendByEmail(true);
    setLastInvoice(null);
    setPdfBlob(null);
    setMsg(null);
    generatingRef.current = false;
    setGenerating(false);
    loadCompanies(tenantId).then((c) => { if (alive) setCompanies(c); }, (e) => { if (alive) { setLoadError(e?.message || String(e)); setCompanies([]); } });
    return () => { alive = false; };
  }, [open, tenantId]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return companies || [];
    return (companies || []).filter((c) => companyName(c).toLowerCase().includes(q) || String(c.email || "").toLowerCase().includes(q) || String(c.name || "").toLowerCase().includes(q));
  }, [companies, search]);

  const pickCompany = async (c) => {
    const seq = ++selectSeq.current;
    setCompany(c);
    setOrders([]);
    setSelected(new Set());
    setLoadingOrders(true);
    setMsg(null);
    setLastInvoice(null);
    setPdfBlob(null);
    try {
      const list = await loadInvoiceableOrders(tenantId, c);
      if (seq !== selectSeq.current) return;
      setOrders(list);
      setSelected(new Set(list.map((o) => o.id)));
    } catch (e) {
      if (seq === selectSeq.current) setMsg({ text: e?.message || String(e), error: true });
    } finally {
      if (seq === selectSeq.current) setLoadingOrders(false);
    }
  };

  const backToCompanies = () => {
    if (generating) return;
    selectSeq.current += 1;
    setCompany(null);
    setOrders([]);
    setSelected(new Set());
    setLastInvoice(null);
    setPdfBlob(null);
    setMsg(null);
  };

  const chosen = useMemo(() => orders.filter((o) => selected.has(o.id)), [orders, selected]);
  const total = r2(chosen.reduce((s, o) => s + orderTotal(o), 0));
  const subtotal = r2(chosen.reduce((s, o) => s + orderSubtotal(o, taxRate), 0));
  const taxAmount = r2(total - subtotal);
  const issuePreview = new Date();
  const duePreview = dueDateFor(terms, issuePreview);
  const email = company ? recipientEmail(company) : "";
  const willEmail = sendByEmail && !!email;

  const toggle = (id) => {
    if (lastInvoice) return;
    setSelected((prev) => { const n = new Set(prev); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  };

  const download = () => { if (pdfBlob && lastInvoice) sharePdfBlob(pdfBlob, `${lastInvoice.invoice_number}.pdf`, { title: `Factura ${lastInvoice.invoice_number}` }); };

  const generate = async () => {
    if (generatingRef.current || lastInvoice || !company || !chosen.length || !tenant) return;
    generatingRef.current = true;
    setGenerating(true);
    setMsg(null);
    const finish = () => { generatingRef.current = false; setGenerating(false); };
    const issuedAt = new Date();
    const dueDate = dueDateFor(terms, issuedAt);
    const snapshot = { company, orders: chosen, subtotal, taxRate, taxAmount, total, notes, language, terms };
    let saved;
    try {
      saved = await createInvoice({ tenantId, company, orders: chosen, subtotal, taxRate, taxAmount, total, currency, language, terms, dueDate, notes: notes.trim(), createdBy: employeeName || null, issuedAt });
    } catch (e) {
      finish();
      setMsg({ text: `No se pudo reservar el número de factura: ${e?.message || e}`, error: true });
      return;
    }
    setLastInvoice(saved);
    const invoiceNumber = saved.invoice_number;
    let pdf;
    try {
      pdf = await buildInvoicePDF({ invoiceNumber, ...snapshot, tenant, issuedAt, dueDate, isVoided: false });
    } catch {
      finish();
      setMsg({ text: `Factura ${invoiceNumber} guardada, pero el PDF no se pudo generar. Ábrela desde "Emitidas" para reintentar.`, error: true });
      return;
    }
    setPdfBlob(pdf);
    let uploadFailed = false;
    let pdfURL = null;
    try {
      pdfURL = await uploadInvoicePDF(tenantId, invoiceNumber, pdf, true);
      await attachPDF(saved.id, pdfURL);
    } catch {
      uploadFailed = true;
      pdfURL = null;
    }
    if (willEmail) {
      try {
        const sent = await sendInvoiceEmail({ to: email, tenantId, invoiceNumber, ...snapshot, tenant, dueDate, pdfURL });
        finish();
        if (sent) setMsg({ text: uploadFailed ? `Factura ${invoiceNumber} enviada a ${email} (el PDF no se pudo guardar para reimprimir)` : `Factura ${invoiceNumber} enviada a ${email}`, error: uploadFailed });
        else setMsg({ text: `Factura ${invoiceNumber} creada, pero el servidor no confirmó el envío del correo. Compártela a mano.`, error: true });
      } catch (e) {
        finish();
        setMsg({ text: `Factura ${invoiceNumber} creada, pero el correo falló: ${e?.message || e}`, error: true });
      }
    } else {
      finish();
      setMsg({ text: uploadFailed ? `Factura ${invoiceNumber} generada (no se pudo guardar el PDF para reimprimir)` : `Factura ${invoiceNumber} generada`, error: uploadFailed });
    }
  };

  useEffect(() => {
    if (!msg || msg.error) return undefined;
    const t = setTimeout(() => setMsg(null), 6000);
    return () => clearTimeout(t);
  }, [msg]);

  const leading = company
    ? <button onClick={backToCompanies} disabled={generating} className="apple-press flex items-center gap-1 disabled:opacity-40" style={{ color: BRAND, fontSize: 15, fontWeight: 600 }}><ChevronLeft className="w-4 h-4" /> Empresas</button>
    : <TextAction onClick={onClose}>Cerrar</TextAction>;
  const trailing = <button onClick={onOpenHistory} className="apple-press flex items-center gap-1" style={{ color: BRAND, fontSize: 14, fontWeight: 600 }}><History className="w-4 h-4" /> Emitidas</button>;

  const footer = company && !loadingOrders && orders.length > 0 ? (
    lastInvoice ? (
      <div className="flex flex-col" style={{ gap: 10 }}>
        <p className="flex items-center justify-center gap-2" style={{ fontSize: 15, fontWeight: 700, color: GREEN }}><Check className="w-4 h-4" /> Factura {lastInvoice.invoice_number} creada</p>
        <div className="flex" style={{ gap: 8 }}>
          {pdfBlob && <button onClick={download} className="apple-press flex-1 flex items-center justify-center gap-2" style={{ padding: "12px 0", borderRadius: 12, background: "#3A3A3C", fontWeight: 600 }}><Download className="w-4 h-4" /> Compartir PDF</button>}
          <button onClick={onClose} disabled={generating} className="apple-press flex-1 disabled:opacity-50" style={{ padding: "12px 0", borderRadius: 12, background: BRAND, color: "#fff", fontWeight: 700 }}>Listo</button>
        </div>
      </div>
    ) : (
      <button onClick={generate} disabled={!chosen.length || generating} className="apple-press w-full flex items-center justify-center gap-2 disabled:opacity-50" style={{ padding: "14px 0", borderRadius: 14, background: BRAND, color: "#fff", fontSize: 16, fontWeight: 700 }}>
        {generating ? <Loader2 className="w-5 h-5 animate-spin" /> : willEmail ? <Send className="w-5 h-5" /> : <FileText className="w-5 h-5" />}
        {generating ? (willEmail ? "Enviando…" : "Generando…") : willEmail ? "Crear y enviar factura" : "Crear y descargar PDF"}
      </button>
    )
  ) : null;

  return (
    <Dialog open={open} onClose={() => { if (!generating) onClose(); }} dismissable={!generating} title="Factura B2B" width={620} height="90dvh" leading={leading} trailing={trailing} footer={footer}>
      <div className="flex flex-col" style={{ gap: 14, paddingTop: 6 }}>
        <Message msg={msg} onClose={() => setMsg(null)} />
        {!company && (
          companies === null ? <Centered><Loader2 className="w-6 h-6 animate-spin" /><span>Cargando empresas…</span></Centered>
            : loadError && !companies.length ? <Centered><AlertTriangle className="w-7 h-7" style={{ color: ORANGE }} /><b style={{ color: "#fff" }}>No se pudieron cargar</b><span>{loadError}</span></Centered>
              : !companies.length ? <Centered><Building2 className="w-8 h-8" /><b style={{ color: "#fff" }}>Sin empresas con órdenes</b><span>Las empresas con órdenes abiertas y monto aparecerán aquí.</span></Centered>
                : (
                  <>
                    <label className="flex items-center gap-2" style={{ height: 42, padding: "0 12px", borderRadius: 12, background: CARD }}>
                      <Search className="w-4 h-4" style={{ color: SUB }} />
                      <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar empresa" aria-label="Buscar empresa" className="flex-1 bg-transparent outline-none" style={{ color: "#fff", fontSize: 15, minWidth: 0 }} />
                    </label>
                    <p style={{ fontSize: 12, fontWeight: 600, letterSpacing: "0.04em", color: SUB, textTransform: "uppercase" }}>Elige una empresa</p>
                    <div style={{ borderRadius: 14, background: CARD, overflow: "hidden" }}>
                      {filtered.map((c, i) => (
                        <button key={c.id} onClick={() => pickCompany(c)} className="apple-press w-full flex items-center gap-3 text-left" style={{ padding: "12px 14px", borderTop: i ? "0.5px solid rgba(84,84,88,0.6)" : "none" }}>
                          <span style={{ width: 40, height: 40, borderRadius: 10, background: tint(BRAND, 0.15), color: BRAND, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}><Building2 className="w-5 h-5" /></span>
                          <span className="flex-1 min-w-0"><span className="block truncate" style={{ fontSize: 15, fontWeight: 600 }}>{companyName(c)}</span>{c.email && <span className="block truncate" style={{ fontSize: 12, color: SUB }}>{c.email}</span>}</span>
                          <ChevronRight className="w-4 h-4" style={{ color: "rgba(235,235,245,0.3)" }} />
                        </button>
                      ))}
                      {!filtered.length && <p className="text-center" style={{ padding: 20, color: SUB, fontSize: 14 }}>Ninguna empresa coincide con “{search.trim()}”.</p>}
                    </div>
                  </>
                )
        )}
        {company && (
          loadingOrders ? <Centered><Loader2 className="w-6 h-6 animate-spin" /><span>Cargando órdenes…</span></Centered>
            : !orders.length ? <Centered><FileText className="w-8 h-8" /><b style={{ color: "#fff" }}>Sin órdenes facturables</b><span>Esta empresa no tiene órdenes abiertas con monto.</span></Centered>
              : (
                <>
                  <p style={{ fontSize: 12, fontWeight: 600, letterSpacing: "0.04em", color: SUB, textTransform: "uppercase" }}>Órdenes de {companyName(company)}</p>
                  <div style={{ borderRadius: 14, background: CARD, overflow: "hidden" }}>
                    {orders.map((o, i) => {
                      const on = selected.has(o.id);
                      const info = statusInfo(o.status);
                      return (
                        <button key={o.id} onClick={() => toggle(o.id)} disabled={!!lastInvoice} className="apple-press w-full flex items-center gap-3 text-left" style={{ padding: "11px 14px", borderTop: i ? "0.5px solid rgba(84,84,88,0.6)" : "none", opacity: lastInvoice && !on ? 0.4 : 1 }}>
                          {on ? <Check className="w-5 h-5" style={{ color: BRAND }} strokeWidth={3} /> : <Circle className="w-5 h-5" style={{ color: SUB }} />}
                          <span className="flex-1 min-w-0">
                            <span className="flex items-center gap-2"><span style={{ fontSize: 14, fontWeight: 700 }}>{o.order_number || "—"}</span><span style={{ padding: "1px 7px", borderRadius: 999, background: tint(info.color, 0.15), color: info.color, fontSize: 11, fontWeight: 600 }}>{info.label}</span></span>
                            <span className="block truncate" style={{ fontSize: 12, color: SUB }}>{deviceOf(o) || "—"}</span>
                          </span>
                          <span style={{ fontSize: 14, fontWeight: 700, fontVariantNumeric: "tabular-nums" }}>{fm(orderSubtotal(o, taxRate))}</span>
                        </button>
                      );
                    })}
                  </div>
                  <p style={{ fontSize: 12, color: SUB }}>Selecciona las órdenes a incluir. Por defecto van todas.</p>

                  <div className="flex flex-col" style={{ gap: 6, padding: 14, borderRadius: 14, background: CARD }}>
                    <div className="flex justify-between" style={{ fontSize: 14 }}><span style={{ color: SUB }}>Subtotal</span><span style={{ fontVariantNumeric: "tabular-nums" }}>{fm(subtotal)}</span></div>
                    <div className="flex justify-between" style={{ fontSize: 14 }}><span style={{ color: SUB }}>{String(tenant?.tax_label || "").trim() || "IVU"} ({(taxRate * 100).toFixed(1)}%)</span><span style={{ fontVariantNumeric: "tabular-nums" }}>{fm(taxAmount)}</span></div>
                    <div className="flex justify-between" style={{ fontSize: 16, fontWeight: 800, paddingTop: 6, borderTop: "0.5px solid rgba(84,84,88,0.6)" }}><span>Total</span><span style={{ color: BRAND, fontVariantNumeric: "tabular-nums" }}>{fm(total)}</span></div>
                  </div>

                  <div className="flex flex-col" style={{ gap: 10, padding: 14, borderRadius: 14, background: CARD, opacity: lastInvoice ? 0.6 : 1, pointerEvents: lastInvoice ? "none" : "auto" }}>
                    <p style={{ fontSize: 12, fontWeight: 600, letterSpacing: "0.04em", color: SUB, textTransform: "uppercase" }}>Documento</p>
                    <div><p style={{ fontSize: 13, color: SUB, marginBottom: 4 }}>Idioma del documento</p><Segmented value={language} onChange={setLanguage} options={[["es", "Español"], ["en", "English"]]} /></div>
                    <div><p style={{ fontSize: 13, color: SUB, marginBottom: 4 }}>Términos de pago</p><Segmented value={terms} onChange={setTerms} options={Object.keys(TERMS).map((k) => [k, termsLabel(k, language)])} /></div>
                    {duePreview && <div className="flex justify-between" style={{ fontSize: 14 }}><span>Vence</span><span style={{ color: SUB }}>{fmtDate(duePreview, "es")}</span></div>}
                    <p style={{ fontSize: 12, color: SUB }}>El PDF y el correo salen completos en el idioma que escojas. El vencimiento se calcula solo.</p>
                  </div>

                  <div className="flex flex-col" style={{ gap: 6, padding: 14, borderRadius: 14, background: CARD, opacity: lastInvoice ? 0.6 : 1, pointerEvents: lastInvoice ? "none" : "auto" }}>
                    <p style={{ fontSize: 12, fontWeight: 600, letterSpacing: "0.04em", color: SUB, textTransform: "uppercase" }}>Notas de la factura</p>
                    <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} placeholder="Ej. PO #1234, pago por transferencia" aria-label="Notas de la factura" className="w-full bg-transparent outline-none" style={{ color: "#fff", fontSize: 15, resize: "vertical" }} />
                  </div>

                  <div className="flex flex-col" style={{ gap: 4, padding: 14, borderRadius: 14, background: CARD, opacity: lastInvoice ? 0.6 : 1, pointerEvents: lastInvoice ? "none" : "auto" }}>
                    {email ? <Toggle on={sendByEmail} onChange={setSendByEmail} label={`Enviar por email a ${email}`} icon={<Mail className="w-4 h-4" style={{ color: BRAND }} />} /> : null}
                    <p style={{ fontSize: 12, color: SUB }}>
                      {!email ? "La empresa no tiene email. Se generará el PDF para descargar." : String(company.billing_email || "").trim() ? "Va al correo de facturación guardado en la ficha del cliente." : "Si lo apagas, solo se genera el PDF para descargar."}
                    </p>
                  </div>
                </>
              )
        )}
      </div>
    </Dialog>
  );
}

export function InvoiceHistoryDialog({ open, onClose, tenant, tenantId }) {
  const [invoices, setInvoices] = useState(null);
  const [loadError, setLoadError] = useState(null);
  const [search, setSearch] = useState("");
  const [busyId, setBusyId] = useState(null);
  const [voidTarget, setVoidTarget] = useState(null);
  const [msg, setMsg] = useState(null);
  const seq = useRef(0);

  const load = async () => {
    const n = ++seq.current;
    try {
      const rows = await listInvoices(tenantId);
      if (n === seq.current) { setInvoices(rows); setLoadError(null); }
    } catch (e) {
      if (n === seq.current) { setLoadError(e?.message || String(e)); setInvoices((prev) => prev || []); }
    }
  };

  useEffect(() => {
    if (!open) return;
    setInvoices(null);
    setSearch("");
    setMsg(null);
    load();
  }, [open, tenantId]);

  useEffect(() => {
    if (!msg) return undefined;
    const t = setTimeout(() => setMsg(null), 5000);
    return () => clearTimeout(t);
  }, [msg]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return invoices || [];
    return (invoices || []).filter((i) => String(i.invoice_number || "").toLowerCase().includes(q) || String(i.customer_name || "").toLowerCase().includes(q));
  }, [invoices, search]);

  const totalBilled = (invoices || []).filter((i) => !isVoided(i)).reduce((s, i) => s + num(i.total), 0);
  const fm = (v) => fmtMoney(v, tenant?.currency || "USD", "es");

  const share = async (inv) => {
    if (busyId) return;
    setBusyId(inv.id);
    try {
      if (isVoided(inv)) {
        const blob = await regenerateVoidedPDF({ invoice: inv, tenant });
        await sharePdfBlob(blob, `${inv.invoice_number}.pdf`, { title: `Factura ${inv.invoice_number}` });
        return;
      }
      if (!inv.pdf_url) {
        const rebuilt = await regenerateInvoicePDF({ invoice: inv, tenant, isVoided: false });
        try {
          const url = await uploadInvoicePDF(tenantId, inv.invoice_number, rebuilt, true);
          await attachPDF(inv.id, url);
          load();
        } catch {
          setMsg({ text: "PDF regenerado, pero no se pudo guardar para reimprimir.", error: true });
        }
        await sharePdfBlob(rebuilt, `${inv.invoice_number}.pdf`, { title: `Factura ${inv.invoice_number}` });
        return;
      }
      let blob = null;
      try {
        const res = await fetch(inv.pdf_url);
        if (res.ok) blob = await res.blob();
      } catch {
        blob = null;
      }
      if (blob) await sharePdfBlob(blob, `${inv.invoice_number}.pdf`, { title: `Factura ${inv.invoice_number}` });
      else window.open(inv.pdf_url, "_blank", "noopener");
    } catch {
      setMsg({ text: isVoided(inv) ? "No se pudo regenerar el PDF anulado." : "No se pudo bajar el PDF.", error: true });
    } finally {
      setBusyId(null);
    }
  };

  const doVoid = async (inv, reason) => {
    setBusyId(inv.id);
    try {
      await voidInvoice(inv.id, reason);
      try {
        const blob = await regenerateVoidedPDF({ invoice: { ...inv, voided_at: new Date().toISOString() }, tenant });
        const url = await uploadInvoicePDF(tenantId, inv.invoice_number, blob, true);
        await attachPDF(inv.id, url);
      } catch {
        setMsg({ text: `Factura ${inv.invoice_number} anulada, pero no se pudo actualizar el PDF guardado.`, error: true });
        await load();
        return;
      }
      await load();
      setMsg({ text: `Factura ${inv.invoice_number} anulada`, error: false });
    } catch (e) {
      setMsg({ text: e?.message || String(e), error: true });
    } finally {
      setBusyId(null);
    }
  };

  return (
    <>
      <Dialog open={open} onClose={onClose} title="Facturas emitidas" width={620} height="90dvh">
        <div className="flex flex-col" style={{ gap: 12, paddingTop: 6 }}>
          <Message msg={msg} onClose={() => setMsg(null)} />
          {invoices === null ? <Centered><Loader2 className="w-6 h-6 animate-spin" /><span>Cargando facturas…</span></Centered>
            : loadError && !invoices.length ? <Centered><AlertTriangle className="w-7 h-7" style={{ color: ORANGE }} /><b style={{ color: "#fff" }}>No se pudieron cargar</b><span>{loadError}</span></Centered>
              : !invoices.length ? <Centered><FileText className="w-8 h-8" /><b style={{ color: "#fff" }}>Todavía no hay facturas</b><span>Las facturas que emitas a empresas se guardan aquí para reimprimirlas cuando te las pidan.</span></Centered>
                : (
                  <>
                    <div className="flex items-center justify-between" style={{ padding: "12px 14px", borderRadius: 14, background: CARD }}>
                      <span style={{ fontSize: 14, color: SUB }}>Facturado</span>
                      <span style={{ fontSize: 17, fontWeight: 800, color: BRAND, fontVariantNumeric: "tabular-nums" }}>{fm(totalBilled)}</span>
                    </div>
                    <label className="flex items-center gap-2" style={{ height: 42, padding: "0 12px", borderRadius: 12, background: CARD }}>
                      <Search className="w-4 h-4" style={{ color: SUB }} />
                      <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Número o empresa" aria-label="Buscar factura" className="flex-1 bg-transparent outline-none" style={{ color: "#fff", fontSize: 15, minWidth: 0 }} />
                    </label>
                    <p style={{ fontSize: 12, fontWeight: 600, letterSpacing: "0.04em", color: SUB, textTransform: "uppercase" }}>{filtered.length} facturas</p>
                    <div style={{ borderRadius: 14, background: CARD, overflow: "hidden" }}>
                      {filtered.map((inv, i) => {
                        const voided = isVoided(inv);
                        return (
                          <div key={inv.id} className="flex items-center" style={{ borderTop: i ? "0.5px solid rgba(84,84,88,0.6)" : "none" }}>
                            <button onClick={() => share(inv)} disabled={busyId === inv.id} className="apple-press flex-1 min-w-0 flex items-center gap-3 text-left" style={{ padding: "12px 14px" }}>
                              <span className="flex-1 min-w-0">
                                <span className="flex items-center gap-2 flex-wrap">
                                  <span style={{ fontSize: 14, fontWeight: 700, fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace" }}>{inv.invoice_number}</span>
                                  {voided ? <Tag color={RED}>ANULADA</Tag> : isOverdue(inv) ? <Tag color={ORANGE}>VENCIDA</Tag> : null}
                                  {inv.language === "en" && <Tag color={BRAND}>EN</Tag>}
                                </span>
                                <span className="block truncate" style={{ fontSize: 12, color: SUB }}>{inv.customer_name || "—"}</span>
                                {inv.created_at && <span className="block" style={{ fontSize: 11, color: "rgba(235,235,245,0.3)" }}>{fmtDate(new Date(inv.created_at), "es")}</span>}
                              </span>
                              <span className="flex flex-col items-end" style={{ gap: 3 }}>
                                <span style={{ fontSize: 14, fontWeight: 700, color: voided ? SUB : "#fff", textDecoration: voided ? "line-through" : "none", fontVariantNumeric: "tabular-nums" }}>{fm(num(inv.total))}</span>
                                {busyId === inv.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" style={{ color: SUB }} /> : (inv.pdf_url || voided) ? <Download className="w-3.5 h-3.5" style={{ color: BRAND }} /> : null}
                              </span>
                            </button>
                            {!voided && <button onClick={() => setVoidTarget(inv)} disabled={busyId === inv.id} aria-label={`Anular ${inv.invoice_number}`} className="apple-press" style={{ padding: "0 14px", height: 60, color: RED }}><XCircle className="w-5 h-5" /></button>}
                          </div>
                        );
                      })}
                      {!filtered.length && <p className="text-center" style={{ padding: 20, color: SUB, fontSize: 14 }}>Ninguna factura coincide con “{search.trim()}”.</p>}
                    </div>
                  </>
                )}
        </div>
      </Dialog>
      <PromptDialog
        open={!!voidTarget}
        title="Anular factura"
        message="La factura se queda en el consecutivo marcada como anulada. Borrarla dejaría un hueco en la numeración."
        placeholder="Motivo"
        inputMode="text"
        onClose={() => setVoidTarget(null)}
        actions={[
          { label: "Cancelar" },
          { label: "Anular", destructive: true, primary: true, onPress: (val) => { const target = voidTarget; const reason = String(val || "").trim() || "Sin motivo"; if (target) doVoid(target, reason); } },
        ]}
      />
    </>
  );
}

function Tag({ color, children }) {
  return <span style={{ padding: "1px 6px", borderRadius: 999, background: tint(color, 0.15), color, fontSize: 9, fontWeight: 800 }}>{children}</span>;
}
