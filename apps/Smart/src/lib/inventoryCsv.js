import { effectivePrice, displayCategory } from "@/lib/posLogic";

const HEADER = ["Nombre", "Tipo", "Categoria", "SKU", "Ubicacion", "Precio", "Costo", "Margen %", "Stock", "Valor al costo"];

const escapeCell = (value) => {
  const s = String(value ?? "");
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

export function buildInventoryCsv(products, kindLabel) {
  const rows = [HEADER.join(",")];
  products.forEach((p) => {
    const price = Number(effectivePrice(p)) || 0;
    const cost = p.cost === null || p.cost === undefined || p.cost === "" ? null : Number(p.cost);
    const stockNum = p.stock === null || p.stock === undefined || p.stock === "" ? null : Number(p.stock);
    const isService = kindLabel(p) === "Servicio";
    const margin = cost !== null && cost > 0 && price > 0 ? String(Math.round(((price - cost) / price) * 100)) : "";
    const value = cost !== null && stockNum !== null ? (cost * stockNum).toFixed(2) : "";
    const cells = [p.name || "", kindLabel(p), displayCategory(p) || p.category || "", p.sku || "", p.location || "", price.toFixed(2), cost !== null ? cost.toFixed(2) : "", margin, isService ? "" : String(stockNum ?? 0), value];
    rows.push(cells.map(escapeCell).join(","));
  });
  return rows.join("\n");
}

export function downloadCsv(text, filename) {
  const blob = new Blob([`﻿${text}`], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
}
