import React, { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Calculator } from "lucide-react";

const IVU_RATE = 0.115;

function toMoneyNumber(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, n);
}

export default function GlobalPriceWidget() {
  const [open, setOpen] = useState(false);
  const [partsPrice, setPartsPrice] = useState("");
  const [laborPrice, setLaborPrice] = useState("");
  const [includeTax, setIncludeTax] = useState(true);
  const [enabled, setEnabled] = useState(() => localStorage.getItem("smartfix_show_price_widget") !== "false");

  useEffect(() => {
    const handleOpen = () => setOpen(true);
    window.addEventListener("open-global-price-widget", handleOpen);
    const handleToggle = (e) => {
      setEnabled(e.detail?.enabled ?? true);
      if (!e.detail?.enabled) setOpen(false);
    };
    window.addEventListener("smartfix:price-widget-toggle", handleToggle);
    return () => {
      window.removeEventListener("open-global-price-widget", handleOpen);
      window.removeEventListener("smartfix:price-widget-toggle", handleToggle);
    };
  }, []);

  if (!enabled) return null;

  const totals = useMemo(() => {
    const parts = toMoneyNumber(partsPrice);
    const labor = toMoneyNumber(laborPrice);
    const subtotal = parts + labor;
    const tax = includeTax ? subtotal * IVU_RATE : 0;
    const total = subtotal + tax;
    return { parts, labor, subtotal, tax, total };
  }, [partsPrice, laborPrice, includeTax]);

  return (
    <>
      <button
        data-global-widget
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className="fixed z-[240] bottom-24 md:bottom-8 right-4 md:right-8 h-14 w-14 rounded-2xl border border-cyan-400/40 bg-gradient-to-br from-cyan-500/25 to-emerald-500/25 backdrop-blur-xl shadow-[0_12px_30px_rgba(6,182,212,0.28)] flex items-center justify-center hover:scale-105 transition-transform"
        title={open ? "Cerrar calculadora" : "Calculadora de precios"}
      >
        <Calculator className="w-6 h-6 text-cyan-300" />
      </button>

      {open && (
        <div
          data-global-widget
          className="fixed z-[230] right-4 md:right-8 w-[min(92vw,350px)] rounded-3xl bg-[#090a0d]/95 border border-white/10 text-white overflow-hidden shadow-2xl"
          style={{ bottom: "calc(env(safe-area-inset-bottom, 0px) + 96px)" }}
        >
          <div className="px-4 py-3 border-b border-white/10 bg-black/35">
            <h3 className="text-base font-bold flex items-center gap-2">
              <span className="w-8 h-8 rounded-lg bg-cyan-500/20 border border-cyan-400/40 flex items-center justify-center">
                <Calculator className="w-4 h-4 text-cyan-300" />
              </span>
              Calculadora Rapida
            </h3>
          </div>

          <div className="p-4 space-y-3">
            <div className="space-y-2">
              <Label className="text-white/70">Precio de piezas</Label>
              <Input
                type="number"
                min="0"
                step="0.01"
                value={partsPrice}
                onChange={(e) => setPartsPrice(e.target.value)}
                placeholder="0.00"
                className="bg-white/5 border-white/10"
              />
            </div>

            <div className="space-y-2">
              <Label className="text-white/70">Mano de obra</Label>
              <Input
                type="number"
                min="0"
                step="0.01"
                value={laborPrice}
                onChange={(e) => setLaborPrice(e.target.value)}
                placeholder="0.00"
                className="bg-white/5 border-white/10"
              />
            </div>

            <div className="space-y-2">
              <Label className="text-white/70">IVU</Label>
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  onClick={() => setIncludeTax(false)}
                  className={includeTax ? "flex-1 bg-white/5 border border-white/10 text-white/70" : "flex-1 bg-cyan-500 text-black font-bold"}
                >
                  Sin IVU
                </Button>
                <Button
                  type="button"
                  onClick={() => setIncludeTax(true)}
                  className={includeTax ? "flex-1 bg-emerald-500 text-black font-bold" : "flex-1 bg-white/5 border border-white/10 text-white/70"}
                >
                  Con IVU
                </Button>
              </div>
            </div>

            <div className="rounded-2xl border border-emerald-400/30 bg-gradient-to-r from-emerald-500/15 to-cyan-500/10 p-4">
              <div className="flex items-center justify-between text-sm text-white/80">
                <span>Piezas</span>
                <span>${totals.parts.toFixed(2)}</span>
              </div>
              <div className="flex items-center justify-between text-sm text-white/80 mt-1">
                <span>Mano de obra</span>
                <span>${totals.labor.toFixed(2)}</span>
              </div>
              <div className="flex items-center justify-between text-sm text-white/80 mt-1">
                <span>Subtotal</span>
                <span>${totals.subtotal.toFixed(2)}</span>
              </div>
              {includeTax && (
                <div className="flex items-center justify-between text-sm text-white/80 mt-1">
                  <span>IVU (11.5%)</span>
                  <span>${totals.tax.toFixed(2)}</span>
                </div>
              )}
              <div className="h-px bg-white/20 my-2" />
              <div className="flex items-center justify-between">
                <span className="font-bold">Total</span>
                <span className="text-2xl font-black text-emerald-300">${totals.total.toFixed(2)}</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
