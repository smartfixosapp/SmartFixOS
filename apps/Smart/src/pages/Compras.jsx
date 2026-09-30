import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Search, Plus, Box, Loader2, ChevronRight, Filter, Wrench, Store, PackageCheck, Inbox } from "lucide-react";
import { AlertDialog, tint } from "@/components/pos/native/posUi";
import { Banner, W, money } from "@/components/wizard/ui";
import { fetchTenant, resolveCurrentEmployee } from "@/lib/orderDetailApi";
import {
  STATUS_KEYS, statusMeta, fetchPOs, subscribePOs, dissolveStaleDrafts, matchesQuery, summaryStats, overdueDays, woBadgeText, lineItems, dateLabel, num, receiveAllPending, reorderPrefill,
} from "@/lib/comprasApi";
import PODetailPanel from "@/components/compras/PODetail";
import POWizard from "@/components/compras/POWizard";
import PartsToOrderDialog from "@/components/compras/PartsToOrder";
import { SuppliersManagerDialog } from "@/components/compras/Suppliers";

const BRAND = "#F2662E";

function useDesktop() {
  const q = "(min-width: 900px)";
  const [v, setV] = useState(() => typeof window !== "undefined" && window.matchMedia(q).matches);
  useEffect(() => {
    const m = window.matchMedia(q);
    const on = () => setV(m.matches);
    m.addEventListener("change", on);
    return () => m.removeEventListener("change", on);
  }, []);
  return v;
}

export default function Compras() {
  const [params, setParams] = useSearchParams();
  const desktop = useDesktop();
  const [tenantId] = useState(() => { try { return localStorage.getItem("smartfix_tenant_id") || ""; } catch { return ""; } });
  const [tenant, setTenant] = useState(null);
  const [employeeName, setEmployeeName] = useState("");
  const [pos, setPos] = useState(null);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState(null);
  const [filterMenu, setFilterMenu] = useState(false);
  const [selectedId, setSelectedId] = useState(null);
  const [mobileDetail, setMobileDetail] = useState(false);
  const [wizard, setWizard] = useState(null);
  const [partsOpen, setPartsOpen] = useState(false);
  const [suppliersOpen, setSuppliersOpen] = useState(() => params.get("suppliers") === "1");
  const [receiveTarget, setReceiveTarget] = useState(null);
  const [toast, setToast] = useState(null);
  const [detailToast, setDetailToast] = useState(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    if (!tenantId) { setPos([]); return; }
    try { setPos(await fetchPOs(tenantId)); setError(null); } catch (e) { setError(e?.message || String(e)); setPos((p) => p || []); }
  }, [tenantId]);

  useEffect(() => {
    if (!tenantId) return undefined;
    fetchTenant(tenantId).then(setTenant).catch(() => {});
    resolveCurrentEmployee(tenantId).then((e) => setEmployeeName(String(e?.full_name || "").trim())).catch(() => {});
    dissolveStaleDrafts(tenantId).catch(() => {}).finally(load);
    return subscribePOs(tenantId, load);
  }, [tenantId, load]);

  useEffect(() => {
    if (params.get("suppliers") === "1") {
      const next = new URLSearchParams(params);
      next.delete("suppliers");
      setParams(next, { replace: true });
    }
  }, []);

  useEffect(() => {
    const po = params.get("po");
    if (!po || pos === null) return;
    if (pos.some((p) => p.id === po)) { setSelectedId(po); setMobileDetail(true); }
    const next = new URLSearchParams(params);
    next.delete("po");
    setParams(next, { replace: true });
  }, [pos]);

  useEffect(() => { if (!toast) return undefined; const t = setTimeout(() => setToast(null), 5000); return () => clearTimeout(t); }, [toast]);

  const counts = useMemo(() => { const c = {}; STATUS_KEYS.forEach((k) => { c[k] = 0; }); (pos || []).forEach((p) => { if (c[p.status] !== undefined) c[p.status] += 1; }); return c; }, [pos]);
  const stats = useMemo(() => summaryStats(pos || []), [pos]);
  const visible = useMemo(() => (pos || []).filter((p) => (!filter || p.status === filter) && matchesQuery(p, search)), [pos, filter, search]);

  useEffect(() => {
    if (!desktop || !visible.length) return;
    if (!visible.some((p) => p.id === selectedId)) setSelectedId(visible[0].id);
  }, [desktop, visible, selectedId]);

  const selected = (pos || []).find((p) => p.id === selectedId) || null;
  const replacePO = (po) => setPos((prev) => (prev || []).map((p) => (p.id === po.id ? { ...p, ...po } : p)));

  const openWizard = (prefill = null) => setWizard({ prefill });
  const reorder = (po) => { const r = reorderPrefill(po); openWizard({ supplierId: r.supplierId, supplierName: r.supplierName, lines: r.lines, startStep: 2 }); };

  const doReceiveAll = async (po) => {
    setBusy(true);
    try {
      const res = await receiveAllPending(tenantId, po, employeeName, tenant);
      replacePO(res.po);
      setToast({ text: `${po.po_number} recibida`, error: false });
      load();
    } catch (e) {
      setToast({ text: `No se pudo recibir el PO: ${e?.message || e}`, error: true });
    } finally {
      setBusy(false);
    }
  };

  const filterLabel = filter ? statusMeta(filter).label : null;
  const hasAny = (pos || []).length > 0;
  const emptyState = () => {
    if (search.trim()) return ["Sin coincidencias", `Ninguna compra coincide con "${search.trim()}"`];
    if (filter) return [`Nada en ${filterLabel}`, "No hay órdenes de compra en este estado por ahora."];
    if (!hasAny) return ["Aún no hay compras", "Crea tu primera orden de compra y empezamos a llevar el control de tus suplidores."];
    return ["Sin compras", "Las órdenes de compra aparecerán aquí. Toca + para crear una."];
  };

  const list = (
    <div className="flex flex-col" style={{ gap: 12 }}>
      <div className="flex items-center gap-2">
        <h1 className="flex-1" style={{ fontSize: 32, fontWeight: 800, letterSpacing: "-0.02em" }}>Compras</h1>
        <button onClick={() => setSuppliersOpen(true)} aria-label="Suplidores" title="Suplidores" className="apple-press flex items-center justify-center" style={{ width: 40, height: 40, borderRadius: 999, background: "rgba(255,255,255,0.08)" }}><Store className="w-4 h-4" /></button>
        <button onClick={() => setPartsOpen(true)} aria-label="Piezas por ordenar" title="Piezas por ordenar" className="apple-press flex items-center justify-center" style={{ width: 40, height: 40, borderRadius: 999, background: "rgba(255,255,255,0.08)" }}><Box className="w-4 h-4" /></button>
        <button onClick={() => openWizard()} aria-label="Nueva orden de compra" title="Nueva orden de compra" className="apple-press flex items-center justify-center" style={{ width: 40, height: 40, borderRadius: 999, background: BRAND, color: "#fff" }}><Plus className="w-5 h-5" strokeWidth={3} /></button>
      </div>
      <label className="flex items-center gap-2" style={{ height: 42, padding: "0 14px", borderRadius: 999, background: "rgba(255,255,255,0.06)" }}>
        <Search className="w-4 h-4" style={{ color: W.sub }} />
        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar por PO, suplidor, tracking" aria-label="Buscar compras" className="flex-1 bg-transparent outline-none" style={{ color: "#fff", fontSize: 14, minWidth: 0 }} />
      </label>
      <div className="flex items-stretch" style={{ background: "#1C1C1E", borderRadius: 16, padding: "14px 6px" }}>
        {[["ACTIVAS", String(stats.active), BRAND], ["POR RECIBIR", money(stats.toReceive), "#FFA640"], ["ESTE MES", money(stats.thisMonth), "#4DC780"]].map(([l, v, c], i) => (
          <div key={l} className="flex-1 text-center" style={{ borderLeft: i ? `0.5px solid ${W.sep}` : "none" }}>
            <p style={{ fontSize: 10, fontWeight: 800, letterSpacing: "0.06em", color: W.sub }}>{l}</p>
            <p style={{ fontSize: 18, fontWeight: 800, color: c, fontVariantNumeric: "tabular-nums" }}>{v}</p>
          </div>
        ))}
      </div>
      <div className="relative">
        <button onClick={(e) => { e.stopPropagation(); setFilterMenu((v) => !v); }} className="apple-press w-full flex items-center gap-2" style={{ background: "#1C1C1E", borderRadius: 12, padding: "11px 14px", fontSize: 14, fontWeight: 600 }}>
          <Filter className="w-4 h-4" style={{ color: filter ? BRAND : W.sub }} />
          <span className="flex-1 text-left">{filter ? `Filtro: ${filterLabel}` : `Todas las compras (${(pos || []).length})`}</span>
          {filter && <span style={{ padding: "1px 8px", borderRadius: 999, background: tint(BRAND, 0.2), color: BRAND, fontSize: 12, fontWeight: 700 }}>{counts[filter]}</span>}
        </button>
        {filterMenu && (
          <div className="absolute left-0 right-0" style={{ top: 48, zIndex: 30, background: "#2C2C2E", borderRadius: 14, overflow: "hidden", boxShadow: "0 10px 30px rgba(0,0,0,0.5)" }} onClick={(e) => e.stopPropagation()}>
            <button onClick={() => { setFilter(null); setFilterMenu(false); }} className="apple-press w-full text-left" style={{ padding: "10px 14px", fontSize: 14, fontWeight: !filter ? 700 : 400 }}>Todas ({(pos || []).length})</button>
            {STATUS_KEYS.map((k) => <button key={k} onClick={() => { setFilter(k); setFilterMenu(false); }} className="apple-press w-full flex items-center gap-2 text-left" style={{ padding: "10px 14px", fontSize: 14, fontWeight: filter === k ? 700 : 400, borderTop: `0.5px solid ${W.sep}` }}><span style={{ width: 8, height: 8, borderRadius: 999, background: statusMeta(k).color }} /> {statusMeta(k).label} ({counts[k]})</button>)}
          </div>
        )}
      </div>
      {error && <Banner color="#FF7373" onDismiss={() => setError(null)}>{error}</Banner>}
      {toast && <Banner color={toast.error ? "#FF7373" : "#4DC780"} onDismiss={() => setToast(null)}>{toast.text}</Banner>}
      {pos === null ? <div className="flex justify-center" style={{ padding: 40 }}><Loader2 className="w-6 h-6 animate-spin" style={{ color: W.sub }} /></div>
        : !visible.length ? (
          <div className="flex flex-col items-center text-center" style={{ padding: "36px 16px", gap: 8 }}>
            <Inbox className="w-9 h-9" style={{ color: W.sub }} />
            <b style={{ fontSize: 17 }}>{emptyState()[0]}</b>
            <p style={{ fontSize: 14, color: W.sub, maxWidth: 320 }}>{emptyState()[1]}</p>
            {(filter || search.trim()) ? <button onClick={() => { setFilter(null); setSearch(""); }} className="apple-press" style={{ marginTop: 6, padding: "9px 18px", borderRadius: 999, background: tint(BRAND, 0.16), color: BRAND, fontWeight: 700, fontSize: 14 }}>Limpiar filtros</button>
              : !hasAny ? <button onClick={() => openWizard()} className="apple-press" style={{ marginTop: 6, padding: "9px 18px", borderRadius: 999, background: BRAND, color: "#fff", fontWeight: 700, fontSize: 14 }}>Crear primera compra</button> : null}
          </div>
        ) : (
          <div style={{ borderRadius: 16, background: "#1C1C1E", overflow: "hidden" }}>
            {visible.map((p, i) => {
              const meta = statusMeta(p.status);
              const late = overdueDays(p);
              const wo = woBadgeText(p);
              const sel = desktop && p.id === selectedId;
              const canReceive = (p.status === "ordered" || p.status === "partial") && lineItems(p).length > 0;
              return (
                <div key={p.id} className="flex items-center" style={{ borderTop: i ? `0.5px solid ${W.sep}` : "none", background: sel ? "rgba(242,102,46,0.08)" : "transparent" }}>
                  <button onClick={() => { setSelectedId(p.id); if (!desktop) setMobileDetail(true); }} className="apple-press flex-1 min-w-0 flex items-center gap-3 text-left" style={{ padding: "12px 14px" }}>
                    <span style={{ width: 10, height: 10, borderRadius: 999, background: meta.color, boxShadow: `0 0 0 3px ${tint(meta.color, 0.2)}`, flexShrink: 0 }} />
                    <span className="flex-1 min-w-0">
                      <span className="flex items-center gap-2 flex-wrap">
                        <span style={{ fontSize: 14, fontWeight: 700, color: sel ? BRAND : "#fff", fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace" }}>{p.po_number}</span>
                        {late > 0 && <span style={{ padding: "1px 7px", borderRadius: 999, background: tint("#FF7373", 0.16), color: "#FF7373", fontSize: 10, fontWeight: 700 }}>Atrasada {late}d</span>}
                        {!desktop && <span style={{ padding: "1px 7px", borderRadius: 999, background: tint(meta.color, 0.16), color: meta.color, fontSize: 10, fontWeight: 700 }}>{meta.label}</span>}
                      </span>
                      <span className="flex items-center gap-2 flex-wrap" style={{ fontSize: 12, color: W.sub }}>
                        <span className="truncate">{p.supplier_name || "—"}</span>
                        {wo && <span className="inline-flex items-center gap-1" style={{ padding: "1px 7px", borderRadius: 999, background: tint("#66B3FF", 0.16), color: "#66B3FF", fontSize: 10, fontWeight: 700 }}><Wrench className="w-2.5 h-2.5" /> {wo}</span>}
                        {!desktop && <span>{money(num(p.total_amount))} · {dateLabel(p.order_date)}</span>}
                      </span>
                    </span>
                    {desktop && <b style={{ fontSize: 14, fontVariantNumeric: "tabular-nums" }}>{money(num(p.total_amount))}</b>}
                    <ChevronRight className="w-4 h-4" style={{ color: "rgba(235,235,245,0.3)" }} />
                  </button>
                  {canReceive && <button onClick={() => setReceiveTarget(p)} aria-label={`Recibir ${p.po_number}`} title="Recibir" className="apple-press" style={{ margin: "0 12px 0 0", width: 34, height: 34, borderRadius: 999, background: tint("#4DC780", 0.16), color: "#4DC780", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}><PackageCheck className="w-4 h-4" /></button>}
                </div>
              );
            })}
          </div>
        )}
    </div>
  );

  const detail = <PODetailPanel po={selected} tenant={tenant} tenantId={tenantId} employeeName={employeeName} onUpdated={(p) => { replacePO(p); load(); }} onReorder={reorder} onBack={!desktop ? () => setMobileDetail(false) : null} toastMsg={detailToast} />;

  return (
    <div className="apple-type min-h-dvh" style={{ background: "#000", color: "#fff" }} onClick={() => setFilterMenu(false)}>
      {desktop ? (
        <div className="flex" style={{ height: "100dvh" }}>
          <div className="overflow-y-auto" style={{ width: 420, flexShrink: 0, padding: "24px 16px 40px", borderRight: `0.5px solid ${W.sep}` }}>{list}</div>
          <div className="flex-1 overflow-y-auto" style={{ maxWidth: 820 }}>{detail}</div>
        </div>
      ) : (
        <div className="app-container" style={{ padding: "24px 16px 96px" }}>{mobileDetail && selected ? detail : list}</div>
      )}
      <POWizard open={!!wizard} prefill={wizard?.prefill} tenantId={tenantId} employeeName={employeeName} onClose={(reload) => { setWizard(null); if (reload) load(); }} />
      <PartsToOrderDialog open={partsOpen} tenantId={tenantId} employeeName={employeeName} onClose={() => setPartsOpen(false)} onChanged={load} />
      <SuppliersManagerDialog open={suppliersOpen} tenantId={tenantId} onClose={() => setSuppliersOpen(false)} />
      <AlertDialog open={!!receiveTarget} title={receiveTarget ? `¿Recibir ${receiveTarget.po_number} completa?` : ""} message={receiveTarget ? `Se añade el stock y se registra el gasto de ${money(num(receiveTarget.total_amount))}.` : ""} onClose={() => setReceiveTarget(null)}
        actions={[
          { label: "Recibir todo", bold: true, onPress: () => receiveTarget && doReceiveAll(receiveTarget) },
          { label: "Revisar por item", onPress: () => { if (receiveTarget) { setSelectedId(receiveTarget.id); if (!desktop) setMobileDetail(true); setDetailToast({ text: "Abre el menú (⋯) y elige Recibir orden para revisar cada item.", error: false }); } } },
          { label: "Cancelar" },
        ]} />
      {busy && <div className="fixed inset-0 flex items-center justify-center" style={{ zIndex: 400, background: "rgba(0,0,0,0.4)" }}><Loader2 className="w-8 h-8 animate-spin" /></div>}
    </div>
  );
}
