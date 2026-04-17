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

  const totals = useMemo(() => {
    const parts = toMoneyNumber(partsPrice);
    const labor = toMoneyNumber(laborPrice);
    const subtotal = parts + labor;
    const tax = includeTax ? subtotal * IVU_RATE : 0;
    const total = subtotal + tax;
    return { parts, labor, subtotal, tax, total };
  }, [partsPrice, laborPrice, includeTax]);

  if (!enabled) return null;

  return (
    <>
      <button
        data-global-widget
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className="apple-press apple-type fixed z-[240] bottom-24 md:bottom-8 right-4 md:right-8 h-14 w-14 rounded-apple-lg bg-apple-blue/15 shadow-apple-md flex items-center justify-center"
        title={open ? "Cerrar calculadora" : "Calculadora de precios"}
      >
        <Calculator className="w-6 h-6 text-apple-blue" />
      </button>

      {open && (
        <div
          data-global-widget
          className="apple-type apple-card fixed z-[230] right-4 md:right-8 w-[min(92vw,350px)] rounded-apple-xl overflow-hidden shadow-apple-xl"
          style={{ bottom: "calc(env(safe-area-inset-bottom, 0px) + 96px)" }}
        >
          <div
            className="px-4 py-3 apple-surface-secondary"
            style={{ borderBottom: "0.5px solid rgb(var(--separator) / 0.29)" }}
          >
            <h3 className="apple-text-headline apple-label-primary flex items-center gap-2">
              <span className="w-8 h-8 rounded-apple-sm bg-apple-blue/15 flex items-center justify-center">
                <Calculator className="w-4 h-4 text-apple-blue" />
              </span>
              Calculadora Rápida
            </h3>
          </div>

          <div className="p-4 space-y-3">
            <div className="space-y-2">
              <Label className="apple-text-subheadline apple-label-secondary">Precio de piezas</Label>
              <Input
                type="number"
                min="0"
                step="0.01"
                value={partsPrice}
                onChange={(e) => setPartsPrice(e.target.value)}
                placeholder="0.00"
                className="apple-input tabular-nums"
              />
            </div>

            <div className="space-y-2">
              <Label className="apple-text-subheadline apple-label-secondary">Mano de obra</Label>
              <Input
                type="number"
                min="0"
                step="0.01"
                value={laborPrice}
                onChange={(e) => setLaborPrice(e.target.value)}
                placeholder="0.00"
                className="apple-input tabular-nums"
              />
            </div>

            <div className="space-y-2">
              <Label className="apple-text-subheadline apple-label-secondary">IVU</Label>
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  onClick={() => setIncludeTax(false)}
                  className={includeTax ? "apple-btn apple-btn-tinted flex-1" : "apple-btn apple-btn-primary flex-1"}
                >
                  Sin IVU
                </Button>
                <Button
                  type="button"
                  onClick={() => setIncludeTax(true)}
                  className={includeTax ? "apple-btn apple-btn-primary flex-1" : "apple-btn apple-btn-tinted flex-1"}
                >
                  Con IVU
                </Button>
              </div>
            </div>

            <div className="rounded-apple-lg bg-apple-green/12 p-4">
              <div className="flex items-center justify-between apple-text-subheadline apple-label-secondary">
                <span>Piezas</span>
                <span className="tabular-nums">${totals.parts.toFixed(2)}</span>
              </div>
              <div className="flex items-center justify-between apple-text-subheadline apple-label-secondary mt-1">
                <span>Mano de obra</span>
                <span className="tabular-nums">${totals.labor.toFixed(2)}</span>
              </div>
              <div className="flex items-center justify-between apple-text-subheadline apple-label-secondary mt-1">
                <span>Subtotal</span>
                <span className="tabular-nums">${totals.subtotal.toFixed(2)}</span>
              </div>
              {includeTax && (
                <div className="flex items-center justify-between apple-text-subheadline apple-label-secondary mt-1">
                  <span>IVU (11.5%)</span>
                  <span className="tabular-nums">${totals.tax.toFixed(2)}</span>
                </div>
              )}
              <div
                className="my-2"
                style={{ borderBottom: "0.5px solid rgb(var(--separator) / 0.29)" }}
              />
              <div className="flex items-center justify-between">
                <span className="apple-text-headline apple-label-primary">Total</span>
                <span className="apple-text-title2 text-apple-green tabular-nums">${totals.total.toFixed(2)}</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
