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
    <div className="fixed inset-0 z-[150] bg-black/90 backdrop-blur-md">
      <div className="h-full overflow-y-auto p-4">
        <div className="min-h-full flex items-center justify-center">
          <div className="w-full max-w-sm bg-[#0F0F12] border border-white/10 rounded-3xl shadow-2xl">

            {/* Header */}
            <div className="flex items-center justify-between px-5 pt-5 pb-4 border-b border-white/[0.06]">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-2xl bg-gradient-to-br from-cyan-500 to-emerald-500 flex items-center justify-center">
                  <Printer className="w-4 h-4 text-white" />
                </div>
                <div>
                  <h2 className="text-white font-black text-sm">
                    {type === "sale" ? "Recibo de Venta" : "Recibo de Orden"}
                  </h2>
                  <p className="text-white/40 text-[11px]">
                    #{type === "sale" ? data?.sale_number : data?.order_number}
                  </p>
                </div>
              </div>
              <button onClick={onClose} className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center text-white/40 hover:text-white hover:bg-white/10 transition-all">
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Receipt Preview */}
            <div className="px-4 py-4 bg-gradient-to-b from-white/[0.02] to-transparent overflow-y-auto max-h-[60vh]">
              {type === "sale"
                ? <ThermalSaleReceipt sale={data} customer={customer} />
                : <ThermalOrderReceipt order={data} />
              }
            </div>

            {/* Actions */}
            <div className="px-4 pb-5 pt-3 border-t border-white/[0.06]">
              <button
                onClick={handlePrint}
                className="w-full h-12 flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-cyan-600 to-emerald-600 text-white font-black text-sm shadow-[0_4px_20px_rgba(6,182,212,0.3)] active:scale-[0.98] transition-all"
              >
                <Printer className="w-4 h-4" />
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
