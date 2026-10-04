import { useEffect, useRef, useState } from "react";
import JsBarcode from "jsbarcode";
import { Dialog, TextAction } from "@/components/pos/native/posUi";
import { dataClient } from "@/components/api/dataClient";
import { usd } from "@/lib/posLogic";

const randomCode = () => String(Math.floor(100000000000 + Math.random() * 900000000000));
const esc = (v) => String(v || "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

export default function BarcodeLabelDialog({ open, item, onClose, onSaved }) {
  const [code, setCode] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const svgRef = useRef(null);

  useEffect(() => { if (open && item) { setCode(String(item.barcode || item.sku || "") || randomCode()); setError(null); } }, [open, item?.id]);

  useEffect(() => {
    if (!open || !svgRef.current) return;
    const value = String(code || "").trim();
    if (!value) { svgRef.current.innerHTML = ""; return; }
    try {
      JsBarcode(svgRef.current, value, { format: "CODE128", width: 2, height: 70, displayValue: true, fontSize: 16, margin: 8 });
    } catch {
      svgRef.current.innerHTML = "";
    }
  }, [open, code]);

  if (!item) return null;

  const save = async () => {
    const value = String(code || "").trim();
    if (!value) return;
    setSaving(true);
    setError(null);
    try {
      await dataClient.entities.Product.update(item.id, { barcode: value });
      onSaved?.({ ...item, barcode: value });
    } catch (e) {
      setError(e?.message || "No se pudo guardar el código.");
    }
    setSaving(false);
  };

  const print = () => {
    const svg = svgRef.current?.outerHTML;
    if (!svg) return;
    const w = window.open("", "_blank", "width=420,height=360");
    if (!w) { setError("El navegador bloqueó la ventana de impresión."); return; }
    w.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>Etiqueta</title><style>@page{size:2.25in 1.25in;margin:0}body{margin:0;font-family:system-ui,sans-serif;display:flex;flex-direction:column;align-items:center;justify-content:center;height:100vh;text-align:center}.n{font-size:11px;font-weight:700;max-width:2in;overflow:hidden;white-space:nowrap;text-overflow:ellipsis}.p{font-size:13px;font-weight:800}svg{max-width:2in;height:auto}</style></head><body><div class="n">${esc(item.name)}</div>${svg}<div class="p">${esc(usd(Number(item.price || 0)))}</div><script>window.onload=function(){window.print()}</script></body></html>`);
    w.document.close();
  };

  return (
    <Dialog open={open} onClose={onClose} title="Etiqueta de código de barras" width={520} leading={<TextAction onClick={onClose}>Cerrar</TextAction>} trailing={<TextAction bold disabled={saving || !String(code).trim()} onClick={save}>{saving ? "Guardando…" : "Guardar código"}</TextAction>}>
      <div className="flex flex-col" style={{ gap: 14, paddingTop: 6 }}>
        <p className="text-center" style={{ fontSize: 15, fontWeight: 700 }}>{item.name}</p>
        <div className="flex justify-center" style={{ background: "#fff", borderRadius: 14, padding: 10 }}><svg ref={svgRef} style={{ maxWidth: "100%" }} /></div>
        <p className="text-center" style={{ fontSize: 18, fontWeight: 800 }}>{usd(Number(item.price || 0))}</p>
        <label className="flex flex-col" style={{ gap: 4 }}>
          <span style={{ fontSize: 12, color: "#8E8E93" }}>Código</span>
          <input id="barcode-code" value={code} onChange={(e) => setCode(e.target.value)} style={{ padding: "12px 14px", borderRadius: 12, background: "#2C2C2E", color: "#fff", border: "none", outline: "none", fontSize: 16 }} />
        </label>
        <div className="flex gap-2">
          <button onClick={() => setCode(randomCode())} className="apple-press flex-1" style={{ height: 44, borderRadius: 12, background: "#2C2C2E", color: "#fff", fontWeight: 600 }}>Generar al azar</button>
          <button onClick={print} className="apple-press flex-1" style={{ height: 44, borderRadius: 12, background: "#F2662E", color: "#fff", fontWeight: 700 }}>Imprimir etiqueta</button>
        </div>
        {error && <p style={{ fontSize: 13, color: "#FF453A" }}>{error}</p>}
      </div>
    </Dialog>
  );
}
