import React, { useState, useEffect } from "react";
import { Printer, X } from "lucide-react";
import { toast } from "sonner";
import { base44 } from "@/api/base44Client";
import ThermalSaleReceipt from "./ThermalSaleReceipt";
import ThermalOrderReceipt from "./ThermalOrderReceipt";

export default function UniversalPrintDialog({
  open,
  onClose,
  type = "sale", // "sale" o "order"
  data,
  customer
}) {
  const [businessInfo, setBusinessInfo] = useState(null);

  useEffect(() => {
    if (open) {
      base44.entities.AppSettings.filter({ slug: "app-main-settings" })
        .then(configs => { if (configs?.length) setBusinessInfo(configs[0].payload); })
        .catch(() => {});
    }
  }, [open]);

  const handlePrint = () => {
    window.print();
    toast.success("✅ Imprimiendo recibo");
    setTimeout(() => onClose?.(), 1000);
  };

  if (!open) return null;

  return (
    <div className="apple-type fixed inset-0 z-[150] bg-black/50 backdrop-blur-sm">
      <div className="h-full overflow-y-auto p-4">
        <div className="min-h-full flex items-center justify-center">
          <div className="w-full max-w-sm apple-surface-elevated rounded-apple-lg shadow-apple-xl border-0 p-0 overflow-hidden">

            {/* Header */}
            <div className="flex items-center justify-between px-5 pt-5 pb-4" style={{ borderBottom: "0.5px solid rgb(var(--separator) / 0.29)" }}>
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-apple-sm bg-apple-blue/15 flex items-center justify-center">
                  <Printer className="w-4 h-4 text-apple-blue" />
                </div>
                <div>
                  <h2 className="apple-label-primary apple-text-subheadline font-semibold">
                    {type === "sale" ? "Recibo de Venta" : "Recibo de Orden"}
                  </h2>
                  <p className="apple-label-secondary apple-text-caption1 tabular-nums">
                    #{type === "sale" ? data?.sale_number : data?.order_number}
                  </p>
                </div>
              </div>
              <button onClick={onClose} className="apple-press w-8 h-8 rounded-full bg-gray-sys6 dark:bg-gray-sys5 flex items-center justify-center apple-label-secondary transition-all">
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Receipt Preview */}
            <div className="px-4 py-4 apple-surface overflow-y-auto max-h-[60vh]">
              {type === "sale"
                ? <ThermalSaleReceipt sale={data} customer={customer} />
                : <ThermalOrderReceipt order={data} />
              }
            </div>

            {/* Actions */}
            <div className="px-4 pb-5 pt-3" style={{ borderTop: "0.5px solid rgb(var(--separator) / 0.29)" }}>
              <button
                onClick={handlePrint}
                className="apple-btn apple-btn-primary w-full h-12"
              >
                <Printer className="w-4 h-4 mr-2" />
                Imprimir Recibo
              </button>
            </div>
          </div>
        </div>
      </div>

      <style>{`
        @media print {
          body * { visibility: hidden !important; }
          #thermal-receipt-root, #thermal-receipt-root * { visibility: visible !important; }
          #thermal-receipt-root {
            position: absolute !important; left: 0 !important; top: 0 !important;
            width: 80mm !important;
          }
          @page { size: 80mm auto; margin: 0; }
        }
      `}</style>
    </div>
  );
}
