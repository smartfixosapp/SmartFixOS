import { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { Download, Printer, Loader2, FileX } from "lucide-react";
import { fetchPublicReceipt } from "@/lib/receiptLink";
import { buildReceiptPDF, docFileName, totalOf, balanceOf, serviceSummary, deviceText, deliveredDate } from "@/lib/orderDocs";

const BRAND = "#F2662E";
const GREEN = "#1E9646";
const RED = "#C82828";
const INK = "#1c1c1e";
const GRAY = "#646464";
const LINE = "#d9d9de";

const num = (v) => {
  const n = typeof v === "number" ? v : parseFloat(v);
  return Number.isFinite(n) ? n : 0;
};

const moneyFor = (tenant) => {
  const cur = tenant?.currency || "USD";
  return (v) => {
    try { return new Intl.NumberFormat("es-PR", { style: "currency", currency: cur }).format(num(v)); } catch { return `$${num(v).toFixed(2)}`; }
  };
};

const dateTime = (d) => new Intl.DateTimeFormat("es-PR", { dateStyle: "medium", timeStyle: "short" }).format(d);

const label = { fontSize: 11, fontWeight: 700, letterSpacing: "0.06em", color: GRAY, textTransform: "uppercase" };

function Block({ title, children }) {
  return (
    <section style={{ marginTop: 22 }}>
      <p style={label}>{title}</p>
      <div style={{ marginTop: 6 }}>{children}</div>
    </section>
  );
}

function download(blob, name) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 30000);
}

export default function PublicReceipt() {
  const { token } = useParams();
  const [state, setState] = useState({ status: "loading", data: null });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    let alive = true;
    setState({ status: "loading", data: null });
    fetchPublicReceipt(token).then(
      (data) => { if (alive) setState(data ? { status: "ready", data } : { status: "gone", data: null }); },
      () => { if (alive) setState({ status: "error", data: null }); },
    );
    return () => { alive = false; };
  }, [token]);

  const order = state.data?.order;
  const tenant = state.data?.tenant;

  useEffect(() => {
    const meta = document.createElement("meta");
    meta.name = "robots";
    meta.content = "noindex, nofollow";
    document.head.appendChild(meta);
    const prev = document.title;
    return () => { meta.remove(); document.title = prev; };
  }, []);

  useEffect(() => {
    if (order) document.title = `Recibo ${order.order_number || ""} - ${tenant?.name || "Archilla OS"}`;
  }, [order, tenant]);

  const money = useMemo(() => moneyFor(tenant), [tenant]);

  const savePdf = async () => {
    if (!order || busy) return;
    setBusy(true);
    setError(null);
    try {
      const blob = await buildReceiptPDF({ order, tenant, publicView: true });
      download(blob, docFileName("receipt", order));
    } catch (e) {
      setError(e?.message || "No se pudo generar el PDF. Intenta de nuevo.");
    } finally {
      setBusy(false);
    }
  };

  const shell = (children) => (
    <div style={{ minHeight: "100dvh", background: "#f2f2f7", color: INK, padding: "16px 12px 40px", fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif" }}>
      <style>{`@media print { .no-print { display: none !important; } body { background: #fff !important; } .paper { box-shadow: none !important; border: none !important; } }`}</style>
      <div style={{ maxWidth: 720, margin: "0 auto" }}>{children}</div>
    </div>
  );

  if (state.status === "loading") {
    return shell(
      <div style={{ display: "flex", justifyContent: "center", paddingTop: 80 }}><Loader2 className="w-6 h-6 animate-spin" style={{ color: GRAY }} /></div>,
    );
  }

  if (state.status !== "ready") {
    return shell(
      <div style={{ background: "#fff", borderRadius: 16, padding: "40px 24px", textAlign: "center", marginTop: 40 }}>
        <FileX className="w-10 h-10" style={{ color: GRAY, margin: "0 auto 12px" }} />
        <p style={{ fontSize: 18, fontWeight: 700 }}>{state.status === "error" ? "No pudimos abrir el recibo" : "Este link ya no está disponible"}</p>
        <p style={{ fontSize: 14, color: GRAY, marginTop: 8 }}>{state.status === "error" ? "Revisa tu conexión e intenta de nuevo." : "Pídele al taller que te envíe uno nuevo."}</p>
      </div>,
    );
  }

  const items = (Array.isArray(order.order_items) ? order.order_items : []).filter((i) => i);
  const problem = String(order.initial_problem || "").trim();
  const svc = serviceSummary(order);
  const delivered = deliveredDate(order);
  const photoRaw = Array.isArray(order.device_photos) ? order.device_photos[0] : null;
  const photoUrl = typeof photoRaw === "string" ? photoRaw : photoRaw?.url;
  const sigUrl = order.device_security?.signatureUrl || order.device_security?.signature_url;
  const total = totalOf(order);
  const balance = balanceOf(order);
  const contact = [tenant?.address, tenant?.admin_phone && `Tel: ${tenant.admin_phone}`, tenant?.email, String(tenant?.settings?.merchant_registration || "").trim() && `Reg. Comerciante: ${tenant.settings.merchant_registration}`].filter(Boolean);
  const warranty = order.warranty_days ?? 30;
  const terms = [
    `Las piezas instaladas tienen garantía de ${warranty} días contra defectos de fábrica.`,
    "La garantía no cubre golpes, agua, manipulación de terceros, o uso indebido.",
    "Para reclamos de garantía, presentar este recibo con el dispositivo.",
    "Equipos no reclamados después de 30 días se considerarán abandonados.",
  ];

  return shell(
    <>
      <div className="no-print" style={{ display: "flex", gap: 10, marginBottom: 12 }}>
        <button type="button" onClick={savePdf} disabled={busy} style={{ flex: 1, height: 46, borderRadius: 12, background: BRAND, color: "#fff", fontSize: 15, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center", gap: 8, opacity: busy ? 0.7 : 1 }}>
          {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />} Descargar PDF
        </button>
        <button type="button" onClick={() => window.print()} style={{ flex: 1, height: 46, borderRadius: 12, background: "#fff", color: INK, fontSize: 15, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center", gap: 8, border: `1px solid ${LINE}` }}>
          <Printer className="w-4 h-4" /> Imprimir
        </button>
      </div>
      {error && <p className="no-print" style={{ fontSize: 13, color: RED, marginBottom: 10 }}>{error}</p>}

      <article className="paper" style={{ background: "#fff", borderRadius: 16, padding: "28px 22px 24px", boxShadow: "0 1px 3px rgba(0,0,0,0.08)" }}>
        <header style={{ display: "flex", gap: 14, alignItems: "flex-start" }}>
          {tenant?.logo_url && <img src={tenant.logo_url} alt="" style={{ width: 52, height: 52, objectFit: "contain", borderRadius: 8, flexShrink: 0 }} />}
          <div style={{ minWidth: 0 }}>
            <h1 style={{ fontSize: 24, fontWeight: 800, lineHeight: 1.15 }}>{tenant?.name || "Taller de Reparación"}</h1>
            {contact.map((l) => <p key={l} style={{ fontSize: 13, color: GRAY, marginTop: 2 }}>{l}</p>)}
          </div>
        </header>

        <hr style={{ border: 0, borderTop: `1px solid ${LINE}`, margin: "16px 0 14px" }} />

        <h2 style={{ fontSize: 20, fontWeight: 800 }}>{order.paid ? "RECIBO DE PAGO" : "RECIBO"}</h2>
        <p style={{ fontSize: 14, fontWeight: 700, color: GRAY, marginTop: 6 }}>Orden {order.order_number || ""}</p>
        <p style={{ fontSize: 13, color: GRAY, marginTop: 4 }}>Fecha: {order.created_date ? dateTime(new Date(order.created_date)) : ""}</p>
        {delivered && <p style={{ fontSize: 13, color: GRAY, marginTop: 2 }}>Entregado: {dateTime(delivered)}</p>}

        <div style={{ marginTop: 18, background: "#f5f5f5", border: `1px solid ${LINE}`, borderRadius: 10, padding: "12px 14px" }}>
          <p style={label}>Cliente</p>
          <p style={{ fontSize: 16, fontWeight: 700, marginTop: 4, overflowWrap: "anywhere" }}>{order.customer_name || "—"}</p>
          <p style={{ fontSize: 13, color: GRAY, marginTop: 2, overflowWrap: "anywhere" }}>{[order.customer_phone, order.customer_email].filter(Boolean).join(" · ")}</p>
        </div>

        <Block title="Dispositivo">
          <p style={{ fontSize: 15, fontWeight: 700 }}>{deviceText(order)}</p>
          {order.device_serial && <p style={{ fontSize: 13, color: GRAY, marginTop: 2 }}>Serial / IMEI: {order.device_serial}</p>}
        </Block>

        <Block title="Problema reportado">
          <p style={{ fontSize: 14, whiteSpace: "pre-wrap", lineHeight: 1.5 }}>{problem || "—"}</p>
        </Block>

        {svc && svc !== problem && (
          <Block title="Servicio realizado">
            <p style={{ fontSize: 14, whiteSpace: "pre-wrap", lineHeight: 1.5 }}>{svc}</p>
          </Block>
        )}

        {photoUrl && (
          <Block title="Foto del dispositivo">
            <img src={photoUrl} alt="Foto del dispositivo" style={{ maxWidth: "100%", maxHeight: 220, borderRadius: 8, objectFit: "contain" }} />
          </Block>
        )}

        {items.length > 0 && (
          <div style={{ marginTop: 22, overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14, minWidth: 420 }}>
              <thead>
                <tr style={{ background: "#e6e6e6" }}>
                  <th style={{ ...label, textAlign: "left", padding: "8px 8px", width: 32 }}>#</th>
                  <th style={{ ...label, textAlign: "left", padding: "8px 8px" }}>Descripción</th>
                  <th style={{ ...label, textAlign: "right", padding: "8px 8px" }}>Cant</th>
                  <th style={{ ...label, textAlign: "right", padding: "8px 8px" }}>Precio</th>
                  <th style={{ ...label, textAlign: "right", padding: "8px 8px" }}>Total</th>
                </tr>
              </thead>
              <tbody>
                {items.map((it, i) => {
                  const disc = it.type === "discount";
                  const color = disc ? RED : INK;
                  const line = it.total !== undefined && it.total !== null ? num(it.total) : num(it.price) * num(it.quantity || 1);
                  return (
                    <tr key={i} style={{ background: i % 2 ? "#f7f7f7" : "transparent" }}>
                      <td style={{ padding: "9px 8px", color: GRAY }}>{i + 1}</td>
                      <td style={{ padding: "9px 8px", color, overflowWrap: "anywhere" }}>{it.name || "—"}</td>
                      <td style={{ padding: "9px 8px", textAlign: "right" }}>{disc ? "" : Math.trunc(num(it.quantity) || 1)}</td>
                      <td style={{ padding: "9px 8px", textAlign: "right" }}>{disc ? "" : money(it.price)}</td>
                      <td style={{ padding: "9px 8px", textAlign: "right", fontWeight: 700, color }}>{money(line)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        <div style={{ marginTop: 18, marginLeft: "auto", maxWidth: 280, fontSize: 14 }}>
          {num(order.cost_estimate) > 0 && <div style={{ display: "flex", justifyContent: "space-between", padding: "3px 0" }}><span style={{ color: GRAY }}>Cotización:</span><b>{money(order.cost_estimate)}</b></div>}
          {num(order.labor_cost) > 0 && <div style={{ display: "flex", justifyContent: "space-between", padding: "3px 0" }}><span style={{ color: GRAY }}>Mano de obra:</span><b>{money(order.labor_cost)}</b></div>}
          <div style={{ display: "flex", justifyContent: "space-between", padding: "3px 0", fontSize: 16 }}><span style={{ color: GRAY }}>Total:</span><b>{money(total)}</b></div>
          <hr style={{ border: 0, borderTop: `1px solid ${LINE}`, margin: "8px 0" }} />
          <div style={{ display: "flex", justifyContent: "space-between", padding: "3px 0", fontSize: 16 }}><span style={{ color: GRAY }}>Pagado:</span><b style={{ color: GREEN }}>{money(order.amount_paid)}</b></div>
          {balance > 0.004
            ? <div style={{ display: "flex", justifyContent: "space-between", padding: "3px 0", fontSize: 16 }}><span style={{ color: GRAY }}>Balance:</span><b style={{ color: BRAND }}>{money(balance)}</b></div>
            : <p style={{ textAlign: "right", fontSize: 18, fontWeight: 800, color: GREEN, marginTop: 6 }}>PAGADO</p>}
        </div>

        <Block title="Términos de garantía">
          {terms.map((t) => <p key={t} style={{ fontSize: 12, color: "#3c3c3c", lineHeight: 1.5, marginTop: 3 }}>- {t}</p>)}
        </Block>

        {sigUrl && (
          <Block title="Firma del cliente">
            <img src={sigUrl} alt="Firma del cliente" style={{ maxWidth: 220, maxHeight: 90, objectFit: "contain" }} />
            <p style={{ fontSize: 12, color: GRAY, marginTop: 4 }}>El cliente acepta los términos y condiciones del servicio.</p>
          </Block>
        )}

        <p style={{ textAlign: "center", fontSize: 15, fontWeight: 700, marginTop: 30 }}>Gracias por su preferencia</p>
        <p style={{ textAlign: "center", fontSize: 11, color: "#aaaaaa", marginTop: 6 }}>Generado por Archilla OS</p>
      </article>
    </>,
  );
}
