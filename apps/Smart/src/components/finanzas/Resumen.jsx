import { useMemo, useState } from "react";
import { AlertCircle, CheckCircle2, ChevronRight, Plus, Minus, BarChart3, CalendarClock, ArrowUpRight, ArrowDownRight, Share, Tag, ArrowUpDown, Search, CircleX, ChevronDown, ChevronUp, Paperclip, Undo2, Info, Loader2, PlusCircle, MinusCircle, Check, Pencil } from "lucide-react";
import { tint, ErrorBanner } from "@/components/pos/native/posUi";
import { ContextMenu } from "@/components/pos/native/Catalog";
import { FP, isLedgerTx, isRevenue, isExpense, isRefund, isCheckIssued, movSigned, movOutMagnitude, movCatStyle, displayPaymentMethod, num, txDate } from "@/lib/finance/ledger";
import { fmt } from "@/lib/finance/tz";
import { money, cardStyle, Bar, downloadText } from "./ui";

function Stat({ label, value, color }) {
  return (
    <div className="min-w-0">
      <p style={{ fontSize: 11, color: "#8E8E93" }}>{label}</p>
      <p className="truncate" style={{ fontSize: 15, fontWeight: 700, color, fontVariantNumeric: "tabular-nums" }}>{money(value)}</p>
    </div>
  );
}

export function TodayStrip({ totals, minimum }) {
  const neto = totals.entro - totals.salio;
  const done = neto >= minimum;
  return (
    <div className="flex flex-col" style={{ gap: 8, padding: 12, borderRadius: 16, background: `linear-gradient(135deg, ${tint(FP.brand, 0.12)}, transparent 60%), #1C1C1E`, border: `1px solid ${tint(FP.brand, 0.22)}` }}>
      <div className="flex items-center justify-between">
        <span style={{ fontSize: 12, fontWeight: 700, letterSpacing: "0.05em", color: "#8E8E93" }}>HOY</span>
        {minimum > 0 && <span style={{ fontSize: 11, color: "#8E8E93" }}>Mínimo diario {money(minimum)}</span>}
      </div>
      <div className="flex items-end gap-5">
        <Stat label="Entró" value={totals.entro} color={FP.entra} />
        <Stat label="Salió" value={totals.salio} color={FP.sale} />
        <span className="flex-1" />
        <div className="text-right">
          <p style={{ fontSize: 11, color: "#8E8E93" }}>Neto</p>
          <p style={{ fontSize: 28, fontWeight: 700, color: neto >= 0 ? FP.entra : FP.sale, fontVariantNumeric: "tabular-nums" }}>{money(neto)}</p>
        </div>
      </div>
      {minimum > 0 && (
        <div className="flex flex-col" style={{ gap: 3 }}>
          <Bar fraction={Math.max(0, Math.min(1, neto / minimum))} color={done ? FP.entra : FP.warning} />
          <p style={{ fontSize: 11, fontWeight: 600, color: done ? FP.entra : FP.warning }}>{done ? "Mínimo de hoy cumplido" : `Te faltan ${money(Math.max(0, minimum - neto))} para el mínimo de hoy`}</p>
        </div>
      )}
    </div>
  );
}

export function MesCard({ totals, delta }) {
  const neto = totals.entro - totals.salio;
  return (
    <div className="flex items-center gap-3" style={{ ...cardStyle, padding: 12 }}>
      <div>
        <p style={{ fontSize: 12, fontWeight: 700, letterSpacing: "0.05em", color: "#8E8E93" }}>ESTE MES</p>
        <div className="flex gap-3" style={{ marginTop: 4 }}>
          <Stat label="Entró" value={totals.entro} color={FP.entra} />
          <Stat label="Salió" value={totals.salio} color={FP.sale} />
        </div>
      </div>
      <span className="flex-1" />
      <div className="text-right">
        <p style={{ fontSize: 11, color: "#8E8E93" }}>Neto</p>
        <p style={{ fontSize: 22, fontWeight: 700, color: neto >= 0 ? FP.entra : FP.sale, fontVariantNumeric: "tabular-nums" }}>{money(neto)}</p>
        {delta !== null && delta !== undefined && (
          <p className="flex items-center justify-end gap-0.5" style={{ fontSize: 11, fontWeight: 600, color: delta >= 0 ? FP.entra : FP.sale }}>
            {delta >= 0 ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}{Math.abs(delta).toFixed(0)}%
          </p>
        )}
      </div>
    </div>
  );
}

export function CuentasButton({ total, onClick }) {
  return (
    <button onClick={onClick} className="apple-press w-full flex items-center gap-2 text-left" style={{ padding: 12, borderRadius: 16, background: total > 0 ? FP.sale : FP.entra, color: "#fff" }}>
      {total > 0 ? <AlertCircle className="w-6 h-6" /> : <CheckCircle2 className="w-6 h-6" />}
      <span className="flex-1">
        <span className="block" style={{ fontSize: 15, fontWeight: 700 }}>Cuentas por pagar</span>
        <span className="block" style={{ fontSize: 12 }}>{total > 0 ? `${money(total)} en total` : "Todo al día"}</span>
      </span>
      <ChevronRight className="w-4 h-4" />
    </button>
  );
}

export function QuickActions({ onIncome, onExpense, onReportes, onPlan }) {
  const item = (title, Icon, color, onClick) => (
    <button key={title} onClick={onClick} className="apple-press flex-1 flex flex-col items-center" style={{ gap: 4, padding: "8px 0", borderRadius: 12, background: "#1C1C1E" }}>
      <span style={{ width: 34, height: 34, borderRadius: 999, background: tint(color, 0.14), color, display: "flex", alignItems: "center", justifyContent: "center" }}><Icon className="w-4 h-4" strokeWidth={3} /></span>
      <span style={{ fontSize: 12, fontWeight: 600 }}>{title}</span>
    </button>
  );
  return (
    <div className="flex gap-2">
      {item("Ingreso", Plus, FP.entra, onIncome)}
      {item("Gasto", Minus, FP.sale, onExpense)}
      {item("Reportes", BarChart3, FP.brand, onReportes)}
      {item("Plan", CalendarClock, FP.vip, onPlan)}
    </div>
  );
}

export function DevolucionesCard({ count, total }) {
  return (
    <div style={{ ...cardStyle, padding: 12 }}>
      <div className="flex items-start gap-3">
        <span style={{ width: 44, height: 44, borderRadius: 12, background: tint(FP.danger, 0.15), color: FP.danger, display: "flex", alignItems: "center", justifyContent: "center" }}><Undo2 className="w-6 h-6" /></span>
        <div>
          <p style={{ fontSize: 20, fontWeight: 700 }}>Devoluciones</p>
          <p style={{ fontSize: 12, color: "#8E8E93" }}>Dinero devuelto a clientes · {count} {count === 1 ? "Devolución" : "Devoluciones"}</p>
        </div>
      </div>
      <p style={{ fontSize: 10, fontWeight: 600, letterSpacing: "0.04em", color: "#8E8E93", marginTop: 12 }}>TOTAL DEVUELTO</p>
      <p style={{ fontSize: 30, fontWeight: 800, color: FP.danger }}>-{money(total)}</p>
      <p className="flex items-center gap-1" style={{ fontSize: 11, color: "#8E8E93", marginTop: 6 }}><Info className="w-3 h-3" style={{ color: "rgba(235,235,245,0.3)" }} /> Las devoluciones se restan de tu neto del mes.</p>
    </div>
  );
}

const DIRS = [["all", "Entró y Salió"], ["entro", "Solo entró"], ["salio", "Solo salió"]];

function csvEscape(s) {
  const v = String(s ?? "");
  return /[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;
}

export function Movimientos({ monthRows, loading, error, onDismissError, monthLabel, tz, wide, onAddIncome, onAddExpense, onEditExpense, onOpenOrder, onChangeCategory }) {
  const [cat, setCat] = useState(null);
  const [dir, setDir] = useState("all");
  const [search, setSearch] = useState("");
  const [showSearch, setShowSearch] = useState(false);
  const [sort, setSort] = useState("fecha");
  const [asc, setAsc] = useState(false);
  const [menu, setMenu] = useState(null);

  const base = useMemo(() => monthRows.filter((t) => !t.is_deleted && isLedgerTx(t)), [monthRows]);
  const categoriesPresent = useMemo(() => {
    const seen = {};
    base.forEach((t) => { const s = movCatStyle(t); seen[s.key] = s; });
    return Object.values(seen).sort((a, b) => a.label.localeCompare(b.label));
  }, [base]);
  const filtered = !!cat || dir !== "all" || !!search.trim();

  const rows = useMemo(() => {
    const chrono = [...base].sort((a, b) => (txDate(a) || 0) - (txDate(b) || 0));
    let running = 0;
    const bal = {};
    chrono.forEach((t) => { running += movSigned(t); bal[t.id] = running; });
    let r = base;
    if (cat) r = r.filter((t) => movCatStyle(t).key === cat);
    if (dir === "entro") r = r.filter(isRevenue);
    if (dir === "salio") r = r.filter((t) => isExpense(t) || isRefund(t));
    const q = search.trim().toLowerCase();
    if (q) r = r.filter((t) => String(t.description || "").toLowerCase().includes(q) || movCatStyle(t).label.toLowerCase().includes(q));
    const cmp = {
      fecha: (a, b) => (txDate(a) || 0) - (txDate(b) || 0),
      concepto: (a, b) => String(a.description || "").localeCompare(String(b.description || ""), "es", { sensitivity: "base" }),
      categoria: (a, b) => movCatStyle(a).label.localeCompare(movCatStyle(b).label, "es", { sensitivity: "base" }),
      monto: (a, b) => Math.abs(movSigned(a)) - Math.abs(movSigned(b)),
      balance: (a, b) => (bal[a.id] || 0) - (bal[b.id] || 0),
    }[sort];
    r = [...r].sort((a, b) => (asc ? cmp(a, b) : cmp(b, a)));
    return r.map((tx) => ({ tx, balance: bal[tx.id] }));
  }, [base, cat, dir, search, sort, asc]);

  const entro = rows.reduce((s, r) => s + (isRevenue(r.tx) ? num(r.tx.amount) : 0), 0);
  const salio = rows.reduce((s, r) => s + (isRevenue(r.tx) ? 0 : Math.abs(movSigned(r.tx))), 0);
  const neto = entro - salio;

  const exportCSV = () => {
    const header = "Fecha,Concepto,Categoria,Tipo,Entro,Salio,Balance,Metodo";
    const lines = rows.map(({ tx, balance }) => {
      const s = movCatStyle(tx);
      const tipo = isRevenue(tx) ? "Entró" : isCheckIssued(tx) ? "Comprometido" : "Salió";
      const d = txDate(tx);
      return [
        d ? fmt(d, tz, { day: "2-digit", month: "2-digit", year: "numeric" }) : "",
        tx.description || "", s.label, tipo,
        isRevenue(tx) ? num(tx.amount).toFixed(2) : "",
        isRevenue(tx) ? "" : movOutMagnitude(tx).toFixed(2),
        balance !== undefined ? balance.toFixed(2) : "",
        displayPaymentMethod(tx.payment_method),
      ].map(csvEscape).join(",");
    });
    const slug = monthLabel.replace(/ /g, "-").toLowerCase();
    downloadText(`\uFEFF${[header, ...lines].join("\n")}`, `movimientos-${slug}.csv`);
  };

  const rowClick = (tx) => {
    if (isExpense(tx)) onEditExpense(tx);
    else if (isRevenue(tx) && tx.order_id) onOpenOrder(tx.order_id);
  };

  const pill = (Icon, text, on, onClick) => (
    <button onClick={onClick} className="apple-press flex items-center gap-1.5" style={{ height: 34, padding: "0 10px", borderRadius: 999, fontSize: 13, fontWeight: 600, color: on ? FP.brand : "#8E8E93", background: on ? tint(FP.brand, 0.14) : "#1C1C1E", border: `1px solid ${on ? tint(FP.brand, 0.4) : "#3A3A3C"}` }}>
      <Icon className="w-3 h-3" /> <span className="truncate" style={{ maxWidth: 160 }}>{text}</span> <ChevronDown className="w-2.5 h-2.5" />
    </button>
  );

  const openMenuAt = (e, items) => {
    const r = e.currentTarget.getBoundingClientRect();
    setMenu({ x: r.left, y: r.bottom + 6, items });
  };

  const catPill = (tx) => {
    const s = movCatStyle(tx);
    return (
      <button
        onClick={(e) => { e.stopPropagation(); if (s.editable) onChangeCategory(tx, e); }}
        className="inline-flex items-center gap-1 truncate"
        style={{ padding: "6px 10px", borderRadius: 999, background: tint(s.color, 0.16), color: s.color, fontSize: 11, fontWeight: 600, maxWidth: "100%", cursor: s.editable ? "pointer" : "default" }}>
        {s.label}
        {s.editable && <Pencil className="w-2.5 h-2.5 flex-shrink-0" style={{ opacity: 0.5 }} />}
      </button>
    );
  };

  const header = (label, col, w, align) => (
    <button onClick={() => { if (sort === col) setAsc(!asc); else { setSort(col); setAsc(false); } }}
      className="flex items-center gap-1" style={{ width: w, flex: w ? "none" : 1, justifyContent: align === "right" ? "flex-end" : "flex-start", fontSize: 10, fontWeight: 600, letterSpacing: "0.03em", color: sort === col ? FP.brand : "#8E8E93" }}>
      {label.toUpperCase()}
      {sort === col && (asc ? <ChevronUp className="w-2.5 h-2.5" /> : <ChevronDown className="w-2.5 h-2.5" />)}
    </button>
  );

  const dateShort = (tx) => { const d = txDate(tx); return d ? fmt(d, tz, { day: "2-digit", month: "short" }).replace(".", "") : "—"; };

  return (
    <div className="flex flex-col" style={{ gap: 12 }}>
      <ErrorBanner message={error} onDismiss={onDismissError} />
      <div className="flex items-center gap-2">
        <span className="flex-1" style={{ fontSize: 17, fontWeight: 700 }}>Movimientos</span>
        <button onClick={(e) => openMenuAt(e, [{ label: "Ingreso", Icon: PlusCircle, onPress: onAddIncome }, { label: "Gasto", Icon: MinusCircle, onPress: onAddExpense }])} aria-label="Agregar" className="apple-press" style={{ width: 38, height: 38, borderRadius: 999, background: tint(FP.brand, 0.12), color: FP.brand, display: "flex", alignItems: "center", justifyContent: "center" }}><Plus className="w-4 h-4" strokeWidth={3} /></button>
        <button onClick={exportCSV} aria-label="Exportar CSV" className="apple-press" style={{ width: 38, height: 38, borderRadius: 999, background: tint(FP.brand, 0.12), color: FP.brand, display: "flex", alignItems: "center", justifyContent: "center" }}><Share className="w-4 h-4" /></button>
      </div>
      <div className="flex items-center gap-2">
        {pill(Tag, cat ? categoriesPresent.find((c) => c.key === cat)?.label || "Categoría" : "Categoría", !!cat, (e) => openMenuAt(e, [
          { label: "Todas las categorías", Icon: cat === null ? Check : null, onPress: () => setCat(null) },
          ...categoriesPresent.map((c) => ({ label: c.label, Icon: cat === c.key ? Check : null, onPress: () => setCat(c.key) })),
        ]))}
        {pill(ArrowUpDown, DIRS.find(([k]) => k === dir)[1], dir !== "all", (e) => openMenuAt(e, DIRS.map(([k, l]) => ({ label: l, Icon: dir === k ? Check : null, onPress: () => setDir(k) }))))}
        <span className="flex-1" />
        <button onClick={() => { setShowSearch(!showSearch); if (showSearch) setSearch(""); }} aria-label="Buscar" className="apple-press" style={{ width: 34, height: 34, borderRadius: 999, background: "#1C1C1E", color: showSearch || search ? FP.brand : "#8E8E93", display: "flex", alignItems: "center", justifyContent: "center" }}><Search className="w-4 h-4" /></button>
      </div>
      {showSearch && (
        <div className="flex items-center gap-2" style={{ height: 38, padding: "0 12px", borderRadius: 999, background: "#1C1C1E" }}>
          <Search className="w-4 h-4" style={{ color: "#8E8E93" }} />
          <input autoFocus value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar concepto…" style={{ flex: 1, background: "transparent", border: "none", outline: "none", color: "#fff", fontSize: 15 }} />
          {search && <button onClick={() => setSearch("")} aria-label="Limpiar" style={{ color: "#8E8E93" }}><CircleX className="w-4 h-4" /></button>}
        </div>
      )}
      <div style={{ ...cardStyle, overflow: "hidden" }}>
        {wide ? (
          <div className="flex items-center gap-2" style={{ padding: "8px 12px" }}>
            {header("Fecha", "fecha", 66)}
            {header("Concepto", "concepto")}
            {header("Categoría", "categoria", 132)}
            {header("Entró", "monto", 92, "right")}
            <span style={{ width: 92, textAlign: "right", fontSize: 10, fontWeight: 600, letterSpacing: "0.03em", color: "#8E8E93" }}>SALIÓ</span>
            {header("Balance", "balance", 104, "right")}
          </div>
        ) : (
          <div className="flex items-center justify-between" style={{ padding: "8px 12px" }}>
            <span style={{ fontSize: 10, fontWeight: 600, letterSpacing: "0.03em", color: "#8E8E93" }}>MOVIMIENTOS</span>
            <button onClick={(e) => openMenuAt(e, [
              ...[["fecha", "Fecha"], ["concepto", "Concepto"], ["categoria", "Categoría"], ["monto", "Monto"], ["balance", "Balance"]].map(([k, l]) => ({ label: l, Icon: sort === k ? Check : null, onPress: () => setSort(k) })),
              { divider: true },
              { label: asc ? "Orden descendente" : "Orden ascendente", onPress: () => setAsc(!asc) },
            ])} className="flex items-center gap-1" style={{ fontSize: 12, fontWeight: 600, color: FP.brand }}><ArrowUpDown className="w-3 h-3" /> Ordenar</button>
          </div>
        )}
        <div style={{ height: 0.5, background: "rgba(84,84,88,0.6)" }} />
        {rows.length === 0 ? (
          loading ? <div className="flex justify-center" style={{ padding: 30 }}><Loader2 className="w-5 h-5 animate-spin" style={{ color: "#8E8E93" }} /></div>
            : <p className="text-center" style={{ fontSize: 13, color: "#8E8E93", padding: 30 }}>{filtered ? "No hay movimientos con estos filtros." : "Aún no hay movimientos este mes."}</p>
        ) : (
          <>
            {rows.map(({ tx, balance }, i) => (
              <div key={tx.id} onClick={() => rowClick(tx)} className="cursor-pointer" style={{ borderTop: i ? "0.5px solid rgba(84,84,88,0.6)" : "none", marginLeft: i ? 12 : 0 }}>
                {wide ? (
                  <div className="flex items-center gap-2" style={{ padding: "8px 12px", marginLeft: i ? -12 : 0 }}>
                    <span className="truncate" style={{ width: 66, fontSize: 12, color: "#8E8E93" }}>{dateShort(tx)}</span>
                    <span className="flex-1 min-w-0 flex items-center gap-1">
                      <span className="truncate" style={{ fontSize: 15 }}>{tx.description || "—"}</span>
                      {tx.receipt_url && <Paperclip className="w-3 h-3" style={{ color: "#8E8E93", flexShrink: 0 }} />}
                      {isRevenue(tx) && tx.order_id && <ChevronRight className="w-3 h-3" style={{ color: "rgba(235,235,245,0.3)", flexShrink: 0 }} />}
                    </span>
                    <span style={{ width: 132, overflow: "hidden" }}>{catPill(tx)}</span>
                    <span className="truncate" style={{ width: 92, textAlign: "right", fontSize: 15, color: isRevenue(tx) ? FP.entra : "rgba(235,235,245,0.3)", fontVariantNumeric: "tabular-nums" }}>{isRevenue(tx) ? money(tx.amount) : "—"}</span>
                    <span className="truncate" style={{ width: 92, textAlign: "right", fontSize: 15, color: isRevenue(tx) ? "rgba(235,235,245,0.3)" : isCheckIssued(tx) ? FP.comprometido : FP.sale, fontVariantNumeric: "tabular-nums" }}>{isRevenue(tx) ? "—" : money(movOutMagnitude(tx))}</span>
                    <span className="truncate" style={{ width: 104, textAlign: "right", fontSize: 15, fontWeight: 500, fontVariantNumeric: "tabular-nums" }}>{balance !== undefined ? money(balance) : "—"}</span>
                  </div>
                ) : (
                  <div className="flex items-center gap-2" style={{ padding: "8px 12px", marginLeft: i ? -12 : 0 }}>
                    <div className="flex-1 min-w-0">
                      <p className="flex items-center gap-1"><span className="truncate" style={{ fontSize: 15, fontWeight: 600 }}>{tx.description || "—"}</span>{isRevenue(tx) && tx.order_id && <ChevronRight className="w-3 h-3" style={{ color: "rgba(235,235,245,0.3)" }} />}</p>
                      <p className="flex items-center gap-1.5" style={{ marginTop: 3 }}><span style={{ fontSize: 11, color: "#8E8E93" }}>{dateShort(tx)}</span>{catPill(tx)}</p>
                    </div>
                    <div className="text-right">
                      {isRevenue(tx)
                        ? <p style={{ fontSize: 15, fontWeight: 700, color: FP.entra }}>+{money(tx.amount)}</p>
                        : <p style={{ fontSize: 15, fontWeight: 700, color: isCheckIssued(tx) ? FP.comprometido : FP.sale }}>{isCheckIssued(tx) ? "" : "-"}{money(movOutMagnitude(tx))}</p>}
                      {balance !== undefined && <p style={{ fontSize: 11, color: "#8E8E93" }}>{money(balance)}</p>}
                    </div>
                  </div>
                )}
              </div>
            ))}
            <div style={{ height: 0.5, background: "rgba(84,84,88,0.6)" }} />
            {wide ? (
              <div className="flex items-center gap-2" style={{ padding: 12, background: "#2C2C2E" }}>
                <span className="flex-1 truncate" style={{ fontSize: 15, fontWeight: 700 }}>{filtered ? "TOTALES · Filtrado" : `TOTALES · ${monthLabel}`}</span>
                <span style={{ width: 92, textAlign: "right", fontSize: 15, fontWeight: 700, color: FP.entra }}>{money(entro)}</span>
                <span style={{ width: 92, textAlign: "right", fontSize: 15, fontWeight: 700, color: FP.sale }}>{money(salio)}</span>
                <span style={{ width: 104, textAlign: "right", fontSize: 15, fontWeight: 800, color: neto >= 0 ? FP.entra : FP.sale }}>{neto >= 0 ? "+" : ""}{money(neto)}</span>
              </div>
            ) : (
              <div className="flex items-center justify-between" style={{ padding: 12, background: "#2C2C2E" }}>
                <span style={{ fontSize: 15, fontWeight: 700 }}>{filtered ? "Neto (filtrado)" : "Neto del mes"}</span>
                <span style={{ fontSize: 15, fontWeight: 800, color: neto >= 0 ? FP.entra : FP.sale }}>{neto >= 0 ? "+" : ""}{money(neto)}</span>
              </div>
            )}
          </>
        )}
      </div>
      <ContextMenu menu={menu} onClose={() => setMenu(null)} />
    </div>
  );
}
