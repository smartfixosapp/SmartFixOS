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
      <div className="apple-type py-12 text-center">
        <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 apple-label-secondary" />
        <p className="apple-text-footnote apple-label-secondary">Cargando...</p>
      </div>
    );
  }

  if (desgloseRows.length === 0) {
    return (
      <div className="apple-type py-12 text-center">
        <p className="apple-label-tertiary apple-text-subheadline">Sin ventas en este periodo</p>
      </div>
    );
  }

  return (
    <div className="apple-type space-y-2">
      {desgloseRows.map(r => {
        const netaPositive = r.neta >= 0;
        return (
          <div key={r.id} className="apple-card apple-press p-4 rounded-apple-md transition-all space-y-3">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-7 h-7 rounded-apple-sm bg-apple-green/15 text-apple-green flex items-center justify-center shrink-0">
                  <TrendingUp className="w-3 h-3" />
                </div>
                <div className="min-w-0">
                  <p className="apple-label-primary apple-text-footnote font-semibold truncate leading-tight">{r.cliente}</p>
                  <p className="apple-text-caption2 apple-label-tertiary tabular-nums truncate">
                    {r.desc}{r.fecha ? ` \u00B7 ${format(new Date(r.fecha), "dd MMM, h:mm a", { locale: es })}` : ""}
                  </p>
                </div>
              </div>
              <div className="text-right shrink-0">
                <p className="apple-text-caption2 font-semibold apple-label-tertiary mb-0.5">Neta</p>
                <p className={`apple-text-title2 tabular-nums leading-none ${netaPositive ? "text-apple-blue" : "text-apple-red"}`}>
                  {netaPositive ? "+" : "\u2212"}${Math.abs(r.neta).toFixed(2)}
                </p>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-2">
              <div className="bg-apple-green/12 rounded-apple-sm px-3 py-2 text-center">
                <p className="apple-text-caption2 font-semibold apple-label-tertiary">Cobrado</p>
                <p className="apple-text-subheadline font-semibold text-apple-green tabular-nums mt-0.5">${r.cobrado.toFixed(2)}</p>
              </div>
              <div className="bg-apple-orange/12 rounded-apple-sm px-3 py-2 text-center">
                <p className="apple-text-caption2 font-semibold apple-label-tertiary">Piezas</p>
                <p className="apple-text-subheadline font-semibold text-apple-orange tabular-nums mt-0.5">${r.piezas.toFixed(2)}</p>
              </div>
              <div className="bg-apple-yellow/12 rounded-apple-sm px-3 py-2 text-center">
                <p className="apple-text-caption2 font-semibold apple-label-tertiary">IVU</p>
                <p className="apple-text-subheadline font-semibold text-apple-yellow tabular-nums mt-0.5">${r.ivu.toFixed(2)}</p>
              </div>
            </div>
          </div>
        );
      })}

      {/* Totals card */}
      <div className={`apple-card p-4 rounded-apple-md space-y-3 mt-1 ${totNeta >= 0 ? "bg-apple-blue/12" : "bg-apple-red/12"}`}>
        <div className="flex items-center justify-between">
          <div>
            <p className="apple-label-primary apple-text-headline">Total del periodo</p>
            <p className="apple-text-caption2 apple-label-tertiary tabular-nums">{desgloseRows.length} venta{desgloseRows.length !== 1 ? "s" : ""}</p>
          </div>
          <div className="text-right">
            <p className="apple-text-caption2 font-semibold apple-label-tertiary mb-0.5">Neta total</p>
            <p className={`apple-text-title1 tabular-nums leading-none ${totNeta >= 0 ? "text-apple-blue" : "text-apple-red"}`}>
              {totNeta >= 0 ? "+" : "\u2212"}${Math.abs(totNeta).toFixed(2)}
            </p>
          </div>
        </div>
        <div className="grid grid-cols-3 gap-2">
          <div className="bg-apple-green/12 rounded-apple-sm px-3 py-2 text-center">
            <p className="apple-text-caption2 font-semibold apple-label-tertiary">Cobrado</p>
            <p className="apple-text-subheadline font-semibold text-apple-green tabular-nums mt-0.5">${totCobrado.toFixed(2)}</p>
          </div>
          <div className="bg-apple-orange/12 rounded-apple-sm px-3 py-2 text-center">
            <p className="apple-text-caption2 font-semibold apple-label-tertiary">Piezas</p>
            <p className="apple-text-subheadline font-semibold text-apple-orange tabular-nums mt-0.5">${totPiezas.toFixed(2)}</p>
          </div>
          <div className="bg-apple-yellow/12 rounded-apple-sm px-3 py-2 text-center">
            <p className="apple-text-caption2 font-semibold apple-label-tertiary">IVU</p>
            <p className="apple-text-subheadline font-semibold text-apple-yellow tabular-nums mt-0.5">${totIVU.toFixed(2)}</p>
          </div>
        </div>
      </div>
    </div>
  );
});
