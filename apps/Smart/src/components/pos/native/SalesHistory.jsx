import { useEffect, useMemo, useState } from "react";
import { Search, Clock, User, CheckCircle2, CreditCard, Calendar, UserCheck, RefreshCw, UserPlus, Share, ChevronRight, Trash, Loader2 } from "lucide-react";
import { P, tint, Dialog, TextAction, ErrorBanner, AlertDialog } from "./posUi";
import { CustomerSelectorDialog } from "./Dialogs";
import { ManagerPinDialog, sharePDFBlob } from "./Receipt";
import { usd, tenantDisplayName } from "@/lib/posLogic";
import { listSales, assignSaleCustomer, voidFromHistory, ownerPinExists } from "@/lib/posApi";

export function salePaymentLabel(pm) {
  switch (pm) {
    case "cash": return "Efectivo";
    case "card": return "Tarjeta";
    case "ath_movil": return "ATH Móvil";
    case "transfer": return "Transferencia";
    default: return pm ? pm.charAt(0).toUpperCase() + pm.slice(1).toLowerCase() : "Otro";
  }
}

function saleItems(sale) {
  const raw = Array.isArray(sale?.items) ? sale.items : [];
  const ok = raw.every((i) => i && typeof i.product_name === "string" && i.quantity !== undefined && i.unit_price !== undefined && i.total !== undefined);
  return ok ? raw : [];
}

function itemsPreview(sale) {
  const items = saleItems(sale);
  if (!items.length) return "Sin detalle";
  const names = items.slice(0, 2).map((i) => (Number(i.quantity) > 1 ? `${i.product_name} x${i.quantity}` : i.product_name));
  const preview = names.join(", ");
  return items.length > 2 ? `${preview}…` : preview;
}

function sameDay(a, b) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

function inRange(range, iso) {
  if (range === "all") return true;
  if (!iso) return false;
  const d = new Date(iso);
  const now = new Date();
  if (range === "today") return sameDay(d, now);
  if (range === "yesterday") { const y = new Date(now); y.setDate(now.getDate() - 1); return sameDay(d, y); }
  if (range === "last7") { const w = new Date(now); w.setDate(now.getDate() - 7); return d >= w; }
  return true;
}

const shortDate = (iso) => new Intl.DateTimeFormat("es-PR", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" }).format(new Date(iso));

async function loadImage(url) {
  try {
    const res = await fetch(url);
    const blob = await res.blob();
    return await new Promise((resolve) => {
      const r = new FileReader();
      r.onload = () => {
        const img = new Image();
        img.onload = () => resolve({ data: r.result, w: img.width, h: img.height });
        img.onerror = () => resolve(null);
        img.src = r.result;
      };
      r.onerror = () => resolve(null);
      r.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

async function buildHistoryPDF(sale, tenant, customerName, hasCustomer) {
  const { jsPDF } = await import("jspdf");
  const items = saleItems(sale);
  const W = 420;
  const margin = 28;
  const contentW = W - margin * 2;
  const rowH = 22;
  const pol = tenant?.settings?.policies || {};
  const probe = new jsPDF({ unit: "pt", format: [W, 800] });
  probe.setFontSize(10);
  let policyExtra = 0;
  [pol.sales_warranty, pol.sales_terms].forEach((t) => {
    const s = String(t || "").trim();
    if (s) policyExtra += probe.splitTextToSize(s, contentW).length * 12 + 44;
  });
  const H = 650 + Math.max(items.length, 1) * rowH + policyExtra;
  const doc = new jsPDF({ unit: "pt", format: [W, H] });
  const text = (s, x, y, { size = 12, bold = false, color = [51, 51, 51], align = "left" } = {}) => {
    doc.setFont("helvetica", bold ? "bold" : "normal");
    doc.setFontSize(size);
    doc.setTextColor(...color);
    doc.text(String(s), x, y, { baseline: "top", align });
  };
  const divider = (y, dashed) => {
    doc.setDrawColor(209, 209, 209);
    doc.setLineWidth(0.5);
    if (dashed) doc.setLineDashPattern([4, 3], 0);
    doc.line(margin, y, W - margin, y);
    if (dashed) doc.setLineDashPattern([], 0);
  };
  const mid = [115, 115, 115];
  const black = [0, 0, 0];
  const brand = [255, 87, 33];
  let y = margin;
  if (tenant?.logo_url) {
    const img = await loadImage(tenant.logo_url);
    if (img) {
      const h = Math.min(56, img.h);
      const w = Math.min((img.w / Math.max(img.h, 1)) * h, 160);
      try { doc.addImage(img.data, (W - w) / 2, y, w, h); y += h + 10; } catch { y += 0; }
    }
  }
  const name = tenantDisplayName(tenant);
  text(name, W / 2, y, { size: 17, bold: true, color: black, align: "center" });
  y += 20;
  if (tenant?.address) { text(tenant.address, W / 2, y, { size: 10, color: mid, align: "center" }); y += 13; }
  const contact = [tenant?.admin_phone ? `Tel: ${tenant.admin_phone}` : null, tenant?.email || null].filter(Boolean).join("   ");
  if (contact) { text(contact, W / 2, y, { size: 10, color: mid, align: "center" }); y += 13; }
  y += 10;
  divider(y);
  y += 16;
  text("RECIBO DE VENTA", margin, y, { size: 13, bold: true, color: mid });
  y += 20;
  text(sale.sale_number || "—", margin, y, { size: 22, bold: true, color: black });
  const dateStr = sale.created_at ? new Intl.DateTimeFormat("es-ES", { dateStyle: "long", timeStyle: "short" }).format(new Date(sale.created_at)) : "—";
  text(dateStr, W - margin, y + 6, { size: 11, color: mid, align: "right" });
  y += 32;
  if (sale.employee && sale.employee !== "system") { text(`Atendió: ${sale.employee}`, margin, y, { size: 11, color: mid }); y += 18; }
  if (hasCustomer) {
    y += 6;
    doc.setFillColor(242, 242, 242);
    doc.roundedRect(margin, y, contentW, 28, 6, 6, "F");
    text(`Cliente: ${customerName}`, margin + 10, y + 8, { size: 12, bold: true, color: [51, 51, 51] });
    y += 42;
  }
  y += 4;
  doc.setFillColor(230, 230, 230);
  doc.roundedRect(margin, y, contentW, 22, 4, 4, "F");
  const col2X = W - margin - 8;
  const col1X = col2X - 70;
  const col0X = col1X - 70;
  text("ARTÍCULO", margin + 8, y + 6, { size: 10, bold: true, color: mid });
  text("CANT.", col0X, y + 6, { size: 10, bold: true, color: mid, align: "center" });
  text("PRECIO", col1X, y + 6, { size: 10, bold: true, color: mid, align: "right" });
  text("TOTAL", col2X, y + 6, { size: 10, bold: true, color: mid, align: "right" });
  y += 26;
  items.forEach((it, i) => {
    if (i % 2 === 0) { doc.setFillColor(242, 242, 242); doc.rect(margin, y, contentW, rowH, "F"); }
    doc.setFontSize(12);
    const nameLines = doc.splitTextToSize(String(it.product_name), col0X - margin - 40);
    text(nameLines.length > 1 ? `${nameLines[0]}…` : nameLines[0], margin + 8, y + 4, { size: 12 });
    text(`×${it.quantity}`, col0X, y + 4, { size: 12, align: "center" });
    text(`$${(Number(it.unit_price) || 0).toFixed(2)}`, col1X, y + 4, { size: 12, align: "right" });
    text(`$${(Number(it.total) || 0).toFixed(2)}`, col2X, y + 4, { size: 12, align: "right" });
    y += rowH;
    if (i < items.length - 1) divider(y, true);
  });
  y += 8;
  divider(y);
  y += 12;
  const totalRow = (label, value, bold, color) => {
    text(label, margin, y, { size: bold ? 13 : 12, bold, color: bold ? black : mid });
    text(value, W - margin, y, { size: bold ? 14 : 12, bold, color: color || [51, 51, 51], align: "right" });
    y += bold ? 22 : 18;
  };
  if (sale.subtotal !== null && sale.subtotal !== undefined) totalRow("Subtotal", `$${(Number(sale.subtotal) || 0).toFixed(2)}`);
  if (Number(sale.tax_amount) > 0) totalRow("IVU", `$${Number(sale.tax_amount).toFixed(2)}`);
  y += 4;
  divider(y);
  y += 10;
  totalRow("TOTAL", `$${(Number(sale.total) || 0).toFixed(2)}`, true, brand);
  y += 6;
  doc.setFillColor(237, 245, 255);
  doc.roundedRect(margin, y, contentW, 28, 6, 6, "F");
  text(`Método de pago: ${salePaymentLabel(sale.payment_method)}`, margin + 10, y + 8, { size: 11.5, bold: true, color: brand });
  y += 44;
  divider(y);
  y += 16;
  text("¡Gracias por su preferencia!", W / 2, y, { size: 12, bold: true, color: black, align: "center" });
  y += 16;
  text(name, W / 2, y, { size: 10, color: mid, align: "center" });
  y += 24;
  [["GARANTÍA", pol.sales_warranty], ["CONDICIONES DE VENTA", pol.sales_terms]].forEach(([title, body]) => {
    const s = String(body || "").trim();
    if (!s) return;
    text(title, margin, y, { size: 10, bold: true, color: mid });
    y += 16;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.setTextColor(77, 77, 77);
    const lines = doc.splitTextToSize(s, contentW);
    doc.text(lines, margin, y, { baseline: "top" });
    y += lines.length * 12 + 28;
  });
  return doc.output("blob");
}

export function SaleDetailDialog({ open, sale, tenant, tenantId, isAdmin, employee, onClose, onChanged }) {
  const [assigned, setAssigned] = useState(null);
  const [picker, setPicker] = useState(false);
  const [assigning, setAssigning] = useState(false);
  const [assignError, setAssignError] = useState(null);
  const [confirmVoid, setConfirmVoid] = useState(false);
  const [pin, setPin] = useState(false);
  const [voiding, setVoiding] = useState(false);
  const [voidError, setVoidError] = useState(null);
  useEffect(() => { if (open) { setAssigned(null); setAssignError(null); setVoidError(null); } }, [open, sale?.id]);
  if (!sale) return null;
  const items = saleItems(sale);
  const customerName = assigned ? (assigned.company_name || assigned.name) : sale.customer?.name || "Sin cliente";
  const hasCustomer = !!assigned || !!sale.customer;
  const phone = assigned?.phone || sale.customer?.phone || "";
  const email = assigned?.email || sale.customer?.email || "";
  const contact = [phone, email].filter(Boolean)[0] || "";

  const assign = async (c) => {
    setAssigned(c);
    if (!c) return;
    setAssigning(true);
    setAssignError(null);
    try {
      await assignSaleCustomer(sale.id, c.id);
      onChanged?.();
    } catch (e) {
      setAssignError(`No se pudo guardar: ${e?.message || e}`);
    }
    setAssigning(false);
  };

  const share = async () => {
    try {
      const blob = await buildHistoryPDF(sale, tenant, customerName, hasCustomer);
      await sharePDFBlob(blob, `${sale.sale_number || "Recibo"}.pdf`);
    } catch (e) {
      setAssignError(e?.message || String(e));
    }
  };

  const performVoid = async (authorizedByPin) => {
    setVoiding(true);
    try {
      await voidFromHistory({ sale, tenantId, authorizedByPin, employeeName: employee?.full_name || "", employeeId: employee?.id || null });
      setVoiding(false);
      onChanged?.();
      onClose();
    } catch (e) {
      setVoiding(false);
      setVoidError(e?.message || String(e));
    }
  };

  const onVoidPress = async () => {
    if (isAdmin) { setConfirmVoid(true); return; }
    if (await ownerPinExists(tenantId)) setPin(true);
    else setVoidError("El dueno debe configurar su PIN en Ajustes, Seguridad para que un empleado pueda anular.");
  };

  const card = { padding: 16, borderRadius: 14, background: "#2C2C2E" };
  return (
    <>
      <Dialog open={open && !picker} onClose={onClose} title={sale.sale_number || "Detalle de venta"} width={560} height="86dvh" leading={<span />} trailing={<TextAction onClick={onClose}>Cerrar</TextAction>}>
        <div className="flex flex-col" style={{ gap: 16, paddingTop: 4 }}>
          <div className="flex flex-col" style={{ ...card, gap: 10 }}>
            <div className="flex items-center justify-between">
              <div>
                <p style={{ fontSize: 12, color: P.sub }}>Total</p>
                <p style={{ fontSize: 28, fontWeight: 700 }}>{usd(sale.total)}</p>
              </div>
              <CheckCircle2 className="w-9 h-9" style={{ color: P.success }} />
            </div>
            <div style={{ height: 0.5, background: P.sep }} />
            <div className="flex items-center gap-4 flex-wrap" style={{ fontSize: 12, color: P.sub }}>
              <span className="flex items-center gap-1"><CreditCard className="w-3.5 h-3.5" /> {salePaymentLabel(sale.payment_method)}</span>
              {sale.created_at && <span className="flex items-center gap-1"><Calendar className="w-3.5 h-3.5" /> {new Intl.DateTimeFormat("es-PR", { dateStyle: "medium", timeStyle: "short" }).format(new Date(sale.created_at))}</span>}
            </div>
            {sale.employee && sale.employee !== "system" && <span className="flex items-center gap-1" style={{ fontSize: 12, color: P.sub }}><UserCheck className="w-3.5 h-3.5" /> {sale.employee}</span>}
          </div>
          <div className="flex flex-col" style={{ ...card, gap: 10 }}>
            <p style={{ fontSize: 15, fontWeight: 600 }}>Artículos vendidos</p>
            {items.length === 0 ? (
              <p style={{ fontSize: 12, color: P.sub }}>Sin detalle de artículos</p>
            ) : (
              <>
                {items.map((it, i) => (
                  <div key={i}>
                    <div className="flex items-center justify-between">
                      <div>
                        <p style={{ fontSize: 15 }}>{it.product_name}</p>
                        <p style={{ fontSize: 12, color: P.sub }}>x{it.quantity} × {usd(it.unit_price)}</p>
                      </div>
                      <span style={{ fontSize: 15, fontWeight: 500 }}>{usd(it.total)}</span>
                    </div>
                    {i < items.length - 1 && <div style={{ height: 0.5, background: P.sep, marginTop: 10 }} />}
                  </div>
                ))}
                <div style={{ height: 0.5, background: P.sep }} />
                {sale.subtotal !== null && sale.subtotal !== undefined && <div className="flex justify-between" style={{ fontSize: 12 }}><span style={{ color: P.sub }}>Subtotal</span><span>{usd(sale.subtotal)}</span></div>}
                {Number(sale.tax_amount) > 0 && <div className="flex justify-between" style={{ fontSize: 12 }}><span style={{ color: P.sub }}>IVU</span><span>{usd(sale.tax_amount)}</span></div>}
                <div className="flex justify-between"><span style={{ fontSize: 15, fontWeight: 600 }}>Total</span><span style={{ fontSize: 15, fontWeight: 700, color: P.brand }}>{usd(sale.total)}</span></div>
              </>
            )}
          </div>
          <div className="flex flex-col" style={{ ...card, gap: 10 }}>
            <div className="flex items-center justify-between">
              <p style={{ fontSize: 15, fontWeight: 600 }}>Cliente</p>
              <button onClick={() => setPicker(true)} className="flex items-center gap-1" style={{ fontSize: 12, fontWeight: 500, color: P.brand }}>
                {hasCustomer ? <RefreshCw className="w-3.5 h-3.5" /> : <UserPlus className="w-3.5 h-3.5" />} {hasCustomer ? "Cambiar" : "Asignar cliente"}
              </button>
            </div>
            {hasCustomer ? (
              <>
                <div className="flex items-center gap-2.5">
                  <span style={{ width: 36, height: 36, borderRadius: 999, background: tint(P.brand, 0.12), color: P.brand, fontWeight: 600, display: "flex", alignItems: "center", justifyContent: "center" }}>{String(customerName).charAt(0).toUpperCase()}</span>
                  <div>
                    <p style={{ fontSize: 15, fontWeight: 500 }}>{customerName}</p>
                    {(phone || email) && <p style={{ fontSize: 12, color: P.sub }}>{phone || email}</p>}
                  </div>
                </div>
                {assigning && <p className="flex items-center gap-2" style={{ fontSize: 12, color: P.sub }}><Loader2 className="w-3 h-3 animate-spin" /> Guardando cliente…</p>}
                {assignError && <p style={{ fontSize: 12, color: P.danger }}>{assignError}</p>}
              </>
            ) : (
              <p style={{ fontSize: 12, color: P.sub }}>Sin cliente asignado</p>
            )}
          </div>
          <button onClick={share} className="apple-press flex items-center gap-3.5 text-left" style={card}>
            <span style={{ width: 44, height: 44, borderRadius: 10, background: tint(P.brand, 0.15), color: P.brand, display: "flex", alignItems: "center", justifyContent: "center" }}><Share className="w-5 h-5" /></span>
            <span className="flex-1 min-w-0">
              <span className="block" style={{ fontSize: 15, fontWeight: 600 }}>{hasCustomer ? `Enviar recibo a ${customerName}` : "Compartir recibo PDF"}</span>
              <span className="block truncate" style={{ fontSize: 12, color: P.sub }}>{hasCustomer && contact ? `${contact} · WhatsApp, Email, iMessage…` : "WhatsApp, Email, iMessage, AirDrop…"}</span>
            </span>
            <ChevronRight className="w-4 h-4" style={{ color: P.ter }} />
          </button>
          <button onClick={onVoidPress} disabled={voiding} className="apple-press flex items-center justify-center gap-2" style={{ padding: "12px 0", borderRadius: 12, border: `1px solid ${tint(P.danger, 0.4)}`, background: tint(P.danger, 0.12), color: P.danger, fontSize: 15, fontWeight: 600 }}>
            {voiding ? <Loader2 className="w-5 h-5 animate-spin" /> : <><Trash className="w-4 h-4" /> Anular venta</>}
          </button>
        </div>
      </Dialog>
      <CustomerSelectorDialog open={open && picker} tenantId={tenantId} selected={assigned} onClose={() => setPicker(false)} onSelect={(c) => assign(c)} />
      <AlertDialog
        open={confirmVoid}
        title="Anular esta venta?"
        message="La venta quedara marcada como anulada y saldra del historial. Queda registrada para tu contabilidad."
        onClose={() => setConfirmVoid(false)}
        actions={[{ label: "Anular venta", destructive: true, onPress: () => performVoid(false) }, { label: "Cancelar", bold: true }]}
      />
      <ManagerPinDialog open={pin} reason={`Anular la venta ${sale.sale_number || ""}`} tenantId={tenantId} onClose={() => setPin(false)} onAuthorized={() => performVoid(true)} />
      <AlertDialog open={!!voidError} title="No se pudo anular" message={voidError} onClose={() => setVoidError(null)} actions={[{ label: "OK", bold: true }]} />
    </>
  );
}

export default function SalesHistoryDialog({ open, tenantId, tenant, isAdmin, employee, onClose }) {
  const [sales, setSales] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [q, setQ] = useState("");
  const [range, setRange] = useState("all");
  const [limit, setLimit] = useState(50);
  const [reachedEnd, setReachedEnd] = useState(false);
  const [selected, setSelected] = useState(null);

  const load = async (lim = limit) => {
    setLoading(true);
    setError(null);
    try {
      const rows = await listSales(tenantId, lim);
      setSales(rows);
      setReachedEnd(rows.length < lim);
    } catch (e) {
      setError(e?.message || String(e));
    }
    setLoading(false);
  };

  useEffect(() => { if (open) { setQ(""); setRange("all"); setLimit(50); load(50); } }, [open]);

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    return sales.filter((sale) => {
      if (!inRange(range, sale.created_at)) return false;
      if (!s) return true;
      if (String(sale.sale_number || "").toLowerCase().includes(s)) return true;
      if (String(sale.customer?.name || "").toLowerCase().includes(s)) return true;
      return saleItems(sale).some((i) => String(i.product_name).toLowerCase().includes(s));
    });
  }, [sales, q, range]);
  const filteredTotal = filtered.reduce((sum, s) => sum + (Number(s.total) || 0), 0);

  return (
    <>
      <Dialog open={open && !selected} onClose={onClose} title="Historial de ventas" width={620} height="86dvh" leading={<TextAction onClick={onClose}>Cerrar</TextAction>} trailing={null} bodyPadding="0">
        <div className="flex flex-col h-full">
          <div style={{ padding: "4px 16px 8px" }}>
            <div className="flex items-center gap-2" style={{ padding: "8px 12px", borderRadius: 10, background: "#2C2C2E" }}>
              <Search className="w-4 h-4" style={{ color: P.sub }} />
              <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar por número, cliente o producto" style={{ flex: 1, background: "transparent", border: "none", outline: "none", color: P.text, fontSize: 16 }} />
            </div>
          </div>
          {loading && sales.length === 0 ? (
            <div className="flex justify-center" style={{ padding: 40 }}><Loader2 className="w-6 h-6 animate-spin" style={{ color: P.sub }} /></div>
          ) : error ? (
            <div style={{ padding: 16 }}><ErrorBanner message={error} onDismiss={() => load()} /></div>
          ) : sales.length === 0 ? (
            <div className="flex flex-col items-center text-center" style={{ padding: 40, gap: 8 }}>
              <Clock className="w-10 h-10" style={{ color: P.ter }} />
              <p style={{ fontSize: 17, fontWeight: 600 }}>Sin ventas registradas</p>
              <p style={{ fontSize: 14, color: P.sub }}>Las ventas del POS aparecerán aquí.</p>
            </div>
          ) : (
            <>
              <div className="flex gap-2" style={{ padding: "8px 16px" }}>
                {[["today", "Hoy"], ["yesterday", "Ayer"], ["last7", "7 días"], ["all", "Todo"]].map(([k, l]) => (
                  <button key={k} onClick={() => setRange(k)} style={{ padding: "6px 12px", borderRadius: 999, fontSize: 12, fontWeight: 600, background: range === k ? P.brand : P.fill, color: range === k ? "#fff" : P.text }}>{l}</button>
                ))}
              </div>
              <div className="flex items-center justify-between" style={{ padding: "0 16px 6px" }}>
                <span style={{ fontSize: 12, fontWeight: 600, color: P.sub }}>{filtered.length} ventas</span>
                <span style={{ fontSize: 16, fontWeight: 700, color: P.brand }}>{usd(filteredTotal)}</span>
              </div>
              <div className="flex-1 overflow-y-auto">
                {filtered.map((sale) => (
                  <button key={sale.id} onClick={() => setSelected(sale)} className="w-full flex items-center gap-3 text-left" style={{ padding: "10px 16px", borderTop: `0.5px solid ${P.sep}` }}>
                    <div className="flex-1 min-w-0">
                      <p className="flex items-center gap-1.5">
                        <span style={{ fontSize: 15, fontWeight: 600 }}>{sale.sale_number || "Venta"}</span>
                        {sale.payment_method && <span style={{ fontSize: 11, fontWeight: 500, padding: "2px 6px", borderRadius: 999, background: P.fill }}>{salePaymentLabel(sale.payment_method)}</span>}
                      </p>
                      <p className="truncate" style={{ fontSize: 12, color: P.sub }}>{itemsPreview(sale)}</p>
                      {sale.created_at && <p style={{ fontSize: 11, color: P.ter }}>{shortDate(sale.created_at)}</p>}
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      <span style={{ fontSize: 16, fontWeight: 600, color: P.brand }}>{usd(sale.total)}</span>
                      {sale.customer && <User className="w-3 h-3" style={{ color: P.sub }} />}
                    </div>
                  </button>
                ))}
                {!reachedEnd && range === "all" && !q && (
                  <button onClick={() => { const next = limit + 50; setLimit(next); load(next); }} className="w-full flex justify-center" style={{ padding: 14, color: P.brand, fontSize: 15, borderTop: `0.5px solid ${P.sep}` }}>
                    {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : "Cargar más"}
                  </button>
                )}
              </div>
            </>
          )}
        </div>
      </Dialog>
      <SaleDetailDialog
        open={open && !!selected}
        sale={selected}
        tenant={tenant}
        tenantId={tenantId}
        isAdmin={isAdmin}
        employee={employee}
        onClose={() => { setSelected(null); load(); }}
        onChanged={() => {}}
      />
    </>
  );
}
