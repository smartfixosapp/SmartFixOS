import { useEffect, useMemo, useState } from "react";
import { Loader2, MoreHorizontal, ChevronLeft, Pencil, FileDown, RotateCcw, PackageCheck, XCircle, Check, Wrench, ExternalLink } from "lucide-react";
import { Dialog, TextAction, AlertDialog, tint } from "@/components/pos/native/posUi";
import { Banner, Caption, Input, TextArea, W, money } from "@/components/wizard/ui";
import { supabase } from "../../../../../lib/supabase-client.js";
import {
  num, r2, statusMeta, lineItems, lineQty, lineReceived, linePending, lineTotal, isTool, hasStocked, paidMarker, cleanNotes, isTerminal, overdueDays, longDate, poSubtotal,
  saveTracking, linkLineToOrder, receivePO, cancelPO, savePOEdit, closeDraft, prDay,
} from "@/lib/comprasApi";
import { buildPurchaseOrderPDF } from "@/lib/poPdf";
import { downloadBlob } from "@/lib/invoicesApi";
import { OrderPicker } from "./POWizard";

const BRAND = "#F2662E";
const GREEN = "#4DC780";
const RED = "#FF7373";
const WARN = "#FFA640";
const INFO = "#66B3FF";
const VIP = "#FFC733";
const PURPLE = "#BF5AF2";

const Pill = ({ color, children }) => <span style={{ padding: "2px 9px", borderRadius: 999, background: tint(color, 0.16), color, fontSize: 11, fontWeight: 700 }}>{children}</span>;
const Section = ({ title, children }) => (<div className="flex flex-col" style={{ gap: 8 }}><Caption>{title}</Caption>{children}</div>);
const Box = ({ children, style }) => <div style={{ background: "#1C1C1E", borderRadius: 14, padding: 14, ...style }}>{children}</div>;
const InfoRow = ({ label, children, color }) => <div className="flex justify-between gap-3" style={{ padding: "6px 0", fontSize: 14 }}><span style={{ color: W.sub }}>{label}</span><span className="text-right" style={{ fontWeight: 600, color: color || "#fff" }}>{children}</span></div>;

export function EditPODialog({ open, po, tenantId, onClose, onSaved }) {
  const [ship, setShip] = useState("");
  const [useExpected, setUseExpected] = useState(false);
  const [expected, setExpected] = useState("");
  const [tracking, setTracking] = useState("");
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  useEffect(() => {
    if (!open || !po) return;
    setShip(num(po.shipping_cost) ? String(num(po.shipping_cost)) : "");
    setUseExpected(!!po.expected_date);
    setExpected(po.expected_date ? String(po.expected_date).slice(0, 10) : prDay());
    setTracking(po.tracking_number || "");
    setNotes(po.notes || "");
    setError(null);
  }, [open, po?.id]);
  if (!po) return null;
  const sub = poSubtotal(po);
  const tax = num(po.tax_amount);
  const shipN = Math.max(0, r2(num(ship)));
  const total = r2(sub + tax + shipN);
  const delta = r2(shipN - num(po.shipping_cost));
  const save = async () => {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const saved = await savePOEdit({ tenantId, po, shipping: shipN, expected: useExpected ? expected : null, tracking, notes });
      onSaved(saved);
      onClose();
    } catch (e) {
      setError(`No se pudo guardar: ${e?.message || e}`);
    } finally {
      setBusy(false);
    }
  };
  return (
    <Dialog open={open} onClose={() => !busy && onClose()} dismissable={!busy} title={`Editar orden ${po.po_number}`} width={500} height="88dvh"
      leading={<TextAction onClick={onClose} disabled={busy}>Cancelar</TextAction>} trailing={<TextAction bold onClick={save} disabled={busy}>{busy ? <Loader2 className="w-4 h-4 animate-spin" /> : "Guardar"}</TextAction>}>
      <div className="flex flex-col" style={{ gap: 14, paddingTop: 8 }}>
        <Section title="Costo de envío">
          <div className="flex items-center gap-2" style={{ background: W.card2, borderRadius: 12, padding: "0 14px", height: 46 }}><span style={{ color: W.sub }}>$</span><input value={ship} onChange={(e) => { const r = e.target.value.replace(",", "."); if (/^\d*\.?\d{0,2}$/.test(r)) setShip(r); }} inputMode="decimal" placeholder="0.00" aria-label="Costo de envío" className="bg-transparent outline-none flex-1" style={{ color: "#fff", fontSize: 17 }} /></div>
          <p style={{ fontSize: 12, color: Math.abs(delta) > 0.004 ? (delta > 0 ? WARN : GREEN) : W.sub }}>{Math.abs(delta) > 0.004 ? (delta > 0 ? `Se sumará ${money(delta)} al gasto ya registrado` : `Se restará ${money(-delta)} del gasto ya registrado`) : "Se suma al total. El gasto registrado en Finanzas se actualiza automáticamente."}</p>
        </Section>
        <Section title="Fechas">
          <div className="flex items-center" style={{ fontSize: 15 }}><span className="flex-1">Fecha esperada de llegada</span><button onClick={() => setUseExpected((v) => !v)} role="switch" aria-checked={useExpected} aria-label="Fecha esperada" style={{ width: 51, height: 31, borderRadius: 999, background: useExpected ? GREEN : "#3A3A3C", position: "relative" }}><span style={{ position: "absolute", top: 2, left: useExpected ? 22 : 2, width: 27, height: 27, borderRadius: 999, background: "#fff", transition: "left 0.2s" }} /></button></div>
          {useExpected && <Input label="Esperada" type="date" value={expected} onChange={setExpected} />}
        </Section>
        <Section title="Tracking"><Input value={tracking} onChange={setTracking} placeholder="Número de tracking" /></Section>
        <Section title="Notas"><TextArea value={notes} onChange={setNotes} rows={4} placeholder="Notas para esta orden" /></Section>
        <Section title="Nuevo total">
          <Box style={{ background: W.card2 }}>
            <InfoRow label="Subtotal">{money(sub)}</InfoRow>
            {tax > 0 && <InfoRow label="Impuesto">{money(tax)}</InfoRow>}
            {shipN > 0 && <InfoRow label="Envío">{money(shipN)}</InfoRow>}
            <InfoRow label="Total nuevo" color={BRAND}>{money(total)}</InfoRow>
          </Box>
        </Section>
        {error && <Banner color={RED}>{error}</Banner>}
      </div>
    </Dialog>
  );
}

export function ReceiveDialog({ open, po, tenantId, tenant, employeeName, onClose, onDone }) {
  const [qty, setQty] = useState({});
  const [loc, setLoc] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const items = po ? lineItems(po) : [];
  useEffect(() => {
    if (!open || !po) return;
    const q = {};
    lineItems(po).forEach((l) => { q[l.id] = String(linePending(l)); });
    setQty(q);
    setLoc("");
    setError(null);
  }, [open, po?.id]);
  if (!po) return null;
  const hasNew = items.some((l) => !l.inventory_item_id && !isTool(l));
  const confirm = async () => {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const received = {};
      items.forEach((l) => { received[l.id] = Math.min(linePending(l), Math.max(0, num(qty[l.id]))); });
      const res = await receivePO({ tenantId, poId: po.id, received, location: loc, by: employeeName, tenant });
      const msg = res.stocked > 0 || res.expense > 0 || res.notified > 0
        ? `${res.stocked} producto${res.stocked === 1 ? "" : "s"} a stock · gasto ${money(res.expense)} · ${res.notified} orden${res.notified === 1 ? "" : "es"} notificada${res.notified === 1 ? "" : "s"}`
        : "Recepción registrada";
      onDone(res.po, msg);
      onClose();
    } catch (e) {
      setError(`Error al recibir: ${e?.message || e}`);
    } finally {
      setBusy(false);
    }
  };
  return (
    <Dialog open={open} onClose={() => !busy && onClose()} dismissable={!busy} title="Recibir orden" width={520} height="88dvh"
      leading={<TextAction onClick={onClose} disabled={busy}>Cerrar</TextAction>} trailing={<TextAction bold onClick={confirm} disabled={busy}>{busy ? <Loader2 className="w-4 h-4 animate-spin" /> : "Confirmar"}</TextAction>}>
      <div className="flex flex-col" style={{ gap: 14, paddingTop: 8 }}>
        <p style={{ fontSize: 13, color: W.sub }}>Confirma cuántas unidades de cada item llegaron. Por defecto se reciben todas.</p>
        {hasNew && (
          <div className="flex flex-col" style={{ gap: 6 }}>
            <Input label="Gaveta para todo" value={loc} onChange={(v) => setLoc(v.toUpperCase())} placeholder="Ej. A3" />
            <p style={{ fontSize: 12, color: W.sub }}>Se aplica a las piezas nuevas que se crean al recibir. Lo que ya existe en el catálogo conserva su gaveta.</p>
          </div>
        )}
        <Section title="Items">
          <Box style={{ padding: 0, overflow: "hidden" }}>
            {items.map((l, i) => {
              const isNew = !l.inventory_item_id && !isTool(l);
              return (
                <div key={l.id} className="flex flex-col" style={{ gap: 4, padding: "12px 14px", borderTop: i ? `0.5px solid ${W.sep}` : "none" }}>
                  <div className="flex items-center gap-2"><span className="flex-1 min-w-0 truncate" style={{ fontSize: 15, fontWeight: 600 }}>{l.product_name}</span>{isTool(l) ? <Pill color={VIP}>Herramienta</Pill> : isNew ? <Pill color={INFO}>Nueva · se creará</Pill> : null}</div>
                  {isNew && num(l.unit_price) <= 0 && <p style={{ fontSize: 12, color: RED }}>Falta precio · no se podrá vender hasta que se lo pongas en Inventario</p>}
                  <p style={{ fontSize: 12, color: W.sub }}>{lineReceived(l) > 0 ? `Pediste ${lineQty(l)} · ya recibiste ${lineReceived(l)}` : `Pediste ${lineQty(l)}`}</p>
                  <div className="flex items-center justify-between"><span style={{ fontSize: 13, color: W.sub }}>Recibiendo ahora</span>
                    <input value={qty[l.id] ?? ""} onChange={(e) => { const r = e.target.value.replace(",", "."); if (/^\d*\.?\d{0,2}$/.test(r)) setQty((p) => ({ ...p, [l.id]: r })); }} inputMode="decimal" aria-label={`Recibiendo ${l.product_name}`} className="outline-none text-right" style={{ width: 90, background: W.card2, color: "#fff", borderRadius: 10, padding: "8px 10px", fontSize: 16, fontWeight: 700 }} /></div>
                </div>
              );
            })}
          </Box>
        </Section>
        <div className="flex justify-between" style={{ fontSize: 15, fontWeight: 700 }}><span>Total a registrar</span><span style={{ color: BRAND }}>{money(num(po.total_amount))}</span></div>
        {error && <Banner color={RED}>{error}</Banner>}
      </div>
    </Dialog>
  );
}

const CLOSE_METHODS = [["card", "Tarjeta"], ["ath", "ATH Móvil"], ["cash", "Efectivo"], ["credit", "Crédito"]];

export function CloseDraftDialog({ open, po, tenantId, employeeName, onClose, onDone }) {
  const [ship, setShip] = useState("");
  const [tax, setTax] = useState("");
  const [method, setMethod] = useState("card");
  const [conf, setConf] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  useEffect(() => { if (open) { setShip(""); setTax(""); setMethod("card"); setConf(""); setError(null); } }, [open, po?.id]);
  if (!po) return null;
  const items = lineItems(po);
  const sub = r2(items.reduce((s, l) => s + lineTotal(l), 0));
  const total = r2(sub + Math.max(0, num(ship)) + Math.max(0, num(tax)));
  const money2 = (v, set) => (e) => { const r = e.target.value.replace(",", "."); if (/^\d*\.?\d{0,2}$/.test(r)) set(r); };
  const submit = async () => {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const res = await closeDraft({ tenantId, po, shipping: num(ship), tax: num(tax), method, confirmation: conf, by: employeeName });
      onDone(res.po, res.expenseFailed ? "Pedido cerrado, pero el gasto no se registró en Finanzas. Agrégalo manualmente en Gastos." : `Pedido ${res.po.po_number} cerrado`, res.expenseFailed);
      onClose();
    } catch (e) {
      setError(`No se pudo cerrar: ${e?.message || e}`);
    } finally {
      setBusy(false);
    }
  };
  return (
    <Dialog open={open} onClose={() => !busy && onClose()} dismissable={!busy} title={po.supplier_name || "Cerrar pedido"} width={500} height="90dvh" leading={<span />} trailing={<TextAction onClick={onClose} disabled={busy}>Cerrar</TextAction>}
      footer={<button onClick={submit} disabled={busy || !items.length} className="apple-press w-full flex items-center justify-center gap-2 disabled:opacity-50" style={{ padding: "14px 0", borderRadius: 14, background: BRAND, color: "#fff", fontSize: 16, fontWeight: 700 }}>{busy ? <Loader2 className="w-5 h-5 animate-spin" /> : null} Ya lo ordené · {money(total)}</button>}>
      <div className="flex flex-col" style={{ gap: 14, paddingTop: 8 }}>
        <Section title="Piezas">
          <Box style={{ padding: 0, overflow: "hidden" }}>
            {items.map((l, i) => (
              <div key={l.id} className="flex items-center gap-2" style={{ padding: "10px 14px", borderTop: i ? `0.5px solid ${W.sep}` : "none" }}>
                <span className="flex-1 min-w-0"><span className="block truncate" style={{ fontSize: 14, fontWeight: 600 }}>{l.product_name}</span>{l.linked_work_order_number && <span className="block" style={{ fontSize: 12, color: INFO }}>{l.linked_work_order_number}</span>}</span>
                <b>{money(lineTotal(l))}</b>
              </div>
            ))}
          </Box>
        </Section>
        <Section title="Cargos">
          <Box>
            {[["Envío", ship, setShip], ["Impuesto", tax, setTax]].map(([label, v, set]) => (
              <div key={label} className="flex items-center justify-between" style={{ padding: "4px 0" }}><span style={{ fontSize: 15 }}>{label}</span><input value={v} onChange={money2(v, set)} inputMode="decimal" placeholder="0.00" aria-label={label} className="outline-none text-right" style={{ width: 100, background: W.card2, color: "#fff", borderRadius: 10, padding: "8px 10px", fontSize: 16 }} /></div>
            ))}
            <div className="flex justify-between" style={{ paddingTop: 8, marginTop: 6, borderTop: `0.5px solid ${W.sep}`, fontSize: 16, fontWeight: 800 }}><span>Total</span><span style={{ color: BRAND }}>{money(total)}</span></div>
          </Box>
        </Section>
        <Section title="Cómo pagaste">
          <div className="grid" style={{ gridTemplateColumns: `repeat(${CLOSE_METHODS.length}, 1fr)`, padding: 2, gap: 2, borderRadius: 9, background: "rgba(118,118,128,0.24)" }}>
            {CLOSE_METHODS.map(([k, l]) => <button key={k} onClick={() => setMethod(k)} style={{ padding: "8px 0", borderRadius: 7, fontSize: 13, fontWeight: 600, background: method === k ? "#636366" : "transparent" }}>{l}</button>)}
          </div>
          {method === "credit" && <p style={{ fontSize: 12, color: W.sub }}>Se registra como cuenta por pagar, no como dinero que ya salió.</p>}
        </Section>
        <Section title="Confirmación del suplidor (opcional)"><Input value={conf} onChange={setConf} placeholder="# de orden" /></Section>
        {po.invoice_link && <a href={po.invoice_link} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2" style={{ color: BRAND, fontWeight: 600, fontSize: 14 }}><ExternalLink className="w-4 h-4" /> Abrir {po.supplier_name || "link"}</a>}
        {error && <Banner color={RED}>{error}</Banner>}
      </div>
    </Dialog>
  );
}

export default function PODetailPanel({ po, tenant, tenantId, employeeName, onUpdated, onReorder, onBack, toastMsg }) {
  const [menu, setMenu] = useState(false);
  const [dlg, setDlg] = useState(null);
  const [tracking, setTracking] = useState("");
  const [trackSaved, setTrackSaved] = useState(false);
  const [woPick, setWoPick] = useState(null);
  const [error, setError] = useState(null);
  const [toast, setToast] = useState(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => { setTrackSaved(false); setError(null); setMenu(false); setDlg(null); }, [po?.id]);
  useEffect(() => { setTracking(po?.tracking_number || ""); }, [po?.id, po?.tracking_number]);
  useEffect(() => { if (toastMsg) setToast({ text: toastMsg.text, error: !!toastMsg.error }); }, [toastMsg]);
  useEffect(() => { if (!toast || toast.error) return undefined; const t = setTimeout(() => setToast(null), 4000); return () => clearTimeout(t); }, [toast]);
  useEffect(() => {
    if (!menu) return undefined;
    const close = () => setMenu(false);
    window.addEventListener("click", close);
    return () => window.removeEventListener("click", close);
  }, [menu]);

  const items = useMemo(() => (po ? lineItems(po) : []), [po]);
  if (!po) return <div className="flex items-center justify-center" style={{ height: "100%", color: W.sub, padding: 40 }}>Selecciona una compra</div>;

  const meta = statusMeta(po.status);
  const stocked = hasStocked(po);
  const paid = paidMarker(po);
  const terminal = isTerminal(po);
  const isDraft = po.status === "draft";
  const late = overdueDays(po);
  const notes = cleanNotes(po.notes);
  const canReceive = !terminal && !stocked && !isDraft;

  const saveTrack = async () => {
    const v = tracking.trim();
    if (v === String(po.tracking_number || "").trim()) return;
    try { await saveTracking(po.id, v); setTrackSaved(true); onUpdated({ ...po, tracking_number: v }); } catch (e) { setError(`No se pudo guardar tracking: ${e?.message || e}`); }
  };

  const sharePdf = async () => {
    setMenu(false);
    try {
      let supplier = null;
      if (po.supplier_id) { const { data } = await supabase.from("supplier").select("*").eq("id", po.supplier_id).maybeSingle(); supplier = data; }
      downloadBlob(await buildPurchaseOrderPDF({ po, supplier, tenant }), `${po.po_number}.pdf`);
    } catch {
      setToast({ text: "No se pudo generar el PDF.", error: true });
    }
  };

  const doCancel = async (target) => {
    setBusy(true);
    try {
      const res = await cancelPO({ tenantId, po: target, by: employeeName });
      onUpdated(res.po);
      setToast(res.voided ? { text: res.removed > 0 ? "Orden cancelada — gasto anulado" : "Orden cancelada", error: false } : { text: "Orden cancelada, pero el gasto vinculado no se pudo anular. Anúlalo manualmente en Finanzas para que no quede contado.", error: true });
    } catch (e) {
      setToast({ text: `No se pudo cancelar: ${e?.message || e}`, error: true });
    } finally {
      setBusy(false);
    }
  };

  const doLink = async (lineId, order) => {
    try { onUpdated(await linkLineToOrder({ tenantId, po, lineId, order, by: employeeName })); } catch (e) { setError(`No se pudo vincular: ${e?.message || e}`); }
  };

  const menuItem = (label, Icon, onClick, color) => <button onClick={(e) => { e.stopPropagation(); setMenu(false); onClick(); }} className="apple-press w-full flex items-center gap-2 text-left" style={{ padding: "10px 14px", fontSize: 14, color: color || "#fff" }}><Icon className="w-4 h-4" /> {label}</button>;

  return (
    <div className="flex flex-col" style={{ gap: 14, padding: 16 }}>
      <div className="flex items-center gap-2">
        {onBack && <button onClick={onBack} className="apple-press flex items-center gap-1" style={{ color: BRAND, fontWeight: 600 }}><ChevronLeft className="w-5 h-5" /> Compras</button>}
        <span className="flex-1" />
        <div className="relative">
          <button onClick={(e) => { e.stopPropagation(); setMenu((v) => !v); }} aria-label="Acciones" className="apple-press" style={{ width: 36, height: 36, borderRadius: 999, background: "#2C2C2E", display: "flex", alignItems: "center", justifyContent: "center" }}><MoreHorizontal className="w-5 h-5" /></button>
          {menu && (
            <div className="absolute right-0" style={{ top: 42, zIndex: 40, minWidth: 210, background: "#2C2C2E", borderRadius: 14, overflow: "hidden", boxShadow: "0 10px 30px rgba(0,0,0,0.5)" }} onClick={(e) => e.stopPropagation()}>
              {po.status !== "cancelled" && menuItem("Editar orden", Pencil, () => setDlg({ kind: "edit", po }))}
              {menuItem("Compartir PDF", FileDown, sharePdf)}
              {items.length > 0 && menuItem("Volver a pedir", RotateCcw, () => onReorder(po))}
              {isDraft && menuItem("Cerrar pedido", PackageCheck, () => setDlg({ kind: "close", po }))}
              {canReceive && menuItem("Recibir orden", PackageCheck, () => setDlg({ kind: "receive", po }))}
              {po.status !== "cancelled" && menuItem("Cancelar orden", XCircle, () => setDlg({ kind: "cancel", po }), RED)}
            </div>
          )}
        </div>
      </div>

      {toast && <Banner color={toast.error ? RED : GREEN} onDismiss={() => setToast(null)}>{toast.text}</Banner>}

      <Box style={{ textAlign: "center" }}>
        <span className="flex items-center justify-center mx-auto" style={{ width: 56, height: 56, borderRadius: 999, background: tint(meta.color, 0.16), color: meta.color }}>{po.status === "received" ? <Check className="w-7 h-7" /> : po.status === "cancelled" ? <XCircle className="w-7 h-7" /> : <PackageCheck className="w-7 h-7" />}</span>
        <p style={{ fontSize: 22, fontWeight: 800, marginTop: 8, fontFamily: "ui-rounded, system-ui" }}>{po.po_number}</p>
        <p style={{ fontSize: 14, color: W.sub }}>{po.supplier_name || "Suplidor desconocido"}</p>
        <div className="flex items-center justify-center flex-wrap" style={{ gap: 6, marginTop: 8 }}><Pill color={meta.color}>{meta.label}</Pill>{stocked && <Pill color={GREEN}>En stock</Pill>}{paid && <Pill color={INFO}>Pagado</Pill>}</div>
      </Box>

      {error && <Banner color={RED} onDismiss={() => setError(null)}>{error}</Banner>}

      <Section title="Información">
        <Box>
          <InfoRow label="Fecha de orden">{longDate(po.order_date)}</InfoRow>
          {po.expected_date && <InfoRow label="Fecha esperada" color={late ? RED : undefined}>{longDate(po.expected_date)}{late ? ` (atrasada ${late} ${late === 1 ? "día" : "días"})` : ""}</InfoRow>}
          {po.received_date && <InfoRow label="Recibido">{longDate(po.received_date)}{po.received_by_name ? ` por ${po.received_by_name}` : ""}</InfoRow>}
          <div className="flex items-center justify-between gap-3" style={{ padding: "6px 0", fontSize: 14 }}>
            <span style={{ color: W.sub }}>Tracking</span>
            <span className="flex items-center gap-2"><input value={tracking} onChange={(e) => { setTracking(e.target.value.toUpperCase()); setTrackSaved(false); }} onBlur={saveTrack} onKeyDown={(e) => { if (e.key === "Enter") e.currentTarget.blur(); }} placeholder="Sin tracking" aria-label="Tracking" className="bg-transparent outline-none text-right" style={{ color: "#fff", fontWeight: 600, width: 170 }} />{trackSaved && <Check className="w-4 h-4" style={{ color: GREEN }} />}</span>
          </div>
          {po.invoice_link && <InfoRow label="Recibo (link)"><a href={po.invoice_link} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1" style={{ color: BRAND }}>Abrir <ExternalLink className="w-3.5 h-3.5" /></a></InfoRow>}
          {notes && <div style={{ paddingTop: 8, marginTop: 6, borderTop: `0.5px solid ${W.sep}` }}><p style={{ fontSize: 12, color: W.sub }}>Notas</p><p style={{ fontSize: 14, whiteSpace: "pre-wrap" }}>{notes}</p></div>}
        </Box>
      </Section>

      <Section title={`Items (${items.length})`}>
        {!items.length ? <p style={{ color: W.sub, fontSize: 14 }}>Esta orden no tiene items.</p> : items.map((l) => {
          const pending = linePending(l);
          return (
            <Box key={l.id} style={{ padding: 12 }}>
              <div className="flex items-start gap-2"><span className="flex-1" style={{ fontSize: 15, fontWeight: 600 }}>{l.product_name}</span><b>{money(lineTotal(l))}</b></div>
              {l.description && <p style={{ fontSize: 12, color: W.sub }}>{l.description}</p>}
              <div className="flex items-center flex-wrap" style={{ gap: 6, marginTop: 6 }}>
                <span style={{ fontSize: 13, color: W.sub }}>{lineQty(l)} × {money(num(l.unit_cost))}</span>
                {pending > 0 && po.status !== "cancelled" ? <Pill color={WARN}>Pendiente: {pending}</Pill> : lineQty(l) > 0 && pending === 0 && lineReceived(l) > 0 ? <Pill color={GREEN}>Recibido</Pill> : null}
                {isTool(l) && <Pill color={VIP}>Herramienta</Pill>}
                {l.is_ai_imported && <Pill color={PURPLE}>AI</Pill>}
              </div>
              {po.status !== "cancelled" && (
                <button onClick={() => setWoPick({ lineId: l.id, allowClear: !!l.linked_work_order_id })} className="apple-press flex items-center gap-1" style={{ marginTop: 8, padding: "5px 11px", borderRadius: 999, background: l.linked_work_order_id ? tint(INFO, 0.16) : "#3A3A3C", color: l.linked_work_order_id ? INFO : W.sub, fontSize: 12, fontWeight: 700 }}>
                  <Wrench className="w-3 h-3" /> {l.linked_work_order_id ? `Vinculada a ${l.linked_work_order_number || ""}` : "Vincular a orden de trabajo"}
                </button>
              )}
            </Box>
          );
        })}
      </Section>

      <Section title="Totales">
        <Box>
          <InfoRow label="Subtotal">{money(num(po.subtotal))}</InfoRow>
          {num(po.tax_amount) > 0 && <InfoRow label="Impuesto">{money(num(po.tax_amount))}</InfoRow>}
          {num(po.shipping_cost) > 0 && <InfoRow label="Envío">{money(num(po.shipping_cost))}</InfoRow>}
          <div className="flex justify-between" style={{ paddingTop: 8, marginTop: 4, borderTop: `0.5px solid ${W.sep}`, fontSize: 20, fontWeight: 800 }}><span>Total</span><span style={{ color: BRAND }}>{money(num(po.total_amount))}</span></div>
        </Box>
      </Section>

      {canReceive && <button onClick={() => setDlg({ kind: "receive", po })} className="apple-press flex items-center justify-center gap-2" style={{ padding: "15px 0", borderRadius: 14, background: GREEN, color: "#fff", fontSize: 16, fontWeight: 700 }}><PackageCheck className="w-5 h-5" /> Recibir orden</button>}
      {isDraft && <button onClick={() => setDlg({ kind: "close", po })} className="apple-press flex items-center justify-center gap-2" style={{ padding: "15px 0", borderRadius: 14, background: BRAND, color: "#fff", fontSize: 16, fontWeight: 700 }}><PackageCheck className="w-5 h-5" /> Cerrar pedido</button>}

      <EditPODialog open={dlg?.kind === "edit"} po={dlg?.po} tenantId={tenantId} onClose={() => setDlg(null)} onSaved={(p) => { onUpdated(p); setToast({ text: "Orden actualizada", error: false }); }} />
      <ReceiveDialog open={dlg?.kind === "receive"} po={dlg?.po} tenantId={tenantId} tenant={tenant} employeeName={employeeName} onClose={() => setDlg(null)} onDone={(p, msg) => { onUpdated(p); setToast({ text: msg, error: false }); }} />
      <CloseDraftDialog open={dlg?.kind === "close"} po={dlg?.po} tenantId={tenantId} employeeName={employeeName} onClose={() => setDlg(null)} onDone={(p, msg, err) => { onUpdated(p); setToast({ text: msg, error: !!err }); }} />
      <OrderPicker open={!!woPick} tenantId={tenantId} allowClear={woPick?.allowClear} onClose={() => setWoPick(null)} onPick={(o) => woPick && doLink(woPick.lineId, o)} onClear={() => woPick && doLink(woPick.lineId, null)} />
      <AlertDialog open={dlg?.kind === "cancel"} title="Cancelar orden de compra" onClose={() => setDlg(null)}
        message={dlg?.po ? (dlg.po.status === "received" || dlg.po.status === "partial" ? `La orden ${dlg.po.po_number} quedará marcada como cancelada. Se revertirá del inventario lo que ya se había recibido.` : `La orden ${dlg.po.po_number} quedará marcada como cancelada. Esta acción no afecta el inventario.`) : ""}
        actions={[{ label: "No" }, { label: "Sí, cancelar", destructive: true, onPress: () => dlg?.po && doCancel(dlg.po) }]} />
      {busy && <div className="fixed inset-0 flex items-center justify-center" style={{ zIndex: 400, background: "rgba(0,0,0,0.4)" }}><Loader2 className="w-8 h-8 animate-spin" /></div>}
    </div>
  );
}

