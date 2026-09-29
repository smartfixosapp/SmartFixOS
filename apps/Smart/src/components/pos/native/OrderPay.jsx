import { useEffect, useRef, useState } from "react";
import { Search, CircleX, ChevronRight, FileSearch, Inbox, Loader2 } from "lucide-react";
import { P, Dialog, TextAction, ErrorBanner } from "./posUi";
import { QuickPaySheet } from "@/components/orderDetail/Money";
import { listUnpaidOrders } from "@/lib/posApi";
import { recordOrderPayment } from "@/lib/orderMoneyApi";
import { fetchOrder } from "@/lib/orderDetailApi";
import { remainingBalance, orderTotal, sendPaymentReceipt } from "@/lib/orderEmails";
import { statusInfo } from "@/lib/orderStatus";
import { usd } from "@/lib/posLogic";

export default function OrderPayDialog({ open, onClose, tenantId, tenant, employee, onPaid }) {
  const [q, setQ] = useState("");
  const [results, setResults] = useState([]);
  const [recent, setRecent] = useState([]);
  const [loading, setLoading] = useState(false);
  const [loadingRecent, setLoadingRecent] = useState(false);
  const [error, setError] = useState(null);
  const [selected, setSelected] = useState(null);
  const timer = useRef(null);
  const paidRef = useRef(false);

  useEffect(() => {
    if (!open) return;
    setQ("");
    setResults([]);
    setSelected(null);
    setError(null);
    paidRef.current = false;
    setLoadingRecent(true);
    listUnpaidOrders(tenantId, 8).then(setRecent, () => setRecent([])).finally(() => setLoadingRecent(false));
  }, [open, tenantId]);

  useEffect(() => () => clearTimeout(timer.current), []);

  const onSearch = (v) => {
    setQ(v);
    clearTimeout(timer.current);
    timer.current = setTimeout(async () => {
      const s = v.trim().toLowerCase();
      if (!s) { setResults([]); return; }
      setLoading(true);
      setError(null);
      try {
        const rows = await listUnpaidOrders(tenantId, 200);
        setResults(rows.filter((o) => String(o.order_number || "").toLowerCase().includes(s) || String(o.customer_name || "").toLowerCase().includes(s)));
      } catch (e) {
        setError(e?.message || String(e));
      }
      setLoading(false);
    }, 250);
  };

  const row = (o) => {
    const info = statusInfo(o.status);
    const bal = remainingBalance(o);
    return (
      <button key={o.id} onClick={() => setSelected(o)} className="w-full flex items-center gap-3 text-left" style={{ padding: "10px 14px", borderTop: `0.5px solid ${P.sep}` }}>
        <div className="flex-1 min-w-0">
          <p className="flex items-center gap-1.5">
            <span style={{ fontSize: 15, fontWeight: 600 }}>{o.order_number}</span>
            <span style={{ width: 6, height: 6, borderRadius: 999, background: info.color }} />
            <span style={{ fontSize: 12, color: P.sub }}>{info.label}</span>
          </p>
          {o.customer_name && <p className="truncate" style={{ fontSize: 12, color: P.sub }}>{o.customer_name}</p>}
        </div>
        <div className="flex flex-col items-end">
          <span style={{ fontSize: 15, fontWeight: 700, color: bal > 0 ? P.danger : P.success }}>{usd(bal)}</span>
          <span style={{ fontSize: 11, color: P.sub }}>Balance</span>
        </div>
        <ChevronRight className="w-4 h-4" style={{ color: P.ter }} />
      </button>
    );
  };

  const submit = async ({ amount, method, customLabel, label }) => {
    const res = await recordOrderPayment({ order: selected, amount, method, customLabel, by: employee?.full_name || "Web" });
    paidRef.current = true;
    const fresh = (await fetchOrder(selected.id, tenantId).catch(() => null)) || selected;
    if (String(fresh.customer_email || "").trim() && tenant) {
      sendPaymentReceipt({ order: fresh, tenant, amount: res.applied, method, isFull: res.isPaidNow, transactionId: res.transactionId }).catch(() => {});
    }
    const settled = orderTotal(fresh) > 0 && remainingBalance(fresh) <= 0.004;
    onPaid?.(settled ? `Orden saldada · ${usd(res.applied)} · ${label}` : `Depósito recibido · ${usd(res.applied)} · ${label}`);
  };

  return (
    <>
      <Dialog open={open && !selected} onClose={onClose} title="Cobrar a orden" width={560} height="80dvh" leading={<TextAction onClick={onClose}>Cancelar</TextAction>} trailing={null} bodyPadding="0">
        <div style={{ padding: 16 }}>
          <div className="flex items-center gap-2" style={{ padding: "12px 14px", borderRadius: 12, background: "#2C2C2E" }}>
            <Search className="w-4 h-4" style={{ color: P.sub }} />
            <input autoFocus value={q} onChange={(e) => onSearch(e.target.value.toUpperCase())} placeholder="Número de orden o cliente" autoCorrect="off" style={{ flex: 1, background: "transparent", border: "none", outline: "none", color: P.text, fontSize: 16 }} />
            {q && <button onClick={() => { setQ(""); setResults([]); }} aria-label="Limpiar" style={{ color: P.sub }}><CircleX className="w-5 h-5" /></button>}
          </div>
        </div>
        {error && <div style={{ padding: "0 16px 12px" }}><ErrorBanner message={error} onDismiss={() => setError(null)} /></div>}
        {loading ? (
          <div className="flex justify-center" style={{ padding: 40 }}><Loader2 className="w-6 h-6 animate-spin" style={{ color: P.sub }} /></div>
        ) : !q ? (
          loadingRecent ? (
            <div className="flex justify-center" style={{ padding: 40 }}><Loader2 className="w-6 h-6 animate-spin" style={{ color: P.sub }} /></div>
          ) : recent.length ? (
            <div style={{ margin: "0 16px 16px" }}>
              <p style={{ fontSize: 12, color: P.sub, textTransform: "uppercase", margin: "0 4px 6px" }}>Cobros recientes</p>
              <div style={{ borderRadius: 12, background: "#2C2C2E", overflow: "hidden" }}>{recent.map(row)}</div>
            </div>
          ) : (
            <div className="flex flex-col items-center text-center" style={{ padding: 40, gap: 8 }}>
              <FileSearch className="w-10 h-10" style={{ color: P.ter }} />
              <p style={{ fontSize: 17, fontWeight: 600 }}>Busca una orden</p>
              <p style={{ fontSize: 14, color: P.sub }}>{'Escribe el número ("103") o el nombre del cliente.'}</p>
            </div>
          )
        ) : results.length === 0 ? (
          <div className="flex flex-col items-center text-center" style={{ padding: 40, gap: 8 }}>
            <Inbox className="w-10 h-10" style={{ color: P.ter }} />
            <p style={{ fontSize: 17, fontWeight: 600 }}>Sin resultados</p>
            <p style={{ fontSize: 14, color: P.sub }}>Solo se muestran órdenes con balance pendiente.</p>
          </div>
        ) : (
          <div style={{ margin: "0 16px 16px", borderRadius: 12, background: "#2C2C2E", overflow: "hidden" }}>{results.map(row)}</div>
        )}
      </Dialog>
      <QuickPaySheet open={open && !!selected} order={selected} tenant={tenant} onClose={() => { setSelected(null); if (paidRef.current) onClose(); }} onSubmit={submit} />
    </>
  );
}
