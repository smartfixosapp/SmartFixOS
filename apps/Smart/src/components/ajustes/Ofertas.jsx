import { useCallback, useEffect, useMemo, useState } from "react";
import { Tag, Percent, Gift, MinusCircle, Plus, Power, Trash2, Loader2 } from "lucide-react";
import { AlertDialog, tint } from "@/components/pos/native/posUi";
import { money } from "@/components/finanzas/ui";
import { OfferEditor } from "@/components/inicio/Offers";
import { A, SubPage, Group, ErrorLine } from "./ui";
import { listOffers, listActiveProducts, offerType, offerLive, offerDaysLeft, offerExpiringSoon, offerLabel, setOfferActive, deleteOffer, num } from "@/lib/inicioApi";
import { offerIsDevice, offerDeviceLabel } from "@/lib/wizard/offers";

const TYPE_ICON = { fixed: Tag, percent: Percent, combo: Gift, amount: MinusCircle };

function valueText(o) {
  const t = offerType(o);
  if (t === "fixed") return `Precio ${money(num(o.value))}`;
  if (t === "percent") return `${num(o.value)}% off`;
  if (t === "amount") return `-${money(num(o.value))}`;
  return "Combo / regalo";
}

function scopeText(o, byId) {
  if (offerIsDevice(o)) return [`Equipo: ${offerDeviceLabel(o)}`, String(o.part_filter || "").trim()].filter(Boolean).join(" · ");
  if (o.product_id) return byId.get(o.product_id)?.name || "Producto";
  if (o.category) return `Categoría: ${o.category}`;
  return "General";
}

export function OfertasAjustes({ tenantId, back }) {
  const [rows, setRows] = useState(null);
  const [products, setProducts] = useState([]);
  const [tab, setTab] = useState("live");
  const [editor, setEditor] = useState(null);
  const [confirm, setConfirm] = useState(null);
  const [error, setError] = useState(null);
  const [busyId, setBusyId] = useState(null);
  const byId = useMemo(() => new Map(products.map((p) => [p.id, p])), [products]);
  const load = useCallback(() => listOffers(tenantId).then(setRows, (e) => { setError(e?.message || String(e)); setRows([]); }), [tenantId]);
  useEffect(() => { load(); listActiveProducts(tenantId).then(setProducts).catch(() => {}); }, [load, tenantId]);
  const live = (rows || []).filter(offerLive);
  const dead = (rows || []).filter((o) => !offerLive(o));
  const list = tab === "live" ? live : dead;
  const toggle = async (o) => {
    setBusyId(o.id);
    try { await setOfferActive(o.id, o.active === false); await load(); } catch (e) { setError(e?.message || String(e)); }
    setBusyId(null);
  };
  const chip = (o) => {
    if (o.active === false) return ["Apagada", A.sub];
    if (!offerLive(o)) return ["Vencida", A.danger];
    const d = offerDaysLeft(o);
    if (d === null) return ["Permanente", A.success];
    if (offerExpiringSoon(o)) return [d === 0 ? "Vence hoy" : `Vence en ${d} día${d === 1 ? "" : "s"}`, A.warning];
    return [`Vence en ${d} días`, A.success];
  };
  return (
    <SubPage title="Ofertas" onBack={back} right={<button onClick={() => setEditor({ offer: null })} className="apple-press flex items-center gap-1" style={{ padding: "7px 14px", borderRadius: 999, background: A.brand, color: "#fff", fontSize: 14, fontWeight: 700 }}><Plus className="w-4 h-4" /> Nueva</button>}>
      <div className="grid grid-cols-2" style={{ padding: 2, gap: 2, borderRadius: 9, background: "rgba(118,118,128,0.24)" }}>
        {[["live", `Activas ${live.length}`], ["dead", `Vencidas ${dead.length}`]].map(([k, l]) => <button key={k} onClick={() => setTab(k)} style={{ padding: "7px 0", borderRadius: 7, fontSize: 14, fontWeight: 600, background: tab === k ? "#636366" : "transparent" }}>{l}</button>)}
      </div>
      <ErrorLine message={error} />
      {rows === null ? <div className="flex justify-center" style={{ padding: 40 }}><Loader2 className="w-5 h-5 animate-spin" style={{ color: A.sub }} /></div> : (
        <Group pad={false} footer={tab === "live" ? "Las ofertas vencidas se apagan solas. No hay que borrarlas." : "Reactiva una oferta vencida cambiando su fecha o dejándola permanente."}>
          {list.length === 0 ? <p style={{ padding: 16, color: A.sub, fontSize: 14 }}>{tab === "live" ? "No hay ofertas activas. Crea una con el botón Nueva." : "No hay ofertas vencidas."}</p> : list.map((o, i) => {
            const Icon = TYPE_ICON[offerType(o)];
            const [chipText, chipColor] = chip(o);
            return (
              <div key={o.id} className="flex items-center gap-3" style={{ padding: "12px 16px", borderTop: i ? `0.5px solid ${A.sep}` : "none" }}>
                <span style={{ width: 32, height: 32, borderRadius: 8, background: tint(A.brand, 0.14), color: A.brand, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}><Icon className="w-4 h-4" /></span>
                <button onClick={() => setEditor({ offer: o })} className="flex-1 min-w-0 text-left">
                  <span className="block truncate" style={{ fontSize: 15, fontWeight: 600 }}>{offerLabel(o)}</span>
                  <span className="block truncate" style={{ fontSize: 12, color: A.sub }}>{scopeText(o, byId)} · {valueText(o)}</span>
                </button>
                <span style={{ padding: "2px 9px", borderRadius: 999, fontSize: 11, fontWeight: 700, background: tint(chipColor, 0.16), color: chipColor, whiteSpace: "nowrap" }}>{chipText}</span>
                <button onClick={() => toggle(o)} disabled={busyId === o.id} aria-label={o.active === false ? "Prender" : "Apagar"} title={o.active === false ? "Prender" : "Apagar"} style={{ color: o.active === false ? A.success : A.warning }}><Power className="w-4 h-4" /></button>
                <button onClick={() => setConfirm(o)} aria-label="Borrar" title="Borrar" style={{ color: A.danger }}><Trash2 className="w-4 h-4" /></button>
              </div>
            );
          })}
        </Group>
      )}
      <OfferEditor open={!!editor} offer={editor?.offer || null} products={products} tenantId={tenantId} onClose={() => setEditor(null)} onSaved={load} />
      <AlertDialog open={!!confirm} title={`¿Borrar la oferta ${confirm ? offerLabel(confirm) : ""}?`} message="Esta acción no se puede deshacer. Los productos vuelven a su precio normal." onClose={() => setConfirm(null)}
        actions={[{ label: "Borrar oferta", destructive: true, onPress: async () => { try { await deleteOffer(confirm.id); await load(); } catch (e) { setError(e?.message || String(e)); } } }, { label: "Cancelar", bold: true }]} />
    </SubPage>
  );
}
