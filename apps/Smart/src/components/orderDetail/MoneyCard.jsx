import React from "react";
import { DollarSign, Receipt } from "lucide-react";
import { orderTotal, remainingBalance } from "@/lib/orderEmails";
import { C, tint, Card, SectionHeader, money } from "./ui";

export default function MoneyCard({ order, onCharge }) {
  const total = orderTotal(order);
  const paid = Number(order.amount_paid) || 0;
  const balance = remainingBalance(order);
  const settled = total > 0 && balance <= 0.009;
  const pct = total > 0 ? Math.max(0, Math.min(100, Math.round((paid / total) * 100))) : 0;
  const owes = balance > 0.009;

  return (
    <div>
      <SectionHeader>Dinero</SectionHeader>
      <Card>
        <div className="flex items-baseline justify-between" style={{ gap: 12 }}>
          <span style={{ fontSize: 14, color: C.sub }}>Cotización</span>
          <span style={{ fontSize: 17, fontWeight: 700, color: C.text, fontVariantNumeric: "tabular-nums" }}>{total > 0 ? money(total) : "Sin cotizar"}</span>
        </div>
        <div className="flex items-baseline justify-between" style={{ gap: 12, marginTop: 8 }}>
          <span style={{ fontSize: 14, color: C.sub }}>Pagado</span>
          <span style={{ fontSize: 15, fontWeight: 600, color: paid > 0 ? C.green : C.text, fontVariantNumeric: "tabular-nums" }}>{money(paid)}</span>
        </div>
        <div style={{ height: 6, borderRadius: 3, background: C.card2, margin: "12px 0", overflow: "hidden" }}>
          <div style={{ width: `${settled ? 100 : pct}%`, height: "100%", borderRadius: 3, background: C.green, transition: "width 0.5s cubic-bezier(0.2, 0.8, 0.2, 1)" }} />
        </div>
        <div className="flex items-baseline justify-between" style={{ gap: 12, paddingTop: 10, borderTop: `0.5px solid ${C.sep}` }}>
          <span style={{ fontSize: 14, color: C.sub }}>Balance</span>
          <span style={{ fontSize: 20, fontWeight: 800, color: owes ? C.red : C.green, fontVariantNumeric: "tabular-nums" }}>{owes ? money(balance) : total > 0 || paid > 0 ? "Saldado" : money(0)}</span>
        </div>
        <button onClick={onCharge} className="apple-press w-full flex items-center justify-center gap-2" style={{ marginTop: 12, minHeight: 44, borderRadius: 12, background: owes ? tint(C.green, 0.18) : C.card2, color: owes ? C.green : C.sub, fontSize: 14, fontWeight: 700 }}>
          {owes ? <DollarSign className="w-4 h-4" /> : <Receipt className="w-4 h-4" />}
          {owes ? `Cobrar ${money(balance)}` : "Pagos y devoluciones"}
        </button>
      </Card>
    </div>
  );
}
