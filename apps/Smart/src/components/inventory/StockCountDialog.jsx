import { useEffect, useMemo, useState } from "react";
import { Loader2, ScanLine, ChevronLeft, ChevronRight, Archive } from "lucide-react";
import { Dialog, TextAction, tint } from "@/components/pos/native/posUi";
import { supabase } from "../../../../../lib/supabase-client.js";
import { usd } from "@/lib/posLogic";

const CARD = "#2C2C2E";
const SUB = "#8E8E93";
const num = (v) => { const n = Number(v); return Number.isFinite(n) ? n : 0; };
const drawerOf = (p) => String(p.location || "").trim();

function useWide() {
  const [wide, setWide] = useState(() => typeof window !== "undefined" && window.matchMedia("(min-width: 760px)").matches);
  useEffect(() => {
    const m = window.matchMedia("(min-width: 760px)");
    const on = () => setWide(m.matches);
    m.addEventListener("change", on);
    return () => m.removeEventListener("change", on);
  }, []);
  return wide;
}

export default function StockCountDialog({ open, items, employeeName, onClose, onApplied }) {
  const wide = useWide();
  const [counts, setCounts] = useState({});
  const [drawer, setDrawer] = useState(null);
  const [search, setSearch] = useState("");
  const [scan, setScan] = useState("");
  const [toast, setToast] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!open) return;
    setCounts({}); setDrawer(null); setSearch(""); setScan(""); setToast(null); setBusy(false); setError(null);
  }, [open]);

  const countable = useMemo(
    () => (items || []).filter((p) => p.active !== false && p.type !== "service" && p.tipo_principal !== "servicios" && !String(p.device_imei || p.imei || "").trim() && p.id && !String(p.id).startsWith("local-")),
    [items],
  );

  const groups = useMemo(() => {
    const map = new Map();
    countable.forEach((p) => { const k = drawerOf(p); if (!map.has(k)) map.set(k, []); map.get(k).push(p); });
    const named = [...map.keys()].filter(Boolean).sort((a, b) => a.localeCompare(b, "es", { numeric: true, sensitivity: "base" }));
    const out = named.map((k) => ({ id: k, label: k, items: map.get(k) }));
    if (map.get("")?.length) out.push({ id: "", label: "Sin gaveta", items: map.get("") });
    return out;
  }, [countable]);

  const counted = (p) => (counts[p.id] === undefined || counts[p.id] === "" ? null : Number(counts[p.id]));
  const changed = (p) => { const c = counted(p); return c !== null && Number.isFinite(c) && c !== Math.round(num(p.stock)); };
  const changedAll = countable.filter(changed);
  const missingFor = (g) => g.items.reduce((acc, p) => { const c = counted(p); return c === null ? acc : acc + (c - num(p.stock)) * num(p.cost); }, 0);
  const changedIn = (g) => g.items.filter(changed).length;

  const group = drawer === null ? null : groups.find((g) => g.id === drawer) || null;
  const term = search.trim().toLowerCase();
  const shownGroups = term && !group ? groups.filter((g) => g.label.toLowerCase().includes(term)) : groups;
  const shownItems = group ? (term ? group.items.filter((p) => String(p.name || "").toLowerCase().includes(term)) : group.items) : [];

  const flash = (text) => { setToast(text); setTimeout(() => setToast(null), 2200); };

  const handleScan = () => {
    const code = scan.trim();
    if (!code) return;
    setScan("");
    const hit = countable.find((p) => String(p.barcode || "") === code || String(p.sku || "") === code);
    if (!hit) { flash(`No hay producto con el código ${code}`); return; }
    const next = (counted(hit) ?? 0) + 1;
    setCounts((c) => ({ ...c, [hit.id]: String(next) }));
    setDrawer(drawerOf(hit));
    flash(`${hit.name} → ${next}`);
  };

  const apply = async () => {
    if (!changedAll.length || busy) return;
    setBusy(true);
    setError(null);
    const by = employeeName || "Usuario";
    let failed = 0;
    for (const p of changedAll) {
      const target = Math.max(0, Math.round(counted(p)));
      const before = Math.round(num(p.stock));
      const { error: e } = await supabase.from("product").update({ stock: target }).eq("id", p.id);
      if (e) { failed += 1; continue; }
      supabase.from("transaction").insert({
        tenant_id: p.tenant_id, type: "stock_adjustment", category: target > before ? "stock_in" : "stock_out",
        amount: Math.abs(target - before), description: `[${p.name}] Conteo físico`, recorded_by: by,
      }).then(() => {}, () => {});
    }
    setBusy(false);
    if (failed) { setError(`No se guardaron ${failed} producto${failed === 1 ? "" : "s"}. Revisa tu conexión e intenta de nuevo.`); onApplied?.(); return; }
    onApplied?.();
    onClose();
  };

  const drawerList = (
    <div className="flex flex-col" style={{ gap: 8 }}>
      {shownGroups.length === 0 && <p style={{ padding: 20, color: SUB, textAlign: "center" }}>No hay productos con stock para contar.</p>}
      {shownGroups.map((g) => {
        const sel = g.id === drawer;
        const missing = missingFor(g);
        const cIn = changedIn(g);
        const out = g.items.filter((p) => num(p.stock) <= 0).length;
        return (
          <button key={g.id || "none"} type="button" onClick={() => setDrawer(g.id)} className="apple-press flex items-center gap-3 text-left" style={{ padding: "12px 14px", borderRadius: 14, background: sel ? tint("#F2662E", 0.16) : CARD, border: `1px solid ${sel ? tint("#F2662E", 0.4) : "transparent"}` }}>
            <span style={{ width: 36, height: 36, borderRadius: 10, background: tint("#F2662E", 0.16), color: "#F2662E", display: "flex", alignItems: "center", justifyContent: "center" }}><Archive className="w-4 h-4" /></span>
            <span className="flex-1 min-w-0">
              <span className="block truncate" style={{ fontSize: 16, fontWeight: 700 }}>{g.label}</span>
              <span className="block" style={{ fontSize: 12, color: SUB }}>{g.items.length} producto{g.items.length === 1 ? "" : "s"}{out ? ` · ${out} agotado${out === 1 ? "" : "s"}` : ""}{cIn ? ` · ${cIn} con cambios` : ""}</span>
            </span>
            {cIn > 0 && <span style={{ fontSize: 13, fontWeight: 700, color: missing < 0 ? "#FF7373" : "#4DC780" }}>{missing >= 0 ? "+" : "-"}{usd(Math.abs(missing))}</span>}
            <ChevronRight className="w-4 h-4" style={{ color: "rgba(235,235,245,0.3)" }} />
          </button>
        );
      })}
    </div>
  );

  const countList = group ? (
    <div className="flex flex-col" style={{ gap: 8 }}>
      {!wide && <button type="button" onClick={() => setDrawer(null)} className="apple-press inline-flex items-center gap-1 self-start" style={{ color: "#F2662E", fontWeight: 600, fontSize: 15 }}><ChevronLeft className="w-4 h-4" /> Gavetas</button>}
      <div className="flex items-center justify-between">
        <p style={{ fontSize: 18, fontWeight: 800 }}>{group.label}</p>
        {changedIn(group) > 0 && <span style={{ fontSize: 13, fontWeight: 700, color: missingFor(group) < 0 ? "#FF7373" : "#4DC780" }}>Diferencia {missingFor(group) >= 0 ? "+" : "-"}{usd(Math.abs(missingFor(group)))} a costo</span>}
      </div>
      {shownItems.map((p) => {
        const cur = Math.round(num(p.stock));
        const c = counted(p);
        const diff = c === null ? 0 : c - cur;
        return (
          <div key={p.id} className="flex items-center gap-3" style={{ padding: "10px 14px", borderRadius: 14, background: CARD }}>
            <span className="flex-1 min-w-0">
              <span className="block truncate" style={{ fontSize: 15, fontWeight: 600 }}>{p.name}</span>
              <span className="block" style={{ fontSize: 12, color: SUB }}>Sistema: {cur}{p.sku ? ` · ${p.sku}` : ""}</span>
            </span>
            {diff !== 0 && <span style={{ padding: "2px 8px", borderRadius: 999, background: tint(diff < 0 ? "#FF7373" : "#4DC780", 0.16), color: diff < 0 ? "#FF7373" : "#4DC780", fontSize: 12, fontWeight: 700 }}>{diff > 0 ? "+" : ""}{diff}</span>}
            <input
              value={counts[p.id] ?? ""}
              onChange={(e) => setCounts((cs) => ({ ...cs, [p.id]: e.target.value.replace(/\D/g, "") }))}
              inputMode="numeric"
              placeholder={String(cur)}
              aria-label={`Contado de ${p.name}`}
              style={{ width: 72, textAlign: "center", background: "#1C1C1E", color: "#fff", borderRadius: 10, padding: "9px 6px", fontSize: 16, fontWeight: 700, colorScheme: "dark" }}
            />
          </div>
        );
      })}
    </div>
  ) : (
    <div className="flex flex-col items-center justify-center text-center" style={{ minHeight: 220, gap: 8, color: SUB }}><Archive className="w-8 h-8" /><b style={{ color: "#fff" }}>Selecciona una gaveta</b><span>Elige una gaveta a la izquierda para empezar a contar.</span></div>
  );

  return (
    <Dialog
      open={open}
      onClose={() => !busy && onClose()}
      title="Conteo físico"
      width={wide ? 900 : 520}
      height="90dvh"
      leading={<TextAction onClick={onClose} disabled={busy}>Cancelar</TextAction>}
      trailing={busy ? <Loader2 className="w-5 h-5 animate-spin" style={{ color: SUB }} /> : <TextAction bold disabled={!changedAll.length} onClick={apply}>Aplicar ({changedAll.length})</TextAction>}
    >
      <div className="flex flex-col" style={{ gap: 12, paddingTop: 6 }}>
        <div className="flex gap-2">
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder={group ? "Buscar en esta gaveta" : "Buscar gaveta"} aria-label="Buscar" style={{ flex: 1, minWidth: 0, background: CARD, color: "#fff", borderRadius: 12, padding: "10px 14px", fontSize: 15, colorScheme: "dark" }} />
          <div className="flex items-center gap-2" style={{ background: CARD, borderRadius: 12, padding: "0 12px" }}>
            <ScanLine className="w-4 h-4" style={{ color: SUB }} />
            <input value={scan} onChange={(e) => setScan(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); handleScan(); } }} placeholder="Escanear código" aria-label="Escanear código" style={{ width: 130, background: "transparent", color: "#fff", fontSize: 14, outline: "none" }} />
          </div>
        </div>
        {toast && <p style={{ fontSize: 13, fontWeight: 700, color: "#4DC780", textAlign: "center" }}>{toast}</p>}
        {error && <p style={{ fontSize: 13, color: "#FF7373" }}>{error}</p>}
        {wide ? (
          <div className="flex" style={{ gap: 16, alignItems: "flex-start" }}>
            <div style={{ width: 300, flexShrink: 0 }}>{drawerList}</div>
            <div className="flex-1 min-w-0">{countList}</div>
          </div>
        ) : (group ? countList : drawerList)}
        <p style={{ fontSize: 12, color: SUB }}>Aplicar fija el stock de cada producto con cambios al número que contaste y lo registra como "Conteo físico".</p>
      </div>
    </Dialog>
  );
}
