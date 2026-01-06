import React, { useEffect } from "react";
import ThermalLabel from "./ThermalLabel";
import ThermalOrderReceipt from "./ThermalOrderReceipt";
import ThermalSaleReceipt from "./ThermalSaleReceipt";
import { createPortal } from "react-dom";

export default function StandalonePrintView({ printType, data, customer, onClose }) {
  useEffect(() => {
    // ✅ Ocultar TODO el contenido del body
    const originalHTML = document.body.innerHTML;
    const originalOverflow = document.body.style.overflow;
    
    return () => {
      document.body.style.overflow = originalOverflow;
    };
  }, []);

  if (!printType) return null;

  return createPortal(
    <>
      <style>{`
        body.printing-active > *:not(#standalone-print-view) {
          display: none !important;
        }
        
        @media print {
          body * {
            visibility: hidden !important;
          }
          
          #standalone-print-view,
          #standalone-print-view * {
            visibility: visible !important;
          }
          
          #standalone-print-view {
            position: absolute !important;
            left: 0 !important;
            top: 0 !important;
          }
        }

        #standalone-print-view {
          position: fixed;
          inset: 0;
          z-index: 2147483647;
          background: white;
          overflow: auto;
        }
      `}</style>

      <div id="standalone-print-view">
        {printType === "label" && <ThermalLabel order={data} onClose={onClose} autoPrint />}
        {printType === "order-receipt" && <ThermalOrderReceipt order={data} onClose={onClose} autoPrint />}
        {printType === "sale-receipt" && <ThermalSaleReceipt sale={data} customer={customer} onClose={onClose} autoPrint />}
      </div>
    </>,
    document.body
  );
}
