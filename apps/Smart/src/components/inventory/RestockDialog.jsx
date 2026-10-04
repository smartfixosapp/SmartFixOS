import { useEffect, useMemo, useState } from "react";
import { Dialog, TextAction } from "@/components/pos/native/posUi";
import POWizard from "@/components/compras/POWizard";

const num = (v) => { const n = Number(v); return Number.isFinite(n) ? n : 0; };
const isService = (p) => p.type === "service" || p.part_type === "servicio" || p.part_type === "diagnostic";
const suggested = (p) => Math.max(1, Math.ceil(num(p.min_stock) * 2 - num(p.stock)));

export default function RestockDialog({ open, onClose, products, tenantId, employeeName }) {
  const rows = useMemo(() => (products || []).filter((p) => !isService(p) && (num(p.stock) <= 0 || (num(p.min_stock) > 0 && num(p.stock) <= num(p.min_stock)))).sort((a, b) => num(a.stock) - num(b.stock)), [products]);
  const [picked, setPicked] = useState({});
  const [qty, setQty] = useState({});
  const [wizard, setWizard] = useState(null);

  useEffect(() => {
    if (!open) return;
    const p = {};
    const q = {};
    rows.forEach((r) => { p[r.id] = num(r.stock) <= 0; q[r.id] = suggested(r); });
    setPicked(p);
    setQty(q);
    setWizard(null);
  }, [open, rows]);

  const chosen = rows.filter((r) => picked[r.id]);
  const start = () => setWizard({ catalogItems: chosen.map((r) => ({ product: r, quantity: Math.max(1, num(qty[r.id])) })), startStep: 2 });

  return (
    <>
      <Dialog open={open && !wizard} onClose={onClose} title="Reabastecer" width={620} height="86dvh" leading={<TextAction onClick={onClose}>Cancelar</TextAction>} trailing={<TextAction bold disabled={!chosen.length} onClick={start}>{`Crear compra (${chosen.length})`}</TextAction>}>
        {rows.length === 0 ? (
          <p className="text-center" style={{ padding: 40, color: "#8E8E93" }}>Nada que reabastecer. Todo tiene stock sobre el mínimo.</p>
        ) : (
          <div className="flex flex-col" style={{ gap: 8, paddingTop: 8 }}>
            {rows.map((r) => (
              <div key={r.id} className="flex items-center gap-3" style={{ padding: "10px 12px", borderRadius: 12, background: "#2C2C2E" }}>
                <input type="checkbox" checked={!!picked[r.id]} onChange={(e) => setPicked((p) => ({ ...p, [r.id]: e.target.checked }))} aria-label={`Incluir ${r.name}`} style={{ width: 20, height: 20, accentColor: "#F2662E" }} />
                <span className="flex-1 min-w-0">
                  <span className="block truncate" style={{ fontSize: 15, fontWeight: 600 }}>{r.name}</span>
                  <span className="block" style={{ fontSize: 12, color: num(r.stock) <= 0 ? "#FF7373" : "#FFA640" }}>{num(r.stock) <= 0 ? "Agotado" : `Stock ${num(r.stock)} · mínimo ${num(r.min_stock)}`}</span>
                </span>
                <input value={qty[r.id] ?? ""} onChange={(e) => setQty((q) => ({ ...q, [r.id]: e.target.value.replace(/\D/g, "") }))} inputMode="numeric" aria-label={`Cantidad de ${r.name}`} style={{ width: 64, textAlign: "center", padding: "8px 6px", borderRadius: 10, background: "#1C1C1E", color: "#fff", border: "none", outline: "none", fontSize: 16 }} />
              </div>
            ))}
          </div>
        )}
      </Dialog>
      <POWizard open={!!wizard} prefill={wizard} tenantId={tenantId} employeeName={employeeName} onClose={() => { setWizard(null); onClose(); }} />
    </>
  );
}
