import React from "react";
import { TrendingUp, RefreshCw } from "lucide-react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { getEntityDate, computeSaleProfit } from "@/hooks/useFinancialData";

export default React.memo(function DesgloseTab({ filteredSales, loading }) {
  const desgloseRows = filteredSales.map(sale => {
    const items = Array.isArray(sale?.items) ? sale.items : [];
    const salePartsCost = items.reduce((s, item) => {
      const qty = Number(item?.quantity || 0);
      return s + Number(item?.line_cost || (Number(item?.cost || 0) * qty));
    }, 0);
    const saleIVU = Number(sale.tax_amount || 0);
    const saleCobrado = Number(sale.total || 0);
    const saleNeta = saleCobrado - saleIVU - salePartsCost;
    const desc = items.length > 0
      ? items.map(i => i.name || i.service_name || i.product_name || "Articulo").join(", ")
      : sale.notes || "Sin descripcion";
    return {
      id: sale.id, cliente: sale.customer_name || "Consumidor Final", desc,
      fecha: getEntityDate(sale), cobrado: saleCobrado, piezas: salePartsCost,
      ivu: saleIVU, neta: saleNeta,
    };
  });

  const totCobrado = desgloseRows.reduce((s, r) => s + r.cobrado, 0);
  const totPiezas  = desgloseRows.reduce((s, r) => s + r.piezas,  0);
  const totIVU     = desgloseRows.reduce((s, r) => s + r.ivu,     0);
  const totNeta    = desgloseRows.reduce((s, r) => s + r.neta,    0);

  if (loading) {
    return (
      <div className="py-12 text-center">
        <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-white/50" />
        <p className="text-xs text-white/50 font-bold">Cargando...</p>
      </div>
    );
  }

  if (desgloseRows.length === 0) {
    return (
      <div className="py-12 text-center">
        <p className="text-white/25 font-bold text-sm">Sin ventas en este periodo</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {desgloseRows.map(r => {
        const netaPositive = r.neta >= 0;
        return (
          <div key={r.id} className="p-4 rounded-2xl bg-white/[0.02] hover:bg-white/[0.04] border border-white/[0.06] transition-all space-y-3">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-7 h-7 rounded-xl bg-emerald-500/15 text-emerald-400 flex items-center justify-center shrink-0">
                  <TrendingUp className="w-3 h-3" />
                </div>
                <div className="min-w-0">
                  <p className="text-white/60 font-bold text-xs truncate leading-tight">{r.cliente}</p>
                  <p className="text-[10px] text-white/25 truncate">
                    {r.desc}{r.fecha ? ` \u00B7 ${format(new Date(r.fecha), "dd MMM, h:mm a", { locale: es })}` : ""}
                  </p>
                </div>
              </div>
              <div className="text-right shrink-0">
                <p className="text-[9px] font-black text-white/50 uppercase tracking-widest mb-0.5">Neta</p>
                <p className={`text-xl font-black tabular-nums leading-none ${netaPositive ? "text-cyan-400" : "text-red-400"}`}>
                  {netaPositive ? "+" : "\u2212"}${Math.abs(r.neta).toFixed(2)}
                </p>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-2">
              <div className="bg-emerald-500/[0.08] border border-emerald-500/15 rounded-xl px-3 py-2 text-center">
                <p className="text-[9px] font-black text-white/25 uppercase tracking-widest">Cobrado</p>
                <p className="text-sm font-black text-emerald-400 tabular-nums mt-0.5">${r.cobrado.toFixed(2)}</p>
              </div>
              <div className="bg-orange-500/[0.08] border border-orange-500/15 rounded-xl px-3 py-2 text-center">
                <p className="text-[9px] font-black text-white/25 uppercase tracking-widest">Piezas</p>
                <p className="text-sm font-black text-orange-400 tabular-nums mt-0.5">${r.piezas.toFixed(2)}</p>
              </div>
              <div className="bg-amber-500/[0.08] border border-amber-500/15 rounded-xl px-3 py-2 text-center">
                <p className="text-[9px] font-black text-white/25 uppercase tracking-widest">IVU</p>
                <p className="text-sm font-black text-amber-400 tabular-nums mt-0.5">${r.ivu.toFixed(2)}</p>
              </div>
            </div>
          </div>
        );
      })}

      {/* Totals card */}
      <div className={`p-4 rounded-2xl border-2 space-y-3 mt-1 ${totNeta >= 0 ? "bg-cyan-500/[0.06] border-cyan-500/25" : "bg-red-500/[0.06] border-red-500/25"}`}>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-white font-black text-sm">Total del periodo</p>
            <p className="text-[10px] text-white/30">{desgloseRows.length} venta{desgloseRows.length !== 1 ? "s" : ""}</p>
          </div>
          <div className="text-right">
            <p className="text-[9px] font-black text-white/50 uppercase tracking-widest mb-0.5">Neta total</p>
            <p className={`text-2xl font-black tabular-nums leading-none ${totNeta >= 0 ? "text-cyan-400" : "text-red-400"}`}>
              {totNeta >= 0 ? "+" : "\u2212"}${Math.abs(totNeta).toFixed(2)}
            </p>
          </div>
        </div>
        <div className="grid grid-cols-3 gap-2">
          <div className="bg-emerald-500/[0.08] border border-emerald-500/15 rounded-xl px-3 py-2 text-center">
            <p className="text-[9px] font-black text-white/25 uppercase tracking-widest">Cobrado</p>
            <p className="text-sm font-black text-emerald-400 tabular-nums mt-0.5">${totCobrado.toFixed(2)}</p>
          </div>
          <div className="bg-orange-500/[0.08] border border-orange-500/15 rounded-xl px-3 py-2 text-center">
            <p className="text-[9px] font-black text-white/25 uppercase tracking-widest">Piezas</p>
            <p className="text-sm font-black text-orange-400 tabular-nums mt-0.5">${totPiezas.toFixed(2)}</p>
          </div>
          <div className="bg-amber-500/[0.08] border border-amber-500/15 rounded-xl px-3 py-2 text-center">
            <p className="text-[9px] font-black text-white/25 uppercase tracking-widest">IVU</p>
            <p className="text-sm font-black text-amber-400 tabular-nums mt-0.5">${totIVU.toFixed(2)}</p>
          </div>
        </div>
      </div>
    </div>
  );
});
