import { useEffect, useMemo, useState } from "react";
import { Loader2, ShoppingCart, PackageCheck, Check, ExternalLink, Box, Globe, ShoppingBag } from "lucide-react";
import { Dialog, TextAction, AlertDialog, tint } from "@/components/pos/native/posUi";
import { Banner, W, money } from "@/components/wizard/ui";
import { PART_STATUS, STORES, storeOf, partTitle, safeUrl, fetchPartLinks, setPartLinkStatus, reorderPartLink, orderPartNow, num } from "@/lib/comprasApi";

const BRAND = "#F2662E";
const SEGMENTS = [["to_order", "Por ordenar"], ["ordered", "Ordenada"], ["received", "Recibida"]];
const STORE_ICON = { amazon: () => <b style={{ fontSize: 18 }}>a</b>, ebay: () => <b style={{ fontSize: 18 }}>e</b>, aliexpress: () => <ShoppingBag className="w-5 h-5" />, other: () => <Globe className="w-5 h-5" /> };
const STATUS_ICON = { to_order: ShoppingCart, ordered: Box, received: Check };

export default function PartsToOrderDialog({ open, tenantId, employeeName, onClose, onChanged }) {
  const [rows, setRows] = useState(null);
  const [seg, setSeg] = useState("to_order");
  const [error, setError] = useState(null);
  const [confirm, setConfirm] = useState(null);
  const [busyId, setBusyId] = useState(null);

  const load = () => fetchPartLinks(tenantId).then(setRows, (e) => { setError(e?.message || String(e)); setRows((p) => p || []); });
  useEffect(() => { if (open) { setRows(null); setSeg("to_order"); setError(null); load(); } }, [open, tenantId]);

  const counts = useMemo(() => { const c = { to_order: 0, ordered: 0, received: 0 }; (rows || []).forEach((l) => { if (c[l.status] !== undefined) c[l.status] += 1; }); return c; }, [rows]);
  const list = (rows || []).filter((l) => l.status === seg);

  const cycle = async (l) => {
    try { await setPartLinkStatus(l.id, PART_STATUS[l.status].next); await load(); onChanged?.(); } catch (e) { setError(e?.message || String(e)); }
  };
  const order = async (l) => {
    setBusyId(l.id);
    try {
      const res = await orderPartNow({ tenantId, link: l, by: employeeName });
      if (res.linkUpdateFailed) setError(`Orden ${res.po.po_number} creada, pero la pieza no se marcó como Ordenada. No vuelvas a ordenar.`);
      else if (res.expenseFailed) setError("La orden se creó, pero el gasto no se registró en Finanzas. Agrégalo manualmente en Gastos.");
      await load();
      onChanged?.();
    } catch (e) { setError(e?.message || String(e)); } finally { setBusyId(null); }
  };
  const again = async (l) => {
    setBusyId(l.id);
    try { await reorderPartLink(tenantId, l); setSeg("to_order"); await load(); } catch (e) { setError(e?.message || String(e)); } finally { setBusyId(null); }
  };

  return (
    <>
      <Dialog open={open} onClose={onClose} title="Piezas por ordenar" width={600} height="88dvh" leading={<span />} trailing={<TextAction bold onClick={onClose}>Cerrar</TextAction>}>
        <div className="flex flex-col" style={{ gap: 12, paddingTop: 6 }}>
          <div className="grid grid-cols-3" style={{ padding: 2, gap: 2, borderRadius: 9, background: "rgba(118,118,128,0.24)" }}>
            {SEGMENTS.map(([k, l]) => <button key={k} onClick={() => setSeg(k)} style={{ padding: "8px 0", borderRadius: 7, fontSize: 13, fontWeight: 600, background: seg === k ? "#636366" : "transparent" }}>{l} ({counts[k]})</button>)}
          </div>
          {error && <Banner color="#FF7373" onDismiss={() => setError(null)}><b>No se pudo completar</b> {error}</Banner>}
          {rows === null ? <div className="flex justify-center" style={{ padding: 40 }}><Loader2 className="w-6 h-6 animate-spin" style={{ color: W.sub }} /></div>
            : !list.length ? <div className="flex flex-col items-center" style={{ padding: "40px 0", gap: 8, color: W.sub }}><Box className="w-8 h-8" /><span>Nada en {SEGMENTS.find((s) => s[0] === seg)[1].toLowerCase()}</span></div>
              : list.map((l) => {
                const store = STORES[storeOf(l.url, l.store)];
                const St = STORE_ICON[storeOf(l.url, l.store)];
                const SIcon = STATUS_ICON[l.status];
                const sc = PART_STATUS[l.status].color;
                return (
                  <div key={l.id} className="flex flex-col" style={{ gap: 10, padding: 12, borderRadius: 12, background: "#1C1C1E" }}>
                    <div className="flex items-center gap-3">
                      <span style={{ width: 40, height: 40, borderRadius: 10, background: store.color, color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}><St /></span>
                      <span className="flex-1 min-w-0">
                        <span className="block" style={{ fontSize: 15, fontWeight: 600, overflow: "hidden", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" }}>{partTitle(l)}</span>
                        <span className="flex items-center flex-wrap" style={{ gap: 6, fontSize: 12, color: W.sub }}>{store.label}{l.price !== null && l.price !== undefined && ` · ${money(num(l.price))}`}{l.order_number && <span style={{ padding: "1px 8px", borderRadius: 999, background: tint(BRAND, 0.16), color: BRAND, fontWeight: 700 }}>{l.order_number}</span>}</span>
                      </span>
                      <button onClick={() => setConfirm(l)} aria-label={`Cambiar estado: ${PART_STATUS[l.status].label}`} style={{ width: 38, height: 38, borderRadius: 999, background: tint(sc, 0.16), color: sc, display: "flex", alignItems: "center", justifyContent: "center" }}><SIcon className="w-5 h-5" /></button>
                    </div>
                    <div className="flex" style={{ gap: 8 }}>
                      <a href={safeUrl(l.url)} target="_blank" rel="noopener noreferrer" className="apple-press flex items-center gap-1" style={{ padding: "7px 14px", borderRadius: 999, background: "#3A3A3C", fontSize: 13, fontWeight: 600 }}><ExternalLink className="w-3.5 h-3.5" /> Abrir</a>
                      {l.status === "to_order" && <button onClick={() => order(l)} disabled={busyId === l.id} className="apple-press flex items-center gap-1 disabled:opacity-50" style={{ padding: "7px 14px", borderRadius: 999, background: BRAND, color: "#fff", fontSize: 13, fontWeight: 700 }}>{busyId === l.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ShoppingCart className="w-3.5 h-3.5" />} Ordenar</button>}
                      {l.status === "received" && <button onClick={() => again(l)} disabled={busyId === l.id} className="apple-press flex items-center gap-1 disabled:opacity-50" style={{ padding: "7px 14px", borderRadius: 999, background: BRAND, color: "#fff", fontSize: 13, fontWeight: 700 }}><PackageCheck className="w-3.5 h-3.5" /> Pedir de nuevo</button>}
                    </div>
                  </div>
                );
              })}
        </div>
      </Dialog>
      <AlertDialog open={!!confirm} title={confirm ? `¿Cambiar a "${PART_STATUS[PART_STATUS[confirm.status].next].label}"?` : ""} message={confirm ? partTitle(confirm) : ""} onClose={() => setConfirm(null)}
        actions={[{ label: "Cancelar" }, { label: "Cambiar", bold: true, onPress: () => confirm && cycle(confirm) }]} />
    </>
  );
}
