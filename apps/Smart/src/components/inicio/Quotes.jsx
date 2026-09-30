import { useEffect, useMemo, useState } from "react";
import { Search, X, Plus, Trash2, MessageSquare, ClockAlert, Loader2, FileText } from "lucide-react";
import { Dialog, TextAction, AlertDialog, tint } from "@/components/pos/native/posUi";
import { FP } from "@/lib/finance/ledger";
import { money } from "@/components/finanzas/ui";
import { fold } from "@/lib/posLogic";
import { listQuotes, quoteStatus, quoteExpired, quoteSummary, quoteValidUntil, updateQuoteStatus, deleteQuote, num } from "@/lib/inicioApi";

const STATUS = {
  pending: ["PENDIENTE", FP.warning, "Pendiente"],
  accepted: ["ACEPTADA", FP.success, "Aceptada"],
  lost: ["PERDIDA", "#8E8E93", "Perdida"],
};

function relative(dateStr) {
  const d = dateStr ? new Date(dateStr) : null;
  if (!d || Number.isNaN(d.getTime())) return "";
  const diff = (d.getTime() - Date.now()) / 1000;
  const rtf = new Intl.RelativeTimeFormat("es", { numeric: "auto" });
  const abs = Math.abs(diff);
  if (abs < 60) return rtf.format(Math.round(diff), "second");
  if (abs < 3600) return rtf.format(Math.round(diff / 60), "minute");
  if (abs < 86400) return rtf.format(Math.round(diff / 3600), "hour");
  if (abs < 86400 * 30) return rtf.format(Math.round(diff / 86400), "day");
  return rtf.format(Math.round(diff / (86400 * 30)), "month");
}

function StatusTag({ q }) {
  if (quoteExpired(q)) return <span style={{ padding: "2px 7px", borderRadius: 999, background: tint(FP.danger, 0.15), color: FP.danger, fontSize: 10, fontWeight: 800 }}>VENCIDA</span>;
  const [label, color] = STATUS[quoteStatus(q)];
  return <span style={{ padding: "2px 7px", borderRadius: 999, background: tint(color, 0.15), color, fontSize: 10, fontWeight: 800 }}>{label}</span>;
}

export function QuoteDetailDialog({ quote, onClose, shopName, onChanged, onDeleted, onConvert }) {
  const [q, setQ] = useState(quote);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [confirm, setConfirm] = useState(false);
  useEffect(() => { setQ(quote); setError(null); }, [quote]);
  if (!quote || !q) return null;
  const until = quoteValidUntil(q);
  const setStatus = async (s) => {
    if (quoteStatus(q) === s || busy) return;
    setBusy(true);
    setError(null);
    try {
      await updateQuoteStatus(q.id, s);
      const next = { ...q, status: s };
      setQ(next);
      onChanged?.(next);
    } catch (e) {
      setError(`No se pudo cambiar el estado: ${e?.message || e}`);
    }
    setBusy(false);
  };
  const resend = () => {
    const lines = [quoteSummary(q), `Total: ${money(q.total)}`];
    if (until) lines.push(`Válido hasta ${new Intl.DateTimeFormat("es-PR", { dateStyle: "medium" }).format(until)}`);
    lines.push(shopName);
    const text = encodeURIComponent(lines.join("\n"));
    const digits = String(q.customer_phone || "").replace(/\D/g, "");
    window.open(digits ? `https://wa.me/1${digits}?text=${text}` : `https://wa.me/?text=${text}`, "_blank", "noopener");
  };
  const row = (l, v, detail, color, strong) => (
    <div className="flex items-center justify-between" style={{ padding: "11px 14px" }}>
      <span className="min-w-0">
        <span className="block" style={{ fontSize: 15, fontWeight: strong ? 700 : 400 }}>{l}</span>
        {detail && <span className="block truncate" style={{ fontSize: 12, color: "#8E8E93" }}>{detail}</span>}
      </span>
      <span style={{ fontSize: strong ? 17 : 15, fontWeight: strong ? 800 : 500, color: color || "#fff", fontVariantNumeric: "tabular-nums" }}>{money(v)}</span>
    </div>
  );
  return (
    <>
      <Dialog open onClose={onClose} title="Cotización" width={480}
        leading={<TextAction onClick={onClose}>Cerrar</TextAction>}
        trailing={<button onClick={() => setConfirm(true)} aria-label="Borrar cotización" style={{ color: "#FF453A" }}><Trash2 className="w-5 h-5" /></button>}>
        <div className="flex flex-col" style={{ gap: 14, paddingTop: 8 }}>
          <div className="flex flex-col" style={{ gap: 4, padding: 16, borderRadius: 16, background: "#2C2C2E" }}>
            <span style={{ fontSize: 20, fontWeight: 700 }}>{q.customer_name || "Sin nombre"}</span>
            <span style={{ fontSize: 13, color: "#8E8E93" }}>{[q.customer_phone, q.device_label].filter(Boolean).join(" · ")}</span>
            <span style={{ fontSize: 13, color: "#8E8E93", marginTop: 8 }}>Precio cotizado</span>
            <span style={{ fontSize: 30, fontWeight: 800, color: FP.success, fontVariantNumeric: "tabular-nums" }}>{money(q.total)}</span>
          </div>
          {quoteExpired(q) && (
            <div className="flex items-start gap-2" style={{ padding: 12, borderRadius: 12, background: tint(FP.danger, 0.1), color: FP.danger, fontSize: 13 }}>
              <ClockAlert className="w-4 h-4 flex-shrink-0" /> Esta cotización venció — el precio de la pieza pudo cambiar. Verifica antes de dárselo al cliente.
            </div>
          )}
          <div style={{ borderRadius: 12, background: "#2C2C2E" }}>
            {row("Pieza", num(q.part_price), q.part_label)}
            <div style={{ height: 0.5, background: "rgba(84,84,88,0.6)", marginLeft: 14 }} />
            {row("Mano de obra", num(q.labor))}
            {num(q.tax_amount) > 0 && (<><div style={{ height: 0.5, background: "rgba(84,84,88,0.6)", marginLeft: 14 }} />{row("IVU", num(q.tax_amount))}</>)}
            <div style={{ height: 0.5, background: "rgba(84,84,88,0.6)", marginLeft: 14 }} />
            {row("Total", num(q.total), null, FP.success, true)}
          </div>
          <div>
            <p style={{ fontSize: 12, fontWeight: 600, color: "#8E8E93", padding: "0 4px 6px" }}>ESTADO</p>
            <div className="flex" style={{ gap: 8 }}>
              {Object.entries(STATUS).map(([k, [, color, label]]) => {
                const active = quoteStatus(q) === k;
                return <button key={k} disabled={busy} onClick={() => setStatus(k)} className="apple-press flex-1" style={{ padding: "9px 0", borderRadius: 999, fontSize: 14, fontWeight: 600, background: active ? color : "#3A3A3C", color: "#fff" }}>{label}</button>;
              })}
            </div>
            {until && <p style={{ fontSize: 12, color: "#8E8E93", padding: "8px 4px 0" }}>Válida hasta el {new Intl.DateTimeFormat("es-PR", { dateStyle: "long" }).format(until)}</p>}
          </div>
          {error && <p style={{ fontSize: 13, color: "#FF453A" }}>{error}</p>}
          <div className="flex" style={{ gap: 10 }}>
            <button disabled={busy} onClick={resend} className="apple-press flex-1 flex items-center justify-center gap-2" style={{ height: 50, borderRadius: 14, background: "#3A3A3C", color: "#fff", fontSize: 15, fontWeight: 600 }}><MessageSquare className="w-4 h-4" /> Reenviar</button>
            <button disabled={busy} onClick={async () => { if (quoteStatus(q) !== "accepted") { try { await updateQuoteStatus(q.id, "accepted"); onChanged?.({ ...q, status: "accepted" }); } catch (e) { setError(`No se pudo cambiar el estado: ${e?.message || e}`); return; } } onConvert?.({ ...q, status: "accepted" }); }}
              className="apple-press flex-1" style={{ height: 50, borderRadius: 14, background: FP.brand, color: "#fff", fontSize: 15, fontWeight: 700 }}>Convertir en orden</button>
          </div>
        </div>
      </Dialog>
      <AlertDialog open={confirm} title="¿Borrar esta cotización?" onClose={() => setConfirm(false)}
        actions={[
          { label: "Borrar", destructive: true, onPress: async () => { try { await deleteQuote(q.id); onDeleted?.(q); onClose(); } catch (e) { setError(`No se pudo borrar: ${e?.message || e}`); } } },
          { label: "Cancelar", bold: true },
        ]} />
    </>
  );
}

export function QuotesListDialog({ open, onClose, tenantId, shopName, onNewQuote, onConvert, refreshKey }) {
  const [rows, setRows] = useState(null);
  const [error, setError] = useState(null);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("pending");
  const [detail, setDetail] = useState(null);
  useEffect(() => {
    if (!open) return;
    setRows(null);
    setError(null);
    listQuotes(tenantId).then(setRows, (e) => { setError(e?.message || String(e)); setRows([]); });
  }, [open, tenantId, refreshKey]);
  const pendingCount = (rows || []).filter((q) => quoteStatus(q) === "pending").length;
  const visible = useMemo(() => {
    const f = fold(query.trim());
    return (rows || []).filter((q) => (filter === "all" || quoteStatus(q) === filter) && (!f || fold([q.customer_name, q.customer_phone, q.device_label, q.part_label].join(" ")).includes(f)));
  }, [rows, query, filter]);
  const chip = (k, label) => (
    <button key={k} onClick={() => setFilter(k)} className="apple-press whitespace-nowrap flex items-center gap-1.5" style={{ padding: "6px 12px", borderRadius: 999, fontSize: 13, fontWeight: 600, background: filter === k ? FP.brand : "#3A3A3C", color: "#fff" }}>
      {label}{k === "pending" && pendingCount > 0 && <span style={{ padding: "0 6px", borderRadius: 999, background: "rgba(255,255,255,0.25)", fontSize: 11 }}>{pendingCount}</span>}
    </button>
  );
  const empty = (Icon, title, sub) => (
    <div className="flex flex-col items-center text-center" style={{ padding: "48px 16px", gap: 8 }}>
      <Icon className="w-9 h-9" style={{ color: "rgba(235,235,245,0.3)" }} />
      <p style={{ fontSize: 15, fontWeight: 600, color: "#8E8E93" }}>{title}</p>
      <p style={{ fontSize: 13, color: "rgba(235,235,245,0.3)" }}>{sub}</p>
    </div>
  );
  return (
    <>
      <Dialog open={open} onClose={onClose} title="Cotizaciones" width={560} height="90dvh"
        leading={<TextAction onClick={onClose}>Cerrar</TextAction>}
        trailing={<button onClick={onNewQuote} aria-label="Nueva cotización" style={{ color: FP.brand }}><Plus className="w-6 h-6" /></button>}>
        <div className="flex flex-col" style={{ gap: 10, paddingTop: 6 }}>
          <label className="flex items-center gap-2" style={{ height: 42, padding: "0 12px", borderRadius: 12, background: "#1C1C1E" }}>
            <Search className="w-4 h-4" style={{ color: "#8E8E93" }} />
            <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Buscar por nombre, teléfono o equipo…" className="flex-1 bg-transparent outline-none" style={{ color: "#fff", fontSize: 15 }} />
            {query && <button onClick={() => setQuery("")} aria-label="Limpiar" style={{ color: "#8E8E93" }}><X className="w-4 h-4" /></button>}
          </label>
          <div className="flex overflow-x-auto" style={{ gap: 6 }}>{chip("pending", "Pendientes")}{chip("accepted", "Aceptadas")}{chip("lost", "Perdidas")}{chip("all", "Todas")}</div>
          <div style={{ height: 0.5, background: "rgba(84,84,88,0.6)" }} />
          {rows === null ? <p className="flex items-center justify-center gap-2" style={{ padding: 40, color: "#8E8E93" }}><Loader2 className="w-4 h-4 animate-spin" /> Cargando cotizaciones…</p>
            : error ? empty(FileText, "No se pudieron cargar", error)
              : rows.length === 0 ? empty(FileText, "Sin cotizaciones", "Cotiza una pieza desde la barra de búsqueda del inicio y aparecerá aquí.")
                : visible.length === 0 ? empty(Search, "Sin resultados", query.trim() ? `Nada coincide con “${query.trim()}”.` : "No hay cotizaciones con este filtro.")
                  : (
                    <div className="flex flex-col" style={{ gap: 9 }}>
                      {visible.map((q) => (
                        <button key={q.id} onClick={() => setDetail(q)} className="apple-press w-full text-left flex flex-col" style={{ gap: 4, padding: 14, borderRadius: 16, background: "#1C1C1E" }}>
                          <span className="flex items-baseline gap-2">
                            <span className="flex-1 truncate" style={{ fontSize: 15, fontWeight: 700 }}>{q.customer_name || "Sin nombre"}</span>
                            <span style={{ fontSize: 15, fontWeight: 800, color: FP.success, fontVariantNumeric: "tabular-nums" }}>{money(q.total)}</span>
                          </span>
                          <span className="truncate" style={{ fontSize: 13, color: "#8E8E93" }}>{quoteSummary(q)}</span>
                          <span className="flex items-center gap-2"><StatusTag q={q} /><span style={{ fontSize: 12, color: "#8E8E93" }}>{[relative(q.created_at), q.customer_phone].filter(Boolean).join(" · ")}</span></span>
                        </button>
                      ))}
                    </div>
                  )}
        </div>
      </Dialog>
      <QuoteDetailDialog quote={detail} onClose={() => setDetail(null)} shopName={shopName}
        onChanged={(nq) => setRows((rs) => (rs || []).map((x) => (x.id === nq.id ? nq : x)))}
        onDeleted={(dq) => setRows((rs) => (rs || []).filter((x) => x.id !== dq.id))}
        onConvert={(cq) => { setDetail(null); onClose(); setTimeout(() => onConvert?.(cq), 450); }} />
    </>
  );
}
